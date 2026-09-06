# Tripward support (paid beta)

**Phase:** Days 8–14 paid beta, PR4.  
**Law:** `docs/FUSECAP_OPS_BRAIN.txt` Ch 31 (support + service objectives).  
**Product:** https://tripward.dev · repo https://github.com/gage-cmd/tripward  
**This file does not invent paying-customer counts, staffed SLAs, or a support mailbox Gage has not set.**

How to get help while Tripward is a one-operator paid beta. Channels, what to paste, what never to paste, severity, and the three operator paths the ops brain requires: **lost-work emergency**, **compatibility**, **security**.

GitHub issue forms live in `.github/ISSUE_TEMPLATE/`. The same fields are below so you can file or email without the GitHub UI.

## Channels

| Channel | Use for | How |
|---------|---------|-----|
| This file | First stop. Severity + what to include. | You are here. |
| Lost-work issue form | Preexisting work may be at risk. | [Lost-work emergency](https://github.com/gage-cmd/tripward/issues/new?template=lost-work.yml) — or paste the markdown template below. |
| Compatibility issue form | Claude Code version break, doctor FAIL, unsupported hooks. | [Compatibility](https://github.com/gage-cmd/tripward/issues/new?template=compatibility.yml) — or paste the markdown template below. |
| General help form | How-to, false stop, Founding Pro checkout stub. | [Help](https://github.com/gage-cmd/tripward/issues/new?template=help.yml) |
| Security | Vulnerability in Tripward itself. **Not a public issue.** | `SECURITY.md` |
| Email | Same as the matching template, if a mailbox exists. | `SUPPORT_EMAIL` — **unset.** Gage: replace this cell when a mailbox exists. |

There is no support team, no 24/7 desk, and no invented `support@` / `security@` address in this repository. Until `SUPPORT_EMAIL` is set, non-security reports go to GitHub issues. Security stays private — see `SECURITY.md`.

Commands below use `tripward`.

## What to include

Send only what is needed to reproduce a local tool:

1. **`tripward doctor` text** (or `--json`). The `OVERALL` line plus every `FAIL` row. Doctor is the preflight.
2. **`run_id`** if a session existed (`.tripward/runs/<run_id>/`, or `tripward status`).
3. **`tripward receipt --redact` JSON** if a receipt sealed. That drop is host path + repository fingerprint.
4. Tripward version (doctor header), Claude Code version (`claude --version`), OS.
5. One sentence: what you expected vs what happened.

### Never send

- Prompts, completions, transcripts, or repo source.
- `.env`, API keys, Claude / Stripe / cloud credentials, or anything that looks like a secret.
- Private local `receipt.html` / `recovery.html` (they can carry paths).
- Stripe secret keys (`sk_live_`, `sk_test_`, `whsec_`).
- A guessed Payment Link. Founding Pro checkout and post-pay fulfillment are `docs/FOUNDING_PRO.md`. After you pay, use https://tripward.dev/thanks.html or `docs/SETUP.md`.

If you already pasted a secret, rotate it. Do not assume the issue tracker is private.

## Severity triage

| Severity | Meaning | Channel |
|----------|---------|---------|
| **Critical — lost work** | Preexisting staged, unstaged, or untracked bytes may be gone or about to be overwritten. | Lost-work path. Stop first. |
| **Critical — security** | Tripward itself may leak, over-claim protection, or destroy work. | `SECURITY.md` only. No public writeup. |
| **Compatibility** | Doctor FAIL, hook schema / version break, full-protection claim refused (AC-12). | Compatibility template. |
| **General** | How-to, false stop, shadow vs enforce, Founding Pro checkout / thanks.html setup. | Help form. |

If you are unsure and preexisting work is involved, treat it as **lost work**. Preview; do not reset.

## Paid-beta response targets (not SLAs)

Copied from the ops brain (Ch 31, “Service objectives after paid beta”). These are **targets**, not a contracted SLA, not a page, and not a promise that someone is online.

| Target | Source |
|--------|--------|
| Critical lost-work or security report **acknowledged within four business hours** during beta. | Ch 31 |
| Compatibility break **assessed within one business day** of a supported platform release. | Ch 31 |

The ops brain does not state a general-help target. Best effort.

Local protection does not depend on email, GitHub, or Stripe being up.

---

## Lost-work emergency

Use this when **preexisting** work (dirty, staged, unstaged, or untracked **before** the run) might be at risk — missing from the worktree, overwritten, or about to be “fixed” by a broad Git command.

Tripward’s recovery law is ADR 0005 / Ch 12: preview is required; apply is digest-bound; **never** a broad destructive reset. Checkpoint writes Git objects (`git hash-object -w`) and leaves the worktree alone. Those blobs can still be recoverable after the worktree changes.

### Do this

1. **Stop.** Do not start another agent run. Do not keep saving over the same paths.
2. **Do not** `git reset --hard`. **Do not** `git clean -fd`. **Do not** `git checkout --` on paths you have not inspected. Those commands can destroy the preexisting bytes the checkpoint is trying to preserve.
3. Preview only — JSON and/or HTML. Neither command applies:

   ```bash
   tripward restore --preview
   tripward restore --preview --html
   ```

   Optional: add the `run_id` and `--open`. JSON stdout stays the preview. The HTML page **does not restore**.
4. Read the preview before anything else:

   - `preexisting_work_intact`
   - `one_click_disabled`
   - `preview_digest`
   - any path with `kind: uncertain` or `restore_action: manual_review`
5. **ADR 0005 digest gate.** Apply is refused unless the digest still matches:

   ```bash
   tripward restore --confirm --digest <preview_digest> --paths a,b <run_id>
   ```

   If the digest mismatches, refresh `--preview` and stop. Do not invent a digest. Do not apply when `preexisting_work_intact` is false, or when the row you care about is `uncertain` / `manual_review`.
6. Contact **Critical**. Use the lost-work form or, if set, `SUPPORT_EMAIL`. Include the paste block below.

### Lost-work paste (usable without GitHub)

Copy this block into a GitHub issue or an email to `SUPPORT_EMAIL` (if set):

````
## Lost-work emergency

- I stopped further agent runs: [yes/no]
- I have not run `git reset --hard` / `git clean -fd` / blind `git checkout --`: [yes/no]
- OS:
- Tripward version (doctor header):
- Claude Code version (`claude --version`, or "absent"):
- `run_id`:
- `preview_digest` (from `--preview`, if it ran):
- `preexisting_work_intact` (true/false/unknown):
- `one_click_disabled` (true/false/unknown):

### Doctor (OVERALL + FAIL rows)

<paste tripward doctor or --json>

### Redacted receipt (if a run sealed)

<paste tripward receipt --redact JSON only — not receipt.html>

### What I think is at risk

<staged / unstaged / untracked files; do not paste file contents or secrets>

### Restore preview excerpt

<preexisting_work_intact, limitations, and the uncertain/manual_review rows only>
````

Severity: **Critical**. Target: acknowledged within four business hours during beta (Ch 31 — a target, not an SLA).

---

## Compatibility (Claude Code version break)

Use this when doctor fails, hooks look stale, or Claude Code moved and Tripward can no longer claim full protection.

Documented fixture floor: Claude Code **2.1.210** (`DOCUMENTED_CLAUDE_CODE_MIN_VERSION` in `src/adapter/payloads.ts`). That is the hooks-reference capture used in CI — not a promise that every later CLI is supported.

Unsupported Claude Code must **refuse a full-protection claim** (AC-12 / ADR 0004). Ch 31: detect unsupported versions before arming; never silently continue with stale hooks. Doctor `OVERALL FAIL` or `protection_claim=failed|degraded` is the triage signal.

Supported hook names this adapter knows: `SessionStart`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `SessionEnd`. PreToolUse blocks **hook-visible tools only**. `@`-referenced files and `EndConversation` do not fire PreToolUse. Dollar enforcement is disabled on Claude Code subscription traffic.

### Compatibility paste (usable without GitHub)

Copy this block into a GitHub issue or an email to `SUPPORT_EMAIL` (if set):

````
## Compatibility

- OS:
- Tripward version (doctor header):
- Claude Code version (`claude --version`):
- Did this start after a Claude Code upgrade? [yes/no — from → to if known]
- `run_id` (if a session ran):
- Doctor `OVERALL` line:
- `protection_claim`:

### Doctor (full text or --json)

<paste tripward doctor or --json>

### Hooks

- Expected: SessionStart / PreToolUse / …
- Observed (what fired, what was missing, any HOOK_INPUT_UNSUPPORTED):
- `hooks_installed` doctor row:

### What broke

<doctor FAIL, refused protection claim, tool that bypassed PreToolUse, etc.>

### Redacted receipt (optional)

<tripward receipt --redact JSON only>
````

Target: compatibility break **assessed within one business day** of a supported platform release (Ch 31 — a target, not an SLA).

---

## Security

Responsible disclosure is `SECURITY.md`. Do **not** attach exploits, PoCs, or secrets to a public issue.

If you only need a private channel and have no mailbox yet, open a public issue titled `[security] request private channel` with **zero** technical detail.

---

## Founding Pro / checkout

Checkout questions are **General**, not lost-work. Empty Payment Link → honest **Checkout not configured**.

After you pay, Stripe should redirect to https://tripward.dev/thanks.html. Those steps also live in `docs/SETUP.md`. How Gage wires **After the payment → redirect** (and the email backup if redirect was off): `docs/FOUNDING_PRO.md` (Post-pay fulfillment).

Do not send Stripe secrets. There is no license key to request.

## Still out of scope

Cursor adapter, fake `$` on subscription traffic, P2 cloud/team, Stripe webhooks, mid-run entitlements, a staffed helpdesk. Paid-beta exit (three paying strangers + no lost work) is **not** claimed here — see `docs/BETA.md`.
