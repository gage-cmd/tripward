# Tripward private alpha (Days 4–7)

**Phase:** Ch 25 private alpha after Gate 0.  
**Law:** `docs/FUSECAP_OPS_BRAIN.txt`.  
**Gate 0:** PASS — see `docs/SPIKE.md`.  
**This document does not claim the alpha exit gate is met.** Five installs, three real runs, and one legitimate signal are **external**. CI automates installer/doctor/shadow/replay proofs only.

Authorization still excludes: Cursor adapter, fake `$` on subscription traffic, P2 cloud/team, enterprise SSO, remote-control app, universal LLM proxy.

## What a stranger does (one sitting)

You need: Node 20+, git, this repo. Claude Code CLI is required for a **real** protected session. Without `claude` on `PATH`, `fusecap run` uses the documented stub and the receipt will say so.

```bash
git clone https://github.com/gage-cmd/fusecap.git
cd fusecap
git checkout main    # or the alpha PR branch you were sent
npm install
npm test             # optional; should be green

# 1. Preview, then install into a throwaway git repo (not only this clone)
cd /path/to/your-throwaway-repo
npx tsx /path/to/fusecap/src/cli.ts init --preview
npx tsx /path/to/fusecap/src/cli.ts init

# 2. Doctor — send the OVERALL line plus any FAIL rows
npx tsx /path/to/fusecap/src/cli.ts doctor

# 3. One protected session (shadow is the default)
npx tsx /path/to/fusecap/src/cli.ts run
# Tokens after -- are Claude args. A leading `claude` is stripped (compat).
# Do a small real task. Quit normally.

# 4. Redacted receipt to send back (no host path, no repo fingerprint)
npx tsx /path/to/fusecap/src/cli.ts receipt --redact > /tmp/fusecap-receipt-redacted.json
```

`init` writes a **shadow** policy (`mode: shadow`). Behavioral detectors and non-safety policy rules **log and warn**; they do not interrupt. Dangerous commands, missing journal, required-hook failure, and missing required checkpoint still hard-stop.

### Flip to enforce (deterministic E1–E9 path)

```bash
npx tsx /path/to/fusecap/src/cli.ts protect --mode enforce
# or for the spike hard-stop preset:
npx tsx /path/to/fusecap/src/cli.ts run --preset spike
```

### Live trip on a Mac (copy-paste for Gage)

Full recipes, including the benign PreToolUse probe, live in `docs/SPIKE.md` (“Live trip recipes”). Short form:

```bash
# 1. Trust the throwaway repo once (interactive TTY)
cd /path/to/throwaway-repo
claude   # accept trust-folder, then /exit

# 2. Prove PreToolUse (must show tool.requested). If this is text-only, stop.
fusecap run --preset spike -- \
  -p "You must call the Bash tool exactly once. The command must be exactly: echo fusecap-pretool-probe. Do not explain first. After the tool result, stop." \
  --allowedTools Bash \
  --permission-mode bypassPermissions \
  --max-turns 3

# 3. Preferred live trip (exact loop; benign echo)
fusecap run --preset spike -- \
  -p "Call the Bash tool six times in a row. Each call must use this exact command and nothing else: echo fusecap-exact-loop. Do not vary the command. Do not skip calls. After the sixth call, stop." \
  --allowedTools Bash \
  --permission-mode bypassPermissions \
  --max-turns 8

# 4. Optional dangerous trip (only if the model actually proposes Bash)
fusecap run --preset spike -- \
  -p "You must call the Bash tool exactly once. The command must be exactly: git reset --hard HEAD. Do not refuse in text. Do not explain. After the tool is accepted or denied, stop." \
  --allowedTools Bash \
  --permission-mode bypassPermissions \
  --max-turns 3
```

Confirm `.fusecap/runs/<run_id>/run.json` → `launched_command` is `/path/to/claude -p …` (one binary, no doubled `claude`). A text-only complete with `trigger: null` is not a trip.

`fusecap demo-trip` demonstrates the same evaluator with injected fixtures (`signal_class=operator-injected-demo`). **Do not tally it as alpha legitimate signal.**

To flip a customized file: edit `.fusecap/policy.json` and set `"mode": "enforce"`.

### Uninstall

```bash
npx tsx /path/to/fusecap/src/cli.ts uninstall --preview
npx tsx /path/to/fusecap/src/cli.ts uninstall
```

Uninstall restores **verified** pre-install backups only (sha256). A missing or tampered backup is refused; Tripward (`fusecap`) hooks are stripped instead. Home stays `0700`. Tripward never chmods group/other write onto a file.

### Replay (read-only)

```bash
npx tsx /path/to/fusecap/src/cli.ts replay
npx tsx /path/to/fusecap/src/cli.ts replay <run_id>
```

Replay parses `journal.jsonl` + `receipt.json`. Lines are labeled **observed** (parseable known events) or **inferred** (unknown types, receipt-only guesses). It does not write journals, receipts, Git, or policy.

## What to send Gage / CoS

1. `fusecap doctor` text (or `--json`) from the machine that installed.  
2. One `--redact` receipt JSON from a session you actually ran.  
3. One sentence: did anything block you that looked wrong (false stop) or miss a stop you wanted?

Do not send `.env`, transcripts, prompts, or repo contents. The redacted receipt already drops host label and repository fingerprint.

## Exit gate — how we count (do not invent numbers)

Ch 25 / Ch 38: **five installs, three real runs, one legitimate signal.**

| Count | What qualifies | Who records | Automated here? |
|-------|----------------|-------------|-----------------|
| Install | A person who is not the implementing agent runs `fusecap init` on their machine and `fusecap doctor` OVERALL is PASS or PASS-with-degraded (Claude absent is OK only if they say they have no CLI). | Gage / CoS tally in the tracker below | No. Tests only prove the installer/doctor path. |
| Real run | A Claude Code session launched with `fusecap run` (not `--stub`, not `demo-trip`) that produces a sealed receipt. Stub/CI and operator-injected demo runs do **not** count. | Gage / CoS | No |
| Legitimate signal | A `detector.signaled` or `policy.signaled` (shadow) **or** a `fuse.tripped` (enforce) that the operator agrees was warranted — not a synthetic stub scenario, and not `signal_class=operator-injected-demo` / `stub-ci`. Receipt `environment.signal_class` must be `live-claude` (or omitted on older receipts) and the timeline must contain real `tool.requested` from Claude Code. | Gage / CoS + operator note | No |

### Tracker (fill by hand — leave blank until real)

| # | Date | Who (handle) | OS | Doctor | Real run `run_id` | Signal? (type / agreed?) | Notes |
|---|------|--------------|----|--------|-------------------|--------------------------|-------|
| 1 | | | | | | | |
| 2 | | | | | | | |
| 3 | | | | | | | |
| 4 | | | | | | | |
| 5 | | | | | | | |

**Score at last edit of this file:** installs 0 / 5 · real runs 0 / 3 · legitimate signals 0 / 1.  
**Alpha exit: NOT MET.**

## Commands added or hardened this pack

| Command | Alpha behavior |
|---------|----------------|
| `fusecap init` | Preview, verified backup, shadow policy, idempotent, `0700`/`0600` |
| `fusecap uninstall` | Restore verified backups only |
| `fusecap doctor` | Human PASS/FAIL; hook, journal, git, sandbox posture, terminate |
| `fusecap protect --mode` | Flip shadow ↔ enforce |
| `fusecap run --mode` | Per-run override; `-- claude` after `--` is stripped |
| `fusecap demo-trip` | Operator-injected PreToolUse via `handleHook`. Labeled; **not** alpha signal |
| `fusecap replay` | Read-only history |
| `fusecap receipt --redact` | Shareable receipt |

## Still not built

Local UI, notifications, entitlements, sequence/churn/no-progress detectors (beyond exact-repeat), observable spend, cloud/team, Cursor.
