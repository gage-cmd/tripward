import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runSupervised } from "../src/commands/run.js";
import { replayHistory, formatReplayReport } from "../src/replay/replay.js";
import { redactReceipt } from "../src/receipt/redact.js";
import { gitInit, tempDir, writePolicyFile } from "./helpers.js";
import type { ReceiptDocument } from "../src/types.js";

describe("Days 4–7 read-only replay", () => {
  it("parses a sealed run, labels observed vs inferred, and does not mutate", async () => {
    const cwd = gitInit(tempDir("rp-"));
    const home = join(cwd, ".fusecap");
    const policyPath = writePolicyFile(home, {
      tools: { deny: ["NotebookEdit"], max_total: 40 },
      runtime: {
        max_elapsed_seconds: 30,
        graceful_stop_seconds: 1,
        force_kill: true,
        require_hooks: true,
        hook_handshake_seconds: 8,
      },
    });
    const result = await runSupervised({
      cwd,
      home,
      policyPath,
      stub: true,
      stubScenario: "healthy",
    });
    const receiptPath = result.receipt_json;
    const before = readFileSync(receiptPath, "utf8");
    const journalPath = join(home, "runs", result.run_id, "journal.jsonl");
    const journalBefore = readFileSync(journalPath, "utf8");

    const report = replayHistory(home, result.run_id);
    expect(report.read_only).toBe(true);
    expect(report.mutated).toBe(false);
    expect(report.runs).toHaveLength(1);
    expect(report.runs[0].journal_events).toBeGreaterThan(0);
    expect(report.runs[0].findings.some((item) => item.kind === "observed")).toBe(true);
    expect(report.privacy.limitations.some((item) => item.includes("never mutates"))).toBe(true);
    expect(formatReplayReport(report)).toMatch(/read-only/);

    expect(readFileSync(receiptPath, "utf8")).toBe(before);
    expect(readFileSync(journalPath, "utf8")).toBe(journalBefore);

    const receipt = JSON.parse(before) as ReceiptDocument;
    const redacted = redactReceipt(receipt);
    expect(redacted.identity).toMatchObject({ host_label: "redacted", repository_fingerprint: "redacted" });
    expect((redacted.usage as { cost: null }).cost).toBeNull();
    expect(JSON.stringify(redacted)).not.toContain(cwd);
  });

  it("does not create files when the run is missing", () => {
    const cwd = gitInit(tempDir("rp-miss-"));
    const home = join(cwd, ".fusecap");
    mkdirSync(home, { recursive: true });
    const report = replayHistory(home, "run_does_not_exist");
    expect(report.runs[0].compatible).toBe(false);
    expect(report.mutated).toBe(false);
  });

  it("labels unknown journal types as inferred", () => {
    const cwd = gitInit(tempDir("rp-inf-"));
    const home = join(cwd, ".fusecap");
    const dir = join(home, "runs", "run_foreign");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "journal.jsonl"),
      `${JSON.stringify({
        schema_version: "1.0",
        event_id: "evt_x",
        run_id: "run_foreign",
        sequence: 1,
        type: "future.unknown_event",
        wall_time: "2026-09-06T00:00:00.000Z",
        monotonic_ms: 1,
        idempotency_key: "k",
        payload: {},
        digest: "sha256:x",
        raw_persisted: false,
      })}\n`,
    );
    const report = replayHistory(home, "run_foreign");
    expect(report.runs[0].findings[0]?.kind).toBe("inferred");
    expect(report.runs[0].findings[0]?.type).toBe("future.unknown_event");
  });
});
