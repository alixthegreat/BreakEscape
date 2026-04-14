# CyBOK Phase 7 (Security-Informed Safety) — Project Progress Report

## Overview

This project is developing three domain-specific case study packages on the theme of Security-Informed Safety (SIS), each comprising an information pack and an interactive BreakEscape game scenario. The three case studies — covering healthcare (Northgate General Hospital), energy storage (Albion Battery Hall), and cyber insurance (Meridian Claims) — are fictional scenarios created for teaching purposes, inspired by real-world incident patterns and regulatory contexts. Significant progress has been made across all three case studies, and the project is **on track to deliver complete, playable scenarios by the end of April 2026**.

> **Note on timeline:** We would welcome any extension to the submission deadline due to delays in clearance for one of the student interns, which temporarily constrained the team's capacity. Despite this, substantial progress has been maintained and all three scenarios are in an advanced state of development.


## 1. Information Packs

All three case studies have complete information pack structures, each covering the following components:

| Component | Case 1: Healthcare | Case 2: Energy | Case 3: Insurance |
|---|---|---|---|
| Theoretical background | ✅ | ✅ | ✅ |
| System architecture (network, subsystems) | ✅ | ✅ | ✅ |
| Storylines and attack scenarios | ✅ | ✅ | ✅ |
| Security and safety requirements / claims | ✅ | ✅ | ✅ |
| Assurance case overview | ✅ | ✅ | ✅ |
| Regulatory frameworks and standards mapping | ✅ | ✅ | ✅ |

Each information pack is organised into sub-sections:

- **Case 1 (Healthcare):** Northgate General Hospital NHS Trust. Covers medical device network architecture, NHS/DSPT regulatory framework, IEC 80001 and MHRA guidance, claims around EHR network segmentation and infusion pump safety (CLAIM-HC-001 through CLAIM-HC-009), CAE-format assurance case, and two attack scenarios (ransomware to device impact; device integrity compromise).

- **Case 2 (Energy):** Albion Energy Storage Ltd. Covers IT/OT network architecture including Purdue Model, ICS protocols (Modbus, DNP3), IEC 61511 / IEC 62443 regulatory context, claims around SIS independence and patch management (CLAIM-EN-001 through CLAIM-EN-011), and two attack scenarios (IT-to-OT pivot; insider ICS manipulation).

- **Case 3 (Cyber Insurance):** Meridian Cyber Insurance Ltd / Albion Energy claim. Covers policyholder interfaces, underwriting and warranty framework, regulatory obligations, claims around IT/OT segmentation as a warranty condition (CLAIM-INS-001 through CLAIM-INS-009), act-of-war exclusion analysis, and the insurance response chain linking directly to the Case 2 incident.


## 2. Game Design Documents and Scenario Design

Full game design documents (GDDs) have been produced for all three cases, including physical room layouts, interactive element catalogues, NPC character descriptions, narrative arc, and minigame specifications. These documents informed implementation and serve as design references.


## 3. Scenario 1 — Northgate General Hospital (sis01_healthcare)

### Summary

Players take the role of an incident responder arriving at Northgate General Hospital on the morning after a ransomware attack. Systems across the enterprise network have been encrypted by the ransomware, the EHR is offline, and clinical systems on the ward are beginning to be affected. Players must triage the incident, investigate the attack vector, authorise network isolation, verify drug library integrity, restore safe clinical operations, and manage regulatory obligations including ICO notification within the 72-hour window — all while navigating the tensions between IT and clinical staff.

**Scenario duration:** 50–70 minutes  
**Rooms:** Ward 7 (clinical bay), IT Security Office, Major Incident Room  

### Minigames Implemented

| ID | Minigame | Status |
|----|----------|--------|
| MG-01 | **SIEM Alert Dashboard** — filterable security event log; alert triage with escalation queue; Northgate-specific alert set (4 critical IoCs + 20 noise events); `alertConfig` support for scenario-specific alert data | ✅ Complete |
| MG-04 | **Network Segmentation Map (NSM)** — interactive network diagram; SEVER button triggering network isolation; `network_isolated` global flag | ✅ Complete |
| MG-05 | **Ransomware Impact Display** — encrypted workstation overlay showing ransomware splash; state-reactive (shows patient monitoring loss) | ✅ Complete |
| MG-07 | **Major Incident Command Board** — live wall display auto-populated from global variable events; ICO aliasing support; backup recovery status updates | ✅ Complete |
| MG-08 | **Bedside Infusion Pump Terminal** — clinical decision minigame; paper MAR chart gate; decimal-ambiguity prescription panel; morphine dose verification; double-check confirmation modal; silent drug-library-compromised path | ✅ Complete |
| MG-09 (stub) | **Backup Recovery Console** — three-option restore decision (clean/partial/unknown); `backup_reinfected` reinfection path wired (fires 30s after corrupt restore if network was not isolated) | ✅ Complete |
| MG-10 | **EHR Prescribing Terminal** — electronic prescribing interface; online/offline state reactive; patient record browsing | ✅ Complete |
| MG-11 | **Dual Authorisation Panel** — two-PIN governance minigame requiring both IT security and clinical engineering codes; `network_isolation_authorised` flag; locks against bypass | ✅ Complete |
| MG-06 | **VPN Log Analyser** (flag station stub in place; full minigame pending) | 🔲 Pending |
| MG-09 | **Drug Library Integrity Checker** (flag station stub in place; full minigame pending) | 🔲 Pending |

### NPC Dialogue (Ink)

All 11 Ink story files written and compiled to JSON with zero errors:

| NPC | Role | Lines |
|-----|------|-------|
| Sarah Mitchell | Charge Nurse | 253 |
| Patrol Nurse | Staff Nurse | 115 |
| Ravi Anand | IT Security Manager | 219 |
| David Osei | Clinical Engineering Manager | 227 |
| Helen Carver | NHS CIO | 236 |
| Dr Fiona Hartley | Caldicott Guardian / Clinical Director | 277 |
| Dr Priya Sharma | NCSC Investigator | 324 |
| On-Call Pharmacist | Clinical Safety | 223 |
| Mrs Kowalski | Patient (chair patient witness) | 250 |
| Bed 2 Patient | Patient (infusion pump) | 22 |
| Bed 4 Patient | Patient (monitoring alarm) | 26 |

**Total: 2,172 lines of Ink narrative across 11 NPCs.** All files compiled cleanly with inklecate.

Key dialogue features: state-gated branching on global variables (`network_isolated`, `drug_library_compromised`, `pump_dose_error`); NPC bark notifications on event triggers; event-driven timed messages (ICO 72-hour deadline countdown); `completeTask` hooks throughout; NPC influence scoring; post-isolation consequence branches; debrief synthesis with CLAIM references (CLAIM-HC-001, CLAIM-HC-003, CLAIM-HC-007).

### Validation

Scenario validator passed (April 2026): schema valid, ERB renders, all cross-references validated, all Ink files compile. Dungeon graph generated at `scenarios/sis01_healthcare/dungeon_graph.html`.


## 4. Scenario 2 — Albion Battery Hall: Code Red (sis02_energy)

### Summary

Players are SCADA engineers at a lithium-ion battery storage facility that is under a cyber attack. The SCADA system's sensor data has been falsified and the Safety Instrumented System (SIS) setpoints have been tampered with. Players must detect the anomaly (using an analog thermometer as a cyber-independent reference), investigate the attacker's jump server session, coordinate with the OT security manager and SOC, activate the Emergency Shutdown Device (ESD), isolate the network, and manage regulatory notification obligations — all before the hydrogen gas concentration reaches a dangerous level.

**Scenario duration:** 50–70 minutes  
**Rooms:** SCADA Control Room, Battery Hall 1, Engineering Workshop  

### Minigames Implemented

| ID | Minigame | Status |
|----|----------|--------|
| MG-01 | **ESD Pushbutton** — flip-guard interaction; confirm modal; `esd_activated` flag; early-activation path (`early_esd_activation`); physical GPIO relay integration point for escape room hardware | ✅ Complete |
| MG-02 | **SIS Configuration Threshold Panel** — interactive SIS setpoint display; compare mode unlocked when certification doc reviewed; tamper confirmation button setting `sis_tamper_confirmed`; visual highlight on deviation | ✅ Complete |
| MG-03 | **Facility Alarm Panel State Machine** — live SVG multi-lamp panel; 7 lamps driven by real-time global variables (`anomaly_detected`, `esd_activated`, `sis_tamper_confirmed`, `jump_server_isolated`, `network_isolated`, `hydrogen_alarm`, `facility_safe_state`); flash animation on SIS and H₂ lamps | ✅ Complete |
| MG-05 | **NIS 72-Hour Notification Clock** — scenario timer system; HUD countdown widget; `timerRef` on NIS notification form; `nis_deadline_missed` consequence; Priya bark on expiry | ✅ Complete |
| MG-06 | **Network Architecture Diagram (Purdue Model)** — SVG diagram with 6 levels, 25 nodes, 5 attack paths; Trent Water shared infrastructure sidebar; marching-ant animation on active attack paths; `network_architecture_reviewed` flag | ✅ Complete |
| VM-01 | **SCADA Historian Trend Viewer** (`albion_scada_historian`) — flat-line anomaly detection challenge; `historian_flatline_found` flag | 🔲 Pending (workaround in place) |
| VM-02 | **Jump Server Access Log Analyser** (`albion_eng_workstation`) — contractor RDP session investigation; `jump_server_confirmed` flag | 🔲 Pending (workaround in place) |

### NPC Dialogue (Ink)

All 4 Ink story files written and compiled:

| NPC | Role | Lines |
|-----|------|-------|
| Priya Chandra | SCADA Engineer (lead NPC) | 635 |
| Marcus Webb | OT Security Manager (phone NPC) | 404 |
| Tom Hadley | CastleTech SOC Analyst (phone NPC) | 271 |
| Dr Nalini Bashir | NCSC/HSE Inspector (debrief NPC) | 407 |

**Total: 1,717 lines of Ink narrative across 4 NPCs.** All compiled cleanly.

Key features: deeply branching technical dialogue on SIS independence, IEC 61511 architecture, patch management trade-offs, defence in depth, isolation sequencing; NPC timed radio messages; post-`facility_safe_state` debrief reveal; CLAIM-EN-001 through CLAIM-EN-008 taught through NPC conversation; influence-scored NPC reactions; phone NPCs with dynamic availability gating.

### Validation

Scenario validator passed (April 2026). Dungeon graph generated at `scenarios/sis02_energy/dungeon_graph.html`.


## 5. Scenario 3 — Meridian Claims: The Albion Decision (sis03_cyber_insurance)

### Summary

Players join the Meridian Cyber Insurance claims team to assess the £8.2 million claim from Albion Energy Storage following the SIS scenario incident. Unlike Cases 1 and 2, this scenario takes place after the emergency is contained. Players investigate evidence packets, review the policy binder and warranty schedule, examine forensic exhibits (IT and OT), assess warranty compliance (W-03, W-07, W-09, W-12), review the NCSC attribution brief (GREYMANTLE + Ferryman / act-of-war threshold), and complete a Coverage Decision Form. The scenario is designed to be played after Case 2 and references its outcomes directly.

**Scenario duration:** 45–60 minutes  
**Rooms:** Meridian Claims Suite, Meridian Evidence Archive (PIN-locked)  

### Scenario Structure

The scenario is primarily document-driven and decision-focused. Interactive elements include:

- **Claims Management System terminal** — policy history, security posture reports, incident notification
- **Forensic Data Platform terminal** — attack chain reconstruction; reflects Case 2 player decisions if played in same session
- **Physical document props** — policy binder (40+ pages, tab-indexed), warranty compliance checklist, loss adjustment summary, NCSC attribution brief, coverage decision form
- **Forensic evidence packets** — Packet A (IT forensics), Packet B (OT forensics), Packet C (warranty compliance evidence)
- **Underwriting file cabinet** (RFID-locked, then PIN code from CMS terminal)
- **Phone NPC contacts** — James Whitworth (Albion risk manager), David Osei (loss adjuster), Robert Ngata (NCSC liaison)

### NPC Dialogue (Ink)

| NPC | Role | Lines |
|-----|------|-------|
| Eleanor Vance | Claims Manager (lead NPC) | 736 |
| James Whitworth | Albion Risk Manager (phone NPC) | 226 |
| David Osei | Loss Adjuster (phone NPC) | 270 |
| Robert Ngata | NCSC Liaison (phone NPC) | 239 |

Key features: three-branch debrief synthesis (warranty, war exclusion, underwriting); CLAIM-INS-001 through CLAIM-INS-009 taught through dialogue; three coverage decision paths (Full / Proportional / Deny); act-of-war exclusion complexity branch; underwriting challenge discussion (Meridian's pre-incident knowledge, CLAIM-INS-009); James Whitworth humanises warranty breaches (IEC 61511 recertification costs, vendor delay extension requests); David Osei presents contested BI quantum and forensic evidence gaps.

### Validation

Scenario validator passed (April 2026). Dungeon graph generated at `scenarios/sis03_cyber_insurance/dungeon_graph.html`.


## 6. Platform Features Developed in This Project Period

The following BreakEscape engine and platform features were developed during this project, primarily to support the SIS scenarios but benefiting the platform as a whole.

### Text-to-Speech (TTS) System

A complete TTS infrastructure was built and deployed:

- **`TtsService`** — server-side Ruby service generating speech audio from NPC dialogue via Google TTS API; audio keyed by scenario name and text hash for cache-hit performance
- **`TtsBatchProcessor`** — batch pre-generation of TTS audio for entire scenarios; quota exhaustion handling and resume capability; rake tasks for batch generation and cache management (`app:break_escape:tts:batch_generate`)
- **`ScenarioBarkValidator`** — validation tool ensuring all NPC bark text is registered for TTS before deployment
- **Per-scenario TTS caches**: `tts_cache/sis01_healthcare/` (71 files), `tts_cache/m01_first_contact/` (760 files)
- Narrator voice support with configurable voice profiles
- TTS integration with NPC bark notification system (icon tracking, timing management)

### Dynamic Music System

- **MusicWidget** — in-game music controller replacing the earlier Spotify button; visualiser toggle; track progress display
- **Scenario music events** — event-driven playlist management via global variables (e.g., tense music triggered by `anomaly_detected`, resolution music on `facility_safe_state`)
- Victory playlist on scenario completion
- Ambient sound per-room with configurable `ambientVolume`
- Multiple new music tracks added across game atmosphere categories

### Audio Effects

- Keypad beep sounds for PIN entry interactions
- Industrial relay click on ESD activation
- Lock-specific audio for lockpicking (tension, pin set, success/failure)
- UI sound integration across minigames

### Dungeon Graph Visualisation

An automated Boss Keys-style dungeon dependency graph was developed for scenario analysis and design verification:

- **`generate_dungeon_graph.rb`** — Ruby script that reads scenario JSON/ERB files and extracts puzzle graph metadata (`puzzleGraphLinks`, `puzzleGraphMeta`, `puzzleGraphNode`) to produce an interactive SVG visualisation
- Nodes represent tasks, minigames, NPCs, documents, and key decision points; edges represent dependencies (key-lock, task-unlock, NPC-gate, global-variable-condition)
- AND-gate convergence nodes for multi-prerequisite unlock conditions
- Action nodes for player interactions that set global variables
- Per-scenario `dungeon_graph.html` files generated for all three SIS scenarios and the existing m01_first_contact scenario
- Used actively during scenario design to verify critical path integrity and identify bottlenecks

### NPC Behaviour Improvements

- Immovable NPC flag for NPCs that should not path-find (e.g., bed-bound patients)
- Arrival-tolerance for movement precision
- NPC removal (despawn) functionality for post-conversation scene changes
- Improved NPC pathfinding retry logic and stuck-detection
- Bark icon tracking (prevents duplicate bark popups)
- Patrol and waypoint configuration from scenario JSON
- Phone NPC support with availability gating via global variables
- Timed conversation system for opening briefings with `skipIfGlobal` resume detection

### Scenario Timer System

- Configurable countdown timers in scenario JSON (`timers` array with `id`, `delayMs`, `condition`)
- HUD timer widget with colour transitions (green → amber → red)
- `timerRef` on objects to link timers to physical props (e.g., NIS notification form shows time remaining)
- Timer expiry triggering global variable changes and NPC barks

### Scenario Schema and Validation

- Comprehensive JSON schema for scenario files including NPC behaviour fields, patrol configurations, bark notifications, puzzle graph metadata, timer structure, and new minigame lock types
- Scenario validator with early structural validation, Ink file compilation check, cross-reference validation (NPCs, rooms, objects, global variables, taskIds, flagRewards)
- `--skip-ink` option for fast structural-only validation
- Validator integrated into CI workflow

### Other Engine Features

- Scenario timer–based state transitions (for ICO and NIS deadline mechanics)
- Event-driven global variable changes from NPC event mappings (`onGlobal`, `setVariable`)
- `timedMessages` for NPCs (radio calls, dynamic revelations mid-scenario)
- Ransomware display minigame (encrypted workstation overlay with state-reactive patient monitoring tiles)
- SIEM Dashboard minigame: `alertConfig` support for injecting scenario-specific alert sets; passive alert generation; severity breakdown panel
- Room edge alignment improvements for multi-room layouts


## 7. Summary and Outlook

### What Has Been Completed

| Deliverable | Status |
|---|---|
| Three information packs (theoretical background, architecture, storylines, requirements, assurance cases, regulatory frameworks) | ✅ Complete |
| Three game design documents with room layouts, interactive element specs, NPC descriptions, minigame planning | ✅ Complete |
| Scenario 1 (Healthcare): scenario JSON, 11 Ink files (1,909+ lines), 8 minigames | ✅ Advanced (2 minigames pending) |
| Scenario 2 (Energy): scenario JSON, 4 Ink files (~1,769 lines), 5 minigames | ✅ Advanced (2 VM challenges pending) |
| Scenario 3 (Insurance): scenario JSON, 4 Ink files, document-driven investigation framework | ✅ Advanced (NPC Ink refinement ongoing) |
| TTS system with batch generation, per-scenario audio caches, narration support | ✅ Complete |
| Dynamic music system with event-driven playlists, ambient sound | ✅ Complete |
| Dungeon graph visualisation tool and per-scenario graphs | ✅ Complete |
| NPC behaviour improvements (patrols, barks, phone NPCs, timed conversations) | ✅ Complete |
| Scenario timer system (ICO / NIS deadline countdowns) | ✅ Complete |
| Scenario validator with Ink compilation and CI integration | ✅ Complete |

### Remaining Work

The primary outstanding items are:
1. Two log analysis minigames / VM challenges for sis01_healthcare (VPN log analyser, drug library integrity checker) — both have tested flag-station workarounds in place for first playable runs
2. Two VM challenges for sis02_energy (SCADA historian viewer, jump server log analyser) — both have flag-station workarounds in place
3. Art assets including character sprites (scenarios currently run with placeholder sprites)
4. Custom room tilemaps for hospital ward, battery hall, engineering workshop, and insurance office
5. Final play-through testing and content accuracy verification against information packs

All three scenarios are in an advanced state of development, and the project remains on track to deliver complete, tested scenarios by end of April 2026.

