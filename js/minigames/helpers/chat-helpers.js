/**
 * Shared Chat Minigame Helpers
 * 
 * Common utilities for phone-chat and person-chat minigames:
 * - Game action tag processing (give_item, unlock_door, etc.)
 * - UI notification handling
 * 
 * @module chat-helpers
 */

/**
 * Process game action tags from Ink story
 * Tags format: # unlock_door:ceo, # give_item:keycard|CEO Keycard, etc.
 * 
 * @param {Array<string>} tags - Array of tag strings from Ink story
 * @param {Object} ui - UI controller with showNotification method
 * @returns {Array<Object>} Array of processing results for each tag
 */
export function processGameActionTags(tags, ui) {
    if (!window.NPCGameBridge) {
        console.warn('⚠️ NPCGameBridge not available, skipping tag processing');
        return [];
    }
    
    if (!tags || tags.length === 0) {
        return [];
    }
    
    console.log('🏷️ Processing game action tags:', tags);
    
    const results = [];
    
    tags.forEach(tag => {
        const trimmedTag = tag.trim();
        
        // Skip empty tags
        if (!trimmedTag) return;
        
        // Parse action and parameter (format: "action:param" or "action")
        const [action, param] = trimmedTag.split(':').map(s => s.trim());
        
        let result = { action, param, success: false, message: '' };
        
        try {
            switch (action) {
                case 'unlock_door':
                    if (param) {
                        const unlockResult = window.NPCGameBridge.unlockDoor(param);
                        if (unlockResult.success) {
                            result.success = true;
                            result.message = `🔓 Door unlocked: ${param}`;
                            if (ui) ui.showNotification(result.message, 'success');
                            console.log('✅ Door unlock successful:', unlockResult);
                        } else {
                            result.message = `⚠️ Failed to unlock: ${param}`;
                            if (ui) ui.showNotification(result.message, 'warning');
                            console.warn('⚠️ Door unlock failed:', unlockResult);
                        }
                    } else {
                        result.message = '⚠️ unlock_door tag missing room parameter';
                        console.warn(result.message);
                    }
                    break;
                    
                case 'give_item':
                    if (param) {
                        // Parse item properties from param (could be "keycard" or "keycard|CEO Keycard")
                        const [itemType, itemName] = param.split('|').map(s => s.trim());
                        const giveResult = window.NPCGameBridge.giveItem(itemType, { 
                            name: itemName || itemType 
                        });
                        if (giveResult.success) {
                            result.success = true;
                            result.message = `📦 Received: ${itemName || itemType}`;
                            if (ui) ui.showNotification(result.message, 'success');
                            console.log('✅ Item given successfully:', giveResult);
                        } else {
                            result.message = `⚠️ Failed to give item: ${itemType}`;
                            if (ui) ui.showNotification(result.message, 'warning');
                            console.warn('⚠️ Item give failed:', giveResult);
                        }
                    } else {
                        result.message = '⚠️ give_item tag missing item parameter';
                        console.warn(result.message);
                    }
                    break;
                    
                case 'set_objective':
                    if (param) {
                        window.NPCGameBridge.setObjective(param);
                        result.success = true;
                        result.message = `🎯 New objective: ${param}`;
                        if (ui) ui.showNotification(result.message, 'info');
                    } else {
                        result.message = '⚠️ set_objective tag missing text parameter';
                        console.warn(result.message);
                    }
                    break;
                    
                case 'reveal_secret':
                    if (param) {
                        const [secretId, secretData] = param.split('|').map(s => s.trim());
                        window.NPCGameBridge.revealSecret(secretId, secretData);
                        result.success = true;
                        result.message = `🔍 Secret revealed: ${secretId}`;
                        if (ui) ui.showNotification(result.message, 'info');
                    } else {
                        result.message = '⚠️ reveal_secret tag missing parameter';
                        console.warn(result.message);
                    }
                    break;
                    
                case 'add_note':
                    if (param) {
                        const [title, content] = param.split('|').map(s => s.trim());
                        window.NPCGameBridge.addNote(title, content || '');
                        result.success = true;
                        result.message = `📝 Note added: ${title}`;
                        if (ui) ui.showNotification(result.message, 'info');
                    } else {
                        result.message = '⚠️ add_note tag missing parameter';
                        console.warn(result.message);
                    }
                    break;
                    
                case 'trigger_minigame':
                    if (param) {
                        const minigameName = param;
                        result.success = true;
                        result.message = `🎮 Triggering minigame: ${minigameName}`;
                        if (ui) ui.showNotification(result.message, 'info');
                        // Note: Actual minigame triggering would be game-specific
                        console.log('🎮 Minigame trigger tag:', minigameName);
                    } else {
                        result.message = '⚠️ trigger_minigame tag missing minigame name';
                        console.warn(result.message);
                    }
                    break;
                    
                default:
                    // Unknown tag, log but don't fail
                    console.log(`ℹ️ Unknown game action tag: ${action}`);
                    result.message = `ℹ️ Unknown action: ${action}`;
                    break;
            }
        } catch (error) {
            result.success = false;
            result.message = `❌ Error processing tag ${action}: ${error.message}`;
            console.error(result.message, error);
        }
        
        results.push(result);
    });
    
    return results;
}

/**
 * Extract and filter game action tags from a tag array
 * Game action tags are those that trigger game mechanics (not speaker tags)
 * 
 * @param {Array<string>} tags - All tags from story
 * @returns {Array<string>} Only the action tags
 */
export function getActionTags(tags) {
    if (!tags) return [];
    
    // Filter out speaker tags and keep only action tags
    return tags.filter(tag => {
        const action = tag.split(':')[0].trim().toLowerCase();
        return action !== 'player' && 
               action !== 'npc' && 
               action !== 'speaker' &&
               !action.startsWith('speaker:');
    });
}

/**
 * Determine speaker from tags
 * @param {Array<string>} tags - Tags from story
 * @param {string} defaultSpeaker - Default speaker if not found in tags
 * @returns {string} Speaker ('npc' or 'player')
 */
export function determineSpeaker(tags, defaultSpeaker = 'npc') {
    if (!tags) return defaultSpeaker;
    
    for (const tag of tags) {
        const trimmed = tag.trim().toLowerCase();
        if (trimmed === 'player' || trimmed === 'speaker:player') {
            return 'player';
        }
        if (trimmed === 'npc' || trimmed === 'speaker:npc') {
            return 'npc';
        }
    }
    
    return defaultSpeaker;
}
