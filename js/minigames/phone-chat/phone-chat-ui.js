/**
 * PhoneChatUI - UI Rendering and Management
 * 
 * Manages the phone chat UI, rendering contact lists, conversation views,
 * message bubbles, and choice buttons. Based on phone-messages minigame visual style.
 * 
 * @module phone-chat-ui
 */

export default class PhoneChatUI {
    /**
     * Create a PhoneChatUI instance
     * @param {HTMLElement} container - Container element for the UI
     * @param {Object} params - Configuration parameters
     * @param {Object} npcManager - NPCManager instance
     */
    constructor(container, params, npcManager) {
        if (!container) {
            throw new Error('PhoneChatUI requires a container element');
        }
        
        this.container = container;
        this.params = params || {};
        this.npcManager = npcManager;
        this.currentView = 'contact-list'; // 'contact-list' or 'conversation'
        this.currentNPCId = null;
        this.elements = {};
        
        console.log('📱 PhoneChatUI initialized');
    }
    
    /**
     * Render the complete phone UI structure
     * Matches phone-messages-minigame.js structure
     */
    render() {
        this.container.innerHTML = `
            <div class="phone-messages-container">
                <div class="phone-screen">
                    <div class="phone-header">
                        <div class="signal-bars">
                            <span class="bar"></span>
                            <span class="bar"></span>
                            <span class="bar"></span>
                            <span class="bar"></span>
                        </div>
                        <div class="battery">85%</div>
                    </div>
                    
                    <!-- Contact List View -->
                    <div class="contact-list-view" id="contact-list-view">
                        <div class="contact-list-header">
                            <h3>Messages</h3>
                        </div>
                        <div class="contact-list" id="contact-list">
                            <!-- Contacts will be populated here -->
                        </div>
                    </div>
                    
                    <!-- Conversation View -->
                    <div class="conversation-view" id="conversation-view" style="display: none;">
                        <div class="conversation-header" id="conversation-header">
                            <button class="back-button" id="back-button">←</button>
                            <div class="conversation-info">
                                <span class="npc-name" id="npc-name"></span>
                            </div>
                        </div>
                        <div class="messages-container" id="messages-container">
                            <!-- Message bubbles will be added here -->
                        </div>
                        <div class="typing-indicator" id="typing-indicator" style="display: none;">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                        <div class="choices-container" id="choices-container">
                            <!-- Choice buttons will be added here -->
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Store element references
        this.elements = {
            contactListView: document.getElementById('contact-list-view'),
            contactList: document.getElementById('contact-list'),
            conversationView: document.getElementById('conversation-view'),
            conversationHeader: document.getElementById('conversation-header'),
            npcName: document.getElementById('npc-name'),
            backButton: document.getElementById('back-button'),
            messagesContainer: document.getElementById('messages-container'),
            typingIndicator: document.getElementById('typing-indicator'),
            choicesContainer: document.getElementById('choices-container')
        };
        
        console.log('✅ Phone UI rendered');
    }
    
    /**
     * Show the contact list view
     * @param {string} phoneId - Optional phone ID to filter contacts
     */
    showContactList(phoneId = null) {
        this.currentView = 'contact-list';
        this.currentNPCId = null;
        
        // Hide conversation, show contact list
        this.elements.conversationView.style.display = 'none';
        this.elements.contactListView.style.display = 'flex';
        
        // Populate contacts
        this.populateContactList(phoneId);
        
        console.log('📋 Showing contact list');
    }
    
    /**
     * Populate the contact list with NPCs
     * @param {string} phoneId - Optional phone ID to filter contacts
     */
    populateContactList(phoneId = null) {
        const contactList = this.elements.contactList;
        contactList.innerHTML = '';
        
        // Get NPCs for this phone
        let npcs;
        if (phoneId) {
            npcs = this.npcManager.getNPCsByPhone(phoneId);
        } else {
            // Get all NPCs (convert Map to array)
            npcs = Array.from(this.npcManager.npcs.values());
        }
        
        if (!npcs || npcs.length === 0) {
            contactList.innerHTML = `
                <div class="no-contacts">
                    <p>No contacts available</p>
                </div>
            `;
            return;
        }
        
        // Create contact items
        npcs.forEach(npc => {
            const contactItem = this.createContactItem(npc);
            contactList.appendChild(contactItem);
        });
        
        console.log(`📋 Populated ${npcs.length} contacts`);
    }
    
    /**
     * Create a contact list item
     * @param {Object} npc - NPC data
     * @returns {HTMLElement} Contact item element
     */
    createContactItem(npc) {
        const history = this.npcManager.getConversationHistory(npc.id);
        const lastMessage = history.length > 0 ? history[history.length - 1] : null;
        const unreadCount = history.filter(msg => !msg.read && msg.type === 'npc').length;
        
        const contactItem = document.createElement('div');
        contactItem.className = 'contact-item';
        contactItem.dataset.npcId = npc.id;
        
        // Format last message preview
        let lastMessagePreview = 'No messages yet';
        let lastMessageTime = '';
        
        if (lastMessage) {
            const maxLength = 40;
            lastMessagePreview = lastMessage.text.length > maxLength
                ? lastMessage.text.substring(0, maxLength) + '...'
                : lastMessage.text;
            lastMessageTime = this.formatTimestamp(lastMessage.timestamp);
        }
        
        contactItem.innerHTML = `
            <div class="contact-avatar">
                ${npc.avatar ? `<img src="${npc.avatar}" alt="${npc.displayName}">` : '👤'}
            </div>
            <div class="contact-info">
                <div class="contact-name">${npc.displayName || npc.id}</div>
                <div class="contact-last-message">${lastMessagePreview}</div>
            </div>
            <div class="contact-meta">
                ${unreadCount > 0 ? `<div class="unread-badge">${unreadCount}</div>` : ''}
                <div class="contact-time">${lastMessageTime}</div>
            </div>
        `;
        
        return contactItem;
    }
    
    /**
     * Show conversation view with specific NPC
     * @param {string} npcId - NPC identifier
     */
    showConversation(npcId) {
        if (!npcId) {
            console.error('❌ No NPC ID provided');
            return;
        }
        
        const npc = this.npcManager.getNPC(npcId);
        if (!npc) {
            console.error(`❌ NPC not found: ${npcId}`);
            return;
        }
        
        this.currentView = 'conversation';
        this.currentNPCId = npcId;
        
        // Hide contact list, show conversation
        this.elements.contactListView.style.display = 'none';
        this.elements.conversationView.style.display = 'flex';
        
        // Update header with avatar
        this.updateHeader(npc.displayName || npc.id, npc.id);
        
        // Clear messages and choices
        this.elements.messagesContainer.innerHTML = '';
        this.elements.choicesContainer.innerHTML = '';
        
        console.log(`💬 Showing conversation with ${npc.displayName || npcId}`);
    }
    
    /**
     * Update the conversation header
     * @param {string} npcName - NPC display name
     * @param {string} npcId - NPC identifier
     */
    updateHeader(npcName, npcId) {
        const npc = this.npcManager.getNPC(npcId);
        
        // Clear and rebuild header content
        const conversationInfo = this.elements.conversationHeader.querySelector('.conversation-info');
        if (conversationInfo) {
            conversationInfo.innerHTML = '';
            
            // Add avatar if available
            if (npc?.avatar) {
                const avatarImg = document.createElement('img');
                avatarImg.src = npc.avatar;
                avatarImg.alt = npcName;
                avatarImg.className = 'conversation-avatar';
                conversationInfo.appendChild(avatarImg);
            } else {
                // Placeholder avatar
                const avatarPlaceholder = document.createElement('div');
                avatarPlaceholder.className = 'conversation-avatar-placeholder';
                avatarPlaceholder.textContent = '👤';
                conversationInfo.appendChild(avatarPlaceholder);
            }
            
            // Add name
            const nameSpan = document.createElement('span');
            nameSpan.className = 'npc-name';
            nameSpan.textContent = npcName;
            conversationInfo.appendChild(nameSpan);
            
            // Update reference
            this.elements.npcName = nameSpan;
        } else {
            // Fallback to old method
            this.elements.npcName.textContent = npcName;
        }
    }
    
    /**
     * Add a message bubble to the conversation
     * @param {string} type - Message type ('npc' or 'player')
     * @param {string} text - Message text
     * @param {boolean} scrollToBottom - Whether to auto-scroll
     */
    addMessage(type, text, scrollToBottom = true) {
        if (!text || text.trim() === '') {
            return;
        }
        
        const messageBubble = document.createElement('div');
        messageBubble.className = `message-bubble ${type}`;
        
        // Check if this is a voice message
        const trimmedText = text.trim();
        const isVoiceMessage = trimmedText.toLowerCase().startsWith('voice:');
        
        if (isVoiceMessage) {
            // Extract transcript (remove "voice:" prefix)
            const transcript = trimmedText.substring(6).trim();
            
            // Create voice message display
            const voiceDisplay = document.createElement('div');
            voiceDisplay.className = 'voice-message-display';
            
            // Audio controls
            const audioControls = document.createElement('div');
            audioControls.className = 'audio-controls';
            
            const playButton = document.createElement('div');
            playButton.className = 'play-button';
            const playIcon = document.createElement('img');
            playIcon.src = 'assets/icons/play.png';
            playIcon.alt = 'Audio';
            playIcon.className = 'icon';
            playButton.appendChild(playIcon);
            
            const audioSprite = document.createElement('img');
            audioSprite.src = 'assets/mini-games/audio.png';
            audioSprite.alt = 'Audio';
            audioSprite.className = 'audio-sprite';
            
            audioControls.appendChild(playButton);
            audioControls.appendChild(audioSprite);
            
            // Transcript
            const transcriptDiv = document.createElement('div');
            transcriptDiv.className = 'transcript';
            transcriptDiv.innerHTML = `<strong>Transcript:</strong><br>${transcript}`;
            
            voiceDisplay.appendChild(audioControls);
            voiceDisplay.appendChild(transcriptDiv);
            messageBubble.appendChild(voiceDisplay);
            
            console.log(`🎤 Added voice message: ${transcript.substring(0, 30)}...`);
        } else {
            // Regular text message
            const messageText = document.createElement('div');
            messageText.className = 'message-text';
            messageText.textContent = trimmedText;
            
            messageBubble.appendChild(messageText);
            
            console.log(`💬 Added ${type} message: ${trimmedText.substring(0, 30)}...`);
        }
        
        // Add timestamp
        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = this.getCurrentTime();
        messageBubble.appendChild(messageTime);
        
        this.elements.messagesContainer.appendChild(messageBubble);
        
        if (scrollToBottom) {
            this.scrollToBottom();
        }
    }
    
    /**
     * Add multiple messages at once (for loading history)
     * @param {Array} messages - Array of message objects
     */
    addMessages(messages) {
        if (!messages || messages.length === 0) {
            return;
        }
        
        messages.forEach(msg => {
            this.addMessage(msg.type, msg.text, false);
        });
        
        this.scrollToBottom();
        console.log(`💬 Added ${messages.length} messages from history`);
    }
    
    /**
     * Clear all messages from the conversation
     */
    clearMessages() {
        this.elements.messagesContainer.innerHTML = '';
        console.log('🗑️ Cleared all messages');
    }
    
    /**
     * Add choice buttons to the conversation
     * @param {Array} choices - Array of choice objects from Ink
     */
    addChoices(choices) {
        if (!choices || choices.length === 0) {
            this.elements.choicesContainer.innerHTML = '';
            return;
        }
        
        this.elements.choicesContainer.innerHTML = '';
        
        choices.forEach((choice, index) => {
            const choiceButton = document.createElement('button');
            choiceButton.className = 'choice-button';
            choiceButton.dataset.index = index;
            choiceButton.textContent = choice.text;
            
            this.elements.choicesContainer.appendChild(choiceButton);
        });
        
        this.scrollToBottom();
        console.log(`🔘 Added ${choices.length} choices`);
    }
    
    /**
     * Clear all choice buttons
     */
    clearChoices() {
        this.elements.choicesContainer.innerHTML = '';
    }
    
    /**
     * Show typing indicator (NPC is "typing")
     */
    showTypingIndicator() {
        this.elements.typingIndicator.style.display = 'flex';
        this.scrollToBottom();
    }
    
    /**
     * Hide typing indicator
     */
    hideTypingIndicator() {
        this.elements.typingIndicator.style.display = 'none';
    }
    
    /**
     * Scroll messages container to bottom
     * @param {boolean} smooth - Whether to use smooth scrolling
     */
    scrollToBottom(smooth = true) {
        const container = this.elements.messagesContainer;
        if (container) {
            container.scrollTo({
                top: container.scrollHeight,
                behavior: smooth ? 'smooth' : 'auto'
            });
        }
    }
    
    /**
     * Get current time as formatted string
     * @returns {string} Time in HH:MM format
     */
    getCurrentTime() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const displayHours = hours % 12 || 12;
        const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
        return `${displayHours}:${displayMinutes}`;
    }
    
    /**
     * Format timestamp into human-readable string
     * @param {number} timestamp - Unix timestamp in milliseconds
     * @returns {string} Formatted time string
     */
    formatTimestamp(timestamp) {
        if (!timestamp) return '';
        
        const now = Date.now();
        const diff = now - timestamp;
        
        // Less than 1 minute
        if (diff < 60000) {
            return 'Just now';
        }
        
        // Less than 1 hour
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes}m`;
        }
        
        // Less than 24 hours
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours}h`;
        }
        
        // More than 24 hours - show time
        const date = new Date(timestamp);
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const displayHours = hours % 12 || 12;
        const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
        
        return `${displayHours}:${displayMinutes}`;
    }
    
    /**
     * Show a temporary message/notification
     * @param {string} message - Message to display
     * @param {string} type - Type ('info', 'success', 'error')
     * @param {number} duration - Duration in milliseconds
     */
    showNotification(message, type = 'info', duration = 2000) {
        const notification = document.createElement('div');
        notification.className = `phone-notification ${type}`;
        notification.textContent = message;
        
        this.container.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, duration);
    }
    
    /**
     * Get the current view
     * @returns {string} Current view ('contact-list' or 'conversation')
     */
    getCurrentView() {
        return this.currentView;
    }
    
    /**
     * Get the current NPC ID
     * @returns {string|null} Current NPC ID or null
     */
    getCurrentNPCId() {
        return this.currentNPCId;
    }
    
    /**
     * Cleanup and remove UI
     */
    cleanup() {
        this.container.innerHTML = '';
        this.elements = {};
        this.currentView = 'contact-list';
        this.currentNPCId = null;
        console.log('🧹 Phone UI cleaned up');
    }
}
