# Testing Review — v3
## GameSlot Integration Plan — BreakEscape × Hacktivity (Revision 4)

**Reviewer:** Senior Rails QA Engineer
**Date:** 2026-03-30
**Plan reviewed:** `planning_notes/hacktivity_gamelisting_integration/plan.md` (Revision 4)
**Prior review:** `planning_notes/hacktivity_gamelisting_integration/reviews/testing_review_v2.md`

---

## Scope

This review focuses exclusively on the features introduced or revised in Revision 4: the `vm_activation_mode` enum on `BreakEscape::Mission` (Phase 1.4), the four new VM lifecycle controller actions (`vm_status`, `extend_vms`, `shutdown_vms`, `finish`) and the `start` action branching changes (Phase 4.4), the engine-side `vm_panel` action (Phase 1.6), and the Phaser VM HUD specification including lazy activation trigger (Phase 4.4.2). All findings from the v2 review have been addressed in Revision 3/4 and are not re-raised here.

---

## Findings

---

### TEST-v3-1: `vm_activation_mode` Validation Is Not in the BreakEscape Mission Test File

**Severity:** High
**Phase:** 1.4 / File Change Summary

**Finding:**
The plan adds `vm_activation_mode` with an inclusion validation to `BreakEscape::Mission`, and the File Change Summary lists `test/models/break_escape/mission_test.rb` as a file that will receive "tests for `vm_activation_mode` validation". However, the plan body contains no explicit test case list for Phase 1.4 — unlike Phase 1.5, which lists seven named cases for the `Game` model. The omission means the cases are undefined: a developer implementing Phase 1.4 has no specification for what exactly to test.

The existing `mission_test.rb` already covers `name` presence and uniqueness; it does not currently test enum values or defaults. Without a defined list, the most likely outcome is a minimal `assert mission.valid?` with no negative case, leaving the boundary behaviour (invalid mode string, nil mode, empty string) unverified.

**Recommendation:**
Add an explicit test case list to Phase 1.4 (or as a Phase 1.4 subsection) in the plan:

- `vm_activation_mode: 'eager'` → valid
- `vm_activation_mode: 'lazy'` → valid
- `vm_activation_mode: 'invalid_string'` → invalid, error on `vm_activation_mode`
- `vm_activation_mode: nil` → invalid (column is `null: false`, so this is a model-level guard)
- Default: a `Mission` created without specifying `vm_activation_mode` persists with value `'eager'`

The last case is important because the migration default (`default: 'eager', null: false`) means existing missions silently get `eager` behaviour; a test documenting this pinned default prevents an unintended change from going unnoticed.

---

### TEST-v3-2: `start` Action Eager/Lazy Branching Has No Negative Path in Phase 4.6

**Severity:** High
**Phase:** 4.6

**Finding:**
Phase 4.6 lists two cases for the `vm_activation_mode` branch in `start`:

> - `start` (eager mission): calls `extend_vms` inline after game creation → VM activated before redirect
> - `start` (lazy mission): does NOT call `extend_vms` inline — HUD triggers it later

The eager case verifies that `DispatchVmCtrlService.ctrl_vm_async` is called and `vm_set.activated` becomes `true`. However, neither case tests what happens when the `VmSet` lookup fails inside the eager activation block. The plan's code for eager activation reads:

```ruby
vm_set = ::VmSet.find_by(id: outcome.game.vm_set_id)
if vm_set
  vm_set.vms.each { |vm| DispatchVmCtrlService.ctrl_vm_async(vm, "activate", nil) }
  vm_set.update_columns(activated: true, allocated_date: Time.current)
end
```

If `find_by` returns `nil` (e.g. the VmSet was deleted between game creation and the activation step — a real possibility in a concurrent environment), the block is silently skipped. The game is still created and the redirect still fires. The player lands on the game page with a `vm_set_id` that no longer resolves. This scenario has no test case and no documented failure mode.

Additionally, there is no test for a VM-backed mission where the `VmSet` assignment succeeds but the mission is `eager` and the player has already been redirected once (e.g. a page reload that triggers a second `start` — this goes to the existing-game redirect path and bypasses eager activation entirely, which is correct, but is not explicitly verified).

**Recommendation:**
Add to Phase 4.6:

- `start` (eager, VmSet deleted between creation and activation): game is still created and redirect fires; `DispatchVmCtrlService` is NOT called; no exception raised. Document this as acceptable (the HUD's `vm_status` poll will surface the missing VmSet to the player).
- `start` (eager, VM-free mission): eager activation block is skipped entirely (no VmSet, no dispatch). This is the existing VM-free case, but make explicit that `vm_backed? == false` suppresses the activation block — not just the `extend_vms` call.

---

### TEST-v3-3: `vm_status` Test Cases Are Incomplete for the Lazy-Mode State

**Severity:** High
**Phase:** 4.6

**Finding:**
Phase 4.6 lists:

> - `vm_status`: returns JSON with `vm_activation_mode`, `activated`, `activated_until`, `vms`
> - `vm_status`: no active game → 404 JSON
> - `vm_status`: active game with no VmSet (VM-free) → `activated: false`, `vms: []`

The third bullet conflates two distinct scenarios:
1. A VM-free mission where `game.vm_set_id` is genuinely nil (no VmSet was ever assigned).
2. A lazy-mode VM-backed mission immediately after start, before the client has called `extend_vms` — the `vm_set_id` is present, the VmSet exists, but `activated: false`.

The Phaser HUD reads `vm_activation_mode` from this endpoint to decide whether to show the grey "not yet activated" icon (lazy, unactivated) or the red "powered off" icon (activated but VMs are down). This distinction drives visual state and player behaviour. A test that only covers the nil-VmSet variant does not verify that a valid lazy VmSet is returned with `activated: false` and `vm_activation_mode: 'lazy'`.

There is also no test for the response shape when `VmSet.find_by` returns `nil` even though `game.vm_set_id` is non-nil (deleted VmSet). The controller code falls through to the no-VmSet render branch, returning `activated: false, vms: []`. This is correct behaviour, but the test list does not distinguish it from the VM-free case, so a regression that drops the `vm_activation_mode` key from this branch would not be caught.

**Recommendation:**
Split and extend the Phase 4.6 `vm_status` cases:

- `vm_status` (VM-backed, lazy, not yet activated): `activated: false`, `vm_activation_mode: 'lazy'`, `vms` array present with correct titles
- `vm_status` (VM-backed, lazy, activated): `activated: true`, `activated_until` non-nil, `vm_activation_mode: 'lazy'`
- `vm_status` (VM-backed, eager, activated): `activated: true`, `vm_activation_mode: 'eager'`
- `vm_status` (VM-free mission, no VmSet): `activated: false`, `vms: []`, `vm_activation_mode: 'eager'` (the default)
- `vm_status` (VmSet deleted post-creation): same shape as VM-free — confirm `vm_activation_mode` key is present

---

### TEST-v3-4: `extend_vms` Double-Activation (Idempotency) Is Not Tested

**Severity:** High
**Phase:** 4.4.1 / 4.6

**Finding:**
The plan describes `extend_vms` as serving two roles: activating VMs on the first call and extending the quota timer on subsequent calls. Phase 4.6 lists:

> - `extend_vms`: activates VMs, returns `activated_until`; no active game → 422

This single positive case covers only first activation. There is no test for:

1. **Repeated calls (idempotency):** Calling `extend_vms` when `vm_set.activated` is already `true` should extend `activated_until` and re-dispatch `activate` to each VM. A test is needed to confirm the action does not error out or perform a no-op in this state. The plan's Known Limitations section defers a quota check on extension — without a test, a regression that starts rejecting already-activated VmSets (e.g. a future quota guard) would be invisible until production.

2. **Lazy trigger with already-activated VmSet:** The Phaser client fires `extend_vms` on first `requiresVM` interaction. If the player navigates away and back (reloading the game page), `vmsActivated` is re-initialised from `vm_activation_mode`, not from server state. On lazy missions this means a second first-touch will call `extend_vms` again on an already-activated VmSet. This is correct (it's an extension, not an error), but the test suite does not verify the response remains `{ ok: true, activated_until: ... }` rather than an error.

**Recommendation:**
Add to Phase 4.6:

- `extend_vms` called on already-activated VmSet: returns `ok: true` and updated `activated_until`; `DispatchVmCtrlService.ctrl_vm_async` called again (re-activate / extend)
- `extend_vms` (VM-free game, no VmSet assigned): 422 with `"No VmSet found"` — this is the correct path but is only implied by the existing "no active game → 422" case and should be split out

---

### TEST-v3-5: `finish` Action Has No Test for the Scoring Callback Interaction

**Severity:** High
**Phase:** 4.4.1 / 4.6

**Finding:**
The `finish` action sets `game.status = 'completed'` inside a transaction. This change triggers the `after_commit` callback `fire_completion_callback` → `GameCompletionScoringJob.perform_later`. This is the primary scoring path for player-initiated completion (as opposed to narrative completion via the engine).

Phase 4.6 lists:

> - `finish`: marks game completed, relinquishes VmSet, dispatches stop; returns `redirect_url`
> - `finish`: game already completed → 422 (no active in_progress game found)
> - `finish`: VM-free mission → marks game completed without VmSet dispatch

None of these cases assert that `GameCompletionScoringJob` is enqueued. Without this assertion, a change that accidentally wraps the `game.update!` in a context that suppresses `after_commit` (e.g. moving it inside a `save` that gets rolled back) would pass the test suite while silently breaking scoring for all player-initiated completions.

The `finish` action is the only completion path that combines a controller action (Hacktivity) with an engine callback (BreakEscape) and a job (Hacktivity). The cross-layer chain is precisely the kind of integration that automated tests must verify.

**Recommendation:**
Add to Phase 4.6:

- `finish` (VM-backed): after the action, assert `GameCompletionScoringJob` is enqueued with the correct `game.id` and `vm_set_id` (use `assert_enqueued_with`)
- `finish` (VM-free): assert `GameCompletionScoringJob` is NOT enqueued (lambda guards on nil `vm_set_id`)

---

### TEST-v3-6: `vm_panel` Action Has No Test Cases in the Plan

**Severity:** High
**Phase:** 1.6

**Finding:**
Phase 1.6 specifies the `vm_panel` engine action in detail, with five distinct early-return paths:

1. `!BreakEscape::Mission.hacktivity_mode? || !@game.vm_set_id` → `head :not_found`
2. `VmSet.find_by(id: @game.vm_set_id)` returns nil → `head :not_found`
3. `vm_set.vms.find_by(title: params[:vm_title])` returns nil (named VM not found) → `head :not_found`
4. No `vm_title` param and `vm_set.vms.first` is nil (empty VmSet) → `head :not_found`
5. Happy path: redirect to nested Hacktivity VM path with `embedded: 1`

The File Change Summary lists `app/controllers/break_escape/games_controller.rb` as a changed file, and the plan specifies adding `vm_panel` to the `before_action` list — but there is no test file or test case list for this action anywhere in the plan. The existing `test/controllers/break_escape/games_controller_test.rb` tests actions like `show`, `scenario`, `sync_state`, and `reset`, but `vm_panel` is entirely absent.

This is a Critical gap in standalone engine testing: the engine will now contain a cross-application redirect (to a Hacktivity-hosted URL) that can only be exercised under specific conditions. All four `not_found` branches and the redirect itself are untested.

**Severity upgraded to High** because the action also uses `Rails.application.routes.url_helpers` (the host application's helpers, not the engine's own), making it a cross-engine routing call. Errors here are harder to detect at review time and fail silently as a 404 in production.

**Recommendation:**
Add a test section to Phase 1.6 (or Phase 1.5 tests). The test location should be in `test/controllers/break_escape/games_controller_test.rb`, using a setup that stubs `BreakEscape::Mission.hacktivity_mode?` to return true and provides a game with a vm_set_id. Cases needed:

- Standalone mode (`hacktivity_mode? == false`): 404
- Hacktivity mode, game has no `vm_set_id`: 404
- Hacktivity mode, game has `vm_set_id`, VmSet not found: 404
- Hacktivity mode, `vm_title` param present, VM not found by title: 404
- Hacktivity mode, no `vm_title` param, VmSet has no VMs: 404
- Happy path, `vm_title` provided: redirect to correct Hacktivity VM path including `?embedded=1`
- Happy path, no `vm_title` param: redirect uses `vms.first`
- Authorization: another player's game → Pundit denial (consistent with other engine actions)

Because `defined?(::VmSet)` is a runtime guard, the dummy app test environment needs a note on how `VmSet` will be stubbed or whether a minimal `VmSet` model stub is needed in `test/dummy/`. The plan should address this.

---

### TEST-v3-7: Lazy Activation Trigger (Client-Side) Has No Defined Test Strategy

**Severity:** Medium
**Phase:** 4.4.2

**Finding:**
The plan specifies the lazy trigger logic in detail (the `vmsActivated` boolean, the pre-interaction check, the POST to `extend_vms`, the error notification path). The File Change Summary lists four JavaScript files as new or changed. However, the plan contains no test strategy for any of the Phaser HUD JavaScript:

- No mention of a JS test framework (Jest, QUnit, Vitest, or other)
- No unit test cases for the `VmHud` component or the lazy trigger
- No integration test cases for the `vm-launcher-minigame.js` iframe branch
- The review scope explicitly calls out "Is the lazy activation trigger (client-side) testable? What approach does the plan recommend?" — the plan is silent on this

The lazy trigger is behaviorally complex: it intercepts `requiresVM` interactions, performs an async POST, handles success and error responses, updates client-side state, and then re-dispatches the original interaction. A regression in any of these steps (e.g. `vmsActivated` not being set on success, or the original interaction being dropped on error) would only be caught by a smoke test.

The engine's existing `test/` directory contains no JS test infrastructure, which makes this a gap to acknowledge and address rather than simply add test cases to.

**Recommendation:**
Add a testing note to Phase 4.4.2. Minimum viable approach:

- If no JS test framework is present, add a note that the lazy trigger and HUD component should be covered by the Phase 8 smoke test (Step 10 already partially covers this), and that a JS unit test framework should be introduced in a separate PR.
- If Jest or similar is introduced (recommended), add a Phase 4.7 for JS unit tests covering: `VmHud` polling (mock `fetch`), lazy trigger success path (sets `vmsActivated = true`, dispatches original interaction), lazy trigger error path (shows notification, does not dispatch interaction), and the iframe branch in `buildUI()` (correct `src` composition with `vm_title` encoding).
- The smoke test in Phase 8 Step 10 should be retained regardless as a sanity check, but it cannot substitute for the async error path.

---

### TEST-v3-8: `finish` Does Not Test Transaction Rollback When `game.update!` Fails

**Severity:** Medium
**Phase:** 4.4.1 / 4.6

**Finding:**
The `finish` action wraps `game.update!(status: 'completed')` and `vm_set.update_columns(relinquished: true)` in a single `ApplicationRecord.transaction`. If `game.update!` raises (e.g. a validation failure or a database error), the transaction rolls back and the VmSet is not relinquished. This is correct.

However, there is the opposite risk: `vm_set.update_columns` bypasses ActiveRecord validations and callbacks and cannot raise a validation error — but it can raise a database error. More importantly, `DispatchVmCtrlService.ctrl_vm_async` is called inside the transaction. If that call raises synchronously (network timeout on a synchronous adapter, or a bug in the service), the transaction rolls back and the game is not marked completed. The player's HUD receives an unexpected 422 or 500, and the game remains `in_progress`.

Phase 4.6 lists no test for failure inside `finish`'s transaction block, nor any test for the response when `DispatchVmCtrlService` raises.

**Recommendation:**
Add to Phase 4.6:

- `finish`: `game.update!` raises `ActiveRecord::RecordInvalid` → transaction rolled back, VmSet NOT relinquished, response is 422 (or appropriate error JSON). Document the expected behaviour explicitly — currently the action renders `json: { ok: true }` only on success; there is no rescue or explicit error render on exception, so the current code would return a 500. The plan should clarify whether this is acceptable or whether a rescue block is needed.

This finding also flags a code design gap: the `finish` action has no `rescue` block around the transaction, meaning any exception surfaces as a 500 to the Phaser client. The Phaser HUD's error handling for `finish` needs to handle non-2xx responses. The plan's HUD specification mentions "prompts confirmation" and "On success, navigates to `redirect_url`" but does not specify what the client should do on a non-OK response.

---

### TEST-v3-9: `shutdown_vms` Has No Test for Partial Dispatch Failure

**Severity:** Medium
**Phase:** 4.4.1 / 4.6

**Finding:**
The `shutdown_vms` action iterates `vm_set.vms.each` and calls `DispatchVmCtrlService.ctrl_vm_async(vm, "stop", nil)` per VM. Unlike `finish`, this action has no transaction boundary. If the dispatch call for VM #2 raises after VM #1 has already received a stop command, VM #1 is stopped and VM #2 is not. The action currently has no rescue block, so the exception bubbles to a 500.

Phase 4.6 lists only:

> - `shutdown_vms`: dispatches stop to each VM; no active game → 422

There is no test for the partial failure scenario and no test verifying how many VMs received the dispatch. Additionally, there is no test confirming that `shutdown_vms` on a VM-free game (no VmSet) returns a clear 422 rather than a 500 — the code guards on `vm_set` being nil, but the "no VmSet found" path is not in the test list.

**Recommendation:**
Add to Phase 4.6:

- `shutdown_vms` (VM-backed): verify `DispatchVmCtrlService.ctrl_vm_async` is called once per VM (stub the service and assert call count = `vm_set.vms.count`)
- `shutdown_vms` (active game, no VmSet — e.g. VM-backed game whose VmSet was deleted): returns 422 with `"No VmSet found"` (split from the "no active game" 422 case)

The partial-dispatch failure concern is an implementation design gap rather than a test gap alone — add a note in the plan suggesting a rescue block in `shutdown_vms` that logs partial failures without surfacing a 500 to the client.

---

### TEST-v3-10: Smoke Test Steps 5 and 10 Do Not Verify `vm_activation_mode` Column After Migration

**Severity:** Low
**Phase:** 8.2

**Finding:**
Smoke test Step 5 covers the eager mission path ("click Start Mission on an eager mission") and Step 10 covers the lazy mission path. Both verify runtime behaviour but neither includes a console verification that `BreakEscape::Mission.first.vm_activation_mode` returns the expected value after the migration has run. In a production deploy where the migration runs but the server is not restarted (a common ops mistake), the column exists but the AR model cache may not include the new attribute. A smoke step that reads the value directly from the DB confirms the migration ran and the column is populated with the default.

**Recommendation:**
Add to Phase 8.2 Step 5 (or as a pre-step):

- In Rails console: `BreakEscape::Mission.where(vm_activation_mode: nil).count` → should be 0 (migration default applied to all rows). Note: with `null: false` and a column default this should always be 0, but verifying it catches a migration that ran without the `default` clause.
- `BreakEscape::Mission.find_by(name: 'your_test_mission').vm_activation_mode` → `'eager'` (confirms the column default for existing records, not just newly created ones)

---

### TEST-v3-11: `vm_panel` Fixture Gap — Engine Test Dummy Lacks VmSet and VM Models

**Severity:** Low
**Phase:** 1.6

**Finding:**
The `vm_panel` action in the engine uses `defined?(::VmSet)` as a runtime guard and then calls `::VmSet.find_by(id: @game.vm_set_id)`. In the engine's own test suite (run against the dummy app in `test/dummy/`), `VmSet` is not defined — Hacktivity's models are not loaded.

The plan does not address how `vm_panel` will be tested in the engine's test suite. The two options are:

1. Test `vm_panel` only in the Hacktivity test suite (where VmSet is available), treating the action as integration-only.
2. Add a minimal `VmSet`/`Vm` stub to the engine's dummy app (as `test/dummy/app/models/vm_set.rb`), sufficient for the `find_by` and `vms` calls.

Option 1 means that changes to the engine's `vm_panel` action are not protected by the engine's own fast-running unit tests — they can only be caught by running Hacktivity's full test suite. Option 2 adds maintenance burden (the stub must mirror the real model's interface).

The plan is currently silent on which approach is intended, which will cause confusion during implementation.

**Recommendation:**
Add a note to Phase 1.6.5 (File changes) or Phase 1.5 (Tests):

Explicitly state the test strategy: either "`vm_panel` is tested only in the Hacktivity controller test suite; the engine's `games_controller_test.rb` covers all other actions" (Option 1, acceptable if stated), or describe the dummy stub approach (Option 2). If Option 1 is chosen, the Phase 4.6 test list should explicitly include the `vm_panel` cases (moving them from the finding above into Phase 4.6 rather than Phase 1.5).

---

### TEST-v3-12: No Test for `vm_panel` Called Without a `vm_set_id` on a VM-Backed Game

**Severity:** Low
**Phase:** 1.6 / 4.6

**Finding:**
This edge case was flagged in the review scope as requiring explicit coverage: `vm_panel` called when the game record exists but `vm_set_id` is nil.

The action guards: `return head :not_found unless BreakEscape::Mission.hacktivity_mode? && @game.vm_set_id`. If `vm_set_id` is nil (e.g. the game was created before the backfill migration ran, or the `sync_vm_set_id_column` callback did not fire correctly), the action returns 404.

This is correct behaviour, but the test list in the plan (which is currently empty for `vm_panel`) needs to include this case explicitly. It is the most likely failure mode for a game created in the window between deploying Phase 1 and running the migration, or in any test setup that creates a `Game` with a `player_state` vm_set_id but does not populate the column.

**Recommendation:**
Include in the `vm_panel` test case list (wherever it is placed per TEST-v3-6 recommendation):

- `vm_panel` with `@game.vm_set_id == nil` and `hacktivity_mode? == true`: returns 404
- `vm_panel` with `vm_set_id` present but `vm_title` param absent and `VmSet` has no VMs: returns 404 (not a 500)

---

## Summary

Revision 4 is a substantial addition to an already well-structured plan. The VM lifecycle endpoint specification is detailed and correct, the eager/lazy branching is clearly described, and the existing v2 findings are all resolved. The 11 Phase 4.6 test cases represent a reasonable starting point, but significant gaps remain for the new Revision 4 material.

**Findings by severity:**

| Severity | Count | Findings |
|---|---|---|
| Critical | 0 | — |
| High | 6 | TEST-v3-1, TEST-v3-2, TEST-v3-3, TEST-v3-4, TEST-v3-5, TEST-v3-6 |
| Medium | 3 | TEST-v3-7, TEST-v3-8, TEST-v3-9 |
| Low | 3 | TEST-v3-10, TEST-v3-11, TEST-v3-12 |

**Items that must be resolved before implementation begins:**

1. **(TEST-v3-6)** The `vm_panel` action has zero test coverage in the plan. This is the most complete gap: five distinct code paths, cross-engine routing, and no specified test file. Add the test case list and clarify the dummy-app strategy before Phase 1.6 is implemented.

2. **(TEST-v3-5)** The `finish` action's scoring callback integration must be verified with `assert_enqueued_with`. This is the only cross-engine scoring path for player-initiated completion and cannot be verified through unit tests alone.

3. **(TEST-v3-3)** The `vm_status` test cases conflate VM-free and lazy-unactivated states. Split these to cover the `vm_activation_mode` key in all response shapes — this key drives the HUD icon colour and player experience.

4. **(TEST-v3-4)** `extend_vms` idempotency (already-activated VmSet) is a real-world case (page reload on lazy missions) with no test. Add before implementation of Phase 4.4.

5. **(TEST-v3-1)** The `vm_activation_mode` validation test cases need to be explicitly enumerated in Phase 1.4, not left implicit in the File Change Summary.

6. **(TEST-v3-2)** The `start` action eager/lazy branching needs negative paths: the nil-VmSet-at-activation case and the VM-free + eager case.

**Items that can be addressed during implementation (Low/Medium):**

TEST-v3-7 (JS test strategy), TEST-v3-8 (`finish` transaction failure behaviour), TEST-v3-9 (`shutdown_vms` partial dispatch), TEST-v3-10 (smoke test migration verification), TEST-v3-11 (dummy app VmSet strategy), and TEST-v3-12 (`vm_panel` nil vm_set_id edge case) are all real gaps but do not block the implementation gate if the High findings are resolved first.

The overall phase structure, gate sequencing, and cross-engine fixture strategy remain sound. The plan is not yet implementation-ready for Revision 4 content: the six High findings above should be addressed by adding test case lists to the plan document before the corresponding phases are implemented.
