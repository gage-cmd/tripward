# ADR 0001 — TypeScript/Node for the 0–72h spike

Context: Chapter 13 prefers a Rust/Go systems binary for production supervision, storage, and distribution, and says the 72-hour spike may use the fastest safe language. Production language is selected after installer, process-tree, and hook latency tests.

Decision: Implement the enforceability spike as a TypeScript Node 20+ CLI (`tripward`) with vitest. Production language remains unchosen.

Alternatives: Go or Rust now. Rejected because adapter fixtures, policy tables, and hook JSON are faster to iterate in TypeScript, and the brain explicitly allows this for the spike.

Consequences: Process-tree and installer work is good enough to prove trips, not to ship a signed binary. A later ADR must pick the production language after the tests Chapter 13 names.

Evidence: Ch 13 “Suggested implementation”; this repository’s spike tests.

Revisit trigger: Private-alpha packaging, signed releases, or hook P95 > 35 ms on supported machines.
