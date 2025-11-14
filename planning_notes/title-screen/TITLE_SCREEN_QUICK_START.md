# Title Screen Implementation Quick Start

## ✅ What Was Created

### 1. **Title Screen Minigame** (`js/minigames/title-screen/title-screen-minigame.js`)
```
┌─────────────────────────────────────────┐
│                                         │
│          BreakEscape                    │  ← Green glowing title
│          (pulsing effect)               │
│                                         │
│     Educational Security Game          │  ← Subtitle
│                                         │
│          Loading...                     │  ← Animated dots
│                                         │
└─────────────────────────────────────────┘
```

### 2. **CSS Styling** (`css/title-screen.css`)
- Green glowing effect with text-shadow
- Pulse animation on the title
- Full-screen dark background (#1a1a1a)
- Monospace font for tech aesthetic

### 3. **Integration Points**
- ✅ Registered in minigames framework
- ✅ Auto-launches during game create() phase
- ✅ Auto-closes when next minigame starts
- ✅ Canvas remains hidden until title screen closes

## 🚀 How to Use

### In Scenario JSON:
```json
{
    "showTitleScreen": true,
    "scenario_brief": "Your mission...",
    ...
}
```

### Or disable it:
```json
{
    "showTitleScreen": false,
    ...
}
```

### Or via JavaScript:
```javascript
window.startTitleScreenMinigame({
    autoCloseTimeout: 5000  // Custom timeout in ms
});
```

## 🔄 Flow Diagram

```
┌─────────────────────────────────────────┐
│  Game create() phase                    │
│  - Load scenario JSON ✓                 │
│  - Initialize rooms (hidden) ✓          │
│  - Set up player/camera ✓               │
└──────────────────────────────────────────┘
                    ↓
    Check: showTitleScreen === true?
                    ↓
        ┌───────────────────────┐
        │  Hide canvas/inventory│
        │  Start title screen   │
        └───────────────────────┘
                    ↓
        User waits 3 seconds OR
        next minigame starts
                    ↓
        ┌───────────────────────┐
        │ Close title screen    │
        │ Show canvas/inventory │
        │ Continue to next scene│
        └───────────────────────┘
```

## 📝 Files Modified

1. `js/minigames/index.js` - Register title screen
2. `js/core/game.js` - Launch title screen during create()
3. `js/minigames/framework/minigame-manager.js` - Auto-show canvas on transition

## 🧪 Test It

```bash
# Start server
cd /path/to/BreakEscape
python3 -m http.server 8000

# Visit with title screen scenario
http://localhost:8000/index.html?scenario=title-screen-demo
```

You should see the BreakEscape title appear immediately, then transition to the game!

## 💡 Future Customization Ideas

The title screen is fully customizable. Modify in `title-screen-minigame.js`:

```javascript
// Change content in init()
this.container.innerHTML = `
    <div class="title-screen-container">
        <div class="title-screen-title">BreakEscape</div>
        <div class="title-screen-subtitle">Custom subtitle here</div>
        <div class="title-screen-custom">Add any content!</div>
    </div>
`;
```

Or add scenario-specific styling:
```json
{
    "titleScreenConfig": {
        "title": "Custom Title",
        "subtitle": "Custom Subtitle",
        "backgroundColor": "#000033"
    }
}
```

Then enhance the minigame to use these settings!
