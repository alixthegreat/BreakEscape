# Title Screen Update: Overlay Mode

## Change Summary

The title screen now displays as a **popup overlay** on top of the game canvas, instead of hiding the canvas entirely.

### What Changed

**Before:**
```
Canvas → HIDDEN
Title Screen → Full Screen
Player sees only the title screen
```

**After:**
```
Canvas → VISIBLE in background
Title Screen → Popup overlay on top
Player can see the game loading behind the title screen
```

### Visual Effect

```
┌────────────────────────────────────────────────────┐
│ Game Canvas (slightly dimmed, visible behind)      │
│                                                    │
│     ┌──────────────────────────────────────┐      │
│     │  🎬 Title Screen Overlay 🎬         │      │
│     │                                      │      │
│     │       BreakEscape                    │      │
│     │   Educational Security Game         │      │
│     │                                      │      │
│     │        Loading...                    │      │
│     │                                      │      │
│     └──────────────────────────────────────┘      │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Implementation Details

**Files Modified:**

1. **`js/core/game.js`**
   - Removed canvas.style.display = 'none'
   - Removed inventory hiding
   - Now just starts the title screen without hiding anything

2. **`js/minigames/title-screen/title-screen-minigame.js`**
   - Changed `hideGameDuringMinigame: true` → `false`
   - Background remains semi-transparent via container overlay (rgba 0.95)

3. **`css/title-screen.css`**
   - Changed `.title-screen-container` background from `#1a1a1a` to `transparent`
   - Let the container's background handle the dimming effect

4. **`js/minigames/framework/minigame-manager.js`**
   - Removed canvas show/hide logic on title screen transitions
   - Simplified since canvas is never hidden

### Benefits

✅ **Better Visual Feedback:** Players can see the game loading  
✅ **No Jarring Transition:** Game doesn't suddenly appear  
✅ **More Professional:** Looks like a smooth modal  
✅ **Same Auto-Close Behavior:** Still closes after 3 seconds or when next minigame starts  
✅ **Canvas Always Ready:** Game is rendering in the background  

### Testing

Visit: `http://localhost:8000/index.html?scenario=title-screen-demo`

You should see:
1. Game canvas loads and starts rendering
2. Title screen popup appears on top (semi-transparent background)
3. Game visible but slightly dimmed behind
4. After 3 seconds, title screen closes
5. Mission brief appears (next minigame)
6. Game becomes fully interactive

### Configuration

No changes needed! Just use as before:

```json
{
    "showTitleScreen": true,
    ...
}
```

The title screen now automatically displays as an overlay without hiding the canvas!
