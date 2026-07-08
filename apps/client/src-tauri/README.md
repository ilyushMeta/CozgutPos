# Tauri desktop wrapper — scaffold only (Phase 7)

This is the skeleton for packaging the client as a Windows desktop app
(SPEC §3, §12 Phase 7). It has **not been built or run** in this repository's
dev/CI sandbox: there is no display server (X11/Wayland) and no Windows
cross-compilation toolchain available here, and Tauri needs both a native
Rust toolchain with platform-specific webview bindings and, for a Windows
`.msi`/`.exe`, either a native Windows build machine or a configured
cross-compile target.

## To actually build this (on a real Windows dev machine)

```powershell
# One-time setup
rustup default stable-msvc
cd apps/client
pnpm add -D @tauri-apps/cli
pnpm tauri icon path\to\a-1024x1024-logo.png   # generates src-tauri/icons/*

# Dev (opens a native window pointed at the Vite dev server)
pnpm tauri dev

# Production build (produces an .msi/.exe installer under src-tauri/target/release/bundle)
pnpm tauri build
```

## What's here

- `tauri.conf.json` — window size/title, dev server URL, bundle target
  (`msi`/`nsis` — Windows installers), minimal allowlist (no filesystem/
  shell access beyond opening external links).
- `Cargo.toml` / `src/main.rs` — the thinnest possible Tauri shell; it just
  loads the built `apps/client/dist` (production) or the Vite dev server
  (`pnpm tauri dev`). No custom Rust commands are defined — all app logic
  stays in the existing React client talking to the NestJS server over
  HTTP/WebSocket, same as the plain-browser deployment.

## Why a Tauri wrapper at all, given the client already runs in a browser?

Per SPEC §3, cashier PCs can just open `http://<server-ip>:PORT` in any
browser — Tauri is optional polish (a desktop icon, kiosk-style window,
no visible browser chrome/URL bar for cashiers) rather than a functional
requirement. Ship the plain browser deployment first (see
`docs/DEPLOYMENT.md`); build this wrapper later once a Windows machine with
a GUI is available to actually compile and test it.
