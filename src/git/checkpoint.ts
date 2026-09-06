import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { digestObject } from "../digest.js";
import { newCheckpointId } from "../ids.js";
import type { CheckpointManifest, StartingFileEntry } from "../types.js";
import {
  blobSize,
  currentBranch,
  currentHead,
  fileMode,
  git,
  hashObject,
  porcelain,
  repoRoot,
} from "./git.js";

export const CHECKPOINT_FILENAME = "checkpoint.json";

export function createCheckpoint(cwd: string, runId: string): CheckpointManifest {
  const root = repoRoot(cwd);
  const head = currentHead(root);
  const { branch, detached } = currentBranch(root);
  const status = porcelain(root);
  const files: StartingFileEntry[] = [];

  for (const entry of status) {
    const abs = join(root, entry.path);
    if (!existsSync(abs)) continue;
    const blob = hashObject(root, abs);
    const statusKind: StartingFileEntry["status"] = entry.untracked
      ? "untracked"
      : entry.unstaged
        ? "unstaged"
        : entry.staged
          ? "staged"
          : "clean";
    files.push({
      path: entry.path,
      status: statusKind,
      mode: fileMode(abs),
      blob,
      size: blobSize(abs),
    });
  }

  const draft = {
    checkpoint_id: newCheckpointId(),
    run_id: runId,
    strategy: "object-store-manifest" as const,
    created_at: new Date().toISOString(),
    repo_root: root,
    head,
    branch,
    detached,
    dirty: files.length > 0,
    files,
    verified: false,
  };
  const starting_digest = digestObject({ head, files: files.map((f) => ({ path: f.path, blob: f.blob, status: f.status })) });
  const manifest: CheckpointManifest = { ...draft, starting_digest, verified: false };

  for (const file of files) {
    try {
      const again = hashObject(root, join(root, file.path));
      if (again !== file.blob) {
        throw new Error(`checkpoint verification raced on ${file.path}`);
      }
    } catch (error) {
      throw new Error(`Checkpoint not verified: ${(error as Error).message}`);
    }
  }
  manifest.verified = true;
  return manifest;
}

export function writeCheckpoint(runDirectory: string, manifest: CheckpointManifest): string {
  const path = join(runDirectory, CHECKPOINT_FILENAME);
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  return path;
}

export function readCheckpoint(runDirectory: string): CheckpointManifest {
  return JSON.parse(readFileSync(join(runDirectory, CHECKPOINT_FILENAME), "utf8")) as CheckpointManifest;
}

export function verifyPreexistingBytes(manifest: CheckpointManifest): { ok: boolean; lost: string[] } {
  const lost: string[] = [];
  for (const file of manifest.files) {
    const abs = join(manifest.repo_root, file.path);
    if (!existsSync(abs)) {
      lost.push(file.path);
      continue;
    }
    const blob = hashObject(manifest.repo_root, abs);
    if (blob !== file.blob) {
      try {
        git(manifest.repo_root, ["cat-file", "-e", file.blob]);
      } catch {
        lost.push(file.path);
      }
    }
  }
  return { ok: lost.length === 0, lost };
}
