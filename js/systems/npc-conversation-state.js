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
     * 
     * Important: When story has ended, we save ONLY the variables (not the story state/progress).
     * This preserves character relationships and earned rewards while allowing the story to restart fresh.
     * 
     * @param {string} npcId - NPC identifier
     * @param {Object} story - The Ink story object
     * @param {boolean} forceFullState - If true, save full state even if story has ended (for in-progress saves)
     */
    saveNPCState(npcId, story, forceFullState = false) {
        if (!npcId || !story) return;

        try {
            const state = {
                timestamp: Date.now(),
                hasEnded: story.state.hasEnded
            };

            // Always save the variables (favour, items earned, flags, etc.)
            // These persist across conversations even when story ends
            if (story.variablesState) {
                state.variables = { ...story.variablesState };
                console.log(`💾 Saved variables for ${npcId}:`, state.variables);
            }

            // Only save full story state if story is still active OR if explicitly forced
            if (!story.state.hasEnded || forceFullState) {
                state.storyState = story.state.ToJson();
                console.log(`💾 Saved full story state for ${npcId} (active story)`);
            } else {
                console.log(`💾 Saved variables only for ${npcId} (story ended - will restart fresh)`);
            }

            this.conversationStates.set(npcId, state);
            console.log(`✅ NPC state persisted for: ${npcId}`, {
                timestamp: new Date(state.timestamp).toLocaleTimeString(),
                hasEnded: state.hasEnded,
                hasVariables: !!state.variables,
                hasStoryState: !!state.storyState
            });
        } catch (error) {
            console.error(`❌ Error saving NPC state for ${npcId}:`, error);
        }
    }

    /**
     * Restore the state of an NPC's conversation
     * 
     * Strategy:
     * - If full story state exists (story was mid-conversation): restore it completely
     * - If only variables exist (story had ended): load variables but let story start fresh
     * 
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
            // If we have saved story state, restore it completely (mid-conversation state)
            if (state.storyState) {
                story.state.LoadJson(state.storyState);
                console.log(`✅ Restored full story state for NPC: ${npcId}`, {
                    savedAt: new Date(state.timestamp).toLocaleTimeString(),
                    reason: 'In-progress conversation'
                });
                return true;
            }

            // If we only have variables (story ended), restore just the variables
            if (state.variables) {
                // Load variables into the story
                for (const [key, value] of Object.entries(state.variables)) {
                    story.variablesState[key] = value;
                }
                console.log(`✅ Restored variables for NPC: ${npcId}`, {
                    savedAt: new Date(state.timestamp).toLocaleTimeString(),
                    reason: 'Story ended - restarting fresh with saved variables',
                    variables: state.variables
                });
                return true;
            }

            console.log(`ℹ️ No saveable data for NPC: ${npcId}`);
            return false;
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
