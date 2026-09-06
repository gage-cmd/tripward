import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FOUNDING_PRO_SETUP_DOC, FOUNDING_PRO_THANKS_URL } from "../src/checkout/terms.js";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

const SECRET_RE = /sk_live_[A-Za-z0-9]{8,}|sk_test_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}/;
const LIVE_LINK_RE = /https:\/\/buy\.stripe\.com\/(?!\<)[A-Za-z0-9_-]{8,}/;

describe("Founding Pro post-pay fulfillment docs", () => {
  it("ships SETUP.md and the thanks.html lander drop-in", () => {
    expect(FOUNDING_PRO_THANKS_URL).toBe("https://tripward.dev/thanks.html");
    expect(FOUNDING_PRO_SETUP_DOC).toBe("docs/SETUP.md");
    expect(existsSync(join(root, "docs/SETUP.md"))).toBe(true);
    expect(existsSync(join(root, "docs/lander/thanks.snippet.html"))).toBe(true);
  });

  it("tells Gage the Stripe After-payment redirect and the after_completion fields", () => {
    const founding = read("docs/FOUNDING_PRO.md");
    expect(founding).toMatch(/Post-pay fulfillment/);
    expect(founding).toContain("https://tripward.dev/thanks.html");
    expect(founding).toMatch(/After the payment|After payment/);
    expect(founding).toContain("after_completion");
    expect(founding).toContain("after_completion.type");
    expect(founding).toContain("after_completion.redirect.url");
    expect(founding).toMatch(/Redirect customers to your website|Redirect to a URL/);
    expect(founding).toMatch(/no license key|There is no key to paste/i);
    expect(founding).toMatch(/webhook/i);
    expect(founding).toMatch(/Manual backup/);
    expect(founding).not.toMatch(SECRET_RE);
    expect(founding).not.toMatch(LIVE_LINK_RE);
    expect(founding.toLowerCase()).not.toMatch(/paying strangers:\s*[1-9]/);
  });

  it("gives a stranger copy-paste setup without DMing Gage", () => {
    const setup = read("docs/SETUP.md");
    const thanks = read("docs/lander/thanks.snippet.html");
    const founding = read("docs/FOUNDING_PRO.md");
    for (const text of [setup, thanks]) {
      expect(text).toContain("git clone https://github.com/gage-cmd/tripward.git");
      expect(text).toContain("cd tripward");
      expect(text).toContain("/path/to/tripward/");
      expect(text).not.toMatch(/cd fusecap\b/);
      expect(text).not.toMatch(/\/path\/to\/fusecap\//);
      expect(text).toMatch(/\binit --preview\b/);
      expect(text).toMatch(/\binit\b/);
      expect(text).toMatch(/\bdoctor\b/);
      expect(text).toMatch(/\brun\b/);
      expect(text).toContain("receipt --html");
      expect(text).toContain("restore --preview --html");
      expect(text).toMatch(/throwaway/);
      expect(text).toMatch(/Claude Code/);
      expect(text).toMatch(/no license key/i);
      expect(text).toContain("SUPPORT.md");
      expect(text).not.toMatch(SECRET_RE);
      expect(text).toMatch(/no Cursor|Not in this product: Cursor/i);
    }
    expect(founding).toContain("git clone https://github.com/gage-cmd/tripward.git");
    expect(setup).toContain(FOUNDING_PRO_THANKS_URL);
    expect(setup).toMatch(/SUPPORT_EMAIL/);
    expect(setup).toMatch(/unset/);
    expect(thanks).toContain(FOUNDING_PRO_SETUP_DOC);
  });

  it("keeps the public product name Tripward in new buyer-facing copy", () => {
    const allowedGithub = /https:\/\/github\.com\/gage-cmd\/tripward(?:\.git)?(?:\/[^\s)"']*)?/g;
    for (const rel of ["docs/SETUP.md", "docs/lander/thanks.snippet.html", "docs/FOUNDING_PRO.md"]) {
      const scrubbed = read(rel).replace(allowedGithub, "");
      expect(scrubbed, rel).not.toMatch(/FuseCap/);
      expect(scrubbed, rel).not.toMatch(/\bfusecap\b/i);
    }
  });

  it("cross-links SUPPORT.md and BETA.md to thanks.html and FOUNDING_PRO fulfillment", () => {
    const support = read("SUPPORT.md");
    const beta = read("docs/BETA.md");
    const readme = read("README.md");
    const lander = read("docs/lander/README.md");
    for (const text of [support, beta, readme, lander]) {
      expect(text).toContain("https://tripward.dev/thanks.html");
      expect(text).toContain("docs/SETUP.md");
    }
    expect(support).toMatch(/Post-pay fulfillment/);
    expect(beta).toMatch(/Post-pay fulfillment/);
    expect(beta).toContain("docs/FOUNDING_PRO.md");
    expect(lander).toContain("thanks.snippet.html");
    expect(lander).toMatch(/After the payment/);
  });
});
