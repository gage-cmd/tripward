import { randomBytes } from "node:crypto";

export function newId(prefix: string): string {
  const time = Date.now().toString(36);
  const rand = randomBytes(6).toString("hex");
  return `${prefix}_${time}${rand}`;
}

export function newRunId(): string {
  return newId("run");
}

export function newReceiptId(): string {
  return newId("rcpt");
}

export function newDecisionId(): string {
  return newId("dec");
}

export function newEventId(): string {
  return newId("evt");
}

export function newCheckpointId(): string {
  return newId("ckpt");
}
