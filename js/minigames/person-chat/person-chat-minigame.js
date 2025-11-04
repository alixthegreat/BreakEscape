/**
 * PersonChatMinigame - Main Person-Chat Minigame Controller (Single Speaker Layout)
 * 
 * Extends MinigameScene to provide cinematic in-person conversation interface.
 * Orchestrates:
 * - Portrait rendering (single speaker at a time)
 * - Dialogue display
 * - Continue button for story progression
 * - Choice selection
 * - Ink story progression
 * 
 * @module person-chat-minigame
 */

import { MinigameScene } from '../framework/base-minigame.js';
import PersonChatUI from './person-chat-ui.js';
import PhoneChatConversation from '../phone-chat/phone-chat-conversation.js'; // Reuse phone-chat conversation logic
import InkEngine from '../../systems/ink/ink-engine.js?v=1';
import { processGameActionTags, determineSpeaker as determineSpeakerFromTags } from '../helpers/chat-helpers.js';

export class PersonChatMinigame extends MinigameScene {
    /**
     * Create a PersonChatMinigame instance
     * @param {HTMLElement} container - Container element
     * @param {Object} params - Configuration parameters
     */
    constructor(container, params) {
        super(container, params);
        
        // Get required globals
        if (!window.game || !window.npcManager) {
            throw new Error('PersonChatMinigame requires window.game and window.npcManager');
        }
        
        this.game = window.game;
        this.npcManager = window.npcManager;
        this.player = window.player;
        
        // Get scenario data for player and NPC sprites
        this.scenario = window.gameScenario || {};
        
        // Create InkEngine instance for this conversation
        this.inkEngine = new InkEngine(`person-chat-${params.npcId}`);
        
        // Parameters
        this.npcId = params.npcId;
        this.title = params.title || 'Conversation';
        
        // Verify NPC exists
        const npc = this.npcManager.getNPC(this.npcId);
        if (!npc) {
            throw new Error(`NPC not found: ${this.npcId}`);
        }
        this.npc = npc;
        
        // Get player config from scenario
        this.playerData = this.scenario.player || {
            id: 'player',
            displayName: 'Agent 0x00',
            spriteSheet: 'hacker'
        };
        
        // Build character index for multi-character support
        this.characters = this.buildCharacterIndex();
        
        // Modules
        this.ui = null;
        this.conversation = null;
        
        // State
        this.isConversationActive = false;
        this.currentSpeaker = null; // Track current speaker ID ('player' or NPC id)
        this.lastResult = null; // Store last continue() result for choice handling
        
        console.log(`🎭 PersonChatMinigame created for NPC: ${this.npcId}`);
    }
    
    /**
     * Build index of all available characters (player + NPCs)
     * @returns {Object} Map of character ID to character data
     */
    buildCharacterIndex() {
        const characters = {};
        
        // Add player
        characters['player'] = this.playerData;
        
        // Add main NPC
        characters[this.npc.id] = this.npc;
        
        // Add other NPCs from scenario if available
        if (this.scenario.npcs && Array.isArray(this.scenario.npcs)) {
            this.scenario.npcs.forEach(npc => {
                if (npc.id !== this.npc.id) {
                    characters[npc.id] = npc;
                }
            });
        }
        
        console.log(`👥 Built character index with ${Object.keys(characters).length} characters:`, Object.keys(characters));
        return characters;
    }
    
    /**
     * Get character data by ID
     * @param {string} characterId - Character ID (player, npc_id, etc.)
     * @returns {Object} Character data
     */
    getCharacterById(characterId) {
        if (!characterId) return this.npc; // Fallback to main NPC
        
        // Handle legacy speaker values
        if (characterId === 'npc') {
            return this.npc;
        }
        if (characterId === 'player') {
            return this.playerData;
        }
        
        // Look up by ID
        return this.characters[characterId] || this.npc;
    }
    
    /**
     * Initialize the minigame UI and components
     */
    init() {
        // Set up basic minigame structure (header, container, etc.)
        if (!this.params.cancelText) {
            this.params.cancelText = 'End Conversation';
        }
        super.init();
        
        // Customize header
        this.headerElement.innerHTML = `
            <h3>🎭 ${this.title}</h3>
            <p>Speaking with ${this.npc.displayName}</p>
        `;
        
        // Create UI, passing both NPC and player data
        this.ui = new PersonChatUI(this.gameContainer, {
            game: this.game,
            npc: this.npc,
            playerSprite: this.player,
            playerData: this.playerData,
            characters: this.characters  // Pass multi-character support
        }, this.npcManager);
        
        this.ui.render();
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('✅ PersonChatMinigame initialized');
    }
    
    /**
     * Set up event listeners for UI interactions
     */
    setupEventListeners() {
        // Choice button clicks
        this.addEventListener(this.ui.elements.choicesContainer, 'click', (e) => {
            const choiceButton = e.target.closest('.person-chat-choice-button');
            if (choiceButton) {
                const choiceIndex = parseInt(choiceButton.dataset.index);
                this.handleChoice(choiceIndex);
            }
        });
    }
    
    /**
     * Start the minigame
     * Initializes conversation flow
     */
    start() {
        super.start();
        
        console.log('🎭 PersonChatMinigame started');
        
        // Start conversation with Ink
        this.startConversation();
    }
    
    /**
     * Start conversation with NPC
     * Loads Ink story and shows initial dialogue
     */
    async startConversation() {
        try {
            // Create conversation manager using PhoneChatConversation (reused logic)
            this.conversation = new PhoneChatConversation(this.npcId, this.npcManager, this.inkEngine);
            
            // Load story from NPC's storyPath or storyJSON
            const storySource = this.npc.storyJSON || this.npc.storyPath;
            const loaded = await this.conversation.loadStory(storySource);
            
            if (!loaded) {
                console.error('❌ Failed to load conversation story');
                this.showError('Failed to load conversation');
                return;
            }
            
            // Navigate to start knot
            const startKnot = this.npc.currentKnot || 'start';
            this.conversation.goToKnot(startKnot);
            
            this.isConversationActive = true;
            
            // Show initial dialogue
            this.showCurrentDialogue();
            
            console.log('✅ Conversation started');
        } catch (error) {
            console.error('❌ Error starting conversation:', error);
            this.showError('An error occurred during conversation');
        }
    }
    
    /**
     * Display current dialogue (without advancing yet)
     */
    showCurrentDialogue() {
        if (!this.conversation) return;
        
        try {
            // Get current content without advancing
            const result = this.conversation.continue();
            
            // Store result for later use
            this.lastResult = result;
            
            // Check if story has ended
            if (result.hasEnded) {
                this.endConversation();
                return;
            }
            
            // Determine who is speaking based on tags
            const speaker = this.determineSpeaker(result);
            this.currentSpeaker = speaker;
            
            console.log(`🗣️ showCurrentDialogue - result.text: "${result.text?.substring(0, 50)}..." (${result.text?.length || 0} chars)`);
            console.log(`🗣️ showCurrentDialogue - result.canContinue: ${result.canContinue}`);
            console.log(`🗣️ showCurrentDialogue - result.hasEnded: ${result.hasEnded}`);
            console.log(`🗣️ showCurrentDialogue - result.choices.length: ${result.choices?.length || 0}`);
            console.log(`🗣️ showCurrentDialogue - this.ui exists:`, !!this.ui);
            console.log(`🗣️ showCurrentDialogue - this.ui.showDialogue exists:`, typeof this.ui?.showDialogue);
            
            // Display dialogue text with speaker (only if there's actual text)
            if (result.text && result.text.trim()) {
                console.log(`🗣️ Calling showDialogue with speaker: ${speaker}`);
                this.ui.showDialogue(result.text, speaker);
            } else {
                console.log(`⚠️ Skipping showDialogue - no text or text is empty`);
            }
            
            // Display choices if available
            if (result.choices && result.choices.length > 0) {
                this.ui.showChoices(result.choices);
                console.log(`📋 ${result.choices.length} choices available`);
            } else if (result.canContinue) {
                // No choices but can continue - auto-advance after delay
                console.log('⏳ Auto-continuing in 2 seconds...');
                setTimeout(() => this.showCurrentDialogue(), 2000);
            } else {
                // No choices and can't continue - story will end
                console.log('✓ Waiting for story to end...');
                setTimeout(() => this.endConversation(), 1000);
            }
        } catch (error) {
            console.error('❌ Error showing dialogue:', error);
            this.showError('An error occurred during conversation');
        }
    }
    
    /**
     * Determine who is speaking based on Ink tags
     * Supports speaker tags like:
     * - # speaker:player
     * - # speaker:npc (defaults to main NPC)
     * - # speaker:npc_id:character_id (specific character)
     * 
     * @param {Object} result - Result from conversation.continue()
     * @returns {string} Character ID of speaker (player, npc_id, or main NPC id)
     */
    determineSpeaker(result) {
        if (!result.tags || result.tags.length === 0) {
            return this.npc.id; // Default to main NPC
        }
        
        // Check tags in reverse order to find the last speaker tag (current speaker)
        for (let i = result.tags.length - 1; i >= 0; i--) {
            const tag = result.tags[i].trim().toLowerCase();
            
            // Handle multi-part speaker tags like "speaker:npc:test_npc_back"
            if (tag.startsWith('speaker:')) {
                const parts = tag.split(':');
                
                if (parts.length === 2) {
                    // Simple speaker tag: speaker:player or speaker:npc
                    const speaker = parts[1];
                    if (speaker === 'player') return 'player';
                    if (speaker === 'npc') return this.npc.id; // Default NPC
                } else if (parts.length === 3) {
                    // Specific character tag: speaker:npc:character_id
                    const characterId = parts[2];
                    return this.characters[characterId] ? characterId : this.npc.id;
                } else if (parts.length > 3) {
                    // Handle IDs with colons like speaker:npc:test_npc_back
                    const characterId = parts.slice(2).join(':');
                    return this.characters[characterId] ? characterId : this.npc.id;
                }
            }
            
            // Fallback for non-speaker: tags
            if (tag === 'player') return 'player';
            if (tag === 'npc') return this.npc.id;
        }
        
        // No speaker tag found - default to main NPC
        return this.npc.id;
    }
    
    /**
     * Handle choice selection
     * @param {number} choiceIndex - Index of selected choice
     */
    handleChoice(choiceIndex) {
        if (!this.conversation || !this.lastResult) return;
        
        try {
            console.log(`📝 Choice selected: ${choiceIndex}`);
            
            // Get the choice text from lastResult before making the choice
            const choiceText = this.lastResult.choices[choiceIndex]?.text || '';
            
            // Clear choice buttons immediately
            this.ui.hideChoices();
            
            // Make choice in conversation (this also calls continue() internally)
            const result = this.conversation.makeChoice(choiceIndex);
            
            // First, display the player's choice as dialogue
            if (choiceText) {
                this.ui.showDialogue(choiceText, 'player');
            }
            
            // Then display the result (dialogue blocks) after a small delay
            setTimeout(() => {
                // Process accumulated dialogue by splitting into individual speaker blocks
                this.displayAccumulatedDialogue(result);
            }, 1500);
        } catch (error) {
            console.error('❌ Error handling choice:', error);
            this.showError('An error occurred when processing your choice');
        }
    }
    
    /**
     * Display accumulated dialogue by splitting into individual speaker blocks
     * @param {Object} result - Result with potentially multiple lines and tags
     */
    displayAccumulatedDialogue(result) {
        if (!result.text || !result.tags) {
            // No content to display
            if (result.hasEnded) {
                this.endConversation();
            }
            return;
        }
        
        // Split text into lines
        const lines = result.text.split('\n').filter(line => line.trim());
        
        // We have lines and tags - pair them up
        // Each tag corresponds to a line (or group of lines before the next tag)
        if (lines.length === 0) {
            if (result.hasEnded) {
                this.endConversation();
            }
            return;
        }
        
        // Create dialogue blocks: each block is one or more consecutive lines with the same speaker
        const dialogueBlocks = this.createDialogueBlocks(lines, result.tags);
        
        // Display blocks sequentially with delays
        this.displayDialogueBlocksSequentially(dialogueBlocks, result, 0);
    }
    
    /**
     * Create dialogue blocks from lines and speaker tags
     * @param {Array<string>} lines - Text lines
     * @param {Array<string>} tags - Speaker tags
     * @returns {Array<Object>} Array of {speaker, text} blocks
     */
    createDialogueBlocks(lines, tags) {
        const blocks = [];
        let blockIndex = 0;
        
        // Group lines by speaker based on tags
        for (let tagIdx = 0; tagIdx < tags.length; tagIdx++) {
            const tag = tags[tagIdx];
            
            // Determine speaker from tag - support multiple formats
            let speaker = 'npc'; // default
            if (tag.includes('speaker:player')) {
                speaker = 'player';
            } else if (tag.includes('speaker:npc:')) {
                // Extract character ID from speaker:npc:character_id format
                const match = tag.match(/speaker:npc:(\S+)/);
                if (match && match[1]) {
                    speaker = match[1];
                }
            } else if (tag === 'player' || tag.includes('player')) {
                speaker = 'player';
            }
            
            // Find how many lines belong to this speaker (until next tag or end)
            const nextTagIdx = tagIdx + 1;
            const startLineIdx = blockIndex;
            
            // Count lines for this speaker - lines between this tag and the next
            let endLineIdx = lines.length;
            if (nextTagIdx < tags.length) {
                // There's another tag coming, but we need to figure out how many lines
                // For now, assume 1 line per tag (common case)
                endLineIdx = startLineIdx + 1;
            }
            
            // Collect the text for this speaker
            const blockText = lines.slice(startLineIdx, endLineIdx).join('\n').trim();
            if (blockText) {
                blocks.push({ speaker, text: blockText, tag });
            }
            
            blockIndex = endLineIdx;
        }
        
        return blocks;
    }
    
    /**
     * Display dialogue blocks sequentially
     * @param {Array<Object>} blocks - Array of dialogue blocks
     * @param {Object} originalResult - Original result from Ink
     * @param {number} blockIndex - Current block index
     */
    displayDialogueBlocksSequentially(blocks, originalResult, blockIndex) {
        if (blockIndex >= blocks.length) {
            // All blocks displayed, check if story has ended
            if (originalResult.hasEnded) {
                setTimeout(() => this.endConversation(), 1000);
            } else {
                // Try to continue for more dialogue
                console.log('⏸️ Blocks finished, checking for more dialogue...');
                setTimeout(() => {
                    const nextLine = this.conversation.continue();
                    if (nextLine.text && nextLine.text.trim()) {
                        this.displayAccumulatedDialogue(nextLine);
                    } else if (nextLine.hasEnded) {
                        this.endConversation();
                    }
                }, 2000);
            }
            return;
        }
        
        // Display current block
        const block = blocks[blockIndex];
        console.log(`📋 Displaying block ${blockIndex + 1}/${blocks.length}: ${block.speaker}`);
        
        this.ui.showDialogue(block.text, block.speaker);
        
        // Display next block after delay
        setTimeout(() => {
            this.displayDialogueBlocksSequentially(blocks, originalResult, blockIndex + 1);
        }, 2000);
    }
    
    /**
     * Display dialogue from a result object (without calling continue() again)
     * @param {Object} result - Story result from conversation.continue()
     */
    displayDialogueResult(result) {
        try {
            // Check if story has ended
            if (result.hasEnded) {
                this.endConversation();
                return;
            }
            
            // Process any game action tags (give_item, unlock_door, etc.)
            if (result.tags && result.tags.length > 0) {
                console.log('🏷️ Processing tags from story:', result.tags);
                processGameActionTags(result.tags, this.ui);
            }
            
            // Determine who is speaking based on tags
            const speaker = this.determineSpeaker(result);
            this.currentSpeaker = speaker;
            
            console.log(`🗣️ displayDialogueResult - result.text: "${result.text?.substring(0, 50)}..." (${result.text?.length || 0} chars)`);
            console.log(`🗣️ displayDialogueResult - result.canContinue: ${result.canContinue}`);
            console.log(`🗣️ displayDialogueResult - result.choices.length: ${result.choices?.length || 0}`);
            
            // Display dialogue text with speaker (only if there's actual text)
            if (result.text && result.text.trim()) {
                console.log(`🗣️ Calling showDialogue with speaker: ${speaker}`);
                this.ui.showDialogue(result.text, speaker);
            } else {
                console.log(`⚠️ Skipping showDialogue - no text or text is empty`);
            }
            
            // Display choices if available
            if (result.choices && result.choices.length > 0) {
                this.ui.showChoices(result.choices);
                console.log(`📋 ${result.choices.length} choices available`);
            } else if (result.canContinue) {
                // No choices but can continue - auto-advance after delay
                console.log('⏳ Auto-continuing in 2 seconds...');
                setTimeout(() => this.showCurrentDialogue(), 2000);
            } else {
                // No choices and can't continue - check if there's more content
                // Try to continue anyway (for linear scripted conversations)
                console.log('⏸️ No more choices, attempting to continue for next line...');
                setTimeout(() => {
                    const nextLine = this.conversation.continue();
                    if (nextLine.text && nextLine.text.trim()) {
                        // There's more dialogue to show
                        this.displayDialogueResult(nextLine);
                    } else if (nextLine.hasEnded) {
                        // Story has truly ended
                        this.endConversation();
                    } else {
                        // No text but story isn't ended - wait a bit and end
                        console.log('✓ No more dialogue - ending conversation');
                        setTimeout(() => this.endConversation(), 1000);
                    }
                }, 2000);
            }
        } catch (error) {
            console.error('❌ Error displaying dialogue:', error);
            this.showError('An error occurred during conversation');
        }
    }
    
    /**
     * End conversation and clean up
     */
    endConversation() {
        console.log('🎭 Conversation ended');
        
        this.isConversationActive = false;
        
        // Show completion message
        if (this.ui.elements.dialogueText) {
            this.ui.elements.dialogueText.textContent = 'Conversation ended.';
        }
        
        // Hide controls
        this.ui.reset();
        
        // Close minigame after a delay
        setTimeout(() => {
            this.complete(true);
        }, 1000);
    }
    
    /**
     * Show error message
     * @param {string} message - Error message to display
     */
    showError(message) {
        console.error(`❌ ${message}`);
        
        if (this.ui.elements.dialogueText) {
            this.ui.elements.dialogueText.innerHTML = `
                <span style="color: #ff6b6b;">⚠️ Error</span><br/>
                ${message}
            `;
        }
    }
}

// Register this minigame
if (window.MinigameFramework) {
    window.MinigameFramework.registerScene('person-chat-minigame', PersonChatMinigame);
    console.log('✅ PersonChatMinigame registered');
}

export default PersonChatMinigame;
