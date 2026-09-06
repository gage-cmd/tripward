import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { sha256Prefixed } from "../digest.js";
import { chmodNeverBroader, FILE_MODE, formatMode, modeOf, writeRestrictedFile } from "./permissions.js";

export const BACKUP_MANIFEST = "manifest.json";

export interface BackupEntry {
  id: string;
  source_path: string;
  backup_path: string;
  sha256: string;
  mode: number;
  size: number;
  created_at: string;
}

export interface BackupManifest {
  schema_version: "1.0";
  entries: BackupEntry[];
}

export function emptyManifest(): BackupManifest {
  return { schema_version: "1.0", entries: [] };
}

export function manifestPath(backupsDir: string): string {
  return join(backupsDir, BACKUP_MANIFEST);
}

export function loadManifest(backupsDir: string): BackupManifest {
  const path = manifestPath(backupsDir);
  if (!existsSync(path)) return emptyManifest();
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as BackupManifest;
    if (parsed.schema_version !== "1.0" || !Array.isArray(parsed.entries)) {
      return emptyManifest();
    }
    return parsed;
  } catch {
    return emptyManifest();
  }
}

export function saveManifest(backupsDir: string, manifest: BackupManifest): void {
  mkdirSync(backupsDir, { recursive: true });
  chmodNeverBroader(backupsDir, 0o700);
  writeRestrictedFile(manifestPath(backupsDir), `${JSON.stringify(manifest, null, 2)}\n`, FILE_MODE);
}

export function hashFile(path: string): string {
  return sha256Prefixed(readFileSync(path));
}

export function verifyBackup(entry: BackupEntry): { ok: boolean; detail: string } {
  if (!existsSync(entry.backup_path)) {
    return { ok: false, detail: `backup missing: ${entry.backup_path}` };
  }
  const digest = hashFile(entry.backup_path);
  if (digest !== entry.sha256) {
    return { ok: false, detail: `backup digest mismatch for ${entry.id} (expected ${entry.sha256}, got ${digest})` };
  }
  const size = statSync(entry.backup_path).size;
  if (size !== entry.size) {
    return { ok: false, detail: `backup size mismatch for ${entry.id}` };
  }
  return { ok: true, detail: `${entry.id} verified ${entry.sha256}` };
}

export function findEntry(manifest: BackupManifest, id: string): BackupEntry | undefined {
  return manifest.entries.find((entry) => entry.id === id);
}

/**
 * Snapshot an existing file once. Re-init must not overwrite a verified original
 * with a later FuseCap-modified copy.
 */
export function backupExistingFile(
  backupsDir: string,
  id: string,
  sourcePath: string,
  destName: string,
): { entry: BackupEntry; created: boolean; skipped_reason?: string } {
  mkdirSync(backupsDir, { recursive: true });
  chmodNeverBroader(backupsDir, 0o700);
  const manifest = loadManifest(backupsDir);
  const existing = findEntry(manifest, id);
  if (existing) {
    const check = verifyBackup(existing);
    if (check.ok) {
      return { entry: existing, created: false, skipped_reason: "verified backup already present" };
    }
    return {
      entry: existing,
      created: false,
      skipped_reason: `existing backup failed verification; refusing to replace (${check.detail})`,
    };
  }
  if (!existsSync(sourcePath)) {
    throw new Error(`backup source missing: ${sourcePath}`);
  }
  const dest = join(backupsDir, destName);
  copyFileSync(sourcePath, dest);
  chmodNeverBroader(dest, FILE_MODE);
  const entry: BackupEntry = {
    id,
    source_path: sourcePath,
    backup_path: dest,
    sha256: hashFile(dest),
    mode: modeOf(sourcePath),
    size: statSync(dest).size,
    created_at: new Date().toISOString(),
  };
  if (hashFile(sourcePath) !== entry.sha256) {
    throw new Error(`backup copy digest mismatch for ${sourcePath}`);
  }
  manifest.entries.push(entry);
  saveManifest(backupsDir, manifest);
  return { entry, created: true };
}

export function restoreVerifiedBackup(entry: BackupEntry, destPath: string): { ok: true; mode: number } | { ok: false; detail: string } {
  const check = verifyBackup(entry);
  if (!check.ok) {
    return { ok: false, detail: check.detail };
  }
  mkdirSync(dirname(destPath), { recursive: true });
  copyFileSync(entry.backup_path, destPath);
  const restoredHash = hashFile(destPath);
  if (restoredHash !== entry.sha256) {
    return { ok: false, detail: `restore digest mismatch for ${entry.id}` };
  }
  // Restore the recorded pre-install mode (FR-001 preserve). Do not apply a
  // looser mode than the backup recorded — a tampered manifest cannot open bits.
  const current = modeOf(destPath);
  const safeMode = current & entry.mode;
  chmodNeverBroader(destPath, safeMode === 0 ? current : safeMode);
  return { ok: true, mode: modeOf(destPath) };
}

export function describeMode(path: string): string {
  if (!existsSync(path)) return "missing";
  return formatMode(modeOf(path));
}
