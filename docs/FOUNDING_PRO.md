# Founding Pro — $15/month checkout stub

**Phase:** Days 8–14 paid beta, PR3.  
**Price:** $15/month (Ch 28).  
**Canonical lander:** https://tripward.dev  
**This file does not invent paying-customer counts or live Stripe IDs.**

Tripward charges Founding Pro with explicit beta terms and an automatic refund if promised delivery fails. This repository ships the **Payment Link placeholder** — not Stripe API integration, webhooks, or mid-run entitlements.

## What Marketing wires on tripward.dev

| Item | Value |
|------|--------|
| Env / config name | `TRIPWARD_FOUNDING_PRO_PAYMENT_LINK` |
| Lander button | `#founding` (`id="founding"`, label **Get Founding Pro**) |
| GH Pages constant | same name, in `docs/lander/founding-pro-cta.snippet.html` |
| Empty / unset | button must say **Checkout not configured** and must **not** navigate to a Stripe URL |
| Configured | `href` = the Payment Link Gage pastes (`https://buy.stripe.com/…`) |

GitHub Pages has no server env. Marketing pastes the URL into the snippet constant (or a Pages build that injects `TRIPWARD_FOUNDING_PRO_PAYMENT_LINK`). Do not invent a URL to “make the button work.”

## How Gage creates the Stripe Payment Link

1. Stripe Dashboard → **Payment Links** → create a new link.
2. Product name **Founding Pro**. Price **$15 USD**, billing **monthly**.
3. Copy the Payment Link URL. It looks like `https://buy.stripe.com/<id>` (test mode uses a `test_` prefix). This file does not contain a live id.
4. Paste that URL into:
   - the process environment: `TRIPWARD_FOUNDING_PRO_PAYMENT_LINK`
   - and/or a local `checkout.config.json` (see `checkout.config.example.json`; that filename is gitignored)
   - the lander snippet constant so `#founding` can navigate
5. Never put `sk_live_`, `sk_test_`, `whsec_`, or other Stripe secrets in this repo, in GH Pages, or in the lander HTML.

Optional: `TRIPWARD_FOUNDING_PRO_CONFIG` can point at a JSON file `{ "founding_pro_payment_link": "" }`. Env wins over file.

## Verify locally

```bash
npx tsx src/cli.ts founding-pro
# Checkout not configured until the env var / config file has a Payment Link

TRIPWARD_FOUNDING_PRO_PAYMENT_LINK='https://buy.stripe.com/<your-id>' \
  npx tsx src/cli.ts founding-pro
```

`--json` prints the same resolver the tests use.

## Beta / refund

Copy lives in `src/checkout/terms.ts` and is summarized here:

- Paid beta. You are buying the Claude Code protection this repo actually ships, not a roadmap.
- Promised: local protection, honest receipts (no fake USD), recovery preview before apply.
- Not promised: Cursor, cloud/team, staffed 24/7 support, or a dollar cap on subscription traffic.
- Support path (docs, not a helpdesk): `SUPPORT.md` / `SECURITY.md`. Response targets, not SLAs.
- If we charge and a promised capability is missing or fails, Gage refunds in Stripe. This repo does not call the Refunds API. That is still the deal — we do not make the customer argue.

## Privacy

See `docs/PRIVACY.md`. Short form: local-first; receipts stay private; share only `--redact` JSON; no invented USD; Stripe sees only what you type on their Payment Link.

## Out of scope (PR3)

Real Stripe API, webhooks, entitlements enforcement mid-run, Apple-bar paywall HTML. Support channel is PR4 (`SUPPORT.md`).
