# VM and CTF Flag Integration - Plan Review 2

**Reviewer**: AI Review  
**Date**: November 27, 2025  
**Document Reviewed**: `planning_notes/vms_and_flags/IMPLEMENTATION_PLAN.md` (post-Review 1)

---

## Executive Summary

The updated implementation plan addresses all critical issues from Review 1. The plan is now technically accurate and ready for implementation with a few remaining issues.

**Critical Issues**: 0 (all resolved from Review 1)  
**Medium Issues**: 3  
**Minor Issues**: 6  

---

## Issues Fixed Since Review 1 ✓

1. ✓ Duplicate `secgen_scenario` migration removed
2. ✓ Routes structure corrected to use `BreakEscape::Engine.routes.draw`
3. ✓ `Game::DEFAULT_PLAYER_STATE` reference removed, uses `initialize_player_state` callback
4. ✓ ERB patterns updated with null-safety
5. ✓ ActiveRecord query corrected to use `joins`
6. ✓ Changed `pcMode` to use `type` property directly
7. ✓ Added `window.breakEscapeConfig` documentation

---

## Medium Issues

### 1. ⚠️ `window.breakEscapeConfig` Already Exists - Extend, Don't Replace

**Problem**: The plan documents adding `window.breakEscapeConfig` but it already exists in `app/views/break_escape/games/show.html.erb` (lines 113-118):

```erb
window.breakEscapeConfig = {
  gameId: <%= @game.id %>,
  apiBasePath: '<%= game_path(@game) %>',
  assetsPath: '/break_escape/assets',
  csrfToken: '<%= form_authenticity_token %>'
};
```

The plan's suggested config is a partial replacement:
```javascript
window.breakEscapeConfig = {
  gameId: <%= @game.id %>,
  hacktivityMode: <%= BreakEscape::Mission.hacktivity_mode? %>,
  vmSetId: <%= @game.player_state['vm_set_id'] || 'null' %>,
  playerHandle: "..."
};
```

**Impact**: Missing `apiBasePath`, `assetsPath`, and `csrfToken` will break existing functionality.

**Fix**: Document that the config should be EXTENDED, not replaced:
```erb
window.breakEscapeConfig = {
  gameId: <%= @game.id %>,
  apiBasePath: '<%= game_path(@game) %>',
  assetsPath: '/break_escape/assets',
  csrfToken: '<%= form_authenticity_token %>',
  // NEW fields for VM/flag integration:
  hacktivityMode: <%= BreakEscape::Mission.hacktivity_mode? %>,
  vmSetId: <%= @game.player_state['vm_set_id'] || 'null' %>
};
```

---

### 2. ⚠️ `Hacktivity::FlagSubmissionService` May Not Exist

**Problem**: The plan assumes a `Hacktivity::FlagSubmissionService` class exists:

```ruby
Hacktivity::FlagSubmissionService.new(
  flag: flag,
  user: player
).submit!
```

This service class likely doesn't exist in Hacktivity - the user mentioned using the `auto_flag_submit` API endpoint.

**Impact**: Code will fail with `NameError: uninitialized constant Hacktivity::FlagSubmissionService`.

**Fix**: Use HTTP request to the auto_flag_submit endpoint instead:

```ruby
def submit_to_hacktivity(flag_key)
  return unless defined?(::VmSet) && player_state['vm_set_id'].present?
  
  vm_set = ::VmSet.find_by(id: player_state['vm_set_id'])
  return unless vm_set
  
  # Find the flag in the vm_set
  vm_set.vms.each do |vm|
    flag = vm.flags.find_by(flag_key: flag_key)
    next unless flag
    
    # Use Hacktivity's auto_flag_submit API endpoint
    # This handles scoring, validation, and all flag submission logic
    begin
      response = Net::HTTP.post(
        URI('/vms/auto_flag_submit'),
        { flag_key: flag_key, vm_id: vm.id }.to_json,
        'Content-Type' => 'application/json'
      )
      
      if response.code == '200'
        Rails.logger.info "[BreakEscape] Submitted flag #{flag_key} to Hacktivity API"
      else
        Rails.logger.warn "[BreakEscape] Hacktivity flag submission returned #{response.code}"
      end
    rescue => e
      Rails.logger.error "[BreakEscape] Failed to submit flag to Hacktivity: #{e.message}"
    end
    
    return # Only submit once
  end
end
```

**OR** if direct model access is preferred (simpler, but bypasses Hacktivity logic):
```ruby
# Simple approach - just mark flag as solved
flag.update!(solved: true, solved_date: Time.current) if flag.respond_to?(:solved)
```

---

### 3. ⚠️ `MissionsController#show` Creates Game with `find_or_create_by!`

**Problem**: The current `MissionsController#show` action uses `find_or_create_by!`:

```ruby
@game = Game.find_or_create_by!(
  player: current_player,
  mission: @mission
)
```

The plan proposes allowing multiple games per mission (for different VM sets), but this code will always return the first existing game, never creating a new one with a different VM set.

**Impact**: Users won't be able to create multiple games per mission with different VM sets.

**Fix**: The plan needs to address how game creation flow changes:

**Option A** (Plan's implied approach): Remove auto-creation from `show`, require explicit `games#create` call
```ruby
# MissionsController#show - don't auto-create
def show
  @mission = Mission.find(params[:id])
  authorize @mission if defined?(Pundit)
  # Don't create game here - redirect to game selection or creation
  redirect_to break_escape.games_path(mission_id: @mission.id)
end
```

**Option B** (Backward compatible): Keep auto-creation for missions without VMs, require selection for VM missions
```ruby
def show
  @mission = Mission.find(params[:id])
  authorize @mission if defined?(Pundit)
  
  if @mission.requires_vms?
    # Redirect to game selection/creation page
    redirect_to new_game_path(mission_id: @mission.id)
  else
    # Legacy behavior for non-VM missions
    @game = Game.find_or_create_by!(player: current_player, mission: @mission)
    redirect_to game_path(@game)
  end
end
```

---

## Minor Issues

### 4. 📝 Routes Already Correct - No Change Needed

The routes.rb shown in the plan matches the existing structure except for the `post :flags` addition. The plan should clarify this is the ONLY change needed:

```ruby
# ONLY ADD THIS LINE:
post :flags          # NEW: Submit flag endpoint
```

---

### 5. 📝 `gameState.submittedFlags` Not Set on Game Load

**Problem**: The plan's `handleFlagStation` reads from `window.gameState?.submittedFlags`:

```javascript
const submittedFlags = window.gameState?.submittedFlags || [];
```

But the plan also says the scenario endpoint should return `submittedFlags`. If `gameState` is populated from the scenario response, this should work. However:

1. The plan doesn't show where `window.gameState.submittedFlags` is populated from the scenario response
2. The `main.js` game initialization would need to copy this from scenario to gameState

**Fix**: Add note that `main.js` should populate `window.gameState.submittedFlags` from `scenario.submittedFlags` after loading.

---

### 6. 📝 Missing CSS Imports in show.html.erb

The plan creates CSS files:
- `public/break_escape/css/minigames/vm-launcher.css`
- `public/break_escape/css/minigames/flag-station.css`

But doesn't document adding the link tags to `show.html.erb`.

**Fix**: Add to checklist:
```erb
<link rel="stylesheet" href="/break_escape/css/minigames/vm-launcher.css">
<link rel="stylesheet" href="/break_escape/css/minigames/flag-station.css">
```

---

### 7. 📝 `startFlagStationMinigame` Signature Mismatch

**Problem**: The function is defined with 2 parameters:
```javascript
export function startFlagStationMinigame(flagStation, submittedFlags = []) {
```

But called with 3 parameters in `handleFlagStation`:
```javascript
window.startFlagStationMinigame({
    ...pcObject.scenarioData,
    id: flagStationId
}, submittedFlags, expectedFlags);  // <-- 3 params
```

**Impact**: The third parameter `expectedFlags` is passed but ignored.

**Fix**: Either:
- A) Remove third param from call site (flags are already in flagStation.flags)
- B) Update function signature to accept third param

Since `flagStation.flags` already contains expected flags, the call should be:
```javascript
window.startFlagStationMinigame({
    ...pcObject.scenarioData,
    id: flagStationId
}, submittedFlags);
```

---

### 8. 📝 Missing `current_user` vs `current_player` Clarification

**Problem**: The plan uses `current_player` but refers to `current_user` in some places for Hacktivity integration:

```ruby
initial_player_state['vm_set_id'] = vm_set.id
# ...later...
user: player # or current_user via controller context
```

In BreakEscape standalone mode, `current_player` returns a `DemoUser`. In Hacktivity mode, `current_user` (from Devise) is the actual user.

**Fix**: Document that VM set queries should use `current_user` when available:
```ruby
def valid_vm_sets_for_user(user)
  # user should be current_user from Devise in Hacktivity mode
  # In standalone mode, this returns empty array (no VmSet model)
end
```

---

### 9. 📝 Minigame CSS Uses `border-radius: 0` But This Is Already Default

The CSS styling notes say to use `border-radius: 0` for pixel-art consistency, but the CSS examples already show this. Not an issue, just redundant documentation.

---

## Verification Checklist

Items verified as correct in the updated plan:

| Item | Status | Notes |
|------|--------|-------|
| Migration for secgen_scenario | ✓ Correct | Already exists, marked as complete |
| Routes structure | ✓ Correct | Uses Engine.routes.draw |
| initialize_player_state pattern | ✓ Correct | Extends existing callback |
| Type property usage | ✓ Correct | Uses `type: "vm-launcher"` |
| ERB null-safety | ✓ Correct | Uses `&.`, `dig`, `|| 'null'` |
| ActiveRecord joins query | ✓ Correct | Uses proper joins syntax |
| Controller action pattern | ✓ Correct | Uses games#create |

---

## Recommendations

### 1. Add Integration Test for Flag Submission Flow

The testing plan covers unit tests but should include a full integration test:
1. Create mission with `secgen_scenario`
2. Create VM set with flags
3. Create game with `vm_set_id`
4. Submit flag via endpoint
5. Verify flag in `submitted_flags`
6. Verify reward processed
7. Verify Hacktivity flag marked solved

### 2. Consider Flag Validation Edge Cases

- What if flag is submitted but Hacktivity API is down?
- What if flag is valid in BreakEscape but not found in Hacktivity?
- Should there be a retry mechanism?

### 3. Document Player Handle Source

The plan mentions `playerHandle` in config but doesn't specify where it comes from for different player types (DemoUser vs Hacktivity User).

---

## Summary of Required Plan Updates

| Issue | Severity | Action |
|-------|----------|--------|
| 1. breakEscapeConfig extension | Medium | Update to show extending, not replacing |
| 2. FlagSubmissionService | Medium | Change to HTTP request or direct model |
| 3. MissionsController#show | Medium | Document how game creation flow changes |
| 4. Routes clarification | Minor | Clarify only `post :flags` is new |
| 5. gameState.submittedFlags | Minor | Add note about population |
| 6. CSS imports | Minor | Add to checklist |
| 7. Function signature | Minor | Fix parameter mismatch |
| 8. current_user clarification | Minor | Document which user to use |

---

## Conclusion

The plan is significantly improved from Review 1. All critical issues have been resolved. The remaining medium issues are around integration details that should be clarified before implementation begins. The plan is **ready for implementation** with the above fixes applied.

**Overall Rating**: Ready for implementation (with minor corrections)
