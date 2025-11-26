# Objectives System - TODO Checklist

Track implementation progress here. Check off items as completed.

---

## Summary

| Phase | Status | Completed |
|-------|--------|-----------|
| Phase 0: Prerequisites | ✅ | 4/4 |
| Phase 1: Core Infrastructure | ✅ | 7/7 |
| Phase 2: Event Integration | ✅ | 6/6 |
| Phase 3: UI Implementation | ✅ | 7/7 |
| Phase 4: Integration & Wiring | ✅ | 6/6 |
| Phase 5: Server Validation | ✅ | 6/6 |
| Phase 6: Ink Tag Extensions | ✅ | 5/5 |
| Phase 7: Reconciliation & Edge Cases | ✅ | 6/6 |
| Phase 8: Testing | ⬜ | 1/13 |
| Phase 9: Documentation | ⬜ | 0/2 |
| **Total** | **⏳** | **48/62** |

---

## Phase 0: Prerequisites (Do First) ✅
- [x] 0.1 **CRITICAL**: Verify door_unlocked event emission exists in unlock-system.js - ✅ VERIFIED (line 560)
- [x] 0.2 Add key pickup events to inventory.js addKeyToInventory() function - ✅ IMPLEMENTED
- [x] 0.3 Verify item_unlocked event name in unlock-system.js (line ~587) - ✅ VERIFIED
- [x] 0.4 Add objectivesState to server bootstrap in games_controller.rb - ✅ IMPLEMENTED

## Phase 1: Core Infrastructure ✅
- [x] 1.1 Create database migration db/migrate/20251125100000_add_objectives_to_games.rb
- [x] 1.2 Add objective methods to app/models/break_escape/game.rb
- [x] 1.3 Add RESTful API routes to config/routes.rb
- [x] 1.4 Add controller actions to games_controller.rb
- [x] 1.5 Update scenario action to include objectivesState for reload recovery
- [x] 1.6 Create public/break_escape/js/systems/objectives-manager.js
- [x] 1.7 Create public/break_escape/css/objectives.css

## Phase 2: Event Integration ✅
- [x] 2.1 Subscribe to item_picked_up:* wildcard events
- [x] 2.2 Subscribe to door_unlocked events (use connectedRoom)
- [x] 2.3 Subscribe to door_unlocked_by_npc events
- [x] 2.4 Subscribe to item_unlocked events (NOT object_unlocked)
- [x] 2.5 Subscribe to room_entered events
- [x] 2.6 Subscribe to task_completed_by_npc events

## Phase 3: UI Implementation ✅
- [x] 3.1 Create public/break_escape/js/ui/objectives-panel.js
- [x] 3.2 Implement createPanel() with header and content areas
- [x] 3.3 Implement render(aims) for aim/task hierarchy
- [x] 3.4 Implement toggleCollapse() functionality
- [x] 3.5 Add progress text for showProgress: true tasks
- [x] 3.6 Add completion animations (CSS keyframes)
- [x] 3.7 Ensure CSS follows project conventions (2px borders, no border-radius)

## Phase 4: Integration & Wiring ✅
- [x] 4.1 Add imports to public/break_escape/js/main.js
- [x] 4.2 Initialize window.objectivesManager in main.js (manager only)
- [x] 4.3 Call objectivesManager.initialize() in game.js create() after scenario loads
- [x] 4.4 Restore objectivesState to window.gameState.objectives in game.js create()
- [x] 4.5 Create ObjectivesPanel instance in game.js create() (dynamic import)
- [x] 4.6 Add link to objectives.css in show.html.erb template

## Phase 5: Server Validation ✅
- [x] 5.1 Controller calls model methods for validation
- [x] 5.2 Validate collect_items tasks against player_state inventory
- [x] 5.3 Validate unlock_room tasks against room_unlocked?()
- [x] 5.4 Validate unlock_object tasks against object_unlocked?()
- [x] 5.5 Validate npc_conversation tasks against npc_encountered?()
- [x] 5.6 Increment tasks_completed and objectives_completed counters

## Phase 6: Ink Tag Extensions ✅
- [x] 6.1 Add complete_task case to chat-helpers.js processGameActionTags()
- [x] 6.2 Add unlock_task case
- [x] 6.3 Add unlock_aim case
- [x] 6.4 Tags work in phone-chat minigame (uses chat-helpers.js)
- [x] 6.5 Tags work in person-chat minigame (uses chat-helpers.js)

## Phase 7: Reconciliation & Edge Cases ✅
- [x] 7.1 Implement reconcileWithGameState() in ObjectivesManager
- [x] 7.2 Handle collect_items reconciliation (check existing inventory + keys)
- [x] 7.3 Handle unlock_room reconciliation (check discoveredRooms)
- [x] 7.4 Handle enter_room reconciliation (check discoveredRooms)
- [x] 7.5 Add debounced syncTaskProgress() with timeout tracking
- [x] 7.6 Store originalStatus for debug reset functionality

## Phase 8: Testing ⬜
- [x] 8.1 Create test scenario in scenarios/test_objectives.json
- [ ] 8.2 Create test Ink story for NPC conversation objectives
- [ ] 8.3 Test collect_items objective (pick up multiple items)
- [ ] 8.4 Test unlock_room objective (unlock a door)
- [ ] 8.5 Test unlock_object objective (unlock a container)
- [ ] 8.6 Test npc_conversation objective (ink tag completion)
- [ ] 8.7 Test enter_room objective (walk into room)
- [ ] 8.8 Test chained objectives (onComplete.unlockTask)
- [ ] 8.9 Test aim completion (all tasks done → aim complete)
- [ ] 8.10 Test aim unlock conditions (unlockCondition.aimCompleted)
- [ ] 8.11 Test server validation (complete without meeting conditions)
- [ ] 8.12 Test state persistence (reload page, check objectives restored)
- [ ] 8.13 Test reconciliation (collect items, then reload - should reconcile)

## Phase 9: Documentation ⬜
- [ ] 9.1 Create docs/OBJECTIVES_USAGE.md with full documentation
- [ ] 9.2 Update README_scenario_design.md with objectives section

---

## Notes

- **Event names verified**: item_unlocked (NOT object_unlocked), door_unlocked (from unlock-system.js)
- **Door unlock events**: Emitted from unlock-system.js:560, provides both roomId and connectedRoom
- **Key pickup events**: Now emitted as item_picked_up:key from addKeyToInventory()
- **Objectives init**: Happens in game.js create() NOT main.js (scenario not available until then)
- **Server bootstrap**: objectivesState included in scenario response for reload recovery
- **RESTful routes**: POST /objectives/tasks/:task_id (task_id in path)
- **Debug utilities**: window.debugObjectives.showAll() and window.debugObjectives.reset()
