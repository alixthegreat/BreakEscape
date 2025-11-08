/**
 * PhoneChatConversation - Ink Story Management
 * 
 * Manages Ink story execution for NPC conversations, interfacing with InkEngine.
 * Handles story loading, continuation, choices, and state management.
 * 
 * @module phone-chat-conversation
 */

export default class PhoneChatConversation {
    /**
     * Create a PhoneChatConversation instance
     * @param {string} npcId - NPC identifier
     * @param {Object} npcManager - NPCManager instance
     * @param {Object} inkEngine - InkEngine instance
     */
    constructor(npcId, npcManager, inkEngine) {
        if (!npcId) {
            throw new Error('PhoneChatConversation requires an npcId');
        }
        
        if (!npcManager) {
            throw new Error('PhoneChatConversation requires an npcManager instance');
        }
        
        if (!inkEngine) {
            throw new Error('PhoneChatConversation requires an inkEngine instance');
        }
        
        this.npcId = npcId;
        this.npcManager = npcManager;
        this.engine = inkEngine;
        this.storyLoaded = false;
        this.storyEnded = false;
        
        console.log(`💬 PhoneChatConversation initialized for NPC: ${npcId}`);
    }
    
    /**
     * Load the Ink story for this NPC
     * @param {string|Object} storyPathOrJSON - Path to Ink JSON file OR direct JSON object
     * @returns {Promise<boolean>} True if loaded successfully
     */
    async loadStory(storyPathOrJSON) {
        if (!storyPathOrJSON) {
            console.error('❌ No story path or JSON provided');
            return false;
        }
        
        try {
            let storyJson;
            
            // Check if we received a JSON object directly
            if (typeof storyPathOrJSON === 'object') {
                console.log(`📖 Loading story from inline JSON for ${this.npcId}`);
                storyJson = storyPathOrJSON;
            } else {
                // It's a path, fetch the JSON
                console.log(`📖 Loading story from: ${storyPathOrJSON}`);
                
                const response = await fetch(storyPathOrJSON);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                storyJson = await response.json();
            }
            
            // Load into InkEngine
            this.engine.loadStory(storyJson);
            
            // Note: We don't set npc_name variable here because it causes issues with state serialization.
            // The NPC display name is handled in the UI layer instead.
            
            this.storyLoaded = true;
            this.storyEnded = false;
            
            // Sync NPC items to Ink variables
            this.syncItemsToInk();
            
            // Set up event listener for item changes
            if (window.eventDispatcher) {
                this._itemsChangedListener = (data) => {
                    if (data.npcId === this.npcId) {
                        this.syncItemsToInk();
                    }
                };
                window.eventDispatcher.on('npc_items_changed', this._itemsChangedListener);
            }
            
            console.log(`✅ Story loaded successfully for ${this.npcId}`);
            
            return true;
        } catch (error) {
            console.error(`❌ Error loading story for ${this.npcId}:`, error);
            this.storyLoaded = false;
            return false;
        }
    }
    
    /**
     * Navigate to a specific knot in the story
     * @param {string} knotName - Name of the knot to navigate to
     * @returns {boolean} True if navigation successful
     */
    goToKnot(knotName) {
        if (!this.storyLoaded) {
            console.error('❌ Cannot navigate to knot: story not loaded');
            return false;
        }
        
        if (!knotName) {
            console.warn('⚠️ No knot name provided');
            return false;
        }
        
        try {
            this.engine.goToKnot(knotName);
            
            // Update NPC's current knot in manager
            const npc = this.npcManager.getNPC(this.npcId);
            if (npc) {
                npc.currentKnot = knotName;
            }
            
            console.log(`🎯 Navigated to knot: ${knotName}`);
            return true;
        } catch (error) {
            console.error(`❌ Error navigating to knot ${knotName}:`, error);
            return false;
        }
    }
    
    /**
     * Sync NPC's held items to Ink variables
     * Sets has_<type> based on itemsHeld array
     */
    syncItemsToInk() {
        if (!this.engine || !this.engine.story) return;
        
        const npc = this.npcManager.getNPC(this.npcId);
        if (!npc || !npc.itemsHeld) return;
        
        const varState = this.engine.story.variablesState;
        if (!varState._defaultGlobalVariables) return;
        
        // Count items by type
        const itemCounts = {};
        npc.itemsHeld.forEach(item => {
            itemCounts[item.type] = (itemCounts[item.type] || 0) + 1;
        });
        
        // Set has_<type> variables based on inventory
        Object.keys(itemCounts).forEach(type => {
            const varName = `has_${type}`;
            if (varState._defaultGlobalVariables && varState._defaultGlobalVariables.has(varName)) {
                const hasItem = itemCounts[type] > 0;
                try {
                    this.engine.setVariable(varName, hasItem);
                    console.log(`✅ Synced ${varName} = ${hasItem} for NPC ${npc.id}`);
                } catch (err) {
                    console.warn(`⚠️ Could not sync ${varName}:`, err.message);
                }
            }
        });
    }
    
    /**
     * Continue the story and get the next text/choices
     * @returns {Object} Story result { text, choices, tags, canContinue, hasEnded }
     */
    continue() {
        if (!this.storyLoaded) {
            console.error('❌ Cannot continue: story not loaded');
            return { text: '', choices: [], tags: [], canContinue: false, hasEnded: true };
        }
        
        if (this.storyEnded) {
            console.log('ℹ️ Story has ended');
            return { text: '', choices: [], tags: [], canContinue: false, hasEnded: true };
        }
        
        try {
            const result = this.engine.continue();
            
            // Check if story has ended (no more content and no choices)
            if (!result.canContinue && (!result.choices || result.choices.length === 0)) {
                this.storyEnded = true;
                result.hasEnded = true;
                console.log('🏁 Story has ended');
            } else {
                result.hasEnded = false;
            }
            
            return result;
        } catch (error) {
            console.error('❌ Error continuing story:', error);
            return { text: '', choices: [], tags: [], canContinue: false, hasEnded: true };
        }
    }
    
    /**
     * Make a choice and continue the story
     * @param {number} choiceIndex - Index of the choice to make
     * @returns {Object} Story result after choice
     */
    makeChoice(choiceIndex) {
        if (!this.storyLoaded) {
            console.error('❌ Cannot make choice: story not loaded');
            return { text: '', choices: [], tags: [], canContinue: false, hasEnded: true };
        }
        
        if (this.storyEnded) {
            console.log('ℹ️ Cannot make choice: story has ended');
            return { text: '', choices: [], tags: [], canContinue: false, hasEnded: true };
        }
        
        try {
            // Make the choice
            this.engine.choose(choiceIndex);
            console.log(`👆 Made choice ${choiceIndex}`);
            
            // Continue after choice
            return this.continue();
        } catch (error) {
            console.error(`❌ Error making choice ${choiceIndex}:`, error);
            return { text: '', choices: [], tags: [], canContinue: false, hasEnded: true };
        }
    }
    
    /**
     * Get current state without continuing (for reopening conversations)
     * @returns {Object} Current story state { choices, hasEnded }
     */
    getCurrentState() {
        if (!this.storyLoaded) {
            console.error('❌ Cannot get state: story not loaded');
            return { choices: [], hasEnded: true };
        }
        
        if (this.storyEnded) {
            return { choices: [], hasEnded: true };
        }
        
        try {
            // Get current choices without continuing
            const choices = this.engine.currentChoices || [];
            const hasEnded = !this.engine.story?.canContinue && choices.length === 0;
            
            return { choices, hasEnded };
        } catch (error) {
            console.error('❌ Error getting current state:', error);
            return { choices: [], hasEnded: true };
        }
    }
    
    /**
     * Get an Ink variable value
     * @param {string} name - Variable name
     * @returns {*} Variable value or null
     */
    getVariable(name) {
        if (!this.storyLoaded) {
            console.warn('⚠️ Cannot get variable: story not loaded');
            return null;
        }
        
        try {
            return this.engine.getVariable(name);
        } catch (error) {
            console.error(`❌ Error getting variable ${name}:`, error);
            return null;
        }
    }
    
    /**
     * Set an Ink variable value
     * @param {string} name - Variable name
     * @param {*} value - Variable value
     * @returns {boolean} True if set successfully
     */
    setVariable(name, value) {
        if (!this.storyLoaded) {
            console.warn('⚠️ Cannot set variable: story not loaded');
            return false;
        }
        
        try {
            this.engine.setVariable(name, value);
            console.log(`✅ Set variable ${name} = ${value}`);
            return true;
        } catch (error) {
            console.error(`❌ Error setting variable ${name}:`, error);
            return false;
        }
    }
    
    /**
     * Save the current story state
     * @returns {string|null} Serialized state or null on error
     */
    saveState() {
        if (!this.storyLoaded) {
            console.warn('⚠️ Cannot save state: story not loaded');
            return null;
        }
        
        try {
            const state = this.engine.story.state.ToJson();
            console.log('💾 Saved story state');
            return state;
        } catch (error) {
            console.error('❌ Error saving state:', error);
            return null;
        }
    }
    
    /**
     * Restore a previously saved story state
     * @param {string} state - Serialized state from saveState()
     * @returns {boolean} True if restored successfully
     */
    restoreState(state) {
        if (!this.storyLoaded) {
            console.warn('⚠️ Cannot restore state: story not loaded');
            return false;
        }
        
        if (!state) {
            console.warn('⚠️ No state provided');
            return false;
        }
        
        try {
            this.engine.story.state.LoadJson(state);
            this.storyEnded = false; // Reset ended flag
            console.log('📂 Restored story state');
            return true;
        } catch (error) {
            console.error('❌ Error restoring state:', error);
            return false;
        }
    }
    
    /**
     * Check if the story has ended
     * @returns {boolean} True if story has ended
     */
    hasEnded() {
        return this.storyEnded;
    }
    
    /**
     * Reset the story (reload from beginning)
     * @param {string} storyPath - Path to Ink JSON file
     * @returns {Promise<boolean>} True if reset successfully
     */
    async reset(storyPath) {
        console.log('🔄 Resetting conversation...');
        this.storyLoaded = false;
        this.storyEnded = false;
        return await this.loadStory(storyPath);
    }
    
    /**
     * Get all available tags from the current story state
     * @returns {Array<string>} Array of tag strings
     */
    getCurrentTags() {
        if (!this.storyLoaded) {
            return [];
        }
        
        try {
            return this.engine.story.currentTags || [];
        } catch (error) {
            console.error('❌ Error getting tags:', error);
            return [];
        }
    }
    
    /**
     * Clean up resources (event listeners, etc.)
     */
    cleanup() {
        // Remove event listener
        if (window.eventDispatcher && this._itemsChangedListener) {
            window.eventDispatcher.off('npc_items_changed', this._itemsChangedListener);
        }
    }
    
    /**
     * Get conversation metadata (variables, state)
     * @returns {Object} Metadata about the conversation
     */
    getMetadata() {
        if (!this.storyLoaded) {
            return {
                loaded: false,
                ended: false,
                variables: {}
            };
        }
        
        // Try to get common variables
        const commonVars = ['trust_level', 'conversation_count', 'npc_name'];
        const variables = {};
        
        commonVars.forEach(varName => {
            try {
                const value = this.getVariable(varName);
                if (value !== null && value !== undefined) {
                    variables[varName] = value;
                }
            } catch (error) {
                // Variable doesn't exist, skip
            }
        });
        
        return {
            loaded: this.storyLoaded,
            ended: this.storyEnded,
            variables,
            tags: this.getCurrentTags()
        };
    }
}
