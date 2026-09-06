import { describe, expect, it } from "vitest";
import { compilePolicy, explainPolicy } from "../src/policy/compiler.js";
import { evaluateTool } from "../src/policy/evaluator.js";
import { getPreset } from "../src/policy/presets.js";
import { policy } from "./helpers.js";

describe("E4 policy core", () => {
  it("rejects unknown fields and negative limits", () => {
    const raw = getPreset("spike");
    expect(() => compilePolicy({ ...raw, extra: true })).toThrow(/Policy rejected/);
    expect(() =>
      compilePolicy({
        ...raw,
        runtime: { ...raw.runtime, max_elapsed_seconds: -1 },
      }),
    ).toThrow(/Policy rejected/);
  });

  it("evaluates allow / warn / ask / deny with explanations", () => {
    const compiled = policy({ tools: { deny: ["NotebookEdit"], ask: ["Agent"], warn: ["WebSearch"] } });
    const deny = evaluateTool(compiled, baseInput({ tool_name: "NotebookEdit" }));
    const ask = evaluateTool(compiled, baseInput({ tool_name: "Agent" }));
    const warn = evaluateTool(compiled, baseInput({ tool_name: "WebSearch" }));
    const allow = evaluateTool(compiled, baseInput({ tool_name: "Read", tool_input: { file_path: "a.ts" } }));
    expect(deny.decision.action).toBe("deny");
    expect(ask.decision.action).toBe("ask");
    expect(warn.decision.action).toBe("warn");
    expect(allow.decision.action).toBe("allow");
    expect(explainPolicy(compiled)).toMatch(/Tool deny: NotebookEdit/);
    expect(deny.decision.integrity_digest.startsWith("sha256:")).toBe(true);
  });
});

function baseInput(partial: { tool_name: string; tool_input?: Record<string, unknown> }) {
  return {
    run_id: "run_1",
    event_id: `evt_${partial.tool_name}`,
    tool_name: partial.tool_name,
    tool_input: partial.tool_input ?? {},
    elapsed_seconds: 1,
    tools_used: 0,
    repeat_history: [],
    journal_available: true,
    hooks_healthy: true,
    checkpoint_verified: true,
  };
}
