import { parseLegacyNumber, Decimal } from '@cozgut/shared';

export { parseLegacyNumber };

/** Legacy sentinel/placeholder strings that mean "no value" in code-like columns
 * (e.g. fakturtoleg.karzKot='****', ammar.walyuta='-'). Not NULL, not real data. */
const DEFAULT_SENTINELS = ['-', '****', ''];

export function nullIfSentinel(
  raw: string | null | undefined,
  sentinels: string[] = DEFAULT_SENTINELS,
): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  return sentinels.includes(trimmed) ? null : trimmed;
}

/** MySQL zero-date `0000-00-00` (legal in legacy, illegal for Prisma/MySQL strict
 * mode) and blank strings both become `null`. */
export function parseLegacyDate(raw: unknown): Date | null {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return raw.getFullYear() === 0 ? null : raw;
  }
  const s = String(raw).trim();
  if (s === '' || s === '0000-00-00' || s.startsWith('0000-00-00')) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Combine a legacy DATE column and a TIME column into one JS Date. Falls back
 * to the date at midnight if the time is missing/invalid. */
export function combineDateTime(dateRaw: unknown, timeRaw: unknown): Date | null {
  const date = parseLegacyDate(dateRaw);
  if (!date) return null;
  if (!timeRaw) return date;
  const timeStr = String(timeRaw).trim();
  const match = /^(\d{1,2}):(\d{2})(:(\d{2}))?$/.exec(timeStr);
  if (!match) return date;
  const [, hh, mm, , ss] = match;
  const combined = new Date(date);
  combined.setHours(Number(hh), Number(mm), ss ? Number(ss) : 0, 0);
  return combined;
}

/** True if the parsed legacy number round-trips cleanly (not a slash-joined
 * phone number, not garbage text) — used to flag rows worth a warning instead
 * of silently coercing to 0 (e.g. karzcylar.hasap = '62427265/2'). */
export function isCleanNumeric(raw: string | null | undefined): boolean {
  if (raw === null || raw === undefined) return true;
  const cleaned = String(raw).trim().replace(/\s+/g, '').replace(',', '.');
  if (cleaned === '' || cleaned === '-') return true;
  return /^-?\d+(\.\d+)?$/.test(cleaned);
}

export type CashMoveTypeGuess =
  'SALE_CASH' | 'DEPOSIT' | 'WITHDRAWAL' | 'PURCHASE_PAYMENT' | 'DEBT_PAYMENT_IN';

/**
 * Legacy `kassahereket` has no explicit "kind" column — only `girdeji`
 * (income), `cykdajy` (expense) and a free-text `bellik` note. This guesses
 * a CashMoveType from keywords, matching SPEC's move types; unmatched rows
 * fall back to the plain SALE_CASH/WITHDRAWAL buckets. Counts of each bucket
 * are reported by the reconciliation step so a human can spot-check them.
 */
export function classifyCashMove(
  bellik: string | null | undefined,
  isIncome: boolean,
): CashMoveTypeGuess {
  const text = (bellik ?? '').toLowerCase();
  if (isIncome) {
    if (text.includes('karz')) return 'DEBT_PAYMENT_IN';
    if (text.includes('goý') || text.includes('goy')) return 'DEPOSIT';
    return 'SALE_CASH';
  }
  if (text.includes('dükan') || text.includes('dukan')) return 'PURCHASE_PAYMENT';
  return 'WITHDRAWAL';
}

/** Decimal → fixed-string for a raw parameterized SQL insert (mysql2 accepts
 * strings for DECIMAL columns; passing a JS number risks float artifacts). */
export function decStr(value: Decimal, dp: number): string {
  return value.toDecimalPlaces(dp).toFixed(dp);
}

/** Defensively clamp free-text legacy values to the new schema's VARCHAR
 * length (legacy columns are frequently wider than their new equivalents,
 * e.g. `bellik varchar(200)` → `cash_moves.note varchar(191)`). */
export function truncate(value: string | null, maxLen: number): string | null {
  if (value === null) return null;
  return value.length > maxLen ? value.slice(0, maxLen) : value;
}
