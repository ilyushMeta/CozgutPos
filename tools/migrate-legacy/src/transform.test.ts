import { describe, it, expect } from 'vitest';
import { Decimal } from '@cozgut/shared';
import {
  nullIfSentinel,
  parseLegacyDate,
  combineDateTime,
  isCleanNumeric,
  classifyCashMove,
  decStr,
  truncate,
} from './transform.js';

describe('nullIfSentinel', () => {
  it('maps default sentinels to null', () => {
    expect(nullIfSentinel('-')).toBeNull();
    expect(nullIfSentinel('****')).toBeNull();
    expect(nullIfSentinel('')).toBeNull();
    expect(nullIfSentinel(null)).toBeNull();
  });

  it('passes real values through trimmed', () => {
    expect(nullIfSentinel('  8001  ')).toBe('8001');
  });

  it('accepts custom sentinel lists', () => {
    expect(nullIfSentinel('kassadan alnan', ['kassadan alnan'])).toBeNull();
    expect(nullIfSentinel('8001', ['kassadan alnan'])).toBe('8001');
  });
});

describe('parseLegacyDate', () => {
  it('maps MySQL zero-date to null', () => {
    expect(parseLegacyDate('0000-00-00')).toBeNull();
  });

  it('maps blank/null to null', () => {
    expect(parseLegacyDate('')).toBeNull();
    expect(parseLegacyDate(null)).toBeNull();
    expect(parseLegacyDate(undefined)).toBeNull();
  });

  it('parses a real date', () => {
    const d = parseLegacyDate('2024-12-02');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2024);
  });
});

describe('combineDateTime', () => {
  it('combines date + time into one Date', () => {
    const d = combineDateTime('2024-12-02', '21:56:22');
    expect(d).not.toBeNull();
    expect(d!.getHours()).toBe(21);
    expect(d!.getMinutes()).toBe(56);
    expect(d!.getSeconds()).toBe(22);
  });

  it('falls back to midnight when time is missing', () => {
    const d = combineDateTime('2024-12-02', null);
    expect(d).not.toBeNull();
    expect(d!.getHours()).toBe(0);
  });

  it('returns null when the date itself is a zero-date', () => {
    expect(combineDateTime('0000-00-00', '10:00:00')).toBeNull();
  });
});

describe('isCleanNumeric', () => {
  it('accepts plain numbers, empty and dash', () => {
    expect(isCleanNumeric('1241')).toBe(true);
    expect(isCleanNumeric('0.0')).toBe(true);
    expect(isCleanNumeric('')).toBe(true);
    expect(isCleanNumeric('-')).toBe(true);
    expect(isCleanNumeric(null)).toBe(true);
  });

  it('rejects slash-joined junk like a phone number in a balance field', () => {
    expect(isCleanNumeric('62427265/2')).toBe(false);
  });
});

describe('classifyCashMove', () => {
  it('classifies debt payments from keyword + income', () => {
    expect(classifyCashMove('karz tolegi', true)).toBe('DEBT_PAYMENT_IN');
  });

  it('classifies deposits from keyword + income', () => {
    expect(classifyCashMove('pul goýum', true)).toBe('DEPOSIT');
  });

  it('defaults income to SALE_CASH', () => {
    expect(classifyCashMove(null, true)).toBe('SALE_CASH');
  });

  it('classifies supplier payments from keyword + expense', () => {
    expect(classifyCashMove('karz dükana tölendi', false)).toBe('PURCHASE_PAYMENT');
  });

  it('defaults expense to WITHDRAWAL', () => {
    expect(classifyCashMove('kassadan alnan', false)).toBe('WITHDRAWAL');
  });
});

describe('decStr', () => {
  it('formats a Decimal to a fixed-point string for SQL params', () => {
    expect(decStr(new Decimal('1.005'), 2)).toBe('1.01');
    expect(decStr(new Decimal(3), 3)).toBe('3.000');
  });
});

describe('truncate', () => {
  it('leaves short strings untouched', () => {
    expect(truncate('8001', 4)).toBe('8001');
  });

  it('clamps to maxLen', () => {
    expect(truncate('a'.repeat(300), 191)).toHaveLength(191);
  });

  it('passes null through', () => {
    expect(truncate(null, 10)).toBeNull();
  });
});
