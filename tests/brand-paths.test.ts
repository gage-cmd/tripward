import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENV, LEGACY_ENV } from "../src/brand.js";
import { emitReceipt } from "../src/commands/receipt.js";
import { resolveHome } from "../src/paths.js";
import { resolveRunDir } from "../src/session.js";
import type { ReceiptDocument } from "../src/types.js";
import { tempDir } from "./helpers.js";

describe("Tripward home and env read-compat", () => {
  it("defaults to .tripward when neither state dir exists", () => {
    const cwd = tempDir("home-new-");
    expect(resolveHome(undefined, cwd, {})).toBe(join(cwd, ".tripward"));
  });

  it("prefers .tripward when both state dirs exist", () => {
    const cwd = tempDir("home-both-");
    mkdirSync(join(cwd, ".tripward"));
    mkdirSync(join(cwd, ".fusecap"));
    expect(resolveHome(undefined, cwd, {})).toBe(join(cwd, ".tripward"));
  });

  it("reads leftover .fusecap when .tripward is absent", () => {
    const cwd = tempDir("home-legacy-");
    mkdirSync(join(cwd, ".fusecap"));
    expect(resolveHome(undefined, cwd, {})).toBe(join(cwd, ".fusecap"));
  });

  it("prefers TRIPWARD_HOME over FUSECAP_HOME", () => {
    const cwd = tempDir("home-env-");
    const current = join(cwd, "current");
    const legacy = join(cwd, "legacy");
    expect(
      resolveHome(undefined, cwd, {
        [ENV.HOME]: current,
        [LEGACY_ENV.HOME]: legacy,
      }),
    ).toBe(current);
    expect(resolveHome(undefined, cwd, { [LEGACY_ENV.HOME]: legacy })).toBe(legacy);
  });

  it("resolves the run dir from TRIPWARD_RUN_DIR or leftover FUSECAP_RUN_DIR", () => {
    expect(resolveRunDir({ [ENV.RUN_DIR]: "/tmp/tripward-run" })).toBe("/tmp/tripward-run");
    expect(resolveRunDir({ [LEGACY_ENV.RUN_DIR]: "/tmp/legacy-run" })).toBe("/tmp/legacy-run");
  });

  it("reads old sealed receipts that only have fusecap_version", () => {
    const home = tempDir("rcpt-legacy-");
    const runDir = join(home, "runs", "run_legacy");
    mkdirSync(runDir, { recursive: true });
    const legacy: ReceiptDocument = {
      schema_version: "1.0",
      receipt_id: "rcpt_legacy",
      run_id: "run_legacy",
      sealed_at: "2026-09-06T00:00:02.000Z",
      identity: {
        repository_fingerprint: "redacted",
        branch: "main",
        host_label: "redacted",
        started_at: "2026-09-06T00:00:00.000Z",
        ended_at: "2026-09-06T00:00:02.000Z",
      },
      environment: {
        tripward_version: "unused",
        fusecap_version: "0.1.0-alpha",
        adapter_version: "0.1.0",
        claude_code_version: null,
        os: "linux x64",
        protection_health: "protected",
        health_reasons: [],
      },
      policy: {
        policy_id: "spike",
        version: 1,
        digest: "sha256:x",
        enforcement_mode: "enforce",
      },
      outcome: "completed",
      exit_reason: "completed",
      trigger: null,
      timeline: [],
      repository: {
        checkpoint_intact: true,
        dirty_at_start: false,
        files_in_manifest: 0,
        final_status: "completed",
      },
      usage: {
        cost: null,
        currency: null,
        source: "unavailable",
        confidence: "unavailable",
        note: "Usage dollars are unavailable for Claude Code subscription traffic. Tripward will not invent USD.",
      },
      limitations: [],
      integrity: { schema_version: "1.0", content_digest: "sha256:x" },
      privacy: { redaction_level: "none", persist_raw_payloads: false, excluded_fields: [] },
    };
    // Simulate a pre-cut receipt that only has the old field.
    const raw = { ...legacy, environment: { ...legacy.environment } };
    delete (raw.environment as { tripward_version?: string }).tripward_version;
    writeFileSync(join(runDir, "receipt.json"), `${JSON.stringify(raw, null, 2)}\n`);
    const result = emitReceipt({ home, runId: "run_legacy", redact: true });
    expect(result.jsonPrinted).toContain('"tripward_version": "0.1.0-alpha"');
    expect(result.jsonPrinted).not.toMatch(/"fusecap_version"/);
  });
});
