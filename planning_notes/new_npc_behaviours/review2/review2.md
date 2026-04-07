# Technical Review 2 — New NPC Behaviours Plan (sis01_healthcare)

**Reviewer:** Claude (AI pair-review)  
**Date:** April 2026  
**Plan reviewed:** `planning_notes/new_npc_behaviours/plan.md` (updated version)  
**Prior review:** `planning_notes/new_npc_behaviours/review1/review.md`  
**Sources read:** `npc-behavior.js`, `npc-manager.js`, `scenario.json.erb`, `README_scenario_design.md`

---

## Section 1: Status of Each Review1 Finding

### Finding 1 — `_stopOnArrival` bug fix

**Status: RESOLVED ✅**

The updated plan correctly moves the `_stopOnArrival` check into the path-completion handler inside `updatePatrol()`, not into `chooseNewPatrolTarget()`. The proposed snippet intercepts the block at:

```javascript
if (this.pathIndex >= this.currentPath.length) {
    if (this._stopOnArrival) {
        this._stopOnArrival = false;
        this.config.patrol.enabled = false;
        // ...restore speed, zero velocity, return
    }
    this.patrolReachedTime = time;
    this.chooseNewPatrolTarget(time);
    return;
}
```

This is the correct location — it fires only after the NPC has traversed its full path to the target, not before departure. Cross-referencing with the actual `updatePatrol()` in `npc-behavior.js` (lines 753–761) confirms the placement is accurate.

The plan also explicitly notes why the old location was wrong (§4, Gap 1, ⚠️ Critical placement note). The fix is complete and correct.

One small note: the plan's `goToAndStay()` sets `dwellTime: 0` on the single-waypoint, so the dwell-time expiry path in `updatePatrol()` (lines 700–733) cannot fire — the `_stopOnArrival` intercept at path completion is the only branch that matters. The fix accounts for this correctly.

---

### Finding 2 — `rushing_bed4` → `at_bed4` transition

**Status: RESOLVED ✅ (with appropriate verification caveat)**

The updated plan commits to **Option A** (Ink-side transition) throughout:

```ink
=== rushing_bed4 ===
I'm going to him now — stay out of the way.
-> at_bed4

=== at_bed4 ===
I'm here with him. Something's very wrong. What's happening with your investigation?
-> END
```

The plan no longer leaves this implicit. §8b includes a clear verification note before implementation:

> "Verify before implementation: Confirm that the PersonChat minigame preserves Ink story state across separate conversation sessions (i.e., does it call `story.ContinueMaximally()` on re-open, or does it re-jump to `currentKnot` each time?). If it re-jumps to `currentKnot`, use a `setKnot` eventMapping action after the `rushing_bed4` conversation closes instead."

This is appropriate for a planning document. The mechanism is specified, the dependency is flagged, and a fallback is noted. Phase 2's implementation checklist (§14 step 5) includes this verification explicitly.

---

### Finding 3 — Mrs Kowalski (no Ink updates)

**Status: RESOLVED ✅**

The updated plan now has a full §5.3 ("Chair Patient Witness — Bed 2 Witness Arc") covering:

- Three new Ink knots: `stable_witness`, `sedated_witness`, `critical_witness` with appropriate content
- Two new eventMappings on `chair_patient` for `patient_bed2_state` value changes (`sedated`, `critical`)
- A verification note: "Verify the NPC id for Mrs Kowalski in scenario.json.erb (it may be `chair_patient` or `kowalski_npc`) before adding these eventMappings. Also confirm the name of her existing Ink file."

The knot names in the eventMappings (`sedated_witness`, `critical_witness`) match exactly the knot definitions in the Ink content. The `stable_witness` knot is the starting state — no eventMapping is needed for it since `currentKnot` is set at the start, not by an event. The Ink knot table in §13 does not list Mrs Kowalski's file by name (since it's unknown pending verification), which is correct.

---

### Finding 4 — `_originalPatrolConfig` uninitialized

**Status: RESOLVED ✅**

The `setNPCVisible()` implementation no longer references `behavior._originalPatrolConfig`. The updated code is:

```javascript
// No need to save/restore _originalPatrolConfig — the patrol config is
// already present in behavior.config.patrol (parsed at construction time).
if (visible && behavior.config.patrol.waypoints?.length > 0) {
    behavior.config.patrol.enabled = true;
}
```

This is the correct approach. The patrol config (waypoints, speed, mode) was parsed from the scenario JSON at construction time and is already present in `behavior.config.patrol`. The NPC was made hidden by disabling the patrol at construction — enabling it directly on reveal is correct and needs no saved state.

---

### Finding 5 — `_baseDwellTime` initialization

**Status: RESOLVED ✅**

The updated `dwellMultiplier` case now reads:

```javascript
wp._baseDwellTime = wp._baseDwellTime || wp.dwellTime || 0;
wp.dwellTime = Math.round(wp._baseDwellTime * value);
```

The base dwell is now stored on the first call and re-used on subsequent calls, preventing multiplier compounding. This matches the fix described in review1 exactly. Correct.

---

### Finding 6 — Sprite overlap at Bed 4

**Status: RESOLVED ✅**

The plan now consistently uses `targetTile: { "x": 7, "y": 5 }` (one tile west of the bed) in the `patrolOverride` eventMapping (§6.2). The `state_attended` Ink text is updated to match:

> "The Staff Nurse is standing at Mr Ahmed's bedside, attending to him. She gives you a brief, worried look."

This text correctly describes the nurse as present at the bedside without requiring both sprites to occupy the same tile.

§15 (Key Design Constraints) now includes a clear table explaining the distinction between the regular patrol waypoint at `{ x: 8, y: 5 }` (brief dwell, brief overlap acceptable) and the emergency `patrolOverride` target at `{ x: 7, y: 5 }` (permanent stop, overlap unacceptable). The rationale is sound.

---

### Finding 7 — `major_incident` trigger undefined

**Status: RESOLVED ✅**

The updated plan defines a concrete trigger mechanism in §9:

```json
{
    "eventPattern": "global_variable_changed:patient_bed4_state",
    "condition": "value === 'critical'",
    "onceOnly": true,
    "setGlobal": { "major_incident": true, "major_incident_declared_time": 0 }
}
```

This eventMapping would live on `bed4_patient` (or Sarah Mitchell). The plan acknowledges that this is a draft interpretation and recommends confirming against the game design docs before hardcoding. This is a sensible and workable trigger for the draft.

The `condition: "value === 'critical'"` is compatible with `safeEvaluateCondition()` (pattern: `value OP literal`), so it will evaluate correctly without any engine changes.

---

### Finding 8 — Pharmacist spawn position

**Status: RESOLVED ✅**

§7.3 now provides a concrete placeholder position:

```json
"position": { "x": 3, "y": 2 },
"_positionNote": "Placeholder — confirm against ward_7 tile map. Should be the ward entrance or medication room doorway.",
```

The rationale is clearly stated: the sprite is placed at this position hidden (`alpha=0`), so when `setNPCVisible()` is called, it simply becomes visible in place and no teleport is needed. The placeholder coordinates are marked for confirmation. This satisfies the review1 requirement.

Note: the `_positionNote` field raises a separate concern addressed in Section 2 below.

---

### Finding 9 — Tile-to-world conversion implementation

**Status: PARTIALLY RESOLVED ⚠️**

The plan now specifies a concrete implementation for the `patrolOverride` handler in `npc-manager.js`, and confirms that `behavior.roomId` exists at construction time. Cross-referencing with `npc-behavior.js` (lines 143–149) verifies this:

```javascript
const npcData = window.npcManager?.npcs?.get(npcId);
if (!npcData || !npcData.roomId) {
    this.roomId = 'unknown';
} else {
    this.roomId = npcData.roomId;
}
```

`behavior.roomId` is populated. The prerequisite is confirmed.

**However, the tile-to-world conversion formula in the plan contains a bug.** The plan uses:

```javascript
const worldX = (room.position.x * TILE_SIZE) + (tile.x * TILE_SIZE);
const worldY = (room.position.y * TILE_SIZE) + (tile.y * TILE_SIZE);
```

`room.position.x` is already in world pixel coordinates — not tile coordinates. This is confirmed by `validateWaypoints()` in `npc-behavior.js` (lines 324–338), which uses:

```javascript
const roomWorldX = roomData.position?.x ?? roomData.worldX ?? 0;
const worldX = roomWorldX + (wp.x * TILE_SIZE);
```

The plan multiplies `room.position.x` by `TILE_SIZE` a second time, which would produce a world coordinate approximately 32× too large. For example, if `ward_7` has `position.x = 640` (pixels) and `tile.x = 7`, the plan computes `(640 * 32) + (7 * 32) = 20704` instead of the correct `640 + (7 * 32) = 864`.

**The correct formula is:**

```javascript
const worldX = room.position.x + (tile.x * TILE_SIZE);
const worldY = room.position.y + (tile.y * TILE_SIZE);
```

This is a new regression introduced by the plan update (see Section 2, New Issue A for full details).

---

### Finding 10 — `safeEvaluateCondition` incompatibility with timer conditions

**Status: RESOLVED ✅**

The updated plan explicitly warns about the incompatibility in §10:

> "⚠️ Condition evaluator incompatibility: The existing `safeEvaluateCondition()` in `npc-manager.js` only handles patterns like `value OP literal` and `data.prop OP literal`. It does not support `globalVars.X`, negation (`!`), or compound expressions. The `condition` strings below (e.g., `"!globalVars.bed4_escalated"`) would fail silently using the current evaluator."

The plan then lists two remediation options (extend the parser or restructure conditions) and recommends **Option C** (NPC timed conversations) as the draft approach, which entirely avoids the incompatible condition syntax. The warning is clear and the recommendation avoids the problem correctly.

---

### Finding 11 — `female_blowse` placeholder not marked

**Status: PARTIALLY RESOLVED ⚠️**

The updated plan replaces `"spriteSheet": "female_blowse"` for Mr T. Ahmed with:

```json
"spriteSheet": "PLACEHOLDER_male_patient",
"_spriteNote": "No male clinical sprite exists yet. Replace with correct asset when commissioned. female_blowse is wrong for a named male character.",
```

The placeholder is now clearly flagged textually. However, JSON has no comment syntax — `_spriteNote` is a regular JSON field that the engine will encounter during NPC registration. The plan does not verify whether the engine's NPC parsing code ignores unrecognised fields gracefully (it likely does, since JavaScript object access on missing keys returns `undefined`), but this is not stated. If the scenario ERB is processed by a schema validator or the NPC config is passed to a strict constructor, the extra field could produce a warning or error.

The same concern applies to `_positionNote` on the pharmacist NPC definition.

This is flagged as a new issue in Section 2 (New Issue C), but the intent — making the placeholder status unambiguous — is correctly addressed.

---

### Finding 12 — `state_stable` contradictory Ink text

**Status: RESOLVED ✅**

The contradictory last sentence ("The infusion has finished — the rate needs to be re-entered.") has been removed from `state_stable`. The updated §5.2 knot reads:

```ink
=== state_stable ===
Ms Okafor is resting quietly. A morphine infusion runs via the pump on the pole beside her bed. The pump display shows the current rate.
-> END
```

This correctly describes the scenario start state — pump running normally, patient resting.

---

### Finding 13 — `initiallyHidden` pre-investigation not in Phase 3

**Status: RESOLVED ✅**

§14 Phase 3 now has an explicit step 0:

> "0. **Pre-step:** Read the NPC sprite creation pipeline to confirm what `initiallyHidden: true` currently does (skips creation vs creates hidden). Scope the phase accordingly before writing any code."

This is correctly added before any code changes are attempted. The scoping note in §4 Gap 2 is also preserved, explaining that the estimated ~45-line scope assumes the pipeline creates sprites with `alpha=0` — and that if it skips creation, the scope is larger.

---

### Finding 14 — Timer timing discrepancy (8 min vs 10 min)

**Status: RESOLVED ✅**

§10 of the updated plan now explicitly acknowledges:

> "**Timing discrepancy:** `new_objects_planning.md` states 'after approximately 10 in-game minutes' for the first deterioration. The walkthrough says 8 minutes. This plan uses 8 minutes (aligned to the walkthrough's more specific language). Confirm the correct value before hardcoding `delayMs`."

The discrepancy is named, the source documents are identified, and the design decision is documented (prefer the walkthrough's more specific language). This is the correct treatment.

---

### Summary Table

| # | Finding from review1 | Status |
|---|---|---|
| 1 | `_stopOnArrival` fires before NPC moves | ✅ Resolved |
| 2 | `rushing_bed4` → `at_bed4` transition unresolved | ✅ Resolved (Option A committed, verification noted) |
| 3 | Mrs Kowalski has no Ink updates | ✅ Resolved |
| 4 | `_originalPatrolConfig` uninitialized | ✅ Resolved |
| 5 | `_baseDwellTime` not set before multiplication | ✅ Resolved |
| 6 | Sprite overlap at Bed 4 | ✅ Resolved |
| 7 | `major_incident` trigger undefined | ✅ Resolved |
| 8 | Pharmacist spawn position missing | ✅ Resolved |
| 9 | Tile-to-world conversion unspecified | ⚠️ Partially resolved — specified but formula has a bug |
| 10 | `safeEvaluateCondition` incompatibility | ✅ Resolved |
| 11 | `female_blowse` not marked as placeholder | ⚠️ Partially resolved — intent correct, JSON pseudo-comment approach unverified |
| 12 | `state_stable` contradictory Ink text | ✅ Resolved |
| 13 | `initiallyHidden` pre-investigation not in Phase 3 | ✅ Resolved |
| 14 | 8 min vs 10 min discrepancy not acknowledged | ✅ Resolved |

---

## Section 2: New Issues Introduced by Plan Updates

### New Issue A — Tile-to-world conversion formula is wrong (regression) 🔴

**Severity: High — blocks Phase 2 implementation**

When the plan added the tile-to-world implementation detail for the `patrolOverride` handler (§4 Gap 1, "Tile-to-world conversion"), it introduced an incorrect formula:

```javascript
// Plan's formula (INCORRECT):
const worldX = (room.position.x * TILE_SIZE) + (tile.x * TILE_SIZE);
const worldY = (room.position.y * TILE_SIZE) + (tile.y * TILE_SIZE);
```

`room.position.x` and `room.position.y` are world pixel coordinates — not tile coordinates. Multiplying them by `TILE_SIZE` (32) again produces a value roughly 32× too large, placing the nurse far outside the room bounds.

The correct formula — matching exactly what `validateWaypoints()` in `npc-behavior.js` already uses (lines 324–339) — is:

```javascript
// Correct formula (matches validateWaypoints() pattern):
const worldX = room.position.x + (tile.x * TILE_SIZE);
const worldY = room.position.y + (tile.y * TILE_SIZE);
```

**Fix required before Phase 2 implementation.** If implemented as written, the nurse would pathfind to a world coordinate far outside the ward map and either freeze or produce a pathfinding error.

---

### New Issue B — `_setupEventMappings()` not updated for new action fields (implementation gap) 🔴

**Severity: High — new eventMapping actions will silently not fire**

The plan specifies handlers in `_handleEventMapping()` for the new action fields: `setVisible`, `patrolOverride`, `setPatrolSpeed`, and `setDwellMultiplier`. For example:

```javascript
// Plan's handler (§4, Gap 2):
if (mapping.setVisible !== undefined) {
    if (window.npcBehaviorManager) {
        window.npcBehaviorManager.setNPCVisible(npcId, mapping.setVisible);
    }
}
```

However, `_handleEventMapping()` receives a `config` object that is built in `_setupEventMappings()` (lines 393–412 of `npc-manager.js`). That object only captures a fixed set of known fields:

```javascript
const config = {
    knot: mapping.targetKnot || mapping.knot,
    bark: mapping.bark,
    once: mapping.onceOnly || mapping.once,
    // ... setGlobal, completeTask, unlockTask, unlockAim, emitEvent, background
    // setVisible, patrolOverride, setPatrolSpeed, setDwellMultiplier — NOT HERE
};
```

The new fields are not forwarded. When `_handleEventMapping` is called, `config.setVisible`, `config.patrolOverride`, etc. will all be `undefined`. The handlers will never fire.

There are also two naming issues in the plan's handler pseudo-code: the handler parameter is named `config` in the actual code, but the plan uses `mapping` — a variable that does not exist in that scope.

**Two fixes required before Phase 2 implementation:**

1. Add the new fields to the `config` object in `_setupEventMappings()`:

```javascript
const config = {
    // ... existing fields ...
    setVisible:         mapping.setVisible         ?? undefined,
    patrolOverride:     mapping.patrolOverride     || null,
    setPatrolSpeed:     mapping.setPatrolSpeed     ?? undefined,
    setDwellMultiplier: mapping.setDwellMultiplier ?? undefined,
};
```

2. In the handler code, reference `config.setVisible`, `config.patrolOverride`, etc. — not `mapping.*`.

---

### New Issue C — `_spriteNote` and `_positionNote` are unvalidated JSON pseudo-comments 🟡

**Severity: Low — risk of engine warnings or silent failures during NPC registration**

The plan introduces underscore-prefixed annotation fields in the scenario JSON:

- `_spriteNote` on `bed4_patient`
- `_positionNote` on `pharmacist_npc`

JSON has no comment syntax. These are regular JSON fields that the engine encounters during NPC loading and registration. The plan does not verify:

1. Whether the scenario ERB parser and NPC registration code ignore unrecognised fields gracefully (JavaScript property access on unknown keys returns `undefined`, so it likely works — but this should be confirmed).
2. Whether this is an established codebase convention (no prior uses of underscore-prefixed annotation fields were found in the scenario file).
3. Whether a schema validator or strict constructor call would reject or warn on these fields.

**Recommended mitigation:** Before adding these fields to the scenario JSON, verify that one unrecognised field (e.g., `"_test": "ok"`) on an existing NPC does not produce console warnings during game load. If the engine handles them silently, document `_key` as the codebase convention for development annotations. If not, use ERB comments or a dedicated `notes` array field instead.

This is a low-risk issue but should be verified before Phase 1 implementation completes.

---

## Section 3: Implementation Readiness Assessment

### Phase 1 — Scenario correctness (no engine changes)

**Ready for implementation. ✅**

All nine Phase 1 tasks are well-specified:

- `bed4_patient` and `bed2_patient` NPC definitions with Ink content
- `dwellTime` values for `patrol_nurse` waypoints
- Pharmacist eventMapping fix (remove self-referential `setGlobal`)
- All required Ink knots for bed patients, patrol nurse, Sarah, and Mrs Kowalski
- `major_incident` trigger eventMapping
- Mrs Kowalski eventMappings for `patient_bed2_state`

None of these changes depend on engine modifications. All eventMapping conditions use the `value === 'string'` or `value === true` patterns that `safeEvaluateCondition()` already supports. The scenario JSON additions are well-defined.

**Minor caveat:** Verify the `_spriteNote` / `_positionNote` JSON field behaviour before finalising (New Issue C above). If they cause any problem, use ERB comments or a `"notes"` field instead.

**Also verify before Phase 1 completes:** Confirm Mrs Kowalski's actual NPC id in `scenario.json.erb` (likely `chair_patient` or `kowalski_npc`) and the name of her existing Ink file, before adding the new knots and eventMappings.

### Phase 2 — Engine: interrupt patrol

**Not ready — two fixes required before starting. ⛔**

Before writing any Phase 2 code:

1. **Fix the tile-to-world formula** in the `patrolOverride` handler (New Issue A). The plan as written would compute the wrong world coordinates for the nurse's emergency destination.

2. **Update `_setupEventMappings()`** to forward `patrolOverride` (and other new action fields) into the `config` object (New Issue B). Without this, the event handler never sees the `patrolOverride` data.

Both fixes are small (a few lines each) but must be corrected in the plan before Phase 2 implementation begins — otherwise the Phase 2 code will be built on incorrect specifications.

### Phases 3–5

Not yet assessed — Phase 2 blockers should be resolved first. The Phase 3 pre-step (read sprite creation pipeline) and the Phase 2 verification step (PersonChat story state preservation) are correctly placed as prerequisites.

---

## Section 4: Specific Suggestions

| # | Category | Finding | Action Required |
|---|---|---|---|
| A | **Wrong — new regression** | Tile-to-world formula multiplies `room.position.x` by `TILE_SIZE` a second time | Change to `room.position.x + (tile.x * TILE_SIZE)` — matches `validateWaypoints()` pattern |
| B | **Wrong — implementation gap** | `_setupEventMappings()` does not forward `setVisible`, `patrolOverride`, `setPatrolSpeed`, `setDwellMultiplier` into `config`; handler references undefined variable `mapping` | Add the four new fields to the `config` object in `_setupEventMappings()`; rename `mapping.*` to `config.*` in handler pseudo-code |
| C | **Risk — unverified** | `_spriteNote` / `_positionNote` are non-standard JSON fields with no prior codebase usage | Test one unknown field on an existing NPC during load; confirm engine ignores it silently before using in Phase 1 |
| D | **Minor — readability** | §13 Ink file table does not include Mrs Kowalski's file (unknown at planning time) | Add a row: `npc_kowalski.ink (verify name)` with knots `stable_witness`, `sedated_witness`, `critical_witness` |
| E | **Minor — completeness** | The `_handleEventMapping` pseudo-code uses the variable name `mapping` throughout, but the actual parameter name is `config` | Rename to `config` in all handler snippets to match the actual function signature and avoid confusion during implementation |

---

## Overall Assessment

The plan has substantially improved since review1. Twelve of fourteen issues are fully resolved; the remaining two (Finding 9 tile-to-world, Finding 11 pseudo-comments) are partially addressed with the intent correct but execution needing a fix.

The three new issues are:
- **Issue A** (tile-to-world formula) is a concrete bug that will produce wrong behavior if implemented as written
- **Issue B** (`_setupEventMappings` gap) is a concrete implementation gap that will cause the new event actions to silently not fire
- **Issue C** (JSON pseudo-comments) is a low-risk verification item

**Phase 1 is ready to begin.** The scenario and Ink content changes are well-specified, correct, and do not depend on the engine fixes.

**Phase 2 requires two targeted plan corrections** (Issues A and B) before implementation starts. Both are small, well-scoped fixes. Once made, Phase 2 should be implementable without further revision.
