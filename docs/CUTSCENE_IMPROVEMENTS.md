# Cut-Scene Improvements: hideGameDuringMinigame and canEscConversation

## Overview

Two new features have been added to BreakEscape to improve cut-scene presentation and player experience:

1. **hideGameDuringMinigame** - Hide the main game canvas while minigames (like person-chat conversations) are running
2. **canEscConversation** - Control whether players can press Esc to exit NPC conversations

These features are particularly useful for creating immersive opening cut-scenes that trigger at game start (delay: 0ms).

## Feature 1: hideGameDuringMinigame

### Problem
When a timed conversation is triggered with `delay: 0`, it starts immediately after the NPC is loaded. However, the main game is briefly visible before the person-chat minigame launches, breaking the immersion of a cut-scene.

### Solution
Set `hideGameDuringMinigame: true` in the scenario JSON to hide the main game canvas during minigames and show it again when the minigame exits.

### Usage

**Scenario-level (applies to all minigames):**
```json
{
  "scenario_brief": "My scenario",
  "startRoom": "intro_room",
  "hideGameDuringMinigame": true
}
```

**Minigame-level (overrides scenario setting for specific minigame):**
```javascript
window.MinigameFramework.startMinigame('person-chat', null, {
  npcId: 'director',
  hideGameDuringMinigame: true
});
```

### How It Works
1. **At startup:** If `hideGameDuringMinigame: true` is set on the scenario:
   - Canvas is hidden (`display: none`) in `game.js` create() BEFORE first room displays
   - Inventory container is also hidden (prevents UI from appearing during cut-scene)
2. **During minigames:** Both canvas and inventory container are hidden before minigame starts
3. **On exit:** When the minigame exits:
   - Canvas is shown again (`display: block`)
   - Inventory container is shown again
4. **Game state:** Game input remains disabled during the minigame to prevent player interaction; the game continues updating in the background

### Timing Details
The canvas AND inventory are hidden VERY early in game initialization:
- After scenario is loaded ✅
- After scenario validation ✅
- **BEFORE first room is created** ✅
- **BEFORE inventory renders** ✅
- **BEFORE any visuals render** ✅

This ensures zero flash of the main game or UI elements - players see a completely blank page until the minigame launches and fills the screen.

## Feature 2: canEscConversation

### Problem
For critical cut-scenes or story moments, you may want to prevent players from casually pressing Esc to exit the conversation. Some scenes should be mandatory viewing.

### Solution
Set `canEscConversation: false` on the NPC to disable the Escape key during that NPC's conversations AND hide the close button (×).

### Usage

**NPC-level setting:**
```json
{
  "id": "director",
  "displayName": "Mission Director",
  "npcType": "person",
  "canEscConversation": false,
  "storyPath": "scenarios/ink/director.json",
  "timedConversation": {
    "delay": 0,
    "targetKnot": "mission_briefing"
  }
}
```

**Default behavior:**
If not specified, `canEscConversation` defaults to `true` (players can press Esc and see the close button).

### How It Works
1. PersonChatMinigame checks the `canEscConversation` setting in `init()`
2. If `false`, the minigame is configured with `showCancel: false` to hide the close button (×)
3. The fallback Escape handler from the base MinigameScene is removed in `start()`
4. Players cannot press Esc to close
5. Players cannot click a close button (it's not shown)
6. Conversation can only be exited by completing the dialogue naturally
7. This creates a truly "locked" cut-scene that must be viewed to completion

## Complete Example: Opening Cut-Scene

```json
{
  "scenario_brief": "Corporate Espionage Mission",
  "startRoom": "safe_house",
  "hideGameDuringMinigame": true,
  
  "rooms": {
    "safe_house": {
      "type": "room_office",
      "npcs": [
        {
          "id": "handler",
          "displayName": "Handler",
          "npcType": "person",
          "position": { "x": 5, "y": 5 },
          "spriteSheet": "hacker",
          "storyPath": "scenarios/ink/handler.json",
          "canEscConversation": false,
          "currentKnot": "start",
          "timedConversation": {
            "delay": 0,
            "targetKnot": "mission_briefing",
            "background": "assets/backgrounds/briefing_room.png"
          }
        }
      ]
    }
  }
}
```

In this setup:
1. ✅ Game scenario loads
2. ✅ Main game canvas is hidden BEFORE first room displays (hideGameDuringMinigame: true)
3. ✅ Handler NPC is loaded
4. ✅ Timed conversation triggers immediately (delay: 0)
5. ✅ Person-chat minigame shows mission briefing at "mission_briefing" knot
6. ✅ Player cannot press Esc to skip (canEscConversation: false)
7. ✅ Close button (×) is hidden (canEscConversation: false)
8. ✅ Conversation must be completed naturally - no escape routes
9. ✅ Once conversation ends, canvas is shown again and game is playable

## Combining with Other Minigames

These features work with any minigame type:
- `person-chat` (NPC conversations)
- `notes` (mission briefs, readable documents)
- `container` (equipment/inventory management)
- Custom minigames that extend MinigameScene

Example with mission brief:
```json
{
  "id": "briefing_doc",
  "type": "notes",
  "name": "Mission Brief",
  "hideGameDuringMinigame": true,
  "readable": true,
  "text": "Your mission objectives are..."
}
```

## Technical Details

### Implementation Details
- Modified `js/core/game.js` - Hides canvas at startup if `hideGameDuringMinigame: true`
- Modified `js/minigames/framework/minigame-manager.js` - Hides/shows canvas during minigames
- Updated `js/minigames/person-chat/person-chat-minigame.js` - Hides buttons and Esc key when `canEscConversation: false`
- Modified `js/systems/npc-manager.js` - Passes flags during timed conversation startup

### Canvas & Inventory Manipulation
- **Early hiding:** In `game.js` create() function, both canvas and inventory container are hidden BEFORE room creation
- **Runtime hiding:** Canvas via `this.mainGameScene.game.canvas`, inventory via `document.getElementById('inventory-container')`
- **Visibility control:** Inline CSS: `element.style.display = 'none' | 'block'`
- **Game state:** Preserves game state; the Phaser game continues updating in the background
- **Clean UI:** No game elements visible while minigame is active

### Escape Key & Button Handling
- **Escape key:** Base MinigameScene sets fallback handler in `start()` method
- **Esc disabling:** PersonChatMinigame removes handler in its `start()` when `canEscConversation: false`
- **Close button (×):** Hidden via `closeBtn.style.display = 'none'` in PersonChatMinigame `init()`
- **Cancel button:** Hidden via `showCancel: false` parameter passed to base class
- **Result:** Creates completely "locked" cut-scene with no escape routes

## Testing

To test these features:

1. Load the test scenario: `scenarios/npc-sprite-test2.json`
2. Observe that:
   - Game canvas is hidden when person-chat minigame opens
   - Esc key does not work for the "Back NPC" (test_npc_back)
   - Close button (×) still works
   - Canvas reappears when conversation ends

## Browser Compatibility

These features use standard DOM APIs and CSS:
- `HTMLElement.style.display` - Widely supported
- `EventTarget.removeEventListener()` - Widely supported
- No polyfills required for modern browsers

## Performance Considerations

- Hiding the canvas (`display: none`) keeps the game running in the background
- The Phaser game continues to update, which maintains game state
- No memory overhead - just DOM style manipulation
- Ideal for scenarios with multiple cut-scenes

## Future Enhancements

Possible extensions to these features:
- `pauseGameDuringMinigame` - Pause Phaser update loop during minigames
- `hideUIElementsDuringMinigame` - Hide HUD elements like inventory
- `canClickExitDuringMinigame` - Control close button visibility
- `minigameOpacity` - Add fade-in/fade-out effects

