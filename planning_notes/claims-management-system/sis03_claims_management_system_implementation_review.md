# SIS03 Claims Management System (MG-01) Implementation Review

Date: 2026-04-16
Reviewer: GitHub Copilot (GPT-5.3-Codex)

## Verification Standard

Verification was performed against:

1. Runtime contract in `scenarios/sis03_cyber_insurance/scenario.json.erb` (authoritative runtime behavior).
2. Current CMS runtime implementation and wiring:

- `public/break_escape/js/minigames/claims-management-system/claims-management-system-minigame.js`
- `public/break_escape/js/systems/interactions.js`
- `public/break_escape/js/systems/minigame-starters.js`
- `public/break_escape/js/minigames/index.js`
- `public/break_escape/css/claims-management-system-minigame.css`
- `app/views/break_escape/games/show.html.erb`

3. Planning references:

- `planning_notes/sis_scenarios/case_3_cyber_insurance_game_design/minigame_planning.md`
- `planning_notes/sis_scenarios/case_3_cyber_insurance_game_design/gdd.md`
- `planning_notes/sis_scenarios/case_3_cyber_insurance_game_design/new_objects_planning.md`
- `planning_notes/sis_scenarios/project_progress_report.md`

## Executive Result

MG-01 is integrated and functional, and the runtime now includes cabinet-code CMS discovery, a dedicated CMS correspondence section, policy+forensic gating for Evidence Archive unlock, and explicit global persistence for claim/correspondence tab review state. Full alignment is still pending due to missing underwriting cabinet/file interaction and print-consumer integration.

## Confirmed Working (No Gap)

### A) Wiring and lifecycle

- PASS: Scene is exported/imported and registered as `claims-management-system`.
- PASS: Starter exists and is exposed globally for interaction routing.
- PASS: Interaction routing dispatches CMS objects by id/type/interactionType.
- PASS: CSS is included in the Rails game view (`show.html.erb`).

### B) Scenario payload consumption

- PASS: `minigame.sections` is normalized and rendered.
- PASS: `minigame.stateWrites` is normalized and used for section-level global writes.
- PASS: `printEnabled` controls print action availability.
- PASS: `relevance`, `relevanceHighlights`, and `summary` are rendered.

### C) Global variable behavior

- PASS: `quarterly -> quarterly_reports_reviewed` write is implemented and restored from globals on reopen.
- PASS: `policy` and `warranty` section writes are implemented for configured variables.
- PASS: `cms_reviewed` is set when all configured sections are viewed.
- PASS: viewed-state UI persistence works independently of section-global mappings.

## Mismatch Findings and Implementation Plan

### 1) Underwriting file flow is incomplete in runtime scenario content

Status: MISMATCH

Planned behavior:

- Player discovers cabinet code from CMS policy notation.
- Player opens underwriting cabinet in Evidence Archive.
- Reading underwriting file sets `underwriting_file_reviewed = true`.

Current behavior:

- Cabinet code discovery is now implemented in CMS policy content and Eleanor hints to check CMS notes.
- `underwriting_file_reviewed` variable exists, but no underwriting file object currently sets it in scenario data.
- No cabinet object implementation is present in runtime room object list for this scenario revision.

Implementation approach:

1. Add an underwriting cabinet object in `meridian_evidence_archive`:

- `type`: lockable container object already supported by engine conventions.
- `lockType`: `pin`.
- `requires`: cabinet code value.

2. Add nested readable underwriting file object with `onRead` setting:

- `underwriting_file_reviewed = true`.

3. Ensure objective task `read_underwriting_file` is satisfiable through this object.

Primary file:

- `scenarios/sis03_cyber_insurance/scenario.json.erb`

Acceptance criteria:

- Player can open cabinet in-game.
- Reading underwriting file toggles `underwriting_file_reviewed` true.
- Eleanor underwriting debrief branches trigger from actual in-room interaction.

### 2) Cabinet code discovery source differs from planned design

Status: PARTIALLY RESOLVED

Planned behavior:

- Code is embedded in CMS policy notation/history field as a discoverable clue.

Current behavior:

- Code is embedded in CMS policy content (`UW-CAB-REF <%= cabinet_pin %>`), and Eleanor now directs players to the CMS policy notation rather than revealing the code directly.

Implementation approach (remaining work):

1. Treat CMS-based discovery as canonical behavior.
2. Update planning docs so they consistently describe this runtime behavior.
3. Keep Eleanor as a non-spoiler hint source only.

Primary files:

- `scenarios/sis03_cyber_insurance/scenario.json.erb`
- `planning_notes/sis_scenarios/case_3_cyber_insurance_game_design/gdd.md`
- `planning_notes/sis_scenarios/case_3_cyber_insurance_game_design/minigame_planning.md`

Acceptance criteria:

- Discovery method is singular and explicit in both scenario and planning docs.
- QA can identify one canonical source of cabinet code without ambiguity.

### 3) CMS information architecture is narrower than planned

Status: RESOLVED IN RUNTIME

Planned behavior:

- CMS should expose Notifications, Policy History, and Correspondence, including extension-request evidence.

Current behavior:

- CMS now includes a dedicated Correspondence section with extension-request evidence and claims/renewal correspondence context.
- Correspondence and claim tab review now have explicit global-backed persistence via scenario `stateWrites` and global variables.

Implementation approach:
Implemented in `scenario.json.erb` by adding:

1. `correspondence` section in CMS payload.
2. Correspondence evidence content (incident, renewal, extension-request, claims correspondence) in the section body.
3. Explicit state write mappings for:
- `claim -> cms_claim_section_reviewed`
- `correspondence -> cms_correspondence_section_reviewed`

Primary file:

- `scenarios/sis03_cyber_insurance/scenario.json.erb`

Acceptance criteria:

- Extension request evidence is discoverable in CMS itself.
- Planned dialogue prompts about extension request are supported by visible in-game evidence.

Result:

- Met in runtime.

### 4) Archive access sequence differs between planning docs and runtime sequence

Status: INVALID FOR THIS IMPLEMENTATION TRACK

Notes:

- Runtime behavior remains policy+forensic order-independent unlock.
- Planning-document harmonization is intentionally out of scope for this track.

### 5) CMS print behavior is queue-only and not connected to a physical prop loop

Status: PARTIAL IMPLEMENTATION

Planned behavior:

- Player can print relevant excerpts to a physical printer/prop mechanic.

Current behavior:

- CMS enqueues print events into `window.gameState.cmsPrintQueue`.
- No confirmed consumer flow to present/dispense printed content to the player.

Implementation approach:

1. Define print consumer behavior in scenario/system:

- Option A: printer object reads queue and surfaces printed notes.
- Option B: notes panel gets a "Printed Excerpts" list.

2. Add one explicit integration path and test it in SIS03.

Primary files:

- `public/break_escape/js/minigames/claims-management-system/claims-management-system-minigame.js`
- printer/notes integration file (to be selected during implementation)
- `scenarios/sis03_cyber_insurance/scenario.json.erb` (if object-level hook required)

Acceptance criteria:

- Printing from CMS creates player-visible artifacts retrievable in gameplay.
- This is testable without dev tools.

## Consolidated Implementation Backlog (Priority Order)

1. Implement underwriting cabinet + underwriting file state write in scenario (critical path).
2. Complete print artifact loop or formally scope it as backlog.
3. Optional: standalone CSS parity update.

## Suggested Test Cases After Implementation

1. CMS review test: all sections viewable, `quarterly_reports_reviewed` and `cms_reviewed` set correctly.
2. Cabinet discovery test: player can identify code from canonical source without NPC contradiction.
3. Cabinet unlock test: lock opens with discovered code only.
4. Underwriting review test: reading file sets `underwriting_file_reviewed` and unlocks expected dialogue branches.
5. Sequence test: archive unlock occurs exactly at documented progression point.
6. Print test: print action creates visible, retrievable output.

## Final Assessment

MG-01 core runtime implementation is solid, and runtime now aligns on cabinet-code CMS clueing, correspondence visibility, policy+forensic archive gating, and explicit claim/correspondence tab persistence. Full Case 3 parity is still pending because underwriting cabinet/file interaction and print-consumer behavior are not yet implemented.
