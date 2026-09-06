import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Journal } from "../src/journal/journal.js";
import { tempDir } from "./helpers.js";

describe("E3 journal", () => {
  it("is append-only and idempotent on adapter event + payload digest", () => {
    const journal = Journal.open(tempDir("j-"));
    const first = journal.append({
      run_id: "run_1",
      type: "tool.requested",
      adapter_event_id: "toolu_1",
      payload: { tool_name: "Bash" },
    });
    const second = journal.append({
      run_id: "run_1",
      type: "tool.requested",
      adapter_event_id: "toolu_1",
      payload: { tool_name: "Bash" },
    });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.event.event_id).toBe(first.event.event_id);
    expect(journal.list()).toHaveLength(1);
  });

  it("reopens after a crashed partial line and marks unknown", () => {
    const dir = tempDir("jcrash-");
    const journal = Journal.open(dir);
    journal.append({ run_id: "run_1", type: "run.armed", payload: { ok: true } });
    appendFileSync(join(dir, "journal.jsonl"), '{"sequence":2,"partial":');
    const reopened = new Journal(journal.filePath);
    expect(reopened.list().some((event) => event.type === "journal.unknown_after_crash")).toBe(true);
    const next = reopened.append({ run_id: "run_1", type: "run.ended", payload: {} });
    expect(next.event.sequence).toBeGreaterThan(1);
  });
});
