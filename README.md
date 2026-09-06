# Tripward (CLI: fusecap)

Local runtime safety layer for Claude Code: multi-fuse tripwires + forensic receipt + Git checkpoint/rollback.

**Law:** `docs/FUSECAP_OPS_BRAIN.txt` (Master Product + Engineering Brain v1.0, Sept 2026).  
**Supporting brief:** `docs/ONEPAGER.md`.  
**Spike report (Gate 0 PASS):** `docs/SPIKE.md`.  
**Private alpha (Days 4–7):** `docs/ALPHA.md`.

## Current authorization (Days 4–7)

Private alpha on top of the merged Gate 0 spike (`72d0033`). Build: reversible installer, doctor, shadow-first defaults, read-only replay, stranger-install docs.

NOT authorized: Cursor, universal LLM proxy, enterprise SSO, remote-control app, autonomous security product, fake `$` on subscription traffic, P1 UI / cloud / team.

## Quick start

```bash
npm install
npm test                 # spike trips + alpha installer/doctor/shadow/replay
npx tsx src/cli.ts init --preview
npx tsx src/cli.ts init
npx tsx src/cli.ts doctor
npx tsx src/cli.ts run --preset spike --stub --scenario healthy
npx tsx src/cli.ts replay
npx tsx src/cli.ts uninstall --preview
```

New policies default to **shadow**: detectors/policy signal (`detector.signaled` / warn) without interrupting. Flip with `fusecap protect --mode enforce` or `--preset spike`. Dangerous-command and other safety hard stops still fire in shadow.

`fusecap run -- …` passes **Claude args**. A leading `claude` is stripped so `fusecap run -- claude -p "…"` does not double the binary. Live trip copy-paste for Mac: `docs/SPIKE.md` / `docs/ALPHA.md`. `fusecap demo-trip` is an operator-injected harness (`signal_class=operator-injected-demo`) and does **not** count as alpha legitimate signal.

Alpha exit (five installs / three real Claude Code runs / one legitimate signal) is tracked in `docs/ALPHA.md` and is **not** claimed by this repository. Divergences: `docs/adr/`.
