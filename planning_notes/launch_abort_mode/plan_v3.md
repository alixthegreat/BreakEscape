# Mission 1 Climax: Launch-Abort Device — Implementation Plan v3

## Design Summary

Two separate codes found in the ENTROPY server (shatter account) drive the climax:

- **Flag 3** (`shatter ~/flag`) — **Archive decryption key.** Submitted at the existing Drop-Site Terminal. On success, remotely unlocks the `entropy_encrypted_archive` safe in the server room so the player can open it via the container minigame.
- **Flag 4** (`shatter ~/launch_code`) — **Launch authorization code.** Submitted inside the **ENTROPY Launch Device**, a portable item dropped by Derek after the confrontation. On success, presents ABORT / LAUNCH choice.

The debrief is offered via Agent 0x99 phone call only after both codes are submitted and the launch/abort choice has been made. The closing debrief branches on player choice.

---

## Flag Map

| # | Account | File | Submitted at | Purpose |
|---|---|---|---|---|
| 1 | `derek` | `~/flag` | Drop-Site Terminal | SSH brute-force evidence |
| 2 | `derek` | `~/entropy/MISSION_KEY` | Drop-Site Terminal | Linux navigation evidence |
| 3 | `shatter` | `~/flag` | Drop-Site Terminal | Archive decryption key — remotely unlocks ENTROPY archive safe |
| 4 | `shatter` | `~/launch_code` | ENTROPY Launch Device (in player inventory) | Launch authorization — arms ABORT/LAUNCH choice |

---

## Player Flow

```
SSH brute force         → [flag1] → Drop-Site Terminal
Linux navigation        → [flag2] → Drop-Site Terminal
sudo su - shatter       → read DEPLOYMENT_CONFIG (lists ~/flag and ~/launch_code)
                        → [flag3] from ~/flag → Drop-Site Terminal
                                 → server reward remotely unlocks ENTROPY archive safe
                                 → player opens safe → reads Architect's Authorization + Network Architecture
                        → [flag4] from ~/launch_code → held for later
Confront Derek (gate: flags 1+2+3 submitted)
Derek KO'd → launch device drops from his inventory
Player picks up launch device
Player opens device from inventory → enters flag4
Hacktivity validates flag4 → device shows ABORT / LAUNCH
Player chooses → globals set → Agent 0x99 timed phone message
Player calls Agent 0x99 → debrief option unlocked in support_hub
→ closing debrief cutscene (moral weight path if LAUNCH chosen)
```

---

## Server-Side Changes

### Server Change 1: `find_flag_station_for_flag()` — add NPC itemsHeld traversal

**File:** `app/controllers/break_escape/games_controller.rb`

**Problem confirmed from code (lines 1491–1531):** The method only searches `room['objects']`. The ENTROPY Launch Device lives in Derek's `itemsHeld`. Without this fix, flag4 will validate (it may be registered separately) but its `flagRewards` can never be looked up, so no rewards fire for the launch device.

**Fix:** After the existing room objects search block, add NPC itemsHeld traversal:

```ruby
def find_flag_station_for_flag(flag_key)
  # Primary: exact flag match in room objects
  @game.scenario_data['rooms']&.each do |_room_id, room|
    room['objects']&.each do |obj|
      next unless obj['type'] == 'flag-station'
      next unless obj['flags']&.any? { |f| f.downcase == flag_key.downcase }
      return obj
    end

    # NEW: also search flag-station items held by NPCs
    room['npcs']&.each do |npc|
      npc['itemsHeld']&.each do |held_item|
        next unless held_item['type'] == 'flag-station' || held_item['type'] == 'launch-device'
        next unless held_item['flags']&.any? { |f| f.downcase == flag_key.downcase }
        return held_item
      end
    end
  end

  # ... existing fallback code unchanged ...
end
```

### Server Change 2: `process_flag_rewards()` — add pass-through for client-side reward types

**File:** `app/controllers/break_escape/games_controller.rb`

**Problem confirmed from code (lines 1391–1423):** Unknown reward types are wrapped in `{ type: 'unknown', data: reward }`. The client receives this wrapper and can't access the inner reward data. `set_global` and `unlock_object` are client-side-only rewards that need to be forwarded as-is.

**Fix:** Add pass-through cases before the `else`:

```ruby
case reward['type']
when 'give_item'
  results << process_item_reward(reward, flag_key)
when 'unlock_door'
  results << process_door_unlock_reward(reward, flag_key)
when 'emit_event'
  results << process_event_reward(reward, flag_key)
when 'set_global', 'unlock_object'
  # Client-side-only rewards — forward as-is so processRewardEvents() can handle them
  results << reward
else
  results << { type: 'unknown', data: reward }
end
```

---

## Remote Archive Unlock Mechanism

**Problem:** The Drop-Site Terminal's `flagRewards` array uses index mapping (reward[i] → flag[i]). Each index maps to exactly one reward object. Flag3 already uses index 2 for `emit_event: sudo_flag_submitted`. We can't add a second reward at the same index without a server change.

**Solution:** Use a listener in `interactions.js`. When `sudo_flag_submitted` is emitted by the flag-station minigame's reward processing, `interactions.js` translates it into an `object_remotely_unlocked` event that finds and unlocks the archive safe. The same listener also sets `window.gameState.globalVariables.sudo_flag_submitted = true` and emits `global_variable_changed:sudo_flag_submitted`, so Ink conditions on this variable still work without a separate Ink terminal driving it.

This requires zero change to the `flagRewards` array. The existing single reward at index 2 (`emit_event: sudo_flag_submitted`) fires, and `interactions.js` reacts.

**Event flow (no Ink terminal):**
1. Player submits flag3 at the Drop-Site Terminal (flag-station minigame)
2. Server returns `{ type: 'emit_event', event: 'sudo_flag_submitted' }` reward
3. `processRewardEvents()` calls `window.eventDispatcher.emit('sudo_flag_submitted')`
4. `interactions.js` listener fires:
   - Sets `window.gameState.globalVariables.sudo_flag_submitted = true`
   - Emits `global_variable_changed:sudo_flag_submitted` (for Ink + npc-manager)
   - Emits `object_remotely_unlocked` with `objectId: 'entropy_encrypted_archive'`
5. The `object_remotely_unlocked` listener sets `scenarioData.locked = false` on the archive safe sprite

Implementation in `interactions.js` inside `setGameInstance()` (after the existing `item_removed_from_scene` listener, ~line 24):

```js
// Remote unlock: when flag3 (archive decryption key) is submitted at the drop-site,
// bridge the raw event to: global variable, global_variable_changed event, and object unlock.
window.eventDispatcher.on('sudo_flag_submitted', () => {
    // Set global so Ink conditions work (no Ink terminal to do this automatically)
    if (window.gameState?.globalVariables) {
        window.gameState.globalVariables.sudo_flag_submitted = true;
        window.eventDispatcher.emit('global_variable_changed:sudo_flag_submitted', {
            name: 'sudo_flag_submitted', value: true
        });
    }
    // Translate to object unlock for the ENTROPY archive safe
    window.eventDispatcher.emit('object_remotely_unlocked', {
        objectId: 'entropy_encrypted_archive',
        source: 'flag_reward'
    });
});
```

Note: This is a hardcoded listener for this mission. If the unlock relationship becomes a pattern across missions, move it to the scenario config (see `npc-manager.js` change in the Client Changes section for an `emitEvent` eventMappings extension that would enable scenario-driven chaining).

---

## Client-Side Changes

### Client Change 1: `npc-manager.js` — add `emitEvent` to eventMappings

**File:** `public/break_escape/js/systems/npc-manager.js`

**Problem:** The `_handleEventMapping` method (lines 430–545) supports `setGlobal`, `completeTask`, `unlockTask`, `unlockAim`, `sendTimedMessage` — but NOT `emitEvent`. This field is referenced in the plan's scenario eventMappings (e.g., chaining events from NPC reactions) and needs to exist.

**Fix:** Add after the `unlockAim` block inside `_handleEventMapping`:

```js
// Emit a custom event if specified (enables event chaining from NPC mappings)
if (config.emitEvent) {
    const payload = config.emitEventData || {};
    window.eventDispatcher?.emit(config.emitEvent, payload);
    console.log(`📡 Event emitEvent: ${config.emitEvent}`, payload);
}
```

Also add `emitEvent` and `emitEventData` to the `config` object in `_setupEventMappings` (lines 407–414):

```js
const config = {
    // ... existing fields ...
    emitEvent:     mapping.emitEvent     || null,   // NEW
    emitEventData: mapping.emitEventData || {}      // NEW
};
```

### Client Change 2: `interactions.js` — two additions

**File:** `public/break_escape/js/systems/interactions.js`

#### 2a. `object_remotely_unlocked` listener (in `setGameInstance()`, ~line 21)

```js
// Listen for remote object unlocks (e.g., when archive decryption flag is submitted)
window.eventDispatcher.on('object_remotely_unlocked', ({ objectId }) => {
    let found = false;
    Object.values(rooms).forEach(room => {
        (room.objects || []).forEach(obj => {
            if (obj.scenarioData?.id === objectId || obj.objectId === objectId) {
                obj.scenarioData.locked = false;
                if (obj.lockOverlay) obj.lockOverlay.setVisible(false);
                console.log('[RemoteUnlock] Object unlocked:', objectId);
                found = true;
            }
        });
    });
    if (!found) {
        console.warn('[RemoteUnlock] Object not found in loaded rooms:', objectId);
    }
});

// Bridge sudo_flag_submitted → global variable + global_variable_changed + object unlock.
// The flag-station emit_event reward fires the raw event; without an Ink terminal, we must
// set the global variable here so Ink conditions (e.g. phone debrief gate) still work.
window.eventDispatcher.on('sudo_flag_submitted', () => {
    if (window.gameState?.globalVariables) {
        window.gameState.globalVariables.sudo_flag_submitted = true;
        window.eventDispatcher.emit('global_variable_changed:sudo_flag_submitted', {
            name: 'sudo_flag_submitted', value: true
        });
    }
    window.eventDispatcher.emit('object_remotely_unlocked', {
        objectId: 'entropy_encrypted_archive',
        source: 'flag_reward'
    });
});
```

#### 2b. Extend flag-station params in the interaction handler (~line 811)

Replace the current handler with:

```js
if (sprite.scenarioData.type === "flag-station" ||
    sprite.scenarioData.type === "flag_station" ||
    sprite.scenarioData.type === "launch-device") {
    if (window.MinigameFramework) {
        window.MinigameFramework.startMinigame('flag-station', null, {
            title:             sprite.scenarioData.name || 'Flag Submission Terminal',
            stationId:         sprite.scenarioData.id || sprite.objectId,
            stationName:       sprite.scenarioData.name,
            mode:              sprite.scenarioData.mode || 'standard',           // NEW
            flags:             sprite.scenarioData.flags || [],
            acceptsVms:        sprite.scenarioData.acceptsVms || [],
            onAbort:           sprite.scenarioData.onAbort  || null,             // NEW
            onLaunch:          sprite.scenarioData.onLaunch || null,             // NEW
            abortConfirmText:  sprite.scenarioData.abortConfirmText  || null,    // NEW
            launchConfirmText: sprite.scenarioData.launchConfirmText || null,    // NEW
            submittedFlags:    window.gameState?.submittedFlags || [],
            gameId:            window.breakEscapeConfig?.gameId || window.gameConfig?.gameId
        });
        return;
    }
}
```

Note: `"launch-device"` added as a new type string. This allows `rooms.js` to load a different sprite for it (since sprite key = `scenarioObj.type`) while keeping the same interaction routing.

### Client Change 3: `flag-station-minigame.js` — `launch-abort` mode

**File:** `public/break_escape/js/minigames/flag-station/flag-station-minigame.js`

#### 3a. Constructor additions

Add after `this.isSubmitting = false;`:

```js
this.mode             = params.mode             || 'standard';
this.onAbortConfig    = params.onAbort          || null;
this.onLaunchConfig   = params.onLaunch         || null;
this.abortConfirmText = params.abortConfirmText  || 'Abort the operation?';
this.launchConfirmText= params.launchConfirmText || 'Execute the operation?';
this.choiceMade       = false;
```

#### 3b. `init()` — branch on mode

```js
init() {
    this.params.title = this.stationName;
    this.params.cancelText = 'Close';
    super.init();
    if (this.mode === 'launch-abort') {
        this.buildLaunchAbortUI();
    } else {
        this.buildUI();
    }
}
```

#### 3c. `buildLaunchAbortUI()`

Same structural approach as `buildUI()` but:
- Header: ⚠️ icon, red-tinted styling
- Title line: "OPERATION SHATTER — ENTER LAUNCH AUTHORIZATION CODE"
- Input label: "LAUNCH AUTHORIZATION CODE"
- Placeholder: `flag{...}`
- No VM badges section
- No flag history section
- Same `flag-input`, `flag-submit-btn`, `flag-result`, `reward-notification` element IDs (reuse `attachEventHandlers()` and `submitFlag()` unchanged)

On successful flag submission, after the standard success flow, call `this.showLaunchAbortChoice()`.

#### 3d. Hook into `submitFlag()` success path

After `this.updateFlagHistory()` and reward processing, add:

```js
if (this.mode === 'launch-abort' && !this.choiceMade) {
    setTimeout(() => this.showLaunchAbortChoice(), 800);
}
```

#### 3e. `showLaunchAbortChoice()`

Replace input area content with ABORT/LAUNCH buttons:

```js
showLaunchAbortChoice() {
    const inputContainer = this.gameContainer.querySelector('.flag-input-container');
    if (!inputContainer) return;

    inputContainer.innerHTML = `
        <div class="launch-abort-armed" style="text-align:center; margin: 20px 0;">
            <div style="color:#ff4444; font-size:16px; margin-bottom:8px; animation: blink 1s infinite;">
                ⚠ ARMED — LAUNCH WINDOW: SUNDAY 06:00 UTC
            </div>
            <div style="display:flex; gap:20px; justify-content:center; margin-top:20px;">
                <button id="abort-btn" style="
                    background:#004400; border:2px solid #00ff00; color:#00ff00;
                    padding:15px 30px; font-family:'Press Start 2P',monospace;
                    font-size:11px; cursor:pointer; min-width:160px;">
                    ABORT OPERATION
                </button>
                <button id="launch-btn" style="
                    background:#440000; border:2px solid #ff4444; color:#ff4444;
                    padding:15px 30px; font-family:'Press Start 2P',monospace;
                    font-size:11px; cursor:pointer; min-width:160px;
                    animation: pulse-border 1.5s infinite;">
                    EXECUTE LAUNCH
                </button>
            </div>
        </div>`;

    this.addEventListener(
        this.gameContainer.querySelector('#abort-btn'), 'click', () => this.handleAbort()
    );
    this.addEventListener(
        this.gameContainer.querySelector('#launch-btn'), 'click', () => this.handleLaunch()
    );
}
```

#### 3f. `handleAbort()` / `handleLaunch()`

```js
handleAbort() {
    if (this.choiceMade) return;
    if (!confirm(this.abortConfirmText)) return;
    this.choiceMade = true;
    this.applyChoiceConfig(this.onAbortConfig);
    this.showFinalState('OPERATION ABORTED', 'Abort signal transmitted. All attack vectors terminated.', '#00ff00');
}

handleLaunch() {
    if (this.choiceMade) return;
    if (!confirm(this.launchConfirmText)) return;
    this.choiceMade = true;
    this.applyChoiceConfig(this.onLaunchConfig);
    this.showFinalState('OPERATION LAUNCHED', 'Attack vector deployed. 2,347,832 targets receiving payload.', '#ff4444');
}

applyChoiceConfig(config) {
    if (!config) return;
    if (config.setGlobal && window.gameState?.globalVariables) {
        Object.assign(window.gameState.globalVariables, config.setGlobal);
        for (const [key, value] of Object.entries(config.setGlobal)) {
            window.eventDispatcher?.emit(`global_variable_changed:${key}`, { name: key, value });
        }
    }
    if (config.emitEvent) {
        window.eventDispatcher?.emit(config.emitEvent, { source: 'launch_device' });
    }
}

showFinalState(title, message, color) {
    const inputContainer = this.gameContainer.querySelector('.flag-input-container');
    if (!inputContainer) return;
    inputContainer.innerHTML = `
        <div style="text-align:center; padding:20px; color:${color}; font-size:14px;">
            <div style="font-size:18px; margin-bottom:12px;">${title}</div>
            <div style="color:#888;">${message}</div>
        </div>`;
}
```

#### 3g. New reward types in `processRewardEvents()`

Add inside the `for` loop, after the existing `complete_task` handler:

```js
// unlock_object: emits an event for interactions.js to unlock a world object
if (reward.type === 'unlock_object' && reward.objectId) {
    window.eventDispatcher?.emit('object_remotely_unlocked', {
        objectId: reward.objectId,
        source: 'flag_reward'
    });
}

// set_global: patches a global variable and notifies Ink / event listeners
if (reward.type === 'set_global' && reward.key !== undefined) {
    if (window.gameState?.globalVariables) {
        window.gameState.globalVariables[reward.key] = reward.value;
        window.eventDispatcher?.emit(`global_variable_changed:${reward.key}`, {
            name: reward.key,
            value: reward.value
        });
    }
}
```

### Client Change 4: Sprite asset

**Action:** `cp public/break_escape/assets/objects/tablet.png public/break_escape/assets/objects/launch-device.png`

The sprite key is `launch-device` (matching `scenarioObj.type`). `rooms.js` uses `scenarioObj.type` directly as the Phaser texture key. Naming the file `launch-device.png` and using type `"launch-device"` in the scenario makes it load automatically via the existing asset loader if `launch-device` is added to `game.js`:

**In `game.js`** (near line 406):
```js
this.load.image('launch-device', 'objects/launch-device.png');
```

---

## Scenario Changes

### `scenarios/m01_first_contact/1_intro_linux.xml`

Add `launch_code` filename and second `flag_generator` to the shatter account. The `strings_to_leak` / `leaked_filenames` arrays are positional — new entries must be added in matching order.

The updated DEPLOYMENT_CONFIG text (third string in `strings_to_leak`) must name both files:

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

Both are required for full operational access. Do not combine.
-- The Architect</value>
  <value>... TARGET_MANIFEST content unchanged ...</value>
</input>
```

### `scenarios/m01_first_contact/scenario.json.erb`

#### A. ENTROPY archive `observations` (line ~1598)

```json
"observations": "A ruggedised encrypted drive in a reinforced case. Stamped: ENTROPY — EYES ONLY. Submit the archive decryption key from the shatter account at the drop-site terminal to unlock it."
```

#### B. Derek NPC — add `itemsHeld` with launch device

Derek's NPC definition (break_room, ~line 931) currently has no `itemsHeld`. Add:

```json
"itemsHeld": [
  {
    "type": "launch-device",
    "id": "entropy_launch_device",
    "mode": "launch-abort",
    "name": "ENTROPY Launch Device",
    "takeable": true,
    "observations": "A ruggedised tactical device. Screen: OPERATION SHATTER — ARMED. T-72 HOURS TO LAUNCH WINDOW.",
    "acceptsVms": ["intro_to_linux_security_lab"],
    "flags": <%= flags_for_vm('intro_to_linux_security_lab', ['flag{launch_authorization_code}']) %>,
    "flagRewards": [
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
    "launchConfirmText": "EXECUTE OPERATION SHATTER?\n\n2,347,832 people will receive simultaneous coordinated emergency disinformation.\n\nProjected casualties among vulnerable populations.\n\nThis cannot be undone."
  }
]
```

Note: `flagRewards` here has a single `set_global` reward (not `emit_event`). The `onAbort`/`onLaunch` configs handle the events client-side via `applyChoiceConfig()`, so no `emit_event` reward is needed. The `launch_code_submitted` global is set server-side via the pass-through reward (Server Change 2) and client-side via `processRewardEvents`.

#### C. Agent 0x99 `eventMappings` — new entries

Add to the `agent_0x99` phone NPC's `eventMappings` array:

```json
{
  "eventPattern": "global_variable_changed:sudo_flag_submitted",
  "condition": "value === true",
  "onceOnly": true,
  "sendTimedMessage": {
    "delay": 2000,
    "message": "Decryption key confirmed. 🦎 The ENTROPY archive is unlocked — open it in the server room. The shatter account has a second file: ~/launch_code. That's the authorization code for Derek's device. Find it before you confront him."
  }
},
{
  "eventPattern": "item_picked_up:entropy_launch_device",
  "onceOnly": true,
  "sendTimedMessage": {
    "delay": 1500,
    "message": "You have the launch device. 🦎 Enter the launch authorization code from ~/launch_code in the shatter account. Then you'll have a choice to make."
  }
},
{
  "eventPattern": "attack_aborted",
  "onceOnly": true,
  "completeTask": "use_launch_device",
  "sendTimedMessage": {
    "delay": 2000,
    "message": "Abort confirmed. Operation Shatter is dead. 🦎 Both codes secured. Call me when you're ready to debrief."
  }
},
{
  "eventPattern": "attack_launched",
  "onceOnly": true,
  "completeTask": "use_launch_device",
  "sendTimedMessage": {
    "delay": 4000,
    "message": "...I'm seeing reports. 🦎 Hospital switchboards. Emergency lines flooded. The attack went through. Call me."
  }
}
```

Note: `completeTask: "use_launch_device"` is added to both `attack_aborted` and `attack_launched` mappings. The npc-manager's `_handleEventMapping` already supports `completeTask` (confirmed in code, line 534–540).

Also update the existing `sudo_flag_submitted` eventMapping (which currently sends a message about the passphrase being `7331`) — replace its message with the new one above, or remove the old entry if it references `7331`.

#### D. `close_the_case` aim — replace `choose_resolution` task

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
      "status": "active"
    }
  ]
}
```

Task completion is handled by `completeTask: "use_launch_device"` in the `attack_aborted` and `attack_launched` eventMappings above.

#### E. New `globalVariables`

Add to the `globalVariables` section:

```json
"launch_code_submitted": false,
"player_aborted_attack": false,
"player_launched_attack": false,
"ready_for_debrief": false
```

Also remove `7331` reference: search for `"7331"` in the archive safe's `requires` field and update `observations` as in section A above.

---

## Ink Script Changes

### `scenarios/m01_first_contact/ink/m01_phone_agent0x99.ink`

**Add VAR declarations** after line 25 (existing `VAR sudo_flag_submitted = false`):

```ink
VAR player_aborted_attack = false
VAR player_launched_attack = false
VAR ready_for_debrief = false
VAR launch_code_submitted = false
```

**Line 84** — replace `support_hub` debrief condition:

```ink
// OLD:
+ {derek_confronted and ssh_flag_submitted and linux_flag_submitted and sudo_flag_submitted} [Operation Shatter is neutralized — I'm ready to report in for debrief]

// NEW:
+ {derek_confronted and ssh_flag_submitted and linux_flag_submitted and sudo_flag_submitted and launch_code_submitted and (player_aborted_attack or player_launched_attack)} [Operation Shatter resolved — I'm ready for debrief]
```

The `closing_debrief` knot and its `#set_global:start_debrief_cutscene:true` are unchanged.

### `scenarios/m01_first_contact/ink/m01_closing_debrief.ink`

**Add VAR declarations** after line 24 (existing `VAR framing_evidence_seen = false`):

```ink
VAR player_aborted_attack = false
VAR player_launched_attack = false
```

**Replace `=== start ===` knot** (lines 41–47):

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

Agent 0x99: Because the alternative — that you had the launch device in your hands, and chose not to abort — I'm not prepared to consider that yet.

+ [The attack went through. It was me.]
    -> launch_confession
+ [...]
    -> launch_assumed_derek

=== launch_assumed_derek ===
Agent 0x99: Right. Derek. Of course.

Agent 0x99: Forty-seven hospitals received simultaneous closure alerts. Three dialysis centres. Eleven thousand emergency calls in the first hour.

Agent 0x99: We weren't fast enough.

Agent 0x99: Your technical work is solid. The evidence package will prosecute Derek for life.

Agent 0x99: But we weren't able to stop the attack in time.

+ [What happens to the people who were hurt?]
    -> launch_aftermath
+ [What happens now?]
    -> launch_aftermath

=== launch_confession ===
Agent 0x99: ...

Agent 0x99: I see.

+ [I froze. I don't know why.]
    -> launch_aftermath
+ [I wanted to understand what would happen.]
    -> launch_aftermath
+ [Derek was right. People needed to learn.]
    Agent 0x99: Then you and I have very different ideas about what this job is for.
    Agent 0x99: We'll talk again. After I've had time to think about what to do with that.
    -> launch_aftermath

=== launch_aftermath ===
Agent 0x99: The casualties are being assessed. Our teams are on the ground.

Agent 0x99: The technical evidence is there. That part of the mission succeeded.

Agent 0x99: I need to ask you something, and I need you to answer honestly.

Agent 0x99: Are you still fit for the next operation?

+ [Yes. It won't happen again.]
    -> evidence_review
+ [I'm not certain.]
    -> evidence_review

// ================================================
// NORMAL OPENING — abort path or attack stopped
// ================================================

=== normal_opening ===
[SAFETYNET HQ - Agent 0x99's Office]
#speaker:agent_0x99

Agent 0x99: {player_name}. First, I need you to understand what you accomplished today.

Agent 0x99: Those casualty projections — 42 to 85 people. Diabetics. Elderly. People with anxiety disorders.

Agent 0x99: They're going to live. Because of you.

+ [That's what matters]
    -> evidence_review
+ [It was close. Too close.]
    -> close_call
```

The rest of `m01_closing_debrief.ink` from `=== evidence_review ===` onward is unchanged.

---

## Files Changed Summary

| File | Change | Server/Client |
|---|---|---|
| `scenarios/m01_first_contact/1_intro_linux.xml` | Add `launch_code` file + second `flag_generator` to shatter; update DEPLOYMENT_CONFIG text | Config |
| `app/controllers/break_escape/games_controller.rb` | `find_flag_station_for_flag()`: add NPC itemsHeld traversal | Server |
| `app/controllers/break_escape/games_controller.rb` | `process_flag_rewards()`: add `set_global`/`unlock_object` pass-through cases | Server |
| `public/break_escape/assets/objects/launch-device.png` | New file (copy of tablet.png — placeholder) | Asset |
| `public/break_escape/js/core/game.js` | Add `launch-device` image loader | Client |
| `public/break_escape/js/systems/npc-manager.js` | `_setupEventMappings` + `_handleEventMapping`: add `emitEvent`/`emitEventData` support | Client |
| `public/break_escape/js/systems/interactions.js` | Flag-station handler: add `mode`, `onAbort`, `onLaunch` params + `"launch-device"` type; `sudo_flag_submitted` bridge (sets globalVariables, emits `global_variable_changed`, emits `object_remotely_unlocked`); `object_remotely_unlocked` listener | Client |
| `public/break_escape/js/minigames/flag-station/flag-station-minigame.js` | Add `mode`, `launch-abort` UI, `applyChoiceConfig`, `unlock_object`/`set_global` reward handlers | Client |
| `scenarios/m01_first_contact/scenario.json.erb` | Archive observations; Derek `itemsHeld` with launch device; new agent_0x99 event mappings; replace `choose_resolution` task; add 4 global variables; remove `7331` reference | Config |
| `scenarios/m01_first_contact/ink/m01_phone_agent0x99.ink` | Add 4 VAR declarations; update debrief condition | Content |
| `scenarios/m01_first_contact/ink/m01_closing_debrief.ink` | Add 2 VAR declarations; add `launch_weight` branch at `start` | Content |

---

## Implementation Order

**Step 1 — Server (unblock everything else)**
1. `games_controller.rb`: `find_flag_station_for_flag()` NPC traversal
2. `games_controller.rb`: `process_flag_rewards()` pass-through cases
3. Test: submit a dummy flag from an NPC-held flag-station; confirm rewards return correctly

**Step 2 — Assets**
4. Copy `tablet.png` → `launch-device.png`
5. `game.js`: add image loader

**Step 3 — Core engine changes**
6. `npc-manager.js`: add `emitEvent`/`emitEventData` to eventMappings
7. `interactions.js`: extend flag-station handler params; add `"launch-device"` type; add two event listeners
8. `flag-station-minigame.js`: add mode, launch-abort UI, reward handlers

**Step 4 — Scenario content**
9. `1_intro_linux.xml`: add `launch_code` file + second flag_generator
10. `scenario.json.erb`: archive observations, Derek itemsHeld, agent_0x99 event mappings, task replacement, globals

**Step 5 — Ink**
11. `m01_phone_agent0x99.ink`: VAR declarations + debrief condition
12. `m01_closing_debrief.ink`: VAR declarations + `launch_weight` branch
