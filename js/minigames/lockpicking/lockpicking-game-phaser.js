import { MinigameScene } from '../framework/base-minigame.js';

// Phaser Lockpicking Minigame Scene implementation
export class LockpickingMinigamePhaser extends MinigameScene {
    constructor(container, params) {
        super(container, params);
        
        // Ensure params is an object
        params = params || {};
        
        this.lockable = params.lockable || 'default-lock';
        this.difficulty = params.difficulty || 'medium';
        // Use passed pinCount if provided, otherwise calculate based on difficulty
        this.pinCount = params.pinCount || (this.difficulty === 'easy' ? 3 : this.difficulty === 'medium' ? 4 : 5);
        
        // Threshold sensitivity for pin setting (1-10, higher = more sensitive)
        this.thresholdSensitivity = params.thresholdSensitivity || 5;
        
        // Whether to highlight binding order
        this.highlightBindingOrder = params.highlightBindingOrder !== undefined ? params.highlightBindingOrder : true;
        
        // Whether to highlight pin alignment (shear line proximity)
        this.highlightPinAlignment = params.highlightPinAlignment !== undefined ? params.highlightPinAlignment : true;
        
        // Lift speed parameter (can be set to fast values, but reasonable default for hard)
        this.liftSpeed = params.liftSpeed || (this.difficulty === 'hard' ? 1.2 : 1);
        
        // Close button customization
        this.closeButtonText = params.closeButtonText || '×';
        this.closeButtonAction = params.closeButtonAction || 'close';
        
        // Key mode settings
        this.keyMode = params.keyMode || false;
        this.keyData = params.keyData || null; // Key data with cuts/ridges
        this.keyInsertionProgress = 0; // 0 = not inserted, 1 = fully inserted
        this.keyInserting = false;
        
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
            liftSpeed: this.liftSpeed
        });
        
        this.pins = [];
        this.lockState = {
            tensionApplied: false,
            pinsSet: 0,
            currentPin: null
        };
        
        this.game = null;
        this.scene = null;
    }
    
    init() {
        super.init();
        
        // Customize the close button
        const closeBtn = document.getElementById('minigame-close');
        if (closeBtn) {
            closeBtn.textContent = this.closeButtonText;
            
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
        
        this.setupPhaserGame();
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
                self.createLockBackground();
                self.createTensionWrench();
                self.createPins();
                self.createHookPick();
                self.createShearLine();
                
                // Create key if in key mode
                if (self.keyMode) {
                    self.createKey();
                    self.hideLockpickingTools();
                    self.updateFeedback("Click the key to insert it into the lock");
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
    

    
    createLockBackground() {
        const graphics = this.scene.add.graphics();
        graphics.lineStyle(2, 0x666666);
        graphics.strokeRect(100, 50, 400, 300);
        graphics.fillStyle(0x555555);
        graphics.fillRect(100, 50, 400, 300);
        
        // Create key cylinder - rectangle from shear line to near bottom
        this.cylinderGraphics = this.scene.add.graphics();
        this.cylinderGraphics.fillStyle(0xcd7f32); // Bronze color
        this.cylinderGraphics.fillRect(100, 155, 400, 180); // From shear line (y=155) to near bottom (y=335)
        this.cylinderGraphics.lineStyle(1, 0x8b4513); // Darker bronze border
        this.cylinderGraphics.strokeRect(100, 155, 400, 180);
        
        // Create keyway - space where key would enter (moved higher to align with shear line)
        this.keywayGraphics = this.scene.add.graphics();
        this.keywayGraphics.fillStyle(0x2a2a2a); // Dark gray for keyway
        this.keywayGraphics.fillRect(100, 170, 400, 120); // Moved higher (y=170) and increased height (120)
        this.keywayGraphics.lineStyle(1, 0x1a1a1a); // Darker border
        this.keywayGraphics.strokeRect(100, 170, 400, 120);
    }
    
    createTensionWrench() {
        const wrenchX = 80; // Position to the left of the lock
        const wrenchY = 160; // Position down by half the arm width (5 units) from shear line
        
        // Create tension wrench container
        this.tensionWrench = this.scene.add.container(wrenchX, wrenchY);
        
        // Create L-shaped tension wrench graphics (25% larger)
        this.wrenchGraphics = this.scene.add.graphics();
        this.wrenchGraphics.fillStyle(0x888888);
        
        // Long vertical arm (left side of L) - extended above the lock
        this.wrenchGraphics.fillRect(0, -120, 10, 170);
        
        // Short horizontal arm (bottom of L) extending into keyway - 25% larger
        this.wrenchGraphics.fillRect(0, 40, 37.5, 10);
        
        this.tensionWrench.add(this.wrenchGraphics);
        
        // Make it interactive - extended hit area to match pin click zones (down to keyway bottom)
        // Covers vertical arm, horizontal arm, handle, and extends down to bottom of keyway
        this.tensionWrench.setInteractive(new Phaser.Geom.Rectangle(-12.5, -138.75, 60, 268.75), Phaser.Geom.Rectangle.Contains);
        
        // Add text
        const wrenchText = this.scene.add.text(-10, 58, 'Tension Wrench', {
            fontSize: '18px',
            fontFamily: 'VT323',
            fill: '#00ff00',
            fontWeight: 'bold'
        });
        wrenchText.setOrigin(0.5);
        wrenchText.setDepth(100); // Bring to front
        this.tensionWrench.add(wrenchText);
        
        // Store reference to wrench text for hiding
        this.wrenchText = wrenchText;
        
        // Add click handler
        this.tensionWrench.on('pointerdown', () => {
            this.lockState.tensionApplied = !this.lockState.tensionApplied;
            
            // Play tension sound
            if (this.sounds.tension) {
                this.sounds.tension.play();
                navigator.vibrate([50]);
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
        });
    }
    
    createHookPick() {
        // Create hook pick that comes in from the left side
        // Handle is off-screen, long horizontal arm curves up to bottom of key pin 1
        
        // Calculate pin spacing and margin (same as createPins)
        const pinSpacing = 400 / (this.pinCount + 1);
        const margin = pinSpacing * 0.75; // 25% smaller margins
        
        // Hook target coordinates (can be easily changed to point at any pin or coordinate)
        const targetX = 100 + margin + (this.pinCount - 1) * pinSpacing; // Last pin X position
        const targetY = -50 + this.pins[this.pinCount - 1].driverPinLength + this.pins[this.pinCount - 1].keyPinLength; // Last pin bottom Y
        
        // Hook should start 2/3rds down the keyway (keyway is from y=200 to y=290, so 2/3rds down is y=260)
        const keywayStartY = 200;
        const keywayEndY = 290;
        const keywayHeight = keywayEndY - keywayStartY;
        const hookEntryY = keywayStartY + (keywayHeight * 2/3); // 2/3rds down the keyway
        
        // Hook pick dimensions and positioning
        const handleWidth = 20;
        const handleHeight = 240; // 4x longer (was 60)
        const armWidth = 8;
        const armLength = 140; // Horizontal arm length
        
        // Start position (handle off-screen to the left)
        const startX = -120; // Handle starts further off-screen (was -30)
        const startY = hookEntryY; // Handle center Y position (2/3rds down keyway)
        
        // Calculate hook dimensions based on target
        const hookStartX = startX + handleWidth + armLength;
        const hookStartY = startY;
        
        // Hook segments configuration
        const segmentSize = 8;
        const diagonalSegments = 2; // Number of diagonal segments
        const verticalSegments = 3; // Number of vertical segments (increased by 1)
        const segmentStep = 8; // Distance between segment centers
        
        // Calculate total hook height needed
        const totalHookHeight = (diagonalSegments + verticalSegments) * segmentStep;
        
        // Calculate required horizontal length to reach target
        const requiredHorizontalLength = targetX - hookStartX - totalHookHeight + 48; // Add 48px to reach target (24px + 24px further right)
        
        // Adjust horizontal length to align with target
        const curveStartX = hookStartX + requiredHorizontalLength;
        
        // Calculate the tip position (end of the hook)
        const tipX = curveStartX + (diagonalSegments * segmentStep);
        const tipY = hookStartY - (diagonalSegments * segmentStep) - (verticalSegments * segmentStep);
        
        // Create a container for the hook pick with rotation center at the tip
        this.hookGroup = this.scene.add.container(0, 0);
        this.hookGroup.x = tipX;
        this.hookGroup.y = tipY;
        
        // Create graphics for hook pick (relative to group center)
        const hookPickGraphics = this.scene.add.graphics();
        hookPickGraphics.fillStyle(0x888888); // Gray color for the pick
        hookPickGraphics.lineStyle(2, 0x888888); // Darker border
        
        // Calculate positions relative to group center (tip position)
        const relativeStartX = startX - tipX;
        const relativeStartY = startY - tipY;
        const relativeHookStartX = hookStartX - tipX;
        const relativeCurveStartX = curveStartX - tipX;
        
        // Draw the handle (off-screen)
        hookPickGraphics.fillRect(relativeStartX, relativeStartY - handleHeight/2, handleWidth, handleHeight);
        hookPickGraphics.strokeRect(relativeStartX, relativeStartY - handleHeight/2, handleWidth, handleHeight);
        
        // Draw the horizontal arm (extends from handle to near the lock)
        const armStartX = relativeStartX + handleWidth;
        const armEndX = armStartX + armLength;
        hookPickGraphics.fillRect(armStartX, relativeStartY - armWidth/2, armLength, armWidth);
        hookPickGraphics.strokeRect(armStartX, relativeStartY - armWidth/2, armLength, armWidth);
        
        // Draw horizontal part to curve start
        hookPickGraphics.fillRect(relativeHookStartX, relativeStartY - armWidth/2, relativeCurveStartX - relativeHookStartX, armWidth);
        hookPickGraphics.strokeRect(relativeHookStartX, relativeStartY - armWidth/2, relativeCurveStartX - relativeHookStartX, armWidth);
        
        // Draw the hook segments: diagonal then vertical
        // First 2 segments: up and right (2x scale)
        for (let i = 0; i < diagonalSegments; i++) {
            const x = relativeCurveStartX + (i * segmentStep); // Move right 8px each segment
            const y = relativeStartY - (i * segmentStep); // Move up 8px each segment
            hookPickGraphics.fillRect(x - armWidth/2, y - segmentSize/2, armWidth, segmentSize);
            hookPickGraphics.strokeRect(x - armWidth/2, y - segmentSize/2, armWidth, segmentSize);
        }
        
        // Next 3 segments: straight up (increased by 1 segment)
        for (let i = 0; i < verticalSegments; i++) {
            const x = relativeCurveStartX + (diagonalSegments * segmentStep); // Stay at the rightmost position from diagonal segments
            const y = relativeStartY - (diagonalSegments * segmentStep) - (i * segmentStep); // Continue moving up from where we left off
            hookPickGraphics.fillRect(x - armWidth/2, y - segmentSize/2, armWidth, segmentSize);
            hookPickGraphics.strokeRect(x - armWidth/2, y - segmentSize/2, armWidth, segmentSize);
        }
        
        // Add graphics to container
        this.hookGroup.add(hookPickGraphics);
        
        // Add hook pick label
        const hookPickLabel = this.scene.add.text(-10, 85, 'Hook Pick', {
            fontSize: '18px',
            fontFamily: 'VT323',
            fill: '#00ff00',
            fontWeight: 'bold'
        });
        hookPickLabel.setOrigin(0.5);
        hookPickLabel.setDepth(100); // Bring to front
        this.tensionWrench.add(hookPickLabel);
        
        // Store reference to hook pick label for hiding
        this.hookPickLabel = hookPickLabel;
        
        // Debug logging
        console.log('Hook positioning debug:', {
            targetX,
            targetY,
            hookStartX,
            hookStartY,
            tipX,
            tipY,
            totalHookHeight,
            requiredHorizontalLength,
            curveStartX,
            pinCount: this.pinCount,
            pinSpacing,
            margin
        });
        
        // Store reference to hook pick for animations
        this.hookPickGraphics = hookPickGraphics;
        
        // Store hook configuration for dynamic updates
        this.hookConfig = {
            targetPin: this.pinCount - 1, // Default to last pin (should be 4 for 5 pins)
            lastTargetedPin: this.pinCount - 1, // Track the last pin that was targeted
            baseTargetX: targetX,
            baseTargetY: targetY,
            hookStartX: hookStartX,
            hookStartY: hookStartY,
            diagonalSegments: diagonalSegments,
            verticalSegments: verticalSegments,
            segmentStep: segmentStep,
            segmentSize: segmentSize,
            armWidth: armWidth,
            curveStartX: curveStartX,
            tipX: tipX,
            tipY: tipY,
            rotationCenterX: tipX,
            rotationCenterY: tipY
        };
        
        console.log('Hook config initialized - targetPin:', this.hookConfig.targetPin, 'pinCount:', this.pinCount);
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
        
        // Create key graphics
        this.keyGraphics = this.scene.add.graphics();
        this.keyGraphics.fillStyle(0xcccccc); // Silver color
        // Removed outline - no lineStyle
        
        // Draw key parts from right to left
        // 1. Circle (handle) - rightmost part - pixel art style
        this.drawPixelArtCircle(keyCircleRadius, 0, keyCircleRadius);
        
        // 2. Shoulder - wider rectangle
        const shoulderX = keyCircleRadius * 1.9; // After circle
        this.keyGraphics.fillRect(shoulderX, -keyShoulderHeight/2, keyShoulderWidth, keyShoulderHeight);
        
        // 3. Blade - main part with cuts/ridges
        const bladeX = shoulderX + keyShoulderWidth;
        this.keyGraphics.fillRect(bladeX, -keyBladeHeight/2, keyBladeWidth, keyBladeHeight);
        
        // Add cuts/ridges to the blade based on key data
        this.addKeyCuts(bladeX, -keyBladeHeight/2, keyBladeWidth, keyBladeHeight, keyBladeWidth);
        
        this.keyGroup.add(this.keyGraphics);
        
        // Set key graphics to low z-index so it appears behind pins
        this.keyGroup.setDepth(1); // Set low z-index so key appears behind pins
        
        // Create click zone covering the entire keyway area in key mode
        // Position click zone to cover from leftmost blade tip through the entire keyway and beyond
        const keywayClickWidth = fullKeyLength + keywayWidth + 200; // Extend much further right
        const clickZone = this.scene.add.rectangle(0, 0, 
            keywayClickWidth, keyShoulderHeight, 0x000000, 0);
        clickZone.setDepth(9999); // Very high z-index for clickability
        clickZone.setInteractive();
        
        // Add click zone to key group and sync its position
        this.keyGroup.add(clickZone);
        this.keyClickZone = clickZone;
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
    
    addKeyCuts(bladeX, bladeY, bladeWidth, bladeHeight, totalBladeWidth) {
        if (!this.keyData || !this.keyData.cuts) return;
        
        // Draw cuts/ridges on the blade
        this.keyGraphics.fillStyle(0x2a2a2a); // Dark color for cuts
        
        const cutWidth = 24; // Width of each cut (same as pin width)
        
        // Calculate pin spacing to match the lock's pin positions
        const pinSpacing = 400 / (this.pinCount + 1);
        const margin = pinSpacing * 0.75;
        
        // Space cuts to align with actual pin positions
        this.keyData.cuts.forEach((cutDepth, index) => {
            if (index >= this.pinCount) return; // Only create cuts for existing pins
            
            // Calculate pin position in the lock
            const pinX = 100 + margin + index * pinSpacing;
            
            // Calculate cut position relative to the blade
            const cutX = bladeX + (pinX - 100); // Offset from blade start to match pin position
            
            // The cut depth directly represents how deep the divot should be (in pixels)
            // Small pin = small cut, Large pin = large cut
            const cutHeight = cutDepth; // cutDepth is already in pixels
            
            // Draw main cut only on the top of the key (divot)
            this.keyGraphics.fillRect(cutX - cutWidth/2, bladeY, cutWidth, cutHeight);
            
            // Draw triangular cuts extending to halfway between pins
            if (index < this.pinCount - 1) {
                // Calculate next pin position
                const nextPinX = 100 + margin + (index + 1) * pinSpacing;
                const nextCutX = bladeX + (nextPinX - 100);
                
                // Calculate halfway point between current and next cut
                const halfwayX = cutX + (nextCutX - cutX) / 2;
                
                // Draw triangular cut from current cut to halfway point (right side)
                this.drawTriangularCut(cutX + cutWidth/2, bladeY, halfwayX, bladeY, cutHeight);
            }
            
            // Draw triangular cut from previous halfway point to current cut (left side)
            if (index > 0) {
                // Calculate previous pin position
                const prevPinX = 100 + margin + (index - 1) * pinSpacing;
                const prevCutX = bladeX + (prevPinX - 100);
                
                // Calculate halfway point between previous and current cut
                const halfwayX = prevCutX + (cutX - prevCutX) / 2;
                
                // Draw triangular cut from halfway point to current cut (left side)
                // For left triangles, we want height to increase as we move toward the cut
                this.drawTriangularCut(halfwayX, bladeY, cutX - cutWidth/2, bladeY, cutHeight, true);
            } else if (index === 0) {
                // For the first pin, draw triangular cut from left edge of key blade to first cut
                const keyLeftEdge = bladeX;
                
                // Draw triangular cut from left edge to first cut (height increases toward the cut)
                this.drawTriangularCut(keyLeftEdge, bladeY, cutX - cutWidth/2, bladeY, cutHeight, true);
            }
            
            // For the last pin, add triangular cuts extending to the right edge of the key
            if (index === this.pinCount - 1) {
                // Calculate hypothetical next pin position
                const nextPinX = 100 + margin + (index + 1) * pinSpacing;
                const nextCutX = bladeX + (nextPinX - 100);
                
                // Calculate halfway point between last pin and hypothetical next pin
                const halfwayX = cutX + (nextCutX - cutX) / 2;
                
                // Calculate the right edge of the key blade
                const keyRightEdge = bladeX + totalBladeWidth;
                
                // Draw triangular cut from last pin to halfway point
                this.drawTriangularCut(cutX + cutWidth/2, bladeY, halfwayX, bladeY, cutHeight);
                
                // Draw triangular end that meets in the middle (pointed tip)
                // Use half the blade height for a consistent 45-degree angle regardless of cut depth
                const triangularEndHeight = bladeHeight / 2;
                this.drawTriangularEnd(halfwayX, bladeY, keyRightEdge, bladeY + bladeHeight, triangularEndHeight);
            }
        });
        
        // Reset fill style
        this.keyGraphics.fillStyle(0xcccccc);
    }
    
    drawTriangularCut(startX, startY, endX, endY, height, isLeftTriangle = false) {
        // Draw a triangular cut using pixel art style
        const width = Math.abs(endX - startX);
        const stepSize = 4; // Consistent pixel size for steps
        const steps = Math.max(1, Math.floor(width / stepSize)); // Create steps for pixel art effect
        
        for (let i = 0; i <= steps; i++) {
            const progress = i / steps;
            const x = startX + (endX - startX) * progress;
            
            let stepHeight;
            
            if (isLeftTriangle) {
                // Left triangle: height increases as we move toward the cut
                stepHeight = height * progress;
            } else {
                // Right triangle: height decreases as we move away from the cut
                stepHeight = height * (1 - progress);
            }
            
            // Draw horizontal line at this step
            const stepWidth = width / steps;
            this.keyGraphics.fillRect(x, startY, stepWidth, stepHeight);
        }
    }
    
    drawTriangularCutDownward(startX, startY, endX, endY, height) {
        // Draw a downward triangular cut using pixel art style (cuts off top corner)
        const width = Math.abs(endX - startX);
        const stepSize = 4; // Consistent pixel size for steps
        const steps = Math.max(1, Math.floor(width / stepSize)); // Create steps for pixel art effect
        
        for (let i = 0; i <= steps; i++) {
            const progress = i / steps;
            const x = startX + (endX - startX) * progress;
            
            // Height increases as we move toward the end (cutting deeper into the key)
            const stepHeight = height * progress;
            
            // Draw horizontal line at this step, starting from the top and cutting downward
            const stepWidth = width / steps;
            this.keyGraphics.fillRect(x, startY, stepWidth, stepHeight);
        }
    }
    
    drawTriangularCutUpward(startX, startY, endX, endY, height) {
        // Draw an upward triangular cut using pixel art style (cuts off bottom corner)
        const width = Math.abs(endX - startX);
        const stepSize = 4; // Consistent pixel size for steps
        const steps = Math.max(1, Math.floor(width / stepSize)); // Create steps for pixel art effect
        
        for (let i = 0; i <= steps; i++) {
            const progress = i / steps;
            const x = startX + (endX - startX) * progress;
            
            // Height increases as we move toward the end (cutting deeper into the key)
            const stepHeight = height * progress;
            
            // Draw horizontal line at this step, starting from the bottom and cutting upward
            const stepWidth = width / steps;
            this.keyGraphics.fillRect(x, startY - stepHeight, stepWidth, stepHeight);
        }
    }
    
    drawTriangularEnd(startX, startY, endX, endY, maxHeight) {
        // Draw a triangular end that creates a pointed tip by cutting from both top and bottom
        // The cuts meet in the middle to form a point
        const width = Math.abs(endX - startX);
        const stepSize = 4; // Consistent pixel size for steps
        const steps = Math.max(1, Math.floor(width / stepSize)); // Create steps for pixel art effect
        
        for (let i = 0; i <= steps; i++) {
            const progress = i / steps;
            const x = startX + (endX - startX) * progress;
            
            // Calculate height for this step - creates a triangular shape
            // Height increases as we move toward the end, but we cut from both top and bottom
            const stepHeight = maxHeight * progress;
            
            // Draw horizontal line at this step, cutting from the top
            const stepWidth = width / steps;
            this.keyGraphics.fillRect(x, startY, stepWidth, stepHeight);
            
            // Draw horizontal line at this step, cutting from the bottom
            this.keyGraphics.fillRect(x, endY - stepHeight, stepWidth, stepHeight);
        }
    }
    
    drawPixelArtCircle(centerX, centerY, radius) {
        // Draw a pixel art circle using consistent pixel sizes
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
                
                this.keyGraphics.fillRect(roundedX, y, roundedWidth, stepSize);
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
        
        // Calculate target position (shoulder stops at keyway edge, not fully inserted)
        const targetX = this.keyConfig.keywayStartX - this.keyConfig.shoulderWidth;
        const startX = this.keyGroup.x;
        
        // Calculate target position - move key so RIGHT edge of shoulder touches LEFT edge of keyway
        // Key starts at -600px, needs to move so shoulder right edge (at position 286px from center) touches keyway left edge
        const keywayLeftEdge = this.keyConfig.keywayStartX; // 100px
        const shoulderRightEdge = this.keyConfig.circleRadius * 1.9 + this.keyConfig.shoulderWidth; // 266 + 20 = 286px from key group center
        const targetKeyGroupX = keywayLeftEdge - shoulderRightEdge; // 100 - 286 = -186px
        const halfwayX = targetKeyGroupX;
        
        // Create smooth animation from left to right
        this.scene.tweens.add({
            targets: this.keyGroup,
            x: halfwayX,
            duration: 4000, // 4 seconds for slower insertion
            ease: 'Cubic.easeInOut',
            onUpdate: (tween) => {
                // Calculate progress (0 to 1) - key moves from left to right
                const progress = (this.keyGroup.x - startX) / (halfwayX - startX);
                this.keyInsertionProgress = Math.max(0, Math.min(1, progress));
                
                console.log('Animation update - key position:', this.keyGroup.x, 'progress:', this.keyInsertionProgress);
                
                // Update pin positions based on key cuts as the key is inserted
                this.updatePinsWithKeyInsertion(this.keyInsertionProgress);
            },
            onComplete: () => {
                this.keyInserting = false;
                this.keyInsertionProgress = 0.5; // Only halfway inserted
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
        
        // Check if pins are aligned at the shear line
        let isCorrect = true;
        const shearLineY = -45; // Shear line position
        const tolerance = 5; // Tolerance for shear line alignment
        
        this.pins.forEach((pin, index) => {
            if (index >= this.pinCount) return;
            
            // Calculate the current position of the key pin top
            const pinWorldY = 200;
            const pinCurrentY = pinWorldY - 50 + pin.driverPinLength + pin.keyPinLength - pin.currentHeight;
            const keyPinTop = pinCurrentY - pin.keyPinLength;
            
            // Check if the key pin top is at the shear line
            const distanceToShearLine = Math.abs(keyPinTop - shearLineY);
            if (distanceToShearLine > tolerance) {
                isCorrect = false;
            }
        });
        
        if (isCorrect) {
            // Key is correct - all pins are aligned at the shear line
            this.updateFeedback("Key fits perfectly! Lock unlocked.");
            
            // Play success sound
            if (this.sounds.success) {
                this.sounds.success.play();
            }
            
            // Complete the minigame
            setTimeout(() => {
                this.complete(true);
            }, 1000);
        } else {
            // Key is wrong
            this.updateFeedback("Wrong key! Try a different one.");
            
            // Play wrong sound
            if (this.sounds.wrong) {
                this.sounds.wrong.play();
            }
            
            // Reset key position
            setTimeout(() => {
                this.updateKeyPosition(0);
            }, 1000);
        }
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
        if (!this.keyCollisionRects || !this.keyConfig) return;
        
        console.log('Updating pins with key insertion, progress:', progress);
        
        // Calculate key blade position relative to the lock
        const keyBladeStartX = this.keyGroup.x + this.keyConfig.circleRadius * 2 + this.keyConfig.shoulderWidth;
        const keyBladeEndX = keyBladeStartX + this.keyConfig.bladeWidth;
        
        // Key blade base position in world coordinates
        const keyBladeBaseY = this.keyGroup.y - this.keyConfig.bladeHeight / 2;
        
        // Check each pin for collision with the key blade
        this.pins.forEach((pin, index) => {
            if (index >= this.pinCount) return;
            
            // Calculate pin position in the lock
            const pinSpacing = 400 / (this.pinCount + 1);
            const margin = pinSpacing * 0.75;
            const pinX = 100 + margin + index * pinSpacing;
            
            // Calculate how far the key has moved and if this pin is currently under the key blade
            // The key blade starts at keyBladeStartX and ends at keyBladeEndX
            // A pin is affected when the key blade is passing underneath it
            const pinIsUnderKeyBlade = pinX >= keyBladeStartX && pinX <= keyBladeEndX;
            
            // Check if this pin is under the key blade
            if (pinIsUnderKeyBlade) {
                // Calculate the key surface height at this pin's X position as the key moves underneath
                const keySurfaceY = this.getKeySurfaceHeightAsKeyMoves(pinX, keyBladeStartX, keyBladeBaseY);
                
                // Calculate where the key pin bottom should be to sit on the key surface
                const pinRestY = 200 - 50 + pin.driverPinLength + pin.keyPinLength; // Pin rest position in world coordinates
                const targetKeyPinBottom = keySurfaceY;
                
                // Calculate required lift to move key pin bottom from rest to key surface
                const requiredLift = pinRestY - targetKeyPinBottom;
                
                // Debug logging to understand the coordinate system
                console.log(`Pin ${index} debug - pinRestY: ${pinRestY}, keySurfaceY: ${keySurfaceY}, requiredLift: ${requiredLift}, keyBladeBaseY: ${keyBladeBaseY}`);
                
                // Apply lift to sit on key surface (use smooth movement like hook pick)
                // Ensure we never have negative lift (which would cause pin to drop below rest position)
                const targetLift = Math.max(0, requiredLift);
                
                // Smooth movement toward target like hook pick collision
                if (pin.currentHeight < targetLift) {
                    pin.currentHeight = Math.min(targetLift, pin.currentHeight + 8); // Fast lift when key pushes up
                } else if (pin.currentHeight > targetLift) {
                    pin.currentHeight = Math.max(targetLift, pin.currentHeight - 4); // Slower fall when key pulls down
                }
                
                console.log(`Pin ${index} at X: ${pinX} - under key blade: ${pinIsUnderKeyBlade}, key surface Y: ${keySurfaceY}, target lift: ${targetLift}, current: ${pin.currentHeight}`);
            } else {
                // Pin is not under key blade or key hasn't reached it yet - return to rest position
                pin.currentHeight = Math.max(0, pin.currentHeight - 4);
            }
            
            // Update pin visuals (correct function name)
            this.updatePinVisuals(pin);
        });
    }
    
    getKeySurfaceHeightAsKeyMoves(pinX, keyBladeStartX, keyBladeBaseY) {
        // Calculate the key surface height as the key moves underneath the pin
        // This creates the effect of pins following the key's surface contours
        
        const bladeWidth = this.keyConfig.bladeWidth;
        const bladeHeight = this.keyConfig.bladeHeight;
        
        // Calculate the pin's position relative to the key blade's leading edge
        const pinRelativeToKeyLeadingEdge = pinX - keyBladeStartX;
        
        // If pin is beyond the key blade, return base surface
        if (pinRelativeToKeyLeadingEdge < 0 || pinRelativeToKeyLeadingEdge > bladeWidth) {
            return keyBladeBaseY;
        }
        
        // Calculate pin spacing and margin for cut positions
        const pinSpacing = 400 / (this.pinCount + 1);
        const margin = pinSpacing * 0.75;
        const cutWidth = 24;
        
        // Check if pin is over a cut area
        for (let i = 0; i < this.pinCount; i++) {
            const cutPinX = 100 + margin + i * pinSpacing;
            const cutX = keyBladeStartX + (cutPinX - 100); // Cut position relative to key blade
            const cutStartX = cutX - cutWidth/2;
            const cutEndX = cutX + cutWidth/2;
            
            if (pinX >= cutStartX && pinX <= cutEndX) {
                // Pin is over a cut - return the cut depth
                const cutDepth = this.keyData.cuts[i] || 0;
                return keyBladeBaseY + cutDepth;
            }
        }
        
        // Check triangular sections as the key moves
        const triangularHeight = this.getTriangularSectionHeightAsKeyMoves(pinRelativeToKeyLeadingEdge, bladeWidth, bladeHeight);
        if (triangularHeight > 0) {
            return keyBladeBaseY + triangularHeight;
        }
        
        // Default to base key surface
        return keyBladeBaseY;
    }
    
    getKeySurfaceHeightAtX(pinX, keyBladeStartX, keyBladeBaseY) {
        // Calculate the key surface height at a specific X position
        // This includes cuts, triangular sections, and the base key surface
        
        const bladeWidth = this.keyConfig.bladeWidth;
        const bladeHeight = this.keyConfig.bladeHeight;
        const relativeX = pinX - keyBladeStartX; // X position relative to key blade start
        
        // Check if we're in a cut area (pin position)
        const pinSpacing = 400 / (this.pinCount + 1);
        const margin = pinSpacing * 0.75;
        
        for (let i = 0; i < this.pinCount; i++) {
            const cutPinX = 100 + margin + i * pinSpacing;
            const cutX = keyBladeStartX + (cutPinX - 100); // Cut position relative to key blade
            const cutWidth = 24; // Width of each cut
            
            if (Math.abs(pinX - cutPinX) < cutWidth / 2) {
                // We're in a cut area - return the cut depth
                const cutDepth = this.keyData.cuts[i] || 0;
                return keyBladeBaseY + cutDepth;
            }
        }
        
        // Check if we're in a triangular section
        const triangularHeight = this.getTriangularSectionHeightAtX(relativeX, bladeWidth, bladeHeight);
        if (triangularHeight > 0) {
            return keyBladeBaseY + triangularHeight;
        }
        
        // Default to base key surface (no cut)
        return keyBladeBaseY;
    }
    
    getTriangularSectionHeightAtX(relativeX, bladeWidth, bladeHeight) {
        // Calculate height of triangular sections at a given X position
        const stepSize = 4;
        const cutWidth = 24;
        const pinSpacing = 400 / (this.pinCount + 1);
        const margin = pinSpacing * 0.75;
        
        // Check triangular sections between cuts
        for (let i = 0; i < this.pinCount - 1; i++) {
            const cut1X = margin + i * pinSpacing;
            const cut2X = margin + (i + 1) * pinSpacing;
            const halfwayX = cut1X + (cut2X - cut1X) / 2;
            
            // Check if we're in the triangular section between these cuts
            if (relativeX >= cut1X + cutWidth/2 && relativeX <= cut2X - cutWidth/2) {
                const distanceFromCut1 = relativeX - (cut1X + cutWidth/2);
                const triangularWidth = (cut2X - cutWidth/2) - (cut1X + cutWidth/2);
                const progress = distanceFromCut1 / triangularWidth;
                
                // Get cut depths for both cuts
                const cut1Depth = this.keyData.cuts[i] || 0;
                const cut2Depth = this.keyData.cuts[i + 1] || 0;
                
                // Interpolate between cut depths
                const interpolatedDepth = cut1Depth + (cut2Depth - cut1Depth) * progress;
                return interpolatedDepth;
            }
        }
        
        // Check triangular section from left edge to first cut
        if (relativeX < margin - cutWidth/2) {
            const progress = relativeX / (margin - cutWidth/2);
            const firstCutDepth = this.keyData.cuts[0] || 0;
            return firstCutDepth * progress;
        }
        
        // Check triangular section from last cut to right edge
        const lastCutX = margin + (this.pinCount - 1) * pinSpacing;
        if (relativeX > lastCutX + cutWidth/2) {
            const triangularWidth = bladeWidth - (lastCutX + cutWidth/2);
            const distanceFromLastCut = relativeX - (lastCutX + cutWidth/2);
            const progress = distanceFromLastCut / triangularWidth;
            const lastCutDepth = this.keyData.cuts[this.pinCount - 1] || 0;
            return lastCutDepth * (1 - progress);
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
    
    updatePinVisuals(pin) {
        console.log(`Updating pin ${pin.index} visuals - currentHeight: ${pin.currentHeight}`);
        
        // Update key pin visual
        pin.keyPin.clear();
        pin.keyPin.fillStyle(0xdd3333);
        
        // Calculate new position based on currentHeight
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
        
        for (let i = 0; i < this.pinCount; i++) {
            const pinX = 100 + margin + i * pinSpacing;
            const pinY = 200;
            
            // Random pin lengths that add up to 75 (total height - 25% increase from 60)
            const keyPinLength = 25 + Math.random() * 37.5; // 25-62.5 (25% increase)
            const driverPinLength = 75 - keyPinLength; // Remaining to make 75 total
            
            const pin = {
                index: i,
                binding: bindingOrder[i],
                isSet: false,
                currentHeight: 0,
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
                    navigator.vibrate(50);
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
                }
            });
            
            this.pins.push(pin);
        }
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
                            navigator.vibrate(50);
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
                    navigator.vibrate([200]);
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
                    navigator.vibrate(500);

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
                    navigator.vibrate(500);
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
                    navigator.vibrate(100);
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
                navigator.vibrate(500);
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
            navigator.vibrate(500);
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
} 