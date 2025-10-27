import { MinigameScene } from '../framework/base-minigame.js';
import { LockConfiguration } from './lock-configuration.js';
import { LockGraphics } from './lock-graphics.js';

// Phaser Lockpicking Minigame Scene implementation
export class LockpickingMinigamePhaser extends MinigameScene {
    constructor(container, params) {
        super(container, params);
        
        // Ensure params is an object
        params = params || {};
        
        console.log('DEBUG: Lockpicking minigame constructor received params:', params);
        console.log('DEBUG: predefinedPinHeights from params:', params.predefinedPinHeights);
        
        this.lockable = params.lockable || 'default-lock';
        this.lockId = params.lockId || 'default_lock';
        this.difficulty = params.difficulty || 'medium';
        // Use passed pinCount if provided, otherwise calculate based on difficulty
        this.pinCount = params.pinCount || (this.difficulty === 'easy' ? 3 : this.difficulty === 'medium' ? 4 : 5);
        
        // Initialize global lock storage if it doesn't exist
        if (!window.lockConfigurations) {
            window.lockConfigurations = {};
        }
        
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
                    this.resetAllPins();
                    this.updateFeedback("Lock reset - try again");
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
                    this.resetAllPins();
                    this.updateFeedback("Lock reset - try again");
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
            switchModeBtn.onclick = () => this.switchToPickMode();
            
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
            switchModeBtn.onclick = () => this.switchToKeyMode();
            
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
                self.createPins();
                self.lockGraphics.createHookPick();
                self.createShearLine();
                
                // Create key if in key mode and not skipping starting key
                if (self.keyMode && !self.skipStartingKey) {
                    self.createKey();
                    self.hideLockpickingTools();
                    self.updateFeedback("Click the key to insert it into the lock");
                } else if (self.keyMode && self.skipStartingKey) {
                    // Skip creating initial key, will show key selection instead
                    // But we still need to initialize keyData for the correct key
                    if (!self.keyData) {
                        self.generateKeyDataFromPins();
                    }
                    self.hideLockpickingTools();
                    self.updateFeedback("Select a key to begin");
                } else {
                    self.updateFeedback("Apply tension first, then lift pins in binding order - only the binding pin can be set");
                }
                
                self.setupInputHandlers();
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
            this.updateFeedback('Error loading Phaser game: ' + error.message);
        }
    }
    

    
        generateKeyDataFromPins() {
        // Generate key cuts based on actual pin heights
        // Calculate cut depths so that when key is inserted, pins align at shear line
        const cuts = [];
        const shearLineY = -45; // Shear line position (in pin container coordinates)
        const keyBladeHeight = 110; // Key blade height (from keyConfig)
        const pinContainerY = 200; // Pin container Y position (world coordinates)
        
        for (let i = 0; i < this.pinCount; i++) {
            const pin = this.pins[i];
            const keyPinLength = pin.keyPinLength;
            
            // Simple key cut calculation:
            // The cut depth should be the key pin length minus the gap from key blade top to shear line
            
            // Key blade is centered in keyway: keywayStartY + keywayHeight/2 = 170 + 60 = 230
            // Key blade top is: 230 - keyBladeHeight/2 = 230 - 55 = 175
            // Shear line is at y=155 in world coordinates (200 - 45)
            const keyBladeTop_world = 175; // 170 + 60 - 55 (keywayStartY + keywayHeight/2 - keyBladeHeight/2)
            const shearLine_world = 155; // 200 - 45 (pin container Y - shear line Y)
            const gapFromKeyBladeTopToShearLine = keyBladeTop_world - shearLine_world; // 175 - 155 = 20
            
            // Cut depth = key pin length - gap from key blade top to shear line
            const cutDepth_needed = keyPinLength - gapFromKeyBladeTopToShearLine;
            
            // Clamp to valid range (0 to key blade height)
            const clampedCutDepth = Math.max(0, Math.min(keyBladeHeight, cutDepth_needed));
            
            console.log(`=== KEY CUT ${i} GENERATION ===`);
            console.log(`  Pin properties: keyPinLength=${keyPinLength}, driverPinLength=${pin.driverPinLength}`);
            console.log(`  Key blade top: ${keyBladeTop_world}, shear line: ${shearLine_world}`);
            console.log(`  Gap from key blade top to shear line: ${gapFromKeyBladeTopToShearLine}`);
            console.log(`  Cut calculation: cutDepth_needed=${cutDepth_needed} (${keyPinLength} - ${gapFromKeyBladeTopToShearLine})`);
            console.log(`  Final cut: cutDepth=${clampedCutDepth}px (max ${keyBladeHeight}px)`);
            console.log(`=====================================`);
            
            cuts.push(clampedCutDepth);
        }
        
        this.keyData = { cuts: cuts };
        console.log('Generated key data from pins:', this.keyData);
    }
    
    createKeyFromPinSizes(pinSizes) {
        // Create a complete key object based on a set of pin sizes
        // pinSizes: array of numbers representing the depth of each cut (0-100)
        
        const keyConfig = {
            pinCount: pinSizes.length,
            cuts: pinSizes,
            // Standard key dimensions
            circleRadius: 20,
            shoulderWidth: 30,
            shoulderHeight: 130,
            bladeWidth: 420,
            bladeHeight: 110,
            keywayStartX: 100,
            keywayStartY: 170,
            keywayWidth: 400,
            keywayHeight: 120
        };
        
        return keyConfig;
    }
    
    generateRandomKey(pinCount = 5) {
        // Generate a random key with the specified number of pins
        const cuts = [];
        for (let i = 0; i < pinCount; i++) {
            // Generate random cut depth between 20-80 (avoiding extremes)
            cuts.push(Math.floor(Math.random() * 60) + 20);
        }
        return { 
            id: `random_key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            cuts,
            name: `Random Key`,
            pinCount: pinCount
        };
    }
    
    createKeysFromInventory(inventoryKeys, correctKeyId) {
        // Create key selection from inventory keys
        // inventoryKeys: array of key objects from player inventory
        // correctKeyId: ID of the key that should work with this lock
        
        // Filter keys to only include those with cuts data
        const validKeys = inventoryKeys.filter(key => key.cuts && Array.isArray(key.cuts));
        
        if (validKeys.length === 0) {
            // No valid keys in inventory, generate random ones
            const key1 = this.generateRandomKey(this.pinCount);
            const key2 = this.generateRandomKey(this.pinCount);
            const key3 = this.generateRandomKey(this.pinCount);
            
            // Make the first key correct
            key1.cuts = this.keyData.cuts;
            key1.id = correctKeyId || 'correct_key';
            key1.name = 'Correct Key';
            
            // Randomize the order
            const keys = [key1, key2, key3];
            this.shuffleArray(keys);
            
            return this.createKeySelectionUI(keys, correctKeyId);
        }
        
        // Use inventory keys and randomize their order
        const shuffledKeys = [...validKeys];
        this.shuffleArray(shuffledKeys);
        
        return this.createKeySelectionUI(shuffledKeys, correctKeyId);
    }
    
    createKeysForChallenge(correctKeyId = 'challenge_key') {
        // Create keys for challenge mode (like locksmith-forge.html)
        // Generates 3 keys with one guaranteed correct key
        
        const key1 = this.generateRandomKey(this.pinCount);
        const key2 = this.generateRandomKey(this.pinCount);
        const key3 = this.generateRandomKey(this.pinCount);
        
        // Make the first key correct by copying the actual key cuts
        key1.cuts = this.keyData.cuts;
        key1.id = correctKeyId;
        key1.name = 'Correct Key';
        
        // Give other keys descriptive names
        key2.name = 'Wrong Key 1';
        key3.name = 'Wrong Key 2';
        
        // Randomize the order of keys
        const keys = [key1, key2, key3];
        this.shuffleArray(keys);
        
        // Find the new index of the correct key after shuffling
        const correctKeyIndex = keys.findIndex(key => key.id === correctKeyId);
        
        return this.createKeySelectionUI(keys, correctKeyId);
    }
    
    startWithKeySelection(inventoryKeys = null, correctKeyId = null) {
        // Start the minigame with key selection instead of a default key
        // inventoryKeys: array of keys from inventory (optional)
        // correctKeyId: ID of the correct key (optional)
        
        this.keySelectionMode = true; // Mark that we're in key selection mode
        
        if (inventoryKeys && inventoryKeys.length > 0) {
            // Use provided inventory keys
            this.createKeysFromInventory(inventoryKeys, correctKeyId);
        } else {
            // Generate random keys for challenge
            this.createKeysForChallenge(correctKeyId || 'challenge_key');
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
        
        // Find the correct key index
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
        
        // Create container for key selection - positioned in the middle but below pins
        const keySelectionContainer = this.scene.add.container(0, 230);
        keySelectionContainer.setDepth(1000); // High z-index to appear above everything
        
        // Add background
        const background = this.scene.add.graphics();
        background.fillStyle(0x000000, 0.8);
        background.fillRect(0, 0, 700, 180);
        background.lineStyle(2, 0xffffff);
        background.strokeRect(0, 0, 600, 170);
        keySelectionContainer.add(background);
        
        // Add title
        const title = this.scene.add.text(300, 15, 'Select the correct key', {
            fontSize: '24px',
            fill: '#ffffff',
            fontFamily: 'VT323',
        });
        title.setOrigin(0.5, 0);
        keySelectionContainer.add(title);
        
        // Create key options
        const keyWidth = 140;
        const keyHeight = 80;
        const spacing = 20;
        const startX = 50;
        const startY = 50;
        
        keys.forEach((keyData, index) => {
            const keyX = startX + index * (keyWidth + spacing);
            const keyY = startY;
            
            // Create key visual representation
            const keyVisual = this.createKeyVisual(keyData, keyWidth, keyHeight);
            keyVisual.setPosition(keyX, keyY);
            keySelectionContainer.add(keyVisual);
            
            // Make key clickable
            keyVisual.setInteractive(new Phaser.Geom.Rectangle(0, 0, keyWidth, keyHeight), Phaser.Geom.Rectangle.Contains);
            keyVisual.on('pointerdown', () => {
                // Close the popup
                keySelectionContainer.destroy();
                // Trigger key selection and insertion
                this.selectKey(index, correctKeyIndex, keyData);
            });
            
            // Add key label (use name if available, otherwise use number)
            const keyName = keyData.name || `Key ${index + 1}`;
            const keyLabel = this.scene.add.text(keyX + keyWidth/2, keyY + keyHeight + 5, keyName, {
                fontSize: '16px',
                fill: '#ffffff',
                fontFamily: 'VT323'
            });
            keyLabel.setOrigin(0.5, 0);
            keySelectionContainer.add(keyLabel);
        });
        
        this.keySelectionContainer = keySelectionContainer;
    }
    
    createKeyVisual(keyData, width, height) {
        // Create a visual representation of a key for the selection UI by building the actual key and scaling it down
        const keyContainer = this.scene.add.container(0, 0);
        
        // Temporarily set the key data to create the key
        const originalKeyData = this.keyData;
        this.keyData = keyData;
        
        // Create the key using the same method as the main key
        this.createKey();
        
        // Get the key group and scale it down
        const keyGroup = this.keyGroup;
        if (keyGroup) {
            // Calculate scale to fit within the selection area
            const maxWidth = width - 20; // Leave 10px margin on each side
            const maxHeight = height - 20;
            
            // Get the key's current dimensions
            const keyBounds = keyGroup.getBounds();
            const keyWidth = keyBounds.width;
            const keyHeight = keyBounds.height;
            
            // Calculate scale
            const scaleX = maxWidth / keyWidth;
            const scaleY = maxHeight / keyHeight;
            const scale = Math.min(scaleX, scaleY) * 0.9; // Use 90% to leave some margin
            
            // Scale the key group
            keyGroup.setScale(scale);
            
            // Center the key in the selection area
            const scaledWidth = keyWidth * scale;
            const scaledHeight = keyHeight * scale;
            const offsetX = (width - scaledWidth) / 2;
            const offsetY = (height - scaledHeight) / 2;
            
            // Position the key
            keyGroup.setPosition(offsetX, offsetY);
            
            // Add the key group to the container
            keyContainer.add(keyGroup);
        }
        
        // Restore the original key data
        this.keyData = originalKeyData;
        
        return keyContainer;
    }
    

    
    selectKey(selectedIndex, correctIndex, keyData) {
        // Handle key selection from the UI
        console.log(`Key ${selectedIndex + 1} selected (correct: ${correctIndex + 1})`);
        
        // Close the popup immediately
        if (this.keySelectionContainer) {
            this.keySelectionContainer.destroy();
        }
        
        // Remove any existing key from the scene
        if (this.keyGroup) {
            this.keyGroup.destroy();
            this.keyGroup = null;
        }
        
        // Remove any existing click zone
        if (this.keyClickZone) {
            this.keyClickZone.destroy();
            this.keyClickZone = null;
        }
        
        // Reset pins to their original positions before creating the new key
        this.lockConfig.resetPinsToOriginalPositions();
        
        // Store the original correct key data (this determines if the key is correct)
        const originalKeyData = this.keyData;
        
        // Store the selected key data for visual purposes
        this.selectedKeyData = keyData;
        
        // Create the visual key with the selected key data
        this.keyData = keyData;
        this.pinCount = keyData.pinCount;
        this.createKey();
        
        // Restore the original key data for correctness checking
        this.keyData = originalKeyData;
        
        // Update feedback - don't reveal if correct/wrong yet
        this.updateFeedback("Key selected! Inserting into lock...");
        
        // Automatically trigger key insertion after a short delay
        setTimeout(() => {
            this.startKeyInsertion();
        }, 300); // Small delay to let the key appear first
        
        // Update feedback if available
        if (this.selectKeyCallback) {
            this.selectKeyCallback(selectedIndex, correctIndex, keyData);
        }
    }
    
    showWrongKeyFeedback() {
        // Show visual feedback for wrong key selection
        const feedback = this.scene.add.graphics();
        feedback.fillStyle(0xff0000, 0.3);
        feedback.fillRect(0, 0, 800, 600);
        feedback.setDepth(9999);
        
        // Remove feedback after a short delay
        this.scene.time.delayedCall(500, () => {
            feedback.destroy();
        });
    }
    
    flashLockRed() {
        // Flash the entire lock area red to indicate wrong key
        const flash = this.scene.add.graphics();
        flash.fillStyle(0xff0000, 0.4); // Red with 40% opacity
        flash.fillRect(100, 50, 400, 300); // Cover the entire lock area
        flash.setDepth(9998); // High z-index but below other UI elements
        
        // Remove flash after a short delay
        this.scene.time.delayedCall(800, () => {
            flash.destroy();
        });
    }
    
    createKey() {
        if (!this.keyMode) return;
        
        // Generate key data from actual pin heights if not provided
        if (!this.keyData) {
            this.generateKeyDataFromPins();
        }

        // Key dimensions - make keyway higher so key pins align at shear line
        const keywayWidth = 400; // Width of the keyway
        const keywayHeight = 120; // Increased height to accommodate key cuts
        const keywayStartX = 100; // Left edge of keyway
        const keywayStartY = 170; // Moved higher (was 200) so key pins align at shear line
        
        // Key parts dimensions
        const keyCircleRadius = 140; // Circle (handle) - 2x larger (was 15)
        const keyShoulderWidth = 20; // Shoulder width (short)
        const keyShoulderHeight = keywayHeight + 10; // Slightly taller than keyway
        const keyBladeWidth = keywayWidth + 20; // Blade length (reaches end of keyway)
        const keyBladeHeight = keywayHeight - 10; // Slightly smaller than keyway
        
        // Key starting position (just outside the keyway to the LEFT) - ready to be inserted
        // Account for full key length: circle + shoulder + blade
        const fullKeyLength = keyCircleRadius * 2 + keyShoulderWidth + keyBladeWidth;
        const keyStartX = keywayStartX - fullKeyLength + 20; // Just the blade tip visible at keyway entrance
        const keyStartY = keywayStartY + keywayHeight / 2; // Centered in keyway
        
        // Create key container
        this.keyGroup = this.scene.add.container(keyStartX, keyStartY);
        
        // Create render texture for the key - make it wider to accommodate the full circle
        const renderTextureWidth = Math.max(fullKeyLength, keyCircleRadius * 2 + 50); // Ensure enough space for circle
        this.keyRenderTexture = this.scene.add.renderTexture(0, 0, renderTextureWidth, keyShoulderHeight);
        this.keyRenderTexture.setOrigin(0, 0.5);
        
        // Draw the key using render texture
        this.drawKeyWithRenderTexture(keyCircleRadius, keyShoulderWidth, keyShoulderHeight, keyBladeWidth, keyBladeHeight, fullKeyLength);
        
        // Test: Draw a simple circle to see if render texture works
        const testGraphics = this.scene.add.graphics();
        testGraphics.fillStyle(0x00ff00); // Green
        testGraphics.fillCircle(50, 50, 30);
        this.keyRenderTexture.draw(testGraphics);
        testGraphics.destroy();
        
        // Test: Draw circle directly to scene to see if it's a render texture issue
        const directCircle = this.scene.add.graphics();
        directCircle.fillStyle(0xffff00); // Yellow
        directCircle.fillCircle(keyStartX + 100, keyStartY, 50);
        directCircle.setDepth(1000); // High z-index to be visible
        
        this.keyGroup.add(this.keyRenderTexture);
        
        // Set key graphics to low z-index so it appears behind pins
        this.keyGroup.setDepth(1); // Set low z-index so key appears behind pins
        
        // Create click zone covering the entire keyway area in key mode
        // Position click zone to cover the entire keyway from left edge to right edge
        const keywayClickWidth = 400; // Full keyway width
        const keywayClickHeight = 120; // Full keyway height
        const clickZone = this.scene.add.rectangle(0, 0, 
            keywayClickWidth, keywayClickHeight, 0x000000, 0);
        clickZone.setDepth(9999); // Very high z-index for clickability
        clickZone.setInteractive();
        
        // Position click zone to cover the entire keyway area (not relative to key group)
        clickZone.x = 100; // Keyway start X
        clickZone.y = 170 + keywayClickHeight/2; // Keyway center Y
        this.keyClickZone = clickZone;
        
        // Add click handler for key insertion
        clickZone.on('pointerdown', () => {
            if (!this.keyInserting) {
                // Hide labels on first key click (similar to pin clicks)
                if (!this.pinClicked) {
                    this.pinClicked = true;
                }
                this.startKeyInsertion();
            }
        });
        
        console.log('Key click zone created:', { 
            width: keywayClickWidth, 
            height: keyShoulderHeight,
            position: '0,0 relative to key group'
        });
        
        // Store key configuration
        this.keyConfig = {
            startX: keyStartX,
            startY: keyStartY,
            circleRadius: keyCircleRadius,
            shoulderWidth: keyShoulderWidth,
            shoulderHeight: keyShoulderHeight,
            bladeWidth: keyBladeWidth,
            bladeHeight: keyBladeHeight,
            keywayStartX: keywayStartX,
            keywayStartY: keywayStartY,
            keywayWidth: keywayWidth,
            keywayHeight: keywayHeight
        };
        
        // Create collision rectangles for the key blade surface (after config is set)
        this.createKeyBladeCollision();
        
        console.log('Key created with config:', this.keyConfig);
    }
    
    drawKeyWithRenderTexture(circleRadius, shoulderWidth, shoulderHeight, bladeWidth, bladeHeight, fullKeyLength) {
        console.log('drawKeyWithRenderTexture called with:', {
            hasKeyData: !!this.keyData,
            hasCuts: !!(this.keyData && this.keyData.cuts),
            keyData: this.keyData
        });
        
        if (!this.keyData || !this.keyData.cuts) {
            console.log('Early return - missing key data or cuts');
            return;
        }
        
        // Create temporary graphics for drawing to render texture
        const tempGraphics = this.scene.add.graphics();
        tempGraphics.fillStyle(0xcccccc); // Silver color for key
        
        // Calculate positions
        const circleX = circleRadius; // Circle center
        const shoulderX = circleRadius * 1.9; // After circle
        const bladeX = shoulderX + shoulderWidth; // After shoulder
        
        console.log('Drawing key handle:', {
            circleX: circleX,
            circleY: shoulderHeight/2,
            circleRadius: circleRadius,
            shoulderHeight: shoulderHeight,
            renderTextureWidth: this.keyRenderTexture.width
        });
        
        // 1. Draw the circle (handle) - rightmost part as a separate object
        const handleGraphics = this.scene.add.graphics();
        handleGraphics.fillStyle(0xcccccc); // Silver color for key
        handleGraphics.fillCircle(circleX, 0, circleRadius); // Center at y=0 relative to key group
        
        // Add handle to the key group
        this.keyGroup.add(handleGraphics);
        
        // 2. Draw the shoulder - rectangle
        tempGraphics.fillRect(shoulderX, 0, shoulderWidth, shoulderHeight);
        
        // 3. Draw the blade with cuts as a solid shape
        this.drawKeyBladeAsSolidShape(tempGraphics, bladeX, shoulderHeight/2 - bladeHeight/2, bladeWidth, bladeHeight);
        
        // Draw the graphics to the render texture (shoulder and blade only)
        this.keyRenderTexture.draw(tempGraphics);
        
        // Clean up temporary graphics
        tempGraphics.destroy();
    }
    
    drawKeyBladeAsSolidShape(graphics, bladeX, bladeY, bladeWidth, bladeHeight) {
        // Draw the key blade as a solid shape with cuts removed
        // The blade has a pattern like: \_/\_/\_/\_/\ where the cuts _ are based on pin depths

        // ASCII art of the key blade:
        //  _________
        // /         \ ____   
        // |          | |  \_/\_/\_/\_/\
        // |          |_|______________/
        //  \________/ 
        
        
        
        const cutWidth = 24; // Width of each cut (same as pin width)
        
        // Calculate pin spacing to match the lock's pin positions
        const pinSpacing = 400 / (this.pinCount + 1);
        const margin = pinSpacing * 0.75;
        
        // Start with the base blade rectangle
        const baseBladeRect = {
            x: bladeX,
            y: bladeY,
            width: bladeWidth,
            height: bladeHeight
        };
        
        // Create a path for the solid key blade
        const path = new Phaser.Geom.Polygon();
        
        // Start at the top-left corner of the blade
        path.points.push(new Phaser.Geom.Point(bladeX, bladeY));
        
        // Draw the top edge with cuts and ridges
        let currentX = bladeX;
        
        // For each pin position, create the blade profile
        for (let i = 0; i <= this.pinCount; i++) {
            let cutDepth = 0;
            let nextCutDepth = 0;
            
            if (i < this.pinCount) {
                cutDepth = this.keyData.cuts[i] || 0;
            }
            if (i < this.pinCount - 1) {
                nextCutDepth = this.keyData.cuts[i + 1] || 0;
            }
            
            // Calculate pin position
            const pinX = 100 + margin + i * pinSpacing;
            const cutX = bladeX + (pinX - 100);
            
            if (i === 0) {
                // First section: from left edge (shoulder) to first cut
                const firstCutStartX = cutX - cutWidth/2;
                
                // Draw triangular peak from shoulder to first cut edge (touches exact edge of cut)
                this.addFirstCutPeakToPath(path, currentX, bladeY, firstCutStartX, bladeY, 0, cutDepth);
                currentX = firstCutStartX;
            }
            
            if (i < this.pinCount) {
                // Draw the cut (negative space - skip this section)
                const cutStartX = cutX - cutWidth/2;
                const cutEndX = cutX + cutWidth/2;
                
                // Move to the bottom of the cut
                path.points.push(new Phaser.Geom.Point(cutStartX, bladeY + cutDepth));
                
                // Draw the cut bottom
                path.points.push(new Phaser.Geom.Point(cutEndX, bladeY + cutDepth));
                
                currentX = cutEndX;
            }
            
            if (i < this.pinCount - 1) {
                // Draw triangular peak to next cut
                const nextPinX = 100 + margin + (i + 1) * pinSpacing;
                const nextCutX = bladeX + (nextPinX - 100);
                const nextCutStartX = nextCutX - cutWidth/2;
                
                // Use triangular peak that goes up at 45 degrees to halfway, then down at 45 degrees
                this.addTriangularPeakToPath(path, currentX, bladeY, nextCutStartX, bladeY, cutDepth, nextCutDepth);
                currentX = nextCutStartX;
            } else if (i === this.pinCount - 1) {
                // Last section: from last cut to right edge - create pointed tip that extends forward
                const keyRightEdge = bladeX + bladeWidth;
                const tipExtension = 12; // How far the tip extends beyond the blade
                const tipEndX = keyRightEdge + tipExtension;
                
                // First: draw triangular peak from last cut back up to blade top
                const peakX = currentX + (keyRightEdge - currentX) * 0.3; // Peak at 30% of the way
                this.addTriangularPeakToPath(path, currentX, bladeY, peakX, bladeY, cutDepth, 0);
                
                // Second: draw the pointed tip that extends forward from top and bottom
                this.addPointedTipToPath(path, peakX, bladeY, tipEndX, bladeHeight);
                currentX = tipEndX;
            }
        }
        
        // Complete the path: right edge, bottom edge, left edge
        path.points.push(new Phaser.Geom.Point(bladeX + bladeWidth, bladeY + bladeHeight));
        path.points.push(new Phaser.Geom.Point(bladeX, bladeY + bladeHeight));
        path.points.push(new Phaser.Geom.Point(bladeX, bladeY));
        
        // Draw the solid shape
        graphics.fillPoints(path.points, true, true);
    }
    
    addTriangularSectionToPath(path, startX, startY, endX, endY, cutDepth, isLeftTriangle) {
        // Add a triangular section to the path
        // This creates the sloping effect between cuts
        
        const width = Math.abs(endX - startX);
        const stepSize = 4; // Consistent pixel size for steps
        const steps = Math.max(1, Math.floor(width / stepSize));
        
        for (let i = 0; i <= steps; i++) {
            const progress = i / steps;
            const x = startX + (endX - startX) * progress;
            
            let y;
            if (isLeftTriangle) {
                // Left triangle: height increases as we move toward the cut
                y = startY + (cutDepth * progress);
            } else {
                // Right triangle: height decreases as we move away from the cut
                y = startY + (cutDepth * (1 - progress));
            }
            
            path.points.push(new Phaser.Geom.Point(x, y));
        }
    }
    
    addFirstCutPeakToPath(path, startX, startY, endX, endY, startCutDepth, endCutDepth) {
        // Add a triangular peak from shoulder to first cut that touches the exact edge of the cut
        // This ensures proper alignment without affecting other peaks
        
        const width = Math.abs(endX - startX);
        const stepSize = 4; // Consistent pixel size for steps
        const steps = Math.max(1, Math.floor(width / stepSize));
        const halfSteps = Math.floor(steps / 2);
        
        for (let i = 0; i <= steps; i++) {
            const progress = i / steps;
            const x = startX + (endX - startX) * progress;
            
            let y;
            if (i <= halfSteps) {
                // First half: slope up from start cut depth to peak (blade top)
                const upProgress = i / halfSteps;
                y = startY + startCutDepth - (startCutDepth * upProgress); // Slope up to blade top
            } else {
                // Second half: slope down from peak to end cut depth
                const downProgress = (i - halfSteps) / halfSteps;
                y = startY + (endCutDepth * downProgress); // Slope down from blade top
            }
            
            // Ensure the final point connects to the exact cut edge coordinates
            if (i === steps) {
                // Connect directly to the cut edge at the calculated depth
                y = startY + endCutDepth;
            }
            
            path.points.push(new Phaser.Geom.Point(x, y));
        }
    }
    
    addTriangularPeakToPath(path, startX, startY, endX, endY, startCutDepth, endCutDepth) {
        // Add a triangular peak between cuts that goes up at 45 degrees to halfway, then down at 45 degrees
        // This creates a more realistic key blade profile with proper peaks between cuts
        
        const width = Math.abs(endX - startX);
        const stepSize = 4; // Consistent pixel size for steps
        const steps = Math.max(1, Math.floor(width / stepSize));
        const halfSteps = Math.floor(steps / 2);
        
        // Calculate the peak height - should be at the blade top (0 depth) at the halfway point
        const maxPeakHeight = Math.max(startCutDepth, endCutDepth); // Use the deeper cut as reference
        
        for (let i = 0; i <= steps; i++) {
            const progress = i / steps;
            const x = startX + (endX - startX) * progress;
            
            let y;
            if (i <= halfSteps) {
                // First half: slope up from start cut depth to peak (blade top)
                const upProgress = i / halfSteps;
                y = startY + startCutDepth - (startCutDepth * upProgress); // Slope up to blade top
            } else {
                // Second half: slope down from peak to end cut depth
                const downProgress = (i - halfSteps) / halfSteps;
                y = startY + (endCutDepth * downProgress); // Slope down from blade top
            }
            
            path.points.push(new Phaser.Geom.Point(x, y));
        }
    }
    
    addPointedTipToPath(path, startX, startY, endX, bladeHeight) {
        // Add a pointed tip that extends forward from both top and bottom of the blade
        // This creates the key tip as shown in the ASCII art: \_/\_/\_/\_/\_/
        
        const width = Math.abs(endX - startX);
        const stepSize = 4; // Consistent pixel size for steps
        const steps = Math.max(1, Math.floor(width / stepSize));
        
        // Calculate the bottom point (directly below the start point)
        const bottomX = startX;
        const bottomY = startY + bladeHeight;
        
        // Calculate the tip point (the rightmost point)
        const tipX = endX;
        const tipY = startY + (bladeHeight / 2); // Center of the blade height
        
        // Draw the pointed tip: from top to tip to bottom
        // First, go from top (startY) to tip (rightmost point)
        const topToTipSteps = Math.max(1, Math.floor(width / stepSize));
        for (let i = 0; i <= topToTipSteps; i++) {
            const progress = i / topToTipSteps;
            const x = startX + (width * progress);
            const y = startY + (bladeHeight / 2 * progress); // Slope down from top to center
            path.points.push(new Phaser.Geom.Point(x, y));
        }
        
        // Then, go from tip to bottom
        const tipToBottomSteps = Math.max(1, Math.floor(width / stepSize));
        for (let i = 0; i <= tipToBottomSteps; i++) {
            const progress = i / tipToBottomSteps;
            const x = tipX - (width * progress);
            const y = tipY + (bladeHeight / 2 * progress); // Slope down from center to bottom
            path.points.push(new Phaser.Geom.Point(x, y));
        }
    }
    
    addRightPointingTriangleToPath(path, peakX, peakY, endX, endY, bladeHeight) {
        // Add a triangle that goes from peak down to bottom, with third point facing right |>
        // This creates the right-pointing part of the tip
        
        const width = Math.abs(endX - peakX);
        const stepSize = 4; // Consistent pixel size for steps
        const steps = Math.max(1, Math.floor(width / stepSize));
        
        // Calculate the bottom point (directly below the peak)
        const bottomX = peakX;
        const bottomY = peakY + bladeHeight;
        
        // Calculate the rightmost point (the tip pointing to the right)
        const tipX = endX;
        const tipY = peakY + (bladeHeight / 2); // Center of the blade height
        
        // Draw the triangle: from peak to bottom to tip
        // First, go from peak to bottom
        const peakToBottomSteps = Math.max(1, Math.floor(bladeHeight / stepSize));
        for (let i = 0; i <= peakToBottomSteps; i++) {
            const progress = i / peakToBottomSteps;
            const x = peakX;
            const y = peakY + (bladeHeight * progress);
            path.points.push(new Phaser.Geom.Point(x, y));
        }
        
        // Then, go from bottom to tip (rightmost point)
        const bottomToTipSteps = Math.max(1, Math.floor(width / stepSize));
        for (let i = 0; i <= bottomToTipSteps; i++) {
            const progress = i / bottomToTipSteps;
            const x = bottomX + (width * progress);
            const y = bottomY - (bladeHeight / 2 * progress); // Slope up from bottom to center
            path.points.push(new Phaser.Geom.Point(x, y));
        }
        
        // Finally, go from tip back to peak
        const tipToPeakSteps = Math.max(1, Math.floor(width / stepSize));
        for (let i = 0; i <= tipToPeakSteps; i++) {
            const progress = i / tipToPeakSteps;
            const x = tipX - (width * progress);
            const y = tipY - (bladeHeight / 2 * progress); // Slope up from center to peak
            path.points.push(new Phaser.Geom.Point(x, y));
        }
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
    
    drawPixelArtCircleToGraphics(graphics, centerX, centerY, radius) {
        // Draw a pixel art circle to the specified graphics object
        const stepSize = 4; // Consistent pixel size for steps
        const diameter = radius * 2;
        const steps = Math.floor(diameter / stepSize);
        
        // Draw horizontal lines to create the circle shape
        for (let i = 0; i <= steps; i++) {
            const y = centerY - radius + (i * stepSize);
            const distanceFromCenter = Math.abs(y - centerY);
            
            // Calculate the width of this horizontal line using circle equation
            // For a circle: x² + y² = r², so x = √(r² - y²)
            const halfWidth = Math.sqrt(radius * radius - distanceFromCenter * distanceFromCenter);
            
            if (halfWidth > 0) {
                // Draw the horizontal line for this row
                const lineWidth = halfWidth * 2;
                const lineX = centerX - halfWidth;
                
                // Round to stepSize for pixel art consistency
                const roundedWidth = Math.floor(lineWidth / stepSize) * stepSize;
                const roundedX = Math.floor(lineX / stepSize) * stepSize;
                
                graphics.fillRect(roundedX, y, roundedWidth, stepSize);
            }
        }
    }
    

    
    startKeyInsertion() {
        console.log('startKeyInsertion called with:', { 
            hasKeyGroup: !!this.keyGroup, 
            hasKeyConfig: !!this.keyConfig, 
            keyInserting: this.keyInserting 
        });
        
        if (!this.keyGroup || !this.keyConfig || this.keyInserting) {
            console.log('startKeyInsertion early return - missing requirements');
            return;
        }
        
        console.log('Starting key insertion animation...');
        this.keyInserting = true;
        this.updateFeedback("Inserting key...");
        
        // Calculate target position - key should be fully inserted
        const targetX = this.keyConfig.keywayStartX - this.keyConfig.shoulderWidth;
        const startX = this.keyGroup.x;
        
        // Calculate fully inserted position - move key so it's completely inside the keyway
        const keywayLeftEdge = this.keyConfig.keywayStartX; // 100px
        const shoulderRightEdge = this.keyConfig.circleRadius * 1.9 + this.keyConfig.shoulderWidth; // 266 + 20 = 286px from key group center
        const fullyInsertedX = keywayLeftEdge - shoulderRightEdge; // 100 - 286 = -186px
        
        // Create smooth animation from left to right
        this.scene.tweens.add({
            targets: this.keyGroup,
            x: fullyInsertedX,
            duration: 4000, // 4 seconds for slower insertion
            ease: 'Cubic.easeInOut',
            onUpdate: (tween) => {
                // Calculate progress (0 to 1) - key moves from left to right
                const progress = (this.keyGroup.x - startX) / (fullyInsertedX - startX);
                this.keyInsertionProgress = Math.max(0, Math.min(1, progress));
                
                console.log('Animation update - key position:', this.keyGroup.x, 'progress:', this.keyInsertionProgress);
                
                // Update pin positions based on key cuts as the key is inserted
                this.updatePinsWithKeyInsertion(this.keyInsertionProgress);
            },
            onComplete: () => {
                this.keyInserting = false;
                this.keyInsertionProgress = 1.0; // Fully inserted
                
                // Snap pins to exact final positions based on key cut dimensions
                this.snapPinsToExactPositions();
                
                this.checkKeyCorrectness();
            }
        });
    }
    
    updateKeyPosition(progress) {
        if (!this.keyGroup || !this.keyConfig) return;
        
        // Calculate new position based on insertion progress
        // Key moves from left (off-screen) to right (shoulder touches lock edge)
        const targetX = this.keyConfig.keywayStartX - this.keyConfig.shoulderWidth; // Shoulder touches lock edge
        const currentX = this.keyConfig.startX + (targetX - this.keyConfig.startX) * progress;
        
        this.keyGroup.x = currentX;
        this.keyInsertionProgress = progress;
        
        // If fully inserted, check if key is correct
        if (progress >= 1.0) {
            this.checkKeyCorrectness();
        }
    }
    
    checkKeyCorrectness() {
        if (!this.keyData || !this.keyData.cuts) return;
        
        // Check if the selected key matches the correct key
        let isCorrect = false;
        
        if (this.selectedKeyData && this.selectedKeyData.cuts) {
            // Compare the selected key cuts with the original correct key cuts
            const selectedCuts = this.selectedKeyData.cuts;
            const correctCuts = this.keyData.cuts;
            
            if (selectedCuts.length === correctCuts.length) {
                isCorrect = true;
                for (let i = 0; i < selectedCuts.length; i++) {
                    if (Math.abs(selectedCuts[i] - correctCuts[i]) > 5) { // Allow small tolerance
                isCorrect = false;
                        break;
                    }
                }
            }
        }
        
        console.log('Key correctness check:', {
            selectedKey: this.selectedKeyData ? this.selectedKeyData.cuts : 'none',
            correctKey: this.keyData.cuts,
            isCorrect: isCorrect
        });
        
        if (isCorrect) {
            // Key is correct - all pins are aligned at the shear line
            this.updateFeedback("Key fits perfectly! Lock unlocked.");
            
                    // Start the rotation animation for correct key
        this.scene.time.delayedCall(500, () => {
            this.startKeyRotationAnimationWithChamberHoles();
        });
            
            // Complete the minigame after rotation animation
            setTimeout(() => {
                this.complete(true);
            }, 3000); // Longer delay to allow rotation animation to complete
        } else {
            // Key is wrong - show red flash and then pop up key selection again
            this.updateFeedback("Wrong key! The lock won't turn.");
            
            // Play wrong sound
            if (this.sounds.wrong) {
                this.sounds.wrong.play();
            }
            
            // Flash the entire lock red
            this.flashLockRed();
            
            // Reset key position and show key selection again after a delay
            setTimeout(() => {
                this.updateKeyPosition(0);
                // Show key selection again
                if (this.keySelectionMode) {
                    // For main game, go back to original key selection interface
                    // For challenge mode (locksmith-forge.html), use the training interface
                    if (this.params?.lockable?.id === 'progressive-challenge') {
                        // This is the locksmith-forge.html challenge mode
                        this.createKeysForChallenge('correct_key');
                    } else {
                        // This is the main game - go back to key selection
                        this.startWithKeySelection();
                    }
                }
            }, 2000); // Longer delay to show the red flash
        }
    }
    
    snapPinsToExactPositions() {
        // Use selected key data for visual positioning, but original key data for correctness
        const keyDataToUse = this.selectedKeyData || this.keyData;
        if (!keyDataToUse || !keyDataToUse.cuts) return;
        
        console.log('Snapping pins to exact positions based on key cuts for shear line alignment');
        
        // Ensure key data matches lock pin count
        if (keyDataToUse.cuts.length !== this.pinCount) {
            console.warn(`Key has ${keyDataToUse.cuts.length} cuts but lock has ${this.pinCount} pins. Adjusting key data.`);
            // Truncate or pad cuts to match pin count
            if (keyDataToUse.cuts.length > this.pinCount) {
                keyDataToUse.cuts = keyDataToUse.cuts.slice(0, this.pinCount);
            } else {
                // Pad with default cuts if key has fewer cuts than lock has pins
                while (keyDataToUse.cuts.length < this.pinCount) {
                    keyDataToUse.cuts.push(40); // Default cut depth
                }
            }
        }
        
        // Set each pin to the exact final position based on key cut dimensions
        keyDataToUse.cuts.forEach((cutDepth, index) => {
            if (index >= this.pinCount) {
                console.warn(`Key has ${keyDataToUse.cuts.length} cuts but lock only has ${this.pinCount} pins. Skipping cut ${index}.`);
                return;
            }
            
            const pin = this.pins[index];
            if (!pin) {
                console.error(`Pin at index ${index} is undefined. Available pins: ${this.pins.length}`);
                return;
            }
            
            // Calculate the exact position where the pin should rest on the key cut
            // The cut depth represents how deep the cut is from the blade top
            // We need to position the pin so its bottom rests exactly on the cut surface
            
            // Key blade dimensions
            const bladeHeight = this.keyConfig.bladeHeight;
            const keyBladeBaseY = this.keyGroup.y - bladeHeight / 2;
            
            // Calculate the Y position of the cut surface
            const cutSurfaceY = keyBladeBaseY + cutDepth;
            
            // Calculate where the pin bottom should be to rest on the cut surface
            // Add safety check for undefined properties
            if (!pin.driverPinLength || !pin.keyPinLength) {
                console.warn(`Pin ${pin.index} missing length properties:`, pin);
                return; // Skip this pin if properties are missing
            }
            const pinRestY = 200 - 50 + pin.driverPinLength + pin.keyPinLength; // Pin rest position
            const targetKeyPinBottom = cutSurfaceY;
            
            // Calculate the exact lift needed to move pin bottom from rest to cut surface
            const exactLift = pinRestY - targetKeyPinBottom;
            
            // Snap to exact position
            pin.currentHeight = Math.max(0, exactLift);
            
            // Update pin visuals immediately
            this.updatePinVisuals(pin);
            
            console.log(`Pin ${index}: cutDepth=${cutDepth}, cutSurfaceY=${cutSurfaceY}, exactLift=${exactLift}, currentHeight=${pin.currentHeight}, keyBladeBaseY=${keyBladeBaseY}, bladeHeight=${bladeHeight}`);
        });
        
        // Note: Rotation animation will be triggered by checkKeyCorrectness() only if key is correct
    }
    
    startKeyRotationAnimationWithChamberHoles() {
        // Animation configuration variables - same as lockpicking success
        const KEY_PIN_TOP_SHRINK = 10; // How much the key pin top moves down
        const KEY_PIN_BOTTOM_SHRINK = 5; // How much the key pin bottom moves up
        const KEY_PIN_TOTAL_SHRINK = KEY_PIN_TOP_SHRINK + KEY_PIN_BOTTOM_SHRINK; // Total key pin shrink
        const CHANNEL_MOVEMENT = 25; // How much channels move down
        const KEYWAY_SHRINK = 20; // How much keyway shrinks
        const KEY_SHRINK_FACTOR = 0.7; // How much the key shrinks on Y axis to simulate rotation
        
        // Play success sound
        if (this.sounds.success) {
            this.sounds.success.play();
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(500);
            }
        }
        
        this.updateFeedback("Key inserted successfully! Lock turning...");

        // Create upper edge effect - a copy of the entire key group that stays in place
        // Position at the key's current position (after insertion, before rotation)
        const upperEdgeKeyGroup = this.scene.add.container(this.keyGroup.x, this.keyGroup.y);
        upperEdgeKeyGroup.setDepth(0); // Behind the original key
        
        // Copy the handle (circle)
        const upperEdgeHandle = this.scene.add.graphics();
        upperEdgeHandle.fillStyle(0xaaaaaa); // Slightly darker tone for the upper edge
        upperEdgeHandle.fillCircle(this.keyConfig.circleRadius, 0, this.keyConfig.circleRadius);
        upperEdgeKeyGroup.add(upperEdgeHandle);
        
        // Copy the shoulder and blade using render texture
        const upperEdgeRenderTexture = this.scene.add.renderTexture(0, 0, this.keyRenderTexture.width, this.keyRenderTexture.height);
        upperEdgeRenderTexture.setTint(0xaaaaaa); // Apply darker tone
        upperEdgeRenderTexture.setOrigin(0, 0.5); // Match the original key's origin
        upperEdgeKeyGroup.add(upperEdgeRenderTexture);
        
        // Draw the shoulder and blade to the upper edge render texture
        const upperEdgeGraphics = this.scene.add.graphics();
        upperEdgeGraphics.fillStyle(0xaaaaaa); // Slightly darker tone
        
        // Draw shoulder
        const shoulderX = this.keyConfig.circleRadius * 1.9;
        upperEdgeGraphics.fillRect(shoulderX, 0, this.keyConfig.shoulderWidth, this.keyConfig.shoulderHeight);
        
        // Draw blade - adjust Y position to account for container offset
        const bladeX = shoulderX + this.keyConfig.shoulderWidth;
        const bladeY = this.keyConfig.shoulderHeight/2 - this.keyConfig.bladeHeight/2;
        this.drawKeyBladeAsSolidShape(upperEdgeGraphics, bladeX, bladeY, this.keyConfig.bladeWidth, this.keyConfig.bladeHeight);
        
        upperEdgeRenderTexture.draw(upperEdgeGraphics);
        upperEdgeGraphics.destroy();
        
        // Initially hide the upper edge
        upperEdgeKeyGroup.setVisible(false);
        
        // Animate key shrinking on Y axis to simulate rotation
        this.scene.tweens.add({
            targets: this.keyGroup,
            scaleY: KEY_SHRINK_FACTOR,
            duration: 1400,
            ease: 'Cubic.easeInOut',
            onStart: () => {
                // Show the upper edge when rotation starts
                upperEdgeKeyGroup.setVisible(true);
            }
        });
        
        // Animate the upper edge copy to shrink and move upward (keeping top edge in place)
        this.scene.tweens.add({
            targets: upperEdgeKeyGroup,
            scaleY: KEY_SHRINK_FACTOR,
            y: upperEdgeKeyGroup.y - 6, // Simple upward movement
            duration: 1400,
            ease: 'Cubic.easeInOut'
        });

        // Shrink key pins downward and add half circles to simulate cylinder rotation
        this.pins.forEach(pin => {
            // Hide all highlights
            if (pin.shearHighlight) pin.shearHighlight.setVisible(false);
            if (pin.setHighlight) pin.setHighlight.setVisible(false);
            if (pin.bindingHighlight) pin.bindingHighlight.setVisible(false);
            if (pin.overpickedHighlight) pin.overpickedHighlight.setVisible(false);
            if (pin.failureHighlight) pin.failureHighlight.setVisible(false);
            
            // Create chamber hole circle that expands at the actual chamber position
            const chamberCircle = this.scene.add.graphics();
            chamberCircle.fillStyle(0x666666); // Dark gray color for chamber holes
            chamberCircle.x = pin.x; // Center horizontally on the pin
            
            // Position at actual chamber hole location (shear line)
            const chamberY = pin.y + (-45); // Shear line position
            chamberCircle.y = chamberY;
            chamberCircle.setDepth(5); // Above all other elements
            
            // Create a temporary object to hold the circle expansion data
            const circleData = { 
                width: 24, // Start full width (same as key pin)
                height: 2, // Start very thin (flat top)
                y: chamberY
            };
            
            // Animate the chamber hole circle expanding to full circle (stays at chamber position)
            this.scene.tweens.add({
                targets: circleData,
                width: 24, // Full circle width (stays same)
                height: 16, // Full circle height (expands from 2 to 16)
                y: chamberY, // Stay at the chamber position (no movement)
                duration: 1400,
                ease: 'Cubic.easeInOut',
                onUpdate: function() {
                    chamberCircle.clear();
                    chamberCircle.fillStyle(0xff0000); // Light red for chamber holes filled with key pin
                    
                    // Calculate animation progress (0 to 1)
                    const progress = (circleData.height - 2) / (16 - 2); // From 2 to 16 height
                    
                    // Draw different circle shapes based on progress (widest in middle)
                    if (progress < 0.1) {
                        // Start: just a thin line (flat top)
                        chamberCircle.fillRect(-12, 0, 24, 2);
                    } else if (progress < 0.3) {
                        // Early: thin oval with middle bulge
                        chamberCircle.fillRect(-8, 0, 16, 2);     // narrow top
                        chamberCircle.fillRect(-12, 2, 24, 2);    // wide middle
                        chamberCircle.fillRect(-8, 4, 16, 2);     // narrow bottom
                    } else if (progress < 0.5) {
                        // Middle: growing circle with middle bulge
                        chamberCircle.fillRect(-6, 0, 12, 2);     // narrow top
                        chamberCircle.fillRect(-10, 2, 20, 2);    // wider
                        chamberCircle.fillRect(-12, 4, 24, 2);    // widest middle
                        chamberCircle.fillRect(-10, 6, 20, 2);    // wider
                        chamberCircle.fillRect(-6, 8, 12, 2);     // narrow bottom
                    } else if (progress < 0.7) {
                        // Later: more circle-like with middle bulge
                        chamberCircle.fillRect(-4, 0, 8, 2);      // narrow top
                        chamberCircle.fillRect(-8, 2, 16, 2);     // wider
                        chamberCircle.fillRect(-12, 4, 24, 2);    // widest middle
                        chamberCircle.fillRect(-12, 6, 24, 2);    // widest middle
                        chamberCircle.fillRect(-8, 8, 16, 2);     // wider
                        chamberCircle.fillRect(-4, 10, 8, 2);     // narrow bottom
                    } else if (progress < 0.9) {
                        // Almost full: near complete circle
                        chamberCircle.fillRect(-2, 0, 4, 2);      // narrow top
                        chamberCircle.fillRect(-6, 2, 12, 2);     // wider
                        chamberCircle.fillRect(-10, 4, 20, 2);    // wider
                        chamberCircle.fillRect(-12, 6, 24, 2);    // widest middle
                        chamberCircle.fillRect(-12, 8, 24, 2);    // widest middle
                        chamberCircle.fillRect(-10, 10, 20, 2);   // wider
                        chamberCircle.fillRect(-6, 12, 12, 2);    // wider
                        chamberCircle.fillRect(-2, 14, 4, 2);     // narrow bottom
                    } else {
                        // Full: complete pixel art circle
                        chamberCircle.fillRect(-2, 0, 4, 2);      // narrow top
                        chamberCircle.fillRect(-6, 2, 12, 2);     // wider
                        chamberCircle.fillRect(-10, 4, 20, 2);    // wider
                        chamberCircle.fillRect(-12, 6, 24, 2);    // widest middle
                        chamberCircle.fillRect(-12, 8, 24, 2);    // widest middle
                        chamberCircle.fillRect(-10, 10, 20, 2);   // wider
                        chamberCircle.fillRect(-6, 12, 12, 2);    // wider
                        chamberCircle.fillRect(-2, 14, 4, 2);     // narrow bottom
                    }
                    
                    // Update position
                    chamberCircle.y = circleData.y;
                }
            });
            
            // Animate key pin moving down as a unit (staying connected to chamber hole)
            const keyPinData = { 
                yOffset: 0 // How much the entire key pin moves down
            };
            this.scene.tweens.add({
                targets: keyPinData,
                yOffset: KEY_PIN_TOP_SHRINK, // Move entire key pin down
                duration: 1400,
                ease: 'Cubic.easeInOut',
                onUpdate: function() {
                    pin.keyPin.clear();
                    pin.keyPin.fillStyle(0xdd3333);
                    
                    // Calculate position: entire key pin moves down as a unit
                    const originalTopY = -50 + pin.driverPinLength - pin.currentHeight; // Current top position (at shear line)
                    const newTopY = originalTopY + keyPinData.yOffset; // Entire key pin moves down
                    const newBottomY = newTopY + pin.keyPinLength; // Bottom position
                    
                    // Draw rectangular part of key pin (moves down as unit)
                    pin.keyPin.fillRect(-12, newTopY, 24, pin.keyPinLength - 8);
                    
                    // Draw triangular bottom in pixel art style (moves down with key pin)
                    pin.keyPin.fillRect(-12, newBottomY - 8, 24, 2);
                    pin.keyPin.fillRect(-10, newBottomY - 6, 20, 2);
                    pin.keyPin.fillRect(-8, newBottomY - 4, 16, 2);
                    pin.keyPin.fillRect(-6, newBottomY - 2, 12, 2);
                }
            });
            
            // Animate key pin channel rectangle moving down with the channel circles
            if (pin.channelRect) {
                this.scene.tweens.add({
                    targets: pin.channelRect,
                    y: pin.channelRect.y + CHANNEL_MOVEMENT, // Move down by channel movement amount
                    duration: 1400,
                    ease: 'Cubic.easeInOut'
                });
            }
        });

        // Animate the keyway shrinking (keeping bottom in place) to make cylinder appear to grow
        const keywayData = { height: 90 };
        this.scene.tweens.add({
            targets: keywayData,
            height: 90 - KEYWAY_SHRINK, // Shrink by keyway shrink amount
            duration: 1400,
            ease: 'Cubic.easeInOut',
            onUpdate: function() {
                // Update keyway visual to show shrinking
                // This would need to be implemented based on how the keyway is drawn
            }
        });
    }
    

    

    
    liftPinsWithKey() {
        if (!this.keyData || !this.keyData.cuts) return;
        
        // Lift each pin to the correct height based on key cuts
        this.keyData.cuts.forEach((cutDepth, index) => {
            if (index >= this.pinCount) return;
            
            const pin = this.pins[index];
            
            // Calculate the height needed to lift the pin so it aligns at the shear line
            const shearLineY = -45; // Shear line position
            const keyPinTopAtShearLine = shearLineY; // Key pin top should be at shear line
            const keyPinBottomAtRest = -50 + pin.driverPinLength + pin.keyPinLength; // Key pin bottom when not lifted
            const requiredLift = keyPinBottomAtRest - keyPinTopAtShearLine; // How much to lift
            
            // The cut depth should match the required lift
            const maxLift = pin.keyPinLength; // Maximum possible lift (full key pin height)
            const requiredCutDepth = (requiredLift / maxLift) * 100; // Convert to percentage
            
            // Calculate the actual lift based on the key cut depth
            const actualLift = (cutDepth / 100) * maxLift;
            
            // Animate pin to correct position
            this.scene.tweens.add({
                targets: { height: 0 },
                height: actualLift,
                duration: 500,
                ease: 'Cubic.easeOut',
                onUpdate: (tween) => {
                    pin.currentHeight = tween.targets[0].height;
                    this.updatePinVisuals(pin);
                }
            });
        });
    }
    
    updatePinsWithKeyInsertion(progress) {
        if (!this.keyConfig) return;
        
        // Calculate key blade position relative to the lock
        const keyBladeStartX = this.keyGroup.x + this.keyConfig.circleRadius * 2 + this.keyConfig.shoulderWidth;
        const keyBladeEndX = keyBladeStartX + this.keyConfig.bladeWidth;
        
        // Key blade base position in world coordinates
        const keyBladeBaseY = this.keyGroup.y - this.keyConfig.bladeHeight / 2;
        
        // Shear line for highlighting
        const shearLineY = -45; // Same as lockpicking mode
        const tolerance = 10;
        
        // Check each pin for collision with the key blade
        this.pins.forEach((pin, index) => {
            if (index >= this.pinCount) return;
            
            // Calculate pin position in the lock
            const pinSpacing = 400 / (this.pinCount + 1);
            const margin = pinSpacing * 0.75;
            const pinX = 100 + margin + index * pinSpacing;
            
            // Check if this pin is under the key blade
            const pinIsUnderKeyBlade = pinX >= keyBladeStartX && pinX <= keyBladeEndX;
            
            if (pinIsUnderKeyBlade) {
                // Use collision detection to find the key surface height at this pin's position
                const keySurfaceY = this.getKeySurfaceHeightAtPinPosition(pinX, keyBladeStartX, keyBladeBaseY);
                
                // Calculate where the key pin bottom should be to sit on the key surface
                const pinRestY = 200 - 50 + pin.driverPinLength + pin.keyPinLength;
                const targetKeyPinBottom = keySurfaceY;
                
                // Calculate required lift to move key pin bottom from rest to key surface
                const requiredLift = pinRestY - targetKeyPinBottom;
                const targetLift = Math.max(0, requiredLift);
                
                // Smooth movement toward target
                if (pin.currentHeight < targetLift) {
                    pin.currentHeight = Math.min(targetLift, pin.currentHeight + 2);
                } else if (pin.currentHeight > targetLift) {
                    pin.currentHeight = Math.max(targetLift, pin.currentHeight - 1);
                }
            } else {
                // Pin is not under key blade - keep current position (don't drop back down)
                // This ensures pins stay lifted once they've been pushed up by the key
            }
            
            // Check if pin is near shear line for highlighting
            // Use the same boundary calculation as lockpicking mode
            const boundaryPosition = -50 + pin.driverPinLength - pin.currentHeight;
            const distanceToShearLine = Math.abs(boundaryPosition - shearLineY);
            
            // Debug: Log boundary positions for highlighting
            console.log(`Pin ${index} highlighting: boundaryPosition=${boundaryPosition}, distanceToShearLine=${distanceToShearLine}, tolerance=${tolerance}, shouldHighlight=${distanceToShearLine <= tolerance}, hasShearHighlight=${!!pin.shearHighlight}, hasSetHighlight=${!!pin.setHighlight}`);
            
            // Update pin highlighting based on shear line proximity
            this.updatePinHighlighting(pin, distanceToShearLine, tolerance);
            
            // Update pin visuals
            this.updatePinVisuals(pin);
        });
    }
    
    getKeySurfaceHeightAtPinPosition(pinX, keyBladeStartX, keyBladeBaseY) {
        // Use collision detection to find the key surface height at a specific pin position
        // This method traces a vertical line from the pin position down to find where it intersects the key polygon
        
        const bladeWidth = this.keyConfig.bladeWidth;
        const bladeHeight = this.keyConfig.bladeHeight;
        
        // Calculate the pin's position relative to the key blade
        const pinRelativeToKey = pinX - keyBladeStartX;
        
        // If pin is beyond the key blade, return base surface
        if (pinRelativeToKey < 0 || pinRelativeToKey > bladeWidth) {
            return keyBladeBaseY;
        }
        
        // Generate the key polygon points at the current position
        const keyPolygonPoints = this.generateKeyPolygonPoints(keyBladeStartX, keyBladeBaseY);
        
        // Find the intersection point by tracing a vertical line from the pin position
        const intersectionY = this.findVerticalIntersection(pinX, keyBladeBaseY, keyBladeBaseY + bladeHeight, keyPolygonPoints);
        
        return intersectionY !== null ? intersectionY : keyBladeBaseY;
    }
    
    generateKeyPolygonPoints(keyBladeStartX, keyBladeBaseY) {
        // Generate the key polygon points at the current position
        // This recreates the same polygon logic used in drawKeyBladeAsSolidShape
        const points = [];
        const bladeWidth = this.keyConfig.bladeWidth;
        const bladeHeight = this.keyConfig.bladeHeight;
        const cutWidth = 24;
        
        // Calculate pin spacing
        const pinSpacing = 400 / (this.pinCount + 1);
        const margin = pinSpacing * 0.75;
        
        // Start at the top-left corner of the blade
        points.push({ x: keyBladeStartX, y: keyBladeBaseY });
        
        let currentX = keyBladeStartX;
        
        // Generate the same path as the drawing method
        for (let i = 0; i <= this.pinCount; i++) {
            let cutDepth = 0;
            let nextCutDepth = 0;
            
            if (i < this.pinCount) {
                cutDepth = (this.selectedKeyData || this.keyData).cuts[i] || 0;
            }
            if (i < this.pinCount - 1) {
                nextCutDepth = (this.selectedKeyData || this.keyData).cuts[i + 1] || 0;
            }
            
            // Calculate pin position
            const pinX = 100 + margin + i * pinSpacing;
            const cutX = keyBladeStartX + (pinX - 100);
            
            if (i === 0) {
                // First section: from left edge to first cut
                const firstCutStartX = cutX - cutWidth/2;
                this.addTriangularPeakToPoints(points, currentX, keyBladeBaseY, firstCutStartX, keyBladeBaseY, 0, cutDepth);
                currentX = firstCutStartX;
            }
            
            if (i < this.pinCount) {
                // Draw the cut
            const cutStartX = cutX - cutWidth/2;
            const cutEndX = cutX + cutWidth/2;
                points.push({ x: cutStartX, y: keyBladeBaseY + cutDepth });
                points.push({ x: cutEndX, y: keyBladeBaseY + cutDepth });
                currentX = cutEndX;
            }
            
            if (i < this.pinCount - 1) {
                // Draw triangular peak to next cut
                const nextPinX = 100 + margin + (i + 1) * pinSpacing;
                const nextCutX = keyBladeStartX + (nextPinX - 100);
                const nextCutStartX = nextCutX - cutWidth/2;
                this.addTriangularPeakToPoints(points, currentX, keyBladeBaseY, nextCutStartX, keyBladeBaseY, cutDepth, nextCutDepth);
                currentX = nextCutStartX;
            } else if (i === this.pinCount - 1) {
                // Last section: pointed tip
                const keyRightEdge = keyBladeStartX + bladeWidth;
                const tipExtension = 12;
                const tipEndX = keyRightEdge + tipExtension;
                const peakX = currentX + (keyRightEdge - currentX) * 0.3;
                this.addTriangularPeakToPoints(points, currentX, keyBladeBaseY, peakX, keyBladeBaseY, cutDepth, 0);
                this.addPointedTipToPoints(points, peakX, keyBladeBaseY, tipEndX, bladeHeight);
                currentX = tipEndX;
            }
        }
        
        // Complete the path
        points.push({ x: keyBladeStartX + bladeWidth, y: keyBladeBaseY + bladeHeight });
        points.push({ x: keyBladeStartX, y: keyBladeBaseY + bladeHeight });
        points.push({ x: keyBladeStartX, y: keyBladeBaseY });
        
        return points;
    }
    
    findVerticalIntersection(pinX, startY, endY, polygonPoints) {
        // Find where a vertical line at pinX intersects the polygon
        // Returns the Y coordinate of the intersection, or null if no intersection
        
        let intersectionY = null;
        
        for (let i = 0; i < polygonPoints.length - 1; i++) {
            const p1 = polygonPoints[i];
            const p2 = polygonPoints[i + 1];
            
            // Check if this line segment crosses the vertical line at pinX
            if ((p1.x <= pinX && p2.x >= pinX) || (p1.x >= pinX && p2.x <= pinX)) {
                // Calculate intersection
                const t = (pinX - p1.x) / (p2.x - p1.x);
                const y = p1.y + t * (p2.y - p1.y);
                
                // Keep the highest intersection point (closest to the pin)
                if (intersectionY === null || y < intersectionY) {
                    intersectionY = y;
                }
            }
        }
        
        return intersectionY;
    }
    
    addTriangularPeakToPoints(points, startX, startY, endX, endY, startCutDepth, endCutDepth) {
        // Add triangular peak points (same logic as addTriangularPeakToPath)
        const width = Math.abs(endX - startX);
        const stepSize = 4;
        const steps = Math.max(1, Math.floor(width / stepSize));
        const halfSteps = Math.floor(steps / 2);
        
        for (let i = 0; i <= steps; i++) {
            const progress = i / steps;
            const x = startX + (endX - startX) * progress;
            
            let y;
            if (i <= halfSteps) {
                const upProgress = i / halfSteps;
                y = startY + startCutDepth - (startCutDepth * upProgress);
            } else {
                const downProgress = (i - halfSteps) / halfSteps;
                y = startY + (endCutDepth * downProgress);
            }
            
            points.push({ x: x, y: y });
        }
    }
    
    addPointedTipToPoints(points, startX, startY, endX, bladeHeight) {
        // Add pointed tip points (same logic as addPointedTipToPath)
        const width = Math.abs(endX - startX);
        const stepSize = 4;
        const steps = Math.max(1, Math.floor(width / stepSize));
        
        const tipX = endX;
        const tipY = startY + (bladeHeight / 2);
        
        // From top to tip
        const topToTipSteps = Math.max(1, Math.floor(width / stepSize));
        for (let i = 0; i <= topToTipSteps; i++) {
            const progress = i / topToTipSteps;
            const x = startX + (width * progress);
            const y = startY + (bladeHeight / 2 * progress);
            points.push({ x: x, y: y });
        }
        
        // From tip to bottom
        const tipToBottomSteps = Math.max(1, Math.floor(width / stepSize));
        for (let i = 0; i <= tipToBottomSteps; i++) {
            const progress = i / tipToBottomSteps;
            const x = tipX - (width * progress);
            const y = tipY + (bladeHeight / 2 * progress);
            points.push({ x: x, y: y });
        }
    }
    

    
    getTriangularSectionHeightAtX(relativeX, bladeWidth, bladeHeight) {
        // Calculate height of triangular sections at a given X position
        // Creates peaks that go up to blade top between cuts
        const cutWidth = 24;
        const pinSpacing = 400 / (this.pinCount + 1);
        const margin = pinSpacing * 0.75;
        
        // Check triangular sections between cuts
        for (let i = 0; i < this.pinCount - 1; i++) {
            const cut1X = margin + i * pinSpacing;
            const cut2X = margin + (i + 1) * pinSpacing;
            const cut1EndX = cut1X + cutWidth/2;
            const cut2StartX = cut2X - cutWidth/2;
            
            // Check if we're in the triangular section between these cuts
            if (relativeX >= cut1EndX && relativeX <= cut2StartX) {
                const distanceFromCut1 = relativeX - cut1EndX;
                const triangularWidth = cut2StartX - cut1EndX;
                const progress = distanceFromCut1 / triangularWidth;
                
                // Get cut depths for both cuts
                const cut1Depth = this.keyData.cuts[i] || 0;
                const cut2Depth = this.keyData.cuts[i + 1] || 0;
                
                // Create a peak: go up from cut1 to blade top, then down to cut2
                const halfWidth = triangularWidth / 2;
                
                if (distanceFromCut1 <= halfWidth) {
                    // First half: slope up from cut1 to blade top
                    const upProgress = distanceFromCut1 / halfWidth;
                    return cut1Depth + (bladeHeight - cut1Depth) * upProgress;
                } else {
                    // Second half: slope down from blade top to cut2
                    const downProgress = (distanceFromCut1 - halfWidth) / halfWidth;
                    return bladeHeight - (bladeHeight - cut2Depth) * downProgress;
                }
            }
        }
        
        // Check triangular section from left edge to first cut
        const firstCutX = margin;
        const firstCutStartX = firstCutX - cutWidth/2;
        
        if (relativeX >= 0 && relativeX < firstCutStartX) {
            const progress = relativeX / firstCutStartX;
            const firstCutDepth = this.keyData.cuts[0] || 0;
            
            // Create a peak: slope up from base to blade top, then down to first cut
            const halfWidth = firstCutStartX / 2;
            
            if (relativeX <= halfWidth) {
                // First half: slope up from base (0) to blade top
                const upProgress = relativeX / halfWidth;
                return bladeHeight * upProgress;
            } else {
                // Second half: slope down from blade top to first cut depth
                const downProgress = (relativeX - halfWidth) / halfWidth;
                return bladeHeight - (bladeHeight - firstCutDepth) * downProgress;
            }
        }
        
        // Check triangular section from last cut to right edge
        const lastCutX = margin + (this.pinCount - 1) * pinSpacing;
        const lastCutEndX = lastCutX + cutWidth/2;
        
        if (relativeX > lastCutEndX && relativeX <= bladeWidth) {
            const triangularWidth = bladeWidth - lastCutEndX;
            const distanceFromLastCut = relativeX - lastCutEndX;
            const progress = distanceFromLastCut / triangularWidth;
            const lastCutDepth = this.keyData.cuts[this.pinCount - 1] || 0;
            
            // Create a peak: slope up from last cut to blade top, then down to base
            const halfWidth = triangularWidth / 2;
            
            if (distanceFromLastCut <= halfWidth) {
                // First half: slope up from last cut depth to blade top
                const upProgress = distanceFromLastCut / halfWidth;
                return lastCutDepth + (bladeHeight - lastCutDepth) * upProgress;
            } else {
                // Second half: slope down from blade top to base (0)
                const downProgress = (distanceFromLastCut - halfWidth) / halfWidth;
                return bladeHeight * (1 - downProgress);
            }
        }
        
        return 0; // Not in a triangular section
    }
    
    getTriangularSectionHeightAsKeyMoves(pinRelativeToKeyLeadingEdge, bladeWidth, bladeHeight) {
        // Calculate triangular section height as the key moves underneath the pin
        // This creates the sloping effect as pins follow the key's surface
        
        const cutWidth = 24;
        const pinSpacing = 400 / (this.pinCount + 1);
        const margin = pinSpacing * 0.75;
        
        // Check triangular section from left edge to first cut
        const firstCutX = margin;
        const firstCutStartX = firstCutX - cutWidth/2;
        
        if (pinRelativeToKeyLeadingEdge >= 0 && pinRelativeToKeyLeadingEdge < firstCutStartX) {
            // Pin is in the triangular section from left edge to first cut
            const progress = pinRelativeToKeyLeadingEdge / firstCutStartX;
            const firstCutDepth = this.keyData.cuts[0] || 0;
            // Start from base level (0) and slope up to first cut depth
            return Math.max(0, firstCutDepth * progress); // Ensure we never go below base level
        }
        
        // Check triangular sections between cuts
        for (let i = 0; i < this.pinCount - 1; i++) {
            const cut1X = margin + i * pinSpacing;
            const cut2X = margin + (i + 1) * pinSpacing;
            const cut1EndX = cut1X + cutWidth/2;
            const cut2StartX = cut2X - cutWidth/2;
            
            if (pinRelativeToKeyLeadingEdge >= cut1EndX && pinRelativeToKeyLeadingEdge <= cut2StartX) {
                // Pin is in triangular section between these cuts
                const distanceFromCut1 = pinRelativeToKeyLeadingEdge - cut1EndX;
                const triangularWidth = cut2StartX - cut1EndX;
                const progress = distanceFromCut1 / triangularWidth;
                
                // Get cut depths for both cuts
                const cut1Depth = this.keyData.cuts[i] || 0;
                const cut2Depth = this.keyData.cuts[i + 1] || 0;
                
                // Interpolate between cut depths (slope from cut1 to cut2)
                return cut1Depth + (cut2Depth - cut1Depth) * progress;
            }
        }
        
        // Check triangular section from last cut to right edge
        const lastCutX = margin + (this.pinCount - 1) * pinSpacing;
        const lastCutEndX = lastCutX + cutWidth/2;
        
        if (pinRelativeToKeyLeadingEdge >= lastCutEndX && pinRelativeToKeyLeadingEdge <= bladeWidth) {
            // Pin is in triangular section from last cut to right edge
            const distanceFromLastCut = pinRelativeToKeyLeadingEdge - lastCutEndX;
            const triangularWidth = bladeWidth - lastCutEndX;
            const progress = distanceFromLastCut / triangularWidth;
            const lastCutDepth = this.keyData.cuts[this.pinCount - 1] || 0;
            return lastCutDepth * (1 - progress); // Slope down from last cut depth to 0
        }
        
        return 0; // Not in a triangular section
    }
    
    createKeyBladeCollision() {
        if (!this.keyData || !this.keyData.cuts || !this.keyConfig) return;
        
        // Create collision rectangles for each section of the key blade
        this.keyCollisionRects = [];
        
        const pinSpacing = 400 / (this.pinCount + 1);
        const margin = pinSpacing * 0.75;
        const bladeStartX = this.keyConfig.circleRadius * 2 + this.keyConfig.shoulderWidth;
        
        console.log('Creating key collision rectangles, bladeStartX:', bladeStartX);
        
        // Create collision rectangles for each pin position
        for (let i = 0; i < this.pinCount; i++) {
            const cutDepth = this.keyData.cuts[i] || 50;
            const bladeHeight = this.keyConfig.bladeHeight;
            
            // The cut depth directly represents how deep the divot is
            // Small pin = small cut, Large pin = large cut
            const cutHeight = (bladeHeight / 2) * (cutDepth / 100);
            const surfaceHeight = bladeHeight - cutHeight;
            
            // Calculate pin position in the lock
            const pinX = 100 + margin + i * pinSpacing;
            
            // Create collision rectangle for this section - position relative to blade start
            const rect = {
                x: pinX - 100, // Position relative to blade start (not absolute)
                y: -bladeHeight/2 + cutHeight, // Position relative to key center
                width: 24, // Pin width
                height: surfaceHeight,
                cutDepth: cutDepth
            };
            
            console.log(`Key collision rect ${i}: x=${rect.x}, y=${rect.y}, width=${rect.width}, height=${rect.height}`);
            this.keyCollisionRects.push(rect);
        }
    }
    
    getKeySurfaceHeightAtPosition(pinX, keyBladeStartX) {
        if (!this.keyCollisionRects || !this.keyConfig) return this.keyConfig ? this.keyConfig.bladeHeight : 0;
        
        // Find the collision rectangle for this pin position
        const pinSpacing = 400 / (this.pinCount + 1);
        const margin = pinSpacing * 0.75;
        
        for (let i = 0; i < this.pinCount; i++) {
            const cutPinX = 100 + margin + i * pinSpacing;
            if (Math.abs(pinX - cutPinX) < 12) { // Within pin width
                return this.keyCollisionRects[i].height;
            }
        }
        
        // If no cut found, return full blade height
        return this.keyConfig.bladeHeight;
    }
    
    hideLockpickingTools() {
        // Hide tension wrench and hook pick in key mode
        if (this.tensionWrench) {
            this.tensionWrench.setVisible(false);
        }
        if (this.hookGroup) {
            this.hookGroup.setVisible(false);
        }
        
        // Hide labels
        if (this.wrenchText) {
            this.wrenchText.setVisible(false);
        }
        if (this.hookPickLabel) {
            this.hookPickLabel.setVisible(false);
        }
    }
    
    updateHookPosition(pinIndex) {
        if (!this.hookGroup || !this.hookConfig) return;
        
        const config = this.hookConfig;
        const targetPin = this.pins[pinIndex];
        
        if (!targetPin) return;
        
        // Calculate the target Y position (bottom of the key pin)
        const pinWorldY = 200; // Base Y position for pins
        const currentTargetY = pinWorldY - 50 + targetPin.driverPinLength + targetPin.keyPinLength - targetPin.currentHeight;
        
        console.log('Hook update - following pin:', pinIndex, 'currentHeight:', targetPin.currentHeight, 'targetY:', currentTargetY);
        
        // Update the last targeted pin
        this.hookConfig.lastTargetedPin = pinIndex;
        
        // Calculate the pin's X position (same logic as createPins)
        const pinSpacing = 400 / (this.pinCount + 1);
        const margin = pinSpacing * 0.75;
        const pinX = 100 + margin + pinIndex * pinSpacing;
        
        // Calculate the pin's base Y position (when currentHeight = 0)
        const pinBaseY = pinWorldY - 50 + targetPin.driverPinLength + targetPin.keyPinLength;
        
        // Calculate how much the pin has moved from its own base position
        const heightDifference = pinBaseY - currentTargetY;
        
        // Calculate rotation angle based on percentage of pin movement and pin number
        const maxHeightDifference = 50; // Maximum expected height difference
        const minRotationDegrees = 20; // Minimum rotation for highest pin
        const maxRotationDegrees = 40; // Maximum rotation for lowest pin
        
        // Calculate pin-based rotation range (pin 0 = max rotation, pin n-1 = min rotation)
        const pinRotationRange = maxRotationDegrees - minRotationDegrees;
        const pinRotationFactor = pinIndex / (this.pinCount - 1); // 0 for first pin, 1 for last pin
        const pinRotationOffset = pinRotationRange * pinRotationFactor;
        const pinMaxRotation = maxRotationDegrees - pinRotationOffset;
        
        // Calculate percentage of pin movement (0% to 100%)
        const pinMovementPercentage = Math.min((heightDifference / maxHeightDifference) * 100, 100);
        
        // Calculate rotation based on percentage and pin-specific max rotation
        // Higher pin indices (further pins) rotate slower by reducing the percentage
        const pinSpeedFactor = 1 - (pinIndex / this.pinCount) * 0.5; // 1.0 for pin 0, 0.5 for last pin
        const adjustedPercentage = pinMovementPercentage * pinSpeedFactor;
        const rotationAngle = (adjustedPercentage / 100) * pinMaxRotation;
        
        // Calculate the new tip position (hook should point at the current pin)
        const totalHookHeight = (config.diagonalSegments + config.verticalSegments) * config.segmentStep;
        const newTipX = pinX - totalHookHeight + 34; // Add 34px offset (24px + 10px further right)
        
        // Update hook position and rotation
        this.hookGroup.x = newTipX;
        this.hookGroup.y = currentTargetY;
        this.hookGroup.setAngle(-rotationAngle); // Negative for anti-clockwise rotation
        
        // Check for collisions with other pins using hook's current position
        this.checkHookCollisions(pinIndex, this.hookGroup.y);
        
        console.log('Hook update - pinX:', pinX, 'newTipX:', newTipX, 'currentTargetY:', currentTargetY, 'heightDifference:', heightDifference, 'pinMaxRotation:', pinMaxRotation, 'pinMovementPercentage:', pinMovementPercentage.toFixed(1) + '%', 'pinSpeedFactor:', pinSpeedFactor.toFixed(2), 'rotationAngle:', rotationAngle.toFixed(1));
    }
    
    returnHookToStart() {
        if (!this.hookGroup || !this.hookConfig) return;
        
        const config = this.hookConfig;
        
        console.log('Returning hook to starting position (no rotation)');
        
        // Get the current X position from the last targeted pin
        const pinSpacing = 400 / (this.pinCount + 1);
        const margin = pinSpacing * 0.75;
        const targetPinIndex = config.lastTargetedPin;
        const currentX = 100 + margin + targetPinIndex * pinSpacing; // Last targeted pin's X position
        
        // Calculate the tip position for the current pin
        const totalHookHeight = (config.diagonalSegments + config.verticalSegments) * config.segmentStep;
        const tipX = currentX - totalHookHeight + 48; // Add 48px offset (24px + 24px further right)
        
        // Calculate resting Y position (a few pixels lower than original)
        const restingY = config.hookStartY - 24; // 24px lower than original position (was 15px)
        
        // Reset position and rotation
        this.hookGroup.x = tipX;
        this.hookGroup.y = restingY;
        this.hookGroup.setAngle(0);
        
        // Clear debug graphics when hook returns to start
        if (this.debugGraphics) {
            this.debugGraphics.clear();
        }
    }
    
    checkHookCollisions(targetPinIndex, hookCurrentY) {
        if (!this.hookConfig || !this.gameState.mouseDown) return;
        
        // Clear previous debug graphics
        if (this.debugGraphics) {
            this.debugGraphics.clear();
        } else {
            this.debugGraphics = this.scene.add.graphics();
            this.debugGraphics.setDepth(100); // Render on top
        }
        
        // Create a temporary rectangle for the hook's horizontal arm using Phaser's physics
        const hookArmWidth = 8;
        const hookArmLength = 100;
        
        // Calculate the horizontal arm position relative to the hook's current position
        // The horizontal arm extends from the handle to the curve start
        const handleStartX = -120; // Handle starts at -120
        const handleWidth = 20;
        const armStartX = handleStartX + handleWidth; // Arm starts after handle (-100)
        const armEndX = armStartX + hookArmLength; // Arm ends at +40
        
        // Position the collision box lower along the arm (not at the tip)
        const collisionOffsetY = 35; // Move collision box down by 2350px
        
        // Convert to world coordinates with rotation
        const hookAngle = this.hookGroup.angle * (Math.PI / 180); // Convert degrees to radians
        const cosAngle = Math.cos(hookAngle);
        const sinAngle = Math.sin(hookAngle);
        
        // Calculate rotated arm start and end points
        const armStartX_rotated = armStartX * cosAngle - collisionOffsetY * sinAngle;
        const armStartY_rotated = armStartX * sinAngle + collisionOffsetY * cosAngle;
        const armEndX_rotated = armEndX * cosAngle - collisionOffsetY * sinAngle;
        const armEndY_rotated = armEndX * sinAngle + collisionOffsetY * cosAngle;
        
        // Convert to world coordinates
        const worldArmStartX = armStartX_rotated + this.hookGroup.x;
        const worldArmStartY = armStartY_rotated + this.hookGroup.y;
        const worldArmEndX = armEndX_rotated + this.hookGroup.x;
        const worldArmEndY = armEndY_rotated + this.hookGroup.y;
        
        // Create a line for the rotated arm (this is what we'll use for collision detection)
        const hookArmLine = new Phaser.Geom.Line(worldArmStartX, worldArmStartY, worldArmEndX, worldArmEndY);
        
        // // Render hook arm hitbox (red) - draw as a line to show rotation
        // this.debugGraphics.lineStyle(3, 0xff0000);
        // this.debugGraphics.beginPath();
        // this.debugGraphics.moveTo(worldArmStartX, worldArmStartY);
        // this.debugGraphics.lineTo(worldArmEndX, worldArmEndY);
        // this.debugGraphics.strokePath();
        
        // // Also render a rectangle around the collision area for debugging
        // this.debugGraphics.lineStyle(1, 0xff0000);
        // this.debugGraphics.strokeRect(
        //     Math.min(worldArmStartX, worldArmEndX), 
        //     Math.min(worldArmStartY, worldArmEndY), 
        //     Math.abs(worldArmEndX - worldArmStartX), 
        //     Math.abs(worldArmEndY - worldArmStartY) + hookArmWidth
        // );
        
        // Check each pin for collision using Phaser's geometry
        this.pins.forEach((pin, pinIndex) => {
            if (pinIndex === targetPinIndex) return; // Skip the target pin
            
            // Calculate pin position
            const pinSpacing = 400 / (this.pinCount + 1);
            const margin = pinSpacing * 0.75;
            const pinX = 100 + margin + pinIndex * pinSpacing;
            const pinWorldY = 200;
            
            // Calculate pin's current position (including any existing movement)
            // Add safety check for undefined properties
            if (!pin.driverPinLength || !pin.keyPinLength) {
                console.warn(`Pin ${pinIndex} missing length properties in checkHookCollisions:`, pin);
                return; // Skip this pin if properties are missing
            }
            const pinCurrentY = pinWorldY - 50 + pin.driverPinLength + pin.keyPinLength - pin.currentHeight;
            const keyPinTop = pinCurrentY - pin.keyPinLength;
            const keyPinBottom = pinCurrentY;
            
            // Create a rectangle for the key pin
            const keyPinRect = new Phaser.Geom.Rectangle(pinX - 12, keyPinTop, 24, pin.keyPinLength);
            
            // // Render pin hitbox (blue)
            // this.debugGraphics.lineStyle(2, 0x0000ff);
            // this.debugGraphics.strokeRect(pinX - 12, keyPinTop, 24, pin.keyPinLength);
            
            // Use Phaser's built-in line-to-rectangle intersection
            if (Phaser.Geom.Intersects.LineToRectangle(hookArmLine, keyPinRect)) {
                // Collision detected - lift this pin
                this.liftCollidedPin(pin, pinIndex);
                
                // // Render collision (green)
                // this.debugGraphics.lineStyle(3, 0x00ff00);
                // this.debugGraphics.strokeRect(pinX - 12, keyPinTop, 24, pin.keyPinLength);
            }
        });
    }
    

    
    liftCollidedPin(pin, pinIndex) {
        // Only lift if the pin isn't already being actively moved
        if (this.lockState.currentPin && this.lockState.currentPin.index === pinIndex) return;
        
        // Calculate pin-specific maximum height
        const baseMaxHeight = 75;
        const maxHeightReduction = 15;
        const pinHeightFactor = pinIndex / (this.pinCount - 1);
        const pinMaxHeight = baseMaxHeight - (maxHeightReduction * pinHeightFactor);
        
        // Lift the pin faster for collision (more responsive)
        const collisionLiftSpeed = this.liftSpeed * 0.8; // 80% of normal lift speed (increased from 30%)
        pin.currentHeight = Math.min(pin.currentHeight + collisionLiftSpeed, pinMaxHeight * 0.5); // Max 50% of pin's max height
        
        // Update pin visuals
        this.updatePinVisuals(pin);
        
        console.log(`Hook collision: Lifting pin ${pinIndex} to height ${pin.currentHeight}`);
    }
    
    updatePinHighlighting(pin, distanceToShearLine, tolerance) {
        // Update pin highlighting based on distance to shear line
        // This provides visual feedback during key insertion
        
        // Create shear highlight if it doesn't exist
        if (!pin.shearHighlight) {
            pin.shearHighlight = this.scene.add.graphics();
            pin.shearHighlight.fillStyle(0x00ff00, 0.4); // Green with transparency
            pin.shearHighlight.fillRect(-22.5, -110, 45, 140);
            pin.container.addAt(pin.shearHighlight, 0); // Add at beginning to appear behind pins
        }
        
        // Hide all highlights first
        pin.shearHighlight.setVisible(false);
        if (pin.bindingHighlight) pin.bindingHighlight.setVisible(false);
        if (pin.overpickedHighlight) pin.overpickedHighlight.setVisible(false);
        if (pin.failureHighlight) pin.failureHighlight.setVisible(false);
        
        // Show green highlight only if pin is at shear line
        if (distanceToShearLine <= tolerance) {
            // Pin is at shear line - show green highlight
            pin.shearHighlight.setVisible(true);
            console.log(`Pin ${pin.index} showing GREEN highlight - distance: ${distanceToShearLine}`);
        } else {
            // Pin is not at shear line - no highlight
            console.log(`Pin ${pin.index} NO highlight - distance: ${distanceToShearLine}`);
        }
    }
    
    updatePinVisuals(pin) {
        console.log(`Updating pin ${pin.index} visuals - currentHeight: ${pin.currentHeight}`);
        
        // Update key pin visual
        pin.keyPin.clear();
        pin.keyPin.fillStyle(0xdd3333);
        
        // Calculate new position based on currentHeight
        // Add safety check for undefined properties
        if (!pin.driverPinLength || !pin.keyPinLength) {
            console.warn(`Pin ${pin.index} missing length properties in updatePinVisuals:`, pin);
            return; // Skip this pin if properties are missing
        }
        const newKeyPinY = -50 + pin.driverPinLength - pin.currentHeight;
        const keyPinTopY = newKeyPinY;
        const keyPinBottomY = newKeyPinY + pin.keyPinLength;
        const shearLineY = -45;
        const distanceToShearLine = Math.abs(keyPinTopY - shearLineY);
        
        console.log(`Pin ${pin.index} final positioning: keyPinTopY=${keyPinTopY}, keyPinBottomY=${keyPinBottomY}, distanceToShearLine=${distanceToShearLine}`);
        
        // Draw rectangular part of key pin
        pin.keyPin.fillRect(-12, -50 + pin.driverPinLength - pin.currentHeight, 24, pin.keyPinLength - 8);
        
        // Draw triangular bottom in pixel art style
        pin.keyPin.fillRect(-12, -50 + pin.driverPinLength - pin.currentHeight + pin.keyPinLength - 8, 24, 2);
        pin.keyPin.fillRect(-10, -50 + pin.driverPinLength - pin.currentHeight + pin.keyPinLength - 6, 20, 2);
        pin.keyPin.fillRect(-8, -50 + pin.driverPinLength - pin.currentHeight + pin.keyPinLength - 4, 16, 2);
        pin.keyPin.fillRect(-6, -50 + pin.driverPinLength - pin.currentHeight + pin.keyPinLength - 2, 12, 2);
        
        // Update driver pin visual
        pin.driverPin.clear();
        pin.driverPin.fillStyle(0x3388dd);
        pin.driverPin.fillRect(-12, -50 - pin.currentHeight, 24, pin.driverPinLength);
        
        // Update spring compression
        pin.spring.clear();
        pin.spring.fillStyle(0x666666);
        const springCompression = pin.currentHeight;
        const compressionFactor = Math.max(0.3, 1 - (springCompression / 60));
        
        const springTop = -130;
        const driverPinTop = -50 - pin.currentHeight;
        const springBottom = driverPinTop;
        const springHeight = springBottom - springTop;
        const totalSpringSpace = springHeight;
        const segmentSpacing = totalSpringSpace / 11;
        
        for (let s = 0; s < 12; s++) {
            const segmentHeight = 4 * compressionFactor;
            const segmentY = springTop + (s * segmentSpacing);
            
            if (segmentY + segmentHeight <= springBottom) {
                pin.spring.fillRect(-12, segmentY, 24, segmentHeight);
            }
        }
    }
    
    createPins() {
        // Create random binding order
        const bindingOrder = [];
        for (let i = 0; i < this.pinCount; i++) {
            bindingOrder.push(i);
        }
        this.shuffleArray(bindingOrder);
        
        const pinSpacing = 400 / (this.pinCount + 1);
        const margin = pinSpacing * 0.75; // 25% smaller margins
        
        // Try to load saved pin heights for this lock
        const savedPinHeights = this.lockConfig.loadLockConfiguration();
        
        // Check if predefined pin heights were passed
        const predefinedPinHeights = this.params?.predefinedPinHeights;
        
        console.log(`DEBUG: Lockpicking minigame received parameters:`);
        console.log(`  - pinCount: ${this.pinCount}`);
        console.log(`  - this.params:`, this.params);
        console.log(`  - predefinedPinHeights: [${predefinedPinHeights ? predefinedPinHeights.join(', ') : 'none'}]`);
        console.log(`  - savedPinHeights: [${savedPinHeights ? savedPinHeights.join(', ') : 'none'}]`);
        
        for (let i = 0; i < this.pinCount; i++) {
            const pinX = 100 + margin + i * pinSpacing;
            const pinY = 200;
            
            // Use predefined pin heights if available, otherwise use saved or generate random ones
            let keyPinLength, driverPinLength;
            if (predefinedPinHeights && predefinedPinHeights[i] !== undefined) {
                // Use predefined configuration
                keyPinLength = predefinedPinHeights[i];
                driverPinLength = 75 - keyPinLength; // Total height is 75
                console.log(`✓ Pin ${i}: Using predefined pin height: ${keyPinLength} (driver: ${driverPinLength})`);
            } else if (savedPinHeights && savedPinHeights[i] !== undefined) {
                // Use saved configuration
                keyPinLength = savedPinHeights[i];
                driverPinLength = 75 - keyPinLength; // Total height is 75
                console.log(`✓ Pin ${i}: Using saved pin height: ${keyPinLength} (driver: ${driverPinLength})`);
            } else {
                // Generate random pin lengths that add up to 75 (total height - 25% increase from 60)
                keyPinLength = 25 + Math.random() * 37.5; // 25-62.5 (25% increase)
                driverPinLength = 75 - keyPinLength; // Remaining to make 75 total
                console.log(`⚠ Pin ${i}: Generated random pin height: ${keyPinLength} (driver: ${driverPinLength})`);
            }
            
            const pin = {
                index: i,
                binding: bindingOrder[i],
                isSet: false,
                currentHeight: 0,
                originalHeight: keyPinLength, // Store original height for consistency
                keyPinHeight: 0, // Track key pin position separately
                driverPinHeight: 0, // Track driver pin position separately
                keyPinLength: keyPinLength,
                driverPinLength: driverPinLength,
                x: pinX,
                y: pinY,
                container: null,
                keyPin: null,
                driverPin: null,
                spring: null
            };
            
            // Ensure pin properties are valid
            if (!pin.keyPinLength || !pin.driverPinLength) {
                console.error(`Pin ${i} created with invalid lengths:`, pin);
                pin.keyPinLength = pin.keyPinLength || 30; // Default fallback
                pin.driverPinLength = pin.driverPinLength || 45; // Default fallback
            }
            
            // Create pin container
            pin.container = this.scene.add.container(pinX, pinY);
            
            // Add all highlights FIRST (so they appear behind pins)
            // Add hover effect using a highlight rectangle - 25% less wide, full height from spring top to pin bottom (extended down)
            pin.highlight = this.scene.add.graphics();
            pin.highlight.fillStyle(0xffff00, 0.3);
            pin.highlight.fillRect(-22.5, -110, 45, 140);
            pin.highlight.setVisible(false);
            pin.container.add(pin.highlight);
            
            // Add overpicked highlight
            pin.overpickedHighlight = this.scene.add.graphics();
            pin.overpickedHighlight.fillStyle(0xff0000, 0.6);
            pin.overpickedHighlight.fillRect(-22.5, -110, 45, 140);
            pin.overpickedHighlight.setVisible(false);
            pin.container.add(pin.overpickedHighlight);
            
            // Add failure highlight for overpicked set pins
            pin.failureHighlight = this.scene.add.graphics();
            pin.failureHighlight.fillStyle(0xff6600, 0.7);
            pin.failureHighlight.fillRect(-22.5, -110, 45, 140);
            pin.failureHighlight.setVisible(false);
            pin.container.add(pin.failureHighlight);
            
            // Create spring (top part) - 12 segments with correct initial spacing
            pin.spring = this.scene.add.graphics();
            pin.spring.fillStyle(0x666666);
            const springTop = -130;
            const springBottom = -50; // Driver pin top when not lifted
            const springHeight = springBottom - springTop;
            
            // Calculate total spring space and distribute segments evenly
            const totalSpringSpace = springHeight;
            const segmentSpacing = totalSpringSpace / 11; // 11 gaps between 12 segments
            
            for (let s = 0; s < 12; s++) {
                const segmentY = springTop + (s * segmentSpacing);
                pin.spring.fillRect(-12, segmentY, 24, 4);
            }
            pin.container.add(pin.spring);
            
            // Create driver pin (middle part) - starts at y=-50
            pin.driverPin = this.scene.add.graphics();
            pin.driverPin.fillStyle(0x3388dd);
            pin.driverPin.fillRect(-12, -50, 24, driverPinLength);
            pin.container.add(pin.driverPin);
            
            // Set container depth to ensure driver pins are above circles
            pin.container.setDepth(2);
            
            // Create key pin (bottom part) - starts below driver pin with triangular bottom
            pin.keyPin = this.scene.add.graphics();
            pin.keyPin.fillStyle(0xdd3333);
            
            // Draw rectangular part of key pin
            pin.keyPin.fillRect(-12, -50 + driverPinLength, 24, keyPinLength - 8);
            
            // Draw triangular bottom in pixel art style
            pin.keyPin.fillRect(-12, -50 + driverPinLength + keyPinLength - 8, 24, 2);
            pin.keyPin.fillRect(-10, -50 + driverPinLength + keyPinLength - 6, 20, 2);
            pin.keyPin.fillRect(-8, -50 + driverPinLength + keyPinLength - 4, 16, 2);
            pin.keyPin.fillRect(-6, -50 + driverPinLength + keyPinLength - 2, 12, 2);
            
            pin.container.add(pin.keyPin);
            
            // Add labels for pin components (only for the first pin to avoid clutter)
            if (i === 0) {
                // Spring label
                const springLabel = this.scene.add.text(pinX, pinY - 140, 'Spring', {
                    fontSize: '18px',
                    fontFamily: 'VT323',
                    fill: '#00ff00',
                    fontWeight: 'bold'
                });
                springLabel.setOrigin(0.5);
                springLabel.setDepth(100); // Bring to front
                
                // Driver pin label - positioned below the shear line
                const driverPinX = 100 + margin + 1 * pinSpacing; // Pin index 1 (2nd pin)
                const driverPinLabel = this.scene.add.text(driverPinX, pinY - 35, 'Driver Pin', {
                    fontSize: '18px',
                    fontFamily: 'VT323',
                    fill: '#00ff00',
                    fontWeight: 'bold'
                });
                driverPinLabel.setOrigin(0.5);
                driverPinLabel.setDepth(100); // Bring to front
                
                // Key pin label - positioned at the middle of the key pin
                const keyPinX = 100 + margin + 2 * pinSpacing; // Pin index 2 (3rd pin)
                const keyPinLabel = this.scene.add.text(keyPinX, pinY - 50 + driverPinLength + (keyPinLength / 2), 'Key Pin', {
                    fontSize: '18px',
                    fontFamily: 'VT323',
                    fill: '#00ff00',
                    fontWeight: 'bold'
                });
                keyPinLabel.setOrigin(0.5);
                keyPinLabel.setDepth(100); // Bring to front
                
                // Store references to labels for hiding
                this.springLabel = springLabel;
                this.driverPinLabel = driverPinLabel;
                this.keyPinLabel = keyPinLabel;
            }
            
            // Create channel rectangle (keyway for this pin) - above cylinder but behind key pins
            const shearLineY = -45; // Shear line position
            const keywayTopY = 200; // Top of the main keyway
            const channelHeight = keywayTopY - (pinY + shearLineY); // From keyway to shear line
            
            // Create channel rectangle graphics
            pin.channelRect = this.scene.add.graphics();
            pin.channelRect.x = pinX;
            pin.channelRect.y = pinY + shearLineY - 15; // Start at circle start position (20px above shear line)
            pin.channelRect.fillStyle(0x2a2a2a, 1); // Same color as keyway
            pin.channelRect.fillRect(-13, 3, 26, channelHeight + 15 - 3); // 3px margin except at shear line
            pin.channelRect.setDepth(0); // Behind key pins but above cylinder
            
            // Add border to match keyway style
            pin.channelRect.lineStyle(1, 0x1a1a1a);
            pin.channelRect.strokeRect(-13, 3, 26, channelHeight + 20 - 3);
            
            // Create spring channel rectangle - behind spring, above cylinder
            const springChannelHeight = springBottom - springTop; // Spring height
            
            // Create spring channel rectangle graphics
            pin.springChannelRect = this.scene.add.graphics();
            pin.springChannelRect.x = pinX;
            pin.springChannelRect.y = pinY + springTop; // Start at spring top
            pin.springChannelRect.fillStyle(0x2a2a2a, 1); // Same color as keyway
            pin.springChannelRect.fillRect(-13, 3, 26, springChannelHeight - 3); // 3px margin except at shear line
            pin.springChannelRect.setDepth(1); // Behind spring but above cylinder
            
            // Add border to match keyway style
            pin.springChannelRect.lineStyle(1, 0x1a1a1a);
            pin.springChannelRect.strokeRect(-13, 3, 26, springChannelHeight - 3);
            
            // Make pin interactive - 25% less wide, full height from spring top to bottom of keyway (extended down)
            pin.container.setInteractive(new Phaser.Geom.Rectangle(-18.75, -110, 37.5, 230), Phaser.Geom.Rectangle.Contains);
            
            // Add pin number
            const pinText = this.scene.add.text(0, 40, (i + 1).toString(), {
                fontSize: '18px',
                fontFamily: 'VT323',
                fill: '#ffffff',
                fontWeight: 'bold'
            });
            pinText.setOrigin(0.5);
            pin.container.add(pinText);
            
            // Store reference to pin text for hiding
            pin.pinText = pinText;
            
            pin.container.on('pointerover', () => {
                if (this.lockState.tensionApplied && !pin.isSet) {
                    pin.highlight.setVisible(true);
                }
            });
            
            pin.container.on('pointerout', () => {
                pin.highlight.setVisible(false);
            });
            
            // Add event handlers
            pin.container.on('pointerdown', () => {
                console.log('Pin clicked:', pin.index);
                this.lockState.currentPin = pin;
                this.gameState.mouseDown = true;
                console.log('Pin interaction started');
                
                // Play click sound
                if (this.sounds.click) {
                    this.sounds.click.play();
                    if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(50);
            }
                }
                
                // Hide labels on first pin click
                if (!this.pinClicked) {
                    this.pinClicked = true;
                    if (this.wrenchText) {
                        this.wrenchText.setVisible(false);
                    }
                    if (this.shearLineText) {
                        this.shearLineText.setVisible(false);
                    }
                    if (this.hookPickLabel) {
                        this.hookPickLabel.setVisible(false);
                    }
                    if (this.springLabel) {
                        this.springLabel.setVisible(false);
                    }
                    if (this.driverPinLabel) {
                        this.driverPinLabel.setVisible(false);
                    }
                    if (this.keyPinLabel) {
                        this.keyPinLabel.setVisible(false);
                    }
                    
                    // Hide all pin numbers
                    this.pins.forEach(pin => {
                        if (pin.pinText) {
                            pin.pinText.setVisible(false);
                        }
                    });
                }
                
                if (!this.lockState.tensionApplied) {
                    this.updateFeedback("Apply tension first before picking pins");
                    this.flashWrenchRed();
                }
            });
            
            this.pins.push(pin);
        }
        
        // Save the lock configuration after all pins are created
        this.lockConfig.saveLockConfiguration();
    }
    
    createShearLine() {
        // Create a more visible shear line at y=155 (which is -45 in pin coordinates)
        const graphics = this.scene.add.graphics();
        graphics.lineStyle(3, 0x00ff00);
        graphics.beginPath();
        graphics.moveTo(100, 155);
        graphics.lineTo(500, 155);
        graphics.strokePath();
        
        // Add a dashed line effect
        graphics.lineStyle(1, 0x00ff00, 0.5);
        for (let x = 100; x < 500; x += 10) {
            graphics.beginPath();
            graphics.moveTo(x, 150);
            graphics.lineTo(x, 160);
            graphics.strokePath();
        }
        
        // Add shear line label
        const shearLineText = this.scene.add.text(430, 135, 'SHEAR LINE', {
            fontSize: '16px',
            fontFamily: 'VT323',
            fill: '#00ff00',
            fontWeight: 'bold'
        });
        shearLineText.setDepth(100); // Bring to front
        
        // Store reference to shear line text for hiding
        this.shearLineText = shearLineText;
        
        // // Add instruction text
        // this.scene.add.text(300, 180, 'Align key/driver pins at the shear line', {
        //     fontSize: '12px',
        //     fill: '#00ff00',
        //     fontStyle: 'italic'
        // }).setOrigin(0.5);
    }
    
    setupInputHandlers() {
        this.scene.input.on('pointerup', () => {
            if (this.lockState.currentPin) {
                this.checkPinSet(this.lockState.currentPin);
                this.lockState.currentPin = null;
            }
            this.gameState.mouseDown = false;
            
            // Only return hook to resting position if not in key mode
            if (!this.keyMode && this.hookPickGraphics && this.hookConfig) {
                this.returnHookToStart();
            }
            
            // Stop key insertion if in key mode
            if (this.keyMode) {
                this.keyInserting = false;
            }
        });
        
        // Add keyboard bindings
        this.scene.input.keyboard.on('keydown', (event) => {
            const key = event.key;
            
            // Pin number keys (1-8)
            if (key >= '1' && key <= '8') {
                const pinIndex = parseInt(key) - 1; // Convert 1-8 to 0-7
                
                // Check if pin exists
                if (pinIndex < this.pinCount) {
                    const pin = this.pins[pinIndex];
                    if (pin) {
                        // Simulate pin click
                        this.lockState.currentPin = pin;
                        this.gameState.mouseDown = true;
                        
                        // Play click sound
                        if (this.sounds.click) {
                            this.sounds.click.play();
                            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(50);
            }
                        }
                        
                        // Hide labels on first pin click
                        if (!this.pinClicked) {
                            this.pinClicked = true;
                            if (this.wrenchText) {
                                this.wrenchText.setVisible(false);
                            }
                            if (this.shearLineText) {
                                this.shearLineText.setVisible(false);
                            }
                            if (this.hookPickLabel) {
                                this.hookPickLabel.setVisible(false);
                            }
                            if (this.springLabel) {
                                this.springLabel.setVisible(false);
                            }
                            if (this.driverPinLabel) {
                                this.driverPinLabel.setVisible(false);
                            }
                            if (this.keyPinLabel) {
                                this.keyPinLabel.setVisible(false);
                            }
                            
                            // Hide all pin numbers
                            this.pins.forEach(pin => {
                                if (pin.pinText) {
                                    pin.pinText.setVisible(false);
                                }
                            });
                        }
                        
                        if (!this.lockState.tensionApplied) {
                            this.updateFeedback("Apply tension first before picking pins");
                            this.flashWrenchRed();
                        }
                    }
                }
            }
            
            // SPACE key for tension wrench toggle
            if (key === ' ') {
                event.preventDefault(); // Prevent page scroll
                
                // Simulate tension wrench click
                this.lockState.tensionApplied = !this.lockState.tensionApplied;
                
                // Play tension sound
                if (this.sounds.tension) {
                    this.sounds.tension.play();
                    if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate([200]);
            }
                }
                
                if (this.lockState.tensionApplied) {
                    this.wrenchGraphics.clear();
                    this.wrenchGraphics.fillStyle(0x00ff00);
                    
                    // Long vertical arm (left side of L) - same dimensions as inactive
                    this.wrenchGraphics.fillRect(0, -120, 10, 170);
                    
                    // Short horizontal arm (bottom of L) extending into keyway - same dimensions as inactive
                    this.wrenchGraphics.fillRect(0, 40, 37.5, 10);
                    
                    this.updateFeedback("Tension applied. Only the binding pin can be set - others will fall back down.");
                } else {
                    this.wrenchGraphics.clear();
                    this.wrenchGraphics.fillStyle(0x888888);
                    
                    // Long vertical arm (left side of L) - same dimensions as active
                    this.wrenchGraphics.fillRect(0, -120, 10, 170);
                    
                    // Short horizontal arm (bottom of L) extending into keyway - same dimensions as active
                    this.wrenchGraphics.fillRect(0, 40, 37.5, 10);
                    
                    this.updateFeedback("Tension released. All pins will fall back down.");
                    
                    // Play reset sound
                    if (this.sounds.reset) {
                        this.sounds.reset.play();
                    }
                    
                    // Reset ALL pins when tension is released (including set and overpicked ones)
                    this.pins.forEach(pin => {
                        pin.isSet = false;
                        pin.isOverpicked = false;
                        pin.currentHeight = 0;
                        pin.keyPinHeight = 0; // Reset key pin height
                        pin.driverPinHeight = 0; // Reset driver pin height
                        pin.overpickingTimer = null; // Reset overpicking timer
                        
                        // Reset visual
                        pin.keyPin.clear();
                        pin.keyPin.fillStyle(0xdd3333);
                        
                        // Draw rectangular part of key pin
                        pin.keyPin.fillRect(-12, -50 + pin.driverPinLength, 24, pin.keyPinLength - 8);
                        
                        // Draw triangular bottom in pixel art style
                        pin.keyPin.fillRect(-12, -50 + pin.driverPinLength + pin.keyPinLength - 8, 24, 2);
                        pin.keyPin.fillRect(-10, -50 + pin.driverPinLength + pin.keyPinLength - 6, 20, 2);
                        pin.keyPin.fillRect(-8, -50 + pin.driverPinLength + pin.keyPinLength - 4, 16, 2);
                        pin.keyPin.fillRect(-6, -50 + pin.driverPinLength + pin.keyPinLength - 2, 12, 2);
                        
                        pin.driverPin.clear();
                        pin.driverPin.fillStyle(0x3388dd);
                        pin.driverPin.fillRect(-12, -50, 24, pin.driverPinLength);
                        
                        // Reset spring to original position
                        pin.spring.clear();
                        pin.spring.fillStyle(0x666666);
                        const springTop = -130; // Fixed spring top
                        const springBottom = -50; // Driver pin top when not lifted
                        const springHeight = springBottom - springTop;
                        
                        // Calculate total spring space and distribute segments evenly
                        const totalSpringSpace = springHeight;
                        const segmentSpacing = totalSpringSpace / 11; // 11 gaps between 12 segments
                        
                        for (let s = 0; s < 12; s++) {
                            const segmentHeight = 4;
                            const segmentY = springTop + (s * segmentSpacing);
                            pin.spring.fillRect(-12, segmentY, 24, segmentHeight);
                        }
                        
                        // Hide all highlights
                        if (pin.shearHighlight) pin.shearHighlight.setVisible(false);
                        if (pin.setHighlight) pin.setHighlight.setVisible(false);
                        if (pin.bindingHighlight) pin.bindingHighlight.setVisible(false);
                        if (pin.overpickedHighlight) pin.overpickedHighlight.setVisible(false);
                        if (pin.failureHighlight) pin.failureHighlight.setVisible(false);
                    });
                    
                    // Reset lock state
                    this.lockState.pinsSet = 0;
                }
                
                this.updateBindingPins();
            }
        });
        
        // Add keyboard release handler for pin keys
        this.scene.input.keyboard.on('keyup', (event) => {
            const key = event.key;
            
            // Pin number keys (1-8)
            if (key >= '1' && key <= '8') {
                const pinIndex = parseInt(key) - 1; // Convert 1-8 to 0-7
                
                // Check if pin exists and is currently being held
                if (pinIndex < this.pinCount && this.lockState.currentPin && this.lockState.currentPin.index === pinIndex) {
                    this.checkPinSet(this.lockState.currentPin);
                    this.lockState.currentPin = null;
                    this.gameState.mouseDown = false;
                    
                    // Return hook to resting position
                    if (this.hookPickGraphics && this.hookConfig) {
                        this.returnHookToStart();
                    }
                }
            }
        });
        
        // Add key interaction handlers if in key mode
        if (this.keyMode && this.keyClickZone) {
            console.log('Setting up key click handler...');
            this.keyClickZone.on('pointerdown', (pointer) => {
                console.log('Key clicked! Event triggered.');
                // Prevent this event from bubbling up to global handlers
                pointer.event.stopPropagation();
                
                if (!this.keyInserting) {
                    console.log('Starting key insertion animation...');
                    this.startKeyInsertion();
                } else {
                    console.log('Key insertion already in progress, ignoring click.');
                }
            });
        } else {
            console.log('Key mode or click zone not available:', { keyMode: this.keyMode, hasClickZone: !!this.keyClickZone });
        }
    }
    
    update() {
        // Skip normal lockpicking logic if in key mode
        if (this.keyMode) {
            return;
        }
        
        if (this.lockState.currentPin && this.gameState.mouseDown) {
            this.liftPin();
        }
        
        // Apply gravity when tension is not applied (but not when actively lifting)
        if (!this.lockState.tensionApplied && !this.gameState.mouseDown) {
            this.applyGravity();
        }
        
        // Apply gravity to non-binding pins even with tension
        if (this.lockState.tensionApplied && !this.gameState.mouseDown) {
            this.applyGravity();
        }
        
        // Check if all pins are correctly positioned when tension is applied
        if (this.lockState.tensionApplied) {
            this.checkAllPinsCorrect();
        }
        
        // Hook return is now handled directly in pointerup event
    }
    
    liftPin() {
        if (!this.lockState.currentPin || !this.gameState.mouseDown) return;
        
        const pin = this.lockState.currentPin;
        const liftSpeed = this.liftSpeed;
        const shearLineY = -45;

        // If pin is set and not already overpicked, allow key pin to move up, driver pin stays at SL
        if (pin.isSet && !pin.isOverpicked) {
            // Move key pin up gradually from its dropped position (slower when not connected to driver pin)
            const keyPinLiftSpeed = liftSpeed * 0.5; // Half speed for key pin movement
            // Key pin should stop when its top surface reaches the shear line
            // The key pin's top is at: -50 + pin.driverPinLength - pin.keyPinHeight
            // We want this to equal -45 (shear line)
            // So: -50 + pin.driverPinLength - pin.keyPinHeight = -45
            // Therefore: pin.keyPinHeight = pin.driverPinLength - 5
            const maxKeyPinHeight = pin.driverPinLength - 5; // Top of key pin at shear line
            pin.keyPinHeight = Math.min(pin.keyPinHeight + keyPinLiftSpeed, maxKeyPinHeight);
            
            // If key pin reaches driver pin, start overpicking timer
            if (pin.keyPinHeight >= maxKeyPinHeight) { // Key pin top at shear line
                // Start overpicking timer if not already started
                if (!pin.overpickingTimer) {
                    pin.overpickingTimer = Date.now();
                    this.updateFeedback("Key pin at shear line. Release now or continue to overpick...");
                }
                
                // Check if 500ms have passed since reaching shear line
                if (Date.now() - pin.overpickingTimer >= 500) {
                                    // Both move up together
                pin.isOverpicked = true;
                pin.keyPinHeight = 90; // Move both up above SL
                pin.driverPinHeight = 90; // Driver pin moves up too
                
                // Play overpicking sound
                if (this.sounds.overtension) {
                    this.sounds.overtension.play();
                    if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(500);
            }

                }
                
                // Mark as overpicked and stuck
                this.updateFeedback("Set pin overpicked! Release tension to reset.");
                    if (!pin.failureHighlight) {
                        pin.failureHighlight = this.scene.add.graphics();
                        pin.failureHighlight.fillStyle(0xff6600, 0.7);
                        pin.failureHighlight.fillRect(-22.5, -110, 45, 140);
                        pin.container.add(pin.failureHighlight);
                    }
                    pin.failureHighlight.setVisible(true);
                    if (pin.setHighlight) pin.setHighlight.setVisible(false);
                }
            }

            // Draw key pin (rectangular part) - move gradually from dropped position
            pin.keyPin.clear();
            pin.keyPin.fillStyle(0xdd3333);
            // Calculate key pin position based on keyPinHeight (gradual movement from dropped position)
            const keyPinY = -50 + pin.driverPinLength - pin.keyPinHeight;
            pin.keyPin.fillRect(-12, keyPinY, 24, pin.keyPinLength - 8);
            // Draw triangle
            pin.keyPin.fillRect(-12, keyPinY + pin.keyPinLength - 8, 24, 2);
            pin.keyPin.fillRect(-10, keyPinY + pin.keyPinLength - 6, 20, 2);
            pin.keyPin.fillRect(-8, keyPinY + pin.keyPinLength - 4, 16, 2);
            pin.keyPin.fillRect(-6, keyPinY + pin.keyPinLength - 2, 12, 2);
            // Draw driver pin at shear line (stays at SL until overpicked)
            pin.driverPin.clear();
            pin.driverPin.fillStyle(0x3388dd);
            const shearLineY = -45;
            const driverPinY = shearLineY - pin.driverPinLength; // Driver pin bottom at shear line
            pin.driverPin.fillRect(-12, driverPinY, 24, pin.driverPinLength);
            // Spring
            pin.spring.clear();
            pin.spring.fillStyle(0x666666);
            const springTop = -130;
            const springBottom = shearLineY - pin.driverPinLength; // Driver pin top (at shear line)
            const springHeight = springBottom - springTop;
            const totalSpringSpace = springHeight;
            const segmentSpacing = totalSpringSpace / 11;
            for (let s = 0; s < 12; s++) {
                const segmentHeight = 4 * 0.3;
                const segmentY = springTop + (s * segmentSpacing);
                if (segmentY + segmentHeight <= springBottom) {
                    pin.spring.fillRect(-12, segmentY, 24, segmentHeight);
                }
            }
            // Continue lifting if mouse is still down
            if (this.gameState.mouseDown && !pin.isOverpicked) {
                requestAnimationFrame(() => this.liftPin());
            }
            return; // Exit early for set pins - don't run normal lifting logic
        }

        // Existing overpicking and normal lifting logic follows...
        // Check for overpicking when tension is applied (for binding pins and set pins)
        if (this.lockState.tensionApplied && (this.shouldPinBind(pin) || pin.isSet)) {
            // For set pins, use keyPinHeight; for normal pins, use currentHeight
            const heightToCheck = pin.isSet ? pin.keyPinHeight : pin.currentHeight;
            const boundaryPosition = -50 + pin.driverPinLength - heightToCheck;
            
            // If key pin is pushed too far beyond shear line, it gets stuck
            if (boundaryPosition < shearLineY - 10) {
                // Check if this pin being overpicked would prevent automatic success
                // If all other pins are correctly positioned, don't allow overpicking
                let otherPinsCorrect = true;
                this.pins.forEach(otherPin => {
                    if (otherPin !== pin && !otherPin.isOverpicked) {
                        const otherBoundaryPosition = -50 + otherPin.driverPinLength - otherPin.currentHeight;
                        const otherDistanceToShearLine = Math.abs(otherBoundaryPosition - shearLineY);
                        if (otherDistanceToShearLine > 8) {
                            otherPinsCorrect = false;
                        }
                    }
                });
                
                // If other pins are correct and this pin is being actively moved, prevent overpicking
                if (otherPinsCorrect && this.gameState.mouseDown) {
                    // Stop the pin from moving further up but don't mark as overpicked
                    if (pin.isSet) {
                        const maxKeyPinHeight = pin.driverPinLength - 5; // Top of key pin at shear line
                        pin.keyPinHeight = Math.min(pin.keyPinHeight, maxKeyPinHeight);
                    } else {
                        // Use pin-specific maximum height for overpicking prevention
                        const baseMaxHeight = 75;
                        const maxHeightReduction = 15;
                        const pinHeightFactor = pin.index / (this.pinCount - 1);
                        const pinMaxHeight = baseMaxHeight - (maxHeightReduction * pinHeightFactor);
                        pin.currentHeight = Math.min(pin.currentHeight, pinMaxHeight);
                    }
                    return;
                }
                
                // Otherwise, allow normal overpicking behavior
                pin.isOverpicked = true;
                
                // Play overpicking sound
                if (this.sounds.overtension) {
                    this.sounds.overtension.play();
                    if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(500);
            }
                }
                
                if (pin.isSet) {
                    this.updateFeedback("Set pin overpicked! Release tension to reset.");
                    
                    // Show failure highlight for overpicked set pins
                    if (!pin.failureHighlight) {
                        pin.failureHighlight = this.scene.add.graphics();
                        pin.failureHighlight.fillStyle(0xff6600, 0.7);
                        pin.failureHighlight.fillRect(-22.5, -110, 45, 140);
                        pin.container.add(pin.failureHighlight);
                    }
                    pin.failureHighlight.setVisible(true);
                    
                    // Hide set highlight
                    if (pin.setHighlight) pin.setHighlight.setVisible(false);
                } else {
                    this.updateFeedback("Pin overpicked! Release tension to reset.");
                    
                    // Show overpicked highlight for regular pins
                    if (!pin.overpickedHighlight) {
                        pin.overpickedHighlight = this.scene.add.graphics();
                        pin.overpickedHighlight.fillStyle(0xff0000, 0.6);
                        pin.overpickedHighlight.fillRect(-22.5, -110, 45, 140);
                        pin.container.add(pin.overpickedHighlight);
                    }
                    pin.overpickedHighlight.setVisible(true);
                }
                
                // Don't return - allow further pushing even when overpicked
            }
        }
        
        // Calculate pin-specific maximum height (further pins have less upward movement)
        const baseMaxHeight = 75; // Base maximum height for closest pin
        const maxHeightReduction = 15; // Maximum reduction for furthest pin
        const pinHeightFactor = pin.index / (this.pinCount - 1); // 0 for first pin, 1 for last pin
        const pinMaxHeight = baseMaxHeight - (maxHeightReduction * pinHeightFactor);
        
        pin.currentHeight = Math.min(pin.currentHeight + liftSpeed, pinMaxHeight); 
        
        // Update visual - both pins move up together toward the spring
        pin.keyPin.clear();
        pin.keyPin.fillStyle(0xdd3333);
        
        // Draw rectangular part of key pin
        pin.keyPin.fillRect(-12, -50 + pin.driverPinLength - pin.currentHeight, 24, pin.keyPinLength - 8);
                
        // Update hook position to follow any moving pin
        if (pin.currentHeight > 0) {
            this.updateHookPosition(pin.index);
        }
        
        // Draw triangular bottom in pixel art style
        pin.keyPin.fillRect(-12, -50 + pin.driverPinLength - pin.currentHeight + pin.keyPinLength - 8, 24, 2);
        pin.keyPin.fillRect(-10, -50 + pin.driverPinLength - pin.currentHeight + pin.keyPinLength - 6, 20, 2);
        pin.keyPin.fillRect(-8, -50 + pin.driverPinLength - pin.currentHeight + pin.keyPinLength - 4, 16, 2);
        pin.keyPin.fillRect(-6, -50 + pin.driverPinLength - pin.currentHeight + pin.keyPinLength - 2, 12, 2);
        
        pin.driverPin.clear();
        pin.driverPin.fillStyle(0x3388dd);
        pin.driverPin.fillRect(-12, -50 - pin.currentHeight, 24, pin.driverPinLength);
        
        // Spring compresses as pins push up (segments get shorter and closer together)
        pin.spring.clear();
        pin.spring.fillStyle(0x666666);
        const springCompression = pin.currentHeight;
        const compressionFactor = Math.max(0.3, 1 - (springCompression / 60)); // Segments get shorter, minimum 30% size (1.2px)
        
        // Fixed spring top position
        const springTop = -130;
        // Spring bottom follows driver pin top
        const driverPinTop = -50 - pin.currentHeight;
        const springBottom = driverPinTop;
        const springHeight = springBottom - springTop;
        
        // Calculate total spring space and distribute segments evenly
        const totalSpringSpace = springHeight;
        const segmentSpacing = totalSpringSpace / 11; // 11 gaps between 12 segments - keep consistent spacing
        
        for (let s = 0; s < 12; s++) {
            const segmentHeight = 4 * compressionFactor;
            const segmentY = springTop + (s * segmentSpacing);
            
            if (segmentY + segmentHeight <= springBottom) { // Only show segments within spring bounds
                pin.spring.fillRect(-12, segmentY, 24, segmentHeight);
            }
        }
        
        // Check if the key/driver boundary is at the shear line (much higher position)
        const boundaryPosition = -50 + pin.driverPinLength - pin.currentHeight;
        const distanceToShearLine = Math.abs(boundaryPosition - shearLineY);
        
        // Calculate threshold based on sensitivity (same as pin setting logic)
        const baseThreshold = 8;
        const sensitivityFactor = (9 - this.thresholdSensitivity) / 8; // Updated for 1-8 range
        const threshold = baseThreshold * sensitivityFactor;
        
        if (distanceToShearLine < threshold && this.highlightPinAlignment) {
            // Show green highlight when boundary is at shear line (only if alignment highlighting is enabled)
            if (!pin.shearHighlight) {
                pin.shearHighlight = this.scene.add.graphics();
                pin.shearHighlight.fillStyle(0x00ff00, 0.4);
                pin.shearHighlight.fillRect(-22.5, -110, 45, 140);
                pin.container.addAt(pin.shearHighlight, 0); // Add at beginning to appear behind pins
            }
            
            // Check if highlight is transitioning from hidden to visible
            const wasHidden = !pin.shearHighlight.visible;
            pin.shearHighlight.setVisible(true);
            
            // Play feedback when highlight first appears
            if (wasHidden) {
                if (this.sounds.click) {
                    this.sounds.click.play();
                }
                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(100);
            }
                }
            }
        } else {
            if (pin.shearHighlight) {
                pin.shearHighlight.setVisible(false);
            }
        }
    }
    
    applyGravity() {
        // When tension is not applied, all pins fall back down (except overpicked ones)
        // Also, pins that are not binding fall back down even with tension
        this.pins.forEach(pin => {
            const shouldFall = !this.lockState.tensionApplied || (!this.shouldPinBind(pin) && !pin.isSet);
            if (pin.currentHeight > 0 && !pin.isOverpicked && shouldFall) {
                pin.currentHeight = Math.max(0, pin.currentHeight - 2.25); // Fall faster than lift (25% slower: 2.25 instead of 3)
                
                        // Update visual
        pin.keyPin.clear();
        pin.keyPin.fillStyle(0xdd3333);
        
        // Draw rectangular part of key pin
        pin.keyPin.fillRect(-12, -50 + pin.driverPinLength - pin.currentHeight, 24, pin.keyPinLength - 8);
        
                        // Update hook position to follow any moving pin
                this.updateHookPosition(pin.index);
                
                // Draw triangular bottom in pixel art style
                pin.keyPin.fillRect(-12, -50 + pin.driverPinLength - pin.currentHeight + pin.keyPinLength - 8, 24, 2);
                pin.keyPin.fillRect(-10, -50 + pin.driverPinLength - pin.currentHeight + pin.keyPinLength - 6, 20, 2);
                pin.keyPin.fillRect(-8, -50 + pin.driverPinLength - pin.currentHeight + pin.keyPinLength - 4, 16, 2);
                pin.keyPin.fillRect(-6, -50 + pin.driverPinLength - pin.currentHeight + pin.keyPinLength - 2, 12, 2);
                
                pin.driverPin.clear();
                pin.driverPin.fillStyle(0x3388dd);
                pin.driverPin.fillRect(-12, -50 - pin.currentHeight, 24, pin.driverPinLength);
                
                // Spring decompresses as pins fall
                pin.spring.clear();
                pin.spring.fillStyle(0x666666);
                const springCompression = pin.currentHeight;
                const compressionFactor = Math.max(0.3, 1 - (springCompression / 60)); // Segments get shorter, minimum 30% size (1.2px)
                
                // Fixed spring top position
                const springTop = -130;
                // Spring bottom follows driver pin top
                const driverPinTop = -50 - pin.currentHeight;
                const springBottom = driverPinTop;
                const springHeight = springBottom - springTop;
                
                // Calculate total spring space and distribute segments evenly
                const totalSpringSpace = springHeight;
                const segmentSpacing = totalSpringSpace / 11; // 11 gaps between 12 segments - keep consistent spacing
                
                for (let s = 0; s < 12; s++) {
                    const segmentHeight = 4 * compressionFactor;
                    const segmentY = springTop + (s * segmentSpacing);
                    
                    if (segmentY + segmentHeight <= springBottom) { // Only show segments within spring bounds
                        pin.spring.fillRect(-12, segmentY, 24, segmentHeight);
                    }
                }
                
                // Hide highlights when falling
                if (pin.shearHighlight) pin.shearHighlight.setVisible(false);
                if (pin.setHighlight) pin.setHighlight.setVisible(false);
                if (pin.bindingHighlight) pin.bindingHighlight.setVisible(false);
                if (pin.overpickedHighlight) pin.overpickedHighlight.setVisible(false);
                if (pin.failureHighlight) pin.failureHighlight.setVisible(false);
            } else if (pin.isSet && shouldFall) {
                // Set pins fall back down when tension is released
                pin.isSet = false;
                pin.keyPinHeight = 0;
                pin.driverPinHeight = 0;
                pin.currentHeight = 0;
                
                // Reset visual to original position
                pin.keyPin.clear();
                pin.keyPin.fillStyle(0xdd3333);
                pin.keyPin.fillRect(-12, -50 + pin.driverPinLength, 24, pin.keyPinLength - 8);
                pin.keyPin.fillRect(-12, -50 + pin.driverPinLength + pin.keyPinLength - 8, 24, 2);
                pin.keyPin.fillRect(-10, -50 + pin.driverPinLength + pin.keyPinLength - 6, 20, 2);
                pin.keyPin.fillRect(-8, -50 + pin.driverPinLength + pin.keyPinLength - 4, 16, 2);
                pin.keyPin.fillRect(-6, -50 + pin.driverPinLength + pin.keyPinLength - 2, 12, 2);
                
                pin.driverPin.clear();
                pin.driverPin.fillStyle(0x3388dd);
                pin.driverPin.fillRect(-12, -50, 24, pin.driverPinLength);
                
                // Reset spring
                pin.spring.clear();
                pin.spring.fillStyle(0x666666);
                const springTop = -130;
                const springBottom = -50;
                const springHeight = springBottom - springTop;
                const segmentSpacing = springHeight / 11;
                for (let s = 0; s < 12; s++) {
                    const segmentHeight = 4;
                    const segmentY = springTop + (s * segmentSpacing);
                    pin.spring.fillRect(-12, segmentY, 24, segmentHeight);
                }
                
                // Hide set highlight
                if (pin.setHighlight) pin.setHighlight.setVisible(false);
            }
        });
    }
    
    checkAllPinsCorrect() {
        const shearLineY = -45;
        const threshold = 8; // Same threshold as individual pin checking
        
        let allCorrect = true;
        
        this.pins.forEach(pin => {
            if (pin.isOverpicked) {
                allCorrect = false;
                return;
            }
            
            // Calculate current boundary position between key and driver pins
            const boundaryPosition = -50 + pin.driverPinLength - pin.currentHeight;
            const distanceToShearLine = Math.abs(boundaryPosition - shearLineY);
            
            // Check if driver pin is above shear line and key pin is below
            const driverPinBottom = boundaryPosition;
            const keyPinTop = boundaryPosition;
            
            // Driver pin should be above shear line, key pin should be below
            if (driverPinBottom > shearLineY + threshold || keyPinTop < shearLineY - threshold) {
                allCorrect = false;
            }
        });
        
        // If all pins are correctly positioned, set them all and complete the lock
        if (allCorrect && this.lockState.pinsSet < this.pinCount) {
            this.pins.forEach(pin => {
                if (!pin.isSet) {
                    pin.isSet = true;
                    
                    // Show set pin highlight
                    if (!pin.setHighlight) {
                        pin.setHighlight = this.scene.add.graphics();
                        pin.setHighlight.fillStyle(0x00ff00, 0.5);
                        pin.setHighlight.fillRect(-22.5, -110, 45, 140);
                        pin.container.addAt(pin.setHighlight, 0); // Add at beginning to appear behind pins
                    }
                    pin.setHighlight.setVisible(true);
                    
                    // Hide other highlights
                    if (pin.shearHighlight) pin.shearHighlight.setVisible(false);
                    if (pin.highlight) pin.highlight.setVisible(false);
                    if (pin.overpickedHighlight) pin.overpickedHighlight.setVisible(false);
                    if (pin.failureHighlight) pin.failureHighlight.setVisible(false);
                }
            });
            
            this.lockState.pinsSet = this.pinCount;
            this.updateFeedback("All pins correctly positioned! Lock picked successfully!");
            this.lockPickingSuccess();
        }
    }
    
    checkPinSet(pin) {
        // Check if the key/driver boundary is at the shear line
        const boundaryPosition = -50 + pin.driverPinLength - pin.currentHeight;
        const shearLineY = -45; // Shear line is at y=-45 (much higher position)
        const distanceToShearLine = Math.abs(boundaryPosition - shearLineY);
        const shouldBind = this.shouldPinBind(pin);
        
        // Calculate threshold based on sensitivity (1-8)
        // Higher sensitivity = smaller threshold (easier to set pins)
        const baseThreshold = 8;
        const sensitivityFactor = (9 - this.thresholdSensitivity) / 8; // Invert so higher sensitivity = smaller threshold
        const threshold = baseThreshold * sensitivityFactor;
        
        // Debug logging for threshold calculation
        if (distanceToShearLine < threshold + 2) { // Log when close to threshold
            console.log(`Pin ${pin.index + 1}: distance=${distanceToShearLine.toFixed(2)}, threshold=${threshold.toFixed(2)}, sensitivity=${this.thresholdSensitivity}`);
        }
        
        if (distanceToShearLine < threshold && shouldBind) {
            // Pin set successfully
            pin.isSet = true;
            
            // Set separate heights for key pin and driver pin
            pin.keyPinHeight = 0; // Key pin drops back to original position
            pin.driverPinHeight = 60; // Driver pin stays at shear line (60 units from base position)
            
            // Snap driver pin to shear line - calculate exact position
            const shearLineY = -45;
            const targetDriverBottom = shearLineY;
            const driverPinTop = targetDriverBottom - pin.driverPinLength;
            
            // Update driver pin to snap to shear line
            pin.driverPin.clear();
            pin.driverPin.fillStyle(0x3388dd);
            pin.driverPin.fillRect(-12, driverPinTop, 24, pin.driverPinLength);
            
            // Reset key pin to original position (falls back down)
            pin.keyPin.clear();
            pin.keyPin.fillStyle(0xdd3333);
            
            // Draw rectangular part of key pin
            pin.keyPin.fillRect(-12, -50 + pin.driverPinLength, 24, pin.keyPinLength - 8);
            
            // Draw triangular bottom in pixel art style
            pin.keyPin.fillRect(-12, -50 + pin.driverPinLength + pin.keyPinLength - 8, 24, 2);
            pin.keyPin.fillRect(-10, -50 + pin.driverPinLength + pin.keyPinLength - 6, 20, 2);
            pin.keyPin.fillRect(-8, -50 + pin.driverPinLength + pin.keyPinLength - 4, 16, 2);
            pin.keyPin.fillRect(-6, -50 + pin.driverPinLength + pin.keyPinLength - 2, 12, 2);
            
            // Reset spring to original position
            pin.spring.clear();
            pin.spring.fillStyle(0x666666);
            const springTop = -130; // Fixed spring top
            const springBottom = -50; // Driver pin top when not lifted
            const springHeight = springBottom - springTop;
            
            for (let s = 0; s < 12; s++) {
                const segmentHeight = 4;
                const segmentSpacing = springHeight / 12;
                
                // Calculate segment position from bottom up to ensure bottom segment touches driver pin
                const segmentY = springBottom - (segmentHeight + (11 - s) * segmentSpacing);
                pin.spring.fillRect(-12, segmentY, 24, segmentHeight);
            }
            
            // Show set pin highlight
            if (!pin.setHighlight) {
                pin.setHighlight = this.scene.add.graphics();
                pin.setHighlight.fillStyle(0x00ff00, 0.5);
                pin.setHighlight.fillRect(-22.5, -110, 45, 140);
                pin.container.addAt(pin.setHighlight, 0); // Add at beginning to appear behind pins
            }
            pin.setHighlight.setVisible(true);
            
            // Hide other highlights
            if (pin.shearHighlight) pin.shearHighlight.setVisible(false);
            if (pin.highlight) pin.highlight.setVisible(false);
            if (pin.overpickedHighlight) pin.overpickedHighlight.setVisible(false);
            if (pin.failureHighlight) pin.failureHighlight.setVisible(false);
            
            this.lockState.pinsSet++;
            
            // Play set sound
            if (this.sounds.set) {
                this.sounds.set.play();
                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(500);
            }
            }
            
            this.updateFeedback(`Pin ${pin.index + 1} set! (${this.lockState.pinsSet}/${this.pinCount})`);
            this.updateBindingPins();
            
            if (this.lockState.pinsSet === this.pinCount) {
                this.lockPickingSuccess();
            }
        } else if (pin.isOverpicked) {
            // Pin is overpicked - stays stuck until tension is released
            if (pin.isSet) {
                this.updateFeedback("Set pin overpicked! Release tension to reset.");
            } else {
                this.updateFeedback("Pin overpicked! Release tension to reset.");
            }
        } else if (pin.isSet) {
            // Set pin: key pin falls back down, driver pin stays at shear line
            pin.keyPinHeight = 0; // Key pin falls back to original position
            pin.overpickingTimer = null; // Reset overpicking timer
            
            // Redraw key pin at original position
            pin.keyPin.clear();
            pin.keyPin.fillStyle(0xdd3333);
            pin.keyPin.fillRect(-12, -50 + pin.driverPinLength, 24, pin.keyPinLength - 8);
            pin.keyPin.fillRect(-12, -50 + pin.driverPinLength + pin.keyPinLength - 8, 24, 2);
            pin.keyPin.fillRect(-10, -50 + pin.driverPinLength + pin.keyPinLength - 6, 20, 2);
            pin.keyPin.fillRect(-8, -50 + pin.driverPinLength + pin.keyPinLength - 4, 16, 2);
            pin.keyPin.fillRect(-6, -50 + pin.driverPinLength + pin.keyPinLength - 2, 12, 2);
            
            // Driver pin stays at shear line
            pin.driverPin.clear();
            pin.driverPin.fillStyle(0x3388dd);
            const shearLineY = -45;
            const driverPinY = shearLineY - pin.driverPinLength;
            pin.driverPin.fillRect(-12, driverPinY, 24, pin.driverPinLength);
            
            // Spring stays connected to driver pin at shear line
            pin.spring.clear();
            pin.spring.fillStyle(0x666666);
            const springTop = -130;
            const springBottom = shearLineY - pin.driverPinLength;
            const springHeight = springBottom - springTop;
            const segmentSpacing = springHeight / 11;
            for (let s = 0; s < 12; s++) {
                const segmentHeight = 4 * 0.3;
                const segmentY = springTop + (s * segmentSpacing);
                if (segmentY + segmentHeight <= springBottom) {
                    pin.spring.fillRect(-12, segmentY, 24, segmentHeight);
                }
            }
        } else {
            // Normal pin falls back down due to gravity
            pin.currentHeight = 0;
            
            // Reset key pin to original position
            pin.keyPin.clear();
            pin.keyPin.fillStyle(0xdd3333);
            
            // Draw rectangular part of key pin
            pin.keyPin.fillRect(-12, -50 + pin.driverPinLength, 24, pin.keyPinLength - 8);
            
            // Draw triangular bottom in pixel art style
            pin.keyPin.fillRect(-12, -50 + pin.driverPinLength + pin.keyPinLength - 8, 24, 2);
            pin.keyPin.fillRect(-10, -50 + pin.driverPinLength + pin.keyPinLength - 6, 20, 2);
            pin.keyPin.fillRect(-8, -50 + pin.driverPinLength + pin.keyPinLength - 4, 16, 2);
            pin.keyPin.fillRect(-6, -50 + pin.driverPinLength + pin.keyPinLength - 2, 12, 2);
            
            // Reset driver pin to original position
            pin.driverPin.clear();
            pin.driverPin.fillStyle(0x3388dd);
            pin.driverPin.fillRect(-12, -50, 24, pin.driverPinLength);
            
            // Reset spring to original position (all 12 segments visible)
            pin.spring.clear();
            pin.spring.fillStyle(0x666666);
            const springTop = -130; // Fixed spring top
            const springBottom = -50; // Driver pin top when not lifted
            const springHeight = springBottom - springTop;
            
            // Calculate total spring space and distribute segments evenly
            const totalSpringSpace = springHeight;
            const segmentSpacing = totalSpringSpace / 11; // 11 gaps between 12 segments
            
            for (let s = 0; s < 12; s++) {
                const segmentHeight = 4;
                const segmentY = springTop + (s * segmentSpacing);
                pin.spring.fillRect(-12, segmentY, 24, segmentHeight);
            }
            
            // Hide all highlights
            if (pin.shearHighlight) pin.shearHighlight.setVisible(false);
            if (pin.setHighlight) pin.setHighlight.setVisible(false);
        }
    }
    
    shouldPinBind(pin) {
        if (!this.lockState.tensionApplied) return false;
        
        // Find the next unset pin in binding order
        for (let order = 0; order < this.pinCount; order++) {
            const nextPin = this.pins.find(p => p.binding === order && !p.isSet);
            if (nextPin) {
                return pin.index === nextPin.index;
            }
        }
        return false;
    }
    
    updateBindingPins() {
        if (!this.lockState.tensionApplied || !this.highlightBindingOrder) {
            this.pins.forEach(pin => {
                // Hide binding highlight
                if (pin.bindingHighlight) {
                    pin.bindingHighlight.setVisible(false);
                }
            });
            return;
        }
        
        // Find the next unset pin in binding order
        for (let order = 0; order < this.pinCount; order++) {
            const nextPin = this.pins.find(p => p.binding === order && !p.isSet);
            if (nextPin) {
                this.pins.forEach(pin => {
                    if (pin.index === nextPin.index && !pin.isSet) {
                        // Show binding highlight for next pin
                        if (!pin.bindingHighlight) {
                            pin.bindingHighlight = this.scene.add.graphics();
                            pin.bindingHighlight.fillStyle(0xffff00, 0.6);
                            pin.bindingHighlight.fillRect(-22.5, -110, 45, 140);
                            pin.container.addAt(pin.bindingHighlight, 0); // Add at beginning to appear behind pins
                        }
                        pin.bindingHighlight.setVisible(true);
                        
                        // Play binding sound when highlighting next binding pin
                        if (this.sounds.binding) {
                            this.sounds.binding.play();
                        }
                    } else if (!pin.isSet) {
                        // Hide binding highlight for other pins
                        if (pin.bindingHighlight) {
                            pin.bindingHighlight.setVisible(false);
                        }
                    }
                });
                return;
            }
        }
        
        // All pins set
        this.pins.forEach(pin => {
            if (!pin.isSet && pin.bindingHighlight) {
                pin.bindingHighlight.setVisible(false);
            }
        });
    }
    
    resetAllPins() {
        this.pins.forEach(pin => {
            if (!pin.isSet) {
                pin.currentHeight = 0;
                pin.isOverpicked = false; // Reset overpicked state
                pin.keyPinHeight = 0; // Reset key pin height
                pin.driverPinHeight = 0; // Reset driver pin height
                
                // Reset key pin to original position
                pin.keyPin.clear();
                pin.keyPin.fillStyle(0xdd3333);
                
                // Draw rectangular part of key pin
                pin.keyPin.fillRect(-12, -50 + pin.driverPinLength, 24, pin.keyPinLength - 8);
                
                // Draw triangular bottom in pixel art style
                pin.keyPin.fillRect(-12, -50 + pin.driverPinLength + pin.keyPinLength - 8, 24, 2);
                pin.keyPin.fillRect(-10, -50 + pin.driverPinLength + pin.keyPinLength - 6, 20, 2);
                pin.keyPin.fillRect(-8, -50 + pin.driverPinLength + pin.keyPinLength - 4, 16, 2);
                pin.keyPin.fillRect(-6, -50 + pin.driverPinLength + pin.keyPinLength - 2, 12, 2);
                
                // Reset driver pin to original position
                pin.driverPin.clear();
                pin.driverPin.fillStyle(0x3388dd);
                pin.driverPin.fillRect(-12, -50, 24, pin.driverPinLength);
                
                // Reset spring to original position (all 12 segments visible)
                pin.spring.clear();
                pin.spring.fillStyle(0x666666);
                const springTop = -130; // Fixed spring top
                const springBottom = -50; // Driver pin top when not lifted
                const springHeight = springBottom - springTop;
                
                // Calculate total spring space and distribute segments evenly
                const totalSpringSpace = springHeight;
                const segmentSpacing = totalSpringSpace / 11; // 11 gaps between 12 segments
                
                for (let s = 0; s < 12; s++) {
                    const segmentHeight = 4;
                    const segmentY = springTop + (s * segmentSpacing);
                    pin.spring.fillRect(-12, segmentY, 24, segmentHeight);
                }
                
                // Hide all highlights
                if (pin.shearHighlight) pin.shearHighlight.setVisible(false);
                if (pin.setHighlight) pin.setHighlight.setVisible(false);
                if (pin.bindingHighlight) pin.bindingHighlight.setVisible(false);
            }
        });
    }
    
    updateFeedback(message) {
        this.feedback.textContent = message;
    }
    
    lockPickingSuccess() {
        // Animation configuration variables - easy to tweak
        const KEY_PIN_TOP_SHRINK = 10; // How much the key pin top moves down
        const KEY_PIN_BOTTOM_SHRINK = 5; // How much the key pin bottom moves up
        const KEY_PIN_TOTAL_SHRINK = KEY_PIN_TOP_SHRINK + KEY_PIN_BOTTOM_SHRINK; // Total key pin shrink
        const CHANNEL_MOVEMENT = 25; // How much channels move down
        const KEYWAY_SHRINK = 20; // How much keyway shrinks
        const WRENCH_VERTICAL_SHRINK = 60; // How much wrench vertical arm shrinks
        const WRENCH_HORIZONTAL_SHRINK = 5; // How much wrench horizontal arm gets thinner
        const WRENCH_MOVEMENT = 10; // How much wrench moves down
        
        this.gameState.isActive = false;
        
        // Play success sound
        if (this.sounds.success) {
            this.sounds.success.play();
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(500);
            }
        }
        
        this.updateFeedback("Lock picked successfully!");

        // Shrink key pins downward and add half circles to simulate cylinder rotation
        this.pins.forEach(pin => {
            // Hide all highlights
            if (pin.shearHighlight) pin.shearHighlight.setVisible(false);
            if (pin.setHighlight) pin.setHighlight.setVisible(false);
            if (pin.bindingHighlight) pin.bindingHighlight.setVisible(false);
            if (pin.overpickedHighlight) pin.overpickedHighlight.setVisible(false);
            if (pin.failureHighlight) pin.failureHighlight.setVisible(false);
            
            // Create squashed circle that expands and moves to stay aligned with key pin top
            const squashedCircle = this.scene.add.graphics();
            //was 0xdd3333 Red color (key pin color)
            squashedCircle.fillStyle(0xffffff); // white color for testing purposes
            squashedCircle.x = pin.x; // Center horizontally on the pin
            
            // Start position: aligned with the top of the key pin
            const startTopY = pin.y + (-50 + pin.driverPinLength); // Top of key pin position
            squashedCircle.y = startTopY;
            squashedCircle.setDepth(3); // Above driver pins so they're visible
            
            // Create a temporary object to hold the circle expansion data
            const circleData = { 
                width: 24, // Start full width (same as key pin)
                height: 2, // Start very thin (flat top)
                y: startTopY
            };
            
            // Animate the squashed circle expanding to full circle (stays at top of key pin)
            this.scene.tweens.add({
                targets: circleData,
                width: 24, // Full circle width (stays same)
                height: 16, // Full circle height (expands from 2 to 16)
                y: startTopY, // Stay at the top of the key pin (no movement)
                duration: 1400,
                ease: 'Cubic.easeInOut',
                onUpdate: function() {
                    squashedCircle.clear();
                    squashedCircle.fillStyle(0xff3333); // Red color (key pin color)
                    
                    // Calculate animation progress (0 to 1)
                    const progress = (circleData.height - 2) / (16 - 2); // From 2 to 16 height
                    
                    // Draw different circle shapes based on progress (widest in middle)
                    if (progress < 0.1) {
                        // Start: just a thin line (flat top)
                        squashedCircle.fillRect(-12, 0, 24, 2);
                    } else if (progress < 0.3) {
                        // Early: thin oval with middle bulge
                        squashedCircle.fillRect(-8, 0, 16, 2);     // narrow top
                        squashedCircle.fillRect(-12, 2, 24, 2);    // wide middle
                        squashedCircle.fillRect(-8, 4, 16, 2);     // narrow bottom
                    } else if (progress < 0.5) {
                        // Middle: growing circle with middle bulge
                        squashedCircle.fillRect(-6, 0, 12, 2);     // narrow top
                        squashedCircle.fillRect(-10, 2, 20, 2);    // wider
                        squashedCircle.fillRect(-12, 4, 24, 2);    // widest middle
                        squashedCircle.fillRect(-10, 6, 20, 2);    // wider
                        squashedCircle.fillRect(-6, 8, 12, 2);     // narrow bottom
                    } else if (progress < 0.7) {
                        // Later: more circle-like with middle bulge
                        squashedCircle.fillRect(-4, 0, 8, 2);      // narrow top
                        squashedCircle.fillRect(-8, 2, 16, 2);     // wider
                        squashedCircle.fillRect(-12, 4, 24, 2);    // widest middle
                        squashedCircle.fillRect(-12, 6, 24, 2);    // widest middle
                        squashedCircle.fillRect(-8, 8, 16, 2);     // wider
                        squashedCircle.fillRect(-4, 10, 8, 2);     // narrow bottom
                    } else if (progress < 0.9) {
                        // Almost full: near complete circle
                        squashedCircle.fillRect(-2, 0, 4, 2);      // narrow top
                        squashedCircle.fillRect(-6, 2, 12, 2);     // wider
                        squashedCircle.fillRect(-10, 4, 20, 2);    // wider
                        squashedCircle.fillRect(-12, 6, 24, 2);    // widest middle
                        squashedCircle.fillRect(-12, 8, 24, 2);    // widest middle
                        squashedCircle.fillRect(-10, 10, 20, 2);   // wider
                        squashedCircle.fillRect(-6, 12, 12, 2);    // wider
                        squashedCircle.fillRect(-2, 14, 4, 2);     // narrow bottom
                    } else {
                        // Full: complete pixel art circle
                        squashedCircle.fillRect(-2, 0, 4, 2);      // narrow top
                        squashedCircle.fillRect(-6, 2, 12, 2);     // wider
                        squashedCircle.fillRect(-10, 4, 20, 2);    // wider
                        squashedCircle.fillRect(-12, 6, 24, 2);    // widest middle
                        squashedCircle.fillRect(-12, 8, 24, 2);    // widest middle
                        squashedCircle.fillRect(-10, 10, 20, 2);   // wider
                        squashedCircle.fillRect(-6, 12, 12, 2);    // wider
                        squashedCircle.fillRect(-2, 14, 4, 2);     // narrow bottom
                    }
                    
                    // Update position
                    squashedCircle.y = circleData.y;
                }
            });
            
            // Animate key pin shrinking from both top and bottom
            const keyPinData = { height: pin.keyPinLength, topOffset: 0 };
            this.scene.tweens.add({
                targets: keyPinData,
                height: pin.keyPinLength - KEY_PIN_TOTAL_SHRINK, // Shrink by total amount
                topOffset: KEY_PIN_TOP_SHRINK, // Move top down
                duration: 1400,
                ease: 'Cubic.easeInOut',
                onUpdate: function() {
                    pin.keyPin.clear();
                    pin.keyPin.fillStyle(0xdd3333);
                    
                    // Calculate new position: top moves down, bottom moves up
                    const originalTopY = -50 + pin.driverPinLength; // Original top of key pin
                    const newTopY = originalTopY + keyPinData.topOffset; // Top moves down
                    const newBottomY = newTopY + keyPinData.height; // Bottom position
                    
                    // Draw rectangular part of key pin (shrunk from both ends)
                    pin.keyPin.fillRect(-12, newTopY, 24, keyPinData.height - 8);
                    
                    // Draw triangular bottom in pixel art style (bottom moves up)
                    pin.keyPin.fillRect(-12, newBottomY - 8, 24, 2);
                    pin.keyPin.fillRect(-10, newBottomY - 6, 20, 2);
                    pin.keyPin.fillRect(-8, newBottomY - 4, 16, 2);
                    pin.keyPin.fillRect(-6, newBottomY - 2, 12, 2);
                }
            });
            
            // Animate key pin channel rectangle moving down with the channel circles
            this.scene.tweens.add({
                targets: pin.channelRect,
                y: pin.channelRect.y + CHANNEL_MOVEMENT, // Move down by channel movement amount
                duration: 1400,
                ease: 'Cubic.easeInOut'
            });
        });

        // Animate the keyway shrinking (keeping bottom in place) to make cylinder appear to grow
        // Create a temporary object to hold the height value for tweening
        const keywayData = { height: 90 };
        this.scene.tweens.add({
            targets: keywayData,
            height: 90 - KEYWAY_SHRINK, // Shrink by keyway shrink amount
            duration: 1400,
            ease: 'Cubic.easeInOut',
            onUpdate: function() {
                this.keywayGraphics.clear();
                this.keywayGraphics.fillStyle(0x2a2a2a);
                // Move top down: y increases as height shrinks, keeping bottom at y=290
                const newY = 200 + (90 - keywayData.height); // Move top down
                this.keywayGraphics.fillRect(100, newY, 400, keywayData.height);
                this.keywayGraphics.lineStyle(1, 0x1a1a1a);
                this.keywayGraphics.strokeRect(100, newY, 400, keywayData.height);
            }.bind(this)
        });

        // Animate tension wrench shrinking and moving down
        if (this.tensionWrench) {
            // Create a temporary object to hold the height value for tweening
            const wrenchData = { height: 170, y: 0, horizontalHeight: 10 }; // Original vertical arm height, y offset, and horizontal arm height
            this.scene.tweens.add({
                targets: wrenchData,
                height: 170 - WRENCH_VERTICAL_SHRINK, // Shrink by vertical shrink amount
                y: WRENCH_MOVEMENT, // Move entire wrench down
                horizontalHeight: 10 - WRENCH_HORIZONTAL_SHRINK, // Make horizontal arm thinner
                duration: 1400,
                ease: 'Cubic.easeInOut',
                onUpdate: function() {
                    // Update the wrench graphics (both active and inactive states)
                    this.wrenchGraphics.clear();
                    this.wrenchGraphics.fillStyle(this.lockState.tensionApplied ? 0x00ff00 : 0x888888);
                    
                    // Calculate new top position (move top down as height shrinks)
                    const originalTop = -120; // Original top position
                    const newTop = originalTop + (170 - wrenchData.height) + wrenchData.y; // Move top down and add y offset
                    
                    // Long vertical arm (left side of L) - top moves down and shrinks
                    this.wrenchGraphics.fillRect(0, newTop, 10, wrenchData.height);
                    
                    // Short horizontal arm (bottom of L) - also moves down with top and gets thinner
                    this.wrenchGraphics.fillRect(0, newTop + wrenchData.height, 37.5, wrenchData.horizontalHeight);
                }.bind(this)
            });
        }

        // Channel rectangles are already created during initial render

        // Animate pixel-art circles (channels) moving down from above the shear line
        this.pins.forEach(pin => {
            // Calculate starting position: above the shear line (behind driver pins)
            const pinX = pin.x;
            const pinY = pin.y;
            const shearLineY = -45; // Shear line position
            const circleStartY = pinY + shearLineY - 20; // Start above shear line
            const circleEndY = circleStartY + CHANNEL_MOVEMENT; // Move down same distance as cylinder

            // Create pixel-art circle graphics
            const channelCircle = this.scene.add.graphics();
            channelCircle.x = pinX;
            channelCircle.y = circleStartY;
            // Pixel-art circle: red color (like key pins)
            const color = 0x333333; // Red color (key pin color)
            channelCircle.fillStyle(color, 1);
            // Create a proper circle shape with pixel-art steps (middle widest)
            channelCircle.fillRect(-6, 0, 12, 2);    // bottom (narrowest)
            channelCircle.fillRect(-8, 2, 16, 2);    // wider
            channelCircle.fillRect(-10, 4, 20, 2);   // wider
            channelCircle.fillRect(-12, 6, 24, 2);   // widest (middle)
            channelCircle.fillRect(-12, 8, 24, 2);   // widest (middle)
            channelCircle.fillRect(-10, 10, 20, 2);  // narrower
            channelCircle.fillRect(-8, 12, 16, 2);   // narrower
            channelCircle.fillRect(-6, 14, 12, 2);   // top (narrowest)
            channelCircle.setDepth(1); // Normal depth for circles

            // Animate the circle moving down
            this.scene.tweens.add({
                targets: channelCircle,
                y: circleEndY,
                duration: 1400,
                ease: 'Cubic.easeInOut',
            });
        });

        // Show success message immediately but delay the game completion
        const successHTML = `
            <div style="font-weight: bold; font-size: 18px; margin-bottom: 10px;">Lock picked successfully!</div>
        `;
        // this.showSuccess(successHTML, false, 2000);
        
        // Delay the actual game completion until animation finishes
        setTimeout(() => {
            // Now trigger the success callback that unlocks the game
            this.showSuccess(successHTML, true, 2000);
            this.gameResult = { lockable: this.lockable };
          }, 1500); // Wait 1.5 seconds (slightly longer than animation duration)
    }
    
    start() {
        super.start();
        this.gameState.isActive = true;
        this.lockState.tensionApplied = false;
        this.lockState.pinsSet = 0;
        this.updateProgress(0, this.pinCount);
    }
    
    complete(success) {
        if (this.game) {
            this.game.destroy(true);
            this.game = null;
        }
        super.complete(success, this.gameResult);
    }
    
    cleanup() {
        if (this.game) {
            this.game.destroy(true);
            this.game = null;
        }
        super.cleanup();
    }
    
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
    
    flashWrenchRed() {
        // Flash the tension wrench red to indicate tension is needed
        if (!this.wrenchGraphics) return;
        
        const originalFillStyle = this.lockState.tensionApplied ? 0x00ff00 : 0x888888;
        
        // Store original state
        const originalClear = this.wrenchGraphics.clear.bind(this.wrenchGraphics);
        
        // Flash red 3 times
        for (let i = 0; i < 3; i++) {
            this.scene.time.delayedCall(i * 150, () => {
                this.wrenchGraphics.clear();
                this.wrenchGraphics.fillStyle(0xff0000); // Red
                
                // Long vertical arm
                this.wrenchGraphics.fillRect(0, -120, 10, 170);
                // Short horizontal arm
                this.wrenchGraphics.fillRect(0, 40, 37.5, 10);
            });
            
            this.scene.time.delayedCall(i * 150 + 75, () => {
                this.wrenchGraphics.clear();
                this.wrenchGraphics.fillStyle(originalFillStyle); // Back to original color
                
                // Long vertical arm
                this.wrenchGraphics.fillRect(0, -120, 10, 170);
                // Short horizontal arm
                this.wrenchGraphics.fillRect(0, 40, 37.5, 10);
            });
        }
    }
    
    switchToPickMode() {
        // Switch from key selection mode to lockpicking mode
        console.log('Switching from key mode to lockpicking mode');
        
        // Hide the mode switch button
        const switchBtn = document.getElementById('lockpicking-switch-mode-btn');
        if (switchBtn) {
            switchBtn.style.display = 'none';
        }
        
        // Exit key mode
        this.keyMode = false;
        this.keySelectionMode = false;
        
        // Clean up key selection UI if visible
        if (this.keySelectionContainer) {
            this.keySelectionContainer.destroy();
            this.keySelectionContainer = null;
        }
        
        // Clean up any key visuals
        if (this.keyGroup) {
            this.keyGroup.destroy();
            this.keyGroup = null;
        }
        if (this.keyClickZone) {
            this.keyClickZone.destroy();
            this.keyClickZone = null;
        }
        
        // Show lockpicking tools
        if (this.tensionWrench) {
            this.tensionWrench.setVisible(true);
        }
        if (this.hookGroup) {
            this.hookGroup.setVisible(true);
        }
        if (this.wrenchText) {
            this.wrenchText.setVisible(true);
        }
        if (this.hookPickLabel) {
            this.hookPickLabel.setVisible(true);
        }
        
        // Reset pins to original positions
        this.lockConfig.resetPinsToOriginalPositions();
        
        // Update feedback
        this.updateFeedback("Lockpicking mode - Apply tension first, then lift pins in binding order");
    }
    
    showLockpickingTools() {
        // Show tension wrench and hook pick in lockpicking mode
        if (this.tensionWrench) {
            this.tensionWrench.setVisible(true);
        }
        if (this.hookGroup) {
            this.hookGroup.setVisible(true);
        }
        
        // Show labels
        if (this.wrenchText) {
            this.wrenchText.setVisible(true);
        }
        if (this.hookPickLabel) {
            this.hookPickLabel.setVisible(true);
        }
    }
    
    switchToKeyMode() {
        // Switch from lockpicking mode to key selection mode
        console.log('Switching from lockpicking mode to key mode');
        
        // Hide the mode switch button
        const switchBtn = document.getElementById('lockpicking-switch-to-keys-btn');
        if (switchBtn) {
            switchBtn.style.display = 'none';
        }
        
        // Enter key mode
        this.keyMode = true;
        this.keySelectionMode = true;
        
        // Hide lockpicking tools
        if (this.tensionWrench) {
            this.tensionWrench.setVisible(false);
        }
        if (this.hookGroup) {
            this.hookGroup.setVisible(false);
        }
        if (this.wrenchText) {
            this.wrenchText.setVisible(false);
        }
        if (this.hookPickLabel) {
            this.hookPickLabel.setVisible(false);
        }
        
        // Reset pins to original positions
        this.lockConfig.resetPinsToOriginalPositions();
        
        // Add mode switch back button (can switch back to lockpicking if available)
        if (this.canSwitchToPickMode) {
            const itemDisplayDiv = document.querySelector('.lockpicking-item-section');
            if (itemDisplayDiv) {
                // Remove any existing button container
                const existingButtonContainer = itemDisplayDiv.querySelector('div[style*="margin-top"]');
                if (existingButtonContainer) {
                    existingButtonContainer.remove();
                }
                
                // Add new button container
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
                switchModeBtn.onclick = () => this.switchToPickMode();
                
                buttonContainer.appendChild(switchModeBtn);
                itemDisplayDiv.appendChild(buttonContainer);
            }
        }
        
        // Show key selection UI with available keys
        if (this.availableKeys && this.availableKeys.length > 0) {
            this.createKeySelectionUI(this.availableKeys, this.requiredKeyId);
            this.updateFeedback("Select a key to use");
        } else {
            this.updateFeedback("No keys available");
        }
    }
} 