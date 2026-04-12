# TESTING WALKTHROUGH — sis01_healthcare
## Northgate Hospital: Security-Informed Safety Scenario

**Last updated:** April 2026  
**Scenario status:** Draft — all Ink compiled, RFID card wired, MG-08 infusion pump wired; VMs still needed for full run  
**Estimated test time:** ~15 minutes for full minigame pass; 45+ minutes for full narrative run

---

## TESTING PREREQUISITES

Two gaps remain that affect testability. Everything else is in place.

| Gap | Impact | Workaround |
|-----|--------|------------|
| VM: `northgate_vpn_logs` not built | VPN terminal shows connection error | Submit flag directly at `vpn_flag_station` (see Phase 2) |
| VM: `northgate_pump_mgmt` not built | Drug library terminal shows connection error | Submit flag directly at `drug_library_flag_station` (see Phase 3) |

**Previously listed gaps that are now resolved:**
- ✅ All 11 NPC Ink files compiled — full dialogue trees available in all rooms
- ✅ `ravi_rfid_card` implemented — Ravi holds it; gives it in his opening conversation; unlocks Ward 7 RFID door
- ✅ `dual_auth_panel` — `lockType:dual_auth` with both PINs in `scenarioData`; no longer needs workaround

**To find the PIN values for dual_auth testing** (when testing without playing through Ravi/David dialogue): render the scenario JSON and look for `scenarioData.itsec_pin` and `scenarioData.clinical_pin` on the `dual_auth_panel` object. These are randomised per session by `@random_pin`.

---

## PHASE 1 — WARD 7 (Starting Room)

### On game load
- [ ] Scenario brief appears (`show_scenario_brief: "on_start"`)
- [ ] Cutscene music starts (or noir if `briefing_played` already true)
- [ ] Player spawns in Ward 7
- [ ] Patrol nurse is moving between waypoints at 80px/s, dwelling at each bed
- [ ] Ward alarm panel (x:1,y:4) shows amber MONITORING STATUS indicator

### Interact: Sarah Mitchell (x:5,y:3)
- [ ] `arrival_briefing` timedConversation fires immediately on game load (delay: 0, waitForEvent: game_loaded)
- [ ] Sarah explains monitoring loss, manual rounds, Bed 4 alarm
- [ ] `briefing_played` set to `true`; music switches to noir on conversation close
- [ ] On return visit: `start` knot (repeat summary)
- [ ] Player can ask about Bed 4 → `bed4_concern` → `bed4_options` → `escalate_bed4`
- [ ] Choosing escalate: `bed4_escalated` → `true` → patrol nurse patrolOverride fires (see Phase 1b)

### Interact: EHR Terminal (x:8,y:3)
- [ ] `ehr-terminal` minigame opens
- [ ] Screen shows OFFLINE error: _"Do not attempt to prescribe from memory. Use paper MAR charts."_
- [ ] `ehr_terminal_viewed_offline` → `true`
- [ ] Close button works

### Collect: MAR Charts (x:6,y:3)
- [ ] Item added to inventory on pickup
- [ ] `paper_charts_collected` → `true`
- [ ] `collect_mar_charts` task progress updates

### Interact: Ward Monitoring Station (x:5,y:2) — ransomware_display
- [ ] DarkVault ransom note: £1,200,000, 71hrs, skull icon
- [ ] Northgate Trust details visible (encryptedSystems, walletAddress, supportPortal)
- [ ] Three action buttons present; no crash on click

### Interact: Bed 4 Monitor (x:9,y:5)
- [ ] Cardiac alarm vitals: HR 47, SpO2 91%, BP 88/52
- [ ] CENTRAL STATION: OFFLINE note visible

### Interact: Bed 2 Pump Terminal (x:5,y:5) — infusion_pump (MG-08)
- [ ] Postit note: _"Collect paper MAR charts before using this terminal"_
- [ ] **Without MAR charts:** shows "PAPER MAR CHARTS REQUIRED" screen; minigame closes; `paper_charts_collected` must be `true` before dose entry
- [ ] **With MAR charts:** Phaser.js pump UI renders; prescription panel shows `MORPHINE SULPHATE 10.0 mg/hr`
- [ ] Enter `10` (correct): `pump_dose_correct` → `true`; success animation
- [ ] Enter `100` (decimal misread): double-check modal shows large red dose; confirm → `pump_dose_error` → `true` → `patient_bed2_state` → `"sedated"`
- [ ] **If `drug_library_compromised=true`:** entering wrong dose accepted silently (no modal); `pump_dose_error` → `true` directly

### Read: Nursing Handover Notes (x:7,y:3)
- [ ] Bed 4 and Bed 2 clinical details visible; decimal-point ambiguity on morphine dose noted

---

## PHASE 1b — DETERIORATION TIMER CHAIN (passive, runs in background)

These fire automatically with no player input.

| Time | Expected event |
|------|---------------|
| 8 min | `patient_bed4_state` → `"distressed"` |
| 8 min | Bed 4 patient barks: _"Hello? Is anyone there? My machine is beeping."_ |
| 15 min | `patient_bed4_state` → `"critical"` (no bark — patient silent at critical) |
| 22 min | `major_incident` → `true`, `patient_bed4_deceased` → `true` (if not escalated) |
| 22 min | Patrol nurse barks: _"Major incident — all hands."_ (800ms delay) |
| 22 min | Nurse patrol speed → 150px/s, dwell → 0.3x |

**To prevent patient death during testing:** escalate Bed 4 via Sarah before 22 minutes — choose `escalate_bed4` in her dialogue tree. This sets `bed4_escalated=true` and triggers the nurse patrolOverride.

### Verify patrolOverride (after `bed4_escalated=true`):
- [ ] Nurse immediately stops patrol loop
- [ ] Nurse barks: _"On my way to Bed 4 now."_
- [ ] Nurse moves at 150px/s toward tile (7,5); stops on arrival
- [ ] `patrol_nurse_at_bed4` → `true`
- [ ] `patient_bed4_state` → `"attended"` (bed4_patient eventMapping reacts to `patrol_nurse_at_bed4`)
- [ ] Bed 4 patient switches to `state_attended` knot: nurse is shown attending

---

## PHASE 2 — IT SECURITY OFFICE

### Prerequisite: Leave Ward 7

- [ ] Talk to Ravi before heading north — Ravi gives `ravi_rfid_card` in his `start` knot
- [ ] Card appears in inventory
- [ ] North exit (RFID door) now unlocks with the card

### Interact: Ravi Anand (x:4,y:5)
- [ ] `start` knot: exhausted; explains overnight timeline; hands over RFID card
- [ ] Options to ask about SIEM (`siem_briefing`) and VPN logs (`vpn_briefing`)
- [ ] `give_itsec_code` knot gated — only accessible after `siem_escalated=true` AND `vpn_anomaly_identified=true`

### Interact: SIEM Console (x:4,y:4) — siem_dashboard
- [ ] SIEM minigame opens ("NORTHGATE TRUST // SIEM CONSOLE" header)
- [ ] Alert list loads — includes the Northgate-relevant CRIT alerts (FINWKS-047, DC01, cross-zone RDP)  
  _Note: `alertConfig: northgate_2025_11` is currently ignored; minigame uses its built-in seeded alerts. The built-in set already contains the correct entries._
- [ ] Escalating all critical alerts within 240s: `siem_escalated` → `true`
- [ ] Dismissing a critical alert: `siem_missed_alerts` → `true`
- [ ] Ravi barks on `siem_escalated`: _"Right — those are the critical alerts. That cross-zone RDP is how they reached the clinical VLAN."_
- [ ] `ravi_siem_briefed` → `true`

### Read: VPN Log Printout (x:8,y:5)
- [ ] `c.ellison` entry circled — Romanian IP, no MFA
- [ ] Handwritten notes point player to `contractor_accounts.txt`

### Interact: VPN Terminal (x:7,y:4) — vm-launcher
- [ ] VM connection attempt; expect error — `northgate_vpn_logs` not yet built
- [ ] _Workaround for testing:_ skip terminal, submit flag directly at flag station below

### Interact: VPN Flag Station (x:8,y:4)
- [ ] Flag submission UI appears
- [ ] Submit `northgate_vpn_logs:vpn_flag_1` → `vpn_anomaly_identified` → `true`
- [ ] Ravi barks: _"That's it. c.ellison. No MFA. That account should never have been active."_
- [ ] `ravi_vpn_briefed` → `true`; `vpn_anomaly` task marks complete

### Return to Ravi — give_itsec_code
- [ ] With both `siem_escalated` and `vpn_anomaly_identified` true, `give_itsec_code` knot now reachable
- [ ] Ravi gives `itsec_pin` in dialogue (4-digit code — note it for dual_auth_panel)

### Interact: Network Segmentation Map (x:5,y:2) — network-segmentation-map
- [ ] Four-zone topology renders (External / Enterprise IT / Clinical / Legacy flat)
- [ ] Three legacy exception rule toggles interactive
- [ ] First rule toggle: `network_rules_reviewed` → `true`
- [ ] SEVER button activates after first interaction
- [ ] _For governance test path:_ do NOT press SEVER here — proceed to dual_auth_panel instead
- [ ] _For shortcut test:_ pressing SEVER confirm → `network_isolated` → `true` → full NPC cascade fires

---

## PHASE 3 — MAJOR INCIDENT ROOM

### Interact: Command Board (x:8,y:2) — command_board
- [ ] Incident timeline renders with preseed entry: "Mon 22:38 MAJOR INCIDENT DECLARED"
- [ ] System status rows: EHR / WARD 7 MONITORING / FLEET / BACKUPS / NETWORK / RANSOMWARE
- [ ] New entries appear reactively as globals fire throughout the session:
  - `network_isolated=true` → logs isolation entry
  - `backup_recovery_source=cloud_vendor` → logs cloud restore ETA 18hr
  - `drug_library_verified=true` → logs library verification
  - `patient_bed4_state=CRITICAL` or `DECEASED` → logs patient status
  - `ico_notified=true` / `ico_deadline_missed=true` → logs ICO status
  - `siem_escalated=true`, `vpn_anomaly_identified=true` etc.

### Interact: David Osei (x:4,y:3)
- [ ] `start` knot: explains pump network exposure; references safety case document on table
- [ ] `safety_case_hc001` knot: CLAIM-HC-001 review; player advises on network segmentation
- [ ] Player choice sets `safety_claim_hc001_assessed` → `true`
- [ ] `give_clinical_code` knot: David gives `clinical_pin` (note it for dual_auth_panel)  
  _Gates on `network_rules_reviewed=true` — player must have reviewed the NSM first_

### Interact: Safety Case Extract (x:5,y:4) — readable
- [ ] CLAIM-HC-001, HC-003, HC-007 text visible with evidence statements
- [ ] Cross-reference with what David and Helen say in dialogue

### Interact: Dual Auth Panel (x:5,y:3) — dual_auth
- [ ] Two-panel UI: IT SECURITY MANAGER (left) + CLINICAL ENGINEERING (right)
- [ ] 5-minute countdown timer starts
- [ ] Left keypad: enter `itsec_pin` (from Ravi's dialogue)
  - [ ] Correct → left panel AUTHORISED; `itsec_authorised` → `true`
  - [ ] Wrong → ACCESS DENIED flash, input cleared
- [ ] Right keypad: enter `clinical_pin` (from David's dialogue)
  - [ ] Correct → right panel AUTHORISED; `clinical_eng_authorised` → `true`
- [ ] AUTHORISE button activates only when both confirmed
- [ ] Pressing AUTHORISE:
  - [ ] `network_isolation_authorised` → `true`
  - [ ] `network_isolated` → `true`
  - [ ] NPC cascade fires: Sarah, Ravi, David, Helen all react via person-chat eventMappings
  - [ ] Music → cutscene
  - [ ] Command board logs isolation entry
- [ ] Timeout test (5 min without completing):
  - [ ] `dual_auth_failed` → `true`
  - [ ] "AUTHORISATION TIMED OUT" banner; minigame closes with `complete(false)`

### Interact: Helen Carver (x:7,y:3)
- [ ] `start` knot: explains no ransom payment; asks for backup assessment
- [ ] `backup_advisory` knot: warns about reinfection risk if network not isolated before restore
- [ ] `safety_case_hc007` knot: CLAIM-HC-007 review; player assesses → `safety_claim_hc007_assessed` → `true`
- [ ] `ico_advisory` knot: presents 72-hour ICO clock (Mon 22:38 + 72hr = Thu 22:38)
  - [ ] Player choice "Yes — notify now" → `ico_notified` → `true` (stops ICO deadline timer)
  - [ ] Player choice to defer → timer continues; `ico_deadline_missed` fires at 45 min

### Interact: Backup Console (x:4,y:5) — backup_recovery
- [ ] Three source tiles: NAS (ENCRYPTED ✗), Tape (CATALOGUE WIPED ✗), Cloud (AVAILABLE ✓)
- [ ] Selecting each tile updates consequence panel
- [ ] Confirm button disabled until selection made
- [ ] Confirming Cloud:
  - [ ] `backup_recovery_source` → `"cloud_vendor"`
  - [ ] `recovery_eta_hours` → `18`
  - [ ] `backup_restore_initiated` → `true`
  - [ ] Helen eventMapping fires → person-chat `post_backup`
  - [ ] Command board logs cloud restore
- [ ] Confirming NAS or Tape: `recovery_eta_hours` → `0`
- [ ] Second open: DECISION LOCKED badge; no re-selection

### Interact: Drug Library Terminal (x:7,y:5) — vm-launcher
- [ ] VM connection attempt; expect error — `northgate_pump_mgmt` not yet built
- [ ] _Workaround:_ submit flag directly at flag station below

### Interact: Drug Library Flag Station (x:8,y:5)
- [ ] Submit `northgate_pump_mgmt:drug_flag_1`:
  - [ ] `drug_library_verified` → `true`
  - [ ] `drug_library_compromised` → `true`
- [ ] David eventMapping fires → person-chat `safety_case_hc003` (drug library safety case)
- [ ] Patrol nurse eventMapping fires → bark + setPatrolSpeed 150 + setDwellMultiplier 0.3
- [ ] `verify_drug_library` task completes → `debrief_started` → `true` (task onComplete)
- [ ] Dr Sharma reveal:
  - [ ] Sharma becomes visible in room (setVisible: true)
  - [ ] Person-chat opens automatically → `start` knot
  - [ ] Music → victory ("Ghost in the Wire")
  - [ ] Credits: INCIDENT CONTAINED or INCIDENT CONTAINED — WITH LOSSES (based on patient death vars)

### Interact: Dr Sharma (x:6,y:7) — debrief
- [ ] Five-topic structured debrief: patient_outcomes → safety_claims → regulatory → root_cause → closing
- [ ] `patient_outcomes`: reads board entries aloud; asks what made outcomes possible
- [ ] `safety_claims`: reads CLAIM-HC-001/003/007 and evidence of failure
- [ ] `regulatory`: acknowledges ico_notified or notes missed deadline (no editorial)
- [ ] `root_cause`: presents attack chain; _"The attack revealed that the safety measures depended on IT infrastructure that was never treated as safety-critical."_
- [ ] `closing`: sets `debrief_complete` → `true`

---

## PHASE 4 — ICO DEADLINE TIMER (parallel throughout)

- [ ] ICO countdown widget visible with label "ICO Notification Deadline"
- [ ] Timer fires at 45 game-minutes if `ico_notified` still `false`
- [ ] `ico_deadline_missed` → `true`
- [ ] Dr Hartley eventMapping fires → person-chat `deadline_missed` (£17.5M maximum fine tone)
- [ ] Command board logs ICO deadline missed

To test **notification path** instead: reach Helen's `ico_advisory` knot and choose to notify before the timer fires.

---

## FULL EVENT CASCADE VERIFICATION CHECKLIST

After a complete test run, verify all expected global variables:

| Variable | Setter | Expected value |
|----------|--------|----------------|
| `briefing_played` | Sarah timedConversation | `true` |
| `paper_charts_collected` | MAR charts onPickup | `true` |
| `ehr_terminal_viewed_offline` | ehr-terminal minigame | `true` |
| `siem_escalated` | SIEM minigame success | `true` |
| `siem_missed_alerts` | SIEM (if critical dismissed) | `true` (failure path) |
| `vpn_anomaly_identified` | vpn_flag_station flagRewards | `true` |
| `ravi_siem_briefed` | Ravi eventMapping | `true` |
| `ravi_vpn_briefed` | Ravi eventMapping | `true` |
| `network_rules_reviewed` | NSM first rule toggle | `true` |
| `itsec_authorised` | dual_auth minigame | `true` |
| `clinical_eng_authorised` | dual_auth minigame | `true` |
| `network_isolation_authorised` | dual_auth minigame | `true` |
| `network_isolated` | dual_auth or NSM SEVER | `true` |
| `backup_recovery_source` | backup-recovery minigame | `"cloud_vendor"` |
| `recovery_eta_hours` | backup-recovery minigame | `18` |
| `backup_restore_initiated` | backup-recovery minigame | `true` |
| `drug_library_verified` | drug_flag_station | `true` |
| `drug_library_compromised` | drug_flag_station | `true` |
| `safety_claim_hc001_assessed` | David Osei Ink | `true` |
| `safety_claim_hc003_assessed` | David Osei Ink | `true` |
| `safety_claim_hc007_assessed` | Helen Carver Ink | `true` |
| `ico_notified` | Helen Carver Ink | `true` (if notified in time) |
| `ico_deadline_missed` | ICO timer | `true` (if not notified) |
| `bed4_escalated` | Sarah Mitchell Ink | `true` |
| `patrol_nurse_at_bed4` | Patrol nurse eventMapping | `true` |
| `patient_bed4_state` | Timer chain or nurse arrival | `"attended"` or `"critical"` |
| `debrief_started` | verify_drug_library task onComplete | `true` |
| `sharma_visible` | Dr Sharma eventMapping | `true` |
| `debrief_complete` | Dr Sharma Ink closing knot | `true` |
| `pump_dose_correct` | infusion_pump minigame (MG-08) | `true` (correct path) |
| `pump_dose_error` | infusion_pump minigame (MG-08) | `true` (wrong dose confirmed) |
| `patient_bed2_state` | pump_dose_error eventMapping | `"sedated"` |
| `backup_reinfected` | backup-recovery minigame (30 s delay) | `true` (if restored before isolation) |

**Variables not yet settable** (pending future engine/Ink work):
- `ncsc_notified` — needs Ink choice in Hartley or Ravi
- `drug_library_restored` — needs Ink or MG-09 extension
- `patient_bed2_deceased` — double-jeopardy path: `pump_dose_error=true` AND `drug_library_compromised=true`

---

## KNOWN ISSUES TO LOG

- [ ] NSM SEVER bypasses dual_auth governance — player can isolate network without both PINs; `network_isolation_authorised` stays `false` as a detectable signal; engine `requiresGlobal` param needed on NSM
- [ ] SIEM `alertConfig: northgate_2025_11` is ignored — minigame uses hardcoded seeded alerts (which already match Northgate content); full config support is a P2 task
- [ ] Pharmacist NPC (`initiallyHidden:true` + `patrol.enabled:true`) — verify patrol does not run while hidden; should only activate on `setVisible:true` from `pharmacist_on_ward` eventMapping
- [ ] All NPC positions are first-pass estimates — verify against room tile renders before sign-off
- [ ] `debrief_complete` set in `npc_sharma.ink:closing` — verify Ink `~ debrief_complete = true` correctly propagates to engine globalVariables
