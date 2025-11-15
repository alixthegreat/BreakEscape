# Room Layout System - Detailed TODO List

## Phase 1: Constants and Helper Functions ✓

### Task 1.1: Add Grid Unit Constants
- [ ] Open `js/utils/constants.js`
- [ ] Add `GRID_UNIT_WIDTH_TILES = 5`
- [ ] Add `GRID_UNIT_HEIGHT_TILES = 4`
- [ ] Add `VISUAL_TOP_TILES = 2`
- [ ] Add `GRID_UNIT_WIDTH_PX = GRID_UNIT_WIDTH_TILES * TILE_SIZE`
- [ ] Add `GRID_UNIT_HEIGHT_PX = GRID_UNIT_HEIGHT_TILES * TILE_SIZE`
- [ ] Export all new constants
- [ ] Test: Import in rooms.js and log values

### Task 1.2: Create Grid Conversion Functions
- [ ] Open `js/core/rooms.js`
- [ ] Add `tilesToGridUnits(widthTiles, heightTiles)` function
  - [ ] Calculate `gridWidth = floor(widthTiles / 5)`
  - [ ] Calculate `stackingHeight = heightTiles - 2`
  - [ ] Calculate `gridHeight = floor(stackingHeight / 4)`
  - [ ] Return object with gridWidth and gridHeight
  - [ ] Add comprehensive JSDoc comment
- [ ] Add `gridToWorld(gridX, gridY)` function
  - [ ] Calculate worldX = gridX * GRID_UNIT_WIDTH_PX
  - [ ] Calculate worldY = gridY * GRID_UNIT_HEIGHT_PX
  - [ ] Return object with x and y
  - [ ] Add JSDoc comment
- [ ] Add `worldToGrid(worldX, worldY)` function
  - [ ] Calculate gridX = floor(worldX / GRID_UNIT_WIDTH_PX)
  - [ ] Calculate gridY = floor(worldY / GRID_UNIT_HEIGHT_PX)
  - [ ] Return object with gridX and gridY
  - [ ] Add JSDoc comment
- [ ] Add `alignToGrid(worldX, worldY)` function
  - [ ] Round X to nearest grid boundary
  - [ ] Round Y to nearest grid boundary
  - [ ] Return aligned position
  - [ ] Add JSDoc comment
- [ ] Test: Create console tests for each function
  - [ ] Test tilesToGridUnits(5, 6) → {1, 1}
  - [ ] Test tilesToGridUnits(10, 8) → {2, ~2}
  - [ ] Test gridToWorld(0, 0) → {0, 0}
  - [ ] Test gridToWorld(1, 1) → {160, 128}
  - [ ] Test worldToGrid(160, 128) → {1, 1}
  - [ ] Test alignToGrid(150, 120) → {160, 128}

### Task 1.3: Create Room Dimension Extraction
- [ ] Add `getRoomDimensions(roomId, roomData, gameInstance)` function
  - [ ] Get tilemap from cache
  - [ ] Extract width/height from tilemap (try .json, .data, fallback)
  - [ ] Call tilesToGridUnits() to get grid dimensions
  - [ ] Calculate pixel dimensions
  - [ ] Calculate stacking height
  - [ ] Return comprehensive dimension object
  - [ ] Add detailed JSDoc comment
  - [ ] Add logging for dimensions
- [ ] Test with existing room types:
  - [ ] Test with room_office
  - [ ] Test with room_reception
  - [ ] Test with room_closet
  - [ ] Verify all dimension calculations

---

## Phase 2: Room Positioning Algorithm

### Task 2.1: Implement North Positioning
- [ ] Add `positionNorthSingle(currentRoom, connectedRoom, currentPos, dimensions)`
  - [ ] Get connected room dimensions
  - [ ] Calculate X (centered above current room)
  - [ ] Calculate Y (using stacking height)
  - [ ] Align to grid using alignToGrid()
  - [ ] Return position object
  - [ ] Add JSDoc and inline comments
- [ ] Add `positionNorthMultiple(currentRoom, connectedRooms, currentPos, dimensions)`
  - [ ] Calculate total width of all connected rooms
  - [ ] Calculate starting X (centered group)
  - [ ] Loop through connected rooms
  - [ ] Position each left-to-right
  - [ ] Align each to grid
  - [ ] Return positions map
  - [ ] Add JSDoc and inline comments
- [ ] Test north positioning:
  - [ ] Test single room north connection
  - [ ] Test 2 rooms north connection
  - [ ] Test 3 rooms north connection
  - [ ] Verify centering logic
  - [ ] Verify grid alignment

### Task 2.2: Implement South Positioning
- [ ] Add `positionSouthSingle(currentRoom, connectedRoom, currentPos, dimensions)`
  - [ ] Get connected room dimensions
  - [ ] Calculate X (centered below current room)
  - [ ] Calculate Y (current Y + current stacking height)
  - [ ] Align to grid
  - [ ] Return position
  - [ ] Add JSDoc and comments
- [ ] Add `positionSouthMultiple(currentRoom, connectedRooms, currentPos, dimensions)`
  - [ ] Calculate total width
  - [ ] Calculate starting X (centered)
  - [ ] Position each room left-to-right
  - [ ] Align to grid
  - [ ] Return positions map
  - [ ] Add JSDoc and comments
- [ ] Test south positioning:
  - [ ] Test single room
  - [ ] Test multiple rooms
  - [ ] Verify positioning relative to current room

### Task 2.3: Implement East Positioning
- [ ] Add `positionEastSingle(currentRoom, connectedRoom, currentPos, dimensions)`
  - [ ] Calculate X (current X + current width)
  - [ ] Calculate Y (aligned at north edge)
  - [ ] Align to grid
  - [ ] Return position
  - [ ] Add JSDoc and comments
- [ ] Add `positionEastMultiple(currentRoom, connectedRooms, currentPos, dimensions)`
  - [ ] Calculate X (current X + current width)
  - [ ] Stack vertically starting at current Y
  - [ ] Loop through rooms, position each
  - [ ] Align to grid
  - [ ] Return positions map
  - [ ] Add JSDoc and comments
- [ ] Test east positioning:
  - [ ] Test single east connection
  - [ ] Test multiple east connections
  - [ ] Verify vertical stacking

### Task 2.4: Implement West Positioning
- [ ] Add `positionWestSingle(currentRoom, connectedRoom, currentPos, dimensions)`
  - [ ] Get connected room width
  - [ ] Calculate X (current X - connected width)
  - [ ] Calculate Y (aligned at north edge)
  - [ ] Align to grid
  - [ ] Return position
  - [ ] Add JSDoc and comments
- [ ] Add `positionWestMultiple(currentRoom, connectedRooms, currentPos, dimensions)`
  - [ ] Similar to east but subtract widths
  - [ ] Stack vertically
  - [ ] Align to grid
  - [ ] Return positions map
  - [ ] Add JSDoc and comments
- [ ] Test west positioning:
  - [ ] Test single west connection
  - [ ] Test multiple west connections

### Task 2.5: Create Router Functions
- [ ] Add `positionSingleRoom(direction, currentRoom, connectedRoom, currentPos, dimensions)`
  - [ ] Switch on direction
  - [ ] Call appropriate positioning function
  - [ ] Return position
  - [ ] Add error handling for unknown direction
  - [ ] Add JSDoc
- [ ] Add `positionMultipleRooms(direction, currentRoom, connectedRooms, currentPos, dimensions)`
  - [ ] Switch on direction
  - [ ] Call appropriate positioning function
  - [ ] Return positions map
  - [ ] Add error handling
  - [ ] Add JSDoc
- [ ] Test router functions:
  - [ ] Test each direction routing
  - [ ] Test error handling

### Task 2.6: Rewrite calculateRoomPositions
- [ ] Locate existing function (lines 644-786 in rooms.js)
- [ ] Create backup copy (commented out)
- [ ] Rewrite function:
  - [ ] Create positions, dimensions, processed, queue variables
  - [ ] Log algorithm start
  - [ ] Phase 1: Extract all room dimensions
    - [ ] Loop through all rooms
    - [ ] Call getRoomDimensions() for each
    - [ ] Store in dimensions object
    - [ ] Log each room's dimensions
  - [ ] Phase 2: Place starting room
    - [ ] Get starting room from gameScenario
    - [ ] Set position to (0, 0)
    - [ ] Add to processed set
    - [ ] Add to queue
    - [ ] Log starting room placement
  - [ ] Phase 3: Process rooms breadth-first
    - [ ] While queue not empty:
      - [ ] Dequeue current room
      - [ ] Get current room data and position
      - [ ] Log current room processing
      - [ ] Loop through ['north', 'south', 'east', 'west']:
        - [ ] Skip if no connection in direction
        - [ ] Get connected rooms (array or single)
        - [ ] Filter out processed rooms
        - [ ] Skip if no unprocessed rooms
        - [ ] Log connection direction and rooms
        - [ ] If single room: call positionSingleRoom()
        - [ ] If multiple rooms: call positionMultipleRooms()
        - [ ] Apply positions to position map
        - [ ] Add rooms to processed set
        - [ ] Add rooms to queue
        - [ ] Log each positioned room
  - [ ] Phase 4: Log final positions
  - [ ] Return positions object
- [ ] Test with scenario1.json:
  - [ ] Verify starting room at (0, 0)
  - [ ] Verify all rooms positioned
  - [ ] Verify no rooms missing
  - [ ] Verify grid alignment
- [ ] Test with cybok_heist.json
- [ ] Test with scenario2.json

---

## Phase 3: Door Placement

### Task 3.1: Implement North Door Placement
- [ ] Open `js/systems/doors.js`
- [ ] Add `placeNorthDoorSingle(roomId, roomPosition, roomDimensions, gridCoords)`
  - [ ] Get room width
  - [ ] Calculate deterministic left/right using (gridX + gridY) % 2
  - [ ] If right: doorX = roomX + width - 1.5 tiles
  - [ ] If left: doorX = roomX + 1.5 tiles
  - [ ] doorY = roomY + 1 tile
  - [ ] Return {x, y}
  - [ ] Add JSDoc and comments explaining deterministic placement
- [ ] Add `placeNorthDoorsMultiple(roomId, roomPosition, roomDimensions, connectedRooms)`
  - [ ] Calculate edge inset (1.5 tiles)
  - [ ] Calculate available width
  - [ ] Calculate door spacing
  - [ ] Loop through connected rooms
  - [ ] Calculate X for each door
  - [ ] doorY = roomY + 1 tile
  - [ ] Return array of door positions with connectedRoom
  - [ ] Add JSDoc
- [ ] Test north door placement:
  - [ ] Test single door alternation
  - [ ] Test multiple door spacing
  - [ ] Verify corner positions

### Task 3.2: Implement South Door Placement
- [ ] Add `placeSouthDoorSingle(roomId, roomPosition, roomDimensions, gridCoords)`
  - [ ] Same logic as north but Y at bottom
  - [ ] doorY = roomY + roomHeight - 1 tile
  - [ ] Return {x, y}
  - [ ] Add JSDoc
- [ ] Add `placeSouthDoorsMultiple(roomId, roomPosition, roomDimensions, connectedRooms)`
  - [ ] Same logic as north but Y at bottom
  - [ ] Return array of positions
  - [ ] Add JSDoc
- [ ] Test south door placement

### Task 3.3: Implement East Door Placement
- [ ] Add `placeEastDoorSingle(roomId, roomPosition, roomDimensions)`
  - [ ] doorX = roomX + roomWidth - 1 tile
  - [ ] doorY = roomY + 2 tiles (below visual wall)
  - [ ] Return {x, y}
  - [ ] Add JSDoc
- [ ] Add `placeEastDoorsMultiple(roomId, roomPosition, roomDimensions, connectedRooms)`
  - [ ] doorX = roomX + roomWidth - 1 tile (same for all)
  - [ ] If single: return single position
  - [ ] Loop through connected rooms:
    - [ ] If first (index 0): Y = roomY + 2 tiles
    - [ ] If last: Y = roomY + roomHeight - 3 tiles
    - [ ] If middle: evenly space between first and last
  - [ ] Return array of positions
  - [ ] Add JSDoc explaining spacing logic
- [ ] Test east door placement:
  - [ ] Test single east door
  - [ ] Test 2 east doors
  - [ ] Test 3+ east doors

### Task 3.4: Implement West Door Placement
- [ ] Add `placeWestDoorSingle(roomId, roomPosition, roomDimensions)`
  - [ ] doorX = roomX + 1 tile
  - [ ] doorY = roomY + 2 tiles
  - [ ] Return {x, y}
  - [ ] Add JSDoc
- [ ] Add `placeWestDoorsMultiple(roomId, roomPosition, roomDimensions, connectedRooms)`
  - [ ] Same logic as east but X on west edge
  - [ ] Return array of positions
  - [ ] Add JSDoc
- [ ] Test west door placement

### Task 3.5: Create Door Calculation Router
- [ ] Add `calculateDoorPositionsForRoom(roomId, roomPosition, roomDimensions, connections, allPositions, allDimensions)`
  - [ ] Calculate grid coords from room position
  - [ ] Create doors array
  - [ ] Loop through ['north', 'south', 'east', 'west']:
    - [ ] Skip if no connection
    - [ ] Get connected rooms (array or single)
    - [ ] If north: call appropriate north function
    - [ ] If south: call appropriate south function
    - [ ] If east: call appropriate east function
    - [ ] If west: call appropriate west function
    - [ ] Add returned positions to doors array with metadata
  - [ ] Return doors array
  - [ ] Add comprehensive JSDoc
- [ ] Test door calculation for each direction

### Task 3.6: Update createDoorSpritesForRoom
- [ ] Locate function (lines 47-308 in doors.js)
- [ ] Backup existing implementation (comment out)
- [ ] Rewrite function:
  - [ ] Get room dimensions using getRoomDimensions()
  - [ ] Import/access getRoomDimensions from rooms.js
  - [ ] Calculate door positions using calculateDoorPositionsForRoom()
  - [ ] Loop through door positions:
    - [ ] Create door sprite at position
    - [ ] Set correct texture (door_32 for N/S, door_side_sheet_32 for E/W)
    - [ ] Set origin, depth, visibility
    - [ ] Set door properties
    - [ ] Set up collision and interaction
    - [ ] Add to doorSprites array
  - [ ] Return doorSprites
- [ ] Remove old positioning logic (lines 86-187)
- [ ] Test door sprite creation:
  - [ ] Verify doors created at correct positions
  - [ ] Verify correct textures
  - [ ] Verify door properties set correctly

### Task 3.7: Update removeTilesUnderDoor
- [ ] Open `js/systems/collision.js`
- [ ] Locate removeTilesUnderDoor function (lines 154-335)
- [ ] Import door placement functions from doors.js OR
- [ ] Import calculateDoorPositionsForRoom
- [ ] Rewrite door position calculation section:
  - [ ] Replace duplicate positioning logic (lines 197-283)
  - [ ] Call calculateDoorPositionsForRoom() instead
  - [ ] Use returned door positions
- [ ] Test tile removal:
  - [ ] Verify tiles removed at correct positions
  - [ ] Verify matches door sprite positions exactly
  - [ ] No gaps or overlaps

---

## Phase 4: Validation

### Task 4.1: Create Validation Helper Functions
- [ ] Decide: Add to rooms.js OR create new validation.js
- [ ] If new file: Create `js/core/validation.js`
- [ ] Add `validateRoomSize(roomId, dimensions)`
  - [ ] Check width multiple of 5
  - [ ] Check (height - 2) multiple of 4
  - [ ] Log errors if invalid
  - [ ] Return boolean
  - [ ] Add JSDoc
- [ ] Add `validateGridAlignment(roomId, position)`
  - [ ] Check X divisible by GRID_UNIT_WIDTH_PX
  - [ ] Check Y divisible by GRID_UNIT_HEIGHT_PX
  - [ ] Log errors with nearest valid position
  - [ ] Return boolean
  - [ ] Add JSDoc
- [ ] Add `checkOverlap(pos1, dim1, pos2, dim2)`
  - [ ] Calculate room bounds using stacking height
  - [ ] Use AABB overlap test
  - [ ] Return null if no overlap
  - [ ] Return overlap area if overlapping
  - [ ] Add JSDoc
- [ ] Test helper functions with known cases

### Task 4.2: Create Overlap Detection
- [ ] Add `detectRoomOverlaps(positions, dimensions)`
  - [ ] Get all room IDs
  - [ ] Create overlaps array
  - [ ] Nested loop through room pairs
  - [ ] Call checkOverlap() for each pair
  - [ ] If overlap, add to overlaps array with details
  - [ ] Log all overlaps found
  - [ ] Return overlaps array
  - [ ] Add JSDoc
- [ ] Test with overlapping scenario
- [ ] Test with non-overlapping scenario

### Task 4.3: Create Connection Validation
- [ ] Add `getOppositeDirection(direction)` helper
  - [ ] Return opposite for north/south/east/west
  - [ ] Add JSDoc
- [ ] Add `validateConnections(gameScenario)`
  - [ ] Create errors array
  - [ ] Loop through all rooms
  - [ ] For each connection:
    - [ ] Check connected room exists
    - [ ] Get opposite direction
    - [ ] Check reciprocal connection exists
    - [ ] Check reciprocal points back to this room
    - [ ] Add errors for any issues
  - [ ] Log all errors
  - [ ] Return errors array
  - [ ] Add JSDoc
- [ ] Test with valid scenario
- [ ] Test with missing reciprocal
- [ ] Test with missing room

### Task 4.4: Create Door Alignment Validation
- [ ] Add `validateDoorAlignment(allDoors)`
  - [ ] Create door pairs map
  - [ ] Group doors by connection (room1:room2)
  - [ ] Create errors array
  - [ ] For each pair:
    - [ ] Check exactly 2 doors exist
    - [ ] Calculate delta X and Y
    - [ ] Check within tolerance (1px)
    - [ ] Log errors if misaligned
    - [ ] Add to errors array
  - [ ] Log summary
  - [ ] Return errors
  - [ ] Add JSDoc
- [ ] Test with aligned doors
- [ ] Test with misaligned doors

### Task 4.5: Create Starting Room Validation
- [ ] Add `validateStartingRoom(gameScenario)`
  - [ ] Check startRoom defined
  - [ ] Check startRoom exists in rooms
  - [ ] Log errors
  - [ ] Return boolean
  - [ ] Add JSDoc
- [ ] Test with valid scenario
- [ ] Test with missing starting room

### Task 4.6: Create Main Validation Function
- [ ] Add `validateScenario(gameScenario, positions, dimensions, allDoors)`
  - [ ] Log validation header
  - [ ] Create results object
  - [ ] Call validateStartingRoom()
  - [ ] Loop through rooms, call validateRoomSize()
  - [ ] Loop through positions, call validateGridAlignment()
  - [ ] Call detectRoomOverlaps()
  - [ ] Call validateConnections()
  - [ ] Call validateDoorAlignment()
  - [ ] Aggregate results
  - [ ] Log summary (errors and warnings)
  - [ ] Return results
  - [ ] Add comprehensive JSDoc
- [ ] Test with valid scenario
- [ ] Test with scenario containing errors

### Task 4.7: Integrate Validation into initializeRooms
- [ ] Open `js/core/rooms.js`
- [ ] Locate initializeRooms function (lines 548-576)
- [ ] After calculateRoomPositions():
  - [ ] Extract all dimensions
  - [ ] Calculate all door positions
  - [ ] Call validateScenario()
  - [ ] Store results in window.scenarioValidation
  - [ ] Log results
  - [ ] Continue initialization (don't fail)
- [ ] Test validation runs on scenario load
- [ ] Test validation results accessible via console

---

## Phase 5: Testing and Refinement

### Task 5.1: Test Existing Scenarios
- [ ] Test scenario1.json (biometric_breach):
  - [ ] Load scenario
  - [ ] Check no validation errors
  - [ ] Navigate through all rooms
  - [ ] Check all doors align
  - [ ] Check no visual gaps
  - [ ] Check player can navigate correctly
- [ ] Test cybok_heist.json:
  - [ ] Same checks as above
- [ ] Test scenario2.json:
  - [ ] Same checks as above
- [ ] Test ceo_exfil.json:
  - [ ] Same checks as above
- [ ] Fix any issues found

### Task 5.2: Create Test Scenario - Different Sizes
- [ ] Create `scenarios/test_different_sizes.json`
- [ ] Include closet (5×6)
- [ ] Include standard office (10×8)
- [ ] Include wide hall (20×6) if available
- [ ] Connect them vertically
- [ ] Load and test:
  - [ ] Rooms positioned correctly
  - [ ] Doors align
  - [ ] No overlaps
  - [ ] Navigation works

### Task 5.3: Create Test Scenario - East/West
- [ ] Create `scenarios/test_east_west.json`
- [ ] Center room with east/west connections
- [ ] Load and test:
  - [ ] Rooms positioned correctly
  - [ ] Side doors created
  - [ ] Side doors use correct sprite
  - [ ] Doors align
  - [ ] Navigation works

### Task 5.4: Create Test Scenario - Multiple Connections
- [ ] Create `scenarios/test_multiple_connections.json`
- [ ] Base room with 3 north connections
- [ ] Load and test:
  - [ ] All 3 rooms positioned correctly
  - [ ] All doors align
  - [ ] Doors evenly spaced
  - [ ] Navigation works

### Task 5.5: Create Test Scenario - Complex Layout
- [ ] Create `scenarios/test_complex.json`
- [ ] Multi-directional connections
- [ ] Include hallway connector
- [ ] Load and test:
  - [ ] All rooms positioned
  - [ ] No overlaps
  - [ ] All doors align
  - [ ] Navigation works
  - [ ] Visual appearance correct

### Task 5.6: Fix Common Issues
- [ ] Check for floating point errors
  - [ ] Add Math.round() where needed
- [ ] Check for grid misalignment
  - [ ] Ensure alignToGrid() called
- [ ] Check for door misalignment
  - [ ] Verify calculation consistency
- [ ] Check for visual gaps
  - [ ] Verify stacking height calculations
- [ ] Check for overlap false positives
  - [ ] Verify overlap detection uses stacking height

### Task 5.7: Performance Testing
- [ ] Load scenario with 10+ rooms
- [ ] Check load time
- [ ] Check frame rate during navigation
- [ ] Profile if needed
- [ ] Optimize if necessary

---

## Phase 6: Documentation and Polish

### Task 6.1: Add Code Comments
- [ ] Review all new functions
- [ ] Ensure each has comprehensive JSDoc
- [ ] Add inline comments for complex logic
- [ ] Explain grid unit conversions
- [ ] Explain deterministic door placement
- [ ] Explain edge cases

### Task 6.2: Update Console Logging
- [ ] Review all console.log statements
- [ ] Ensure helpful debug output
- [ ] Add validation results logging
- [ ] Add room positioning logging
- [ ] Add door placement logging
- [ ] Use consistent formatting:
  - [ ] ✅ for success
  - [ ] ❌ for errors
  - [ ] ⚠️ for warnings
  - [ ] 🔧 for debug info

### Task 6.3: Create Debug Tools
- [ ] Add window.showRoomBounds()
  - [ ] Draw rectangles for each room's stacking area
  - [ ] Use different colors for each room
  - [ ] Add labels
- [ ] Add window.showGrid()
  - [ ] Draw grid unit overlay
  - [ ] Show grid coordinates
- [ ] Add window.checkScenario()
  - [ ] Print validation results
  - [ ] Print room positions
  - [ ] Print door positions
- [ ] Add window.listRooms()
  - [ ] Print all rooms with positions and sizes
  - [ ] Print in table format
- [ ] Add window.testDoorAlignment()
  - [ ] Highlight door positions
  - [ ] Show alignment errors
- [ ] Document debug tools in console

### Task 6.4: Clean Up Old Code
- [ ] Remove commented-out backup code
- [ ] Remove debug console.logs
- [ ] Remove unused functions
- [ ] Clean up imports

### Task 6.5: Update User Documentation
- [ ] Update planning notes if needed
- [ ] Create migration guide for scenario authors
- [ ] Document grid unit system
- [ ] Document valid room sizes
- [ ] Document connection format

---

## Final Checklist

- [ ] All existing scenarios load correctly
- [ ] All test scenarios work correctly
- [ ] No validation errors for valid scenarios
- [ ] Validation catches invalid scenarios
- [ ] All doors align perfectly
- [ ] No room overlaps
- [ ] Navigation works in all directions
- [ ] Performance is acceptable
- [ ] Code is well documented
- [ ] Debug tools work
- [ ] No console errors
- [ ] Ready for commit

---

## Commit Messages

Use clear, descriptive commit messages:

```
feat: Add grid unit system constants and conversion functions

- Add GRID_UNIT_WIDTH_TILES, GRID_UNIT_HEIGHT_TILES constants
- Add tilesToGridUnits(), gridToWorld(), worldToGrid() helpers
- Add alignToGrid() function for position alignment
- Add comprehensive tests for all conversion functions
```

```
feat: Implement new room positioning algorithm

- Support all 4 directions (north, south, east, west)
- Position rooms in multiples of grid units
- Center rooms when connecting to larger/smaller rooms
- Use breadth-first processing for deterministic layout
```

```
feat: Update door placement for variable room sizes

- Support north/south doors with deterministic left/right placement
- Support east/west doors with proper spacing
- Align all doors to connecting room doors
- Use grid coordinates for deterministic placement
```

```
feat: Add scenario validation system

- Validate room sizes are multiples of grid units
- Detect room overlaps
- Verify connection reciprocity
- Verify door alignment
- Log clear errors and warnings
```

```
test: Add test scenarios for new room layout system

- Test different room sizes
- Test east/west connections
- Test multiple connections
- Test complex layouts
```

```
docs: Add comprehensive code documentation

- Add JSDoc to all new functions
- Add inline comments for complex logic
- Document grid unit system
- Add debug tools
```
