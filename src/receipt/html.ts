import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import type { ProtectionHealth, ReceiptDocument, ReceiptOutcome } from "../types.js";
import type { RedactedReceipt } from "./redact.js";

export const TRIPWARD_HOST = "tripward.dev";

export const RECOVERY_PREVIEW_HINT =
  "This page does not restore. Preview is required (ADR 0005). Apply stays in the CLI and is refused unless --digest matches the current preview digest. Tripward will not silently reset a dirty tree.";

export const LIMITATIONS_LEAD = "What Tripward could not guarantee for this run.";

export const DIGEST_CAPTION = "Sealed locally. If these digests change, this file was altered.";

export type ReceiptHtmlSource = ReceiptDocument | RedactedReceipt;

export type UsageKind = "Actual" | "Estimate" | "Unavailable";

export type HealthChipState = "ok" | "warn" | "off";

export interface HealthChip {
  name: string;
  state: HealthChipState;
}

export function receiptHtmlPath(runDirectory: string): string {
  return join(runDirectory, "receipt.html");
}

export function restorePreviewCommand(runId: string): string {
  return `tripward restore --preview ${runId}`;
}

export function restorePreviewHtmlCommand(runId: string): string {
  return `tripward restore --preview --html ${runId}`;
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

export function outcomeLabel(outcome: ReceiptOutcome | string): string {
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

export function outcomePillClass(outcome: ReceiptOutcome | string): string {
  switch (outcome) {
    case "completed":
      return "pill-completed";
    case "warned":
      return "pill-warned";
    case "blocked":
    case "terminated":
    case "crashed":
      return "pill-terminated";
    default:
      return "pill-canceled";
  }
}

export function healthLabel(health: ProtectionHealth | string): "Protected" | "Degraded" | "Unprotected" {
  if (health === "protected") return "Protected";
  if (health === "degraded") return "Degraded";
  return "Unprotected";
}

export function formatLocalTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  })} (local)`;
}

export function formatDuration(startedAt: string, endedAt: string): string {
  const ms = Date.parse(endedAt) - Date.parse(startedAt);
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return rem ? `${minutes}m ${rem}s` : `${minutes}m`;
}

export function triggerHeadline(view: ReceiptHtmlSource): string {
  const observed = view.trigger?.observed_value;
  const threshold = view.trigger?.threshold;
  switch (view.exit_reason) {
    case "time_fuse": {
      const seconds = typeof observed === "number" ? observed : typeof threshold === "number" ? threshold : undefined;
      return seconds === undefined ? "Time limit reached" : `Time limit reached after ${seconds}s`;
    }
    case "hook_block":
      return "A tool was blocked before it ran";
    case "exact_loop":
      return typeof observed === "number"
        ? `Same action repeated ${observed} times`
        : "The same action repeated too many times";
    case "dangerous_command":
      return "A dangerous command was blocked";
    case "hooks_bypassed":
      return "Required hooks were not healthy";
    case "terminated":
      return "The session was stopped";
    case "user_canceled":
      return "The operator canceled the session";
    case "preflight_failed":
      return "The run did not start";
    case "crashed":
      return "The session crashed";
    case "completed":
      return "Session finished without a trip";
    default:
      return view.trigger ? "The session stopped" : "Session ended without a fuse trip";
  }
}

export function healthChips(receipt: ReceiptHtmlSource): HealthChip[] {
  const reasons = receipt.environment.health_reasons.join(" ").toLowerCase();
  const stub =
    receipt.environment.signal_class === "stub-ci" ||
    receipt.environment.signal_class === "operator-injected-demo" ||
    reasons.includes("stub") ||
    reasons.includes("claude cli absent");
  const hooksBad = receipt.exit_reason === "hooks_bypassed" || reasons.includes("hooks");
  return [
    { name: "Adapter", state: stub ? "warn" : receipt.environment.adapter_version ? "ok" : "off" },
    { name: "Hooks", state: hooksBad ? "off" : stub ? "warn" : "ok" },
    { name: "Checkpoint", state: receipt.repository.checkpoint_intact ? "ok" : "off" },
    { name: "Storage", state: receipt.integrity.content_digest ? "ok" : "off" },
    { name: "Policy locked", state: receipt.policy.digest ? "ok" : "off" },
  ];
}

function timeEl(iso: string): string {
  return `<time datetime="${escapeHtml(iso)}">${escapeHtml(formatLocalTime(iso))}</time>`;
}

function repositoryStrip(receipt: ReceiptHtmlSource): string {
  const repo = receipt.repository;
  if (
    repo.files_in_manifest === 0 &&
    !repo.checkpoint_intact &&
    !repo.dirty_at_start &&
    !repo.final_status
  ) {
    return "";
  }
  const files = repo.files_in_manifest === 1 ? "1 file" : `${repo.files_in_manifest} files`;
  return `<p class="repo-strip">${repo.checkpoint_intact ? "Checkpoint intact" : "Checkpoint not intact"} · ${
    repo.dirty_at_start ? "Dirty at start" : "Clean start"
  } · ${files}</p>`;
}

export function renderHtml(receipt: ReceiptHtmlSource): string {
  const kind = usageKind(receipt.usage);
  const command = restorePreviewCommand(receipt.run_id);
  const htmlCommand = restorePreviewHtmlCommand(receipt.run_id);
  const health = healthLabel(receipt.environment.protection_health);
  const chips = healthChips(receipt)
    .map((chip) => `<li class="chip chip-${chip.state}">${escapeHtml(chip.name)}</li>`)
    .join("");
  const healthReasons =
    receipt.environment.health_reasons.length > 0
      ? `<ul class="reasons">${receipt.environment.health_reasons.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : "";
  const rows = receipt.timeline
    .map(
      (item) =>
        `<tr><td>${item.sequence}</td><td>${timeEl(item.wall_time)}</td><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.summary)}</td></tr>`,
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
  const branch = receipt.identity.branch ? escapeHtml(receipt.identity.branch) : "";
  const fingerprint =
    receipt.identity.repository_fingerprint && receipt.identity.repository_fingerprint !== "unavailable"
      ? "redacted"
      : "";
  const identityBits = [
    branch ? `Branch ${branch}` : "",
    fingerprint ? `Fingerprint ${fingerprint}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

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
.pill {
  margin: 0;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
}
.pill-terminated { background: rgba(255, 59, 48, 0.12); color: #D70015; }
.pill-warned { background: rgba(255, 149, 0, 0.12); color: #C93400; }
.pill-completed { background: rgba(52, 199, 89, 0.12); color: #1F7A33; }
.pill-canceled { background: rgba(142, 142, 147, 0.12); color: #1D1D1F; }
.secondary { color: #6E6E73; margin: 8px 0 0; font-size: 13px; }
.repo-strip { color: #6E6E73; margin: 8px 0 0; font-size: 13px; }
h2 { margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #6E6E73; letter-spacing: 0.02em; text-transform: uppercase; }
.health-value, .usage-value, .headline { margin: 0; font-size: 21px; font-weight: 600; letter-spacing: -0.02em; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; margin: 16px 0 0; padding: 0; }
.chip { margin: 0; padding: 4px 10px; border-radius: 999px; font-size: 13px; font-weight: 600; }
.chip-ok { background: rgba(52, 199, 89, 0.12); color: #1F7A33; }
.chip-warn { background: rgba(255, 149, 0, 0.12); color: #C93400; }
.chip-off { background: rgba(255, 59, 48, 0.12); color: #D70015; }
.reasons { margin: 8px 0 0; padding-left: 18px; }
.reasons li { margin: 4px 0; }
dl { margin: 16px 0 0; }
dl > div { display: flex; gap: 16px; padding: 8px 0; border-top: 1px solid #D2D2D7; }
dt { width: 104px; flex: 0 0 104px; color: #6E6E73; font-size: 13px; }
dd { margin: 0; }
.cta { margin-top: 16px; padding-top: 16px; border-top: 1px solid #D2D2D7; }
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
  border-radius: 8px;
}
.copy-link:focus-visible {
  outline: 2px solid #0071E3;
  outline-offset: 2px;
}
table { width: 100%; border-collapse: collapse; margin-top: 8px; }
th, td { text-align: left; vertical-align: top; padding: 8px 8px 8px 0; font-size: 13px; }
th { color: #6E6E73; font-weight: 600; }
td { border-top: 1px solid #D2D2D7; }
#limitations .lead { margin: 0 0 8px; }
#limitations ul { margin: 8px 0 0; padding-left: 18px; }
#limitations li { margin: 8px 0; }
.digest-row { display: flex; gap: 16px; padding: 8px 0; border-top: 1px solid #D2D2D7; }
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
      <div class="titles">
        <p class="wordmark">Tripward</p>
        <h1 class="doc-title">Receipt</h1>
      </div>
      <p class="pill ${outcomePillClass(receipt.outcome)}">${escapeHtml(outcomeLabel(receipt.outcome))}</p>
    </div>
    <p class="secondary">Run ${escapeHtml(receipt.run_id)}</p>
    <p class="secondary">${timeEl(receipt.identity.started_at)} → ${timeEl(receipt.identity.ended_at)} · ${escapeHtml(formatDuration(receipt.identity.started_at, receipt.identity.ended_at))}</p>
    ${identityBits ? `<p class="secondary">${identityBits}</p>` : ""}
    ${repositoryStrip(receipt)}
  </section>

  <section id="health" class="card">
    <h2>Protection health</h2>
    <p class="health-value">${health}</p>
    <ul class="chips">${chips}</ul>
    ${healthReasons}
    ${receipt.environment.signal_class ? `<p class="secondary">Signal class: ${escapeHtml(receipt.environment.signal_class)}</p>` : ""}
  </section>

  <section id="usage" class="card">
    <h2>Usage</h2>
    <p class="usage-value">${kind}</p>
    <p class="secondary">Source: ${escapeHtml(receipt.usage.source)}</p>
  </section>

  <section id="trigger" class="card">
    <h2>Trigger</h2>
    <p class="headline">${escapeHtml(triggerHeadline(receipt))}</p>
    ${triggerBody}
    <div class="cta">
      <h2>Preview restore</h2>
      <p class="secondary">${escapeHtml(RECOVERY_PREVIEW_HINT)}</p>
      <div class="cmd-row">
        <input id="restore-cmd" type="text" readonly value="${escapeHtml(command)}" aria-label="Preview restore command">
        <button type="button" class="copy-link" data-copy="${escapeHtml(command)}">Copy</button>
      </div>
      <p class="secondary">Same preview as a local HTML page:</p>
      <div class="cmd-row">
        <input id="restore-html-cmd" type="text" readonly value="${escapeHtml(htmlCommand)}" aria-label="Preview restore HTML command">
        <button type="button" class="copy-link" data-copy="${escapeHtml(htmlCommand)}">Copy</button>
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
    <p class="lead">${escapeHtml(LIMITATIONS_LEAD)}</p>
    <ul>${receipt.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  </section>

  <section id="digest" class="card">
    <h2>Digest</h2>
    <p class="secondary">${escapeHtml(DIGEST_CAPTION)}</p>
    <div class="digest-row"><span>Content</span><code>${escapeHtml(receipt.integrity.content_digest)}</code></div>
    <div class="digest-row"><span>Policy</span><code>${escapeHtml(receipt.policy.digest)}</code></div>
  </section>

  <p id="footer">Private local receipt · tripward.dev</p>
</main>
<script>
(function () {
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
})();
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
