# Implementation Plan Review — Launch-Abort Mode

Reviewed against codebase on 2026-03-20.

---

## Summary of Open Question Resolutions

| Question | Resolution |
|---|---|
| Archive contents reveal | Remote unlock of existing `safe` — reward type `unlock_object` fired when flag3 submitted at Drop-Site. Player opens it normally via container minigame. No new mode needed. |
| Launch device sprite | `tablet.png` exists at `assets/objects/tablet.png`. Copy → `launch_device.png` as placeholder. |
| Objectives restructure | `decrypt_entropy_intel` aim stays as-is; the archive now just unlocks remotely instead of needing a separate passphrase entry. `open_entropy_archive` task completes when the safe is interacted with post-unlock. |
| Debrief trigger | Use the existing `closing_debrief` knot in `m01_phone_agent0x99.ink`. Update the condition in `support_hub` to also require `launch_code_submitted && (player_aborted_attack || player_launched_attack)`. `choose_resolution` custom task is removed — the debrief offer via phone replaces it cleanly. |

---

## Findings: What the Plan Gets Right

### Flag-station handler in `interactions.js` (line 808–822)
The flag-station interaction fires **before** the inventory range check (line 867), so inventory items of type `flag-station` are already handled correctly. The launch device will work from inventory without additional routing logic — just extend the params passed to the minigame.

### Container unlock path is clean
`interactions.js` line 889–899: when an object has `contents`, `handleUnlock` is called. If the server says it's unlocked, `handleContainerInteraction` opens the container minigame normally. Adding a remote unlock (setting `locked: false` on the sprite's `scenarioData`) is all that's needed — no new unlock path required.

### Phone ink debrief knot is already designed for this
`m01_phone_agent0x99.ink` line 84: the `closing_debrief` knot appears as a choice in `support_hub` behind a condition. The condition just needs extending. The knot itself (`closing_debrief` → `#set_global:start_debrief_cutscene:true`) already triggers the cutscene NPC. No structural change.

### No change needed to `m01_derek_confrontation.ink`
The confrontation gate (`not ssh_flag_submitted or not linux_flag_submitted or not sudo_flag_submitted`) requires 3 flags, which is correct. Flag4 (launch code) is only needed for the launch device, obtained after Derek is KO'd, so the gate doesn't need to know about it.

### `closing_debrief.ink` is branch-ready
The debrief uses condition branching throughout (e.g., `{found_casualty_projections && found_target_database}`). Adding `{player_launched_attack}` at the `=== start ===` knot follows exactly the same pattern.

---

## Findings: Gaps and Corrections Needed

### 1. `processRewardEvents` — two new reward types missing
`flag-station-minigame.js` currently handles: `give_item`, `unlock_door`, `emit_event`, `complete_task`.

**Missing:** `unlock_object` and `set_global`.

Both must be added. `unlock_object` emits `object_remotely_unlocked` for the engine to handle. `set_global` patches `window.gameState.globalVariables` and emits `global_variable_changed:<key>` for the Ink interpreter.

### 2. `object_remotely_unlocked` event — no listener exists yet
The event doesn't exist anywhere in the codebase. It needs a listener in either `interactions.js` (near line 21, where `item_removed_from_scene` is subscribed) or in `rooms.js`. The listener must walk `rooms` and find the object by `scenarioData.id` or `objectId`, then set `scenarioData.locked = false`.

**Risk:** The room object lookup must handle the case where the player is in a different room from the archive (server room). Since `rooms` holds all loaded rooms, not just the current one, this should work — but confirm that the server room is pre-loaded before the player reaches it.

### 3. `interactions.js` flag-station handler — params not fully forwarded
Current handler (line 811–819) passes only: `title`, `stationId`, `stationName`, `flags`, `acceptsVms`, `submittedFlags`, `gameId`.

Missing: `mode`, `onAbort`, `onLaunch`, `abortConfirmText`, `launchConfirmText`, `flagRewards`.

The minigame constructor will silently default these to `null`/`'standard'` without them. Must be added to the handler.

### 4. Flag-station server-side `flagRewards` registration
The game server registers `flagRewards` from the scenario at load time (see `games_controller.rb` and `game.rb`). The launch device will need its flag4 registered there. Since the launch device is in Derek's `itemsHeld`, it may not be traversed by the existing server-side flag registration code if it only scans `room.objects` and not NPC inventory.

**Action needed:** Check `game.rb` (or equivalent scenario parser) to confirm `flagRewards` from items inside `itemsHeld` arrays are registered. If not, add traversal.

### 5. `m01_terminal_dropsite.ink` — still references `bystander` narrative
Line 148: `[Player enters flag from VM - bystander account access]` and line 162: `Bystander account files reveal...` — both refer to the old `bystander` account. Now that the account is named `shatter` and the narrative is ENTROPY infrastructure, these strings need updating. The Ink file is used for the in-world terminal UI text.

### 6. `m01_terminal_dropsite.ink` — third flag reward text needs rethinking
Current success text for flag3 (line 162–169):
> "Critical intelligence unlocked: Bystander account files reveal Derek Lawson's coordination..."

With the new design, flag3 is the archive decryption key and the reward is that the archive unlocks. The success text should say:
> "Archive decryption key confirmed. The ENTROPY encrypted archive in this room has been remotely unlocked. Find a second file in the shatter account: the launch authorization code."

### 7. `m01_derek_confrontation.ink` — `insufficient_evidence` text refers to old mechanics
Line 30 gate and line 60–77 insufficient-evidence dialogue don't mention the archive or the launch device. Since the confrontation still only needs 3 flags, this is fine mechanically — but the dialogue at line 60 says "server room has plenty to keep you busy" which still works. Low priority.

### 8. Ink variable declarations in `m01_phone_agent0x99.ink`
The phone ink declares its own local copies of global vars (lines 24–42). The new variables `player_aborted_attack`, `player_launched_attack`, `ready_for_debrief`, `launch_code_submitted` need declaring at the top of this file as `VAR` declarations, otherwise the condition in `support_hub` will throw a runtime error.

Same applies to `m01_closing_debrief.ink` — `player_launched_attack` and `player_aborted_attack` must be declared there too.

### 9. Launch device `onPickup` global
The plan mentions `entropy_launch_device_obtained` global set on pickup, but this isn't listed in the scenario `globalVariables` dict in the plan. Either add it or handle the item_picked_up event via the existing `item_picked_up:entropy_launch_device` eventMapping in agent_0x99.

Recommend: drop `entropy_launch_device_obtained` as a separate global — the `item_picked_up:entropy_launch_device` event mapping is sufficient to react to it. Don't need the global unless an Ink knot gates on it.

### 10. `game.js` sprite loading for launch device
Line 406: `this.load.image('flag-station', 'objects/flag-station.png')` — the flag-station type items use this texture. If the launch device uses type `"flag-station"`, it will render with the flag-station sprite, not the tablet/device sprite.

Options:
- **Option A:** Keep type as `"flag-station"` (handles interaction routing correctly) but add `"assetKey": "tablet"` or `"assetKey": "launch_device"` to override the sprite. Requires the rooms/interaction system to use `assetKey` when present.
- **Option B:** Give it a unique type like `"launch-device"` and add it to the interaction handler's detection check alongside `"flag-station"`.

**Option A is simpler** if `assetKey` override is already supported. Check `rooms.js` item sprite loading. If not supported, Option B adds one line to the handler condition.

### 11. `choose_resolution` custom task — orphaned
The objectives currently have a `close_the_case` aim with `choose_resolution` custom task. The new design replaces this with the launch device interaction and phone debrief. The `choose_resolution` task should be removed from the objectives list, or the `close_the_case` aim should be repurposed to track launch-device use.

Recommend: Replace `choose_resolution` with `use_launch_device` task of type `custom`, completing when `player_aborted_attack || player_launched_attack` is set.

---

## Risk Assessment

| Item | Risk | Impact | Mitigation |
|---|---|---|---|
| `object_remotely_unlocked` listener — room not pre-loaded | Low–Medium | Archive doesn't unlock visually | Pre-load server room, or apply unlock when player re-enters |
| NPC `itemsHeld` not traversed for server flagRewards | Medium | Flag4 not validated by Hacktivity | Check game.rb parser; add traversal if missing |
| Ink var declarations missing | Low | Runtime error on phone call | Add all 4 vars to both ink files before implementation |
| `tablet` asset key conflicts | Low | Wrong sprite on launch device | Verify asset key mechanism in rooms.js |
| `choose_resolution` task orphaned | Low | Objective never completes | Replace with `use_launch_device` in scenario |

---

## Not in Scope (Confirmed Out)

- `archive-key` flag-station mode — dropped; remote unlock of existing safe is simpler and cleaner
- `requiresGlobal` param on launch device — dropped; the launch device shows the flag entry UI immediately, shows ABORT/LAUNCH after successful submission
- Any change to the confrontation gate (still 3 flags)

---

## Recommended Implementation Start Point

Start with **item 4 (game.rb NPC itemsHeld traversal check)** — it's the highest-risk unknown. If the server doesn't register flag4 from Derek's inventory, none of the Hacktivity validation for the launch device works. Confirm before writing any client code.

Second: **item 2 (`object_remotely_unlocked` listener)** — write and test this in isolation before wiring up the full flag3 reward chain.
