/**
 * PersonChatMinigame - Main Person-Chat Minigame Controller
 * 
 * Extends MinigameScene to provide cinematic in-person conversation interface.
 * Orchestrates:
 * - Portrait rendering (NPC and player)
 * - Dialogue display
 * - Choice selection
 * - Ink story progression
 * 
 * @module person-chat-minigame
 */

import { MinigameScene } from '../framework/base-minigame.js';
import PersonChatUI from './person-chat-ui.js';
import PhoneChatConversation from '../phone-chat/phone-chat-conversation.js'; // Reuse phone-chat conversation logic
import InkEngine from '../../systems/ink/ink-engine.js?v=1';

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
     * Display current dialogue and choices
     */
    showCurrentDialogue() {
        if (!this.conversation) return;
        
        try {
            // Continue the story to get next content
            const result = this.conversation.continue();
            
            // Check if story has ended
            if (result.hasEnded) {
                this.endConversation();
                return;
            }
            
            // Display dialogue text
            if (result.text && result.text.trim()) {
                this.ui.showDialogue(result.text, this.npcId);
            }
            
            // Display choices
            if (result.choices && result.choices.length > 0) {
                this.ui.showChoices(result.choices);
            } else if (!result.canContinue) {
                // No more content and no choices - conversation ended
                this.endConversation();
            }
        } catch (error) {
            console.error('❌ Error showing dialogue:', error);
            this.showError('An error occurred during conversation');
        }
    }
    
    /**
     * Handle choice selection
     * @param {number} choiceIndex - Index of selected choice
     */
    handleChoice(choiceIndex) {
        if (!this.conversation) return;
        
        try {
            console.log(`📝 Choice selected: ${choiceIndex}`);
            
            // Make choice in conversation (this also continues the story)
            const result = this.conversation.makeChoice(choiceIndex);
            
            // Clear old choices
            this.ui.hideChoices();
            
            // Show new dialogue after a small delay for visual feedback
            setTimeout(() => {
                // Display the result
                if (result.hasEnded) {
                    this.endConversation();
                } else {
                    // Display new text and choices
                    if (result.text && result.text.trim()) {
                        this.ui.showDialogue(result.text, this.npcId);
                    }
                    if (result.choices && result.choices.length > 0) {
                        this.ui.showChoices(result.choices);
                    }
                }
            }, 200);
        } catch (error) {
            console.error('❌ Error handling choice:', error);
            this.showError('Failed to process choice');
        }
    }
    
    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        if (this.messageContainer) {
            this.messageContainer.innerHTML = `<div class="minigame-error">${message}</div>`;
        }
        console.error(`⚠️ Error: ${message}`);
    }
    
    /**
     * End conversation and close minigame
     */
    endConversation() {
        try {
            console.log('🎭 Ending conversation');
            
            // Cleanup conversation
            this.conversation = null;
            this.isConversationActive = false;
            
            // Close minigame
            this.complete(true);
            
        } catch (error) {
            console.error('❌ Error ending conversation:', error);
            this.complete(false);
        }
    }
    
    /**
     * Cleanup and destroy minigame
     */
    destroy() {
        try {
            // Stop conversation
            if (this.conversation) {
                this.conversation.end();
                this.conversation = null;
            }
            
            // Destroy UI
            if (this.ui) {
                this.ui.destroy();
                this.ui = null;
            }
            
            console.log('✅ PersonChatMinigame destroyed');
        } catch (error) {
            console.error('❌ Error destroying minigame:', error);
        }
    }
    
    /**
     * Complete minigame with success/failure
     * @param {boolean} success - Whether minigame succeeded
     */
    complete(success) {
        this.destroy();
        super.complete(success);
    }
}
