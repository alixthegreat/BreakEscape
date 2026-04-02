# Testing Strategy Review
## MissionListing Integration Plan — BreakEscape x Hacktivity

**Reviewer:** Senior Rails Testing Engineer
**Date:** 2026-03-28
**Plan reviewed:** `planning_notes/hacktivity_gamelisting_integration/plan.md`

---

## Summary Verdict

The plan's test coverage is a reasonable starting skeleton, but it has several material gaps that create real regression risk. The most serious are: (1) the Phase 2 refactor gate relies solely on existing controller tests that exercise the individual-user path only indirectly, which is insufficient before extracting `VmSetAssignmentService`; (2) `MissionListingsController#start` is missing tests for the race condition that allows duplicate game creation; (3) the `on_game_complete` scoring hook has no automated test at all for the Hacktivity side of the callback; and (4) the cross-engine boundary (Hacktivity creating `BreakEscape::Game`) is not addressed in the test plan at all, leaving the most novel integration point untested at the unit level.

These gaps are fixable without major architectural changes to the test approach. The overall phase ordering is sound; the issues are gaps in coverage within phases, not a sequencing problem.

---

## Findings

---

### Finding 1 — Phase 2 Refactor Gate Is Insufficient

**Severity: High**

**Observation:**
The plan treats the existing `SecGenBatchesControllerTest` assign_vm_set tests as the sole safety net for the Phase 2 service extraction. Reading those tests (lines 283–450), they cover six controller-level scenarios: team-shared success, team-shared none-available, start-time check (team path), individual success, individual none-available, already-assigned (quota per batch), global ownership quota, and wait-time quota. They exercise behaviour end-to-end through the controller, which is valuable, but they have a critical limitation: all quota-check logic is exercised via database state manipulation inline in the test setup. If the extracted service introduces a subtle argument-passing error — for instance, passing `event` when the quota check expects `sec_gen_batch.event`, or misreading `max_vm_set_requests` because the `@sec_gen_batch` reference changed — the controller test may still pass because it validates the redirect and flash, not the internal decision path.

More concretely: the controller's individual-user block (lines ~220–302 of the source) contains multiple early-return branches. At extraction time, each branch becomes a method boundary. Without characterization tests that pin the exact inputs and outputs of each branch before the refactor, a developer renaming or reordering private methods has no fast feedback cycle.

The plan does call for `VmSetAssignmentService` unit tests *after* the refactor (Phase 2.4), but at that point you are writing tests to verify code you just wrote, which provides weak regression assurance.

**Recommendation:**
Write characterization tests for `VmSetAssignmentService` *before* extracting it, treating the existing controller code as the specification. Specifically, for each guard clause in the individual-user path, add a test that directly calls the to-be-extracted logic (stubbing only external calls like `GaService.track_event`). This gives you a failing test suite immediately if the extraction changes observable behaviour. The pattern already exists in the codebase for `StripeService` (Hacktivity uses Mocha stubs with `expects` for external services), so the idiom is familiar.

---

### Finding 2 — Race Condition / Duplicate Game Creation Has No Test

**Severity: High**

**Observation:**
`MissionListingsController#start` checks for an existing in-progress game via `@mission_listing.active_game_for(current_user)` and redirects if one is found. However, this check is not atomic: if a user double-submits the form (network retry, double-click, or a parallel browser tab), two requests can both pass the `existing_game` check before either has committed a game to the database. The result is two `BreakEscape::Game` records for the same user+mission, and potentially two `VmSetAssignmentService` calls, which could assign two VmSets to one user.

The plan lists "User signed up: existing in-progress game → redirects without creating new game" as a test case, but that is a sequential scenario. The concurrent case is absent.

The plan's architecture section notes that `active_game_for` just queries by `player+mission+status`. There is no database-level uniqueness constraint proposed for `(player_id, mission_id)` with `status = 'in_progress'`, and no pessimistic lock or `find_or_create_by` pattern proposed in the controller.

**Recommendation:**
Add a database-level partial unique index on `break_escape_games (player_id, mission_id) WHERE status = 'in_progress'` as part of Phase 1, or add an `allow_only_one_active_game` validation to `BreakEscape::Game`. Then add a test in `MissionListingsController` that simulates the race: stub `active_game_for` to return `nil` on both calls (simulating two simultaneous reads before the first write), call `start` twice on the same listing, and assert that only one `BreakEscape::Game` and one `VmSet` assignment exist. Using Minitest's `assert_difference "BreakEscape::Game.count", 1` wrapped around two sequential POST calls is a reasonable proxy for the concurrent case in a unit test context.

---

### Finding 3 — on_game_complete Scoring Hook Has No Automated Test in Hacktivity

**Severity: High**

**Observation:**
Phase 7 configures the `on_game_complete` lambda in `config/initializers/break_escape.rb`. This lambda touches four systems: `game.player_state`, `VmSet`, `Result`, and `result.calculate`. The plan's Phase 8 summary mentions "scoring callback integration (may require test fixtures for BreakEscape::Game)" but no specific test cases are listed, and the word "may" suggests this is not firmly committed.

`ResultTest` in Hacktivity currently has a `skip("TODO")` for `should "calculate"`. This means the most critical downstream method — the one that converts vm_set scores into a user's event result — has no test coverage at all. Shipping the scoring hook without covering `Result#calculate` means a silent miscalculation will not be caught by the test suite.

The BreakEscape side is also incomplete: Phase 1.3 specifies tests that `fire_completion_callback` is called on status change, but it does not test what happens when the callback raises an exception (e.g. `VmSet.find_by` returns nil because the vm_set was deleted). An unhandled exception in an `after_save` callback will roll back the save.

**Recommendation:**
(a) In Hacktivity, add a dedicated test for the `on_game_complete` lambda itself. Since the lambda is a plain callable, it can be extracted to a named class/service method and tested in isolation with stubbed `VmSet` and `Result` objects. Test: success path, `vm_set_id` nil (VM-free game — lambda should exit cleanly), `VmSet` not found (should not raise), score already non-zero (should not overwrite), `result` not found (should not raise).

(b) Write the `Result#calculate` test that is currently marked `skip("TODO")`. Without it, the scoring integration cannot be considered tested.

(c) In BreakEscape `game_test.rb`, add a test that the callback being nil (default config) does not raise, and a test that a callback that raises does not silently swallow the error (or confirm the desired error-handling policy is documented and tested).

---

### Finding 4 — Cross-Engine Test Strategy Is Undefined

**Severity: High**

**Observation:**
The plan never addresses how Hacktivity's test suite should handle the `BreakEscape::Game` constant. In `MissionListingsController#start`, Hacktivity directly calls `BreakEscape::Game.create!`. In the test environment, this requires the BreakEscape engine to be mounted and its tables to exist in the test database. The existing BreakEscape tests use `break_escape_demo_users` fixtures and the `BreakEscape::` namespace directly (both `game_test.rb` and `games_controller_test.rb` use `Game.create!` without any stubbing). This means the engine is fully loaded in its own test suite.

However, when running Hacktivity's test suite, the situation is different. If BreakEscape is a gem dependency mounted in Hacktivity's `config/application.rb`, then `BreakEscape::Game` should be available and the `break_escape_games` table should exist in the test DB after `db:test:prepare`. But this is never stated or verified in the plan. The plan's Phase 4.5 controller test list includes "User signed up: starts VM-backed mission (assigns vm_set, creates game, redirects)" which would fail if the engine tables do not exist.

The plan also does not address whether Hacktivity needs fixtures for `BreakEscape::Mission` to satisfy the `belongs_to :break_escape_mission` reference in `MissionListing`, which would be needed for every `MissionListing` controller test.

The existing codebase gives no precedent: no existing Hacktivity test touches a BreakEscape model. This is genuinely new territory.

**Recommendation:**
The plan should explicitly state the cross-engine test strategy. Based on the codebase patterns observed, there are three viable options:

1. **Full integration (preferred for controller tests):** Treat BreakEscape as a mounted engine with its tables present in the test DB. Add `break_escape_missions` and `break_escape_demo_users` fixture files to Hacktivity's `test/fixtures/` directory (or use FactoryBot factories mirroring the ones that already exist in the engine). Controller tests then create real `BreakEscape::Game` records. This matches how `GamesControllerTest` works in the engine.

2. **Stub at the boundary (acceptable for unit tests):** In `MissionListingsController` unit tests, stub `BreakEscape::Game.create!` via Mocha (`BreakEscape::Game.expects(:create!).returns(stub(id: 1))`). This avoids the cross-DB dependency but means the integration between the controller and the engine model is never exercised in Hacktivity's suite.

3. **Service object to encapsulate creation:** Extract the `BreakEscape::Game.create!` call into a small service (e.g. `GameCreationService`) that can be stubbed entirely. This is the cleanest separation but adds an abstraction layer.

The plan should pick one strategy and document it. Option 1 is strongly recommended for controller tests because it is consistent with how both test suites already work. Option 2 is acceptable as a fallback if the engine tables are not reliably migrated in CI.

---

### Finding 5 — MissionListingPolicy Has No Test File in the Plan

**Severity: Medium**

**Observation:**
The plan adds `MissionListingPolicy` with `start?`, `restart?`, `create?`, `update?`, `destroy?` methods, and references `signed_up_to_event?` and `listing_available?` as private helpers. The file change summary includes `test/controllers/mission_listings_controller_test.rb` but does not list `test/policies/mission_listing_policy_test.rb`.

The existing codebase has `test/policies/event_policy_test.rb` which tests policy methods directly via `assert_permit`/`refute_permit` helpers (a pattern from the `pundit-matchers` or equivalent support module). Policy tests are fast, isolated, and provide precise documentation of authorization rules. The controller tests listed in Phase 4.5 do include "User not signed up cannot start" and "Mission not yet released: start denied", but these are integration-level checks. If the policy logic is wrong, controller tests will catch it, but without a dedicated policy test it is hard to tell exactly which policy method is failing.

Notably, `start?` depends on both `signed_up_to_event?` and `listing_available?`, and `listing_available?` allows admins to start even unreleased missions. The admin bypass on `listing_available?` is a non-obvious security rule that deserves its own policy test.

**Recommendation:**
Add `test/policies/mission_listing_policy_test.rb` to the plan covering at minimum: signed-up user + available listing (permit start), non-signed-up user (deny), signed-up user + unreleased listing (deny for regular user), admin + unreleased listing (permit), admin CRUD permissions. Follow the pattern established in `event_policy_test.rb`.

---

### Finding 6 — MissionListing#active_game_for Is Undertested

**Severity: Medium**

**Observation:**
`MissionListing#active_game_for` is the model method that prevents duplicate game creation and drives the "resume" redirect. The plan lists it as a test case in `test/models/mission_listing_test.rb` ("active_game_for returns correct game or nil"), but the implementation in the plan has an intentional gap: the comment `# Simplest: just find the most recent in_progress game for user+mission` suggests the VM scoping is not yet resolved. The query does not filter by `vm_set_id`, meaning a user who previously played the same mission in a different event context could be incorrectly resumed into the wrong game.

Beyond the correctness question, the test cases listed for the model do not include: game found but status is 'completed' (should return nil), game found but status is 'abandoned' (should return nil), multiple in_progress games for same user+mission (should return most recent), and the VM-backed variant where vm_set_id matters.

**Recommendation:**
Expand the `active_game_for` test cases in `test/models/mission_listing_test.rb` to cover each game status variant explicitly. Consider also adding a test that exercises the behaviour when the same mission appears in two different events — this edge case directly affects whether `active_game_for` should scope by event or by vm_set_id. Resolving the implementation gap noted in the plan comment (the `# Simplest` note) should be a prerequisite before writing the model test, otherwise the test will encode the wrong behaviour.

---

### Finding 7 — VmSetAssignmentService: GA4 Tracking Call Is Not Tested

**Severity: Medium**

**Observation:**
The plan notes that GA4 tracking is extracted into the service (`# GA4 tracking` in the service pseudo-code). The service unit tests listed in Phase 2.4 cover all the business-logic outcomes (success, quota errors, no available vm_set, parent pool fallback) but do not include a case verifying that `Ga4Service.track_event` is called on a successful assignment and not called on error paths.

The existing `MissionListingsController#start` code in the plan also calls `Ga4Service.track_event` directly (after the game is created), separate from whatever the service might call internally. This means GA4 calls could be duplicated if the service also tracks internally and the controller adds another call. The plan does not clarify this boundary.

**Recommendation:**
Add an explicit test for `VmSetAssignmentService` that verifies GA4 is tracked on success and not on error paths, using Mocha's `expects(:track_event).once`. Separately, audit whether GA4 tracking belongs in the service or the controller, and document the decision. Duplicate GA4 calls on a single "start mission" action will produce inflated analytics.

---

### Finding 8 — No Tests for hidden_from_players on EventsController/View

**Severity: Medium**

**Observation:**
Phase 3.2 adds `hidden_from_players` to `SecGenBatch` and Phase 5.3 adds a guard in the view (or the controller query). The plan's test coverage for Phase 3 lists only `MissionListing` model tests. There is no test case for `EventsController#show` that verifies: (a) hidden batches do not appear in the rendered HTML for regular users, (b) hidden batches do appear for admins, and (c) the `hidden_from_players: false` scope is applied to the batch query.

The `SecGenBatchesControllerTest` pattern (which uses `assert_select` to check rendered content) is the correct model for this. Without it, the visibility guard is easy to accidentally remove in a view refactor.

**Recommendation:**
Add to the test plan an entry for `test/controllers/events_controller_test.rb` covering `show` for a game-type event with: at least one hidden batch (regular user sees zero batches in the batch list), same event for an admin (admin sees the hidden batch). This is low-effort given that `events_controller_test.rb` already exists in Hacktivity.

---

### Finding 9 — Phase Ordering Is Correct But Phase 7 Tests Are Deferred Too Late

**Severity: Low**

**Observation:**
The phase ordering (baseline -> engine changes -> service extraction -> models -> controller -> views -> scoring) is logical from a dependency perspective. However, Phase 7 (scoring hook) is tested only in Phase 8's final pass, and the plan acknowledges the tests "may require test fixtures for BreakEscape::Game" without resolving that question. This means the scoring integration could reach Phase 8 with a broken test setup and block the final pass.

The scoring hook depends on Phase 1 (`on_game_complete` callback in the engine), Phase 3 (`MissionListing` and `Result`), and the initializer config. All prerequisites are in place before Phase 7. There is no reason the scoring tests cannot be written during Phase 7 rather than deferred to Phase 8.

**Recommendation:**
Move the scoring callback tests into Phase 7 itself. Treat Phase 8 as a "run all tests green" gate only, not a place where new tests are written. This is consistent with the Phase 2 pattern (tests written in 2.4 immediately after the refactor). Confirm the fixture strategy for `BreakEscape::Game` in Hacktivity's suite (see Finding 4) before starting Phase 7 to avoid blocked progress.

---

### Finding 10 — Smoke Test Checklist Has Gaps

**Severity: Low**

**Observation:**
The manual smoke test checklist (Phase 8) covers the main happy paths but is missing several failure modes and edge cases that are realistic in production:

1. There is no step for verifying that a `hidden_from_players: true` batch does not appear in the normal challenge list when navigating to a non-game event (regression for existing users).
2. There is no step for the "mission not yet released" state: visiting the event before `release_at` should show "Coming soon" rather than a functional start button.
3. There is no step confirming that completing the game narrative (status → 'completed') actually triggers the Result update — the checklist checks "complete a flag challenge" (step 6) and "complete game narrative" (step 7) but does not explicitly direct the tester to check `Result.find_by(user:, event:).score` in the console or UI.
4. There is no step for verifying the admin cannot accidentally expose a hidden batch by toggling `hidden_from_players` back to false on a batch already linked to a `MissionListing`.
5. The "repeat with VM-free MissionListing" step (step 9) does not include a corresponding "complete the game" sub-step. VM-free scoring is deferred per the plan, but the smoke test should at least confirm that completing a VM-free game does not raise an error (the lambda exits at `next unless vm_set_id`).

**Recommendation:**
Expand the smoke test checklist with the five points above. Steps 3 and 5 in particular are easy to overlook and touch the most novel integration code.

---

## Overall Assessment

The plan's test strategy identifies the right test files and most of the right scenario categories. The foundations — fixture-based Minitest with Shoulda matchers in Hacktivity, inline `Game.create!` setup in BreakEscape — are well established and should be followed consistently.

The critical work needed before implementation begins is:

1. Write characterization tests for the existing individual-user assignment logic in `SecGenBatchesController` before touching it (Finding 1). This is the most important pre-condition for a safe Phase 2.
2. Decide and document the cross-engine test strategy for Hacktivity creating `BreakEscape::Game` (Finding 4). This decision affects how every Phase 4 controller test is written.
3. Add a `Result#calculate` test to cover the scoring path (Finding 3b). This is currently a `skip("TODO")` and represents a blind spot in the existing suite that this integration depends on.

Findings 2, 5, 6, 7, 8, and 9 are straightforward additions to the test plan that can be addressed as the respective phases are implemented. None require architectural changes.
