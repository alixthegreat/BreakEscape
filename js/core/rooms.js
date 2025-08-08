// Room management system
import { TILE_SIZE, DOOR_ALIGN_OVERLAP, GRID_SIZE, INTERACTION_RANGE_SQ, INTERACTION_CHECK_INTERVAL } from '../utils/constants.js?v=7';

export let rooms = {};
export let currentRoom = '';
export let currentPlayerRoom = '';
export let discoveredRooms = new Set();
let gameRef = null;

// Define scale factors for different object types
const OBJECT_SCALES = {
    'notes': 0.75,
    'key': 0.75,
    'phone': 1,
    'tablet': 0.75,
    'bluetooth_scanner': 0.7
};

export function initializeRooms(gameInstance) {
    gameRef = gameInstance;
    console.log('Initializing rooms');
    rooms = {};
    window.rooms = rooms; // Ensure window.rooms references the same object
    currentRoom = '';
    currentPlayerRoom = '';
    window.currentPlayerRoom = '';
    discoveredRooms = new Set();
}

// Validate doors by room overlap
export function validateDoorsByRoomOverlap() {
    console.log('Validating doors by room overlap');
    
    const doorTiles = [];
    
    // Collect all door tiles from all rooms
    Object.entries(rooms).forEach(([roomId, room]) => {
        if (room.doorsLayer) {
            const roomDoorTiles = room.doorsLayer.getTilesWithin()
                .filter(tile => tile.index !== -1);
            roomDoorTiles.forEach(doorTile => {
                const worldX = room.doorsLayer.x + (doorTile.x * room.doorsLayer.tilemap.tileWidth);
                const worldY = room.doorsLayer.y + (doorTile.y * room.doorsLayer.tilemap.tileHeight);
                
                doorTiles.push({
                    tile: doorTile,
                    worldX,
                    worldY,
                    roomId,
                    layer: room.doorsLayer
                });
            });
        }
    });
    
    // Check each door against all rooms
    doorTiles.forEach(doorInfo => {
        const overlappingRooms = [];
        
        Object.entries(rooms).forEach(([roomId, room]) => {
            const roomBounds = {
                x: room.position.x,
                y: room.position.y,
                width: 800,  // Assuming standard room size
                height: 600
            };
            
            // Check if door overlaps with this room
            if (doorInfo.worldX >= roomBounds.x && 
                doorInfo.worldX < roomBounds.x + roomBounds.width &&
                doorInfo.worldY >= roomBounds.y && 
                doorInfo.worldY < roomBounds.y + roomBounds.height) {
                overlappingRooms.push(roomId);
            }
        });
        
        console.log(`Door at (${doorInfo.worldX}, ${doorInfo.worldY}) overlaps with room ${overlappingRooms.join(', ')}`);
        
        if (overlappingRooms.length === 2) {
            // Valid door - connects two rooms
            const doorLocked = doorInfo.tile.properties?.locked;
            console.log(`Door at (${doorInfo.worldX}, ${doorInfo.worldY}) marked as locked:`, doorLocked);
        } else if (overlappingRooms.length === 1) {
            // Invalid door - only overlaps one room, remove it
            console.log(`Removing door at (${doorInfo.worldX}, ${doorInfo.worldY}) - overlaps ${overlappingRooms.length} rooms`);
            doorInfo.tile.index = -1;
        }
    });
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
        const roomDepth = position.y * 100;
        
        // Create doors layer first with a specific depth
        const doorsLayerIndex = map.layers.findIndex(layer => 
            layer.name.toLowerCase().includes('doors'));
        let doorsLayer = null;
        if (doorsLayerIndex !== -1) {
            window.globalLayerCounter++;
            const uniqueDoorsId = `${roomId}_doors_${window.globalLayerCounter}`;
            doorsLayer = map.createLayer(doorsLayerIndex, tilesets, position.x, position.y);
            if (doorsLayer) {
                doorsLayer.name = uniqueDoorsId;
                // Set doors layer depth higher than other layers
                doorsLayer.setDepth(roomDepth + 500);
                layers[uniqueDoorsId] = doorsLayer;
                rooms[roomId].doorsLayer = doorsLayer;
                
                // Apply room-level locking to door tiles
                if (roomData.locked) {
                    console.log(`Applying lock to doors in room ${roomId}`);
                    const doorTiles = doorsLayer.getTilesWithin().filter(tile => tile.index !== -1);
                    doorTiles.forEach(doorTile => {
                        if (!doorTile.properties) {
                            doorTile.properties = {};
                        }
                        doorTile.properties.locked = true;
                        doorTile.properties.lockType = roomData.lockType || 'key';
                        doorTile.properties.requires = roomData.requires || '';
                        doorTile.properties.difficulty = roomData.difficulty || 'medium';
                        console.log(`Door tile locked:`, doorTile.properties);
                    });
                }
            }
        }

        // Create other layers with appropriate depths
        map.layers.forEach((layerData, index) => {
            // Skip the doors layer as we already created it
            if (index === doorsLayerIndex) return;

            window.globalLayerCounter++;
            const uniqueLayerId = `${roomId}_${layerData.name}_${window.globalLayerCounter}`;
            
            const layer = map.createLayer(index, tilesets, position.x, position.y);
            if (layer) {
                layer.name = uniqueLayerId;
                
                // Set depth based on layer type and room position
                if (layerData.name.toLowerCase().includes('floor')) {
                    layer.setDepth(roomDepth + 100);
                } else if (layerData.name.toLowerCase().includes('walls')) {
                    layer.setDepth(roomDepth + 200);
                    // Handle walls layer collision
                    try {
                        layer.setCollisionByExclusion([-1]);
                        
                        if (doorsLayer) {
                            const doorTiles = doorsLayer.getTilesWithin()
                                .filter(tile => tile.index !== -1);
                            
                            doorTiles.forEach(doorTile => {
                                const wallTile = layer.getTileAt(doorTile.x, doorTile.y);
                                if (wallTile) {
                                    if (doorTile.properties?.locked) {
                                        wallTile.setCollision(true);
                                        console.log(`Door tile at (${doorTile.x},${doorTile.y}) set to collision: locked`);
                                    } else {
                                        wallTile.setCollision(false);
                                        console.log(`Door tile at (${doorTile.x},${doorTile.y}) set to collision: false (unlocked)`);
                                    }
                                }
                            });
                        }
                        
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
                } else if (layerData.name.toLowerCase().includes('props')) {
                    layer.setDepth(roomDepth + 300);
                } else {
                    layer.setDepth(roomDepth + 400);
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
                    sprite.setDepth(1001);
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
        
        // Explicitly reveal doors layer if it exists
        if (room.doorsLayer) {
            room.doorsLayer.setVisible(true);
            room.doorsLayer.setAlpha(1);
        }
        
        // Update visibility of doors from other rooms that overlap with this room
        updateDoorsVisibility();
        
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
    }
    currentRoom = roomId;
}

export function updatePlayerRoom() {
    // Check which room the player is currently in
    const player = window.player;
    if (!player) {
        return; // Player not created yet
    }
    
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
            overlappingRooms.push(roomId);
            
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
    
    // Update current room (use the first overlapping room as the "main" room)
    if (currentPlayerRoom !== overlappingRooms[0]) {
        console.log(`Player's main room changed to: ${overlappingRooms[0]}`);
        currentPlayerRoom = overlappingRooms[0];
        window.currentPlayerRoom = overlappingRooms[0];
    }
    
    return currentPlayerRoom;
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



// Update doors visibility based on which rooms are revealed
function updateDoorsVisibility() {
    // Check all rooms for doors
    Object.entries(rooms).forEach(([roomId, room]) => {
        if (!room.doorsLayer) return;
        
        const doorTiles = room.doorsLayer.getTilesWithin().filter(tile => tile.index !== -1);
        
        doorTiles.forEach(doorTile => {
            const doorWorldX = room.doorsLayer.x + (doorTile.x * TILE_SIZE);
            const doorWorldY = room.doorsLayer.y + (doorTile.y * TILE_SIZE);
            
            const doorCheckArea = {
                x: doorWorldX - DOOR_ALIGN_OVERLAP,
                y: doorWorldY - DOOR_ALIGN_OVERLAP,
                width: DOOR_ALIGN_OVERLAP * 2,
                height: DOOR_ALIGN_OVERLAP * 2
            };
            
            // Check how many revealed rooms this door overlaps with
            let overlappingRevealedRooms = 0;
            
            Object.entries(rooms).forEach(([otherRoomId, otherRoom]) => {
                if (!discoveredRooms.has(otherRoomId)) return; // Skip unrevealed rooms
                
                const otherRoomBounds = {
                    x: otherRoom.position.x,
                    y: otherRoom.position.y,
                    width: otherRoom.map.widthInPixels,
                    height: otherRoom.map.heightInPixels
                };
                
                // Check if door overlaps with this revealed room
                if (boundsOverlap(doorCheckArea, otherRoomBounds)) {
                    overlappingRevealedRooms++;
                }
            });
            
            // Door should be visible if it overlaps with at least one revealed room
            const shouldBeVisible = overlappingRevealedRooms > 0;
            
            if (shouldBeVisible && !room.doorsLayer.visible) {
                room.doorsLayer.setVisible(true);
                room.doorsLayer.setAlpha(1);
            }
        });
    });
}

// Helper function for bounds overlap check
function boundsOverlap(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// Export for global access
window.initializeRooms = initializeRooms; 