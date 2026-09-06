# ADR 0009 — `tripward demo-trip` is operator-injected, not alpha signal

Context: Private-alpha Days 4–7 need one operator-warranted legitimate signal (`fuse.tripped` or a shadow `*.signaled` on a real Claude Code session). Live `tripward run -- claude -p …` on Claude Code 2.1.263 produced SessionStart (health=protected) but zero PreToolUse: verbal refusal never reaches `handleHook`. CoS asked for a working live recipe first, and optionally a harness that still demonstrates a trip when the model will not tool-call under `-p`.

Decision:
1. Fix launcher argv: `which claude` is the executable; tokens after `--` are Claude **args**. A leading `claude` / path-to-claude is stripped so documented `tripward run -- claude …` no longer doubles the first argument.
2. Print-mode (`-p`/`--print`) inherits stdin and tees stdout/stderr so trust prompts and model text are visible. Interactive sessions inherit a TTY (`detached: false`) so the trust-folder prompt can be answered.
3. Add `tripward demo-trip` which calls the same `handleHook` evaluator with official-doc fixtures. Receipts are labeled `signal_class=operator-injected-demo`, health is `degraded`, and limitations state this is **not** a stub CI trip and **does not** count as alpha legitimate signal.

Alternatives:
- Ship only the argv/docs fix. Rejected as insufficient when the model still refuses to emit Bash under `-p`.
- Count demo-trip as legitimate signal. Rejected — Ch 25/38 require an operator-warranted live Claude event, not an injected fixture.
- Reuse `--stub` scenarios. Rejected — stub CI trips are already Gate 0; the harness must be labeled differently.

Consequences: Demos and doctor-adjacent walkthroughs can show a real policy trip without Claude. Alpha tallies stay empty until a live PreToolUse fires. Prompts after `--` are not copied onto shareable receipts (only local `run.json` `launched_command`).

Evidence: Ch 08 claims contract; Ch 19 `tripward run [-- claude …]`; Ch 25/38 legitimate-signal definition; live receipt `run_mtpcn8u97b4512d76f30` (trigger null, zero PreToolUse, health protected).

Revisit trigger: Claude Code `-p` reliably emits Bash on a benign probe, or a supported non-model PreToolUse injection from Claude itself.
