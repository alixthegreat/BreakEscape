# Sprite System Update - PixelLab Integration

## Summary

Added support for 16 new PixelLab character sprite sheets with JSON atlas format, while maintaining backward compatibility with existing legacy sprites.

## What Changed

### 1. New Character Assets
- **16 PixelLab characters** added to `public/break_escape/assets/characters/`
- Each character includes:
  - PNG sprite sheet (80x80 frames, optimized layout)
  - JSON atlas with animation metadata
  - 8-directional animations (breathing-idle, walk, attack, etc.)

### 2. Game Loading System (`public/break_escape/js/core/game.js`)
- Added atlas loading for all 16 new characters
- Legacy sprite loading preserved for backward compatibility
- Female characters: 8 variants (hacker, office worker, security, etc.)
- Male characters: 8 variants (hacker, office worker, security, etc.)

### 3. NPC Sprite System (`public/break_escape/js/systems/npc-sprites.js`)
- **New**: `setupAtlasAnimations()` function for atlas-based sprites
- Automatic format detection (atlas vs. legacy)
- Direction mapping: atlas directions → game directions
  - east/west/north/south → right/left/up/down
  - Diagonal directions fully supported
- Animation type mapping: breathing-idle, walk, cross-punch, etc.
- Backward compatible with existing frame-based sprites

### 4. Scenario Configuration (`scenarios/m01_first_contact/scenario.json.erb`)
Updated all characters to use new atlas sprites:
- **Player (Agent 0x00)**: `hacker` → `female_hacker_hood`
- **Agent 0x99**: `hacker` → `male_spy`
- **Sarah Martinez**: `hacker-red` → `female_office_worker`
- **Kevin Park**: `hacker` → `male_nerd`
- **Maya Chen**: `hacker-red` → `female_scientist`
- **Derek Lawson**: `hacker` → `male_security_guard`

Configuration format updated:
```json
// Old format
"spriteConfig": {
  "idleFrameStart": 20,
  "idleFrameEnd": 23
}

// New format
"spriteConfig": {
  "idleFrameRate": 8,
  "walkFrameRate": 10
}
```

### 5. Documentation
- **`docs/SPRITE_SYSTEM.md`** - Complete sprite system documentation
- **`public/break_escape/assets/characters/README.md`** - Character reference guide
- **`public/break_escape/assets/characters/SPRITE_SHEETS_SUMMARY.md`** - Detailed character breakdown
- **`tools/README_SPRITE_CONVERTER.md`** - Conversion tool documentation

### 6. Conversion Tool
- **`tools/convert_pixellab_to_spritesheet.py`** - Automated sprite sheet generator
- Converts PixelLab exports to Phaser-ready atlases
- Generates optimized PNG + JSON for each character
- Updated to skip example JS files

## Benefits

### Performance
- ✅ 16 HTTP requests instead of 2500+ individual images
- ✅ Single GPU texture per character
- ✅ Faster frame switching (no texture swaps)
- ✅ Optimized memory usage

### Features
- ✅ 8-directional movement with smooth animations
- ✅ Multiple animation types per character
- ✅ Easy character variety without custom sprite work
- ✅ Backward compatible with existing sprites

### Developer Experience
- ✅ Simple configuration in scenario JSON
- ✅ Automatic animation setup
- ✅ Clear character naming (female_hacker, male_spy, etc.)
- ✅ Comprehensive documentation

## Breaking Changes

**None** - The system is fully backward compatible. Legacy sprites continue to work with the old configuration format.

## New Character Variants

### Female Characters (8 variants)
1. `female_hacker_hood` - Hacker in hoodie (hood up)
2. `female_hacker` - Hacker in hoodie
3. `female_office_worker` - Office worker (blonde)
4. `female_security_guard` - Security guard
5. `female_telecom` - Telecom worker
6. `female_spy` - Spy in trench coat
7. `female_scientist` - Scientist in lab coat
8. `woman_bow` - Woman with bow

### Male Characters (8 variants)
1. `male_hacker_hood` - Hacker in hoodie (obscured)
2. `male_hacker` - Hacker in hoodie
3. `male_office_worker` - Office worker (shirt & tie)
4. `male_security_guard` - Security guard
5. `male_telecom` - Telecom worker
6. `male_spy` - Spy in trench coat
7. `male_scientist` - Mad scientist
8. `male_nerd` - Nerd (glasses, red shirt)

## Animation Support

All atlas characters include:
- **breathing-idle** - 8 directions, 4 frames each
- **walk** - 8 directions, 6 frames each
- **cross-punch** - 8 directions, 6 frames each
- **lead-jab** - 8 directions, 3 frames each
- **falling-back-death** - 7 frames (some: 8 directions)
- **taking-punch** - 6 frames (select characters)
- **pull-heavy-object** - 6 frames (select characters)

## Usage Example

```json
{
  "id": "my_npc",
  "displayName": "My Character",
  "npcType": "person",
  "position": { "x": 5, "y": 3 },
  "spriteSheet": "female_scientist",
  "spriteTalk": "assets/characters/scientist-talk.png",
  "spriteConfig": {
    "idleFrameRate": 8,
    "walkFrameRate": 10
  }
}
```

## Migration Path

To update existing NPCs:
1. Choose appropriate character from available list
2. Update `spriteSheet` value
3. Replace `idleFrameStart/End` with `idleFrameRate`
4. Add `walkFrameRate` if needed

## Testing

Tested with M01 First Contact scenario:
- ✅ All characters load correctly
- ✅ 8-directional movement works
- ✅ Idle animations play properly
- ✅ Walk animations transition smoothly
- ✅ Legacy sprites still functional
- ✅ Performance improved (fewer HTTP requests)

## Future Enhancements

Potential improvements:
- [ ] Dynamic portrait generation from sprite sheets
- [ ] Character customization system
- [ ] Animation state transitions (idle → walk → attack)
- [ ] More character variants (uniforms, outfits)
- [ ] Custom color tinting for sprite variations

## Files Modified

### Core Game Files
- `public/break_escape/js/core/game.js` - Added atlas loading
- `public/break_escape/js/systems/npc-sprites.js` - Added atlas animation support

### Scenario Files
- `scenarios/m01_first_contact/scenario.json.erb` - Updated all character sprites

### Assets
- `public/break_escape/assets/characters/` - Added 16 characters (32 files: PNG + JSON)

### Documentation
- `docs/SPRITE_SYSTEM.md` - New comprehensive guide
- `public/break_escape/assets/characters/README.md` - Character reference
- `public/break_escape/assets/characters/SPRITE_SHEETS_SUMMARY.md` - Detailed breakdown

### Tools
- `tools/convert_pixellab_to_spritesheet.py` - Updated (removed example JS generation)
- `tools/README_SPRITE_CONVERTER.md` - Updated documentation

## Notes

- Legacy `hacker` and `hacker-red` sprites remain available
- `spriteTalk` images are separate and work with both formats
- Atlas JSON format is Phaser 3 compatible (JSON Hash)
- All frames are 80x80 pixels (vs 64x64 for legacy)
- 2px padding between frames prevents texture bleeding
