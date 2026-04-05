# MG07 Visual Design and Interaction Spec

Date: 2026-04-05
Audience: gameplay implementation and UI polish for the Backup Recovery Console (MG07)

## 1. Design Intent

The interface should communicate one core lesson clearly:
- Recovery speed, safety, and operational impact are competing constraints.

The player must feel they are making an incident-command decision, not just solving a lock.

## 2. Visual Language

Style baseline (project-consistent):
- Pixel-art look and feel
- Sharp corners only
- Border thickness exactly 2px
- High readability under pressure

Mood target:
- Clinical incident room terminal
- Serious and procedural, not flashy
- Information hierarchy over decoration

## 3. Layout Blueprint

Panel structure:
1. Header row
2. Source tile row (3 equal tiles)
3. Consequence assessment panel
4. Confirmation action row

Recommended proportions:
- Header: 12%
- Tile row: 34%
- Consequence panel: 42%
- Action row: 12%

Responsive behavior:
- Desktop/tablet: 3 tiles horizontal
- Narrow width: stack vertically in same logical order (NAS, tape, cloud)
- Consequence panel always remains directly after tile group

## 4. Tile Specifications

Each tile must include:
- Source name
- Availability status badge
- Source icon
- Secondary label where needed
- Visual risk marker (X icon or caution marker)

## 4.1 NAS Appliance Tile
- Status: ENCRYPTED
- Severity: hard-fail
- Palette: dark red background, red status badge, high-contrast text
- Marker: red X in top-right
- Meaning: not recoverable path

## 4.2 Tape Library Tile
- Status: CATALOGUE WIPED
- Severity: high friction, slow recovery
- Palette: dark red background, red status badge
- Marker: red X in top-right
- Meaning: technically recoverable but too slow

## 4.3 Vendor Cloud Tile
- Status: AVAILABLE
- Sub-label: ETA: 18 HOURS
- Severity: viable but conditional risk
- Palette: amber-leaning background, caution marker (not red X)
- Meaning: preferred route if network isolation is in place

## 5. Consequence Panel Behavior

Interaction model:
- No source selected: panel shows prompt text
- On source click: panel updates immediately with source-specific assessment
- Confirm button updates label to selected source and enables

Panel content format:
- Header: CONSEQUENCE ASSESSMENT - [SOURCE]
- Risk banner
- Four bullets minimum:
  - data integrity
  - restore timeline
  - reinfection risk
  - clinical operations impact

Banner styles:
- NAS/Tape: red warning banner
- Cloud: amber caution banner

## 6. Confirm Action UX

Button states:
- Disabled default (greyed)
- Enabled on valid selection (amber)
- Busy briefly on click (optional but recommended)

Label text:
- Default: CONFIRM RESTORE SOURCE
- Selected: CONFIRM RESTORE FROM [SOURCE NAME]

Completion behavior:
- Once clicked, avoid double-submit
- Commit state writes
- Close minigame with success callback

## 7. Data-to-UI Mapping

Required source ids:
- `nas_encrypted`
- `tape_wiped`
- `cloud_vendor`

Required variable outcomes:
- set `backup_recovery_source` to selected id
- set `backup_restore_initiated=true`
- if selected id is `cloud_vendor`, set `recovery_eta_hours=18`

This mapping is gameplay-critical and must remain explicit in code.

## 8. Copy Guidelines

Tone:
- direct, operational, high-stakes
- avoid jargon overload
- keep each bullet short and decision-oriented

Terminology consistency:
- Use same labels as scenario docs: NAS appliance, Tape library, Vendor cloud backup
- Keep status terms exact: ENCRYPTED, CATALOGUE WIPED, AVAILABLE

## 9. Accessibility and Readability

Must-haves:
- clear focus state for tile selection
- sufficient contrast for all status badges
- avoid color-only signaling; include icon/text markers
- keyboard support desirable for future hardening

## 10. Minimal CSS Token Set

Define local CSS tokens in minigame stylesheet/module:
- `--mg07-bg`
- `--mg07-panel-bg`
- `--mg07-border`
- `--mg07-text`
- `--mg07-danger`
- `--mg07-warning`
- `--mg07-success`
- `--mg07-muted`

Use these tokens for all tile and panel states to keep changes contained and maintainable.

## 11. Non-Goals

Avoid in first pass:
- complex animations
- decorative particle effects
- multi-step wizard interactions
- additional branching beyond the three sources

The first release should prioritize clarity, state correctness, and integration fidelity.

## 12. Acceptance Criteria

- [ ] Three source tiles visible with distinct status treatment
- [ ] Consequence panel updates on selection
- [ ] Confirm disabled until selection
- [ ] Confirm writes required variables and completes cleanly
- [ ] Visual style matches project pixel UI constraints
- [ ] Works on desktop and narrow viewport without losing decision clarity
