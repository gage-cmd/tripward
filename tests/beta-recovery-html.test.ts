import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseArgs, bool } from "../src/commands/args.js";
import { emitRestore, PREVIEW_DIGEST_MISMATCH, RESTORE_APPLY_HINT } from "../src/commands/restore.js";
import { createCheckpoint, writeCheckpoint } from "../src/git/checkpoint.js";
import { applyRecovery, buildRecoveryPreview } from "../src/git/recovery.js";
import { restorePreviewCommand, restorePreviewHtmlCommand } from "../src/receipt/html.js";
import {
  DIGEST_CAPTION,
  EMPTY_SELECTION_HINT,
  FIXTURE_GENERATED_AT,
  LIMITATIONS_LEAD,
  renderRecoveryHtml,
} from "../src/recovery/html.js";
import {
  composeRestoreConfirmCommand,
  composedCommandPathsFlag,
  defaultSelectedRecoveryPaths,
  isSelectableRecoveryPath,
  recoveryPathCounts,
  selectedSubsetOfSafe,
} from "../src/recovery/selection.js";
import type { RecoveryPreview } from "../src/types.js";
import { gitInit, tempDir } from "./helpers.js";

const fixtureDir = join(process.cwd(), "fixtures/recovery");

function loadPreview(name: string): RecoveryPreview {
  return JSON.parse(readFileSync(join(fixtureDir, name), "utf8")) as RecoveryPreview;
}

function sectionOrder(html: string): string[] {
  return [...html.matchAll(/id="(header|summary|paths|apply|limitations)"/g)].map((m) => m[1]!);
}

function assertAppleBar(html: string) {
  expect(html).toContain("Tripward");
  expect(html).toContain("Recovery preview");
  expect(html).toContain("#F5F5F7");
  expect(html).toContain("#D2D2D7");
  expect(html).toContain("#0071E3");
  expect(html).toContain("max-width: 720px");
  expect(html).toContain("border-radius: 12px");
  expect(html).toContain("gap: 24px");
  expect(html).toContain("-apple-system");
  expect(html).toContain("tripward.dev");
  expect(html).not.toContain("https://tripward.dev");
  expect(html).not.toMatch(/fusecap/i);
  expect(html).not.toMatch(/<link\s/i);
  expect(html).not.toMatch(/@import/i);
  expect(html).not.toMatch(/<script\s+src=/i);
  expect(html).not.toMatch(/fonts\.googleapis/i);
  expect(html).not.toMatch(/https?:\/\//);
  expect(html).not.toMatch(/<button[^>]*>\s*(Restore|Apply|Rollback)/i);
}

describe("PR2 Apple-bar recovery HTML", () => {
  it("renders the all-safe fixture with IA, tokens, default selection, and golden match", () => {
    const preview = loadPreview("all-safe.json");
    const html = renderRecoveryHtml(preview, { receiptPresent: true, generatedAt: FIXTURE_GENERATED_AT });
    expect(sectionOrder(html)).toEqual(["header", "summary", "paths", "apply", "limitations"]);
    assertAppleBar(html);
    expect(html).toContain("Ready for selective restore");
    expect(html).toContain("Preexisting work is intact");
    expect(html).toContain(preview.preview_digest);
    expect(html).toContain("2 safe to apply");
    expect(html).toContain("Restore starting bytes");
    expect(html).toContain("Remove agent file");
    expect(html).toContain(LIMITATIONS_LEAD);
    expect(html).toContain(DIGEST_CAPTION);
    expect(html).toContain(`datetime="${FIXTURE_GENERATED_AT}"`);
    expect(html).toContain("(local)");
    expect(html).toContain('href="receipt.html"');
    expect(html).toContain(`tripward restore --confirm --digest ${preview.preview_digest} --paths src/app.ts,agent-new.txt ${preview.run_id}`);
    expect(html).toContain("<pre id=\"restore-cmd\"");
    expect(html).toMatch(
      /<pre id="restore-cmd"[^>]*>tripward restore --confirm --digest \S+ --paths src\/app\.ts,agent-new\.txt run_fixture_all_safe<\/pre>/,
    );
    expect(html).toContain("<p id=\"paths-flag\" class=\"secondary\">--paths src/app.ts,agent-new.txt</p>");
    expect(composedCommandPathsFlag(composeRestoreConfirmCommand(preview))).toBe("src/app.ts,agent-new.txt");
    expect(html).not.toContain("--paths=");
    expect(html).toMatch(/data-path="src\/app\.ts"[^>]*checked/);
    expect(html).toMatch(/data-path="agent-new\.txt"[^>]*checked/);
    expect(html).toContain("README.md is not selectable");
    expect(html).toBe(readFileSync(join(fixtureDir, "all-safe.html"), "utf8"));
  });

  it("renders uncertain / one_click_disabled with none checked and a manual review strip", () => {
    const preview = loadPreview("uncertain-one-click-disabled.json");
    const html = renderRecoveryHtml(preview, { generatedAt: FIXTURE_GENERATED_AT });
    expect(sectionOrder(html)).toEqual(["header", "summary", "paths", "apply", "limitations"]);
    assertAppleBar(html);
    expect(html).toContain("Manual review");
    expect(html).toContain("strip-amber");
    expect(html).toContain(LIMITATIONS_LEAD);
    expect(defaultSelectedRecoveryPaths(preview)).toEqual([]);
    expect(composeRestoreConfirmCommand(preview)).toBeNull();
    expect(html).toContain(EMPTY_SELECTION_HINT);
    expect(html).toContain('id="apply-copy" disabled');
    expect(html).not.toContain("--paths=");
    expect(html).not.toMatch(/<pre id="restore-cmd"[^>]*>tripward restore --confirm/);
    expect(html).toContain('data-path="agent-new.txt"');
    expect(html).not.toMatch(/data-path="agent-new\.txt"[^>]*checked/);
    expect(html).toContain("dirty.txt is not selectable");
    expect(html).not.toContain('href="receipt.html"');
    expect(html).toBe(readFileSync(join(fixtureDir, "uncertain-one-click-disabled.html"), "utf8"));
  });

  it("renders empty / keep-only with no selectable boxes", () => {
    const preview = loadPreview("empty-keep-only.json");
    const html = renderRecoveryHtml(preview, { generatedAt: FIXTURE_GENERATED_AT });
    expect(sectionOrder(html)).toEqual(["header", "summary", "paths", "apply", "limitations"]);
    assertAppleBar(html);
    expect(html).toContain("0 safe to apply");
    expect(html).toContain(EMPTY_SELECTION_HINT);
    expect(html).toContain('id="apply-copy" disabled');
    expect(html).not.toContain("--paths=");
    expect(html).not.toMatch(/<pre id="restore-cmd"[^>]*>tripward restore --confirm/);
    expect(composeRestoreConfirmCommand(preview)).toBeNull();
    expect(html).toContain("README.md is not selectable");
    expect(html).not.toContain("class=\"path-select\"");
    expect(html).toBe(readFileSync(join(fixtureDir, "empty-keep-only.html"), "utf8"));
  });

  it("fail-closes when preexisting work is not intact — rose strip, no apply compose", () => {
    const preview = loadPreview("fail-closed.json");
    const html = renderRecoveryHtml(preview, { generatedAt: FIXTURE_GENERATED_AT });
    expect(sectionOrder(html)).toEqual(["header", "summary", "paths", "limitations"]);
    assertAppleBar(html);
    expect(html).toContain("Fail closed");
    expect(html).toContain("Apply closed");
    expect(html).toContain("strip-rose");
    expect(html).toContain(LIMITATIONS_LEAD);
    expect(recoveryPathCounts(preview).selectable).toBe(0);
    expect(html).toContain("<li>0 selectable</li>");
    expect(html).not.toContain("<li>1 selectable</li>");
    expect(html).not.toContain('id="apply"');
    expect(html).not.toContain("tripward restore --confirm");
    expect(html).not.toContain("--paths=");
    expect(composeRestoreConfirmCommand(preview)).toBeNull();
    expect(html).toBe(readFileSync(join(fixtureDir, "fail-closed.html"), "utf8"));
  });

  it("keeps selection a subset of safe, non-keep, non-manual_review paths", () => {
    for (const name of [
      "all-safe.json",
      "uncertain-one-click-disabled.json",
      "empty-keep-only.json",
      "fail-closed.json",
    ]) {
      const preview = loadPreview(name);
      const selected = defaultSelectedRecoveryPaths(preview);
      expect(selectedSubsetOfSafe(preview, selected)).toEqual(selected);
      for (const path of selected) {
        const item = preview.paths.find((entry) => entry.path === path);
        expect(item).toBeTruthy();
        expect(isSelectableRecoveryPath(item!)).toBe(true);
        expect(item!.safe).toBe(true);
      }
      const sneaky = selectedSubsetOfSafe(preview, [...selected, "dirty.txt", "../escape", "notes.txt"]);
      expect(sneaky.every((path) => preview.paths.some((item) => item.path === path && isSelectableRecoveryPath(item)))).toBe(
        true,
      );
    }
    expect(
      isSelectableRecoveryPath({
        path: "dirty.txt",
        kind: "uncertain",
        restore_action: "restore_blob",
        safe: true,
        note: "synthetic: uncertain stays unselectable even if marked safe",
      }),
    ).toBe(false);
    expect(
      isSelectableRecoveryPath({
        path: "unsafe.ts",
        kind: "agent_modified",
        restore_action: "restore_blob",
        safe: false,
        note: "synthetic: !safe is never selectable",
      }),
    ).toBe(false);
    const uncertain = loadPreview("uncertain-one-click-disabled.json");
    expect(composeRestoreConfirmCommand(uncertain, [])).toBeNull();
    const selectedUncertain = composeRestoreConfirmCommand(uncertain, ["agent-new.txt"]);
    expect(selectedUncertain).toBe(
      `tripward restore --confirm --digest ${uncertain.preview_digest} --paths agent-new.txt ${uncertain.run_id}`,
    );
    expect(composedCommandPathsFlag(selectedUncertain)).toBe("agent-new.txt");
    expect(composeRestoreConfirmCommand(loadPreview("all-safe.json"), [])).toBeNull();
    expect(composedCommandPathsFlag(composeRestoreConfirmCommand(loadPreview("all-safe.json"), []))).toBeNull();
  });
});

describe("PR2 restore --preview --html CLI", () => {
  it("parses --preview --html [run_id] without swallowing the id", () => {
    const parsed = parseArgs(["node", "tripward", "restore", "--preview", "--html", "run_fixture_all_safe"]);
    expect(parsed.command).toBe("restore");
    expect(bool(parsed.flags, "preview")).toBe(true);
    expect(bool(parsed.flags, "html")).toBe(true);
    expect(parsed.rest).toEqual(["run_fixture_all_safe"]);
  });

  it("writes recovery.html beside the checkpoint and leaves JSON preview stdout contract intact", () => {
    const repo = gitInit(tempDir("restore-html-"));
    writeFileSync(join(repo, "agent-new.txt"), "new");
    const home = tempDir("home-");
    const runId = "run_html_preview";
    const dir = join(home, "runs", runId);
    mkdirSync(dir, { recursive: true });
    const checkpoint = createCheckpoint(repo, runId);
    writeCheckpoint(dir, checkpoint);
    const jsonOnly = emitRestore({ home, runId, preview: true });
    const withHtml = emitRestore({ home, runId, preview: true, html: true });
    expect(jsonOnly.kind).toBe("preview");
    expect(withHtml.kind).toBe("preview");
    if (jsonOnly.kind !== "preview" || withHtml.kind !== "preview") throw new Error("expected preview");
    expect(withHtml.preview).toEqual(jsonOnly.preview);
    expect(withHtml.htmlPath).toBe(join(dir, "recovery.html"));
    expect(statSync(withHtml.htmlPath!).mode & 0o777).toBe(0o600);
    const written = readFileSync(withHtml.htmlPath!, "utf8");
    expect(written).toContain(withHtml.preview.preview_digest);
    expect(written).toContain("This page does not restore");
    expect(RESTORE_APPLY_HINT).toContain("--confirm --digest");
  });

  it("prints the same --preview JSON on stdout when --html is added", () => {
    const repo = gitInit(tempDir("stdout-"));
    const home = tempDir("home-stdout-");
    const runId = "run_stdout";
    const dir = join(home, "runs", runId);
    mkdirSync(dir, { recursive: true });
    writeCheckpoint(dir, createCheckpoint(repo, runId));
    const cli = join(process.cwd(), "src/cli.ts");
    const jsonOut = execFileSync("npx", ["tsx", cli, "restore", "--preview", runId, "--home", home, "--cwd", repo], {
      encoding: "utf8",
    });
    const htmlRun = execFileSync("npx", ["tsx", cli, "restore", "--preview", "--html", runId, "--home", home, "--cwd", repo], {
      encoding: "utf8",
    });
    expect(jsonOut).toBe(htmlRun);
    expect(jsonOut).toContain("preview_digest");
    expect(jsonOut).toContain(RESTORE_APPLY_HINT);
    expect(jsonOut).not.toContain("recovery.html");
  });

  it("links to receipt.html only when that file is already in the run dir", () => {
    const repo = gitInit(tempDir("restore-link-"));
    const home = tempDir("home-link-");
    const runId = "run_html_link";
    const dir = join(home, "runs", runId);
    mkdirSync(dir, { recursive: true });
    writeCheckpoint(dir, createCheckpoint(repo, runId));
    const first = emitRestore({ home, runId, preview: true, html: true });
    if (first.kind !== "preview" || !first.htmlPath) throw new Error("expected html");
    expect(readFileSync(first.htmlPath, "utf8")).not.toContain('href="receipt.html"');
    writeFileSync(join(dir, "receipt.html"), "<html>receipt</html>");
    const second = emitRestore({ home, runId, preview: true, html: true });
    if (second.kind !== "preview" || !second.htmlPath) throw new Error("expected html");
    expect(readFileSync(second.htmlPath, "utf8")).toContain('href="receipt.html"');
  });

  it("still aborts apply on digest mismatch and does not write the worktree", () => {
    const repo = gitInit(tempDir("digest-"));
    const home = tempDir("home-digest-");
    const runId = "run_digest";
    const dir = join(home, "runs", runId);
    mkdirSync(dir, { recursive: true });
    writeCheckpoint(dir, createCheckpoint(repo, runId));
    writeFileSync(join(repo, "agent-new.txt"), "new");
    const preview = emitRestore({ home, runId, preview: true });
    if (preview.kind !== "preview") throw new Error("expected preview");
    expect(() =>
      emitRestore({
        home,
        runId,
        confirm: true,
        digest: "sha256:wrong",
        paths: "agent-new.txt",
      }),
    ).toThrow(PREVIEW_DIGEST_MISMATCH);
    expect(readFileSync(join(repo, "agent-new.txt"), "utf8")).toBe("new");
    const applied = emitRestore({
      home,
      runId,
      confirm: true,
      digest: preview.preview.preview_digest,
      paths: "agent-new.txt",
    });
    expect(applied.kind).toBe("apply");
    if (applied.kind !== "apply") throw new Error("expected apply");
    expect(applied.applied).toContain("agent-new.txt");
  });
});

describe("receipt secondary HTML preview CTA", () => {
  it("keeps the JSON preview command and adds --preview --html", () => {
    expect(restorePreviewCommand("run_x")).toBe("tripward restore --preview run_x");
    expect(restorePreviewHtmlCommand("run_x")).toBe("tripward restore --preview --html run_x");
  });
});

describe("applyRecovery only allowed paths", () => {
  it("skips uncertain and keep paths even if named", () => {
    const repo = gitInit(tempDir("allowed-"));
    writeFileSync(join(repo, "dirty.txt"), "keep-me");
    const checkpoint = createCheckpoint(repo, "run_allowed");
    writeFileSync(join(repo, "dirty.txt"), "agent-overwrote");
    writeFileSync(join(repo, "agent-new.txt"), "new");
    const preview = buildRecoveryPreview(checkpoint);
    const result = applyRecovery(checkpoint, preview, ["dirty.txt", "agent-new.txt", "README.md"]);
    expect(result.applied).toEqual(["agent-new.txt"]);
    expect(result.skipped).toEqual(["dirty.txt", "README.md"]);
    expect(readFileSync(join(repo, "dirty.txt"), "utf8")).toBe("agent-overwrote");
  });
});
