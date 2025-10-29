# Phone Chat Minigame - Implementation Plan

## Overview
Create a Phaser-based phone-chat minigame that integrates with the NPC Ink system, using the same look and feel as the existing `phone-messages-minigame.js` but designed for interactive conversations.

## Design Goals
1. **Visual Consistency**: Match the existing phone UI (signal bars, battery, phone screen)
2. **Modular Architecture**: Keep modules under 1000 lines each
3. **Separation of Concerns**: Split UI, logic, and Ink integration
4. **Reusable Components**: Design for future phone minigame consolidation

## Module Structure

### 1. `phone-chat-minigame.js` (Main Controller)
**Lines: ~300-400**
- Extends `MinigameScene` base class
- Orchestrates UI and conversation flow
- Handles minigame lifecycle (init, start, cleanup)
- Delegates to specialized modules

**Responsibilities:**
```javascript
class PhoneChatMinigame extends MinigameScene {
  - constructor(container, params)
  - init() // Set up UI structure
  - start() // Begin conversation
  - cleanup() // Clean up on exit
  - handleKeyPress(event) // Keyboard controls
}
```

**Dependencies:**
- `PhoneChatUI` (UI rendering)
- `PhoneChatConversation` (Ink story management)
- `PhoneChatHistory` (message history)

---

### 2. `phone-chat-ui.js` (UI Component)
**Lines: ~400-500**
- Renders phone UI elements
- Manages DOM structure
- Handles UI state (list view, detail view, chat view)
- Styling and animations

**Responsibilities:**
```javascript
class PhoneChatUI {
  - constructor(gameContainer, params)
  - render() // Create phone UI structure
  - showContactList() // Display NPCs for this phone
  - showConversation(npcId) // Display chat with NPC
  - addMessage(type, text) // Add message bubble (npc/player)
  - addChoices(choices) // Render choice buttons
  - showTypingIndicator() // NPC is "typing..."
  - hideTypingIndicator()
  - updateHeader(npcName) // Update conversation header
  - scrollToBottom() // Auto-scroll to latest message
}
```

**UI Structure:**
```html
<div class="phone-chat-container">
  <div class="phone-screen">
    <div class="phone-header">
      <!-- Signal bars, battery, time -->
    </div>
    
    <div class="contact-list-view"> <!-- OR -->
      <!-- List of NPCs with unread badges -->
    </div>
    
    <div class="conversation-view">
      <div class="conversation-header">
        <!-- NPC name, back button, avatar -->
      </div>
      <div class="messages-container">
        <!-- Chat bubbles (NPC left, player right) -->
      </div>
      <div class="choices-container">
        <!-- Choice buttons at bottom -->
      </div>
    </div>
  </div>
</div>
```

---

### 3. `phone-chat-conversation.js` (Ink Integration)
**Lines: ~300-400**
- Manages Ink story execution
- Interfaces with `InkEngine`
- Handles conversation state
- Processes story output

**Responsibilities:**
```javascript
class PhoneChatConversation {
  - constructor(npcId, npcManager)
  - async loadStory() // Fetch and initialize Ink story
  - continue() // Advance story, return { text, choices, canContinue }
  - makeChoice(index) // Select choice and continue
  - goToKnot(knotName) // Navigate to specific knot
  - saveState() // Save Ink state
  - restoreState() // Restore Ink state
  - getVariable(name) // Get Ink variable
  - setVariable(name, value) // Set Ink variable
}
```

**Conversation Flow:**
1. Load story JSON
2. Set NPC name variable
3. Navigate to startKnot (or use currentKnot from NPC manager)
4. Load conversation history from NPCManager
5. Continue story → display text
6. Present choices → wait for selection
7. Record messages in NPCManager history
8. Loop until END or player exits

---

### 4. `phone-chat-history.js` (History Management)
**Lines: ~200-300**
- Interfaces with NPCManager conversation history
- Formats messages for display
- Handles history loading/saving

**Responsibilities:**
```javascript
class PhoneChatHistory {
  - constructor(npcId, npcManager)
  - loadHistory() // Get all messages for this NPC
  - addMessage(type, text, metadata) // Record new message
  - formatMessage(message) // Format for display
  - clearHistory() // Clear NPC conversation
  - getUnreadCount() // Count unread messages
  - markAllRead() // Mark all messages as read
}
```

**Message Format:**
```javascript
{
  type: 'npc' | 'player',
  text: string,
  timestamp: number,
  knot?: string,
  read?: boolean
}
```

---

### 5. `phone-chat.css` (Styles)
**Lines: ~400-500**
- Copy base styles from `phone-messages-minigame.css`
- Chat-specific styles (bubbles, choices)
- Animations (typing indicator, message slide-in)
- Pixel-art aesthetic (sharp corners, 2px borders)

**Key Styles:**
```css
.phone-chat-container { }
.phone-screen { }
.phone-header { } /* Signal bars, battery */
.contact-list-view { }
.contact-item { }
.unread-badge { }
.conversation-view { }
.conversation-header { }
.messages-container { }
.message-bubble { }
  .message-bubble.npc { } /* Left-aligned, darker */
  .message-bubble.player { } /* Right-aligned, brighter */
.typing-indicator { }
.choices-container { }
.choice-button { }
```

---

## File Structure

```
js/minigames/phone-chat/
├── phone-chat-minigame.js      // Main controller (extends MinigameScene)
├── phone-chat-ui.js            // UI rendering and DOM management
├── phone-chat-conversation.js  // Ink story integration
└── phone-chat-history.js       // History management

css/
└── phone-chat-minigame.css     // Styles (based on phone-messages)

scenarios/ink/
└── (NPCs use existing stories: alice-chat.json, generic-npc.json, etc.)
```

---

## Integration Points

### With Existing Systems

**NPCManager:**
- Get NPC data (displayName, avatar, storyPath, currentKnot)
- Get/add conversation history
- Get NPCs by phoneId (for contact list)

**NPCBarkSystem:**
- Triggered from bark clicks (already implemented)
- Falls back to inline UI if Phaser unavailable
- Opens phone-chat minigame via MinigameFramework

**MinigameFramework:**
- Register as `'phone-chat'` scene
- Standard params: `{ npcId, npcName, avatar, inkStoryPath, startKnot, phoneId }`

**InkEngine:**
- Load and run Ink stories
- Set `npc_name` variable
- Navigate to knots
- Get/set variables
- Handle choices

---

## Features

### Core Features (MVP)
- ✅ Display contact list (multiple NPCs on same phone)
- ✅ Open conversation with specific NPC
- ✅ Load conversation history
- ✅ Display NPC messages (left-aligned bubbles)
- ✅ Display player choices as clickable buttons
- ✅ Player choices appear as right-aligned bubbles after selection
- ✅ Continue Ink story and render new content
- ✅ Record all messages in NPCManager history
- ✅ Back button to return to contact list
- ✅ Close button to exit minigame

### Enhanced Features (Phase 2)
- ⏳ Unread message badges on contacts
- ⏳ Typing indicator when NPC "responds"
- ⏳ Message timestamps
- ⏳ Scroll animations
- ⏳ Sound effects (message received, sent)
- ⏳ Keyboard shortcuts (Esc to close, Enter to select first choice)
- ⏳ Avatar images in conversation header
- ⏳ "Mark all as read" functionality
- ⏳ Filter contacts by phoneId

---

## Implementation Steps

### Phase 1: Core Structure (Day 1)
1. ✅ Create `phone-chat-ui.js` - Basic UI rendering
2. ✅ Create `phone-chat-conversation.js` - Ink integration
3. ✅ Create `phone-chat-history.js` - History management
4. ✅ Create `phone-chat-minigame.js` - Main controller
5. ✅ Create `phone-chat-minigame.css` - Base styles

### Phase 2: Integration (Day 1-2)
6. ✅ Wire up UI → Conversation → History
7. ✅ Test with Alice (alice-chat.json)
8. ✅ Test with Bob (generic-npc.json)
9. ✅ Test conversation history persistence
10. ✅ Register with MinigameFramework

### Phase 3: Polish (Day 2)
11. ⏳ Add typing indicator animation
12. ⏳ Add message slide-in animations
13. ⏳ Add unread badges
14. ⏳ Add sound effects
15. ⏳ Keyboard shortcuts

### Phase 4: Testing (Day 2-3)
16. ⏳ Test multiple NPCs on same phone
17. ⏳ Test different phones (player_phone vs office_phone)
18. ⏳ Test conversation branching
19. ⏳ Test history across sessions
20. ⏳ Edge case testing

---

## API Reference

### Params Structure
```javascript
{
  npcId: string,           // Required: NPC identifier
  npcName: string,         // Display name
  avatar: string,          // Avatar image path
  inkStoryPath: string,    // Path to Ink JSON
  startKnot: string,       // Starting knot (or use NPC's currentKnot)
  phoneId: string,         // Which phone (for multi-phone support)
  returnCallback: function // Optional callback on exit
}
```

### Starting the Minigame
```javascript
// Via MinigameFramework (in game)
window.MinigameFramework.startMinigame('phone-chat', {
  npcId: 'alice',
  npcName: 'Alice - Security Consultant',
  inkStoryPath: 'scenarios/compiled/alice-chat.json',
  startKnot: 'start'
});

// Via inline fallback (in test harness)
const phoneChat = new PhoneChatMinigame(container, params);
phoneChat.init();
phoneChat.start();
```

---

## Design Decisions

### Why Separate Modules?
1. **Maintainability**: Each module has single responsibility
2. **Testability**: Modules can be tested independently
3. **Reusability**: UI can be reused for other phone features
4. **Line Limits**: Each module stays under 1000 lines

### Why Phaser-Based?
1. **Game Integration**: Works with existing MinigameFramework
2. **Consistency**: Same lifecycle as other minigames
3. **Features**: Pause/resume, modal overlay, keyboard controls
4. **Fallback**: Inline UI still available for testing

### Why Separate from phone-messages?
1. **Different Use Cases**: Messages are passive, chat is interactive
2. **Complexity**: Chat requires Ink integration, choice handling
3. **Future Merge**: Can consolidate later with tab-based UI
4. **Incremental**: Build and test independently first

---

## Visual Design

### Contact List View
```
┌─────────────────────┐
│ 📶    12:34    🔋85%│
├─────────────────────┤
│                     │
│ 👤 Alice           ●│  ← Unread badge
│ Last: Hey! Click... │
│ 📅 2 min ago        │
│─────────────────────│
│ 👤 Bob              │
│ Last: Second bark...│
│ 📅 5 min ago        │
│─────────────────────│
│                     │
└─────────────────────┘
```

### Conversation View
```
┌─────────────────────┐
│ 📶    12:34    🔋85%│
│ ← Alice             │  ← Back button + name
├─────────────────────┤
│                     │
│ ┌─────────────────┐ │  ← NPC message (left)
│ │ Alice: Hey! I'm │ │
│ │ Alice, the sec..│ │
│ └─────────────────┘ │
│                     │
│     ┌─────────────┐ │  ← Player message (right)
│     │ Ask about   │ │
│     │ security    │ │
│     └─────────────┘ │
│                     │
│ ┌─────────────────┐ │
│ │ Alice: Our sec..│ │
│ └─────────────────┘ │
│                     │
├─────────────────────┤
│ [Ask about building]│  ← Choice buttons
│ [Make small talk]   │
│ [Say goodbye]       │
└─────────────────────┘
```

---

## Success Criteria

### MVP Complete When:
- ✅ Can open phone-chat from bark click
- ✅ Contact list shows all NPCs for phone
- ✅ Conversation view displays NPC messages
- ✅ Player choices appear as buttons
- ✅ Selected choices appear as player messages
- ✅ Conversation history persists
- ✅ Can switch between NPCs
- ✅ Can close and reopen without losing history
- ✅ Works with both Alice's complex story and Bob's generic story

### Ready for Game Integration When:
- ✅ All core features working
- ✅ Tested with multiple NPCs
- ✅ Tested with multiple phones
- ✅ Performance acceptable (no lag)
- ✅ Error handling robust
- ✅ Documentation complete

---

## Timeline

**Day 1 (Today):**
- Create module files and basic structure
- Implement PhoneChatUI
- Implement PhoneChatConversation
- Wire up basic flow

**Day 2:**
- Implement PhoneChatHistory
- Complete main controller
- Add CSS styling
- Test with existing stories
- Register with MinigameFramework

**Day 3:**
- Polish and animations
- Edge case testing
- Documentation
- Game integration prep

---

## Notes

- Reuse CSS patterns from `phone-messages-minigame.css`
- Maintain 2px borders (pixel-art aesthetic)
- No border-radius (sharp corners only)
- Use existing color scheme from phone minigame
- Test on both Phaser and inline fallback paths
- Keep modules loosely coupled for future refactoring

---

**Status:** 📋 Planning Complete - Ready for Implementation
**Next Step:** Create module files and begin Phase 1
**Estimated Total Lines:** ~1400-1700 (split across 4 modules)
