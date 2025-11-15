# Implementation Recommendations

## Priority 1: Critical Fixes (Must Implement Before Starting)

### Fix 1: Resolve Grid Height Ambiguity

**Problem**: Current spec creates fractional grid units (1.5, 2.5)

**Solution**: Redefine grid unit to match actual room tile counts

**Recommended Approach**:

Keep the grid unit as **5 tiles wide × 4 tiles tall** for the **stacking area**, but clarify the total room heights:

| Room Type | Total Tiles (W×H) | Grid Units | Calculation |
|-----------|-------------------|------------|-------------|
| Closet | 5×6 | 1×1 | Visual(2) + Stackable(4×1) = 6 |
| Standard | 10×10 | 2×2 | Visual(2) + Stackable(4×2) = 10 |
| Wide Hall | 20×6 | 4×1 | Visual(2) + Stackable(4×1) = 6 |
| Tall Room | 10×14 | 2×3 | Visual(2) + Stackable(4×3) = 14 |

**Formula**:
```javascript
totalHeight = VISUAL_TOP_TILES + (gridHeight × GRID_UNIT_HEIGHT_TILES)
totalHeight = 2 + (gridHeight × 4)

// Examples:
// 1×1 grid: 2 + (1 × 4) = 6 tiles
// 2×2 grid: 2 + (2 × 4) = 10 tiles
// 2×3 grid: 2 + (3 × 4) = 14 tiles
```

**Validation Function**:
```javascript
function validateRoomSize(roomId, dimensions) {
    const { widthTiles, heightTiles } = dimensions;

    // Width must be multiple of 5
    const validWidth = (widthTiles % GRID_UNIT_WIDTH_TILES) === 0;

    // Height must be 2 + (N × 4) where N is whole number
    const stackingHeight = heightTiles - VISUAL_TOP_TILES;
    const validHeight = (stackingHeight % GRID_UNIT_HEIGHT_TILES) === 0 &&
                        stackingHeight > 0;

    if (!validWidth) {
        console.error(`❌ Invalid width: ${roomId} is ${widthTiles} tiles (must be multiple of 5)`);
    }

    if (!validHeight) {
        console.error(`❌ Invalid height: ${roomId} is ${heightTiles} tiles`);
        console.error(`   Must be 2 + (N × 4) where N >= 1`);
        console.error(`   Valid heights: 6, 10, 14, 18, 22, ...`);
    }

    return validWidth && validHeight;
}
```

---

### Fix 2: Door Alignment for Asymmetric Connections

**Problem**: When small room connects to large room with multiple children, deterministic placement may cause misalignment.

**Example**:
```
    [R2][R3]    <- R1 has 2 north connections
    [--R1--]    <- R1 is at grid (0, -2)
    [--R0--]    <- R0 is at grid (0, 0)
```

R1's south door uses `(0 + -2) % 2 = 0` → **left side**
R0's north door uses `(0 + 0) % 2 = 0` → **left side**
✅ They align!

**But consider**:
```
    [R2][R3]    <- R1 has 2 north connections
    [-R1--]     <- R1 is at grid (-1, -2) (offset to align with children)
    [--R0--]    <- R0 is at grid (0, 0)
```

R1's south door uses `(-1 + -2) % 2 = 1` → **right side**
R0's north door uses `(0 + 0) % 2 = 0` → **left side**
❌ They DON'T align!

**Solution**: When positioning single door, check if connected room has multiple connections in opposite direction

```javascript
function placeNorthDoorSingle(roomId, roomPosition, roomDimensions, gridCoords, connectedRoom, gameScenario) {
    const roomWidthPx = roomDimensions.widthPx;

    // Check if the connected room has multiple south connections
    const connectedRoomData = gameScenario.rooms[connectedRoom];
    const connectedRoomSouthConnections = connectedRoomData?.connections?.south;

    let useRightSide;

    if (Array.isArray(connectedRoomSouthConnections) && connectedRoomSouthConnections.length > 1) {
        // Connected room has multiple south doors
        // Find which index this room is in that array
        const indexInArray = connectedRoomSouthConnections.indexOf(roomId);

        if (indexInArray >= 0) {
            // Calculate door position to match the connected room's door layout
            // This room's door must align with one of the connected room's doors

            // Instead of using grid coords, calculate which side based on index
            // For multiple doors in connected room, they're spaced evenly
            // We need to match the corresponding door position

            // Get connected room dimensions and position
            const connectedPos = window.roomPositions[connectedRoom];
            const connectedDim = getRoomDimensions(connectedRoom, connectedRoomData, gameRef);

            // Calculate where the connected room's door is
            // Using the same logic as placeSouthDoorsMultiple
            const edgeInset = TILE_SIZE * 1.5;
            const availableWidth = connectedDim.widthPx - (edgeInset * 2);
            const doorCount = connectedRoomSouthConnections.length;
            const doorSpacing = availableWidth / (doorCount - 1);

            const connectedDoorX = connectedPos.x + edgeInset + (doorSpacing * indexInArray);

            // This room's door X must match
            const doorX = connectedDoorX;
            const doorY = roomPosition.y + TILE_SIZE;

            return { x: doorX, y: doorY };
        }
    }

    // Default: Use deterministic placement based on grid coordinates
    useRightSide = (gridCoords.x + gridCoords.y) % 2 === 1;

    let doorX;
    if (useRightSide) {
        doorX = roomPosition.x + roomWidthPx - (TILE_SIZE * 1.5);
    } else {
        doorX = roomPosition.x + (TILE_SIZE * 1.5);
    }

    const doorY = roomPosition.y + TILE_SIZE;
    return { x: doorX, y: doorY };
}
```

**Apply same logic to**:
- placeSouthDoorSingle
- placeEastDoorSingle
- placeWestDoorSingle

This ensures doors ALWAYS align when connecting to room with multiple doors.

---

### Fix 3: Create Shared Door Positioning Module

**Problem**: Door positions calculated in multiple places

**Solution**: Create single source of truth

**File**: `js/systems/door-positioning.js` (new file)

```javascript
/**
 * DOOR POSITIONING SYSTEM
 * ========================
 *
 * Centralized door position calculations used by:
 * - Door sprite creation (doors.js)
 * - Wall tile removal (collision.js)
 * - Validation (validation.js)
 *
 * Ensures consistency across all systems.
 */

import { TILE_SIZE, GRID_UNIT_WIDTH_PX, GRID_UNIT_HEIGHT_PX } from '../utils/constants.js';

/**
 * Calculate all door positions for a room
 *
 * Returns array of door objects with:
 * - roomId: Source room
 * - connectedRoom: Destination room
 * - direction: north/south/east/west
 * - x, y: World position
 *
 * @param {string} roomId
 * @param {Object} roomPosition - {x, y}
 * @param {Object} roomDimensions
 * @param {Object} connections - Room connections from scenario
 * @param {Object} allPositions - All room positions
 * @param {Object} allDimensions - All room dimensions
 * @param {Object} gameScenario - Full scenario for cross-referencing
 * @returns {Array} Array of door position objects
 */
export function calculateDoorPositions(roomId, roomPosition, roomDimensions,
                                      connections, allPositions, allDimensions,
                                      gameScenario) {
    const doors = [];
    const gridCoords = worldToGrid(roomPosition.x, roomPosition.y);

    // Process each direction
    ['north', 'south', 'east', 'west'].forEach(direction => {
        if (!connections[direction]) return;

        const connected = connections[direction];
        const connectedRooms = Array.isArray(connected) ? connected : [connected];

        let doorPositions;

        // Calculate door positions based on direction and count
        if (direction === 'north') {
            doorPositions = connectedRooms.length === 1
                ? [placeNorthDoorSingle(roomId, roomPosition, roomDimensions, gridCoords,
                                       connectedRooms[0], gameScenario)]
                : placeNorthDoorsMultiple(roomId, roomPosition, roomDimensions, connectedRooms);
        }
        // ... similar for other directions

        // Add to doors array with metadata
        doorPositions.forEach((doorPos, index) => {
            doors.push({
                roomId,
                connectedRoom: connectedRooms[index] || doorPos.connectedRoom,
                direction,
                x: doorPos.x,
                y: doorPos.y
            });
        });
    });

    return doors;
}

// Export individual placement functions for testing
export {
    placeNorthDoorSingle,
    placeNorthDoorsMultiple,
    placeSouthDoorSingle,
    placeSouthDoorsMultiple,
    placeEastDoorSingle,
    placeEastDoorsMultiple,
    placeWestDoorSingle,
    placeWestDoorsMultiple
};
```

**Update dependent files**:
- `doors.js`: Import and use calculateDoorPositions
- `collision.js`: Import and use calculateDoorPositions
- Both files use same function → guaranteed alignment

---

### Fix 4: Validate Disconnected Rooms

**Problem**: Rooms with no connections won't be positioned

**Solution**: Add validation check

```javascript
function validateConnectivity(gameScenario, positions) {
    console.log('\n=== Connectivity Validation ===');

    const allRoomIds = Object.keys(gameScenario.rooms);
    const positionedRoomIds = Object.keys(positions);

    const disconnectedRooms = allRoomIds.filter(id => !positionedRoomIds.includes(id));

    if (disconnectedRooms.length > 0) {
        console.warn(`⚠️  Found ${disconnectedRooms.length} disconnected rooms:`);
        disconnectedRooms.forEach(roomId => {
            console.warn(`   - ${roomId} (has no path from starting room)`);
        });

        return false;
    }

    console.log(`✅ All ${allRoomIds.length} rooms are connected`);
    return true;
}
```

**Add to validation pipeline** in `validateScenario()`

---

## Priority 2: High Priority Improvements

### Improvement 1: Feature Flag for Gradual Migration

**Implementation**:

```javascript
// In constants.js
export const USE_NEW_ROOM_LAYOUT = true; // Feature flag

// In rooms.js
export function calculateRoomPositions(gameInstance) {
    if (USE_NEW_ROOM_LAYOUT) {
        return calculateRoomPositionsV2(gameInstance);
    } else {
        return calculateRoomPositionsV1(gameInstance);
    }
}

function calculateRoomPositionsV2(gameInstance) {
    // New implementation
}

function calculateRoomPositionsV1(gameInstance) {
    // Old implementation (keep for safety)
}
```

**Benefits**:
- Easy rollback if critical bug found
- A/B testing
- Gradual migration per scenario

---

### Improvement 2: Add Minimum Height Validation for E/W Doors

**Problem**: Small rooms may not have space for two E/W doors

**Solution**:

```javascript
function validateEastWestDoorSpace(roomId, dimensions, connections) {
    const minHeightForMultipleDoors = 8; // tiles

    ['east', 'west'].forEach(direction => {
        if (!connections[direction]) return;

        const connected = connections[direction];
        const connectedRooms = Array.isArray(connected) ? connected : [connected];

        if (connectedRooms.length > 1 && dimensions.heightTiles < minHeightForMultipleDoors) {
            console.error(`❌ Room ${roomId} is too short for multiple ${direction} doors`);
            console.error(`   Height: ${dimensions.heightTiles} tiles`);
            console.error(`   Minimum: ${minHeightForMultipleDoors} tiles for ${connectedRooms.length} doors`);
            return false;
        }
    });

    return true;
}
```

**Add to validation pipeline**

---

### Improvement 3: Structured Validation Report

**Implementation**:

```javascript
class ValidationReport {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
        this.timestamp = Date.now();
    }

    addError(type, message, details = {}) {
        this.errors.push({ type, message, details });
    }

    addWarning(type, message, details = {}) {
        this.warnings.push({ type, message, details });
    }

    addInfo(type, message, details = {}) {
        this.info.push({ type, message, details });
    }

    isValid() {
        return this.errors.length === 0;
    }

    getSummary() {
        return {
            valid: this.isValid(),
            errorCount: this.errors.length,
            warningCount: this.warnings.length,
            summary: `${this.errors.length} errors, ${this.warnings.length} warnings`
        };
    }

    print() {
        console.log('\n╔════════════════════════════════════════╗');
        console.log('║  SCENARIO VALIDATION REPORT            ║');
        console.log('╚════════════════════════════════════════╝\n');

        if (this.errors.length > 0) {
            console.error(`❌ ERRORS (${this.errors.length}):`);
            this.errors.forEach(err => {
                console.error(`   ${err.type}: ${err.message}`);
                if (Object.keys(err.details).length > 0) {
                    console.error(`      Details:`, err.details);
                }
            });
            console.log('');
        }

        if (this.warnings.length > 0) {
            console.warn(`⚠️  WARNINGS (${this.warnings.length}):`);
            this.warnings.forEach(warn => {
                console.warn(`   ${warn.type}: ${warn.message}`);
            });
            console.log('');
        }

        if (this.errors.length === 0 && this.warnings.length === 0) {
            console.log('✅ All validation checks passed!\n');
        }

        console.log(this.getSummary().summary);
    }
}

// Usage in validateScenario:
function validateScenario(gameScenario, positions, dimensions, allDoors) {
    const report = new ValidationReport();

    // Validate starting room
    if (!validateStartingRoom(gameScenario)) {
        report.addError('missing_start_room', 'No valid starting room defined');
    }

    // ... other validations ...

    // Store and print
    report.print();
    return report;
}
```

---

### Improvement 4: Incremental Implementation Strategy

**Recommended Order**:

1. **Week 1: Foundation**
   - Add constants
   - Add helper functions
   - Add tests for helpers
   - **Commit**: "feat: Add grid unit system foundation"

2. **Week 2: North/South Positioning**
   - Implement north/south positioning only
   - Keep east/west as TODO
   - Test with existing scenarios (all use north/south)
   - **Commit**: "feat: Implement north/south room positioning"

3. **Week 3: East/West Support**
   - Add east/west positioning
   - Test with new scenarios
   - **Commit**: "feat: Add east/west room connections"

4. **Week 4: Door Placement**
   - Create door positioning module
   - Update door sprite creation
   - Update wall tile removal
   - **Commit**: "feat: Update door placement for variable sizes"

5. **Week 5: Validation**
   - Add validation system
   - Test with invalid scenarios
   - **Commit**: "feat: Add scenario validation system"

6. **Week 6: Testing & Polish**
   - Create test scenarios
   - Fix bugs
   - Add debug tools
   - Update documentation
   - **Commit**: "test: Add comprehensive test scenarios"
   - **Commit**: "docs: Update room layout documentation"

This allows:
- Early feedback
- Incremental testing
- Easier debugging
- Regular commits

---

## Priority 3: Medium Priority Enhancements

### Enhancement 1: Room Dimension Caching

```javascript
const dimensionCache = new Map();

function getRoomDimensions(roomId, roomData, gameInstance) {
    const cacheKey = `${roomId}_${roomData.type}`;

    if (dimensionCache.has(cacheKey)) {
        return dimensionCache.get(cacheKey);
    }

    // Calculate dimensions...
    const dimensions = { /* ... */ };

    dimensionCache.set(cacheKey, dimensions);
    return dimensions;
}

// Clear cache on scenario load
export function clearDimensionCache() {
    dimensionCache.clear();
}
```

---

### Enhancement 2: Debug Visualization

```javascript
window.showRoomLayout = function(showGrid = true, showLabels = true, showDoors = true) {
    const graphics = gameRef.add.graphics();
    graphics.setDepth(10000); // On top of everything

    Object.entries(window.roomPositions).forEach(([roomId, pos]) => {
        const dim = getRoomDimensions(roomId, gameScenario.rooms[roomId], gameRef);

        // Draw stacking area
        graphics.lineStyle(2, 0x00ff00, 1);
        graphics.strokeRect(pos.x, pos.y, dim.widthPx, dim.stackingHeightPx);

        // Draw visual overlap area
        graphics.lineStyle(1, 0xffff00, 0.5);
        graphics.strokeRect(pos.x, pos.y - VISUAL_TOP_TILES * TILE_SIZE,
                           dim.widthPx, VISUAL_TOP_TILES * TILE_SIZE);

        if (showLabels) {
            const text = gameRef.add.text(
                pos.x + dim.widthPx / 2,
                pos.y + dim.stackingHeightPx / 2,
                roomId,
                { fontSize: '16px', color: '#00ff00' }
            );
            text.setOrigin(0.5);
            text.setDepth(10001);
        }
    });

    if (showGrid) {
        // Draw grid overlay
        const bounds = calculateWorldBounds(gameRef);
        graphics.lineStyle(1, 0xff0000, 0.3);

        for (let x = bounds.x; x < bounds.x + bounds.width; x += GRID_UNIT_WIDTH_PX) {
            graphics.lineBetween(x, bounds.y, x, bounds.y + bounds.height);
        }

        for (let y = bounds.y; y < bounds.y + bounds.height; y += GRID_UNIT_HEIGHT_PX) {
            graphics.lineBetween(bounds.x, y, bounds.x + bounds.width, y);
        }
    }

    if (showDoors) {
        // Highlight door positions
        // ... draw door markers ...
    }

    window.debugGraphics = graphics; // Store for cleanup
};

window.hideRoomLayout = function() {
    if (window.debugGraphics) {
        window.debugGraphics.destroy();
        window.debugGraphics = null;
    }
};
```

---

## Summary of Changes to Implementation Plan

### Documents to Update

1. **GRID_SYSTEM.md**
   - Clarify total height formula: 2 + (N × 4)
   - Add validation formula
   - Add valid height table (6, 10, 14, 18, ...)

2. **POSITIONING_ALGORITHM.md**
   - No changes needed (works with integer grid units)

3. **DOOR_PLACEMENT.md**
   - Update all single door placement functions
   - Add logic to check connected room's multiple connections
   - Add door alignment for asymmetric cases

4. **VALIDATION.md**
   - Update room size validation
   - Add connectivity validation
   - Add E/W door space validation
   - Change report format to structured object

5. **IMPLEMENTATION_STEPS.md**
   - Add Phase 0: Create feature flag
   - Update Phase 2: Implement N/S first, E/W later
   - Add Phase 2.5: Create door positioning module
   - Update Phase 4: Use ValidationReport class
   - Add incremental testing steps

6. **TODO_LIST.md**
   - Add tasks for feature flag
   - Add tasks for incremental implementation
   - Add tasks for ValidationReport
   - Add tasks for shared door positioning module
   - Update door placement tasks with alignment logic

### New Documents to Create

7. **MIGRATION_GUIDE.md** (new)
   - How to update existing scenarios
   - How to create new room sizes
   - How to test scenarios
   - Common migration issues

8. **TROUBLESHOOTING.md** (new)
   - Common error messages
   - How to use debug tools
   - How to fix validation errors
   - FAQ

---

## Final Recommendation

**Implement in this order**:

1. ✅ Fix grid height calculation (document valid heights)
2. ✅ Create shared door positioning module
3. ✅ Fix door alignment for asymmetric connections
4. ✅ Add feature flag
5. ✅ Implement incrementally (N/S first, then E/W)
6. ✅ Add comprehensive validation
7. ✅ Test thoroughly
8. ✅ Create migration guide

This approach minimizes risk while maximizing success probability.
