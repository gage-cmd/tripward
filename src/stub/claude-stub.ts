#!/usr/bin/env node
import { handleHook } from "../session.js";
import {
  postToolUseFixture,
  preToolUseBashFixture,
  preToolUseDangerousRmFixture,
  preToolUseDeniedToolFixture,
  preToolUseExactLoopFixture,
  sessionEndFixture,
  sessionStartFixture,
} from "../adapter/payloads.js";

export type StubScenario =
  | "healthy"
  | "time"
  | "hook-block"
  | "exact-loop"
  | "dangerous"
  | "hang"
  | "stubborn";

function scenario(): StubScenario {
  const value = (process.env.FUSECAP_STUB_SCENARIO ?? "healthy") as StubScenario;
  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runClaudeStub(): Promise<void> {
  const mode = scenario();
  handleHook(JSON.stringify(sessionStartFixture));

  if (mode === "hang") {
    await sleep(60_000);
    return;
  }
  if (mode === "stubborn") {
    process.on("SIGTERM", () => {
      process.stderr.write("stub: ignoring SIGTERM\n");
    });
    await sleep(60_000);
    return;
  }
  if (mode === "time") {
    await sleep(Number(process.env.FUSECAP_STUB_SLEEP_MS ?? "400"));
    handleHook(JSON.stringify(preToolUseBashFixture));
    handleHook(JSON.stringify(sessionEndFixture));
    return;
  }
  if (mode === "hook-block") {
    const result = handleHook(JSON.stringify(preToolUseDeniedToolFixture));
    if (result.response.hookSpecificOutput?.permissionDecision === "deny") {
      process.stderr.write("stub: tool blocked\n");
    }
    handleHook(JSON.stringify(sessionEndFixture));
    return;
  }
  if (mode === "dangerous") {
    handleHook(JSON.stringify(preToolUseDangerousRmFixture));
    handleHook(JSON.stringify(sessionEndFixture));
    return;
  }
  if (mode === "exact-loop") {
    for (let i = 0; i < 6; i += 1) {
      const payload = {
        ...preToolUseExactLoopFixture,
        tool_use_id: `${preToolUseExactLoopFixture.tool_use_id}_${i}`,
      };
      handleHook(JSON.stringify(payload));
    }
    handleHook(JSON.stringify(sessionEndFixture));
    return;
  }

  handleHook(JSON.stringify(preToolUseBashFixture));
  handleHook(JSON.stringify({ ...preToolUseBashFixture, tool_name: "Read", tool_input: { file_path: "README.md" }, tool_use_id: "toolu_read1" }));
  handleHook(JSON.stringify(postToolUseFixture));
  handleHook(JSON.stringify(sessionEndFixture));
}

const invokedDirectly =
  process.env.FUSECAP_STUB === "1" || process.argv.some((arg) => arg.includes("claude-stub"));
if (invokedDirectly) {
  runClaudeStub().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
