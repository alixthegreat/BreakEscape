# TODO — Case 2: Energy (Albion Battery Hall Crisis)
**scenario**: `scenarios/sis02_energy/scenario.json.erb`  
**Last updated**: April 2026

**Status:** Full design review completed and all recommendations implemented. Scenario validates clean (sprite asset warnings only — known pending art). Story graph has 12 nodes / 13 edges. First playable run is unblocked.

---

## Recently Completed

| ID | Item | Notes |
|----|------|-------|
| MG-01 | **ESD Pushbutton Minigame** | Digital guard-flip + confirm modal implemented (PR #59). Uses `interactionType: esd_button` on the pc object. `esd_activated` set by minigame; `press_esd_button` task completed via Priya eventMapping. Early-activation handled via `early_esd_activation` global variable. |
| MG-06 | **Network Architecture Diagram** | SVG Purdue Model diagram with 6 levels, 25 nodes, 5 attack paths, marching-ant animation on active paths, Trent Water sidebar (PR #60). `type: network_architecture` on object in scada_control_room (was `lockType: network_architecture` — converted to item type). Triggered via `interactions.js` type check → `startNetworkArchitectureMinigame`. Sets `network_architecture_reviewed = true` on first open. |
| MG-04 | **Hydrogen Gas Alarm Progression** | Timed escalation implemented (PR #63). `h2_advisory` timer: T+22m from `anomaly_detected`, sets `hydrogen_alarm=true`, cancelled by `esd_activated`. `h2_evacuation` timer: T+40m, sets `facility_evacuated=true`. Priya radio messages for both steps. H₂ GAS lamp upgraded to 3-state: NORMAL → ADVISORY (amber) → EVACUATE (red flash). |
| ENG-02 | **Timed State Escalation Engine** | `startOnGlobal` and `cancelOnGlobal` fields added to `scenario-timer-dispatcher.js` (PR #63). Used by `h2_advisory` and `h2_evacuation` timers. |
| MG-05 | **NIS 72-Hour Notification Clock** | Implemented using the scenario timer system (same pattern as ICO deadline in sis01_healthcare). `timers` entry `id: nis_deadline`, `delayMs: 2700000` (45 min game-time ≈ 72h), `condition: !ncsc_notified`. Countdown shows in HUD widget. `timerRef: "nis_deadline"` on the `nis_notification_form` object links form to clock. `nis_deadline_missed: false` global variable added. Priya bark fires on deadline expiry. No dedicated in-room smartscreen object (MG-07) — the HUD countdown + form timerRef delivers the intended mechanic. |
| MG-02 | **SIS Configuration Threshold Display** | Interactive SIS threshold panel implemented (PR #61). `type: sis_config_panel` on object in engineering_workshop. Triggered via `interactions.js` id check → `startSisConfigThresholdMinigame`. Sets `sis_config_seen = true` on init. Compare mode unlocked when `sis_certification_seen = true`. Confirm Tamper button sets `sis_tamper_confirmed = true`. |
| MG-03 | **Facility Alarm Panel State Machine** | Live SVG lamp panel implemented (PR #62). `type: alarm_panel` on object in scada_control_room. Triggered via `interactions.js` type check → `startAlarmPanelMinigame`. 7 lamps driven by: `anomaly_detected`, `esd_activated`, `sis_tamper_confirmed`, `jump_server_isolated`, `network_isolated`, `hydrogen_alarm`, `facility_safe_state`. Flash animation on SIS STATUS and H₂ GAS lamps. |
| ENG-01 | **State-Reactive Alarm Panel Driver** | Implemented as part of PR #62. AlarmPanelMinigame subscribes to global variable changes and updates lamp states in real-time. |
| INK-01 | **All 4 Ink files written and compiled** | `npc_priya_chandra.ink` (670 lines), `npc_marcus_webb.ink` (424 lines), `npc_tom_hadley.ink` (286 lines), `npc_dr_bashir.ink` (389 lines). All compiled to `.json` with inklecate — zero errors. |
| INK-02 | **Ink wiring audit passed** | All `#set_global` tags reference valid globalVariables. All `#exit_conversation` tags on own lines. Influence tag preceded by variable assignment. All hub conditional choices use correct `+ { condition } [text]` format. |
| INK-04 | **NPC task completion tags added** | Added `#complete_task:talk_to_priya` to `npc_priya_chandra.ink`, `#complete_task:call_marcus_initial` to `npc_marcus_webb.ink`, `#complete_task:contact_castletech` to `npc_tom_hadley.ink`. All three fire at the top of `=== start ===` (every conversation, idempotent). All four `.ink` files recompiled — zero errors. Validator now reports zero ink wiring errors. |
| VM-01 | **SCADA Historian Trend Analyser** | `ScadaHistorianMinigame` implemented. `historian_trend_viewer` item (type `scada_historian`) inside `hmi_ops_01` PC. SVG time-series chart, 4-rack temperature display, pre-injection noise + flat-line at 28.0°C post-injection, time range selector (1h/3h/6h/12h/24h), dZ/dt overlay, Compare Racks view. `completionActions` set `historian_flatline_found = true` + complete `review_historian` task. Stale TODO/PLACEHOLDER comments removed from scenario header and task entry. |
| VM-02 | **Jump Server Access Log Analyser** | `LogFilterMinigame` implemented. `hmi_eng_02` item (type `log_filter_terminal`) direct room object in `engineering_workshop`. 40 session log entries, c.ellison anomaly (deprovisioned contractor, active session from Tor exit node), filter builder with awk preview, threat intel overlay, account history overlay, SIS Engineering Audit tab (`requireAllTabs` gate). `completionActions` set `jump_server_confirmed = true` + complete `identify_rdp_session` task. Type fixed from `minigame` → `log_filter_terminal` to match interactions.js dispatch. |
| INK-03 | **Display name / inline prefix alignment fixed** | `Marcus Webb (OT Security)`, `Tom Hadley (CastleTech SOC)`, `Dr Nalini Bashir (NCSC/HSE)` display names had job title suffixes preventing `parseDialogueLine()` from matching inline prefixes. Shortened to `Marcus Webb`, `Tom Hadley`, `Dr Nalini Bashir` in `scenario.json.erb`. |
| TEST-01 | **Scenario Validator** | Passed (VALIDATION_SUMMARY.md, 2026-04-03). Schema valid, ERB renders, all cross-references validated. |
| TEST-02 | **Ink Compilation** | All 4 `.ink` files compile cleanly. `.json` outputs present in `ink/`. |
| WK-01 | **Walkthrough QA — win condition and task trigger fixes** | Added `music` section with `debrief_complete` → `disableClose: true` + `credits` (win condition wire). Credits cover 5 sections: Physical Safety, Network Containment, SIS Investigation, Regulatory Compliance, Safety Case Review — with conditional text for all key outcome globals. Added ambient music events for game load, post-briefing, ESD activation. Re-wired `check_hmi_readings` task: removed from `priya_briefed` eventMapping; added separate eventMapping on `hmi_reviewed=true` so task completes only when player reads HMI-OPS-01 SCADA Live Status, not silently at briefing. Validator clean. |
| DR-01 | **Full Design Review — all recommendations implemented** | Soft lock fixed in `npc_marcus_webb.ink`: `#set_global:marcus_webb_contacted:true` moved to top of `first_call_hub` (before choice branches), removing the path where "Nothing specific yet" left `marcus_webb_contacted` permanently false. Priya `sendTimedMessage` added to `historian_flatline_found` and `jump_server_confirmed` eventMappings (aim transition narration). `timedMessages` added to Marcus Webb and Tom Hadley phone NPCs (escalation pressure). `unlockCondition` added to all 9 locked aims (story graph now 12 nodes / 13 edges; was 0 edges). `sis_config_panel` `puzzle_graph_unlocks` inaccuracy corrected. `player` field added to scenario. `hydrogen_detector` text updated to note 60-second sensor lag. All ink recompiled — zero errors. |

---

## Outstanding — Minigames (Required for Full Play Experience)

| ID | Item | Status | Priority | Notes |
|----|------|--------|----------|-------|
| MG-04 | **Hydrogen Gas Alarm Progression** | ✅ DONE (PR #63) | Medium | `h2_advisory` timer: T+22m from `anomaly_detected`, sets `hydrogen_alarm=true`, cancelled by `esd_activated`. `h2_evacuation` timer: T+40m, sets `facility_evacuated=true` if ESD not pressed. Priya radio messages for both escalation steps. Alarm panel H₂ GAS lamp upgraded to 3-state: NORMAL → ADVISORY (amber) → EVACUATE (red flash). Physical evacuation tone is a separate PHYS task (not implemented). |
| MG-05 | **NIS 72-Hour Notification Clock** | ✅ DONE (scenario timer + HUD) | Low | Implemented via `timers` array entry. HUD countdown widget shows time to deadline. `timerRef` on NIS form. `nis_deadline_missed` global fires Priya bark. No dedicated ENG-06-dependent room display needed. |
| MG-07 _(dev_tasks ref)_ | **NIS Clock In-Room Display** | Optional enhancement | Low | Dedicated `smartscreen` object in scada_control_room showing live countdown with green→amber→red CSS transitions. Requires ENG-06. Nice-to-have only — HUD widget + timerRef on form delivers the core mechanic. |

---

## Outstanding — Engine Features

| ID | Item | Status | Priority | Notes |
|----|------|--------|----------|-------|
| ENG-02 | **Timed State Escalation Engine** | ✅ DONE (PR #63) | Medium | `startOnGlobal` and `cancelOnGlobal` fields added to `scenario-timer-dispatcher.js`. Timer stays dormant until trigger variable fires; cancelled immediately on cancelOnGlobal variable. Used by `h2_advisory` and `h2_evacuation` timers. |
| ENG-03 | **Item Conditional Visibility** | Not built | Medium | Required by OBJ-02. Extend schema with `visibleWhen: { globalVar: value }`. Object hidden until condition met; reveal animation on condition true. Currently the plant room badge is always visible as a workaround. |
| ENG-04 | **Container Solenoid Lock Release** | Not built | Medium | Extend container schema with `lockedUntilGlobal: { var: value }`. Physical: GPIO solenoid release. Digital: visual lock icon removed. Used for jump server Ethernet cable management panel (locked until `jump_server_confirmed = true`). |
| ENG-05 | **Compound Condition Trigger** | Approximated | Low | Current workaround: `facility_safe_state` set on `network_isolated` alone. True implementation: `esd_activated AND (jump_server_confirmed OR network_isolated)`. Fails if a player isolates the network without pressing ESD. |
| ENG-06 | **Ambient Countdown Timer Display** | Not built | Low | Required by MG-05. Config: `duration_hours`, `startOnGlobal`, `completeOnGlobal`, `colourThresholds`. |
| ENG-07 | **NPC Fade-In Reveal Animation** | Not built | Low | When `initiallyHidden` NPC becomes visible, play 0.5s fade-in. Improves Dr Bashir reveal moment. |

---

## Outstanding — Objects and Physical Props

| ID | Item | Status | Priority | Notes |
|----|------|--------|----------|-------|
| OBJ-01 | **Physical GPIO relay for ESD** | Not built | High (escape room only) | Real mushroom-head ESD button connects to game server via GPIO relay. Bypasses digital minigame screen entirely in physical mode. |
| OBJ-02 | **Plant Room Badge — Conditional Reveal** | Workaround in place | Medium | Badge should appear in room only after `priya_briefed = true` (requires ENG-03). Currently visible from scenario start. |
| OBJ-06 | **SIS Certification Document** (already in filing cabinet) | Implemented | — | Content sourced from information pack. `sis_tamper_confirmed = true` on read. Verify content accuracy against `requirements/claims.md` for EN-001, EN-002, EN-007, EN-008. |

---

## Outstanding — Sprites and Art Assets

All sprite assets below are production-quality art requirements. The scenario runs with placeholder sprites; these are needed for the polished release version.

| ID | Item | Status | Notes |
|----|------|--------|-------|
| ASSET-01 | **Priya Chandra — engineer_female sprite** | Placeholder (`male_nerd`) | Navy coverall, hi-vis strips, hard hat, tablet. Idle/talk/walk animations. Headshot portrait. |
| ASSET-02 | **Dr Nalini Bashir — inspector_female sprite** | Placeholder (`male_nerd`) | Dark jacket, NCSC/HSE lanyard, clipboard. Idle/talk/walk animations. Headshot portrait. |
| ASSET-03 | **SCADA Control Room tilemap** | Placeholder (`room_office`) | SCADA workstation desks, alarm panel position, smartscreen position, two door positions. 10×12 tiles. |
| ASSET-04 | **Battery Hall tilemap** | Placeholder (`room_servers`) | Battery rack arrays A1–A4 as wall elements, amber LEDs, industrial ceiling. ESD housing and thermometer wall mount positions. 10×16 tiles. |
| ASSET-05 | **Engineering Workshop tilemap** | Placeholder (`room_it`) | Server rack with amber LED, engineering workstation, corkboard, cable management panel, entry door. 10×10 tiles. |
| ASSET-06 | **ESD Pushbutton sprite** | Placeholder (`pc` sprite) | Three-frame animation: armed (guard down) / guard_open (guard raised) / activated (LED green). Yellow housing, large red mushroom-head. Physical prop maker needs sprite reference before fabrication. |
| ASSET-07 | **Alarm Panel object sprite** | SVG done (PR #62); room sprite pending | The digital SVG alarm panel renders in-minigame via `AlarmPanelMinigame`. A dedicated room-level sprite for the panel object (wall-mounted panel appearance) still uses the `smartscreen` placeholder. |

---
---

## Outstanding — Testing

| ID | Item | Depends On | Status | Notes |
|----|------|-----------|--------|-------|
| ~~TEST-01~~ | ~~Scenario Validator~~ | — | ✅ Done | Passed 2026-04-03. |
| ~~TEST-02~~ | ~~Ink Compilation~~ | TEST-01 | ✅ Done | All 4 files compile clean. |
| TEST-03 | **Full Play-Through — Mandatory Path** | VM-01, VM-02 | Not run | Use TESTING_WALKTHROUGH.md. Verify all global variable transitions and task completions on happy path. Both VMs now implemented — no workarounds needed. |
| TEST-04 | **Ink Dialogue Branch Coverage** | TEST-03 | Not run | All major state-dependent branches. Verify Dr Bashir `patch_decision` records both `active_management` and `deferral`. Verify Priya's `sis_compromise_discussion` sub-topics each set `en002_claim_assessed`. |
| TEST-05 | **Physical Prop Integration** | OBJ-01, MG-03 | Blocked | Full escape room only. GPIO relay, alarm panel lamps, RFID readers, cable contact sensor. |
| TEST-06 | **Optional Objective — Trent Water Path** | TEST-03 | Not run | Aim 9: Tom Hadley Trent Water thread → `trent_water_notified = true` → task complete → Dr Bashir Trent Water topic available. |
| TEST-07 | **Timed Escalation Regression** | ENG-02, MG-04 | Not run | H₂ escalation timer accuracy. Edge: ESD at exactly T+22m; anomaly then immediate ESD; resume mid-escalation. |
| TEST-08 | **NIS Deadline Edge Case** | TEST-03 | Not run | Let timer expire without reading the NIS form. Verify `nis_deadline_missed = true`, Priya bark fires. Then read form — verify `ncsc_notified` still sets despite missed deadline. |
| TEST-09 | **Early ESD Path** | TEST-03 | Not run | Press ESD before `historian_flatline_found = true`. Verify `early_esd_activation = true`, Priya radio message fires, scenario does not block ESD activation. |
| TEST-MG-06 | **Network Architecture Diagram — Content Accuracy** | — | Not run | Compare rendered nodes/connections against information_pack for EN-001, EN-002, EN-011 attack paths. |
| TEST-OBJ-06 | **SIS Certification Document — Content Verification** | — | Not run | Verify certified setpoints (55°C, 1.0% LEL, 4.25V/cell) match requirements/claims.md. |

---

## Content Accuracy Checks (Information Pack)

The following scenario content should be cross-checked against the information pack for accuracy before final release:

- `network_architecture_diagram` — verify 25 nodes and 5 attack paths match `information_pack/system_architecture/network_architecture.md`
- SIS Certification Document in filing cabinet — verify certified setpoints match `information_pack/requirements/claims.md` (EN-001, EN-002, EN-007, EN-008)
- `sis_config_panel` text — verify tampered values (85°C threshold, 1.2% LEL, 4.32V/cell, firmware 2.4.1) are consistent with the assurance cases

---

## Known Design Gaps

| Gap | Description | Impact |
|-----|-------------|--------|
| ~~Plant room badge always visible~~ | **Fixed** — badge moved to Priya's `itemsHeld`; transferred via `#give_item:keycard` in `npc_priya_chandra.ink:walkdown_offer`. Players receive it when Priya offers the walkdown. ENG-03 no longer required for this gap. | Resolved |
| Jump server cable always accessible | Cable should be revealed only after `jump_server_confirmed = true` (the RFID-gated panel opens). Currently always accessible, allowing players to pull the cable before identifying the attacker session. Requires ENG-04. | Low — pulling cable early just sets `jump_server_isolated` prematurely; Marcus's response message still fires correctly. |
| `workshop_key_collected` flag | Set on `onPickup` of the Engineering Workshop RFID keycard, but never read by any task, eventMapping, or condition. Tasks use `collect_items` → `workshop_key_group`. Intentionally retained for session telemetry. | None — informational only. |
| MG-06 placement | Network Architecture Diagram in `scada_control_room`. Originally considered for Engineering Workshop. Current placement gives players context earlier. No change needed unless playtesting shows confusion. | None currently. |

### Resolved gaps

| Gap | Resolution |
|-----|------------|
| `facility_safe_state` approximation | **Fixed** — replaced single `network_isolated` eventMapping with two compound-condition mappings: one fires when `network_isolated` and `esd_activated` is already true; the other fires when `esd_activated` and `network_isolated` is already true. Dr Bashir now only appears after both conditions are met. ENG-05 no longer required. |
| `historian_reviewed` dead variable | **Fixed** — removed from `globalVariables`. Was declared but never set; `hmi_reviewed` (set by `onRead` on SCADA Live Status) is the active variable for this purpose. |
| `hmi_reviewed` flag (informational only) | **Fixed** — `hmi_reviewed=true` now wires `completeTask: check_hmi_readings` via Priya eventMapping. No longer informational. |

---

## Quick Reference: Global Variable Progression

```
INITIAL STATE (all false / empty)

  briefing_played=true         (Priya timedConversation auto-fires on load)
  priya_briefed=true           (Priya arrival_briefing knot — unlocks Aim 2)
  hmi_reviewed=true            (read SCADA Live Status on HMI-OPS-01 — completes check_hmi_readings)
  incident_folder_read=true    (read Incident Response Folder — Aim 1)
  plant_room_badge_collected=true (pick up badge — informational only)
  anomaly_detected=true        (read analog thermometer — Aim 2 → completes check_thermometer, unlocks Aim 3)
  historian_flatline_found=true (VM-01 flag — Aim 3 → unlocks Aim 4, fires Tom timed message)
  workshop_key_collected=true  (pick up workshop RFID key — informational only)
  marcus_webb_contacted=true   (call Marcus Webb — Aim 4 → unlocks Aims 5 & 6, fires ESD PIN message)
  en001_claim_assessed=true    (Marcus CLAIM-EN-001 dialogue)
  jump_server_confirmed=true   (VM-02 flag — Aim 4 → unlocks Aim 7)
  esd_activated=true           (MG-01 ESD minigame — Aim 5 → completes press_esd_button, fires Priya radio)
  jump_server_isolated=true    (read jump_server_cable — Aim 6 → completes pull_ethernet_cable)
  castletech_contacted=true    (call Tom Hadley and confirm isolation — Aim 6)
    → network_isolated=true    (Tom Hadley eventMapping on castletech_contacted)
    → facility_safe_state=true (Priya eventMapping: fires when BOTH esd_activated AND network_isolated are true
                                 — two mappings cover both orderings; unlocks Aims 8 & 10)
    → dr_bashir_visible=true   (Priya eventMapping on facility_safe_state → Dr Bashir appears + debrief_intro fires)
  sis_config_seen=true         (open sis_config_panel MG-03 minigame — Aim 7, step 1 → completes read_sis_config)
  sis_certification_seen=true  (read SIS Certification Document in filing cabinet — Aim 7, step 2 →
                                 completes find_certification_doc; unlocks Compare mode on sis_config_panel)
  sis_tamper_confirmed=true    (click Confirm Tamper on sis_config_panel — Aim 7, step 3 →
                                 sets en002_claim_assessed=true via eventMapping)
  ncsc_notified=true           (read NIS Notification Form — Aim 8 → completes complete_nis_form)
  en005_claim_assessed=true    (Dr Bashir patch_dilemma topic)
  debrief_complete=true        (Dr Bashir closing_summary knot — Aim 10 → completes talk_to_dr_bashir)
    → patch_decision = "active_management" | "deferral"

Optional:
  trent_water_notified=true    (Tom Hadley Trent Water → completes call_trent_water — Aim 9)
  network_architecture_reviewed=true  (open MG-06 Network Architecture Diagram)

Edge case:
  early_esd_activation=true    (ESD pressed before historian_flatline_found — fires Priya warning)
  nis_deadline_missed=true     (45-min NIS timer expires before ncsc_notified — fires Priya bark)
```
