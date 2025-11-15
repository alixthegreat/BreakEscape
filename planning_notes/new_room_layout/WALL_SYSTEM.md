# Wall and Collision System

## Overview

The wall system creates invisible collision boxes at room boundaries to prevent the player from walking through walls. Doors remove these collision boxes to create passages between rooms.

## Current Implementation

Located in `js/systems/collision.js`:
- `createWallCollisionBoxes()` - Creates collision rectangles for wall tiles
- `removeTilesUnderDoor()` - Removes wall tiles where doors are placed

## Wall Placement

### Wall Edges

Rooms have walls on all four sides:

```
WWWWWWWWWW    <- North wall (top 2 rows, visual only)
WWWWWWWWWW
WFFFFFFFFW    <- West/East walls (1 tile each side)
WFFFFFFFFW       North wall collision starts here
WFFFFFFFFW
WFFFFFFFFW
WFFFFFFFFW
WFFFFFFFFW    <- South wall (bottom row)
```

### Collision Box Placement

Collision boxes are thin rectangles placed at the boundary between wall and floor:

```javascript
// North wall: Top 2 rows (visual wall)
// Collision box at bottom edge of row 2
if (tileY < 2) {
    createCollisionBox(
        worldX + TILE_SIZE / 2,       // Center of tile
        worldY + TILE_SIZE - 4,        // 4px from bottom
        TILE_SIZE,                     // Full tile width
        8                              // 8px thick
    );
}

// South wall: Bottom row
// Collision box at bottom edge
if (tileY === mapHeight - 1) {
    createCollisionBox(
        worldX + TILE_SIZE / 2,
        worldY + TILE_SIZE - 4,
        TILE_SIZE,
        8
    );
}

// West wall: Left column
// Collision box at right edge
if (tileX === 0) {
    createCollisionBox(
        worldX + TILE_SIZE - 4,        // 4px from right edge
        worldY + TILE_SIZE / 2,        // Center of tile
        8,                             // 8px thick
        TILE_SIZE                      // Full tile height
    );
}

// East wall: Right column
// Collision box at left edge
if (tileX === mapWidth - 1) {
    createCollisionBox(
        worldX + 4,                    // 4px from left edge
        worldY + TILE_SIZE / 2,
        8,
        TILE_SIZE
    );
}
```

## Changes Needed for Variable Room Sizes

### Current Issue

The current implementation assumes all rooms are 10×10 tiles. Wall detection uses hardcoded checks:

```javascript
// Current code
if (tileY < 2) { /* north wall */ }
if (tileY === map.height - 1) { /* south wall */ }
if (tileX === 0) { /* west wall */ }
if (tileX === map.width - 1) { /* east wall */ }
```

This works correctly and should continue to work for variable room sizes!

### No Changes Needed

The wall collision system is **already compatible** with variable room sizes:

- Uses `map.width` and `map.height` from Tiled JSON
- Dynamically detects edges based on actual room dimensions
- Creates collision boxes for each wall tile

The current implementation in `js/systems/collision.js` lines 22-151 should work without modification.

## Door Integration

### Removing Wall Tiles

When doors are created, wall tiles must be removed:

```javascript
function removeTilesUnderDoor(wallLayer, doorX, doorY, doorWidth, doorHeight) {
    // Convert world coordinates to layer tile coordinates
    const layerTileX = Math.floor((doorX - wallLayer.x) / TILE_SIZE);
    const layerTileY = Math.floor((doorY - wallLayer.y) / TILE_SIZE);

    // Calculate how many tiles the door spans
    const tilesWide = Math.ceil(doorWidth / TILE_SIZE);
    const tilesTall = Math.ceil(doorHeight / TILE_SIZE);

    // Remove tiles in door area
    for (let x = 0; x < tilesWide; x++) {
        for (let y = 0; y < tilesTall; y++) {
            const tileX = layerTileX + x;
            const tileY = layerTileY + y;

            const tile = wallLayer.getTileAt(tileX, tileY);
            if (tile) {
                wallLayer.removeTileAt(tileX, tileY);
                console.log(`Removed wall tile at (${tileX}, ${tileY}) for door`);
            }
        }
    }
}
```

### Current Implementation

The current `removeTilesUnderDoor()` function in `js/systems/collision.js` (lines 154-335):
- Calculates door positions using same logic as door sprites
- Converts door world coordinates to tile coordinates
- Removes tiles in door area

**This should continue to work** with the new positioning system, as long as door positions are calculated correctly.

### Updates Needed

The door positioning logic in `removeTilesUnderDoor()` must match the new door placement algorithm:

1. **Update door position calculation** to use new algorithm (from DOOR_PLACEMENT.md)
2. **Remove hardcoded positioning logic** (lines 195-283 currently duplicate door placement)
3. **Use shared door calculation** function instead

## Collision Box Management

### Creation During Room Load

```javascript
export function createRoom(roomId, roomData, position) {
    // ... create room layers ...

    // Create wall collision boxes
    wallsLayers.forEach(wallLayer => {
        createWallCollisionBoxes(wallLayer, roomId, position);
    });

    // Create door sprites (which remove wall tiles/collisions)
    const doorSprites = createDoorSpritesForRoom(roomId, position);

    // ... rest of room creation ...
}
```

### Door-Specific Removal

When a door is opened, wall collisions in that area are already removed (tiles removed). When door sprite has collision physics, closing the door is done by the door sprite's collision box.

### Room-Specific Collision

Each room maintains its own collision boxes:

```javascript
rooms[roomId] = {
    map,
    layers,
    wallsLayers,
    wallCollisionBoxes: [], // All collision boxes for this room
    doorSprites: [],
    objects: {},
    position
};
```

## Testing Wall Collisions

### Visual Debug Mode

Add ability to visualize collision boxes:

```javascript
window.showWallCollisions = function() {
    Object.values(rooms).forEach(room => {
        if (room.wallCollisionBoxes) {
            room.wallCollisionBoxes.forEach(box => {
                box.setVisible(true);
                box.setAlpha(0.3);
                box.setFillStyle(0xff0000); // Red
            });
        }
    });
};

window.hideWallCollisions = function() {
    Object.values(rooms).forEach(room => {
        if (room.wallCollisionBoxes) {
            room.wallCollisionBoxes.forEach(box => {
                box.setVisible(false);
            });
        }
    });
};
```

### Test Cases

1. **Player vs Wall**: Walk into walls, should not pass through
2. **Player vs Door**: Walk through open door, should pass
3. **Player vs Closed Door**: Walk into closed door, should not pass
4. **Different Room Sizes**: Test walls work for small, standard, and large rooms
5. **Room Boundaries**: Test at edges where rooms connect

## Implementation Notes

### Order of Operations

Critical: Wall collision boxes must be created **before** door tiles are removed:

```javascript
// Correct order:
1. Create room layers
2. Create wall collision boxes (for all wall tiles)
3. Create door sprites
4. Remove tiles under doors (removes some collision boxes)

// If done wrong:
1. Create room layers
2. Create door sprites
3. Remove tiles under doors
4. Create wall collision boxes <- Would create boxes where doors are!
```

The current implementation does this correctly.

### Edge Cases

#### Rooms with Shared Walls

When two rooms are adjacent (east-west connection):

```
[Room1][Room2]
       ^^
    Shared edge
```

- Room1 has east wall collision
- Room2 has west wall collision
- These are at the same location
- Both are removed when door is created
- Works correctly (two collision boxes at same spot is fine)

#### Overlapping Visual Walls

When rooms stack north-south:

```
[Room2]  <- Bottom 2 rows visible
[Room1]  <- Top 2 rows visible
```

- Room1's north wall (visual) overlaps Room2's south area
- Collision is only on Room1's floor edge (row 2 bottom)
- Room2's south wall collision is at its bottom edge
- No conflict, works correctly

## Summary

### What Works Already
- Dynamic wall detection based on room size
- Collision box creation at wall edges
- Player collision with walls
- Door removal of wall tiles

### What Needs Updates
- Door position calculation in `removeTilesUnderDoor()` must use new algorithm
- Remove duplicate door positioning logic
- Ensure door positions match between `createDoorSpritesForRoom()` and `removeTilesUnderDoor()`

### What Stays the Same
- Collision box placement logic
- Wall edge detection
- Collision thickness (8px)
- Order of operations
