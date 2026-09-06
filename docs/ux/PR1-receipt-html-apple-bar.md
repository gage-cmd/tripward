# PR1 — Local receipt HTML (Apple-bar)

**Product:** Tripward  
**Surface:** private local static HTML generated from sealed `receipt.json`  
**Canonical URL:** https://tripward.dev  
**Out of scope:** apply UI, Stripe checkout, share/export, history, marketing page, remote-control app

This is the UX spec for Days 8–14 PR1. Engineering implements this file. Coder screenshots the first render for UX critique before merge.

## Must

1. Private local **static HTML** — inline CSS only; **no CDN / webfonts / remote scripts**; zero network on open.
2. Information architecture, in this order:
   1. **Header** — Tripward wordmark + outcome pill
   2. **Protection health**
   3. **Trigger / summary** + primary CTA `tripward restore --preview <run_id>` with a copy affordance (the page does **not** restore)
   4. **Timeline**
   5. **Limitations**
   6. **Digest**
3. Usage row: **Actual | Estimate | Unavailable** + source only. Never invent USD. Claude Code subscription traffic → **Unavailable**.
4. Brand in the HTML: **Tripward only**. Never FuseCap or fusecap wordmarks.
5. Visual tokens (do not substitute):
   - Canvas `#F5F5F7`
   - White cards, **12px** radius
   - Text `#1D1D1F` / secondary `#6E6E73`
   - Accent `#0071E3` on **links only**
   - Font `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`
   - Max-width **720px**
   - **8px** spacing grid
   - One column
6. Recovery CTA is preview-only. Apply remains `tripward restore --confirm --digest <preview_digest> --paths …` in the CLI (ADR 0005). Do not weaken the preview-digest gate. Do not put Apply on this page.

## CLI honesty

`package.json` `bin` must expose `tripward` as the CLI entry so the HTML command is invocable. User-facing HTML and beta docs brand Tripward only.

## Acceptance checklist

- [ ] File opens with no network requests (no `<link href>`, no `@import url`, no `<script src>`, no webfonts).
- [ ] DOM section order is Header → Protection health → Trigger/summary+CTA → Timeline → Limitations → Digest.
- [ ] Header shows **Tripward** and an outcome pill (Completed / Warned / Blocked / Terminated / Crashed / Canceled).
- [ ] Protection health shows the sealed `protection_health` value and any health reasons.
- [ ] Usage shows exactly one of Actual / Estimate / Unavailable plus source. No invented `$` amount. Subscription receipts are Unavailable.
- [ ] Primary CTA text is `tripward restore --preview <run_id>` and is copyable.
- [ ] Visible copy states the page does not restore / does not apply.
- [ ] Timeline lists sealed events (sequence, time, type, summary).
- [ ] Limitations list is present and includes the no-invented-USD limitation.
- [ ] Digest shows integrity content digest and policy digest.
- [ ] HTML contains no `fusecap` / `FuseCap` wordmarks.
- [ ] Tokens: `#F5F5F7`, white cards, `12px` radius, `#1D1D1F`, `#6E6E73`, `#0071E3` used only for links, `-apple-system`, `max-width: 720px`, 8px grid, one column.
- [ ] Footer may cite https://tripward.dev as text. No other public domain.
- [ ] `tripward restore --preview <run_id>` is a working CLI invocation (boolean `--preview` must not swallow the run id).
- [ ] Share / apply / Stripe / history / marketing are not on this page.

## Screenshot

First checked-in render for UX critique: generate via `tripward receipt --html` (or the fixture test) and attach the HTML path on the PR.
