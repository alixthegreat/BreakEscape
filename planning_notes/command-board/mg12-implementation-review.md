# MG12 Implementation Review (Strict Alignment Audit) — UPDATED

Date: 2026-04-05
Scope: Major Incident Command Board (MG-12) implementation and wiring in BreakEscape
Reviewer intent: strict match/mismatch check against SIS source docs and local MG12 planning docs
Revision: Updated findings from code inspection

---

## Sources Reviewed

- SIS canonical design and state model:
  - [planning_notes/sis_scenarios/case_1_healthcare_game_design/gdd.md](planning_notes/sis_scenarios/case_1_healthcare_game_design/gdd.md)
  - [planning_notes/sis_scenarios/case_1_healthcare_game_design/be_scenario_walkthrough.md](planning_notes/sis_scenarios/case_1_healthcare_game_design/be_scenario_walkthrough.md)
  - [planning_notes/sis_scenarios/case_1_healthcare_game_design/minigame_planning.md](planning_notes/sis_scenarios/case_1_healthcare_game_design/minigame_planning.md)
  - [planning_notes/sis_scenarios/case_1_healthcare_game_design/scenario_implementation_notes.md](planning_notes/sis_scenarios/case_1_healthcare_game_design/scenario_implementation_notes.md)
- Local MG12 planning docs:
  - [planning_notes/command-board/mg12-implementation-plan.md](planning_notes/command-board/mg12-implementation-plan.md)
  - [planning_notes/command-board/mg12-visual-design.md](planning_notes/command-board/mg12-visual-design.md)
- Implemented code and integration:
  - [public/break_escape/js/minigames/command-board/command-board-minigame.js](public/break_escape/js/minigames/command-board/command-board-minigame.js)
  - [public/break_escape/css/command-board-minigame.css](public/break_escape/css/command-board-minigame.css)
  - [scenarios/sis01_healthcare/scenario.json.erb](scenarios/sis01_healthcare/scenario.json.erb)

---

## Overall Verdict

Implementation status: **Aligned with spec — substantively correct, minor gaps to address**.

Critical blocker count: **0**
High severity mismatches: **0**
Medium severity mismatches: **2**
Low severity gaps: **1**

---

## Correction to Previous Review

**IMPORTANT — Previous review contained an ERROR:**

The prior review stated: *"High: Status panel does not include explicit BACKUPS row required by SIS GDD wording."*

**This claim is INCORRECT.** The implementation DOES include a BACKUPS row with proper state logic:
- Evidence: [command-board-minigame.js#L28](command-board-minigame.js#L28) defines `BACKUPS` in STATUS_ROW_KEYS
- Status computation: [command-board-minigame.js#L591-L598](command-board-minigame.js#L591-L598) implements full BACKUPS state machine
  - States: REINFECTED, RESTORING, COMPROMISED (NAS RISK), OFFLINE (TAPE WIPED), UNKNOWN
  - Conditions: backup_reinfected, backup_recovery_source values, backup_restore_initiated
- GDD spec (line 278): Status panel should reflect "EHR, monitoring, fleet console, and backups" — **IMPLEMENTED.**

**Recommendation:** Previous remediation item #1 should be removed as implemented.

---

## Matches (Implemented Correctly)

1. All items from previous review sections "Matches" remain valid and verified.
2. BACKUPS status row is correctly implemented with comprehensive state logic.

---

## Mismatches (Medium Severity)

### 1. Missing Bed 2 Critical Deterioration Timeline Event

**SIS expectation:** When a dose error occurs AND the drug library is tampered, patient deterioration should auto-log distinctly.

**Current situation:** Only bed2 death is mapped. No explicit event for CRITICAL deterioration state.

**Spec source:**
- [be_scenario_walkthrough.md#L546](be_scenario_walkthrough.md#L546):
  ```
  If pump_dose_error = true and drug_library_compromised = true:
  [t] PATIENT DETERIORATION — Ward 7 Bed 2. Opioid toxicity suspected. Smart pump guardrails failed.
  ```
- Walkthrough context (L531-L535): immediate critical state without delay due to disabled guardrails

**Impact:** Temporal clarity of clinical deterioration chain is reduced; debrief narrative loses a key intermediate milestone.

**Recommended fix:**
Add event definition (in EVENT_DEFINITIONS):
```js
{
    id: 'patient_bed2_critical',
    event: 'global_variable_changed:patient_bed2_state',
    shouldAppend: (globals) => String(globals.patient_bed2_state || '').toUpperCase() === 'CRITICAL'
                              && globals.drug_library_compromised === true,
    text: 'PATIENT DETERIORATION - Ward 7 Bed 2. Opioid toxicity suspected. Smart pump guardrails failed.',
    type: 'critical',
    optional: false
}
```

### 2. Missing ICO Notification Legacy Variable Alias

**SIS scenario issue:** Scenario file defines both `ico_notification_sent` (line 106) and `ico_notified` (line 107), but only `ico_notified` is watched.

**Current situation:**
- getGlobals() normalizes `central_station_ward7_status` → `ward_monitor_status` [L342-L344]
- getGlobals() normalizes backup_recovery_source variants [L346-L351]
- No normalization for `ico_notification_sent` → `ico_notified` alias

**Impact:** If scenario code or a future narrative sets `ico_notification_sent=true`, the command board will not recognize it.

**Recommended fix:**
Update getGlobals() to add:
```js
if (!globals.ico_notified && globals.ico_notification_sent === true) {
    globals.ico_notified = true;
}
```

---

## Low Severity Gaps

### 1. Observation Text Mismatch

**Current observation:**
`"The timeline currently has only three entries."`

**Reality:**
Pre-seeded timeline has 1 entry (matches GDD spec). The observation was likely written anticipating additional preseed entries or assuming player actions before first open.

**Impact:** Narrative flavor only — no functional impact.

**Recommended fix:** Either:
- Option A: Update observation to: `"The timeline shows the initial incident declaration. New entries will appear as the response unfolds."`
- Option B: Expand preseed to 2-3 entries if broader narrative context is desired (e.g., MAJOR INCIDENT DECLARED, NCSC CONTACT INITIATED, RESPONSE TEAM ASSEMBLED)

---

## Cross-Component Interaction Check

All checks from previous review remain valid:
1. Object interaction to board launch: **Pass**.
2. Scene registration and starter availability: **Pass**.
3. Keyboard handling for text input context: **Pass** (requiresKeyboardInput set).
4. Event bus integration for global_variable_changed triggers: **Pass**.
5. Persistent state in game globals and reopen continuity: **Pass**.
6. Rails + standalone stylesheet availability: **Pass**.
7. Scenario variable compatibility for legacy names/values: **Needs ICO alias fix** (see Medium #2).

---

## Feature Coverage Against MG12 Plan

- Ambient, non-completable board: **Implemented**.
- Auto-appending timeline from mapped globals: **Implemented**.
- Manual entry input and post flow: **Implemented**.
- Status panel with live updates: **Implemented, including BACKUPS** (✓ corrected).
- Deduplication of auto events: **Implemented**.
- Compatibility normalization rules: **Mostly implemented** (ICO alias missing).
- Draft simplification posture: **Implemented and exceeded**.

---

## Updated Priority Remediation List

1. **Add bed2 critical deterioration event** (Medium).
2. **Add ico_notification_sent alias normalization** (Low).
3. **Align observation text with actual initial timeline count** (Low, for narrative consistency).

---

## Final Alignment Statement

MG12 is substantially aligned with both the SIS GDD and command-board planning docs. Most core features are correctly implemented, including the BACKUPS status row (which was incorrectly flagged in the previous review). The main residual gaps are:

- One missing timeline event (bed2 critical deterioration state transition)
- One missing variable alias (ico_notification_sent → ico_notified)
- One observation text discrepancy (no functional impact)

Addressing the three remediation items above would bring the implementation to complete strict alignment with SIS intent.

---

## Notes for Future Review
- If optional preseed entries (Phase 1 escalation, NCSC contact) are added in the future, ensure they remain behind feature flags or conditional logic to preserve scenario starting state consistency.
- The BACKUPS row correctly reflects the complex backup recovery state logic; no simplification recommended.
