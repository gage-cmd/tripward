# ADR 0005 — Recovery apply is preview-digest bound; no automatic restore

Context: Chapter 12 forbids broad reset, silent stash/commit, and deleting untracked files without an itemized preview. FR-010 requires preview + confirmation.

Decision: Checkpoint writes Git objects via `git hash-object -w` and a manifest; the worktree and index are not modified. `tripward restore` defaults to preview. Apply requires `--confirm --digest <preview_digest> --paths …`. Dirty-at-start files that change again are `uncertain` and disable one-click restore.

Alternatives: Isolated worktree for every run (Ch 12 preference for unattended high-risk). Deferred — compatibility across dirty repos is still an open question (Ch 33).

Consequences: Spike recovery is explicit and conservative. Users must pick paths. Preexisting bytes remain in the object store even if the worktree is overwritten.

Evidence: Ch 12 definition of safe restore; invariant “recovery must not lose dirty work.”

Revisit trigger: Isolated worktree strategy validated on macOS dirty repos.
