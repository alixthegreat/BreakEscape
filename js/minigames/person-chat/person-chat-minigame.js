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
        
        // Modules
        this.ui = null;
        this.conversation = null;
        
        // State
        this.isConversationActive = false;
        this.currentSpeaker = null; // Track current speaker ('npc' or 'player')
        this.lastResult = null; // Store last continue() result for choice handling
        
        console.log(`🎭 PersonChatMinigame created for NPC: ${this.npcId}`);
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
        
        // Create UI
        this.ui = new PersonChatUI(this.gameContainer, {
            game: this.game,
            npc: this.npc,
            playerSprite: this.player
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
     * Determine who is speaking based on Ink tags or content
     * @param {Object} result - Result from conversation.continue()
     * @returns {string} Speaker ('npc' or 'player')
     */
    determineSpeaker(result) {
        // Check for speaker tag in result
        if (result.tags) {
            for (const tag of result.tags) {
                if (tag === 'player' || tag === 'speaker:player') {
                    return 'player';
                }
                if (tag === 'npc' || tag === 'speaker:npc') {
                    return 'npc';
                }
            }
        }
        
        // Default: alternate speakers, or start with NPC
        return this.currentSpeaker === 'player' ? 'npc' : 'npc';
    }
    
    /**
     * Handle choice selection
     * @param {number} choiceIndex - Index of selected choice
     */
    handleChoice(choiceIndex) {
        if (!this.conversation) return;
        
        try {
            console.log(`📝 Choice selected: ${choiceIndex}`);
            
            // Make choice in conversation (this also calls continue() internally)
            const result = this.conversation.makeChoice(choiceIndex);
            
            // Display the result directly without calling continue() again
            this.displayDialogueResult(result);
        } catch (error) {
            console.error('❌ Error handling choice:', error);
            this.showError('An error occurred when processing your choice');
        }
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
                // No choices and can't continue - story will end
                console.log('✓ Waiting for story to end...');
                setTimeout(() => this.endConversation(), 1000);
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
