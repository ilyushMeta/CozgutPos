/**
 * ESC/POS 80mm receipt content (SPEC §7.1). Pure text formatting — hardware-
 * independent and unit-testable without a printer. apps/server/src/printing
 * feeds the returned lines to node-thermal-printer and sends them.
 */

export interface ReceiptLine {
  name: string;
  qty: string;
  unitPrice: string;
  lineTotal: string;
}

export interface ReceiptData {
  shopHeader: string;
  receiptNo: number;
  date: string;
  time: string;
  lines: ReceiptLine[];
  total: string;
  cash: string;
  card: string;
  debt: string;
  change: string;
  discount: string;
  discountPercent?: string;
  buyerName?: string;
  debtorBalance?: string;
}

export interface ReceiptDocument {
  header: string;
  meta: string[];
  items: string[];
  totals: string[];
  footer: string;
}

function isPositive(amount: string): boolean {
  return Number(amount) > 0;
}

/** Builds the receipt content (SPEC §7.1 field set) as plain text sections. */
export function renderReceipt(data: ReceiptData): ReceiptDocument {
  const items = data.lines.flatMap((line) => [
    line.name,
    `  ${line.qty} x ${line.unitPrice} = ${line.lineTotal}`,
  ]);

  const totals = [`Jemi: ${data.total}`];
  if (isPositive(data.cash)) totals.push(`Nagt: ${data.cash}`);
  if (isPositive(data.card)) totals.push(`Kart: ${data.card}`);
  if (isPositive(data.debt)) totals.push(`Karz: ${data.debt}`);

  // SPEC §6.10: negative change is shown as a discount instead, never both.
  if (isPositive(data.discount)) {
    totals.push(`Skidka: ${data.discount}`);
    if (data.discountPercent) totals.push(`Skidka %: ${data.discountPercent}`);
  } else {
    totals.push(`Gaýtargy: ${data.change}`);
  }

  if (data.buyerName) totals.push(`Alyjy: ${data.buyerName}`);
  if (data.debtorBalance) totals.push(`Algy: ${data.debtorBalance}`);

  return {
    header: data.shopHeader,
    meta: [`№ ${data.receiptNo}`, `${data.date} ${data.time}`],
    items,
    totals,
    footer: 'Sag boluň!',
  };
}
