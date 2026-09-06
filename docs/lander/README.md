# Marketing lander — Founding Pro CTA + thanks

https://tripward.dev is a GitHub Pages lander **outside this repo**. This folder is the drop-in pack. Do not invent a live Payment Link to ship the button.

After payment, Stripe should send buyers to **https://tripward.dev/thanks.html**. Gage wires that in the Stripe Dashboard — `docs/FOUNDING_PRO.md` (Post-pay fulfillment). In-repo steps: `docs/SETUP.md`.

## Wire the button

1. Gage creates the Stripe Payment Link ($15/mo) — `docs/FOUNDING_PRO.md`.
2. Paste the URL into `TRIPWARD_FOUNDING_PRO_PAYMENT_LINK` (same name as the Node env var).
3. On the GH Pages lander, **replace** the Founding Pro block (`.price` / `.blurb` / `#founding` / `.micro`) and **delete** any leftover “checkout coming” click handler. Drop in `founding-pro-cta.snippet.html`. Leave the JS constant empty until the Payment Link exists.
4. Publish `thanks.snippet.html` as `/thanks.html` on the same host.
5. Stripe Dashboard → that Payment Link → **After the payment** → redirect to `https://tripward.dev/thanks.html`.

| Lander piece | Before | After Gage pastes the URL |
|--------------|--------|---------------------------|
| `#founding` href | `#founding` | `https://buy.stripe.com/<id>` |
| Button label | Get Founding Pro | Get Founding Pro |
| Empty / unset | keep the button honest | **Checkout not configured** — no Stripe navigation |
| `/thanks.html` | unpublished | buyer setup (clone → init → doctor → run → receipt / restore preview) |

GH Pages cannot read a server env var at request time. The snippet’s JS constant **is** the config. If Marketing later adds a Pages build, inject the same `TRIPWARD_FOUNDING_PRO_PAYMENT_LINK` name.

## Do not

- Commit Stripe secret keys or a real Payment Link into `fusecap`.
- Point `#founding` at a guessed `buy.stripe.com` id.
- Claim three paying strangers or paid-beta exit on the lander.
- Put fake `$` amounts on receipts or in waitlist copy.
- Put `{CHECKOUT_SESSION_ID}`, webhooks, or a license-key form on thanks.html.
