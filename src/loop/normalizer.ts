import { sha256Prefixed } from "../digest.js";
import { commandClass, tokenizeShell } from "../guard/command-guard.js";
import { NORMALIZER_VERSION } from "../version.js";

export interface NormalizedTool {
  tool_name: string;
  category: string;
  command_class?: string;
  target_scope: string;
  signature_material: Record<string, unknown>;
  normalized_signature: string;
  normalizer_version: string;
}

const STABLE_KEYS: Record<string, string[]> = {
  Bash: ["command"],
  Write: ["file_path"],
  Edit: ["file_path", "old_string", "new_string", "replace_all"],
  Read: ["file_path", "offset", "limit"],
  Glob: ["pattern", "path"],
  Grep: ["pattern", "path", "glob", "output_mode"],
  WebFetch: ["url"],
  WebSearch: ["query"],
  Agent: ["description", "subagent_type"],
};

function categoryOf(tool: string): string {
  if (tool === "Bash") return "shell";
  if (tool === "Write" || tool === "Edit" || tool === "Read") return "file";
  if (tool === "Glob" || tool === "Grep") return "search";
  if (tool === "Agent") return "agent";
  return "other";
}

function normalizeCommand(command: string): string {
  return tokenizeShell(command)
    .map((token) => token.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function normalizeTool(toolName: string, toolInput: Record<string, unknown>): NormalizedTool {
  const keys = STABLE_KEYS[toolName] ?? Object.keys(toolInput).sort();
  const material: Record<string, unknown> = { tool: toolName };
  for (const key of keys) {
    const value = toolInput[key];
    if (value === undefined) continue;
    if (toolName === "Bash" && key === "command" && typeof value === "string") {
      material[key] = normalizeCommand(value);
    } else if (typeof value === "string") {
      material[key] = value.replace(/\\/g, "/");
    } else {
      material[key] = value;
    }
  }
  const commandText = typeof toolInput.command === "string" ? toolInput.command : undefined;
  return {
    tool_name: toolName,
    category: categoryOf(toolName),
    command_class: commandText ? commandClass(commandText) : undefined,
    target_scope: "repository",
    signature_material: material,
    normalized_signature: sha256Prefixed(JSON.stringify(material)),
    normalizer_version: NORMALIZER_VERSION,
  };
}
