import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

export function git(repo: string, args: string[], allowFail = false): string {
  try {
    return execFileSync("git", args, {
      cwd: repo,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).replace(/[\r\n]+$/, "");
  } catch (error) {
    if (allowFail) return "";
    const err = error as { stderr?: string; message?: string };
    throw new Error(`git ${args.join(" ")} failed: ${err.stderr || err.message}`);
  }
}

export function isGitRepo(cwd: string): boolean {
  return git(cwd, ["rev-parse", "--is-inside-work-tree"], true) === "true";
}

export function repoRoot(cwd: string): string {
  const root = git(cwd, ["rev-parse", "--show-toplevel"]);
  return resolve(root);
}

export function currentHead(repo: string): string {
  return git(repo, ["rev-parse", "HEAD"], true) || "UNBORN";
}

export function currentBranch(repo: string): { branch: string | null; detached: boolean } {
  const detached = git(repo, ["rev-parse", "--abbrev-ref", "HEAD"], true) === "HEAD";
  if (detached) return { branch: null, detached: true };
  return { branch: git(repo, ["rev-parse", "--abbrev-ref", "HEAD"], true) || null, detached: false };
}

export interface PorcelainEntry {
  path: string;
  xy: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
}

export function porcelain(repo: string): PorcelainEntry[] {
  const text = git(repo, ["status", "--porcelain=v1", "-uall"], true);
  if (!text) return [];
  return text.split("\n").filter(Boolean).map((line) => {
    const xy = line.slice(0, 2);
    let path = line.slice(3);
    if (path.includes(" -> ")) {
      path = path.split(" -> ")[1] ?? path;
    }
    return {
      path,
      xy,
      staged: xy[0] !== " " && xy[0] !== "?" && xy[0] !== "!",
      unstaged: xy[1] !== " " && xy[1] !== "?",
      untracked: xy === "??",
    };
  });
}

export function hashObject(repo: string, absPath: string): string {
  return git(repo, ["hash-object", "-w", "--", absPath]);
}

export function blobSize(absPath: string): number {
  if (!existsSync(absPath)) return 0;
  return statSync(absPath).size;
}

export function fileMode(absPath: string): string {
  if (!existsSync(absPath)) return "000000";
  const mode = statSync(absPath).mode;
  return (mode & 0o777).toString(8).padStart(6, "1");
}

export function writeBlobToPath(repo: string, blob: string, absPath: string): void {
  const contents = execFileSync("git", ["cat-file", "-p", blob], {
    cwd: repo,
    encoding: "buffer",
    maxBuffer: 32 * 1024 * 1024,
  });
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, contents);
}

export function fingerprintRepo(repo: string): string {
  const root = repoRoot(repo);
  const head = currentHead(root);
  return `${relative("/", root) || root}:${head}`.replace(/\\/g, "/");
}

export function headBlob(repo: string, relPath: string): string | null {
  const blob = git(repo, ["rev-parse", `HEAD:${relPath}`], true);
  return blob || null;
}
