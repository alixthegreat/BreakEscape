# Room Loading System Design

## Overview

The room loading system in BreakEscape coordinates two distinct data sources to create a complete room experience:

1. **Scenario JSON Files** (e.g., `ceo_exfil.json`) - Define game logic, item properties, and game state
2. **Tiled Map JSON Files** (e.g., `room_reception2.json`) - Define visual layout, sprite positions, and room structure

This document explains how these systems work together to load and render rooms.

---

## Architecture Overview

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Scenario JSON                               │
│  (rooms → room data → objects with properties)                  │
└──────────────┬──────────────────────────────────────────────────┘
               │ Contains: name, type, takeable, readable, etc.
               │
               ▼
        ┌──────────────────────┐
        │  Matching Algorithm  │
        │  (Type-based lookup) │
        └──────────┬───────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌─────────────────────┐  ┌──────────────────┐
│  Tiled Map Items    │  │ Scene Objects    │
│  (Position & Sprite)│  │ (Properties)     │
└─────────────────────┘  └──────────────────┘
        │                     │
        │ Merge Properties    │
        └─────────────┬───────┘
                      ▼
            ┌──────────────────────┐
            │  Final Game Object   │
            │ (Position + Props)   │
            └──────────────────────┘
```

---

## Room Loading Process

### 1. **Initialization Phase**

When the game starts, the following steps occur:

1. **Scenario Loading**: `window.gameScenario` is populated with scenario data from the selected scenario JSON file
2. **Tilemap Preloading**: Tiled map files are preloaded in the Phaser scene's `preload()` function
3. **Room Position Calculation**: Room positions are calculated based on connections and layout

### 2. **Lazy Loading**

Rooms are loaded on-demand when:
- The player moves close to an adjacent room (detected via door sprite proximity)
- Eventually, this will be determined by a remote API request

```javascript
function loadRoom(roomId) {
    const gameScenario = window.gameScenario;
    const roomData = gameScenario.rooms[roomId];
    const position = window.roomPositions[roomId];
    
    createRoom(roomId, roomData, position);
    revealRoom(roomId);
}
```

### 3. **Room Creation Phase**

The `createRoom()` function orchestrates the complete room setup:

#### Step 3a: Load Tilemap
- Create a Phaser tilemap from the preloaded Tiled JSON data
- Add tileset images to the map
- Initialize room data structure: `rooms[roomId]`

#### Step 3b: Create Tile Layers
- Iterate through all layers in the Tiled map (floor, walls, collision, etc.)
- Create sprite layers for each, positioned at the room's world coordinates
- Set depth values based on the Depth Layering Philosophy
- Skip the "doors" layer (handled by sprite-based doors system)

#### Step 3c: Create Door Sprites
- Parse scenario room connections
- Create interactive door sprites at appropriate positions
- Doors serve as transition triggers to adjacent rooms

#### Step 3d: Process Tiled Object Layers
The system processes five object layers from the Tiled map:
- **tables** - Static table/furniture objects that don't move
- **table_items** - Items placed on tables (phones, keyboards, etc.)
- **conditional_items** - Items in the main space that may be scenario-specific
- **conditional_table_items** - Table items that may be scenario-specific
- **items** - Regular items in the room (plants, chairs, etc.)

#### Step 3e: Match and Merge Objects
This is the **critical matching phase**:

1. **Collect Available Sprites**: Extract all objects from Tiled layers, organized by type
2. **Process Scenario Objects**: For each object defined in the scenario:
   - Extract the object type (e.g., "key", "notes", "phone")
   - Search for matching visual representation in this priority:
     1. Regular items layer (items)
     2. Conditional items layer (conditional_items)
     3. Conditional table items layer (conditional_table_items)
   - **Merge Properties**: Apply scenario properties to the matched sprite
   - **Mark as Used**: Track which Tiled items have been consumed
3. **Process Remaining Sprites**: Create sprites for unused Tiled items with default properties

---

## Matching Algorithm

### Type-Based Matching

The system uses a **type-based matching** approach where each scenario object is matched to a Tiled sprite by type:

```
Scenario Object: { type: "key", name: "Office Key", takeable: true, ... }
                                    ▼
                          Search for matching type
                                    ▼
Tiled Item: { gid: 243, imageName: "key", x: 100, y: 150 }
                                    ▼
                          Match Found! Merge:
                                    ▼
Final Object: { 
    imageName: "key", 
    x: 100, y: 150,            // Position from Tiled
    name: "Office Key",         // Name from Scenario
    takeable: true,             // Properties from Scenario
    observations: "..."
}
```

### Image Name Extraction

The system extracts the base type from Tiled object image names:

```javascript
function extractBaseTypeFromImageName(imageName) {
    // Examples:
    // "key.png" → "key"
    // "phone5.png" → "phone"
    // "notes3.png" → "notes"
    // "plant-large1.png" → "plant"
}
```

### Matching Priority

When looking for a Tiled sprite to match a scenario object:

1. **Regular Items Layer** - First choice (most commonly used items)
2. **Conditional Items Layer** - For items that might not always be present
3. **Conditional Table Items Layer** - For table-specific scenario items

This priority allows flexibility in where visual assets are placed while maintaining predictable matching behavior.

---

## Object Layer Details

### Table Structure (From Tiled)

**Purpose**: Define base furniture objects (desks, tables, etc.)

```json
{
    "gid": 118,
    "height": 47,
    "name": "",
    "rotation": 0,
    "type": "",
    "visible": true,
    "width": 174,
    "x": 75.67,
    "y": 89.67
}
```

**Processing**:
- Tables are processed first to establish base positions
- Groups are created for table + table_items organization
- Tables act as anchor points for table items

### Table Items Structure (From Tiled)

**Purpose**: Items that should visually appear on or near tables

```json
{
    "gid": 358,
    "height": 23,
    "name": "",
    "x": 86,
    "y": 64.5
}
```

**Processing**:
- Grouped with their closest table
- Set to same depth as table + slight offset for proper ordering
- Sorted north-to-south (lower Y values first)

### Conditional Items Structure (From Tiled)

**Purpose**: Items that appear conditionally based on scenario

```json
{
    "gid": 227,
    "name": "",
    "x": 13.5,
    "y": 51
}
```

**Processing**:
- Available for scenario matching
- Only rendered if a scenario object matches them
- Otherwise ignored (not rendered in the room)

### Items Structure (From Tiled)

**Purpose**: Always-present background objects (plants, chairs, etc.)

```json
{
    "gid": 176,
    "height": 21,
    "name": "",
    "x": 197.67,
    "y": 45.67
}
```

**Processing**:
- Most numerous layer
- Rendered unless consumed by scenario matching
- Provide visual richness to the room

---

## Depth Layering Philosophy

All depth calculations use: **World Y Position + Layer Offset**

### Room Layers

```
Depth Priority (lowest to highest):
1. Floor:        roomWorldY + 0.1
2. Collision:    roomWorldY + 0.15
3. Walls:        roomWorldY + 0.2
4. Props:        roomWorldY + 0.3
5. Other:        roomWorldY + 0.4
```

### Interactive Elements

```
Depth Priority (lowest to highest):
1. Doors:                doorY + 0.45
2. Door Tops:            doorY + 0.55
3. Animated Doors:       doorBottomY + 0.45
4. Animated Door Tops:   doorBottomY + 0.55
5. Player:               playerBottomY + 0.5
6. Objects:              objectBottomY + 0.5
```

**Key Principle**: The deeper (higher Y position) an object is in the room, the higher its depth value, ensuring natural layering.

---

## Property Application Flow

When a scenario object is matched to a Tiled sprite:

```javascript
// 1. Find matching Tiled sprite
const usedItem = regularItemsByType[scenarioObj.type].shift();

// 2. Create sprite at Tiled position
const sprite = gameRef.add.sprite(
    Math.round(position.x + usedItem.x),
    Math.round(position.y + usedItem.y - usedItem.height),
    imageName
);

// 3. Apply scenario properties
sprite.scenarioData = scenarioObj;
sprite.interactable = true;
sprite.name = scenarioObj.name;
sprite.objectId = `${roomId}_${scenarioObj.type}_${index}`;

// 4. Apply visual properties from Tiled
if (usedItem.rotation) {
    sprite.setRotation(Phaser.Math.DegToRad(usedItem.rotation));
}

// 5. Set depth and elevation
const objectBottomY = sprite.y + sprite.height;
const objectDepth = objectBottomY + 0.5 + elevation;
sprite.setDepth(objectDepth);
```

---

## Handling Missing Matches

If a scenario object has no matching Tiled sprite:

1. Create sprite at a **random valid position** in the room
2. Use the object type as the sprite name
3. Apply all scenario properties normally
4. Log a warning for debugging

**Fallback Position Logic**:
- Generate random coordinates within the room bounds
- Exclude padding areas (edge of room)
- Verify no overlap with existing objects
- Maximum 50 attempts before placement

---

## Room Visibility and Rendering

### Visibility State

1. **Hidden Initially**: All room elements are created but hidden (`setVisible(false)`)
2. **Revealed on Load**: When `revealRoom()` is called, elements become visible
3. **Controlled Updates**: Visibility changes based on player proximity and game state

### Room Reveal Logic

```javascript
function revealRoom(roomId) {
    const room = rooms[roomId];
    
    // Show all layers
    Object.values(room.layers).forEach(layer => {
        layer.setVisible(true);
        layer.setAlpha(1);
    });
    
    // Show all objects
    Object.values(room.objects).forEach(obj => {
        obj.setVisible(true);
    });
    
    // Show door sprites
    room.doorSprites.forEach(door => {
        door.setVisible(true);
    });
}
```

---

## Item Tracking and De-duplication

The system prevents the same visual sprite from being used twice through the `usedItems` Set:

```javascript
const usedItems = new Set();

// After using a sprite:
usedItems.add(imageName);           // Full image name
usedItems.add(baseType);            // Base type (key, phone, etc.)

// Before processing a Tiled sprite:
if (usedItems.has(imageName) || usedItems.has(baseType)) {
    // Skip this sprite - already used
    continue;
}
```

---

## Example: Complete Scenario Object Processing

### Input: Scenario Definition

```json
{
    "type": "key",
    "name": "Office Key",
    "takeable": true,
    "key_id": "office1_key:40,35,38,32,10",
    "observations": "A key to access the office areas"
}
```

### Input: Tiled Map Layer

```json
{
    "name": "items",
    "objects": [
        {
            "gid": 243,
            "height": 21,
            "width": 12,
            "x": 100,
            "y": 150
        }
    ]
}
```

### Processing Steps

1. **Extract Type**: `scenarioObj.type = "key"`
2. **Extract Image**: `getImageNameFromObject(tiledObj)` → `"key"`
3. **Match**: Find tiled object with base type "key"
4. **Create Sprite**: At position (100, 150) with image "key.png"
5. **Merge Data**: 
   - Position: (100, 150) ← from Tiled
   - Visual: "key.png" ← from Tiled  
   - Name: "Office Key" ← from Scenario
   - Properties: takeable, key_id, observations ← from Scenario
6. **Set Depth**: Based on Y position and room layout
7. **Store**: In `rooms[roomId].objects[objectId]`

### Output: Interactive Game Object

```javascript
{
    x: 100,
    y: 150,
    sprite: "key.png",
    name: "Office Key",
    type: "key",
    takeable: true,
    key_id: "office1_key:40,35,38,32,10",
    observations: "A key to access the office areas",
    interactive: true,
    scenarioData: {...}
}
```

---

## Collision and Physics

### Wall Collision

- Walls layer defines immovable boundaries
- Thin collision boxes created for each wall tile
- Player cannot pass through walls

### Door Transitions

- Door sprites detect player proximity
- When player is close enough, `loadRoom()` is triggered
- Adjacent room is loaded and revealed

### Object Interactions

- Interactive objects are clickable
- Interaction radius is defined by `INTERACTION_RANGE_SQ`
- Objects trigger appropriate minigames or dialogs

---

## Constants and Configuration

### Key Constants (from `js/utils/constants.js`)

```javascript
const TILE_SIZE = 32;                      // Base tile size in pixels
const DOOR_ALIGN_OVERLAP = 64;             // Door alignment overlap
const GRID_SIZE = 32;                      // Grid size for pathfinding
const INTERACTION_RANGE_SQ = 5000;         // Squared interaction range
const INTERACTION_CHECK_INTERVAL = 100;    // Check interval in ms
```

### Object Scales (from `js/core/rooms.js`)

```javascript
const OBJECT_SCALES = {
    'notes': 0.75,
    'key': 0.75,
    'phone': 1,
    'tablet': 0.75,
    'bluetooth_scanner': 0.7
};
```

---

## Performance Considerations

### Lazy Loading Benefits

- Only rooms near the player are loaded
- Reduces memory usage and draw calls
- Faster initial game load time

### Optimization Strategies

1. **Layer Caching**: Tile layers are only created once per room
2. **Sprite Pooling**: Reuse sprites when possible (future optimization)
3. **Depth Sorting**: Calculated once at load time, updated when needed
4. **Visibility Culling**: Rooms far from player are not rendered

---

## Debugging and Logging

The system provides comprehensive console logging:

```javascript
console.log(`Creating room ${roomId} of type ${roomData.type}`);
console.log(`Collected ${layerName} layer with ${objects.length} objects`);
console.log(`Created ${objType} using ${imageName}`);
console.log(`Applied scenario data to ${objType}:`, scenarioObj);
```

Enable the browser console to see detailed room loading information.

---

## API Reference

### Main Functions

#### `loadRoom(roomId)`
- Loads a room from the scenario and Tiled map
- Called by door transition system
- Parameters: `roomId` (string)

#### `createRoom(roomId, roomData, position)`
- Creates all room elements (layers, objects, doors)
- Coordinates the complete room setup
- Parameters: `roomId`, `roomData` (scenario), `position` {x, y}

#### `revealRoom(roomId)`
- Makes room elements visible to the player
- Called after room creation completes
- Parameters: `roomId` (string)

#### `processScenarioObjectsWithConditionalMatching(roomId, position, objectsByLayer)`
- Internal: Matches scenario objects to Tiled sprites
- Returns: Set of used item identifiers

---

## Future Improvements

1. **Remote Room Loading**: Replace local scenario with API calls
2. **Dynamic Item Placement**: Algorithm-based positioning instead of Tiled layer placement
3. **Item Pooling**: Reuse sprite objects for better performance
4. **Streaming LOD**: Load distant rooms at reduced detail
5. **Narrative-based Visibility**: Show/hide items based on story state

---

## Related Files

- **Scenario Format**: See `README_scenario_design.md`
- **Tiled Map Format**: Tiled Editor documentation
- **Game State**: `js/systems/inventory.js`, `js/systems/interactions.js`
- **Visual Rendering**: `js/systems/object-physics.js`, `js/systems/player-effects.js`
