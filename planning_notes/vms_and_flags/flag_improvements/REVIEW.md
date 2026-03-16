# Plan Review: Flag Station Task Completion

**Reviewed**: 2026-03-13
**Reviewer**: Plan agent (automated architectural review)
**Plan file**: `planning_notes/flag_improvements/PLAN.md`

---

## Root Cause — Confirmed Correct

`filter_target_flags` (game.rb:1025–1037) deletes `targetFlags` from every task before the client receives it. `handleFlagSubmission` checks `if (!task.targetFlags || ...)` — since `targetFlags` is always `undefined`, the condition is always true and the handler always returns early. Diagnosis is accurate.

The server-authoritative design (Option B) is the correct architectural choice. On reload, `restoreState()` already restores `task.submittedFlags` and `currentCount` for in-progress tasks (objectives-manager.js lines 104–110), confirming reload correctness.

---

## Corrections Applied to Plan

### 1. `aimId` Not Present on Raw Task Objects [Critical — Fixed]

Individual task hashes in `scenario_data['objectives']` do NOT have an `aimId` field. It exists only on the parent aim object. Original plan used `task['aimId'] || aim['aimId']` — the `task['aimId']` part is always nil and misleading.

`process_task_completion` expects a task with `aimId` (injected by `find_task_in_scenario`). The fix is to pass `task.merge('aimId' => aim_id)` explicitly.

**Fixed in plan:** method now uses `aim_id = aim['aimId']` and passes `task.merge('aimId' => aim_id)` to `process_task_completion`.

### 2. Public Method Placement [Critical — Fixed]

`process_flag_task_completions!` calls private methods `process_task_completion` and `check_aim_completion`. The method must be placed in the public section of `game.rb`, before the `private` declaration at ~line 890.

**Fixed in plan:** explicit placement note added.

### 3. Hacktivity Sequencing Was Incorrectly Described [Critical — Fixed]

The original plan stated: "if Hacktivity submission fails, task completion will also proceed." This is wrong. `submit_flag` in game.rb does `return result unless result[:success]` after the Hacktivity call — a failed Hacktivity submission causes the model method to return `{ success: false }`, the controller's success branch is never entered, and `process_flag_task_completions!` is never called.

**Fixed in plan:** Hacktivity note now correctly states task completion does not proceed if Hacktivity rejects the flag.

### 4. Save Order — Move `process_flag_task_completions!` After `process_flag_rewards` [Should Fix — Applied]

The plan originally placed the call between flag_id generation and `process_flag_rewards`. Moving it after `process_flag_rewards` makes the last `save!` the one from `process_flag_task_completions!`, which captures all in-memory state from the preceding steps, reducing the inconsistency window.

**Fixed in plan:** controller pseudocode now calls `process_flag_task_completions!` after `process_flag_rewards`.

### 5. `handleFlagSubmission` Stub — Explicit Form Added [Should Fix — Applied]

Plan said "simplified to a no-op or removed" without showing the result. The implementation spec now shows the explicit stub form.

**Fixed in plan:** stub form shown with explanatory comment.

---

## Additional Findings (Informational)

### Triple `save!` Chain Already Exists

The current `submit_flag` action already calls `save!` three times before the new method runs: once in `submit_flag` (model), once in `process_flag_rewards`, and again inside `process_event_reward` if that reward type fires. Adding a fourth `save!` from `process_flag_task_completions!` is consistent with existing behaviour. All operations work on the same in-memory `@game` object; the last save captures all accumulated state correctly.

### `complete_task!` Replaces vs. Merge

`complete_task!` (existing endpoint) replaces the entire task state hash, wiping `submittedFlags`. `process_flag_task_completions!` uses merge-style updates (`task_state['status'] = ...`), preserving `submittedFlags` in the final persisted state. This is strictly better than `complete_task!` for flag tasks.

### `objectives_completed` Column Side-Effect

`check_aim_completion` increments the `objectives_completed` column on the Game model when an aim completes. Tests should verify this counter is incremented correctly when `process_flag_task_completions!` drives completion.

### Duplicate Notification Risk — None

`handleFlagSubmission` is being gutted to a stub, so there is no risk of duplicate task-complete notifications firing from both the old and new paths.

---

## Verdict

Plan is sound after corrections. All critical issues addressed. Ready for implementation.
