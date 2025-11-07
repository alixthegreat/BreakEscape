// NPCManager with event → knot auto-mapping and conversation history
// OPTIMIZED: InkEngine caching, event listener cleanup, debug logging
// default export NPCManager
export default class NPCManager {
  constructor(eventDispatcher, barkSystem = null) {
    this.eventDispatcher = eventDispatcher;
    this.barkSystem = barkSystem;
    this.npcs = new Map();
    this.eventListeners = new Map(); // Track registered listeners for cleanup
    this.triggeredEvents = new Map(); // Track which events have been triggered per NPC
    this.conversationHistory = new Map(); // Track conversation history per NPC: { npcId: [ {type, text, timestamp, choiceText} ] }
    this.timedMessages = []; // Scheduled messages: { npcId, text, triggerTime, delivered, phoneId }
    this.timedConversations = []; // Scheduled conversations: { npcId, targetKnot, triggerTime, delivered }
    this.gameStartTime = Date.now(); // Track when game started for timed messages
    this.timerInterval = null; // Timer for checking timed messages
    
    // OPTIMIZATION: Cache InkEngine instances and fetched stories
    this.inkEngineCache = new Map(); // { npcId: inkEngine }
    this.storyCache = new Map(); // { storyPath: storyJson }
    
    // OPTIMIZATION: Debug mode (set via window.NPC_DEBUG = true)
    this.debug = false;
  }

  /**
   * OPTIMIZATION: Log helper with debug mode
   */
  _log(level, message, data = null) {
    if (!this.debug && level !== 'error' && level !== 'warn') return;
    
    const prefix = {
      error: '❌',
      warn: '⚠️',
      info: 'ℹ️',
      debug: '🔍'
    }[level] || '📍';
    
    if (data) {
      console[level](`${prefix} ${message}`, data);
    } else {
      console[level](`${prefix} ${message}`);
    }
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
    
    // Schedule timed messages if any are defined
    if (entry.timedMessages && Array.isArray(entry.timedMessages)) {
      entry.timedMessages.forEach(msg => {
        this.scheduleTimedMessage({
          npcId: realId,
          text: msg.message,
          delay: msg.delay,
          phoneId: entry.phoneId
        });
      });
      console.log(`[NPCManager] Scheduled ${entry.timedMessages.length} timed messages for ${realId}`);
    }
    
    // Schedule timed conversations if any are defined
    if (entry.timedConversation) {
      this.scheduleTimedConversation({
        npcId: realId,
        targetKnot: entry.timedConversation.targetKnot,
        delay: entry.timedConversation.delay
      });
      console.log(`[NPCManager] Scheduled timed conversation for ${realId} to knot: ${entry.timedConversation.targetKnot}`);
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

  // Add a message to conversation history (internal method)
  addMessageToHistory(npcId, type, text) {
    if (!this.conversationHistory.has(npcId)) {
      this.conversationHistory.set(npcId, []);
    }
    this.conversationHistory.get(npcId).push({
      type,
      text,
      timestamp: Date.now(),
      choiceText: null
    });
    this._log('debug', `Added ${type} message to ${npcId} history:`, text);
  }

  // Public API: Add a message with full metadata (used by external systems)
  addMessage(npcId, type, text, metadata = {}) {
    if (!this.conversationHistory.has(npcId)) {
      this.conversationHistory.set(npcId, []);
    }
    this.conversationHistory.get(npcId).push({
      type,
      text,
      timestamp: Date.now(),
      read: type === 'player', // Player messages are automatically marked as read
      ...metadata
    });
    this._log('debug', `Added ${type} message to ${npcId}:`, text);
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

  // Get total unread message count for a phone
  getTotalUnreadCount(phoneId) {
    const npcs = this.getNPCsByPhone(phoneId);
    let totalUnread = 0;
    
    for (const npc of npcs) {
      const history = this.getConversationHistory(npc.id);
      const unreadCount = history.filter(msg => !msg.read && msg.type === 'npc').length;
      totalUnread += unreadCount;
    }
    
    return totalUnread;
  }

  // Set up event listeners for an NPC's event mappings
  _setupEventMappings(npcId, eventMappings) {
    if (!this.eventDispatcher) return;
    
    console.log(`📋 Setting up event mappings for ${npcId}:`, eventMappings);
    
    // Handle both array format (from JSON) and object format
    const mappingsArray = Array.isArray(eventMappings) 
      ? eventMappings 
      : Object.entries(eventMappings).map(([pattern, config]) => ({
          eventPattern: pattern,
          ...(typeof config === 'string' ? { targetKnot: config } : config)
        }));
    
    for (const mapping of mappingsArray) {
      const eventPattern = mapping.eventPattern;
      const config = {
        knot: mapping.targetKnot || mapping.knot,
        bark: mapping.bark,
        once: mapping.onceOnly || mapping.once,
        cooldown: mapping.cooldown,
        condition: mapping.condition,
        maxTriggers: mapping.maxTriggers  // Add max trigger limit
      };
      
      console.log(`  📌 Registering listener for event: ${eventPattern} → ${config.knot}`);
      
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
    
    console.log(`✅ Registered ${mappingsArray.length} event mappings for ${npcId}`);
  }

  // Handle when a mapped event fires
  _handleEventMapping(npcId, eventPattern, config, eventData) {
    console.log(`🎯 Event triggered: ${eventPattern} for NPC: ${npcId}`, eventData);
    
    const npc = this.getNPC(npcId);
    if (!npc) {
      console.warn(`⚠️ NPC ${npcId} not found`);
      return;
    }
    
    // Check if event should be handled
    const eventKey = `${npcId}:${eventPattern}`;
    const triggered = this.triggeredEvents.get(eventKey) || { count: 0, lastTime: 0 };
    
    // Check if this is a once-only event that's already triggered
    if (config.once && triggered.count > 0) {
      console.log(`⏭️ Skipping once-only event ${eventPattern} (already triggered)`);
      return;
    }
    
    // Check if max triggers reached
    if (config.maxTriggers && triggered.count >= config.maxTriggers) {
      console.log(`🚫 Event ${eventPattern} has reached max triggers (${config.maxTriggers})`);
      return;
    }
    
    // Check cooldown (in milliseconds, default 5000ms = 5s)
    const cooldown = config.cooldown || 5000;
    const now = Date.now();
    if (triggered.lastTime && (now - triggered.lastTime < cooldown)) {
      const remainingMs = cooldown - (now - triggered.lastTime);
      console.log(`⏸️ Event ${eventPattern} on cooldown (${remainingMs}ms remaining)`);
      return;
    }
    
    // Check condition if provided (can be string or function)
    if (config.condition) {
      let conditionMet = false;
      
      if (typeof config.condition === 'function') {
        conditionMet = config.condition(eventData, npc);
      } else if (typeof config.condition === 'string') {
        // Evaluate condition string as JavaScript
        try {
          const data = eventData; // Make 'data' available in eval scope
          conditionMet = eval(config.condition);
        } catch (error) {
          console.error(`❌ Error evaluating condition: ${config.condition}`, error);
          return;
        }
      }
      
      if (!conditionMet) {
        console.log(`🚫 Event ${eventPattern} condition not met:`, config.condition);
        return;
      }
    }
    
    console.log(`✅ Event ${eventPattern} conditions passed, triggering NPC reaction`);
    
    // Update triggered tracking
    triggered.count++;
    triggered.lastTime = now;
    this.triggeredEvents.set(eventKey, triggered);
    
    // Update NPC's current knot if specified
    if (config.knot) {
      npc.currentKnot = config.knot;
      console.log(`📍 Updated ${npcId} current knot to: ${config.knot}`);
    }
    
    // If bark text is provided, show it directly
    if (this.barkSystem && (config.bark || config.message)) {
      const barkText = config.bark || config.message;
      
      // Add bark message to conversation history (marked as bark)
      this.addMessage(npcId, 'npc', barkText, { 
        eventPattern,
        knot: config.knot,
        isBark: true  // Flag this as a bark, not full conversation
      });
      
      console.log(`💬 Showing bark with direct message: ${barkText}`);
      
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
    // Otherwise, if we have a knot, load the Ink story and get the text
    else if (this.barkSystem && config.knot && npc.storyPath) {
      console.log(`📖 Loading Ink story from knot: ${config.knot}`);
      
      // Load the Ink story and navigate to the knot
      this._showBarkFromKnot(npcId, npc, config.knot, eventPattern);
    }
    
    console.log(`[NPCManager] Event '${eventPattern}' triggered for NPC '${npcId}' → knot '${config.knot}'`);
  }
  
  // Load Ink story, navigate to knot, and show the text as a bark
  async _showBarkFromKnot(npcId, npc, knotName, eventPattern) {
    try {
      // OPTIMIZATION: Fetch story from cache or network
      let storyJson = this.storyCache.get(npc.storyPath);
      if (!storyJson) {
        const response = await fetch(npc.storyPath);
        if (!response.ok) {
          throw new Error(`Failed to load story: ${response.statusText}`);
        }
        storyJson = await response.json();
        // Cache for future use
        this.storyCache.set(npc.storyPath, storyJson);
      }
      
      // OPTIMIZATION: Reuse cached InkEngine or create new one
      let inkEngine = this.inkEngineCache.get(npcId);
      if (!inkEngine) {
        const { default: InkEngine } = await import('./ink/ink-engine.js?v=1');
        inkEngine = new InkEngine(npcId);
        inkEngine.loadStory(storyJson);
        this.inkEngineCache.set(npcId, inkEngine);
      }
      
      // Navigate to the knot
      inkEngine.goToKnot(knotName);
      
      // Get the text from the knot
      const result = inkEngine.continue();
      
      if (result.text) {
        
        // Add to conversation history (marked as bark)
        this.addMessage(npcId, 'npc', result.text, { 
          eventPattern,
          knot: knotName,
          isBark: true  // Flag this as a bark, not full conversation
        });
        
        // Show the bark
        this.barkSystem.showBark({
          npcId: npc.id,
          npcName: npc.displayName,
          message: result.text,
          avatar: npc.avatar,
          inkStoryPath: npc.storyPath,
          startKnot: knotName,
          phoneId: npc.phoneId
        });
      } else {
        console.warn(`⚠️ No text found in knot: ${knotName}`);
      }
    } catch (error) {
      console.error(`❌ Error loading bark from knot ${knotName}:`, error);
    }
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

  // Schedule a timed message to be delivered after a delay
  // opts: { npcId, text, triggerTime (ms from game start) OR delay (ms from now), phoneId }
  scheduleTimedMessage(opts) {
    const { npcId, text, triggerTime, delay, phoneId } = opts;
    
    if (!npcId || !text) {
      console.error('[NPCManager] scheduleTimedMessage requires npcId and text');
      return;
    }
    
    // Use triggerTime if provided, otherwise use delay (defaults to 0)
    const actualTriggerTime = triggerTime !== undefined ? triggerTime : (delay || 0);
    
    this.timedMessages.push({
      npcId,
      text,
      triggerTime: actualTriggerTime, // milliseconds from game start
      phoneId: phoneId || 'player_phone',
      delivered: false
    });
    
    console.log(`[NPCManager] Scheduled timed message from ${npcId} at ${actualTriggerTime}ms:`, text);
  }

  // Schedule a timed conversation to start after a delay
  // Similar to timedMessages but for person NPCs (opens person-chat minigame)
  // 
  // opts: { npcId, targetKnot, triggerTime (ms from game start) OR delay (ms from now) }
  // 
  // Example: After 3 seconds, automatically open a conversation with test_npc_back at the "group_meeting" knot
  //   scheduleTimedConversation({
  //     npcId: 'test_npc_back',
  //     targetKnot: 'group_meeting',
  //     delay: 3000
  //   })
  //
  // USAGE IN SCENARIO JSON:
  //   {
  //     "id": "test_npc_back",
  //     "displayName": "Back NPC",
  //     "npcType": "person",
  //     "storyPath": "scenarios/ink/test2.json",
  //     "currentKnot": "hub",
  //     "timedConversation": {
  //       "delay": 3000,          // 3 seconds
  //       "targetKnot": "group_meeting"
  //     }
  //   }
  scheduleTimedConversation(opts) {
    const { npcId, targetKnot, triggerTime, delay } = opts;
    
    if (!npcId || !targetKnot) {
      console.error('[NPCManager] scheduleTimedConversation requires npcId and targetKnot');
      return;
    }
    
    // Use triggerTime if provided, otherwise use delay (defaults to 0)
    const actualTriggerTime = triggerTime !== undefined ? triggerTime : (delay || 0);
    
    this.timedConversations.push({
      npcId,
      targetKnot,
      triggerTime: actualTriggerTime, // milliseconds from game start
      delivered: false
    });
    
    console.log(`[NPCManager] Scheduled timed conversation from ${npcId} at ${actualTriggerTime}ms to knot: ${targetKnot}`);
  }

  // Start checking for timed messages (call this when game starts)
  startTimedMessages() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    
    this.gameStartTime = Date.now();
    
    // Check every second for messages that need to be delivered
    this.timerInterval = setInterval(() => {
      this._checkTimedMessages();
    }, 1000);
    
    console.log('[NPCManager] Started timed messages system');
  }

  // Stop checking for timed messages (cleanup)
  stopTimedMessages() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // Check if any timed messages need to be delivered
  _checkTimedMessages() {
    const now = Date.now();
    const elapsed = now - this.gameStartTime;
    
    for (const message of this.timedMessages) {
      if (!message.delivered && elapsed >= message.triggerTime) {
        this._deliverTimedMessage(message);
        message.delivered = true;
      }
    }
    
    // Also check timed conversations
    for (const conversation of this.timedConversations) {
      if (!conversation.delivered && elapsed >= conversation.triggerTime) {
        this._deliverTimedConversation(conversation);
        conversation.delivered = true;
      }
    }
  }

  // Deliver a timed message (add to history and show bark)
  _deliverTimedMessage(message) {
    const npc = this.getNPC(message.npcId);
    if (!npc) {
      console.warn(`[NPCManager] Cannot deliver timed message: NPC ${message.npcId} not found`);
      return;
    }
    
    // Add message to conversation history
    this.addMessage(message.npcId, 'npc', message.text, { 
      timed: true,
      phoneId: message.phoneId
    });
    
    // Update phone badge if updatePhoneBadge function exists
    if (window.updatePhoneBadge && message.phoneId) {
      window.updatePhoneBadge(message.phoneId);
    }
    
    // Show bark notification
    if (this.barkSystem) {
      this.barkSystem.showBark({
        npcId: npc.id,
        npcName: npc.displayName,
        message: message.text,
        avatar: npc.avatar,
        inkStoryPath: npc.storyPath,
        startKnot: npc.currentKnot,
        phoneId: message.phoneId
      });
    }
    
    console.log(`[NPCManager] Delivered timed message from ${message.npcId}:`, message.text);
  }

  // Deliver a timed conversation (start person-chat minigame at specified knot)
  _deliverTimedConversation(conversation) {
    const npc = this.getNPC(conversation.npcId);
    if (!npc) {
      console.warn(`[NPCManager] Cannot deliver timed conversation: NPC ${conversation.npcId} not found`);
      return;
    }
    
    // Update NPC's current knot to the target knot
    npc.currentKnot = conversation.targetKnot;
    
    // Check if MinigameFramework is available to start the person-chat minigame
    if (window.MinigameFramework && typeof window.MinigameFramework.startMinigame === 'function') {
      console.log(`🎭 Starting timed conversation for ${conversation.npcId} at knot: ${conversation.targetKnot}`);
      
      window.MinigameFramework.startMinigame('person-chat', null, {
        npcId: conversation.npcId,
        title: npc.displayName || conversation.npcId
      });
    } else {
      console.warn(`[NPCManager] MinigameFramework not available to start person-chat for timed conversation`);
    }
    
    console.log(`[NPCManager] Delivered timed conversation from ${conversation.npcId} to knot: ${conversation.targetKnot}`);
  }

  // Load timed messages from scenario data
  // timedMessages: [ { npcId, text, triggerTime, phoneId } ]
  loadTimedMessages(timedMessages) {
    if (!Array.isArray(timedMessages)) return;
    
    timedMessages.forEach(msg => {
      this.scheduleTimedMessage(msg);
    });
    
    console.log(`[NPCManager] Loaded ${timedMessages.length} timed messages`);
  }

  /**
   * Clear conversation history for an NPC (useful for testing/debugging)
   * @param {string} npcId - The NPC to reset
   */
  clearNPCHistory(npcId) {
    if (!npcId) {
      console.warn('[NPCManager] clearNPCHistory requires npcId');
      return;
    }
    
    // Clear conversation history
    if (this.conversationHistory.has(npcId)) {
      this.conversationHistory.set(npcId, []);
      console.log(`[NPCManager] Cleared conversation history for ${npcId}`);
    }
    
    // Clear story state from localStorage
    const storyStateKey = `npc_story_state_${npcId}`;
    if (localStorage.getItem(storyStateKey)) {
      localStorage.removeItem(storyStateKey);
      console.log(`[NPCManager] Cleared saved story state for ${npcId}`);
    }
    
    console.log(`✅ Reset NPC: ${npcId}. Start a new conversation to see fresh state.`);
  }

  /**
   * OPTIMIZATION: Clean up event listeners for an NPC
   * Call this when removing an NPC or changing scenes
   */
  unregisterNPC(npcId) {
    if (!this.eventDispatcher) return;

    // Remove all event listeners for this NPC
    const listeners = this.eventListeners.get(npcId);
    if (listeners) {
      for (const { pattern, listener } of listeners) {
        this.eventDispatcher.off(pattern, listener);
      }
      this.eventListeners.delete(npcId);
      console.log(`[NPCManager] Cleaned up ${listeners.length} event listeners for ${npcId}`);
    }

    // Clear cached InkEngine
    if (this.inkEngineCache.has(npcId)) {
      this.inkEngineCache.delete(npcId);
      console.log(`[NPCManager] Cleared cached InkEngine for ${npcId}`);
    }

    // Remove NPC from registry
    this.npcs.delete(npcId);
    this.conversationHistory.delete(npcId);
    this.triggeredEvents.delete(npcId);

    console.log(`[NPCManager] Unregistered NPC: ${npcId}`);
  }

  /**
   * OPTIMIZATION: Clean up all NPCs (call on scene change)
   */
  unregisterAllNPCs() {
    const npcIds = Array.from(this.npcs.keys());
    for (const npcId of npcIds) {
      this.unregisterNPC(npcId);
    }
    console.log(`[NPCManager] Cleaned up all NPCs (${npcIds.length} total)`);
  }

  /**
   * Get or create Ink engine for an NPC
   * Fetches story from NPC data and initializes InkEngine
   * @param {string} npcId - NPC ID
   * @returns {Promise<InkEngine|null>} Ink engine instance or null
   */
  async getInkEngine(npcId) {
    try {
      const npc = this.getNPC(npcId);
      if (!npc) {
        console.error(`❌ NPC not found: ${npcId}`);
        return null;
      }

      // Check if already cached
      if (this.inkEngineCache.has(npcId)) {
        console.log(`📖 Using cached InkEngine for ${npcId}`);
        return this.inkEngineCache.get(npcId);
      }

      // Need to load story
      if (!npc.storyPath) {
        console.error(`❌ NPC ${npcId} has no storyPath`);
        return null;
      }

      // Fetch story from cache or network
      let storyJson = this.storyCache.get(npc.storyPath);
      if (!storyJson) {
        console.log(`📚 Fetching story from ${npc.storyPath}`);
        const response = await fetch(npc.storyPath);
        if (!response.ok) {
          throw new Error(`Failed to load story: ${response.statusText}`);
        }
        storyJson = await response.json();
        this.storyCache.set(npc.storyPath, storyJson);
      }

      // Create and cache InkEngine
      const { default: InkEngine } = await import('./ink/ink-engine.js?v=1');
      const inkEngine = new InkEngine(npcId);
      inkEngine.loadStory(storyJson);
      this.inkEngineCache.set(npcId, inkEngine);

      console.log(`✅ InkEngine initialized for ${npcId}`);
      return inkEngine;
    } catch (error) {
      console.error(`❌ Error getting InkEngine for ${npcId}:`, error);
      return null;
    }
  }

  /**
   * OPTIMIZATION: Destroy InkEngine cache for a specific story
   * Useful when memory is tight or story changed
   */
  clearStoryCache(storyPath) {
    this.storyCache.delete(storyPath);
  }

  /**
   * OPTIMIZATION: Clear all caches
   */
  clearAllCaches() {
    this.inkEngineCache.clear();
    this.storyCache.clear();
    console.log(`[NPCManager] Cleared all caches`);
  }
}

// Console helper for debugging
if (typeof window !== 'undefined') {
  window.clearNPCHistory = (npcId) => {
    if (!window.npcManager) {
      console.error('NPCManager not available');
      return;
    }
    window.npcManager.clearNPCHistory(npcId);
  };
}
