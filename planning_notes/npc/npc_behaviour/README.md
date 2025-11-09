# NPC Behavior System - Planning & Implementation Guide

## Overview

This directory contains comprehensive planning documents for implementing dynamic NPC behaviors in Break Escape. The behavior system allows NPCs to react to the player, patrol areas, maintain personal space, and exhibit hostility states—all configurable through scenario JSON and controllable via Ink story tags.

## Document Index

### 1. **IMPLEMENTATION_PLAN.md** (START HERE)
**Purpose**: Complete implementation roadmap with architecture, algorithms, and phased rollout plan.

**Contains**:
- System architecture and data flow
- Behavior state machine design
- Scenario JSON schema extensions
- Ink tag integration specifications
- Movement algorithms (face player, patrol, personal space)
- Integration points with existing systems
- 8-phase implementation plan
- Testing strategy and success criteria
- Performance considerations
- Future enhancements roadmap

**For**: Lead developer, project planning, architecture review

---

### 2. **TECHNICAL_SPEC.md**
**Purpose**: Deep technical documentation for developers implementing the system.

**Contains**:
- Class definitions (NPCBehaviorManager, NPCBehavior)
- Complete API reference with method signatures
- Configuration schema with defaults
- Animation system specifications
- Movement algorithm implementations (with code)
- Depth calculation formulas
- Ink integration flow diagrams
- Tag handler implementations
- Performance optimization techniques
- Error handling patterns
- Testing checklist

**For**: Developers writing npc-behavior.js, integration work

---

### 3. **QUICK_REFERENCE.md**
**Purpose**: Fast lookup guide for common tasks and patterns.

**Contains**:
- Scenario configuration examples (copy-paste ready)
- Ink tag usage examples
- Developer API quick reference
- Configuration defaults table
- Distance reference (tiles ↔ pixels)
- Behavior priority table
- Common patterns cookbook
- Troubleshooting guide

**For**: Scenario designers, Ink writers, quick lookups

---

### 4. **example_scenario.json**
**Purpose**: Test scenario demonstrating all behavior types.

**Contains**:
- 5 NPCs with different behavior configurations:
  1. Default NPC (face player only)
  2. Patrolling Guard (patrol + face player)
  3. Shy Person (personal space + face player)
  4. Hostile Agent (hostile state + red tint)
  5. Complex NPC (all behaviors, Ink-controlled)

**For**: Testing, reference implementation, QA

---

### 5. **example_ink_complex.ink**
**Purpose**: Ink story demonstrating all behavior control tags.

**Contains**:
- Toggle patrol (#patrol_mode:on / :off)
- Set influence (#influence:±value)
- Toggle hostile (#hostile / #hostile:false)
- Adjust personal space (#personal_space:distance)
- Interactive dialogue for testing each behavior

**For**: Ink writers, behavior testing, tag reference

---

### 6. **example_ink_hostile.ink**
**Purpose**: Focused example of hostile state and influence system.

**Contains**:
- Hostile state initialization (#hostile)
- Influence score management (#influence:value)
- Threshold-based behavior changes
- Peace-making dialogue (hostile → friendly)

**For**: Ink writers, hostile behavior patterns

---

## Implementation Workflow

### Phase 1: Review & Setup
1. Read **IMPLEMENTATION_PLAN.md** (sections 1-4) for system overview
2. Review **TECHNICAL_SPEC.md** class definitions
3. Set up development branch

### Phase 2: Core Infrastructure
1. Create `js/systems/npc-behavior.js` (skeleton)
2. Implement `NPCBehaviorManager` class
3. Implement `NPCBehavior` class with state machine
4. Integrate with `game.js` update loop
5. Test with single NPC (idle state)

### Phase 3: Face Player Behavior
1. Implement `facePlayer()` logic (TECHNICAL_SPEC.md)
2. Use **QUICK_REFERENCE.md** for distance calculations
3. Test with **example_scenario.json** default_npc

### Phase 4: Animation System
1. Extend `npc-sprites.js` with walk animations
2. Implement `playAnimation()` method
3. Test 8-direction animations

### Phase 5: Patrol Behavior
1. Implement `updatePatrol()` logic
2. Add collision handling and stuck recovery
3. Test with **example_scenario.json** patrol_npc

### Phase 6: Personal Space
1. Implement `maintainPersonalSpace()` logic
2. Test with **example_scenario.json** shy_npc

### Phase 7: Ink Integration
1. Extend `npc-game-bridge.js` (TECHNICAL_SPEC.md tag handlers)
2. Add tag processing to person-chat minigame
3. Test with **example_ink_complex.ink**

### Phase 8: Hostile Behavior
1. Implement hostile visual feedback (red tint)
2. Add influence → hostility logic
3. Test with **example_scenario.json** hostile_npc and **example_ink_hostile.ink**

### Phase 9: Testing & Documentation
1. Run full test suite (TECHNICAL_SPEC.md checklist)
2. Write user documentation
3. Update scenario design guides

---

## Quick Start for Common Tasks

### For Scenario Designers

**"How do I make an NPC patrol?"**
→ See **QUICK_REFERENCE.md** → "Add Patrol Behavior"

**"What distances should I use?"**
→ See **QUICK_REFERENCE.md** → "Distance Reference" table

**"How do I make a hostile NPC?"**
→ See **example_scenario.json** → `hostile_npc` configuration

### For Ink Writers

**"What tags control NPC behavior?"**
→ See **QUICK_REFERENCE.md** → "For Ink Story Writers" section

**"How do I make an NPC hostile via dialogue?"**
→ See **example_ink_hostile.ink** → `make_peace` knot

**"How do I toggle patrol mode?"**
→ See **example_ink_complex.ink** → `start_patrol` / `stop_patrol` knots

### For Developers

**"What's the class structure?"**
→ See **TECHNICAL_SPEC.md** → "Class Definitions"

**"How do I integrate with game.js?"**
→ See **IMPLEMENTATION_PLAN.md** → "Integration Points"

**"What's the animation key format?"**
→ See **TECHNICAL_SPEC.md** → "Animation System"

---

## Key Design Decisions

### 1. **Why throttle updates to 50ms?**
- Balance responsiveness with performance
- 20 updates/sec sufficient for NPC behaviors
- Reduces CPU usage with many NPCs

### 2. **Why use squared distances?**
- Avoid expensive Math.sqrt() calls
- Pre-calculate squared thresholds in config
- Significant performance gain with many NPCs

### 3. **Why priority-based state machine?**
- Clear behavior precedence (personal space > patrol)
- Predictable behavior in complex scenarios
- Easy to extend with new behaviors

### 4. **Why reuse player animation patterns?**
- Consistency in codebase
- Proven working implementation
- Reduced development time

### 5. **Why Ink tags for behavior control?**
- Integrates with existing narrative system
- No new UI/controls needed
- Designers can script dynamic behaviors

---

## Development Principles

1. **Modularity**: Behavior system is self-contained module
2. **Performance**: Throttled updates, cached calculations
3. **Maintainability**: Clear separation of concerns
4. **Extensibility**: Easy to add new behaviors
5. **Robustness**: Graceful degradation on errors
6. **Documentation**: Every decision documented

---

## Performance Targets

| Metric | Target | Method |
|--------|--------|--------|
| Update frequency | 20 Hz (50ms) | Throttled update loop |
| FPS impact (10 NPCs) | < 10% | Optimized calculations |
| Distance checks | O(1) | Squared distances |
| Animation changes | Minimal | Change detection |
| Memory footprint | < 5MB | Efficient data structures |

---

## Integration Checklist

- [ ] `npc-behavior.js` created and exported
- [ ] `game.js` creates NPCBehaviorManager
- [ ] `game.js` update loop calls behavior update
- [ ] `npc-sprites.js` creates walk animations
- [ ] `npc-game-bridge.js` has behavior control methods
- [ ] `person-chat-minigame.js` processes behavior tags
- [ ] Test scenario loads without errors
- [ ] Behaviors work as documented
- [ ] Performance targets met

---

## Known Limitations & Future Work

### Current Limitations
- No pathfinding (direct line movement)
- No chase/flee implementation (stub only)
- No NPC-to-NPC interactions
- No behavior scheduling (time-based)
- No spatial culling (all NPCs update)

### Post-MVP Enhancements
- Chase/flee hostile behaviors
- Waypoint-based patrol paths
- Group behaviors (follow leader)
- Debug visualization overlay
- Behavior scheduling system

### Long-term Vision
- Full pathfinding integration
- Emotion system (beyond hostile)
- Dynamic behavior trees
- NPC conversation system
- Animation state blending

---

## Support & Questions

**For design questions**: Review QUICK_REFERENCE.md and example files

**For technical questions**: Check TECHNICAL_SPEC.md API reference

**For architecture questions**: See IMPLEMENTATION_PLAN.md

**For troubleshooting**: See QUICK_REFERENCE.md troubleshooting section

**For performance questions**: See TECHNICAL_SPEC.md optimization section

---

## Version History

- **v1.0** (2025-11-09): Initial planning documents
  - Complete architecture and technical specifications
  - Example scenario and Ink stories
  - 8-phase implementation plan

---

## Contributing

When implementing behaviors:

1. Follow patterns from `player.js` (movement, animation)
2. Use emoji prefixes in console logs (🤖 for behaviors)
3. Add comprehensive error handling
4. Write JSDoc comments for all methods
5. Update this documentation if design changes

---

## File Locations

```
planning_notes/npc/npc_behaviour/
├── README.md                    (this file)
├── IMPLEMENTATION_PLAN.md       (architecture & roadmap)
├── TECHNICAL_SPEC.md            (developer reference)
├── QUICK_REFERENCE.md           (quick lookup guide)
├── example_scenario.json        (test scenario config)
├── example_ink_complex.ink      (full behavior demo)
└── example_ink_hostile.ink      (hostile state demo)

Future implementation files:
js/systems/
└── npc-behavior.js              (core behavior system)
```

---

**Document Status**: Planning Complete, Ready for Implementation
**Last Updated**: 2025-11-09
**Maintainer**: Development Team
