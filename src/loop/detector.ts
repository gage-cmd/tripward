export interface RepeatObservation {
  event_id: string;
  signature: string;
}

export interface ExactLoopHit {
  tripped: boolean;
  count: number;
  threshold: number;
  window: number;
  signature: string;
  evidence_refs: string[];
}

export function detectExactLoop(
  history: RepeatObservation[],
  incoming: RepeatObservation,
  threshold: number,
  window: number,
): ExactLoopHit {
  const slice = [...history, incoming].slice(-window);
  const matches = slice.filter((item) => item.signature === incoming.signature);
  return {
    tripped: matches.length >= threshold,
    count: matches.length,
    threshold,
    window,
    signature: incoming.signature,
    evidence_refs: matches.map((item) => item.event_id),
  };
}
