# VM and CTF Flag Integration - Plan Review

**Reviewer**: AI Review  
**Date**: November 27, 2025  
**Document Reviewed**: `planning_notes/vms_and_flags/IMPLEMENTATION_PLAN.md`

---

## Executive Summary

The implementation plan is comprehensive and follows existing BreakEscape patterns well. However, there are several **critical issues** and **medium-priority issues** that need to be addressed before implementation.

**Critical Issues**: 4  
**Medium Issues**: 6  
**Minor Issues**: 5  

---

## Critical Issues

### 1. ❌ `secgen_scenario` Migration Already Exists

**Problem**: The plan proposes creating a migration to add `secgen_scenario` to `break_escape_missions`, but this migration already exists:

```
db/migrate/20251125000001_add_metadata_to_break_escape_missions.rb
```

Which adds:
- `secgen_scenario` (string)
- `collection` (string, default: 'default')

**Impact**: Running the proposed migration will fail or duplicate columns.

**Fix**: Remove migration task 1.1 from the checklist. The column already exists and is handled in `db/seeds.rb`.

---

### 2. ❌ `Game::DEFAULT_PLAYER_STATE` Does Not Exist

**Problem**: The plan references `Game::DEFAULT_PLAYER_STATE.dup` in the `create_game` controller action, but the Game model uses an `initialize_player_state` callback method instead of a constant.

Current pattern in `app/models/break_escape/game.rb`:
```ruby
def initialize_player_state
  self.player_state = {} unless self.player_state.is_a?(Hash)
  self.player_state['currentRoom'] ||= scenario_data['startRoom']
  self.player_state['unlockedRooms'] ||= [scenario_data['startRoom']]
  # ... etc
end
```

**Impact**: Code will raise `NameError: uninitialized constant`.

**Fix**: Either:
- A) Define a `DEFAULT_PLAYER_STATE` constant and use it
- B) Pass VM context to the Game.create! call and let `initialize_player_state` callback handle it
- C) Use a service object pattern to build the initial state

Recommended: Option B - pass params to Game.create! and let the existing `generate_scenario_data` callback use them.

---

### 3. ❌ Incorrect Routing Structure

**Problem**: The plan proposes routes that don't match the existing `config/routes.rb` structure:

**Proposed (incorrect)**:
```ruby
namespace :break_escape, path: 'break_escape' do
  resources :missions do
    member do
      post :create_game    # Creates game from mission
    end
  end
end
```

**Current structure**:
```ruby
BreakEscape::Engine.routes.draw do
  resources :missions, only: [:index, :show]
  resources :games, only: [:show, :create] do
    # ...
  end
end
```

The engine already has a `games#create` action. The `create_game` should be handled there, not in missions controller.

**Impact**: Route conflicts, unexpected behavior, inconsistent API design.

**Fix**: Use the existing `games#create` action pattern. Pass `mission_id` and `vm_set_id` as parameters. The routes already support `resources :games, only: [:show, :create]`.

---

### 4. ❌ ERB Template Example Has Invalid JSON Syntax

**Problem**: The ERB template example produces invalid JSON due to trailing commas when VM is nil:

```erb
<% if kali_vm %>
"vm_title": "<%= kali_vm[:title] %>",
"vm_set_id": <%= kali_vm[:vm_set_id] %>,
"vm_id": <%= kali_vm[:id] %>,
<% end %>
"observations": "...",
```

When `kali_vm` is nil, this produces:
```json
"observations": "...",
```

But when `kali_vm` exists:
```json
"vm_title": "kali_attack",
"vm_set_id": 123,
"vm_id": 456,
"observations": "...",
```

The trailing comma after `vm_id` is valid, but if the conditional block is NOT the last field before a required field, there's no issue. However, the ERB pattern could easily lead to comma errors.

**Impact**: JSON parse errors when scenario is generated.

**Fix**: Use a safer ERB pattern that handles commas properly:

```erb
"vm_title": <%= kali_vm ? "\"#{kali_vm[:title]}\"" : 'null' %>,
"vm_set_id": <%= kali_vm&.dig(:vm_set_id) || 'null' %>,
"vm_id": <%= kali_vm&.dig(:id) || 'null' %>,
```

Or use `to_json` helper for safe interpolation.

---

## Medium Issues

### 5. ⚠️ `valid_vm_sets_for_user` Query is Invalid

**Problem**: The proposed query uses incorrect ActiveRecord syntax:

```ruby
::VmSet.where(
  sec_gen_batch: { scenario: secgen_scenario },
  user: user,
  relinquished: false
).includes(:vms)
```

The `sec_gen_batch: { scenario: secgen_scenario }` syntax requires a `joins` to work:

**Fix**:
```ruby
::VmSet.joins(:sec_gen_batch)
       .where(sec_gen_batches: { scenario: secgen_scenario })
       .where(user: user, relinquished: false)
       .includes(:vms)
```

---

### 6. ⚠️ Missing `hacktivityMode` Client Config

**Problem**: The client-side code checks `window.breakEscapeConfig?.hacktivityMode` but the plan doesn't document how this is set.

```javascript
const mode = window.breakEscapeConfig?.hacktivityMode ? 'hacktivity' : 'standalone';
```

**Fix**: Document that `window.breakEscapeConfig` should include:
- `hacktivityMode: true/false` - set by the game view based on Rails environment
- Include in the scenario bootstrap or game show view.

---

### 7. ⚠️ `pcMode` Doesn't Match Existing Object Type Pattern

**Problem**: The plan introduces `pcMode` as a new field, but existing objects use `type` to determine behavior. The `handleObjectInteraction` function dispatches based on `scenarioData.type`, not a separate mode field.

**Current pattern**:
```javascript
if (sprite.scenarioData.type === "workstation") { ... }
if (sprite.scenarioData.type === "notepad") { ... }
if (sprite.scenarioData.type === "bluetooth_scanner") { ... }
```

**Proposed pattern** (inconsistent):
```javascript
if (object.scenarioData.type?.startsWith('pc-') && object.scenarioData.pcMode) { ... }
```

**Fix**: Either:
- A) Use `type: "vm-launcher"` and `type: "flag-station"` directly
- B) Document that `pcMode` is used for PC-specific subtypes and ensure backwards compatibility
- C) Use a unified pattern like `interactionMode` for all objects

Recommended: Option A - use `type` consistently.

---

### 8. ⚠️ Flag Validation Doesn't Account for Multiple Flag Stations

**Problem**: The `extract_valid_flags_from_scenario` method extracts ALL flags from ALL flag stations. This means a flag from one VM can be submitted at a different VM's flag station.

**Fix**: Associate flags with specific flag stations and validate that the submitted flag matches the station it's being submitted at. Pass `flag_station_id` in the request.

---

### 9. ⚠️ Missing Event Emission After Flag Reward Door Unlock

**Problem**: When `process_door_unlock_reward` unlocks a door, it should emit a `door_unlocked` event so door sprites can update visually. The plan mentions emitting `door_unlocked_by_flag` on the client but the server response doesn't clearly indicate this should happen.

**Fix**: Ensure the server response for `unlock_door` rewards includes enough data for the client to emit the appropriate event and update sprites.

---

### 10. ⚠️ `submit_to_hacktivity` Should Use Existing API

**Problem**: The plan directly updates Hacktivity's Flag model:

```ruby
flag.update(solved: true, solved_date: Time.current)
```

But the user requirement says to use the existing Hacktivity flag submission API:
> B) Use the existing POST /vms/auto_flag_submit endpoint (JSON API)

**Fix**: Use HTTP request to Hacktivity's endpoint instead of direct model manipulation:

```ruby
def submit_to_hacktivity(flag_key)
  # POST to /vms/auto_flag_submit
  # This ensures all Hacktivity's flag submission logic runs (scoring, etc.)
end
```

Or at minimum, document why direct model access is chosen over the API.

---

## Minor Issues

### 11. 📝 Missing CSS Import

The plan creates new CSS files but doesn't show where they're imported. Ensure:
- `vm-launcher.css` and `flag-station.css` are added to the main CSS bundle or game HTML.

---

### 12. 📝 `handleFlagStation` Fetches Full Scenario

The proposed `handleFlagStation` function fetches the entire scenario just to get `submittedFlags`:

```javascript
const response = await fetch(`/break_escape/games/${gameId}/scenario`);
```

This is inefficient. The scenario is already loaded at game start.

**Fix**: Read from `window.gameState.submittedFlags` or add a dedicated lightweight endpoint.

---

### 13. 📝 Rewards Array Index Matching is Fragile

The plan matches flags to rewards by array index:

```ruby
flag_index = obj['flags'].index(flag_key)
if obj['flagRewards'] && obj['flagRewards'][flag_index]
```

This is fragile if flags/rewards arrays get out of sync.

**Fix**: Consider using a hash structure:
```json
"flagRewards": {
  "flag{first}": { "type": "unlock_door", "room_id": "vault" },
  "flag{second}": { "type": "give_item", "item_name": "keycard" }
}
```

---

### 14. 📝 Test Files Not Listed

The plan mentions creating HTML test files but doesn't specify filenames:
> 3.7 Create HTML test files for minigames

**Fix**: Specify: `test-vm-launcher-minigame.html`, `test-flag-station-minigame.html`

---

### 15. 📝 `expectedFlags` Not Filtered by Flag Station

The flag station minigame gets ALL expected flags from the scenario. If there are multiple flag stations for different VMs, each station would show all flags.

**Fix**: Filter `expectedFlags` to only show flags associated with THIS flag station.

---

## Recommendations

### Architecture Recommendations

1. **Use service objects** for complex operations like `GameCreationService` that handles VM context building and game initialization.

2. **Add `vm_set_id` to Game model** as a proper column with foreign key, rather than burying it in `player_state` JSON. This enables:
   - Database-level constraints
   - Easier querying
   - Index on vm_set_id

3. **Consider ActionCable** for real-time flag sync between BreakEscape and Hacktivity (future enhancement, not blocking).

### Code Organization Recommendations

1. Keep flag-related methods in a concern: `app/models/concerns/break_escape/flaggable.rb`

2. Keep VM-related methods in a concern: `app/models/concerns/break_escape/vm_context.rb`

3. Create `app/services/break_escape/flag_submission_service.rb` for the complex flag submission + rewards logic.

---

## Summary of Required Plan Updates

| Issue | Severity | Action |
|-------|----------|--------|
| 1. Duplicate migration | Critical | Remove migration 1.1 |
| 2. DEFAULT_PLAYER_STATE | Critical | Use existing callback pattern |
| 3. Incorrect routes | Critical | Use games#create instead |
| 4. Invalid ERB JSON | Critical | Fix ERB patterns |
| 5. Invalid AR query | Medium | Fix joins syntax |
| 6. Missing client config | Medium | Document hacktivityMode |
| 7. pcMode inconsistency | Medium | Use type consistently |
| 8. Multi-station flags | Medium | Add flag_station_id validation |
| 9. Missing event emission | Medium | Ensure door events emitted |
| 10. Direct model access | Medium | Use Hacktivity API |
| 11-15. Minor issues | Minor | Various fixes |

---

## Conclusion

The plan is fundamentally sound but needs the critical issues resolved before implementation. The main concerns are:
1. Duplicate migration
2. Non-existent constant reference
3. Route structure mismatch
4. Potential JSON parse errors in ERB

Once these are fixed, the implementation should proceed smoothly as it follows existing BreakEscape patterns.
