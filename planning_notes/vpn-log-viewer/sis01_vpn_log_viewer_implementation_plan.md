# SIS01 VPN Log Viewer (MG-06) Implementation Plan

## Scope and Source Priority

This plan is derived with the following precedence:

1. `planning_notes/sis_scenarios/case_1_healthcare_game_design/new_minigames/mg06_vpn_log_filter_builder.md` (authoritative)
2. `planning_notes/sis_scenarios/case_1_healthcare_game_design/minigame_planning.md`
3. `planning_notes/sis_scenarios/case_1_healthcare_game_design/scenario_implementation_notes.md`
4. `planning_notes/sis_scenarios/case_1_healthcare_game_design/be_scenario_walkthrough.md`
5. `scenarios/sis01_healthcare/scenario.json.erb`, `scenarios/sis01_healthcare/TODO.md`, `scenarios/sis01_healthcare/TESTING_WALKTHROUGH.md`

Primary implementation target is Option B from the planning set: a dedicated HTML/CSS minigame replacing VM-first gameplay for default deployments.

## Objectives

- Implement MG-06 as a scenario-driven minigame that teaches filter-based VPN log analysis.
- Preserve existing story gates and variable semantics (`vpn_anomaly_identified` remains the primary gate).
- Keep changes minimal and localized.
- Avoid broad refactors or engine-level work unless strictly required.
- Make the default SIS01 path minigame-first, with VM mode retained as optional deployment fallback.

## Functional Requirements (Must-Have)

- Display 50 VPN auth entries with fields: timestamp, user, IP, country, MFA, result.
- Provide token-based filter builder with fields:
  - `COUNTRY` (UK, RO, IE, DE, FR)
  - `MFA` (YES/NO)
  - `RESULT` (ACCEPT/REJECT)
  - `USER` (free text)
  - `TIME` (06-08, 08-10, 10-12, 12-14)
- Apply AND semantics across active filters.
- Render live grep-command preview based on active filters.
- Fade non-matching rows.
- Enable row selection when visible rows are small (<=5 as specified in MG-06).
- Detail panel actions:
  - `LOOK UP IP` -> set `vpn_threat_intel_checked=true`
  - `CHECK USER HISTORY` -> set `vpn_impossible_travel_identified=true`
  - `FLAG ANOMALY` -> confirmation modal -> set `vpn_anomaly_identified=true` and complete task path.

## Scenario and Narrative Integration

- Existing SIS01 progression already keys from `vpn_anomaly_identified` in Room 2 and Ravi dialogue flows.
- Preserve current downstream behavior:
  - Ravi VPN briefing/deeper confirmation
  - command board timeline entry
  - gating toward authorisation path
- Optional enrichment globals must remain non-blocking:
  - `vpn_threat_intel_checked`
  - `vpn_impossible_travel_identified`

## Minimal Change Strategy

### Files to add

1. `public/break_escape/js/minigames/vpn-log-viewer/vpn-log-viewer-minigame.js`
2. `public/break_escape/css/vpn-log-viewer-minigame.css`

### Files to modify

1. `public/break_escape/js/minigames/index.js`
  - import and register `vpn-log-viewer`
2. `public/break_escape/js/systems/minigame-starters.js`
  - add `startVpnLogViewerMinigame(lockable, options)` helper
  - expose helper on `window` (consistent with other starters)
3. `public/break_escape/js/systems/interactions.js`
  - add object-type branch for `vpn_log_terminal` (and optional alias `vpn-log-terminal`)
  - call the new starter helper to launch `vpn-log-viewer`
4. `scenarios/sis01_healthcare/scenario.json.erb`
  - replace Room 2 VPN object from `vm-launcher-desktop` to minigame object config
  - include MG-06 `scenarioData` payload
  - move objective wiring for `vpn_anomaly` from VM flag submission to minigame completion path (see Objective Wiring section)
  - remove or disable `vpn_flag_station` for minigame-first deployment

### Files to leave untouched (unless blocked)

- Ink files in `scenarios/sis01_healthcare/ink/`
- NPC mapping architecture
- command board implementation
- generic framework CSS

## Objective Wiring (Required Migration)

Current SIS01 state uses VM flag submission:
- task `vpn_anomaly` is `type: submit_flags`
- target flag `northgate_vpn_logs:vpn_flag_1`
- `vpn_flag_station` sets `vpn_anomaly_identified=true`

MG-06 authoritative plan requires minigame-owned completion:
- update `vpn_anomaly` task to `type: manual`
- run completion through minigame `completionActions`
- completion actions must include:
  - set global `vpn_anomaly_identified=true`
  - complete task `vpn_anomaly`

Optional progress actions (non-blocking):
- `vpn_threat_intel_checked=true` on `LOOK UP IP`
- `vpn_impossible_travel_identified=true` on `CHECK USER HISTORY`

Deployment modes:
- Default SIS01 mode: minigame-first (remove or disable `vpn_flag_station` and VM object)
- Optional fallback mode: keep VM + flag station, and do not enable the minigame object in the same run unless explicitly desired

## Data Contract for `scenarioData`

Provide deterministic data from scenario side; minigame should be renderer/interaction logic only.

Required payload:

- `consoleTitle`
- `consoleSubtitle`
- `logFilePath`
- `anomaly` block (user, ip, country, mfa, result, timestamp, position)
- `noise` entries (at minimum include one additional contractor no-MFA noise row)
- `contractorAccounts`
- `entryCount`, `logPeriod`
- `threatIntel` block for lookup panel
- `impossibleTravel` (or equivalent travel-analysis) block for impossible travel banner
- `completionActions`:
  - set global `vpn_anomaly_identified=true`
  - complete task `vpn_anomaly`
- `progressActions`:
  - threat intel checked
  - impossible travel identified

## UI and Visual Design Plan

Use established Break Escape pixel UI conventions:

- no rounded corners
- 2px borders
- flat palettes with clear semantic colors

Layout:

- Header with system identity and close control
- Left panel (~40%): filter builder + active token list + command preview
- Right panel (~60%): scrollable auth log table
- Bottom status strip: visible count + active filter count

Visual semantics:

- country badges: UK blue, RO red
- MFA badges: YES green, NO amber
- result badges: ACCEPT green-tint, REJECT red-tint
- filtered-out rows at low opacity
- selected row with amber border
- terminal preview with dark green background and bright green text

Interaction polish:

- token add/remove updates filter and command preview immediately
- detail modal with explicit action buttons
- confirmation step before final anomaly flag submit

## Implementation Sequence

1. Scaffold minigame class and static shell UI.
2. Implement filter model and row matching.
3. Add command-preview generator.
4. Add row selectability threshold logic and detail view.
5. Add action handlers (`LOOK UP IP`, `CHECK USER HISTORY`, `FLAG ANOMALY`).
6. Wire `completionActions` and `progressActions` dispatch via existing action/event systems.
7. Register minigame in index.
8. Add starter function in `minigame-starters.js`.
9. Add interaction dispatch branch in `interactions.js` for `vpn_log_terminal`.
10. Update SIS01 VPN object and task wiring in scenario JSON.
11. Validate with SIS01 walkthrough path and variable transitions.

## Acceptance Criteria

- Player can identify and submit the `m.blake` Romanian VPN anomaly entirely via MG-06 UI.
- On confirm, `vpn_anomaly_identified=true` and objective progression advances.
- `vpn_anomaly` objective completes without using flag-station submission.
- Ravi/command board downstream reactions work unchanged.
- Optional actions set optional globals and never block completion.
- Re-opening the minigame starts with fresh local UI state; previously-set global progress remains persisted globally.
- No lint/syntax errors introduced.

## Risks and Decisions

- Keep VM fallback station as optional only if needed for mixed delivery modes; default SIS01 path should be minigame-first.
- Avoid external IP intel APIs; threat intel data is scenario-provided.
- Keep filter logic simple and deterministic (AND across tokens).
- Do not introduce new global-state schemas beyond already-planned variables.

## Out of Scope for MG-06

- VM authoring (`northgate_vpn_logs`) for this implementation pass
- broad objective-system redesign
- NPC dialogue rewrites unrelated to VPN anomaly gating
- generic minigame framework refactors
