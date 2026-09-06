import { existsSync } from "node:fs";
import { applyRecovery, buildRecoveryPreview } from "../git/recovery.js";
import { readCheckpoint } from "../git/checkpoint.js";
import { Journal } from "../journal/journal.js";
import { runDir } from "../paths.js";
import { openReceiptInBrowser } from "../receipt/html.js";
import { writeRecoveryHtml } from "../recovery/html.js";
import { readActive } from "../session.js";
import type { RecoveryPreview } from "../types.js";

export const PREVIEW_DIGEST_MISMATCH =
  "Preview digest mismatch; refresh --preview and retry. Apply aborted.";

export const RESTORE_APPLY_HINT = "Recovery apply requires --confirm --digest <preview_digest> --paths p1,p2";

export function resolveRestoreRunId(home: string, requested?: string): string {
  const runId = requested ?? readActive(home)?.run_id;
  if (!runId) throw new Error("no run id");
  return runId;
}

export interface RestoreEmitInput {
  home: string;
  runId?: string;
  preview?: boolean;
  confirm?: boolean;
  digest?: string;
  paths?: string;
  html?: boolean;
  open?: boolean;
}

export interface RestorePreviewResult {
  kind: "preview";
  run_id: string;
  preview: RecoveryPreview;
  htmlPath?: string;
  opened?: boolean;
  openCommand?: string | null;
}

export interface RestoreApplyResult {
  kind: "apply";
  run_id: string;
  applied: string[];
  skipped: string[];
}

export type RestoreEmitResult = RestorePreviewResult | RestoreApplyResult;

export function emitRestore(input: RestoreEmitInput): RestoreEmitResult {
  const htmlRequested = Boolean(input.html || input.open);
  const previewRequested = Boolean(input.preview) || htmlRequested || !input.confirm;
  const runId = resolveRestoreRunId(input.home, input.runId);
  const dir = runDir(input.home, runId);
  if (!existsSync(dir)) {
    throw new Error(`run directory missing: ${dir}`);
  }
  const manifest = readCheckpoint(dir);
  const preview = buildRecoveryPreview(manifest);

  if (previewRequested) {
    const result: RestorePreviewResult = { kind: "preview", run_id: runId, preview };
    if (htmlRequested) {
      result.htmlPath = writeRecoveryHtml(dir, preview);
      if (input.open) {
        const opened = openReceiptInBrowser(result.htmlPath);
        result.opened = opened.opened;
        result.openCommand = opened.command;
      }
    }
    return result;
  }

  if (input.digest !== preview.preview_digest) {
    throw new Error(PREVIEW_DIGEST_MISMATCH);
  }
  const selected = (input.paths ?? "")
    .split(",")
    .map((path) => path.trim())
    .filter(Boolean);
  const applied = applyRecovery(manifest, preview, selected);
  const journal = Journal.open(dir);
  journal.append({
    run_id: runId,
    type: "recovery.applied",
    payload: { ...applied, preview_digest: input.digest },
  });
  return { kind: "apply", run_id: runId, ...applied };
}
