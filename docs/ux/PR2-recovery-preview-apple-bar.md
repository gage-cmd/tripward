# PR2 — Recovery preview HTML (Apple-bar)

**Product:** Tripward  
**Surface:** private local static HTML generated from `buildRecoveryPreview()`  
**CLI:** `tripward restore --preview --html [run_id]`  
**Canonical URL:** tripward.dev (plain text; no https link)  
**Law:** ADR 0005  
**Out of scope:** in-page apply, hunk diffs, Stripe / Founding Pro, support channel, worktree isolation UI, Cursor adapter, fake `$`, P2 cloud/team

This is the UX spec for Days 8–14 PR2. Engineering implements this file. Coder/UX hold visual merge for UX PASS — do not merge on green tests alone.

Shared-box path was `/workspace/tripward-specs/PR2-recovery-preview-apple-bar.md`. That path is not on every agent VM; this file is the in-repo copy.

## Must

1. `tripward restore --preview --html [run_id]` writes private local `recovery.html` next to the run’s `receipt.html` / `checkpoint.json` (same run-dir convention as PR1). Optional `--open`. JSON `--preview` stdout is unchanged.
2. HTML is rendered from the same `buildRecoveryPreview()` payload as JSON — one source of truth. Do not invent a second preview model.
3. Information architecture, in this order:
   1. **Header** — Tripward wordmark + “Recovery preview” + safety strip
   2. **Summary** — counts + preview digest + copy
   3. **Paths** table
   4. **Apply in terminal** — composed CLI only
   5. **Limitations**
   6. **Footer** — plain text `tripward.dev`
   7. Relative link back to `receipt.html` when that file is present
4. **The page never applies restore.** Checkboxes only rewrite the displayed command string. No Restore / Apply / Rollback mutate buttons. No shell-out to `--confirm`.
5. Selection rules:
   - Checkbox only when `safe && restore_action` is not `keep` / `manual_review`
   - `uncertain` or `!safe` is not selectable
   - If `one_click_disabled`: default none checked + Manual review strip
   - If `!preexisting_work_intact`: fail closed — rose strip, no apply compose, selectable count **0**
6. Composed command shape (when compose is allowed):

   `tripward restore --confirm --digest <preview_digest> --paths a,b <run_id>`

   Empty selection does **not** emit `--paths=` or a copyable `--confirm` command. Show “Select at least one safe path, or leave recovery unused.” and disable Copy.
7. CLI digest gate is **unchanged**. A digest mismatch still aborts apply.
8. Visual tokens (do not substitute; reuse PR1):
   - Canvas `#F5F5F7`
   - White cards, **12px** radius
   - Separators `#D2D2D7`
   - Text `#1D1D1F` / secondary `#6E6E73`
   - Accent `#0071E3` on **links only** (copy is a link-styled control)
   - Font `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`
   - Max-width **720px**
   - Section gap **24px**
   - 8px spacing grid
   - One column
   - Zero CDN / webfonts / remote scripts
9. Brand in the HTML: **Tripward only**. Never FuseCap or fusecap wordmarks.
10. Fixtures (goldens): at least All-safe, Uncertain / `one_click_disabled`, Empty / keep-only.

## CLI honesty

`package.json` `bin` already exposes `tripward` and `fusecap`. User-facing HTML and beta docs brand Tripward. Internal package name may stay `fusecap`.

Receipt HTML may add a **secondary** CTA line for `tripward restore --preview --html <run_id>` without removing the JSON preview CTA.

## Acceptance checklist

- [ ] `tripward restore --preview --html [run_id]` writes `recovery.html` in the run directory with mode `0600`.
- [ ] `--open` uses the same local opener as receipt HTML (`open` / `xdg-open`).
- [ ] `--preview` JSON stdout (pretty JSON + apply-hint line) is unchanged when `--html` is added; HTML path goes to stderr.
- [ ] HTML is produced from `buildRecoveryPreview()` — same `preview_digest`, paths, flags, and limitations as JSON.
- [ ] DOM section order is Header → Summary → Paths → Apply in terminal → Limitations → footer. Apply section is omitted when fail-closed.
- [ ] Header shows **Tripward**, **Recovery preview**, and a safety strip.
- [ ] `one_click_disabled` → Manual review strip; default none checked.
- [ ] `!preexisting_work_intact` → rose fail-closed strip; no apply compose.
- [ ] Checkboxes exist only on `safe && restore_action ∉ {keep, manual_review}`.
- [ ] Uncertain / `!safe` rows are not selectable.
- [ ] Checkboxes only rewrite the displayed command; no mutate buttons; no `--confirm` shell-out.
- [ ] Composed command is `tripward restore --confirm --digest <preview_digest> --paths a,b <run_id>`.
- [ ] CLI digest mismatch still throws and does not apply.
- [ ] Footer is plain `tripward.dev` — no `https://` link.
- [ ] Relative `receipt.html` link is present only when that file exists.
- [ ] Tokens: `#F5F5F7`, `#D2D2D7`, `12px` radius, `#0071E3`, `720px`, `24px` gap, `-apple-system`.
- [ ] Zero network: no `<link href>`, no `@import url`, no `<script src>`, no webfonts.
- [ ] HTML contains no `fusecap` / `FuseCap` wordmarks.
- [ ] Goldens exist for All-safe, Uncertain/`one_click_disabled`, Empty/keep-only.
- [ ] Tests cover HTML generation, selection ⊆ safe, digest mismatch, and the zero-loss matrix (clean / dirty / staged / untracked / external edit / uncertain).
- [ ] Preview never deletes preexisting bytes. Apply only allowed paths.

## Screenshot

First checked-in renders for UX critique (attach these paths on the PR):

- `fixtures/recovery/all-safe.html`
- `fixtures/recovery/uncertain-one-click-disabled.html`
- `fixtures/recovery/empty-keep-only.html`
- `fixtures/recovery/fail-closed.html` (rose strip; extra visual state)
