/**
 * UNLOCK SYSTEM
 * =============
 * 
 * Handles all unlock logic for doors and items.
 * Supports multiple lock types: key, pin, password, biometric, bluetooth.
 * This system coordinates between various subsystems to perform unlocking.
 */

import { DOOR_ALIGN_OVERLAP } from '../utils/constants.js';
import { rooms } from '../core/rooms.js';
import { unlockDoor } from './doors.js';
import { startLockpickingMinigame, startKeySelectionMinigame, startPinMinigame, startPasswordMinigame } from './minigame-starters.js';

// Helper function to check if two rectangles overlap
function boundsOverlap(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

export function handleUnlock(lockable, type) {
    console.log('UNLOCK ATTEMPT');
    
    // Check if locks are disabled for testing
    if (window.DISABLE_LOCKS) {
        console.log('LOCKS DISABLED FOR TESTING - Unlocking directly');
        unlockTarget(lockable, type, lockable.layer);
        return;
    }
    
    // Get lock requirements based on type
    const lockRequirements = type === 'door' 
        ? getLockRequirementsForDoor(lockable)
        : getLockRequirementsForItem(lockable);
    
    if (!lockRequirements) {
        console.log('NO LOCK REQUIREMENTS FOUND');
        return;
    }
    
    // Check if object is locked based on lock requirements
    const isLocked = lockRequirements.requires;
    
    if (!isLocked) {
        console.log('OBJECT NOT LOCKED');
        return;
    }
    
    switch(lockRequirements.lockType) {
        case 'key':
            const requiredKey = lockRequirements.requires;
            console.log('KEY REQUIRED', requiredKey);
            
            // Get all keys from player's inventory
            const playerKeys = window.inventory.items.filter(item => 
                item && item.scenarioData && 
                item.scenarioData.type === 'key'
            );
            
            if (playerKeys.length > 0) {
                // Show key selection interface
                startKeySelectionMinigame(lockable, type, playerKeys, requiredKey, unlockTarget);
            } else {
                // Check for lockpick kit
                const hasLockpick = window.inventory.items.some(item => 
                    item && item.scenarioData && 
                    item.scenarioData.type === 'lockpick'
                );
                
                if (hasLockpick) {
                    console.log('LOCKPICK AVAILABLE');
                    if (confirm("Would you like to attempt picking this lock?")) {
                        let difficulty = lockable.scenarioData?.difficulty || lockable.properties?.difficulty || 'medium';
                        
                        console.log('STARTING LOCKPICK MINIGAME', { difficulty });
                        startLockpickingMinigame(lockable, window.game, difficulty, (success) => {
                            if (success) {
                                // Small delay to ensure minigame cleanup completes
                                setTimeout(() => {
                                    unlockTarget(lockable, type, lockable.layer);
                                    window.gameAlert(`Successfully picked the lock!`, 'success', 'Lock Picked', 4000);
                                }, 100);
                            } else {
                                console.log('LOCKPICK FAILED');
                                window.gameAlert('Failed to pick the lock. Try again.', 'error', 'Pick Failed', 3000);
                            }
                        });
                    }
                } else {
                    console.log('NO KEYS OR LOCKPICK AVAILABLE');
                    window.gameAlert(`Requires key: ${requiredKey}`, 'error', 'Locked', 4000);
                }
            }
            break;

        case 'pin':
            console.log('PIN CODE REQUESTED');
            startPinMinigame(lockable, type, lockRequirements.requires, (success) => {
                if (success) {
                    unlockTarget(lockable, type, lockable.layer);
                }
            });
            break;
            
        case 'password':
            console.log('PASSWORD REQUESTED');
            
            // Get password options from the lockable object
            const passwordOptions = {
                passwordHint: lockable.passwordHint || lockable.scenarioData?.passwordHint || '',
                showHint: lockable.showHint || lockable.scenarioData?.showHint || false,
                showKeyboard: lockable.showKeyboard || lockable.scenarioData?.showKeyboard || false,
                maxAttempts: lockable.maxAttempts || lockable.scenarioData?.maxAttempts || 3,
                postitNote: lockable.postitNote || lockable.scenarioData?.postitNote || '',
                showPostit: lockable.showPostit || lockable.scenarioData?.showPostit || false
            };
            
            startPasswordMinigame(lockable, type, lockRequirements.requires, (success) => {
                if (success) {
                    unlockTarget(lockable, type, lockable.layer);
                }
            }, passwordOptions);
            break;
            
        case 'biometric':
            const requiredFingerprint = lockRequirements.requires;
            console.log('BIOMETRIC LOCK REQUIRES', requiredFingerprint);
            
            // Check if we have fingerprints in the biometricSamples collection
            const biometricSamples = window.gameState?.biometricSamples || [];
            
            console.log('BIOMETRIC SAMPLES', JSON.stringify(biometricSamples));
            
            // Get the required match threshold from the object or use default
            const requiredThreshold = lockable.biometricMatchThreshold || 0.4;
            console.log('BIOMETRIC THRESHOLD', requiredThreshold);
            
            // Find the fingerprint sample for the required person
            const fingerprintSample = biometricSamples.find(sample => 
                sample.owner === requiredFingerprint
            );
            
            const hasFingerprint = fingerprintSample !== undefined;
            console.log('FINGERPRINT CHECK', `Looking for '${requiredFingerprint}'. Found: ${hasFingerprint}`);
            
            if (hasFingerprint) {
                // Get the quality from the sample
                let fingerprintQuality = fingerprintSample.quality;
                
                // Normalize quality to 0-1 range if it's in percentage format
                if (fingerprintQuality > 1) {
                    fingerprintQuality = fingerprintQuality / 100;
                }
                
                console.log('BIOMETRIC CHECK', 
                    `Required: ${requiredFingerprint}, Quality: ${fingerprintQuality} (${Math.round(fingerprintQuality * 100)}%), Threshold: ${requiredThreshold} (${Math.round(requiredThreshold * 100)}%)`);
                
                // Check if the fingerprint quality meets the threshold
                if (fingerprintQuality >= requiredThreshold) {
                    console.log('BIOMETRIC UNLOCK SUCCESS');
                    unlockTarget(lockable, type, lockable.layer);
                    window.gameAlert(`You successfully unlocked the ${type} with ${requiredFingerprint}'s fingerprint.`, 
                        'success', 'Biometric Unlock Successful', 5000);
                } else {
                    console.log('BIOMETRIC QUALITY TOO LOW', 
                        `Quality: ${fingerprintQuality} (${Math.round(fingerprintQuality * 100)}%) < Threshold: ${requiredThreshold} (${Math.round(requiredThreshold * 100)}%)`);
                    window.gameAlert(`The fingerprint quality (${Math.round(fingerprintQuality * 100)}%) is too low for this lock. 
                            It requires at least ${Math.round(requiredThreshold * 100)}% quality.`,
                        'error', 'Biometric Authentication Failed', 5000);
                }
            } else {
                console.log('MISSING REQUIRED FINGERPRINT', 
                    `Required: '${requiredFingerprint}', Available: ${biometricSamples.map(s => s.owner).join(", ") || "none"}`);
                window.gameAlert(`This ${type} requires ${requiredFingerprint}'s fingerprint, which you haven't collected yet.`,
                    'error', 'Biometric Authentication Failed', 5000);
            }
            break;
            
        case 'bluetooth':
            console.log('BLUETOOTH UNLOCK ATTEMPT');
            const requiredDevice = lockRequirements.requires; // MAC address or device name
            console.log('BLUETOOTH DEVICE REQUIRED', requiredDevice);
            
            // Check if we have a bluetooth scanner in inventory
            const hasScanner = window.inventory.items.some(item => 
                item && item.scenarioData && 
                item.scenarioData.type === 'bluetooth_scanner'
            );
            
            if (!hasScanner) {
                console.log('NO BLUETOOTH SCANNER');
                window.gameAlert(`You need a Bluetooth scanner to access this ${type}.`, 'error', 'Scanner Required', 4000);
                break;
            }
            
            // Check if we have the required device in our bluetooth scan results
            const bluetoothData = window.gameState?.bluetoothDevices || [];
            const requiredDeviceData = bluetoothData.find(device => 
                device.mac === requiredDevice || device.name === requiredDevice
            );
            
            console.log('BLUETOOTH SCAN DATA', JSON.stringify(bluetoothData));
            console.log('REQUIRED DEVICE CHECK', { required: requiredDevice, found: !!requiredDeviceData });
            
            if (requiredDeviceData) {
                // Check signal strength - need to be close enough
                const minSignalStrength = lockable.minSignalStrength || -70; // dBm
                
                if (requiredDeviceData.signalStrength >= minSignalStrength) {
                    console.log('BLUETOOTH UNLOCK SUCCESS');
                    unlockTarget(lockable, type, lockable.layer);
                    window.gameAlert(`Successfully connected to ${requiredDeviceData.name} and unlocked the ${type}.`, 
                        'success', 'Bluetooth Unlock Successful', 5000);
                } else {
                    console.log('BLUETOOTH SIGNAL TOO WEAK', 
                        `Signal: ${requiredDeviceData.signalStrength}dBm < Required: ${minSignalStrength}dBm`);
                    window.gameAlert(`Bluetooth device detected but signal too weak (${requiredDeviceData.signalStrength}dBm). Move closer.`,
                        'error', 'Weak Signal', 4000);
                }
            } else {
                console.log('BLUETOOTH DEVICE NOT FOUND', 
                    `Required: '${requiredDevice}', Available: ${bluetoothData.map(d => d.name || d.mac).join(", ") || "none"}`);
                window.gameAlert(`This ${type} requires connection to '${requiredDevice}', which hasn't been detected yet.`,
                    'error', 'Device Not Found', 5000);
            }
            break;
            
        default:
            window.gameAlert(`This ${type} requires ${lockRequirements.lockType} to unlock.`, 'info', 'Locked', 4000);
            break;
    }
}

export function getLockRequirementsForDoor(doorSprite) {
    // First, check if the door sprite has lock properties directly
    if (doorSprite.doorProperties) {
        const props = doorSprite.doorProperties;
        if (props.locked) {
            return {
                lockType: props.lockType,
                requires: props.requires
            };
        }
    }
    
    // Fallback: Try to find lock requirements from scenario data
    const doorWorldX = doorSprite.x;
    const doorWorldY = doorSprite.y;
    
    const overlappingRooms = [];
    Object.entries(rooms).forEach(([roomId, otherRoom]) => {
        const doorCheckArea = {
            x: doorWorldX - DOOR_ALIGN_OVERLAP,
            y: doorWorldY - DOOR_ALIGN_OVERLAP,
            width: DOOR_ALIGN_OVERLAP * 2,
            height: DOOR_ALIGN_OVERLAP * 2
        };
        
        const roomBounds = {
            x: otherRoom.position.x,
            y: otherRoom.position.y,
            width: otherRoom.map.widthInPixels,
            height: otherRoom.map.heightInPixels
        };
        
        if (boundsOverlap(doorCheckArea, roomBounds)) {
            const roomCenterX = roomBounds.x + (roomBounds.width / 2);
            const roomCenterY = roomBounds.y + (roomBounds.height / 2);
            const player = window.player;
            const distanceToPlayer = player ? Phaser.Math.Distance.Between(
                player.x, player.y,
                roomCenterX, roomCenterY
            ) : 0;
            
            const gameScenario = window.gameScenario;
            const roomData = gameScenario?.rooms?.[roomId];
            
            overlappingRooms.push({
                id: roomId,
                room: otherRoom,
                distance: distanceToPlayer,
                lockType: roomData?.lockType,
                requires: roomData?.requires,
                locked: roomData?.locked
            });
        }
    });
    
    const lockedRooms = overlappingRooms
        .filter(r => r.locked)
        .sort((a, b) => b.distance - a.distance);

    if (lockedRooms.length > 0) {
        const targetRoom = lockedRooms[0];
        return {
            lockType: targetRoom.lockType,
            requires: targetRoom.requires
        };
    }
    
    return null;
}

export function getLockRequirementsForItem(item) {
    if (!item.scenarioData) return null;
    
    return {
        lockType: item.scenarioData.lockType || 'key',
        requires: item.scenarioData.requires || ''
    };
}

export function unlockTarget(lockable, type, layer) {
    if (type === 'door') {
        // After unlocking, use the proper door unlock function
        unlockDoor(lockable);
    } else {
        // Handle item unlocking
        if (lockable.scenarioData) {
            lockable.scenarioData.locked = false;
            // Set new state for containers with contents
            if (lockable.scenarioData.contents) {
                lockable.scenarioData.isUnlockedButNotCollected = true;
                
                // Automatically launch container minigame after unlocking
                setTimeout(() => {
                    if (window.handleContainerInteraction) {
                        console.log('Auto-launching container minigame after unlock');
                        window.handleContainerInteraction(lockable);
                    }
                }, 500); // Small delay to ensure unlock message is shown
                
                return; // Return early to prevent automatic collection
            }
        } else {
            lockable.locked = false;
            if (lockable.contents) {
                lockable.isUnlockedButNotCollected = true;
                
                // Automatically launch container minigame after unlocking
                setTimeout(() => {
                    if (window.handleContainerInteraction) {
                        console.log('Auto-launching container minigame after unlock');
                        window.handleContainerInteraction(lockable);
                    }
                }, 500); // Small delay to ensure unlock message is shown
                
                return; // Return early to prevent automatic collection
            }
        }
    }
    console.log(`${type} unlocked successfully`);
}

// Export for global access
window.handleUnlock = handleUnlock;
window.getLockRequirementsForDoor = getLockRequirementsForDoor;
window.getLockRequirementsForItem = getLockRequirementsForItem;
window.unlockTarget = unlockTarget;

