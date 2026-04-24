# MG-04 Warranty Compliance Checklist — Post-Implementation Review

**Review date:** 2026-04-21 (updated; original 2026-04-19)
**Implementation branch:** warranty-compliance-checklist
**Sources reviewed:**
- `planning_notes/sis_scenarios/case_3_cyber_insurance_game_design/development_tasks.csv`
- `planning_notes/sis_scenarios/case_3_cyber_insurance_game_design/minigame_planning.md`
- `planning_notes/warranty-compliance-checklist/mg04_warranty_compliance_checklist_implementation_plan.md`
- `public/break_escape/js/minigames/warranty-checklist/warranty-checklist-minigame.js`
- `public/break_escape/css/warranty-checklist-minigame.css`
- `scenarios/sis03_cyber_insurance/scenario.json.erb`
- `scenarios/sis03_cyber_insurance/ink/npc_eleanor_vance.ink`

---

## 1. Summary

The core mechanics of MG-04 are implemented and functionally verified. The submission flow, prerequisite gate, global writes, and read-only reopen behaviour all work correctly. Two open mismatches remain: one is a content gap (claimRefs missing on two rows) and one is a deferred design decision on archive unlock order. Two fixes were applied in this review pass: the gate note now references CMS quarterly reports per the plan, and the visual design has been updated to the paper document aesthetic specified in the implementation plan.

---

## 2. Matches

| # | Requirement source | Requirement | Implementation |
|---|---|---|---|
| M-01 | Plan §5, minigame_planning.md §4 | Four warranty rows (W-03, W-07, W-09, W-12) | ✅ All four present in scenario object and rendered |
| M-02 | Plan §5, minigame_planning.md §4 | Three mutually exclusive options per row (Compliant / Breached / Arguable) | ✅ Radio-style buttons with correct selected state |
| M-03 | TEST-MG-04 | Evidence Found field accepts player input per row | ✅ Textarea per row, writable, persisted in session |
| M-04 | Plan §5.2 | Submit gate enforces `warranty_evidence_reviewed = true` | ✅ Gate check on every submit press, not just open |
| M-05 | Plan §5.3, §2.1 | On submit: sets `warranty_checklist_complete`, `ins001_assessed`, `ins003_assessed` | ✅ All three written via `setGlobalAndNotify` |
| M-06 | Plan §2.1 | Does NOT write `ins008_assessed` or `ins009_assessed` | ✅ Correctly absent |
| M-07 | Plan §6.5 | Read-only reopen after submission; no repeated global writes | ✅ `submitted` flag blocks re-submit; re-renders as locked |
| M-08 | Plan §8 | Eleanor Ink line 301 fallback: `~ warranty_checklist_complete = true` | ✅ Added to `warranty_hub` all-four-discussed branch |
| M-09 | Plan §6.2 | Registered in `index.js`, started via `minigame-starters.js`, dispatched from `interactions.js` | ✅ All three wiring points in place |
| M-10 | Plan §6.1, §6.3 | `warranty_checklist` object in `meridian_claims_suite` | ✅ Present with `interactionType: "warranty_checklist"` |
| M-11 | Plan §9 | Eleanor `eventMapping` on `warranty_checklist_complete` unchanged | ✅ No changes made; existing mapping fires correctly |
| M-12 | minigame_planning.md §4 | W-07 claimRefs includes both CLAIM-INS-001 and CLAIM-INS-002 | ✅ Array with both refs |
| M-13 | Plan §3 | Form accessible from scenario start; submit disabled until evidence reviewed | ✅ Object present in room 1 from start |
| M-14 | Plan §9 (CMS soft prerequisite) | Gate note references CMS quarterly reports and evidence packets | ✅ Fixed in this review pass |
| M-15 | Plan §7 | Visual design: paper document inset within dark game frame; dark ink on white paper | ✅ CSS rewritten in this review pass |
| M-16 | Plan §6.3 | W-09 claimRefs: CLAIM-INS-005; W-12 claimRefs: CLAIM-INS-007 | ✅ Fixed in this review pass |

---

## 3. Mismatches

### ~~MM-01 — W-09 and W-12 claimRefs empty~~ — FIXED

`claimRefs` are display-only reference badges shown on each warranty row (e.g. `CLAIM-INS-005`) giving players visual traceability between a warranty row and its associated insurance claims. They are purely informational — no logic depends on them.

Per the implementation plan §6.3, W-09 should reference `CLAIM-INS-005` (Access Control / c.ellison deprovisioning row) and W-12 should reference `CLAIM-INS-007` (Third-Party Risk / CastleTech SOC exclusion row). Both have been added to `scenario.json.erb` in this review pass.

---

### MM-02 — Archive unlock order is deferred pending separate wiring pass
**Severity: Deferred (noted)**

The implementation plan flagged a conflict (as "Phase 0 decision gate") between the planning documents and `scenario.json.erb` on when the Evidence Archive unlocks:

| Source | Archive unlocks when... |
|---|---|
| Planning docs (development_tasks.csv, minigame_planning.md) | After `warranty_checklist_complete = true` |
| `scenario.json.erb` (current) | After `policy_reviewed = true` AND `forensic_chain_verified = true` |

**Current state:** The globals `warranty_checklist_complete`, `ins001_assessed`, and `ins003_assessed` are written correctly on form submission and Eleanor's `eventMapping` fires as expected. The archive unlock wiring is a separate `scenario.json.erb`-only change to be applied in a later pass.

**Downstream note:** `minigame_planning.md` §3 specifies the NCSC attribution brief "cannot be opened until the player has completed the warranty compliance checklist." In the current implementation the brief is inside the archive, which opens before the checklist. This is the main narrative consequence to address when the wiring pass is done.

**Potential fix (when ready):** Change Eleanor's `eventMapping` in `scenario.json.erb` to fire the archive unlock on `warranty_checklist_complete = true` instead of `policy_reviewed + forensic_chain_verified`. Scenario JSON only — no JS changes required.

---

## 4. Positive Deviations (Implementation Exceeds Plan)

### PD-01 — Row selections and evidence notes persist across close-before-submit
Plan §6.4 states: *"If players close and reopen the form before submitting, selections and notes reset. This is acceptable in v1."*

Implementation stores verdicts and evidence notes to `window.gameState.warrantyChecklist` on every change and reloads them on open. Closing and reopening before submission preserves all player input.

**Assessment:** Significant UX improvement over plan. No action needed.

---

### PD-02 — Scroll position preserved on verdict button click
Not mentioned in the plan. The implementation captures `.wcc-body` scroll position before `innerHTML` replacement and restores it after, preventing the page jumping to the top when a verdict is selected.

**Assessment:** Correct behaviour for a form with multiple rows. No action needed.

---

### PD-03 — Per-row hint text guides player reasoning
Not mentioned in the plan. Each warranty row in `scenario.json.erb` carries a `hint` field (e.g. *"The deferral was legitimate under IEC 61511. The failure to implement compensating controls was not."*) rendered as a left-bordered guidance note beneath each row during active play, hidden after submission.

**Assessment:** Good teaching aid, especially for W-03 where the "Arguable" verdict requires nuanced reasoning. No action needed.

---

## 5. Prioritised Fix List

| Priority | Finding | Fix effort |
|---|---|---|
| Fixed | MM-01 claimRefs — CLAIM-INS-005 on W-09, CLAIM-INS-007 on W-12 added to scenario object | Done |
| Deferred | MM-02 Archive unlock order — change unlock trigger to `warranty_checklist_complete` when wiring pass is ready | Low (scenario.json.erb only) |
| Fixed | Gate note — now references CMS quarterly reports per plan §9 | Done |
| Fixed | Visual design — CSS rewritten to paper document aesthetic per plan §7 | Done |
