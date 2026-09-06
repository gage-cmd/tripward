import type { PolicyDocument } from "../types.js";

function base(partial: Partial<PolicyDocument> & Pick<PolicyDocument, "policy_id" | "name" | "preset">): PolicyDocument {
  return {
    schema_version: "1.0",
    version: 1,
    mode: "enforce",
    scope: { repository: "." },
    runtime: {
      max_elapsed_seconds: 5400,
      graceful_stop_seconds: 8,
      force_kill: true,
      require_hooks: true,
      hook_handshake_seconds: 15,
    },
    tools: { max_total: 150, deny: [] },
    commands: { deny_high_confidence: true },
    behavior: {
      exact_repeat: { threshold: 5, window: 12, action: "deny" },
    },
    git: { checkpoint_required: true },
    receipt: { retention_days: 7, persist_raw_payloads: false },
    ...partial,
  };
}

export const PRESETS: Record<string, PolicyDocument> = {
  observe: base({
    policy_id: "preset-observe",
    name: "Observe",
    preset: "observe",
    mode: "shadow",
    runtime: {
      max_elapsed_seconds: 86400,
      graceful_stop_seconds: 8,
      force_kill: true,
      require_hooks: false,
      hook_handshake_seconds: 30,
    },
    commands: { deny_high_confidence: true },
    behavior: {
      exact_repeat: { threshold: 99, window: 12, action: "warn" },
    },
    git: { checkpoint_required: false },
  }),
  standard: base({
    policy_id: "preset-standard",
    name: "Standard",
    preset: "standard",
    runtime: {
      max_elapsed_seconds: 5400,
      graceful_stop_seconds: 8,
      force_kill: true,
      require_hooks: true,
      hook_handshake_seconds: 15,
    },
    tools: { max_total: 150 },
    behavior: {
      exact_repeat: { threshold: 5, window: 12, action: "deny" },
    },
  }),
  overnight: base({
    policy_id: "preset-overnight",
    name: "Overnight",
    preset: "overnight",
    runtime: {
      max_elapsed_seconds: 3600,
      graceful_stop_seconds: 8,
      force_kill: true,
      require_hooks: true,
      hook_handshake_seconds: 15,
    },
    tools: { max_total: 100 },
    git: { checkpoint_required: true },
  }),
  ci: base({
    policy_id: "preset-ci",
    name: "CI",
    preset: "ci",
    runtime: {
      max_elapsed_seconds: 1800,
      graceful_stop_seconds: 5,
      force_kill: true,
      require_hooks: true,
      hook_handshake_seconds: 10,
    },
    tools: { max_total: 80 },
  }),
  spike: base({
    policy_id: "preset-spike",
    name: "Spike demo",
    preset: "spike",
    runtime: {
      max_elapsed_seconds: 120,
      graceful_stop_seconds: 2,
      force_kill: true,
      require_hooks: true,
      hook_handshake_seconds: 8,
    },
    tools: { max_total: 40, deny: ["NotebookEdit"] },
    behavior: {
      exact_repeat: { threshold: 5, window: 12, action: "terminate" },
    },
  }),
};

export function getPreset(name: string): PolicyDocument {
  const preset = PRESETS[name];
  if (!preset) {
    throw new Error(`Unknown preset '${name}'. Known: ${Object.keys(PRESETS).join(", ")}`);
  }
  return structuredClone(preset);
}
