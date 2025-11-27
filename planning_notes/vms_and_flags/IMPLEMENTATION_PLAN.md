# VM and CTF Flag Integration - Implementation Plan

**Last Updated**: After Review 1 (2025-11-27)  
**Review Document**: `planning_notes/vms_and_flags/review1/REVIEW.md`

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
- Use existing `games#create` action pattern for game creation
- Flag submission to Hacktivity should use POST `/vms/auto_flag_submit` API endpoint

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

The game view MUST set `window.breakEscapeConfig` before game initialization:

```javascript
// Set in app/views/break_escape/games/show.html.erb
window.breakEscapeConfig = {
  gameId: <%= @game.id %>,
  hacktivityMode: <%= BreakEscape::Mission.hacktivity_mode? %>,
  vmSetId: <%= @game.player_state['vm_set_id'] || 'null' %>
};
```

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
def valid_vm_sets_for_user(user)
  return [] unless self.class.hacktivity_mode? && requires_vms?
  
  # Query Hacktivity's vm_sets where:
  # - scenario matches
  # - user owns it
  # - not relinquished
  # NOTE: Must use joins for nested association query
  ::VmSet.joins(:sec_gen_batch)
         .where(sec_gen_batches: { scenario: secgen_scenario })
         .where(user: user, relinquished: false)
         .includes(:vms)
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
  if player_state['vm_set_id'].present? && defined?(::VmSet)
    vm_set = ::VmSet.find_by(id: player_state['vm_set_id'])
    if vm_set
      context[:vms] = vm_set.vms.map do |vm|
        {
          id: vm.id,
          title: vm.title,
          description: vm.description,
          ip_address: vm.ip_address,
          vm_set_id: vm_set.id
        }
      end
      
      # Extract flags from VMs
      context[:flags] = vm_set.vms.flat_map do |vm|
        vm.flags.map(&:flag_key)
      end
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
  
  unless valid_flags.include?(flag_key)
    return { success: false, message: 'Invalid flag' }
  end
  
  # Mark flag as submitted
  player_state['submitted_flags'] ||= []
  player_state['submitted_flags'] << flag_key
  save!
  
  # Submit to Hacktivity if in that mode
  submit_to_hacktivity(flag_key) if player_state['vm_set_id'].present?
  
  { success: true, message: 'Flag accepted', flag: flag_key }
end

def flag_submitted?(flag_key)
  player_state['submitted_flags']&.include?(flag_key)
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

def submit_to_hacktivity(flag_key)
  return unless defined?(::VmSet) && player_state['vm_set_id'].present?
  
  vm_set = ::VmSet.find_by(id: player_state['vm_set_id'])
  return unless vm_set
  
  # Find the flag in the vm_set
  vm_set.vms.each do |vm|
    flag = vm.flags.find_by(flag_key: flag_key)
    next unless flag
    
    # Use Hacktivity's auto_flag_submit API endpoint for proper scoring
    # POST /vms/auto_flag_submit (JSON API)
    begin
      # Hacktivity::FlagSubmissionService handles scoring, validation, etc.
      Hacktivity::FlagSubmissionService.new(
        flag: flag,
        user: player # or current_user via controller context
      ).submit!
      
      Rails.logger.info "[BreakEscape] Submitted flag #{flag_key} to Hacktivity via API for vm_set #{vm_set.id}"
    rescue => e
      Rails.logger.error "[BreakEscape] Failed to submit flag to Hacktivity: #{e.message}"
      # Flag is still marked submitted in BreakEscape even if Hacktivity sync fails
    end
    
    return # Only submit once
  end
end
```

---

## Controller Changes

### 1. Games Controller (`app/controllers/break_escape/games_controller.rb`)

#### Update `create` Action (Existing)

The existing `games#create` action handles game creation. Extend it to accept VM context:

```ruby
# In existing create action
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
  
  # Create game - callbacks will handle scenario generation with VM context
  @game = Game.new(
    player: current_player,
    mission: @mission
  )
  @game.player_state = initial_player_state
  @game.save!
  
  redirect_to game_path(@game)
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
  
  resources :games, only: [:show, :create] do
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
Games are created via `games#create` (POST /break_escape/games) with `mission_id` parameter.

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
  
  <% if mission.requires_vms? && @vm_sets_by_mission[mission.id]&.any? %>
    <div class="vm-set-selection">
      <label>Select VM Set:</label>
      <%= f.select :vm_set_id, 
          options_from_collection_for_select(@vm_sets_by_mission[mission.id], :id, :display_name),
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

**IMPORTANT**: Set `window.breakEscapeConfig` in the game show view:

```erb
<%# app/views/break_escape/games/show.html.erb %>
<script>
  window.breakEscapeConfig = {
    gameId: <%= @game.id %>,
    hacktivityMode: <%= BreakEscape::Mission.hacktivity_mode? %>,
    vmSetId: <%= @game.player_state['vm_set_id'] || 'null' %>,
    playerHandle: "<%= j(@game.player.try(:handle) || @game.player.try(:name) || 'Player') %>"
  };
</script>
```
    
**Styling**: Add CSS to `app/assets/stylesheets/break_escape/` directory as needed.

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
    
    // Filter expected flags to only those for THIS flag station
    const flagStationId = pcObject.scenarioData.id || pcObject.scenarioData.name;
    const expectedFlags = pcObject.scenarioData.flags || [];
    
    window.startFlagStationMinigame({
        ...pcObject.scenarioData,
        id: flagStationId
    }, submittedFlags, expectedFlags);
}
```

**Note**: Using `type: "vm-launcher"` and `type: "flag-station"` directly is consistent with existing patterns like `type: "workstation"`, `type: "notepad"`, etc.
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
- [ ] 2.1 Update GamesController `create` action to accept `vm_set_id` and `standalone_flags` params
- [ ] 2.2 Add GamesController `submit_flag` action
- [ ] 2.3 Add GamesController helper methods: `find_flag_rewards`, `process_flag_rewards`, etc.
- [ ] 2.4 Update routes.rb: Add `post :flags` to games member routes
- [ ] 2.5 Update missions index view to support VM set selection
- [ ] 2.6 Add `window.breakEscapeConfig` to game show view (critical for client)
- [ ] 2.7 Update GamesController `scenario` action: Include `submittedFlags`
- [ ] 2.8 Write controller tests

### Phase 3: Client-Side Minigames
- [ ] 3.1 Create `public/break_escape/js/minigames/vm-launcher/vm-launcher-minigame.js`
- [ ] 3.2 Create `public/break_escape/js/minigames/flag-station/flag-station-minigame.js`
- [ ] 3.3 Update `public/break_escape/js/minigames/index.js`: Register new minigames
- [ ] 3.4 Update `public/break_escape/js/systems/interactions.js`: Handle `type: "vm-launcher"` and `type: "flag-station"`
- [ ] 3.5 Create CSS: `public/break_escape/css/minigames/vm-launcher.css`
- [ ] 3.6 Create CSS: `public/break_escape/css/minigames/flag-station.css`
- [ ] 3.7 Create test files: `test-vm-launcher-minigame.html`, `test-flag-station-minigame.html`
- [ ] 3.8 Test minigames standalone

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
