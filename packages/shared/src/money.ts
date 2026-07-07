import Decimal from 'decimal.js';

/**
 * Money & quantity helpers — SPEC §6.1.
 *
 * Legacy used `Math.round(x*100)/100` (round half-up to 2dp). We reproduce that
 * exactly with decimal.js configured for ROUND_HALF_UP. NEVER use float
 * arithmetic on money (CLAUDE.md golden rule #2).
 *
 * Money  = DECIMAL(16,2) → 2 decimal places.
 * Qty    = DECIMAL(16,3) → 3 decimal places.
 */

// Half-up rounding to mirror the legacy Java Math.round behavior.
Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export type Numeric = Decimal.Value;

export const MONEY_DP = 2;
export const QTY_DP = 3;

/** Wrap any numeric-like value in a Decimal. Empty/blank → 0 (legacy normalization). */
export function dec(value: Numeric | null | undefined): Decimal {
  if (value === null || value === undefined || value === '') return new Decimal(0);
  return new Decimal(value);
}

/** Round a value to money precision (2dp, half-up) and return a Decimal. */
export function money(value: Numeric): Decimal {
  return dec(value).toDecimalPlaces(MONEY_DP, Decimal.ROUND_HALF_UP);
}

/** Round a value to quantity precision (3dp, half-up) and return a Decimal. */
export function qty(value: Numeric): Decimal {
  return dec(value).toDecimalPlaces(QTY_DP, Decimal.ROUND_HALF_UP);
}

/** Money value as a fixed-2 string, suitable for Prisma Decimal columns. */
export function moneyStr(value: Numeric): string {
  return money(value).toFixed(MONEY_DP);
}

/** Quantity value as a fixed-3 string. */
export function qtyStr(value: Numeric): string {
  return qty(value).toFixed(QTY_DP);
}

/** Sum a list of numeric-like values at money precision. */
export function sumMoney(values: Numeric[]): Decimal {
  return money(values.reduce<Decimal>((acc, v) => acc.plus(dec(v)), new Decimal(0)));
}

/**
 * Parse a legacy VARCHAR numeric: trim, strip spaces, `,`→`.`, empty→0.
 * Used by the migration CLI (Phase 7) and any user numeric input. SPEC §4.2.
 */
export function parseLegacyNumber(raw: string | null | undefined): Decimal {
  if (raw === null || raw === undefined) return new Decimal(0);
  const cleaned = String(raw).trim().replace(/\s+/g, '').replace(',', '.');
  if (cleaned === '' || cleaned === '-') return new Decimal(0);
  try {
    return new Decimal(cleaned);
  } catch {
    return new Decimal(0);
  }
}

/**
 * Parse a quantity input that may be a fraction `a/b` (POS cart, SPEC §5.2).
 * e.g. "1/2" → 0.5, "3" → 3, "1,5" → 1.5. Returns null on invalid input.
 */
export function parseQtyInput(raw: string): Decimal | null {
  const s = raw.trim().replace(',', '.');
  if (s === '') return null;
  const slash = s.indexOf('/');
  if (slash !== -1) {
    const num = s.slice(0, slash).trim();
    const den = s.slice(slash + 1).trim();
    try {
      const d = new Decimal(num).dividedBy(new Decimal(den));
      if (!d.isFinite()) return null;
      return qty(d);
    } catch {
      return null;
    }
  }
  try {
    return qty(new Decimal(s));
  } catch {
    return null;
  }
}

export { Decimal };
