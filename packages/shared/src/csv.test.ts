import { describe, it, expect } from 'vitest';
import { toCsv } from './csv.js';

interface Row {
  name: string;
  qty: number;
  note: string;
}

const rows: Row[] = [
  { name: 'Çörek', qty: 3, note: 'ok' },
  { name: 'Suw, 0.5L', qty: 10, note: 'has "gap"\nsecond line' },
];

const columns = [
  { header: 'Ady', value: (r: Row) => r.name },
  { header: 'Mukdar', value: (r: Row) => r.qty },
  { header: 'Bellik', value: (r: Row) => r.note },
];

describe('toCsv (SPEC §5.4/§5.13 CSV export)', () => {
  it('starts with a UTF-8 BOM', () => {
    const csv = toCsv(rows, columns);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('quotes fields containing commas, quotes, or newlines', () => {
    const csv = toCsv(rows, columns);
    expect(csv).toContain('"Suw, 0.5L"');
    expect(csv).toContain('"has ""gap""\nsecond line"');
  });

  it('uses CRLF row separators and includes the header', () => {
    const csv = toCsv(rows, columns);
    const withoutBom = csv.slice(1);
    const firstLine = withoutBom.split('\r\n')[0];
    expect(firstLine).toBe('Ady,Mukdar,Bellik');
  });

  it('renders null/undefined as empty cells', () => {
    const csv = toCsv([{ name: 'X', qty: 1, note: undefined as unknown as string }], columns);
    expect(csv).toContain('X,1,');
  });
});
