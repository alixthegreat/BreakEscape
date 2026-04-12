# MG-01 ESD Pushbutton Review and Plan (2026-04-10)

## Scope

Reviewed implementation against SIS Scenario 2 MG-01 documentation:

- planning_notes/sis_scenarios/case_2_energy_game_design/minigame_planning.md
- planning_notes/sis_scenarios/case_2_energy_game_design/new_objects_planning.md
- planning_notes/sis_scenarios/case_2_energy_game_design/development_tasks.csv

Reviewed runtime implementation:

- public/break_escape/js/minigames/esd-pushbutton/esd-pushbutton-minigame.js
- public/break_escape/js/systems/interactions.js
- public/break_escape/js/systems/minigame-starters.js
- scenarios/sis02_energy/scenario.json.erb

## What Matches the MG-01 Spec

1. Two-step interaction is implemented: guard flip then button press confirmation modal.
2. Entry gating is implemented using marcus_webb_contacted.
3. Completion writes esd_activated = true.
4. Task completion path for press_esd_button is present.
5. Minigame is registered and launched through object interaction routing.

## Current Status (Implemented)

### Completed in Current Build

1. Premature ESD outcome capture is implemented.
- `early_esd_activation` is set when ESD is confirmed before `historian_flatline_found`.
- `esd_activated` is still set and `press_esd_button` is completed.

2. Scenario globals and narrative reaction are implemented.
- `early_esd_activation` exists in `globalVariables`.
- Priya eventMapping reacts to `global_variable_changed:early_esd_activation` with concern messaging.

3. Objective completion behavior is in place.
- Scenario mapping for `global_variable_changed:esd_activated` includes `completeTask: press_esd_button`.
- Minigame outcome path also includes `complete_task: press_esd_button`.

### Confirmed Out of Scope (By Decision)

1. Physical-mode bypass and hardware input pipeline.
- Kept digital-only behavior (minigame always shown for ESD interaction).

## Remaining Mismatches (Backlog)

### Medium

1. Scenario object model remains transitional.
- Docs target `type: esd_button` custom object type.
- Current scenario uses `type: pc` with `interactionType: esd_button`.

### Low

2. Confirmation copy differs slightly from planning-doc phrasing.

## Minimal Next Steps (If Needed)

1. Keep as-is for Scenario 2 delivery (recommended for now).
2. Optional follow-up: migrate ESD object to `type: esd_button` when broader object-schema work is scheduled.
3. Optional follow-up: align prompt copy exactly to planning docs if narrative consistency pass is required.

## Acceptance Snapshot

1. Digital MG-01 flow works (guard -> confirm).
2. Authorization gate via `marcus_webb_contacted` works.
3. Early activation flag and warning path are live.
4. ESD objective task completion path is live.
