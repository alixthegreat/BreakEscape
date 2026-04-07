# New NPC Behaviours — sis01_healthcare

**Scope:** Required NPC behaviour additions and engine changes to support the Northgate General Hospital scenario  
**References:**
- `planning_notes/sis_scenarios/case_1_healthcare_game_design/new_objects_planning.md`
- `planning_notes/sis_scenarios/case_1_healthcare_game_design/be_scenario_walkthrough.md`
- `scenarios/sis01_healthcare/scenario.json.erb`
- `public/break_escape/js/systems/npc-behavior.js`
- `public/break_escape/js/systems/npc-pathfinding.js`
- `public/break_escape/js/systems/npc-manager.js`
- `README_scenario_design.md`

---

## 1. Overview of Required NPC Behaviours

The healthcare scenario requires five categories of NPC behaviour that go beyond the current engine's capabilities:

| Category | NPCs Involved | Core Behaviour | Engine Gap? |
|---|---|---|---|
| Stationary bed patient NPCs | `bed4_patient`, `bed2_patient` | State-driven, no movement; player can examine | Partial |
| Monitoring-loop patrol nurse | `patrol_nurse` | Waypoint patrol visiting beds; dwell at each | No gap (dwellTime exists) |
| Interrupt-to-waypoint (bed4 escalation) | `patrol_nurse` | Abandon patrol, rush to specific bed, stay | **Yes** |
| NPC reveal on event | `pharmacist_npc` | Hidden until event fires, then appears and patrols | **Yes** |
| Speed/dwell override on event | `patrol_nurse`, `pharmacist_npc` | Walk faster when major incident declared | **Yes** |

---

## 2. Desired Gameplay and NPC Roles

### 2.1 Bed Patient NPCs (Stationary)

The design intent (from `new_objects_planning.md`) is:

> "Patients serve two purposes: they establish that this is a functioning hospital ward, and they make the consequences of cyber attack physically visible."

**Revised design decision:** Bed patients are now **stationary NPCs** (not objects). This means they have Ink story files, position declarations, and can deliver short observations/dialogue when the player approaches — but they never move.

#### Bed 4 Patient — Mr T. Ahmed (cardiac, post-surgical)

| State | `patient_bed4_state` value | What player sees |
|---|---|---|
| Resting unmonitored | `resting_unmonitored` | Patient lying quietly; alarm active but nobody responding |
| Distressed | `distressed` | Patient restless; call bell active; alarm tone higher |
| Critical | `critical` | Patient flat; alarm flashing; single steady tone |
| Attended | `attended` | Patrol nurse arrives and stands at bed |

Ink provides brief observations when player approaches (not full dialogue — just 1–2 lines). Approaching Mr Ahmed should give the player the alarm context without stopping flow.

#### Bed 2 Patient — Ms A. Okafor (post-surgical, infusion pump)

| State | `patient_bed2_state` value | What player sees |
|---|---|---|
| Stable | `stable` | Patient resting; pump running; everything normal |
| Sedated | `sedated` | Patient slumped; unresponsive; pump indicator amber |
| Critical | `critical` | Patient flat; respiratory irregularity; immediate danger |

The chair patient witness (Mrs Kowalski) is already in the scenario at x:7, y:4 — her role is to draw attention to Bed 2 when things go wrong.

---

### 2.2 Patrol Nurse — Normal Monitoring Loop

Since `ward_monitor_status = offline` from scenario start, the monitoring-online loop (station → one bed → station) never runs in the current draft. The relevant routine is the **manual rounds** loop:

**Monitoring offline (always the case in draft):**
```
nursing_station → bed1 → bed2 → bed3 → bed4 → bed5 → bed6 → repeat
Dwell at each bed: 8 seconds (manual check)
Dwell at station: 3 seconds (nothing to see, but she passes through)
```

If monitoring were online (future enhancement, not in draft):
```
nursing_station → one bed (random or sequential) → nursing_station
Dwell at bed: 3 seconds
Dwell at station: 10 seconds (watching the central display)
```

The patrol nurse waypoints are already defined in `scenario.json.erb`. The missing pieces are:
1. `dwellTime` on each waypoint (currently missing from the scenario definition)
2. The interrupt mechanic when `bed4_escalated = true`

---

### 2.3 Patrol Nurse — Escalation Interrupt (Critical Gap)

When the player tells Sarah to get help to Bed 4 (`bed4_escalated = true`):

1. Patrol nurse **immediately abandons** her current waypoint
2. Walks **directly to Bed 4** (x:8, y:5 in room coordinates) — faster than patrol speed
3. **Stays at Bed 4 permanently** — does not resume the patrol loop
4. Her `currentKnot` changes to `rushing_bed4` (one line, delivered once)
5. If approached again: `at_bed4` knot — "I'm here with him. What's happening with the systems?"

The current eventMapping in the scenario fires `rushing_bed4` as a conversationMode:person-chat but has no mechanism to physically reroute the NPC. The TODO comment in the scenario explicitly identifies this as a gap:

> "CURRENT LIMITATION: BreakEscape patrol supports waypoint loops but not conditional interrupt-to-waypoint. May need engine support or workaround (e.g., set patrol=null and re-path to single waypoint via event)."

---

### 2.4 Pharmacist — Hidden Until Triggered

The pharmacist (`pharmacist_npc`) is defined with `initiallyHidden: true` and a patrol loop. The trigger is `pharmacist_on_ward = true` (set by Helen Carver's eventMapping in the Major Incident Room).

The scenario currently has:
```json
{
    "eventPattern": "global_variable_changed:pharmacist_on_ward",
    "condition": "value === true",
    "onceOnly": true,
    "setGlobal": { "pharmacist_on_ward": true }
}
```

This sets the variable to itself — a no-op. The actual "un-hide" mechanism is not implemented. The TODO on Dr Sharma in the scenario notes: "Current engine may not support 'un-hide NPC via event' natively."

---

### 2.5 Nurse Speed Increase on Major Incident

When `major_incident = true` (not currently a global variable — needs to be added):

- Both nurses move faster throughout (higher patrol speed)
- Shorter dwell times
- Dialogue changes to the single-line brush-off: "I can't stop right now — speak to the ward sister."

No mechanism currently exists to change patrol speed or dwell times via an event mapping.

---

## 3. Current Engine Capabilities (Reference)

From reading `npc-behavior.js` and `npc-pathfinding.js`:

### 3.1 What Works Today

| Capability | Implementation |
|---|---|
| Waypoint patrol (sequential or random) | `behavior.patrol.waypoints` array with `{x, y}` tile coords |
| Dwell time at each waypoint | `waypoint.dwellTime` (ms); handled by `patrolReachedTime` logic in `updatePatrol()` |
| Patrol speed | `behavior.patrol.speed` (px/s); static at config time |
| Face player when nearby | `facePlayer` + `facePlayerDistance` config |
| Multi-room patrol | `behavior.patrol.multiRoom: true` + `route` array |
| Event-triggered knot changes | `eventMappings` with `targetKnot` and `conversationMode` |
| Event-triggered global var changes | `eventMappings` with `setGlobal` |
| Initially hidden NPCs | `behavior.initiallyHidden: true` |
| Home return when pushed | Automatic `checkAndHandleHomePush()` for stationary NPCs |
| EasyStar pathfinding to waypoints | `NPCPathfindingManager.findWorldPath()` |

### 3.2 What Is Missing

| Missing Capability | Where It's Needed |
|---|---|
| Interrupt patrol and go to a single target, then stop | Patrol nurse → Bed 4 on escalation |
| Reveal a hidden NPC via event | Pharmacist appearance |
| Change patrol speed via event | Both nurses on major incident |
| Change waypoint dwell times via event | Both nurses on major incident |
| State-driven sprite/animation on NPC (not object) | Bed patient state display |
| `setState('patrolSpeed', n)` method | General patrol speed changes |

---

## 4. Gap Analysis and Proposed Solutions

### Gap 1: Interrupt-to-Single-Target Patrol

**Required behaviour:** When `bed4_escalated = true`, patrol nurse abandons current path, pathfinds to Bed 4 world position, arrives and stops (does not continue patrol loop).

**Proposed engine change — `npc-behavior.js`:**

Add a new method `goToAndStay(worldX, worldY, speed?)` to `NPCBehavior`:

```javascript
/**
 * Override current patrol with a single destination.
 * NPC walks to the target at the given speed, then stops permanently.
 * Use for event-driven interrupts (e.g., nurse rushing to an emergency bed).
 *
 * @param {number} worldX - Target world X
 * @param {number} worldY - Target world Y
 * @param {number} [speed] - Override patrol speed for this move
 */
goToAndStay(worldX, worldY, speed) {
    // Stop current movement
    this.currentPath = [];
    this.patrolTarget = null;
    this.pathIndex = 0;
    this.lastPatrolChange = 0;
    this.patrolReachedTime = 0;

    // Set a single non-looping waypoint
    const tileX = Math.round(worldX / TILE_SIZE);
    const tileY = Math.round(worldY / TILE_SIZE);
    this.config.patrol.waypoints = [{
        tileX, tileY,
        worldX, worldY,
        dwellTime: 0
    }];
    this.config.patrol.waypointMode = 'sequential';
    this.config.patrol.waypointIndex = 0;
    this.config.patrol.enabled = true;
    this._stopOnArrival = true; // New flag: disable patrol after reaching this waypoint

    // Optionally override speed
    if (speed !== undefined) {
        this._tempSpeed = this.config.patrol.speed;
        this.config.patrol.speed = speed;
    }
}
```

**⚠️ Critical placement note:** The `_stopOnArrival` check must NOT go at the top of `chooseNewPatrolTarget()`. If placed there, it would fire the moment `goToAndStay()` clears the patrol state — before the NPC has taken a single step — causing the nurse to freeze in place rather than rushing to the bed.

The check belongs in the **path-completion handler** inside `updatePatrol()`, where it runs only after the NPC has actually arrived at the destination:

```javascript
// Inside updatePatrol(), in the path-completion block:
if (this.pathIndex >= this.currentPath.length) {
    if (this._stopOnArrival) {
        // NPC has arrived at its emergency destination — stop permanently
        this._stopOnArrival = false;
        this.config.patrol.enabled = false;
        if (this._tempSpeed !== undefined) {
            this.config.patrol.speed = this._tempSpeed;
            this._tempSpeed = undefined;
        }
        this.sprite.body.setVelocity(0, 0);
        this.isMoving = false;
        console.log(`🏥 [${this.npcId}] Arrived at emergency target, stopping patrol`);
        return;
    }
    this.patrolReachedTime = time;
    this.chooseNewPatrolTarget(time);
    return;
}
```

`chooseNewPatrolTarget()` itself requires no modification for `_stopOnArrival` — it simply isn't called when `_stopOnArrival` intercepts the path-completion.

**Expose via `NPCBehaviorManager`:**

```javascript
/**
 * Command an NPC to walk to a world position and stop there.
 * Used for event-driven interrupts (bed escalations, emergency responses).
 */
goToAndStay(npcId, worldX, worldY, speed) {
    const behavior = this.behaviors.get(npcId);
    if (behavior) {
        behavior.goToAndStay(worldX, worldY, speed);
    } else {
        console.warn(`⚠️ goToAndStay: no behavior for ${npcId}`);
    }
}
```

**New eventMapping action in `npc-manager.js`:**

Support a `patrolOverride` action in eventMappings:

```json
{
    "eventPattern": "global_variable_changed:bed4_escalated",
    "condition": "value === true",
    "onceOnly": true,
    "patrolOverride": {
        "targetTile": { "x": 7, "y": 5 },
        "speed": 150,
        "stopOnArrival": true
    }
}
```

When the npc-manager processes this action, it resolves `targetTile` to world coordinates using the NPC's current room data, then calls `window.npcBehaviorManager.goToAndStay(npcId, worldX, worldY, speed)`.

**Tile-to-world conversion (implementation detail for `npc-manager.js`):**

The patrol nurse is always in `ward_7`, so the room lookup is straightforward. The handler should:

```javascript
if (config.patrolOverride && window.npcBehaviorManager) {
    const behavior = window.npcBehaviorManager.behaviors.get(npcId);
    if (behavior) {
        const tile = config.patrolOverride.targetTile;
        const speed = config.patrolOverride.speed;
        // room.position.x/y are already in world pixel coords — do NOT multiply by TILE_SIZE.
        // This matches the pattern used by validateWaypoints() in npc-behavior.js:
        //   worldX = roomWorldX + (wp.x * TILE_SIZE)
        const roomId = behavior.roomId; // populated at NPCBehavior construction time
        const room = window.rooms && window.rooms[roomId];
        if (room) {
            const worldX = room.position.x + (tile.x * TILE_SIZE);
            const worldY = room.position.y + (tile.y * TILE_SIZE);
            window.npcBehaviorManager.goToAndStay(npcId, worldX, worldY, speed);
        }
    }
}
```

> **Prerequisite:** `behavior.roomId` must be populated when the NPCBehavior is constructed (i.e., pass the room id during NPC registration). Verify this is already stored on the behavior object, or add it to the `NPCBehavior` constructor.

**Scenario change required:** Update `patrol_nurse` eventMapping for `bed4_escalated` to include `patrolOverride`.

---

### Gap 2: NPC Visibility Toggle (Reveal Hidden NPC)

**Required behaviour:** `pharmacist_npc` starts hidden (`initiallyHidden: true`). When `pharmacist_on_ward = true`, the NPC sprite becomes visible and begins its patrol loop.

**Proposed engine change — `npc-manager.js` + rooms.js/npc-sprite system:**

The challenge is that `initiallyHidden: true` prevents the sprite from being created. Two approaches:

**⚠️ Pre-implementation investigation required:** Before beginning this phase, read the NPC sprite creation pipeline to confirm what `initiallyHidden: true` currently does. There are two possible states:

- **If the pipeline creates a sprite but hides it** (e.g., `alpha=0`): Option A below applies directly — `setNPCVisible()` just needs to re-enable alpha and the physics body.
- **If the pipeline skips sprite creation entirely** (most likely, based on engine patterns): Option A requires changes to the sprite creation code first, to ensure a sprite exists at load time. Without that, `setNPCVisible()` has nothing to operate on.

The estimated scope of Phase 3 (~45 lines) assumes Option A applies without sprite creation changes. If the pipeline skips creation, the scope is larger.

**Option A (Simpler, Recommended for Draft):** Create the sprite but keep it invisible and out of the pathfinding collision. On reveal event, make visible and start patrol.

In the NPC sprite creation pipeline, check `behavior.initiallyHidden`:
- If true: create sprite with `alpha = 0` and physics body disabled (rather than skipping creation)
- On reveal: `sprite.setAlpha(1)`, `body.enable = true`, start patrol

This is safer than "not creating" the sprite because the behavior is already registered at load time.

**New eventMapping action `setVisible: true`:**

```json
{
    "eventPattern": "global_variable_changed:pharmacist_on_ward",
    "condition": "value === true",
    "onceOnly": true,
    "setVisible": true
}
```

In `_handleEventMapping()` in npc-manager, process `setVisible` (note: use `config.*` — the function receives `config`, not `mapping`):

```javascript
if (config.setVisible !== undefined) {
    if (window.npcBehaviorManager) {
        window.npcBehaviorManager.setNPCVisible(npcId, config.setVisible);
    }
}
```

In `NPCBehaviorManager`:

```javascript
setNPCVisible(npcId, visible) {
    const behavior = this.behaviors.get(npcId);
    if (!behavior) return;
    const sprite = behavior.sprite;
    if (!sprite) return;
    sprite.setAlpha(visible ? 1 : 0);
    if (sprite.body) {
        sprite.body.enable = visible;
    }
    // If revealing and patrol is configured, enable it
    // No need to save/restore _originalPatrolConfig — the patrol config is
    // already present in behavior.config.patrol (parsed at construction time).
    // It was only disabled at construction to prevent movement while hidden.
    if (visible && behavior.config.patrol.waypoints?.length > 0) {
        behavior.config.patrol.enabled = true;
    }
    console.log(`👁️ [${npcId}] Visibility set to ${visible}`);
}
```

**Option B (More Complex, for Production):** Don't create the sprite at all initially. When the reveal event fires, spawn the NPC sprite at its defined position. This requires the sprite creation pipeline to be callable post-load, which is a larger engine change.

**Recommendation:** Use Option A for the draft. It's clean, reversible, and avoids re-architecting the spawn pipeline.

**Scenario change required:** Remove the self-referential `setGlobal: { pharmacist_on_ward: true }` from the pharmacist eventMapping. Replace with `setVisible: true`. The `pharmacist_on_ward` global should be set by Helen Carver's eventMapping in the Major Incident Room (which fires when `drug_library_compromised = true` or `network_isolated = true`).

---

### Gap 3: Patrol Speed Override via Event

**Required behaviour:** When `major_incident = true`, both nurses move faster and dwell less.

**Note:** `major_incident` is not currently in `globalVariables`. It needs to be added. It would be set when the player triggers the Major Incident declaration (via a future game mechanic — or it could be pre-set to `false` and triggered by an NPC dialogue choice).

**Proposed engine change — `npc-behavior.js`:**

Extend `setState()`:

```javascript
case 'patrolSpeed':
    this.config.patrol.speed = value;
    console.log(`🏃 ${this.npcId} patrol speed set to ${value}`);
    break;

case 'dwellMultiplier':
    // Scale all waypoint dwell times
    if (this.config.patrol.waypoints) {
        this.config.patrol.waypoints.forEach(wp => {
            // Persist the original value so repeated calls don't compound the multiplier
            wp._baseDwellTime = wp._baseDwellTime || wp.dwellTime || 0;
            wp.dwellTime = Math.round(wp._baseDwellTime * value);
        });
    }
    break;
```

**New eventMapping action `setPatrolSpeed`:**

```json
{
    "eventPattern": "global_variable_changed:major_incident",
    "condition": "value === true",
    "onceOnly": true,
    "setPatrolSpeed": 150,
    "setDwellMultiplier": 0.3,
    "targetKnot": "major_incident_line"
}
```

In `_handleEventMapping()` in npc-manager (use `config.*` — not `mapping.*`):

```javascript
if (config.setPatrolSpeed !== undefined && window.npcBehaviorManager) {
    window.npcBehaviorManager.setBehaviorState(npcId, 'patrolSpeed', config.setPatrolSpeed);
}
if (config.setDwellMultiplier !== undefined && window.npcBehaviorManager) {
    window.npcBehaviorManager.setBehaviorState(npcId, 'dwellMultiplier', config.setDwellMultiplier);
}
```

**Scenario change required:** Add `major_incident: false` to `globalVariables`. Add eventMappings to `patrol_nurse` and `sarah_mitchell` for this event. Add `major_incident` as a knot to each relevant Ink file with the single brush-off line.

### Required: Update `_setupEventMappings()` to forward new action fields

**⚠️ Critical implementation note for all new action types (Gaps 1–3):**

`_handleEventMapping()` receives a `config` object that is built by `_setupEventMappings()` from the raw `mapping` JSON. The current `config` object captures only a fixed set of known fields. The four new action fields must be explicitly forwarded — otherwise `_handleEventMapping` will see them as `undefined` and all new handlers will silently never fire.

**Required change to `_setupEventMappings()` in `npc-manager.js`:**

```javascript
const config = {
    // ... all existing fields (knot, bark, once, setGlobal, completeTask, etc.) ...
    // NEW — add these four lines:
    setVisible:         mapping.setVisible         ?? undefined,
    patrolOverride:     mapping.patrolOverride      || null,
    setPatrolSpeed:     mapping.setPatrolSpeed      ?? undefined,
    setDwellMultiplier: mapping.setDwellMultiplier  ?? undefined,
};
```

This single change gates all four new action handlers. Without it, no Phase 2, 3, or 4 event actions will work regardless of the handler code added to `_handleEventMapping()`.

---

### Gap 4: Bed Patient NPC State Display

**Required behaviour:** Bed patient NPCs change their visual appearance based on `patient_bed4_state` and `patient_bed2_state`. States: `resting_unmonitored`, `distressed`, `critical`, `attended`.

**The challenge:** Current NPC sprites are a single sprite sheet with walk/idle animations. There is no mechanism to switch sprite variants or play a specific named animation based on a global variable.

**Two-tier approach:**

**Tier 1 — Text/Ink State (Draft, No Engine Change):**
Each bed patient NPC has Ink knots for each state. When the global variable changes, the eventMapping fires and changes the NPC's `currentKnot`. The player who approaches gets a contextually appropriate observation line describing the patient's state. No visual animation change — just text feedback.

This is achievable with current engine, using eventMappings:

```json
{
    "eventPattern": "global_variable_changed:patient_bed4_state",
    "condition": "value === 'distressed'",
    "onceOnly": true,
    "targetKnot": "state_distressed",
    "conversationMode": "person-chat"
}
```

**Tier 2 — Visual State (Production Enhancement):**
Add a `spriteVariant` mechanism. Each NPC can have a `spriteVariants` map in its config, keyed by a global variable name:

```json
"spriteVariants": {
    "globalVar": "patient_bed4_state",
    "mapping": {
        "resting_unmonitored": "bed_patient_idle",
        "distressed": "bed_patient_restless",
        "critical": "bed_patient_flat",
        "attended": "bed_patient_attended"
    }
}
```

In `NPCBehavior.update()`, check if the global has changed and call `playAnimation()` with the mapped animation key.

**Recommendation:** Implement Tier 1 for the draft (Ink-only state changes). Defer Tier 2 to post-draft sprite work, when the clinical sprite assets are commissioned.

---

## 5. Bed Patient NPC Definitions (Scenario JSON)

The following two NPCs need to be added to `scenario.json.erb` under `ward_7.npcs`. They are currently absent — the bed patient states are tracked only as global variables with no in-world NPC representation.

### 5.1 Bed 4 Patient (Mr T. Ahmed)

```json
{
    <%# PLACEHOLDER: spriteSheet "male_patient" does not exist yet. Replace when clinical sprite commissioned.
        female_blowse is wrong for a named male character. %>
    "id": "bed4_patient",
    "displayName": "Mr T. Ahmed",
    "npcType": "person",
    "position": { "x": 8, "y": 5 },
    "spriteSheet": "female_blowse",
    <%# REMOVE spriteSheet placeholder above and replace with correct male patient sprite asset key %>
    "spriteConfig": { "idleFrameRate": 4, "walkFrameRate": 8 },
    "storyPath": "scenarios/sis01_healthcare/ink/npc_bed4_patient.json",
    "currentKnot": "state_resting_unmonitored",
    "voice": {
        "name": "Charon",
        "style": "Weak, unwell, elderly patient",
        "language": "en-GB"
    },
    "behavior": {
        "initiallyHidden": false,
        "facePlayer": false
    },
    "eventMappings": [
        {
            "eventPattern": "global_variable_changed:patient_bed4_state",
            "condition": "value === 'distressed'",
            "onceOnly": true,
            "targetKnot": "state_distressed"
        },
        {
            "eventPattern": "global_variable_changed:patient_bed4_state",
            "condition": "value === 'critical'",
            "onceOnly": true,
            "targetKnot": "state_critical"
        },
        {
            "eventPattern": "global_variable_changed:patient_bed4_state",
            "condition": "value === 'attended'",
            "onceOnly": true,
            "targetKnot": "state_attended"
        }
    ]
}
```

**Ink knots required (`npc_bed4_patient.ink`):**

```ink
=== state_resting_unmonitored ===
// Player approaches the bed. Patient is unaware of the alarm above.
The monitor above Bed 4 is alarming. Mr Ahmed is lying still, eyes closed, breathing irregularly. He doesn't respond when you approach. The bedside alarm has been active for some time.
-> END

=== state_distressed ===
Mr Ahmed shifts restlessly in the bed, pressing the call bell repeatedly. His vital signs on the bedside screen are deteriorating.
-> END

=== state_critical ===
Mr Ahmed is motionless. The bedside monitor shows a flat-line alarm pattern. Nobody at the nursing station can see this — the central station is offline.
-> END

=== state_attended ===
The Staff Nurse is standing at Mr Ahmed's bedside, attending to him. She gives you a brief, worried look.
-> END
```

### 5.2 Bed 2 Patient (Ms A. Okafor)

```json
{
    "id": "bed2_patient",
    "displayName": "Ms A. Okafor",
    "npcType": "person",
    "position": { "x": 4, "y": 5 },
    "spriteSheet": "female_blowse",
    "spriteConfig": { "idleFrameRate": 4, "walkFrameRate": 8 },
    "storyPath": "scenarios/sis01_healthcare/ink/npc_bed2_patient.json",
    "currentKnot": "state_stable",
    "voice": {
        "name": "Emma",
        "style": "Drowsy, post-surgical patient",
        "language": "en-GB"
    },
    "behavior": {
        "initiallyHidden": false,
        "facePlayer": false
    },
    "eventMappings": [
        {
            "eventPattern": "global_variable_changed:patient_bed2_state",
            "condition": "value === 'sedated'",
            "onceOnly": true,
            "targetKnot": "state_sedated"
        },
        {
            "eventPattern": "global_variable_changed:patient_bed2_state",
            "condition": "value === 'critical'",
            "onceOnly": true,
            "targetKnot": "state_critical"
        }
    ]
}
```

**Ink knots required (`npc_bed2_patient.ink`):**

```ink
=== state_stable ===
Ms Okafor is resting quietly. A morphine infusion runs via the pump on the pole beside her bed. The pump display shows the current rate.
-> END

=== state_sedated ===
Ms Okafor is slumped to one side, unresponsive. Her breathing is shallow. The pump indicator is glowing amber.
-> END

=== state_critical ===
Ms Okafor is critically unresponsive. The pump accepted the entered rate without flagging an error. 
-> END
```

### 5.3 Chair Patient Witness (Mrs Kowalski) — Bed 2 Witness Arc

Mrs Kowalski is already defined in the scenario at position `{ x: 7, y: 4 }` (sitting in a chair near Bed 2). Her design purpose (from `new_objects_planning.md`) is to draw attention to the Bed 2 deterioration arc — she is the witness NPC for `patient_bed2_state`. Without Ink updates, she is static and silent regardless of what happens at Bed 2.

**Two new knots required in her Ink file:**

| Knot | Trigger | Purpose |
|---|---|---|
| `stable_witness` | Starting state | Neutral observation of ward |
| `sedated_witness` | `patient_bed2_state === 'sedated'` | Draws player's attention to Bed 2 |
| `critical_witness` | `patient_bed2_state === 'critical'` | Urgent — patient visibly in distress |

**Add to `npc_kowalski.ink` (or existing Kowalski Ink file):**

```ink
=== stable_witness ===
The lady in the next bed was asking for the nurse earlier. She seemed a bit groggy after her operation, but they said that's normal.
-> END

=== sedated_witness ===
I'm not sure she's alright. She was trying to call out but she can't seem to wake up properly. Is that normal?
-> END

=== critical_witness ===
Please, someone needs to look at her — she's not responding at all! I've been pressing the call bell but nobody's coming!
-> END
```

**Add to `chair_patient` (Mrs Kowalski) `eventMappings` in `scenario.json.erb`:**

```json
{
    "eventPattern": "global_variable_changed:patient_bed2_state",
    "condition": "value === 'sedated'",
    "onceOnly": true,
    "targetKnot": "sedated_witness"
},
{
    "eventPattern": "global_variable_changed:patient_bed2_state",
    "condition": "value === 'critical'",
    "onceOnly": true,
    "targetKnot": "critical_witness"
}
```

> **Note:** Verify the NPC id for Mrs Kowalski in `scenario.json.erb` (it may be `chair_patient` or `kowalski_npc`) before adding these eventMappings. Also confirm the name of her existing Ink file.

---

## 6. Patrol Nurse — Updated Scenario Config

The existing `patrol_nurse` entry needs updates:

### 6.1 Add dwell times to waypoints

Current waypoints have no dwell time. The monitoring-offline manual rounds routine requires 8 seconds at each bed:

```json
"patrol": {
    "waypoints": [
        { "x": 5, "y": 3, "dwellTime": 3000 },
        { "x": 2, "y": 5, "dwellTime": 8000 },
        { "x": 4, "y": 5, "dwellTime": 8000 },
        { "x": 6, "y": 5, "dwellTime": 8000 },
        { "x": 8, "y": 5, "dwellTime": 8000 },
        { "x": 2, "y": 8, "dwellTime": 8000 },
        { "x": 4, "y": 8, "dwellTime": 8000 }
    ],
    "waypointMode": "sequential",
    "loop": true,
    "speed": 80
}
```

The nursing station (x:5, y:3) has a shorter dwell (3 seconds) — the nurse glances at the blank screen and moves on. Each bed gets 8 seconds of "manual check" dwell time. This makes the visual consequence of the monitoring loss legible — the nurse is clearly busy doing everything by hand.

### 6.2 Add patrolOverride eventMapping for bed4_escalated

Replace the existing `bed4_escalated` eventMapping with:

```json
{
    "eventPattern": "global_variable_changed:bed4_escalated",
    "condition": "value === true",
    "onceOnly": true,
    "setGlobal": { "patrol_nurse_at_bed4": true },
    "targetKnot": "rushing_bed4",
    "conversationMode": "person-chat",
    "background": "assets/backgrounds/hq1.png",
    "patrolOverride": {
        "targetTile": { "x": 7, "y": 5 },
        "speed": 150,
        "stopOnArrival": true
    }
}
```

> **Sprite overlap note:** `bed4_patient` is at `{ x: 8, y: 5 }`. The nurse stops at `{ x: 7, y: 5 }` (the adjacent tile to the left) so both sprites are not rendered on top of each other. The `state_attended` Ink text for `bed4_patient` should reflect this: "The Staff Nurse is standing at Mr Ahmed's bedside."

The `conversationMode: person-chat` fires the one-line dialogue, and `patrolOverride` physically reroutes the nurse. Both happen simultaneously on the same event.

---

## 7. Pharmacist NPC — Corrected Trigger Logic

### 7.1 Problem with current config

The pharmacist's current eventMapping is:
```json
{
    "eventPattern": "global_variable_changed:pharmacist_on_ward",
    "condition": "value === true",
    "onceOnly": true,
    "setGlobal": { "pharmacist_on_ward": true }
}
```

This is a no-op (sets a variable to the value it just received). The pharmacist needs to be revealed from Helen Carver's room, not self-triggered.

### 7.2 Corrected approach

**In `major_incident_room` NPCs — Helen Carver eventMappings:**

Add a trigger on `drug_library_compromised` (which fires when the drug library tamper is found):

```json
{
    "eventPattern": "global_variable_changed:drug_library_compromised",
    "condition": "value === true",
    "onceOnly": true,
    "setGlobal": { "pharmacist_on_ward": true },
    "conversationMode": "person-chat",
    "targetKnot": "post_drug_tamper",
    "background": "assets/backgrounds/hq1.png"
}
```

**In `pharmacist_npc` eventMappings:**

```json
{
    "eventPattern": "global_variable_changed:pharmacist_on_ward",
    "condition": "value === true",
    "onceOnly": true,
    "setVisible": true,
    "targetKnot": "start"
}
```

The `setVisible: true` action (new engine feature — Gap 2 above) reveals the sprite and enables the physics body. The patrol loop begins automatically since `behavior.patrol` is already configured.

### 7.3 Pharmacist Spawn Position

The README states: "Omit `position` only if `behavior.initiallyHidden: true`." However, the sprite creation pipeline still needs to know where to place the pharmacist's sprite when it is revealed. **A `position` must be defined** even for `initiallyHidden: true` NPCs — it becomes the spawn/reveal location.

The pharmacist's patrol route in the existing scenario passes through the drug administration area. A sensible spawn point (ward entrance, near the drug trolley area) should be confirmed by checking the ward_7 room map. As a draft placeholder:

```erb
<%# Pharmacist position { x: 3, y: 2 } is a placeholder.
    Confirm against ward_7 tile map — should be ward entrance or medication room doorway. %>
{
    "id": "pharmacist_npc",
    "displayName": "Ward Pharmacist",
    "npcType": "person",
    "position": { "x": 3, "y": 2 },
    "behavior": {
        "initiallyHidden": true,
        "patrol": { ... }
    }
}
```

When `setNPCVisible()` is called, the sprite is already at this position (hidden), so no teleport is required — it simply becomes visible in place and begins its patrol.

> **JSON annotation convention:** The scenario file is a `.json.erb` template. Use ERB comments (`<%# note %>`) for development annotations rather than non-standard underscore-prefixed JSON fields (e.g. `_spriteNote`). ERB comments are stripped before the JSON is parsed by the engine, so they carry zero risk of unexpected field handling. All annotation notes in the scenario JSON snippets in this plan should use ERB comment syntax.

---

## 8. Sarah Mitchell — Interaction with Bed4 Escalation

Sarah's current eventMappings react to `network_isolated` and `drug_library_compromised`. Her role in the bed4 escalation is:
- She delivers the line "Good. Now, can you tell me what's happening with the systems?" after the player escalates
- This is an Ink choice in `npc_sarah.ink`, not an eventMapping

However, after `bed4_escalated = true`, Sarah should also continue her patrol (she is the charge nurse; she doesn't go to Bed 4 herself — the second nurse does). Sarah should:
1. Continue her current position/patrol (she stays near the nursing station area)
2. Change her dialogue knot to `post_escalation` (reflects patient now attended)

**Add eventMapping to `sarah_mitchell`:**

```json
{
    "eventPattern": "global_variable_changed:bed4_escalated",
    "condition": "value === true",
    "onceOnly": true,
    "targetKnot": "post_escalation"
}
```

**Add knot to `npc_sarah.ink`:**

```ink
=== post_escalation ===
Good. The second nurse is with him now. I need to keep doing these rounds — if you find out what's happening with the systems, please come back to me.
-> END
```

---

## 8b. Patrol Nurse — New Ink Knots

The patrol nurse requires three new knots. Note: `rushing_bed4` uses `-> at_bed4` (not `-> END`) so the story pointer advances internally. When the player next approaches the nurse, `currentKnot` is still `rushing_bed4` in the engine's NPC record, but the Ink story itself has already run past `rushing_bed4` and is paused at the start of `at_bed4`. This means the next player approach will open at `at_bed4` automatically — no engine-side `persistentKnot` mechanism is needed.

> **Verify before implementation:** Confirm that the PersonChat minigame preserves Ink story state across separate conversation sessions (i.e., does it call `story.ContinueMaximally()` on re-open, or does it re-jump to `currentKnot` each time?). If it re-jumps to `currentKnot`, use a `setKnot` eventMapping action after the `rushing_bed4` conversation closes instead.

**Add to `npc_patrol_nurse.ink`:**

```ink
=== rushing_bed4 ===
I'm going to him now — stay out of the way.
-> at_bed4

=== at_bed4 ===
I'm here with him. Something's very wrong. What's happening with your investigation?
-> END

=== major_incident_line ===
I can't stop right now — speak to the ward sister.
-> END
```

The `rushing_bed4` knot is set as `currentKnot` by the eventMapping and opened immediately as a `person-chat` when `bed4_escalated` fires. The line plays once. On subsequent player approaches, the Ink story is positioned at `at_bed4`.

---

## 9. Global Variables to Add

The following global variables are missing from `scenario.json.erb` and need to be added:

```json
"major_incident": false,
"major_incident_declared_time": 0,
"ward_monitoring_timeout_started": false
```

`major_incident` is referenced in the design docs but not yet in the scenario. The timing variables are useful for driving the bed patient state timer logic (Bed 4's progression from `resting_unmonitored` → `distressed` → `critical`).

### What Sets `major_incident = true`?

The review correctly flags this as undefined. Based on `be_scenario_walkthrough.md` and `new_objects_planning.md`, the intended trigger is:

> **When `patient_bed4_state` reaches `critical` AND `bed4_escalated` is still `false`** — i.e., the patient has deteriorated to a critical state without the player having escalated. This represents the scenario's worst outcome: an unmitigated patient deterioration.

Alternatively, from the walkthrough's "cascade consequence" logic, `major_incident` may also be declared if `patient_bed4_deceased = true`.

**Proposed trigger:** Add an eventMapping to `bed4_patient` (or Sarah Mitchell as charge nurse) that fires on `patient_bed4_state === 'critical'`:

```json
{
    "eventPattern": "global_variable_changed:patient_bed4_state",
    "condition": "value === 'critical'",
    "onceOnly": true,
    "setGlobal": { "major_incident": true, "major_incident_declared_time": 0 }
}
```

> **Design note:** This is a reasonable interpretation for the draft. Confirm with the game design documents before hardcoding — the walkthrough may specify a different precise trigger point (e.g., only if the player has completed a specific objective). Document the design decision explicitly in the scenario file's comments when implemented.

---

## 10. Timer-Driven Patient State Progression

The walkthrough specifies:
- At 8 in-game minutes without escalation: `patient_bed4_state → distressed`
- At 15 minutes: `patient_bed4_state → critical`
- At 22 minutes: `patient_bed4_state → deceased` (sets `patient_bed4_deceased = true`)

> **Timing discrepancy:** `new_objects_planning.md` states "after approximately 10 in-game minutes" for the first deterioration. The walkthrough says 8 minutes. This plan uses 8 minutes (aligned to the walkthrough's more specific language). Confirm the correct value before hardcoding `delayMs`.

This requires a timer system driving global variable changes. BreakEscape does not currently have a built-in countdown timer that fires events — the closest is the SIEM dashboard's internal timer and the ICO notification deadline logic.

**Options:**

**Option A — Ink-side timer (simple):** Sarah Mitchell's Ink story uses Ink's `#timer` tag (if supported) or a series of choices with long delays. Not clean — Ink is not a reliable real-time timer.

**Option B — Scenario-level timer events (new engine feature):** Add a `timers` section to the scenario:

> **⚠️ Condition evaluator incompatibility:** The existing `safeEvaluateCondition()` in `npc-manager.js` only handles patterns like `value OP literal` and `data.prop OP literal`. It does not support `globalVars.X`, negation (`!`), or compound expressions. The `condition` strings below (e.g., `"!globalVars.bed4_escalated"`) would fail silently using the current evaluator. If Option B is implemented, either: (a) extend `safeEvaluateCondition()` to handle `globalVars.X` and negation, or (b) restructure the condition to a supported pattern (e.g., pass `bed4_escalated` as `data.value` and use `"value === false"`). Option C avoids this entirely.

```json
"timers": [
    {
        "id": "bed4_deterioration_1",
        "delayMs": 480000,
        "condition": "!globalVars.bed4_escalated",
        "setGlobal": { "patient_bed4_state": "distressed" },
        "onceOnly": true
    },
    {
        "id": "bed4_deterioration_2",
        "delayMs": 900000,
        "condition": "!globalVars.bed4_escalated",
        "setGlobal": { "patient_bed4_state": "critical" },
        "onceOnly": true
    },
    {
        "id": "bed4_deterioration_3",
        "delayMs": 1320000,
        "condition": "!globalVars.bed4_escalated",
        "setGlobal": { "patient_bed4_state": "deceased", "patient_bed4_deceased": true },
        "onceOnly": true
    }
]
```

The engine processes this in `game.js` — on each timer delay expiry, checks the condition against current globalVars, and if met, fires the `setGlobal`.

**Option C — Workaround using NPC timed conversations:** Use Sarah Mitchell's `timedMessages` equivalent — trigger a timed conversation that fires Ink which sets a global via `#set_global:` tag. This is already a pattern used for debrief sequencing.

**Recommendation:** Option B is the cleanest long-term solution and has broad applicability (the ICO deadline also needs this). Option C is the fastest workaround for the draft. Both Options A and C use existing infrastructure and are lower risk.

For the draft: **use Option C** (NPC timed conversations as a proxy timer). For production: implement Option B as a reusable timer system.

---

### 10.x — Countdown Timer HUD Widget

When the `timers` array is present in the scenario and at least one timer has `showCountdown: true`, a small non-intrusive countdown widget is shown on screen counting down to the next pending event.

#### Scenario configuration

Each timer can opt in with two optional display fields:

```json
{
    "id": "bed4_deterioration_1",
    "delayMs": 480000,
    "condition": "!globalVars.bed4_escalated",
    "setGlobal": { "patient_bed4_state": "distressed" },
    "onceOnly": true,
    "showCountdown": true,
    "label": "Patient deterioration"
}
```

`showCountdown` and `label` are display-only — they do not affect timer firing logic. When multiple timers have `showCountdown: true`, the widget shows the soonest pending one (smallest remaining `delayMs`). Once that fires, it transitions to the next soonest remaining. When no pending `showCountdown` timers remain, the widget hides itself.

#### Widget design

Consistent with the pixel-art aesthetic (`2px` borders, no `border-radius`, `border-color: #c0c0c0`). Positioned at **top-centre** of the viewport to avoid clashing with the objectives panel (top-right) and the HUD bar (bottom). Fixed-position, high `z-index`, `pointer-events: none`.

```
┌──────────────────────────────┐
│  PATIENT DETERIORATION       │
│           07:42              │
└──────────────────────────────┘
```

Urgency colouring (background tint only — no animation, consistent with pixel-art aesthetic):

| Remaining time | Background | Border | Text |
|---|---|---|---|
| > 5 min | `#1a1a2e` (dark neutral) | `#c0c0c0` | white |
| 1–5 min | `#8b6900` (amber) | `#ffd700` | white |
| < 1 min | `#8b0000` (red) | `#ff4444` | white |

#### New file — `public/break_escape/js/ui/scenario-timer.js`

```javascript
export class ScenarioTimerUI {
    constructor(timers, startTime) {
        // startTime: Date.now() snapshot when the scenario started (from game.js)
        this._tracked = timers.filter(t => t.showCountdown);
        this._fired = new Set();
        this._startTime = startTime;
        this._el = null;
        this._tickHandle = null;

        if (this._tracked.length > 0) {
            this._createEl();
            this._tick();
        }
    }

    /** Called by the timer system (game.js) each time a timer fires. */
    markFired(timerId) {
        this._fired.add(timerId);
        this._tick();
    }

    _createEl() {
        this._el = document.createElement('div');
        this._el.id = 'scenario-timer-display';
        document.body.appendChild(this._el);
    }

    _tick() {
        if (!this._el) return;

        const elapsed = Date.now() - this._startTime;
        const pending = this._tracked
            .filter(t => !this._fired.has(t.id))
            .sort((a, b) => a.delayMs - b.delayMs);

        if (pending.length === 0) {
            this._el.hidden = true;
            clearInterval(this._tickHandle);
            this._tickHandle = null;
            return;
        }

        const next = pending[0];
        const remaining = Math.max(0, next.delayMs - elapsed);
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        const clock = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        this._el.hidden = false;
        this._el.innerHTML =
            `<span class="scenario-timer-label">${next.label ?? 'Event'}</span>` +
            `<span class="scenario-timer-clock">${clock}</span>`;

        this._el.classList.toggle('scenario-timer--amber',
            remaining < 300000 && remaining >= 60000);
        this._el.classList.toggle('scenario-timer--red', remaining < 60000);

        if (!this._tickHandle) {
            this._tickHandle = setInterval(() => this._tick(), 1000);
        }
    }

    destroy() {
        clearInterval(this._tickHandle);
        this._tickHandle = null;
        this._el?.remove();
        this._el = null;
    }
}
```

#### Integration in `game.js`

After parsing `window.gameScenario.timers`, create the widget and record the scenario start time:

```javascript
// In game.js, after scenario timers are parsed:
if (window.gameScenario.timers?.some(t => t.showCountdown)) {
    const startTime = Date.now();
    window.scenarioTimerUI = new ScenarioTimerUI(window.gameScenario.timers, startTime);
    // Preserve startTime for timer condition checks
    window.gameState.scenarioStartTime = startTime;
}
```

When the timer system dispatches a timer event, call:

```javascript
if (window.scenarioTimerUI) {
    window.scenarioTimerUI.markFired(timer.id);
}
```

#### CSS — add to `public/break_escape/css/hud.css`

```css
#scenario-timer-display {
    position: fixed;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    background: #1a1a2e;
    border: 2px solid #c0c0c0;
    padding: 4px 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 120px;
    font-family: 'Press Start 2P', monospace, sans-serif;
    pointer-events: none;
    /* No border-radius — pixel-art convention */
}

.scenario-timer-label {
    font-size: 7px;
    color: #c0c0c0;
    text-transform: uppercase;
    letter-spacing: 1px;
    white-space: nowrap;
}

.scenario-timer-clock {
    font-size: 14px;
    color: #ffffff;
    letter-spacing: 2px;
}

#scenario-timer-display.scenario-timer--amber {
    background: #8b6900;
    border-color: #ffd700;
}

#scenario-timer-display.scenario-timer--amber .scenario-timer-label,
#scenario-timer-display.scenario-timer--amber .scenario-timer-clock {
    color: #ffffff;
}

#scenario-timer-display.scenario-timer--red {
    background: #8b0000;
    border-color: #ff4444;
}

#scenario-timer-display.scenario-timer--red .scenario-timer-label,
#scenario-timer-display.scenario-timer--red .scenario-timer-clock {
    color: #ffffff;
}
```

No `border-radius` on any rule — consistent with project CSS convention (2px borders, sharp corners).

#### Pause behaviour

The widget's `_tick()` computes remaining time from `Date.now() - startTime`. If the game is paused (e.g., a mini-game is open) the `setInterval` continues but the underlying timer system in `game.js` should also be paused (or skipped). The simplest approach: the timer dispatch loop in `game.js` only processes timers when the game scene is not paused. The UI widget will display a momentarily inaccurate value during the pause gap but will self-correct on resume at the next tick. For the draft this is acceptable.

#### Gameplay notes

- Keep `label` under ~20 characters — the `7px` font can accommodate roughly 22 characters at minimum width before the panel expands
- `pointer-events: none` — the widget cannot be accidentally clicked or block interactions
- If a timer's condition is false when `delayMs` expires (e.g., player has already escalated Bed 4), the timer fires no `setGlobal` action. `markFired()` should still be called so the widget removes that timer from the display

---

## 11. Summary of Engine Changes Required

| Change | File | Priority | Scope |
|---|---|---|---|
| `goToAndStay(worldX, worldY, speed)` on `NPCBehavior` | `npc-behavior.js` | **High** | ~40 lines |
| `_stopOnArrival` flag check in `updatePatrol()` path-completion block | `npc-behavior.js` | **High** | ~12 lines |
| `patrolOverride` action handler in eventMapping processing (with tile→world conversion) | `npc-manager.js` | **High** | ~30 lines |
| `setVisible: true/false` action in eventMapping processing | `npc-manager.js` | **High** | ~15 lines |
| `setNPCVisible(npcId, visible)` on `NPCBehaviorManager` | `npc-behavior.js` | **High** | ~20 lines |
| Sprite initially hidden as alpha=0 (not missing entirely) | NPC sprite creation code | **High** | ~10 lines |
| `setPatrolSpeed: n` action in eventMapping processing | `npc-manager.js` | **Medium** | ~10 lines |
| `setState('patrolSpeed', n)` handler | `npc-behavior.js` | **Medium** | ~5 lines |
| `setDwellMultiplier` action + handler | `npc-manager.js` + `npc-behavior.js` | **Low** | ~20 lines |
| Scenario-level `timers` system | `game.js` + scenario schema | **Medium** | ~80 lines |
| Countdown timer HUD widget (`ScenarioTimerUI`) | `scenario-timer.js` (new) + `game.js` + `hud.css` | **Medium** | ~80 lines |

Total estimated engine work: ~320 lines of targeted, well-scoped changes. No architectural changes required.

---

## 12. Summary of Scenario Changes Required

| Change | File | Priority |
|---|---|---|
| Add `bed4_patient` NPC definition | `scenario.json.erb` | **High** |
| Add `bed2_patient` NPC definition | `scenario.json.erb` | **High** |
| Add `dwellTime` to `patrol_nurse` waypoints | `scenario.json.erb` | **High** |
| Add `patrolOverride` to `patrol_nurse` bed4_escalated eventMapping | `scenario.json.erb` | **High** |
| Fix pharmacist eventMapping (remove self-referential setGlobal) | `scenario.json.erb` | **High** |
| Add `setVisible: true` to pharmacist eventMapping | `scenario.json.erb` | **High** |
| Add Helen Carver eventMapping to set `pharmacist_on_ward` | `scenario.json.erb` | **High** |
| Add `bed4_escalated` eventMapping to `sarah_mitchell` | `scenario.json.erb` | **Medium** |
| Add `major_incident` and timer globals | `scenario.json.erb` | **Medium** |
| Add `major_incident` eventMappings to both nurses | `scenario.json.erb` | **Low** |

---

## 13. Ink Files Required (New)

| File | NPC | Knots Required |
|---|---|---|
| `npc_bed4_patient.ink` | Bed 4 Patient | `state_resting_unmonitored`, `state_distressed`, `state_critical`, `state_attended` |
| `npc_bed2_patient.ink` | Bed 2 Patient | `state_stable`, `state_sedated`, `state_critical` |

**Additional knots to existing Ink files:**

| File | New Knot | Trigger |
|---|---|---|
| `npc_sarah.ink` | `post_escalation` | `bed4_escalated = true` |
| `npc_patrol_nurse.ink` | `rushing_bed4`, `at_bed4` | `bed4_escalated = true` |
| `npc_helen.ink` | `post_drug_tamper` (dispatches pharmacist) | `drug_library_compromised = true` |
| `npc_patrol_nurse.ink` | `major_incident_line` | `major_incident = true` |
| `npc_sarah.ink` | `major_incident_line` | `major_incident = true` |
| `npc_kowalski.ink` *(verify filename)* | `stable_witness`, `sedated_witness`, `critical_witness` | `patient_bed2_state` changes; `stable_witness` is starting knot |

---

## 14. Implementation Order (Recommended)

### Phase 1 — Scenario correctness (no engine changes needed)
1. Add `bed4_patient` and `bed2_patient` to `scenario.json.erb` (with placeholder sprite marked clearly)
2. Add `dwellTime` to `patrol_nurse` waypoints
3. Fix pharmacist eventMapping (remove self-referential setGlobal); add placeholder `position` to pharmacist NPC
4. Write all new Ink knots for bed patient NPCs (`npc_bed4_patient.ink`, `npc_bed2_patient.ink`)
5. Add `rushing_bed4` / `at_bed4` / `major_incident_line` knots to `npc_patrol_nurse.ink`
6. Add `post_escalation` and `major_incident_line` knots to `npc_sarah.ink`
7. Add `bed4_escalated` eventMapping to `sarah_mitchell`
8. Add `stable_witness` / `sedated_witness` / `critical_witness` knots to Mrs Kowalski Ink file; add eventMappings for `patient_bed2_state`
9. Add `major_incident` trigger eventMapping (fires on `patient_bed4_state === 'critical'`)

### Phase 2 — Engine: interrupt patrol (critical path)
1. Add `goToAndStay()` to `NPCBehavior`
2. Add `_stopOnArrival` check in `updatePatrol()` path-completion handler (**not** in `chooseNewPatrolTarget()` — see Gap 1 critical bug fix)
3. Add `patrolOverride` action handler in `npc-manager.js` (with tile→world conversion using `behavior.roomId`)
4. Update `patrol_nurse` eventMapping to use `patrolOverride` with `targetTile: { x: 7, y: 5 }`
5. Verify `rushing_bed4` → `at_bed4` Ink transition works correctly across PersonChat sessions (confirm story state is preserved, not re-jumped to `currentKnot`)

### Phase 3 — Engine: NPC visibility
0. **Pre-step:** Read the NPC sprite creation pipeline to confirm what `initiallyHidden: true` currently does (skips creation vs creates hidden). Scope the phase accordingly before writing any code.
1. If pipeline skips creation: modify it to create sprite with `alpha=0` + physics body disabled
2. Add `setNPCVisible()` to `NPCBehaviorManager` (using `behavior.config.patrol.enabled = true` — no `_originalPatrolConfig` save/restore needed)
3. Add `setVisible` action handler in `npc-manager.js`
4. Fix pharmacist reveal logic in scenario

### Phase 4 — Engine: patrol speed control
1. Add `setState('patrolSpeed', n)` to `NPCBehavior`
2. Add `setPatrolSpeed` action handler in npc-manager.js
3. Add major incident eventMappings to nurses

### Phase 5 — Timer system
1. Implement scenario-level `timers` in `game.js`
2. Add `showCountdown: true` and `label` fields to bed4 deterioration timer entries in `scenario.json.erb`
3. Implement `ScenarioTimerUI` in `public/break_escape/js/ui/scenario-timer.js`
4. Wire `markFired()` call into the game.js timer dispatch (fires regardless of whether the timer condition passed)
5. Add CSS rules to `public/break_escape/css/hud.css` (no `border-radius`, 2px borders)
6. Remove any workaround timed-conversation hacks

---

## 15. Key Design Constraints

### Bed NPCs as Waypoints
Since bed patients are now stationary NPCs (not objects), their tile positions are the authoritative waypoint coordinates for the patrol nurse. The positions defined in the NPC `position` field should be used as the basis for patrol waypoints — the nurse stops at the same or adjacent tile.

| Bed NPC | NPC Position | Patrol Nurse Waypoint | Notes |
|---|---|---|---|
| `bed4_patient` | `{ "x": 8, "y": 5 }` | `{ "x": 8, "y": 5, "dwellTime": 8000 }` | Standard patrol dwell (nurse walks to bed tile) |
| `bed2_patient` | `{ "x": 4, "y": 5 }` | `{ "x": 4, "y": 5, "dwellTime": 8000 }` | Standard patrol dwell |

**Exception — emergency arrival at Bed 4:** When `bed4_escalated` fires the `patrolOverride`, the nurse stops at `{ x: 7, y: 5 }` (one tile west of the bed) rather than at the bed tile itself. This prevents sprite overlap with the `bed4_patient` NPC who occupies `{ x: 8, y: 5 }`. The regular patrol loop uses `{ x: 8, y: 5 }` without issue because the nurse is only visiting briefly and then moving on — overlap during a dwell is less visually problematic than two sprites frozen at the same position indefinitely.

### Home-Return Behaviour
The `checkAndHandleHomePush()` mechanism in `npc-behavior.js` auto-returns stationary NPCs to their `homePosition` if pushed. This is desirable for bed patient NPCs (they should always be at their beds), but should be **disabled** for the patrol nurse (who is intentionally moving away from her home position). The patrol nurse has `patrol.enabled: true`, so `checkAndHandleHomePush()` will correctly skip her (it only applies to stationary NPCs). No config change needed.

### `facePlayer` for Bed Patients
Bed patient NPCs should **not** track and face the player — they are lying in bed and their facing direction is fixed. Set `facePlayer: false` in their behavior config. Sarah and the patrol nurse can retain the default `facePlayer: true` behaviour.

### Dwell Time at Nursing Station vs Beds
The nursing station dwell (3 seconds) is shorter than bed dwell (8 seconds) to convey that the station is useless offline — the nurse looks at the blank screen briefly, then moves on to do manual rounds. This asymmetry is important for communicating the clinical consequence of the attack to the player.
