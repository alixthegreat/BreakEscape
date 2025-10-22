# Room Loading System - Documentation Summary

## Overview

This directory now contains comprehensive documentation on the BreakEscape room loading system, which coordinates **Scenario JSON files** (game logic) with **Tiled Map JSON files** (visual layout).

## Documentation Files

### 1. **README_ROOM_LOADING.md** (574 lines)
**Complete guide to the current room loading architecture**

Contains:
- Overview of architecture and data flow
- Detailed room loading process (5 phases)
- Matching algorithm explanation
- Object layer details and processing
- Depth layering philosophy
- Property application flow
- Item tracking and de-duplication
- Complete end-to-end example
- Collision and physics systems
- Performance considerations
- Debugging guide
- API reference for main functions

**Use this to understand:** How the system currently works

### 2. **README_ROOM_LOADING_IMPROVEMENTS.md** (525 lines)
**Proposed improvements and refactoring strategies**

Contains:
- Current approach analysis (strengths & challenges)
- Proposed improved architecture
- Implementation plan with code examples:
  - `TiledItemPool` class
  - `matchScenarioObjectToTiledItem()` function
  - Refactored `processScenarioObjectsWithConditionalMatching()`
  - Helper functions for sprite creation
- Benefits of improvements
- Gradual migration path (3 phases)
- Before/after code comparison

**Use this to understand:** How to improve the system

---

## Key Concepts

### Two-Source Architecture

```
Scenario JSON (Logic)              Tiled Map JSON (Visual)
├─ type: "key"                    ├─ gid: 243
├─ name: "Office Key"             ├─ x: 100
├─ takeable: true                 ├─ y: 150
├─ observations: "..."            └─ imageName: "key"
└─ ...                                
   ↓                              ↓
   └─────────────────┬─────────────┘
                     ↓
              MATCHING & MERGING
                     ↓
        Final Game Object (Position + Properties)
```

### Three Processing Phases

1. **Collection** - Gather all Tiled items from layers
2. **Matching** - Match scenario objects to Tiled items by type
3. **Fallback** - Create sprites for unmatched items (random position)

### Layer Priority

When matching scenario objects:
1. Regular items layer (most common)
2. Conditional items layer (scenario-specific)
3. Conditional table items layer (on tables)

---

## Quick Reference

### For Understanding Current System
1. Read "Overview" section of README_ROOM_LOADING.md
2. Review "Room Loading Process" (3 phases)
3. Study "Matching Algorithm" section
4. Trace through "Example: Complete Scenario Object Processing"

### For Understanding Proposed Improvements
1. Read "Current Approach Analysis" in README_ROOM_LOADING_IMPROVEMENTS.md
2. Review "Proposed Improved Approach" 
3. Study "Implementation Plan" with code examples
4. Review "Benefits of This Approach"

### For Implementation
1. Follow "Migration Path" (Phase 1, 2, 3)
2. Implement helper functions from "Step 4"
3. Create TiledItemPool class from "Step 2"
4. Refactor processScenarioObjectsWithConditionalMatching from "Step 3"

---

## Main Source File

The implementation is in: **`js/core/rooms.js`**

Key function: `processScenarioObjectsWithConditionalMatching()` (lines 612-842)

---

## Data Sources

### Scenario Format
Example: `scenarios/ceo_exfil.json`
```json
{
  "rooms": {
    "reception": {
      "objects": [
        {
          "type": "key",
          "name": "Office Key",
          "takeable": true,
          "key_id": "office1_key:40,35,38,32,10",
          "observations": "A key to access the office areas"
        }
      ]
    }
  }
}
```

### Tiled Map Format
Example: `assets/rooms/room_reception2.json`
- Contains layers: tables, table_items, conditional_items, items, conditional_table_items
- Each object has: gid (sprite ID), x, y, width, height, rotation, etc.

---

## System Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│              Game Initialization                    │
│  • Load scenario JSON                               │
│  • Preload Tiled map files                         │
│  • Calculate room positions                         │
└────────────────────┬────────────────────────────────┘
                     │
              Player Moves Near Door
                     │
                     ▼
        ┌────────────────────────────┐
        │    Load Room (Lazy)        │
        │                            │
        │ 1. Load Tilemap           │
        │ 2. Create tile layers     │
        │ 3. Create door sprites    │
        │ 4. Process object layers  │
        │ 5. Match & merge objects  │
        └────────────────┬───────────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
        Scenario Matching      Tiled Items
        Objects matched        → visual layer
        to visual items          positions
              │                   │
              └──────────┬────────┘
                         ▼
            ┌────────────────────────┐
            │  Create Sprites        │
            │  • Position from Tiled │
            │  • Properties from     │
            │    Scenario            │
            └────────────┬───────────┘
                         │
                         ▼
            ┌────────────────────────┐
            │   Reveal Room          │
            │   Show to Player       │
            └────────────────────────┘
```

---

## Key Functions (Reference)

| Function | Purpose | File |
|----------|---------|------|
| `loadRoom(roomId)` | Trigger room loading | `js/core/rooms.js:103` |
| `createRoom(roomId, roomData, position)` | Create all room elements | `js/core/rooms.js:351` |
| `processScenarioObjectsWithConditionalMatching()` | Match & merge objects | `js/core/rooms.js:612` |
| `getImageNameFromObject(obj)` | Extract image name from Tiled | `js/core/rooms.js:844` |
| `extractBaseTypeFromImageName(imageName)` | Get base type (key, phone, etc.) | `js/core/rooms.js:897` |
| `revealRoom(roomId)` | Make room visible | `js/core/rooms.js:1413` |

---

## Constants

```javascript
const TILE_SIZE = 32;                    // pixels
const DOOR_ALIGN_OVERLAP = 64;          // pixels
const INTERACTION_RANGE_SQ = 5000;      // pixels²
```

---

## Depth Calculation

```
Object Depth = ObjectBottomY + LayerOffset + Elevation

Where:
- ObjectBottomY = Y position + height
- LayerOffset = 0.5 (for objects)
- Elevation = Height above back wall (0 for most items)
```

---

## Testing the System

### Check Console Output
Browser console shows detailed logging:
```
Creating room reception of type room_reception
Collected items layer with 27 objects
Collected conditional_items layer with 9 objects
Processing 11 scenario objects for room reception
Looking for scenario object type: key
✓ Created key using key
Applied scenario data to key: { name: "Office Key", ... }
```

### Verify Items Appear
- Open developer tools (F12)
- Check "room_reception" in `window.rooms`
- Verify objects in `rooms[roomId].objects` have correct properties

---

## Performance Impact

### Lazy Loading
- ✅ Reduces initial load time
- ✅ Lower memory footprint
- ✅ Smoother transitions between rooms

### Asset Reuse
- Tiled items with same imageName reuse sprite asset
- No duplication of image data

### Depth Sorting
- Calculated once at load time
- Updated as needed during gameplay

---

## Related Systems

1. **Inventory System** - `js/systems/inventory.js`
   - Items marked `inInventory: true` go here instead of room

2. **Interaction System** - `js/systems/interactions.js`
   - Handles clicks on loaded objects
   - Triggers minigames, dialogs, etc.

3. **Door System** - `js/systems/doors.js`
   - Sprite-based door transitions
   - Triggers `loadRoom()` on proximity

4. **Physics System** - `js/systems/object-physics.js`
   - Collision detection
   - Player movement constraints

---

## Common Issues & Solutions

### Issue: Item appears at wrong position
**Cause**: Tiled Y coordinate is top-left; game uses bottom-left
**Solution**: Subtract height when creating sprite (`y - height`)

### Issue: Scenario object not appearing
**Cause**: No matching Tiled item (checked by type)
**Cure**: Add item to Tiled map with matching type image, or item is in inventory

### Issue: Duplicate visuals
**Cause**: Same Tiled item used twice
**Solution**: Tracked by `usedItems` Set - shouldn't happen

### Issue: Wrong depth/layering
**Cause**: Depth not set based on Y position
**Solution**: Verify `setDepth()` called with `objectBottomY + 0.5`

---

## Glossary

| Term | Definition |
|------|-----------|
| **GID** | Global ID in Tiled - identifies which sprite/image |
| **Tileset** | Collection of sprites/images |
| **Object Layer** | Layer in Tiled map containing interactive objects |
| **Scenario Object** | Item defined in scenario JSON (has properties) |
| **Tiled Item** | Sprite placed in Tiled map (has position) |
| **Matching** | Process of linking scenario object to Tiled item |
| **Merging** | Combining Tiled position + scenario properties |
| **Depth** | Z-order for rendering (higher = on top) |

---

## Next Steps

### To Understand the System
→ Start with README_ROOM_LOADING.md

### To Improve the System
→ Review README_ROOM_LOADING_IMPROVEMENTS.md
→ Implement Phase 1-3 improvements

### To Debug Issues
→ Check console logs
→ Verify scenario vs Tiled data matches
→ Inspect `window.rooms` in developer tools

---

## Document History

- **Created**: October 21, 2025
- **Status**: Documentation complete, improvements documented
- **Files**: 
  - README_ROOM_LOADING.md (current system)
  - README_ROOM_LOADING_IMPROVEMENTS.md (proposed improvements)
  - ROOM_LOADING_SUMMARY.md (this file)

---

**For questions or clarifications**, refer to the detailed sections in the main documentation files.
