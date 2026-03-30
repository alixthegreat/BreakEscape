# Implementation Review — v3
## MissionListing Integration Plan — Hacktivity × BreakEscape (Revision 4)

**Reviewer:** Senior Rails Developer (third-pass review, 2026-03-30)
**Plan file:** `planning_notes/hacktivity_gamelisting_integration/plan.md` (Revision 4)
**Previous review:** `planning_notes/hacktivity_gamelisting_integration/reviews/implementation_review_v2.md`

---

## Scope

This review covers the new material added in Revision 4: the `vm_activation_mode` enum on `BreakEscape::Mission` (Phase 1.4), the `vm_panel` engine action and iframe integration (Phase 1.6), the four VM lifecycle endpoints on `GameSlotsController` (Phase 4.4.1), and the Phaser VM HUD specification (Phase 4.4.2). All findings from the v2 review have been confirmed as resolved in the plan text and are not re-raised here. Source files consulted for ground truth: `app/controllers/break_escape/games_controller.rb`, `app/views/break_escape/games/show.html.erb`, `public/break_escape/js/minigames/vm-launcher/vm-launcher-minigame.js`, `public/break_escape/css/vm-launcher-minigame.css`, `app/models/break_escape/mission.rb`, `app/controllers/vms_controller.rb` (Hacktivity), `app/controllers/vm_sets_controller.rb` (Hacktivity), and `app/views/layouts/application.html.erb` (Hacktivity, lines 55–75).

---

## Findings

### IMPL-v3-1: `extend_vms` Does Not Set `activated_until` — Returns Nil in Response

**Severity:** Critical
**Phase:** 4.4.1 (`extend_vms` action), 4.4.2 (Phaser HUD countdown)

**Finding:** The plan's `extend_vms` action calls `DispatchVmCtrlService.ctrl_vm_async(vm, "activate", nil)` and then `vm_set.update_columns(activated: true, allocated_date: Time.current)`. It does not set `activated_until`. The response claims `activated_until: vm_set.activated_until&.iso8601`, but since `update_columns` never writes `activated_until`, this value will be `nil` on first activation and unchanged (stale) on subsequent calls.

The real `VmSetsController#activate` (lines 202–211 of `vm_sets_controller.rb`) sets `activated_until` explicitly based on user tier:

```ruby
@vm_set.activated_until = Time.current + initial_timer_start
```

where `initial_timer_start` is `Rails.configuration.vm_set_activation_timer_start_premium` or `vm_set_activation_timer_start_guest`. The `extend_vms` plan action entirely skips this logic. As a result:

1. The HUD countdown will never start — `activated_until` remains `nil`, so "Time remaining" shows nothing.
2. The `vm_status` response will also return `activated_until: nil` even after activation, breaking the amber/green colour state logic.
3. There is no timer-based auto-shutdown because `activated_until` is never written.

**Recommendation:** The `extend_vms` action must replicate the `activated_until` logic from `VmSetsController#activate`. Add before `update_columns`:

```ruby
timer_duration = current_user.has_premium_quota? \
  ? Rails.configuration.vm_set_activation_timer_start_premium \
  : Rails.configuration.vm_set_activation_timer_start_guest
vm_set.update_columns(activated: true, activated_until: Time.current + timer_duration)
```

For subsequent calls (Extend button), use the extend-timer config keys (`vm_set_activation_timer_extend_premium` / `vm_set_activation_timer_extend_guest`) instead. The plan should distinguish the first-activation path from the extend path — they use different config keys in the existing `activate` action (lines 117–124 of `vm_sets_controller.rb`). The simplest approach is to branch on `vm_set.activated?`: use start keys when first activating, extend keys when already activated. The `extend_vms` response's `activated_until` field will then carry a real timestamp for the HUD.

---

### IMPL-v3-2: `vm_panel` Route Helper Name Is Wrong in ERB Snippet

**Severity:** High
**Phase:** 1.6.2 (`vmPanelUrl` ERB snippet)

**Finding:** The plan specifies adding this to `window.breakEscapeConfig` in `show.html.erb`:

```javascript
vmPanelUrl: '<%= BreakEscape::Mission.hacktivity_mode? ? vm_panel_game_path(@game) : '' %>',
```

The route helper name for a member action named `vm_panel` on a `games` resource is `vm_panel_game_path`, not `game_vm_panel_path`. However, the convention Rails uses for member routes is `{action}_{singular_resource}_path`. Consulting the actual routes file, the games resource is declared as `resources :games` with a `member do` block. Rails generates the member route as `vm_panel_game_path(game)` — so the helper name is actually correct.

However, there is a real problem: the `vm_panel` action has not yet been added to the `before_action :set_game` filter list in the controller at the time the plan specifies it. The plan says "Add `vm_panel` to the `set_game` before_action filter" in Phase 1.6.1, but the actual controller's before_action list is long and manually maintained (line 7 of `games_controller.rb`). The plan does not reproduce the full updated before_action line, leaving the developer to locate and modify it without guidance. If `vm_panel` is not added to the filter, `@game` will be nil and `authorize @game` will raise `Pundit::NotAuthorizedError` (or nil pointer).

**Recommendation:** Add the full updated `before_action` line to Phase 1.6.1, explicitly showing `vm_panel` appended to the existing list. Do not leave this as an implicit "also add it to the filter" instruction.

---

### IMPL-v3-3: `vm_panel` Uses `Rails.application.routes.url_helpers` Without a Host — Will Raise in Production

**Severity:** High
**Phase:** 1.6.1 (`vm_panel` action)

**Finding:** The plan's `vm_panel` action calls:

```ruby
redirect_to Rails.application.routes.url_helpers.event_sec_gen_batch_vm_set_vm_path(
  vm_set.sec_gen_batch.event,
  vm_set.sec_gen_batch,
  vm_set,
  vm,
  embedded: 1
)
```

`Rails.application.routes.url_helpers` generates URL helpers that are unbound from a request context. The `_path` helpers (relative paths) should work fine here — they do not require a host. This is technically correct for `_path`. However, the deeper issue is that `vm_set.sec_gen_batch.event` performs two chained ActiveRecord calls that are not guarded: if `vm_set.sec_gen_batch` is nil (a VM set that has been detached from its batch by an admin), calling `.event` on nil will raise `NoMethodError`. The plan guards `vm_set` being nil but does not guard `vm_set.sec_gen_batch` being nil.

**Recommendation:** Add a nil guard on `sec_gen_batch` before the redirect:

```ruby
batch = vm_set.sec_gen_batch
return head :not_found unless batch
```

This mirrors the nil-guard pattern the plan uses for `vm_set` itself.

---

### IMPL-v3-4: `Outcome` Constant Defined Inside an Instance Method — Constant Leaks to Controller Scope

**Severity:** High
**Phase:** 4.3 (`create_game_for_listing` private method)

**Finding:** The plan defines the `Outcome` struct inside the `create_game_for_listing` method:

```ruby
def create_game_for_listing(game_slot, user)
  Outcome = Struct.new(:game, :error_message, :redirect_key, keyword_init: true) do
    def error? = error_message.present?
  end
  ...
end
```

Assigning a constant inside a method body in Ruby defines that constant on the enclosing module (here, `GameSlotsController`), not locally to the method. The first call works fine. On the second call, Ruby will emit a `warning: already initialized constant GameSlotsController::Outcome` and re-assign the constant. In a threaded server (Puma), two simultaneous requests hitting this method will race to re-define `Outcome`, which is not thread-safe. Even in single-threaded environments, the warning will pollute logs on every request. Rubocop will flag this as `Lint/ConstantDefinitionInBlock`.

**Recommendation:** Move `Outcome` to a proper constant outside the method, either as a class-level constant in `GameSlotsController` or as a nested struct defined at the top of the class body:

```ruby
class GameSlotsController < ApplicationController
  Outcome = Struct.new(:game, :error_message, :redirect_key, keyword_init: true) do
    def error? = error_message.present?
  end
  private_constant :Outcome
  ...
end
```

---

### IMPL-v3-5: Lazy Activation — `extend_vms` Called from Phaser Client Has No CSRF Token Guidance

**Severity:** Medium
**Phase:** 4.4.2 (Phaser HUD specification — lazy activation trigger)

**Finding:** The HUD specification says the Phaser client POSTs to `/events/:event_id/missions/:id/extend_vms` when a `requiresVM` interaction is first triggered. `GameSlotsController` inherits from `ApplicationController`, which includes Rails CSRF protection (`protect_from_forgery`). The existing `breakEscapeConfig` already exposes `csrfToken` (confirmed in `show.html.erb` line 143), but the Phaser HUD specification makes no mention of how the HUD component should obtain and send this token. The plan says the `event_id` and `game_slot_id` URLs are "injected via ScenarioBinding/scenario_data mechanism or as separate data attributes" — but does not specify a concrete mechanism, leaving a developer to guess.

A missing CSRF token on the POST will result in a `422 Unprocessable Entity` (ActionController::InvalidAuthenticityToken), which from the player's perspective will silently appear as "Could not start VMs — please try again."

**Recommendation:** Phase 4.4.2 should explicitly specify: (1) that the HUD JS reads `window.breakEscapeConfig.csrfToken` and includes it as the `X-CSRF-Token` request header on all POST calls; (2) the concrete mechanism for injecting `extendVmsUrl`, `shutdownVmsUrl`, `finishUrl`, and `vmStatusUrl` into the Phaser game — either as additions to `window.breakEscapeConfig` in `show.html.erb` (the simplest option, consistent with existing `vmSetId`, `hacktivityMode` etc.) or via the scenario data. The plan's file change table lists `app/javascript/break_escape/config.js` as "Accept VM endpoint URLs from scenario data" but `show.html.erb` is a more natural injection point given the pattern already established there.

---

### IMPL-v3-6: `vm_activation_mode` Validation Does Not Match Default Column Value Casing

**Severity:** Medium
**Phase:** 1.4 (`vm_activation_mode` migration + model validation)

**Finding:** The migration adds the column with `default: 'eager'` (lowercase string). The model validation uses:

```ruby
VM_ACTIVATION_MODES = %w[eager lazy].freeze
validates :vm_activation_mode, inclusion: { in: VM_ACTIVATION_MODES }
```

This is consistent — `'eager'` and `'lazy'` are lowercase in both the default and the constant. However, there is no `allow_nil: false` or explicit `presence` validation on `vm_activation_mode`. The column is `null: false` with a default, so a nil value cannot be persisted via SQL. But in-memory, a Ruby object can have `vm_activation_mode = nil` before saving: `Mission.new.vm_activation_mode` returns `'eager'` (from the DB default on `new` via ActiveRecord attribute defaults), so this is fine in practice. The real gap is that the plan does not add `vm_activation_mode` to any admin form or seed data. A developer creating a `BreakEscape::Mission` via Rails console or fixtures without specifying `vm_activation_mode` will get `'eager'` silently, which is the correct default — but the plan has no smoke test step for the `lazy` path at the `Mission` model level (only at the controller/flow level in step 10). The `test/models/break_escape/mission_test.rb` coverage item in Phase 1.5 is listed only in the file change summary, not spelled out in the Phase 1.5 test list, creating risk that it will be skipped.

**Recommendation:** Add explicit test cases for `vm_activation_mode` to the Phase 1.5 test list: valid with `'eager'`, valid with `'lazy'`, invalid with any other string, invalid with `nil` (even though the column default prevents nil in SQL, the model validation should catch it). Also confirm that the `BreakEscape::Mission` admin form (if one exists in the engine) exposes `vm_activation_mode` for editing.

---

### IMPL-v3-7: `finish` Action Dispatches Stop Commands Inside a Transaction — External I/O in Transaction

**Severity:** Medium
**Phase:** 4.4.1 (`finish` action)

**Finding:** The plan's `finish` action wraps both the game status update and the `DispatchVmCtrlService.ctrl_vm_async` calls inside a single `ApplicationRecord.transaction`:

```ruby
ApplicationRecord.transaction do
  game.update!(status: 'completed')
  vm_set = ...
  if vm_set
    vm_set.update_columns(relinquished: true)
    vm_set.vms.each do |vm|
      DispatchVmCtrlService.ctrl_vm_async(vm, "stop", nil)
    end
  end
end
```

`DispatchVmCtrlService.ctrl_vm_async` enqueues an async job (confirmed by the method name and its usage pattern throughout the codebase). Enqueuing a job inside a transaction is a known Rails footgun: if the job is backed by a database queue (Delayed::Job, Solid Queue) the enqueue itself is part of the transaction and will be rolled back if the transaction fails. If backed by an in-memory or Redis queue, the job may fire before the transaction commits, seeing a stale `relinquished: false` state. Either way, the `after_commit` callback on `game` (`fire_completion_callback`) also fires after the transaction commits — meaning the scoring job will run concurrently with a stop dispatch that may not have been committed yet.

**Recommendation:** Move the `DispatchVmCtrlService.ctrl_vm_async` calls outside the transaction. The transaction should only cover the database writes (`game.update!` and `vm_set.update_columns`). The stop dispatch is a side-effect that should happen after the transaction commits. Restructure as:

```ruby
ApplicationRecord.transaction do
  game.update!(status: 'completed')
  vm_set&.update_columns(relinquished: true)
end
# After commit: dispatch stop commands
vm_set&.vms&.each { |vm| DispatchVmCtrlService.ctrl_vm_async(vm, "stop", nil) }
```

---

### IMPL-v3-8: iframe Branch Condition Checks `this.hacktivityMode` but Plan Injects `vmPanelUrl` Instead

**Severity:** Medium
**Phase:** 1.6.3 (vm-launcher JS iframe branch)

**Finding:** The plan's iframe branch condition is:

```javascript
if (this.hacktivityMode && this.vmPanelUrl) {
```

`this.hacktivityMode` is already read from `params.hacktivityMode` in the constructor (confirmed at line 16 of the actual `vm-launcher-minigame.js`). `this.vmPanelUrl` is read from `window.breakEscapeConfig?.vmPanelUrl`. The plan states: "Empty string in standalone mode; the minigame checks for a non-empty value before using it."

The condition `this.hacktivityMode && this.vmPanelUrl` is logically sound — both must be true. However, `this.vmPanelUrl` is set to `null` via `window.breakEscapeConfig?.vmPanelUrl || null` when the config key is absent. An empty string (`''`), which the ERB produces in standalone mode, is falsy in JavaScript — so the guard works correctly. But there is a subtle redundancy: if `hacktivity_mode?` is false, the ERB produces `''`, meaning `this.vmPanelUrl` will be `null` (because `'' || null` evaluates to `null`). The `this.hacktivityMode` check therefore adds no additional protection — the `this.vmPanelUrl` check alone is sufficient. This is not a bug, but the comment in the plan ("the minigame checks for a non-empty value") is slightly misleading since the JS converts empty string to null before the check.

More importantly: the existing `buildUI()` method injects styles inline via a `<style>` element (lines 29–30 of the actual JS file). The plan says "add iframe branch at top of `buildUI()`, before the existing style injection." If the developer places the `return` early exit before the style injection, the `.vm-launcher-iframe` div will be appended without the inline styles being injected. However, the iframe div uses the class `.vm-launcher-iframe`, which is styled via the external CSS file (Phase 1.6.4), not the inline `<style>` block. The inline block styles `.vm-launcher`, `.vm-card`, etc. — none of which apply to the iframe path. So the early return before style injection is actually correct and intentional. The plan should make this explicit to avoid a developer "fixing" it by moving the iframe branch after the style injection.

**Recommendation:** Add a comment to the plan noting that the early `return` intentionally skips inline style injection, because the iframe path uses only the external CSS classes (`.vm-launcher-iframe`) and none of the inline-styled classes (`.vm-card`, `.vm-list`, etc.).

---

### IMPL-v3-9: `vm_status` Polling URL in Plan Uses Wrong Path Format

**Severity:** Medium
**Phase:** 4.4.2 (Phaser HUD polling specification)

**Finding:** The plan's polling specification states:

> The Phaser client polls `GET /game_slots/:id/vm_status` every 30 seconds...

But the routes defined in Phase 4.1 nest `game_slots` inside `events`:

```ruby
resources :game_slots, path: "missions", only: [] do
  get  "vm_status", on: :member
  ...
end
```

This generates the path `/hacktivities/:event_id/missions/:id/vm_status` (or `/events/:event_id/missions/:id/vm_status` depending on the outer `events` resource path). The shorthand `/game_slots/:id/vm_status` in the polling spec is wrong — it omits the `event_id` segment and uses `game_slots` instead of the `missions` path alias. A developer implementing the Phaser HUD from this spec will construct incorrect URLs.

The `event_id` is required both by the route and by the controller's `set_event` before_action. The plan mentions in Phase 4.4.2 that `event_id` and `game_slot_id` must be injected at boot time, but does not state their source clearly enough to prevent the path error.

**Recommendation:** Update all URL examples in Phase 4.4.2 to use the full nested path: `/hacktivities/:event_id/missions/:id/vm_status` (or use the Rails route helper name `vm_status_event_game_slot_path(event_id:, id:)` as a reference). Confirm that `event_id` is available to the Phaser client — the most natural source is an addition to `window.breakEscapeConfig` in `show.html.erb` alongside `vmStatusUrl` etc.

---

### IMPL-v3-10: `Outcome` Struct `error?` Method Conflicts With Empty `error_message` on Success

**Severity:** Low
**Phase:** 4.3 (`create_game_for_listing` return value)

**Finding:** The `Outcome` struct defines `error? = error_message.present?`. On the success path, `Outcome.new(game: game)` is returned — `error_message` is not provided and will default to `nil`. `nil.present?` returns `false`, so `error?` correctly returns `false`. This is fine.

However, `redirect_key` is also omitted on the success path and will be `nil`. The `start` action reads `outcome.redirect_key == :plans` — comparing `nil == :plans` returns `false`, so the fallback `event_path(@event)` is used for error redirects. This is correct, but it means the success branch and the event-redirect error branch are indistinguishable by `redirect_key` alone. If a future developer adds another error case that needs a different path, they will need to check `outcome.error?` first, which is the intended pattern. The plan does not document this usage contract.

**Recommendation:** Add a brief comment to `Outcome` noting that `redirect_key` is only meaningful when `error?` is true, and that callers must check `error?` before inspecting `redirect_key`.

---

### IMPL-v3-11: Phase 1.6 Has No Tests Specified

**Severity:** Low
**Phase:** 1.6 (vm-launcher iframe integration)

**Finding:** Phase 1.5 specifies tests for Phase 1.1–1.4 changes. Phase 1.6 (the `vm_panel` action, `vmPanelUrl` ERB injection, iframe JS branch, and CSS) has no corresponding test section. The Phase 1.6.5 file change table lists the affected files but does not call out any tests. The controller action (`vm_panel`) is testable: not-found scenarios (no `vm_set_id`, VM-free mission, vm not found, batch nil), and the redirect to the correct Hacktivity URL with `embedded: 1`.

**Recommendation:** Add a Phase 1.6.6 test section listing:
- `vm_panel`: returns 404 when `hacktivity_mode?` is false
- `vm_panel`: returns 404 when `game.vm_set_id` is nil
- `vm_panel`: returns 404 when `VmSet` not found
- `vm_panel`: returns 404 when `vm_set.sec_gen_batch` is nil (guard added per IMPL-v3-3)
- `vm_panel`: returns 404 when no VM matches `vm_title` param
- `vm_panel`: with valid game + vm_set + vm, redirects to correct Hacktivity VM path with `embedded: 1`
- `vm_panel`: with no `vm_title` param, falls back to `vms.first`

---

### IMPL-v3-12: `eager` Activation Block in `start` Silently Skips If VmSet Not Found

**Severity:** Low
**Phase:** 4.4.1 (start action eager activation block)

**Finding:** The eager activation block added to `GameSlotsController#start` is:

```ruby
vm_set = ::VmSet.find_by(id: outcome.game.vm_set_id)
if vm_set
  vm_set.vms.each { |vm| DispatchVmCtrlService.ctrl_vm_async(vm, "activate", nil) }
  vm_set.update_columns(activated: true, allocated_date: Time.current)
end
```

If `find_by` returns nil (e.g. the VmSet was deleted between game creation and this line — extremely unlikely but possible within the same request if the transaction committed and a background job immediately reaped it), the VMs are never activated and the user enters the game in an unactivated state. There is no log line, flash message, or error response. The user will see the game but VMs will be down, and the HUD will show red with no explanation.

This is the same pattern as `shutdown_vms` and `finish` in the plan — all use `find_by` with a silent nil guard. For `shutdown_vms` and `finish` this is reasonable (the user explicitly asked for those actions and the JSON error response covers it). For `start`, a silent failure is more surprising.

**Recommendation:** Add a `Rails.logger.warn` inside the `if vm_set` nil branch for the eager activation block, so at minimum the anomaly is observable in logs. Consider also emitting a Honeybadger/Sentry error notice if the application uses an error tracker, since a missing VmSet at this point indicates a data consistency issue.

---

## Summary

Revision 4 adds substantial new scope (VM lifecycle endpoints, lazy/eager activation mode, in-game Phaser HUD, iframe minigame integration) and the plan is generally well-structured. However, there are implementation gaps that would cause real failures in production.

**Findings by severity:**

| Severity | Count |
|---|---|
| Critical | 1 |
| High | 3 |
| Medium | 4 |
| Low | 3 |
| Info | 0 |

**The plan is not ready for implementation without addressing the following:**

- **IMPL-v3-1 (Critical):** `extend_vms` does not set `activated_until`. The HUD countdown will never work and the auto-shutdown timer will not be armed. This must be fixed before any VM lifecycle code is written.
- **IMPL-v3-2 (High):** The `vm_panel` before_action update is underspecified. The developer must be given the full updated line to avoid silently breaking game authorization.
- **IMPL-v3-3 (High):** `vm_set.sec_gen_batch.event` has no nil guard. A detached VmSet will cause a `NoMethodError` in the `vm_panel` action.
- **IMPL-v3-4 (High):** `Outcome` constant defined inside a method body is not thread-safe and will produce warnings on every request. Move it to class-level before Phase 4 implementation begins.

IMPL-v3-5 (CSRF token guidance for Phaser HUD POSTs) and IMPL-v3-7 (I/O inside transaction in `finish`) are medium-severity concerns that should be fixed in the plan before implementation of Phase 4.4. IMPL-v3-6, IMPL-v3-8, IMPL-v3-9, IMPL-v3-10, IMPL-v3-11, and IMPL-v3-12 are lower-risk but should all be addressed in the plan text before implementation reaches those phases.

**Recommended next step:** Fix IMPL-v3-1, v3-2, v3-3, and v3-4 in the plan, then proceed with Phase 1.4–1.6 implementation.
