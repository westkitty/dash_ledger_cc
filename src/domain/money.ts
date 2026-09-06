/**
 * Money is integer cents everywhere in the domain. All parsing, formatting and
 * arithmetic goes through this module so floating-point drift stays out of
 * components and calculations.
 */

export type Cents = number;

/**
 * Parse user-entered currency text into integer cents.
 * Accepts "$84.50", "84.50", "84", "1,234.5", " 5 ", "-3.20".
 * Returns null for blank input, NaN for unparseable input is avoided —
 * unparseable returns null too, callers decide how to treat "missing".
 */
export function parseMoneyToCents(input: string | number | null | undefined): Cents | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    return Math.round(input * 100);
  }
  const trimmed = input.trim();
  if (trimmed === '') return null;
  // Strip currency symbols, spaces and thousands separators.
  const cleaned = trimmed.replace(/[$\s]/g, '').replace(/,/g, '');
  if (!/^-?\d*(\.\d{0,})?$/.test(cleaned) || cleaned === '' || cleaned === '-' || cleaned === '.') {
    return null;
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** Format integer cents as "$1,234.50". Rounds defensively at the output boundary. */
export function formatCents(cents: Cents | null | undefined, opts: { sign?: boolean } = {}): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return '—';
  const rounded = Math.round(cents);
  const negative = rounded < 0;
  const abs = Math.abs(rounded);
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  const grouped = dollars.toLocaleString('en-US');
  const body = `$${grouped}.${rem < 10 ? `0${rem}` : rem}`;
  if (negative) return `-${body}`;
  if (opts.sign && rounded > 0) return `+${body}`;
  return body;
}

/** Plain numeric string for CSV output, e.g. "84.50". */
export function centsToPlainString(cents: Cents | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return '';
  const rounded = Math.round(cents);
  const negative = rounded < 0;
  const abs = Math.abs(rounded);
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${negative ? '-' : ''}${dollars}.${rem < 10 ? `0${rem}` : rem}`;
}

export function addCents(...values: Array<Cents | null | undefined>): Cents {
  let total = 0;
  for (const v of values) {
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    total += Math.round(v);
  }
  return total;
}

export function subCents(a: Cents | null | undefined, b: Cents | null | undefined): Cents {
  return addCents(a, b === null || b === undefined ? 0 : -b);
}

/** Sum a list, treating null/undefined as zero. */
export function sumCents(values: Array<Cents | null | undefined>): Cents {
  return addCents(...values);
}

/** Gross income = DoorDash/app earnings + additional cash tips not already in the app total. */
export function grossIncomeCents(
  appEarningsCents: Cents | null | undefined,
  cashTipsCents: Cents | null | undefined,
): Cents {
  return addCents(appEarningsCents, cashTipsCents);
}

/** Convert dollars (float) to integer cents, e.g. rate math results. */
export function dollarsToCents(dollars: number): Cents {
  return Math.round(dollars * 100);
}
