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
   * Give an item to the player
   * @param {string} itemType - Type of item to give
   * @param {Object} properties - Optional item properties
   * @returns {Object} Result object with success status
   */
  giveItem(itemType, properties = {}) {
    if (!itemType) {
      const result = { success: false, error: 'No itemType provided' };
      this._logAction('giveItem', { itemType, properties }, result);
      return result;
    }

    if (!window.addToInventory) {
      const result = { success: false, error: 'Inventory system not available' };
      this._logAction('giveItem', { itemType, properties }, result);
      return result;
    }

    try {
      // Default names for common items
      const defaultNames = {
        'lockpick': 'Lock Pick Kit',
        'bluetooth_scanner': 'Bluetooth Scanner',
        'fingerprint_kit': 'Fingerprint Kit',
        'pin-cracker': 'PIN Cracker',
        'workstation': 'Crypto Analysis Station',
        'keycard': 'Access Keycard',
        'key': 'Key'
      };
      
      // Default observations for common items
      const defaultObservations = {
        'lockpick': 'A professional lock picking kit with various picks and tension wrenches',
        'bluetooth_scanner': 'A device for scanning and connecting to nearby Bluetooth devices',
        'fingerprint_kit': 'A forensic kit for collecting and analyzing fingerprints',
        'pin-cracker': 'A tool for cracking numeric PIN codes',
        'workstation': 'A powerful workstation for cryptographic analysis',
        'keycard': 'An access keycard for secured areas',
        'key': 'A key that opens a specific lock'
      };
      
      // Create a basic item structure
      const itemName = (properties.name && properties.name !== itemType) 
        ? properties.name 
        : (defaultNames[itemType] || itemType);
      const itemObservations = properties.observations || defaultObservations[itemType] || `A ${itemName} given by an NPC`;
      
      const item = {
        type: itemType,
        name: itemName,
        takeable: true,
        observations: itemObservations,
        scenarioData: {
          ...properties,  // Spread properties first
          type: itemType,  // Then override with correct values
          name: itemName,
          observations: itemObservations,
          takeable: true
        }
      };

      // Create a pseudo-sprite for the inventory system
      const sprite = {
        name: item.name,
        scenarioData: item.scenarioData,
        texture: { key: itemType },
        objectId: `npc_gift_${itemType}_${Date.now()}`
      };

      console.log('🎁 NPCGameBridge: Creating item sprite:', {
        itemType,
        name: sprite.name,
        scenarioDataName: sprite.scenarioData.name,
        scenarioDataType: sprite.scenarioData.type,
        fullScenarioData: sprite.scenarioData
      });

      window.addToInventory(sprite);

      // Emit event
      if (window.eventDispatcher) {
        window.eventDispatcher.emit('item_given_by_npc', {
          itemType,
          source: 'npc'
        });
      }

      const result = { success: true, itemType, item };
      this._logAction('giveItem', { itemType, properties }, result);
      return result;
    } catch (error) {
      const result = { success: false, error: error.message };
      this._logAction('giveItem', { itemType, properties }, result);
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
  window.npcGiveItem = (itemType, properties) => bridge.giveItem(itemType, properties);
  window.npcSetObjective = (text) => bridge.setObjective(text);
  window.npcRevealSecret = (secretId, data) => bridge.revealSecret(secretId, data);
  window.npcAddNote = (title, content) => bridge.addNote(title, content);
  window.npcTriggerEvent = (eventName, eventData) => bridge.triggerEvent(eventName, eventData);
  window.npcDiscoverRoom = (roomId) => bridge.discoverRoom(roomId);
}
