import type { ReceiptDocument, ReceiptTrigger } from "../types.js";

export interface RedactedReceipt {
  schema_version: string;
  receipt_id: string;
  run_id: string;
  sealed_at: string;
  identity: {
    repository_fingerprint: "redacted";
    branch: string | null;
    host_label: "redacted";
    started_at: string;
    ended_at: string;
  };
  environment: {
    tripward_version: string;
    adapter_version: string;
    claude_code_version: string | null;
    os: string;
    protection_health: ReceiptDocument["environment"]["protection_health"];
    health_reasons: string[];
    signal_class: ReceiptDocument["environment"]["signal_class"] | null;
    launched_binary: string | null;
  };
  policy: ReceiptDocument["policy"];
  outcome: ReceiptDocument["outcome"];
  exit_reason: ReceiptDocument["exit_reason"];
  trigger: ReceiptTrigger | null;
  timeline: Array<{
    sequence: number;
    type: string;
    wall_time: string;
    summary: string;
  }>;
  repository: ReceiptDocument["repository"];
  usage: ReceiptDocument["usage"];
  limitations: string[];
  integrity: ReceiptDocument["integrity"];
  privacy: {
    redaction_level: "external-tester";
    persist_raw_payloads: false;
    excluded_fields: string[];
  };
}

/**
 * Testers share this — never host paths, fingerprints, or command text.
 * Usage dollars stay null.
 */
export function redactReceipt(receipt: ReceiptDocument): RedactedReceipt {
  return {
    schema_version: receipt.schema_version,
    receipt_id: receipt.receipt_id,
    run_id: receipt.run_id,
    sealed_at: receipt.sealed_at,
    identity: {
      repository_fingerprint: "redacted",
      branch: receipt.identity.branch,
      host_label: "redacted",
      started_at: receipt.identity.started_at,
      ended_at: receipt.identity.ended_at,
    },
    environment: {
      tripward_version: receipt.environment.tripward_version ?? receipt.environment.fusecap_version ?? "unknown",
      adapter_version: receipt.environment.adapter_version,
      claude_code_version: receipt.environment.claude_code_version,
      os: receipt.environment.os,
      protection_health: receipt.environment.protection_health,
      health_reasons: receipt.environment.health_reasons,
      signal_class: receipt.environment.signal_class ?? null,
      launched_binary: receipt.environment.launched_binary
        ? (receipt.environment.launched_binary.split(/[/\\]/).pop() ?? "redacted")
        : null,
    },
    policy: {
      policy_id: receipt.policy.policy_id,
      version: receipt.policy.version,
      digest: receipt.policy.digest,
      preset: receipt.policy.preset,
      enforcement_mode: receipt.policy.enforcement_mode,
    },
    outcome: receipt.outcome,
    exit_reason: receipt.exit_reason,
    trigger: receipt.trigger,
    timeline: receipt.timeline.map((item) => ({
      sequence: item.sequence,
      type: item.type,
      wall_time: item.wall_time,
      summary: item.summary,
    })),
    repository: {
      checkpoint_intact: receipt.repository.checkpoint_intact,
      dirty_at_start: receipt.repository.dirty_at_start,
      files_in_manifest: receipt.repository.files_in_manifest,
      final_status: receipt.repository.final_status,
    },
    usage: {
      cost: null,
      currency: null,
      source: "unavailable",
      confidence: "unavailable",
      note: receipt.usage.note,
    },
    limitations: receipt.limitations,
    integrity: receipt.integrity,
    privacy: {
      redaction_level: "external-tester",
      persist_raw_payloads: false,
      excluded_fields: [
        "prompts",
        "completions",
        "file_contents",
        "secrets",
        "usd_cost",
        "host_label",
        "repository_fingerprint",
        "absolute_paths",
      ],
    },
  };
}
