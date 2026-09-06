import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseArgs, passthroughOf } from "../src/commands/args.js";
import {
  buildClaudeLaunchSpec,
  isClaudeLauncherToken,
  isPrintMode,
  normalizeClaudePassthrough,
  stdioModeForClaudeArgs,
} from "../src/commands/launch.js";
import { runSupervised } from "../src/commands/run.js";
import { gitInit, tempDir, writePolicyFile } from "./helpers.js";
import { readRun } from "../src/session.js";
import { runDir } from "../src/paths.js";

describe("argv parse + -- claude compat", () => {
  it("treats tokens after -- as Claude args, including a documented leading claude", () => {
    const parsed = parseArgs([
      "node",
      "cli",
      "run",
      "--preset",
      "spike",
      "--",
      "claude",
      "-p",
      "must call Bash exactly once",
      "--allowedTools",
      "Bash",
      "--permission-mode",
      "bypassPermissions",
    ]);
    expect(parsed.command).toBe("run");
    expect(parsed.flags.preset).toBe("spike");
    expect(passthroughOf(parsed.flags)).toEqual([
      "claude",
      "-p",
      "must call Bash exactly once",
      "--allowedTools",
      "Bash",
      "--permission-mode",
      "bypassPermissions",
    ]);
  });

  it("does not steal Claude flags that appear after --", () => {
    const parsed = parseArgs(["node", "cli", "run", "--", "-p", "hi", "--allowedTools", "Bash"]);
    expect(passthroughOf(parsed.flags)).toEqual(["-p", "hi", "--allowedTools", "Bash"]);
    expect(parsed.flags.allowedTools).toBeUndefined();
  });
});

describe("normalizeClaudePassthrough", () => {
  it("strips a leading claude token so the binary is not doubled", () => {
    const bin = "/opt/homebrew/bin/claude";
    const result = normalizeClaudePassthrough(["claude", "-p", "hello", "--allowedTools", "Bash"], bin);
    expect(result.stripped).toEqual(["claude"]);
    expect(result.args).toEqual(["-p", "hello", "--allowedTools", "Bash"]);
  });

  it("strips an absolute path that matches which(claude)", () => {
    const bin = "/usr/local/bin/claude";
    const result = normalizeClaudePassthrough([bin, "-p", "hello"], bin);
    expect(result.stripped).toEqual([bin]);
    expect(result.args).toEqual(["-p", "hello"]);
  });

  it("leaves already-correct -p argv untouched", () => {
    const result = normalizeClaudePassthrough(["-p", "hello"], "/opt/homebrew/bin/claude");
    expect(result.stripped).toEqual([]);
    expect(result.args).toEqual(["-p", "hello"]);
  });

  it("turns documented `fusecap run -- claude` into an interactive session", () => {
    const spec = buildClaudeLaunchSpec({
      claudeBin: "/opt/homebrew/bin/claude",
      passthrough: ["claude"],
    });
    expect(spec.command).toBe("/opt/homebrew/bin/claude");
    expect(spec.args).toEqual([]);
    expect(spec.stdio_mode).toBe("interactive");
    expect(spec.stripped_leading_claude).toEqual(["claude"]);
  });

  it("does not treat claude-stub or flag values as the launcher", () => {
    expect(isClaudeLauncherToken("claude-stub")).toBe(false);
    expect(isClaudeLauncherToken("-p")).toBe(false);
    expect(isClaudeLauncherToken("--print")).toBe(false);
    const result = normalizeClaudePassthrough(["-p", "claude"], "/bin/claude");
    expect(result.args).toEqual(["-p", "claude"]);
  });

  it("detects print vs interactive stdio mode", () => {
    expect(isPrintMode(["-p", "hi"])).toBe(true);
    expect(isPrintMode(["--print=hi"])).toBe(true);
    expect(isPrintMode([])).toBe(false);
    expect(stdioModeForClaudeArgs(["-p", "hi"])).toBe("print");
    expect(stdioModeForClaudeArgs([])).toBe("interactive");
  });
});

describe("runSupervised launched_command", () => {
  it("records a de-duplicated launched_command when PATH has a fake claude", async () => {
    const cwd = gitInit(tempDir("launch-"));
    const home = join(cwd, ".fusecap");
    const bin = join(cwd, "bin");
    mkdirSync(bin, { recursive: true });
    const fake = join(bin, "claude");
    writeFileSync(fake, "#!/bin/sh\nexit 0\n");
    chmodSync(fake, 0o755);
    const policyPath = writePolicyFile(home, {
      runtime: {
        max_elapsed_seconds: 5,
        graceful_stop_seconds: 1,
        force_kill: true,
        require_hooks: false,
        hook_handshake_seconds: 1,
      },
      git: { checkpoint_required: true },
    });
    const previousPath = process.env.PATH;
    process.env.PATH = `${bin}:${previousPath ?? "/usr/bin:/bin"}`;
    try {
      const result = await runSupervised({
        cwd,
        home,
        policyPath,
        claudeArgs: ["claude", "-p", "echo hello", "--allowedTools", "Bash"],
      });
      const record = readRun(runDir(home, result.run_id));
      expect(record.launched_command[0]).toBe(fake);
      expect(record.launched_command.slice(1)).toEqual(["-p", "echo hello", "--allowedTools", "Bash"]);
      expect(record.launched_command.slice(1)).not.toContain("claude");
      expect(record.stripped_leading_claude).toEqual(["claude"]);
      expect(record.signal_class).toBe("live-claude");
    } finally {
      process.env.PATH = previousPath;
    }
  });
});
