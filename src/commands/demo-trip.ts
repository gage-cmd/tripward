import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  preToolUseDeniedToolFixture,
  preToolUseExactLoopFixture,
  preToolUseGitResetHardFixture,
  sessionEndFixture,
  sessionStartFixture,
} from "../adapter/payloads.js";
import { createCheckpoint, writeCheckpoint } from "../git/checkpoint.js";
import { isGitRepo } from "../git/git.js";
import { Journal } from "../journal/journal.js";
import { applyPolicyMode, compilePolicy } from "../policy/compiler.js";
import { getPreset } from "../policy/presets.js";
import { buildReceipt, writeReceipt } from "../receipt/builder.js";
import { newRunId } from "../ids.js";
import { ensureHome, runDir } from "../paths.js";
import { handleHook, writeActive, writePolicy, writeRun } from "../session.js";
import type { EffectivePolicy, ExitReason, ProtectionHealth, RunRecord } from "../types.js";
import { ENV, LEGACY_ENV } from "../brand.js";
import { TRIPWARD_VERSION } from "../version.js";

export const DEMO_TRIP_KINDS = ["dangerous", "exact-loop", "hook-block"] as const;
export type DemoTripKind = (typeof DEMO_TRIP_KINDS)[number];

export const DEMO_TRIP_BANNER =
  "OPERATOR-INJECTED DEMO — PreToolUse was not issued by Claude Code. Not a stub CI trip. Does not count as alpha legitimate signal.";

export interface DemoTripOptions {
  cwd: string;
  home: string;
  kind?: DemoTripKind;
  preset?: string;
  mode?: "shadow" | "enforce";
}

function loadPolicy(options: DemoTripOptions): EffectivePolicy {
  const raw = getPreset(options.preset ?? "spike");
  return compilePolicy(options.mode ? applyPolicyMode(raw, options.mode) : raw).policy;
}

function injectKind(kind: DemoTripKind): void {
  handleHook(JSON.stringify(sessionStartFixture));
  if (kind === "dangerous") {
    handleHook(JSON.stringify(preToolUseGitResetHardFixture));
  } else if (kind === "hook-block") {
    handleHook(JSON.stringify(preToolUseDeniedToolFixture));
  } else {
    for (let i = 0; i < 6; i += 1) {
      handleHook(
        JSON.stringify({
          ...preToolUseExactLoopFixture,
          tool_use_id: `${preToolUseExactLoopFixture.tool_use_id}_${i}`,
        }),
      );
    }
  }
  handleHook(JSON.stringify(sessionEndFixture));
}

export async function runDemoTrip(options: DemoTripOptions): Promise<{
  run_id: string;
  exit_reason: ExitReason;
  receipt_json: string;
  health: ProtectionHealth;
  kind: DemoTripKind;
  signal_class: "operator-injected-demo";
}> {
  const kind = options.kind ?? "dangerous";
  if (!DEMO_TRIP_KINDS.includes(kind)) {
    throw new Error(`demo-trip kind must be one of: ${DEMO_TRIP_KINDS.join(", ")}`);
  }
  const home = ensureHome(options.home).home;
  const policy = loadPolicy(options);
  const runId = newRunId();
  const dir = runDir(home, runId);
  mkdirSync(dir, { recursive: true });
  const journal = Journal.open(dir);
  journal.append({
    run_id: runId,
    type: "run.preflight_started",
    payload: { cwd: options.cwd, version: TRIPWARD_VERSION, demo_trip: true, kind },
  });

  const health_reasons = [
    DEMO_TRIP_BANNER,
    "Claude Code was not launched; handleHook evaluated operator-injected fixtures.",
  ];
  const health: ProtectionHealth = "degraded";

  if (policy.git.checkpoint_required && !isGitRepo(options.cwd)) {
    journal.append({
      run_id: runId,
      type: "run.preflight_failed",
      payload: { reason: "checkpoint required but cwd is not a git repository" },
    });
    throw new Error("PREFLIGHT: checkpoint required but cwd is not a git repository");
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
    state: "PROTECTED",
    health,
    health_reasons,
    claude_available: false,
    launched_command: ["tripward", "demo-trip", "--kind", kind],
    signal_class: "operator-injected-demo",
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

  journal.append({
    run_id: runId,
    type: "run.armed",
    payload: { health, signal_class: "operator-injected-demo", kind },
  });

  const previousCurrent = process.env[ENV.RUN_DIR];
  const previousLegacy = process.env[LEGACY_ENV.RUN_DIR];
  process.env[ENV.RUN_DIR] = dir;
  process.env[LEGACY_ENV.RUN_DIR] = dir;
  try {
    injectKind(kind);
  } finally {
    if (previousCurrent === undefined) delete process.env[ENV.RUN_DIR];
    else process.env[ENV.RUN_DIR] = previousCurrent;
    if (previousLegacy === undefined) delete process.env[LEGACY_ENV.RUN_DIR];
    else process.env[LEGACY_ENV.RUN_DIR] = previousLegacy;
  }

  journal.syncFromDisk();
  let exitReason: ExitReason = "completed";
  const trip = journal.findByType("fuse.tripped").at(-1);
  if (trip && typeof trip.payload.reason === "string") {
    exitReason = trip.payload.reason as ExitReason;
  }

  journal.append({
    run_id: runId,
    type: "run.ended",
    payload: { exit_reason: exitReason, demo_trip: true, kind },
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
    claude_version: null,
    signal_class: "operator-injected-demo",
    launched_binary: "tripward-demo-trip",
  });
  const artifacts = writeReceipt(dir, receipt);
  journal.append({
    run_id: runId,
    type: "receipt.sealed",
    payload: { receipt_id: receipt.receipt_id, digest: receipt.integrity.content_digest, json: artifacts.json },
  });
  writeFileSync(
    resolve(home, "last-run.json"),
    JSON.stringify({ run_id: runId, run_dir: dir, receipt: artifacts.json, signal_class: "operator-injected-demo" }, null, 2),
  );
  return {
    run_id: runId,
    exit_reason: exitReason,
    receipt_json: artifacts.json,
    health,
    kind,
    signal_class: "operator-injected-demo",
  };
}
