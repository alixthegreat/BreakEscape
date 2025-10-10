/**
 * DOOR SYSTEM
 * ===========
 * 
 * Handles door sprites, interactions, transitions, and visibility management.
 * Separated from rooms.js for better modularity and maintainability.
 */

import { TILE_SIZE } from '../utils/constants.js';
import { handleUnlock, getLockRequirementsForDoor, startLockpickingMinigame, startKeySelectionMinigame } from './interactions.js';

let gameRef = null;
let rooms = null;

// Global toggle for disabling locks during testing
window.DISABLE_LOCKS = false; // Set to true in console to bypass all lock checks

// Console helper functions for testing
window.toggleLocks = function() {
    window.DISABLE_LOCKS = !window.DISABLE_LOCKS;
    console.log(`Locks ${window.DISABLE_LOCKS ? 'DISABLED' : 'ENABLED'} for testing`);
    return window.DISABLE_LOCKS;
};

window.disableLocks = function() {
    window.DISABLE_LOCKS = true;
    console.log('Locks DISABLED for testing - all doors will open without minigames');
};

window.enableLocks = function() {
    window.DISABLE_LOCKS = false;
    console.log('Locks ENABLED - doors will require proper unlocking');
};

// Door transition cooldown system
let lastDoorTransitionTime = 0;
const DOOR_TRANSITION_COOLDOWN = 1000; // 1 second cooldown between transitions
let lastDoorTransition = null; // Track the last door transition to prevent repeats

// Initialize door system
export function initializeDoors(gameInstance, roomsRef) {
    gameRef = gameInstance;
    rooms = roomsRef;
}

// Function to create door sprites based on gameScenario connections
export function createDoorSpritesForRoom(roomId, position) {
    const gameScenario = window.gameScenario;
    const roomData = gameScenario.rooms[roomId];
    if (!roomData || !roomData.connections) {
        console.log(`No connections found for room ${roomId}`);
        return [];
    }
    
    console.log(`Creating door sprites for room ${roomId}:`, roomData.connections);
    
    const doorSprites = [];
    const connections = roomData.connections;
    
    // Get room dimensions for door positioning
    const map = gameRef.cache.tilemap.get(roomData.type);
    let roomWidth = 800, roomHeight = 600; // fallback
    
    if (map) {
        if (map.json) {
            roomWidth = map.json.width * TILE_SIZE;
            roomHeight = map.json.height * TILE_SIZE;
        } else if (map.data) {
            roomWidth = map.data.width * TILE_SIZE;
            roomHeight = map.data.height * TILE_SIZE;
        }
    }
    
    console.log(`Room ${roomId} dimensions: ${roomWidth}x${roomHeight}, position: (${position.x}, ${position.y})`);
    
    // Create door sprites for each connection direction
    Object.entries(connections).forEach(([direction, connectedRooms]) => {
        const roomList = Array.isArray(connectedRooms) ? connectedRooms : [connectedRooms];
        
        roomList.forEach((connectedRoom, index) => {
            // Calculate door position based on direction
            let doorX, doorY;
            let doorWidth = TILE_SIZE, doorHeight = TILE_SIZE * 2;
            
            switch (direction) {
                case 'north':
                    // Door at top of room, 1.5 tiles in from sides
                    if (roomList.length === 1) {
                        // Single connection - check the connecting room's connections to determine position
                        const connectingRoom = roomList[0];
                        const connectingRoomConnections = window.gameScenario.rooms[connectingRoom]?.connections?.south;
                        
                        if (Array.isArray(connectingRoomConnections) && connectingRoomConnections.length > 1) {
                            // The connecting room has multiple south doors, find which one connects to this room
                            const doorIndex = connectingRoomConnections.indexOf(roomId);
                            if (doorIndex >= 0) {
                                // When the connecting room has multiple doors, position this door to match
                                // If this room is at index 0 (left), position door on the right (southeast)
                                // If this room is at index 1 (right), position door on the left (southwest)
                                if (doorIndex === 0) {
                                    // This room is on the left, so door should be on the right
                                    doorX = position.x + roomWidth - TILE_SIZE * 1.5;
                                    console.log(`North door positioning for ${roomId}: left room (index 0), door on right (southeast), doorX=${doorX}`);
                                } else {
                                    // This room is on the right, so door should be on the left
                                    doorX = position.x + TILE_SIZE * 1.5;
                                    console.log(`North door positioning for ${roomId}: right room (index ${doorIndex}), door on left (southwest), doorX=${doorX}`);
                                }
                            } else {
                                // Fallback to left positioning
                                doorX = position.x + TILE_SIZE * 1.5;
                                console.log(`North door positioning for ${roomId}: fallback to left, doorX=${doorX}`);
                            }
                        } else {
                            // Single door - use left positioning
                            doorX = position.x + TILE_SIZE * 1.5;
                            console.log(`North door positioning for ${roomId}: single connection to ${connectingRoom}, doorX=${doorX}`);
                        }
                    } else {
                        // Multiple connections - use 1.5 tile spacing from edges
                        const availableWidth = roomWidth - (TILE_SIZE * 1.5 * 2); // Subtract edge spacing
                        const doorSpacing = availableWidth / (roomList.length - 1); // Space between doors
                        doorX = position.x + TILE_SIZE * 1.5 + (doorSpacing * index); // Start at 1.5 tiles from edge
                    }
                    doorY = position.y + TILE_SIZE; // 1 tile from top
                    console.log(`North door Y position: ${doorY} (position.y=${position.y}, TILE_SIZE=${TILE_SIZE})`);
                    break;
                case 'south':
                    // Door at bottom of room, 1.5 tiles in from sides
                    if (roomList.length === 1) {
                        // Single connection - check if the connecting room has multiple doors
                        const connectingRoom = roomList[0];
                        const connectingRoomConnections = window.gameScenario.rooms[connectingRoom]?.connections?.north;
                        if (Array.isArray(connectingRoomConnections) && connectingRoomConnections.length > 1) {
                            // The connecting room has multiple north doors, find which one connects to this room
                            const doorIndex = connectingRoomConnections.indexOf(roomId);
                            if (doorIndex >= 0) {
                                // When the connecting room has multiple doors, position this door to match
                                // If this room is at index 0 (left), position door on the right (southeast)
                                // If this room is at index 1 (right), position door on the left (southwest)
                                if (doorIndex === 0) {
                                    // This room is on the left, so door should be on the right
                                    doorX = position.x + roomWidth - TILE_SIZE * 1.5;
                                    console.log(`South door positioning for ${roomId}: left room (index 0), door on right (southeast), doorX=${doorX}`);
                                } else {
                                    // This room is on the right, so door should be on the left
                                    doorX = position.x + TILE_SIZE * 1.5;
                                    console.log(`South door positioning for ${roomId}: right room (index ${doorIndex}), door on left (southwest), doorX=${doorX}`);
                                }
                            } else {
                                // Fallback to left positioning
                                doorX = position.x + TILE_SIZE * 1.5;
                                console.log(`South door positioning for ${roomId}: fallback to left, doorX=${doorX}`);
                            }
                        } else {
                            // Single door - use left positioning
                            doorX = position.x + TILE_SIZE * 1.5;
                            console.log(`South door positioning for ${roomId}: single connection to ${connectingRoom}, doorX=${doorX}`);
                        }
                    } else {
                        // Multiple connections - use 1.5 tile spacing from edges
                        const availableWidth = roomWidth - (TILE_SIZE * 1.5 * 2); // Subtract edge spacing
                        const doorSpacing = availableWidth / (roomList.length - 1); // Space between doors
                        doorX = position.x + TILE_SIZE * 1.5 + (doorSpacing * index); // Start at 1.5 tiles from edge
                    }
                    doorY = position.y + roomHeight - TILE_SIZE; // 1 tile from bottom
                    // replace the bottom most tile with a copy of the tile above
                    
                    
                    break;
                case 'east':
                    // Door at right side of room, 1 tile in from top/bottom
                    doorX = position.x + roomWidth - TILE_SIZE; // 1 tile from right
                    doorY = position.y + roomHeight / 2; // Center of room
                    doorWidth = TILE_SIZE * 2;
                    doorHeight = TILE_SIZE;
                    break;
                case 'west':
                    // Door at left side of room, 1 tile in from top/bottom
                    doorX = position.x + TILE_SIZE; // 1 tile from left
                    doorY = position.y + roomHeight / 2; // Center of room
                    doorWidth = TILE_SIZE * 2;
                    doorHeight = TILE_SIZE;
                    break;
                default:
                    return; // Skip unknown directions
            }
            
            // Create door sprite
            console.log(`Creating door sprite at (${doorX}, ${doorY}) for ${roomId} -> ${connectedRoom}`);
            
            // Create a colored rectangle as a fallback if door texture fails
            let doorSprite;
            try {
                doorSprite = gameRef.add.sprite(doorX, doorY, 'door_32');
            } catch (error) {
                console.warn(`Failed to create door sprite with 'door_32' texture, creating colored rectangle instead:`, error);
                // Create a colored rectangle as fallback
                const graphics = gameRef.add.graphics();
                graphics.fillStyle(0xff0000, 1); // Red color
                graphics.fillRect(-TILE_SIZE/2, -TILE_SIZE, TILE_SIZE, TILE_SIZE * 2);
                graphics.setPosition(doorX, doorY);
                doorSprite = graphics;
            }
            doorSprite.setOrigin(0.5, 0.5);
            doorSprite.setDepth(doorY + 0.45); // World Y + door layer offset
            doorSprite.setAlpha(1); // Visible by default
            doorSprite.setVisible(true); // Ensure visibility
            
            console.log(`Door sprite created:`, {
                x: doorSprite.x,
                y: doorSprite.y,
                visible: doorSprite.visible,
                alpha: doorSprite.alpha,
                depth: doorSprite.depth,
                texture: doorSprite.texture?.key,
                width: doorSprite.width,
                height: doorSprite.height,
                displayWidth: doorSprite.displayWidth,
                displayHeight: doorSprite.displayHeight
            });
            console.log(`Door depth: ${doorSprite.depth} (roomDepth: ${doorY}, between tiles and sprites)`);
            
            // Get lock properties from the destination room (the room you're trying to enter)
            const connectedRoomData = gameScenario.rooms[connectedRoom];
            
            // Set up door properties
            doorSprite.doorProperties = {
                roomId: roomId,
                connectedRoom: connectedRoom,
                direction: direction,
                worldX: doorX,
                worldY: doorY,
                open: false,
                locked: connectedRoomData?.locked || false,
                lockType: connectedRoomData?.lockType || null,
                requires: connectedRoomData?.requires || null
            };
            
            // Debug door properties
            console.log(`Door properties set for ${roomId} -> ${connectedRoom}:`, {
                locked: doorSprite.doorProperties.locked,
                lockType: doorSprite.doorProperties.lockType,
                requires: doorSprite.doorProperties.requires,
                connectedRoomData: connectedRoomData
            });
            
            // Set up door info for transition detection
            doorSprite.doorInfo = {
                roomId: roomId,
                connectedRoom: connectedRoom,
                direction: direction
            };
            
            // Set up collision
            gameRef.physics.add.existing(doorSprite);
            doorSprite.body.setSize(doorWidth, doorHeight);
            doorSprite.body.setImmovable(true);
            
            // Add collision with player
            if (window.player && window.player.body) {
                gameRef.physics.add.collider(window.player, doorSprite);
            }
            
            // Set up interaction zone
            const zone = gameRef.add.zone(doorX, doorY, doorWidth, doorHeight);
            zone.setInteractive({ useHandCursor: true });
            zone.on('pointerdown', () => handleDoorInteraction(doorSprite));
            
            doorSprite.interactionZone = zone;
            doorSprites.push(doorSprite);
            
            console.log(`Created door sprite for ${roomId} -> ${connectedRoom} (${direction}) at (${doorX}, ${doorY})`);
        });
    });
    
    console.log(`Created ${doorSprites.length} door sprites for room ${roomId}`);
    
    // Log camera position for debugging
    if (gameRef.cameras && gameRef.cameras.main) {
        console.log(`Camera position:`, {
            x: gameRef.cameras.main.scrollX,
            y: gameRef.cameras.main.scrollY,
            width: gameRef.cameras.main.width,
            height: gameRef.cameras.main.height
        });
    }
    
    return doorSprites;
}

// Function to handle door interactions
function handleDoorInteraction(doorSprite) {
    const player = window.player;
    if (!player) return;
    
    const distance = Phaser.Math.Distance.Between(
        player.x, player.y,
        doorSprite.x, doorSprite.y
    );
    
    const DOOR_INTERACTION_RANGE = 2 * TILE_SIZE;
    
    if (distance > DOOR_INTERACTION_RANGE) {
        console.log('Door too far to interact');
        return;
    }
    
    const props = doorSprite.doorProperties;
    console.log(`Interacting with door: ${props.roomId} -> ${props.connectedRoom}`);
    
    // Check if locks are disabled for testing
    if (window.DISABLE_LOCKS) {
        console.log('LOCKS DISABLED FOR TESTING - Opening door directly');
        openDoor(doorSprite);
        return;
    }
    
    if (props.locked) {
        console.log(`Door is locked. Type: ${props.lockType}, Requires: ${props.requires}`);
        // Use the door properties directly since we already have the lock information
        handleDoorUnlockDirect(doorSprite, props);
    } else {
        openDoor(doorSprite);
    }
}

// Function to handle door unlocking directly using door properties
function handleDoorUnlockDirect(doorSprite, props) {
    console.log('DOOR UNLOCK ATTEMPT (direct)');
    
    switch(props.lockType) {
        case 'key':
            const requiredKey = props.requires;
            console.log('KEY REQUIRED', requiredKey);
            
            // Get all keys from player's inventory
            const playerKeys = window.inventory.items.filter(item => 
                item && item.scenarioData && 
                item.scenarioData.type === 'key'
            );
            
            if (playerKeys.length > 0) {
                // Show key selection interface
                startKeySelectionMinigame(doorSprite, 'door', playerKeys, requiredKey);
            } else {
                // Check for lockpick kit
                const hasLockpick = window.inventory.items.some(item => 
                    item && item.scenarioData && 
                    item.scenarioData.type === 'lockpick'
                );
                
                if (hasLockpick) {
                    console.log('LOCKPICK AVAILABLE');
                    if (confirm("Would you like to attempt picking this lock?")) {
                        let difficulty = 'medium';
                        
                        console.log('STARTING LOCKPICK MINIGAME', { difficulty });
                        startLockpickingMinigame(doorSprite, window.game, difficulty, (success) => {
                            if (success) {
                                unlockDoor(doorSprite);
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
            if (pinInput === props.requires) {
                unlockDoor(doorSprite);
                console.log('PIN CODE SUCCESS');
                window.gameAlert(`Correct PIN! The door is now unlocked.`, 'success', 'PIN Accepted', 4000);
            } else if (pinInput !== null) {
                console.log('PIN CODE FAIL');
                window.gameAlert("Incorrect PIN code.", 'error', 'PIN Rejected', 3000);
            }
            break;
            
        case 'password':
            console.log('PASSWORD REQUESTED');
            if (window.showPasswordModal) {
                window.showPasswordModal(function(passwordInput) {
                    if (passwordInput === props.requires) {
                        unlockDoor(doorSprite);
                        console.log('PASSWORD SUCCESS');
                        window.gameAlert(`Correct password! The door is now unlocked.`, 'success', 'Password Accepted', 4000);
                    } else if (passwordInput !== null) {
                        console.log('PASSWORD FAIL');
                        window.gameAlert("Incorrect password.", 'error', 'Password Rejected', 3000);
                    }
                });
            } else {
                // Fallback to prompt
                const passwordInput = prompt(`Enter password:`);
                if (passwordInput === props.requires) {
                    unlockDoor(doorSprite);
                    console.log('PASSWORD SUCCESS');
                    window.gameAlert(`Correct password! The door is now unlocked.`, 'success', 'Password Accepted', 4000);
                } else if (passwordInput !== null) {
                    console.log('PASSWORD FAIL');
                    window.gameAlert("Incorrect password.", 'error', 'Password Rejected', 3000);
                }
            }
            break;
            
        case 'biometric':
            console.log('BIOMETRIC REQUIRED');
            const hasBiometric = window.gameState?.biometricSamples?.length > 0;
            if (hasBiometric) {
                if (confirm("Use biometric authentication?")) {
                    unlockDoor(doorSprite);
                    window.gameAlert(`Biometric authentication successful!`, 'success', 'Access Granted', 4000);
                }
            } else {
                window.gameAlert(`Biometric authentication required.`, 'error', 'Access Denied', 4000);
            }
            break;
            
        case 'bluetooth':
            console.log('BLUETOOTH REQUIRED');
            const hasBluetooth = window.gameState?.bluetoothDevices?.length > 0;
            if (hasBluetooth) {
                if (confirm("Use Bluetooth device?")) {
                    unlockDoor(doorSprite);
                    window.gameAlert(`Bluetooth authentication successful!`, 'success', 'Access Granted', 4000);
                }
            } else {
                window.gameAlert(`Bluetooth device required.`, 'error', 'Access Denied', 4000);
            }
            break;
            
        default:
            console.log('UNKNOWN LOCK TYPE:', props.lockType);
            window.gameAlert(`Unknown lock type: ${props.lockType}`, 'error', 'Locked', 4000);
            break;
    }
}

// Function to unlock a door (called by interactions.js after successful unlock)
function unlockDoor(doorSprite) {
    const props = doorSprite.doorProperties;
    console.log(`Unlocking door: ${props.roomId} -> ${props.connectedRoom}`);
    
    // Mark door as unlocked
    props.locked = false;
    
    // TODO: Implement unlock animation/effect
    
    // Open the door
    openDoor(doorSprite);
}

// Function to open a door
function openDoor(doorSprite) {
    const props = doorSprite.doorProperties;
    console.log(`Opening door: ${props.roomId} -> ${props.connectedRoom}`);
    
    // Load the connected room if it doesn't exist
    if (!rooms[props.connectedRoom]) {
        console.log(`Loading room: ${props.connectedRoom}`);
        // Import the loadRoom function from rooms.js
        if (window.loadRoom) {
            window.loadRoom(props.connectedRoom);
        }
    }
    
    // Remove wall tiles from the connected room under the door position
    if (window.removeWallTilesForDoorInRoom) {
        window.removeWallTilesForDoorInRoom(props.connectedRoom, props.roomId, props.direction, doorSprite.x, doorSprite.y);
    }
    
    // Remove the matching door sprite from the connected room
    removeMatchingDoorSprite(props.connectedRoom, props.roomId, props.direction, doorSprite.x, doorSprite.y);
    
    // Create animated door sprite on the opposite side
    createAnimatedDoorOnOppositeSide(props.connectedRoom, props.roomId, props.direction, doorSprite.x, doorSprite.y);
    
    // Remove the door sprite
    doorSprite.destroy();
    if (doorSprite.interactionZone) {
        doorSprite.interactionZone.destroy();
    }
    
    props.open = true;
}

// Function to remove the matching door sprite from the connected room
function removeMatchingDoorSprite(roomId, fromRoomId, direction, doorWorldX, doorWorldY) {
    console.log(`Removing matching door sprite in room ${roomId} for door from ${fromRoomId} (${direction})`);
    
    const room = rooms[roomId];
    if (!room || !room.doorSprites) {
        console.log(`No door sprites found for room ${roomId}`);
        return;
    }
    
    // Find the door sprite that connects to the fromRoomId
    const matchingDoorSprite = room.doorSprites.find(doorSprite => {
        const props = doorSprite.doorProperties;
        return props && props.connectedRoom === fromRoomId;
    });
    
    if (matchingDoorSprite) {
        console.log(`Found matching door sprite in room ${roomId}, removing it`);
        matchingDoorSprite.destroy();
        if (matchingDoorSprite.interactionZone) {
            matchingDoorSprite.interactionZone.destroy();
        }
        
        // Remove from the doorSprites array
        const index = room.doorSprites.indexOf(matchingDoorSprite);
        if (index > -1) {
            room.doorSprites.splice(index, 1);
        }
    } else {
        console.log(`No matching door sprite found in room ${roomId}`);
    }
}

// Function to create animated door sprite on the opposite side
function createAnimatedDoorOnOppositeSide(roomId, fromRoomId, direction, doorWorldX, doorWorldY) {
    console.log(`Creating animated door on opposite side in room ${roomId} for door from ${fromRoomId} (${direction}) at world position (${doorWorldX}, ${doorWorldY})`);
    
    const room = rooms[roomId];
    if (!room) {
        console.log(`Room ${roomId} not found, cannot create animated door`);
        return;
    }
    
    // Calculate the door position in the connected room
    const oppositeDirection = getOppositeDirection(direction);
    const roomPosition = window.roomPositions[roomId];
    const roomData = window.gameScenario.rooms[roomId];
    
    if (!roomPosition || !roomData) {
        console.log(`Missing position or data for room ${roomId}`);
        return;
    }
    
    // Get room dimensions from tilemap (same as door sprite creation)
    const map = gameRef.cache.tilemap.get(roomData.type);
    let roomWidth = 320, roomHeight = 288; // fallback (10x9 tiles at 32px)
    
    if (map) {
        if (map.json) {
            roomWidth = map.json.width * TILE_SIZE;
            roomHeight = map.json.height * TILE_SIZE;
        } else if (map.data) {
            roomWidth = map.data.width * TILE_SIZE;
            roomHeight = map.data.height * TILE_SIZE;
        }
    }
    
    // Use the same world coordinates as the original door
    let doorX = doorWorldX, doorY = doorWorldY, doorWidth, doorHeight;
    
    // Set door dimensions based on direction
    if (direction === 'north' || direction === 'south') {
        doorWidth = TILE_SIZE * 2;
        doorHeight = TILE_SIZE;
    } else if (direction === 'east' || direction === 'west') {
        doorWidth = TILE_SIZE * 2;
        doorHeight = TILE_SIZE;
    } else {
        console.log(`Unknown direction: ${direction}`);
        return;
    }
    
    // Create the animated door sprite
    let animatedDoorSprite;
    let doorTopSprite;
    try {
        // Create main door sprite
        animatedDoorSprite = gameRef.add.sprite(doorX, doorY, 'door_sheet');
        
        // Calculate the bottom of the door (where it meets the ground)
        const doorBottomY = doorY + (TILE_SIZE * 2) / 2; // doorY is center, so add half height to get bottom
        
        // Set sprite properties
        animatedDoorSprite.setOrigin(0.5, 0.5);
        animatedDoorSprite.setDepth(doorBottomY + 0.45); // Bottom Y + door layer offset
        animatedDoorSprite.setVisible(true);
        
        // Play the opening animation
        animatedDoorSprite.play('door_open');
        
        // Create door top sprite (6th frame) at high z-index
        doorTopSprite = gameRef.add.sprite(doorX, doorY, 'door_sheet');
        doorTopSprite.setOrigin(0.5, 0.5);
        doorTopSprite.setDepth(doorBottomY + 0.55); // Bottom Y + door top layer offset
        doorTopSprite.setVisible(true);
        doorTopSprite.play('door_top');
        
        // Store references to the animated doors in the room
        if (!room.animatedDoors) {
            room.animatedDoors = [];
        }
        room.animatedDoors.push(animatedDoorSprite);
        room.animatedDoors.push(doorTopSprite);
        
        console.log(`Created animated door sprite at (${doorX}, ${doorY}) in room ${roomId} with door top`);
        
    } catch (error) {
        console.warn(`Failed to create animated door sprite:`, error);
        // Fallback to a simple colored rectangle
        const graphics = gameRef.add.graphics();
        graphics.fillStyle(0x00ff00, 1); // Green color for open door
        graphics.fillRect(-doorWidth/2, -doorHeight/2, doorWidth, doorHeight);
        graphics.setPosition(doorX, doorY);
        
        // Calculate the bottom of the door (where it meets the ground)
        const doorBottomY = doorY + (TILE_SIZE * 2) / 2; // doorY is center, so add half height to get bottom
        graphics.setDepth(doorBottomY + 0.45); // Bottom Y + door layer offset
        
        if (!room.animatedDoors) {
            room.animatedDoors = [];
        }
        room.animatedDoors.push(graphics);
        
        console.log(`Created fallback animated door at (${doorX}, ${doorY}) in room ${roomId}`);
    }
}

// Helper function to get the opposite direction
export function getOppositeDirection(direction) {
    switch (direction) {
        case 'north': return 'south';
        case 'south': return 'north';
        case 'east': return 'west';
        case 'west': return 'east';
        default: return direction;
    }
}

// Function to check if player has crossed a door threshold
export function checkDoorTransitions(player) {
    // Check cooldown first
    const currentTime = Date.now();
    if (currentTime - lastDoorTransitionTime < DOOR_TRANSITION_COOLDOWN) {
        return null; // Still in cooldown
    }
    
    const playerBottomY = player.y + (player.height * player.scaleY) / 2;
    let closestTransition = null;
    let closestDistance = Infinity;
    
    // Check all rooms for door transitions
    Object.entries(rooms).forEach(([roomId, room]) => {
        if (!room.doorSprites) return;
        
        room.doorSprites.forEach(doorSprite => {
            // Get door information from the sprite's custom properties
            const doorInfo = doorSprite.doorInfo;
            if (!doorInfo) return;
            
            const { direction, connectedRoom } = doorInfo;
            
            // Skip if this would transition to the current room
            if (connectedRoom === window.currentPlayerRoom) {
                return;
            }
            
            // Skip if this is the same transition we just made
            if (lastDoorTransition === `${window.currentPlayerRoom}->${connectedRoom}`) {
                return;
            }
            
            // Calculate door threshold based on direction
            let doorThreshold = null;
            const roomPosition = room.position;
            const roomHeight = room.map.heightInPixels;
            
            if (direction === 'north') {
                // North door: threshold is 2 tiles down from top (bottom of door)
                doorThreshold = roomPosition.y + TILE_SIZE * 2; // 1 tile from top + 1 more tile for door height
            } else if (direction === 'south') {
                // South door: threshold is 2 tiles up from bottom (top of door)
                doorThreshold = roomPosition.y + roomHeight - TILE_SIZE * 2; // 1 tile from bottom + 1 more tile for door height
            }
            
            if (doorThreshold !== null) {
                // Check if player has crossed the threshold
                let shouldTransition = false;
                if (direction === 'north' && playerBottomY <= doorThreshold) {
                    shouldTransition = true;
                } else if (direction === 'south' && playerBottomY >= doorThreshold) {
                    shouldTransition = true;
                }
                
                if (shouldTransition) {
                    // Calculate distance to this door threshold
                    const distanceToThreshold = Math.abs(playerBottomY - doorThreshold);
                    
                    // Only consider this transition if it's closer than any previous one
                    if (distanceToThreshold < closestDistance) {
                        closestDistance = distanceToThreshold;
                        closestTransition = connectedRoom;
                        console.log(`Player crossed ${direction} door threshold in ${roomId} -> ${connectedRoom} (current: ${window.currentPlayerRoom}, distance: ${distanceToThreshold.toFixed(2)})`);
                    }
                }
            }
        });
    });
    
    // If a transition was detected, set the cooldown and track the transition
    if (closestTransition) {
        lastDoorTransitionTime = currentTime;
        lastDoorTransition = `${window.currentPlayerRoom}->${closestTransition}`;
    }
    
    return closestTransition;
}

// Update door sprites visibility based on which rooms are revealed
export function updateDoorSpritesVisibility() {
    const discoveredRooms = window.discoveredRooms || new Set();
    console.log(`updateDoorSpritesVisibility called. Discovered rooms:`, Array.from(discoveredRooms));
    
    Object.entries(rooms).forEach(([roomId, room]) => {
        if (!room.doorSprites) return;
        
        room.doorSprites.forEach(doorSprite => {
            // Get the door sprite's bounds (it covers 2 tiles vertically)
            const doorSpriteBounds = {
                x: doorSprite.x - TILE_SIZE/2, // Left edge of door sprite (center origin)
                y: doorSprite.y - TILE_SIZE,   // Top edge of door sprite (center origin)
                width: TILE_SIZE,              // Door sprite width
                height: TILE_SIZE * 2          // Door sprite height (2 tiles)
            };
            
            // Check if this room is revealed (doors should be visible if their room is visible)
            const thisRoomRevealed = discoveredRooms.has(roomId);
            
            // Check how many other revealed rooms this door overlaps with
            let overlappingRevealedRooms = 0;
            
            Object.entries(rooms).forEach(([otherRoomId, otherRoom]) => {
                if (!discoveredRooms.has(otherRoomId)) return; // Skip unrevealed rooms
                
                const otherRoomBounds = {
                    x: otherRoom.position.x,
                    y: otherRoom.position.y,
                    width: otherRoom.map.widthInPixels,
                    height: otherRoom.map.heightInPixels
                };
                
                // Check if door sprite bounds overlap with this revealed room
                if (boundsOverlap(doorSpriteBounds, otherRoomBounds)) {
                    overlappingRevealedRooms++;
                }
            });
            
            // Door should be visible if its room is revealed OR if it overlaps with any revealed room
            const shouldBeVisible = thisRoomRevealed || overlappingRevealedRooms > 0;
            
            console.log(`Door sprite at (${doorSprite.x}, ${doorSprite.y}) in room ${roomId}:`);
            console.log(`  This room revealed: ${thisRoomRevealed}`);
            console.log(`  Overlapping revealed rooms: ${overlappingRevealedRooms}`);
            console.log(`  Should be visible: ${shouldBeVisible}`);
            
            if (shouldBeVisible) {
                doorSprite.setVisible(true);
                doorSprite.setAlpha(1);
            } else {
                doorSprite.setVisible(false);
                doorSprite.setAlpha(0);
            }
        });
    });
}

// Helper function to check if two rectangles overlap
function boundsOverlap(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}


// Export for global access
window.updateDoorSpritesVisibility = updateDoorSpritesVisibility;
window.checkDoorTransitions = checkDoorTransitions;

// Export functions for use by other modules
export { unlockDoor };
