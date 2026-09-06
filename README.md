# Tripward (CLI: tripward / fusecap)

Local runtime safety layer for Claude Code: multi-fuse tripwires + forensic receipt + Git checkpoint/rollback.

**Canonical URL:** https://tripward.dev  
**Law:** `docs/FUSECAP_OPS_BRAIN.txt` (Master Product + Engineering Brain v1.0, Sept 2026).  
**Supporting brief:** `docs/ONEPAGER.md`.  
**Spike report (Gate 0 PASS):** `docs/SPIKE.md`.  
**Private alpha (Days 4–7, exited):** `docs/ALPHA.md`.  
**Paid beta (Days 8–14, open):** `docs/BETA.md`.

## Current authorization (Days 8–14)

Paid beta is **open**. PR1 (receipt HTML) is on main. This slice is PR2 (recovery preview HTML). Alpha exited with measured **1 / 5 installs · 1 / 3 runs · 1 / 1 signal**; remaining installs/runs waived by Gage.

This repository does **not** claim three paying strangers or paid-beta exit.

NOT authorized: Cursor, universal LLM proxy, enterprise SSO, remote-control app, autonomous security product, fake `$` on subscription traffic, Stripe checkout, support-channel pack, P2 cloud/team.

## Quick start

```bash
npm install
npm test
npx tsx src/cli.ts init --preview
npx tsx src/cli.ts init
npx tsx src/cli.ts doctor
npx tsx src/cli.ts run --preset spike --stub --scenario healthy
npx tsx src/cli.ts receipt --html
npx tsx src/cli.ts restore --preview --html
npx tsx src/cli.ts replay
npx tsx src/cli.ts uninstall --preview
```

After `npm run build`, the same CLI is on `tripward` and `fusecap`.

New policies default to **shadow**. Flip with `tripward protect --mode enforce` or `--preset spike`. Dangerous-command and other safety hard stops still fire in shadow.

`tripward run -- …` passes **Claude args**. A leading `claude` is stripped. Live trip copy-paste: `docs/SPIKE.md` / `docs/ALPHA.md`. `tripward demo-trip` is operator-injected (`signal_class=operator-injected-demo`) and does **not** count as live signal.

Paid-beta exit (three paying strangers + no lost work) is tracked in `docs/BETA.md` and is **not** claimed here. Divergences: `docs/adr/`.
