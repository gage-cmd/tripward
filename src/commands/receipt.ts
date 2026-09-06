import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runDir } from "../paths.js";
import { openReceiptInBrowser, writeReceiptHtml } from "../receipt/html.js";
import { redactReceipt } from "../receipt/redact.js";
import { readActive } from "../session.js";
import type { ReceiptDocument } from "../types.js";

export function resolveReceiptRunId(home: string, requested?: string): string {
  const runId = requested ?? readActive(home)?.run_id;
  if (!runId) throw new Error("no run id");
  return runId;
}

export function normalizeReceipt(receipt: ReceiptDocument): ReceiptDocument {
  const tripward_version = receipt.environment.tripward_version ?? receipt.environment.fusecap_version ?? "unknown";
  return {
    ...receipt,
    environment: {
      ...receipt.environment,
      tripward_version,
    },
  };
}

export function readSealedReceipt(runDirectory: string): { raw: string; receipt: ReceiptDocument } {
  const raw = readFileSync(join(runDirectory, "receipt.json"), "utf8");
  return { raw, receipt: normalizeReceipt(JSON.parse(raw) as ReceiptDocument) };
}

export interface ReceiptEmitInput {
  home: string;
  runId?: string;
  redact?: boolean;
  html?: boolean;
  open?: boolean;
}

export interface ReceiptEmitResult {
  run_id: string;
  jsonPrinted?: string;
  htmlPath?: string;
  opened?: boolean;
  openCommand?: string | null;
}

export function emitReceipt(input: ReceiptEmitInput): ReceiptEmitResult {
  const htmlRequested = Boolean(input.html || input.open);
  const runId = resolveReceiptRunId(input.home, input.runId);
  const dir = runDir(input.home, runId);
  const { raw, receipt } = readSealedReceipt(dir);
  const result: ReceiptEmitResult = { run_id: runId };

  if (htmlRequested) {
    result.htmlPath = writeReceiptHtml(dir, receipt);
    if (input.open) {
      const opened = openReceiptInBrowser(result.htmlPath);
      result.opened = opened.opened;
      result.openCommand = opened.command;
    }
  }

  if (input.redact) {
    result.jsonPrinted = `${JSON.stringify(redactReceipt(receipt), null, 2)}\n`;
  } else if (!htmlRequested) {
    result.jsonPrinted = raw;
  }

  return result;
}
