import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("PR4 support channel docs", () => {
  it("ships SUPPORT.md, SECURITY.md, and GitHub issue forms", () => {
    for (const rel of [
      "SUPPORT.md",
      "SECURITY.md",
      ".github/ISSUE_TEMPLATE/config.yml",
      ".github/ISSUE_TEMPLATE/lost-work.yml",
      ".github/ISSUE_TEMPLATE/compatibility.yml",
      ".github/ISSUE_TEMPLATE/help.yml",
    ]) {
      expect(existsSync(join(root, rel)), rel).toBe(true);
    }
  });

  it("documents channels, evidence, and the never-send list", () => {
    const support = read("SUPPORT.md");
    expect(support).toContain("tripward doctor");
    expect(support).toContain("receipt --redact");
    expect(support).toContain("run_id");
    expect(support).toMatch(/never send/i);
    expect(support).toContain(".env");
    expect(support).toMatch(/prompts/i);
    expect(support).toContain("SUPPORT_EMAIL");
    expect(support).toMatch(/unset/i);
    expect(support).not.toMatch(/security@tripward\.dev/i);
    expect(support).not.toMatch(/support@tripward\.dev/i);
  });

  it("states the lost-work emergency path without recommending a hard reset", () => {
    const support = read("SUPPORT.md");
    const lostWork = read(".github/ISSUE_TEMPLATE/lost-work.yml");
    for (const text of [support, lostWork]) {
      expect(text).toContain("tripward restore --preview");
      expect(text).toContain("--html");
      expect(text).toMatch(/ADR 0005|preview_digest|--digest/);
      expect(text).toMatch(/git reset --hard/);
      expect(text).toMatch(/\*\*Do not\*\* `git reset --hard`|Do \*\*not\*\* `git reset --hard`/i);
    }
    expect(support).toContain("preexisting_work_intact");
    expect(lostWork).toContain("preexisting_work_intact");
  });

  it("ships a compatibility template for doctor fail and unsupported hooks", () => {
    const support = read("SUPPORT.md");
    const compat = read(".github/ISSUE_TEMPLATE/compatibility.yml");
    for (const text of [support, compat]) {
      expect(text).toMatch(/doctor/i);
      expect(text).toMatch(/HOOK_INPUT_UNSUPPORTED|unsupported hooks|PreToolUse/i);
      expect(text).toMatch(/claude --version|Claude Code version/);
    }
    expect(support).toContain("2.1.210");
    expect(support).toMatch(/AC-12/);
  });

  it("keeps security disclosure private and honest", () => {
    const security = read("SECURITY.md");
    const config = read(".github/ISSUE_TEMPLATE/config.yml");
    expect(security).toMatch(/responsible.disclosure|Do not file a public issue/i);
    expect(security).toContain("SUPPORT_EMAIL");
    expect(security).toMatch(/unset/i);
    expect(security).toContain("security/advisories/new");
    expect(security).toMatch(/no bug bounty/i);
    expect(security).not.toMatch(/security@tripward\.dev/i);
    expect(config).toContain("SECURITY.md");
    expect(config).toMatch(/Do not file a public issue/i);
    expect(existsSync(join(root, ".github/ISSUE_TEMPLATE/security.yml"))).toBe(false);
  });

  it("copies Ch 31 response targets and does not invent an SLA or payer tally", () => {
    const support = read("SUPPORT.md");
    const security = read("SECURITY.md");
    const beta = read("docs/BETA.md");
    for (const text of [support, security, beta]) {
      expect(text).toMatch(/four business hours/i);
      expect(text).toMatch(/targets?, not (an )?SLAs?/i);
    }
    expect(support).toMatch(/one business day/i);
    expect(beta).toMatch(/PR4/);
    expect(beta).toMatch(/this pack/);
    expect(beta).toMatch(/not.*claim.*paid-beta exit|does \*\*not\*\* claim the paid-beta exit/i);
    expect(beta).not.toMatch(/paying strangers:\s*[1-9]/i);
    expect(read("README.md")).toContain("SUPPORT.md");
    expect(read("README.md")).toContain("SECURITY.md");
  });
});
