import { describe, it, expect } from 'vitest';
import { renderReceipt, type ReceiptData } from './index.js';

const BASE: ReceiptData = {
  shopHeader: 'Çözgüt Dükany',
  receiptNo: 42,
  date: '2026-07-07',
  time: '12:00',
  lines: [{ name: 'Çörek', qty: '2.000', unitPrice: '5.00', lineTotal: '10.00' }],
  total: '10.00',
  cash: '10.00',
  card: '0.00',
  debt: '0.00',
  change: '0.00',
  discount: '0.00',
};

describe('renderReceipt (SPEC §7.1 field set)', () => {
  it('includes shop header, receipt number, date/time, and item lines', () => {
    const doc = renderReceipt(BASE);
    expect(doc.header).toBe('Çözgüt Dükany');
    expect(doc.meta).toEqual(['№ 42', '2026-07-07 12:00']);
    expect(doc.items).toEqual(['Çörek', '  2.000 x 5.00 = 10.00']);
  });

  it('shows change when there is no discount', () => {
    const doc = renderReceipt({ ...BASE, cash: '15.00', change: '5.00' });
    expect(doc.totals).toContain('Gaýtargy: 5.00');
    expect(doc.totals.some((l) => l.startsWith('Skidka'))).toBe(false);
  });

  it('shows discount (with percent) instead of change when the sale had a shortfall (SPEC §6.10)', () => {
    const doc = renderReceipt({
      ...BASE,
      cash: '8.00',
      change: '0.00',
      discount: '2.00',
      discountPercent: '20.00',
    });
    expect(doc.totals).toContain('Skidka: 2.00');
    expect(doc.totals).toContain('Skidka %: 20.00');
    expect(doc.totals.some((l) => l.startsWith('Gaýtargy'))).toBe(false);
  });

  it('omits zero payment methods (card-only sale has no Nagt line)', () => {
    const doc = renderReceipt({ ...BASE, cash: '0.00', card: '10.00' });
    expect(doc.totals).toContain('Kart: 10.00');
    expect(doc.totals.some((l) => l.startsWith('Nagt'))).toBe(false);
  });

  it('includes buyer name and debtor balance only when provided', () => {
    const withoutDebtor = renderReceipt(BASE);
    expect(withoutDebtor.totals.some((l) => l.startsWith('Alyjy') || l.startsWith('Algy'))).toBe(
      false,
    );

    const withDebtor = renderReceipt({ ...BASE, buyerName: 'Aman', debtorBalance: '150.00' });
    expect(withDebtor.totals).toContain('Alyjy: Aman');
    expect(withDebtor.totals).toContain('Algy: 150.00');
  });

  it('lists every cart line', () => {
    const doc = renderReceipt({
      ...BASE,
      lines: [
        { name: 'Çörek', qty: '2.000', unitPrice: '5.00', lineTotal: '10.00' },
        { name: 'Suw 0.5L', qty: '1.000', unitPrice: '3.00', lineTotal: '3.00' },
      ],
    });
    expect(doc.items).toEqual([
      'Çörek',
      '  2.000 x 5.00 = 10.00',
      'Suw 0.5L',
      '  1.000 x 3.00 = 3.00',
    ]);
  });
});
