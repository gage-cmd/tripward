import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCheckpoint } from "../src/git/checkpoint.js";
import { git } from "../src/git/git.js";
import { applyRecovery, buildRecoveryPreview } from "../src/git/recovery.js";
import { isSelectableRecoveryPath } from "../src/recovery/selection.js";
import type { CheckpointManifest } from "../src/types.js";
import { gitInit, tempDir } from "./helpers.js";

function blobExists(repo: string, blob: string): boolean {
  try {
    git(repo, ["cat-file", "-e", blob]);
    return true;
  } catch {
    return false;
  }
}

function assertStartingBytesIntact(manifest: CheckpointManifest): void {
  for (const file of manifest.files) {
    expect(blobExists(manifest.repo_root, file.blob), `lost starting blob for ${file.path}`).toBe(true);
  }
}

function previewDoesNotMutate(repo: string, manifest: CheckpointManifest, files: string[]): ReturnType<typeof buildRecoveryPreview> {
  const before = Object.fromEntries(files.filter((path) => existsSync(join(repo, path))).map((path) => [path, readFileSync(join(repo, path), "utf8")]));
  const preview = buildRecoveryPreview(manifest);
  for (const [path, bytes] of Object.entries(before)) {
    expect(readFileSync(join(repo, path), "utf8"), `preview mutated ${path}`).toBe(bytes);
  }
  assertStartingBytesIntact(manifest);
  return preview;
}

describe("E7 zero-loss recovery matrix", () => {
  it("clean-at-start agent edit: preview leaves bytes; apply restores HEAD", () => {
    const repo = gitInit(tempDir("mx-clean-"));
    writeFileSync(join(repo, "tracked.txt"), "clean-v1\n");
    execFileSync("git", ["add", "tracked.txt"], { cwd: repo });
    execFileSync("git", ["commit", "-m", "tracked"], { cwd: repo });
    const checkpoint = createCheckpoint(repo, "run_clean");
    expect(checkpoint.files.some((file) => file.path === "tracked.txt")).toBe(false);
    writeFileSync(join(repo, "tracked.txt"), "agent-edit\n");
    const preview = previewDoesNotMutate(repo, checkpoint, ["tracked.txt"]);
    const row = preview.paths.find((item) => item.path === "tracked.txt");
    expect(row?.kind).toBe("agent_modified");
    expect(row?.safe).toBe(true);
    expect(row && isSelectableRecoveryPath(row)).toBe(true);
    const applied = applyRecovery(checkpoint, preview, ["tracked.txt"]);
    expect(applied.applied).toEqual(["tracked.txt"]);
    expect(readFileSync(join(repo, "tracked.txt"), "utf8")).toBe("clean-v1\n");
    assertStartingBytesIntact(checkpoint);
  });

  it("dirty-at-start unchanged: keep; apply of other paths does not delete dirty bytes", () => {
    const repo = gitInit(tempDir("mx-dirty-"));
    writeFileSync(join(repo, "dirty.txt"), "keep-me");
    const checkpoint = createCheckpoint(repo, "run_dirty");
    writeFileSync(join(repo, "agent-new.txt"), "new");
    const preview = previewDoesNotMutate(repo, checkpoint, ["dirty.txt"]);
    const dirty = preview.paths.find((item) => item.path === "dirty.txt");
    expect(dirty?.restore_action).toBe("keep");
    expect(dirty && isSelectableRecoveryPath(dirty)).toBe(false);
    applyRecovery(checkpoint, preview, ["dirty.txt", "agent-new.txt"]);
    expect(readFileSync(join(repo, "dirty.txt"), "utf8")).toBe("keep-me");
    expect(existsSync(join(repo, "agent-new.txt"))).toBe(false);
    assertStartingBytesIntact(checkpoint);
  });

  it("staged-at-start then overwritten: uncertain; apply cannot take it", () => {
    const repo = gitInit(tempDir("mx-staged-"));
    writeFileSync(join(repo, "staged.txt"), "staged-v1");
    execFileSync("git", ["add", "staged.txt"], { cwd: repo });
    const checkpoint = createCheckpoint(repo, "run_staged");
    writeFileSync(join(repo, "staged.txt"), "agent-overwrote");
    const preview = previewDoesNotMutate(repo, checkpoint, ["staged.txt"]);
    const row = preview.paths.find((item) => item.path === "staged.txt");
    expect(row?.kind).toBe("uncertain");
    expect(row?.safe).toBe(false);
    expect(preview.one_click_disabled).toBe(true);
    expect(row && isSelectableRecoveryPath(row)).toBe(false);
    const applied = applyRecovery(checkpoint, preview, ["staged.txt"]);
    expect(applied.applied).toEqual([]);
    expect(applied.skipped).toEqual(["staged.txt"]);
    expect(readFileSync(join(repo, "staged.txt"), "utf8")).toBe("agent-overwrote");
    expect(blobExists(repo, checkpoint.files.find((file) => file.path === "staged.txt")!.blob)).toBe(true);
    assertStartingBytesIntact(checkpoint);
  });

  it("untracked-at-start then overwritten: uncertain; preexisting bytes stay in the object store", () => {
    const repo = gitInit(tempDir("mx-untracked-"));
    writeFileSync(join(repo, "untracked.txt"), "untracked-v1");
    const checkpoint = createCheckpoint(repo, "run_untracked");
    writeFileSync(join(repo, "untracked.txt"), "agent-overwrote");
    const preview = previewDoesNotMutate(repo, checkpoint, ["untracked.txt"]);
    const row = preview.paths.find((item) => item.path === "untracked.txt");
    expect(row?.kind).toBe("uncertain");
    expect(row && isSelectableRecoveryPath(row)).toBe(false);
    applyRecovery(checkpoint, preview, ["untracked.txt"]);
    expect(readFileSync(join(repo, "untracked.txt"), "utf8")).toBe("agent-overwrote");
    expect(blobExists(repo, checkpoint.files.find((file) => file.path === "untracked.txt")!.blob)).toBe(true);
    assertStartingBytesIntact(checkpoint);
  });

  it("external edit after checkpoint of a dirty file disables one-click and is not applied", () => {
    const repo = gitInit(tempDir("mx-external-"));
    writeFileSync(join(repo, "notes.txt"), "human-v1");
    const checkpoint = createCheckpoint(repo, "run_external");
    writeFileSync(join(repo, "notes.txt"), "human-v2-external");
    const preview = previewDoesNotMutate(repo, checkpoint, ["notes.txt"]);
    const row = preview.paths.find((item) => item.path === "notes.txt");
    expect(row?.kind).toBe("uncertain");
    expect(preview.one_click_disabled).toBe(true);
    applyRecovery(checkpoint, preview, ["notes.txt"]);
    expect(readFileSync(join(repo, "notes.txt"), "utf8")).toBe("human-v2-external");
    assertStartingBytesIntact(checkpoint);
  });

  it("uncertain mix: apply only the allowed agent-created path", () => {
    const repo = gitInit(tempDir("mx-mix-"));
    writeFileSync(join(repo, "dirty.txt"), "keep-me");
    const checkpoint = createCheckpoint(repo, "run_mix");
    writeFileSync(join(repo, "dirty.txt"), "agent-overwrote");
    writeFileSync(join(repo, "agent-new.txt"), "new");
    const preview = previewDoesNotMutate(repo, checkpoint, ["dirty.txt"]);
    expect(preview.paths.some((item) => item.kind === "uncertain")).toBe(true);
    const allowed = preview.paths.filter(isSelectableRecoveryPath).map((item) => item.path);
    expect(allowed).toEqual(["agent-new.txt"]);
    const applied = applyRecovery(checkpoint, preview, ["dirty.txt", "agent-new.txt"]);
    expect(applied.applied).toEqual(["agent-new.txt"]);
    expect(readFileSync(join(repo, "dirty.txt"), "utf8")).toBe("agent-overwrote");
    assertStartingBytesIntact(checkpoint);
  });
});
