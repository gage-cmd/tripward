import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RepeatObservation } from "./loop/detector.js";
import { Journal } from "./journal/journal.js";
import { evaluateTool } from "./policy/evaluator.js";
import type { ClaudeHookInput } from "./adapter/hooks.js";
import { hookResponseFor } from "./adapter/hooks.js";
import { markHandshake, requestStop } from "./supervisor/supervisor.js";
import type { EffectivePolicy, ExitReason, ProtectionHealth, RunRecord } from "./types.js";

export const RUN_META = "run.json";

export function writeRun(runDirectory: string, record: RunRecord): void {
  mkdirSync(runDirectory, { recursive: true });
  writeFileSync(join(runDirectory, RUN_META), `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
}

export function readRun(runDirectory: string): RunRecord {
  return JSON.parse(readFileSync(join(runDirectory, RUN_META), "utf8")) as RunRecord;
}

export function writePolicy(runDirectory: string, policy: EffectivePolicy): void {
  mkdirSync(runDirectory, { recursive: true });
  writeFileSync(join(runDirectory, "policy.frozen.json"), `${JSON.stringify(policy, null, 2)}\n`, {
    mode: 0o600,
  });
}

export function readPolicy(runDirectory: string): EffectivePolicy {
  return JSON.parse(readFileSync(join(runDirectory, "policy.frozen.json"), "utf8")) as EffectivePolicy;
}

export function writeActive(home: string, runId: string, runDirectory: string): void {
  writeFileSync(join(home, "active-run.json"), JSON.stringify({ run_id: runId, run_dir: runDirectory }), {
    mode: 0o600,
  });
}

export function readActive(home: string): { run_id: string; run_dir: string } | null {
  const path = join(home, "active-run.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as { run_id: string; run_dir: string };
}

export function resolveRunDir(env = process.env): string {
  if (env.FUSECAP_RUN_DIR) return env.FUSECAP_RUN_DIR;
  if (env.FUSECAP_HOME) {
    const active = readActive(env.FUSECAP_HOME);
    if (active) return active.run_dir;
  }
  throw new Error("No active FuseCap run (FUSECAP_RUN_DIR unset). Hooks fail visibly.");
}

function reasonToExit(reason: string): ExitReason {
  switch (reason) {
    case "TIME_FUSE":
      return "time_fuse";
    case "TOOL_DENIED":
      return "hook_block";
    case "EXACT_REPEAT_LIMIT":
      return "exact_loop";
    case "DANGEROUS_COMMAND":
      return "dangerous_command";
    case "HOOKS_BYPASSED":
      return "hooks_bypassed";
    default:
      return "terminated";
  }
}

export function handleHook(raw: string, runDirectory = resolveRunDir()): {
  response: ReturnType<typeof hookResponseFor>;
  latency_ms: number;
} {
  const started = Date.now();
  const input: ClaudeHookInput = JSON.parse(raw) as ClaudeHookInput;
  if (!input.hook_event_name) {
    throw new Error("HOOK_INPUT_UNSUPPORTED: missing hook_event_name");
  }
  const journal = Journal.open(runDirectory);
  const policy = readPolicy(runDirectory);
  const run = readRun(runDirectory);

  if (input.hook_event_name === "SessionStart") {
    markHandshake(runDirectory, input.session_id);
    journal.append({
      run_id: run.run_id,
      type: "run.armed",
      adapter_event_id: input.session_id,
      payload: { session_id: input.session_id, source: input.source ?? null },
    });
    const latency = Date.now() - started;
    journal.append({
      run_id: run.run_id,
      type: "adapter.latency",
      payload: { event: "SessionStart", latency_ms: latency },
    });
    return { response: hookResponseFor("SessionStart", "allow", "Session associated"), latency_ms: latency };
  }

  if (input.hook_event_name === "SessionEnd") {
    journal.append({
      run_id: run.run_id,
      type: "run.session_end",
      payload: { reason: input.reason ?? "complete" },
    });
    return { response: hookResponseFor("SessionEnd", "allow", "Session ended"), latency_ms: Date.now() - started };
  }

  if (input.hook_event_name === "PostToolUse" || input.hook_event_name === "PostToolUseFailure") {
    journal.append({
      run_id: run.run_id,
      type: input.hook_event_name === "PostToolUse" ? "tool.completed" : "tool.failed",
      adapter_event_id: input.tool_use_id,
      payload: { tool_name: input.tool_name, tool_use_id: input.tool_use_id },
    });
    return {
      response: hookResponseFor(input.hook_event_name, "allow", "Observed"),
      latency_ms: Date.now() - started,
    };
  }

  if (input.hook_event_name !== "PreToolUse") {
    journal.append({
      run_id: run.run_id,
      type: "adapter.quarantined",
      payload: { hook_event_name: input.hook_event_name },
    });
    return {
      response: hookResponseFor(input.hook_event_name, "allow", "Unknown event quarantined"),
      latency_ms: Date.now() - started,
    };
  }

  const requested = journal.append({
    run_id: run.run_id,
    type: "tool.requested",
    adapter_event_id: input.tool_use_id,
    payload: {
      tool_name: input.tool_name,
      tool_use_id: input.tool_use_id,
    },
  });

  const history: RepeatObservation[] = journal
    .list()
    .filter((event) => event.type === "policy.evaluated" && typeof event.payload.normalized_signature === "string")
    .map((event) => ({
      event_id: event.event_id,
      signature: String(event.payload.normalized_signature),
    }));

  const startedAt = Date.parse(run.created_at);
  const elapsed_seconds = Math.max(0, (Date.now() - startedAt) / 1000);
  const tools_used = journal.findByType("tool.requested").length - (requested.duplicate ? 0 : 1);
  const health: ProtectionHealth = run.health;

  const evaluation = evaluateTool(policy, {
    run_id: run.run_id,
    event_id: requested.event.event_id,
    tool_name: input.tool_name ?? "Unknown",
    tool_input: input.tool_input ?? {},
    elapsed_seconds,
    tools_used,
    repeat_history: history,
    journal_available: true,
    hooks_healthy: health !== "failed",
    checkpoint_verified: !policy.git.checkpoint_required || existsSync(join(runDirectory, "checkpoint.json")),
  });

  journal.append({
    run_id: run.run_id,
    type: "policy.evaluated",
    adapter_event_id: `${input.tool_use_id}:decision`,
    payload: {
      action: evaluation.decision.action,
      reason_code: evaluation.decision.reason_code,
      display_reason: evaluation.decision.display_reason,
      normalized_signature: evaluation.features.normalized_signature,
      matched_rule_ids: evaluation.decision.matched_rule_ids,
      evidence_refs: evaluation.decision.evidence_refs,
      decision_id: evaluation.decision.decision_id,
    },
  });

  if (evaluation.decision.action === "deny") {
    journal.append({
      run_id: run.run_id,
      type: "tool.blocked",
      payload: { reason_code: evaluation.decision.reason_code, tool_name: input.tool_name },
    });
  } else if (evaluation.decision.action === "allow" || evaluation.decision.action === "warn") {
    journal.append({
      run_id: run.run_id,
      type: "tool.allowed",
      payload: { reason_code: evaluation.decision.reason_code, tool_name: input.tool_name },
    });
  }

  if (evaluation.pending_stop || evaluation.decision.action === "terminate" || evaluation.decision.action === "graceful_stop") {
    const exit = reasonToExit(evaluation.decision.reason_code);
    journal.append({
      run_id: run.run_id,
      type: "fuse.tripped",
      payload: {
        reason: exit,
        reason_code: evaluation.decision.reason_code,
        count: evaluation.decision.evidence_refs.length,
        observed: elapsed_seconds,
      },
    });
    requestStop(runDirectory, exit, evaluation.decision.display_reason);
  } else if (evaluation.decision.action === "deny" && evaluation.decision.reason_code === "DANGEROUS_COMMAND") {
    journal.append({
      run_id: run.run_id,
      type: "fuse.tripped",
      payload: { reason: "dangerous_command", reason_code: evaluation.decision.reason_code },
    });
  } else if (evaluation.decision.action === "deny" && evaluation.decision.reason_code === "TOOL_DENIED") {
    journal.append({
      run_id: run.run_id,
      type: "fuse.tripped",
      payload: { reason: "hook_block", reason_code: evaluation.decision.reason_code },
    });
  } else if (evaluation.decision.action === "deny" && evaluation.decision.reason_code === "EXACT_REPEAT_LIMIT") {
    journal.append({
      run_id: run.run_id,
      type: "fuse.tripped",
      payload: {
        reason: "exact_loop",
        reason_code: evaluation.decision.reason_code,
        count: evaluation.decision.evidence_refs.length,
      },
    });
  }

  const latency = Date.now() - started;
  journal.append({
    run_id: run.run_id,
    type: "adapter.latency",
    adapter_event_id: `${input.tool_use_id}:latency`,
    payload: { event: "PreToolUse", latency_ms: latency },
  });

  return {
    response: hookResponseFor("PreToolUse", evaluation.decision.action, evaluation.decision.display_reason),
    latency_ms: latency,
  };
}
