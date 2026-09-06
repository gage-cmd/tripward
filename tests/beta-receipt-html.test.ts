import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseArgs, bool } from "../src/commands/args.js";
import { emitReceipt } from "../src/commands/receipt.js";
import { browserOpenCommand, renderHtml, restorePreviewCommand, usageKind } from "../src/receipt/html.js";
import { redactReceipt } from "../src/receipt/redact.js";
import type { ReceiptDocument } from "../src/types.js";

const fixturePath = join(process.cwd(), "fixtures/receipts/sealed-time-fuse.json");

function loadFixture(): ReceiptDocument {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as ReceiptDocument;
}

function sectionOrder(html: string): string[] {
  const ids = ["header", "health", "trigger", "timeline", "limitations", "digest"];
  return [...html.matchAll(/id="(header|health|trigger|timeline|limitations|digest)"/g)].map((m) => m[1]!);
}

describe("PR1 Apple-bar receipt HTML", () => {
  it("renders the fixture sealed receipt with the UX IA and tokens", () => {
    const receipt = loadFixture();
    const html = renderHtml(receipt);
    expect(sectionOrder(html)).toEqual(["header", "health", "trigger", "timeline", "limitations", "digest"]);
    expect(html).toContain("Tripward");
    expect(html).toContain("Terminated");
    expect(html).toContain("protected");
    expect(html).toContain("Unavailable");
    expect(html).toContain("Source: unavailable");
    expect(html).toContain(restorePreviewCommand(receipt.run_id));
    expect(html).toContain("This page does not restore");
    expect(html).toContain("data-copy=");
    expect(html).toContain("sha256:integrity-fixture-digest");
    expect(html).toContain("sha256:policy-fixture-digest");
    expect(html).toContain("will not invent USD");
    expect(html).toContain("#F5F5F7");
    expect(html).toContain("#1D1D1F");
    expect(html).toContain("#6E6E73");
    expect(html).toContain("#0071E3");
    expect(html).toContain("max-width: 720px");
    expect(html).toContain("border-radius: 12px");
    expect(html).toContain("-apple-system");
    expect(html).toContain("https://tripward.dev");
    expect(html).not.toMatch(/fusecap/i);
    expect(html).not.toMatch(/\$\d/);
    expect(html).not.toContain("secret-host.internal");
    expect(html).not.toContain("/tmp/secret-repo-path");
    expect(html).not.toContain("/Users/secret-user");
    expect(html).not.toMatch(/<link\s/i);
    expect(html).not.toMatch(/@import/i);
    expect(html).not.toMatch(/<script\s+src=/i);
    expect(html).not.toMatch(/fonts\.googleapis/i);
    expect(html).not.toMatch(/https?:\/\/(?!tripward\.dev)/);
  });

  it("never invents USD and classifies subscription usage as Unavailable", () => {
    const receipt = loadFixture();
    expect(receipt.usage.cost).toBeNull();
    expect(usageKind(receipt.usage)).toBe("Unavailable");
    expect(JSON.stringify(receipt)).not.toMatch(/\$\d/);
    expect(renderHtml(receipt)).not.toMatch(/\$\d/);
  });

  it("keeps --redact JSON shareable without changing HTML brand rules", () => {
    const receipt = loadFixture();
    const redacted = redactReceipt(receipt);
    expect(redacted.identity.host_label).toBe("redacted");
    expect(redacted.identity.repository_fingerprint).toBe("redacted");
    expect(redacted.usage.cost).toBeNull();
    expect(renderHtml(redacted)).not.toMatch(/fusecap/i);
  });

  it("writes HTML next to a sealed receipt via the CLI helper", () => {
    const receipt = loadFixture();
    const tmpHome = join("/tmp", `fusecap-html-${Date.now()}`);
    const runDir = join(tmpHome, "runs", receipt.run_id);
    mkdirSync(runDir, { recursive: true });
    writeFileSync(join(runDir, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
    writeFileSync(join(tmpHome, "active-run.json"), JSON.stringify({ run_id: receipt.run_id, run_dir: runDir }));
    const result = emitReceipt({ home: tmpHome, html: true });
    expect(result.htmlPath).toBe(join(runDir, "receipt.html"));
    const written = readFileSync(result.htmlPath!, "utf8");
    expect(written).toContain("tripward restore --preview run_fixture_time_fuse");
    expect(written).toContain("Unavailable");
    expect(written).not.toMatch(/fusecap/i);
  });

  it("does not print JSON when only --html is set, and still supports --redact", () => {
    const receipt = loadFixture();
    const tmpHome = join("/tmp", `fusecap-html-redact-${Date.now()}`);
    const runDir = join(tmpHome, "runs", receipt.run_id);
    mkdirSync(runDir, { recursive: true });
    writeFileSync(join(runDir, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
    const htmlOnly = emitReceipt({ home: tmpHome, runId: receipt.run_id, html: true });
    expect(htmlOnly.jsonPrinted).toBeUndefined();
    const redacted = emitReceipt({ home: tmpHome, runId: receipt.run_id, redact: true });
    expect(redacted.jsonPrinted).toContain('"host_label": "redacted"');
    expect(redacted.htmlPath).toBeUndefined();
  });
});

describe("tripward CLI honesty", () => {
  it("exposes a tripward bin alias beside fusecap", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      bin: { tripward: string; fusecap: string };
    };
    expect(pkg.bin.tripward).toBe("./dist/cli.js");
    expect(pkg.bin.fusecap).toBe("./dist/cli.js");
  });

  it("parses the HTML CTA `tripward restore --preview <run_id>` without swallowing the id", () => {
    const parsed = parseArgs(["node", "tripward", "restore", "--preview", "run_fixture_time_fuse"]);
    expect(parsed.command).toBe("restore");
    expect(bool(parsed.flags, "preview")).toBe(true);
    expect(parsed.rest).toEqual(["run_fixture_time_fuse"]);
  });

  it("names the macOS/linux browser opener without new deps", () => {
    expect(browserOpenCommand("darwin")).toBe("open");
    expect(browserOpenCommand("linux")).toBe("xdg-open");
    expect(browserOpenCommand("win32")).toBeNull();
  });
});
