import { describe, it, expect } from 'vitest';
import { wholeMonthsBetween, addMonths, splitInstallments } from './installment.js';

describe('wholeMonthsBetween', () => {
  it('counts whole calendar months', () => {
    expect(wholeMonthsBetween(new Date('2026-01-15'), new Date('2026-03-15'))).toBe(2);
  });

  it('does not count a partial trailing month', () => {
    expect(wholeMonthsBetween(new Date('2026-01-15'), new Date('2026-03-10'))).toBe(1);
  });

  it('rounds up to a full month once the day has passed', () => {
    expect(wholeMonthsBetween(new Date('2026-01-15'), new Date('2026-03-20'))).toBe(2);
  });

  it('returns 0 for a same-day date', () => {
    expect(wholeMonthsBetween(new Date('2026-01-15'), new Date('2026-01-15'))).toBe(0);
  });
});

describe('splitInstallments (SPEC §6.5)', () => {
  const saleDate = new Date('2026-01-10');

  it('forces N=1 with dueDate=saleDate when noDueDate ("möhletsiz")', () => {
    const rows = splitInstallments(100, saleDate, null, true);
    expect(rows).toHaveLength(1);
    expect(rows[0].dueDate).toEqual(saleDate);
    expect(rows[0].amount.toFixed(2)).toBe('100.00');
    expect(rows[0].openingBalance.toFixed(2)).toBe('100.00');
    expect(rows[0].closingBalance.toFixed(2)).toBe('0.00');
  });

  it('splits an evenly-divisible amount into equal monthly rows', () => {
    const dueDate = new Date('2026-04-10'); // 3 whole months out
    const rows = splitInstallments(300, saleDate, dueDate, false);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.amount.toFixed(2))).toEqual(['100.00', '100.00', '100.00']);
    expect(rows.map((r) => r.dueDate.getTime())).toEqual([
      addMonths(saleDate, 1).getTime(),
      addMonths(saleDate, 2).getTime(),
      addMonths(saleDate, 3).getTime(),
    ]);
    expect(rows[0].openingBalance.toFixed(2)).toBe('300.00');
    expect(rows[2].closingBalance.toFixed(2)).toBe('0.00');
  });

  it('puts the rounding remainder on the last row so the sum is always exact', () => {
    const dueDate = new Date('2026-04-10'); // 3 months
    const rows = splitInstallments(100, saleDate, dueDate, false);
    // 100 / 3 = 33.33 (half-up), so rows 1-2 get 33.33 and the last absorbs the rest.
    expect(rows[0].amount.toFixed(2)).toBe('33.33');
    expect(rows[1].amount.toFixed(2)).toBe('33.33');
    expect(rows[2].amount.toFixed(2)).toBe('33.34');
    const sum = rows.reduce((acc, r) => acc.plus(r.amount), rows[0].amount.minus(rows[0].amount));
    expect(sum.toFixed(2)).toBe('100.00');
    expect(rows[2].closingBalance.toFixed(2)).toBe('0.00');
  });

  it('has running opening/closing balances that chain correctly across rows', () => {
    const dueDate = new Date('2026-04-10');
    const rows = splitInstallments(300, saleDate, dueDate, false);
    expect(rows[0].openingBalance.toFixed(2)).toBe('300.00');
    expect(rows[0].closingBalance.toFixed(2)).toBe('200.00');
    expect(rows[1].openingBalance.toFixed(2)).toBe('200.00');
    expect(rows[1].closingBalance.toFixed(2)).toBe('100.00');
    expect(rows[2].openingBalance.toFixed(2)).toBe('100.00');
    expect(rows[2].closingBalance.toFixed(2)).toBe('0.00');
  });

  it('clamps to N=1 when the due date is less than a month out', () => {
    const dueDate = new Date('2026-01-25'); // same month, 15 days out
    const rows = splitInstallments(50, saleDate, dueDate, false);
    expect(rows).toHaveLength(1);
    expect(rows[0].dueDate).toEqual(addMonths(saleDate, 1));
    expect(rows[0].amount.toFixed(2)).toBe('50.00');
  });

  it('falls back to N=1 when no dueDate is given and noDueDate is not set', () => {
    const rows = splitInstallments(75, saleDate, null, false);
    expect(rows).toHaveLength(1);
    expect(rows[0].dueDate).toEqual(saleDate);
  });
});
