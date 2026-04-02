# Architecture Review v2: MissionListing Integration Plan (Revision 2)
## BreakEscape x Hacktivity

**Reviewed by:** Senior Rails Architect
**Date:** 2026-03-28
**Plan version:** Revision 2 — post-review

---

## Part 1: Resolution Status of Original Findings

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Race condition on concurrent "Start Mission" requests | Critical | Resolved |
| 2 | `active_game_for` incomplete / incorrect for VM-backed missions | Critical | Resolved |
| 3 | `vm_set_id` column sync is `before_create`-only partial sync (missing backfill) | Major | Resolved |
| 4 | `on_game_complete` lambda fragile — inline, no rescue, uses `next`, synchronous | Major | Resolved |
| 5 | `Result#calculate` blind to game events / VM-free scoring gap | Major | Partially Resolved |
| 6 | Cross-engine FK risk: plain bigint `break_escape_mission_id` | Major | Resolved |
| 7 | Event copy is a real blocker for recurring events | Major | Resolved |
| 8 | `@user_games` index in EventsController will return only one game per mission | Minor | Resolved |
| 9 | `MissionListingPolicy#signed_up_to_event?` issues an N+1 | Minor | Resolved |
| 10 | `restart` action reads `vm_set_id` from JSONB after column is available | Minor | Resolved |

### Finding 5 — Partially Resolved

The original review identified two sub-issues: the VM-backed scoring path (threading through `vm_set.score` and `Result#calculate`) and the VM-free scoring gap. The revised plan resolves the VM-backed path. On the VM-free gap, the plan states: "VM-free scoring deferred" in the Key Decisions table and the smoke test confirms VM-free game completion should produce no error. However, the plan does not promote this to a tracked issue with an owner assigned, which was the specific recommendation. The gap is acknowledged but not formally tracked. This is a process omission rather than a code defect, and it is low-risk for the MVP as long as no VM-free mission is intended to affect event leaderboards. The recommendation stands: assign an owner to the VM-free scoring gap before any VM-free mission goes live.

---

## Part 2: New Findings

---

### NF-1. `redirect_to` + `raise ActiveRecord::Rollback` inside a transaction block does not behave as expected

**Severity: Critical**

**Observation:**

In `MissionListingsController#start` (Phase 4.3, lines 696–701), the error path inside the transaction block is:

```ruby
unless result.success
  flash[:error] = result.error_message
  path = result.redirect_key == :plans ? plans_path : event_path(@event)
  redirect_to path, status: :see_other
  raise ActiveRecord::Rollback
end
```

`redirect_to` in Rails does not immediately send a response or halt execution. It sets `@_response_body` and marks the response as performed (`performed?` returns true), but control returns to the caller — in this case, to the next line inside the transaction block. `raise ActiveRecord::Rollback` then fires correctly and rolls back the transaction. So far, so good.

The problem is what happens _after_ the `ApplicationRecord.transaction do ... end` block returns. `ActiveRecord::Rollback` is swallowed by the transaction block (that is its purpose — it does not propagate). Control falls through to the code below the transaction block:

```ruby
return if performed?  # redirect already happened inside transaction

Result.find_or_create_by(user: current_user, event: @event)
...
redirect_to break_escape.game_path(game), status: :see_other
```

The `return if performed?` guard is the intended safety net. It works correctly _in the happy path_. But if the VmSet assignment fails and the redirect is set inside the transaction, `performed?` is true, so `return if performed?` does fire and the method exits before calling `Result.find_or_create_by` or the second `redirect_to`. The VmSet update is rolled back, `game` is nil, and the already-set redirect (to the event or plans path) is the response delivered. Mechanically, this works.

However, there is a subtle coupling that is one refactor away from a double-render or a `ActionController::DoubleRenderError`:

1. The `return if performed?` guard assumes it is the _only_ post-transaction check. If any future developer adds code between the `end` of the transaction block and the `return if performed?` guard, that code will run after an error redirect has already been set — silently, without warning.
2. `ActiveRecord::Rollback` swallowing means the error path is entirely invisible to the outer rescue clause (`rescue ActiveRecord::RecordNotUnique`). This is correct in the current code, but the control flow is non-obvious enough that it has already produced a `game = nil` risk: `redirect_to break_escape.game_path(game)` at line 727 would raise `NoMethodError` on nil if `performed?` ever returns false when it should not (e.g., if `redirect_to` behaviour changes between Rails versions, or if a middleware resets the response state).

The `performed?` guard is a code smell that signals the transaction and the controller action are doing two different jobs in the same method. This pattern is technically functional in Rails 6/7 but is not the standard idiom for error handling in a controller action.

**Recommendation:**

Extract the transaction into a service object or a private method that returns either the new `game` or an error struct, without setting flash or calling `redirect_to`. Keep all `redirect_to` calls at the action level, outside the transaction boundary.

```ruby
def start
  authorize(@mission_listing)

  existing_game = @mission_listing.active_game_for(current_user)
  return redirect_to break_escape.game_path(existing_game), status: :see_other if existing_game

  outcome = start_mission_transaction(current_user)

  if outcome.error?
    flash[:error] = outcome.error_message
    return redirect_to resolve_redirect_path(outcome.redirect_key), status: :see_other
  end

  Result.find_or_create_by(user: current_user, event: @event)
  Ga4Service.track_event(...)
  redirect_to break_escape.game_path(outcome.game), status: :see_other

rescue ActiveRecord::RecordNotUnique
  ...
end
```

The `return if performed?` anti-pattern is eliminated, `game` is always a valid object by the time `game_path` is called, and the control flow is legible to any Rails developer.

If the extract-to-service refactor is out of scope, the minimum safe change is: assign `game = nil` explicitly before the transaction, and add an assertion (`raise "BUG: game nil after transaction" if game.nil?`) immediately after `return if performed?` so a regression surfaces immediately in tests rather than silently in production.

---

### NF-2. `after_commit` for `fire_completion_callback` is correct, but `status_previously_changed_to_completed?` is unreliable after `after_commit`

**Severity: Major**

**Observation:**

The plan correctly changes `after_save` to `after_commit` for `fire_completion_callback` (Phase 1.2). This is the right fix: it ensures the job is enqueued only after the database transaction commits, which prevents the job from running before the game record is visible to the job worker. The rescue guard is also correct.

However, `status_previously_changed_to_completed?` is implemented as:

```ruby
def status_previously_changed_to_completed?
  saved_change_to_status? && status == 'completed'
end
```

`saved_change_to_status?` is a dirty-tracking method provided by `ActiveModel::Dirty`. In Rails 6+, `saved_change_to_status?` returns true inside an `after_save` callback because `saved_changes` reflects the changes from the just-completed save. In an `after_commit` callback, `saved_changes` is still available (Rails preserves them through the commit), so this works in Rails 6 and Rails 7.

The risk is `status == 'completed'` as a second condition. If a game is saved with `status: 'completed'` and then immediately saved again without changing status (e.g., a touch call, a `update_columns` on a different attribute, or an optimistic lock retry), `saved_change_to_status?` will be false on the second save, so the guard correctly suppresses the double-fire. This part is sound.

The real issue is that `status == 'completed'` is a present-tense read. If the game is modified between the `after_save` firing and the `after_commit` firing (which is theoretically possible but practically very unlikely in a web request), the current `status` value could differ from the committed value. Using `saved_change_to_status?(to: 'completed')` is both more precise and more idiomatic — it checks the committed change direction explicitly, without relying on the current attribute value being unchanged.

**Recommendation:**

Replace the predicate with:

```ruby
def status_previously_changed_to_completed?
  saved_change_to_status?(to: 'completed')
end
```

This is a one-line change that makes the intent explicit and is immune to any attribute mutation between save and commit.

---

### NF-3. `Result.find_or_create_by` outside the transaction leaves an orphaned Result on `RecordNotUnique` rescue

**Severity: Major**

**Observation:**

The `start` action calls `Result.find_or_create_by(user: current_user, event: @event)` at line 719, _after_ the transaction block and _after_ the `return if performed?` guard. This means it runs only on the success path. So far, correct.

However, consider the `RecordNotUnique` rescue path (lines 729–738):

```ruby
rescue ActiveRecord::RecordNotUnique
  existing_game = @mission_listing.active_game_for(current_user)
  if existing_game
    redirect_to break_escape.game_path(existing_game), status: :see_other
  else
    flash[:error] = "Could not start mission. Please try again."
    redirect_to event_path(@event), status: :see_other
  end
end
```

When `RecordNotUnique` is raised, the rescue block redirects without calling `Result.find_or_create_by`. This is correct behaviour: the user already has an in-progress game (created by the racing request), so a `Result` row should already exist from when that game was created. However, there is a window: if this is the _first_ request to create a game for this user+event (the race happened on the very first attempt — two simultaneous first-time starts), neither racing request may have committed `Result.find_or_create_by` before the `RecordNotUnique` fires. The result: the user has a `Game` (created by whichever request won) but no `Result` row (neither request reached line 719).

This is not a data corruption issue — `Result` rows are lazily created and `Result#calculate` is safe to call even if called directly. But it means a user who hits this race on their very first game start for an event will have no `Result` row, and any scoring that runs before they trigger another Result-creating action will call `result&.calculate` (line 928 of the job), hit nil, and silently skip scoring.

**Recommendation:**

Move `Result.find_or_create_by` to _inside_ the transaction, _before_ `game.save!`, on the success path only. If the transaction rolls back (VmSet assignment failure or `RecordNotUnique`), the `Result` row is also rolled back, and the race-condition rescue path does not need to create one because the winning request's transaction will have done so. If `Result.find_or_create_by` itself has a unique-violation race (acknowledged in `result.rb` lines 10-12), that should be addressed separately with a unique index on `results (user_id, event_id)`, but that is outside the scope of this plan.

---

### NF-4. `GameCompletionScoringJob` signature is insufficient when VmSet is relinquished between enqueue and execution

**Severity: Major**

**Observation:**

`GameCompletionScoringJob#perform` receives `(game_id, vm_set_id)` and begins:

```ruby
vm_set = VmSet.find_by(id: vm_set_id)
return unless vm_set
```

If the VmSet has been relinquished (e.g., the user or an admin marks it relinquished, or a background cleanup job runs) between game completion and job execution, `VmSet.find_by` returns the record — `relinquished: true` does not delete the row, it merely marks it. So the `return unless vm_set` guard does not actually protect against relinquished sets.

The consequence: the job will call `vm_set.update(score: 100.0)` on a relinquished VmSet, and then call `result.calculate`, which iterates all `event.sec_gen_batches` — including this one — and includes the relinquished VmSet's now-set score in the result total. This is probably the correct behaviour (the user did complete the mission before relinquishment), but it is worth confirming intentionally rather than inheriting by accident.

A second, more serious issue: `result = Result.find_by(user_id: vm_set.user_id, event: vm_set.sec_gen_batch.event)`. This call chains through `vm_set.sec_gen_batch`, which fires a query. If `sec_gen_batch` has been deleted (rare but possible if an admin removes a batch after an event ends), this raises `ActiveRecord::RecordNotFound` or returns nil depending on the association definition — and if it raises, the job fails with an unhandled exception, which may trigger infinite retries depending on the ActiveJob backend configuration.

There is no `with_lock` or transaction guard on the `vm_set.update` + `result.calculate` sequence. If two completions somehow race on the same VmSet (e.g., a test environment with multiple workers, or a job retry), both will call `result.calculate` concurrently, producing a race on the Result row itself.

**Recommendation:**

1. Add `vm_set.sec_gen_batch` nil-guard: `return unless vm_set&.sec_gen_batch`.
2. Wrap the `vm_set.update` + `result.calculate` sequence in `ApplicationRecord.transaction { vm_set.with_lock { ... } }` to serialise concurrent completions on the same VmSet.
3. Decide explicitly whether a relinquished-but-completed VmSet should be scored. If yes (user earned it), no code change needed — document the intent. If no, add `return if vm_set.relinquished?` after the `return unless vm_set` guard.
4. Consider adding `sidekiq_options retry: 3` (or equivalent for the configured backend) with an `on_discard` hook that logs the skip, rather than relying on unlimited retries in case of transient failures.

---

### NF-5. Event copy sets `sec_gen_batch_id: nil` but provides no guard against copied listings being started immediately without a batch

**Severity: Minor**

**Observation:**

Phase 6.4 correctly copies `MissionListing` rows with `sec_gen_batch_id: nil` and surfaces a notice to the admin. However, the copied event is in whatever `type_of_hacktivity` state it is saved with. If an admin copies a game-type event, receives the notice about VM assignments being cleared, and then publishes (or makes accessible) the copied event before creating new SecGenBatches and linking them, players will see the "Start Mission" button. Clicking it will route to `MissionListingsController#start`, which checks `@mission_listing.vm_backed?` — returning `false` (since `sec_gen_batch` is nil) — and will create a VM-free Game for a mission that is intended to be VM-backed. The player will enter a game with no VmSet, which will either error or silently present a broken game depending on the mission's scenario data expectations.

This is the same failure mode as starting a VM-free mission by design, but here it is accidental. The `MissionListingPolicy` has no check for "listing is in a valid state to start."

**Recommendation:**

Add a validation or policy guard that prevents starting a mission on a listing whose parent event has `hacktivity_type: game` when the listing's `sec_gen_batch_id` is nil _and_ the mission requires VM resources (i.e., when the associated `BreakEscape::Mission` has a non-nil `sec_gen_template` or equivalent VM-dependency flag). If such a flag does not exist on `BreakEscape::Mission`, a simpler heuristic is: in the policy's `start?` predicate, verify that if the event is game-type, either the listing has a `sec_gen_batch` or the `BreakEscape::Mission` is explicitly flagged as VM-free. At minimum, the admin notice in the copy flow should warn: "Do not publish this event until all mission listings have been linked to new SecGenBatches."

---

### NF-6. `MissionListingPolicy#signed_up_to_event?` memoization is per-instance, not per-request

**Severity: Minor**

**Observation:**

The revised plan addresses the N+1 finding (original Finding 9) by adding `@signed_up` memoization inside the policy:

```ruby
def signed_up_to_event?
  @signed_up ||= record.event.users.exists?(user.id)
end
```

This memoizes within a single policy object instance. Pundit instantiates a new policy object per `authorize` or `policy` call, so the memoization only helps if the same policy instance is reused — which happens inside a single policy object's method calls (e.g., `start?` calls `signed_up_to_event?` once and it is memoized for any further calls within that same policy instance). It does not deduplicate across multiple `policy(@listing).start?` calls for different listings on the event show page, because each call instantiates a new `MissionListingPolicy` object with a different `record`.

For a single `authorize(@mission_listing)` call in the controller action, this is fine — there is exactly one policy instance and the memoization is irrelevant but harmless. The N+1 would only materialise in a view that calls `policy(listing).start?` for each listing in a loop. The revised plan's event show partial does not show the plan's view code for the per-listing policy check, so it is unclear whether this scenario arises.

**Recommendation:**

If the mission listings partial calls `policy(listing)` per-listing (which is the standard Pundit view pattern), the memoization inside the policy object does not help. The correct fix is to memoize at the controller/view level: set `@user_signed_up = policy(@event).user_signed_up?` (or a direct query) once in the controller, and pass it into the partial, rather than calling `policy(listing)` per listing for the enrollment check. The policy is still used for admin/CRUD authorisation; the enrollment check is extracted to a single query. If the partial does not call `policy(listing)` per-listing (e.g., it uses a simple `if @user_games[listing.break_escape_mission_id]` pattern for button state), this is a non-issue.

---

## Part 3: Overall Assessment

The revision is a substantial improvement over the original plan. Both Critical findings have been correctly resolved — the partial unique index backstop is present and correctly scoped, the `RecordNotUnique` rescue path is in place, `active_game_for` is fully implemented with the VmSet health check, and the backfill migration is included in the same migration file. The Major finding resolutions are also sound: `after_commit` replaces `after_save`, `next` is replaced with `return`, the rescue guard is present, the FK is enforced, and event copy is promoted from deferred to a mandatory Phase 6 item with a concrete implementation.

However, the revision introduces one new Critical-severity issue and three new Major-severity issues that must be addressed before implementation proceeds.

**NF-1 (Critical)** is the most urgent: the `redirect_to` + `raise ActiveRecord::Rollback` + `return if performed?` control flow is functional but fragile. It is one misplaced line of code away from a `NoMethodError` on `nil` or a `DoubleRenderError`. The extract-to-private-method refactor is the correct fix and is a small amount of work relative to the risk it eliminates.

**NF-3 (Major)** — orphaned Result on first-request race — is a real data integrity gap that the rescue path does not cover. Moving `Result.find_or_create_by` inside the transaction closes it cleanly.

**NF-4 (Major)** — the `GameCompletionScoringJob` missing nil-guard on `sec_gen_batch` and missing lock on the update+calculate sequence — needs the nil-guard at minimum before the job is deployed. The locking recommendation can be deferred if concurrent job execution for the same VmSet is not possible in the chosen backend configuration, but should be documented.

**NF-2 (Major)** — the `saved_change_to_status?(to: 'completed')` wording — is a one-line change with no behaviour difference in current Rails versions but improves correctness and intent clarity.

**NF-5 and NF-6 (both Minor)** can be addressed in code review. NF-5 is worth a comment in the admin copy notice; NF-6 is worth confirming the partial does not call `policy(listing)` per-listing before closing.

Resolving NF-1 and NF-3 before implementation begins is strongly recommended. NF-4's nil-guard must be in place before the scoring job is deployed to production.
