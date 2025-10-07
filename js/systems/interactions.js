// Object interaction system
import { INTERACTION_RANGE, INTERACTION_RANGE_SQ, INTERACTION_CHECK_INTERVAL, TILE_SIZE, DOOR_ALIGN_OVERLAP } from '../utils/constants.js?v=7';
import { rooms } from '../core/rooms.js?v=16';

// Helper function to check if two rectangles overlap
function boundsOverlap(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

let gameRef = null;

export function setGameInstance(gameInstance) {
    gameRef = gameInstance;
}

export function checkObjectInteractions() {
    // Skip if not enough time has passed since last check
    const currentTime = performance.now();
    if (this.lastInteractionCheck && 
        currentTime - this.lastInteractionCheck < INTERACTION_CHECK_INTERVAL) {
        return;
    }
    this.lastInteractionCheck = currentTime;

    const player = window.player;
    if (!player) {
        return; // Player not created yet
    }

    // Cache player position
    const px = player.x;
    const py = player.y;
    
    // Get viewport bounds for performance optimization
    const camera = gameRef ? gameRef.cameras.main : null;
    const margin = INTERACTION_RANGE * 2; // Larger margin to catch more objects
    const viewBounds = camera ? {
        left: camera.scrollX - margin,
        right: camera.scrollX + camera.width + margin,
        top: camera.scrollY - margin,
        bottom: camera.scrollY + camera.height + margin
    } : null;

    // Check ALL objects in ALL rooms, not just current room
    Object.entries(rooms).forEach(([roomId, room]) => {
        if (!room.objects) return;
        
        Object.values(room.objects).forEach(obj => {
            // Skip inactive objects
            if (!obj.active) {
                return;
            }
            
            // Skip non-interactable objects (only highlight scenario items)
            if (!obj.interactable) {
                // Clear highlight if object was previously highlighted
                if (obj.isHighlighted) {
                    obj.isHighlighted = false;
                    obj.clearTint();
                }
                return;
            }
            
            // Skip objects outside viewport for performance (if viewport bounds available)
            if (viewBounds && (
                obj.x < viewBounds.left || 
                obj.x > viewBounds.right || 
                obj.y < viewBounds.top || 
                obj.y > viewBounds.bottom)) {
                // Clear highlight if object is outside viewport
                if (obj.isHighlighted) {
                    obj.isHighlighted = false;
                    obj.clearTint();
                }
                return;
            }

            // Use squared distance for performance
            const dx = px - obj.x;
            const dy = py - obj.y;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq <= INTERACTION_RANGE_SQ) {
                if (!obj.isHighlighted) {
                    obj.isHighlighted = true;
                    obj.setTint(0x4da6ff);  // Blue tint for interactable objects
                }
            } else if (obj.isHighlighted) {
                obj.isHighlighted = false;
                obj.clearTint();
            }
        });
    });
}

// Process all door collisions
export function processAllDoorCollisions() {
    console.log('Processing door collisions');
    
    Object.entries(rooms).forEach(([roomId, room]) => {
        if (room.doorsLayer) {
            const doorTiles = room.doorsLayer.getTilesWithin()
                .filter(tile => tile.index !== -1);

            // Find all rooms that overlap with this room
            Object.entries(rooms).forEach(([otherId, otherRoom]) => {
                if (roomsOverlap(room.position, otherRoom.position)) {
                    otherRoom.wallsLayers.forEach(wallLayer => {
                        processDoorCollisions(doorTiles, wallLayer, room.doorsLayer);
                    });
                }
            });
        }
    });
}

function processDoorCollisions(doorTiles, wallLayer, doorsLayer) {
    doorTiles.forEach(doorTile => {
        // Convert door tile coordinates to world coordinates
        const worldX = doorsLayer.x + (doorTile.x * doorsLayer.tilemap.tileWidth);
        const worldY = doorsLayer.y + (doorTile.y * doorsLayer.tilemap.tileHeight);
        
        // Convert world coordinates back to the wall layer's local coordinates
        const wallX = Math.floor((worldX - wallLayer.x) / wallLayer.tilemap.tileWidth);
        const wallY = Math.floor((worldY - wallLayer.y) / wallLayer.tilemap.tileHeight);
        
        const wallTile = wallLayer.getTileAt(wallX, wallY);
        if (wallTile) {
            if (doorTile.properties?.locked) {
                wallTile.setCollision(true);
            } else {
                wallTile.setCollision(false);
            }
        }
    });
}

function roomsOverlap(pos1, pos2) {
    // Add some tolerance for overlap detection
    const OVERLAP_TOLERANCE = 48; // One tile width
    const ROOM_WIDTH = 800;
    const ROOM_HEIGHT = 600;
    
    return !(pos1.x + ROOM_WIDTH - OVERLAP_TOLERANCE < pos2.x || 
             pos1.x > pos2.x + ROOM_WIDTH - OVERLAP_TOLERANCE || 
             pos1.y + ROOM_HEIGHT - OVERLAP_TOLERANCE < pos2.y || 
             pos1.y > pos2.y + ROOM_HEIGHT - OVERLAP_TOLERANCE);
}

export function handleObjectInteraction(sprite) {
    console.log('OBJECT INTERACTION', { 
        name: sprite.name, 
        id: sprite.objectId,
        scenarioData: sprite.scenarioData
    });
    
    if (!sprite || !sprite.scenarioData) {
        console.warn('Invalid sprite or missing scenario data');
        return;
    }
    
    // Handle the Crypto Workstation
    if (sprite.scenarioData.type === "workstation") {
        window.openCryptoWorkstation();
        return;
    }
    
    // Handle biometric scanner interaction
    if (sprite.scenarioData.biometricType === 'fingerprint') {
        handleBiometricScan(sprite);
        return;
    }
    
    // Check for fingerprint collection possibility
    if (sprite.scenarioData.hasFingerprint) {
        // Check if player has fingerprint kit
        const hasKit = window.inventory.items.some(item => 
            item && item.scenarioData && 
            item.scenarioData.type === 'fingerprint_kit'
        );
        
        if (hasKit) {
            const sample = collectFingerprint(sprite);
            if (sample) {
                return; // Exit after collecting fingerprint
            }
        } else {
            window.gameAlert("You need a fingerprint kit to collect samples from this surface!", 'warning', 'Missing Equipment', 4000);
            return;
        }
    }
    
    // Skip range check for inventory items
    const isInventoryItem = window.inventory && window.inventory.items.includes(sprite);
    if (!isInventoryItem) {
        // Check if player is in range
        const player = window.player;
        if (!player) return;
        
        const dx = player.x - sprite.x;
        const dy = player.y - sprite.y;
        const distanceSq = dx * dx + dy * dy;
        
        if (distanceSq > INTERACTION_RANGE_SQ) {
            console.log('INTERACTION_OUT_OF_RANGE', { 
                objectName: sprite.name,
                objectId: sprite.objectId,
                distance: Math.sqrt(distanceSq),
                maxRange: Math.sqrt(INTERACTION_RANGE_SQ)
            });
            return;
        }
    }
    
    const data = sprite.scenarioData;
    
    // Check if item is locked
    if (data.locked === true) {
        console.log('ITEM LOCKED', data);
        handleUnlock(sprite, 'item');
        return;
    }
    
    let message = `${data.name} `;
    if (data.observations) {
        message += `Observations: ${data.observations}\n`;
    }
    
    if (data.readable && data.text) {
        message += `Text: ${data.text}\n`;
        
        // Add readable text as a note
        if (data.text.trim().length > 0) {
            const addedNote = window.addNote(data.name, data.text, data.important || false);
            
            if (addedNote) {
                window.gameAlert(`Added "${data.name}" to your notes.`, 'info', 'Note Added', 3000);
                
                // If this is a note in the inventory, remove it after adding to notes list
                if (isInventoryItem && data.type === 'notes') {
                    setTimeout(() => {
                        if (removeFromInventory(sprite)) {
                            window.gameAlert(`Removed "${data.name}" from inventory after recording in notes.`, 'success', 'Inventory Updated', 3000);
                        }
                    }, 1000);
                }
            }
        }
    }
    
    if (data.takeable) {
        // Check if it's already in inventory
        const itemIdentifier = createItemIdentifier(sprite.scenarioData);
        const isInInventory = window.inventory.items.some(item => 
            item && createItemIdentifier(item.scenarioData) === itemIdentifier
        );
        
        if (!isInInventory) {
            console.log('INVENTORY ITEM ADDED', { item: itemIdentifier });
            addToInventory(sprite);
        }
    }
    
    // Show notification
    window.gameAlert(message, 'info', data.name, 0);
}

function createItemIdentifier(scenarioData) {
    if (!scenarioData) return 'unknown';
    return `${scenarioData.type}_${scenarioData.name || 'unnamed'}`;
}

function addToInventory(sprite) {
    if (!sprite || !sprite.scenarioData) {
        console.warn('Invalid sprite for inventory');
        return;
    }
    
    try {
        console.log("Trying to add to inventory:", {
            objectId: sprite.objectId,
            name: sprite.name,
            type: sprite.scenarioData?.type,
            currentRoom: window.currentPlayerRoom
        });
        
        // Check if the item is already in the inventory
        const itemIdentifier = createItemIdentifier(sprite.scenarioData);
        const isAlreadyInInventory = window.inventory.items.some(item => 
            createItemIdentifier(item.scenarioData) === itemIdentifier
        );
        
        if (isAlreadyInInventory) {
            console.log(`Item ${itemIdentifier} is already in inventory`);
            return false;
        }
        
        // Remove from room if it exists
        if (window.currentPlayerRoom && rooms[window.currentPlayerRoom] && rooms[window.currentPlayerRoom].objects) {
            if (rooms[window.currentPlayerRoom].objects[sprite.objectId]) {
                const roomObj = rooms[window.currentPlayerRoom].objects[sprite.objectId];
                roomObj.setVisible(false);
                roomObj.active = false;
                console.log(`Removed object ${sprite.objectId} from room`);
            }
        }
        
        sprite.setVisible(false);
        
        // Find first empty slot
        const inventoryContainer = document.getElementById('inventory-container');
        if (!inventoryContainer) {
            console.error('Inventory container not found');
            return false;
        }
        
        const slots = inventoryContainer.getElementsByClassName('inventory-slot');
        let emptySlot = null;
        for (const slot of slots) {
            if (!slot.hasChildNodes()) {
                emptySlot = slot;
                break;
            }
        }
        
        if (!emptySlot) {
            console.warn('No empty inventory slots available');
            return false;
        }
        
        // Create inventory item
        const itemImg = document.createElement('img');
        itemImg.className = 'inventory-item';
        itemImg.src = `assets/objects/${sprite.name}.png`;
        itemImg.alt = sprite.scenarioData.name;
        
        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'inventory-tooltip';
        tooltip.textContent = sprite.scenarioData.name;
        
        // Add item data
        itemImg.scenarioData = {
            ...sprite.scenarioData,
            foundIn: window.currentPlayerRoom ? window.gameScenario.rooms[window.currentPlayerRoom].name || window.currentPlayerRoom : 'unknown location'
        };
        itemImg.name = sprite.name;
        itemImg.objectId = `inventory_${sprite.name}_${window.inventory.items.length}`;
        
        // Add click handler
        itemImg.addEventListener('click', function() {
            handleObjectInteraction(this);
        });
        
        // Add to slot
        emptySlot.appendChild(itemImg);
        emptySlot.appendChild(tooltip);
        
        // Add to inventory array
        window.inventory.items.push(itemImg);
        
        // Show notification
        window.gameAlert(`Added ${sprite.scenarioData.name} to inventory`, 'success', 'Item Collected', 3000);
        
        // If this is the Bluetooth scanner, show the toggle button
        if (sprite.scenarioData.type === "bluetooth_scanner") {
            const bluetoothToggle = document.getElementById('bluetooth-toggle');
            if (bluetoothToggle) {
                bluetoothToggle.style.display = 'flex';
            }
        }
        
        // If this is the fingerprint kit, show the biometrics toggle button
        if (sprite.scenarioData.type === "fingerprint_kit") {
            const biometricsToggle = document.getElementById('biometrics-toggle');
            if (biometricsToggle) {
                biometricsToggle.style.display = 'flex';
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error adding to inventory:', error);
        return false;
    }
}

function removeFromInventory(item) {
    try {
        // Find the item in the inventory array
        const itemIndex = window.inventory.items.indexOf(item);
        if (itemIndex === -1) return false;
        
        // Remove from array
        window.inventory.items.splice(itemIndex, 1);
        
        // Remove from DOM
        const slot = item.parentElement;
        if (slot) {
            slot.innerHTML = '';
        }
        
        // Hide bluetooth toggle if we dropped the bluetooth scanner
        if (item.scenarioData.type === "bluetooth_scanner") {
            const bluetoothToggle = document.getElementById('bluetooth-toggle');
            if (bluetoothToggle) {
                bluetoothToggle.style.display = 'none';
            }
        }
        
        // Hide biometrics toggle if we dropped the fingerprint kit
        if (item.scenarioData.type === "fingerprint_kit") {
            const biometricsToggle = document.getElementById('biometrics-toggle');
            if (biometricsToggle) {
                biometricsToggle.style.display = 'none';
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error removing from inventory:', error);
        return false;
    }
}

function handleUnlock(lockable, type) {
    console.log('UNLOCK ATTEMPT');
    
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
                startKeySelectionMinigame(lockable, type, playerKeys, requiredKey);
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
                                unlockTarget(lockable, type, lockable.layer);
                                window.gameAlert(`Successfully picked the lock!`, 'success', 'Lock Picked', 4000);
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
            const pinInput = prompt(`Enter PIN code:`);
            if (pinInput === lockRequirements.requires) {
                unlockTarget(lockable, type, lockable.layer);
                console.log('PIN CODE SUCCESS');
                window.gameAlert(`Correct PIN! The ${type} is now unlocked.`, 'success', 'PIN Accepted', 4000);
            } else if (pinInput !== null) {
                console.log('PIN CODE FAIL');
                window.gameAlert("Incorrect PIN code.", 'error', 'PIN Rejected', 3000);
            }
            break;
            
        case 'password':
            console.log('PASSWORD REQUESTED');
            if (window.showPasswordModal) {
                window.showPasswordModal(function(passwordInput) {
                    if (passwordInput === lockRequirements.requires) {
                        unlockTarget(lockable, type, lockable.layer);
                        console.log('PASSWORD SUCCESS');
                        window.gameAlert(`Correct password! The ${type} is now unlocked.`, 'success', 'Password Accepted', 4000);
                    } else if (passwordInput !== null) {
                        console.log('PASSWORD FAIL');
                        window.gameAlert("Incorrect password.", 'error', 'Password Rejected', 3000);
                    }
                });
            } else {
                // Fallback to prompt
                const passwordInput = prompt(`Enter password:`);
                if (passwordInput === lockRequirements.requires) {
                    unlockTarget(lockable, type, lockable.layer);
                    console.log('PASSWORD SUCCESS');
                    window.gameAlert(`Correct password! The ${type} is now unlocked.`, 'success', 'Password Accepted', 4000);
                } else if (passwordInput !== null) {
                    console.log('PASSWORD FAIL');
                    window.gameAlert("Incorrect password.", 'error', 'Password Rejected', 3000);
                }
            }
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

function getLockRequirementsForDoor(doorSprite) {
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

function getLockRequirementsForItem(item) {
    if (!item.scenarioData) return null;
    
    return {
        lockType: item.scenarioData.lockType || 'key',
        requires: item.scenarioData.requires || ''
    };
}

function unlockTarget(lockable, type, layer) {
    if (type === 'door') {
        // After unlocking, open the door
        // Find the room that contains this door sprite
        const room = Object.values(rooms).find(r => 
            r.doorSprites && r.doorSprites.includes(lockable)
        );
        if (room) {
            openDoor(lockable, room);
        }
    } else {
        // Handle item unlocking
        if (lockable.scenarioData) {
            lockable.scenarioData.locked = false;
            // Set new state for containers with contents
            if (lockable.scenarioData.contents) {
                lockable.scenarioData.isUnlockedButNotCollected = true;
                return; // Return early to prevent automatic collection
            }
        } else {
            lockable.locked = false;
            if (lockable.contents) {
                lockable.isUnlockedButNotCollected = true;
                return; // Return early to prevent automatic collection
            }
        }
    }
    console.log(`${type} unlocked successfully`);
}

// This function is no longer needed - door unlocking is handled by the minigame system
// and door opening is handled by openDoor()
function unlockDoor(doorTile, doorsLayer) {
    console.log('unlockDoor called - this should not happen');
    // The unlock process is handled by the minigame system
    // When unlock is successful, unlockTarget() calls openDoor()
}

// Store door zones globally so we can manage them
window.doorZones = window.doorZones || new Map();

export function setupDoorOverlapChecks() {
    if (!gameRef) {
        console.error('Game reference not set in interactions.js');
        return;
    }
    
    const DOOR_INTERACTION_RANGE = 2 * TILE_SIZE;
    
    // Clear existing door zones
    if (window.doorZones) {
        window.doorZones.forEach(zone => {
            if (zone && zone.destroy) {
                zone.destroy();
            }
        });
        window.doorZones.clear();
    }
    
    Object.entries(rooms).forEach(([roomId, room]) => {
        if (!room.doorSprites) return;

        const doorSprites = room.doorSprites;
        
        // Get room data to check if this room should be locked
        const gameScenario = window.gameScenario;
        const roomData = gameScenario?.rooms?.[roomId];
        
        doorSprites.forEach(doorSprite => {
            const zone = gameRef.add.zone(doorSprite.x, doorSprite.y, TILE_SIZE, TILE_SIZE * 2);
            zone.setInteractive({ useHandCursor: true });
            
            // Store zone reference for later management
            const zoneKey = `${roomId}_${doorSprite.doorProperties.topTile.x}_${doorSprite.doorProperties.topTile.y}`;
            window.doorZones.set(zoneKey, zone);
            
            zone.on('pointerdown', () => {
                console.log('Door clicked:', { doorSprite, room });
                console.log('Door properties:', doorSprite.doorProperties);
                console.log('Door open state:', doorSprite.doorProperties?.open);
                console.log('Door sprite position:', { x: doorSprite.x, y: doorSprite.y });
                
                const player = window.player;
                if (!player) return;
                
                const distance = Phaser.Math.Distance.Between(
                    player.x, player.y,
                    doorSprite.x, doorSprite.y
                );
                
                if (distance <= DOOR_INTERACTION_RANGE) {
                    handleDoorInteraction(doorSprite, room);
                } else {
                    console.log('DOOR TOO FAR TO INTERACT');
                }
            });

            gameRef.physics.world.enable(zone);
        });
    });
}

// Function to update door zone visibility based on room visibility
export function updateDoorZoneVisibility() {
    if (!window.doorZones || !gameRef) return;
    
    const discoveredRooms = window.discoveredRooms || new Set();
    
    window.doorZones.forEach((zone, zoneKey) => {
        const [roomId] = zoneKey.split('_');
        
        // Show zone if this room is discovered
        if (discoveredRooms.has(roomId)) {
            zone.setVisible(true);
            zone.setInteractive({ useHandCursor: true });
        } else {
            zone.setVisible(false);
            zone.setInteractive(false);
        }
    });
}

function colorDoorSprite(doorSprite, isLocked = null) {
    // Visual feedback for door sprites
    if (doorSprite) {
        const isOpen = doorSprite.doorProperties?.open;
        
        if (isOpen) {
            doorSprite.setTint(0x000000); // Black tint for open doors
        } else if (isLocked) {
            doorSprite.setTint(0xff0000); // Red tint for locked doors
        } else {
            doorSprite.setTint(0xffffff); // White tint for closed but unlocked doors
        }
    }
}

function handleDoorInteraction(doorSprite, room) {
    // Check if door is already open
    if (doorSprite.doorProperties.open) {
        console.log('DOOR ALREADY OPEN');
        return;
    }
    
    // Check if door is locked by looking up lock requirements
    const lockRequirements = getLockRequirementsForDoor(doorSprite);
    const isLocked = lockRequirements && lockRequirements.requires;
    
    if (isLocked) {
        console.log('DOOR LOCKED - ATTEMPTING UNLOCK');
        colorDoorSprite(doorSprite, true);
        handleDoorUnlock(doorSprite, room);
    } else {
        console.log('DOOR UNLOCKED - OPENING DOOR');
        openDoor(doorSprite, room);
    }
}

function handleDoorUnlock(doorSprite, room) {
    console.log('DOOR UNLOCK ATTEMPT');
    handleUnlock(doorSprite, 'door');
}







function openDoor(doorSprite, room) {
    console.log('OPENING DOOR');
    console.log('Door sprite before opening:', { x: doorSprite.x, y: doorSprite.y, open: doorSprite.doorProperties?.open });
    
    // Mark door sprite as open
    doorSprite.doorProperties.open = true;
    
    // Remove the door sprite (this removes collision and visual)
    doorSprite.destroy();
    
    // Remove from room's door sprites array
    const spriteIndex = room.doorSprites.indexOf(doorSprite);
    if (spriteIndex > -1) {
        room.doorSprites.splice(spriteIndex, 1);
    }
    
    console.log('Door sprite removed - door is now open');
    
    // Show success message
    window.gameAlert('Door opened successfully!', 'success', 'Door Opened', 2000);
    
    console.log('DOOR OPENED SUCCESSFULLY');
}

function startLockpickingMinigame(lockable, scene, difficulty = 'medium', callback) {
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

function startKeySelectionMinigame(lockable, type, playerKeys, requiredKeyId) {
    console.log('Starting key selection minigame', { playerKeys, requiredKeyId });
    
    // Initialize the minigame framework if not already done
    if (!window.MinigameFramework) {
        console.error('MinigameFramework not available');
        // Fallback to simple key selection
        const correctKey = playerKeys.find(key => key.scenarioData.key_id === requiredKeyId);
        if (correctKey) {
            window.gameAlert(`You used the ${correctKey.scenarioData.name} to unlock the ${type}.`, 'success', 'Unlock Successful', 4000);
            unlockTarget(lockable, type, lockable.layer);
        } else {
            window.gameAlert('None of your keys work with this lock.', 'error', 'Wrong Keys', 4000);
        }
        return;
    }
    
    // Use the advanced minigame framework
    if (!window.MinigameFramework.mainGameScene) {
        window.MinigameFramework.init(window.game);
    }
    
    // Convert inventory keys to the format expected by the minigame
    const inventoryKeys = playerKeys.map(key => {
        // Generate cuts data if not present
        let cuts = key.scenarioData.cuts;
        if (!cuts) {
            // Generate random cuts based on the key_id for consistency
            const seed = key.scenarioData.key_id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const random = (min, max) => {
                const x = Math.sin(seed++) * 10000;
                return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min;
            };
            
            cuts = [];
            for (let i = 0; i < 5; i++) {
                cuts.push(random(20, 80)); // Random cuts between 20-80
            }
        }
        
        return {
            id: key.scenarioData.key_id,
            name: key.scenarioData.name,
            cuts: cuts,
            pinCount: key.scenarioData.pinCount || 5
        };
    });
    
    // Start the key selection minigame
    window.MinigameFramework.startMinigame('lockpicking', null, {
        keyMode: true,
        skipStartingKey: true,
        lockable: lockable,
        onComplete: (success, result) => {
            if (success) {
                console.log('KEY SELECTION SUCCESS');
                window.gameAlert('Successfully unlocked with the correct key!', 'success', 'Unlock Successful', 4000);
                unlockTarget(lockable, type, lockable.layer);
            } else {
                console.log('KEY SELECTION FAILED');
                window.gameAlert('The selected key doesn\'t work with this lock.', 'error', 'Wrong Key', 4000);
            }
        }
    });
    
    // Start with key selection using inventory keys
    setTimeout(() => {
        if (window.MinigameFramework.currentMinigame && window.MinigameFramework.currentMinigame.startWithKeySelection) {
            window.MinigameFramework.currentMinigame.startWithKeySelection(inventoryKeys, requiredKeyId);
        }
    }, 500);
}

// Fingerprint collection function
function collectFingerprint(item) {
    if (!item.scenarioData?.hasFingerprint) {
        window.gameAlert("No fingerprints found on this surface.", 'info', 'No Fingerprints', 3000);
        return null;
    }
    
    // Start the dusting minigame
    startDustingMinigame(item);
    return true;
}

// Handle biometric scanner interaction
function handleBiometricScan(sprite) {
    const player = window.player;
    if (!player) return;
    
    // Check if player is in range
    const dx = player.x - sprite.x;
    const dy = player.y - sprite.y;
    const distanceSq = dx * dx + dy * dy;
    
    if (distanceSq > INTERACTION_RANGE_SQ) {
        window.gameAlert('You need to be closer to use the biometric scanner.', 'warning', 'Too Far', 3000);
        return;
    }
    
    // Show biometric authentication interface
    window.gameAlert('Place your finger on the scanner...', 'info', 'Biometric Scan', 2000);
    
    // Simulate biometric scan process
    setTimeout(() => {
        // For now, just show a message - can be enhanced with actual authentication logic
        window.gameAlert('Biometric scan complete.', 'success', 'Scan Complete', 3000);
    }, 2000);
}

// Start fingerprint dusting minigame
function startDustingMinigame(item) {
    console.log('Starting dusting minigame for item:', item);
    
    // Check if MinigameFramework is available
    if (!window.MinigameFramework) {
        console.error('MinigameFramework not available - using fallback');
        // Fallback to simple collection
        window.gameAlert('Collecting fingerprint sample...', 'info', 'Dusting', 2000);
        
        setTimeout(() => {
            const quality = 0.7 + Math.random() * 0.3;
            const rating = quality >= 0.9 ? 'Excellent' : 
                          quality >= 0.8 ? 'Good' : 
                          quality >= 0.7 ? 'Fair' : 'Poor';
            
            if (!window.gameState) {
                window.gameState = { biometricSamples: [] };
            }
            if (!window.gameState.biometricSamples) {
                window.gameState.biometricSamples = [];
            }
            
            const sample = {
                id: `sample_${Date.now()}`,
                type: 'fingerprint',
                owner: item.scenarioData.fingerprintOwner || 'Unknown',
                quality: quality,
                data: generateFingerprintData(item),
                timestamp: Date.now()
            };
            
            window.gameState.biometricSamples.push(sample);
            
            if (item.scenarioData) {
                item.scenarioData.hasFingerprint = false;
            }
            
            if (window.updateBiometricsPanel) {
                window.updateBiometricsPanel();
            }
            if (window.updateBiometricsCount) {
                window.updateBiometricsCount();
            }
            
            window.gameAlert(`Collected ${sample.owner}'s fingerprint sample (${rating} quality)`, 'success', 'Sample Acquired', 4000);
        }, 2000);
        return;
    }
    
    // Initialize the framework if not already done
    if (!window.MinigameFramework.mainGameScene) {
        window.MinigameFramework.init(window.game);
    }
    
    // Add scene reference to item for the minigame  
    item.scene = window.game;
    
    // Start the dusting minigame
    window.MinigameFramework.startMinigame('dusting', {
        item: item,
        scene: item.scene,
        onComplete: (success, result) => {
            if (success) {
                console.log('DUSTING SUCCESS', result);
                
                // Add fingerprint to gameState
                if (!window.gameState) {
                    window.gameState = { biometricSamples: [] };
                }
                if (!window.gameState.biometricSamples) {
                    window.gameState.biometricSamples = [];
                }
                
                const sample = {
                    id: generateFingerprintData(item),
                    type: 'fingerprint',
                    owner: item.scenarioData.fingerprintOwner || 'Unknown',
                    quality: result.quality, // Quality between 0.7 and ~1.0
                    data: generateFingerprintData(item),
                    timestamp: Date.now()
                };
                
                window.gameState.biometricSamples.push(sample);
                
                // Mark item as collected
                if (item.scenarioData) {
                    item.scenarioData.hasFingerprint = false;
                }
                
                // Update the biometrics panel and count
                if (window.updateBiometricsPanel) {
                    window.updateBiometricsPanel();
                }
                if (window.updateBiometricsCount) {
                    window.updateBiometricsCount();
                }
                
                // Show notification
                window.gameAlert(`Collected ${sample.owner}'s fingerprint sample (${result.rating} quality)`, 'success', 'Sample Acquired', 4000);
            } else {
                console.log('DUSTING FAILED');
                window.gameAlert(`Failed to collect the fingerprint sample.`, 'error', 'Dusting Failed', 4000);
            }
        }
    });
}

// Generate fingerprint data
function generateFingerprintData(item) {
    const owner = item.scenarioData?.fingerprintOwner || 'Unknown';
    const timestamp = Date.now();
    return `${owner}_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
}

// Export for global access
window.checkObjectInteractions = checkObjectInteractions;
window.setupDoorOverlapChecks = setupDoorOverlapChecks;
window.handleObjectInteraction = handleObjectInteraction;
window.processAllDoorCollisions = processAllDoorCollisions;
window.startKeySelectionMinigame = startKeySelectionMinigame;
window.updateDoorZoneVisibility = updateDoorZoneVisibility; 