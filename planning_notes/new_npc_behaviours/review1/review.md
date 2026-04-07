# Technical Review — New NPC Behaviours Plan (sis01_healthcare)

**Reviewer:** Claude Sonnet (AI pair-review)  
**Date:** April 2026  
**Plan reviewed:** `planning_notes/new_npc_behaviours/plan.md`  
**Sources read:** `npc-behavior.js`, `npc-manager.js`, `scenario.json.erb`, `README_scenario_design.md`, `be_scenario_walkthrough.md`, `new_objects_planning.md`

---

## 1. Accuracy of Gap Analysis

The plan's gap table (§3) is largely correct but contains one significant error and several things it correctly identifies.

### Correct

- **`dwellTime` exists:** `npc-behavior.js` confirms it — `validateWaypoints()` stores `dwellTime: wp.dwellTime || 0` and `updatePatrol()` handles the `patrolReachedTime` logic. The plan correctly states this works and just needs values added to the scenario config.
- **`checkAndHandleHomePush()` skips patrol NPCs:** Confirmed. Line 1501 of `npc-behavior.js`: `if (this.config.patrol.enabled && !this.returningHome) { return false; }`. Patrol nurse is correctly unaffected by home-push logic.
- **`setState()` has no `patrolSpeed` case:** Confirmed. The existing cases are `hostile`, `influence`, `patrol` (toggle), and `personalSpaceDistance`. No speed or dwell mutators exist.
- **Pharmacist self-referential eventMapping:** Confirmed as a no-op. The scenario sets `pharmacist_on_ward: false` in `globalVariables`; the pharmacist listens for `pharmacist_on_ward` to become true, then sets it to true again. Nothing would ever set it in the first place from an external trigger.
- **No mechanism for NPC reveal via event:** Confirmed. Nothing in `npc-manager.js` handles a `setVisible` action type.

### Incorrect or Unconfirmed

**The plan (§4, Gap 2) claims `initiallyHidden: true` "prevents the sprite from being created."** The NPC behavior source files don't show this being processed in `NPCBehavior` or `NPCBehaviorManager`. Neither does `npc-manager.js`. The README confirms `initiallyHidden: true` hides the NPC, but how the sprite creation pipeline implements this is not visible from the reviewed files. The plan proposes Option A (create sprite with `alpha=0`, body disabled) as the recommended approach, but frames this as a change from a "not creating" state — implying the current code skips sprite creation entirely. If that's actually true, Option A requires changes to the sprite creation pipeline (not visible here), not just the behavior manager. **This assumption needs to be verified in the sprite creation code before implementation begins.** If the pipeline currently skips creation, `setNPCVisible()` has nothing to operate on.

---

## 2. Completeness

### Gaps the Plan Addresses Well

The plan covers the four main gaps (interrupt-to-target patrol, NPC reveal, patrol speed control, bed patient state display) with adequate depth. The tier approach for Gap 4 (Ink-only for draft, sprite variants later) is appropriate given asset availability.

### Things the Plan Misses or Under-Specifies

**A. Mrs Kowalski has no planned Ink updates.** The plan notes (§2.1) that "The chair patient witness (Mrs Kowalski) is already in the scenario at x:7, y:4." The walkthrough explicitly calls her out as the "witness NPC" whose purpose is to draw attention to Bed 2 when `patient_bed2_state` deteriorates. The new_objects_planning.md rates her "Medium" priority with witness lines as the most important use. The plan has no eventMappings and no new Ink knots planned for this NPC. She is in the scenario but would be static and silent regardless of Bed 2's state — defeating her design purpose.

**B. Transition from `rushing_bed4` to `at_bed4` knot is unresolved.** The plan proposes two Ink knots for the patrol nurse: `rushing_bed4` (fires on the event) and `at_bed4` (player approaches after arrival). But there is no mechanism to transition between them. The eventMapping sets `npc.currentKnot = "rushing_bed4"` (via `targetKnot`), and the conversation opens at that knot. After the conversation closes, `currentKnot` is still `rushing_bed4`. Subsequent player approaches would repeat the rushing line indefinitely. The plan's §13 Ink file table lists `at_bed4` as a required knot but doesn't say what triggers the switch. This is a genuine content gap.

**C. Pharmacist starting position is not defined.** The README states: "Omit `position` only if `behavior.initiallyHidden: true`." If the pharmacist has no position, the engine either places it at (0,0) or skips placement. When revealed, `setNPCVisible()` would make visible a sprite at the wrong location. The plan needs to specify either (a) a concrete spawn position for the pharmacist, or (b) that the reveal mechanism also teleports the NPC to its intended patrol starting position.

**D. Timer condition evaluator is incompatible with the proposed timer format.** Section 10 proposes timer conditions like `"!globalVars.bed4_escalated"`. The `safeEvaluateCondition()` function in `npc-manager.js` is a hand-rolled parser that handles only: `value OP literal`, `data.prop OP literal`, and `data.prop && data.prop.includes(...)`. It does not handle `globalVars.X`, negation (`!`), or compound expressions. The proposed timer conditions would fail silently (return `false`) using the existing evaluator. Option B (scenario-level timers) requires either a new condition evaluator or conditions restructured to match the parser's supported patterns.

**E. Timing inconsistency between plan and game design docs.** Section 10 of the plan states: "At 8 in-game minutes without escalation: `patient_bed4_state → distressed`." The `new_objects_planning.md` (Patient Types section) states "After approximately 10 in-game minutes." The walkthrough says "At 8 minutes." These are minor but should be reconciled before hardcoding timer values — the plan picks 8 minutes (aligned to the walkthrough) but doesn't acknowledge the discrepancy.

**F. `major_incident` trigger is undefined.** The plan adds `major_incident: false` to globalVariables but never says what sets it to `true`. The new_objects_planning.md says it fires when a major incident is declared, but no specific game interaction, NPC dialogue branch, or object triggers this. The eventMappings for both nurses on `major_incident = true` would never fire in the current draft.

---

## 3. Technical Feasibility

### Gap 1: `goToAndStay()` — Critical Bug in Proposed Implementation

The proposed `chooseNewPatrolTarget()` modification adds an `_stopOnArrival` check at the top of the method:

```javascript
if (this._stopOnArrival) {
    this.config.patrol.enabled = false;
    this._stopOnArrival = false;
    // ...
    return;
}
```

**This will not work.** `chooseNewPatrolTarget()` is called from `updatePatrol()` in two places: (1) when `patrolTarget` is null or the path is empty (i.e., when the NPC is just starting to move), and (2) after the NPC reaches the end of its current path. Because `goToAndStay()` sets `this.patrolTarget = null` and `this.currentPath = []` before enabling patrol, the very first call to `chooseNewPatrolTarget()` in the next frame will see `_stopOnArrival = true` and immediately halt — before the NPC has taken a single step toward the target.

**The fix:** Move the stop logic out of `chooseNewPatrolTarget()` and into the path-completion handler inside `updatePatrol()`. When `pathIndex >= currentPath.length`, instead of calling `chooseNewPatrolTarget(time)` unconditionally, check `_stopOnArrival` first:

```javascript
if (this.pathIndex >= this.currentPath.length) {
    if (this._stopOnArrival) {
        this._stopOnArrival = false;
        this.config.patrol.enabled = false;
        if (this._tempSpeed !== undefined) {
            this.config.patrol.speed = this._tempSpeed;
            this._tempSpeed = undefined;
        }
        this.sprite.body.setVelocity(0, 0);
        this.isMoving = false;
        return;
    }
    this.patrolReachedTime = time;
    this.chooseNewPatrolTarget(time);
    return;
}
```

This ensures the NPC walks to the target and stops on arrival, not before departure.

### Gap 1: `patrolOverride` Tile-to-World Conversion

The eventMapping in §6.2 uses `"targetTile": { "x": 8, "y": 5 }`. The npc-manager handler is described as resolving this to world coordinates "using the NPC's current room data." This conversion is non-trivial: it requires looking up `window.rooms[npcData.roomId]`, reading `position.x` and `position.y`, then computing `worldX = roomWorldX + (tileX * TILE_SIZE)`. The plan mentions this is done but doesn't give the implementation. This is fine to defer, but it's a meaningful piece of code that should be specified — particularly because the nurse is always in `ward_7` (no multi-room route), so the room lookup is straightforward here.

### Gap 2: NPC Visibility — `_originalPatrolConfig` Is Uninitialized

The `setNPCVisible()` proposal references `behavior._originalPatrolConfig` to restore patrol when revealing an NPC. This property is never set anywhere in the existing code or in the plan's proposed additions. Either the initial behavior registration needs to save the patrol config before disabling it for hidden NPCs, or `setNPCVisible()` needs to use a different mechanism (e.g., simply call `behavior.config.patrol.enabled = true` since the patrol config is already present in the originally-parsed behavior config). The latter is simpler and requires no saved state.

### Gap 3: `dwellMultiplier` Uses Uninitialized `_baseDwellTime`

The proposed `setState('dwellMultiplier', value)` case references `wp._baseDwellTime`:

```javascript
wp.dwellTime = Math.round((wp._baseDwellTime || wp.dwellTime || 0) * value);
```

This is correct on the first call (falls back to `wp.dwellTime`). But it doesn't set `wp._baseDwellTime` after using it, so on a second call with a different multiplier, the base is lost and the multiplier compounds incorrectly. For example: base dwell=8000, first call with 0.3 → dwellTime=2400; second call with 0.5 → computes `2400 * 0.5 = 1200` instead of `8000 * 0.5 = 4000`. Add `wp._baseDwellTime = wp._baseDwellTime || wp.dwellTime || 0;` before the multiplication.

### Gap 4: Tier 1 Approach Is Correct and Sufficient for Draft

The Ink-only state changes are well within engine capability and are the right call for the draft. No issues.

---

## 4. Scenario JSON Correctness

### Wrong Sprite for Mr T. Ahmed

The plan specifies `"spriteSheet": "female_blowse"` for `bed4_patient` (Mr T. Ahmed, male). This is presumably a placeholder due to missing clinical NPC sprites. It must be marked clearly as a placeholder in the scenario JSON — the validator may flag it if the sprite file doesn't exist, and player-facing testing would see a female sprite for a named male character.

### Missing `spriteTalk` on Bed Patient NPCs

Both bed patient NPCs lack `spriteTalk` (headshot image for the dialogue box). Without it, the dialogue UI will show no avatar. The README lists it as recommended but not required, and no headshot asset exists for these characters. Mark as a known gap — the placeholder could use any available clinical headshot.

### Bed 2 `state_stable` Ink Text Is Factually Wrong

Section 5.2 proposes this text for `state_stable`:

> "Ms Okafor is resting quietly. A morphine infusion runs via the pump on the pole beside her bed. The pump display shows the current rate. **The infusion has finished — the rate needs to be re-entered.**"

The final sentence contradicts the first. `state_stable` represents the scenario's starting state, when the walkthrough explicitly says the pump is running normally. The "infusion has finished" detail is priming for the minigame interaction, not a description of the stable state. Remove the last sentence from `state_stable`.

### `onceOnly: true` on eventMappings with String State Values

The bed patient eventMappings use `onceOnly: true` for each state transition. This is correct for the Bed 4 linear progression (resting → distressed → critical → attended). It would fail silently if states were ever revisited, but given the scenario design, they won't be. One note: a default 5-second cooldown is applied by `_handleEventMapping` even for `onceOnly` events (the cooldown check runs before the once-only check). This is harmless because `onceOnly` prevents repeat fires regardless, but it's worth knowing the cooldown is there.

### Pharmacist eventMapping in Helen Carver's Room — Cross-NPC Responsibility

Section 7.2 proposes adding an eventMapping to Helen Carver (in `major_incident_room`) that sets `pharmacist_on_ward: true`. This is correct design. However, this eventMapping fires on `drug_library_compromised = true`. Looking at the scenario's globalVariables, `drug_library_compromised` is already defined. Verify that Helen Carver currently has a `drug_library_compromised` eventMapping, and that the proposed `post_drug_tamper` knot is not already defined (or conflicts with) existing Ink story structure in `npc_helen.ink`.

### `background: "assets/backgrounds/hq1.png"` for a Ward Event

The `rushing_bed4` eventMapping uses the `hq1.png` background, which appears to be a generic HQ/office backdrop used for other conversations in the scenario. A ward-bay or clinical setting background would be more contextually appropriate, though this is a low-priority polish item for the draft.

---

## 5. Ink Story Correctness

### `rushing_bed4` → `at_bed4` Transition Is Unresolved

The plan sets `targetKnot: "rushing_bed4"` in the eventMapping. `npc-manager.js` processes this as: (1) set `npc.currentKnot = "rushing_bed4"`, then (2) open a person-chat starting at `rushing_bed4`. After the conversation closes, `npc.currentKnot` remains `rushing_bed4`. The next time the player approaches the nurse, the same rushing line plays again.

The correct behaviour requires `npc.currentKnot` to become `at_bed4` after the initial dialogue completes. Two options:

- **Option A (Ink-side):** End the `rushing_bed4` knot with `-> at_bed4` instead of `-> END`, so the story advances internally. This works only if the PersonChat minigame preserves story state across sessions — verify this.
- **Option B (Engine-side):** Add a `persistentKnot` field to the eventMapping that sets `npc.currentKnot` after the conversation ends, separately from the `startKnot` used to open the conversation.

Option A is simpler and requires no engine change. The plan should commit to one approach rather than leaving this implicit.

### Knot Naming Conventions Are Inconsistent

The plan uses both `state_resting_unmonitored` (with `state_` prefix) and `rushing_bed4` / `at_bed4` (without prefix) for the patrol nurse. This is fine — they're different NPCs — but be consistent within each NPC's Ink file. The bed patient files use `state_X` throughout; the patrol nurse files use bare names. Keep this separation clean.

### `state_attended` Text Implies Nurse Is an NPC

The `state_attended` knot for `npc_bed4_patient.ink` reads: "The Staff Nurse is at Bed 4 now, attending to Mr Ahmed. She gives you a brief, worried look." This references the nurse as a third party, which is correct — the player is observing the patient, not the nurse. But note that visually, the patrol nurse NPC sprite would be standing at the same tile as the bed patient NPC. If the engine places both sprites at `{ x: 8, y: 5 }`, they will overlap. The patrol nurse arrives via `goToAndStay()` with `targetTile: { x: 8, y: 5 }` — exactly the bed patient's position. This will cause sprite overlap. The nurse should stop at an adjacent tile (e.g., `{ x: 7, y: 5 }` or `{ x: 8, y: 4 }`). The `state_attended` knot text would need minor adjustment.

---

## 6. Priority and Ordering

The five-phase implementation order is sensible. Phase 1 (scenario-only changes, no engine work) is correctly first, and the phases escalate cleanly in complexity. A few ordering notes:

**The `_stopOnArrival` bug must be fixed before Phase 2 begins.** The proposed implementation would produce an NPC that freezes in place rather than rushing to Bed 4. This is a show-stopper for Phase 2.

**Phase 3 (NPC visibility) depends on confirming what `initiallyHidden: true` does in the sprite creation pipeline.** If the pipeline currently skips creation entirely, Phase 3 is larger than the ~45-line estimate (it requires changes to the sprite creation code, not just the behavior manager). Recommend adding a preliminary step: read the NPC sprite creation code and confirm the behaviour before beginning Phase 3.

**The `at_bed4` knot transition (Ink-side or engine-side) is a dependency of Phase 2**, not Phase 5. Once the nurse physically arrives at Bed 4 (Phase 2 complete), the wrong knot will be active for subsequent interactions. This should be resolved as part of Phase 2.

**Option C for timers (NPC timed conversations) is the correct draft choice.** The `timedConversations` system in npc-manager.js already supports `waitForEvent`, `skipIfGlobal`, and `delay`. This can be used to simulate the bed4 deterioration timer without any engine changes. Document which NPC drives the timer (Sarah is the right choice, since she has awareness of Bed 4's state) and what Ink tags or global sets it uses.

---

## 7. Risks and Open Questions

**Risk (High): `_stopOnArrival` bug.** Covered above. The NPC stops before moving. This will be immediately apparent in testing but should be caught in code review first.

**Risk (Medium): `initiallyHidden` sprite creation behaviour.** If the sprite creation pipeline doesn't create a sprite at all for hidden NPCs, Option A's alpha/body approach doesn't apply. The implementation path for Phase 3 could be significantly different. Investigate before committing to Option A.

**Risk (Medium): Sprite overlap at Bed 4.** Patrol nurse arrives at `{ x: 8, y: 5 }` — the same tile as `bed4_patient`. Both NPCs will be rendered at the same world position. The depth sorting (Y-based) won't resolve this visually. The nurse's `patrolOverride.targetTile` should target an adjacent tile.

**Risk (Low): `setNPCVisible()` patrol restart logic.** The reference to `behavior._originalPatrolConfig` is uninitialized. On reveal, patrol would not automatically start unless this is addressed.

**Open question: What sets `major_incident = true`?** The plan adds the global and eventMappings that react to it, but nothing in the current scenario draft sets it. This is blocking the entire Phase 4 implementation and should be designed now even if not implemented yet.

**Open question: What is Mrs Kowalski's planned Ink update for `patient_bed2_state`?** She's the primary witness for the Bed 2 deterioration arc. Without new Ink knots and eventMappings, she contributes nothing to Phase 2's teaching moment.

**Open question: Pharmacist position on spawn.** The scenario should specify where the pharmacist NPC appears when revealed, and what their patrol route covers. This is not defined in the plan.

---

## 8. Specific Suggestions

| # | Category | Finding | Action |
|---|----------|---------|--------|
| 1 | **Wrong — bugs code** | `_stopOnArrival` fires before NPC moves | Move stop logic to path-completion handler in `updatePatrol()`, not to top of `chooseNewPatrolTarget()` |
| 2 | **Wrong — scenario** | `state_stable` Ink for Bed 2 says infusion has finished | Remove the contradictory last sentence; pump is running normally at scenario start |
| 3 | **Wrong — scenario** | `female_blowse` sprite for male patient Mr T. Ahmed | Explicitly mark as placeholder in JSON; use available male sprite if one exists |
| 4 | **Incomplete** | `at_bed4` knot has no transition mechanism | End `rushing_bed4` Ink with `-> at_bed4` instead of `-> END` (simplest fix; verify PersonChat preserves story position across sessions) |
| 5 | **Incomplete** | Mrs Kowalski has no planned Ink updates | Add two new knots (`stable_witness`, `sedated_witness`) and eventMappings for `patient_bed2_state` changes |
| 6 | **Incomplete** | `_originalPatrolConfig` uninitialized in `setNPCVisible()` | Replace with `behavior.config.patrol.enabled = true` — the patrol config is already present; no save/restore needed |
| 7 | **Incomplete** | `_baseDwellTime` never set before multiplication | Initialize `wp._baseDwellTime = wp._baseDwellTime || wp.dwellTime || 0` before applying multiplier |
| 8 | **Risk** | Sprite overlap at Bed 4 (nurse + patient same tile) | Set `patrolOverride.targetTile` to `{ x: 7, y: 5 }` or `{ x: 8, y: 4 }` |
| 9 | **Unverified assumption** | `initiallyHidden` may skip sprite creation entirely | Read sprite creation pipeline before beginning Phase 3 |
| 10 | **Under-specified** | Timer condition `!globalVars.bed4_escalated` incompatible with `safeEvaluateCondition` | For Option C (recommended draft approach), this is irrelevant; for Option B, extend the parser or restructure conditions |
| 11 | **Under-specified** | `major_incident = true` has no trigger | Define the game action that sets this before designing the nurse speed eventMappings |
| 12 | **Under-specified** | Pharmacist spawn position undefined | Add a concrete `position` to the pharmacist NPC definition even if hidden; use it as the revealed spawn point |

---

## Summary Assessment

The plan is well-structured and the gap analysis is mostly correct. The largest problems are:

1. **A code-level bug in the proposed `_stopOnArrival` implementation** that would prevent the nurse from moving at all — this needs to be caught before Phase 2 implementation begins.
2. **The `at_bed4` transition is unresolved** — a gap in the Ink/engine contract that will produce incorrect dialogue after the nurse arrives.
3. **Mrs Kowalski is unaddressed** — she's in the scenario specifically to surface the Bed 2 consequence, but has no planned updates.

Everything else is either correct and sound, or is a reasonable under-specification for a planning document at this stage. Fix the three items above before beginning implementation; the rest can be addressed during the implementation phases.
