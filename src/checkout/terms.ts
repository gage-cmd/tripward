/** Founding Pro copy — Ch 28 / Days 8–14. Honest product terms, not legal advice. */

export const FOUNDING_PRO_NAME = "Founding Pro";
export const FOUNDING_PRO_PRICE_USD = 15;
export const FOUNDING_PRO_INTERVAL = "month";
export const FOUNDING_PRO_PRICE_LINE = "Founding Pro — $15/month";
export const FOUNDING_PRO_CTA_LABEL = "Get Founding Pro";
export const CHECKOUT_NOT_CONFIGURED = "Checkout not configured";
/** Buyer landing page after Stripe Payment Link checkout. No license key. */
export const FOUNDING_PRO_THANKS_URL = "https://tripward.dev/thanks.html";
export const FOUNDING_PRO_SETUP_DOC = "docs/SETUP.md";

export const BETA_STATUS =
  "Tripward is in paid beta. What you are buying is the protection this repository actually ships for Claude Code — not a future roadmap, Cursor adapter, or cloud/team product.";

export const BETA_REFUND =
  "If we take $15 and a promised capability is missing or fails, we refund. That is the deal. Gage refunds in Stripe; this repo does not call a refunds API.";

export const BETA_WHAT_IS_PROMISED = [
  "Local Claude Code protection as documented in docs/SPIKE.md, docs/ALPHA.md, and docs/BETA.md.",
  "Private local receipts that never invent USD on subscription traffic.",
  "Recovery preview before apply (ADR 0005). Tripward will not silently reset a dirty tree.",
  "A documented support path (SUPPORT.md / SECURITY.md): lost-work emergency, compatibility, and private security disclosure. Response targets, not SLAs.",
];

export const BETA_WHAT_IS_NOT_PROMISED = [
  "Cursor adapter, cloud/team, entitlements mid-run, or staffed 24/7 support.",
  "A hard dollar cap on Claude Code or Cursor subscription traffic.",
  "That paid-beta exit (three paying strangers, no lost work) has already happened.",
];

export const PRIVACY_LOCAL_FIRST =
  "Tripward is local-first. Deterministic protection does not require an account or cloud sync.";

export const PRIVACY_COLLECT = [
  "On your machine: journals, sealed receipts, checkpoints, and policy under .fusecap/.",
  "If you pay: Stripe sees the email and payment method you type on their Payment Link. We do not store card numbers in this repo or in local receipts.",
  "If you join the waitlist on tripward.dev: the email you submit.",
];

export const PRIVACY_DO_NOT_COLLECT = [
  "Prompts, completions, file contents, or repository source. Those stay on your machine.",
  "Invented USD. Receipts show Actual | Estimate | Unavailable — never a fake $ amount on Claude Code subscription traffic.",
  "Host paths and repository fingerprints in shareable artifacts. Use tripward receipt --redact; do not share private local HTML.",
  "Stripe secret keys, webhook secrets, or API keys. Those must never be pasted into the lander or committed here.",
];

export const PRIVACY_RECEIPTS =
  "Private local receipt.html is for you. If you share evidence, send redacted JSON. Tripward will not invent USD on Claude Code subscription traffic. Usage dollars stay null unless a separately supported observable API/BYOK boundary is active.";
