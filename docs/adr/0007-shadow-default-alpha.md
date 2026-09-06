# ADR 0007 — Shadow-first defaults; hard stops remain available

Context: Chapter 16 and the reference policy default `mode: shadow`. The spike shipped `standard` as `enforce` so E1–E9 trips were the default path.

Decision: Alpha `standard` and `fusecap init` write `mode: shadow`. Behavioral detectors (exact-repeat today) and non-safety policy matches emit `detector.signaled` / `policy.signaled` and warn; they do not interrupt. Always-enforce reasons stay live in every mode: `SYS_SAFETY`, `DANGEROUS_COMMAND`, `HOOKS_BYPASSED`, `CHECKPOINT_MISSING`. The `spike` preset and `--mode enforce` / `fusecap protect --mode enforce` keep the Gate 0 hard-stop path.

Alternatives: Leave `standard` on enforce. Rejected — Ch 25 alpha is shadow-first for behavioral judgment. Testers would otherwise experience interrupts before detectors have a corpus.

Consequences: A default `fusecap run` will not deny a listed tool or trip exact-repeat. Operators who want Gate 0 behavior must flip enforce or use `--preset spike`. Time-fuse at the supervisor still honors `max_elapsed_seconds` (process envelope), even when hook-level `TIME_FUSE` is remapped to warn in shadow.

Evidence: Ch 16; Ch 25 Days 4–7; Ch 35 reference policy.

Revisit trigger: After one legitimate live signal is reviewed; then decide whether exact-repeat may interrupt in `standard`.
