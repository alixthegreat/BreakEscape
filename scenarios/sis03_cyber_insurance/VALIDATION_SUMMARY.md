# Cyber Insurance Scenario Validation Summary

**Status**: ✅ PASSING (Validated 2026-04-24)

## Validation Results

- ✅ Schema validation passed — zero errors
- ✅ ERB rendering successful
- ✅ All global variables defined
- ✅ All ink files compile and are valid
- ✅ Objective task wiring confirmed for all 15 tasks
- ✅ No unknown fields
- ✅ No missing recommended fields
- ✅ Dungeon graph generated (19 nodes, 15 edges — integrated)
- ⚠️ One expected AND-gate warning: `policy_binder` and `fdp_terminal` both unlock `meridian_evidence_archive` — this is intentional (AND-gate: both policy review AND forensic chain required). `puzzle_graph_and_with` annotations are set on both items.

## Graph Summary

```
Puzzle     — Nodes: 12  Edges: 13
Story      — Nodes: 7   Edges: 1
Integrated — Nodes: 19  Edges: 15
Critical path (1 hop): Open the Albion Claim → Confirm Coverage and Trace the Forensic Chain
```

## Scenario Structure

**Rooms**:
- `meridian_claims_suite` — Main claims assessment room (start)
- `meridian_evidence_archive` — PIN-locked secure filing area

**Objects** (12 total):
- 9 readable documents: policy binder, incident notification, loss adjustment report, coverage decision form, IT forensics exhibit, OT forensics exhibit, warranty compliance evidence, NCSC attribution brief, underwriting file
- 1 CMS terminal (claims management system minigame — 5 sections)
- 1 FDP terminal (forensic data platform — sets `forensic_chain_verified`)
- 1 PIN-locked underwriting cabinet (PIN from CMS policy section)

**NPCs** (4 total, all in `meridian_claims_suite`):
- `eleanor_vance` — Person NPC, Claims Manager; opening timedConversation, 20+ eventMappings
- `james_whitworth` — Phone NPC, Albion Risk Manager; timedMessages + eventMappings
- `david_osei` — Phone NPC, Fairbridge Loss Adjuster; timedMessages + eventMappings
- `robert_ngata` — Phone NPC, NCSC Liaison; timedMessages + eventMappings

**Objectives** (7):
1. `initial_briefing` — Open the Albion Claim (active)
2. `investigate_claim` — Confirm Coverage and Trace the Forensic Chain (locked)
3. `access_evidence_archive` — Access the Evidence Archive (locked)
4. `assess_warranties` — Assess Warranty Compliance (locked)
5. `make_recommendation` — Review and Make Coverage Recommendation (locked)
6. `trent_water_assessment` — Assess Trent Water Exposure (optional, locked)
7. `closing_debrief` — Closing Debrief — Insurance as Safety Governance (locked)

## Task Completion Wiring

All 15 tasks have in-world completion triggers:
- `npc_conversation` tasks: wired via `#complete_task` tags in ink files
- `enter_room` tasks: auto-completed by engine on room entry
- `manual` tasks: wired via Eleanor Vance `eventMappings` on global variable changes

| Task | Trigger |
|------|---------|
| `talk_to_eleanor_initial` | `#complete_task` in `npc_eleanor_vance.ink` |
| `read_policy_binder` | `policy_reviewed = true` → Eleanor eventMapping |
| `read_claim_file` | `claim_file_reviewed = true` → Eleanor eventMapping |
| `submit_forensic_flag` | `forensic_chain_verified = true` → Eleanor eventMapping |
| `enter_archive` | Room entry auto-complete |
| `read_packet_a` | `it_forensics_reviewed = true` → Eleanor eventMapping |
| `read_packet_b` | `ot_forensics_reviewed = true` → Eleanor eventMapping |
| `read_packet_c` | `warranty_evidence_reviewed = true` → Eleanor eventMapping |
| `talk_to_eleanor_warranties` | `#complete_task` in `npc_eleanor_vance.ink` |
| `read_osei_report` | `loss_quantum_reviewed = true` → Eleanor eventMapping |
| `read_ncsc_brief` | `attribution_brief_reviewed = true` → Eleanor eventMapping |
| `read_underwriting_file` | `underwriting_file_reviewed = true` → Eleanor eventMapping |
| `talk_to_eleanor_decision` | `#complete_task` in `npc_eleanor_vance.ink` |
| `assess_trent_water` | `#complete_task` in `npc_robert_ngata.ink` |
| `talk_to_eleanor_debrief` | `#complete_task` in `npc_eleanor_vance.ink` |

## Win Condition

- Eleanor Vance ink sets `#set_global:debrief_complete:true` at scenario end
- Music section fires `debrief_complete` event → `disableClose: true` + credits screen
- Credits show conditional outcomes based on `coverage_decision` (`"full"` / `"partial"` / `"decline"`), `war_exclusion_invoked`, and `trent_water_assessed`

## Aim Unlock Chain

| Aim | Unlocks when |
|-----|-------------|
| `initial_briefing` | Always active (start) |
| `investigate_claim` | `aimCompleted: initial_briefing` |
| `access_evidence_archive` | `policy_reviewed = true` AND `forensic_chain_verified = true` |
| `assess_warranties` | `warranty_evidence_reviewed = true` |
| `make_recommendation` | `warranty_checklist_complete = true` |
| `trent_water_assessment` | `attribution_brief_reviewed = true` (also via Eleanor `unlockAim`) |
| `closing_debrief` | `coverage_decision_made = true` |

## Key Design Fixes (2026-04-24)

The following soft locks and design issues were resolved:

1. **`warranty_checklist_complete` now set**: Eleanor's `warranty_hub` sets it via `#set_global` after all 4 warranties discussed. Entry gate uses `warranty_evidence_reviewed` (not `warranty_checklist_complete`) to avoid circular dependency.
2. **`coverage_decision_made` now set**: New `submit_coverage_decision` knot in Eleanor's ink gives player three-way choice and sets both `coverage_decision` and `coverage_decision_made` via `#set_global`.
3. **Credits conditions fixed**: Now compare `globalVars.coverage_decision` against `"full"`, `"partial"`, `"decline"` (matching ink output).
4. **`trent_water_assessment` aim unlock wired**: Eleanor's `attribution_brief_reviewed` eventMapping includes `unlockAim: trent_water_assessment`.
5. **Dead globals removed**: `claim_opened`, `fdp_reviewed`, `cms_reviewed` removed from `globalVariables`.
6. **`war_exclusion_invoked` player choice preserved**: Eleanor's `war_exclusion_invoked_path` now gives genuine final choice after counterargument — both outcomes reachable.
7. **Archive unlock bark includes PIN pointer**: Both archive eventMappings include cabinet PIN reference.
8. **Phone NPCs reactive**: Whitworth, Osei, Ngata all have `timedMessages` and `eventMappings` for proactive outreach.
9. **Puzzle graph enriched**: 4 key objects now have `puzzle_graph_*` metadata; AND-gate pair correctly annotated.

## Remaining TODOs (non-blocking)

### Sprites (using placeholders)
- `forensic_data_platform.png` — using `pc.png` placeholder
- `ncsc_brief.png` — using `notes.png` placeholder
- `inspector_female` — Eleanor Vance character sprite (using `female_office_worker`)
- `room_meridian_claims` — Claims suite room tileset (using `room_office`)
- `room_meridian_archive` — Evidence archive tileset (using `room_it`)

### Content
- FDP terminal VM (Hacktivity VM `meridian_forensic_review`) — sets `forensic_chain_verified`
- `coverage_decision_made` mechanism — FDP or CMS minigame needs to set this variable
- `ins001/003/008/009_assessed` variables declared but not wired to any NPC conversation

### Audio
- Voice lines for all NPCs (narrator, Eleanor, phone contacts)

### Testing
- Scenario has not been manually tested
