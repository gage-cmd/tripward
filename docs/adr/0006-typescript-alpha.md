# ADR 0006 — Extend the TypeScript CLI for Days 4–7

Context: Chapter 13 still prefers a systems language for production. ADR 0001 chose TypeScript for the 72-hour spike and said to revisit at private-alpha packaging.

Decision: Keep the existing Node 20+ TypeScript CLI for the private-alpha pack (installer, doctor, shadow, replay). Do not rewrite in Go/Rust this milestone.

Alternatives: Greenfield Go/Rust installer. Rejected — Gate 0 just landed; a language swap would delay the five-install path and discard working hook/supervisor tests.

Consequences: No signed binary. Distribution is still `npx tsx src/cli.ts` / `npm test`. A later ADR must pick the production language after installer + hook-latency evidence.

Evidence: Ch 13; Ch 25 Days 4–7; user hypothesis “extend existing TypeScript CLI.”

Revisit trigger: Signed releases, hook P95 > 35 ms, or a packaging requirement the Node CLI cannot meet.
