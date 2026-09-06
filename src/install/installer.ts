import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { claudeSettingsHooks } from "../adapter/hooks.js";
import { ensureHome, pathsFor } from "../paths.js";
import { compilePolicy } from "../policy/compiler.js";
import { getPreset } from "../policy/presets.js";
import type { PolicyDocument } from "../types.js";
import { FUSECAP_VERSION } from "../version.js";
import {
  backupExistingFile,
  findEntry,
  loadManifest,
  restoreVerifiedBackup,
  type BackupEntry,
} from "./backup.js";
import {
  chmodNeverBroader,
  DIR_MODE,
  FILE_MODE,
  formatMode,
  HOME_MODE,
  modeOf,
  writeRestrictedFile,
} from "./permissions.js";

export interface InstallAction {
  op: "write" | "backup" | "chmod" | "remove" | "restore" | "skip";
  path: string;
  detail: string;
}

export interface InstallPlan {
  actions: InstallAction[];
  hook_command: string;
  already_installed: boolean;
  default_mode: "shadow" | "enforce";
}

export interface InstallState {
  schema_version: "1.0";
  version: string;
  cwd: string;
  home: string;
  hook_command: string;
  settings_local: string;
  policy_path: string;
  owned_files: string[];
  backup_ids: string[];
  default_preset: string;
  default_mode: "shadow" | "enforce";
  installed_at: string;
  updated_at: string;
}

const SETTINGS_BACKUP_ID = "settings.local.json";

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

function settingsPath(cwd: string): string {
  return join(cwd, ".claude", "settings.local.json");
}

function readJson(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function readInstallState(home: string): InstallState | null {
  const path = pathsFor(home).installState;
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as InstallState;
  } catch {
    return null;
  }
}

function hooksAlreadyInstalled(settings: Record<string, unknown>, hookCommand: string): boolean {
  const text = JSON.stringify(settings);
  return text.includes("PreToolUse") && text.includes(hookCommand);
}

function mergeClaudeSettings(
  existing: Record<string, unknown>,
  hookCommand: string,
): Record<string, unknown> {
  const incoming = claudeSettingsHooks(hookCommand) as Record<string, unknown>;
  const existingHooks =
    existing.hooks && typeof existing.hooks === "object" && !Array.isArray(existing.hooks)
      ? (existing.hooks as Record<string, unknown>)
      : {};
  const incomingHooks = (incoming.hooks ?? {}) as Record<string, unknown>;
  return {
    ...existing,
    ...incoming,
    hooks: { ...existingHooks, ...incomingHooks },
  };
}

/** Drop FuseCap-owned hook commands; leave every other key untouched. */
export function stripFuseCapHooks(existing: Record<string, unknown>): Record<string, unknown> {
  const hooks = existing.hooks;
  if (!hooks || typeof hooks !== "object" || Array.isArray(hooks)) {
    return { ...existing };
  }
  const nextHooks: Record<string, unknown> = {};
  for (const [event, value] of Object.entries(hooks as Record<string, unknown>)) {
    if (!Array.isArray(value)) {
      nextHooks[event] = value;
      continue;
    }
    const kept = value
      .map((matcher) => {
        if (!matcher || typeof matcher !== "object") return matcher;
        const record = matcher as Record<string, unknown>;
        const inner = Array.isArray(record.hooks) ? record.hooks : [];
        const filtered = inner.filter((hook) => {
          if (!hook || typeof hook !== "object") return true;
          const command = String((hook as { command?: unknown }).command ?? "");
          return !command.includes("fusecap") && !command.includes("cli.ts hook") && !command.includes("cli.js hook");
        });
        if (filtered.length === 0) return null;
        return { ...record, hooks: filtered };
      })
      .filter((item) => item !== null);
    if (kept.length > 0) nextHooks[event] = kept;
  }
  const next = { ...existing };
  if (Object.keys(nextHooks).length === 0) {
    delete next.hooks;
  } else {
    next.hooks = nextHooks;
  }
  return next;
}

export function defaultAlphaPolicy(preset = "standard"): PolicyDocument {
  const base = getPreset(preset);
  return { ...base, mode: "shadow" };
}

export function planInstall(
  cwd: string,
  home: string,
  hookCommand = hookCommandForThisInstall(),
): InstallPlan {
  const actions: InstallAction[] = [];
  const settingsLocal = settingsPath(cwd);
  const policyPath = join(home, "policy.json");
  const installState = join(home, "install-state.json");
  const existing = readInstallState(home);
  const already = Boolean(existing) && existsSync(settingsLocal) && hooksAlreadyInstalled(readJson(settingsLocal), hookCommand);
  if (existsSync(settingsLocal)) {
    actions.push({
      op: "backup",
      path: join(home, "backups", SETTINGS_BACKUP_ID),
      detail: already
        ? "skip new snapshot if a verified pre-install backup already exists"
        : `backup ${settingsLocal} (sha256 + mode recorded)`,
    });
  }
  actions.push({
    op: already && existsSync(policyPath) ? "skip" : "write",
    path: policyPath,
    detail: already && existsSync(policyPath)
      ? "leave existing policy (idempotent)"
      : "default shadow policy (standard preset, mode=shadow)",
  });
  actions.push({
    op: already ? "skip" : "write",
    path: settingsLocal,
    detail: already ? "hooks already present" : "Claude Code PreToolUse/Session hooks",
  });
  actions.push({ op: "write", path: installState, detail: "install record (owned paths + backup ids)" });
  actions.push({ op: "chmod", path: home, detail: `restrict home to ${formatMode(HOME_MODE)} (never broaden)` });
  return { actions, hook_command: hookCommand, already_installed: already, default_mode: "shadow" };
}

export function applyInstall(
  cwd: string,
  home: string,
  previewOnly: boolean,
  options: { preset?: string; hookCommand?: string; mode?: "shadow" | "enforce" } = {},
): InstallPlan {
  const hookCommand = options.hookCommand ?? hookCommandForThisInstall();
  const plan = planInstall(cwd, home, hookCommand);
  if (previewOnly) return plan;
  const paths = ensureHome(home);
  chmodNeverBroader(home, HOME_MODE);
  chmodNeverBroader(paths.runs, DIR_MODE);
  chmodNeverBroader(paths.backups, DIR_MODE);

  const settingsLocal = settingsPath(cwd);
  mkdirSync(dirname(settingsLocal), { recursive: true });
  const backupIds: string[] = [];
  if (existsSync(settingsLocal)) {
    const result = backupExistingFile(paths.backups, SETTINGS_BACKUP_ID, settingsLocal, SETTINGS_BACKUP_ID);
    backupIds.push(result.entry.id);
    if (!result.created) {
      plan.actions = plan.actions.map((action) =>
        action.op === "backup"
          ? { ...action, op: "skip", detail: result.skipped_reason ?? action.detail }
          : action,
      );
    }
  }

  const existingSettings = readJson(settingsLocal);
  const merged = mergeClaudeSettings(existingSettings, hookCommand);
  const existed = existsSync(settingsLocal);
  const previousMode = existed ? modeOf(settingsLocal) : FILE_MODE;
  writeRestrictedFile(settingsLocal, `${JSON.stringify(merged, null, 2)}\n`, FILE_MODE);
  if (existed) {
    // Put back the pre-write mode (preserve). This is not broadening vs the
    // file the user already had; FuseCap-owned files stay 0600/0700.
    chmodSync(settingsLocal, previousMode);
  }

  const policyPath = paths.defaultPolicy;
  const alreadyHadPolicy = existsSync(policyPath);
  if (!alreadyHadPolicy) {
    const compiled = compilePolicy({
      ...defaultAlphaPolicy(options.preset ?? "standard"),
      mode: options.mode ?? "shadow",
    });
    const { digest: _d, unsupported_controls: _u, ...document } = compiled.policy;
    writeRestrictedFile(policyPath, `${JSON.stringify(document, null, 2)}\n`, FILE_MODE);
  }

  const now = new Date().toISOString();
  const prior = readInstallState(home);
  const state: InstallState = {
    schema_version: "1.0",
    version: FUSECAP_VERSION,
    cwd,
    home,
    hook_command: hookCommand,
    settings_local: settingsLocal,
    policy_path: policyPath,
    owned_files: [policyPath, paths.installState, paths.activeRun],
    backup_ids: Array.from(new Set([...(prior?.backup_ids ?? []), ...backupIds])),
    default_preset: options.preset ?? "standard",
    default_mode: options.mode ?? "shadow",
    installed_at: prior?.installed_at ?? now,
    updated_at: now,
  };
  writeRestrictedFile(paths.installState, `${JSON.stringify(state, null, 2)}\n`, FILE_MODE);
  chmodNeverBroader(home, HOME_MODE);
  return {
    ...plan,
    already_installed: alreadyHadPolicy && plan.already_installed,
    default_mode: state.default_mode,
  };
}

export function uninstall(cwd: string, home: string, previewOnly: boolean): InstallPlan {
  const settingsLocal = settingsPath(cwd);
  const paths = pathsFor(home);
  const state = readInstallState(home);
  const manifest = loadManifest(paths.backups);
  const backup = findEntry(manifest, SETTINGS_BACKUP_ID);
  const actions: InstallAction[] = [
    { op: "remove", path: paths.defaultPolicy, detail: "owned policy" },
    { op: "remove", path: paths.installState, detail: "install record" },
    { op: "remove", path: paths.activeRun, detail: "active pointer" },
  ];
  let restorePlan: InstallAction;
  if (backup) {
    const verified = backup.backup_path && existsSync(backup.backup_path);
    restorePlan = {
      op: "restore",
      path: settingsLocal,
      detail: verified
        ? `restore ${SETTINGS_BACKUP_ID} only if sha256 ${backup.sha256} still matches`
        : "backup record present but file missing — will not invent a restore",
    };
  } else if (existsSync(settingsLocal)) {
    restorePlan = {
      op: "write",
      path: settingsLocal,
      detail: "no verified backup — strip FuseCap hooks only; leave other settings",
    };
  } else {
    restorePlan = { op: "skip", path: settingsLocal, detail: "no settings file and no backup" };
  }
  actions.push(restorePlan);
  if (previewOnly) return { actions, hook_command: "", already_installed: Boolean(state), default_mode: "shadow" };

  if (backup) {
    const result = restoreVerifiedBackup(backup, settingsLocal);
    if (!result.ok) {
      actions[actions.length - 1] = {
        op: "skip",
        path: settingsLocal,
        detail: `refused restore: ${result.detail}`,
      };
      if (existsSync(settingsLocal)) {
        const stripped = stripFuseCapHooks(readJson(settingsLocal));
        writeRestrictedFile(settingsLocal, `${JSON.stringify(stripped, null, 2)}\n`, FILE_MODE);
        actions.push({
          op: "write",
          path: settingsLocal,
          detail: "stripped FuseCap hooks after refused restore (original backup left untouched)",
        });
      }
    } else {
      actions[actions.length - 1] = {
        op: "restore",
        path: settingsLocal,
        detail: `restored verified backup (mode ${formatMode(result.mode)})`,
      };
    }
  } else if (existsSync(settingsLocal)) {
    const raw = readFileSync(settingsLocal, "utf8");
    if (raw.includes("fusecap") || raw.includes("FUSECAP") || raw.includes("cli.ts hook") || raw.includes("cli.js hook")) {
      const stripped = stripFuseCapHooks(readJson(settingsLocal));
      const leftoverKeys = Object.keys(stripped).filter((key) => key !== "hooks" || stripped.hooks);
      if (leftoverKeys.length === 0) {
        rmSync(settingsLocal);
        actions[actions.length - 1] = {
          op: "remove",
          path: settingsLocal,
          detail: "removed FuseCap-only settings (no pre-install backup)",
        };
      } else {
        writeRestrictedFile(settingsLocal, `${JSON.stringify(stripped, null, 2)}\n`, FILE_MODE);
        actions[actions.length - 1] = {
          op: "write",
          path: settingsLocal,
          detail: "stripped FuseCap hooks; other settings preserved",
        };
      }
    }
  }

  for (const name of ["policy.json", "install-state.json", "active-run.json"]) {
    const path = join(home, name);
    if (existsSync(path)) rmSync(path);
  }
  return { actions, hook_command: "", already_installed: false, default_mode: "shadow" };
}

export function listedBackups(home: string): BackupEntry[] {
  return loadManifest(pathsFor(home).backups).entries;
}
