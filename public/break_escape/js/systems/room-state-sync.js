/**
 * Room State Sync System
 * 
 * Syncs dynamic room state changes to the server for persistence across sessions.
 * Tracks items added/removed, NPC movements, and object state changes.
 * 
 * All changes are validated server-side to prevent cheating.
 */

/**
 * Add an item to a room (e.g., NPC drops an item)
 * @param {string} roomId - Room ID
 * @param {object} item - Item data (must include type, id, name, etc.)
 * @param {object} options - Optional source data (npcId, sourceType)
 * @returns {Promise<boolean>} Success status
 */
export async function addItemToRoom(roomId, item, options = {}) {
    const gameId = window.breakEscapeConfig?.gameId;
    if (!gameId) {
        console.error('Cannot sync room state: gameId not available');
        return false;
    }

    try {
        const response = await fetch(`/break_escape/games/${gameId}/update_room`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
            },
            body: JSON.stringify({
                roomId: roomId,
                actionType: 'add_object',
                data: item,
                sourceNpcId: options.npcId,
                sourceType: options.sourceType
            })
        });

        const result = await response.json();
        
        if (result.success) {
            console.log(`✅ Synced item add to room ${roomId}:`, item.type);
            
            // Update local room state if room is loaded
            if (window.rooms && window.rooms[roomId]) {
                window.rooms[roomId].objects = window.rooms[roomId].objects || {};
                window.rooms[roomId].objects[item.id] = item;
            }
            
            return true;
        } else {
            console.warn(`❌ Failed to sync item add: ${result.message}`);
            return false;
        }
    } catch (error) {
        console.error('Error syncing item add to room:', error);
        return false;
    }
}

/**
 * Remove an item from a room (e.g., player picks up)
 * @param {string} roomId - Room ID
 * @param {string} itemId - Item ID to remove
 * @returns {Promise<boolean>} Success status
 */
export async function removeItemFromRoom(roomId, itemId) {
    const gameId = window.breakEscapeConfig?.gameId;
    if (!gameId) {
        console.error('Cannot sync room state: gameId not available');
        return false;
    }

    try {
        const response = await fetch(`/break_escape/games/${gameId}/update_room`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
            },
            body: JSON.stringify({
                roomId: roomId,
                actionType: 'remove_object',
                data: { id: itemId }
            })
        });

        const result = await response.json();
        
        if (result.success) {
            console.log(`✅ Synced item removal from room ${roomId}: ${itemId}`);
            
            // Update local room state if room is loaded
            if (window.rooms && window.rooms[roomId] && window.rooms[roomId].objects) {
                delete window.rooms[roomId].objects[itemId];
            }
            
            return true;
        } else {
            console.warn(`❌ Failed to sync item removal: ${result.message}`);
            return false;
        }
    } catch (error) {
        console.error('Error syncing item removal from room:', error);
        return false;
    }
}

/**
 * Update object state in a room (e.g., container opened, light switched)
 * @param {string} roomId - Room ID
 * @param {string} objectId - Object ID
 * @param {object} stateChanges - State properties to update
 * @returns {Promise<boolean>} Success status
 */
export async function updateObjectState(roomId, objectId, stateChanges) {
    const gameId = window.breakEscapeConfig?.gameId;
    if (!gameId) {
        console.error('Cannot sync room state: gameId not available');
        return false;
    }

    try {
        const response = await fetch(`/break_escape/games/${gameId}/update_room`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
            },
            body: JSON.stringify({
                roomId: roomId,
                actionType: 'update_object_state',
                data: {
                    objectId: objectId,
                    stateChanges: stateChanges
                }
            })
        });

        const result = await response.json();
        
        if (result.success) {
            console.log(`✅ Synced object state update in room ${roomId}:`, objectId, stateChanges);
            
            // Update local room state if room is loaded
            if (window.rooms && window.rooms[roomId] && window.rooms[roomId].objects) {
                const obj = window.rooms[roomId].objects[objectId];
                if (obj) {
                    Object.assign(obj, stateChanges);
                }
            }
            
            return true;
        } else {
            console.warn(`❌ Failed to sync object state: ${result.message}`);
            return false;
        }
    } catch (error) {
        console.error('Error syncing object state:', error);
        return false;
    }
}

/**
 * Move NPC between rooms
 * @param {string} npcId - NPC ID
 * @param {string} fromRoomId - Source room ID
 * @param {string} toRoomId - Target room ID
 * @returns {Promise<boolean>} Success status
 */
export async function moveNpcToRoom(npcId, fromRoomId, toRoomId) {
    const gameId = window.breakEscapeConfig?.gameId;
    if (!gameId) {
        console.error('Cannot sync room state: gameId not available');
        return false;
    }

    try {
        const response = await fetch(`/break_escape/games/${gameId}/update_room`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
            },
            body: JSON.stringify({
                roomId: toRoomId, // Target room
                actionType: 'move_npc',
                data: {
                    npcId: npcId,
                    fromRoom: fromRoomId,
                    toRoom: toRoomId
                }
            })
        });

        const result = await response.json();
        
        if (result.success) {
            console.log(`✅ Synced NPC move: ${npcId} from ${fromRoomId} to ${toRoomId}`);
            
            // Update local room state if rooms are loaded
            if (window.rooms) {
                // Remove from source room
                if (window.rooms[fromRoomId]) {
                    window.rooms[fromRoomId].npcs = window.rooms[fromRoomId].npcs || [];
                    window.rooms[fromRoomId].npcs = window.rooms[fromRoomId].npcs.filter(npc => npc.id !== npcId);
                }
                
                // Add to target room (need to get NPC data)
                if (window.rooms[toRoomId] && window.npcManager) {
                    const npcData = window.npcManager.getNPC(npcId);
                    if (npcData) {
                        window.rooms[toRoomId].npcs = window.rooms[toRoomId].npcs || [];
                        window.rooms[toRoomId].npcs.push({ ...npcData, roomId: toRoomId });
                    }
                }
            }
            
            return true;
        } else {
            console.warn(`❌ Failed to sync NPC move: ${result.message}`);
            return false;
        }
    } catch (error) {
        console.error('Error syncing NPC move:', error);
        return false;
    }
}

/**
 * Batch update room state (for efficiency when multiple changes happen together)
 * @param {Array<object>} updates - Array of update operations
 * @returns {Promise<boolean>} Success status
 */
export async function batchUpdateRoomState(updates) {
    const promises = updates.map(update => {
        switch (update.type) {
            case 'add_item':
                return addItemToRoom(update.roomId, update.item, update.options);
            case 'remove_item':
                return removeItemFromRoom(update.roomId, update.itemId);
            case 'update_object':
                return updateObjectState(update.roomId, update.objectId, update.stateChanges);
            case 'move_npc':
                return moveNpcToRoom(update.npcId, update.fromRoomId, update.toRoomId);
            default:
                console.warn(`Unknown update type: ${update.type}`);
                return Promise.resolve(false);
        }
    });

    try {
        const results = await Promise.all(promises);
        const allSucceeded = results.every(r => r === true);
        
        if (allSucceeded) {
            console.log(`✅ Batch room state update completed: ${updates.length} operations`);
        } else {
            console.warn(`⚠️ Batch room state update partially failed`);
        }
        
        return allSucceeded;
    } catch (error) {
        console.error('Error in batch room state update:', error);
        return false;
    }
}

// Export to window for global access
window.RoomStateSync = {
    addItemToRoom,
    removeItemFromRoom,
    updateObjectState,
    moveNpcToRoom,
    batchUpdateRoomState
};

console.log('✅ Room State Sync system loaded');
