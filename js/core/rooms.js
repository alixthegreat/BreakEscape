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
            roomWidth = map.json.width * 48;
            roomHeight = map.json.height * 48;
        } else if (map.data) {
            roomWidth = map.data.width * 48;
            roomHeight = map.data.height * 48;
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
                doorSprite = gameRef.add.sprite(doorX, doorY, 'door');
            } catch (error) {
                console.warn(`Failed to create door sprite with 'door' texture, creating colored rectangle instead:`, error);
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
    let roomWidth = 480, roomHeight = 432; // fallback
    
    if (map) {
        if (map.json) {
            roomWidth = map.json.width * 48;
            roomHeight = map.json.height * 48;
        } else if (map.data) {
            roomWidth = map.data.width * 48;
            roomHeight = map.data.height * 48;
        }
    }
    
    // Calculate door position in the connected room based on the opposite direction
    let doorX, doorY, doorWidth, doorHeight;
    
    // Calculate door position based on the room's door configuration
    if (direction === 'north' || direction === 'south') {
        // For north/south connections, calculate X position based on room configuration
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
                        console.log(`Animated door positioning for ${roomId}: left room (index 0), door on right (southeast), calculated doorX=${doorX}`);
                    } else {
                        // This room is on the right, so door should be on the left
                        doorX = roomPosition.x + TILE_SIZE * 1.5;
                        console.log(`Animated door positioning for ${roomId}: right room (index ${doorIndex}), door on left (southwest), calculated doorX=${doorX}`);
                    }
                } else {
                    // Fallback to left positioning
                    doorX = roomPosition.x + TILE_SIZE * 1.5;
                    console.log(`Animated door positioning for ${roomId}: fallback to left, calculated doorX=${doorX}`);
                }
            } else {
                // Single door - use left positioning
                doorX = roomPosition.x + TILE_SIZE * 1.5;
                console.log(`Animated door positioning for ${roomId}: single connection to ${fromRoomId}, calculated doorX=${doorX}`);
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
            roomWidth = map.json.width * 48;
            roomHeight = map.json.height * 48;
        } else if (map.data) {
            roomWidth = map.data.width * 48;
            roomHeight = map.data.height * 48;
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
    const roomWidth = roomData.width || 480;
    const roomHeight = roomData.height || 432;
    
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
                const tileX = Math.floor((worldX - room.position.x) / 48);
                const tileY = Math.floor((worldY - room.position.y) / 48);
                
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
                    roomWidth = width * 48;   // tile width is 48
                    roomHeight = height * 48; // tile height is 48
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
    const OVERLAP = 96;
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
                width: width * 48,  // tile width is 48
                height: height * 48 // tile height is 48
            };
        } else {
            console.error(`Could not find tilemap data for room ${roomId}`);
            // Fallback to default dimensions if needed
            roomDimensions[roomId] = {
                width: 800,  // default width
                height: 600  // default height
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

export function createRoom(roomId, roomData, position) {
    try {
        console.log(`Creating room ${roomId} of type ${roomData.type}`);
        const gameScenario = window.gameScenario;
        
        const map = gameRef.make.tilemap({ key: roomData.type });
        const tilesets = [];
        
        // Add tilesets
        const regularTilesets = map.tilesets.filter(t => !t.name.includes('Interiors_48x48'));
        regularTilesets.forEach(tileset => {
            const loadedTileset = map.addTilesetImage(tileset.name, tileset.name);
            if (loadedTileset) {
                tilesets.push(loadedTileset);
                console.log(`Added regular tileset: ${tileset.name}`);
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
                    
                    // Set up wall layer collisions
                    try {
                        layer.setCollisionByExclusion([-1]);
                        console.log(`Wall layer ${uniqueLayerId} collision enabled for room ${roomId}`);
                        
                        wallsLayers.push(layer);
                        console.log(`Added collision to wall layer: ${uniqueLayerId}`);
                        
                        // Add collision with player
                        const player = window.player;
                        if (player && player.body) {
                            gameRef.physics.add.collider(player, layer);
                            console.log(`Added collision between player and wall layer: ${uniqueLayerId}`);
                        }
                    } catch (e) {
                        console.warn(`Error setting up collisions for ${uniqueLayerId}:`, e);
                    }
                } else if (layerData.name.toLowerCase().includes('collision')) {
                    layer.setDepth(roomWorldY + 0.15);
                    console.log(`Collision layer depth: ${roomWorldY + 0.15}`);
                    
                    // Set up collision layer
                    try {
                        layer.setCollisionByExclusion([-1]);
                        console.log(`Collision layer ${uniqueLayerId} enabled for room ${roomId}`);
                        
                        // Add collision with player
                        const player = window.player;
                        if (player && player.body) {
                            gameRef.physics.add.collider(player, layer);
                            console.log(`Added collision between player and collision layer: ${uniqueLayerId}`);
                        }
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

        // Handle objects layer
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
            
            // Process scenario objects first
            if (gameScenario.rooms[roomId].objects) {
                console.log(`Processing ${gameScenario.rooms[roomId].objects.length} scenario objects for room ${roomId}`);
                gameScenario.rooms[roomId].objects.forEach((scenarioObj, index) => {
                    const objType = scenarioObj.type;
                    // skip "inInventory": true,
                    if (scenarioObj.inInventory) {
                        return;
                    }
                    
                    // Try to find a matching room object
                    let roomObj = null;
                    if (roomObjectsByType[objType] && roomObjectsByType[objType].length > 0) {
                        // Take the first available room object of this type
                        roomObj = roomObjectsByType[objType].shift();
                    }
                    
                    let sprite;
                    
                    if (roomObj) {
                        // Create sprite at the room object's position
                        sprite = gameRef.add.sprite(
                            position.x + roomObj.x,
                            position.y + (roomObj.gid !== undefined ? roomObj.y - roomObj.height : roomObj.y),
                            objType
                        );
                        
                        if (roomObj.rotation) {
                            sprite.setRotation(Phaser.Math.DegToRad(roomObj.rotation));
                        }
                        
                        // Create a unique key using the room object's ID
                        sprite.objectId = `${objType}_${roomObj.id || index}`;
                    } else {
                        // No matching room object, create at random position
                        // Assuming room size is 10x9 tiles of 48px each
                        const roomWidth = 10 * 48;
                        const roomHeight = 9 * 48;
                        
                        // Add some padding from the edges (2 tile width)
                        const padding = 48*2;
                        
                        const randomX = position.x + padding + Math.random() * (roomWidth - padding * 2);
                        const randomY = position.y + padding + Math.random() * (roomHeight - padding * 2);
                        
                        sprite = gameRef.add.sprite(randomX, randomY, objType);
                        console.log(`Created object ${objType} at random position (${randomX}, ${randomY})`);
                    }
                    
                    // Apply scaling based on object type
                    if (OBJECT_SCALES[objType]) {
                        sprite.setScale(OBJECT_SCALES[objType]);
                    }
                    
                    // SIMPLIFIED NAMING APPROACH
                    // Use a consistent format: roomId_type_index
                    const objectId = `${roomId}_${objType}_${index}`;
                    
                    // Set common properties
                    sprite.setOrigin(0, 0);
                    sprite.name = objType;  // Keep name as the object type for texture loading
                    sprite.objectId = objectId;  // Use our simplified ID format
                    sprite.setInteractive({ useHandCursor: true });
                    
                    // Set dynamic depth based on world Y position + layer offset
                    const objectBottomY = sprite.y + (sprite.height * sprite.scaleY); // Bottom of the sprite
                    const objectDepth = objectBottomY + 0.5; // World Y + sprite layer offset
                    sprite.setDepth(objectDepth);
                    
                    // Debug logging with more detail
                    console.log(`Object ${objectId} depth: ${objectDepth} (World Y: ${objectBottomY})`);
                    console.log(`  Room position: (${position.x}, ${position.y}), Object world position: (${sprite.x}, ${sprite.y})`);
                    console.log(`  Object layers: worldY(${objectBottomY}) + 0.5`);
                    
                    sprite.originalAlpha = 1;
                    sprite.active = true;
                    
                    // Store scenario data with sprite
                    sprite.scenarioData = scenarioObj;
                    
                    // Initially hide the object
                    sprite.setVisible(false);
                    
                    // Store the object
                    rooms[roomId].objects[objectId] = sprite;
                    
                    console.log(`Created object: ${objectId} at (${sprite.x}, ${sprite.y}) in room ${roomId}`);
                    
                    // Add click handler
                    sprite.on('pointerdown', () => {
                        console.log('Object clicked:', { name: objType, id: objectId });
                        // Call interaction handler
                        if (window.handleObjectInteraction) {
                            window.handleObjectInteraction(sprite);
                        }
                    });
                });
            }
        }
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

// Export for global access
window.initializeRooms = initializeRooms;
window.setupDoorCollisions = setupDoorCollisions;
window.updateDoorSpritesVisibility = updateDoorSpritesVisibility;

// Export functions for module imports
export { updateDoorSpritesVisibility }; 