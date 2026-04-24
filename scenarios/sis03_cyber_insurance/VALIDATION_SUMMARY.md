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
- ✅ Dungeon graph generated (10 nodes, 4 edges — integrated)

## Graph Summary

```
Puzzle     — Nodes: 3  Edges: 2
Story      — Nodes: 7  Edges: 1
Integrated — Nodes: 10  Edges: 4
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
- `james_whitworth` — Phone NPC, Albion Risk Manager
- `david_osei` — Phone NPC, Fairbridge Loss Adjuster
- `robert_ngata` — Phone NPC, NCSC Liaison

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
- Credits show conditional outcomes: coverage decision, warranty positions, Trent Water status

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
- `cms_reviewed` never set — CMS minigame may need a hook for this
- `ins001/003/008/009_assessed` variables declared but not wired to any NPC conversation

### Audio
- Voice lines for all NPCs (narrator, Eleanor, phone contacts)

### Testing
- Scenario has not been manually tested
