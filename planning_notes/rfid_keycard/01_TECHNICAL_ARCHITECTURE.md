# RFID Keycard System - Technical Architecture

## File Structure

```
js/
├── systems/
│   ├── unlock-system.js                    [MODIFY] Add rfid lock type case
│   └── inventory.js                        [MODIFY] Add keycard click handler
│
├── minigames/
│   ├── rfid/
│   │   ├── rfid-minigame.js               [NEW] Main RFID minigame controller
│   │   ├── rfid-ui.js                     [NEW] Flipper Zero UI rendering
│   │   ├── rfid-data.js                   [NEW] Card data management
│   │   └── rfid-animations.js             [NEW] Reading/tap animations
│   │
│   ├── helpers/
│   │   └── chat-helpers.js                [MODIFY] Add clone_keycard tag
│   │
│   └── index.js                           [MODIFY] Register rfid minigame
│
└── systems/
    └── minigame-starters.js               [MODIFY] Add startRFIDMinigame()

css/
└── minigames/
    └── rfid-minigame.css                  [NEW] Flipper Zero styling

assets/
├── objects/
│   ├── keycard.png                        [NEW] Generic keycard sprite
│   ├── keycard-ceo.png                    [NEW] CEO keycard variant
│   ├── keycard-security.png               [NEW] Security keycard variant
│   ├── rfid_cloner.png                    [NEW] RFID cloner device
│   └── flipper-zero.png                   [NEW] Flipper Zero icon
│
└── icons/
    ├── rfid-icon.png                      [NEW] RFID lock icon
    └── nfc-waves.png                      [NEW] NFC signal waves

scenarios/
└── example-rfid-scenario.json             [NEW] Example scenario with RFID locks

planning_notes/rfid_keycard/
├── 00_OVERVIEW.md                         [THIS DOC]
├── 01_TECHNICAL_ARCHITECTURE.md           [THIS DOC]
├── 02_IMPLEMENTATION_TODO.md              [NEXT]
├── 03_ASSETS_REQUIREMENTS.md              [NEXT]
└── 04_TESTING_PLAN.md                     [NEXT]
```

## Code Architecture

### 1. Unlock System Integration

**File**: `/js/systems/unlock-system.js`

Add new case in `handleUnlock()` function:

```javascript
case 'rfid':
    console.log('RFID LOCK REQUESTED');
    const requiredCardId = lockRequirements.requires;

    // Get all keycards from player's inventory
    const playerKeycards = window.inventory.items.filter(item =>
        item && item.scenarioData &&
        item.scenarioData.type === 'keycard'
    );

    // Check for RFID cloner
    const hasRFIDCloner = window.inventory.items.some(item =>
        item && item.scenarioData &&
        item.scenarioData.type === 'rfid_cloner'
    );

    if (playerKeycards.length > 0 || hasRFIDCloner) {
        // Start RFID minigame in unlock mode
        startRFIDMinigame(lockable, type, {
            mode: 'unlock',
            requiredCardId: requiredCardId,
            availableCards: playerKeycards,
            hasCloner: hasRFIDCloner,
            onComplete: (success) => {
                if (success) {
                    unlockTarget(lockable, type, lockable.layer);
                    window.gameAlert('Access Granted', 'success', 'RFID Unlock', 3000);
                } else {
                    window.gameAlert('Access Denied - Invalid Card', 'error', 'RFID Unlock', 3000);
                }
            }
        });
    } else {
        console.log('NO KEYCARD OR RFID CLONER');
        window.gameAlert('Requires RFID keycard', 'error', 'Locked', 4000);
    }
    break;
```

### 2. RFID Minigame Class

**File**: `/js/minigames/rfid/rfid-minigame.js`

```javascript
import { MinigameScene } from '../framework/base-minigame.js';
import { RFIDUIRenderer } from './rfid-ui.js';
import { RFIDDataManager } from './rfid-data.js';
import { RFIDAnimations } from './rfid-animations.js';

export class RFIDMinigame extends MinigameScene {
    constructor(container, params) {
        params = params || {};
        params.title = params.mode === 'clone' ? 'RFID Cloner' : 'RFID Reader';
        params.showCancel = true;
        params.cancelText = 'Back';

        super(container, params);

        // Minigame configuration
        this.mode = params.mode || 'unlock';  // 'unlock' or 'clone'
        this.requiredCardId = params.requiredCardId;
        this.availableCards = params.availableCards || [];
        this.hasCloner = params.hasCloner || false;
        this.cardToClone = params.cardToClone;  // For clone mode

        // Components
        this.ui = new RFIDUIRenderer(this);
        this.dataManager = new RFIDDataManager();
        this.animations = new RFIDAnimations(this);

        // State
        this.currentView = 'main';  // 'main', 'saved', 'emulate', 'read'
        this.selectedSavedCard = null;
        this.readingProgress = 0;
    }

    init() {
        super.init();
        console.log('RFID minigame initializing in mode:', this.mode);

        this.container.className += ' rfid-minigame-container';
        this.gameContainer.className += ' rfid-minigame-game-container';

        // Create the appropriate interface based on mode
        if (this.mode === 'unlock') {
            this.ui.createUnlockInterface();
        } else if (this.mode === 'clone') {
            this.ui.createCloneInterface();
        }
    }

    start() {
        super.start();
        console.log('RFID minigame started');

        if (this.mode === 'clone') {
            // Automatically start reading animation
            this.startCardReading();
        }
    }

    // Unlock mode methods
    handleCardTap(card) {
        console.log('Card tapped:', card);

        if (card.key_id === this.requiredCardId) {
            this.animations.showTapSuccess();
            setTimeout(() => {
                this.complete(true);
            }, 1000);
        } else {
            this.animations.showTapFailure();
            setTimeout(() => {
                this.complete(false);
            }, 1000);
        }
    }

    handleEmulate(savedCard) {
        console.log('Emulating card:', savedCard);

        // Show Flipper Zero emulation screen
        this.ui.showEmulationScreen(savedCard);

        // Check if emulated card matches required
        if (savedCard.key_id === this.requiredCardId) {
            this.animations.showEmulationSuccess();
            setTimeout(() => {
                this.complete(true);
            }, 2000);
        } else {
            this.animations.showEmulationFailure();
            setTimeout(() => {
                this.complete(false);
            }, 2000);
        }
    }

    // Clone mode methods
    startCardReading() {
        console.log('Starting card reading...');
        this.currentView = 'read';
        this.readingProgress = 0;

        // Show reading screen
        this.ui.showReadingScreen();

        // Simulate reading progress
        this.animations.animateReading((progress) => {
            this.readingProgress = progress;
            this.ui.updateReadingProgress(progress);

            if (progress >= 100) {
                // Reading complete - show card data
                this.showCardData();
            }
        });
    }

    showCardData() {
        console.log('Showing card data');

        // Generate or use provided card data
        const cardData = this.cardToClone || this.dataManager.generateRandomCard();

        // Show card data screen with Flipper Zero formatting
        this.ui.showCardDataScreen(cardData);
    }

    handleSaveCard(cardData) {
        console.log('Saving card:', cardData);

        // Save to RFID cloner inventory item
        this.dataManager.saveCardToCloner(cardData);

        // Show success message
        window.gameAlert('Card saved successfully', 'success', 'RFID Cloner', 2000);

        // Complete minigame
        setTimeout(() => {
            this.complete(true, { cardData });
        }, 1000);
    }

    complete(success, result) {
        super.complete(success, result);
    }

    cleanup() {
        this.animations.cleanup();
        super.cleanup();
    }
}

// Starter function
export function startRFIDMinigame(lockable, type, params) {
    console.log('Starting RFID minigame with params:', params);

    // Register minigame if not already done
    if (window.MinigameFramework && !window.MinigameFramework.registeredScenes['rfid']) {
        window.MinigameFramework.registerScene('rfid', RFIDMinigame);
    }

    // Start the minigame
    window.MinigameFramework.startMinigame('rfid', null, params);
}
```

### 3. RFID UI Renderer

**File**: `/js/minigames/rfid/rfid-ui.js`

```javascript
export class RFIDUIRenderer {
    constructor(minigame) {
        this.minigame = minigame;
        this.container = minigame.gameContainer;
    }

    createUnlockInterface() {
        const ui = document.createElement('div');
        ui.className = 'rfid-unlock-interface';

        // Create Flipper Zero device frame
        const flipperFrame = this.createFlipperFrame();
        ui.appendChild(flipperFrame);

        // Create screen content area
        const screen = document.createElement('div');
        screen.className = 'flipper-screen';
        screen.id = 'flipper-screen';

        // Show main menu
        this.showMainMenu(screen);

        flipperFrame.appendChild(screen);
        this.container.appendChild(ui);
    }

    createFlipperFrame() {
        const frame = document.createElement('div');
        frame.className = 'flipper-zero-frame';

        // Add device styling (orange border, black screen, etc.)
        frame.innerHTML = `
            <div class="flipper-header">
                <div class="flipper-logo">Flipper Zero</div>
                <div class="flipper-battery">100%</div>
            </div>
        `;

        return frame;
    }

    showMainMenu(screen) {
        screen.innerHTML = `
            <div class="flipper-menu">
                <div class="flipper-breadcrumb">RFID</div>
                <div class="flipper-menu-items">
                    ${this.minigame.availableCards.length > 0 ?
                        '<div class="flipper-menu-item" data-action="tap">▶ Read</div>' : ''}
                    ${this.minigame.hasCloner ?
                        '<div class="flipper-menu-item" data-action="saved">▶ Saved</div>' : ''}
                </div>
            </div>
        `;

        // Add event listeners
        screen.querySelectorAll('.flipper-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (action === 'tap') {
                    this.showTapInterface();
                } else if (action === 'saved') {
                    this.showSavedCards();
                }
            });
        });
    }

    showTapInterface() {
        const screen = document.getElementById('flipper-screen');

        screen.innerHTML = `
            <div class="flipper-read-screen">
                <div class="flipper-breadcrumb">RFID > Read</div>
                <div class="flipper-content">
                    <div class="rfid-tap-area">
                        <div class="rfid-waves"></div>
                        <div class="rfid-instruction">Place card on reader...</div>
                    </div>
                    <div class="rfid-card-list">
                        ${this.minigame.availableCards.map(card => `
                            <div class="rfid-card-item" data-card-id="${card.scenarioData.key_id}">
                                ▶ ${card.scenarioData.name}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // Add click handlers for cards
        screen.querySelectorAll('.rfid-card-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const cardId = e.target.dataset.cardId;
                const card = this.minigame.availableCards.find(
                    c => c.scenarioData.key_id === cardId
                );
                if (card) {
                    this.minigame.handleCardTap(card.scenarioData);
                }
            });
        });
    }

    showSavedCards() {
        const screen = document.getElementById('flipper-screen');
        const savedCards = this.getSavedCardsFromCloner();

        screen.innerHTML = `
            <div class="flipper-saved-screen">
                <div class="flipper-breadcrumb">RFID > Saved</div>
                <div class="flipper-content">
                    ${savedCards.length === 0 ?
                        '<div class="flipper-empty">No saved cards</div>' :
                        savedCards.map((card, idx) => `
                            <div class="flipper-menu-item" data-card-index="${idx}">
                                ▶ ${card.name}
                            </div>
                        `).join('')
                    }
                </div>
            </div>
        `;

        // Add click handlers
        screen.querySelectorAll('.flipper-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const cardIndex = parseInt(e.target.dataset.cardIndex);
                const card = savedCards[cardIndex];
                if (card) {
                    this.showEmulationScreen(card);
                }
            });
        });
    }

    showEmulationScreen(card) {
        const screen = document.getElementById('flipper-screen');

        screen.innerHTML = `
            <div class="flipper-emulate-screen">
                <div class="flipper-breadcrumb">RFID > Saved > Emulate</div>
                <div class="flipper-content">
                    <div class="emulation-status">
                        <div class="emulation-icon">📡</div>
                        <div class="emulation-text">Emulating</div>
                        <div class="emulation-protocol">[${card.protocol || 'EM4100'}]</div>
                        <div class="emulation-name">${card.name}</div>
                    </div>
                    <div class="emulation-data">
                        <div>Hex: ${this.formatHex(card.hex)}</div>
                        <div>FC: ${card.facility || 'N/A'}</div>
                        <div>Card: ${card.card_number || 'N/A'}</div>
                    </div>
                    <div class="emulation-waves"></div>
                </div>
            </div>
        `;

        // Trigger emulation check
        this.minigame.handleEmulate(card);
    }

    // Clone mode UI
    createCloneInterface() {
        const ui = document.createElement('div');
        ui.className = 'rfid-clone-interface';

        const flipperFrame = this.createFlipperFrame();

        const screen = document.createElement('div');
        screen.className = 'flipper-screen';
        screen.id = 'flipper-screen';

        flipperFrame.appendChild(screen);
        ui.appendChild(flipperFrame);
        this.container.appendChild(ui);
    }

    showReadingScreen() {
        const screen = document.getElementById('flipper-screen');

        screen.innerHTML = `
            <div class="flipper-read-progress">
                <div class="flipper-breadcrumb">RFID > Read</div>
                <div class="flipper-content">
                    <div class="reading-status">Reading 1/2</div>
                    <div class="reading-modulation">> ASK PSK</div>
                    <div class="reading-instruction">Don't move card...</div>
                    <div class="reading-progress-bar">
                        <div class="reading-progress-fill" id="reading-progress-fill"></div>
                    </div>
                </div>
            </div>
        `;
    }

    updateReadingProgress(progress) {
        const fill = document.getElementById('reading-progress-fill');
        if (fill) {
            fill.style.width = progress + '%';
        }
    }

    showCardDataScreen(cardData) {
        const screen = document.getElementById('flipper-screen');

        screen.innerHTML = `
            <div class="flipper-card-data">
                <div class="flipper-breadcrumb">RFID > Read</div>
                <div class="flipper-content">
                    <div class="card-protocol">EM-Micro EM4100</div>
                    <div class="card-hex">Hex: ${this.formatHex(cardData.rfid_hex)}</div>
                    <div class="card-details">
                        <div>FC: ${cardData.rfid_facility} Card: ${cardData.rfid_card_number}</div>
                        <div>CL: ${this.calculateChecksum(cardData.rfid_hex)}</div>
                    </div>
                    <div class="card-dez">DEZ 8: ${this.toDEZ8(cardData.rfid_hex)}</div>
                    <div class="card-actions">
                        <button class="flipper-btn" id="save-card-btn">Save</button>
                        <button class="flipper-btn" id="cancel-card-btn">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        // Add event listeners
        document.getElementById('save-card-btn').addEventListener('click', () => {
            this.minigame.handleSaveCard(cardData);
        });

        document.getElementById('cancel-card-btn').addEventListener('click', () => {
            this.minigame.complete(false);
        });
    }

    // Helper methods
    formatHex(hex) {
        // Format as: 4A C5 EF 44 DC
        return hex.match(/.{1,2}/g).join(' ').toUpperCase();
    }

    calculateChecksum(hex) {
        // Simplified checksum calculation
        return 64; // Placeholder
    }

    toDEZ8(hex) {
        // Convert hex to 8-digit decimal
        const decimal = parseInt(hex, 16);
        return decimal.toString().padStart(8, '0');
    }

    getSavedCardsFromCloner() {
        // Get RFID cloner from inventory
        const cloner = window.inventory.items.find(item =>
            item && item.scenarioData &&
            item.scenarioData.type === 'rfid_cloner'
        );

        return cloner?.scenarioData?.saved_cards || [];
    }
}
```

### 4. RFID Data Manager

**File**: `/js/minigames/rfid/rfid-data.js`

```javascript
export class RFIDDataManager {
    constructor() {
        this.protocols = ['EM4100', 'HID Prox', 'Indala'];
    }

    generateRandomCard() {
        const hex = this.generateRandomHex();
        const facility = Math.floor(Math.random() * 256);
        const cardNumber = Math.floor(Math.random() * 65536);

        return {
            name: 'Unknown Card',
            rfid_hex: hex,
            rfid_facility: facility,
            rfid_card_number: cardNumber,
            rfid_protocol: 'EM4100',
            key_id: 'cloned_' + hex
        };
    }

    generateRandomHex() {
        let hex = '';
        for (let i = 0; i < 10; i++) {
            hex += Math.floor(Math.random() * 16).toString(16).toUpperCase();
        }
        return hex;
    }

    saveCardToCloner(cardData) {
        // Find RFID cloner in inventory
        const cloner = window.inventory.items.find(item =>
            item && item.scenarioData &&
            item.scenarioData.type === 'rfid_cloner'
        );

        if (!cloner) {
            console.error('RFID cloner not found in inventory');
            return false;
        }

        // Initialize saved_cards array if it doesn't exist
        if (!cloner.scenarioData.saved_cards) {
            cloner.scenarioData.saved_cards = [];
        }

        // Check if card already saved
        const existing = cloner.scenarioData.saved_cards.find(
            card => card.hex === cardData.rfid_hex
        );

        if (existing) {
            console.log('Card already saved');
            return false;
        }

        // Save card
        cloner.scenarioData.saved_cards.push({
            name: cardData.name,
            hex: cardData.rfid_hex,
            facility: cardData.rfid_facility,
            card_number: cardData.rfid_card_number,
            protocol: cardData.rfid_protocol || 'EM4100',
            key_id: cardData.key_id,
            cloned_at: new Date().toISOString()
        });

        console.log('Card saved to cloner:', cardData);
        return true;
    }

    hexToFacilityCard(hex) {
        // Convert 10-char hex to facility code and card number
        // This is a simplified version - real RFID encoding is more complex
        const decimal = parseInt(hex, 16);
        const facility = (decimal >> 16) & 0xFF;
        const cardNumber = decimal & 0xFFFF;

        return { facility, cardNumber };
    }

    facilityCardToHex(facility, cardNumber) {
        // Reverse of above
        const combined = (facility << 16) | cardNumber;
        return combined.toString(16).toUpperCase().padStart(10, '0');
    }
}
```

### 5. RFID Animations

**File**: `/js/minigames/rfid/rfid-animations.js`

```javascript
export class RFIDAnimations {
    constructor(minigame) {
        this.minigame = minigame;
        this.activeAnimations = [];
    }

    animateReading(progressCallback) {
        let progress = 0;
        const interval = setInterval(() => {
            progress += 2;
            progressCallback(progress);

            if (progress >= 100) {
                clearInterval(interval);
            }
        }, 50);  // 50ms intervals = 2.5 second total

        this.activeAnimations.push(interval);
    }

    showTapSuccess() {
        const screen = document.getElementById('flipper-screen');
        screen.innerHTML = `
            <div class="flipper-result success">
                <div class="result-icon">✓</div>
                <div class="result-text">Access Granted</div>
                <div class="result-detail">Card Accepted</div>
            </div>
        `;
    }

    showTapFailure() {
        const screen = document.getElementById('flipper-screen');
        screen.innerHTML = `
            <div class="flipper-result failure">
                <div class="result-icon">✗</div>
                <div class="result-text">Access Denied</div>
                <div class="result-detail">Invalid Card</div>
            </div>
        `;
    }

    showEmulationSuccess() {
        // Add success visual feedback to existing emulation screen
        const statusDiv = document.querySelector('.emulation-status');
        if (statusDiv) {
            statusDiv.classList.add('success');
        }
    }

    showEmulationFailure() {
        const statusDiv = document.querySelector('.emulation-status');
        if (statusDiv) {
            statusDiv.classList.add('failure');
        }
    }

    cleanup() {
        this.activeAnimations.forEach(anim => clearInterval(anim));
        this.activeAnimations = [];
    }
}
```

### 6. Ink Tag Handler

**File**: `/js/minigames/helpers/chat-helpers.js` (Add new case)

```javascript
case 'clone_keycard':
    if (param) {
        const [cardName, cardHex] = param.split('|').map(s => s.trim());

        // Check if player has RFID cloner
        const hasCloner = window.inventory.items.some(item =>
            item && item.scenarioData &&
            item.scenarioData.type === 'rfid_cloner'
        );

        if (!hasCloner) {
            result.message = '⚠️ You need an RFID cloner to clone cards';
            if (ui) ui.showNotification(result.message, 'warning');
            break;
        }

        // Generate card data
        const cardData = {
            name: cardName,
            rfid_hex: cardHex,
            rfid_facility: parseInt(cardHex.substring(0, 2), 16),
            rfid_card_number: parseInt(cardHex.substring(2, 6), 16),
            rfid_protocol: 'EM4100',
            key_id: `cloned_${cardName.toLowerCase().replace(/\s+/g, '_')}`
        };

        // Start RFID minigame in clone mode
        if (window.startRFIDMinigame) {
            window.startRFIDMinigame(null, null, {
                mode: 'clone',
                cardToClone: cardData,
                onComplete: (success, cloneResult) => {
                    if (success) {
                        result.success = true;
                        result.message = `📡 Cloned: ${cardName}`;
                        if (ui) ui.showNotification(result.message, 'success');
                    }
                }
            });
        }

        result.success = true;
        result.message = `📡 Starting card clone: ${cardName}`;
        if (ui) ui.showNotification(result.message, 'info');
    }
    break;
```

### 7. Inventory Click Handler

**File**: `/js/systems/inventory.js` (Modify `handleObjectInteraction`)

Add before existing switch statement:

```javascript
// Special handling for keycard + RFID cloner combo
if (item.scenarioData?.type === 'keycard') {
    const hasCloner = window.inventory.items.some(invItem =>
        invItem && invItem.scenarioData &&
        invItem.scenarioData.type === 'rfid_cloner'
    );

    if (hasCloner) {
        // Start RFID minigame in clone mode
        if (window.startRFIDMinigame) {
            window.startRFIDMinigame(null, null, {
                mode: 'clone',
                cardToClone: item.scenarioData,
                onComplete: (success) => {
                    if (success) {
                        window.gameAlert('Keycard cloned successfully', 'success');
                    }
                }
            });
            return;  // Don't proceed with normal handling
        }
    } else {
        window.gameAlert('You need an RFID cloner to clone this card', 'info');
        return;
    }
}
```

## Data Flow Diagrams

### Unlock Mode Flow

```
Player clicks RFID-locked door
    ↓
handleUnlock() detects lockType: 'rfid'
    ↓
Check inventory for:
  - keycards (matching key_id)
  - rfid_cloner (with saved_cards)
    ↓
Start RFIDMinigame(mode: 'unlock')
    ↓
┌─────────────────────────────────────┐
│  Show Flipper Zero interface       │
│  ┌──────────────────────────────┐  │
│  │ RFID                         │  │
│  │ ▶ Read    (if has cards)     │  │
│  │ ▶ Saved   (if has cloner)    │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
    ↓
Player chooses action:
    ├─ Read → Show available keycards
    │         Player taps card
    │         Check if key_id matches
    │         ✓ Success: Door unlocks
    │         ✗ Failure: Access Denied
    │
    └─ Saved → Show saved cards list
              Player selects card to emulate
              Show "Emulating [EM4100] CardName"
              Check if key_id matches
              ✓ Success: Door unlocks
              ✗ Failure: Access Denied
```

### Clone Mode Flow (from Ink)

```
Ink dialogue option:
  [Secretly clone keycard]
    ↓
Ink tag: # clone_keycard:Security Officer|4AC5EF44DC
    ↓
processGameActionTags() in chat-helpers.js
    ↓
Check for rfid_cloner in inventory
    ↓
Start RFIDMinigame(mode: 'clone', cardToClone: data)
    ↓
┌────────────────────────────────────┐
│  Flipper Zero Reading Screen      │
│  ┌────────────────────────────┐   │
│  │ RFID > Read                │   │
│  │ Reading 1/2                │   │
│  │ > ASK PSK                  │   │
│  │ Don't move card...         │   │
│  │ [=========>      ] 75%     │   │
│  └────────────────────────────┘   │
└────────────────────────────────────┘
    ↓
Reading completes (2.5 seconds)
    ↓
┌────────────────────────────────────┐
│  Card Data Screen                  │
│  ┌────────────────────────────┐   │
│  │ EM-Micro EM4100            │   │
│  │ Hex: 4A C5 EF 44 DC        │   │
│  │ FC: 239 Card: 17628        │   │
│  │ CL: 64                     │   │
│  │ DEZ 8: 15680732            │   │
│  │                            │   │
│  │ [Save]     [Cancel]        │   │
│  └────────────────────────────┘   │
└────────────────────────────────────┘
    ↓
Player clicks Save
    ↓
Save to rfid_cloner.saved_cards[]
    ↓
Show success message
    ↓
Complete minigame
```

### Clone Mode Flow (from Inventory)

```
Player has keycard in inventory
Player has rfid_cloner in inventory
    ↓
Player clicks keycard
    ↓
inventory.js detects:
  - item.type === 'keycard'
  - inventory has 'rfid_cloner'
    ↓
Start RFIDMinigame(mode: 'clone', cardToClone: keycard.scenarioData)
    ↓
[Same flow as Clone Mode from Ink]
```

## CSS Styling Strategy

### Flipper Zero Aesthetic

```css
/* Main container */
.flipper-zero-frame {
    width: 400px;
    height: 500px;
    background: #FF8200;  /* Flipper orange */
    border-radius: 20px;
    padding: 20px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}

/* Screen area */
.flipper-screen {
    width: 100%;
    height: 380px;
    background: #000;
    border: 2px solid #333;
    border-radius: 8px;
    padding: 10px;
    font-family: 'Courier New', monospace;
    color: #FF8200;
    font-size: 14px;
    overflow-y: auto;
}

/* Breadcrumb navigation */
.flipper-breadcrumb {
    color: #666;
    font-size: 12px;
    margin-bottom: 10px;
    border-bottom: 1px solid #333;
    padding-bottom: 5px;
}

/* Menu items */
.flipper-menu-item {
    padding: 8px;
    margin: 4px 0;
    cursor: pointer;
    transition: background 0.2s;
}

.flipper-menu-item:hover {
    background: #1a1a1a;
}

/* Emulation status */
.emulation-status {
    text-align: center;
    padding: 20px;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
}

/* Success/failure states */
.flipper-result.success {
    color: #00FF00;
}

.flipper-result.failure {
    color: #FF0000;
}
```

## Integration Points Summary

| System | File | Modification Type | Description |
|--------|------|-------------------|-------------|
| Unlock System | `unlock-system.js` | Add case | Add 'rfid' lock type handler |
| Minigame Registry | `index.js` | Register | Register RFIDMinigame |
| Starter Functions | `minigame-starters.js` | Add function | `startRFIDMinigame()` |
| Chat Tags | `chat-helpers.js` | Add case | Handle `clone_keycard` tag |
| Inventory | `inventory.js` | Add handler | Keycard click triggers clone |
| Styles | `rfid-minigame.css` | New file | Flipper Zero styling |
| Assets | `assets/objects/` | New files | Keycard and cloner sprites |

## State Management

### Global State Extensions

```javascript
// RFID cloner item in inventory
window.inventory.items[] contains:
{
    scenarioData: {
        type: 'rfid_cloner',
        name: 'RFID Cloner',
        saved_cards: [
            {
                name: 'Security Officer',
                hex: '4AC5EF44DC',
                facility: 239,
                card_number: 17628,
                protocol: 'EM4100',
                key_id: 'cloned_security_officer',
                cloned_at: '2024-01-15T10:30:00Z'
            }
        ]
    }
}
```

## Error Handling

### Scenarios and Error Messages

| Scenario | Error Handling | User Message |
|----------|----------------|--------------|
| No keycard or cloner | Block unlock attempt | "Requires RFID keycard" |
| Wrong keycard | Show failure animation | "Access Denied - Invalid Card" |
| No cloner for clone | Prevent clone initiation | "You need an RFID cloner to clone cards" |
| Duplicate card save | Skip save, notify | "Card already saved" |
| Minigame not registered | Auto-register on demand | (Silent recovery) |

## Performance Considerations

- **Animations**: Use CSS transforms, not layout changes
- **Card List**: Limit to 50 saved cards maximum
- **Reading Animation**: 2.5 second duration (not blocking)
- **Memory**: Clean up intervals/timeouts in cleanup()
- **DOM**: Reuse screen container, replace innerHTML

## Accessibility

- **Keyboard Navigation**: Arrow keys in menus, Enter to select
- **Screen Reader**: ARIA labels on buttons
- **High Contrast**: Ensure orange/black contrast ratio
- **Font Size**: Minimum 14px, scalable

## Security (In-Game)

- **Card Validation**: Server-side key_id matching
- **Clone Limit**: Optional max saved cards per cloner
- **Audit Log**: Track card clones with timestamps
- **Detection**: Optional NPC detection of cloning attempts
