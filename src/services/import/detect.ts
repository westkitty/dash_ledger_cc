/**
 * Source-dialect detection.
 *
 * Detection is STRUCTURAL, not marker-only. The `dash-ledger-backup` marker was
 * written by two lineages with incompatible bodies, so the marker alone cannot
 * decide how to read a file. The record shape decides.
 */

import {
  CANONICAL_FORMATS,
  GROK_V1_FORMAT,
  LEGACY_V1_FORMATS,
} from '../backupFormats';
import type { SourceFormat, SourceVariant } from './types';

export interface Detection {
  format: SourceFormat;
  variant: SourceVariant;
  schemaVersion: number | null;
  formatVersion: number | null;
  generatedAt: string | null;
  /** The literal marker found in the file, for reporting. */
  rawFormat: string | null;
  /** Human-readable description shown before anything destructive happens. */
  label: string;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function arr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter(isPlainObject) : [];
}

function has(row: Record<string, unknown>, key: string): boolean {
  return key in row && row[key] !== undefined;
}

/** Legacy dollar-denominated markers on a record. */
const LEGACY_SHIFT_KEYS = ['appEarnings', 'cashTips', 'grossIncome'];
const CANONICAL_SHIFT_KEYS = ['appEarningsCents', 'cashTipsCents'];

export function detectSource(raw: unknown): Detection {
  const base: Detection = {
    format: 'unknown',
    variant: 'unknown',
    schemaVersion: null,
    formatVersion: null,
    generatedAt: null,
    rawFormat: null,
    label: 'Unrecognised file',
  };

  if (!isPlainObject(raw)) return base;

  const rawFormat = typeof raw.format === 'string' ? raw.format : null;
  const schemaVersion = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : null;
  const formatVersion = typeof raw.formatVersion === 'number' ? raw.formatVersion : null;
  const generatedAt = typeof raw.generatedAt === 'string' ? raw.generatedAt : null;
  const common = { ...base, rawFormat, schemaVersion, formatVersion, generatedAt };

  if (rawFormat && CANONICAL_FORMATS.includes(rawFormat)) {
    return {
      ...common,
      format: 'canonical-v2',
      variant: 'canonical',
      label: 'Dash Ledger canonical backup (v2)',
    };
  }

  const dashes = arr(raw.dashes);
  const shifts = arr(raw.shifts);

  if (rawFormat === GROK_V1_FORMAT || (dashes.length > 0 && shifts.length === 0)) {
    return {
      ...common,
      format: 'grok-v1',
      variant: 'grok',
      label: 'Dash Ledger (Grok build) backup',
    };
  }

  const looksV1 =
    (rawFormat && LEGACY_V1_FORMATS.includes(rawFormat)) ||
    shifts.length > 0 ||
    Array.isArray(raw.shifts) ||
    Array.isArray(raw.weeklyClosures);

  if (!looksV1) return common;

  const variant = detectV1Variant(raw);
  return {
    ...common,
    format: 'dash-ledger-v1',
    variant,
    label:
      variant === 'legacy-a'
        ? 'Original Dash Ledger backup (v1, dollar amounts)'
        : variant === 'cc-b'
          ? 'Early dash_ledger_cc backup (v1, integer cents)'
          : variant === 'mixed'
            ? 'Mixed v1 source — contains both original and cc-era records'
            : 'Dash Ledger v1 backup (no money records found)',
  };
}

/**
 * Decide which lineage produced a `dash-ledger-backup` body by looking at the
 * rows. A hybrid database (original app, later opened by an early cc build)
 * reports `mixed`; per-row handling still happens in the adapter.
 */
export function detectV1Variant(raw: Record<string, unknown>): SourceVariant {
  let sawLegacy = false;
  let sawCanonical = false;

  for (const row of arr(raw.shifts)) {
    if (LEGACY_SHIFT_KEYS.some((k) => has(row, k))) sawLegacy = true;
    if (CANONICAL_SHIFT_KEYS.some((k) => has(row, k))) sawCanonical = true;
  }
  for (const row of arr(raw.expenses)) {
    if (has(row, 'amount')) sawLegacy = true;
    if (has(row, 'amountCents')) sawCanonical = true;
  }
  for (const row of arr(raw.receipts)) {
    if (has(row, 'imageBase64')) sawLegacy = true;
    if (has(row, 'image')) sawCanonical = true;
    if (has(row, 'amount')) sawLegacy = true;
    if (has(row, 'amountCents')) sawCanonical = true;
  }

  if (sawLegacy && sawCanonical) return 'mixed';
  if (sawLegacy) return 'legacy-a';
  if (sawCanonical) return 'cc-b';
  return 'unknown';
}

/** True when this build has an adapter for the detected dialect. */
export function isImportable(d: Detection): boolean {
  return d.format !== 'unknown';
}
