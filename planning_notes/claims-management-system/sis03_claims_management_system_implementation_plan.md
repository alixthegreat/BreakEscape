# SIS03 Claims Management System (MG-01) Implementation Plan

## 1. Purpose
Implement the Scenario 3 Claims Management System terminal as a focused minigame that supports coverage analysis flow with minimal engine changes and full alignment to existing Scenario 3 state transitions.

This plan is grounded in:
- `planning_notes/sis_scenarios/case_3_cyber_insurance_game_design/minigame_planning.md`
- `planning_notes/sis_scenarios/case_3_cyber_insurance_game_design/gdd.md`
- `planning_notes/sis_scenarios/case_3_cyber_insurance_game_design/new_objects_planning.md`
- `planning_notes/sis_scenarios/case_3_cyber_insurance_game_design/development_tasks.csv`
- `planning_notes/sis_scenarios/case_3_cyber_insurance_information_pack/requirements/claims.md`
- `planning_notes/sis_scenarios/case_3_cyber_insurance_information_pack/requirements/policyholder_security_obligations.md`
- `scenarios/sis03_cyber_insurance/scenario.json.erb`
- `scenarios/sis03_cyber_insurance/VALIDATION_SUMMARY.md`

## 2. Current State (Important Alignment Notes)
0. `scenarios/sis03_cyber_insurance/scenario.json.erb` is authoritative for runtime variable names and event flow.
1. Scenario 3 already runs as a document-driven investigation.
2. `scenario.json.erb` currently uses readable objects (`policy_binder`, `claim_file`, exhibits), but does not currently define a CMS terminal object.
3. The objective/task chain is wired to existing variables such as:
- `policy_reviewed`
- `claim_file_reviewed`
- `forensic_chain_verified`
- `warranty_evidence_reviewed`
- `warranty_checklist_complete`
4. Event mappings on `eleanor_vance` already consume these variables and should remain authoritative.
5. Minigame infrastructure is available (`window.MinigameFramework`, `interactions.js`, `minigame-starters.js`) and should be reused.

### 2.1 Canonical Variable Contract (Implementation Rule)
Use only canonical Scenario 3 runtime globals when implementing MG-01.

Canonical names (must use):
- `policy_reviewed`
- `claim_file_reviewed`
- `forensic_chain_verified`
- `warranty_checklist_complete`
- `attribution_brief_reviewed`
- `coverage_decision`
- `war_exclusion_invoked`
- `underwriting_file_reviewed`

Legacy planning aliases (do not implement as new globals):
- `cms_reviewed` -> `claim_file_reviewed`
- `fdp_reviewed` -> `forensic_chain_verified`
- `ncsc_brief_reviewed` -> `attribution_brief_reviewed`
- `coverage_position` -> `coverage_decision`
- `act_of_war_decision` -> `war_exclusion_invoked`
- `policy_binder_reviewed` -> `policy_reviewed`
- `renewal_memo_reviewed` -> `underwriting_file_reviewed`

## 3. Scope
In scope (MG-01):
1. New CMS minigame scene (interactive database-style terminal).
2. New interaction hook for Scenario 3 CMS terminal object.
3. Scenario wiring to trigger CMS and set existing scenario variables.
4. UX and visual design for the terminal experience.
5. Tests for state transitions and objective compatibility.

Out of scope for this phase:
1. Full FDP VM implementation (MG-02) beyond current placeholders.
2. New objective model or major task system changes.
3. NPC dialogue rewrite except minimal variable alignment if needed.
4. Rails server-side expansion unless strictly required for save/load parity.

## 4. Minimal-Change Strategy
Principle: prefer additive changes and reuse existing state keys.

0. Runtime contract precedence: if planning docs and scenario globals differ, follow `scenario.json.erb` names and flow.
1. Reuse existing globals already consumed by objective/event logic.
2. Add one new minigame and one new interaction path rather than introducing a new lock type framework.
3. Keep `policy_binder` and existing notes objects in place during first iteration.
4. Avoid changing objective definitions unless a mismatch is proven.
5. Preserve existing save/load behavior by emitting standard `global_variable_changed:<var>` events.

## 5. Functional Requirements for MG-01
Based on planning docs, MG-01 must provide:
1. Claim Record view:
- Incident summary
- notification timing
- estimated quantum
2. Policy Info view:
- policy activation/renewal context
- warranty status summary
3. Quarterly Reports view:
- Q1-Q4 posture snapshots
- explicit unresolved IT/OT segmentation remediation by Q4
4. Warranty Status view:
- W-03, W-07, W-09, W-12 summary states
- links to evidence prompts (non-blocking)
5. Optional print action (can be simulated UI action in v1).

Required state updates in MVP:
1. Set `claim_file_reviewed = true` when Claim Record tab is reviewed.
2. Optionally set `policy_reviewed = true` only when policy section is explicitly viewed, if you want CMS to satisfy that objective path.
3. Emit global variable change events after writes.

Recommendation for safest first pass:
1. CMS writes `claim_file_reviewed` only.
2. Keep `policy_binder` as the source of `policy_reviewed` to avoid objective pacing regressions.

## 6. Technical Implementation Plan

### 6.1 Files to Add
1. `public/break_escape/js/minigames/claims-management-system/claims-management-system-minigame.js`
2. `public/break_escape/js/minigames/claims-management-system/claims-management-system-minigame.css` (if style split is preferred)

### 6.2 Files to Update
1. `public/break_escape/js/minigames/index.js`
- Register scene key, e.g. `claims-management-system`.

2. `public/break_escape/js/systems/minigame-starters.js`
- Add `startClaimsManagementSystemMinigame(lockable, options = {})`.
- Start via `window.MinigameFramework.startMinigame('claims-management-system', null, params)`.

3. `public/break_escape/js/systems/interactions.js`
- Add object type/interactionType handler for CMS terminal, similar to existing specialized handlers (`sis_config_panel`, `alarm_panel`, etc.).

4. `scenarios/sis03_cyber_insurance/scenario.json.erb`
- Add CMS terminal object to `meridian_claims_suite`.
- Suggested schema pattern:
  - `type`: `cms_terminal`
  - `id`: `claims_management_system`
  - `interactionType`: `claims_management_system`
  - `minigame` data payload for tabs/content
  - no new lock schema needed for v1

### 6.3 Runtime Contract
Input params passed to minigame:
1. `title`
2. `sections` (claim, policy, quarterly, warranty)
3. `stateWrites` mapping by section
4. optional `printEnabled`

Minigame output behavior:
1. On first relevant section view, write target global in `window.gameScenario.globalVariables`.
2. Emit `window.eventDispatcher.emit('global_variable_changed:<name>', { name, value, oldValue })`.
3. Prevent duplicate writes where not needed.

### 6.4 Save/Load and Reopen Behavior
1. On open, read current globals and mark already-reviewed sections.
2. Reopening CMS should be idempotent (no repeated progression side effects).
3. If all CMS-driven sections already completed, UI remains informational only.

## 7. Visual Design Plan (MG-01)
Design direction: high-credibility insurance operations console, not a flashy cyber minigame.

Layout:
1. Header bar with claim reference and status badge.
2. Left navigation tabs (Claim Record, Policy Info, Quarterly Reports, Warranty Status).
3. Main document pane with scrollable structured records.
4. Right context panel with "Evidence Relevance" notes.
5. Footer actions (Close, Print Excerpt).

Style constraints:
1. Match Break Escape pixel-art UI conventions:
- sharp corners
- 2px borders
- restrained palette
2. Palette suggestion:
- background: off-white/light grey paper tone
- accents: muted navy and amber for status highlights
- alerts: restrained red only for breach labels
3. Typography:
- readable monospace/sans mix for terminal + document feel
- avoid over-stylized decorative fonts
4. Motion:
- minimal: section fade/swap only
- no distracting animations

Content emphasis:
1. Q4 unresolved remediation must be visually obvious.
2. Warranty rows should clearly separate "clear breach" and "arguable" logic.
3. Keep copy tightly aligned to claims and obligations docs.

## 8. Integration with Other Components
1. Objectives:
- CMS should support `investigate_claim` without bypassing later evidence steps.
2. NPC event mappings:
- Eleanor mappings already listen to core global keys; preserve this contract.
3. Phone NPCs:
- no direct technical dependency, but CMS content should provide context for James/Eleanor discussions.
4. FDP and archive flow:
- CMS should reference, not replace, forensic packet review and archive unlock logic.

## 9. Risks and Mitigations
1. Risk: pacing break if CMS sets too many globals too early.
- Mitigation: only set `claim_file_reviewed` in v1; keep `policy_reviewed` tied to binder initially.

2. Risk: content drift from information pack claims/warranties.
- Mitigation: map each CMS section to source clause IDs during implementation review.

3. Risk: duplicate progression triggers on reopen.
- Mitigation: guard writes with current-state checks and one-time section flags.

4. Risk: introducing a new lock type increases engine surface area.
- Mitigation: use interactionType handler, no lock-system extension in v1.

## 10. Implementation Phases

Phase 1 (MVP, lowest risk):
1. Add CMS minigame scene.
2. Add starter + interaction hook.
3. Add CMS terminal object in Scenario 3.
4. Wire only `claim_file_reviewed` write.
5. Verify objective/task continuity.

Phase 2 (content completeness):
1. Populate quarterly report details from info pack obligations and claims.
2. Add warranty summary formatting and evidence cues.
3. Add optional policy tab write to `policy_reviewed` only after playtest validation.

Phase 3 (polish):
1. Print excerpt UX.
2. accessibility/readability pass.
3. UI visual refinements.

## 11. Test Plan
1. Scenario regression:
- Start scenario and confirm initial briefing still fires.
- Open CMS and confirm `claim_file_reviewed` transitions once.
- Confirm Eleanor mapping for claim file task completion still works.

2. Objective integrity:
- Verify `investigate_claim` can still complete with intended pacing.
- Verify no premature unlock of archive/warranty aims.

3. Reopen idempotency:
- Open/close CMS repeatedly and confirm no repeated side effects.

4. Content validation:
- Verify CMS text consistency with:
  - `claims.md` (INS-001..INS-009)
  - `policyholder_security_obligations.md` (W-03/W-07/W-09/W-12 context)

5. UI checks:
- Desktop and target minimum laptop resolution.
- Ensure readability and no overflow clipping.

## 12. Definition of Done
1. CMS terminal is interactable in `meridian_claims_suite`.
2. CMS minigame opens reliably and displays all core sections.
3. Required variable transitions fire correctly using existing event bus.
4. Existing Scenario 3 objective and NPC flow remains stable.
5. No unrelated engine/system changes were introduced.
