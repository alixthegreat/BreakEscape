# TODO — sis01_healthcare: Northgate Hospital
## Remaining work to reach a complete, playable scenario

**Last reviewed:** April 2026

**P1 status:** Both P1 blockers resolved. MG-06 and MG-09 minigames merged — scenario is now first-playable. Remaining work is P2/P3.

| Blocker | Plan doc | Status |
|---------|----------|--------|
| ~~MG-06 VPN Log Filter~~ | `planning_notes/sis_scenarios/case_1_healthcare_game_design/new_minigames/mg06_vpn_log_filter_builder.md` | ✅ merged |
| ~~MG-09 Drug Library Integrity Checker~~ | `planning_notes/sis_scenarios/case_1_healthcare_game_design/new_minigames/mg09_drug_library_integrity.md` | ✅ merged |

Priority key: **[P1]** blocking for first playable run · **[P2]** needed for full learning objectives · **[P3]** polish / post-draft

---

## DONE — previously listed as TODO

- ✅ All 11 Ink files written and compiled to `.json`
  - Duplicate `rushing_bed4` knot in `npc_patrol_nurse.ink` found and removed; recompiled clean
- ✅ `ravi_rfid_card` keycard added to Ravi's `itemsHeld`; given to player in `npc_ravi.ink:start`
- ✅ `dual_auth` minigame wired (`type:dual_auth`, pins from ERB `scenarioData`; not a lock — interacted directly)
- ✅ `backup-recovery` minigame wired (`type:backup_recovery`, sources in `scenarioData`; not a lock)
- ✅ `ehr-terminal` minigame wired (`type:ehr-terminal`, patient data in `scenarioData`)
- ✅ `network-segmentation-map` minigame wired; `network_rules_reviewed` set on first rule interaction
- ✅ `command_board` wired and listening to all major global vars
- ✅ NSM SEVER governance bypass documented; `requiresGlobal` engine TODO filed
- ✅ MG-08 infusion pump wired (`type:infusion_pump`; `drug_name`/`correct_dose` in `scenarioData`; `paper_charts_collected` gate built into minigame)
- ✅ `backup_reinfected` now wired via `backup-recovery` minigame (fires 30 s after restore if `network_isolated` was false at confirm time)
- ✅ `completeTask` eventMappings added to all NPCs so aim-completion chain works end-to-end
- ✅ Placeholder sprite PNGs created for all new minigame types (`infusion_pump`, `backup_recovery`, `dual_auth`, `ehr-terminal`, `network-segmentation-map`, `command_board`)
- ✅ `alertConfig` support added to `siem-dashboard-minigame.js`; `northgate_2025_11` alert set registered (4 critical alerts + 20 noise; covers FINWKS-047, DC01, FILESERVER-02, FIREWALL-CORE)

---

## ~~1. VPN ANOMALY ANALYSIS (MG-06)~~ — **DONE ✅**

MG-06 merged. `vpn_terminal` wired with `type:vpn_log_terminal`; 50-entry filterable log table; token-based filter builder; threat intel lookup; impossible travel detection. `completionActions` set `vpn_anomaly_identified=true` and complete `vpn_anomaly` task. Progress globals `vpn_threat_intel_checked` and `vpn_impossible_travel_identified` set via `progressActions`. VM path (Option A) still available for Hacktivity bash-skills cohorts — see plan doc.

Two implementation paths remain available for context:

### Option A: Hacktivity VM — `northgate_vpn_logs` (bash skills focus)

Best for: cybersecurity cohorts where grep/awk proficiency is an explicit learning objective.

Note: the VPN log printout on the IT office desk already circles `m.blake` and points to `contractor_accounts.txt`. Redact the annotation to `"Check the VPN terminal"` before deploying with the VM, or the paper props give the answer away.

| Path | Content |
|------|---------|
| `/var/log/vpn/auth.log` | ~50 entries: `[TIMESTAMP] USER=<u> IP=<ip> COUNTRY=<c> MFA=<YES\|NO> RESULT=<ACCEPT\|REJECT>`. Anomalous entry at ~line 31: `2025-11-04 08:52 USER=m.blake IP=185.220.101.47 COUNTRY=Romania MFA=NO RESULT=ACCEPT` |
| `/home/analyst/contractor_accounts.txt` | List of contractor accounts; `m.blake` noted as no-MFA |
| `/home/analyst/check_anomaly.sh` | Accepts IP address arg; validates against known-bad range; emits flag `vpn_flag_1` on correct submission |

Player workflow: `grep` through `auth.log` → spot Romanian IP → `./check_anomaly.sh 185.220.101.47` → submit flag.

### Option B: Log Analyser minigame (recommended default)

Best for: mixed audiences, time-constrained sessions, or scenarios where bash skills are not an objective.

A purpose-built HTML/JS minigame: a filterable table of 50 VPN auth log entries. Player applies a country/MFA filter, selects the anomalous row (`m.blake`, Romania, no MFA), and the flag submits on confirmation. No VM infrastructure required. Paper props work *with* the minigame (they point to the terminal; the terminal is the investigation tool).

**Same flag station wiring as Option A** — `vpn_flag_1` → `vpn_anomaly_identified=true`. No scenario changes needed to switch between options.

> **Current state:** Flag station wired, `vpn_flag_station` workaround available for testing. **Minigame plan written** — see `planning_notes/sis_scenarios/case_1_healthcare_game_design/new_minigames/mg06_vpn_log_filter_builder.md`. Implements Option B as the default deployment (filterable log table, no VM). Option A VM spec remains accurate for Hacktivity bash-skills cohorts.

---

## ~~2. DRUG LIBRARY INTEGRITY (MG-09)~~ — **DONE ✅**

MG-09 merged. `drug_library_checker` wired with `type:drug_library_terminal`; 5-step integrity checker (SHA-256 scan → hash detail → diff view → multi-source verification → fleet report); MORPHINE DOSE_MAX tamper (4→40 mg/hr) detected; fleet impact analysis cross-links with MG-08 pump outcome. `scanActions` set `drug_library_compromised=true`; `completionActions` set `drug_library_verified=true` + `drug_library_restored=true`. VM path (Option A) still available for Hacktivity forensics cohorts — see plan doc.

Two implementation paths remain available for context:

### Option A: Hacktivity VM — `northgate_pump_mgmt` (file integrity / forensics focus)

Best for: cybersecurity cohorts where `sha256sum`, `diff`, and shell scripting are explicit objectives.

| Path | Content |
|------|---------|
| `/opt/pump-management/drug_library.csv` | 23 entries; `MORPHINE,DOSE_MAX` tampered from `4` to `40` |
| `/opt/pump-management/drug_library.sha256` | SHA-256 of known-good library (fails for tampered csv) |
| `/opt/pump-management/drug_library.bak` | Known-good backup (matches hash) |
| `/home/analyst/verify_library.sh` | Accepts `DRUG_NAME DOSE_MAX`; emits `drug_flag_1` on `morphine 4` |

Player workflow: `sha256sum -c drug_library.sha256` → FAILED → `diff drug_library.csv drug_library.bak` → find tampered MORPHINE row → `./verify_library.sh morphine 4`.

### Option B: Drug Library Checker minigame (recommended default)

Best for: mixed audiences, and scenarios emphasising the *clinical safety* connection over bash proficiency.

A purpose-built HTML/JS minigame showing the pump management console drug library table. One row (Morphine) shows a checksum mismatch indicator. Player cross-references the paper MAR charts or backup report, selects the correct max dose (`4`), and restores the entry. This makes the Morphine/pump connection from MG-08 visually explicit — the tampered value the pump was loading is the same one the player just corrected at Bed 2.

Additional benefit: completing the minigame can set `drug_library_restored=true` directly (currently an unwired consequence variable), which unlocks Sharma's restoration branch in the debrief. Note: `drug_library_restored` is also set by the existing `drug_library_flag_station` flagRewards — the MG-09 `completionActions` will additionally set it. This is intentionally idempotent; confirm the MG-09 plan's `completionActions` list matches the flag station's `flagRewards` before removing the flag station.

**Same flag station wiring as Option A** — `drug_flag_1` → `drug_library_verified=true` + `drug_library_compromised=true`. No scenario changes needed to switch between options.

> **Current state:** Flag station wired, `drug_library_flag_station` workaround available for testing. **Minigame plan written** — see `planning_notes/sis_scenarios/case_1_healthcare_game_design/new_minigames/mg09_drug_library_integrity.md`.

---

## ~~2. MINIGAME — Infusion Pump Terminal (MG-08)~~ — **DONE ✅**

MG-08 merged. `bed2_pump_terminal` wired with `lockType:infusion_pump`; `drug_name`/`correct_dose` in `scenarioData`. All mechanics implemented: paper_charts gate, decimal-ambiguity prescription panel, double-check modal, `pump_dose_correct`/`pump_dose_error`, silent drug-library-compromised path.

---

## 3. SIEM ALERT DATA — Northgate customisation — **[P2]**

The SIEM minigame ignores `alertConfig` in `scenarioData` and uses `createSeededAlerts()`. The existing hardcoded alerts already include the Northgate-relevant entries, so **the scenario is testable now**. For a polished run:

Add `alertConfig` support to `siem-dashboard-minigame.js` to load scenario-specific alert sets. The Northgate set needs:

**Critical (must escalate):**
- `CRIT` / `FINWKS-047` — "Encoded PowerShell execution — base64 encoded command"
- `CRIT` / `DC01` — "LSASS memory access by non-system process"
- `HIGH` / `FILESERVER-02` — "Anomalous SMB write volume — 847 files in 3 min"
- `HIGH` / `FIREWALL-CORE` — "RDP session: ENTPWKS-012 → CLINWKS-003 (cross-zone)"

**Noise (~20 benign):** VLAN migration traffic, backup jobs, routine auth events, printer spools, spanning-tree recalculations.

---

## 4. SPRITES / VISUAL ASSETS — **[P2/P3]**

### Character sprites **[P2]**

| NPC | Current (placeholder) | Needed |
|-----|----------------------|--------|
| `sarah_mitchell` | `female_scientist` | NHS nurse: dark blue scrubs, lanyard, clipboard |
| `patrol_nurse` | `female_security_guard` | Same as Sarah or variant |
| `david_osei` | `male_hacker_hood_down` | Clinical engineer: smart casual, NHS lanyard |
| `dr_sharma` | `female_spy` | NCSC investigator: dark suit, government lanyard |

Minimum viable: nurse + clinical engineer. Sharma and patients can remain placeholders for the draft.

### Object sprites **[P3]**

Placeholder copies of `pc.png` created for all new minigame types — validator errors resolved. Commission proper assets when ready:
- ~~`ehr-terminal.png`~~ ✅ placeholder in place
- ~~`network-segmentation-map.png`~~ ✅ placeholder in place
- ~~`command_board.png`~~ ✅ placeholder in place
- `infusion_pump.png` ✅ placeholder in place
- `backup_recovery.png` ✅ placeholder in place
- `dual_auth.png` ✅ placeholder in place

---

## 5. ENGINE GAPS — **[P2/P3]**

### NSM SEVER governance bypass **[P2]**

The network segmentation map's SEVER button writes `network_isolated=true` directly after reviewing one rule, bypassing the `dual_auth_panel` governance flow. A player can isolate the network without obtaining both PINs.

**Fix:** add a `requiresGlobal` param to the NSM minigame that disables SEVER until the named var is true:
```json
"scenarioData": { "requiresGlobal": "network_isolation_authorised" }
```
Until implemented, document in facilitator notes: players who use NSM SEVER skip the dual-auth learning objective (`network_isolation_authorised` remains `false` as a detectable signal).

**Narrative consequence (implemented):** Ravi and David now bark on `network_isolated=true && !network_isolation_authorised` — expressing that they were not consulted. Their `post_isolation` Ink knots are gated behind `network_isolation_authorised=true` so they only fire on the authorized path. Sarah and Helen's `post_isolation` reactions (clinical consequences) still fire regardless of path.

### Pharmacist patrol while hidden **[P3]**

Verify `pharmacist_npc` (has both `initiallyHidden:true` and `patrol.enabled:true`) does not pathfind while hidden. Expected: patrol only activates when `setVisible:true` fires from the `pharmacist_on_ward` eventMapping.

### Unresolvable consequence variables **[P3]**

These globals have no setter yet — they represent failure paths and double-jeopardy conditions:

| Variable | What's needed |
|----------|--------------|
| ~~`drug_library_restored`~~ | ✅ Set via DrugLibraryIntegrityMinigame restore confirm (MG-09) `completionActions` |
| ~~`patient_bed2_deceased`~~ | ✅ `bed2_double_jeopardy` timer: `startOnGlobal:pump_dose_error`, 2 s delay, condition `drug_library_compromised`; sets `patient_bed2_state:"critical"` + `patient_bed2_deceased:true`; `state_deceased` knots added to `npc_bed2_patient.ink` and `npc_chair_patient.ink`; Sharma debrief updated |
| ~~`ncsc_notified`~~ | ✅ Set in `npc_hartley.ink:ncsc_advisory` + major incident declaration branch |
| ~~`debrief_complete`~~ | ✅ Set in `npc_sharma.ink:closing` — confirmed at `#set_global:debrief_complete:true` |

---

## 6. AUDIO — **[P3]**

`hospital_ambient` is referenced as `ambientSound` on `ward_7`. Check `assets/audio/` for a suitable existing loop, or create one.

Suggested elements: rhythmic monitor beeping, soft footsteps on vinyl, occasional distant PA announcement. Low-volume, no music.

---

## 7. POSITION TUNING — **[P3]**

All object and NPC positions are first-pass estimates. The room tilemap (`room_hospital_ward`, 20×10 tiles) exists. Verify positions after first render:

- Ward 7: nursing station cluster y:2–3; Bed row 1 y:5 (x:2,4,6,8); Bed row 2 y:8 (x:2,4)
- Check NPC and adjacent object co-location (e.g. `bed4_patient` x:8,y:5 vs `bed4_monitor` x:9,y:5)
- IT office and major incident room: desks y:4–5; wall-mounted objects y:2

---

## SUMMARY — by priority

### P1 (blocking for first playable run)
- ✅ **MG-06 (VPN anomaly):** VPN Log Viewer minigame merged
- ✅ **MG-09 (drug library):** Drug Library Integrity Checker minigame merged

### P2 (needed for full learning objectives)
- ~~[ ] Build MG-08 infusion pump minigame~~ ✅ done
- ✅ Add `alertConfig` support to SIEM minigame; create `northgate_2025_11` alert set
- [ ] Commission NHS nurse and clinical engineer sprite sheets
- [ ] Implement NSM `requiresGlobal` engine param to gate SEVER behind dual-auth

### P3 (polish, post-draft)
- [ ] Commission patient sprites (bed4, bed2) and NCSC investigator sprite
- [ ] Commission proper sprite assets for minigame terminals (placeholders in place)
- [ ] Source or create `hospital_ambient` audio loop
- ~~[ ] Wire `patient_bed2_deceased`~~ ✅ (~~`drug_library_restored`~~ still pending; ~~`ncsc_notified` ✅~~ ~~`backup_reinfected` ✅~~ ~~`debrief_complete` ✅~~)
- [ ] Verify pharmacist patrol does not run while NPC is hidden
- [ ] Tune all NPC and object positions after first room render
