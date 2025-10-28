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

// Import the new system modules
import { initializeDoors, createDoorSpritesForRoom, checkDoorTransitions, updateDoorSpritesVisibility } from '../systems/doors.js';
import { initializeObjectPhysics, setupChairCollisions, setupExistingChairsWithNewRoom, calculateChairSpinDirection, updateSwivelChairRotation, updateSpriteDepth } from '../systems/object-physics.js';
import { initializePlayerEffects, createPlayerBumpEffect, createPlantBumpEffect } from '../systems/player-effects.js';
import { initializeCollision, createWallCollisionBoxes, removeTilesUnderDoor, removeWallTilesForDoorInRoom, removeWallTilesAtWorldPosition } from '../systems/collision.js';

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

// ===== ITEM POOL MANAGEMENT (PHASE 2 IMPROVEMENTS) =====
// Moved to module level to avoid temporal dead zone errors
// and improve performance (defined once, not on every room load)

/**
 * Manages the collection of available Tiled items organized by type
 * Provides unified interface for finding, reserving, and tracking items
 * 
 * This class centralizes item pool logic to improve maintainability
 * while preserving all existing matching behavior
 */
class TiledItemPool {
    constructor(objectsByLayer, map) {
        this.itemsByType = {};              // Regular items (non-table) indexed by type
        this.tableItemsByType = {};         // Regular table items indexed by type
        this.conditionalItemsByType = {};   // Conditional items indexed by type
        this.conditionalTableItemsByType = {}; // Conditional table items indexed by type
        this.reserved = new Set();          // Track reserved items to prevent reuse
        this.map = map;                     // Store map for tileset lookups
        
        this.populateFromLayers(objectsByLayer);
    }
    
    /**
     * Get image name from Tiled object by looking up its GID in tilesets
     */
    getImageNameFromObject(obj) {
        return getImageNameFromObjectWithMap(obj, this.map);
    }
    
    /**
     * Extract base type from image name (e.g., "phone1" -> "phone")
     */
    extractBaseTypeFromImageName(imageName) {
        if (!imageName) {
            return 'unknown';
        }
        
        // Remove numbers and common suffixes to get base type
        let baseType = imageName.replace(/\d+$/, ''); // Remove trailing numbers
        baseType = baseType.replace(/\.png$/, ''); // Remove .png extension
        
        // Handle special cases where scenario uses plural but items use singular
        if (baseType === 'note') {
            const number = imageName.match(/\d+/);
            if (number) {
                baseType = 'notes' + number[0];
            } else {
                baseType = 'notes';
            }
        }
        
        return baseType;
    }
    
    /**
     * Populate pool from Tiled object layers
     * Indexes items by their base type for efficient lookup
     * 
     * Priority order for matching:
     * 1. Regular items (non-table)
     * 2. Regular table items
     * 3. Conditional items (non-table)
     * 4. Conditional table items
     */
    populateFromLayers(objectsByLayer) {
        this.itemsByType = this.indexByType(objectsByLayer.items || []);
        this.tableItemsByType = this.indexByType(objectsByLayer.table_items || []);
        this.conditionalItemsByType = this.indexByType(objectsByLayer.conditional_items || []);
        this.conditionalTableItemsByType = this.indexByType(objectsByLayer.conditional_table_items || []);
    }
    
    /**
     * Index an array of items by their base type
     * Returns object with baseType as keys and arrays of items as values
     */
    indexByType(items) {
        const indexed = {};
        items.forEach(item => {
            const imageName = this.getImageNameFromObject(item);
            if (imageName && imageName !== 'unknown') {
                const baseType = this.extractBaseTypeFromImageName(imageName);
                if (!indexed[baseType]) {
                    indexed[baseType] = [];
                }
                indexed[baseType].push(item);
            }
        });
        return indexed;
    }
    
    /**
     * Find best matching item for a scenario object
     * Searches in strict priority order:
     * 1. Regular items (items layer)
     * 2. Regular table items (table_items layer)
     * 3. Conditional items (conditional_items layer)
     * 4. Conditional table items (conditional_table_items layer)
     * 
     * This ensures unconditional items are ALWAYS used before conditional items.
     * For multiple requests of the same type, exhausts each layer before moving to next.
     * 
     * Skips reserved items to prevent reuse.
     * Returns the matched item or null if no match found
     */
    findMatchFor(scenarioObj) {
        const searchType = scenarioObj.type;
        
        // Search priority: unconditional layers first, then conditional layers
        const searchOrder = [
            this.itemsByType,              // Regular items
            this.tableItemsByType,         // Regular table items (NEW - CRITICAL FIX)
            this.conditionalItemsByType,   // Conditional items
            this.conditionalTableItemsByType // Conditional table items
        ];
        
        for (const indexedItems of searchOrder) {
            const candidates = indexedItems[searchType] || [];
            
            // Find first unreserved item of matching type
            for (const item of candidates) {
                if (!this.isReserved(item)) {
                    return item;
                }
            }
        }
        
        return null;
    }
    
    /**
     * Reserve an item to prevent it from being used again
     * Creates unique identifier from GID and coordinates
     */
    reserve(tiledItem) {
        const itemId = this.getItemId(tiledItem);
        this.reserved.add(itemId);
    }
    
    /**
     * Check if an item has been reserved
     */
    isReserved(tiledItem) {
        const itemId = this.getItemId(tiledItem);
        return this.reserved.has(itemId);
    }
    
    /**
     * Get all unreserved items across all regular (unconditional) layers
     * Used to process background decoration items that weren't used by scenario
     * 
     * NOTE: Returns BOTH regular items AND regular table items, but NOT conditional items.
     * Conditional items should ONLY be created when explicitly requested by scenario.
     * This ensures conditional items stay hidden until the scenario needs them.
     */
    getUnreservedItems() {
        const unreserved = [];
        
        const collectUnreserved = (indexed) => {
            Object.values(indexed).forEach(items => {
                items.forEach(item => {
                    if (!this.isReserved(item)) {
                        unreserved.push(item);
                    }
                });
            });
        };
        
        // Process both regular items and regular table items
        // Exclude conditional items - they should only appear when scenario explicitly requests them
        collectUnreserved(this.itemsByType);
        collectUnreserved(this.tableItemsByType);
        
        return unreserved;
    }
    
    /**
     * Get a unique identifier for an item based on GID and position
     * @private
     */
    getItemId(tiledItem) {
        return `gid_${tiledItem.gid}_x${tiledItem.x}_y${tiledItem.y}`;
    }
}

/**
 * Helper: Apply visual/transform properties from Tiled item to sprite
 * Handles rotation, flipping, and other Tiled-specific properties
 */
function applyTiledProperties(sprite, tiledItem) {
    sprite.setOrigin(0, 0);
    
    // Apply rotation if present
    if (tiledItem.rotation) {
        sprite.setRotation(Phaser.Math.DegToRad(tiledItem.rotation));
    }
    
    // Apply flipping if present
    if (tiledItem.flipX) {
        sprite.setFlipX(true);
    }
    if (tiledItem.flipY) {
        sprite.setFlipY(true);
    }
}

/**
 * Helper: Apply game logic properties from scenario to sprite
 * Stores scenario data and makes sprite interactive
 */
function applyScenarioProperties(sprite, scenarioObj, roomId, index) {
    sprite.scenarioData = scenarioObj;
    sprite.interactable = true; // Mark scenario items as interactable
    sprite.name = scenarioObj.name;
    sprite.objectId = `${roomId}_${scenarioObj.type}_${index}`;
    sprite.setInteractive({ useHandCursor: true });
    
    // Store all scenario properties for interaction system
    Object.keys(scenarioObj).forEach(key => {
        sprite[key] = scenarioObj[key];
    });
    
    // Log applied data for debugging
    console.log(`Applied scenario data to ${scenarioObj.type}:`, {
        name: scenarioObj.name,
        type: scenarioObj.type,
        takeable: scenarioObj.takeable,
        readable: scenarioObj.readable,
        text: scenarioObj.text,
        observations: scenarioObj.observations,
        keyPins: scenarioObj.keyPins,  // Include keyPins in log
        locked: scenarioObj.locked,
        lockType: scenarioObj.lockType
    });
    
    // Verify keyPins are stored on the sprite
    if (scenarioObj.keyPins) {
        console.log(`✓ keyPins stored on ${roomId}_${scenarioObj.type}: [${sprite.keyPins.join(', ')}]`);
    }
}

/**
 * Helper: Calculate and set depth for sprite based on room position
 * Handles elevation for back-wall items and table items
 */
function setDepthAndStore(sprite, position, roomId, isTableItem = false) {
    // Skip depth calculation for table items - already set in table grouping
    if (!isTableItem) {
        const objectBottomY = sprite.y + sprite.height;
        
        // Calculate elevation for items on the back wall (top 2 tiles of room)
        const roomTopY = position.y;
        const backWallThreshold = roomTopY + (2 * TILE_SIZE);
        const itemBottomY = sprite.y + sprite.height;
        const elevation = itemBottomY < backWallThreshold ? (backWallThreshold - itemBottomY) : 0;
        
        const objectDepth = objectBottomY + 0.5 + elevation;
        sprite.setDepth(objectDepth);
        sprite.elevation = elevation;
    }
    
    // Initially hide the object
    sprite.setVisible(false);
    
    // Store the object
    rooms[roomId].objects[sprite.objectId] = sprite;
}

/**
 * Module-level helper: Get image name from Tiled object
 * Used by both TiledItemPool and other helper functions
 * Note: This function needs to be called with map in context where it's available
 */
function getImageNameFromObjectWithMap(obj, map) {
    if (!map || !map.tilesets) {
        return null;
    }
    
    // Find the tileset that contains this GID
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

/**
 * Helper: Create sprite from a matched Tiled item and scenario object
 * Combines visual data (position, image) with game logic (properties)
 */
function createSpriteFromMatch(tiledItem, scenarioObj, position, roomId, index, map) {
    // Use the map-aware version of getImageNameFromObject
    const imageName = getImageNameFromObjectWithMap(tiledItem, map);
    
    // Create sprite at Tiled position with proper coordinate conversion
    // (Tiled Y is top-left, we use bottom-left for isometric perspective)
    const sprite = gameRef.add.sprite(
        Math.round(position.x + tiledItem.x),
        Math.round(position.y + tiledItem.y - tiledItem.height),
        imageName
    );
    
    // Apply Tiled visual properties (rotation, flipping, etc.)
    applyTiledProperties(sprite, tiledItem);
    
    // Apply scenario properties (name, type, interactive data)
    applyScenarioProperties(sprite, scenarioObj, roomId, index);
    
    return sprite;
}

/**
 * Helper: Create sprite at random position when no matching Tiled item found
 * Ensures position doesn't overlap with existing items
 */
function createSpriteAtRandomPosition(scenarioObj, position, roomId, index) {
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
    
    const sprite = gameRef.add.sprite(Math.round(randomX), Math.round(randomY), scenarioObj.type);
    
    console.log(`Created ${scenarioObj.type} at random position - no matching item found (attempts: ${attempts})`);
    
    // Apply properties
    sprite.setOrigin(0, 0);
    applyScenarioProperties(sprite, scenarioObj, roomId, index);
    
    return sprite;
}

// ===== END: ITEM POOL MANAGEMENT (PHASE 2 IMPROVEMENTS) =====

// Define scale factors for different object types
const OBJECT_SCALES = {
    'notes': 0.75,
    'key': 0.75,
    'phone': 1,
    'tablet': 0.75,
    'bluetooth_scanner': 0.7
};

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
    
    // Initialize the new system modules
    initializeDoors(gameInstance, rooms);
    initializeObjectPhysics(gameInstance, rooms);
    initializePlayerEffects(gameInstance, rooms);
    initializeCollision(gameInstance, rooms);
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

export function createRoom(roomId, roomData, position) {
    try {
        console.log(`Creating room ${roomId} of type ${roomData.type}`);
        const gameScenario = window.gameScenario;
        
        // Build a set of item types that are in startItemsInInventory
        // These should NOT be created as sprites in rooms
        const startInventoryTypes = new Set();
        if (gameScenario && gameScenario.startItemsInInventory && Array.isArray(gameScenario.startItemsInInventory)) {
            gameScenario.startItemsInInventory.forEach(item => {
                startInventoryTypes.add(item.type);
                console.log(`Marking item type "${item.type}" as starting inventory (will not create sprite in rooms)`);
            });
        }
        
        // Safety check: if gameRef is null, use window.game as fallback
        if (!gameRef && window.game) {
            console.log('gameRef was null, using window.game as fallback');
            gameRef = window.game;
        }
        
        if (!gameRef) {
            throw new Error('Game reference is null - cannot create room. This should not happen if called after game initialization.');
        }
        
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
            
            const layer = map.createLayer(index, tilesets, Math.round(position.x), Math.round(position.y));
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
                const processedObj = processObject(obj, position, roomId, 'table', map);
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
        
        // NOTE: Table items (both regular and conditional) are now processed through the item pool
        // in processScenarioObjectsWithConditionalMatching(). They will be handled there
        // with proper priority ordering (regular table items before conditional ones).
        
        // Process scenario objects with conditional item matching first
        const usedItems = processScenarioObjectsWithConditionalMatching(roomId, position, objectsByLayer, map);
        
        // Process all non-conditional items (chairs, plants, lamps, PCs, etc.)
        // These should ALWAYS be visible (not conditional)
        // They get default properties if not customized by scenario
        if (objectsByLayer.items) {
            objectsByLayer.items.forEach(obj => {
                const imageName = getImageNameFromObjectWithMap(obj, map);
                // Extract base type from image name
                let baseType = imageName ? imageName.replace(/\d+$/, '').replace(/\.png$/, '') : 'unknown';
                if (baseType === 'note') {
                    const number = imageName ? imageName.match(/\d+/) : null;
                    baseType = number ? 'notes' + number[0] : 'notes';
                }
                
                // Skip if this item type is in starting inventory
                if (startInventoryTypes.has(baseType)) {
                    console.log(`Skipping regular item ${imageName} (baseType: ${baseType}) - marked as starting inventory item`);
                    return;
                }
                
                // Skip if this exact item was used by scenario objects
                // BUT: Create it anyway if we haven't used ALL items of this type
                if (imageName && usedItems.has(imageName)) {
                    console.log(`Skipping regular item ${imageName} (exact item used by scenario)`);
                    return;
                }
                
                // Process the item and store it
                const result = processObject(obj, position, roomId, 'item', map);
                if (result && result.sprite) {
                    // Store unconditional items in the objects collection so they're revealed
                    rooms[roomId].objects[result.sprite.objectId] = result.sprite;
                }
            });
        }
        
        // ===== NEW: ITEM POOL MANAGEMENT (PHASE 2 IMPROVEMENTS) =====
        
        // Helper function to process scenario objects with conditional matching
        function processScenarioObjectsWithConditionalMatching(roomId, position, objectsByLayer, map) {
            const gameScenario = window.gameScenario;
            if (!gameScenario.rooms[roomId].objects) {
                return new Set();
            }
            
            // 1. Initialize item pool with all available Tiled items
            const itemPool = new TiledItemPool(objectsByLayer, map); // Pass map here
            const usedItems = new Set();
            
            console.log(`Processing ${gameScenario.rooms[roomId].objects.length} scenario objects for room ${roomId}`);
            
            // 2. Process each scenario object
            gameScenario.rooms[roomId].objects.forEach((scenarioObj, index) => {
                const objType = scenarioObj.type;
            
                let sprite = null;
                let usedItem = null;
                let isTableItem = false;
                
                console.log(`Looking for scenario object type: ${objType}`);
                console.log(`Available regular items for ${objType}: ${itemPool.itemsByType[objType] ? itemPool.itemsByType[objType].length : 0}`);
                console.log(`Available conditional items for ${objType}: ${itemPool.conditionalItemsByType[objType] ? itemPool.conditionalItemsByType[objType].length : 0}`);
                console.log(`Available conditional table items for ${objType}: ${itemPool.conditionalTableItemsByType[objType] ? itemPool.conditionalTableItemsByType[objType].length : 0}`);
                
                // Find matching Tiled item using centralized pool matching
                usedItem = itemPool.findMatchFor(scenarioObj);
                
                if (usedItem) {
                    // Check which layer this item came from to determine if it's a table item
                    const imageName = itemPool.getImageNameFromObject(usedItem);
                    const baseType = itemPool.extractBaseTypeFromImageName(imageName);
                    
                    // Determine source layer and log appropriately
                    let sourceLayer = 'unknown';
                    if (itemPool.itemsByType[baseType] && itemPool.itemsByType[baseType].includes(usedItem)) {
                        sourceLayer = 'items (regular)';
                        isTableItem = false;
                    } else if (itemPool.tableItemsByType[baseType] && itemPool.tableItemsByType[baseType].includes(usedItem)) {
                        sourceLayer = 'table_items (regular)';
                        isTableItem = true;
                    } else if (itemPool.conditionalItemsByType[baseType] && itemPool.conditionalItemsByType[baseType].includes(usedItem)) {
                        sourceLayer = 'conditional_items';
                        isTableItem = false;
                    } else if (itemPool.conditionalTableItemsByType[baseType] && itemPool.conditionalTableItemsByType[baseType].includes(usedItem)) {
                        sourceLayer = 'conditional_table_items';
                        isTableItem = true;
                    }
                    
                    console.log(`Using ${objType} from ${sourceLayer} layer`);
                    
                    // Create sprite from matched item
                    sprite = createSpriteFromMatch(usedItem, scenarioObj, position, roomId, index, map);
                    
                    console.log(`Created ${objType} using ${imageName}`);
                    
                    // Track this item as used
                    usedItems.add(imageName);
                    usedItems.add(baseType);
                    itemPool.reserve(usedItem);
                    
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
                                group.items.push({ sprite, type: sourceLayer });
                                
                                // Store table items in objects collection so interaction system can find them
                                rooms[roomId].objects[sprite.objectId] = sprite;
                            }
                        }
                    } else {
                        // Set depth and store for non-table items
                        setDepthAndStore(sprite, position, roomId, false);
                    }
                    
                } else {
                    // No matching item found, create at random position (existing fallback behavior)
                    sprite = createSpriteAtRandomPosition(scenarioObj, position, roomId, index);
                    
                    // Set depth and store
                    setDepthAndStore(sprite, position, roomId, false);
                }
            });
            
            // 3. Process unreserved Tiled items (existing background decoration items)
            // These are unconditional items that were not used by any scenario object
            const unreservedItems = itemPool.getUnreservedItems();
            
            // Separate table items from regular items for special processing
            const unreservedTableItems = [];
            const unreservedRegularItems = [];
            
            unreservedItems.forEach(tiledItem => {
                const imageName = itemPool.getImageNameFromObject(tiledItem);
                
                // Skip if this exact item was already used by scenario objects
                if (usedItems.has(imageName)) {
                    return;
                }
                
                // Skip if this item type is in starting inventory
                const baseType = itemPool.extractBaseTypeFromImageName(imageName);
                if (startInventoryTypes.has(baseType)) {
                    console.log(`Skipping unreserved item ${imageName} (baseType: ${baseType}) - marked as starting inventory item`);
                    return;
                }
                
                // Check if this is a table item by seeing if it's in tableItemsByType
                if (itemPool.tableItemsByType[baseType] && 
                    itemPool.tableItemsByType[baseType].includes(tiledItem)) {
                    unreservedTableItems.push(tiledItem);
                } else {
                    unreservedRegularItems.push(tiledItem);
                }
            });
            
            // Process regular unreserved items (chairs, lamps, etc.)
            unreservedRegularItems.forEach(tiledItem => {
                const imageName = itemPool.getImageNameFromObject(tiledItem);
                
                // Use processObject to create sprite with all properties (collision, animation, etc.)
                const result = processObject(tiledItem, position, roomId, 'item', map);
                if (result && result.sprite) {
                    // Store unreserved items so they're revealed
                    rooms[roomId].objects[result.sprite.objectId] = result.sprite;
                    console.log(`Added unreserved item ${imageName} to room objects`);
                }
            });
            
            // Process unreserved table items - need to group them with tables and set depth
            unreservedTableItems.forEach(tiledItem => {
                const imageName = itemPool.getImageNameFromObject(tiledItem);
                
                // Use processObject to create sprite with all properties
                const result = processObject(tiledItem, position, roomId, 'table_item', map);
                if (result && result.sprite) {
                    // Find the closest table to group this item with
                    if (tableObjects.length > 0) {
                        const closestTable = findClosestTable(result.sprite, tableObjects);
                        if (closestTable) {
                            const group = tableGroups.find(g => g.table === closestTable);
                            if (group) {
                                group.items.push(result);
                                console.log(`Added unreserved table item ${imageName} to table group`);
                            }
                        }
                    } else {
                        // No tables, just store it as a regular item
                        rooms[roomId].objects[result.sprite.objectId] = result.sprite;
                        console.log(`Added unreserved table item ${imageName} to room objects (no tables to group with)`);
                    }
                }
            });
            
            // Final re-sort and depth assignment for all table groups 
            // (includes both scenario and unreserved table items)
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
                    console.log(`Final depth: table item ${item.sprite.name} to depth ${itemDepth} (position ${index + 1} of ${group.items.length})`);
                });
                
                // Store all group items in room objects
                group.items.forEach(item => {
                    rooms[roomId].objects[item.sprite.objectId] = item.sprite;
                });
            });
            
            // Log summary of item usage
            console.log(`=== Item Usage Summary ===`);
            Object.entries(itemPool.itemsByType).forEach(([baseType, items]) => {
                console.log(`Regular items for ${baseType}: ${items.length} available`);
            });
            Object.entries(itemPool.tableItemsByType).forEach(([baseType, items]) => {
                console.log(`Regular table items for ${baseType}: ${items.length} available`);
            });
            Object.entries(itemPool.conditionalItemsByType).forEach(([baseType, items]) => {
                console.log(`Conditional items for ${baseType}: ${items.length} available`);
            });
            Object.entries(itemPool.conditionalTableItemsByType).forEach(([baseType, items]) => {
                console.log(`Conditional table items for ${baseType}: ${items.length} available`);
            });
            
            return usedItems;
        }
        
        // Helper function to process individual objects
        function processObject(obj, position, roomId, type, map) {
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
                    
                    // Create sprite at the object's position with pixel-perfect coordinates
                    const sprite = gameRef.add.sprite(
                        Math.round(position.x + obj.x),
                        Math.round(position.y + obj.y - obj.height), // Adjust for Tiled's coordinate system
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
                    
                    // Check if this is an animated plant
                    if (imageName.startsWith('plant-large11-top-ani') || 
                        imageName.startsWith('plant-large12-top-ani') || 
                        imageName.startsWith('plant-large13-top-ani')) {
                        
                        sprite.isAnimatedPlant = true;
                        sprite.originalScaleX = sprite.scaleX;
                        sprite.originalScaleY = sprite.scaleY;
                        sprite.originalX = Math.round(sprite.x); // Store pixel-perfect position
                        sprite.originalY = Math.round(sprite.y); // Store pixel-perfect position
                        sprite.originalWidth = Math.round(sprite.width);
                        sprite.originalHeight = Math.round(sprite.height);
                        
                        // Determine which animation to use based on the plant type
                        if (imageName.startsWith('plant-large11-top-ani')) {
                            sprite.animationKey = 'plant-large11-bump';
                        } else if (imageName.startsWith('plant-large12-top-ani')) {
                            sprite.animationKey = 'plant-large12-bump';
                        } else if (imageName.startsWith('plant-large13-top-ani')) {
                            sprite.animationKey = 'plant-large13-bump';
                        }
                        
                        // Ensure the sprite is positioned on pixel boundaries
                        sprite.x = Math.round(sprite.x);
                        sprite.y = Math.round(sprite.y);
                        
                        console.log(`Animated plant ${imageName} ready with animation ${sprite.animationKey}`);
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
                    
                    // Make swivel chairs interactable but don't highlight them
                    if (sprite.isSwivelChair) {
                        sprite.interactable = true;
                        sprite.noInteractionHighlight = true;
                        console.log(`Marked swivel chair ${sprite.objectId} as interactable (no highlight)`);
                    }
                    
                    // Note: Click handling is now done by the main scene's pointerdown handler
                    // which checks for all objects at the clicked position
                    
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
                    
                    // Create invisible collision body with pixel-perfect coordinates
                    const collisionBody = gameRef.add.rectangle(
                        Math.round(position.x + obj.x + obj.width/2),
                        Math.round(position.y + obj.y + obj.height/2),
                        Math.round(obj.width),
                        Math.round(obj.height)
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

// Door collisions are now handled by sprite-based system
export function setupDoorCollisions() {
    console.log('Door collisions are now handled by sprite-based system');
}

// Export for global access
window.initializeRooms = initializeRooms;
window.setupDoorCollisions = setupDoorCollisions;
window.loadRoom = loadRoom;

// Export functions for module imports
export { updateDoorSpritesVisibility };
