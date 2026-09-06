import { createHash } from "node:crypto";

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function sha256Prefixed(input: string | Buffer): string {
  return `sha256:${sha256Hex(input)}`;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const item = record[key];
      if (item !== undefined) {
        out[key] = sortValue(item);
      }
    }
    return out;
  }
  return value;
}

export function digestObject(value: unknown): string {
  return sha256Prefixed(stableStringify(value));
}
