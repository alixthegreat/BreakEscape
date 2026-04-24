# SIS03 Cyber Insurance — Outstanding Work

## Blocking (required before public release)

### Sprite Assets
All five items below use placeholder sprites that work in-game but will look wrong.

| Asset | Placeholder used | Notes |
|-------|-----------------|-------|
| `public/break_escape/assets/objects/coverage_decision_form.png` | `notes3.png` | Single-page form on Meridian letterhead |
| `public/break_escape/assets/objects/checklist.png` | `notes4.png` | Warranty compliance checklist — four tick-box rows |
| Eleanor Vance character sprite | `female_office_worker` sheet | GDD calls for `inspector_female` variant — senior insurance professional in corporate clothing |
| `meridian_claims_suite` room tile set | `room_office` | GDD: glass-topped conference table, wall screen, Lime Street London corporate atmosphere |
| `meridian_evidence_archive` room tile set | `room_it` | GDD: secure filing cabinets, fluorescent lighting, pinboard with Albion network diagram |

---

## Non-blocking (polish / nice-to-have)

### Audio
- Room ambience for `meridian_claims_suite`: city hum through window, occasional phone notification tones (per GDD)
- Room ambience for `meridian_evidence_archive`: near-silent, fluorescent hum

### Content
- The `ins001_assessed`, `ins003_assessed`, `ins008_assessed`, `ins009_assessed` global variables are declared and set by the warranty checklist minigame but are not referenced by any NPC dialogue or task wiring. These are CLAIM reference codes from the CyBOK SIS educational framework — consider whether they should surface anywhere in Eleanor's debrief or the credits sequence.

---

## Confirmed not required

| Item | Status |
|------|--------|
| Hacktivity VM (`meridian_forensic_review`) | **Not needed** — the Forensic Data Platform terminal (MG-02) is a fully self-contained client-side minigame with all forensic data hardcoded |
| Ink dialogue trees (all four NPCs) | **Complete** — Eleanor Vance (751 lines), James Whitworth (226), David Osei (270), Robert Ngata (241); all compiled to JSON |
| MG-01 Claims Management System | **Complete** |
| MG-02 Forensic Data Platform | **Complete** |
| MG-04 Warranty Compliance Checklist | **Complete** |
| MG-05 Coverage Decision Form | **Complete** |
