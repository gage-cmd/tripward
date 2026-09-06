import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runSupervised } from "../src/commands/run.js";
import { gitInit, tempDir, writePolicyFile } from "./helpers.js";

async function synthetic(scenario: string, runtime: Record<string, unknown> = {}) {
  const cwd = gitInit(tempDir("gate-"));
  const home = join(cwd, ".fusecap");
  const policyPath = writePolicyFile(home, {
    tools: { deny: ["NotebookEdit"], max_total: 40 },
    runtime: {
      max_elapsed_seconds: 30,
      graceful_stop_seconds: 1,
      force_kill: true,
      require_hooks: true,
      hook_handshake_seconds: 8,
      ...runtime,
    },
    behavior: { exact_repeat: { threshold: 5, window: 12, action: "terminate" } },
  });
  const result = await runSupervised({
    cwd,
    home,
    policyPath,
    stub: true,
    stubScenario: scenario,
  });
  const receipt = JSON.parse(readFileSync(result.receipt_json, "utf8")) as {
    exit_reason: string;
    usage: { cost: null; source: string };
    integrity: { content_digest: string };
    trigger: { rule: string } | null;
    timeline: unknown[];
  };
  return { result, receipt };
}

describe("72h spike exit gate — five synthetic trips", () => {
  it("T1 time fuse trips after the configured wall-clock and seals a receipt", async () => {
    const { result, receipt } = await synthetic("hang", { max_elapsed_seconds: 1 });
    expect(result.exit_reason).toBe("time_fuse");
    expect(receipt.trigger?.rule).toMatch(/max_elapsed/);
    expect(receipt.integrity.content_digest).toMatch(/^sha256:/);
    expect(receipt.usage.cost).toBeNull();
    expect(receipt.usage.source).toBe("unavailable");
  });

  it("T2 hook block denies a matched tool before execution", async () => {
    const { result, receipt } = await synthetic("hook-block");
    expect(result.exit_reason).toBe("hook_block");
    expect(JSON.stringify(receipt)).toMatch(/TOOL_DENIED|NotebookEdit/);
  });

  it("T3 exact loop trips on repeated identical tool+args", async () => {
    const { result, receipt } = await synthetic("exact-loop");
    expect(result.exit_reason).toBe("exact_loop");
    expect(JSON.stringify(receipt)).toMatch(/EXACT_REPEAT|exact/);
  });

  it("T4 dangerous command is blocked before execution", async () => {
    const { result, receipt } = await synthetic("dangerous");
    expect(result.exit_reason).toBe("dangerous_command");
    expect(JSON.stringify(receipt)).toMatch(/DANGEROUS_COMMAND/);
  });

  it("T5 terminate performs graceful then force kill of the supervised tree", async () => {
    const { result, receipt } = await synthetic("stubborn", {
      max_elapsed_seconds: 1,
      graceful_stop_seconds: 0.15,
    });
    expect(result.exit_reason).toBe("time_fuse");
    expect(JSON.stringify(receipt.timeline)).toMatch(/supervisor\.stopp/);
  });
});

describe("72h spike supporting proofs", () => {
  it("healthy stub session completes with a clean receipt and no invented USD", async () => {
    const { result, receipt } = await synthetic("healthy");
    expect(result.exit_reason).toBe("completed");
    expect(receipt.usage.cost).toBeNull();
    expect(JSON.stringify(receipt)).not.toMatch(/"cost":\s*[1-9]/);
  });
});
