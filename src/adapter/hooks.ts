import type { DecisionAction } from "../types.js";
import { actionToHookPermission } from "../policy/evaluator.js";

export interface ClaudeHookInput {
  session_id?: string;
  prompt_id?: string;
  transcript_path?: string;
  cwd?: string;
  permission_mode?: string;
  hook_event_name: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_use_id?: string;
  tool_response?: unknown;
  agent_id?: string;
  agent_type?: string;
  source?: string;
  reason?: string;
}

export interface HookResponse {
  hookSpecificOutput?: {
    hookEventName: string;
    permissionDecision?: "allow" | "deny" | "ask" | "defer";
    permissionDecisionReason?: string;
    additionalContext?: string;
  };
  systemMessage?: string;
}

export function parseHookInput(raw: string): ClaudeHookInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("HOOK_INPUT_INVALID: stdin is not JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("HOOK_INPUT_INVALID: expected object");
  }
  const record = parsed as Record<string, unknown>;
  const event = record.hook_event_name;
  if (typeof event !== "string" || !event) {
    throw new Error("HOOK_INPUT_UNSUPPORTED: missing hook_event_name");
  }
  return {
    session_id: typeof record.session_id === "string" ? record.session_id : undefined,
    prompt_id: typeof record.prompt_id === "string" ? record.prompt_id : undefined,
    transcript_path: typeof record.transcript_path === "string" ? record.transcript_path : undefined,
    cwd: typeof record.cwd === "string" ? record.cwd : undefined,
    permission_mode: typeof record.permission_mode === "string" ? record.permission_mode : undefined,
    hook_event_name: event,
    tool_name: typeof record.tool_name === "string" ? record.tool_name : undefined,
    tool_input:
      record.tool_input && typeof record.tool_input === "object"
        ? (record.tool_input as Record<string, unknown>)
        : {},
    tool_use_id: typeof record.tool_use_id === "string" ? record.tool_use_id : undefined,
    tool_response: record.tool_response,
    agent_id: typeof record.agent_id === "string" ? record.agent_id : undefined,
    agent_type: typeof record.agent_type === "string" ? record.agent_type : undefined,
    source: typeof record.source === "string" ? record.source : undefined,
    reason: typeof record.reason === "string" ? record.reason : undefined,
  };
}

export function hookResponseFor(
  eventName: string,
  action: DecisionAction,
  reason: string,
): HookResponse {
  if (eventName !== "PreToolUse") {
    return {
      hookSpecificOutput: {
        hookEventName: eventName,
        additionalContext: reason,
      },
    };
  }
  const permission = actionToHookPermission(action);
  if (!permission) {
    return { hookSpecificOutput: { hookEventName: eventName } };
  }
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: permission,
      permissionDecisionReason: reason,
    },
    systemMessage: action === "allow" || action === "warn" ? undefined : reason,
  };
}

export function claudeSettingsHooks(hookCommand: string): Record<string, unknown> {
  return {
    hooks: {
      SessionStart: [
        {
          matcher: "*",
          hooks: [{ type: "command", command: hookCommand, timeout: 15 }],
        },
      ],
      PreToolUse: [
        {
          matcher: "*",
          hooks: [{ type: "command", command: hookCommand, timeout: 10 }],
        },
      ],
      PostToolUse: [
        {
          matcher: "*",
          hooks: [{ type: "command", command: hookCommand, timeout: 10 }],
        },
      ],
      PostToolUseFailure: [
        {
          matcher: "*",
          hooks: [{ type: "command", command: hookCommand, timeout: 10 }],
        },
      ],
      SessionEnd: [
        {
          matcher: "*",
          hooks: [{ type: "command", command: hookCommand, timeout: 10 }],
        },
      ],
    },
  };
}
