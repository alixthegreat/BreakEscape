# Complete Function Inventory - All 78 Functions

## Summary

**Total Functions:** 78
**File:** `js/minigames/lockpicking/lockpicking-game-phaser.js`
**File Size:** 4,669 lines

---

## All Functions by Category (Planned Refactoring Phases)

### Phase 1: Lock Configuration (6 functions)
Lines 100-205 | Lock state persistence

```
1. saveLockConfiguration         (100-125)
2. getLockPinConfiguration       (128-141)
3. loadLockConfiguration         (143-151)
4. clearLockConfiguration        (153-170)
5. clearAllLockConfigurations    (172-184)
6. resetPinsToOriginalPositions  (186-205)
```

### Phase 2: Lock Graphics (3 functions)
Lines 465-778 | Visual rendering of lock

```
7.  createLockBackground         (465-485)
8.  createTensionWrench          (487-621)
9.  createHookPick               (623-778)
```

### Phase 3: Key Data Generator (8 functions)
Lines 780-918 | Key creation and calculations

```
10. generateKeyDataFromPins      (780-821)
11. createKeyFromPinSizes        (823-843)
12. generateRandomKey            (845-858)
13. createKeysFromInventory      (860-891)
14. createKeysForChallenge       (893-918)
15. startWithKeySelection        (920-934)
16. createKeySelectionUI         (957-1044)
17. createKeyVisual              (1046-1094)
```

### Phase 4: Pin System (13 functions)
Lines 2904-3233 | Pin creation, physics, state

```
18. createPins                   (2904-3195)
19. createShearLine              (3197-3233)
20. liftPin                       (3488-3758)  [Input handling]
21. applyGravity                 (3760-3857)
22. checkAllPinsCorrect          (3859-3912)
23. checkPinSet                  (3914-4095)
24. shouldPinBind                (4097-4108)
25. updateBindingPins            (4110-4157)
26. resetAllPins                 (4159-4208)
27. updatePinHighlighting        (2817-2844)
28. updatePinVisuals             (2846-2902)
29. liftCollidedPin              (2797-2815)
30. checkHookCollisions          (2695-2793)
```

### Phase 5: Key Rendering (17 functions)
Lines 1176-2298 | Key visual generation and rendering

```
31. createKey                    (1176-1282)
32. drawKeyWithRenderTexture     (1284-1332)
33. drawKeyBladeAsSolidShape     (1334-1441)
34. addTriangularSectionToPath   (1443-1466)
35. addFirstCutPeakToPath        (1468-1500)
36. addTriangularPeakToPath      (1502-1531)
37. addPointedTipToPath          (1533-1567)
38. addRightPointingTriangleToPath (1569-1612)
39. drawCircleAsPolygon          (1614-1629)
40. drawPixelArtCircleToGraphics (1631-1658)
41. generateKeyPolygonPoints     (2224-2298)
42. addTriangularPeakToPoints    (2326-2348)
43. addPointedTipToPoints        (2350-2376)
44. getTriangularSectionHeightAtX (2380-2466)
45. getTriangularSectionHeightAsKeyMoves (2468-2524)
46. getKeySurfaceHeightAtPosition (2565-2581)
47. findVerticalIntersection     (2300-2324)
```

### Phase 6: Key Selection UI (4 functions)
Lines 1098-1174 | Key selection interface

```
48. selectKey                    (1098-1148)
49. showWrongKeyFeedback         (1150-1161)
50. flashLockRed                 (1163-1174)
51. createKeyBladeCollision      (2526-2563)
```

### Phase 7: Input Handlers (4 functions)
Lines 3235-3758 | User input and interaction

```
52. setupInputHandlers           (3235-3458)
53. liftPin                       (3488-3758)  [Already in Pin System]
54. updateHookPosition           (2601-2662)
55. returnHookToStart            (2664-2693)
```

### Phase 8: Completion Handler (2 functions)
Lines 3859-4212 | Lock picking completion logic

```
56. checkAllPinsCorrect          (3859-3912)  [Already in Pin System]
57. lockPickingSuccess           (4214-4465)
```

### Phase 9: UI Elements (6 functions)
Lines 207-330 | Buttons, labels, display setup

```
58. init                         (207-267)
59. createLockableItemDisplay    (269-330)
60. updateFeedback               (4210-4212)
61. hideLockpickingTools         (2583-2599)
62. showLockpickingTools         (4583-4599)
63. setupPhaserGame              (332-461)
```

### Phase 10: Mode Switching (2 functions)
Lines 4532-4669 | Switch between pick and key mode

```
64. switchToPickMode             (4532-4581)
65. switchToKeyMode              (4601-4669)
```

### Phase 11: Key Insertion & Animation (5 functions)
Lines 1662-2133 | Key insertion and movement

```
66. startKeyInsertion            (1662-1713)
67. updateKeyPosition            (1715-1730)
68. checkKeyCorrectness          (1732-1802)
69. snapPinsToExactPositions     (1804-1871)
70. startKeyRotationAnimationWithChamberHoles (1873-2093)
71. liftPinsWithKey              (2099-2133)
72. updatePinsWithKeyInsertion   (2135-2198)
73. getKeySurfaceHeightAtPinPosition (2200-2222)
```

### Phase 12: Utilities & Other (7 functions)
Lines 4491-4670 | Helper functions and lifecycle

```
74. shuffleArray                 (4491-4497)
75. flashWrenchRed               (4499-4530)
76. start                        (4467-4473)
77. complete                     (4475-4481)
78. cleanup                      (4483-4489)
79. update                       (3460-3486)  [Main update loop]
```

---

## Function Coverage Analysis

### By Phase

| Phase | Name | Count | Lines | Coverage |
|-------|------|-------|-------|----------|
| 1 | Lock Configuration | 6 | 106 | 2.3% |
| 2 | Lock Graphics | 3 | 314 | 6.7% |
| 3 | Key Data Generator | 8 | 139 | 3.0% |
| 4 | Pin System | 13 | 329 | 7.0% |
| 5 | Key Rendering | 17 | 1,122 | 24% |
| 6 | Key Selection UI | 4 | 48 | 1.0% |
| 7 | Input Handlers | 4 | 224 | 4.8% |
| 8 | Completion Handler | 2 | 252 | 5.4% |
| 9 | UI Elements | 6 | 255 | 5.5% |
| 10 | Mode Switching | 2 | 138 | 3.0% |
| 11 | Key Insertion | 8 | 471 | 10% |
| 12 | Utilities | 7 | 207 | 4.4% |
| **TOTAL** | | **78** | **4,669** | **100%** |

---

## Function Quick Reference

### All 78 Functions (Alphabetical)

```
1.  addFirstCutPeakToPath
2.  addPointedTipToPath
3.  addPointedTipToPoints
4.  addRightPointingTriangleToPath
5.  addTriangularPeakToPath
6.  addTriangularPeakToPoints
7.  addTriangularSectionToPath
8.  applyGravity
9.  checkAllPinsCorrect
10. checkHookCollisions
11. checkKeyCorrectness
12. checkPinSet
13. cleanup
14. clearAllLockConfigurations
15. clearLockConfiguration
16. complete
17. constructor
18. createKey
19. createKeyBladeCollision
20. createKeyFromPinSizes
21. createKeySelectionUI
22. createKeyVisual
23. createKeysForChallenge
24. createKeysFromInventory
25. createLockableItemDisplay
26. createLockBackground
27. createPins
28. createShearLine
29. createTensionWrench
30. createHookPick
31. drawCircleAsPolygon
32. drawKeyBladeAsSolidShape
33. drawKeyWithRenderTexture
34. drawPixelArtCircleToGraphics
35. findVerticalIntersection
36. flashLockRed
37. flashWrenchRed
38. generateKeyDataFromPins
39. generateKeyPolygonPoints
40. generateRandomKey
41. getLockPinConfiguration
42. getKeySurfaceHeightAtPinPosition
43. getKeySurfaceHeightAtPosition
44. getTriangularSectionHeightAsKeyMoves
45. getTriangularSectionHeightAtX
46. hideLockpickingTools
47. init
48. liftCollidedPin
49. liftPin
50. liftPinsWithKey
51. loadLockConfiguration
52. lockPickingSuccess
53. resetAllPins
54. resetPinsToOriginalPositions
55. returnHookToStart
56. saveLockConfiguration
57. selectKey
58. setupInputHandlers
59. setupPhaserGame
60. shouldPinBind
61. showLockpickingTools
62. showWrongKeyFeedback
63. shuffleArray
64. snapPinsToExactPositions
65. start
66. startKeyInsertion
67. startKeyRotationAnimationWithChamberHoles
68. startWithKeySelection
69. switchToKeyMode
70. switchToPickMode
71. update
72. updateBindingPins
73. updateFeedback
74. updateHookPosition
75. updateKeyPosition
76. updatePinHighlighting
77. updatePinVisuals
78. updatePinsWithKeyInsertion
```

---

## Verification Checklist

Use this to verify nothing is missed in refactoring:

- [ ] Phase 1: 6 functions accounted for
- [ ] Phase 2: 3 functions accounted for
- [ ] Phase 3: 8 functions accounted for
- [ ] Phase 4: 13 functions accounted for
- [ ] Phase 5: 17 functions accounted for
- [ ] Phase 6: 4 functions accounted for
- [ ] Phase 7: 4 functions accounted for
- [ ] Phase 8: 2 functions accounted for
- [ ] Phase 9: 6 functions accounted for
- [ ] Phase 10: 2 functions accounted for
- [ ] Phase 11: 8 functions accounted for
- [ ] Phase 12: 7 functions accounted for
- [ ] **Total: 78 functions** ✓

---

## How to Use This List

### 1. Verify After Each Phase

After extracting a phase, verify the functions were moved:

```bash
# After Phase 1 extraction:
python3 scripts/list_js_functions.py --file js/minigames/lockpicking/lockpicking-game-phaser.js | grep -E "saveLockConfiguration|loadLockConfiguration|clearLockConfiguration"

# Should show 0 results if fully extracted
```

### 2. Generate List for Copy-Pasting

```bash
# Get copy-paste friendly list for command line:
python3 scripts/list_js_functions.py --file js/minigames/lockpicking/lockpicking-game-phaser.js --format copy-paste
```

### 3. Filter by Phase

```bash
# List functions with keyword:
python3 scripts/list_js_functions.py --file js/minigames/lockpicking/lockpicking-game-phaser.js --grep "Key" --format list

# Result: All functions with "Key" in name
```

### 4. Track Progress

Before refactoring: **78 functions**
After Phase 1: **78 - 6 = 72 remaining in main file**
After Phase 2: **72 - 3 = 69 remaining in main file**
... and so on

---

## Notes

- **Constructor:** Should remain in main class (line 5)
- **Update method:** Core Phaser method, keep in main class
- **Start/Complete/Cleanup:** Lifecycle methods, keep in main class
- Some functions (like `liftPin`) have multiple responsibilities and appear in multiple phases
- Line numbers are from current state of file (may shift during extraction)

---

## Generated With

`scripts/list_js_functions.py` - Simple script to list all JS functions

Usage:
```bash
python3 scripts/list_js_functions.py --file <file.js> --format <table|list|csv|copy-paste>
```
