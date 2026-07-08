import { describe, it, expect } from 'vitest';
import { Decimal } from '@cozgut/shared';
import { withinTolerance, compareSum, formatReport } from './reconcile.js';
import { newReport } from './types.js';

describe('withinTolerance', () => {
  it('passes when the difference is within tolerance', () => {
    expect(
      withinTolerance(new Decimal('100.00'), new Decimal('100.005'), new Decimal('0.01')),
    ).toBe(true);
  });

  it('fails when the difference exceeds tolerance', () => {
    expect(withinTolerance(new Decimal('100.00'), new Decimal('100.02'), new Decimal('0.01'))).toBe(
      false,
    );
  });

  it('is symmetric regardless of which side is larger', () => {
    expect(withinTolerance(new Decimal('50'), new Decimal('49.99'), new Decimal('0.01'))).toBe(
      true,
    );
    expect(withinTolerance(new Decimal('49.99'), new Decimal('50'), new Decimal('0.01'))).toBe(
      true,
    );
  });
});

describe('compareSum', () => {
  it('marks pass=true when equal', () => {
    const line = compareSum('test', new Decimal(10), new Decimal(10), new Decimal('0.01'));
    expect(line.pass).toBe(true);
  });

  it('marks pass=false when off by more than tolerance', () => {
    const line = compareSum('test', new Decimal(10), new Decimal(11), new Decimal('0.01'));
    expect(line.pass).toBe(false);
  });
});

describe('formatReport', () => {
  it('reports overall PASS when every line passes', () => {
    const report = newReport();
    const text = formatReport(
      [compareSum('a', new Decimal(1), new Decimal(1), new Decimal('0.01'))],
      report,
    );
    expect(text).toContain('NETIJE: PASS');
  });

  it('reports overall FAIL when any line fails', () => {
    const report = newReport();
    const text = formatReport(
      [
        compareSum('a', new Decimal(1), new Decimal(1), new Decimal('0.01')),
        compareSum('b', new Decimal(1), new Decimal(5), new Decimal('0.01')),
      ],
      report,
    );
    expect(text).toContain('NETIJE: FAIL');
    expect(text).toContain('[FAIL] b');
  });

  it('includes warnings and skipped counts when present', () => {
    const report = newReport();
    report.warnings.push('something odd');
    report.skipped.debtSales = 3;
    const text = formatReport(
      [compareSum('a', new Decimal(1), new Decimal(1), new Decimal('0.01'))],
      report,
    );
    expect(text).toContain('something odd');
    expect(text).toContain('debtSales: 3');
  });
});
