# UX Review — v2

**Reviewer:** UX/Product (game UI & web application focus)
**Date:** 2026-03-30
**Plan revision reviewed:** Revision 4

---

## Scope

This review covers the three major Revision 4 additions: the in-game Phaser VM HUD (Phase 4.4.2), the vm-launcher iframe integration (Phase 1.6), and the lazy VM activation mode (Phase 1.4/4.4.2). It also revisits any Revision 4-introduced edge cases in transitions (game start, mid-session return, VM expiry, restart) and consistency of the embedded Hacktivity page within the BreakEscape aesthetic. The v1 review (Revision 3) already addressed auto-activation on game start, the in-game status HUD concept, "Finish Mission" framing for relinquish, the mission card status states, the "Challenges" vs "Missions" rename, and the restart interstitial. Those findings are not re-raised here. The focus is on what is new or changed in Revision 4 and on gaps that v1 did not examine because the features did not yet exist.

---

## Findings

### UX-v2-1: The VM HUD button has no label or tooltip — players will not know what it does

**Severity:** High
**Phase:** 4.4.2

**Finding:** The plan specifies a colour-coded icon button placed alongside the music button, but gives it no text label and does not specify a tooltip or accessible name. The music button is already an implicit convention (speaker icon = audio), but it has decades of established iconography behind it. A coloured circle or dot with no label is not a standard game UI convention for VM status. A first-time player seeing a grey dot next to the music button has no basis to infer "this controls my virtual machines." The plan's button-state table uses terms like "VMs not yet started" and "VMs running" that never appear on screen unless the player already knows to click the icon.

**Recommendation:** Add a tooltip (or a persistent micro-label beneath the icon, like "Systems") that appears on hover/focus and is always present as an accessible name (`aria-label`). At minimum, the HUD panel title "Your VMs" should also appear as a tooltip on the closed button state so players can discover the function before clicking. If the game's aesthetic discourages visible labels, a first-time tooltip that auto-dismisses after 5 seconds on game load ("Click here to check your mission systems") would serve discovery without permanently cluttering the HUD.

---

### UX-v2-2: The HUD panel places "Finish Mission" adjacent to "Shutdown" with no visual separation — accidental destructive action risk

**Severity:** High
**Phase:** 4.4.2

**Finding:** The HUD panel specification lists three controls: Extend, Shutdown, and Finish Mission. All three are listed at the same level with no hierarchy or spatial separation specified. "Shutdown" (powers down VMs temporarily, reversible) and "Finish Mission" (marks game completed, relinquishes VmSet, irreversible) are semantically very different — one is operational, one is terminal. Presenting them at the same visual weight and proximity creates a meaningful risk of a player hitting "Finish Mission" when they intended "Shutdown." The confirmation prompt ("This will end your session and free your VMs. Are you sure?") exists, but confirmation dialogs suffer from habituation; players who have seen them once often dismiss them without reading. This is especially true mid-session when a player is focused on the game and clicks quickly.

**Recommendation:** Separate the destructive action visually and spatially. Place Extend and Shutdown together as operational controls; put Finish Mission below a visible divider or in a clearly distinct zone (e.g. a section labelled "End Session" or styled in a warning colour). Consider requiring an additional deliberate gesture for Finish Mission — for example, a two-step confirmation where the first click changes the button label to "Confirm: End Mission" rather than showing a modal, which is consistent with the non-modal UX philosophy already described in v1.

---

### UX-v2-3: Lazy activation provides no player feedback — the terminal interaction silently blocks while VMs activate

**Severity:** High
**Phase:** 1.4, 4.4.2

**Finding:** In lazy mode, when a player first touches a VM terminal object the Phaser client fires `extend_vms` before processing the interaction. During this POST request — which triggers real VM activation on the infrastructure layer and is not instantaneous — the game is effectively paused, waiting. The plan does not specify any in-progress state for this moment. The player has just clicked on an in-game terminal expecting an immediate response (the vm-launcher minigame panel opening, or a message, or anything). If they get silence for 1–3 seconds with no feedback, the instinctive response is to click again, which could fire duplicate requests or leave the player uncertain whether their input registered.

Additionally, the HUD icon is initialised to grey ("not yet activated") in lazy mode. After the first terminal interaction triggers activation, the icon transitions to green. But this icon is small and positioned in a corner — a player focused on the terminal panel in the centre of the screen is unlikely to notice the icon colour change at all.

**Recommendation:** When a `requiresVM` interaction fires `extend_vms`, immediately show an in-game notification or overlay on the terminal panel itself: "Connecting to target system..." with a spinner. This blocks further interaction on that terminal until the POST resolves. On success, dismiss the overlay and open the interaction as normal. On failure, show the error message already specified ("Could not start VMs — please try again or use the VM button") in the same location. This keeps feedback co-located with the player's point of attention rather than relying on them to notice the HUD icon change.

---

### UX-v2-4: The iframe has a fixed 560px height with no loading state — players see a blank white box while the Hacktivity page loads

**Severity:** High
**Phase:** 1.6

**Finding:** The plan specifies `height: 560px` for the vm-launcher iframe with no loading state. Reading the source CSS (`vm-launcher-minigame.css`), the current `.vm-launcher` container uses `max-height: 400px` with `overflow-y: auto`. The iframe proposal overrides this to a fixed 560px. During the iframe's initial load — which involves a full Rails page render plus Bootstrap CSS and jQuery from Hacktivity — the iframe will briefly show either a blank white area or (while redirecting through `vm_panel`) a flash of the engine's own domain before landing on the Hacktivity VM page. Against BreakEscape's black/dark terminal aesthetic, a white or near-white loading state will be visually jarring and may appear to be an error.

**Recommendation:** Add a loading placeholder rendered by the minigame JS before the iframe is appended. This placeholder lives inside `.vm-launcher-iframe` at the same 560px height, uses the same dark background and monospace font as the rest of the minigame, and shows a spinner and message consistent with the game's visual language: "Connecting to terminal..." The iframe `onload` event dismisses the placeholder. Additionally, set `background: #0a0a0a` (or match the game's background colour) on the iframe element itself so that even before the placeholder renders there is no flash of white.

---

### UX-v2-5: Horizontal overflow in the iframe is unhandled — Hacktivity's Bootstrap layout will almost certainly overflow the minigame panel width

**Severity:** Medium
**Phase:** 1.6

**Finding:** The plan sets `width: 100%` on the iframe and notes that `overflow: hidden` is set on the container. However, the Hacktivity VM page (`_vm.html.erb`, `_vm_controls.html.erb`) uses Bootstrap's grid and custom CSS classes (`vm_wrapper`, `vm`, positioned dropup menus) that are designed for a full-width browser viewport, not an iframe embedded in a game panel that may be 500–700px wide. The VM card structure with its `btn-group dropup` controls (flags, settings, snapshots, power), the monitor-shaped `.vm` element, and the floating VNC overlay are all built for wide layouts. `overflow: hidden` on the container will clip this content silently — players will not see controls that overflow, without any indication that they are missing content. The "New tab" button mentioned in the plan (for full-screen VNC) mitigates the VNC case but not the general overflow issue.

**Recommendation:** The plan should explicitly specify that the Hacktivity `?embedded=1` layout must apply a responsive constraint: at minimum, `max-width: 100%; overflow-x: auto` on the content wrapper when `params[:embedded]` is set. This is a small Hacktivity-side CSS addition. Alternatively, the plan should specify a minimum panel width for the vm-launcher container when in iframe mode (e.g. `min-width: 600px`) with `overflow-x: auto` on `.vm-launcher-iframe` rather than `overflow: hidden`, so clipped content is scrollable rather than invisible.

---

### UX-v2-6: The `vm_panel` endpoint returns a redirect, not a direct URL — the iframe will follow the redirect but the loading experience is degraded and error handling is absent

**Severity:** Medium
**Phase:** 1.6

**Finding:** The `vm_panel` action issues a `redirect_to` to the Hacktivity VM URL. An iframe follows redirects transparently, so functionally this works. However, it means the iframe makes two HTTP requests before rendering content: first to the engine's `vm_panel` path, then to the Hacktivity nested VM path. If the first request returns a 404 (no VmSet, no VM found, game not VM-backed), the iframe renders a 404 page inside the minigame panel. The plan does not specify what this looks like from the player's perspective. Hacktivity's 404 page almost certainly renders with full navigation, header, and footer — the same Bootstrap layout that is hidden by `?embedded=1`, but `?embedded=1` is only appended to the redirect target when a VM is found. A 404 page rendered inside the iframe will show a fully styled Hacktivity error page inside the terminal-themed minigame, which is jarring and unhelpful.

**Recommendation:** Instead of loading the redirect-following iframe directly, have the minigame's JS first fetch `vm_panel` via `fetch()` following redirects and only inject the final resolved URL into the iframe `src`. This means a single iframe load with no redirect chain visible to the player. More importantly, if `vm_panel` returns 404 or any non-200, the JS should render an inline error within the minigame panel using the existing `.no-vms-message` component, not a blank iframe or an embedded Hacktivity 404 page. This keeps error states entirely within the game's visual language.

---

### UX-v2-7: The VNC auto-open script in `_vm_controls.html.erb` will fire inside the iframe, potentially popping a floating overlay at an unexpected z-index within the game canvas

**Severity:** Medium
**Phase:** 1.6

**Finding:** `_vm_controls.html.erb` contains an auto-open VNC script that fires when a VNC button becomes available and `!window.vncAutoAttempted.has(vm_id)`. When this script runs inside the iframe (since the full VM page is loaded), it will attempt to open the VNC floating overlay. The VNC overlay (`vnc-overlay-<vm_id>`) is created as `position: fixed` within the iframe's viewport, not the parent window's viewport. This means it will appear clipped to the 560px iframe rather than expanding to full-screen as it does on the normal VM page. The "New tab" escape hatch addresses the case where the player wants full-screen VNC, but the auto-open behaviour may produce a confusing cramped VNC window inside an already-small panel without the player having asked for it.

**Recommendation:** When serving a VM page with `?embedded=1`, suppress the VNC auto-open behaviour. The simplest approach is to add `&& !params[:embedded]` to the condition in the auto-open script (in `_vm_controls.html.erb`), or to set a JS variable `window.embeddedMode = true` in the embedded layout and gate the auto-open on its absence. The player should explicitly click the VNC button to open the VNC view, and the "New tab" button should be prominently placed so they can move to a full-screen experience.

---

### UX-v2-8: Mid-session return to a lazy mission — the HUD icon state cannot be reliably inferred from polling alone if the player closes and reopens the game

**Severity:** Medium
**Phase:** 4.4.2

**Finding:** The Phaser client initialises `vmsActivated = false` for lazy missions and transitions to `true` on the first successful `extend_vms` call. This state lives only in JS memory. If the player closes the browser tab and reopens the game, `vmsActivated` resets to `false` even though the VMs may already be activated (if the player interacted with a terminal earlier in the session and VMs are still within their activation window). On reopening, the HUD icon will show grey ("not yet activated") even though the VMs are running. The player may then approach a terminal and trigger a redundant `extend_vms` call — harmless, but it resets `activated_until`, which could be surprising if they were tracking the timer.

More critically: the grey icon may cause a player who returns to a running session to believe their VMs are not ready, leading them to leave the game and check Hacktivity directly — breaking immersion and causing unnecessary confusion.

**Recommendation:** The Phaser client should reconcile `vmsActivated` with the server on game load (or on the first `vm_status` poll, which occurs within 5 minutes of opening the game). If `vm_status` returns `activated: true` with a future `activated_until`, set `vmsActivated = true` immediately and update the HUD icon to green. This reconciliation should happen at startup, not waiting for the first 5-minute poll cycle. The `vm_status` call at game boot adds negligible overhead and prevents the stale-grey-icon problem entirely.

---

### UX-v2-9: The HUD panel countdown timer has no specified behaviour at expiry — the player may be left with a frozen "0:00" display

**Severity:** Low
**Phase:** 4.4.2

**Finding:** The plan specifies a countdown from `activated_until` but does not describe what the HUD does when the timer reaches zero. In practice, when `activated_until` passes, the VMs will begin shutting down (or may already be off). The HUD icon should transition from amber/red to red/solid, and the panel timer should not freeze at "0:00" — it should instead transition to a "Systems offline" state that prompts the player to restart systems or acknowledge the situation.

**Recommendation:** When the client-side countdown reaches zero, the Phaser HUD should: (1) trigger an immediate `vm_status` poll to confirm the server-side state rather than assuming shutdown has occurred; (2) update the icon and panel based on the response; (3) if `activated: false` is confirmed, show the "Systems offline" state and surface the Extend/Restart option. This prevents the HUD from displaying a stale "0:00" frozen state and ensures the player sees the correct system state rather than a misleading timer artefact.

---

### UX-v2-10: The `restart` action redirects immediately to the game while VMs are reverting — the plan's flash message is insufficiently visible within the Phaser canvas

**Severity:** Low
**Phase:** 4.3 (restart action)

**Finding:** The v1 review identified the restart interstitial problem and offered two approaches: an in-game polling lock screen (preferred) or a redirect to the event page with a flash message (v1 acceptable). Revision 4's controller code implements the simpler path: `flash[:notice] = "VM revert in progress..."` followed by an immediate redirect to the game path. The problem is that BreakEscape loads as a full-screen Phaser canvas. Standard Rails flash messages rendered in the application layout (`application.html.erb`) typically appear above the canvas in a Bootstrap alert bar. Depending on how the game's layout is structured, this alert may be hidden behind the canvas, rendered in a narrow strip above it, or auto-dismissed before the player notices it. The player then enters the game without understanding that the VMs are still reverting.

**Recommendation:** Promote this from the deferred "v2 improvement" category in the plan. The in-game lock screen approach described in v1 (game detects a `reverting` flag in player state and renders a lock screen overlay) is the appropriate solution for launch. If that is genuinely too complex for the initial release, the minimum viable alternative is to redirect to the **event show page** (not the game path) with the flash message, and set a `reverting` status on the `GameSlot` or game record so the mission card shows "Resetting..." — giving the player a clear holding state before they return to the game. Redirecting to the game with a flash that may not render is the worst of both options.

---

## Summary

This review identifies 10 findings: 3 High severity, 4 Medium severity, 2 Low severity, and 1 Low severity that borders on Medium depending on how the flash message renders in the specific game layout.

**The most important player-facing risks are:**

1. **Lazy activation opacity (UX-v2-3, High):** A player's first interaction with a VM terminal in lazy mode stalls silently with no feedback. This is the most likely cause of player confusion and "is the game broken?" support contacts at launch.

2. **Iframe blank/white loading state (UX-v2-4, High):** The flash of white inside a dark terminal-aesthetic panel will be read as an error by most players. It is also the easiest fix — a dark-background placeholder added by the minigame JS.

3. **Accidental "Finish Mission" (UX-v2-2, High):** The proximity of a reversible action (Shutdown) and an irreversible one (Finish Mission) in the same unseparated list, with only a confirmation dialog as a guard, is a meaningful risk given that the plan already describes players being focused and clicking quickly.

The iframe overflow issue (UX-v2-5) and the VNC auto-open behaviour in the embedded context (UX-v2-7) are both important for the quality of the VM terminal experience but are unlikely to make the feature completely unusable — they degrade it rather than break it. The HUD discoverability issue (UX-v2-1) and mid-session lazy state reconciliation (UX-v2-8) should be addressed before launch for the lazy activation mode specifically; for eager missions they are lower stakes.

The two Low findings (UX-v2-9, UX-v2-10) are polish issues. UX-v2-10 is an upgrade of a concern already raised in v1 — the plan's current resolution (flash + redirect to game) is not sufficient and should be revisited.
