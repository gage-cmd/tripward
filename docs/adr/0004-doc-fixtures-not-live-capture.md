# ADR 0004 — Official-doc fixtures because this environment has no `claude` CLI

Context: E1 asks to capture official lifecycle payloads. The spike host does not have Claude Code installed.

Decision: Check in documentation fixtures copied from the official hooks reference (2026-09-06, https://code.claude.com/docs/en/hooks.md) under `fixtures/claude-hooks/`. Label them as documentation fixtures, not live dumps. Synthetic trips use those payloads through `tripward hook` / the documented stub.

Alternatives: Skip E1 until a Mac is available. Rejected — the adapter contract can still be tested, and Gage’s two healthy live sessions re-capture real payloads.

Consequences: Field drift vs a future Claude Code version is possible. Doctor reports `claude_cli` as optional and never claims “protected” solely because fixtures exist. Unsupported versions refuse a full-protection claim (AC-12 spirit).

Evidence: Ch 19 adapter limitation; Ch 39 source [3].

Revisit trigger: First live Mac session; Claude Code hook schema change.
