import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyInstall, planInstall, stripTripwardHooks, uninstall } from "../src/install/installer.js";
import { hashFile, loadManifest } from "../src/install/backup.js";
import { modeOf } from "../src/install/permissions.js";
import { gitInit, tempDir } from "./helpers.js";

describe("Days 4–7 reversible installer", () => {
  it("previews without writing, then installs a shadow policy and 0700 home", () => {
    const cwd = gitInit(tempDir("a-init-"));
    const home = join(cwd, ".tripward");
    const preview = planInstall(cwd, home);
    expect(preview.default_mode).toBe("shadow");
    expect(existsSync(join(cwd, ".claude", "settings.local.json"))).toBe(false);
    applyInstall(cwd, home, false);
    expect(modeOf(home)).toBe(0o700);
    const policy = JSON.parse(readFileSync(join(home, "policy.json"), "utf8")) as { mode: string };
    expect(policy.mode).toBe("shadow");
    expect(modeOf(join(home, "policy.json"))).toBe(0o600);
    expect(readFileSync(join(cwd, ".claude", "settings.local.json"), "utf8")).toContain("PreToolUse");
  });

  it("is idempotent and does not replace a verified pre-install backup", () => {
    const cwd = gitInit(tempDir("a-idemp-"));
    const home = join(cwd, ".tripward");
    const settings = join(cwd, ".claude", "settings.local.json");
    mkdirSync(join(cwd, ".claude"), { recursive: true });
    writeFileSync(settings, `${JSON.stringify({ permissions: { allow: ["Bash"] } }, null, 2)}\n`);
    applyInstall(cwd, home, false);
    const first = loadManifest(join(home, "backups")).entries[0];
    expect(first).toBeTruthy();
    const digest = first.sha256;
    applyInstall(cwd, home, false);
    const second = loadManifest(join(home, "backups")).entries[0];
    expect(second.sha256).toBe(digest);
    expect(hashFile(second.backup_path)).toBe(digest);
    const settingsAfter = JSON.parse(readFileSync(settings, "utf8")) as { permissions?: { allow?: string[] } };
    expect(settingsAfter.permissions?.allow).toEqual(["Bash"]);
  });

  it("uninstall restores a verified backup and refuses a tampered one", () => {
    const cwd = gitInit(tempDir("a-un-"));
    const home = join(cwd, ".tripward");
    const settings = join(cwd, ".claude", "settings.local.json");
    mkdirSync(join(cwd, ".claude"), { recursive: true });
    writeFileSync(settings, `${JSON.stringify({ theme: "original" }, null, 2)}\n`, { mode: 0o644 });
    applyInstall(cwd, home, false);
    expect(readFileSync(settings, "utf8")).toContain("PreToolUse");
    const restored = uninstall(cwd, home, false);
    expect(restored.actions.some((action) => action.op === "restore" && action.detail.includes("verified"))).toBe(true);
    expect(JSON.parse(readFileSync(settings, "utf8"))).toEqual({ theme: "original" });
    expect(existsSync(join(home, "policy.json"))).toBe(false);

    writeFileSync(settings, `${JSON.stringify({ theme: "again" }, null, 2)}\n`);
    applyInstall(cwd, home, false);
    const backupPath = join(home, "backups", "settings.local.json");
    writeFileSync(backupPath, "tampered");
    const refused = uninstall(cwd, home, false);
    expect(refused.actions.some((action) => action.detail.includes("refused restore") || action.detail.includes("stripped"))).toBe(true);
    const after = JSON.parse(readFileSync(settings, "utf8")) as { hooks?: unknown; theme?: string };
    expect(JSON.stringify(after)).not.toContain("PreToolUse");
  });

  it("never broadens home or policy modes on re-init", () => {
    const cwd = gitInit(tempDir("a-perm-"));
    const home = join(cwd, ".tripward");
    applyInstall(cwd, home, false);
    chmodSync(home, 0o700);
    chmodSync(join(home, "policy.json"), 0o600);
    applyInstall(cwd, home, false);
    expect(modeOf(home)).toBe(0o700);
    expect(modeOf(join(home, "policy.json"))).toBe(0o600);
    expect(modeOf(home) & 0o077).toBe(0);
  });

  it("strips only Tripward hook commands from mixed settings", () => {
    const mixed = {
      theme: "keep",
      hooks: {
        SessionStart: [
          {
            matcher: "*",
            hooks: [
              { type: "command", command: "echo mine" },
              { type: "command", command: "npx --yes tsx /tmp/cli.ts hook" },
            ],
          },
        ],
      },
    };
    const stripped = stripTripwardHooks(mixed);
    expect(stripped.theme).toBe("keep");
    const start = (stripped.hooks as { SessionStart: Array<{ hooks: Array<{ command: string }> }> }).SessionStart;
    expect(start[0].hooks).toHaveLength(1);
    expect(start[0].hooks[0].command).toBe("echo mine");
  });

  it("also strips leftover fusecap hook commands from mixed settings", () => {
    const mixed = {
      theme: "keep",
      hooks: {
        PreToolUse: [
          {
            matcher: "*",
            hooks: [
              { type: "command", command: "echo mine" },
              { type: "command", command: "npx --yes tsx /old/fusecap/src/cli.ts hook" },
            ],
          },
        ],
      },
    };
    const stripped = stripTripwardHooks(mixed);
    const pre = (stripped.hooks as { PreToolUse: Array<{ hooks: Array<{ command: string }> }> }).PreToolUse;
    expect(pre[0].hooks).toEqual([{ type: "command", command: "echo mine" }]);
  });
});
