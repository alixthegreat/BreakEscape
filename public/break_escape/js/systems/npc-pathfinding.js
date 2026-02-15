/**
 * NPC PATHFINDING SYSTEM - EasyStar.js Integration
 * ================================================
 *
 * Manages pathfinding for all NPCs using EasyStar.js.
 * Each room has its own pathfinder grid based on wall collision data.
 *
 * Key Concepts:
 * - One pathfinder per room (created when room is loaded)
 * - Patrol bounds: 2 tiles from room edges (walls are on edges)
 * - Paths converted from tile coordinates to world coordinates
 * - Random patrol targets selected from valid positions within bounds
 *
 * @module npc-pathfinding
 */

import { TILE_SIZE, GRID_SIZE } from '../utils/constants.js?v=8';

const PATROL_EDGE_OFFSET = 2; // Distance from room edge (2 tiles)

/**
 * NPCPathfindingManager - Manages pathfinding for all NPCs across all rooms
 */
export class NPCPathfindingManager {
    constructor(scene) {
        this.scene = scene;
        this.pathfinders = new Map();  // Map<roomId, pathfinder>
        this.grids = new Map();         // Map<roomId, grid>
        this.roomBounds = new Map();   // Map<roomId, {x, y, width, height, mapWidth, mapHeight}>
        
        console.log('✅ NPCPathfindingManager initialized');
    }

    /**
     * Initialize pathfinder for a room
     * Called when room is loaded (from rooms.js)
     *
     * @param {string} roomId - Room identifier
     * @param {Object} roomData - Room data from window.rooms[roomId]
     * @param {Object} roomPosition - {x, y} world position of room
     */
    initializeRoomPathfinding(roomId, roomData, roomPosition) {
        try {
            console.log(`📍 initializeRoomPathfinding called for room: ${roomId}`);
            
            if (!roomData) {
                console.warn(`⚠️ Room data is null/undefined for ${roomId}`);
                return;
            }
            
            if (!roomData.map) {
                console.warn(`⚠️ Room ${roomId} has no tilemap, skipping pathfinding init`);
                console.warn(`   roomData keys: ${Object.keys(roomData).join(', ')}`);
                return;
            }

            const mapWidth = roomData.map.width;
            const mapHeight = roomData.map.height;

            console.log(`🔧 Initializing pathfinding for room ${roomId}...`);
            console.log(`   Map dimensions: ${mapWidth}x${mapHeight}`);
            console.log(`   WallsLayers count: ${roomData.wallsLayers ? roomData.wallsLayers.length : 0}`);

            // Build grid from wall collision data
            const grid = this.buildGridFromWalls(roomId, roomData, mapWidth, mapHeight);

            // Create and configure pathfinder
            const pathfinder = new EasyStar.js();
            pathfinder.setGrid(grid);
            pathfinder.setAcceptableTiles([0]);  // 0 = walkable, 1 = wall
            pathfinder.enableDiagonals();

            // Store pathfinder and grid for this room
            this.pathfinders.set(roomId, pathfinder);
            this.grids.set(roomId, grid);

            // Calculate patrol bounds (2 tiles from edges)
            const bounds = {
                x: PATROL_EDGE_OFFSET,
                y: PATROL_EDGE_OFFSET,
                width: Math.max(1, mapWidth - PATROL_EDGE_OFFSET * 2),
                height: Math.max(1, mapHeight - PATROL_EDGE_OFFSET * 2),
                mapWidth: mapWidth,
                mapHeight: mapHeight,
                worldX: roomPosition.x,
                worldY: roomPosition.y
            };

            this.roomBounds.set(roomId, bounds);

            console.log(`✅ Pathfinding initialized for room ${roomId}`);
            console.log(`   Grid: ${mapWidth}x${mapHeight} tiles | Patrol bounds: (${bounds.x}, ${bounds.y}) to (${bounds.x + bounds.width}, ${bounds.y + bounds.height})`);

        } catch (error) {
            console.error(`❌ Failed to initialize pathfinding for room ${roomId}:`, error);
            console.error('Error stack:', error.stack);
        }
    }

    /**
     * Build collision grid from wall layer data AND table objects
     * 0 = walkable, 1 = wall/obstacle
     *
     * IMPORTANT: Walls are created as collision boxes based on wall tiles by createWallCollisionBoxes().
     * This method marks the same tiles as obstacles in the pathfinding grid so NPCs avoid them.
     * Table objects are also marked from the Tiled map.
     *
     * @private
     */
    buildGridFromWalls(roomId, roomData, mapWidth, mapHeight) {
        const grid = Array(mapHeight).fill().map(() => Array(mapWidth).fill(0));

        // PASS 1: Mark all wall tiles as impassable
        // (Wall collision boxes are created from these same tiles in collision.js)
        if (!roomData.wallsLayers || roomData.wallsLayers.length === 0) {
            console.warn(`⚠️ No wall layers found for room ${roomId}, creating open grid`);
        } else {
            let wallTilesMarked = 0;
            
            // Mark all wall tiles from the tilemap
            roomData.wallsLayers.forEach(wallLayer => {
                try {
                    // Get all non-empty tiles from the wall layer
                    const allWallTiles = wallLayer.getTilesWithin(0, 0, mapWidth, mapHeight, { isNotEmpty: true });

                    allWallTiles.forEach(tile => {
                        // Mark ALL wall tiles as impassable (not just ones with collision properties)
                        // because collision.js creates collision boxes for all wall tiles
                        const tileX = tile.x;
                        const tileY = tile.y;

                        if (tileX >= 0 && tileX < mapWidth && tileY >= 0 && tileY < mapHeight) {
                            grid[tileY][tileX] = 1; // Mark as impassable
                            wallTilesMarked++;
                        }
                    });

                    console.log(`✅ Processed wall layer with ${allWallTiles.length} tiles, marked ${wallTilesMarked} as impassable`);
                } catch (error) {
                    console.error(`❌ Error processing wall layer for room ${roomId}:`, error);
                }
            });
            
            if (wallTilesMarked > 0) {
                console.log(`✅ Total wall tiles marked as obstacles: ${wallTilesMarked}`);
            }
        }

        // NEW: Mark table objects as obstacles in pathfinding grid
        if (roomData.map) {
            // Get the tables object layer from the Phaser tilemap
            const tablesLayer = roomData.map.getObjectLayer('tables');
            
            console.log(`🔍 Looking for tables object layer: ${tablesLayer ? 'Found' : 'Not found'}`);
            
            if (tablesLayer && tablesLayer.objects && tablesLayer.objects.length > 0) {
                let tablesMarked = 0;
                console.log(`📦 Processing ${tablesLayer.objects.length} table objects...`);
                
                tablesLayer.objects.forEach((tableObj, idx) => {
                    try {
                        // Convert world coordinates to tile coordinates
                        const tableWorldX = tableObj.x;
                        const tableWorldY = tableObj.y;
                        const tableWidth = tableObj.width;
                        const tableHeight = tableObj.height;

                        console.log(`  Table ${idx}: (${tableWorldX}, ${tableWorldY}) size ${tableWidth}x${tableHeight}`);

                        // Convert to tile coordinates
                        const startTileX = Math.floor(tableWorldX / TILE_SIZE);
                        const startTileY = Math.floor(tableWorldY / TILE_SIZE);
                        const endTileX = Math.ceil((tableWorldX + tableWidth) / TILE_SIZE);
                        const endTileY = Math.ceil((tableWorldY + tableHeight) / TILE_SIZE);

                        console.log(`  -> Tiles: (${startTileX}, ${startTileY}) to (${endTileX}, ${endTileY})`);

                        // Mark all tiles covered by table as impassable
                        let tilesInTable = 0;
                        for (let tileY = startTileY; tileY < endTileY; tileY++) {
                            for (let tileX = startTileX; tileX < endTileX; tileX++) {
                                if (tileX >= 0 && tileX < mapWidth && tileY >= 0 && tileY < mapHeight) {
                                    grid[tileY][tileX] = 1; // Mark as impassable
                                    tablesMarked++;
                                    tilesInTable++;
                                }
                            }
                        }
                        console.log(`  -> Marked ${tilesInTable} grid cells`);
                    } catch (error) {
                        console.error(`❌ Error processing table object ${idx}:`, error);
                    }
                });

                console.log(`✅ Marked ${tablesMarked} total grid cells as obstacles from ${tablesLayer.objects.length} tables`);
            } else {
                console.warn(`⚠️ Tables object layer not found or empty`);
            }
        } else {
            console.warn(`⚠️ Room map not available for table processing`);
        }

        return grid;
    }

    /**
     * Find a path from start to end position
     * Positions should be world coordinates
     *
     * @param {string} roomId - Room identifier
     * @param {number} startX - Start world X
     * @param {number} startY - Start world Y
     * @param {number} endX - End world X
     * @param {number} endY - End world Y
     * @param {Function} callback - Callback(path) where path is array of world {x, y} or null
     */
    findPath(roomId, startX, startY, endX, endY, callback) {
        const pathfinder = this.pathfinders.get(roomId);
        const bounds = this.roomBounds.get(roomId);

        if (!pathfinder || !bounds) {
            console.warn(`⚠️ No pathfinder for room ${roomId} - room may not be loaded`);
            callback(null);
            return;
        }

        // Validate that start and end positions are within reasonable range of room bounds
        const roomWorldMinX = bounds.worldX;
        const roomWorldMinY = bounds.worldY;
        const roomWorldMaxX = bounds.worldX + (bounds.mapWidth * TILE_SIZE);
        const roomWorldMaxY = bounds.worldY + (bounds.mapHeight * TILE_SIZE);

        // Check if start position is in this room
        if (startX < roomWorldMinX - TILE_SIZE || startX > roomWorldMaxX + TILE_SIZE ||
            startY < roomWorldMinY - TILE_SIZE || startY > roomWorldMaxY + TILE_SIZE) {
            console.warn(`⚠️ Start position (${startX}, ${startY}) is outside room ${roomId} bounds`);
            callback(null);
            return;
        }

        // Check if end position is in this room
        if (endX < roomWorldMinX - TILE_SIZE || endX > roomWorldMaxX + TILE_SIZE ||
            endY < roomWorldMinY - TILE_SIZE || endY > roomWorldMaxY + TILE_SIZE) {
            console.warn(`⚠️ End position (${endX}, ${endY}) is outside room ${roomId} bounds`);
            callback(null);
            return;
        }

        // Convert world coordinates to tile coordinates
        const startTileX = Math.floor((startX - bounds.worldX) / TILE_SIZE);
        const startTileY = Math.floor((startY - bounds.worldY) / TILE_SIZE);
        const endTileX = Math.floor((endX - bounds.worldX) / TILE_SIZE);
        const endTileY = Math.floor((endY - bounds.worldY) / TILE_SIZE);

        // Clamp to valid tile ranges (should already be valid but safety check)
        const clampedStartX = Math.max(0, Math.min(bounds.mapWidth - 1, startTileX));
        const clampedStartY = Math.max(0, Math.min(bounds.mapHeight - 1, startTileY));
        const clampedEndX = Math.max(0, Math.min(bounds.mapWidth - 1, endTileX));
        const clampedEndY = Math.max(0, Math.min(bounds.mapHeight - 1, endTileY));

        // Warn if coordinates were clamped (indicates out of bounds request)
        if (startTileX !== clampedStartX || startTileY !== clampedStartY) {
            console.warn(`⚠️ Start position was clamped from (${startTileX}, ${startTileY}) to (${clampedStartX}, ${clampedStartY})`);
        }
        if (endTileX !== clampedEndX || endTileY !== clampedEndY) {
            console.warn(`⚠️ End position was clamped from (${endTileX}, ${endTileY}) to (${clampedEndX}, ${clampedEndY})`);
        }

        // Find path
        pathfinder.findPath(clampedStartX, clampedStartY, clampedEndX, clampedEndY, (tilePath) => {
            if (tilePath && tilePath.length > 0) {
                // Convert tile path to world path, ensuring all waypoints are within room bounds
                const worldPath = tilePath.map(point => ({
                    x: bounds.worldX + point.x * TILE_SIZE + TILE_SIZE / 2,
                    y: bounds.worldY + point.y * TILE_SIZE + TILE_SIZE / 2
                }));

                // Validate all waypoints are within the room
                const validPath = worldPath.every(wp => 
                    wp.x >= roomWorldMinX && wp.x <= roomWorldMaxX &&
                    wp.y >= roomWorldMinY && wp.y <= roomWorldMaxY
                );

                if (!validPath) {
                    console.warn(`⚠️ Generated path contains waypoints outside room ${roomId} bounds`);
                    callback(null);
                    return;
                }

                callback(worldPath);
            } else {
                callback(null);
            }
        });

        pathfinder.calculate();
    }

    /**
     * Check if there's a clear line of sight between two points
     * Uses Bresenham's line algorithm to check all tiles along the path
     * Also checks adjacent tiles to account for NPC body width (20px ~= 0.6 tiles)
     *
     * @param {string} roomId - Room identifier
     * @param {number} startX - Start world X
     * @param {number} startY - Start world Y
     * @param {number} endX - End world X
     * @param {number} endY - End world Y
     * @returns {boolean} - True if path is clear (all tiles walkable)
     */
    hasLineOfSight(roomId, startX, startY, endX, endY) {
        const grid = this.grids.get(roomId);
        const bounds = this.roomBounds.get(roomId);

        if (!grid || !bounds) {
            return false;
        }

        // Bounds check: ensure both points are within room (with tolerance)
        const roomMinX = bounds.worldX;
        const roomMinY = bounds.worldY;
        const roomMaxX = bounds.worldX + (bounds.mapWidth * TILE_SIZE);
        const roomMaxY = bounds.worldY + (bounds.mapHeight * TILE_SIZE);

        if (startX < roomMinX || startX > roomMaxX || startY < roomMinY || startY > roomMaxY) {
            return false; // Start position outside room
        }
        if (endX < roomMinX || endX > roomMaxX || endY < roomMinY || endY > roomMaxY) {
            return false; // End position outside room
        }

        // Convert world coordinates to tile coordinates (use center of tiles)
        const startTileX = Math.round((startX - bounds.worldX) / TILE_SIZE);
        const startTileY = Math.round((startY - bounds.worldY) / TILE_SIZE);
        const endTileX = Math.round((endX - bounds.worldX) / TILE_SIZE);
        const endTileY = Math.round((endY - bounds.worldY) / TILE_SIZE);

        // Helper function to check if a tile is walkable
        const isTileWalkable = (tx, ty) => {
            if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) {
                return false; // Out of bounds
            }
            return grid[ty][tx] === 0; // 0 = walkable
        };

        // Bresenham's line algorithm to check all tiles along the line
        const dx = Math.abs(endTileX - startTileX);
        const dy = Math.abs(endTileY - startTileY);
        const sx = startTileX < endTileX ? 1 : -1;
        const sy = startTileY < endTileY ? 1 : -1;
        let err = dx - dy;

        let x = startTileX;
        let y = startTileY;

        while (true) {
            // Check if current tile and adjacent tiles are walkable
            // NPCs are ~20px wide (0.6 tiles), so check the main tile plus one adjacent
            if (!isTileWalkable(x, y)) {
                return false; // Center tile blocked
            }

            // For diagonal movement, check that adjacent tiles are also clear
            // This prevents NPCs from trying to squeeze through diagonal gaps
            if (dx > 0 && dy > 0) { // Moving diagonally
                // Check the perpendicular tiles to ensure enough clearance
                if (!isTileWalkable(x + sx, y) || !isTileWalkable(x, y + sy)) {
                    return false; // Diagonal squeeze - not enough clearance
                }
            }

            // Reached end point
            if (x === endTileX && y === endTileY) {
                break;
            }

            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }

        return true; // Clear path
    }

    /**
     * Get random valid position within patrol bounds
     * Ensures position is walkable (not on a wall)
     *
     * @param {string} roomId - Room identifier
     * @returns {Object|null} - {x, y} world position or null if no valid position found
     */
    getRandomPatrolTarget(roomId) {
        const bounds = this.roomBounds.get(roomId);
        const grid = this.grids.get(roomId);

        if (!bounds || !grid) {
            console.warn(`⚠️ No bounds/grid for room ${roomId}`);
            console.warn(`   Bounds: ${bounds ? 'exists' : 'MISSING'} | Grid: ${grid ? `exists (${grid.length}x${grid[0]?.length})` : 'MISSING'}`);
            console.warn(`   Available rooms with pathfinding: ${Array.from(this.roomBounds.keys()).join(', ')}`);
            return null;
        }

        // Try up to 20 random positions
        const maxAttempts = 20;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const randTileX = bounds.x + Math.floor(Math.random() * bounds.width);
            const randTileY = bounds.y + Math.floor(Math.random() * bounds.height);

            // Validate indices
            if (randTileY < 0 || randTileY >= grid.length || randTileX < 0 || randTileX >= grid[0].length) {
                continue;
            }

            // Check if this tile is walkable
            if (grid[randTileY] && grid[randTileY][randTileX] === 0) {
                // Convert to world coordinates (center of tile)
                const worldX = bounds.worldX + randTileX * TILE_SIZE + TILE_SIZE / 2;
                const worldY = bounds.worldY + randTileY * TILE_SIZE + TILE_SIZE / 2;

                console.log(`✅ Random patrol target for ${roomId}: (${randTileX}, ${randTileY}) → (${worldX}, ${worldY})`);
                return { x: worldX, y: worldY };
            }
        }

        console.warn(`⚠️ Could not find valid random position in ${roomId} after ${maxAttempts} attempts`);
        console.warn(`   Bounds: x=${bounds.x}, y=${bounds.y}, width=${bounds.width}, height=${bounds.height}`);
        console.warn(`   Grid size: ${grid.length}x${grid[0]?.length}`);
        return null;
    }

    /**
     * Get pathfinder for a room (for debugging)
     */
    getPathfinder(roomId) {
        return this.pathfinders.get(roomId);
    }

    /**
     * Get grid for a room (for debugging)
     */
    getGrid(roomId) {
        return this.grids.get(roomId);
    }

    /**
     * Get bounds for a room (for debugging)
     */
    getBounds(roomId) {
        return this.roomBounds.get(roomId);
    }

    /**
     * Mark door tiles as walkable in the pathfinding grid
     * Called when a door is unlocked/opened
     * 
     * @param {string} roomId - Room containing the door
     * @param {number} worldX - World X position of door
     * @param {number} worldY - World Y position of door
     * @param {string} direction - Door direction (north/south/east/west)
     */
    markDoorWalkable(roomId, worldX, worldY, direction) {
        const grid = this.grids.get(roomId);
        const pathfinder = this.pathfinders.get(roomId);
        const bounds = this.roomBounds.get(roomId);

        if (!grid || !pathfinder || !bounds) {
            console.warn(`⚠️ Cannot update door pathfinding - room ${roomId} not initialized`);
            return;
        }

        // Convert world coordinates to tile coordinates
        const tileX = Math.floor((worldX - bounds.worldX) / TILE_SIZE);
        const tileY = Math.floor((worldY - bounds.worldY) / TILE_SIZE);

        // Mark door tiles as walkable (typically 2 tiles for a door)
        const tilesToMark = [];
        
        switch (direction) {
            case 'north':
            case 'south':
                // Horizontal door - 2 tiles wide
                tilesToMark.push({ x: tileX, y: tileY });
                tilesToMark.push({ x: tileX + 1, y: tileY });
                break;
            case 'east':
            case 'west':
                // Vertical door - 2 tiles high
                tilesToMark.push({ x: tileX, y: tileY });
                tilesToMark.push({ x: tileX, y: tileY + 1 });
                break;
        }

        let markedCount = 0;
        tilesToMark.forEach(tile => {
            if (tile.y >= 0 && tile.y < grid.length && 
                tile.x >= 0 && tile.x < grid[0].length) {
                if (grid[tile.y][tile.x] === 1) {
                    grid[tile.y][tile.x] = 0; // Mark as walkable
                    markedCount++;
                }
            }
        });

        // Update the pathfinder with the new grid
        pathfinder.setGrid(grid);

        console.log(`✅ Marked ${markedCount} door tiles as walkable in ${roomId} at (${tileX}, ${tileY}) direction: ${direction}`);
    }
}

// Export as global for easy access
window.NPCPathfindingManager = NPCPathfindingManager;
