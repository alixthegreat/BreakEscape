# Scenario Validation System

## Overview

Validation ensures scenarios are correctly configured before the game starts. This catches authoring errors early and provides clear feedback.

## Validation Checks

### 1. Room Size Validation

**Check**: All rooms are sized in multiples of grid units

```javascript
function validateRoomSize(roomId, dimensions) {
    const { widthTiles, heightTiles } = dimensions;

    // Check width is multiple of 5
    const validWidth = (widthTiles % GRID_UNIT_WIDTH_TILES) === 0;

    // Check height: total height should be (gridUnits × 4) + 2 visual tiles
    const stackingHeight = heightTiles - VISUAL_TOP_TILES;
    const validHeight = (stackingHeight % GRID_UNIT_HEIGHT_TILES) === 0;

    if (!validWidth || !validHeight) {
        console.error(`❌ Invalid room size: ${roomId}`);
        console.error(`   Size: ${widthTiles}×${heightTiles} tiles`);
        console.error(`   Width must be multiple of ${GRID_UNIT_WIDTH_TILES} tiles`);
        console.error(`   Height must be (N×${GRID_UNIT_HEIGHT_TILES})+${VISUAL_TOP_TILES} tiles`);
        return false;
    }

    console.log(`✅ Room size valid: ${roomId} (${widthTiles}×${heightTiles} tiles)`);
    return true;
}
```

### 2. Grid Alignment Validation

**Check**: All room positions align to grid boundaries

```javascript
function validateGridAlignment(roomId, position) {
    const { x, y } = position;

    const alignedX = (x % GRID_UNIT_WIDTH_PX) === 0;
    const alignedY = (y % GRID_UNIT_HEIGHT_PX) === 0;

    if (!alignedX || !alignedY) {
        console.error(`❌ Room not grid-aligned: ${roomId}`);
        console.error(`   Position: (${x}, ${y})`);
        console.error(`   Expected multiples of (${GRID_UNIT_WIDTH_PX}, ${GRID_UNIT_HEIGHT_PX})`);

        // Calculate nearest aligned position
        const nearestX = Math.round(x / GRID_UNIT_WIDTH_PX) * GRID_UNIT_WIDTH_PX;
        const nearestY = Math.round(y / GRID_UNIT_HEIGHT_PX) * GRID_UNIT_HEIGHT_PX;
        console.error(`   Nearest valid: (${nearestX}, ${nearestY})`);

        return false;
    }

    return true;
}
```

### 3. Room Overlap Detection

**Check**: No two rooms occupy the same grid space

```javascript
function detectRoomOverlaps(positions, dimensions) {
    console.log('\n=== Room Overlap Detection ===');

    const roomIds = Object.keys(positions);
    const overlaps = [];

    for (let i = 0; i < roomIds.length; i++) {
        for (let j = i + 1; j < roomIds.length; j++) {
            const room1Id = roomIds[i];
            const room2Id = roomIds[j];

            const overlap = checkOverlap(
                positions[room1Id],
                dimensions[room1Id],
                positions[room2Id],
                dimensions[room2Id]
            );

            if (overlap) {
                overlaps.push({ room1: room1Id, room2: room2Id, ...overlap });
            }
        }
    }

    if (overlaps.length > 0) {
        console.error(`❌ Found ${overlaps.length} room overlaps:`);
        overlaps.forEach(overlap => {
            console.error(`   ${overlap.room1} ↔ ${overlap.room2}`);
            console.error(`     Overlap area: ${overlap.width}×${overlap.height} pixels`);
            console.error(`     Overlap position: (${overlap.x}, ${overlap.y})`);
        });
    } else {
        console.log('✅ No room overlaps detected');
    }

    return overlaps;
}

function checkOverlap(pos1, dim1, pos2, dim2) {
    // Use stacking height for overlap calculation
    const r1 = {
        left: pos1.x,
        right: pos1.x + dim1.widthPx,
        top: pos1.y,
        bottom: pos1.y + dim1.stackingHeightPx
    };

    const r2 = {
        left: pos2.x,
        right: pos2.x + dim2.widthPx,
        top: pos2.y,
        bottom: pos2.y + dim2.stackingHeightPx
    };

    // Check for overlap
    const noOverlap = (
        r1.right <= r2.left ||
        r2.right <= r1.left ||
        r1.bottom <= r2.top ||
        r2.bottom <= r1.top
    );

    if (noOverlap) {
        return null; // No overlap
    }

    // Calculate overlap area
    const overlapX = Math.max(r1.left, r2.left);
    const overlapY = Math.max(r1.top, r2.top);
    const overlapWidth = Math.min(r1.right, r2.right) - overlapX;
    const overlapHeight = Math.min(r1.bottom, r2.bottom) - overlapY;

    return {
        x: overlapX,
        y: overlapY,
        width: overlapWidth,
        height: overlapHeight
    };
}
```

### 4. Connection Reciprocity Validation

**Check**: All connections are bidirectional

```javascript
function validateConnections(gameScenario) {
    console.log('\n=== Connection Validation ===');

    const errors = [];

    Object.entries(gameScenario.rooms).forEach(([roomId, roomData]) => {
        if (!roomData.connections) return;

        Object.entries(roomData.connections).forEach(([direction, connected]) => {
            const connectedRooms = Array.isArray(connected) ? connected : [connected];

            connectedRooms.forEach(connectedRoomId => {
                // Check if connected room exists
                if (!gameScenario.rooms[connectedRoomId]) {
                    errors.push({
                        type: 'missing_room',
                        from: roomId,
                        to: connectedRoomId,
                        direction
                    });
                    return;
                }

                // Check if connection is reciprocal
                const oppositeDir = getOppositeDirection(direction);
                const connectedRoomData = gameScenario.rooms[connectedRoomId];

                if (!connectedRoomData.connections) {
                    errors.push({
                        type: 'missing_reciprocal',
                        from: roomId,
                        to: connectedRoomId,
                        direction,
                        expected: oppositeDir
                    });
                    return;
                }

                const reciprocalConnection = connectedRoomData.connections[oppositeDir];
                if (!reciprocalConnection) {
                    errors.push({
                        type: 'missing_reciprocal',
                        from: roomId,
                        to: connectedRoomId,
                        direction,
                        expected: oppositeDir
                    });
                    return;
                }

                // Check if this room is in the reciprocal connection
                const reciprocalRooms = Array.isArray(reciprocalConnection)
                    ? reciprocalConnection
                    : [reciprocalConnection];

                if (!reciprocalRooms.includes(roomId)) {
                    errors.push({
                        type: 'mismatched_reciprocal',
                        from: roomId,
                        to: connectedRoomId,
                        direction,
                        expected: oppositeDir,
                        actual: reciprocalRooms
                    });
                }
            });
        });
    });

    if (errors.length > 0) {
        console.error(`❌ Found ${errors.length} connection errors:`);
        errors.forEach(error => {
            if (error.type === 'missing_room') {
                console.error(`   ${error.from} → ${error.to}: Room does not exist`);
            } else if (error.type === 'missing_reciprocal') {
                console.error(`   ${error.from} → ${error.to} (${error.direction}): Missing reciprocal connection (${error.expected})`);
            } else if (error.type === 'mismatched_reciprocal') {
                console.error(`   ${error.from} → ${error.to} (${error.direction}): Reciprocal doesn't point back (expected ${error.from}, found ${error.actual})`);
            }
        });
    } else {
        console.log('✅ All connections are valid and reciprocal');
    }

    return errors;
}

function getOppositeDirection(direction) {
    const opposites = {
        'north': 'south',
        'south': 'north',
        'east': 'west',
        'west': 'east'
    };
    return opposites[direction];
}
```

### 5. Door Alignment Validation

**Check**: Doors between connected rooms align perfectly

```javascript
function validateDoorAlignment(allDoors) {
    console.log('\n=== Door Alignment Validation ===');

    const errors = [];
    const tolerance = 1; // 1px tolerance for floating point

    // Build a map of door pairs (connections)
    const doorPairs = new Map();

    allDoors.forEach(door => {
        const key = door.roomId < door.connectedRoom
            ? `${door.roomId}:${door.connectedRoom}`
            : `${door.connectedRoom}:${door.roomId}`;

        if (!doorPairs.has(key)) {
            doorPairs.set(key, []);
        }
        doorPairs.get(key).push(door);
    });

    // Check each pair
    doorPairs.forEach((doors, pairKey) => {
        if (doors.length !== 2) {
            console.error(`❌ Connection ${pairKey} has ${doors.length} doors (expected 2)`);
            errors.push({
                type: 'door_count_mismatch',
                connection: pairKey,
                count: doors.length
            });
            return;
        }

        const [door1, door2] = doors;

        const deltaX = Math.abs(door1.x - door2.x);
        const deltaY = Math.abs(door1.y - door2.y);

        if (deltaX > tolerance || deltaY > tolerance) {
            console.error(`❌ Door misalignment: ${pairKey}`);
            console.error(`   Door 1: (${door1.x}, ${door1.y}) in ${door1.roomId}`);
            console.error(`   Door 2: (${door2.x}, ${door2.y}) in ${door2.roomId}`);
            console.error(`   Delta: (${deltaX}, ${deltaY})`);

            errors.push({
                type: 'door_misalignment',
                connection: pairKey,
                door1: { roomId: door1.roomId, x: door1.x, y: door1.y },
                door2: { roomId: door2.roomId, x: door2.x, y: door2.y },
                delta: { x: deltaX, y: deltaY }
            });
        }
    });

    if (errors.length === 0) {
        console.log(`✅ All ${doorPairs.size} door connections are properly aligned`);
    }

    return errors;
}
```

### 6. Starting Room Validation

**Check**: Starting room exists and is valid

```javascript
function validateStartingRoom(gameScenario) {
    console.log('\n=== Starting Room Validation ===');

    const startRoom = gameScenario.startRoom;

    if (!startRoom) {
        console.error('❌ No starting room defined in scenario');
        return false;
    }

    if (!gameScenario.rooms[startRoom]) {
        console.error(`❌ Starting room "${startRoom}" does not exist`);
        return false;
    }

    console.log(`✅ Starting room "${startRoom}" is valid`);
    return true;
}
```

## Complete Validation Pipeline

```javascript
function validateScenario(gameScenario, positions, dimensions, allDoors) {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  SCENARIO VALIDATION                   ║');
    console.log('╚════════════════════════════════════════╝\n');

    const results = {
        valid: true,
        errors: [],
        warnings: []
    };

    // 1. Validate starting room
    if (!validateStartingRoom(gameScenario)) {
        results.valid = false;
        results.errors.push('Invalid starting room');
    }

    // 2. Validate room sizes
    Object.entries(dimensions).forEach(([roomId, dim]) => {
        if (!validateRoomSize(roomId, dim)) {
            results.valid = false;
            results.errors.push(`Invalid room size: ${roomId}`);
        }
    });

    // 3. Validate grid alignment
    Object.entries(positions).forEach(([roomId, pos]) => {
        if (!validateGridAlignment(roomId, pos)) {
            results.warnings.push(`Room not grid-aligned: ${roomId}`);
            // Not a fatal error, but should be fixed
        }
    });

    // 4. Detect room overlaps
    const overlaps = detectRoomOverlaps(positions, dimensions);
    if (overlaps.length > 0) {
        results.errors.push(`${overlaps.length} room overlaps detected`);
        // Continue despite overlaps (per requirements)
    }

    // 5. Validate connections
    const connectionErrors = validateConnections(gameScenario);
    if (connectionErrors.length > 0) {
        results.valid = false;
        results.errors.push(`${connectionErrors.length} connection errors`);
    }

    // 6. Validate door alignment
    const doorErrors = validateDoorAlignment(allDoors);
    if (doorErrors.length > 0) {
        results.valid = false;
        results.errors.push(`${doorErrors.length} door alignment errors`);
    }

    // Print summary
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  VALIDATION SUMMARY                    ║');
    console.log('╚════════════════════════════════════════╝\n');

    if (results.errors.length === 0 && results.warnings.length === 0) {
        console.log('✅ All validation checks passed!');
    } else {
        if (results.errors.length > 0) {
            console.error(`❌ ${results.errors.length} errors found:`);
            results.errors.forEach(err => console.error(`   - ${err}`));
        }

        if (results.warnings.length > 0) {
            console.warn(`⚠️  ${results.warnings.length} warnings:`);
            results.warnings.forEach(warn => console.warn(`   - ${warn}`));
        }
    }

    console.log('');

    return results;
}
```

## When to Run Validation

```javascript
// In initializeRooms() function in js/core/rooms.js

export function initializeRooms(gameInstance) {
    gameRef = gameInstance;
    console.log('Initializing rooms');

    // ... existing setup code ...

    // Calculate room positions
    window.roomPositions = calculateRoomPositions(gameInstance);

    // Extract dimensions for validation
    const dimensions = extractAllRoomDimensions(gameInstance);

    // Calculate all door positions (before creating sprites)
    const allDoors = calculateAllDoorPositions(
        window.gameScenario,
        window.roomPositions,
        dimensions
    );

    // VALIDATE SCENARIO
    const validationResults = validateScenario(
        window.gameScenario,
        window.roomPositions,
        dimensions,
        allDoors
    );

    // Store validation results for debugging
    window.scenarioValidation = validationResults;

    // Continue initialization even if validation fails
    // (per requirements: log error but attempt to continue)

    // ... rest of initialization ...
}
```

## Error Reporting

Validation errors should be clear and actionable:

```
❌ OVERLAP DETECTED: room1 and room2
   room1: (0, 0) 320×192px
   room2: (160, 0) 320×192px
   Overlap area: 160×192 pixels at (160, 0)

   SUGGESTED FIX:
   - Move room2 to (320, 0) to eliminate overlap
   - Or reduce room sizes to fit
```

## Development Tools

Add console commands for testing:

```javascript
// Check scenario validation results
window.checkScenario = function() {
    if (window.scenarioValidation) {
        console.log(window.scenarioValidation);
    } else {
        console.log('No validation results available');
    }
};

// Visualize room bounds
window.showRoomBounds = function() {
    // Draw debug rectangles around each room's stacking area
    // Useful for identifying overlaps visually
};
```
