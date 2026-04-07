# Technical Review 3 — New NPC Behaviours Plan (sis01_healthcare)

**Reviewer:** Claude (AI pair-review)  
**Date:** April 2026  
**Plan reviewed:** `planning_notes/new_npc_behaviours/plan.md` (post-review2 update)  
**Prior reviews:** `review1/review.md`, `review2/review2.md`  
**Sources read for verification:** `npc-behavior.js`, `npc-manager.js`, `scenario.json.erb`, `README_scenario_design.md`

---

## Section 1: Status of Each Review2 Issue (A, B, C, D)

### Issue A — Tile-to-world formula (High)

**Status: RESOLVED ✅**

Review2 found that the plan multiplied `room.position.x` by `TILE_SIZE` a second time:

```javascript
// WRONG (prior plan):
const worldX = (room.position.x * TILE_SIZE) + (tile.x * TILE_SIZE);
```

The updated plan (§4, Gap 1, "Tile-to-world conversion") now reads:

```javascript
// CORRECT (current plan):
const worldX = room.position.x + (tile.x * TILE_SIZE);
const worldY = room.position.y + (tile.y * TILE_SIZE);
```

Cross-referencing with `validateWaypoints()` in `npc-behavior.js` (lines 325–339) confirms this is exactly the pattern used:

```javascript
const roomWorldX = roomData.position?.x ?? roomData.worldX ?? 0;
const roomWorldY = roomData.position?.y ?? roomData.worldY ?? 0;
// ...
const worldX = roomWorldX + (wp.x * TILE_SIZE);
const worldY = roomWorldY + (wp.y * TILE_SIZE);
```

The fix matches precisely. There are no other tile-to-world conversions elsewhere in the plan that need correction.

The inline comment in the plan also explicitly documents the reasoning:

> "room.position.x/y are already in world pixel coords — do NOT multiply by TILE_SIZE."

The fix is complete, correct, and clearly documented.

---

### Issue B — `_setupEventMappings()` not forwarding new action fields (High)

**Status: SUBSTANTIALLY RESOLVED ✅ — with one new structural concern (see Section 2, Issue 1)**

Review2 identified that `_handleEventMapping()` receives a `config` object constructed in `_setupEventMappings()`, and that the four new action fields (`setVisible`, `patrolOverride`, `setPatrolSpeed`, `setDwellMultiplier`) were not forwarded into that object. All handler pseudo-code also used `mapping.*` (a variable that does not exist in that scope) instead of `config.*`.

The updated plan addresses both aspects:

**New `_setupEventMappings()` section (§4, "Required: Update `_setupEventMappings()`"):**

```javascript
const config = {
    // ... all existing fields ...
    // NEW — add these four lines:
    setVisible:         mapping.setVisible         ?? undefined,
    patrolOverride:     mapping.patrolOverride      || null,
    setPatrolSpeed:     mapping.setPatrolSpeed      ?? undefined,
    setDwellMultiplier: mapping.setDwellMultiplier  ?? undefined,
};
```

This is correct. Verified against the actual `_setupEventMappings()` in `npc-manager.js` (lines 392–412): the existing `config` object contains `knot`, `bark`, `once`, `cooldown`, `condition`, `maxTriggers`, `conversationMode`, `changeStoryPath`, `sendTimedMessage`, `setGlobal`, `completeTask`, `unlockTask`, `unlockAim`, `emitEvent`, `emitEventData`, `disableClose`, and `background`. None of the four new fields are present. The plan's proposed additions are complete and would correctly forward all four.

**Handler variable renaming:** All handler snippets in the plan now correctly reference `config.*`:
- Gap 1 (patrolOverride): `if (config.patrolOverride && window.npcBehaviorManager)` ✅
- Gap 2 (setVisible): `if (config.setVisible !== undefined)` ✅
- Gap 3 (setPatrolSpeed): `if (config.setPatrolSpeed !== undefined && window.npcBehaviorManager)` ✅
- Gap 3 (setDwellMultiplier): `if (config.setDwellMultiplier !== undefined && window.npcBehaviorManager)` ✅

Verified against the actual `_handleEventMapping()` signature (line 434 of npc-manager.js): `_handleEventMapping(npcId, eventPattern, config, eventData)` — the parameter is indeed called `config`, confirming the renamed references are correct.

**One structural concern:** The `_setupEventMappings()` update is documented as a standalone "Critical implementation note" in §4, but is **not listed as an explicit step in any of the Phase 2, 3, or 4 implementation checklists**. This is a risk of omission during implementation — a developer working through Phase 2's step 3 ("Add `patrolOverride` action handler in npc-manager.js") could correctly write the handler without also updating `_setupEventMappings()`, causing the handler to silently never receive its data. This is flagged as new Issue 1 in Section 2.

---

### Issue C — `_spriteNote` and `_positionNote` non-standard JSON fields (Low)

**Status: RESOLVED ✅**

Review2 identified that the plan introduced underscore-prefixed pseudo-comment fields (`_spriteNote`, `_positionNote`) in scenario JSON snippets — regular JSON fields that would be encountered by the engine with no prior codebase convention for them.

The updated plan removes these fields and replaces all annotations with ERB comment syntax (`<%# ... %>`):

**§5.1 (bed4_patient):**
```
<%# PLACEHOLDER: spriteSheet "male_patient" does not exist yet. Replace when clinical sprite commissioned.
    female_blowse is wrong for a named male character. %>
"id": "bed4_patient",
...
"spriteSheet": "female_blowse",
<%# REMOVE spriteSheet placeholder above and replace with correct male patient sprite asset key %>
```

**§7.3 (pharmacist spawn position):**
```erb
<%# Pharmacist position { x: 3, y: 2 } is a placeholder.
    Confirm against ward_7 tile map — should be ward entrance or medication room doorway. %>
```

This is correct. The scenario file is a `.json.erb` template; ERB comments (`<%# ... %>`) produce no output after rendering and carry zero risk of engine field-handling issues. Verified against the live `scenario.json.erb`: it already uses this convention (e.g., lines 424–431 and 475 use ERB `<%# ... %>` comments extensively for TODOs and design notes).

**Convention note in §7.3:** The plan also codifies this as an explicit project convention:

> "Use ERB comments (`<%# note %>`) for development annotations rather than non-standard underscore-prefixed JSON fields. ERB comments are stripped before the JSON is parsed by the engine."

This is the correct and complete fix.

**Note on `spriteSheet` value:** The `spriteSheet` value for `bed4_patient` remains `"female_blowse"` in the plan (with the ERB comment marking it for replacement). This is pragmatically correct for a draft: `"female_blowse"` is a valid asset key that exists in the scenario (confirmed at line 501 of `scenario.json.erb` — the `chair_patient_witness` NPC uses the same sprite). It won't cause engine errors; it merely shows the wrong sprite until the male patient asset is commissioned. The placeholder is clearly annotated.

---

### Issue D — Mrs Kowalski missing from §13 Ink file table (Minor)

**Status: RESOLVED ✅**

Review2 noted that Mrs Kowalski's Ink file was absent from the §13 summary table despite having new knots specified in §5.3.

The updated §13 now includes:

```
| `npc_kowalski.ink` *(verify filename)* | `stable_witness`, `sedated_witness`, `critical_witness` | `patient_bed2_state` changes; `stable_witness` is starting knot |
```

The `stable_witness` knot is correctly noted as the starting knot (not triggered by an event) — consistent with §5.3, which specifies it only needs to be the initial `currentKnot` with no eventMapping needed. The knots listed in the table match the knot definitions in §5.3 exactly.

The `(verify filename)` caveat is appropriate. The actual Ink filename (discovered from reading the scenario file: `npc_chair_patient.json` at line 502 of `scenario.json.erb`) is neither `npc_kowalski.ink` nor any variant of the name guessed in the plan. See Section 2, Issue 3 for details.

---

## Section 2: New Issues Found

### Issue 1 — `_setupEventMappings()` update not referenced in Phase checklists (Medium)

**Severity: Medium — risk of silent implementation omission**

The `_setupEventMappings()` update (§4, "Required: Update `_setupEventMappings()`") is a **prerequisite for all new event-mapping handlers across Phases 2, 3, and 4**. Without it:
- Phase 2's `patrolOverride` handler will never see `config.patrolOverride`
- Phase 3's `setVisible` handler will never see `config.setVisible`
- Phase 4's `setPatrolSpeed` / `setDwellMultiplier` handlers will never see their values

None of the phase checklists (§14 Phases 2, 3, 4) list this as a step. The section exists and is clearly marked as critical in §4, but a developer working from the numbered checklist could implement handlers without it.

**Recommended fix:** Add an explicit step to Phase 2's checklist:

```
0. Update `_setupEventMappings()` in npc-manager.js to forward all four new action fields
   into the `config` object (see §4 "Required: Update `_setupEventMappings()`").
   This is a prerequisite for all handlers added in Phases 2, 3, and 4.
```

Or alternatively, move the `_setupEventMappings()` update note into Phase 2 step 3 as a prerequisite sentence. Either approach ties the documented fix to the implementation phases where it's needed.

---

### Issue 2 — `TILE_SIZE` not imported in `npc-manager.js` (Medium)

**Severity: Medium — Phase 2 implementation will fail without this**

The `patrolOverride` handler proposed for `_handleEventMapping()` (§4, Gap 1, "Tile-to-world conversion") uses `TILE_SIZE` as a variable:

```javascript
const worldX = room.position.x + (tile.x * TILE_SIZE);
const worldY = room.position.y + (tile.y * TILE_SIZE);
```

However, `npc-manager.js` does not import `TILE_SIZE`. A search of the file confirms it has only one import:

```javascript
import { isInLineOfSight, drawLOSCone, clearLOSCone, getNPCFacingDirection } from './npc-los.js';
```

`TILE_SIZE` is defined in `public/break_escape/js/utils/constants.js` as `export const TILE_SIZE = 32;`. It is imported in `npc-behavior.js` as:

```javascript
import { TILE_SIZE } from '../utils/constants.js?v=8';
```

Without the import, the `patrolOverride` handler would throw a `ReferenceError: TILE_SIZE is not defined` at runtime — the nurse would not pathfind and the error would surface only when the event fires.

**Fix required before Phase 2 implementation:** Add the import to `npc-manager.js`:

```javascript
import { TILE_SIZE } from '../utils/constants.js?v=8';
```

This is a one-line addition but is a concrete runtime blocker for the Phase 2 handler.

---

### Issue 3 — Mrs Kowalski's actual NPC id and Ink filename are now verifiable (Low)

**Severity: Low — the plan has a verification note; this is a resolved uncertainty**

Review2 and the plan both note: "Verify the NPC id for Mrs Kowalski in `scenario.json.erb` (it may be `chair_patient` or `kowalski_npc`)."

Reading `scenario.json.erb` directly resolves this:

- **Actual NPC id:** `"chair_patient_witness"` (line 497) — neither guess in the plan is correct
- **Actual Ink file:** `"storyPath": "scenarios/sis01_healthcare/ink/npc_chair_patient.json"` (line 502) — not `npc_kowalski.ink`

The plan's §5.3 uses `chair_patient` in its prose when describing where to add eventMappings ("Add to `chair_patient` (Mrs Kowalski) `eventMappings`"). The correct id is `chair_patient_witness`. The §13 table entry guesses `npc_kowalski.ink`. These are the right places to update when working from the plan, and the verification caveat is present — so this is a low-risk note, not a blocking issue.

**Recommended update:** The verification note in §5.3 can now be resolved rather than deferred: update the NPC id reference to `chair_patient_witness` and the Ink file reference to `npc_chair_patient.ink` (the compiled JSON lives at `npc_chair_patient.json`; the source `.ink` file should follow the same stem). This removes the ambiguity before Phase 1 implementation.

---

### Issue 4 — Phase 1 checklist does not mention setting `currentKnot` for Mrs Kowalski (Minor)

**Severity: Minor — functional gap if omitted**

§5.3 specifies `stable_witness` as the starting knot for Mrs Kowalski: "Neutral observation of ward." The plan says no eventMapping is needed for `stable_witness` — it is the initial state. But the plan does not mention updating the `chair_patient_witness` NPC's `"currentKnot"` field in `scenario.json.erb` to `"stable_witness"`.

Without this update, the player would approach Mrs Kowalski and the Ink story would open at whatever her current starting knot is (or the start of the file). If the existing Ink file has no `stable_witness` knot yet, this would produce a knot-not-found error or fall through to the first knot. After Phase 1 adds the new knots to the Ink file, the `currentKnot` should be set explicitly.

**Phase 1 step 8 should read:**
> "Add `stable_witness` / `sedated_witness` / `critical_witness` knots to Mrs Kowalski Ink file; add eventMappings for `patient_bed2_state`; **update `currentKnot: "stable_witness"` on the `chair_patient_witness` NPC definition in `scenario.json.erb`**."

---

## Section 3: Implementation Readiness Assessment

### Phase 1 — Scenario correctness (no engine changes)

**Ready for implementation, with one NPC id to verify. ✅**

All nine Phase 1 tasks are well-specified. The scenario and Ink content changes are correct and do not depend on any engine modifications. All eventMapping conditions use `value === 'string'` or `value === true` patterns that `safeEvaluateCondition()` already supports.

**Before starting Phase 1:**
- Confirm Mrs Kowalski's NPC id is `chair_patient_witness` (now confirmed) and Ink file is `npc_chair_patient.ink`, and update the relevant references in the plan/implementation
- Add `currentKnot: "stable_witness"` to the Phase 1 step for Mrs Kowalski (Issue 4 above)

Neither of these is a blocker — they're a five-minute scan of the scenario file before implementing step 8.

### Phase 2 — Engine: interrupt patrol

**Nearly ready — two targeted additions required first. ⚠️**

The main Phase 2 issues from review2 (tile-to-world formula, `_setupEventMappings()` update, `mapping.*` → `config.*` rename) are all addressed in the plan. The code structure is sound and the placement of `_stopOnArrival` in the path-completion handler is correct.

**Before beginning Phase 2:**

1. **Add `import { TILE_SIZE } from '../utils/constants.js?v=8';` to `npc-manager.js`** (Issue 2). Without this, the `patrolOverride` handler throws a runtime error.

2. **Add `_setupEventMappings()` update to Phase 2's step 3** (Issue 1). Make it explicit in the checklist so the implementation proceeds in the correct order: first update `_setupEventMappings()`, then add the handler in `_handleEventMapping()`.

Both fixes are very small (a line or two in the plan and in the eventual implementation). Once made, Phase 2 is fully specified.

Also confirm before Phase 2:
- `behavior.roomId` is populated at NPCBehavior construction time — **confirmed** from npc-behavior.js lines 143–149. The prerequisite note in §4 Gap 1 is verified correct.

### Phase 3 — Engine: NPC visibility

**Pre-step still required; otherwise well-specified. ✅**

Phase 3 step 0 (read NPC sprite creation pipeline to confirm what `initiallyHidden: true` currently does) is correctly placed. The `setNPCVisible()` implementation is clean (no `_originalPatrolConfig` issue — resolved in review2). Once the pre-step confirms Option A applies, the phase is implementable as written.

The `_setupEventMappings()` update for `setVisible` is the same table-entry addition already required for Phase 2 — adding all four fields at once in Phase 2 step 0 means Phase 3 inherits it for free.

### Phase 4 — Engine: patrol speed control

**Well-specified. ✅**

The `setState('patrolSpeed', n)` and `setState('dwellMultiplier', n)` additions to `NPCBehavior` are correctly structured. The `_baseDwellTime` initialization fix (from review1) is in place. The `_setupEventMappings()` update covers `setPatrolSpeed` and `setDwellMultiplier` — again, already covered if added in Phase 2.

### Phase 5 — Timer system

**Deferred correctly. ✅**

Option C (NPC timed conversations using the existing `timedConversations` infrastructure with `skipIfGlobal` and `setGlobalOnStart`) remains the correct draft choice. The `safeEvaluateCondition()` incompatibility with Option B's proposed timer conditions is documented. No change needed here.

---

## Section 4: Specific Suggestions

| # | Severity | Category | Finding | Action |
|---|---|---|---|---|
| 1 | **Medium** | Missing implementation step | Phase 2/3/4 checklists don't reference the `_setupEventMappings()` update | Add as Phase 2 step 0: "Update `_setupEventMappings()` to forward all four new action fields into `config`." Note it as a prerequisite for Phase 3 and 4 handlers. |
| 2 | **Medium** | Concrete implementation blocker | `TILE_SIZE` is not imported in `npc-manager.js`; the `patrolOverride` handler uses it | Add `import { TILE_SIZE } from '../utils/constants.js?v=8';` to the plan's Phase 2 description for `npc-manager.js` changes |
| 3 | **Low** | Resolvable ambiguity | Mrs Kowalski's NPC id is `chair_patient_witness` (not `chair_patient` or `kowalski_npc`); Ink file is `npc_chair_patient.json` | Update §5.3 prose and §13 table entry to use the confirmed id and filename |
| 4 | **Minor** | Phase 1 step gap | Phase 1 step 8 doesn't mention updating `currentKnot: "stable_witness"` on the `chair_patient_witness` NPC definition | Add this to Phase 1 step 8 |

---

## Overall Assessment

The plan has substantially improved across all three review iterations. The four issues raised in review2 are all addressed — Issues A, C, and D are fully and correctly resolved; Issue B is resolved at the specification level (correct fields, correct variable names, correct structure), with one structural caveat about the phase checklists.

**Two new items are genuine implementation blockers if not addressed before Phase 2 begins:**

1. The `TILE_SIZE` import missing from `npc-manager.js` will cause a runtime `ReferenceError` the first time the `patrolOverride` event fires.
2. The `_setupEventMappings()` update step, while documented in §4, is not in the Phase 2 checklist and could be missed — causing all new event-mapping handlers to silently never receive their action data.

Both fixes are small (a line in npc-manager.js, a sentence in the Phase 2 checklist) and do not require rethinking any architecture. Once made, **Phase 1 is ready to begin without further plan revisions**, and **Phase 2 will be fully specified**.

The remaining items (Kowalski NPC id, `currentKnot` for Phase 1 step 8) are low-severity clarifications that can be addressed as part of normal implementation prep.
