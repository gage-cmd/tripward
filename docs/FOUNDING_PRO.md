# Founding Pro — $15/month checkout stub

**Phase:** Days 8–14 paid beta, PR3.  
**Price:** $15/month (Ch 28).  
**Canonical lander:** https://tripward.dev  
**This file does not invent paying-customer counts or live Stripe IDs.**

Tripward charges Founding Pro with explicit beta terms and an automatic refund if promised delivery fails. This repository ships the **Payment Link placeholder** — not Stripe API integration, webhooks, or mid-run entitlements. After pay, buyers go to https://tripward.dev/thanks.html (`docs/SETUP.md`).

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
5. **After the payment** → redirect to `https://tripward.dev/thanks.html` (see Post-pay fulfillment).
6. Never put `sk_live_`, `sk_test_`, `whsec_`, or other Stripe secrets in this repo, in GH Pages, or in the lander HTML.

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

## Post-pay fulfillment

Payment Link checkout is still a **stub**. This pack does **not** add Stripe API calls, webhooks, license keys, or mid-run entitlements. Delivery is a redirect plus copy-paste setup.

There is no key to paste. Local `tripward init` in a throwaway repo **is** fulfillment.

### What Gage clicks in Stripe

Do this on the existing Founding Pro Payment Link (the one `#founding` should open). Do not invent a second live URL in this repo.

1. Stripe Dashboard → **Payment links**.
2. Open the **Founding Pro** ($15/month) link.
3. **Edit** the link.
4. Open **After the payment** (Stripe sometimes labels this **After payment**).
5. Choose **Redirect customers to your website** (or **Redirect to a URL** / **Don’t show confirmation page** — the Dashboard label varies).
6. Set the success URL to exactly:

   ```
   https://tripward.dev/thanks.html
   ```

7. **Save**.

Do **not** append `{CHECKOUT_SESSION_ID}`. This pack has no session lookup and must not grow one.

Confirm once in Stripe **test mode** (test Payment Link + test card): pay, land on thanks.html, then apply the same After-payment setting on the live-mode link if you use both.

### after_completion (optional)

Stripe’s Payment Link field is `after_completion`:

| Field | Value |
|-------|--------|
| `after_completion.type` | `redirect` |
| `after_completion.redirect.url` | `https://tripward.dev/thanks.html` |

Dashboard is enough. Do not put `sk_live_`, `sk_test_`, `whsec_`, or a secret-bearing curl in this repo, in GH Pages, or in a gist.

### What buyers see

https://tripward.dev/thanks.html is the buyer setup page (CoS publishes it on the GH Pages lander). Same steps live in-repo as `docs/SETUP.md`. Drop-in HTML: `docs/lander/thanks.snippet.html`.

The page is clone → init → doctor → run → receipt / restore preview:

1. Clone: `git clone https://github.com/gage-cmd/tripward.git` then `cd tripward` and `npm install`.
2. `init` into a **throwaway** git repo first — not the only copy of work they care about.
3. `doctor` until `OVERALL` is honest.
4. `run` a real Claude Code session. Claude Code CLI is required for a real protected session; without `claude` on `PATH` the CLI uses the documented stub and the receipt says so.
5. `receipt --html` and `restore --preview --html`. Preview does not apply.

Refunds stay **manual**: Gage refunds in Stripe. This repo still does not call the Refunds API.

### Manual backup (no redirect)

If someone pays and stays on Stripe’s confirmation page (redirect unset, old tab, email receipt only):

1. Open that payment in Stripe. Use the email Stripe already collected.
2. Send the same steps: https://tripward.dev/thanks.html and `docs/SETUP.md`.
3. `SUPPORT_EMAIL` is still **unset**. Do not invent a mailbox. If they file a GitHub Help issue, point them at those two URLs.

Do not DM a license key. There isn’t one.

## Out of scope

Real Stripe API, webhooks, license keys, entitlements enforcement mid-run, Apple-bar paywall HTML. Support channel is `SUPPORT.md`. This pack is fulfillment **docs** only.
