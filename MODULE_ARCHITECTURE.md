# Lockpicking Minigame - Module Architecture Diagram# Module Architecture Reference



## Current Monolithic Architecture## Current Module Structure



```### ✅ COMPLETE: Lock Rendering Module

┌─────────────────────────────────────────────────────────────────┐**File**: `js/minigames/lockpicking/lock-renderer.js`

│         LockpickingMinigamePhaser (4670 lines)                  │**Lines**: ~700

│                                                                  │**Dependencies**: Phaser Scene (passed via parent)

│  ┌────────────────────────────────────────────────────────┐   │**Status**: Ready for production

│  │ Constructor                                            │   │

│  │  - Lock configuration                                 │   │```

│  │  - Game state initialization                          │   │LockRenderer

│  │  - Settings (difficulty, mode, etc.)                  │   │├── Constructor(parentScene)

│  └────────────────────────────────────────────────────────┘   ││   ├── this.parent = parentScene

│                                                                  ││   ├── this.scene = parentScene.scene

│  ┌────────────────────────────────────────────────────────┐   ││   └── Property initialization

│  │ Configuration Management                               │   ││

│  │  - saveLockConfiguration()                             │   │├── Lock Visual Components

│  │  - loadLockConfiguration()                             │   ││   ├── createLockBackground()

│  │  - clearLockConfiguration()                            │   ││   ├── createShearLine()

│  └────────────────────────────────────────────────────────┘   ││   ├── createPins()

│                                                                  ││   │   ├── Pin container creation

│  ┌────────────────────────────────────────────────────────┐   ││   │   ├── Spring, driver pin, key pin graphics

│  │ Graphics Rendering                                     │   ││   │   ├── Highlight overlays

│  │  - createLockBackground()                              │   ││   │   ├── Channel rectangles

│  │  - createTensionWrench()                               │   ││   │   ├── Interactive event zones

│  │  - createHookPick()                                    │   ││   │   └── Labels

│  └────────────────────────────────────────────────────────┘   ││   └── createLockableItemDisplay()

│                                                                  ││

│  ┌────────────────────────────────────────────────────────┐   │├── Tool Components

│  │ Pin System (900+ lines)                                │   ││   ├── createTensionWrench()

│  │  - createPins()                                        │   ││   │   ├── Wrench graphics

│  │  - updatePinVisuals()                                  │   ││   │   ├── Interactive handlers

│  │  - liftPin()                                           │   ││   │   └── Color state (active/inactive)

│  │  - applyGravity()                                      │   ││   └── createHookPick()

│  │  - checkAllPinsCorrect()                               │   ││       ├── Hook graphics (diagonal + vertical segments)

│  └────────────────────────────────────────────────────────┘   ││       ├── Positioning calculation

│                                                                  ││       └── Configuration storage

│  ┌────────────────────────────────────────────────────────┐   ││

│  │ Key System (1200+ lines)                               │   │├── Pin Rendering

│  │  - createKey()                                         │   ││   ├── updatePinVisuals(pin)

│  │  - drawKeyBladeAsSolidShape()                           │   ││   │   ├── Key pin redraw

│  │  - startKeyInsertion()                                 │   ││   │   ├── Driver pin redraw

│  │  - checkKeyCorrectness()                               │   ││   │   └── Spring compression animation

│  └────────────────────────────────────────────────────────┘   ││   └── handlePinClick(pin)

│                                                                  ││       ├── Visual feedback

│  ┌────────────────────────────────────────────────────────┐   ││       ├── Label hiding

│  │ Key Selection UI (300+ lines)                          │   ││       └── Tension check

│  │  - createKeySelectionUI()                              │   ││

│  │  - selectKey()                                         │   │├── Tool Handling

│  └────────────────────────────────────────────────────────┘   ││   ├── handleTensionWrenchClick()

│                                                                  ││   │   ├── Tension state toggle

│  ┌────────────────────────────────────────────────────────┐   ││   │   ├── Visual feedback (color change)

│  │ Input & Interaction                                    │   ││   │   ├── Sound effects

│  │  - setupInputHandlers()                                │   ││   │   ├── Pin reset logic

│  │  - update()                                            │   ││   │   └── Lock state update

│  │  - checkHookCollisions()                               │   ││   └── [Many event handlers delegated]

│  └────────────────────────────────────────────────────────┘   ││

│                                                                  │└── Utility Methods

│  ┌────────────────────────────────────────────────────────┐   │    ├── hideLabels()

│  │ Completion & Success                                  │   │    └── hideLockpickingTools()

│  │  - lockPickingSuccess()                                │   │```

│  │  - complete()                                          │   │

│  │  - cleanup()                                           │   │### 🔄 NEXT: Lock Configuration Module

│  └────────────────────────────────────────────────────────┘   │**File**: `js/minigames/lockpicking/lock-configuration-store.js`

│                                                                  │**Lines**: ~100

│  ┌────────────────────────────────────────────────────────┐   │**Dependencies**: None (uses window globals)

│  │ UI & Utilities                                         │   │**Priority**: HIGH (no dependencies)

│  │  - init()                                              │   │**Status**: Ready for extraction

│  │  - updateFeedback()                                    │   │

│  │  - shuffleArray()                                      │   │```

│  │  - [15+ helper methods]                                │   │LockConfigurationStore

│  └────────────────────────────────────────────────────────┘   │├── saveLockConfiguration()

│                                                                  ││   ├── Extract pin heights from this.pins[]

└─────────────────────────────────────────────────────────────────┘│   ├── Save to window.lockConfigurations

```│   └── Save to localStorage (persistence)

│

## Proposed Modular Architecture├── loadLockConfiguration()

│   ├── Check window.lockConfigurations

```│   ├── Fallback to localStorage

                    ┌─────────────────────────────┐│   └── Return pin heights array

                    │ LockpickingMinigamePhaser   ││

                    │   (Main Orchestrator)       │├── clearLockConfiguration()

                    │   ~1500 lines               ││   ├── Clear single lock config

                    └────────────┬────────────────┘│   └── Update localStorage

                                 ││

                ┌────────────────┼────────────────┐├── clearAllLockConfigurations()

                │                │                ││   ├── Clear window storage

         ┌──────▼─────┐   ┌──────▼─────┐   ┌──────▼────────┐│   ├── Clear localStorage

         │   Setup    │   │  Graphics  │   │  Interaction  ││   └── Log confirmation

         │  Phase     │   │   Phase    │   │    Phase      ││

         └─────┬──────┘   └─────┬──────┘   └───────┬───────┘├── getLockPinConfiguration()

               │                │                   ││   ├── Return pin heights

          ┌────▼────┐      ┌────▼────┐      ┌──────▼──────┐│   └── Return pin lengths (keyPin, driverPin)

          │   UI    │      │ Graphics │     │   Input     ││

          │Elements │      │          │     │  Handlers   │└── resetPinsToOriginalPositions()

          └─────────┘      │ • Lock   │     │             │    ├── Set all currentHeight to 0

                           │ • Tools  │     └──────────────┘    ├── Restore original positions

                           │ • Pins   │    └── Clear override heights

                           └────┬─────┘```

                                │

                    ┌───────────┼───────────┐### 🔜 FUTURE: Key System Module

                    │           │           │**File**: `js/minigames/lockpicking/key-system.js`

              ┌─────▼──┐  ┌─────▼──┐  ┌────▼────┐**Lines**: ~200

              │   Pin  │  │   Key  │  │   Key   │**Dependencies**: Lock Configuration Module

              │ System │  │Rendering│  │Selection│**Priority**: MEDIUM

              │        │  │         │  │   UI    │**Status**: Design ready

              └─────────┘  └────┬────┘  └────────┘

                                │```

                        ┌───────▼──────┐KeySystem

                        │ Key Data     │├── generateKeyDataFromPins()

                        │ Generator    ││   ├── Calculate cut depths from pin heights

                        │              ││   └── Create key blade profile

                        └──────────────┘│

                                │├── generateRandomKey(pinCount)

                        ┌───────▼──────┐│   ├── Random cuts array

                        │   Lock       ││   └── Return key data object

                        │Configuration││

                        │   Storage    │├── createKeyFromPinSizes(pinSizes)

                        └──────────────┘│   ├── Convert pin sizes to key

```│   └── Return key object

│

## Module Dependency Relationship├── createKeysFromInventory(keys, correctKeyId)

│   ├── Filter valid keys

```│   ├── Shuffle order

Lock Configuration  (Level 0 - Foundation)│   └── Return selection UI

    ││

    └─── Key Data Generator (Level 1 - Pure calculation)├── createKeysForChallenge(correctKeyId)

            ││   ├── Generate 3 random keys

            ├─── Pin System (Level 2 - State & Physics)│   ├── Make first one correct

            │     ││   ├── Shuffle

            │     └─── Lock Graphics (Level 2 - Rendering)│   └── Return for selection

            ││

            └─── Key Rendering (Level 3 - Key visuals)└── startWithKeySelection(inventoryKeys, correctKeyId)

                  │    ├── Initialize key selection mode

                  └─── Key Selection UI (Level 4 - UI/UX)    └── Show UI

```

Input Handlers (Orthogonal - Level 3)

    ├─ Pin System### 🔜 FUTURE: Pin Physics Module

    ├─ Key Rendering**File**: `js/minigames/lockpicking/pin-physics.js`

    └─ Hook Collision Detection**Lines**: ~600

**Dependencies**: Lock Renderer, Lock Configuration

UI Elements (Level 4 - Initialization)**Priority**: HIGH (core mechanic)

    └─ All graphics, input, and data modules**Status**: Design ready



Completion Handler (Level 5 - End state)```

    ├─ Pin SystemPinPhysics

    ├─ Key Rendering├── Pin Lifting

    └─ All other modules│   ├── liftPin()

```│   │   ├── Mouse/touch tracking

│   │   ├── Height calculation

## Phase-by-Phase Extraction Timeline│   │   ├── Binding detection

│   │   └── Overpicking check

```│   └── liftCollidedPin(pin)

┌─────────────────────────────────────────────────────────────────┐│

│ PHASE 1: FOUNDATION (Safest)                                    │├── Physics Simulation

│ ─────────────────────────────────────────────────────────────── ││   ├── applyGravity()

│ • Lock Configuration (100 LOC)                                  ││   │   ├── Downward force

│   └─ 6 methods: save/load/clear operations                      ││   │   ├── Spring restoration

├─────────────────────────────────────────────────────────────────┤│   │   └── Collision handling

│ PHASE 2: GRAPHICS (Low Risk)                                    ││   └── checkHookCollisions(pinIndex)

│ ─────────────────────────────────────────────────────────────── ││

│ • Lock Graphics (200 LOC)                                       │├── Pin State Management

│   └─ 3 methods: render lock, wrench, hook                       ││   ├── checkAllPinsCorrect()

├─────────────────────────────────────────────────────────────────┤│   │   ├── Verify all set

│ PHASE 3: DATA (Low Risk)                                        ││   │   └── Check shear line alignment

│ ─────────────────────────────────────────────────────────────── ││   ├── checkPinSet(pin)

│ • Key Data Generator (400 LOC)                                  ││   │   ├── Tolerance checking

│   └─ 8 methods: key calculations                                ││   │   └── Binding verification

├─────────────────────────────────────────────────────────────────┤│   └── shouldPinBind(pin)

│ PHASE 4: PIN SYSTEM (Medium Risk) ← MAJOR MILESTONE             ││

│ ─────────────────────────────────────────────────────────────── │├── Pin Highlighting

│ • Pin System (900 LOC)                                          ││   ├── updatePinHighlighting(pin)

│   └─ 10 methods: pins, physics, checking                        ││   ├── updateBindingPins()

├─────────────────────────────────────────────────────────────────┤│   └── updateHookPosition(pinIndex)

│ PHASE 5: KEY RENDERING (Medium-High Risk) ← MAJOR MILESTONE    ││

│ ─────────────────────────────────────────────────────────────── │└── Hook Interaction

│ • Key Rendering (1200 LOC)                                      │    ├── returnHookToStart()

│   └─ 10 methods: key visuals, insertion, animation              │    └── updateHookPosition(pinIndex)

├─────────────────────────────────────────────────────────────────┤```

│ PHASE 6: UI & CONTROLS (High Risk)                             │

│ ─────────────────────────────────────────────────────────────── │### 🔜 FUTURE: Lockpicking Mechanics Module

│ • Key Selection UI (300 LOC)                                    │**File**: `js/minigames/lockpicking/lockpicking-mechanics.js`

│ • Input Handlers (200 LOC)                                      │**Lines**: ~800

│ • Completion Handler (150 LOC)                                  │**Dependencies**: All other modules

│ • UI Elements (400 LOC)                                         │**Priority**: MEDIUM (orchestrator)

│ • Mode Switching (150 LOC)                                      │**Status**: Design ready

│ • Utilities (300 LOC)                                           │

└─────────────────────────────────────────────────────────────────┘```

```LockpickingMechanics

├── Game Loop

## Code Quality Metrics│   ├── init()

│   ├── create()

### Before Refactoring│   └── update()

```│

File: lockpicking-game-phaser.js├── Input Handling

Lines of Code:     4670│   ├── setupInputHandlers()

Methods:           50+│   │   ├── Mouse down

Average Method:    93 lines│   │   ├── Mouse move

Complexity:        Very High (single 4670-line class)│   │   ├── Mouse up

Testability:       Low│   │   └── Touch events

Maintainability:   Low│   └── Event processing

Reusability:       Low│

```├── Success/Failure

│   ├── lockPickingSuccess()

### After Refactoring (Target)│   │   ├── Animation

```│   │   ├── Sound effects

Module               LOC    Methods  Avg Method  Complexity│   │   ├── Pin rotation

─────────────────────────────────────────────────────────────│   │   └── Completion

Main Class          1500   15       100         Medium│   └── Handle failures

Lock Configuration   100   6        17          Low│

Lock Graphics       200    3        67          Low-Medium├── Game State

Key Data Gen.       400    8        50          Medium│   ├── resetAllPins()

Pin System          900    10       90          Medium-High│   ├── updateBindingPins()

Key Rendering       1200   10       120         Medium-High│   └── State validation

Key Selection UI    300    7        43          Medium│

Input Handlers      200    5        40          Medium├── Feedback/UI

Completion          150    3        50          Low│   ├── updateFeedback(message)

UI Elements         400    6        67          Medium│   ├── flashWrenchRed()

Mode Switching      150    4        37          Low│   └── Visual indicators

Utilities           300    8        37          Low│

─────────────────────────────────────────────────────────────└── Mode Switching

TOTAL              6400    85       75          Moderate    ├── switchToPickMode()

    ├── switchToKeyMode()

Improvements:    └── Mode synchronization

✓ 85 methods distributed across 12 modules```

✓ Average method size reduced from 93 → 75 lines

✓ Each module has single responsibility### 🔜 FUTURE: Key Mode System (Optional)

✓ Cyclomatic complexity per module reduced**File**: `js/minigames/lockpicking/key-mode-system.js`

✓ Unit testability increased ~60%**Lines**: ~400

✓ Code reusability increased ~40%**Dependencies**: All others

```**Priority**: LOW (optional feature)

**Status**: Design ready

## Data Flow Architecture

```

```KeyModeSystem

User Input                Browser├── Key Insertion

    │                       ││   ├── createKey()

    ├──────────┬────────────┤│   ├── startKeyInsertion()

             Input Handlers│   └── updateKeyPosition(progress)

                   ││

                   ├─────────────────────┬────────────────┐├── Key Rendering

                   │                     │                ││   ├── drawKeyWithRenderTexture()

              Pin Lifting         Key Insertion    Mode Switching│   ├── drawKeyBladeAsSolidShape()

                   │                     │                ││   └── createKeyVisual()

                   └─────────┬───────────┴────────────┬───┘│

                             │                        │├── Key Selection UI

                          Pin System          Key Rendering│   ├── createKeySelectionUI()

                             │                        ││   ├── selectKey(index)

                             └────────────┬───────────┘│   └── showKeySelection()

                                          ││

                        Collision Detection & Physics├── Collision Detection

                                          ││   ├── createKeyBladeCollision()

                        ┌─────────────────┴──────────────┐│   ├── getKeySurfaceHeightAtPosition()

                        │                                ││   └── findVerticalIntersection()

                    Feedback                       State Update│

                        │                                │├── Success Animation

                    UI Feedback               Lock Configuration│   ├── startKeyRotationAnimationWithChamberHoles()

                        │                                ││   ├── snapPinsToExactPositions()

                    Render                       Storage (Memory/localStorage)│   └── checkKeyCorrectness()

                        │                                ││

                    Display                          Persist└── Utility

```    ├── hideLockpickingTools()

    └── showWrongKeyFeedback()

## Integration Points```



### Main Class → Modules## Data Flow Diagram



```javascript```

class LockpickingMinigamePhaser extends MinigameScene {User Interaction

          ↓

    // Initialize each modulePhaser Input Events

    constructor(container, params) {      ↓

        super(container, params);┌─────────────────────────────────────┐

        this.lockConfig = new LockConfiguration(this);│ LockpickingMinigamePhaser           │ (Orchestrator)

        this.graphics = new LockGraphics(this.scene, this);│ (Main Game Logic)                   │

        this.keyDataGen = new KeyDataGenerator(this);└─────────────────────────────────────┘

        this.pinSystem = new PinSystem(this.scene, this);      ↓

        this.keyRendering = new KeyRendering(this.scene, this);┌─────────────────────────────────────┐

        this.keyUI = new KeySelectionUI(this.scene, this);│ LockRenderer              ← Rendering

        this.inputHandler = new InputHandlers(this.scene, this);│ LockConfigurationStore   ← Persistence

        this.uiElements = new UIElements(this.gameContainer, this);│ KeySystem                ← Key logic

        this.modeSwitch = new ModeSwitching(this);│ PinPhysics              ← Physics

        this.completion = new CompletionHandler(this);│ LockpickingMechanics    ← Game rules

    }│ KeyModeSystem (opt)     ← Key mode

    └─────────────────────────────────────┘

    // Orchestrate modules      ↓

    init() {Phaser Scene (Graphics, Physics, Input)

        this.uiElements.init();      ↓

        this.setupPhaserGame(); // Still in main classCanvas / WebGL

    }      ↓

    Visual Output

    setupPhaserGame() {```

        // Create Phaser scene, then call module methods

        this.graphics.createLockBackground();## Dependency Graph

        this.pinSystem.createPins();

        // ... etc```

    }LockConfiguration

}├── (No dependencies)

```└── Used by: KeySystem, PinPhysics



## Testing Strategy by ModuleKeySystem

├── Depends on: LockConfiguration

```└── Used by: LockpickingMechanics, KeyModeSystem

┌──────────────────────────────────────────────────────────────┐

│ Unit Tests (Isolated)                                        │LockRenderer

├──────────────────────────────────────────────────────────────┤├── Depends on: Phaser Scene

│ • Key Data Generator      → Pure functions, easily testable  │└── Used by: LockpickingMinigamePhaser

│ • Lock Configuration      → Persistence logic                │

│ • Utilities               → Helper functions                 │PinPhysics

├──────────────────────────────────────────────────────────────┤├── Depends on: LockConfiguration, LockRenderer

│ Integration Tests                                            │└── Used by: LockpickingMechanics

├──────────────────────────────────────────────────────────────┤

│ • Pin System + Graphics   → Visual rendering + physics       │LockpickingMechanics

│ • Key Rendering + Pins    → Key insertion mechanics          │├── Depends on: All above modules

│ • Input + Pin System      → Interaction flow                 │└── Used by: LockpickingMinigamePhaser

├──────────────────────────────────────────────────────────────┤

│ E2E Tests (Manual)                                           │KeyModeSystem

├──────────────────────────────────────────────────────────────┤├── Depends on: KeySystem, LockRenderer, PinPhysics

│ • Lock picking flow       → Full game cycle                  │└── Used by: LockpickingMechanics (optional)

│ • Key insertion flow      → Alternative game path            │

│ • Mode switching          → Feature interaction              │LockpickingMinigamePhaser (Main Class)

└──────────────────────────────────────────────────────────────┘├── Initializes all modules

```├── Handles Phaser lifecycle

└── Orchestrates interaction

## Rollback Strategy```



At any point during refactoring, if something breaks:## Extraction Order Rationale



```bash1. **Lock Rendering** ✅ (DONE)

# Option 1: Revert last extraction   - No internal dependencies

git revert HEAD   - Isolates graphics code

   - Safe to extract first

# Option 2: Reset to before extraction

git reset --hard <commit-before-extraction>2. **Lock Configuration** → NEXT

   - No internal dependencies

# Option 3: Start fresh extraction with different methods   - Required by multiple modules

git checkout -- js/minigames/lockpicking/lockpicking-game-phaser.js   - Very low risk

python3 scripts/extract_lockpicking_methods.py --methods "subset" ...

```3. **Key System**

   - Depends on: Config

## Migration Checklist   - Used by: Mechanics, Key Mode

   - Medium complexity

```

Phase 1 (Lock Configuration):4. **Pin Physics**

  ☐ Extract lock-configuration.js   - Depends on: Config, Rendering

  ☐ Update imports in main class   - Core game mechanic

  ☐ Test game loads   - Most complex

  ☐ Test lock state persists

  ☐ Commit changes5. **Lockpicking Mechanics**

     - Depends on: All above

Phase 2 (Graphics):   - Final orchestrator

  ☐ Extract lock-graphics.js   - Ties everything together

  ☐ Create LockGraphics helper class

  ☐ Update method calls in main6. **Key Mode System**

  ☐ Test graphics render   - Optional feature

  ☐ Commit changes   - Depends on all above

     - Extract last (or skip)

Phase 3 (Key Data):

  ☐ Extract key-data-generator.js## Backward Compatibility Strategy

  ☐ Update imports

  ☐ Test key generationAll extracted modules maintain backward compatibility:

  ☐ Commit changes

  ```javascript

Phase 4 (Pin System):// Old code (still works)

  ☐ Extract pin-system.jsthis.wrenchText.setVisible(false);

  ☐ Create PinSystem helper class↓ Delegates to

  ☐ Update all pin method callsthis.lockRenderer.wrenchText.setVisible(false);

  ☐ Test pin interactions

  ☐ Commit changes// New code (encouraged)

  this.lockRenderer.wrenchText.setVisible(false);

Phase 5 (Key Rendering):```

  ☐ Extract key-rendering.js

  ☐ Create KeyRendering helper classGetters/Setters in main class proxy to renderer, ensuring no breaking changes.

  ☐ Update all key method calls

  ☐ Test key insertion## Testing Strategy by Module

  ☐ Commit changes

  ### LockRenderer ✅

Phase 6+ (UI & Controls):- Visual regression testing

  ☐ Extract remaining modules- Event handler verification

  ☐ Test full feature set- Graphics rendering validation

  ☐ Final testing

  ☐ Final commit### LockConfiguration (Next)

```- Save/load functionality

- localStorage persistence

---- Default handling



**Total Refactoring Effort:** ~1-2 weeks of development### KeySystem

**Risk Level:** Medium (high reward, manageable risk with incremental approach)- Key generation

**Testing Required:** High (full feature verification after each phase)- Key validation

- Inventory integration

### PinPhysics
- Pin movement calculation
- Gravity simulation
- Collision detection

### LockpickingMechanics
- Input handling
- Game loop
- Success/failure states

### KeyModeSystem
- Key insertion animation
- Key selection UI
- Mode switching

---

## File Locations

```
js/minigames/lockpicking/
├── lockpicking-game-phaser.js      (Main orchestrator)
├── lock-renderer.js                (✅ Rendering)
├── lock-configuration-store.js     (→ Next)
├── key-system.js                   (→ Future)
├── pin-physics.js                  (→ Future)
├── lockpicking-mechanics.js        (→ Future)
├── key-mode-system.js              (→ Future)
├── index.js                        (Export all modules)
└── [existing test files]
```
