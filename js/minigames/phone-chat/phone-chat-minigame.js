import { MinigameScene } from '../framework/base-minigame.js';

/**
 * Phone Chat Minigame - NPC conversations via phone using Ink
 * Displays chat interface with messages and choices driven by Ink stories
 */
export class PhoneChatMinigame extends MinigameScene {
    constructor(container, params) {
        super(container, params);
        
        // Extract params
        this.npcId = params.npcId || 'unknown';
        this.npcName = params.npcName || 'Contact';
        this.avatar = params.avatar || null;
        this.inkStoryPath = params.inkStoryPath || null;
        this.startKnot = params.startKnot || null;
        
        // Chat state
        this.messages = []; // Array of { sender: 'npc'|'player', text: string }
        this.choices = [];
        this.inkEngine = null;
        this.waitingForChoice = false;
    }

    async start() {
        super.start();
        
        // Initialize Ink engine
        if (!window.InkEngine) {
            this.showError('Ink engine not available');
            return;
        }
        
        this.inkEngine = new window.InkEngine(this.npcId);
        
        // Load story
        if (this.inkStoryPath) {
            try {
                const response = await fetch(this.inkStoryPath);
                const storyJson = await response.json();
                this.inkEngine.loadStory(storyJson);
                
                // Go to starting knot if specified
                if (this.startKnot) {
                    this.inkEngine.goToKnot(this.startKnot);
                }
                
                // Display initial content
                this.continueStory();
            } catch (error) {
                this.showError(`Failed to load story: ${error.message}`);
                return;
            }
        }
        
        this.render();
    }

    continueStory() {
        if (!this.inkEngine || !this.inkEngine.story) return;
        
        // Continue until we hit choices or end
        let text = '';
        while (this.inkEngine.story.canContinue) {
            text += this.inkEngine.continue();
        }
        
        // Add NPC message if there's text
        if (text.trim()) {
            this.addMessage('npc', text.trim());
        }
        
        // Get current choices
        this.choices = this.inkEngine.currentChoices;
        this.waitingForChoice = this.choices.length > 0;
        
        // If no choices and story can't continue, conversation is over
        if (!this.waitingForChoice && !this.inkEngine.story.canContinue) {
            this.addMessage('system', 'Conversation ended.');
            setTimeout(() => this.complete({ completed: true }), 2000);
        }
        
        this.render();
    }

    addMessage(sender, text) {
        this.messages.push({ sender, text, timestamp: Date.now() });
    }

    makeChoice(choiceIndex) {
        if (!this.inkEngine || !this.waitingForChoice) return;
        
        // Add player's choice as a message
        const choice = this.choices[choiceIndex];
        if (choice) {
            this.addMessage('player', choice.text);
            this.inkEngine.choose(choiceIndex);
            this.waitingForChoice = false;
            this.continueStory();
        }
    }

    showError(message) {
        this.addMessage('system', `Error: ${message}`);
        this.render();
    }

    render() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="phone-chat-container">
                <div class="phone-chat-header">
                    <button class="phone-back-btn" data-action="close">←</button>
                    <div class="phone-contact-info">
                        ${this.avatar ? `<img src="${this.avatar}" alt="${this.npcName}" class="contact-avatar">` : ''}
                        <span class="contact-name">${this.npcName}</span>
                    </div>
                </div>
                
                <div class="phone-chat-messages" id="phone-chat-messages">
                    ${this.renderMessages()}
                </div>
                
                <div class="phone-chat-choices" id="phone-chat-choices">
                    ${this.renderChoices()}
                </div>
            </div>
        `;
        
        this.attachEventListeners();
        this.scrollToBottom();
    }

    renderMessages() {
        return this.messages.map(msg => {
            const senderClass = msg.sender === 'player' ? 'message-player' : 
                               msg.sender === 'npc' ? 'message-npc' : 
                               'message-system';
            return `
                <div class="chat-message ${senderClass}">
                    <div class="message-bubble">${this.escapeHtml(msg.text)}</div>
                </div>
            `;
        }).join('');
    }

    renderChoices() {
        if (!this.waitingForChoice || this.choices.length === 0) {
            return '';
        }
        
        return `
            <div class="choices-container">
                ${this.choices.map((choice, idx) => `
                    <button class="choice-btn" data-choice="${idx}">
                        ${this.escapeHtml(choice.text)}
                    </button>
                `).join('')}
            </div>
        `;
    }

    attachEventListeners() {
        // Close button
        const closeBtn = this.container.querySelector('[data-action="close"]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.complete({ cancelled: true }));
        }
        
        // Choice buttons
        const choiceBtns = this.container.querySelectorAll('[data-choice]');
        choiceBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const choiceIndex = parseInt(e.target.dataset.choice);
                this.makeChoice(choiceIndex);
            });
        });
    }

    scrollToBottom() {
        const messagesEl = this.container.querySelector('#phone-chat-messages');
        if (messagesEl) {
            setTimeout(() => {
                messagesEl.scrollTop = messagesEl.scrollHeight;
            }, 100);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    cleanup() {
        // Stop any ongoing processes
        this.inkEngine = null;
        super.cleanup();
    }
}
