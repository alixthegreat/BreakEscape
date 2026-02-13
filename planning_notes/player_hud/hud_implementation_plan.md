# Player HUD Implementation Plan

## Overview
Create an RPG-style HUD at the bottom of the screen that consolidates player information and combat controls. This includes moving the existing inventory display, adding a player avatar/preferences button, implementing a three-mode interaction toggle system, integrating health hearts, and adding dynamic NPC hostility conversion.

---

## Implementation Status

### ✅ Completed Features
1. **Three-Mode Toggle System** (`public/break_escape/js/ui/hud.js`)
   - Interact mode (open hand, green border) - Normal interactions
   - Jab mode (fist, cyan border) - Fast punch (10 dmg, 500ms cooldown)
   - Cross mode (power fist, red border) - Strong punch (25 dmg, 1500ms cooldown)
   - Q key and button click to cycle modes
   - Animated transitions with scale/fade effects

2. **Smart Auto-Jab in Interact Mode** (`public/break_escape/js/systems/interactions.js`)
   - Automatically jabs swivel chairs when clicked
   - Automatically jabs hostile NPCs when clicked
   - Restores interact mode after action completes

3. **Mode-Aware Combat System** (`public/break_escape/js/systems/player-combat.js`)
   - Damage based on current mode
   - Cooldown based on current mode
   - Animation selection based on current mode

4. **Combat Configuration** (`public/break_escape/js/config/combat-config.js`)
   - Full mode definitions with properties
   - Frame references for hand_frames.png spritesheet

### ⏳ Pending Features
1. **Health Hearts Integration** (Priority 1)
   - Move hearts from floating position into HUD container
   - Position between avatar and inventory
   - Make always visible (not just when damaged)

2. **NPC Hostility Conversion** (Priority 2)
   - Non-hostile NPCs become hostile when attacked
   - Dynamic behavior switching
   - Interaction icon updates

3. **Player Avatar Button** (Priority 3)
   - Display player headshot in HUD
   - Click to open preferences modal

---

## Current State Analysis

### Existing Inventory System
- **Location**: `public/break_escape/js/ui/inventory.js`
- **Display**: Currently shows items in a simple UI overlay
- **Styling**: `public/break_escape/css/inventory.css`
- **Functionality**: 
  - Shows collected items
  - Displays item names on hover
  - Updates dynamically when items are collected

### Combat System
- **Location**: `public/break_escape/js/systems/player-combat.js`
- **Current Punch Types**:
  - **Lead Jab**: Fast, low damage (current default)
  - **Cross Punch**: Available but not selectable
- **Damage Config**: `public/break_escape/js/config/combat-config.js`

---

## HUD Design & Layout

### Visual Structure
```
┌─────────────────────────────────────────────────────────────────┐
│                      GAME SCREEN                                 │
│                                                                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
┌──────┬──────────────────────────────────────────────┬──────┬────┐
│ [📷] │ ❤️❤️❤️❤️❤️  [🔑] [💊] [📄] [🔧] ...          │ [👊] │    │
│ Char │  Health    Inventory Items                   │ Punch│    │
│      │  Hearts    (scrollable if > 8 items)         │ Type │    │
└──────┴──────────────────────────────────────────────┴──────┴────┘
```

**Note**: Health hearts (5 icons, 32x32px each) are now integrated into the HUD container, positioned between the player avatar and inventory items.

### Components Breakdown

#### 1. **Player Avatar Button** (Left)
- **Size**: 64x64px square
- **Content**: Player's headshot sprite
- **Border**: 2px solid border with hover effect
- **Interaction**: Click to open Player Preferences modal
- **Visual States**:
  - Default: Normal border
  - Hover: Highlighted border
  - Active: Pressed effect

#### 2. **Health Hearts** (Left-Center)
- **Size**: 32x32px per heart
- **Count**: 5 hearts (representing 100 HP, 20 HP per heart)
- **States**: Full, half, empty (opacity-based)
- **Spacing**: 8px gap between hearts
- **Visibility**: Always visible (not just when damaged)
- **Position**: Between player avatar and inventory
- **Implementation**: Refactor from `health-ui.js` to integrate into HUD

#### 3. **Inventory Display** (Center)
- **Layout**: Horizontal scrollable item slots
- **Slot Size**: 48x48px per item
- **Max Visible**: 6-8 items (reduced due to health hearts)
- **Spacing**: 4px gap between items
- **Border**: Same 2px pixel-art style

#### 4. **Punch Type Toggle** (Right)
- **Size**: 64x64px square
- **Display**: Icon showing current punch type
  - Interact mode (🖐️ open hand) - Auto-jabs chairs & hostile NPCs
  - Lead Jab icon (👊 fast fist)
  - Cross Punch icon (💥 power fist)
- **Toggle Behavior**: Click to cycle through three modes
- **Visual Indicator**: 
  - Border color: Green (interact), Cyan (jab), Red (cross)
  - Small label underneath (e.g., "INTERACT", "JAB" or "CROSS")
- **Keyboard Shortcut**: `Q` key to toggle quickly
- **Status**: ✅ Already implemented in `public/break_escape/js/ui/hud.js`

#### 5. **Container Styling**
- **Position**: Fixed at bottom of screen
- **Height**: 80px
- **Background**: Semi-transparent dark panel (#000000CC)
- **Border**: 2px solid border (top only)
- **Z-index**: 1000 (above game but below modals)
- **Layout**: Flexbox with `gap: 12px` between sections

---

## Implementation Plan

### Phase 1: HUD Infrastructure (Files to Create/Modify)

#### 1.1 Create HUD System Files
**New Files:**
- `public/break_escape/js/ui/hud.js` - Main HUD management system
- `public/break_escape/css/hud.css` - HUD styling

**Structure:**
```javascript
// hud.js
export class PlayerHUD {
  constructor(gameInstance) {
    this.game = gameInstance;
    this.container = null;
    this.avatarButton = null;
    this.inventoryContainer = null;
    this.punchToggle = null;
    this.currentPunchType = 'jab'; // 'jab' or 'cross'
    
    this.initialize();
  }
  
  initialize() {
    this.createContainer();
    this.createAvatarButton();
    this.createInventoryDisplay();
    this.createPunchToggle();
    this.attachEventListeners();
  }
  
  createContainer() { /* Main HUD container */ }
  createAvatarButton() { /* Player headshot button */ }
  createInventoryDisplay() { /* Move inventory here */ }
  createPunchToggle() { /* Punch type switcher */ }
  
  togglePunchType() {
    this.currentPunchType = this.currentPunchType === 'jab' ? 'cross' : 'jab';
    this.updatePunchToggleVisual();
    this.notifyPunchTypeChange();
  }
  
  getCurrentPunchType() {
    return this.currentPunchType;
  }
  
  updatePunchToggleVisual() { /* Update icon/label */ }
  notifyPunchTypeChange() { /* Dispatch event */ }
}
```

#### 1.2 Update Inventory System
**Modify:** `public/break_escape/js/ui/inventory.js`
- Refactor to work within HUD container instead of standalone
- Keep existing item display logic
- Update CSS references
- Add method to return inventory DOM elements for HUD integration

**Changes:**
```javascript
// Current approach - standalone overlay
export class Inventory {
  constructor() {
    this.createInventoryUI(); // Creates its own container
  }
}

// New approach - HUD-integrated
export class Inventory {
  constructor(hudContainer) {
    this.hudContainer = hudContainer; // Receive HUD container
  }
  
  createInventoryUI(parentElement) {
    // Build inventory inside provided parent
    // Return the inventory DOM element
  }
}
```

#### 1.3 Update Combat System
**Modify:** `public/break_escape/js/systems/player-combat.js`

**Add Punch Type Support:**
```javascript
export class PlayerCombat {
  constructor(scene) {
    this.scene = scene;
    this.lastPunchTime = 0;
    this.isPunching = false;
    this.currentPunchType = 'jab'; // NEW: Track punch type
  }
  
  setPunchType(type) {
    // NEW: Set punch type from HUD
    if (type === 'jab' || type === 'cross') {
      this.currentPunchType = type;
      console.log(`🥊 Punch type changed to: ${type}`);
    }
  }
  
  playPunchAnimation() {
    // MODIFY: Choose animation based on currentPunchType
    const direction = player.lastDirection || 'down';
    const compassDir = this.mapDirectionToCompass(direction);
    
    let animKey;
    if (this.currentPunchType === 'cross') {
      animKey = `cross-punch_${compassDir}`;
    } else {
      animKey = `lead-jab_${compassDir}`;
    }
    
    // Try to play selected animation
    if (this.scene.anims.exists(animKey)) {
      player.anims.play(animKey, true);
      // ... rest of logic
    }
  }
  
  checkForHits() {
    // MODIFY: Use different damage value based on punch type
    let punchDamage;
    if (this.currentPunchType === 'cross') {
      punchDamage = COMBAT_CONFIG.player.crossPunchDamage; // NEW config
    } else {
      punchDamage = COMBAT_CONFIG.player.jabDamage; // Renamed from punchDamage
    }
    
    // ... existing hit detection logic
  }
}
```

#### 1.4 Update Combat Configuration
**Modify:** `public/break_escape/js/config/combat-config.js`

**Add Punch Type Stats:**
```javascript
export const COMBAT_CONFIG = {
  player: {
    // Lead Jab (fast, low damage)
    jabDamage: 10,
    jabCooldown: 500,        // 0.5s between jabs
    jabAnimationDuration: 300, // Fast animation
    jabRange: 50,
    
    // Cross Punch (slow, high damage)
    crossPunchDamage: 25,    // 2.5x damage
    crossPunchCooldown: 1200, // 1.2s between crosses
    crossPunchAnimationDuration: 600, // Slower animation
    crossPunchRange: 50,      // Same range
    
    // Keep legacy fallbacks
    punchDamage: 10,          // Deprecated: use jabDamage
    punchCooldown: 500,
    punchAnimationDuration: 300,
    punchRange: 50,
  },
  // ... rest of config
};
```

---

### Phase 2: HUD Styling

#### 2.1 HUD CSS Structure
**File:** `public/break_escape/css/hud.css`

```css
/* HUD Container */
#player-hud {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 80px;
  background: rgba(0, 0, 0, 0.8);
  border-top: 2px solid #444;
  display: flex;
  align-items: center;
  padding: 8px;
  gap: 8px;
  z-index: 1000;
  font-family: 'Courier New', monospace;
}

/* Player Avatar Button */
#hud-avatar {
  width: 64px;
  height: 64px;
  border: 2px solid #666;
  background: #222;
  cursor: pointer;
  transition: border-color 0.2s;
  image-rendering: pixelated;
  position: relative;
  overflow: hidden;
}

#hud-avatar:hover {
  border-color: #0f0;
}

#hud-avatar:active {
  transform: translateY(1px);
}

#hud-avatar img {
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}

/* Inventory Container */
#hud-inventory {
  flex: 1;
  display: flex;
  gap: 4px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 4px;
  border: 2px solid #666;
  background: #111;
}

#hud-inventory::-webkit-scrollbar {
  height: 4px;
}

#hud-inventory::-webkit-scrollbar-thumb {
  background: #666;
}

.hud-inventory-slot {
  min-width: 48px;
  width: 48px;
  height: 48px;
  border: 2px solid #444;
  background: #222;
  position: relative;
  image-rendering: pixelated;
}

.hud-inventory-slot img {
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}

.hud-inventory-slot:hover {
  border-color: #888;
}

/* Punch Type Toggle */
#hud-punch-toggle {
  width: 64px;
  height: 64px;
  border: 2px solid #666;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #222;
}

#hud-punch-toggle:hover {
  border-color: #f80;
}

#hud-punch-toggle:active {
  transform: translateY(1px);
}

#hud-punch-toggle.punch-type-jab {
  border-color: #0cf; /* Blue for jab */
}

#hud-punch-toggle.punch-type-cross {
  border-color: #f00; /* Red for cross */
}

#hud-punch-icon {
  font-size: 32px;
  line-height: 1;
}

#hud-punch-label {
  font-size: 10px;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-top: 2px;
}

/* Tooltip for HUD elements */
.hud-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #000;
  color: #fff;
  padding: 4px 8px;
  border: 2px solid #666;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;
  margin-bottom: 4px;
}

.hud-tooltip.show {
  opacity: 1;
}

/* Keyboard shortcut hint */
.hud-shortcut {
  position: absolute;
  top: -12px;
  right: -12px;
  width: 20px;
  height: 20px;
  background: #000;
  border: 2px solid #666;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #888;
}
```

#### 2.2 Update Inventory CSS
**Modify:** `public/break_escape/css/inventory.css`
- Remove standalone positioning styles
- Keep item-specific styles
- Merge with HUD styles where appropriate

---

### Phase 3: Integration & Wiring

#### 3.1 Game Initialization
**Modify:** `public/break_escape/js/core/game.js`

```javascript
// In create() or init()
import { PlayerHUD } from './ui/hud.js';

// After player is created
this.playerHUD = new PlayerHUD(this);

// Listen for punch type changes
window.addEventListener('punchTypeChanged', (event) => {
  if (this.playerCombat) {
    this.playerCombat.setPunchType(event.detail.type);
  }
});
```

#### 3.2 Player Preferences Modal Integration
**Modify:** `app/views/break_escape/player_preferences/show.html.erb`
- Ensure modal can be triggered from JavaScript
- Add global function to open modal

**Add to layout:**
```javascript
// Global function to open preferences
window.openPlayerPreferences = function() {
  // Implementation depends on current modal system
  // Could be Turbo modal, Bootstrap modal, or custom
};
```

#### 3.3 Keyboard Shortcuts
**Add to:** `public/break_escape/js/core/player.js` or new `keyboard-shortcuts.js`

```javascript
// Listen for punch type toggle
document.addEventListener('keydown', (event) => {
  if (event.key === 'q' || event.key === 'Q') {
    if (window.playerHUD) {
      window.playerHUD.togglePunchType();
      event.preventDefault();
    }
  }
});
```

---

### Phase 4: Visual Assets

#### 4.1 Punch Type Icons
**Create/Source:**
- `public/break_escape/assets/ui/punch-jab-icon.png` (32x32)
- `public/break_escape/assets/ui/punch-cross-icon.png` (32x32)

**Alternative:** Use emoji/unicode initially:
- Jab: "👊" (U+1F44A)
- Cross: "💥" (U+1F4A5) or "🥊" (U+1F94A)

#### 4.2 Player Headshots
**Already available:**
- Headshots generated by sprite converter
- Location: `public/break_escape/assets/characters/*_headshot.png`
- Load based on current player preference

---

### Phase 5: Data Flow & State Management

#### 5.1 Punch Type State
```
┌──────────────┐
│ Player HUD   │ (UI Layer)
│ - UI Toggle  │
└──────┬───────┘
       │ togglePunchType()
       │ dispatches 'punchTypeChanged' event
       ▼
┌──────────────┐
│ Game Manager │ (Event Handler)
└──────┬───────┘
       │ setPunchType()
       ▼
┌──────────────┐
│ Combat System│ (Logic Layer)
│ - currentType│
│ - damage calc│
└──────────────┘
```

#### 5.2 Inventory Updates
```
┌──────────────┐
│ Game Events  │ (Item collected)
└──────┬───────┘
       │ addItem()
       ▼
┌──────────────┐
│ Inventory Sys│ (Data Layer)
│ - items[]    │
└──────┬───────┘
       │ updateDisplay()
       ▼
┌──────────────┐
│ HUD Display  │ (UI Layer)
│ - render new │
│   item slot  │
└──────────────┘
```

---

## Testing Checklist

### Functional Testing
- [ ] HUD displays correctly on page load
- [ ] Player headshot shows correct sprite
- [ ] Clicking headshot opens player preferences modal
- [ ] Inventory items display in HUD
- [ ] Inventory scrolls when > 8 items
- [ ] Punch toggle switches between jab/cross
- [ ] Punch type indicator updates visually
- [ ] Keyboard shortcut (Q) toggles punch type
- [ ] Lead jab deals correct damage (10)
- [ ] Cross punch deals correct damage (25)
- [ ] Lead jab cooldown is faster (500ms)
- [ ] Cross punch cooldown is slower (1200ms)
- [ ] Correct animation plays for each punch type
- [ ] Animation returns to idle after punch

### Visual Testing
- [ ] HUD maintains pixel-art aesthetic
- [ ] All borders are 2px solid
- [ ] No border-radius used
- [ ] Colors match game theme
- [ ] Icons are clear and recognizable
- [ ] Hover states work on all buttons
- [ ] Active states provide feedback

### Responsive Testing
- [ ] HUD scales appropriately on different resolutions
- [ ] Inventory scrolling works smoothly
- [ ] Layout doesn't break with 0 items
- [ ] Layout doesn't break with 20+ items

### Integration Testing
- [ ] HUD doesn't interfere with game controls
- [ ] HUD z-index correct (below modals, above game)
- [ ] Inventory state persists across room changes
- [ ] Punch type persists across room changes
- [ ] Modal opens without breaking HUD state

---

## File Change Summary

### New Files
1. `public/break_escape/js/ui/hud.js` - HUD system
2. `public/break_escape/css/hud.css` - HUD styling
3. `public/break_escape/assets/ui/punch-jab-icon.png` - (optional)
4. `public/break_escape/assets/ui/punch-cross-icon.png` - (optional)

### Modified Files
1. `public/break_escape/js/ui/inventory.js` - Refactor for HUD integration
2. `public/break_escape/css/inventory.css` - Update styles
3. `public/break_escape/js/systems/player-combat.js` - Add punch type support
4. `public/break_escape/js/config/combat-config.js` - Add punch type stats
5. `public/break_escape/js/core/game.js` - Initialize HUD
6. `app/views/break_escape/player_preferences/show.html.erb` - Add JS trigger
7. `index.html` or main layout - Include HUD CSS/JS

### Minimal Changes
- `public/break_escape/js/core/player.js` - Optional keyboard shortcuts

---

## Phased Rollout Strategy

### Iteration 1: Basic HUD (Minimal Viable Product)
- Create HUD container at bottom
- Move existing inventory into HUD
- No avatar, no punch toggle yet
- Goal: Verify HUD works without breaking existing functionality

### Iteration 2: Add Avatar Button
- Add player headshot to HUD
- Connect to existing player preferences modal
- Test modal interaction

### Iteration 3: Add Punch Toggle
- Add toggle button to HUD
- Implement state management
- Wire to combat system (damage only, no animation change)

### Iteration 4: Polish & Complete
- Add proper animations based on punch type
- Add keyboard shortcuts
- Add tooltips and visual feedback
- Optimize styling

---

## Potential Issues & Solutions

### Issue 1: Z-Index Conflicts
**Problem:** HUD might overlap with existing modals or UI elements
**Solution:** 
- Set HUD z-index: 1000
- Ensure modals are 2000+
- Game canvas should be < 1000

### Issue 2: Inventory State Management
**Problem:** Moving inventory to HUD might break existing item collection logic
**Solution:**
- Keep inventory data model separate from display
- Update `addItem()` to dispatch event that HUD listens to
- Maintain backwards compatibility

### Issue 3: Mobile/Touch Controls
**Problem:** HUD designed for desktop might not work on mobile
**Solution:**
- Defer mobile optimization to later
- Current focus is desktop experience
- HUD can be hidden on mobile initially

### Issue 4: Animation Timing with Different Punch Types
**Problem:** Cross punch is slower, might feel unresponsive
**Solution:**
- Ensure cooldown accounts for animation duration
- Add visual feedback (charge-up or wind-up indicator)
- Consider telegraph before punch lands

### Issue 5: Player Headshot Loading
**Problem:** Headshot needs to match current player sprite selection
**Solution:**
- Read from player preferences (already stored in session/model)
- Update headshot when sprite changes
- Cache headshots to avoid repeated loads

---

## Pending Implementation Requirements

### Priority 1: Health Hearts Integration
**Status**: Planned (not yet implemented)

**Current State**:
- Health hearts exist in `public/break_escape/js/ui/health-ui.js`
- Currently float 80px above bottom, centered horizontally
- Only visible when player is damaged
- Uses heart.png and heart-half.png sprites

**Required Changes**:
1. Move health hearts into HUD container (left-center position)
2. Make hearts always visible (not just when damaged)
3. Update CSS positioning from `#health-ui-container` to HUD flexbox child
4. Refactor `HealthUI` class to work within HUD system
5. Update z-index hierarchy (hearts should be part of HUD layer)

**Files to Modify**:
- `public/break_escape/js/ui/health-ui.js` - Integrate with HUD
- `public/break_escape/js/ui/hud.js` - Add health hearts section
- `public/break_escape/css/hud.css` - Update positioning styles

**Implementation Steps**:
```javascript
// In hud.js createHealthSection()
this.healthContainer = document.createElement('div');
this.healthContainer.className = 'hud-health-section';
// Move 5 heart sprites here from health-ui.js
```

---

### Priority 2: NPC Hostility Conversion
**Status**: Planned (not yet implemented)

**Requirement**:
When a non-hostile NPC is attacked by the player, they should become hostile and fight back.

**Current State**:
- NPC hostility is managed by `public/break_escape/js/systems/npc-hostile.js`
- Hostility is defined in scenario JSON (`isHostile: true/false`)
- Once set, hostility state doesn't change dynamically

**Required Changes**:
1. Detect when player punches a non-hostile NPC
2. Convert NPC to hostile state dynamically
3. Update NPC behavior to chase and attack player
4. Change interaction icon from "talk" to combat stance
5. Persist hostility state (NPC stays hostile after conversion)

**Files to Modify**:
- `public/break_escape/js/systems/player-combat.js` - Detect hits on non-hostile NPCs
- `public/break_escape/js/systems/npc-hostile.js` - Add `makeNPCHostile(npcId)` method
- `public/break_escape/js/systems/npc-behavior-manager.js` - Switch NPC to hostile behavior
- `public/break_escape/js/systems/interactions.js` - Update interaction indicators

**Implementation Logic**:
```javascript
// In player-combat.js checkForHits()
if (!window.npcHostileSystem.isNPCHostile(npcId)) {
  console.log(`💢 Player attacked non-hostile NPC ${npcId} - converting to hostile!`);
  window.npcHostileSystem.makeNPCHostile(npcId);
  
  // Trigger NPC reaction dialogue or animation
  if (window.npcManager) {
    const npc = window.npcManager.getNPC(npcId);
    npc.onBecameHostile?.(); // Optional callback
  }
}
```

**Gameplay Considerations**:
- Should NPCs forgive after time? (Not in MVP)
- Should certain NPCs be immune to conversion? (e.g., quest-critical)
- Should there be a warning before first hit?
- Should hostility persist across game saves?

**Testing Scenarios**:
1. Punch a friendly NPC → They become hostile and attack
2. Already-hostile NPC stays hostile when punched
3. Hostile NPC continues combat behavior consistently
4. Interaction icon changes from "talk" to combat stance
5. Multiple non-hostile NPCs can all be converted independently

---

## Future Enhancements (Post-MVP)

### Phase 3 Features
1. **Stamina System** - Punches consume stamina
2. **Hot Keys** - Number keys (1-9) to use inventory items
3. **Combo System** - Jab+Jab+Cross for bonus damage
4. **Punch Charging** - Hold button for charged cross punch
5. **NPC Forgiveness** - Hostile NPCs calm down after time

### Visual Improvements
1. **Animation Transitions** - Smooth fade between punch type icons
2. **Damage Numbers** - Float damage text above enemies
3. **Cooldown Indicators** - Visual timer for next punch
4. **Inventory Tooltips** - Hover to see item details

### QoL Features
1. **Item Quick-Use** - Right-click inventory item to use
2. **Inventory Sorting** - Auto-sort by type or name
3. **Settings Gear** - Quick access to game settings
4. **Mission Tracker** - Show current objective in HUD

---

## Success Metrics

### Usability
- Players can switch punch types without confusion
- Average time to discover punch toggle: < 30 seconds
- No UI-related bug reports

### Gameplay Impact
- Cross punch used strategically (not spam)
- Combat feels more engaging than before
- Players understand damage trade-off

### Technical
- No performance degradation
- HUD renders at stable 60fps
- Zero z-index conflicts
- Clean separation of concerns in code

---

## References & Resources

- Existing inventory system: `public/break_escape/js/ui/inventory.js`
- Current combat config: `public/break_escape/js/config/combat-config.js`
- Player animations: Atlas frames in `public/break_escape/assets/characters/*.json`
- CSS conventions: `.github/copilot-instructions.md` (2px borders, no border-radius)

---

## Timeline Estimate

- **Phase 1 (Infrastructure)**: 3-4 hours
- **Phase 2 (Styling)**: 1-2 hours  
- **Phase 3 (Integration)**: 2-3 hours
- **Phase 4 (Assets)**: 0.5 hours (use unicode initially)
- **Phase 5 (Testing)**: 1-2 hours

**Total**: 8-12 hours for full implementation

**MVP** (Iterations 1-2): 4-6 hours for basic functional HUD
