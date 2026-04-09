# TODO — sis01_healthcare: Northgate Hospital
## Remaining work to reach a complete, playable scenario

**Last reviewed:** April 2026

Priority key: **[P1]** blocking for first playable run · **[P2]** needed for full learning objectives · **[P3]** polish / post-draft

---

## DONE — previously listed as TODO

- ✅ All 11 Ink files written and compiled to `.json`
  - Duplicate `rushing_bed4` knot in `npc_patrol_nurse.ink` found and removed; recompiled clean
- ✅ `ravi_rfid_card` keycard added to Ravi's `itemsHeld`; given to player in `npc_ravi.ink:start`
- ✅ `dual_auth` minigame wired (`lockType:dual_auth`, pins from ERB `scenarioData`)
- ✅ `backup-recovery` minigame wired (sources moved into `scenarioData`)
- ✅ `ehr-terminal` minigame wired (type changed, patient data in `scenarioData`)
- ✅ `network-segmentation-map` minigame wired; `network_rules_reviewed` set on first rule interaction
- ✅ `command_board` wired and listening to all major global vars
- ✅ NSM SEVER governance bypass documented; `requiresGlobal` engine TODO filed

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

## 2. MINIGAME — Infusion Pump Terminal (MG-08) — **[P2]**

`bed2_pump_terminal` uses `lockType:pin` as a placeholder (`backup_pin`). The pump dose consequence path (`pump_dose_error` → `patient_bed2_state=sedated`) is fully wired — it just needs the real minigame to write the vars.

Requirements:
- Pixel-art pump body; paper prescription panel in handwriting font (`10.0 mg/hr` decimal ambiguity)
- Double-check modal after CONFIRM
- **Gate on `paper_charts_collected=true`** before showing dose UI; if false: _"No prescription available — locate paper charts first."_
- Correct entry → `pump_dose_correct=true`
- Wrong entry confirmed → `pump_dose_error=true`
- If `drug_library_compromised=true` when wrong entry confirmed → skip `sedated`, go directly to `patient_bed2_state=critical`

When built: remove `lockType:pin` and `requires:<%= backup_pin %>` from `bed2_pump_terminal`.

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

Three validator errors for missing object sprite files (these do not prevent the scenario from running — the engine will fall back):
- `ehr-terminal.png`
- `network-segmentation-map.png`
- `command_board.png`

Add fallback copies (e.g. `pc.png` renamed) or commission proper assets.

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
| `backup_reinfected` | Engine timer/logic: fires if `backup_restore_initiated=true` AND `network_isolated=false` at restore window |
| `patient_bed2_deceased` | MG-08: if `pump_dose_error=true` AND `drug_library_compromised=true` → skip sedated, go critical/deceased |
| `ncsc_notified` | Ink: `npc_hartley.ink` or `npc_ravi.ink` player choice |
| `debrief_complete` | `npc_sharma.ink:closing` — sets this on final line (Ink file exists; verify the var write works) |

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
- [ ] Build MG-08 infusion pump minigame; replace `bed2_pump_terminal` PIN placeholder
- [ ] Add `alertConfig` support to SIEM minigame; create `northgate_2025_11` alert set
- [ ] Commission NHS nurse and clinical engineer sprite sheets
- [ ] Implement NSM `requiresGlobal` engine param to gate SEVER behind dual-auth

### P3 (polish, post-draft)
- [ ] Commission patient sprites (bed4, bed2) and NCSC investigator sprite
- [ ] Create `ehr-terminal.png`, `network-segmentation-map.png`, `command_board.png` sprite assets
- [ ] Source or create `hospital_ambient` audio loop
- [ ] Wire `drug_library_restored`, `backup_reinfected`, `patient_bed2_deceased`, `ncsc_notified`
- [ ] Verify pharmacist patrol does not run while NPC is hidden
- [ ] Tune all NPC and object positions after first room render
- [ ] Verify `debrief_complete` is correctly set at end of `npc_sharma.ink:closing`
