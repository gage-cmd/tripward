# Privacy (paid beta)

Tripward is **local-first**. Deterministic protection does not require an account or cloud sync.

This is a short disclosure, not legal advice.

## What stays on your machine

Journals, sealed receipts, Git checkpoints, and policy under `.fusecap/`. Private local `receipt.html` / `recovery.html` are for you. They do not phone home.

## What we collect

- **Local artifacts** you already created by running Tripward.
- **If you pay:** Stripe sees the email and payment method you type on their Payment Link. We do not store card numbers in this repository or in receipts.
- **If you join the waitlist** on https://tripward.dev: the email you submit.

## What we do not collect

- Prompts, completions, file contents, or repository source.
- Invented USD. Receipts show **Actual | Estimate | Unavailable**. Claude Code subscription traffic is Unavailable. Tripward will not invent a dollar amount.
- Host paths and repository fingerprints in anything meant to be shared. Use `tripward receipt --redact`. Do not send private local HTML.
- Stripe secret keys, webhook secrets, or API keys.

## Sharing

If you send evidence, send redacted JSON — not `.env`, transcripts, prompts, or repo contents. Usage dollars stay null unless a separately supported observable API/BYOK boundary is active. How to get help: `SUPPORT.md`. Security: `SECURITY.md`.

Telemetry default is off. No account is required for local protection.
