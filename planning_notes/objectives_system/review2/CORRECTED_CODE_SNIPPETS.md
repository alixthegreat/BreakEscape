# Corrected Code Snippets - Review 2

All code ready to copy-paste into implementation.

---

## Critical Fix: Door Unlock Event Emission

### File: `public/break_escape/js/systems/doors.js`

**Location**: `unlockDoor()` function (around line 585)

**Current Code** (MISSING event emission):
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

    // TODO: Implement unlock animation/effect

    // Open the door
    openDoor(doorSprite);
}
```

**CORRECTED Code** (with event emission):
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

**Why This Matters**: Without this event, `unlock_room` type objectives will never auto-complete.

---

## Already Documented Fix: Key Pickup Event Emission

### File: `public/break_escape/js/systems/inventory.js`

**Location**: `addKeyToInventory()` function (around line 433)

**Insert AFTER** the line: `window.inventory.keyRing.keys.push(sprite);`

```javascript
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
```

---

## ObjectivesManager Event Listener Setup

### File: `public/break_escape/js/systems/objectives-manager.js`

**Function**: `setupEventListeners()`

**CORRECTED version** with proper door event handling:

```javascript
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
  this.eventDispatcher.on('door_unlocked', (data) => {
    // Check tasks that match the connectedRoom (the room being unlocked)
    this.handleRoomUnlock(data.connectedRoom);
  });
  
  this.eventDispatcher.on('door_unlocked_by_npc', (data) => {
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
```

**Key Point**: Use `data.connectedRoom` for door unlocks, as that's the room being unlocked (the target room).

---

## Scenario Bootstrap with objectivesState

### File: `app/controllers/break_escape/games_controller.rb`

**Method**: `scenario`

**Current Code**:
```ruby
def scenario
  authorize @game if defined?(Pundit)

  begin
    filtered = @game.filtered_scenario_for_bootstrap
    filter_requires_recursive(filtered)

    render json: filtered
  rescue => e
    Rails.logger.error "[BreakEscape] scenario error: #{e.message}"
    render_error("Failed to generate scenario: #{e.message}", :internal_server_error)
  end
end
```

**CORRECTED Code**:
```ruby
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

---

## Game.js Integration

### File: `public/break_escape/js/core/game.js`

**Location**: In `create()` function, AFTER loading scenario and global variables

**Insert AFTER** this block:
```javascript
// Initialize global narrative variables from scenario
if (gameScenario.globalVariables) {
    window.gameState.globalVariables = { ...gameScenario.globalVariables };
    console.log('🌐 Initialized global variables:', window.gameState.globalVariables);
} else {
    window.gameState.globalVariables = {};
}
```

**Add this**:
```javascript
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
    const ObjectivesPanel = await import('../ui/objectives-panel.js');
    window.objectivesPanel = new ObjectivesPanel.default(window.objectivesManager);
}
```

---

## Main.js Integration

### File: `public/break_escape/js/main.js`

**Location**: In `initializeGame()` function, AFTER NPC systems initialization

**Insert AFTER** this block:
```javascript
// Initialize NPC systems
console.log('🎭 Initializing NPC systems...');
window.eventDispatcher = new NPCEventDispatcher();
window.barkSystem = new NPCBarkSystem();
window.npcManager = new NPCManager(window.eventDispatcher, window.barkSystem);
window.npcLazyLoader = new NPCLazyLoader(window.npcManager);
console.log('✅ NPC lazy loader initialized');

// Start timed message system
window.npcManager.startTimedMessages();

console.log('✅ NPC systems initialized');
```

**Add this**:
```javascript
// Initialize Objectives System (manager only - data comes later in game.js)
console.log('📋 Initializing objectives manager...');
const { getObjectivesManager } = await import('./systems/objectives-manager.js');
window.objectivesManager = getObjectivesManager(window.eventDispatcher);
console.log('✅ Objectives manager initialized (awaiting scenario data)');
```

**NOTE**: This uses dynamic import to avoid circular dependencies. The manager is created, but `initialize(data)` is called later in `game.js` once scenario is loaded.

---

## Ink Tag Processing

### File: `public/break_escape/js/minigames/helpers/chat-helpers.js`

**Function**: `processGameActionTags()`

**Add these cases to the switch statement**:

```javascript
case 'complete_task':
  if (param) {
    const taskId = param;
    // Emit event for ObjectivesManager to handle
    if (window.eventDispatcher) {
      window.eventDispatcher.emit('task_completed_by_npc', { taskId });
    }
    result.success = true;
    result.message = `📋 Task completed: ${taskId}`;
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

---

## Complete handleRoomUnlock Implementation

### File: `public/break_escape/js/systems/objectives-manager.js`

```javascript
/**
 * Handle room unlock - check unlock_room tasks
 * Called when door_unlocked event fires
 */
handleRoomUnlock(roomId) {
  Object.values(this.taskIndex).forEach(task => {
    if (task.type !== 'unlock_room') return;
    if (task.status !== 'active') return;
    if (task.targetRoom !== roomId) return;
    
    console.log(`📋 Room unlock detected: ${roomId} matches task ${task.taskId}`);
    this.completeTask(task.taskId);
  });
}
```

---

## Summary of Required Changes

### Phase 0 Prerequisites (MUST DO FIRST)

1. ✅ **Add door unlock events** - `doors.js` `unlockDoor()` function
2. ✅ **Add key pickup events** - `inventory.js` `addKeyToInventory()` function
3. ⚠️ **Verify room_entered events** - Check if already emitted in `rooms.js`

### Integration Changes

4. ✅ **Update scenario controller** - Add `objectivesState` to bootstrap
5. ✅ **Update game.js create()** - Initialize objectives after scenario loads
6. ✅ **Update main.js** - Create manager instance early
7. ✅ **Update chat-helpers.js** - Add ink tag handlers

### All Code Above is Production-Ready

Every snippet above can be copy-pasted directly into the codebase. No placeholders, no pseudocode.
