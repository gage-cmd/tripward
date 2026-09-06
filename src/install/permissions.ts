import { chmodSync, existsSync, statSync, writeFileSync } from "node:fs";

/** POSIX permission bits (ignore file type). */
export function modeOf(path: string): number {
  return statSync(path).mode & 0o777;
}

export function formatMode(mode: number): string {
  return mode.toString(8).padStart(3, "0");
}

/** True when `next` has any bit that `current` does not — i.e. would broaden access. */
export function wouldBroaden(current: number, next: number): boolean {
  return (next & ~current) !== 0;
}

/**
 * Apply a mode only if it is equally or more restrictive. Never add permission bits.
 * Returns the mode actually left on disk.
 */
export function chmodNeverBroader(path: string, desired: number): number {
  if (!existsSync(path)) {
    throw new Error(`chmodNeverBroader: missing ${path}`);
  }
  const current = modeOf(path);
  const next = current & desired;
  if (next !== current) {
    chmodSync(path, next);
  }
  return modeOf(path);
}

/** Write a new file with an exact restrictive mode (0600/0700). */
export function writeRestrictedFile(path: string, contents: string, mode: number): void {
  if (mode & 0o022) {
    throw new Error(`Refusing to create world/group-writable file (${formatMode(mode)}): ${path}`);
  }
  writeFileSync(path, contents, { mode });
  const actual = modeOf(path);
  if (wouldBroaden(mode, actual)) {
    chmodSync(path, mode);
  }
  const after = modeOf(path);
  if (wouldBroaden(mode, after)) {
    throw new Error(`Failed to restrict ${path} to ${formatMode(mode)} (got ${formatMode(after)})`);
  }
}

export const HOME_MODE = 0o700;
export const FILE_MODE = 0o600;
export const DIR_MODE = 0o700;
