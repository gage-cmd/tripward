#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { stdin } from "node:process";
import { resolve } from "node:path";
import { parseHookInput } from "./adapter/hooks.js";
import { fixtureCatalog } from "./adapter/payloads.js";
import { adapterCoverage } from "./adapter/versions.js";
import { runSupervised } from "./commands/run.js";
import { readCheckpoint } from "./git/checkpoint.js";
import { applyRecovery, buildRecoveryPreview } from "./git/recovery.js";
import { Journal } from "./journal/journal.js";
import { compilePolicy, explainPolicy } from "./policy/compiler.js";
import { getPreset, PRESETS } from "./policy/presets.js";
import { applyInstall, uninstall } from "./install/installer.js";
import { runDoctor } from "./install/doctor.js";
import { ensureHome, resolveHome, runDir } from "./paths.js";
import { handleHook, readActive } from "./session.js";
import { FUSECAP_VERSION } from "./version.js";

interface Args {
  command: string;
  rest: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): Args {
  const [, , command = "help", ...raw] = argv;
  const flags: Record<string, string | boolean> = {};
  const rest: string[] = [];
  let passthrough = false;
  const passthroughArgs: string[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const token = raw[i];
    if (passthrough) {
      passthroughArgs.push(token);
      continue;
    }
    if (token === "--") {
      passthrough = true;
      continue;
    }
    if (token.startsWith("--")) {
      const [key, value] = token.slice(2).split("=");
      if (value !== undefined) {
        flags[key] = value;
      } else if (raw[i + 1] && !raw[i + 1].startsWith("-")) {
        flags[key] = raw[i + 1];
        i += 1;
      } else {
        flags[key] = true;
      }
      continue;
    }
    rest.push(token);
  }
  if (passthroughArgs.length) flags._passthrough = passthroughArgs.join("\u0000");
  return { command, rest, flags };
}

function flag(flags: Record<string, string | boolean>, name: string): string | undefined {
  const value = flags[name];
  if (typeof value === "string") return value;
  return undefined;
}

function bool(flags: Record<string, string | boolean>, name: string): boolean {
  return flags[name] === true || flags[name] === "true";
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function usage(): string {
  return `FuseCap ${FUSECAP_VERSION} — local circuit breaker for Claude Code (enforceability spike)

Usage:
  fusecap init [--preview] [--cwd DIR] [--home DIR]
  fusecap protect [preset]
  fusecap run [--preset NAME] [--policy FILE] [--stub] [--scenario NAME] [--] [claude args]
  fusecap hook                 # Claude Code hook entry (stdin JSON)
  fusecap doctor
  fusecap status
  fusecap receipt [run_id]
  fusecap restore [run_id] --preview
  fusecap restore [run_id] --confirm --digest DIGEST --paths a,b
  fusecap policy explain [--preset NAME|--policy FILE]
  fusecap uninstall [--preview]
  fusecap fixtures

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
      const plan = applyInstall(cwd, home, preview);
      console.log(preview ? "Install preview (no files written):" : "Installed:");
      for (const action of plan.actions) {
        console.log(`  ${action.op} ${action.path} — ${action.detail}`);
      }
      console.log(`hook command: ${plan.hook_command || "(n/a)"}`);
      return;
    }
    case "uninstall": {
      const plan = uninstall(cwd, home, bool(args.flags, "preview"));
      for (const action of plan.actions) {
        console.log(`  ${action.op} ${action.path} — ${action.detail}`);
      }
      return;
    }
    case "protect": {
      const name = args.rest[0] ?? "standard";
      const compiled = compilePolicy(getPreset(name));
      ensureHome(home);
      writeFileSync(resolve(home, "policy.json"), `${JSON.stringify(compiled.policy, null, 2)}\n`);
      console.log(explainPolicy(compiled.policy));
      return;
    }
    case "policy": {
      if (args.rest[0] !== "explain") {
        throw new Error("usage: fusecap policy explain [--preset NAME|--policy FILE]");
      }
      const policy = flag(args.flags, "policy")
        ? compilePolicy(JSON.parse(readFileSync(flag(args.flags, "policy")!, "utf8"))).policy
        : compilePolicy(getPreset(flag(args.flags, "preset") ?? "standard")).policy;
      console.log(explainPolicy(policy));
      return;
    }
    case "run": {
      const passthrough = typeof args.flags._passthrough === "string"
        ? String(args.flags._passthrough).split("\u0000").filter(Boolean)
        : [];
      const result = await runSupervised({
        cwd,
        home,
        policyPath: flag(args.flags, "policy"),
        preset: flag(args.flags, "preset"),
        stub: bool(args.flags, "stub"),
        stubScenario: flag(args.flags, "scenario"),
        claudeArgs: passthrough,
      });
      console.log(`run ${result.run_id}`);
      console.log(`exit ${result.exit_reason}`);
      console.log(`health ${result.health}`);
      console.log(`receipt ${result.receipt_json}`);
      if (result.health !== "protected") {
        console.error("FuseCap: protection is not fully covered. See receipt limitations.");
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
      console.log(JSON.stringify(report, null, 2));
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
      console.log(json);
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
