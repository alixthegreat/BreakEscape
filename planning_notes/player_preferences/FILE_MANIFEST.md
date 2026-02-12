# Player Preferences - File Manifest

Complete list of files to be created or modified during implementation.

## Files to CREATE

### Database

```
db/migrate/YYYYMMDDHHMMSS_create_break_escape_player_preferences.rb
```

### Models

```
app/models/break_escape/player_preference.rb
```

### Controllers

```
app/controllers/break_escape/player_preferences_controller.rb
```

### Policies

```
app/policies/break_escape/player_preference_policy.rb
```

### Views

```
app/views/break_escape/player_preferences/show.html.erb
```

### Helpers

```
app/helpers/break_escape/player_preferences_helper.rb
```

### JavaScript

```
public/break_escape/js/ui/sprite-grid.js
```

### CSS

```
public/break_escape/css/player_preferences.css
```

**Note**: Break Escape uses `public/break_escape/css/` for all styles (not Rails asset pipeline).

### Tests - Models

```
test/models/break_escape/player_preference_test.rb
```

### Tests - Controllers

```
test/controllers/break_escape/player_preferences_controller_test.rb
```

### Tests - Policies

```
test/policies/break_escape/player_preference_policy_test.rb
```

### Tests - Integration

```
test/integration/sprite_selection_flow_test.rb
```

### Fixtures

```
test/fixtures/break_escape/player_preferences.yml
```

### Documentation

```
docs/PLAYER_PREFERENCES.md
```

---

## Files to MODIFY

### Routes

```
config/routes.rb
  + get 'configuration', to: 'player_preferences#show', as: :configuration
  + patch 'configuration', to: 'player_preferences#update'
```

### Models - DemoUser

```
app/models/break_escape/demo_user.rb
  + has_one :preference, as: :player, class_name: 'BreakEscape::PlayerPreference', dependent: :destroy
  + def ensure_preference!
```

### Models - Game

```
app/models/break_escape/game.rb
  + def inject_player_preferences(scenario_data)
  
  Modify:
  - generate_scenario_data (add call to inject_player_preferences)
```

### Controllers - GamesController

```
app/controllers/break_escape/games_controller.rb
  
  Modify:
  - create action (add sprite validation before starting game)
```

### Documentation

```
README.md
  + Section on Player Configuration

.github/copilot-instructions.md
  + Add player preferences to architecture section

CHANGELOG.md
  + Entry for player preferences feature
```

---

## File Count Summary

| Category          | Create | Modify | Total |
|-------------------|--------|--------|-------|
| Database          | 1      | 0      | 1     |
| Models            | 1      | 2      | 3     |
| Controllers       | 1      | 1      | 2     |
| Policies          | 1      | 0      | 1     |
| Views             | 1      | 0      | 1     |
| Helpers           | 1      | 0      | 1     |
| JavaScript        | 1      | 0      | 1     |
| CSS               | 1      | 0      | 1     |
| Routes            | 0      | 1      | 1     |
| Tests             | 4      | 0      | 4     |
| Fixtures          | 1      | 0      | 1     |
| Documentation     | 1      | 3      | 4     |
| **TOTAL**         | **14** | **7**  | **21**|

---

## Implementation Phases

### Phase 1: Core Backend (4 files)
1. Migration
2. PlayerPreference model
3. Update DemoUser model
4. Routes

**Checkpoint**: Run migration, verify model can be created

### Phase 2: Controller & Policy (3 files)
1. PlayerPreferencesController
2. PlayerPreferencePolicy
3. Helper

**Checkpoint**: Routes accessible, authorization works

### Phase 3: Frontend (3 files)
1. View (show.html.erb)
2. JavaScript (sprite-grid.js)
3. CSS (player_preferences.css)

**Checkpoint**: Configuration page renders with animated Phaser sprites

### Phase 4: Game Integration (2 files)
1. Update Game model (inject_player_preferences)
2. Update GamesController (validation flow)

**Checkpoint**: Preferences inject into game, validation redirects work

### Phase 5: Testing (5 files)
1. Model tests
2. Controller tests
3. Policy tests
4. Integration tests
5. Fixtures

**Checkpoint**: All tests pass

### Phase 6: Documentation (4 files)
1. README.md
2. copilot-instructions.md
3. CHANGELOG.md
4. PLAYER_PREFERENCES.md

**Checkpoint**: Documentation complete, feature ready for release

---

## Dependencies

### New Gems Required
- None (uses existing Rails/Phaser stack)

### Existing Assets Used
- `/break_escape/assets/characters/*.png` (16 sprite sheets)
- `/break_escape/assets/characters/*.json` (16 sprite atlases)
- `/break_escape/assets/icons/padlock_32.png` (lock overlay)

### External Libraries
- Phaser 3.60.0 (loaded via CDN in configuration view)

### External Libraries Used
- Phaser.js (already loaded in game)
- Rails 7 (ActiveRecord, ActionView, Pundit)

---

## Hacktivity Integration Notes

When mounted in Hacktivity, one additional file modification is required:

### Parent App: Hacktivity

```
app/models/user.rb
  + has_one :break_escape_preference, 
      as: :player, 
      class_name: 'BreakEscape::PlayerPreference', 
      dependent: :destroy
  + def ensure_break_escape_preference!
```

This is NOT part of the Break Escape codebase but should be documented for integration.

---

## Git Workflow

### Branch Name
```
feature/player-preferences-system
```

### Commit Strategy

1. **Migration & Models**:
   ```
   feat: Add PlayerPreference model with polymorphic player association
   ```

2. **Controller & Policy**:
   ```
   feat: Add PlayerPreferences controller with sprite selection UI
   ```

3. **Frontend**:
   ```
   feat: Add sprite preview grid with Phaser animations
   ```

4. **Game Integration**:
   ```
   feat: Integrate player preferences into game scenario data
   ```

5. **Validation Flow**:
   ```
   feat: Add scenario-based sprite validation before game start
   ```

6. **Tests**:
   ```
   test: Add comprehensive test coverage for player preferences
   ```

7. **Documentation**:
   ```
   docs: Document player preferences system
   ```

### Pull Request Title
```
Add Player Preferences System (Sprite & Name Customization)
```

---

End of File Manifest
