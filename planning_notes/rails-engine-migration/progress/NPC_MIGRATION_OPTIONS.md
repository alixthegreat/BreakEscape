# NPC Migration Options for Server-Client Model

## Executive Summary

NPCs in BreakEscape currently use:
- **Ink scripts** (.ink.json files) for dialogue trees
- **Event mappings** for reactive dialogue
- **Timed messages** for proactive engagement
- **Conversation history** tracked client-side
- **Story state** (variables, knots) managed client-side

This document evaluates three approaches for migrating NPCs to a server-client architecture.

---

## Current NPC Architecture

### Data Flow

```
Game Start:
├─ Load scenario JSON → Contains NPC definitions
│  ├─ npcId, displayName, avatar
│  ├─ storyPath (path to ink JSON)
│  ├─ phoneId (which phone)
│  ├─ eventMappings (game event → dialogue knot)
│  └─ timedMessages (auto-send messages)
│
├─ Register NPCs with NPCManager
│  ├─ Initialize conversation history (empty array)
│  ├─ Setup event listeners for mappings
│  └─ Schedule timed messages
│
└─ On Conversation Open:
   ├─ Fetch ink JSON from storyPath
   ├─ Load into InkEngine
   ├─ Display conversation history
   ├─ Continue story from saved state
   └─ Show choices
```

### Key Components

**1. NPC Definition (from scenario JSON):**
```json
{
    "id": "helper_npc",
    "displayName": "Helpful Contact",
    "storyPath": "scenarios/ink/helper-npc.json",
    "avatar": "assets/npc/avatars/npc_helper.png",
    "phoneId": "player_phone",
    "currentKnot": "start",
    "npcType": "phone",
    "eventMappings": [
        {
            "eventPattern": "item_picked_up:lockpick",
            "targetKnot": "on_lockpick_pickup",
            "onceOnly": true,
            "cooldown": 0
        }
    ],
    "timedMessages": [
        {
            "delay": 5000,
            "message": "Hey! Need any help?",
            "type": "text"
        }
    ]
}
```

**2. Ink Script Files:**
- Stored as static JSON files
- Contain dialogue trees with branching
- Include variables for state tracking
- Support conditional logic

**3. Client-Side State:**
- Conversation history (all messages)
- Story state (variables, current knot)
- Event trigger tracking (cooldowns, onceOnly)

---

## Migration Challenges

### Security Concerns

**Current Problem:**
- All ink scripts are accessible from browser (even if not yet conversed with)
- Player can read ahead in conversations
- Event mappings reveal game mechanics
- Timed messages show trigger conditions

**Impact:**
- Low severity for story-only NPCs (just dialogue flavor)
- Medium severity for helper NPCs (hints and guidance visible)
- High severity if NPCs give items or unlock doors (cheating possible)

### State Synchronization

**Current Problem:**
- Conversation history stored client-side only
- Story variables (trust_level, etc.) tracked client-side
- No server validation of dialogue progression
- Event triggers validated client-side only

**Impact:**
- Player could manipulate conversation state
- Server has no visibility into player-NPC relationships
- Cannot validate if NPC should give item/unlock door

### Network Latency

**Current Problem:**
- Ink scripts can be large (7KB+ per NPC)
- Each dialogue turn could require server round-trip
- Event-triggered barks need immediate response

**Impact:**
- Dialogue feels sluggish if every turn needs server
- Barks delayed if fetched from server
- Poor UX compared to instant client-side responses

---

## Migration Option 1: Full Server-Side NPCs

### Architecture

```
┌────────────────────────────────┐      ┌──────────────────────────┐
│         CLIENT                 │      │        SERVER            │
│                                │      │                          │
│  Player opens conversation     │      │  NPC Models:             │
│         ↓                      │      │  - id, name, avatar      │
│  POST /api/npcs/{id}/message   │──────→  - ink_script (TEXT)    │
│    { text: "player choice" }   │      │  - current_state (JSON)  │
│         ↓                      │      │                          │
│  ← Response:                   │←─────┤  Conversation Model:     │
│    { npc_text, choices }       │      │  - player_id, npc_id     │
│                                │      │  - history (JSON)        │
│  Render dialogue               │      │  - story_state (JSON)    │
│                                │      │                          │
└────────────────────────────────┘      └──────────────────────────┘

FLOW:
1. Client requests conversation with NPC
2. Server loads NPC ink script from database
3. Server runs InkEngine (Ruby gem or Node.js service)
4. Server processes player choice
5. Server updates conversation history
6. Server saves story state
7. Server returns response
8. Client displays dialogue
```

### Implementation

**Server Side:**

```ruby
# models/npc.rb
class NPC < ApplicationRecord
  has_many :conversations
  
  # Store ink script as TEXT (JSON)
  # Store event_mappings as JSON
  # Store timed_messages as JSON
  
  def get_dialogue(player, player_choice = nil)
    conversation = conversations.find_or_create_by(player: player)
    
    # Load ink engine (via Ruby gem or API call to Node service)
    engine = InkEngine.new(self.ink_script)
    engine.load_state(conversation.story_state)
    
    # Process player choice if any
    if player_choice
      engine.make_choice(player_choice)
      conversation.add_message('player', player_choice)
    end
    
    # Get next dialogue
    result = engine.continue
    conversation.add_message('npc', result.text)
    conversation.story_state = engine.save_state
    conversation.save!
    
    {
      text: result.text,
      choices: result.choices,
      tags: result.tags
    }
  end
end

# controllers/api/npcs_controller.rb
class Api::NpcsController < ApplicationController
  def message
    npc = NPC.find(params[:id])
    authorize(npc) # Pundit policy
    
    result = npc.get_dialogue(current_player, params[:choice])
    
    render json: result
  end
end
```

**Client Side:**

```javascript
// Minimal changes - just change data source
async function sendNPCMessage(npcId, choiceIndex) {
    const response = await fetch(`/api/npcs/${npcId}/message`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${playerToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ choice: choiceIndex })
    });
    
    const result = await response.json();
    
    // Display dialogue (existing code)
    displayNPCMessage(result.text);
    displayChoices(result.choices);
}
```

### Pros

✅ **Maximum Security**
- Ink scripts never sent to client
- Server validates all dialogue progression
- Cannot read ahead or manipulate state
- Event triggers validated server-side

✅ **Consistent State**
- Single source of truth (server database)
- Conversation history persists across sessions
- Can query player-NPC relationships server-side
- Analytics on dialogue choices

✅ **Dynamic Content**
- Can update NPC dialogue without client update
- Can personalize based on server-side data
- Can A/B test dialogue variations

### Cons

❌ **Network Latency**
- Every dialogue turn requires round-trip
- 100-300ms delay per message
- Feels sluggish compared to instant client responses

❌ **Server Complexity**
- Need ink engine on server (Ruby gem or Node service)
- More database queries per interaction
- Conversation state stored in DB (can be large)

❌ **Offline Incompatibility**
- Cannot play without server connection
- No dialogue possible if server down

### Recommendation

**Best for:**
- NPCs that affect game state (give items, unlock doors)
- High-stakes dialogue (affects scoring, endings)
- Personalized content based on user data

**Not ideal for:**
- Flavor/atmosphere NPCs
- High-frequency interactions
- Real-time reactive barks

---

## Migration Option 2: Hybrid - Scripts Client-Side, Validation Server-Side

### Architecture

```
┌────────────────────────────────┐      ┌──────────────────────────┐
│         CLIENT                 │      │        SERVER            │
│                                │      │                          │
│  Load ink scripts at startup   │      │  NPC Metadata:           │
│  (all scripts, ~50KB total)    │      │  - id, name, avatar      │
│         ↓                      │      │  - unlock_permissions    │
│  Run InkEngine locally         │      │                          │
│  Process dialogue instantly    │      │  Event Validation:       │
│         ↓                      │      │  - Verify triggers       │
│  On item_given or door_unlock  │      │  - Validate conditions   │
│    POST /api/npcs/validate     │──────→                          │
│    { action, npc_id, data }    │      │                          │
│         ↓                      │      │                          │
│  ← { allowed: true/false }     │←─────┤                          │
│                                │      │                          │
│  If allowed: execute action    │      │  Conversation sync:      │
│  If denied: show error         │      │  - Store history (async) │
│                                │      │  - Track trust_level     │
└────────────────────────────────┘      └──────────────────────────┘

FLOW:
1. Client loads all ink scripts at startup
2. Client runs dialogue locally (instant)
3. When NPC performs action (give item, unlock):
   - Client asks server: "Can this NPC do X?"
   - Server validates: checks conditions, permissions
   - Server responds: yes/no + updated state
4. Client executes action if allowed
5. Client syncs conversation history to server (async)
```

### Implementation

**Server Side:**

```ruby
# models/npc.rb
class NPC < ApplicationRecord
  has_many :npc_permissions
  
  # Store only metadata, not full ink script
  # Ink scripts served as static JSON files
  
  def can_perform_action?(player, action, context = {})
    case action
    when 'unlock_door'
      # Check if NPC has permission to unlock this door
      # Check if player has earned trust
      # Check if door is actually locked
      permission = npc_permissions.find_by(action_type: 'unlock_door', target: context[:door_id])
      permission.present? && player.trust_level_with(self) >= permission.required_trust
      
    when 'give_item'
      # Check if NPC has this item to give
      # Check if already given
      # Check prerequisites
      permission = npc_permissions.find_by(action_type: 'give_item', target: context[:item_id])
      permission.present? && !player.received_item_from?(self, context[:item_id])
      
    else
      false
    end
  end
end

# controllers/api/npcs_controller.rb
class Api::NpcsController < ApplicationController
  def validate_action
    npc = NPC.find(params[:id])
    authorize(npc)
    
    allowed = npc.can_perform_action?(
      current_player,
      params[:action],
      params[:context]
    )
    
    if allowed
      # Execute the action server-side
      case params[:action]
      when 'unlock_door'
        unlock_door_for_player(current_player, params[:context][:door_id])
      when 'give_item'
        give_item_to_player(current_player, params[:context][:item_id])
      end
    end
    
    render json: { allowed: allowed }
  end
  
  def sync_history
    # Async endpoint for storing conversation history
    npc = NPC.find(params[:id])
    conversation = npc.conversations.find_or_create_by(player: current_player)
    conversation.update!(history: params[:history])
    
    head :ok
  end
end
```

**Client Side:**

```javascript
// Ink scripts loaded at startup (unchanged)
// Dialogue runs instantly (unchanged)

// NEW: Validate actions with server
async function executeNPCAction(npcId, action, context) {
    // Ask server for permission
    const response = await fetch(`/api/npcs/${npcId}/validate`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${playerToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, context })
    });
    
    const result = await response.json();
    
    if (result.allowed) {
        // Execute action locally (door unlocks, item appears)
        executeActionLocally(action, context);
    } else {
        // Show error - NPC can't do this
        showError('Action not allowed');
    }
}

// NEW: Sync conversation history periodically
function syncConversationHistory(npcId, history) {
    // Fire and forget - don't block UI
    fetch(`/api/npcs/${npcId}/sync_history`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${playerToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ history })
    }).catch(error => {
        console.warn('Failed to sync conversation history:', error);
    });
}
```

### Pros

✅ **Instant Dialogue**
- No network latency for conversations
- Feels responsive and natural
- Works offline (dialogue only)

✅ **Secure Actions**
- Server validates critical actions
- Cannot cheat item/door unlocks
- Server tracks player progress

✅ **Simpler Server**
- No ink engine on server
- Fewer DB queries
- Smaller state to store

✅ **Async Sync**
- Conversation history synced in background
- Non-blocking UI
- Resilient to network issues

### Cons

❌ **Dialogue Spoilers**
- Player can read all ink scripts
- Can see all possible dialogue branches
- Event mappings visible

❌ **Client State**
- Conversation history can be lost if not synced
- Trust level tracked client-side (can manipulate)
- Need to reconcile state mismatches

❌ **Split Logic**
- Some validation client-side, some server-side
- More complex to reason about
- Potential for bugs if sync fails

### Recommendation

**Best for:**
- Most NPCs (90% of cases)
- Flavor/atmosphere dialogue
- Helper NPCs with occasional actions
- Real-time reactive barks

**Not ideal for:**
- Critical story NPCs
- High-value actions (rare items, key unlocks)

---

## Migration Option 3: Progressive Loading

### Architecture

```
┌────────────────────────────────┐      ┌──────────────────────────┐
│         CLIENT                 │      │        SERVER            │
│                                │      │                          │
│  Game Start:                   │      │  NPC Discovery:          │
│  - Load NPC metadata only      │      │  - Serve NPC list        │
│    (names, avatars)            │      │  - Filter by unlocked    │
│         ↓                      │      │                          │
│  Player meets NPC:             │      │  On First Contact:       │
│  GET /api/npcs/{id}/story      │──────→  - Check permissions    │
│         ↓                      │      │  - Return ink script     │
│  ← Ink script JSON             │←─────┤  - Initialize history   │
│         ↓                      │      │                          │
│  Load into InkEngine           │      │  On Action:              │
│  Run locally                   │      │  - Validate              │
│         ↓                      │      │  - Execute               │
│  On action: validate           │──────→  - Update state         │
│                                │      │                          │
└────────────────────────────────┘      └──────────────────────────┘

FLOW:
1. Game start: Load NPC metadata (names, avatars) only
2. When player opens conversation first time:
   - Fetch ink script from server
   - Cache locally
   - Run dialogue client-side
3. Subsequent conversations: use cached script
4. Actions validated server-side
5. History synced periodically
```

### Implementation

**Server Side:**

```ruby
# controllers/api/npcs_controller.rb
class Api::NpcsController < ApplicationController
  def index
    # List all NPCs player has unlocked
    npcs = NPC.accessible_by(current_player)
    
    render json: npcs.map { |npc|
      {
        id: npc.id,
        displayName: npc.display_name,
        avatar: npc.avatar_url,
        phoneId: npc.phone_id,
        npcType: npc.npc_type,
        unlocked: npc.unlocked_for?(current_player)
      }
    }
  end
  
  def story
    npc = NPC.find(params[:id])
    authorize(npc, :view_story?)
    
    # Check if player has unlocked this NPC
    unless npc.unlocked_for?(current_player)
      render json: { error: 'NPC not yet discovered' }, status: :forbidden
      return
    end
    
    # Return ink script + event mappings
    render json: {
      storyJSON: JSON.parse(npc.ink_script),
      eventMappings: npc.event_mappings,
      timedMessages: npc.timed_messages,
      currentKnot: npc.conversations.find_by(player: current_player)&.current_knot || 'start'
    }
  end
  
  def validate_action
    # Same as Option 2
  end
  
  def sync_history
    # Same as Option 2
  end
end
```

**Client Side:**

```javascript
// NEW: Progressive loading
const npcScriptCache = new Map(); // Cache loaded scripts

async function openConversation(npcId) {
    // Check if we have this NPC's script
    if (!npcScriptCache.has(npcId)) {
        // Fetch script from server
        const response = await fetch(`/api/npcs/${npcId}/story`, {
            headers: {
                'Authorization': `Bearer ${playerToken}`
            }
        });
        
        if (!response.ok) {
            showError('NPC not available yet');
            return;
        }
        
        const npcData = await response.json();
        
        // Cache the script
        npcScriptCache.set(npcId, npcData);
        
        // Register with NPCManager
        window.npcManager.registerNPC({
            id: npcId,
            storyJSON: npcData.storyJSON,
            eventMappings: npcData.eventMappings,
            timedMessages: npcData.timedMessages,
            currentKnot: npcData.currentKnot
        });
    }
    
    // Open conversation (script now cached)
    openNPCConversation(npcId);
}

// Actions and sync same as Option 2
```

### Pros

✅ **Gradual Disclosure**
- Scripts loaded only when needed
- Cannot read ahead to undiscovered NPCs
- Smaller initial load

✅ **Instant Once Loaded**
- First conversation has delay
- Subsequent conversations instant
- Cached across sessions (localStorage)

✅ **Secure Actions**
- Server validates critical actions
- Server controls NPC unlock conditions

✅ **Balanced Security**
- Some spoiler protection (can't see all NPCs)
- Known NPCs fully visible (acceptable tradeoff)

### Cons

❌ **First-Contact Delay**
- Initial conversation has network latency
- Loading indicator needed

❌ **Cache Management**
- Need to handle cache invalidation
- What if script updates?
- Storage limits

❌ **Still Readable**
- Once loaded, script is in memory
- Player can inspect cached data
- Not as secure as Option 1

### Recommendation

**Best for:**
- Balanced security and UX
- Games with many NPCs
- NPCs gated by progression
- Storytelling games where discovery matters

**Not ideal for:**
- Games with few NPCs (overhead not worth it)
- Always-available helper NPCs

---

## Comparison Matrix

| Criteria | Option 1: Full Server | Option 2: Hybrid | Option 3: Progressive |
|----------|----------------------|------------------|----------------------|
| **Dialogue Latency** | 🔴 High (100-300ms) | 🟢 None (instant) | 🟡 First-time only |
| **Spoiler Protection** | 🟢 Maximum | 🔴 Minimal | 🟡 Moderate |
| **Server Complexity** | 🔴 High (ink engine) | 🟢 Low (validation) | 🟡 Medium (progressive) |
| **Offline Support** | 🔴 None | 🟡 Partial | 🟡 Partial |
| **Action Security** | 🟢 Maximum | 🟢 Maximum | 🟢 Maximum |
| **State Consistency** | 🟢 Perfect | 🟡 Eventual | 🟡 Eventual |
| **Initial Load Time** | 🟢 Fast | 🔴 Slowest | 🟢 Fast |
| **Network Usage** | 🔴 High | 🟢 Low | 🟡 Medium |
| **Development Effort** | 🔴 High | 🟢 Low | 🟡 Medium |

---

## Recommended Approach: Hybrid with Optional Progressive

### Strategy

**Phase 1: Hybrid for All NPCs**
- Start with Option 2 (hybrid)
- Load all ink scripts at startup
- Validate actions server-side
- Sync history asynchronously

**Phase 2: Identify High-Security NPCs**
- Mark NPCs that give critical items
- Mark NPCs that unlock key doors
- These need full server validation

**Phase 3: Progressive Loading for High-Security**
- Apply Option 3 to high-security NPCs only
- Keep Option 2 for flavor NPCs
- Mix approaches based on NPC role

**Phase 4: Optional Full Server**
- If cheating becomes a problem
- If want analytics on all dialogue
- If personalization needed
- Migrate specific NPCs to Option 1

### Implementation Phases

#### Phase 1: Hybrid (Week 1-2)

```javascript
// Current: Load from static files
const npc = await fetch('scenarios/ink/helper-npc.json');

// New: Load from server endpoint
const npc = await fetch('/api/scenarios/ink/helper-npc.json');
```

**Changes:**
- Serve ink files through Rails
- Add validation endpoints
- Add sync endpoints
- No code changes in InkEngine or NPCManager

#### Phase 2: Action Validation (Week 3)

```javascript
// Before executing NPC action
const allowed = await validateNPCAction(npcId, action, context);
if (allowed) {
    executeAction();
}
```

**Changes:**
- Add `Api::NpcsController#validate_action`
- Add NPC permissions model
- Update NPC action handlers

#### Phase 3: Progressive Loading (Week 4+)

```javascript
// Progressive loading for specific NPCs
if (npc.securityLevel === 'high') {
    await loadNPCProgressively(npcId);
} else {
    // Use pre-loaded script
}
```

**Changes:**
- Add `Api::NpcsController#story`
- Add script caching
- Add unlock conditions

---

## Database Schema

### For Hybrid/Progressive Approaches

```ruby
# db/schema.rb

create_table "npcs", force: :cascade do |t|
  t.string "npc_id", null: false
  t.string "display_name", null: false
  t.string "avatar_url"
  t.string "phone_id"
  t.string "npc_type", default: "phone"
  t.text "ink_script" # JSON string
  t.json "event_mappings"
  t.json "timed_messages"
  t.string "security_level", default: "low" # low, medium, high
  t.timestamps
  
  t.index ["npc_id"], unique: true
end

create_table "npc_permissions", force: :cascade do |t|
  t.references :npc, foreign_key: true
  t.string "action_type" # unlock_door, give_item
  t.string "target" # door_id, item_id
  t.integer "required_trust", default: 0
  t.json "conditions" # Additional requirements
  t.timestamps
  
  t.index ["npc_id", "action_type", "target"], unique: true
end

create_table "conversations", force: :cascade do |t|
  t.references :player, foreign_key: true
  t.references :npc, foreign_key: true
  t.json "history" # Message array
  t.json "story_state" # Ink variables
  t.string "current_knot"
  t.datetime "last_message_at"
  t.timestamps
  
  t.index ["player_id", "npc_id"], unique: true
end

create_table "npc_unlocks", force: :cascade do |t|
  t.references :player, foreign_key: true
  t.references :npc, foreign_key: true
  t.datetime "unlocked_at"
  t.timestamps
  
  t.index ["player_id", "npc_id"], unique: true
end
```

---

## Conclusion

**Recommended: Hybrid (Option 2) with Optional Progressive (Option 3)**

**Rationale:**
1. **UX First**: Instant dialogue is critical for engagement
2. **Security Where Needed**: Validate actions server-side
3. **Pragmatic**: Most dialogue is flavor (low security risk)
4. **Flexible**: Can upgrade specific NPCs to progressive/full server
5. **Lower Effort**: Minimal changes to existing code

**Migration Path:**
1. Start with hybrid - minimal changes
2. Add progressive loading for critical NPCs
3. Monitor for cheating/abuse
4. Upgrade to full server if needed

**Key Insight:**
- Reading dialogue ahead is low-impact spoiler
- Manipulating trust_level is detectable server-side
- Critical actions (items, unlocks) always validated
- Conversation history synced for analytics/persistence

This approach balances security, UX, and development effort.


