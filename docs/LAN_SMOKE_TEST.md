# LAN_SMOKE_TEST.md — Two-machine smoke test (SPEC §13 item 10)

This is a manual checklist for verifying the LAN server/client topology on
real hardware. It cannot be executed inside a single sandboxed CI/dev
container (no second physical or virtual machine, no real LAN) — run it once
on the actual shop PCs before go-live, and again after any networking or
`.env` change.

## Setup

1. **PC-A (server)**: follow `docs/DEPLOYMENT.md` — MySQL, `.env`, `prisma
migrate deploy`, server running (as a service or `pnpm -F @cozgut/server
start:prod`). Note its LAN IP, e.g. `192.168.1.10`.
2. **PC-B (client)**: only needs a modern browser. No Node/MySQL install.

## Checklist

- [ ] From PC-B, `http://192.168.1.10:3000/api/health` returns `200 OK`.
- [ ] From PC-B's browser, open the client URL (either PC-A serving static
      files on `:3000`, or a separate static server — see DEPLOYMENT.md §4).
      The first-run wizard or login screen renders (SPEC §3, §5.1).
- [ ] Log in on PC-B as a CASHIER. Confirm the POS shell loads (not the
      back-office shell).
- [ ] Log in on PC-A (or a third PC) as ADMIN at the same time. Confirm both
      sessions work concurrently without interfering.
- [ ] On PC-B, ring up a sale (cash). On PC-A's back-office dashboard,
      confirm the new sale appears **without a manual refresh** (WebSocket
      realtime push, SPEC §3 "Realtime").
- [ ] Stock: from PC-A, receive new stock for a product. On PC-B's POS
      screen, confirm the updated quantity is reflected (realtime or on next
      product search) without restarting the client.
- [ ] Unplug PC-B's network cable, wait 10s, reconnect. Confirm the client
      reconnects (WebSocket) and the UI recovers without a manual page
      reload (SPEC §11 "graceful reconnect").
- [ ] Turn off PC-A's WiFi/internet uplink entirely (leave the LAN switch
      running). Confirm the whole flow above still works — the app must
      require **zero internet access** for core operation (CLAUDE.md golden
      rule #5).
- [ ] Print a receipt from PC-B to a thermal printer attached to PC-A (or a
      network printer on the LAN). Confirm it prints (SPEC §7.1).
- [ ] Restart PC-A's server process (or reboot PC-A). Confirm PC-B's client,
      after the server comes back up, can log in and operate again without
      reinstalling anything on PC-B.

## Sign-off

Record the date, both PCs' Windows versions, and MySQL version tested, next
to this checklist (e.g. in a dated copy or a follow-up commit) before
considering a shop location go-live ready.
