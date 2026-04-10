# TODO — sis01_healthcare: Northgate Hospital
## Remaining work to reach a complete, playable scenario

**Last reviewed:** April 2026

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

---

## 1. HACKTIVITY VMs — **[P1] blocking**

Two VMs are referenced but not yet built. Flag stations are already wired — they just need the VMs to exist so players have something to investigate.

### VM: `northgate_vpn_logs` (MG-06 — VPN anomaly analysis)

| Path | Content |
|------|---------|
| `/var/log/vpn/auth.log` | ~50 entries: `[TIMESTAMP] USER=<u> IP=<ip> COUNTRY=<c> MFA=<YES\|NO> RESULT=<ACCEPT\|REJECT>`. Anomalous entry at ~line 31: `2025-11-04 08:52 USER=c.ellison IP=185.220.101.47 COUNTRY=Romania MFA=NO RESULT=ACCEPT` |
| `/home/analyst/contractor_accounts.txt` | List of contractor accounts; `c.ellison` noted as no-MFA |
| `/home/analyst/check_anomaly.sh` | Accepts IP address arg; validates against known-bad range; emits flag `vpn_flag_1` on correct submission |

Player workflow: `grep` through `auth.log` → spot Romanian IP → `./check_anomaly.sh 185.220.101.47` → submit flag.

Flag `northgate_vpn_logs:vpn_flag_1` → already wired at `vpn_flag_station` → sets `vpn_anomaly_identified=true`.

### VM: `northgate_pump_mgmt` (MG-09 — drug library integrity)

| Path | Content |
|------|---------|
| `/opt/pump-management/drug_library.csv` | 23 entries; `MORPHINE,DOSE_MAX` tampered from `4` to `40` |
| `/opt/pump-management/drug_library.sha256` | SHA-256 of known-good library (fails for tampered csv) |
| `/opt/pump-management/drug_library.bak` | Known-good backup (matches hash) |
| `/home/analyst/verify_library.sh` | Accepts `DRUG_NAME DOSE_MAX`; emits `drug_flag_1` on `morphine 4` |

Player workflow: `sha256sum -c drug_library.sha256` → FAILED → `diff drug_library.csv drug_library.bak` → find tampered MORPHINE row → `./verify_library.sh morphine 4`.

Flag `northgate_pump_mgmt:drug_flag_1` → already wired at `drug_library_flag_station` → sets `drug_library_verified=true` AND `drug_library_compromised=true`.

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
| `bed4_patient` | `female_blowse` | Male patient: recumbent on hospital bed |

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

### Pharmacist patrol while hidden **[P3]**

Verify `pharmacist_npc` (has both `initiallyHidden:true` and `patrol.enabled:true`) does not pathfind while hidden. Expected: patrol only activates when `setVisible:true` fires from the `pharmacist_on_ward` eventMapping.

### Unresolvable consequence variables **[P3]**

These globals have no setter yet — they represent failure paths and double-jeopardy conditions:

| Variable | What's needed |
|----------|--------------|
| `drug_library_restored` | MG-09 VM or Helen/David Ink knot after verified restore |
| `patient_bed2_deceased` | MG-08 double-jeopardy: if `pump_dose_error=true` AND `drug_library_compromised=true` → skip sedated, go deceased |
| `ncsc_notified` | Not yet in any Ink file — needs a player choice in `npc_hartley.ink` or `npc_ravi.ink` |
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
- [ ] Build Hacktivity VM: `northgate_vpn_logs`
- [ ] Build Hacktivity VM: `northgate_pump_mgmt`

### P2 (needed for full learning objectives)
- ~~[ ] Build MG-08 infusion pump minigame~~ ✅ done
- [ ] Add `alertConfig` support to SIEM minigame; create `northgate_2025_11` alert set
- [ ] Commission NHS nurse and clinical engineer sprite sheets
- [ ] Implement NSM `requiresGlobal` engine param to gate SEVER behind dual-auth

### P3 (polish, post-draft)
- [ ] Commission patient sprites (bed4, bed2) and NCSC investigator sprite
- [ ] Commission proper sprite assets for minigame terminals (placeholders in place)
- [ ] Source or create `hospital_ambient` audio loop
- [ ] Wire `drug_library_restored`, `patient_bed2_deceased`, `ncsc_notified` (~~`backup_reinfected` ✅~~ ~~`debrief_complete` ✅~~)
- [ ] Verify pharmacist patrol does not run while NPC is hidden
- [ ] Tune all NPC and object positions after first room render
