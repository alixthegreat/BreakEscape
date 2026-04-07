# MG14 Technical Implementation Plan (EHR Prescribing Terminal)

## Purpose
Implement MG14 with minimal, necessary changes only, aligned to:
- planning_notes/sis_scenarios/case_1_healthcare_game_design/minigame_planning.md
- planning_notes/sis_scenarios/case_1_healthcare_game_design/gdd.md
- scenarios/sis01_healthcare/scenario.json.erb
- scenarios/sis01_healthcare/ink/npc_sarah.json

## Current Baseline (Confirmed)
- EHR terminal object exists in Ward 7 as `id: ehr_terminal` in scenarios/sis01_healthcare/scenario.json.erb.
- Draft behavior is a PIN-gated offline message flow using scenarioData values on the object itself.
- Narrative already expects EHR loss after network isolation.
- Sarah dialogue references EHR downtime after isolation.
- The draft globalVariables block does not define `ehr_status` yet.

## Draft Source Of Truth Values (Must Match Scenario)
Use these exact values in draft MG14 display unless scenario data changes:

- Object id: `ehr_terminal`
- lockType: `pin`
- pin: `0000`
- onSuccess variable write: `ehr_terminal_viewed_offline = true`
- customMessage:
  - `SYSTEM UNAVAILABLE`
  - `Electronic Health Record service is unreachable.`
  - `Network connectivity to EHR server: FAILED`
  - `Do not attempt to prescribe from memory.`
  - `Use paper MAR charts from the desk drawer.`
  - `Contact IT Security if this persists.`
- observations:
  - `The EHR prescribing terminal on the ward desk. The screen shows a red error banner: SYSTEM UNAVAILABLE.`

Draft constraint:
- No patient list or patient-record dataset is currently defined for the EHR terminal in scenario.json.erb.

## Design Intent
MG14 teaches that electronic prescribing guardrails are safety-critical. After isolation, EHR becomes unavailable and clinical workflow falls back to paper MAR charts.

## Implementation Principles
- Keep gameplay semantics unchanged unless required by MG14 spec.
- Avoid broad refactors; isolate MG14 logic to minigame and scenario object wiring.
- Preserve existing lock/interaction framework conventions.
- Enforce server-side validation boundaries for progression-critical checks.

## Phase Plan

## Phase 1 (Draft, Offline-First)
Goal: Ship a reliable offline EHR terminal experience first.

1. Add MG14 minigame scene
- Create `js/minigames/ehr-terminal/ehr-terminal.js`.
- Extend `MinigameScene`.
- Render offline panel and close action only.

2. Register minigame
- Update `js/minigames/index.js`.
- Register scene key, for example `ehr-terminal`.

3. Scenario integration
- Update `scenarios/sis01_healthcare/scenario.json.erb` EHR object:
  - Preserve draft-compatible lock wiring unless deliberate migration is approved.
  - Keep offline guidance text and variable writes aligned to existing scenarioData.
  - Keep `ehr_terminal_viewed_offline = true` on offline interaction.

4. Event-driven status transition
- Draft minimum: terminal can remain static offline-only.
- Optional draft enhancement: add explicit `ehr_status` global and transition wiring if needed by MG14 UI state handling.

5. Validation updates
- If required by schema, add MG14 lock type to validator allowlist.
- Re-run scenario validation and resolve only MG14-related issues.

Phase 1 deliverable:
- EHR terminal opens a dedicated MG14 UI and shows explicit offline guidance.

## Phase 2 (Full Online-to-Offline)
Goal: Add educational browsing features before outage state.

1. Online UI + patient browser
- Left patient list, right record panel.
- Record blocks: demographics, allergies, medications, dose range bars.

2. Data model extension in scenario
- Add fictional patient records under EHR `scenarioData`.
- Include allergy and interaction metadata used by UI.

3. Telemetry/global variables
- Set `ehr_terminal_viewed_online = true` once at first meaningful browse.
- Keep `ehr_terminal_viewed_offline` idempotent.

4. Transition behavior
- Live transition from online to offline on isolation event.
- Smooth visual state change, no functional race conditions.

Phase 2 deliverable:
- Full didactic EHR interface that degrades safely to outage mode.

## Data Contract (MG14)
Read:
- Draft required:
  - terminal object `scenarioData.customMessage`
  - terminal object `scenarioData.pin`
  - `network_isolated` (for narrative consistency)
- Post-draft:
  - `ehr_status` (`online` or `offline`)

Write:
- `ehr_terminal_viewed_online`
- `ehr_terminal_viewed_offline`

Optional scenario payload (Phase 2):
- `scenarioData.patients[]` with allergy, interaction, and prescription-range fields.

## Integration Touchpoints
- Object interaction system: EHR object interaction dispatch.
- Minigame framework: launch, close, lifecycle.
- Global variable/event dispatcher: status updates.
- NPC narrative continuity: Sarah post-isolation messaging remains consistent.
- Task/objective context: MG14 remains non-blocking unless explicitly re-scoped.

## Minimal File Change Set
Phase 1 expected changes:
- js/minigames/ehr-terminal/ehr-terminal.js (new)
- js/minigames/index.js (update)
- scenarios/sis01_healthcare/scenario.json.erb (update)
- scripts/scenario-schema.json (update only if validator requires)

Phase 2 expected additions:
- js/minigames/ehr-terminal/ehr-terminal.css (new)
- scenarios/sis01_healthcare/scenario.json.erb (patient data extension)

## Risks and Mitigations
- Ambiguous lock wiring: isolate to EHR object only and test interaction loop.
- Data realism issues: use fictional records, clinically plausible values.
- Visual confusion between allergy and warning states: enforce distinct color + labels.
- Regression in unrelated minigames: do not modify shared framework behavior beyond scene registration.

## Test Strategy
1. Functional
- Open EHR terminal before and after isolation.
- Confirm correct state rendering and close behavior.

2. Variable integrity
- Verify `ehr_terminal_viewed_offline` and `ehr_terminal_viewed_online` set as intended.
- Confirm idempotency on repeated opens.

3. Narrative continuity
- Verify Sarah post-isolation dialogue remains coherent with MG14 state.

4. Regression
- Validate scenario schema.
- Smoke test mission-critical interactions outside MG14.

## Definition of Done
- MG14 opens via EHR object reliably.
- Offline state guidance is clear and matches SIS intent.
- Required globals are set correctly.
- No regressions in scenario validation or core interaction flow.
- Visual style follows Break Escape pixel-art conventions.
