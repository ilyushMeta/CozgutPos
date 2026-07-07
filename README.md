# CozgutPos

Cozgut pos ulgamy dort dilde ulanmak ucin.

Modern, LAN-first retail POS + back-office (NestJS + Prisma + MySQL 8 · React + Vite +
Tailwind). Full specification: [`docs/SPEC.md`](docs/SPEC.md). Delivery plan:
[`docs/PHASES.md`](docs/PHASES.md).

## Monorepo layout

| Workspace | Purpose |
|---|---|
| `apps/server` | NestJS REST API + WebSocket (auth, license, settings, catalog, receiving, stock views, labels, PLU, FIFO/LIFO engine, sales, printing, realtime) |
| `apps/client` | React 18 + Vite + Tailwind (login, back-office & POS shells, i18n, catalog/receiving/stock screens, Söwda POS screen) |
| `packages/shared` | zod DTOs, enums, money/decimal utils, `tm`/`ru` locales |
| `packages/printer` | ESC/POS receipt rendering (SPEC §7.1 field set) |
| `tools/migrate-legacy` | Legacy MySQL → new schema CLI (skeleton — Phase 7) |

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
