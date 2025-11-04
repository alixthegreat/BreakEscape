/**
 * PersonChatUI - UI Component for Person-Chat Minigame (Background Portrait Layout)
 * 
 * Handles rendering of conversation interface with:
 * - Portrait filling background
 * - Dialogue as caption subtitle at bottom 1/3
 * - Choices displayed below dialogue
 * - Continue button
 * - Pixel-art styling
 * 
 * @module person-chat-ui
 */

import PersonChatPortraits from './person-chat-portraits.js';

export default class PersonChatUI {
    /**
     * Create UI component
     * @param {HTMLElement} container - Container for UI
     * @param {Object} params - Configuration (game, npc, playerSprite)
     * @param {NPCManager} npcManager - NPC manager for sprite access
     */
    constructor(container, params, npcManager) {
        this.container = container;
        this.params = params;
        this.npcManager = npcManager;
        this.game = params.game;
        this.npc = params.npc;
        this.playerSprite = params.playerSprite;
        this.playerData = params.playerData || {};
        
        // UI elements
        this.elements = {
            root: null,
            mainContent: null,
            portraitSection: null,
            portraitContainer: null,
            portraitLabel: null,
            captionArea: null,
            speakerName: null,
            dialogueBox: null,
            dialogueText: null,
            choicesContainer: null,
            continueButton: null
        };
        
        // Portrait renderer
        this.portraitRenderer = null;
        
        // State
        this.currentSpeaker = null; // 'npc' or 'player'
        this.hasContinued = false; // Track if user has clicked continue
        
        console.log('📱 PersonChatUI created');
    }
    
    /**
     * Render the complete UI structure
     */
    render() {
        try {
            this.container.innerHTML = '';
            
            // Create root container
            this.elements.root = document.createElement('div');
            this.elements.root.className = 'person-chat-root';
            
            // Create main content area (portrait fills background + caption at bottom)
            this.createMainContent();
            
            // Add to container
            this.container.appendChild(this.elements.root);
            
            // Initialize portrait renderer
            this.initializePortrait();
            
            console.log('✅ PersonChatUI rendered');
        } catch (error) {
            console.error('❌ Error rendering UI:', error);
        }
    }
    
    /**
     * Create main content area with portrait background and dialogue caption
     */
    createMainContent() {
        const mainContent = document.createElement('div');
        mainContent.className = 'person-chat-main-content';
        
        // Portrait section - fills background
        const portraitSection = document.createElement('div');
        portraitSection.className = 'person-chat-portrait-section';
        
        const portraitLabel = document.createElement('div');
        portraitLabel.className = 'person-chat-portrait-label';
        portraitLabel.textContent = this.npc?.displayName || 'NPC';
        
        const portraitContainer = document.createElement('div');
        portraitContainer.className = 'person-chat-portrait-canvas-container';
        portraitContainer.id = 'portrait-container';
        
        portraitSection.appendChild(portraitLabel);
        portraitSection.appendChild(portraitContainer);
        
        // Caption area - positioned at bottom with dialogue and choices
        const captionArea = document.createElement('div');
        captionArea.className = 'person-chat-caption-area';
        
        const speakerName = document.createElement('div');
        speakerName.className = 'person-chat-speaker-name';
        
        const dialogueBox = document.createElement('div');
        dialogueBox.className = 'person-chat-dialogue-box';
        
        const dialogueText = document.createElement('p');
        dialogueText.className = 'person-chat-dialogue-text';
        dialogueText.id = 'dialogue-text';
        
        dialogueBox.appendChild(dialogueText);
        
        // Choices container (in caption area, below dialogue)
        const choicesContainer = document.createElement('div');
        choicesContainer.className = 'person-chat-choices-container';
        choicesContainer.id = 'choices-container';
        choicesContainer.style.display = 'none';
        
        // Assemble caption area: speaker name, dialogue, choices
        captionArea.appendChild(speakerName);
        captionArea.appendChild(dialogueBox);
        captionArea.appendChild(choicesContainer);
        
        // Assemble main content
        mainContent.appendChild(portraitSection);
        mainContent.appendChild(captionArea);
        
        this.elements.mainContent = mainContent;
        this.elements.portraitSection = portraitSection;
        this.elements.portraitContainer = portraitContainer;
        this.elements.portraitLabel = portraitLabel;
        this.elements.captionArea = captionArea;
        this.elements.speakerName = speakerName;
        this.elements.dialogueBox = dialogueBox;
        this.elements.dialogueText = dialogueText;
        this.elements.choicesContainer = choicesContainer;
        
        this.elements.root.appendChild(mainContent);
    }
    
    /**
     * Initialize portrait renderer
     */
    initializePortrait() {
        try {
            if (!this.game || !this.npc) {
                console.warn('⚠️ Missing game or NPC, skipping portrait initialization');
                return;
            }
            
            // Pass the actual NPC object so it has all properties including spriteTalk
            this.portraitRenderer = new PersonChatPortraits(
                this.game,
                this.npc,
                this.elements.portraitContainer
            );
            this.portraitRenderer.init();
            
            console.log('✅ Portrait initialized');
        } catch (error) {
            console.error('❌ Error initializing portrait:', error);
        }
    }
    
    /**
     * Display dialogue text with speaker
     * @param {string} text - Dialogue text to display
     * @param {string} speaker - Speaker name ('npc' or 'player')
     */
    showDialogue(text, speaker = 'npc') {
        this.currentSpeaker = speaker;
        
        console.log(`📝 showDialogue called with speaker: ${speaker}, text length: ${text?.length || 0}`);
        console.log(`📝 dialogueText element:`, this.elements.dialogueText);
        console.log(`📝 speakerName element:`, this.elements.speakerName);
        
        // Update speaker name and label
        const displayName = speaker === 'npc' ? (this.npc?.displayName || 'NPC') : 'You';
        this.elements.portraitLabel.textContent = displayName;
        this.elements.speakerName.textContent = displayName;
        
        console.log(`📝 Set speaker name to: ${displayName}`);
        
        // Update speaker styling
        this.elements.portraitSection.className = `person-chat-portrait-section speaker-${speaker}`;
        this.elements.speakerName.className = `person-chat-speaker-name ${speaker}-speaker`;
        
        // Update dialogue text
        this.elements.dialogueText.textContent = text;
        
        console.log(`📝 Set dialogue text, element content: "${this.elements.dialogueText.textContent}"`);
        
        // Reset portrait for new speaker
        this.updatePortraitForSpeaker(speaker);
        
        // Reset continue button state
        this.hasContinued = false;
    }
    
    /**
     * Update portrait for the current speaker
     * @param {string} speaker - 'npc' or 'player'
     */
    updatePortraitForSpeaker(speaker) {
        try {
            if (!this.portraitRenderer) {
                return;
            }
            
            // Update sprite data for current speaker
            if (speaker === 'npc' && this.npc) {
                // Use the actual NPC object to preserve all properties (including spriteTalk)
                this.portraitRenderer.npc = this.npc;
                this.portraitRenderer.setupSpriteInfo();
                this.portraitRenderer.render();
            } else if (speaker === 'player') {
                // Create player NPC object from playerData with spriteTalk
                this.portraitRenderer.npc = {
                    id: 'player',
                    displayName: this.playerData.displayName || 'Agent 0x00',
                    spriteSheet: this.playerData.spriteSheet || 'hacker',
                    spriteTalk: this.playerData.spriteTalk || 'assets/characters/hacker-talk.png',
                    spriteConfig: this.playerData.spriteConfig || {},
                    _sprite: this.playerSprite
                };
                this.portraitRenderer.setupSpriteInfo();
                this.portraitRenderer.render();
            }
        } catch (error) {
            console.error('❌ Error updating portrait:', error);
        }
    }
    
    /**
     * Display choice buttons
     * @param {Array} choices - Array of choice objects {text, index}
     */
    showChoices(choices) {
        if (!this.elements.choicesContainer) {
            return;
        }
        
        // Clear existing choices
        this.elements.choicesContainer.innerHTML = '';
        
        if (!choices || choices.length === 0) {
            this.elements.choicesContainer.style.display = 'none';
            return;
        }
        
        // Show choices container
        this.elements.choicesContainer.style.display = 'flex';
        
        // Create button for each choice
        choices.forEach((choice, idx) => {
            const choiceButton = document.createElement('button');
            choiceButton.className = 'person-chat-choice-button';
            choiceButton.dataset.index = idx;
            choiceButton.textContent = choice.text;
            
            this.elements.choicesContainer.appendChild(choiceButton);
        });
        
        console.log(`✅ Displayed ${choices.length} choices`);
    }
    
    /**
     * Hide choices
     */
    hideChoices() {
        if (this.elements.choicesContainer) {
            this.elements.choicesContainer.innerHTML = '';
            this.elements.choicesContainer.style.display = 'none';
        }
    }
    
    /**
     * Get choice button elements for event binding
     * @returns {Array} Array of choice button elements
     */
    getChoiceButtons() {
        return Array.from(this.elements.choicesContainer?.querySelectorAll('.person-chat-choice-button') || []);
    }
    
    /**
     * Clear dialogue and reset UI
     */
    reset() {
        this.currentSpeaker = null;
        this.hasContinued = false;
        
        if (this.elements.dialogueText) {
            this.elements.dialogueText.textContent = '';
        }
        if (this.elements.choicesContainer) {
            this.elements.choicesContainer.innerHTML = '';
            this.elements.choicesContainer.style.display = 'none';
        }
    }
    
    /**
     * Show a notification message with auto-fade
     * @param {string} message - Message to display
     * @param {string} type - Type of notification: 'info', 'success', 'warning', 'error'
     * @param {number} duration - Duration to show message (ms)
     */
    showNotification(message, type = 'info', duration = 2000) {
        const notification = document.createElement('div');
        notification.className = `person-chat-notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            padding: 20px 40px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            border: 2px solid #2980b9;
            border-radius: 4px;
            z-index: 10000;
            font-family: 'VT323', monospace;
            font-size: 18px;
            text-align: center;
            max-width: 80%;
            word-wrap: break-word;
        `;
        
        // Add type-specific styling
        if (type === 'success') {
            notification.style.borderColor = '#27ae60';
            notification.style.color = '#27ae60';
        } else if (type === 'warning') {
            notification.style.borderColor = '#f39c12';
            notification.style.color = '#f39c12';
        } else if (type === 'error') {
            notification.style.borderColor = '#e74c3c';
            notification.style.color = '#e74c3c';
        }
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.transition = 'opacity 0.3s ease-out';
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, duration);
    }
}

