# Player Preferences System - Planning Documentation

**Feature**: Player Sprite & Name Customization  
**Status**: Planning Phase (Ready for Review)  
**Created**: 2026-02-11

## Overview

This feature allows players to:
- **Customize their in-game name** (seeded from Hacktivity `user.handle`, defaults to "Zero")
- **Select their character sprite** from 16 available options
- **Validation**: Scenarios can restrict sprites via `validSprites` patterns
- **UI**: Configuration screen with animated sprite previews and padlock overlays for locked sprites

---

## Planning Documents

### 📋 [SUMMARY.md](./SUMMARY.md)
**Quick reference guide** - Start here for a high-level overview
- Key features
- File list
- Implementation order
- Review questions

### 📖 [PLAN.md](./PLAN.md)
**Detailed implementation plan** - Complete technical specification
- Database schema
- Model/Controller/Policy code examples
- View templates
- JavaScript/CSS implementation
- Testing strategy
- Edge cases & security considerations

### 🔀 [FLOW_DIAGRAM.md](./FLOW_DIAGRAM.md)
**Visual flow diagrams** - Understand the system architecture
- Game creation flow with sprite validation
- Configuration screen flow
- Sprite validation algorithm
- Data flow (preferences → scenario → client)
- Polymorphic association structure
- UI layout mockup
- Database schema diagram

### 📁 [FILE_MANIFEST.md](./FILE_MANIFEST.md)
**Complete file checklist** - Track implementation progress
- 14 files to create
- 7 files to modify
- Implementation phases
- Git workflow strategy
- Dependencies

---

## Key Decisions Made

### Storage Approach
✅ **Player Preferences Table** (polymorphic association)
- Persistent across games
- No parent app schema changes required
- Extensible for future preferences

### Sprite Validation
✅ **Scenario-level patterns with wildcards**
- `validSprites: ["female_*", "male_spy"]`
- Redirects to configuration if no sprite OR invalid sprite
- Greyed out with padlock overlay for invalid sprites

### Default Values
✅ **Seeded from user data, sprite required**
- Name: `user.handle` → fallback to "Zero"
- Sprite: NULL (player MUST choose before first game)

### UI Approach
✅ **Single Phaser instance for sprite previews**
- Animated breathing-idle sprites (engaging, matches game)
- One WebGL context for all 16 sprites (better than 16 instances)
- Leverages existing sprite atlases (no new assets needed)
- Responsive with Phaser Scale.FIT mode

---

## Implementation Timeline

| Phase | Tasks | Files | Estimated Complexity |
|-------|-------|-------|---------------------|
| 1. Core Backend | Migration, Models, Routes | 4 | Low |
| 2. Controller & Policy | Authorization, CRUD | 3 | Medium |
| 3. Frontend | Views, JS, CSS | 3 | Medium |
| 4. Game Integration | Inject preferences, validation | 2 | Medium |
| 5. Testing | Model, Controller, Integration | 5 | Medium |
| 6. Documentation | README, CHANGELOG, guides | 4 | Low |

**Total Files**: 21 (14 new, 7 modified)

---

## Review Decisions (COMPLETED)

Reviewed and approved 2026-02-11:

- [x] **Default sprite**: NULL - player MUST choose before starting first game ✅
- [x] **Name validation**: Alphanumeric + spaces/underscores, server-side only ✅
- [x] **Wildcard patterns**: `female_*`, `male_*`, `*_hacker` approved ✅
- [x] **Locked sprites UI**: Deferred to Phase 2 ⏸️
- [x] **Preview rendering**: Single Phaser instance with animated sprites ✅
- [x] **Mobile responsiveness**: Phaser Scale.FIT mode for responsive canvas ✅
- [x] **Existing players**: Prompt when starting a game ✅
- [x] **Analytics**: Not needed for initial release ❌

---

## Questions & Decisions Needed

### Open Questions

1. **Should scenarios be able to override player sprite entirely?**
   - Use case: Story-driven mission where player must be a specific character
   - Proposed: Add `scenario.forcedSprite` field

2. **Should sprites be unlockable via achievements?**
   - Start with 3 unlocked, rest earned through gameplay
   - Requires additional `unlocked_sprites` JSONB column

3. **Should we generate portraits from sprite sheets?**
   - Auto-crop sprite head for dialogue portraits
   - Reduces manual asset creation

4. **Browser localStorage fallback?**
   - If player not logged in (demo mode without account)
   - Store preferences client-side only

---

## Next Steps

1. **Review all planning documents** (this README, PLAN, FLOW_DIAGRAM, FILE_MANIFEST)
2. **Answer review checklist questions** above
3. **Approve or request changes** to the plan
4. **Begin implementation** following phases in FILE_MANIFEST.md

---

## Contact & Feedback

- **Questions**: Open GitHub issue or comment on this planning doc
- **Suggestions**: Edit planning docs before implementation begins
- **Approval**: Mark checklist items and provide go-ahead for implementation

---

## Related Documentation

- [CHANGELOG_SPRITES.md](../../CHANGELOG_SPRITES.md) - Current sprite system
- [docs/SPRITE_SYSTEM.md](../../docs/SPRITE_SYSTEM.md) - Sprite atlas documentation
- [.github/copilot-instructions.md](../../.github/copilot-instructions.md) - Project architecture

---

**Status**: ✅ Approved - Ready for Implementation  
**Last Updated**: 2026-02-11 (reviewed and approved)
