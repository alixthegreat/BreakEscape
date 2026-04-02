# Implementation Review — v4
## GameSlot Integration Plan — BreakEscape × Hacktivity (Revision 5)

**Reviewer:** Senior Rails Developer
**Date:** 2026-03-30
**Plan version:** Revision 5
**Previous review:** `planning_notes/hacktivity_gamelisting_integration/reviews/implementation_review_v3.md`

---

## Scope

This review covers **new issues in Revision 5 only**. All twelve findings from the v3 review (IMPL-v3-1 through IMPL-v3-12) are treated as resolved unless the Revision 5 fix is incorrect or incomplete. Where a Revision 5 fix introduces a new problem, that problem is raised as a new finding rather than a re-raise of the original.

Findings from the concurrent architecture review (ARCH-v4-1 through ARCH-v4-8) are not duplicated here. However, ARCH-v4-4 (enable_console race) and ARCH-v4-5 (missing Pundit policy methods) interact directly with the code in this review and are cross-referenced where relevant.

---

## Findings

---

### IMPL-v4-1: `extend_vms` called directly from `start` — `AbstractController::DoubleRenderError` on every eager-mode game start

**Severity:** Critical
**Phase:** 4.4.1 (start action, eager activation block)

**Finding:**

The plan's eager activation block in `GameSlotsController#start` reads:

```ruby
if @game_slot.vm_backed? &&
   @game_slot.break_escape_mission.vm_activation_mode == 'eager'
  extend_vms  # delegates to the extend_vms action which renders JSON — suppress render here
  # Implementation note: extract the activation logic into a private method
  # activate_vm_set!(vm_set, user) shared by both start and extend_vms.
end
```

`extend_vms` ends with:

```ruby
render json: { ok: true, activated_until: vm_set.activated_until.iso8601 }
```

After `extend_vms` returns, `start` continues and issues its own response — either `redirect_to` on success or `render` on error. Rails tracks whether a response has been committed via `performed?`. The second response call raises `AbstractController::DoubleRenderError`, which manifests as an unhandled 500 to the player on every eager-mode game start.

The parenthetical comment "suppress render here" acknowledges the problem but provides no solution. The "Implementation note: extract the activation logic into a private method" is a correct prescription but is presented as a future note rather than as the mandatory fix it is. The code as written cannot be shipped.

This is not a subtle race or an edge case — it fires 100% of the time the eager branch is taken.

**Recommendation:**

Remove the `extend_vms` call from `start` entirely. Extract the activation logic into a private method, e.g.:

```ruby
def activate_vm_set_for_game!(game, user)
  vm_set = ::VmSet.find_by(id: game.vm_set_id)
  return unless vm_set

  timer = user.has_premium_quota? \
    ? Rails.configuration.vm_set_activation_timer_start_premium
    : Rails.configuration.vm_set_activation_timer_start_guest

  vm_set.vms.each { |vm| DispatchVmCtrlService.ctrl_vm_async(vm, "activate", nil) }

  vm_set.activated      = true
  vm_set.activated_since ||= Time.current
  vm_set.allocated_date   = Time.current
  vm_set.activated_until  = Time.current + timer
  vm_set.save!
end
```

Call this method from both `start` (for eager mode) and from `extend_vms` (after the `!vm_set.activated` branch splits from the extend path). `extend_vms` continues to `render json:` as before; `start` never calls `render` inside the activation path.

Phase 4.4.1 must show this extraction explicitly, not as an "implementation note". This is blocking — nothing in Phase 4.4.1 is deployable until the double-render is resolved.

---

### IMPL-v4-2: `activate_vm_set!` private method is referenced but never defined — concrete implementation gap

**Severity:** High
**Phase:** 4.4.1 (start, extend_vms — shared activation logic)

**Finding:**

Even if a developer reads the "Implementation note" and understands they must extract the activation logic, the plan provides no specification of the extracted private method's contract:

1. **What does it return?** If the VmSet is not found, the current `extend_vms` renders `{ error: "No VmSet found for this game" }` and returns. In `start`, a missing VmSet at the eager activation point is an unexpected data inconsistency (game was just created with a `vm_set_id`). Should `start` fail and return an error response, or proceed and let the player enter the game with VMs down? The plan does not answer this.

2. **What happens if `save!` raises?** `vm_set.save!` inside the shared method could raise `ActiveRecord::RecordInvalid`. In `extend_vms`, this would bubble as a 500. In `start`, the game has already been created (`create_game_for_listing` already committed), so the game exists but VMs are not activated. The player is in a half-started state.

3. **What about the `DispatchVmCtrlService.ctrl_vm_async` calls in `extend_vms`?** The current `extend_vms` only dispatches `ctrl_vm_async` when `!vm_set.activated`. The shared method must replicate this branch. If it doesn't, re-calling the shared method from `extend_vms` on an already-activated VmSet will dispatch redundant activate commands to all VMs.

Without the extracted method's full specification, the extraction cannot be implemented correctly. An incomplete extraction — silently swallowing the nil VmSet case or not branching on `activated` — will produce subtle production failures that are hard to reproduce.

**Recommendation:**

Phase 4.4.1 must include the full body of the extracted private method, its return value contract, and how both `start` and `extend_vms` call it. The method should raise on unexpected failure in the `start` path (letting `start` handle it and show an error flash) while returning a structured error result in `extend_vms` (which renders JSON). This can be achieved by accepting an `on_error:` keyword or by having the method raise and letting both callers rescue differently. Either approach must be documented explicitly in the plan before implementation begins.

---

### IMPL-v4-3: `finish` action — unrescued `ActiveJob::EnqueueError` leaves VmSet unrelinquished and returns 500

**Severity:** High
**Phase:** 4.4.1 (finish action)

**Finding:**

The Revision 5 `finish` action correctly moves `RelinquishVmSetJob.perform_later` outside the database write, fixing the IMPL-v3-7 transaction concern:

```ruby
def finish
  authorize(@game_slot, :finish?)
  game = @game_slot.active_game_for(current_user)
  return render json: { error: "No active game found" }, status: :unprocessable_entity unless game

  game.update!(status: 'completed')

  vm_set = game.vm_set_id ? ::VmSet.find_by(id: game.vm_set_id) : nil
  RelinquishVmSetJob.perform_later(vm_set.id) if vm_set

  render json: { ok: true, redirect_url: event_path(@event) }
end
```

However, `ActiveJob::perform_later` can raise `ActiveJob::EnqueueError` when the backing queue adapter fails (e.g., Redis is down, Solid Queue database write fails, or the queue is at capacity). This exception is not rescued. If it raises:

1. Rails returns a 500 to the player. The player sees a failure response and believes the `finish` action did not complete.
2. `game.update!(status: 'completed')` has already committed (ActiveRecord wraps single-record writes in their own implicit transaction). The `after_commit` callback fires, and `GameCompletionScoringJob` is enqueued.
3. The `RelinquishVmSetJob` is never enqueued. The VmSet remains activated indefinitely and its VMs stay running, consuming quota until manually cleaned up.
4. The player cannot re-trigger `finish` because `active_game_for(current_user)` will return nil (the game is already `'completed'`), causing the "No active game found" early return.

The result is an irrecoverable inconsistency: game marked finished, scoring enqueued, VmSet never cleaned up, and no retry path for the relinquish. This is not hypothetical — Redis instability and queue saturation are routine production conditions.

Note: the `after_commit` callback for scoring fires correctly here, since `game.update!` commits its own implicit transaction without requiring an explicit `ApplicationRecord.transaction` block. That aspect of Revision 5 is correct.

**Recommendation:**

Rescue `ActiveJob::EnqueueError` around the `perform_later` call and log it, but still return success to the player (the game completion is real and irreversible):

```ruby
game.update!(status: 'completed')

if vm_set
  begin
    RelinquishVmSetJob.perform_later(vm_set.id)
  rescue ActiveJob::EnqueueError => e
    Rails.logger.error(
      "[finish] Failed to enqueue RelinquishVmSetJob for vm_set #{vm_set.id}: #{e.message}"
    )
    # VmSet will not be auto-cleaned; requires manual relinquish or a scheduled sweeper job.
  end
end

render json: { ok: true, redirect_url: event_path(@event) }
```

Add a comment in the plan acknowledging that if the enqueue fails, the VmSet requires manual relinquishment. If the application has a sweeper job that reaps un-relinquished activated VmSets past their `activated_until` time, document that as the backstop. If it does not, this is a gap in the operational runbook.

---

### IMPL-v4-4: `vm_set.sec_gen_batch.event` nil-unguarded in `vm_panel` and `vm_set_panel` — `ActionController::UrlGenerationError` in production

**Severity:** High
**Phase:** 1.6.1 (vm_panel), 4.4.3 (vm_set_panel)

**Finding:**

IMPL-v3-3 identified that `vm_set.sec_gen_batch` was not nil-guarded. Revision 5 adds:

```ruby
return head :not_found unless vm_set.sec_gen_batch
```

This guards against `sec_gen_batch` being nil. However, neither action guards against `vm_set.sec_gen_batch.event` being nil. Both actions then call a route helper using the `event` object as the first argument:

In `vm_panel`:
```ruby
redirect_to Rails.application.routes.url_helpers.event_sec_gen_batch_vm_set_vm_path(
  vm_set.sec_gen_batch.event,   # <-- may be nil
  vm_set.sec_gen_batch,
  vm_set,
  vm,
  embedded: 1
)
```

In `vm_set_panel`:
```ruby
redirect_to Rails.application.routes.url_helpers.event_sec_gen_batch_vm_set_path(
  vm_set.sec_gen_batch.event,   # <-- may be nil
  vm_set.sec_gen_batch,
  vm_set,
  embedded: 1
)
```

If `sec_gen_batch.event_id` is populated but the `Event` record has been hard-deleted (by an admin bypassing the normal destroy flow, or by a data migration), `sec_gen_batch.event` returns `nil`. Passing `nil` as the first argument to a nested route helper raises `ActionController::UrlGenerationError: No route matches {:action=>"show", :controller=>"events/...", :event_id=>nil, ...}`. This is a 500 response in production, not a clean 404.

This is the same two-step nil-chain vulnerability called out in ARCH-v4-1 from the architecture review, but the immediate implementation fix is straightforward without requiring the full configurable-callback refactor.

**Recommendation:**

Add an event nil guard immediately after the `sec_gen_batch` guard in both actions:

```ruby
# vm_panel (and vm_set_panel — same pattern)
return head :not_found unless vm_set.sec_gen_batch
batch = vm_set.sec_gen_batch
event = batch.event
return head :not_found unless event
```

Then use the local `event` variable in the route helper call instead of chaining `vm_set.sec_gen_batch.event`. This is a two-line addition per action that prevents a silent 500. If the configurable-callback refactor from ARCH-v4-1 is adopted, this guard can be moved into the callable in the host initializer — but until that refactor is done, the explicit guard is required.

---

### IMPL-v4-5: `update_column` and `update_all` on `Vm#enable_console` — callbacks silently bypassed, no documented justification

**Severity:** Medium
**Phase:** 4.4.4 (enable_console gating mechanism)

**Finding:**

The plan introduces three `enable_console` write operations:

- In `start`: `::VmSet.find_by(id: ...)&.vms&.update_all(enable_console: false)` — bulk SQL UPDATE, bypasses all ActiveRecord callbacks and validations.
- In `restart`: `vm_set&.vms&.update_all(enable_console: false)` — same.
- In `vm_panel` (engine): `vm.update_column(:enable_console, true)` — single-row UPDATE, also bypasses all callbacks and validations.

`update_all` and `update_column` are intentional bypass tools. Their use here is not inherently wrong. However, the plan provides no documentation of whether `Vm` has `after_save`, `after_update`, or `after_commit` callbacks conditioned on `enable_console` changing. In the existing Hacktivity codebase, VM attribute changes that affect live infrastructure are typically dispatched via `DispatchVmCtrlService`. If `enable_console` is synced to a Proxmox console permission or an OVirt console grant via such a callback, then:

1. Locking console access in `start`/`restart` via `update_all` will not dispatch the corresponding "revoke console" command to the hypervisor. The DB record will say `enable_console: false` but the hypervisor may still grant console access via an existing session URL.
2. Unlocking via `vm.update_column(:enable_console, true)` in `vm_panel` will not dispatch the "grant console" command. The redirect to `VmsController#show` may generate a new console URL, but the hypervisor has not received an explicit grant.

If `enable_console` is purely a UI gate (the DB flag controls what the Hacktivity view renders, not what the hypervisor allows), then `update_all` and `update_column` are correct and the plan's choice is intentional. But the plan does not state which model applies.

**Recommendation:**

Add a note in Phase 4.4.4 explicitly documenting the callback-bypass intent:

> "Note: `update_all` and `update_column` are used deliberately here to bypass ActiveRecord callbacks. Confirm with the Vm model that `enable_console` is a UI gate only and is not synced to the hypervisor via an `after_save`/`after_commit` callback. If a callback exists for `enable_console`, replace with `vm.update!(enable_console: true)` and `vm_set.vms.each { |v| v.update!(enable_console: false) }` — accepting the N+1 cost for correctness."

The architecture review (ARCH-v4-4) also flags this as a race-condition concern; this finding is its implementation-level complement.

---

### IMPL-v4-6: `vm_activation_mode` injection into `window.breakEscapeConfig` — ERB snippet absent from plan

**Severity:** Medium
**Phase:** 1.6.2 / 4.4.1 (breakEscapeConfig injection in show.html.erb)

**Finding:**

The plan states in the "What changed in Revision 5" summary:

> "`vm_activation_mode` added to `window.breakEscapeConfig` injection"

The plan also shows the `vmSetPanelUrl` injection explicitly:

```javascript
vmSetPanelUrl: '<%= BreakEscape::Mission.hacktivity_mode? ? vm_set_panel_game_path(@game) : '' %>',
```

But there is no ERB snippet anywhere in the plan for `vm_activation_mode`. The Phaser HUD requires this value to determine whether activation is `eager` (VMs should be live on game start) or `lazy` (VMs are started on first `requiresVM` interaction). Without the concrete injection, a developer must guess:

- **Source object:** Is it `@game_slot.break_escape_mission.vm_activation_mode`, `@mission.vm_activation_mode`, or `@game.break_escape_mission.vm_activation_mode`? In the engine's `games/show.html.erb`, `@game` and `@game_slot` may both be available; the correct source is not obvious.
- **Value format:** String (`'eager'`, `'lazy'`) or boolean (`true`/`false` for "is eager")? The Phaser HUD spec in Phase 4.4.2 must be consistent with whatever format is injected here.
- **Placement:** Is it injected unconditionally, or only when `hacktivity_mode?` is true? In standalone mode, `vm_activation_mode` is irrelevant — injecting `nil.to_s` as `''` could cause the Phaser HUD to default incorrectly.

**Recommendation:**

Add the explicit ERB snippet to Phase 1.6.2 (or whichever phase covers `show.html.erb` changes):

```javascript
vmActivationMode: '<%= BreakEscape::Mission.hacktivity_mode? ? @game_slot.break_escape_mission.vm_activation_mode.to_s : '' %>',
```

Confirm in Phase 4.4.2 that the Phaser HUD reads `window.breakEscapeConfig.vmActivationMode` as a string and compares it explicitly to `'lazy'` / `'eager'` rather than treating it as a boolean. A blank string (standalone mode) must be handled as a no-op — the HUD should not attempt any activation flow if `vmActivationMode` is empty.

---

### IMPL-v4-7: CSRF token for Phaser HUD — DOM meta tag approach conflicts with existing `csrfToken` in `breakEscapeConfig`

**Severity:** Medium
**Phase:** 4.4.2 (Phaser HUD VM endpoint calls — CSRF fix from IMPL-v3-5)

**Finding:**

The Revision 5 fix for IMPL-v3-5 specifies that Phaser HUD fetch calls include:

```javascript
'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content
```

This approach has two problems:

**Problem 1 — Redundancy with `breakEscapeConfig.csrfToken`.**
The v3 review confirmed (citing `show.html.erb` line 143) that `window.breakEscapeConfig.csrfToken` is already injected on the game page. The existing pattern for CSRF in the engine is already `breakEscapeConfig.csrfToken`. The new approach introduces a second, inconsistent mechanism for obtaining the same token. A developer implementing Phase 4.4.2 will reasonably ask why the meta tag is used here instead of the established config key.

**Problem 2 — Silent null if the meta tag is missing.**
`document.querySelector('meta[name="csrf-token"]')?.content` evaluates to `undefined` if the meta tag is absent (e.g., the engine's layout does not include `<%= csrf_meta_tags %>`). `'X-CSRF-Token': undefined` is serialised as the header being omitted entirely. Rails then rejects the request with `422 Unprocessable Entity` (ActionController::InvalidAuthenticityToken). There is no error at the JavaScript level — the HUD silently fails every POST with a 422 that resembles any other server error.

By contrast, `window.breakEscapeConfig.csrfToken` was explicitly injected at page-render time and will be a populated string if the page was rendered by a CSRF-aware controller. An undefined value here is more obvious because it implicates the server-side injection code path rather than a missing HTML element.

**Recommendation:**

Change the Phaser HUD CSRF approach to use the established config key:

```javascript
'X-CSRF-Token': window.breakEscapeConfig?.csrfToken,
```

Remove the `document.querySelector` reference. Add a note in Phase 4.4.2 stating that `csrfToken` is the authoritative CSRF source for all Phaser fetch calls in BreakEscape, and that adding new fetch calls should follow this pattern. Also add a defensive check in the HUD initialisation: if `window.breakEscapeConfig.csrfToken` is falsy, log a warning and disable POST actions, rather than silently sending tokenless requests.

---

### IMPL-v4-8: `activated_since ||= Time.current` — correct but non-obvious; recommend explicit conditional assignment

**Severity:** Low
**Phase:** 4.4.1 (extend_vms action)

**Finding:**

The `extend_vms` action contains:

```ruby
vm_set.activated_since ||= Time.current
```

This is technically correct. In Ruby, `a.b ||= value` desugars to `a.b = a.b || value`, which calls the `b=` setter and marks the ActiveRecord attribute as dirty when the current value is nil or false. `save!` will persist the change. On subsequent calls when `activated_since` is already set, the `||=` short-circuits and the setter is not called — which is the correct "don't overwrite the original start time" semantics.

However, this desugaring is non-obvious to developers less familiar with Ruby's `||=` behaviour on method calls (as opposed to local variables). The subtle distinction from `vm_set.activated_since = Time.current if vm_set.activated_since.nil?` is that the latter makes the intent explicit and is not ambiguous about whether it marks dirty. Under both forms the behaviour is identical, but the explicit conditional form is easier to read and to audit.

Additionally, if this line is moved into the shared private method (as required by IMPL-v4-1's fix), clarity becomes more important since the method will be called from two different action contexts.

**Recommendation:**

Replace `vm_set.activated_since ||= Time.current` with:

```ruby
vm_set.activated_since = Time.current if vm_set.activated_since.nil?
```

This communicates the intent ("set only on first activation, don't overwrite") unambiguously, avoids the `||=` on a method call, and behaves identically under all conditions.

---

### IMPL-v4-9: `vmSetPanelUrl` route relies on a member route addition that is never shown in the plan's route file changes

**Severity:** Low
**Phase:** 4.4.3 (vm_set_panel route + breakEscapeConfig injection)

**Finding:**

The plan shows `vm_set_panel_game_path(@game)` in the `show.html.erb` ERB injection:

```javascript
vmSetPanelUrl: '<%= BreakEscape::Mission.hacktivity_mode? ? vm_set_panel_game_path(@game) : '' %>',
```

This route helper only exists if `vm_set_panel` is declared as a member route on the engine's `games` resource. The plan does not show the engine's routes file update that adds this member route. Phase 1.6.1 presumably added `get :vm_panel` to the member block; `get :vm_set_panel` must be added in the same block, either in Phase 1.6.1 or in Phase 4.4.3.

This creates a phasing risk: if the `show.html.erb` injection (which references `vm_set_panel_game_path`) is deployed in Phase 1.6 before Phase 4.4.3 adds the route declaration, every render of `break_escape/games/show.html.erb` in Hacktivity mode will raise `NoMethodError: undefined method 'vm_set_panel_game_path' for ...`. This would break the game show page for all players, including those on non-VM missions.

The `BreakEscape::Mission.hacktivity_mode?` guard does not protect against this: the guard is an ERB conditional, but the method lookup for `vm_set_panel_game_path` occurs at ERB compilation time regardless of the branch. If the route helper method doesn't exist, the ERB raises before evaluating the conditional.

**Recommendation:**

Add the `get :vm_set_panel` route declaration to the engine's `config/routes.rb` in the same phase as the `show.html.erb` injection (or in Phase 1.6.1 alongside `vm_panel` as a forward-declaration). The plan's "file changes" table for Phase 4.4.3 must include `config/routes.rb` as a changed file, and the updated member block must be shown explicitly:

```ruby
resources :games do
  member do
    get :vm_panel
    get :vm_set_panel   # add in Phase 4.4.3 (or Phase 1.6.1 to avoid ERB breakage)
    # ... other member routes
  end
end
```

If the `show.html.erb` injection is introduced in Phase 1.6 but the route is only added in Phase 4.4.3, the ERB injection must be deferred to Phase 4.4.3 as well, or the `vm_set_panel_game_path` call must be wrapped in a `respond_to?` guard (which is ugly and non-standard for route helpers).

---

## Summary

| ID | Severity | Phase | Issue |
|---|---|---|---|
| IMPL-v4-1 | **Critical** | 4.4.1 | `extend_vms` called directly from `start` causes `AbstractController::DoubleRenderError` on every eager-mode game start. |
| IMPL-v4-2 | **High** | 4.4.1 | `activate_vm_set!` private method referenced in implementation note but never defined; contract (nil VmSet, save! failure, re-call on already-activated set) unspecified. |
| IMPL-v4-3 | **High** | 4.4.1 | Unrescued `ActiveJob::EnqueueError` in `finish` leaves VmSet unrelinquished and returns 500, while game is already committed as completed — irrecoverable inconsistency with no retry path. |
| IMPL-v4-4 | **High** | 1.6.1 / 4.4.3 | `vm_set.sec_gen_batch.event` nil-unguarded in `vm_panel` and `vm_set_panel`; deleted Event record raises `ActionController::UrlGenerationError` rather than a clean 404. |
| IMPL-v4-5 | **Medium** | 4.4.4 | `update_column` and `update_all` bypass `Vm` callbacks on `enable_console`; no documentation of whether callbacks exist, making the bypass choice unauditable. |
| IMPL-v4-6 | **Medium** | 1.6.2 / 4.4.1 | `vm_activation_mode` injection into `window.breakEscapeConfig` stated but no ERB snippet shown; source object, value format, and standalone-mode handling all unspecified. |
| IMPL-v4-7 | **Medium** | 4.4.2 | CSRF fix uses `document.querySelector('meta[name="csrf-token"]')` despite `breakEscapeConfig.csrfToken` already existing; meta tag absence silently produces tokenless requests (422). |
| IMPL-v4-8 | **Low** | 4.4.1 | `activated_since ||= Time.current` is correct but non-obvious; recommend explicit `if .nil?` form for readability and auditability. |
| IMPL-v4-9 | **Low** | 4.4.3 | `vm_set_panel_game_path` used in `show.html.erb` ERB but the corresponding member route addition is never shown; phase ordering gap risks `NoMethodError` on every game show page render if phases are deployed independently. |

**Severity totals:** 1 Critical, 3 High, 3 Medium, 2 Low.

---

### Blocking findings

**The plan is not ready for implementation of Phase 4.4.1 until IMPL-v4-1 and IMPL-v4-2 are resolved.** The double-render in `start` (IMPL-v4-1) is a guaranteed crash on every eager-mode game. IMPL-v4-2 (missing `activate_vm_set!` definition) means the fix for IMPL-v4-1 cannot be implemented from the plan as written — the developer must reverse-engineer the method contract from scratch.

**IMPL-v4-3 (High)** should be resolved before `finish` is deployed. An unrescued `EnqueueError` creates an irrecoverable data state with no operational backstop.

**IMPL-v4-4 (High)** must be resolved before `vm_panel` and `vm_set_panel` are deployed. The nil `.event` crash is data-dependent and will not appear in local development (where all FK relationships are intact) but will occur in production.

**IMPL-v4-5, IMPL-v4-6, and IMPL-v4-7 (Medium)** should be resolved in the same implementation pass as their respective phases. IMPL-v4-6 in particular is a prerequisite for the Phaser HUD lazy/eager branching logic — without the `vmActivationMode` injection, the HUD cannot distinguish modes.

**IMPL-v4-8 and IMPL-v4-9 (Low)** are safe to address in code review or a plan annotation pass, but IMPL-v4-9 has a concrete deployment-ordering risk that should be resolved before Phase 1.6 and Phase 4.4.3 are merged independently.
