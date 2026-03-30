# Architecture Review — v3
## BreakEscape × Hacktivity GameSlot Integration (Revision 4)

**Reviewed by:** Senior Rails Architect
**Date:** 2026-03-30
**Plan version:** Revision 4 — VM activation mode + in-game VM HUD

---

## Scope

This review covers the four areas added in Revision 4: the `vm_activation_mode` enum on `BreakEscape::Mission`, the four VM lifecycle endpoints on `GameSlotsController` (`vm_status`, `extend_vms`, `shutdown_vms`, `finish`), the in-game Phaser VM HUD component, and the `vm_panel` iframe integration (Phase 1.6). All findings from the v1 architecture review and the v2 architecture review are considered resolved; this review does not re-raise them. Source files examined as ground truth include `Hacktivity/config/routes.rb`, `Hacktivity/app/controllers/vm_sets_controller.rb`, `Hacktivity/app/controllers/vms_controller.rb`, `Hacktivity/config/initializers/content_security_policy.rb`, `Hacktivity/app/views/layouts/application.html.erb`, and `BreakEscape/app/controllers/break_escape/games_controller.rb`.

---

## Findings

---

### ARCH-v3-1: `extend_vms` bypasses the existing activation quota checks

**Severity:** High
**Phase:** 4.4.1

**Finding:**

The `extend_vms` action calls `DispatchVmCtrlService.ctrl_vm_async(vm, "activate", nil)` and `vm_set.update_columns(activated: true, ...)` directly, without going through the `VmSetsController#activate` logic. That method performs several checks before setting `activated: true`:

- Maximum concurrent activated VmSets (`max_vm_set_sessions_active_premium` / `_guest`)
- `build_status == "success"` guard
- Scenario password gate (`enable_scenario_password`)
- Cluster capacity check (`cluster.prepare_to_activate`) for Proxmox, including node selection and VM migration
- Timer assignment from `vm_set_activation_timer_start_premium` / `_guest`

`extend_vms` skips all of these. Consequences:
1. A player can activate VMs even when they have already reached their concurrent-activation quota on other challenges.
2. `activated_until` is never set on first activation via `extend_vms` (the plan calls `vm_set.update_columns(activated: true, allocated_date: Time.current)` but does not set `activated_until`). The HUD countdown will therefore display `nil`, and `ShutdownDeactivatedJob` — which queries `VmSet.where(activated: true).where("activated_until <= ?", Time.now)` — will never match this VmSet, leaving VMs running indefinitely.
3. For Proxmox clusters, `prepare_to_activate` is never called, so VMs are never migrated to an appropriate node before the start command is issued.
4. A `build_status: "error"` or `build_status: "pending"` VmSet can be activated.

The second issue (no `activated_until`) is the most severe — it is a billing/resource concern that causes VMs to never be automatically shut down.

**Recommendation:**

Extract the activation logic from `VmSetsController#activate` into a service (e.g. `VmSetActivationService`) that accepts a `user:` and returns a result struct, then call that service from both `VmSetsController#activate_and_start` and `GameSlotsController#extend_vms`. At minimum, before shipping, `extend_vms` must: (a) set `activated_until` using the same timer configuration as `VmSetsController#activate`, (b) guard against activating VmSets that are not `build_status: "success"`, and (c) check the concurrent-activation quota. The Proxmox node-selection concern can be deferred to a follow-up, but must be documented as a known limitation with an explicit ticket.

---

### ARCH-v3-2: `finish` marks `relinquished: true` via `update_columns`, bypassing `RelinquishVmSetJob`

**Severity:** High
**Phase:** 4.4.1

**Finding:**

The `finish` action sets `vm_set.update_columns(relinquished: true)` and dispatches `stop` to each VM directly. The existing relinquishment path (`VmSetsController#relinquish`, `RelinquishVmSetJob`) does additional cleanup: it renames VMs (`rel-` prefix on `ovirt_vm_name`), clears `proxmox_vmid`, `ovirt_vmid`, and `node_id`, and sets `activated: false`, `activated_since: nil`, `activated_until: nil`.

The plan's `finish` action skips all of this. Consequences:
- VMs remain with their active `ovirt_vm_name` / `proxmox_vmid`, so downstream cleanup jobs that filter by VM name prefix or by `proxmox_vmid: nil` will not recognise these VMs as relinquished.
- `activated: true` remains set (if the VMs were activated), which means `ShutdownDeactivatedJob` may attempt to act on these VMs again even after relinquishment.
- The cluster's capacity accounting (which may depend on `proxmox_vmid` or node assignment being cleared) will be incorrect.

**Recommendation:**

Replace the inline `update_columns` + `ctrl_vm_async` in `finish` with a call to the existing job: `RelinquishVmSetJob.perform_later(vm_set.id)`. This re-uses the complete relinquishment path without duplicating it. If an immediate synchronous dispatch is preferred for the stop command (to give the player immediate feedback), add only the stop dispatch and then enqueue `RelinquishVmSetJob` for the metadata cleanup.

---

### ARCH-v3-3: `vm_panel` action exposes Hacktivity's deeply nested route structure as a hard dependency inside the engine

**Severity:** High
**Phase:** 1.6

**Finding:**

The `vm_panel` action in the engine calls:

```ruby
Rails.application.routes.url_helpers.event_sec_gen_batch_vm_set_vm_path(
  vm_set.sec_gen_batch.event,
  vm_set.sec_gen_batch,
  vm_set,
  vm,
  embedded: 1
)
```

This creates a strong coupling: the engine encodes Hacktivity's specific four-level nesting (`events/:event_id/challenges/:sec_gen_batch_id/vm_sets/:vm_set_id/vms/:vm_id`) directly into its source code. If Hacktivity ever flattens, renames, or reorders any of these route segments — which is a normal refactoring for a host application — the engine will silently generate a `NoMethodError` on `url_helpers` or produce a broken redirect URL with no compile-time warning. This is the tightest form of cross-engine coupling: source code in the engine that can only be verified by running the host application.

Additionally, `vm_set.sec_gen_batch.event` fires two queries (or relies on association loading) without any nil-guard. If `sec_gen_batch` is nil (possible if an admin unlinks it) or `event` is nil, this raises `NoMethodError`.

**Recommendation:**

Remove the Hacktivity URL from the engine. Instead, use the same configurable-callback pattern already established by `on_game_complete`: add a `vm_panel_url_for` callable to `BreakEscape::Configuration` that Hacktivity sets in its initializer:

```ruby
config.vm_panel_url_for = ->(game, vm_title) {
  vm_set = VmSet.find_by(id: game.vm_set_id)
  # ... resolve vm, return the path
}
```

The `vm_panel` action calls `BreakEscape.config.vm_panel_url_for.call(@game, params[:vm_title])` and redirects to the result. This keeps all knowledge of Hacktivity's URL structure in Hacktivity's initializer, where it belongs. Add nil-guards on the `sec_gen_batch` and `event` chain regardless of which approach is used.

---

### ARCH-v3-4: `embedded` param is an unauthenticated open redirect amplifier on the VM show page

**Severity:** High
**Phase:** 1.6

**Finding:**

The plan states: "Hacktivity's `application.html.erb` already conditionally hides navigation and footer when `params.has_key?(:embedded)` (lines 59 and 66 of the layout)." Inspection of the layout confirms this: `render 'layouts/navigation' unless params.has_key?(:embedded)` and `render 'layouts/footer' unless params.has_key?(:embedded)`.

This check is present-tense on the `params` of the page being rendered, not on the response being put into an iframe. The concern is not the navigation-hiding itself but that Hacktivity's `X-Frame-Options` header is not explicitly set in the application configuration. The `new_framework_defaults_7_0.rb` file shows the default headers block is commented out, meaning the default Rails `X-Frame-Options: SAMEORIGIN` is in effect — but only if no override exists elsewhere. If `SAMEORIGIN` is the effective header, then the iframe in the BreakEscape engine (which is served from the engine's mount path, i.e. the same origin as Hacktivity when both are served from the same domain) would work. However:

1. If BreakEscape is ever served from a subdomain or a separate domain from Hacktivity (a plausible deployment topology), the `SAMEORIGIN` header will silently block the iframe with no error to the developer, producing a blank panel.
2. The plan offers no mechanism for the iframe to communicate back to the parent Phaser scene. If the player submits a flag inside the iframe, there is no `postMessage` path back to the HUD to update VM state. The player must close the iframe and wait for the next poll cycle. This is a UX gap but also an architectural one: the plan conflates "loading the VM page in an iframe" with "integrating VM state into the game."
3. `?embedded=1` can be appended by any visitor to any Hacktivity page to strip navigation and footer. While this is not a security vulnerability per se (the user still must be authenticated to see any content), it is an unintended public-facing mode that could be used to create convincing phishing pages that look like embedded Hacktivity content without the usual chrome.

**Recommendation:**

(1) Add an explicit `Content-Security-Policy: frame-ancestors 'self'` exception (or equivalent `X-Frame-Options: SAMEORIGIN` override) scoped only to the VM show action, using a `before_action` or response header in `VmsController#show`. This makes the intent explicit and keeps it working even if the global default headers change. (2) Document the same-origin deployment requirement as a hard constraint for Phase 1.6. (3) For the `?embedded` stripping issue, gate the param on a signed value or a session flag rather than a bare presence check, or limit it to specific controller actions via a before_action allowlist.

---

### ARCH-v3-5: `create_game_for_listing` defines a constant (`Outcome`) inside a method on every call

**Severity:** Medium
**Phase:** 4.3

**Finding:**

The `create_game_for_listing` private method contains:

```ruby
Outcome = Struct.new(:game, :error_message, :redirect_key, keyword_init: true) do
  def error? = error_message.present?
end
```

Assigning a constant (`Outcome`) inside a method body works on the first call but produces a Ruby warning on every subsequent call: `warning: already initialized constant GameSlotsController::Outcome`. In production the warning is typically suppressed, but in test environments with `RUBYOPT=-W2` or strict warning configurations it will generate noise for every controller test that exercises this path. It also makes the constant accessible as `GameSlotsController::Outcome` from outside the method, which is not the intent.

**Recommendation:**

Move the `Outcome` struct definition to a class-level constant or a private inner class at the top of `GameSlotsController`, outside any method body:

```ruby
class GameSlotsController < ApplicationController
  Outcome = Struct.new(:game, :error_message, :redirect_key, keyword_init: true) do
    def error? = error_message.present?
  end
  private_constant :Outcome
  ...
end
```

`private_constant` prevents external access while keeping it logically associated with the controller.

---

### ARCH-v3-6: Lazy activation race — double `extend_vms` before `vmsActivated` is set

**Severity:** Medium
**Phase:** 4.4.2

**Finding:**

The Phaser client's lazy activation flow is:
1. Check `vmsActivated`. If false, POST `extend_vms`.
2. On success: set `vmsActivated = true`, proceed with the interaction.

This is a client-side guard with no server-side idempotency protection. If the player triggers two `requiresVM` interactions in rapid succession (e.g. clicking two VM-connected objects before the first `extend_vms` response returns), both will pass the `if !vmsActivated` check (since neither has received a response yet), and two `extend_vms` POSTs will be dispatched. The server will call `DispatchVmCtrlService.ctrl_vm_async(vm, "activate", nil)` twice for the same VmSet.

Whether this causes a problem depends on `DispatchVmCtrlService`'s idempotency for the `activate` command. If the activation job is not idempotent (e.g. it enqueues VM start commands without checking current state), the VM may receive two start commands, potentially causing the Proxmox/oVirt interface to error. Even if the command is safe to double-issue, the server will call `vm_set.update_columns(activated: true, allocated_date: Time.current)` twice, which is benign but wastes a write. More critically, `activated_until` must be set correctly on the first call (see ARCH-v3-1); a double-call may reset the timer.

**Recommendation:**

Add a pending-activation flag on the client side: set `vmsActivating = true` before the POST and gate the second activation check on both `!vmsActivated && !vmsActivating`. On the server side, add a guard to `extend_vms`: if `vm_set.activated` is already true, skip `ctrl_vm_async` and return the current `activated_until` — treating repeat calls as timer-extension requests only. This is consistent with the existing `VmSetsController#activate` behaviour for already-activated sets.

---

### ARCH-v3-7: `vm_status` polling at 5-minute interval does not account for `activated_until` expiry

**Severity:** Medium
**Phase:** 4.4.2

**Finding:**

The plan specifies: "The Phaser client polls `GET /game_slots/:id/vm_status` every 30 seconds while the HUD panel is open, and once per 5 minutes while closed (to keep the icon colour current without hammering the server)."

`ShutdownDeactivatedJob` runs on a schedule and shuts down VMs whose `activated_until` has passed. With a 5-minute closed-panel poll interval, there is a window where the player's VMs have already been shut down by the background job but the HUD icon still shows green. If the player attempts a `requiresVM` interaction during this window, the interaction will proceed (since `vmsActivated` is still true client-side) but the VMs will be down. The player will experience a silent failure: the VM interaction fires, but the VM does not respond.

More concretely, if a player's `activated_until` is in 3 minutes and they have the HUD closed, the icon goes green → the timer expires → the background job shuts the VMs → the player tries a VM interaction 4 minutes later → the client thinks VMs are active → interaction fires → VM is down.

**Recommendation:**

In addition to server polling, implement a client-side countdown: the Phaser config already receives `activated_until` from the server. The HUD should maintain a JavaScript timer that counts down from `activated_until` independently of the poll cycle. When the client-side timer reaches zero, it should: (a) switch the icon to amber/red immediately (even before the next poll), and (b) set `vmsActivated = false` so that `requiresVM` interactions trigger a re-activation attempt rather than silently firing against down VMs. This is mentioned as a deferred feature in the plan's Known Limitations table ("VM HUD heartbeat auto-extension"), but the `vmsActivated` flag being stale is not just a UX issue — it directly affects whether `requiresVM` interactions behave correctly.

---

### ARCH-v3-8: `vm_activation_mode` is on `BreakEscape::Mission` but evaluated via Hacktivity routes — coupling direction is inverted

**Severity:** Medium
**Phase:** 1.4, 4.4

**Finding:**

`vm_activation_mode` is stored on `BreakEscape::Mission` and the plan describes two read sites:
1. `GameSlotsController#start` reads `@game_slot.break_escape_mission.vm_activation_mode` to decide whether to call `extend_vms` inline.
2. `GameSlotsController#vm_status` returns `@game_slot.break_escape_mission.vm_activation_mode` in the JSON response.
3. The Phaser client initialises `vmsActivated` from `vm_activation_mode == 'lazy' ? false : true` — but the plan does not specify where in the scenario data this value is injected.

The third point is the gap. `vm_activation_mode` needs to reach the Phaser client at game boot. The plan specifies that `vmStatusUrl`, `extendVmsUrl`, `shutdownVmsUrl`, and `finishUrl` are injected "via the existing `ScenarioBinding`/`scenario_data` mechanism or as separate data attributes on the canvas element" — but `vm_activation_mode` itself is not mentioned in this list. If the Phaser client does not receive `vm_activation_mode` at boot, it cannot correctly initialise `vmsActivated`, and all lazy missions will behave as if they are eager (or vice versa, depending on the default).

There is also a second read-site issue: `vm_status` returns `vm_activation_mode` on every poll. The Phaser client can use this to fix up a wrong initial state, but only after the first poll fires (30 seconds into the game for a closed HUD panel — long enough for the player to already have triggered and been confused by incorrect lazy/eager behaviour).

**Recommendation:**

Explicitly add `vm_activation_mode` to the list of values injected into `window.breakEscapeConfig` at game boot time (alongside `vmPanelUrl` in Phase 1.6.2). The injection point in `show.html.erb` already has access to `@game.mission.vm_activation_mode`. Document this in the file change summary for Phase 1.6 / 4.4.2. The HUD spec should also document that `vmsActivated` is initialised at boot from the config value, not from the first `vm_status` poll response.

---

### ARCH-v3-9: `GameSlot#unique` constraint missing — two slots can reference the same mission in the same event

**Severity:** Medium
**Phase:** 3.3

**Finding:**

The `game_slots` migration creates an index on `[:event_id, :position]` but no uniqueness constraint on `[:event_id, :break_escape_mission_id]`. Nothing in the model validation prevents an admin from creating two `GameSlot` rows for the same `BreakEscape::Mission` within the same event.

If this happens, `EventsController#show` builds `@user_games = BreakEscape::Game.where(...).index_by(&:mission_id)`. `index_by` on a non-unique key silently discards all but the last record. More dangerously, `active_game_for(user)` queries `BreakEscape::Game` scoped to `mission: break_escape_mission`. A player who has started one of the two duplicate slots will have their in-progress game returned by the other slot's `active_game_for` check, meaning clicking "Start Mission" on the second duplicate will redirect them to a game they started from the first slot — silently, with no indication of the confusion.

**Recommendation:**

Add a unique index to the migration:

```ruby
add_index :game_slots, [:event_id, :break_escape_mission_id], unique: true,
          name: 'idx_game_slots_unique_mission_per_event'
```

And a corresponding model validation:

```ruby
validates :break_escape_mission, uniqueness: { scope: :event_id,
  message: "is already listed in this event" }
```

---

### ARCH-v3-10: `Result.find_or_create_by` inside the transaction has a race condition not covered by the `RecordNotUnique` rescue

**Severity:** Low
**Phase:** 4.3

**Finding:**

The `create_game_for_listing` method (correctly, per NF-3 from v2) now places `Result.find_or_create_by(user: user, event: @event)` inside the transaction. However, `find_or_create_by` is not atomic and is documented as subject to race conditions. Two concurrent requests can both execute the `find` (returning nil), then both attempt the `create`, with one getting a `RecordNotUnique` exception. This exception is raised inside the `ApplicationRecord.transaction` block, which means it is NOT caught by the `rescue ActiveRecord::RecordNotUnique` clause at the bottom of `create_game_for_listing` (that rescue is on the `BreakEscape::Game` unique index, not on `Result`). The `RecordNotUnique` from `Result` will propagate uncaught, returning a 500 to the user.

This scenario requires two users to start a mission simultaneously for the same `(user, event)` pair — which means the same user in two browser tabs simultaneously. It is low-probability but not impossible.

**Recommendation:**

Wrap the `Result` creation with a separate rescue or use a database-level upsert:

```ruby
begin
  Result.find_or_create_by(user: user, event: @event)
rescue ActiveRecord::RecordNotUnique
  # Concurrent request created it; find it.
  Result.find_by(user: user, event: @event)
end
```

Alternatively, if a unique index on `results (user_id, event_id)` is added (the v2 review noted this as separately addressable), a single `upsert` call is cleaner. The broader recommendation from v2 still stands: add the unique index to `results` as a follow-up.

---

### ARCH-v3-11: No CSRF protection on `extend_vms`, `shutdown_vms`, and `finish` when called from Phaser (non-form XHR)

**Severity:** Low
**Phase:** 4.4.1, 4.4.2

**Finding:**

The three mutating VM lifecycle endpoints (`extend_vms`, `shutdown_vms`, `finish`) are POSTs that the Phaser HUD calls via `fetch` or `XMLHttpRequest`. Rails' CSRF protection requires either a form-based `authenticity_token` param or the `X-CSRF-Token` request header. Phaser's `fetch` calls will not include either automatically.

If the Phaser client does not explicitly read the CSRF token from the meta tag and include it in each request header, Rails will raise `ActionController::InvalidAuthenticityToken` (or silently skip the action if `protect_from_forgery` is configured with `null_session`). The plan's HUD specification does not mention CSRF token handling.

This is Low rather than Critical because the endpoints are already protected by `authenticate_user!` and Pundit authorization — a CSRF attack would require the victim to be authenticated and the attacker to trigger a cross-origin request, which Pundit would also need to pass. The practical risk is low. The bigger risk is that the endpoints simply fail in production if the CSRF header is missing, causing silent HUD failures.

**Recommendation:**

In the Phaser HUD component, read the CSRF token from the meta tag before making any POST:

```javascript
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
// Include in fetch calls:
headers: { 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json' }
```

Document this as a required implementation detail in the HUD spec section (4.4.2). Add a controller test that verifies CSRF protection is NOT skipped on these actions (i.e. that no `skip_before_action :verify_authenticity_token` is present).

---

## Summary

Revision 4 is architecturally coherent in its overall design but introduces several concrete defects alongside its new features. The most urgent findings before implementation proceeds:

**Severity breakdown:** 0 Critical, 4 High, 4 Medium, 2 Low, 0 Info.

**ARCH-v3-1 (High)** is the most functionally dangerous: `extend_vms` bypasses the existing activation timer assignment, meaning VMs activated through the new HUD path will never be automatically shut down by `ShutdownDeactivatedJob`. This is a resource/billing hole that will manifest in production on the first eager or lazy mission started. It must be fixed before the VM lifecycle endpoints are deployed.

**ARCH-v3-2 (High)** — `finish` using `update_columns(relinquished: true)` instead of `RelinquishVmSetJob` — will leave VMs in a half-relinquished state that confuses downstream cleanup jobs. Using the existing job is a one-line change.

**ARCH-v3-3 (High)** — the engine hard-coding Hacktivity's four-level nested route path — is the most architecturally damaging finding. It makes the engine's `vm_panel` action undeployable without Hacktivity and fragile to any route refactoring in the host. The configurable-callback approach already used for `on_game_complete` is the correct pattern and should be applied here.

**ARCH-v3-4 (High)** — the `embedded` param and `X-Frame-Options` — needs explicit header configuration in `VmsController#show` before Phase 1.6 is deployed. Without it, the iframe integration is one deployment topology change away from silently breaking.

**ARCH-v3-6 and ARCH-v3-7 (both Medium)** — the double lazy-activation race and the stale `vmsActivated` flag — are correctness issues in the HUD spec that should be addressed in the JS implementation spec before development begins on that component. They do not require plan changes in the migration or controller sections.

**ARCH-v3-8 (Medium)** — `vm_activation_mode` not included in the boot config injection — is a one-line addition to Phase 1.6.2 that must be done or lazy missions will not function correctly.

**ARCH-v3-9 (Medium)** — missing uniqueness constraint on `(event_id, break_escape_mission_id)` — is a migration-level fix that should be added before the `game_slots` table is created.

The plan should not proceed to implementation until ARCH-v3-1 and ARCH-v3-3 are resolved, and ARCH-v3-2 and ARCH-v3-9 are straightforward enough to address in the same revision. The remaining findings (ARCH-v3-4, ARCH-v3-5 through ARCH-v3-8, ARCH-v3-10, ARCH-v3-11) can be addressed during implementation with the plan as a guide.
