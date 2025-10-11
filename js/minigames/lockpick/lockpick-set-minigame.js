import { MinigameScene } from '../framework/base-minigame.js';

// Lockpick Set Minigame Scene implementation
export class LockpickSetMinigame extends MinigameScene {
    constructor(container, params) {
        // Ensure params is defined before calling parent constructor
        params = params || {};
        
        // Set default title if not provided
        params.title = 'Lockpick Set';
        
        // Enable cancel button for lockpick minigame with custom text
        params.showCancel = true;
        params.cancelText = 'Close';
        
        super(container, params);
        
        this.item = params.item;
        this.searchingMode = false;
        this.highlightedObjects = [];
    }
    
    init() {
        // Call parent init to set up common components
        super.init();
        
        console.log("Lockpick set minigame initializing");
        
        // Set container dimensions to be compact
        this.container.className += ' lockpick-set-minigame-container';
        
        // Clear header content
        this.headerElement.innerHTML = '';
        
        // Configure game container
        this.gameContainer.className += ' lockpick-set-minigame-game-container';
        
        // Create lockpick interface
        this.createLockpickInterface();
    }
    
    createLockpickInterface() {
        // Create expand/collapse toggle button
        const expandToggle = document.createElement('div');
        expandToggle.className = 'lockpick-expand-toggle';
        expandToggle.innerHTML = '▼';
        expandToggle.title = 'Expand/Collapse';
        
        // Create search room button (at the top)
        const searchRoomContainer = document.createElement('div');
        searchRoomContainer.className = 'lockpick-search-room-container';
        searchRoomContainer.innerHTML = `
            <button id="search-locks-btn" class="lockpick-action-btn">
                <span class="btn-icon">🔍</span>
                <span class="btn-text">Search for Pickable Locks</span>
            </button>
        `;
        
        // Create lockpick header
        const lockpickHeader = document.createElement('div');
        lockpickHeader.className = 'lockpick-set-header';
        lockpickHeader.innerHTML = `
            <div class="lockpick-set-title">
                <img src="assets/objects/lockpick.png" alt="Lockpick Set" class="lockpick-icon">
                <span>Lockpick Set</span>
            </div>
            <div class="lockpick-set-status">
                <div class="lockpick-indicator active"></div>
                <span>Ready</span>
            </div>
        `;
        
        // Create instructions
        const instructionsContainer = document.createElement('div');
        instructionsContainer.className = 'lockpick-set-instructions';
        instructionsContainer.innerHTML = `
            <div class="instruction-text">
                <strong>Instructions:</strong><br>
                • Use "Search for Pickable Locks" to highlight locks in the room<br>
                • Click highlighted locks to attempt lockpicking<br>
                • Different locks have different difficulty levels<br>
                • Higher skill and better tools improve success rates
            </div>
        `;
        
        // Assemble the interface
        this.gameContainer.appendChild(expandToggle);
        this.gameContainer.appendChild(searchRoomContainer);
        this.gameContainer.appendChild(lockpickHeader);
        this.gameContainer.appendChild(instructionsContainer);
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Set up expand/collapse functionality
        this.setupExpandToggle(expandToggle);
    }
    
    setupEventListeners() {
        // Search locks button
        const searchLocksBtn = document.getElementById('search-locks-btn');
        if (searchLocksBtn) {
            this.addEventListener(searchLocksBtn, 'click', () => this.toggleLockSearching());
        }
    }
    
    setupExpandToggle(expandToggle) {
        this.addEventListener(expandToggle, 'click', () => {
            const isExpanded = this.container.classList.contains('expanded');
            
            if (isExpanded) {
                // Collapse
                this.container.classList.remove('expanded');
                expandToggle.innerHTML = '▼';
                expandToggle.title = 'Expand';
            } else {
                // Expand
                this.container.classList.add('expanded');
                expandToggle.innerHTML = '▲';
                expandToggle.title = 'Collapse';
            }
        });
    }
    
    toggleLockSearching() {
        this.searchingMode = !this.searchingMode;
        const searchBtn = document.getElementById('search-locks-btn');
        
        if (this.searchingMode) {
            // Start searching mode
            searchBtn.classList.add('active');
            searchBtn.querySelector('.btn-text').textContent = 'Stop Searching';
            this.highlightPickableLocks();
            console.log('Lock searching started');
        } else {
            // Stop searching mode
            searchBtn.classList.remove('active');
            searchBtn.querySelector('.btn-text').textContent = 'Search for Pickable Locks';
            this.clearHighlights();
            console.log('Lock searching stopped');
        }
    }
    
    highlightPickableLocks() {
        // Clear existing highlights
        this.clearHighlights();
        
        // Find all objects in the current room that have pickable locks
        if (!window.currentPlayerRoom || !window.rooms[window.currentPlayerRoom]) {
            return;
        }
        
        const room = window.rooms[window.currentPlayerRoom];
        this.highlightedObjects = [];
        
        // Check regular objects
        if (room.objects) {
            Object.values(room.objects).forEach(obj => {
                // Check if object has a lock that can be picked (key locks can be picked)
                if (obj.scenarioData?.lockType === 'key' || obj.scenarioData?.pickable === true) {
                    // Add highlight effect to the object
                    if (obj.setTint) {
                        obj.setTint(0x00ff00); // Green tint for pickable locks
                        this.highlightedObjects.push(obj);
                    }
                    
                    // Add a visual indicator
                    this.addLockpickIndicator(obj);
                }
            });
        }
        
        // Check doors (they're stored separately)
        if (room.doors) {
            Object.values(room.doors).forEach(door => {
                // Check if door has a lock that can be picked
                if (door.properties?.lockType === 'key' || door.scenarioData?.lockType === 'key') {
                    // Add highlight effect to the door
                    if (door.setTint) {
                        door.setTint(0x00ff00); // Green tint for pickable locks
                        this.highlightedObjects.push(door);
                    }
                    
                    // Add a visual indicator
                    this.addLockpickIndicator(door);
                }
            });
        }
        
        if (this.highlightedObjects.length > 0) {
            console.log(`Highlighted ${this.highlightedObjects.length} pickable locks:`, this.highlightedObjects.map(obj => ({
                id: obj.objectId,
                name: obj.scenarioData?.name,
                type: obj.scenarioData?.type,
                lockType: obj.scenarioData?.lockType
            })));
        } else {
            console.log('No pickable locks found in this room');
        }
    }
    
    addLockpickIndicator(obj) {
        // Create a lockpick image indicator directly over the object
        if (obj.scene && obj.scene.add) {
            const indicator = obj.scene.add.image(obj.x, obj.y, 'lockpick');
            indicator.setDepth(1000); // High depth to appear on top
            indicator.setOrigin(-0.25, 0);
            indicator.setTint(0x00ff00); // Green tint
            
            // Add pulsing animation
            obj.scene.tweens.add({
                targets: indicator,
                alpha: { from: 1, to: 0.3 },
                duration: 1000,
                yoyo: true,
                repeat: -1
            });
            
            // Store reference for cleanup
            obj.lockpickIndicator = indicator;
        }
    }
    
    clearHighlights() {
        // Remove highlights from all objects
        this.highlightedObjects.forEach(obj => {
            if (obj.clearTint) {
                obj.clearTint();
            }
            if (obj.lockpickIndicator) {
                obj.lockpickIndicator.destroy();
                delete obj.lockpickIndicator;
            }
        });
        this.highlightedObjects = [];
    }
    
    start() {
        super.start();
        console.log("Lockpick set minigame started");
        
        // Override the cancel button to just close without completion logic
        if (this.cancelButton) {
            this.cancelButton.onclick = () => {
                console.log("Closing lockpick set tool");
                this.complete(true);
            };
        }
        
        // No need to override interaction handler - just highlight objects
        // The normal interaction system will handle clicking on highlighted objects
    }
    
    attemptLockpicking(obj) {
        // Start the actual lockpicking minigame using the existing system
        if (window.startLockpickingMinigame) {
            console.log('Starting lockpicking minigame for object:', obj);
            
            // Get difficulty from object data
            const difficulty = obj.scenarioData?.difficulty || obj.scenarioData?.lockDifficulty || 'medium';
            
            // Use the existing lockpicking system
            window.startLockpickingMinigame(obj, window.game, difficulty, (success) => {
                if (success) {
                    console.log('Lockpicking successful');
                    // The existing system should handle unlocking
                } else {
                    console.log('Lockpicking failed');
                }
            });
        } else {
            console.error('Lockpicking minigame not available');
            if (window.gameAlert) {
                window.gameAlert('Lockpicking minigame not available', 'error', 'Error', 3000);
            }
        }
    }
    
    complete(success) {
        // Stop searching mode and clear highlights
        if (this.searchingMode) {
            this.toggleLockSearching();
        }
        
        // For the lockpick set minigame, we don't need success/failure logic
        // Just close the minigame without any completion state
        super.complete(true, null);
    }
    
    cleanup() {
        // Clear highlights
        this.clearHighlights();
        
        // Call parent cleanup
        super.cleanup();
    }
}

// Function to start the lockpick set minigame
export function startLockpickSetMinigame(item) {
    console.log('Starting lockpick set minigame with:', { item });
    
    // Make sure the minigame is registered
    if (window.MinigameFramework && !window.MinigameFramework.registeredScenes['lockpick-set']) {
        window.MinigameFramework.registerScene('lockpick-set', LockpickSetMinigame);
        console.log('Lockpick set minigame registered on demand');
    }
    
    // Initialize the framework if not already done
    if (!window.MinigameFramework.mainGameScene && item && item.scene) {
        window.MinigameFramework.init(item.scene);
    }
    
    // Start the lockpick set minigame with proper parameters
    const params = {
        title: 'Lockpick Set',
        item: item,
        onComplete: (success, result) => {
            console.log('Lockpick set minigame completed with success:', success);
        }
    };
    
    console.log('Starting lockpick set minigame with params:', params);
    window.MinigameFramework.startMinigame('lockpick-set', null, params);
}
