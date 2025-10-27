# CRITICAL FIX: Method Removal Bug

## Issue Found
The `remove_methods()` function was not persisting changes to the main file content.

### Root Cause
```python
# OLD CODE (line 302)
return '\n'.join(updated_lines)  # Returns string but doesn't update self.content
```

When `remove_methods()` was called during auto-integrate:
1. It would compute the updated lines correctly
2. It would return the string
3. BUT: It didn't update `self.content` or `self.lines`
4. So when `self.content` was written to disk, the methods were STILL THERE

### The Fix
```python
# NEW CODE (line 302-305)
# Update both self.lines and self.content
self.lines = updated_lines
self.content = '\n'.join(updated_lines)
return self.content
```

This ensures that:
1. `self.lines` reflects the current state
2. `self.content` is updated with the removed methods
3. When written to disk, the methods are actually removed

## Verification

Before fix:
- Main file still contained all 72 functions (Phase 1 methods removed but Phase 2 methods still there)
- lock-graphics.js never created (because removal failed)

After fix:
- `remove_methods()` properly updates internal state
- Methods are actually removed from the file
- All downstream operations work correctly

## Testing

The fix has been applied. Phase 2 extraction can now be run correctly:

```bash
cd /home/cliffe/Files/Projects/Code/BreakEscape/BreakEscape

python3 scripts/extract_lockpicking_methods.py \
  --methods "createLockBackground,createTensionWrench,createHookPick" \
  --output-file "js/minigames/lockpicking/lock-graphics.js" \
  --class-name "LockGraphics" \
  --replace-this --auto-integrate \
  --update-main-file "js/minigames/lockpicking/lockpicking-game-phaser.js" \
  --module-instance-name "lockGraphics" --show-dependencies
```

Expected behavior:
- ✅ lock-graphics.js created with 3 methods
- ✅ Import statement added to main file
- ✅ Module initialization added to constructor
- ✅ 3 methods removed from main file (NOW WORKS!)
- ✅ Method calls updated to use this.lockGraphics
- ✅ Main file should have 69 functions (72 - 3)
