# Objectives System - Corrected Code Snippets

This file contains corrected code based on the implementation review findings.

---

## 1. Corrected Event Listeners (objectives-manager.js)

```javascript
/**
 * Setup event listeners for automatic objective tracking
 * CORRECTED: Uses actual event names from codebase
 */
setupEventListeners() {
    // Item collection - wildcard pattern works with NPCEventDispatcher
    this.eventDispatcher.on('item_picked_up:*', (data) => {
        this.handleItemPickup(data);
    });
    
    // Room/door unlocks
    this.eventDispatcher.on('door_unlocked', (data) => {
        this.handleRoomUnlock(data.connectedRoom); // Note: connectedRoom, not roomId
    });
    
    this.eventDispatcher.on('door_unlocked_by_npc', (data) => {
        this.handleRoomUnlock(data.roomId);
    });
    
    // Object unlocks - CORRECTED: event is 'item_unlocked' not 'object_unlocked'
    this.eventDispatcher.on('item_unlocked', (data) => {
        // data contains: { itemType, itemName, lockType }
        // Match against task.targetObject using itemName or itemType
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
 * Handle object unlock - CORRECTED to accept both name and type
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
```

---

## 2. Corrected Initialization Location (game.js)

```javascript
// In game.js create() function, AFTER gameScenario is loaded (around line 510)

// Initialize global narrative variables from scenario
if (gameScenario.globalVariables) {
    window.gameState.globalVariables = { ...gameScenario.globalVariables };
    console.log('🌐 Initialized global variables:', window.gameState.globalVariables);
} else {
    window.gameState.globalVariables = {};
}

// NEW: Restore objectives state from server if available
if (gameScenario.objectivesState) {
    window.gameState.objectives = gameScenario.objectivesState;
    console.log('📋 Restored objectives state from server');
}

// NEW: Initialize objectives system after scenario is loaded
if (gameScenario.objectives && window.objectivesManager) {
    console.log('📋 Initializing objectives from scenario');
    window.objectivesManager.initialize(gameScenario.objectives);
    
    // Create UI panel
    if (typeof ObjectivesPanel !== 'undefined') {
        window.objectivesPanel = new ObjectivesPanel(window.objectivesManager);
    }
}
```

---

## 3. Corrected Rails Routes (routes.rb)

```ruby
BreakEscape::Engine.routes.draw do
  # ... existing routes ...
  
  resources :games, only: [:show, :create] do
    member do
      # Existing routes
      get 'scenario'
      get 'scenario_map'
      get 'ink'
      get 'room/:room_id', to: 'games#room', as: 'room'
      get 'container/:container_id', to: 'games#container'
      put 'sync_state'
      post 'unlock'
      post 'inventory'
      
      # NEW: Objectives routes (RESTful pattern)
      get 'objectives'                    # Get current objective state
      post 'objectives/tasks/:task_id',   # Complete a specific task
           to: 'games#complete_task', 
           as: 'complete_task'
      put 'objectives/tasks/:task_id',    # Update task progress
          to: 'games#update_task_progress',
          as: 'update_task_progress'
    end
  end
end
```

---

## 4. Include Objectives State in Scenario Bootstrap (games_controller.rb)

```ruby
# GET /games/:id/scenario
def scenario
  authorize @game if defined?(Pundit)

  begin
    filtered = @game.filtered_scenario_for_bootstrap
    filter_requires_recursive(filtered)
    
    # NEW: Include objectives state for restoration
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

## 5. Reconciliation Method for Late Initialization (objectives-manager.js)

```javascript
/**
 * Reconcile objectives with current game state
 * Handles case where player collected items before objectives loaded
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
                
                // Also count keys from keyRing
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
            this.taskIndex[task.taskId] = task;
        });
    });
    
    // Sort by order
    this.aims.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // Restore state from server if available
    this.restoreState();
    
    // NEW: Reconcile with current game state
    this.reconcileWithGameState();
    
    console.log(`📋 Objectives initialized: ${this.aims.length} aims`);
    this.notifyListeners();
}
```

---

## 6. Key Item Event Emission Fix (inventory.js)

Add this to `addKeyToInventory()` after line 460:

```javascript
function addKeyToInventory(sprite) {
    // ... existing code to add key to keyRing ...
    
    // NEW: Emit item_picked_up event for keys too (for objectives tracking)
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

## 7. Responsive CSS Additions (objectives.css)

Add to the end of the CSS file:

```css
/* Responsive breakpoints for objectives panel */

@media (max-width: 1024px) {
  .objectives-panel {
    width: 240px;
  }
}

@media (max-width: 768px) {
  .objectives-panel {
    width: 200px;
    font-size: 12px;
    top: 10px;
    right: 10px;
  }
  
  .objectives-title {
    font-size: 14px;
  }
  
  .aim-header {
    font-size: 13px;
  }
  
  .objective-task {
    font-size: 11px;
  }
}

@media (max-width: 480px) {
  .objectives-panel {
    position: fixed;
    top: auto;
    bottom: 90px; /* Above inventory */
    right: 10px;
    left: 10px;
    width: auto;
    max-height: 30vh;
  }
  
  .objectives-panel.collapsed {
    left: auto;
    width: auto;
    min-width: 120px;
  }
  
  .objectives-panel.collapsed .objectives-title {
    display: none;
  }
  
  .objectives-panel.collapsed .objectives-header::before {
    content: '📋';
    margin-right: 8px;
  }
}

/* Animation for objective updates */
@keyframes objective-highlight {
  0% { 
    background-color: rgba(255, 204, 0, 0.4);
    transform: scale(1.02);
  }
  100% { 
    background-color: transparent;
    transform: scale(1);
  }
}

.objective-task.updated {
  animation: objective-highlight 0.6s ease-out;
}

.objective-aim.updated {
  animation: objective-highlight 0.8s ease-out;
}
```

---

## 8. Debug Utilities

Add to `objectives-manager.js` or create `objectives-debug.js`:

```javascript
/**
 * Debug utilities for objectives system
 * Available via window.debugObjectives
 */
export function initObjectivesDebug(manager) {
    window.debugObjectives = {
        // Complete a task manually
        completeTask: (taskId) => {
            console.log(`🔧 Debug: Completing task ${taskId}`);
            return manager.completeTask(taskId);
        },
        
        // Unlock a task manually
        unlockTask: (taskId) => {
            console.log(`🔧 Debug: Unlocking task ${taskId}`);
            return manager.unlockTask(taskId);
        },
        
        // Unlock an aim manually
        unlockAim: (aimId) => {
            console.log(`🔧 Debug: Unlocking aim ${aimId}`);
            return manager.unlockAim(aimId);
        },
        
        // Show all objectives state
        showAll: () => {
            console.log('📋 All Aims:', manager.getAllAims());
            console.table(manager.getAllAims().map(aim => ({
                aimId: aim.aimId,
                title: aim.title,
                status: aim.status,
                tasks: aim.tasks.length,
                completedTasks: aim.tasks.filter(t => t.status === 'completed').length
            })));
        },
        
        // Show specific task
        showTask: (taskId) => {
            const task = manager.taskIndex[taskId];
            if (task) {
                console.log(`📋 Task ${taskId}:`, task);
            } else {
                console.warn(`Task ${taskId} not found`);
            }
        },
        
        // Reset objectives (for testing)
        reset: () => {
            console.log('🔧 Debug: Resetting objectives');
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
        },
        
        // Simulate item pickup
        simulatePickup: (itemType) => {
            console.log(`🔧 Debug: Simulating pickup of ${itemType}`);
            manager.handleItemPickup({ itemType, itemName: itemType });
        },
        
        // Force reconciliation
        reconcile: () => {
            console.log('🔧 Debug: Forcing reconciliation');
            manager.reconcileWithGameState();
        }
    };
    
    console.log('📋 Debug utilities available via window.debugObjectives');
}
```
