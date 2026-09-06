import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyInstall, planInstall } from "../src/install/installer.js";
import { runDoctor } from "../src/install/doctor.js";
import { gitInit, tempDir } from "./helpers.js";

describe("E9 installer/doctor", () => {
  it("previews install without writing, then applies hooks + policy", () => {
    const cwd = gitInit(tempDir("inst-"));
    const home = join(cwd, ".tripward");
    const preview = planInstall(cwd, home);
    expect(preview.actions.length).toBeGreaterThan(0);
    expect(existsSync(join(cwd, ".claude", "settings.local.json"))).toBe(false);
    applyInstall(cwd, home, false);
    const settings = readFileSync(join(cwd, ".claude", "settings.local.json"), "utf8");
    expect(settings).toContain("PreToolUse");
    expect(existsSync(join(home, "policy.json"))).toBe(true);
    expect(existsSync(join(home, "install-state.json"))).toBe(true);
  });

  it("doctor exercises hook, journal, git, and terminate", async () => {
    const cwd = gitInit(tempDir("doc-"));
    const home = join(cwd, ".tripward");
    applyInstall(cwd, home, false);
    const report = await runDoctor(cwd, home);
    expect(report.components.find((c) => c.name === "journal")?.ok).toBe(true);
    expect(report.components.find((c) => c.name === "checkpoint")?.ok).toBe(true);
    expect(report.components.find((c) => c.name === "terminate")?.ok).toBe(true);
    expect(report.components.find((c) => c.name === "hook_roundtrip")?.ok).toBe(true);
  });
});
