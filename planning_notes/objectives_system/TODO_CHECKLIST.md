# Objectives System - TODO Checklist

Track implementation progress here. Check off items as completed.

---

## Phase 0: Prerequisites (Do First) ✅
- [x] 0.1 **CRITICAL**: Verify `door_unlocked` event emission exists in `unlock-system.js` - ✅ VERIFIED (line 560)
- [x] 0.2 Add key pickup events to `inventory.js` `addKeyToInventory()` function - ✅ IMPLEMENTED
- [x] 0.3 Verify `item_unlocked` event name in `unlock-system.js` (line ~587) - ✅ VERIFIED
- [x] 0.4 Add `objectivesState` to server bootstrap in `games_controller.rb` - ✅ IMPLEMENTED

## Phase 1: Core Infrastructure ⬜
- [ ] 1.1 Create database migration `db/migrate/XXXXXX_add_objectives_to_games.rb`
- [ ] 1.2 Add objective methods to `app/models/break_escape/game.rb`:
  - [ ] `initialize_objectives`
  - [ ] `complete_task!(task_id, validation_data)`
  - [ ] `update_task_progress!(task_id, progress)`
  - [ ] `aim_status(aim_id)` / `task_status(task_id)`
  - [ ] Private helpers: `validate_collection`, `process_task_completion`, etc.
- [ ] 1.3 Add RESTful API routes to `config/routes.rb`:
  - [ ] `GET objectives` - Get current objective state
  - [ ] `POST objectives/tasks/:task_id` - Complete a specific task
  - [ ] `PUT objectives/tasks/:task_id` - Update task progress
- [ ] 1.4 Add controller actions to `games_controller.rb`:
  - [ ] `def objectives`
  - [ ] `def complete_task`
  - [ ] `def update_task_progress`
- [ ] 1.5 Update `scenario` action to include `objectivesState` for reload recovery
- [ ] 1.6 Create `public/break_escape/js/systems/objectives-manager.js`
- [ ] 1.7 Create `public/break_escape/css/objectives.css`

## Phase 2: Event Integration ⬜
- [ ] 2.1 Subscribe to `item_picked_up:*` wildcard events → `handleItemPickup()`
- [ ] 2.2 Subscribe to `door_unlocked` events → `handleRoomUnlock()` (use `connectedRoom`)
- [ ] 2.3 Subscribe to `door_unlocked_by_npc` events
- [ ] 2.4 Subscribe to `item_unlocked` events → `handleObjectUnlock()` (NOT `object_unlocked`)
- [ ] 2.5 Subscribe to `room_entered` events → `handleRoomEntered()`
- [ ] 2.6 Subscribe to `task_completed_by_npc` events

## Phase 3: UI Implementation ⬜
- [ ] 3.1 Create `public/break_escape/js/ui/objectives-panel.js`
- [ ] 3.2 Implement `createPanel()` with header and content areas
- [ ] 3.3 Implement `render(aims)` for aim/task hierarchy
- [ ] 3.4 Implement `toggleCollapse()` functionality
- [ ] 3.5 Add progress text for `showProgress: true` tasks
- [ ] 3.6 Add completion animations (CSS keyframes)
- [ ] 3.7 Ensure CSS follows project conventions (2px borders, no border-radius)

## Phase 4: Integration & Wiring ⬜
- [ ] 4.1 Add imports to `public/break_escape/js/main.js`:
  - [ ] `import ObjectivesManager`
  - [ ] `import ObjectivesPanel`
- [ ] 4.2 Initialize `window.objectivesManager` in `main.js initializeGame()` (manager only)
- [ ] 4.3 Call `objectivesManager.initialize()` in `game.js create()` after scenario loads
- [ ] 4.4 Restore `objectivesState` to `window.gameState.objectives` in `game.js create()`
- [ ] 4.5 Create `ObjectivesPanel` instance in `game.js create()`
- [ ] 4.6 Add `<link>` to objectives.css in game HTML template

## Phase 5: Server Validation ⬜
- [ ] 5.1 Update `sync_state` action to accept/return objectives
- [ ] 5.2 Validate `collect_items` tasks against `player_state['inventory']`
- [ ] 5.3 Validate `unlock_room` tasks against `player_state['unlockedRooms']`
- [ ] 5.4 Validate `unlock_object` tasks against `player_state['unlockedObjects']`
- [ ] 5.5 Validate `npc_conversation` tasks against `player_state['encounteredNPCs']`
- [ ] 5.6 Increment `tasks_completed` and `objectives_completed` counters

## Phase 6: Ink Tag Extensions ⬜
- [ ] 6.1 Add `complete_task` case to `chat-helpers.js` `processGameActionTags()`
- [ ] 6.2 Add `unlock_task` case
- [ ] 6.3 Add `unlock_aim` case
- [ ] 6.4 Test tags in phone-chat minigame
- [ ] 6.5 Test tags in person-chat minigame

## Phase 7: Reconciliation & Edge Cases ⬜
- [ ] 7.1 Implement `reconcileWithGameState()` in ObjectivesManager
- [ ] 7.2 Handle collect_items reconciliation (check existing inventory)
- [ ] 7.3 Handle unlock_room reconciliation (check discoveredRooms)
- [ ] 7.4 Handle enter_room reconciliation (check discoveredRooms)
- [ ] 7.5 Add debounced `syncTaskProgress()` with timeout tracking
- [ ] 7.6 Store `originalStatus` for debug reset functionality

## Phase 8: Testing ⬜
- [ ] 8.1 Create test scenario in `scenarios/test-objectives/scenario.json.erb`
- [ ] 8.2 Create test Ink story in `scenarios/test-objectives/guide.ink`
- [ ] 8.3 Test `collect_items` objective (pick up multiple items)
- [ ] 8.4 Test `unlock_room` objective (unlock a door)
- [ ] 8.5 Test `unlock_object` objective (unlock a container)
- [ ] 8.6 Test `npc_conversation` objective (ink tag completion)
- [ ] 8.7 Test `enter_room` objective (walk into room)
- [ ] 8.8 Test chained objectives (`onComplete.unlockTask`)
- [ ] 8.9 Test aim completion (all tasks done → aim complete)
- [ ] 8.10 Test aim unlock conditions (`unlockCondition.aimCompleted`)
- [ ] 8.11 Test server validation (complete without meeting conditions)
- [ ] 8.12 Test state persistence (reload page, check objectives restored)
- [ ] 8.13 Test reconciliation (collect items, then reload - should reconcile)

## Phase 9: Documentation ⬜
- [ ] 9.1 Create `docs/OBJECTIVES_USAGE.md` with full documentation
- [ ] 9.2 Update `README_scenario_design.md` with objectives section
- [ ] 9.3 Add objectives examples to existing scenario documentation
- [ ] 9.4 Document ink tags in docs/INK_BEST_PRACTICES.md

---

## Notes

_Add implementation notes, blockers, or decisions here:_

- **CRITICAL**: `door_unlocked` events are NOT emitted in current codebase - must add to `doors.js`
- Event name is `item_unlocked` NOT `object_unlocked` (unlock-system.js line 587) ✅
- `door_unlocked` event should provide both `roomId` and `connectedRoom` (use `connectedRoom` for unlock tasks)
- Keys do NOT emit pickup events - requires fix in `addKeyToInventory()`
- Objectives init happens in `game.js create()` NOT `main.js` (scenario not available until then)
- Server includes `objectivesState` in scenario bootstrap for reload recovery
- Use RESTful routes: `POST /objectives/tasks/:task_id` (task_id in path)

---

## Completion Summary

| Phase | Status | Completed |
|-------|--------|-----------|
| Phase 0: Prerequisites | ✅ | 4/4 |
| Phase 1: Core Infrastructure | ⬜ | 0/7 |
| Phase 2: Event Integration | ⬜ | 0/6 |
| Phase 3: UI Implementation | ⬜ | 0/7 |
| Phase 4: Integration | ⬜ | 0/6 |
| Phase 5: Server Validation | ⬜ | 0/6 |
| Phase 6: Ink Tags | ⬜ | 0/5 |
| Phase 7: Reconciliation | ⬜ | 0/6 |
| Phase 8: Testing | ⬜ | 0/13 |
| Phase 9: Documentation | ⬜ | 0/4 |
| **Total** | **⬜** | **4/64** |
