# Tripward (CLI: fusecap) — revised product one-pager
Date: 2026-09-05 · Status: Revised per Gage/ChatGPT critique · Not locked until Gage says so  
Awaiting: PRD only if Gage locks; Claude Code spike = gate 0 before marketing.  
**Do not invent LaunchScore.**

---

## One sentence
Local runtime safety layer for coding agents: multi-fuse tripwires (time, tools, subagents, repetition, no-progress, file churn, destructive commands, network allowlist) + forensic receipt + Git checkpoint/rollback — with a **true dollar fuse only when spend is observable** (API/BYOK/SDK), never fake $ for Cursor/Claude Code subscription traffic.

---

## Locked constraints (law for any PRD)

1. **No fake hard $.** Do **not** claim hard dollar caps before every model call for Cursor or Claude Code **subscription** traffic. True `$` fuse only when the request is observable (API / BYOK / SDK proxies). Subscription traffic → non-$ fuses + receipts estimating tokens **if** exposed; never invent USD.
2. **Product = local runtime safety layer:** multi-fuse + forensic receipt + Git checkpoint/rollback. Dollar fuse when data exists.
3. **Wedge day 1:** **Claude Code plugin + launcher only.** Cursor after an enforcement spike proves trips work.
4. **Loop detection:** exact match + semantic + sequence + no-progress + file churn + failure repetition — not only same tool+args.
5. **Pricing:** Free / Pro **$19** / Power **$39** / Team **$99** / Company **$299**.
6. **Kill criteria:**
   - **72h spike:** must stop ≥5 trip types (document which).
   - **d4–7:** ≥5 installs, ≥3 real runs, ≥1 real trip.
   - **d8–14:** ≥3 paying strangers.
7. **Competitor:** AgentBudget (and HN cousins) exist for SDK wrappers — win on **coding-agent UX**, receipts, multi-fuse, Claude Code install path.
8. **Trademark/name:** Public product name is **Tripward**. CLI, package, and repo alias stay `fusecap` so install paths keep working. FuseCap was a working name only (also used by image-captioning research).

---

## Problem / ICP
- **Problem:** Coding agents loop, thrash files, spawn subagents, and burn money or hours while the founder sleeps — dashboards tell you after.
- **Who pays:** Solo and small teams running Claude Code (day 1) then Cursor; later teams wanting shared policies.
- **Why now:** HN Show HNs — AgentBudget ($187/10 min), AgentFuse (asleep drain), AgentCircuit ($200+), Agent Firewall ($47 sleep), Lava AI Spend ($200 overnight). https://news.ycombinator.com/item?id=47133305 · 46404312 · 46899775 · 47308378 · 46991656

---

## What you ship (v1 shape)

| Layer | Behavior |
|-------|----------|
| **Launcher** | Wraps Claude Code session with policy file |
| **Fuses** | time · tool allow/deny · max subagents · exact+semantic+sequence loop · no-progress · file churn · destructive cmd block · network allowlist |
| **$ fuse** | Only on BYOK/API path when spend observable |
| **Receipt** | Forensic log of trips (what fired, why, timestamp) |
| **Git** | Checkpoint before risky batches; one-click rollback |

**Not v1:** Fake USD meter on subscription Cursor/Claude; cloud proxy as required path; Cursor-first; becoming an LLM gateway SaaS.

---

## Gate 0 (before marketing)
**72h Claude Code spike** that demonstrably stops ≥5 trip types on real sessions. Fail → no landing, no TT, no paid. Pass → then organic demos + waitlist.

---

## Organic
- Hook: “Agent looped overnight — Tripwire killed it and rolled back the thrash.”
- Demo: screen record loop → trip → receipt → git rollback.
- Do **not** lead with “we cap your Cursor bill at $20” unless BYOK path is on screen.

---

## Money math (honest)
- Pro $19 × 2,632 ≈ $50k MRR · Power $39 × 1,283 · Team $99 × 506.
- Path: Claude Code install base + HN/X demos → Free→Pro. 12–24 mo to $50k only if trips are real and word-of-mouth holds. Not guaranteed.

---

## vs AgentBudget
AgentBudget-class tools: SDK/$ wrappers.  
**Win:** Claude Code-native install, multi-fuse (not $ only), receipts, git rollback, honest about subscription opacity.

---

## Relationship to Top 5 list
Replaces prior FuseCap blurb in the 20-ideas doc. Still **GO** under revised constraints if Gate 0 passes. TourNote/StarClerk remain alternatives if spike fails.

---

## PRD trigger
Write full PRD **only when Gage locks** this product — with Claude Code spike as **gate 0** before marketing. Until then this one-pager is the brief.
