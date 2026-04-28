# MG-04 Warranty Compliance Checklist — Post-Implementation Review

**Review date:** 2026-04-26 (visual review pass added)
**Sources reviewed:**
- `planning_notes/sis_scenarios/case_3_cyber_insurance_game_design/minigame_planning.md`
- `public/break_escape/js/minigames/warranty-checklist/warranty-checklist-minigame.js`
- `public/break_escape/css/warranty-checklist-minigame.css`
- `public/break_escape/css/coverage-decision-form-minigame.css`
- `public/break_escape/css/forensic-data-platform-minigame.css`
- `scenarios/sis03_cyber_insurance/scenario.json.erb`

---

## 1. Summary

Core mechanics are implemented and verified. All globals are written correctly, the prerequisite gate works, and the read-only reopen behaviour is correct. One deferred structural mismatch (archive unlock order) remains.

This review pass focuses on visual consistency. The WCC currently uses a completely different visual language — white paper, `Press Start 2P` headings, and `VT323` body text — compared to every other SIS03 minigame (FDP, CDF) which use `Courier New` throughout and a consistent dark terminal palette. The paper-within-dark-frame structure is correct and planned; the font and colour choices are not consistent with the family.

---

## 2. Functional Status (no changes needed)

All items from the prior functional review pass remain correct. No functional changes are proposed here.

| # | Requirement | Status |
|---|---|---|
| M-01 | Four warranty rows (W-03, W-07, W-09, W-12) | ✅ |
| M-02 | Three mutually exclusive options per row | ✅ |
| M-03 | Evidence Found textarea per row | ✅ |
| M-04 | Submit gate enforces `warranty_evidence_reviewed` | ✅ |
| M-05 | On submit: sets `warranty_checklist_complete`, `ins001_assessed`, `ins003_assessed` | ✅ |
| M-06 | Does NOT write `ins008_assessed` or `ins009_assessed` | ✅ |
| M-07 | Read-only reopen; no repeated global writes | ✅ |
| M-08 | Eleanor Ink fallback warranty complete branch | ✅ |
| M-09 | Registered in index.js, starters.js, interactions.js | ✅ |
| M-10 | `warranty_checklist` object in `meridian_claims_suite` | ✅ |
| M-11 | Eleanor `eventMapping` on `warranty_checklist_complete` | ✅ |
| M-12 | W-07 claimRefs includes CLAIM-INS-001 and CLAIM-INS-002 | ✅ |
| M-13 | Form accessible from scenario start; submit gated | ✅ |
| M-14 | Gate note references CMS quarterly reports | ✅ |
| M-15 | Paper document inset within dark game frame | ✅ |
| M-16 | W-09 claimRefs: CLAIM-INS-005; W-12 claimRefs: CLAIM-INS-007 | ✅ |

---

## 3. Deferred Structural Mismatch

### MM-02 — Archive unlock order (deferred, unchanged)

The archive currently unlocks on `policy_reviewed + forensic_chain_verified` rather than `warranty_checklist_complete`. Fix is a `scenario.json.erb`-only change, no JS required. Deferred to a separate wiring pass.

---

## 4. Visual Review

### 4.1 What the planning specifies

`minigame_planning.md §4` describes: *"A physical paper worksheet… four warranty rows… tick-boxes… Evidence found column… Related claim reference."* The paper-within-dark-frame aesthetic is explicitly planned and is the correct metaphor for this form. The structure of the current implementation is right.

### 4.2 What FDP and CDF use

Both SIS03 minigames (FDP and CDF) share:

| Property | Value |
|---|---|
| Font | `Courier New, Courier, monospace` throughout |
| Background | `#0d1117` (dark near-black) |
| Header background | `#1a233a` (CDF) / `#0d1117` (FDP) |
| Header border | `2px solid #334466` (CDF) / `1px solid #21262d` (FDP) |
| Section/border accent | `#334466` (CDF) / `#30363d` (FDP) |
| Footer background | `#0f1826` (CDF) / `#0d1117` (FDP) |
| Footer border-top | `2px solid #334466` (CDF) |
| Body text | `#c9d1d9` |
| Title text | `#ffffff` (CDF) / `#58a6ff` (FDP) |
| Sub/meta text | `#8899cc` (CDF) / `#6e7681` (FDP) |

### 4.3 Current WCC divergences

| Element | Current | Problem |
|---|---|---|
| Letterhead/heading font | `Press Start 2P` | Not used in any other SIS03 minigame |
| Body text font | `VT323` | Not used in any other SIS03 minigame |
| Footer button font | `VT323`, 24px | Not used in any other SIS03 minigame |
| Letterhead background | `#2c3e50` | Slightly off from CDF `#1a233a` palette |
| Footer background | `#1a1f30` | Close but not matching CDF `#0f1826` |
| Footer border | `2px solid #0d1120` | Should be `#334466` to match CDF |
| Button sizing/style | VT323 large, VT323 font | Should match CDF close button convention |

### 4.4 What to keep

- The **paper-within-dark-frame structure** — explicitly in the plan, right for the form metaphor
- The **white/off-white paper body** (`#fefcf8`) — it is a paper worksheet; this contrast is intentional and designed
- The **letterhead dark bar** concept — correct, keep the two-tone paper/header layout
- The **verdict button tick-box mechanic** — correct and unique to this form; keep styling logic, update font only
- The **verdict colour semantics** — red/amber/green for breached/arguable/compliant — keep these, they are meaningful
- The **claim ref badges**, **verdict badges**, **hint notes** — keep structure, update font
- The **gate note** styling — keep the red-tinted warning block concept

---

## 5. Proposed Fixes (CSS only — no JS or scenario changes)

All changes are to `warranty-checklist-minigame.css` only. All functionality is unchanged.

### Fix 1 — Replace `Press Start 2P` with `Courier New` throughout

Every `font-family: 'Press Start 2P', monospace` declaration becomes `font-family: 'Courier New', Courier, monospace`. Adjust `font-size` upward to compensate (Press Start 2P reads large at tiny px values; Courier New needs roughly 2–3× the px for equivalent visual weight):

| Element | Current | Proposed |
|---|---|---|
| `.wcc-letterhead-title` | Press Start 2P, 8px | Courier New, 13px, bold |
| `.wcc-doc-title` | Press Start 2P, 10px | Courier New, 14px, bold, uppercase |
| `.wcc-code` | Press Start 2P, 7px | Courier New, 11px, bold |
| `.wcc-row-title` | Press Start 2P, 8px | Courier New, 13px, bold |
| `.wcc-evidence-label` | Press Start 2P, 8px | Courier New, 11px, bold |

### Fix 2 — Replace `VT323` with `Courier New` throughout

Every `font-family: 'VT323', monospace` declaration becomes `font-family: 'Courier New', Courier, monospace`. Adjust sizes down (VT323 at 20px is roughly Courier New at 13px):

| Element | Current | Proposed |
|---|---|---|
| `.wcc-letterhead-ref` | VT323, 18px | Courier New, 13px |
| `.wcc-doc-meta` | VT323, 20px | Courier New, 13px |
| `.wcc-doc-status` | VT323, 17px | Courier New, 12px |
| `.wcc-gate-note` | VT323, 20px | Courier New, 13px |
| `.wcc-row-context` | VT323, 20px | Courier New, 13px |
| `.wcc-claim-refs` | VT323, 17px | Courier New, 12px |
| `.wcc-verdict-badge` | VT323, 17px | Courier New, 12px |
| `.wcc-verdict-btn` | VT323, 20px | Courier New, 13px |
| `.wcc-evidence-input` | VT323, 20px | Courier New, 13px |
| `.wcc-hint` | VT323, 18px | Courier New, 12px |
| `.wcc-btn` | VT323, 24px | Courier New, 14px |
| `.wcc-empty-state` | VT323, 22px | Courier New, 14px |

### Fix 3 — Align letterhead to CDF header palette

- Background: `#2c3e50` → `#1a233a`
- Title colour: `#d8e8f4` → `#ffffff`
- Ref colour: `#90aec8` → `#8899cc`

### Fix 4 — Align footer to CDF footer palette

- Background: `#1a1f30` → `#0f1826`
- Border-top: `2px solid #0d1120` → `2px solid #334466`
- Primary button border: `#3a6a52` → keep green semantics (submit action), adjust to `#44aa44` to match CDF submit button
- Secondary button (close): align to CDF close button — `#1a233a` background, `#334466` border, `#8899cc` text

### Fix 5 — Letter-spacing and text-transform on letterhead title

Add `letter-spacing: 0.06em; text-transform: uppercase;` to `.wcc-letterhead-title` to match CDF header title treatment.

---

## 6. What is NOT changing

- All JS logic — zero changes
- scenario.json.erb — zero changes
- The paper/desk structure (`wcc-panel`, `wcc-desk`, `wcc-paper`) — structure unchanged
- Paper background colour `#fefcf8` — this is the paper and should remain light
- Verdict colour semantics (red/amber/green) on rows and buttons
- Gate note concept and position
- All functional behaviour
