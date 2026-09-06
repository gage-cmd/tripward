import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEMO_TRIP_BANNER, runDemoTrip } from "../src/commands/demo-trip.js";
import { redactReceipt } from "../src/receipt/redact.js";
import { gitInit, tempDir } from "./helpers.js";
import type { ReceiptDocument } from "../src/types.js";

describe("tripward demo-trip (operator-injected, not live Claude, not stub CI)", () => {
  it("trips dangerous git reset --hard via the real handleHook path and labels the receipt", async () => {
    const cwd = gitInit(tempDir("demo-dang-"));
    const home = join(cwd, ".tripward");
    const result = await runDemoTrip({ cwd, home, kind: "dangerous", preset: "spike" });
    expect(result.signal_class).toBe("operator-injected-demo");
    expect(result.exit_reason).toBe("dangerous_command");
    expect(result.health).toBe("degraded");
    const receipt = JSON.parse(readFileSync(result.receipt_json, "utf8")) as ReceiptDocument;
    expect(receipt.environment.signal_class).toBe("operator-injected-demo");
    expect(receipt.usage.cost).toBeNull();
    expect(receipt.usage.source).toBe("unavailable");
    expect(receipt.limitations.some((line) => line.includes("OPERATOR-INJECTED DEMO"))).toBe(true);
    expect(receipt.limitations.some((line) => line.includes("does not count as alpha legitimate signal"))).toBe(true);
    expect(receipt.timeline.some((item) => item.type === "fuse.tripped")).toBe(true);
    expect(receipt.timeline.some((item) => item.type === "tool.requested")).toBe(true);
    const redacted = redactReceipt(receipt);
    expect(redacted.environment).toMatchObject({ signal_class: "operator-injected-demo" });
    expect(DEMO_TRIP_BANNER).toMatch(/not issued by Claude Code/i);
  });

  it("trips exact-loop and hook-block kinds the same labeled way", async () => {
    const cwd = gitInit(tempDir("demo-loop-"));
    const home = join(cwd, ".tripward");
    const loop = await runDemoTrip({ cwd, home, kind: "exact-loop", preset: "spike" });
    expect(loop.exit_reason).toBe("exact_loop");
    expect(loop.signal_class).toBe("operator-injected-demo");
    const blocked = await runDemoTrip({ cwd, home, kind: "hook-block", preset: "spike" });
    expect(blocked.exit_reason).toBe("hook_block");
    const receipt = JSON.parse(readFileSync(blocked.receipt_json, "utf8")) as ReceiptDocument;
    expect(receipt.environment.signal_class).toBe("operator-injected-demo");
  });
});
