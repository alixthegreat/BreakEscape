# Test Scenarios for Phase 1-5 NPC Behavior System

This directory contains four focused test scenarios, each designed to validate one or more features from the Phase 1-5 implementation.

## Quick Start

All test scenarios are located in `/scenarios/` and can be loaded via `scenario_select.html`:

```
http://localhost:8000/scenario_select.html?scenario=test_timer_system
http://localhost:8000/scenario_select.html?scenario=test_npc_patrol_override
http://localhost:8000/scenario_select.html?scenario=test_npc_visibility
http://localhost:8000/scenario_select.html?scenario=test_event_cascade
```

Or use the dropdown menu in `scenario_select.html` to select a test scenario.

---

## Test Scenarios

### 1. `test_timer_system.json` — Countdown Timer Widget (Phase 5)

**What it tests:**
- Countdown timer HUD widget display
- Color transitions (white → amber @ 5min → red/pulsing @ 1min)
- Timer execution and global variable broadcasting
- NPC reactions to timer events

**Expected Duration:** 3-5 minutes

**Procedure:**
1. Game loads with timer widget visible (top-right corner)
2. Watch the countdown from 0:30 for first timer
3. Observe color changes:
   - Amber background/text when < 5 minutes
   - Red background/text + pulsing when < 1 minute
4. At 0 seconds, timer fires and first event executes
5. Widget updates to show next pending timer
6. Process repeats for remaining timers

**Expected Outcomes:**
- ✅ Timer is always visible
- ✅ mm:ss countdown is smooth and accurate
- ✅ Color changes happen at correct thresholds
- ✅ When timer fires, NPC delivers dialogue
- ✅ Conditions prevent timers from firing if criteria not met

**Files Generated:**
- None (tests display system)

---

### 2. `test_npc_patrol_override.json` — Patrol Emergency Movement (Phase 2-4)

**What it tests:**
- `patrolOverride` action interrupts patrol loop
- `goToAndStay()` method forces NPC to specific location
- `setPatrolSpeed` increases movement speed
- Speed increase is visibly noticeable

**Expected Duration:** 1-2 minutes

**Procedure:**
1. Game starts with nurse on patrol loop
2. Observe normal patrol pattern:
   - Station (5,3) → Bed1 (2,5) → Bed2 (8,5) → repeat
   - Speed: 80 pixels/second
   - Pauses at each waypoint (dwell time)
3. Press **RED EMERGENCY BUTTON**
4. Nurse **immediately abandons patrol**
5. Nurse walks directly to Emergency Station (5,8)
6. Visibly faster movement (150 px/s)
7. Stops at destination and remains stationary

**Expected Outcomes:**
- ✅ Patrol loop interrupts immediately (no finishing current leg)
- ✅ Direct path to emergency location (not following patrol waypoints)
- ✅ Speed increase is noticeable (roughly 1.9x faster)
- ✅ NPC stops at destination and doesn't resume patrol
- ✅ Monitor NPC announces "Emergency response engaged"

**Key Validations:**
- `goToAndStay()` successfully overrides patrol
- `_stopOnArrival` flag prevents freeze-in-place bug
- Movement speed is dynamic (can be changed at runtime)

---

### 3. `test_npc_visibility.json` — Hidden NPC Reveal (Phase 3)

**What it tests:**
- `initiallyHidden: true` property hides NPC at spawn
- `setVisible` action reveals hidden NPC
- Visibility toggle integrates with physics/interaction systems
- Hidden NPC becomes fully interactive after reveal

**Expected Duration:** 1 minute

**Procedure:**
1. Game starts; observe the room
2. **Pharmacist should NOT be visible** anywhere
3. Press **DISPATCH PHARMACIST** button
4. Pharmacist **instantly appears** at coordinates (4,4)
5. No fade-in animation — immediate toggle
6. Pharma cist becomes interactive (can talk to, etc.)
7. Begins patrol cycle immediately

**Expected Outcomes:**
- ✅ Pharmacist completely hidden at start
- ✅ `setVisible` action triggers reveal
- ✅ Appearance is immediate (not faded)
- ✅ NPC becomes interactable
- ✅ Patrol behavior starts correctly

**Technical Validation:**
- `setNPCVisible()` sets alpha=1 and enables physics
- `setNPCVisible()` disables alpha=0 and disables physics (if used for hiding)
- Integration with NPC interaction distance check

---

### 4. `test_event_cascade.json` — Event-Driven NPC Cascades (Phase 1-2)

**What it tests:**
- Event broadcasting to multiple NPCs
- Conditional event filtering (only react if condition passes)
- `onceOnly` flag prevents duplicate responses
- Multi-NPC coordinated reactions to single event
- Sequential action execution (setGlobal → dialogue → movement)

**Expected Duration:** 2-3 minutes

**Procedure:**

**Part 1: Initial Trigger**
1. Observe nurse on patrol loop
2. Click **PATIENT BED** (lower left)
   - Sets `patient_alert = true`
   - All listening NPCs receive broadcast
3. Observe reactions:
   - Patient: Delivers alert dialogue
   - Nurse: Stops patrol, walks to patient bed, says "I'm coming!"
   - Manager: Says "Patient alert received"

**Part 2: Cascade Trigger**
4. Click **RED ALARM BUTTON** (center)
   - Sets `major_incident = true`
   - All listening NPCs with matching conditions react
5. Observe reactions:
   - Patient: State changes to critical
   - Nurse: Resumes patrol from patient location
   - Nurse speed increases (150 px/s)
   - Nurse dwell time decreases (0.3x)
   - Nurse says "MAJOR INCIDENT DECLARED"
   - Manager says "ESCALATION PROTOCOL ACTIVATED"

**Expected Outcomes:**
- ✅ All NPCs hear broadcasts (eventDispatcher works)
- ✅ Each NPC reacts per their eventMappings
- ✅ Multiple actions execute in sequence
- ✅ Condition guards prevent unwanted triggers
- ✅ `onceOnly` flag prevents triggering twice
- ✅ Speed/dwell overrides take effect immediately

**Key Validations:**
- Event broadcasting system is working
- Condition evaluation is correct
- Multiple action types execute together:
  - `setGlobal` (change state)
  - `patrolOverride` (movement)
  - `setPatrolSpeed` (speed change)
  - `setDwellMultiplier` (timing change)
  - `conversationMode: "person-chat"` (dialogue)

---

## Debugging Tips

### Timer System Issues
- **Timer not showing:** Check if scenario has `timers[]` section
- **Wrong countdown:** Verify `delayMs` format (milliseconds, not seconds)
- **Colors don't change:** Check browser console for CSS errors on #scenario-timer-display

### Patrol Override Issues
- **Nurse not moving:** Check if `patrolOverride.targetTile` is valid (within room bounds)
- **Nurse stops before arrival:** Check `_stopOnArrival` flag in npc-behavior.js (should be in path-completion handler, not top of loop)
- **Speed doesn't change:** Verify `setPatrolSpeed` is numeric and > 0

### Visibility Issues
- **NPC appears at wrong time:** Check `eventPattern` matches exact global variable name
- **NPC doesn't become interactable:** Verify `setNPCVisible(npcId, true)` is called in npc-manager.js handler

### Event Cascade Issues
- **Events not triggering:** Check `eventPattern: "global_variable_changed:varName"` format
- **Multiple triggers:** Verify `onceOnly: true` is set in eventMappings
- **Conditions not working:** Double-check condition syntax (e.g., `"value === true"`, `"!globalVars.X"`)

---

## Test Checklist

Use this checklist to validate all features are working correctly:

```
PHASE 5: TIMER SYSTEM
□ Timer widget appears on screen (top-right)
□ Countdown displays in mm:ss format
□ Countdown is smooth (not jerky)
□ Color turns amber < 5 min
□ Color turns red < 1 min with pulse
□ Timers fire at correct times
□ NPC reacts to timer events
□ Next timer displays after current fires

PHASE 2-4: PATROL OVERRIDE + SPEED
□ Nurse is on patrol at start
□ Patrol loop is visible and repeating
□ Emergency button press stops patrol
□ Nurse walks directly to emergency location
□ Speed increase is noticeable
□ Nurse reaches destination and stops
□ Nurse doesn't resume patrol
□ Speed override takes effect immediately

PHASE 3: VISIBILITY
□ Pharmacist not visible at start
□ Dispatch button click reveals pharmacist
□ Reveal is immediate (no fade)
□ Pharmacist is interactive after reveal
□ Pharmacist begins patrol normally

PHASE 1-2: EVENT CASCADES
□ Initial alert triggers first cascade
□ Patient says alert dialogue
□ Nurse moves to patient immediately
□ Manager receives alert notification
□ Major incident button triggers second cascade
□ All three NPCs receive broadcast
□ Nurse speed increases visibly
□ Nurse dwell time decreases
□ All dialogue fires in correct sequence
□ onceOnly prevents duplicate responses
```

---

## Integration with CI/CD

To add automated testing of these scenarios:

```bash
# Validate all test scenarios
for scenario in test_timer_system test_npc_patrol_override test_npc_visibility test_event_cascade; do
  scripts/validate_scenario.rb "scenarios/$scenario.json"
done

# Run in headless browser (if available)
# npm test -- --scenario=test_timer_system
```

---

## Related Files

- **Core Implementation:**
  - `/scenarios/sis01_healthcare/scenario.json.erb` — Full implementation
  - `/public/break_escape/js/ui/scenario-timer.js` — Timer UI widget
  - `/public/break_escape/js/ui/scenario-timer-dispatcher.js` — Timer executor
  - `/public/break_escape/js/systems/npc-behavior.js` — Behavior methods
  - `/public/break_escape/js/systems/npc-manager.js` — Event handlers

- **Test Ink Files** (to be created):
  - `/scenarios/test_scenarios/ink/test_timer_monitor.json`
  - `/scenarios/test_scenarios/ink/test_nurse.json`
  - `/scenarios/test_scenarios/ink/test_pharmacist.json`
  - `/scenarios/test_scenarios/ink/test_patient.json`
  - etc.

---

## Maintenance

These test scenarios should be updated whenever:
- Phase 1-5 implementation changes
- New features are added to NPC system
- Bug fixes require regression testing
- Performance improvements need validation

Keep this document in sync with the actual test scenario files.
