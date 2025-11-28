# VM and CTF Flag Integration - Implementation Plan

**Last Updated**: After Hacktivity Compatibility Review (2025-11-28)  
**Review Documents**: 
- `planning_notes/vms_and_flags/review1/REVIEW.md`
- `planning_notes/vms_and_flags/review2/REVIEW.md`
- `planning_notes/vms_and_flags/review3/REVIEW.md`
- `planning_notes/vms_and_flags/review3/HACKTIVITY_COMPATIBILITY.md`

## Overview

This plan integrates VMs and CTF flag submission into BreakEscape. Players will interact with in-game PCs that represent VMs, launch them (via Hacktivity or locally), and submit flags found on those VMs for in-game progress and events.

**Key Requirements:**
- Feed VM/flag data into scenario JSON via ERB
- VM launcher minigame (Hacktivity SPICE download OR standalone VirtualBox instructions)
- Flag submission minigame with rewards (items, door unlocks, NPC events, objectives)
- Server-side validation of all flags via Rails engine
- Multiple game instances per mission (1 per VM set in Hacktivity, unlimited in standalone)

### Critical Assumptions (Verified Against Codebase)
- The `secgen_scenario` column ALREADY EXISTS in `break_escape_missions` (migration 20251125000001)
- Routes are defined in `BreakEscape::Engine.routes.draw` block (not `namespace :break_escape`)
- Game model uses `initialize_player_state` callback (no DEFAULT_PLAYER_STATE constant)
- **`games#create` action does NOT exist** - routes declare it but controller doesn't implement it (Review 3 finding)
- Current game creation happens in `MissionsController#show` via `find_or_create_by!`
- `window.breakEscapeConfig` already exists - must EXTEND, not replace

### Hacktivity Compatibility (Verified Against Hacktivity Codebase)
- **Association name**: Hacktivity uses `sec_gen_batch` (with underscore), not `secgen_batch`
- **Flag submission**: Use `FlagService.process_flag()` for proper scoring, streaks, and ActionCable notifications
- **VmSet display**: No `display_name` method - use `sec_gen_batch.title` instead
- **Flag matching**: Case-insensitive (`lower(flag_key) = ?`)
- **Console URL**: `/hacktivities/:event_id/challenges/:sec_gen_batch_id/vm_sets/:vm_set_id/vms/:id/ovirt_console`
- **VM context needs**: `event_id` and `sec_gen_batch_id` for constructing console URLs

---

## Architecture Overview

### Data Flow

```
1. User clicks "Play Mission" → Games#create action (existing)
2. Games#create receives params:
   - mission_id (required)
   - vm_set_id (Hacktivity mode) OR standalone_flags (standalone mode)
3. Game.create! triggers:
   - initialize_player_state (existing callback, extended for VM context)
   - generate_scenario_data (Mission.generate_scenario_data with vm_context)
4. ERB template populates:
   - PC objects with vm_id, vm_title, vm_set_id
   - Flag-station objects with flags[] array
5. Player interacts with PC → vm-launcher minigame
6. Player submits flags → flag-station minigame → server validation → rewards
```

### Key Patterns (Reused from Existing Systems)

1. **Minigame Framework**: Create 2 new minigames extending `MinigameScene`
   - `vm-launcher` (similar to `password-minigame`)
   - `flag-station` (similar to `container-minigame`)

2. **Server Validation**: Follow `unlock` endpoint pattern
   - POST `/break_escape/games/:id/flags` validates flag
   - Server checks `vm_set.vms.flags` or standalone `scenario_data['flags']`

3. **Rewards System**: Reuse NPC item-giving and door-unlocking patterns
   - Item rewards → `game.add_inventory_item!` + event emission
   - Door unlocks → `game.unlock_room!` + sprite updates
   - NPC triggers → emit event `flag_submitted:flag_id`

4. **ERB Context Injection**: Extend `Mission::ScenarioBinding`
   - Add `@vm_context` hash with VMs and flags
   - Access via `<%= vm_context[:vms].find {|v| v[:title] == 'desktop' } %>`

### Client Configuration

The game view already sets `window.breakEscapeConfig` in `app/views/break_escape/games/show.html.erb`. 
**EXTEND** the existing config (don't replace it) by adding VM-related fields:

```erb
<%# app/views/break_escape/games/show.html.erb - EXTEND existing config %>
<script nonce="<%= content_security_policy_nonce %>">
  window.breakEscapeConfig = {
    // EXISTING fields (keep these):
    gameId: <%= @game.id %>,
    apiBasePath: '<%= game_path(@game) %>',
    assetsPath: '/break_escape/assets',
    csrfToken: '<%= form_authenticity_token %>',
    // NEW fields for VM/flag integration:
    hacktivityMode: <%= BreakEscape::Mission.hacktivity_mode? %>,
    vmSetId: <%= @game.player_state['vm_set_id'] || 'null' %>
  };
</script>
```

---

## Hacktivity Interface Reference

This section documents how BreakEscape interfaces with Hacktivity's models and services. Use this as a reference when implementing the integration.

### Hacktivity Data Model

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Event       │────<│  SecGenBatch    │────<│     VmSet       │
│ (hacktivity)    │     │  (challenge)    │     │ (user's VMs)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │                        │
                              │                        │ has_many
                              │                        ▼
                              │                 ┌─────────────────┐
                              │                 │       Vm        │
                              │                 │ (single VM)     │
                              │                 └─────────────────┘
                              │                        │
                              │                        │ has_many
                              │                        ▼
                              │                 ┌─────────────────┐
                              └─────────────────│      Flag       │
                                                │ (CTF flag)      │
                                                └─────────────────┘
```

### Key Hacktivity Models

#### `VmSet`
Represents a user's allocated set of VMs for a challenge.

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Primary key |
| `user_id` | integer | Owner (nullable - unallocated sets have nil) |
| `sec_gen_batch_id` | integer | Parent challenge |
| `team_id` | integer | Team owner (for team challenges) |
| `relinquished` | boolean | Whether VMs have been returned |
| `build_status` | string | `"pending"`, `"success"`, or `"error"` |
| `activated` | boolean | Whether VMs are currently running |
| `score` | decimal | Current score for this VM set |

**Associations:**
```ruby
belongs_to :user, optional: true
belongs_to :sec_gen_batch      # NOTE: underscore, not camelCase
belongs_to :team, optional: true
has_many :vms
```

#### `Vm`
Represents a single virtual machine.

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Primary key |
| `title` | string | VM name (e.g., "desktop", "server", "web_server") |
| `ip_address` | string | VM's IP address (may be nil) |
| `enable_console` | boolean | Whether user can access graphical console |
| `state` | string | Current state ("up", "down", "offline", etc.) |
| `vm_set_id` | integer | Parent VM set |

**Associations:**
```ruby
belongs_to :vm_set
has_many :flags
```

#### `Flag`
Represents a CTF flag to be discovered and submitted.

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Primary key |
| `flag_key` | string | The flag string (e.g., "flag{s3cr3t_v4lu3}") |
| `solved` | boolean | Whether flag has been submitted |
| `solved_date` | datetime | When flag was submitted |
| `vm_id` | integer | Parent VM |

**Associations:**
```ruby
belongs_to :vm
```

#### `SecGenBatch`
Represents a challenge/lab configuration.

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Primary key |
| `scenario` | string | SecGen scenario path (e.g., "scenarios/ctf/example.xml") |
| `title` | string | Challenge display name |
| `event_id` | integer | Parent event |

**Associations:**
```ruby
belongs_to :event
has_many :vm_sets
```

### Querying VmSets for a User

To find VM sets that match a BreakEscape mission's `secgen_scenario`:

```ruby
# BreakEscape stores scenario identifier in mission.secgen_scenario
# Hacktivity stores it in sec_gen_batch.scenario

::VmSet.joins(:sec_gen_batch)
       .where(sec_gen_batches: { scenario: mission.secgen_scenario })
       .where(user: user, relinquished: false)
       .where.not(build_status: ['pending', 'error'])
       .includes(:vms, :sec_gen_batch)
       .order(created_at: :desc)
```

**Important Notes:**
- Use `sec_gen_batches` (plural with underscore) as the table name
- Filter out `pending` and `error` build statuses
- Always eager-load `:vms` and `:sec_gen_batch` to avoid N+1 queries
- VmSet has no `display_name` method - use `vm_set.sec_gen_batch.title`

### Flag Submission Service

**DO NOT** update flags directly. Use Hacktivity's `FlagService` for proper scoring:

```ruby
# WRONG - bypasses scoring, streaks, notifications
flag.update!(solved: true, solved_date: Time.current)

# CORRECT - handles everything
::FlagService.process_flag(vm, flag_key, user, flash)
```

**What `FlagService.process_flag` handles:**
1. Case-insensitive flag matching (`lower(flag_key) = ?`)
2. Score calculation (percent-based or early-bird scoring)
3. User streak tracking (gamification)
4. Result updates for leaderboards
5. ActionCable notifications for real-time scoreboard updates
6. Late submission penalties (if configured)

**Calling from BreakEscape (no flash context):**
```ruby
def submit_to_hacktivity(flag_key)
  vm_set = ::VmSet.find_by(id: player_state['vm_set_id'])
  return unless vm_set
  
  vm_set.vms.each do |vm|
    flag = vm.flags.where("lower(flag_key) = ?", flag_key.downcase).first
    next unless flag
    
    # Create mock flash since we're not in web request context
    mock_flash = OpenStruct.new
    mock_flash.define_singleton_method(:[]=) { |k, v| 
      Rails.logger.info "[BreakEscape] Flag: #{k}: #{v}" 
    }
    
    ::FlagService.process_flag(vm, flag_key, vm_set.user || player, mock_flash)
    return
  end
end
```

### VM Console URL Construction

To launch a VM's graphical console in Hacktivity, construct this URL:

```
/hacktivities/:event_id/challenges/:sec_gen_batch_id/vm_sets/:vm_set_id/vms/:vm_id/ovirt_console
```

**Required IDs (store in VM context during game creation):**
- `event_id` - from `vm_set.sec_gen_batch.event_id`
- `sec_gen_batch_id` - from `vm_set.sec_gen_batch_id`
- `vm_set_id` - from `vm_set.id`
- `vm_id` - from `vm.id`

**Client-side URL construction:**
```javascript
function getConsoleUrl(vm) {
  if (!window.breakEscapeConfig?.hacktivityMode) return null;
  
  return `/hacktivities/${vm.event_id}/challenges/${vm.sec_gen_batch_id}` +
         `/vm_sets/${vm.vm_set_id}/vms/${vm.id}/ovirt_console`;
}
```

**Notes:**
- This triggers async console file generation
- User must be authorized (own the VM set or be admin/VIP)
- VM must be in "up" state for console to work
- Console access may start timers for timed assessments

### Authorization Rules

Hacktivity uses Pundit policies. A user can access a VmSet if:

```ruby
# From VmSetPolicy and VmPolicy
def user_allocated_vm_set?
  admin? || 
  scoped_vip_by_user?(vm_set.user) ||
  (vm_set.user == user && user.has_event_role?(vm_set.sec_gen_batch.event)) ||
  vm_set.team&.users&.exists?(user.id)
end
```

**In plain terms:**
1. User is admin, OR
2. User is VIP with scope over the VM owner, OR
3. User owns the VM set AND has a role in the event, OR
4. User is a member of the team that owns the VM set

### Detecting Hacktivity Mode

Check if BreakEscape is running inside Hacktivity:

```ruby
# In Mission model or helper
def self.hacktivity_mode?
  defined?(::VmSet) && defined?(::SecGenBatch) && defined?(::FlagService)
end
```

### Error Handling

When interfacing with Hacktivity models:

```ruby
def submit_to_hacktivity(flag_key)
  return unless defined?(::VmSet)
  
  begin
    # ... Hacktivity integration code ...
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.error "[BreakEscape] VM set not found: #{e.message}"
  rescue => e
    Rails.logger.error "[BreakEscape] Hacktivity integration error: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    # Don't re-raise - flag is still valid in BreakEscape even if Hacktivity sync fails
  end
end
```

### Summary: Integration Checklist

When implementing Hacktivity integration, ensure:

- [ ] Use `sec_gen_batch` (underscore) not `secgen_batch`
- [ ] Use `sec_gen_batches` (plural) as table name in queries
- [ ] Filter out `relinquished: true` VM sets
- [ ] Filter out `build_status: ['pending', 'error']`
- [ ] Use `FlagService.process_flag()` for flag submission
- [ ] Use case-insensitive flag matching
- [ ] Eager-load `:vms, :sec_gen_batch` associations
- [ ] Store `event_id` and `sec_gen_batch_id` in VM context for console URLs
- [ ] Use `sec_gen_batch.title` for display (no `display_name` method)
- [ ] Wrap Hacktivity calls in `defined?(::VmSet)` checks
- [ ] Handle errors gracefully without breaking BreakEscape functionality

---

## Database Changes

### Schema Updates

#### 1. `secgen_scenario` Column - ALREADY EXISTS ✓

**No migration needed.** The column already exists via migration `20251125000001_add_metadata_to_break_escape_missions.rb`:

```ruby
# Already implemented:
add_column :break_escape_missions, :secgen_scenario, :string
add_column :break_escape_missions, :collection, :string, default: 'default'
```

The `db/seeds.rb` already reads `secgen_scenario` from `mission.json` files.

#### 2. Remove Uniqueness Constraint from `break_escape_games`

Allow multiple games per player+mission (one per VM set).

```ruby
# db/migrate/[timestamp]_remove_unique_game_constraint.rb
class RemoveUniqueGameConstraint < ActiveRecord::Migration[7.0]
  def change
    remove_index :break_escape_games,
                 name: 'index_games_on_player_and_mission',
                 if_exists: true
    
    # Add non-unique index for performance
    add_index :break_escape_games,
              [:player_type, :player_id, :mission_id],
              name: 'index_games_on_player_and_mission_non_unique'
  end
end
```

#### 3. Add VM/Flag Context to `break_escape_games`

Store VM set association and flag tracking in `player_state`.

**No migration needed** - extend `player_state` JSONB default:

```ruby
# In migration 20251120155358_create_break_escape_games.rb (already exists)
# Update default player_state to include:
{
  # ... existing fields ...
  vm_set_id: nil,           # Hacktivity vm_set.id (null for standalone)
  submitted_flags: [],      # Array of submitted flag strings
  flag_rewards_claimed: []  # Array of flag IDs that granted rewards
}
```

**Action**: Update existing migration file to add these fields to default `player_state`.

---

## Model Changes

### 1. Mission Model (`app/models/break_escape/mission.rb`)

#### Add VM Set Validation

```ruby
# Check if mission requires VMs
def requires_vms?
  secgen_scenario.present?
end

# Get valid VM sets for this mission (Hacktivity mode only)
# 
# HACKTIVITY COMPATIBILITY NOTES:
# - Hacktivity uses `sec_gen_batch` (with underscore), not `secgen_batch`
# - The `scenario` field contains the XML path (e.g., "scenarios/ctf/foo.xml")
# - VmSet doesn't have a `display_name` method - use sec_gen_batch.title instead
# - Always eager-load :vms and :sec_gen_batch to avoid N+1 queries
def valid_vm_sets_for_user(user)
  return [] unless self.class.hacktivity_mode? && requires_vms?
  
  # Query Hacktivity's vm_sets where:
  # - scenario matches our secgen_scenario
  # - user owns it (or is on the team)
  # - not relinquished
  # - build completed successfully
  ::VmSet.joins(:sec_gen_batch)
         .where(sec_gen_batches: { scenario: secgen_scenario })
         .where(user: user, relinquished: false)
         .where.not(build_status: ['pending', 'error'])
         .includes(:vms, :sec_gen_batch)
         .order(created_at: :desc)
end
```

#### Extend ScenarioBinding for VM Context

```ruby
class ScenarioBinding
  def initialize(vm_context = {})
    @random_password = SecureRandom.alphanumeric(8)
    @random_pin = rand(1000..9999).to_s
    @random_code = SecureRandom.hex(4)
    @vm_context = vm_context # NEW: VM/flag data
  end

  attr_reader :random_password, :random_pin, :random_code, :vm_context

  def get_binding
    binding
  end
end
```

#### Update `generate_scenario_data` Method

```ruby
def generate_scenario_data(vm_context = {})
  template_path = scenario_path.join('scenario.json.erb')
  raise "Scenario template not found: #{name}" unless File.exist?(template_path)

  erb = ERB.new(File.read(template_path))
  binding_context = ScenarioBinding.new(vm_context) # Pass context
  output = erb.result(binding_context.get_binding)

  JSON.parse(output)
rescue JSON::ParserError => e
  raise "Invalid JSON in #{name} after ERB processing: #{e.message}"
end
```

### 2. Game Model (`app/models/break_escape/game.rb`)

#### Extend `initialize_player_state` Callback

**NOTE**: The Game model uses a callback pattern, not a constant. Extend the existing callback:

```ruby
# In existing initialize_player_state method, add after existing setup:
def initialize_player_state
  self.player_state = {} unless self.player_state.is_a?(Hash)
  self.player_state['currentRoom'] ||= scenario_data['startRoom']
  self.player_state['unlockedRooms'] ||= [scenario_data['startRoom']]
  # ... existing code ...
  
  # NEW: Initialize VM/flag tracking fields
  self.player_state['vm_set_id'] ||= nil
  self.player_state['standalone_flags'] ||= []
  self.player_state['submitted_flags'] ||= []
  self.player_state['flag_rewards_claimed'] ||= []
end
```

#### Update `generate_scenario_data_with_context` Callback

```ruby
# Replace existing before_create :generate_scenario_data callback
before_create :generate_scenario_data_with_context

def generate_scenario_data_with_context
  # Build VM context from player_state if vm_set_id present
  vm_context = build_vm_context
  self.scenario_data ||= mission.generate_scenario_data(vm_context)
end

private

def build_vm_context
  context = { vms: [], flags: [] }
  
  # Hacktivity mode with VM set
  # NOTE: Hacktivity uses sec_gen_batch (with underscore), not secgen_batch
  if player_state['vm_set_id'].present? && defined?(::VmSet)
    vm_set = ::VmSet.includes(:vms, :sec_gen_batch).find_by(id: player_state['vm_set_id'])
    if vm_set
      # Build VM data with all info needed for console URLs
      # Hacktivity console URL pattern: /hacktivities/:event_id/challenges/:sec_gen_batch_id/vm_sets/:vm_set_id/vms/:id/ovirt_console
      context[:vms] = vm_set.vms.map do |vm|
        {
          id: vm.id,
          title: vm.title,
          description: vm.description,
          ip_address: vm.ip_address,
          vm_set_id: vm_set.id,
          enable_console: vm.enable_console,
          # Additional IDs needed for constructing Hacktivity console URLs
          event_id: vm_set.sec_gen_batch&.event_id,
          sec_gen_batch_id: vm_set.sec_gen_batch_id
        }
      end
      
      # Extract flags from VMs
      context[:flags] = vm_set.vms.flat_map do |vm|
        vm.flags.map(&:flag_key)
      end
      
      # Store challenge info for display
      context[:challenge_title] = vm_set.sec_gen_batch&.title
    end
  end
  
  # Standalone mode - read from player_state
  if player_state['standalone_flags'].present?
    context[:flags] = player_state['standalone_flags']
  end
  
  context
end
```

#### Add Flag Submission Methods

```ruby
# Submit a flag and return whether it's valid
def submit_flag(flag_key)
  return { success: false, message: 'Flag already submitted' } if flag_submitted?(flag_key)
  
  valid_flags = extract_valid_flags_from_scenario
  
  # Case-insensitive flag matching (matches Hacktivity behavior)
  matching_flag = valid_flags.find { |f| f.downcase == flag_key.downcase }
  
  unless matching_flag
    return { success: false, message: 'Invalid flag' }
  end
  
  # Mark flag as submitted (use the canonical version from scenario)
  player_state['submitted_flags'] ||= []
  player_state['submitted_flags'] << matching_flag
  save!
  
  # Submit to Hacktivity if in that mode
  submit_to_hacktivity(flag_key) if player_state['vm_set_id'].present?
  
  { success: true, message: 'Flag accepted', flag: matching_flag }
end

def flag_submitted?(flag_key)
  # Case-insensitive check
  player_state['submitted_flags']&.any? { |f| f.downcase == flag_key.downcase }
end

private

def extract_valid_flags_from_scenario
  flags = []
  
  # Search scenario_data for all flag-station objects
  scenario_data['rooms']&.each do |room_id, room|
    room['objects']&.each do |obj|
      if obj['type'] == 'flag-station' && obj['flags'].present?
        flags.concat(obj['flags'])
      end
    end
  end
  
  flags.uniq
end

# UPDATED based on Hacktivity code review:
# Uses FlagService.process_flag() for proper scoring, streaks, and notifications
def submit_to_hacktivity(flag_key)
  return unless defined?(::VmSet) && player_state['vm_set_id'].present?
  
  vm_set = ::VmSet.find_by(id: player_state['vm_set_id'])
  return unless vm_set
  
  # Find the VM with this flag
  vm_set.vms.each do |vm|
    # Case-insensitive flag lookup (matches Hacktivity's FlagService behavior)
    flag = vm.flags.where("lower(flag_key) = ?", flag_key.downcase).first
    next unless flag
    
    begin
      # Use Hacktivity's FlagService for proper scoring, streaks, and notifications
      # This handles:
      # - Score calculation (percent or early-bird scoring)
      # - Streak tracking for gamification
      # - Result updates for the user
      # - ActionCable notifications for scoreboards
      #
      # We create a mock flash object since we're not in a web request context
      mock_flash = OpenStruct.new
      mock_flash.define_singleton_method(:[]=) do |key, value|
        Rails.logger.info "[BreakEscape] Hacktivity flag result: #{key}: #{value}"
      end
      
      ::FlagService.process_flag(vm, flag_key, vm_set.user || player, mock_flash)
      Rails.logger.info "[BreakEscape] Submitted flag #{flag_key} to Hacktivity via FlagService"
      
    rescue => e
      Rails.logger.error "[BreakEscape] Failed to submit flag to Hacktivity: #{e.message}"
      Rails.logger.error e.backtrace.first(5).join("\n")
      # Flag is still marked submitted in BreakEscape even if Hacktivity sync fails
    end
    
    return # Only submit once
  end
end
```

---

## Controller Changes

### 1. Games Controller (`app/controllers/break_escape/games_controller.rb`)

#### Add `create` Action (NEW - Does Not Currently Exist)

**IMPORTANT**: Despite `config/routes.rb` declaring `resources :games, only: [:show, :create]`, the `create` action is NOT implemented. Games are currently created via `MissionsController#show` using `find_or_create_by!`.

**This action must be implemented from scratch:**

```ruby
# Add to app/controllers/break_escape/games_controller.rb
def create
  @mission = Mission.find(params[:mission_id])
  authorize @mission if defined?(Pundit)
  
  # Build initial player_state with VM/flag context
  initial_player_state = {}
  
  # Hacktivity mode with VM set
  if params[:vm_set_id].present? && defined?(::VmSet)
    vm_set = ::VmSet.find(params[:vm_set_id])
    authorize vm_set, :use? if defined?(Pundit)
    
    # Validate VM set belongs to user and matches mission
    unless @mission.valid_vm_sets_for_user(current_user).include?(vm_set)
      return render json: { error: 'Invalid VM set for this mission' }, status: :forbidden
    end
    
    initial_player_state['vm_set_id'] = vm_set.id
  end
  
  # Standalone mode with manual flags
  if params[:standalone_flags].present?
    flags = if params[:standalone_flags].is_a?(Array)
              params[:standalone_flags]
            else
              params[:standalone_flags].split(',').map(&:strip).reject(&:blank?)
            end
    initial_player_state['standalone_flags'] = flags
  end
  
  # CRITICAL: Set player_state BEFORE save! so callbacks can read vm_set_id
  # Callback order is:
  # 1. before_create :generate_scenario_data_with_context (reads player_state['vm_set_id'])
  # 2. before_create :initialize_player_state (adds default fields)
  @game = Game.new(
    player: current_player,
    mission: @mission
  )
  @game.player_state = initial_player_state
  @game.save!
  
  redirect_to game_path(@game)
end

private

def game_create_params
  params.permit(:mission_id, :vm_set_id, standalone_flags: [])
end
```

#### Add `new` Action (NEW - For VM Set Selection)

```ruby
# Add to app/controllers/break_escape/games_controller.rb
def new
  @mission = Mission.find(params[:mission_id])
  authorize @mission if defined?(Pundit)
  
  if @mission.requires_vms?
    @available_vm_sets = @mission.valid_vm_sets_for_user(current_user)
    @existing_games = Game.where(player: current_player, mission: @mission)
  end
end
```

#### Add `submit_flag` Action (NEW)

```ruby
# POST /games/:id/flags
def submit_flag
  authorize @game if defined?(Pundit)
  
  flag_key = params[:flag]
  
  unless flag_key.present?
    return render json: { success: false, message: 'No flag provided' }, status: :bad_request
  end
  
  result = @game.submit_flag(flag_key)
  
  if result[:success]
    # Find rewards for this flag in scenario
    rewards = find_flag_rewards(flag_key)
    
    # Process rewards
    reward_results = process_flag_rewards(flag_key, rewards)
    
    render json: {
      success: true,
      message: result[:message],
      flag: flag_key,
      rewards: reward_results
    }
  else
    render json: result, status: :unprocessable_entity
  end
end

private

def find_flag_rewards(flag_key)
  rewards = []
  
  # Search scenario for flag-station with this flag
  @game.scenario_data['rooms']&.each do |room_id, room|
    room['objects']&.each do |obj|
      next unless obj['type'] == 'flag-station'
      next unless obj['flags']&.include?(flag_key)
      
      flag_station_id = obj['id'] || obj['name']
      
      # Support both hash structure (preferred) and array structure (legacy)
      if obj['flagRewards'].is_a?(Hash)
        # Hash structure: { "flag{key}": { "type": "unlock_door", ... } }
        reward = obj['flagRewards'][flag_key]
        if reward
          rewards << reward.merge(
            'flag_station_id' => flag_station_id,
            'room_id' => room_id
          )
        end
      elsif obj['flagRewards'].is_a?(Array)
        # Array structure (legacy): rewards[i] corresponds to flags[i]
        flag_index = obj['flags'].index(flag_key)
        if flag_index && obj['flagRewards'][flag_index]
          rewards << obj['flagRewards'][flag_index].merge(
            'flag_station_id' => flag_station_id,
            'room_id' => room_id
          )
        end
      end
    end
  end
  
  rewards
end

def process_flag_rewards(flag_key, rewards)
  results = []
  
  rewards.each do |reward|
    # Skip if already claimed
    if @game.player_state['flag_rewards_claimed']&.include?(flag_key)
      results << { type: 'skipped', reason: 'Already claimed' }
      next
    end
    
    # Process each reward type
    case reward['type']
    when 'give_item'
      results << process_item_reward(reward, flag_key)
      
    when 'unlock_door'
      results << process_door_unlock_reward(reward, flag_key)
      
    when 'emit_event'
      results << process_event_reward(reward, flag_key)
      
    else
      results << { type: 'unknown', data: reward }
    end
  end
  
  # Mark rewards as claimed
  @game.player_state['flag_rewards_claimed'] ||= []
  @game.player_state['flag_rewards_claimed'] << flag_key
  @game.save!
  
  results
end

def process_item_reward(reward, flag_key)
  # Find the flag-station object to pull item from its itemsHeld
  flag_station = find_flag_station_by_id(reward['flag_station_id'])
  
  return { type: 'error', message: 'Flag station not found' } unless flag_station
  
  # Get item from itemsHeld (similar to NPC item giving)
  item = flag_station['itemsHeld']&.find { |i| i['type'] == reward['item_type'] || i['name'] == reward['item_name'] }
  
  return { type: 'error', message: 'Item not found in flag station' } unless item
  
  # Add to player inventory
  @game.add_inventory_item!(item)
  
  { type: 'give_item', item: item, success: true }
end

def process_door_unlock_reward(reward, flag_key)
  room_id = reward['room_id']
  
  return { type: 'error', message: 'No room_id specified' } unless room_id
  
  # Unlock the door (same as NPC door unlock)
  @game.unlock_room!(room_id)
  
  { type: 'unlock_door', room_id: room_id, success: true }
end

def process_event_reward(reward, flag_key)
  # Emit event (NPC can listen and trigger conversations)
  event_name = reward['event_name'] || "flag_submitted:#{flag_key}"
  
  # Store event in player_state for client to emit
  @game.player_state['pending_events'] ||= []
  @game.player_state['pending_events'] << {
    name: event_name,
    data: { flag: flag_key, timestamp: Time.current.to_i }
  }
  @game.save!
  
  { type: 'emit_event', event_name: event_name, success: true }
end

def find_flag_station_by_id(flag_station_id)
  @game.scenario_data['rooms']&.each do |room_id, room|
    room['objects']&.each do |obj|
      return obj if (obj['id'] || obj['name']) == flag_station_id && obj['type'] == 'flag-station'
    end
  end
  nil
end
```

### 2. Add Routes

The routes follow the existing engine pattern in `config/routes.rb`:

```ruby
# config/routes.rb
BreakEscape::Engine.routes.draw do
  resources :missions, only: [:index, :show]
  
  # UPDATED: Add :new to games resource
  resources :games, only: [:new, :show, :create] do
    member do
      get :scenario
      get :ink
      put :sync_state
      post :unlock
      post :inventory
      post :container
      post :encounter_npc
      post :update_global_variables
      post :npc_unlock
      post :npc_give_item
      get :objectives_state
      post :complete_task
      post :flags          # NEW: Submit flag endpoint
    end
  end
end
```

**NOTE**: The existing routes structure uses `BreakEscape::Engine.routes.draw`, not `namespace :break_escape`. 

**CHANGES NEEDED**:
1. Add `:new` to `only: [:new, :show, :create]` 
2. Add `post :flags` to the member block

### 2. Missions Controller (`app/controllers/break_escape/missions_controller.rb`)

#### Update `show` Action (Critical Change)

**IMPORTANT**: The current `show` action uses `find_or_create_by!` which won't work with VM context. Update it to handle VM missions differently:

```ruby
# app/controllers/break_escape/missions_controller.rb
def show
  @mission = Mission.find(params[:id])
  authorize @mission if defined?(Pundit)

  if @mission.requires_vms?
    # VM missions need explicit game creation with VM set selection
    # Redirect to games#new which shows VM set selection UI
    redirect_to new_game_path(mission_id: @mission.id)
  else
    # Legacy behavior for non-VM missions - auto-create game
    @game = Game.find_or_create_by!(
      player: current_player,
      mission: @mission
    )
    redirect_to game_path(@game)
  end
end
```

### 3. Add Games#new View

```erb
<%# app/views/break_escape/games/new.html.erb %>
<div class="game-setup">
  <h1><%= @mission.name %></h1>
  <p><%= @mission.description %></p>

  <% if @mission.requires_vms? %>
    <h2>Select VM Environment</h2>
    
    <% if @available_vm_sets.any? %>
      <div class="vm-set-list">
        <% @available_vm_sets.each do |vm_set| %>
          <%= form_with url: break_escape.games_path, method: :post, local: true do |f| %>
            <%= f.hidden_field :mission_id, value: @mission.id %>
            <%= f.hidden_field :vm_set_id, value: vm_set.id %>
            
            <div class="vm-set-card">
              <%# NOTE: VmSet doesn't have display_name - use sec_gen_batch.title instead %>
              <h3><%= vm_set.sec_gen_batch&.title || "VM Set ##{vm_set.id}" %></h3>
              <p><%= pluralize(vm_set.vms.count, 'VM') %></p>
              <ul class="vm-list">
                <% vm_set.vms.each do |vm| %>
                  <li><%= vm.title %><%= " (#{vm.ip_address})" if vm.ip_address.present? %></li>
                <% end %>
              </ul>
              <%= f.submit "Start with this VM Set", class: "btn btn-primary" %>
            </div>
          <% end %>
        <% end %>
      </div>
      
      <% if @existing_games.any? %>
        <h3>Continue Existing Game</h3>
        <% @existing_games.each do |game| %>
          <%= link_to "Continue (started #{time_ago_in_words(game.started_at)} ago)", 
                      game_path(game), class: "btn btn-secondary" %>
        <% end %>
      <% end %>
    <% else %>
      <div class="alert alert-warning">
        <p>This mission requires VMs but you don't have any available VM sets.</p>
        <p>Please provision VMs through Hacktivity first.</p>
      </div>
    <% end %>
    
  <% else %>
    <%# Non-VM mission - just start %>
    <%= form_with url: break_escape.games_path, method: :post, local: true do |f| %>
      <%= f.hidden_field :mission_id, value: @mission.id %>
      <%= f.submit "Start Mission", class: "btn btn-primary" %>
    <% end %>
  <% end %>
</div>
```

---

## View Changes

### 1. Update Mission Index to Support VM Set Selection

In Hacktivity mode, the mission index should allow VM set selection before game creation.

**Option A**: Add VM set dropdown to mission cards (inline)  
**Option B**: Show modal dialog when clicking "Play" (recommended)

For simplicity, update the existing mission card to POST to `games#create` with optional `vm_set_id`:

```erb
<%# app/views/break_escape/missions/index.html.erb %>
<%# or _mission_card.html.erb partial %>

<%= form_with url: break_escape.games_path, method: :post, local: true do |f| %>
  <%= f.hidden_field :mission_id, value: mission.id %>
  
  <%# HACKTIVITY COMPATIBILITY: VmSet doesn't have display_name method %>
  <%# Use sec_gen_batch.title instead %>
  <% if mission.requires_vms? && @vm_sets_by_mission[mission.id]&.any? %>
    <div class="vm-set-selection">
      <label>Select VM Set:</label>
      <%= f.select :vm_set_id, 
          @vm_sets_by_mission[mission.id].map { |vs| 
            ["#{vs.sec_gen_batch&.title} (#{vs.vms.count} VMs)", vs.id] 
          },
          { include_blank: 'Choose VM Set...' },
          { required: true, class: 'form-control' } %>
    </div>
  <% elsif mission.requires_vms? %>
    <div class="alert alert-warning">
      This mission requires VMs. No VM sets available.
    </div>
  <% end %>
  
  <%# Standalone flag entry (shown when no VMs required or fallback) %>
  <% unless mission.requires_vms? %>
    <div class="standalone-flags" style="display: none;">
      <%= f.text_area :standalone_flags, 
          placeholder: "Enter flags (comma-separated)", 
          class: 'form-control' %>
    </div>
  <% end %>
  
  <%= f.submit "Play Mission", class: "btn btn-primary" %>
<% end %>
```

### 2. Add `hacktivityMode` Config to Game View

**IMPORTANT**: EXTEND the existing `window.breakEscapeConfig` (lines 113-118 of show.html.erb):

```erb
<%# app/views/break_escape/games/show.html.erb %>
<%# Find the existing window.breakEscapeConfig block and ADD these fields: %>
<script nonce="<%= content_security_policy_nonce %>">
  window.breakEscapeConfig = {
    // EXISTING fields (already present - DO NOT REMOVE):
    gameId: <%= @game.id %>,
    apiBasePath: '<%= game_path(@game) %>',
    assetsPath: '/break_escape/assets',
    csrfToken: '<%= form_authenticity_token %>',
    // NEW fields to add:
    hacktivityMode: <%= BreakEscape::Mission.hacktivity_mode? %>,
    vmSetId: <%= @game.player_state['vm_set_id'] || 'null' %>
  };
</script>
```

### 3. Update MissionsController#show for VM Missions

**Problem**: The current `MissionsController#show` uses `find_or_create_by!` which prevents multiple games per mission.

**Solution**: For missions requiring VMs, redirect to game selection instead of auto-creating:

```ruby
# app/controllers/break_escape/missions_controller.rb
def show
  @mission = Mission.find(params[:id])
  authorize @mission if defined?(Pundit)
  
  if @mission.requires_vms? && BreakEscape::Mission.hacktivity_mode?
    # VM missions need VM set selection first
    # Redirect to games index filtered by this mission
    # User will select or create a game there
    redirect_to break_escape.games_path(mission_id: @mission.id)
  else
    # Legacy behavior for non-VM missions (standalone mode)
    @game = Game.find_or_create_by!(player: current_player, mission: @mission)
    redirect_to game_path(@game)
  end
end
```
    
**Styling**: Add CSS to `app/assets/stylesheets/break_escape/` directory as needed.

### 4. Add CSS Link Tags to show.html.erb

Add link tags for the new minigame CSS files to `app/views/break_escape/games/show.html.erb`:

```erb
<%# Add after other minigame CSS links (around line 52) %>
<link rel="stylesheet" href="/break_escape/css/minigames/vm-launcher.css">
<link rel="stylesheet" href="/break_escape/css/minigames/flag-station.css">
```

---

## Scenario ERB Template Updates

### Example Scenario with VMs and Flags

**File**: `scenarios/enterprise_breach/scenario.json.erb`

**IMPORTANT ERB SAFETY**: Always use null-safe patterns to handle both Hacktivity and standalone modes.

```erb
{
  "scenarioName": "Enterprise Network Breach",
  "scenarioBrief": "Infiltrate the corporate network and exfiltrate sensitive data.",
  "startRoom": "parking_lot",
  "startItemsInInventory": [
    {
      "type": "laptop",
      "name": "Attack Laptop",
      "takeable": false,
      "observations": "Your personal attack machine"
    }
  ],
  "rooms": {
    "server_room": {
      "type": "server_room",
      "connections": { "south": "hallway" },
      "objects": [
        <%# VM Launcher - Kali attack box %>
        <%# Use null-safe patterns for standalone mode compatibility %>
        <% kali_vm = vm_context[:vms]&.find { |v| v[:title]&.downcase&.include?('kali') } %>
        {
          "type": "vm-launcher",
          "name": "Kali Attack System",
          "vm_title": <%= kali_vm ? "\"#{kali_vm[:title]}\"" : 'null' %>,
          "vm_set_id": <%= kali_vm&.dig(:vm_set_id) || 'null' %>,
          "vm_id": <%= kali_vm&.dig(:id) || 'null' %>,
          "vm_description": <%= kali_vm ? "\"#{kali_vm[:description]}\"" : 'null' %>,
          "vm_ip_address": <%= kali_vm ? "\"#{kali_vm[:ip_address]}\"" : 'null' %>,
          "observations": "A Kali Linux attack box for network penetration",
          "postitNote": "Use this to scan the network<%= kali_vm ? ". IP: #{kali_vm[:ip_address]}" : '' %>",
          "showPostit": true,
          "takeable": false,
          "interactable": true
        },
        
        <%# Flag Submission Station %>
        <% desktop_vm = vm_context[:vms]&.find { |v| v[:title]&.downcase&.include?('desktop') } %>
        {
          "type": "flag-station",
          "name": "Exfiltration Drop-Site",
          "id": "flag_station_server_room",
          "vm_title": <%= desktop_vm ? "\"#{desktop_vm[:title]}\"" : 'null' %>,
          "vm_set_id": <%= desktop_vm&.dig(:vm_set_id) || 'null' %>,
          "vm_id": <%= desktop_vm&.dig(:id) || 'null' %>,
          "observations": "Secure terminal for submitting discovered intelligence",
          "flags": <%= vm_context[:flags].to_json %>,
          "flagRewards": {
            <%# Use hash structure for flag->reward mapping %>
            <%# This is safer than array index matching %>
            <% if vm_context[:flags]&.any? %>
            <%= vm_context[:flags].first.to_json %>: {
              "type": "unlock_door",
              "room_id": "vault"
            }
            <% end %>
          },
          "itemsHeld": [
            {
              "type": "lockpick",
              "name": "Professional Lockpick Set",
              "takeable": true,
              "observations": "A high-quality lockpick kit"
            }
          ],
          "takeable": false,
          "interactable": true
        }
      ]
    }
  }
}
```

**Key ERB Safety Patterns:**
- Use `&.` (safe navigation) for nil checks: `vm_context[:vms]&.find {...}`
- Use `dig` for nested hash access: `kali_vm&.dig(:vm_set_id)`
- Output `null` (not empty string) for missing values: `<%= kali_vm || 'null' %>`
- Use `.to_json` for arrays and hashes: `<%= vm_context[:flags].to_json %>`
- Avoid trailing commas - use conditional blocks that output complete JSON fragments

---

## Client-Side Implementation

### 1. VM Launcher Minigame

**File**: `public/break_escape/js/minigames/vm-launcher/vm-launcher-minigame.js`

```javascript
import { MinigameScene } from '../framework/base-minigame.js';

export class VMLauncherMinigame extends MinigameScene {
    constructor(container, params) {
        params.title = params.title || 'Launch VM';
        params.showCancel = true;
        
        super(container, params);
        
        // VM data from scenario
        this.vmData = params.vmData || {};
        this.mode = params.mode || 'standalone'; // 'hacktivity' or 'standalone'
    }
    
    async init() {
        super.init();
        
        if (this.mode === 'hacktivity') {
            this.createHacktivityUI();
        } else {
            this.createStandaloneUI();
        }
    }
    
    createHacktivityUI() {
        // Show monitor with VM details and launch button
        this.gameContainer.innerHTML = `
            <div class="vm-launcher hacktivity-mode">
                <div class="monitor-bezel">
                    <div class="monitor-screen">
                        <div class="vm-info">
                            <h3>${this.vmData.name || 'Virtual Machine'}</h3>
                            <p><strong>Description:</strong> ${this.vmData.vm_description || 'N/A'}</p>
                            <p><strong>IP Address:</strong> ${this.vmData.vm_ip_address || 'N/A'}</p>
                            <p><strong>VM ID:</strong> ${this.vmData.vm_id || 'N/A'}</p>
                        </div>
                        
                        <button class="vm-launch-button" id="vm-launch-btn">
                            Launch VM (Download SPICE)
                        </button>
                        
                        <div class="vm-status" id="vm-status">
                            Click to download console access file
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Setup launch button
        document.getElementById('vm-launch-btn').addEventListener('click', () => {
            this.launchVMHacktivity();
        });
    }
    
    createStandaloneUI() {
        // Show terminal-style instructions for VirtualBox
        this.gameContainer.innerHTML = `
            <div class="vm-launcher standalone-mode">
                <div class="terminal">
                    <div class="terminal-header">VM Launch Instructions</div>
                    <div class="terminal-body">
                        <p><strong>${this.vmData.name || 'Virtual Machine'}</strong></p>
                        <p>${this.vmData.observations || ''}</p>
                        
                        <div class="instructions">
                            <h4>Local VirtualBox Setup:</h4>
                            <ol>
                                <li>Open VirtualBox</li>
                                <li>Start VM: <code>${this.vmData.vm_title || 'target_vm'}</code></li>
                                <li>Wait for VM to boot</li>
                                <li>Use VM console or SSH to access</li>
                            </ol>
                            
                            ${this.vmData.postitNote ? `
                                <div class="postit-note">
                                    <strong>Note:</strong> ${this.vmData.postitNote}
                                </div>
                            ` : ''}
                        </div>
                        
                        <button class="terminal-button" id="acknowledge-btn">
                            Understood
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('acknowledge-btn').addEventListener('click', () => {
            this.complete(true);
        });
    }
    
    async launchVMHacktivity() {
        const vmId = this.vmData.vm_id;
        const gameId = window.breakEscapeConfig?.gameId;
        
        if (!vmId || !gameId) {
            this.showFailure('VM data not available', true, 3000);
            return;
        }
        
        try {
            // Call Hacktivity's ovirt_console endpoint
            // This downloads the SPICE .vv file
            const consoleUrl = `/events/hacktivities/challenges/vm_sets/${this.vmData.vm_set_id}/vms/${vmId}/ovirt_console`;
            
            // Trigger download
            window.location.href = consoleUrl;
            
            // Show success message
            document.getElementById('vm-status').innerHTML = `
                <span class="success">✓ Console file downloaded!</span><br>
                Open the .vv file to access the VM.
            `;
            
            // Wait a moment then complete
            setTimeout(() => {
                this.complete(true);
            }, 2000);
            
        } catch (error) {
            console.error('Failed to launch VM:', error);
            this.showFailure('Failed to download console file', true, 3000);
        }
    }
}

// Export starter function
export function startVMLauncherMinigame(vmData, mode = 'standalone') {
    if (!window.MinigameFramework) {
        console.error('MinigameFramework not available');
        return;
    }
    
    window.MinigameFramework.startMinigame('vm-launcher', null, {
        vmData: vmData,
        mode: mode,
        title: `VM: ${vmData.name || 'Launch'}`
    });
}

window.startVMLauncherMinigame = startVMLauncherMinigame;
```

### 2. Flag Station Minigame

**File**: `public/break_escape/js/minigames/flag-station/flag-station-minigame.js`

```javascript
import { MinigameScene } from '../framework/base-minigame.js';

export class FlagStationMinigame extends MinigameScene {
    constructor(container, params) {
        params.title = params.title || 'Flag Submission';
        params.showCancel = true;
        
        super(container, params);
        
        this.flagStation = params.flagStation || {};
        this.expectedFlags = this.flagStation.flags || [];
        this.submittedFlags = params.submittedFlags || [];
    }
    
    async init() {
        super.init();
        this.createFlagStationUI();
    }
    
    createFlagStationUI() {
        const flagsRemaining = this.expectedFlags.filter(f => !this.submittedFlags.includes(f)).length;
        
        this.gameContainer.innerHTML = `
            <div class="flag-station-minigame">
                <div class="flag-terminal">
                    <div class="terminal-header">
                        <span>${this.flagStation.name || 'Flag Drop-Site'}</span>
                        <span class="flag-counter">${this.submittedFlags.length}/${this.expectedFlags.length} flags</span>
                    </div>
                    
                    <div class="terminal-body">
                        <p class="terminal-prompt">${this.flagStation.observations || 'Enter discovered flags below:'}</p>
                        
                        <div class="flag-input-area">
                            <input 
                                type="text" 
                                id="flag-input" 
                                class="flag-input"
                                placeholder="flag{...}"
                                autocomplete="off"
                            />
                            <button id="submit-flag-btn" class="flag-submit-btn">Submit</button>
                        </div>
                        
                        <div class="flag-status" id="flag-status"></div>
                        
                        <div class="submitted-flags">
                            <h4>Submitted Flags:</h4>
                            <ul id="submitted-flags-list">
                                ${this.submittedFlags.map(f => `
                                    <li class="flag-submitted">✓ ${this.maskFlag(f)}</li>
                                `).join('')}
                            </ul>
                        </div>
                        
                        ${flagsRemaining === 0 ? `
                            <div class="all-flags-complete">
                                <strong>All flags submitted!</strong>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        const input = document.getElementById('flag-input');
        const submitBtn = document.getElementById('submit-flag-btn');
        
        submitBtn.addEventListener('click', () => this.submitFlag());
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.submitFlag();
            }
        });
        
        input.focus();
    }
    
    async submitFlag() {
        const input = document.getElementById('flag-input');
        const flagValue = input.value.trim();
        
        if (!flagValue) {
            this.showStatus('Please enter a flag', 'error');
            return;
        }
        
        // Check if already submitted
        if (this.submittedFlags.includes(flagValue)) {
            this.showStatus('Flag already submitted', 'warning');
            input.value = '';
            return;
        }
        
        // Submit to server
        this.showStatus('Validating flag...', 'info');
        
        try {
            const result = await this.validateFlagWithServer(flagValue);
            
            if (result.success) {
                // Add to submitted list
                this.submittedFlags.push(flagValue);
                
                // Show success
                this.showStatus(`✓ Flag accepted! ${result.message || ''}`, 'success');
                
                // Update UI
                const list = document.getElementById('submitted-flags-list');
                const li = document.createElement('li');
                li.className = 'flag-submitted';
                li.textContent = `✓ ${this.maskFlag(flagValue)}`;
                list.appendChild(li);
                
                // Process rewards
                if (result.rewards) {
                    await this.processRewards(result.rewards);
                }
                
                // Clear input
                input.value = '';
                
                // Update counter
                const counter = document.querySelector('.flag-counter');
                if (counter) {
                    counter.textContent = `${this.submittedFlags.length}/${this.expectedFlags.length} flags`;
                }
                
                // Check if all flags submitted
                if (this.submittedFlags.length === this.expectedFlags.length) {
                    this.showStatus('🎉 All flags submitted! Mission complete!', 'success');
                    setTimeout(() => {
                        this.complete(true);
                    }, 3000);
                }
                
            } else {
                this.showStatus(`✗ ${result.message || 'Invalid flag'}`, 'error');
                input.value = '';
            }
            
        } catch (error) {
            console.error('Flag submission error:', error);
            this.showStatus('Failed to submit flag', 'error');
        }
    }
    
    async validateFlagWithServer(flag) {
        const gameId = window.breakEscapeConfig?.gameId;
        if (!gameId) {
            throw new Error('Game ID not available');
        }
        
        const response = await fetch(`/break_escape/games/${gameId}/flags`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': document.querySelector('[name="csrf-token"]')?.content
            },
            body: JSON.stringify({ flag: flag })
        });
        
        if (!response.ok) {
            const data = await response.json();
            return { success: false, message: data.message || 'Server error' };
        }
        
        return await response.json();
    }
    
    async processRewards(rewards) {
        for (const reward of rewards) {
            switch (reward.type) {
                case 'give_item':
                    if (reward.success && reward.item) {
                        window.gameAlert(`Received: ${reward.item.name}`, 'success', 'Reward', 3000);
                        // Add to inventory (already done server-side, just notify)
                        if (window.updateInventoryUI) {
                            window.updateInventoryUI();
                        }
                    }
                    break;
                    
                case 'unlock_door':
                    if (reward.success) {
                        window.gameAlert(`Door unlocked: ${reward.room_id}`, 'success', 'Access Granted', 3000);
                        // Emit event for door sprite updates
                        if (window.eventDispatcher) {
                            window.eventDispatcher.emit('door_unlocked_by_flag', {
                                roomId: reward.room_id,
                                source: 'flag_reward'
                            });
                        }
                    }
                    break;
                    
                case 'emit_event':
                    if (reward.success && window.eventDispatcher) {
                        // Emit the custom event (NPCs can listen)
                        window.eventDispatcher.emit(reward.event_name, {
                            source: 'flag_reward',
                            timestamp: Date.now()
                        });
                    }
                    break;
            }
        }
    }
    
    maskFlag(flag) {
        // Show first 10 chars and last 3 chars
        if (flag.length <= 15) return flag;
        return flag.substring(0, 10) + '...' + flag.substring(flag.length - 3);
    }
    
    showStatus(message, type) {
        const status = document.getElementById('flag-status');
        status.className = `flag-status ${type}`;
        status.textContent = message;
        
        setTimeout(() => {
            status.textContent = '';
        }, 5000);
    }
}

// Export starter function
export function startFlagStationMinigame(flagStation, submittedFlags = []) {
    if (!window.MinigameFramework) {
        console.error('MinigameFramework not available');
        return;
    }
    
    window.MinigameFramework.startMinigame('flag-station', null, {
        flagStation: flagStation,
        submittedFlags: submittedFlags,
        title: flagStation.name || 'Flag Submission'
    });
}

window.startFlagStationMinigame = startFlagStationMinigame;
```

### 3. Register Minigames

**File**: `public/break_escape/js/minigames/index.js`

```javascript
// Add imports
import { VMLauncherMinigame, startVMLauncherMinigame } from './vm-launcher/vm-launcher-minigame.js';
import { FlagStationMinigame, startFlagStationMinigame } from './flag-station/flag-station-minigame.js';

// Register minigames
MinigameFramework.registerScene('vm-launcher', VMLauncherMinigame);
MinigameFramework.registerScene('flag-station', FlagStationMinigame);

// Export functions
export { VMLauncherMinigame, startVMLauncherMinigame };
export { FlagStationMinigame, startFlagStationMinigame };

// Make globally available
window.startVMLauncherMinigame = startVMLauncherMinigame;
window.startFlagStationMinigame = startFlagStationMinigame;
```

### 4. PC Interaction Handler

**File**: `public/break_escape/js/systems/interactions.js`

Update `handleObjectInteraction` to handle VM launcher and flag station types. Use `type` property directly (consistent with existing patterns) rather than introducing a new `pcMode` field:

```javascript
// In handleObjectInteraction function (around line 455), add cases for new types:

// Handle VM launcher objects
if (sprite.scenarioData.type === "vm-launcher") {
    handleVMLauncher(sprite);
    return;
}

// Handle flag station objects  
if (sprite.scenarioData.type === "flag-station") {
    handleFlagStation(sprite);
    return;
}

// Helper functions (add at bottom of file, before exports):

function handleVMLauncher(pcObject) {
    const mode = window.breakEscapeConfig?.hacktivityMode ? 'hacktivity' : 'standalone';
    
    const vmData = {
        name: pcObject.scenarioData.name,
        vm_id: pcObject.scenarioData.vm_id,
        vm_title: pcObject.scenarioData.vm_title,
        vm_set_id: pcObject.scenarioData.vm_set_id,
        vm_description: pcObject.scenarioData.vm_description,
        vm_ip_address: pcObject.scenarioData.vm_ip_address,
        observations: pcObject.scenarioData.observations,
        postitNote: pcObject.scenarioData.postitNote
    };
    
    window.startVMLauncherMinigame(vmData, mode);
}

async function handleFlagStation(pcObject) {
    // Get submitted flags from gameState (already loaded at game start)
    // Avoids unnecessary fetch to server
    const submittedFlags = window.gameState?.submittedFlags || [];
    
    // The flag station's scenarioData.flags contains expected flags for THIS station
    const flagStationId = pcObject.scenarioData.id || pcObject.scenarioData.name;
    
    window.startFlagStationMinigame({
        ...pcObject.scenarioData,
        id: flagStationId
    }, submittedFlags);
}
```

**Note**: Using `type: "vm-launcher"` and `type: "flag-station"` directly is consistent with existing patterns like `type: "workstation"`, `type: "notepad"`, etc.

### 5. Update main.js to Populate submittedFlags

After loading the scenario, populate `window.gameState.submittedFlags` for the flag station minigame:

```javascript
// In main.js, after scenario is loaded:
// Look for where scenario is fetched and gameState is initialized

// Add after scenario data is received:
if (scenarioData.submittedFlags) {
    window.gameState.submittedFlags = scenarioData.submittedFlags;
}
```
```

### 5. Add Submitted Flags to Scenario Bootstrap

**File**: `app/controllers/break_escape/games_controller.rb`

Update `scenario` action to include submitted flags.

```ruby
def scenario
  authorize @game if defined?(Pundit)

  begin
    filtered = @game.filtered_scenario_for_bootstrap
    filter_requires_recursive(filtered)
    
    # Include objectives state
    if @game.player_state['objectivesState'].present?
      filtered['objectivesState'] = @game.player_state['objectivesState']
    end
    
    # NEW: Include submitted flags
    if @game.player_state['submitted_flags'].present?
      filtered['submittedFlags'] = @game.player_state['submitted_flags']
    end

    render json: filtered
  rescue => e
    Rails.logger.error "[BreakEscape] scenario error: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
    render_error("Failed to generate scenario: #{e.message}", :internal_server_error)
  end
end
```

---

## CSS Styling

### 1. VM Launcher Styles

**File**: `public/break_escape/css/minigames/vm-launcher.css`

```css
/* VM Launcher Minigame Styles */

.vm-launcher {
    padding: 20px;
}

.vm-launcher.hacktivity-mode .monitor-bezel {
    background: linear-gradient(to bottom, #2a2a2a, #1a1a1a);
    border: 2px solid #000;
    padding: 15px;
    border-radius: 0;
    box-shadow: 0 0 20px rgba(0,0,0,0.8);
}

.vm-launcher .monitor-screen {
    background: #1e1e1e;
    border: 2px solid #000;
    padding: 20px;
    min-height: 300px;
    font-family: 'Courier New', monospace;
    color: #00ff00;
}

.vm-launcher .vm-info {
    margin-bottom: 20px;
}

.vm-launcher .vm-info h3 {
    color: #00ff00;
    margin-bottom: 10px;
}

.vm-launcher .vm-info p {
    margin: 5px 0;
    line-height: 1.6;
}

.vm-launcher .vm-launch-button {
    background: #00aa00;
    color: #fff;
    border: 2px solid #000;
    padding: 10px 20px;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    width: 100%;
    margin-top: 20px;
}

.vm-launcher .vm-launch-button:hover {
    background: #00cc00;
}

.vm-launcher .vm-status {
    margin-top: 15px;
    padding: 10px;
    background: rgba(0,255,0,0.1);
    border: 2px solid #000;
    text-align: center;
}

/* Standalone mode terminal */
.vm-launcher.standalone-mode .terminal {
    background: #000;
    color: #00ff00;
    font-family: 'Courier New', monospace;
    border: 2px solid #00ff00;
}

.vm-launcher .terminal-header {
    background: #00aa00;
    color: #000;
    padding: 10px;
    font-weight: bold;
    border-bottom: 2px solid #000;
}

.vm-launcher .terminal-body {
    padding: 20px;
}

.vm-launcher .instructions {
    margin: 20px 0;
    padding: 15px;
    background: rgba(0,255,0,0.05);
    border: 2px solid #000;
}

.vm-launcher .instructions ol {
    margin-left: 20px;
}

.vm-launcher .instructions code {
    background: rgba(0,255,0,0.1);
    padding: 2px 6px;
    border: 2px solid #000;
}

.vm-launcher .postit-note {
    background: #ffeb3b;
    color: #000;
    padding: 10px;
    margin-top: 15px;
    border: 2px solid #000;
    font-family: 'Comic Sans MS', cursive;
}

.vm-launcher .terminal-button {
    background: #00aa00;
    color: #fff;
    border: 2px solid #000;
    padding: 10px 20px;
    margin-top: 20px;
    cursor: pointer;
    width: 100%;
}
```

### 2. Flag Station Styles

**File**: `public/break_escape/css/minigames/flag-station.css`

```css
/* Flag Station Minigame Styles */

.flag-station-minigame {
    padding: 20px;
}

.flag-terminal {
    background: #000;
    color: #00ff00;
    font-family: 'Courier New', monospace;
    border: 2px solid #00ff00;
    min-height: 400px;
}

.flag-terminal .terminal-header {
    background: #00aa00;
    color: #000;
    padding: 10px 15px;
    font-weight: bold;
    border-bottom: 2px solid #000;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.flag-terminal .flag-counter {
    font-size: 14px;
}

.flag-terminal .terminal-body {
    padding: 20px;
}

.flag-terminal .terminal-prompt {
    margin-bottom: 20px;
    line-height: 1.6;
}

.flag-input-area {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
}

.flag-input {
    flex: 1;
    background: #1a1a1a;
    border: 2px solid #00ff00;
    color: #00ff00;
    padding: 10px;
    font-family: 'Courier New', monospace;
    font-size: 14px;
}

.flag-input:focus {
    outline: none;
    background: #2a2a2a;
}

.flag-submit-btn {
    background: #00aa00;
    color: #000;
    border: 2px solid #000;
    padding: 10px 20px;
    font-weight: bold;
    cursor: pointer;
}

.flag-submit-btn:hover {
    background: #00cc00;
}

.flag-status {
    padding: 10px;
    margin-bottom: 20px;
    border: 2px solid #000;
    display: none;
}

.flag-status:not(:empty) {
    display: block;
}

.flag-status.success {
    background: rgba(0,255,0,0.1);
    color: #00ff00;
}

.flag-status.error {
    background: rgba(255,0,0,0.1);
    color: #ff0000;
    border-color: #ff0000;
}

.flag-status.warning {
    background: rgba(255,165,0,0.1);
    color: #ffaa00;
    border-color: #ffaa00;
}

.flag-status.info {
    background: rgba(0,150,255,0.1);
    color: #0096ff;
    border-color: #0096ff;
}

.submitted-flags {
    margin-top: 30px;
}

.submitted-flags h4 {
    color: #00ff00;
    margin-bottom: 10px;
}

.submitted-flags ul {
    list-style: none;
    padding: 0;
}

.submitted-flags .flag-submitted {
    padding: 8px;
    margin: 5px 0;
    background: rgba(0,255,0,0.05);
    border: 2px solid #000;
}

.all-flags-complete {
    margin-top: 20px;
    padding: 15px;
    background: rgba(0,255,0,0.2);
    border: 2px solid #00ff00;
    text-align: center;
    font-size: 18px;
}
```

---

## Testing Plan

### Phase 1: Database & Models (Week 1)

1. **Run Migrations**
   ```bash
   rails db:migrate
   ```

2. **Test Mission Model**
   - Create mission with `secgen_scenario`
   - Call `requires_vms?` → true
   - Call `valid_vm_sets_for_user(user)` → returns matching vm_sets (uses joins query)

3. **Test Game Model**
   - Create game with `vm_set_id` in player_state
   - Check `build_vm_context` populates VMs and flags
   - Submit flag via `submit_flag(flag_key)` → returns success
   - Check `flag_submitted?(flag_key)` → true

### Phase 2: Controllers & Views (Week 1)

1. **Test Game Creation with VM Set**
   - POST `/break_escape/games` with `mission_id` and `vm_set_id`
   - Verify game created with correct `player_state['vm_set_id']`
   - Verify `scenario_data` populated with VM context

2. **Test Flag Submission Endpoint**
   - POST `/break_escape/games/:id/flags` with valid flag
   - Check response includes `{ success: true, rewards: [...] }`
   - Verify flag added to `player_state['submitted_flags']`
   - POST same flag again → returns error

3. **Test `window.breakEscapeConfig`**
   - Load game show page
   - Verify `window.breakEscapeConfig.gameId` is set
   - Verify `window.breakEscapeConfig.hacktivityMode` is correct

### Phase 3: Client-Side Minigames (Week 2)

1. **Test VM Launcher (Hacktivity)**
   - Click object with `type: "vm-launcher"` in game
   - See monitor with VM details
   - Click "Launch VM" → downloads SPICE file
   - Verify URL: `/events/.../vms/:id/ovirt_console`

2. **Test VM Launcher (Standalone)**
   - Click `type: "vm-launcher"` object in standalone mode
   - See terminal with VirtualBox instructions
   - Click "Understood" → closes minigame

3. **Test Flag Station**
   - Click `type: "flag-station"` object
   - See terminal with flag input
   - Enter valid flag → shows success + rewards
   - Enter invalid flag → shows error
   - Submit all flags → shows completion message

### Phase 4: ERB Templates (Week 2)

1. **Create Test Scenario**
   - Create `scenarios/vm_test/scenario.json.erb`
   - Add objects with `type: "vm-launcher"` and `type: "flag-station"` using `vm_context`
   - Create game with VM set
   - Verify scenario_data populated with VM IDs

2. **Test Standalone Mode**
   - Create game without VM set
   - Manually enter flags via `standalone_flags` param
   - Verify `vm_context[:flags]` contains manual flags
   - Verify ERB outputs `null` for missing VM data (not parse errors)

### Phase 5: Integration Testing (Week 3)

1. **End-to-End Hacktivity Flow**
   - Create VM set in Hacktivity
   - Start mission with VM set
   - Launch VMs via in-game PCs
   - Find flags on VMs
   - Submit flags in game
   - Verify flags submitted via Hacktivity API (not direct model update)

2. **End-to-End Standalone Flow**
   - Start mission without VM set
   - Enter manual flags
   - Interact with VMs (instructions only)
   - Submit flags → validated against manual list

3. **Test Rewards**
   - Submit flag → receives item (check inventory update + event emitted)
   - Submit flag → door unlocks (check `door_unlocked_by_flag` event emitted)
   - Submit flag → NPC triggered (check custom event emitted)

---

## Implementation Checklist

### Phase 1: Database & Models
- [x] 1.1 ~~Create migration: Add `secgen_scenario` to missions~~ **(ALREADY EXISTS)**
- [ ] 1.2 Create migration: Remove unique constraint on games
- [ ] 1.3 Update Game model: Extend `initialize_player_state` to include `vm_set_id`, `submitted_flags`, `flag_rewards_claimed`
- [ ] 1.4 Run migrations
- [ ] 1.5 Update Mission model: Add `requires_vms?`, `valid_vm_sets_for_user`
- [ ] 1.6 Update Mission model: Extend `ScenarioBinding` with `vm_context`
- [ ] 1.7 Update Mission model: Update `generate_scenario_data` to accept vm_context
- [ ] 1.8 Update Game model: Add `build_vm_context` private method
- [ ] 1.9 Update Game model: Add `submit_flag`, `flag_submitted?` methods
- [ ] 1.10 Update Game model: Add `extract_valid_flags_from_scenario`, `submit_to_hacktivity` private methods
- [ ] 1.11 Write model tests

### Phase 2: Controllers & Views
- [ ] 2.1 **IMPLEMENT** GamesController `create` action (does NOT exist - must create from scratch)
- [ ] 2.2 **IMPLEMENT** GamesController `new` action (for VM set selection)
- [ ] 2.3 Add GamesController `submit_flag` action
- [ ] 2.4 Add GamesController helper methods: `find_flag_rewards`, `process_flag_rewards`, etc.
- [ ] 2.5 Add GamesController strong parameters: `game_create_params`
- [ ] 2.6 Update routes.rb: Add `:new` to games resource AND `post :flags` to member routes
- [ ] 2.7 **UPDATE** MissionsController `show` to redirect VM missions to games#new
- [ ] 2.8 Create `app/views/break_escape/games/new.html.erb` for VM set selection
- [ ] 2.9 Update missions index view to support VM set selection (optional)
- [ ] 2.10 EXTEND `window.breakEscapeConfig` in game show view (add `hacktivityMode`, `vmSetId`)
- [ ] 2.11 Update GamesController `scenario` action: Include `submittedFlags`
- [ ] 2.12 Add CSS link tags for new minigame styles to show.html.erb
- [ ] 2.13 Write controller tests

### Phase 3: Client-Side Minigames
- [ ] 3.1 Create `public/break_escape/js/minigames/vm-launcher/vm-launcher-minigame.js`
- [ ] 3.2 Create `public/break_escape/js/minigames/flag-station/flag-station-minigame.js`
- [ ] 3.3 Update `public/break_escape/js/minigames/index.js`: Register new minigames
- [ ] 3.4 Update `public/break_escape/js/systems/interactions.js`: Handle `type: "vm-launcher"` and `type: "flag-station"`
- [ ] 3.5 Create CSS: `public/break_escape/css/minigames/vm-launcher.css`
- [ ] 3.6 Create CSS: `public/break_escape/css/minigames/flag-station.css`
- [ ] 3.7 Add CSS link tags to `app/views/break_escape/games/show.html.erb`
- [ ] 3.8 Update `main.js` to populate `window.gameState.submittedFlags` from scenario response
- [ ] 3.9 Create test files: `test-vm-launcher-minigame.html`, `test-flag-station-minigame.html`
- [ ] 3.10 Test minigames standalone

### Phase 4: ERB Templates
- [ ] 4.1 Create example scenario: `scenarios/enterprise_breach/scenario.json.erb`
- [ ] 4.2 Add mission.json for example scenario
- [ ] 4.3 Test ERB vm_context access patterns with null-safe syntax
- [ ] 4.4 Update existing scenarios to support optional vm_context
- [ ] 4.5 Document ERB patterns in README

### Phase 5: Testing & Documentation
- [ ] 5.1 Write integration tests
- [ ] 5.2 Test Hacktivity mode end-to-end
- [ ] 5.3 Test standalone mode end-to-end
- [ ] 5.4 Test flag rewards (items, doors, events)
- [ ] 5.5 Update README.md
- [ ] 5.6 Create VM_AND_FLAGS_GUIDE.md documentation
- [ ] 5.7 Add example scenarios to docs
- [ ] 5.8 Record demo video

---

## Revised Implementation Order (After Review 3)

Based on Review 3 findings, the implementation order is revised to ensure controller infrastructure is in place before model changes depend on it:

### Phase 1: Controller Infrastructure (FIRST - Critical)
1. **Implement `games#create` action** (does NOT exist, must be created from scratch)
2. **Implement `games#new` action** (for VM set selection page)
3. **Update routes.rb** to add `:new` to games resource and `post :flags`
4. **Update `MissionsController#show`** to redirect VM missions to `games#new`
5. **Create `games/new.html.erb` view** for VM set selection

### Phase 2: Database Migration
1. Run migration to remove unique index on games
2. Verify existing games unaffected

### Phase 3: Model Changes
1. Rename `generate_scenario_data` → `generate_scenario_data_with_context` 
2. Add `build_vm_context` method
3. Extend `initialize_player_state` with VM/flag fields
4. Add flag submission methods

### Phase 4: Frontend & Minigames
1. Create VM launcher and flag station minigames
2. Update show.html.erb with extended config
3. Update interactions.js for new object types

### Phase 5: ERB Templates & Testing
1. Create example scenarios
2. End-to-end testing

**Key Insight**: The callback timing (`player_state` set before `save!`) is correct and sound. The issue was assuming `games#create` already existed.

---

## Risk Analysis

### High Risk
1. **Hacktivity API Changes**: Ovirt_console endpoint may change
   - **Mitigation**: Abstract VM launch logic into separate service class
   
2. **VM Set Matching Logic**: Incorrect vm_title matching
   - **Mitigation**: Use exact title match, document naming conventions

### Medium Risk
1. **ERB Nil Safety**: vm_context may be nil in standalone
   - **Mitigation**: Use safe navigation (`&.`) throughout ERB templates
   
2. **Flag Synchronization**: Flags in game vs Hacktivity out of sync
   - **Mitigation**: Track separately, add manual sync endpoint for admins

### Low Risk
1. **Multiple Games per Mission**: Performance with many game instances
   - **Mitigation**: Add pagination, indexes already in place

---

## Future Enhancements

1. **Real-Time Flag Updates**: ActionCable integration for live flag sync from Hacktivity
2. **Flag Hints System**: Progressive hints for stuck players
3. **Leaderboard**: Track fastest flag submission times
4. **VM State Monitoring**: Show VM power state in game
5. **Automated Flag Discovery**: Scan VMs for flags automatically (advanced)

---

## Summary

This plan provides a complete, actionable roadmap for integrating VMs and CTF flags into BreakEscape. The implementation:

- **Reuses existing patterns**: Minigame framework, server validation, NPC reward system
- **Supports both modes**: Hacktivity (with real VMs) and standalone (with manual flags)
- **Server-side validation**: All flags checked by Rails engine
- **Flexible rewards**: Items, door unlocks, NPC events, objectives
- **ERB-based customization**: VM data injected per game instance

**Estimated Timeline**: 3 weeks for full implementation and testing.

---

## Review History

| Date | Review | Changes Made |
|------|--------|--------------|
| 2025-11-27 | Review 1 (`review1/REVIEW.md`) | Fixed duplicate migration, corrected routes structure, fixed invalid AR query, updated ERB patterns for null safety, changed from `pcMode` to `type` property, corrected flag submission to use Hacktivity API, added `window.breakEscapeConfig` documentation |
| 2025-11-27 | Review 2 (`review2/REVIEW.md`) | Clarified to EXTEND breakEscapeConfig not replace, simplified Hacktivity flag submission (direct model update), added MissionsController#show update for VM missions, fixed function signature mismatch, added gameState.submittedFlags population note, added CSS link tags to checklist |
| 2025-11-27 | Review 3 (`review3/REVIEW.md`) | **Critical**: Discovered `games#create` action does NOT exist (routes declared it but controller didn't implement it). Updated plan to implement action from scratch. Added `games#new` action and view for VM set selection. Added MissionsController#show update. Validated callback timing approach is correct. Added revised implementation order prioritizing controller infrastructure. |
| 2025-11-28 | Hacktivity Compatibility (`review3/HACKTIVITY_COMPATIBILITY.md`) | **Reviewed Hacktivity codebase** for compatibility. Key findings: (1) Use `FlagService.process_flag()` instead of direct model update for proper scoring/streaks/notifications, (2) VmSet uses `sec_gen_batch` (with underscore) not `secgen_batch`, (3) VmSet has no `display_name` method - use `sec_gen_batch.title` instead, (4) Added `event_id` and `sec_gen_batch_id` to VM context for console URLs, (5) Added case-insensitive flag matching to match Hacktivity behavior, (6) Added eager loading with `.includes(:vms, :sec_gen_batch)`, (7) Filter out pending/error build_status VM sets. |
