/**
 * PersonChatUI - UI Component for Person-Chat Minigame
 * 
 * Handles rendering of conversation interface with:
 * - Zoomed portrait displays (NPC left, player right)
 * - Dialogue text box
 * - Choice buttons
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
        
        // UI elements
        this.elements = {
            root: null,
            portraitsContainer: null,
            npcPortraitContainer: null,
            playerPortraitContainer: null,
            dialogueBox: null,
            dialogueText: null,
            choicesContainer: null,
            speakerName: null
        };
        
        // Portrait renderers
        this.npcPortrait = null;
        this.playerPortrait = null;
        
        // State
        this.currentSpeaker = null; // 'npc' or 'player'
        
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
            
            // Create portraits and dialogue sections (integrated)
            this.createConversationLayout();
            
            // Create choices section (right side)
            this.createChoicesSection();
            
            // Add to container
            this.container.appendChild(this.elements.root);
            
            // Initialize portrait renderers
            this.initializePortraits();
            
            console.log('✅ PersonChatUI rendered');
        } catch (error) {
            console.error('❌ Error rendering UI:', error);
        }
    }
    
    /**
     * Create conversation layout with portraits and dialogue areas
     */
    createConversationLayout() {
        const portraitsContainer = document.createElement('div');
        portraitsContainer.className = 'person-chat-portraits-container';
        
        // NPC section (left) - portrait + dialogue
        const npcSection = this.createCharacterSection('npc', this.npc?.displayName || 'NPC');
        this.elements.npcPortraitSection = npcSection.section;
        this.elements.npcPortraitContainer = npcSection.portraitContainer;
        this.elements.npcDialogueSection = npcSection.dialogueSection;
        
        // Player section (right) - portrait + dialogue
        const playerSection = this.createCharacterSection('player', 'You');
        this.elements.playerPortraitSection = playerSection.section;
        this.elements.playerPortraitContainer = playerSection.portraitContainer;
        this.elements.playerDialogueSection = playerSection.dialogueSection;
        
        // Add both sections
        portraitsContainer.appendChild(npcSection.section);
        portraitsContainer.appendChild(playerSection.section);
        
        this.elements.root.appendChild(portraitsContainer);
        this.elements.portraitsContainer = portraitsContainer;
    }
    
    /**
     * Create a character section (portrait + dialogue)
     * @param {string} type - 'npc' or 'player'
     * @param {string} displayName - Character's display name
     * @returns {Object} Elements created
     */
    createCharacterSection(type, displayName) {
        const section = document.createElement('div');
        section.className = `person-chat-portrait-section ${type}-portrait-section`;
        
        // Label
        const label = document.createElement('div');
        label.className = `person-chat-portrait-label ${type}-label`;
        label.textContent = displayName;
        
        // Portrait container
        const portraitContainer = document.createElement('div');
        portraitContainer.className = 'person-chat-portrait-canvas-container';
        portraitContainer.id = `${type}-portrait-container`;
        
        // Dialogue section (below portrait)
        const dialogueSection = document.createElement('div');
        dialogueSection.className = 'person-chat-dialogue-section';
        dialogueSection.style.display = 'none'; // Hidden by default
        
        const speakerName = document.createElement('div');
        speakerName.className = 'person-chat-speaker-name';
        speakerName.textContent = displayName;
        
        const dialogueBox = document.createElement('div');
        dialogueBox.className = 'person-chat-dialogue-box';
        
        const dialogueText = document.createElement('p');
        dialogueText.className = 'person-chat-dialogue-text';
        dialogueText.id = `${type}-dialogue-text`;
        
        dialogueBox.appendChild(dialogueText);
        dialogueSection.appendChild(speakerName);
        dialogueSection.appendChild(dialogueBox);
        
        // Assemble section
        section.appendChild(label);
        section.appendChild(portraitContainer);
        section.appendChild(dialogueSection);
        
        return {
            section,
            portraitContainer,
            dialogueSection,
            dialogueText
        };
    }
    
    /**
     * Create choices section (right side)
     */
    createChoicesSection() {
        const choicesContainer = document.createElement('div');
        choicesContainer.className = 'person-chat-choices-container';
        choicesContainer.id = 'choices-container';
        choicesContainer.style.display = 'none'; // Hidden until choices available
        
        this.elements.root.appendChild(choicesContainer);
        this.elements.choicesContainer = choicesContainer;
    }
    
    /**
     * Initialize portrait renderers
     */
    initializePortraits() {
        try {
            if (!this.game || !this.npc) {
                console.warn('⚠️ Missing game or NPC, skipping portrait initialization');
                return;
            }
            
            // Initialize NPC portrait
            if (this.npc._sprite) {
                this.npcPortrait = new PersonChatPortraits(
                    this.game,
                    this.npc,
                    this.elements.npcPortraitContainer
                );
                this.npcPortrait.init();
            } else {
                console.warn(`⚠️ NPC ${this.npc.id} has no sprite reference`);
            }
            
            // Initialize player portrait (if player sprite exists)
            if (this.playerSprite) {
                // Create a pseudo-NPC object for player portrait
                const playerNPC = {
                    id: 'player',
                    displayName: 'You',
                    _sprite: this.playerSprite
                };
                
                this.playerPortrait = new PersonChatPortraits(
                    this.game,
                    playerNPC,
                    this.elements.playerPortraitContainer
                );
                this.playerPortrait.init();
            }
            
            console.log('✅ Portraits initialized');
        } catch (error) {
            console.error('❌ Error initializing portraits:', error);
        }
    }
    
    /**
     * Display dialogue text
     * @param {string} text - Dialogue text
     * @param {string} speaker - Speaker name ('npc' or 'player')
     */
    showDialogue(text, speaker = 'npc') {
        this.currentSpeaker = speaker;
        
        // Hide both dialogue sections first
        if (this.elements.npcDialogueSection) {
            this.elements.npcDialogueSection.style.display = 'none';
        }
        if (this.elements.playerDialogueSection) {
            this.elements.playerDialogueSection.style.display = 'none';
        }
        
        // Remove active speaker class from both
        if (this.elements.npcPortraitSection) {
            this.elements.npcPortraitSection.classList.remove('active-speaker');
        }
        if (this.elements.playerPortraitSection) {
            this.elements.playerPortraitSection.classList.remove('active-speaker');
        }
        
        // Show dialogue in the correct section
        if (speaker === 'npc' && this.elements.npcDialogueSection) {
            const dialogueText = this.elements.npcDialogueSection.querySelector('.person-chat-dialogue-text');
            if (dialogueText) {
                dialogueText.textContent = text;
            }
            this.elements.npcDialogueSection.style.display = 'flex';
            this.elements.npcPortraitSection.classList.add('active-speaker');
        } else if (speaker === 'player' && this.elements.playerDialogueSection) {
            const dialogueText = this.elements.playerDialogueSection.querySelector('.person-chat-dialogue-text');
            if (dialogueText) {
                dialogueText.textContent = text;
            }
            this.elements.playerDialogueSection.style.display = 'flex';
            this.elements.playerPortraitSection.classList.add('active-speaker');
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
        }
    }
    
    /**
     * Clear dialogue
     */
    clearDialogue() {
        if (this.elements.dialogueText) {
            this.elements.dialogueText.textContent = '';
        }
        if (this.elements.speakerName) {
            this.elements.speakerName.textContent = '';
        }
    }
    
    /**
     * Cleanup UI and resources
     */
    destroy() {
        try {
            // Stop portrait updates
            if (this.npcPortrait) {
                this.npcPortrait.destroy();
            }
            if (this.playerPortrait) {
                this.playerPortrait.destroy();
            }
            
            // Clear container
            if (this.container) {
                this.container.innerHTML = '';
            }
            
            console.log('✅ PersonChatUI destroyed');
        } catch (error) {
            console.error('❌ Error destroying UI:', error);
        }
    }
}
