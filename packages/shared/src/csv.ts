/**
 * CSV export helper (SPEC §5.4 Ammar export, §5.13 report exports).
 * Produces Excel-friendly UTF-8 CSV: BOM prefix + CRLF rows + RFC4180 quoting.
 */

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function escapeCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV string (with UTF-8 BOM) from rows and column definitions. */
const BOM = '﻿';

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(','));
  return BOM + [header, ...lines].join('\r\n') + '\r\n';
}
