import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { detectClaudeVersion } from "../adapter/versions.js";
import { Journal } from "../journal/journal.js";
import { ensureHome } from "../paths.js";
import { isGitRepo } from "../git/git.js";
import { createCheckpoint } from "../git/checkpoint.js";
import { pidAlive, terminateTree } from "../supervisor/process-tree.js";
import { handleHook } from "../session.js";
import { compilePolicy } from "../policy/compiler.js";
import { getPreset } from "../policy/presets.js";
import { writePolicy, writeRun } from "../session.js";
import { sessionStartFixture, preToolUseBashFixture } from "../adapter/payloads.js";
import type { ComponentHealth, RunRecord } from "../types.js";
import { FUSECAP_VERSION } from "../version.js";

export interface DoctorReport {
  ok: boolean;
  protection_claim: "protected" | "degraded" | "failed";
  components: ComponentHealth[];
}

function which(bin: string): string | null {
  const result = spawnSync("which", [bin], { encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

export async function runDoctor(cwd: string, home: string): Promise<DoctorReport> {
  const components: ComponentHealth[] = [];
  const add = (name: string, ok: boolean, detail: string) => components.push({ name, ok, detail });

  add("node", true, process.version);
  add("fusecap", true, FUSECAP_VERSION);
  add("git", Boolean(which("git")), which("git") ?? "git not on PATH");
  add("repository", isGitRepo(cwd), isGitRepo(cwd) ? cwd : "cwd is not a git worktree");

  const claudePath = which("claude");
  let claudeVersion: string | null = null;
  if (claudePath) {
    const probe = spawnSync("claude", ["--version"], { encoding: "utf8" });
    claudeVersion = detectClaudeVersion(`${probe.stdout}\n${probe.stderr}`);
  }
  add(
    "claude_cli",
    true,
    claudePath
      ? `found ${claudePath}${claudeVersion ? ` (${claudeVersion})` : ""}`
      : "absent — synthetic stub is the documented CI path",
  );

  const paths = ensureHome(home);
  try {
    const journal = Journal.open(join(paths.runs, "_doctor"));
    journal.append({ run_id: "doctor", type: "doctor.ping", payload: { ok: true } });
    add("journal", true, journal.filePath);
  } catch (error) {
    add("journal", false, (error as Error).message);
  }

  if (isGitRepo(cwd)) {
    try {
      const ckpt = createCheckpoint(cwd, "doctor");
      add("checkpoint", ckpt.verified, `${ckpt.files.length} dirty/untracked paths hashed; worktree untouched`);
    } catch (error) {
      add("checkpoint", false, (error as Error).message);
    }
  } else {
    add("checkpoint", false, "skipped — no repository");
  }

  try {
    const child = spawn(process.execPath, ["-e", "setTimeout(()=>{}, 20000)"], {
      detached: true,
      stdio: "ignore",
    });
    const pid = child.pid;
    if (!pid) throw new Error("failed to spawn doctor child");
    child.unref();
    const result = await terminateTree(pid, 200);
    add("terminate", !pidAlive(pid), result.forced ? "force-killed" : "graceful SIGTERM");
  } catch (error) {
    add("terminate", false, (error as Error).message);
  }

  try {
    const dir = join(paths.runs, "_doctor-hook");
    const compiled = compilePolicy(getPreset("spike"));
    writePolicy(dir, compiled.policy);
    const run: RunRecord = {
      run_id: "doctor-hook",
      created_at: new Date().toISOString(),
      cwd,
      home,
      policy_digest: compiled.policy.digest,
      policy_id: compiled.policy.policy_id,
      adapter: { name: "claude-code", version: "0.1.0" },
      state: "PROTECTED",
      health: "protected",
      health_reasons: [],
      claude_available: Boolean(claudePath),
      launched_command: ["doctor"],
    };
    writeRun(dir, run);
    writeFileSync(join(dir, "checkpoint.json"), JSON.stringify({ verified: true, files: [] }));
    handleHook(JSON.stringify(sessionStartFixture), dir);
    const tool = handleHook(JSON.stringify(preToolUseBashFixture), dir);
    add(
      "hook_roundtrip",
      tool.response.hookSpecificOutput?.hookEventName === "PreToolUse",
      `PreToolUse decision in ${tool.latency_ms}ms`,
    );
  } catch (error) {
    add("hook_roundtrip", false, (error as Error).message);
  }

  const settings = join(cwd, ".claude", "settings.local.json");
  add(
    "hooks_installed",
    existsSync(settings) && readIf(settings).includes("hook"),
    existsSync(settings) ? settings : "run fusecap init (hooks missing — protection would be degraded)",
  );

  const failed = components.filter((c) => !c.ok && c.name !== "claude_cli");
  const degraded = !existsSync(settings) || !isGitRepo(cwd) || !claudePath;
  const protection_claim = failed.length ? "failed" : degraded ? "degraded" : "protected";
  return { ok: failed.length === 0, protection_claim, components };
}

function readIf(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}
