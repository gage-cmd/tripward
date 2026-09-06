# ADR 0003 — File control plane instead of loopback HTTP daemon

Context: Chapter 18 specifies a loopback API (`POST /v1/runs/{id}/decision`, `/stop`, …) with install secrets and CSRF rules. Chapter 13 lists a local daemon.

Decision: The spike has no daemon and no loopback HTTP. `tripward run` supervises a child. `tripward hook` is a Claude Code command hook that reads stdin, appends the journal, evaluates policy, and writes `control/stop.json` / `control/handshake.json` under the run directory. IPC is environment variables (`TRIPWARD_RUN_DIR`, with leftover `FUSECAP_RUN_DIR` still read) plus those files.

Alternatives: Ship the Ch 18 API now. Rejected as P1-adjacent surface (dashboard attack, CSRF, origin checks) that is not required to prove the five trips.

Consequences: No concurrent-run accounting, no remote hook HTTP. Fail-visibly if `TRIPWARD_RUN_DIR` (and leftover `FUSECAP_RUN_DIR`) is unset (hooks cannot silently no-op).

Evidence: Ch 18; current authorization “prove reliable Claude Code controls.”

Revisit trigger: Local UI (E10) or a real daemon health check in private alpha.
