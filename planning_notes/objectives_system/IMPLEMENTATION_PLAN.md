# Mission Objectives System - Implementation Plan

> **Version**: 1.1 (Updated with codebase review corrections)  
> **Related Files**: `TODO_CHECKLIST.md`, `QUICK_REFERENCE.md`  
> **Review Details**: See `review1/` folder for detailed codebase analysis

## Overview

A two-tier objective tracking system with **Aims** (high-level goals) and **Tasks** (actionable steps). Objectives are displayed in a persistent HUD panel (top-right), tracked in game state, and validated by the server where practical.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        SCENARIO JSON                            │
│  objectives: [{ aimId, title, tasks: [{ taskId, title, ... }]}] │
└───────────────────────────────┬─────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Client-Side   │     │  Server-Side    │     │  UI Layer       │
│ ObjectivesMgr │◄───►│  Game Model     │     │  ObjectivesPanel│
│ (tracking,    │     │  (validation,   │     │  (display,      │
│  events,      │     │   persistence)  │     │   animations)   │
│  conditions)  │     │                 │     │                 │
└───────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        └───────────────────────┘
           Event-based updates
```

### Key Integration Points

1. **Initialization**: ObjectivesManager created in `main.js`, but data loaded in `game.js create()` after scenario JSON available
2. **Event System**: Uses `NPCEventDispatcher` with wildcard support (`item_picked_up:*`)
3. **Server Sync**: Uses existing `/break_escape/games/:id/` route structure
4. **State Restoration**: `objectivesState` passed in scenario bootstrap for page reload recovery

---

## Data Model

### Scenario JSON Schema

```json
{
  "scenario_brief": "...",
  "startRoom": "reception",
  "objectives": [
    {
      "aimId": "collect_intel",
      "title": "Collect intel on ENTROPY",
      "description": "Gather LORE fragments hidden throughout the facility",
      "status": "active",
      "order": 1,
      "tasks": [
        {
          "taskId": "find_lore_fragments",
          "title": "Find intel LORE fragments",
          "type": "collect_items",
          "targetItems": ["lore_fragment"],
          "targetCount": 5,
          "currentCount": 0,
          "status": "active",
          "showProgress": true
        }
      ]
    },
    {
      "aimId": "stop_agent",
      "title": "Stop ENTROPY's secret agent",
      "status": "locked",
      "unlockCondition": { "aimCompleted": "collect_intel" },
      "order": 2,
      "tasks": [
        {
          "taskId": "find_evidence",
          "title": "Find evidence of agent identity",
          "type": "collect_items",
          "targetItems": ["evidence_document", "surveillance_photo"],
          "targetCount": 2,
          "currentCount": 0,
          "status": "active",
          "onComplete": {
            "unlockTask": "confront_agent"
          }
        },
        {
          "taskId": "confront_agent",
          "title": "Confront the agent",
          "type": "npc_conversation",
          "targetNpc": "suspect_npc",
          "targetKnot": "confrontation",
          "status": "locked"
        }
      ]
    },
    {
      "aimId": "stop_plan",
      "title": "Stop ENTROPY's plan",
      "status": "locked",
      "order": 3,
      "tasks": [
        {
          "taskId": "access_office",
          "title": "Gain access to the office room",
          "type": "unlock_room",
          "targetRoom": "office",
          "status": "active",
          "onComplete": { "unlockTask": "access_server_room" }
        },
        {
          "taskId": "access_server_room",
          "title": "Gain access to the server room",
          "type": "unlock_room",
          "targetRoom": "server_room",
          "status": "locked",
          "onComplete": { "unlockTask": "access_server" }
        },
        {
          "taskId": "access_server",
          "title": "Access the server",
          "type": "unlock_object",
          "targetObject": "main_server",
          "status": "locked"
        }
      ]
    },
    {
      "aimId": "prepare_mission",
      "title": "Prepare for the mission",
      "status": "active",
      "order": 0,
      "tasks": [
        {
          "taskId": "speak_to_handler",
          "title": "Speak to your handler",
          "type": "npc_conversation",
          "targetNpc": "handler_npc",
          "status": "active"
        }
      ]
    }
  ],
  "rooms": { ... }
}
```

### Task Types

| Type | Trigger | Server Validation | Client Detection |
|------|---------|-------------------|------------------|
| `collect_items` | Item added to inventory | Inventory API validates item | `item_picked_up:*` wildcard event |
| `unlock_room` | Room door unlocked | Unlock API validates | `door_unlocked` event (provides `connectedRoom`) |
| `unlock_object` | Container/object unlocked | Unlock API validates | `item_unlocked` event (NOT `object_unlocked`) |
| `npc_conversation` | Ink tag `#complete_task:taskId` | Server checks NPC encountered | `task_completed_by_npc` event |
| `enter_room` | Player enters room | Room access already tracked | `room_entered` event |
| `custom` | Ink tag `#complete_task:taskId` | Optional server validation | Tag processing |

> **IMPORTANT EVENT NAMES**: The codebase uses `item_unlocked` (not `object_unlocked`) in `unlock-system.js` line 587. The `door_unlocked` event provides `connectedRoom` property (not `roomId`).

---

## Server-Side Implementation

### 1. Database Schema (Migration)

**File:** `db/migrate/XXXXXX_add_objectives_to_games.rb`

```ruby
class AddObjectivesToGames < ActiveRecord::Migration[7.0]
  def change
    # Objectives stored in player_state JSONB (already exists)
    # Add helper columns for quick queries
    add_column :break_escape_games, :objectives_completed, :integer, default: 0
    add_column :break_escape_games, :tasks_completed, :integer, default: 0
  end
end
```

### 2. Game Model Extensions

**File:** `app/models/break_escape/game.rb` (add methods)

```ruby
# Objective management
def initialize_objectives
  return unless scenario_data['objectives'].present?
  
  player_state['objectives'] ||= {
    'aims' => {},      # { aimId: { status, completedAt } }
    'tasks' => {},     # { taskId: { status, progress, completedAt } }
    'itemCounts' => {} # { itemType: count } for collect objectives
  }
end

def complete_task!(task_id, validation_data = {})
  task = find_task_in_scenario(task_id)
  return { success: false, error: 'Task not found' } unless task
  
  # Validate based on task type
  case task['type']
  when 'collect_items'
    return { success: false, error: 'Insufficient items' } unless validate_collection(task)
  when 'unlock_room'
    return { success: false, error: 'Room not unlocked' } unless room_unlocked?(task['targetRoom'])
  when 'unlock_object'
    return { success: false, error: 'Object not unlocked' } unless object_unlocked?(task['targetObject'])
  when 'npc_conversation'
    return { success: false, error: 'NPC not encountered' } unless npc_encountered?(task['targetNpc'])
  end
  
  # Mark complete
  player_state['objectives']['tasks'][task_id] = {
    'status' => 'completed',
    'completedAt' => Time.current.iso8601
  }
  
  # Process onComplete actions
  process_task_completion(task)
  
  # Check if aim is now complete
  check_aim_completion(task['aimId'])
  
  save!
  { success: true, taskId: task_id }
end

def update_task_progress!(task_id, progress)
  player_state['objectives'] ||= { 'tasks' => {} }
  player_state['objectives']['tasks'][task_id] ||= {}
  player_state['objectives']['tasks'][task_id]['progress'] = progress
  save!
end

def aim_status(aim_id)
  player_state.dig('objectives', 'aims', aim_id, 'status') || 'active'
end

def task_status(task_id)
  player_state.dig('objectives', 'tasks', task_id, 'status') || 'active'
end

def task_progress(task_id)
  player_state.dig('objectives', 'tasks', task_id, 'progress') || 0
end

private

def validate_collection(task)
  inventory = player_state['inventory'] || []
  target_items = Array(task['targetItems'])
  count = inventory.count { |item| target_items.include?(item['type'] || item.dig('scenarioData', 'type')) }
  count >= (task['targetCount'] || 1)
end

def npc_encountered?(npc_id)
  player_state['encounteredNPCs']&.include?(npc_id)
end

def process_task_completion(task)
  return unless task['onComplete']
  
  if task['onComplete']['unlockTask']
    unlock_task!(task['onComplete']['unlockTask'])
  end
  
  if task['onComplete']['unlockAim']
    unlock_aim!(task['onComplete']['unlockAim'])
  end
end

def unlock_task!(task_id)
  player_state['objectives']['tasks'][task_id] ||= {}
  player_state['objectives']['tasks'][task_id]['status'] = 'active'
end

def unlock_aim!(aim_id)
  player_state['objectives']['aims'][aim_id] ||= {}
  player_state['objectives']['aims'][aim_id]['status'] = 'active'
end

def check_aim_completion(aim_id)
  aim = scenario_data['objectives'].find { |a| a['aimId'] == aim_id }
  return unless aim
  
  all_complete = aim['tasks'].all? do |task|
    task_status(task['taskId']) == 'completed'
  end
  
  if all_complete
    player_state['objectives']['aims'][aim_id] = {
      'status' => 'completed',
      'completedAt' => Time.current.iso8601
    }
    self.objectives_completed += 1
  end
end

def find_task_in_scenario(task_id)
  scenario_data['objectives']&.each do |aim|
    task = aim['tasks']&.find { |t| t['taskId'] == task_id }
    return task.merge('aimId' => aim['aimId']) if task
  end
  nil
end
```

### 3. API Endpoints

**File:** `config/routes.rb` (add to games resource)

```ruby
resources :games do
  member do
    # ... existing routes ...
    get 'objectives'                       # Get current objective state
    post 'objectives/tasks/:task_id',      # Complete a specific task
         to: 'games#complete_task',
         as: 'complete_task'
    put 'objectives/tasks/:task_id',       # Update task progress
        to: 'games#update_task_progress',
        as: 'update_task_progress'
  end
end
```

> **NOTE**: Using RESTful routes with `task_id` in path (not request body) for clarity and cacheability.

**File:** `app/controllers/break_escape/games_controller.rb` (add actions)

```ruby
# GET /games/:id/objectives
def objectives
  authorize @game if defined?(Pundit)
  
  render json: {
    objectives: @game.scenario_data['objectives'],
    state: @game.player_state['objectives'] || {}
  }
end

# POST /games/:id/objectives/tasks/:task_id
def complete_task
  authorize @game if defined?(Pundit)
  
  task_id = params[:task_id]
  result = @game.complete_task!(task_id, params[:validation_data])
  
  if result[:success]
    render json: result
  else
    render json: result, status: :unprocessable_entity
  end
end

# PUT /games/:id/objectives/tasks/:task_id
def update_task_progress
  authorize @game if defined?(Pundit)
  
  task_id = params[:task_id]
  progress = params[:progress].to_i
  
  @game.update_task_progress!(task_id, progress)
  render json: { success: true, taskId: task_id, progress: progress }
end
```

### 4. Scenario Bootstrap (State Restoration)

**Update:** `scenario` action to include objectives state for page reload recovery:

```ruby
# GET /games/:id/scenario
def scenario
  authorize @game if defined?(Pundit)

  begin
    filtered = @game.filtered_scenario_for_bootstrap
    filter_requires_recursive(filtered)
    
    # Include objectives state for restoration on page reload
    if @game.player_state['objectives'].present?
      filtered['objectivesState'] = @game.player_state['objectives']
    end

    render json: filtered
  rescue => e
    Rails.logger.error "[BreakEscape] scenario error: #{e.message}"
    render_error("Failed to generate scenario: #{e.message}", :internal_server_error)
  end
end
```

### 5. Sync State Integration

**Update:** `sync_state` action to include objectives

```ruby
def sync_state
  # ... existing sync logic ...
  
  # Also sync objective progress from client
  if params[:objectives].present?
    params[:objectives].each do |task_id, progress|
      @game.update_task_progress!(task_id, progress.to_i)
    end
  end
  
  # Return current objective state in response
  render json: {
    success: true,
    objectives: @game.player_state['objectives']
  }
end
```

---

## Client-Side Implementation

### 1. Objectives Manager

**File:** `public/break_escape/js/systems/objectives-manager.js`

```javascript
/**
 * ObjectivesManager
 * 
 * Tracks mission objectives (aims) and their sub-tasks.
 * Listens to game events and updates objective progress.
 * Syncs state with server for validation.
 */

export class ObjectivesManager {
  constructor(eventDispatcher) {
    this.eventDispatcher = eventDispatcher;
    this.aims = [];           // Array of aim objects
    this.taskIndex = {};      // Quick lookup: taskId -> task object
    this.aimIndex = {};       // Quick lookup: aimId -> aim object
    this.listeners = [];      // UI update callbacks
    
    this.setupEventListeners();
  }
  
  /**
   * Initialize objectives from scenario data
   */
  initialize(objectivesData) {
    if (!objectivesData || !objectivesData.length) {
      console.log('📋 No objectives defined in scenario');
      return;
    }
    
    // Deep clone to avoid mutating scenario
    this.aims = JSON.parse(JSON.stringify(objectivesData));
    
    // Build indexes
    this.aims.forEach(aim => {
      this.aimIndex[aim.aimId] = aim;
      aim.tasks.forEach(task => {
        task.aimId = aim.aimId;
        task.originalStatus = task.status; // Store for reset
        this.taskIndex[task.taskId] = task;
      });
    });
    
    // Sort by order
    this.aims.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // Restore state from server if available
    this.restoreState();
    
    // Reconcile with current game state (handles items collected before objectives loaded)
    this.reconcileWithGameState();
    
    console.log(`📋 Objectives initialized: ${this.aims.length} aims`);
    this.notifyListeners();
  }
  
  /**
   * Restore objective state from player_state (passed from server via objectivesState)
   */
  restoreState() {
    const savedState = window.gameState?.objectives;
    if (!savedState) return;
    
    // Restore aim statuses
    Object.entries(savedState.aims || {}).forEach(([aimId, state]) => {
      if (this.aimIndex[aimId]) {
        this.aimIndex[aimId].status = state.status;
        this.aimIndex[aimId].completedAt = state.completedAt;
      }
    });
    
    // Restore task statuses and progress
    Object.entries(savedState.tasks || {}).forEach(([taskId, state]) => {
      if (this.taskIndex[taskId]) {
        this.taskIndex[taskId].status = state.status;
        this.taskIndex[taskId].currentCount = state.progress || 0;
        this.taskIndex[taskId].completedAt = state.completedAt;
      }
    });
    
    console.log('📋 Restored objectives state from server');
  }
  
  /**
   * Reconcile objectives with current game state
   * Handles case where player collected items BEFORE objectives system initialized
   */
  reconcileWithGameState() {
    console.log('📋 Reconciling objectives with current game state...');
    
    // Check inventory for items matching collect_items tasks
    const inventoryItems = window.inventory?.items || [];
    
    Object.values(this.taskIndex).forEach(task => {
      if (task.status !== 'active') return;
      
      switch (task.type) {
        case 'collect_items':
          const matchingItems = inventoryItems.filter(item => {
            const itemType = item.scenarioData?.type || item.getAttribute?.('data-type');
            return task.targetItems.includes(itemType);
          });
          
          // Also count keys from keyRing (keys don't emit events currently)
          const keyRingItems = window.inventory?.keyRing?.keys || [];
          const matchingKeys = keyRingItems.filter(key => 
            task.targetItems.includes(key.scenarioData?.type)
          );
          
          const totalCount = matchingItems.length + matchingKeys.length;
          
          if (totalCount > (task.currentCount || 0)) {
            task.currentCount = totalCount;
            console.log(`📋 Reconciled ${task.taskId}: ${totalCount}/${task.targetCount}`);
            
            if (totalCount >= task.targetCount) {
              this.completeTask(task.taskId);
            }
          }
          break;
          
        case 'unlock_room':
          // Check if room is already unlocked
          const unlockedRooms = window.gameState?.unlockedRooms || [];
          const isUnlocked = unlockedRooms.includes(task.targetRoom) || 
                            window.discoveredRooms?.has(task.targetRoom);
          if (isUnlocked) {
            console.log(`📋 Reconciled ${task.taskId}: room already unlocked`);
            this.completeTask(task.taskId);
          }
          break;
          
        case 'enter_room':
          // Check if room was already visited
          if (window.discoveredRooms?.has(task.targetRoom)) {
            console.log(`📋 Reconciled ${task.taskId}: room already visited`);
            this.completeTask(task.taskId);
          }
          break;
      }
    });
  }
  
  /**
   * Setup event listeners for automatic objective tracking
   * NOTE: Event names match actual codebase implementation
   */
  setupEventListeners() {
    // Item collection - wildcard pattern works with NPCEventDispatcher
    this.eventDispatcher.on('item_picked_up:*', (data) => {
      this.handleItemPickup(data);
    });
    
  // Room/door unlocks
  // NOTE: door_unlocked provides both 'roomId' and 'connectedRoom'
  // Use 'connectedRoom' for unlock_room tasks (the room being unlocked)
  this.eventDispatcher.on('door_unlocked', (data) => {
    this.handleRoomUnlock(data.connectedRoom);
  });    this.eventDispatcher.on('door_unlocked_by_npc', (data) => {
      this.handleRoomUnlock(data.roomId);
    });
    
    // Object unlocks - NOTE: event is 'item_unlocked' (not 'object_unlocked')
    this.eventDispatcher.on('item_unlocked', (data) => {
      // data contains: { itemType, itemName, lockType }
      this.handleObjectUnlock(data.itemName, data.itemType);
    });
    
    // Room entry
    this.eventDispatcher.on('room_entered', (data) => {
      this.handleRoomEntered(data.roomId);
    });
    
    // NPC conversation completion (via ink tag)
    this.eventDispatcher.on('task_completed_by_npc', (data) => {
      this.completeTask(data.taskId);
    });
  }
  
  /**
   * Handle item pickup - check collect_items tasks
   */
  handleItemPickup(data) {
    const itemType = data.itemType;
    
    // Find all active collect_items tasks that target this item type
    Object.values(this.taskIndex).forEach(task => {
      if (task.type !== 'collect_items') return;
      if (task.status !== 'active') return;
      if (!task.targetItems.includes(itemType)) return;
      
      // Increment progress
      task.currentCount = (task.currentCount || 0) + 1;
      
      console.log(`📋 Task progress: ${task.title} (${task.currentCount}/${task.targetCount})`);
      
      // Check completion
      if (task.currentCount >= task.targetCount) {
        this.completeTask(task.taskId);
      } else {
        // Sync progress to server
        this.syncTaskProgress(task.taskId, task.currentCount);
        this.notifyListeners();
      }
    });
  }
  
  /**
   * Handle room unlock - check unlock_room tasks
   */
  handleRoomUnlock(roomId) {
    Object.values(this.taskIndex).forEach(task => {
      if (task.type !== 'unlock_room') return;
      if (task.status !== 'active') return;
      if (task.targetRoom !== roomId) return;
      
      this.completeTask(task.taskId);
    });
  }
  
  /**
   * Handle object unlock - check unlock_object tasks
   * Matches by object name or type (item_unlocked event provides itemName and itemType)
   */
  handleObjectUnlock(itemName, itemType) {
    Object.values(this.taskIndex).forEach(task => {
      if (task.type !== 'unlock_object') return;
      if (task.status !== 'active') return;
      
      // Match by either targetObject name or type
      const matches = task.targetObject === itemName || 
                     task.targetObject === itemType;
      if (!matches) return;
      
      this.completeTask(task.taskId);
    });
  }
  
  /**
   * Handle room entry - check enter_room tasks
   */
  handleRoomEntered(roomId) {
    Object.values(this.taskIndex).forEach(task => {
      if (task.type !== 'enter_room') return;
      if (task.status !== 'active') return;
      if (task.targetRoom !== roomId) return;
      
      this.completeTask(task.taskId);
    });
  }
  
  /**
   * Complete a task (called by event handlers or ink tags)
   */
  async completeTask(taskId) {
    const task = this.taskIndex[taskId];
    if (!task || task.status === 'completed') return;
    
    console.log(`✅ Completing task: ${task.title}`);
    
    // Server validation
    try {
      const response = await this.serverCompleteTask(taskId);
      if (!response.success) {
        console.warn(`⚠️ Server rejected task completion: ${response.error}`);
        return;
      }
    } catch (error) {
      console.error('Failed to sync task completion with server:', error);
      // Continue with client-side update anyway for UX
    }
    
    // Update local state
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    
    // Show notification
    this.showTaskCompleteNotification(task);
    
    // Process onComplete actions
    this.processTaskCompletion(task);
    
    // Check aim completion
    this.checkAimCompletion(task.aimId);
    
    // Emit event
    this.eventDispatcher.emit('objective_task_completed', {
      taskId,
      aimId: task.aimId,
      task
    });
    
    this.notifyListeners();
  }
  
  /**
   * Process task.onComplete actions (unlock next task/aim)
   */
  processTaskCompletion(task) {
    if (!task.onComplete) return;
    
    if (task.onComplete.unlockTask) {
      this.unlockTask(task.onComplete.unlockTask);
    }
    
    if (task.onComplete.unlockAim) {
      this.unlockAim(task.onComplete.unlockAim);
    }
  }
  
  /**
   * Unlock a task (make it active)
   */
  unlockTask(taskId) {
    const task = this.taskIndex[taskId];
    if (!task || task.status !== 'locked') return;
    
    task.status = 'active';
    console.log(`🔓 Task unlocked: ${task.title}`);
    
    this.showTaskUnlockedNotification(task);
    this.notifyListeners();
  }
  
  /**
   * Unlock an aim (make it active)
   */
  unlockAim(aimId) {
    const aim = this.aimIndex[aimId];
    if (!aim || aim.status !== 'locked') return;
    
    aim.status = 'active';
    
    // Also activate first task
    const firstTask = aim.tasks[0];
    if (firstTask && firstTask.status === 'locked') {
      firstTask.status = 'active';
    }
    
    console.log(`🔓 Aim unlocked: ${aim.title}`);
    this.showAimUnlockedNotification(aim);
    this.notifyListeners();
  }
  
  /**
   * Check if all tasks in an aim are complete
   */
  checkAimCompletion(aimId) {
    const aim = this.aimIndex[aimId];
    if (!aim) return;
    
    const allComplete = aim.tasks.every(task => task.status === 'completed');
    
    if (allComplete && aim.status !== 'completed') {
      aim.status = 'completed';
      aim.completedAt = new Date().toISOString();
      
      console.log(`🏆 Aim completed: ${aim.title}`);
      this.showAimCompleteNotification(aim);
      
      // Check if aim completion unlocks another aim
      this.aims.forEach(otherAim => {
        if (otherAim.unlockCondition?.aimCompleted === aimId) {
          this.unlockAim(otherAim.aimId);
        }
      });
      
      this.eventDispatcher.emit('objective_aim_completed', {
        aimId,
        aim
      });
    }
  }
  
  /**
   * Get active aims for UI display
   */
  getActiveAims() {
    return this.aims.filter(aim => aim.status === 'active' || aim.status === 'completed');
  }
  
  /**
   * Get all aims (for debug/admin)
   */
  getAllAims() {
    return this.aims;
  }
  
  // === Server Communication ===
  
  async serverCompleteTask(taskId) {
    const gameId = window.breakEscapeConfig?.gameId;
    if (!gameId) return { success: true }; // Offline mode
    
    // RESTful route: POST /break_escape/games/:id/objectives/tasks/:task_id
    const response = await fetch(`/break_escape/games/${gameId}/objectives/tasks/${taskId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.CSRF_TOKEN || ''
      }
    });
    
    return response.json();
  }
  
  syncTaskProgress(taskId, progress) {
    const gameId = window.breakEscapeConfig?.gameId;
    if (!gameId) return;
    
    // Debounce sync by 1 second
    if (this.syncTimeouts[taskId]) {
      clearTimeout(this.syncTimeouts[taskId]);
    }
    
    this.syncTimeouts[taskId] = setTimeout(() => {
      // RESTful route: PUT /break_escape/games/:id/objectives/tasks/:task_id
      fetch(`/break_escape/games/${gameId}/objectives/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.CSRF_TOKEN || ''
        },
        body: JSON.stringify({ progress })
      }).catch(err => console.warn('Failed to sync progress:', err));
    }, 1000);
  }
  
  // === UI Notifications ===
  
  showTaskCompleteNotification(task) {
    if (window.playUISound) {
      window.playUISound('objective_complete');
    }
    if (window.gameAlert) {
      window.gameAlert(`✓ ${task.title}`, 'success', 'Task Complete');
    }
  }
  
  showTaskUnlockedNotification(task) {
    if (window.gameAlert) {
      window.gameAlert(`New Task: ${task.title}`, 'info', 'Objective Updated');
    }
  }
  
  showAimCompleteNotification(aim) {
    if (window.playUISound) {
      window.playUISound('objective_complete');
    }
    if (window.gameAlert) {
      window.gameAlert(`🏆 ${aim.title}`, 'success', 'Objective Complete!');
    }
  }
  
  showAimUnlockedNotification(aim) {
    if (window.gameAlert) {
      window.gameAlert(`New Objective: ${aim.title}`, 'info', 'Mission Updated');
    }
  }
  
  // === Listener Pattern for UI Updates ===
  
  addListener(callback) {
    this.listeners.push(callback);
  }
  
  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }
  
  notifyListeners() {
    this.listeners.forEach(callback => callback(this.getActiveAims()));
  }
}

// Export singleton
let instance = null;
export function getObjectivesManager(eventDispatcher) {
  if (!instance && eventDispatcher) {
    instance = new ObjectivesManager(eventDispatcher);
  }
  return instance;
}

export default ObjectivesManager;
```

### 2. Ink Tag Processing

**File:** Update `public/break_escape/js/minigames/helpers/chat-helpers.js`

Add new tag handler in `processGameActionTags`:

```javascript
case 'complete_task':
  if (param) {
    const taskId = param;
    // Emit event for ObjectivesManager to handle
    if (window.eventDispatcher) {
      window.eventDispatcher.emit('task_completed_by_npc', { taskId });
    }
    result.success = true;
    result.message = `📋 Task triggered: ${taskId}`;
    console.log('📋 Task completion tag:', taskId);
  } else {
    result.message = '⚠️ complete_task tag missing task ID';
    console.warn(result.message);
  }
  break;

case 'unlock_task':
  if (param) {
    const taskId = param;
    if (window.objectivesManager) {
      window.objectivesManager.unlockTask(taskId);
    }
    result.success = true;
    result.message = `🔓 Task unlocked: ${taskId}`;
  } else {
    result.message = '⚠️ unlock_task tag missing task ID';
    console.warn(result.message);
  }
  break;

case 'unlock_aim':
  if (param) {
    const aimId = param;
    if (window.objectivesManager) {
      window.objectivesManager.unlockAim(aimId);
    }
    result.success = true;
    result.message = `🔓 Aim unlocked: ${aimId}`;
  } else {
    result.message = '⚠️ unlock_aim tag missing aim ID';
    console.warn(result.message);
  }
  break;
```

### 3. Objectives UI Panel

**File:** `public/break_escape/js/ui/objectives-panel.js`

```javascript
/**
 * ObjectivesPanel
 * 
 * HUD element displaying current mission objectives (top-right).
 * Collapsible panel with aim/task hierarchy.
 */

export class ObjectivesPanel {
  constructor(objectivesManager) {
    this.manager = objectivesManager;
    this.container = null;
    this.isCollapsed = false;
    
    this.createPanel();
    this.manager.addListener((aims) => this.render(aims));
  }
  
  createPanel() {
    // Create container
    this.container = document.createElement('div');
    this.container.id = 'objectives-panel';
    this.container.className = 'objectives-panel';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'objectives-header';
    header.innerHTML = `
      <span class="objectives-title">📋 Objectives</span>
      <button class="objectives-toggle" aria-label="Toggle objectives">▼</button>
    `;
    header.querySelector('.objectives-toggle').addEventListener('click', () => {
      this.toggleCollapse();
    });
    
    // Create content area
    this.content = document.createElement('div');
    this.content.className = 'objectives-content';
    
    this.container.appendChild(header);
    this.container.appendChild(this.content);
    document.body.appendChild(this.container);
  }
  
  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    this.container.classList.toggle('collapsed', this.isCollapsed);
    const toggle = this.container.querySelector('.objectives-toggle');
    toggle.textContent = this.isCollapsed ? '▶' : '▼';
  }
  
  render(aims) {
    if (!aims || aims.length === 0) {
      this.content.innerHTML = '<div class="no-objectives">No active objectives</div>';
      return;
    }
    
    let html = '';
    
    aims.forEach(aim => {
      const aimClass = aim.status === 'completed' ? 'aim-completed' : 'aim-active';
      const aimIcon = aim.status === 'completed' ? '✓' : '◆';
      
      html += `
        <div class="objective-aim ${aimClass}">
          <div class="aim-header">
            <span class="aim-icon">${aimIcon}</span>
            <span class="aim-title">${aim.title}</span>
          </div>
          <div class="aim-tasks">
      `;
      
      aim.tasks.forEach(task => {
        if (task.status === 'locked') return; // Don't show locked tasks
        
        const taskClass = task.status === 'completed' ? 'task-completed' : 'task-active';
        const taskIcon = task.status === 'completed' ? '✓' : '○';
        
        let progressText = '';
        if (task.showProgress && task.type === 'collect_items') {
          progressText = ` (${task.currentCount || 0}/${task.targetCount})`;
        }
        
        html += `
          <div class="objective-task ${taskClass}">
            <span class="task-icon">${taskIcon}</span>
            <span class="task-title">${task.title}${progressText}</span>
          </div>
        `;
      });
      
      html += `
          </div>
        </div>
      `;
    });
    
    this.content.innerHTML = html;
  }
  
  show() {
    this.container.style.display = 'block';
  }
  
  hide() {
    this.container.style.display = 'none';
  }
}

export default ObjectivesPanel;
```

### 4. Objectives CSS

**File:** `public/break_escape/css/objectives.css`

```css
/* Objectives Panel - Top Right HUD */

.objectives-panel {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 280px;
  max-height: 60vh;
  background: rgba(0, 0, 0, 0.85);
  border: 2px solid #444;
  font-family: 'VT323', monospace;
  z-index: 1500;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.objectives-panel.collapsed {
  max-height: 40px;
}

.objectives-panel.collapsed .objectives-content {
  display: none;
}

.objectives-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(40, 40, 60, 0.9);
  border-bottom: 2px solid #444;
  cursor: pointer;
}

.objectives-title {
  color: #fff;
  font-size: 18px;
  font-weight: bold;
}

.objectives-toggle {
  background: none;
  border: none;
  color: #aaa;
  font-size: 14px;
  cursor: pointer;
  padding: 4px 8px;
}

.objectives-toggle:hover {
  color: #fff;
}

.objectives-content {
  max-height: calc(60vh - 40px);
  overflow-y: auto;
  padding: 8px;
}

.objectives-content::-webkit-scrollbar {
  width: 6px;
}

.objectives-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
}

.objectives-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
}

/* Aim Styling */
.objective-aim {
  margin-bottom: 12px;
}

.aim-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  color: #ffcc00;
  font-size: 16px;
}

.aim-completed .aim-header {
  color: #4ade80;
  text-decoration: line-through;
  opacity: 0.7;
}

.aim-icon {
  font-size: 12px;
}

.aim-tasks {
  padding-left: 20px;
  border-left: 2px solid #333;
  margin-left: 6px;
}

/* Task Styling */
.objective-task {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  color: #ccc;
  font-size: 14px;
}

.task-completed {
  color: #4ade80;
  text-decoration: line-through;
  opacity: 0.6;
}

.task-icon {
  font-size: 10px;
  color: #888;
}

.task-completed .task-icon {
  color: #4ade80;
}

.no-objectives {
  color: #666;
  text-align: center;
  padding: 20px;
  font-style: italic;
}

/* Animation for new objectives */
@keyframes objective-pulse {
  0% { background-color: rgba(255, 204, 0, 0.3); }
  100% { background-color: transparent; }
}

.objective-aim.new-objective {
  animation: objective-pulse 1s ease-out;
}

.objective-task.new-task {
  animation: objective-pulse 0.8s ease-out;
}
```

### 5. Integration (main.js and game.js)

**File:** Update `public/break_escape/js/main.js`

```javascript
// Add imports at top
import ObjectivesManager, { getObjectivesManager } from './systems/objectives-manager.js';
import ObjectivesPanel from './ui/objectives-panel.js';

// In initializeGame(), AFTER NPC systems are initialized:

// Initialize Objectives System (manager only - data comes later in game.js)
console.log('📋 Initializing objectives manager...');
window.objectivesManager = getObjectivesManager(window.eventDispatcher);
```

**File:** Update `public/break_escape/js/core/game.js`

In the `create()` function, AFTER `gameScenario` is loaded and global variables are set:

```javascript
// Initialize global narrative variables from scenario
if (gameScenario.globalVariables) {
    window.gameState.globalVariables = { ...gameScenario.globalVariables };
    console.log('🌐 Initialized global variables:', window.gameState.globalVariables);
} else {
    window.gameState.globalVariables = {};
}

// Restore objectives state from server if available (passed via objectivesState)
if (gameScenario.objectivesState) {
    window.gameState.objectives = gameScenario.objectivesState;
    console.log('📋 Restored objectives state from server');
}

// Initialize objectives system AFTER scenario is loaded
// This must happen in create() because gameScenario isn't available until now
if (gameScenario.objectives && window.objectivesManager) {
    console.log('📋 Initializing objectives from scenario');
    window.objectivesManager.initialize(gameScenario.objectives);
    
    // Create UI panel
    window.objectivesPanel = new ObjectivesPanel(window.objectivesManager);
}
```

> **CRITICAL**: Objectives data initialization MUST happen in `game.js create()` function, NOT in `main.js`. The scenario JSON is not available until `create()` runs. The manager is created in `main.js`, but `initialize()` with data happens in `game.js`.

### 6. Door Unlock Event Fix

**File:** Update `public/break_escape/js/systems/doors.js`

**CRITICAL**: The current codebase does NOT emit `door_unlocked` events. Add event emission to the `unlockDoor()` function:

```javascript
function unlockDoor(doorSprite, roomData) {
    const props = doorSprite.doorProperties;
    console.log(`Unlocking door: ${props.roomId} -> ${props.connectedRoom}`);

    // Mark door as unlocked
    props.locked = false;

    // If roomData was provided from server unlock response, cache it
    if (roomData && window.roomDataCache) {
        console.log(`📦 Caching room data for ${props.connectedRoom} from unlock response`);
        window.roomDataCache.set(props.connectedRoom, roomData);
    }

    // Emit door unlocked event for objectives system
    if (window.eventDispatcher) {
        window.eventDispatcher.emit('door_unlocked', {
            roomId: props.roomId,
            connectedRoom: props.connectedRoom,
            direction: props.direction
        });
        console.log(`📋 Emitted door_unlocked event: ${props.roomId} -> ${props.connectedRoom}`);
    }

    // TODO: Implement unlock animation/effect

    // Open the door
    openDoor(doorSprite);
}
```

> **NOTE**: Use `data.connectedRoom` when listening to this event - that's the room being unlocked.

### 7. Key Item Event Fix

**File:** Update `public/break_escape/js/systems/inventory.js`

In the `addKeyToInventory()` function, add event emission after adding the key:

```javascript
function addKeyToInventory(sprite) {
    // ... existing code to add key to keyRing ...
    
    // Add the key to the key ring
    window.inventory.keyRing.keys.push(sprite);
    
    // Emit item_picked_up event for keys too (for objectives tracking)
    // NOTE: Keys currently don't emit events - this is a required fix
    if (window.eventDispatcher) {
        window.eventDispatcher.emit(`item_picked_up:${sprite.scenarioData.type}`, {
            itemType: sprite.scenarioData.type,
            itemName: sprite.scenarioData.name,
            roomId: window.currentPlayerRoom,
            isKey: true
        });
        
        // Also emit specific key_id event if available
        const keyId = sprite.scenarioData?.key_id || sprite.key_id;
        if (keyId) {
            window.eventDispatcher.emit(`item_picked_up:key:${keyId}`, {
                itemType: 'key',
                keyId: keyId,
                itemName: sprite.scenarioData.name,
                roomId: window.currentPlayerRoom
            });
        }
    }
    
    // ... rest of existing code ...
}
```

---

## Implementation TODO List

### Phase 0: Prerequisites (Do First)
- [ ] 0.1 Add key pickup events to `inventory.js` `addKeyToInventory()` function
- [ ] 0.2 Verify `item_unlocked` event name in unlock-system.js (currently line 587)
- [ ] 0.3 Verify `door_unlocked` event provides `connectedRoom` property

### Phase 1: Core Infrastructure (Foundation)
- [ ] 1.1 Create database migration for objectives tracking
- [ ] 1.2 Add objective methods to `Game` model
- [ ] 1.3 Create API endpoints with RESTful routes (`/objectives/tasks/:task_id`)
- [ ] 1.4 Update scenario action to include `objectivesState`
- [ ] 1.5 Create `objectives-manager.js` client module
- [ ] 1.6 Add objectives CSS file

### Phase 2: Event Integration
- [ ] 2.1 Subscribe to `item_picked_up:*` wildcard events in ObjectivesManager
- [ ] 2.2 Subscribe to `door_unlocked` events (use `connectedRoom` property)
- [ ] 2.3 Subscribe to `item_unlocked` events (NOT `object_unlocked`)
- [ ] 2.4 Subscribe to `room_entered` events
- [ ] 2.5 Add `complete_task` ink tag processing

### Phase 3: UI Implementation
- [ ] 3.1 Create `objectives-panel.js` UI component
- [ ] 3.2 Style objectives panel (top-right HUD)
- [ ] 3.3 Add collapse/expand functionality
- [ ] 3.4 Add progress indicators for collection tasks
- [ ] 3.5 Add completion animations

### Phase 4: Integration & Wiring
- [ ] 4.1 Import ObjectivesManager in `main.js`, create manager instance
- [ ] 4.2 Initialize objectives from scenario in `game.js` create function
- [ ] 4.3 Add objectives CSS to game HTML template
- [ ] 4.4 Wire up ObjectivesPanel to ObjectivesManager

### Phase 5: Server Validation
- [ ] 5.1 Update `sync_state` to include objective progress
- [ ] 5.2 Validate `collect_items` against inventory
- [ ] 5.3 Validate `unlock_room` against unlockedRooms
- [ ] 5.4 Validate `npc_conversation` against encounteredNPCs
- [ ] 5.5 Return objective state in scenario bootstrap (`objectivesState`)

### Phase 6: Ink Tag Extensions
- [ ] 6.1 Add `#complete_task:taskId` tag handler to chat-helpers.js
- [ ] 6.2 Add `#unlock_task:taskId` tag handler
- [ ] 6.3 Add `#unlock_aim:aimId` tag handler
- [ ] 6.4 Test tags in phone-chat and person-chat minigames

### Phase 7: Reconciliation & Edge Cases
- [ ] 7.1 Implement `reconcileWithGameState()` for items collected before init
- [ ] 7.2 Handle key pickups (add events to `addKeyToInventory()`)
- [ ] 7.3 Test state restoration on page reload
- [ ] 7.4 Add debouncing to `syncTaskProgress()`

### Phase 8: Testing & Documentation
- [ ] 8.1 Create test scenario `scenarios/test-objectives/` with all objective types
- [ ] 8.2 Test item collection objectives
- [ ] 8.3 Test room unlock objectives  
- [ ] 8.4 Test object unlock objectives
- [ ] 8.5 Test NPC conversation objectives
- [ ] 8.6 Test chained objectives (onComplete triggers)
- [ ] 8.7 Test aim unlock conditions (aimCompleted)
- [ ] 8.8 Update README_scenario_design.md with objectives schema
- [ ] 8.9 Create docs/OBJECTIVES_USAGE.md documentation

---

## Example Scenarios

### Example 1: Test Objectives Scenario

A comprehensive test scenario demonstrating all objective types.

**File:** `scenarios/test-objectives/scenario.json.erb`

```json
{
  "scenario_brief": "Test scenario for the objectives system. Demonstrates all task types: item collection, room unlocking, object unlocking, room entry, and NPC conversations.",
  "startRoom": "start_room",
  "objectives": [
    {
      "aimId": "tutorial",
      "title": "Complete the Tutorial",
      "description": "Learn how objectives work",
      "status": "active",
      "order": 0,
      "tasks": [
        {
          "taskId": "speak_guide",
          "title": "Speak to the Guide",
          "type": "npc_conversation",
          "targetNpc": "guide_npc",
          "status": "active",
          "onComplete": { "unlockTask": "collect_documents" }
        },
        {
          "taskId": "collect_documents",
          "title": "Collect documents",
          "type": "collect_items",
          "targetItems": ["notes", "classified_doc"],
          "targetCount": 3,
          "showProgress": true,
          "status": "locked",
          "onComplete": { "unlockAim": "explore" }
        }
      ]
    },
    {
      "aimId": "explore",
      "title": "Explore the Facility",
      "status": "locked",
      "order": 1,
      "tasks": [
        {
          "taskId": "unlock_office",
          "title": "Unlock the office",
          "type": "unlock_room",
          "targetRoom": "office_room",
          "status": "active",
          "onComplete": { "unlockTask": "enter_office" }
        },
        {
          "taskId": "enter_office",
          "title": "Enter the office",
          "type": "enter_room",
          "targetRoom": "office_room",
          "status": "locked",
          "onComplete": { "unlockTask": "unlock_safe" }
        },
        {
          "taskId": "unlock_safe",
          "title": "Open the safe",
          "type": "unlock_object",
          "targetObject": "Office Safe",
          "status": "locked"
        }
      ]
    },
    {
      "aimId": "finale",
      "title": "Complete the Mission",
      "status": "locked",
      "unlockCondition": { "aimCompleted": "explore" },
      "order": 2,
      "tasks": [
        {
          "taskId": "collect_evidence",
          "title": "Collect the evidence",
          "type": "collect_items",
          "targetItems": ["evidence"],
          "targetCount": 1,
          "status": "active"
        }
      ]
    }
  ],
  "rooms": {
    "start_room": {
      "type": "room_reception",
      "connections": { "north": "office_room" },
      "npcs": [
        {
          "id": "guide_npc",
          "displayName": "Mission Guide",
          "npcType": "person",
          "position": { "x": 5, "y": 5 },
          "spriteSheet": "hacker",
          "storyPath": "scenarios/test-objectives/guide.json",
          "currentKnot": "start"
        }
      ],
      "objects": [
        {
          "type": "notes",
          "name": "Document 1",
          "takeable": true,
          "observations": "An important document"
        },
        {
          "type": "notes",
          "name": "Document 2",
          "takeable": true,
          "observations": "Another important document"
        }
      ]
    },
    "office_room": {
      "type": "room_office",
      "locked": true,
      "lockType": "pin",
      "requires": "1234",
      "connections": { "south": "start_room" },
      "objects": [
        {
          "type": "classified_doc",
          "name": "Classified Document",
          "takeable": true,
          "observations": "Top secret intel"
        },
        {
          "type": "safe",
          "name": "Office Safe",
          "takeable": false,
          "locked": true,
          "lockType": "pin",
          "requires": "9999",
          "observations": "A secure wall safe",
          "contents": [
            {
              "type": "evidence",
              "name": "Critical Evidence",
              "takeable": true,
              "observations": "This is what you came for!"
            }
          ]
        }
      ]
    }
  }
}
```

**Ink Story:** `scenarios/test-objectives/guide.ink`

```ink
=== start ===
Welcome, agent! I'm here to guide you through your mission.
+ [Tell me about the objectives]
    -> explain_objectives
+ [I'm ready to start]
    -> complete_briefing

=== explain_objectives ===
Your objectives are shown in the panel on the right.
Each mission has high-level AIMS with specific TASKS underneath.
Complete all tasks to finish an aim!
+ [Got it]
    -> complete_briefing

=== complete_briefing ===
Excellent! Your first task is to speak with me - which you just did!
Now go collect those documents. Good luck, agent!
# complete_task:speak_guide
-> END
```

### Example 2: CEO Exfil Style Objectives

Example objectives for a mission-style scenario (based on `ceo_exfil`):

```json
{
  "objectives": [
    {
      "aimId": "investigate",
      "title": "Investigate the CEO",
      "status": "active",
      "order": 0,
      "tasks": [
        {
          "taskId": "find_security_log",
          "title": "Find the security log",
          "type": "collect_items",
          "targetItems": ["notes"],
          "targetCount": 1,
          "status": "active",
          "showProgress": false
        },
        {
          "taskId": "access_office_area",
          "title": "Access the office area",
          "type": "unlock_room",
          "targetRoom": "office1",
          "status": "active"
        }
      ]
    },
    {
      "aimId": "gather_evidence",
      "title": "Gather Evidence",
      "status": "active",
      "order": 1,
      "tasks": [
        {
          "taskId": "find_documents",
          "title": "Find incriminating documents",
          "type": "collect_items",
          "targetItems": ["notes"],
          "targetCount": 4,
          "showProgress": true,
          "status": "active"
        },
        {
          "taskId": "access_ceo_office",
          "title": "Access CEO's office",
          "type": "unlock_room",
          "targetRoom": "ceo",
          "status": "active",
          "onComplete": { "unlockTask": "access_closet" }
        },
        {
          "taskId": "access_closet",
          "title": "Access the secret closet",
          "type": "unlock_room",
          "targetRoom": "closet",
          "status": "locked",
          "onComplete": { "unlockTask": "open_hidden_safe" }
        },
        {
          "taskId": "open_hidden_safe",
          "title": "Open the hidden safe",
          "type": "unlock_object",
          "targetObject": "Hidden Safe",
          "status": "locked"
        }
      ]
    },
    {
      "aimId": "complete_mission",
      "title": "Complete the Mission",
      "status": "locked",
      "unlockCondition": { "aimCompleted": "gather_evidence" },
      "order": 2,
      "tasks": [
        {
          "taskId": "collect_final_evidence",
          "title": "Collect the incriminating documents",
          "type": "collect_items",
          "targetItems": ["evidence"],
          "targetCount": 1,
          "status": "active"
        }
      ]
    }
  ]
}
```

### Example 3: NPC-Driven Objectives

Example for scenarios with heavy NPC interaction (like `npc-sprite-test3`):

```json
{
  "objectives": [
    {
      "aimId": "make_contact",
      "title": "Make Contact",
      "status": "active",
      "order": 0,
      "tasks": [
        {
          "taskId": "talk_to_contact",
          "title": "Talk to your contact",
          "type": "npc_conversation",
          "targetNpc": "test_npc_front",
          "status": "active"
        }
      ]
    },
    {
      "aimId": "gather_tools",
      "title": "Gather Equipment",
      "status": "locked",
      "order": 1,
      "tasks": [
        {
          "taskId": "get_workstation",
          "title": "Obtain the crypto workstation",
          "type": "collect_items",
          "targetItems": ["workstation"],
          "targetCount": 1,
          "status": "active"
        },
        {
          "taskId": "get_lockpick",
          "title": "Obtain lockpick tools",
          "type": "collect_items",
          "targetItems": ["lockpick"],
          "targetCount": 1,
          "status": "active"
        }
      ]
    }
  ]
}
```

**NPC Ink Story with Objective Tags:**

```ink
=== briefing_complete ===
Contact: Here's your equipment. Good luck out there!
# give_npc_inventory_items
# complete_task:talk_to_contact
# unlock_aim:gather_tools
-> END

=== secondary_objective ===
Contact: I have another task for you, if you're interested.
+ [Tell me more]
    Contact: There's a hidden server we need you to access.
    # unlock_task:find_hidden_server
    -> END
+ [Not right now]
    Contact: Come back when you're ready.
    -> END
```

---

## Ink Tag Reference

### Objective-Related Tags

| Tag | Description | Example |
|-----|-------------|---------|
| `#complete_task:taskId` | Marks a task as complete | `#complete_task:speak_handler` |
| `#unlock_task:taskId` | Unlocks a locked task | `#unlock_task:next_objective` |
| `#unlock_aim:aimId` | Unlocks a locked aim | `#unlock_aim:phase_two` |

### Example Ink Pattern

```ink
=== mission_briefing ===
Handler: Agent, your mission is to infiltrate the facility.
+ [Understood]
    Handler: Good. First, speak to our contact inside.
    # complete_task:receive_briefing
    -> END
+ [Tell me more about the target]
    Handler: We suspect corporate espionage. Gather evidence.
    # unlock_task:investigate_ceo
    -> mission_briefing
```

---

## File Summary

| File | Type | Description |
|------|------|-------------|
| `db/migrate/XXX_add_objectives_to_games.rb` | Migration | Add objective tracking columns |
| `app/models/break_escape/game.rb` | Model | Add objective methods |
| `app/controllers/break_escape/games_controller.rb` | Controller | Add objective endpoints |
| `config/routes.rb` | Routes | Add RESTful objective routes |
| `public/break_escape/js/systems/objectives-manager.js` | JS | Core tracking logic |
| `public/break_escape/js/ui/objectives-panel.js` | JS | HUD panel component |
| `public/break_escape/css/objectives.css` | CSS | Panel styling (no border-radius!) |
| `public/break_escape/js/main.js` | JS | Manager initialization |
| `public/break_escape/js/core/game.js` | JS | Scenario data initialization |
| `public/break_escape/js/systems/inventory.js` | JS | Key event fix |
| `public/break_escape/js/minigames/helpers/chat-helpers.js` | JS | Ink tag handlers |
| `scenarios/test-objectives/` | Scenario | Test scenario demonstrating features |
| `docs/OBJECTIVES_USAGE.md` | Docs | Usage documentation |

---

## Debug Utilities

Add to `objectives-manager.js` or expose globally for testing:

```javascript
// Expose debug functions globally in development
window.debugObjectives = {
  completeTask: (taskId) => window.objectivesManager?.completeTask(taskId),
  unlockTask: (taskId) => window.objectivesManager?.unlockTask(taskId),
  unlockAim: (aimId) => window.objectivesManager?.unlockAim(aimId),
  showAll: () => console.table(window.objectivesManager?.getAllAims()),
  showTask: (taskId) => console.log(window.objectivesManager?.taskIndex[taskId]),
  simulatePickup: (itemType) => window.objectivesManager?.handleItemPickup({ itemType }),
  reconcile: () => window.objectivesManager?.reconcileWithGameState(),
  reset: () => {
    const manager = window.objectivesManager;
    if (!manager) return;
    Object.values(manager.taskIndex).forEach(task => {
      task.status = task.originalStatus || 'active';
      task.currentCount = 0;
      delete task.completedAt;
    });
    Object.values(manager.aimIndex).forEach(aim => {
      aim.status = aim.originalStatus || 'active';
      delete aim.completedAt;
    });
    manager.notifyListeners();
    console.log('📋 Objectives reset');
  }
};
```

---

## Open Questions / Future Enhancements

1. **Optional objectives?** Support for side-quests that don't block main progression
2. **Timed objectives?** Tasks with time limits (e.g., "Escape before security arrives")
3. **Hidden objectives?** Tasks that only appear after certain conditions
4. **Objective dependencies?** More complex unlock conditions (AND/OR logic)
5. **Objective rewards?** Grant items or unlock abilities on completion
6. **Objective journal?** Full-screen view with descriptions and history
7. **Sound effects?** Add `objective_complete.mp3` to sound assets
6. **Objective journal?** Full-screen view with descriptions and history
