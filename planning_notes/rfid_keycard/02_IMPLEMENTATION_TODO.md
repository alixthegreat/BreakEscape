# RFID Keycard System - Implementation TODO

## Phase 1: Core Infrastructure (Days 1-2)

### Task 1.1: Create Base Files and Folder Structure
**Priority**: P0 (Blocker)
**Estimated Time**: 30 minutes

- [ ] Create `/js/minigames/rfid/` directory
- [ ] Create empty files:
  - [ ] `rfid-minigame.js`
  - [ ] `rfid-ui.js`
  - [ ] `rfid-data.js`
  - [ ] `rfid-animations.js`
- [ ] Create `/css/minigames/rfid-minigame.css`
- [ ] Create `/planning_notes/rfid_keycard/assets_placeholders/` directory

**Acceptance Criteria**:
- All files created and accessible
- Import statements ready

---

### Task 1.2: Implement RFIDDataManager Class
**Priority**: P0 (Blocker)
**Estimated Time**: 2 hours

File: `/js/minigames/rfid/rfid-data.js`

- [ ] Create `RFIDDataManager` class
- [ ] Implement `generateRandomCard()`
  - [ ] Generate 10-character hex ID
  - [ ] Calculate facility code (0-255)
  - [ ] Calculate card number (0-65535)
  - [ ] Set protocol to 'EM4100'
- [ ] Implement `saveCardToCloner(cardData)`
  - [ ] Find rfid_cloner in inventory
  - [ ] Initialize saved_cards array if missing
  - [ ] Check for duplicate cards
  - [ ] Add card with timestamp
- [ ] Implement `hexToFacilityCard(hex)` helper
- [ ] Implement `facilityCardToHex(facility, cardNumber)` helper
- [ ] Add unit tests for hex conversions

**Acceptance Criteria**:
- Cards generate with valid hex IDs
- Cards save to cloner without duplicates
- Hex conversions are bidirectional

**Test Case**:
```javascript
const manager = new RFIDDataManager();
const card = manager.generateRandomCard();
console.log(card.rfid_hex); // Should be 10 chars
console.log(card.rfid_facility); // Should be 0-255
```

---

### Task 1.3: Implement RFIDAnimations Class
**Priority**: P1 (High)
**Estimated Time**: 2 hours

File: `/js/minigames/rfid/rfid-animations.js`

- [ ] Create `RFIDAnimations` class
- [ ] Implement `animateReading(progressCallback)`
  - [ ] Create interval timer
  - [ ] Increment progress 2% every 50ms
  - [ ] Call callback with progress
  - [ ] Clear interval at 100%
  - [ ] Store interval reference for cleanup
- [ ] Implement `showTapSuccess()`
  - [ ] Display green checkmark
  - [ ] Show "Access Granted" message
  - [ ] Add success styling
- [ ] Implement `showTapFailure()`
  - [ ] Display red X
  - [ ] Show "Access Denied" message
  - [ ] Add failure styling
- [ ] Implement `showEmulationSuccess()`
  - [ ] Add success class to emulation status
  - [ ] Trigger success animation
- [ ] Implement `showEmulationFailure()`
  - [ ] Add failure class to emulation status
- [ ] Implement `cleanup()`
  - [ ] Clear all active intervals
  - [ ] Reset animation state

**Acceptance Criteria**:
- Reading animation completes in 2.5 seconds
- Success/failure states display correctly
- No memory leaks from intervals

---

### Task 1.4: Implement RFIDUIRenderer Class - Part 1 (Structure)
**Priority**: P0 (Blocker)
**Estimated Time**: 3 hours

File: `/js/minigames/rfid/rfid-ui.js`

- [ ] Create `RFIDUIRenderer` class
- [ ] Implement `createFlipperFrame()`
  - [ ] Create orange device frame
  - [ ] Add Flipper Zero header
  - [ ] Add battery indicator
  - [ ] Add device logo
- [ ] Implement `createUnlockInterface()`
  - [ ] Create container structure
  - [ ] Insert Flipper frame
  - [ ] Create screen div
  - [ ] Call `showMainMenu()`
- [ ] Implement `createCloneInterface()`
  - [ ] Create container structure
  - [ ] Insert Flipper frame
  - [ ] Create screen div ready for reading

**Acceptance Criteria**:
- Flipper frame renders with orange border
- Screen area is black with monospace font
- Layout matches Flipper Zero device proportions

---

### Task 1.5: Implement RFIDUIRenderer Class - Part 2 (Unlock Screens)
**Priority**: P0 (Blocker)
**Estimated Time**: 3 hours

File: `/js/minigames/rfid/rfid-ui.js`

- [ ] Implement `showMainMenu(screen)`
  - [ ] Display "RFID" breadcrumb
  - [ ] Show "Read" option if cards available
  - [ ] Show "Saved" option if cloner present
  - [ ] Add click handlers for menu items
- [ ] Implement `showTapInterface()`
  - [ ] Display "RFID > Read" breadcrumb
  - [ ] Show RFID waves animation
  - [ ] Show instruction text
  - [ ] List available keycards
  - [ ] Add click handlers for cards
- [ ] Implement `showSavedCards()`
  - [ ] Display "RFID > Saved" breadcrumb
  - [ ] Get saved cards from cloner
  - [ ] Show "No saved cards" if empty
  - [ ] List saved cards with navigation arrows
  - [ ] Add click handlers for card selection
- [ ] Implement `showEmulationScreen(card)`
  - [ ] Display "RFID > Saved > Emulate" breadcrumb
  - [ ] Show emulation icon
  - [ ] Display protocol (EM4100)
  - [ ] Show card name
  - [ ] Display hex data
  - [ ] Show facility code and card number
  - [ ] Add RF wave animation
  - [ ] Trigger emulation logic

**Acceptance Criteria**:
- All screens navigate correctly
- Breadcrumbs update appropriately
- Card data displays in Flipper format

---

### Task 1.6: Implement RFIDUIRenderer Class - Part 3 (Clone Screens)
**Priority**: P0 (Blocker)
**Estimated Time**: 2 hours

File: `/js/minigames/rfid/rfid-ui.js`

- [ ] Implement `showReadingScreen()`
  - [ ] Display "RFID > Read" breadcrumb
  - [ ] Show "Reading 1/2" status
  - [ ] Display "> ASK PSK" modulation
  - [ ] Show "Don't move card..." instruction
  - [ ] Create progress bar element
- [ ] Implement `updateReadingProgress(progress)`
  - [ ] Update progress bar width
  - [ ] Change color based on progress
- [ ] Implement `showCardDataScreen(cardData)`
  - [ ] Display "RFID > Read" breadcrumb
  - [ ] Show "EM-Micro EM4100" protocol
  - [ ] Format and display hex ID
  - [ ] Show facility code
  - [ ] Show card number
  - [ ] Calculate and show checksum
  - [ ] Calculate and show DEZ 8 format
  - [ ] Add Save button
  - [ ] Add Cancel button
  - [ ] Wire up button handlers

**Acceptance Criteria**:
- Progress bar animates smoothly
- Card data matches Flipper Zero format
- Save/Cancel buttons functional

---

### Task 1.7: Implement RFIDUIRenderer Helpers
**Priority**: P1 (High)
**Estimated Time**: 1 hour

File: `/js/minigames/rfid/rfid-ui.js`

- [ ] Implement `formatHex(hex)`
  - [ ] Split into 2-character chunks
  - [ ] Join with spaces
  - [ ] Convert to uppercase
  - [ ] Test with various inputs
- [ ] Implement `calculateChecksum(hex)`
  - [ ] Parse hex string
  - [ ] Calculate XOR checksum
  - [ ] Return as decimal
- [ ] Implement `toDEZ8(hex)`
  - [ ] Convert hex to decimal
  - [ ] Pad to 8 digits
  - [ ] Return as string
- [ ] Implement `getSavedCardsFromCloner()`
  - [ ] Find cloner in inventory
  - [ ] Return saved_cards array
  - [ ] Handle missing cloner gracefully

**Acceptance Criteria**:
- formatHex("4AC5EF44DC") returns "4A C5 EF 44 DC"
- toDEZ8("4AC5EF44DC") returns valid 8-digit decimal
- Helpers handle edge cases without errors

---

## Phase 2: Minigame Controller (Days 3-4)

### Task 2.1: Implement RFIDMinigame Class - Constructor and Init
**Priority**: P0 (Blocker)
**Estimated Time**: 2 hours

File: `/js/minigames/rfid/rfid-minigame.js`

- [ ] Import dependencies (MinigameScene, UI, Data, Animations)
- [ ] Create `RFIDMinigame` class extending `MinigameScene`
- [ ] Implement constructor
  - [ ] Accept params: mode, requiredCardId, availableCards, hasCloner, cardToClone
  - [ ] Set title based on mode
  - [ ] Enable cancel button
  - [ ] Call super constructor
  - [ ] Initialize state variables
  - [ ] Create component instances (ui, dataManager, animations)
- [ ] Implement `init()`
  - [ ] Call super.init()
  - [ ] Add CSS classes to container
  - [ ] Branch based on mode
  - [ ] Call ui.createUnlockInterface() or ui.createCloneInterface()

**Acceptance Criteria**:
- Minigame initializes without errors
- Components instantiate correctly
- Correct interface displays based on mode

---

### Task 2.2: Implement RFIDMinigame - Unlock Mode Logic
**Priority**: P0 (Blocker)
**Estimated Time**: 2 hours

File: `/js/minigames/rfid/rfid-minigame.js`

- [ ] Implement `handleCardTap(card)`
  - [ ] Log card tap
  - [ ] Compare card.key_id with requiredCardId
  - [ ] If match: call animations.showTapSuccess()
  - [ ] If no match: call animations.showTapFailure()
  - [ ] Delay 1 second
  - [ ] Call complete(success)
- [ ] Implement `handleEmulate(savedCard)`
  - [ ] Log emulation attempt
  - [ ] Call ui.showEmulationScreen(savedCard)
  - [ ] Compare savedCard.key_id with requiredCardId
  - [ ] If match: call animations.showEmulationSuccess()
  - [ ] If no match: call animations.showEmulationFailure()
  - [ ] Delay 2 seconds
  - [ ] Call complete(success)

**Acceptance Criteria**:
- Correct card unlocks door
- Wrong card shows access denied
- Emulation works identically to tap

**Test Cases**:
```javascript
// Correct card
handleCardTap({ key_id: 'ceo_keycard' }) // requiredCardId = 'ceo_keycard'
// Expected: Success, door unlocks

// Wrong card
handleCardTap({ key_id: 'security_keycard' }) // requiredCardId = 'ceo_keycard'
// Expected: Failure, door stays locked
```

---

### Task 2.3: Implement RFIDMinigame - Clone Mode Logic
**Priority**: P0 (Blocker)
**Estimated Time**: 2 hours

File: `/js/minigames/rfid/rfid-minigame.js`

- [ ] Implement `start()`
  - [ ] Call super.start()
  - [ ] If mode === 'clone', call startCardReading()
- [ ] Implement `startCardReading()`
  - [ ] Set currentView to 'read'
  - [ ] Reset readingProgress to 0
  - [ ] Call ui.showReadingScreen()
  - [ ] Call animations.animateReading() with progress callback
  - [ ] Update UI with progress
  - [ ] When progress reaches 100%, call showCardData()
- [ ] Implement `showCardData()`
  - [ ] Use cardToClone if provided
  - [ ] Otherwise call dataManager.generateRandomCard()
  - [ ] Call ui.showCardDataScreen(cardData)
- [ ] Implement `handleSaveCard(cardData)`
  - [ ] Call dataManager.saveCardToCloner(cardData)
  - [ ] Show success alert
  - [ ] Delay 1 second
  - [ ] Call complete(true, { cardData })

**Acceptance Criteria**:
- Reading animation triggers automatically
- Progress updates smoothly
- Card data displays correctly
- Save button stores card in cloner

---

### Task 2.4: Implement RFIDMinigame - Lifecycle Methods
**Priority**: P0 (Blocker)
**Estimated Time**: 1 hour

File: `/js/minigames/rfid/rfid-minigame.js`

- [ ] Implement `complete(success, result)`
  - [ ] Call super.complete(success, result)
  - [ ] Trigger onComplete callback if provided
- [ ] Implement `cleanup()`
  - [ ] Call animations.cleanup()
  - [ ] Call super.cleanup()
  - [ ] Clear any remaining timers
  - [ ] Reset state

**Acceptance Criteria**:
- Complete triggers callback correctly
- Cleanup prevents memory leaks
- Minigame can be restarted after cleanup

---

### Task 2.5: Create startRFIDMinigame() Starter Function
**Priority**: P0 (Blocker)
**Estimated Time**: 30 minutes

File: `/js/minigames/rfid/rfid-minigame.js`

- [ ] Export `startRFIDMinigame(lockable, type, params)` function
- [ ] Check if RFIDMinigame is registered
- [ ] If not, register with MinigameFramework
- [ ] Call `MinigameFramework.startMinigame('rfid', null, params)`
- [ ] Handle errors gracefully

**Acceptance Criteria**:
- Function registers minigame on-demand
- Function starts minigame with correct params
- Works from both unlock system and inventory

---

## Phase 3: System Integration (Day 5)

### Task 3.1: Add RFID Lock Type to Unlock System
**Priority**: P0 (Blocker)
**Estimated Time**: 2 hours

File: `/js/systems/unlock-system.js`

- [ ] Add new case `'rfid'` in handleUnlock() switch
- [ ] Extract requiredCardId from lockRequirements.requires
- [ ] Filter inventory for keycards (type === 'keycard')
- [ ] Check for rfid_cloner in inventory
- [ ] If has cards or cloner:
  - [ ] Call startRFIDMinigame() with unlock params
  - [ ] Pass requiredCardId, availableCards, hasCloner
  - [ ] Set onComplete callback to unlock on success
- [ ] If no cards or cloner:
  - [ ] Show error: "Requires RFID keycard"
- [ ] Add logging for debugging

**Acceptance Criteria**:
- RFID locks trigger minigame
- Correct cards unlock doors
- Error message shows when no cards

**Test Scenario**:
```json
{
  "room_server": {
    "locked": true,
    "lockType": "rfid",
    "requires": "ceo_keycard"
  }
}
```

---

### Task 3.2: Register RFID Minigame
**Priority**: P0 (Blocker)
**Estimated Time**: 30 minutes

File: `/js/minigames/index.js`

- [ ] Import `RFIDMinigame` from './rfid/rfid-minigame.js'
- [ ] Register with MinigameFramework:
  ```javascript
  MinigameFramework.registerScene('rfid', RFIDMinigame);
  ```
- [ ] Verify registration in console

**Acceptance Criteria**:
- Minigame appears in registeredScenes
- No import errors
- Minigame starts successfully

---

### Task 3.3: Add Minigame Starter Function
**Priority**: P1 (High)
**Estimated Time**: 30 minutes

File: `/js/systems/minigame-starters.js`

- [ ] Import `startRFIDMinigame` from rfid-minigame.js
- [ ] Export function for global access
- [ ] Add to window object if needed
- [ ] Test function call from console

**Acceptance Criteria**:
- Function is accessible globally
- Can start minigame from any context

---

### Task 3.4: Add clone_keycard Tag to Chat Helpers
**Priority**: P0 (Blocker)
**Estimated Time**: 2 hours

File: `/js/minigames/helpers/chat-helpers.js`

- [ ] Add new case `'clone_keycard'` in processGameActionTags()
- [ ] Parse param: `cardName|cardHex`
- [ ] Check for rfid_cloner in inventory
- [ ] If no cloner, show warning and return
- [ ] Generate cardData object:
  - [ ] name: cardName
  - [ ] rfid_hex: cardHex
  - [ ] rfid_facility: parse from hex
  - [ ] rfid_card_number: parse from hex
  - [ ] rfid_protocol: 'EM4100'
  - [ ] key_id: generated from name
- [ ] Call startRFIDMinigame() with clone params
- [ ] Pass cardToClone data
- [ ] Set onComplete callback
- [ ] Show notification on success/failure

**Acceptance Criteria**:
- Tag triggers clone minigame
- Card data parsed correctly from tag
- Saved cards work for unlocking

**Test Ink**:
```ink
* [Secretly clone keycard]
  # clone_keycard:Security Officer|4AC5EF44DC
  You subtly scan their badge.
```

---

### Task 3.5: Add Keycard Click Handler to Inventory
**Priority**: P1 (High)
**Estimated Time**: 1 hour

File: `/js/systems/inventory.js`

- [ ] Find `handleObjectInteraction()` function
- [ ] Add check before existing switch statement:
  ```javascript
  if (item.scenarioData?.type === 'keycard') {
    // Check for cloner
    // If has cloner, start clone minigame
    // If no cloner, show message
  }
  ```
- [ ] Check for rfid_cloner in inventory
- [ ] If has cloner:
  - [ ] Call startRFIDMinigame() with clone params
  - [ ] Pass cardToClone: item.scenarioData
- [ ] If no cloner:
  - [ ] Show gameAlert: "You need an RFID cloner to clone this card"
- [ ] Return early to prevent normal item handling

**Acceptance Criteria**:
- Clicking keycard with cloner starts clone minigame
- Clicking keycard without cloner shows message
- Cloned cards save to cloner

---

## Phase 4: Styling (Day 6)

### Task 4.1: Create Base RFID Minigame Styles
**Priority**: P1 (High)
**Estimated Time**: 2 hours

File: `/css/minigames/rfid-minigame.css`

- [ ] Create `.rfid-minigame-container` styles
  - [ ] Set dimensions (600x700px)
  - [ ] Center in viewport
  - [ ] Add z-index
- [ ] Create `.rfid-minigame-game-container` styles
  - [ ] Flex layout
  - [ ] Center content
  - [ ] Padding

**Acceptance Criteria**:
- Minigame centers on screen
- Container has proper dimensions

---

### Task 4.2: Create Flipper Zero Device Styles
**Priority**: P0 (Blocker)
**Estimated Time**: 3 hours

File: `/css/minigames/rfid-minigame.css`

- [ ] Create `.flipper-zero-frame` styles
  - [ ] Width: 400px, Height: 500px
  - [ ] Background: #FF8200 (Flipper orange)
  - [ ] Border-radius: 20px
  - [ ] Box-shadow for depth
  - [ ] Padding: 20px
- [ ] Create `.flipper-header` styles
  - [ ] Flexbox layout
  - [ ] Space between logo and battery
  - [ ] Padding bottom
- [ ] Create `.flipper-logo` styles
  - [ ] Font: Bold 16px
  - [ ] Color: white
- [ ] Create `.flipper-battery` styles
  - [ ] Font: 12px
  - [ ] Color: white with slight transparency

**Acceptance Criteria**:
- Frame looks like Flipper Zero device
- Orange color matches official device
- Header displays correctly

---

### Task 4.3: Create Flipper Screen Styles
**Priority**: P0 (Blocker)
**Estimated Time**: 2 hours

File: `/css/minigames/rfid-minigame.css`

- [ ] Create `.flipper-screen` styles
  - [ ] Width: 100%, Height: 380px
  - [ ] Background: #000 (black)
  - [ ] Border: 2px solid #333
  - [ ] Border-radius: 8px
  - [ ] Padding: 10px
  - [ ] Font-family: 'Courier New', monospace
  - [ ] Color: #FF8200 (orange text)
  - [ ] Font-size: 14px
  - [ ] Overflow-y: auto
  - [ ] Custom scrollbar styling

**Acceptance Criteria**:
- Screen has black background
- Text is orange and monospace
- Scrollbar matches theme

---

### Task 4.4: Create Menu and Navigation Styles
**Priority**: P1 (High)
**Estimated Time**: 2 hours

File: `/css/minigames/rfid-minigame.css`

- [ ] Create `.flipper-breadcrumb` styles
  - [ ] Color: #666 (gray)
  - [ ] Font-size: 12px
  - [ ] Border-bottom: 1px solid #333
  - [ ] Margin-bottom: 10px
  - [ ] Padding-bottom: 5px
- [ ] Create `.flipper-menu-item` styles
  - [ ] Padding: 8px
  - [ ] Margin: 4px 0
  - [ ] Cursor: pointer
  - [ ] Transition: background 0.2s
  - [ ] Hover: background #1a1a1a
- [ ] Create `.flipper-menu` styles
  - [ ] Flex column layout

**Acceptance Criteria**:
- Breadcrumbs display at top
- Menu items highlight on hover
- Navigation feels responsive

---

### Task 4.5: Create Reading Animation Styles
**Priority**: P1 (High)
**Estimated Time**: 2 hours

File: `/css/minigames/rfid-minigame.css`

- [ ] Create `.reading-progress-bar` styles
  - [ ] Width: 100%, Height: 20px
  - [ ] Background: #1a1a1a
  - [ ] Border: 1px solid #333
  - [ ] Border-radius: 4px
  - [ ] Margin-top: 20px
- [ ] Create `.reading-progress-fill` styles
  - [ ] Height: 100%
  - [ ] Background: linear-gradient(to right, #FF8200, #FFA500)
  - [ ] Transition: width 0.1s ease
  - [ ] Border-radius: 3px
- [ ] Create `.reading-status` styles
  - [ ] Font-size: 16px
  - [ ] Margin-bottom: 10px
- [ ] Create `.reading-modulation` styles
  - [ ] Color: #FF8200
  - [ ] Font-weight: bold
- [ ] Create `.reading-instruction` styles
  - [ ] Color: #999
  - [ ] Font-size: 12px
  - [ ] Margin-top: 10px

**Acceptance Criteria**:
- Progress bar animates smoothly
- Colors match Flipper theme
- Text is readable

---

### Task 4.6: Create Card Data Display Styles
**Priority**: P1 (High)
**Estimated Time**: 2 hours

File: `/css/minigames/rfid-minigame.css`

- [ ] Create `.card-protocol` styles
  - [ ] Font-size: 14px
  - [ ] Font-weight: bold
  - [ ] Margin-bottom: 15px
- [ ] Create `.card-hex` styles
  - [ ] Font-size: 18px
  - [ ] Letter-spacing: 2px
  - [ ] Color: #FF8200
  - [ ] Margin-bottom: 10px
- [ ] Create `.card-details` styles
  - [ ] Font-size: 13px
  - [ ] Line-height: 1.6
  - [ ] Color: #ccc
- [ ] Create `.card-dez` styles
  - [ ] Font-size: 14px
  - [ ] Color: #999
  - [ ] Margin-top: 10px
- [ ] Create `.card-actions` styles
  - [ ] Display: flex
  - [ ] Gap: 10px
  - [ ] Margin-top: 20px

**Acceptance Criteria**:
- Hex ID is prominent and readable
- Data layout matches Flipper Zero
- Buttons are easy to click

---

### Task 4.7: Create Emulation Screen Styles
**Priority**: P1 (High)
**Estimated Time**: 2 hours

File: `/css/minigames/rfid-minigame.css`

- [ ] Create `.emulation-status` styles
  - [ ] Text-align: center
  - [ ] Padding: 20px
  - [ ] Animation: pulse 2s infinite
- [ ] Create pulse keyframes
  ```css
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  ```
- [ ] Create `.emulation-icon` styles
  - [ ] Font-size: 48px
  - [ ] Margin-bottom: 10px
- [ ] Create `.emulation-text` styles
  - [ ] Font-size: 16px
  - [ ] Color: #FF8200
- [ ] Create `.emulation-protocol` styles
  - [ ] Font-size: 14px
  - [ ] Color: #999
  - [ ] Margin-top: 5px
- [ ] Create `.emulation-waves` styles
  - [ ] Add wave animation
  - [ ] CSS animation for RF waves

**Acceptance Criteria**:
- Emulation screen pulses subtly
- RF waves animate
- Status is clear

---

### Task 4.8: Create Success/Failure Result Styles
**Priority**: P1 (High)
**Estimated Time**: 1 hour

File: `/css/minigames/rfid-minigame.css`

- [ ] Create `.flipper-result` base styles
  - [ ] Text-align: center
  - [ ] Padding: 40px 20px
- [ ] Create `.flipper-result.success` styles
  - [ ] Color: #00FF00 (green)
- [ ] Create `.flipper-result.failure` styles
  - [ ] Color: #FF0000 (red)
- [ ] Create `.result-icon` styles
  - [ ] Font-size: 64px
  - [ ] Margin-bottom: 20px
- [ ] Create `.result-text` styles
  - [ ] Font-size: 24px
  - [ ] Font-weight: bold
  - [ ] Margin-bottom: 10px
- [ ] Create `.result-detail` styles
  - [ ] Font-size: 14px
  - [ ] Color: #999

**Acceptance Criteria**:
- Success shows green checkmark
- Failure shows red X
- Messages are clear and centered

---

### Task 4.9: Create Button Styles
**Priority**: P1 (High)
**Estimated Time**: 1 hour

File: `/css/minigames/rfid-minigame.css`

- [ ] Create `.flipper-btn` styles
  - [ ] Padding: 10px 20px
  - [ ] Background: #333
  - [ ] Color: #FF8200
  - [ ] Border: 2px solid #FF8200
  - [ ] Border-radius: 6px
  - [ ] Cursor: pointer
  - [ ] Font-family: 'Courier New', monospace
  - [ ] Font-size: 14px
  - [ ] Transition: all 0.2s
  - [ ] Hover: background #FF8200, color #000
- [ ] Add disabled state
  - [ ] Opacity: 0.5
  - [ ] Cursor: not-allowed

**Acceptance Criteria**:
- Buttons match Flipper theme
- Hover effect is smooth
- Disabled state is clear

---

### Task 4.10: Add Responsive Design
**Priority**: P2 (Medium)
**Estimated Time**: 1 hour

File: `/css/minigames/rfid-minigame.css`

- [ ] Add media query for small screens (< 600px)
  - [ ] Scale down Flipper frame
  - [ ] Adjust font sizes
  - [ ] Reduce padding
- [ ] Test on mobile viewport sizes

**Acceptance Criteria**:
- Minigame usable on smaller screens
- Text remains readable
- Buttons are tappable

---

## Phase 5: Assets (Day 7)

### Task 5.1: Create Keycard Sprite Placeholders
**Priority**: P0 (Blocker)
**Estimated Time**: 2 hours

**Create/Copy**:
- [ ] `/assets/objects/keycard.png` (32x48px)
  - [ ] Copy from `assets/objects/key.png` and modify
  - [ ] Add rectangular card shape
  - [ ] Add simple RFID chip graphic
- [ ] `/assets/objects/keycard-ceo.png` (32x48px)
  - [ ] Gold/yellow tinted variant
- [ ] `/assets/objects/keycard-security.png` (32x48px)
  - [ ] Blue tinted variant
- [ ] `/assets/objects/keycard-maintenance.png` (32x48px)
  - [ ] Green tinted variant

**Acceptance Criteria**:
- All files are 32x48px PNG
- Transparent background
- Recognizable as keycards
- Color variants distinguishable

---

### Task 5.2: Create RFID Cloner Sprite
**Priority**: P0 (Blocker)
**Estimated Time**: 1 hour

**Create/Copy**:
- [ ] `/assets/objects/rfid_cloner.png` (48x48px)
  - [ ] Copy from `assets/objects/bluetooth_scanner.png`
  - [ ] Modify to look like Flipper Zero
  - [ ] Orange accent color
  - [ ] Small screen indication

**Acceptance Criteria**:
- File is 48x48px PNG
- Recognizable as Flipper Zero-like device
- Orange accent visible

---

### Task 5.3: Create Icon Assets
**Priority**: P1 (High)
**Estimated Time**: 1 hour

**Create/Copy**:
- [ ] `/assets/icons/rfid-icon.png` (24x24px)
  - [ ] Simple RFID wave symbol
- [ ] `/assets/icons/nfc-waves.png` (32x32px)
  - [ ] Animated wave icon for tap indication

**Acceptance Criteria**:
- Icons are 24x24px or 32x32px
- Simple, recognizable designs
- Transparent backgrounds

---

### Task 5.4: Create Flipper Zero UI Assets (Optional)
**Priority**: P2 (Medium)
**Estimated Time**: 2 hours

**Create**:
- [ ] `/assets/minigames/flipper-frame.png` (400x500px)
  - [ ] Actual device frame image
  - [ ] Can be used instead of CSS styling
- [ ] `/assets/minigames/flipper-buttons.png`
  - [ ] Device button graphics

**Acceptance Criteria**:
- Images match Flipper Zero device
- High enough resolution for display
- Optimized file sizes

---

### Task 5.5: Document Asset Requirements
**Priority**: P2 (Medium)
**Estimated Time**: 1 hour

File: `/planning_notes/rfid_keycard/03_ASSETS_REQUIREMENTS.md`

- [ ] List all required assets with specifications
- [ ] Include dimensions, formats, colors
- [ ] Add examples and references
- [ ] Note placeholder vs. final assets

**Acceptance Criteria**:
- Complete asset list documented
- Specifications are clear
- Easy for asset creator to follow

---

## Phase 6: Testing & Integration (Day 8)

### Task 6.1: Create Test Scenario
**Priority**: P0 (Blocker)
**Estimated Time**: 2 hours

File: `/scenarios/test-rfid-scenario.json`

- [ ] Create test scenario with:
  - [ ] RFID-locked door
  - [ ] Keycard in starting inventory
  - [ ] RFID cloner in starting inventory
  - [ ] NPC with keycard (for clone test)
  - [ ] Multiple rooms with different access levels
- [ ] Add variety of cards and locks
- [ ] Include edge cases

**Example Structure**:
```json
{
  "id": "test_rfid",
  "name": "RFID System Test",
  "rooms": {
    "lobby": {
      "locked": false
    },
    "security_office": {
      "locked": true,
      "lockType": "rfid",
      "requires": "security_keycard"
    },
    "ceo_office": {
      "locked": true,
      "lockType": "rfid",
      "requires": "ceo_keycard"
    }
  },
  "startItemsInInventory": [
    {
      "type": "keycard",
      "name": "Security Keycard",
      "key_id": "security_keycard",
      "rfid_hex": "1234567890",
      "rfid_facility": 1,
      "rfid_card_number": 100
    },
    {
      "type": "rfid_cloner",
      "name": "RFID Cloner",
      "saved_cards": []
    }
  ]
}
```

**Acceptance Criteria**:
- Scenario loads without errors
- All test cases covered
- Progression is logical

---

### Task 6.2: Test Unlock Mode with Physical Cards
**Priority**: P0 (Blocker)
**Estimated Time**: 1 hour

**Test Cases**:
- [ ] Test: Click RFID-locked door
  - [ ] Expected: Minigame opens in unlock mode
- [ ] Test: Tap correct keycard
  - [ ] Expected: Door unlocks, success message
- [ ] Test: Tap wrong keycard
  - [ ] Expected: Access denied, door stays locked
- [ ] Test: No keycards in inventory
  - [ ] Expected: Error message "Requires RFID keycard"
- [ ] Test: Multiple keycards available
  - [ ] Expected: All cards shown in list

**Acceptance Criteria**:
- All test cases pass
- No console errors
- UI behaves correctly

---

### Task 6.3: Test Clone Mode from Ink Conversation
**Priority**: P0 (Blocker)
**Estimated Time**: 2 hours

**Setup**:
- [ ] Create test Ink file with clone tag
  ```ink
  * [Secretly clone keycard]
    # clone_keycard:CEO|ABCDEF0123
    You successfully cloned the CEO's badge.
  ```
- [ ] Compile Ink to JSON
- [ ] Add NPC with conversation to scenario

**Test Cases**:
- [ ] Test: Choose "[Secretly clone keycard]" option
  - [ ] Expected: Clone minigame opens
- [ ] Test: Reading animation completes
  - [ ] Expected: Card data screen shows
- [ ] Test: Click Save button
  - [ ] Expected: Card saved to cloner
- [ ] Test: Use cloned card to unlock
  - [ ] Expected: Door unlocks successfully
- [ ] Test: Clone without rfid_cloner in inventory
  - [ ] Expected: Warning message, minigame doesn't start

**Acceptance Criteria**:
- Clone workflow completes end-to-end
- Cloned cards persist in cloner
- Cloned cards work for unlocking

---

### Task 6.4: Test Clone Mode from Inventory
**Priority**: P0 (Blocker)
**Estimated Time**: 1 hour

**Test Cases**:
- [ ] Test: Click keycard in inventory (with cloner)
  - [ ] Expected: Clone minigame opens
- [ ] Test: Clone own keycard
  - [ ] Expected: Card clones successfully
- [ ] Test: Use cloned version to unlock
  - [ ] Expected: Works same as physical card
- [ ] Test: Click keycard without cloner
  - [ ] Expected: Message "Need RFID cloner"
- [ ] Test: Clone duplicate card
  - [ ] Expected: Prevents duplicate or overwrites

**Acceptance Criteria**:
- Inventory click triggers clone
- Cloned cards save correctly
- Duplicate handling works

---

### Task 6.5: Test Emulation Mode
**Priority**: P0 (Blocker)
**Estimated Time**: 1 hour

**Test Cases**:
- [ ] Test: Click door with saved cards in cloner
  - [ ] Expected: Shows "Saved" option in menu
- [ ] Test: Navigate to Saved menu
  - [ ] Expected: Lists all saved cards
- [ ] Test: Select card to emulate
  - [ ] Expected: Shows emulation screen
- [ ] Test: Emulate correct card
  - [ ] Expected: Door unlocks
- [ ] Test: Emulate wrong card
  - [ ] Expected: Access denied
- [ ] Test: No saved cards
  - [ ] Expected: "No saved cards" message

**Acceptance Criteria**:
- Emulation flow works correctly
- Saved cards display properly
- Emulation unlocks doors

---

### Task 6.6: Test Edge Cases and Error Handling
**Priority**: P1 (High)
**Estimated Time**: 2 hours

**Test Cases**:
- [ ] Test: Minigame cancel button
  - [ ] Expected: Closes minigame without error
- [ ] Test: Invalid hex ID format
  - [ ] Expected: Handles gracefully, shows placeholder
- [ ] Test: Missing card data fields
  - [ ] Expected: Uses defaults, no crash
- [ ] Test: Cloner with 20+ saved cards
  - [ ] Expected: All cards display, scrollable
- [ ] Test: Rapid clicking during animations
  - [ ] Expected: No duplicate actions
- [ ] Test: Start minigame while another is open
  - [ ] Expected: Closes first, opens second
- [ ] Test: Save same card twice
  - [ ] Expected: Prevents duplicate or updates

**Acceptance Criteria**:
- No crashes or errors
- Edge cases handled gracefully
- User feedback is clear

---

### Task 6.7: Performance Testing
**Priority**: P2 (Medium)
**Estimated Time**: 1 hour

**Test Cases**:
- [ ] Test: Minigame open/close 10 times
  - [ ] Check for memory leaks
  - [ ] Verify cleanup is complete
- [ ] Test: Save 50 cards to cloner
  - [ ] Check performance of card list
  - [ ] Verify scrolling is smooth
- [ ] Test: Reading animation with throttled CPU
  - [ ] Ensure animation doesn't stutter

**Tools**:
- Chrome DevTools Performance tab
- Memory profiler

**Acceptance Criteria**:
- No memory leaks detected
- Performance is acceptable
- Animations are smooth

---

### Task 6.8: Cross-Browser Testing
**Priority**: P2 (Medium)
**Estimated Time**: 1 hour

**Browsers to Test**:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (if available)
- [ ] Edge (latest)

**Test Cases**:
- [ ] Visual appearance matches in all browsers
- [ ] Animations work correctly
- [ ] No console errors
- [ ] Fonts render correctly

**Acceptance Criteria**:
- Works in all major browsers
- No browser-specific bugs
- Consistent appearance

---

### Task 6.9: Accessibility Testing
**Priority**: P2 (Medium)
**Estimated Time**: 1 hour

**Test Cases**:
- [ ] Test: Keyboard navigation
  - [ ] Tab through all interactive elements
  - [ ] Enter key activates buttons
- [ ] Test: Screen reader
  - [ ] ARIA labels are announced
  - [ ] Navigation is logical
- [ ] Test: High contrast mode
  - [ ] Text is readable
  - [ ] UI is usable
- [ ] Test: Text scaling
  - [ ] UI doesn't break at 150% zoom

**Acceptance Criteria**:
- Keyboard accessible
- Screen reader friendly
- High contrast compatible

---

## Phase 7: Documentation & Polish (Day 9)

### Task 7.1: Write Code Documentation
**Priority**: P1 (High)
**Estimated Time**: 2 hours

**Files to Document**:
- [ ] Add JSDoc comments to all public methods
- [ ] Document class constructors
- [ ] Document params and return types
- [ ] Add usage examples in comments

**Example**:
```javascript
/**
 * Starts the RFID minigame
 * @param {Object} lockable - The locked door or item sprite
 * @param {string} type - 'door' or 'item'
 * @param {Object} params - Minigame parameters
 * @param {string} params.mode - 'unlock' or 'clone'
 * @param {string} params.requiredCardId - ID of required keycard
 * @param {Array} params.availableCards - Player's keycards
 * @param {boolean} params.hasCloner - Whether player has cloner
 * @param {Function} params.onComplete - Callback on completion
 */
export function startRFIDMinigame(lockable, type, params) {
  // ...
}
```

**Acceptance Criteria**:
- All public methods documented
- Documentation is accurate
- Examples are helpful

---

### Task 7.2: Create User Guide
**Priority**: P2 (Medium)
**Estimated Time**: 2 hours

File: `/docs/RFID_USER_GUIDE.md`

- [ ] Write overview of RFID system
- [ ] Explain how to use keycards
- [ ] Explain how to use cloner
- [ ] Include screenshots
- [ ] Add troubleshooting section

**Sections**:
1. Introduction
2. Using Keycards
3. Using the RFID Cloner
4. Cloning Cards
5. Emulating Cards
6. Troubleshooting

**Acceptance Criteria**:
- Guide is clear and concise
- Covers all features
- Screenshots are helpful

---

### Task 7.3: Create Scenario Designer Guide
**Priority**: P1 (High)
**Estimated Time**: 2 hours

File: `/docs/RFID_SCENARIO_GUIDE.md`

- [ ] Explain how to add RFID locks to scenarios
- [ ] Show keycard item format
- [ ] Show RFID cloner format
- [ ] Explain Ink tag usage
- [ ] Provide complete examples

**Example Content**:
```markdown
## Adding an RFID Lock

```json
{
  "room_server": {
    "locked": true,
    "lockType": "rfid",
    "requires": "server_keycard"
  }
}
```

## Adding a Keycard

```json
{
  "type": "keycard",
  "name": "Server Room Keycard",
  "key_id": "server_keycard",
  "rfid_hex": "9876543210",
  "rfid_facility": 42,
  "rfid_card_number": 5000
}
```
```

**Acceptance Criteria**:
- Examples are complete and correct
- Guide is easy to follow
- Covers all configuration options

---

### Task 7.4: Update Main Documentation
**Priority**: P2 (Medium)
**Estimated Time**: 1 hour

**Files to Update**:
- [ ] `/docs/LOCK_KEY_SYSTEM_ARCHITECTURE.md`
  - [ ] Add RFID to lock types table
  - [ ] Add RFID section
- [ ] `/docs/LOCK_KEY_QUICK_START.md`
  - [ ] Add RFID quick reference
- [ ] `/README.md` (if exists)
  - [ ] Mention new RFID feature

**Acceptance Criteria**:
- Documentation is up-to-date
- RFID is integrated into existing docs
- No conflicting information

---

### Task 7.5: Create Testing Plan Document
**Priority**: P2 (Medium)
**Estimated Time**: 1 hour

File: `/planning_notes/rfid_keycard/04_TESTING_PLAN.md`

- [ ] Document all test cases
- [ ] Create test checklists
- [ ] List known issues
- [ ] Define acceptance criteria

**Acceptance Criteria**:
- Comprehensive test coverage
- Clear test procedures
- Easy to follow checklist

---

### Task 7.6: Polish UI and Animations
**Priority**: P2 (Medium)
**Estimated Time**: 3 hours

**Polish Tasks**:
- [ ] Fine-tune animation timings
- [ ] Adjust colors for consistency
- [ ] Improve button feedback
- [ ] Add subtle hover effects
- [ ] Smooth transitions between screens
- [ ] Add loading states where needed

**Acceptance Criteria**:
- UI feels polished
- Transitions are smooth
- Feedback is immediate

---

### Task 7.7: Optimize Performance
**Priority**: P2 (Medium)
**Estimated Time**: 2 hours

**Optimization Tasks**:
- [ ] Minimize DOM manipulations
- [ ] Cache frequently accessed elements
- [ ] Optimize CSS selectors
- [ ] Reduce animation repaints
- [ ] Lazy load assets if needed

**Acceptance Criteria**:
- Minigame opens instantly
- Animations don't cause lag
- Memory usage is reasonable

---

### Task 7.8: Add Sound Effects (Optional)
**Priority**: P3 (Low)
**Estimated Time**: 2 hours

**Sounds to Add**:
- [ ] Card tap sound
- [ ] Reading beep sound
- [ ] Success chime
- [ ] Failure buzz
- [ ] Emulation hum

**Files**:
- `/assets/sounds/rfid_tap.mp3`
- `/assets/sounds/rfid_read.mp3`
- `/assets/sounds/rfid_success.mp3`
- `/assets/sounds/rfid_failure.mp3`

**Acceptance Criteria**:
- Sounds are subtle and fitting
- Can be muted
- Don't overlap awkwardly

---

## Phase 8: Final Review and Deployment (Day 10)

### Task 8.1: Code Review
**Priority**: P0 (Blocker)
**Estimated Time**: 2 hours

**Review Checklist**:
- [ ] Code follows project style guide
- [ ] No console.log() in production
- [ ] Error handling is comprehensive
- [ ] No magic numbers (use constants)
- [ ] Functions are well-named
- [ ] Code is DRY (Don't Repeat Yourself)

**Acceptance Criteria**:
- Code passes review
- No major issues found
- Style is consistent

---

### Task 8.2: Security Review
**Priority**: P1 (High)
**Estimated Time**: 1 hour

**Security Checklist**:
- [ ] No XSS vulnerabilities in UI
- [ ] Card data sanitized before display
- [ ] Ink tag parsing is safe
- [ ] No arbitrary code execution
- [ ] Data validation on all inputs

**Acceptance Criteria**:
- No security vulnerabilities
- Data is validated and sanitized
- Safe against common attacks

---

### Task 8.3: Final Integration Test
**Priority**: P0 (Blocker)
**Estimated Time**: 2 hours

**Full Workflow Test**:
- [ ] Load game with test scenario
- [ ] Complete full playthrough:
  1. [ ] Start with keycard
  2. [ ] Unlock door with card
  3. [ ] Find RFID cloner
  4. [ ] Clone own card
  5. [ ] Talk to NPC, clone their card
  6. [ ] Use emulation to unlock
  7. [ ] Test wrong card scenarios
- [ ] No errors or issues encountered

**Acceptance Criteria**:
- Complete workflow works end-to-end
- No bugs encountered
- Experience is smooth

---

### Task 8.4: Create Release Notes
**Priority**: P2 (Medium)
**Estimated Time**: 1 hour

File: `/CHANGELOG.md` or release notes

**Include**:
- [ ] Feature summary
- [ ] New lock type: RFID
- [ ] New items: Keycards, RFID Cloner
- [ ] New minigame: Flipper Zero-style interface
- [ ] New Ink tag: clone_keycard
- [ ] Breaking changes (if any)
- [ ] Migration guide (if needed)

**Acceptance Criteria**:
- Release notes are complete
- Changes are clearly described
- Upgrade path is documented

---

### Task 8.5: Create Example Scenario
**Priority**: P1 (High)
**Estimated Time**: 2 hours

File: `/scenarios/example-rfid-heist.json`

**Scenario**:
- [ ] Corporate espionage mission
- [ ] Multiple security levels
- [ ] NPCs with different access cards
- [ ] Progression: Clone cards to access higher areas
- [ ] Include Ink conversations for cloning

**Acceptance Criteria**:
- Scenario is playable
- Demonstrates all RFID features
- Is fun and engaging

---

### Task 8.6: Prepare Demo Video/Screenshots
**Priority**: P3 (Low)
**Estimated Time**: 2 hours

**Create**:
- [ ] Screenshots of:
  - [ ] Flipper Zero interface
  - [ ] Card tapping
  - [ ] Reading animation
  - [ ] Card data screen
  - [ ] Emulation screen
- [ ] Short video demo (1-2 minutes)
- [ ] GIF of key interactions

**Acceptance Criteria**:
- Visuals show off features
- Quality is good
- Demonstrates workflow

---

### Task 8.7: Update Project README
**Priority**: P2 (Medium)
**Estimated Time**: 30 minutes

File: `/README.md`

**Add**:
- [ ] RFID feature to features list
- [ ] Link to RFID user guide
- [ ] Screenshots/demo
- [ ] Quick start for RFID

**Acceptance Criteria**:
- README is updated
- RFID is prominently featured
- Links work

---

### Task 8.8: Git Commit and Push
**Priority**: P0 (Blocker)
**Estimated Time**: 30 minutes

**Git Tasks**:
- [ ] Review all changed files
- [ ] Stage files
- [ ] Commit with clear message:
  ```
  feat: Add RFID keycard lock system with Flipper Zero interface

  - New lock type: rfid
  - New items: keycard, rfid_cloner
  - New minigame: Flipper Zero-style RFID reader/cloner
  - Support for card cloning from NPCs via Ink tags
  - Support for card emulation
  - Full documentation and test scenario included
  ```
- [ ] Push to branch
- [ ] Create pull request (if applicable)

**Acceptance Criteria**:
- All changes committed
- Commit message is descriptive
- Branch is pushed

---

### Task 8.9: Create Pull Request (if applicable)
**Priority**: P1 (High)
**Estimated Time**: 30 minutes

**PR Content**:
- [ ] Title: "Add RFID Keycard Lock System"
- [ ] Description with:
  - [ ] Feature overview
  - [ ] Implementation details
  - [ ] Testing performed
  - [ ] Screenshots/demo
  - [ ] Checklist of changes
- [ ] Request review
- [ ] Link to planning docs

**Acceptance Criteria**:
- PR is complete and clear
- All checkboxes filled
- Ready for review

---

### Task 8.10: Post-Deployment Monitoring
**Priority**: P2 (Medium)
**Estimated Time**: Ongoing

**Monitor**:
- [ ] User feedback
- [ ] Bug reports
- [ ] Performance issues
- [ ] Feature requests

**Respond to**:
- [ ] Critical bugs immediately
- [ ] Minor bugs within 1 week
- [ ] Feature requests as roadmap items

**Acceptance Criteria**:
- Feedback is tracked
- Issues are triaged
- Communication is timely

---

## Summary Checklist

### Must-Have for Launch
- [ ] All P0 tasks complete
- [ ] Core unlock mode works
- [ ] Core clone mode works
- [ ] No critical bugs
- [ ] Basic documentation complete

### Should-Have for Launch
- [ ] All P1 tasks complete
- [ ] Emulation mode works
- [ ] Ink tag integration works
- [ ] Inventory click works
- [ ] Comprehensive testing done
- [ ] User guide written

### Nice-to-Have for Launch
- [ ] All P2 tasks complete
- [ ] Polish and animations refined
- [ ] Performance optimized
- [ ] Sound effects added
- [ ] Demo materials created

### Future Enhancements
- [ ] P3 tasks
- [ ] Advanced features
- [ ] Multiple RFID protocols
- [ ] Custom card programming
- [ ] Access control system hacking

---

## Time Estimates

| Phase | Estimated Time |
|-------|----------------|
| Phase 1: Core Infrastructure | 16 hours |
| Phase 2: Minigame Controller | 8 hours |
| Phase 3: System Integration | 7 hours |
| Phase 4: Styling | 15 hours |
| Phase 5: Assets | 7 hours |
| Phase 6: Testing & Integration | 12 hours |
| Phase 7: Documentation & Polish | 15 hours |
| Phase 8: Final Review | 11 hours |
| **TOTAL** | **91 hours (~11 days)** |

## Dependencies

```
Phase 1 (Core Infrastructure)
    ↓
Phase 2 (Minigame Controller) [depends on Phase 1]
    ↓
Phase 3 (System Integration) [depends on Phases 1-2]
    ↓
Phase 4 (Styling) [parallel with Phase 5]
Phase 5 (Assets) [parallel with Phase 4]
    ↓
Phase 6 (Testing) [depends on Phases 1-5]
    ↓
Phase 7 (Documentation) [parallel with Phase 8]
Phase 8 (Final Review) [depends on Phase 6]
```

## Risk Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Flipper Zero CSS too complex | Medium | Low | Use simpler design, iterate later |
| Animation performance issues | High | Medium | Test early, optimize progressively |
| Integration breaks existing locks | High | Low | Thorough testing, isolated changes |
| Asset creation delays | Medium | Medium | Use placeholders, refine later |
| Hex conversion bugs | High | Low | Unit test thoroughly |
| Duplicate card saves | Low | Medium | Add duplicate detection early |

---

**Last Updated**: 2024-01-15
**Status**: Planning Complete, Ready for Implementation
**Next Steps**: Begin Phase 1, Task 1.1
