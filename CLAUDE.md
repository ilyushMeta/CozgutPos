# CLAUDE.md — Çözgüt POS Rewrite

## What this project is
Full rewrite of a production legacy retail POS + back-office app (Java Swing + MySQL, used daily in shops in Turkmenistan) into a modern LAN-first web stack. The complete specification lives in **@docs/SPEC.md** — it is the single source of truth. The phased task list with checkboxes lives in **@docs/PHASES.md**. The legacy database dump is at **legacy/dump.sql** (read-only reference; needed for the Phase 7 migration CLI).

## Golden rules (never violate)
1. **Business-logic parity.** SPEC Section 6 rules (FIFO costing, installment math, change-as-discount, debtor currency handling) are frozen semantics. If an implementation choice would alter them, STOP and ask — do not decide alone.
2. **Money/qty are DECIMAL** (money 16,2; qty 16,3) in DB and handled with a decimal library in TS (never float arithmetic on money). Round half-up to 2dp exactly where SPEC says.
3. **Parameterized queries only** (Prisma). Never interpolate user input into SQL. The legacy app's SQL injection is a defect we are fixing, not copying.
4. **No hardcoded UI strings.** Every user-facing string goes through i18next keys in `packages/shared` locales (`tm` default, `ru` stubs). Turkmen is the primary operator language.
5. **Offline-LAN first.** No feature may require internet. One PC = server, others are browser/Tauri clients on LAN.
6. **Stock deduction is transactional and concurrency-safe.** Any code path that consumes StockBatch must run inside a DB transaction with locking; an oversell race between two cashiers is a release-blocking bug.
7. **Minimal changes.** Do not refactor code unrelated to the current task. Separate commits per logical change.

## Tech stack (fixed — do not substitute)
- Monorepo: pnpm workspaces (`apps/server`, `apps/client`, `packages/shared`, `packages/printer`, `tools/migrate-legacy`)
- Server: NestJS + TypeScript + Prisma + MySQL 8, Socket.IO gateway for realtime, JWT auth (bcrypt), roles ADMIN | CASHIER
- Client: React 18 + TypeScript + Vite + Tailwind, TanStack Query/Table, react-hook-form + zod, i18next; Tauri packaging later (Phase 7)
- Printing: node-thermal-printer (ESC/POS 80mm) on server; pdfmake for A4 invoices
- Tests: Vitest (unit: money/FIFO/installments), supertest or Nest testing (integration: full mixed-payment sale)

## Commands
- `pnpm install` — install all workspaces
- `pnpm dev` — run server + client in dev (concurrently)
- `pnpm -F server prisma migrate dev` — apply schema migrations
- `pnpm -F server prisma studio` — inspect DB
- `pnpm test` — run all tests; `pnpm lint` — ESLint+Prettier check
- `docker compose up -d db` — local MySQL 8 for dev
- `pnpm migrate:legacy --dump legacy/dump.sql` — legacy data migration (Phase 7)
Run lint + typecheck after every code change. Run tests before declaring any phase task done.

## Workflow
- Work strictly phase-by-phase from @docs/PHASES.md. One phase (or one numbered sub-task of a phase) per session.
- Always start a phase in **plan mode**: read the relevant SPEC sections, present the plan, wait for approval before writing code.
- After finishing tasks: tick the `[ ]` boxes in docs/PHASES.md, run tests, commit with a clear message (`phase3: FIFO engine + tests`), summarize, STOP for review.
- When SPEC is ambiguous, list the options with trade-offs and ask the owner — do not silently pick.

## Domain glossary (Turkmen terms used across code, DB legacy, and UI)
haryt = product · ammar = warehouse/stock · kot/kod = product code (barcode) · söwda = sale · sowdaNomer = receipt number · faktur = invoice · nagt = cash · nagt däl / kart = card · karz = debt/credit · karzçy = debtor (customer) · karz dükan = supplier we owe · hasap = balance/account · gaýtargy = change (money returned) · skidka = discount · walýuta = currency (USD; base is TMT) · kurs = exchange rate · galyndy = remaining qty · alnan baha = buy price (COGS basis) · satlyk baha = sell price · möhlet = expiry/due date · tükelleme = stocktake · rewiz = revision/adjustment · önüm = composite product (recipe) · ölçeg / gap = unit pack · kassa = cash register · pul goýmak/almak = cash deposit/withdraw · ikinji dükan = second shop · gerekli harytlar = needed-products list · rugsat = license · ulanyjy = cashier user · terezi = weighing scale (PLU export)

## Environment notes
- Deployment target: Windows shop PCs (server as a service/tray app). Keep paths OS-agnostic; all machine-specific config in `.env` + DB `settings` table — never hardcoded file paths like the legacy `C:\xampp\...`.
- Dev DB credentials only in `.env` (gitignored). Never commit secrets; never use MySQL root in app code.
