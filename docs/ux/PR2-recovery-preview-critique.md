# PR2 recovery preview HTML — UX critique (hold merge)

Mirror of the CoS/UX critique that must land on PR #6 before merge. Shared-box path was `/workspace/tripward-specs/PR2-recovery-preview-critique.md`.

HOLD merge. Coder re-screenshots and re-pings UX after this lands.

## Must-fix (block merge)

1. Limitations lead before the list: “What this preview will not do.”
2. Empty selection must NOT offer copyable apply: when no paths selected (empty-keep-only OR JS uncheck-all), disable Copy; show “Select at least one safe path, or leave recovery unused.” — never emit `--confirm … --paths=` empty/bogus.
3. Fail-closed (`!preexisting_work_intact`): selectable count must be **0** (chips must not say 1 selectable while checkbox forced disabled).

## Should-fix (same PR if cheap)

4. Green strip title: **Ready for selective restore**
5. Human actions: Restore starting bytes / Remove agent file
6. Digest caption: “Apply is refused unless `--digest` matches this value. Refresh preview if the worktree changed.”
7. Local wall time for generated in header when timestamp exists.
