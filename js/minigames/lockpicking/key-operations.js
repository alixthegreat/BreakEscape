
/**
 * KeyOperations
 * 
 * Extracted from lockpicking-game-phaser.js
 * Instantiate with: new KeyOperations(this)
 * 
 * All 'this' references replaced with 'this.parent' to access parent instance state:
 * - this.parent.pins (array of pin objects)
 * - this.parent.scene (Phaser scene)
 * - this.parent.lockId (lock identifier)
 * - this.parent.lockState (lock state object)
 * etc.
 */
export class KeyOperations {
    
    constructor(parent) {
        this.parent = parent;
    }

    createKey() {
        if (!this.parent.keyMode) return;
        
        // Generate key data from actual pin heights if not provided
        if (!this.parent.keyData) {
            this.parent.keyDataGen.generateKeyDataFromPins();
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
        this.parent.keyGroup = this.parent.scene.add.container(keyStartX, keyStartY);
        
        // Create render texture for the key - make it wider to accommodate the full circle
        const renderTextureWidth = Math.max(fullKeyLength, keyCircleRadius * 2 + 50); // Ensure enough space for circle
        this.parent.keyRenderTexture = this.parent.scene.add.renderTexture(0, 0, renderTextureWidth, keyShoulderHeight);
        this.parent.keyRenderTexture.setOrigin(0, 0.5);
        
        // Draw the key using render texture
        this.parent.drawKeyWithRenderTexture(keyCircleRadius, keyShoulderWidth, keyShoulderHeight, keyBladeWidth, keyBladeHeight, fullKeyLength);
        
        // Test: Draw a simple circle to see if render texture works
        const testGraphics = this.parent.scene.add.graphics();
        testGraphics.fillStyle(0x00ff00); // Green
        testGraphics.fillCircle(50, 50, 30);
        this.parent.keyRenderTexture.draw(testGraphics);
        testGraphics.destroy();
        
        // Test: Draw circle directly to scene to see if it's a render texture issue
        const directCircle = this.parent.scene.add.graphics();
        directCircle.fillStyle(0xffff00); // Yellow
        directCircle.fillCircle(keyStartX + 100, keyStartY, 50);
        directCircle.setDepth(1000); // High z-index to be visible
        
        this.parent.keyGroup.add(this.parent.keyRenderTexture);
        
        // Set key graphics to low z-index so it appears behind pins
        this.parent.keyGroup.setDepth(1); // Set low z-index so key appears behind pins
        
        // Create click zone covering the entire keyway area in key mode
        // Position click zone to cover the entire keyway from left edge to right edge
        const keywayClickWidth = 400; // Full keyway width
        const keywayClickHeight = 120; // Full keyway height
        const clickZone = this.parent.scene.add.rectangle(0, 0, 
            keywayClickWidth, keywayClickHeight, 0x000000, 0);
        clickZone.setDepth(9999); // Very high z-index for clickability
        clickZone.setInteractive();
        
        // Position click zone to cover the entire keyway area (not relative to key group)
        clickZone.x = 100; // Keyway start X
        clickZone.y = 170 + keywayClickHeight/2; // Keyway center Y
        this.parent.keyClickZone = clickZone;
        
        // Add click handler for key insertion
        clickZone.on('pointerdown', () => {
            if (!this.parent.keyInserting) {
                // Hide labels on first key click (similar to pin clicks)
                if (!this.parent.pinClicked) {
                    this.parent.pinClicked = true;
                }
                this.parent.startKeyInsertion();
            }
        });
        
        console.log('Key click zone created:', { 
            width: keywayClickWidth, 
            height: keyShoulderHeight,
            position: '0,0 relative to key group'
        });
        
        // Store key configuration
        this.parent.keyConfig = {
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
        this.parent.createKeyBladeCollision();
        
        console.log('Key created with config:', this.parent.keyConfig);
    }

    startKeyInsertion() {
        console.log('startKeyInsertion called with:', { 
            hasKeyGroup: !!this.parent.keyGroup, 
            hasKeyConfig: !!this.parent.keyConfig, 
            keyInserting: this.parent.keyInserting 
        });
        
        if (!this.parent.keyGroup || !this.parent.keyConfig || this.parent.keyInserting) {
            console.log('startKeyInsertion early return - missing requirements');
            return;
        }
        
        console.log('Starting key insertion animation...');
        this.parent.keyInserting = true;
        this.parent.updateFeedback("Inserting key...");
        
        // Calculate target position - key should be fully inserted
        const targetX = this.parent.keyConfig.keywayStartX - this.parent.keyConfig.shoulderWidth;
        const startX = this.parent.keyGroup.x;
        
        // Calculate fully inserted position - move key so it's completely inside the keyway
        const keywayLeftEdge = this.parent.keyConfig.keywayStartX; // 100px
        const shoulderRightEdge = this.parent.keyConfig.circleRadius * 1.9 + this.parent.keyConfig.shoulderWidth; // 266 + 20 = 286px from key group center
        const fullyInsertedX = keywayLeftEdge - shoulderRightEdge; // 100 - 286 = -186px
        
        // Create smooth animation from left to right
        this.parent.scene.tweens.add({
            targets: this.parent.keyGroup,
            x: fullyInsertedX,
            duration: 4000, // 4 seconds for slower insertion
            ease: 'Cubic.easeInOut',
            onUpdate: (tween) => {
                // Calculate progress (0 to 1) - key moves from left to right
                const progress = (this.parent.keyGroup.x - startX) / (fullyInsertedX - startX);
                this.parent.keyInsertionProgress = Math.max(0, Math.min(1, progress));
                
                console.log('Animation update - key position:', this.parent.keyGroup.x, 'progress:', this.parent.keyInsertionProgress);
                
                // Update pin positions based on key cuts as the key is inserted
                this.parent.updatePinsWithKeyInsertion(this.parent.keyInsertionProgress);
            },
            onComplete: () => {
                this.parent.keyInserting = false;
                this.parent.keyInsertionProgress = 1.0; // Fully inserted
                
                // Snap pins to exact final positions based on key cut dimensions
                this.parent.snapPinsToExactPositions();
                
                this.parent.checkKeyCorrectness();
            }
        });
    }

    checkKeyCorrectness() {
        if (!this.parent.keyData || !this.parent.keyData.cuts) return;
        
        // Check if the selected key matches the correct key
        let isCorrect = false;
        
        if (this.parent.selectedKeyData && this.parent.selectedKeyData.cuts) {
            // Compare the selected key cuts with the original correct key cuts
            const selectedCuts = this.parent.selectedKeyData.cuts;
            const correctCuts = this.parent.keyData.cuts;
            
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
            selectedKey: this.parent.selectedKeyData ? this.parent.selectedKeyData.cuts : 'none',
            correctKey: this.parent.keyData.cuts,
            isCorrect: isCorrect
        });
        
        if (isCorrect) {
            // Key is correct - all pins are aligned at the shear line
            this.parent.updateFeedback("Key fits perfectly! Lock unlocked.");
            
                    // Start the rotation animation for correct key
        this.parent.scene.time.delayedCall(500, () => {
            this.parent.startKeyRotationAnimationWithChamberHoles();
        });
            
            // Complete the minigame after rotation animation
            setTimeout(() => {
                this.parent.complete(true);
            }, 3000); // Longer delay to allow rotation animation to complete
        } else {
            // Key is wrong - show red flash and then pop up key selection again
            this.parent.updateFeedback("Wrong key! The lock won't turn.");
            
            // Play wrong sound
            if (this.parent.sounds.wrong) {
                this.parent.sounds.wrong.play();
            }
            
            // Flash the entire lock red
            this.parent.keyVisualFeedback.flashLockRed();
            
            // Reset key position and show key selection again after a delay
            setTimeout(() => {
                this.parent.updateKeyPosition(0);
                // Show key selection again
                if (this.parent.keySelectionMode) {
                    // For main game, go back to original key selection interface
                    // For challenge mode (locksmith-forge.html), use the training interface
                    if (this.parent.params?.lockable?.id === 'progressive-challenge') {
                        // This is the locksmith-forge.html challenge mode
                        this.parent.keySelection.createKeysForChallenge('correct_key');
                    } else {
                        // This is the main game - go back to key selection
                        this.parent.startWithKeySelection();
                    }
                }
            }, 2000); // Longer delay to show the red flash
        }
    }
    
}
