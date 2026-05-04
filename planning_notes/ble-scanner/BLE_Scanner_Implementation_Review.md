# BLE Scanner — Implementation Review

Date: 2026-05-04  
Reviewed against spec: *"BLE scanner UI showing nearby devices and UUIDs. Player selects a target and attempts default-PIN pairing (0000, 1234) or replays a captured handshake from a text clue."*

---

## Discrepancies from spec

### 1. PIN pairing is free-text, not two hardcoded buttons

**Spec says:** "attempts default-PIN pairing (0000, 1234)"  
**Current state:** The PIN section is a text input + "Try PIN" button. The player types whatever PIN they've discovered from scenario clues.

This is a deliberate improvement — the spec described the UI literally rather than the design intent. Two hardcoded "Try PIN: 0000" and "Try PIN: 1234" buttons would tell the player the answer before they've found the clue. The free-text approach is fully scenario-driven: `allowedPins` defines what works, clues in the room tell the player what to try.

**Impact on plan document:** The plan's data contract includes `allowDefaultPins: true` as a fallback that unlocks `"0000"` and `"1234"` without listing them in `allowedPins`. This flag is **no longer implemented** — `allowedPins` is now required. Remove `allowDefaultPins` from the data contract.

The plan's `attemptPin` logic also referenced `allowDefaultPins`:
```js
const allowed = sd.allowedPins
    ? sd.allowedPins
    : (sd.allowDefaultPins ? ['0000', '1234'] : []);
```
Current code is simply `const allowed = sd.allowedPins || [];`. Any scenario that relied on `allowDefaultPins` would need to add `"allowedPins": ["0000", "1234"]` explicitly.

---

## What has changed since last review (2026-05-03)

### Critical gap #1 resolved — world state now changes on success

The previous review flagged this as the most significant bug: `unlockTarget` was never called. This is now fixed. `unlock-system.js` passes an `onComplete` callback that calls `notifyServerUnlock` then `unlockTarget`. The minigame calls `complete(true)` after 2s; the world unlock happens in the caller.

The minigame's `handlePairingSuccess` no longer calls `apiClient.unlock()` directly — that's entirely deferred to `unlock-system.js`. This matches the fix suggested in the previous review and is the cleaner design.

A corresponding server fix was needed: `validate_unlock` in `game.rb` had `'bluetooth'` in its trusted-method list but not `'ble'`, so the unlock was returning 422. `'ble'` has been added.

### Critical gap #2 resolved — targeted state reset on re-open

`initializeBleDevices` now resets all `targeted` flags on every open. The misleading 🎯 icon on re-open is gone.

### Critical gap #4 resolved — success timeout cleared on close

`_successTimeout` is stored and `clearTimeout`'d in `cleanup()`.

### Task completion and globals now wired

Not in the original plan at all. The current system:

- BLE objects declare `completesTask: "task_id"` in scenarioData
- On pairing success, `handlePairingSuccess` emits `task_completed_by_npc` with that taskId
- Tasks use type `custom` (no server-side validation — appropriate since the minigame has already confirmed pairing)
- BLE objects declare `onPairSetGlobal: { "var": value }` to set globals on pairing
- Globals are set and `global_variable_changed:var` is emitted immediately on pairing success, before `complete(true)` fires

This is fully scenario-driven: the scenario wires tasks and globals onto BLE objects, not the minigame code.

**Add to plan's data contract:**
```json
{
  "completesTask": "pair_smart_lock",
  "onPairSetGlobal": { "smart_lock_paired": true }
}
```

### Class structure diverged from plan

Plan listed separate `createDeviceList()`, `createActionPanel()`, `createHintPanel()`, and `setupExpandToggle()` methods. Current implementation folds all of this into `createScannerInterface()`. The plan's `addBleDevice` signature had a `details` parameter that was dropped. `updateBleCount()` is inlined into `updatePanel()`. A `submitPinInput()` method was added (not in plan).

The expand/collapse toggle (`setupExpandToggle`) was never implemented. The scanner is fixed-width.

---

## Still open from previous review

| Issue | Previous severity | Status |
|-------|-------------------|--------|
| No sound on pairing success/failure | Low | Still open |
| Paired rows show no "already paired" cursor/toast | Low | Still open |
| `inInventory` flag never set | Low | Still open |
| UUID search doesn't match short form vs full UUID | Low | Still open |
| Expand/collapse toggle not implemented | — | Not started |

### Critical gap #3 — `_scenarioData` empty on re-open (still open)

Devices loaded from `gameState` on re-open have `_scenarioData = undefined`. Both the PIN and handshake sections remain hidden until the first scan tick (~200ms) restores `_scenarioData` from the live room object. In practice this is imperceptible, but if a scenario uses `preselectTarget` and opens the action panel before the first tick, sections will be blank.

**Fix:** In `initializeBleDevices`, look up each device's live room object by MAC and restore `_scenarioData` immediately.

---

## Potential features — updated priority

### High value

1. **GATT service name lookup** — map well-known 16-bit UUIDs to human-readable names (`180F` → `Battery Service`, `181A` → `Environmental Sensing`). A static table of ~30 UUIDs. High educational value, minimal effort.

2. **`_scenarioData` restore on re-open** (gap #3) — look up room objects by MAC in `initializeBleDevices` so action panel sections render immediately.

3. **UUID search normalisation** — strip the `0000____-0000-1000-8000-00805f9b34fb` wrapper so searching `180A` matches a full UUID. One-line normalise before the includes check.

### Medium value

4. **Sound effects** — pair success (existing unlock sound), pair failure (buzz), new device discovery (blip).

5. **Attempt counter on device row** — show remaining PIN attempts on the row before the player targets the device, preventing surprises.

6. **Multiple device pairing in one session** — `complete(true)` fires 2s after first pairing, closing the scanner. A `closesOnPair: false` scenarioData flag would let the player pair multiple devices without re-opening.

### Lower value / future

7. **Expand/collapse toggle** — was in the original plan, never built. The fixed-width panel works fine.

8. **Inventory BLE item scanning** — BLE items in inventory don't appear in the scanner list. Mirror the bluetooth scanner's behaviour.

9. **MITM / cloner mechanic** — passive handshake capture as a future inventory item.

10. **Scan range indicator** — visual overlay on the game world showing the 150px radius.

---

## Data contract (updated)

```json
{
  "lockType": "ble",
  "name": "Smart Lock",
  "mac": "AA:BB:CC:DD:EE:FF",
  "uuids": ["180F", "0000180A-0000-1000-8000-00805f9b34fb"],
  "allowedPins": ["1234"],
  "maxPinAttempts": 3,
  "handshakeFingerprint": "a3f1c9d2...",
  "hintText": "A captured handshake is taped to the back of the monitor.",
  "completesTask": "pair_smart_lock",
  "onPairSetGlobal": { "smart_lock_paired": true }
}
```

`allowDefaultPins` is **removed** — list PINs explicitly in `allowedPins`.  
`handshakeFingerprint` absent → handshake section hidden.  
`allowedPins` absent → PIN section hidden.  
`completesTask` absent → no task completed on pairing.  
`onPairSetGlobal` absent → no globals set on pairing.
