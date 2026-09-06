import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Clock } from "../clock.js";
import { systemClock } from "../clock.js";
import { digestObject, sha256Prefixed } from "../digest.js";
import { newEventId } from "../ids.js";
import type { JournalEvent } from "../types.js";
import { JOURNAL_SCHEMA_VERSION } from "../version.js";

export const JOURNAL_FILENAME = "journal.jsonl";

export interface AppendInput {
  run_id: string;
  type: string;
  payload?: Record<string, unknown>;
  event_id?: string;
  adapter_event_id?: string;
  raw?: unknown;
}

export interface AppendResult {
  event: JournalEvent;
  duplicate: boolean;
}

export class Journal {
  readonly filePath: string;
  private events: JournalEvent[] = [];
  private keys = new Map<string, JournalEvent>();
  private nextSequence = 1;
  private readonly clock: Clock;

  constructor(filePath: string, clock: Clock = systemClock()) {
    this.filePath = filePath;
    this.clock = clock;
    mkdirSync(dirname(filePath), { recursive: true });
    this.reopen();
  }

  static open(runDirectory: string, clock?: Clock): Journal {
    return new Journal(join(runDirectory, JOURNAL_FILENAME), clock);
  }

  /** Reload complete lines written by this or another process. */
  syncFromDisk(): void {
    this.events = [];
    this.keys = new Map();
    this.nextSequence = 1;
    if (!existsSync(this.filePath)) return;
    const raw = readFileSync(this.filePath, "utf8");
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as JournalEvent;
        if (!parsed.sequence || !parsed.event_id || !parsed.digest) {
          continue;
        }
        this.events.push(parsed);
        this.keys.set(parsed.idempotency_key, parsed);
        this.nextSequence = Math.max(this.nextSequence, parsed.sequence + 1);
      } catch {
        // leave a partial trailing line for crash reopen
      }
    }
  }

  reopen(): { truncated_partial: boolean; last_sequence: number } {
    this.events = [];
    this.keys = new Map();
    this.nextSequence = 1;
    if (!existsSync(this.filePath)) {
      writeFileSync(this.filePath, "", { mode: 0o600 });
      return { truncated_partial: false, last_sequence: 0 };
    }
    const raw = readFileSync(this.filePath, "utf8");
    const lines = raw.split("\n");
    let truncated = false;
    const valid: string[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as JournalEvent;
        if (!parsed.sequence || !parsed.event_id || !parsed.digest) {
          throw new Error("incomplete event");
        }
        this.events.push(parsed);
        this.keys.set(parsed.idempotency_key, parsed);
        this.nextSequence = Math.max(this.nextSequence, parsed.sequence + 1);
        valid.push(line);
      } catch {
        truncated = true;
      }
    }
    if (truncated) {
      writeFileSync(this.filePath, valid.length ? `${valid.join("\n")}\n` : "", {
        mode: 0o600,
      });
      const unknown: JournalEvent = {
        schema_version: JOURNAL_SCHEMA_VERSION,
        event_id: newEventId(),
        run_id: this.events.at(-1)?.run_id ?? "unknown",
        sequence: this.nextSequence,
        type: "journal.unknown_after_crash",
        wall_time: this.clock.now().toISOString(),
        monotonic_ms: this.clock.monotonicMs(),
        idempotency_key: `crash:${this.nextSequence}`,
        payload: {
          note: "Partial trailing record discarded on reopen. Incomplete actions marked unknown.",
        },
        digest: "",
        raw_persisted: false,
      };
      unknown.digest = digestObject({ ...unknown, digest: undefined });
      this.events.push(unknown);
      this.keys.set(unknown.idempotency_key, unknown);
      this.nextSequence += 1;
      appendFileSync(this.filePath, `${JSON.stringify(unknown)}\n`);
    }
    return { truncated_partial: truncated, last_sequence: this.nextSequence - 1 };
  }

  append(input: AppendInput): AppendResult {
    this.syncFromDisk();
    const body = {
      type: input.type,
      payload: input.payload ?? {},
      adapter_event_id: input.adapter_event_id ?? null,
    };
    const payloadDigest = digestObject(body);
    const idempotencyKey = sha256Prefixed(
      `${input.adapter_event_id ?? input.event_id ?? payloadDigest}:${payloadDigest}`,
    );
    const existing = this.keys.get(idempotencyKey);
    if (existing) {
      return { event: existing, duplicate: true };
    }
    const event: JournalEvent = {
      schema_version: JOURNAL_SCHEMA_VERSION,
      event_id: input.event_id ?? newEventId(),
      run_id: input.run_id,
      sequence: this.nextSequence,
      type: input.type,
      wall_time: this.clock.now().toISOString(),
      monotonic_ms: Math.round(this.clock.monotonicMs()),
      idempotency_key: idempotencyKey,
      payload: input.payload ?? {},
      digest: "",
      raw_persisted: false,
    };
    event.digest = digestObject({ ...event, digest: undefined });
    appendFileSync(this.filePath, `${JSON.stringify(event)}\n`);
    this.events.push(event);
    this.keys.set(idempotencyKey, event);
    this.nextSequence += 1;
    return { event, duplicate: false };
  }

  list(): JournalEvent[] {
    this.syncFromDisk();
    return [...this.events];
  }

  findByType(type: string): JournalEvent[] {
    this.syncFromDisk();
    return this.events.filter((event) => event.type === type);
  }

  last(): JournalEvent | undefined {
    return this.events.at(-1);
  }
}
