# FuseCap (working name)

Local runtime safety layer for Claude Code: multi-fuse tripwires + forensic receipt + Git checkpoint/rollback.

**Law:** `docs/FUSECAP_OPS_BRAIN.txt` (Master Product + Engineering Brain v1.0, Sept 2026).  
**Supporting brief:** `docs/ONEPAGER.md`.  
**Spike report:** `docs/SPIKE.md`.

## Current authorization (0–72h)

Enforceability spike only (Ch 25 / E1–E9). Prove reliable Claude Code controls.

NOT authorized: Cursor, universal LLM proxy, enterprise SSO, remote-control app, autonomous security product, fake `$` on subscription traffic, P1 UI / shadow detectors / cloud.

## Spike exit gate

Five synthetic trips + two healthy sessions: time fuse; hook block; exact loop; dangerous command; Git checkpoint; terminate; raw receipt.

```bash
npm install
npm test                 # automates the five synthetic trips (no Claude CLI)
npx tsx src/cli.ts doctor
npx tsx src/cli.ts run --preset spike --stub --scenario healthy
```

Live Claude Code sessions (Gage, macOS) are documented in `docs/SPIKE.md`. Divergences from the brain are recorded under `docs/adr/`.
