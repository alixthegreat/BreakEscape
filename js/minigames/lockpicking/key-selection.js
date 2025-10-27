
/**
 * KeySelection
 * 
 * Extracted from lockpicking-game-phaser.js
 * Instantiate with: new KeySelection(this)
 * 
 * All 'this' references replaced with 'this.parent' to access parent instance state:
 * - this.parent.pins (array of pin objects)
 * - this.parent.scene (Phaser scene)
 * - this.parent.lockId (lock identifier)
 * - this.parent.lockState (lock state object)
 * etc.
 */
export class KeySelection {
    
    constructor(parent) {
        this.parent = parent;
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
            const key1 = this.parent.generateRandomKey(this.parent.pinCount);
            const key2 = this.parent.generateRandomKey(this.parent.pinCount);
            const key3 = this.parent.generateRandomKey(this.parent.pinCount);
            
            // Make the first key correct
            key1.cuts = this.parent.keyData.cuts;
            key1.id = correctKeyId || 'correct_key';
            key1.name = 'Correct Key';
            
            // Randomize the order
            const keys = [key1, key2, key3];
            this.parent.gameUtil.shuffleArray(keys);
            
            return this.parent.createKeySelectionUI(keys, correctKeyId);
        }
        
        // Use inventory keys and randomize their order
        const shuffledKeys = [...validKeys];
        this.parent.gameUtil.shuffleArray(shuffledKeys);
        
        return this.parent.createKeySelectionUI(shuffledKeys, correctKeyId);
    }

    createKeysForChallenge(correctKeyId = 'challenge_key') {
        // Create keys for challenge mode (like locksmith-forge.html)
        // Generates 3 keys with one guaranteed correct key
        
        const key1 = this.parent.generateRandomKey(this.parent.pinCount);
        const key2 = this.parent.generateRandomKey(this.parent.pinCount);
        const key3 = this.parent.generateRandomKey(this.parent.pinCount);
        
        // Make the first key correct by copying the actual key cuts
        key1.cuts = this.parent.keyData.cuts;
        key1.id = correctKeyId;
        key1.name = 'Correct Key';
        
        // Give other keys descriptive names
        key2.name = 'Wrong Key 1';
        key3.name = 'Wrong Key 2';
        
        // Randomize the order of keys
        const keys = [key1, key2, key3];
        this.parent.gameUtil.shuffleArray(keys);
        
        // Find the new index of the correct key after shuffling
        const correctKeyIndex = keys.findIndex(key => key.id === correctKeyId);
        
        return this.parent.createKeySelectionUI(keys, correctKeyId);
    }
    
}
