# Room Loading System - Proposed Improvements

## Executive Summary

The current room loading system successfully coordinates Scenario JSON and Tiled Map data. However, there is an opportunity to **refactor the matching algorithm** to be more explicit and maintainable by:

1. **Centralize item matching logic** into a dedicated matching function
2. **Unify the approach** for all item types (regular items, conditional items, table items)
3. **Improve separation of concerns** between visual (Tiled) and logical (Scenario) data
4. **Make the system more testable** with clear input/output contracts

---

## Current Approach Analysis

### Strengths

✅ **Type-based matching works well**: Objects are matched by type (key, phone, notes, etc.)
✅ **De-duplication system prevents duplicate visuals**: Used items are tracked effectively
✅ **Fallback handling**: Missing matches get random placement
✅ **Property merging**: Scenario data is applied to matched sprites

### Current Flow

```
Scenario Objects → Type Lookup → Find Tiled Item → Create Sprite → Apply Properties
                 (scattered)     (in function)     (inline)        (inline)
```

### Challenges

❌ **Matching logic is embedded** in `processScenarioObjectsWithConditionalMatching()`
❌ **Three separate item maps** (regular, conditional, conditional_table) managed manually
❌ **Hard to test** matching logic in isolation
❌ **Order-dependent**: Items are removed from arrays with `.shift()`
❌ **Limited filtering**: Only supports type matching, no additional criteria

---

## Proposed Improved Approach

### New Architecture

```
┌──────────────────────────────┐
│   Scenario Objects           │
│   (what should be present)   │
└────────────────┬─────────────┘
                 │
                 ▼
    ┌────────────────────────────┐
    │  Item Matching Engine      │
    │  (Centralized Logic)       │
    │                            │
    │  1. Search all layers      │
    │  2. Match by criteria      │
    │  3. Reserve item           │
    │  4. Return match           │
    └────────────┬───────────────┘
                 │
         ┌───────┴────────┐
         ▼                ▼
    ┌─────────────┐  ┌──────────────┐
    │ Tiled Items │  │ Match Result │
    │ (Position & │  │ (Item + Type)│
    │  Sprite)    │  └──────────────┘
    └─────────────┘        │
                           ▼
                ┌──────────────────┐
                │ Create Sprite    │
                │ (Position from   │
                │  Tiled)          │
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │ Apply Properties │
                │ (Data from       │
                │  Scenario)       │
                └──────────────────┘
```

### Key Improvements

1. **Centralized Matching Function**
   - Single source of truth for matching logic
   - Clear responsibility: find best matching Tiled item for scenario object
   - Easier to debug and modify

2. **Item Pool Management**
   - Unified data structure for all items (regular + conditional)
   - Track availability explicitly
   - Reserve items instead of consuming with `.shift()`

3. **Clear Separation**
   - Matching: Find the visual representation
   - Merging: Combine visual (Tiled) + logical (Scenario) data
   - Rendering: Display the result

---

## Implementation Plan

### Step 1: Create Item Matching Module

Create a new function `matchScenarioObjectToTiledItem()`:

```javascript
/**
 * Matches a scenario object to an available Tiled item sprite
 * 
 * @param {Object} scenarioObj - The scenario object definition
 * @param {Object} availableItems - Collections of available Tiled items
 * @param {Set} reservedItems - Items already matched/reserved
 * @returns {Object|null} Matched Tiled item or null if no match found
 * 
 * @example
 * const match = matchScenarioObjectToTiledItem(
 *   { type: 'key', name: 'Office Key' },
 *   { items: [...], conditionalItems: [...], tableItems: [...] },
 *   reservedItemsSet
 * );
 * // Returns: { gid: 243, x: 100, y: 150, imageName: 'key' }
 */
function matchScenarioObjectToTiledItem(
    scenarioObj, 
    availableItems, 
    reservedItems
) {
    const searchType = scenarioObj.type;
    
    // Search priority: regular items → conditional items → table items
    const searchLayers = [
        { name: 'items', items: availableItems.items || [] },
        { name: 'conditionalItems', items: availableItems.conditionalItems || [] },
        { name: 'conditionalTableItems', items: availableItems.conditionalTableItems || [] }
    ];
    
    for (const layer of searchLayers) {
        for (const tiledItem of layer.items) {
            // Skip if already reserved
            const itemId = getItemIdentifier(tiledItem);
            if (reservedItems.has(itemId)) {
                continue;
            }
            
            // Extract type from image name
            const imageName = getImageNameFromObject(tiledItem);
            const baseType = extractBaseTypeFromImageName(imageName);
            
            // Match by type
            if (baseType === searchType) {
                return {
                    tiledItem,
                    imageName,
                    baseType,
                    layer: layer.name
                };
            }
        }
    }
    
    return null;
}
```

### Step 2: Create Item Pool Manager

```javascript
/**
 * Manages the collection of available Tiled items
 */
class TiledItemPool {
    constructor(objectsByLayer, map) {
        this.items = {};
        this.conditionalItems = {};
        this.conditionalTableItems = {};
        this.reserved = new Set();
        
        this.populateFromLayers(objectsByLayer);
    }
    
    populateFromLayers(objectsByLayer) {
        this.items = this.indexByType(objectsByLayer.items || []);
        this.conditionalItems = this.indexByType(objectsByLayer.conditional_items || []);
        this.conditionalTableItems = this.indexByType(objectsByLayer.conditional_table_items || []);
    }
    
    indexByType(items) {
        const indexed = {};
        items.forEach(item => {
            const imageName = getImageNameFromObject(item);
            const baseType = extractBaseTypeFromImageName(imageName);
            
            if (!indexed[baseType]) {
                indexed[baseType] = [];
            }
            indexed[baseType].push(item);
        });
        return indexed;
    }
    
    findMatchFor(scenarioObj) {
        const searchType = scenarioObj.type;
        
        // Try each layer in priority order
        for (const indexedItems of [this.items, this.conditionalItems, this.conditionalTableItems]) {
            const candidates = indexedItems[searchType] || [];
            
            for (const item of candidates) {
                const itemId = getItemIdentifier(item);
                if (!this.reserved.has(itemId)) {
                    return item;
                }
            }
        }
        
        return null;
    }
    
    reserve(tiledItem) {
        const itemId = getItemIdentifier(tiledItem);
        this.reserved.add(itemId);
    }
    
    isReserved(tiledItem) {
        const itemId = getItemIdentifier(tiledItem);
        return this.reserved.has(itemId);
    }
    
    getUnreservedItems() {
        // Return all non-reserved items for processing
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
        
        collectUnreserved(this.items);
        collectUnreserved(this.conditionalItems);
        collectUnreserved(this.conditionalTableItems);
        
        return unreserved;
    }
}
```

### Step 3: Refactor processScenarioObjectsWithConditionalMatching

**Old approach**: Loop through scenarios, search for items, consume with `.shift()`

**New approach**: Use centralized matching, then process all scenarios uniformly

```javascript
function processScenarioObjectsWithConditionalMatching(roomId, position, objectsByLayer) {
    const gameScenario = window.gameScenario;
    if (!gameScenario.rooms[roomId].objects) {
        return new Set();
    }
    
    // 1. Initialize item pool
    const itemPool = new TiledItemPool(objectsByLayer);
    const usedItems = new Set();
    
    console.log(`Processing ${gameScenario.rooms[roomId].objects.length} scenario objects for room ${roomId}`);
    
    // 2. Process each scenario object
    gameScenario.rooms[roomId].objects.forEach((scenarioObj, index) => {
        // Skip inventory items
        if (scenarioObj.inInventory) {
            return;
        }
        
        // Find matching Tiled item
        const match = itemPool.findMatchFor(scenarioObj);
        
        if (match) {
            // Item found - use it
            const sprite = createSpriteFromMatch(match, scenarioObj, position, roomId, index);
            itemPool.reserve(match);
            usedItems.add(getImageNameFromObject(match));
            usedItems.add(extractBaseTypeFromImageName(getImageNameFromObject(match)));
            
            console.log(`✓ Matched ${scenarioObj.type} to visual item`);
        } else {
            // No item found - create at random position
            const sprite = createSpriteAtRandomPosition(scenarioObj, position, roomId, index);
            console.log(`✗ No visual match for ${scenarioObj.type} - created at random position`);
        }
    });
    
    // 3. Process unreserved Tiled items
    const unreservedItems = itemPool.getUnreservedItems();
    unreservedItems.forEach(tiledItem => {
        const imageName = getImageNameFromObject(tiledItem);
        const baseType = extractBaseTypeFromImageName(imageName);
        
        if (!usedItems.has(imageName) && !usedItems.has(baseType)) {
            createSpriteFromTiledItem(tiledItem, position, roomId, 'item');
        }
    });
    
    return usedItems;
}
```

### Step 4: Helper Functions

```javascript
/**
 * Create a unique identifier for a Tiled item
 */
function getItemIdentifier(tiledItem) {
    return `gid_${tiledItem.gid}_x${tiledItem.x}_y${tiledItem.y}`;
}

/**
 * Create sprite from a scenario object matched to a Tiled item
 */
function createSpriteFromMatch(tiledItem, scenarioObj, position, roomId, index) {
    const imageName = getImageNameFromObject(tiledItem);
    
    // Create sprite at Tiled position
    const sprite = gameRef.add.sprite(
        Math.round(position.x + tiledItem.x),
        Math.round(position.y + tiledItem.y - tiledItem.height),
        imageName
    );
    
    // Apply Tiled visual properties
    applyTiledProperties(sprite, tiledItem);
    
    // Apply scenario properties (override/enhance Tiled data)
    applyScenarioProperties(sprite, scenarioObj, roomId, index);
    
    // Set depth and store
    setDepthAndStore(sprite, position, roomId);
    
    return sprite;
}

/**
 * Apply visual/transform properties from Tiled item
 */
function applyTiledProperties(sprite, tiledItem) {
    sprite.setOrigin(0, 0);
    
    if (tiledItem.rotation) {
        sprite.setRotation(Phaser.Math.DegToRad(tiledItem.rotation));
    }
    
    if (tiledItem.flipX) {
        sprite.setFlipX(true);
    }
    
    if (tiledItem.flipY) {
        sprite.setFlipY(true);
    }
}

/**
 * Apply game logic properties from scenario
 */
function applyScenarioProperties(sprite, scenarioObj, roomId, index) {
    sprite.scenarioData = scenarioObj;
    sprite.interactable = true;
    sprite.name = scenarioObj.name;
    sprite.objectId = `${roomId}_${scenarioObj.type}_${index}`;
    sprite.setInteractive({ useHandCursor: true });
    
    // Store all scenario properties for interaction system
    Object.keys(scenarioObj).forEach(key => {
        sprite[key] = scenarioObj[key];
    });
}

/**
 * Set depth based on room position and elevation
 */
function setDepthAndStore(sprite, position, roomId) {
    const roomTopY = position.y;
    const backWallThreshold = roomTopY + (2 * TILE_SIZE);
    const itemBottomY = sprite.y + sprite.height;
    const elevation = itemBottomY < backWallThreshold ? (backWallThreshold - itemBottomY) : 0;
    
    const objectDepth = itemBottomY + 0.5 + elevation;
    sprite.setDepth(objectDepth);
    sprite.elevation = elevation;
    
    // Initially hide
    sprite.setVisible(false);
    
    // Store
    rooms[roomId].objects[sprite.objectId] = sprite;
}
```

---

## Benefits of This Approach

### 1. **Testability**
```javascript
// Easy to test the matching function in isolation
const match = matchScenarioObjectToTiledItem(
    { type: 'key', name: 'Test Key' },
    { items: [mockKey1, mockKey2], ... },
    new Set()
);
expect(match).toBeDefined();
expect(match.baseType).toBe('key');
```

### 2. **Maintainability**
- Clear separation of concerns
- Matching logic not mixed with rendering
- Easier to add new matching criteria

### 3. **Debuggability**
```javascript
// Can log exactly what happened to each object
console.log(`Scenario: ${scenarioObj.type} → Matched: ${match ? 'YES' : 'NO'}`);
console.log(`Visual from: ${match.layer}`);
```

### 4. **Extensibility**
Can easily add new matching criteria:

```javascript
function findBestMatchFor(scenarioObj, itemPool, criteria = {}) {
    // Could support:
    // - Proximity matching (closest to expected position)
    // - Appearance matching (specific style/color)
    // - Priority matching (preferred item types)
    // - Constraint matching (must be table/floor item, etc.)
}
```

### 5. **Reusability**
The `TiledItemPool` class could be used elsewhere:
- For dynamic item placement
- For inventory system
- For content validation

---

## Migration Path

### Phase 1: Minimal (Current Implementation Kept)
- ✅ Document current system thoroughly
- ✅ Add helper functions for matching
- Keep existing `processScenarioObjectsWithConditionalMatching` working

### Phase 2: Refactor (Gradual Improvement)
- Create `TiledItemPool` class
- Create `matchScenarioObjectToTiledItem()` function
- Update `processScenarioObjectsWithConditionalMatching` to use new functions
- Test and debug

### Phase 3: Optimize (Full Implementation)
- Replace item `.shift()` calls with pool reservation
- Add full test coverage
- Performance optimize if needed

---

## Example: Before and After

### Current Code Flow
```javascript
// Current: Scattered logic
if (regularItemsByType[objType] && regularItemsByType[objType].length > 0) {
    usedItem = regularItemsByType[objType].shift();  // Consume with shift
    console.log(`Using regular item for ${objType}`);
}
else if (conditionalItemsByType[objType] && conditionalItemsByType[objType].length > 0) {
    usedItem = conditionalItemsByType[objType].shift();  // Another shift
    console.log(`Using conditional item for ${objType}`);
}
// ... more matching logic spread throughout function
```

### Improved Code Flow
```javascript
// Improved: Centralized matching
const match = itemPool.findMatchFor(scenarioObj);

if (match) {
    const sprite = createSpriteFromMatch(match, scenarioObj, position, roomId, index);
    itemPool.reserve(match);
    console.log(`✓ Matched ${scenarioObj.type} to visual`);
} else {
    const sprite = createSpriteAtRandomPosition(scenarioObj, position, roomId, index);
    console.log(`✗ No match for ${scenarioObj.type}`);
}
```

---

## Related Documentation

- **Current Implementation**: See `README_ROOM_LOADING.md`
- **Scenario Format**: See `README_scenario_design.md`
- **Architecture**: Room Loading System Design

---

## Questions for Review

1. Should the item pool maintain order (FIFO, closest proximity)?
2. Should there be a "preferred" item type for each scenario object?
3. Should matching support position-based proximity criteria?
4. Should the pool be cached/reused for multiple rooms?

---

## Conclusion

The proposed improvements maintain the strong foundations of the current system while making it more maintainable, testable, and extensible. The changes are backward-compatible and can be implemented gradually without disrupting current functionality.
