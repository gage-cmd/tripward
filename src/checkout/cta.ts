import {
  loadFoundingProCheckout,
  type CheckoutLoadOptions,
  type FoundingProCheckout,
} from "./config.js";
import { CHECKOUT_NOT_CONFIGURED, FOUNDING_PRO_CTA_LABEL } from "./terms.js";

export interface FoundingProCta {
  configured: boolean;
  href: string | null;
  label: string;
  ariaDisabled: boolean;
  message: string;
  env_var: FoundingProCheckout["env_var"];
}

/** Resolve the lander / CLI checkout button. Empty or invalid → no href. */
export function resolveFoundingProCta(options: CheckoutLoadOptions = {}): FoundingProCta {
  return ctaFromCheckout(loadFoundingProCheckout(options));
}

export function ctaFromCheckout(checkout: FoundingProCheckout): FoundingProCta {
  if (checkout.configured) {
    return {
      configured: true,
      href: checkout.href,
      label: FOUNDING_PRO_CTA_LABEL,
      ariaDisabled: false,
      message: FOUNDING_PRO_CTA_LABEL,
      env_var: checkout.env_var,
    };
  }
  return {
    configured: false,
    href: null,
    label: CHECKOUT_NOT_CONFIGURED,
    ariaDisabled: true,
    message: checkout.message,
    env_var: checkout.env_var,
  };
}
