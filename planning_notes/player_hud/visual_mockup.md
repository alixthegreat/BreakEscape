# Player HUD Visual Mockup

## ASCII Layout Preview

### Full Screen Layout
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                               │
│                            GAME VIEWPORT                                      │
│                          (Phaser Canvas)                                      │
│                                                                               │
│                                                                               │
│                                                                               │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
┌────────┬──────────────────────────────────────────────────────────┬─────┬───┐
│ ┌────┐ │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐│┌───┐│   │
│ │ 👤 │ │ │ 🔑 │ │ 💊 │ │ 📄 │ │ 🔧 │ │ 📱 │ │ 💳 │ │ 🎫 │ │ ... ││ 👊││   │
│ │    │ │ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘││   ││   │
│ └────┘ │                  Inventory Slots (scrollable)             ││JAB││   │
│ Avatar │                                                            │└───┘│   │
│ 64x64  │                      Center Area                          │Punch│   │
└────────┴──────────────────────────────────────────────────────────┴─────┴───┘
   8px      Variable width (flex: 1)                                  72px  8px
```

### Dimensions
- **Total HUD Height**: 80px
- **HUD Padding**: 8px all around
- **Gap Between Elements**: 8px

---

## Component Specifications

### 1. Player Avatar Button (Left)

```
┌──────────────────┐
│   64px × 64px    │
│                  │
│   ┌──────────┐   │
│   │          │   │  ← Player headshot sprite
│   │    👤    │   │     (from *_headshot.png)
│   │          │   │
│   └──────────┘   │
│                  │
└──────────────────┘

States:
• Default:  border: 2px solid #666
• Hover:    border: 2px solid #0f0
• Active:   transform: translateY(1px)
```

**Tooltip on Hover:**
```
┌─────────────────────┐
│  Player Settings    │  ← Shows above button
└─────────────────────┘
        ▼
   ┌─────────┐
   │   👤    │
   └─────────┘
```

---

### 2. Inventory Display (Center)

```
┌────────────────────────────────────────────────────────────┐
│  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐  │
│  │ 🔑 │  │ 💊 │  │ 📄 │  │ 🔧 │  │ 📱 │  │ 💳 │  │ 🎫 │ ►│ ← Scroll indicator
│  │    │  │    │  │    │  │    │  │    │  │    │  │    │  │   (if overflow)
│  └────┘  └────┘  └────┘  └────┘  └────┘  └────┘  └────┘  │
│  48x48   48x48   48x48   48x48   48x48   48x48   48x48    │
└────────────────────────────────────────────────────────────┘
     ↑         ↑
     4px gap   border: 2px solid #444
```

**Inventory Slot States:**
```
Empty Slot          Item Present         Hovered Item
┌────────┐         ┌────────┐          ┌────────┐
│        │         │  🔑    │          │  💊    │
│        │         │        │          │        │
└────────┘         └────────┘          └────────┘
#222 bg            #222 bg             #888 border
#444 border        #444 border         
```

**With Tooltip:**
```
     ┌────────────────┐
     │  Health Potion │  ← Shows item name
     └────────────────┘
             ▼
        ┌────────┐
        │  💊    │
        └────────┘
```

---

### 3. Punch Type Toggle (Right)

#### Jab Mode (Default)
```
┌──────────────────┐
│   64px × 64px    │
│                  │
│      👊          │  ← Icon (32px font-size)
│                  │
│      JAB         │  ← Label (10px)
│                  │
└──────────────────┘
border: 2px solid #0cf (blue = fast)
```

#### Cross Mode
```
┌──────────────────┐
│   64px × 64px    │
│                  │
│      💥          │  ← Icon (32px font-size)
│                  │
│     CROSS        │  ← Label (10px)
│                  │
└──────────────────┘
border: 2px solid #f00 (red = power)
```

#### With Keyboard Shortcut Indicator
```
           Q
          ┌─┐
┌─────────┤ ├───────┐
│         └─┘       │  ← Shortcut badge (top-right)
│                   │
│       👊          │
│                   │
│       JAB         │
└───────────────────┘
```

**Toggle States:**
```
Default              Hover                Active (Click)
┌──────────┐        ┌──────────┐         ┌──────────┐
│    👊    │        │    👊    │         │    👊    │
│    JAB   │        │    JAB   │         │    JAB   │
└──────────┘        └──────────┘         └──────────┘
#666 border         #f80 border          translateY(1px)
```

---

## Color Palette

### Background Colors
```
HUD Background:      rgba(0, 0, 0, 0.8)  [#000000CC]
Element Background:  #222222
Empty Slot:          #111111
```

### Border Colors
```
Default Border:      #666666
Hover Border:        #888888
Active Element:      varies by type
  - Avatar Hover:    #00ff00 (green)
  - Punch Hover:     #ff8800 (orange)
  - Jab Active:      #00ccff (cyan/blue)
  - Cross Active:    #ff0000 (red)
```

### Text Colors
```
Primary Text:        #ffffff
Secondary Text:      #888888
Shortcut Hint:       #888888
```

---

## Animation Behaviors

### Toggle Transition
```
Jab → Cross

Frame 1 (0ms):       Frame 2 (50ms):      Frame 3 (100ms):
┌──────────┐        ┌──────────┐         ┌──────────┐
│    👊    │   →    │    ↻     │    →   │    💥    │
│    JAB   │        │  ...     │         │   CROSS  │
└──────────┘        └──────────┘         └──────────┘
#0cf border         fade out             #f00 border
                    scale(0.8)           scale(1.0)
```

### Icon Scale on Click
```
Rest    →    Press   →    Release
  👊         👊 (90%)      👊
```

### Inventory Item Addition
```
New item collected:

Frame 1:             Frame 2:             Frame 3:
Empty               Fade in             Fully visible
┌────┐              ┌────┐              ┌────┐
│    │         →    │ 🔑 │         →    │ 🔑 │
└────┘              └────┘              └────┘
                    opacity: 0.5        opacity: 1.0
                    scale: 0.8          scale: 1.0
                    duration: 200ms
```

---

## Responsive Behavior

### Narrow Screen (< 800px)
```
┌────┬─────────────────────────┬────┐
│ 👤 │ 🔑 💊 📄 🔧 ... (scroll)│ 👊 │
└────┴─────────────────────────┴────┘
     Fewer visible items (5-6)
```

### Wide Screen (> 1200px)
```
┌────┬───────────────────────────────────────────────┬────┐
│ 👤 │ 🔑 💊 📄 🔧 📱 💳 🎫 🗝️ 🧪 💼 ... (more visible)│ 👊 │
└────┴───────────────────────────────────────────────┴────┘
     More visible items (10-12)
```

### Mobile (future consideration)
```
Consider vertical sidebar or swipe-up drawer
Not implemented in Phase 1
```

---

## Interaction Matrix

| Element | Click | Hover | Keyboard | Result |
|---------|-------|-------|----------|--------|
| Avatar  | ✓     | ✓     | P        | Open player preferences modal |
| Inventory Slot | ✓ | ✓ | 1-9 | Use/equip item (future) |
| Punch Toggle | ✓ | ✓ | Q | Switch between jab/cross |
| Empty Area | -  | -  | - | No action |

---

## Accessibility Considerations

### Keyboard Navigation
```
Tab Order:
1. Avatar Button (focus: green outline)
2. First Inventory Item (focus: green outline)
3. Next Inventory Items... (arrow keys to navigate)
n. Punch Toggle (focus: orange outline)

Enter/Space: Activate focused element
```

### Screen Reader Support
```html
<div id="hud-avatar" role="button" aria-label="Open player settings" tabindex="0">
  <img src="headshot.png" alt="Player character">
</div>

<div id="hud-inventory" role="list" aria-label="Inventory items">
  <div class="hud-inventory-slot" role="listitem" aria-label="Key">
    <img src="key.png" alt="Key">
  </div>
</div>

<button id="hud-punch-toggle" aria-label="Punch type: Jab. Press to switch to Cross">
  <span aria-hidden="true">👊</span>
  <span>JAB</span>
</button>
```

---

## Edge Cases

### No Items in Inventory
```
┌────┬─────────────────────────────┬────┐
│ 👤 │   (Empty - no scroll)       │ 👊 │
└────┴─────────────────────────────┴────┘
     Show subtle message: "No items"
     or leave blank
```

### Single Item
```
┌────┬─────────────────────────────┬────┐
│ 👤 │ 🔑  (centered/left-aligned) │ 👊 │
└────┴─────────────────────────────┴────┘
```

### Maximum Items (30+)
```
┌────┬─────────────────────────────┬────┐
│ 👤 │ 🔑 💊 📄 🔧 ►►► (scroll)    │ 👊 │
└────┴─────────────────────────────┴────┘
     Scrollbar visible + scroll indicator
```

### Player Not Selected (No Headshot)
```
┌────┐
│ ❓ │  ← Default placeholder icon
└────┘
```

---

## Performance Optimizations

### Rendering Strategy
- Use CSS transforms (not top/left) for animations
- Batch inventory updates (debounce rapid additions)
- Lazy-load headshot images only when needed
- Use `will-change: transform` for animated elements

### Memory Management
- Remove unused inventory slot elements when inventory size decreases
- Reuse slot elements instead of destroying/creating
- Cache headshot image once loaded

---

## Z-Index Stack

```
Layer 10000: Tutorial overlays, critical modals
Layer 5000:  Settings modal, player preferences modal
Layer 2000:  Minigame overlays
Layer 1500:  Notification toasts
Layer 1000:  Player HUD ← THIS LAYER
Layer 500:   Objective tracker, quest log
Layer 100:   UI overlays (interaction prompts)
Layer 10:    UI elements (room labels)
Layer 0:     Phaser game canvas
```

---

## Testing Scenarios Visual Matrix

| Scenario | Avatar | Inventory | Punch | Expected Result |
|----------|--------|-----------|-------|-----------------|
| Fresh game start | ✓ | Empty | Jab | All elements visible |
| After collecting 1 item | ✓ | 1 item | Jab | Item appears with fade-in |
| Toggle to cross punch | ✓ | Any | Cross | Icon changes, border red |
| Open preferences | Modal | Visible | Visible | Modal opens, HUD stays |
| Punch an enemy (jab) | ✓ | Any | Jab | Animation plays, 10 dmg |
| Punch an enemy (cross) | ✓ | Any | Cross | Animation plays, 25 dmg |
| Collect 15 items | ✓ | 15 items | Any | Scroll appears, works |
| Keyboard shortcut Q | ✓ | Any | Toggle | Switches punch type |
| Hover avatar | Highlight | Any | Any | Green border, tooltip |
| Click avatar | Modal | Any | Any | Preferences modal opens |

---

## Additional Visual Notes

### Font Stack
```css
font-family: 'Courier New', 'Courier', monospace;
/* Fallbacks for pixel-art feel */
```

### Border Style (Consistent)
```css
/* All borders should match this style */
border: 2px solid [color];
border-radius: 0; /* Never use rounded corners */
```

### Image Rendering
```css
/* All sprites/icons should use */
image-rendering: pixelated;
image-rendering: -moz-crisp-edges;
image-rendering: crisp-edges;
```

---

## Icon Reference

### Emojis Used (Unicode Fallback)
- Avatar: 👤 (U+1F464) - Bust in Silhouette
- Jab: 👊 (U+1F44A) - Fisted Hand Sign  
- Cross: 💥 (U+1F4A5) - Collision Symbol
- Alternative Cross: 🥊 (U+1F94A) - Boxing Glove

### Alternative: Custom Pixel Art
If emojis don't fit aesthetic, create simple 32x32 pixel art icons:
```
JAB Icon:           CROSS Icon:
  ████                ████████
  ████              ████  ████
████                ████████
████                  ████
████                ████████
  ████              ████  ████
  ████                ████████
```
