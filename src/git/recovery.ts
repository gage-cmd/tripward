import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { digestObject } from "../digest.js";
import type { CheckpointManifest, RecoveryPreview, RecoveryPreviewPath } from "../types.js";
import { hashObject, headBlob, porcelain, writeBlobToPath } from "./git.js";

export function currentRelativeFiles(repo: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of porcelain(repo)) {
    const abs = join(repo, entry.path);
    if (!existsSync(abs)) continue;
    map.set(entry.path, hashObject(repo, abs));
  }
  return map;
}

export function buildRecoveryPreview(manifest: CheckpointManifest): RecoveryPreview {
  const current = currentRelativeFiles(manifest.repo_root);
  const starting = new Map(manifest.files.map((file) => [file.path, file]));
  const paths: RecoveryPreviewPath[] = [];
  const allPaths = new Set([...starting.keys(), ...current.keys()]);

  for (const path of [...allPaths].sort()) {
    const start = starting.get(path);
    const now = current.get(path);
    if (start && !now) {
      paths.push({
        path,
        kind: "preexisting",
        starting_blob: start.blob,
        restore_action: "restore_blob",
        safe: true,
        note: "Starting dirty/untracked file is missing from the worktree. Restore would write the saved blob.",
      });
      continue;
    }
    if (!start && now) {
      const fromHead = headBlob(manifest.repo_root, path);
      if (fromHead && fromHead !== now) {
        paths.push({
          path,
          kind: "agent_modified",
          starting_blob: fromHead,
          current_blob: now,
          restore_action: "restore_blob",
          safe: true,
          note: "File was clean at start (HEAD). Restore would write the HEAD blob.",
        });
      } else if (fromHead && fromHead === now) {
        paths.push({
          path,
          kind: "preexisting",
          starting_blob: fromHead,
          current_blob: now,
          restore_action: "keep",
          safe: true,
          note: "Matches HEAD. Recovery will not touch this path.",
        });
      } else {
        paths.push({
          path,
          kind: "agent_created",
          current_blob: now,
          restore_action: "delete",
          safe: true,
          note: "File did not exist at start. Preview-only delete of agent-created path.",
        });
      }
      continue;
    }
    if (start && now && start.blob !== now) {
      paths.push({
        path,
        kind: start.status === "clean" ? "agent_modified" : "uncertain",
        starting_blob: start.blob,
        current_blob: now,
        restore_action: start.status === "clean" ? "restore_blob" : "manual_review",
        safe: start.status === "clean",
        note:
          start.status === "clean"
            ? "Clean-at-start file changed during the run. Restore would write the starting blob."
            : "File was already dirty at start and changed again. One-click restore is disabled; manual review required so preexisting work is not guessed.",
      });
      continue;
    }
    if (start && now && start.blob === now) {
      paths.push({
        path,
        kind: "preexisting",
        starting_blob: start.blob,
        current_blob: now,
        restore_action: "keep",
        safe: true,
        note: "Matches starting bytes. Recovery will not touch this path.",
      });
    }
  }

  const oneClickDisabled = paths.some((p) => !p.safe || p.kind === "uncertain");
  const preexistingMissing = paths.filter((p) => p.kind === "preexisting" && p.restore_action === "restore_blob" && !p.current_blob);
  const preview = {
    run_id: manifest.run_id,
    checkpoint_id: manifest.checkpoint_id,
    preexisting_work_intact: preexistingMissing.length === 0,
    one_click_disabled: oneClickDisabled,
    paths,
    limitations: [
      "Recovery never runs git reset --hard or git clean.",
      "Preexisting staged/unstaged/untracked bytes are stored as Git objects and remain recoverable even if the worktree changes.",
      "Concurrent human edits during the run disable one-click restore.",
      "Apply requires an explicit --confirm and the exact preview digest.",
    ],
  };
  return { ...preview, preview_digest: digestObject(preview) };
}

export function applyRecovery(manifest: CheckpointManifest, preview: RecoveryPreview, selected: string[]): { applied: string[]; skipped: string[] } {
  const allowed = new Set(preview.paths.filter((p) => p.safe && p.restore_action !== "keep").map((p) => p.path));
  const applied: string[] = [];
  const skipped: string[] = [];
  for (const path of selected) {
    const item = preview.paths.find((p) => p.path === path);
    if (!item || !allowed.has(path)) {
      skipped.push(path);
      continue;
    }
    const abs = join(manifest.repo_root, path);
    if (item.restore_action === "restore_blob" && item.starting_blob) {
      writeBlobToPath(manifest.repo_root, item.starting_blob, abs);
      applied.push(path);
    } else if (item.restore_action === "delete" && existsSync(abs)) {
      unlinkSync(abs);
      applied.push(path);
    } else {
      skipped.push(path);
    }
  }
  return { applied, skipped };
}
