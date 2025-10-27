# Quick Start - Lockpicking Minigame Refactoring

## TL;DR

We've built a **Python tool that extracts methods from your monolithic lockpicking minigame** into separate, focused modules. The tool copies code exactly as-is without modifications.

### In 30 Seconds

```bash
# 1. Extract lock configuration methods
cd /home/cliffe/Files/Projects/Code/BreakEscape/BreakEscape

python3 scripts/extract_lockpicking_methods.py \
  --methods "saveLockConfiguration,loadLockConfiguration,clearLockConfiguration,getLockPinConfiguration,clearAllLockConfigurations,resetPinsToOriginalPositions" \
  --output-file "js/minigames/lockpicking/lock-configuration.js" \
  --object-mode

# ✅ Done! Check: ls -la js/minigames/lockpicking/lock-configuration.js
```

---

## What You Get

✅ **Extraction Tool** (`scripts/extract_lockpicking_methods.py`)
- Python 3 script with full CLI
- Extracts methods exactly as-is
- Auto-detects dependencies
- Generates class or object modules

✅ **Documentation** (4 guide files)
- `REFACTORING_PLAN.md` - Architecture overview
- `EXTRACTION_GUIDE.md` - Step-by-step instructions
- `MODULE_ARCHITECTURE.md` - Visual diagrams & flow
- `REFACTORING_SUMMARY.md` - This summary

✅ **Pre-Built Commands** - Copy-paste ready for each phase

---

## 5-Minute Walkthrough

### Step 1: Understand the Current State
```
🔴 BEFORE: lockpicking-game-phaser.js (4670 lines, 1 class)
   - Everything in one file
   - 50+ methods mixed together
   - Hard to test, maintain, reuse
```

### Step 2: View the Tool
```bash
python3 scripts/extract_lockpicking_methods.py --help
```

### Step 3: See What's Available
```bash
# Show dependencies for lock configuration methods
python3 scripts/extract_lockpicking_methods.py \
  --methods "saveLockConfiguration,loadLockConfiguration" \
  --output-file "test.js" \
  --object-mode \
  --show-dependencies

# Output shows:
# ✓ Extracted: saveLockConfiguration
# ✓ Extracted: loadLockConfiguration
# ⚠️  Dependencies (builtin, can ignore): getItem, setItem, parse
```

### Step 4: Run Your First Extraction
```bash
# Extract lock configuration into its own module
python3 scripts/extract_lockpicking_methods.py \
  --methods "saveLockConfiguration,loadLockConfiguration,clearLockConfiguration" \
  --output-file "js/minigames/lockpicking/lock-configuration.js" \
  --object-mode

# Check the result
cat js/minigames/lockpicking/lock-configuration.js
```

### Step 5: Test the Game
```bash
# Start local server
python3 -m http.server 8000

# Open browser to http://localhost:8000/scenario_select.html
# Play the game - verify nothing broke
```

---

## The Extraction Process

### Anatomy of an Extraction Command

```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "method1,method2,method3"          # ← Methods to extract
  --output-file "output.js"                    # ← Where to save
  --class-name "MyClassName"                   # ← Optional: custom class name
  --object-mode                                # ← Optional: export as object
  --show-dependencies                          # ← Optional: show dependencies
```

### What It Does

1. **Reads** the source file
2. **Finds** each method by name
3. **Extracts** the complete method code (with all { } braces)
4. **Detects** which other methods are called (dependencies)
5. **Generates** a new JS file with the methods
6. **Reports** what was found and any warnings

### Example Output

```
📂 Reading: js/minigames/lockpicking/lockpicking-game-phaser.js

📋 Extracting 3 methods...
✓ Extracted: createLockBackground
✓ Extracted: createTensionWrench
✓ Extracted: createHookPick

⚠️  Dependencies (methods called but not extracted):
   - updatePinVisuals
   - this.scene.add.graphics()

🔨 Generating module: LockGraphics

✅ Success! Created: js/minigames/lockpicking/lock-graphics.js
   Lines of code: 247
```

---

## Recommended First Extraction (Phase 1)

### Why This Module First?
- ✅ Pure data persistence (no complex dependencies)
- ✅ No Phaser graphics code
- ✅ Easy to test independently
- ✅ Safe to extract first

### The Command
```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "saveLockConfiguration,loadLockConfiguration,clearLockConfiguration,getLockPinConfiguration,clearAllLockConfigurations,resetPinsToOriginalPositions" \
  --output-file "js/minigames/lockpicking/lock-configuration.js" \
  --object-mode \
  --show-dependencies
```

### What Gets Created
```javascript
// js/minigames/lockpicking/lock-configuration.js
export const LockConfiguration = {
    saveLockConfiguration() { ... },
    loadLockConfiguration() { ... },
    clearLockConfiguration() { ... },
    // ... 3 more methods ...
};
```

### Next Steps After Extraction
1. Remove those 6 methods from `lockpicking-game-phaser.js`
2. Add this import to `lockpicking-game-phaser.js`:
   ```javascript
   import { LockConfiguration } from './lock-configuration.js';
   ```
3. Test the game still works
4. Commit to git

---

## All Available Extraction Phases

Quick reference for all 11 extraction phases:

| Phase | Module | Methods | Command |
|-------|--------|---------|---------|
| 1 | Lock Configuration | 6 | See above ↑ |
| 2 | Lock Graphics | 3 | `EXTRACTION_GUIDE.md` line 78 |
| 3 | Key Data Generator | 8 | `EXTRACTION_GUIDE.md` line 105 |
| 4 | Pin System | 10 | `EXTRACTION_GUIDE.md` line 137 |
| 5 | Key Rendering | 10 | `EXTRACTION_GUIDE.md` line 169 |
| 6 | Key Selection UI | 7 | `EXTRACTION_GUIDE.md` line 202 |
| 7 | Input Handlers | 5 | `EXTRACTION_GUIDE.md` line 229 |
| 8 | Completion | 3 | `EXTRACTION_GUIDE.md` line 256 |
| 9 | UI Elements | 6 | `EXTRACTION_GUIDE.md` line 281 |
| 10 | Mode Switching | 4 | `EXTRACTION_GUIDE.md` line 307 |
| 11 | Utilities | 8 | `EXTRACTION_GUIDE.md` line 332 |

---

## Common Questions

### Q: Will this break my game?
**A:** No, the extraction tool copies code exactly as-is. The method code itself doesn't change. You just need to update imports in the main file after extracting.

### Q: Can I extract multiple modules at once?
**A:** No, extract one module at a time and test. This lets you catch issues early and roll back if needed.

### Q: What if I extract wrong methods?
**A:** No problem! Just delete the generated file and try again. The tool doesn't modify the source file.

### Q: How long does extraction take?
**A:** Seconds. The tool runs in < 1 second.

### Q: Do I need to understand all the code first?
**A:** No! The tool extracts exactly what you ask for. Just follow the predefined phases in the guide.

### Q: Can I undo an extraction?
**A:** Yes:
```bash
git checkout -- .  # Undo all changes
rm js/minigames/lockpicking/new-module.js  # Delete extracted file
```

---

## Troubleshooting in 60 Seconds

### Error: "Method not found"
```
❌ Method 'createLockBackground' not found
```
**Fix:** Check spelling (case-sensitive). Run command from workspace root.

### Error: "No methods extracted"
**Fix:** Try one method first: `--methods "saveLockConfiguration"`

### Game broke after extraction
**Fix:** 
1. Check browser console (F12)
2. Look for import errors
3. Verify method calls updated in main class
4. Revert: `git checkout -- .`

### Don't know what dependencies mean
**Fix:** It's OK if you don't. Just follow the pre-built commands in the guide. Dependencies are just informational.

---

## Success Criteria

**Phase 1 is successful when:**
```
✓ lock-configuration.js created
✓ Game loads without errors
✓ No console errors in browser DevTools
✓ Lock state persists when interacting with game
✓ Changes committed to git
```

**All phases complete when:**
```
✓ All 12 modules created and working
✓ Main class down from 4670 → ~1500 lines
✓ Game plays from start to finish
✓ All features working identically to before
```

---

## File Structure After Refactoring

```
Current (1 file):
js/minigames/lockpicking/
└── lockpicking-game-phaser.js (4670 LOC)

After Refactoring (12 files):
js/minigames/lockpicking/
├── lockpicking-game-phaser.js (1500 LOC) ← Main orchestrator
├── lock-configuration.js
├── lock-graphics.js
├── key-data-generator.js
├── pin-system.js
├── key-rendering.js
├── key-selection-ui.js
├── input-handlers.js
├── completion.js
├── ui-elements.js
├── mode-switching.js
└── utilities.js
```

---

## Next Steps

### RIGHT NOW (5 minutes)
1. ✅ Read this file (you're doing it!)
2. ⬜ Read `REFACTORING_SUMMARY.md` for overview
3. ⬜ Run Phase 1 extraction command above

### TODAY (30 minutes)
1. ⬜ Complete Phase 1 extraction
2. ⬜ Test game still works
3. ⬜ Commit to git
4. ⬜ Review `EXTRACTION_GUIDE.md` for next phase

### THIS WEEK (ongoing)
1. ⬜ Work through Phases 2-5 (test after each)
2. ⬜ Major milestones at Phase 4 & 5
3. ⬜ Complete remaining phases 6-11

---

## Documentation Reference

| Document | Purpose | Read Time |
|----------|---------|-----------|
| This file | Quick start | 5 min |
| `REFACTORING_SUMMARY.md` | Executive summary | 10 min |
| `REFACTORING_PLAN.md` | Architecture & phases | 15 min |
| `EXTRACTION_GUIDE.md` | Step-by-step instructions | 20 min |
| `MODULE_ARCHITECTURE.md` | Diagrams & flow | 15 min |

**Total:** ~65 minutes to fully understand the project

---

## Tool Cheat Sheet

```bash
# Show help
python3 scripts/extract_lockpicking_methods.py --help

# Extract with defaults (auto-generates class name)
python3 scripts/extract_lockpicking_methods.py \
  --methods "method1,method2" \
  --output-file "output.js"

# Extract as object (for utilities)
python3 scripts/extract_lockpicking_methods.py \
  --methods "method1,method2" \
  --output-file "output.js" \
  --object-mode

# Show what would be extracted (with dependencies)
python3 scripts/extract_lockpicking_methods.py \
  --methods "method1,method2" \
  --output-file "output.js" \
  --show-dependencies

# Extract with custom class name
python3 scripts/extract_lockpicking_methods.py \
  --methods "method1,method2" \
  --output-file "output.js" \
  --class-name "MyCustomClass"

# Extract with parent class
python3 scripts/extract_lockpicking_methods.py \
  --methods "method1,method2" \
  --output-file "output.js" \
  --extends "MinigameScene"
```

---

## Ready?

**Start here:**
```bash
cd /home/cliffe/Files/Projects/Code/BreakEscape/BreakEscape

python3 scripts/extract_lockpicking_methods.py \
  --methods "saveLockConfiguration,loadLockConfiguration,clearLockConfiguration,getLockPinConfiguration,clearAllLockConfigurations,resetPinsToOriginalPositions" \
  --output-file "js/minigames/lockpicking/lock-configuration.js" \
  --object-mode --show-dependencies
```

Then read: `EXTRACTION_GUIDE.md` → Post-Extraction Workflow section

**Questions?** Check `EXTRACTION_GUIDE.md` → Troubleshooting section

---

**Happy refactoring! 🚀**
