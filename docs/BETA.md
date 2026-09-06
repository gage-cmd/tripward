# Tripward paid beta (Days 8–14)

**Phase:** Ch 25 Days 8–14 paid beta. **OPEN.**  
**Law:** `docs/FUSECAP_OPS_BRAIN.txt`.  
**Canonical URL:** https://tripward.dev  
**Gate 0:** PASS — `docs/SPIKE.md`.  
**Days 4–7 private alpha:** **EXITED.** Counting rules stay in `docs/ALPHA.md`.

This document does **not** claim the paid-beta exit gate. It does **not** invent paying-customer rows.

Authorization still excludes: Cursor adapter, fake `$` on subscription traffic, P2 cloud/team, enterprise SSO, remote-control app, universal LLM proxy, Stripe secret keys in the repo, webhooks, mid-run entitlements.

## Alpha exit (honest)

Measured tallies remain **1 / 5 installs · 1 / 3 real runs · 1 / 1 legitimate signal**.

Gage waived the remaining installs and remaining real runs. This repository does **not** invent per-install or per-run tally rows.

## Landed: PR1

Private local receipt HTML, generated from sealed `receipt.json`, Apple-bar spec in `docs/ux/PR1-receipt-html-apple-bar.md`.

```bash
tripward receipt --html              # write receipt.html next to the JSON; print path
tripward receipt --html --open       # same, then open on macOS/linux when a helper exists
tripward receipt --redact            # unchanged shareable JSON
```

Primary receipt CTA remains `tripward restore --preview <run_id>`. A secondary line points at `--preview --html`.

## Landed: PR2

Private local recovery preview HTML from the same `buildRecoveryPreview()` payload as JSON. Spec: `docs/ux/PR2-recovery-preview-apple-bar.md`. Law: ADR 0005.

```bash
tripward restore --preview <run_id>             # JSON stdout unchanged
tripward restore --preview --html <run_id>      # write recovery.html; JSON stdout unchanged
tripward restore --preview --html --open        # same, then open when a helper exists
tripward restore --confirm --digest <preview_digest> --paths a,b <run_id>
```

The recovery page never applies. Checkboxes only rewrite the displayed command. Uncertain / `!safe` rows are not selectable. `one_click_disabled` defaults to none checked. `!preexisting_work_intact` fail-closes (rose strip, no compose). Digest mismatch still aborts apply.

## Landed: PR3

Founding Pro **$15/month** checkout stub. Gage pastes a Stripe Payment Link URL into env/config. Empty → honest **Checkout not configured** (no broken Stripe href).

```bash
tripward founding-pro            # terms + privacy + CTA status
tripward founding-pro --json
```

| Wire | Value |
|------|--------|
| Env var | `TRIPWARD_FOUNDING_PRO_PAYMENT_LINK` |
| Optional file | `checkout.config.json` → `founding_pro_payment_link` (see `checkout.config.example.json`) |
| Lander button | `#founding` on https://tripward.dev — snippet in `docs/lander/` |

How Gage creates the Payment Link, wires **After the payment → https://tripward.dev/thanks.html**, refund/beta copy, and privacy: `docs/FOUNDING_PRO.md`, `docs/PRIVACY.md`. Buyer setup: `docs/SETUP.md`. This pack does **not** call Stripe APIs, store secrets, or claim three paying strangers.

## Landed: PR4

Support channel docs. Operator paths the ops brain (Ch 31) requires: lost-work emergency, compatibility template, security disclosure, paid response **targets**.

| Doc | Role |
|-----|------|
| `SUPPORT.md` | Channels, what to include, severity, lost-work + compatibility paste blocks |
| `SECURITY.md` | Private disclosure. No public exploit writeups. `SUPPORT_EMAIL` unset until Gage fills it. |
| `.github/ISSUE_TEMPLATE/` | GitHub forms for lost-work, compatibility, and help. Same fields work in markdown without the UI. |

Lost-work: stop → `tripward restore --preview` / `--html` → ADR 0005 digest gate. Do **not** `git reset --hard`.

Response targets (Ch 31 — **targets, not SLAs**): critical lost-work/security acknowledged within four business hours during beta; compatibility break assessed within one business day of a supported platform release.

This pack does **not** invent a staffed helpdesk, a support mailbox, or three paying strangers.

## This slice (post-pay fulfillment)

After Payment Link checkout, buyers should land on https://tripward.dev/thanks.html. Gage sets that in Stripe Dashboard → Payment Link → **After the payment** → redirect. Copy-paste setup: `docs/SETUP.md`. Lander drop-in: `docs/lander/thanks.snippet.html`. Wiring: `docs/FOUNDING_PRO.md` (Post-pay fulfillment).

Still no webhooks, license keys, or mid-run entitlements. Refunds stay manual in Stripe. If someone pays without a redirect, Gage emails the same steps (Stripe already has their address).

## Later slices (not this PR)

| PR | Scope | Status |
|----|--------|--------|
| PR1 | Local receipt HTML UI | landed |
| PR2 | Recovery preview HTML | landed |
| PR3 | Founding Pro $15/mo checkout | landed |
| PR4 | Support channel | landed |
| — | Post-pay fulfillment docs (thanks.html + SETUP) | this pack |

Do not treat this file as a Stripe API or desktop-app ship.

## Paid-beta exit gate (later)

Ch 25: **three paying strangers and no lost work.**

Not met. Do not invent paying-customer rows here.

## What a stranger does

Founding Pro buyers: https://tripward.dev/thanks.html and `docs/SETUP.md` (throwaway repo first; Claude Code required for a real session). Install path is otherwise unchanged — see `docs/ALPHA.md`. After a run:

```bash
tripward receipt --html
# open the printed receipt.html
tripward restore --preview --html
# open the printed recovery.html — then apply only from the terminal
```

Do not send `.env`, transcripts, prompts, or repo contents. If you share evidence, use `tripward receipt --redact` JSON, not the private local HTML.

Need help, a version break, or a lost-work path? `SUPPORT.md`. Security? `SECURITY.md`.
