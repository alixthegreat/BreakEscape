# Lockpicking Minigame Refactoring Plan# Lockpicking Minigame Refactoring Plan



## Project Overview## Overview

The `lockpicking-game-phaser.js` file (4670 lines) contains the entire lockpicking minigame implementation. This is a monolithic class that needs to be split into focused, single-responsibility modules.The `lockpicking-game-phaser.js` file (4,670 lines) contains the complete lockpicking minigame implementation with multiple concerns mixed together. This document proposes a modular architecture with incremental extraction.



## Current Architecture Analysis## Current State Analysis



### Main Class: `LockpickingMinigamePhaser`### File Metrics

Extends `MinigameScene` (from `../framework/base-minigame.js`)- **Total Lines**: 4,670

- **Main Class**: `LockpickingMinigamePhaser` (extends `MinigameScene`)

### Identified Concerns & Modules- **Methods**: 50+

- **Concerns**: 7 major distinct areas mixed together

1. **Lock Graphics Rendering** - Draw visual lock components

   - `createLockBackground()` - Bronze cylinder, keyway## Identified Modules

   - `createTensionWrench()` - L-shaped tension tool

   - `createHookPick()` - Hook pick tool with segments### 1. **Lock Configuration Module** (Standalone Utility) ⭐ START HERE

   - Methods: ~200 lines**Responsibility**: Persist and manage lock pin configurations

   - Dependencies: `this.scene` (Phaser scene)**Methods**: 

- `saveLockConfiguration()` - Save to window & localStorage

2. **Pin System** - Manage pin creation, physics, and state- `loadLockConfiguration()` - Load from global storage

   - `createPins()` - Create all pins with collision/highlighting- `clearLockConfiguration()` - Clear one lock's config

   - `updatePinVisuals()` - Update pin graphics based on state- `clearAllLockConfigurations()` - Clear all stored configs

   - `updatePinHighlighting()` - Highlight logic for pin states- `getLockPinConfiguration()` - Return pin heights/lengths

   - `liftCollidedPin()` - Pin interaction on collision- `resetPinsToOriginalPositions()` - Reset pins to defaults

   - `updateBindingPins()` - Track which pin is binding

   - `applyGravity()` - Physics simulation**Why first**: No dependencies on other modules. Can be extracted and tested immediately.

   - `liftPin()` - Main pin lifting logic**File**: `js/minigames/lockpicking/lock-configuration-store.js`

   - Methods: ~900 lines**Dependencies**: None (uses `window` globals directly)

   - Dependencies: `this.scene`, `this.pins[]`

---

3. **Key System** - Key creation, insertion, and selection

   - `createKey()` - Create key visual from key data### 2. **Key System Module** (Business Logic)

   - `createKeyWithRenderTexture()` - Render key to texture**Responsibility**: Key creation, generation, validation, and data structures

   - `drawKeyBladeAsSolidShape()` - Generate key blade polygon**Methods**:

   - `drawKeyWithRenderTexture()` - Draw to render texture- `generateKeyDataFromPins()` - Generate key from pin heights

   - `startKeyInsertion()` - Animate key insertion- `generateRandomKey()` - Create random key data

   - `updateKeyPosition()` - Track key insertion progress- `createKeyFromPinSizes()` - Create key object from pin sizes

   - `startKeyRotationAnimationWithChamberHoles()` - Success animation- `createKeysFromInventory()` - Filter/prepare inventory keys

   - `checkKeyCorrectness()` - Verify correct key- `createKeysForChallenge()` - Generate challenge keys

   - `liftPinsWithKey()` - Pin lifting from key- `startWithKeySelection()` - Initialize key selection mode

   - `updatePinsWithKeyInsertion()` - Update pins as key moves- `selectKey()` - Handle key selection

   - Methods: ~1200 lines

   - Dependencies: `this.scene`, `this.pins[]`, `this.keyData`**Why second**: Depends on Lock Configuration. No visual dependencies.

**File**: `js/minigames/lockpicking/key-system.js`

4. **Key Selection UI** - UI for selecting between multiple keys**Dependencies**: Lock Configuration Module

   - `createKeySelectionUI()` - Create selection popup

   - `createKeyVisual()` - Draw key preview in UI---

   - `createKeysForChallenge()` - Generate challenge mode keys

   - `createKeysFromInventory()` - Load keys from inventory### 3. **Lock Rendering Module** (Visual Components)

   - `selectKey()` - Handle key selection**Responsibility**: Render lock visual elements (background, pins, shear line, tools)

   - `startWithKeySelection()` - Initialize with selection mode**Methods**:

   - `showWrongKeyFeedback()` - Feedback for wrong key- `createLockBackground()` - Draw lock cylinder housing

   - Methods: ~300 lines- `createPins()` - Create all pin sprites with graphics

   - Dependencies: `this.scene`, `this.keyData`, `this.pins[]`- `createShearLine()` - Draw shear line indicator

- `createTensionWrench()` - Draw tension wrench tool

5. **Key Data Generation** - Generate key properties from pins- `createHookPick()` - Draw hook pick tool

   - `generateKeyDataFromPins()` - Create key cuts from pin heights- `updatePinVisuals()` - Update pin appearance

   - `createKeyFromPinSizes()` - Build key config from sizes- `createLockableItemDisplay()` - Item info panel

   - `generateRandomKey()` - Create random test key

   - `getKeySurfaceHeightAtPinPosition()` - Calculate key surface**Why third**: Depends on Phaser scene. Can use Key System for pin counts.

   - `generateKeyPolygonPoints()` - Generate key profile**File**: `js/minigames/lockpicking/lock-renderer.js`

   - `findVerticalIntersection()` - Find key surface height**Dependencies**: Phaser Scene reference

   - `getKeySurfaceHeightAtPosition()` - Surface lookup

   - Methods: ~400 lines---

   - Dependencies: `this.keyData`, `this.pins[]`

### 4. **Key Rendering Module** (Key Visual Components)

6. **Lock Configuration Management** - Persist lock state**Responsibility**: Render and animate key visuals

   - `saveLockConfiguration()` - Save to memory/localStorage**Methods**:

   - `loadLockConfiguration()` - Load from storage- `createKey()` - Create key sprite/graphics

   - `getLockPinConfiguration()` - Get lock's pin config- `createKeyVisual()` - Render key for UI

   - `clearLockConfiguration()` - Clear single lock config- `drawKeyWithRenderTexture()` - Draw key blade with cuts

   - `clearAllLockConfigurations()` - Clear all configs- `drawKeyBladeAsSolidShape()` - Draw solid key blade

   - `resetPinsToOriginalPositions()` - Reset pin state- `drawPixelArtCircleToGraphics()` - Draw handle circle

   - Methods: ~100 lines- `startKeyInsertion()` - Animate key insertion

   - Dependencies: `window.lockConfigurations`, `localStorage`- `updateKeyPosition()` - Update key during insertion

- `updateKeyPosition()` - Update pins during key insertion

7. **Input & Interaction** - Handle user input

   - `setupInputHandlers()` - Mouse/touch event setup**Why after Lock Rendering**: Works with key and lock visuals

   - `update()` - Main update loop**File**: `js/minigames/lockpicking/key-renderer.js`

   - Methods: ~200 lines**Dependencies**: Key System, Phaser Scene

   - Dependencies: `this.scene`, `this.pins[]`, mouse/touch events

---

8. **Lock Picking Logic** - Core picking mechanics

   - `checkAllPinsCorrect()` - Check if all pins set### 5. **Pin Physics Module** (Mechanics & State)

   - `checkPinSet()` - Determine if pin is set**Responsibility**: Pin movement, gravity, collision, binding detection

   - `shouldPinBind()` - Check if pin should bind**Methods**:

   - `checkHookCollisions()` - Hook-pin collision detection- `liftPin()` - Lift a pin with mouse/touch

   - Methods: ~300 lines- `applyGravity()` - Apply gravity to pins

   - Dependencies: `this.pins[]`, hook positioning- `checkAllPinsCorrect()` - Check if all pins set

- `checkPinSet()` - Check if single pin is set

9. **Success & Completion** - Handle game completion- `shouldPinBind()` - Determine if pin binds

   - `lockPickingSuccess()` - Success state handling- `updateBindingPins()` - Update binding status

   - `complete()` - Finish minigame- `updatePinHighlighting()` - Visual feedback for pins

   - `cleanup()` - Clean up resources- `liftCollidedPin()` - Handle hook-pin collisions

   - Methods: ~150 lines- `checkHookCollisions()` - Detect hook-pin contact

- `updateHookPosition()` - Move hook to follow pins

10. **UI Elements & Initialization** - Setup UI- `snapPinsToExactPositions()` - Position pins from key cuts

    - `init()` - Initialize minigame UI

    - `createLockableItemDisplay()` - Show locked item info**Why fifth**: Depends on Pin rendering, Lock configuration

    - `setupPhaserGame()` - Create Phaser game instance**File**: `js/minigames/lockpicking/pin-physics.js`

    - `updateFeedback()` - Update feedback messages**Dependencies**: Lock Rendering, Lock Configuration

    - `flashWrenchRed()` - Visual feedback

    - `flashLockRed()` - Visual feedback---

    - `hideLockpickingTools()` - Hide tools in key mode

    - `showLockpickingTools()` - Show tools### 6. **Lockpicking Mechanics Module** (Game Logic)

    - Methods: ~400 lines**Responsibility**: Game rules, success conditions, difficulty tuning

**Methods**:

11. **Mode Switching** - Switch between picking and key modes- `init()` - Minigame initialization

    - `switchToPickMode()` - Switch from key to pick mode- `setupInputHandlers()` - Setup mouse/touch controls

    - `switchToKeyMode()` - Switch from pick to key mode- `update()` - Main game loop

    - Methods: ~150 lines- `lockPickingSuccess()` - Handle success animation

- `resetAllPins()` - Reset game state

12. **Utility Helpers** - General utilities- `updateFeedback()` - Feedback messages

    - `shuffleArray()` - Randomize array- `flashWrenchRed()` - Visual feedback animations

    - `returnHookToStart()` - Hook animation- `switchToPickMode()` - Switch modes

    - `updateHookPosition()` - Hook positioning logic- `switchToKeyMode()` - Switch modes

    - `addTriangularSectionToPath()` - Path drawing helpers- Difficulty settings, threshold sensitivity, binding order

    - `addFirstCutPeakToPath()` - Path drawing

    - `addTriangularPeakToPath()` - Path drawing**Why sixth**: Orchestrates other modules

    - `addPointedTipToPath()` - Path drawing**File**: `js/minigames/lockpicking/lockpicking-mechanics.js`

    - `addRightPointingTriangleToPath()` - Path drawing**Dependencies**: All other modules

    - `drawCircleAsPolygon()` - Circle drawing

    - `drawPixelArtCircleToGraphics()` - Pixel circle drawing---

    - Methods: ~300 lines

### 7. **Key Mode Module** (Optional Secondary Feature)

## Proposed Extraction Order**Responsibility**: Key insertion mode, key selection UI, key blade collision

**Methods**:

### Phase 1: Foundation (Low Risk)- `createKeySelectionUI()` - UI for key selection

1. **Lock Configuration** (`lock-configuration.js`)- `checkKeyCorrectness()` - Check if key is correct

   - Isolated: No Phaser dependencies, localStorage only- `createKeyBladeCollision()` - Create collision zones

   - Test: Verify save/load works- `getKeySurfaceHeightAtPinPosition()` - Collision detection

   - `getKeySurfaceHeightAtPosition()` - Surface height lookup

2. **Lock Graphics** (`lock-graphics.js`)- `generateKeyPolygonPoints()` - Generate collision polygon

   - Isolated: Only draws static graphics- `findVerticalIntersection()` - Find collision point

   - Test: Verify graphics render- `showWrongKeyFeedback()` - Feedback for wrong key

- `flashLockRed()` - Flash on wrong key

### Phase 2: Core Features (Medium Risk)- `hideLockpickingTools()` - Hide picks when in key mode

3. **Pin System** (`pin-system.js`)- `startKeyRotationAnimationWithChamberHoles()` - Success animation

   - Depends on: graphics, scene

   - Test: Pins render and respond to input**Why last**: Optional feature, can be extracted after core refactoring

**File**: `js/minigames/lockpicking/key-mode-system.js`

4. **Key Data Generation** (`key-data-generator.js`)**Dependencies**: Key System, Key Rendering, Pin Physics

   - Isolated: Pure data generation

   - Test: Key data generated correctly---



### Phase 3: Key System (High Risk)## Extraction Order

5. **Key Rendering** (`key-rendering.js`)

   - Depends on: scene, key-data-generator```

   - Test: Keys render correctly1. Lock Configuration Module (no dependencies)

   ↓

6. **Key Insertion** (`key-insertion.js`)2. Key System Module (depends on #1)

   - Depends on: pin-system, key-rendering   ↓

   - Test: Key insertion animation works3. Lock Rendering Module (depends on Phaser)

   ↓

### Phase 4: UI & Controls4. Key Rendering Module (depends on #2, #3)

7. **Key Selection UI** (`key-selection-ui.js`)   ↓

   - Depends on: scene, key-rendering5. Pin Physics Module (depends on #1, #3)

   - Test: UI displays and selection works   ↓

6. Lockpicking Mechanics Module (depends on all above)

8. **Input Handlers** (`input-handlers.js`)   ↓

   - Depends on: pin-system, key-insertion7. Key Mode Module (optional, depends on all above)

   - Test: Input events trigger correctly```



## Refactoring Strategy## Main Class After Refactoring



### RulesAfter full refactoring, `LockpickingMinigamePhaser` will:

1. **Extract exactly as-is**: Copy methods without rewriting1. Initialize and hold references to submodules

2. **Create helper methods**: For dependency injection if needed2. Orchestrate initialization order

3. **Keep class properties**: Map to instance properties where needed3. Handle Phaser lifecycle (init, create, update)

4. **Minimal changes to main class**: Just remove methods and add imports4. Delegate domain logic to appropriate modules

5. **Test after each module**: Verify game still runs5. Pass `this` (Phaser scene) to modules for rendering



### Testing Checklist```javascript

- [ ] Game loads without errorsexport class LockpickingMinigamePhaser extends MinigameScene {

- [ ] Graphics render correctly    constructor(container, params) {

- [ ] Pins can be lifted        // ... param initialization

- [ ] Hook responds to pins        this.config = new LockConfiguration(params);

- [ ] Keys render (if applicable)        this.keys = new KeySystem(this.config);

- [ ] Key insertion works (if applicable)        this.lockRenderer = new LockRenderer(this); // this = Phaser scene

- [ ] Lock configuration persists        this.keyRenderer = new KeyRenderer(this);

        this.physics = new PinPhysics(this);

## File Structure After Refactoring        this.mechanics = new LockpickingMechanics(this);

        if (params.keyMode) {

```            this.keyMode = new KeyModeSystem(this);

js/minigames/lockpicking/        }

├── lockpicking-game-phaser.js (main class, ~2000 lines)    }

├── lock-configuration.js}

├── lock-graphics.js```

├── pin-system.js

├── key-data-generator.js## Benefits

├── key-rendering.js

├── key-insertion.js✅ **Testability**: Each module can be unit tested independently

├── key-selection-ui.js✅ **Maintainability**: Clear separation of concerns

├── input-handlers.js✅ **Reusability**: Modules can be used in other projects

├── lock-picking-logic.js✅ **Debugging**: Easier to locate and fix bugs

├── ui-elements.js✅ **Performance**: Can optimize/cache individual modules

└── mode-switching.js✅ **Extensibility**: Easy to add new pin types, key modes, etc.

```

## Testing Strategy

## Next Steps

After each module extraction:

1. ✅ Create analysis document (this file)1. Run `locksmith-forge.html` test (verifies picking works)

2. ⬜ Create Python extraction tool2. Run `test-phaser-lockpicking.html` test

3. ⬜ Extract Phase 1 modules3. Run scenario with lockpicking challenge

4. ⬜ Test Phase 14. Verify console for no new errors

5. ⬜ Extract Phase 2 modules5. Check browser DevTools for performance

6. ⬜ Test Phase 2

... and so on## File Structure After Refactoring


```
js/minigames/lockpicking/
├── lockpicking-game-phaser.js (orchestrator, ~500 lines)
├── lock-configuration-store.js (persistence, ~100 lines)
├── key-system.js (key logic, ~200 lines)
├── lock-renderer.js (lock visuals, ~400 lines)
├── key-renderer.js (key visuals, ~800 lines)
├── pin-physics.js (physics, ~600 lines)
├── lockpicking-mechanics.js (game logic, ~800 lines)
├── key-mode-system.js (key insertion, ~400 lines)
└── index.js (export all)
```

**Estimated reduction**: 4,670 lines → ~4,200 lines (cleaner organization, less duplication)

---

## Next Steps

1. ✅ Complete this analysis
2. ✅ Extract **Lock Rendering Module** (COMPLETED)
3. 🔄 Extract **Lock Configuration Module** first
4. Test main game still works
5. Extract **Key System Module**
6. Test main game still works
7. Continue with remaining modules...
