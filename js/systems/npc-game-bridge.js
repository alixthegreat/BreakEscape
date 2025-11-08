/**
 * NPC Game Bridge
 * 
 * Provides a safe API for NPCs to influence game state through Ink stories.
 * NPCs can unlock doors, give items, set objectives, reveal secrets, and more.
 * 
 * This bridge is the primary interface between NPC dialogue (Ink) and game mechanics.
 */

export class NPCGameBridge {
  constructor() {
    this.actionLog = [];
    this.maxLogSize = 100;
  }

  /**
   * Log an action for debugging and auditing
   */
  _logAction(action, params, result) {
    this.actionLog.push({
      timestamp: Date.now(),
      action,
      params,
      result,
      success: result.success !== false
    });
    
    // Keep log size manageable
    if (this.actionLog.length > this.maxLogSize) {
      this.actionLog.shift();
    }
    
    console.log(`🔗 [NPC Game Bridge] ${action}:`, params, '→', result);
  }

    /**
   * Unlock a door to a specific room
   * @param {string} roomId - The ID of the room to unlock
   * @returns {Object} Result object with success status
   */
  unlockDoor(roomId) {
    if (!roomId) {
      const result = { success: false, error: 'No roomId provided' };
      this._logAction('unlockDoor', { roomId }, result);
      return result;
    }

    console.log(`🔓 NPCGameBridge: Attempting to unlock door to ${roomId}`);
    
    let doorFound = false;

    // Method 1: Find and unlock the target room in gameScenario (persistent data)
    if (window.gameScenario && window.gameScenario.rooms) {
      const targetRoom = window.gameScenario.rooms[roomId];
      if (targetRoom && targetRoom.locked) {
        targetRoom.locked = false;
        doorFound = true;
        console.log(`🔓 Unlocked room ${roomId} in gameScenario`);
      }
    }

    // Method 2: Find and unlock in runtime rooms data
    if (window.rooms && window.rooms[roomId]) {
      window.rooms[roomId].locked = false;
      doorFound = true;
      console.log(`🔓 Unlocked room ${roomId} in runtime rooms`);
    }

    // Method 3: Find door sprites and unlock them (if game scene is loaded)
    if (window.game && window.game.scene && window.game.scene.scenes && window.game.scene.scenes.length > 0) {
      const scene = window.game.scene.scenes[0];
      
      // Look for door sprites that lead to this room
      if (scene && scene.children && scene.children.list) {
        scene.children.list.forEach(child => {
          if (child.doorProperties && child.doorProperties.connectedRoom === roomId) {
            child.doorProperties.locked = false;
            doorFound = true;
            console.log(`🔓 Unlocked door sprite to ${roomId}`);
          }
        });
      }
    }

    // Emit event
    if (doorFound && window.eventDispatcher) {
      window.eventDispatcher.emit('door_unlocked_by_npc', { 
        roomId,
        source: 'npc'
      });
    }

    const result = { 
      success: doorFound, 
      roomId,
      message: doorFound ? `Door to ${roomId} unlocked` : `Room ${roomId} not found or not locked`
    };
    this._logAction('unlockDoor', { roomId }, result);
    return result;
  }

  /**
   * Give an item from NPC's inventory to the player immediately
   * @param {string} npcId - NPC identifier
   * @param {string} itemType - Type of item to give (optional - gives first if null)
   * @returns {Object} Result with success status
   */
  giveItem(npcId, itemType = null) {
    if (!npcId) {
      const result = { success: false, error: 'No npcId provided' };
      this._logAction('giveItem', { npcId, itemType }, result);
      return result;
    }

    // Get NPC from manager
    const npc = window.npcManager?.getNPC(npcId);
    if (!npc) {
      const result = { success: false, error: `NPC ${npcId} not found` };
      this._logAction('giveItem', { npcId, itemType }, result);
      return result;
    }

    if (!npc.itemsHeld || npc.itemsHeld.length === 0) {
      const result = { success: false, error: `NPC ${npcId} has no items to give` };
      this._logAction('giveItem', { npcId, itemType }, result);
      return result;
    }

    // Find item in NPC's inventory
    let itemIndex = -1;
    if (itemType) {
      // Find first item matching type
      itemIndex = npc.itemsHeld.findIndex(item => item.type === itemType);
      if (itemIndex === -1) {
        const result = { success: false, error: `NPC ${npcId} doesn't have ${itemType}` };
        this._logAction('giveItem', { npcId, itemType }, result);
        return result;
      }
    } else {
      // Give first item
      itemIndex = 0;
    }

    const item = npc.itemsHeld[itemIndex];

    if (!window.addToInventory) {
      const result = { success: false, error: 'Inventory system not available' };
      this._logAction('giveItem', { npcId, itemType }, result);
      return result;
    }

    try {
      // Create sprite using container pattern
      const tempSprite = {
        scenarioData: item,
        name: item.type,
        objectId: `npc_gift_${npcId}_${item.type}_${Date.now()}`,
        texture: { key: item.type }
      };

      // Add to player inventory
      window.addToInventory(tempSprite);

      // Remove from NPC's inventory
      npc.itemsHeld.splice(itemIndex, 1);

      // Emit event to update Ink variables
      if (window.eventDispatcher) {
        window.eventDispatcher.emit('npc_items_changed', { npcId });
      }

      const result = { success: true, item, npcId };
      this._logAction('giveItem', { npcId, itemType }, result);
      return result;
    } catch (error) {
      const result = { success: false, error: error.message };
      this._logAction('giveItem', { npcId, itemType }, result);
      return result;
    }
  }

  /**
   * Show NPC's inventory items in container UI
   * @param {string} npcId - NPC identifier
   * @param {string[]} filterTypes - Array of item types to show (null = all)
   * @returns {Object} Result with success status
   */
  showNPCInventory(npcId, filterTypes = null) {
    if (!npcId) {
      const result = { success: false, error: 'No npcId provided' };
      this._logAction('showNPCInventory', { npcId, filterTypes }, result);
      return result;
    }

    const npc = window.npcManager?.getNPC(npcId);
    if (!npc) {
      const result = { success: false, error: `NPC ${npcId} not found` };
      this._logAction('showNPCInventory', { npcId, filterTypes }, result);
      return result;
    }

    if (!npc.itemsHeld || npc.itemsHeld.length === 0) {
      const result = { success: false, error: `NPC ${npcId} has no items` };
      this._logAction('showNPCInventory', { npcId, filterTypes }, result);
      return result;
    }

    // Filter items if types specified
    let itemsToShow = npc.itemsHeld;
    if (filterTypes && filterTypes.length > 0) {
      itemsToShow = npc.itemsHeld.filter(item => 
        filterTypes.includes(item.type)
      );
    }

    if (itemsToShow.length === 0) {
      const result = { success: false, error: 'No matching items to show' };
      this._logAction('showNPCInventory', { npcId, filterTypes }, result);
      return result;
    }

    // Open container minigame in NPC mode
    if (window.startContainerMinigame) {
      window.startContainerMinigame({
        name: `${npc.displayName}'s Items`,
        contents: itemsToShow,
        mode: 'npc',
        npcId: npcId,
        npcDisplayName: npc.displayName,
        npcAvatar: npc.avatar
      });

      const result = { success: true, npcId, itemCount: itemsToShow.length };
      this._logAction('showNPCInventory', { npcId, filterTypes }, result);
      return result;
    } else {
      const result = { success: false, error: 'Container minigame not available' };
      this._logAction('showNPCInventory', { npcId, filterTypes }, result);
      return result;
    }
  }

  /**
   * Set the current objective text
   * @param {string} text - Objective text to display
   * @returns {Object} Result object with success status
   */
  setObjective(text) {
    if (!text) {
      const result = { success: false, error: 'No objective text provided' };
      this._logAction('setObjective', { text }, result);
      return result;
    }

    if (!window.gameState) {
      window.gameState = {};
    }

    window.gameState.currentObjective = text;

    // Show notification if notification system exists
    if (window.showNotification) {
      window.showNotification(`New Objective: ${text}`, 'objective');
    } else {
      console.log(`📋 New Objective: ${text}`);
    }

    // Emit event
    if (window.eventDispatcher) {
      window.eventDispatcher.emit('objective_set', {
        objective: text,
        source: 'npc'
      });
    }

    const result = { success: true, objective: text };
    this._logAction('setObjective', { text }, result);
    return result;
  }

  /**
   * Reveal a secret or piece of information
   * @param {string} secretId - Unique identifier for the secret
   * @param {*} data - The secret data (string, object, etc.)
   * @returns {Object} Result object with success status
   */
  revealSecret(secretId, data) {
    if (!secretId) {
      const result = { success: false, error: 'No secretId provided' };
      this._logAction('revealSecret', { secretId, data }, result);
      return result;
    }

    if (!window.gameState) {
      window.gameState = {};
    }

    if (!window.gameState.revealedSecrets) {
      window.gameState.revealedSecrets = {};
    }

    window.gameState.revealedSecrets[secretId] = {
      data,
      timestamp: Date.now(),
      source: 'npc'
    };

    console.log(`🔍 Secret revealed: ${secretId}`, data);

    // Emit event
    if (window.eventDispatcher) {
      window.eventDispatcher.emit('secret_revealed', {
        secretId,
        data,
        source: 'npc'
      });
    }

    const result = { success: true, secretId, data };
    this._logAction('revealSecret', { secretId, data }, result);
    return result;
  }

  /**
   * Add a note to the player's notes
   * @param {string} title - Note title
   * @param {string} content - Note content
   * @returns {Object} Result object with success status
   */
  addNote(title, content) {
    if (!title || !content) {
      const result = { success: false, error: 'Title and content required' };
      this._logAction('addNote', { title, content }, result);
      return result;
    }

    if (!window.gameState) {
      window.gameState = {};
    }

    if (!window.gameState.notes) {
      window.gameState.notes = [];
    }

    const note = {
      title,
      content,
      timestamp: Date.now(),
      source: 'npc'
    };

    window.gameState.notes.push(note);

    // Show notification
    if (window.showNotification) {
      window.showNotification(`New Note: ${title}`, 'info');
    }

    // Emit event
    if (window.eventDispatcher) {
      window.eventDispatcher.emit('note_added', {
        title,
        source: 'npc'
      });
    }

    const result = { success: true, note };
    this._logAction('addNote', { title, content }, result);
    return result;
  }

  /**
   * Trigger a game event
   * @param {string} eventName - Name of the event
   * @param {Object} eventData - Event data
   * @returns {Object} Result object with success status
   */
  triggerEvent(eventName, eventData = {}) {
    if (!eventName) {
      const result = { success: false, error: 'No eventName provided' };
      this._logAction('triggerEvent', { eventName, eventData }, result);
      return result;
    }

    if (!window.eventDispatcher) {
      const result = { success: false, error: 'Event dispatcher not available' };
      this._logAction('triggerEvent', { eventName, eventData }, result);
      return result;
    }

    window.eventDispatcher.emit(eventName, {
      ...eventData,
      source: 'npc'
    });

    const result = { success: true, eventName, eventData };
    this._logAction('triggerEvent', { eventName, eventData }, result);
    return result;
  }

  /**
   * Mark a room as discovered
   * @param {string} roomId - Room ID to discover
   * @returns {Object} Result object with success status
   */
  discoverRoom(roomId) {
    if (!roomId) {
      const result = { success: false, error: 'No roomId provided' };
      this._logAction('discoverRoom', { roomId }, result);
      return result;
    }

    if (!window.discoveredRooms) {
      window.discoveredRooms = new Set();
    }

    window.discoveredRooms.add(roomId);

    // Emit event
    if (window.eventDispatcher) {
      window.eventDispatcher.emit('room_discovered', {
        roomId,
        source: 'npc'
      });
    }

    const result = { success: true, roomId };
    this._logAction('discoverRoom', { roomId }, result);
    return result;
  }

  /**
   * Get the action log for debugging
   * @returns {Array} Array of logged actions
   */
  getActionLog() {
    return this.actionLog;
  }

  /**
   * Clear the action log
   */
  clearActionLog() {
    this.actionLog = [];
  }
}

// Create singleton instance
const bridge = new NPCGameBridge();

// Export default for ES6 modules
export default bridge;

// Also make available globally for Ink external functions
if (typeof window !== 'undefined') {
  window.NPCGameBridge = bridge;
  
  // Register convenience methods globally for Ink
  window.npcUnlockDoor = (roomId) => bridge.unlockDoor(roomId);
  window.npcGiveItem = (npcId, itemType) => bridge.giveItem(npcId, itemType);
  window.npcShowInventory = (npcId, filterTypes) => bridge.showNPCInventory(npcId, filterTypes);
  window.npcSetObjective = (text) => bridge.setObjective(text);
  window.npcRevealSecret = (secretId, data) => bridge.revealSecret(secretId, data);
  window.npcAddNote = (title, content) => bridge.addNote(title, content);
  window.npcTriggerEvent = (eventName, eventData) => bridge.triggerEvent(eventName, eventData);
  window.npcDiscoverRoom = (roomId) => bridge.discoverRoom(roomId);
}
