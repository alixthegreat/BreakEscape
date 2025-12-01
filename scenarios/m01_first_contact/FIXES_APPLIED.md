# Mission 1: First Contact - Fixes Applied

**Date:** 2025-12-01
**Status:** ✅ All Critical Issues Resolved
**Latest Fix:** 2025-12-01 - Fixed item types to match #give_item tags (removed id fields, corrected type values)

---

## Issues Found and Fixed

### Issue #1: Missing Opening Briefing Cutscene

**Problem:** Opening briefing Ink script existed but wasn't configured to auto-start

**User Feedback:** "The NPC opening briefing doesn't start, it needs to be on a timed conversation delay 0"

**Root Cause:** No NPC with `timedConversation` configured in starting room

**Fix Applied:**
- Added `briefing_cutscene` NPC to reception_area
- Configured with `timedConversation` (delay: 0, targetKnot: "start")
- Set background to `assets/backgrounds/hq1.png` to show briefing occurs at HQ
- Links to `m01_opening_briefing.json` Ink script

**File Changed:** `scenarios/m01_first_contact/scenario.json.erb`

```json
{
  "id": "briefing_cutscene",
  "displayName": "Agent 0x99",
  "timedConversation": {
    "delay": 0,
    "targetKnot": "start",
    "background": "assets/backgrounds/hq1.png"
  },
  "storyPath": "scenarios/m01_first_contact/ink/m01_opening_briefing.json"
}
```

---

### Issue #2: Missing Closing Debrief Trigger

**Problem:** Closing debrief Ink script existed but had no trigger mechanism

**User Feedback:** "The closing conversation can be triggered by an event, such as an objective being complete, item collected, door unlocked, etc, or via ink"

**Root Cause:** No phone NPC event mapping to trigger debrief after Derek confrontation

**Fix Applied:**
1. Added `derek_confronted` global variable to scenario.json.erb
2. Added `phoneNPCs` section with two NPCs:
   - `agent_0x99`: Handler with event mappings for item pickups and room entries
   - `closing_debrief_trigger`: Triggers when `derek_confronted` becomes true
3. Updated `m01_derek_confrontation.ink` to set `derek_confronted = true` at all 3 ending paths
4. Added `#exit_conversation` tag before each END

**Files Changed:**
- `scenarios/m01_first_contact/scenario.json.erb` - Added phoneNPCs section
- `scenarios/m01_first_contact/ink/m01_derek_confrontation.ink` - Added variable setting
- Recompiled: `m01_derek_confrontation.json`

```json
"phoneNPCs": [
  {
    "id": "closing_debrief_trigger",
    "displayName": "Agent 0x99",
    "npcType": "phone",
    "storyPath": "scenarios/m01_first_contact/ink/m01_closing_debrief.json",
    "eventMappings": [{
      "eventPattern": "global_variable_changed:derek_confronted",
      "targetKnot": "start",
      "condition": "value === true",
      "onceOnly": true
    }]
  }
]
```

```ink
// In m01_derek_confrontation.ink - added before each END
~ derek_confronted = true
#exit_conversation
```

---

### Issue #3: Incorrect Item Type for #give_item Tags

**Problem:** NPCs' items used wrong `type` field values - #give_item tags reference `type`, not `id`

**User Feedback:**
- "NPC sarah_martinez doesn't have visitor_badge. An NPC must hold the items they give away"
- "Still says sarah_martinez doesn't hold visitor_badge -- maybe it needs to be specified in the give by the type 'keycard'"

**Root Cause:** Misunderstood how #give_item tags work:
- Items should NOT have `id` fields
- The `#give_item:parameter` tag references the item's `type` field
- We incorrectly added `id` fields and used wrong types

**Fix Applied:**
- Removed ALL `id` fields from NPC items
- Changed item types to match #give_item tag parameters:
  - Sarah: `visitor_badge` - changed type from "keycard" to "visitor_badge"
  - Kevin: `lockpick` - type already correct
  - Kevin: `rfid_cloner` - changed type from "tool" to "rfid_cloner"
- Updated SCENARIO_JSON_FORMAT_GUIDE.md with correct pattern

**Files Changed:**
- `scenarios/m01_first_contact/scenario.json.erb` - Fixed item types, removed id fields
- `story_design/SCENARIO_JSON_FORMAT_GUIDE.md` - Corrected documentation

```json
// ✅ CORRECT - Item type matches Ink tag parameter
"itemsHeld": [
  {
    "type": "visitor_badge",  // Matches #give_item:visitor_badge
    "name": "Visitor Badge",
    "takeable": true
  }
]
```

```ink
// In Ink script
#give_item:visitor_badge  // References item type!
```

```json
// ❌ INCORRECT - Don't add id field
"itemsHeld": [
  {
    "id": "visitor_badge",   // DON'T DO THIS
    "type": "keycard",       // Wrong - doesn't match tag
    "name": "Visitor Badge"
  }
]
```

---

### Issue #4: Incorrect Scenario JSON Structure

**Problem:** Initial scenario.json.erb used wrong format (arrays instead of objects, extra metadata)

**Root Cause:** Previous prompts didn't reference actual codebase examples

**Fix Applied:**
- Converted rooms from array to object format
- Simplified connections to `{ "north": "room_id" }` format
- Moved NPCs into room arrays
- Inlined locks on rooms/containers
- Removed mission metadata (belongs in mission.json)
- Removed separate registries (locks, items, containers)

**File Changed:** `scenarios/m01_first_contact/scenario.json.erb` (complete restructure)

---

### Issue #5: Incorrect EXTERNAL Variable Usage

**Problem:** Ink scripts used `EXTERNAL variable()` instead of `VAR` with globalVariables

**Root Cause:** Misunderstanding of global variable system

**Fix Applied:**
- Changed all `EXTERNAL` declarations to `VAR` declarations
- Added all variables to `globalVariables` section in scenario.json.erb
- Fixed all variable usage (removed `()` function calls)
- Recompiled all affected Ink scripts

**Files Changed:**
- All 9 Ink scripts (changed EXTERNAL to VAR)
- `scenarios/m01_first_contact/scenario.json.erb` (added globalVariables)

**Reference:** See `docs/GLOBAL_VARIABLES.md` for correct pattern

---

## Documentation Created

### 1. SCENARIO_JSON_FORMAT_GUIDE.md

**Location:** `story_design/SCENARIO_JSON_FORMAT_GUIDE.md`

**Contents:**
- Correct vs incorrect scenario.json.erb formats
- Room format (object not array)
- Connection format (simple not complex)
- Global variables (VAR not EXTERNAL)
- Timed conversations (opening cutscenes)
- Phone NPCs with event mappings (closing debriefs)
- Common mistakes and how to avoid them
- Validation checklist

**Purpose:** Primary reference for future scenario development

### 2. README.md

**Location:** `scenarios/m01_first_contact/README.md`

**Contents:**
- Mission status and file inventory
- Testing checklist
- Known issues and TODOs
- Integration notes
- Developer quick start

### 3. FIXES_APPLIED.md

**Location:** `scenarios/m01_first_contact/FIXES_APPLIED.md`

**Contents:** This document

---

## Prompts Updated

### 1. Stage 1: Narrative Structure

**File:** `story_design/story_dev_prompts/01_narrative_structure.md`

**Added Section:** "Important: Opening and Closing Cutscenes"
- Opening briefing requirements (timedConversation)
- Closing debrief implementation options
- Reference to format guide

### 2. Stage 7: Ink Scripting

**File:** `story_design/story_dev_prompts/07_ink_scripting.md`

**Added Section:** "CRITICAL: Compile Ink Scripts Before Proceeding"
- Compile scripts after writing them: `./scripts/compile-ink.sh [scenario_name]`
- Validates syntax and catches errors early
- Explains END tag warnings for cutscenes vs regular NPCs
- Ensures compiled .json files ready before Stage 8

### 3. Stage 9: Scenario Assembly

**File:** `story_design/story_dev_prompts/09_scenario_assembly.md`

**Added Section:** "Pre-Assembly Required Steps"
- Compile all Ink scripts before assembly
- Verify successful compilation
- Fix any errors before proceeding

**Updated Section:** "Required Reading"
- Added CRITICAL reference to SCENARIO_JSON_FORMAT_GUIDE.md
- Updated documentation references to match actual files
- Added reference to working examples (ceo_exfil, npc-sprite-test3)

---

## Testing Recommendations

### Critical Tests

1. **Opening Briefing Auto-Start**
   - [ ] Load scenario
   - [ ] Verify briefing starts automatically with delay 0
   - [ ] Verify background shows HQ (not office)
   - [ ] Verify dialogue flows correctly

2. **Closing Debrief Trigger**
   - [ ] Complete Derek confrontation (any ending)
   - [ ] Verify phone call triggers immediately
   - [ ] Verify debrief dialogue reflects player choices
   - [ ] Verify mission completion acknowledged

3. **Global Variables**
   - [ ] Verify variables sync between NPCs
   - [ ] Verify `derek_confronted` triggers debrief
   - [ ] Check all 3 Derek ending paths set variable

4. **Phone NPC Event Mappings**
   - [ ] Agent 0x99 calls when lockpick acquired
   - [ ] Agent 0x99 calls when server room entered
   - [ ] Agent 0x99 calls when Derek's office entered
   - [ ] Debrief triggers after Derek confrontation

---

## Lessons Learned

### For Future Scenarios

**Always Do:**
1. ✅ Reference SCENARIO_JSON_FORMAT_GUIDE.md during Stage 9
2. ✅ Add opening briefing NPC with timedConversation in starting room
3. ✅ Add closing debrief trigger (phone NPC with event mapping)
4. ✅ Use VAR + globalVariables for cross-NPC state (not EXTERNAL)
5. ✅ Set item `type` to match #give_item tag parameter (DON'T use `id` field)
6. ✅ Test Ink scripts compile before scenario assembly
7. ✅ Use object format for rooms, simple format for connections
8. ✅ Reference working examples (ceo_exfil, npc-sprite-test3)

**Never Do:**
1. ❌ Use EXTERNAL for regular variables
2. ❌ Use array format for rooms
3. ❌ Create top-level registries (locks, items, containers)
4. ❌ Put mission metadata in scenario.json.erb
5. ❌ Add `id` fields to items in itemsHeld (use `type` field instead)
6. ❌ Forget to set mission completion variables
7. ❌ Skip event mappings for automatic triggers

---

## Validation Checklist

### Scenario Structure
- [x] Rooms use object format
- [x] Connections use simple format
- [x] NPCs in room arrays
- [x] Objects inline in rooms
- [x] Locks inline on containers/rooms
- [x] globalVariables section present
- [x] phoneNPCs section present

### Cutscenes and Triggers
- [x] Opening briefing NPC with timedConversation
- [x] Closing debrief phone NPC with event mapping
- [x] Mission completion variable set in final script
- [x] #exit_conversation tag before END statements

### Ink Scripts
- [x] All scripts use VAR not EXTERNAL
- [x] All scripts compile successfully
- [x] Variables match globalVariables section
- [x] Event trigger knots exist (for phone NPCs)

### Documentation
- [x] Format guide created
- [x] README created
- [x] Prompts updated
- [x] Examples documented

---

## Final Status

**✅ Mission 1: First Contact is now ready for in-game testing**

All critical issues resolved:
- Opening briefing will auto-start
- Closing debrief will auto-trigger
- Global variables properly configured
- Scenario structure matches codebase format
- All Ink scripts compile successfully
- Documentation complete for future scenarios

**Next Step:** Load scenario in game and test critical path

---

**Document Version:** 1.0
**Last Updated:** 2025-12-01
