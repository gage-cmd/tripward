import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
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
import { isLegacyHomeDir } from "../brand.js";
import { TRIPWARD_VERSION } from "../version.js";
import { listedBackups } from "./installer.js";
import { loadManifest, verifyBackup } from "./backup.js";
import { chmodNeverBroader, formatMode, HOME_MODE, modeOf } from "./permissions.js";

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

function readIf(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function inspectSandbox(cwd: string): { ok: boolean; detail: string } {
  const settingsPaths = [
    join(cwd, ".claude", "settings.local.json"),
    join(cwd, ".claude", "settings.json"),
  ];
  const found: string[] = [];
  let enabled: boolean | null = null;
  for (const path of settingsPaths) {
    if (!existsSync(path)) continue;
    const raw = readIf(path);
    found.push(path);
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const sandbox = parsed.sandbox;
      if (sandbox && typeof sandbox === "object") {
        const rec = sandbox as Record<string, unknown>;
        if (rec.enabled === true) enabled = true;
        if (rec.enabled === false && enabled !== true) enabled = false;
      }
      if (parsed.sandbox === true) enabled = true;
    } catch {
      // ignore unreadable settings
    }
  }
  if (enabled === true) {
    return {
      ok: true,
      detail: `native Claude sandbox appears enabled (${found.join(", ")}). Tripward does not independently enforce OS isolation.`,
    };
  }
  if (enabled === false) {
    return {
      ok: true,
      detail: "native Claude sandbox is present and disabled. Tripward reports posture only — enable it for OS-level isolation.",
    };
  }
  return {
    ok: true,
    detail:
      found.length > 0
        ? `settings present; native sandbox key not observed. Tripward is not a host sandbox (Ch 20).`
        : "no Claude settings yet — sandbox posture unknown. Run tripward init; enable Claude native sandbox where compatible.",
  };
}

export async function runDoctor(cwd: string, home: string): Promise<DoctorReport> {
  const components: ComponentHealth[] = [];
  const add = (name: string, ok: boolean, detail: string) => components.push({ name, ok, detail });

  add("node", true, process.version);
  add("tripward", true, TRIPWARD_VERSION);
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
    chmodNeverBroader(home, HOME_MODE);
    const mode = formatMode(modeOf(home));
    add(
      "storage_home",
      mode === "700",
      isLegacyHomeDir(home)
        ? `home mode ${mode} (want 700); using leftover .fusecap — new installs write .tripward`
        : `home mode ${mode} (want 700)`,
    );
  } catch (error) {
    add("storage_home", false, (error as Error).message);
  }

  try {
    const journal = Journal.open(join(paths.runs, "_doctor"));
    journal.append({ run_id: "doctor", type: "doctor.ping", payload: { ok: true } });
    const stat = statSync(journal.filePath);
    const mode = (stat.mode & 0o777).toString(8).padStart(3, "0");
    add("journal", true, `${journal.filePath} mode ${mode}; append+reopen ok`);
  } catch (error) {
    add("journal", false, (error as Error).message);
  }

  if (isGitRepo(cwd)) {
    try {
      const ckpt = createCheckpoint(cwd, "doctor");
      add("git_posture", ckpt.verified, `${ckpt.files.length} dirty/untracked paths hashed; worktree untouched; head ${ckpt.head.slice(0, 8)}`);
      add("checkpoint", ckpt.verified, `${ckpt.files.length} paths; starting_digest ${ckpt.starting_digest}`);
    } catch (error) {
      add("git_posture", false, (error as Error).message);
      add("checkpoint", false, (error as Error).message);
    }
  } else {
    add("git_posture", false, "skipped — no repository");
    add("checkpoint", false, "skipped — no repository");
  }

  const sandbox = inspectSandbox(cwd);
  add("sandbox_posture", sandbox.ok, sandbox.detail);

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
    existsSync(settings) ? settings : "run tripward init (hooks missing — protection would be degraded)",
  );

  const backups = listedBackups(home);
  const manifest = loadManifest(paths.backups);
  if (manifest.entries.length === 0) {
    add(
      "backups",
      true,
      existsSync(settings) ? "no pre-install settings backup (file was created by Tripward or absent)" : "no backups yet",
    );
  } else {
    const failed = backups.map(verifyBackup).filter((item) => !item.ok);
    add(
      "backups",
      failed.length === 0,
      failed.length === 0
        ? `${backups.length} verified backup(s)`
        : failed.map((item) => item.detail).join("; "),
    );
  }

  const failed = components.filter((c) => !c.ok && c.name !== "claude_cli");
  const degraded = !existsSync(settings) || !isGitRepo(cwd) || !claudePath;
  const protection_claim = failed.length ? "failed" : degraded ? "degraded" : "protected";
  return { ok: failed.length === 0, protection_claim, components };
}

export function formatDoctorReport(report: DoctorReport): string {
  const width = Math.max(12, ...report.components.map((c) => c.name.length));
  const lines = [
    `Tripward doctor ${TRIPWARD_VERSION}`,
    "",
    "Check".padEnd(width + 2) + "Result  Detail",
    "-".repeat(width + 2) + "------  ------",
  ];
  for (const component of report.components) {
    const mark = component.ok ? "PASS" : "FAIL";
    lines.push(`${component.name.padEnd(width + 2)}${mark}    ${component.detail}`);
  }
  lines.push("");
  lines.push(
    report.ok
      ? `OVERALL  PASS  protection_claim=${report.protection_claim}`
      : `OVERALL  FAIL  protection_claim=${report.protection_claim}`,
  );
  if (report.protection_claim === "degraded") {
    lines.push("Note: PASS here means exercised checks succeeded. Protection is still degraded until Claude CLI + git + hooks are all present.");
  }
  if (!report.ok) {
    lines.push("Fix every FAIL before asking a stranger to trust a protected session.");
  }
  return lines.join("\n");
}
