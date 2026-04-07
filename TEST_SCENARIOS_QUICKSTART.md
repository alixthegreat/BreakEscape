# Quick Reference: Running Test Scenarios

## Launch URLs

Open these URLs in your browser (with local server running on `localhost:8000`):

### 1. Timer System Test (Phase 5)
```
http://localhost:8000/scenario_select.html?scenario=test_timer_system
```
**Duration:** 3-5 minutes  
**What to watch:** Countdown timer widget appearance, color transitions, accuracy

---

### 2. Patrol Override Test (Phase 2-4)
```
http://localhost:8000/scenario_select.html?scenario=test_npc_patrol_override
```
**Duration:** 1-2 minutes  
**What to watch:** Nurse emergency response, speed increase, patrol interrupt

---

### 3. Visibility Toggle Test (Phase 3)
```
http://localhost:8000/scenario_select.html?scenario=test_npc_visibility
```
**Duration:** 1 minute  
**What to watch:** Hidden NPC appears when triggered, begins patrol

---

### 4. Event Cascade Test (Phase 1-2)
```
http://localhost:8000/scenario_select.html?scenario=test_event_cascade
```
**Duration:** 2-3 minutes  
**What to watch:** Multi-NPC coordinated reactions to global variable broadcasts

---

## Local Server Setup

```bash
cd /home/cliffe/Files/Projects/Code/BreakEscape/BreakEscape
python3 -m http.server
# Server runs on http://localhost:8000
```

---

## Validation

Validate all test scenarios:

```bash
cd /home/cliffe/Files/Projects/Code/BreakEscape/BreakEscape

# Validate single scenario
scripts/validate_scenario.rb scenarios/test_timer_system.json

# Validate all test scenarios
for scenario in test_timer_system test_npc_patrol_override test_npc_visibility test_event_cascade; do
  scripts/validate_scenario.rb "scenarios/$scenario.json"
done
```

---

## Test Matrix

| Feature | Scenario | Duration | Key Validation |
|---------|----------|----------|-----------------|
| Timer Widget | timer_system | 3-5 min | Color changes, countdown accuracy |
| Patrol Override | patrol_override | 1-2 min | Interrupt, speed increase, stop |
| Visibility Toggle | visibility | 1 min | Hidden→visible, interactive |
| Event Cascades | event_cascade | 2-3 min | Multi-NPC coordination |

---

## Manual Test Checklist

### Timer System
- [ ] Widget appears top-right on load
- [ ] Countdown displays mm:ss format
- [ ] Color: white (normal)
- [ ] Color: amber when < 5 minutes
- [ ] Color: red + pulsing when < 1 minute
- [ ] All three timers fire and count down

### Patrol Override
- [ ] Nurse patrols normally at start
- [ ] Pressing emergency button interrupts patrol
- [ ] Nurse walks directly to emergency station
- [ ] Speed is visibly faster
- [ ] Nurse stops and remains at destination

### Visibility
- [ ] Pharmacist not visible at start
- [ ] Pressing dispatch button reveals pharmacist
- [ ] NPC appears instantly (no fade)
- [ ] Can interact with pharmacist after reveal
- [ ] Pharmacist begins patrol cycle

### Event Cascade
- [ ] Clicking patient bed triggers first cascade
- [ ] Patient, nurse, and manager all react
- [ ] Nurse walks to patient immediately
- [ ] Clicking alarm button triggers second cascade
- [ ] Nurse speed increases and dwell decreases
- [ ] All dialogue fires in sequence
- [ ] Each event only fires once

---

## Files

Located in `/scenarios/`:
- `test_timer_system.json` - Timer widget demo
- `test_npc_patrol_override.json` - Patrol override demo
- `test_npc_visibility.json` - Visibility toggle demo
- `test_event_cascade.json` - Event-driven cascades demo

Located in `/scenarios/test_scenarios/ink/`:
- `test_timer_monitor.ink` - Timer NPC
- `test_nurse.ink` - Patrol override NPC
- `test_monitor.ink` - Patrol override monitor
- `test_pharmacist.ink` - Hidden pharmacist
- `test_dispatcher.ink` - Dispatcher NPC
- `test_patient.ink` - Cascade patient
- `test_cascade_nurse.ink` - Cascade nurse
- `test_manager.ink` - Cascade manager

Documentation:
- `TEST_SCENARIOS_README.md` - Complete guide with procedures and troubleshooting

---

## Adding Tests to CI/CD

Add to your test suite:

```bash
#!/bin/bash
# test-scenarios.sh

echo "Validating test scenarios..."

test_scenarios=(
  "test_timer_system"
  "test_npc_patrol_override"
  "test_npc_visibility"
  "test_event_cascade"
)

for scenario in "${test_scenarios[@]}"; do
  echo "Testing $scenario..."
  if ! scripts/validate_scenario.rb "scenarios/$scenario.json" > /dev/null 2>&1; then
    echo "❌ FAILED: $scenario"
    exit 1
  fi
  echo "✅ PASSED: $scenario"
done

echo "All test scenarios passed!"
```

---

## Troubleshooting

**Test scenario won't load:**
- Check browser console for JavaScript errors
- Verify file paths are correct
- Run `scripts/validate_scenario.rb` to check syntax

**NPC not appearing:**
- Check NPC position is within room bounds
- Verify sprite sheet name is correct
- Check Ink file path in storyPath

**Timer not counting down:**
- Check delayMs is in milliseconds (not seconds)
- Verify scenario has `timers[]` section
- Check browser developer tools (F12) for console errors

**Events not triggering:**
- Verify `eventPattern` matches exact global variable name
- Check condition syntax (e.g., `"value === true"`)
- Ensure `onceOnly: true` is set to prevent duplicate triggers

---

## Next Steps

1. ✅ All test scenarios created and validated
2. ✅ Ink files created for all NPCs
3. 📋 Run each scenario manually to verify behavior
4. 📋 Create automated tests (if applicable)
5. 📋 Add to continuous integration pipeline
