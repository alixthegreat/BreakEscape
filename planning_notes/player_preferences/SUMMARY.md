# Player Preferences - Quick Summary

## What We're Building

A player configuration system allowing customization of:
- **In-game name** (seeded from Hacktivity `user.handle`, defaults to "Zero")
- **Character sprite** (16 available, validated per scenario)

## Key Features

### 1. Persistent Preferences Table
```
break_escape_player_preferences:
  - player_id/player_type (polymorphic)
  - selected_sprite (NULL until player chooses)
  - in_game_name (default: 'Zero')
```

### 2. Scenario-Level Sprite Validation
```json
{
  "validSprites": ["female_*", "male_spy"]
}
```

**Wildcard Support:**
- `"*"` - all sprites
- `"female_*"` - all female sprites
- `"*_hacker"` - all hacker sprites (any gender)
- `"female_hacker_hood"` - exact match

### 3. Validation Flow
1. Player creates new game
2. System checks:
   - Does player have a sprite selected? (not NULL)
   - Does sprite match scenario's `validSprites` patterns?
3. **If no sprite OR invalid**: Redirect to `/configuration?game_id=123`
4. **If valid**: Start game immediately

### 4. Configuration UI
- Grid of 16 animated sprite previews (single Phaser instance, breathing-idle animations)
- Invalid sprites shown greyed out with padlock overlay
- Name input field (1-20 chars, alphanumeric + spaces/underscores only)
- Responsive with Phaser Scale.FIT mode

## Files to Create

### Backend
- Migration: `CreateBreakEscapePlayerPreferences`
- Model: `app/models/break_escape/player_preference.rb`
- Controller: `app/controllers/break_escape/player_preferences_controller.rb`
- Policy: `app/policies/break_escape/player_preference_policy.rb`
- Helper: `app/helpers/break_escape/player_preferences_helper.rb`

### Frontend
- View: `app/views/break_escape/player_preferences/show.html.erb`
- JavaScript: `public/break_escape/js/ui/sprite-grid.js` (single Phaser instance)
- CSS: `public/break_escape/css/player_preferences.css`

### Tests
- Model: `test/models/break_escape/player_preference_test.rb`
- Controller: `test/controllers/break_escape/player_preferences_controller_test.rb`
- Policy: `test/policies/break_escape/player_preference_policy_test.rb`
- Integration: `test/integration/sprite_selection_flow_test.rb`
- Fixtures: `test/fixtures/break_escape/player_preferences.yml`

## Model Updates

### `BreakEscape::DemoUser`
```ruby
has_one :preference, as: :player, class_name: 'BreakEscape::PlayerPreference'
```

### `BreakEscape::Game`
```ruby
def inject_player_preferences(scenario_data)
  scenario_data['player']['spriteSheet'] = player_pref.selected_sprite
  scenario_data['player']['displayName'] = player_pref.in_game_name
end
```

### Hacktivity `User` (when mounted)
```ruby
has_one :break_escape_preference, as: :player, class_name: 'BreakEscape::PlayerPreference'
```

## Routes

```ruby
get 'configuration', to: 'player_preferences#show'
patch 'configuration', to: 'player_preferences#update'
```

## Implementation Order

1. Migration + Model
2. Update associations (DemoUser)
3. Controller + Policy
4. Routes
5. Views + Assets (JS/CSS)
6. Game integration (inject preferences)
7. GamesController validation flow
8. Tests

## Testing Focus

- ✅ Sprite wildcard matching (`female_*`, `*_hacker`)
- ✅ Default name seeding from `user.handle`
- ✅ NULL sprite handling (must choose before first game)
- ✅ Validation flow (redirect when NULL or invalid)
- ✅ Policy authorization (own preference only)
- ✅ Grid UI with padlock overlay
- ✅ Phaser sprite rendering (animations work correctly)

## Review Decisions (APPROVED)

1. ✅ Default sprite: NULL - player MUST choose before first game
2. ✅ Name validation: Alphanumeric only (server-side)
3. ✅ Wildcards: `female_*`, `male_*`, `*_hacker` approved
4. ✅ Preview rendering: Single Phaser instance with animated sprites
5. ✅ Animation: `breathing-idle_south` looping
6. ⏸️ Locked reasons: Deferred to Phase 2
7. ❌ Analytics: Not needed

---

See `PLAN.md` for full details.
