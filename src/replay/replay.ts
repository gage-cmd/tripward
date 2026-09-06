import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathsFor, runDir } from "../paths.js";
import type { JournalEvent, ReceiptDocument } from "../types.js";

export type EvidenceKind = "observed" | "inferred";

export interface ReplayFinding {
  kind: EvidenceKind;
  type: string;
  summary: string;
  run_id?: string;
  sequence?: number;
  wall_time?: string;
}

export interface ReplayRun {
  run_id: string;
  path: string;
  compatible: boolean;
  compatibility_notes: string[];
  receipt: {
    present: boolean;
    outcome?: string;
    exit_reason?: string;
    mode?: string;
    digest?: string;
  } | null;
  journal_events: number;
  findings: ReplayFinding[];
}

export interface ReplayReport {
  read_only: true;
  mutated: false;
  home: string;
  runs_scanned: number;
  runs: ReplayRun[];
  privacy: {
    redaction_level: string;
    excluded: string[];
    limitations: string[];
  };
}

const OBSERVED_TYPES = new Set([
  "tool.requested",
  "tool.allowed",
  "tool.blocked",
  "tool.completed",
  "tool.failed",
  "policy.evaluated",
  "fuse.tripped",
  "detector.signaled",
  "policy.signaled",
  "run.armed",
  "run.ended",
  "run.session_end",
  "checkpoint.created",
  "adapter.latency",
  "receipt.sealed",
  "recovery.applied",
  "journal.unknown_after_crash",
  "doctor.ping",
]);

function listRunDirs(home: string): string[] {
  const runs = pathsFor(home).runs;
  if (!existsSync(runs) || !statSync(runs).isDirectory()) return [];
  return readdirSync(runs, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => join(runs, entry.name))
    .sort();
}

function readJsonSilent(path: string): unknown | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function parseJournal(path: string): { events: JournalEvent[]; notes: string[] } {
  const notes: string[] = [];
  if (!existsSync(path)) return { events: [], notes: ["journal.jsonl missing"] };
  const events: JournalEvent[] = [];
  const raw = readFileSync(path, "utf8");
  for (const [index, line] of raw.split("\n").entries()) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as JournalEvent;
      if (!parsed.event_id || !parsed.type || !parsed.sequence) {
        notes.push(`line ${index + 1}: incomplete event (inferred skip)`);
        continue;
      }
      events.push(parsed);
    } catch {
      notes.push(`line ${index + 1}: unparseable (partial or foreign)`);
    }
  }
  return { events, notes };
}

function summarizeEvent(event: JournalEvent): string {
  const p = event.payload;
  if (event.type === "policy.evaluated") {
    return `${p.action} ${p.reason_code ?? ""}`.trim();
  }
  if (event.type === "detector.signaled" || event.type === "policy.signaled") {
    return `${p.reason_code ?? "signal"} configured=${p.configured_action ?? "?"} effective=${p.effective_action ?? "?"}`;
  }
  if (event.type === "fuse.tripped") {
    return String(p.reason ?? p.reason_code ?? "tripped");
  }
  if (event.type === "tool.requested") {
    return String(p.tool_name ?? "tool");
  }
  return event.type;
}

function inferFromReceipt(receipt: ReceiptDocument, journalTypes: Set<string>): ReplayFinding[] {
  const findings: ReplayFinding[] = [];
  if (receipt.trigger && !journalTypes.has("fuse.tripped")) {
    findings.push({
      kind: "inferred",
      type: "receipt.trigger",
      summary: `receipt names trigger ${receipt.trigger.rule} but journal has no fuse.tripped`,
      run_id: receipt.run_id,
    });
  }
  if (receipt.outcome === "warned" && !journalTypes.has("detector.signaled") && !journalTypes.has("policy.signaled")) {
    findings.push({
      kind: "inferred",
      type: "receipt.warned",
      summary: "receipt outcome=warned; no detector.signaled / policy.signaled in journal (pre-alpha journal or stripped)",
      run_id: receipt.run_id,
    });
  }
  if (receipt.usage.cost !== null) {
    findings.push({
      kind: "inferred",
      type: "receipt.usage",
      summary: "receipt.usage.cost is not null — reject as incompatible with FuseCap claims",
      run_id: receipt.run_id,
    });
  }
  return findings;
}

function replayOne(dir: string): ReplayRun {
  const notes: string[] = [];
  const journal = parseJournal(join(dir, "journal.jsonl"));
  notes.push(...journal.notes);
  const receiptRaw = readJsonSilent(join(dir, "receipt.json"));
  let receipt: ReceiptDocument | null = null;
  if (receiptRaw && typeof receiptRaw === "object") {
    receipt = receiptRaw as ReceiptDocument;
    if (receipt.schema_version && receipt.schema_version !== "1.0") {
      notes.push(`receipt schema ${receipt.schema_version} not in compatibility matrix; fields labeled inferred where unknown`);
    }
  } else if (receiptRaw === null && !existsSync(join(dir, "receipt.json"))) {
    notes.push("receipt.json missing");
  } else {
    notes.push("receipt.json present but not JSON object");
  }

  const findings: ReplayFinding[] = journal.events.map((event) => ({
    kind: OBSERVED_TYPES.has(event.type) ? "observed" : "inferred",
    type: event.type,
    summary: summarizeEvent(event),
    run_id: event.run_id,
    sequence: event.sequence,
    wall_time: event.wall_time,
  }));

  const journalTypes = new Set(journal.events.map((event) => event.type));
  if (receipt) {
    findings.push(...inferFromReceipt(receipt, journalTypes));
  }

  const runId =
    receipt?.run_id ??
    journal.events.find((event) => event.run_id)?.run_id ??
    dir.split("/").pop() ??
    "unknown";

  const compatible = notes.every((note) => !note.includes("reject") && !note.includes("not JSON"));
  return {
    run_id: runId,
    path: dir,
    compatible,
    compatibility_notes: notes,
    receipt: receipt
      ? {
          present: true,
          outcome: receipt.outcome,
          exit_reason: receipt.exit_reason,
          mode: receipt.policy.enforcement_mode,
          digest: receipt.integrity.content_digest,
        }
      : { present: false },
    journal_events: journal.events.length,
    findings,
  };
}

export function replayHistory(home: string, runId?: string): ReplayReport {
  const selected = runId ? [runDir(home, runId)] : listRunDirs(home);
  const runs: ReplayRun[] = [];
  for (const dir of selected) {
    if (!existsSync(dir)) {
      runs.push({
        run_id: runId ?? dir,
        path: dir,
        compatible: false,
        compatibility_notes: ["run directory does not exist"],
        receipt: null,
        journal_events: 0,
        findings: [],
      });
      continue;
    }
    runs.push(replayOne(dir));
  }
  return {
    read_only: true,
    mutated: false,
    home,
    runs_scanned: runs.length,
    runs,
    privacy: {
      redaction_level: "replay-local",
      excluded: ["prompts", "completions", "file_contents", "secrets", "usd_cost", "raw hook payloads"],
      limitations: [
        "Replay never mutates journals, receipts, Git, or policy.",
        "Findings labeled observed come from parseable journal lines or sealed receipt fields.",
        "Findings labeled inferred are reconstructions or compatibility guesses — not proof.",
        "Tool names and reason codes may appear; prompts, diffs, and secrets are not reconstructed.",
        "Foreign or future schema versions are read best-effort and marked in compatibility_notes.",
        "This is not a compliance audit and not a live session.",
      ],
    },
  };
}

export function formatReplayReport(report: ReplayReport): string {
  const lines = [
    `FuseCap replay (read-only)  mutated=${report.mutated}`,
    `home ${report.home}  runs ${report.runs_scanned}`,
    "",
  ];
  if (report.runs.length === 0) {
    lines.push("No compatible run directories found.");
  }
  for (const run of report.runs) {
    lines.push(`## ${run.run_id}  compatible=${run.compatible}`);
    if (run.receipt?.present) {
      lines.push(
        `   receipt ${run.receipt.outcome ?? "?"} / ${run.receipt.exit_reason ?? "?"}  mode=${run.receipt.mode ?? "?"}`,
      );
    } else {
      lines.push("   receipt absent");
    }
    lines.push(`   journal events: ${run.journal_events}`);
    for (const note of run.compatibility_notes) {
      lines.push(`   compat: ${note}`);
    }
    const interesting = run.findings.filter(
      (item) =>
        item.kind === "inferred" ||
        item.type === "detector.signaled" ||
        item.type === "policy.signaled" ||
        item.type === "fuse.tripped" ||
        item.type === "tool.blocked",
    );
    for (const finding of interesting.slice(0, 40)) {
      lines.push(`   [${finding.kind}] ${finding.type} — ${finding.summary}`);
    }
    lines.push("");
  }
  lines.push("Privacy limitations:");
  for (const item of report.privacy.limitations) {
    lines.push(`  - ${item}`);
  }
  return lines.join("\n");
}
