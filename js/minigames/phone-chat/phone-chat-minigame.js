/**
 * PhoneChatMinigame - Main Controller
 * 
 * Extends MinigameScene to provide Phaser-based phone chat functionality.
 * Orchestrates UI, conversation, and history management for NPC interactions.
 * 
 * @module phone-chat-minigame
 */

import { MinigameScene } from '../framework/base-minigame.js';
import PhoneChatUI from './phone-chat-ui.js';
import PhoneChatConversation from './phone-chat-conversation.js';
import PhoneChatHistory from './phone-chat-history.js';
import InkEngine from '../../systems/ink/ink-engine.js';

export class PhoneChatMinigame extends MinigameScene {
    /**
     * Create a PhoneChatMinigame instance
     * @param {HTMLElement} container - Container element
     * @param {Object} params - Configuration parameters
     */
    constructor(container, params) {
        super(container, params);
        
        // Debug logging
        console.log('📱 PhoneChatMinigame constructor called with:', { container, params });
        console.log('📱 this.params after super():', this.params);
        
        // Ensure params exists (use this.params from parent)
        const safeParams = this.params || {};
        console.log('📱 safeParams:', safeParams);
        
        // Validate required params
        if (!safeParams.npcId && !safeParams.phoneId) {
            console.error('❌ Missing required params. npcId:', safeParams.npcId, 'phoneId:', safeParams.phoneId);
            throw new Error('PhoneChatMinigame requires either npcId or phoneId');
        }
        
        // Get NPC manager from window (set up by main.js)
        if (!window.npcManager) {
            throw new Error('NPCManager not found. Ensure main.js has initialized it.');
        }
        
        this.npcManager = window.npcManager;
        this.inkEngine = new InkEngine();
        
        // Initialize modules (will be set up in init())
        this.ui = null;
        this.conversation = null;
        this.history = null;
        
        // State
        this.currentNPCId = safeParams.npcId || null;
        this.phoneId = safeParams.phoneId || 'player_phone';
        this.isConversationActive = false;
        
        console.log('📱 PhoneChatMinigame created', {
            npcId: this.currentNPCId,
            phoneId: this.phoneId
        });
    }
    
    /**
     * Initialize the minigame UI and components
     */
    init() {
        // Call parent init to set up basic structure
        super.init();
        
        // Ensure params exists
        const safeParams = this.params || {};
        
        // Customize header
        this.headerElement.innerHTML = `
            <h3>${safeParams.title || 'Phone'}</h3>
            <p>Messages and conversations</p>
        `;
        
        // Initialize UI
        this.ui = new PhoneChatUI(this.gameContainer, safeParams, this.npcManager);
        this.ui.render();
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('✅ PhoneChatMinigame initialized');
    }
    
    /**
     * Set up event listeners for UI interactions
     */
    setupEventListeners() {
        // Contact list item clicks
        this.addEventListener(this.ui.elements.contactList, 'click', (e) => {
            const contactItem = e.target.closest('.contact-item');
            if (contactItem) {
                const npcId = contactItem.dataset.npcId;
                this.openConversation(npcId);
            }
        });
        
        // Back button (return to contact list)
        this.addEventListener(this.ui.elements.backButton, 'click', () => {
            this.closeConversation();
        });
        
        // Choice button clicks
        this.addEventListener(this.ui.elements.choicesContainer, 'click', (e) => {
            const choiceButton = e.target.closest('.choice-button');
            if (choiceButton) {
                const choiceIndex = parseInt(choiceButton.dataset.index);
                this.handleChoice(choiceIndex);
            }
        });
        
        // Keyboard shortcuts
        this.addEventListener(document, 'keydown', (e) => {
            this.handleKeyPress(e);
        });
    }
    
    /**
     * Handle keyboard input
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyPress(event) {
        if (!this.gameState.isActive) return;
        
        switch(event.key) {
            case 'Escape':
                if (this.ui.getCurrentView() === 'conversation') {
                    // Go back to contact list
                    event.preventDefault();
                    this.closeConversation();
                } else {
                    // Close minigame
                    this.complete(false);
                }
                break;
                
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
                // Quick choice selection (1-5)
                if (this.ui.getCurrentView() === 'conversation') {
                    const choiceIndex = parseInt(event.key) - 1;
                    const choices = this.ui.elements.choicesContainer.querySelectorAll('.choice-button');
                    if (choices[choiceIndex]) {
                        event.preventDefault();
                        this.handleChoice(choiceIndex);
                    }
                }
                break;
        }
    }
    
    /**
     * Start the minigame
     */
    start() {
        super.start();
        
        // If NPC ID provided, open that conversation directly
        if (this.currentNPCId) {
            this.openConversation(this.currentNPCId);
        } else {
            // Show contact list for this phone
            this.ui.showContactList(this.phoneId);
        }
        
        console.log('✅ PhoneChatMinigame started');
    }
    
    /**
     * Open a conversation with an NPC
     * @param {string} npcId - NPC identifier
     */
    async openConversation(npcId) {
        const npc = this.npcManager.getNPC(npcId);
        if (!npc) {
            console.error(`❌ NPC not found: ${npcId}`);
            this.ui.showNotification('Contact not found', 'error');
            return;
        }
        
        console.log(`💬 Opening conversation with ${npc.displayName || npcId}`);
        
        // Update current NPC
        this.currentNPCId = npcId;
        
        // Initialize conversation modules
        this.history = new PhoneChatHistory(npcId, this.npcManager);
        this.conversation = new PhoneChatConversation(npcId, this.npcManager, this.inkEngine);
        
        // Show conversation view
        this.ui.showConversation(npcId);
        
        // Load conversation history
        const history = this.history.loadHistory();
        if (history.length > 0) {
            this.ui.addMessages(history);
            // Mark messages as read
            this.history.markAllRead();
        }
        
        // Load and start Ink story
        const storyPath = npc.storyPath || npc.inkStoryPath;
        if (!storyPath) {
            console.error(`❌ No story path found for ${npcId}`);
            this.ui.showNotification('No conversation available', 'error');
            return;
        }
        
        const loaded = await this.conversation.loadStory(storyPath);
        if (!loaded) {
            this.ui.showNotification('Failed to load conversation', 'error');
            return;
        }
        
        // Navigate to starting knot
        // Always navigate to a knot since some Ink stories don't start at root properly
        const safeParams = this.params || {};
        const startKnot = safeParams.startKnot || npc.currentKnot || 'start';
        this.conversation.goToKnot(startKnot);
        
        // Continue story and show new content
        this.isConversationActive = true;
        this.continueStory();
    }
    
    /**
     * Continue the Ink story and display new content
     */
    continueStory() {
        if (!this.conversation || !this.isConversationActive) {
            return;
        }
        
        // Show typing indicator briefly
        this.ui.showTypingIndicator();
        
        setTimeout(() => {
            this.ui.hideTypingIndicator();
            
            // Get next story content
            const result = this.conversation.continue();
            console.log('📖 Story continue result:', result);
            console.log('📖 Choices:', result.choices);
            console.log('📖 Choices length:', result.choices?.length);
            
            // If story has ended
            if (result.hasEnded) {
                console.log('🏁 Conversation ended');
                this.ui.showNotification('Conversation ended', 'info');
                this.isConversationActive = false;
                return;
            }
            
            // Display NPC messages
            if (result.text && result.text.trim()) {
                const npcMessages = result.text.trim().split('\n').filter(line => line.trim());
                
                npcMessages.forEach(message => {
                    if (message.trim()) {
                        this.ui.addMessage('npc', message.trim());
                        this.history.addMessage('npc', message.trim());
                    }
                });
            }
            
            // Display choices
            if (result.choices && result.choices.length > 0) {
                this.ui.addChoices(result.choices);
            } else if (!result.canContinue) {
                // No more content and no choices - end conversation
                console.log('🏁 No more choices available');
                this.isConversationActive = false;
            }
        }, 500); // Brief delay for typing effect
    }
    
    /**
     * Handle player choice selection
     * @param {number} choiceIndex - Index of selected choice
     */
    handleChoice(choiceIndex) {
        if (!this.conversation || !this.isConversationActive) {
            return;
        }
        
        // Get choice text before making choice
        const choices = this.ui.elements.choicesContainer.querySelectorAll('.choice-button');
        const choiceButton = choices[choiceIndex];
        if (!choiceButton) {
            console.error(`❌ Invalid choice index: ${choiceIndex}`);
            return;
        }
        
        const choiceText = choiceButton.textContent;
        
        console.log(`👆 Player chose: ${choiceText}`);
        
        // Display player's choice as a message
        this.ui.addMessage('player', choiceText);
        this.history.addMessage('player', choiceText, { choice: choiceIndex });
        
        // Clear choices
        this.ui.clearChoices();
        
        // Make choice in Ink story (this also continues and returns the result)
        const result = this.conversation.makeChoice(choiceIndex);
        
        // Display the result from makeChoice (don't call continueStory again!)
        if (result.hasEnded) {
            console.log('🏁 Conversation ended');
            this.ui.showNotification('Conversation ended', 'info');
            this.isConversationActive = false;
            return;
        }
        
        // Show typing indicator briefly
        this.ui.showTypingIndicator();
        
        setTimeout(() => {
            this.ui.hideTypingIndicator();
            
            // Display NPC messages from the result
            if (result.text && result.text.trim()) {
                const npcMessages = result.text.trim().split('\n').filter(line => line.trim());
                
                npcMessages.forEach(message => {
                    if (message.trim()) {
                        this.ui.addMessage('npc', message.trim());
                        this.history.addMessage('npc', message.trim());
                    }
                });
            }
            
            // Display choices
            if (result.choices && result.choices.length > 0) {
                this.ui.addChoices(result.choices);
            } else if (!result.canContinue) {
                // No more content and no choices - end conversation
                console.log('🏁 No more choices available');
                this.isConversationActive = false;
            }
        }, 500); // Brief delay for typing effect
    }
    
    /**
     * Close the current conversation and return to contact list
     */
    closeConversation() {
        console.log('🔙 Closing conversation');
        
        this.isConversationActive = false;
        this.currentNPCId = null;
        this.conversation = null;
        this.history = null;
        
        // Show contact list
        this.ui.showContactList(this.phoneId);
    }
    
    /**
     * Complete the minigame
     * @param {boolean} success - Whether minigame was successful
     */
    complete(success) {
        console.log('📱 PhoneChatMinigame completing', { success });
        
        // Clean up conversation
        this.isConversationActive = false;
        
        // Call parent complete
        super.complete(success);
    }
    
    /**
     * Clean up resources
     */
    cleanup() {
        console.log('🧹 PhoneChatMinigame cleaning up');
        
        if (this.ui) {
            this.ui.cleanup();
        }
        
        this.isConversationActive = false;
        this.conversation = null;
        this.history = null;
        
        // Call parent cleanup
        super.cleanup();
    }
}

// Export for module usage
export default PhoneChatMinigame;
