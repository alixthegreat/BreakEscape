# Lockpicking Minigame Refactoring - Summary & Recommendations

## What We've Created

### 1. **Refactoring Plan** (`REFACTORING_PLAN.md`)
A comprehensive analysis of the lockpicking minigame architecture identifying:
- 12 separate concerns/modules
- Dependency relationships
- Extraction phases (low to high risk)
- Testing checkpoints

### 2. **Extraction Tool** (`scripts/extract_lockpicking_methods.py`)
A production-grade Python tool that:
- ✅ Extracts methods from JS files **exactly as-is** (no modifications)
- ✅ Auto-generates class names from filenames
- ✅ Detects and reports method dependencies
- ✅ Supports both class and object/namespace exports
- ✅ Handles custom imports
- ✅ Full CLI interface with help documentation

### 3. **Extraction Guide** (`EXTRACTION_GUIDE.md`)
Step-by-step instructions including:
- Installation & basic usage
- 11 complete extraction commands (copy-paste ready)
- Post-extraction workflow
- Dependency handling strategies
- Troubleshooting guide

## Recommended Module Extraction Order

### Phase 1: Foundation (SAFEST - Start Here)
**Lock Configuration** → `lock-configuration.js`

**Why First:**
- Pure data persistence (localStorage + memory)
- No Phaser dependencies
- Can be tested independently
- Used by other modules

**Methods:**
```
saveLockConfiguration
loadLockConfiguration
clearLockConfiguration
getLockPinConfiguration
clearAllLockConfigurations
resetPinsToOriginalPositions
```

**Command:**
```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "saveLockConfiguration,loadLockConfiguration,clearLockConfiguration,getLockPinConfiguration,clearAllLockConfigurations,resetPinsToOriginalPositions" \
  --output-file "js/minigames/lockpicking/lock-configuration.js" \
  --object-mode \
  --show-dependencies
```

---

### Phase 2: Graphics (LOW RISK)
**Lock Graphics** → `lock-graphics.js`

**Why Second:**
- Static rendering only
- No state management
- Visual components are self-contained
- Easy to test visually

**Methods:**
```
createLockBackground
createTensionWrench
createHookPick
```

**Command:**
```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "createLockBackground,createTensionWrench,createHookPick" \
  --output-file "js/minigames/lockpicking/lock-graphics.js" \
  --show-dependencies
```

---

### Phase 3: Key Data (LOW RISK)
**Key Data Generator** → `key-data-generator.js`

**Why Third:**
- Pure calculation/data transformation
- No side effects
- No Phaser dependencies
- Can be unit tested easily

**Methods:**
```
generateKeyDataFromPins
createKeyFromPinSizes
generateRandomKey
getKeySurfaceHeightAtPinPosition
generateKeyPolygonPoints
findVerticalIntersection
getKeySurfaceHeightAtPosition
createKeyBladeCollision
```

**Command:**
```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "generateKeyDataFromPins,createKeyFromPinSizes,generateRandomKey,getKeySurfaceHeightAtPinPosition,generateKeyPolygonPoints,findVerticalIntersection,getKeySurfaceHeightAtPosition,createKeyBladeCollision" \
  --output-file "js/minigames/lockpicking/key-data-generator.js" \
  --object-mode \
  --show-dependencies
```

---

### Phase 4: Pin System (MEDIUM RISK)
**Pin System** → `pin-system.js`

**Why Fourth:**
- Complex state management
- Depends on phases 1-3
- Foundational for other modules
- Significant functionality (~900 lines)

**Methods:**
```
createPins
updatePinVisuals
updatePinHighlighting
liftCollidedPin
updateBindingPins
applyGravity
liftPin
checkAllPinsCorrect
checkPinSet
shouldPinBind
```

**Command:**
```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "createPins,updatePinVisuals,updatePinHighlighting,liftCollidedPin,updateBindingPins,applyGravity,liftPin,checkAllPinsCorrect,checkPinSet,shouldPinBind" \
  --output-file "js/minigames/lockpicking/pin-system.js" \
  --show-dependencies
```

---

### Phase 5: Key Rendering (MEDIUM-HIGH RISK)
**Key Rendering** → `key-rendering.js`

**Why Fifth:**
- Complex graphics rendering
- Depends on phases 1-4
- Interacts with pins and key data

**Methods:**
```
createKey
drawKeyWithRenderTexture
drawKeyBladeAsSolidShape
startKeyInsertion
updateKeyPosition
checkKeyCorrectness
liftPinsWithKey
updatePinsWithKeyInsertion
snapPinsToExactPositions
startKeyRotationAnimationWithChamberHoles
```

**Command:**
```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "createKey,drawKeyWithRenderTexture,drawKeyBladeAsSolidShape,startKeyInsertion,updateKeyPosition,checkKeyCorrectness,liftPinsWithKey,updatePinsWithKeyInsertion,snapPinsToExactPositions,startKeyRotationAnimationWithChamberHoles" \
  --output-file "js/minigames/lockpicking/key-rendering.js" \
  --show-dependencies
```

---

### Remaining Phases (Extract After Testing Phase 1-5)

Once Phase 1-5 are tested and working, continue with:
- **Phase 6:** Key Selection UI → `key-selection-ui.js`
- **Phase 7:** Input Handlers → `input-handlers.js`
- **Phase 8:** Completion & Success → `completion.js`
- **Phase 9:** UI Elements → `ui-elements.js`
- **Phase 10:** Mode Switching → `mode-switching.js`
- **Phase 11:** Utilities → `utilities.js`

See `EXTRACTION_GUIDE.md` for complete Phase 6-11 commands.

---

## Proposed Module Structure

```
js/minigames/lockpicking/
├── lockpicking-game-phaser.js          [Main orchestrator class - ~1500 LOC]
├── lock-configuration.js                [Data persistence - 100 LOC]
├── lock-graphics.js                     [Visual rendering - 200 LOC]
├── key-data-generator.js                [Key calculation - 400 LOC]
├── pin-system.js                        [Pin physics - 900 LOC]
├── key-rendering.js                     [Key visuals - 1200 LOC]
├── key-selection-ui.js                  [UI/UX - 300 LOC]
├── input-handlers.js                    [User input - 200 LOC]
├── completion.js                        [End game logic - 150 LOC]
├── ui-elements.js                       [UI setup - 400 LOC]
├── mode-switching.js                    [Mode logic - 150 LOC]
└── utilities.js                         [Helpers - 300 LOC]

Total: 4670 LOC → ~6200 LOC (with scaffolding) → cleaner, modular code
```

---

## Benefits of This Refactoring

### ✅ **Maintainability**
- Each module has one clear responsibility
- Easier to locate and fix bugs
- New developers can understand one module at a time

### ✅ **Testability**
- Pure functions can be unit tested
- Graphics can be tested in isolation
- State changes are localized

### ✅ **Reusability**
- Pin system could be used in other minigames
- Key rendering could be extracted for other scenarios
- Data generators are standalone utilities

### ✅ **Performance**
- Lazy load modules only when needed
- Easier to optimize hot paths
- Better code splitting opportunities

### ✅ **Development Velocity**
- Team members can work on different modules in parallel
- Less merge conflicts (separate files)
- Easier code review (focused changes)

---

## Before You Start

### Checklist

- [ ] Python 3.6+ installed (verify: `python3 --version`)
- [ ] Git repository clean (commit/stash uncommitted changes)
- [ ] Run game once to verify baseline: `python3 -m http.server 8000`
- [ ] Read `REFACTORING_PLAN.md` for context
- [ ] Read `EXTRACTION_GUIDE.md` for detailed steps

### Testing Strategy

**After Each Extraction:**
1. Generate new module file
2. Update main class (remove methods, add import)
3. Load game in browser
4. Verify no console errors
5. Test affected functionality
6. Commit changes to git

**Commit Message Format:**
```
refactor: extract {module_name} from lockpicking minigame

- Extracted {N} methods into {module_name}.js
- Updated imports in main class
- Verified functionality working
```

---

## Key Files to Reference

| File | Purpose |
|------|---------|
| `REFACTORING_PLAN.md` | Architecture analysis & phase breakdown |
| `EXTRACTION_GUIDE.md` | Step-by-step extraction commands & workflow |
| `scripts/extract_lockpicking_methods.py` | The extraction tool itself |
| `js/minigames/lockpicking/lockpicking-game-phaser.js` | Source file (4670 lines) |
| `js/minigames/framework/base-minigame.js` | Parent class reference |

---

## Troubleshooting Tips

### If Extraction Fails
1. Check method name spelling (case-sensitive)
2. Run with `--show-dependencies` to see what's missing
3. Verify input file path is correct

### If Game Breaks After Extraction
1. Check browser console for errors
2. Verify import statements added correctly
3. Ensure method calls updated to use new modules
4. Revert and try again with fewer methods per extraction

### If You Get Stuck
1. Look at the test file we generated: `test-lock-config.js`
2. Review `EXTRACTION_GUIDE.md` post-extraction workflow section
3. Check git diff to see what changed
4. Revert with `git checkout -- .` and try again

---

## Success Criteria

**Phase 1 (Lock Configuration) is successful when:**
- [ ] `lock-configuration.js` created with 6 methods
- [ ] Main class updated with import
- [ ] Game loads in browser
- [ ] No console errors
- [ ] Lock state still persists across interactions
- [ ] Changes committed to git

**All Phases Complete when:**
- [ ] All 12 modules created
- [ ] Main class only contains orchestration logic
- [ ] Every module has single responsibility
- [ ] Game functionality 100% intact
- [ ] Code is well-documented

---

## Next Steps

1. **Read** `REFACTORING_PLAN.md` for full architecture overview
2. **Read** `EXTRACTION_GUIDE.md` for detailed instructions
3. **Start** Phase 1: Lock Configuration extraction
4. **Test** the game still works
5. **Commit** your changes
6. **Continue** to Phase 2 once confident

**Ready to begin? Start with:**
```bash
cd /home/cliffe/Files/Projects/Code/BreakEscape/BreakEscape
python3 scripts/extract_lockpicking_methods.py \
  --methods "saveLockConfiguration,loadLockConfiguration,clearLockConfiguration,getLockPinConfiguration,clearAllLockConfigurations,resetPinsToOriginalPositions" \
  --output-file "js/minigames/lockpicking/lock-configuration.js" \
  --object-mode \
  --show-dependencies
```

---

## Questions?

For detailed information:
- See `EXTRACTION_GUIDE.md` → "Troubleshooting" section
- Check the tool help: `python3 scripts/extract_lockpicking_methods.py --help`
- Review example: `test-lock-config.js` (auto-generated test file)
