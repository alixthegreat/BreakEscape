# Lockpicking Minigame Refactoring - Extraction Tool Guide

## Overview

We've created `scripts/extract_lockpicking_methods.py` - a Python tool that extracts methods from the monolithic `lockpicking-game-phaser.js` file into separate, focused modules while preserving exact code.

### Tool Capabilities

✅ **Exact extraction**: Copies methods byte-for-byte without modifications  
✅ **Dependency detection**: Shows which methods depend on others  
✅ **Flexible output**: Generate classes or object modules  
✅ **Smart class naming**: Auto-generates class names from filenames  
✅ **Import management**: Accepts custom import statements  

## Installation

The tool is already created at:
```
scripts/extract_lockpicking_methods.py
```

Make it executable:
```bash
chmod +x scripts/extract_lockpicking_methods.py
```

## Basic Usage

### Extract Lock Configuration Methods

```bash
cd /home/cliffe/Files/Projects/Code/BreakEscape/BreakEscape

python3 scripts/extract_lockpicking_methods.py \
  --methods "saveLockConfiguration,loadLockConfiguration,clearLockConfiguration,getLockPinConfiguration" \
  --output-file "js/minigames/lockpicking/lock-configuration.js" \
  --object-mode \
  --show-dependencies
```

### Extract Lock Graphics Methods

```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "createLockBackground,createTensionWrench,createHookPick" \
  --output-file "js/minigames/lockpicking/lock-graphics.js" \
  --class-name "LockGraphics" \
  --show-dependencies
```

## Advanced Options

### `--methods` (required)
Comma-separated list of method names to extract.

Example: `"createLockBackground,createTensionWrench"`

### `--output-file` (required)
Path where the new module will be created. Creates parent directories if needed.

### `--class-name` (optional)
Name for the exported class/object. If omitted, auto-generated from filename:
- `lock-graphics.js` → `LockGraphics`
- `pin-system.js` → `PinSystem`
- `key-insertion.js` → `KeyInsertion`

### `--extends` (optional)
Specify a parent class to extend:
```bash
--extends "MinigameScene"
```

### `--object-mode` (flag)
Export as an object with methods instead of a class:
```javascript
// Without --object-mode (class)
export class LockConfiguration { ... }

// With --object-mode (object)
export const LockConfiguration = { ... }
```

### `--show-dependencies` (flag)
Display method dependencies before extraction. Helpful for:
- Finding hidden dependencies
- Identifying missing methods
- Planning module interfaces

Example output:
```
⚠️  Dependencies (methods called but not extracted):
   - createPins
   - updatePinVisuals
   - this.scene.add.graphics()
```

### `--imports` (optional)
Add custom import statements to the generated file:
```bash
--imports "import { MinigameScene } from '../framework/base-minigame.js',import { PinSystem } from './pin-system.js'"
```

### `--input-file` (optional)
Override the default input file (default: `js/minigames/lockpicking/lockpicking-game-phaser.js`)

## Step-by-Step Extraction Plan

### Phase 1: Foundation (Lock Configuration)

**Command:**
```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "saveLockConfiguration,loadLockConfiguration,clearLockConfiguration,getLockPinConfiguration,clearAllLockConfigurations,resetPinsToOriginalPositions" \
  --output-file "js/minigames/lockpicking/lock-configuration.js" \
  --object-mode \
  --show-dependencies
```

**Next Steps:**
1. Review `lock-configuration.js`
2. Update imports in main class
3. Test that game still loads
4. Commit changes

### Phase 2: Graphics (Lock Graphics)

**Command:**
```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "createLockBackground,createTensionWrench,createHookPick" \
  --output-file "js/minigames/lockpicking/lock-graphics.js" \
  --class-name "LockGraphics" \
  --show-dependencies
```

**Next Steps:**
1. Review dependencies
2. Create a LockGraphics helper class
3. Update main class to use LockGraphics
4. Test graphics rendering
5. Commit changes

### Phase 3: Key Data Generation

**Command:**
```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "generateKeyDataFromPins,createKeyFromPinSizes,generateRandomKey,getKeySurfaceHeightAtPinPosition,generateKeyPolygonPoints,findVerticalIntersection,getKeySurfaceHeightAtPosition" \
  --output-file "js/minigames/lockpicking/key-data-generator.js" \
  --object-mode \
  --show-dependencies
```

### Phase 4: Pin System

**Command:**
```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "createPins,updatePinVisuals,updatePinHighlighting,liftCollidedPin,updateBindingPins,applyGravity,liftPin,checkAllPinsCorrect,checkPinSet,shouldPinBind" \
  --output-file "js/minigames/lockpicking/pin-system.js" \
  --class-name "PinSystem" \
  --show-dependencies
```

### Phase 5: Key System

**Command:**
```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "createKey,drawKeyWithRenderTexture,drawKeyBladeAsSolidShape,startKeyInsertion,updateKeyPosition,checkKeyCorrectness,liftPinsWithKey,updatePinsWithKeyInsertion,createKeyBladeCollision" \
  --output-file "js/minigames/lockpicking/key-rendering.js" \
  --class-name "KeyRendering" \
  --show-dependencies
```

### Phase 6: Key Selection UI

**Command:**
```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "createKeySelectionUI,createKeyVisual,createKeysForChallenge,createKeysFromInventory,selectKey,startWithKeySelection,showWrongKeyFeedback" \
  --output-file "js/minigames/lockpicking/key-selection-ui.js" \
  --class-name "KeySelectionUI" \
  --show-dependencies
```

### Phase 7: Input Handlers

**Command:**
```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "setupInputHandlers,update,checkHookCollisions,returnHookToStart,updateHookPosition" \
  --output-file "js/minigames/lockpicking/input-handlers.js" \
  --class-name "InputHandlers" \
  --show-dependencies
```

### Phase 8: Success & Completion

**Command:**
```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "lockPickingSuccess,complete,cleanup" \
  --output-file "js/minigames/lockpicking/completion.js" \
  --class-name "CompletionHandler" \
  --show-dependencies
```

### Phase 9: UI Elements

**Command:**
```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "init,createLockableItemDisplay,setupPhaserGame,updateFeedback,flashWrenchRed,flashLockRed" \
  --output-file "js/minigames/lockpicking/ui-elements.js" \
  --class-name "UIElements" \
  --show-dependencies
```

### Phase 10: Mode Switching

**Command:**
```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "switchToPickMode,switchToKeyMode,hideLockpickingTools,showLockpickingTools" \
  --output-file "js/minigames/lockpicking/mode-switching.js" \
  --class-name "ModeSwitching" \
  --show-dependencies
```

### Phase 11: Utilities

**Command:**
```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "shuffleArray,addTriangularSectionToPath,addFirstCutPeakToPath,addTriangularPeakToPath,addPointedTipToPath,addRightPointingTriangleToPath,drawCircleAsPolygon,drawPixelArtCircleToGraphics" \
  --output-file "js/minigames/lockpicking/utilities.js" \
  --object-mode \
  --show-dependencies
```

## Post-Extraction Workflow

After each extraction:

### 1. **Review the Generated File**
```bash
# Check the extracted code for correctness
cat js/minigames/lockpicking/lock-graphics.js
```

### 2. **Identify Import Needs**
Look at the dependencies output:
```
⚠️  Dependencies (methods called but not extracted):
   - createPins
   - updatePinVisuals
   - this.scene
```

### 3. **Update Main Class**
- Remove extracted methods from `lockpicking-game-phaser.js`
- Add import statement for the new module
- Update instantiation if needed

**Example:**
```javascript
// ADD at top of lockpicking-game-phaser.js
import { LockGraphics } from './lock-graphics.js';

// IN the class, replace method calls:
// OLD: this.createLockBackground();
// NEW: this.graphics = new LockGraphics(this.scene, this);
//      this.graphics.createLockBackground();
```

### 4. **Test the Game**
```bash
# Start local server
python3 -m http.server 8000

# Test in browser
# http://localhost:8000/scenario_select.html
```

**Checklist:**
- [ ] Game loads without console errors
- [ ] Lock graphics render correctly
- [ ] Pins appear and can be clicked
- [ ] All interactions work
- [ ] No functionality is broken

### 5. **Commit Changes**
```bash
git add js/minigames/lockpicking/lock-graphics.js
git add js/minigames/lockpicking/lockpicking-game-phaser.js
git commit -m "refactor: extract lock graphics into separate module"
```

## Handling Dependencies

### Common Dependency Patterns

**1. `this` references**
```javascript
// In extracted method
this.scene.add.graphics()        // Needs this.scene
this.pins                        // Needs this.pins[]
```

**Solution:** Pass dependencies via constructor or method parameters.

**2. Built-in functions**
```
Dependencies like getItem, parse, setItem, stringify are built-in
and don't need to be extracted - they're native JS functions.
```

**3. Other class methods**
```javascript
// If extracted method calls updatePinVisuals()
// and it wasn't extracted, either:
// A) Extract it too
// B) Pass updatePinVisuals as a callback parameter
```

## Troubleshooting

### "Method not found" Error
```
❌ Method 'createLockBackground' not found
```

**Solution:**
- Check spelling exactly
- Method must be: `createLockBackground()`
- Not: `createLockBackGround` (capital G)

### Extraction Creates Empty File
**Solution:** Verify the method name matches exactly in the source file.

### Missing Dependencies in Extracted Method
1. Use `--show-dependencies` to see what's missing
2. Either extract the dependency too, or
3. Plan to pass it as a parameter in the refactored code

## Output Format Reference

### Class Format (default)
```javascript
export class LockGraphics {
    
    createLockBackground() {
        // method code...
    }
    
    createTensionWrench() {
        // method code...
    }
}
```

### Object Format (`--object-mode`)
```javascript
export const LockConfiguration = {
    
    saveLockConfiguration() {
        // method code...
    },
    
    loadLockConfiguration() {
        // method code...
    }
};
```

## Quick Reference

### Extract with All Options
```bash
python3 scripts/extract_lockpicking_methods.py \
  --input-file "js/minigames/lockpicking/lockpicking-game-phaser.js" \
  --methods "method1,method2,method3" \
  --output-file "js/minigames/lockpicking/output.js" \
  --class-name "CustomClassName" \
  --extends "ParentClass" \
  --object-mode \
  --show-dependencies \
  --imports "import SomeModule from 'path.js'"
```

### Extract Minimal
```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "method1,method2" \
  --output-file "output.js"
```

## Next Steps

1. ✅ Tool created and tested
2. ⬜ Start Phase 1: Extract lock configuration
3. ⬜ Test Phase 1 extraction
4. ⬜ Continue with remaining phases
5. ⬜ Final refactored architecture

**Ready to start extraction? Begin with Phase 1!**
