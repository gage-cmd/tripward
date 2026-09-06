import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hookResponseFor, parseHookInput } from "../src/adapter/hooks.js";
import { ALL_FIXTURES, FIXTURE_SOURCE, fixtureCatalog } from "../src/adapter/payloads.js";
import { adapterCoverage } from "../src/adapter/versions.js";

describe("E1 adapter spike", () => {
  it("captures official lifecycle fixtures and names the source", () => {
    const catalog = fixtureCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(5);
    expect(FIXTURE_SOURCE).toMatch(/code\.claude\.com/);
    expect(parseHookInput(JSON.stringify(ALL_FIXTURES.pre_tool_use_bash)).tool_name).toBe("Bash");
    const disk = JSON.parse(
      readFileSync(resolve("fixtures/claude-hooks/pre-tool-use-bash.json"), "utf8"),
    ) as { hook_event_name: string };
    expect(disk.hook_event_name).toBe("PreToolUse");
  });

  it("blocks a tool using the official PreToolUse permissionDecision envelope", () => {
    const response = hookResponseFor("PreToolUse", "deny", "Tool NotebookEdit is denied by policy.");
    expect(response.hookSpecificOutput?.hookEventName).toBe("PreToolUse");
    expect(response.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(response.hookSpecificOutput?.permissionDecisionReason).toBeTruthy();
  });

  it("reports adapter version coverage and keeps hook latency budget in mind", () => {
    const coverage = adapterCoverage(null);
    expect(coverage.supported_events).toContain("PreToolUse");
    expect(coverage.limitations.some((item) => item.includes("Dollar"))).toBe(true);
    const started = Date.now();
    parseHookInput(JSON.stringify(ALL_FIXTURES.pre_tool_use_bash));
    expect(Date.now() - started).toBeLessThan(35);
  });

  it("quarantines unknown hook events instead of treating them as allow-by-trust", () => {
    expect(() => parseHookInput("{}")).toThrow(/HOOK_INPUT_UNSUPPORTED/);
  });
});
