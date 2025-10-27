
/**
 * KeyVisualFeedback
 * 
 * Extracted from lockpicking-game-phaser.js
 * Instantiate with: new KeyVisualFeedback(this)
 * 
 * All 'this' references replaced with 'this.parent' to access parent instance state:
 * - this.parent.pins (array of pin objects)
 * - this.parent.scene (Phaser scene)
 * - this.parent.lockId (lock identifier)
 * - this.parent.lockState (lock state object)
 * etc.
 */
export class KeyVisualFeedback {
    
    constructor(parent) {
        this.parent = parent;
    }

    createKeyVisual(keyData, width, height) {
        // Create a visual representation of a key for the selection UI by building the actual key and scaling it down
        const keyContainer = this.parent.scene.add.container(0, 0);
        
        // Save the original key data before temporarily changing it
        const originalKeyData = this.parent.keyData;
        
        // Temporarily set the key data to create the key
        this.parent.keyOps.createKey();
        
        // Get the key group and scale it down
        const keyGroup = this.parent.keyGroup;
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
        this.parent.keyData = originalKeyData;
        
        return keyContainer;
    }

    selectKey(selectedIndex, correctIndex, keyData) {
        // Handle key selection from the UI
        console.log(`Key ${selectedIndex + 1} selected (correct: ${correctIndex + 1})`);
        
        // Close the popup immediately
        if (this.parent.keySelectionContainer) {
            this.parent.keySelectionContainer.destroy();
        }
        
        // Remove any existing key from the scene
        if (this.parent.keyGroup) {
            this.parent.keyGroup.destroy();
            this.parent.keyGroup = null;
        }
        
        // Remove any existing click zone
        if (this.parent.keyClickZone) {
            this.parent.keyClickZone.destroy();
            this.parent.keyClickZone = null;
        }
        
        // Reset pins to their original positions before creating the new key
        this.parent.lockConfig.resetPinsToOriginalPositions();
        
        // Store the original correct key data (this determines if the key is correct)
        const originalKeyData = this.parent.keyData;
        
        // Store the selected key data for visual purposes
        this.parent.selectedKeyData = keyData;
        
        // Create the visual key with the selected key data
        this.parent.keyData = keyData;
        this.parent.pinCount = keyData.pinCount;
        this.parent.keyOps.createKey();
        
        // Restore the original key data for correctness checking
        this.parent.keyData = originalKeyData;
        
        // Update feedback - don't reveal if correct/wrong yet
        this.parent.updateFeedback("Key selected! Inserting into lock...");
        
        // Automatically trigger key insertion after a short delay
        setTimeout(() => {
            this.parent.keyOps.startKeyInsertion();
        }, 300); // Small delay to let the key appear first
        
        // Update feedback if available
        if (this.parent.selectKeyCallback) {
            this.parent.selectKeyCallback(selectedIndex, correctIndex, keyData);
        }
    }

    showWrongKeyFeedback() {
        // Show visual feedback for wrong key selection
        const feedback = this.parent.scene.add.graphics();
        feedback.fillStyle(0xff0000, 0.3);
        feedback.fillRect(0, 0, 800, 600);
        feedback.setDepth(9999);
        
        // Remove feedback after a short delay
        this.parent.scene.time.delayedCall(500, () => {
            feedback.destroy();
        });
    }

    flashLockRed() {
        // Flash the entire lock area red to indicate wrong key
        const flash = this.parent.scene.add.graphics();
        flash.fillStyle(0xff0000, 0.4); // Red with 40% opacity
        flash.fillRect(100, 50, 400, 300); // Cover the entire lock area
        flash.setDepth(9998); // High z-index but below other UI elements
        
        // Remove flash after a short delay
        this.parent.scene.time.delayedCall(800, () => {
            flash.destroy();
        });
    }
    
}
