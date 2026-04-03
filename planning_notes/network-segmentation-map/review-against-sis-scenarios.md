# MG-04 Network Segmentation Map Audit

## Scope And Precedence

This document reviews the current MG-04 implementation against the healthcare documentation under [planning_notes/sis_scenarios](../sis_scenarios/).

Precedence used for this audit:

1. [case_1_healthcare_game_design/minigame_planning.md](../sis_scenarios/case_1_healthcare_game_design/minigame_planning.md)
2. [case_1_healthcare_game_design/gdd.md](../sis_scenarios/case_1_healthcare_game_design/gdd.md)
3. [case_1_healthcare_game_design/scenario_implementation_notes.md](../sis_scenarios/case_1_healthcare_game_design/scenario_implementation_notes.md)
4. [case_1_healthcare_information_pack/system_architecture/network_architecture.md](../sis_scenarios/case_1_healthcare_information_pack/system_architecture/network_architecture.md)
5. [case_1_healthcare_information_pack/system_architecture/system_overview.md](../sis_scenarios/case_1_healthcare_information_pack/system_architecture/system_overview.md)
6. [case_1_healthcare_information_pack/storylines/northgate_incident.md](../sis_scenarios/case_1_healthcare_information_pack/storylines/northgate_incident.md)
7. Live scenario wiring in [scenarios/sis01_sis_healthcare/scenario.json.erb](../../scenarios/sis01_sis_healthcare/scenario.json.erb)

Lower-priority planning notes in [planning_notes/network-segmentation-map](.) were treated as secondary context only. If they conflict with the healthcare sources above, the healthcare sources win.

## Executive Summary

MG-04 is close in topology, state handling, and narrative intent, but it is not fully aligned with the healthcare specification yet.

The two blocking issues are:

1. The live scenario still uses a readable `smartscreen` stub instead of the interactive minigame.
2. The implementation currently follows the draft-only interpretation from the visual ideas notes, which conflicts with the higher-priority healthcare minigame spec that requires toggleable exception rules and gated SEVER behavior.

There is also a smaller visual mismatch: the zone border colors in the CSS do not match the order described in the healthcare minigame planning notes.

## Criteria Review

### Topology And Labels

| Criterion                                                                      | Status | Notes                                                                                                         |
| ------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------- |
| Four zones are rendered                                                        | MATCH  | External, Enterprise IT, Clinical/Device, and Legacy Flat Segment are present in the minigame implementation. |
| Canonical device names are used                                                | MATCH  | Device labels match the healthcare network architecture source rather than abbreviated placeholders.          |
| Legacy flat segment is shown explicitly                                        | MATCH  | The legacy ward segment is present as a distinct fourth zone, which is required by the information pack.      |
| External / Enterprise / Clinical connection structure matches the architecture | MATCH  | The primary topology follows the healthcare network architecture diagram.                                     |

### Interaction Model

| Criterion                                           | Status   | Notes                                                                                                                   |
| --------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| Three legacy exception rules are part of the design | MATCH    | Rule 1, Rule 2, and Rule 3 are represented in the implementation logic and consequence text.                            |
| Rule toggles are present in the live UI             | MISMATCH | The current screen does not expose visible toggle controls. The higher-priority healthcare minigame spec requires them. |
| Consequence panel changes by rule state             | PARTIAL  | The rendering logic exists, but it is effectively unreachable without visible toggle controls.                          |
| Attack-path overlays are available                  | PARTIAL  | The path drawing code exists, but it is only meaningful if the toggle interaction is actually reachable.                |
| network_rules_reviewed is set by the minigame       | MATCH    | The implementation writes `network_rules_reviewed` on first rule interaction.                                           |
| SEVER is gated until the first toggle               | MISMATCH | The current implementation leaves SEVER immediately available, which contradicts the higher-priority healthcare spec.   |

### SEVER Flow

| Criterion                              | Status | Notes                                                                 |
| -------------------------------------- | ------ | --------------------------------------------------------------------- |
| Confirmation modal appears             | MATCH  | The modal copy and buttons are present.                               |
| network_isolated is written on confirm | MATCH  | The implementation writes the global flag and emits the change event. |
| Post-sever visual state is shown       | MATCH  | The red X / disconnected state is rendered after confirmation.        |
| Auto-complete after isolation          | MATCH  | The minigame completes after the configured delay.                    |

### Narrative And State

| Criterion                                                     | Status | Notes                                                                                               |
| ------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| The map teaches incomplete segmentation as the attack surface | MATCH  | The consequence panel and labels frame the legacy rules as the vulnerable paths.                    |
| The security-safety trade-off is explicit                     | MATCH  | The consequence text explains the EHR and fleet-console impact of isolation.                        |
| Downstream state changes are wired into the scenario          | MATCH  | The healthcare scenario is designed to drive EHR and fleet-console fallout from `network_isolated`. |
| Prior isolation is detected on reopen                         | MATCH  | The minigame checks persisted state and shows the severed condition.                                |

### Visual Design

| Criterion                                               | Status  | Notes                                                                                                       |
| ------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| Pixel-art layout and panel structure                    | MATCH   | The overall minigame layout follows the documented full-panel style.                                        |
| Padlock and warning icons are used on the network lines | MATCH   | The visual primitives match the documentation intent.                                                       |
| Connection routing is readable and non-overlapping      | MATCH   | The current routing avoids the worst collisions with the device list blocks.                                |
| Zone border colors match the healthcare visual spec     | PARTIAL | The current CSS color order does not match the zone color order described in the healthcare planning notes. |

## Live Scenario Wiring Review

This is the main blocker for actually seeing MG-04 in the scenario.

| Item                                                     | Status    | Notes                                                                                                          |
| -------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| `scenario.json.erb` still uses a readable stub           | NOT OK    | The `network_map_screen` object is still a `smartscreen` with static text.                                     |
| The stub sets `network_rules_reviewed` on read           | NOT OK    | That state write should come from the minigame interaction, not the readable fallback.                         |
| The minigame type is referenced from the scenario object | NOT FOUND | The live scenario still needs to be switched from the readable placeholder to the interactive minigame object. |
| The minigame is registered in the client                 | OK        | The JavaScript implementation exists and is registered in the minigame framework.                              |
| Interaction routing exists in the client                 | OK        | The system can route a `network-segmentation-map` object to the minigame.                                      |

## Contradictions Between Docs

The healthcare documentation is not perfectly self-consistent on the draft interaction model.

| Conflict                  | What It Says                                                                                                                                                                     | Audit Decision                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Draft SEVER behavior      | Some draft UI notes say SEVER is immediately enabled in draft mode.                                                                                                              | Lower priority.                                                   |
| Healthcare minigame spec  | [minigame_planning.md](../sis_scenarios/case_1_healthcare_game_design/minigame_planning.md) says the player must toggle at least one exception rule before SEVER becomes active. | This wins, because it is the higher-priority source.              |
| Scenario stub vs minigame | The live scenario still shows a readable wall-display stub rather than the minigame.                                                                                             | This must be fixed before the feature can be considered complete. |

## Findings

### What Matches Well

- The four-zone topology is present and grounded in the healthcare architecture source.
- The implementation models the three exception rules and the downstream isolation effect.
- The confirmation, isolation, and post-sever states are all implemented.
- The healthcare storyline is preserved: the user is deciding how to contain a compromise that already affects patient care.

### What Still Fails The Full Spec

- The live scenario still points at the readable `smartscreen` stub.
- The higher-priority healthcare spec requires visible toggle controls and gated SEVER behavior, but the current screen does not satisfy that interaction model.
- The zone color treatment is still slightly off compared with the planning notes.

## Priority Fix List

1. Replace the `smartscreen` stub in [scenarios/sis01_sis_healthcare/scenario.json.erb](../../scenarios/sis01_sis_healthcare/scenario.json.erb) with the interactive MG-04 object.
2. Reconcile the interaction model with [minigame_planning.md](../sis_scenarios/case_1_healthcare_game_design/minigame_planning.md): add visible toggle controls and gate SEVER until the first toggle.
3. Align the zone border colors with the healthcare visual spec.

## Bottom Line

MG-04 is structurally sound, but it is not yet a perfect match to the healthcare documentation set.

The implementation matches the topology and the downstream security-safety narrative well. The open issues are the live scenario wiring, the toggle-vs-draft contradiction, and the remaining visual spec mismatch.
