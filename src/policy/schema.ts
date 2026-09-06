import { z } from "zod";

const actionZ = z.enum(["warn", "ask", "deny", "terminate"]);

export const policyDocumentSchema = z
  .object({
    schema_version: z.string(),
    policy_id: z.string().min(1),
    name: z.string().min(1),
    version: z.number().int().positive(),
    preset: z.string().optional(),
    mode: z.enum(["shadow", "enforce"]),
    scope: z.object({
      repository: z.string().min(1),
    }),
    runtime: z.object({
      max_elapsed_seconds: z.number().nonnegative(),
      graceful_stop_seconds: z.number().nonnegative(),
      force_kill: z.boolean(),
      idle_seconds: z.number().nonnegative().optional(),
      require_hooks: z.boolean(),
      hook_handshake_seconds: z.number().positive(),
    }),
    tools: z.object({
      max_total: z.number().int().nonnegative().optional(),
      allow: z.array(z.string()).optional(),
      deny: z.array(z.string()).optional(),
      ask: z.array(z.string()).optional(),
      warn: z.array(z.string()).optional(),
    }),
    commands: z.object({
      deny_high_confidence: z.boolean(),
      ask_patterns: z.array(z.string()).optional(),
    }),
    behavior: z.object({
      exact_repeat: z.object({
        threshold: z.number().int().positive(),
        window: z.number().int().positive(),
        action: actionZ,
      }),
    }),
    git: z.object({
      checkpoint_required: z.boolean(),
    }),
    receipt: z.object({
      retention_days: z.number().int().positive(),
      persist_raw_payloads: z.boolean(),
    }),
  })
  .strict();

export type PolicyInput = z.input<typeof policyDocumentSchema>;

export const SPIKE_UNSUPPORTED_CONTROLS = [
  "dollar_fuse (unavailable for Claude Code subscription traffic)",
  "sequence_repeat (P1 shadow detector)",
  "file_churn (P1 shadow detector)",
  "no_progress (P1 advisory)",
  "subagent_ceiling (P1)",
  "network_allowlist (delegated to native sandbox; not independently enforced)",
  "organization_policy_precedence (v1 implements repository + session only)",
];
