import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compilePolicy } from "../src/policy/compiler.js";
import { getPreset } from "../src/policy/presets.js";
import type { EffectivePolicy, PolicyDocument } from "../src/types.js";

export function tempDir(prefix = "tripward-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function gitInit(dir: string): string {
  execFileSync("git", ["init", "-b", "main"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "spike@tripward.test"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Tripward Spike"], { cwd: dir });
  writeFileSync(join(dir, "README.md"), "hello\n");
  execFileSync("git", ["add", "README.md"], { cwd: dir });
  execFileSync("git", ["commit", "-m", "init"], { cwd: dir });
  return dir;
}

export function policy(overrides: Partial<PolicyDocument> = {}): EffectivePolicy {
  const base = getPreset("spike");
  return compilePolicy({
    ...base,
    ...overrides,
    runtime: { ...base.runtime, ...overrides.runtime },
    tools: { ...base.tools, ...overrides.tools },
    behavior: {
      exact_repeat: { ...base.behavior.exact_repeat, ...overrides.behavior?.exact_repeat },
    },
    commands: { ...base.commands, ...overrides.commands },
    git: { ...base.git, ...overrides.git },
    receipt: { ...base.receipt, ...overrides.receipt },
  }).policy;
}

export function writePolicyFile(dir: string, overrides: Partial<PolicyDocument> = {}): string {
  const compiled = policy(overrides);
  const { digest: _digest, unsupported_controls: _unsupported, ...document } = compiled;
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "policy.json");
  writeFileSync(path, JSON.stringify(document));
  return path;
}
