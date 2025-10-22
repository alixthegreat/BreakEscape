import { MinigameScene } from '../framework/base-minigame.js';

export class PhoneMessagesMinigame extends MinigameScene {
    constructor(container, params) {
        super(container, params);
        
        // Ensure params is an object with default values
        const safeParams = params || {};
        
        // Initialize phone-specific state
        this.phoneData = {
            messages: safeParams.messages || [],
            currentMessageIndex: 0,
            isPlaying: false,
            speechSynthesis: window.speechSynthesis,
            currentUtterance: null
        };
        
        // Set up speech synthesis
        this.setupSpeechSynthesis();
    }
    
    setupSpeechSynthesis() {
        // Check if speech synthesis is available
        if (!this.phoneData.speechSynthesis) {
            console.warn('Speech synthesis not available');
            this.speechAvailable = false;
            return;
        }
        
        // Check if speech synthesis is actually working on this platform
        this.speechAvailable = true;
        this.voiceSettings = {
            rate: 0.9,
            pitch: 1.0,
            volume: 0.8
        };
        
        // Set up voice selection
        this.setupVoiceSelection();
        
        // Test speech synthesis availability
        try {
            const testUtterance = new SpeechSynthesisUtterance('');
            testUtterance.volume = 0;
            testUtterance.onerror = (event) => {
                console.warn('Speech synthesis test failed:', event.error);
                this.speechAvailable = false;
            };
            this.phoneData.speechSynthesis.speak(testUtterance);
        } catch (error) {
            console.warn('Speech synthesis not supported:', error);
            this.speechAvailable = false;
        }
    }
    
    setupVoiceSelection() {
        // Wait for voices to load - Chromium often needs this
        const voices = this.phoneData.speechSynthesis.getVoices();
        console.log('Initial voices count:', voices.length);
        
        if (voices.length === 0) {
            console.log('No voices loaded yet, waiting for voiceschanged event...');
            this.phoneData.speechSynthesis.addEventListener('voiceschanged', () => {
                console.log('Voices changed event fired, voices count:', this.phoneData.speechSynthesis.getVoices().length);
                this.selectBestVoice();
            });
            
            // Fallback: try again after a delay (Chromium sometimes needs this)
            setTimeout(() => {
                const delayedVoices = this.phoneData.speechSynthesis.getVoices();
                console.log('Delayed voices count:', delayedVoices.length);
                if (delayedVoices.length > 0) {
                    this.selectBestVoice();
                }
            }, 1000);
        } else {
            this.selectBestVoice();
        }
    }
    
    selectBestVoice() {
        const voices = this.phoneData.speechSynthesis.getVoices();
        console.log('Available voices:', voices.map(v => ({ name: v.name, lang: v.lang, default: v.default })));
        
        // Prefer modern, natural-sounding voices (updated for your system)
        const preferredVoices = [
            // High-quality neural voices (best quality)
            'Microsoft Zira Desktop',
            'Microsoft David Desktop',
            'Microsoft Hazel Desktop',
            'Microsoft Susan Desktop',
            'Microsoft Mark Desktop',
            'Microsoft Catherine Desktop',
            'Microsoft Linda Desktop',
            'Microsoft Richard Desktop',
            
            // Google Cloud voices (very high quality)
            'Google UK English Female',
            'Google UK English Male',
            'Google US English Female',
            'Google US English Male',
            'Google Australian English Female',
            'Google Australian English Male',
            'Google Canadian English Female',
            'Google Canadian English Male',
            
            // macOS voices (high quality)
            'Alex',
            'Samantha',
            'Victoria',
            'Daniel',
            'Moira',
            'Tessa',
            'Karen',
            'Lee',
            'Rishi',
            'Veena',
            'Fiona',
            'Susan',
            'Tom',
            'Allison',
            'Ava',
            'Fred',
            'Junior',
            'Kathy',
            'Princess',
            'Ralph',
            'Vicki',
            'Whisper',
            'Zarvox',
            
            // Amazon Polly voices (if available)
            'Joanna',
            'Matthew',
            'Amy',
            'Brian',
            'Emma',
            'Joey',
            'Justin',
            'Kendra',
            'Kimberly',
            'Salli',
            
            // IBM Watson voices (if available)
            'en-US_AllisonVoice',
            'en-US_MichaelVoice',
            'en-US_EmilyVoice',
            'en-US_HenryVoice',
            'en-US_KevinVoice',
            'en-US_LisaVoice',
            'en-US_OliviaVoice',
            
            // Avoid robotic voices - these are typically lower quality
            'Andy',
            'klatt',
            'Robosoft',
            'male1',
            'male2',
            'male3',
            'female1',
            'female2',
            'female3'
        ];
        
        // Find the best available voice
        let selectedVoice = null;
        
        // Get all English voices
        const englishVoices = voices.filter(voice => 
            voice.lang.startsWith('en') || voice.lang === 'en-US' || voice.lang === 'en-GB'
        );
        
        console.log('English voices found:', englishVoices.length);
        
        // First, try to find a preferred high-quality voice
        for (const preferredName of preferredVoices) {
            selectedVoice = englishVoices.find(voice => voice.name === preferredName);
            if (selectedVoice) {
                console.log('Found preferred voice:', selectedVoice.name);
                break;
            }
        }
        
        // If no preferred voice found, look for high-quality indicators in voice names
        if (!selectedVoice) {
            const qualityIndicators = [
                'neural', 'cloud', 'desktop', 'premium', 'enhanced', 'natural',
                'Microsoft', 'Google', 'Amazon', 'IBM', 'Watson', 'Polly'
            ];
            
            // Look for voices with quality indicators
            for (const indicator of qualityIndicators) {
                selectedVoice = englishVoices.find(voice => 
                    voice.name.toLowerCase().includes(indicator.toLowerCase())
                );
                if (selectedVoice) {
                    console.log('Found quality voice by indicator:', selectedVoice.name, 'indicator:', indicator);
                    break;
                }
            }
        }
        
        // If still no good voice, avoid obviously robotic voices
        if (!selectedVoice) {
            const avoidPatterns = [
                'andy', 'klatt', 'robosoft', 'male1', 'male2', 'male3', 'female1', 'female2', 'female3',
                'ricishaymax', 'ricishay', 'max', 'min', 'robot', 'synthetic', 'tts', 'speech',
                'voice', 'synthesizer', 'engine', 'system', 'default', 'basic', 'simple',
                'generic', 'standard', 'built-in', 'builtin', 'internal', 'system'
            ];
            
            selectedVoice = englishVoices.find(voice => {
                const name = voice.name.toLowerCase();
                return !avoidPatterns.some(pattern => name.includes(pattern));
            });
            
            if (selectedVoice) {
                console.log('Found non-robotic voice:', selectedVoice.name);
            }
        }
        
        // Last resort: use default or first available
        if (!selectedVoice) {
            selectedVoice = englishVoices.find(voice => voice.default) ||
                           englishVoices[0] ||
                           voices.find(voice => voice.default) ||
                           voices[0];
            console.log('Using fallback voice:', selectedVoice?.name);
        }
        
        if (selectedVoice) {
            this.selectedVoice = selectedVoice;
            console.log('Selected voice:', selectedVoice.name, selectedVoice.lang);
        } else {
            console.warn('No suitable voice found');
        }
        
        // Populate voice selector
        this.populateVoiceSelector(voices);
    }
    
    populateVoiceSelector(voices) {
        if (!this.voiceSelect) return;
        
        // Clear existing options except the first one
        this.voiceSelect.innerHTML = '<option value="">Auto-select best voice</option>';
        
        // Get English voices and sort them by quality
        const englishVoices = voices.filter(voice => 
            voice.lang.startsWith('en') || voice.lang === 'en-US' || voice.lang === 'en-GB'
        );
        
        // Sort voices by quality (preferred voices first, then by name)
        const sortedVoices = englishVoices.sort((a, b) => {
            const aName = a.name.toLowerCase();
            const bName = b.name.toLowerCase();
            
            // Quality indicators (higher priority)
            const qualityIndicators = ['microsoft', 'google', 'amazon', 'ibm', 'watson', 'polly', 'neural', 'cloud', 'desktop', 'premium', 'enhanced', 'natural'];
            const aHasQuality = qualityIndicators.some(indicator => aName.includes(indicator));
            const bHasQuality = qualityIndicators.some(indicator => bName.includes(indicator));
            
            if (aHasQuality && !bHasQuality) return -1;
            if (!aHasQuality && bHasQuality) return 1;
            
            // Avoid robotic voices (lower priority)
            const roboticPatterns = [
                'andy', 'klatt', 'robosoft', 'male1', 'male2', 'male3', 'female1', 'female2', 'female3',
                'ricishaymax', 'ricishay', 'max', 'min', 'robot', 'synthetic', 'tts', 'speech',
                'voice', 'synthesizer', 'engine', 'system', 'default', 'basic', 'simple',
                'generic', 'standard', 'built-in', 'builtin', 'internal', 'system'
            ];
            const aIsRobotic = roboticPatterns.some(pattern => aName.includes(pattern));
            const bIsRobotic = roboticPatterns.some(pattern => bName.includes(pattern));
            
            if (aIsRobotic && !bIsRobotic) return 1;
            if (!aIsRobotic && bIsRobotic) return -1;
            
            // Alphabetical by name
            return aName.localeCompare(bName);
        });
        
        // Add voices to selector (limit to first 20 to avoid overwhelming the dropdown)
        const voicesToShow = sortedVoices.slice(0, 20);
        
        voicesToShow.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            
            // Add quality indicator to display name
            let displayName = voice.name;
            const qualityIndicators = ['microsoft', 'google', 'amazon', 'ibm', 'watson', 'polly', 'neural', 'cloud', 'desktop', 'premium', 'enhanced', 'natural'];
            const hasQuality = qualityIndicators.some(indicator => voice.name.toLowerCase().includes(indicator));
            
            if (hasQuality) {
                displayName = `⭐ ${voice.name}`;
            }
            
            option.textContent = `${displayName} (${voice.lang})`;
            if (voice === this.selectedVoice) {
                option.selected = true;
            }
            this.voiceSelect.appendChild(option);
        });
        
        // Show voice controls if we have voices and speech is available
        if (englishVoices.length > 0 && this.speechAvailable) {
            this.voiceControls.style.display = 'flex';
            console.log('Voice controls shown with', englishVoices.length, 'English voices');
        } else {
            console.log('Voice controls hidden - English voices:', englishVoices.length, 'Speech available:', this.speechAvailable);
        }
    }
    
    init() {
        // Call parent init to set up basic UI structure
        super.init();
        
        // Customize the header
        this.headerElement.innerHTML = `
            <h3>${(this.params && this.params.title) || 'Phone Messages'}</h3>
            <p>Review messages and listen to voicemails</p>
        `;
        
        // Add notebook button to minigame controls (before cancel button)
        if (this.controlsElement) {
            const notebookBtn = document.createElement('button');
            notebookBtn.className = 'minigame-button';
            notebookBtn.id = 'minigame-notebook';
            notebookBtn.innerHTML = '<img src="assets/icons/notes-sm.png" alt="Notebook" class="icon-small"> Add to Notebook';

            this.controlsElement.appendChild(notebookBtn);
            
            // Change cancel button text to "Close"
            const cancelBtn = document.getElementById('minigame-cancel');
            if (cancelBtn) {
                cancelBtn.innerHTML = 'Close';
            }
        }
        
        // Set up the phone interface
        this.setupPhoneInterface();
        
        // Set up event listeners
        this.setupEventListeners();
    }
    
    setupPhoneInterface() {
        // Create the phone interface
        // Check if we can get the device image from sprite or params
        const getImageData = () => {
            // Try to get sprite data from params (from lockable object passed through minigame framework)
            const sprite = this.params.sprite || this.params.lockable;
            if (sprite && sprite.texture && sprite.scenarioData) {
                return {
                    imageFile: sprite.texture.key,
                    deviceName: sprite.scenarioData.name || sprite.name,
                    observations: sprite.scenarioData.observations || ''
                };
            }
            // Fallback to explicit params if provided
            if (this.params.deviceImage) {
                return {
                    imageFile: this.params.deviceImage,
                    deviceName: this.params.deviceName || this.params.title || 'Device',
                    observations: this.params.observations || ''
                };
            }
            return null;
        };
        
        const imageData = getImageData();
        
        this.gameContainer.innerHTML = `
            ${imageData ? `
                <div class="phone-image-section">
                    <img src="assets/objects/${imageData.imageFile}.png" 
                         alt="${imageData.deviceName}" 
                         class="phone-image">
                    <div class="phone-info">
                        <h4>${imageData.deviceName}</h4>
                        <p>${imageData.observations}</p>
                    </div>
                </div>
            ` : ''}
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
                    
                    <div class="messages-list" id="messages-list">
                        <!-- Messages will be populated here -->
                    </div>
                    
                    <div class="message-detail" id="message-detail" style="display: none;">
                        <div class="message-header">
                            <button class="back-btn" id="back-btn">← Back</button>
                            <div class="message-info">
                                <span class="sender" id="sender-name"></span>
                                <span class="timestamp" id="message-time"></span>
                            </div>
                        </div>
                        <div class="message-content" id="message-content"></div>
                        <div class="message-actions" id="message-actions"></div>
                    </div>
                </div>
                
                <div class="phone-controls">
                    <button class="control-btn" id="prev-btn">Previous</button>
                    <button class="control-btn" id="next-btn">Next</button>
                    <button class="control-btn" id="play-btn" style="display: none;">Play</button>
                    <button class="control-btn" id="stop-btn" style="display: none;">Stop</button>
                </div>
                
                <div class="voice-controls" id="voice-controls" style="display: none;">
                    <label for="voice-select">Voice:</label>
                    <select id="voice-select" class="voice-select">
                        <option value="">Auto-select best voice</option>
                    </select>
                    <button class="control-btn" id="refresh-voices-btn" style="font-size: 10px; padding: 5px 8px;">Refresh</button>
                </div>
                
            </div>

        `;
        
        // Get references to important elements
        this.messagesList = document.getElementById('messages-list');
        this.messageDetail = document.getElementById('message-detail');
        this.senderName = document.getElementById('sender-name');
        this.messageTime = document.getElementById('message-time');
        this.messageContent = document.getElementById('message-content');
        this.messageActions = document.getElementById('message-actions');
        
        // Control buttons
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.playBtn = document.getElementById('play-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.backBtn = document.getElementById('back-btn');
        
        // Voice controls
        this.voiceControls = document.getElementById('voice-controls');
        this.voiceSelect = document.getElementById('voice-select');
        this.refreshVoicesBtn = document.getElementById('refresh-voices-btn');
        
        // Populate messages
        this.populateMessages();

    }
    
    populateMessages() {
        if (!this.phoneData.messages || this.phoneData.messages.length === 0) {
            this.messagesList.innerHTML = `
                <div class="no-messages">
                    <p>No messages found</p>
                </div>
            `;
            return;
        }
        
        this.messagesList.innerHTML = '';
        
        this.phoneData.messages.forEach((message, index) => {
            const messageElement = document.createElement('div');
            messageElement.className = `message-item ${message.type || 'text'}`;
            messageElement.dataset.index = index;
            
            const preview = message.type === 'voice' 
                ? (message.text ? message.text.substring(0, 50) + '...' : 'Voice message')
                : (message.text || 'No text content');
            
            messageElement.innerHTML = `
                <div class="message-preview">
                    <div class="message-sender">${message.sender || 'Unknown'}</div>
                    <div class="message-text">${preview}</div>
                    <div class="message-time">${message.timestamp || 'Unknown time'}</div>
                </div>
                <div class="message-status ${message.read ? 'read' : 'unread'}"></div>
            `;
            
            this.messagesList.appendChild(messageElement);
        });
    }
    

    setupEventListeners() {
        // Message list clicks
        this.addEventListener(this.messagesList, 'click', (event) => {
            const messageItem = event.target.closest('.message-item');
            if (messageItem) {
                const index = parseInt(messageItem.dataset.index);
                this.showMessageDetail(index);
            }
        });
        
        // Control buttons
        this.addEventListener(this.prevBtn, 'click', () => {
            this.previousMessage();
        });
        
        this.addEventListener(this.nextBtn, 'click', () => {
            this.nextMessage();
        });
        
        this.addEventListener(this.playBtn, 'click', () => {
            this.playCurrentMessage();
        });
        
        this.addEventListener(this.stopBtn, 'click', () => {
            this.stopCurrentMessage();
        });
        
        this.addEventListener(this.backBtn, 'click', () => {
            this.showMessageList();
        });
        
        // Voice selector
        this.addEventListener(this.voiceSelect, 'change', (event) => {
            this.handleVoiceSelection(event.target.value);
        });
        
        // Refresh voices button
        this.addEventListener(this.refreshVoicesBtn, 'click', () => {
            this.refreshVoices();
        });
        
        // Notebook button (in minigame controls)
        const notebookBtn = document.getElementById('minigame-notebook');
        if (notebookBtn) {
            this.addEventListener(notebookBtn, 'click', () => {
                this.addToNotebook();
            });
        }
        
        // Keyboard controls
        this.addEventListener(document, 'keydown', (event) => {
            this.handleKeyPress(event);
        });
        
        // Set up drag-to-scroll for scrollable elements
        this.setupDragToScroll(this.messagesList);
        this.setupDragToScroll(this.messageDetail);
    }
    
    setupDragToScroll(scrollableElement) {
        if (!scrollableElement) return;
        
        let isPressed = false;
        let startY = 0;
        let scrollTop = 0;
        
        const onMouseDown = (e) => {
            // Don't start drag if clicking on interactive elements
            if (e.target.closest('button, a, input, select, [role="button"]')) {
                return;
            }
            
            isPressed = true;
            startY = e.pageY - scrollableElement.offsetTop;
            scrollTop = scrollableElement.scrollTop;
            scrollableElement.style.cursor = 'grabbing';
            e.preventDefault();
        };
        
        const onMouseMove = (e) => {
            if (!isPressed) return;
            
            const y = e.pageY - scrollableElement.offsetTop;
            const deltaY = startY - y;
            scrollableElement.scrollTop = scrollTop + deltaY;
        };
        
        const onMouseUp = () => {
            isPressed = false;
            scrollableElement.style.cursor = 'grab';
        };
        
        const onMouseLeave = () => {
            isPressed = false;
            scrollableElement.style.cursor = 'grab';
        };
        
        // Add hover effect to show the grab cursor
        scrollableElement.addEventListener('mouseenter', () => {
            if (!isPressed) {
                scrollableElement.style.cursor = 'grab';
            }
        });
        
        scrollableElement.addEventListener('mouseleave', onMouseLeave);
        
        this.addEventListener(scrollableElement, 'mousedown', onMouseDown);
        this.addEventListener(document, 'mousemove', onMouseMove);
        this.addEventListener(document, 'mouseup', onMouseUp);
    }
    
    handleKeyPress(event) {
        if (!this.gameState.isActive) return;
        
        switch(event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                this.previousMessage();
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.nextMessage();
                break;
            case ' ':
                event.preventDefault();
                if (this.phoneData.isPlaying) {
                    this.stopCurrentMessage();
                } else {
                    this.playCurrentMessage();
                }
                break;
            case 'Escape':
                event.preventDefault();
                this.showMessageList();
                break;
        }
    }
    
    showMessageDetail(index) {
        if (index < 0 || index >= this.phoneData.messages.length) return;
        
        this.phoneData.currentMessageIndex = index;
        const message = this.phoneData.messages[index];
        
        // Update message detail view
        this.senderName.textContent = message.sender || 'Unknown';
        this.messageTime.textContent = message.timestamp || 'Unknown time';
        
        // Format message content based on type
        if (message.type === 'voice') {
            this.messageContent.innerHTML = `
                <div class="voice-message-display">
                    <div class="audio-controls">
                        <div class="play-button"><img src="assets/icons/play.png" alt="Audio" class="icon"></div>
                        <img src="assets/mini-games/audio.png" alt="Audio" class="audio-sprite">
                    </div>
                    <div class="transcript"><strong>Transcript:</strong><br>${message.voice || message.text || 'No transcript available'}
                    </div>
                </div>
            `;
        } else {
            this.messageContent.textContent = message.text || 'No text content';
        }
        
        // Set up actions based on message type
        this.setupMessageActions(message);
        
        // Add click listener for audio controls if it's a voice message
        if (message.type === 'voice') {
            const audioControls = this.messageContent.querySelector('.audio-controls');
            if (audioControls) {
                this.addEventListener(audioControls, 'click', () => {
                    this.toggleCurrentMessage();
                });
            }
        }
        
        // Show detail view
        this.messagesList.style.display = 'none';
        this.messageDetail.style.display = 'block';
        
        // Mark as read
        message.read = true;
        this.updateMessageStatus(index);
    }
    
    setupMessageActions(message) {
        this.messageActions.innerHTML = '';
        
        // Hide all action buttons - we only use the inline audio controls now
        this.playBtn.style.display = 'none';
        this.stopBtn.style.display = 'none';
        this.prevBtn.style.display = 'none';
        this.nextBtn.style.display = 'none';
        
        // Show a note if this is a voice message but speech is not available
        if (message.type === 'voice' && message.voice && !this.speechAvailable) {
            const note = document.createElement('div');
            note.className = 'voice-note';
            note.style.cssText = 'color: #666; font-size: 10px; text-align: center; margin-top: 10px; font-family: "Courier New", monospace;';
            note.textContent = 'Voice playback not available on this system';
            this.messageActions.appendChild(note);
        }
    }
    
    handleVoiceSelection(voiceName) {
        if (!voiceName) {
            // Auto-select best voice
            this.selectBestVoice();
            return;
        }
        
        const voices = this.phoneData.speechSynthesis.getVoices();
        const selectedVoice = voices.find(voice => voice.name === voiceName);
        
        if (selectedVoice) {
            this.selectedVoice = selectedVoice;
            console.log('User selected voice:', selectedVoice.name, selectedVoice.lang);
            this.showSuccess(`Voice changed to: ${selectedVoice.name}`, false, 2000);
        }
    }
    
    refreshVoices() {
        console.log('Refreshing voices...');
        this.showSuccess("Refreshing voices...", false, 1000);
        
        // Force voice reload
        this.setupVoiceSelection();
        
        // Also try to trigger voiceschanged event
        if (this.phoneData.speechSynthesis) {
            // Create a temporary utterance to trigger voice loading
            const tempUtterance = new SpeechSynthesisUtterance('');
            tempUtterance.volume = 0;
            this.phoneData.speechSynthesis.speak(tempUtterance);
            this.phoneData.speechSynthesis.cancel();
        }
    }
    
    addToNotebook() {
        // Check if there are any messages
        if (!this.phoneData.messages || this.phoneData.messages.length === 0) {
            this.showFailure("No messages to add to notebook", false, 2000);
            return;
        }
        
        // Create comprehensive notebook content for all messages
        const notebookContent = this.formatAllMessagesForNotebook();
        const notebookTitle = `Phone Messages - ${this.params?.title || 'Phone'}`;
        const notebookObservations = this.params?.observations || `Phone messages from ${this.params?.title || 'phone'}`;
        
        // Check if notes minigame is available
        if (window.startNotesMinigame) {
            // Store the phone state globally so we can return to it
            const phoneState = {
                messages: this.phoneData.messages,
                currentMessageIndex: this.phoneData.currentMessageIndex,
                selectedVoice: this.selectedVoice,
                speechAvailable: this.speechAvailable,
                voiceSettings: this.voiceSettings,
                params: this.params
            };
            
            window.pendingPhoneReturn = phoneState;
            
            // Create a phone messages item for the notes minigame
            const phoneMessagesItem = {
                scenarioData: {
                    type: 'phone_messages',
                    name: notebookTitle,
                    text: notebookContent,
                    observations: notebookObservations,
                    important: true // Mark as important since it's from a phone
                }
            };
            
            // Start notes minigame - it will handle returning to phone via returnToPhoneAfterNotes
            window.startNotesMinigame(
                phoneMessagesItem, 
                notebookContent, 
                notebookObservations, 
                null, // Let notes minigame auto-navigate to the newly added note
                false, // Don't auto-add to inventory
                false // Don't auto-close
            );
            
            this.showSuccess("Added all messages to notebook", false, 2000);
        } else {
            this.showFailure("Notebook not available", false, 2000);
        }
    }
    
    formatAllMessagesForNotebook() {
        let content = `Phone Messages Log\n`;
        content += `Source: ${this.params?.title || 'Phone'}\n`;
        content += `Total Messages: ${this.phoneData.messages.length}\n`;
        content += `Date: ${new Date().toLocaleString()}\n\n`;
        content += `${'='.repeat(20)}\n\n`;
        
        this.phoneData.messages.forEach((message, index) => {
            content += `Message ${index + 1}:\n`;
            content += `${'-'.repeat(20)}\n`;
            content += `From: ${message.sender}\n`;
            content += `Time: ${message.timestamp}\n`;
            content += `Type: ${message.type === 'voice' ? 'Voice Message' : 'Text Message'}\n`;
            content += `Status: ${message.read ? 'Read' : 'Unread'}\n\n`;
            
            if (message.type === 'voice') {
                // For voice messages, show audio icon and transcript
                content += `[Audio Message]\n`;
                content += `Transcript: ${message.voice || message.text || 'No transcript available'}\n\n`;
            } else {
                // For text messages, show the content
                content += `${message.text || 'No text content'}\n\n`;
            }
        });
        
        content += `${'='.repeat(20)}\n`;
        content += `End of Phone Messages Log`;
        
        return content;
    }
    
    showMessageList() {
        this.messageDetail.style.display = 'none';
        this.messagesList.style.display = 'block';
        this.stopCurrentMessage();
    }
    
    previousMessage() {
        if (this.phoneData.currentMessageIndex > 0) {
            this.phoneData.currentMessageIndex--;
            this.showMessageDetail(this.phoneData.currentMessageIndex);
        }
    }
    
    nextMessage() {
        if (this.phoneData.currentMessageIndex < this.phoneData.messages.length - 1) {
            this.phoneData.currentMessageIndex++;
            this.showMessageDetail(this.phoneData.currentMessageIndex);
        }
    }
    
    playCurrentMessage() {
        const message = this.phoneData.messages[this.phoneData.currentMessageIndex];
        
        if (!message || message.type !== 'voice' || !message.voice) {
            this.showFailure("No voice message to play", false, 2000);
            return;
        }
        
        if (this.phoneData.isPlaying) {
            this.stopCurrentMessage();
            return;
        }
        
        // Check if speech synthesis is available
        if (!this.speechAvailable || !this.phoneData.speechSynthesis) {
            this.showFailure("Voice playback not available on this system. Transcript is displayed.", false, 3000);
            return;
        }
        
        // Stop any current speech
        this.phoneData.speechSynthesis.cancel();
        
        // Create new utterance
        this.phoneData.currentUtterance = new SpeechSynthesisUtterance(message.voice);
        
        // Configure voice settings
        this.phoneData.currentUtterance.rate = this.voiceSettings.rate;
        this.phoneData.currentUtterance.pitch = this.voiceSettings.pitch;
        this.phoneData.currentUtterance.volume = this.voiceSettings.volume;
        
        // Set the selected voice if available
        if (this.selectedVoice) {
            this.phoneData.currentUtterance.voice = this.selectedVoice;
        }
        
        // Set up event handlers
        this.phoneData.currentUtterance.onstart = () => {
            this.phoneData.isPlaying = true;
            this.updatePlayButtonIcon();
        };
        
        this.phoneData.currentUtterance.onend = () => {
            this.phoneData.isPlaying = false;
            this.updatePlayButtonIcon();
        };
        
        this.phoneData.currentUtterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            this.phoneData.isPlaying = false;
            this.updatePlayButtonIcon();
            this.speechAvailable = false; // Mark as unavailable for future attempts
            
            // Show a more helpful error message
            let errorMessage = "Voice playback failed. ";
            if (event.error === 'synthesis-failed') {
                errorMessage += "This is common on Linux systems. The text is displayed above.";
            } else {
                errorMessage += "The text is displayed above.";
            }
            this.showFailure(errorMessage, false, 4000);
        };
        
        // Start speaking
        try {
            this.phoneData.speechSynthesis.speak(this.phoneData.currentUtterance);
        } catch (error) {
            console.error('Failed to start speech synthesis:', error);
            this.phoneData.isPlaying = false;
            this.updatePlayButtonIcon();
            this.speechAvailable = false;
            this.showFailure("Voice playback not supported on this system. Text is displayed above.", false, 3000);
        }
    }
    
    stopCurrentMessage() {
        if (this.phoneData.isPlaying) {
            this.phoneData.speechSynthesis.cancel();
            this.phoneData.isPlaying = false;
            this.updatePlayButtonIcon();
        }
    }
    
    updatePlayButtonIcon() {
        const playButton = this.messageContent.querySelector('.play-button');
        if (playButton) {
            playButton.textContent = this.phoneData.isPlaying ? '⏹' : '▶';
        }
    }
    
    toggleCurrentMessage() {
        if (this.phoneData.isPlaying) {
            this.stopCurrentMessage();
        } else {
            this.playCurrentMessage();
        }
    }
    
    updateMessageStatus(index) {
        const messageItems = this.messagesList.querySelectorAll('.message-item');
        if (messageItems[index]) {
            const statusElement = messageItems[index].querySelector('.message-status');
            if (statusElement) {
                statusElement.className = 'message-status read';
            }
        }
    }
    
    start() {
        // Call parent start
        super.start();
        
        console.log("Phone messages minigame started");
        
        // Show message list initially
        this.showMessageList();
    }
    
    cleanup() {
        // Stop any playing speech
        this.stopCurrentMessage();
        
        // Call parent cleanup (handles event listeners)
        super.cleanup();
    }
}

// Function to return to phone after notes minigame (similar to container pattern)
export function returnToPhoneAfterNotes() {
    console.log('Returning to phone after notes minigame');
    
    // Check if there's a pending phone return
    if (window.pendingPhoneReturn) {
        const phoneState = window.pendingPhoneReturn;
        
        // Clear the pending return state
        window.pendingPhoneReturn = null;
        
        // Start the phone minigame with the stored state
        if (window.MinigameFramework) {
            window.MinigameFramework.startMinigame('phone-messages', null, {
                title: phoneState.params?.title || 'Phone Messages',
                messages: phoneState.messages,
                observations: phoneState.params?.observations,
                onComplete: (success, result) => {
                    console.log('Phone messages minigame completed:', success, result);
                }
            });
        }
    } else {
        console.warn('No pending phone return state found');
    }
}
