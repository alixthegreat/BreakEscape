# SIS03 Warranty Compliance Checklist (MG-04) Implementation Plan

## 1. Purpose

Implement the Scenario 3 Warranty Compliance Checklist as a standalone interactive form object in the Meridian Claims Suite. The checklist is the scenario's pivot point: it is where players formalise their warranty breach assessments before the coverage decision phase unlocks.

This plan is grounded in:
- `planning_notes/sis_scenarios/case_3_cyber_insurance_game_design/minigame_planning.md` (MG-04)
- `planning_notes/sis_scenarios/case_3_cyber_insurance_game_design/gdd.md` (Section 2, Section 5 Aim 3)
- `planning_notes/sis_scenarios/case_3_cyber_insurance_game_design/new_objects_planning.md` (2.2)
- `planning_notes/sis_scenarios/case_3_cyber_insurance_information_pack/requirements/policyholder_security_obligations.md`
- `scenarios/sis03_cyber_insurance/scenario.json.erb`
- `scenarios/sis03_cyber_insurance/ink/npc_eleanor_vance.ink`

---

## 2. Current State

1. `warranty_checklist_complete` exists as a global boolean in `scenario.json.erb` (line 75), initialised to `false`.
2. Eleanor Vance's `eventMapping` already consumes `warranty_checklist_complete`:
   - When `true`: sends a timed message directing players to the Osei report and NCSC brief, and unlocks the `make_recommendation` aim.
3. Eleanor's Ink (`npc_eleanor_vance.ink`) declares `warranty_checklist_complete` as a VAR (line 14) and reads it in the hub condition (line 716), but **never sets it to `true`**. This is the live blocking bug.
4. The `assess_warranties` aim has a single task: `talk_to_eleanor_warranties` (type `npc_conversation`). This represents the post-submission discussion, not the form submission itself.
5. No `warranty_checklist` object currently exists in either room in `scenario.json.erb`.
6. Four `ins_assessed` globals exist (`ins001_assessed`, `ins003_assessed`, `ins008_assessed`, `ins009_assessed`) but are not consumed by any current eventMapping or aim.

### 2.1 Canonical Variable Contract

Use only the names already declared in `scenario.json.erb`. Do not introduce new globals.

| Variable | Type | Source of write | Purpose |
|---|---|---|---|
| `warranty_evidence_reviewed` | boolean | Evidence Packet C `onRead` | Gate: submission is blocked until this is `true` |
| `warranty_checklist_complete` | boolean | MG-04 on submit | Unlocks `make_recommendation` aim via Eleanor eventMapping |
| `ins001_assessed` | boolean | MG-04 on submit | W-07 row submitted (CLAIM-INS-001) |
| `ins003_assessed` | boolean | MG-04 on submit | W-03 row submitted (CLAIM-INS-003) |
| `ins008_assessed` | boolean | **MG-03, not MG-04** | Set when NCSC Attribution Brief is opened (CLAIM-INS-008 — act-of-war) |
| `ins009_assessed` | boolean | **MG-06, not MG-04** | Set when underwriting file is reviewed (CLAIM-INS-009 — insurer knowledge) |

**Important:** `ins008_assessed` and `ins009_assessed` do NOT belong to warranty rows. Per `development_tasks.csv` TEST-INT-01, INS-008 maps to the NCSC attribution brief and INS-009 maps to the Evidence Archive investigation. MG-04 writes only `ins001_assessed` and `ins003_assessed`. W-09 and W-12 have no corresponding `ins_assessed` globals — they are assessed via Eleanor's dialogue and the coverage decision, not tracked as separate global flags.

Do not write per-row string values (e.g. `w03_assessment = "arguable"`) in this phase. The planning does not require them and no downstream consumer exists.

### 2.2 Archive Unlock Discrepancy — Decision Required Before Implementation

There is a direct conflict between the planning documents and `scenario.json.erb` on when the Evidence Archive unlocks:

**Planning documents** (`development_tasks.csv` MG-04, MG-06, OBJ-02; `minigame_planning.md`; `new_objects_planning.md`):
> Checklist completion (`warranty_checklist_complete = true`) unlocks RFID access to the Evidence Archive.

**`scenario.json.erb` (current implementation):**
> Evidence Archive unlocks when `policy_reviewed = true` AND `forensic_chain_verified = true` (i.e. after policy binder + FDP terminal, before the checklist exists).

These produce different scenario flows:

| Flow | Archive unlocks | Checklist unlocks |
|---|---|---|
| Planning docs | After checklist submission | `make_recommendation` aim |
| scenario.json.erb | After policy + FDP | `make_recommendation` aim |

The planning doc flow has stronger narrative logic: players assess warranties using CMS + FDP + policy binder, submit the checklist, and then the archive opens to reveal the underwriting file — the "uncomfortable document" that adds the CLAIM-INS-009 wrinkle to the coverage decision. Reversing the order (archive first, checklist second) means players access the underwriting file before they have formalised their warranty positions.

**This must be resolved before MG-04 is implemented.** If the planning doc flow is adopted, `scenario.json.erb` requires changes to the archive-unlock eventMappings on Eleanor Vance. This plan is written against the current `scenario.json.erb` flow (archive unlocks from policy + FDP). If the decision is made to adopt the planning doc flow, Section 9 must be updated accordingly.

---

## 3. Design Decision: Standalone Form Object

All three planning documents describe the checklist as a **physical paper worksheet on the conference table**, filled in by players and then **submitted to Eleanor Vance** who confirms the positions. This maps to two distinct digital steps:

1. **The form object** — a standalone interactive minigame players open from the claims suite. They select Compliant / Breached / Arguable for each of the four warranties and press Submit. This sets `warranty_checklist_complete = true`.
2. **The Eleanor conversation** — after submission, Eleanor's timed message fires and the `assess_warranties` aim prompts players to talk to her. Her `warranty_checklist_submitted` knot in the Ink handles the per-warranty discussion.

The form is accessible as an object on the table from scenario start (consistent with the physical design), but the **Submit button is disabled until `warranty_evidence_reviewed = true`**. Before that point, opening the form shows the blank worksheet with a status note: "Review all forensic evidence packets before submitting your assessment."

This approach avoids routing the submission through Eleanor's Ink, keeps the Ink as post-submission discussion only, and mirrors how the CMS terminal (MG-01) separates data review from NPC dialogue.

---

## 4. Scope

**In scope:**
1. New `warranty_checklist` minigame scene JS file.
2. New interaction hook in `interactions.js`.
3. New `warranty_checklist` object in `meridian_claims_suite` in `scenario.json.erb`.
4. Write `warranty_checklist_complete = true`, `ins001_assessed = true`, `ins003_assessed = true` on submit.
5. Prerequisite gate: Submit disabled until `warranty_evidence_reviewed = true`.
6. Writable Evidence Found text input per row (required by TEST-MG-04).
7. Reopen behaviour: submitted state persists; form shows as read-only with selections locked.

**Out of scope:**
1. Per-row string variable storage (e.g. `w03_assessment`).
2. Changes to Eleanor's Ink beyond the one missing variable write (see Section 8).
3. Changes to `assess_warranties` aim task definition.
4. Any Coverage Decision Form (MG-05) work.

---

## 5. Functional Requirements

The form must display four warranty rows. Each row contains:
- Warranty reference and title
- One-line description of the warranty obligation
- Three mutually exclusive options: **Compliant** / **Breached** / **Arguable**
- A writable **Evidence Found** text input field (one per row, blank by default)

The Evidence Found field is specified as writable in `minigame_planning.md`, `new_objects_planning.md`, and explicitly tested in `TEST-MG-04`: "Verify: evidence notes field accepts player input." This is a required v1 feature, not a deferral candidate. Player-entered notes are stored in minigame-local state only — they are not persisted to global variables and are informational only.

### 5.1 Warranty Row Definitions

| Ref | Title | Obligation summary | Expected selection | Teaching note |
|---|---|---|---|---|
| W-03 | Patch Management | Critical SIS firmware patch applied within deadline, or deferred with documented compensating controls | **Arguable** | Deferral was IEC 61511-legitimate; compensating controls were documented but never implemented. The attack did not exploit this vulnerability — causality is weak. Players must reason about whether an uncommitted mitigation constitutes breach. |
| W-07 | IT/OT Segmentation | Full IT-to-OT network segmentation by 12-month remediation deadline (expired 4 months before incident) | **Breached** | Dual-homed historian and bidirectional jump server remained. Deadline expired. Extension request was post-deadline and unapproved. Direct causal pathway to the attack. |
| W-09 | Access Control | User accounts deprovisioned within 5 business days of departure; MFA on all administrative access | **Breached** | Contractor account c.ellison active 14 months post-departure. Used directly in the RDP lateral movement chain. |
| W-12 | MSP Security | Managed service providers maintain equivalent security standards; SOC coverage includes OT systems | **Breached** | CastleTech SOC contract explicitly excluded OT systems. No OT detection layer during the attack. |

The form does not enforce which option players choose — it accepts any combination. The teaching moment is in the reasoning, not the correctness gate. Eleanor's post-submission discussion (her Ink) handles the dialogue consequences.

### 5.2 Submission Gate

- Submit button is **disabled** when `warranty_evidence_reviewed = false`.
- Status line beneath the form reads: `"Review Exhibit A, B, and C in the Evidence Archive before submitting."`
- Once `warranty_evidence_reviewed = true`, status line updates to: `"All evidence reviewed. You may submit your warranty assessment."` and the button enables.
- Submit is also **disabled** if any row has no selection. The status line reads: `"Complete all four warranty rows before submitting."`

### 5.3 On Submit

Writes (in order):
1. `warranty_checklist_complete = true`
2. `ins001_assessed = true` (W-07 row — CLAIM-INS-001)
3. `ins003_assessed = true` (W-03 row — CLAIM-INS-003)

`ins008_assessed` and `ins009_assessed` are **not written by MG-04**. They belong to MG-03 (NCSC brief) and MG-06 (underwriting file) respectively. See Section 2.1.

Each write emits a `global_variable_changed:<name>` event via the standard event bus, which Eleanor's eventMapping will catch for `warranty_checklist_complete`.

After submit, the form transitions to a **read-only submitted state**: selections are locked, Submit button replaced with a "Submitted — speak to Eleanor Vance" label, and the form can be reopened for reference.

---

## 6. Technical Implementation Plan

### 6.1 Files to Add

1. `public/break_escape/js/minigames/warranty-checklist/warranty-checklist-minigame.js`

### 6.2 Files to Update

1. **`public/break_escape/js/minigames/index.js`**
   - Register scene key `warranty-checklist`.

2. **`public/break_escape/js/systems/minigame-starters.js`**
   - Add `startWarrantyChecklistMinigame(lockable, options = {})`.
   - Launch via `window.MinigameFramework.startMinigame('warranty-checklist', null, params)`.

3. **`public/break_escape/js/systems/interactions.js`**
   - Add handler for `interactionType: "warranty_checklist"` following the same pattern as `claims_management_system` and `forensic_data_platform`.

4. **`scenarios/sis03_cyber_insurance/scenario.json.erb`**
   - Add `warranty_checklist` object to `meridian_claims_suite.objects` (see Section 6.3).

5. **`scenarios/sis03_cyber_insurance/ink/npc_eleanor_vance.ink`**
   - Add `~ warranty_checklist_complete = true` write in `warranty_hub` after all four warranties are discussed (line 301 — the `{w07_discussed and w03_discussed and w09_discussed and w12_discussed}` branch). This is the fallback path: if players submit the form and then discuss all four warranties with Eleanor in sequence, this ensures the variable is set even if the form write somehow did not fire. It also means players who complete the full Eleanor discussion without the form can still progress. See Section 8 for detail.

### 6.3 Scenario Object Schema

Add to `meridian_claims_suite.objects` in `scenario.json.erb`:

```json
{
  "id": "warranty_checklist",
  "type": "notes",
  "name": "Warranty Compliance Checklist",
  "takeable": false,
  "interactable": true,
  "interactionType": "warranty_checklist",
  "observations": "A single-sided A4 worksheet on Meridian letterhead. Four warranty rows: W-03, W-07, W-09, W-12. Each row has three tick-boxes: Compliant / Breached / Arguable. The Evidence Found column is blank. A Submit button at the bottom is greyed out.",
  "minigame": {
    "title": "Warranty Compliance Checklist",
    "warranties": [
      {
        "ref": "W-03",
        "title": "Patch Management",
        "description": "Critical SIS firmware patches applied within 90 days, or deferred with documented compensating controls implemented within 30 days. Safety-recertification deferral permitted under IEC 61511 if compensating controls are documented and active.",
        "claimRefs": ["CLAIM-INS-003"]
      },
      {
        "ref": "W-07",
        "title": "IT/OT Network Segmentation",
        "description": "Segmentation maintained to prevent direct protocol-level IT-to-OT access. Remediation deadline: 12 months post-inception.",
        "claimRefs": ["CLAIM-INS-001", "CLAIM-INS-002"]
      },
      {
        "ref": "W-09",
        "title": "Access Control",
        "description": "User accounts deprovisioned within 5 business days of departure. MFA enforced on all administrative and remote access.",
        "claimRefs": ["CLAIM-INS-005"]
      },
      {
        "ref": "W-12",
        "title": "MSP Security",
        "description": "Managed service providers maintain equivalent security standards. SOC monitoring scope must include OT systems.",
        "claimRefs": ["CLAIM-INS-007"]
      }
    ]
  }
}
```

### 6.4 Minigame Runtime Contract

**Input params passed from scenario object:**
- `title` — displayed in the minigame header
- `warranties` — array of row definitions (ref, title, description, claimRefs[])

**State read on open:**
- `window.gameScenario.globalVariables.warranty_evidence_reviewed` — controls Submit gate
- `window.gameScenario.globalVariables.warranty_checklist_complete` — controls read-only/submitted display on reopen

**State written on submit:**
- `warranty_checklist_complete = true`
- `ins001_assessed = true`
- `ins003_assessed = true`

Each write uses `window.gameScenario.setGlobalVariable(name, value)` and emits `global_variable_changed:<name>`.

**Player selection storage:**
Row selections (Compliant / Breached / Arguable) and Evidence Found text inputs are stored in minigame-local state only, not persisted to global variables. If players close and reopen the form before submitting, selections and notes reset. This is acceptable in v1 — the form is short and re-completing is low cost. Per-row string persistence can be added in a later phase if Eleanor's debrief is extended to branch on individual assessments.

### 6.5 Save/Load and Reopen Behaviour

- On open: read `warranty_checklist_complete`. If `true`, render in submitted/read-only mode.
- On open: read `warranty_evidence_reviewed`. If `false`, disable Submit with status message.
- Reopening after submission is idempotent — no repeated global writes.

---

## 7. Visual Design

Direction: clinical insurance document, not a cyber terminal. The worksheet should feel like paper on a desk.

**Layout:**
1. Header: `MERIDIAN CYBER INSURANCE — WARRANTY COMPLIANCE CHECKLIST — MC-2023-ALBE-007`
2. Four warranty rows, each occupying a clearly bounded section
3. Per row: warranty ref + title (bold), description (small), three radio-style tick-box buttons in a row, writable Evidence Found text input beneath
4. Below all rows: submission gate status line
5. Submit button (full width, disabled state visually distinct)
6. On submitted state: each row shows the selected option highlighted; Submit replaced with `"Assessment submitted — discuss with Eleanor Vance"`

**Style:**
- Match Break Escape pixel-art UI conventions: 2px borders, sharp corners, restrained palette
- Background: off-white paper tone
- Tick-box buttons: outlined, fill on selection
- Breach option: subtle red fill when selected
- Arguable option: amber fill when selected
- Compliant option: green fill when selected
- Disabled Submit: grey; enabled Submit: navy/dark primary colour
- Typography: monospace or sans, readable at standard resolution

**No animations** beyond button state transitions.

---

## 8. Eleanor Vance Ink — Required Fix

The `npc_eleanor_vance.ink` has a secondary path through the warranty discussion that must also set `warranty_checklist_complete = true`. This handles two cases:
1. Players who complete all four warranty discussions with Eleanor before submitting the form (possible if they find Eleanor before finishing the form)
2. Safety net if the form's global write fails for any reason

At [line 301](scenarios/sis03_cyber_insurance/ink/npc_eleanor_vance.ink#L301) in `warranty_hub`, add:

```ink
+ {w07_discussed and w03_discussed and w09_discussed and w12_discussed} [Ready for act-of-war discussion]
    ~ warranty_checklist_complete = true
    Eleanor Vance: That's thorough. Let's talk about the other coverage issue: state attribution.
    -> act_of_war_intro
```

This is the only Ink change required for MG-04. It does not affect any other flow.

---

## 9. Integration with Other Components

**Eleanor Vance eventMapping (no changes needed):**
The existing eventMapping in `scenario.json.erb` already fires on `warranty_checklist_complete = true` and sends a timed message + unlocks `make_recommendation`. No changes required.

**`assess_warranties` aim (no changes needed):**
The aim's single task `talk_to_eleanor_warranties` (npc_conversation with Eleanor) completes naturally when players talk to Eleanor after form submission. The aim unlocks when `warranty_evidence_reviewed = true` via Eleanor's existing eventMapping. No changes required.

**Evidence Packets A, B, C:**
MG-04 depends on `warranty_evidence_reviewed`, which is set by Exhibit C's `onRead`. No changes required to the evidence packet objects.

**CMS Terminal (MG-01):**
`gdd.md` Aim 3 lists "CMS terminal (quarterly reports)" as a required interaction for the warranty assessment phase. The Q4 quarterly report is the primary evidence source for W-07 (confirming IT/OT segmentation remediation was still outstanding at incident date). There is no corresponding gate variable — `quarterly_reports_reviewed` is referenced in the CMS `stateWrites` schema but is not declared in `scenario.json.erb` globalVariables. This means CMS review cannot be enforced as a hard prerequisite without adding a new global.

Decision for this plan: treat CMS quarterly review as a **soft prerequisite**. The Submit gate enforces `warranty_evidence_reviewed` (Exhibit C) but not CMS review. The submission gate status line should include: `"Review the Claims Management System quarterly reports and all Evidence Archive packets before submitting."` This informs players of both requirements without adding a new global variable.

**Coverage Decision Form (MG-05):**
MG-04 must complete before `make_recommendation` aim unlocks. MG-05 is downstream and has no dependency on individual warranty row selections in the current plan.

---

## 10. Risks and Mitigations

1. **Risk:** Form submission fires before `warranty_evidence_reviewed = true` if gate is bypassed.
   - **Mitigation:** Gate check runs on every Submit button press, not just on open. Server-side validation of prerequisite state before accepting the write is ideal but out of scope for v1 — client-side guard is acceptable.

2. **Risk:** Eleanor's Ink reads `warranty_checklist_complete` before the form write propagates, resulting in hub not routing to `warranty_checklist_submitted`.
   - **Mitigation:** The Ink hub re-evaluates on every conversation open. The player must close and reopen Eleanor's conversation after submitting the form for the routing to take effect, which is the natural gameplay flow.

3. **Risk:** Row selections lost on close-before-submit frustrates players.
   - **Mitigation:** Add an in-minigame note: "Your selections are not saved until you submit." If this proves problematic in playtest, add local session storage persistence in a follow-up pass.

4. **Risk:** `ins008_assessed` and `ins009_assessed` are accidentally written by MG-04, interfering with MG-03 and MG-06 flows.
   - **Mitigation:** MG-04 only writes `ins001_assessed` and `ins003_assessed`. Explicitly do not write `ins008_assessed` or `ins009_assessed` — these are reserved for the NCSC brief and underwriting file stages respectively.

5. **Risk:** Archive unlock discrepancy (Section 2.2) is not resolved before implementation, causing confusion about when the archive opens.
   - **Mitigation:** Phase 0 decision gate must complete before any code is written. Do not proceed to Phase 1 without a confirmed decision on the archive flow.

---

## 11. Implementation Phases

**Phase 0 — Decision gate (before any code):**
1. Resolve the archive-unlock discrepancy (Section 2.2). Confirm whether `scenario.json.erb` archive flow stays as-is or is changed to match the planning doc flow. Update this plan's Section 9 accordingly before proceeding.

**Phase 1 — MVP:**
1. Create `warranty-checklist-minigame.js` with four rows, three options per row, writable Evidence Found field per row, Submit gate logic.
2. Add interaction hook in `interactions.js` and starter in `minigame-starters.js`.
3. Register in `index.js`.
4. Add `warranty_checklist` object to `meridian_claims_suite` in `scenario.json.erb`.
5. Wire `warranty_checklist_complete = true`, `ins001_assessed = true`, `ins003_assessed = true` on submit.
6. Fix Eleanor's Ink at line 301 (add `~ warranty_checklist_complete = true`).
7. Verify `make_recommendation` aim unlocks correctly end-to-end.

**Phase 2 — Content and polish:**
1. Visual polish pass — submitted state, selection colours, status line copy.
2. Confirm claimRefs display correctly per row (W-07 must show both INS-001 and INS-002).

**Phase 3 — Future enrichment (out of scope for now):**
1. Session-persistent row selections before submit.
2. Eleanor debrief branching on individual warranty assessments using `ins_assessed` variables.
3. Per-row string variable storage if downstream consumers are added.

---

## 12. Test Plan

1. **Prerequisite gate:**
   - Open the form before reviewing Exhibit C. Confirm Submit is disabled and status message is correct.
   - Review Exhibit C. Reopen form. Confirm Submit enables.

2. **Evidence Found field:**
   - Open the form. Type text into each Evidence Found field. Confirm input is accepted and displayed.

3. **Submission flow:**
   - Select all four rows (with or without Evidence Found text) and submit. Confirm `warranty_checklist_complete = true`, `ins001_assessed = true`, `ins003_assessed = true` in global state.
   - Confirm `ins008_assessed` and `ins009_assessed` remain `false` after submission.
   - Confirm Eleanor's timed message fires within ~5 seconds of submission.
   - Confirm `make_recommendation` aim becomes visible in the objectives panel.

4. **Reopen after submission:**
   - Close and reopen the form. Confirm read-only state with locked selections.
   - Confirm no repeated global writes.

5. **Eleanor conversation routing:**
   - After form submission, open Eleanor's conversation. Confirm hub routes to `warranty_checklist_submitted` knot.
   - Step through all four warranty discussions. Confirm `warranty_discussion_offered = true` is set.
   - Confirm `talk_to_eleanor_warranties` task completes.

6. **Ink fallback path:**
   - Without submitting the form, discuss all four warranties with Eleanor to trigger the line 301 Ink write.
   - Confirm `warranty_checklist_complete` is set and `make_recommendation` unlocks.

7. **Full scenario regression:**
   - Run from scenario start through to `coverage_decision_made = true`. Confirm no aim or task regressions introduced.

---

## 13. Definition of Done

1. `warranty_checklist` object is interactable in `meridian_claims_suite`.
2. Form opens and displays all four warranty rows with correct option buttons.
3. Submit gate correctly enforces `warranty_evidence_reviewed` prerequisite.
4. On submit, `warranty_checklist_complete = true` fires and Eleanor's eventMapping responds.
5. `make_recommendation` aim unlocks as expected.
6. Form reopens in read-only state after submission with no repeated writes.
7. Eleanor's Ink line 301 fix is in place as a fallback path.
8. No unrelated engine or scenario changes introduced.
