import { describe, expect, it } from "vitest";
import { Journal } from "../src/journal/journal.js";
import { buildReceipt, renderHtml } from "../src/receipt/builder.js";
import { policy, tempDir } from "./helpers.js";

describe("E8 receipt", () => {
  it("seals JSON/HTML with digest, timeline, and no invented USD", () => {
    const journal = Journal.open(tempDir("rcpt-"));
    journal.append({ run_id: "run_r", type: "run.armed", payload: { ok: true } });
    journal.append({
      run_id: "run_r",
      type: "fuse.tripped",
      payload: { reason: "time_fuse", observed: 2 },
    });
    const receipt = buildReceipt({
      run_id: "run_r",
      started_at: "2026-09-06T00:00:00.000Z",
      ended_at: "2026-09-06T00:00:02.000Z",
      policy: policy(),
      events: journal.list(),
      exit_reason: "time_fuse",
      health: "protected",
      health_reasons: [],
      claude_version: null,
    });
    expect(receipt.usage.cost).toBeNull();
    expect(receipt.usage.source).toBe("unavailable");
    expect(receipt.usage.note).toMatch(/will not invent USD/);
    expect(receipt.integrity.content_digest.startsWith("sha256:")).toBe(true);
    expect(receipt.timeline.length).toBeGreaterThan(0);
    expect(receipt.limitations.length).toBeGreaterThan(3);
    const html = renderHtml(receipt);
    expect(html).toContain("Unavailable");
    expect(html).toContain("will not invent USD");
    expect(html).toContain("tripward restore --preview");
    expect(html).toContain("Time limit reached after 2s");
    expect(html).toContain("What Tripward could not guarantee for this run.");
    expect(html).toContain("tripward.dev");
    expect(html).not.toContain("https://tripward.dev");
    expect(html).not.toMatch(/fusecap/i);
    expect(html).not.toMatch(/\$\d/);
    expect(JSON.stringify(receipt)).not.toMatch(/\$\d/);
  });
});
