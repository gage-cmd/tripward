import { resolveFoundingProCta, type FoundingProCta } from "../checkout/cta.js";
import { loadFoundingProCheckout, type CheckoutLoadOptions, type FoundingProCheckout } from "../checkout/config.js";
import {
  BETA_REFUND,
  BETA_STATUS,
  BETA_WHAT_IS_NOT_PROMISED,
  BETA_WHAT_IS_PROMISED,
  FOUNDING_PRO_PRICE_LINE,
  PRIVACY_COLLECT,
  PRIVACY_DO_NOT_COLLECT,
  PRIVACY_LOCAL_FIRST,
  PRIVACY_RECEIPTS,
} from "../checkout/terms.js";

export interface FoundingProStatus {
  product: typeof FOUNDING_PRO_PRICE_LINE;
  checkout: FoundingProCheckout;
  cta: FoundingProCta;
  beta: {
    status: string;
    refund: string;
    promised: string[];
    not_promised: string[];
  };
  privacy: {
    local_first: string;
    collect: string[];
    do_not_collect: string[];
    receipts: string;
  };
  docs: {
    founding_pro: string;
    privacy: string;
    lander: string;
    support: string;
  };
}

export function foundingProStatus(options: CheckoutLoadOptions = {}): FoundingProStatus {
  const checkout = loadFoundingProCheckout(options);
  return {
    product: FOUNDING_PRO_PRICE_LINE,
    checkout,
    cta: resolveFoundingProCta(options),
    beta: {
      status: BETA_STATUS,
      refund: BETA_REFUND,
      promised: BETA_WHAT_IS_PROMISED,
      not_promised: BETA_WHAT_IS_NOT_PROMISED,
    },
    privacy: {
      local_first: PRIVACY_LOCAL_FIRST,
      collect: PRIVACY_COLLECT,
      do_not_collect: PRIVACY_DO_NOT_COLLECT,
      receipts: PRIVACY_RECEIPTS,
    },
    docs: {
      founding_pro: "docs/FOUNDING_PRO.md",
      privacy: "docs/PRIVACY.md",
      lander: "docs/lander/README.md",
      support: "SUPPORT.md",
    },
  };
}

export function formatFoundingProStatus(status: FoundingProStatus): string {
  const lines = [
    status.product,
    "",
    status.checkout.configured
      ? `Checkout: configured (${status.checkout.source})`
      : `Checkout: ${status.checkout.message}`,
    status.checkout.configured
      ? `CTA: ${status.cta.label} → ${status.cta.href}`
      : `CTA: ${status.cta.label} (no href). Set ${status.checkout.env_var}.`,
    "",
    status.beta.status,
    status.beta.refund,
    "",
    status.privacy.local_first,
    status.privacy.receipts,
    "",
    `See ${status.docs.founding_pro}, ${status.docs.privacy}, and ${status.docs.support}.`,
  ];
  return lines.join("\n");
}
