import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { claudeSettingsHooks } from "../adapter/hooks.js";
import { ensureHome } from "../paths.js";
import { getPreset } from "../policy/presets.js";
import { FUSECAP_VERSION } from "../version.js";

export interface InstallPlan {
  actions: Array<{ op: "write" | "backup" | "chmod" | "remove"; path: string; detail: string }>;
  hook_command: string;
}

export function hookCommandForThisInstall(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const distCli = resolve(here, "..", "cli.js");
  const srcCli = resolve(here, "..", "cli.ts");
  if (existsSync(distCli) && distCli.endsWith(".js")) {
    return `node ${distCli} hook`;
  }
  if (existsSync(srcCli)) {
    return `npx --yes tsx ${srcCli} hook`;
  }
  return `node ${distCli} hook`;
}

export function planInstall(cwd: string, home: string, hookCommand = hookCommandForThisInstall()): InstallPlan {
  const actions: InstallPlan["actions"] = [];
  const settingsLocal = join(cwd, ".claude", "settings.local.json");
  const policyPath = join(home, "policy.json");
  const installState = join(home, "install-state.json");
  if (existsSync(settingsLocal)) {
    actions.push({
      op: "backup",
      path: join(home, "backups", "settings.local.json"),
      detail: `backup ${settingsLocal}`,
    });
  }
  actions.push({ op: "write", path: policyPath, detail: "default standard policy" });
  actions.push({ op: "write", path: settingsLocal, detail: "Claude Code PreToolUse/Session hooks" });
  actions.push({ op: "write", path: installState, detail: "install record" });
  actions.push({ op: "chmod", path: home, detail: "0700 home" });
  return { actions, hook_command: hookCommand };
}

export function applyInstall(cwd: string, home: string, previewOnly: boolean): InstallPlan {
  const plan = planInstall(cwd, home);
  if (previewOnly) return plan;
  const paths = ensureHome(home);
  const settingsLocal = join(cwd, ".claude", "settings.local.json");
  mkdirSync(dirname(settingsLocal), { recursive: true });
  if (existsSync(settingsLocal)) {
    copyFileSync(settingsLocal, join(paths.backups, "settings.local.json"));
  }
  let existing: Record<string, unknown> = {};
  if (existsSync(settingsLocal)) {
    try {
      existing = JSON.parse(readFileSync(settingsLocal, "utf8")) as Record<string, unknown>;
    } catch {
      existing = {};
    }
  }
  const hooks = claudeSettingsHooks(plan.hook_command);
  const merged = { ...existing, ...hooks };
  writeFileSync(settingsLocal, `${JSON.stringify(merged, null, 2)}\n`);
  writeFileSync(paths.defaultPolicy, `${JSON.stringify(getPreset("standard"), null, 2)}\n`, { mode: 0o600 });
  writeFileSync(
    paths.installState,
    `${JSON.stringify(
      {
        version: FUSECAP_VERSION,
        cwd,
        home,
        hook_command: plan.hook_command,
        settings_local: settingsLocal,
        backed_up: existsSync(join(paths.backups, "settings.local.json")),
        installed_at: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
  chmodSync(home, 0o700);
  return plan;
}

export function uninstall(cwd: string, home: string, previewOnly: boolean): InstallPlan {
  const settingsLocal = join(cwd, ".claude", "settings.local.json");
  const backup = join(home, "backups", "settings.local.json");
  const actions: InstallPlan["actions"] = [
    { op: "remove", path: join(home, "policy.json"), detail: "owned policy" },
    { op: "remove", path: join(home, "install-state.json"), detail: "install record" },
    { op: "remove", path: join(home, "active-run.json"), detail: "active pointer" },
  ];
  if (existsSync(backup)) {
    actions.push({ op: "write", path: settingsLocal, detail: "restore settings.local.json backup" });
  } else {
    actions.push({ op: "remove", path: settingsLocal, detail: "remove FuseCap-written settings if no backup" });
  }
  if (previewOnly) return { actions, hook_command: "" };
  if (existsSync(backup) && existsSync(settingsLocal)) {
    copyFileSync(backup, settingsLocal);
  } else if (!existsSync(backup) && existsSync(settingsLocal)) {
    const raw = readFileSync(settingsLocal, "utf8");
    if (raw.includes("fusecap") || raw.includes("FUSECAP")) {
      rmSync(settingsLocal);
    }
  }
  for (const name of ["policy.json", "install-state.json", "active-run.json"]) {
    const path = join(home, name);
    if (existsSync(path)) rmSync(path);
  }
  return { actions, hook_command: "" };
}
