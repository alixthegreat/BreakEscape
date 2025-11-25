# Objectives System - Quick Reference

## Task Types at a Glance

| Type | Trigger | Event Name | Example |
|------|---------|------------|---------|
| `collect_items` | Player picks up items | `item_picked_up:*` | Find 3 documents |
| `unlock_room` | Door unlocked | `door_unlocked` (use `connectedRoom`) | Access server room |
| `unlock_object` | Container unlocked | `item_unlocked` (NOT `object_unlocked`) | Open the safe |
| `npc_conversation` | Ink tag `#complete_task:X` | `task_completed_by_npc` | Talk to handler |
| `enter_room` | Player enters room | `room_entered` | Explore the lab |
| `custom` | Ink tag `#complete_task:X` | `task_completed_by_npc` | Any other trigger |

## Ink Tags

```ink
# complete_task:taskId    -> Marks task complete
# unlock_task:taskId      -> Makes locked task active
# unlock_aim:aimId        -> Makes locked aim active
```

## Scenario JSON Template

```json
{
  "objectives": [
    {
      "aimId": "unique_aim_id",
      "title": "High-level goal",
      "description": "Optional longer description",
      "status": "active|locked",
      "order": 1,
      "unlockCondition": { "aimCompleted": "other_aim_id" },
      "tasks": [
        {
          "taskId": "unique_task_id",
          "title": "What player sees",
          "type": "collect_items|unlock_room|unlock_object|npc_conversation|enter_room|custom",
          "targetItems": ["item_type"],
          "targetCount": 3,
          "targetRoom": "room_id",
          "targetObject": "Object Name",
          "targetNpc": "npc_id",
          "status": "active|locked",
          "showProgress": true,
          "onComplete": {
            "unlockTask": "next_task_id",
            "unlockAim": "next_aim_id"
          }
        }
      ]
    }
  ]
}
```

## API Endpoints (RESTful)

```
GET  /break_escape/games/:id/objectives                # Get current state
POST /break_escape/games/:id/objectives/tasks/:task_id # Complete a task
PUT  /break_escape/games/:id/objectives/tasks/:task_id # Update progress
```

## Events Emitted

```javascript
// Task completed
eventDispatcher.emit('objective_task_completed', { taskId, aimId, task });

// Aim completed
eventDispatcher.emit('objective_aim_completed', { aimId, aim });
```

## Events Listened To

```javascript
'item_picked_up:*'      // For collect_items (wildcard pattern)
'door_unlocked'         // For unlock_room (use data.connectedRoom)
'item_unlocked'         // For unlock_object (NOT object_unlocked!)
'room_entered'          // For enter_room
'task_completed_by_npc' // From ink tags
```

## Initialization Order

1. `main.js`: Create `ObjectivesManager` instance (manager only)
2. `game.js create()`: Restore `objectivesState` from server to `window.gameState.objectives`
3. `game.js create()`: Call `objectivesManager.initialize(gameScenario.objectives)`
4. `game.js create()`: Create `ObjectivesPanel` instance

> **CRITICAL**: Objectives data initialization MUST happen in `game.js create()`, NOT `main.js`. Scenario JSON isn't available until `create()` runs.

## CSS Classes

```css
.objectives-panel       /* Main container */
.objectives-panel.collapsed
.objective-aim          /* Aim container */
.aim-active / .aim-completed
.objective-task         /* Task container */
.task-active / .task-completed
```

## Global Access

```javascript
window.objectivesManager.completeTask('taskId');
window.objectivesManager.unlockTask('taskId');
window.objectivesManager.unlockAim('aimId');
window.objectivesManager.getActiveAims();
window.objectivesManager.reconcileWithGameState();

// Debug utilities
window.debugObjectives.showAll();
window.debugObjectives.reset();
```

## Key Gotchas

1. **Event name**: `item_unlocked` NOT `object_unlocked`
2. **Door unlock events**: Emitted from `unlock-system.js:560` (NOT doors.js)
3. **Door event data**: Provides both `roomId` AND `connectedRoom` (use `connectedRoom` for unlock tasks)
4. **Key pickup events**: Now emitted as `item_picked_up:key` from `addKeyToInventory()`
5. **State restoration**: Server passes `objectivesState` in scenario bootstrap
6. **Reconciliation**: Call `reconcileWithGameState()` after init for late-loaded scenarios
