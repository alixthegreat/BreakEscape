# VM and CTF Flag Integration - Implementation Plan

## Overview

This plan integrates VMs and CTF flag submission into BreakEscape. Players will interact with in-game PCs that represent VMs, launch them (via Hacktivity or locally), and submit flags found on those VMs for in-game progress and events.

**Key Requirements:**
- Feed VM/flag data into scenario JSON via ERB
- VM launcher minigame (Hacktivity SPICE download OR standalone VirtualBox instructions)
- Flag submission minigame with rewards (items, door unlocks, NPC events, objectives)
- Server-side validation of all flags via Rails engine
- Multiple game instances per mission (1 per VM set in Hacktivity, unlimited in standalone)

---

## Architecture Overview

### Data Flow

```
1. User clicks "Start Mission" → Mission Start Dialog
2. Dialog collects:
   - Player handle (auto-filled from DB/current_user)
   - VM set ID (Hacktivity mode) OR manual flag list (standalone)
   - Completed missions list (for narrative customization)
3. Game.create! triggers:
   - generate_scenario_data (Mission.generate_scenario_data with VM context)
   - ScenarioBinding receives vm_context hash
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
   - POST `/games/:id/flags` validates flag
   - Server checks `vm_set.vms.flags` or standalone `scenario_data['flags']`

3. **Rewards System**: Reuse NPC item-giving and door-unlocking patterns
   - Item rewards → `game.add_inventory_item!` + event emission
   - Door unlocks → `game.unlock_room!` + sprite updates
   - NPC triggers → emit event `flag_submitted:flag_id`

4. **ERB Context Injection**: Extend `Mission::ScenarioBinding`
   - Add `@vm_context` hash with VMs and flags
   - Access via `<%= vm_context[:vms].find {|v| v[:title] == 'desktop' } %>`

---

## Database Changes

### Schema Updates

#### 1. Update `break_escape_missions` Table

Add `secgen_scenario` column to track which missions require VMs.

```ruby
# db/migrate/[timestamp]_add_secgen_scenario_to_missions.rb
class AddSecgenScenarioToMissions < ActiveRecord::Migration[7.0]
  def change
    add_column :break_escape_missions, :secgen_scenario, :string
    add_index :break_escape_missions, :secgen_scenario
  end
end
```

**Reasoning**: Missions with `secgen_scenario` defined require VM sets to instantiate. Missions without this can be played standalone.

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
  ::VmSet.where(
    sec_gen_batch: { scenario: secgen_scenario },
    user: user,
    relinquished: false
  ).includes(:vms)
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

#### Update Callback to Accept VM Context

```ruby
# Replace existing before_create callback
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
      if obj['pcMode'] == 'flags' && obj['flags'].present?
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
  
  # Find the flag in the vm_set and mark it solved
  vm_set.vms.each do |vm|
    flag = vm.flags.find_by(flag_key: flag_key)
    next unless flag
    
    flag.update(solved: true, solved_date: Time.current)
    Rails.logger.info "[BreakEscape] Submitted flag #{flag_key} to Hacktivity for vm_set #{vm_set.id}"
  end
end
```

---

## Controller Changes

### 1. Missions Controller (`app/controllers/break_escape/missions_controller.rb`)

#### Update `show` Action

Replace auto-create game behavior with redirect to start dialog.

```ruby
def show
  @mission = Mission.find(params[:id])
  authorize @mission if defined?(Pundit)
  
  # NEW: Redirect to start dialog instead of auto-creating game
  # This allows user to select VM set or enter flags
end
```

#### Add `start` Action (NEW)

Show mission start dialog.

```ruby
def start
  @mission = Mission.find(params[:id])
  authorize @mission if defined?(Pundit)
  
  # Fetch player handle
  @player_handle = current_player.try(:handle) || current_player.try(:name) || 'Player'
  
  # Fetch VM sets if Hacktivity mode and mission requires VMs
  @vm_sets = if defined?(::VmSet) && @mission.requires_vms?
               @mission.valid_vm_sets_for_user(current_user)
             else
               []
             end
  
  # Check how many flags the mission expects (read from mission.json or scenario)
  @expected_flag_count = @mission.load_mission_metadata&.dig('expected_flag_count') || 0
  
  render :start # renders app/views/break_escape/missions/start.html.erb
end
```

#### Add `create_game` Action (NEW)

Handle game creation with VM context.

```ruby
def create_game
  @mission = Mission.find(params[:mission_id])
  authorize @mission if defined?(Pundit)
  
  # Build player_state with VM/flag context
  initial_player_state = Game::DEFAULT_PLAYER_STATE.dup
  
  # Hacktivity mode with VM set
  if params[:vm_set_id].present?
    vm_set = ::VmSet.find(params[:vm_set_id])
    authorize vm_set, :use? if defined?(Pundit)
    
    initial_player_state[:vm_set_id] = vm_set.id
  end
  
  # Standalone mode with manual flags
  if params[:standalone_flags].present?
    flags = params[:standalone_flags].split(',').map(&:strip).reject(&:blank?)
    initial_player_state[:standalone_flags] = flags
  end
  
  # Create game with custom player_state
  @game = Game.create!(
    player: current_player,
    mission: @mission,
    player_state: initial_player_state
  )
  
  redirect_to game_path(@game)
end
```

### 2. Games Controller (`app/controllers/break_escape/games_controller.rb`)

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
      next unless obj['pcMode'] == 'flags'
      next unless obj['flags']&.include?(flag_key)
      
      # Find index of this flag
      flag_index = obj['flags'].index(flag_key)
      
      # Get corresponding reward (rewards array matches flags array by index)
      if obj['flagRewards'] && obj['flagRewards'][flag_index]
        rewards << obj['flagRewards'][flag_index].merge(
          flag_station_id: obj['id'] || obj['name'],
          room_id: room_id
        )
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
      return obj if (obj['id'] || obj['name']) == flag_station_id && obj['pcMode'] == 'flags'
    end
  end
  nil
end
```

### 3. Add Route

```ruby
# config/routes.rb
namespace :break_escape, path: 'break_escape' do
  resources :missions, only: [:index, :show] do
    member do
      get :start           # NEW: Show start dialog
      post :create_game    # NEW: Create game with VM context
    end
  end
  
  resources :games, only: [:show, :destroy] do
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
      post :flags          # NEW: Submit flag
    end
  end
end
```

---

## View Changes

### 1. Mission Start Dialog (`app/views/break_escape/missions/start.html.erb`)

Create new view for mission start configuration.

```erb
<div class="mission-start-container">
  <h1>Start Mission: <%= @mission.display_name %></h1>
  
  <div class="mission-description">
    <%= @mission.description %>
  </div>
  
  <%= form_with url: create_game_break_escape_mission_path(@mission), method: :post, local: true do |f| %>
    
    <!-- Player Handle (auto-filled, read-only) -->
    <div class="form-group">
      <label>Player Handle</label>
      <input type="text" value="<%= @player_handle %>" readonly class="form-control" />
    </div>
    
    <!-- VM Set Selection (Hacktivity mode only) -->
    <% if @vm_sets.any? %>
      <div class="form-group">
        <label>Select VM Set</label>
        <%= f.select :vm_set_id, 
            options_from_collection_for_select(@vm_sets, :id, :secgen_prefix),
            { prompt: 'Choose your VM set...' },
            { class: 'form-control', required: true } %>
        <small class="form-text">
          You need an active VM set for <%= @mission.secgen_scenario %> to play this mission.
        </small>
      </div>
    <% elsif @mission.requires_vms? %>
      <div class="alert alert-warning">
        This mission requires VMs from scenario <%= @mission.secgen_scenario %>.
        You don't have any active VM sets. Please create one first.
      </div>
    <% end %>
    
    <!-- Standalone Flag Entry (standalone mode only) -->
    <% if !@mission.requires_vms? || @vm_sets.empty? %>
      <div class="form-group">
        <label>Flags (Standalone Mode)</label>
        <%= f.text_area :standalone_flags, 
            placeholder: "flag{example1}, flag{example2}",
            class: 'form-control',
            rows: 3 %>
        <small class="form-text">
          Enter flags separated by commas. Expected: <%= @expected_flag_count %> flags.
        </small>
      </div>
    <% end %>
    
    <!-- Submit Button -->
    <div class="form-actions">
      <%= f.submit "Start Mission", class: "btn btn-primary" %>
      <%= link_to "Cancel", break_escape_missions_path, class: "btn btn-secondary" %>
    </div>
    
  <% end %>
</div>
```

**Styling**: Add CSS to `app/assets/stylesheets/break_escape/missions.css` (or create if missing).

### 2. Update Missions Index

Update `app/views/break_escape/missions/index.html.erb` to link to start dialog instead of direct game creation.

```erb
<!-- Change from: -->
<%= link_to "Play", break_escape_mission_path(mission) %>

<!-- To: -->
<%= link_to "Start Mission", start_break_escape_mission_path(mission), class: "btn btn-primary" %>
```

---

## Scenario ERB Template Updates

### Example Scenario with VMs and Flags

**File**: `scenarios/enterprise_breach/scenario.json.erb`

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
        {
          "type": "pc-kali",
          "name": "Kali Attack System",
          "pcMode": "vm-launcher",
          <% kali_vm = vm_context[:vms]&.find { |v| v[:title]&.downcase&.include?('kali') } %>
          <% if kali_vm %>
          "vm_title": "<%= kali_vm[:title] %>",
          "vm_set_id": <%= kali_vm[:vm_set_id] %>,
          "vm_id": <%= kali_vm[:id] %>,
          "vm_description": "<%= kali_vm[:description] %>",
          "vm_ip_address": "<%= kali_vm[:ip_address] %>",
          <% end %>
          "observations": "A Kali Linux attack box for network penetration",
          "postitNote": "Use this to scan the network. IP: <%= kali_vm[:ip_address] rescue 'See VirtualBox' %>",
          "showPostit": true,
          "takeable": false,
          "interactable": true
        },
        
        <%# Flag Submission Station %>
        {
          "type": "pc-flag",
          "name": "Exfiltration Drop-Site",
          "pcMode": "flags",
          <% desktop_vm = vm_context[:vms]&.find { |v| v[:title]&.downcase&.include?('desktop') } %>
          <% if desktop_vm %>
          "vm_title": "<%= desktop_vm[:title] %>",
          "vm_set_id": <%= desktop_vm[:vm_set_id] %>,
          "vm_id": <%= desktop_vm[:id] %>,
          <% end %>
          "observations": "Secure terminal for submitting discovered intelligence",
          "flags": <%= vm_context[:flags].to_json %>,
          "flagRewards": [
            <%# First flag unlocks door to vault %>
            {
              "type": "unlock_door",
              "room_id": "vault"
            },
            <%# Second flag gives lockpick %>
            {
              "type": "give_item",
              "item_type": "lockpick",
              "item_name": "Professional Lockpick Set"
            },
            <%# Third flag triggers NPC event %>
            {
              "type": "emit_event",
              "event_name": "flag_submitted:third_flag"
            }
          ],
          "itemsHeld": [
            {
              "type": "lockpick",
              "name": "Professional Lockpick Set",
              "takeable": true,
              "observations": "A high-quality lockpick kit"
            },
            {
              "type": "keycard",
              "name": "Vault Access Card",
              "takeable": true,
              "observations": "Grants access to the vault"
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

**Key ERB Patterns:**
- Access VMs via `vm_context[:vms]`
- Find specific VM by title: `vm_context[:vms]&.find { |v| v[:title]&.include?('kali') }`
- Access all flags: `vm_context[:flags]`
- Use safe navigation (`&.`) to handle nil in standalone mode

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

Update to handle `pcMode` types.

```javascript
// In handleObjectInteraction function, add:

if (object.scenarioData.type?.startsWith('pc-') && object.scenarioData.pcMode) {
    switch (object.scenarioData.pcMode) {
        case 'vm-launcher':
            handleVMLauncher(object);
            break;
            
        case 'flags':
            handleFlagStation(object);
            break;
            
        default:
            // Existing desktop/container logic
            window.handleContainerInteraction(object);
    }
    return;
}

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
    // Fetch submitted flags from server
    const gameId = window.breakEscapeConfig?.gameId;
    let submittedFlags = [];
    
    if (gameId) {
        try {
            const response = await fetch(`/break_escape/games/${gameId}/scenario`);
            const data = await response.json();
            submittedFlags = data.submittedFlags || [];
        } catch (error) {
            console.error('Failed to fetch submitted flags:', error);
        }
    }
    
    window.startFlagStationMinigame(pcObject.scenarioData, submittedFlags);
}
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
   - Call `valid_vm_sets_for_user(user)` → returns matching vm_sets

3. **Test Game Model**
   - Create game with `vm_set_id` in player_state
   - Check `build_vm_context` populates VMs and flags
   - Submit flag via `submit_flag(flag_key)` → returns success
   - Check `flag_submitted?(flag_key)` → true

### Phase 2: Controllers & Views (Week 1)

1. **Test Mission Start Dialog**
   - Visit `/break_escape/missions/:id/start`
   - See player handle pre-filled
   - See VM set dropdown (Hacktivity) OR flag textarea (standalone)
   - Submit form → creates game with correct player_state

2. **Test Flag Submission Endpoint**
   - POST `/break_escape/games/:id/flags` with valid flag
   - Check response includes `{ success: true, rewards: [...] }`
   - Verify flag added to `player_state['submitted_flags']`
   - POST same flag again → returns error

### Phase 3: Client-Side Minigames (Week 2)

1. **Test VM Launcher (Hacktivity)**
   - Click pc-kali object in game
   - See monitor with VM details
   - Click "Launch VM" → downloads SPICE file
   - Verify URL: `/events/.../vms/:id/ovirt_console`

2. **Test VM Launcher (Standalone)**
   - Click pc-kali object in standalone mode
   - See terminal with VirtualBox instructions
   - Click "Understood" → closes minigame

3. **Test Flag Station**
   - Click pc-flag object
   - See terminal with flag input
   - Enter valid flag → shows success + rewards
   - Enter invalid flag → shows error
   - Submit all flags → shows completion message

### Phase 4: ERB Templates (Week 2)

1. **Create Test Scenario**
   - Create `scenarios/vm_test/scenario.json.erb`
   - Add pc-kali and pc-flag objects using `vm_context`
   - Create game with VM set
   - Verify scenario_data populated with VM IDs

2. **Test Standalone Mode**
   - Create game without VM set
   - Manually enter flags in start dialog
   - Verify `vm_context[:flags]` contains manual flags

### Phase 5: Integration Testing (Week 3)

1. **End-to-End Hacktivity Flow**
   - Create VM set in Hacktivity
   - Start mission with VM set
   - Launch VMs via in-game PCs
   - Find flags on VMs
   - Submit flags in game
   - Verify flags marked solved in Hacktivity

2. **End-to-End Standalone Flow**
   - Start mission without VM set
   - Enter manual flags
   - Interact with VMs (instructions only)
   - Submit flags → validated against manual list

3. **Test Rewards**
   - Submit flag → receives item
   - Submit flag → door unlocks
   - Submit flag → NPC triggered

---

## Implementation Checklist

### Phase 1: Database & Models ✓
- [ ] 1.1 Create migration: Add `secgen_scenario` to missions
- [ ] 1.2 Create migration: Remove unique constraint on games
- [ ] 1.3 Update games migration: Add `vm_set_id`, `submitted_flags`, `flag_rewards_claimed` to player_state default
- [ ] 1.4 Run migrations
- [ ] 1.5 Update Mission model: Add `requires_vms?`, `valid_vm_sets_for_user`
- [ ] 1.6 Update Mission model: Extend `ScenarioBinding` with `vm_context`
- [ ] 1.7 Update Mission model: Update `generate_scenario_data` to accept vm_context
- [ ] 1.8 Update Game model: Add `build_vm_context` private method
- [ ] 1.9 Update Game model: Add `submit_flag`, `flag_submitted?` methods
- [ ] 1.10 Update Game model: Add `extract_valid_flags_from_scenario`, `submit_to_hacktivity` private methods
- [ ] 1.11 Write model tests

### Phase 2: Controllers & Views ✓
- [ ] 2.1 Update MissionsController `show` action
- [ ] 2.2 Add MissionsController `start` action
- [ ] 2.3 Add MissionsController `create_game` action
- [ ] 2.4 Add GamesController `submit_flag` action
- [ ] 2.5 Add GamesController helper methods: `find_flag_rewards`, `process_flag_rewards`, etc.
- [ ] 2.6 Update routes.rb: Add start, create_game, flags routes
- [ ] 2.7 Create view: `app/views/break_escape/missions/start.html.erb`
- [ ] 2.8 Update view: `app/views/break_escape/missions/index.html.erb`
- [ ] 2.9 Add CSS: `app/assets/stylesheets/break_escape/missions.css`
- [ ] 2.10 Update GamesController `scenario` action: Include submitted_flags
- [ ] 2.11 Write controller tests

### Phase 3: Client-Side Minigames ✓
- [ ] 3.1 Create `public/break_escape/js/minigames/vm-launcher/vm-launcher-minigame.js`
- [ ] 3.2 Create `public/break_escape/js/minigames/flag-station/flag-station-minigame.js`
- [ ] 3.3 Update `public/break_escape/js/minigames/index.js`: Register new minigames
- [ ] 3.4 Update `public/break_escape/js/systems/interactions.js`: Handle pcMode types
- [ ] 3.5 Create CSS: `public/break_escape/css/minigames/vm-launcher.css`
- [ ] 3.6 Create CSS: `public/break_escape/css/minigames/flag-station.css`
- [ ] 3.7 Create HTML test files for minigames
- [ ] 3.8 Test minigames standalone

### Phase 4: ERB Templates ✓
- [ ] 4.1 Create example scenario: `scenarios/enterprise_breach/scenario.json.erb`
- [ ] 4.2 Add mission.json for example scenario
- [ ] 4.3 Test ERB vm_context access patterns
- [ ] 4.4 Update existing scenarios to support optional vm_context
- [ ] 4.5 Document ERB patterns in README

### Phase 5: Testing & Documentation ✓
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
