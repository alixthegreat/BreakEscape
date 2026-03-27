# Scenario Validation Improvements Plan

## Overview

This plan brings `scripts/validate_scenario.rb` and `scripts/scenario-schema.json` into full
alignment with `scenarios/m01_first_contact/scenario.json.erb`, which is the authoritative
reference scenario. Goals:

1. Fix cases where the validator incorrectly rejects or warns about valid m01 patterns.
2. Add structural checks for components m01 uses that the validator does not yet understand.
3. Improve guidance messages so they describe what m01 does and point to it as an example.

---

## m01 Component Inventory

### Rooms (13 total)
`reception_area`, `main_office_area`, `storage_closet`, `break_room`, `conference_room`,
`it_room`, `hallway_west`, `hallway_east`, `manager_office`, `kevin_office`, `maya_office`,
`derek_office`, `server_room`

### Room types used (some missing from schema enum)
- `room_reception`, `room_office`, `room_servers`, `hall_1x2gu` — already in schema
- `room_break`, `room_meeting`, `room_it` — **missing from schema**
- `small_room_storage_1x1gu`, `small_office_room2_1x1gu` — **missing from schema**

### Lock types used
- `key` — main_office_area door, sarah's briefcase, derek_office door
- `pin` — main filing cabinet, storage safe, derek personal safe, derek cabinet, IT room door
- `rfid` — server_room door
- `password` — derek_computer, kevin workstation
- `flag` — entropy_encrypted_archive — **missing from schema lockType enum**

### Item types
`type` is a sprite name — **any string is valid**. The schema must not restrict it to an enum.
Certain types carry special engine behaviour (see schema description). Decorative/prop sprites
(e.g. `office-misc-pencils`, `chalkboard`) are valid with just `observations` for flavour.

### NPCs
- `briefing_cutscene` — person, timedConversation with `waitForEvent`/`skipIfGlobal`/`setGlobalOnStart`
- `sarah_martinez` — person, `globalVarOnKO`, `taskOnKO`, hostile behavior, itemsHeld
- `agent_0x99` — phone, 30+ eventMappings, timedMessages with `waitForEvent`
- `closing_debrief_person` — person, `behavior.initiallyHidden: true`, eventMappings only
- `derek_lawson` — person, itemsHeld with `launch-device`, eventMappings, hostile
- `kevin_park` — person, itemsHeld, hostile behavior
- `maya_chen` — person, `globalVarOnKO` only

### NPC fields missing from schema
- `globalVarOnKO` (string) — sets a global var when NPC is knocked out
- `taskOnKO` (string) — completes a task when NPC is knocked out
- `behavior.initiallyHidden` (boolean) — hides NPC until triggered
- `behavior.hostile` with `chaseSpeed`, `attackDamage`, `pauseToAttack`
- `voice` object on person NPCs (name, style, language) for TTS
- `timedConversation.waitForEvent`, `.skipIfGlobal`, `.setGlobalOnStart`
- `timedMessages[].waitForEvent`
- `eventMappings[].disableClose`

### Item/object fields missing from schema
- `onRead.setVariable` — fires a global variable set when an item is read
- `onPickup.setVariable` — fires a global variable set when item is picked up
- `collection_group` — groups items for `task.targetGroup` tracking
- `ttsVoice` — text-to-speech voice config on phone objects
- `sprite` — override sprite on vm-launcher/launch-device
- `mode` — operational mode on launch-device (e.g., `launch-abort`)
- `onAbort`, `onLaunch` — handlers on launch-device
- `abortConfirmText`, `launchConfirmText` — player-facing dialogs on launch-device

### Task fields missing from schema
- `type: "manual"` — **missing from task type enum**
- `optional` (boolean)
- `targetItemIds` (array of item IDs, distinct from `targetItems` which is item types)
- `targetGroup` (string — matches `collection_group` on items)
- `onComplete.setGlobal` (object)

### Objective fields missing from schema
- `unlockCondition.aimsCompleted` (array of strings — multi-aim variant of `aimCompleted`)

### Top-level fields missing from schema
- `flags` (object) — holds VM flag data, e.g. `{ "desktop": <%= vm_flags_json('desktop') %> }`
- `show_scenario_brief` (string, e.g. `"on_resume"`)
- `music` (object with `events` array)

### spriteConfig fields missing from schema
- `idleFrameRate`, `walkFrameRate`, `walkFrameStart`, `walkFrameEnd` — used on all NPCs and player

### flagReward.type missing from schema
- `set_global` — **missing from flagReward type enum**
- `key` and `value` properties needed for `set_global` rewards

### Room fields missing from schema
- `ambientSound` (string)
- `ambientVolume` (number 0.0–1.0)

---

## Problems in the Current Validator

### Hard Failures (prevent m01 from being validated at all)

**Problem 1: Missing `vm_flags_json` ERB helper (BLOCKER)**

The scenario uses `<%= vm_flags_json('desktop') %>` at the top level. `ScenarioBinding` does not
define `vm_flags_json`, so ERB rendering fails with `NameError` before any validation runs.

**Fix:** Add `vm_flags_json(vm_name, fallback = [])` to `ScenarioBinding`, mirroring
`flags_for_vm`.

---

### Schema False Positives

**Problem 2:** Missing room types (`room_break`, `room_meeting`, `room_it`,
`small_room_storage_1x1gu`, `small_office_room2_1x1gu`) — schema rejects every such room.

**Problem 3:** Missing item types — schema rejects `notes2`, `notes5`, `bin`, `bin1`,
`chalkboard`, `launch-device`, `office-misc-pencils`, `office-misc-stapler`, `office-misc-pens`.

**Problem 4:** `lockType: "flag"` not in enum — schema rejects `entropy_encrypted_archive`.

**Problem 5:** `task.type: "manual"` not in enum — schema rejects 3 tasks.

**Problem 6:** `flagReward.type: "set_global"` not in enum — schema rejects multiple flagRewards.

**Problem 7:** `unlockCondition.aimsCompleted` not in schema — schema rejects `close_the_case` aim.

**Problem 8:** `task.optional`, `task.targetItemIds`, `task.targetGroup` not in schema.

**Problem 9:** `task.onComplete.setGlobal` not in schema.

**Problem 10:** `spriteConfig` only allows `idleFrameStart/End` — schema rejects all NPCs using
`idleFrameRate`/`walkFrameRate`.

---

### Logic False Positives in `check_common_issues`

**Problem 11: `has_closing_debrief` never set for person NPC pattern**

The validator only sets `has_closing_debrief = true` inside the old `phoneNPCs` section check.
In m01, the closing debrief is a `person` NPC with `eventMappings` using
`conversationMode: "person-chat"` and `eventPattern: "global_variable_changed:..."`.

The validator already collects `person_npcs_with_event_cutscenes` — this flag should also set
`has_closing_debrief` when the npc is not in the start room (i.e., it's a debrief, not opening).

**Fix:** After collecting `person_npcs_with_event_cutscenes`, check if any are not the opening
cutscene NPC — if so, set `has_closing_debrief = true`.

**Problem 12: `has_container_with_contents` only checks `safe` and `suitcase`**

m01 uses `bin`, `bin1`, `pc`, and `briefcase` as containers. The check on line 206 only checks
`safe` and `suitcase` types, so it never fires for m01's extensive container usage.

**Fix:** Add `bin`, `bin1`, `pc`, `briefcase` to the container type check.

**Problem 13: False "missing position" warning for `initiallyHidden` person NPCs**

`check_recommended_fields` warns about person NPCs with no `position`. `closing_debrief_person`
has `behavior.initiallyHidden: true` — it intentionally has no position (it's not an in-world sprite).

**Fix:** Suppress position warning if `npc['behavior']&.dig('initiallyHidden')` is truthy.

---

## New Checks to Add

**Check A: `launch-device` completeness**
When a `launch-device` item is present, check for `mode`, `acceptsVms`, `flags`, `onAbort`,
`onLaunch`, `abortConfirmText`, `launchConfirmText`. Emit guidance if missing.

**Check B: `timedConversation.skipIfGlobal` best practice**
If a NPC has `timedConversation` but no `skipIfGlobal`, suggest adding it to prevent replay on
resume. Reference m01's `skipIfGlobal: "briefing_played"` pattern.

**Check C: `globalVarOnKO` cross-reference**
Check that variables named in NPC `globalVarOnKO` are defined in `scenario.globalVariables`.

**Check D: `taskOnKO` cross-reference**
Check that task IDs in NPC `taskOnKO` exist in the objectives task list.

**Check E: `onRead`/`onPickup` variable cross-reference**
Check that variable names in `setVariable` blocks inside `onRead`/`onPickup` are defined in
`scenario.globalVariables`.

**Check F: `collection_group` / `targetGroup` cross-reference**
Check that every `task.targetGroup` value has at least one item with a matching `collection_group`.
Warn if a `collection_group` value has no matching `targetGroup` task (orphaned group).

**Check G: `targetNPC`, `targetRoom`, `targetObject` existence checks**
- `targetNPC` on NPC conversation tasks — verify NPC ID exists in rooms
- `targetRoom` on enter_room/unlock_room tasks — verify room ID exists
- `targetObject` on unlock_object tasks — verify object ID exists in rooms

**Check H: `music` section presence**
If `music` is absent, suggest adding it. m01's music system significantly enhances immersion.
If present, check that NPC IDs in `conversation_closed:` triggers exist in rooms, and that
global variable names in `global_variable_changed:` triggers are defined.

**Check I: Phone voicemail object detection**
Track `phone`-type objects with a `voice` field (voicemail items). Emit guidance about
`sender`/`timestamp`/`ttsVoice` requirements.

---

## Guidance Message Updates

All suggestion messages that reference `ceo_exfil` or `secgen_vm_lab` should be updated to
reference `m01_first_contact` instead, since it is the authoritative reference scenario and uses
all of these features.

New positive guidance messages to add (✅ GOOD PRACTICE):
- When `globalVarOnKO` is used on NPCs
- When `timedConversation` uses `skipIfGlobal`
- When `collection_group` is used on items with matching `targetGroup`
- When `music` section is present
- When `launch-device` is present (complex feature confirmation)

---

## Schema Additions Summary

**Top-level properties:** `flags` (object), `show_scenario_brief` (string), `music` (object)

**Room type enum additions:** `room_break`, `room_meeting`, `room_it`,
`small_room_storage_1x1gu`, `small_office_room2_1x1gu`

**Room properties:** `ambientSound` (string), `ambientVolume` (number)

**Item type:** Remove the enum entirely — `type` is a free-form sprite name. Document known
special-behaviour types in the description field only.

**Item properties:** `onRead` (object), `onPickup` (object), `collection_group` (string),
`ttsVoice` (object), `sprite` (string), `mode` (string), `onAbort` (object), `onLaunch` (object),
`abortConfirmText` (string), `launchConfirmText` (string)

**lockType enum additions (room and item):** `flag`

**flagReward type enum additions:** `set_global`; add `key` (string) and `value` properties

**Task type enum additions:** `manual`

**Task properties:** `optional` (boolean), `targetItemIds` (array), `targetGroup` (string)

**Task onComplete properties:** `setGlobal` (object)

**Objective unlockCondition properties:** `aimsCompleted` (array of strings)

**NPC properties:** `globalVarOnKO` (string), `taskOnKO` (string), `voice` (object),
`behavior` (object with `hostile`, `patrol`, `initiallyHidden`)

**NPC spriteConfig additions:** `idleFrameRate` (number), `walkFrameRate` (number),
`walkFrameStart` (number), `walkFrameEnd` (number)

**timedConversation additions:** `waitForEvent` (string), `skipIfGlobal` (string),
`setGlobalOnStart` (string)

**timedMessages item additions:** `waitForEvent` (string)

**eventMapping additions:** `disableClose` (boolean)

---

## Implementation Sequence

1. **Fix ERB render failure** — Add `vm_flags_json` to `ScenarioBinding` (highest priority,
   everything else is blocked until this works)
2. **Update schema** — Add all missing types, enums, and properties so m01 passes schema validation
3. **Fix `has_closing_debrief`** — Detect person NPCs with event-driven cutscenes as the debrief
4. **Fix `has_container_with_contents`** — Add bin, bin1, pc, briefcase to container type list
5. **Fix position warning** — Suppress for `initiallyHidden` person NPCs
6. **Add cross-reference checks** — globalVarOnKO, taskOnKO, setVariable, targetGroup,
   targetNPC/Room/Object
7. **Update guidance messages** — Point to m01 as the reference, add new guidance
8. **Fix `check_recommended_fields`** — Skip observations warning for readable items with text

---

## Key Files

- `scripts/validate_scenario.rb` — Core logic
- `scripts/scenario-schema.json` — JSON schema
- `scenarios/m01_first_contact/scenario.json.erb` — Reference scenario (ground truth)
