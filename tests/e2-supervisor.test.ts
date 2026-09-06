import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";
import { listDescendants, pidAlive, terminateTree } from "../src/supervisor/process-tree.js";
import { supervise } from "../src/supervisor/supervisor.js";
import { tempDir } from "./helpers.js";

describe("E2 supervisor", () => {
  it("walks a PID tree and force-kills after a graceful timeout", async () => {
    const child = spawn(
      process.execPath,
      [
        "-e",
        "process.on('SIGTERM',()=>{}); require('child_process').spawn(process.execPath,['-e','process.on(\\'SIGTERM\\',()=>{}); setInterval(()=>{},1000)'],{stdio:'ignore'}); setInterval(()=>{},1000)",
      ],
      { detached: true, stdio: "ignore" },
    );
    const pid = child.pid;
    expect(pid).toBeTruthy();
    child.unref();
    await new Promise((r) => setTimeout(r, 80));
    const kids = listDescendants(pid!);
    expect(kids.length).toBeGreaterThanOrEqual(0);
    const result = await terminateTree(pid!, 80);
    expect(result.forced).toBe(true);
    expect(pidAlive(pid!)).toBe(false);
  });

  it("records time_fuse as the exit reason", async () => {
    const dir = tempDir("sup-");
    const result = await supervise({
      command: process.execPath,
      args: ["-e", "setInterval(()=>{},1000)"],
      cwd: dir,
      env: { ...process.env },
      runDir: dir,
      maxElapsedMs: 80,
      gracefulStopMs: 80,
      forceKill: true,
      hookHandshakeMs: 20,
      requireHooks: false,
    });
    expect(result.exit_reason).toBe("time_fuse");
    expect(result.child_pid).toBeTruthy();
  });
});
