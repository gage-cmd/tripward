import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import type { ReceiptDocument, ReceiptOutcome } from "../types.js";
import type { RedactedReceipt } from "./redact.js";

export const TRIPWARD_URL = "https://tripward.dev";

export const RECOVERY_PREVIEW_HINT =
  "This page does not restore. Preview is required (ADR 0005). Apply stays in the CLI and is refused unless --digest matches the current preview digest. Tripward will not silently reset a dirty tree.";

export type ReceiptHtmlSource = ReceiptDocument | RedactedReceipt;

export type UsageKind = "Actual" | "Estimate" | "Unavailable";

export function receiptHtmlPath(runDirectory: string): string {
  return join(runDirectory, "receipt.html");
}

export function restorePreviewCommand(runId: string): string {
  return `tripward restore --preview ${runId}`;
}

export function usageKind(usage: {
  cost: unknown;
  source: string;
  confidence: string;
}): UsageKind {
  if (usage.cost == null || usage.source === "unavailable" || usage.confidence === "unavailable") {
    return "Unavailable";
  }
  const source = usage.source.toLowerCase();
  if (source.includes("estimate") || usage.confidence === "estimate") {
    return "Estimate";
  }
  return "Actual";
}

function outcomeLabel(outcome: ReceiptOutcome | string): string {
  switch (outcome) {
    case "completed":
      return "Completed";
    case "warned":
      return "Warned";
    case "blocked":
      return "Blocked";
    case "terminated":
      return "Terminated";
    case "crashed":
      return "Crashed";
    case "user-canceled":
      return "Canceled";
    default:
      return String(outcome);
  }
}

function triggerHeadline(view: ReceiptHtmlSource): string {
  if (!view.trigger) {
    return `Session ${outcomeLabel(view.outcome).toLowerCase()} (${view.exit_reason.replaceAll("_", " ")}).`;
  }
  const parts = [view.exit_reason.replaceAll("_", " ")];
  parts.push(view.trigger.rule);
  if (view.trigger.observed_value !== undefined) parts.push(`observed ${view.trigger.observed_value}`);
  if (view.trigger.threshold !== undefined) parts.push(`threshold ${view.trigger.threshold}`);
  return parts.join(" · ");
}

export function renderHtml(receipt: ReceiptHtmlSource): string {
  const kind = usageKind(receipt.usage);
  const command = restorePreviewCommand(receipt.run_id);
  const healthReasons =
    receipt.environment.health_reasons.length > 0
      ? `<ul class="reasons">${receipt.environment.health_reasons.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : `<p class="secondary">No health reasons recorded.</p>`;
  const rows = receipt.timeline
    .map(
      (item) =>
        `<tr><td>${item.sequence}</td><td>${escapeHtml(item.wall_time)}</td><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.summary)}</td></tr>`,
    )
    .join("\n");
  const triggerBody = receipt.trigger
    ? `<dl>
  <div><dt>Rule</dt><dd>${escapeHtml(receipt.trigger.rule)}</dd></div>
  <div><dt>Threshold</dt><dd>${escapeHtml(receipt.trigger.threshold === undefined ? "—" : String(receipt.trigger.threshold))}</dd></div>
  <div><dt>Observed</dt><dd>${escapeHtml(receipt.trigger.observed_value === undefined ? "—" : String(receipt.trigger.observed_value))}</dd></div>
  <div><dt>Confidence</dt><dd>${escapeHtml(receipt.trigger.confidence)}</dd></div>
  <div><dt>Action</dt><dd>${escapeHtml(receipt.trigger.action)}${receipt.trigger.action_executed ? " (executed)" : ""}</dd></div>
</dl>`
    : `<p class="secondary">No fuse trip. The session ended without a trigger.</p>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tripward receipt ${escapeHtml(receipt.run_id)}</title>
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
  gap: 16px;
}
.card {
  background: #ffffff;
  border-radius: 12px;
  padding: 16px 24px;
}
#header { padding-top: 24px; padding-bottom: 24px; }
.brand-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.wordmark { margin: 0; font-size: 21px; font-weight: 600; letter-spacing: -0.02em; }
.pill {
  margin: 0;
  padding: 4px 10px;
  border-radius: 999px;
  background: #F5F5F7;
  color: #1D1D1F;
  font-size: 13px;
  font-weight: 600;
}
.secondary { color: #6E6E73; margin: 8px 0 0; font-size: 13px; }
h2 { margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #6E6E73; letter-spacing: 0.02em; text-transform: uppercase; }
.health-value, .usage-value, .headline { margin: 0; font-size: 21px; font-weight: 600; letter-spacing: -0.02em; }
.usage { margin-top: 16px; padding-top: 16px; border-top: 1px solid #F5F5F7; }
.reasons { margin: 8px 0 0; padding-left: 18px; }
.reasons li { margin: 4px 0; }
dl { margin: 16px 0 0; }
dl > div { display: flex; gap: 16px; padding: 8px 0; border-top: 1px solid #F5F5F7; }
dt { width: 104px; flex: 0 0 104px; color: #6E6E73; font-size: 13px; }
dd { margin: 0; }
.cta { margin-top: 16px; padding-top: 16px; border-top: 1px solid #F5F5F7; }
.cmd-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.cmd-row input {
  flex: 1;
  box-sizing: border-box;
  border: 0;
  border-radius: 12px;
  background: #F5F5F7;
  color: #1D1D1F;
  font: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  padding: 8px 12px;
}
.copy-link {
  border: 0;
  background: transparent;
  color: #0071E3;
  font: inherit;
  font-size: 15px;
  padding: 8px;
  cursor: pointer;
}
a { color: #0071E3; text-decoration: none; }
table { width: 100%; border-collapse: collapse; margin-top: 8px; }
th, td { text-align: left; vertical-align: top; padding: 8px 8px 8px 0; font-size: 13px; }
th { color: #6E6E73; font-weight: 600; }
td { border-top: 1px solid #F5F5F7; }
#limitations ul { margin: 8px 0 0; padding-left: 18px; }
#limitations li { margin: 8px 0; }
.digest-row { display: flex; gap: 16px; padding: 8px 0; border-top: 1px solid #F5F5F7; }
.digest-row:first-of-type { border-top: 0; }
.digest-row span { width: 104px; flex: 0 0 104px; color: #6E6E73; font-size: 13px; }
.digest-row code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; word-break: break-all; }
#footer { background: transparent; padding: 8px 8px 0; color: #6E6E73; font-size: 13px; }
</style>
</head>
<body>
<main>
  <section id="header" class="card">
    <div class="brand-row">
      <h1 class="wordmark">Tripward</h1>
      <p class="pill">${escapeHtml(outcomeLabel(receipt.outcome))}</p>
    </div>
    <p class="secondary">Run ${escapeHtml(receipt.run_id)} · ${escapeHtml(receipt.sealed_at)}</p>
  </section>

  <section id="health" class="card">
    <h2>Protection health</h2>
    <p class="health-value">${escapeHtml(receipt.environment.protection_health)}</p>
    ${healthReasons}
    ${receipt.environment.signal_class ? `<p class="secondary">Signal class: ${escapeHtml(receipt.environment.signal_class)}</p>` : ""}
    <div class="usage">
      <h2>Usage</h2>
      <p class="usage-value">${kind}</p>
      <p class="secondary">Source: ${escapeHtml(receipt.usage.source)}</p>
    </div>
  </section>

  <section id="trigger" class="card">
    <h2>Trigger</h2>
    <p class="headline">${escapeHtml(triggerHeadline(receipt))}</p>
    ${triggerBody}
    <div class="cta">
      <h2>Safe recovery</h2>
      <p class="secondary">${escapeHtml(RECOVERY_PREVIEW_HINT)}</p>
      <div class="cmd-row">
        <input id="restore-cmd" type="text" readonly value="${escapeHtml(command)}" aria-label="Preview recovery command">
        <button type="button" class="copy-link" data-copy="${escapeHtml(command)}">Copy</button>
      </div>
    </div>
  </section>

  <section id="timeline" class="card">
    <h2>Timeline</h2>
    <table>
      <thead><tr><th>#</th><th>Time</th><th>Type</th><th>Summary</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>
  </section>

  <section id="limitations" class="card">
    <h2>Limitations</h2>
    <ul>${receipt.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  </section>

  <section id="digest" class="card">
    <h2>Digest</h2>
    <div class="digest-row"><span>Integrity</span><code>${escapeHtml(receipt.integrity.content_digest)}</code></div>
    <div class="digest-row"><span>Policy</span><code>${escapeHtml(receipt.policy.digest)}</code></div>
  </section>

  <p id="footer">Private local receipt · <a href="https://tripward.dev">tripward.dev</a></p>
</main>
<script>
document.addEventListener("click", function (event) {
  var target = event.target;
  if (!target || !target.getAttribute) return;
  var text = target.getAttribute("data-copy");
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text);
  } else {
    var field = document.getElementById("restore-cmd");
    if (field) { field.focus(); field.select(); }
  }
  target.textContent = "Copied";
  setTimeout(function () { target.textContent = "Copy"; }, 1500);
});
</script>
</body>
</html>
`;
}

export function writeReceiptHtml(runDirectory: string, receipt: ReceiptHtmlSource): string {
  const html = receiptHtmlPath(runDirectory);
  writeFileSync(html, renderHtml(receipt), { mode: 0o600 });
  return html;
}

export function browserOpenCommand(platform = process.platform): string | null {
  if (platform === "darwin") return "open";
  if (platform === "linux") return "xdg-open";
  return null;
}

export function openReceiptInBrowser(
  filePath: string,
  options: { platform?: NodeJS.Platform; spawnImpl?: typeof spawn } = {},
): { opened: boolean; command: string | null } {
  const command = browserOpenCommand(options.platform ?? process.platform);
  if (!command) return { opened: false, command: null };
  try {
    const child = (options.spawnImpl ?? spawn)(command, [resolve(filePath)], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return { opened: true, command };
  } catch {
    return { opened: false, command };
  }
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
