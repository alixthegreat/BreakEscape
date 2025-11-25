# Objectives System - Implementation Review

## Executive Summary

After reviewing the codebase against the implementation plan, I've identified several **critical issues**, **gaps**, and **improvement opportunities** that should be addressed before implementation. The plan is solid overall but needs refinements for successful integration.

---

## 🔴 Critical Issues

### 1. Missing `item_picked_up` Event - Actual Format Differs

**Issue:** The plan assumes `item_picked_up:*` wildcard events exist, but the actual emitted event format is:

```javascript
// Actual (inventory.js line 369-374)
window.eventDispatcher.emit(`item_picked_up:${sprite.scenarioData.type}`, {
    itemType: sprite.scenarioData.type,
    itemName: sprite.scenarioData.name,
    roomId: window.currentPlayerRoom
});
```

**Problem:** The event is emitted with type-specific naming (`item_picked_up:lockpick`), not a generic `item_picked_up`. The wildcard listener `item_picked_up:*` **will work** thanks to `NPCEventDispatcher.emit()` (line 28-33), but only matching `eventType.startsWith(prefix)`.

**Fix Required:** The plan's listener pattern is correct, but ensure we're subscribing to `item_picked_up:*` (with asterisk) or individual types:

```javascript
// This WILL work (verified in npc-events.js)
this.eventDispatcher.on('item_picked_up:*', (data) => {
    this.handleItemPickup(data);
});
```

### 2. Missing `object_unlocked` Event

**Issue:** The plan assumes an `object_unlocked` event exists for container unlocks.

**Actual:** The codebase emits `item_unlocked` (not `object_unlocked`):

```javascript
// unlock-system.js line 587-592
window.eventDispatcher.emit('item_unlocked', {
    itemType: lockable.scenarioData.type,
    itemName: lockable.scenarioData.name,
    lockType: lockable.scenarioData.lockType
});
```

**Fix Required:** Update plan to listen to `item_unlocked` instead of `object_unlocked`:

```javascript
// In ObjectivesManager.setupEventListeners()
this.eventDispatcher.on('item_unlocked', (data) => {
    this.handleObjectUnlock(data.itemName); // Note: uses itemName, not objectId
});
```

### 3. Initialization Order Problem

**Issue:** The plan suggests initializing `ObjectivesManager` in `main.js`, but the scenario isn't loaded until `game.js create()`.

**Current Flow:**
1. `main.js` runs → `initializeGame()` creates Phaser game
2. Phaser calls `preload()` → loads scenario JSON
3. Phaser calls `create()` → `window.gameScenario` is set

**Problem:** `ObjectivesManager.initialize(objectives)` needs scenario data, but it's not available during `main.js` execution.

**Fix Required:** Initialize ObjectivesManager in `game.js create()`, not `main.js`:

```javascript
// game.js create() - after gameScenario is loaded (around line 510)
if (gameScenario.objectives) {
    console.log('📋 Initializing objectives from scenario');
    window.objectivesManager?.initialize(gameScenario.objectives);
    window.objectivesPanel = new ObjectivesPanel(window.objectivesManager);
}
```

### 4. Server Routes Conflict with Existing Pattern

**Issue:** Proposed routes don't follow Rails Engine nested resource pattern.

**Proposed:**
```ruby
get 'objectives'
post 'objectives/complete'
post 'objectives/progress'
```

**Problem:** The existing routes use different patterns and `/complete` as a sub-path doesn't cleanly fit Rails conventions.

**Fix Required:** Use RESTful nested resource or different naming:

```ruby
resources :games, only: [:show, :create] do
  member do
    # Existing routes...
    get 'objectives', to: 'games#objectives'
    post 'objectives', to: 'games#complete_objective'  # Use POST body for task_id
    put 'objectives', to: 'games#update_objective_progress'  # Use PUT for updates
  end
end
```

Or add as collection with task_id in path:
```ruby
post 'objectives/:task_id/complete', to: 'games#complete_objective'
put 'objectives/:task_id/progress', to: 'games#update_objective_progress'
```

---

## 🟠 Gaps & Missing Considerations

### 5. No Handling for Key Items in `collect_items`

**Issue:** Keys are handled differently via `addKeyToInventory()` and don't emit the standard `item_picked_up` event with full data.

**Impact:** `collect_items` tasks targeting keys may not increment progress.

**Fix Required:** Ensure key collection also emits the event:

```javascript
// inventory.js addKeyToInventory() - add after line 460
if (window.eventDispatcher) {
    window.eventDispatcher.emit(`item_picked_up:${sprite.scenarioData.type}`, {
        itemType: sprite.scenarioData.type,
        itemName: sprite.scenarioData.name,
        roomId: window.currentPlayerRoom
    });
}
```

### 6. `targetObject` vs `itemName` Mismatch

**Issue:** The plan uses `targetObject` for unlock_object tasks, but events provide `itemName` or `itemType`.

**Impact:** Task matching will fail if object identifiers don't match.

**Fix Required:** Clarify the identifier strategy. Options:
- Use `scenarioData.name` (human readable, may have duplicates)
- Use `scenarioData.id` (unique, requires adding id to all objects)
- Use `objectId` (auto-generated, unpredictable)

**Recommendation:** Add optional `objectId` to scenario objects and use that for task matching:
```json
{
  "type": "safe",
  "objectId": "ceo_safe",
  "name": "CEO's Personal Safe",
  "locked": true
}
```

### 7. No State Restoration on Page Reload

**Issue:** The plan mentions `restoreState()` but doesn't show how server state gets into `window.gameState.objectives`.

**Fix Required:** Include objectives state in initial game load or scenario bootstrap:

```ruby
# games_controller.rb - scenario action
def scenario
  filtered = @game.filtered_scenario_for_bootstrap
  filtered['objectivesState'] = @game.player_state['objectives']  # Add this
  render json: filtered
end
```

```javascript
// game.js create() - after loading scenario
if (gameScenario.objectivesState) {
    window.gameState.objectives = gameScenario.objectivesState;
}
```

### 8. No Handling for Already-Completed Tasks

**Issue:** If a player collects item #3 of 5 before objectives system initializes, progress is lost.

**Fix Required:** Add a reconciliation step on initialize:

```javascript
initialize(objectivesData) {
  // ... existing code ...
  
  // Reconcile with current game state
  this.reconcileWithGameState();
}

reconcileWithGameState() {
  // Check inventory for items matching collect_items tasks
  const inventory = window.inventory?.items || [];
  Object.values(this.taskIndex).forEach(task => {
    if (task.type === 'collect_items' && task.status === 'active') {
      const matchingItems = inventory.filter(item => 
        task.targetItems.includes(item.scenarioData?.type)
      );
      if (matchingItems.length > task.currentCount) {
        task.currentCount = matchingItems.length;
        if (task.currentCount >= task.targetCount) {
          this.completeTask(task.taskId);
        }
      }
    }
  });
  
  // Check unlocked rooms for unlock_room tasks
  // Check discoveredRooms for enter_room tasks
  // etc.
}
```

### 9. CSS Z-Index Conflicts

**Issue:** The plan uses `z-index: 1500` but notification container uses `z-index: 2000`.

**Consideration:** Objectives panel should appear below notifications but above game canvas.

**Current Layers:**
- `#notification-container`: 2000
- `#objectives-panel` (proposed): 1500
- `#inventory-container`: 1000
- `#health-ui-container`: 1100

**Verdict:** z-index 1500 is appropriate. No change needed.

### 10. Mobile/Responsive Considerations

**Issue:** The objectives panel is fixed at 280px width with no mobile breakpoints.

**Fix Required:** Add responsive CSS:

```css
@media (max-width: 768px) {
  .objectives-panel {
    width: 200px;
    font-size: 12px;
    top: 10px;
    right: 10px;
  }
  
  .objectives-panel.collapsed {
    width: auto;
    max-width: 150px;
  }
}

@media (max-width: 480px) {
  .objectives-panel {
    width: 100%;
    max-width: none;
    top: 0;
    right: 0;
    border-radius: 0;
  }
}
```

---

## 🟡 Improvement Suggestions

### 11. Add `object_id` Attribute to Unlock Events

**Suggestion:** Emit more complete data in unlock events:

```javascript
// unlock-system.js - around line 587
window.eventDispatcher.emit('item_unlocked', {
    objectId: lockable.objectId,  // Add this
    itemType: lockable.scenarioData.type,
    itemName: lockable.scenarioData.name,
    lockType: lockable.scenarioData.lockType
});
```

### 12. Add Sound Effects for Objective Completion

**Suggestion:** Play UI sounds when objectives complete:

```javascript
showTaskCompleteNotification(task) {
    if (window.playUISound) {
        window.playUISound('objective_complete'); // Add this sound
    }
    if (window.gameAlert) {
        window.gameAlert(`✓ ${task.title}`, 'success', 'Task Complete');
    }
}
```

### 13. Persist Panel Collapsed State

**Suggestion:** Save collapsed state in localStorage:

```javascript
toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    this.container.classList.toggle('collapsed', this.isCollapsed);
    localStorage.setItem('objectives_panel_collapsed', this.isCollapsed);
}

createPanel() {
    // ... existing code ...
    this.isCollapsed = localStorage.getItem('objectives_panel_collapsed') === 'true';
    this.container.classList.toggle('collapsed', this.isCollapsed);
}
```

### 14. Add Debug Commands

**Suggestion:** Add console debug helpers:

```javascript
// Expose debug functions
window.debugObjectives = {
    completeTask: (taskId) => window.objectivesManager?.completeTask(taskId),
    unlockAim: (aimId) => window.objectivesManager?.unlockAim(aimId),
    showAll: () => console.table(window.objectivesManager?.getAllAims()),
    reset: () => { /* Reset objectives state */ }
};
```

### 15. Consider Debouncing Server Sync

**Suggestion:** The plan syncs progress on every item pickup. Consider debouncing:

```javascript
syncTaskProgress(taskId, progress) {
    // Clear existing timeout
    if (this.syncTimeouts[taskId]) {
        clearTimeout(this.syncTimeouts[taskId]);
    }
    
    // Debounce sync by 1 second
    this.syncTimeouts[taskId] = setTimeout(() => {
        this._doSync(taskId, progress);
    }, 1000);
}
```

---

## 🔵 Testing Considerations

### 16. Add Integration Test Points

Create `test-objectives.html` similar to other test files:

```html
<!-- Test cases needed -->
1. Collect 3 items, verify progress updates
2. Unlock room, verify task completes
3. Complete all tasks in aim, verify aim completes
4. Chain unlock (task A completes → task B unlocks)
5. Server validation failure handling
6. State persistence across page reload
7. Late initialization reconciliation
```

### 17. Add Rails Model Tests

```ruby
# test/models/break_escape/game_objectives_test.rb
class GameObjectivesTest < ActiveSupport::TestCase
  test "complete_task validates collect_items against inventory"
  test "complete_task validates unlock_room against unlockedRooms"
  test "process_task_completion unlocks next task"
  test "check_aim_completion marks aim complete when all tasks done"
end
```

---

## 📋 Updated TODO Priorities

Based on this review, update the implementation order:

### Phase 0: Prerequisite Fixes (NEW)
- [ ] 0.1 Add `objectId` field to scenario objects that need tracking
- [ ] 0.2 Ensure keys emit `item_picked_up` event
- [ ] 0.3 Decide on object identifier strategy (name vs id)

### Phase 1: Core Infrastructure (Updated)
- [ ] 1.1 Create database migration
- [ ] 1.2 Add Game model methods (with reconciliation)
- [ ] 1.3 Create API endpoints (using corrected route pattern)
- [ ] 1.4 Create `objectives-manager.js` (with corrected event names)
- [ ] 1.5 Add objectives CSS (with responsive breakpoints)

### Phase 2: Event Integration (Updated)
- [ ] 2.1 Subscribe to `item_picked_up:*` (wildcard - this works)
- [ ] 2.2 Subscribe to `door_unlocked` (correct)
- [ ] 2.3 Subscribe to `item_unlocked` (not `object_unlocked`)
- [ ] 2.4 Subscribe to `room_entered` (correct)
- [ ] 2.5 Add reconciliation on initialization

(Continue with remaining phases from original plan...)

---

## Conclusion

The implementation plan is **well-structured** and **mostly correct**, but requires these adjustments:

1. **Event name correction**: `item_unlocked` not `object_unlocked`
2. **Initialization timing**: Move to `game.js create()` after scenario loads
3. **Object identifier strategy**: Need consistent approach
4. **State restoration**: Add `objectivesState` to scenario bootstrap
5. **Reconciliation**: Handle items collected before objectives init

With these fixes, the plan has a high chance of successful implementation.
