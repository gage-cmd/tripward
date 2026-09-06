import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { ENV, HOME_DIRNAME, LEGACY_ENV, LEGACY_HOME_DIRNAME, envValue } from "./brand.js";

export interface TripwardPaths {
  home: string;
  runs: string;
  activeRun: string;
  installState: string;
  defaultPolicy: string;
  backups: string;
}

/** @deprecated Use TripwardPaths */
export type FuseCapPaths = TripwardPaths;

export function resolveHome(explicit?: string, cwd = process.cwd(), env = process.env): string {
  if (explicit) return resolve(explicit);
  const fromEnv = envValue(env, ENV.HOME, LEGACY_ENV.HOME);
  if (fromEnv) return resolve(fromEnv);
  const current = resolve(cwd, HOME_DIRNAME);
  if (existsSync(current)) return current;
  const legacy = resolve(cwd, LEGACY_HOME_DIRNAME);
  if (existsSync(legacy)) return legacy;
  return current;
}

export function pathsFor(home: string): TripwardPaths {
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

export function ensureHome(home: string): TripwardPaths {
  const p = pathsFor(home);
  mkdirSync(p.runs, { recursive: true });
  mkdirSync(p.backups, { recursive: true });
  return p;
}

export function defaultUserHomeLabel(): string {
  return homedir();
}
