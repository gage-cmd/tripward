import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export interface FuseCapPaths {
  home: string;
  runs: string;
  activeRun: string;
  installState: string;
  defaultPolicy: string;
  backups: string;
}

export function resolveHome(explicit?: string, cwd = process.cwd()): string {
  if (explicit) return resolve(explicit);
  if (process.env.FUSECAP_HOME) return resolve(process.env.FUSECAP_HOME);
  return resolve(cwd, ".fusecap");
}

export function pathsFor(home: string): FuseCapPaths {
  return {
    home,
    runs: join(home, "runs"),
    activeRun: join(home, "active-run.json"),
    installState: join(home, "install-state.json"),
    defaultPolicy: join(home, "policy.json"),
    backups: join(home, "backups"),
  };
}

export function runDir(home: string, runId: string): string {
  return join(pathsFor(home).runs, runId);
}

export function ensureHome(home: string): FuseCapPaths {
  const p = pathsFor(home);
  mkdirSync(p.runs, { recursive: true });
  mkdirSync(p.backups, { recursive: true });
  return p;
}

export function defaultUserHomeLabel(): string {
  return homedir();
}
