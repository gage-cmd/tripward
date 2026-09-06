# Tripward setup (Founding Pro)

**For:** someone who just paid $15/month on the Stripe Payment Link.  
**Also published as:** https://tripward.dev/thanks.html  
**Help:** `SUPPORT.md` (GitHub issues). `SUPPORT_EMAIL` is unset.

There is **no license key**. Stripe does not unlock the CLI. Protection is local. After you pay, Stripe should send you to thanks.html; if it did not, these are the same steps.

You need: **Node 20+**, **git**, and this repo. **Claude Code CLI** (`claude` on `PATH`) is required for a real protected session. Without it, `tripward run` uses the documented stub and the receipt will say so.

`fusecap` is a bin alias of the same CLI. Commands below use `tripward` via `npx tsx`.

## 1. Clone

```bash
git clone https://github.com/gage-cmd/fusecap.git
cd fusecap
git checkout main
npm install
# optional: npm test
```

## 2. Init into a throwaway repo

Do **not** point Tripward at the only copy of work you care about on the first sitting. Use a throwaway git repo the agent can touch.

```bash
cd /path/to/your-throwaway-repo
# must already be a git repo

npx tsx /path/to/fusecap/src/cli.ts init --preview
npx tsx /path/to/fusecap/src/cli.ts init
```

`init` writes a **shadow** policy. Behavioral detectors log and warn; they do not interrupt. Dangerous commands, a missing journal, a required-hook failure, and a missing required checkpoint still hard-stop.

After `npm run build` in the clone, the same CLI is on `tripward` and `fusecap`.

## 3. Doctor

```bash
npx tsx /path/to/fusecap/src/cli.ts doctor
```

Read the `OVERALL` line and every `FAIL` row. Fix those before a real session. Claude Code absent is an honest degrade — not a license problem.

## 4. Run a protected session

Trust the throwaway folder in Claude Code once if it asks, then:

```bash
claude --version
npx tsx /path/to/fusecap/src/cli.ts run
# Tokens after -- are Claude args. A leading `claude` is stripped.
# Do a small real task. Quit normally.
```

Shadow is the default. Flip later with `tripward protect --mode enforce` or `tripward run --preset spike`.

`tripward run --stub` is CI / no-Claude only. It does not count as a live session.

## 5. Receipt and restore preview

```bash
npx tsx /path/to/fusecap/src/cli.ts receipt --html
# open the printed receipt.html — private, local, no fake $

npx tsx /path/to/fusecap/src/cli.ts restore --preview --html
# open the printed recovery.html — the page does not restore
```

Apply only from the terminal, and only after you read the preview (ADR 0005 digest gate). Never `git reset --hard` to “undo” an agent.

If you share evidence, send `tripward receipt --redact` JSON — not `.env`, transcripts, prompts, or the private HTML.

## If something breaks

| Situation | Where |
|-----------|--------|
| How-to, false stop, checkout | [Help](https://github.com/gage-cmd/fusecap/issues/new?template=help.yml) |
| Doctor FAIL / Claude Code version break | [Compatibility](https://github.com/gage-cmd/fusecap/issues/new?template=compatibility.yml) |
| Preexisting work may be at risk | Stop. `tripward restore --preview`. Then [lost-work](https://github.com/gage-cmd/fusecap/issues/new?template=lost-work.yml). Do **not** `git reset --hard`. |
| Vulnerability in Tripward | `SECURITY.md` — not a public issue |

Checkout and fulfillment wiring (Gage): `docs/FOUNDING_PRO.md`. Paid-beta terms: `docs/BETA.md`. Privacy: `docs/PRIVACY.md`.

Not in this product: Cursor adapter, fake USD on Claude Code subscription traffic, cloud/team, a staffed helpdesk, or a license server.
