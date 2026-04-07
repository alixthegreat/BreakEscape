/**
 * Shared action executor for scenario-defined action descriptors.
 *
 * The same descriptor format is used by flag-station `flagRewards`,
 * object `triggerOnInteract`, and any other source that needs to produce
 * side-effects in the game world without duplicating the dispatch logic.
 *
 * Supported action types:
 *   set_global     { key, value }    — patches gameState.globalVariables and fires
 *                                      global_variable_changed:<key>
 *   emit_event     { event_name }    — fires a raw eventDispatcher event
 *   complete_task  { taskId }        — marks an objective task complete
 *   unlock_object  { objectId }      — unlocks a world object (+ optional server persist)
 *   unlock_door    { room_id }       — adds room_id to gameState.unlockedRooms
 *   give_item      { item }          — adds an item sprite to the player inventory
 *
 * @param {Array}  actions            Array of action descriptor objects.
 * @param {Object} [opts]
 * @param {string} [opts.source]      Label attached to emitted events (e.g. 'flag_reward',
 *                                    'object_interact'). Defaults to 'scenario'.
 * @param {*}      [opts.gameId]      Game ID passed to ApiClient for server-side persists.
 */
export function applyActions(actions, { source = 'scenario', gameId = null } = {}) {
    if (!Array.isArray(actions) || actions.length === 0) return;

    for (const action of actions) {
        switch (action.type) {

            case 'set_global':
                if (action.key !== undefined && window.gameState?.globalVariables) {
                    window.gameState.globalVariables[action.key] = action.value;
                    window.eventDispatcher?.emit(`global_variable_changed:${action.key}`, {
                        name: action.key,
                        value: action.value
                    });
                    console.log(`[applyActions] set_global ${action.key} =`, action.value);
                }
                break;

            case 'emit_event':
                if (action.event_name && window.eventDispatcher) {
                    window.eventDispatcher.emit(action.event_name, { source });
                }
                break;

            case 'complete_task':
                if (action.taskId) {
                    if (window.objectivesManager) {
                        window.objectivesManager.completeTask(action.taskId);
                        console.log('[applyActions] Completed task:', action.taskId);
                    } else {
                        console.warn('[applyActions] objectivesManager not available');
                    }
                }
                break;

            case 'unlock_object':
                if (action.objectId) {
                    window.eventDispatcher?.emit('object_remotely_unlocked', {
                        objectId: action.objectId,
                        source
                    });
                    const apiClient = window.ApiClient || window.APIClient;
                    if (apiClient && gameId) {
                        apiClient.unlock('object', action.objectId, null, source).catch(err =>
                            console.warn('[applyActions] Failed to persist object unlock:', err)
                        );
                    }
                }
                break;

            case 'unlock_door':
                if (action.room_id) {
                    if (window.gameState?.unlockedRooms && !window.gameState.unlockedRooms.includes(action.room_id)) {
                        window.gameState.unlockedRooms.push(action.room_id);
                    }
                    window.eventDispatcher?.emit('door_unlocked', { roomId: action.room_id, source });
                }
                break;

            case 'give_item':
                if (action.item && window.addToInventory) {
                    const itemSprite = {
                        name: action.item.type,
                        objectId: `action_item_${action.item.name}_${Date.now()}`,
                        scenarioData: action.item,
                        texture: { key: action.item.type },
                        keyPins: action.item.keyPins,
                        key_id: action.item.key_id || action.item.keyId,
                        setVisible: function() { return this; }
                    };
                    console.log('[applyActions] give_item:', action.item.name);
                    window.addToInventory(itemSprite);
                }
                break;

            default:
                console.warn('[applyActions] Unknown action type:', action.type, action);
        }
    }
}
