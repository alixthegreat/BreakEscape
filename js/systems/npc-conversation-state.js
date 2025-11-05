/**
 * NPC Conversation State Manager
 * 
 * Persists NPC conversation state (Ink variables, choices, progress) across multiple conversations.
 * Stores serialized story state so NPCs remember their relationships and story progression.
 * 
 * @module npc-conversation-state
 */

class NPCConversationStateManager {
    constructor() {
        this.conversationStates = new Map(); // { npcId: { storyState, variables, ... } }
        console.log('🗂️ NPC Conversation State Manager initialized');
    }

    /**
     * Save the current state of an NPC's conversation
     * @param {string} npcId - NPC identifier
     * @param {Object} story - The Ink story object
     */
    saveNPCState(npcId, story) {
        if (!npcId || !story) return;

        try {
            // Serialize the story state (includes all variables and progress)
            // Use uppercase ToJson as per inkjs API
            const storyState = story.state.ToJson();
            
            const state = {
                storyState: storyState,
                timestamp: Date.now()
            };

            this.conversationStates.set(npcId, state);
            console.log(`💾 Saved conversation state for NPC: ${npcId}`, {
                timestamp: new Date(state.timestamp).toLocaleTimeString()
            });
        } catch (error) {
            console.error(`❌ Error saving NPC state for ${npcId}:`, error);
        }
    }

    /**
     * Restore the state of an NPC's conversation
     * @param {string} npcId - NPC identifier
     * @param {Object} story - The Ink story object to restore into
     * @returns {boolean} True if state was restored
     */
    restoreNPCState(npcId, story) {
        if (!npcId || !story) return false;

        const state = this.conversationStates.get(npcId);
        if (!state) {
            console.log(`ℹ️ No saved state for NPC: ${npcId} (first conversation)`);
            return false;
        }

        try {
            // Restore the serialized story state
            // Use uppercase LoadJson as per inkjs API
            story.state.LoadJson(state.storyState);
            
            console.log(`✅ Restored conversation state for NPC: ${npcId}`, {
                savedAt: new Date(state.timestamp).toLocaleTimeString()
            });
            
            return true;
        } catch (error) {
            console.error(`❌ Error restoring NPC state for ${npcId}:`, error);
            return false;
        }
    }

    /**
     * Get the current state for an NPC (for debugging)
     * @param {string} npcId - NPC identifier
     * @returns {Object|null} Conversation state or null if not found
     */
    getNPCState(npcId) {
        return this.conversationStates.get(npcId) || null;
    }

    /**
     * Clear the state for an NPC (useful for resetting conversations)
     * @param {string} npcId - NPC identifier
     */
    clearNPCState(npcId) {
        if (this.conversationStates.has(npcId)) {
            this.conversationStates.delete(npcId);
            console.log(`🗑️ Cleared conversation state for NPC: ${npcId}`);
        }
    }

    /**
     * Clear all NPC states (useful for scenario reset)
     */
    clearAllStates() {
        const count = this.conversationStates.size;
        this.conversationStates.clear();
        console.log(`🗑️ Cleared all NPC conversation states (${count} NPCs)`);
    }

    /**
     * Get list of NPCs with saved state
     * @returns {Array<string>} Array of NPC IDs with persistent state
     */
    getSavedNPCs() {
        return Array.from(this.conversationStates.keys());
    }
}

// Create global instance
const npcConversationStateManager = new NPCConversationStateManager();

// Export for use in modules
export default npcConversationStateManager;

// Also attach to window for global access
if (typeof window !== 'undefined') {
    window.npcConversationStateManager = npcConversationStateManager;
}
