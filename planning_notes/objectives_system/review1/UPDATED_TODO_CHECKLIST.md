# Updated TODO Checklist - Post-Review

Based on the implementation review, here's the corrected and prioritized TODO list.

---

## Phase 0: Prerequisite Fixes 🔴 HIGH PRIORITY
_Must be done before starting main implementation_

- [ ] 0.1 **Add key pickup event emission** in `inventory.js` `addKeyToInventory()`
  - Currently keys don't emit `item_picked_up` event
  - Blocks: collect_items tasks for keys
  
- [ ] 0.2 **Decide on object identifier strategy**
  - Option A: Use `scenarioData.name` (simpler, may have duplicates)
  - Option B: Add `objectId` field to scenario objects (cleaner, requires scenario updates)
  - **Recommendation:** Use `itemName` for now, document that names must be unique per room

- [ ] 0.3 **Verify event names match actual codebase**
  - ✅ `item_picked_up:*` - works with wildcard
  - ✅ `door_unlocked` - correct
  - ❌ `object_unlocked` → should be `item_unlocked`
  - ✅ `room_entered` - correct

---

## Phase 1: Core Infrastructure
_Server-side and client-side core modules_

### Database & Model
- [ ] 1.1 Create migration `db/migrate/XXXXXX_add_objectives_to_games.rb`
  ```ruby
  add_column :break_escape_games, :objectives_completed, :integer, default: 0
  add_column :break_escape_games, :tasks_completed, :integer, default: 0
  ```

- [ ] 1.2 Add objective methods to `app/models/break_escape/game.rb`:
  - [ ] `initialize_objectives`
  - [ ] `complete_task!(task_id, validation_data = {})`
  - [ ] `update_task_progress!(task_id, progress)`
  - [ ] `aim_status(aim_id)` / `task_status(task_id)`
  - [ ] `task_progress(task_id)`
  - [ ] Private: `validate_collection`, `process_task_completion`, etc.
  - [ ] Private: `find_task_in_scenario(task_id)`

### API Routes & Controller
- [ ] 1.3 Add routes to `config/routes.rb`:
  ```ruby
  get 'objectives'
  post 'objectives/tasks/:task_id', to: 'games#complete_task'
  put 'objectives/tasks/:task_id', to: 'games#update_task_progress'
  ```

- [ ] 1.4 Add controller actions:
  - [ ] `def objectives` - GET current state
  - [ ] `def complete_task` - POST complete a task
  - [ ] `def update_task_progress` - PUT update progress

- [ ] 1.5 **Include objectives state in scenario bootstrap**
  - Update `scenario` action to include `objectivesState`

### Client Module
- [ ] 1.6 Create `public/break_escape/js/systems/objectives-manager.js`
  - Use corrected event names (`item_unlocked` not `object_unlocked`)
  - Include `reconcileWithGameState()` method

- [ ] 1.7 Create `public/break_escape/css/objectives.css`
  - Include responsive breakpoints

---

## Phase 2: Event Integration
_Wire up to existing game events_

- [ ] 2.1 Subscribe to `item_picked_up:*` → `handleItemPickup()`
  - **Note:** Wildcard works, verified in NPCEventDispatcher

- [ ] 2.2 Subscribe to `door_unlocked` → `handleRoomUnlock()`
  - **Note:** Use `data.connectedRoom` for room ID

- [ ] 2.3 Subscribe to `door_unlocked_by_npc` → `handleRoomUnlock()`

- [ ] 2.4 Subscribe to `item_unlocked` → `handleObjectUnlock()`
  - **CORRECTED:** Event name is `item_unlocked`, not `object_unlocked`

- [ ] 2.5 Subscribe to `room_entered` → `handleRoomEntered()`

- [ ] 2.6 Subscribe to `task_completed_by_npc` (from ink tags)

- [ ] 2.7 **Implement reconciliation** on initialize
  - Check inventory for existing items
  - Check discoveredRooms for visited rooms
  - Check unlockedRooms for unlocked doors

---

## Phase 3: UI Implementation
_Objectives panel display_

- [ ] 3.1 Create `public/break_escape/js/ui/objectives-panel.js`

- [ ] 3.2 Implement `createPanel()` with header and content

- [ ] 3.3 Implement `render(aims)` for aim/task hierarchy

- [ ] 3.4 Implement `toggleCollapse()` with localStorage persistence

- [ ] 3.5 Add progress text for `showProgress: true` tasks

- [ ] 3.6 Add CSS animations for:
  - New objective appearance
  - Task completion
  - Progress updates

---

## Phase 4: Integration & Wiring
_Connect all pieces together_

- [ ] 4.1 Add imports to `public/break_escape/js/main.js`:
  ```javascript
  import ObjectivesManager, { getObjectivesManager } from './systems/objectives-manager.js';
  ```

- [ ] 4.2 Create ObjectivesManager instance in `main.js initializeGame()`
  ```javascript
  window.objectivesManager = getObjectivesManager(window.eventDispatcher);
  ```

- [ ] 4.3 **Initialize from scenario in `game.js create()`** (CORRECTED LOCATION)
  ```javascript
  if (gameScenario.objectives && window.objectivesManager) {
      // Restore state first
      if (gameScenario.objectivesState) {
          window.gameState.objectives = gameScenario.objectivesState;
      }
      window.objectivesManager.initialize(gameScenario.objectives);
      window.objectivesPanel = new ObjectivesPanel(window.objectivesManager);
  }
  ```

- [ ] 4.4 Add `<link>` to objectives.css in game HTML template

- [ ] 4.5 Export `window.objectivesManager` for global access

---

## Phase 5: Server Validation
_Ensure server validates completions_

- [ ] 5.1 Update `sync_state` action to accept/return objectives

- [ ] 5.2 Validate `collect_items` against `player_state['inventory']`

- [ ] 5.3 Validate `unlock_room` against `player_state['unlockedRooms']`

- [ ] 5.4 Validate `unlock_object` against `player_state['unlockedObjects']`

- [ ] 5.5 Validate `npc_conversation` against `player_state['encounteredNPCs']`

- [ ] 5.6 Return `objectivesState` in filtered_scenario_for_bootstrap

---

## Phase 6: Ink Tag Extensions
_Add objective-related tags to NPC dialogues_

- [ ] 6.1 Add `complete_task` case to `chat-helpers.js` `processGameActionTags()`
  ```javascript
  case 'complete_task':
      window.eventDispatcher.emit('task_completed_by_npc', { taskId: param });
  ```

- [ ] 6.2 Add `unlock_task` case

- [ ] 6.3 Add `unlock_aim` case

- [ ] 6.4 Test in phone-chat minigame

- [ ] 6.5 Test in person-chat minigame

---

## Phase 7: Testing
_Comprehensive testing_

### Manual Test Cases
- [ ] 7.1 Create test scenario `scenarios/test-objectives/scenario.json.erb`
  - Include all task types
  - Include chained objectives
  - Include locked aims

- [ ] 7.2 Test `collect_items` (pick up 3 documents)

- [ ] 7.3 Test `collect_items` with keys (via keyRing)

- [ ] 7.4 Test `unlock_room` (unlock a door)

- [ ] 7.5 Test `unlock_object` (unlock a container)

- [ ] 7.6 Test `npc_conversation` (ink tag completion)

- [ ] 7.7 Test `enter_room` (walk into room)

- [ ] 7.8 Test chained objectives (`onComplete.unlockTask`)

- [ ] 7.9 Test aim completion (all tasks done)

- [ ] 7.10 Test aim unlock conditions (`unlockCondition.aimCompleted`)

### Edge Cases
- [ ] 7.11 Test server validation rejection

- [ ] 7.12 Test state persistence (reload page)

- [ ] 7.13 Test reconciliation (collect items, then load objectives)

- [ ] 7.14 Test offline mode (no gameId)

---

## Phase 8: Documentation
_Final documentation updates_

- [ ] 8.1 Create `docs/OBJECTIVES_USAGE.md`
  - Schema reference
  - Task types
  - Ink tags
  - Examples

- [ ] 8.2 Update `README_scenario_design.md` with objectives section

- [ ] 8.3 Add debug utilities documentation

- [ ] 8.4 Document ink tags in `docs/INK_BEST_PRACTICES.md`

---

## Completion Tracking

| Phase | Status | Items |
|-------|--------|-------|
| Phase 0: Prerequisites | ⬜ | 0/3 |
| Phase 1: Core Infrastructure | ⬜ | 0/7 |
| Phase 2: Event Integration | ⬜ | 0/7 |
| Phase 3: UI Implementation | ⬜ | 0/6 |
| Phase 4: Integration | ⬜ | 0/5 |
| Phase 5: Server Validation | ⬜ | 0/6 |
| Phase 6: Ink Tags | ⬜ | 0/5 |
| Phase 7: Testing | ⬜ | 0/14 |
| Phase 8: Documentation | ⬜ | 0/4 |
| **Total** | **⬜** | **0/57** |

---

## Key Corrections from Review

1. ✅ Event `item_unlocked` not `object_unlocked`
2. ✅ Initialize in `game.js create()` not `main.js`
3. ✅ Include `objectivesState` in scenario bootstrap
4. ✅ Add reconciliation for late initialization
5. ✅ Emit events for key pickups
6. ✅ Use RESTful routes with task_id in path
7. ✅ Add responsive CSS breakpoints
