# MG14 Implementation Review (Current Build vs SIS Docs and Draft Scenario)

## Scope Reviewed
- planning_notes/sis_scenarios/case_1_healthcare_game_design/minigame_planning.md (MG-14 section)
- planning_notes/sis_scenarios/case_1_healthcare_game_design/development_tasks.csv (MG-14 row)
- scenarios/sis01_healthcare/scenario.json.erb (globalVariables + EHR object)
- public/break_escape/js/minigames/ehr-terminal/ehr-terminal-minigame.js
- public/break_escape/js/systems/interactions.js
- public/break_escape/js/systems/minigame-starters.js
- public/break_escape/css/ehr-terminal-minigame.css

## Overall Verdict
- **Mostly aligned** with current implementation goals and user-approved architecture.
- Core interactions are working: direct terminal launch, status-driven rendering, offline/online viewed flags.
- Remaining discrepancies are now primarily documentation/data-lifecycle alignment with draft scenario content.

## Findings (Ordered by Severity)

## 1) Scenario Data Contract vs Runtime Launch Model (Resolved)
- Severity: Resolved
- Decision: EHR terminal is interactable and launches directly (no PIN/lock flow).
- Current state:
  - Scenario EHR object no longer includes `locked`, `lockType`, `pin`, or unlock `onSuccess` fields.
  - Runtime launch remains direct from interactions by object id (`ehr_terminal`).
- Outcome:
  - Scenario and runtime behavior are now aligned for this design choice.

## 2) `ehr_status` Lifecycle via Global Variables (Resolved with Fallback)
- Severity: Resolved
- Decision: terminal state is driven by global variables, with fallback rule:
  - use `ehr_status` when present
  - otherwise if `network_isolated === true`, force `offline`
  - otherwise use online default in starter/minigame resolution
- Outcome:
  - State source is explicit and consistent with requested behavior.

## 3) Offline Message Text Divergence (Spec vs Scenario Source)
- Severity: Low
- MG-14 planning visual text uses `CONNECTION TO EHR SERVER LOST` phrasing.
- Draft scenario object provides `SYSTEM UNAVAILABLE` text block.
- Current implementation reads scenario text (source-of-truth behavior).
- Impact: no functional issue; wording divergence across docs can confuse reviewers.
- Remediation:
  1. Keep scenario text authoritative for draft.
  2. Add note in planning docs that wording differs intentionally in draft.

## 4) Network-Isolation Coupling (Resolved via Fallback Rule)
- Severity: Resolved
- Current implementation applies fallback `network_isolated=true -> offline` when `ehr_status` is not explicitly set.
- Outcome:
  - Terminal state now reflects isolation status without requiring extra manual wiring for draft behavior.

## Matches (Current Implementation)

## A) Interaction Integration
- Status: Match
- Evidence:
  - EHR launch is handled in interactions route for object id `ehr_terminal`.
  - Starter launches `ehr-terminal` scene with lockable scenarioData context.

## B) Status-Driven State Rendering
- Status: Match
- Evidence:
  - Minigame reads current runtime globals at open-time.
  - Resolution order: `ehr_status` first, then `network_isolated` fallback.

## C) Viewed Flag Semantics
- Status: Match
- Evidence:
  - `ehr_terminal_viewed_offline` only set in offline mode.
  - `ehr_terminal_viewed_online` set on online patient-row selection.

## D) Online Draft Demonstration + Extensibility
- Status: Match
- Evidence:
  - Online view now contains patient list + record panel + allergy + medication + dose bar.
  - Supports extensible `scenarioData.patients[]` input.
  - Includes one default seed patient for demo when no scenario patient data exists.

## E) Visual UI Intent
- Status: Mostly Match
- Evidence:
  - Header/status badge, two-column online layout (~32/68), allergy indicators, table, and dose bars are present.
  - Offline layout is clear and non-browsing.
  - 2px borders and no rounded corners maintained.
- Minor deltas:
  - Warning glyphs use simple `!` markers rather than bespoke icon assets.
  - Some spacing/ratio details differ slightly from planning prose but are within intent.

## Recommended Remediation Plan (Minimal Change)
1. Keep scenario text authoritative for offline message content.
2. Keep `scenarioData.patients[]` as the canonical path for adding online records and phase out seed defaults when scenario data is authored.
3. Optionally add explicit `ehr_status` in scenario globals if deterministic first-load state should always be forced.

## Acceptance Re-check
- Verify first load opens offline when no prior saved state exists.
- Verify online mode appears only when `ehr_status='online'`.
- Verify offline/online viewed flags set under correct conditions.
- Verify scenario docs and comments describe the same runtime model used by code.
