import { digestObject } from "../digest.js";
import type { EffectivePolicy, PolicyDocument } from "../types.js";
import { policyDocumentSchema, SPIKE_UNSUPPORTED_CONTROLS } from "./schema.js";

export interface CompileResult {
  policy: EffectivePolicy;
  warnings: string[];
}

export function applyPolicyMode(input: unknown, mode: "shadow" | "enforce"): unknown {
  if (!input || typeof input !== "object") return input;
  return { ...(input as Record<string, unknown>), mode };
}

export function compilePolicy(input: unknown): CompileResult {
  const parsed = policyDocumentSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Policy rejected: ${issues}`);
  }
  const document = parsed.data as PolicyDocument;
  const warnings: string[] = [];
  if (document.runtime.max_elapsed_seconds === 0) {
    warnings.push("max_elapsed_seconds=0 trips immediately after arming");
  }
  if (document.behavior.exact_repeat.window < document.behavior.exact_repeat.threshold) {
    warnings.push("exact_repeat.window < threshold; repeats older than the window will not count");
  }
  const withoutDigest = {
    ...document,
    unsupported_controls: SPIKE_UNSUPPORTED_CONTROLS,
  };
  const policy: EffectivePolicy = {
    ...document,
    unsupported_controls: SPIKE_UNSUPPORTED_CONTROLS,
    digest: digestObject(withoutDigest),
  };
  return { policy, warnings };
}

export function explainPolicy(policy: EffectivePolicy): string {
  const lines = [
    `Policy ${policy.policy_id}@${policy.version} digest ${policy.digest}`,
    `Mode: ${policy.mode}  preset: ${policy.preset ?? "custom"}`,
    `Time fuse: ${policy.runtime.max_elapsed_seconds}s (graceful ${policy.runtime.graceful_stop_seconds}s, force_kill=${policy.runtime.force_kill})`,
    `Hooks required: ${policy.runtime.require_hooks} (handshake ${policy.runtime.hook_handshake_seconds}s)`,
    `Tool deny: ${(policy.tools.deny ?? []).join(", ") || "(none)"}`,
    `Tool ask: ${(policy.tools.ask ?? []).join(", ") || "(none)"}`,
    `Max tools: ${policy.tools.max_total ?? "unlimited"}`,
    `Exact loop: ${policy.behavior.exact_repeat.threshold} identical in last ${policy.behavior.exact_repeat.window} events → ${policy.behavior.exact_repeat.action}`,
    `High-confidence command guard: ${policy.commands.deny_high_confidence}`,
    `Checkpoint required: ${policy.git.checkpoint_required}`,
    "",
    "Unsupported / not claimed in this spike:",
    ...policy.unsupported_controls.map((item) => `  - ${item}`),
    "",
    "",
    policy.mode === "shadow"
      ? "Shadow mode: behavioral detectors and non-safety policy rules log detector.signaled / policy.signaled and warn; they do not interrupt. Flip to enforce: set policy.mode=enforce (tripward protect --mode enforce) or use --preset spike."
      : "Enforce mode: matched rules interrupt as configured. Safety hard stops (dangerous command, missing journal/hooks/checkpoint) always interrupt.",
    "Claims contract: allow/warn/ask/deny/terminate are labeled distinctly.",
    "Usage dollars: unavailable for Claude Code subscription traffic.",
  ];
  return lines.join("\n");
}
