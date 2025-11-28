# VM and CTF Flag Integration - Plan Review 3

**Reviewer**: AI Review  
**Date**: November 27, 2025  
**Document Reviewed**: `planning_notes/vms_and_flags/IMPLEMENTATION_PLAN.md` (post-Review 1 & 2)

---

## Executive Summary

This review validates the solutions implemented after Reviews 1 and 2. The callback timing approach is sound, but there's one remaining critical issue: the `games#create` action doesn't actually exist in the codebase, despite the routes declaring it. Additionally, there are several assumptions that need validation.

**Critical Issues**: 1  
**Medium Issues**: 2  
**Minor Issues**: 3  

---

## Issues Fixed Since Previous Reviews ✓

### From Review 1
1. ✓ Duplicate `secgen_scenario` migration removed
2. ✓ Routes structure corrected to use `BreakEscape::Engine.routes.draw`
3. ✓ `Game::DEFAULT_PLAYER_STATE` reference removed
4. ✓ ERB patterns updated with null-safety
5. ✓ ActiveRecord query corrected to use `joins`

### From Review 2
1. ✓ `window.breakEscapeConfig` extension documented (not replacement)
2. ✓ Hacktivity flag submission approach clarified
3. ✓ Function signature mismatch fixed
4. ✓ Routes clarified - only `post :flags` needed

---

## Critical Issues

### 1. ❌ `games#create` Action Does Not Exist

**Problem**: The plan assumes a `games#create` action exists that can be extended:

```ruby
# Plan assumes this exists:
def create
  @mission = Mission.find(params[:mission_id])
  # ...
end
```

However, searching the codebase shows:
- `config/routes.rb` declares `resources :games, only: [:show, :create]`
- `app/controllers/break_escape/games_controller.rb` does NOT have a `create` method
- Games are actually created in `MissionsController#show` via `find_or_create_by!`

```ruby
# MissionsController#show (actual code)
def show
  @mission = Mission.find(params[:id])
  authorize @mission if defined?(Pundit)

  @game = Game.find_or_create_by!(
    player: current_player,
    mission: @mission
  )

  redirect_to game_path(@game)
end
```

**Impact**: The plan's `games#create` implementation has nowhere to go. The VM context won't be passed during game creation.

**Callback Timing Analysis**:
The plan proposes:
1. Set `@game.player_state = initial_player_state` (with `vm_set_id`)
2. Call `@game.save!`
3. `before_create :generate_scenario_data_with_context` reads `player_state['vm_set_id']`
4. `before_create :initialize_player_state` adds defaults

This timing IS correct - attributes set before `save!` are available to `before_create` callbacks. **The approach is sound**, but needs an actual controller action to implement it.

**Fix Options**:

**Option A (Recommended)**: Implement the missing `games#create` action

```ruby
# app/controllers/break_escape/games_controller.rb
def create
  @mission = Mission.find(params[:mission_id])
  authorize @mission if defined?(Pundit)
  
  initial_player_state = {}
  
  if params[:vm_set_id].present? && defined?(::VmSet)
    vm_set = ::VmSet.find(params[:vm_set_id])
    initial_player_state['vm_set_id'] = vm_set.id
  end
  
  if params[:standalone_flags].present?
    initial_player_state['standalone_flags'] = Array(params[:standalone_flags])
  end
  
  @game = Game.new(
    player: current_player,
    mission: @mission
  )
  @game.player_state = initial_player_state
  @game.save!
  
  redirect_to game_path(@game)
end
```

**Option B**: Modify `MissionsController#show` to accept params

```ruby
# MissionsController#show
def show
  @mission = Mission.find(params[:id])
  authorize @mission if defined?(Pundit)
  
  initial_player_state = {}
  initial_player_state['vm_set_id'] = params[:vm_set_id] if params[:vm_set_id].present?
  
  # Can't use find_or_create_by! with pre-set player_state
  @game = Game.find_by(player: current_player, mission: @mission)
  
  if @game.nil?
    @game = Game.new(player: current_player, mission: @mission)
    @game.player_state = initial_player_state
    @game.save!
  end
  
  redirect_to game_path(@game)
end
```

**Option C**: Create a new action specifically for VM games

```ruby
# MissionsController
def create_vm_game
  @mission = Mission.find(params[:id])
  # ...
end
```

**Recommendation**: Use Option A. It aligns with the existing routes (`resources :games, only: [:show, :create]`) and provides a clear separation between viewing missions and creating games.

---

## Medium Issues

### 2. ⚠️ Unique Index Removal Timing

**Problem**: The plan removes the unique index on `[player_type, player_id, mission_id]`:

```ruby
remove_index :break_escape_games,
             name: 'index_games_on_player_and_mission',
             if_exists: true
```

The current `MissionsController#show` uses `find_or_create_by!`. If a user visits a mission page:
1. Before migration: One game per player+mission (enforced by unique index)
2. After migration: Still one game (due to `find_or_create_by!` behavior)

But if `games#create` is called with different `vm_set_id`:
- Before migration: Database error (unique constraint violation)
- After migration: New game created successfully

**Risk**: If migration runs but controller changes aren't deployed simultaneously, existing behavior changes unexpectedly.

**Fix**: Document deployment order:
1. Deploy controller changes (games#create action) as disabled/hidden
2. Run migration to remove unique index
3. Enable/expose the new functionality

---

### 3. ⚠️ `MissionsController#show` Still Uses `find_or_create_by!`

**Problem**: Even after implementing `games#create`, `MissionsController#show` still auto-creates games:

```ruby
@game = Game.find_or_create_by!(player: current_player, mission: @mission)
```

This creates games WITHOUT VM context when users directly visit `/missions/:id`.

**Scenarios**:
- User visits `/missions/5` → Game created without vm_set_id
- User visits `/games/new?mission_id=5&vm_set_id=123` → Game created WITH vm_set_id
- User visits `/missions/5` again → Gets the first game (no VMs)

**Fix**: Update `MissionsController#show` for VM-required missions:

```ruby
def show
  @mission = Mission.find(params[:id])
  authorize @mission if defined?(Pundit)

  if @mission.requires_vms?
    # Redirect to game selection/creation page for VM missions
    redirect_to new_game_path(mission_id: @mission.id)
  else
    # Legacy behavior for non-VM missions
    @game = Game.find_or_create_by!(player: current_player, mission: @mission)
    redirect_to game_path(@game)
  end
end
```

Or if always going through explicit creation:
```ruby
def show
  @mission = Mission.find(params[:id])
  # Don't auto-create, show mission info page
  # with "Start Game" button that POSTs to games#create
end
```

---

## Minor Issues

### 4. 📝 `new` Action Not Defined for Game Selection

The fix for Medium Issue #3 suggests redirecting to `new_game_path(mission_id:)`, but there's no `games#new` action defined in the routes or controller.

**Fix**: Add to routes and controller:
```ruby
# routes.rb
resources :games, only: [:new, :show, :create] do
  # ...
end

# games_controller.rb
def new
  @mission = Mission.find(params[:mission_id])
  authorize @mission if defined?(Pundit)
  
  if @mission.requires_vms?
    @available_vm_sets = @mission.valid_vm_sets_for_user(current_user)
    @existing_games = Game.where(player: current_player, mission: @mission)
  end
  
  # Render game selection/creation page
end
```

---

### 5. 📝 Missing View for Game Selection Page

If users need to select a VM set before starting, a view is needed:

```erb
<%# app/views/break_escape/games/new.html.erb %>
<h1><%= @mission.name %></h1>

<% if @mission.requires_vms? %>
  <h2>Select VM Set</h2>
  <% @available_vm_sets.each do |vm_set| %>
    <%= button_to "Start with #{vm_set.name}", 
                  games_path(mission_id: @mission.id, vm_set_id: vm_set.id),
                  method: :post %>
  <% end %>
  
  <% if @available_vm_sets.empty? %>
    <p>No VM sets available. Please provision VMs first.</p>
  <% end %>
<% else %>
  <%= button_to "Start Game", 
                games_path(mission_id: @mission.id),
                method: :post %>
<% end %>
```

---

### 6. 📝 Strong Parameters for `games#create`

The plan doesn't show strong parameters for the create action. Rails best practice:

```ruby
private

def game_create_params
  params.permit(:mission_id, :vm_set_id, standalone_flags: [])
end
```

---

## Validation Checklist

| Item | Status | Notes |
|------|--------|-------|
| Callback timing logic | ✓ Correct | Pre-set player_state available to before_create |
| Route structure | ✓ Correct | Only add `post :flags` |
| ERB null-safety patterns | ✓ Correct | Uses `&.`, `dig`, `\|\| 'null'` |
| `window.breakEscapeConfig` | ✓ Correct | Now documented as extension |
| Minigame framework usage | ✓ Correct | `startMinigame(type, null, params)` |
| Hacktivity flag submission | ✓ Correct | Direct model update approach |
| `games#create` action | ❌ Missing | Must be implemented |
| `games#new` action | ❌ Missing | Needed for VM selection flow |

---

## Summary of Required Changes

### Critical (Must Fix Before Implementation)

1. **Add `games#create` action** to `app/controllers/break_escape/games_controller.rb`
   - Accept `mission_id`, `vm_set_id`, `standalone_flags` params
   - Set `player_state` before `save!`
   - Handle authorization

### Medium (Should Fix)

2. **Update `MissionsController#show`** to handle VM-required missions differently
3. **Document migration deployment order** to avoid race conditions

### Optional (Nice to Have)

4. Add `games#new` action and view for VM set selection
5. Add strong parameters for `games#create`

---

## Revised Implementation Order

1. **Phase 1: Controller Infrastructure**
   - Implement `games#create` action
   - Add `games#new` action and view (optional but recommended)
   - Update `MissionsController#show` for VM missions

2. **Phase 2: Database Migration**
   - Run migration to remove unique index
   - Verify existing games unaffected

3. **Phase 3: Model Changes**
   - Add `generate_scenario_data_with_context` callback
   - Add `build_vm_context` method
   - Add flag submission methods

4. **Phase 4: Frontend**
   - Implement VM launcher minigame
   - Implement flag station minigame
   - Update show.html.erb config

5. **Phase 5: Integration**
   - Update scenario templates with VM ERB syntax
   - Add scenarios using new features
   - Test end-to-end flow
