import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHECKOUT_NOT_CONFIGURED, FOUNDING_PRO_PRICE_USD } from "./terms.js";

/** Gage pastes the Stripe Payment Link URL here. Never a secret key. */
export const FOUNDING_PRO_PAYMENT_LINK_ENV = "TRIPWARD_FOUNDING_PRO_PAYMENT_LINK";

/** Optional JSON file: `{ "founding_pro_payment_link": "" }`. */
export const FOUNDING_PRO_CONFIG_ENV = "TRIPWARD_FOUNDING_PRO_CONFIG";
export const FOUNDING_PRO_CONFIG_FILENAME = "checkout.config.json";

export const STRIPE_PAYMENT_LINK_HOST = "buy.stripe.com";

const SECRET_PATTERN = /\b(sk_live_|sk_test_|rk_live_|rk_test_|whsec_|pk_live_|pk_test_)[A-Za-z0-9]+/i;

export type CheckoutMissReason = "empty" | "invalid";

export interface FoundingProCheckoutConfigured {
  configured: true;
  href: string;
  env_var: typeof FOUNDING_PRO_PAYMENT_LINK_ENV;
  source: "env" | "config-file";
  price_usd: typeof FOUNDING_PRO_PRICE_USD;
}

export interface FoundingProCheckoutUnconfigured {
  configured: false;
  href: null;
  message: typeof CHECKOUT_NOT_CONFIGURED;
  reason: CheckoutMissReason;
  detail: string;
  env_var: typeof FOUNDING_PRO_PAYMENT_LINK_ENV;
  price_usd: typeof FOUNDING_PRO_PRICE_USD;
}

export type FoundingProCheckout = FoundingProCheckoutConfigured | FoundingProCheckoutUnconfigured;

export interface CheckoutLoadOptions {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  cwd?: string;
  configPath?: string;
}

export interface ParsedPaymentLink {
  ok: true;
  href: string;
}

export interface RejectedPaymentLink {
  ok: false;
  reason: CheckoutMissReason;
  detail: string;
}

export function parsePaymentLink(raw: string | undefined | null): ParsedPaymentLink | RejectedPaymentLink {
  if (raw == null) {
    return { ok: false, reason: "empty", detail: "Payment Link is unset." };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, reason: "empty", detail: "Payment Link is empty." };
  }
  if (SECRET_PATTERN.test(trimmed)) {
    return {
      ok: false,
      reason: "invalid",
      detail: "Value looks like a Stripe secret or publishable key. Use a Payment Link URL only.",
    };
  }
  const placeholder = new Set([
    "#founding",
    "todo",
    "changeme",
    "your_payment_link",
    "https://buy.stripe.com/",
    "https://buy.stripe.com",
  ]);
  if (placeholder.has(trimmed.toLowerCase())) {
    return { ok: false, reason: "empty", detail: "Payment Link is still a placeholder." };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "invalid", detail: "Payment Link is not a valid URL." };
  }
  if (url.protocol !== "https:") {
    return { ok: false, reason: "invalid", detail: "Payment Link must be https." };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "invalid", detail: "Payment Link must not include credentials." };
  }
  if (url.hostname !== STRIPE_PAYMENT_LINK_HOST) {
    return {
      ok: false,
      reason: "invalid",
      detail: `Payment Link host must be ${STRIPE_PAYMENT_LINK_HOST}.`,
    };
  }
  const path = url.pathname.replace(/\/+$/, "");
  if (!/^\/(?:test_)?[A-Za-z0-9_-]{8,}$/.test(path)) {
    return { ok: false, reason: "invalid", detail: "Payment Link path is missing or too short." };
  }
  if (url.hash) {
    return { ok: false, reason: "invalid", detail: "Payment Link must not include a hash." };
  }
  return { ok: true, href: `${url.origin}${path}${url.search}` };
}

function unconfigured(reason: CheckoutMissReason, detail: string): FoundingProCheckoutUnconfigured {
  return {
    configured: false,
    href: null,
    message: CHECKOUT_NOT_CONFIGURED,
    reason,
    detail,
    env_var: FOUNDING_PRO_PAYMENT_LINK_ENV,
    price_usd: FOUNDING_PRO_PRICE_USD,
  };
}

function readConfigFileLink(path: string): { link?: string; error?: string } {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { founding_pro_payment_link?: unknown };
    return typeof parsed.founding_pro_payment_link === "string" ? { link: parsed.founding_pro_payment_link } : {};
  } catch {
    return { error: "checkout config file is not valid JSON." };
  }
}

export function loadFoundingProCheckout(options: CheckoutLoadOptions = {}): FoundingProCheckout {
  const env = options.env ?? process.env;
  const fromEnv = parsePaymentLink(env[FOUNDING_PRO_PAYMENT_LINK_ENV]);
  if (fromEnv.ok) {
    return {
      configured: true,
      href: fromEnv.href,
      env_var: FOUNDING_PRO_PAYMENT_LINK_ENV,
      source: "env",
      price_usd: FOUNDING_PRO_PRICE_USD,
    };
  }
  if (fromEnv.reason === "invalid") {
    return unconfigured(fromEnv.reason, fromEnv.detail);
  }

  const cwd = options.cwd ?? process.cwd();
  const explicit = options.configPath ?? env[FOUNDING_PRO_CONFIG_ENV];
  const candidates = [explicit, resolve(cwd, FOUNDING_PRO_CONFIG_FILENAME)].filter(
    (value): value is string => Boolean(value),
  );

  for (const candidate of candidates) {
    const path = resolve(cwd, candidate);
    if (!existsSync(path)) continue;
    const file = readConfigFileLink(path);
    if (file.error) {
      return unconfigured("invalid", file.error);
    }
    const parsed = parsePaymentLink(file.link);
    if (parsed.ok) {
      return {
        configured: true,
        href: parsed.href,
        env_var: FOUNDING_PRO_PAYMENT_LINK_ENV,
        source: "config-file",
        price_usd: FOUNDING_PRO_PRICE_USD,
      };
    }
    if (parsed.reason === "invalid") {
      return unconfigured(parsed.reason, parsed.detail);
    }
  }

  return unconfigured("empty", `Set ${FOUNDING_PRO_PAYMENT_LINK_ENV} to a Stripe Payment Link URL.`);
}
