# TODO — Case 2: Energy (Albion Battery Hall Crisis)
**scenario**: `scenarios/sis02_energy/scenario.json.erb`  
**Last updated**: April 2026

---

## Recently Completed (merged PRs)

| ID | Item | Notes |
|----|------|-------|
| MG-01 | **ESD Pushbutton Minigame** | Digital guard-flip + confirm modal implemented (PR #59). Uses `interactionType: esd_button` on the pc object. `esd_activated` set by minigame; `press_esd_button` task completed via Priya eventMapping. Early-activation handled via `early_esd_activation` global variable. |
| MG-06 | **Network Architecture Diagram** | SVG Purdue Model diagram with 6 levels, 25 nodes, 5 attack paths, marching-ant animation on active paths, Trent Water sidebar (PR #60). `lockType: network_architecture` on smartscreen object in scada_control_room. Sets `network_architecture_reviewed = true` on first open. |
| MG-05 | **NIS 72-Hour Notification Clock** | Implemented using the scenario timer system (same pattern as ICO deadline in sis01_healthcare). `timers` entry `id: nis_deadline`, `delayMs: 2700000` (45 min game-time ≈ 72h), `condition: !ncsc_notified`. Countdown shows in HUD widget. `timerRef: "nis_deadline"` on the `nis_notification_form` object links form to clock. `nis_deadline_missed: false` global variable added. Priya bark fires on deadline expiry. No dedicated in-room smartscreen object (MG-07) — the HUD countdown + form timerRef delivers the intended mechanic. |

---

## Outstanding — Blockers for First Playable

These items must be completed before the scenario can be tested end-to-end.

### VM Challenges (High Priority)

| ID | Item | Status | Notes |
|----|------|--------|-------|
| VM-01 | **SCADA Historian Trend Viewer** (`albion_scada_historian`) | Not built | Hacktivity VM showing Rack A1–A4 temperature trends. Flat-line anomaly from 23:12 must be identifiable. Flag: `albion_scada_historian:historian_flag`. Sets `historian_flatline_found = true` via flagReward. The `verify_anomaly` objective (Aim 3) is hard-blocked until this VM exists. |
| VM-02 | **Jump Server Access Log Analyser** (`albion_eng_workstation`) | Not built | Hacktivity VM showing jump server RDP session log. `c.ellison` dormant account active from 01:47. SIS Engineering Interface tab shows `03:22` setpoint modification audit log. Flag: `albion_eng_workstation:jump_server_flag`. Sets `jump_server_confirmed = true`. The `contact_marcus_investigate` objective (Aim 4) is hard-blocked. |

### Ink Compilation and Testing (High Priority)

| ID | Item | Status | Notes |
|----|------|--------|-------|
| TEST-02 | **Ink Compilation — All 4 NPCs** | Not run | All `.ink` files are written (635/423/388/285 lines for Priya/Marcus/Dr Bashir/Tom). Must compile with inklecate to `.json`. Verify: zero errors, all knot references valid, all `#complete_task` IDs match scenario, all `#set_global` variable names in `globalVariables`. |
| TEST-01 | **Scenario Validator** | Not run | Run `ruby scripts/validate_scenario.rb scenarios/sis02_energy/scenario.json.erb`. Fixes any schema errors before play-testing. |

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

| ID | Item | Depends On | Notes |
|----|------|-----------|-------|
| TEST-01 | **Scenario Validator** | — | Run first. Fixes any schema errors. |
| TEST-02 | **Ink Compilation — All 4 NPCs** | TEST-01 | inklecate compile + tag cross-check. |
| TEST-03 | **Full Play-Through — Mandatory Path** | TEST-02 | Aims 1–8 and 10. Verify all global variable transitions on happy path. |
| TEST-04 | **Ink Dialogue Branch Coverage** | TEST-02 | All major state branches. Verify Dr Bashir patch_decision records both options. |
| TEST-05 | **Physical Prop Integration** | OBJ-01, MG-03 | Full escape room setup only. GPIO relay, alarm panel lamps, RFID readers, cable contact sensor. |
| TEST-06 | **Optional Objective — Trent Water Path** | TEST-04 | Verify Aim 9: Tom Hadley Trent Water thread + `trent_water_notified = true` + Dr Bashir topic. |
| TEST-07 | **Timed Escalation Regression** | ENG-02, MG-04 | H₂ escalation timer accuracy; edge case: ESD at exactly T+22m; anomaly then immediate ESD. |
| TEST-MG-06 | **Network Architecture Diagram — Content Accuracy** | — | Compare rendered nodes/connections against `information_pack/system_architecture/network_architecture.md`. Verify EN-001, EN-002, EN-011 attack paths. |
| TEST-OBJ-06 | **SIS Certification Document — Content Verification** | — | Verify content matches `requirements/claims.md` for certified baseline parameters. |

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
| `facility_safe_state` approximation | Currently set on `network_isolated` alone. ESD press is required narratively but not enforced in code. | Low for digital play; medium for physical — players could skip ESD entirely. Requires ENG-05 to fix properly. |
| MG-06 placement | Network Architecture Diagram is in `scada_control_room` (per PR #60). The minigame planning document originally suggested placing it in the Engineering Workshop wall. Both locations are defensible; current placement (control room) gives players context earlier in the scenario. No change needed unless playtesting reveals confusion. |
| `historian_reviewed` global variable | Declared in `globalVariables` but never set by any object or event in the scenario. Either needs an `onRead` on the SCADA Live Status text_file, or should be removed. |
| `workshop_key_collected` flag | Set on pickup of the Engineering Workshop RFID keycard, but never read by any task or eventMapping. Tasks use `collect_items` → `workshop_key_group`. The flag is harmless but unused. |
| `hmi_reviewed` flag | Set by `onRead` on the SCADA Live Status text_file. The `check_hmi_readings` task is completed via Priya's `priya_briefed` eventMapping, not directly by `hmi_reviewed`. The flag is informational but not used in task completion logic. |

---

## Quick Reference: Global Variable Progression

```
INITIAL
  ↓ priya_briefed=true         (Priya arrival_briefing knot)
  ↓ anomaly_detected=true      (read analog thermometer — Aim 2)
  ↓ historian_flatline_found=true  (VM-01 flag — Aim 3)
  ↓ marcus_webb_contacted=true (call Marcus Webb — Aim 4)
  ↓ jump_server_confirmed=true (VM-02 flag — Aim 4)
  ↓ esd_activated=true         (MG-01 ESD minigame — Aim 5)
  ↓ jump_server_isolated=true  (read jump_server_cable — Aim 6)
  ↓ castletech_contacted=true  (call Tom Hadley — Aim 6)
    → network_isolated=true    (set by Tom Hadley eventMapping)
    → facility_safe_state=true (set by Priya eventMapping on network_isolated)
    → dr_bashir_visible=true   (set by Priya eventMapping on facility_safe_state)
  ↓ sis_config_seen=true       (read sis_config_panel — Aim 7)
  ↓ sis_tamper_confirmed=true  (read SIS Certification Document — Aim 7)
  ↓ ncsc_notified=true         (read NIS Notification Form — Aim 8)
  ↓ debrief_complete=true      (complete Dr Bashir dialogue — Aim 10)
    → patch_decision = "active_management" | "deferral"

Optional:
  trent_water_notified=true    (Tom Hadley Trent Water thread — Aim 9)
  early_esd_activation=true    (ESD pressed before historian_flatline_found)
  network_architecture_reviewed=true  (open Network Architecture Diagram — MG-06)
```
