export type ProtectionState =
  | "ARMING"
  | "SHADOW"
  | "PROTECTED"
  | "DEGRADED"
  | "WARNED"
  | "AWAITING_APPROVAL"
  | "TOOL_BLOCKED"
  | "STOPPING"
  | "TERMINATED"
  | "COMPLETED"
  | "RECOVERY_REVIEW"
  | "RESTORED";

export type DecisionAction =
  | "allow"
  | "warn"
  | "ask"
  | "deny"
  | "graceful_stop"
  | "terminate";

export type HookPermission = "allow" | "deny" | "ask" | "defer";

export type ExitReason =
  | "completed"
  | "time_fuse"
  | "hook_block"
  | "exact_loop"
  | "dangerous_command"
  | "terminated"
  | "hooks_bypassed"
  | "preflight_failed"
  | "user_canceled"
  | "crashed"
  | "unknown";

export type ReceiptOutcome =
  | "completed"
  | "warned"
  | "blocked"
  | "terminated"
  | "crashed"
  | "user-canceled";

export type ProtectionHealth = "protected" | "degraded" | "failed" | "unknown";

/** How a sealed receipt was produced. Never treat operator-injected as live Claude. */
export type SignalClass = "live-claude" | "stub-ci" | "operator-injected-demo";

export interface PolicyDocument {
  schema_version: string;
  policy_id: string;
  name: string;
  version: number;
  preset?: string;
  mode: "shadow" | "enforce";
  scope: {
    repository: string;
  };
  runtime: {
    max_elapsed_seconds: number;
    graceful_stop_seconds: number;
    force_kill: boolean;
    idle_seconds?: number;
    require_hooks: boolean;
    hook_handshake_seconds: number;
  };
  tools: {
    max_total?: number;
    allow?: string[];
    deny?: string[];
    ask?: string[];
    warn?: string[];
  };
  commands: {
    deny_high_confidence: boolean;
    ask_patterns?: string[];
  };
  behavior: {
    exact_repeat: {
      threshold: number;
      window: number;
      action: "warn" | "ask" | "deny" | "terminate";
    };
  };
  git: {
    checkpoint_required: boolean;
  };
  receipt: {
    retention_days: number;
    persist_raw_payloads: boolean;
  };
}

export interface EffectivePolicy extends PolicyDocument {
  digest: string;
  unsupported_controls: string[];
}

export interface RunRecord {
  run_id: string;
  created_at: string;
  cwd: string;
  home: string;
  policy_digest: string;
  policy_id: string;
  adapter: { name: string; version: string };
  state: ProtectionState;
  health: ProtectionHealth;
  health_reasons: string[];
  claude_available: boolean;
  launched_command: string[];
  stripped_leading_claude?: string[];
  signal_class?: SignalClass;
  child_pid?: number;
}

export interface JournalEvent {
  schema_version: string;
  event_id: string;
  run_id: string;
  sequence: number;
  type: string;
  wall_time: string;
  monotonic_ms: number;
  idempotency_key: string;
  payload: Record<string, unknown>;
  digest: string;
  raw_persisted: boolean;
}

export interface PolicyDecision {
  decision_id: string;
  run_id: string;
  event_id: string;
  policy_digest: string;
  evaluator_version: string;
  matched_rule_ids: string[];
  action: DecisionAction;
  reason_code: string;
  display_reason: string;
  evidence_refs: string[];
  decision_time_ms: number;
  override_allowed: boolean;
  integrity_digest: string;
}

export interface ToolFeatures {
  tool_name: string;
  category: string;
  normalized_signature: string;
  target_scope: string;
  command_class?: string;
  command_text?: string;
}

export interface ComponentHealth {
  name: string;
  ok: boolean;
  detail: string;
}

export interface StartingFileEntry {
  path: string;
  status: "staged" | "unstaged" | "untracked" | "clean";
  mode: string;
  blob: string;
  size: number;
}

export interface CheckpointManifest {
  checkpoint_id: string;
  run_id: string;
  strategy: "object-store-manifest";
  created_at: string;
  repo_root: string;
  head: string;
  branch: string | null;
  detached: boolean;
  dirty: boolean;
  files: StartingFileEntry[];
  starting_digest: string;
  verified: boolean;
}

export interface RecoveryPreviewPath {
  path: string;
  kind: "agent_modified" | "agent_created" | "preexisting" | "uncertain";
  starting_blob?: string;
  current_blob?: string;
  restore_action: "restore_blob" | "delete" | "keep" | "manual_review";
  safe: boolean;
  note: string;
}

export interface RecoveryPreview {
  run_id: string;
  checkpoint_id: string;
  preview_digest: string;
  preexisting_work_intact: boolean;
  one_click_disabled: boolean;
  paths: RecoveryPreviewPath[];
  limitations: string[];
}

export interface ReceiptTrigger {
  rule: string;
  threshold?: string | number;
  observed_value?: string | number;
  confidence: "high" | "medium" | "low" | "unavailable";
  action: string;
  action_executed: boolean;
}

export interface ReceiptDocument {
  schema_version: string;
  receipt_id: string;
  run_id: string;
  sealed_at: string;
  identity: {
    repository_fingerprint: string;
    branch: string | null;
    host_label: string;
    started_at: string;
    ended_at: string;
  };
  environment: {
    fusecap_version: string;
    adapter_version: string;
    claude_code_version: string | null;
    os: string;
    protection_health: ProtectionHealth;
    health_reasons: string[];
    signal_class?: SignalClass;
    launched_binary?: string | null;
  };
  policy: {
    policy_id: string;
    version: number;
    digest: string;
    preset?: string;
    enforcement_mode: string;
  };
  outcome: ReceiptOutcome;
  exit_reason: ExitReason;
  trigger: ReceiptTrigger | null;
  timeline: Array<{
    sequence: number;
    type: string;
    wall_time: string;
    monotonic_ms: number;
    summary: string;
  }>;
  repository: {
    checkpoint_intact: boolean;
    dirty_at_start: boolean;
    files_in_manifest: number;
    final_status: string;
  };
  usage: {
    cost: null;
    currency: null;
    source: "unavailable";
    confidence: "unavailable";
    note: string;
  };
  limitations: string[];
  integrity: {
    schema_version: string;
    content_digest: string;
  };
  privacy: {
    redaction_level: string;
    persist_raw_payloads: boolean;
    excluded_fields: string[];
  };
}
