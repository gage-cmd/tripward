# Tripward paid beta (Days 8–14)

**Phase:** Ch 25 Days 8–14 paid beta. **OPEN.**  
**Law:** `docs/FUSECAP_OPS_BRAIN.txt`.  
**Canonical URL:** https://tripward.dev  
**Gate 0:** PASS — `docs/SPIKE.md`.  
**Days 4–7 private alpha:** **EXITED.** Counting rules stay in `docs/ALPHA.md`.

This document does **not** claim the paid-beta exit gate.

Authorization still excludes: Cursor adapter, fake `$` on subscription traffic, P2 cloud/team, enterprise SSO, remote-control app, universal LLM proxy.

## Alpha exit (honest)

Measured tallies remain **1 / 5 installs · 1 / 3 real runs · 1 / 1 legitimate signal**.

Gage waived the remaining installs and remaining real runs. This repository does **not** invent per-install or per-run tally rows.

## This slice (PR1)

Private local receipt HTML, generated from sealed `receipt.json`, Apple-bar spec in `docs/ux/PR1-receipt-html-apple-bar.md`.

```bash
tripward receipt --html              # write receipt.html next to the JSON; print path
tripward receipt --html --open       # same, then open on macOS/linux when a helper exists
tripward receipt --redact            # unchanged shareable JSON
tripward restore --preview <run_id>  # existing preview-digest gate (ADR 0005)
```

`fusecap` remains a working bin alias of the same CLI.

The HTML shows timeline, exit outcome, protection health, limitations, integrity digest, and policy digest. Usage is **Actual | Estimate | Unavailable** plus source only — Claude Code subscription traffic is Unavailable. Tripward will not invent USD.

Primary CTA is `tripward restore --preview <run_id>`. The page does not restore. Apply still requires `--confirm --digest <preview_digest> --paths …`.

## Later slices (not this PR)

| PR | Scope | Status |
|----|--------|--------|
| PR1 | Local receipt HTML UI | this pack |
| PR2 | Recovery preview polish | not built |
| PR3 | Founding Pro $15/mo checkout | not built |
| PR4 | Support channel | not built |

Do not treat this file as a Stripe, desktop-app, or support-channel ship.

## Paid-beta exit gate (later)

Ch 25: **three paying strangers and no lost work.**

Not met. Do not invent paying-customer rows here.

## What a stranger does

Install path is unchanged — see `docs/ALPHA.md`. After a run:

```bash
tripward receipt --html
# open the printed receipt.html
tripward restore --preview
```

Do not send `.env`, transcripts, prompts, or repo contents. If you share evidence, use `tripward receipt --redact` JSON, not the private local HTML.
