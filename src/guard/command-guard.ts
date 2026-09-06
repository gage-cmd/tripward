export type CommandConfidence = "high" | "medium";

export interface CommandMatch {
  pattern_id: string;
  confidence: CommandConfidence;
  display_reason: string;
  tokens: string[];
}

export interface CommandGuardResult {
  blocked: boolean;
  match: CommandMatch | null;
  limitation?: string;
}

interface SimpleCommand {
  argv: string[];
  raw: string;
}

const ROOTISH = new Set([
  "/",
  "/*",
  "~",
  "~/",
  "~/*",
  "$HOME",
  "$HOME/",
  "$HOME/*",
  "${HOME}",
  "${HOME}/",
  "${HOME}/*",
  "/home",
  "/Users",
  "/etc",
  "/usr",
  "/var",
  "/root",
  "/bin",
  "/sbin",
  "/System",
  "/Library",
]);

export function tokenizeShell(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;
  for (const ch of command) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    if (ch === ";" || ch === "|") {
      if (current) {
        tokens.push(current);
        current = "";
      }
      tokens.push(ch);
      continue;
    }
    if (ch === "&") {
      if (current) {
        tokens.push(current);
        current = "";
      }
      tokens.push("&");
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}

function splitCommands(tokens: string[]): SimpleCommand[] {
  const commands: SimpleCommand[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length) {
      commands.push({ argv: current, raw: current.join(" ") });
      current = [];
    }
  };
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === ";" || token === "&") {
      flush();
      continue;
    }
    if (token === "|" && tokens[i + 1] === "|") {
      flush();
      i += 1;
      continue;
    }
    if (token === "|" && tokens[i + 1] === "&") {
      flush();
      i += 1;
      continue;
    }
    if (token === "|") {
      flush();
      commands.push({ argv: ["__PIPE__"], raw: "|" });
      continue;
    }
    current.push(token);
  }
  flush();
  return commands;
}

function basename(bin: string): string {
  const trimmed = bin.replace(/^\\/, "");
  const parts = trimmed.split(/[/\\]/);
  return parts[parts.length - 1] ?? trimmed;
}

function flagSet(argv: string[]): Set<string> {
  const flags = new Set<string>();
  for (const arg of argv.slice(1)) {
    if (!arg.startsWith("-") || arg === "-") continue;
    if (arg.startsWith("--")) {
      flags.add(arg.slice(2).toLowerCase());
      continue;
    }
    for (const ch of arg.slice(1)) {
      flags.add(ch);
    }
  }
  return flags;
}

function positionals(argv: string[]): string[] {
  return argv.slice(1).filter((arg) => !arg.startsWith("-") || arg === "-");
}

function isRootish(target: string): boolean {
  if (ROOTISH.has(target)) return true;
  if (target === "." || target === ".." || target === "*" || target === "./*") return true;
  if (/^\/\*$/.test(target)) return true;
  return false;
}

function looksLikeDevice(target: string): boolean {
  return /^\/dev\/(sd|vd|nvme|disk|rdisk)/.test(target);
}

function isInterpreter(name: string): boolean {
  return ["sh", "bash", "zsh", "dash", "ksh", "fish"].includes(name);
}

export function inspectCommand(command: string): CommandGuardResult {
  const tokens = tokenizeShell(command);
  const parts = splitCommands(tokens);

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part.argv[0] === "__PIPE__") continue;
    const bin = basename(part.argv[0] ?? "");
    const flags = flagSet(part.argv);
    const args = positionals(part.argv);

    if (bin === "rm") {
      const recursive = flags.has("r") || flags.has("R") || flags.has("recursive");
      const force = flags.has("f") || flags.has("force");
      if (recursive && force && args.some(isRootish)) {
        return {
          blocked: true,
          match: {
            pattern_id: "rm-rf-rootish",
            confidence: "high",
            display_reason: `High-confidence destructive rm -rf targeting ${args.join(" ")}`,
            tokens: part.argv,
          },
        };
      }
    }

    if (bin === "git") {
      const sub = args[0];
      if (sub === "reset" && part.argv.includes("--hard")) {
        return {
          blocked: true,
          match: {
            pattern_id: "git-reset-hard",
            confidence: "high",
            display_reason: "git reset --hard destroys working-tree and index state",
            tokens: part.argv,
          },
        };
      }
      if (sub === "clean" && (flags.has("f") || flags.has("force")) && (flags.has("d") || flags.has("x") || flags.has("X"))) {
        return {
          blocked: true,
          match: {
            pattern_id: "git-clean-force",
            confidence: "high",
            display_reason: "git clean -f with -d/-x deletes untracked work",
            tokens: part.argv,
          },
        };
      }
      if (sub === "checkout" && (part.argv.includes("-f") || part.argv.includes("--force")) && (args.includes(".") || args.includes("*"))) {
        return {
          blocked: true,
          match: {
            pattern_id: "git-checkout-force",
            confidence: "high",
            display_reason: "git checkout --force on the tree discards local edits",
            tokens: part.argv,
          },
        };
      }
    }

    if (bin === "dd") {
      const of = part.argv.find((arg) => arg.startsWith("of="))?.slice(3);
      if (of && looksLikeDevice(of)) {
        return {
          blocked: true,
          match: {
            pattern_id: "dd-device",
            confidence: "high",
            display_reason: `dd writing to device ${of}`,
            tokens: part.argv,
          },
        };
      }
    }

    if (bin.startsWith("mkfs") || bin === "diskutil" && args[0] === "eraseDisk") {
      return {
        blocked: true,
        match: {
          pattern_id: "mkfs",
          confidence: "high",
          display_reason: "Filesystem format/erase is blocked",
          tokens: part.argv,
        },
      };
    }

    if (bin === "chmod") {
      const mode = args[0] ?? "";
      if ((flags.has("R") || flags.has("r")) && mode.includes("777") && args.some(isRootish)) {
        return {
          blocked: true,
          match: {
            pattern_id: "chmod-777-rootish",
            confidence: "high",
            display_reason: "Recursive chmod 777 on a rootish path",
            tokens: part.argv,
          },
        };
      }
    }

    if (["dropdb", "mysql", "psql"].includes(bin) && /drop\s+(database|table|schema)/i.test(part.raw)) {
      return {
        blocked: true,
        match: {
          pattern_id: "sql-drop",
          confidence: "high",
          display_reason: "Destructive SQL DROP is blocked",
          tokens: part.argv,
        },
      };
    }

    if (part.argv[0] === "__PIPE__") continue;
  }

  for (let i = 0; i < parts.length - 2; i += 1) {
    const left = parts[i];
    const pipe = parts[i + 1];
    const right = parts[i + 2];
    if (pipe.argv[0] !== "__PIPE__") continue;
    const leftBin = basename(left.argv[0] ?? "");
    const rightBin = basename(right.argv[0] ?? "");
    if (["curl", "wget"].includes(leftBin) && isInterpreter(rightBin)) {
      return {
        blocked: true,
        match: {
          pattern_id: "remote-pipe-shell",
          confidence: "high",
          display_reason: `${leftBin} piped to ${rightBin} is a high-confidence download-and-execute`,
          tokens: [...left.argv, "|", ...right.argv],
        },
      };
    }
  }

  return { blocked: false, match: null };
}

export function commandClass(command: string): string {
  const tokens = tokenizeShell(command);
  const bin = basename(tokens.find((token) => token !== ";" && token !== "|" && token !== "&") ?? "");
  if (["npm", "pnpm", "yarn", "vitest", "jest", "pytest", "go"].includes(bin) && tokens.some((t) => t === "test" || t === "check")) {
    return "test";
  }
  if (bin === "git") return "git";
  if (bin === "rm" || bin === "dd" || bin.startsWith("mkfs")) return "destructive";
  return bin || "shell";
}
