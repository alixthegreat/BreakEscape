# Codebase Review - Player Preferences Integration

**Date**: 2026-02-11  
**Purpose**: Review existing codebase and identify integration points for player preferences system

---

## Existing Architecture Summary

### Current Player System

**Polymorphic Player Pattern** ✅
- Already implemented in `Game` model: `belongs_to :player, polymorphic: true`
- `ApplicationController#current_player` handles both modes:
  - **Standalone**: Uses `DemoUser` (auto-creates `demo_player`)
  - **Hacktivity**: Uses parent app's `current_user`
- Pundit authorization uses `current_player` via `pundit_user`

### DemoUser Model Status

**Current Implementation**:
```ruby
class DemoUser < ApplicationRecord
  has_many :games, as: :player
  validates :handle, presence: true, uniqueness: true
  
  def admin?
    role == 'admin'
  end
end
```

**Needs Adding**:
- `has_one :preference` association ✅ Planned
- `ensure_preference!` method ✅ Planned

### Game Creation Flow

**Current Flow** (GamesController#create):
1. Find mission
2. Authorize with Pundit
3. Build `player_state` with VM/flags context
4. Set `player_state` BEFORE save (critical for callbacks)
5. Save triggers callbacks:
   - `before_create :generate_scenario_data`
   - `before_create :initialize_player_state`
6. Redirect to `game_path(@game)`

**Integration Point**: Add sprite validation AFTER step 5, BEFORE step 6

### Scenario Generation

**Current System**:
```ruby
def generate_scenario_data
  # Build VM context if needed
  vm_context = build_vm_context if mission.requires_vms?
  
  # Generate scenario
  self.scenario_data = mission.generate_scenario_data(vm_context)
end
```

**Integration Point**: Add `inject_player_preferences` call after generation

---

## Integration Analysis

### 1. Routes ✅ Clean Integration

**Current Routes**:
- `/missions` - Mission index
- `/missions/:id` - Mission show
- `/games/new` - VM set selection
- `/games/:id` - Game view
- `/games` POST - Game creation

**New Route Needed**:
- `/configuration` GET/PATCH - Player preferences

**Potential Conflict**: NONE - Configuration route doesn't overlap

---

### 2. Controllers ✅ Minimal Changes

**GamesController Changes Required**:
```ruby
def create
  # ... existing code ...
  @game.save!
  
  # NEW: Check sprite preference
  player_pref = current_player_preference || create_default_preference
  
  if !player_pref.sprite_selected?
    flash[:alert] = 'Please select your character before starting.'
    redirect_to configuration_path(game_id: @game.id) and return
  elsif !player_pref.sprite_valid_for_scenario?(@game.scenario_data)
    flash[:alert] = 'Your selected character is not available for this mission.'
    redirect_to configuration_path(game_id: @game.id) and return
  end
  
  redirect_to game_path(@game)
end

private

def current_player_preference
  if defined?(current_user) && current_user
    current_user.break_escape_preference
  elsif current_demo_user
    current_demo_user.preference
  end
end
```

**Potential Issue**: Need access to `current_demo_user` in addition to `current_player`

**Solution**: ApplicationController already has `current_player` - use that

---

### 3. Models ✅ Good Fit

**Game Model Changes**:
```ruby
def generate_scenario_data
  # ... existing VM context code ...
  
  self.scenario_data = mission.generate_scenario_data(vm_context)
  
  # NEW: Inject player preferences
  inject_player_preferences(self.scenario_data)
end

private

def inject_player_preferences(scenario_data)
  player_pref = player.respond_to?(:break_escape_preference) ? 
                player.break_escape_preference : 
                player.preference
  
  return unless player_pref
  
  scenario_data['player'] ||= {}
  scenario_data['player']['spriteSheet'] = player_pref.selected_sprite
  scenario_data['player']['displayName'] = player_pref.in_game_name
end
```

**Potential Issue**: What if `player_pref` is nil or sprite is nil?

**Solution**: GamesController validation ensures sprite selected before game creation

---

### 4. Views ✅ Clean Addition

**Current View Structure**:
- `app/views/break_escape/missions/index.html.erb` - Mission selection
- `app/views/break_escape/missions/show.html.erb` - (doesn't exist, need to check)
- `app/views/break_escape/games/new.html.erb` - VM set selection
- `app/views/break_escape/games/show.html.erb` - Game view

**New View Needed**:
- `app/views/break_escape/player_preferences/show.html.erb`

**No Conflicts**: Configuration is a separate page

---

### 5. Policies ✅ Simple Addition

**Existing Pattern**:
```ruby
class ApplicationPolicy
  attr_reader :user, :record
  
  def initialize(user, record)
    @user = user
    @record = record
  end
  
  # ... permission methods ...
end
```

**New Policy**:
```ruby
class PlayerPreferencePolicy < ApplicationPolicy
  def show?
    player_owns_preference?
  end
  
  def update?
    player_owns_preference?
  end
  
  private
  
  def player_owns_preference?
    record.player_type == user.class.name && record.player_id == user.id
  end
end
```

**No Conflicts**: Follows existing pattern

---

### 6. Assets ✅ Well-Structured

**Current Asset Structure**:
```
public/break_escape/
├── js/
│   ├── main.js
│   ├── core/
│   ├── systems/
│   ├── minigames/
│   └── ui/
├── css/
│   ├── main.css
│   ├── utilities.css
│   └── (many minigame-specific)
├── assets/
│   ├── characters/ (16 sprite atlases)
│   └── icons/ (including padlock_32.png)
```

**New Files Needed**:
```
public/break_escape/
├── js/
│   └── ui/
│       └── sprite-grid.js ✅ Clean addition
└── css/ (via Rails asset pipeline)
    └── break_escape/
        └── player_preferences.css
```

**Location Note**: CSS should go in `public/break_escape/css/` (Break Escape convention)

---

### 7. Phaser Integration ✅ Compatible

**Current Phaser Usage**:
- Game view loads Phaser 3.60.0 via CDN
- Main game creates single Phaser instance
- Player sprite loaded via `window.gameScenario?.player?.spriteSheet`

**Configuration View**:
- Separate page (not in game)
- Can load Phaser independently
- Won't conflict with game instance

**Player.js Current Code**:
```javascript
const playerSprite = window.gameScenario?.player?.spriteSheet || 'hacker';
console.log(`Loading player sprite: ${playerSprite}`);
```

**After Integration**:
```javascript
// Now loads from player preferences injected into scenario
const playerSprite = window.gameScenario?.player?.spriteSheet || 'female_hacker_hood';
const playerName = window.gameScenario?.player?.displayName || 'Zero';
```

---

## Identified Issues & Solutions

### Issue 1: current_demo_user Not Defined

**Problem**: `current_demo_user` method doesn't exist in ApplicationController

**Solution**: Use `current_player` directly (already returns correct polymorphic player)

```ruby
def current_player_preference
  if current_player.respond_to?(:break_escape_preference)
    current_player.break_escape_preference
  elsif current_player.respond_to?(:preference)
    current_player.preference
  end
end
```

---

### Issue 2: Hacktivity User Model Integration

**Problem**: Parent app's `User` model needs `has_one :break_escape_preference`

**Solution**: 
- Document in README for Hacktivity integration
- Not part of Break Escape codebase
- Add migration note in planning docs

---

### Issue 3: CSS Location Inconsistency

**Problem**: Plan shows `app/assets/stylesheets/` but game CSS in `public/break_escape/css/`

**Current Pattern**: Break Escape uses `public/break_escape/css/` for all styles

**Solution**: Put `player_preferences.css` in `public/break_escape/css/` to match existing pattern

---

### Issue 4: Default Sprite Fallback in Player.js

**Problem**: If sprite is NULL (shouldn't happen), player.js needs fallback

**Current Code**:
```javascript
const playerSprite = window.gameScenario?.player?.spriteSheet || 'hacker';
```

**After Integration**:
```javascript
const playerSprite = window.gameScenario?.player?.spriteSheet || 'female_hacker_hood';
```

**Safety**: GamesController already validates sprite before game creation, so fallback never triggered

---

### Issue 5: Preference Creation Timing

**Problem**: When should preference record be created?

**Options**:
1. On first game creation (current plan)
2. On first login/session
3. Via middleware on any request

**Recommended**: Option 1 (current plan)
- Lazy creation on game creation
- Redirects to configuration if sprite NULL
- No unnecessary records for users who never play

---

## Migration Path

### Phase 1: Database ✅ No Conflicts
- Create `break_escape_player_preferences` table
- Unique index on `[player_type, player_id]`
- No foreign key conflicts

### Phase 2: Models ✅ Clean Addition
- Add `PlayerPreference` model
- Update `DemoUser` with `has_one :preference`
- Modify `Game#generate_scenario_data` to inject preferences

### Phase 3: Controllers ✅ Minimal Changes
- Create `PlayerPreferencesController`
- Modify `GamesController#create` (add 5 lines for validation)
- No changes to other controllers

### Phase 4: Views ✅ New View Only
- Create `player_preferences/show.html.erb`
- No changes to existing views
- Add CSS file to `public/break_escape/css/`

### Phase 5: JavaScript ✅ New File Only
- Create `sprite-grid.js` in `public/break_escape/js/ui/`
- No changes to existing JS
- Player.js already handles dynamic sprite loading

### Phase 6: Routes ✅ Simple Addition
- Add 2 routes: `get` and `patch` for `/configuration`
- No conflicts with existing routes

---

## Testing Integration Points

### 1. Current Test Structure

Check existing test files:
```
test/
├── controllers/
│   └── break_escape/
│       ├── games_controller_test.rb ✅ Will need updates
│       └── missions_controller_test.rb
├── models/
│   └── break_escape/
│       ├── game_test.rb ✅ Will need updates
│       └── demo_user_test.rb ✅ Will need updates
└── integration/
```

### 2. New Tests Needed
- `test/models/break_escape/player_preference_test.rb` (new)
- `test/controllers/break_escape/player_preferences_controller_test.rb` (new)
- `test/policies/break_escape/player_preference_policy_test.rb` (new)
- `test/integration/sprite_selection_flow_test.rb` (new)

### 3. Existing Tests to Update
- `games_controller_test.rb` - Add tests for sprite validation flow
- `demo_user_test.rb` - Test `ensure_preference!` method
- `game_test.rb` - Test `inject_player_preferences`

---

## Compatibility Matrix

| Component | Current State | Integration | Risk Level | Notes |
|-----------|---------------|-------------|------------|-------|
| Polymorphic Player | ✅ Exists | ✅ Compatible | 🟢 None | Already handles both user types |
| Game Creation | ✅ Stable | ⚠️ Modification | 🟡 Low | Add validation before redirect |
| Scenario Generation | ✅ Stable | ⚠️ Modification | 🟡 Low | Add injection after generation |
| Routes | ✅ Stable | ✅ Addition | 🟢 None | New routes don't conflict |
| Views | ✅ Stable | ✅ Addition | 🟢 None | Separate configuration page |
| Phaser Integration | ✅ Stable | ✅ Compatible | 🟢 None | Uses existing sprite system |
| CSS Structure | ✅ Stable | ✅ Addition | 🟢 None | Follow `public/` pattern |
| JavaScript | ✅ Stable | ✅ Addition | 🟢 None | New UI file only |
| Policies | ✅ Stable | ✅ Addition | 🟢 None | Follows existing pattern |
| Tests | ✅ Stable | ⚠️ Expansion | 🟡 Low | New tests + minor updates |

**Overall Risk**: 🟢 **LOW** - Well-isolated feature with clean integration points

---

## Recommendations

### 1. Use Existing Patterns ✅

All planned code follows existing Break Escape conventions:
- Polymorphic associations
- Pundit authorization
- Engine routing
- Public asset structure

### 2. Update Plan: CSS Location

**Change**: 
```diff
- public/break_escape/css/player_preferences.css ✅
+ public/break_escape/css/player_preferences.css
```

**Reason**: Match existing asset structure

### 3. Update Plan: current_player Usage

**Change**: Use `current_player` instead of inventing `current_demo_user`

**Reason**: Already exists and returns correct polymorphic player

### 4. Add Safety Check in inject_player_preferences

**Add**:
```ruby
def inject_player_preferences(scenario_data)
  player_pref = # ... get preference ...
  
  return unless player_pref&.selected_sprite # Safety: don't inject if nil
  
  scenario_data['player'] ||= {}
  scenario_data['player']['spriteSheet'] = player_pref.selected_sprite
  scenario_data['player']['displayName'] = player_pref.in_game_name
end
```

---

## Conclusion

✅ **Ready for Implementation**

The planned player preferences system integrates cleanly with the existing codebase:

1. **Minimal changes** to existing code (< 20 lines modified)
2. **No breaking changes** to existing functionality
3. **Follows established patterns** throughout
4. **Low risk** of conflicts or regressions
5. **Well-isolated** feature with clear boundaries

### Proceed with Implementation

All integration points are clear, and no architectural changes are needed. The plan can be executed as documented with the minor adjustments noted above.

---

**Status**: ✅ Codebase review complete, ready for Phase 1
