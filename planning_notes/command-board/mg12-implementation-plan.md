# MG12 — Major Incident Command Board: Implementation Plan

**Scenario:** `sis01_healthcare` — Northgate General Hospital  
**Location in game:** Major Incident Room (Room 3) — large wall-mounted screen  
**Current state:** Placeholder `smartscreen` object with static readable text  
**Target state:** Custom HTML/CSS minigame extending `MinigameScene`

---

## Design Summary

MG12 is an **ambient, persistent, non-completable display** — it has no puzzle state. Players open it to see the incident timeline and system status, and close it with the `×` button. It auto-populates new timeline entries as global variables change, and allows players to manually log decisions.

Unlike the SIEM (which has a timer and a success/failure outcome), the Command Board never calls `complete(true)`. Closing always calls `complete(false)` — the same abort path used by the SIEM when dismissed mid-session. State is persisted across open/close cycles via `globalVariables[STATE_KEY]`.

---

## Files to Create

| File                                                                       | Purpose             |
| -------------------------------------------------------------------------- | ------------------- |
| `public/break_escape/js/minigames/command-board/command-board-minigame.js` | Main minigame class |
| `public/break_escape/css/command-board-minigame.css`                       | Styles              |

## Files to Modify

| File                                                  | Change                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `public/break_escape/js/minigames/index.js`           | Import + `registerScene('command-board', ...)`                                       |
| `public/break_escape/js/systems/minigame-starters.js` | Add `startCommandBoardMinigame()` + expose as `window.startCommandBoardMinigame`     |
| `public/break_escape/js/systems/interactions.js`      | Add `type === 'command_board'` handler block (identical pattern to `siem_dashboard`) |
| `scenarios/sis01_healthcare/scenario.json.erb`        | Replace `command_board` object — see Scenario Changes section                        |

---

## Class Design

```
CommandBoardMinigame extends MinigameScene
```

### Constructor params

```js
{
  title: 'Major Incident Command Board',
  showCancel: false,       // × button only — no Cancel button at bottom
  disableClose: false,
  preseededEntries: [...], // passed from scenarioData or hardcoded in class
  eventMap: { ... }        // varName → { text, type } — see Event Map below
}
```

### Key methods

| Method                               | Behaviour                                                                                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init()`                             | Calls `super.init()`, adds CSS class, calls `restoreState()`, `renderLayout()`, `renderTimeline()`, `renderStatusPanel()`                                              |
| `start()`                            | Calls `super.start()`, subscribes to all `global_variable_changed:*` events in the event map; initialises status panel from current `window.gameState.globalVariables` |
| `complete(success)`                  | Calls `persistState()` then `window.MinigameFramework.endMinigame(false, { aborted: true })` — never passes `true`                                                     |
| `cleanup()`                          | Unsubscribes event handlers; calls `super.cleanup()`                                                                                                                   |
| `appendEntry(text, type)`            | Prepends a new entry object `{ timestamp, text, type, source }` to `this.entries`, re-renders timeline, calls `persistState()`                                         |
| `handleGlobalVarChange(name, value)` | Looks up name in event map; if matched and value meets condition, calls `appendEntry()` and updates status panel row                                                   |
| `handleManualPost()`                 | Reads text field, calls `appendEntry()` with `source: 'manual'`, clears field                                                                                          |
| `renderTimeline()`                   | Clears and re-renders `#cb-timeline-list` from `this.entries` array (newest at top)                                                                                    |
| `renderStatusPanel()`                | Renders/updates all status rows from `STATUS_VARIABLES` config                                                                                                         |
| `persistState()`                     | Writes `{ entries, manualEntryCount }` to `window.gameState.globalVariables[STATE_KEY]`                                                                                |
| `restoreState()`                     | Reads persisted state; if present, sets `this.entries`; merges with pre-seeded entries if entries list is empty                                                        |

### State key

```js
const STATE_KEY = "mg12_command_board_state";
```

### Entries array structure

```js
{
  timestamp: 'Tue 07:31',  // wall-clock formatted at moment of append
  text: 'NETWORK ISOLATED — Clinical zone severed from enterprise',
  type: 'response',        // 'security' | 'clinical' | 'response' | 'decision' | 'critical'
  source: 'auto'           // 'auto' | 'manual' | 'preseed'
}
```

---

## Event Map

These global variable changes trigger auto-appended timeline entries. Subscribe to each in `start()` using `this.addEventListener(window.eventDispatcher, 'global_variable_changed:VAR', cb)`.

| Variable                      | Condition                   | Entry text                                                                                                                                               | Entry type | Also updates status row           |
| ----------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------- |
| `network_isolated`            | `=== true`                  | `NETWORK ISOLATED — Clinical zone severed from enterprise`                                                                                               | `response` | Network Status → ISOLATED (amber) |
| `backup_recovery_source`      | `=== 'CLOUD'`               | `CLOUD RESTORE INITIATED — EHR recovery ETA 18 hours`                                                                                                    | `response` | EHR → RESTORING (amber)           |
| `backup_recovery_source`      | `=== 'NAS'` or `=== 'TAPE'` | `RECOVERY ATTEMPTED FROM [SOURCE] — WARNING: Source may be compromised`                                                                                  | `decision` | EHR → RESTORING (amber)           |
| `drug_library_verified`       | `=== true`                  | `DRUG LIBRARY TAMPERED — Morphine dose max altered. Pump verification required.`                                                                         | `security` | Fleet Console → COMPROMISED (red) |
| `patient_bed4_state`          | `=== 'DECEASED'`            | `PATIENT DEATH — Ward 7 Bed 4. Cardiac arrhythmia. No central monitoring response. Clinical team response delayed 22 minutes.`                           | `critical` | —                                 |
| `patient_bed2_state`          | `=== 'DECEASED'`            | `PATIENT DEATH — Ward 5 Bed 2. Morphine overdose. Smart pump guardrails disabled by drug library tampering. Dose error unchallenged.`                    | `critical` | —                                 |
| `ico_notified`                | `=== true`                  | `ICO NOTIFIED — 72hr statutory notification submitted`                                                                                                   | `decision` | —                                 |
| `ico_deadline_missed`         | `=== true`                  | `ICO NOTIFICATION DEADLINE MISSED — 72-hour GDPR window expired.`                                                                                        | `critical` | —                                 |
| `backup_reinfected`           | `=== true`                  | `EHR RESTORE FAILED — Ransomware reactivated from backup. Second rebuild required. Clinical operations extended by 5 days.`                              | `critical` | EHR → REINFECTED (red)            |
| `ransomware_deployed`         | `=== true`                  | (already pre-seeded — no duplicate append)                                                                                                               | —          | Ransomware → ACTIVE (red)         |
| `siem_escalated`              | `=== true`                  | `SIEM ALERTS ESCALATED — Critical indicators identified`                                                                                                 | `response` | —                                 |
| `siem_missed_alerts`          | `=== true`                  | `CRITICAL ALERTS MISSED — delayed escalation`                                                                                                            | `security` | —                                 |
| `ncsc_notified`               | `=== true`                  | `NCSC NOTIFIED — incident support request submitted`                                                                                                     | `decision` | —                                 |
| `vpn_anomaly_identified`      | `=== true`                  | `VPN ANOMALY CONFIRMED — Contractor credentials used from Romanian IP, no MFA`                                                                           | `security` | —                                 |
| `safety_claim_hc001_assessed` | `=== true`                  | `SAFETY CLAIM ASSESSED — CLAIM-HC-001 (Network Segmentation) INVALIDATED. Dual-homed workstations and legacy flat segments breach the claim conditions.` | `decision` | —                                 |
| `safety_claim_hc003_assessed` | `=== true`                  | `SAFETY CLAIM ASSESSED — CLAIM-HC-003 (Drug Library Integrity) INVALIDATED. Library tampered; change control bypassed; pharmacy approval not obtained.`  | `decision` | —                                 |
| `safety_claim_hc007_assessed` | `=== true`                  | `SAFETY CLAIM ASSESSED — CLAIM-HC-007 (Integrated Incident Response). Dual-authorisation process engaged. Clinical impact assessed before isolation.`    | `decision` | —                                 |

Optional objective-derived entries (recommended for walkthrough parity):

| Variable | Condition | Entry text | Entry type |
|----------|-----------|------------|------------|
| `patient_bed4_state` | `=== 'ATTENDED'` | `BED 4 PATIENT ESCALATED — Clinical team responding` | `response` |
| `paper_charts_collected` | `=== true` | `PAPER MAR CHARTS RETRIEVED` | `response` |
| `pump_dose_correct` | `=== true` | `BEDSIDE PUMP PROGRAMMED — Dose verified correct` | `clinical` |
| `pump_dose_error` and `drug_library_compromised === false` | transition to sedated path | `BEDSIDE PUMP PROGRAMMED — Double-check error caught` | `clinical` |

These objective entries are additive and must not replace the core GDD event-trigger entries above.

Cross-document normalization rules (for exhaustive SIS compatibility):

- Canonical source for variable names and trigger truth is `gdd.md` (Section 2/3 and Event Triggers).
- Accept legacy `backup_recovery_source` values from `minigame_planning.md` and normalize before mapping:
  - `cloud_vendor` -> `CLOUD`
  - `nas_encrypted` -> `NAS`
  - `tape_wiped` -> `TAPE`
- Accept legacy monitoring variable name `central_station_ward7_status` as alias for `ward_monitor_status`.
- Accept walkthrough text variants for overdue ICO messaging (for example, `ICO NOTIFICATION OVERDUE — potential fine: £17.5 million`) but normalize emitted board text to:
  - `ICO NOTIFICATION DEADLINE MISSED — 72-hour GDPR window expired.`

**On `start()`**, also read current values of all status variables from `window.gameState.globalVariables` to initialise the status panel without waiting for a change event.

---

## System Status Panel Variables

| Row label         | Variable(s)                     | States                                                                                                                                                        |
| ----------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EHR System        | `ehr_status` (string)           | `ONLINE` → OPERATIONAL (green) / `OFFLINE` → OFFLINE (red); `backup_recovery_source='CLOUD'` → RESTORING (amber); `backup_reinfected=true` → REINFECTED (red) |
| Ward 7 Monitoring | `ward_monitor_status` (string)  | `ONLINE` → OPERATIONAL (green) / `STALE` → DEGRADED (amber) / `OFFLINE` → OFFLINE (red) — starts offline (ransomware)                                         |
| Fleet Console     | `fleet_console_status` (string) | `ONLINE` → OPERATIONAL / `OFFLINE` → OFFLINE (red); `drug_library_compromised=true` → COMPROMISED (red)                                                       |
| Network           | `network_isolated` (boolean)    | `false` → CONNECTED (green) / `true` → ISOLATED (amber)                                                                                                       |
| Ransomware        | `ransomware_deployed` (boolean) | `false` → CLEAN (green) / `true` → ACTIVE (red, flashing)                                                                                                     |

Implementation note: keep a compatibility fallback for legacy variable names where needed (`central_station_ward7_status` as fallback for `ward_monitor_status`; `backup_restore_initiated` as derived true when `backup_recovery_source === 'CLOUD'`).

Implementation note: for legacy backup-source payloads, normalize `cloud_vendor|nas_encrypted|tape_wiped` to `CLOUD|NAS|TAPE` before status and timeline mapping.

Status row priority (when multiple conditions apply): most severe state wins. Variables without a string-type counterpart use boolean globals directly.

---

## Pre-seeded Timeline Entries

Hardcoded in the class (not in scenario.json.erb — the scenario file currently has these as static text; moving them into the class keeps the minigame self-contained).

```js
const PRESEED_ENTRIES = [
  {
    timestamp: "Mon 22:38",
    text: "MAJOR INCIDENT DECLARED — Enterprise IT systems encrypted.",
    type: "security",
    source: "preseed",
  },
];
```

Entries are displayed newest-first (reversed order at render time). Pre-seeded entries always appear at the bottom.

---

## Scenario File Change

In `scenarios/sis01_healthcare/scenario.json.erb`, replace the `command_board` object:

**Remove:** `"type": "smartscreen"`, `"readable": true`, `"text": "..."` fields  
**Set:** `"type": "command_board"`, `"interactable": true`, `"active": true`  
**Keep:** `"id"`, `"name"`, `"takeable": false`, `"observations"`

The object does not need `locked`, `lockType`, or `requires` — it opens directly on interaction, like the SIEM console.

The ERB comment block (`TODO[MINIGAME]: Replace readable smartscreen...`) should be removed once the minigame is implemented.

---

## Interaction Handler Addition (`interactions.js`)

Add immediately after the `siem_dashboard` block (~line 886):

```js
// Handle Major Incident Command Board
if (sprite.scenarioData.type === "command_board") {
  if (window.startCommandBoardMinigame) {
    window.startCommandBoardMinigame(sprite);
  } else {
    window.gameAlert("Command board unavailable.", "error", "Error", 3000);
  }
  return;
}
```

The command board has no unlock callback — interacting with it always opens the board. No `unlockedObjects` update needed (it is not a lock).

---

## Starter Function (`minigame-starters.js`)

```js
export function startCommandBoardMinigame(lockable, options = {}) {
  if (!window.MinigameFramework) {
    console.error("MinigameFramework not available");
    return;
  }
  if (!window.MinigameFramework.mainGameScene) {
    window.MinigameFramework.init(window.game);
  }
  window.MinigameFramework.startMinigame("command-board", null, {
    lockable,
    showCancel: false,
  });
}
window.startCommandBoardMinigame = startCommandBoardMinigame;
```

---

## Registration (`index.js`)

```js
import { CommandBoardMinigame } from "./command-board/command-board-minigame.js";
// ...
MinigameFramework.registerScene("command-board", CommandBoardMinigame);
```

---

## Constraints and Edge Cases

**No duplicate entries.** Each auto-entry must only fire once per variable-to-true transition. The event handler should check whether an entry for that variable already exists in `this.entries` before appending (guard against re-subscribe on re-open if state is not correctly cleaned up).

**Board is always openable.** Unlike the SIEM, the board does not lock after completion. Players can return to it throughout the scenario.

**Ransomware pre-seeded status.** On `init()`, if `ransomware_deployed === true` in current global state, the Ransomware status row should immediately show ACTIVE (red) without waiting for a change event. This is handled by reading current global state in `start()`.

**Manual entries persist across close/reopen.** Manual entries are included in the persisted state and restored on re-open.

**No timer.** The board has no countdown. No `setInterval` tick beyond the wall clock display (which is a simple `setInterval` for the header clock label, updating every minute — not every second, since the board is not time-pressured).
