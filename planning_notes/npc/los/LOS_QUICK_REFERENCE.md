# NPC LOS Configuration Quick Reference

## Quick Setup

Add to any person-type NPC in scenario JSON:

```json
{
  "id": "your_npc",
  "npcType": "person",
  
  "los": {
    "enabled": true,
    "range": 300,
    "angle": 120,
    "visualize": false
  },
  
  "eventMappings": [
    {
      "eventPattern": "lockpick_used_in_view",
      "targetKnot": "on_lockpick_used",
      "conversationMode": "person-chat",
      "cooldown": 0
    }
  ]
}
```

## Parameter Meanings

| Parameter | Type | Min | Max | Default | Notes |
|-----------|------|-----|-----|---------|-------|
| `enabled` | bool | - | - | true | Enable/disable LOS detection |
| `range` | px | 0 | 2000 | 300 | How far NPC can see (pixels) |
| `angle` | ° | 0 | 360 | 120 | Field of view width (degrees) |
| `visualize` | bool | - | - | false | Show cone for debugging |

## Angle Examples

```
angle: 60   = Narrow vision (30° each side)
angle: 90   = Standard vision (45° each side)  
angle: 120  = Wide vision (60° each side) ✓ DEFAULT
angle: 140  = Very wide (70° each side)
angle: 180  = Hemisphere vision (90° each side)
angle: 360  = Full vision (sees everywhere)
```

## Range Examples

```
range: 100   = Immediate area (1-2 tiles)
range: 250   = Close proximity (3-4 tiles)
range: 300   = Standard distance (4-5 tiles) ✓ DEFAULT
range: 500   = Long distance (6-8 tiles)
range: 1000+ = Sniper-like sight
```

## Preset Configurations

### Casual Guard
```json
"los": {
  "enabled": true,
  "range": 200,
  "angle": 100
}
```

### Alert Guard
```json
"los": {
  "enabled": true,
  "range": 350,
  "angle": 140
}
```

### Paranoid Guard
```json
"los": {
  "enabled": true,
  "range": 500,
  "angle": 180
}
```

### Distracted NPC
```json
"los": {
  "enabled": true,
  "range": 150,
  "angle": 80
}
```

### Blind NPC (always hears)
```json
"los": {
  "enabled": false,
  "range": 99999,
  "angle": 360
}
```

## Testing Commands

### Enable Debug Visualization
```javascript
window.npcManager.setLOSVisualization(true, window.game.scene.scenes[0]);
```

### Update Visualization (call each frame)
```javascript
window.npcManager.updateLOSVisualizations(window.game.scene.scenes[0]);
```

### Check If Player Visible
```javascript
const playerPos = window.player.sprite.getCenter();
const npc = window.npcManager.getNPC('your_npc_id');
const los = window.npcManager.shouldInterruptLockpickingWithPersonChat('room_id', playerPos);
console.log('Can see:', los !== null);
```

### Get NPC LOS Config
```javascript
const npc = window.npcManager.getNPC('your_npc_id');
console.log('LOS Config:', npc.los);
```

## Visualization

When enabled, shows:
- **Green cone** = NPC's field of view
- **Cone tip** = NPC's position
- **Cone width** = `angle` parameter (degrees)
- **Cone depth** = `range` parameter (pixels)

## Common Configurations by Scenario

### Tight Security
```json
"range": 400,
"angle": 160
```

### Secret Room Guard
```json
"range": 150,
"angle": 60
```

### Perimeter Patrol
```json
"range": 300,
"angle": 120
```

### Boss NPC
```json
"range": 600,
"angle": 200
```

## Debugging Checklist

- [ ] NPC position correct? `npc.x, npc.y`
- [ ] NPC facing direction correct? `npc.facingDirection`
- [ ] Player position correct? `window.player.sprite.getCenter()`
- [ ] Range value sufficient? Try doubling it
- [ ] Angle value sufficient? Try 180° for testing
- [ ] LOS enabled? Check `npc.los.enabled`
- [ ] Visualization enabled? Use `setLOSVisualization(true)`

## Troubleshooting

| Problem | Solution |
|---------|----------|
| NPC never reacts | Increase `range` and/or `angle`, enable visualization |
| NPC always reacts | Set `enabled: false` or reduce `range`/`angle` |
| Can't see cone | Call `updateLOSVisualizations()` each frame |
| Cone in wrong spot | Check NPC position and sprite offset |
| Wrong facing | Check NPC direction/rotation property |

## Migration Consideration

When moving to server-side unlock validation:

**Keep for client-side:**
- Cosmetic NPC reactions
- UI feedback
- Immediate game feel

**Move to server-side:**
- Actual unlock permission check
- Event validation
- Security verification

Never trust client-side LOS result - always validate server-side!
