# Refactoring Workflow - Detailed Explanation

## ❓ Key Questions Answered

### 1. Does the tool remove methods from the main file?

**Short Answer:** ❌ **NO - The tool only EXTRACTS code, it does NOT modify the main file.**

The tool is intentionally **non-destructive**:
- It **reads** the source file
- It **copies** the methods
- It **creates** a new file
- It **never modifies** the original file

### 2. Do we need to manually remove the old methods?

**Short Answer:** ✅ **YES - You must manually remove them AFTER extraction.**

Here's the workflow:

```
STEP 1: Extract (Tool does this)
python3 extract_lockpicking_methods.py \
  --methods "method1,method2" \
  --output-file "lock-graphics.js"
  
Result: 
  ✓ Created: js/minigames/lockpicking/lock-graphics.js
  ✗ Original methods still in: lockpicking-game-phaser.js

STEP 2: Update main class (You do this manually)
In lockpicking-game-phaser.js:
  - DELETE the 3 extracted methods
  - ADD import statement

STEP 3: Update method calls (You do this manually)
In lockpicking-game-phaser.js:
  - Change: this.createLockBackground()
  - To: this.lockGraphics.createLockBackground()
```

---

## 🔄 Complete Refactoring Workflow

### Phase 1: Lock Configuration (Detailed Example)

#### BEFORE (Everything in main file)
```javascript
// lockpicking-game-phaser.js (4670 lines)

export class LockpickingMinigamePhaser extends MinigameScene {
    constructor(container, params) {
        // ... initialization code ...
    }
    
    saveLockConfiguration() {
        // 20 lines of code
    }
    
    loadLockConfiguration() {
        // 10 lines of code
    }
    
    clearLockConfiguration() {
        // 15 lines of code
    }
    
    // ... 46 other methods ...
}
```

#### STEP 1: Extract (Tool does this)
```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "saveLockConfiguration,loadLockConfiguration,clearLockConfiguration" \
  --output-file "js/minigames/lockpicking/lock-configuration.js" \
  --object-mode
```

Result: Creates new file with:
```javascript
// lock-configuration.js

export const LockConfiguration = {
    
    saveLockConfiguration() {
        // Exact copy of original method
    },
    
    loadLockConfiguration() {
        // Exact copy of original method
    },
    
    clearLockConfiguration() {
        // Exact copy of original method
    }
};
```

#### STEP 2: Remove methods from main file (You do this)
```javascript
// lockpicking-game-phaser.js - AFTER EDITING

import { LockConfiguration } from './lock-configuration.js';  // ← ADD THIS

export class LockpickingMinigamePhaser extends MinigameScene {
    constructor(container, params) {
        // ... initialization code ...
        this.lockConfig = LockConfiguration;  // ← ADD THIS
    }
    
    // ❌ DELETE saveLockConfiguration() method
    // ❌ DELETE loadLockConfiguration() method
    // ❌ DELETE clearLockConfiguration() method
    
    // ... remaining 47 methods ...
}
```

#### STEP 3: Update method calls (You do this)
```javascript
// In various places in lockpicking-game-phaser.js where these were called:

// OLD: this.saveLockConfiguration();
// NEW:
this.lockConfig.saveLockConfiguration();

// OLD: const config = this.loadLockConfiguration();
// NEW:
const config = this.lockConfig.loadLockConfiguration();

// OLD: this.clearLockConfiguration();
// NEW:
this.lockConfig.clearLockConfiguration();
```

#### STEP 4: Test
```bash
python3 -m http.server 8000
# Open http://localhost:8000/scenario_select.html
# Verify game still works
```

#### STEP 5: Commit
```bash
git add js/minigames/lockpicking/lock-configuration.js
git add js/minigames/lockpicking/lockpicking-game-phaser.js
git commit -m "refactor: extract lock configuration module"
```

---

## 🎯 Understanding State & Dependencies

### Current Architecture (Before Refactoring)

In the monolithic class, everything has direct access to `this`:

```javascript
export class LockpickingMinigamePhaser extends MinigameScene {
    
    constructor() {
        this.scene = null;           // ← Phaser scene
        this.pins = [];              // ← Pin array
        this.lockState = {...};      // ← Lock state
        this.keyData = null;         // ← Key data
    }
    
    createLockBackground() {
        // Direct access to: this.scene, this.cylinderGraphics
        this.cylinderGraphics = this.scene.add.graphics();
    }
    
    createPins() {
        // Direct access to: this.scene, this.pins, this.lockState
        this.pins = [];
        this.pins.push(pin);
    }
    
    saveLockConfiguration() {
        // Direct access to: this.pins, this.lockId
        const pinHeights = this.pins.map(pin => pin.originalHeight);
        window.lockConfigurations[this.lockId] = pinHeights;
    }
}
```

### How to Handle Shared State

There are **three strategies** for accessing shared state in extracted modules:

#### Strategy 1: Pass as Parameters (RECOMMENDED)
The extracted method **receives** what it needs:

```javascript
// lock-configuration.js
export const LockConfiguration = {
    
    saveLockConfiguration(pinArray, lockId) {
        // ← Receives the data it needs
        const pinHeights = pinArray.map(pin => pin.originalHeight);
        window.lockConfigurations[lockId] = pinHeights;
    }
};

// In main class:
init() {
    this.lockConfig.saveLockConfiguration(this.pins, this.lockId);
}
```

**Pros:** Clean, testable, explicit dependencies  
**Cons:** Need to update call sites  

#### Strategy 2: Pass Parent Context (SEMI-ISOLATED)
The extracted methods are **bound** to the parent:

```javascript
// lock-configuration.js
export function createLockConfigurationModule(parentInstance) {
    return {
        saveLockConfiguration() {
            // ← Accesses parent through closure
            const pinHeights = parentInstance.pins.map(pin => pin.originalHeight);
            window.lockConfigurations[parentInstance.lockId] = pinHeights;
        }
    };
}

// In main class constructor:
this.lockConfig = createLockConfigurationModule(this);

// Call:
this.lockConfig.saveLockConfiguration();
```

**Pros:** Call sites don't change much  
**Cons:** Creates tight coupling through closure  

#### Strategy 3: Direct Property Access (SIMPLE but NOT IDEAL)
The extracted object **accesses** parent properties directly:

```javascript
// lock-configuration.js
class LockConfiguration {
    constructor(parentInstance) {
        this.parent = parentInstance;
    }
    
    saveLockConfiguration() {
        // ← Direct access through parent reference
        const pinHeights = this.parent.pins.map(pin => pin.originalHeight);
        window.lockConfigurations[this.parent.lockId] = pinHeights;
    }
}

// In main class:
this.lockConfig = new LockConfiguration(this);
```

**Pros:** Works, keeps most code the same  
**Cons:** Still coupled, not truly modular  

---

## 📋 How Shared State Works Currently

### Properties That Get Shared

```javascript
export class LockpickingMinigamePhaser extends MinigameScene {
    
    // Game State
    this.scene = null;              // Phaser scene object ← NEEDED BY MANY MODULES
    this.pins = [];                 // Pin objects ← NEEDED BY MANY MODULES
    this.lockState = {};            // Lock state ← NEEDED BY CORE MODULES
    this.keyData = null;            // Key data ← NEEDED BY KEY MODULES
    
    // Configuration
    this.lockId = 'lock_1';         // ← NEEDED BY LOCK CONFIG
    this.difficulty = 'medium';     // ← NEEDED BY PIN SYSTEM
    this.keyMode = false;           // ← NEEDED BY KEY SYSTEM
    
    // UI/Graphics
    this.game = null;               // Phaser game ← NEEDED BY ALL GRAPHICS
    this.feedback = null;           // Feedback element ← NEEDED BY UI
    this.tensionWrench = null;      // Graphics object ← NEEDED BY GRAPHICS
    this.hookGroup = null;          // Graphics object ← NEEDED BY GRAPHICS
    this.keyGroup = null;           // Graphics object ← NEEDED BY KEY RENDERING
    
    // Sounds
    this.sounds = {};               // Sound effects ← NEEDED BY MULTIPLE MODULES
}
```

### Which Modules Need Which State

```
Lock Configuration
  ├─ Needs: this.lockId, this.pins, window.lockConfigurations, localStorage
  └─ Solution: Pass lockId & pins as parameters (pure function)

Lock Graphics
  ├─ Needs: this.scene (Phaser scene)
  └─ Solution: Pass scene as parameter

Pin System
  ├─ Needs: this.scene, this.pins[], this.lockState, this.difficulty
  └─ Solution: Create PinSystem(scene, pins, lockState, difficulty)

Key Rendering
  ├─ Needs: this.scene, this.pins[], this.keyData, this.keyGroup
  └─ Solution: Create KeyRendering(scene, pins, keyData)

Input Handlers
  ├─ Needs: this.scene, this.pins[], hook position, mouse state
  └─ Solution: Create InputHandlers(scene, pins)
```

---

## ✅ Recommended Approach for This Project

### For Phases 1-3 (Pure functions, low dependency)

**Strategy: Pass Parameters** (Simplest)

```javascript
// lock-configuration.js - PURE FUNCTIONS
export const LockConfiguration = {
    saveLockConfiguration(lockId, pins) {
        const pinHeights = pins.map(pin => pin.originalHeight);
        window.lockConfigurations[lockId] = pinHeights;
    },
    
    loadLockConfiguration(lockId, expectedCount) {
        const config = window.lockConfigurations[lockId];
        if (config && config.length === expectedCount) {
            return config;
        }
        return null;
    }
};

// In main class:
init() {
    this.lockConfig = LockConfiguration;
}

// Usage:
this.lockConfig.saveLockConfiguration(this.lockId, this.pins);
```

### For Phases 4-5 (Complex state, many dependencies)

**Strategy: Create Helper Class with Parent Reference** (Balanced)

```javascript
// pin-system.js
export class PinSystem {
    constructor(parentInstance) {
        this.parent = parentInstance;  // Reference to main instance
    }
    
    createPins() {
        // ← Can access: this.parent.scene, this.parent.pins, etc.
        this.parent.pins = [];
        // Create pins using this.parent.scene
    }
    
    updatePinVisuals() {
        // ← Can access any property through this.parent
        this.parent.pins.forEach(pin => {
            // Update visuals
        });
    }
}

// In main class:
constructor(container, params) {
    super(container, params);
    this.pinSystem = new PinSystem(this);
}

// Usage:
this.pinSystem.createPins();
```

### For Phases 6-11 (UI, input, utilities)

**Strategy: Mix & Match Based on Need**

```javascript
// key-selection-ui.js - Needs main instance for Phaser scene
export class KeySelectionUI {
    constructor(parentInstance) {
        this.parent = parentInstance;
    }
    
    createKeySelectionUI(keys) {
        // Access: this.parent.scene, this.parent.gameContainer
    }
}

// utilities.js - Pure functions, no dependencies
export const Utilities = {
    shuffleArray(array) {
        // No parent needed
        return array.sort(() => Math.random() - 0.5);
    }
};
```

---

## 🔧 Implementation Checklist for Each Phase

### AFTER Extraction (Tool does this)
- ✅ New module file created with extracted methods

### BEFORE Testing (You do this)

- [ ] **Remove** old methods from main class
- [ ] **Add** import statement at top of main file
- [ ] **Initialize** module instance in constructor
- [ ] **Update** ALL method calls to use new module
- [ ] **Pass** dependencies (parameters or parent reference)
- [ ] **Test** game still works
- [ ] **Verify** no console errors
- [ ] **Commit** changes

### Example: Removing Methods from Main Class

```javascript
// lockpicking-game-phaser.js BEFORE
export class LockpickingMinigamePhaser extends MinigameScene {
    
    // ← These methods will be removed:
    saveLockConfiguration() { ... }
    loadLockConfiguration() { ... }
    clearLockConfiguration() { ... }
    getLockPinConfiguration() { ... }
    clearAllLockConfigurations() { ... }
    resetPinsToOriginalPositions() { ... }
    
    init() {
        // ... 50 lines of init code ...
        this.saveLockConfiguration();  // OLD CALL
    }
}

// lockpicking-game-phaser.js AFTER
import { LockConfiguration } from './lock-configuration.js';

export class LockpickingMinigamePhaser extends MinigameScene {
    
    constructor(container, params) {
        super(container, params);
        // ... other initialization ...
        this.lockConfig = LockConfiguration;  // ADD THIS
    }
    
    init() {
        // ... 50 lines of init code (unchanged) ...
        this.lockConfig.saveLockConfiguration(this.lockId, this.pins);  // NEW CALL
    }
    
    // ✓ Methods removed (no longer here)
}
```

---

## 🎯 How the Game Scene is Available

### Current Flow (Before Refactoring)
```
Phaser.Game created in setupPhaserGame()
    ↓
    this.scene = Phaser.scene
    ↓
    Create graphics using this.scene.add.graphics()
    ↓
    Store references in this.tensionWrench, this.pins[], etc.
```

### After Refactoring (How to Keep Scene Available)

```
Option A: Pass scene to extracted methods
─────────────────────────────────────────
init() {
    // BEFORE: this.createLockBackground();
    // AFTER:
    this.graphics.createLockBackground(this.scene);
}

Option B: Pass whole parent instance (Recommended for complex cases)
──────────────────────────────────────────────────────────
constructor() {
    this.lockGraphics = new LockGraphics(this);  // Pass parent
}

init() {
    this.lockGraphics.createLockBackground();  // Uses this.parent.scene
}

Option C: Store references in module instances
──────────────────────────────────────────────
export class LockGraphics {
    constructor(scene) {
        this.scene = scene;  // Store scene reference
    }
    
    createLockBackground() {
        this.cylinderGraphics = this.scene.add.graphics();
    }
}

constructor() {
    this.lockGraphics = new LockGraphics(this.scene);
}
```

---

## 📊 Decision Table: How to Handle Each Phase

| Phase | Module | Complexity | Shared State | Recommended Strategy |
|-------|--------|-----------|--------------|----------------------|
| 1 | Lock Config | Low | lockId, pins | Pass as parameters |
| 2 | Lock Graphics | Low | scene only | Pass scene as parameter |
| 3 | Key Data Gen | Low | keyData, pinCount | Pass as parameters |
| 4 | Pin System | **High** | scene, pins[], state | Pass parent instance |
| 5 | Key Rendering | **High** | scene, pins[], keyData | Pass parent instance |
| 6 | Key Selection | Medium | scene, keyData | Pass parent instance |
| 7 | Input Handlers | Medium | scene, pins[], mouse | Pass parent instance |
| 8 | Completion | Low | pins[], state | Pass as parameters |
| 9 | UI Elements | Low | gameContainer | Pass as parameter |
| 10 | Mode Switching | Low | keyMode, pins[] | Pass as parameters |
| 11 | Utilities | **Low** | None | Pure functions |

---

## ⚠️ Common Mistakes to Avoid

### ❌ Mistake 1: Forgetting to Update Method Calls
```javascript
// WRONG: Still calling method on this, but it doesn't exist
this.createLockBackground();  // ← Will crash: method not found

// RIGHT: Call on the module
this.lockGraphics.createLockBackground();
```

### ❌ Mistake 2: Not Handling Shared State
```javascript
// WRONG: Extracted method tries to access this.scene
export const LockGraphics = {
    createLockBackground() {
        this.scene.add.graphics();  // ← this.scene is undefined
    }
};

// RIGHT: Pass scene as parameter
export const LockGraphics = {
    createLockBackground(scene) {
        scene.add.graphics();  // ← scene is provided
    }
};

// Or: Use parent reference
export class LockGraphics {
    constructor(parent) {
        this.parent = parent;
    }
    
    createLockBackground() {
        this.parent.scene.add.graphics();  // ← parent.scene exists
    }
};
```

### ❌ Mistake 3: Circular Dependencies
```javascript
// WRONG: Module A imports Module B, Module B imports Module A
// lock-configuration.js imports PinSystem
// pin-system.js imports LockConfiguration
// ← Will cause circular dependency error

// RIGHT: Only pass what's needed
// Main class imports both
// Main class coordinates between them
```

---

## Summary

### Tool Behavior
✅ **EXTRACTS code** (copies exact methods)  
❌ **DOES NOT remove** from main file  
❌ **DOES NOT update** method calls  
❌ **DOES NOT handle** shared state

### Your Responsibility After Extraction

1. **Delete** old methods from main class
2. **Add** import statement for new module
3. **Initialize** module instance in constructor (if needed)
4. **Update** all method calls to use new module
5. **Handle** shared state (pass as parameters or parent reference)
6. **Test** game still works
7. **Commit** changes

### Recommended Implementation Pattern

```javascript
// lockpicking-game-phaser.js (Main orchestrator)
import { LockConfiguration } from './lock-configuration.js';
import { LockGraphics } from './lock-graphics.js';
import { PinSystem } from './pin-system.js';

export class LockpickingMinigamePhaser extends MinigameScene {
    
    constructor(container, params) {
        super(container, params);
        
        // Simple modules - pass what they need
        this.lockConfig = LockConfiguration;
        
        // Complex modules - pass parent instance for full access
        this.lockGraphics = new LockGraphics(this);
        this.pinSystem = new PinSystem(this);
    }
    
    init() {
        // Initialize UI and game
        this.uiElements.init();
        this.setupPhaserGame();
    }
    
    setupPhaserGame() {
        // Orchestrate module calls
        this.lockGraphics.createLockBackground();  // Uses this.parent.scene
        this.pinSystem.createPins();               // Uses this.parent.scene, this.parent.pins
    }
}
```

This keeps your main class as the **orchestrator** while extracted modules handle **specific concerns**.

---

**Key Takeaway:** The tool is just the extraction helper. You still need to integrate the extracted code by updating the main class and handling shared state appropriately.
