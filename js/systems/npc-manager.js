// NPCManager with event → knot auto-mapping and conversation history
// default export NPCManager
export default class NPCManager {
  constructor(eventDispatcher, barkSystem = null) {
    this.eventDispatcher = eventDispatcher;
    this.barkSystem = barkSystem;
    this.npcs = new Map();
    this.eventListeners = new Map(); // Track registered listeners for cleanup
    this.triggeredEvents = new Map(); // Track which events have been triggered per NPC
    this.conversationHistory = new Map(); // Track conversation history per NPC: { npcId: [ {type, text, timestamp, choiceText} ] }
  }

  // registerNPC(id, opts) or registerNPC({ id, ...opts })
  // opts: { 
  //   displayName, storyPath, avatar, currentKnot, 
  //   phoneId: 'player_phone' | 'office_phone' | null,  // Which phone this NPC uses
  //   npcType: 'phone' | 'sprite',  // Text-only phone NPC or in-world sprite
  //   eventMappings: { 'event_pattern': { knot, bark, once, cooldown } } 
  // }
  registerNPC(id, opts = {}) {
    // Accept either registerNPC(id, opts) or registerNPC({ id, ...opts })
    let realId = id;
    let realOpts = opts;
    if (typeof id === 'object' && id !== null) {
      realOpts = id;
      realId = id.id;
    }
    if (!realId) throw new Error('registerNPC requires an id');
    
    const entry = Object.assign({ 
      id: realId, 
      displayName: realId, 
      metadata: {},
      eventMappings: {},
      phoneId: 'player_phone',  // Default to player's phone
      npcType: 'phone'  // Default to phone-based NPC
    }, realOpts);
    
    this.npcs.set(realId, entry);
    
    // Initialize conversation history for this NPC
    if (!this.conversationHistory.has(realId)) {
      this.conversationHistory.set(realId, []);
    }
    
    // Set up event listeners for auto-mapping
    if (entry.eventMappings && this.eventDispatcher) {
      this._setupEventMappings(realId, entry.eventMappings);
    }
    
    return entry;
  }

  getNPC(id) {
    return this.npcs.get(id) || null;
  }

  // Set bark system (can be set after construction)
  setBarkSystem(barkSystem) {
    this.barkSystem = barkSystem;
  }

  // Add a message to conversation history
  addMessage(npcId, type, text, metadata = {}) {
    if (!this.conversationHistory.has(npcId)) {
      this.conversationHistory.set(npcId, []);
    }
    
    const history = this.conversationHistory.get(npcId);
    history.push({
      type: type,  // 'npc' or 'player'
      text: text,
      timestamp: Date.now(),
      ...metadata
    });
    
    console.log(`[NPCManager] Added ${type} message to ${npcId} history:`, text);
  }

  // Get conversation history for an NPC
  getConversationHistory(npcId) {
    return this.conversationHistory.get(npcId) || [];
  }

  // Clear conversation history for an NPC
  clearConversationHistory(npcId) {
    this.conversationHistory.set(npcId, []);
  }

  // Get all NPCs for a specific phone
  getNPCsByPhone(phoneId) {
    return Array.from(this.npcs.values()).filter(npc => npc.phoneId === phoneId);
  }

  // Set up event listeners for an NPC's event mappings
  _setupEventMappings(npcId, eventMappings) {
    if (!this.eventDispatcher) return;
    
    for (const [eventPattern, mapping] of Object.entries(eventMappings)) {
      // Mapping can be:
      // - string (just knot name)
      // - object { knot, bark, once, cooldown, condition }
      let config = typeof mapping === 'string' ? { knot: mapping } : mapping;
      
      const listener = (eventData) => {
        this._handleEventMapping(npcId, eventPattern, config, eventData);
      };
      
      // Register listener with event dispatcher
      this.eventDispatcher.on(eventPattern, listener);
      
      // Track listener for cleanup
      if (!this.eventListeners.has(npcId)) {
        this.eventListeners.set(npcId, []);
      }
      this.eventListeners.get(npcId).push({ pattern: eventPattern, listener });
    }
  }

  // Handle when a mapped event fires
  _handleEventMapping(npcId, eventPattern, config, eventData) {
    const npc = this.getNPC(npcId);
    if (!npc) return;
    
    // Check if event should be handled
    const eventKey = `${npcId}:${eventPattern}`;
    const triggered = this.triggeredEvents.get(eventKey) || { count: 0, lastTime: 0 };
    
    // Check if this is a once-only event that's already triggered
    if (config.once && triggered.count > 0) {
      return;
    }
    
    // Check cooldown (in milliseconds, default 5000ms = 5s)
    const cooldown = config.cooldown || 5000;
    const now = Date.now();
    if (triggered.lastTime && (now - triggered.lastTime < cooldown)) {
      return;
    }
    
    // Check condition function if provided
    if (config.condition && typeof config.condition === 'function') {
      if (!config.condition(eventData, npc)) {
        return;
      }
    }
    
    // Update triggered tracking
    triggered.count++;
    triggered.lastTime = now;
    this.triggeredEvents.set(eventKey, triggered);
    
    // Update NPC's current knot if specified
    if (config.knot) {
      npc.currentKnot = config.knot;
    }
    
    // Show bark if bark system is available and bark text/message provided
    if (this.barkSystem && (config.bark || config.message)) {
      const barkText = config.bark || config.message;
      
      // Add bark message to conversation history
      this.addMessage(npcId, 'npc', barkText, { 
        eventPattern,
        knot: config.knot 
      });
      
      this.barkSystem.showBark({
        npcId: npc.id,
        npcName: npc.displayName,
        message: barkText,
        avatar: npc.avatar,
        inkStoryPath: npc.storyPath,
        startKnot: config.knot || npc.currentKnot,
        phoneId: npc.phoneId
      });
    }
    
    console.log(`[NPCManager] Event '${eventPattern}' triggered for NPC '${npcId}' → knot '${config.knot}'`);
  }

  // Unregister an NPC and clean up its event listeners
  unregisterNPC(id) {
    const listeners = this.eventListeners.get(id);
    if (listeners && this.eventDispatcher) {
      listeners.forEach(({ pattern, listener }) => {
        this.eventDispatcher.off(pattern, listener);
      });
      this.eventListeners.delete(id);
    }
    
    // Clean up triggered events tracking
    for (const key of this.triggeredEvents.keys()) {
      if (key.startsWith(`${id}:`)) {
        this.triggeredEvents.delete(key);
      }
    }
    
    this.npcs.delete(id);
  }

  // Helper to emit events about an NPC
  emit(npcId, type, payload = {}) {
    const ev = Object.assign({ npcId, type }, payload);
    this.eventDispatcher && this.eventDispatcher.emit(type, ev);
  }

  // Get all NPCs
  getAllNPCs() {
    return Array.from(this.npcs.values());
  }

  // Check if an event has been triggered for an NPC
  hasTriggered(npcId, eventPattern) {
    const eventKey = `${npcId}:${eventPattern}`;
    const triggered = this.triggeredEvents.get(eventKey);
    return triggered ? triggered.count > 0 : false;
  }
}
