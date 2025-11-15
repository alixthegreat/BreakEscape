# Terminology Guide

## Tile vs Grid Unit

### Tile (32px)
- **Definition**: The smallest visual unit in Tiled
- **Size**: 32px × 32px
- **Usage**: Building block for all room graphics
- **Example**: A door is 1 tile wide × 2 tiles tall

### Grid Unit (5×4 tiles = 160×128px)
- **Definition**: The minimum stackable room size unit
- **Size**: 5 tiles wide × 4 tiles tall (excluding top 2 visual rows)
- **Usage**: Room sizes are specified as multiples of grid units
- **Example**: A standard room is 2×2 grid units (10×8 tiles)

**Why 5×4?**
- 5 tiles wide: 1 for each side wall + 3 floor tiles minimum
- 4 tiles tall: Excludes the 2 top visual wall tiles, counts stackable area only

## Room Dimensions

### Total Size
- **Definition**: Complete room including all walls and visual elements
- **Measurement**: Includes top 2 visual wall rows
- **Example**: Standard room is 10 tiles wide × 8 tiles tall total

### Stacking Size
- **Definition**: The area that cannot overlap with other rooms
- **Measurement**: Excludes top 2 visual wall rows
- **Example**: Standard room has 10×6 tiles stacking size (but we think in grid units: 2×1.5)
- **Note**: For positioning, we use grid units (2×2) since we always align to grid boundaries

### Floor Area
- **Definition**: Interior walkable space (excluding walls)
- **Measurement**: Total size minus all walls
- **Example**: Standard room (10×8 tiles) has ~6×4 floor area

## Directions

### Connection Directions
- **North**: Rooms above current room
- **South**: Rooms below current room
- **East**: Rooms to the right of current room
- **West**: Rooms to the left of current room

### Visual Direction
- **Top of Screen**: North (furthest from player viewpoint)
- **Bottom of Screen**: South (closest to player viewpoint)

## Positioning

### World Coordinates
- **Definition**: Absolute pixel positions in the game world
- **Origin**: (0, 0) typically at the starting room's top-left
- **Usage**: Final position where room sprites are rendered

### Grid Coordinates
- **Definition**: Position in grid units from origin
- **Origin**: Starting room at grid position (0, 0)
- **Usage**: Used for deterministic door placement calculations
- **Conversion**: `worldX = gridX × 160`, `worldY = gridY × 128`

### Room Position
- **Definition**: The top-left corner of a room's stacking area in world coordinates
- **Usage**: Where Phaser renders the room tilemap
- **Note**: This is the position used in `window.roomPositions[roomId]`

## Connections

### Single Connection
```json
"connections": {
  "north": "office2"
}
```
- One room connected in the specified direction

### Multiple Connections
```json
"connections": {
  "north": ["office2", "office3"]
}
```
- Array of rooms connected in the same direction
- Rooms are positioned left-to-right (west-to-east)

### Bidirectional Connections
```json
// In room1:
"connections": { "north": "room2" }

// In room2:
"connections": { "south": "room1" }
```
- Connections must be reciprocal for doors to work correctly

## Doors

### Door Position
- **North/South Doors**: Placed in corners of the room
- **East/West Doors**: Placed at edges based on connection count
- **Alignment**: Doors from two connecting rooms must align perfectly

### Door Sprite
- **North/South**: 1 tile wide × 2 tiles tall (`door_32.png`)
- **East/West**: 1 tile wide × 1 tile tall (`door_side_sheet_32.png`)
- **Layered**: Two door sprites (one for each room) stack at same position

### Door State
- **Closed**: Collision enabled, blocks passage
- **Open**: Sprite destroyed, collision removed, passage clear
- **Locked**: Requires unlock minigame before opening

## Walls

### Visual Wall
- **Definition**: The top 2 rows of tiles showing wall from orthogonal view
- **Behavior**: Overlaps the room to the north visually
- **Collision**: No collision (purely visual)

### Collision Wall
- **Definition**: Invisible collision boxes at room boundaries
- **Placement**: At the border between wall tiles and floor tiles
- **Exception**: No collision at door positions

### Wall Tiles
- **Side Walls**: Leftmost and rightmost columns of tiles
- **Top Wall**: Top 2 rows of tiles
- **Bottom Wall**: Bottom row of tiles (treated specially)

## Validation

### Overlap Detection
- **Definition**: Checking if two rooms' stacking areas occupy the same grid units
- **Timing**: Performed during scenario load
- **Action**: Log clear error but attempt to continue

### Grid Alignment
- **Definition**: Ensuring all rooms are positioned at grid unit boundaries
- **Requirement**: Room positions must be multiples of grid unit size (160×128px)
- **Purpose**: Ensures consistent layout and door alignment

## Special Cases

### Hallway
- **Definition**: A connector room explicitly defined in scenario
- **Typical Size**: 2×1 or 4×1 grid units (long and narrow)
- **Purpose**: Connects multiple rooms without gaps
- **Example**:
```
[Room1][Room2]
[--Hallway--]
[--Room0---]
```

### Closet
- **Definition**: Smallest room size (1×1 grid unit)
- **Size**: 5 tiles wide × 4 tiles tall
- **Usage**: Small storage rooms, utility spaces

### Corner Alignment
- **Definition**: When a room's corner touches another room's corner
- **Current Behavior**: Creates a gap (undesired)
- **New Behavior**: Rooms stack flush against each other
