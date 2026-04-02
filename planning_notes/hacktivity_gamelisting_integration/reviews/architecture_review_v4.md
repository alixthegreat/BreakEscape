# Architecture Review — v4
## BreakEscape × Hacktivity GameSlot Integration (Revision 5)

**Reviewed by:** Senior Rails Architect
**Date:** 2026-03-30
**Plan version:** Revision 5 — Review fixes + two-surface VM UI using existing Hacktivity pages

---

## Scope

This review covers the changes introduced in Revision 5: the two-surface iframe split (`vm_panel` + `vm_set_panel` using existing Hacktivity pages with `?embedded`), the `enable_console` gating mechanism (Phase 4.4.4), the `extend_vms` `activated_until` fix, the `finish` action's move to `RelinquishVmSetJob.perform_later`, the `Outcome` struct scoping, the CSRF header addition, and the supporting changes to `breakEscapeConfig` injection and the unique index on `game_slots`.

Findings from the v1, v2, and v3 reviews are not re-raised unless the Revision 5 fix is assessed as incorrect or incomplete. Three prior findings (ARCH-v3-1, ARCH-v3-3, ARCH-v3-4) are revisited below because the Revision 5 changes either do not fully address them or have made the underlying problem worse.

---

## Findings

---

### ARCH-v4-1: ARCH-v3-3 unresolved and worsened — engine now hard-codes two Hacktivity nested route paths

**Severity:** High
**Phase:** 1.6.1 (vm_panel), 4.4.3 (vm_set_panel)

**Finding:**

ARCH-v3-3 identified `vm_panel` calling `Rails.application.routes.url_helpers.event_sec_gen_batch_vm_set_vm_path(...)` as a hard coupling between the engine and Hacktivity's specific four-level route structure. The recommendation was to replace this with a configurable-callback pattern analogous to `on_game_complete`. Revision 5 has not implemented that fix. Worse, Revision 5 introduces `vm_set_panel`, which adds a second hard-coded Hacktivity route to the engine:

```ruby
Rails.application.routes.url_helpers.event_sec_gen_batch_vm_set_path(
  vm_set.sec_gen_batch.event,
  vm_set.sec_gen_batch,
  vm_set,
  embedded: 1
)
```

The engine now encodes knowledge of Hacktivity's URL structure in two separate actions. Both will generate a `NoMethodError` from `url_helpers` if the host application's routes are ever refactored (flattened, aliased, or versioned), with no compile-time warning. Both also chain `.sec_gen_batch.event` without nil-guards — if `sec_gen_batch` is nil (admin unlinked it) or `event` is nil, both actions raise `NoMethodError` in production rather than returning a graceful 404. The `return head :not_found unless vm_set.sec_gen_batch` guard only validates that `sec_gen_batch` is non-nil; it does not guard against `sec_gen_batch.event` being nil.

**Recommendation:**

Implement the configurable-callback pattern for both surfaces:

```ruby
# In BreakEscape::Configuration:
config.vm_panel_url_for    = nil  # ->(game, vm_title) { ... }
config.vm_set_panel_url_for = nil  # ->(game) { ... }
```

Set both in Hacktivity's `config/initializers/break_escape.rb`:

```ruby
BreakEscape.configure do |config|
  config.vm_panel_url_for = ->(game, vm_title) {
    vm_set = VmSet.find_by(id: game.vm_set_id)
    return nil unless vm_set&.sec_gen_batch&.event
    # ... resolve vm, return path
    Rails.application.routes.url_helpers.event_sec_gen_batch_vm_set_vm_path(
      vm_set.sec_gen_batch.event, vm_set.sec_gen_batch, vm_set, vm, embedded: 1
    )
  }
  config.vm_set_panel_url_for = ->(game) {
    vm_set = VmSet.find_by(id: game.vm_set_id)
    return nil unless vm_set&.sec_gen_batch&.event
    Rails.application.routes.url_helpers.event_sec_gen_batch_vm_set_path(
      vm_set.sec_gen_batch.event, vm_set.sec_gen_batch, vm_set, embedded: 1
    )
  }
end
```

The engine actions then call `BreakEscape.config.vm_panel_url_for&.call(@game, params[:vm_title])` and `head :not_found` if the callable returns nil. All Hacktivity URL knowledge stays in Hacktivity's initializer. The `sec_gen_batch.event` nil-guard is the host application's responsibility and is naturally enforced inside the callable.



---

### ARCH-v4-2: `VmSetsController#show` embedded as HUD panel exposes a destructive "Relinquish" action mid-game

**Severity:** High
**Phase:** 4.4.3

**Finding:**

The VM HUD panel iframe embeds `VmSetsController#show` with `?embedded=1`. That page, per the plan, shows "vm_set-level controls: activate, extend timer, deactivate, relinquish." The `?embedded` parameter only hides the navigation bar and footer (via the layout's `params.has_key?(:embedded)` check). All action buttons on the vm_set show page remain fully rendered and functional.

The "Relinquish" button is irreversible: it triggers `VmSetsController#relinquish`, which enqueues `RelinquishVmSetJob` and destroys the VmSet. A player who clicks "Relinquish" inside the HUD panel mid-game will:

1. Permanently destroy their VmSet.
2. Leave `BreakEscape::Game#vm_set_id` pointing to a now-relinquished VmSet.
3. Break all subsequent `vm_status`, `extend_vms`, and `vm_panel` calls for the rest of that game session.
4. Receive no confirmation from the game UI that their game is now unrecoverable.

"Deactivate" has a similar, though recoverable, failure mode: deactivating the VmSet from inside the game HUD shuts down VMs without the game's `vmsActivated` flag or the HUD's `vm_status` poll being notified. The next poll will detect deactivation and update the icon, but any `requiresVM` interaction attempted before the poll fires will silently fail.

The plan offers no mitigation for either of these. There is no mention of conditionally hiding destructive controls in the embedded context, adding an `?embedded`-aware button render guard to the vm_set show view, or handling the event that `RelinquishVmSetJob` is called while a `BreakEscape::Game` referencing the VmSet is still active.

**Recommendation:**

Two tracks are needed:

(1) **Short-term — hide destructive controls when embedded.** In `VmSetsController#show` (or its partial), conditionally suppress the relinquish button (and consider deactivate) when `params[:embedded]` is present:

```erb
<% unless params.has_key?(:embedded) %>
  <%= link_to "Relinquish", relinquish_..._path, method: :delete, data: { confirm: "..." } %>
<% end %>
```

This is a one-line view change in Hacktivity and is sufficient to prevent the accidental destruction path.

(2) **Longer-term — guard `RelinquishVmSetJob` against relinquishing an in-use VmSet.** Before relinquishing, the job (or the controller action) should check whether any non-completed `BreakEscape::Game` references this VmSet:

```ruby
active_game = BreakEscape::Game.where(vm_set_id: vm_set.id).where.not(status: 'completed').exists?
```

If one does, either block the relinquish and return an error, or complete the game automatically. This cross-engine check belongs in a `RelinquishVmSetPolicy` or in a service layer, not in the job itself.

---

### ARCH-v4-3: ARCH-v3-1 partially resolved — `extend_vms` still lacks concurrent-activation quota check and `build_status` guard

**Severity:** Medium
**Phase:** 4.4.1

**Finding:**

ARCH-v3-1 identified three mandatory requirements for `extend_vms` before shipping: (a) set `activated_until` using the same timer configuration as `VmSetsController#activate`, (b) guard against activating VmSets that are not `build_status: "success"`, and (c) check the concurrent-activation quota. Revision 5 correctly addresses item (a) — the `activated_until` branching on `vm_set.activated` now replicates the start/extend timer logic.

Items (b) and (c) are still absent from the code shown in Phase 4.4.1. Specifically:

- There is no `return` or error response if `vm_set.build_status != "success"`. A VmSet whose SecGen build failed or is still pending can be "activated" via `extend_vms`, dispatching `ctrl_vm_async(vm, "activate", nil)` to each VM in an indeterminate state.
- There is no check against `max_vm_set_sessions_active_premium` / `max_vm_set_sessions_active_guest`. A player who has reached their concurrent VmSet activation quota on other challenges (via the standard Hacktivity UI) can still activate a BreakEscape VmSet through `extend_vms`, circumventing the quota entirely.

The `extend_vms` action now handles the unactivated case (`!vm_set.activated`) correctly with timer selection, but dispatches activate commands on all VMs without any of the precondition checks that `VmSetsController#activate` performs before doing the same. The Proxmox node-selection gap (Proxmox `prepare_to_activate` not called) was explicitly called out in ARCH-v3-1 as deferrable but requiring documentation. It remains undocumented in Revision 5.

**Recommendation:**

Add the two remaining guards to the `!vm_set.activated` branch of `extend_vms`:

```ruby
unless vm_set.activated
  # Guard (b): build not complete
  unless vm_set.build_status == "success"
    return render json: { error: "VM set is not ready (build status: #{vm_set.build_status})" },
                  status: :unprocessable_entity
  end
  # Guard (c): concurrent-activation quota
  active_count = current_user.vm_sets.where(activated: true).count
  quota = current_user.has_premium_quota? \
    ? Rails.configuration.max_vm_set_sessions_active_premium
    : Rails.configuration.max_vm_set_sessions_active_guest
  if active_count >= quota
    return render json: { error: "Activation quota reached" }, status: :unprocessable_entity
  end
  vm_set.vms.each { |vm| DispatchVmCtrlService.ctrl_vm_async(vm, "activate", nil) }
end
```

Add a comment in the code (and in the Known Limitations table) explicitly documenting the deferred Proxmox `prepare_to_activate` gap, with a reference to the follow-up ticket.

---

### ARCH-v4-4: Race condition between `vm_panel` unlock and `restart` re-lock on `enable_console`

**Severity:** Medium
**Phase:** 4.4.4

**Finding:**

The `enable_console` gating mechanism uses two distinct write operations:

- `restart` → `vm_set&.vms&.update_all(enable_console: false)` (bulk SQL UPDATE, bypasses callbacks, single round-trip).
- `vm_panel` → `vm.update_column(:enable_console, true)` (single-row UPDATE, also bypasses callbacks).

These are uncoordinated. The following race is possible:

1. Player triggers `restart` from one browser tab.
2. `restart` handler begins; `update_all(enable_console: false)` is issued.
3. Concurrently, the player (or a cached request in-flight from the game) calls the engine's `vm_panel` action for a specific VM.
4. `vm_panel` issues `vm.update_column(:enable_console, true)`.
5. Depending on database scheduling, the single-row write in step 4 may complete _after_ the bulk write in step 2, leaving one VM with `enable_console: true` after a restart that was intended to re-lock everything.

The result is a VM that the player can access via a direct browser URL (or a replayed Phaser fetch) without having legitimately re-navigated to the terminal in the restarted game. The unique-index on `(event_id, break_escape_mission_id)` prevents duplicate game slots but does not prevent a player from having a `vm_panel` request in-flight at the moment they (or an admin) trigger a restart.

A second, lower-probability variant: if a `vm_panel` request is enqueued by the Phaser client but not yet processed at the time `restart` fires, the processing order is non-deterministic and determined by application server concurrency (Puma thread scheduling or Unicorn worker assignment). No lock or version check prevents the stale `update_column` from winning.

**Recommendation:**

The most pragmatic fix is a database-level conditional update in `vm_panel`: only set `enable_console: true` if the game's current status is active (not restarted/completed). This requires no locking and is a single additional WHERE clause:

```ruby
# Only unlock if the game is still active — prevents a stale vm_panel request
# from unlocking a VM after a concurrent restart has re-locked it.
vm.update_column(:enable_console, true) if @game.reload.status == 'active'
```

The `reload` ensures the action reads the committed status rather than a cached in-memory value. This adds one query but eliminates the race. Alternatively, add a `vm_set_version` or `game_nonce` param to `vm_panel` requests and reject requests whose nonce does not match the current game session. This is heavier but makes replay attacks impossible; it is worth considering if the project has a threat model for console-access bypass.

---

### ARCH-v4-5: `vm_panel` and `vm_set_panel` actions are missing from the `BreakEscape::GamePolicy` — Phase 1.7 incomplete

**Severity:** Medium
**Phase:** 1.7

**Finding:**

Both `vm_panel` and `vm_set_panel` call `authorize @game if defined?(Pundit)`. In a Hacktivity deployment, `Pundit` is always defined, so this unconditionally calls `authorize @game`. Pundit resolves this to `BreakEscape::GamePolicy#vm_panel?` and `BreakEscape::GamePolicy#vm_set_panel?` respectively. If neither method exists on the policy, Pundit raises `Pundit::NotDefinedError` — not a 403 or a 404, but an unhandled exception that returns a 500 to the player.

Phase 1.7 adds "controller test specs" for `vm_panel` and `vm_set_panel` but does not mention adding `vm_panel?` and `vm_set_panel?` to `BreakEscape::GamePolicy` (or to a `GameSlotsPolicy` if the authorisation target is changed). This is an incomplete phase: without the policy methods, the actions cannot be deployed.

Additionally, the authorisation target (`@game`) is inconsistent with the rest of `GameSlotsController`, which authorizes against `@game_slot` (e.g. `authorize(@game_slot, :finish?)`). The `vm_panel` and `vm_set_panel` actions belong to `GameSlotsController` but authorize against the `BreakEscape::Game` object, meaning they are governed by a different policy class to every other action in the same controller. This makes policy coverage harder to reason about and means any admin-level `GameSlotPolicy` rules (e.g. event-admin override) do not automatically apply to these two actions.

**Recommendation:**

(1) Add `vm_panel?` and `vm_set_panel?` to `BreakEscape::GamePolicy`:

```ruby
def vm_panel?
  record.user == user && record.status == 'active'
end

def vm_set_panel?
  record.user == user && record.status == 'active'
end
```

The `record.status == 'active'` guard also provides a secondary defence-in-depth against the race condition described in ARCH-v4-4.

(2) Consider aligning the authorisation target with the rest of the controller by changing `authorize @game` to `authorize(@game_slot, :vm_panel?)` and adding the method to `GameSlotPolicy` instead. This keeps all `GameSlotsController` authorization in one policy class.

(3) The Phase 1.7 test spec section should be expanded to include a test that verifies a non-owner cannot call `vm_panel` or `vm_set_panel` (i.e., that the Pundit policy is correctly enforced, not bypassed by the `if defined?(Pundit)` guard).

---

### ARCH-v4-6: ARCH-v3-4 still open — no explicit frame-ancestor header on `VmsController#show` or `VmSetsController#show`

**Severity:** Medium
**Phase:** 1.6.1, 4.4.3

**Finding:**

ARCH-v3-4 recommended adding an explicit `Content-Security-Policy: frame-ancestors 'self'` (or `X-Frame-Options: SAMEORIGIN`) to `VmsController#show` to make the iframe intent explicit and deployment-topology-safe. Revision 5 states "no change to VmsController#show." Since no header has been added to either `VmsController#show` or `VmSetsController#show` (a new surface introduced in Revision 5), the iframe integration relies entirely on the default Rails `X-Frame-Options: SAMEORIGIN` header being in effect.

As noted in ARCH-v3-4, Hacktivity's `new_framework_defaults_7_0.rb` has the default security headers block commented out. If the default `X-Frame-Options` is not being set by the framework (or is overridden by a middleware or reverse proxy), both iframe surfaces will silently produce a blank panel in the browser with no error in the Rails logs. This is a deployment-topology problem: the integration works with the current single-domain hosting but will silently break if BreakEscape is ever mounted under a subdomain or a separate domain from Hacktivity.

Furthermore, `VmSetsController#show` did not previously need to be embeddable in an iframe. Adding it as an iframe target without an explicit header adjustment means the decision to allow it is implicit and invisible to any future developer who audits the application's iframe-embedding policy.

**Recommendation:**

Add an explicit `before_action` to both `VmsController` and `VmSetsController` that sets the appropriate header when `?embedded` is present:

```ruby
before_action :allow_iframe_embedding, only: :show

private

def allow_iframe_embedding
  return unless params.has_key?(:embedded)
  response.headers['X-Frame-Options'] = 'SAMEORIGIN'
  # If a CSP frame-ancestors directive is used instead of X-Frame-Options:
  # response.headers['Content-Security-Policy'] = "frame-ancestors 'self'"
end
```

This makes the intent explicit, is scoped only to the actions that need it, and will continue to work correctly if the global defaults are later modified. If BreakEscape and Hacktivity are ever deployed on separate origins, changing `'self'` to the specific BreakEscape origin in this one location is the correct fix — without this explicit header, there is no single location to make that change.

---

### ARCH-v4-7: `GameSlotsController` has grown to nine actions — `vm_panel` and `vm_set_panel` should be a sub-resource

**Severity:** Low
**Phase:** 1.6.1, 4.4.3

**Finding:**

`GameSlotsController` now has the following actions: `show`, `start`, `restart`, `vm_status`, `extend_vms`, `shutdown_vms`, `finish`, `vm_panel`, `vm_set_panel`. Nine actions is a significant departure from Rails' RESTful seven-action convention, and the responsibilities are genuinely heterogeneous: `start`/`restart`/`finish` manage game lifecycle; `vm_status`/`extend_vms`/`shutdown_vms` manage VM lifecycle; `vm_panel`/`vm_set_panel` are pure redirect actions that proxy into Hacktivity's own controllers.

The proxy-redirect actions (`vm_panel`, `vm_set_panel`) have a qualitatively different character to the rest: they do not render a response or return JSON — they redirect to another controller in a different application. They do not fit the "slot lifecycle" or "VM lifecycle" patterns of the other actions. Keeping them in `GameSlotsController` conflates three responsibilities in one controller and makes both routing and policy coverage harder to reason about (as noted in ARCH-v4-5).

**Recommendation:**

Extract `vm_panel` and `vm_set_panel` to a dedicated controller, either:

- `GameSlots::VmPanelsController` with a `show` action (for the individual VM surface) and a `vm_set` action (for the set surface), or
- A `GameSlotVmPanelController` with `vm` and `vm_set` actions.

The routes would read cleanly:

```ruby
resources :game_slots, only: [:show] do
  member do
    # ... lifecycle actions
  end
  resource :vm_panel, only: [:show], controller: 'game_slots/vm_panels' do
    get :vm_set, on: :collection
  end
end
```

If the refactor is deferred, at minimum add a comment above `vm_panel` and `vm_set_panel` in the controller noting that they are redirect proxies and belong in a separate controller when the next refactor pass occurs.

---

### ARCH-v4-8: `finish` simultaneously fires `GameCompletionScoringJob` and `RelinquishVmSetJob` — scoring data may be cleared before the scoring job reads it

**Severity:** Low
**Phase:** 4.4.1

**Finding:**

The `finish` action calls `game.update!(status: 'completed')`, which triggers the `after_commit` callback on `BreakEscape::Game`, which enqueues `GameCompletionScoringJob(game.id, vm_set.id)`. Immediately after, `finish` calls `RelinquishVmSetJob.perform_later(vm_set.id)`.

Both jobs are now enqueued for the same VmSet in the same request. `GameCompletionScoringJob` reads `VmSet#score` (and chains through `vm_set.sec_gen_batch`) to compute the result. `RelinquishVmSetJob` sets `relinquished: true`, clears `proxmox_vmid`, `ovirt_vmid`, and `node_id`, and sets `activated_since: nil`, `activated_until: nil`. If `RelinquishVmSetJob` executes first (which is likely if the job backend processes FIFO and `RelinquishVmSetJob` was enqueued last but the queue is lightly loaded), the VmSet data read by `GameCompletionScoringJob` will be in a partially-cleared state.

This was flagged as a potential concern in v2 NF-4 for the case where an admin manually relinquishes a completed VmSet. The Revision 5 change makes it a structural near-certainty: every normal game completion via `finish` will now produce two competing jobs for the same VmSet, with the scoring job racing the relinquishment job. As noted in NF-4, `vm_set.sec_gen_batch` being nil causes an unhandled exception in `GameCompletionScoringJob`.

**Recommendation:**

Delay `RelinquishVmSetJob` to give the scoring job time to complete first. A simple approach is to add a delay:

```ruby
RelinquishVmSetJob.set(wait: 5.minutes).perform_later(vm_set.id)
```

A more robust approach is to have `GameCompletionScoringJob` enqueue `RelinquishVmSetJob` as its final step after scoring is complete — making the relationship explicit and sequential rather than concurrent. If this is the intended semantics ("score, then relinquish"), it should be expressed in the code as a chain rather than two independent enqueues. If "relinquish immediately after finish regardless of scoring" is the intent, add a nil-guard in `GameCompletionScoringJob` on `vm_set.sec_gen_batch` (as recommended in NF-4) and document the race explicitly.

---

## Summary

Revision 5 resolves the majority of the v3 findings cleanly. The most significant fixes — `activated_until` in `extend_vms`, `RelinquishVmSetJob` in `finish`, `Outcome` at class scope, CSRF headers, the unique index on `(event_id, break_escape_mission_id)`, and the `Result.find_or_create_by` rescue — are all correctly implemented. The overall architecture is sound and the two-surface iframe split is a pragmatic reuse of existing Hacktivity pages.

**Severity breakdown:** 0 Critical, 2 High, 4 Medium, 2 Low.

**ARCH-v4-1 (High)** is a continuation of ARCH-v3-3, which was not addressed in Revision 5 and is now worse: the engine encodes two Hacktivity nested routes instead of one. This is the most architecturally damaging open finding. The configurable-callback fix is straightforward and should be implemented before the engine actions are deployed.

**ARCH-v4-2 (High)** is a new concern introduced by Revision 5's choice of `VmSetsController#show` as the HUD panel iframe target. The relinquish button is live and accessible inside the game HUD. A one-line view change (hide the relinquish button when `?embedded` is set) is the minimum required fix before this surface is shipped.

**ARCH-v4-3 (Medium)** — `extend_vms` still missing quota check and `build_status` guard — is the remaining open portion of ARCH-v3-1. The `activated_until` fix is correct; the two missing guards should be added before VM-backed missions go live.

**ARCH-v4-4 (Medium)** — the `enable_console` race between `vm_panel` unlock and `restart` re-lock — is a new concern introduced by the Revision 5 gating mechanism. The conditional `update_column` with a `@game.reload.status` check is a low-cost mitigation.

**ARCH-v4-5 (Medium)** — missing `vm_panel?` and `vm_set_panel?` policy methods — will produce unhandled `Pundit::NotDefinedError` exceptions in production as written. Policy methods must be added as part of Phase 1.7 before these actions are routed.

**ARCH-v4-6 (Medium)** — no explicit X-Frame-Options on the embedded surfaces — is the residual open portion of ARCH-v3-4. Adding an explicit header to both `VmsController#show` and `VmSetsController#show` is a small, targeted change.

**ARCH-v4-7 (Low)** and **ARCH-v4-8 (Low)** are structural observations that can be addressed in code review or a follow-up refactor pass.

The plan should not proceed to implementation of `vm_panel` / `vm_set_panel` until ARCH-v4-1 and ARCH-v4-5 are resolved. ARCH-v4-2 must be fixed before the HUD panel surface is shipped. ARCH-v4-3 and ARCH-v4-4 should be addressed in the same implementation pass as the VM lifecycle endpoints.
