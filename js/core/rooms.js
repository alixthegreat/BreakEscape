/**
 * ROOM MANAGEMENT SYSTEM - SIMPLIFIED DEPTH LAYERING APPROACH
 * ===========================================================
 * 
 * This system implements a simplified depth-based layering approach where all elements
 * use their world Y position + layer offset for depth calculation.
 * 
 * DEPTH CALCULATION PHILOSOPHY:
 * -----------------------------
 * 1. **World Y Position**: All depth calculations are based on the world Y position
 *    of the element (bottom of sprites, room ground level).
 * 
 * 2. **Layer Offsets**: Each element type has a fixed layer offset added to its Y position
 *    to create proper layering hierarchy.
 * 
 * 3. **Room Y Offset**: Room Y position is considered to be 2 tiles south of the actual
 *    room position (where door sprites are positioned).
 * 
 * DEPTH HIERARCHY:
 * ----------------
 * Room Layers (world Y + layer offset):
 * - Floor:     roomWorldY + 0.1
 * - Collision: roomWorldY + 0.15  
 * - Walls:     roomWorldY + 0.2
 * - Props:     roomWorldY + 0.3
 * - Other:     roomWorldY + 0.4
 * 
 * Interactive Elements (world Y + layer offset):
 * - Doors:     doorY + 0.45 (between room tiles and sprites)
 * - Door Tops: doorY + 0.55 (above doors, below sprites)
 * - Animated Doors: doorBottomY + 0.45 (bottom Y + door layer offset)
 * - Animated Door Tops: doorBottomY + 0.55 (bottom Y + door top layer offset)
 * - Player:    playerBottomY + 0.5 (dynamic based on Y position)
 * - Objects:   objectBottomY + 0.5 (dynamic based on Y position)
 * 
 * DEPTH CALCULATION CONSISTENCY:
 * ------------------------------
 * ✅ All elements use world Y position + layer offset
 * ✅ Room Y is 2 tiles south of room position
 * ✅ Player and objects use bottom Y position
 * ✅ Simple and consistent across all elements
 */

// Room management system
import { TILE_SIZE, DOOR_ALIGN_OVERLAP, GRID_SIZE, INTERACTION_RANGE_SQ, INTERACTION_CHECK_INTERVAL } from '../utils/constants.js?v=7';

export let rooms = {};
export let currentRoom = '';
export let currentPlayerRoom = '';
export let discoveredRooms = new Set();

// Helper function to check if a position overlaps with existing items
function isPositionOverlapping(x, y, roomId, itemSize = TILE_SIZE) {
    const room = rooms[roomId];
    if (!room || !room.objects) return false;
    
    // Check against all existing objects in the room
    for (const obj of Object.values(room.objects)) {
        if (!obj || !obj.active) continue;
        
        // Calculate overlap with some padding
        const padding = TILE_SIZE * 0.5; // Half tile padding
        const objLeft = obj.x - padding;
        const objRight = obj.x + obj.width + padding;
        const objTop = obj.y - padding;
        const objBottom = obj.y + obj.height + padding;
        
        const newLeft = x;
        const newRight = x + itemSize;
        const newTop = y;
        const newBottom = y + itemSize;
        
        // Check for overlap
        if (newLeft < objRight && newRight > objLeft && 
            newTop < objBottom && newBottom > objTop) {
            return true; // Overlap detected
        }
    }
    
    return false; // No overlap
}
// Make discoveredRooms available globally
window.discoveredRooms = discoveredRooms;
let gameRef = null;

// Door transition cooldown system
let lastDoorTransitionTime = 0;
const DOOR_TRANSITION_COOLDOWN = 1000; // 1 second cooldown between transitions
let lastDoorTransition = null; // Track the last door transition to prevent repeats

// Helper function to check if two rectangles overlap
function boundsOverlap(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// Define scale factors for different object types
const OBJECT_SCALES = {
    'notes': 0.75,
    'key': 0.75,
    'phone': 1,
    'tablet': 0.75,
    'bluetooth_scanner': 0.7
};

// Function to create door sprites based on gameScenario connections
function createDoorSpritesForRoom(roomId, position) {
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
            
            // Set up door properties
            doorSprite.doorProperties = {
                roomId: roomId,
                connectedRoom: connectedRoom,
                direction: direction,
                worldX: doorX,
                worldY: doorY,
                open: false,
                locked: roomData.locked || false,
                lockType: roomData.lockType || null,
                requires: roomData.requires || null
            };
            
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
    
    if (props.locked) {
        console.log(`Door is locked. Type: ${props.lockType}, Requires: ${props.requires}`);
        // TODO: Implement lock checking logic based on lockType
        // For now, just unlock if we have the required item
        if (window.checkDoorUnlock && window.checkDoorUnlock(props)) {
            unlockDoor(doorSprite);
        } else {
            console.log('Door unlock check failed');
        }
    } else {
        openDoor(doorSprite);
    }
}

// Function to unlock a door
function unlockDoor(doorSprite) {
    const props = doorSprite.doorProperties;
    console.log(`Unlocking door: ${props.roomId} -> ${props.connectedRoom}`);
    
    // TODO: Implement unlock animation/effect
    props.locked = false;
    openDoor(doorSprite);
}

// Function to open a door
function openDoor(doorSprite) {
    const props = doorSprite.doorProperties;
    console.log(`Opening door: ${props.roomId} -> ${props.connectedRoom}`);
    
    // Load the connected room if it doesn't exist
    if (!rooms[props.connectedRoom]) {
        console.log(`Loading room: ${props.connectedRoom}`);
        loadRoom(props.connectedRoom);
    }
    
    // Remove wall tiles from the connected room under the door position
    removeWallTilesForDoorInRoom(props.connectedRoom, props.roomId, props.direction, doorSprite.x, doorSprite.y);
    
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

// Function to load a room lazily
function loadRoom(roomId) {
    const gameScenario = window.gameScenario;
    const roomData = gameScenario.rooms[roomId];
    const position = window.roomPositions[roomId];
    
    if (!roomData || !position) {
        console.error(`Cannot load room ${roomId}: missing data or position`);
        return;
    }
    
    console.log(`Lazy loading room: ${roomId}`);
    createRoom(roomId, roomData, position);
    revealRoom(roomId);
}

// Function to remove wall tiles under doors
function removeTilesUnderDoor(wallLayer, roomId, position) {
    console.log(`Removing wall tiles under doors in room ${roomId}`);

    // Remove wall tiles under doors using the same positioning logic as door sprites
    const gameScenario = window.gameScenario;
    const roomData = gameScenario.rooms[roomId];
    if (!roomData || !roomData.connections) {
        console.log(`No connections found for room ${roomId}, skipping wall tile removal`);
        return;
    }
    
    // Get room dimensions for door positioning (same as door sprite creation)
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
    
    const connections = roomData.connections;
    
    // Process each connection direction
    Object.entries(connections).forEach(([direction, connectedRooms]) => {
        const roomList = Array.isArray(connectedRooms) ? connectedRooms : [connectedRooms];
        
        roomList.forEach((connectedRoom, index) => {
            // Calculate door position using the same logic as door sprite creation
            let doorX, doorY;
            let doorWidth = TILE_SIZE, doorHeight = TILE_SIZE * 2;
            
            switch (direction) {
                case 'north':
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
                                } else {
                                    // This room is on the right, so door should be on the left
                                    doorX = position.x + TILE_SIZE * 1.5;
                                }
                            } else {
                                // Fallback to left positioning
                                doorX = position.x + TILE_SIZE * 1.5;
                            }
                        } else {
                            // Single door - use left positioning
                            doorX = position.x + TILE_SIZE * 1.5;
                        }
                    } else {
                        // Multiple connections - use 1.5 tile spacing from edges
                        const availableWidth = roomWidth - (TILE_SIZE * 1.5 * 2); // Subtract edge spacing
                        const doorSpacing = availableWidth / (roomList.length - 1); // Space between doors
                        doorX = position.x + TILE_SIZE * 1.5 + (doorSpacing * index); // Start at 1.5 tiles from edge
                    }
                    doorY = position.y + TILE_SIZE;
                    break;
                case 'south':
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
                                } else {
                                    // This room is on the right, so door should be on the left
                                    doorX = position.x + TILE_SIZE * 1.5;
                                }
                            } else {
                                // Fallback to left positioning
                                doorX = position.x + TILE_SIZE * 1.5;
                            }
                        } else {
                            // Single door - use left positioning
                            doorX = position.x + TILE_SIZE * 1.5;
                        }
                    } else {
                        // Multiple connections - use 1.5 tile spacing from edges
                        const availableWidth = roomWidth - (TILE_SIZE * 1.5 * 2); // Subtract edge spacing
                        const doorSpacing = availableWidth / (roomList.length - 1); // Space between doors
                        doorX = position.x + TILE_SIZE * 1.5 + (doorSpacing * index); // Start at 1.5 tiles from edge
                    }
                    doorY = position.y + roomHeight - TILE_SIZE;
                    break;
                case 'east':
                    doorX = position.x + roomWidth - TILE_SIZE;
                    doorY = position.y + roomHeight / 2;
                    doorWidth = TILE_SIZE * 2;
                    doorHeight = TILE_SIZE;
                    break;
                case 'west':
                    doorX = position.x + TILE_SIZE;
                    doorY = position.y + roomHeight / 2;
                    doorWidth = TILE_SIZE * 2;
                    doorHeight = TILE_SIZE;
                    break;
                default:
                    return;
            }
            
            // Use Phaser's getTilesWithin to get tiles that overlap with the door area
            const doorBounds = {
                x: doorX - (doorWidth / 2), // Door sprite origin is center, so adjust bounds
                y: doorY - (doorHeight / 2),
                width: doorWidth,
                height: doorHeight
            };
            
            // Convert door bounds to tilemap coordinates (relative to the layer)
            const doorBoundsInTilemap = {
                x: doorBounds.x - wallLayer.x,
                y: doorBounds.y - wallLayer.y,
                width: doorBounds.width,
                height: doorBounds.height
            };
            
            console.log(`Removing wall tiles for ${roomId} -> ${connectedRoom} (${direction}): door at (${doorX}, ${doorY}), world bounds:`, doorBounds, `tilemap bounds:`, doorBoundsInTilemap);
            console.log(`Wall layer info: x=${wallLayer.x}, y=${wallLayer.y}, width=${wallLayer.width}, height=${wallLayer.height}`);
            
            // Try a different approach - convert to tile coordinates first
            const doorTileX = Math.floor(doorBoundsInTilemap.x / TILE_SIZE);
            const doorTileY = Math.floor(doorBoundsInTilemap.y / TILE_SIZE);
            const doorTilesWide = Math.ceil(doorBoundsInTilemap.width / TILE_SIZE);
            const doorTilesHigh = Math.ceil(doorBoundsInTilemap.height / TILE_SIZE);
            
            console.log(`Door tile coordinates: (${doorTileX}, ${doorTileY}) covering ${doorTilesWide}x${doorTilesHigh} tiles`);
            
            // Check what tiles exist in the door area manually
            let foundTiles = [];
            for (let x = 0; x < doorTilesWide; x++) {
                for (let y = 0; y < doorTilesHigh; y++) {
                    const tileX = doorTileX + x;
                    const tileY = doorTileY + y;
                    const tile = wallLayer.getTileAt(tileX, tileY);
                    if (tile && tile.index !== -1) {
                        foundTiles.push({x: tileX, y: tileY, tile: tile});
                        console.log(`Found wall tile at (${tileX}, ${tileY}) with index ${tile.index}`);
                    }
                }
            }
            
            console.log(`Manually found ${foundTiles.length} wall tiles in door area`);
            
            // Get all tiles within the door bounds (using tilemap coordinates)
            const overlappingTiles = wallLayer.getTilesWithin(
                doorBoundsInTilemap.x,
                doorBoundsInTilemap.y,
                doorBoundsInTilemap.width,
                doorBoundsInTilemap.height
            );
            
            console.log(`getTilesWithin found ${overlappingTiles.length} tiles overlapping with door area`);
            
            // Use the manually found tiles if getTilesWithin didn't work
            const tilesToRemove = foundTiles.length > 0 ? foundTiles : overlappingTiles;
            
            // Remove wall tiles that overlap with the door
            tilesToRemove.forEach(tileData => {
                const tileX = tileData.x;
                const tileY = tileData.y;
                
                // Remove the wall tile
                const removedTile = wallLayer.tilemap.removeTileAt(
                    tileX,
                    tileY,
                    true,  // replaceWithNull
                    true,  // recalculateFaces
                    wallLayer  // layer
                );
                
                if (removedTile) {
                    console.log(`Removed wall tile at (${tileX}, ${tileY}) under door ${roomId} -> ${connectedRoom}`);
                }
            });
            
            // Recalculate collision after removing tiles
            if (tilesToRemove.length > 0) {
                console.log(`Recalculating collision for wall layer in ${roomId} after removing ${tilesToRemove.length} tiles`);
                wallLayer.setCollisionByExclusion([-1]);
            }
        });
    });
    
    // // Convert door world position to tile coordinates
    // const doorTileX = Math.floor((doorPos.x - wallLayer.x) / TILE_SIZE);
    // const doorTileY = Math.floor((doorPos.y - wallLayer.y) / TILE_SIZE);
    
    // // Calculate how many tiles the door covers
    // const doorTilesWide = Math.ceil(doorPos.width / TILE_SIZE);
    // const doorTilesHigh = Math.ceil(doorPos.height / TILE_SIZE);
    
    // console.log(`Door covers ${doorTilesWide}x${doorTilesHigh} tiles at tile position (${doorTileX}, ${doorTileY})`);
    
    // // Remove wall tiles in the door area
    // for (let x = 0; x < doorTilesWide; x++) {
    //     for (let y = 0; y < doorTilesHigh; y++) {
    //         const tileX = doorTileX + x;
    //         const tileY = doorTileY + y;
            
    //         // Check if there's a wall tile at this position
    //         const wallTile = wallLayer.getTileAt(tileX, tileY);
    //         if (wallTile && wallTile.index !== -1) {
    //             // Remove the wall tile
    //             const removedTile = wallLayer.tilemap.removeTileAt(
    //                 tileX,
    //                 tileY,
    //                 true,  // replaceWithNull
    //                 true,  // recalculateFaces
    //                 wallLayer  // layer
    //             );
                
    //             if (removedTile) {
    //                 console.log(`Removed wall tile at (${tileX}, ${tileY}) under door in room ${roomId}`);
    //             }
    //         }
    //     }
    // }
}

// Function to remove wall tiles from a specific room for a door connection
function removeWallTilesForDoorInRoom(roomId, fromRoomId, direction, doorWorldX, doorWorldY) {
    console.log(`Removing wall tiles in room ${roomId} for door from ${fromRoomId} (${direction}) at world position (${doorWorldX}, ${doorWorldY})`);
    
    const room = rooms[roomId];
    if (!room || !room.wallsLayers || room.wallsLayers.length === 0) {
        console.log(`No wall layers found for room ${roomId}`);
        return;
    }
    
    // Calculate the door position in the connected room
    // The door should be on the opposite side of the connection
    const oppositeDirection = getOppositeDirection(direction);
    const roomPosition = window.roomPositions[roomId];
    const roomData = window.gameScenario.rooms[roomId];
    
    if (!roomPosition || !roomData) {
        console.log(`Missing position or data for room ${roomId}`);
        return;
    }
    
    // Get room dimensions
    const roomWidth = roomData.width || 320;
    const roomHeight = roomData.height || 288;
    
    // Calculate door position in the connected room based on the opposite direction
    let doorX, doorY, doorWidth, doorHeight;
    
    // Calculate door position based on the room's door configuration
    if (direction === 'north' || direction === 'south') {
        // For north/south connections, calculate X position based on room configuration
        const oppositeDirection = getOppositeDirection(direction);
        const connections = roomData.connections?.[oppositeDirection];
        
        if (Array.isArray(connections)) {
            // Multiple doors - find the one that connects to fromRoomId
            const doorIndex = connections.indexOf(fromRoomId);
            if (doorIndex >= 0) {
                const totalDoors = connections.length;
                const availableWidth = roomWidth - (TILE_SIZE * 3); // 1.5 tiles from each edge
                const doorSpacing = totalDoors > 1 ? availableWidth / (totalDoors - 1) : 0;
                doorX = roomPosition.x + TILE_SIZE * 1.5 + (doorIndex * doorSpacing);
            } else {
                doorX = roomPosition.x + roomWidth / 2; // Default to center
            }
        } else {
            // Single door - check if the connecting room has multiple doors
            const connectingRoomConnections = window.gameScenario.rooms[fromRoomId]?.connections?.[direction];
            if (Array.isArray(connectingRoomConnections) && connectingRoomConnections.length > 1) {
                // The connecting room has multiple doors, find which one connects to this room
                const doorIndex = connectingRoomConnections.indexOf(roomId);
                if (doorIndex >= 0) {
                    // When the connecting room has multiple doors, position this door to match
                    // If this room is at index 0 (left), position door on the right (southeast)
                    // If this room is at index 1 (right), position door on the left (southwest)
                    if (doorIndex === 0) {
                        // This room is on the left, so door should be on the right
                        doorX = roomPosition.x + roomWidth - TILE_SIZE * 1.5;
                        console.log(`Wall tile removal door positioning for ${roomId}: left room (index 0), door on right (southeast), calculated doorX=${doorX}`);
                    } else {
                        // This room is on the right, so door should be on the left
                        doorX = roomPosition.x + TILE_SIZE * 1.5;
                        console.log(`Wall tile removal door positioning for ${roomId}: right room (index ${doorIndex}), door on left (southwest), calculated doorX=${doorX}`);
                    }
                } else {
                    // Fallback to left positioning
                    doorX = roomPosition.x + TILE_SIZE * 1.5;
                    console.log(`Wall tile removal door positioning for ${roomId}: fallback to left, calculated doorX=${doorX}`);
                }
            } else {
                // Single door - use left positioning
                doorX = roomPosition.x + TILE_SIZE * 1.5;
                console.log(`Wall tile removal door positioning for ${roomId}: single connection to ${fromRoomId}, calculated doorX=${doorX}`);
            }
        }
        
        if (direction === 'north') {
            // Original door is north, so new door should be south
            doorY = roomPosition.y + roomHeight - TILE_SIZE;
        } else {
            // Original door is south, so new door should be north
            doorY = roomPosition.y + TILE_SIZE;
        }
        doorWidth = TILE_SIZE * 2;
        doorHeight = TILE_SIZE;
    } else if (direction === 'east' || direction === 'west') {
        // For east/west connections, calculate Y position based on room configuration
        doorY = roomPosition.y + roomHeight / 2; // Center of room
        if (direction === 'east') {
            // Original door is east, so new door should be west
            doorX = roomPosition.x + TILE_SIZE;
        } else {
            // Original door is west, so new door should be east
            doorX = roomPosition.x + roomWidth - TILE_SIZE;
        }
        doorWidth = TILE_SIZE;
        doorHeight = TILE_SIZE * 2;
    } else {
        console.log(`Unknown direction: ${direction}`);
        return;
    }
    
    // For debugging: Calculate what the door position should be based on room dimensions
    const expectedSouthDoorY = roomPosition.y + roomHeight - TILE_SIZE;
    const expectedNorthDoorY = roomPosition.y + TILE_SIZE;
    console.log(`Expected door positions for ${roomId}: north=${expectedNorthDoorY}, south=${expectedSouthDoorY}`);
    
    // Debug: Log the room position and calculated door position
    console.log(`Room ${roomId} position: (${roomPosition.x}, ${roomPosition.y}), dimensions: ${roomWidth}x${roomHeight}`);
    console.log(`Original door at (${doorWorldX}, ${doorWorldY}), calculated door at (${doorX}, ${doorY})`);
    console.log(`Direction: ${direction}, oppositeDirection: ${getOppositeDirection(direction)}`);
    console.log(`Room connections:`, roomData.connections);
    

    
    console.log(`Calculated door position in ${roomId}: (${doorX}, ${doorY}) for ${oppositeDirection} connection`);
    
    // Remove wall tiles from all wall layers in this room
    room.wallsLayers.forEach(wallLayer => {
        // Calculate door bounds
        // For north/south doors, the door sprite origin is at the center, but we need to adjust for the actual door position
        let doorBounds;
        if (oppositeDirection === 'north' || oppositeDirection === 'south') {
            // For north/south doors, the door should cover the full width and be positioned at the edge
            doorBounds = {
                x: doorX - (doorWidth / 2),
                y: doorY, // Don't subtract half height - the door is positioned at the edge
                width: doorWidth,
                height: doorHeight
            };
        } else {
            // For east/west doors, use center positioning
            doorBounds = {
                x: doorX - (doorWidth / 2),
                y: doorY - (doorHeight / 2),
                width: doorWidth,
                height: doorHeight
            };
        }
        
        // For debugging: Show the door sprite dimensions and bounds
        console.log(`Door sprite at (${doorX}, ${doorY}) with dimensions ${doorWidth}x${doorHeight}`);
        console.log(`Door bounds: x=${doorBounds.x}, y=${doorBounds.y}, width=${doorBounds.width}, height=${doorBounds.height}`);
        
        // Convert door bounds to tilemap coordinates
        const doorBoundsInTilemap = {
            x: doorBounds.x - wallLayer.x,
            y: doorBounds.y - wallLayer.y,
            width: doorBounds.width,
            height: doorBounds.height
        };
        
        console.log(`Removing wall tiles in ${roomId} for ${oppositeDirection} door: world bounds:`, doorBounds, `tilemap bounds:`, doorBoundsInTilemap);
        console.log(`Wall layer position: (${wallLayer.x}, ${wallLayer.y}), size: ${wallLayer.width}x${wallLayer.height}`);
        console.log(`Room position: (${roomPosition.x}, ${roomPosition.y}), door position: (${doorX}, ${doorY})`);
        
        // Convert to tile coordinates
        const doorTileX = Math.floor(doorBoundsInTilemap.x / TILE_SIZE);
        const doorTileY = Math.floor(doorBoundsInTilemap.y / TILE_SIZE);
        const doorTilesWide = Math.ceil(doorBoundsInTilemap.width / TILE_SIZE);
        const doorTilesHigh = Math.ceil(doorBoundsInTilemap.height / TILE_SIZE);
        
        console.log(`Expected tile Y: ${Math.floor((doorY - roomPosition.y) / TILE_SIZE)}, actual tile Y: ${doorTileY}`);
        
        console.log(`Door tile coordinates in ${roomId}: (${doorTileX}, ${doorTileY}) covering ${doorTilesWide}x${doorTilesHigh} tiles`);
        
        // Check what tiles exist in the door area manually
        let foundTiles = [];
        for (let x = 0; x < doorTilesWide; x++) {
            for (let y = 0; y < doorTilesHigh; y++) {
                const tileX = doorTileX + x;
                const tileY = doorTileY + y;
                const tile = wallLayer.getTileAt(tileX, tileY);
                if (tile && tile.index !== -1) {
                    foundTiles.push({x: tileX, y: tileY, tile: tile});
                    console.log(`Found wall tile at (${tileX}, ${tileY}) with index ${tile.index} in ${roomId}`);
                }
            }
        }
        
        console.log(`Manually found ${foundTiles.length} wall tiles in door area in ${roomId}`);
        
        // Remove wall tiles that overlap with the door
        foundTiles.forEach(tileData => {
            const tileX = tileData.x;
            const tileY = tileData.y;
            
            // Remove the wall tile
            const removedTile = wallLayer.tilemap.removeTileAt(
                tileX,
                tileY,
                true,  // replaceWithNull
                true,  // recalculateFaces
                wallLayer  // layer
            );
            
            if (removedTile) {
                console.log(`Removed wall tile at (${tileX}, ${tileY}) under door in ${roomId}`);
            }
        });
        
        // Recalculate collision after removing tiles
        if (foundTiles.length > 0) {
            console.log(`Recalculating collision for wall layer in ${roomId} after removing ${foundTiles.length} tiles`);
            wallLayer.setCollisionByExclusion([-1]);
        }
    });
}

// Helper function to get the opposite direction
function getOppositeDirection(direction) {
    switch (direction) {
        case 'north': return 'south';
        case 'south': return 'north';
        case 'east': return 'west';
        case 'west': return 'east';
        default: return direction;
    }
}

// Function to remove wall tiles from all overlapping room layers at a world position
function removeWallTilesAtWorldPosition(worldX, worldY, debugInfo = '') {
    console.log(`Removing wall tiles at world position (${worldX}, ${worldY}) - ${debugInfo}`);
    
    // Find all rooms and their wall layers that could contain this world position
        Object.entries(rooms).forEach(([roomId, room]) => {
        if (!room.wallsLayers || room.wallsLayers.length === 0) return;
        
        room.wallsLayers.forEach(wallLayer => {
            try {
                // Convert world coordinates to tile coordinates for this layer
                const tileX = Math.floor((worldX - room.position.x) / TILE_SIZE);
                const tileY = Math.floor((worldY - room.position.y) / TILE_SIZE);
                
                // Check if the tile coordinates are within the layer bounds
                const wallTile = wallLayer.getTileAt(tileX, tileY);
                if (wallTile && wallTile.index !== -1) {
                    // Remove the wall tile using the map's removeTileAt method
                    const removedTile = room.map.removeTileAt(
                        tileX,
                        tileY,
                        true,  // replaceWithNull
                        true,  // recalculateFaces
                        wallLayer  // layer
                    );
                    
                    if (removedTile) {
                        console.log(`  Removed wall tile at (${tileX},${tileY}) from room ${roomId} layer ${wallLayer.name}`);
                    }
                } else {
                    console.log(`  No wall tile found at (${tileX},${tileY}) in room ${roomId} layer ${wallLayer.name || 'unnamed'}`);
                }
            } catch (error) {
                console.warn(`Error removing wall tile from room ${roomId}:`, error);
            }
        });
    });
}

export function initializeRooms(gameInstance) {
    gameRef = gameInstance;
    console.log('Initializing rooms');
    rooms = {};
    window.rooms = rooms; // Ensure window.rooms references the same object
    currentRoom = '';
    currentPlayerRoom = '';
    window.currentPlayerRoom = '';
    discoveredRooms = new Set();
    // Update global reference
    window.discoveredRooms = discoveredRooms;
    
    // Calculate room positions for lazy loading
    window.roomPositions = calculateRoomPositions(gameInstance);
    console.log('Room positions calculated for lazy loading');
}

// Door validation is now handled by the sprite-based door system
export function validateDoorsByRoomOverlap() {
    console.log('Door validation is now handled by the sprite-based door system');
}

// Calculate world bounds
export function calculateWorldBounds(gameInstance) {
    console.log('Calculating world bounds');
    const gameScenario = window.gameScenario;
    if (!gameScenario || !gameScenario.rooms) {
        console.error('Game scenario not loaded properly');
        return {
            x: -1800,
            y: -1800,
            width: 3600,
            height: 3600
        };
    }

    let minX = -1800, minY = -1800, maxX = 1800, maxY = 1800;
    
    // Check all room positions to determine world bounds
    const roomPositions = calculateRoomPositions(gameInstance);
    Object.entries(gameScenario.rooms).forEach(([roomId, room]) => {
        const position = roomPositions[roomId];
        if (position) {
            // Get actual room dimensions
            const map = gameInstance.cache.tilemap.get(room.type);
            let roomWidth = 800, roomHeight = 600; // fallback
            
            if (map) {
                let width, height;
                if (map.json) {
                    width = map.json.width;
                    height = map.json.height;
                } else if (map.data) {
                    width = map.data.width;
                    height = map.data.height;
                } else {
                    width = map.width;
                    height = map.height;
                }
                
                if (width && height) {
                    roomWidth = width * TILE_SIZE;   // tile width is TILE_SIZE
                    roomHeight = height * TILE_SIZE; // tile height is TILE_SIZE
                }
            }
            
            minX = Math.min(minX, position.x);
            minY = Math.min(minY, position.y);
            maxX = Math.max(maxX, position.x + roomWidth);
            maxY = Math.max(maxY, position.y + roomHeight);
        }
    });

    // Add some padding
    const padding = 200;
    return {
        x: minX - padding,
        y: minY - padding,
        width: (maxX - minX) + (padding * 2),
        height: (maxY - minY) + (padding * 2)
    };
}

export function calculateRoomPositions(gameInstance) {
    const OVERLAP = 64;
    const positions = {};
    const gameScenario = window.gameScenario;
    
    console.log('=== Starting Room Position Calculations ===');
    
    // Get room dimensions from tilemaps
    const roomDimensions = {};
    Object.entries(gameScenario.rooms).forEach(([roomId, roomData]) => {
        const map = gameInstance.cache.tilemap.get(roomData.type);
        console.log(`Debug - Room ${roomId}:`, {
            mapData: map,
            fullData: map?.data,
            json: map?.json
        });
        
        // Try different ways to access the data
        if (map) {
            let width, height;
            if (map.json) {
                width = map.json.width;
                height = map.json.height;
            } else if (map.data) {
                width = map.data.width;
                height = map.data.height;
            } else {
                width = map.width;
                height = map.height;
            }
            
            roomDimensions[roomId] = {
                width: width * TILE_SIZE,  // tile width is TILE_SIZE
                height: height * TILE_SIZE // tile height is TILE_SIZE
            };
        } else {
            console.error(`Could not find tilemap data for room ${roomId}`);
            // Fallback to default dimensions if needed
            roomDimensions[roomId] = {
                width: 320,  // default width (10 tiles at 32px)
                height: 288  // default height (9 tiles at 32px)
            };
        }
    });
    
    // Start with reception room at origin
    positions[gameScenario.startRoom] = { x: 0, y: 0 };
    console.log(`Starting room ${gameScenario.startRoom} position:`, positions[gameScenario.startRoom]);
    
    // Process rooms level by level, starting from reception
    const processed = new Set([gameScenario.startRoom]);
    const queue = [gameScenario.startRoom];
    
    while (queue.length > 0) {
        const currentRoomId = queue.shift();
        const currentRoom = gameScenario.rooms[currentRoomId];
        const currentPos = positions[currentRoomId];
        const currentDimensions = roomDimensions[currentRoomId];
        
        console.log(`\nProcessing room ${currentRoomId}`);
        console.log('Current position:', currentPos);
        console.log('Connections:', currentRoom.connections);
        
        Object.entries(currentRoom.connections).forEach(([direction, connected]) => {
            console.log(`\nProcessing ${direction} connection:`, connected);
            
            if (Array.isArray(connected)) {
                const roomsToProcess = connected.filter(r => !processed.has(r));
                console.log('Unprocessed connected rooms:', roomsToProcess);
                if (roomsToProcess.length === 0) return;
                
                if (direction === 'north' || direction === 'south') {
                    const firstRoom = roomsToProcess[0];
                    const firstRoomWidth = roomDimensions[firstRoom].width;
                    const firstRoomHeight = roomDimensions[firstRoom].height;
                    
                    const secondRoom = roomsToProcess[1];
                    const secondRoomWidth = roomDimensions[secondRoom].width;
                    const secondRoomHeight = roomDimensions[secondRoom].height;
                    
                    if (direction === 'north') {
                        // First room - right edge aligns with current room's left edge
                        positions[firstRoom] = {
                            x: currentPos.x - firstRoomWidth + DOOR_ALIGN_OVERLAP,
                            y: currentPos.y - firstRoomHeight + OVERLAP
                        };
                        
                        // Second room - left edge aligns with current room's right edge
                        positions[secondRoom] = {
                            x: currentPos.x + currentDimensions.width - DOOR_ALIGN_OVERLAP,
                            y: currentPos.y - secondRoomHeight + OVERLAP
                        };
                    } else if (direction === 'south') {
                        // First room - left edge aligns with current room's right edge
                        positions[firstRoom] = {
                            x: currentPos.x - firstRoomWidth + DOOR_ALIGN_OVERLAP,
                            y: currentPos.y + currentDimensions.height - OVERLAP
                        };
                        
                        // Second room - right edge aligns with current room's left edge
                        positions[secondRoom] = {
                            x: currentPos.x + currentDimensions.width - DOOR_ALIGN_OVERLAP,
                            y: currentPos.y + currentDimensions.height - secondRoomHeight - OVERLAP
                        };
                    }
                    
                    roomsToProcess.forEach(roomId => {
                        processed.add(roomId);
                        queue.push(roomId);
                        console.log(`Positioned room ${roomId} at:`, positions[roomId]);
                    });
                }
            } else {
                if (processed.has(connected)) {
                    return;
                }
                
                const connectedDimensions = roomDimensions[connected];
                
                // Center the connected room
                const x = currentPos.x + 
                    (currentDimensions.width - connectedDimensions.width) / 2;
                const y = direction === 'north'
                    ? currentPos.y - connectedDimensions.height + OVERLAP
                    : currentPos.y + currentDimensions.height - OVERLAP;
                
                
                positions[connected] = { x, y };
                processed.add(connected);
                queue.push(connected);
                
                console.log(`Positioned single room ${connected} at:`, positions[connected]);
            }
        });
    }
    
    console.log('\n=== Final Room Positions ===');
    Object.entries(positions).forEach(([roomId, pos]) => {
        console.log(`${roomId}:`, pos);
    });
    
    return positions;
}

// Function to create thin collision boxes for wall tiles
function createWallCollisionBoxes(wallLayer, roomId, position) {
    console.log(`Creating wall collision boxes for room ${roomId}`);
    
    // Get room dimensions from the map
    const map = rooms[roomId].map;
    const roomWidth = map.widthInPixels;
    const roomHeight = map.heightInPixels;
    
    console.log(`Room ${roomId} dimensions: ${roomWidth}x${roomHeight} at position (${position.x}, ${position.y})`);
    
    const collisionBoxes = [];
    
    // Get all wall tiles from the layer
    const wallTiles = wallLayer.getTilesWithin(0, 0, map.width, map.height, { isNotEmpty: true });
    
    wallTiles.forEach(tile => {
        const tileX = tile.x;
        const tileY = tile.y;
        const worldX = position.x + (tileX * TILE_SIZE);
        const worldY = position.y + (tileY * TILE_SIZE);
        
        // Create collision boxes for all applicable edges (not just one)
        const tileCollisionBoxes = [];
        
        // North wall (top 2 rows) - collision on south edge
        if (tileY < 2) {
            const collisionBox = gameRef.add.rectangle(
                worldX + TILE_SIZE / 2,
                worldY + TILE_SIZE - 4, // 4px from south edge
                TILE_SIZE,
                8, // Thicker collision box
                0x000000,
                0 // Invisible
            );
            tileCollisionBoxes.push(collisionBox);
        }
        
        // South wall (bottom row) - collision on south edge
        if (tileY === map.height - 1) {
            const collisionBox = gameRef.add.rectangle(
                worldX + TILE_SIZE / 2,
                worldY + TILE_SIZE - 4, // 4px from south edge
                TILE_SIZE,
                8, // Thicker collision box
                0x000000,
                0 // Invisible
            );
            tileCollisionBoxes.push(collisionBox);
        }
        
        // West wall (left column) - collision on east edge
        if (tileX === 0) {
            const collisionBox = gameRef.add.rectangle(
                worldX + TILE_SIZE - 4, // 4px from east edge
                worldY + TILE_SIZE / 2,
                8, // Thicker collision box
                TILE_SIZE,
                0x000000,
                0 // Invisible
            );
            tileCollisionBoxes.push(collisionBox);
        }
        
        // East wall (right column) - collision on west edge
        if (tileX === map.width - 1) {
            const collisionBox = gameRef.add.rectangle(
                worldX + 4, // 4px from west edge
                worldY + TILE_SIZE / 2,
                8, // Thicker collision box
                TILE_SIZE,
                0x000000,
                0 // Invisible
            );
            tileCollisionBoxes.push(collisionBox);
        }
        
        // Set up all collision boxes for this tile
        tileCollisionBoxes.forEach(collisionBox => {
            collisionBox.setVisible(false);
            gameRef.physics.add.existing(collisionBox, true);
            
            // Wait for the next frame to ensure body is fully initialized
            gameRef.time.delayedCall(0, () => {
                if (collisionBox.body) {
                    // Use direct property assignment (fallback method)
                    collisionBox.body.immovable = true;
                }
            });
            
            collisionBoxes.push(collisionBox);
        });
    });
    
    console.log(`Created ${collisionBoxes.length} wall collision boxes for room ${roomId}`);
    
    // Add collision with player for all collision boxes
    const player = window.player;
    if (player && player.body) {
        collisionBoxes.forEach(collisionBox => {
            gameRef.physics.add.collider(player, collisionBox);
        });
        console.log(`Added ${collisionBoxes.length} wall collision boxes for room ${roomId}`);
    } else {
        console.warn(`Player not ready for room ${roomId}, storing ${collisionBoxes.length} collision boxes for later`);
        if (!rooms[roomId].pendingWallCollisionBoxes) {
            rooms[roomId].pendingWallCollisionBoxes = [];
        }
        rooms[roomId].pendingWallCollisionBoxes.push(...collisionBoxes);
    }
    
    // Store collision boxes in room for cleanup
    if (!rooms[roomId].wallCollisionBoxes) {
        rooms[roomId].wallCollisionBoxes = [];
    }
    rooms[roomId].wallCollisionBoxes.push(...collisionBoxes);
}

// Set up collision detection between chairs and other objects
function setupChairCollisions(chair) {
    if (!chair || !chair.body) return;
    
    // Collision with other chairs
    if (window.chairs) {
        window.chairs.forEach(otherChair => {
            if (otherChair !== chair && otherChair.body) {
                gameRef.physics.add.collider(chair, otherChair);
            }
        });
    }
    
    // Collision with tables and other static objects
    Object.values(rooms).forEach(room => {
        if (room.objects) {
            Object.values(room.objects).forEach(obj => {
                if (obj !== chair && obj.body && obj.body.immovable) {
                    gameRef.physics.add.collider(chair, obj);
                }
            });
        }
    });
    
    // Collision with wall collision boxes
    Object.values(rooms).forEach(room => {
        if (room.wallCollisionBoxes) {
            room.wallCollisionBoxes.forEach(wallBox => {
                if (wallBox.body) {
                    gameRef.physics.add.collider(chair, wallBox);
                }
            });
        }
    });
    
    // Collision with closed door sprites
    Object.values(rooms).forEach(room => {
        if (room.doorSprites) {
            room.doorSprites.forEach(doorSprite => {
                // Only collide with closed doors (doors that haven't been opened)
                if (doorSprite.body && doorSprite.body.immovable) {
                    gameRef.physics.add.collider(chair, doorSprite);
                }
            });
        }
    });
}

// Set up collisions between existing chairs and new room objects
function setupExistingChairsWithNewRoom(roomId) {
    if (!window.chairs) return;
    
    const room = rooms[roomId];
    if (!room) return;
    
    // Collision with new room's tables and static objects
    if (room.objects) {
        Object.values(room.objects).forEach(obj => {
            if (obj.body && obj.body.immovable) {
                window.chairs.forEach(chair => {
                    if (chair.body) {
                        gameRef.physics.add.collider(chair, obj);
                    }
                });
            }
        });
    }
    
    // Collision with new room's wall collision boxes
    if (room.wallCollisionBoxes) {
        room.wallCollisionBoxes.forEach(wallBox => {
            if (wallBox.body) {
                window.chairs.forEach(chair => {
                    if (chair.body) {
                        gameRef.physics.add.collider(chair, wallBox);
                    }
                });
            }
        });
    }
    
    // Collision with new room's door sprites
    if (room.doorSprites) {
        room.doorSprites.forEach(doorSprite => {
            // Only collide with closed doors (doors that haven't been opened)
            if (doorSprite.body && doorSprite.body.immovable) {
                window.chairs.forEach(chair => {
                    if (chair.body) {
                        gameRef.physics.add.collider(chair, doorSprite);
                    }
                });
            }
        });
    }
}

export function createRoom(roomId, roomData, position) {
    try {
        console.log(`Creating room ${roomId} of type ${roomData.type}`);
        const gameScenario = window.gameScenario;
        
        const map = gameRef.make.tilemap({ key: roomData.type });
        const tilesets = [];
        
        // Add tilesets
        console.log('Available tilesets:', map.tilesets.map(t => ({
            name: t.name,
            columns: t.columns,
            firstgid: t.firstgid,
            tilecount: t.tilecount
        })));
        
        const regularTilesets = map.tilesets.filter(t => 
            !t.name.includes('Interiors_48x48') && 
            t.name !== 'objects' && // Skip the objects tileset as it's handled separately
            t.name !== 'tables' && // Skip the tables tileset as it's also an ImageCollection
            !t.name.includes('../objects/') && // Skip individual object tilesets
            !t.name.includes('../tables/') && // Skip individual table tilesets
            t.columns > 0 // Only process tilesets with columns (regular tilesets)
        );
        
        console.log('Filtered tilesets to process:', regularTilesets.map(t => t.name));
        
        regularTilesets.forEach(tileset => {
            console.log(`Attempting to add tileset: ${tileset.name}`);
            const loadedTileset = map.addTilesetImage(tileset.name, tileset.name);
            if (loadedTileset) {
                tilesets.push(loadedTileset);
                console.log(`Added regular tileset: ${tileset.name}`);
            } else {
                console.log(`Failed to add tileset: ${tileset.name}`);
            }
        });

        // Initialize room data structure first
        rooms[roomId] = {
            map,
            layers: {},
            wallsLayers: [],
            objects: {},
            position
        };
        
        // Ensure window.rooms is updated
        window.rooms = rooms;

        const layers = rooms[roomId].layers;
        const wallsLayers = rooms[roomId].wallsLayers;
        
        // IMPORTANT: This counter ensures unique layer IDs across ALL rooms and should not be removed
        if (!window.globalLayerCounter) window.globalLayerCounter = 0;

        // Calculate base depth for this room's layers
        // Use world Y position + layer offset (room Y is 2 tiles south of actual room position)
        const roomWorldY = position.y + TILE_SIZE * 2; // Room Y is 2 tiles south of room position
        
        // Create door sprites based on gameScenario connections
        const doorSprites = createDoorSpritesForRoom(roomId, position);
        rooms[roomId].doorSprites = doorSprites;
        console.log(`Stored ${doorSprites.length} door sprites in room ${roomId}`);
        
        // Store door positions for wall tile removal
        const doorPositions = doorSprites.map(doorSprite => ({
            x: doorSprite.x,
            y: doorSprite.y,
            width: doorSprite.body ? doorSprite.body.width : TILE_SIZE,
            height: doorSprite.body ? doorSprite.body.height : TILE_SIZE * 2
        }));

        // Create other layers with appropriate depths
        map.layers.forEach((layerData, index) => {
            // Skip the doors layer since we're using sprite-based doors
            if (layerData.name.toLowerCase().includes('doors')) {
                console.log(`Skipping doors layer: ${layerData.name} in room ${roomId}`);
                return;
            }

            window.globalLayerCounter++;
            const uniqueLayerId = `${roomId}_${layerData.name}_${window.globalLayerCounter}`;
            
            const layer = map.createLayer(index, tilesets, position.x, position.y);
            if (layer) {
                layer.name = uniqueLayerId;
                // remove tiles under doors
                removeTilesUnderDoor(layer, roomId, position);

                
                // Set depth based on layer type and room position
                if (layerData.name.toLowerCase().includes('floor')) {
                    layer.setDepth(roomWorldY + 0.1);
                    console.log(`Floor layer depth: ${roomWorldY + 0.1}`);
                } else if (layerData.name.toLowerCase().includes('walls')) {
                    layer.setDepth(roomWorldY + 0.2);
                    console.log(`Wall layer depth: ${roomWorldY + 0.2}`);
                    
                    // Remove wall tiles under doors
                    removeTilesUnderDoor(layer, roomId, position);
                    
                    // Set up wall layer (collision disabled - using custom collision boxes instead)
                    try {
                        // Disabled: layer.setCollisionByExclusion([-1]);
                        console.log(`Wall layer ${uniqueLayerId} - using custom collision boxes instead of tile collision`);
                        
                        wallsLayers.push(layer);
                        console.log(`Added wall layer: ${uniqueLayerId}`);
                        
                        // Disabled: Old collision system between player and wall layer
                        // const player = window.player;
                        // if (player && player.body) {
                        //     gameRef.physics.add.collider(player, layer);
                        //     console.log(`Added collision between player and wall layer: ${uniqueLayerId}`);
                        // }
                        
                        // Create thin collision boxes for wall tiles
                        createWallCollisionBoxes(layer, roomId, position);
                    } catch (e) {
                        console.warn(`Error setting up collisions for ${uniqueLayerId}:`, e);
                    }
                } else if (layerData.name.toLowerCase().includes('collision')) {
                    layer.setDepth(roomWorldY + 0.15);
                    console.log(`Collision layer depth: ${roomWorldY + 0.15}`);
                    
                    // Set up collision layer (collision disabled - using custom collision boxes instead)
                    try {
                        // Disabled: layer.setCollisionByExclusion([-1]);
                        console.log(`Collision layer ${uniqueLayerId} - using custom collision boxes instead of tile collision`);
                        
                        // Disabled: Old collision system between player and collision layer
                        // const player = window.player;
                        // if (player && player.body) {
                        //     gameRef.physics.add.collider(player, layer);
                        //     console.log(`Added collision between player and collision layer: ${uniqueLayerId}`);
                        // }
                    } catch (e) {
                        console.warn(`Error setting up collision layer ${uniqueLayerId}:`, e);
                    }
                } else if (layerData.name.toLowerCase().includes('props')) {
                    layer.setDepth(roomWorldY + 0.3);
                    console.log(`Props layer depth: ${roomWorldY + 0.3}`);
                } else {
                    // Other layers (decorations, etc.)
                    layer.setDepth(roomWorldY + 0.4);
                    console.log(`Other layer depth: ${roomWorldY + 0.4}`);
                }
                
                layers[uniqueLayerId] = layer;
                layer.setVisible(false);
                layer.setAlpha(0);
            }
        });

        // Handle new Tiled object layers with grouping logic
        const objectLayers = [
            'tables', 'table_items', 'conditional_table_items', 
            'items', 'conditional_items'
        ];
        
        // First, collect all objects by layer
        const objectsByLayer = {};
        objectLayers.forEach(layerName => {
            const objectLayer = map.getObjectLayer(layerName);
            if (objectLayer && objectLayer.objects.length > 0) {
                objectsByLayer[layerName] = objectLayer.objects;
                console.log(`Collected ${layerName} layer with ${objectLayer.objects.length} objects`);
            }
        });
        
        // Process tables first to establish base positions
        const tableObjects = [];
        if (objectsByLayer.tables) {
            objectsByLayer.tables.forEach(obj => {
                const processedObj = processObject(obj, position, roomId, 'table');
                if (processedObj) {
                    tableObjects.push(processedObj);
                }
            });
        }
        
        // Group table items with their closest tables
        const tableGroups = [];
        tableObjects.forEach(table => {
            const group = {
                table: table,
                items: [],
                baseDepth: table.sprite.depth
            };
            tableGroups.push(group);
        });
        
        // Process table items and assign them to groups
        if (objectsByLayer.table_items) {
            objectsByLayer.table_items.forEach(obj => {
                const processedObj = processObject(obj, position, roomId, 'table_item');
                if (processedObj) {
                    // Find the closest table
                    const closestTable = findClosestTable(processedObj.sprite, tableObjects);
                    if (closestTable) {
                        const group = tableGroups.find(g => g.table === closestTable);
                        if (group) {
                            group.items.push(processedObj);
                        }
                    }
                }
            });
        }
        
        // Conditional table items are now handled by scenario matching system
        
        // Set z-index ordering for each group (table first, then items from north to south)
        tableGroups.forEach(group => {
            // Table is already at the correct depth
            console.log(`Setting up group for table at depth ${group.baseDepth}`);
            
            // Sort items from north to south (lower Y values first)
            group.items.sort((a, b) => a.sprite.y - b.sprite.y);
            
            // Set items to share the same base depth as the table
            group.items.forEach((item, index) => {
                // Table items don't need elevation - they're grouped with the table
                const itemDepth = group.baseDepth + (index + 1) * 0.01; // Slight offset for proper ordering
                item.sprite.setDepth(itemDepth);
                
                // No elevation for table items
                item.sprite.elevation = 0;
                console.log(`Set item ${item.sprite.name} to depth ${itemDepth} (north to south order, no elevation)`);
            });
        });
        
        // Process scenario objects with conditional item matching first
        const usedItems = processScenarioObjectsWithConditionalMatching(roomId, position, objectsByLayer);
        
        // Process all non-conditional items (chairs, plants, etc.)
        // Give them default properties if not used in scenario
        if (objectsByLayer.items) {
            objectsByLayer.items.forEach(obj => {
                const imageName = getImageNameFromObject(obj);
                const baseType = extractBaseTypeFromImageName(imageName);
                
                // Skip if this base type was used by scenario objects
                if (imageName && (usedItems.has(imageName) || usedItems.has(baseType))) {
                    console.log(`Skipping regular item ${imageName} (baseType: ${baseType}) - used by scenario object`);
                    return;
                }
                processObject(obj, position, roomId, 'item');
            });
        }
        
        // Helper function to process scenario objects with conditional matching
        function processScenarioObjectsWithConditionalMatching(roomId, position, objectsByLayer) {
            const gameScenario = window.gameScenario;
            if (!gameScenario.rooms[roomId].objects) {
                return new Set();
            }
            
            const usedItems = new Set();
                console.log(`Processing ${gameScenario.rooms[roomId].objects.length} scenario objects for room ${roomId}`);
            
            // Create maps of all available items by type
            const regularItemsByType = {};
            const conditionalItemsByType = {};
            const conditionalTableItemsByType = {};
            
            // Process regular items layer
            if (objectsByLayer.items) {
                objectsByLayer.items.forEach(obj => {
                    const imageName = getImageNameFromObject(obj);
                    if (imageName && imageName !== 'unknown') {
                        const baseType = extractBaseTypeFromImageName(imageName);
                        if (!regularItemsByType[baseType]) {
                            regularItemsByType[baseType] = [];
                        }
                        regularItemsByType[baseType].push(obj);
                    }
                });
            }
            
            // Process conditional items layer
            if (objectsByLayer.conditional_items) {
                objectsByLayer.conditional_items.forEach(obj => {
                    const imageName = getImageNameFromObject(obj);
                    if (imageName && imageName !== 'unknown') {
                        const baseType = extractBaseTypeFromImageName(imageName);
                        if (!conditionalItemsByType[baseType]) {
                            conditionalItemsByType[baseType] = [];
                        }
                        conditionalItemsByType[baseType].push(obj);
                    }
                });
            }
            
            // Process conditional table items layer
            if (objectsByLayer.conditional_table_items) {
                console.log(`Processing ${objectsByLayer.conditional_table_items.length} conditional table items`);
                objectsByLayer.conditional_table_items.forEach((obj, index) => {
                    const imageName = getImageNameFromObject(obj);
                    console.log(`Conditional table item ${index}: GID ${obj.gid} -> imageName: ${imageName}`);
                    if (imageName && imageName !== 'unknown') {
                        const baseType = extractBaseTypeFromImageName(imageName);
                        console.log(`Conditional table item ${imageName} -> baseType: ${baseType}`);
                        if (!conditionalTableItemsByType[baseType]) {
                            conditionalTableItemsByType[baseType] = [];
                        }
                        conditionalTableItemsByType[baseType].push(obj);
                        console.log(`Added ${baseType} to conditional table items (total: ${conditionalTableItemsByType[baseType].length})`);
                    } else {
                        console.log(`No valid imageName found for conditional table item ${index} with GID ${obj.gid} (imageName: ${imageName})`);
                    }
                });
            }
            
            // Process each scenario object
                gameScenario.rooms[roomId].objects.forEach((scenarioObj, index) => {
                    const objType = scenarioObj.type;
                
                // Skip items that should be in inventory
                    if (scenarioObj.inInventory) {
                        return;
                    }
                    
                let sprite = null;
                let usedItem = null;
                let isTableItem = false;
                
                console.log(`Looking for scenario object type: ${objType}`);
                console.log(`Available regular items for ${objType}: ${regularItemsByType[objType] ? regularItemsByType[objType].length : 0}`);
                console.log(`Available conditional items for ${objType}: ${conditionalItemsByType[objType] ? conditionalItemsByType[objType].length : 0}`);
                console.log(`Available conditional table items for ${objType}: ${conditionalTableItemsByType[objType] ? conditionalTableItemsByType[objType].length : 0}`);
                
                // First, try to find a matching regular item
                if (regularItemsByType[objType] && regularItemsByType[objType].length > 0) {
                    usedItem = regularItemsByType[objType].shift();
                    console.log(`Using regular item for ${objType}`);
                }
                // Then try conditional items
                else if (conditionalItemsByType[objType] && conditionalItemsByType[objType].length > 0) {
                    usedItem = conditionalItemsByType[objType].shift();
                    console.log(`Using conditional item for ${objType}`);
                }
                // Finally try conditional table items
                else if (conditionalTableItemsByType[objType] && conditionalTableItemsByType[objType].length > 0) {
                    usedItem = conditionalTableItemsByType[objType].shift();
                    isTableItem = true;
                    console.log(`Using conditional table item for ${objType}`);
                }
                
                if (usedItem) {
                    // Create sprite using the found item
                    const imageName = getImageNameFromObject(usedItem);
                        sprite = gameRef.add.sprite(
                        position.x + usedItem.x,
                        position.y + usedItem.y - usedItem.height,
                        imageName
                    );
                    
                    if (usedItem.rotation) {
                        sprite.setRotation(Phaser.Math.DegToRad(usedItem.rotation));
                    }
                    
                    console.log(`Created ${objType} using ${imageName}`);
                    
                    // Track this item as used
                    usedItems.add(imageName);
                    const baseType = extractBaseTypeFromImageName(imageName);
                    usedItems.add(baseType);
                    
                    // If it's a table item, find the closest table and group it
                        if (isTableItem && tableObjects.length > 0) {
                            const closestTable = findClosestTable(sprite, tableObjects);
                            if (closestTable) {
                                const group = tableGroups.find(g => g.table === closestTable);
                                if (group) {
                                    // Table items don't need elevation - they're grouped with the table
                                    const itemDepth = group.baseDepth + (group.items.length + 1) * 0.01;
                                    sprite.setDepth(itemDepth);
                                    
                                    // No elevation for table items
                                    sprite.elevation = 0;
                                    group.items.push({ sprite, type: 'conditional_table_item' });
                                }
                            }
                        }
                    } else {
                    // No matching item found, create at random position
                        const roomWidth = 10 * TILE_SIZE;
                        const roomHeight = 9 * TILE_SIZE;
                    const padding = TILE_SIZE * 2;
                        
                        // Find a valid position that doesn't overlap with existing items
                        let randomX, randomY;
                        let attempts = 0;
                        const maxAttempts = 50;
                        
                        do {
                            randomX = position.x + padding + Math.random() * (roomWidth - padding * 2);
                            randomY = position.y + padding + Math.random() * (roomHeight - padding * 2);
                            attempts++;
                        } while (attempts < maxAttempts && isPositionOverlapping(randomX, randomY, roomId, TILE_SIZE));
                        
                        sprite = gameRef.add.sprite(randomX, randomY, objType);
                    console.log(`Created ${objType} at random position - no matching item found (attempts: ${attempts})`);
                }
                    
                    // Set common properties
                    sprite.setOrigin(0, 0);
                sprite.name = usedItem ? getImageNameFromObject(usedItem) : objType;
                sprite.objectId = `${roomId}_${objType}_${index}`;
                    sprite.setInteractive({ useHandCursor: true });
                    
                // Set depth based on world Y position (unless already set for table items)
                if (!isTableItem || !usedItem) {
                    const objectBottomY = sprite.y + sprite.height;
                    
                    // Calculate elevation for items on the back wall (top 2 tiles of room)
                    const roomTopY = position.y;
                    const backWallThreshold = roomTopY + (2 * 32); // Back wall is top 2 tiles
                    const itemBottomY = sprite.y + sprite.height;
                    const elevation = itemBottomY < backWallThreshold ? (backWallThreshold - itemBottomY) : 0;
                    
                    const objectDepth = objectBottomY + 0.5 + elevation;
                    sprite.setDepth(objectDepth);
                    
                    // Store elevation for debugging
                    sprite.elevation = elevation;
                }
                    
                    // Store scenario data with sprite
                    sprite.scenarioData = scenarioObj;
                    sprite.interactable = true; // Mark scenario items as interactable
                console.log(`Applied scenario data to ${objType}:`, {
                    name: scenarioObj.name,
                    type: scenarioObj.type,
                    takeable: scenarioObj.takeable,
                    readable: scenarioObj.readable,
                    text: scenarioObj.text,
                    observations: scenarioObj.observations
                });
                    
                    // Initially hide the object
                    sprite.setVisible(false);
                    
                    // Store the object
                rooms[roomId].objects[sprite.objectId] = sprite;
                    
                    // Add click handler
                    sprite.on('pointerdown', (pointer, localX, localY, event) => {
                        // Check if player is in range for interaction
                        const player = window.player;
                        if (player) {
                            const dx = player.x - sprite.x;
                            const dy = player.y - sprite.y;
                            const distanceSq = dx * dx + dy * dy;
                            const INTERACTION_RANGE_SQ = 64 * 64; // 64 pixels squared
                            
                            if (distanceSq <= INTERACTION_RANGE_SQ) {
                                // Player is in range - prevent movement and trigger interaction
                                if (event && event.preventDefault) {
                                    event.preventDefault();
                                }
                                // Set flag to prevent player movement
                                window.preventPlayerMovement = true;
                        if (window.handleObjectInteraction) {
                            window.handleObjectInteraction(sprite);
                                }
                                // Reset flag after a short delay
                                setTimeout(() => {
                                    window.preventPlayerMovement = false;
                                }, 100);
                            } else {
                                // Player is out of range - allow movement to the item
                                console.log('Scenario item out of range, allowing player movement');
                                // Don't prevent movement - let the player move to the item
                            }
                        }
                    });
                });
            
            // Re-sort table groups after adding scenario items to maintain north-to-south order
            tableGroups.forEach(group => {
                // Sort items from north to south (lower Y values first)
                group.items.sort((a, b) => a.sprite.y - b.sprite.y);
                
                // Recalculate depths for all items in the group
                group.items.forEach((item, index) => {
                    // Table items don't need elevation - they're grouped with the table
                    const itemDepth = group.baseDepth + (index + 1) * 0.01;
                    item.sprite.setDepth(itemDepth);
                    
                    // No elevation for table items
                    item.sprite.elevation = 0;
                    console.log(`Re-sorted item ${item.sprite.name} to depth ${itemDepth} (north to south order, no elevation)`);
                });
            });
            
            // Log summary of item usage
            console.log(`=== Item Usage Summary ===`);
            Object.entries(regularItemsByType).forEach(([baseType, items]) => {
                console.log(`Regular items for ${baseType}: ${items.length} available`);
            });
            Object.entries(conditionalItemsByType).forEach(([baseType, items]) => {
                console.log(`Conditional items for ${baseType}: ${items.length} available`);
            });
            Object.entries(conditionalTableItemsByType).forEach(([baseType, items]) => {
                console.log(`Conditional table items for ${baseType}: ${items.length} available`);
            });
            
            return usedItems;
        }
        
        // Helper function to get image name from Tiled object
        function getImageNameFromObject(obj) {
            // Find the tileset that contains this GID
            // Handle multiple tileset instances by finding the most recent one
            let tileset = null;
            let localTileId = 0;
            let bestMatch = null;
            let bestMatchIndex = -1;
            
            for (let i = 0; i < map.tilesets.length; i++) {
                const ts = map.tilesets[i];
                const maxGid = ts.tilecount ? ts.firstgid + ts.tilecount : ts.firstgid + 1;
                if (obj.gid >= ts.firstgid && obj.gid < maxGid) {
                    // Prefer objects tilesets, and among those, prefer the most recent (highest index)
                    if (ts.name === 'objects' || ts.name.includes('objects/') || ts.name.includes('tables/')) {
                        if (bestMatchIndex < i) {
                            bestMatch = ts;
                            bestMatchIndex = i;
                            tileset = ts;
                            localTileId = obj.gid - ts.firstgid;
                        }
                    } else if (!bestMatch) {
                        // Fallback to any matching tileset if no objects tileset found
                        tileset = ts;
                        localTileId = obj.gid - ts.firstgid;
                    }
                }
            }
            
            if (tileset && (tileset.name === 'objects' || tileset.name.includes('objects/') || tileset.name.includes('tables/'))) {
                let imageName = null;
                
                if (tileset.images && tileset.images[localTileId]) {
                    const imageData = tileset.images[localTileId];
                    if (imageData && imageData.name) {
                        imageName = imageData.name;
                    }
                } else if (tileset.tileData && tileset.tileData[localTileId]) {
                    const tileData = tileset.tileData[localTileId];
                    if (tileData && tileData.image) {
                        const imagePath = tileData.image;
                        imageName = imagePath.split('/').pop().replace('.png', '');
                    }
                } else if (tileset.name.includes('objects/') || tileset.name.includes('tables/')) {
                    imageName = tileset.name.split('/').pop().replace('.png', '');
                }
                
                return imageName;
            }
            
            return null;
        }
        
        // Helper function to extract base type from image name
        function extractBaseTypeFromImageName(imageName) {
            // Check if imageName is null or undefined
            if (!imageName) {
                console.log('Warning: extractBaseTypeFromImageName called with null/undefined imageName');
                return 'unknown';
            }
            
            // Remove numbers and common suffixes to get base type
            // e.g., "pc2.png" -> "pc", "laptop3.png" -> "laptop", "phone4" -> "phone"
            let baseType = imageName.replace(/\d+$/, ''); // Remove trailing numbers
            baseType = baseType.replace(/\.png$/, ''); // Remove .png extension
            
            // Handle special cases where scenario uses plural but items use singular
            if (baseType === 'note') {
                // Convert note1 -> notes1, note2 -> notes2, etc.
                const number = imageName.match(/\d+/);
                if (number) {
                    baseType = 'notes' + number[0];
                } else {
                    baseType = 'notes'; // Fallback for note without number
                }
            }
            
            console.log(`Extracting base type: ${imageName} -> ${baseType}`);
            return baseType;
        }
        
        // Helper function to process individual objects
        function processObject(obj, position, roomId, type) {
            // Find the tileset that contains this GID
            // Handle multiple tileset instances by finding the most recent one
            let tileset = null;
            let localTileId = 0;
            let bestMatch = null;
            let bestMatchIndex = -1;
            
            for (let i = 0; i < map.tilesets.length; i++) {
                const ts = map.tilesets[i];
                // Handle tilesets with undefined tilecount (individual object tilesets)
                const maxGid = ts.tilecount ? ts.firstgid + ts.tilecount : ts.firstgid + 1;
                if (obj.gid >= ts.firstgid && obj.gid < maxGid) {
                    // Prefer objects tilesets, and among those, prefer the most recent (highest index)
                    if (ts.name === 'objects' || ts.name.includes('objects/') || ts.name.includes('tables/')) {
                        if (bestMatchIndex < i) {
                            bestMatch = ts;
                            bestMatchIndex = i;
                            tileset = ts;
                            localTileId = obj.gid - ts.firstgid;
                        }
                    } else if (!bestMatch) {
                        // Fallback to any matching tileset if no objects tileset found
                        tileset = ts;
                        localTileId = obj.gid - ts.firstgid;
                    }
                }
            }
            
            if (tileset && (tileset.name === 'objects' || tileset.name.includes('objects/') || tileset.name.includes('tables/'))) {
                // This is an ImageCollection or individual object tileset, get the image data
                let imageName = null;
                
                // Check if this is an ImageCollection with images array
                if (tileset.images && tileset.images[localTileId]) {
                    // Get image from the images array
                    const imageData = tileset.images[localTileId];
                    if (imageData && imageData.name) {
                        imageName = imageData.name;
                    }
                } else if (tileset.tileData && tileset.tileData[localTileId]) {
                    // Fallback: get from tileData
                    const tileData = tileset.tileData[localTileId];
                    if (tileData && tileData.image) {
                        const imagePath = tileData.image;
                        imageName = imagePath.split('/').pop().replace('.png', '');
                    }
                } else if (tileset.name.includes('objects/') || tileset.name.includes('tables/')) {
                    // This is an individual object or table tileset, extract name from tileset name
                    imageName = tileset.name.split('/').pop().replace('.png', '');
                }
                
                if (imageName) {
                    console.log(`Creating object from ImageCollection: ${imageName} at (${obj.x}, ${obj.y})`);
                    
                    // Create sprite at the object's position
                    const sprite = gameRef.add.sprite(
                        position.x + obj.x,
                        position.y + obj.y - obj.height, // Adjust for Tiled's coordinate system
                        imageName
                    );
                    
                    // Set sprite properties
                    sprite.setOrigin(0, 0);
                    sprite.name = imageName;
                    sprite.objectId = `${roomId}_${imageName}_${obj.id}`;
                    sprite.setInteractive({ useHandCursor: true });
                    
                    // Check if this is a chair with wheels
                    if (imageName.startsWith('chair-') && !imageName.startsWith('chair-waiting')) {
                        sprite.hasWheels = true;
                        
                        // Check if this is a swivel chair
                        if (imageName.startsWith('chair-exec-rotate') || 
                            imageName.startsWith('chair-white-1-rotate') || 
                            imageName.startsWith('chair-white-2-rotate')) {
                            sprite.isSwivelChair = true;
                            
                            // Determine starting frame based on image name
                            let frameNumber;
                            if (imageName.startsWith('chair-exec-rotate')) {
                                frameNumber = parseInt(imageName.replace('chair-exec-rotate', ''));
                            } else if (imageName.startsWith('chair-white-1-rotate')) {
                                frameNumber = parseInt(imageName.replace('chair-white-1-rotate', ''));
                            } else if (imageName.startsWith('chair-white-2-rotate')) {
                                frameNumber = parseInt(imageName.replace('chair-white-2-rotate', ''));
                            }
                            
                            sprite.currentFrame = frameNumber - 1; // Convert to 0-based index
                            sprite.rotationSpeed = 0;
                            sprite.maxRotationSpeed = 0.15; // Slower maximum rotation speed
                            sprite.originalTexture = imageName; // Store original texture name
                            sprite.spinDirection = 0; // -1 for counter-clockwise, 1 for clockwise, 0 for no spin
                            
                        }
                        
                        // Calculate elevation for chairs (same as other objects)
                        const roomTopY = position.y;
                        const backWallThreshold = roomTopY + (2 * 32); // Back wall is top 2 tiles
                        const itemBottomY = sprite.y + sprite.height;
                        const elevation = itemBottomY < backWallThreshold ? (backWallThreshold - itemBottomY) : 0;
                        sprite.elevation = elevation;
                        
                    }
                    
                    // Check if this is a plant that can sway
                    if (imageName.startsWith('plant-large')) {
                        sprite.canSway = true;
                        sprite.originalScaleX = sprite.scaleX;
                        sprite.originalScaleY = sprite.scaleY;
                        sprite.originalX = sprite.x;
                        sprite.originalY = sprite.y;
                        sprite.originalWidth = sprite.width;
                        sprite.originalHeight = sprite.height;
                        sprite.originalSkewX = 0;
                        sprite.originalSkewY = 0;
                        
                        // Add displacement FX for realistic sway effect
                        // Use a custom displacement texture for wind-like movement
                        sprite.preFX.addDisplacement('wind_displacement', 0.01, 0.01);
                        // Store reference to the displacement FX (it's the last added effect)
                        sprite.displacementFX = sprite.preFX.list[sprite.preFX.list.length - 1];
                        
                        console.log(`Plant ${imageName} can sway with displacement FX`);
                    }
                    
                    // Set depth based on world Y position with elevation
                    const objectBottomY = sprite.y + sprite.height;
                    
                    // Calculate elevation for items on the back wall (top 2 tiles of room)
                    const roomTopY = position.y;
                    const backWallThreshold = roomTopY + (2 * 32); // Back wall is top 2 tiles
                    const itemBottomY = sprite.y + sprite.height;
                    const elevation = itemBottomY < backWallThreshold ? (backWallThreshold - itemBottomY) : 0;
                    
                    const objectDepth = objectBottomY + 0.5 + elevation;
                    sprite.setDepth(objectDepth);
                    
                    // Store elevation for debugging
                    sprite.elevation = elevation;
                    
                    // Apply rotation if specified
                    if (obj.rotation) {
                        sprite.setRotation(Phaser.Math.DegToRad(obj.rotation));
                    }
                    
                    // Initially hide the object
                    sprite.setVisible(false);
                    
                    // Set up collision for tables
                    if (type === 'table') {
                        // Add physics body to table (static body)
                        gameRef.physics.add.existing(sprite, true);
                        
                        // Wait for the next frame to ensure body is fully initialized
                        gameRef.time.delayedCall(0, () => {
                            if (sprite.body) {
                                // Use direct property assignment (fallback method)
                                sprite.body.immovable = true;
                                
                                // Set custom collision box - bottom quarter of height, inset 10px from sides
                                const tableWidth = sprite.width;
                                const tableHeight = sprite.height;
                                const collisionWidth = tableWidth - 20; // 10px inset on each side
                                const collisionHeight = tableHeight / 4; // Bottom quarter
                                const offsetX = 10; // 10px inset from left
                                const offsetY = tableHeight - collisionHeight; // Bottom quarter
                                
                                sprite.body.setSize(collisionWidth, collisionHeight);
                                sprite.body.setOffset(offsetX, offsetY);
                                
                                console.log(`Set table ${imageName} collision box: ${collisionWidth}x${collisionHeight} at offset (${offsetX}, ${offsetY})`);
                                
                                // Add collision with player
                                const player = window.player;
                                if (player && player.body) {
                                    gameRef.physics.add.collider(player, sprite);
                                    console.log(`Added collision between player and table: ${imageName}`);
                                }
                            }
                        });
                    }
                    
                    // Set up physics for chairs with wheels
                    if (sprite.hasWheels) {
                        // Add physics body to chair (dynamic body for movement)
                        gameRef.physics.add.existing(sprite, false);
                        
                        // Wait for the next frame to ensure body is fully initialized
                        gameRef.time.delayedCall(0, () => {
                            if (sprite.body) {
                                // Set chair as movable
                                sprite.body.immovable = false;
                                sprite.body.setImmovable(false);
                                
                                // Set collision box at base of chair
                                const chairWidth = sprite.width;
                                const chairHeight = sprite.height;
                                const collisionWidth = chairWidth - 10; // 5px inset on each side
                                const collisionHeight = chairHeight / 3; // Bottom third
                                const offsetX = 5; // 5px inset from left
                                const offsetY = chairHeight - collisionHeight; // Bottom third
                                
                                sprite.body.setSize(collisionWidth, collisionHeight);
                                sprite.body.setOffset(offsetX, offsetY);
                                
                                // Set physics properties for bouncing
                                sprite.body.setBounce(0.3, 0.3);
                                sprite.body.setDrag(100, 100);
                                sprite.body.setMaxVelocity(200, 200);
                                
                                
                                // Add collision with player
                                const player = window.player;
                                if (player && player.body) {
                                    // Create collision callback function
                                    const collisionCallback = (player, chair) => {
                                        if (chair.isSwivelChair) {
                                            calculateChairSpinDirection(player, chair);
                                        }
                                    };
                                    
                                    gameRef.physics.add.collider(player, sprite, collisionCallback);
                                }
                                
                                // Store chair reference for collision detection
                                if (!window.chairs) {
                                    window.chairs = [];
                                }
                                window.chairs.push(sprite);
                                
                                // Set up collision with other chairs and items
                                setupChairCollisions(sprite);
                            }
                        });
                    }
                    
                    // Store the object in the room
                    if (!rooms[roomId].objects) {
                        rooms[roomId].objects = {};
                    }
                    rooms[roomId].objects[sprite.objectId] = sprite;
                    
                    // Give default properties to regular items (non-scenario items)
                    if (type === 'item' || type === 'table_item') {
                        // Strip out suffix after first dash and any numbers for cleaner names
                        const cleanName = imageName.replace(/-.*$/, '').replace(/\d+$/, '');
                        sprite.scenarioData = {
                            name: cleanName,
                            type: cleanName,
                            takeable: false,
                            readable: false,
                            observations: `A ${cleanName} in the room`
                        };
                        console.log(`Applied default properties to ${type} ${imageName} -> ${cleanName}`);
                    }
                    
                    // Add click handler
                    sprite.on('pointerdown', (pointer, localX, localY, event) => {
                        console.log('Tiled object clicked:', { name: imageName, id: sprite.objectId, interactable: sprite.interactable });
                        // Only trigger interaction for interactable items
                        if (sprite.interactable && window.handleObjectInteraction) {
                            // Check if player is in range for interaction
                            const player = window.player;
                            if (player) {
                                const dx = player.x - sprite.x;
                                const dy = player.y - sprite.y;
                                const distanceSq = dx * dx + dy * dy;
                                const INTERACTION_RANGE_SQ = 64 * 64; // 64 pixels squared
                                
                                if (distanceSq <= INTERACTION_RANGE_SQ) {
                                    // Player is in range - prevent movement and trigger interaction
                                    if (event && event.preventDefault) {
                                        event.preventDefault();
                                    }
                                    // Set flag to prevent player movement
                                    window.preventPlayerMovement = true;
                                    window.handleObjectInteraction(sprite);
                                    // Reset flag after a short delay
                                    setTimeout(() => {
                                        window.preventPlayerMovement = false;
                                    }, 100);
                                } else {
                                    // Player is out of range - allow movement to the item
                                    console.log('Regular item out of range, allowing player movement');
                                    // Don't prevent movement - let the player move to the item
                                }
                            }
                        }
                    });
                    
                    console.log(`Created Tiled object: ${sprite.objectId} at (${sprite.x}, ${sprite.y})`);
                    
                    return { sprite, type };
                } else {
                    console.log(`No image data found for GID ${obj.gid} in objects tileset`);
                }
            } else if (tileset && tileset.name !== 'objects' && !tileset.name.includes('objects/')) {
                // Handle other tilesets (like tables) normally
                console.log(`Skipping non-objects tileset: ${tileset.name}`);
            } else {
                console.log(`No tileset found for GID ${obj.gid}`);
            }
            
            return null;
        }
        
        // Helper function to find the closest table to an item
        function findClosestTable(itemSprite, tableObjects) {
            let closestTable = null;
            let closestDistance = Infinity;
            
            tableObjects.forEach(table => {
                // Calculate distance between item and table centers
                const itemCenterX = itemSprite.x + itemSprite.width / 2;
                const itemCenterY = itemSprite.y + itemSprite.height / 2;
                const tableCenterX = table.sprite.x + table.sprite.width / 2;
                const tableCenterY = table.sprite.y + table.sprite.height / 2;
                
                const distance = Math.sqrt(
                    Math.pow(itemCenterX - tableCenterX, 2) + 
                    Math.pow(itemCenterY - tableCenterY, 2)
                );
                
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestTable = table;
                }
            });
            
            console.log(`Found closest table for item ${itemSprite.name} at distance ${closestDistance}`);
            return closestTable;
        }

        // Handle objects layer (legacy)
        const objectsLayer = map.getObjectLayer('Object Layer 1');
        console.log(`Object layer found for room ${roomId}:`, objectsLayer ? `${objectsLayer.objects.length} objects` : 'No objects layer');
        if (objectsLayer) {
            
            // Handle collision objects
            objectsLayer.objects.forEach(obj => {
                if (obj.name.toLowerCase().includes('collision') || obj.type === 'collision') {
                    console.log(`Creating collision object: ${obj.name} at (${obj.x}, ${obj.y})`);
                    
                    // Create invisible collision body
                    const collisionBody = gameRef.add.rectangle(
                        position.x + obj.x + obj.width/2,
                        position.y + obj.y + obj.height/2,
                        obj.width,
                        obj.height
                    );
                    
                    // Make it invisible but with collision
                    collisionBody.setVisible(false);
                    collisionBody.setAlpha(0);
                    gameRef.physics.add.existing(collisionBody, true);
                    
                    // Add collision with player
                    const player = window.player;
                    if (player && player.body) {
                        gameRef.physics.add.collider(player, collisionBody);
                        console.log(`Added collision object: ${obj.name}`);
                    }
                    
                    // Store collision body in room for cleanup
                    if (!room.collisionBodies) {
                        room.collisionBodies = [];
                    }
                    room.collisionBodies.push(collisionBody);
                }
            });
            
            // Create a map of room objects by type for easy lookup
            const roomObjectsByType = {};
            objectsLayer.objects.forEach(obj => {
                if (!roomObjectsByType[obj.name]) {
                    roomObjectsByType[obj.name] = [];
                }
                roomObjectsByType[obj.name].push(obj);
            });
            
            // Legacy scenario object processing removed - now handled by conditional matching system
        }
        
        // Set up pending wall collision boxes if player is ready
        const room = rooms[roomId];
        if (room && room.pendingWallCollisionBoxes && window.player && window.player.body) {
            room.pendingWallCollisionBoxes.forEach(collisionBox => {
                gameRef.physics.add.collider(window.player, collisionBox);
            });
            console.log(`Set up ${room.pendingWallCollisionBoxes.length} pending wall collision boxes for room ${roomId}`);
            // Clear pending collision boxes
            room.pendingWallCollisionBoxes = [];
        }
        
        // Set up collisions between existing chairs and new room objects
        setupExistingChairsWithNewRoom(roomId);
    } catch (error) {
        console.error(`Error creating room ${roomId}:`, error);
        console.error('Error details:', error.stack);
    }
}

export function revealRoom(roomId) {
    if (rooms[roomId]) {
        const room = rooms[roomId];
        
        // Reveal all layers
        Object.values(room.layers).forEach(layer => {
            if (layer && layer.setVisible) {
                layer.setVisible(true);
                layer.setAlpha(1);
            }
        });
        
        // Show door sprites for this room
        if (room.doorSprites) {
            room.doorSprites.forEach(doorSprite => {
                doorSprite.setVisible(true);
                doorSprite.setAlpha(1);
                console.log(`Made door sprite visible for room ${roomId}`);
            });
        }
        
        // Show all objects
        if (room.objects) {
            console.log(`Revealing ${Object.keys(room.objects).length} objects in room ${roomId}`);
            Object.values(room.objects).forEach(obj => {
                if (obj && obj.setVisible && obj.active) { // Only show active objects
                    obj.setVisible(true);
                    obj.alpha = obj.active ? (obj.originalAlpha || 1) : 0.3;
                    console.log(`Made object visible: ${obj.objectId} at (${obj.x}, ${obj.y})`);
                }
            });
        } else {
            console.log(`No objects found in room ${roomId}`);
        }
        
        discoveredRooms.add(roomId);
        // Update global reference
        window.discoveredRooms = discoveredRooms;
    }
    currentRoom = roomId;
}

// Function to check if player has crossed a door threshold
function checkDoorTransitions(player) {
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
            if (connectedRoom === currentPlayerRoom) {
                return;
            }
            
            // Skip if this is the same transition we just made
            if (lastDoorTransition === `${currentPlayerRoom}->${connectedRoom}`) {
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
                        console.log(`Player crossed ${direction} door threshold in ${roomId} -> ${connectedRoom} (current: ${currentPlayerRoom}, distance: ${distanceToThreshold.toFixed(2)})`);
                    }
                }
            }
        });
    });
    
    // If a transition was detected, set the cooldown and track the transition
    if (closestTransition) {
        lastDoorTransitionTime = currentTime;
        lastDoorTransition = `${currentPlayerRoom}->${closestTransition}`;
    }
    
    return closestTransition;
}

export function updatePlayerRoom() {
    // Check which room the player is currently in
    const player = window.player;
    if (!player) {
        return; // Player not created yet
    }
    
    // Check for door transitions first
    const doorTransitionRoom = checkDoorTransitions(player);
    if (doorTransitionRoom && doorTransitionRoom !== currentPlayerRoom) {
        // Door transition detected to a different room
        console.log(`Door transition detected: ${currentPlayerRoom} -> ${doorTransitionRoom}`);
        currentPlayerRoom = doorTransitionRoom;
        window.currentPlayerRoom = doorTransitionRoom;
        
        // Reveal the room if not already discovered
        if (!discoveredRooms.has(doorTransitionRoom)) {
            revealRoom(doorTransitionRoom);
        }
        
        // Player depth is now handled by the simplified updatePlayerDepth function in player.js
        return; // Exit early to prevent overlap-based detection from overriding
    }
    
    // Only do overlap-based room detection if no door transition occurred
    // and if we don't have a current room (fallback)
    if (currentPlayerRoom) {
        return; // Keep current room if no door transition and we already have one
    }
    
    // Fallback to overlap-based room detection
    let overlappingRooms = [];
    
    // Check all rooms for overlap with proper threshold
    Object.entries(rooms).forEach(([roomId, room]) => {
        const roomBounds = {
            x: room.position.x,
            y: room.position.y,
            width: room.map.widthInPixels,
            height: room.map.heightInPixels
        };
        
        if (isPlayerInBounds(player, roomBounds)) {
            overlappingRooms.push({
                roomId: roomId,
                position: room.position.y // Use Y position for northernmost sorting
            });
            
            // Reveal room if not already discovered
            if (!discoveredRooms.has(roomId)) {
                console.log(`Player overlapping room: ${roomId}`);
                revealRoom(roomId);
            }
        }
    });
    
    // If we're not overlapping any rooms
    if (overlappingRooms.length === 0) {
        currentPlayerRoom = null;
        window.currentPlayerRoom = null;
        return null;
    }
    
    // Sort overlapping rooms by Y position (northernmost first - lower Y values)
    overlappingRooms.sort((a, b) => a.position - b.position);
    
    // Use the northernmost room (lowest Y position) as the main room
    const northernmostRoom = overlappingRooms[0].roomId;
    
    // Update current room (use the northernmost overlapping room as the "main" room)
    if (currentPlayerRoom !== northernmostRoom) {
        console.log(`Player's main room changed to: ${northernmostRoom} (northernmost of ${overlappingRooms.length} overlapping rooms)`);
        currentPlayerRoom = northernmostRoom;
        window.currentPlayerRoom = northernmostRoom;
        
        // Player depth is now handled by the simplified updatePlayerDepth function in player.js
    }
}



// Helper function to check if player properly overlaps with room bounds
function isPlayerInBounds(player, bounds) {
    // Use the player's physics body bounds for more precise detection
    const playerBody = player.body;
    const playerBounds = {
        left: playerBody.x,
        right: playerBody.x + playerBody.width,
        top: playerBody.y,
        bottom: playerBody.y + playerBody.height
    };
    
    // Calculate the overlap area between player and room
    const overlapWidth = Math.min(playerBounds.right, bounds.x + bounds.width) - 
                         Math.max(playerBounds.left, bounds.x);
    const overlapHeight = Math.min(playerBounds.bottom, bounds.y + bounds.height) - 
                          Math.max(playerBounds.top, bounds.y);
    
    // Require a minimum overlap percentage (50% of player width/height)
    const minOverlapPercent = 0.5;
    const playerWidth = playerBounds.right - playerBounds.left;
    const playerHeight = playerBounds.bottom - playerBounds.top;
    
    const widthOverlapPercent = overlapWidth / playerWidth;
    const heightOverlapPercent = overlapHeight / playerHeight;
    
    return overlapWidth > 0 && 
           overlapHeight > 0 && 
           widthOverlapPercent >= minOverlapPercent && 
           heightOverlapPercent >= minOverlapPercent;
}



// Update door sprites visibility based on which rooms are revealed
function updateDoorSpritesVisibility() {
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

// Door collisions are now handled by sprite-based system
export function setupDoorCollisions() {
    console.log('Door collisions are now handled by sprite-based system');
}

// Global function to check if a door can be unlocked
window.checkDoorUnlock = function(doorProps) {
    console.log(`Checking door unlock: ${doorProps.lockType}, requires: ${doorProps.requires}`);
    
    // TODO: Implement proper unlock checking based on lockType
    // For now, just return true to allow all doors to be unlocked
    return true;
};

// Player bump effect variables
let playerBumpTween = null;
let isPlayerBumping = false;
let lastPlayerPosition = { x: 0, y: 0 };
let steppedOverItems = new Set(); // Track items we've already stepped over
let playerVisualOverlay = null; // Visual overlay for hop effect
let lastHopTime = 0; // Track when last hop occurred
const HOP_COOLDOWN = 300; // 300ms cooldown between hops

// Function to create player bump effect when walking over items
function createPlayerBumpEffect() {
    if (!window.player || isPlayerBumping) return;
    
    // Check cooldown to prevent double hopping
    const currentTime = Date.now();
    if (currentTime - lastHopTime < HOP_COOLDOWN) {
        return; // Still in cooldown, skip this frame
    }
    
    const player = window.player;
    const currentX = player.x;
    const currentY = player.y;
    
    // Check if player has moved significantly (to detect stepping over items)
    const hasMoved = Math.abs(currentX - lastPlayerPosition.x) > 5 || 
                     Math.abs(currentY - lastPlayerPosition.y) > 5;
    
    if (!hasMoved) return;
    
    // Update last position
    lastPlayerPosition = { x: currentX, y: currentY };
    
    // Check all rooms for floor items
    Object.entries(rooms).forEach(([roomId, room]) => {
        if (!room.objects) return;
        
        Object.values(room.objects).forEach(obj => {
            if (!obj.visible || !obj.scenarioData) return;
            
            // Create unique identifier for this item
            const itemId = `${roomId}_${obj.objectId || obj.name}_${obj.x}_${obj.y}`;
            
            // Skip if we've already stepped over this item recently
            if (steppedOverItems.has(itemId)) return;
            
            // Check if this is a floor item (not furniture)
            const isFloorItem = obj.scenarioData.type && 
                !obj.scenarioData.type.includes('table') && 
                !obj.scenarioData.type.includes('chair') &&
                !obj.scenarioData.type.includes('desk') &&
                !obj.scenarioData.type.includes('safe') &&
                !obj.scenarioData.type.includes('workstation');
            
            if (!isFloorItem) return;
            
            // Check if player collision box intersects with bottom portion of item
            const playerCollisionLeft = currentX - (player.body.width / 2);
            const playerCollisionRight = currentX + (player.body.width / 2);
            const playerCollisionTop = currentY - (player.body.height / 2);
            const playerCollisionBottom = currentY + (player.body.height / 2);
            
            // Focus on bottom 1/3 of the item sprite
            const itemBottomStart = obj.y + (obj.height * 2/3); // Start of bottom third
            const itemBottomEnd = obj.y + obj.height; // Bottom of item
            
            const itemLeft = obj.x;
            const itemRight = obj.x + obj.width;
            
            // Check if player collision box intersects with bottom third of item
            if (playerCollisionRight >= itemLeft && 
                playerCollisionLeft <= itemRight &&
                playerCollisionBottom >= itemBottomStart && 
                playerCollisionTop <= itemBottomEnd) {
                
                // Player stepped over a floor item - create one-time hop effect
                steppedOverItems.add(itemId);
                lastHopTime = currentTime; // Update hop time
                
                // Remove from set after 2 seconds to allow re-triggering
                setTimeout(() => {
                    steppedOverItems.delete(itemId);
                }, 2000);
                
                // Create one-time hop effect
                if (playerBumpTween) {
                    playerBumpTween.destroy();
                }
                
                isPlayerBumping = true;
                
                // Create hop effect using visual overlay
                if (playerBumpTween) {
                    playerBumpTween.destroy();
                }
                
                // Create a visual overlay sprite that follows the player
                if (playerVisualOverlay) {
                    playerVisualOverlay.destroy();
                }
                
                playerVisualOverlay = gameRef.add.sprite(player.x, player.y, player.texture.key);
                playerVisualOverlay.setFrame(player.frame.name);
                playerVisualOverlay.setScale(player.scaleX, player.scaleY);
                playerVisualOverlay.setFlipX(player.flipX); // Copy horizontal flip state
                playerVisualOverlay.setFlipY(player.flipY); // Copy vertical flip state
                playerVisualOverlay.setDepth(player.depth + 1);
                playerVisualOverlay.setAlpha(0.8);
                
                // Hide the original player temporarily
                player.setAlpha(0);
                
                // Always hop upward - negative Y values move sprite up on screen
                const hopHeight = -15; // Consistent upward hop
                
                // Debug: Log the hop details
                console.log(`Hop triggered - Player Y: ${player.y}, Overlay Y: ${playerVisualOverlay.y}, Hop Height: ${hopHeight}, Target Y: ${playerVisualOverlay.y + hopHeight}`);
                console.log(`Player movement - DeltaX: ${currentX - lastPlayerPosition.x}, DeltaY: ${currentY - lastPlayerPosition.y}`);
                
                // Start the hop animation with a simple up-down motion
                playerBumpTween = gameRef.tweens.add({
                    targets: { hopOffset: 0 },
                    hopOffset: hopHeight,
                    duration: 120,
                    ease: 'Power2',
                    yoyo: true,
                    onUpdate: (tween) => {
                        if (playerVisualOverlay && playerVisualOverlay.active) {
                            // Apply the hop offset to the current player position
                            playerVisualOverlay.setY(player.y + tween.getValue());
                        }
                    },
                    onComplete: () => {
                        // Clean up overlay and restore player
                        if (playerVisualOverlay) {
                            playerVisualOverlay.destroy();
                            playerVisualOverlay = null;
                        }
                        player.setAlpha(1); // Restore player visibility
                        isPlayerBumping = false;
                        playerBumpTween = null;
                    }
                });
                
                // Make overlay follow player movement during hop
                const followPlayer = () => {
                    if (playerVisualOverlay && playerVisualOverlay.active) {
                        // Update X position and flip states, Y is handled by the tween
                        playerVisualOverlay.setX(player.x);
                        playerVisualOverlay.setFlipX(player.flipX); // Update flip state
                        playerVisualOverlay.setFlipY(player.flipY); // Update flip state
                    }
                };
                
                // Update overlay position every frame during hop
                const followInterval = setInterval(() => {
                    if (!playerVisualOverlay || !playerVisualOverlay.active) {
                        clearInterval(followInterval);
                        return;
                    }
                    followPlayer();
                }, 16); // ~60fps
                
                // Clean up interval when hop completes
                setTimeout(() => {
                    clearInterval(followInterval);
                }, 240); // Slightly longer than animation duration
            }
        });
    });
}

// Create plant sway effect when player walks through
function createPlantSwayEffect() {
    if (!window.player) return;
    
    const player = window.player;
    const currentX = player.x;
    const currentY = player.y;
    
    // Check if player is moving (has velocity)
    const isMoving = Math.abs(player.body.velocity.x) > 10 || Math.abs(player.body.velocity.y) > 10;
    if (!isMoving) return;
    
    // Check all rooms for plants
    Object.entries(rooms).forEach(([roomId, room]) => {
        if (!room.objects) return;
        
        Object.values(room.objects).forEach(obj => {
            if (!obj.visible || !obj.canSway) return;
            
            // Check if player is near the plant (within 40 pixels)
            const distance = Phaser.Math.Distance.Between(currentX, currentY, obj.x + obj.width/2, obj.y + obj.height/2);
            
            if (distance < 40 && !obj.isSwaying) {
                obj.isSwaying = true;
                
                // Create sway effect using displacement FX
                // This creates a realistic distortion effect while keeping the base stationary
                const swayIntensity = 0.05; // Increased intensity for more dramatic motion
                const swayDuration = Phaser.Math.Between(400, 600); // Half the time - much faster animation
                
                // Calculate sway direction based on player position relative to plant
                const playerDirection = currentX > obj.x + obj.width/2 ? 1 : -1;
                const displacementX = playerDirection * swayIntensity;
                const displacementY = (Math.random() - 0.5) * swayIntensity * 0.8; // More vertical movement
                
                // Create a complex sway animation using displacement
                const swayTween = gameRef.tweens.add({
                    targets: obj.displacementFX,
                    x: displacementX,
                    y: displacementY,
                    duration: swayDuration / 3,
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    onComplete: () => {
                        // Second sway phase with opposite direction
                        gameRef.tweens.add({
                            targets: obj.displacementFX,
                            x: -displacementX * 0.8, // More dramatic opposite movement
                            y: -displacementY * 0.8,
                            duration: swayDuration / 3,
                            ease: 'Sine.easeInOut',
                            yoyo: true,
                            onComplete: () => {
                                // Final settle phase - return to original state
                                gameRef.tweens.add({
                                    targets: obj.displacementFX,
                                    x: 0.01, // Slightly higher default displacement
                                    y: 0.01, // Slightly higher default displacement
                                    duration: swayDuration / 3,
                                    ease: 'Sine.easeOut',
                                    onComplete: () => {
                                        obj.isSwaying = false;
                                    }
                                });
                            }
                        });
                    }
                });
                
                console.log(`Plant ${obj.name} swaying with intensity ${swayIntensity}, direction ${playerDirection}`);
            }
        });
    });
}

// Calculate chair spin direction based on contact point
function calculateChairSpinDirection(player, chair) {
    if (!chair.isSwivelChair) return;
    
    // Get relative position of player to chair SPRITE center (not collision box)
    const chairSpriteCenterX = chair.x + chair.width / 2;
    const chairSpriteCenterY = chair.y + chair.height / 2;
    const playerX = player.x + player.width / 2;
    const playerY = player.y + player.height / 2;
    
    // Calculate offset from chair sprite center
    const offsetX = playerX - chairSpriteCenterX;
    const offsetY = playerY - chairSpriteCenterY;
    
    // Calculate distance from center using sprite dimensions (not collision box)
    const distanceFromCenter = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
    // Use the larger sprite dimension for maxDistance to make center area larger
    const maxDistance = Math.max(chair.width, chair.height) / 2;
    const centerRatio = distanceFromCenter / maxDistance;
    
    
    // Determine spin based on distance from center (EXTREMELY large center area)
    if (centerRatio > 1.2) { // 120% from center - edge hit (strong spin) - ONLY VERY EDGES
        // Determine spin direction based on which side of chair player is on
        if (Math.abs(offsetX) > Math.abs(offsetY)) {
            // Horizontal contact - spin based on X offset
            chair.spinDirection = offsetX > 0 ? 1 : -1; // Right side = clockwise, left side = counter-clockwise
        } else {
            // Vertical contact - spin based on Y offset and player movement
            const playerVelocityX = player.body.velocity.x;
            if (Math.abs(playerVelocityX) > 10) {
                // Player is moving horizontally - use that for spin direction
                chair.spinDirection = playerVelocityX > 0 ? 1 : -1;
            } else {
                // Use Y offset for spin direction
                chair.spinDirection = offsetY > 0 ? 1 : -1;
            }
        }
        
        // Strong spin for edge hits
        const spinIntensity = Math.min(centerRatio, 1.0);
        chair.maxRotationSpeed = 0.15 * spinIntensity;
        chair.rotationSpeed = Math.max(chair.rotationSpeed, 0.05); // Strong rotation start
        
        
    } else if (centerRatio > 0.8) { // 80-120% from center - moderate hit
        // Moderate spin
        if (Math.abs(offsetX) > Math.abs(offsetY)) {
            chair.spinDirection = offsetX > 0 ? 1 : -1;
        } else {
            const playerVelocityX = player.body.velocity.x;
            chair.spinDirection = Math.abs(playerVelocityX) > 10 ? (playerVelocityX > 0 ? 1 : -1) : (offsetY > 0 ? 1 : -1);
        }
        
        const spinIntensity = centerRatio * 0.3; // Reduced intensity
        chair.maxRotationSpeed = 0.06 * spinIntensity;
        chair.rotationSpeed = Math.max(chair.rotationSpeed, 0.015); // Moderate rotation start
        
        
    } else { // 0-80% from center - center hit (minimal spin) - MASSIVE CENTER AREA
        // Very minimal or no spin for center hits
        chair.spinDirection = 0;
        chair.maxRotationSpeed = 0.01; // Very slow spin
        chair.rotationSpeed = Math.max(chair.rotationSpeed, 0.002); // Minimal rotation start
        
    }
}

// Reusable function to update sprite depth based on Y position and elevation
function updateSpriteDepth(sprite, elevation = 0) {
    if (!sprite || !sprite.active) return;
    
    // Get the bottom of the sprite (feet position)
    const spriteBottomY = sprite.y + (sprite.height * sprite.scaleY);
    
    // Calculate depth: world Y position + layer offset + elevation
    const spriteDepth = spriteBottomY + 0.5 + elevation;
    
    // Set the sprite depth
    sprite.setDepth(spriteDepth);
}

// Update swivel chair rotation based on movement
function updateSwivelChairRotation() {
    if (!window.chairs) return;
    
    window.chairs.forEach(chair => {
        if (!chair.hasWheels || !chair.body) return;
        
        // Update chair depth based on current position (for all chairs with wheels)
        updateSpriteDepth(chair, chair.elevation || 0);
        
        // Only process rotation for swivel chairs
        if (!chair.isSwivelChair) return;
        
        // Calculate movement speed
        const velocity = Math.sqrt(
            chair.body.velocity.x * chair.body.velocity.x + 
            chair.body.velocity.y * chair.body.velocity.y
        );
        
        // Update rotation speed based on movement
        if (velocity > 10) {
            // Chair is moving - increase rotation speed (slower acceleration)
            chair.rotationSpeed = Math.min(chair.rotationSpeed + 0.01, chair.maxRotationSpeed);
            
            // If no spin direction set, set a default one for testing
            if (chair.spinDirection === 0) {
                chair.spinDirection = 1; // Default to clockwise
            }
        } else {
            // Chair is slowing down - decrease rotation speed (slower deceleration)
            chair.rotationSpeed = Math.max(chair.rotationSpeed - 0.005, 0);
            
            // Reset spin direction when chair stops moving
            if (chair.rotationSpeed < 0.01) {
                chair.spinDirection = 0;
            }
        }
        
        // Update frame based on rotation speed and direction
        if (chair.rotationSpeed > 0.01) {
            // Apply spin direction to rotation
            const rotationDelta = chair.rotationSpeed * chair.spinDirection;
            chair.currentFrame += rotationDelta;
            
            // Handle frame wrapping (8 frames total: 0-7)
            if (chair.currentFrame >= 8) {
                chair.currentFrame = 0; // Loop back to first frame
            } else if (chair.currentFrame < 0) {
                chair.currentFrame = 7; // Loop back to last frame (for counter-clockwise)
            }
            
            // Set the texture based on current frame and chair type
            const frameIndex = Math.floor(chair.currentFrame) + 1; // Convert to 1-based index
            let newTexture;
            
            // Determine texture prefix based on original texture
            if (chair.originalTexture && chair.originalTexture.startsWith('chair-exec-rotate')) {
                newTexture = `chair-exec-rotate${frameIndex}`;
            } else if (chair.originalTexture && chair.originalTexture.startsWith('chair-white-1-rotate')) {
                newTexture = `chair-white-1-rotate${frameIndex}`;
            } else if (chair.originalTexture && chair.originalTexture.startsWith('chair-white-2-rotate')) {
                newTexture = `chair-white-2-rotate${frameIndex}`;
            } else {
                // Fallback to exec chair if original texture is unknown
                newTexture = `chair-exec-rotate${frameIndex}`;
            }
            
            // Check if texture exists before setting
            if (gameRef.textures.exists(newTexture)) {
                chair.setTexture(newTexture);
            } else {
                console.warn(`Texture not found: ${newTexture}`);
            }
        }
    });
}

// Export for global access
window.initializeRooms = initializeRooms;
window.setupDoorCollisions = setupDoorCollisions;
window.updateDoorSpritesVisibility = updateDoorSpritesVisibility;
window.createPlayerBumpEffect = createPlayerBumpEffect;
window.createPlantSwayEffect = createPlantSwayEffect;
window.updateSwivelChairRotation = updateSwivelChairRotation;
window.updateSpriteDepth = updateSpriteDepth;

// Export functions for module imports
export { updateDoorSpritesVisibility }; 