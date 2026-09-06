# Security (Tripward / fusecap)

**Phase:** Days 8–14 paid beta, PR4.  
**Law:** `docs/FUSECAP_OPS_BRAIN.txt` Ch 20 (threat model) and Ch 31 (security issue path + response target).  
**Operator guide:** `SUPPORT.md`.

This is a responsible-disclosure path, not a security program. There is no dedicated security team, no bug bounty, and no invented `security@` mailbox in this repository.

Tripward sits on Claude Code hooks, a local journal, Git checkpoints, and a process supervisor. A bug here can leak a receipt, over-claim “protected,” or destroy preexisting work. That is why disclosure is private. It is also why we will not pretend Tripward is a host sandbox, a compliance certificate, or an autonomous security product.

## Do not file a public issue with details

Do **not** open a public GitHub issue that contains:

- Exploit steps, PoCs, payloads, or bypass recipes
- Prompts, transcripts, `.env`, tokens, or Stripe secrets
- Private `receipt.html` / `recovery.html`
- Anything that would let a stranger reproduce a leak or a destructive restore

Public issue trackers are public.

## How to report

Pick the first path that exists:

1. **GitHub private vulnerability reporting** — [Open a private advisory](https://github.com/gage-cmd/fusecap/security/advisories/new) if the repository has that setting enabled. If the page says it is not enabled, skip to 2.
2. **`SUPPORT_EMAIL`** — **unset.** Gage: put a mailbox here when one exists. Same paste block as below.
3. **Channel request only** — Open a **public** issue titled `[security] request private channel` with **zero** technical detail. Wait for a private thread. Do not attach the report “so we can start.”

Until a mailbox or private advisory exists, there is no faster honest path. We will not invent one.

## What counts

In scope for a **security** report (Ch 20 release blockers and adjacent):

- Installer or uninstall **broadens file permissions**
- A receipt, journal, share export, or doctor bundle **keeps a secret / prompt / `.env` value** that should have been redacted
- Recovery can **erase a dirty starting tree** (preview-digest gate bypass, apply without `--confirm`, automatic `git reset --hard`)
- A hook bypass or missing component still presented as **protected** (silent fail-open on a catastrophic control)
- Local API / dashboard accepting **non-local origins** (that surface is not shipped; report it if you find one)
- Supply-chain: installer / update / plugin replacement that would run as Tripward

Out of scope (use `SUPPORT.md` instead):

- Doctor `FAIL` or `HOOK_INPUT_UNSUPPORTED` after a Claude Code upgrade → **compatibility**
- A fuse that blocked a tool you wanted, or did not block a tool you dislike → **help** / compatibility
- Founding Pro **Checkout not configured** → **help**
- “Please add Cursor” → out of product scope

## Paste block (private only)

````
## Security report

- I have not posted this publicly: [yes/no]
- OS:
- Tripward version (doctor header):
- Claude Code version (`claude --version`, or "absent"):
- `run_id` (if any):

### Summary

<one paragraph: what is wrong, what a stranger could do>

### Doctor (OVERALL + FAIL rows)

<tripward doctor or --json — redact host paths if you want>

### Redacted receipt (if relevant)

<tripward receipt --redact JSON only>

### Impact

<leak / over-claim / destructive restore / permission broaden — no exploit script>
````

Same never-send list as `SUPPORT.md`: prompts, secrets, `.env`, private HTML, Stripe `sk_` / `whsec_`.

## What we will do

- Treat it as **Critical**.
- **Target:** acknowledge within **four business hours** during paid beta (Ch 31). That is a target, not an SLA.
- Prefer a fix and an honest limitation note over a marketing “security advisory.”
- If a promised capability is missing or fails after we charged, refund terms are in `docs/FOUNDING_PRO.md`. This file does not call a refunds API.

We will not:

- Staff a 24/7 SOC
- Claim OS-level isolation (Claude native sandbox is the OS boundary; Tripward reports posture)
- Quietly continue with stale hooks after a platform break

Paid-beta exit (three paying strangers + no lost work) is not claimed here.
