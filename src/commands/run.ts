import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { detectClaudeVersion } from "../adapter/versions.js";
import { createCheckpoint, writeCheckpoint } from "../git/checkpoint.js";
import { isGitRepo } from "../git/git.js";
import { Journal } from "../journal/journal.js";
import { compilePolicy } from "../policy/compiler.js";
import { getPreset } from "../policy/presets.js";
import { buildReceipt, writeReceipt } from "../receipt/builder.js";
import { supervise } from "../supervisor/supervisor.js";
import { ensureHome, runDir } from "../paths.js";
import { writeActive, writePolicy, writeRun } from "../session.js";
import { newRunId } from "../ids.js";
import type { EffectivePolicy, ExitReason, PolicyDocument, ProtectionHealth, RunRecord } from "../types.js";
import { FUSECAP_VERSION } from "../version.js";

export interface RunOptions {
  cwd: string;
  home: string;
  policyPath?: string;
  preset?: string;
  stub?: boolean;
  stubScenario?: string;
  extraArgs?: string[];
  claudeArgs?: string[];
}

function loadPolicy(options: RunOptions): EffectivePolicy {
  if (options.policyPath) {
    const raw = JSON.parse(readFileSync(options.policyPath, "utf8")) as unknown;
    return compilePolicy(raw).policy;
  }
  if (options.preset) {
    return compilePolicy(getPreset(options.preset)).policy;
  }
  const defaultPath = resolve(options.home, "policy.json");
  if (existsSync(defaultPath)) {
    return compilePolicy(JSON.parse(readFileSync(defaultPath, "utf8"))).policy;
  }
  return compilePolicy(getPreset("standard")).policy;
}

function whichClaude(): string | null {
  const probe = spawnSync("which", ["claude"], { encoding: "utf8" });
  return probe.status === 0 ? probe.stdout.trim() : null;
}

function stubPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const js = resolve(here, "..", "stub", "claude-stub.js");
  if (existsSync(js)) return js;
  return resolve(here, "..", "stub", "claude-stub.ts");
}

function stubLaunch(stub: string): { command: string; args: string[] } {
  if (stub.endsWith(".js")) {
    return { command: process.execPath, args: [stub] };
  }
  const require = createRequire(import.meta.url);
  const tsx = require.resolve("tsx/cli");
  return { command: process.execPath, args: [tsx, stub] };
}

export async function runSupervised(options: RunOptions): Promise<{
  run_id: string;
  exit_reason: ExitReason;
  receipt_json: string;
  health: ProtectionHealth;
}> {
  const home = ensureHome(options.home).home;
  const policy = loadPolicy(options);
  const runId = newRunId();
  const dir = runDir(home, runId);
  mkdirSync(dir, { recursive: true });
  const journal = Journal.open(dir);
  journal.append({ run_id: runId, type: "run.preflight_started", payload: { cwd: options.cwd, version: FUSECAP_VERSION } });

  const health_reasons: string[] = [];
  let health: ProtectionHealth = "protected";
  const claude = whichClaude();
  if (!claude) {
    health_reasons.push("claude CLI absent; using documented stub");
    if (!options.stub && !options.preset && !options.policyPath) {
      health = "degraded";
    }
  }
  if (!isGitRepo(options.cwd)) {
    health_reasons.push("cwd is not a git repository");
    if (policy.git.checkpoint_required) {
      journal.append({
        run_id: runId,
        type: "run.preflight_failed",
        payload: { reason: "checkpoint required but cwd is not a git repository" },
      });
      throw new Error("PREFLIGHT: checkpoint required but cwd is not a git repository");
    }
    health = "degraded";
  }

  writePolicy(dir, policy);
  const record: RunRecord = {
    run_id: runId,
    created_at: new Date().toISOString(),
    cwd: options.cwd,
    home,
    policy_digest: policy.digest,
    policy_id: policy.policy_id,
    adapter: { name: "claude-code", version: "0.1.0" },
    state: "ARMING",
    health,
    health_reasons,
    claude_available: Boolean(claude),
    launched_command: [],
  };
  writeRun(dir, record);
  writeActive(home, runId, dir);

  let checkpoint;
  if (isGitRepo(options.cwd)) {
    checkpoint = createCheckpoint(options.cwd, runId);
    writeCheckpoint(dir, checkpoint);
    journal.append({
      run_id: runId,
      type: "checkpoint.created",
      payload: {
        checkpoint_id: checkpoint.checkpoint_id,
        dirty: checkpoint.dirty,
        files: checkpoint.files.length,
        starting_digest: checkpoint.starting_digest,
        verified: checkpoint.verified,
      },
    });
  }

  const useStub = options.stub || !claude;
  let command: string;
  let args: string[];
  if (useStub) {
    const launched = stubLaunch(stubPath());
    command = launched.command;
    args = launched.args;
    health_reasons.push(useStub && !options.stub ? "auto-selected stub because claude is absent" : "explicit --stub");
  } else {
    command = claude as string;
    args = options.claudeArgs?.length ? options.claudeArgs : [];
  }

  record.launched_command = [command, ...args];
  record.state = "PROTECTED";
  writeRun(dir, record);
  journal.append({ run_id: runId, type: "run.armed", payload: { command, args, health } });

  const result = await supervise({
    command,
    args,
    cwd: options.cwd,
    env: {
      ...process.env,
      FUSECAP_HOME: home,
      FUSECAP_RUN_DIR: dir,
      FUSECAP_RUN_ID: runId,
      FUSECAP_STUB_SCENARIO: options.stubScenario ?? "healthy",
      FUSECAP_STUB: "1",
    },
    runDir: dir,
    maxElapsedMs: policy.runtime.max_elapsed_seconds * 1000,
    gracefulStopMs: policy.runtime.graceful_stop_seconds * 1000,
    forceKill: policy.runtime.force_kill,
    hookHandshakeMs: policy.runtime.hook_handshake_seconds * 1000,
    requireHooks: policy.runtime.require_hooks,
    onEvent: (type, payload) => {
      journal.append({ run_id: runId, type, payload });
    },
  });

  if (!result.handshake_ok && policy.runtime.require_hooks) {
    health = "failed";
    health_reasons.push("hooks bypassed or SessionStart handshake missing");
  }

  let claudeVersion: string | null = null;
  if (claude) {
    const probe = spawnSync("claude", ["--version"], { encoding: "utf8" });
    claudeVersion = detectClaudeVersion(`${probe.stdout}\n${probe.stderr}`);
  }

  journal.syncFromDisk();
  let exitReason = result.exit_reason;
  const trip = journal.findByType("fuse.tripped").at(-1);
  if (trip && (exitReason === "completed" || exitReason === "unknown")) {
    const reason = trip.payload.reason;
    if (typeof reason === "string") {
      exitReason = reason as ExitReason;
    }
  }

  journal.append({
    run_id: runId,
    type: "run.ended",
    payload: { exit_reason: exitReason, handshake_ok: result.handshake_ok, elapsed_ms: result.elapsed_ms },
  });

  const receipt = buildReceipt({
    run_id: runId,
    started_at: record.created_at,
    ended_at: new Date().toISOString(),
    policy,
    events: journal.list(),
    exit_reason: exitReason,
    health,
    health_reasons,
    checkpoint,
    claude_version: claudeVersion,
  });
  const artifacts = writeReceipt(dir, receipt);
  journal.append({
    run_id: runId,
    type: "receipt.sealed",
    payload: { receipt_id: receipt.receipt_id, digest: receipt.integrity.content_digest, json: artifacts.json },
  });
  writeFileSync(
    resolve(home, "last-run.json"),
    JSON.stringify({ run_id: runId, run_dir: dir, receipt: artifacts.json }, null, 2),
  );
  return { run_id: runId, exit_reason: exitReason, receipt_json: artifacts.json, health };
}

export function parsePolicyFile(path: string): PolicyDocument {
  return JSON.parse(readFileSync(path, "utf8")) as PolicyDocument;
}
