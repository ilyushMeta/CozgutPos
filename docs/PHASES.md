# PHASES.md — Delivery Plan (tick boxes as tasks complete)

Rules: one phase per session/branch. Start each phase in plan mode. A phase is DONE only when its acceptance boxes are ticked, tests pass, and the owner approved the summary. Details for every item: see the matching section in docs/SPEC.md.

## Phase 1 — Foundation
- [ ] pnpm monorepo scaffold (apps/server, apps/client, packages/shared, packages/printer, tools/migrate-legacy) + ESLint/Prettier + docker-compose MySQL 8
- [ ] Prisma schema implementing ALL models from SPEC §4.1 + initial migration
- [ ] Seed script: admin user, demo categories/products/batches, PaymentDiscounts, ExchangeRate, Settings defaults
- [ ] Auth: bcrypt, JWT + refresh, roles ADMIN/CASHIER, route guards (API + client), LoginAudit
- [ ] i18n skeleton: i18next, `tm.json` seeded with SPEC §9 vocabulary, `ru.json` stubs, zero hardcoded strings check (lint rule or grep script)
- [ ] Login screen (TM), license module skeleton (License singleton, remaining-days display, expiry block message)
- [ ] Settings module (key/value table + UI shell) and first-run wizard: Server vs Client(server IP)
- [ ] Acceptance: `pnpm dev` runs server+client; login works for both roles; schema migrated clean; all UI text from tm.json

## Phase 2 — Inventory & Purchasing
- [ ] Categories CRUD; Products CRUD (code unique, scale-item flag, low-stock threshold, expiry, discount %, second price)
- [ ] Internal code generator (SPEC §6.9) + shared code registry; QR/label PDF print with copies counter
- [ ] StockBatch model flows; UnitPacks CRUD (SPEC §6.7 data)
- [ ] Haryt goş (receiving) screen: multi-line cart → one invoice; TMT/USD purchase (rate snapshot); percent margin helper; options: pay-from-cashbox, supplier-credit (SPEC §6.8)
- [ ] Üýtgetmek: edit product + batch fields; guarded delete
- [ ] Stock views: Ammar (all batches, search, CSV), out-of-stock, low-stock (≤ threshold), expiring-soon (per category)
- [ ] PLU export job (SPEC §7.3): file template + optional command, triggered on scale-item change and on demand
- [ ] Acceptance: receive goods on supplier credit → supplier balance up + CashMove absent; receive with cashbox pay → CashMove expense written; CSV exports open in Excel

## Phase 3 — POS Core
- [ ] FIFO engine in server (SPEC §6.2) as a pure, unit-tested service; LIFO honored via Settings flag; batchBreakdown stored per line
- [ ] Concurrency: transaction + locking; test proving two parallel sales cannot oversell one batch (SPEC §11)
- [ ] Söwda screen: scanner-first search with suggestions, cart with inline qty/unit-price/line-total edit, `a/b` fraction input, unit-pack selector, composite expansion (engine hookup in Phase 5)
- [ ] Payments: cash+card+debt split, live change, negative change = discount w/ % (SPEC §6.10), per-method PaymentDiscount
- [ ] Sale transaction (SPEC §6.3–6.4): validations w/ admin bypass checkboxes, atomic save, CashMove for cash part
- [ ] Receipt printing ESC/POS with SPEC §7.1 field set; copies counter; A4 faktur PDF; price-check popup (HarytMaglumat)
- [ ] Unit tests: money rounding, change/discount, FIFO consumption, pack qty math
- [ ] Acceptance checklist items 1 (partial: cash/card), 3, 5 from SPEC §13 pass

## Phase 4 — Debts
- [ ] Debtors CRUD (auto code, +993 phone, TMT/USD account) with overdue color rules; Suppliers CRUD
- [ ] Debt sale completion (SPEC §6.5): balance in account currency, DebtSale, N-month DebtSchedule, optional SMS
- [ ] Karz tölemek: payment → balance + schedule oldest-first, CashMove in, receipt, optional SMS
- [ ] Dükan karz tölemek: pay supplier from cashbox; SupplierDebtMove ledger views
- [ ] Dashboard tiles: customer debt totals (TMT/$), supplier debt total; overdue notifications list
- [ ] SMS gateway client (SPEC §7.4) + Settings test button
- [ ] Acceptance: SPEC §13 item 1 fully passes incl. debt + schedule; unit tests for installment splitting

## Phase 5 — Cash, Returns, Ops
- [ ] Kassa: day open (opening balance), deposit, withdraw (reason + report record), day/period movement views, live balance tile
- [ ] Returns (SPEC §6.12): search sold lines, restock exact batch, financial reversal, audit row
- [ ] Rewiz: count vs system, money impact rows, zero-stock action with audit
- [ ] Tükelleme: counting session, live shortage/surplus tables, apply adjustments, print/export
- [ ] Second shop (SPEC §6.11): simplified sale, own receipt sequence, back-office period views
- [ ] Recipes/Önüm (SPEC §6.6): build recipe from cart, composite sale deducts ingredients, production log
- [ ] Needed-products list CRUD
- [ ] Acceptance: SPEC §13 items 2 and 4 pass

## Phase 6 — Reports & Admin
- [ ] DailySummary nightly job + on-demand rebuild
- [ ] Dashboard: today/period profit, 12-month profit chart, category breakdown
- [ ] Report tables + CSV: sold items (all filters), receipts w/ faktur reprint, cash moves, debt movements, login audit
- [ ] Users CRUD; Discounts screen; Currency screen w/ rate history; Backup/Restore (mysqldump → AES password ZIP, retention, schedule; restore incl. create-DB)
- [ ] License screen: activation codes add days, clock-rollback block, hardware fingerprint soft-check
- [ ] Acceptance: SPEC §13 items 7, 8 pass; charts match DailySummary numbers

## Phase 7 — Migration & Hardening
- [ ] tools/migrate-legacy CLI per SPEC §10 (normalize varchar numerics, map all tables, preserve legacy ids)
- [ ] Reconciliation report: legacy vs new Σ stock qty/value, Σ debtor balances, Σ supplier balances — equal to 0.01 (SPEC §13 item 6)
- [ ] RU locale pass (real translations where owner provided, stubs elsewhere)
- [ ] Tauri client build; server-as-service docs for Windows; LAN two-machine smoke test (SPEC §13 item 10)
- [ ] Full SPEC §13 checklist run — every box ticked
