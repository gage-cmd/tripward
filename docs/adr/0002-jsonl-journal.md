# ADR 0002 — JSONL journal instead of SQLite for the spike

Context: Chapter 17 requires SQLite WAL or an equivalent durable local store with migrations and backups.

Decision: The spike uses an append-only JSONL file per run (`journal.jsonl`), mode 0600, with sequence numbers, payload-digest idempotency keys, and crash-reopen that discards a partial trailing line and emits `journal.unknown_after_crash`.

Alternatives: SQLite WAL now. Deferred to keep the spike vertical and reviewable.

Consequences: No cross-run SQL queries or automatic retention vacuum. Equivalent durability for a single run is preserved. Migrations are not implemented.

Evidence: Ch 14 ordering/durability; Ch 17 storage rules.

Revisit trigger: History UI, multi-run analytics, or paid retention (E3 productionization).
