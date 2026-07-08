import { Decimal } from '@cozgut/shared';

/** Cross-step state — nothing in the legacy schema has real foreign keys, and
 * only StockBatch.legacyAmmarId / Sale.legacySowdaId exist as real columns on
 * the new schema, so every other legacy-id → new-id mapping lives here in
 * memory for the duration of one migration run. */
export interface MigrationContext {
  categoryIdByName: Map<string, number>;
  userIdByUsername: Map<string, number>;
  legacyImportUserId: number;
  productIdByCode: Map<string, number>; // legacy kot -> new product id
  stockBatchIdByLegacyAmmarId: Map<string, number>;
  customerIdByCode: Map<string, number>; // legacy karzkot -> new customer id
  supplierIdByCode: Map<string, number>; // legacy karzdukankot -> new supplier id
  saleIdByReceiptNo: Map<string, number>; // legacy sowdaNomer/faktur -> new sale id
  currentExchangeRate: Decimal;
}

export interface MigrationReport {
  warnings: string[];
  tableCounts: Record<string, { legacyRows: number; created: number }>;
  cashMoveCounts: Record<string, number>;
  skipped: Record<string, number>;
}

export function newReport(): MigrationReport {
  return { warnings: [], tableCounts: {}, cashMoveCounts: {}, skipped: {} };
}

export function bumpSkipped(report: MigrationReport, key: string, by = 1): void {
  report.skipped[key] = (report.skipped[key] ?? 0) + by;
}

export function setTableCount(
  report: MigrationReport,
  table: string,
  legacyRows: number,
  created: number,
): void {
  report.tableCounts[table] = { legacyRows, created };
}
