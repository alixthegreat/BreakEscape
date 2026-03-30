# Architecture Review: MissionListing Integration Plan
## BreakEscape x Hacktivity

**Reviewed by:** Senior Rails Architect
**Date:** 2026-03-28
**Plan version:** as written in `plan.md`

---

## Summary Verdict

The plan is well-structured and shows a clear understanding of both codebases. The phased approach, the extraction of `VmSetAssignmentService`, and the use of a configurable hook to keep the engine decoupled from the host are all sound choices. However, there are two issues that must be resolved before implementation begins — a race condition that will cause duplicate VM assignments and duplicate games under any meaningful concurrent load, and a silent data integrity gap in `active_game_for` that will surface whenever a VmSet is relinquished or replaced. Several other findings are Major and should be addressed in the same implementation pass rather than deferred.

---

## Findings

### 1. Race condition on concurrent "Start Mission" requests

**Severity: Critical**

**Observation:**
The `start` action in `MissionListingsController` checks for an existing active game, then assigns a VmSet, then creates a Game — three separate database operations with no locking between them. Two simultaneous POST requests from the same user (double-click, network retry, two browser tabs) will both pass the `active_game_for` check, both call `VmSetAssignmentService`, and both create a `BreakEscape::Game`. The user ends up with two allocated VmSets and two games. One VmSet is then permanently orphaned.

The plan's test matrix includes "existing in-progress game → redirects without creating new game" but this test only covers the sequential case; it does not guard against the concurrent one.

The same gap exists on the `Result.find_or_create_by` call in the same action — `Result` itself acknowledges this problem in a `TODO` comment (`result.rb` line 10-12) and notes that the missing unique DB index means race conditions can still produce duplicate rows, albeit without further consequence. With the new flow that consequence becomes a real cost.

**Recommendation:**
Wrap the check-and-create sequence inside `with_advisory_lock` (if the `with_advisory_lock` gem is already present) or use `ApplicationRecord.transaction` combined with a unique database constraint as the backstop:

1. Add a partial unique index on `break_escape_games`: `UNIQUE (player_type, player_id, mission_id)` WHERE `status = 'in_progress'`. This makes any duplicate create fail at the DB level regardless of application-layer timing.
2. In the controller, use `rescue ActiveRecord::RecordNotUnique` to detect the collision and redirect to the existing game, identical to the normal "already has a game" path.
3. For VmSet assignment: move the VmSet assignment _inside_ the same transaction as game creation. If game creation fails (unique violation), roll back the VmSet assignment so no VmSet is stranded.

At minimum, point 1 (the DB constraint) must be in place before launch. The partial unique index lives in a BreakEscape migration and does not require changes to Hacktivity.

---

### 2. `active_game_for` is incomplete and will produce wrong results for VM-backed missions

**Severity: Critical**

**Observation:**
The plan leaves the query body as a comment — "Simplest: just find the most recent in_progress game for user+mission" — and does not implement it. This is not merely vague; the stated fallback is demonstrably incorrect for the VM-backed case.

Consider: a user starts a VM-backed mission, is assigned VmSet #5, plays for a while, then the VmSet is relinquished or errors out (`relinquished: true` or `build_status: 'error'`). If the game's `status` was not explicitly set to `abandoned`, `active_game_for` will still return it as the active game. The controller will redirect the user back into a game whose VmSet no longer works. The restart path will also find this game and attempt to revert a dead VmSet.

Furthermore, "most recent in_progress" will return the _wrong_ game if a user somehow has two in-progress games for the same mission (which is possible before the race-condition fix above is applied, and may also happen across different events listing the same mission).

**Recommendation:**
The correct query for a VM-backed mission scopes to the specific VmSet(s) belonging to this listing's `sec_gen_batch`, so stale games from other contexts are never returned:

```ruby
def active_game_for(user)
  scope = BreakEscape::Game.where(
    player: user,
    mission: break_escape_mission,
    status: 'in_progress'
  )

  if vm_backed?
    # Only games whose vm_set_id belongs to this listing's batch and is still healthy
    valid_vm_set_ids = sec_gen_batch.vm_sets
                                    .where(user: user, relinquished: false)
                                    .where.not(build_status: %w[pending error])
                                    .pluck(:id)
    return nil if valid_vm_set_ids.empty?
    scope = scope.where(vm_set_id: valid_vm_set_ids)
  end

  scope.order(created_at: :desc).first
end
```

This requires the `vm_set_id` column from Phase 1.1 to be present (it is — that part of the plan is correct). It also requires that `vm_set_id` is reliably populated; see Finding 3 below.

---

### 3. `vm_set_id` column sync is a `before_create`-only partial sync

**Severity: Major**

**Observation:**
Phase 1.1 adds `sync_vm_set_id_column` as a `before_create` callback, which populates `vm_set_id` from `player_state['vm_set_id']` at creation time. This is fine for new games. However:

- Existing games (created before this migration) have `vm_set_id` = NULL in the new column. Finding 2's corrected query depends on this column.
- The plan notes "Keep the JSONB key for backwards compatibility" but provides no data backfill migration for the existing rows.
- If `player_state` is ever modified to change `vm_set_id` after creation (which `reset_player_state!` explicitly preserves, so it won't change — but future code might), the column will silently drift from the JSONB source of truth.

**Recommendation:**
Add a data migration that backfills the column from JSONB for all existing rows:

```ruby
BreakEscape::Game.where(vm_set_id: nil)
                 .where("player_state->>'vm_set_id' IS NOT NULL")
                 .find_each do |game|
  game.update_columns(vm_set_id: game.player_state['vm_set_id'])
end
```

This should run in the same migration file as the `add_column`, or in an immediately following migration. Without it, `active_game_for` will silently fail for all pre-existing games.

---

### 4. `on_game_complete` Lambda defined in an initializer is fragile

**Severity: Major**

**Observation:**
The plan configures scoring logic via a Lambda stored in `BreakEscape.config.on_game_complete` inside `config/initializers/break_escape.rb`. This pattern has several practical problems:

1. **Testing is difficult.** The lambda is global mutable state. Tests that exercise game completion will trigger it unless they explicitly null it out. A test helper that sets a different lambda will affect other concurrent tests if the test suite runs in parallel.
2. **Error isolation is absent.** If the lambda raises (e.g., `VmSet.find_by` returns nil and the next line calls a method on nil), the exception propagates through `fire_completion_callback` and causes the `after_save` callback to fail. Depending on Rails version and callback chain configuration, this may roll back the game status save itself — meaning the game is never marked completed.
3. **The lambda uses `next` as a control-flow exit**, which is valid inside a block but semantically unexpected inside a lambda where `return` is the correct keyword. `next` will work here (it returns nil from the lambda) but it is non-idiomatic and will confuse readers.
4. **No retry or async handling.** If `result.calculate` is slow (it iterates all batches and vm_sets for an event), it runs synchronously in the web request that triggered the status change.

**Recommendation:**
Replace the inline lambda with a dedicated service object and an `after_commit` ActiveJob:

- In BreakEscape, keep the `on_game_complete` hook but make the engine's model call it inside a `rescue => e; Rails.logger.error ...; end` guard so a scoring failure never rolls back a game save.
- In Hacktivity's initializer, set the hook to enqueue a `GameCompletionScoringJob.perform_later(game.id, game.vm_set_id)` rather than doing the scoring inline. This decouples scoring latency from the user's request.
- The Job can use `ApplicationRecord.transaction` and `with_lock` on the Result row to safely call `result.calculate`.
- Change `next` to `return` in the lambda.

If async jobs are out of scope for the MVP, at minimum wrap the lambda body in a `rescue => e` block so scoring failure does not corrupt the game record.

---

### 5. `Result#calculate` is completely blind to game events

**Severity: Major**

**Observation:**
`Result#calculate` iterates `event.sec_gen_batches` exclusively (lines 25–52 of `result.rb`). For a game-type event with VM-backed missions, scoring works _only_ because the plan threads VmSet scores through the existing SecGenBatch path. But this means:

- A user who completes a VM-backed mission gets a score only if their VmSet score was set. `VmSet` has `score: 0` as its default at creation (see `sec_gen_batch.rb` line 197). The plan's completion hook sets it to `100.0` if it is `nil? || zero?`. However, if the user also solved flags during the game (which calls `FlagService.process_flag` and updates `vm_set.score`), the completion hook correctly skips the overwrite (`if vm_set.score.nil? || vm_set.score.zero?`). This part is sound.
- However, the `hidden_from_players` batch _will_ be included in `Result#calculate`'s iteration because that method iterates all `event.sec_gen_batches` without filtering. This is actually correct behaviour for the scoring path (you want the hidden batch to count toward score). But it is worth confirming this is intentional — the plan says "hidden from challenge list" not "excluded from scoring."
- For VM-free missions there is zero scoring, as the plan acknowledges. This is an acceptable MVP limitation _if_ VM-free missions are not intended to affect event placement or leaderboards. If they are, this becomes a blocker.

**Recommendation:**
The VM-backed scoring path is acceptable for MVP. The plan should explicitly document that `hidden_from_players` affects UI visibility only, not scoring weight. Add a comment to the `hidden_from_players` migration confirming this. Promote the VM-free scoring gap from an open question to a tracked issue with an owner assigned before the event goes live with any VM-free missions.

---

### 6. Cross-engine FK risk: plain bigint `break_escape_mission_id`

**Severity: Major**

**Observation:**
The plan omits a database foreign key constraint on `break_escape_mission_id` because "the engine table may not always be present during migration." This is a reasonable migration-time concern, but the consequence is a permanently unconstrained column: it is possible to delete a `BreakEscape::Mission` and leave `MissionListing` rows pointing at a non-existent mission. The `belongs_to :break_escape_mission` in the model validates presence on save but does not protect against delete-after-save.

The `BreakEscape::Mission` has `has_many :games, dependent: :destroy` but there is no equivalent destroy guard on `MissionListing`. If a mission is deleted, mission listings will silently dangle, and `active_game_for` will fail with a missing association error on any listing that tries to load `break_escape_mission`.

**Recommendation:**
Two complementary mitigations:

1. Add a DB-level FK in Hacktivity's migration with `add_foreign_key :mission_listings, :break_escape_missions, column: :break_escape_mission_id`. Since both apps share the same database (Hacktivity is the host), the table _is_ present at migration time when the host runs `db:migrate`. The engine concern only applies if the engine is run standalone; Hacktivity's migration need not worry about that. If there is a legitimate need to run Hacktivity without the engine table, use `add_foreign_key ... validate: false` and validate separately once confirmed.
2. Add `has_many :mission_listings, class_name: '::MissionListing', foreign_key: :break_escape_mission_id, dependent: :nullify` (or `:destroy`) to `BreakEscape::Mission`, behind a `defined?(::MissionListing)` guard so the engine remains deployable standalone.

---

### 7. Event copy is a real blocker for recurring events

**Severity: Major**

**Observation:**
The plan defers event copy as an open question. Looking at the `Event` model, `copy_event` is referenced in `attr_accessor :new_title, :number_of_new_sets_to_build, :weeks_offset_for_dates` — these are form attributes purpose-built for the copy workflow. The copy workflow is clearly a first-class admin feature, not a rarely used path.

If a game-type event is copied without copying its `MissionListing` rows, the copied event will have `hacktivity_type: game` but no missions, silently rendering an empty page to users. Worse, if the copy does a naive `dup` of SecGenBatch records but not MissionListings, the admin has no signal that the new event is missing the mission configuration.

This is not a pre-launch technical blocker in the same sense as the race condition, but it is a workflow blocker: an admin cannot safely copy a game event until this is resolved, and the first time it is needed under time pressure is the wrong moment to discover the gap.

**Recommendation:**
Resolve this in Phase 6 (Admin UI), not post-launch. The copy logic should either:
- Include `mission_listings` in the copy (duplicating the records with the same `break_escape_mission_id` and `position`, nulling `sec_gen_batch_id` since a new batch will be created), or
- Detect that the source event has `mission_listings` and surface an explicit warning/confirmation step in the copy form.

---

### 8. `@user_games` index in EventsController will return only one game per mission

**Severity: Minor**

**Observation:**
Phase 5 loads `@user_games` as `index_by(&:mission_id)`. If a user has both an `in_progress` game and a `completed` game for the same mission (e.g., they restarted and finished it), `index_by` will silently keep whichever record comes last in the result set. The view logic for "show current status" will therefore sometimes show a stale state.

**Recommendation:**
Scope the query to the most relevant game per mission before indexing. A simple fix is to load only the most recent game per mission:

```ruby
@user_games = BreakEscape::Game.where(player: current_user, mission_id: mission_ids)
                               .order(created_at: :desc)
                               .index_by(&:mission_id)
```

`index_by` on an ordered result keeps the first match (most recent), which is the correct semantics. Add a comment explaining this.

---

### 9. `MissionListingPolicy#signed_up_to_event?` issues an N+1 in the context of the listing view

**Severity: Minor**

**Observation:**
`signed_up_to_event?` calls `record.event.users.exists?(user.id)`. When the policy is checked for each listing on the event show page, `record.event` is re-loaded from the association on every call unless `@event` is the same object in memory (it will be if the listing was loaded via `@event.mission_listings`). However `users.exists?` fires a query per policy check. For an event with 10 missions, this is 10 identical queries.

**Recommendation:**
Pass the pre-loaded event enrollment status into the policy via a policy scope, or memoize at the controller level with an instance variable (`@user_signed_up = @event.users.exists?(current_user.id)`). Alternatively, add a scope to the policy that checks once and stores the result.

---

### 10. `restart` action reads `vm_set_id` from JSONB after the column is available

**Severity: Minor**

**Observation:**
The `restart` action fetches the VmSet via `game.player_state&.dig('vm_set_id')`. After Phase 1.1 adds the `vm_set_id` column to `break_escape_games`, this should read from `game.vm_set_id` instead (with a fallback to JSONB for legacy games until the backfill migration runs). Reading from JSONB is not wrong, but it is inconsistent with the rest of the plan and will silently break for any game created by a code path that does not populate the JSONB key.

**Recommendation:**
Standardise on `game.vm_set_id || game.player_state&.dig('vm_set_id')` in the restart action. Once the backfill migration runs, drop the JSONB fallback.

---

## Overall Assessment

The integration plan is coherent and technically literate. The engine/host decoupling via a configuration hook is the right approach, the service extraction is well-scoped, and the decision to reuse the existing `Result#calculate` and VmSet scoring path rather than building a parallel scoring mechanism is pragmatic. That said, the plan cannot be implemented as written without addressing the two Critical findings first. The race condition (Finding 1) will cause real data corruption under normal event-day traffic; the incomplete `active_game_for` query (Finding 2) will cause users to be redirected into broken game sessions. Both require implementation work in Phase 1 and Phase 3 respectively before the controller in Phase 4 can be safely written. The Major findings — particularly the missing FK (Finding 6) and the event copy gap (Finding 7) — should be resolved in the same implementation pass rather than treated as post-launch work, as both become progressively more expensive to fix once production data exists. The Minor findings are low-risk and can be addressed in code review. Resolving Findings 1, 2, 3, and 4 will produce a significantly more robust system with no material increase in implementation scope.
