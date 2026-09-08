/**
 * Money resolution at the legacy import boundary.
 *
 * Earlier Dash Ledger lineages stored money as floating-point DOLLARS
 * (`appEarnings: 96.5`). The canonical schema stores integer CENTS
 * (`appEarningsCents: 9650`). A database that was written by the original app
 * and later opened by an early `dash_ledger_cc` build can contain rows carrying
 * either representation — or both.
 *
 * This module is the ONLY place that converts between them, and it never
 * invents a value:
 *
 *   - absent          -> null   (missing stays missing; it is NOT zero)
 *   - legacy only     -> converted cents
 *   - canonical only  -> those cents
 *   - both, agreeing  -> those cents
 *   - both, differing -> null + CONFLICT, with both source values retained
 *   - malformed       -> null + INVALID, with the raw value retained
 *
 * Nothing downstream of the importer is allowed to know about dollar fields.
 */

export type MoneyFieldStatus =
  | 'absent'
  | 'legacy-only'
  | 'canonical-only'
  | 'agreed'
  | 'conflict'
  | 'invalid';

export interface MoneyFieldResolution {
  /** Canonical field this resolution is for, e.g. `appEarningsCents`. */
  field: string;
  status: MoneyFieldStatus;
  /**
   * Resolved integer cents, or null when the value is absent, conflicting or
   * malformed. Null is never silently substituted with 0.
   */
  cents: number | null;
  /** Raw legacy dollar value as found in the source, for evidence. */
  legacyDollars: number | null;
  /** Raw canonical cents value as found in the source, for evidence. */
  canonicalCents: number | null;
  /** Legacy dollars expressed in cents, for conflict evidence. */
  legacyAsCents: number | null;
  /** Human-readable explanation when the status is not a clean resolution. */
  detail: string | null;
}

/** Money values outside this magnitude are treated as malformed, not clamped. */
const MAX_ABS_DOLLARS = 1e12;

/**
 * Convert a legacy floating-point dollar amount to integer cents without
 * performing the multiplication in binary floating point.
 *
 * `0.145 * 100` is `14.499999999999998` in IEEE-754, which `Math.round` turns
 * into 14 rather than the intended 15. Shifting the decimal point on the fixed
 * decimal representation instead avoids that whole class of error.
 *
 * Returns null for anything that is not a finite in-range number.
 */
export function legacyDollarsToCents(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (Math.abs(value) >= MAX_ABS_DOLLARS) return null;

  // toFixed never uses exponent notation below 1e21, and 10 fractional digits is
  // far more precision than any legacy 2-decimal money value carried.
  const fixed = value.toFixed(10);
  const negative = fixed.startsWith('-');
  const body = negative ? fixed.slice(1) : fixed;
  const [intPart, fracPart = ''] = body.split('.');

  const centsDigits = `${intPart}${fracPart.slice(0, 2).padEnd(2, '0')}`;
  let cents = Number(centsDigits);
  if (!Number.isSafeInteger(cents)) return null;

  // Round half-up on the third decimal place onwards.
  const remainder = fracPart.slice(2);
  if (remainder && Number(remainder[0]) >= 5) cents += 1;

  return negative ? -cents : cents;
}

/** True when a source field carries no value at all (as opposed to an explicit 0). */
export function isAbsentMoney(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function readCanonicalCents(value: unknown): { cents: number | null; malformed: boolean } {
  if (isAbsentMoney(value)) return { cents: null, malformed: false };
  if (typeof value !== 'number' || !Number.isFinite(value)) return { cents: null, malformed: true };
  if (!Number.isInteger(value)) return { cents: null, malformed: true };
  if (!Number.isSafeInteger(value)) return { cents: null, malformed: true };
  return { cents: value, malformed: false };
}

/**
 * Resolve one money field from a legacy record that may carry a dollar field, a
 * cents field, both, or neither.
 */
export function resolveMoneyField(
  field: string,
  legacyDollarValue: unknown,
  canonicalCentsValue: unknown,
): MoneyFieldResolution {
  const legacyAbsent = isAbsentMoney(legacyDollarValue);
  const canonical = readCanonicalCents(canonicalCentsValue);
  const canonicalAbsent = isAbsentMoney(canonicalCentsValue);

  const legacyDollars =
    !legacyAbsent && typeof legacyDollarValue === 'number' && Number.isFinite(legacyDollarValue)
      ? legacyDollarValue
      : null;
  const legacyAsCents = legacyAbsent ? null : legacyDollarsToCents(legacyDollarValue);
  const legacyMalformed = !legacyAbsent && legacyAsCents === null;

  const base = {
    field,
    legacyDollars,
    canonicalCents: canonical.cents,
    legacyAsCents,
  };

  // Neither representation present.
  if (legacyAbsent && canonicalAbsent) {
    return { ...base, status: 'absent', cents: null, detail: null };
  }

  // Both present and both usable -> agree or conflict.
  if (!legacyAbsent && !canonicalAbsent) {
    if (legacyMalformed || canonical.malformed) {
      return {
        ...base,
        status: 'invalid',
        cents: null,
        detail: `${field}: source carried both representations but at least one is malformed (legacy=${String(
          legacyDollarValue,
        )}, canonical=${String(canonicalCentsValue)}). Left unset rather than guessed.`,
      };
    }
    if (legacyAsCents === canonical.cents) {
      return { ...base, status: 'agreed', cents: canonical.cents, detail: null };
    }
    return {
      ...base,
      status: 'conflict',
      cents: null,
      detail: `${field}: the record carries two different amounts — legacy ${String(
        legacyDollarValue,
      )} dollars (= ${String(legacyAsCents)} cents) and ${String(
        canonical.cents,
      )} cents. Both were kept for review; neither was chosen automatically.`,
    };
  }

  // Legacy only.
  if (!legacyAbsent) {
    if (legacyMalformed) {
      return {
        ...base,
        status: 'invalid',
        cents: null,
        detail: `${field}: legacy value ${String(legacyDollarValue)} is not a usable amount. Left unset.`,
      };
    }
    return { ...base, status: 'legacy-only', cents: legacyAsCents, detail: null };
  }

  // Canonical only.
  if (canonical.malformed) {
    return {
      ...base,
      status: 'invalid',
      cents: null,
      detail: `${field}: value ${String(canonicalCentsValue)} is not integer cents. Left unset.`,
    };
  }
  return { ...base, status: 'canonical-only', cents: canonical.cents, detail: null };
}

/** True for statuses that need a human decision before the value can be trusted. */
export function isBlockingMoneyStatus(status: MoneyFieldStatus): boolean {
  return status === 'conflict' || status === 'invalid';
}

/** Serializable evidence for an import report row. */
export function moneyEvidence(r: MoneyFieldResolution): Record<string, string | number | null> {
  return {
    field: r.field,
    status: r.status,
    legacyDollars: r.legacyDollars,
    legacyAsCents: r.legacyAsCents,
    canonicalCents: r.canonicalCents,
  };
}
