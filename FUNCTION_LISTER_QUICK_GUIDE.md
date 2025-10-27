# Function Lister Quick Guide

Simple tool to list all JavaScript functions in any file and verify coverage during refactoring.

## Quick Commands

### See all functions
```bash
python3 scripts/list_js_functions.py --file js/minigames/lockpicking/lockpicking-game-phaser.js
```

### Different formats

```bash
# Table format (default)
python3 scripts/list_js_functions.py --file <file.js> --format table

# Simple list
python3 scripts/list_js_functions.py --file <file.js> --format list

# CSV for Excel/Sheets
python3 scripts/list_js_functions.py --file <file.js> --format csv

# Copy-paste friendly (for command line)
python3 scripts/list_js_functions.py --file <file.js> --format copy-paste
```

### Filter by name

```bash
# All functions with "Key" in name
python3 scripts/list_js_functions.py --file <file.js> --grep "Key"

# All functions with "Pin" in name
python3 scripts/list_js_functions.py --file <file.js> --grep "Pin"

# Just count
python3 scripts/list_js_functions.py --file <file.js> --count
```

## Usage During Refactoring

### Before Phase 1 - Get baseline

```bash
# Get current count
python3 scripts/list_js_functions.py --file js/minigames/lockpicking/lockpicking-game-phaser.js --count
# Result: 78 functions
```

### After Phase 1 - Verify extraction

```bash
# Check Phase 1 functions were removed from main file
python3 scripts/list_js_functions.py --file js/minigames/lockpicking/lockpicking-game-phaser.js --count
# Result: Should be 72 functions (78 - 6 removed)

# Check Phase 1 functions exist in new file
python3 scripts/list_js_functions.py --file js/minigames/lockpicking/lock-configuration.js --count
# Result: Should be 6 functions
```

### After Phase 2 - Continuing

```bash
# Check remaining functions in main file
python3 scripts/list_js_functions.py --file js/minigames/lockpicking/lockpicking-game-phaser.js --count
# Result: Should be 69 functions (72 - 3 removed)
```

## Verification Workflow

```bash
# 1. Before extraction - see what's there
python3 scripts/list_js_functions.py --file main.js --format list

# 2. Run extraction command (with --auto-integrate)
python3 scripts/extract_lockpicking_methods.py --methods "..." --auto-integrate ...

# 3. Verify extraction
python3 scripts/list_js_functions.py --file main.js --count
# Should show original count minus extracted functions

# 4. Verify new module
python3 scripts/list_js_functions.py --file new-module.js --count
# Should show number of extracted functions

# 5. Commit
git add .
git commit -m "Phase N: Module extraction"
```

## Phase Progress Tracker

Use this to track progress through all 12 phases:

```
Phase 1: saveLockConfiguration + 5 others (6 total)
  Before: python3 scripts/list_js_functions.py --file lockpicking-game-phaser.js --count
  After main: Should show -6
  After module: python3 scripts/list_js_functions.py --file lock-configuration.js --count → 6

Phase 2: createLockBackground + 2 others (3 total)
  Before: python3 scripts/list_js_functions.py --file lockpicking-game-phaser.js --count
  After main: Should show -3
  After module: python3 scripts/list_js_functions.py --file lock-graphics.js --count → 3

... repeat for all 12 phases
```

## Example: Filtering Functions

```bash
# Get all Key-related functions
python3 scripts/list_js_functions.py --file js/minigames/lockpicking/lockpicking-game-phaser.js --grep "Key" --format list

# Result:
# 1. createKeyFromPinSizes (823-843)
# 2. generateRandomKey (845-858)
# 3. createKeysFromInventory (860-891)
# 4. createKeysForChallenge (893-918)
# ... etc

# Get all Pin-related functions
python3 scripts/list_js_functions.py --file js/minigames/lockpicking/lockpicking-game-phaser.js --grep "Pin" --format list
```

## Output Formats

### Table (default)
```
┌─────────────────────────────────────┬──────────┬──────────┐
│ Function Name                       │ Start    │ End      │
├─────────────────────────────────────┼──────────┼──────────┤
│ saveLockConfiguration               │      100 │      125 │
│ loadLockConfiguration               │      143 │      151 │
└─────────────────────────────────────┴──────────┴──────────┘
```

### List
```
1. saveLockConfiguration             (lines   100-   125)
2. loadLockConfiguration             (lines   143-   151)
```

### CSV
```
Function Name,Start Line,End Line
"saveLockConfiguration",100,125
"loadLockConfiguration",143,151
```

### Copy-Paste
```
saveLockConfiguration,loadLockConfiguration,clearLockConfiguration,...
```

## Troubleshooting

### "File not found"
```bash
# Check file path
ls -la js/minigames/lockpicking/lockpicking-game-phaser.js

# Use correct path
python3 scripts/list_js_functions.py --file path/to/file.js
```

### No functions found
```bash
# Check file is JavaScript
file js/minigames/lockpicking/lockpicking-game-phaser.js

# Check file isn't corrupted
head -50 js/minigames/lockpicking/lockpicking-game-phaser.js
```

### Want to save output to file
```bash
# Save to file
python3 scripts/list_js_functions.py --file lockpicking-game-phaser.js --format list > functions.txt

# Then view
cat functions.txt
```

## Advanced: Comparing Before/After

```bash
# Before extraction
python3 scripts/list_js_functions.py --file main.js --format csv > before.csv

# ... do extraction ...

# After extraction
python3 scripts/list_js_functions.py --file main.js --format csv > after.csv

# Compare
diff before.csv after.csv
```

## Reference

- See `FUNCTION_INVENTORY.md` for complete list of all 78 functions
- See `REFACTORING_PLAN.md` for which functions go in each phase
- See `QUICKSTART_AUTO_INTEGRATION.md` for extraction commands
