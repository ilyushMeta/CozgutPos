/**
 * ESC/POS 80mm receipt rendering — skeleton (implemented in Phase 3, SPEC §7.1).
 * Kept as a workspace so the server can depend on it from Phase 1 onward.
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
  discountPercent?: string;
  buyerName?: string;
  debtorBalance?: string;
}

/** Placeholder — Phase 3 wires node-thermal-printer. */
export function renderReceipt(_data: ReceiptData): string {
  throw new Error('renderReceipt not implemented until Phase 3');
}
