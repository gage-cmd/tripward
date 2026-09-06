import type { Clock } from "../clock.js";
import { systemClock } from "../clock.js";
import { digestObject } from "../digest.js";
import { inspectCommand } from "../guard/command-guard.js";
import { newDecisionId } from "../ids.js";
import { detectExactLoop, type RepeatObservation } from "../loop/detector.js";
import { normalizeTool } from "../loop/normalizer.js";
import type { DecisionAction, EffectivePolicy, PolicyDecision, ToolFeatures } from "../types.js";
import { EVALUATOR_VERSION } from "../version.js";

export interface EvaluationInput {
  run_id: string;
  event_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  elapsed_seconds: number;
  tools_used: number;
  repeat_history: RepeatObservation[];
  journal_available: boolean;
  hooks_healthy: boolean;
  checkpoint_verified: boolean;
}

export interface EvaluationResult {
  decision: PolicyDecision;
  features: ToolFeatures;
  pending_stop: boolean;
  /** True when a detector or policy rule wanted to interrupt but shadow remapped to warn. */
  signaled: boolean;
  configured_action: DecisionAction;
  detector?: "exact_repeat";
}

function buildDecision(
  input: EvaluationInput,
  policy: EffectivePolicy,
  action: DecisionAction,
  reason_code: string,
  display_reason: string,
  matched_rule_ids: string[],
  evidence_refs: string[],
  decision_time_ms: number,
): PolicyDecision {
  const draft: Omit<PolicyDecision, "integrity_digest"> = {
    decision_id: newDecisionId(),
    run_id: input.run_id,
    event_id: input.event_id,
    policy_digest: policy.digest,
    evaluator_version: EVALUATOR_VERSION,
    matched_rule_ids,
    action,
    reason_code,
    display_reason,
    evidence_refs,
    decision_time_ms,
    override_allowed: action !== "terminate" && action !== "graceful_stop",
  };
  return { ...draft, integrity_digest: digestObject(draft) };
}

/** Deterministic safety stops stay live even when the policy is in shadow. */
export const ALWAYS_ENFORCE_REASONS = new Set([
  "SYS_SAFETY",
  "DANGEROUS_COMMAND",
  "HOOKS_BYPASSED",
  "CHECKPOINT_MISSING",
]);

export const BEHAVIORAL_DETECTORS: Record<string, "exact_repeat"> = {
  EXACT_REPEAT_LIMIT: "exact_repeat",
};

export function maybeShadow(policy: EffectivePolicy, action: DecisionAction, reason_code: string): DecisionAction {
  if (ALWAYS_ENFORCE_REASONS.has(reason_code)) {
    return action;
  }
  if (policy.mode === "shadow") {
    if (action === "deny" || action === "ask" || action === "terminate" || action === "graceful_stop") {
      return "warn";
    }
  }
  return action;
}

export function evaluateTool(
  policy: EffectivePolicy,
  input: EvaluationInput,
  clock: Clock = systemClock(),
): EvaluationResult {
  const started = clock.monotonicMs();
  const features = normalizeTool(input.tool_name, input.tool_input);
  const elapsedMs = () => Math.max(0, Math.round(clock.monotonicMs() - started));

  const decide = (
    action: DecisionAction,
    reason: string,
    display: string,
    rules: string[],
    evidence: string[] = [input.event_id],
    pending_stop = false,
    configured_action: DecisionAction = action,
  ): EvaluationResult => ({
    decision: buildDecision(input, policy, action, reason, display, rules, evidence, elapsedMs()),
    features: {
      tool_name: features.tool_name,
      category: features.category,
      normalized_signature: features.normalized_signature,
      target_scope: features.target_scope,
      command_class: features.command_class,
      command_text: typeof input.tool_input.command === "string" ? input.tool_input.command : undefined,
    },
    pending_stop: pending_stop && (action === "terminate" || action === "graceful_stop"),
    signaled: configured_action !== action || Boolean(BEHAVIORAL_DETECTORS[reason]),
    configured_action,
    detector: BEHAVIORAL_DETECTORS[reason],
  });

  if (!input.journal_available) {
    return decide("terminate", "SYS_SAFETY", "Required journal is unavailable; refusing to continue protected.", ["system.journal"]);
  }
  if (policy.runtime.require_hooks && !input.hooks_healthy) {
    return decide(
      "terminate",
      "HOOKS_BYPASSED",
      "Required hooks are not healthy. Protection is degraded and the session must stop.",
      ["system.hooks"],
      [input.event_id],
      true,
    );
  }
  if (policy.git.checkpoint_required && !input.checkpoint_verified) {
    return decide(
      "terminate",
      "CHECKPOINT_MISSING",
      "Checkpoint is required by policy but was not verified.",
      ["system.checkpoint"],
      [input.event_id],
      true,
    );
  }

  const command = typeof input.tool_input.command === "string" ? input.tool_input.command : undefined;
  if (command && policy.commands.deny_high_confidence) {
    const guard = inspectCommand(command);
    if (guard.blocked && guard.match) {
      const action = maybeShadow(policy, "deny", "DANGEROUS_COMMAND");
      return decide(
        action,
        "DANGEROUS_COMMAND",
        guard.match.display_reason,
        [`command.${guard.match.pattern_id}`],
        [input.event_id],
        false,
        "deny",
      );
    }
  }

  const deniedTools = new Set(policy.tools.deny ?? []);
  if (deniedTools.has(input.tool_name)) {
    return decide(
      maybeShadow(policy, "deny", "TOOL_DENIED"),
      "TOOL_DENIED",
      `Tool ${input.tool_name} is denied by policy.`,
      [`tools.deny.${input.tool_name}`],
      [input.event_id],
      false,
      "deny",
    );
  }
  const askTools = new Set(policy.tools.ask ?? []);
  if (askTools.has(input.tool_name)) {
    return decide(
      maybeShadow(policy, "ask", "TOOL_ASK"),
      "TOOL_ASK",
      `Tool ${input.tool_name} requires confirmation.`,
      [`tools.ask.${input.tool_name}`],
      [input.event_id],
      false,
      "ask",
    );
  }
  const warnTools = new Set(policy.tools.warn ?? []);
  if (warnTools.has(input.tool_name)) {
    return decide("warn", "TOOL_WARN", `Tool ${input.tool_name} is permitted with a warning.`, [
      `tools.warn.${input.tool_name}`,
    ]);
  }

  if (policy.runtime.max_elapsed_seconds > 0 && input.elapsed_seconds >= policy.runtime.max_elapsed_seconds) {
    return decide(
      maybeShadow(policy, "graceful_stop", "TIME_FUSE"),
      "TIME_FUSE",
      `Wall-clock limit of ${policy.runtime.max_elapsed_seconds}s reached (observed ${input.elapsed_seconds}s).`,
      ["runtime.max_elapsed_seconds"],
      [input.event_id],
      true,
      "graceful_stop",
    );
  }

  if (policy.tools.max_total !== undefined && input.tools_used + 1 > policy.tools.max_total) {
    return decide(
      maybeShadow(policy, "deny", "TOOL_TOTAL_LIMIT"),
      "TOOL_TOTAL_LIMIT",
      `Tool total ${policy.tools.max_total} would be exceeded.`,
      ["tools.max_total"],
      [input.event_id],
      false,
      "deny",
    );
  }

  const incoming = { event_id: input.event_id, signature: features.normalized_signature };
  const loop = detectExactLoop(
    input.repeat_history,
    incoming,
    policy.behavior.exact_repeat.threshold,
    policy.behavior.exact_repeat.window,
  );
  if (loop.tripped) {
    const configured = policy.behavior.exact_repeat.action;
    const action = maybeShadow(policy, configured, "EXACT_REPEAT_LIMIT");
    return decide(
      action,
      "EXACT_REPEAT_LIMIT",
      `Normalized ${input.tool_name} repeated ${loop.count} times in the last ${loop.window} events (threshold ${loop.threshold}).`,
      ["behavior.exact_repeat"],
      loop.evidence_refs,
      configured === "terminate",
      configured,
    );
  }

  const allowList = policy.tools.allow;
  if (allowList && allowList.length > 0 && !allowList.includes(input.tool_name)) {
    return decide(
      maybeShadow(policy, "ask", "TOOL_NOT_ALLOWLISTED"),
      "TOOL_NOT_ALLOWLISTED",
      `Tool ${input.tool_name} is not on the explicit allowlist.`,
      ["tools.allow"],
      [input.event_id],
      false,
      "ask",
    );
  }

  return decide("allow", "DEFAULT_NATIVE", "No Tripward rule matched; native Claude Code permission flow applies.", ["default"]);
}

export function actionToHookPermission(action: DecisionAction): "allow" | "deny" | "ask" | "defer" | null {
  switch (action) {
    case "allow":
    case "warn":
      return "allow";
    case "ask":
      return "ask";
    case "deny":
    case "graceful_stop":
    case "terminate":
      return "deny";
    default:
      return null;
  }
}
