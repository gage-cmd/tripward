import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCheckpoint } from "../src/git/checkpoint.js";
import { porcelain } from "../src/git/git.js";
import { applyRecovery, buildRecoveryPreview } from "../src/git/recovery.js";
import { gitInit, tempDir } from "./helpers.js";

describe("E7 git safety", () => {
  it("records a starting manifest without changing a dirty tree", () => {
    const repo = gitInit(tempDir("repo-"));
    writeFileSync(join(repo, "staged.txt"), "staged-v1");
    execFileSync("git", ["add", "staged.txt"], { cwd: repo });
    writeFileSync(join(repo, "unstaged.txt"), "unstaged-v1");
    writeFileSync(join(repo, "README.md"), "hello\nlocal edit\n");
    writeFileSync(join(repo, "untracked.txt"), "untracked-v1");
    const before = porcelain(repo);
    const checkpoint = createCheckpoint(repo, "run_git");
    const after = porcelain(repo);
    expect(checkpoint.verified).toBe(true);
    expect(checkpoint.dirty).toBe(true);
    expect(checkpoint.files.some((f) => f.path === "untracked.txt" && f.status === "untracked")).toBe(true);
    expect(checkpoint.files.some((f) => f.path === "staged.txt")).toBe(true);
    expect(after.map((e) => `${e.xy}:${e.path}`).sort()).toEqual(before.map((e) => `${e.xy}:${e.path}`).sort());
    expect(readFileSync(join(repo, "untracked.txt"), "utf8")).toBe("untracked-v1");
    expect(readFileSync(join(repo, "staged.txt"), "utf8")).toBe("staged-v1");
    expect(readFileSync(join(repo, "README.md"), "utf8")).toContain("local edit");
  });

  it("preview is required and restore cannot lose starting dirty bytes", () => {
    const repo = gitInit(tempDir("repo2-"));
    writeFileSync(join(repo, "dirty.txt"), "keep-me");
    const checkpoint = createCheckpoint(repo, "run_git2");
    writeFileSync(join(repo, "dirty.txt"), "agent-overwrote");
    writeFileSync(join(repo, "agent-new.txt"), "new");
    const preview = buildRecoveryPreview(checkpoint);
    expect(preview.paths.some((p) => p.path === "dirty.txt" && p.kind === "uncertain")).toBe(true);
    expect(preview.one_click_disabled).toBe(true);
    expect(preview.limitations.some((l) => l.includes("never runs git reset"))).toBe(true);
    const restored = applyRecovery(checkpoint, preview, ["agent-new.txt"]);
    expect(restored.applied).toContain("agent-new.txt");
    expect(readFileSync(join(repo, "dirty.txt"), "utf8")).toBe("agent-overwrote");
    expect(checkpoint.files.find((f) => f.path === "dirty.txt")?.blob).toBeTruthy();
  });
});
