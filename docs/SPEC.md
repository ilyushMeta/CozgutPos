# SPEC.md — Çözgüt POS Full Rewrite
# Complete Specification (read this before planning any phase)

---

## 1. MISSION

You are rebuilding a **fully working, production legacy application** from scratch using a modern stack. The legacy app is a Windows desktop retail Point-of-Sale + back-office system written in **Java Swing (NetBeans GUI builder) + MySQL (XAMPP)**, used daily in real shops in Turkmenistan. It is feature-rich and battle-tested; your job is to **preserve 100% of its business behavior** while modernizing architecture, security, and UX.

**Non-negotiable principles:**
- Business logic parity first. Every rule described in Section 6 must behave identically unless explicitly marked "IMPROVE".
- The system must keep working **fully offline on a LAN** (one PC is the server, other PCs are cashier clients). Internet must never be required for core operation.
- All UI text in **Turkmen (Latin script)** via an i18n layer, with **Russian** as a second locale (keys prepared, translations can be stubs initially).
- Money and quantities are **DECIMAL**, never floats in the database, never strings.
- Every SQL access must be parameterized (the legacy code is full of SQL injection — that is a defect to fix, not behavior to copy).

---

## 2. LEGACY SYSTEM OVERVIEW (what exists today)

**Domain:** small-retail shop management: sales (POS), purchasing/goods receiving, batch inventory with FIFO costing, customer debts (installments, TMT/USD accounts), supplier debts, cash register, discounts, multi-unit packaging, composite products (recipes), stocktaking, revisions, returns, a second satellite shop, reports/charts, CSV export, receipt/invoice printing, barcode/QR, weighing-scale PLU export, SMS notifications via an Android phone gateway, password-protected DB backups, licensing, and two user roles.

**Legacy architecture facts you must know:**
- Single MySQL database named `dukan` (utf8mb4). Connection was hardcoded: `root` / `zgt0802feb` (must NOT be carried over).
- Server/client mode was chosen by a marker file: `C:\Windows\System32\System.dll` containing `1` (client → reads server IP from `C:\xampp\plu\ip_address.txt`) or `2` (server → localhost). Replace with a proper config file / first-run setup wizard, but keep the same LAN topology.
- Receipt printing used JasperReports template `C:\xampp\report1.jrxml` sent to the default Windows printer (80mm thermal). Invoice ("faktur") reprint by receipt number existed.
- Weighing scale integration: when enabled (`terezi.txt` = `bar`), the app exported a PLU file and ran `C:\xampp\plu\plu.bat` at login and after product changes.
- SMS: HTTP POST `{"to": "+993XXXXXXX", "message": "..."}` with `Authorization: <token>` to `http://<phone_ip>:8082/` — an Android SMS-gateway app on a phone in the same LAN. Config lived in `C:\xampp\phone\phone_ip.txt` and `token.txt`.
- Licensing: `rugsat` table stored remaining days (`rst`), last-seen date (`lastSene`, anti clock-rollback), activation codes in `codes`; license value "95" meant unlimited; motherboard serial (wmic) was read for binding. Login audit written to `hasabat`.
- Roles: `admin` (full back-office) and `ulanyjy` (cashier POS only). Successful admin login set a `modeAdmin` flag.
- Libraries used (tells you the feature set): JasperReports 6.3 + iText (receipts/invoices), ZXing core+javase (QR/barcodes), JFreeChart (charts), JCalendar, zip4j (AES password ZIP backups), webcam-capture (planned debtor photo — was commented out), mysql-connector.

**Legacy defects you must fix (not copy):** string-concatenated SQL, plaintext passwords, hardcoded DB root password, all numeric columns stored as VARCHAR, almost no primary keys / foreign keys / indexes, Windows hard-coded paths, no i18n, UI freezes on long queries.

---

## 3. TARGET ARCHITECTURE & STACK

Monorepo with pnpm workspaces:

```
cozgut-pos/
├─ apps/
│  ├─ server/        # NestJS (Node.js 20+, TypeScript) REST API + WebSocket
│  └─ client/        # React 18 + TypeScript + Vite (runs in browser AND packaged with Tauri for desktop)
├─ packages/
│  ├─ shared/        # zod schemas, DTOs, i18n dictionaries (tm.json, ru.json), money utils
│  └─ printer/       # ESC/POS receipt rendering (node side)
├─ legacy/
│  └─ dump.sql       # the old MySQL dump (provided by the owner)
└─ tools/
   └─ migrate-legacy/ # one-shot migration CLI from legacy dump → new schema
```

- **Backend:** NestJS + **Prisma ORM** + **MySQL 8** (keep MySQL — the owner operates XAMPP/MySQL in the field). All money/qty = `DECIMAL`. Transactions via `prisma.$transaction` with row locking where FIFO deduction happens (`SELECT ... FOR UPDATE` through raw query or serializable transaction).
- **Frontend:** React + TypeScript + Vite, TailwindCSS, TanStack Query + TanStack Table, react-hook-form + zod, i18next (locales `tm` default, `ru`). Two shells: **POS screen** (cashier, keyboard-first, barcode-scanner-first) and **Back-office** (admin dashboard with sidebar navigation).
- **Desktop packaging:** Tauri wrapper for the client; server runs as a Windows service (node) or via a simple tray launcher. Cashier clients open `http://<server-ip>:PORT` — same LAN model as legacy.
- **Realtime:** WebSocket (Socket.IO or Nest gateway) to push: stock changes, new sales, cash-register changes, debt notifications to all connected clients.
- **Auth:** username+password, bcrypt hashes, JWT (short-lived) + refresh; roles `ADMIN`, `CASHIER`. Route guards on both API and UI.
- **Printing:** `node-thermal-printer` (ESC/POS) on the server for 80mm receipts; A4/PDF invoices via `pdfmake` or Playwright print-to-PDF. Printer name/IP configurable in Settings. Number-of-copies setting like legacy (print counter with +/-).
- **Barcode/QR:** input via keyboard-wedge scanner (POS listens globally); generate internal EAN-like codes server-side (see 6.9); QR PNG generation with `qrcode` npm; barcode label PDF for label printers.
- **Config:** `.env` + a `settings` DB table editable from UI (replaces all `C:\xampp\...` files). First-run wizard: choose "Server" or "Client (enter server IP)".

---

## 4. DATABASE SCHEMA (NEW) + LEGACY MAPPING

Design the new schema with Prisma. Below is the required model set; you may add technical columns (createdAt/updatedAt) everywhere. **Every legacy table/column is listed so nothing is lost.**

### 4.1 New models

- **User**(id, username uniq, passwordHash, role enum[ADMIN,CASHIER], isActive) ← legacy `admin`(at,parol,modeAdmin) + `ulanyjy`(at,parol)
- **LoginAudit**(id, userId, at datetime) ← `hasabat`(at,sene,sagat)
- **Category**(id, name uniq) ← `kategoriya`(kategor)
- **Product**(id, name, code uniq /*barcode or internal*/, categoryId FK, isScaleItem bool, lowStockThreshold DECIMAL, expiryDate date? , discountPercent DECIMAL default 0, secondPrice DECIMAL? /*ikinjiSatlyk*/, isComposite bool default false) ← distinct product identity derived from `ammar` rows grouped by `kot` (legacy had NO product table — batches only; you create one; per-product fields skidka/mohlet/azalanSan/ikinjiSatlyk move here)
- **StockBatch**(id, productId FK, qtyInitial DECIMAL, qtyRemaining DECIMAL, buyPrice DECIMAL /*TMT*/, sellPrice DECIMAL /*TMT*/, sellPriceUSD DECIMAL?, currency enum[TMT,USD], buyRate DECIMAL? /*kurs at purchase*/, receivedAt datetime, invoiceNo int? /*faktur*/, supplierDebtCode string?, legacyAmmarId string?) ← `ammar`(at,hemmeSan,galanSan,alynanBaha,satlykBaha,kot,mohlet,kategoriya,skidka,sagat,sene,walyuta,satlykbahaUSD,karzKot,faktur,ammarId,azalanSan,ikinjiSatlyk)
- **UnitPack**(id, productId FK, name /*Olceg e.g. "Gap"*/, qtyInside DECIMAL, buyPrice DECIMAL, sellPrice DECIMAL) ← `kopolceg`(kot,Olceg,Icinde,AlnanBaha,satlykBaha,sene)
- **Recipe**(id, compositeProductId FK) + **RecipeItem**(id, recipeId FK, ingredientProductId FK, qty DECIMAL) ← `f2`(onumAt,onumKod,harytAt,harytKod,harytMukdar,...) ; `umumystirhkot`(kotOz,kotUmumy) maps composite code aliases — fold into Product.code; production/ingredient log ← `harytmukdar`
- **Sale**(id /*sowdaId*/, receiptNo int /*sowdaNomer, per-day or global counter as legacy: global*/, datetime, cashierId FK, total DECIMAL, paidCash DECIMAL, paidCard DECIMAL, paidDebt DECIMAL, changeGiven DECIMAL, discount DECIMAL, debtorId FK?, exchangeRate DECIMAL, cogsTotal DECIMAL, shopId enum[MAIN,SECOND]) ← `fakturtoleg` + grouping of `satylanharytlar`
- **SaleLine**(id, saleId FK, productId FK, batchBreakdown JSON /*[{batchId,qty,buyPrice}]*/, qty DECIMAL, unitPackId FK?, unitPrice DECIMAL, lineTotal DECIMAL, cogs DECIMAL, categoryNameSnapshot, productNameSnapshot) ← `satylanharytlar`(at,san,baha,kot,kategoriya,tolegGornus,sagat,sene,sowdaNomer,sowdaId,ammarId,kurs,alnanBaha,OlcegAt,birlikBaha)
- **SecondShopSale/Line** — same shape, `shopId=SECOND` ← `satylanharytlarikinjidukan`
- **Return**(id, saleLineId FK, qty DECIMAL, datetime, restockedBatchId FK, moneyAdjustment DECIMAL) ← legacy "Yzyna goýmak" flow (it updated the same tables; you model it explicitly)
- **Customer/Debtor**(id, code uniq /*karzkot*/, name, note, phone, accountCurrency enum[TMT,USD] /*shot: 'wlyt'→USD else TMT*/, balance DECIMAL) ← `karzcylar`(at,bellik,karzkot,hasap,sene,sagat,shot,tel) ; code pool ← `karzkotlar`
- **DebtSale**(id, debtorId FK, saleId FK, invoiceNo, saleDate, dueDate, amount DECIMAL, paid DECIMAL) ← `karzsatylanharytlar`
- **DebtSchedule**(id, debtorId FK, invoiceNo, txDate, dueDate, openingBalance DECIMAL, amount DECIMAL, paid DECIMAL default 0, closingBalance DECIMAL) ← `karzabarotka` (monthly installment rows — see rule 6.5)
- **DebtPayment**(id, debtorId FK, amount DECIMAL, currency, datetime, note, receiptPrinted bool) — legacy wrote into karzabarotka/tolenen + karzcylar.hasap; model explicitly
- **Supplier**(id, code uniq, name, note, phone?, balance DECIMAL) ← `karzdukana` ; codes ← `karzdukankotlar`
- **SupplierDebtMove**(id, supplierId FK, invoiceNo, txDate, type enum[PURCHASE,PAYMENT], amount DECIMAL, opening DECIMAL, closing DECIMAL, note) ← `karzdukanabarotka` + newer `karzdukanhereketler`(kot,amal_tipi,summa,basdaky/sonky_galyndy,bellik)
- **CashRegisterDay**(id, date uniq, openingBalance DECIMAL, income DECIMAL, expense DECIMAL, closingBalance DECIMAL) ← `abarotkakassa`
- **CashMove**(id, datetime, type enum[SALE_CASH,DEPOSIT,WITHDRAWAL,PURCHASE_PAYMENT,DEBT_PAYMENT_IN], amount DECIMAL, balanceBefore DECIMAL, note /*receiptNo or person*/) ← `kassahereket`(sene,sagat,basdakyPul,girdeji,cykdajy,bellik)
- **PaymentDiscount**(id, method enum[CASH,CARD,DEBT], percent DECIMAL) ← `tolegskidka` rows Nagt/Nagt_dal/Karz
- **ExchangeRate**(id, rate DECIMAL, effectiveFrom datetime) ← legacy stored current rate in `tolegskidka` where tolegGornus='Walyuta' (!) — migrate that value as the initial rate; keep history going forward
- **NeededProduct**(id, name, code?, qty, categoryId?) ← `gerekharytlar`
- **StockRevision**(id, ...) + **RevisionLine**(productId, systemQty, countedQty /*dukan*/, diff, unitPrice, amount, sellPriceRef, result, note) ← `rewiz`(at,kot,ammar,dukan,tapawut,baha,jem,satlyk,sene,sagat,netije,bellik,id)
- **Stocktake**(id, startedAt, finishedAt, status) + **StocktakeLine**(productId, countedQty, systemQty, diff) ← Tukelleme flow (legacy kept it in-memory + wrote adjustments)
- **DailySummary**(date uniq, cogs, revenue, profit) ← `dailysale` (keep as a materialized nightly rollup for fast charts)
- **License**(id singleton, remainingDays int, lastSeenDate date, hardwareId string?, plan enum[TRIAL,STANDARD,UNLIMITED]) + **ActivationCode**(code uniq, usedAt?) ← `rugsat`, `codes`
- **Setting**(key uniq, value) — printer name, copies, scale enabled, PLU export path, SMS gateway ip/token, server mode, shop name for receipt header, FIFO/LIFO flag (see 6.2)

### 4.2 Migration mapping notes
- Legacy `sowdatable` was a temp UI cart — do not migrate.
- Legacy numbers are VARCHAR with possible `,`/spaces — migration must trim, replace `,`→`.`, empty→0, and validate.
- Product identity: group `ammar` by `kot`; take latest row's name/category/skidka/mohlet/azalanSan/ikinjiSatlyk for Product; every ammar row becomes a StockBatch.
- `satylanharytlar` rows sharing (`sowdaId`) form one Sale; join `fakturtoleg` by (sene, faktur=sowdaNomer) for payment split.

---

## 5. FUNCTIONAL MODULES (build all of these)

### 5.1 Login & Roles
Login screen (Turkmen), shows remaining-license days (hidden if unlimited). Admin → back-office; Cashier → POS only. Write LoginAudit. If scale enabled → trigger PLU export job after login (see 7.3).

### 5.2 POS Sale Screen ("Söwda")
- Global search box: scan barcode OR type name/code with instant suggestions (highlighted match). Enter adds to cart.
- Cart table columns: №, Ady (name), Mukdar (qty), Birlik baha (unit price), Jemi (line total), Kod. Inline edit of qty / unit price / line total (editing total recalcs qty·price consistently as legacy did). Qty accepts fractions and `a/b` input (e.g. `1/2` → 0.5).
- Multi-unit: if product has UnitPacks, a selector (e.g. "Gap ×20") sets unit price/qty from the pack (rule 6.7).
- Composite product: scanning a composite code expands/deducts per recipe (rule 6.6).
- Payment panel: three fields — **Nagt (cash), Kart (card/Nagt_dal), Karz (debt)** — any combination in one receipt. Live "Gaýtargy" (change). Negative change = discount, printed as "Skidka X%".
- Debt payment requires selecting a debtor (search by code/name); due-date picker OR "möhletsiz" checkbox; optional "SMS ugrat" checkbox.
- Per-payment-method automatic discount % (PaymentDiscount) applied like legacy.
- Buttons: Satmak (finish sale, prints N copies per print-counter), Faktur print (A4 invoice), clear, price-check (HarytMaglumat popup: product info, stock, prices, cash balance).
- Bypass checkboxes (ADMIN-visible): "skip stock check", "allow below cost" — mirror legacy validation rules 6.3.
- Second display of last receipt totals; keyboard-first UX (hotkeys F-keys as sensible defaults).

### 5.3 Goods Receiving ("Haryt goş")
- Create/extend products; auto internal code generator + QR/label print with counter (+/−) for label copies.
- Batch fields: qty, buy price, sell price(s), currency TMT/USD (USD uses current ExchangeRate for TMT equivalents), expiry, category, low-stock threshold, second price, scale-item flag.
- Multi-line receiving cart → one invoice number; on save: create StockBatches; options: **pay from cashbox** (CashMove expense) and/or **on supplier credit** (select Supplier → SupplierDebtMove PURCHASE, balance update — rule 6.8).
- Percent helper ("B%") to compute sell price from buy price + margin, as legacy.
- After save: if any scale-item touched → re-export PLU.

### 5.4 Product Edit ("Üýtgetmek") & Stock views
Edit product + individual batch fields; delete batch/product (guarded); views: **Ammar** (all batches, search, CSV export), **Galyndy/AmmarGutaran** (out-of-stock list), **Azalan harytlar** (qtyRemaining ≤ threshold), **Möhleti azalanlar** (expiring within X days, per category filter).

### 5.5 Customer Debts ("Karz klient")
Debtor CRUD with auto code, phone (+993…), account currency TMT/USD; list with color coding by overdue days (legacy: overdue rows highlighted red / notification tab); debtor card: schedule (DebtSchedule), sales (DebtSale), movements; **Karz tölemek** screen: take payment (cash into register as CashMove DEBT_PAYMENT_IN), update balance & schedule (oldest first), print receipt, optional SMS (rule 6.5). Export CSV.

### 5.6 Supplier Debts ("Karz dükan")
Supplier CRUD; movements ledger; **Dükan karz tölemek**: pay supplier from cashbox (CashMove expense + SupplierDebtMove PAYMENT); dashboard tiles: "Dükanyň bergisi" (we owe), "Dükanyň algysy TMT/$" (owed to us).

### 5.7 Cash Register ("Kassa")
Day open (PulGoýmak: opening balance → CashRegisterDay), deposit, withdraw (PulAlmak: reason, writes CashMove + a zero-sale expense record like legacy for reporting), live balance tile, movements table per day/period, "Kassa abarotka" day summaries.

### 5.8 Returns ("Yzyna goýmak")
Search sold lines by receipt no / sale id / code / date; select line, enter return qty ≤ sold qty; restock into the **same batch** (by stored batchBreakdown); create Return row; adjust Sale/financials & DailySummary; reprint corrected info. (Legacy funYzynaGoy behavior.)

### 5.9 Revision ("Rewiz") & Stocktake ("Tükelleme")
- Rewiz: pick products (scan/search), see system qty vs counted, save RevisionLines with money impact; supports "Ammary boşatmak" (zero a code's stock) with audit.
- Tükelleme: session-based counting by scanning; live three tables — All / **Ýetmeýän** (shortage) / **Artyk** (surplus); on finish, apply adjustments (creates revision entries) and print/export result.

### 5.10 Second Shop ("Ikinji dükan")
Simplified sale/transfer screen writing SECOND-shop sales; deducts main stock FIFO; own receipt numbering; back-office tabs "Ikinji dükana giden harytlar" with period totals.

### 5.11 Discounts & Currency
Settings screen for PaymentDiscount % per method; per-product discount % (applies at POS); Currency screen ("Walýuta"): view/set ExchangeRate (plays a cash-register-style beep on save like legacy — optional nicety), rate history.

### 5.12 Recipes / Composite Products ("Önüm")
Build recipe from cart ("Forma-2 döret" flow): name the composite, generate its code, save RecipeItems; selling composite deducts ingredients (rule 6.6); production log equivalent of `harytmukdar`.

### 5.13 Reports & Dashboard ("Hasabatlar")
- Tiles: today profit, period profit (income − COGS), cash balance, debts (customer/supplier), low stock count.
- Charts: 12-month profit bar chart (from Sale/DailySummary), category breakdown; date-range pickers everywhere.
- Tables with search + CSV export: sold items (by name/code/date/receipt/category/payment type), receipts (faktur) with reprint, cash moves, debt movements, login audit, needed-products list (CRUD).
- "Düşewintlilik" (profitability) view per period as legacy.

### 5.14 Settings, Backup, Users, SMS
- Users CRUD (admin adds admins/cashiers; passwords hashed).
- Settings: server/client info, printer + copies, scale on/off + PLU path, SMS gateway IP/token/test button, shop header for receipt, language TM/RU.
- Backup: one click → `mysqldump` → AES-encrypted password ZIP (like zip4j behavior) into configurable folder, auto-delete older than N; Restore from such ZIP (create DB if missing). Schedule daily backup.
- License screen: remaining days, enter activation code (extends days), unlimited plan; anti-rollback via lastSeenDate (rule 8).

---

## 6. CRITICAL BUSINESS RULES (must match legacy exactly)

**6.1 Money & rounding.** All amounts DECIMAL(16,2) (qty DECIMAL(16,3)); round half-up to 2 decimals at each step where legacy used `Math.round(x*100)/100`.

**6.2 FIFO batch costing.** On any stock deduction (sale, second-shop sale, composite ingredient use): consume batches ordered by `receivedAt ASC` (oldest first) until qty satisfied; per-line COGS = Σ(consumedQty × batch.buyPrice); store the batch breakdown on the line. A Settings flag `fifo|lifo` existed (legacy wrote `setting.txt`); implement FIFO as default and honor LIFO ordering if flag set.

**6.3 Sale validation (pre-transaction).** Unless bypass #1: for each line, Σ qtyRemaining(product) ≥ requested qty, else abort listing "X sany ýetmeýär" per product. Unless bypass #2: unit sell price ≥ latest batch buyPrice, else abort listing how much below cost. Empty cart / no payment amount → friendly error ("Töleg görnüş saýla").

**6.4 Sale transaction (atomic).** One DB transaction: FIFO deduct + insert SaleLines + Sale + CashMove (if cash: amount = cash paid − change) + debt records (6.5) + payment record; on any failure rollback everything and show error ("hasaplamalar yzyna gaýtaryldy"). After commit: print receipt × printCounter.

**6.5 Debt sale & installments.** Debt part requires existing debtor. Amount added to debtor balance **in the debtor's account currency**: USD-account (`shot='wlyt'`) → amount/exchangeRate rounded 2dp; TMT-account → TMT amount. Create DebtSale. **Installment schedule:** monthsN = max(1, whole months between saleDate and dueDate); split debt amount into N equal monthly rows (DebtSchedule) with running opening/closing balances, dueDate = saleDate + n months. If "möhletsiz": N=1, dueDate=saleDate. Optional SMS: `"Salam {name}\nSowda={total}\nNagt={cash}\nKart={card}\nKarz={debt}\nUmumy hasap={newBalance}{TMT|$}"` (match legacy fields; exact wording configurable). Debt payments reduce balance and fill schedule oldest-first; SMS confirmation optional.

**6.6 Composite (Önüm) sale.** Scanning a composite product's code loads its RecipeItems into the deduction plan: stock is deducted from **ingredients** (each FIFO), COGS = Σ ingredient COGS; receipt shows the composite name/price. Creating a recipe from the POS cart ("Forma-2") registers composite code in the shared code registry.

**6.7 Unit packs.** Selecting pack "Olceg" sets unitPrice = pack.sellPrice and stock deduction qty = qty × pack.qtyInside; line stores OlcegAt (pack name) + birlikBaha for receipt display, exactly like legacy columns.

**6.8 Purchasing money flows.** Receiving with "pay from cashbox": CashMove expense = invoice buy total (records balanceBefore). Receiving "on credit": Supplier balance += invoice total; SupplierDebtMove PURCHASE with opening/closing. USD purchase: store currency=USD + buyRate; TMT equivalents computed with current rate for reports.

**6.9 Internal codes.** Generator produces unique numeric codes (legacy `funTazeKod`): use next value from a sequence with a check against Product.code and the shared `codes` registry; composite/debtor/supplier code pools are separate sequences (karzkotlar / karzdukankotlar equivalents). Never reuse.

**6.10 Change & discount on receipt.** change = cashGiven − dueAfterCardAndDebt; if change < 0 treat |change| as discount: receipt prints "Skidka: {amount}" and "Skidka {percent}%" (percent = discount/total×100, 2dp).

**6.11 Second shop.** Same FIFO deduction from main stock; separate receiptNo sequence; simplified payment (as legacy: records into second-shop sales with tolegGornus).

**6.12 Returns.** Restock to the exact original batch id(s); financial reversal proportional to line (revenue −, COGS −); keep audit row; DailySummary recalculated for that date.

**6.13 Daily summary.** Nightly (and on demand) rollup per date: revenue = Σ Sale.total, cogs = Σ Sale.cogsTotal, profit = revenue − cogs → DailySummary (feeds charts fast, mirrors `dailysale`).

---

## 7. HARDWARE INTEGRATIONS

**7.1 Receipt printer (80mm ESC/POS).** Server-side print service; template fields (match legacy Jasper params): shop header, receipt no (`tazeID`), date, time, line items (name, qty, unit price, total), Jemi, Nagt, Kart (Nagt_däl), Karz, Gaýtargy or Skidka(+%), buyer name (if debtor), debtor's new balance ("Algy"), footer. Copies = printCounter. Invoice (A4 PDF) variant by receipt no, reprintable from back-office ("Faktur print"), including supplier-invoice reprint for receiving.

**7.2 Barcode scanner.** Keyboard-wedge: POS captures rapid input ending with Enter globally (even when focus elsewhere), routes to search/add. Also generate & print product labels (name, price, barcode/QR) via label template.

**7.3 Weighing scale (PLU).** Setting toggle; on demand + after product create/edit of scale-items + after login: export PLU file (CSV/TXT, columns: PLU no, name (translit-safe), price, code) to configured path and optionally execute a configured script/command (replaces `plu.bat`). Make format template configurable (different scale brands).

**7.4 SMS gateway.** HTTP POST JSON `{to, message}` with `Authorization: <token>` to `http://<ip>:8082/` (configurable). Fire-and-forget with toast on failure ("Sms habary ugradylmady"); test button in Settings. Used by: debt sale (6.5), debt payment, optional overdue-debt reminder action from debtor list.

**7.5 (Optional, feature-flag) Debtor photo.** Webcam capture on debtor create (legacy had it stubbed): use browser getUserMedia in client, store image on server.

---

## 8. SECURITY & LICENSING

- Bcrypt passwords; JWT; role guards; rate-limit login; parameterized queries only; server binds to LAN, CORS locked to LAN origins.
- DB user: dedicated `cozgut_app` with least privilege; credentials in server `.env` (generate at setup) — never `root`, never hardcoded.
- Licensing module (keep the commercial model): License singleton with remainingDays, decremented by real-date diff on each app start; `lastSeenDate` monotonic — if system date < lastSeenDate, block with message ("Wagt yza çekilen"); activation codes add days; UNLIMITED plan skips checks; show remaining days on login screen; expiry → block login with the legacy message ("Siziň programmany ulanma rugsadyňyz gutardy"). Hardware fingerprint (motherboard serial / machine-id) stored and checked (soft-check with admin override tool).
- Backups AES-256 password ZIP as in 5.14.

---

## 9. I18N & UI/UX

- i18next with `tm` (default) and `ru`; **no hardcoded strings**. Seed `tm.json` using the legacy vocabulary so operators feel at home: Söwda, Haryt goş, Ammar, Kassa, Karz klient, Karz dükan, Karz tölemek, Tükelleme, Rewiz, Walýuta, Skidka, Sazlamalar, Hasabatlar, Gaýtargy, Jemi, Mukdar, Baha, Kod, Kategoriýa, Möhlet, Galyndy, Ýetmeýän, Artyk, Ikinji dükan, Pul goýmak, Pul almak, Gerekli harytlar, Yzyna goýmak, Faktur, Nagt, Nagt däl, Karz, Ulanyjy, Admin goş, Kategoriýa goş, Karzçy goş, Hasabat, Çykmak…
- Back-office: left sidebar + top header, dark/light theme toggle (legacy PosUI had both — keep), large touch-friendly POS buttons, table row highlighting rules (overdue debts red; low stock amber) like legacy highlighters.
- Fully keyboard-operable POS; every table searchable; CSV export buttons where legacy had "Export to Excel".

---

## 10. DATA MIGRATION (tools/migrate-legacy)

CLI: `pnpm migrate:legacy --dump legacy/dump.sql --db <target>`:
1. Load dump into a temp `legacy_dukan` schema.
2. Transform per Section 4 mapping (trim/normalize numerics; `,`→`.`; empty→0; dates pass-through; `shot='wlyt'`→USD).
3. Insert with FK integrity; create Products from grouped `ammar`; preserve legacy identifiers in `legacy*` columns (ammarId, sowdaId, sowdaNomer, karzkot…).
4. Rebuild DailySummary from migrated sales; migrate current exchange rate from `tolegskidka('Walyuta')`; migrate PaymentDiscounts, license days, users (force password reset on first login), categories, debts (balances + schedules + movements), suppliers, needed products, kopolceg, recipes (f2), revisions.
5. Print a reconciliation report: row counts per table, Σ stock value, Σ debtor balances, Σ supplier balances legacy vs new — must match to the tyýyn (0.01).

---

## 11. NON-FUNCTIONAL REQUIREMENTS

- POS add-to-cart < 50 ms perceived; finish-sale roundtrip < 500 ms on LAN; product search debounced server query with index on Product.code/name.
- Concurrency-safe FIFO: two cashiers cannot oversell one batch (transaction + locking test required).
- Works offline-LAN indefinitely; graceful reconnect of clients (WebSocket).
- Seed script with demo data; docker-compose for dev MySQL; ESLint/Prettier; unit tests for money math, FIFO, installment splitting, change/discount calc; integration test: full sale with mixed payment.
- Windows-friendly production run docs (install as service / Tauri build), since deployment targets shop PCs currently on XAMPP.

---

## 12. DELIVERY PLAN — execute in phases, stop after each for review

**Phase 1 — Foundation:** monorepo scaffold, Prisma schema (Section 4) + migrations, auth (roles, bcrypt, JWT), Settings, i18n skeleton with tm.json seeded, login screen, license module skeleton. ✅ Deliver: runnable server+client, login works, schema migrated.
**Phase 2 — Inventory & Purchasing:** Products, Categories, StockBatches, UnitPacks, Haryt goş (with cashbox/supplier-credit options), Üýtgetmek, stock views (Ammar/gutaran/azalan/möhleti), code generator, label/QR print, PLU export.
**Phase 3 — POS Core:** Söwda screen, cart mechanics, FIFO engine + tests, payments split, change/discount, receipt printing (ESC/POS), price-check popup, sale transaction, second display of totals.
**Phase 4 — Debts:** Debtors + Suppliers modules, debt sale (installments, SMS), Karz tölemek, Dükan karz tölemek, overdue highlighting & notifications.
**Phase 5 — Cash, Returns, Ops:** Kassa (open/deposit/withdraw/day view), Returns, Rewiz, Tükelleme, Second shop, Recipes/Önüm, Needed products.
**Phase 6 — Reports & Admin:** dashboard tiles, 12-month chart, all report tables + CSV, faktur reprint, Users CRUD, Backup/Restore, SMS settings+test, Discounts & Currency screens, DailySummary job.
**Phase 7 — Migration & Hardening:** legacy migration CLI + reconciliation report against `legacy/dump.sql`, concurrency tests, RU locale stubs, Tauri build, deployment docs.

For each phase (Claude Code workflow): (1) enter plan mode and present an implementation plan referencing the relevant SPEC sections, (2) after approval implement with small logical commits, (3) run lint + tests and fix failures, (4) tick the completed boxes in docs/PHASES.md, (5) write a short summary of what was built and any deviation from this spec, then STOP and wait for the owner's approval before the next phase.

---

## 13. ACCEPTANCE CHECKLIST (Definition of Done)

- [ ] A mixed sale (cash+card+debt) on a product with 2 batches deducts FIFO correctly, stores per-batch COGS, prints receipt with change, updates cash register, debtor balance (correct currency), and creates a correct N-month schedule.
- [ ] Selling a composite deducts ingredients; selling a pack deducts qty×inside.
- [ ] Oversell blocked with per-product shortage message; below-cost blocked; both bypassable by admin checkboxes.
- [ ] Return restores the exact original batch and reverses money; DailySummary matches.
- [ ] Two simultaneous cashiers cannot oversell (test proves it).
- [ ] Migration reconciliation: legacy Σ stock qty/value, Σ debtor & supplier balances equal new system to 0.01.
- [ ] License countdown + clock-rollback block + activation code path work.
- [ ] Backup ZIP is password-protected and restorable on a clean MySQL.
- [ ] Entire UI renders from tm.json (switching to ru shows keys/RU stubs, zero hardcoded strings).
- [ ] Works with server on PC-A and client browser on PC-B over LAN; realtime stock updates visible.

## 14. DO NOT CHANGE (semantic freeze)

FIFO consumption order and per-line COGS method; installment month-splitting math; change-as-discount receipt behavior; debtor currency handling via account type; receipt field set; the meaning of every report (profit = income − COGS from sales); LAN server/client topology; Turkmen as the primary operator language.

— END OF SPEC —
