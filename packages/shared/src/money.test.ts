import { describe, it, expect } from 'vitest';
import {
  money,
  qty,
  moneyStr,
  sumMoney,
  sumQty,
  parseLegacyNumber,
  parseQtyInput,
  applyMargin,
} from './money.js';

describe('money rounding (SPEC §6.1, round half-up 2dp)', () => {
  it('rounds half up', () => {
    expect(money('1.005').toFixed(2)).toBe('1.01');
    expect(money('2.675').toFixed(2)).toBe('2.68');
    expect(money('1.004').toFixed(2)).toBe('1.00');
  });

  it('formats fixed-2 strings', () => {
    expect(moneyStr(3)).toBe('3.00');
    expect(moneyStr('10.1')).toBe('10.10');
  });

  it('sums at money precision', () => {
    expect(sumMoney(['0.1', '0.2']).toFixed(2)).toBe('0.30');
    expect(sumMoney([1.111, 2.222, 3.333]).toFixed(2)).toBe('6.67');
  });
});

describe('qty rounding (3dp)', () => {
  it('rounds to 3 places half up', () => {
    expect(qty('1.2345').toFixed(3)).toBe('1.235');
    expect(qty('1.2344').toFixed(3)).toBe('1.234');
  });

  it('sums at qty precision', () => {
    expect(sumQty(['1.1115', '2.222']).toFixed(3)).toBe('3.334'); // 3.3335 -> half-up 3dp
    expect(sumQty([10, 20, '5.5']).toFixed(3)).toBe('35.500');
  });
});

describe('parseLegacyNumber (SPEC §4.2)', () => {
  it('normalizes comma, spaces, empty', () => {
    expect(parseLegacyNumber('1,5').toFixed(2)).toBe('1.50');
    expect(parseLegacyNumber(' 2 000,25 ').toFixed(2)).toBe('2000.25');
    expect(parseLegacyNumber('').toFixed(2)).toBe('0.00');
    expect(parseLegacyNumber(null).toFixed(2)).toBe('0.00');
    expect(parseLegacyNumber('abc').toFixed(2)).toBe('0.00');
  });
});

describe('parseQtyInput (fractions, SPEC §5.2)', () => {
  it('parses fractions and decimals', () => {
    expect(parseQtyInput('1/2')?.toFixed(3)).toBe('0.500');
    expect(parseQtyInput('3/4')?.toFixed(3)).toBe('0.750');
    expect(parseQtyInput('2')?.toFixed(3)).toBe('2.000');
    expect(parseQtyInput('1,5')?.toFixed(3)).toBe('1.500');
  });

  it('returns null on invalid', () => {
    expect(parseQtyInput('')).toBeNull();
    expect(parseQtyInput('1/0')).toBeNull();
    expect(parseQtyInput('x')).toBeNull();
  });
});

describe('applyMargin (Haryt goş "B%" helper, SPEC §5.3)', () => {
  it('applies a percent margin on top of buy price', () => {
    expect(applyMargin(10, 20).toFixed(2)).toBe('12.00');
    expect(applyMargin('100', '15').toFixed(2)).toBe('115.00');
  });

  it('zero margin returns the buy price', () => {
    expect(applyMargin(50, 0).toFixed(2)).toBe('50.00');
  });
});
