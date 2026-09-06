import { hostname } from "node:os";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { digestObject } from "../digest.js";
import { newReceiptId } from "../ids.js";
import type {
  CheckpointManifest,
  EffectivePolicy,
  ExitReason,
  JournalEvent,
  ProtectionHealth,
  ReceiptDocument,
  ReceiptOutcome,
  ReceiptTrigger,
  SignalClass,
} from "../types.js";
import { TRIPWARD_VERSION, RECEIPT_SCHEMA_VERSION } from "../version.js";
import { writeReceiptHtml } from "./html.js";

export { renderHtml, writeReceiptHtml } from "./html.js";

const USAGE_NOTE =
  "Usage dollars are unavailable for Claude Code subscription traffic. Tripward will not invent USD. Tokens appear only when a separately supported observable API/BYOK boundary is active.";

function outcomeFor(reason: ExitReason, warned: boolean): ReceiptOutcome {
  switch (reason) {
    case "completed":
      return warned ? "warned" : "completed";
    case "hook_block":
    case "dangerous_command":
    case "exact_loop":
      return "blocked";
    case "time_fuse":
    case "terminated":
    case "hooks_bypassed":
      return "terminated";
    case "user_canceled":
      return "user-canceled";
    case "crashed":
    case "preflight_failed":
      return "crashed";
    default:
      return "terminated";
  }
}

function triggerFor(reason: ExitReason, events: JournalEvent[], policy: EffectivePolicy): ReceiptTrigger | null {
  const trip = [...events].reverse().find((event) => event.type === "fuse.tripped" || event.type === "policy.evaluated");
  const payload = (trip?.payload ?? {}) as Record<string, unknown>;
  if (reason === "completed") return null;
  const map: Record<string, ReceiptTrigger> = {
    time_fuse: {
      rule: "runtime.max_elapsed_seconds",
      threshold: policy.runtime.max_elapsed_seconds,
      observed_value: typeof payload.observed === "number" ? payload.observed : undefined,
      confidence: "high",
      action: "graceful_stop+force_kill",
      action_executed: true,
    },
    hook_block: {
      rule: String(payload.reason_code ?? "TOOL_DENIED"),
      confidence: "high",
      action: "deny",
      action_executed: true,
    },
    exact_loop: {
      rule: "behavior.exact_repeat",
      threshold: policy.behavior.exact_repeat.threshold,
      observed_value: typeof payload.count === "number" ? payload.count : undefined,
      confidence: "high",
      action: policy.behavior.exact_repeat.action,
      action_executed: true,
    },
    dangerous_command: {
      rule: "commands.deny_high_confidence",
      confidence: "high",
      action: "deny",
      action_executed: true,
    },
    terminated: {
      rule: "supervisor.terminate",
      confidence: "high",
      action: "terminate",
      action_executed: true,
    },
    hooks_bypassed: {
      rule: "runtime.require_hooks",
      confidence: "high",
      action: "terminate",
      action_executed: true,
    },
  };
  return map[reason] ?? {
    rule: reason,
    confidence: "medium",
    action: "stop",
    action_executed: true,
  };
}

export function buildReceipt(input: {
  run_id: string;
  started_at: string;
  ended_at: string;
  policy: EffectivePolicy;
  events: JournalEvent[];
  exit_reason: ExitReason;
  health: ProtectionHealth;
  health_reasons: string[];
  checkpoint?: CheckpointManifest;
  claude_version: string | null;
  host_label?: string;
  signal_class?: SignalClass;
  launched_binary?: string | null;
}): ReceiptDocument {
  const warned = input.events.some((event) => event.type === "policy.evaluated" && event.payload.action === "warn");
  const timeline = input.events.map((event) => ({
    sequence: event.sequence,
    type: event.type,
    wall_time: event.wall_time,
    monotonic_ms: event.monotonic_ms,
    summary: summarize(event),
  }));
  const draft: Omit<ReceiptDocument, "integrity"> & { integrity?: ReceiptDocument["integrity"] } = {
    schema_version: RECEIPT_SCHEMA_VERSION,
    receipt_id: newReceiptId(),
    run_id: input.run_id,
    sealed_at: input.ended_at,
    identity: {
      repository_fingerprint: input.checkpoint
        ? `${input.checkpoint.repo_root}:${input.checkpoint.head}`
        : "unavailable",
      branch: input.checkpoint?.branch ?? null,
      host_label: input.host_label ?? hostname(),
      started_at: input.started_at,
      ended_at: input.ended_at,
    },
    environment: {
      tripward_version: TRIPWARD_VERSION,
      adapter_version: "0.1.0",
      claude_code_version: input.claude_version,
      os: `${process.platform} ${process.arch}`,
      protection_health: input.health,
      health_reasons: input.health_reasons,
      signal_class: input.signal_class,
      launched_binary: input.launched_binary ?? null,
    },
    policy: {
      policy_id: input.policy.policy_id,
      version: input.policy.version,
      digest: input.policy.digest,
      preset: input.policy.preset,
      enforcement_mode: input.policy.mode,
    },
    outcome: outcomeFor(input.exit_reason, warned),
    exit_reason: input.exit_reason,
    trigger: triggerFor(input.exit_reason, input.events, input.policy),
    timeline,
    repository: {
      checkpoint_intact: Boolean(input.checkpoint?.verified),
      dirty_at_start: Boolean(input.checkpoint?.dirty),
      files_in_manifest: input.checkpoint?.files.length ?? 0,
      final_status: input.exit_reason,
    },
    usage: {
      cost: null,
      currency: null,
      source: "unavailable",
      confidence: "unavailable",
      note: USAGE_NOTE,
    },
    limitations: [
      USAGE_NOTE,
      "Tool allow/deny applies only to hook-visible Claude Code tools.",
      "Command guard is high-confidence pattern matching, not a shell-security engine.",
      "Exact-loop detection uses the versioned normalizer; productive-but-identical calls can trip.",
      "Recovery preview is required; Tripward will not silently reset a dirty tree.",
      ...demoLimitations(input.signal_class),
      ...input.policy.unsupported_controls,
    ],
    privacy: {
      redaction_level: "private-local",
      persist_raw_payloads: input.policy.receipt.persist_raw_payloads,
      excluded_fields: ["prompts", "completions", "file_contents", "secrets", "usd_cost"],
    },
  };
  const content_digest = digestObject({ ...draft, receipt_id: draft.receipt_id, sealed_at: draft.sealed_at });
  return {
    ...draft,
    integrity: {
      schema_version: RECEIPT_SCHEMA_VERSION,
      content_digest,
    },
  };
}

function demoLimitations(signalClass?: SignalClass): string[] {
  if (signalClass === "operator-injected-demo") {
    return [
      "OPERATOR-INJECTED DEMO: PreToolUse was submitted by `tripward demo-trip`, not by Claude Code. This is not a stub CI trip and does not count as alpha legitimate signal.",
    ];
  }
  if (signalClass === "stub-ci") {
    return ["Stub/CI trip: Claude Code was not launched. Does not count as a live or alpha legitimate signal."];
  }
  return [];
}

function summarize(event: JournalEvent): string {
  const p = event.payload;
  if (event.type === "policy.evaluated") {
    return `${p.action} ${p.reason_code ?? ""}`.trim();
  }
  if (event.type === "detector.signaled" || event.type === "policy.signaled") {
    return `${event.type === "detector.signaled" ? "detector" : "policy"} signaled ${p.reason_code ?? ""} → ${p.effective_action ?? "warn"} (configured ${p.configured_action ?? "?"})`.trim();
  }
  if (event.type === "fuse.tripped") {
    return `tripped ${p.reason ?? p.reason_code ?? ""}`.trim();
  }
  if (event.type === "tool.requested") {
    return `tool ${p.tool_name ?? ""}`.trim();
  }
  if (typeof p.detail === "string") return p.detail;
  return event.type;
}

export function writeReceipt(runDirectory: string, receipt: ReceiptDocument): { json: string; html: string } {
  const json = join(runDirectory, "receipt.json");
  writeFileSync(json, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  const html = writeReceiptHtml(runDirectory, receipt);
  return { json, html };
}
