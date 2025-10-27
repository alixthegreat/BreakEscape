import { MinigameScene } from '../framework/base-minigame.js';
import { LockConfiguration } from './lock-configuration.js';
import { LockGraphics } from './lock-graphics.js';
import { KeyDataGenerator } from './key-data-generator.js';
import { KeySelection } from './key-selection.js';
import { KeyOperations } from './key-operations.js';
import { PinManagement } from './pin-management.js';
import { ToolManager } from './tool-manager.js';
import { KeyAnimation } from './key-animation.js';

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
                    this.pinMgmt.resetAllPins();
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
                    this.pinMgmt.resetAllPins();
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
                    self.updateFeedback("Click the key to insert it into the lock");
                } else if (self.keyMode && self.skipStartingKey) {
                    // Skip creating initial key, will show key selection instead
                    // But we still need to initialize keyData for the correct key
                    if (!self.keyData) {
                        self.keyDataGen.generateKeyDataFromPins();
                    }
                    self.toolMgr.hideLockpickingTools();
                    self.updateFeedback("Select a key to begin");
                } else {
                    self.updateFeedback("Apply tension first, then lift pins in binding order - only the binding pin can be set");
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
            this.updateFeedback('Error loading Phaser game: ' + error.message);
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
            const keyVisual = this.keyOps.createKeyVisual(keyData, keyWidth, keyHeight);
            keyVisual.setPosition(keyX, keyY);
            keySelectionContainer.add(keyVisual);
            
            // Make key clickable
            keyVisual.setInteractive(new Phaser.Geom.Rectangle(0, 0, keyWidth, keyHeight), Phaser.Geom.Rectangle.Contains);
            keyVisual.on('pointerdown', () => {
                // Close the popup
                keySelectionContainer.destroy();
                // Trigger key selection and insertion
                this.keyOps.selectKey(index, correctKeyIndex, keyData);
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
            this.keyOps.checkKeyCorrectness();
        }
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
        // Method moved to KeyOperations module - call via this.keyOps.createKeyBladeCollision()
        this.keyOps.createKeyBladeCollision();
    }
    
    getKeySurfaceHeightAtPosition(pinX, keyBladeStartX) {
        // Method moved to KeyOperations module - delegate to it
        return this.keyOps.getKeySurfaceHeightAtPosition(pinX, keyBladeStartX);
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
            this.pinMgmt.updateBindingPins();
            
            if (this.lockState.pinsSet === this.pinCount) {
                this.keyAnim.lockPickingSuccess();
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
    
    updateFeedback(message) {
        this.feedback.textContent = message;
    }
    
    complete(success) {
        if (this.game) {
            this.game.destroy(true);
            this.game = null;
        }
        super.complete(success, this.gameResult);
    }
    
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
    
} 