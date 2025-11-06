# NPC Per-Room Loading: Implementation Prompt

**Goal**: Restructure scenario files so NPCs are defined per room and loaded when that room loads, keeping existing code mostly untouched.

---

## What We're Changing

### Scenario JSON Format
**BEFORE**: All NPCs at root level with `roomId` field
```json
{
  "npcs": [
    { "id": "clerk", "npcType": "person", "roomId": "reception", ... },
    { "id": "helper", "npcType": "phone", "roomId": null, ... }
  ],
  "rooms": { "reception": { ... } }
}
```

**AFTER**: ALL NPCs defined per room (person and phone)
```json
{
  "npcs": [],  // ← Empty, all NPCs now in rooms
  "rooms": {
    "reception": {
      "npcs": [
        { "id": "clerk", "npcType": "person", ... },
        { "id": "helper", "npcType": "phone", "phoneId": "player_phone", ... }
      ],
      ...
    }
  }
}
```

**Special case**: Phone NPCs on phones in starting inventory are loaded with the starting room.

### Code Changes
1. **Create** `js/systems/npc-lazy-loader.js` - loads NPCs when room enters
2. **Update** `js/main.js` - initialize lazy loader
3. **Update** `js/core/game.js` - remove root NPC registration AND load starting room NPCs
4. **Update** `js/core/rooms.js` - make `loadRoom()` async and load NPCs for lazy-loaded rooms
5. **Update** `js/systems/doors.js` - update call site to handle async `loadRoom()`

**Critical**: 
- Room NPCs must load BEFORE room visuals are created
- Starting room NPCs load in `game.js` BEFORE `processInitialInventoryItems()` is called
- `loadRoom()` becomes async (future-proofs for server-based loading)

**Note**: NPCs stay loaded once registered (no unloading needed - simpler implementation).

---

## Quick Todo Checklist

Use this checklist to track implementation progress:

- [ ] **Step 1**: Move NPCs from root `npcs[]` to room `npcs[]` in all scenario files
  - [ ] `scenarios/ceo_exfil.json`
  - [ ] `scenarios/npc-sprite-test2.json`
  - [ ] `scenarios/biometric_breach.json` (if has NPCs)
  - [ ] Validate JSON: `python3 -m json.tool scenarios/*.json > /dev/null`

- [ ] **Step 2**: Create `js/systems/npc-lazy-loader.js` (copy code from Step 2)

- [ ] **Step 3**: Update `js/main.js`
  - [ ] Add import: `import NPCLazyLoader from './systems/npc-lazy-loader.js?v=1';`
  - [ ] Initialize: `window.npcLazyLoader = new NPCLazyLoader(window.npcManager);`

- [ ] **Step 4**: Update `js/core/game.js`
  - [ ] Part A: Delete root NPC registration block (lines ~462-468)
  - [ ] Part B: Add NPC loading for starting room (before createRoom, lines ~557-563)

- [ ] **Step 5**: Update room loading
  - [ ] Part A: Make `loadRoom()` async in `js/core/rooms.js` (line ~513)
  - [ ] Part B: Update call site in `js/systems/doors.js` (line ~362)

- [ ] **Test**: Run game and verify all test scenarios work

---

## Step-by-Step Implementation

### Step 1: Update Scenario Files (15-30 min)

Move ALL NPCs (person and phone) from root `npcs[]` to their room's `npcs[]` array.

**Files to update**:
- `scenarios/ceo_exfil.json`
- `scenarios/npc-sprite-test2.json`
- `scenarios/biometric_breach.json` (if has NPCs)

**Example transformation**:
```json
// OLD: scenarios/ceo_exfil.json
{
  "npcs": [
    { "id": "guard1", "npcType": "person", "roomId": "lobby", ... },
    { "id": "admin", "npcType": "phone", "roomId": null, ... }
  ]
}

// NEW: scenarios/ceo_exfil.json  
{
  "npcs": [],  // ← Now empty
  "rooms": {
    "lobby": {
      "npcs": [
        { "id": "guard1", "npcType": "person", ... },  // ← Person NPC, remove roomId
        { "id": "admin", "npcType": "phone", "phoneId": "player_phone", ... }  // ← Phone NPC also here
      ],
      ...
    }
  }
}
```

**Phone NPC rules**:
- If phone is an object in the starting room → define phone NPC in that room
- If phone is in `startItemsInInventory` → define phone NPC in the starting room (player starts there)

**Validation**: `python3 -m json.tool scenarios/*.json > /dev/null`

---

### Step 2: Create NPCLazyLoader (20-30 min)

Create `js/systems/npc-lazy-loader.js`:

```javascript
/**
 * NPCLazyLoader - Loads NPCs per-room on demand
 * Future-proofed for server-based NPC loading
 */
export default class NPCLazyLoader {
  constructor(npcManager) {
    this.npcManager = npcManager;
    this.loadedRooms = new Set();
  }

  /**
   * Load all NPCs for a specific room
   * @param {string} roomId - Room identifier
   * @param {object} roomData - Room data containing npcs array
   * @returns {Promise<void>}
   */
  async loadNPCsForRoom(roomId, roomData) {
    // Skip if already loaded or no NPCs
    if (this.loadedRooms.has(roomId) || !roomData?.npcs?.length) {
      return;
    }
    
    console.log(`📦 Loading ${roomData.npcs.length} NPCs for room ${roomId}`);
    
    // Load all Ink stories in parallel (optimization)
    const storyPromises = roomData.npcs
      .filter(npc => npc.storyPath && !window.game?.cache?.json?.has?.(npc.storyPath))
      .map(npc => this._loadStory(npc.storyPath));
    
    if (storyPromises.length > 0) {
      console.log(`📖 Loading ${storyPromises.length} Ink stories for room ${roomId}`);
      await Promise.all(storyPromises);
    }
    
    // Register NPCs (synchronous now that stories are cached)
    for (const npcDef of roomData.npcs) {
      npcDef.roomId = roomId;  // Add roomId for compatibility
      
      // registerNPC accepts either registerNPC(id, opts) or registerNPC({ id, ...opts })
      // We use the second form - passing the full object
      this.npcManager.registerNPC(npcDef);
      console.log(`✅ Registered NPC: ${npcDef.id} (${npcDef.npcType}) in room ${roomId}`);
    }
    
    this.loadedRooms.add(roomId);
  }

  /**
   * Load an Ink story file
   * @private
   */
  async _loadStory(storyPath) {
    try {
      const response = await fetch(storyPath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const story = await response.json();
      window.game.cache.json.add(storyPath, story);
      console.log(`✅ Loaded story: ${storyPath}`);
    } catch (error) {
      console.error(`❌ Failed to load story: ${storyPath}`, error);
      throw error; // Re-throw to allow caller to handle
    }
  }
}
```

**Key improvements**:
- Parallel story loading for better performance
- Better error handling with re-throw
- Detailed console logging for debugging
- Future-ready for server API (just change `_loadStory` implementation)

**Note**: NPCs stay loaded once their room is entered. No unloading needed - keeps implementation simple.

---

### Step 3: Initialize Lazy Loader (5 min)

In `js/main.js`, add import at top and initialize after npcManager:

**Location**: After line 17 (after NPCBarkSystem import), add:
```javascript
import NPCLazyLoader from './systems/npc-lazy-loader.js?v=1';
```

**Location**: Around line 81-84 in `initializeGame()`, after `window.npcManager` is created:
```javascript
// After: window.npcManager = new NPCManager(window.eventDispatcher, window.barkSystem);
window.npcLazyLoader = new NPCLazyLoader(window.npcManager);
console.log('✅ NPC lazy loader initialized');
```

---

### Step 4: Update Game Initialization (15 min)

**Part A: Remove root NPC registration**

In `js/core/game.js`, find where NPCs are registered (around **line 462-468**) and **REMOVE** it:

```javascript
// OLD CODE - DELETE THIS BLOCK:
if (gameScenario.npcs && window.npcManager) {
    console.log('📱 Loading NPCs from scenario:', gameScenario.npcs.length);
    gameScenario.npcs.forEach(npc => {
        console.log(`📝 NPC from scenario - id: ${npc.id}, spriteTalk: ${npc.spriteTalk}, spriteSheet: ${npc.spriteSheet}`);
        console.log(`📝 Full NPC object:`, npc);
        window.npcManager.registerNPC(npc);
        console.log(`✅ Registered NPC: ${npc.id} (${npc.displayName})`);
    });
}
```

**Part B: Load starting room NPCs**

In `js/core/game.js`, find the starting room creation (around **line 557-563**) and add NPC loading:

**BEFORE:**
```javascript
// Create only the starting room initially
const roomPositions = calculateRoomPositions(this);
const startingRoomData = gameScenario.rooms[gameScenario.startRoom];
const startingRoomPosition = roomPositions[gameScenario.startRoom];

if (startingRoomData && startingRoomPosition) {
    createRoom(gameScenario.startRoom, startingRoomData, startingRoomPosition);
    revealRoom(gameScenario.startRoom);
} else {
    console.error('Failed to create starting room');
}
```

**AFTER:**
```javascript
// Create only the starting room initially
const roomPositions = calculateRoomPositions(this);
const startingRoomData = gameScenario.rooms[gameScenario.startRoom];
const startingRoomPosition = roomPositions[gameScenario.startRoom];

if (startingRoomData && startingRoomPosition) {
    // Load NPCs for starting room BEFORE creating room visuals
    // This ensures phone NPCs are registered before processInitialInventoryItems() is called
    if (window.npcLazyLoader && startingRoomData) {
        await window.npcLazyLoader.loadNPCsForRoom(
            gameScenario.startRoom, 
            startingRoomData
        );
        console.log(`✅ Loaded NPCs for starting room: ${gameScenario.startRoom}`);
    }
    
    createRoom(gameScenario.startRoom, startingRoomData, startingRoomPosition);
    revealRoom(gameScenario.startRoom);
} else {
    console.error('Failed to create starting room');
}
```

**Why this placement?**
- The `create()` function is already async (Phaser Scene lifecycle)
- NPCs load BEFORE `processInitialInventoryItems()` is called (which happens later in the lifecycle)
- Phone NPCs are registered before phones in starting inventory are processed

---

### Step 5: Update Room Loading System (15 min)

**Part A: Make loadRoom() async in js/core/rooms.js**

In `js/core/rooms.js`, find the `loadRoom()` function (around **line 513**) and update it:

**BEFORE:**
```javascript
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
    
    // Reveal (make visible) but do NOT mark as discovered
    // The room will only be marked as "discovered" when the player
    // actually enters it via door transition
    revealRoom(roomId);
}
```

**AFTER:**
```javascript
async function loadRoom(roomId) {
    const gameScenario = window.gameScenario;
    const roomData = gameScenario.rooms[roomId];
    const position = window.roomPositions[roomId];
    
    if (!roomData || !position) {
        console.error(`Cannot load room ${roomId}: missing data or position`);
        return;
    }
    
    console.log(`Lazy loading room: ${roomId}`);
    
    // Load NPCs BEFORE creating room visuals
    // This ensures NPCs are registered before room objects/sprites are created
    if (window.npcLazyLoader && roomData) {
        try {
            await window.npcLazyLoader.loadNPCsForRoom(roomId, roomData);
        } catch (error) {
            console.error(`Failed to load NPCs for room ${roomId}:`, error);
            // Continue with room creation even if NPC loading fails
        }
    }
    
    createRoom(roomId, roomData, position);
    
    // Reveal (make visible) but do NOT mark as discovered
    // The room will only be marked as "discovered" when the player
    // actually enters it via door transition
    revealRoom(roomId);
}
```

**Important**: Change `function loadRoom` to `async function loadRoom` and add `export`:
```javascript
export async function loadRoom(roomId) {
```

**Part B: Update call site in js/systems/doors.js**

In `js/systems/doors.js`, find where `loadRoom()` is called (around **line 362**) and update:

**BEFORE:**
```javascript
if (window.loadRoom) {
    window.loadRoom(props.connectedRoom);
}
```

**AFTER:**
```javascript
if (window.loadRoom) {
    // loadRoom is now async - fire and forget for door transitions
    window.loadRoom(props.connectedRoom).catch(err => {
        console.error(`Failed to load room ${props.connectedRoom}:`, err);
    });
}
```

**Why async?**
- Future-proofs for server-based room/NPC loading
- Allows proper await of async NPC story loading
- Minimal breaking changes (only one call site to update)
- When adding server API later, no caller changes needed

**Note**: The existing `createNPCSpritesForRoom()` function already filters by `roomId`, so it will automatically work with the new format.

---

## Testing Checklist

After implementation, verify:

- [ ] Game loads without errors
- [ ] Phone NPCs appear on phone when entering their room
- [ ] Phone NPCs on phones in starting inventory appear immediately (starting room loads first)
- [ ] Person NPCs appear when entering their room
- [ ] NPCs have correct sprites and positions
- [ ] NPC dialogue works (Ink stories load)
- [ ] Timed barks fire correctly (NPCs registered before barks scheduled)
- [ ] Moving between rooms works
- [ ] Console shows "Loading X NPCs for room Y" messages
- [ ] No "NPC not found" errors

**Test scenarios**:
1. `ceo_exfil.json` - full scenario test with phone contacts
2. `npc-sprite-test2.json` - sprite rendering test

**Specific tests**:
- Phone in starting inventory → Contact should appear on phone immediately
- Phone object in room → Contact should appear when room entered
- Timed bark from phone NPC → Should fire after NPC loaded

**Manual test**:
```bash
python3 -m http.server
# Open: http://localhost:8000/scenario_select.html
# Select scenario and play through
```

---

## Expected Console Output

```
✅ NPC lazy loader initialized
Loading 2 NPCs for room reception
✅ Registered NPC: desk_clerk in room reception
✅ Registered NPC: helper_npc in room reception
✅ Created sprite for NPC: desk_clerk
(Starting inventory added - phone appears with helper_npc already registered)
```

**Order matters**:
1. Game initialization begins
2. Lazy loader initialized (`js/main.js`)
3. Starting room NPCs loaded (`js/core/game.js` - before room creation)
4. Starting room created (`createRoom()`)
5. Starting inventory processed (`processInitialInventoryItems()`) → Phone appears with contacts ready
6. Timed barks start (`window.npcManager.startTimedMessages()`) → NPCs already registered

---

## Troubleshooting

**"NPC not found"**: Check scenario JSON has ALL NPCs in room `npcs[]` arrays (not at root)

**"Contact not appearing on phone in starting inventory"**: Verify phone NPC is defined in starting room (where player spawns)

**"Timed bark fires but NPC not found"**: Ensure NPCs load BEFORE timed message system initializes (check `loadRoom()` order)

**"Sprite sheet not found"**: Verify person NPC has `spriteSheet` and `spriteConfig` fields

**"Story failed to load"**: Check `storyPath` is correct and file exists

**NPCs don't appear**: Check console for errors, verify `loadRoom()` calls lazy loader early in function

**Phone contacts missing**: Check that phone NPC is in the same room as the phone object, or in starting room if phone in `startItemsInInventory`

---

## Files Modified Summary

**Created**:
- `js/systems/npc-lazy-loader.js`

**Modified**:
- `js/main.js` (initialize lazy loader)
- `js/core/game.js` (remove root NPC registration, load starting room NPCs)
- `js/core/rooms.js` (make loadRoom async, call lazy loader)
- `js/systems/doors.js` (update loadRoom call site for async)
- `scenarios/ceo_exfil.json` (restructure NPCs)
- `scenarios/npc-sprite-test2.json` (restructure NPCs)
- `scenarios/biometric_breach.json` (restructure NPCs, if applicable)

---

## Success Criteria

✅ Implementation is complete when:
1. All scenario files restructured (ALL NPCs in rooms, root `npcs[]` empty)
2. NPCs load when room enters (lazy-loading works for person AND phone NPCs)
3. Phone NPCs on phones in starting inventory appear immediately
4. Timed barks fire correctly (after NPCs registered)
5. Game plays normally with no regressions
6. Console output is clean and shows correct loading order
7. All test scenarios work

**Total Time**: ~2-2.5 hours for complete implementation

**Key Success Indicator**: Phone contacts appear on phones in starting inventory without errors, and timed messages work correctly.

---

## Future Server Migration Path

Making `loadRoom()` async now prepares for server-based loading. Future changes will be minimal:

```javascript
// Future: js/systems/npc-lazy-loader.js
async _loadStory(storyPath) {
  // Change fetch URL to server endpoint
  const response = await fetch(`/api/stories/${encodeURIComponent(storyPath)}`);
  // Rest stays the same
}

// Future: js/core/rooms.js  
async function loadRoom(roomId) {
  // Add server fetch for room data
  const response = await fetch(`/api/rooms/${roomId}`);
  const roomData = await response.json();
  
  // Rest of function stays the same
  if (window.npcLazyLoader && roomData) {
    await window.npcLazyLoader.loadNPCsForRoom(roomId, roomData);
  }
  // ... etc
}
```

**No caller changes needed** - `doors.js` already handles async properly.

---

**Start with Step 1 (scenario files), then proceed sequentially through Step 5. Test after Step 5.**
