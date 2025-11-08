# Global Ink Variables - Testing Guide

## Quick Start Test

### Prerequisites
- Open the game with the `npc-sprite-test2.json` scenario
- Browser console open (F12)

### Test 1: Basic Functionality

1. **Verify Initial State**
   ```javascript
   console.log(window.gameState.globalVariables);
   // Should show: { player_joined_organization: false }
   ```

2. **Start conversation with test_npc_back**
   - Click on the back NPC in test_room
   - Follow the conversation through to "player_closing"

3. **Make the Join Choice**
   - Select "I'd love to join your organization!"
   - Observe NPC response

4. **Check Global State**
   ```javascript
   console.log(window.gameState.globalVariables.player_joined_organization);
   // Should now be: true
   ```

### Test 2: Cross-NPC Syncing

1. **Start conversation with container_test_npc (Equipment Officer)**
   - Click on the equipment officer NPC
   - Start conversation

2. **Observe Menu Options**
   - If you joined in Test 1, you should see:
     - "Tell me about your equipment"
     - **"Show me what you have available"** ← This should appear!
     - "Show me your specialist items"
   - If you didn't join, only the specialist items option appears

3. **Verify Variable Synced**
   ```javascript
   console.log(window.gameState.globalVariables.player_joined_organization);
   // Still true from previous conversation!
   ```

### Test 3: Direct Phaser Access

1. **Open Console**

2. **Directly Set Variable**
   ```javascript
   window.gameState.globalVariables.player_joined_organization = false;
   ```

3. **Start new conversation with Equipment Officer**
   - Full inventory option should now be GONE
   - Only specialist items option appears

4. **Set Back to True**
   ```javascript
   window.gameState.globalVariables.player_joined_organization = true;
   ```

5. **Start conversation again**
   - Full inventory option should reappear

### Test 4: State Persistence

1. **Join organization** (if not already done)
   - Complete the test_npc_back conversation
   - Choose to join

2. **Talk to Equipment Officer**
   - Verify full inventory option is available

3. **End conversation**
   - Close the minigame

4. **Reload the page** (F5)
   - Wait for game to fully load

5. **Check Global State**
   ```javascript
   console.log(window.gameState.globalVariables.player_joined_organization);
   // Should still be true!
   ```

6. **Talk to Equipment Officer again**
   - Full inventory option should still appear

## Debugging Checks

### Verify Scenario Loaded

```javascript
console.log(window.gameScenario.globalVariables);
// Should show: { player_joined_organization: false }
```

### Check All Global Variables

```javascript
console.log('Global Variables:', window.gameState.globalVariables);
console.log('NPC Cache:', Array.from(window.npcManager.inkEngineCache.keys()));
console.log('Saved States:', window.npcConversationStateManager.getSavedNPCs());
```

### Check Variable Change Events

Add this before starting a conversation:

```javascript
// Temporarily enable verbose logging
window.npcConversationStateManager._log = (level, msg, data) => {
    console.log(`[${level}]`, msg, data);
};
```

Then start a conversation and watch the console for variable sync messages.

### Verify Ink Variable Names

```javascript
// Check what variables are in test2.ink story
const test2Engine = window.npcManager.inkEngineCache.get('test_npc_back');
if (test2Engine?.story?.variablesState?._defaultGlobalVariables) {
    console.log('test2.ink variables:', 
        Array.from(test2Engine.story.variablesState._defaultGlobalVariables.keys()));
}

// Check equipment officer
const eqEngine = window.npcManager.inkEngineCache.get('container_test_npc');
if (eqEngine?.story?.variablesState?._defaultGlobalVariables) {
    console.log('equipment-officer.ink variables:', 
        Array.from(eqEngine.story.variablesState._defaultGlobalVariables.keys()));
}
```

## Expected Console Output

When everything is working correctly, you should see messages like:

```
🌐 Initialized global variables: {player_joined_organization: false}
✅ Synced player_joined_organization = false to story
🔍 Auto-discovered global variable: player_joined_organization = false
🌐 Global variable changed: player_joined_organization = true (from test_npc_back)
📡 Broadcasted player_joined_organization = true to container_test_npc
✅ Restored global variables: {player_joined_organization: true}
```

## Common Issues & Solutions

### Issue: Full inventory option never appears

**Check:**
1. Did you actually choose "Join organization"?
   ```javascript
   console.log(window.gameState.globalVariables.player_joined_organization);
   ```

2. Did the Equipment Officer conversation load?
   ```javascript
   console.log(window.npcManager.inkEngineCache.has('container_test_npc'));
   ```

3. Are the stories properly synced?
   ```javascript
   const eqStory = window.npcManager.inkEngineCache.get('container_test_npc').story;
   console.log('Eq Officer has variable:', eqStory.variablesState.GlobalVariableExistsWithName('player_joined_organization'));
   console.log('Value:', eqStory.variablesState['player_joined_organization']);
   ```

### Issue: Variable resets on page reload

**Check:**
1. Was state actually saved?
   ```javascript
   console.log(window.npcConversationStateManager.getNPCState('test_npc_back'));
   ```

2. Does saved state have global snapshot?
   ```javascript
   const state = window.npcConversationStateManager.getNPCState('test_npc_back');
   console.log('Global snapshot:', state?.globalVariablesSnapshot);
   ```

### Issue: Changes not syncing to other NPCs

**Check:**
1. Are multiple stories loaded?
   ```javascript
   console.log('Loaded stories:', Array.from(window.npcManager.inkEngineCache.keys()));
   ```

2. Does the variable exist in both stories?
   ```javascript
   // Check each story's variables
   window.npcManager.inkEngineCache.forEach((engine, id) => {
       const exists = engine.story.variablesState.GlobalVariableExistsWithName('player_joined_organization');
       console.log(`${id}: has player_joined_organization =`, exists);
   });
   ```

## Advanced Testing

### Test Auto-Discovery of global_* Variables

1. Create a new Ink file with:
   ```ink
   VAR global_test_flag = false
   ```

2. Add it to an NPC in scenario

3. Load that NPC's conversation

4. Check console:
   ```javascript
   console.log(window.gameState.globalVariables);
   // Should auto-discover: { player_joined_organization: false, global_test_flag: false }
   ```

### Test Modifying from Phaser Code

1. Get reference to game code:
   ```javascript
   // In Phaser scene, emit an event
   window.dispatchEvent(new CustomEvent('player-achievement', { 
       detail: { achievement: 'joined_org' } 
   }));
   
   // In listener code:
   window.addEventListener('player-achievement', (e) => {
       window.gameState.globalVariables.player_joined_organization = true;
   });
   ```

2. Start new NPC conversation

3. Verify variable is synced

### Test Multiple Global Variables

1. Update `npc-sprite-test2.json`:
   ```json
   "globalVariables": {
     "player_joined_organization": false,
     "reputation": 0,
     "quest_stage": 0
   }
   ```

2. Add to Ink files:
   ```ink
   VAR player_joined_organization = false
   VAR reputation = 0
   VAR quest_stage = 0
   ```

3. Use in conditionals:
   ```ink
   {reputation >= 5:
     You're well known around here
   }
   ```

4. Test syncing multiple variables at once

## Success Criteria

✅ Initial state loads with correct defaults
✅ Variable changes persist in window.gameState
✅ Changes sync to other loaded stories in real-time
✅ Menu options conditionally appear based on variables
✅ State persists across page reloads
✅ Console shows appropriate sync messages
✅ No errors in browser console
✅ Multiple variables can be managed simultaneously

## Performance Notes

The system is optimized for:
- **Few global variables** (< 50 per scenario) ✅
- **Multiple NPCs** (handles all loaded stories) ✅
- **Event-driven syncing** (only syncs on change) ✅
- **No circular loops** (prevents infinite propagation) ✅

If testing with > 100 global variables, monitor console for any performance impact.


