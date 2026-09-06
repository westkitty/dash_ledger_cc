/**
 * Local merchant -> category memory.
 *
 * A suggestion only appears after the same merchant has been classified the same
 * way at least twice. Suggestions are always visible as suggestions, always
 * overridable, and never applied automatically.
 */

import type { MerchantMemoryEntry, TaxClass } from './types';
import { taxClassForCategory } from './expenses';

export function normaliseMerchant(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export const MIN_OBSERVATIONS_FOR_SUGGESTION = 2;

export interface MerchantSuggestion {
  category: string;
  taxClass: TaxClass;
  observations: number;
  reason: string;
}

/**
 * Given the memory entry for a merchant, return a suggestion if one category has
 * been used at least MIN_OBSERVATIONS_FOR_SUGGESTION times and is the clear top.
 */
export function suggestionFor(entry: MerchantMemoryEntry | undefined | null): MerchantSuggestion | null {
  if (!entry) return null;
  const pairs = Object.entries(entry.counts).filter(([, c]) => c > 0);
  if (pairs.length === 0) return null;
  pairs.sort((a, b) => b[1] - a[1]);
  const [topCategory, topCount] = pairs[0];
  if (topCount < MIN_OBSERVATIONS_FOR_SUGGESTION) return null;
  // If there is a tie for the top count, don't guess.
  if (pairs.length > 1 && pairs[1][1] === topCount) return null;
  return {
    category: topCategory,
    taxClass: taxClassForCategory(topCategory),
    observations: topCount,
    reason: `Suggested from your history: ${topCategory}`,
  };
}

/** Fold a new classification into a merchant memory entry (pure). */
export function recordClassification(
  existing: MerchantMemoryEntry | undefined | null,
  rawMerchant: string,
  category: string,
  now: string,
): MerchantMemoryEntry {
  const key = normaliseMerchant(rawMerchant);
  const counts = { ...(existing?.counts ?? {}) };
  counts[category] = (counts[category] ?? 0) + 1;
  return {
    merchantKey: key,
    displayName: existing?.displayName || rawMerchant.trim(),
    counts,
    lastCategory: category,
    lastTaxClass: taxClassForCategory(category),
    updatedAt: now,
  };
}
