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
 * Sale submission (SPEC §5.2/§6.3/§6.4/§6.5). `dueDate`/`noDueDate` and
 * `sendSms` only matter when `paidDebt > 0` — see SalesValidationService for
 * the DEBTOR_REQUIRED rule and DebtSaleService for the installment math.
 */
export const createSaleSchema = z.object({
  // No .min(1) here on purpose: SalesValidationService owns the EMPTY_CART
  // check so the client always gets the same structured {code} shape rather
  // than zod's plain-text array error for this one case.
  lines: z.array(saleLineInputSchema),
  paidCash: z.coerce.number().nonnegative().default(0),
  paidCard: z.coerce.number().nonnegative().default(0),
  paidDebt: z.coerce.number().nonnegative().default(0),
  debtorId: z.coerce.number().int().positive().optional(),
  dueDate: z.coerce.date().optional(),
  noDueDate: z.boolean().optional().default(false), // "möhletsiz"
  sendSms: z.boolean().optional().default(false),
  skipStockCheck: z.boolean().optional().default(false),
  allowBelowCost: z.boolean().optional().default(false),
  printCopies: z.coerce.number().int().positive().optional(),
});
export type CreateSaleInput = z.infer<typeof createSaleSchema>;

/** Structured error codes (SPEC §6.3/§6.5) — the server never emits UI text;
 * the client maps these to i18n keys (CLAUDE.md golden rule #4). */
export const SaleErrorCode = {
  EMPTY_CART: 'EMPTY_CART',
  NO_PAYMENT: 'NO_PAYMENT',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  BELOW_COST: 'BELOW_COST',
  DEBTOR_REQUIRED: 'DEBTOR_REQUIRED',
} as const;
export type SaleErrorCode = (typeof SaleErrorCode)[keyof typeof SaleErrorCode];
