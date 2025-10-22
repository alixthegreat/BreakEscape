# Server-Client Migration: Code Examples

## Before & After Comparisons

---

## Change 1: Load Room Function

### Current Implementation (Local JSON)

```javascript
// js/core/rooms.js (lines 455-468)
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
    revealRoom(roomId);
}
```

### Server-Client Implementation

```javascript
// js/core/rooms.js (Modified)
async function loadRoom(roomId) {
    const position = window.roomPositions[roomId];
    
    if (!position) {
        console.error(`Cannot load room ${roomId}: missing position`);
        return;
    }
    
    // Fetch room data from server instead of local gameScenario
    let roomData;
    try {
        const response = await fetch(`/api/rooms/${roomId}`, {
            headers: {
                'Authorization': `Bearer ${window.playerToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        roomData = await response.json();
    } catch (error) {
        console.error(`Failed to fetch room ${roomId}:`, error);
        
        // Show error to player
        if (window.showNotification) {
            window.showNotification(`Failed to load room: ${error.message}`, 'error');
        }
        return;
    }
    
    console.log(`Lazy loading room: ${roomId}`);
    createRoom(roomId, roomData, position);
    revealRoom(roomId);
}
```

**Changes:**
- ✅ Function is now `async`
- ✅ Fetch from `/api/rooms/{roomId}` instead of `gameScenario.rooms[roomId]`
- ✅ Add authorization header
- ✅ Handle network errors gracefully
- ✅ Everything else stays the same

---

## Change 2: Preload Function

### Current Implementation (Local JSON)

```javascript
// js/core/game.js (lines 395-400)
export function preload() {
    // ... load Tiled maps and images ...
    
    // Get scenario from URL parameter or use default
    const urlParams = new URLSearchParams(window.location.search);
    const scenarioFile = urlParams.get('scenario') || 'scenarios/ceo_exfil.json';
    
    // Load the specified scenario
    this.load.json('gameScenarioJSON', scenarioFile);
}
```

### Server-Client Implementation

```javascript
// js/core/game.js (Modified)
export function preload() {
    // ... load Tiled maps and images (UNCHANGED) ...
    
    // REMOVED: No longer load full scenario JSON at startup
    // this.load.json('gameScenarioJSON', scenarioFile);
    
    // Instead, fetch minimal scenario metadata from server
    // This will be done in create() phase
}
```

**Changes:**
- ✅ Remove `this.load.json()` call for scenario
- ✅ Keep all Tiled map loading unchanged
- ✅ Keep all image asset loading unchanged

---

## Change 3: Create Function (Scenario Bootstrap)

### Current Implementation (Local JSON)

```javascript
// js/core/game.js (lines 412-416)
export function create() {
    // ...
    
    // Ensure gameScenario is loaded before proceeding
    if (!window.gameScenario) {
        window.gameScenario = this.cache.json.get('gameScenarioJSON');
    }
    gameScenario = window.gameScenario;
    
    // ...
}
```

### Server-Client Implementation

```javascript
// js/core/game.js (Modified)
export async function create() {
    // ...
    
    // Fetch minimal scenario metadata from server
    if (!window.gameScenario) {
        try {
            const response = await fetch('/api/scenario/metadata', {
                headers: {
                    'Authorization': `Bearer ${window.playerToken}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load scenario metadata');
            }
            
            window.gameScenario = await response.json();
        } catch (error) {
            console.error('Failed to fetch scenario metadata:', error);
            window.gameScenario = {
                startRoom: 'room_reception',
                scenarioName: 'Cyber Heist'
                // Minimal defaults
            };
        }
    }
    gameScenario = window.gameScenario;
    
    // ... rest of create() continues unchanged ...
}
```

**Expected Server Response:**
```json
{
    "startRoom": "room_reception",
    "scenarioName": "Cyber Heist",
    "scenarioBrief": "...",
    "timeLimit": null
}
```

**Note:** This should NOT include individual room data - only metadata.

---

## Change 4: Initial Inventory Processing

### Current Implementation (Local JSON)

```javascript
// js/systems/inventory.js (lines 41-66)
export function processInitialInventoryItems() {
    console.log('Processing initial inventory items');
    
    if (!window.gameScenario || !window.gameScenario.rooms) {
        console.error('Game scenario not loaded');
        return;
    }
    
    // Loop through ALL rooms in scenario to find initial items
    Object.entries(window.gameScenario.rooms).forEach(([roomId, roomData]) => {
        if (roomData.objects && Array.isArray(roomData.objects)) {
            roomData.objects.forEach(obj => {
                if (obj.inInventory === true) {
                    console.log(`Adding ${obj.name} to inventory from scenario data`);
                    const inventoryItem = createInventorySprite(obj);
                    if (inventoryItem) {
                        addToInventory(inventoryItem);
                    }
                }
            });
        }
    });
}
```

### Server-Client Implementation

```javascript
// js/systems/inventory.js (Modified)
export async function processInitialInventoryItems() {
    console.log('Processing initial inventory items');
    
    if (!window.gameScenario || !window.gameScenario.startRoom) {
        console.error('Game scenario metadata not loaded');
        return;
    }
    
    // Fetch only the starting room data
    try {
        const response = await fetch(`/api/rooms/${window.gameScenario.startRoom}`, {
            headers: {
                'Authorization': `Bearer ${window.playerToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch starting room: ${response.status}`);
        }
        
        const roomData = await response.json();
        
        if (roomData.objects && Array.isArray(roomData.objects)) {
            roomData.objects.forEach(obj => {
                if (obj.inInventory === true) {
                    console.log(`Adding ${obj.name} to inventory from scenario data`);
                    const inventoryItem = createInventorySprite(obj);
                    if (inventoryItem) {
                        addToInventory(inventoryItem);
                    }
                }
            });
        }
    } catch (error) {
        console.error('Failed to process initial inventory items:', error);
        // Continue without initial items - player can pick them up from room
    }
}
```

**Changes:**
- ✅ Function is now `async`
- ✅ Only fetches starting room instead of all rooms
- ✅ Fetch from `/api/rooms/{startRoomId}`
- ✅ Add authorization header
- ✅ Handle errors gracefully (game continues if fetch fails)
- ✅ Process only initial items same way

---

## Change 5: Calling create() from main.js

### Current Implementation

```javascript
// js/main.js (lines 48-64)
function initializeGame() {
    const config = {
        ...GAME_CONFIG,
        scene: {
            preload: preload,
            create: create,      // <-- Phaser calls this
            update: update
        }
    };
    
    window.game = new Phaser.Game(config);
    // ...
}
```

### Server-Client Note

Since `create()` is now async, Phaser will handle it natively in Phaser 3.55+:
- ✅ No changes needed
- ✅ Phaser automatically waits for async scene functions
- ✅ If using older Phaser, return a Promise from create()

```javascript
// Alternative for older Phaser versions
export function create() {
    return (async () => {
        // ... all async code here ...
    })();
}
```

---

## Change 6: Optional - Race Condition Prevention

```javascript
// js/core/rooms.js (Add near top of module)
const loadingRooms = new Set();

async function loadRoom(roomId) {
    // Prevent duplicate requests for same room
    if (loadingRooms.has(roomId)) {
        console.log(`Room ${roomId} already loading, skipping duplicate request`);
        return;
    }
    
    loadingRooms.add(roomId);
    try {
        const position = window.roomPositions[roomId];
        
        if (!position) {
            console.error(`Cannot load room ${roomId}: missing position`);
            return;
        }
        
        // Fetch and create room...
        const response = await fetch(`/api/rooms/${roomId}`, {
            headers: {
                'Authorization': `Bearer ${window.playerToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }
        
        const roomData = await response.json();
        createRoom(roomId, roomData, position);
        revealRoom(roomId);
    } catch (error) {
        console.error(`Failed to fetch room ${roomId}:`, error);
        if (window.showNotification) {
            window.showNotification(`Failed to load room: ${error.message}`, 'error');
        }
    } finally {
        loadingRooms.delete(roomId);
    }
}
```

---

## Change 7: Optional - Caching Strategy

```javascript
// js/core/rooms.js (Add cache management)
const roomCache = new Map();

async function loadRoom(roomId) {
    // Check cache first
    if (roomCache.has(roomId)) {
        console.log(`Using cached room data for ${roomId}`);
        const roomData = roomCache.get(roomId);
        const position = window.roomPositions[roomId];
        createRoom(roomId, roomData, position);
        revealRoom(roomId);
        return;
    }
    
    // ... fetch from server ...
    
    // Cache the result
    roomCache.set(roomId, roomData);
    
    // ... create room ...
}

// Optional: Prefetch adjacent rooms in background
function prefetchAdjacentRooms(roomId) {
    const adjacentRoomIds = window.gameScenario.roomConnections?.[roomId] || [];
    
    adjacentRoomIds.forEach(adjacentId => {
        if (!roomCache.has(adjacentId)) {
            // Start prefetch but don't await
            fetch(`/api/rooms/${adjacentId}`, {
                headers: {
                    'Authorization': `Bearer ${window.playerToken}`
                }
            })
            .then(r => r.json())
            .then(data => {
                roomCache.set(adjacentId, data);
                console.log(`Prefetched room ${adjacentId}`);
            })
            .catch(err => console.log(`Prefetch failed for ${adjacentId}:`, err));
        }
    });
}
```

---

## Server API Endpoints Required

### 1. Scenario Metadata

```
GET /api/scenario/metadata
Authorization: Bearer {token}

Response:
{
    "startRoom": "room_reception",
    "scenarioName": "Cyber Heist",
    "scenarioBrief": "Break into...",
    "timeLimit": null,
    "roomConnections": {
        "room_reception": ["room_office"],
        "room_office": ["room_reception", "room_ceo"]
    }
}
```

### 2. Room Data

```
GET /api/rooms/{roomId}
Authorization: Bearer {token}

Response:
{
    "connections": {
        "south": "office1"
    },
    "locked": true,
    "lockType": "password",
    "requires": "password123",
    "objects": [
        {
            "type": "pc",
            "name": "Computer",
            "takeable": false,
            "locked": true,
            "lockType": "password",
            "requires": "password123",
            "observations": "..."
        }
    ]
}
```

---

## Testing Checklist

- [ ] **Network Calls:**
  - [ ] POST `/api/scenario/metadata` returns correct data
  - [ ] GET `/api/rooms/{roomId}` returns correct room data
  - [ ] Authorization headers are validated
  - [ ] 401 Unauthorized returns proper error

- [ ] **Client Behavior:**
  - [ ] Rooms load when player approaches
  - [ ] Properties are applied correctly from server data
  - [ ] No visual glitches or missing sprites
  - [ ] Interactions work (locks, containers, etc.)

- [ ] **Error Handling:**
  - [ ] Network timeout shows error message
  - [ ] Server error (500) shows error message
  - [ ] Player can retry loading room
  - [ ] Game doesn't crash if fetch fails

- [ ] **Performance:**
  - [ ] Room loads within 500ms on good network
  - [ ] No "flash" of invisible sprites
  - [ ] Concurrent room requests handled properly
  - [ ] Memory doesn't leak with many rooms loaded

- [ ] **Edge Cases:**
  - [ ] Player rapidly moves between rooms
  - [ ] Player approaches multiple rooms at once
  - [ ] Server is slow/unresponsive
  - [ ] Network disconnects mid-load

---

## Rollback Plan

If issues arise, simply revert to local loading:

```javascript
// js/core/rooms.js
function loadRoom(roomId) {
    const gameScenario = window.gameScenario;
    const roomData = gameScenario.rooms[roomId];  // Back to local
    const position = window.roomPositions[roomId];
    
    if (!roomData || !position) {
        console.error(`Cannot load room ${roomId}: missing data or position`);
        return;
    }
    
    console.log(`Lazy loading room: ${roomId}`);
    createRoom(roomId, roomData, position);
    revealRoom(roomId);
}
```

Then rebuild with `this.load.json('gameScenarioJSON', scenarioFile)` in preload.

---

## Estimated Timeline

- **Analysis & Planning:** 1 hour
- **API Endpoint Development:** 2-3 hours
- **Client Code Changes:** 2-3 hours
- **Testing & Debugging:** 2-3 hours
- **Deployment & Monitoring:** 1-2 hours

**Total:** 8-12 hours for complete migration

