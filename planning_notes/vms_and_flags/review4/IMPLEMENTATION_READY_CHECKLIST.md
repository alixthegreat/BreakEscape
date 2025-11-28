# Implementation Ready Checklist

**Status**: ✅ READY FOR IMPLEMENTATION  
**Date**: November 28, 2025

---

## Pre-Implementation Fixes (Minor)

Before starting implementation, apply these minor fixes to the plan:

### 1. Policy Methods

Add to `app/policies/break_escape/game_policy.rb`:
```ruby
def submit_flag?
  show?
end
```

Add to `app/policies/break_escape/mission_policy.rb` (or create if doesn't exist):
```ruby
def create_game?
  user.present?
end
```

### 2. Update `hacktivity_mode?` Method

In `games#create`, change authorization from:
```ruby
authorize @mission if defined?(Pundit)
```
To:
```ruby
authorize @mission, :create_game? if defined?(Pundit)
```

### 3. Remove Redundant Authorization

In `games#create`, remove this line:
```ruby
authorize vm_set, :use? if defined?(Pundit)  # REMOVE - valid_vm_sets_for_user handles this
```

---

## Implementation Order

### Phase 1: Controller Infrastructure (Day 1)

| Step | File | Action |
|------|------|--------|
| 1.1 | `app/policies/break_escape/game_policy.rb` | Add `submit_flag?` method |
| 1.2 | `app/policies/break_escape/mission_policy.rb` | Add `create_game?` method |
| 1.3 | `config/routes.rb` | Add `:new` to games resource, add `post :flags` |
| 1.4 | `app/controllers/break_escape/games_controller.rb` | Add `new`, `create`, `submit_flag` actions |
| 1.5 | `app/controllers/break_escape/missions_controller.rb` | Update `show` for VM missions |
| 1.6 | `app/views/break_escape/games/new.html.erb` | Create VM set selection view |

### Phase 2: Database Migration (Day 1)

| Step | File | Action |
|------|------|--------|
| 2.1 | `db/migrate/[timestamp]_remove_unique_game_constraint.rb` | Create migration |
| 2.2 | Terminal | Run `rails db:migrate` |

### Phase 3: Model Changes (Day 2)

| Step | File | Action |
|------|------|--------|
| 3.1 | `app/models/break_escape/mission.rb` | Add `requires_vms?`, `valid_vm_sets_for_user` |
| 3.2 | `app/models/break_escape/mission.rb` | Extend `ScenarioBinding` with `vm_context` |
| 3.3 | `app/models/break_escape/mission.rb` | Update `generate_scenario_data` signature |
| 3.4 | `app/models/break_escape/mission.rb` | Update `hacktivity_mode?` to check VmSet/FlagService |
| 3.5 | `app/models/break_escape/game.rb` | Add `build_vm_context` method |
| 3.6 | `app/models/break_escape/game.rb` | Extend `initialize_player_state` for VM/flag fields |
| 3.7 | `app/models/break_escape/game.rb` | Add flag submission methods |
| 3.8 | `app/models/break_escape/game.rb` | Update `generate_scenario_data` callback |

### Phase 4: Client-Side (Day 3-4)

| Step | File | Action |
|------|------|--------|
| 4.1 | `public/break_escape/js/systems/hacktivity-cable.js` | Create ActionCable integration |
| 4.2 | `public/break_escape/js/minigames/vm-launcher/` | Create minigame directory and files |
| 4.3 | `public/break_escape/js/minigames/flag-station/` | Create minigame directory and files |
| 4.4 | `public/break_escape/js/minigames/index.js` | Register new minigames |
| 4.5 | `public/break_escape/js/systems/interactions.js` | Add handlers for new object types |
| 4.6 | `public/break_escape/css/minigames/vm-launcher.css` | Create styles |
| 4.7 | `public/break_escape/css/minigames/flag-station.css` | Create styles |
| 4.8 | `app/views/break_escape/games/show.html.erb` | Add CSS links, extend config, add script tag |

### Phase 5: Testing (Day 5)

| Step | Test | Validation |
|------|------|------------|
| 5.1 | Model unit tests | `submit_flag`, `build_vm_context` |
| 5.2 | Controller tests | `create`, `submit_flag` actions |
| 5.3 | Standalone mode | Create game without VMs, submit manual flags |
| 5.4 | Hacktivity mode | Create game with VmSet, test console + flags |
| 5.5 | Minigame tests | Open test HTML files for VM launcher and flag station |

---

## Verification Checklist

After implementation, verify:

- [ ] Visiting mission with `secgen_scenario` redirects to `games#new`
- [ ] VM set selection page shows available VM sets
- [ ] Creating game with VM set stores `vm_set_id` in player_state
- [ ] Scenario ERB has access to `vm_context`
- [ ] Clicking `type: "vm-launcher"` object opens VM launcher minigame
- [ ] Clicking `type: "flag-station"` object opens flag station minigame
- [ ] Flag submission validates server-side
- [ ] Flag submission calls `FlagService.process_flag` in Hacktivity mode
- [ ] Console button triggers SPICE file download via ActionCable
- [ ] Multiple games per mission work (unique index removed)
- [ ] Standalone mode works without VMs

---

## Key Code Locations for Reference

### Existing Patterns to Follow

| Pattern | File | Line |
|---------|------|------|
| Minigame registration | `public/break_escape/js/minigames/index.js` | 80-94 |
| Object type handling | `public/break_escape/js/systems/interactions.js` | 455-512 |
| Server unlock validation | `app/models/break_escape/game.rb` | 184-301 |
| ERB scenario generation | `app/models/break_escape/mission.rb` | 65-76 |
| Player state initialization | `app/models/break_escape/game.rb` | 549-582 |
| Policy authorization | `app/controllers/break_escape/games_controller.rb` | 8 |

### Config Object (Current)

```javascript
// app/views/break_escape/games/show.html.erb:115-120
window.breakEscapeConfig = {
  gameId: <%= @game.id %>,
  apiBasePath: '<%= game_path(@game) %>',
  assetsPath: '/break_escape/assets',
  csrfToken: '<%= form_authenticity_token %>'
};
```

### Config Object (After Changes)

```javascript
window.breakEscapeConfig = {
  gameId: <%= @game.id %>,
  apiBasePath: '<%= game_path(@game) %>',
  assetsPath: '/break_escape/assets',
  csrfToken: '<%= form_authenticity_token %>',
  // NEW FIELDS:
  hacktivityMode: <%= BreakEscape::Mission.hacktivity_mode? %>,
  vmSetId: <%= @game.player_state['vm_set_id'] || 'null' %>
};
```

---

## Command Quick Reference

```bash
# Generate migration
rails generate migration RemoveUniqueGameConstraint

# Run migrations
rails db:migrate

# Test routes
rails routes | grep break_escape

# Compile Ink scripts (if adding VM-related NPC dialogs)
./scripts/compile-ink.sh

# Run tests
rails test test/controllers/break_escape/
rails test test/models/break_escape/
```

