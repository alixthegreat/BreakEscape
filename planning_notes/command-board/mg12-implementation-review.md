# MG12 Implementation Review (Strict Alignment Audit)

Date: 2026-04-04  
Scope: Major Incident Command Board (MG-12) implementation and wiring in BreakEscape  
Reviewer intent: strict match/mismatch check against SIS source docs and local MG12 planning docs

---

## Sources Reviewed

- SIS canonical design and state model:
  - [planning_notes/sis_scenarios/case_1_healthcare_game_design/gdd.md](planning_notes/sis_scenarios/case_1_healthcare_game_design/gdd.md)
  - [planning_notes/sis_scenarios/case_1_healthcare_game_design/be_scenario_walkthrough.md](planning_notes/sis_scenarios/case_1_healthcare_game_design/be_scenario_walkthrough.md)
  - [planning_notes/sis_scenarios/case_1_healthcare_game_design/minigame_planning.md](planning_notes/sis_scenarios/case_1_healthcare_game_design/minigame_planning.md)
  - [planning_notes/sis_scenarios/case_1_healthcare_game_design/scenario_implementation_notes.md](planning_notes/sis_scenarios/case_1_healthcare_game_design/scenario_implementation_notes.md)
  - [planning_notes/sis_scenarios/case_1_healthcare_game_design/development_tasks.csv](planning_notes/sis_scenarios/case_1_healthcare_game_design/development_tasks.csv)
- Local MG12 planning docs:
  - [planning_notes/command-board/mg12-implementation-plan.md](planning_notes/command-board/mg12-implementation-plan.md)
  - [planning_notes/command-board/mg12-visual-design.md](planning_notes/command-board/mg12-visual-design.md)
- Implemented code and integration:
  - [public/break_escape/js/minigames/command-board/command-board-minigame.js](public/break_escape/js/minigames/command-board/command-board-minigame.js)
  - [public/break_escape/css/command-board-minigame.css](public/break_escape/css/command-board-minigame.css)
  - [public/break_escape/js/minigames/index.js](public/break_escape/js/minigames/index.js)
  - [public/break_escape/js/systems/minigame-starters.js](public/break_escape/js/systems/minigame-starters.js)
  - [public/break_escape/js/systems/interactions.js](public/break_escape/js/systems/interactions.js)
  - [scenarios/sis01_healthcare/scenario.json.erb](scenarios/sis01_healthcare/scenario.json.erb)
  - [app/views/break_escape/games/show.html.erb](app/views/break_escape/games/show.html.erb)
  - [index.html](index.html)

---

## Verdict

Overall implementation status: **Mostly aligned** with MG12 planning docs and core SIS behavior, with **3 material mismatches** and **2 medium/low robustness gaps**.

Critical blocker count: **0**  
High severity mismatches: **1**  
Medium severity mismatches: **2**  
Low severity gaps: **2**

---

## Matches (Implemented Correctly)

1. MG12 exists as a dedicated non-lock minigame scene and is registered.
   - Evidence: scene export/import/register in [public/break_escape/js/minigames/index.js#L23](public/break_escape/js/minigames/index.js#L23), [public/break_escape/js/minigames/index.js#L96](public/break_escape/js/minigames/index.js#L96), [public/break_escape/js/minigames/index.js#L124](public/break_escape/js/minigames/index.js#L124).

2. Scenario object was converted from readable placeholder to interactive MG12 object while preserving wall-display sprite.
   - Evidence: [scenarios/sis01_healthcare/scenario.json.erb#L1178](scenarios/sis01_healthcare/scenario.json.erb#L1178), [scenarios/sis01_healthcare/scenario.json.erb#L1179](scenarios/sis01_healthcare/scenario.json.erb#L1179), [scenarios/sis01_healthcare/scenario.json.erb#L1183](scenarios/sis01_healthcare/scenario.json.erb#L1183), [scenarios/sis01_healthcare/scenario.json.erb#L1184](scenarios/sis01_healthcare/scenario.json.erb#L1184).

3. Interaction routing is correctly wired for scenarioData type command_board.
   - Evidence: [public/break_escape/js/systems/interactions.js#L889](public/break_escape/js/systems/interactions.js#L889).

4. Starter is implemented and exported globally; keyboard input lock is explicitly requested to prevent WASD bleed-through while typing.
   - Evidence: [public/break_escape/js/systems/minigame-starters.js#L652](public/break_escape/js/systems/minigame-starters.js#L652), [public/break_escape/js/systems/minigame-starters.js#L669](public/break_escape/js/systems/minigame-starters.js#L669), [public/break_escape/js/systems/minigame-starters.js#L681](public/break_escape/js/systems/minigame-starters.js#L681).

5. MG12 behaves as ambient/persistent board rather than puzzle completion flow.
   - Evidence: close path always ends as aborted/false in [public/break_escape/js/minigames/command-board/command-board-minigame.js#L263](public/break_escape/js/minigames/command-board/command-board-minigame.js#L263).

6. Event-driven timeline appends and dedupe are implemented with one-shot event keys.
   - Evidence: event map and append guards in [public/break_escape/js/minigames/command-board/command-board-minigame.js#L27](public/break_escape/js/minigames/command-board/command-board-minigame.js#L27), [public/break_escape/js/minigames/command-board/command-board-minigame.js#L373](public/break_escape/js/minigames/command-board/command-board-minigame.js#L373).

7. State persistence across reopen cycles is implemented using globalVariables state key.
   - Evidence: [public/break_escape/js/minigames/command-board/command-board-minigame.js#L653](public/break_escape/js/minigames/command-board/command-board-minigame.js#L653), [public/break_escape/js/minigames/command-board/command-board-minigame.js#L661](public/break_escape/js/minigames/command-board/command-board-minigame.js#L661).

8. Manual entry bar exists, supports Enter key submit, and persists entries.
   - Evidence: [public/break_escape/js/minigames/command-board/command-board-minigame.js#L295](public/break_escape/js/minigames/command-board/command-board-minigame.js#L295), [public/break_escape/js/minigames/command-board/command-board-minigame.js#L409](public/break_escape/js/minigames/command-board/command-board-minigame.js#L409).

9. Compatibility normalization for SIS legacy variants is implemented.
   - Evidence: backup source normalization in [public/break_escape/js/minigames/command-board/command-board-minigame.js#L185](public/break_escape/js/minigames/command-board/command-board-minigame.js#L185), ward variable alias fallback in [public/break_escape/js/minigames/command-board/command-board-minigame.js#L340](public/break_escape/js/minigames/command-board/command-board-minigame.js#L340).

10. CSS is included in both Rails-hosted and standalone entry points.
    - Evidence: [app/views/break_escape/games/show.html.erb#L43](app/views/break_escape/games/show.html.erb#L43), [index.html#L51](index.html#L51).

11. Safety hardening for manual log rendering uses textContent (no raw HTML injection from manual input).
    - Evidence: [public/break_escape/js/minigames/command-board/command-board-minigame.js#L501](public/break_escape/js/minigames/command-board/command-board-minigame.js#L501).

---

## Mismatches (Strict)

1. High: Status panel does not include explicit BACKUPS row required by SIS GDD wording.
   - SIS expectation: right-side status reflects EHR, monitoring, fleet console, and backups.
   - Current implementation: rows are EHR, Ward 7 Monitoring, Fleet Console, Network, Ransomware.
   - Evidence:
     - Implementation row config: [public/break_escape/js/minigames/command-board/command-board-minigame.js#L15](public/break_escape/js/minigames/command-board/command-board-minigame.js#L15), [public/break_escape/js/minigames/command-board/command-board-minigame.js#L23](public/break_escape/js/minigames/command-board/command-board-minigame.js#L23).
     - SIS wording source: [planning_notes/sis_scenarios/case_1_healthcare_game_design/gdd.md](planning_notes/sis_scenarios/case_1_healthcare_game_design/gdd.md).
   - Impact: partial drift from canonical SIS narrative emphasis on backup-state visibility.
   - Recommended fix: add BACKUPS row (source variable: backup_recovery_source + backup_reinfected), keep Network/Ransomware as optional extra rows.

2. Medium: Timeline pre-seed baseline is thinner than SIS scenario narrative examples.
   - SIS examples include multi-entry startup context (major incident declaration, NCSC contact, players arrive).
   - Current implementation pre-seeds only one entry.
   - Evidence: preseed list in [public/break_escape/js/minigames/command-board/command-board-minigame.js#L5](public/break_escape/js/minigames/command-board/command-board-minigame.js#L5), narrative examples in [planning_notes/sis_scenarios/case_1_healthcare_game_design/be_scenario_walkthrough.md](planning_notes/sis_scenarios/case_1_healthcare_game_design/be_scenario_walkthrough.md).
   - Impact: less immediate situational context when opening board early.
   - Recommended fix: add optional preseed entries for NCSC contact and player arrival, behind config flag if needed.

3. Medium: Missing explicit PATIENT DETERIORATION auto-entry for bed2 critical non-fatal transition path.
   - SIS walkthrough calls out a distinct deterioration event when dose error + compromised guardrails occurs before death.
   - Current implementation logs bed2 death and optional dose events, but not explicit bed2 critical deterioration marker.
   - Evidence:
     - Current event map: [public/break_escape/js/minigames/command-board/command-board-minigame.js#L27](public/break_escape/js/minigames/command-board/command-board-minigame.js#L27).
     - SIS event expectation: [planning_notes/sis_scenarios/case_1_healthcare_game_design/be_scenario_walkthrough.md](planning_notes/sis_scenarios/case_1_healthcare_game_design/be_scenario_walkthrough.md).
   - Impact: reduced temporal clarity of clinical deterioration chain before terminal outcome.
   - Recommended fix: add mapping for patient_bed2_state = CRITICAL with distinct text.

---

## Robustness Gaps (Non-blocking)

1. Low: Duplicate ICO globals exist in scenario; MG12 listens only to ico_notified.
   - Scenario has both ico_notification_sent and ico_notified globals.
   - Evidence: [scenarios/sis01_healthcare/scenario.json.erb#L106](scenarios/sis01_healthcare/scenario.json.erb#L106), [scenarios/sis01_healthcare/scenario.json.erb#L107](scenarios/sis01_healthcare/scenario.json.erb#L107), MG12 mapping in [public/break_escape/js/minigames/command-board/command-board-minigame.js#L80](public/break_escape/js/minigames/command-board/command-board-minigame.js#L80).
   - Recommendation: accept ico_notification_sent as alias in getGlobals normalization for safety.

2. Low: Board observation text says timeline currently has three entries, which may not match runtime initial state.
   - Evidence: [scenarios/sis01_healthcare/scenario.json.erb#L1185](scenarios/sis01_healthcare/scenario.json.erb#L1185).
   - Recommendation: either update observation text or expand preseed list to align with that narrative.

---

## Cross-Component Interaction Check

1. Object interaction to board launch: **Pass**.
2. Scene registration and starter availability: **Pass**.
3. Keyboard handling for text input context: **Pass** (requiresKeyboardInput set).
4. Event bus integration for global_variable_changed triggers: **Pass**.
5. Persistent state in game globals and reopen continuity: **Pass**.
6. Rails + standalone stylesheet availability: **Pass**.
7. Scenario variable compatibility for legacy names/values: **Pass with caveats** (ICO alias still missing).

---

## Feature Coverage Against MG12 Plan

- Ambient, non-completable board: **Implemented**.
- Auto-appending timeline from mapped globals: **Implemented**.
- Manual entry input and post flow: **Implemented**.
- Status panel with live updates: **Implemented**.
- Deduplication of auto events: **Implemented**.
- Compatibility normalization rules: **Mostly implemented**.
- Draft simplification posture: **Implemented and exceeded** (manual entry + animation already present).

---

## Priority Remediation List

1. Add BACKUPS status row and state mapping (High).
2. Add bed2 critical deterioration timeline event (Medium).
3. Add optional startup preseeds to match narrative examples (Medium).
4. Add ico_notification_sent alias normalization (Low).
5. Align command_board observation text with real initial timeline count (Low).

---

## Final Alignment Statement

MG12 is integrated and functional across scene registration, interaction dispatch, input handling, persistence, and event-driven updates. It is production-usable in the current draft scenario. Strictly against SIS documents, the main residual gap is backup-state visibility in the status panel, plus two narrative/event completeness gaps. Addressing the five remediation items above would bring the implementation to near-complete strict alignment with both the command-board planning docs and SIS scenario intent.
