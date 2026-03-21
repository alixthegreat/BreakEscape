# Plan v2 Review

Reviewed against codebase. All findings are from static analysis of the actual files.

---

## Section-by-Section Findings

### 1. SecGen XML (`scenarios/m01_first_contact/1_intro_linux.xml`)

**Plan claims:** Add second `flag_generator` + `launch_code` filename to shatter account.

**Code reality:** Shatter account currently has ONE `flag_generator` (line 120). `leaked_filenames` has three entries: `flag`, `operation_shatter/DEPLOYMENT_CONFIG`, `operation_shatter/TARGET_MANIFEST`. `launch_code` is absent. XML structure matches exactly what the plan proposes adding.

**Match:** ✓ Gap correctly identified.

---

### 2. Sprite / Asset Loader (`public/break_escape/js/core/game.js`)

**Plan claims:** `tablet` already loaded; `launch_device` is not.

**Code reality:**
- Line 118: `this.load.image('tablet', 'objects/tablet.png');` ✓
- No `launch_device` image loader anywhere in the file
- `tablet.png` exists at `assets/objects/tablet.png` (368 bytes)
- `launch_device.png` does NOT exist

**Match:** ✓ Accurate.

---

### 3. `flag-station-minigame.js`

**Plan claims:** No `mode` param, no `unlock_object`/`set_global` reward handlers, no launch-abort UI.

**Code reality:**
- Constructor (lines 11–20): No `mode`, `onAbort`, `onLaunch` parameters
- `processRewardEvents()` (lines 478–541): Handles `give_item`, `unlock_door`, `emit_event`, `complete_task`. Does NOT handle `unlock_object` or `set_global`
- No `buildLaunchAbortUI()`, `showLaunchAbortChoice()`, `handleAbort()`, `handleLaunch()`, `applyChoiceConfig()`, or `choiceMade` guard

**Match:** ✓ Accurate. All planned additions are genuinely absent.

---

### 4. `interactions.js`

**Plan claims (4a):** Flag-station handler at ~line 808 passes limited params; needs `mode`, `onAbort`, `onLaunch`, `abortConfirmText`, `launchConfirmText` added.

**Code reality (lines 808–822):** Current params passed: `title`, `stationId`, `stationName`, `flags`, `acceptsVms`, `submittedFlags`, `gameId`. All five new params are missing.

**Plan claims (4b):** No `object_remotely_unlocked` listener exists.

**Code reality:** `setGameInstance()` (lines 15–25) subscribes only to `item_removed_from_scene`. The listener doesn't exist.

**Plan claims (4c):** `assetKey` is not supported in `rooms.js`.

**Code reality:** Item sprite creation in `rooms.js` (lines 348–361) explicitly skips copying `texture` fields. No `assetKey` mechanism exists. Plan's fallback (use type `"launch-device"` as a distinct type string) is the correct path.

**Match:** ✓ Accurate on all three sub-points. `import { rooms }` at line 5 confirms the rooms object is importable in interactions.js.

---

### 5. Server-Side Flag Registration (`app/controllers/break_escape/games_controller.rb`)

**Plan claims:** HIGH RISK — server may not traverse NPC `itemsHeld` for flag registration.

**Code reality — two separate code paths:**

1. **Flag registration** (lines 1117–1137): Iterates `room['npcs'][].itemsHeld[]` looking for items with `flags` — this DOES traverse NPC inventories ✓

2. **Flag station lookup** `find_flag_station_for_flag()` (lines 1491–1531): Only searches `room['objects']` — does NOT search NPC `itemsHeld`

**Critical finding:** These two paths are inconsistent. Flag4 may be registered (path 1) but when a player submits it, the reward lookup (path 2) won't find the launch device in Derek's inventory, meaning `flagRewards` for flag4 will never fire. Flag4 itself may validate correctly, but no rewards will be applied.

**Match:** Plan correctly identifies this as the highest-risk unknown. The exact failure mode is now clearer: validation will pass but rewards won't apply.

---

### 6. `scenario.json.erb`

**Archive observations (line 1598):** Currently: `"A heavily encrypted portable drive locked in a reinforced case. Stamped: ENTROPY — EYES ONLY. The passphrase is hidden somewhere in the system you just compromised."` — needs update to mention the shatter account. ✓ Matches plan's claim.

**Drop-Site `flagRewards` (lines 1545–1561):** Three entries (emit_event × 3). No `unlock_object` entry. ✓

**Derek NPC (lines 931–957):** No `itemsHeld` field present. ✓

**Agent 0x99 eventMappings:** All four new entries (sudo_flag_submitted hint, item_picked_up, attack_aborted, attack_launched) are absent. ✓

**GlobalVariables:** `launch_code_submitted`, `player_aborted_attack`, `player_launched_attack`, `ready_for_debrief` — none present. ✓

**`close_the_case` aim (lines 387–401):** `choose_resolution` custom task exists exactly as plan describes. ✓

**Match:** ✓ All gaps correctly identified.

---

### 7. Ink Scripts

**`m01_terminal_dropsite.ink`:**
- Line 148: `[Player enters flag from VM - bystander account access]` — exact match to plan's claimed text ✓
- Line 164: `Bystander account files reveal Derek Lawson's coordination...` — needs replacement ✓

**`m01_phone_agent0x99.ink`:**
- Lines 7–52: VAR block. Missing: `player_aborted_attack`, `player_launched_attack`, `ready_for_debrief`, `launch_code_submitted` ✓
- Line 84: Debrief condition: `{derek_confronted and ssh_flag_submitted and linux_flag_submitted and sudo_flag_submitted}` — does not include the new checks ✓

**`m01_closing_debrief.ink`:**
- Lines 8–35: VAR block. Missing: `player_aborted_attack`, `player_launched_attack` ✓
- Lines 41–47: `=== start ===` knot goes directly to normal opening with no branching on `player_launched_attack`. `launch_weight` knot does not exist. ✓

**Match:** ✓ All gaps correctly identified.

---

### 8. `flagRewards` Indexing Model

**Code reality (games_controller.rb lines 1377–1386):**
```ruby
flag_index = obj['flags']&.find_index { |f| f.downcase == flag_key.downcase }
if flag_index && obj['flagRewards'][flag_index]
  rewards << obj['flagRewards'][flag_index].merge(...)
end
```

**Finding:** Server uses **strict index mapping** — `flagRewards[i]` maps 1:1 to `flags[i]`. Only ONE reward object is returned per flag submission. The plan as written would need either:
- A single `flagRewards[2]` object that encodes multiple actions (not currently supported), OR
- A different mechanism for the `unlock_object` reward to fire alongside `sudo_flag_submitted`

**This is a structural issue not fully resolved in the plan.** See Corrections Needed §C1 below.

---

## Confirmed Accurate

1. ✓ Shatter account has one flag_generator; plan correctly specifies adding a second
2. ✓ `tablet` loaded; `launch_device` not yet loaded
3. ✓ FlagStationMinigame missing `mode`, `onAbort`, `onLaunch` params
4. ✓ `processRewardEvents()` missing `unlock_object` and `set_global` handlers
5. ✓ Flag-station handler in interactions.js missing all five new params
6. ✓ `object_remotely_unlocked` listener doesn't exist
7. ✓ `assetKey` not supported in rooms.js item loading
8. ✓ Archive observations don't reference shatter account
9. ✓ Drop-Site `flagRewards[2]` has no `unlock_object` entry
10. ✓ Derek NPC has no `itemsHeld`
11. ✓ Agent 0x99 missing all four new event mappings
12. ✓ Four new globals absent from `globalVariables`
13. ✓ `choose_resolution` task exists and needs replacement
14. ✓ Dropsite ink line 148 says "bystander" — needs "shatter"
15. ✓ Phone ink missing four VAR declarations
16. ✓ Phone ink debrief condition doesn't check new vars
17. ✓ Closing debrief missing VAR declarations and `launch_weight` branch

---

## Corrections Needed

### C1. CRITICAL — `flagRewards` single-object-per-index constraint

The server returns exactly one `flagRewards[flag_index]` object per submission. The plan shows flag3 needing to fire both `emit_event: sudo_flag_submitted` AND `unlock_object: entropy_encrypted_archive` at index 2.

**Options:**
- **Option A (recommended):** Extend the server to support an array at each `flagRewards` index (i.e., if the entry is an array, loop through it). One-line change to `process_flag_rewards()`.
- **Option B:** Use a single reward object with a new type `"multi"` that wraps an array of child rewards.
- **Option C:** Keep one reward at index 2, make it `emit_event: sudo_flag_submitted`, and have a game-engine event mapping listen for `sudo_flag_submitted` to fire `object_remotely_unlocked`. This avoids server changes entirely but adds indirection.

**Option C requires zero server changes** and is the lowest-risk path. Add to `agent_0x99` eventMappings:
```json
{
  "eventPattern": "global_variable_changed:sudo_flag_submitted",
  "condition": "value === true",
  "onceOnly": true,
  "emitEvent": "object_remotely_unlocked",
  "emitEventData": { "objectId": "entropy_encrypted_archive" }
}
```
(Requires the event mapping system to support `emitEvent` with payload — check if this is currently supported.)

### C2. CRITICAL — `find_flag_station_for_flag()` doesn't search NPC itemsHeld

When flag4 is submitted from the launch device (in Derek's itemsHeld), the server can't find the flag-station object to look up its `flagRewards`. Validation may pass, but no rewards fire.

**Options:**
- **Option A (clean):** Extend `find_flag_station_for_flag()` to also iterate `room['npcs'][].itemsHeld[]`.
- **Option B (avoid server change):** Add a second flag-station object in the server room's `objects` array specifically for flag4 registration, with no visible world presence. This is a hidden registration stub.
- **Option C:** Drop Hacktivity validation for flag4 entirely — the launch device just does a client-side check against a known value. Less secure but simpler.

**Option A is cleanest** and aligns with how flag registration already works (line 1117 already traverses itemsHeld for registration — just extend the lookup to match).

### C3. Drop-Site Ink flag3 success text

`m01_terminal_dropsite.ink` line ~164 refers to "bystander" in the success text. The plan mentions line 148 but misses line 164. Both need updating. The flag3 success message should confirm the archive is unlocked and direct the player to find the launch_code:

```ink
=== sudo_success ===
~ sudo_flag_submitted = true
#complete_task:submit_sudo_flag
#unlock_task:confront_derek

✓ FLAG VERIFIED: Archive Decryption Key

Archive decryption key confirmed. The ENTROPY encrypted archive in this room has been remotely unlocked — open it to access the intelligence inside.

Check the shatter account for a second file: ~/launch_code — the launch authorization code for Derek's device.

-> hub
```

### C4. `use_launch_device` task completion mechanism

The plan replaces `choose_resolution` with `use_launch_device` (type: `custom`) but doesn't specify how it completes. Custom tasks require either an explicit `completeTask` call from an event mapping, or a `complete_task` reward. Add to agent_0x99 eventMappings:

```json
{
  "eventPattern": "attack_aborted",
  "onceOnly": true,
  "completeTask": "use_launch_device"
},
{
  "eventPattern": "attack_launched",
  "onceOnly": true,
  "completeTask": "use_launch_device"
}
```

Merge these with the existing `attack_aborted`/`attack_launched` eventMappings proposed in the plan (they can share the same event pattern entries).

---

## Unknown / Needs Runtime Check

1. **Does `eventMappings` support `emitEvent` with payload data?** (Relevant to C1 Option C). Check npc-game-bridge.js.
2. **Lock overlay:** Plan references `obj.lockOverlay.setVisible(false)` in the remote unlock listener. Confirm archive safe sprites have this overlay and what the correct property name is.
3. **Global variable propagation to Ink:** Confirm that `global_variable_changed:<key>` events are received by the Ink interpreter and update the corresponding `VAR` declarations in the correct Ink file context.
4. **Flag4 validation with no rewards (C2):** Test whether a flag submission returns success even if `find_flag_station_for_flag()` returns nil. If the server returns an error, the minigame shows "invalid flag" even though the flag is correct — bad UX.

---

## Overall Assessment

**Ready to implement?** Not yet — two blockers.

**Blockers:**
1. **`flagRewards` single-index constraint (C1):** Choose Option A (server array support), B, or C (event-mapping workaround) and update the plan before implementing the Drop-Site reward chain.
2. **`find_flag_station_for_flag()` NPC traversal gap (C2):** Choose Option A (extend server lookup) or B (room-object stub) before implementing the launch device Hacktivity flow.

**Non-blocking — can proceed in parallel:**
- All client-side JS changes (flag-station-minigame.js, interactions.js, game.js)
- Asset creation
- All scenario.json.erb content additions
- All Ink script changes

**Estimated additional plan revision needed:** Small — add Option selections for C1 and C2, add C3 (dropsite success text), add C4 (task completion mechanism). Everything else in the plan is correct and implementable.
