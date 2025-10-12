/**
 * MINIGAME STARTERS
 * =================
 * 
 * Functions to initialize and start various minigames (lockpicking, key selection).
 * These are wrappers around the MinigameFramework that handle setup and callbacks.
 */

import { generateKeyCutsForLock, doesKeyMatchLock, PREDEFINED_LOCK_CONFIGS } from './key-lock-system.js';

export function startLockpickingMinigame(lockable, scene, difficulty = 'medium', callback) {
    console.log('Starting lockpicking minigame with difficulty:', difficulty);
    
    // Initialize the minigame framework if not already done
    if (!window.MinigameFramework) {
        console.error('MinigameFramework not available');
        // Fallback to simple version
        window.gameAlert('Advanced lockpicking unavailable. Using simple pick attempt.', 'warning', 'Lockpicking', 2000);
        
        const success = Math.random() < 0.6; // 60% chance
        setTimeout(() => {
            if (success) {
                window.gameAlert('Successfully picked the lock!', 'success', 'Lock Picked', 2000);
                callback(true);
            } else {
                window.gameAlert('Failed to pick the lock.', 'error', 'Pick Failed', 2000);
                callback(false);
            }
        }, 1000);
        return;
    }
    
    // Use the advanced minigame framework
    if (!window.MinigameFramework.mainGameScene) {
        window.MinigameFramework.init(scene);
    }
    
    // Start the lockpicking minigame (Phaser version)
    window.MinigameFramework.startMinigame('lockpicking', null, {
        lockable: lockable,
        difficulty: difficulty,
        cancelText: 'Close',
        onComplete: (success, result) => {
            if (success) {
                console.log('LOCKPICK SUCCESS');
                window.gameAlert('Successfully picked the lock!', 'success', 'Lockpicking', 4000);
                callback(true);
            } else {
                console.log('LOCKPICK FAILED');
                window.gameAlert('Failed to pick the lock.', 'error', 'Lockpicking', 4000);
                callback(false);
            }
        }
    });
}

export function startKeySelectionMinigame(lockable, type, playerKeys, requiredKeyId, unlockTargetCallback) {
    console.log('Starting key selection minigame', { playerKeys, requiredKeyId });
    
    // Initialize the minigame framework if not already done
    if (!window.MinigameFramework) {
        console.error('MinigameFramework not available');
        // Fallback to simple key selection
        const correctKey = playerKeys.find(key => key.scenarioData.key_id === requiredKeyId);
        if (correctKey) {
            window.gameAlert(`You used the ${correctKey.scenarioData.name} to unlock the ${type}.`, 'success', 'Unlock Successful', 4000);
            if (unlockTargetCallback) {
                unlockTargetCallback(lockable, type, lockable.layer);
            }
        } else {
            window.gameAlert('None of your keys work with this lock.', 'error', 'Wrong Keys', 4000);
        }
        return;
    }
    
    // Use the advanced minigame framework
    if (!window.MinigameFramework.mainGameScene) {
        window.MinigameFramework.init(window.game);
    }
    
    // Determine the lock ID for this lockable based on scenario data
    let lockId = null;
    
    // Try to find the lock ID from the scenario data
    if (lockable.scenarioData?.requires) {
        // This is a key lock, find which key it requires
        const requiredKeyId = lockable.scenarioData.requires;
        
        // Find the mapping for this key to get the lock ID
        if (window.keyLockMappings && window.keyLockMappings[requiredKeyId]) {
            lockId = window.keyLockMappings[requiredKeyId].lockId;
            console.log(`Found lock ID "${lockId}" for key "${requiredKeyId}"`);
        }
    }
    
    // Fallback to default lock ID
    if (!lockId) {
        lockId = lockable.scenarioData?.lockId || lockable.id || 'default_lock';
        console.log(`Using fallback lock ID "${lockId}"`);
    }
    
    // Find the key that matches this lock
    const matchingKey = playerKeys.find(key => doesKeyMatchLock(key.scenarioData.key_id, lockId));
    
    let keysToShow = playerKeys;
    if (matchingKey) {
        console.log(`Found matching key "${matchingKey.scenarioData.name}" for lock "${lockId}"`);
        // For now, show all keys so player has to figure out which one works
        // In the future, you could show only the matching key or give hints
    } else {
        console.log(`No matching key found for lock "${lockId}", showing all keys`);
    }
    
    // Convert inventory keys to the format expected by the minigame
    const inventoryKeys = keysToShow.map(key => {
        // Generate cuts data if not present
        let cuts = key.scenarioData.cuts;
        if (!cuts) {
            // Generate cuts that match the lock's pin configuration
            cuts = generateKeyCutsForLock(key, lockable);
        }
        
        return {
            id: key.scenarioData.key_id,
            name: key.scenarioData.name,
            cuts: cuts,
            pinCount: key.scenarioData.pinCount || 4, // Default to 4 pins to match most locks
            matchesLock: doesKeyMatchLock(key.scenarioData.key_id, lockId) // Add flag for matching
        };
    });
    
    // Determine which lock configuration to use for this lockable
    let lockConfig = null;
    
    // First, try to find the lock configuration from scenario-based mappings
    if (lockable.scenarioData?.requires) {
        const requiredKeyId = lockable.scenarioData.requires;
        if (window.keyLockMappings && window.keyLockMappings[requiredKeyId]) {
            lockConfig = window.keyLockMappings[requiredKeyId].lockConfig;
            console.log(`Using scenario-based lock configuration for key "${requiredKeyId}":`, lockConfig);
        }
    }
    
    // Fallback to predefined configurations
    if (!lockConfig && PREDEFINED_LOCK_CONFIGS[lockId]) {
        lockConfig = PREDEFINED_LOCK_CONFIGS[lockId];
        console.log(`Using predefined lock configuration for ${lockId}:`, lockConfig);
    }
    
    // Final fallback to default configuration
    if (!lockConfig) {
        lockConfig = {
            id: lockId,
            pinCount: 4,
            pinHeights: [30, 28, 32, 29],
            difficulty: 'medium'
        };
        console.log(`Using default lock configuration for ${lockId}:`, lockConfig);
    }
    
    // Start the key selection minigame
    window.MinigameFramework.startMinigame('lockpicking', null, {
        keyMode: true,
        skipStartingKey: true,
        lockable: lockable,
        lockId: lockId,
        pinCount: lockConfig.pinCount,
        predefinedPinHeights: lockConfig.pinHeights, // Pass the predefined pin heights
        difficulty: lockConfig.difficulty,
        cancelText: 'Close',
        onComplete: (success, result) => {
            if (success) {
                console.log('KEY SELECTION SUCCESS');
                window.gameAlert('Successfully unlocked with the correct key!', 'success', 'Unlock Successful', 4000);
                // Small delay to ensure minigame cleanup completes before room loading
                if (unlockTargetCallback) {
                    setTimeout(() => {
                        unlockTargetCallback(lockable, type, lockable.layer);
                    }, 100);
                }
            } else {
                console.log('KEY SELECTION FAILED');
                window.gameAlert('The selected key doesn\'t work with this lock.', 'error', 'Wrong Key', 4000);
            }
        }
    });
    
    // Start with key selection using inventory keys
    // Wait for the minigame to be fully initialized and lock configuration to be saved
    setTimeout(() => {
        if (window.MinigameFramework.currentMinigame && window.MinigameFramework.currentMinigame.startWithKeySelection) {
            // Regenerate keys with the actual lock configuration now that it's been created
            const updatedInventoryKeys = playerKeys.map(key => {
                let cuts = key.scenarioData.cuts;
                if (!cuts) {
                    cuts = generateKeyCutsForLock(key, lockable);
                }
                
                return {
                    id: key.scenarioData.key_id,
                    name: key.scenarioData.name,
                    cuts: cuts,
                    pinCount: key.scenarioData.pinCount || 4
                };
            });
            
            window.MinigameFramework.currentMinigame.startWithKeySelection(updatedInventoryKeys, requiredKeyId);
        }
    }, 500);
}

// Export for global access
window.startLockpickingMinigame = startLockpickingMinigame;
window.startKeySelectionMinigame = startKeySelectionMinigame;

