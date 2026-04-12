# TODO — Case 2: Energy (Albion Battery Hall Crisis)
**scenario**: `scenarios/sis02_energy/scenario.json.erb`  
**Last updated**: April 2026

---

## Recently Completed

| ID | Item | Notes |
|----|------|-------|
| MG-01 | **ESD Pushbutton Minigame** | Digital guard-flip + confirm modal implemented (PR #59). Uses `interactionType: esd_button` on the pc object. `esd_activated` set by minigame; `press_esd_button` task completed via Priya eventMapping. Early-activation handled via `early_esd_activation` global variable. |
| MG-06 | **Network Architecture Diagram** | SVG Purdue Model diagram with 6 levels, 25 nodes, 5 attack paths, marching-ant animation on active paths, Trent Water sidebar (PR #60). `lockType: network_architecture` on smartscreen object in scada_control_room. Sets `network_architecture_reviewed = true` on first open. |
| MG-05 | **NIS 72-Hour Notification Clock** | Implemented using the scenario timer system (same pattern as ICO deadline in sis01_healthcare). `timers` entry `id: nis_deadline`, `delayMs: 2700000` (45 min game-time ≈ 72h), `condition: !ncsc_notified`. Countdown shows in HUD widget. `timerRef: "nis_deadline"` on the `nis_notification_form` object links form to clock. `nis_deadline_missed: false` global variable added. Priya bark fires on deadline expiry. No dedicated in-room smartscreen object (MG-07) — the HUD countdown + form timerRef delivers the intended mechanic. |
| INK-01 | **All 4 Ink files written and compiled** | `npc_priya_chandra.ink` (670 lines), `npc_marcus_webb.ink` (424 lines), `npc_tom_hadley.ink` (286 lines), `npc_dr_bashir.ink` (389 lines). All compiled to `.json` with inklecate — zero errors. |
| INK-02 | **Ink wiring audit passed** | All `#set_global` tags reference valid globalVariables. Both `#complete_task` tags reference valid taskIds. All `#exit_conversation` tags on own lines. Influence tag preceded by variable assignment. All hub conditional choices use correct `+ { condition } [text]` format. |
| INK-03 | **Display name / inline prefix alignment fixed** | `Marcus Webb (OT Security)`, `Tom Hadley (CastleTech SOC)`, `Dr Nalini Bashir (NCSC/HSE)` display names had job title suffixes preventing `parseDialogueLine()` from matching inline prefixes. Shortened to `Marcus Webb`, `Tom Hadley`, `Dr Nalini Bashir` in `scenario.json.erb`. |
| TEST-01 | **Scenario Validator** | Passed (VALIDATION_SUMMARY.md, 2026-04-03). Schema valid, ERB renders, all cross-references validated. |
| TEST-02 | **Ink Compilation** | All 4 `.ink` files compile cleanly. `.json` outputs present in `ink/`. |

---

## Outstanding — Blockers for First Playable

These items must be completed before the scenario can be tested end-to-end.

### VM Challenges (High Priority)

| ID | Item | Status | Notes |
|----|------|--------|-------|
| VM-01 | **SCADA Historian Trend Viewer** (`albion_scada_historian`) | Not built | Hacktivity VM showing Rack A1–A4 temperature trends. Flat-line anomaly from 23:12 must be identifiable. Flag: `albion_scada_historian:historian_flag`. Sets `historian_flatline_found = true` via flagReward. The `verify_anomaly` objective (Aim 3) is hard-blocked until this VM exists. **Workaround for testing**: submit flag directly at `historian_flag_station`, or temporarily add `onRead: { setVariable: { historian_flatline_found: true } }` to the vm-launcher. |
| VM-02 | **Jump Server Access Log Analyser** (`albion_eng_workstation`) | Not built | Hacktivity VM showing jump server RDP session log. `c.ellison` dormant account active from 01:47. SIS Engineering Interface tab shows `03:22` setpoint modification audit log. Flag: `albion_eng_workstation:jump_server_flag`. Sets `jump_server_confirmed = true`. The `contact_marcus_investigate` objective (Aim 4) is hard-blocked. **Workaround**: submit flag directly at `eng_flag_station`. |

---

## Outstanding — Minigames (Required for Full Play Experience)

| ID | Item | Status | Priority | Notes |
|----|------|--------|----------|-------|
| MG-02 | **SIS Configuration Threshold Display** | Placeholder (readable smartscreen text) | High | Interactive tabular SIS config panel. Rows: parameter / current value / certified value / deviation status / last-modified. `sis_config_seen = true` on read. Comparison view unlocked when `sis_certification_seen = true`. Confirm Tamper button sets `sis_tamper_confirmed = true`. Currently replaced by static `sis_config_panel` smartscreen. |
| MG-03 | **Facility Alarm Panel State Machine** | Placeholder (static smartscreen) | High | State-reactive lamp panel: 7 lamps driven by global variable changes (`anomaly_detected`, `sis_tamper_confirmed`, `esd_activated`, `jump_server_isolated`, `network_isolated`, `hydrogen_alarm`, `facility_safe_state`). Requires ENG-01. Physical version: GPIO relay LED panel. Digital version: SVG with CSS flash animation. |
| MG-04 | **Hydrogen Gas Alarm Progression** | Placeholder (static H₂ reading) | Medium | Timed escalation: T+22m from `anomaly_detected = true` → `hydrogen_alarm = true`, 0.9% LEL, Priya radio message. T+40m if `esd_activated = false` → 1.1% LEL, evacuation tone, red beacon. Requires ENG-02. |
| MG-05 | **NIS 72-Hour Notification Clock** | ✅ DONE (scenario timer + HUD) | Low | Implemented via `timers` array entry. HUD countdown widget shows time to deadline. `timerRef` on NIS form. `nis_deadline_missed` global fires Priya bark. No dedicated ENG-06-dependent room display needed. |
| MG-07 _(dev_tasks ref)_ | **NIS Clock In-Room Display** | Optional enhancement | Low | Dedicated `smartscreen` object in scada_control_room showing live countdown with green→amber→red CSS transitions. Requires ENG-06. Nice-to-have only — HUD widget + timerRef on form delivers the core mechanic. |

---

## Outstanding — Engine Features

| ID | Item | Status | Priority | Notes |
|----|------|--------|----------|-------|
| ENG-01 | **State-Reactive Alarm Panel Driver** | Not built | High | Required by MG-03. Subscribes to `global_variable_changed` events; evaluates lamp-to-variable mapping; emits commands to GPIO relay (physical) or SVG renderer (digital) via WebSocket. Configurable per-scenario lamp mapping. |
| ENG-02 | **Timed State Escalation Engine** | Not built | Medium | Required by MG-04. Config fields: `startOnGlobal`, `threshold_minutes`, `setGlobal`, `cancelOnGlobal`. Starts countdown on trigger variable, fires setGlobal at elapsed threshold, cancels on cancel variable. Generalised for reuse. |
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
| ASSET-07 | **Alarm Panel object sprite / SVG** | Not built | 7 individually addressable lamp positions. SVG preferred for WebSocket-driven state updates. Required by MG-03 / ENG-01. |

---

## Outstanding — Testing

| ID | Item | Depends On | Status | Notes |
|----|------|-----------|--------|-------|
| ~~TEST-01~~ | ~~Scenario Validator~~ | — | ✅ Done | Passed 2026-04-03. |
| ~~TEST-02~~ | ~~Ink Compilation~~ | TEST-01 | ✅ Done | All 4 files compile clean. |
| TEST-03 | **Full Play-Through — Mandatory Path** | VM-01, VM-02 (or workarounds) | Not run | Use TESTING_WALKTHROUGH.md. Verify all global variable transitions and task completions on happy path. Use flag-station workarounds for VMs. |
| TEST-04 | **Ink Dialogue Branch Coverage** | TEST-03 | Not run | All major state-dependent branches. Verify Dr Bashir `patch_decision` records both `active_management` and `deferral`. Verify Priya's `sis_compromise_discussion` sub-topics each set `en002_claim_assessed`. |
| TEST-05 | **Physical Prop Integration** | OBJ-01, MG-03 | Blocked | Full escape room only. GPIO relay, alarm panel lamps, RFID readers, cable contact sensor. |
| TEST-06 | **Optional Objective — Trent Water Path** | TEST-03 | Not run | Aim 9: Tom Hadley Trent Water thread → `trent_water_notified = true` → task complete → Dr Bashir Trent Water topic available. |
| TEST-07 | **Timed Escalation Regression** | ENG-02, MG-04 | Blocked | H₂ escalation timer accuracy. Edge: ESD at exactly T+22m; anomaly then immediate ESD; resume mid-escalation. |
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
| `facility_safe_state` approximation | Currently set on `network_isolated` alone (via Priya eventMapping). True condition should be `esd_activated AND (jump_server_confirmed OR network_isolated)`. A player who calls Tom Hadley before pressing ESD will set `facility_safe_state = true` prematurely — Dr Bashir appears before the ESD has been pressed. Requires ENG-05 to fix properly. | Medium — players can skip ESD on the digital version without consequence. |
| `historian_reviewed` global variable | Declared in `globalVariables` but never set by any object or event in the scenario. The `check_hmi_readings` task completes via Priya's `priya_briefed` eventMapping, not via this variable. Either add `onRead: { setVariable: { historian_reviewed: true } }` to the SCADA Live Status text_file, or remove the variable. | Low — harmless dead variable, but clutters state space. |
| `workshop_key_collected` flag | Set on pickup of the Engineering Workshop RFID keycard, but never read by any task, eventMapping, or condition. Tasks use `collect_items` → `workshop_key_group`. | Low — harmless, unused. |
| `hmi_reviewed` flag | Set by `onRead` on the SCADA Live Status text_file. Not used in task completion logic (task completes via Priya eventMapping). Informational only. | Low — harmless. |
| Plant room badge always visible | Badge should appear only after `priya_briefed = true` (Priya hands it over during walkdown). Currently visible from scenario start, allowing players to bypass Priya's briefing entirely and go straight to Battery Hall 1. Requires ENG-03. | Medium — undermines narrative flow; Aim 1 tasks become skippable. |
| Jump server cable always accessible | Cable should be revealed only after `jump_server_confirmed = true` (the RFID-gated panel opens). Currently always accessible, allowing players to pull the cable before identifying the attacker session. Requires ENG-04. | Low — pulling cable early just sets `jump_server_isolated` prematurely; Marcus's response message still fires correctly. |
| MG-06 placement | Network Architecture Diagram in `scada_control_room`. Originally considered for Engineering Workshop. Current placement gives players context earlier. No change needed unless playtesting shows confusion. | None currently. |

---

## Quick Reference: Global Variable Progression

```
INITIAL STATE (all false / empty)

  briefing_played=true         (Priya timedConversation auto-fires on load)
  priya_briefed=true           (Priya arrival_briefing knot — also unlocks Aim 2, completes check_hmi_readings)
  incident_folder_read=true    (read Incident Response Folder — Aim 1)
  hmi_reviewed=true            (read SCADA Live Status — informational only)
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
    → facility_safe_state=true (Priya eventMapping on network_isolated → unlocks Aims 8 & 10)
    → dr_bashir_visible=true   (Priya eventMapping on facility_safe_state → Dr Bashir appears + debrief_intro fires)
  sis_config_seen=true         (read sis_config_panel — Aim 7 → completes read_sis_config)
  sis_tamper_confirmed=true    (read SIS Certification Document — Aim 7 → completes find_certification_doc,
                                 sets en002_claim_assessed=true)
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
