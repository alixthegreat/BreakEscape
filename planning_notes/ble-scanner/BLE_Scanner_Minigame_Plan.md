# BLE Scanner Minigame — Implementation Plan

Last updated: 2026-05-03

---

## Decision: separate scene

The BLE scanner is a new scene (`ble-scanner`), not an extension of `bluetooth-scanner`.

**Why not extend:** The existing bluetooth scanner is a passive information tool — the player walks around and reads MACs. It has no win/fail state and never mutates game progression. The BLE scanner is an active attack tool with win/fail states, attempt limits, and scenario variable writes on success. Merging them via a `mode` flag would require conditional branching throughout the scanning loop, device model, filter categories, and the entire action panel (which has no counterpart in the BT scanner). The bluetooth scanner is wired to live scenarios; touching it adds regression risk for no benefit.

**Code reuse strategy:** Copy (~150 lines) the scanning loop, signal bar renderer, and device sort/filter logic from `bluetooth-scanner-minigame.js` directly into the new file. Do not extract a shared `common.js` yet — justified only if a third bluetooth-type minigame is added.

---

## Files to create / modify

| Action | Path |
|--------|------|
| Create | `public/break_escape/js/minigames/ble-scanner/ble-scanner-minigame.js` |
| Create | `public/break_escape/css/ble-scanner.css` |
| Modify | `public/break_escape/js/minigames/index.js` — add export + register scene |
| Modify | `public/break_escape/js/systems/unlock-system.js` — add `case 'ble':` to the lockType switch |
| Modify | `scenarios/test-ble-scanner/scenario.json.erb` — update test devices to use `lockType: "ble"` with UUIDs + handshake data |

---

## How the unlock flow works end-to-end

The existing bluetooth scanner and the new BLE scanner have different unlock philosophies:

**Bluetooth scanner (passive):** Player picks up the scanner tool, opens it from inventory, scans the room. Later, when they interact with a `lockType: "bluetooth"` door/object, `unlock-system.js` checks whether they already scanned the required MAC and whether signal is strong enough. The scanner minigame itself never calls `apiClient.unlock()`.

**BLE scanner (active/attack):** Interaction with a `lockType: "ble"` object *directly launches the BLE scanner minigame*, pre-targeting that object. The player then pairs from inside the minigame. On pairing success, the minigame calls `apiClient.unlock()` itself, which returns any server-side rewards. `complete(true)` fires after the server confirms success, which triggers `minigame_completed` for scenario hooks.

This means the `case 'ble':` in `unlock-system.js` is a launcher, not a validator.

---

## unlock-system.js dispatch (Step 13)

Add this case after `case 'bluetooth':` (after line 433 in `unlock-system.js`):

```js
case 'ble':
    console.log('BLE LOCK INTERACTION');

    // Check player has a BLE scanner in inventory
    const hasBleScannerTool = window.inventory.items.some(item =>
        item?.scenarioData?.type === 'ble_scanner'
    );

    if (!hasBleScannerTool) {
        window.gameAlert(
            `You need a BLE scanner to interact with this ${type}.`,
            'error', 'Scanner Required', 4000
        );
        break;
    }

    // Launch the BLE scanner minigame, pre-targeting this object
    if (window.startBleScannerMinigame) {
        window.startBleScannerMinigame(lockable, { preselectTarget: lockable });
    } else {
        console.error('startBleScannerMinigame not available');
    }
    break;
```

`lockable` is the room object the player interacted with. Passing it as `preselectTarget` tells the minigame to treat it as the pre-selected attack target on open (player skips the scan-and-select step and goes straight to the action panel for that device).

---

## Data contract (scenario JSON)

`scenarioData` keys for a BLE-locked object in the room:

```json
{
  "lockType": "ble",
  "name": "Smart Lock",
  "mac": "AA:BB:CC:DD:EE:FF",
  "uuids": ["180F", "0000180A-0000-1000-8000-00805f9b34fb"],
  "allowDefaultPins": true,
  "allowedPins": ["0000", "1234"],
  "maxPinAttempts": 3,
  "handshakeFingerprint": "a3f1c9d2...",
  "hintText": "A captured handshake is taped to the back of the monitor."
}
```

`handshakeFingerprint` is a **SHA-256 hex digest** of the normalized handshake token (see Handshake Replay section). Scenario authors generate it offline and embed the hash — not the plaintext token. The plaintext lives in a scenario clue item the player finds.

`allowedPins` rules:
- If `allowedPins` is present, only those PINs succeed.
- If absent but `allowDefaultPins: true`, `"0000"` and `"1234"` are accepted.
- If both absent, PIN pairing UI is hidden for this device.

`handshakeFingerprint` absent → Replay Handshake section hidden for this device.

`maxPinAttempts` defaults to `3` if not set.

Rewards are returned by the server from `apiClient.unlock()` — there is no client-side `onSuccess` key. The unlock-system's `unlockTarget()` function handles applying server response (contents, room data, etc.) exactly as PIN and password minigames do.

---

## Device data model

Each entry in `this.bleDevices` and `window.gameState.bleDevices`:

```js
{
  id: string,                       // MAC, or "ble_<timestamp>" if unknown
  name: string,                     // scenarioData.name or "Unknown Device"
  mac: string,                      // "AA:BB:CC:DD:EE:FF" or "Unknown"
  uuids: string[],                  // [] if none advertised
  nearby: boolean,
  saved: boolean,
  targeted: boolean,                // player has locked onto this device
  paired: boolean,                  // pairing attempt succeeded
  pinAttempts: number,              // cumulative attempts this session
  lastHandshakeAttempt: string|null,
  signalStrength: number,           // dBm (-100 to -30)
  signalStrengthPercentage: number, // 0–100 for bar display
  firstSeen: Date,
  lastSeen: Date,
  inInventory: boolean,
  // live reference — NOT written to gameState, rebuilt each scan cycle
  _scenarioData: object
}
```

`_scenarioData` is stripped when syncing to `window.gameState.bleDevices`.

---

## UI layout

Single-column panel, fixed top-right, same positioning and expand toggle as bluetooth scanner.

```
┌──────────────────────────────────────────┐
│ [▼]  [icon] BLE Scanner    [● Scanning…] │  ← header
├──────────────────────────────────────────┤
│ [Search devices…………………………………]           │
│ [All] [Nearby] [Saved] [Targets] [Paired]│  ← 5 category tabs
├──────────────────────────────────────────┤
│ Detected Devices              3 devices  │
│ ┌──────────────────────────────────────┐ │
│ │ Smart Lock            ▌▌▌▌▌  [💾][🎯]│ │  ← device row
│ │ MAC: AA:BB:CC:DD:EE:FF               │ │
│ │ [180F] [0000180A-…]                  │ │  ← UUID chips
│ │ Last seen: 03/05/2026 14:22          │ │
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ ■ Smart Lock  [TARGETED]  ▌▌▌▌▌     │ │  ← targeted row highlight
│ └──────────────────────────────────────┘ │
├──────────────────────────────────────────┤
│ ACTION PANEL  (hidden until target set)  │
│ ✕ Clear Target                           │
│ Target: Smart Lock — AA:BB:CC:DD:EE:FF   │
│ UUIDs: [180F] [0000180A-…]               │
│                                          │
│ ── Default PIN Pairing ─────────────────│
│ Attempts remaining: 3                    │
│ [Try PIN: 0000]   [Try PIN: 1234]        │
│                                          │
│ ── Handshake Replay ────────────────────│
│ ┌──────────────────────────────────────┐ │
│ │ Paste captured handshake here…       │ │
│ └──────────────────────────────────────┘ │
│ [Replay Handshake]                       │
│                                          │
│ [feedback area]                          │
├──────────────────────────────────────────┤
│ ℹ HINT  (collapsible)                    │
│ A captured handshake is taped to the     │
│ back of the monitor.                     │
└──────────────────────────────────────────┘
```

Width: 380px default, 480px expanded. Action panel is `display:none` until a device is targeted; it slides in with a CSS height transition.

---

## Class structure

```js
export class BleScannerMinigame extends MinigameScene {
    constructor(container, params)
    init()
    createScannerInterface()
    createDeviceList()
    createActionPanel()
    createHintPanel()
    setupEventListeners()
    setupExpandToggle(btn)
    initializeBleDevices()
    startScanning()
    stopScanning()
    checkBleDevices()                     // 200ms scan loop
    addBleDevice(name, mac, uuids, details, nearby, scenarioData)
    updatePanel()                         // re-render device list
    renderDeviceRow(device)               // returns DOM element
    renderUuidChips(uuids)                // returns HTML string
    selectTarget(device)
    clearTarget()
    updateActionPanel(device)
    disablePinButtons()
    attemptPin(pin)
    replayHandshake(text)
    handlePairingSuccess(device, method)
    handlePairingFailure(device, reason)
    showActionFeedback(message, type)     // 'success' | 'failure' | 'info'
    updateBleCount()
    syncBleDevices()
    start()
    complete(success)
    cleanup()
}
```

---

## Scanning loop (checkBleDevices)

Copied from `BluetoothScannerMinigame.checkBluetoothDevices` with two changes:
1. Filter `obj.scenarioData?.lockType === 'ble'`
2. Extract `obj.scenarioData?.uuids || []`

```js
checkBleDevices() {
    if (!window.currentPlayerRoom || !window.rooms?.[window.currentPlayerRoom]?.objects) return;
    const room = window.rooms[window.currentPlayerRoom];
    const player = window.player;
    if (!player) return;

    const detected = new Set();
    let needsUpdate = false;

    Object.values(room.objects).forEach(obj => {
        if (obj.scenarioData?.lockType !== 'ble') return;

        const dist = Math.hypot(player.x - obj.x, player.y - obj.y);
        const mac  = obj.scenarioData?.mac  || 'Unknown';
        const name = obj.scenarioData?.name || 'Unknown Device';
        const uuids = obj.scenarioData?.uuids || [];

        if (dist <= this.BLE_SCAN_RANGE) {
            detected.add(mac);
            const pct = Math.max(0, Math.round(100 - (dist / this.BLE_SCAN_RANGE * 100)));
            const dbm = Math.round(-100 + (pct * 0.7));

            const existing = this.bleDevices.find(d => d.mac === mac);
            if (existing) {
                const changed = !existing.nearby ||
                    Math.abs(existing.signalStrengthPercentage - pct) > 5;
                existing.nearby = true;
                existing.signalStrength = dbm;
                existing.signalStrengthPercentage = pct;
                existing.lastSeen = new Date();
                existing._scenarioData = obj.scenarioData;
                if (changed) needsUpdate = true;
            } else {
                const details = `Distance: ${Math.round(dist)} units | Signal: ${dbm}dBm`;
                this.addBleDevice(name, mac, uuids, details, true, obj.scenarioData);
                needsUpdate = true;
            }
        }
    });

    this.bleDevices.forEach(d => {
        if (d.nearby && !detected.has(d.mac)) {
            d.nearby = false;
            d.lastSeen = new Date();
            needsUpdate = true;
        }
    });

    if (needsUpdate) {
        this.syncBleDevices();
        const now = Date.now();
        if (now - this.lastPanelUpdate > this.UPDATE_THROTTLE) {
            this.updatePanel();
            this.lastPanelUpdate = now;
        }
    }

    // If a preselectTarget was passed in params and we haven't selected yet, auto-target it
    if (this.params.preselectTarget && !this.selectedDevice) {
        const mac = this.params.preselectTarget.scenarioData?.mac;
        const match = this.bleDevices.find(d => d.mac === mac);
        if (match) this.selectTarget(match);
    }
}
```

---

## Device list rendering

Device row shows:
- Name (bold) + signal bars (right-aligned) + status icons (saved 💾, targeted 🎯, paired ✓)
- MAC address
- UUID chips — small inline tags, truncated to 8 chars, full value in `title` attribute
- Timestamp

UUID chip HTML:
```html
<div class="ble-uuid-chips">
  <span class="ble-uuid-chip" title="0000180A-0000-1000-8000-00805f9b34fb">0000180A</span>
  <span class="ble-uuid-chip" title="180F">180F</span>
</div>
```

Targeted row gets class `ble-device--targeted` (cyan left border + tinted background).
Paired row gets class `ble-device--paired` (green left border).

Clicking a row calls `selectTarget(device)`. There is no auto-save-on-click as in the bluetooth scanner — saving is explicit via the 💾 icon.

---

## Target selection

```js
selectTarget(device) {
    this.bleDevices.forEach(d => { d.targeted = false; });
    device.targeted = true;
    this.selectedDevice = device;
    this.syncBleDevices();
    this.updatePanel();
    this.updateActionPanel(device);
    this.actionPanelEl.style.display = 'block';
}

clearTarget() {
    if (this.selectedDevice) this.selectedDevice.targeted = false;
    this.selectedDevice = null;
    this.syncBleDevices();
    this.updatePanel();
    this.actionPanelEl.style.display = 'none';
}
```

---

## PIN pairing

```js
attemptPin(pin) {
    const device = this.selectedDevice;
    if (!device || device.paired) return;

    const sd = device._scenarioData || {};
    const maxAttempts = sd.maxPinAttempts ?? 3;

    if (device.pinAttempts >= maxAttempts) {
        this.showActionFeedback('Max attempts reached. PIN entry locked.', 'failure');
        return;
    }

    device.pinAttempts++;
    this.syncBleDevices();

    const allowed = sd.allowedPins
        ? sd.allowedPins
        : (sd.allowDefaultPins ? ['0000', '1234'] : []);

    if (allowed.includes(pin)) {
        this.handlePairingSuccess(device, `PIN ${pin}`);
    } else {
        const remaining = maxAttempts - device.pinAttempts;
        const msg = remaining > 0
            ? `Incorrect PIN. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
            : 'Incorrect PIN. No attempts remaining.';
        this.handlePairingFailure(device, msg);
        if (device.pinAttempts >= maxAttempts) this.disablePinButtons();
    }
}
```

PIN buttons are disabled (`disabled` attribute + `.ble-btn--disabled` class) once attempts are exhausted or device is paired.

---

## Handshake replay

Matching uses **SHA-256 hashing** so the plaintext token is never stored in scenario JSON.

Normalization before hashing: `input.trim().toLowerCase().replace(/\s+/g, '')`

```js
async replayHandshake(text) {
    const device = this.selectedDevice;
    if (!device || device.paired) return;

    const sd = device._scenarioData || {};
    if (!sd.handshakeFingerprint) {
        this.showActionFeedback('This device does not support handshake replay.', 'info');
        return;
    }

    const normalize = s => s.trim().toLowerCase().replace(/\s+/g, '');
    const normalized = normalize(text);

    // SHA-256 via Web Crypto API (available in all modern browsers)
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(normalized));
    const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    device.lastHandshakeAttempt = text;
    this.syncBleDevices();

    if (hashHex === sd.handshakeFingerprint.toLowerCase()) {
        this.handlePairingSuccess(device, 'handshake replay');
    } else {
        this.handlePairingFailure(device, 'Handshake mismatch. Token does not match captured fingerprint.');
    }
}
```

Scenario authors generate the fingerprint with: `echo -n "normalizedtoken" | sha256sum`
No attempt limit on handshake replay by default (player may be correcting typos/whitespace).

---

## Success / failure flow

On success, call `apiClient.unlock()` to get server confirmation and any rewards. This matches the PIN minigame's `validatePinWithServer` pattern exactly.

```js
async handlePairingSuccess(device, method) {
    const sd = device._scenarioData || {};
    const lockable = this.params.preselectTarget || this.params.item;
    const targetType = this.params.type || 'object';

    let targetId;
    if (targetType === 'door') {
        targetId = lockable?.doorProperties?.connectedRoom || lockable?.doorProperties?.roomId;
    } else {
        targetId = lockable?.scenarioData?.id || lockable?.scenarioData?.name || lockable?.objectId;
    }

    // Use method tag 'ble' — server currently trusts client for this method
    // (same pattern as 'bluetooth' and 'rfid' in game.rb validate_unlock)
    try {
        const apiClient = window.ApiClient || window.APIClient;
        const response = await apiClient.unlock(targetType, targetId, method, 'ble');

        if (!response.success) {
            this.handlePairingFailure(device, 'Server rejected pairing attempt.');
            return;
        }

        // If object has contents, populate them from server response
        if (response.hasContents && response.contents && lockable?.scenarioData) {
            lockable.scenarioData.contents = response.contents;
        }

        this.serverResponse = response;
    } catch (err) {
        console.error('BLE unlock server error:', err);
        // Proceed optimistically — don't block the player on network errors
    }

    device.paired = true;
    device.targeted = false;
    this.syncBleDevices();
    this.updatePanel();
    this.showActionFeedback(`✓ Paired via ${method}`, 'success');

    setTimeout(() => this.complete(true), 2000);
}

handlePairingFailure(device, reason) {
    this.showActionFeedback(reason, 'failure');
    this.actionPanelEl.classList.add('ble-action-panel--shake');
    setTimeout(() => this.actionPanelEl.classList.remove('ble-action-panel--shake'), 400);
}
```

`showActionFeedback(message, type)` sets content + class on `#ble-action-feedback`:
- `'success'` → `.ble-feedback--success` (green `#00cc00`)
- `'failure'` → `.ble-feedback--failure` (red `#cc3333`)
- `'info'`    → `.ble-feedback--info` (yellow `#cccc00`)

---

## Global state & persistence

- `window.gameState.bleDevices` — same pattern as `bluetoothDevices`
- `_scenarioData` stripped before writing to gameState (live reference only)
- `pinAttempts` and `paired` survive closing and reopening the scanner within the same session
- `initializeBleDevices()` loads from `window.gameState.bleDevices` on open

---

## CSS plan (ble-scanner.css)

All rules follow pixel-art conventions from `bluetooth-scanner.css` — 2px borders, no border-radius, cyan `#00bcd4` accent.

| Selector | Notes |
|----------|-------|
| `.ble-scanner-container` | Fixed top-right, 380px, same clip-path as BT scanner |
| `.ble-scanner-container.expanded` | 480px |
| `.ble-scanner-header` | Same layout as BT scanner header |
| `.ble-category` | Same tab style as `.bluetooth-category` |
| `.ble-device` | Same row style as `.bluetooth-device` |
| `.ble-device--targeted` | 4px cyan left border, subtle cyan bg tint |
| `.ble-device--paired` | 4px green left border |
| `.ble-uuid-chips` | `display:flex; flex-wrap:wrap; gap:4px; margin-top:2px` |
| `.ble-uuid-chip` | `font-size:10px; padding:1px 4px; border:1px solid #00bcd4; color:#00bcd4; font-family:monospace` |
| `.ble-action-panel` | `border-top:2px solid #333; padding:8px; background:#0a0a0a` |
| `.ble-action-section` | `border-bottom:1px solid #222; padding-bottom:6px; margin-bottom:6px` |
| `.ble-pin-buttons` | `display:flex; gap:8px` |
| `.ble-pin-btn` | Existing minigame button style with cyan border |
| `.ble-btn--disabled` | Greyed out, `pointer-events:none`, `opacity:0.4` |
| `.ble-handshake-input` | `width:100%; min-height:60px; resize:vertical; font-family:monospace; font-size:11px; border:1px solid #555; background:#111; color:#ccc` |
| `.ble-replay-btn` | Full-width, cyan accent |
| `#ble-action-feedback` | Min height reserved so layout doesn't jump |
| `.ble-feedback--success` | `color:#00cc00` |
| `.ble-feedback--failure` | `color:#cc3333` |
| `.ble-feedback--info` | `color:#cccc00` |
| `@keyframes ble-shake` | `transform:translateX` oscillation, 400ms |
| `.ble-action-panel--shake` | Applies `ble-shake` animation |
| `.ble-hint-panel` | Collapsible, dim text `#888`, monospace |

---

## Registration in index.js

Add alongside the bluetooth scanner entry:

```js
// Export (with other exports near top)
export { BleScannerMinigame, startBleScannerMinigame } from './ble-scanner/ble-scanner-minigame.js';

// Import + register (in the init block at bottom)
import { BleScannerMinigame, startBleScannerMinigame } from './ble-scanner/ble-scanner-minigame.js';
MinigameFramework.registerScene('ble-scanner', BleScannerMinigame);
window.startBleScannerMinigame = startBleScannerMinigame;
```

The `window.startBleScannerMinigame` assignment is needed so `unlock-system.js` can call it without an ES module import.

---

## Implementation steps (in order)

1. **Scaffold `ble-scanner-minigame.js`** — class skeleton, constructor, all method stubs, constants (`BLE_SCAN_RANGE = 150`, `BLE_SCAN_INTERVAL = 200`, `UPDATE_THROTTLE = 100`). Import `MinigameScene`.

2. **Build static UI** — `createScannerInterface()` assembles header, search input, 5 category tabs, device list container, action panel (hidden), hint panel. Wire expand/collapse toggle (copy from BT scanner).

3. **Implement scanning loop** — copy `checkBluetoothDevices`, rename `checkBleDevices`, change `lockType` filter to `'ble'`, extract `uuids` field. Implement `addBleDevice`, `syncBleDevices`, `updateBleCount`.

4. **Implement device list rendering** — `renderDeviceRow(device)` with name + signal bars + status icons, MAC line, UUID chips, timestamp. `renderUuidChips(uuids)` truncates to 8 chars. `updatePanel()` filters by search + active category, sorts, repopulates list.

5. **Implement target selection** — `selectTarget(device)` and `clearTarget()`. Click handler on rows. "Clear Target" `✕` button in action panel header.

6. **Implement action panel population** — `updateActionPanel(device)` sets device name/MAC/UUIDs in header. Shows PIN section only if `allowedPins` or `allowDefaultPins` set. Shows handshake section only if `handshakeFingerprint` set. Restores attempt counter from `device.pinAttempts`.

7. **Implement PIN pairing** — `attemptPin(pin)` with attempt tracking and lockout. Click handlers for 0000 and 1234 buttons. `disablePinButtons()` helper.

8. **Implement handshake replay** — `replayHandshake(text)` using `crypto.subtle.digest` + normalize. Replay button click handler.

9. **Implement success/failure flows** — `handlePairingSuccess` (calls `apiClient.unlock`, marks paired, fires `complete(true)` after 2s). `handlePairingFailure` (shake animation, feedback message). `showActionFeedback`.

10. **Implement `preselectTarget` auto-targeting** — at end of `checkBleDevices`, if `this.params.preselectTarget` is set and `this.selectedDevice` is null, auto-call `selectTarget` when the matching device appears in the scan results.

11. **Write `ble-scanner.css`** — all rules from the CSS plan above.

12. **Register in `index.js`** — export, import, register scene, expose `window.startBleScannerMinigame`.

13. **Add `case 'ble':` in `unlock-system.js`** — inventory check for `ble_scanner` tool, then call `window.startBleScannerMinigame(lockable, { preselectTarget: lockable })`.

14. **Update test scenario** — `scenarios/test-ble-scanner/scenario.json.erb` — add `uuids`, `handshakeFingerprint` (pre-computed SHA-256 hash), `allowDefaultPins`, `maxPinAttempts` to test devices. Add a text-clue item in the room that contains the plaintext handshake token the player pastes.

15. **Manual QA checklist:**
    - Device appears in list when player is within 150px
    - UUID chips render correctly and show full UUID in tooltip
    - Clicking device opens action panel and highlights row with cyan border
    - Correct PIN succeeds; incorrect PIN decrements counter and flashes red
    - After 3rd failed PIN, buttons are disabled and locked message shown
    - Correct handshake (exact normalized match, case-insensitive, whitespace-collapsed) succeeds
    - Wrong handshake shows failure feedback without lockout
    - Paired device moves to Paired category tab; paired green border shown
    - `pinAttempts` and `paired` survive closing + reopening the scanner
    - `apiClient.unlock()` is called on success with method `'ble'`
    - Interacting with a `lockType: "ble"` object checks for `ble_scanner` in inventory
    - If scanner not in inventory, `gameAlert` fires and minigame does NOT launch
    - If scanner present, minigame opens and pre-targets the interacted object
    - Hint text from `scenarioData.hintText` shows in collapsible hint panel
    - Expand/collapse toggle works at both 380px and 480px widths

---

## What is explicitly NOT in scope

- Extracting shared helpers from `bluetooth-scanner-minigame.js` — copy the ~150 lines instead
- Server-side validation logic changes in `game.rb` — the `'ble'` method will be trusted by the server the same way `'bluetooth'` is (comment in `validate_unlock` says "Client validated these — trust it")
- Any changes to `bluetooth-scanner-minigame.js` or its CSS
- Bluetooth classic coexistence in the same UI panel
