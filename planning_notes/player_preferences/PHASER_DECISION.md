# Phaser Implementation Decision

**Date**: 2026-02-11  
**Decision**: Use single Phaser instance for animated sprite previews

---

## Options Considered

1. **Static HTML Images** - Pre-generated PNG files
2. **16 Phaser Instances** - One mini-game per sprite
3. **Single Phaser Instance** - All sprites in one canvas ✅ **SELECTED**

---

## Why Single Phaser Instance?

### Technical Advantages

1. **Leverages Existing Infrastructure**
   - Break Escape already uses Phaser throughout
   - Sprite atlases already exist (16 PNG + JSON files)
   - No new assets or build tools needed
   - Consistent rendering pipeline with main game

2. **Better User Experience**
   - Animated breathing-idle previews (engaging)
   - Shows exactly what player will see in-game
   - More polished than static images
   - Matches pixel-art game aesthetic

3. **Performance Optimization**
   - Single WebGL context (~15MB) vs 16 contexts (~50MB)
   - Shared texture memory across all sprites
   - Phaser's Scale.FIT handles responsiveness
   - Acceptable on modern mobile devices

4. **Maintainability**
   - No asset generation step to remember
   - New sprites automatically work (just add to atlas)
   - No `chunky_png` gem dependency
   - Simpler deployment pipeline

### Tradeoffs Accepted

| Concern | Impact | Mitigation |
|---------|--------|------------|
| Load time | ~800ms vs ~100ms for images | Acceptable for configuration page |
| Memory usage | ~15MB vs ~2MB | Within limits for modern devices |
| Mobile performance | Potential lag on old phones | Phaser Scale.FIT optimizes, game already requires Phaser |
| JavaScript complexity | 100 LOC vs 0 | Well-documented, modular code |

---

## Implementation Details

### Architecture

```
Configuration Page
├── Single Phaser Canvas (absolute positioned, z-index: 1)
│   ├── 16 Sprites in 4x4 grid
│   └── Each playing breathing-idle_south animation
└── HTML Selection Grid (z-index: 2)
    ├── Radio buttons (hidden)
    ├── Labels (clickable, transparent background)
    └── Padlock overlays (for locked sprites)
```

### Performance Specs

- **Canvas Size**: 384x384px (4 sprites × 96px cells)
- **Frame Rate**: 8 FPS (breathing-idle animations)
- **Atlas Load**: ~2-3MB (all 16 character atlases)
- **Memory**: ~15MB total (single WebGL context + textures)
- **Initialization**: ~800ms on average device

### Code Structure

**JavaScript** (`sprite-grid.js`):
- `initializeSpriteGrid()` - Entry point
- `preloadSprites()` - Load all 16 atlases
- `createSpriteGrid()` - Position sprites in 4x4 grid, start animations

**View** (`show.html.erb`):
- Phaser CDN script tag
- Canvas container div
- HTML grid overlaid for interaction

**CSS** (`player_preferences.css`):
- Canvas: `pointer-events: none` (clicks pass through)
- Grid: `position: relative, z-index: 2`
- Responsive via Phaser, not CSS media queries

---

## Alternatives Rejected

### Static Images (Rejected)

**Why rejected:**
- Less engaging (no animation)
- Requires build step (`generate_sprite_previews.rb`)
- New dependency (`chunky_png` gem)
- Maintenance burden (regenerate when sprites change)
- Doesn't match game experience

### 16 Phaser Instances (Rejected)

**Why rejected:**
- Memory bloat (~50MB for 16 WebGL contexts)
- Poor mobile performance
- Initialization lag (loading 16 separate games)
- Overcomplicated for simple grid

---

## Testing Considerations

### What to Test

1. **Sprite Loading**
   - All 16 atlases load correctly
   - Missing atlas shows error (doesn't crash)

2. **Animation Playback**
   - breathing-idle_south plays for each sprite
   - Animations loop correctly
   - Frame rate stable at 8 FPS

3. **Click Handling**
   - Radio buttons update when label clicked
   - Selected card highlights correctly
   - Padlock prevents selection of invalid sprites

4. **Responsive Behavior**
   - Canvas scales on mobile (Phaser Scale.FIT)
   - Grid layout adapts to canvas size
   - No overflow or clipping issues

5. **Performance**
   - Load time < 2 seconds
   - Smooth animations on mid-range devices
   - No memory leaks on repeated visits

### Browser Compatibility

- ✅ Chrome/Edge (WebGL support)
- ✅ Firefox (WebGL support)
- ✅ Safari (WebGL support)
- ⚠️ Old mobile browsers (fallback: static first frame)

---

## Migration from Static Images Plan

All planning documents have been updated:

1. **PLAN.md**: 
   - Removed asset generation script
   - Added sprite-grid.js implementation
   - Updated view with Phaser canvas container

2. **FILE_MANIFEST.md**:
   - Removed `tools/generate_sprite_previews.rb`
   - Added `public/break_escape/js/ui/sprite-grid.js`
   - Removed `chunky_png` dependency

3. **SUMMARY.md**:
   - Updated UI description to "animated Phaser previews"
   - Changed testing focus from static images to animations

4. **README.md**:
   - Updated UI approach section
   - Changed review decisions

5. **CHANGES_FROM_REVIEW.md**:
   - Will be updated to reflect final Phaser decision

---

## Implementation Checklist

- [ ] Create `public/break_escape/js/ui/sprite-grid.js`
- [ ] Update view to include Phaser CDN script
- [ ] Add canvas container with proper positioning
- [ ] Update CSS for layered grid (canvas behind, HTML above)
- [ ] Test on desktop browsers (Chrome, Firefox, Safari)
- [ ] Test on mobile devices (iOS Safari, Android Chrome)
- [ ] Verify animations loop correctly
- [ ] Verify click handling works with overlaid HTML
- [ ] Test padlock overlays on locked sprites
- [ ] Confirm Phaser Scale.FIT responsive behavior

---

## Future Optimizations (Phase 2)

1. **Lazy Loading**: Only load Phaser on configuration page
2. **WebP Atlases**: Convert PNGs to WebP for smaller downloads
3. **Sprite Atlasing**: Combine all 16 sprites into single atlas
4. **Static Fallback**: Detect old devices, show static images instead
5. **Animation Variations**: Cycle through walk/idle/attack previews

---

**Status**: ✅ Decision finalized, plans updated  
**Ready for**: Phase 3 implementation (Frontend)
