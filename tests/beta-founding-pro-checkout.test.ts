import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveFoundingProCta } from "../src/checkout/cta.js";
import {
  FOUNDING_PRO_CONFIG_FILENAME,
  FOUNDING_PRO_PAYMENT_LINK_ENV,
  loadFoundingProCheckout,
  parsePaymentLink,
} from "../src/checkout/config.js";
import { CHECKOUT_NOT_CONFIGURED, FOUNDING_PRO_CTA_LABEL, FOUNDING_PRO_PRICE_USD } from "../src/checkout/terms.js";
import { formatFoundingProStatus, foundingProStatus } from "../src/commands/founding-pro.js";
import { tempDir } from "./helpers.js";

const PLACEHOLDER_LINK = "https://buy.stripe.com/test_placeholder_not_live";

describe("PR3 Founding Pro checkout stub", () => {
  it("treats empty and placeholder values as checkout not configured (no href)", () => {
    for (const raw of [undefined, "", "   ", "#founding", "https://buy.stripe.com/", "TODO"]) {
      const parsed = parsePaymentLink(raw);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.reason).toBe("empty");
    }
    const checkout = loadFoundingProCheckout({ env: {}, cwd: tempDir("fp-empty-") });
    expect(checkout.configured).toBe(false);
    if (!checkout.configured) {
      expect(checkout.href).toBeNull();
      expect(checkout.message).toBe(CHECKOUT_NOT_CONFIGURED);
      expect(checkout.env_var).toBe(FOUNDING_PRO_PAYMENT_LINK_ENV);
    }
    const cta = resolveFoundingProCta({ env: {}, cwd: tempDir("fp-cta-empty-") });
    expect(cta.configured).toBe(false);
    expect(cta.href).toBeNull();
    expect(cta.label).toBe(CHECKOUT_NOT_CONFIGURED);
    expect(cta.ariaDisabled).toBe(true);
  });

  it("rejects secrets, non-https, and non-Payment-Link hosts without emitting a href", () => {
    const bad = [
      "sk_live_this_is_not_a_payment_link",
      "whsec_not_a_link_either_ok",
      "javascript:alert(1)",
      "http://buy.stripe.com/test_placeholder_not_live",
      "https://evil.example/checkout",
      "https://dashboard.stripe.com/acct_xxx",
      "https://user:pass@buy.stripe.com/test_placeholder_not_live",
    ];
    for (const raw of bad) {
      const parsed = parsePaymentLink(raw);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.reason).toBe("invalid");
    }
    const checkout = loadFoundingProCheckout({
      env: { [FOUNDING_PRO_PAYMENT_LINK_ENV]: "sk_live_do_not_echo" },
      cwd: tempDir("fp-secret-"),
    });
    expect(checkout.configured).toBe(false);
    expect(JSON.stringify(checkout)).not.toContain("sk_live_do_not_echo");
    expect(resolveFoundingProCta({ env: { [FOUNDING_PRO_PAYMENT_LINK_ENV]: "https://evil.example/x" } }).href).toBeNull();
  });

  it("accepts a Stripe Payment Link shape from env and prefers env over an empty config file", () => {
    const cwd = tempDir("fp-env-");
    writeFileSync(join(cwd, FOUNDING_PRO_CONFIG_FILENAME), `${JSON.stringify({ founding_pro_payment_link: "" })}\n`);
    const checkout = loadFoundingProCheckout({
      env: { [FOUNDING_PRO_PAYMENT_LINK_ENV]: `${PLACEHOLDER_LINK}/` },
      cwd,
    });
    expect(checkout).toMatchObject({
      configured: true,
      href: PLACEHOLDER_LINK,
      source: "env",
      price_usd: FOUNDING_PRO_PRICE_USD,
    });
    const cta = resolveFoundingProCta({
      env: { [FOUNDING_PRO_PAYMENT_LINK_ENV]: PLACEHOLDER_LINK },
      cwd,
    });
    expect(cta.href).toBe(PLACEHOLDER_LINK);
    expect(cta.label).toBe(FOUNDING_PRO_CTA_LABEL);
    expect(cta.ariaDisabled).toBe(false);
  });

  it("reads checkout.config.json when the env var is empty", () => {
    const cwd = tempDir("fp-file-");
    writeFileSync(
      join(cwd, FOUNDING_PRO_CONFIG_FILENAME),
      `${JSON.stringify({ founding_pro_payment_link: PLACEHOLDER_LINK })}\n`,
    );
    const checkout = loadFoundingProCheckout({ env: {}, cwd });
    expect(checkout.configured).toBe(true);
    if (checkout.configured) {
      expect(checkout.href).toBe(PLACEHOLDER_LINK);
      expect(checkout.source).toBe("config-file");
    }
  });

  it("prints an honest founding-pro status without claiming payers", () => {
    const status = foundingProStatus({ env: {}, cwd: tempDir("fp-status-") });
    const text = formatFoundingProStatus(status);
    expect(text).toContain(CHECKOUT_NOT_CONFIGURED);
    expect(text).toContain(FOUNDING_PRO_PAYMENT_LINK_ENV);
    expect(text).toContain("$15/month");
    expect(text).toContain("docs/FOUNDING_PRO.md");
    expect(text).toContain("will not invent USD");
    expect(text.toLowerCase()).not.toContain("three paying");
    expect(status.checkout.configured).toBe(false);
    expect(status.privacy.do_not_collect.some((line) => line.includes("Invented USD"))).toBe(true);
  });

  it("ships the lander snippet unconfigured and names the Marketing env var", () => {
    const snippet = readFileSync(join(process.cwd(), "docs/lander/founding-pro-cta.snippet.html"), "utf8");
    expect(snippet).toContain(`const ${FOUNDING_PRO_PAYMENT_LINK_ENV} = "";`);
    expect(snippet).toContain(CHECKOUT_NOT_CONFIGURED);
    expect(snippet).toContain('id="founding"');
    expect(snippet).toContain("buy.stripe.com");
    expect(snippet).not.toMatch(/sk_live_[A-Za-z0-9]{8,}/);
    expect(snippet).not.toMatch(/whsec_[A-Za-z0-9]{8,}/);
    expect(snippet).not.toMatch(/https:\/\/buy\.stripe\.com\/[A-Za-z0-9_-]{8,}/);
  });
});
