# Implementation Review
## MissionListing Integration Plan — Hacktivity × BreakEscape

**Reviewer:** Senior Rails Developer (automated review, 2026-03-28)
**Plan file:** `planning_notes/hacktivity_gamelisting_integration/plan.md`

---

## Summary Verdict

The plan is well-structured and covers the major integration surfaces correctly. However, it contains **three hard blockers** that will cause runtime failures if implemented as written, plus several significant gaps that would produce subtle bugs or require immediate rework. The plan should be revised before implementation begins.

---

## Findings

### Finding 1 — `Data.define` Is Not Available on Ruby 2.7

**Severity: BLOCKER**

The plan uses `Data.define` for the `VmSetAssignmentService::Result` struct:

```ruby
Result = Data.define(:success, :vm_set, :error_message, :redirect_path)
```

`Data.define` was introduced in **Ruby 3.2**. Hacktivity's `.ruby-version` file specifies **2.7.0**, and the `Gemfile` confirms `ruby "2.7.0"`. This line will raise a `NameError: uninitialized constant Data` at class load time, bringing the entire application down.

**Recommendation:** Replace with a plain `Struct`:

```ruby
Result = Struct.new(:success, :vm_set, :error_message, :redirect_path, keyword_init: true)
```

`keyword_init: true` was added in Ruby 2.5, so it is available here. Alternatively use a simple value object with `attr_reader` and an initializer. Either way, update every callsite in the plan (`Result.new(success: true, ...)`) accordingly — the keyword syntax is compatible with `Struct.new(..., keyword_init: true)`.

---

### Finding 2 — `OvirtRevertSnapshotJob` Does Not Exist

**Severity: BLOCKER**

The plan's `restart` action calls:

```ruby
OvirtRevertSnapshotJob.perform_later(vm_set.id)
```

No such job exists anywhere in the Hacktivity codebase. The full jobs directory was checked; there is no `OvirtRevertSnapshotJob` file and no reference to this constant.

The correct mechanism in Hacktivity is `DispatchVmCtrlService.ctrl_vm_async(vm, "revert_snapshot", "original")`, called **per individual VM** (not per vm_set). The pattern used in `VmSetsController#ovirt_revert_snapshot_vm_set` (line 83–85) is the canonical way to trigger a revert for a set:

```ruby
@vm_set.vms.each do |vm|
  DispatchVmCtrlService.ctrl_vm_async(vm, "revert_snapshot", "original")
end
```

`DispatchVmCtrlService` internally dispatches to `CtrlOvirtVmJob` or `CtrlProxmoxVmJob` based on the cluster type, and also requires the VMs to be powered down first (the controller checks `vm.state != "down"` and redirects with an error if any VM is still running). The `restart` action in the plan does not handle this precondition at all.

**Recommendation:** Replace the `OvirtRevertSnapshotJob` reference with direct use of `DispatchVmCtrlService`. Also add a VM state check before triggering the revert, and communicate to the user that the revert is asynchronous:

```ruby
if @mission_listing.vm_backed?
  vm_set = ::VmSet.find_by(id: game.player_state&.dig('vm_set_id'))
  if vm_set
    vm_set.vms.each do |vm|
      DispatchVmCtrlService.ctrl_vm_async(vm, "revert_snapshot", "original")
    end
    flash[:notice] = "VM revert in progress. Please wait a few minutes before restarting your session."
  end
end
```

The plan's open question "confirm this job exists" needed a definitive answer before implementation — this review provides it.

---

### Finding 3 — `break_escape_game_path` Helper Is Not Available in the Host App

**Severity: BLOCKER**

The plan uses `break_escape_game_path(game)` in `MissionListingsController` and notes this as an open question. The answer from the routes file is definitive: **the BreakEscape engine is not mounted in Hacktivity's `config/routes.rb`**. There is no `mount BreakEscape::Engine` call anywhere in the file.

Without a mount point, no engine route helpers exist in the host app. Calling `break_escape_game_path` will raise `NoMethodError` at runtime.

**Recommendation:** The engine must be mounted before any host-app code can use its route helpers. Add to `config/routes.rb`:

```ruby
mount BreakEscape::Engine => "/break_escape"
```

Once mounted, the prefixed helper will be `break_escape.game_path(game)` (using the engine's routing proxy object), **not** `break_escape_game_path(game)`. The plan's suggestion to `include BreakEscape::Engine.routes.url_helpers` in `ApplicationController` is an alternative that provides the unprefixed `game_path` form, but is error-prone because it may collide with host-app helpers. The cleaner approach is to use the mounted proxy (`break_escape.game_path(game)`) everywhere.

Update every occurrence in the plan (controller `start`, `restart`, and the view partial) to use the prefixed form.

---

### Finding 4 — Wait-Quota Redirect Logic Is Inverted in Plan Description

**Severity: HIGH**

The plan's description (section 2.2, "Note on redirect_path") says the service returns `plans_path` "for premium upgrade prompt." This description implies a non-premium user gets redirected to plans. The actual controller logic (lines 239–244) is the opposite:

- If `current_user.has_premium_quota?` is **true** (premium/org/admin user): redirect to `plans_path` with message "You can upgrade your plan to remove this wait."
- If `current_user.has_premium_quota?` is **false** (guest): redirect to `event_path(@event)`.

This is counterintuitive (why redirect a premium user to plans?) but it is the existing behaviour. The service must replicate this exactly. The `Result` struct's `redirect_path` must carry the computed path (`plans_path` or `event_path`) as a value, but the service has no access to route helpers by default.

**Recommendation:** The service should return a **symbolic redirect key** (e.g. `:plans` or `:event`) rather than a path string, and let the controller resolve it. Alternatively, include `Rails.application.routes.url_helpers` in the service class (as `FlagService` already does). Document this decision explicitly in the plan. Also correct the description of the redirect logic to match the actual code.

---

### Finding 5 — `VmSetAssignmentService` Must Carry the `scoped_vip_by_event?` Bypass for Start-Time Check

**Severity: HIGH**

The start-time guard in `assign_vm_set` (line 171) reads:

```ruby
if @sec_gen_batch.start_time > Time.current && !(current_user&.admin? || current_user.scoped_vip_by_event?(@event))
```

Admins and scoped VIPs bypass this check. The plan's `call` method skeleton shows `return start_time_error if challenge_not_started?` with no mention of the admin/VIP bypass. When the service is used from `MissionListingsController`, `current_user` is not available — only `user` is passed as an argument.

**Recommendation:** The plan must explicitly document that the `challenge_not_started?` predicate receives and uses the `user` argument:

```ruby
def challenge_not_started?
  @sec_gen_batch.start_time > Time.current &&
    !(@user.admin? || @user.scoped_vip_by_event?(@event))
end
```

Without this, VIPs and admins will be incorrectly blocked from starting missions before the official start time.

---

### Finding 6 — `count > max_vm_set_requests` vs `count > (max_vm_set_requests || 1)` — Off-by-one Not Flagged

**Severity: MEDIUM**

The controller at line 268 uses:

```ruby
count = VmSet.where(sec_gen_batch: @sec_gen_batch, user: current_user, build_status: "success").count
if count > (@sec_gen_batch.max_vm_set_requests || 1)
```

This allows a user to have up to `max_vm_set_requests + 1` vm_sets before the check triggers (e.g. if `max_vm_set_requests` is 1, the check only fires when `count > 1`, i.e. at 2 sets). This appears to be an existing quirk in the code, but the plan describes the logic as "enforces count of vm sets the user has owned" without reproducing the exact comparison. The service implementation must replicate `count > (@sec_gen_batch.max_vm_set_requests || 1)` exactly to preserve behaviour parity.

**Recommendation:** Add an explicit comment in the service's `batch_quota_exceeded?` predicate noting this is a `>` comparison (not `>=`), to prevent a well-intentioned developer from "fixing" what looks like a bug.

---

### Finding 7 — `parent_pool` vm_set Reassignment Must Be Explicitly Called Out

**Severity: MEDIUM**

The plan mentions the parent_pool fallback in passing, but does not explicitly call out the most consequential line in the assignment logic (line 288):

```ruby
vm_set.sec_gen_batch = @sec_gen_batch # ensure parent_pool vms are moved over
```

When a vm_set is sourced from the parent pool, its `sec_gen_batch` foreign key is updated to point to the current batch. This is a **permanent database mutation** that moves the vm_set out of the pool. If the service omits this line (e.g. a developer writes `assign!` without reviewing the original code carefully), the vm_set remains associated with the parent pool, breaking the redirect `event_sec_gen_batch_path(vm_set.sec_gen_batch.event, vm_set.sec_gen_batch)` in the controller, the completion callback's `vm_set.sec_gen_batch.event` lookup in Phase 7, and reporting/scoring.

**Recommendation:** Add a bold callout in section 2.2 explicitly naming this line and explaining why it is required. The service's `assign!` method implementation must include `vm_set.sec_gen_batch = @sec_gen_batch` before `vm_set.save`.

---

### Finding 8 — `Ga4Service.track_event` Call in the Service vs. the Controller

**Severity: MEDIUM**

The existing controller calls `Ga4Service.track_event` (lines 290–297) inside the success path of the individual assignment, with params including `vm_set_id`, `batch_id`, and `team_assignment`. The plan moves this into the service's success path. However, the plan's `MissionListingsController#start` also adds a **second** `Ga4Service.track_event` call for `mission_started` after game creation.

This means in the VM-backed path, two GA4 events fire per start. This may be intentional (one for VM assignment, one for game creation), but the plan does not acknowledge this. The `vm_set_assigned` event name from the existing code is a meaningful analytics event that should be preserved with its original parameters.

**Recommendation:** Confirm whether both events should fire and document this explicitly. If the service is responsible for the `vm_set_assigned` event, the plan's service skeleton should show it. If only the `mission_started` event is wanted in the new flow, that is also a valid choice, but it breaks analytics continuity with the existing challenge flow.

---

### Finding 9 — `acts_as_list` Is Not Present and Manual Alternative Is Underspecified

**Severity: MEDIUM**

The Hacktivity Gemfile contains no reference to `acts_as_list`. The plan notes this as an open question but then includes `acts_as_list scope: :event` in the `MissionListing` model code as if it were available. If this line is included without the gem, Rails will raise `NoMethodError: undefined method 'acts_as_list'` at startup.

**Recommendation:** Remove `acts_as_list` from the model code in the plan and replace with a documented manual approach. The minimum viable implementation:

1. The `position` column is already in the migration with a `default: 0`.
2. The `ordered` scope (`order(:position)`) is already defined.
3. Add a `before_create` callback to set position: `before_create :set_default_position` with `self.position = (event.mission_listings.maximum(:position) || -1) + 1`.
4. For admin reordering, a simple `update_all` or a dedicated endpoint is sufficient for the initial release.

If drag-and-drop ordering is wanted later, add `acts_as_list` at that point.

---

### Finding 10 — String Enum Migration — Plan Is Correct But Migration File Is Misleading

**Severity: LOW**

The plan correctly identifies that `type_of_hacktivity` is a `string` column (confirmed in `db/schema.rb`: `t.string "type_of_hacktivity"`) and correctly states that no migration is needed to add a new string enum value — only a model update.

However, the plan simultaneously generates a migration file `TIMESTAMP_add_game_to_event_type.rb` containing a comment about `ALTER TYPE ... ADD VALUE 'game'` and then says "If using string column... No migration needed." This is contradictory and will cause confusion. The migration file would be a no-op, but its presence implies schema changes to reviewers and tools like `db:migrate:status`.

**Recommendation:** Remove the `TIMESTAMP_add_game_to_event_type.rb` migration file entirely from the plan. Update the File Change Summary table to remove it. Document the enum addition as a model-only change with no corresponding migration.

---

### Finding 11 — `reset_player_state!` Does Not Reset Game Status

**Severity: LOW**

The plan's `restart` action calls `game.reset_player_state!` and then redirects to the game. Examining `reset_player_state!` in `game.rb` (lines 32–38), it clears the player state but does **not** reset the `status` column. If a game was `completed`, the player will be redirected back to a completed game that looks like it has been reset, but with `status: 'completed'` still in the database. The `active_game_for` method used in `start` and `restart` filters by `status: 'in_progress'`, so a completed game would not even be found by `restart`, meaning the action would hit the "No active game found" error branch.

The intended behaviour for restart is unclear in the plan: should it allow restarting a completed game? Should it set `status` back to `in_progress`? This is likely an intentional use-case (re-attempting after completion), but neither the model nor the plan addresses it.

**Recommendation:** Clarify the restart use-case scope. If restarting completed games is in scope, `restart` must also query for completed games (adjust `active_game_for` or use a separate query), and `reset_player_state!` (or a wrapper method) must reset `status` to `'in_progress'`. If restarting completed games is out of scope, document this as a limitation.

---

### Finding 12 — `MissionListingPolicy` Does Not Replicate `access_revoked_by_org?`

**Severity: LOW**

`SecGenBatchPolicy#assign_vm_set?` (line 61) includes `!access_revoked_by_org?` as a gate. `MissionListingPolicy#start?` in the plan only checks `signed_up_to_event? && listing_available?`. Users whose org membership has been revoked would be permitted to start missions in game events even though they are blocked from the equivalent action on challenges.

**Recommendation:** Either add an `!access_revoked_by_org?` check to `MissionListingPolicy#start?` (by referencing `record.event`), or consciously document that game events do not enforce org-revocation gates in the initial release.

---

## Overall Assessment

The plan has a sound architectural approach and the phased structure (extract service first, then build on top) is correct. The schema analysis, scoring flow design, and cross-engine FK strategy are all solid.

However, **three findings are hard blockers** (Findings 1–3) that will prevent the application from starting or will cause immediate `NoMethodError` in production: the Ruby version incompatibility with `Data.define`, the non-existent job reference, and the unmounted engine. These must be fixed in the plan before any code is written.

The remaining findings are correctness issues that will produce subtle test failures or behavioural divergence from the existing assignment flow if not addressed. Findings 4, 5, 6, and 7 in particular are about the `VmSetAssignmentService` extraction — the highest-risk phase of the work — and collectively represent a meaningful risk of breaking existing `assign_vm_set` behaviour if the service is written from the plan description alone rather than from the controller source.

**Recommended next step:** Revise the plan to address Findings 1–7 before beginning Phase 2.
