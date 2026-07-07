import { z } from 'zod';

/** One POS cart line (SPEC §5.2). unitPrice is cashier-editable — the server
 * trusts it and only guards it via the below-cost check (bypassable by admin). */
export const saleLineInputSchema = z.object({
  productId: z.coerce.number().int().positive(),
  qty: z.coerce.number().positive(),
  unitPackId: z.coerce.number().int().positive().optional(),
  unitPrice: z.coerce.number().nonnegative(),
});
export type SaleLineInput = z.infer<typeof saleLineInputSchema>;

/**
 * Sale submission (SPEC §5.2/§6.3/§6.4). Debt is intentionally absent this
 * phase — Phase 4 owns DebtSale/DebtSchedule/balance updates (see
 * docs/PHASES.md Phase 4), so a debt component with no such bookkeeping would
 * be a half-finished, misleading record.
 */
export const createSaleSchema = z.object({
  // No .min(1) here on purpose: SalesValidationService owns the EMPTY_CART
  // check so the client always gets the same structured {code} shape rather
  // than zod's plain-text array error for this one case.
  lines: z.array(saleLineInputSchema),
  paidCash: z.coerce.number().nonnegative().default(0),
  paidCard: z.coerce.number().nonnegative().default(0),
  skipStockCheck: z.boolean().optional().default(false),
  allowBelowCost: z.boolean().optional().default(false),
  printCopies: z.coerce.number().int().positive().optional(),
});
export type CreateSaleInput = z.infer<typeof createSaleSchema>;

/** Structured error codes (SPEC §6.3) — the server never emits UI text; the
 * client maps these to i18n keys (CLAUDE.md golden rule #4). */
export const SaleErrorCode = {
  EMPTY_CART: 'EMPTY_CART',
  NO_PAYMENT: 'NO_PAYMENT',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  BELOW_COST: 'BELOW_COST',
} as const;
export type SaleErrorCode = (typeof SaleErrorCode)[keyof typeof SaleErrorCode];
