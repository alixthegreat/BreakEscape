# Quick Answers to Your 3 Key Questions

## 1️⃣ Does the tool remove the redundant function from the main file?

**❌ NO** - The tool only **extracts** code, it doesn't **modify** the source file.

**What happens:**
- Tool reads: `lockpicking-game-phaser.js`
- Tool copies: The methods you specify
- Tool creates: A new file (e.g., `lock-configuration.js`)
- Tool leaves: Original file unchanged

**What you must do:**
- Manually delete the old methods from the main file
- Manually add the import statement
- Manually update the method calls

---

## 2️⃣ Does the new JS file get used instead?

**✅ YES** - But only **after you update the main class**.

**The sequence:**
```
1. Extract methods → lock-configuration.js created ✓
2. Old methods still in main file ← NOT USED YET
3. Delete old methods from main file ← Start using new file
4. Add import statement in main file ← New file is now imported
5. Update method calls to use new module ← NOW it's used!
```

**Example:**
```javascript
// BEFORE (all in main file):
this.saveLockConfiguration();

// AFTER (with new module):
this.lockConfig.saveLockConfiguration(this.lockId, this.pins);
```

---

## 3️⃣ Do we need edits to handle shared state & Phaser scene?

**✅ YES** - You must explicitly pass or provide access to shared state.

### The Problem
When methods are extracted, they lose access to `this`:
```javascript
// ❌ This doesn't work in extracted module:
this.pins        // ← undefined
this.scene       // ← undefined
this.lockId      // ← undefined
```

### The Solution: Two Strategies

#### Strategy A: Pass as Parameters (Stateless modules)
```javascript
// lock-configuration.js
export const LockConfiguration = {
    saveLockConfiguration(lockId, pins) {  // ← Parameters
        const pinHeights = pins.map(pin => pin.originalHeight);
        window.lockConfigurations[lockId] = pinHeights;
    }
};

// In main class:
this.lockConfig.saveLockConfiguration(this.lockId, this.pins);  // ← Pass what's needed
```

#### Strategy B: Pass Parent Instance (Complex modules)
```javascript
// pin-system.js
export class PinSystem {
    constructor(parentInstance) {
        this.parent = parentInstance;  // ← Keep reference
    }
    
    createPins() {
        const scene = this.parent.scene;    // ← Access via parent
        const pins = this.parent.pins;      // ← Access via parent
        // ... create pins ...
    }
}

// In main class:
this.pinSystem = new PinSystem(this);  // ← Pass main instance
this.pinSystem.createPins();           // ← Has full access
```

### How Phaser Scene Stays Available
```javascript
constructor() {
    this.scene = null;  // Will be set later
}

setupPhaserGame() {
    // Create Phaser game
    this.game = new Phaser.Game(config);
    this.scene = this.game.scene.getScene('LockpickingScene');  // ← Set here
    
    // Now pass scene to modules:
    this.lockGraphics = new LockGraphics(this.scene);
    this.pinSystem = new PinSystem(this);  // Passes everything
}
```

---

## 📖 Where to Learn More

**Complete details:** `IMPLEMENTATION_DETAILS.md`
- Full workflow example with before/after code
- All 3 strategies for handling shared state
- Implementation checklist
- Common mistakes to avoid
- Decision table for each phase

**Quick start:** `QUICKSTART.md`
- First extraction command
- Success criteria
- Common questions

**Implementation guide:** `EXTRACTION_GUIDE.md`
- Post-extraction workflow
- All 11 commands

---

## ⚡ Minimum You Must Know

### After Extraction (Tool creates new file)
```
✓ New file created with extracted methods
✗ Old methods still in main file
✗ New file not yet used
```

### Your Edits (Before testing)
```javascript
// 1. Import the new module
import { LockConfiguration } from './lock-configuration.js';

// 2. Initialize it (if needed)
this.lockConfig = LockConfiguration;  // Or: new PinSystem(this)

// 3. Delete old methods from main class

// 4. Update method calls
// OLD: this.saveLockConfiguration();
// NEW:
this.lockConfig.saveLockConfiguration(this.lockId, this.pins);

// 5. Test game still works
// 6. Commit
```

### After Testing ✓
```
✓ New file imported and used
✓ Game fully functional
✓ Ready for Phase 2
```

---

## Next Step

**Read:** `IMPLEMENTATION_DETAILS.md` (15 min)

Then start Phase 1 extraction! 🚀
