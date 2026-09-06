import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyInstall } from "../src/install/installer.js";
import { formatDoctorReport, runDoctor } from "../src/install/doctor.js";
import { gitInit, tempDir } from "./helpers.js";

describe("Days 4–7 doctor", () => {
  it("prints a clear PASS/FAIL table and exercises required checks", async () => {
    const cwd = gitInit(tempDir("doc-a-"));
    const home = join(cwd, ".tripward");
    applyInstall(cwd, home, false);
    const report = await runDoctor(cwd, home);
    const names = report.components.map((c) => c.name);
    for (const required of [
      "hook_roundtrip",
      "journal",
      "git_posture",
      "sandbox_posture",
      "terminate",
      "hooks_installed",
      "storage_home",
      "backups",
    ]) {
      expect(names).toContain(required);
    }
    expect(report.components.find((c) => c.name === "hook_roundtrip")?.ok).toBe(true);
    expect(report.components.find((c) => c.name === "journal")?.ok).toBe(true);
    expect(report.components.find((c) => c.name === "terminate")?.ok).toBe(true);
    expect(report.components.find((c) => c.name === "sandbox_posture")?.ok).toBe(true);
    const text = formatDoctorReport(report);
    expect(text).toMatch(/^Tripward doctor /);
    expect(text).not.toMatch(/FuseCap/);
    expect(text).toMatch(/PASS|FAIL/);
    expect(text).toMatch(/OVERALL/);
    expect(text).toMatch(/hook_roundtrip/);
    expect(text).toMatch(/sandbox_posture/);
    expect(report.ok).toBe(true);
  });
});
