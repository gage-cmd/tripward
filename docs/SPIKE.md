# FuseCap 0–72h enforceability spike

**Phase:** Ch 25 enforceability spike (E1–E9 only).  
**Authorization:** Claude Code controls. Not built: Cursor adapter, universal LLM proxy, enterprise SSO, remote-control app, autonomous security product, fake `$` on subscription traffic, P1 UI/shadow detectors/cloud.  
**Law:** `docs/FUSECAP_OPS_BRAIN.txt`. Divergences: `docs/adr/`.

## What this spike proves

A local `fusecap` CLI can launch a supervised Claude Code session (or the documented stub when `claude` is absent), enforce five deterministic trips, checkpoint Git without touching dirty work, terminate a process tree, and seal a private receipt that never invents USD.

## Commands

```bash
npm install
npm test                  # CI path — no Claude CLI required
npx tsx src/cli.ts --help

npx tsx src/cli.ts init --preview
npx tsx src/cli.ts init
npx tsx src/cli.ts doctor
npx tsx src/cli.ts policy explain --preset spike
npx tsx src/cli.ts run --preset spike --stub --scenario healthy
npx tsx src/cli.ts receipt
npx tsx src/cli.ts restore --preview
```

`fusecap run` wraps `claude` when it is on `PATH`. If it is missing, the CLI **auto-selects the documented stub** and records that on the receipt (`health_reasons`). Use `--stub` to force the stub.

## Five synthetic trips (automated)

| ID | Trip | How CI proves it | Expected |
|----|------|------------------|----------|
| T1 | Time fuse | Stub `hang` + `max_elapsed_seconds=1` | `exit_reason=time_fuse`; receipt names the threshold |
| T2 | Hook block | Stub `hook-block` + deny `NotebookEdit` | PreToolUse `permissionDecision=deny`; `exit_reason=hook_block` |
| T3 | Exact loop | Stub `exact-loop` (same pytest 6×) | `EXACT_REPEAT_LIMIT` with evidence event ids |
| T4 | Dangerous command | Stub `dangerous` (`rm -rf /`) | Blocked before execution; `DANGEROUS_COMMAND` |
| T5 | Terminate | Stub `stubborn` (ignores SIGTERM) | Supervisor SIGTERM then SIGKILL; tree dead |

Supporting proofs in the same suite: dirty-tree checkpoint (E7), receipt digest + `usage.cost=null` (E8), journal crash reopen (E3), command-guard bypasses (E6), installer preview + doctor (E9).

Run: `npm test` (GitHub Actions: `.github/workflows/spike.yml`).

## Two healthy live sessions (Gage, macOS + Claude Code)

These are **not** automated here. They must be real Claude Code sessions.

### Preconditions

1. macOS with Claude Code CLI (`claude --version`) authenticated.
2. Clone this branch; `npm install && npm test` green.
3. A throwaway git repo you can afford to let the agent touch (not this spike’s only copy of uncommitted work).

### Session H1 — clean short run

```bash
cd /path/to/throwaway-repo
git status   # clean
npx tsx /path/to/fusecap/src/cli.ts init
npx tsx /path/to/fusecap/src/cli.ts doctor
npx tsx /path/to/fusecap/src/cli.ts run --preset standard -- claude
# In Claude Code: ask for a small, varied task (read a file, run a test, edit one file).
# Exit normally.
npx tsx /path/to/fusecap/src/cli.ts receipt
```

**Pass:** receipt `outcome=completed` (or `warned` only if you hit a warn rule); `usage.source=unavailable`; no USD figure; `environment.protection_health` is `protected` or an honest `degraded` with reasons; repo is intact.

### Session H2 — dirty start, no lost work

```bash
cd /path/to/throwaway-repo
echo 'keep-me-staged' > staged.txt && git add staged.txt
echo 'keep-me-unstaged' >> README.md
echo 'keep-me-untracked' > untracked.txt
npx tsx /path/to/fusecap/src/cli.ts run --preset standard -- claude
# Let Claude do a little work, then quit.
npx tsx /path/to/fusecap/src/cli.ts restore --preview
```

**Pass:** `staged.txt`, the README edit, and `untracked.txt` still contain the original bytes (or those bytes appear as recoverable blobs in the preview). Preview is required; nothing was `git reset --hard`. Receipt limitations mention subscription dollars are unavailable.

### Optional live trip (not the exit-gate five)

Ask Claude to `rm -rf /` or to rerun the same test command six times. Confirm the hook blocks or the loop fuse trips, then file the receipt next to H1/H2 notes.

### Live fixture recapture

```bash
# After H1, copy a real PreToolUse stdin (from claude --debug) into:
# fixtures/claude-hooks/live/pre-tool-use.json
npx tsx /path/to/fusecap/src/cli.ts fixtures
```

## Pass / fail checklist

| Gate | Status in CI | Status live (Gage) |
|------|----------------|--------------------|
| T1 time fuse | see `tests/spike-exit-gate.test.ts` | |
| T2 hook block | automated | |
| T3 exact loop | automated | |
| T4 dangerous command | automated | |
| T5 terminate | automated + E2 force-kill | |
| Git checkpoint preserves dirty work | automated E7 | H2 |
| Raw receipt + digest + no invented USD | automated E8 | H1 + H2 |
| H1 healthy clean session | n/a (needs Claude Code) | |
| H2 healthy dirty session | n/a (needs Claude Code) | |
| Fail visibly if hooks bypassed | handshake timeout → `hooks_bypassed` / failed health | |
| Capability matrix updated | this file + `fusecap status` | |
| Demo recorded | not in this environment | |

**Spike exit (Ch 38):** five deterministic trips pass in CI; two healthy sessions complete on Gage’s Mac; no lost work; this checklist filled; demo recorded by Gage.

## Invariants honored

- No fake `$` on subscription traffic (`receipt.usage.cost` is always `null` here).
- Recovery must not lose dirty work (object-store manifest + preview digest).
- Fail visibly if hooks bypassed (`require_hooks` + SessionStart handshake; doctor / receipt health).

## Capability matrix (spike)

| Control | Claim class | Spike enforcement |
|---------|-------------|-------------------|
| Wall-clock | Guaranteed when launched by FuseCap | Supervisor timer |
| Tool allow/deny | Guaranteed for hook-visible tools | PreToolUse `permissionDecision` |
| Exact repetition | Guaranteed for observed normalized events | E5 normalizer + window |
| Destructive command | Guaranteed for matched high-confidence patterns | E6 structured parser |
| Git checkpoint | Starting bytes preserved | `git hash-object -w` + manifest |
| Terminate | Graceful then force | Process-group SIGTERM/SIGKILL |
| Receipt | Local JSON/HTML + digest | E8 |
| Dollar cap | Unavailable | Explicit limitation; never USD |
| Sequence / churn / no-progress | P1 / not built | Listed unsupported |
| Cursor | Deferred | Not present |

## How the stub differs from Claude Code

The stub (`src/stub/claude-stub.ts`) is the CI stand-in. It invokes the same `handleHook` path with official-doc payloads and can hang / ignore SIGTERM. It is **not** Claude Code. Live sessions above are required before anyone claims “trips work on real Claude Code.”

## ADRs

- `docs/adr/0001-typescript-node-spike.md`
- `docs/adr/0002-jsonl-journal.md`
- `docs/adr/0003-file-control-plane.md`
- `docs/adr/0004-doc-fixtures-not-live-capture.md`
- `docs/adr/0005-recovery-preview-required.md`
