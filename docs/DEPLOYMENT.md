# DEPLOYMENT.md — Windows shop-PC deployment (SPEC §3, §11)

This covers running Çözgüt POS on the real deployment target: a Windows PC in
the shop acting as the LAN server, with other PCs opening the app in a
browser (cashier clients). No internet is required at any point.

## 1. Prerequisites (server PC)

- Windows 10/11.
- [Node.js 20 LTS](https://nodejs.org) (`node -v` → v20.x).
- [MySQL 8 Community Server](https://dev.mysql.com/downloads/mysql/) (or
  MariaDB 10.11+, which this project also targets in development).
- A thermal receipt printer (80mm, ESC/POS) installed as the Windows default
  printer, or configured by name in Settings → Printer.
- `pnpm` (`npm install -g pnpm`).

## 2. First-time setup

```powershell
git clone <repo>            # or copy the release folder to the shop PC
cd cozgut-pos
pnpm install
copy .env.example apps\server\.env
```

Edit `apps\server\.env`:

```
DATABASE_URL="mysql://cozgut_app:<strong-password>@localhost:3306/cozgut"
SHADOW_DATABASE_URL="mysql://cozgut_app:<strong-password>@localhost:3306/cozgut_shadow"
JWT_ACCESS_SECRET="<random 32+ char string>"
JWT_REFRESH_SECRET="<a different random 32+ char string>"
SERVER_PORT=3000
CORS_ORIGINS="http://<server-lan-ip>:5173"
```

Create the dedicated least-privilege MySQL user (SPEC §8 — never use `root`
in the app):

```sql
CREATE DATABASE cozgut CHARACTER SET utf8mb4;
CREATE DATABASE cozgut_shadow CHARACTER SET utf8mb4;
CREATE USER 'cozgut_app'@'localhost' IDENTIFIED BY '<strong-password>';
GRANT ALL PRIVILEGES ON cozgut.* TO 'cozgut_app'@'localhost';
GRANT ALL PRIVILEGES ON cozgut_shadow.* TO 'cozgut_app'@'localhost';
```

Apply the schema and seed (or run `tools/migrate-legacy` instead of seeding,
if migrating an existing shop — see §10 of SPEC.md and the tool's own
`--help`):

```powershell
pnpm -F @cozgut/server exec prisma migrate deploy
pnpm -F @cozgut/server db:seed        # demo data — skip on a real migration
pnpm -F @cozgut/client build
```

## 3. Running the server as a Windows service

Two supported options — pick one:

### Option A — NSSM (simplest, recommended)

1. Download [NSSM](https://nssm.cc/) and extract `nssm.exe` somewhere on PATH.
2. Build the server once: `pnpm -F @cozgut/server build`.
3. Install the service:
   ```powershell
   nssm install CozgutPosServer "C:\Program Files\nodejs\node.exe" "apps\server\dist\main.js"
   nssm set CozgutPosServer AppDirectory "C:\path\to\cozgut-pos"
   nssm set CozgutPosServer AppEnvironmentExtra NODE_ENV=production
   nssm start CozgutPosServer
   ```
4. The service now restarts automatically on boot and on crash.

### Option B — `node-windows`

```powershell
pnpm add -D node-windows -F @cozgut/server
```

Then a small install script (see `node-windows` docs) wraps `dist/main.js`
as a service. Prefer NSSM unless you need `node-windows`'s programmatic API.

## 4. Serving the client

The built client (`apps/client/dist`) is static files. Two options:

- Simplest for a single-PC shop: serve `apps/client/dist` with any static
  file server (e.g. `npx serve apps/client/dist -l 5173`, or IIS) running
  alongside the Node server. Build the client with `VITE_API_URL` pointing
  at the server's LAN IP and port (e.g. `http://192.168.1.10:3000`).
- To serve both from one process/port, add Nest's `ServeStaticModule`
  pointing at `apps/client/dist` in `apps/server/src/app.module.ts` — not
  wired by default in this codebase, since dev mode runs client (`:5173`,
  Vite) and server (`:3000`) separately via `pnpm dev`.

## 5. Firewall / LAN

- Allow inbound TCP on the server's port (default `3000`) in Windows
  Defender Firewall for the **Private** network profile only.
- Assign the server PC a static local IP (or a DHCP reservation on the
  shop's router) so client PCs' bookmarked URL never breaks.
- No port needs to be opened to the internet — this is a LAN-only app
  (CLAUDE.md golden rule #5).

## 6. Backups

Configure Settings → Backup (folder, retention, password) and enable the
daily schedule. Backups are `mysqldump` → gzip → AES-256-GCM, restorable
from the same Backup screen (see SPEC §5.14). Store a copy of backup files
off the shop PC periodically (USB drive) in case of hardware failure.

## 7. First run

On first boot, the client shows the first-run wizard: choose "Server" on
the PC that runs MySQL + the Node server, and "Client" (entering the
server's LAN IP) on every other cashier PC. See SPEC §3.
