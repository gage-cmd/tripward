export interface Args {
  command: string;
  rest: string[];
  flags: Record<string, string | boolean>;
}

/** Flags that must stay boolean so `--preview <run_id>` is a working CTA. */
export const BOOLEAN_FLAGS = new Set([
  "preview",
  "confirm",
  "redact",
  "html",
  "open",
  "json",
  "stub",
]);

export function parseArgs(argv: string[]): Args {
  const [, , command = "help", ...raw] = argv;
  const flags: Record<string, string | boolean> = {};
  const rest: string[] = [];
  let passthrough = false;
  const passthroughArgs: string[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const token = raw[i];
    if (passthrough) {
      passthroughArgs.push(token);
      continue;
    }
    if (token === "--") {
      passthrough = true;
      continue;
    }
    if (token.startsWith("--")) {
      const [key, value] = token.slice(2).split("=");
      if (value !== undefined) {
        flags[key] = BOOLEAN_FLAGS.has(key) ? value === "true" || value === "1" : value;
      } else if (BOOLEAN_FLAGS.has(key)) {
        flags[key] = true;
      } else if (raw[i + 1] && !raw[i + 1].startsWith("-")) {
        flags[key] = raw[i + 1];
        i += 1;
      } else {
        flags[key] = true;
      }
      continue;
    }
    rest.push(token);
  }
  if (passthroughArgs.length) flags._passthrough = passthroughArgs.join("\u0000");
  return { command, rest, flags };
}

export function passthroughOf(flags: Record<string, string | boolean>): string[] {
  return typeof flags._passthrough === "string"
    ? String(flags._passthrough).split("\u0000").filter(Boolean)
    : [];
}

export function flag(flags: Record<string, string | boolean>, name: string): string | undefined {
  const value = flags[name];
  if (typeof value === "string") return value;
  return undefined;
}

export function bool(flags: Record<string, string | boolean>, name: string): boolean {
  return flags[name] === true || flags[name] === "true";
}

export function parseMode(flags: Record<string, string | boolean>): "shadow" | "enforce" | undefined {
  const value = flag(flags, "mode");
  if (!value) return undefined;
  if (value !== "shadow" && value !== "enforce") {
    throw new Error("mode must be shadow or enforce");
  }
  return value;
}
