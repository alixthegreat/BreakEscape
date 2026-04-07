# MG14 Visual Design Plan (EHR Prescribing Terminal)

## Purpose
Define a clear, implementable visual specification for MG14 that is consistent with:
- SIS healthcare design notes for MG14
- Break Escape pixel-art UI conventions
- Educational intent (safety guardrails visible in online mode; safe fallback in offline mode)

## Data Source Rule
- Draft MG14 must render text and state from `scenarios/sis01_healthcare/scenario.json.erb` EHR object values.
- Do not invent patient-record content in draft.
- Online patient list/record visuals are post-draft and must be driven by scenario-defined patient data when added.

## Visual Direction
Clinical terminal aesthetic with strong state readability.
- Tone: institutional, operational, high-clarity.
- Priority: comprehension over decoration.
- Shape language: rectilinear, pixel-art aligned.

## Non-Negotiable Style Constraints
- 2px borders across all MG14 UI containers and controls.
- No border-radius.
- Clear online/offline status badge in header.
- High-contrast text and warning hierarchy.

## Color System
Use semantic color roles, not ad-hoc values.
- Background base: deep navy.
- Surface panels: slightly lighter navy/charcoal.
- Primary text: white/light gray.
- Online status: green.
- Offline critical state: red.
- Caution indicators: amber.
- Disabled controls/panels: neutral gray.

Implementation note:
- Define CSS custom properties in one MG14 stylesheet section to avoid drift.

## Typography
- Use existing game-compatible pixel/retro font stack.
- Header: compact all-caps terminal style.
- Body: readable pixel scale with strong line spacing.
- Clinical values (dose/range/IDs): monospaced alignment where needed.

## Layout Specification

## Header
- Title: NORTHGATE TRUST EHR - PRESCRIBING MODULE.
- Status badge at right:
  - `[ONLINE]` (green)
  - `[OFFLINE]` (red)

## Online Mode Layout
- Two-column frame:
  - Left 30%: patient list.
  - Right 70%: selected patient record.

Left panel (patient list):
- Scrollable rows.
- Each row includes:
  - patient name
  - ward/bed
  - allergy indicator dot
- States: default, hover/focus, selected.

Right panel (record details):
- Demographics block.
- Allergy block:
  - severe visual emphasis when present.
  - neutral "no known allergies" when absent.
- Medications table:
  - clear columns and row separators.
  - amber interaction marker where applicable.
- Dose-range visuals:
  - explicit safe range vs risk edges.
  - marker for current prescribed value.

## Offline Mode Layout
- Full panel desaturation/dimming treatment.
- Central warning icon and outage messaging.
- Message content emphasizes safe fallback:
  - Use the exact draft scenario terminal text:
    - SYSTEM UNAVAILABLE
    - Electronic Health Record service is unreachable.
    - Network connectivity to EHR server: FAILED
    - Do not attempt to prescribe from memory.
    - Use paper MAR charts from the desk drawer.
    - Contact IT Security if this persists.
- Main data regions become visibly non-interactive.

## Draft Scope Clarification
- In the current draft scenario, no EHR patient list data is defined on the terminal object.
- Therefore, draft visual output should prioritize the offline error-state presentation and close action.

## Motion and Transitions
- Keep motion minimal and purposeful.
- Required transition:
  - online to offline should be smooth and immediate on isolation event.
- Use short fade/overlay transitions only; avoid decorative animation.

## Accessibility and Readability
- Do not rely on color alone for critical meaning.
- Include textual labels for allergy severity and warning states.
- Ensure keyboard focus styling is visible in patient list.
- Preserve readable contrast in all states, especially dimmed offline mode.

## UI Components to Build
- `ehr-panel`
- `ehr-header`
- `ehr-status-badge`
- `ehr-patient-list`
- `ehr-patient-row`
- `ehr-record-panel`
- `ehr-allergy-alert`
- `ehr-medications-table`
- `ehr-dose-range`
- `ehr-offline-overlay`
- `ehr-close-button`

## Visual QA Checklist
- Borders are consistently 2px and square.
- Online/offline status is instantly recognizable.
- Allergy, interaction, and dose-risk cues are distinct.
- No overlap/truncation at common target resolutions.
- Offline mode is clearly non-interactive.
- UI remains coherent with existing Break Escape HUD/minigame styling.

## Scope Guardrails
- Do not redesign global minigame chrome.
- Do not introduce new art pipeline dependencies for draft unless required.
- Prefer existing sprites/icons first; add custom assets only if clarity fails.
