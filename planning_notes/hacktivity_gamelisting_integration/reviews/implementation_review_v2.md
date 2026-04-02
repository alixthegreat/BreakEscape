# Implementation Review v2
## MissionListing Integration Plan — Hacktivity × BreakEscape (Revision 2)

**Reviewer:** Senior Rails Developer (second-pass review, 2026-03-28)
**Plan file:** `planning_notes/hacktivity_gamelisting_integration/plan.md` (Revision 2)
**Previous review:** `planning_notes/hacktivity_gamelisting_integration/reviews/implementation_review.md`

---

## Resolution Status of Original Findings

| # | Finding | Severity | Status | Notes |
|---|---|---|---|---|
| 1 | `Data.define` not available on Ruby 2.7 | BLOCKER | **Resolved** | Plan uses `Struct.new(..., keyword_init: true)` with an explicit comment naming the Ruby version constraint |
| 2 | `OvirtRevertSnapshotJob` does not exist | BLOCKER | **Resolved** | Replaced with `DispatchVmCtrlService.ctrl_vm_async(vm, "revert_snapshot", "original")` loop |
| 3 | Engine not mounted; `break_escape_game_path` unavailable | BLOCKER | **Resolved** | Engine mount added as a named pre-requisite; all path references updated to `break_escape.game_path(game)` |
| 4 | Wait-quota redirect logic inverted in description | HIGH | **Resolved** | `redirect_key` symbol approach adopted; premium → `:plans`, guest → `:event`; comment documents the counterintuitive behaviour explicitly |
| 5 | `challenge_not_started?` missing admin/VIP bypass | HIGH | **Resolved** | `challenge_not_started?` uses `@user` and correctly replicates the `admin? \|\| scoped_vip_by_event?` bypass |
| 6 | Off-by-one in `batch_quota_exceeded?` not flagged | MEDIUM | **Resolved** | `batch_quota_exceeded?` uses `count > (max \|\| 1)` with an explicit comment warning against changing `>` to `>=` |
| 7 | `vm_set.sec_gen_batch = @sec_gen_batch` reassignment not called out | MEDIUM | **Resolved** | `assign!` includes the reassignment with a block comment explaining why it is required |
| 8 | Double GA4 event fire not acknowledged | MEDIUM | **Partially Resolved** | The plan documents a `vm_set_assigned` event fired from the service and a `mission_started` event fired from the controller. The intent to fire both is now deliberate. However, the service hardcodes `team_assignment: false` whereas the original controller passes `vm_set.sec_gen_batch.vm_sets_shared_by_team` — this is a data loss in analytics. See New Finding 1. |
| 9 | `acts_as_list` not available; model code was wrong | MEDIUM | **Resolved** | `acts_as_list` removed; manual `set_default_position` callback implemented as recommended |
| 10 | No-op migration file for string enum | LOW | **Resolved** | Migration file removed; change documented as model-only with no corresponding migration |
| 11 | `reset_player_state!` does not reset game status | LOW | **Resolved** | Plan documents restarting completed games as out of scope; `active_game_for` filters `in_progress` only; limitation is noted in the Key Decisions table and in the restart action comment |
| 12 | `MissionListingPolicy` missing `access_revoked_by_org?` | LOW | **Resolved** | Policy now includes `!access_revoked_by_org?` in `start?` |

---

## New Findings

### Finding 1 — `restart` Action Does Not Enforce VM Powered-Down Pre-condition

**Severity: HIGH**

The plan's `restart` action calls:

```ruby
vm_set.vms.each do |vm|
  DispatchVmCtrlService.ctrl_vm_async(vm, "revert_snapshot", "original")
end
```

A comment in the plan states: _"VMs should be shut down first; DispatchVmCtrlService handles this internally."_ This is incorrect. `DispatchVmCtrlService` does not enforce a power-down pre-condition internally. The responsibility lies with the caller, as demonstrated in `VmSetsController#ovirt_revert_snapshot_vm_set` (lines 74–80):

```ruby
@vm_set.vms.each do |vm|
  next unless vm.state != "down"
  flash[:error] = "You need to power down every VM before reverting..."
  return
end
```

The check is a full abort with a user-facing error — not a silent guard inside `DispatchVmCtrlService`. Sending a `revert_snapshot` command to a running VM is likely to fail or produce an inconsistent snapshot state depending on the hypervisor backend.

**Recommendation:** Add the powered-down pre-check to the `restart` action before dispatching the revert, mirroring the `VmSetsController` pattern. Because this is a user-initiated restart rather than an admin-initiated revert, the appropriate response is a flash error redirecting back to the event page rather than silently skipping the revert. Example:

```ruby
running_vms = vm_set.vms.reject { |vm| vm.state == "down" }
if running_vms.any?
  flash[:error] = "Please shut down all VMs before restarting this mission."
  return redirect_to event_path(@event), status: :see_other
end
```

Also remove the inaccurate comment claiming `DispatchVmCtrlService` handles this.

---

### Finding 2 — `Ga4Service.track_event` in `assign!` Hardcodes `team_assignment: false`

**Severity: MEDIUM**

The original controller passes the actual batch setting to the `vm_set_assigned` analytics event:

```ruby
Ga4Service.track_event(
  name: 'vm_set_assigned',
  user: current_user,
  params: {
    vm_set_id: vm_set.id,
    batch_id: @sec_gen_batch.id,
    team_assignment: @sec_gen_batch.vm_sets_shared_by_team   # <-- real value
  }
)
```

The plan's service hardcodes `team_assignment: false`:

```ruby
params: { vm_set_id: vm_set.id, batch_id: @sec_gen_batch.id, team_assignment: false }
```

This will silently misreport team-assignment events in analytics for any batch where `vm_sets_shared_by_team` is true. Since `VmSetAssignmentService` is scoped to the individual-user path only (team path is unchanged in the controller), `vm_sets_shared_by_team` should be `false` for all batches routed through this service, but the plan does not document this assumption. If the service is later extended to cover team assignments, this hardcoded value will produce silent analytics errors.

**Recommendation:** Either pass the actual value — `team_assignment: @sec_gen_batch.vm_sets_shared_by_team` — or add an explicit comment explaining that this service is restricted to the individual-user path and `vm_sets_shared_by_team` is expected to be `false` for any batch that reaches it, along with a guard (`raise` or early return) if `@sec_gen_batch.vm_sets_shared_by_team` is true.

---

### Finding 3 — `ownership_error` Message Loses `over_by_amount` Detail

**Severity: LOW**

The original controller computes the number of vm_sets to relinquish and includes it in the error message (line 260–261):

```ruby
over_by_amount = success_vm_sets_count - max_vm_set_owned + 1
flash[:error] = "You cannot own more than #{max_vm_set_owned} VM sets. Please relinquish #{over_by_amount} VM sets ..."
```

The plan's `ownership_error` returns a static string:

```ruby
error_message: "You cannot own more VM sets. Please relinquish some before trying again."
```

This drops both the specific quota number and the specific relinquish count. Users who hit this error lose actionable information (they no longer know how many sets to relinquish or what their quota is). Existing controller tests (`sec_gen_batches_controller_test.rb` line 422–423) assert the exact message format including `over_by_amount`, so the existing controller test suite will fail when the controller is refactored to use the service.

**Recommendation:** Pass `max_vm_set_owned` and `over_by_amount` through to the error message, or expose them as separate fields on `Result` so the controller can format the message. The simplest fix is to compute and embed them in `ownership_error`:

```ruby
def ownership_error
  over_by_amount = count - max_vm_set_owned + 1
  Result.new(
    success: false, vm_set: nil, redirect_key: :event,
    error_message: "You cannot own more than #{max_vm_set_owned} VM sets. " \
                   "Please relinquish #{over_by_amount} VM sets (click the Relinquish button on VMs you are finished with), then try again."
  )
end
```

Note: the existing test at line 415 sets `Rails.application.config.max_vm_set_owned = 1` (a single unified config key) whereas `quota_config.rb` defines separate `max_vm_set_owned_guest` and `max_vm_set_owned_premium` keys. If that test is updated to cover the service, the fixture setup will need to set both variant keys. Flag this when writing the characterization tests in Phase 2.2.

---

### Finding 4 — `DispatchVmCtrlService.ctrl_vm_async` Signature Confirmed; No Issue

**Severity: N/A (verification, no defect)**

The plan calls `DispatchVmCtrlService.ctrl_vm_async(vm, "revert_snapshot", "original")`. The service definition (`app/services/dispatch_vm_ctrl_service.rb` line 16) is:

```ruby
def self.ctrl_vm_async(vm, command, argument)
```

The plan's call site matches the actual three-argument signature exactly. No issue.

---

### Finding 5 — `BreakEscape::Game.where(player: user)` Polymorphic Query Is Correct

**Severity: N/A (verification, no defect)**

The plan's `active_game_for` uses `BreakEscape::Game.where(player: user, ...)`. `BreakEscape::Game` declares `belongs_to :player, polymorphic: true`. ActiveRecord handles `where(player: object)` on a polymorphic association correctly: it automatically expands to `WHERE player_type = '...' AND player_id = ...` using the object's class name and id. No `player_type` needs to be set manually. This is standard Rails behaviour and the query is correct.

---

### Finding 6 — `add_foreign_key :mission_listings, :break_escape_missions` Table Name Is Correct

**Severity: N/A (verification, no defect)**

The `BreakEscape::Mission` model sets `self.table_name = 'break_escape_missions'` (confirmed in `app/models/break_escape/mission.rb` line 3 and the engine's migration at `db/migrate/20251120155357_create_break_escape_missions.rb`). The plan's migration uses `add_foreign_key :mission_listings, :break_escape_missions, column: :break_escape_mission_id`. This matches the actual table name. No issue.

---

### Finding 7 — `break_escape.game_path` Available in Controller Tests Without Extra Setup

**Severity: N/A (verification, no defect)**

Hacktivity's controller tests inherit from `ActionDispatch::IntegrationTest` (confirmed via `test_helper.rb` line 300). In Rails integration tests, mounted engine routing proxies (e.g. `break_escape.game_path`) are available automatically once the engine is mounted in `config/routes.rb`. No additional `include` or test-helper setup is required. The plan's approach is correct.

---

### Finding 8 — `Result` Constant Ambiguity in `MissionListingsController`

**Severity: LOW**

The `start` action in `MissionListingsController` calls:

```ruby
Result.find_or_create_by(user: current_user, event: @event)
```

The bare `Result` constant here refers to Hacktivity's `Result` model, which is the correct intent (enrolling the user in the event scoreboard). However, `VmSetAssignmentService::Result` is also a constant named `Result` defined inside a service class. These are in different namespaces and Ruby will resolve `Result` to the top-level `::Result` model in the controller context — so there is no runtime collision.

The risk is a readability one: a developer scanning the controller who is aware of `VmSetAssignmentService::Result` may be momentarily confused. The plan does not acknowledge this potential confusion.

**Recommendation:** Add a brief comment on the `Result.find_or_create_by` line — e.g. `# Hacktivity::Result (scoring model), not VmSetAssignmentService::Result` — to preempt confusion during code review.

---

## Overall Assessment

Revision 2 has successfully addressed all three original blockers and all four high-severity findings. The architectural decisions (engine mount, Struct-based result, admin/VIP bypass, parent-pool reassignment comment, manual position management) are all correctly implemented.

**Two issues require attention before implementation begins:**

- **Finding 1 (HIGH):** The VM powered-down pre-check must be added to the `restart` action. The incorrect comment claiming `DispatchVmCtrlService` handles this internally must be removed. Triggering a revert on running VMs is a real operational risk.
- **Finding 3 (LOW, but will break existing tests):** The `ownership_error` message must include `max_vm_set_owned` and `over_by_amount`. The existing controller test suite asserts this exact message format; the refactor will produce a test regression if this is not addressed.

Finding 2 (analytics `team_assignment` hardcoding) is a data quality issue that will not cause a test failure but should be fixed for analytics integrity.

Findings 4–8 are all verification results confirming that plan details are correct, with the exception of Finding 8, which is a minor readability note requiring only a comment.

**Recommended next step:** Fix Findings 1 and 3 in the plan, then begin Phase 2 implementation.
