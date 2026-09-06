export interface Clock {
  now(): Date;
  nowMs(): number;
  monotonicMs(): number;
}

export function systemClock(): Clock {
  const origin = process.hrtime.bigint();
  return {
    now: () => new Date(),
    nowMs: () => Date.now(),
    monotonicMs: () => Number(process.hrtime.bigint() - origin) / 1_000_000,
  };
}

export function frozenClock(at: Date, mono = 0): Clock {
  return {
    now: () => at,
    nowMs: () => at.getTime(),
    monotonicMs: () => mono,
  };
}

export class ManualClock implements Clock {
  wallMs: number;
  monoMs: number;

  constructor(wallMs = Date.now(), monoMs = 0) {
    this.wallMs = wallMs;
    this.monoMs = monoMs;
  }

  now(): Date {
    return new Date(this.wallMs);
  }

  nowMs(): number {
    return this.wallMs;
  }

  monotonicMs(): number {
    return this.monoMs;
  }

  advance(ms: number): void {
    this.wallMs += ms;
    this.monoMs += ms;
  }
}
