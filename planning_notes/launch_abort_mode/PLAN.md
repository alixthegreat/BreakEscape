# Launch-Abort Mode & Archive-Key Mode: Implementation Plan

## Overview

This plan adds two new modes to the `flag-station` minigame, creating the climax of Mission 1.

**Four flags, two distinct goals:**
- **Flag1** (derek `~/flag`) → SSH brute force evidence → Drop-Site Terminal
- **Flag2** (derek `~/entropy/MISSION_KEY` or navigation) → Linux navigation evidence → Drop-Site Terminal
- **Flag3** (shatter `~/flag`) → **Archive decryption key** → Drop-Site Terminal (reward: remote unlock of ENTROPY archive safe)
- **Flag4** (shatter `~/launch_code`) → **Launch authorization code** → ENTROPY Launch Device (held by Derek; shows ABORT/LAUNCH)

**Narrative flow:**
1. Player brute-forces SSH → gets flag1 → submits at Drop-Site Terminal
2. Player navigates Linux → gets flag2 → submits at Drop-Site Terminal
3. Player escalates via sudo → reads `shatter/operation_shatter/DEPLOYMENT_CONFIG` (which names both `~/flag` and `~/launch_code` as the two codes) → gets flag3 and flag4 from the shatter account
4. Player submits flag3 at Drop-Site Terminal → reward remotely unlocks the `entropy_encrypted_archive` safe in the server room
5. Player opens the now-unlocked archive (container minigame) → reads The Architect's Authorization + Network Architecture
6. Player confronts / KO's Derek → picks up the **ENTROPY Launch Device** from his dropped inventory
7. Player opens launch device from inventory (flag-station, `mode: "launch-abort"`) → enters flag4
8. Launch device validates flag4 with Hacktivity → shows **ABORT / LAUNCH** choice
9. Player chooses → global variables set → Agent 0x99 sends timed phone message → support_hub unlocks debrief option → Player calls for debrief → `start_debrief_cutscene` triggers → moral-weight or success closing debrief

**Key design decision:** Flag3 and Flag4 are separate. Flag3 is the archive *decryption* key; Flag4 is the launch *authorization* code. This means both are submitted through distinct mechanisms (drop-site vs. launch device), and the debrief offer only appears once both are done.

---

## 1. SecGen XML Changes (`1_intro_linux.xml`)

Add `~/launch_code` as a second file in the `shatter` account:

```xml
<!-- shatter: ENTROPY infrastructure account -->
<generator type="account">
  <input into="username"><value>shatter</value></input>
  <input into="password">
    <generator type="strong_password_generator"/>
  </input>
  <input into="super_user"><value>false</value></input>
  <input into="leaked_filenames">
    <value>flag</value>                                <!-- flag3: archive decryption key -->
    <value>launch_code</value>                         <!-- flag4: launch authorization code -->
    <value>operation_shatter/DEPLOYMENT_CONFIG</value>
    <value>operation_shatter/TARGET_MANIFEST</value>
  </input>
  <input into="strings_to_leak">
    <generator type="flag_generator" />                <!-- flag3 value -->
    <generator type="flag_generator" />                <!-- flag4 value -->
    <value>OPERATION SHATTER -- DEPLOYMENT CONFIGURATION
Classification: ENTROPY EYES ONLY

Infrastructure Role: Social Fabric Content Distribution Node
Cell Operator: D. Lawson (derek)
Status: ACTIVE -- Launch T-72 Hours

Message vectors loaded: 2,347,832 targeted profiles
Deployment method: Coordinated social platform injection
Launch window: Sunday 06:00 UTC

TWO CODES REQUIRED:
  ~/flag        = ENTROPY Encrypted Archive decryption key
  ~/launch_code = Operation Shatter launch authorization code

Both codes are required for full operational access.
Keep separate. Do not combine.
-- The Architect</value>
    <value>... TARGET_MANIFEST content unchanged ...</value>
  </input>
</generator>
```

---

## 2. Archive Mechanism: Remote Unlock via `unlock_object` Reward

The `entropy_encrypted_archive` **stays as a `safe` with `contents`** (container). The existing container + unlock system handles opening it. No new archive-key mode needed.

When flag3 is submitted at the Drop-Site Terminal, the server returns a `flagRewards` entry that remotely unlocks the safe:

```json
"flagRewards": [
  { "type": "emit_event", "event_name": "ssh_flag_submitted",        "description": "SSH flag" },
  { "type": "emit_event", "event_name": "navigation_flag_submitted",  "description": "Navigation flag" },
  {
    "type": "emit_event",
    "event_name": "sudo_flag_submitted",
    "description": "Privilege escalation flag"
  },
  {
    "type": "unlock_object",
    "objectId": "entropy_encrypted_archive",
    "description": "Archive decryption key submitted — unlocks the ENTROPY archive"
  }
]
```

The third flagReward (index 2 = flag3) triggers both `sudo_flag_submitted` and `unlock_object`.

**New reward type to add:** `unlock_object` in `flag-station-minigame.js` `processRewardEvents()`:
```js
if (reward.type === 'unlock_object' && reward.objectId) {
    // Find the object in the current room and mark it as unlocked
    if (window.eventDispatcher) {
        window.eventDispatcher.emit('object_remotely_unlocked', {
            objectId: reward.objectId,
            source: 'flag_reward'
        });
    }
}
```

The game engine (`interactions.js` or `rooms.js`) must listen for `object_remotely_unlocked` and update the target object's `locked` state to `false` so the container minigame can open it normally on next interaction.

---

## 3. New flag-station Mode: `launch-abort`

The launch device is a portable item held by Derek. After Derek is KO'd, it drops and the player picks it up. Interacting with it from inventory launches the `FlagStationMinigame` in `launch-abort` mode.

### Scenario config (in Derek's `itemsHeld`):
```json
{
  "type": "flag-station",
  "id": "entropy_launch_device",
  "mode": "launch-abort",
  "name": "ENTROPY Launch Device",
  "takeable": true,
  "observations": "A ruggedised tactical device. Screen: OPERATION SHATTER — ARMED. T-72 HOURS TO LAUNCH.",
  "acceptsVms": ["intro_to_linux_security_lab"],
  "flags": "<%= flags_for_vm('intro_to_linux_security_lab', ['flag{launch_authorization_code}']) %>",
  "flagRewards": [
    { "type": "emit_event", "event_name": "launch_code_submitted" },
    { "type": "set_global", "key": "launch_code_submitted", "value": true }
  ],
  "onAbort": {
    "setGlobal": { "player_aborted_attack": true, "ready_for_debrief": true },
    "emitEvent": "attack_aborted"
  },
  "onLaunch": {
    "setGlobal": { "player_launched_attack": true, "ready_for_debrief": true },
    "emitEvent": "attack_launched"
  },
  "abortConfirmText": "ABORT OPERATION SHATTER?\n\nThis will terminate all active attack vectors and transmit a kill signal to ENTROPY infrastructure. The attack will not proceed.",
  "launchConfirmText": "EXECUTE OPERATION SHATTER?\n\n2,347,832 people will receive coordinated emergency disinformation simultaneously.\n\nProjected panic events: hospitalizations, cardiovascular events, fatalities.\nThis cannot be undone."
}
```

Flag4 is defined in SecGen as the second `<generator type="flag_generator" />` in shatter's `strings_to_leak`.

### UI behaviour — standard (waiting for flag) state:
- Header: 🔐 "OPERATION SHATTER — AUTHORIZATION REQUIRED"
- Input: "ENTER LAUNCH AUTHORIZATION CODE" (not "Enter Flag")
- Same Hacktivity validation flow as standard mode
- On success: shows ABORT / LAUNCH choice UI

### UI behaviour — post-submission choice state:
- Header: blinking ⚠️ "OPERATION SHATTER — ARMED"
- Cosmetic countdown: "LAUNCH WINDOW: SUNDAY 06:00 UTC"
- Two large buttons:
  - `[ABORT OPERATION]` — green border, confirm dialog
  - `[EXECUTE LAUNCH]` — red border, pulsing, confirm dialog with full casualty text
- After choice: button highlighted, device "locks", minigame closes, events emitted

---

## 4. Changes to `flag-station-minigame.js`

### Constructor additions
```js
this.mode = params.mode || 'standard';
this.onAbortConfig = params.onAbort || null;
this.onLaunchConfig = params.onLaunch || null;
this.abortConfirmText = params.abortConfirmText || 'Abort the operation?';
this.launchConfirmText = params.launchConfirmText || 'Execute the operation?';
this.choiceMade = false; // track if abort/launch already chosen
```

### `init()` change
Branch on `this.mode`:
```js
init() {
    this.params.cancelText = 'Close';
    this.params.title = this.stationName;
    super.init();
    if (this.mode === 'launch-abort') {
        this.buildLaunchAbortUI();
    } else {
        this.buildUI(); // standard mode unchanged
    }
}
```

### New method: `buildLaunchAbortUI()`
- If `this.choiceMade` (choice already recorded in session): show locked/done state
- Else: show the standard flag entry UI but with:
  - Different header icon / colours
  - Input label: "ENTER LAUNCH AUTHORIZATION CODE"
  - On successful flag submission: call `this.showLaunchAbortChoice()` after showing success message

### New method: `showLaunchAbortChoice()`
Replace the input area with the ABORT/LAUNCH buttons. Rendered after flag is validated.

### Override `handleFlagSuccess()` in launch-abort mode:
After standard success processing (Hacktivity validation, rewards), call `showLaunchAbortChoice()`.

### New methods: `handleAbort()` / `handleLaunch()`
```js
handleAbort() {
    if (!confirm(this.abortConfirmText)) return;
    this.choiceMade = true;
    this.applyChoiceConfig(this.onAbortConfig);
    this.showFinalState('OPERATION ABORTED', 'Abort signal transmitted. All attack vectors terminated.', 'abort');
}

handleLaunch() {
    if (!confirm(this.launchConfirmText)) return;
    this.choiceMade = true;
    this.applyChoiceConfig(this.onLaunchConfig);
    this.showFinalState('OPERATION SHATTER — LAUNCHED', 'Attack vector deployed. 2,347,832 targets receiving payload.', 'launch');
}

applyChoiceConfig(config) {
    if (!config) return;
    if (config.setGlobal && window.gameState?.globalVariables) {
        Object.assign(window.gameState.globalVariables, config.setGlobal);
        for (const [key, value] of Object.entries(config.setGlobal)) {
            window.eventDispatcher?.emit('global_variable_changed:' + key, { value });
        }
    }
    if (config.emitEvent) {
        window.eventDispatcher?.emit(config.emitEvent, { source: 'launch_device' });
    }
}
```

### New reward type: `unlock_object`
In `processRewardEvents()`:
```js
if (reward.type === 'unlock_object' && reward.objectId) {
    window.eventDispatcher?.emit('object_remotely_unlocked', {
        objectId: reward.objectId,
        source: 'flag_reward'
    });
}
```

### New reward type: `set_global`
```js
if (reward.type === 'set_global' && reward.key !== undefined) {
    if (window.gameState?.globalVariables) {
        window.gameState.globalVariables[reward.key] = reward.value;
        window.eventDispatcher?.emit('global_variable_changed:' + reward.key, { value: reward.value });
    }
}
```

---

## 5. Making flag-station Items Openable from Inventory

**File:** `interactions.js`

The flag-station interaction handler at line 808 currently launches the minigame for world objects only. It needs to also work when the item is in inventory. The existing `isInventoryItem` check at line 867 already skips range checks, but the flag-station case at line 808 fires before that check — so it already handles inventory items correctly, **as long as the params are passed through**.

The current handler passes only basic params (title, stationId, flags, acceptsVms). It needs extending:

```js
if (sprite.scenarioData.type === "flag-station" || sprite.scenarioData.type === "flag_station") {
    if (window.MinigameFramework) {
        window.MinigameFramework.startMinigame('flag-station', null, {
            title: sprite.scenarioData.name || 'Flag Submission Terminal',
            stationId: sprite.scenarioData.id || sprite.objectId,
            stationName: sprite.scenarioData.name,
            mode: sprite.scenarioData.mode || 'standard',                    // NEW
            flags: sprite.scenarioData.flags || [],
            acceptsVms: sprite.scenarioData.acceptsVms || [],
            flagRewards: sprite.scenarioData.flagRewards || [],              // NEW (for server)
            onAbort: sprite.scenarioData.onAbort || null,                   // NEW
            onLaunch: sprite.scenarioData.onLaunch || null,                 // NEW
            abortConfirmText: sprite.scenarioData.abortConfirmText || null, // NEW
            launchConfirmText: sprite.scenarioData.launchConfirmText || null, // NEW
            submittedFlags: window.gameState?.submittedFlags || [],
            gameId: window.breakEscapeConfig?.gameId || window.gameConfig?.gameId
        });
        return;
    }
}
```

Note: `flagRewards` processing is server-side on flag submit; the client-side `processRewardEvents` uses `data.rewards` from the server response. The scenario-defined `flagRewards` go to the server at game load time (already existing mechanism).

---

## 6. `object_remotely_unlocked` Event Handler

**File:** `interactions.js` or `rooms.js` (wherever room object state is managed)

Listen for the new event and update the target object's lock state:
```js
window.eventDispatcher?.on('object_remotely_unlocked', ({ objectId }) => {
    // Search all rooms for the object
    Object.values(rooms).forEach(room => {
        if (room.objects) {
            room.objects.forEach(obj => {
                if (obj.objectId === objectId || obj.scenarioData?.id === objectId) {
                    obj.scenarioData.locked = false;
                    // Optionally update visual indicator (remove lock icon/overlay)
                    console.log('[RemoteUnlock] Object unlocked:', objectId);
                }
            });
        }
    });
});
```

---

## 7. New Sprite Asset

**Action:** Copy `public/break_escape/assets/objects/tablet.png` → `public/break_escape/assets/objects/launch_device.png` as a placeholder.

In `game.js`, add:
```js
this.load.image('launch_device', 'objects/launch_device.png');
// or use existing 'tablet' key if that already loads tablet.png
```

If `tablet` is already loaded (check game.js line ~406), the launch device scenario object can use `"assetKey": "tablet"` or similar rather than needing a new loader entry. The placeholder makes intent clear for the final sprite artist.

---

## 8. Changes to `scenario.json.erb`

### 8a. Drop-Site Terminal — add `unlock_object` reward for flag3

The third `flagRewards` entry (index 2 = flag3/sudo flag) gains an additional reward:
```json
{
  "type": "emit_event",
  "event_name": "sudo_flag_submitted",
  "description": "Privilege escalation flag submitted — archive decryption key confirmed"
},
{
  "type": "unlock_object",
  "objectId": "entropy_encrypted_archive"
}
```
(These are two separate reward entries both fired on flag3 submission.)

### 8b. ENTROPY archive — update `observations` text

```json
"observations": "A heavily encrypted portable drive in a reinforced case. Stamped: ENTROPY — EYES ONLY. The archive decryption key can be found in the shatter account on the compromised server."
```

### 8c. Derek NPC — add launch device to `itemsHeld`

```json
{
  "type": "flag-station",
  "id": "entropy_launch_device",
  "mode": "launch-abort",
  "name": "ENTROPY Launch Device",
  "takeable": true,
  "observations": "A ruggedised tactical device. Screen: OPERATION SHATTER — ARMED. T-72 HOURS.",
  "acceptsVms": ["intro_to_linux_security_lab"],
  "flags": "<%= flags_for_vm('intro_to_linux_security_lab', ['flag{launch_authorization_code}']) %>",
  "flagRewards": [
    { "type": "emit_event", "event_name": "launch_code_submitted" },
    { "type": "set_global", "key": "launch_code_submitted", "value": true }
  ],
  "onAbort": {
    "setGlobal": { "player_aborted_attack": true, "ready_for_debrief": true },
    "emitEvent": "attack_aborted"
  },
  "onLaunch": {
    "setGlobal": { "player_launched_attack": true, "ready_for_debrief": true },
    "emitEvent": "attack_launched"
  },
  "abortConfirmText": "ABORT OPERATION SHATTER?\n\nTerminate all active attack vectors. The attack will not proceed.",
  "launchConfirmText": "EXECUTE OPERATION SHATTER?\n\n2,347,832 people will receive simultaneous emergency disinformation.\n\nProjected casualties among vulnerable populations.\nThis cannot be undone."
}
```

### 8d. New global variables

```json
"launch_code_submitted": false,
"player_aborted_attack": false,
"player_launched_attack": false,
"ready_for_debrief": false
```

### 8e. Agent 0x99 event mappings — add launch device events

```json
{
  "eventPattern": "global_variable_changed:sudo_flag_submitted",
  "condition": "value === true",
  "onceOnly": true,
  "sendTimedMessage": {
    "delay": 2000,
    "message": "Decryption key confirmed. 🦎 The ENTROPY archive is unlocked — open it. And check that account for a second file: the launch authorization code. You'll need it for the device Derek's carrying."
  }
},
{
  "eventPattern": "item_picked_up:entropy_launch_device",
  "onceOnly": true,
  "sendTimedMessage": {
    "delay": 1500,
    "message": "You have the launch device. 🦎 Enter the launch code from the shatter account. Then you'll have a choice. Make it deliberately."
  }
},
{
  "eventPattern": "attack_aborted",
  "onceOnly": true,
  "sendTimedMessage": {
    "delay": 2000,
    "message": "Abort confirmed. Operation Shatter is dead. 🦎 Both codes secured, attack neutralized. Call me when you're ready to debrief."
  }
},
{
  "eventPattern": "attack_launched",
  "onceOnly": true,
  "sendTimedMessage": {
    "delay": 4000,
    "message": "...I'm seeing reports. 🦎 Hospital switchboards. Bank lines. People in the streets. The attack went through. Call me."
  }
}
```

---

## 9. Debrief Trigger: Phone Ink Changes

**File:** `scenarios/m01_first_contact/ink/m01_phone_agent0x99.ink`

Add new variables:
```ink
VAR player_aborted_attack = false
VAR player_launched_attack = false
VAR ready_for_debrief = false
VAR launch_code_submitted = false
```

Update `support_hub` debrief condition:
```ink
// OLD:
+ {derek_confronted and ssh_flag_submitted and linux_flag_submitted and sudo_flag_submitted} [Operation Shatter is neutralized — I'm ready to report in for debrief]
    -> closing_debrief

// NEW:
+ {derek_confronted and ssh_flag_submitted and linux_flag_submitted and sudo_flag_submitted and launch_code_submitted and (player_aborted_attack or player_launched_attack)} [Operation Shatter resolved — I'm ready for debrief]
    -> closing_debrief
```

The `closing_debrief` knot already contains `#set_global:start_debrief_cutscene:true` which triggers the cutscene NPC conversation. This mechanism stays unchanged.

---

## 10. Closing Debrief Ink Changes

**File:** `scenarios/m01_first_contact/ink/m01_closing_debrief.ink`

Add variables:
```ink
VAR player_aborted_attack = false
VAR player_launched_attack = false
```

Branch `start` knot:
```ink
=== start ===
{ player_launched_attack:
    -> launch_weight
- else:
    -> normal_opening
}

=== launch_weight ===
[SAFETYNET HQ - Agent 0x99's Office]
#speaker:agent_0x99

Agent 0x99: {player_name}. I'm going to assume Derek triggered the failsafe before you reached him.

Agent 0x99: Because the alternative — that you had the device in your hands, with the abort code in the system, and chose not to use it — I'm not ready to consider that.

+ [The attack went through. It was me.]
    -> launch_confession
+ [...]
    -> launch_assumption_accepted

=== launch_assumption_accepted ===
Agent 0x99: Right. Derek. Of course.

Agent 0x99: Forty-seven hospitals received simultaneous closure alerts. Three dialysis centres. Eleven thousand emergency calls in the first hour.

Agent 0x99: We weren't able to stop the attack in time.

Agent 0x99: You completed the technical objectives. The evidence is solid. Derek will spend decades in prison.

Agent 0x99: But we weren't fast enough.

+ [What happens now?]
    -> launch_aftermath

=== launch_confession ===
Agent 0x99: ...

Agent 0x99: Why?

+ [I don't know. I froze.]
    -> launch_aftermath
+ [I wanted to see what would happen.]
    -> launch_aftermath
+ [The attack needed to happen.]
    -> launch_aftermath

=== launch_aftermath ===
Agent 0x99: The casualties are being assessed. The vulnerable populations ENTROPY targeted — some of them didn't make it.

Agent 0x99: Your technical work is documented. You'll be assessed separately on that.

Agent 0x99: Right now I just need to know: are you still fit for the next mission?

+ [Yes. I'll do better.]
    -> evidence_review
+ [I'm not sure.]
    -> evidence_review

=== normal_opening ===
[SAFETYNET HQ - Agent 0x99's Office]
#speaker:agent_0x99

Agent 0x99: {player_name}. First, I need you to understand what you accomplished today.
// ... (existing debrief continues unchanged) ...
-> evidence_review
```

---

## 11. Derek Confrontation Ink — Gate Update

**File:** `scenarios/m01_first_contact/ink/m01_derek_confrontation.ink`

The confrontation is currently gated on 3 flags. Flag4 (launch code) is only needed for the launch device, not for confronting Derek — so the gate stays at 3 flags. **No change needed here.**

---

## 12. Implementation Order

1. **SecGen XML** — add `launch_code` filename + second `flag_generator` to shatter account; update `DEPLOYMENT_CONFIG` text
2. **Sprite asset** — copy `tablet.png` → `launch_device.png`
3. **`flag-station-minigame.js`** — add `mode` param, `launch-abort` UI flow, `applyChoiceConfig`, `unlock_object`/`set_global` reward types
4. **`interactions.js`** — extend flag-station handler to pass `mode`, `onAbort`, `onLaunch`, etc.; add `object_remotely_unlocked` listener
5. **`scenario.json.erb`** — add launch device to Derek itemsHeld; add `unlock_object` reward to flag3; update archive observations; add new globals; add 0x99 event mappings
6. **`m01_phone_agent0x99.ink`** — add new vars; update debrief unlock condition
7. **`m01_closing_debrief.ink`** — add `player_launched_attack` branch
8. **Schema** (`scenario-schema.json`) — add `mode`, `onAbort`, `onLaunch` etc. to flag-station definition (low priority, for validation only)
