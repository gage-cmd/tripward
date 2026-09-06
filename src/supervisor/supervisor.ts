import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Clock } from "../clock.js";
import { systemClock } from "../clock.js";
import type { ExitReason } from "../types.js";
import { pidAlive, terminateTree } from "./process-tree.js";

export interface SupervisorOptions {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  runDir: string;
  maxElapsedMs: number;
  gracefulStopMs: number;
  forceKill: boolean;
  hookHandshakeMs: number;
  requireHooks: boolean;
  clock?: Clock;
  onEvent?: (type: string, payload: Record<string, unknown>) => void;
}

export interface SupervisorResult {
  exit_reason: ExitReason;
  exit_code: number | null;
  child_pid?: number;
  elapsed_ms: number;
  graceful: boolean;
  forced: boolean;
  handshake_ok: boolean;
}

export function stopRequestPath(runDirectory: string): string {
  return join(runDirectory, "control", "stop.json");
}

export function handshakePath(runDirectory: string): string {
  return join(runDirectory, "control", "handshake.json");
}

export function requestStop(runDirectory: string, reason: ExitReason, detail: string): void {
  mkdirSync(join(runDirectory, "control"), { recursive: true });
  writeFileSync(
    stopRequestPath(runDirectory),
    JSON.stringify({ reason, detail, at: new Date().toISOString() }),
  );
}

export function markHandshake(runDirectory: string, sessionId?: string): void {
  mkdirSync(join(runDirectory, "control"), { recursive: true });
  writeFileSync(
    handshakePath(runDirectory),
    JSON.stringify({ ok: true, session_id: sessionId ?? null, at: new Date().toISOString() }),
  );
}

function readStop(runDirectory: string): { reason: ExitReason; detail: string } | null {
  const path = stopRequestPath(runDirectory);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as { reason: ExitReason; detail: string };
  } catch {
    return { reason: "unknown", detail: "unreadable stop file" };
  }
}

export async function supervise(options: SupervisorOptions): Promise<SupervisorResult> {
  const clock = options.clock ?? systemClock();
  const started = clock.nowMs();
  mkdirSync(join(options.runDir, "control"), { recursive: true });

  const child: ChildProcess = spawn(options.command, options.args, {
    cwd: options.cwd,
    env: options.env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stderrLog = createWriteStream(join(options.runDir, "child.stderr.log"));
  const stdoutLog = createWriteStream(join(options.runDir, "child.stdout.log"));
  child.stderr?.pipe(stderrLog);
  child.stdout?.pipe(stdoutLog);
  const pid = child.pid;
  if (!pid) {
    return {
      exit_reason: "crashed",
      exit_code: null,
      elapsed_ms: 0,
      graceful: false,
      forced: false,
      handshake_ok: false,
    };
  }
  options.onEvent?.("supervisor.started", { pid, command: options.command, args: options.args });

  let exitReason: ExitReason | null = null;
  let exitCode: number | null = null;
  let graceful = false;
  let forced = false;
  let stopping = false;

  const childExit = new Promise<void>((resolve) => {
    child.on("exit", (code) => {
      exitCode = code;
      resolve();
    });
    child.on("error", () => {
      exitReason = exitReason ?? "crashed";
      resolve();
    });
  });

  const stop = async (reason: ExitReason) => {
    if (stopping) return;
    stopping = true;
    exitReason = reason;
    options.onEvent?.("supervisor.stopping", { reason, pid });
    const result = await terminateTree(pid, options.forceKill ? options.gracefulStopMs : 30_000);
    graceful = result.graceful;
    forced = result.forced;
    options.onEvent?.("supervisor.stopped", { reason, graceful, forced, pids: result.pids });
  };

  const timer = setInterval(() => {
    const elapsed = clock.nowMs() - started;
    if (!stopping && options.maxElapsedMs > 0 && elapsed >= options.maxElapsedMs) {
      void stop("time_fuse");
    }
    const requested = readStop(options.runDir);
    if (!stopping && requested) {
      void stop(requested.reason);
    }
  }, 25);

  const handshakeDeadline = started + options.hookHandshakeMs;
  let handshakeOk = existsSync(handshakePath(options.runDir));

  const handshakeWait = (async () => {
    while (clock.nowMs() < handshakeDeadline && pidAlive(pid)) {
      if (existsSync(handshakePath(options.runDir))) {
        handshakeOk = true;
        return;
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    handshakeOk = existsSync(handshakePath(options.runDir));
    if (!handshakeOk && options.requireHooks && !stopping) {
      options.onEvent?.("supervisor.hooks_bypassed", {
        detail: "SessionStart handshake was not observed before the deadline.",
      });
      await stop("hooks_bypassed");
    }
  })();

  await Promise.race([childExit, handshakeWait.then(() => childExit)]);
  await childExit.catch(() => undefined);
  clearInterval(timer);

  if (!exitReason) {
    const requested = readStop(options.runDir);
    exitReason = requested?.reason ?? "completed";
  }

  return {
    exit_reason: exitReason,
    exit_code: exitCode,
    child_pid: pid,
    elapsed_ms: clock.nowMs() - started,
    graceful,
    forced,
    handshake_ok: handshakeOk,
  };
}
