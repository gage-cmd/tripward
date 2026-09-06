import { basename, resolve } from "node:path";

export type LaunchStdioMode = "print" | "interactive" | "capture";

export interface NormalizedClaudeArgs {
  args: string[];
  stripped: string[];
}

/**
 * Docs historically showed `tripward run -- claude …` (and `fusecap run` before the rename). The supervisor already
 * execs `which claude`, so a leading `claude` (or path to that binary) must be
 * stripped or Claude Code receives a doubled first argv token.
 */
export function isClaudeLauncherToken(token: string, resolvedBin?: string | null): boolean {
  if (!token || token.startsWith("-")) return false;
  const base = basename(token);
  if (base === "claude" || base === "claude.exe") return true;
  if (resolvedBin) {
    try {
      if (resolve(token) === resolve(resolvedBin)) return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function normalizeClaudePassthrough(
  passthrough: string[],
  resolvedBin?: string | null,
): NormalizedClaudeArgs {
  const stripped: string[] = [];
  let index = 0;
  while (index < passthrough.length && isClaudeLauncherToken(passthrough[index], resolvedBin)) {
    stripped.push(passthrough[index]);
    index += 1;
  }
  return { args: passthrough.slice(index), stripped };
}

export function isPrintMode(args: string[]): boolean {
  return args.some(
    (token) => token === "-p" || token === "--print" || token.startsWith("--print="),
  );
}

export function stdioModeForClaudeArgs(args: string[]): LaunchStdioMode {
  return isPrintMode(args) ? "print" : "interactive";
}

export interface ClaudeLaunchSpec {
  command: string;
  args: string[];
  stripped_leading_claude: string[];
  stdio_mode: LaunchStdioMode;
}

export function buildClaudeLaunchSpec(input: {
  claudeBin: string;
  passthrough: string[];
}): ClaudeLaunchSpec {
  const normalized = normalizeClaudePassthrough(input.passthrough, input.claudeBin);
  return {
    command: input.claudeBin,
    args: normalized.args,
    stripped_leading_claude: normalized.stripped,
    stdio_mode: stdioModeForClaudeArgs(normalized.args),
  };
}
