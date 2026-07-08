# CozgutPos

Cozgut pos ulgamy dort dilde ulanmak ucin.

Modern, LAN-first retail POS + back-office (NestJS + Prisma + MySQL 8 · React + Vite +
Tailwind). Full specification: [`docs/SPEC.md`](docs/SPEC.md). Delivery plan:
[`docs/PHASES.md`](docs/PHASES.md).

## Monorepo layout

| Workspace | Purpose |
|---|---|
| `apps/server` | NestJS REST API + WebSocket (auth, license + activation + hardware fingerprint, settings, catalog, receiving, stock views, labels, PLU, FIFO/LIFO engine, sales, printing, debtors/suppliers, SMS gateway, cash register, returns, revision/stocktake, second shop, recipes/composites, needed products, DailySummary + dashboard/report endpoints, users, discounts, currency, backup/restore, realtime) |
| `apps/client` | React 18 + Vite + Tailwind (login, back-office & POS shells, i18n, catalog/receiving/stock screens, Söwda POS screen, debtor/supplier debt screens, cash register, returns, revision/stocktake, second shop, recipes, needed products, dashboard with charts, report tables, users, discounts, currency, backup, license) |
| `packages/shared` | zod DTOs, enums, money/decimal utils, `tm`/`ru` locales |
| `packages/printer` | ESC/POS receipt rendering (SPEC §7.1 field set) |
| `tools/migrate-legacy` | Legacy MySQL → new schema CLI + reconciliation report (SPEC §10, Phase 7) |

## Quickstart (dev)

```bash
pnpm install

# 1) MySQL 8 (Docker). Or point .env at any MySQL/MariaDB 8.
docker compose up -d db

# 2) Configure env
cp .env.example .env          # root (used by client/tools)
cp .env.example apps/server/.env   # server reads its own .env

# 3) Schema + demo data
pnpm -F @cozgut/server prisma migrate dev
pnpm -F @cozgut/server db:seed

# 4) Run server (:3000) + client (:5173)
pnpm dev
```

Seeded logins: **admin / admin123** (back-office), **kassir / kassir123** (POS).
Both passwords are dev-only — change them in production.

## Migrating from the legacy system

```bash
pnpm migrate:legacy --dump legacy/dump.sql --reset --legacy-db-url "mysql://<admin>:<pass>@localhost:3306/"
```

Loads the legacy `dump.sql` into a scratch schema, transforms every table
into the new schema, and prints a reconciliation report (legacy vs. new Σ
stock qty/value, Σ debtor/supplier balances — SPEC §13 item 6). `--reset`
truncates app tables first; the tool refuses to run against a non-empty DB
without it. `--legacy-db-url` needs CREATE/DROP DATABASE privilege (the
app's own least-privilege `cozgut_app` user does not have this — see
`docs/DEPLOYMENT.md`).

## Deployment

- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Windows shop-PC deployment
  (MySQL, `.env`, running the server as a Windows service).
- [`docs/LAN_SMOKE_TEST.md`](docs/LAN_SMOKE_TEST.md) — two-machine LAN
  checklist to run on real hardware before go-live.
- `apps/client/src-tauri/` — optional desktop-wrapper scaffold (not built in
  this repo's dev sandbox; see its own README for how to build it on a real
  Windows/GUI machine).

## Useful commands

```bash
pnpm test            # unit tests (money, license, …)
pnpm lint            # ESLint + Prettier
pnpm check:strings   # fail on hardcoded UI strings (i18n guard)
pnpm build           # build every workspace
pnpm -F @cozgut/server prisma studio   # inspect DB
```

## Security notes (SPEC §8)

- App connects as a dedicated least-privilege MySQL user (`cozgut_app`), never `root`.
- Passwords are bcrypt-hashed; auth is JWT (access + refresh); login is rate-limited.
- All secrets live in `.env` (gitignored) — never committed.
