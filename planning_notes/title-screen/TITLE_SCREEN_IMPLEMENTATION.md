# Title Screen Minigame Implementation

## Overview
A simple title screen minigame has been created to display before the main game loads. It shows a "BreakEscape" title with a loading indicator, then automatically closes when the next minigame (such as mission brief or dialog) starts.

## Files Created/Modified

### New Files
1. **`js/minigames/title-screen/title-screen-minigame.js`**
   - Main title screen minigame class
   - Extends `MinigameScene` base class
   - Auto-closes after 3 seconds (configurable)
   - Has a helper function `startTitleScreenMinigame()` for easy access

2. **`css/title-screen.css`**
   - Styling for the title screen
   - Features a green glowing "BreakEscape" title with pulse animation
   - Displays "Loading..." with an animated dot effect
   - Full-screen dark background overlay

3. **`scenarios/title-screen-demo.json`**
   - Example scenario with `showTitleScreen: true` flag
   - Demonstrates how to enable the title screen in scenarios

### Modified Files
1. **`js/minigames/index.js`**
   - Added import for `TitleScreenMinigame` class
   - Registered the title screen as `'title-screen'` minigame type
   - Added `startTitleScreenMinigame` to global window object

2. **`js/core/game.js`**
   - Added title screen launch in the `create()` function after camera setup
   - Checks `gameScenario.showTitleScreen` flag (defaults to true, set to false to disable)
   - Hides canvas and inventory before showing title screen
   - Canvas/inventory are restored when transitioning to next minigame

3. **`js/minigames/framework/minigame-manager.js`**
   - Enhanced `startMinigame()` to detect transitions from title screen
   - Automatically shows canvas when transitioning from title screen to another minigame
   - Shows inventory container when exiting title screen

## Features

### Title Screen Display
- Shows "BreakEscape" title in green with glow effect
- Displays "Educational Security Game" subtitle
- Shows "Loading..." with animated dots
- Full-screen dark background (no game visible behind it)

### Auto-Close Behavior
- Automatically closes after 3 seconds if no other minigame starts
- Automatically closes when another minigame launches (e.g., mission brief)
- Can be customized via `autoCloseTimeout` parameter

### Scenario Integration
Add to any scenario JSON to enable:
```json
{
    "showTitleScreen": true,
    "scenario_brief": "Your mission...",
    ...
}
```

Or disable for a scenario:
```json
{
    "showTitleScreen": false,
    ...
}
```

## Testing

To test the title screen:
1. Navigate to `http://localhost:8000/index.html?scenario=title-screen-demo`
2. You should see the title screen display immediately before the game loads
3. The title screen will auto-close and display the mission brief

Or use the scenario selector at `scenario_select.html` and choose "title-screen-demo"

## Future Enhancements

The title screen can be easily expanded with:
- Custom artwork/animations
- Story introduction text
- Button prompts ("Press to Continue")
- Progress/loading information
- Sound effects
- Custom colors/styling per scenario

Just modify the HTML generation in `titleScreenMinigame.js` init() method or extend the CSS.

## How It Works

**Execution Flow:**
1. Game preload phase loads all assets
2. Game create() phase initializes rooms (but keeps canvas hidden during title screen launch)
3. After camera is set up, `create()` checks `gameScenario.showTitleScreen`
4. If true, canvas is hidden and title screen minigame starts
5. Next minigame (mission brief, dialog, etc.) automatically closes title screen
6. Canvas and inventory are shown when title screen closes
7. Game loop continues normally with visible canvas

**Key:** The room exists and is ready, but rendering is hidden until after the title screen.
