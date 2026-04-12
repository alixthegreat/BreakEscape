# MG01 ESD Pushbutton Implementation Plan (Scenario 2 Energy)

Date: 2026-04-09

## 1. Context and Source Alignment

This plan is aligned to the Scenario 2 Energy corpus in planning_notes/sis_scenarios and scenarios/sis02_energy.

Primary MG01 references:

- planning_notes/sis_scenarios/case_2_energy_game_design/minigame_planning.md (MG-01 section)
- planning_notes/sis_scenarios/case_2_energy_game_design/development_tasks.csv (MG-01, OBJ-01, ENG dependencies)
- scenarios/sis02_energy/scenario.json.erb (esd_pushbutton stub, objectives, eventMappings)

Cross-scenario implementation conventions reviewed from planning_notes/sis_scenarios:

- Replace placeholder lockType interactions incrementally rather than rewriting scenario flow wholesale.
- Use global variables and NPC eventMappings as the primary progression mechanism.
- Keep minigames modular and state-driven (start, update global(s), let objective/event systems react).
- Keep physical mode and digital mode behavior equivalent at the global-variable boundary.

Scenario-2-specific architecture requirements from planning docs:

- MG-01 is defined as a custom Phaser minigame tied to OBJ-01.
- OBJ-01 defines a custom object type (`esd_button`) with state machine behavior.
- The target implementation is object-type interaction flow (interactions.js path), not a permanent lockType PIN flow.

## 2. MG01 Required Behavior (From Design Docs)

MG01 is a two-step emergency control interaction that teaches hardwired ESD independence:

1. Step 1: Flip the safety guard up.
2. Step 2: Press exposed mushroom button and confirm irreversible shutdown.

Required gameplay effects:

- Read gate: marcus_webb_contacted must be true (authorized activation path).
- Write outcome: esd_activated = true.
- Objective impact: completes task press_esd_button (aim initiate_esd) via existing objective chain.

Required narrative/system interactions already present in Scenario 2:

- Priya reacts to esd_activated via eventMappings.
- Alarm panel and downstream safe-state flow depend on esd_activated and other globals.

## 3. Existing Stub and Integration Surface

Current stub in scenarios/sis02_energy/scenario.json.erb:

- object id: esd_pushbutton
- current behavior: lockType pin placeholder
- on success path: readable confirmation content sets esd_activated = true

Technical integration points (minimal set):

- public/break_escape/js/minigames/index.js
- public/break_escape/js/systems/interactions.js
- public/break_escape/js/systems/minigame-starters.js
- public/break_escape/js/systems/unlock-system.js
- new MG01 minigame module under public/break_escape/js/minigames/esd-pushbutton/
- scenarios/sis02_energy/scenario.json.erb (minimal object metadata update only if needed)

## 4. Minimal Technical Strategy

Implement MG01 with the smallest safe change footprint and without touching VM systems.

### 4.1 Launching Strategy

Verified strategy against Scenario 2 planning docs:

- Primary path: implement MG01 as custom object-type interaction (`esd_button`) routed in interactions.js.
- Digital mode: object interaction opens MG01 scene directly.
- Physical mode: hardware trigger path sets the same global outcome (`esd_activated = true`) without requiring the UI minigame.
- Transitional compatibility: a temporary lockType bridge in unlock-system is acceptable only while migrating from the current placeholder.

Why:

- Matches OBJ-01 and MG-01 definitions in development_tasks.csv and new_objects_planning.md.
- Matches custom object-type design in new_objects_planning.md section 2.1.
- Preserves existing narrative and objective wiring while moving to target architecture.

### 4.2 MG01 Scene Contract

New minigame scene: esd-pushbutton

Scene states:

- ARMED_GUARD_DOWN
- GUARD_OPEN
- CONFIRM_MODAL
- ACTIVATED (terminal)

Behavior contract:

- Cancel exits with no state writes.
- Confirm success returns success=true to unlock callback.
- No direct edits to NPC content in this implementation.

### 4.3 Global Variable Write Point

Use one write point only:

- Set esd_activated exactly once on MG01 confirm success (digital) or GPIO trigger (physical), using one authoritative path per mode.

Rule:

- Do not duplicate esd_activated writes in multiple places.

### 4.4 Gating

Before starting MG01:

- Verify marcus_webb_contacted == true.
- If false: show advisory message and abort interaction.

Optional (non-blocking) telemetry flag for debrief:

- early_esd_activation when historian_flatline_found is false.
- This is optional and should be skipped in first pass if it creates scope creep.

## 5. Visual Design Plan (Aligned, Minimal, Buildable)

Target look (from case_2 minigame planning + project UI conventions):

- Industrial close-up panel, yellow housing, black guard, red mushroom button.
- Guard flip animation with clear state change.
- Confirmation modal with high-contrast warning copy.

UI constraints to preserve project style:

- Sharp corners, no rounded corners.
- 2px borders for framed UI elements.
- Clear color semantics: warning/amber, confirm/red, safe/green.

MG01 screen elements:

- Header label: EMERGENCY SHUTDOWN - RACKS A1-A4
- Guard element (clickable in step 1)
- Button element (inactive until guard open)
- Confirmation modal:
  - CONFIRM - INITIATE SHUTDOWN
  - CANCEL
- Success state panel text:
  - ISOLATED - COOLING ACTIVE

Audio/feedback (first implementation):

- Guard flip click
- Button press/confirm tone
- Optional white flash on confirm

## 6. Interaction With Other Components

Components affected by MG01 outcome (no new redesign required):

- Objective/task system: press_esd_button task progression.
- NPC eventMappings:
  - Priya timed response to esd_activated.
  - Safe-state chain that later depends on network_isolated.
- Ambient state displays (current placeholders):
  - Alarm panel text logic references esd_activated.
  - Hydrogen escalation work remains separate (out of scope).

## 7. Out-of-Scope Boundaries

Strictly out of scope for this MG01 implementation plan:

- VM minigames and VM content (MG-02, MG-04).
- Alarm panel engine driver implementation (ENG-01).
- Hydrogen timed escalation engine (ENG-02).
- Item reveal mechanics and other non-MG01 engine extensions.
- Sprite art pipeline replacement work beyond minimal MG01 UI assets.

## 8. Implementation Sequence

1. Add MG01 scene module under minigames/esd-pushbutton.
2. Register scene in minigames/index.js.
3. Add starter wrapper in systems/minigame-starters.js.
4. Add object-type branch in systems/interactions.js for type esd_button that launches MG01 (primary path).
5. Update scenarios/sis02_energy/scenario.json.erb ESD object metadata toward target shape (custom type/state behavior); keep migration-safe fields only if temporarily required.
6. Optional migration bridge: keep an object-specific lockType route in systems/unlock-system.js only until scenario metadata is fully migrated.
7. Keep scenario objective/global wiring intact; update scenario comments to reflect target object-type architecture.
8. Validate full path from Marcus authorization to esd_activated side effects.

## 9. Acceptance Criteria (MG01 Done Definition)

MG01 is complete when all are true:

- Interacting with esd_pushbutton via object type esd_button launches MG01 flow (not generic placeholder-only behavior).
- Guard must be opened before confirm path is available.
- Confirm path produces exactly one successful activation outcome.
- esd_activated is set and existing Priya/eventMapping responses fire.
- press_esd_button objective path advances without regressions.
- No VM behavior changed.
- No unrelated scenario/objective/NPC regressions introduced.

## 10. Risks and Mitigations

Risk: Interaction routing regression when introducing custom object type.

- Mitigation: add a narrow interactions.js branch for esd_button only; leave existing object-type branches untouched.

Risk: Transitional lockType and object-type paths diverge during migration.

- Mitigation: define one temporary bridge window; remove bridge after scenario metadata migration is complete.

Risk: Duplicate state writes for esd_activated.

- Mitigation: keep a single authoritative write location.

Risk: Scope creep into physical GPIO or alarm subsystems.

- Mitigation: treat GPIO and alarm engine as separate follow-up work items.

## 11. Immediate Next Step

Implement MG01 digital-first interaction path using existing objective/event wiring, then run a targeted scenario path test from call_marcus_initial through press_esd_button to confirm no regression in downstream state transitions.
