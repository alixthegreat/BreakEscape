# Mission 1 Climax: Launch-Abort Device Implementation Plan

## What We're Building

The climax of Mission 1 is restructured around two separate codes the player finds in the ENTROPY server:

- **Flag 3** (shatter `~/flag`) — the **archive decryption key**. Submitted at the existing Drop-Site Terminal. On success, remotely unlocks the `entropy_encrypted_archive` safe in the server room so the player can open it and read The Architect's orders.
- **Flag 4** (shatter `~/launch_code`) — the **launch authorization code**. Submitted inside the **ENTROPY Launch Device**, a portable item the player takes from Derek after the confrontation. On success, the device presents a binary choice: **ABORT** or **LAUNCH** Operation Shatter.

The debrief is offered via the Agent 0x99 phone call only after both codes have been submitted and the player has made the launch/abort choice. The closing debrief script branches on whether the player aborted or launched the attack, with a moral-weight path for launch.

---

## Flag Map

| # | Account | File | Submitted at | Purpose |
|---|---|---|---|---|
| 1 | `derek` | `~/flag` | Drop-Site Terminal | SSH brute-force evidence |
| 2 | `derek` | `~/entropy/MISSION_KEY` | Drop-Site Terminal | Linux navigation evidence |
| 3 | `shatter` | `~/flag` | Drop-Site Terminal | Archive decryption key — remotely unlocks ENTROPY archive safe |
| 4 | `shatter` | `~/launch_code` | ENTROPY Launch Device | Launch authorization — arms ABORT/LAUNCH choice |

Flags 3 and 4 are both obtained from the `shatter` account via sudo from the `derek` account.

---

## Player Flow

```
SSH brute force → [flag1] → Drop-Site
Linux navigation → [flag2] → Drop-Site
sudo to shatter → read DEPLOYMENT_CONFIG (mentions ~/flag and ~/launch_code)
                → [flag3] from ~/flag → Drop-Site
                         → reward: ENTROPY archive safe remotely unlocks
                         → player opens archive → reads Architect's Authorization + Network Architecture
                → [flag4] from ~/launch_code → held for later
Confront Derek (gate: flags 1+2+3 submitted)
Derek KO'd → launch device drops from inventory
Player picks up launch device
Player opens device from inventory → enters flag4
Hacktivity validates flag4 → device shows ABORT / LAUNCH
Player chooses → globals set → Agent 0x99 timed message
Player calls Agent 0x99 → debrief unlocked → closing cutscene
```

---

## 1. SecGen VM Scenario (`scenarios/m01_first_contact/1_intro_linux.xml`)

### 1a. `shatter` account — add `launch_code` file

Add a second `flag_generator` and filename to the shatter account. The `strings_to_leak` order matches `leaked_filenames` order, so the second generator maps to `launch_code`.

```xml
<input into="leaked_filenames">
  <value>flag</value>                                <!-- flag3: archive decryption key -->
  <value>launch_code</value>                         <!-- flag4: launch authorization code -->
  <value>operation_shatter/DEPLOYMENT_CONFIG</value>
  <value>operation_shatter/TARGET_MANIFEST</value>
</input>
<input into="strings_to_leak">
  <generator type="flag_generator" />                <!-- flag3 -->
  <generator type="flag_generator" />                <!-- flag4 -->
  <value>OPERATION SHATTER -- DEPLOYMENT CONFIGURATION
Classification: ENTROPY EYES ONLY

Infrastructure Role: Social Fabric Content Distribution Node
Cell Operator: D. Lawson (derek)
Status: ACTIVE -- Launch T-72 Hours

Message vectors loaded: 2,347,832 targeted profiles
Deployment method: Coordinated social platform injection
Launch window: Sunday 06:00 UTC

TWO AUTHORIZATION CODES REQUIRED:
  ~/flag        = ENTROPY Encrypted Archive decryption key
  ~/launch_code = Operation Shatter launch authorization code

Both codes are required for full operational access. Keep separate.
-- The Architect</value>
  <value>... TARGET_MANIFEST content unchanged ...</value>
</input>
```

---

## 2. Sprite Asset

**Action:** Copy `public/break_escape/assets/objects/tablet.png` → `public/break_escape/assets/objects/launch_device.png`

This is a placeholder for a final bespoke sprite. The launch device will use type `"flag-station"` for interaction routing but needs its own visual. See section 6 (interactions.js) for how `assetKey` overrides the sprite, or fall back to the `tablet` key if override isn't supported.

**In `public/break_escape/js/core/game.js`** (near line 406):
```js
this.load.image('launch_device', 'objects/launch_device.png');
```

---

## 3. `flag-station-minigame.js` — New `launch-abort` Mode

**File:** `public/break_escape/js/minigames/flag-station/flag-station-minigame.js`

### 3a. Constructor additions

```js
this.mode = params.mode || 'standard';
this.onAbortConfig  = params.onAbort  || null;
this.onLaunchConfig = params.onLaunch || null;
this.abortConfirmText  = params.abortConfirmText  || 'Abort the operation?';
this.launchConfirmText = params.launchConfirmText || 'Execute the operation?';
this.choiceMade = false; // prevents re-entry after choice
```

### 3b. `init()` — branch on mode

```js
init() {
    this.params.cancelText = 'Close';
    this.params.title = this.stationName;
    super.init();
    if (this.mode === 'launch-abort') {
        this.buildLaunchAbortUI();
    } else {
        this.buildUI(); // standard mode — unchanged
    }
}
```

### 3c. `buildLaunchAbortUI()`

Shows the standard flag entry UI but with launch-device theming:
- Header icon: ⚠️ (red)
- Title: "OPERATION SHATTER — ENTER LAUNCH AUTHORIZATION CODE"
- Input label: "LAUNCH AUTHORIZATION CODE" (not "Enter Flag")
- Placeholder: `flag{...}` (same format)
- No flag history section
- No VM badges / progress text

On successful flag validation by the server, the input area is replaced by `showLaunchAbortChoice()`.

### 3d. `showLaunchAbortChoice()`

Renders after flag is validated. Replaces the input area:

```
⚠  OPERATION SHATTER — ARMED
   LAUNCH WINDOW: SUNDAY 06:00 UTC

   [ ABORT OPERATION ]       [ EXECUTE LAUNCH ]
   (green border)            (red border, pulsing)
```

Both buttons trigger a `confirm()` dialog using `abortConfirmText` / `launchConfirmText` before executing.

### 3e. `handleAbort()` / `handleLaunch()`

```js
handleAbort() {
    if (this.choiceMade) return;
    if (!confirm(this.abortConfirmText)) return;
    this.choiceMade = true;
    this.applyChoiceConfig(this.onAbortConfig);
    this.showFinalState(
        'OPERATION ABORTED',
        'Abort signal transmitted. All attack vectors terminated.',
        'abort'
    );
}

handleLaunch() {
    if (this.choiceMade) return;
    if (!confirm(this.launchConfirmText)) return;
    this.choiceMade = true;
    this.applyChoiceConfig(this.onLaunchConfig);
    this.showFinalState(
        'OPERATION SHATTER — LAUNCHED',
        'Attack vector deployed. 2,347,832 targets receiving payload.',
        'launch'
    );
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

### 3f. Two new reward types in `processRewardEvents()`

**`unlock_object`** — emits an event the engine uses to remotely unlock a world object:
```js
if (reward.type === 'unlock_object' && reward.objectId) {
    window.eventDispatcher?.emit('object_remotely_unlocked', {
        objectId: reward.objectId,
        source: 'flag_reward'
    });
}
```

**`set_global`** — patches a global variable and notifies Ink:
```js
if (reward.type === 'set_global' && reward.key !== undefined) {
    if (window.gameState?.globalVariables) {
        window.gameState.globalVariables[reward.key] = reward.value;
        window.eventDispatcher?.emit(
            'global_variable_changed:' + reward.key,
            { value: reward.value }
        );
    }
}
```

---

## 4. `interactions.js` — Two Changes

**File:** `public/break_escape/js/systems/interactions.js`

### 4a. Extend flag-station params (line ~811)

The current handler passes only basic params. Extend it:

```js
if (sprite.scenarioData.type === "flag-station" || sprite.scenarioData.type === "flag_station") {
    if (window.MinigameFramework) {
        window.MinigameFramework.startMinigame('flag-station', null, {
            title:            sprite.scenarioData.name || 'Flag Submission Terminal',
            stationId:        sprite.scenarioData.id || sprite.objectId,
            stationName:      sprite.scenarioData.name,
            mode:             sprite.scenarioData.mode || 'standard',          // NEW
            flags:            sprite.scenarioData.flags || [],
            acceptsVms:       sprite.scenarioData.acceptsVms || [],
            onAbort:          sprite.scenarioData.onAbort  || null,            // NEW
            onLaunch:         sprite.scenarioData.onLaunch || null,            // NEW
            abortConfirmText: sprite.scenarioData.abortConfirmText  || null,   // NEW
            launchConfirmText:sprite.scenarioData.launchConfirmText || null,   // NEW
            submittedFlags:   window.gameState?.submittedFlags || [],
            gameId:           window.breakEscapeConfig?.gameId || window.gameConfig?.gameId
        });
        return;
    }
}
```

Note: `flagRewards` is a server concern — the server reads it from the scenario at game load and returns processed rewards in the flag submission response. The client's `processRewardEvents` handles the response's `rewards` array, not the raw `flagRewards` config.

### 4b. Add `object_remotely_unlocked` event listener

Add near the top of `setGameInstance()` alongside the existing `item_removed_from_scene` subscription (line ~21):

```js
if (window.eventDispatcher) {
    window.eventDispatcher.on('object_remotely_unlocked', ({ objectId }) => {
        Object.values(rooms).forEach(room => {
            (room.objects || []).forEach(obj => {
                const matchesId   = obj.scenarioData?.id === objectId;
                const matchesObjId = obj.objectId === objectId;
                if (matchesId || matchesObjId) {
                    obj.scenarioData.locked = false;
                    console.log('[RemoteUnlock] Object unlocked:', objectId);
                    // If a lock overlay exists on the sprite, remove it
                    if (obj.lockOverlay) {
                        obj.lockOverlay.setVisible(false);
                    }
                }
            });
        });
    });
}
```

**Important:** This walks `rooms` (all loaded rooms), so it works even if the player is in a different room from the archive. Confirm that the server room is loaded before the player can submit flag3 (they need to be in the server room to use the Drop-Site Terminal, so this should always hold).

### 4c. Sprite key for launch device (conditional)

Check whether `rooms.js` uses an `assetKey` field when loading item sprites. If it does, the scenario can specify `"assetKey": "launch_device"` and no change to `interactions.js` is needed. If not, add a type check:

In the existing lockpick / item pickup routing, add:
```js
// When flag-station type has a custom assetKey, load that texture instead
// (handled at rooms.js item creation time, not in interactions.js)
```

If `assetKey` is not supported in `rooms.js`, the simplest workaround is to give the launch device the type `"launch-device"` (distinct from `"flag-station"`) and add it to the detection condition:

```js
if (sprite.scenarioData.type === "flag-station"  ||
    sprite.scenarioData.type === "flag_station"   ||
    sprite.scenarioData.type === "launch-device") {
```

This lets `rooms.js` load `launch_device.png` for that type, while interaction routing stays the same.

---

## 5. Server-Side: Verify `itemsHeld` Flag Registration

**File:** `app/models/break_escape/game.rb` (or the scenario parser)

**Risk: HIGH** — The server registers `flagRewards` from scenario objects at game load time. If the parser only traverses `room.objects` and not NPC `itemsHeld` arrays, flag4 will never be registered and Hacktivity validation will silently reject it.

**Action before writing any other code:** Search the scenario parsing code for where `flagRewards` / `flags` are indexed. Confirm it also traverses:
- `room.npcs[].itemsHeld[]`

If it doesn't, add traversal. The fix is a few lines — iterate NPC inventories the same way as room objects.

---

## 6. `scenario.json.erb` Changes

**File:** `scenarios/m01_first_contact/scenario.json.erb`

### 6a. ENTROPY archive `observations` text update

The archive `safe` object stays as-is structurally. Update its `observations`:

```json
"observations": "A ruggedised encrypted drive in a reinforced case. Stamped: ENTROPY — EYES ONLY. The decryption key is in the shatter account on the compromised server — submit it at the drop-site terminal."
```

### 6b. Drop-Site Terminal — add rewards for flag3

The third entry in `flagRewards` (index 2, corresponding to `flag{privilege_escalation_success}` / flag3) gains two rewards alongside the existing `emit_event`:

```json
"flagRewards": [
  {
    "type": "emit_event",
    "event_name": "ssh_flag_submitted",
    "description": "SSH access flag"
  },
  {
    "type": "emit_event",
    "event_name": "navigation_flag_submitted",
    "description": "Linux navigation flag"
  },
  {
    "type": "emit_event",
    "event_name": "sudo_flag_submitted",
    "description": "Privilege escalation / archive decryption key"
  },
  {
    "type": "unlock_object",
    "objectId": "entropy_encrypted_archive",
    "description": "Archive decryption key confirmed — remotely unlocks the ENTROPY archive safe"
  }
]
```

Note the structure: each entry in `flagRewards` maps to the corresponding flag by index. If the server maps rewards by index-to-flag, the `unlock_object` entry must be at index 2 (third entry). If the server applies ALL rewards from a single matched flag, group the two flag3 rewards together. Check the server implementation to confirm the mapping model.

> **Alternative if server doesn't support multiple rewards per flag:** Wrap both in a single reward that emits `sudo_flag_submitted` and separately triggers the unlock via the event system — i.e., the `sudo_flag_submitted` event mapping on `agent_0x99` emits `object_remotely_unlocked` as a side-effect. This is messier but avoids server changes.

### 6c. Derek NPC — add launch device to `itemsHeld`

```json
{
  "type": "flag-station",
  "id": "entropy_launch_device",
  "mode": "launch-abort",
  "name": "ENTROPY Launch Device",
  "takeable": true,
  "observations": "A ruggedised tactical device. Screen: OPERATION SHATTER — ARMED. T-72 HOURS TO LAUNCH WINDOW.",
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
  "abortConfirmText": "ABORT OPERATION SHATTER?\n\nThis will terminate all active attack vectors. The attack will not proceed.",
  "launchConfirmText": "EXECUTE OPERATION SHATTER?\n\n2,347,832 people will receive simultaneous coordinated emergency disinformation.\n\nProjected casualties among vulnerable populations: medical dependency, financial anxiety, isolated elderly.\n\nThis cannot be undone."
}
```

### 6d. Agent 0x99 `eventMappings` — new entries

Add to the `agent_0x99` phone NPC's `eventMappings` array:

```json
{
  "eventPattern": "global_variable_changed:sudo_flag_submitted",
  "condition": "value === true",
  "onceOnly": true,
  "sendTimedMessage": {
    "delay": 2000,
    "message": "Decryption key confirmed. 🦎 The ENTROPY archive is unlocked — open it in the server room. And check the shatter account for a second file: the launch authorization code. You'll need it for the device Derek's carrying."
  }
},
{
  "eventPattern": "item_picked_up:entropy_launch_device",
  "onceOnly": true,
  "sendTimedMessage": {
    "delay": 1500,
    "message": "You have the launch device. 🦎 Enter the launch authorization code from the shatter account. Then you'll have a choice. Make it deliberately."
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
    "message": "...I'm seeing reports. 🦎 Hospital switchboards. Emergency lines. The attack went through. We weren't fast enough. Call me."
  }
}
```

### 6e. Global variables — add new entries

```json
"launch_code_submitted": false,
"player_aborted_attack": false,
"player_launched_attack": false,
"ready_for_debrief": false
```

### 6f. Objectives — replace `choose_resolution` task

The `close_the_case` aim currently has a `choose_resolution` custom task. Replace it:

```json
{
  "aimId": "close_the_case",
  "title": "Close the Case",
  "description": "The launch device is in your hands. Abort Operation Shatter — or let it run.",
  "status": "locked",
  "unlockCondition": { "aimsCompleted": ["return_intel", "disrupt_the_cell"] },
  "order": 8,
  "tasks": [
    {
      "taskId": "use_launch_device",
      "title": "Use the ENTROPY Launch Device",
      "type": "custom",
      "status": "active",
      "comment": "Completes when player_aborted_attack or player_launched_attack is set"
    }
  ]
}
```

The `use_launch_device` task completion is triggered by the `attack_aborted` or `attack_launched` event. Add a completion handler in the objectives manager or via an `onComplete` event mapping — confirm how custom tasks are currently completed elsewhere in the codebase.

---

## 7. Ink Script Changes

### 7a. `m01_phone_agent0x99.ink`

**Add variable declarations** at the top (with existing VAR block):
```ink
VAR player_aborted_attack = false
VAR player_launched_attack = false
VAR ready_for_debrief = false
VAR launch_code_submitted = false
```

**Update `support_hub` debrief condition:**
```ink
// REPLACE:
+ {derek_confronted and ssh_flag_submitted and linux_flag_submitted and sudo_flag_submitted} [Operation Shatter is neutralized — I'm ready to report in for debrief]
    -> closing_debrief

// WITH:
+ {derek_confronted and ssh_flag_submitted and linux_flag_submitted and sudo_flag_submitted and launch_code_submitted and (player_aborted_attack or player_launched_attack)} [Operation Shatter resolved — ready to debrief]
    -> closing_debrief
```

The `closing_debrief` knot already fires `#set_global:start_debrief_cutscene:true` — no change needed there.

### 7b. `m01_terminal_dropsite.ink`

**Update outdated "bystander" references:**

| Location | Old text | New text |
|---|---|---|
| Line ~148 | `[Player enters flag from VM - bystander account access]` | `[Player enters flag from VM - shatter account, obtained via sudo]` |
| Line ~162 | `Bystander account files reveal Derek Lawson's coordination...` | `Archive decryption key confirmed. The ENTROPY encrypted archive in this room is now unlocked. Check the shatter account for a second file: the launch authorization code.` |
| Line ~158 task unlock | `#unlock_task:confront_derek` | Keep — confrontation still unlocks on flag3 |

**Also update `flag_categories` description** (line ~47) to list the new category name:
```
- Privilege Escalation (Archive Decryption Key)
```

### 7c. `m01_closing_debrief.ink`

**Add variable declarations:**
```ink
VAR player_aborted_attack = false
VAR player_launched_attack = false
```

**Branch at `=== start ===`:**
```ink
=== start ===
{ player_launched_attack:
    -> launch_weight
- else:
    -> normal_opening
}

// ================================================
// LAUNCH PATH — MORAL WEIGHT
// ================================================

=== launch_weight ===
[SAFETYNET HQ - Agent 0x99's Office]
#speaker:agent_0x99

Agent 0x99: {player_name}. I'm going to assume Derek triggered a failsafe before you reached him.

Agent 0x99: Because the alternative — that you had the launch device in your hands, and chose not to abort — I'm not ready to go there yet.

+ [The attack went through. It was me.]
    -> launch_confession
+ [...]
    -> launch_assumption_accepted

=== launch_assumption_accepted ===
Agent 0x99: Right. Derek. Of course.

Agent 0x99: Forty-seven hospitals received simultaneous closure alerts. Three dialysis centres went dark. Eleven thousand emergency calls in the first hour.

Agent 0x99: We weren't fast enough to stop it.

Agent 0x99: Your technical work is solid — the evidence package will prosecute Derek for life.

Agent 0x99: But the people ENTROPY targeted on Sunday... some of them didn't make it.

+ [What happens now?]
    -> launch_aftermath

=== launch_confession ===
Agent 0x99: ...

Agent 0x99: I see.

+ [I froze. I don't know why.]
    -> launch_aftermath
+ [I needed to understand what it would do.]
    -> launch_aftermath
+ [I believed Derek was right.]
    -> launch_aftermath

=== launch_aftermath ===
Agent 0x99: The casualties are being assessed. Our teams are on the ground.

Agent 0x99: You completed the investigation. The evidence is there. That part of the mission succeeded.

Agent 0x99: I need to know: are you still fit for the next operation?

+ [Yes. It won't happen again.]
    -> evidence_review
+ [I'm not certain.]
    -> evidence_review

// ================================================
// NORMAL PATH (abort — or attack was stopped)
// ================================================

=== normal_opening ===
[SAFETYNET HQ - Agent 0x99's Office]
#speaker:agent_0x99

Agent 0x99: {player_name}. First, I need you to understand what you accomplished today.

// ... existing debrief continues from here unchanged ...
-> evidence_review
```

---

## 8. Implementation Order and Risk Notes

### Priority 1 — Verify before writing client code

**Check `game.rb` server-side flag registration traversal.**
The server indexes `flagRewards` at game load. Confirm it traverses `room.npcs[].itemsHeld[]` as well as `room.objects[]`. If not, flag4 will never be registered and the launch device Hacktivity validation will silently fail. This is the highest-risk unknown. Fix is a small addition to the parser.

### Priority 2 — Independent, low-risk

**`object_remotely_unlocked` event listener in `interactions.js`.**
Write and test in isolation: submit a dummy flag that returns `unlock_object`, confirm the archive safe's `scenarioData.locked` flips to `false` and the container opens on next interaction.

### Priority 3 — Engine changes

1. `flag-station-minigame.js` — add `mode`, `buildLaunchAbortUI()`, `showLaunchAbortChoice()`, `handleAbort()`, `handleLaunch()`, `applyChoiceConfig()`, `unlock_object` / `set_global` reward handlers
2. `interactions.js` — extend flag-station param forwarding; add `object_remotely_unlocked` listener
3. `game.js` — add `launch_device` image loader

### Priority 4 — Scenario content

4. `1_intro_linux.xml` — add `launch_code` file to shatter account; update `DEPLOYMENT_CONFIG` text
5. `scenario.json.erb` — add launch device to Derek; add `unlock_object` reward; update archive observations; add globals; add 0x99 event mappings; replace `choose_resolution` task

### Priority 5 — Ink scripts

6. `m01_terminal_dropsite.ink` — replace "bystander" text with "shatter" narrative; update success text for flag3
7. `m01_phone_agent0x99.ink` — add VAR declarations; update debrief unlock condition
8. `m01_closing_debrief.ink` — add VAR declarations; add `launch_weight` branch at `start`

---

## 9. Files Changed Summary

| File | Change type |
|---|---|
| `scenarios/m01_first_contact/1_intro_linux.xml` | Add `launch_code` file + second flag_generator to shatter account; update DEPLOYMENT_CONFIG text |
| `public/break_escape/assets/objects/launch_device.png` | New file (copy of tablet.png placeholder) |
| `public/break_escape/js/core/game.js` | Add `launch_device` image loader |
| `public/break_escape/js/minigames/flag-station/flag-station-minigame.js` | Add `mode`, launch-abort UI, `unlock_object`/`set_global` reward types |
| `public/break_escape/js/systems/interactions.js` | Extend flag-station param forwarding; add `object_remotely_unlocked` listener |
| `app/models/break_escape/game.rb` (or parser) | Verify/add NPC itemsHeld traversal for flag registration |
| `scenarios/m01_first_contact/scenario.json.erb` | Launch device in Derek itemsHeld; unlock_object reward; archive observations; new globals; 0x99 event mappings; replace choose_resolution task |
| `scenarios/m01_first_contact/ink/m01_terminal_dropsite.ink` | Update "bystander" → "shatter" text; update flag3 success message |
| `scenarios/m01_first_contact/ink/m01_phone_agent0x99.ink` | Add VAR declarations; update debrief condition |
| `scenarios/m01_first_contact/ink/m01_closing_debrief.ink` | Add VAR declarations; add launch_weight branch |
