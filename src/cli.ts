#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { stdin } from "node:process";
import { resolve } from "node:path";
import { parseHookInput } from "./adapter/hooks.js";
import { fixtureCatalog } from "./adapter/payloads.js";
import { adapterCoverage } from "./adapter/versions.js";
import { bool, flag, parseArgs, parseMode, passthroughOf } from "./commands/args.js";
import { DEMO_TRIP_BANNER, DEMO_TRIP_KINDS, runDemoTrip, type DemoTripKind } from "./commands/demo-trip.js";
import { runSupervised } from "./commands/run.js";
import { readCheckpoint } from "./git/checkpoint.js";
import { applyRecovery, buildRecoveryPreview } from "./git/recovery.js";
import { Journal } from "./journal/journal.js";
import { applyPolicyMode, compilePolicy, explainPolicy } from "./policy/compiler.js";
import { getPreset, PRESETS } from "./policy/presets.js";
import { applyInstall, uninstall } from "./install/installer.js";
import { formatDoctorReport, runDoctor } from "./install/doctor.js";
import { ensureHome, resolveHome, runDir } from "./paths.js";
import { handleHook, readActive } from "./session.js";
import { formatReplayReport, replayHistory } from "./replay/replay.js";
import { redactReceipt } from "./receipt/redact.js";
import { FUSECAP_VERSION } from "./version.js";
import type { ReceiptDocument } from "./types.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function usage(): string {
  return `Tripward ${FUSECAP_VERSION} (CLI: fusecap) — local circuit breaker for Claude Code (private alpha)

Usage:
  fusecap init [--preview] [--cwd DIR] [--home DIR] [--preset NAME] [--mode shadow|enforce]
  fusecap protect [preset] [--mode shadow|enforce]
  fusecap run [--preset NAME] [--policy FILE] [--mode shadow|enforce] [--stub] [--scenario NAME] [--] [claude args]
  fusecap demo-trip [--kind dangerous|exact-loop|hook-block] [--preset spike]
  fusecap hook                 # Claude Code hook entry (stdin JSON)
  fusecap doctor [--json]
  fusecap status
  fusecap receipt [run_id] [--redact]
  fusecap replay [run_id] [--json]
  fusecap restore [run_id] --preview
  fusecap restore [run_id] --confirm --digest DIGEST --paths a,b
  fusecap policy explain [--preset NAME|--policy FILE] [--mode shadow|enforce]
  fusecap uninstall [--preview]
  fusecap fixtures

Alpha default: new policies are shadow (detectors/policy signal without interrupting).
Flip enforce:  fusecap protect --mode enforce   or   fusecap run --preset spike
After --, pass Claude flags only (-p ...). A leading claude token is stripped (compat).
demo-trip injects PreToolUse locally - not a live Claude signal, not stub CI.
Hard stops (dangerous command, missing journal/hooks/checkpoint) still fire in shadow.
Uninstall restores verified backups only and never broadens permissions.

Authorization: Claude Code adapter only. No Cursor, no fake USD, no cloud.
`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const cwd = resolve(flag(args.flags, "cwd") ?? process.cwd());
  const home = resolveHome(flag(args.flags, "home"), cwd);

  switch (args.command) {
    case "help":
    case "-h":
    case "--help":
      console.log(usage());
      return;
    case "version":
    case "--version":
      console.log(FUSECAP_VERSION);
      return;
    case "init": {
      const preview = bool(args.flags, "preview");
      const plan = applyInstall(cwd, home, preview, {
        preset: flag(args.flags, "preset"),
        mode: parseMode(args.flags),
      });
      console.log(preview ? "Install preview (no files written):" : plan.already_installed ? "Init (idempotent):" : "Installed:");
      for (const action of plan.actions) {
        console.log(`  ${action.op} ${action.path} — ${action.detail}`);
      }
      console.log(`hook command: ${plan.hook_command || "(n/a)"}`);
      console.log(`default mode: ${plan.default_mode}  (flip with fusecap protect --mode enforce)`);
      return;
    }
    case "uninstall": {
      const plan = uninstall(cwd, home, bool(args.flags, "preview"));
      console.log(bool(args.flags, "preview") ? "Uninstall preview:" : "Uninstall:");
      for (const action of plan.actions) {
        console.log(`  ${action.op} ${action.path} — ${action.detail}`);
      }
      return;
    }
    case "protect": {
      const name = args.rest[0] ?? "standard";
      const mode = parseMode(args.flags);
      const compiled = compilePolicy(mode ? applyPolicyMode(getPreset(name), mode) : getPreset(name));
      ensureHome(home);
      const { digest: _d, unsupported_controls: _u, ...document } = compiled.policy;
      writeFileSync(resolve(home, "policy.json"), `${JSON.stringify(document, null, 2)}\n`, { mode: 0o600 });
      console.log(explainPolicy(compiled.policy));
      return;
    }
    case "policy": {
      if (args.rest[0] !== "explain") {
        throw new Error("usage: fusecap policy explain [--preset NAME|--policy FILE] [--mode shadow|enforce]");
      }
      const mode = parseMode(args.flags);
      let raw: unknown = flag(args.flags, "policy")
        ? JSON.parse(readFileSync(flag(args.flags, "policy")!, "utf8"))
        : getPreset(flag(args.flags, "preset") ?? "standard");
      if (mode) raw = applyPolicyMode(raw, mode);
      console.log(explainPolicy(compilePolicy(raw).policy));
      return;
    }
    case "demo-trip": {
      const kind = (flag(args.flags, "kind") ?? args.rest[0] ?? "dangerous") as DemoTripKind;
      if (!DEMO_TRIP_KINDS.includes(kind)) {
        throw new Error(`usage: fusecap demo-trip [--kind ${DEMO_TRIP_KINDS.join("|")}]`);
      }
      console.error(DEMO_TRIP_BANNER);
      const result = await runDemoTrip({
        cwd,
        home,
        kind,
        preset: flag(args.flags, "preset") ?? "spike",
        mode: parseMode(args.flags),
      });
      console.log(`run ${result.run_id}`);
      console.log(`exit ${result.exit_reason}`);
      console.log(`health ${result.health}`);
      console.log(`signal_class ${result.signal_class}`);
      console.log(`receipt ${result.receipt_json}`);
      console.error(DEMO_TRIP_BANNER);
      return;
    }
    case "run": {
      const passthrough = passthroughOf(args.flags);
      const result = await runSupervised({
        cwd,
        home,
        policyPath: flag(args.flags, "policy"),
        preset: flag(args.flags, "preset"),
        mode: parseMode(args.flags),
        stub: bool(args.flags, "stub"),
        stubScenario: flag(args.flags, "scenario"),
        claudeArgs: passthrough,
      });
      console.log(`run ${result.run_id}`);
      console.log(`exit ${result.exit_reason}`);
      console.log(`health ${result.health}`);
      console.log(`receipt ${result.receipt_json}`);
      if (result.health !== "protected") {
        console.error("Tripward: protection is not fully covered. See receipt limitations.");
      }
      return;
    }
    case "hook": {
      const raw = await readStdin();
      parseHookInput(raw);
      const result = handleHook(raw);
      process.stdout.write(`${JSON.stringify(result.response)}\n`);
      return;
    }
    case "doctor": {
      const report = await runDoctor(cwd, home);
      if (bool(args.flags, "json")) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(formatDoctorReport(report));
      }
      if (!report.ok) process.exitCode = 1;
      return;
    }
    case "status": {
      const active = readActive(home);
      console.log(JSON.stringify({ version: FUSECAP_VERSION, home, active, coverage: adapterCoverage(null) }, null, 2));
      return;
    }
    case "receipt": {
      const active = readActive(home);
      const runId = args.rest[0] ?? active?.run_id;
      if (!runId) throw new Error("no run id");
      const json = readFileSync(resolve(runDir(home, runId), "receipt.json"), "utf8");
      if (bool(args.flags, "redact")) {
        const receipt = JSON.parse(json) as ReceiptDocument;
        console.log(JSON.stringify(redactReceipt(receipt), null, 2));
        return;
      }
      console.log(json);
      return;
    }
    case "replay": {
      const runId = args.rest[0];
      const report = replayHistory(home, runId);
      if (bool(args.flags, "json")) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(formatReplayReport(report));
      }
      if (report.runs.some((run) => !run.compatible) && report.runs.length > 0) {
        process.exitCode = 1;
      }
      return;
    }
    case "restore": {
      const active = readActive(home);
      const runId = args.rest[0] ?? active?.run_id;
      if (!runId) throw new Error("no run id");
      const dir = runDir(home, runId);
      const manifest = readCheckpoint(dir);
      const preview = buildRecoveryPreview(manifest);
      if (bool(args.flags, "preview") || !bool(args.flags, "confirm")) {
        console.log(JSON.stringify(preview, null, 2));
        console.log("Recovery apply requires --confirm --digest <preview_digest> --paths p1,p2");
        return;
      }
      const digest = flag(args.flags, "digest");
      if (digest !== preview.preview_digest) {
        throw new Error("Preview digest mismatch; refresh --preview and retry. Apply aborted.");
      }
      const paths = (flag(args.flags, "paths") ?? "").split(",").map((p) => p.trim()).filter(Boolean);
      const result = applyRecovery(manifest, preview, paths);
      const journal = Journal.open(dir);
      journal.append({
        run_id: runId,
        type: "recovery.applied",
        payload: { ...result, preview_digest: digest },
      });
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case "fixtures": {
      console.log(JSON.stringify({ captured_at: "2026-09-06", fixtures: fixtureCatalog() }, null, 2));
      return;
    }
    default:
      console.error(usage());
      console.error(`Unknown command: ${args.command}`);
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`fusecap: ${(error as Error).message}`);
  process.exitCode = 1;
});

void Object.keys(PRESETS);
