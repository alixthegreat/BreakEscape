import { MinigameScene } from '../framework/base-minigame.js';
import { LockConfiguration } from './lock-configuration.js';
import { LockGraphics } from './lock-graphics.js';
import { KeyDataGenerator } from './key-data-generator.js';
import { KeySelection } from './key-selection.js';
import { KeyOperations } from './key-operations.js';
import { PinManagement } from './pin-management.js';
import { ToolManager } from './tool-manager.js';
import { KeyAnimation } from './key-animation.js';
import { HookMechanics } from './hook-mechanics.js';
import { PinVisuals } from './pin-visuals.js';
import { KeyInsertion } from './key-insertion.js';
import { KeyDrawing } from './key-drawing.js';
import { KeyPathDrawing } from './key-path-drawing.js';
import { KeyGeometry } from './key-geometry.js';
import { GameUtilities } from './game-utilities.js';

// Phaser Lockpicking Minigame Scene implementation
export class LockpickingMinigamePhaser extends MinigameScene {
    constructor(container, params) {
        super(container, params);
        
        // Ensure params is an object
        params = params || {};
        
        console.log('🎮 Lockpicking minigame constructor received params:', {
            predefinedPinHeights: params.predefinedPinHeights,
            difficulty: params.difficulty,
            pinCount: params.pinCount,
            lockableType: params.lockable?.doorProperties ? 'door' : params.lockable?.scenarioData ? 'item' : 'unknown'
        });
        
        this.lockable = params.lockable || 'default-lock';
        this.lockId = params.lockId || 'default_lock';
        this.difficulty = params.difficulty || 'medium';
        
        // Determine pin count: prioritize based on keyPins array length from scenario
        let pinCount = params.pinCount;
        let predefinedPinHeights = params.predefinedPinHeights;
        
        console.log('🔍 pinCount determination started:', {
            explicitPinCount: pinCount,
            predefinedPinHeights: predefinedPinHeights,
            difficulty: this.difficulty
        });
        
        // If predefinedPinHeights not in params, try to extract from lockable object
        if (!predefinedPinHeights && this.lockable) {
            console.log('🔍 Attempting to extract predefinedPinHeights from lockable object');
            if (this.lockable.doorProperties?.keyPins) {
                predefinedPinHeights = this.lockable.doorProperties.keyPins;
                console.log(`✓ Extracted predefinedPinHeights from lockable.doorProperties:`, predefinedPinHeights);
            } else if (this.lockable.scenarioData?.keyPins) {
                predefinedPinHeights = this.lockable.scenarioData.keyPins;
                console.log(`✓ Extracted predefinedPinHeights from lockable.scenarioData:`, predefinedPinHeights);
            } else if (this.lockable.keyPins) {
                predefinedPinHeights = this.lockable.keyPins;
                console.log(`✓ Extracted predefinedPinHeights from lockable.keyPins:`, predefinedPinHeights);
            } else {
                console.warn('⚠ Could not extract predefinedPinHeights from lockable object');
            }
        }
        
        // Store for use in pin management
        this.params = params;
        this.params.predefinedPinHeights = predefinedPinHeights;
        
        // If pinCount not explicitly provided, derive from predefinedPinHeights (keyPins from scenario)
        if (!pinCount && predefinedPinHeights && Array.isArray(predefinedPinHeights)) {
            pinCount = predefinedPinHeights.length;
            console.log(`✓ Determined pinCount ${pinCount} from predefinedPinHeights array length: [${predefinedPinHeights.join(', ')}]`);
        }
        
        // Fall back to difficulty-based pin count if still not set
        if (!pinCount) {
            pinCount = this.difficulty === 'easy' ? 3 : this.difficulty === 'medium' ? 4 : 5;
            console.log(`⚠ Using difficulty-based pinCount: ${pinCount} (difficulty: ${this.difficulty})`);
        }

        
        this.pinCount = pinCount;
        
        // Initialize global lock storage if it doesn't exist
        if (!window.lockConfigurations) {
            window.lockConfigurations = {};
        }
        
        // Initialize KeyDataGenerator module
        this.keyDataGen = new KeyDataGenerator(this);
        
        // Initialize KeySelection module
        this.keySelection = new KeySelection(this);
        
        // Initialize KeyOperations module
        this.keyOps = new KeyOperations(this);
        
        // Initialize PinManagement module
        this.pinMgmt = new PinManagement(this);
        
        // Initialize ToolManager module
        this.toolMgr = new ToolManager(this);
        
        // Initialize KeyAnimation module
        this.keyAnim = new KeyAnimation(this);
        
        // Initialize HookMechanics module
        this.hookMech = new HookMechanics(this);
        
        // Initialize PinVisuals module
        this.pinVisuals = new PinVisuals(this);
        
        // Initialize KeyInsertion module
        this.keyInsertion = new KeyInsertion(this);
        
        // Initialize KeyDrawing module
        this.keyDraw = new KeyDrawing(this);
        
        // Initialize KeyPathDrawing module
        this.keyPathDraw = new KeyPathDrawing(this);
        
        // Initialize KeyGeometry module
        this.keyGeom = new KeyGeometry(this);
        
        // Initialize GameUtilities module
        this.gameUtil = new GameUtilities(this);
        
        // Also try to load from localStorage for persistence across sessions
        if (!window.lockConfigurations[this.lockId]) {
            try {
                const savedConfigs = localStorage.getItem('lockConfigurations');
                if (savedConfigs) {
                    const parsed = JSON.parse(savedConfigs);
                    window.lockConfigurations = { ...window.lockConfigurations, ...parsed };
                }
            } catch (error) {
                console.warn('Failed to load lock configurations from localStorage:', error);
            }
        }
        
        // Threshold sensitivity for pin setting (1-10, higher = more sensitive)
        this.thresholdSensitivity = params.thresholdSensitivity || 5;
        
        // Whether to highlight binding order
        this.highlightBindingOrder = params.highlightBindingOrder !== undefined ? params.highlightBindingOrder : true;
        
        // Whether to highlight pin alignment (shear line proximity)
        this.highlightPinAlignment = params.highlightPinAlignment !== undefined ? params.highlightPinAlignment : true;
        
        // Lift speed parameter (can be set to fast values, but reasonable default for hard)
        this.liftSpeed = params.liftSpeed || (this.difficulty === 'hard' ? 1.2 : 1);
        
        // Close button customization
        this.closeButtonText = params.cancelText || 'Cancel';
        this.closeButtonAction = params.closeButtonAction || 'close';
        
        // Key mode settings
        this.keyMode = params.keyMode || false;
        this.keyData = params.keyData || null; // Key data with cuts/ridges
        this.keyInsertionProgress = 0; // 0 = not inserted, 1 = fully inserted
        this.keyInserting = false;
        this.skipStartingKey = params.skipStartingKey || false; // Skip creating initial key if true
        this.keySelectionMode = false; // Track if we're in key selection mode
        
        // Mode switching settings
        this.canSwitchToPickMode = params.canSwitchToPickMode || false; // Allow switching from key to pick mode
        this.inventoryKeys = params.inventoryKeys || null; // Stored for mode switching
        this.requirefKeyId = params.requiredKeyId || null; // Track required key ID
        this.canSwitchToKeyMode = params.canSwitchToKeyMode || false; // Allow switching from lockpick to key mode
        this.availableKeys = params.availableKeys || null; // Keys available for mode switching
        
        // Sound effects
        this.sounds = {};
        
        // Track if any pin has been clicked (for hiding labels)
        this.pinClicked = false;
        
        // Log the configuration for debugging
        console.log('Lockpicking minigame config:', {
            lockable: this.lockable,
            difficulty: this.difficulty,
            pinCount: this.pinCount,
            passedPinCount: params.pinCount,
            thresholdSensitivity: this.thresholdSensitivity,
            highlightBindingOrder: this.highlightBindingOrder,
            highlightPinAlignment: this.highlightPinAlignment,
            liftSpeed: this.liftSpeed,
            canSwitchToPickMode: this.canSwitchToPickMode,
            canSwitchToKeyMode: this.canSwitchToKeyMode
        });
        
        this.pins = [];
        this.lockState = {
            tensionApplied: false,
            pinsSet: 0,
            currentPin: null
        };
        
        this.game = null;
        this.scene = null;
        
        // Initialize lock configuration module
        this.lockConfig = new LockConfiguration(this);
        
        // Initialize lock graphics module
        this.lockGraphics = new LockGraphics(this);
    }
    
    // Method to get the lock's pin configuration for key generation
    init() {
        super.init();
        
        // Customize the close button
        const closeBtn = document.getElementById('minigame-close');
        if (closeBtn) {
            closeBtn.textContent = '×';
            
            // Remove the default close action
            this._eventListeners = this._eventListeners.filter(listener => 
                !(listener.element === closeBtn && listener.eventType === 'click')
            );
            
            // Add custom action based on closeButtonAction parameter
            if (this.closeButtonAction === 'reset') {
                this.addEventListener(closeBtn, 'click', () => {
                    this.pinMgmt.resetAllPins();
                    this.keyInsertion.updateFeedback("Lock reset - try again");
                });
            } else {
                // Default close action
                this.addEventListener(closeBtn, 'click', () => {
                    this.complete(false);
                });
            }
        }
        
        // Customize the cancel button
        const cancelBtn = document.getElementById('minigame-cancel');
        if (cancelBtn) {
            cancelBtn.textContent = this.closeButtonText;
            
            // Remove the default cancel action
            this._eventListeners = this._eventListeners.filter(listener => 
                !(listener.element === cancelBtn && listener.eventType === 'click')
            );
            
            // Add custom action based on closeButtonAction parameter
            if (this.closeButtonAction === 'reset') {
                this.addEventListener(cancelBtn, 'click', () => {
                    this.pinMgmt.resetAllPins();
                    this.keyInsertion.updateFeedback("Lock reset - try again");
                });
            } else {
                // Default cancel action
                this.addEventListener(cancelBtn, 'click', () => {
                    this.complete(false);
                });
            }
        }
        
        this.headerElement.innerHTML = `
            <h3>Lockpicking</h3>
            <p>Apply tension and hold click on pins to lift them to the shear line</p>
        `;
        
        // Create the lockable item display section if item info is provided
        this.createLockableItemDisplay();
        
        this.setupPhaserGame();
    }
    
    createLockableItemDisplay() {
        // Create display for the locked item (door, chest, etc.)
        const itemName = this.params?.itemName || this.lockable || 'Locked Item';
        const itemImage = this.params?.itemImage || null;
        const itemObservations = this.params?.itemObservations || '';
        
        if (!itemImage) return; // Only create if image is provided
        
        // Create container for the item display
        const itemDisplayDiv = document.createElement('div');
        itemDisplayDiv.className = 'lockpicking-item-section';
        itemDisplayDiv.innerHTML = `
            <img src="${itemImage}" 
                 alt="${itemName}" 
                 class="lockpicking-item-image">
            <div class="lockpicking-item-info">
                <h4>${itemName}</h4>
                <p>${itemObservations}</p>
            </div>
        `;
        
        // Add mode switch button if applicable
        if (this.canSwitchToPickMode && this.keyMode) {
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                gap: 10px;
                margin-top: 10px;
                justify-content: center;
            `;
            
            const switchModeBtn = document.createElement('button');
            switchModeBtn.className = 'minigame-button';
            switchModeBtn.id = 'lockpicking-switch-mode-btn';
            switchModeBtn.innerHTML = '<img src="assets/objects/lockpick.png" alt="Lockpick" class="icon-large"> Switch to Lockpicking';
            switchModeBtn.onclick = () => this.toolMgr.switchToPickMode();
            
            buttonContainer.appendChild(switchModeBtn);
            itemDisplayDiv.appendChild(buttonContainer);
        } else if (this.canSwitchToKeyMode && !this.keyMode) {
            // Show switch to key mode button when in lockpicking mode
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                gap: 10px;
                margin-top: 10px;
                justify-content: center;
            `;
            
            const switchModeBtn = document.createElement('button');
            switchModeBtn.className = 'minigame-button';
            switchModeBtn.id = 'lockpicking-switch-to-keys-btn';
            switchModeBtn.innerHTML = '<img src="assets/objects/key.png" alt="Key" class="icon-large"> Switch to Key Mode';
            switchModeBtn.onclick = () => this.toolMgr.switchToKeyMode();
            
            buttonContainer.appendChild(switchModeBtn);
            itemDisplayDiv.appendChild(buttonContainer);
        }
        
        // Insert before the game container
        this.gameContainer.parentElement.insertBefore(itemDisplayDiv, this.gameContainer);
    }
    
    setupPhaserGame() {
        // Create a container for the Phaser game
        this.gameContainer.innerHTML = `
            <div class="phaser-game-container" id="phaser-game-container"></div>
        `;
        
        // Create feedback element in the minigame container
        this.feedback = document.createElement('div');
        this.feedback.className = 'lockpick-feedback';
        this.gameContainer.appendChild(this.feedback);
        
        console.log('Setting up Phaser game...');
        
        // Create a custom Phaser scene
        const self = this;
        class LockpickingScene extends Phaser.Scene {
            constructor() {
                super({ key: 'LockpickingScene' });
            }
            
            preload() {
                // Load sound effects
                this.load.audio('lockpick_binding', 'assets/sounds/lockpick_binding.mp3');
                this.load.audio('lockpick_click', 'assets/sounds/lockpick_click.mp3');
                this.load.audio('lockpick_overtension', 'assets/sounds/lockpick_overtension.mp3');
                this.load.audio('lockpick_reset', 'assets/sounds/lockpick_reset.mp3');
                this.load.audio('lockpick_set', 'assets/sounds/lockpick_set.mp3');
                this.load.audio('lockpick_success', 'assets/sounds/lockpick_success.mp3');
                this.load.audio('lockpick_tension', 'assets/sounds/lockpick_tension.mp3');
                this.load.audio('lockpick_wrong', 'assets/sounds/lockpick_wrong.mp3');
            }
            
            create() {
                console.log('Phaser scene create() called');
                // Store reference to the scene
                self.scene = this;
                
                // Initialize sound effects
                self.sounds.binding = this.sound.add('lockpick_binding');
                self.sounds.click = this.sound.add('lockpick_click');
                self.sounds.overtension = this.sound.add('lockpick_overtension');
                self.sounds.reset = this.sound.add('lockpick_reset');
                self.sounds.set = this.sound.add('lockpick_set');
                self.sounds.success = this.sound.add('lockpick_success');
                self.sounds.tension = this.sound.add('lockpick_tension');
                self.sounds.wrong = this.sound.add('lockpick_wrong');
                
                // Create game elements
                self.lockGraphics.createLockBackground();
                self.lockGraphics.createTensionWrench();
                self.pinMgmt.createPins();
                self.lockGraphics.createHookPick();
                self.pinMgmt.createShearLine();
                
                // Create key if in key mode and not skipping starting key
                if (self.keyMode && !self.skipStartingKey) {
                    self.keyOps.createKey();
                    self.toolMgr.hideLockpickingTools();
                    self.keyInsertion.updateFeedback("Click the key to insert it into the lock");
                } else if (self.keyMode && self.skipStartingKey) {
                    // Skip creating initial key, will show key selection instead
                    // But we still need to initialize keyData for the correct key
                    if (!self.keyData) {
                        self.keyDataGen.generateKeyDataFromPins();
                    }
                    self.toolMgr.hideLockpickingTools();
                    self.keyInsertion.updateFeedback("Select a key to begin");
                } else {
                    self.keyInsertion.updateFeedback("Apply tension first, then lift pins in binding order - only the binding pin can be set");
                }
                
                self.pinMgmt.setupInputHandlers();
                console.log('Phaser scene setup complete');
            }
            
            update() {
                if (self.update) {
                    self.update();
                }
            }
        }
        
        // Initialize Phaser game
        const config = {
            type: Phaser.AUTO,
            parent: 'phaser-game-container',
            width: 600,
            height: 400,
            backgroundColor: '#1a1a1a',
            scene: LockpickingScene,
            scale: {
                mode: Phaser.Scale.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH
            }
        };
        
        // Adjust canvas size for mobile to crop empty space
        if (window.innerWidth <= 768) {
            // Crop the viewport to focus on the lock area
            // Lock is positioned from x=100 to x=500, y=50 to y=350
            // So we can crop to roughly x=80 to x=520, y=30 to y=370
            const cropWidth = 510; // 520 - 80
            const cropHeight = 300; // 370 - 30
            
            // Calculate scale to fit the cropped area
            const containerWidth = document.getElementById('phaser-game-container').offsetWidth;
            const containerHeight = document.getElementById('phaser-game-container').offsetHeight;
            
            // Scale to fit the cropped area within the container
            const scaleX = containerWidth / cropWidth;
            const scaleY = containerHeight / cropHeight;
            const scale = Math.min(scaleX, scaleY);
            
            config.width = cropWidth;
            config.height = cropHeight;
            config.scale = {
                mode: Phaser.Scale.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH
            };
        }
        
        try {
            this.game = new Phaser.Game(config);
            this.scene = this.game.scene.getScene('LockpickingScene');
            console.log('Phaser game created, scene:', this.scene);
        } catch (error) {
            console.error('Error creating Phaser game:', error);
            this.keyInsertion.updateFeedback('Error loading Phaser game: ' + error.message);
        }
    }
    

    
    startWithKeySelection(inventoryKeys = null, correctKeyId = null) {
        // Start the minigame with key selection instead of a default key
        // inventoryKeys: array of keys from inventory (optional)
        // correctKeyId: ID of the correct key (optional)
        
        this.keySelectionMode = true; // Mark that we're in key selection mode
        
        if (inventoryKeys && inventoryKeys.length > 0) {
            // Use provided inventory keys
            this.keySelection.createKeysFromInventory(inventoryKeys, correctKeyId);
        } else {
            // Generate random keys for challenge
            this.keySelection.createKeysForChallenge(correctKeyId || 'challenge_key');
        }
    }
    
    // Example usage:
    // 
    // 1. For BreakEscape main game with inventory keys:
    // const playerKeys = [
    //     { id: 'office_key', cuts: [45, 67, 23, 89, 34], name: 'Office Key' },
    //     { id: 'basement_key', cuts: [12, 78, 56, 23, 90], name: 'Basement Key' },
    //     { id: 'shed_key', cuts: [67, 34, 89, 12, 45], name: 'Shed Key' }
    // ];
    // this.startWithKeySelection(playerKeys, 'office_key');
    //
    // 2. For challenge mode (like locksmith-forge.html):
    // this.startWithKeySelection(); // Generates 3 random keys, one correct
    //
    // 3. Skip starting key and go straight to selection:
    // const minigame = new LockpickingMinigamePhaser(container, {
    //     keyMode: true,
    //     skipStartingKey: true, // Don't create initial key
    //     lockId: 'office_door_lock'
    // });
    // minigame.startWithKeySelection(playerKeys, 'office_key');
    
    createKeySelectionUI(keys, correctKeyId = null) {
        // Create a UI for selecting between multiple keys
        // keys: array of key objects with id, cuts, and optional name properties
        // correctKeyId: ID of the correct key (if null, uses index 0 as fallback)
        // Shows 3 keys at a time with navigation buttons for more than 3 keys
        
        // Find the correct key index in the original array
        let correctKeyIndex = 0;
        if (correctKeyId) {
            correctKeyIndex = keys.findIndex(key => key.id === correctKeyId);
            if (correctKeyIndex === -1) {
                correctKeyIndex = 0; // Fallback to first key if ID not found
            }
        }
        
        // Remove any existing key from the scene before showing selection UI
        if (this.keyGroup) {
            this.keyGroup.destroy();
            this.keyGroup = null;
        }
        
        // Remove any existing click zone
        if (this.keyClickZone) {
            this.keyClickZone.destroy();
            this.keyClickZone = null;
        }
        
        // Reset pins to their original positions before showing key selection
        this.lockConfig.resetPinsToOriginalPositions();
        
        // Layout constants
        const keyWidth = 140;
        const keyHeight = 80;
        const spacing = 20;
        const padding = 20;
        const labelHeight = 30; // Space for key label below each key
        const keysPerPage = 3; // Always show 3 keys at a time
        const buttonWidth = 30;
        const buttonHeight = 30;
        const buttonSpacing = 10; // Space between button and keys
        
        // Calculate container dimensions (always 3 keys wide + buttons on sides with minimal spacing)
        // For 3 keys: [button] padding [key1] spacing [key2] spacing [key3] padding [button]
        const keysWidth = (keysPerPage - 1) * (keyWidth + spacing) + keyWidth; // 3 keys with spacing between them
        const containerWidth = keysWidth + (keys.length > keysPerPage ? buttonWidth * 2 + buttonSpacing * 2 + padding * 2 : padding * 2);
        const containerHeight = keyHeight + labelHeight + spacing + padding + 10; // +50 for title
        
        // Create container for key selection - positioned in the middle but below pins
        const keySelectionContainer = this.scene.add.container(0, 230);
        keySelectionContainer.setDepth(1000); // High z-index to appear above everything
        
        // Add background
        const background = this.scene.add.graphics();
        background.fillStyle(0x000000, 0.8);
        background.fillRect(0, 0, containerWidth, containerHeight);
        background.lineStyle(2, 0xffffff);
        background.strokeRect(0, 0, containerWidth - 1, containerHeight - 1);
        keySelectionContainer.add(background);
        
        // Add title
        const titleX = containerWidth / 2;
        const title = this.scene.add.text(titleX, 15, 'Select the correct key', {
            fontSize: '24px',
            fill: '#ffffff',
            fontFamily: 'VT323',
        });
        title.setOrigin(0.5, 0);
        keySelectionContainer.add(title);
        
        // Track current page
        let currentPage = 0;
        const totalPages = Math.ceil(keys.length / keysPerPage);
        
        // Create navigation buttons if more than 3 keys
        let prevButton = null;
        let nextButton = null;
        let prevText = null;
        let nextText = null;
        let pageIndicator = null;
        let itemsToRemoveNext = null; // Track items for cleanup
        
        // Create a function to render the current page of keys
        const renderKeyPage = () => {
            // Remove any existing key visuals and labels from the previous page
            const itemsToRemove = [];
            keySelectionContainer.list.forEach(item => {
                if (item !== background && item !== title && item !== prevButton && item !== nextButton && item !== pageIndicator && item !== prevText && item !== nextText) {
                    itemsToRemove.push(item);
                }
            });
            itemsToRemove.forEach(item => item.destroy());
            
            // Calculate which keys to show on this page
            const startIndex = currentPage * keysPerPage;
            const endIndex = Math.min(startIndex + keysPerPage, keys.length);
            const pageKeys = keys.slice(startIndex, endIndex);
            
            // Display keys for this page
            // Position: [button] buttonSpacing [keys] buttonSpacing [button]
            const keysStartX = (keys.length > keysPerPage ? buttonWidth + buttonSpacing : padding);
            const startX = keysStartX + padding / 2;
            const startY = 50;
            
            pageKeys.forEach((keyData, pageIndex) => {
                const actualIndex = startIndex + pageIndex;
                const keyX = startX + pageIndex * (keyWidth + spacing);
                const keyY = startY;
                
                // Create key visual representation
                const keyVisual = this.keyOps.createKeyVisual(keyData, keyWidth, keyHeight);
                keyVisual.setPosition(keyX, keyY);
                keySelectionContainer.add(keyVisual);
                
                // Make key clickable
                keyVisual.setInteractive(new Phaser.Geom.Rectangle(0, 0, keyWidth, keyHeight), Phaser.Geom.Rectangle.Contains);
                keyVisual.on('pointerdown', () => {
                    // Close the popup
                    keySelectionContainer.destroy();
                    // Trigger key selection and insertion
                    this.keyOps.selectKey(actualIndex, correctKeyIndex, keyData);
                });
                
                // Add key label (use name if available, otherwise use number)
                const keyName = keyData.name || `Key ${actualIndex + 1}`;
                const keyLabel = this.scene.add.text(keyX + keyWidth/2, keyY + keyHeight + 5, keyName, {
                    fontSize: '16px',
                    fill: '#ffffff',
                    fontFamily: 'VT323'
                });
                keyLabel.setOrigin(0.5, 0);
                keySelectionContainer.add(keyLabel);
            });
            
            // Update page indicator
            if (pageIndicator) {
                pageIndicator.setText(`${currentPage + 1}/${totalPages}`);
            }
            
            // Update button visibility
            if (prevButton) {
                if (currentPage > 0) {
                    prevButton.setVisible(true);
                    prevText.setVisible(true);
                } else {
                    prevButton.setVisible(false);
                    prevText.setVisible(false);
                }
            }
            
            if (nextButton) {
                if (currentPage < totalPages - 1) {
                    nextButton.setVisible(true);
                    nextText.setVisible(true);
                } else {
                    nextButton.setVisible(false);
                    nextText.setVisible(false);
                }
            }
        };
        
        if (keys.length > keysPerPage) {
            // Position buttons on the sides of the keys, vertically centered
            const keysAreaCenterY = 50 + (keyHeight + labelHeight) / 2;
            
            // Previous button (left side)
            prevButton = this.scene.add.graphics();
            prevButton.fillStyle(0x444444);
            prevButton.fillRect(0, 0, buttonWidth, buttonHeight);
            prevButton.lineStyle(2, 0xffffff);
            prevButton.strokeRect(0, 0, buttonWidth, buttonHeight);
            prevButton.setInteractive(new Phaser.Geom.Rectangle(0, 0, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);
            prevButton.on('pointerdown', () => {
                if (currentPage > 0) {
                    currentPage--;
                    renderKeyPage();
                }
            });
            prevButton.setPosition(padding / 2, keysAreaCenterY - buttonHeight / 2);
            prevButton.setDepth(1001);
            prevButton.setVisible(false); // Initially hidden
            keySelectionContainer.add(prevButton);
            
            // Previous button text
            prevText = this.scene.add.text(padding / 2 + buttonWidth / 2, keysAreaCenterY, '‹', {
                fontSize: '20px',
                fill: '#ffffff',
                fontFamily: 'VT323'
            });
            prevText.setOrigin(0.5, 0.5);
            prevText.setDepth(1002);
            prevText.setVisible(false); // Initially hidden
            keySelectionContainer.add(prevText);
            
            // Next button (right side)
            nextButton = this.scene.add.graphics();
            nextButton.fillStyle(0x444444);
            nextButton.fillRect(0, 0, buttonWidth, buttonHeight);
            nextButton.lineStyle(2, 0xffffff);
            nextButton.strokeRect(0, 0, buttonWidth, buttonHeight);
            nextButton.setInteractive(new Phaser.Geom.Rectangle(0, 0, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);
            nextButton.on('pointerdown', () => {
                if (currentPage < totalPages - 1) {
                    currentPage++;
                    renderKeyPage();
                }
            });
            nextButton.setPosition(containerWidth - padding / 2 - buttonWidth, keysAreaCenterY - buttonHeight / 2);
            nextButton.setDepth(1001);
            nextButton.setVisible(false); // Initially hidden
            keySelectionContainer.add(nextButton);
            
            // Next button text
            nextText = this.scene.add.text(containerWidth - padding / 2 - buttonWidth / 2, keysAreaCenterY, '›', {
                fontSize: '20px',
                fill: '#ffffff',
                fontFamily: 'VT323'
            });
            nextText.setOrigin(0.5, 0.5);
            nextText.setDepth(1002);
            nextText.setVisible(false); // Initially hidden
            keySelectionContainer.add(nextText);
            
            // Page indicator - centered below all keys
            pageIndicator = this.scene.add.text(containerWidth / 2, containerHeight - 20, `1/${totalPages}`, {
                fontSize: '12px',
                fill: '#888888',
                fontFamily: 'VT323'
            });
            pageIndicator.setOrigin(0.5, 0.5);
            keySelectionContainer.add(pageIndicator);
        }
        
        // Render the first page
        renderKeyPage();
        
        this.keySelectionContainer = keySelectionContainer;
    }
    
    drawCircleAsPolygon(graphics, centerX, centerY, radius) {
        // Draw a circle as a polygon path to match the blade drawing method
        const path = new Phaser.Geom.Polygon();
        
        // Create circle points
        const segments = 32; // Number of segments for smooth circle
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            path.points.push(new Phaser.Geom.Point(x, y));
        }
        
        // Draw the circle as a polygon
        graphics.fillPoints(path.points, true, true);
    }
    
    createKeyBladeCollision() {
        // Method moved to KeyOperations module - call via this.keyOps.createKeyBladeCollision()
        this.keyOps.createKeyBladeCollision();
    }
    
    update() {
        // Skip normal lockpicking logic if in key mode
        if (this.keyMode) {
            return;
        }
        
        if (this.lockState.currentPin && this.gameState.mouseDown) {
            this.pinMgmt.liftPin();
        }
        
        // Apply gravity when tension is not applied (but not when actively lifting)
        if (!this.lockState.tensionApplied && !this.gameState.mouseDown) {
            this.pinMgmt.applyGravity();
        }
        
        // Apply gravity to non-binding pins even with tension
        if (this.lockState.tensionApplied && !this.gameState.mouseDown) {
            this.pinMgmt.applyGravity();
        }
        
        // Check if all pins are correctly positioned when tension is applied
        if (this.lockState.tensionApplied) {
            this.pinMgmt.checkAllPinsCorrect();
        }
        
        // Hook return is now handled directly in pointerup event
    }
    
    complete(success) {
        if (this.game) {
            this.game.destroy(true);
            this.game = null;
        }
        super.complete(success, this.gameResult);
    }
    
} 