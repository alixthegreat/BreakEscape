# RFID Protocols - Implementation Summary (Revised)

**Status**: Ready for Implementation
**Estimated Time**: 14 hours (down from 19 hours)
**Based On**: Critical review improvements applied

## Changes from Original Plan

✅ **Removed HID Prox** - Minimal gameplay value, saves 2h
✅ **Merged attack mode into clone mode** - Simpler UX, saves 1h
✅ **Removed firmware system** - Can add later if needed, saves 2h
✅ **Dual format support** - No migration needed, safer approach
✅ **Added error handling** - Firmware checks, UID acceptance rules
✅ **Added Ink variable documentation** - Clear requirements
✅ **Improved code organization** - Constants for timing, better structure

## Three-Protocol System

### EM4100 (Low Security)
- **Status**: Already implemented
- **Clone**: Instant, always works
- **Emulate**: Perfect emulation
- **Gameplay**: Entry-level cards, no challenge

### MIFARE Classic (Medium Security)
- **Status**: New implementation needed
- **Clone**: Requires authentication keys
- **Attacks**:
  - Dictionary (instant) - Try common keys
  - Darkside (30 sec) - Crack keys from scratch
  - Nested (10 sec) - Crack remaining keys
- **Gameplay**: Puzzle element, adds time pressure

### MIFARE DESFire (High Security)
- **Status**: New implementation needed
- **Clone**: Impossible - UID only
- **Emulate**: UID emulation works on low-security readers only
- **Gameplay**: Forces physical theft or social engineering

## Implementation Phases (Revised)

### Phase 1: Protocol Foundation (3h)

**File**: `js/minigames/rfid/rfid-protocols.js` (NEW)

```javascript
export const RFID_PROTOCOLS = {
  'EM4100': {
    name: 'EM-Micro EM4100',
    frequency: '125kHz',
    security: 'low',
    capabilities: {
      read: true,
      clone: true,
      emulate: true
    },
    hexLength: 10,
    color: '#FF6B6B',
    icon: '⚠️'
  },

  'MIFARE_Classic': {
    name: 'MIFARE Classic 1K',
    frequency: '13.56MHz',
    security: 'medium',
    capabilities: {
      read: 'with-keys',
      clone: 'with-keys',
      emulate: true
    },
    sectors: 16,
    hexLength: 8,
    color: '#4ECDC4',
    icon: '🔐'
  },

  'MIFARE_DESFire': {
    name: 'MIFARE DESFire EV2',
    frequency: '13.56MHz',
    security: 'high',
    capabilities: {
      read: false,
      clone: false,
      emulate: 'uid-only'
    },
    hexLength: 14,
    color: '#95E1D3',
    icon: '🔒'
  }
};

// Common MIFARE keys for dictionary attack
export const MIFARE_COMMON_KEYS = [
  'FFFFFFFFFFFF', // Factory default
  '000000000000',
  'A0A1A2A3A4A5',
  'D3F7D3F7D3F7',
  '123456789ABC',
  'AABBCCDDEEFF'
  // ... more
];

export function getProtocolInfo(protocolName) {
  return RFID_PROTOCOLS[protocolName] || RFID_PROTOCOLS['EM4100'];
}

export function protocolSupports(protocolName, operation) {
  const protocol = getProtocolInfo(protocolName);
  const capability = protocol.capabilities[operation];
  if (typeof capability === 'boolean') return capability;
  return capability; // 'with-keys', 'uid-only', etc.
}
```

**File**: `js/minigames/rfid/rfid-data.js` (MODIFY)

Add dual format support (no migration):

```javascript
import { getProtocolInfo } from './rfid-protocols.js';

export class RFIDDataManager {
  /**
   * Get hex ID from card (supports old and new formats)
   */
  getCardHex(cardData) {
    // New format
    if (cardData.rfid_data?.hex) {
      return cardData.rfid_data.hex;
    }

    // Old format (backward compat)
    if (cardData.rfid_hex) {
      return cardData.rfid_hex;
    }

    return null;
  }

  /**
   * Get UID from card
   */
  getCardUID(cardData) {
    return cardData.rfid_data?.uid || null;
  }

  /**
   * Detect protocol from card data
   */
  detectProtocol(cardData) {
    // Explicit protocol
    if (cardData.rfid_protocol) {
      return cardData.rfid_protocol;
    }

    // Auto-detect from UID length
    const uid = this.getCardUID(cardData);
    if (uid) {
      if (uid.length === 14) return 'MIFARE_DESFire';
      if (uid.length === 8) return 'MIFARE_Classic';
    }

    // Auto-detect from hex length
    const hex = this.getCardHex(cardData);
    if (hex && hex.length === 10) return 'EM4100';

    return 'EM4100'; // Default
  }

  /**
   * Get display data for card based on protocol
   */
  getCardDisplayData(cardData) {
    const protocol = this.detectProtocol(cardData);
    const protocolInfo = getProtocolInfo(protocol);

    const displayData = {
      protocol: protocol,
      protocolName: protocolInfo.name,
      frequency: protocolInfo.frequency,
      security: protocolInfo.security,
      color: protocolInfo.color,
      icon: protocolInfo.icon,
      fields: []
    };

    switch (protocol) {
      case 'EM4100':
        const hex = this.getCardHex(cardData);
        const facility = cardData.rfid_data?.facility || cardData.rfid_facility;
        const cardNumber = cardData.rfid_data?.cardNumber || cardData.rfid_card_number;

        displayData.fields = [
          { label: 'HEX', value: this.formatHex(hex) },
          { label: 'Facility', value: facility },
          { label: 'Card', value: cardNumber },
          { label: 'DEZ 8', value: this.toDEZ8(hex) }
        ];
        break;

      case 'MIFARE_Classic':
        const uid = this.getCardUID(cardData);
        const keysKnown = cardData.rfid_data?.sectors ?
          Object.keys(cardData.rfid_data.sectors).length : 0;

        displayData.fields = [
          { label: 'UID', value: this.formatHex(uid) },
          { label: 'Type', value: '1K (16 sectors)' },
          { label: 'Keys Known', value: `${keysKnown}/16` },
          { label: 'Readable', value: keysKnown === 16 ? 'Yes ✓' : 'Partial' },
          { label: 'Clonable', value: keysKnown > 0 ? 'Partial' : 'No' }
        ];
        break;

      case 'MIFARE_DESFire':
        const desUID = this.getCardUID(cardData);

        displayData.fields = [
          { label: 'UID', value: this.formatHex(desUID) },
          { label: 'Type', value: 'EV2' },
          { label: 'Encryption', value: '3DES/AES' },
          { label: 'Clonable', value: 'UID Only' }
        ];
        break;
    }

    return displayData;
  }

  // ... existing methods remain unchanged
}
```

---

### Phase 2: Protocol Detection & UI (3h)

**File**: `js/minigames/rfid/rfid-ui.js` (MODIFY)

Update card data screen to use protocol display:

```javascript
showCardDataScreen(cardData) {
  const screen = this.getScreen();
  screen.innerHTML = '';

  const displayData = this.dataManager.getCardDisplayData(cardData);

  // Breadcrumb
  const breadcrumb = document.createElement('div');
  breadcrumb.className = 'flipper-breadcrumb';
  breadcrumb.textContent = 'RFID > Read';
  screen.appendChild(breadcrumb);

  // Protocol header with icon and color
  const header = document.createElement('div');
  header.className = 'flipper-protocol-header';
  header.style.borderLeft = `4px solid ${displayData.color}`;
  header.innerHTML = `
    <div class="protocol-header-top">
      <span class="protocol-icon">${displayData.icon}</span>
      <span class="protocol-name">${displayData.protocolName}</span>
    </div>
    <div class="protocol-meta">
      <span>${displayData.frequency}</span>
      <span class="security-badge security-${displayData.security}">
        ${displayData.security.toUpperCase()}
      </span>
    </div>
  `;
  screen.appendChild(header);

  // Card data fields
  const dataDiv = document.createElement('div');
  dataDiv.className = 'flipper-card-data';
  displayData.fields.forEach(field => {
    const fieldDiv = document.createElement('div');
    fieldDiv.innerHTML = `<strong>${field.label}:</strong> ${field.value}`;
    dataDiv.appendChild(fieldDiv);
  });
  screen.appendChild(dataDiv);

  // Warning for DESFire UID-only
  if (displayData.protocol === 'MIFARE_DESFire') {
    const warning = document.createElement('div');
    warning.className = 'flipper-warning';
    warning.innerHTML = '⚠️ <strong>UID Only</strong> - May not work on secure readers';
    screen.appendChild(warning);
  }

  // Buttons
  const buttons = document.createElement('div');
  buttons.className = 'flipper-buttons';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'flipper-button';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => this.minigame.handleSaveCard(cardData));

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'flipper-button flipper-button-secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => this.minigame.complete(false));

  buttons.appendChild(saveBtn);
  buttons.appendChild(cancelBtn);
  screen.appendChild(buttons);
}

/**
 * Show protocol info with available actions
 */
showProtocolInfo(cardData) {
  const screen = this.getScreen();
  screen.innerHTML = '';

  const displayData = this.dataManager.getCardDisplayData(cardData);

  // Breadcrumb
  const breadcrumb = document.createElement('div');
  breadcrumb.className = 'flipper-breadcrumb';
  breadcrumb.textContent = 'RFID > Info';
  screen.appendChild(breadcrumb);

  // Same header as above
  // ... (code from showCardDataScreen)

  // Card data fields
  // ... (code from showCardDataScreen)

  // Actions based on protocol and card state
  const actions = document.createElement('div');
  actions.className = 'flipper-menu';
  actions.style.marginTop = '20px';

  const protocol = displayData.protocol;

  if (protocol === 'MIFARE_Classic') {
    const keysKnown = cardData.rfid_data?.sectors ?
      Object.keys(cardData.rfid_data.sectors).length : 0;

    const info = document.createElement('div');
    info.className = 'flipper-info';
    info.textContent = 'This card is encrypted. Authentication keys required.';
    screen.appendChild(info);

    if (keysKnown === 0) {
      // No keys - offer attacks
      const dictBtn = document.createElement('div');
      dictBtn.className = 'flipper-menu-item';
      dictBtn.textContent = '> Dictionary Attack (instant)';
      dictBtn.addEventListener('click', () =>
        this.minigame.startKeyAttack('dictionary', cardData));
      actions.appendChild(dictBtn);

      const darksideBtn = document.createElement('div');
      darksideBtn.className = 'flipper-menu-item';
      darksideBtn.textContent = '  Darkside Attack (30 sec)';
      darksideBtn.addEventListener('click', () =>
        this.minigame.startKeyAttack('darkside', cardData));
      actions.appendChild(darksideBtn);
    } else if (keysKnown < 16) {
      // Some keys - offer nested
      const nestedBtn = document.createElement('div');
      nestedBtn.className = 'flipper-menu-item';
      nestedBtn.textContent = `> Nested Attack (crack ${16 - keysKnown} sectors)`;
      nestedBtn.addEventListener('click', () =>
        this.minigame.startKeyAttack('nested', cardData));
      actions.appendChild(nestedBtn);

      const readBtn = document.createElement('div');
      readBtn.className = 'flipper-menu-item';
      readBtn.textContent = '  Read Partial Data';
      readBtn.addEventListener('click', () =>
        this.showCardDataScreen(cardData));
      actions.appendChild(readBtn);
    } else {
      // All keys - can clone
      const readBtn = document.createElement('div');
      readBtn.className = 'flipper-menu-item';
      readBtn.textContent = '> Read & Clone';
      readBtn.addEventListener('click', () =>
        this.showCardDataScreen(cardData));
      actions.appendChild(readBtn);
    }
  } else if (protocol === 'MIFARE_DESFire') {
    const info = document.createElement('div');
    info.className = 'flipper-info';
    info.textContent = 'High security - full clone impossible';
    screen.appendChild(info);

    const uidBtn = document.createElement('div');
    uidBtn.className = 'flipper-menu-item';
    uidBtn.textContent = '> Save UID Only';
    uidBtn.addEventListener('click', () =>
      this.showCardDataScreen(cardData));
    actions.appendChild(uidBtn);
  } else {
    // EM4100 - instant clone
    const readBtn = document.createElement('div');
    readBtn.className = 'flipper-menu-item';
    readBtn.textContent = '> Read & Clone';
    readBtn.addEventListener('click', () =>
      this.showReadingScreen());
    actions.appendChild(readBtn);
  }

  const cancelBtn = document.createElement('div');
  cancelBtn.className = 'flipper-button-back';
  cancelBtn.textContent = '← Cancel';
  cancelBtn.addEventListener('click', () => this.minigame.complete(false));
  actions.appendChild(cancelBtn);

  screen.appendChild(actions);
}
```

**File**: `css/rfid-minigame.css` (ADD)

```css
/* Protocol Header */
.flipper-protocol-header {
  background: rgba(0, 0, 0, 0.3);
  padding: 15px;
  border-radius: 8px;
  margin: 15px 0;
}

.protocol-header-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.protocol-icon {
  font-size: 20px;
}

.protocol-name {
  font-size: 16px;
  font-weight: bold;
  color: white;
}

.protocol-meta {
  font-size: 12px;
  color: #888;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.security-badge {
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: bold;
}

.security-low { background: rgba(255, 107, 107, 0.3); color: #FF6B6B; }
.security-medium { background: rgba(78, 205, 196, 0.3); color: #4ECDC4; }
.security-high { background: rgba(149, 225, 211, 0.3); color: #95E1D3; }

.flipper-warning {
  background: rgba(255, 165, 0, 0.2);
  border-left: 3px solid #FFA500;
  padding: 12px;
  margin: 15px 0;
  color: #FFA500;
  font-size: 13px;
  border-radius: 5px;
}
```

---

### Phase 3: MIFARE Attack System (5h)

**File**: `js/minigames/rfid/rfid-attacks.js` (NEW)

```javascript
import { MIFARE_COMMON_KEYS } from './rfid-protocols.js';

// Attack timing constants
const ATTACK_DURATIONS = {
  darkside: 30000,   // 30 seconds
  nested: 10000,     // 10 seconds
  dictionary: 0      // Instant
};

export class MIFAREAttackManager {
  constructor() {
    this.activeAttacks = new Map();
  }

  /**
   * Dictionary attack - try common keys (instant)
   */
  dictionaryAttack(uid, existingKeys = {}) {
    console.log('🔓 Dictionary attack on', uid);

    const foundKeys = { ...existingKeys };
    let newKeysFound = 0;

    for (let sector = 0; sector < 16; sector++) {
      if (foundKeys[sector]) continue;

      // Try common keys (10% success chance each)
      for (const commonKey of MIFARE_COMMON_KEYS) {
        if (Math.random() < 0.1) {
          foundKeys[sector] = { keyA: commonKey, keyB: commonKey };
          newKeysFound++;
          break;
        }
      }
    }

    return {
      success: newKeysFound > 0,
      foundKeys: foundKeys,
      newKeysFound: newKeysFound,
      message: newKeysFound > 0 ?
        `Found ${newKeysFound} sector(s) using common keys!` :
        'No common keys found - try Darkside attack'
    };
  }

  /**
   * Darkside attack - crack all keys (30 sec)
   */
  async startDarksideAttack(uid, progressCallback) {
    console.log('🔓 Darkside attack on', uid);

    return new Promise((resolve, reject) => {
      const attack = {
        type: 'darkside',
        uid: uid,
        foundKeys: {},
        startTime: Date.now()
      };

      this.activeAttacks.set(uid, attack);

      const duration = ATTACK_DURATIONS.darkside;
      const updateInterval = 500;
      let elapsed = 0;

      const interval = setInterval(() => {
        elapsed += updateInterval;
        const progress = Math.min(100, (elapsed / duration) * 100);
        const currentSector = Math.floor((progress / 100) * 16);

        // Add found keys progressively
        for (let i = 0; i < currentSector; i++) {
          if (!attack.foundKeys[i]) {
            attack.foundKeys[i] = {
              keyA: this.generateRandomKey(),
              keyB: this.generateRandomKey()
            };
          }
        }

        // Progress callback
        if (progressCallback) {
          progressCallback({
            progress: progress,
            currentSector: currentSector,
            foundKeys: attack.foundKeys
          });
        }

        // Complete
        if (progress >= 100) {
          clearInterval(interval);

          // Ensure all 16 sectors have keys
          for (let i = 0; i < 16; i++) {
            if (!attack.foundKeys[i]) {
              attack.foundKeys[i] = {
                keyA: this.generateRandomKey(),
                keyB: this.generateRandomKey()
              };
            }
          }

          this.activeAttacks.delete(uid);

          resolve({
            success: true,
            foundKeys: attack.foundKeys,
            message: 'All 16 sectors cracked!'
          });
        }
      }, updateInterval);

      // Store interval for cleanup
      attack.interval = interval;
    });
  }

  /**
   * Nested attack - crack remaining keys (10 sec)
   */
  async startNestedAttack(uid, knownKeys, progressCallback) {
    console.log('🔓 Nested attack on', uid);

    if (Object.keys(knownKeys).length === 0) {
      return Promise.reject(new Error('Need at least one known key for Nested attack'));
    }

    return new Promise((resolve) => {
      const attack = {
        type: 'nested',
        uid: uid,
        foundKeys: { ...knownKeys },
        startTime: Date.now()
      };

      this.activeAttacks.set(uid, attack);

      const duration = ATTACK_DURATIONS.nested;
      const updateInterval = 500;
      const sectorsToFind = 16 - Object.keys(knownKeys).length;

      let elapsed = 0;
      let sectorsFound = 0;

      const interval = setInterval(() => {
        elapsed += updateInterval;
        const progress = Math.min(100, (elapsed / duration) * 100);

        // Add found keys progressively
        const expectedFound = Math.floor((progress / 100) * sectorsToFind);

        while (sectorsFound < expectedFound) {
          // Find next empty sector
          for (let i = 0; i < 16; i++) {
            if (!attack.foundKeys[i]) {
              attack.foundKeys[i] = {
                keyA: this.generateRandomKey(),
                keyB: this.generateRandomKey()
              };
              sectorsFound++;
              break;
            }
          }
        }

        if (progressCallback) {
          progressCallback({
            progress: progress,
            foundKeys: attack.foundKeys,
            sectorsRemaining: sectorsToFind - sectorsFound
          });
        }

        if (progress >= 100) {
          clearInterval(interval);
          this.activeAttacks.delete(uid);

          resolve({
            success: true,
            foundKeys: attack.foundKeys,
            message: `Cracked ${sectorsToFind} remaining sectors!`
          });
        }
      }, updateInterval);

      attack.interval = interval;
    });
  }

  /**
   * Generate random MIFARE key (for simulation)
   */
  generateRandomKey() {
    return Array.from({ length: 12 }, () =>
      Math.floor(Math.random() * 16).toString(16).toUpperCase()
    ).join('');
  }

  /**
   * Cleanup all active attacks
   */
  cleanup() {
    this.activeAttacks.forEach(attack => {
      if (attack.interval) {
        clearInterval(attack.interval);
      }
    });
    this.activeAttacks.clear();
  }

  /**
   * Cancel specific attack
   */
  cancelAttack(uid) {
    const attack = this.activeAttacks.get(uid);
    if (attack && attack.interval) {
      clearInterval(attack.interval);
    }
    this.activeAttacks.delete(uid);
  }
}

// Global instance
window.mifareAttackManager = window.mifareAttackManager || new MIFAREAttackManager();

export default MIFAREAttackManager;
```

**File**: `js/minigames/rfid/rfid-minigame.js` (MODIFY)

Add attack integration to clone mode:

```javascript
import { MIFAREAttackManager } from './rfid-attacks.js';
import { getProtocolInfo } from './rfid-protocols.js';

export class RFIDMinigame extends MinigameScene {
  constructor(container, params) {
    super(container, params);

    // ... existing code

    // Attack manager
    this.attackManager = window.mifareAttackManager;
  }

  init() {
    super.init();

    // ... existing code

    // Create appropriate interface
    if (this.mode === 'unlock') {
      this.ui.createUnlockInterface();
    } else if (this.mode === 'clone') {
      // Check protocol and show appropriate screen
      const protocol = this.cardToClone?.rfid_protocol || 'EM4100';

      if (protocol === 'MIFARE_Classic') {
        // Check if keys are available
        const keysKnown = this.cardToClone.rfid_data?.sectors ?
          Object.keys(this.cardToClone.rfid_data.sectors).length : 0;

        if (keysKnown === 0 || keysKnown < 16) {
          // Need to crack keys - show protocol info with attack options
          this.ui.showProtocolInfo(this.cardToClone);
        } else {
          // Has all keys - proceed with reading
          this.ui.showReadingScreen();
        }
      } else {
        // EM4100 or DESFire - start reading immediately
        this.ui.showReadingScreen();
      }
    }
  }

  /**
   * Start MIFARE key attack
   */
  async startKeyAttack(attackType, cardData) {
    console.log(`🔓 Starting ${attackType} attack`);

    // Show attack screen
    this.ui.showKeyAttackScreen(attackType, cardData);

    let result;

    try {
      switch (attackType) {
        case 'dictionary':
          result = this.attackManager.dictionaryAttack(
            cardData.rfid_data.uid,
            cardData.rfid_data.sectors || {}
          );

          if (result.success) {
            this.ui.showSuccess(result.message);
            cardData.rfid_data.sectors = result.foundKeys;

            setTimeout(() => {
              // Check if all keys found
              const keysKnown = Object.keys(result.foundKeys).length;
              if (keysKnown === 16) {
                this.ui.showCardDataScreen(cardData);
              } else {
                this.ui.showProtocolInfo(cardData);
              }
            }, 2000);
          } else {
            this.ui.showError(result.message);
            setTimeout(() => this.ui.showProtocolInfo(cardData), 2000);
          }
          break;

        case 'darkside':
          result = await this.attackManager.startDarksideAttack(
            cardData.rfid_data.uid,
            (progress) => this.ui.updateAttackProgress(progress)
          );

          cardData.rfid_data.sectors = result.foundKeys;
          this.ui.showSuccess(result.message);

          setTimeout(() => {
            this.ui.showCardDataScreen(cardData);
          }, 2000);
          break;

        case 'nested':
          result = await this.attackManager.startNestedAttack(
            cardData.rfid_data.uid,
            cardData.rfid_data.sectors || {},
            (progress) => this.ui.updateAttackProgress(progress)
          );

          cardData.rfid_data.sectors = result.foundKeys;
          this.ui.showSuccess(result.message);

          setTimeout(() => {
            this.ui.showCardDataScreen(cardData);
          }, 2000);
          break;
      }
    } catch (error) {
      console.error('Attack failed:', error);
      this.ui.showError(error.message);
      setTimeout(() => this.ui.showProtocolInfo(cardData), 2000);
    }
  }

  cleanup() {
    // Cleanup attacks if any are running
    if (this.attackManager && this.cardToClone?.rfid_data?.uid) {
      this.attackManager.cancelAttack(this.cardToClone.rfid_data.uid);
    }

    // ... existing cleanup code
  }
}
```

**File**: `js/minigames/rfid/rfid-ui.js` (ADD)

```javascript
/**
 * Show key attack screen
 */
showKeyAttackScreen(attackType, cardData) {
  const screen = this.getScreen();
  screen.innerHTML = '';

  // Breadcrumb
  const breadcrumb = document.createElement('div');
  breadcrumb.className = 'flipper-breadcrumb';
  const attackName = attackType.charAt(0).toUpperCase() + attackType.slice(1);
  breadcrumb.textContent = `RFID > ${attackName} Attack`;
  screen.appendChild(breadcrumb);

  // Card info
  const cardInfo = document.createElement('div');
  cardInfo.className = 'flipper-card-name';
  cardInfo.textContent = cardData.name;
  screen.appendChild(cardInfo);

  const uid = document.createElement('div');
  uid.className = 'flipper-info-dim';
  uid.textContent = `UID: ${this.dataManager.formatHex(cardData.rfid_data.uid)}`;
  screen.appendChild(uid);

  // Progress container (will be populated by updateAttackProgress)
  const progressDiv = document.createElement('div');
  progressDiv.id = 'attack-progress-container';
  screen.appendChild(progressDiv);

  // Keys found container
  const keysDiv = document.createElement('div');
  keysDiv.id = 'attack-keys-found';
  keysDiv.className = 'attack-keys-list';
  screen.appendChild(keysDiv);

  // Status
  const status = document.createElement('div');
  status.id = 'attack-status';
  status.className = 'flipper-info';
  status.textContent = attackType === 'dictionary' ?
    'Trying common keys...' : 'Don\'t move card...';
  screen.appendChild(status);
}

/**
 * Update attack progress
 */
updateAttackProgress(progressData) {
  // Add progress bar if not present
  const progressDiv = document.getElementById('attack-progress-container');
  if (progressDiv && !progressDiv.querySelector('.rfid-progress-container')) {
    const container = document.createElement('div');
    container.className = 'rfid-progress-container';

    const bar = document.createElement('div');
    bar.className = 'rfid-progress-bar';
    bar.id = 'attack-progress-bar';

    container.appendChild(bar);
    progressDiv.appendChild(container);

    const label = document.createElement('div');
    label.className = 'flipper-info';
    label.id = 'attack-progress-label';
    progressDiv.appendChild(label);
  }

  // Update progress bar
  const bar = document.getElementById('attack-progress-bar');
  const label = document.getElementById('attack-progress-label');

  if (bar) {
    bar.style.width = `${progressData.progress}%`;

    // Color based on progress
    if (progressData.progress < 50) {
      bar.style.backgroundColor = '#FF8200';
    } else if (progressData.progress < 100) {
      bar.style.backgroundColor = '#FFA500';
    } else {
      bar.style.backgroundColor = '#00FF00';
    }
  }

  if (label) {
    if (progressData.currentSector !== undefined) {
      label.textContent = `Cracking Sector ${progressData.currentSector}/16...`;
    } else if (progressData.sectorsRemaining !== undefined) {
      label.textContent = `${progressData.sectorsRemaining} sectors remaining...`;
    }
  }

  // Update keys found list
  const keysDiv = document.getElementById('attack-keys-found');
  if (keysDiv && progressData.foundKeys) {
    keysDiv.innerHTML = '<div class="flipper-info-dim">Keys Found:</div>';

    Object.keys(progressData.foundKeys).sort((a, b) => a - b).forEach(sector => {
      const keyLine = document.createElement('div');
      keyLine.className = 'attack-key-item';
      const key = progressData.foundKeys[sector];
      keyLine.textContent = `Sector ${sector}: ${key.keyA} ✓`;
      keysDiv.appendChild(keyLine);
    });
  }
}
```

**File**: `css/rfid-minigame.css` (ADD)

```css
/* Attack UI */
.attack-keys-list {
  background: rgba(0, 0, 0, 0.3);
  padding: 10px;
  border-radius: 5px;
  margin: 10px 0;
  max-height: 150px;
  overflow-y: auto;
  font-size: 11px;
}

.attack-key-item {
  padding: 3px 0;
  color: #00FF00;
  font-family: monospace;
}

#attack-progress-label {
  margin-top: 10px;
  font-size: 12px;
  color: #FFA500;
}
```

---

### Phase 4: Ink Integration (2h)

**File**: `js/minigames/person-chat/person-chat-conversation.js` (MODIFY)

```javascript
import { getProtocolInfo } from '../rfid/rfid-protocols.js';

// In setupExternalFunctions(), after syncItemsToInk()
syncCardProtocolsToInk() {
  if (!this.inkEngine || !this.npc || !this.npc.itemsHeld) return;

  // Find keycards
  const keycards = this.npc.itemsHeld.filter(item => item.type === 'keycard');

  keycards.forEach((card, index) => {
    const protocol = card.rfid_protocol || 'EM4100';
    const protocolInfo = getProtocolInfo(protocol);
    const prefix = index === 0 ? 'card' : `card${index + 1}`;

    try {
      this.inkEngine.setVariable(`${prefix}_protocol`, protocol);
      this.inkEngine.setVariable(`${prefix}_name`, card.name || 'Card');
      this.inkEngine.setVariable(`${prefix}_security`, protocolInfo.security);
      this.inkEngine.setVariable(`${prefix}_clonable`,
        protocolInfo.capabilities.clone === true);

      // Set hex/UID
      if (card.rfid_data) {
        if (card.rfid_data.hex) {
          this.inkEngine.setVariable(`${prefix}_hex`, card.rfid_data.hex);
        }
        if (card.rfid_data.uid) {
          this.inkEngine.setVariable(`${prefix}_uid`, card.rfid_data.uid);
        }
      } else if (card.rfid_hex) {
        // Old format support
        this.inkEngine.setVariable(`${prefix}_hex`, card.rfid_hex);
      }

      console.log(`✅ Synced ${prefix} protocol: ${protocol}`);
    } catch (err) {
      console.warn(`⚠️ Could not sync card protocol:`, err.message);
    }
  });
}

// Call in setupExternalFunctions()
setupExternalFunctions() {
  // ... existing code

  this.syncItemsToInk();
  this.syncCardProtocolsToInk(); // ADD THIS
}
```

**Documentation**: Required Ink Variables

Create file: `scenarios/ink/README_RFID_VARIABLES.md`

```markdown
# RFID Protocol Variables for Ink

When NPCs hold keycards, these variables are automatically synced to Ink conversations.

## Required Variable Declarations

Add to your .ink file:

```ink
// Card protocol info (synced from NPC itemsHeld)
VAR card_protocol = ""      // "EM4100", "MIFARE_Classic", "MIFARE_DESFire"
VAR card_name = ""          // Card display name
VAR card_hex = ""           // For EM4100 cards
VAR card_uid = ""           // For MIFARE cards
VAR card_security = ""      // "low", "medium", "high"
VAR card_clonable = false   // true if instant clone possible
```

## Usage Examples

### EM4100 (instant clone):
```ink
{card_protocol == "EM4100":
  + [Scan the badge]
    # clone_keycard:{card_name}|{card_hex}
    You quickly scan their badge.
    -> cloned
}
```

### MIFARE Classic (needs attack):
```ink
{card_protocol == "MIFARE_Classic":
  + [Scan the badge]
    # save_uid_only:{card_name}|{card_uid}
    You can only save the UID. To fully clone this card, you'll need to crack the keys.
    -> uid_saved

  + [Ask to borrow it]
    Maybe you can crack the keys if you have it for a few seconds...
    -> borrow_card
}
```

### MIFARE DESFire (impossible):
```ink
{card_protocol == "MIFARE_DESFire":
  + [Try to scan the badge]
    # save_uid_only:{card_name}|{card_uid}
    High security card - you can only get the UID. Full cloning is impossible.
    -> uid_only
}
```
```

**File**: `js/minigames/helpers/chat-helpers.js` (MODIFY)

Add new tags:

```javascript
case 'save_uid_only':
  if (param) {
    const [cardName, uid] = param.split('|').map(s => s.trim());

    const hasCloner = window.inventory.items.some(item =>
      item && item.scenarioData &&
      item.scenarioData.type === 'rfid_cloner'
    );

    if (!hasCloner) {
      result.message = '⚠️ You need an RFID cloner';
      break;
    }

    window.pendingConversationReturn = {
      npcId: window.currentConversationNPCId,
      type: window.currentConversationMinigameType || 'person-chat'
    };

    if (window.startRFIDMinigame) {
      window.startRFIDMinigame(null, null, {
        mode: 'clone',
        cardToClone: {
          name: `${cardName} (UID Only)`,
          rfid_protocol: 'MIFARE_DESFire',
          rfid_data: {
            uid: uid
          },
          type: 'keycard',
          key_id: `uid_${uid.toLowerCase()}`,
          observations: '⚠️ UID only - may not work on all readers'
        }
      });
      result.success = true;
    }
  }
  break;
```

---

### Phase 5: Door Lock Integration (1h)

**File**: `js/systems/unlock-system.js` (MODIFY)

Add UID-only acceptance logic:

```javascript
case 'rfid':
  const requiredCardId = lockRequirements.requires;
  const acceptsUIDOnly = lockRequirements.acceptsUIDOnly || false; // NEW

  const keycards = window.inventory.items.filter(item =>
    item && item.scenarioData &&
    item.scenarioData.type === 'keycard'
  );

  const cloner = window.inventory.items.find(item =>
    item && item.scenarioData &&
    item.scenarioData.type === 'rfid_cloner'
  );

  if (keycards.length > 0 || cloner?.scenarioData?.saved_cards?.length > 0) {
    window.startRFIDMinigame(lockable, type, {
      mode: 'unlock',
      requiredCardId: requiredCardId,
      availableCards: keycards,
      hasCloner: !!cloner,
      acceptsUIDOnly: acceptsUIDOnly, // Pass to minigame
      onComplete: (success) => {
        if (success) {
          unlockTarget(lockable, type, lockable.layer);
        }
      }
    });
  } else {
    window.gameAlert('Requires RFID keycard', 'error', 'Access Denied', 4000);
  }
  break;
```

**File**: `js/minigames/rfid/rfid-minigame.js` (MODIFY)

Check UID-only acceptance in handleEmulate:

```javascript
handleEmulate(savedCard) {
  console.log('📡 Emulating card:', savedCard.name);

  const cardId = savedCard.key_id;
  const isCorrect = cardId === this.requiredCardId;

  // Check if this is UID-only emulation
  const isUIDOnly = savedCard.rfid_protocol === 'MIFARE_DESFire' &&
                    !savedCard.rfid_data?.masterKeyKnown;

  if (isUIDOnly && !this.params.acceptsUIDOnly) {
    // UID-only doesn't work on this secure reader
    this.animations.showEmulationFailure();
    this.ui.showError('Reader requires full authentication');

    setTimeout(() => {
      this.ui.showSavedCards();
    }, 2000);
    return;
  }

  // Normal emulation check
  if (isCorrect) {
    this.animations.showEmulationSuccess();
    this.ui.showSuccess('Access Granted');
    // ... rest of success code
  } else {
    this.animations.showEmulationFailure();
    this.ui.showError('Access Denied');
    // ... rest of failure code
  }
}
```

---

## Test Scenarios

### Scenario 1: EM4100 (Already Exists)
File: `scenarios/test-rfid.json`
- Current test scenario works as-is
- No changes needed

### Scenario 2: MIFARE Classic
File: `scenarios/test-rfid-mifare.json` (NEW)

```json
{
  "name": "RFID MIFARE Test",
  "startRoom": "test_lobby",
  "rooms": {
    "test_lobby": {
      "type": "room_reception",
      "npcs": [{
        "id": "guard",
        "npcType": "person",
        "position": { "x": 6, "y": 4 },
        "storyPath": "scenarios/ink/rfid-mifare-guard.json",
        "itemsHeld": [{
          "type": "keycard",
          "name": "Encrypted Badge",
          "rfid_protocol": "MIFARE_Classic",
          "rfid_data": {
            "uid": "AB12CD34"
          },
          "key_id": "encrypted_badge"
        }]
      }],
      "objects": [
        {
          "type": "rfid_cloner",
          "name": "Flipper Zero",
          "saved_cards": []
        }
      ],
      "doors": [{
        "locked": true,
        "lockType": "rfid",
        "requires": "encrypted_badge"
      }]
    }
  }
}
```

### Scenario 3: MIFARE DESFire
File: `scenarios/test-rfid-desfire.json` (NEW)

```json
{
  "name": "RFID DESFire Test",
  "startRoom": "test_lobby",
  "rooms": {
    "test_lobby": {
      "type": "room_reception",
      "objects": [
        {
          "type": "keycard",
          "name": "High Security Badge",
          "rfid_protocol": "MIFARE_DESFire",
          "rfid_data": {
            "uid": "04AB12CD3456E0"
          },
          "key_id": "high_security_badge"
        },
        {
          "type": "rfid_cloner",
          "name": "Flipper Zero"
        }
      ],
      "doors": [
        {
          "locked": true,
          "lockType": "rfid",
          "requires": "high_security_badge",
          "acceptsUIDOnly": false,
          "description": "Secure reader - requires full auth"
        },
        {
          "locked": true,
          "lockType": "rfid",
          "requires": "high_security_badge",
          "acceptsUIDOnly": true,
          "description": "Simple reader - accepts UID only"
        }
      ]
    }
  }
}
```

---

## Implementation Checklist

### Phase 1: Foundation (3h)
- [ ] Create `rfid-protocols.js` with three protocols
- [ ] Add protocol constants (timing, common keys)
- [ ] Update `rfid-data.js` with dual format support
- [ ] Add `detectProtocol()` method
- [ ] Add `getCardDisplayData()` method
- [ ] Test backward compatibility with existing cards

### Phase 2: UI (3h)
- [ ] Update `showCardDataScreen()` with protocol header
- [ ] Add `showProtocolInfo()` with conditional actions
- [ ] Add protocol header CSS (icons, colors, badges)
- [ ] Add warning styles for DESFire
- [ ] Test all three protocols display correctly

### Phase 3: Attacks (5h)
- [ ] Create `rfid-attacks.js` module
- [ ] Implement dictionary attack (instant)
- [ ] Implement Darkside attack (30 sec)
- [ ] Implement Nested attack (10 sec)
- [ ] Add attack UI screens to `rfid-ui.js`
- [ ] Add `updateAttackProgress()` method
- [ ] Integrate attacks into `rfid-minigame.js`
- [ ] Add attack cleanup in `cleanup()`
- [ ] Add attack CSS styles
- [ ] Test all three attack types

### Phase 4: Ink Integration (2h)
- [ ] Add `syncCardProtocolsToInk()` to person-chat
- [ ] Add `save_uid_only` tag to chat-helpers
- [ ] Create Ink variables documentation
- [ ] Create example Ink files for each protocol
- [ ] Test Ink variable syncing

### Phase 5: Door Integration (1h)
- [ ] Add `acceptsUIDOnly` to unlock-system
- [ ] Update `handleEmulate()` with UID check
- [ ] Test DESFire against secure/simple readers
- [ ] Create test scenarios

---

## Total Time: 14 hours

**Saved from Original**: 5 hours
- Removed HID Prox: -2h
- Merged attack mode: -1h
- Removed firmware system: -2h

**Quality Improvements**:
- Simpler code (no migration needed)
- Better error handling
- Clearer documentation
- More testable

**Ready for implementation** ✅
