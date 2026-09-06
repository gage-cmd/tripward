import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyInstall } from "../src/install/installer.js";
import { compilePolicy, explainPolicy } from "../src/policy/compiler.js";
import { evaluateTool } from "../src/policy/evaluator.js";
import { getPreset } from "../src/policy/presets.js";
import { handleHook, writePolicy, writeRun } from "../src/session.js";
import { sessionStartFixture } from "../src/adapter/payloads.js";
import { Journal } from "../src/journal/journal.js";
import { gitInit, policy, tempDir } from "./helpers.js";
import type { RunRecord } from "../src/types.js";

function baseInput(partial: { tool_name: string; tool_input?: Record<string, unknown>; repeat?: number }) {
  const signature = "sig-repeat";
  const history = Array.from({ length: partial.repeat ?? 0 }, (_, i) => ({
    event_id: `e${i}`,
    signature,
  }));
  return {
    run_id: "run_shadow",
    event_id: "evt_now",
    tool_name: partial.tool_name,
    tool_input: partial.tool_input ?? {},
    elapsed_seconds: 1,
    tools_used: 0,
    repeat_history: history,
    journal_available: true,
    hooks_healthy: true,
    checkpoint_verified: true,
  };
}

describe("Days 4–7 shadow mode", () => {
  it("defaults standard / init policy to shadow", () => {
    expect(getPreset("standard").mode).toBe("shadow");
    const cwd = gitInit(tempDir("sh-init-"));
    const home = join(cwd, ".fusecap");
    applyInstall(cwd, home, false);
    const written = JSON.parse(readFileSync(join(home, "policy.json"), "utf8")) as { mode: string };
    expect(written.mode).toBe("shadow");
  });

  it("signals policy deny without interrupting in shadow; hard-stops still deny", () => {
    const shadow = policy({ mode: "shadow", tools: { deny: ["NotebookEdit"] } });
    const signaled = evaluateTool(shadow, baseInput({ tool_name: "NotebookEdit" }));
    expect(signaled.decision.action).toBe("warn");
    expect(signaled.signaled).toBe(true);
    expect(signaled.configured_action).toBe("deny");
    expect(signaled.pending_stop).toBe(false);

    const dangerous = evaluateTool(
      shadow,
      baseInput({ tool_name: "Bash", tool_input: { command: "rm -rf /" } }),
    );
    expect(dangerous.decision.action).toBe("deny");
    expect(dangerous.decision.reason_code).toBe("DANGEROUS_COMMAND");
  });

  it("logs detector.signaled for exact-repeat in shadow and does not trip", () => {
    const shadow = compilePolicy({
      ...getPreset("standard"),
      mode: "shadow",
      behavior: { exact_repeat: { threshold: 3, window: 12, action: "deny" } },
    }).policy;
    const cwd = gitInit(tempDir("sh-det-"));
    const dir = join(cwd, "run");
    writePolicy(dir, shadow);
    const run: RunRecord = {
      run_id: "shadow-loop",
      created_at: new Date().toISOString(),
      cwd,
      home: join(cwd, ".fusecap"),
      policy_digest: shadow.digest,
      policy_id: shadow.policy_id,
      adapter: { name: "claude-code", version: "0.1.0" },
      state: "PROTECTED",
      health: "protected",
      health_reasons: [],
      claude_available: false,
      launched_command: ["test"],
    };
    writeRun(dir, run);
    writeFileSync(join(dir, "checkpoint.json"), JSON.stringify({ verified: true, files: [] }));
    handleHook(JSON.stringify(sessionStartFixture), dir);
    const bash = {
      ...sessionStartFixture,
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "pytest tests/test_flaky.py" },
      tool_use_id: "t1",
    };
    for (let i = 0; i < 4; i += 1) {
      const result = handleHook(JSON.stringify({ ...bash, tool_use_id: `t${i}` }), dir);
      if (i >= 2) {
        expect(result.response.hookSpecificOutput?.permissionDecision).toBe("allow");
      }
    }
    const events = Journal.open(dir).list();
    expect(events.some((event) => event.type === "detector.signaled")).toBe(true);
    expect(events.some((event) => event.type === "fuse.tripped")).toBe(false);
  });

  it("spike / enforce still hard-stops the five synthetic trips", () => {
    const enforce = compilePolicy(getPreset("spike")).policy;
    expect(enforce.mode).toBe("enforce");
    const deny = evaluateTool(enforce, baseInput({ tool_name: "NotebookEdit" }));
    expect(deny.decision.action).toBe("deny");
  });

  it("explains how to flip enforce", () => {
    const explained = explainPolicy(compilePolicy(getPreset("standard")).policy);
    expect(explained).toMatch(/Shadow mode/);
    expect(explained).toMatch(/protect --mode enforce|--preset spike/);
  });
});
