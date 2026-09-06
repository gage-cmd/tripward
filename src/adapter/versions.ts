import { DOCUMENTED_CLAUDE_CODE_MIN_VERSION } from "./payloads.js";

export interface AdapterCoverage {
  adapter: string;
  documented_min_version: string;
  detected_version: string | null;
  supported_events: string[];
  limitations: string[];
}

export function adapterCoverage(detectedVersion: string | null): AdapterCoverage {
  return {
    adapter: "claude-code",
    documented_min_version: DOCUMENTED_CLAUDE_CODE_MIN_VERSION,
    detected_version: detectedVersion,
    supported_events: ["SessionStart", "PreToolUse", "PostToolUse", "PostToolUseFailure", "SessionEnd"],
    limitations: [
      "PreToolUse can block hook-visible tools only; @-referenced files and EndConversation do not fire PreToolUse.",
      "Dollar enforcement is disabled for Claude Code subscription traffic.",
      "Hook bypass (disableAllHooks, unmanaged path) is a visible fail, not silent protection.",
    ],
  };
}

export function detectClaudeVersion(stdout: string): string | null {
  const match = stdout.match(/(\d+\.\d+\.\d+)/);
  return match?.[1] ?? null;
}
