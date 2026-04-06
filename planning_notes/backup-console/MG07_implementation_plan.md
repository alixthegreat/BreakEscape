# MG07 Backup Recovery Console Implementation Plan

Date: 2026-04-05
Scope: Implement MG07 with minimal required changes, aligned to SIS healthcare planning and current scenario wiring.

Revision: 2026-04-06 alignment pass against `planning_notes/sis_scenarios/case_1_healthcare_game_design/*`

## 1. Goal and Constraints

MG07 is the Backup Recovery Console minigame in SIS01 healthcare. It replaces a temporary PIN lock on `backup_console` with a three-option decision interface.

Primary gameplay outcome:
- Player selects a recovery source (`nas_encrypted`, `tape_wiped`, `cloud_vendor`)
- Consequence panel explains risk and time trade-off
- Confirm action commits decision to global state

Hard constraints:
- Keep changes minimal and local to MG07 paths
- Preserve existing scenario/narrative flow and placeholders for other unbuilt minigames
- Follow existing minigame framework patterns (`MinigameScene`, `MinigameFramework.registerScene`)
- Keep pixel UI conventions (2px borders, sharp corners)

## 2. Source Alignment

This plan is aligned to:
- `planning_notes/sis_scenarios/case_1_healthcare_game_design/minigame_planning.md` (MG07 functional + visual spec)
- `planning_notes/sis_scenarios/case_1_healthcare_game_design/gdd.md` (state model, room flow, dependencies)
- `planning_notes/sis_scenarios/case_1_healthcare_game_design/be_scenario_walkthrough.md` (Phase 3 interaction ordering)
- `planning_notes/sis_scenarios/case_1_healthcare_game_design/scenario_implementation_notes.md` (placeholder-to-final mapping)
- `planning_notes/sis_scenarios/case_1_healthcare_game_design/development_tasks.csv` (MG-07 and TEST-MG-07)
- `scenarios/sis01_healthcare/scenario.json.erb` (live integration points and TODO blocks)
- `scenarios/sis01_healthcare/ink/npc_helen.ink` (post-backup narrative reactions)

Resolved source-note ambiguity:
- Cloud tile keeps `AVAILABLE` as the status term and uses mixed signaling: availability in positive badge treatment, with amber caution marker and consequence banner to preserve the risk message from walkthrough/GDD notes.

## 3. Current State (Verified)

Current placeholder behavior in `scenario.json.erb`:
- `backup_console` is locked with `lockType: "pin"`
- random `backup_pin` workaround exists
- TODO text explicitly defines MG07 replacement behavior

Existing global variables already present in scenario state:
- `network_isolated`
- `backup_recovery_source`
- `backup_restore_initiated`
- `backup_reinfected`

Existing interaction dependencies already wired:
- Helen Carver event mapping listens to `global_variable_changed:backup_restore_initiated`
- Command Board TODO mapping references backup-related timeline entries

Current inconsistencies to resolve before/with MG07 delivery:
- MG12 TODO mapping currently treats `backup_restore_initiated=true` as cloud-specific text. This is incorrect for NAS/tape branches.
- `Backup Status Report` note currently sets `backup_restore_initiated=true` on read/pickup in scenario object content. This can cause false-positive backup timeline entries before a player confirms any source.
- Source labels vary across docs (`NAS/TAPE/CLOUD`) versus runtime ids (`nas_encrypted` / `tape_wiped` / `cloud_vendor`). Mapping must be explicit to avoid branch drift.

Scenario and pacing dependencies from healthcare notes:
- MG07 occurs in Phase 3, Room 3 (Major Incident Room)
- Backup console is accessible at incident-room start state
- MG07 outcome must be visible to MG12 timeline/command-board presentation

## 4. Minimal Technical Design

## 4.1 New Minigame Module

Add one new minigame module:
- `public/break_escape/js/minigames/backup-recovery/backup-recovery-minigame.js`

Class design:
- `class BackupRecoveryMinigame extends MinigameScene`
- Uses HTML/CSS-only UI (no Phaser canvas)
- Reads source definitions from params/scenarioData
- Stores transient `selectedSource`

Required UI states:
- Initial: three tiles visible, confirm disabled
- Selected: consequence panel updates for selected tile, confirm enabled
- Confirmed: writes globals, completes minigame success

## 4.2 Framework Registration

Update:
- `public/break_escape/js/minigames/index.js`

Changes:
- Import `BackupRecoveryMinigame`
- Register key `backup-recovery`

This follows current registration style used by other HTML/CSS minigames.

## 4.3 Starter Hook

Update:
- `public/break_escape/js/systems/minigame-starters.js`

Add starter helper:
- `startBackupRecoveryMinigame(lockable, type, callback)`

Responsibilities:
- Initialize framework if required
- Launch `backup-recovery` scene
- Pass source metadata from object scenarioData
- Pass `onComplete` callback to continue unlock flow

## 4.4 Unlock-System Hook

Update:
- `public/break_escape/js/systems/unlock-system.js`

Add switch case:
- `case 'backup_recovery':`

Behavior on success:
- run minigame
- if successful, call `unlockTarget(...)` like existing PIN/password flows
- preserve server-notify behavior model already used for lock types where applicable

## 4.5 Scenario Integration

Update in `scenarios/sis01_healthcare/scenario.json.erb`:
- change `backup_console.lockType` from `pin` to `backup_recovery`
- remove placeholder `requires: <%= backup_pin %>` from the lock logic path
- add `scenarioData` block for MG07 sources and consequence content (if not already inline)

MG07 write contract on confirm:
- always set `backup_recovery_source` to selected id
- always set `backup_restore_initiated = true`
- set `recovery_eta_hours = 18` only for `cloud_vendor`

Required write order on confirm (for listener correctness):
1. write `backup_recovery_source`
2. if cloud, write `recovery_eta_hours = 18`
3. write `backup_restore_initiated = true`

Rationale:
- MG12 and NPC listeners triggered by `backup_restore_initiated` must read an already-final source value.
- This prevents command-board entries from defaulting to cloud when NAS/tape was actually selected.

MG12 command-board contract:
- write order should guarantee timeline listeners can render backup action immediately after confirm
- expected cloud path board entry content: `CLOUD RESTORE INITIATED - EHR recovery ETA 18 hours`
- non-cloud selections should still produce a restore-source decision entry (wording can differ, but source id and risk state must be traceable)

Listener precedence rule (required):
- MG12 should derive backup timeline wording primarily from `backup_recovery_source` value.
- `backup_restore_initiated=true` should be treated as a completion trigger only (or backward-compat fallback when source is absent), not as cloud evidence.

Recommended backup timeline mapping:
- `backup_recovery_source=cloud_vendor` -> `CLOUD RESTORE INITIATED - EHR recovery ETA 18 hours`
- `backup_recovery_source=nas_encrypted` -> `RECOVERY ATTEMPTED FROM NAS - WARNING: Source may be compromised`
- `backup_recovery_source=tape_wiped` -> `RECOVERY ATTEMPTED FROM TAPE - WARNING: Source may be compromised`

## 4.6 Global Variable Writes

Preferred mechanism:
- `window.npcManager.setGlobalVariable(key, value)`

Fallback:
- write into `window.gameState.globalVariables` and emit `global_variable_changed:<key>` if needed

This mirrors resilient pattern used in existing minigames like network-segmentation-map.

## 5. Integration and Side-Effects

MG07 must integrate with:
- Helen Carver narrative logic after `backup_restore_initiated=true`
- future/placeholder Command Board timeline updates
- objective completion that depends on backup decision being made
- any downstream checks that read `backup_recovery_source` for branch-specific dialogue/logic

Important risk branch to preserve:
- If restore is initiated before isolation, downstream logic may set `backup_reinfected=true`
- MG07 should not bypass or short-circuit this branch; it should only write the trigger variables

## 6. Implementation Sequence (Minimal)

Phase 1: Core feature
1. Add MG07 minigame module
2. Register in minigame index
3. Add minigame starter function
4. Add `backup_recovery` case in unlock system

Phase 2: Scenario wiring
1. Change `backup_console.lockType`
2. Add/confirm scenarioData payload for three sources
3. Keep all other room objects unchanged

Phase 3: Validation
1. Run through each source path (NAS, tape, cloud)
2. Verify confirm disabled before selection
3. Verify global variables after confirm
4. Verify Helen post-backup trigger fires

## 7. Test Matrix (from TEST-MG-07 plus integration)

Functional tests:
- Tile click updates selected state and consequence panel
- Confirm is disabled until selection
- NAS and tape show warning treatment
- Cloud sets `recovery_eta_hours=18`
- Confirm label includes selected source wording (source-specific)

State tests:
- `backup_recovery_source` written correctly for each path
- `backup_restore_initiated=true` written once confirmed
- `recovery_eta_hours` unchanged for non-cloud selections

Integration tests:
- Helen `post_backup` path reacts after MG07 completion
- MG12 timeline appends backup decision entry from global-variable events
- MG12 appends exactly one backup-initiation entry per confirmation action
- MG12 selects entry text from `backup_recovery_source`, not from `backup_restore_initiated` alone
- No regression in other lock types (`pin`, `password`, etc.)
- Re-open behavior remains stable if object is already unlocked

## 8. Out of Scope for MG07 First Delivery

Do not include in first implementation unless required by breakage:
- Command Board full MG12 implementation
- New animation systems or Phaser rendering
- New NPC scripting beyond existing event mappings
- Refactors of unrelated lock flows

## 9. Delivery Checklist

- [ ] MG07 minigame module created
- [ ] index registration added
- [ ] starter helper added
- [ ] unlock-system switch case added
- [ ] scenario `backup_console` lockType migrated
- [ ] all three source outcomes verified
- [ ] no unrelated behavior changes
