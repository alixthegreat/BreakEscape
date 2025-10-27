# Phase Execution Quick Reference - UPDATED

After script fixes, phases now run cleanly with automatic integration!

## Phase 1: ✅ COMPLETE (Manually Fixed)

**What was done**: Lock Configuration extracted
- Module: `lock-configuration.js` (128 LOC, 7 functions)
- Main file updated with import, initialization, and method calls
- Status: Working after manual fixes

---

## Phase 2: Lock Graphics (3 functions)

**Methods to extract**:
- `createLockBackground` - Creates the lock cylinder background
- `createTensionWrench` - Creates tension wrench tool
- `createHookPick` - Creates hook pick tool

**Command**:
```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "createLockBackground,createTensionWrench,createHookPick" \
  --output-file "js/minigames/lockpicking/lock-graphics.js" \
  --class-name "LockGraphics" \
  --replace-this --auto-integrate \
  --update-main-file "js/minigames/lockpicking/lockpicking-game-phaser.js" \
  --module-instance-name "lockGraphics" --show-dependencies
```

**Expected Results**:
- ✅ File created: `lock-graphics.js`
- ✅ Import added to main file
- ✅ Initialization added: `this.lockGraphics = new LockGraphics(this)`
- ✅ Methods removed from main file
- ✅ Method calls updated: `this.lockGraphics.createLockBackground()`
- ✅ No manual fixes needed

**Verification**:
```bash
python3 scripts/list_js_functions.py --file js/minigames/lockpicking/lockpicking-game-phaser.js --count
# Should show 69 functions (72 - 3 extracted)

python3 scripts/list_js_functions.py --file js/minigames/lockpicking/lock-graphics.js --count
# Should show 4 functions (constructor + 3 methods)
```

---

## Phase 3: Key Data Generator (8 functions)

**Methods to extract**:
- `generateKeyDataFromPins`
- `generateRandomKeyData`
- `getKeyDataForPinHeights`
- `modifyKeyDataForPinHeights`
- `applyKeyDataToLock`
- `validateKeyWithLock`
- `calculateKeyCorrectness`
- `analyzeKeyProfile`

**Command**:
```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "generateKeyDataFromPins,generateRandomKeyData,getKeyDataForPinHeights,modifyKeyDataForPinHeights,applyKeyDataToLock,validateKeyWithLock,calculateKeyCorrectness,analyzeKeyProfile" \
  --output-file "js/minigames/lockpicking/key-data-generator.js" \
  --class-name "KeyDataGenerator" \
  --replace-this --auto-integrate \
  --update-main-file "js/minigames/lockpicking/lockpicking-game-phaser.js" \
  --module-instance-name "keyDataGen" --show-dependencies
```

---

## Phase 4: Pin System (13 functions)

**Methods to extract**:
- `createPinObject`
- `calculatePinHeight`
- `bindPin`
- `setPin`
- `resetPin`
- `getTensionForPin`
- `calculateShearLine`
- `checkPinAtShearLine`
- `handlePinFeedback`
- `updatePinState`
- `animatePinMovement`
- `getPinBindingOrder`
- `validatePinConfiguration`

---

## Phase 5: Key Rendering (17 functions) ⚠️ LARGEST

**Methods to extract**:
- `createKey`
- `drawKeyWithRenderTexture`
- `renderKeyProfile`
- `updateKeyPosition`
- `updateKeyVisualsForInsertion`
- `createKeyGraphics`
- `drawKeyShaft`
- `drawKeyHead`
- `drawKeyCuts`
- `drawKeyRidges`
- `createKeyOutline`
- `applyKeyTexture`
- `updateKeyTransform`
- `animateKeyInsertion`
- `renderKeyInserted`
- `createKeyClickZone`
- `updateKeyClickZone`

---

## Phase 6: Key Selection UI (4 functions)

**Methods to extract**:
- `showKeySelectionUI`
- `createKeySelectionContainer`
- `displayAvailableKeys`
- `selectKeyFromInventory`

---

## Phase 7: Input Handlers (4 functions)

**Methods to extract**:
- `setupInputHandlers`
- `handleMouseDown`
- `handleMouseMove`
- `handleMouseUp`

---

## Phase 8: Completion Handler (2 functions)

**Methods to extract**:
- `handleLockSuccess`
- `handleLockFailure`

---

## Phase 9: UI Elements (6 functions)

**Methods to extract**:
- `updateFeedback`
- `createUIElements`
- `updatePinVisuals`
- `createShearLine`
- `highlightBindingPin`
- `updateProgressIndicator`

---

## Phase 10: Mode Switching (2 functions)

**Methods to extract**:
- `switchToPickMode`
- `switchToKeyMode`

---

## Phase 11: Key Insertion/Animation (8 functions)

**Methods to extract**:
- `insertKey`
- `animateKeyInsertion`
- `handleKeyInsertion`
- `testKeyAgainstLock`
- `applyKeyToLock`
- `showKeyInsertionFeedback`
- `resetKeyInsertion`
- `finalizeKeyMode`

---

## Phase 12: Utilities & Other (7 functions)

**Methods to extract**:
- `shuffleArray`
- `flashWrenchRed`
- `start`
- `complete`
- `cleanup`
- And 2 others from remaining functions

---

## Running All Phases (Batch)

```bash
#!/bin/bash

cd /home/cliffe/Files/Projects/Code/BreakEscape/BreakEscape

# Phase 2
python3 scripts/extract_lockpicking_methods.py --methods "..." --output-file "..." --auto-integrate --update-main-file "..."

# Phase 3
python3 scripts/extract_lockpicking_methods.py --methods "..." --output-file "..." --auto-integrate --update-main-file "..."

# Continue for Phases 4-12...
```

## Progress Tracking

| Phase | Component | Functions | Status | Manual Fix? |
|-------|-----------|-----------|--------|------------|
| 1 | Lock Configuration | 6 | ✅ Complete | ⚠️ Manual fixes applied |
| 2 | Lock Graphics | 3 | 📋 Ready | ✅ Auto (script fixed) |
| 3 | Key Data Generator | 8 | 📋 Ready | ✅ Auto (script fixed) |
| 4 | Pin System | 13 | 📋 Ready | ✅ Auto (script fixed) |
| 5 | Key Rendering | 17 | 📋 Ready | ✅ Auto (script fixed) |
| 6 | Key Selection UI | 4 | 📋 Ready | ✅ Auto (script fixed) |
| 7 | Input Handlers | 4 | 📋 Ready | ✅ Auto (script fixed) |
| 8 | Completion Handler | 2 | 📋 Ready | ✅ Auto (script fixed) |
| 9 | UI Elements | 6 | 📋 Ready | ✅ Auto (script fixed) |
| 10 | Mode Switching | 2 | 📋 Ready | ✅ Auto (script fixed) |
| 11 | Key Insertion/Animation | 8 | 📋 Ready | ✅ Auto (script fixed) |
| 12 | Utilities | 7 | 📋 Ready | ✅ Auto (script fixed) |

**Total**: 78 functions across 12 phases
**Completion**: 6/78 (7.7%)
**Time estimate**: ~2-3 hours for all phases (with no manual fixes needed)

## Key Improvements in Fixed Script

✅ **Automatic Import Addition** - No need to manually add imports
✅ **Automatic Initialization** - Constructor setup handled automatically
✅ **Correct Parent Reference** - Uses `this.parent` pattern throughout
✅ **Automatic Method Call Updates** - Uses `this.moduleInstance.method()` pattern
✅ **Automatic Method Removal** - Old methods deleted from main file
✅ **Content Persistence** - All changes properly saved and persisted

## Next Steps

1. Run Phase 2 with the fixed script
2. Verify: Check function counts match expected
3. Test: Reload browser and verify no console errors
4. Commit: `git add . && git commit -m "Extract: Lock Graphics module"`
5. Repeat for Phases 3-12

**No manual code fixes needed after Phase 2!** 🎉
