# NPC Implementation Progress

## Completed (Phase 1: Core Infrastructure)

### ✅ Directory Structure
- [x] `assets/vendor/` - Moved ink.js library
- [x] `assets/npc/avatars/` - Placeholder avatars (npc_alice.png, npc_bob.png)
- [x] `assets/npc/sounds/` - Sound directory created
- [x] `js/systems/ink/` - Ink engine module
- [x] `js/minigames/phone-chat/` - Phone chat minigame directory
- [x] `scenarios/ink/` - Source Ink scripts
- [x] `scenarios/compiled/` - Compiled Ink JSON files

### ✅ Core Systems Implemented
- [x] **InkEngine** (`js/systems/ink/ink-engine.js`) - Enhanced
  - Load/parse compiled Ink JSON
  - Navigate to knots
  - Continue dialogue (returns structured result: {text, choices, canContinue})
  - Make choices
  - Get/set variables with value unwrapping
  - Tag parsing support
  - **Status**: Tested and working ✅

- [x] **NPCEventDispatcher** (`js/systems/npc-events.js`) - Complete
  - Event emission and listening
  - Pattern matching (wildcards supported)
  - Cooldown system
  - Event queue processing
  - Priority-based listener sorting
  - Event history tracking
  - Debug mode
  - **Status**: Tested and working ✅

- [x] **NPCManager** (`js/systems/npc-manager.js`) - Enhanced with auto-mapping
  - NPC registration
  - **Event → Knot auto-mapping** ✅
    - Automatic bark triggers on game events
    - Support for once-only events
    - Configurable cooldowns (default 5s)
    - Conditional triggers via functions
    - Pattern matching support (e.g., `item_picked_up:*`)
  - Conversation state management
  - Conversation history tracking
  - Current knot tracking
  - Event listener cleanup
  - **Timed Messages System** ✅
    - Schedule messages to arrive at specific times
    - Automatic bark notifications
    - Integration with conversation history
  - Integration with InkEngine and BarkSystem
  - **Status**: Complete and tested ✅

- [x] **NPCBarkSystem** (`js/systems/npc-barks.js`) - Enhanced
  - Bark notification popups
  - Auto-dismiss (4s default)
  - Click to open phone chat
  - **Inline fallback phone UI** for testing (no Phaser required)
    - Modal overlay with phone-shaped container
    - Message rendering (NPC left-aligned, player right-aligned)
    - Choice buttons with hover states
    - Scrollable conversation history
    - Close button
  - Dynamic import of MinigameFramework when Phaser available
  - HTML sanitization
  - **Status**: Tested and working ✅

### ✅ Example Stories
- [x] **alice-chat.ink** - Complete branching dialogue example
  - Trust level system (0-5+)
  - Conditional choices that appear/disappear
  - State tracking (knows_about_breach, has_keycard)
  - Once-only topics
  - Multiple endings
  - Realistic security consultant persona
  - **Status**: Tested and working ✅

### ✅ Test Harness
- [x] `test-npc-ink.html` - Comprehensive test page
  - ink.js library verification
  - InkEngine story loading/continuation
  - Event system testing
  - Bark display testing
  - Phone chat integration testing
  - **Auto-trigger testing** ✅
  - Visual console output
  - **Status**: Complete and functional

## In Progress (Phase 2: Game Integration)

### 🔄 Testing & Verification
- [x] Create test HTML page ✅
- [x] Verify ink.js loads correctly ✅
- [x] Test InkEngine with story JSON ✅
- [x] Test event emission ✅
- [x] Test bark display ✅
- [x] Test NPC Manager registration ✅
- [x] Test inline phone UI ✅
- [x] Test branching dialogue ✅
- [x] Test auto-trigger workflow ✅
- [x] Test phone-chat minigame ✅
- [x] Test conversation history persistence ✅
- [x] Test state save/restore ✅
- [x] Test timed messages system ✅
- [ ] Test in main game environment

## ✅ COMPLETED (Phase 2: Phone Chat Minigame)

### ✅ Phone Chat Modules
- [x] **PhoneChatHistory** (`js/minigames/phone-chat/phone-chat-history.js`) - ~270 lines
  - History management and formatting
  - Message tracking and unread counts
  - Export/import functionality
  - **Status**: Complete ✅

- [x] **PhoneChatConversation** (`js/minigames/phone-chat/phone-chat-conversation.js`) - ~370 lines
  - Ink story integration
  - Story loading and navigation
  - Choice handling
  - State management (save/restore)
  - Fixed state serialization issues (removed problematic npc_name variable)
  - **Status**: Complete ✅

- [x] **PhoneChatUI** (`js/minigames/phone-chat/phone-chat-ui.js`) - ~730 lines
  - Contact list view with unread badges
  - Conversation view with message bubbles
  - Choice button rendering
  - Typing indicator animation
  - Auto-scrolling
  - **Avatar display in conversation header** ✅
  - Styled scrollbars (8px, black with green border)
  - **Voice message support (Web Speech API)** ✅
    - Clickable play/stop button
    - Visual feedback (play ↔ stop icon)
    - Pixel-art rendering for icons
    - Audio waveform visualization
    - Transcript display
  - **Status**: Complete ✅

- [x] **PhoneChatMinigame** (`js/minigames/phone-chat/phone-chat-minigame.js`) - ~515 lines
  - Main controller extending MinigameScene
  - Orchestrates UI, conversation, history
  - Event handling and keyboard shortcuts
  - **Intro message preloading** ✅
  - **State persistence across conversations** ✅
  - **Prevents intro replay on reopen** ✅
  - **Status**: Complete ✅

- [x] **CSS Styling** (`css/phone-chat-minigame.css`) - ~540 lines
  - Phone UI with pixel-art aesthetic (matches phone-messages)
  - Green LCD screen (#5fcf69), gray shell (#a0a0ad)
  - Message bubbles (NPC left, player right)
  - Choice buttons
  - Styled scrollbars (visible on all platforms)
  - Avatar styles (32x32px, pixelated rendering)
  - Animations (typing, message slide-in)
  - **Voice message styles** ✅
    - Audio controls with play/stop button
    - Waveform sprite display (32px height)
    - Transcript display with borders
    - Pixel-art rendering for all icons
    - Hover effects
  - **Status**: Complete ✅

- [x] **Registration** - Registered with MinigameFramework as 'phone-chat'
  - **Status**: Complete ✅

### 📋 Phone Access
- [x] **Runtime Message Converter** (`js/utils/phone-message-converter.js`) ✅
  - Converts simple text/voice phone messages to Ink JSON at runtime
  - Zero changes needed to existing scenario files
  - Automatic virtual NPC creation and registration
  - Backward compatible with existing phone-messages system
  - **Auto-adds "voice:" prefix for voice messages** ✅
  - See `RUNTIME_CONVERSION_SUMMARY.md` for details
- [x] **Voice Message Support** ✅
  - "voice:" prefix detection in Ink text
  - Web Speech API integration (browser TTS)
  - Clickable audio controls (play/stop)
  - Voice selection (prefers Google/Microsoft voices)
  - Configurable speech settings (rate, pitch, volume)
  - Pixel-art UI rendering
  - See `VOICE_MESSAGES.md` and `VOICE_PLAYBACK_FEATURE.md` for details
- [x] Phone type detection and routing (interactions.js) ✅
  - Auto-conversion implemented
  - Uses phone-chat exclusively
- [ ] Phone button in UI (bottom-right corner)
  - Shows total unread count from all sources
  - Opens phone-unified with player's phone
- [ ] Inventory phone item
  - Add phone to startItemsInInventory
  - Handle phone item clicks in inventory.js
- [x] **Old Phone Minigame Removal** ✅
  - [x] All features migrated to phone-chat ✅
    - Voice message playback (Web Speech API)
    - Simple text messages
    - Interactive conversations (enhanced with Ink)
  - [x] Removed `js/minigames/phone/phone-messages-minigame.js` ✅
  - [x] Updated interactions.js to use phone-chat exclusively ✅
  - [x] Removed phone-messages registration from MinigameFramework ✅
  - [x] Archived `css/phone.css` → `css/phone.css.old` ✅
- [ ] Scenario JSON updates (optional - runtime conversion handles this)
  - Add phoneId to phone objects (for grouping)
  - Define which NPCs are available on which phones
  - Optionally add phone to player's starting inventory
- [x] **Documentation**: 
  - ✅ `RUNTIME_CONVERSION_SUMMARY.md` - Complete runtime conversion guide
  - ✅ `PHONE_MIGRATION_GUIDE.md` - Manual migration options
  - ✅ `PHONE_INTEGRATION_PLAN.md` - Unified phone strategy
  - ✅ `VOICE_MESSAGES.md` - Voice message feature guide
  - ✅ `VOICE_PLAYBACK_FEATURE.md` - Web Speech API implementation
  - ✅ `MIXED_PHONE_CONTENT.md` - Mixed message patterns
  - ✅ `PHONE_CLEANUP_SUMMARY.md` - Old minigame removal documentation
  - ✅ `MIXED_PHONE_CONTENT.md` - Simple + interactive messages guide

## TODO (Phase 3: Additional Events)

### 📋 Event Emissions
- [ ] Door events (door_unlocked, door_locked, door_attempt_failed)
- [ ] Minigame events (minigame_completed, minigame_started, minigame_failed)
- [ ] Interaction events (object_interacted, fingerprint_collected, bluetooth_device_found)
- [ ] Progress events (objective_completed, suspect_identified, mission_phase_changed)

## TODO (Phase 4: Scenario Integration)

### 📋 Example Scenario
- [ ] Create biometric_breach_npcs.ink
- [ ] Compile to JSON
- [ ] Update biometric_breach.json with NPC config
- [ ] Test full integration

## TODO (Phase 5: Polish & Testing)

### 📋 Enhancements
- [ ] Sound effects (message_received.wav)
- [ ] Better NPC avatars
- [ ] State persistence
- [ ] Error handling improvements
- [ ] Performance optimization

## File Statistics

| File | Lines | Status |
|------|-------|--------|
| ink-engine.js | 360 | ✅ Complete |
| npc-events.js | 230 | ✅ Complete |
| npc-manager.js | 355 | ✅ Complete |
| npc-barks.js | 280 | ✅ Complete |
| npc-barks.css | 52 | ✅ Complete |
| test.ink | 40 | ✅ Complete |
| alice-chat.ink | 180 | ✅ Complete |
| generic-npc.ink | 36 | ✅ Complete |
| phone-chat-history.js | 270 | ✅ Complete |
| phone-chat-conversation.js | 370 | ✅ Complete |
| phone-chat-ui.js | 730 | ✅ Complete |
| phone-chat-minigame.js | 739 | ✅ Complete |
| phone-chat-minigame.css | 540 | ✅ Complete |
| phone-message-converter.js | 150 | ✅ Complete |
| inventory.js | 629 | ✅ Enhanced (badge system) |
| inventory.css | 147 | ✅ Enhanced (badge styling) |
| test-npc-ink.html | ~400 | ✅ Complete |
| test-phone-chat-minigame.html | ~557 | ✅ Complete |

**Total implemented: ~6,065 lines across 18 files**

## Next Steps

### Phase 3: Testing & Integration
1. ✅ Test phone-chat minigame with test harness
2. ✅ Verify Alice's complex branching dialogue
3. ✅ Verify Bob's generic NPC story
4. ✅ Test conversation history persistence
5. ✅ Test multiple NPCs on same phone
6. ✅ Test event → bark → phone flow
7. ✅ Test timed messages system
8. ✅ Fix state serialization issues
9. ⏳ Test in main game environment

### Phase 4: Game Integration
1. **Emit game events from core systems** ⏳
   - [ ] Doors system: `door_unlocked`, `door_locked`, `door_attempt_failed`
   - [ ] Items system: `item_picked_up`, `item_used`, `item_examined`
   - [ ] Minigames: `minigame_started`, `minigame_completed`, `minigame_failed`
   - [ ] Interactions: `object_interacted`, `fingerprint_collected`, `bluetooth_device_found`
   - [ ] Progress: `objective_completed`, `room_entered`, `mission_phase_changed`

2. **Implement NPC → Game State Bridge** ⏳
   - [ ] Create `js/systems/npc-game-bridge.js`
   - [ ] Add methods: `unlockDoor()`, `giveItem()`, `setObjective()`, `revealSecret()`
   - [ ] Register Ink external functions
   - [ ] Add tag parsing in phone-chat minigame
   - [ ] Document available game actions

3. **Add NPC configs to scenario JSON** ⏳
   - [ ] Update `ceo_exfil.json` with event mappings
   - [ ] Add helpful NPCs that react to player actions
   - [ ] Add adversarial NPCs that complicate objectives

4. **Test in-game NPC interactions** ⏳
   - [ ] Test event-triggered barks
   - [ ] Test NPC unlocking doors
   - [ ] Test NPC giving items
   - [ ] Test NPC revealing secrets
   - [ ] Test conditional responses

5. **Polish UI/UX** ⏳
   - [ ] Sound effects (message_received.wav)
   - [ ] Better NPC avatars
   - [ ] Objective notification system
   - [ ] Secret/discovery UI

6. **Performance optimization** ⏳
   - [ ] Event listener cleanup
   - [ ] Story state caching
   - [ ] Minimize Ink engine instantiation

---
**Last Updated:** 2025-10-30 (Phone Badge System & Bark Redesign Complete)
**Status:** Phase 2 Complete - Ready for Game Integration

## Recent Improvements (2025-10-30)

### ✅ UI Enhancements
- Matched phone-messages aesthetic (green LCD screen, pixel-art borders)
- Added styled scrollbars (8px width, visible on all platforms)
- Added avatar display in conversation header
- Fixed all CSS to maintain 2px borders and no border-radius

### ✅ Conversation Flow Improvements
- Implemented intro message preloading (messages appear before first open)
- Added state persistence system (conversations resume where they left off)
- Fixed intro message replay bug (state now saves after preload)
- Fixed state serialization issues (removed problematic npc_name variable)

### ✅ Timed Messages System
- NPCManager can schedule messages at specific times
- Messages bark automatically when triggered
- Messages appear in conversation history
- Scenarios can define timed messages in JSON
- Auto-schedules timed messages from NPC registration
- Badge count updates when timed messages arrive

### ✅ Phone Badge System (NEW - 2025-10-30)
- **Unread message indicator** on phone inventory items
  - Real DOM element badge (not CSS pseudo-element)
  - Green background (#5fcf69) matching phone LCD
  - Shows total unread NPC message count
  - Updates dynamically as messages are read/received
- **Intro message preloading** when phone added to inventory
  - Creates temporary InkEngine to load NPC stories
  - Preloads intro messages from all NPCs on phone
  - Badge shows correct count immediately on game load
- **Badge update hooks**:
  - When phone added to inventory
  - When phone-chat minigame closes
  - When timed messages are delivered
  - Exported globally as `window.updatePhoneBadge(phoneId)`
- **Implementation**:
  - `inventory.js` - Badge creation and update logic
  - `inventory.css` - Badge styling (absolute positioned on slot)
  - `npc-manager.js` - getTotalUnreadCount(phoneId) method
  - `phone-chat-minigame.js` - Badge update on close

### ✅ Bark Notification Redesign (NEW - 2025-10-30)
- **Styled like phone message bubbles**:
  - Green background (#5fcf69) matching phone LCD
  - Black text and 2px borders
  - VT323 monospace font
  - No border-radius (pixel-art aesthetic)
- **Positioned above inventory**:
  - Fixed position at bottom: 80px (above inventory bar)
  - Left-aligned at 20px from edge
  - Stack vertically with newest at bottom
  - Slide-up animation on appear
- **Behavior**:
  - Click to open phone-chat with NPC
  - Auto-dismiss after 5 seconds
  - Fade-out animation on removal
  - Updates badge count when delivered
- **Implementation**:
  - `npc-barks.css` - Simplified styling, removed avatar/close button
  - `npc-barks.js` - Cleaner showBark() method
  - Container uses flexbox column-reverse for stacking

### ✅ Voice Messages & Playback
- **Voice message detection** via `"voice:"` prefix in Ink text
- **Web Speech API integration** for text-to-speech playback
- **Clickable audio controls**:
  - Play button (▶) and stop button (■)
  - Audio waveform visualization (32px sprite)
  - Side-by-side layout with flexbox
- **Voice selection** (prefers Google/Microsoft natural voices)
- **Configurable settings** (rate: 0.9, pitch: 1.0, volume: 0.8)
- **Pixel-art rendering** for all icons (crisp display)
- **Runtime conversion** auto-adds "voice:" prefix for old phone objects
- **Mixed content support** (text + voice in same conversation)
- Created comprehensive documentation:
  - `VOICE_MESSAGES.md` - Feature guide
  - `VOICE_PLAYBACK_FEATURE.md` - Technical implementation
  - `VOICE_MESSAGES_SUMMARY.md` - Quick reference
  - `VOICE_PLAYBACK_TEST_GUIDE.md` - Testing instructions
  - `MIXED_PHONE_CONTENT.md` - Mixed message patterns

### ✅ Feature Parity with Old Phone Minigame
**phone-chat now has ALL features from phone-messages-minigame:**
- ✅ Voice message playback (Web Speech API)
- ✅ Simple text messages
- ✅ Message history and navigation
- ✅ Green LCD phone UI aesthetic
- ✅ Plus NEW features:
  - Interactive Ink-based conversations
  - Branching dialogue with choices
  - State persistence and variables
  - NPC relationship tracking
  - Automatic runtime conversion
  - Contact list with multiple NPCs
  - Timed message delivery

### ✅ Old Phone Minigame Removed
**Successfully removed phone-messages-minigame (completed 2025-10-30):**
- ✅ Deleted `js/minigames/phone/phone-messages-minigame.js` (~934 lines)
- ✅ Removed imports/exports from `js/minigames/index.js`
- ✅ Removed registration from MinigameFramework
- ✅ Updated `js/systems/interactions.js` to use phone-chat exclusively
- ✅ Archived `css/phone.css` → `css/phone.css.old`
- ✅ All phone interactions now use phone-chat with runtime conversion
- ✅ No breaking changes - backward compatible with existing scenarios

### 🐛 Bugs Fixed
- State serialization error (InkJS couldn't serialize npc_name variable)
- Intro message replaying on conversation reopen
- Contact list showing "No messages yet" despite preloaded intros
- Voice message JSON files were 0 bytes (compilation issue)
- Simple message conversion creating duplicate NPCs
- Play button and audio sprite on separate lines (layout issue)
- Icons not using pixel-art rendering (blurry display)
- CSS attr() function not working for badge content (switched to DOM elements)
- InkEngine not available during inventory initialization (now imported directly)
- Phone badge not appearing on initial load (added intro message preloading)
- Timed messages arriving instantly (fixed delay vs triggerTime parameter)
- Badge not updating when timed messages arrive (added updatePhoneBadge call)

### 📚 Documentation Updated
- `02_PHONE_CHAT_MINIGAME_PLAN.md` - Added timed messages documentation
- `01_IMPLEMENTATION_LOG.md` - Updated with latest progress
- Created 7 new documentation files for voice messages
- Created example scenarios showing all features
