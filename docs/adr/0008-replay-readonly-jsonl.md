# ADR 0008 — Replay reads JSONL/receipts; no mutation, no SQLite

Context: E14 calls for historical replay with compatibility adapters. Chapter 17 still names SQLite WAL. ADR 0002 chose JSONL for the spike.

Decision: `fusecap replay` is a read-only parser over `runs/*/journal.jsonl` and `receipt.json`. It never creates or writes files. Events in the known type set are **observed**; unknown types and receipt-only reconstructions are **inferred**. Privacy limitations are printed every time.

Alternatives: SQLite import + mutation-capable “repair.” Rejected — alpha replay is an audit aid, not a store migration.

Consequences: No cross-run SQL. Foreign schema versions are best-effort. This is not a full E14 compatibility matrix.

Evidence: Ch 19 CLI; Ch 26 E14; ADR 0002.

Revisit trigger: History UI (E10) or a second journal schema version in the wild.
