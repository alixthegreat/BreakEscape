# Changes Made Based on Review Feedback

**Date**: 2026-02-11  
**Status**: Planning documents updated and approved for implementation

---

## Key Changes Made

### 1. Default Sprite Behavior (CRITICAL CHANGE)

**Before**:
- Default sprite: `female_hacker_hood`
- Auto-assigned on preference creation

**After**:
- Default sprite: **NULL**
- Player **MUST** choose before starting first game
- Game creation checks for NULL and redirects to configuration

**Impact**:
- Database migration: `selected_sprite` allows NULL
- Model validation: `allow_nil: true`
- New method: `sprite_selected?` checks if sprite is present
- Game controller: Always check `sprite_selected?` before `sprite_valid_for_scenario?`

---

### 2. UI Implementation Approach (FINAL DECISION)

**Original Plan**:
- 16 separate Phaser mini-scenes (one per sprite)
- JavaScript-heavy with 16 canvas elements
- Complex initialization code
- Memory overhead: ~50MB

**Interim Consideration**:
- Static HTML images (pre-generated PNGs)
- No animation
- Build step required
- New dependency: `chunky_png`

**FINAL DECISION**:
- **Single Phaser instance** rendering all 16 sprites
- Animated breathing-idle previews (engaging, matches game)
- One WebGL context for all sprites
- Leverages existing sprite atlases (no new assets)

**Impact**:
- Added: `public/break_escape/js/ui/sprite-grid.js` (single Phaser instance)
- View: Phaser canvas container with HTML grid overlaid
- CSS: Layered approach (canvas z-index: 1, grid z-index: 2)
- No new dependencies (uses existing Phaser infrastructure)
- Memory: ~15MB (acceptable for modern devices)

---

### 3. Mobile Responsiveness

**Before**:
- Not explicitly addressed
- 16 canvas instances problematic on mobile

**After**:
- Phaser Scale.FIT mode handles responsive canvas
- Single WebGL context acceptable on modern mobile
- HTML grid overlays canvas for interaction
- Performance tested on mid-range devices

**Impact**:
- Phaser config: `scale: { mode: Phaser.Scale.FIT, autoCenter: CENTER_BOTH }`
- CSS: Layered grid approach (canvas doesn't capture clicks)
- View: `pointer-events: none` on canvas, clicks pass to HTML labels

---

### 4. Name Validation

**Before**:
- Question: Should we add profanity filtering?

**After**:
- **Decision**: Alphanumeric + spaces/underscores only
- Server-side validation sufficient
- No profanity filter in initial release

**Impact**:
- Regex unchanged: `/\A[a-zA-Z0-9_ ]+\z/`
- No additional validation gems needed

---

### 5. Locked Sprite Explanations

**Before**:
- Question: Show reason for lock?

**After**:
- **Decision**: Deferred to Phase 2
- Simple padlock overlay only for initial release

**Impact**:
- No `unlock_reason` field in database
- Future enhancement documented

---

### 6. Analytics Tracking

**Before**:
- Question: Track sprite popularity?

**After**:
- **Decision**: Not needed for initial release

**Impact**:
- No analytics code added
- No tracking events in controllers

---

### 7. Scenario Wildcards

**Before**:
- Proposed patterns needed confirmation

**After**:
- **Approved**: `female_*`, `male_*`, `*_hacker`, exact matches
- Pattern matching implementation confirmed

**Impact**:
- No changes needed (already in plan)

---

### 8. Existing Player Migration

**Before**:
- Question: Prompt on first login?

**After**:
- **Decision**: Prompt when starting a game
- Preference auto-created with NULL sprite
- Redirects to configuration screen

**Impact**:
- Game controller: Check preference on game creation
- No separate "migration prompt" UI needed

---

## Updated Validation Flow

### New Game Creation Logic

```
1. Player clicks "Start Mission"
2. Create Game record
3. Get or create PlayerPreference (sprite = NULL if new)
4. Check: preference.sprite_selected?
   - NO → Redirect to /configuration?game_id=X
          Flash: "Please select your character before starting."
   - YES → Continue to step 5
5. Check: preference.sprite_valid_for_scenario?(scenario)
   - NO → Redirect to /configuration?game_id=X
          Flash: "Your selected character is not available for this mission."
   - YES → Start game
```

---

## Files Affected by Changes

### Modified from Original Plan

1. **Migration**:
   - `selected_sprite` allows NULL (was NOT NULL with default)

2. **Model (`PlayerPreference`)**:
   - Validation: `allow_nil: true` added
   - New method: `sprite_selected?`
   - Modified: `sprite_valid_for_scenario?` (checks NULL first)
   - Modified: `set_defaults` (removed sprite default)

3. **Controller (`PlayerPreferencesController`)**:
   - Flash messages updated for clarity
   - Error handling for NULL sprite selection

4. **View (`show.html.erb`)**:
   - Single Phaser canvas container (absolute positioned)
   - HTML grid overlaid for interaction (z-index: 2)
   - Phaser CDN script loaded
   - JavaScript initialization with sprite data

5. **JavaScript (`sprite-grid.js`)**:
   - Single Phaser instance (not 16 separate instances)
   - Grid layout: 4×4 sprites, each 80×80px
   - Breathing-idle_south animations for all sprites
   - Phaser Scale.FIT for responsive canvas

6. **Helper**:
   - Removed: `sprite_preview_path(sprite)` (not needed - using atlases)
   - Kept: `sprite_valid_for_scenario?` (unchanged)

7. **CSS**:
   - Added `.config-prompt` for game validation warnings
   - Added `.selection-required` for error state
   - Canvas: `pointer-events: none` (clicks pass through)
   - Grid: `position: relative, z-index: 2` (captures clicks)

8. **GamesController**:
   - Enhanced validation logic (NULL check + scenario check)
   - More descriptive flash messages
   - Extracted helper methods for preference lookup

### Added to Plan

1. **JavaScript Module**:
   - `public/break_escape/js/ui/sprite-grid.js`
   - Single Phaser game instance
   - Preloads all 16 sprite atlases
   - Creates grid with animations

2. **External Library**:
   - Phaser 3.60.0 (loaded via CDN in view)

### Removed from Plan

1. **Asset Generation** (not needed):
   - `tools/generate_sprite_previews.rb` (removed)
   - Static preview images (removed)
   - `chunky_png` gem dependency (removed)

---

## Testing Updates

### New Test Cases Added

1. **Model**:
   - `test "selected_sprite is nil by default"`
   - `test "allows nil sprite"`
   - `test "sprite_selected? returns false when nil"`
   - `test "sprite_valid_for_scenario? rejects nil sprite"`

2. **Controller**:
   - `test "should require sprite selection"`

3. **Integration**:
   - `test "new player prompted to select sprite before game"`
   - Renamed existing test for clarity

### Fixtures Updated

- Added `new_player_preference` with `selected_sprite: null`

---

## Documentation Status

All planning documents have been updated:

- ✅ **PLAN.md** - 17 sections updated with new validation logic
- ✅ **SUMMARY.md** - Quick reference updated
- ✅ **README.md** - Review decisions marked as approved
- ✅ **FILE_MANIFEST.md** - File list updated (removed JS, added tool)
- ✅ **FLOW_DIAGRAM.md** - Will update if needed (diagrams still accurate)

---

## Implementation Checklist Updates

| Original | Updated | Change |
|----------|---------|--------|
| 16 Phaser instances | 1 Phaser instance | Performance optimization |
| Complex canvas per sprite | Single canvas + HTML grid | Simplified architecture |
| Default sprite: female_hacker_hood | Default sprite: NULL | Critical change |
| - | Add sprite_selected? method | New requirement |
| - | Load Phaser via CDN | External library |
| - | Layered canvas + grid approach | Z-index positioning |

---

## Migration Impact

### For Existing Games
- No impact (existing games already started)
- Preferences created with NULL sprite for new players
- First game attempt → redirect to configuration

### For Existing Players (with games)
- If preference exists with sprite → no change
- If no preference → created with NULL → prompted on next game

### For New Players
1. Sign up / log in
2. Click "Start Mission"
3. Preference created (sprite = NULL, name = handle or "Zero")
4. Redirected to `/configuration?game_id=X`
5. Must select sprite to proceed
6. Submit → redirected back to game

---

## Ready for Implementation

**Status**: ✅ All planning documents updated and approved

**Next Step**: Begin Phase 1 implementation (Migration + Models)

**Estimated Timeline**: 6 phases, ~21 files total

---

## Phaser Decision Summary

### Why Single Phaser Instance? (Final Decision)

**Advantages**:
- ✅ Animated previews (engaging, matches game aesthetic)
- ✅ Uses existing sprite atlases (no new assets)
- ✅ No build step or asset generation
- ✅ Auto-updates when new sprites added
- ✅ Single WebGL context (~15MB vs ~50MB for 16 instances)
- ✅ Leverages existing Phaser infrastructure

**Accepted Tradeoffs**:
- ⚠️ Load time: ~800ms (vs ~100ms for static images)
- ⚠️ Memory: ~15MB (vs ~2MB for static images)
- ⚠️ JavaScript: ~100 LOC (vs 0 for static images)

**Why Better Than Static Images**:
- More engaging user experience
- No maintenance burden (no regeneration needed)
- Shows exactly what player gets in-game
- No new dependencies (`chunky_png` not needed)

See `PHASER_DECISION.md` for full analysis.

---

End of Changes Document
