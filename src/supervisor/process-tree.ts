import { execFileSync } from "node:child_process";

export function listDescendants(pid: number): number[] {
  const found = new Set<number>();
  const queue = [pid];
  while (queue.length) {
    const current = queue.shift();
    if (current === undefined) break;
    const children = childrenOf(current);
    for (const child of children) {
      if (!found.has(child) && child !== pid) {
        found.add(child);
        queue.push(child);
      }
    }
  }
  return [...found];
}

function childrenOf(pid: number): number[] {
  try {
    const out = execFileSync("ps", ["-eo", "pid=,ppid="], { encoding: "utf8" });
    const kids: number[] = [];
    for (const line of out.split("\n")) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) continue;
      const child = Number(parts[0]);
      const parent = Number(parts[1]);
      if (parent === pid && Number.isFinite(child)) kids.push(child);
    }
    return kids;
  } catch {
    return [];
  }
}

export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function signalPid(pid: number, signal: NodeJS.Signals): boolean {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

export function signalGroup(pid: number, signal: NodeJS.Signals): boolean {
  try {
    process.kill(-pid, signal);
    return true;
  } catch {
    return signalPid(pid, signal);
  }
}

export async function waitForExit(pid: number, timeoutMs: number, pollMs = 25): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!pidAlive(pid) && listDescendants(pid).every((child) => !pidAlive(child))) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return !pidAlive(pid);
}

export async function terminateTree(
  pid: number,
  gracefulMs: number,
): Promise<{ graceful: boolean; forced: boolean; pids: number[] }> {
  const pids = [pid, ...listDescendants(pid)];
  signalGroup(pid, "SIGTERM");
  const died = await waitForExit(pid, gracefulMs);
  if (died) {
    return { graceful: true, forced: false, pids };
  }
  signalGroup(pid, "SIGKILL");
  for (const child of listDescendants(pid)) {
    signalPid(child, "SIGKILL");
  }
  signalPid(pid, "SIGKILL");
  await waitForExit(pid, 1000);
  return { graceful: false, forced: true, pids: [pid, ...listDescendants(pid)] };
}
