import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { receiptHtmlPath, escapeHtml, formatLocalTime } from "../receipt/html.js";
import type { RecoveryPreview, RecoveryPreviewPath } from "../types.js";
import {
  composeRestoreConfirmCommand,
  defaultSelectedRecoveryPaths,
  isSelectableRecoveryPath,
  recoveryPathCounts,
} from "./selection.js";

export const RECOVERY_PAGE_HINT =
  "This page does not restore. Checkboxes only rewrite the command below. Apply stays in the terminal and is refused unless --digest matches the current preview digest.";

export const FAIL_CLOSED_HINT =
  "Preexisting work is not intact. Apply is closed. Review the checkpoint objects manually — Tripward will not compose a restore command.";

export const MANUAL_REVIEW_HINT =
  "Manual review required. One-click restore is disabled. Select only paths you have inspected; uncertain rows stay unselected.";

export const INTACT_HINT =
  "Preexisting work is intact. Select safe paths, copy the command, and run it in a terminal. This page never writes the worktree.";

export const LIMITATIONS_LEAD = "What this preview will not do.";

export const EMPTY_SELECTION_HINT = "Select at least one safe path, or leave recovery unused.";

export const DIGEST_CAPTION =
  "Apply is refused unless `--digest` matches this value. Refresh preview if the worktree changed.";

export const FIXTURE_GENERATED_AT = "2026-09-06T16:00:00.000Z";

export function recoveryHtmlPath(runDirectory: string): string {
  return join(runDirectory, "recovery.html");
}

export function restorePreviewHtmlCommand(runId: string): string {
  return `tripward restore --preview --html ${runId}`;
}

function kindLabel(kind: RecoveryPreviewPath["kind"]): string {
  switch (kind) {
    case "agent_modified":
      return "Agent modified";
    case "agent_created":
      return "Agent created";
    case "preexisting":
      return "Preexisting";
    case "uncertain":
      return "Uncertain";
    default:
      return kind;
  }
}

function actionLabel(action: RecoveryPreviewPath["restore_action"]): string {
  switch (action) {
    case "restore_blob":
      return "Restore starting bytes";
    case "delete":
      return "Remove agent file";
    case "keep":
      return "Keep";
    case "manual_review":
      return "Manual review";
    default:
      return action;
  }
}

function timeEl(iso: string): string {
  return `<time datetime="${escapeHtml(iso)}">${escapeHtml(formatLocalTime(iso))}</time>`;
}

function safetyStrip(preview: RecoveryPreview): { id: string; title: string; body: string; cls: string } {
  if (!preview.preexisting_work_intact) {
    return { id: "strip-fail-closed", title: "Fail closed", body: FAIL_CLOSED_HINT, cls: "strip-rose" };
  }
  if (preview.one_click_disabled) {
    return { id: "strip-manual-review", title: "Manual review", body: MANUAL_REVIEW_HINT, cls: "strip-amber" };
  }
  return { id: "strip-intact", title: "Ready for selective restore", body: INTACT_HINT, cls: "strip-ok" };
}

function pathRow(item: RecoveryPreviewPath, failClosed: boolean, checked: boolean): string {
  const selectable = !failClosed && isSelectableRecoveryPath(item);
  const box = selectable
    ? `<input type="checkbox" class="path-select" data-path="${escapeHtml(item.path)}"${checked ? " checked" : ""} aria-label="Select ${escapeHtml(item.path)}">`
    : `<input type="checkbox" disabled aria-label="${escapeHtml(item.path)} is not selectable">`;
  return `<tr class="${selectable ? "row-selectable" : "row-locked"}" data-kind="${escapeHtml(item.kind)}" data-safe="${item.safe ? "true" : "false"}">
  <td class="col-select">${box}</td>
  <td><code>${escapeHtml(item.path)}</code></td>
  <td>${escapeHtml(kindLabel(item.kind))}</td>
  <td>${escapeHtml(actionLabel(item.restore_action))}</td>
  <td>${item.safe ? "Safe" : "Not safe"}</td>
  <td>${escapeHtml(item.note)}</td>
</tr>`;
}

export function renderRecoveryHtml(
  preview: RecoveryPreview,
  options: { receiptPresent?: boolean; generatedAt?: string } = {},
): string {
  const failClosed = !preview.preexisting_work_intact;
  const selected = defaultSelectedRecoveryPaths(preview);
  const selectedSet = new Set(selected);
  const counts = recoveryPathCounts(preview);
  const strip = safetyStrip(preview);
  const command = composeRestoreConfirmCommand(preview, selected);
  const receiptLink = options.receiptPresent
    ? `<p class="secondary"><a href="receipt.html">Receipt</a></p>`
    : "";
  const generated =
    options.generatedAt && !Number.isNaN(Date.parse(options.generatedAt))
      ? `<p class="secondary">Generated ${timeEl(options.generatedAt)}</p>`
      : "";
  const rows =
    preview.paths.length > 0
      ? preview.paths.map((item) => pathRow(item, failClosed, selectedSet.has(item.path))).join("\n")
      : `<tr class="row-empty"><td colspan="6">No paths in this preview. Recovery will not change the worktree.</td></tr>`;
  const headline = failClosed ? "Apply closed" : `${counts.selectable} safe to apply`;
  const apply =
    failClosed
      ? ""
      : `<section id="apply" class="card">
    <h2>Apply in terminal</h2>
    <p class="secondary">${escapeHtml(RECOVERY_PAGE_HINT)}</p>
    <p id="empty-selection" class="secondary"${command ? " hidden" : ""}>${escapeHtml(EMPTY_SELECTION_HINT)}</p>
    <div class="cmd-row" id="cmd-row"${command ? "" : " hidden"}>
      <pre id="restore-cmd" data-digest="${escapeHtml(preview.preview_digest)}" data-run="${escapeHtml(preview.run_id)}" aria-label="Apply restore command">${escapeHtml(command ?? "")}</pre>
      <button type="button" class="copy-link" id="apply-copy"${command ? ` data-copy="${escapeHtml(command)}"` : " disabled"}>Copy</button>
    </div>
  </section>`;
  const composeScript = failClosed
    ? ""
    : `
  var field = document.getElementById("restore-cmd");
  var copy = document.getElementById("apply-copy");
  var empty = document.getElementById("empty-selection");
  var row = document.getElementById("cmd-row");
  function selectedPaths() {
    var nodes = document.querySelectorAll("input.path-select:checked");
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var path = nodes[i].getAttribute("data-path");
      if (path) out.push(path);
    }
    return out;
  }
  function compose(digest, runId, paths) {
    if (!paths.length) return "";
    return "tripward restore --confirm --digest " + digest + " --paths " + paths.join(",") + " " + runId;
  }
  function setHidden(node, hidden) {
    if (!node) return;
    if (hidden) node.setAttribute("hidden", "");
    else node.removeAttribute("hidden");
  }
  function rewrite() {
    if (!field) return;
    var digest = field.getAttribute("data-digest") || "";
    var runId = field.getAttribute("data-run") || "";
    var paths = selectedPaths();
    var next = compose(digest, runId, paths);
    field.textContent = next;
    if (copy) {
      if (next) {
        copy.setAttribute("data-copy", next);
        copy.disabled = false;
      } else {
        copy.removeAttribute("data-copy");
        copy.disabled = true;
      }
    }
    setHidden(empty, Boolean(next));
    setHidden(row, !next);
  }
  document.addEventListener("change", function (event) {
    var target = event.target;
    if (!target || !target.classList || !target.classList.contains("path-select")) return;
    rewrite();
  });`;
  const script = `<script>
(function () {
${composeScript}
  var nodes = document.querySelectorAll("time[datetime]");
  for (var i = 0; i < nodes.length; i++) {
    var iso = nodes[i].getAttribute("datetime");
    var d = new Date(iso);
    if (isNaN(d.getTime())) continue;
    nodes[i].textContent = d.toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", second: "2-digit"
    }) + " (local)";
  }
  document.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.getAttribute) return;
    if (target.disabled) return;
    var text = target.getAttribute("data-copy");
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      var cmd = document.getElementById("restore-cmd");
      if (cmd && window.getSelection && cmd.textContent) {
        var range = document.createRange();
        range.selectNodeContents(cmd);
        var sel = window.getSelection();
        if (sel) { sel.removeAllRanges(); sel.addRange(range); }
      }
    }
    target.textContent = "Copied";
    setTimeout(function () { target.textContent = "Copy"; }, 1500);
  });
})();
</script>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tripward recovery preview ${escapeHtml(preview.run_id)}</title>
<style>
html, body { margin: 0; padding: 0; background: #F5F5F7; color: #1D1D1F; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  line-height: 1.45;
}
main {
  box-sizing: border-box;
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 24px 48px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.card {
  background: #ffffff;
  border-radius: 12px;
  padding: 16px 24px;
}
#header { padding-top: 24px; padding-bottom: 24px; }
.brand-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.titles { display: flex; flex-direction: column; gap: 0; }
.wordmark { margin: 0; font-size: 21px; font-weight: 600; letter-spacing: -0.02em; }
.doc-title { margin: 4px 0 0; font-size: 15px; font-weight: 600; color: #6E6E73; }
.secondary { color: #6E6E73; margin: 8px 0 0; font-size: 13px; }
h2 { margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #6E6E73; letter-spacing: 0.02em; text-transform: uppercase; }
.headline { margin: 0; font-size: 21px; font-weight: 600; letter-spacing: -0.02em; }
.strip {
  margin: 16px 0 0;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid #D2D2D7;
}
.strip-ok { background: rgba(52, 199, 89, 0.12); }
.strip-amber { background: rgba(255, 149, 0, 0.12); }
.strip-rose { background: rgba(255, 59, 48, 0.12); }
.strip-title { margin: 0; font-size: 15px; font-weight: 600; }
.strip-ok .strip-title { color: #1F7A33; }
.strip-amber .strip-title { color: #C93400; }
.strip-rose .strip-title { color: #D70015; }
.strip p { margin: 8px 0 0; font-size: 13px; }
.counts { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; margin: 16px 0 0; padding: 0; }
.counts li { margin: 0; padding: 4px 10px; border-radius: 999px; font-size: 13px; font-weight: 600; background: #F5F5F7; }
.digest-row { display: flex; align-items: center; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #D2D2D7; }
.digest-row span { width: 104px; flex: 0 0 104px; color: #6E6E73; font-size: 13px; }
.digest-row code, td code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  word-break: break-all;
}
.cmd-row { display: flex; align-items: flex-start; gap: 8px; margin-top: 8px; }
#restore-cmd {
  flex: 1;
  margin: 0;
  box-sizing: border-box;
  border-radius: 12px;
  background: #F5F5F7;
  color: #1D1D1F;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  padding: 8px 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.copy-link {
  border: 0;
  background: transparent;
  color: #0071E3;
  font: inherit;
  font-size: 15px;
  padding: 8px;
  cursor: pointer;
  border-radius: 8px;
}
.copy-link:focus-visible {
  outline: 2px solid #0071E3;
  outline-offset: 2px;
}
.copy-link:disabled {
  color: #6E6E73;
  cursor: default;
}
[hidden] { display: none; }
a { color: #0071E3; text-decoration: none; }
a:focus-visible { outline: 2px solid #0071E3; outline-offset: 2px; }
table { width: 100%; border-collapse: collapse; margin-top: 8px; }
th, td { text-align: left; vertical-align: top; padding: 8px 8px 8px 0; font-size: 13px; }
th { color: #6E6E73; font-weight: 600; }
td { border-top: 1px solid #D2D2D7; }
.col-select { width: 32px; }
#limitations .lead { margin: 0 0 8px; }
#limitations ul { margin: 8px 0 0; padding-left: 18px; }
#limitations li { margin: 8px 0; }
#footer { background: transparent; padding: 8px 8px 0; color: #6E6E73; font-size: 13px; }
</style>
</head>
<body>
<main>
  <section id="header" class="card">
    <div class="brand-row">
      <div class="titles">
        <p class="wordmark">Tripward</p>
        <h1 class="doc-title">Recovery preview</h1>
      </div>
    </div>
    <p class="secondary">Run ${escapeHtml(preview.run_id)} · Checkpoint ${escapeHtml(preview.checkpoint_id)}</p>
    ${generated}
    ${receiptLink}
    <div id="${strip.id}" class="strip ${strip.cls}">
      <p class="strip-title">${escapeHtml(strip.title)}</p>
      <p>${escapeHtml(strip.body)}</p>
    </div>
  </section>

  <section id="summary" class="card">
    <h2>Summary</h2>
    <p class="headline">${headline}</p>
    <ul class="counts">
      <li>${counts.total} paths</li>
      <li>${counts.selectable} selectable</li>
      <li>${counts.uncertain} uncertain</li>
      <li>${counts.keep} keep</li>
    </ul>
    <p class="secondary">${escapeHtml(DIGEST_CAPTION)}</p>
    <div class="digest-row">
      <span>Digest</span>
      <code id="preview-digest">${escapeHtml(preview.preview_digest)}</code>
      <button type="button" class="copy-link" data-copy="${escapeHtml(preview.preview_digest)}">Copy</button>
    </div>
  </section>

  <section id="paths" class="card">
    <h2>Paths</h2>
    <table>
      <thead><tr><th></th><th>Path</th><th>Kind</th><th>Action</th><th>Safety</th><th>Note</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>
  </section>

  ${apply}

  <section id="limitations" class="card">
    <h2>Limitations</h2>
    <p class="lead">${escapeHtml(LIMITATIONS_LEAD)}</p>
    <ul>${preview.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  </section>

  <p id="footer">Private local recovery preview · tripward.dev</p>
</main>
${script}
</body>
</html>
`;
}

export function writeRecoveryHtml(runDirectory: string, preview: RecoveryPreview): string {
  const html = recoveryHtmlPath(runDirectory);
  const receiptPresent = existsSync(receiptHtmlPath(runDirectory));
  writeFileSync(html, renderRecoveryHtml(preview, { receiptPresent, generatedAt: new Date().toISOString() }), { mode: 0o600 });
  return html;
}
