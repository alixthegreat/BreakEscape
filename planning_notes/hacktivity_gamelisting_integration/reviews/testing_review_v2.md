# Testing Strategy Review — Second Pass
## MissionListing Integration Plan — BreakEscape x Hacktivity (Revision 2)

**Reviewer:** Senior Rails Testing Engineer
**Date:** 2026-03-28
**Plan reviewed:** `planning_notes/hacktivity_gamelisting_integration/plan.md` (Revision 2)
**Prior review:** `planning_notes/hacktivity_gamelisting_integration/reviews/testing_review.md`

---

## Resolution Status of Original Findings

| # | Finding | Severity | Status | Notes |
|---|---|---|---|---|
| 1 | Phase 2 Refactor Gate Is Insufficient | High | **Resolved** | Phase 2.2 adds explicit characterization tests written before extraction, with a complete table of guard-clause cases. Gates 1–3 are clearly sequenced. |
| 2 | Race Condition / Duplicate Game Creation Has No Test | High | **Resolved** | Partial unique index added in Phase 1.1 migration. `rescue ActiveRecord::RecordNotUnique` path added to controller. Controller test "Race condition guard: `RecordNotUnique` rescued, redirects to existing game" explicitly listed in Phase 4.5. |
| 3 | `on_game_complete` Scoring Hook Has No Automated Test | High | **Resolved** | `GameCompletionScoringJob` with five test cases in Phase 7.4. Lambda behaviour (enqueue vs. no-enqueue for VM-free) tested in `break_escape_initializer_test.rb`. `Result#calculate` skip removed in Phase 7.3 with four concrete cases. Rescue guard on `fire_completion_callback` tested in Phase 1.4. |
| 4 | Cross-Engine Test Strategy Is Undefined | High | **Resolved** | Key Decisions table explicitly states "Full integration (engine tables present in Hacktivity test DB)". Phase 4.5 restates strategy and lists `break_escape_missions.yml` and `break_escape_games.yml` fixtures. File Change Summary includes both fixture files. |
| 5 | `MissionListingPolicy` Has No Test File | Medium | **Resolved** | Phase 4.4 adds `test/policies/mission_listing_policy_test.rb` with six named cases mirroring `event_policy_test.rb` pattern. |
| 6 | `active_game_for` Is Undertested | Medium | **Resolved** | Phase 3.4 lists seven `active_game_for` cases: VM-backed success, relinquished vm_set, wrong-batch vm_set, VM-free success, completed status (nil), abandoned status (nil), multiple in-progress (most recent). The "simplest" implementation comment is replaced with the correct vm_set-scoped query. |
| 7 | `VmSetAssignmentService` GA4 Tracking Not Tested | Medium | **Resolved** | Phase 2.2 table includes "`Ga4Service.track_event` called on success — called once with correct params" and "`Ga4Service.track_event` NOT called on error — not called". Boundary is also clarified: GA4 is called inside `assign!` in the service; the controller makes a separate `mission_started` call. |
| 8 | No Tests for `hidden_from_players` on EventsController/View | Medium | **Resolved** | Phase 4.5 controller test list includes two explicit cases: hidden batch not visible to regular user, hidden batch visible to admin. Phase 8.2 smoke step 2 covers the same scenario manually. |
| 9 | Phase 7 Tests Deferred Too Late | Low | **Resolved** | Phase 7 now contains all scoring tests directly. Phase 8 is explicitly described as "a gate — no new tests are written here". |
| 10 | Smoke Test Checklist Has Gaps | Low | **Resolved** | Smoke test now has 12 steps covering: hidden batch visibility (step 2), "Coming soon" state (step 3), `Result.score` verification in console (step 7), VM-free game completing without error (step 10), event copy (step 11), double-submit race (step 12). |

**Summary:** All ten original findings are resolved in Revision 2. The most significant improvements are the Phase 2.2 characterization test table (Finding 1), the explicit cross-engine fixture strategy (Finding 4), and the promotion of scoring tests into Phase 7 (Finding 9).

---

## New Findings

---

### New Finding A — Phase 2.2 Table Is Missing a Critical `wait_quota` Sub-Case

**Severity: Medium**

**Observation:**
The characterization test table in Phase 2.2 lists "Wait quota exceeded, guest → Error + redirect key `:event`" and "Wait quota exceeded, premium → Error + redirect key `:plans`". This captures the two redirect destinations correctly.

However, the `wait_quota_exceeded?` method in the service code (lines 328–338) contains a subtle semantic: the limit comparison is `most_recent&.allocated_date&.>= limit.ago`. This means:

- A user whose most recent allocation was *exactly* `limit.ago` seconds ago is treated as still within the quota window (the `>=` fires). This is a boundary condition distinct from "clearly exceeded" or "clearly not exceeded".
- More importantly, the test table does not include a case where `most_recent` is `nil` (the user has no prior allocation for this event). In that branch, `most_recent&.allocated_date&.>=` short-circuits to `nil`, which is falsy, and the check correctly passes. But this path is not represented in the table, so a refactoring error that changes the nil-safe chain (e.g. replacing `&.` with `.`) would not be caught by a characterization test.
- There is also no test for the admin bypass on wait quota: `return false if @user.admin?` is the first line of `wait_quota_exceeded?`, but the table only shows an admin bypass for `challenge_not_started?`. An accidental removal of the admin guard on wait quota would go undetected.

The `>` vs `>=` quirk in `batch_quota_exceeded?` is correctly called out with a do-not-fix note and an explicit test case. The `>=` boundary in `wait_quota_exceeded?` deserves the same treatment.

**Recommendation:**
Add to the Phase 2.2 table:

| Test case | Expected result |
|---|---|
| Wait quota: user has no prior allocation for this event | Proceeds (nil short-circuit) |
| Wait quota: most recent allocation is exactly `limit.ago` (boundary) | Error (>= fires — boundary is inclusive, document this) |
| Wait quota: admin with recent allocation | Proceeds (admin bypass) |

---

### New Finding B — `rescue ActiveRecord::RecordNotUnique` Path Is Undertested

**Severity: Medium**

**Observation:**
The Phase 4.5 list includes "Race condition guard: `RecordNotUnique` rescued, redirects to existing game". This covers the happy branch of the rescue handler (line 732–734: `existing_game` is found after the collision, redirect to it).

The rescue block has a second branch (lines 735–738): if `active_game_for` returns `nil` even after the `RecordNotUnique` (which could happen if the winning concurrent request was immediately rolled back or if the unique constraint fires on a field unrelated to the in_progress partial index), the controller sets `flash[:error]` and redirects to `event_path(@event)`.

This branch is not listed as a test case. It is not merely a theoretical edge: the partial index `WHERE status = 'in_progress'` will not block a `RecordNotUnique` raised by, say, a separate unique index on `(player_id, mission_id)` without a status filter (if one were added). Even without that scenario, the two-branch rescue is a real code path that deserves explicit coverage. Without it, a future change that accidentally makes the rescue redirect universally to the event page (dropping the find-existing-game step) would pass the test suite.

**Recommendation:**
Add to the Phase 4.5 controller test list:

- Race condition guard: `RecordNotUnique` rescued, `active_game_for` returns nil post-collision → flash error, redirect to event (not game).

Test implementation: stub `BreakEscape::Game` to raise `ActiveRecord::RecordNotUnique` on `save!`, and stub `active_game_for` to return `nil` on the second call (the re-query inside the rescue).

---

### New Finding C — `GameCompletionScoringJob` Test Cases Are Insufficient for Score-Overwrite Logic

**Severity: Medium**

**Observation:**
Phase 7.4 lists: "vm_set already has score > 0: does not overwrite". This is correct as far as it goes. The job's condition is:

```ruby
if vm_set.score.nil? || vm_set.score.zero?
  vm_set.update(score: 100.0)
end
```

There are two related cases not in the test list:

1. `vm_set.score` is `nil` (as opposed to `0.0`): the job should set it to 100. The listed test only covers "score > 0 does not overwrite" — it does not separately assert the `nil` branch triggers the update. If someone changes the condition to `vm_set.score.zero?` (dropping the nil check), all listed tests still pass.

2. The job always calls `result&.calculate` regardless of whether it updated the score. This means `Result#calculate` is called even when the score was not changed (already > 0 branch). This may be intentional (the result total could have been corrupted by another path and needs recalculating), but it is not tested or documented. A test that asserts `result.calculate` IS called even when score is already set would pin this behaviour and prevent accidental removal of the unconditional recalculate call.

**Recommendation:**
Add to the Phase 7.4 job test list:

- `vm_set.score` is nil: score set to 100.0, `result.calculate` called.
- `vm_set.score` is 0.0: score set to 100.0, `result.calculate` called (parallel to above; makes the two-branch condition explicit).
- `vm_set.score` is > 0 (already scored): score not updated, but `result.calculate` is still called.

The third case is the key addition: it documents that `calculate` is unconditional and prevents a future refactor from wrapping it inside the `if` block.

---

### New Finding D — Event Copy (Phase 6.4) Has No Test

**Severity: Medium**

**Observation:**
Phase 6.4 specifies copy behaviour for `MissionListing` rows: copy all listings, preserve `break_escape_mission_id`, `position`, and `release_at` (with optional date offset), but reset `sec_gen_batch_id` to `nil`. A notice should surface in the copy confirmation.

This behaviour is not tested anywhere in the plan. The File Change Summary does not include a test file for the copy logic. The existing copy workflow (`copy_event_form` / `copy_event`) presumably has tests elsewhere in the suite, but the new MissionListing-specific branch is entirely new code with no test coverage specified.

The silent failure mode here is significant: if the copy logic is accidentally skipped (e.g., the `if source_event.mission_listings.any?` guard has a bug, or the `weeks_offset_for_dates` adjustment raises for a listing with a nil `release_at`), the copied event will be silently empty of mission listings. The smoke test in step 11 covers this manually, but manual steps are not a substitute for an automated regression test.

**Recommendation:**
Add a test to the plan, either in the existing event copy test file (if one exists) or a new `test/controllers/events_controller_test.rb` section covering `copy_event`:

- Copying a game-type event with 3 mission listings: 3 `MissionListing` rows created for the new event with correct `break_escape_mission_id`, `position`, and nil `sec_gen_batch_id`.
- `release_at` is adjusted by `weeks_offset_for_dates` when provided; nil `release_at` stays nil.
- The copy confirmation response includes the notice about mission listings being copied.
- Copying a non-game event: no `MissionListing` rows created (regression guard for existing copy behaviour).

---

### New Finding E — Smoke Test Step 12 Is Not Reliably Achievable as Described

**Severity: Low**

**Observation:**
Smoke test step 12 reads: "Double-submit 'Start Mission' (two rapid POSTs); verify only one Game and one VmSet assignment exist."

Achieving a true concurrent race condition through a browser is unreliable — modern browsers serialise form submissions within the same tab. The intended test is a database-level race, not a UX one. In practice, a tester following this step will almost certainly find that the second POST is rejected at the `active_game_for` check (sequential path), not by the `RecordNotUnique` rescue. The step therefore provides false confidence: it tests the sequential duplicate-check path but not the concurrent race-condition path it implies.

The automated controller test for `RecordNotUnique` (Finding B above) is the correct vehicle for the concurrent path. The smoke step should be rewritten to test what it can actually verify manually.

**Recommendation:**
Replace step 12 with a more honest scope:

- Step 12 (revised): "Attempt to start the same mission from two browser tabs nearly simultaneously. In most cases the second request will hit the `active_game_for` redirect; confirm you are not presented with two active games in the event UI. For coverage of the DB-level race, rely on the automated `RecordNotUnique` controller test."

Optionally, add a note to the development setup docs: the concurrent race can be smoke-tested by using `curl` to fire two simultaneous POST requests with the same session token.

---

### New Finding F — `MissionListing` Copy Behaviour Is Not Tested at the Model Level

**Severity: Low**

**Observation:**
This is related to Finding D but distinct: Phase 6.4 specifies that copied `MissionListing` rows have `sec_gen_batch_id: nil`. There is no validation or model-level behaviour described that enforces this at copy time — it is a procedural requirement on the copy controller action. There is no model test that confirms a `MissionListing` is valid with `sec_gen_batch_id: nil` and `break_escape_mission_id` pointing to a mission that belongs to a batch in a different event.

Phase 3.4 does test `valid with event + mission, no sec_gen_batch (VM-free)`, which confirms the model accepts a nil `sec_gen_batch`. However, the copy scenario creates a listing where the mission was originally VM-backed and the associated batch exists — it just is not linked. The `sec_gen_batch_belongs_to_event` validation only fires `if :sec_gen_batch` (i.e., if `sec_gen_batch` is present), so a nil `sec_gen_batch_id` on a copied listing is not a validation concern. The existing "VM-free valid" test in Phase 3.4 already covers this implicitly.

This is therefore a documentation gap rather than a coverage gap: the Phase 3.4 test list should annotate the "valid with event + mission, no sec_gen_batch" case with a note that this is also the expected state of a copied listing, to make the intent clear to future readers. No new test is required.

---

## Overall Assessment

Revision 2 is a substantial improvement. All ten original findings are addressed. The characterization test table (Phase 2.2), the cross-engine fixture strategy (Phase 4.5), the scoring test promotion into Phase 7, and the addition of `MissionListingPolicy` tests together close the most significant regression risks identified in the first review.

**Remaining work before implementation begins:**

1. (New Finding A) Extend the Phase 2.2 characterization table with three `wait_quota` edge cases: nil prior allocation, exact-boundary allocation, and admin bypass. These are low-effort additions that prevent a class of silent refactoring errors.

2. (New Finding B) Add the second branch of the `rescue ActiveRecord::RecordNotUnique` block as an explicit controller test. This is a single additional test case with a stub setup similar to the existing race-condition case.

3. (New Finding C) Add two missing job test cases: the nil-score and the "already-scored but still recalculates" paths. Without the latter, the unconditional `result&.calculate` call is undocumented as intent and easy to accidentally scope inside the `if` block.

4. (New Finding D) Add event copy tests for the `MissionListing` copy behaviour. This is the only untested new code path that has no automated coverage at all in the current plan.

New Findings E and F are lower priority: E is a smoke test accuracy issue (real coverage is handled by the automated test from Finding B), and F is a documentation annotation rather than a missing test.

The overall phase structure and test-gate sequencing remain sound. The plan is close to implementation-ready; the four items above are additive rather than structural.
