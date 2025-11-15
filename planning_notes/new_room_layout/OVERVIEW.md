# Room Layout System Redesign - Overview

## Current System Limitations

The existing room positioning system has several constraints:

1. **Fixed Room Size**: All rooms are 320x320px (10x10 tiles)
2. **Limited Connections**: Only supports north/south connections with up to 2 rooms
3. **Gap Issues**: When branching north to multiple rooms, awkward gaps appear between rooms
4. **Corner-Only Doors**: North doors must be in corners, creating alignment issues
5. **No East/West Support**: Cannot connect rooms horizontally

## Goals of the Redesign

1. **Flexible Room Sizes**: Support rooms in multiples of grid units (5x4 tiles base)
2. **Better Alignment**: Stack rooms against each other with no gaps
3. **4-Direction Support**: Enable north, south, east, and west connections
4. **Smarter Door Placement**:
   - North/South doors still in corners for visual consistency
   - East/West doors positioned based on connection count
   - Deterministic door positioning using grid coordinates
5. **Overlap Detection**: Validate scenarios to prevent positioning conflicts
6. **Hallway Support**: Allow explicit hallway connectors in scenarios

## Key Concepts

### Grid Units
- **Base grid unit**: 5 tiles wide × 4 tiles tall (160px × 128px at 32px/tile)
- **Stacking size**: Excludes top 2 rows which overlap visually with rooms to the north
- All rooms must be sized in multiples of grid units (both X and Y)

### Valid Room Sizes
- **Closet**: 5×4 tiles (1×1 grid units) - smallest room
- **Standard Room**: 10×8 tiles (2×2 grid units) - offices, reception, etc.
- **Hallways**: 10×4 or 20×4 tiles (2×1 or 4×1 grid units)
- **Large Rooms**: Any multiple of grid units (e.g., 10×16, 20×8, etc.)

### Room Structure
```
WWWWWWWWWW    <- Top 2 rows: Visual wall (overlaps room to north)
WWWWWWWWWW
WFFFFFFFFW    <- Stacking area begins (floor + side walls)
WFFFFFFFFW
WFFFFFFFFW
WFFFFFFFFW
WFFFFFFFFW    <- Bottom row: Can overlap room to south
WFFFFFFFFW       (treated as floor when overlapping)
```

## What Stays the Same

1. **32px Tiles**: Core tile size unchanged
2. **Top-Down Orthogonal View**: Zelda-like perspective maintained
3. **Visual Overlapping**: North rooms still overlap south rooms visually
4. **Collision System**: Wall collision boxes at boundaries (except doors)
5. **Sprite-Based Doors**: Continue using door sprites with physics
6. **Lazy Loading**: Rooms still load on-demand

## What Changes

1. **Room Positioning Algorithm**: Complete rewrite to support grid units
2. **Door Placement Logic**: Enhanced for 4 directions and multiple sizes
3. **Connection Format**: Unchanged but interpreted differently
4. **Validation System**: New overlap detection on scenario load
5. **Wall Management**: Adapt to variable room sizes

## Success Criteria

- [ ] Rooms of different sizes align without gaps
- [ ] Doors always align perfectly when two rooms connect
- [ ] East/West connections work correctly
- [ ] Scenarios with overlapping rooms are detected and logged
- [ ] Existing scenarios (using 10×8 rooms) continue to work
- [ ] Door placement is deterministic and visually pleasing
