import { MinigameScene } from '../framework/base-minigame.js';

// Load handwritten font
const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=Kalam:wght@300;400;700&display=swap';
fontLink.rel = 'stylesheet';
if (!document.querySelector('link[href*="Kalam"]')) {
    document.head.appendChild(fontLink);
}

// Notes Minigame Scene implementation
export class NotesMinigame extends MinigameScene {
    constructor(container, params) {
        // Ensure params is defined before calling parent constructor
        params = params || {};
        
        // Set default title if not provided
        if (!params.title) {
            params.title = 'Reading Notes';
        }
        
        super(container, params);
        
        this.item = params.item;
        this.noteContent = params.noteContent || this.item?.scenarioData?.noteContent || this.item?.scenarioData?.text || 'No content available';
        this.observationText = params.observationText || this.item?.scenarioData?.observationText || this.item?.scenarioData?.observations || '';
        
        // Initialize note navigation
        this.currentNoteIndex = 0;
        this.collectedNotes = this.getCollectedNotes();
        this.autoAddToNotes = true;
    }
    
    init() {
        // Call parent init to set up common components
        super.init();
        
        console.log("Notes minigame initializing");
        
        // Set container dimensions to take up most of the screen
        this.container.style.width = '90%';
        this.container.style.height = '85%';
        this.container.style.padding = '20px';
        
                // Set up header content
                this.headerElement.innerHTML = `
                    <h3>Reading Notes</h3>
                    <p>Note automatically added to your collection</p>
                `;
        
        // Configure game container with notepad background - scaled to fill most of the screen
        this.gameContainer.style.cssText = `
            width: 100%;
            min-height: 100%;
            max-width: 800px;
            max-height: none;
            background-image: url('assets/mini-games/notepad.png');
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
            position: relative;
            margin: 20px auto;
            padding: 10px 140px 50px 150px;
            box-sizing: border-box;
            image-rendering: -moz-crisp-edges;
            image-rendering: -webkit-crisp-edges;
            image-rendering: pixelated;
            image-rendering: crisp-edges;
        `;
        
        // Create content area
        const contentArea = document.createElement('div');
        contentArea.style.cssText = `
            width: 100%;
            min-height: 100%;
            font-family: 'Courier New', monospace;
            font-size: 18px;
            line-height: 1.5;
            color: #333;
            background: transparent;
            padding: 0;
            margin: 0;
        `;
        
                // Create text box container to look like it's stuck in a binder
                const textBox = document.createElement('div');
                textBox.style.cssText = `
                    margin: 20px 50px 60px 80px;
                    padding: 40px;
                    background: #fefefe;
                    border: 2px solid #ddd;
                    border-radius: 3px;
                    box-shadow: 
                        0 2px 4px rgba(0,0,0,0.1),
                        inset 0 1px 0 rgba(255,255,255,0.8);
                    position: relative;
                    min-height: fit-content;
                `;
                
                // Add celotape effect
                const celotape = document.createElement('div');
                celotape.className = 'notes-minigame-celotape';
                celotape.style.cssText = `
                    position: absolute;
                    top: -8px;
                    left: 80px;
                    right: 80px;
                    height: 16px;
                    background: linear-gradient(90deg, 
                        rgba(255,255,255,0.9) 0%, 
                        rgba(255,255,255,0.7) 20%, 
                        rgba(255,255,255,0.9) 40%,
                        rgba(255,255,255,0.7) 60%,
                        rgba(255,255,255,0.9) 80%,
                        rgba(255,255,255,0.7) 100%);
                    border: 1px solid rgba(200,200,200,0.8);
                    border-radius: 2px;
                    box-shadow: 
                        0 1px 2px rgba(0,0,0,0.1),
                        inset 0 1px 0 rgba(255,255,255,0.9);
                    z-index: 1;
                `;
                textBox.appendChild(celotape);
        
        // Add binder holes effect
        const binderHoles = document.createElement('div');
        binderHoles.style.cssText = `
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            width: 8px;
            height: 80px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        `;
        
        
        
        // Add note title/name above the text box
        const noteTitle = document.createElement('div');
        noteTitle.className = 'notes-minigame-title';
        noteTitle.style.cssText = `
            margin: 0 50px 20px 80px;
            font-family: 'Kalam', 'Comic Sans MS', cursive;
            font-size: 20px;
            font-weight: bold;
            color: #2c3e50;
            text-decoration: underline;
            text-decoration-color: #3498db;
            text-underline-offset: 3px;
            text-align: center;
        `;
        noteTitle.textContent = this.item?.scenarioData?.name || 'Note';
        contentArea.appendChild(noteTitle);
        
        // Add note content
        const noteText = document.createElement('div');
        noteText.className = 'notes-minigame-text';
        noteText.style.cssText = `
            margin-left: 30px;
            white-space: pre-wrap;
            word-wrap: break-word;
            color: #333;
        `;
        noteText.textContent = this.noteContent;
        textBox.appendChild(noteText);
        
        contentArea.appendChild(textBox);
        
                // Add observation text if available - handwritten directly on the page
                if (this.observationText) {
                    const observationContainer = document.createElement('div');
                    observationContainer.className = 'notes-minigame-observation-container';
                    observationContainer.style.cssText = `
                        margin: 20px 50px 60px 80px;
                        position: relative;
                    `;
                    
                    const observationDiv = document.createElement('div');
                    observationDiv.className = 'notes-minigame-observation';
                    observationDiv.style.cssText = `
                        font-family: 'Kalam', 'Comic Sans MS', cursive;
                        font-style: italic;
                        color: #666;
                        font-size: 18px;
                        line-height: 1.4;
                        text-align: left;
                        min-height: 30px;
                        padding: 10px;
                        border: 1px dashed #ccc;
                        border-radius: 3px;
                        background: rgba(255, 255, 255, 0.3);
                    `;
                    observationDiv.innerHTML = this.observationText;
                    
                    // Add edit button
                    const editBtn = document.createElement('button');
                    editBtn.className = 'notes-minigame-edit-btn';
                    editBtn.style.cssText = `
                        position: absolute;
                        top: -8px;
                        right: -8px;
                        background: #3498db;
                        color: white;
                        border: none;
                        border-radius: 50%;
                        width: 24px;
                        height: 24px;
                        cursor: pointer;
                        font-size: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                        transition: background-color 0.3s ease;
                    `;
                    editBtn.innerHTML = '✏️';
                    editBtn.title = 'Edit observations';
                    editBtn.addEventListener('click', () => this.editObservations(observationDiv));
                    
                    observationContainer.appendChild(observationDiv);
                    observationContainer.appendChild(editBtn);
                    contentArea.appendChild(observationContainer);
                } else {
                    // Add empty observation area with edit button
                    const observationContainer = document.createElement('div');
                    observationContainer.className = 'notes-minigame-observation-container';
                    observationContainer.style.cssText = `
                        margin: 20px 50px 60px 80px;
                        position: relative;
                    `;
                    
                    const observationDiv = document.createElement('div');
                    observationDiv.className = 'notes-minigame-observation';
                    observationDiv.style.cssText = `
                        font-family: 'Kalam', 'Comic Sans MS', cursive;
                        font-style: italic;
                        color: #999;
                        font-size: 18px;
                        line-height: 1.4;
                        text-align: left;
                        min-height: 30px;
                        padding: 10px;
                        border: 1px dashed #ccc;
                        border-radius: 3px;
                        background: rgba(255, 255, 255, 0.3);
                    `;
                    observationDiv.innerHTML = '<em>Click edit to add your observations...</em>';
                    
                    // Add edit button
                    const editBtn = document.createElement('button');
                    editBtn.className = 'notes-minigame-edit-btn';
                    editBtn.style.cssText = `
                        position: absolute;
                        top: -8px;
                        right: -8px;
                        background: #3498db;
                        color: white;
                        border: none;
                        border-radius: 50%;
                        width: 24px;
                        height: 24px;
                        cursor: pointer;
                        font-size: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                        transition: background-color 0.3s ease;
                    `;
                    editBtn.innerHTML = '✏️';
                    editBtn.title = 'Add observations';
                    editBtn.addEventListener('click', () => this.editObservations(observationDiv));
                    
                    observationContainer.appendChild(observationDiv);
                    observationContainer.appendChild(editBtn);
                    contentArea.appendChild(observationContainer);
                }
        
        this.gameContainer.appendChild(contentArea);
        
        // Create navigation buttons container
        const navContainer = document.createElement('div');
        navContainer.style.cssText = `
            position: absolute;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 15px;
            z-index: 10;
        `;
        
        // Add search input if there are multiple notes
        if (this.collectedNotes.length > 1) {
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.placeholder = 'Search notes...';
            searchInput.className = 'notes-minigame-search';
            searchInput.style.cssText = `
                padding: 8px 12px;
                border: 1px solid #555;
                border-radius: 5px;
                background: rgba(0,0,0,0.7);
                color: white;
                font-size: 14px;
                width: 200px;
                margin-right: 10px;
            `;
            searchInput.addEventListener('input', (e) => this.searchNotes(e.target.value));
            navContainer.appendChild(searchInput);
            
            const prevBtn = document.createElement('button');
            prevBtn.className = 'minigame-button notes-nav-button';
            prevBtn.style.cssText = `
                background: #95a5a6;
                color: white;
                border: none;
                padding: 8px 15px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
                font-weight: bold;
                transition: background-color 0.3s ease;
            `;
            prevBtn.textContent = '← Previous';
            prevBtn.addEventListener('click', () => this.navigateToNote(-1));
            navContainer.appendChild(prevBtn);
            
            const nextBtn = document.createElement('button');
            nextBtn.className = 'minigame-button notes-nav-button';
            nextBtn.style.cssText = `
                background: #95a5a6;
                color: white;
                border: none;
                padding: 8px 15px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
                font-weight: bold;
                transition: background-color 0.3s ease;
            `;
            nextBtn.textContent = 'Next →';
            nextBtn.addEventListener('click', () => this.navigateToNote(1));
            navContainer.appendChild(nextBtn);
            
            // Add note counter
            const noteCounter = document.createElement('div');
            noteCounter.className = 'notes-minigame-counter';
            noteCounter.style.cssText = `
                color: white;
                font-size: 14px;
                display: flex;
                align-items: center;
                padding: 8px 15px;
                background: rgba(0,0,0,0.5);
                border-radius: 5px;
            `;
            noteCounter.textContent = `${this.currentNoteIndex + 1} / ${this.collectedNotes.length}`;
            navContainer.appendChild(noteCounter);
            
            this.container.appendChild(navContainer);
        }
        
        // Create action buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 15px;
            z-index: 10;
        `;
        
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'minigame-button notes-close-button';
        closeBtn.style.cssText = `
            background: #95a5a6;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            transition: background-color 0.3s ease;
        `;
        closeBtn.textContent = 'Close';
        
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.backgroundColor = '#7f8c8d';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.backgroundColor = '#95a5a6';
        });
        
        closeBtn.addEventListener('click', () => {
            this.complete(false);
        });
        
        buttonsContainer.appendChild(closeBtn);
        
        this.container.appendChild(buttonsContainer);
    }
    
    
    removeNoteFromScene() {
        // Remove the note from the scene if it has a sprite
        if (this.item && this.item.sprite) {
            console.log('Removing note from scene:', this.item.sprite);
            
            // Hide the sprite
            if (this.item.sprite.setVisible) {
                this.item.sprite.setVisible(false);
            }
            
            // Remove from scene if it has a destroy method
            if (this.item.sprite.destroy) {
                this.item.sprite.destroy();
            }
            
            // Also try to remove from the scene's object list if available
            if (this.item.scene && this.item.scene.objects) {
                const objectIndex = this.item.scene.objects.findIndex(obj => obj.sprite === this.item.sprite);
                if (objectIndex !== -1) {
                    this.item.scene.objects.splice(objectIndex, 1);
                    console.log('Removed note from scene objects list');
                }
            }
            
            // Update the scene's interactive objects if available
            if (this.item.scene && this.item.scene.interactiveObjects) {
                const interactiveIndex = this.item.scene.interactiveObjects.findIndex(obj => obj.sprite === this.item.sprite);
                if (interactiveIndex !== -1) {
                    this.item.scene.interactiveObjects.splice(interactiveIndex, 1);
                    console.log('Removed note from scene interactive objects list');
                }
            }
        }
    }
    
    getCollectedNotes() {
        // Get all notes from the notes system that are marked as important or have been collected
        if (!window.gameState || !window.gameState.notes) {
            return [];
        }
        
        // Filter for important notes or notes that look like they were collected from objects
        return window.gameState.notes.filter(note => 
            note.important || 
            note.title.includes('Log') || 
            note.title.includes('Note') ||
            note.title.includes('Security') ||
            note.title.includes('Report')
        );
    }
    
    navigateToNote(direction) {
        if (this.collectedNotes.length <= 1) return;
        
        this.currentNoteIndex += direction;
        
        // Wrap around
        if (this.currentNoteIndex < 0) {
            this.currentNoteIndex = this.collectedNotes.length - 1;
        } else if (this.currentNoteIndex >= this.collectedNotes.length) {
            this.currentNoteIndex = 0;
        }
        
        // Update the displayed note
        this.updateDisplayedNote();
        
        // Update the counter
        const noteCounter = this.container.querySelector('.notes-minigame-counter');
        if (noteCounter) {
            noteCounter.textContent = `${this.currentNoteIndex + 1} / ${this.collectedNotes.length}`;
        }
    }
    
    updateDisplayedNote() {
        const currentNote = this.collectedNotes[this.currentNoteIndex];
        if (!currentNote) return;
        
        // Parse the note text to extract observations
        const noteParts = this.parseNoteText(currentNote.text);
        this.noteContent = noteParts.mainText;
        this.observationText = noteParts.observationText;
        
        // Update the displayed content
        const noteTitle = this.container.querySelector('.notes-minigame-title');
        const noteText = this.container.querySelector('.notes-minigame-text');
        const observationDiv = this.container.querySelector('.notes-minigame-observation');
        
        if (noteTitle) {
            noteTitle.textContent = currentNote.title;
        }
        
        if (noteText) {
            noteText.textContent = this.noteContent;
        }
        
        // Update observation container
        const observationContainer = this.container.querySelector('.notes-minigame-observation-container');
        if (observationContainer) {
            const observationDiv = observationContainer.querySelector('.notes-minigame-observation');
            const editBtn = observationContainer.querySelector('.notes-minigame-edit-btn');
            
            if (this.observationText) {
                observationDiv.innerHTML = this.observationText;
                observationDiv.style.color = '#666';
                editBtn.title = 'Edit observations';
            } else {
                observationDiv.innerHTML = '<em>Click edit to add your observations...</em>';
                observationDiv.style.color = '#999';
                editBtn.title = 'Add observations';
            }
        }
    }
    
    parseNoteText(text) {
        // Parse note text to separate main content from observations
        const observationMatch = text.match(/\n\nObservation:\s*(.+)$/s);
        if (observationMatch) {
            return {
                mainText: text.replace(/\n\nObservation:\s*.+$/s, '').trim(),
                observationText: observationMatch[1].trim()
            };
        }
        return {
            mainText: text,
            observationText: ''
        };
    }
    
    searchNotes(searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') {
            // Reset to show all notes
            this.collectedNotes = this.getCollectedNotes();
            this.currentNoteIndex = 0;
            this.updateDisplayedNote();
            this.updateCounter();
            return;
        }
        
        const searchLower = searchTerm.toLowerCase();
        const matchingNotes = this.collectedNotes.filter(note => 
            note.title.toLowerCase().includes(searchLower) ||
            note.text.toLowerCase().includes(searchLower)
        );
        
        if (matchingNotes.length > 0) {
            this.collectedNotes = matchingNotes;
            this.currentNoteIndex = 0;
            this.updateDisplayedNote();
            this.updateCounter();
        }
    }
    
    updateCounter() {
        const noteCounter = this.container.querySelector('.notes-minigame-counter');
        if (noteCounter) {
            noteCounter.textContent = `${this.currentNoteIndex + 1} / ${this.collectedNotes.length}`;
        }
    }
    
    editObservations(observationDiv) {
        const currentText = observationDiv.textContent.trim();
        const isPlaceholder = currentText === 'Click edit to add your observations...';
        const originalText = isPlaceholder ? '' : currentText;
        
        // Create textarea for editing
        const textarea = document.createElement('textarea');
        textarea.value = originalText;
        textarea.style.cssText = `
            width: 100%;
            min-height: 60px;
            font-family: 'Kalam', 'Comic Sans MS', cursive;
            font-size: 18px;
            line-height: 1.4;
            color: #666;
            border: 2px solid #3498db;
            border-radius: 3px;
            padding: 10px;
            background: rgba(255, 255, 255, 0.9);
            resize: vertical;
            outline: none;
        `;
        textarea.placeholder = 'Add your observations here...';
        
        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            margin-top: 10px;
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        `;
        
        // Save button
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.style.cssText = `
            background: #2ecc71;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 14px;
        `;
        saveBtn.addEventListener('click', () => {
            const newText = textarea.value.trim();
            observationDiv.innerHTML = newText || '<em>Click edit to add your observations...</em>';
            observationDiv.style.color = newText ? '#666' : '#999';
            
            // Update the stored observation text
            this.observationText = newText;
            
            // Save to the current note in the notes system
            this.saveObservationToNote(newText);
            
            // Remove editing elements
            textarea.remove();
            buttonContainer.remove();
        });
        
        // Cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            background: #95a5a6;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 14px;
        `;
        cancelBtn.addEventListener('click', () => {
            // Restore original text
            if (originalText) {
                observationDiv.innerHTML = originalText;
                observationDiv.style.color = '#666';
            } else {
                observationDiv.innerHTML = '<em>Click edit to add your observations...</em>';
                observationDiv.style.color = '#999';
            }
            
            // Remove editing elements
            textarea.remove();
            buttonContainer.remove();
        });
        
        buttonContainer.appendChild(saveBtn);
        buttonContainer.appendChild(cancelBtn);
        
        // Replace content with editing interface
        observationDiv.innerHTML = '';
        observationDiv.appendChild(textarea);
        observationDiv.appendChild(buttonContainer);
        
        // Focus the textarea
        textarea.focus();
        textarea.select();
    }
    
    saveObservationToNote(newObservationText) {
        // Update the current note in the notes system
        const currentNote = this.collectedNotes[this.currentNoteIndex];
        if (currentNote) {
            // Parse the existing text to separate main content from observations
            const noteParts = this.parseNoteText(currentNote.text);
            
            // Update the observation text
            noteParts.observationText = newObservationText;
            
            // Reconstruct the full text
            let fullText = noteParts.mainText;
            if (newObservationText) {
                fullText += `\n\nObservation: ${newObservationText}`;
            }
            
            // Update the note in the notes system
            currentNote.text = fullText;
            
            // Also update in the global notes system if it exists
            if (window.gameState && window.gameState.notes) {
                const globalNote = window.gameState.notes.find(note => 
                    note.title === currentNote.title && note.timestamp === currentNote.timestamp
                );
                if (globalNote) {
                    globalNote.text = fullText;
                }
            }
            
            console.log('Observation saved to note:', currentNote.title);
        }
    }
    
    start() {
        super.start();
        console.log("Notes minigame started");
        
        // Automatically add current note to notes system when starting
        if (this.autoAddToNotes && window.addNote) {
            const noteTitle = this.item?.scenarioData?.name || 'Note';
            const noteText = this.noteContent + (this.observationText ? `\n\nObservation: ${this.observationText}` : '');
            const isImportant = this.item?.scenarioData?.important || false;
            
            const addedNote = window.addNote(noteTitle, noteText, isImportant);
            if (addedNote) {
                console.log('Note automatically added to notes system on start:', addedNote);
                // Refresh collected notes
                this.collectedNotes = this.getCollectedNotes();
                
                // Automatically remove the note from the scene
                this.removeNoteFromScene();
            }
        }
    }
    
    complete(success) {
        // Call parent complete with result
        super.complete(success, this.gameResult);
    }
    
    cleanup() {
        super.cleanup();
    }
}

// Export the minigame for the framework to register
// The registration is handled in the main minigames/index.js file

// Function to show mission brief via notes minigame
export function showMissionBrief() {
    if (!window.gameScenario || !window.gameScenario.scenario_brief) {
        console.warn('No mission brief available');
        return;
    }
    
    const missionBriefItem = {
        scene: null,
        scenarioData: {
            type: 'notes',
            name: 'Mission Brief',
            text: window.gameScenario.scenario_brief,
            important: true
        }
    };
    
    startNotesMinigame(missionBriefItem, window.gameScenario.scenario_brief, '');
}

// Function to start the notes minigame
export function startNotesMinigame(item, noteContent, observationText) {
    console.log('Starting notes minigame with:', { item, noteContent, observationText });
    
    // Make sure the minigame is registered
    if (window.MinigameFramework && !window.MinigameFramework.registeredScenes['notes']) {
        window.MinigameFramework.registerScene('notes', NotesMinigame);
        console.log('Notes minigame registered on demand');
    }
    
    // Initialize the framework if not already done
    if (!window.MinigameFramework.mainGameScene && item && item.scene) {
        window.MinigameFramework.init(item.scene);
    }
    
    // Start the notes minigame with proper parameters
    const params = {
        title: item?.scenarioData?.name || 'Reading Notes',
        item: item,
        noteContent: noteContent,
        observationText: observationText,
        onComplete: (success, result) => {
            if (success && result && result.addedToInventory) {
                console.log('NOTES SUCCESS - Added to inventory', result);
                
                // Show notification
                if (window.showNotification) {
                    window.showNotification('Note added to inventory', 'success');
                } else if (window.gameAlert) {
                    window.gameAlert('Note added to inventory', 'success', 'Item Collected', 3000);
                }
            } else {
                console.log('NOTES COMPLETED - Not added to inventory');
            }
        }
    };
    
    console.log('Starting minigame with params:', params);
    window.MinigameFramework.startMinigame('notes', null, params);
}
