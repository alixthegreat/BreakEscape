# Quick Start: Parent Instance Pattern & Auto-Integration

## TL;DR - One Command Does Everything

Extract a module, update main file, and integrate in one command:

```bash
python3 scripts/extract_lockpicking_methods.py \
    --methods "methodName1,methodName2,methodName3" \
    --output-file "path/to/new-module.js" \
    --class-name "ModuleClassName" \
    --replace-this \
    --auto-integrate \
    --update-main-file "js/minigames/lockpicking/lockpicking-game-phaser.js" \
    --module-instance-name "moduleInstanceName"
```

**Result:** ✅ New module created, ✅ Main file updated, ✅ Ready to test

---

## Phase 1: Lock Configuration (Your First Extraction)

### 1. Run the Extraction

```bash
cd /home/cliffe/Files/Projects/Code/BreakEscape/BreakEscape

python3 scripts/extract_lockpicking_methods.py \
    --methods "saveLockConfiguration,loadLockConfiguration,clearLockConfiguration,getLockPinConfiguration,clearAllLockConfigurations,resetPinsToOriginalPositions" \
    --output-file "js/minigames/lockpicking/lock-configuration.js" \
    --class-name "LockConfiguration" \
    --replace-this \
    --auto-integrate \
    --update-main-file "js/minigames/lockpicking/lockpicking-game-phaser.js" \
    --module-instance-name "lockConfig" \
    --show-dependencies
```

### 2. Verify Output

```bash
# Check that new module was created
ls -la js/minigames/lockpicking/lock-configuration.js

# Check that main file was updated
grep "LockConfiguration" js/minigames/lockpicking/lockpicking-game-phaser.js

# Verify auto-integration added initialization
grep "new LockConfiguration" js/minigames/lockpicking/lockpicking-game-phaser.js
```

### 3. Test

```bash
# Start server
python3 -m http.server 8000

# Open browser: http://localhost:8000/scenario_select.html
# Run any scenario with lockpicking minigame
# Verify: No console errors, game works normally
```

### 4. Verify Method Calls Were Updated

```bash
# Check that old method calls were replaced
grep -n "this.saveLockConfiguration" js/minigames/lockpicking/lockpicking-game-phaser.js

# Should show 0 results - all calls updated to this.lockConfig.saveLockConfiguration()
```

### 5. Commit

```bash
git add js/minigames/lockpicking/lock-configuration.js
git add js/minigames/lockpicking/lockpicking-game-phaser.js
git commit -m "Extract: Lock Configuration module with parent instance pattern"
```

---

## Understanding the Parent Instance Pattern

### What Happened

**Before extraction:**
```javascript
// In lockpicking-game-phaser.js
saveLockConfiguration() {
    const pinHeights = this.pins.map(p => p.originalHeight);
    window.lockConfigurations[this.lockId] = pinHeights;
}
```

**After extraction:**
```javascript
// In lock-configuration.js
export class LockConfiguration {
    constructor(parent) {
        this.parent = parent;  // ← Stores reference to main instance
    }
    
    saveLockConfiguration() {
        // ✅ All 'this' automatically replaced with 'parent'
        const pinHeights = parent.pins.map(p => p.originalHeight);
        window.lockConfigurations[parent.lockId] = pinHeights;
    }
}

// In lockpicking-game-phaser.js
this.lockConfig = new LockConfiguration(this);  // ← Pass main instance
```

### How to Access Parent State

In your extracted module methods, use `parent` instead of `this`:

```javascript
// Access parent properties:
parent.pins              // Array of pin objects
parent.scene            // Phaser scene instance
parent.lockState        // Lock state object
parent.lockId           // Current lock ID
parent.difficulty       // Game difficulty
parent.keyData          // Key data (if key mode)

// Call parent methods (if needed):
parent.checkAllPinsCorrect()
parent.completeMinigame()
```

---

## Phase 2: Lock Graphics (After Success)

Once Phase 1 works, extract graphics module:

```bash
python3 scripts/extract_lockpicking_methods.py \
    --methods "createLockBackground,createTensionWrench,createHookPick" \
    --output-file "js/minigames/lockpicking/lock-graphics.js" \
    --class-name "LockGraphics" \
    --replace-this \
    --auto-integrate \
    --update-main-file "js/minigames/lockpicking/lockpicking-game-phaser.js" \
    --module-instance-name "graphics" \
    --show-dependencies
```

**Same workflow:**
1. Run command
2. Test game
3. Verify console has no errors
4. Commit

---

## Phase 3: Key Data Generator

```bash
python3 scripts/extract_lockpicking_methods.py \
    --methods "generateKeyData,calculateKeyRidges,validateKeyShape" \
    --output-file "js/minigames/lockpicking/key-data-generator.js" \
    --class-name "KeyDataGenerator" \
    --replace-this \
    --auto-integrate \
    --update-main-file "js/minigames/lockpicking/lockpicking-game-phaser.js" \
    --module-instance-name "keyGenerator" \
    --show-dependencies
```

---

## All 11 Phase Commands

Copy and run these in sequence:

### Phase 1
```bash
python3 scripts/extract_lockpicking_methods.py --methods "saveLockConfiguration,loadLockConfiguration,clearLockConfiguration,getLockPinConfiguration,clearAllLockConfigurations,resetPinsToOriginalPositions" --output-file "js/minigames/lockpicking/lock-configuration.js" --class-name "LockConfiguration" --replace-this --auto-integrate --update-main-file "js/minigames/lockpicking/lockpicking-game-phaser.js" --module-instance-name "lockConfig" --show-dependencies
```

### Phase 2
```bash
python3 scripts/extract_lockpicking_methods.py --methods "createLockBackground,createTensionWrench,createHookPick" --output-file "js/minigames/lockpicking/lock-graphics.js" --class-name "LockGraphics" --replace-this --auto-integrate --update-main-file "js/minigames/lockpicking/lockpicking-game-phaser.js" --module-instance-name "graphics" --show-dependencies
```

### Phase 3
```bash
python3 scripts/extract_lockpicking_methods.py --methods "generateKeyData,calculateKeyRidges,validateKeyShape,getKeyProfile" --output-file "js/minigames/lockpicking/key-data-generator.js" --class-name "KeyDataGenerator" --replace-this --auto-integrate --update-main-file "js/minigames/lockpicking/lockpicking-game-phaser.js" --module-instance-name "keyGenerator" --show-dependencies
```

### Phase 4 (Large - Pin System)
```bash
python3 scripts/extract_lockpicking_methods.py --methods "createPins,setPinHeight,getPinState,updatePinPhysics,calculatePinBinding,detectPinSet,resetPinPosition" --output-file "js/minigames/lockpicking/pin-system.js" --class-name "PinSystem" --replace-this --auto-integrate --update-main-file "js/minigames/lockpicking/lockpicking-game-phaser.js" --module-instance-name "pins" --show-dependencies
```

### Phase 5 (Large - Key Rendering)
```bash
python3 scripts/extract_lockpicking_methods.py --methods "createKey,updateKeyVisuals,renderKeyTexture,drawKeyCuts,cacheKeyTexture" --output-file "js/minigames/lockpicking/key-rendering.js" --class-name "KeyRendering" --replace-this --auto-integrate --update-main-file "js/minigames/lockpicking/lockpicking-game-phaser.js" --module-instance-name "keyRenderer" --show-dependencies
```

### Phase 6
```bash
python3 scripts/extract_lockpicking_methods.py --methods "createKeySelectionUI,displayAvailableKeys,handleKeySelection,updateKeyDisplay" --output-file "js/minigames/lockpicking/key-selection-ui.js" --class-name "KeySelectionUI" --replace-this --auto-integrate --update-main-file "js/minigames/lockpicking/lockpicking-game-phaser.js" --module-instance-name "keyUI" --show-dependencies
```

### Phase 7
```bash
python3 scripts/extract_lockpicking_methods.py --methods "setupInputHandlers,handleMouseInput,handleTouchInput,handleKeyboardInput" --output-file "js/minigames/lockpicking/input-handlers.js" --class-name "InputHandlers" --replace-this --auto-integrate --update-main-file "js/minigames/lockpicking/lockpicking-game-phaser.js" --module-instance-name "input" --show-dependencies
```

### Phase 8
```bash
python3 scripts/extract_lockpicking_methods.py --methods "checkAllPinsCorrect,checkPinSet,determineLockSuccess,calculateDifficulty" --output-file "js/minigames/lockpicking/completion-handler.js" --class-name "CompletionHandler" --replace-this --auto-integrate --update-main-file "js/minigames/lockpicking/lockpicking-game-phaser.js" --module-instance-name "completion" --show-dependencies
```

### Phase 9
```bash
python3 scripts/extract_lockpicking_methods.py --methods "createUIElements,setupButtons,createLabels,initializeDisplay" --output-file "js/minigames/lockpicking/ui-elements.js" --class-name "UIElements" --replace-this --auto-integrate --update-main-file "js/minigames/lockpicking/lockpicking-game-phaser.js" --module-instance-name "ui" --show-dependencies
```

### Phase 10
```bash
python3 scripts/extract_lockpicking_methods.py --methods "switchToPickMode,switchToKeyMode,getModeState,validateModeSwitching" --output-file "js/minigames/lockpicking/mode-switching.js" --class-name "ModeSwitching" --replace-this --auto-integrate --update-main-file "js/minigames/lockpicking/lockpicking-game-phaser.js" --module-instance-name "modes" --show-dependencies
```

### Phase 11
```bash
python3 scripts/extract_lockpicking_methods.py --methods "lerp,distanceBetween,normalizeAngle,clampValue,calculateBindingOrder,sortPinsByBinding" --output-file "js/minigames/lockpicking/utilities.js" --class-name "Utilities" --replace-this --auto-integrate --update-main-file "js/minigames/lockpicking/lockpicking-game-phaser.js" --module-instance-name "utils" --show-dependencies
```

---

## Verification After Each Phase

```bash
# 1. Test in browser
python3 -m http.server 8000
# Open: http://localhost:8000/scenario_select.html
# Run game, check console for errors

# 2. Verify no old method calls remain
grep -r "this\.EXTRACTED_METHOD_NAME(" js/minigames/lockpicking/lockpicking-game-phaser.js
# Should return 0 results

# 3. Verify module is imported
grep "import.*from.*module-file.js" js/minigames/lockpicking/lockpicking-game-phaser.js
# Should show the import

# 4. Commit
git add .
git commit -m "Phase N: [Module Name] extraction"
```

---

## What the Parent Instance Pattern Gives You

✅ **Full state access** - `parent.pins`, `parent.scene`, `parent.lockState`

✅ **Clean syntax** - Methods look normal, no weird parameter passing

✅ **Easy debugging** - Stack traces show module origins

✅ **Safe refactoring** - No circular dependencies possible

✅ **Incremental migration** - Extract one phase at a time, test after each

✅ **Automatic integration** - Tool handles imports and method calls

---

## Troubleshooting

### "ReferenceError: parent is not defined"

**Cause:** Module wasn't initialized with `new Module(this)`

**Fix:** Check constructor initialization:
```javascript
// In constructor:
this.lockConfig = new LockConfiguration(this);  // ← Must pass 'this'
```

### "TypeError: Cannot read property 'X' of undefined"

**Cause:** Trying to access `parent.X` that doesn't exist

**Fix:** Verify property name and that it exists on parent instance:
```javascript
console.log(this);  // Log main instance to see available properties
parent.CORRECT_PROPERTY_NAME;
```

### Module methods not being called

**Cause:** Method calls weren't updated

**Fix:** Manually check and update:
```bash
# Find old calls
grep "this\.methodName(" js/minigames/lockpicking/lockpicking-game-phaser.js

# Manual replacement if needed
# OLD: this.methodName()
# NEW: this.moduleInstance.methodName()
```

### Git conflicts

**Cause:** Multiple phases extracted simultaneously

**Fix:** Extract sequentially, one at a time

---

## Next: Read These Documents

1. **PARENT_INSTANCE_PATTERN.md** - Full explanation of the pattern
2. **IMPLEMENTATION_DETAILS.md** - Complete workflow details
3. **QUICKSTART.md** - Additional quick references

## Start Your First Extraction Now!

Copy-paste Phase 1 command above and run it! 🚀
