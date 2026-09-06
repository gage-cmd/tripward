import { describe, expect, it } from "vitest";
import { detectExactLoop } from "../src/loop/detector.js";
import { normalizeTool } from "../src/loop/normalizer.js";

describe("E5 exact loop", () => {
  it("normalizes equivalent bash whitespace to the same signature", () => {
    const a = normalizeTool("Bash", { command: "pytest   tests/test_flaky.py" });
    const b = normalizeTool("Bash", { command: "pytest tests/test_flaky.py" });
    expect(a.normalized_signature).toBe(b.normalized_signature);
    expect(a.normalizer_version).toBeTruthy();
  });

  it("trips at the threshold inside the window and returns evidence", () => {
    const signature = normalizeTool("Bash", { command: "pytest tests/test_flaky.py" }).normalized_signature;
    const history = [1, 2, 3, 4].map((i) => ({ event_id: `e${i}`, signature }));
    const hit = detectExactLoop(history, { event_id: "e5", signature }, 5, 12);
    expect(hit.tripped).toBe(true);
    expect(hit.count).toBe(5);
    expect(hit.evidence_refs).toEqual(["e1", "e2", "e3", "e4", "e5"]);
  });

  it("does not trip when repeats fall outside the window", () => {
    const signature = "sig-a";
    const history = [
      { event_id: "old", signature },
      { event_id: "n1", signature: "other" },
      { event_id: "n2", signature: "other" },
    ];
    const hit = detectExactLoop(history, { event_id: "n3", signature }, 3, 3);
    expect(hit.tripped).toBe(false);
    expect(hit.count).toBe(1);
  });
});
