# MG07 Backup Console Review Against SIS Scenario Notes (2026-04-06)

## Scope
This review audits the current MG07 implementation against `planning_notes/sis_scenarios/case_1_healthcare_game_design/*`.

Primary references used:
- `planning_notes/sis_scenarios/case_1_healthcare_game_design/minigame_planning.md`
- `planning_notes/sis_scenarios/case_1_healthcare_game_design/scenario_implementation_notes.md`
- `planning_notes/sis_scenarios/case_1_healthcare_game_design/gdd.md`
- `planning_notes/sis_scenarios/case_1_healthcare_game_design/gdd_walkthrough.md`
- `scenarios/sis01_healthcare/scenario.json.erb`
- `public/break_escape/js/minigames/backup-recovery/backup-recovery-minigame.js`
- `public/break_escape/js/systems/minigame-starters.js`
- `public/break_escape/js/systems/unlock-system.js`

## Executive Summary
MG07 itself is largely implemented and correctly wired via `lockType: "backup_recovery"`.

However, strict SIS alignment is not complete end-to-end:
- Critical downstream integrations described by SIS notes (MG12 command-board behavior, source-specific narrative outcomes, reinfection branch) are not implemented in runtime code.
- Some planning docs in `sis_scenarios` are now stale versus current code (still describing placeholder `pin`).

## Findings (By Severity)

### High

1. MG12 command-board integration is not implemented in runtime code.
- SIS expectation:
  - `gdd.md` says command board auto-appends on `backup_recovery_source` and shows cloud ETA updates.
  - `gdd_walkthrough.md` expects immediate board update after confirmation.
- Current implementation:
  - `scenario.json.erb` only contains TODO comments for MG12 mapping under `command_board` readable text.
  - No command-board minigame module exists under `public/break_escape/js/minigames/`.
  - Search found no runtime consumer in JS minigames for `backup_recovery_source`, `recovery_eta_hours`, or `backup_reinfected` besides MG07 writing them.
- Impact:
  - The core "state made visible" teaching loop for recovery decisions is missing.

2. Source-specific NPC reaction promised in SIS notes is not implemented.
- SIS expectation:
  - `gdd.md` says Helen reacts based on selected source (cloud vs NAS/TAPE).
- Current implementation:
  - Scenario event mapping triggers Helen on `global_variable_changed:backup_restore_initiated` only.
  - `npc_helen.ink` does not branch on `backup_recovery_source`.
- Impact:
  - Narrative consequence is flattened; branch-specific feedback is not delivered.

3. Reinfection consequence path is not implemented.
- SIS expectation:
  - `gdd.md` causal chain: selecting NAS/TAPE despite warning can lead to `backup_reinfected = true` and downstream consequences.
- Current implementation:
  - `backup_reinfected` is initialized in scenario globals and referenced in comments, but no runtime JS/Ink writes it.
- Impact:
  - Key safety teaching outcome (compromised backup reinfection) is currently non-functional.

### Medium

4. `scenario_implementation_notes.md` is stale for MG07.
- SIS doc currently says backup console placeholder is `lockType: pin` and lockType registration not yet done.
- Current implementation is already `lockType: "backup_recovery"` and routed in unlock flow.
- Impact:
  - Developer guidance drift; future contributors may regress implementation by following outdated notes.

5. Interaction affordance for `backup_recovery` reuses password icon.
- Current interaction sprite mapping returns `password` icon for `backup_recovery`.
- SIS docs do not require a dedicated icon, so this is not a strict violation, but UX signaling can be ambiguous.
- Impact:
  - Minor discoverability inconsistency for a strategic decision console.

### Low

6. Post-confirm behavior includes lock-system unlock semantics that are not explicitly specified by SIS MG07 text.
- Current flow routes MG07 through lock/unlock, then standard item unlock behavior.
- This is architecturally consistent with current codebase lockType patterns.
- SIS notes describe the MG07 interaction itself, not explicit lock lifecycle semantics.
- Impact:
  - Acceptable implementation choice, but should be documented to avoid confusion during future refactors.

## What Matches SIS Well

1. Correct implementation category and interaction model.
- Implemented as HTML/CSS minigame scene (`MinigameScene`) with three tiles + consequence panel + confirm button.

2. Correct scenario routing style.
- `backup_console` is wired via `lockType: "backup_recovery"` in scenario.
- Unlock switch contains `case 'backup_recovery'` and launches dedicated starter.

3. Correct core global writes from MG07.
- On confirm, MG07 writes:
  - `backup_recovery_source`
  - `recovery_eta_hours = 18` for cloud only
  - `backup_restore_initiated = true`
- Write order is source -> ETA -> initiation flag, which is the safe order for event listeners.

4. Re-entry decision persistence behavior is implemented.
- MG07 now allows reopening and browsing options, while preventing confirmation once prior decision is locked.
- This aligns with recent requested behavior and avoids accidental state churn.

## Current Implementation vs Target (Quick Matrix)

- MG07 tile UI and consequence panel: Implemented; aligned.
- Confirm gate on selection: Implemented; aligned.
- lockType-based scenario trigger: Implemented; aligned.
- Cloud ETA write (`recovery_eta_hours=18`): Implemented; aligned.
- MG12 command board auto-update from MG07 vars: Not implemented; not aligned.
- NPC source-specific response to selected backup source: Not implemented; not aligned.
- Reinfection branch (`backup_reinfected`) runtime behavior: Not implemented; not aligned.
- SIS scenario implementation notes accuracy: Not aligned (doc drift).

## Recommended Remediation Order

1. Implement MG12 command-board minigame (or equivalent runtime board listener) consuming:
- `backup_recovery_source`
- `backup_restore_initiated` (completion trigger only)
- `recovery_eta_hours`
- `backup_reinfected`

2. Add source-aware narrative branching for Helen (and any other specified NPCs).
- Drive by `backup_recovery_source`, not only `backup_restore_initiated`.

3. Implement reinfection consequence logic per SIS sequence.
- Ensure it sets `backup_reinfected=true` under the documented conditions.

4. Update stale SIS scenario notes (`scenario_implementation_notes.md`) to reflect current lockType implementation state.

5. Optional UX polish: use a dedicated interaction affordance/icon for backup recovery consoles.

## Open Questions (Need Product/Design Clarification)

1. Should MG07 remain lockType-driven after first confirmation, or be directly reopenable as a pure minigame interaction regardless of lock state?
- Current user-requested behavior is supported at minigame level, but long-term lock lifecycle policy should be explicit.

2. For source-specific NPC reactions, which NPCs are mandatory for draft acceptance besides Helen?
- SIS docs imply at least Helen and Ravi in branches, but acceptance criteria should list required NPCs explicitly.

3. Should reinfection timing be deterministic (e.g., fixed 30 seconds) or event/condition based (e.g., if network remains unisolated at restore completion)?
- SIS notes reference both conceptual and walkthrough timing styles.

## Scope Decisions Confirmed (2026-04-06)

The following scope clarifications were provided and are now treated as accepted constraints for this review:

1. MG07 should remain lockType-driven where specified by SIS docs.
2. NPC dialogue branching is out of scope for this implementation review.
3. Reinfection logic is out of scope for this implementation owner, but should be condition-based if/when implemented, consistent with SIS wording (e.g., restore risk if network is not isolated).
4. SIS planning notes are rough and do not need updating at this stage.

## Addendum: MG12 Snippet Verification (Provisional)

This addendum evaluates the MG12 code snippet shared in chat. It is a provisional review because full branch context (file paths, final registration, scenario trigger wiring, CSS, and complete diff) was not provided.

### What Matches Expected Behaviour

1. Backup source-driven timeline entries are present.
- `backup_recovery_source` event is explicitly handled with cloud vs NAS/TAPE branching.

2. Duplicate prevention exists.
- Event entries use stable `event:<id>` keys and `hasEventKey(...)` guard, preventing repeats when minigame is reopened or events are replayed.

3. Re-entry persistence exists.
- Entries are persisted and restored via `mg12_command_board_state` in global variables.

4. Reinfection display hook exists.
- `global_variable_changed:backup_reinfected` handler is present and appends a critical timeline entry.

5. Manual entry lane exists and is keyboard-enabled.
- Input + post flow appears implemented with state persistence.

### Strict Mismatches / Risks

1. Source inference from `backup_restore_initiated` is currently implemented, which conflicts with current SIS guidance comments in scenario.
- In `getGlobals()`, if source is empty and `backup_restore_initiated === true`, code sets source to `CLOUD`.
- Scenario guidance states `backup_restore_initiated=true` is a completion trigger only and source should not be inferred from it.
- Severity: High.

2. Some timeline copy does not match current scenario-specified text exactly.
- Example: reinfection text in snippet differs from scenario TODO mapping text under command board comments.
- This may be acceptable if GDD wording is authoritative for your branch, but should be intentionally standardized.
- Severity: Medium.


### Out of Scope Per Confirmed Ownership

1. NPC source-specific dialogue branching.
2. Reinfection producer logic (setting `backup_reinfected=true` based on isolation condition).
3. Updating rough SIS planning docs during integration phase.

### Minimal Changes Recommended for MG12 Snippet Before Sign-off

1. Remove cloud fallback inference from `backup_restore_initiated`.
- Keep source derivation strictly from `backup_recovery_source`.

2. Align final timeline copy source of truth.
- Pick one canonical phrasing set (scenario mapping comments or GDD) and apply consistently.

