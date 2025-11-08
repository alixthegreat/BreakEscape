# Ink Story Writing Best Practices for Break Escape

## Speaker Tags - Critical for Dialogue Attribution

Every dialogue block in Break Escape Ink stories must include a speaker tag comment. This tells the game engine WHO is speaking so it displays the correct character portrait and name.

### Speaker Tag Format

```ink
=== dialogue_block ===
# speaker:npc
This dialogue comes from the main NPC being talked to
```

### Tag Types

| Tag Format | Usage | Example |
|-----------|-------|---------|
| `# speaker:npc` | Main NPC in single-NPC conversation | `# speaker:npc` |
| `# speaker:player` | Player speaking | `# speaker:player` |
| `# speaker:npc:sprite_id` | Specific character in multi-NPC scene | `# speaker:npc:test_npc_back` |

### Missing Tags? They Default Correctly!

**Important**: If a speaker tag is MISSING, the dialogue automatically attributes to the main NPC. This means:

- **Single-NPC conversations** can omit tags (simpler Ink)
- **Multi-character conversations** MUST include tags to show who's speaking
- **Player dialogue** can be explicitly tagged or inferred

### Examples

#### Single-Character (Tags Optional)
```ink
=== hub ===
I'm here to help you progress.
What can I do for you?
-> hub
```
↑ Both lines default to the main NPC (this.npc.id)

#### Single-Character (Tags Explicit)
```ink
=== hub ===
# speaker:npc
I'm here to help you progress.
# speaker:npc
What can I do for you?
-> hub
```
↑ Same result, but more explicit

#### Multi-Character (Tags Required!)
```ink
=== meeting ===
# speaker:npc:test_npc_back
Hey, meet my colleague from the back office.

# speaker:npc:test_npc_front
Nice to meet you! I manage the backend systems.

# speaker:player
That sounds interesting.

# speaker:npc:test_npc_back
We work great together!
```
↑ Tags MUST be present so the correct portraits appear

### Technical Implementation

The game engine uses these tags to:

1. **Determine which character portrait to show** - Main NPC or secondary character
2. **Set the speaker label** - Shows character name above dialogue
3. **Style the dialogue bubble** - NPC vs Player styling
4. **Track multi-character conversations** - Knows who said what when

**Code location**: `js/minigames/person-chat/person-chat-minigame.js` → `determineSpeaker()` and `createDialogueBlocks()`

---

## Core Design Pattern: Hub-Based Conversations

Break Escape conversations follow a **hub-based loop** pattern where NPCs provide repeatable interactions without hard endings.

### Why Hub-Based?

1. **State Persistence** - Variables (favour, items earned, flags) accumulate naturally across multiple interactions
2. **Dynamic Content** - Use Ink conditionals to show different options based on player progress
3. **Continuous Evolution** - NPCs can "remember" conversations and respond differently
4. **Educational Flow** - Mirrors real learning where concepts build on each other

## Standard Ink Structure

### Template

```ink
VAR npc_name = "NPC"
VAR favour = 0
VAR has_learned_about_passwords = false

=== start ===
# speaker:npc
~ favour += 1
{npc_name}: Hello! What would you like to know?
-> hub

=== hub ===
* [Ask about passwords]
  ~ has_learned_about_passwords = true
  ~ favour += 1
  -> ask_passwords
* [Make small talk]
  -> small_talk
* [Leave] #exit_conversation
  # speaker:npc
  {npc_name}: See you around!
  -> hub

=== ask_passwords ===
# speaker:npc
{npc_name}: Passwords should be...
-> hub

=== small_talk ===
# speaker:npc
{npc_name}: Nice weather we're having.
-> hub
```

### Key Points

1. **Hub Section**: Central "choice point" that always loops back
2. **Exit Choice**: Include a "Leave" option with `#exit_conversation` tag
3. **Variables**: Increment favour/flags on meaningful choices
4. **No Hard END**: Avoid `-> END` for loop-based conversations

## Exit Strategy: `#exit_conversation` Tag

### What It Does

When a player selects a choice tagged with `#exit_conversation`:
1. The dialogue plays normally
2. After the NPC response, the minigame closes automatically
3. All conversation state (variables, progress) is saved
4. Player returns to the game world

### Usage

```ink
+ [I need to go] #exit_conversation
  {npc_name}: Okay, come back anytime!
  -> hub
```

### Important

- The NPC still responds to the choice
- Variables continue to accumulate
- Story state is saved with all progression
- On next conversation, story picks up from where it left off

## Handling Repeated Interactions

Break Escape uses Ink's built-in features to manage menu options across multiple conversations.

### Pattern 1: Remove Option After First Visit (`once`)

Use `once { }` to show a choice only the first time:

```ink
=== hub ===
once {
  * [Introduce yourself]
      -> introduction
}
+ [Leave] #exit_conversation
  -> hub
```

**Result:**
- 1st visit: "Introduce yourself" appears
- 2nd+ visits: "Introduce yourself" is hidden

### Pattern 2: Change Menu Text on Repeat (`sticky`)

Use `sticky { }` with conditionals to show different options:

```ink
VAR asked_question = false

=== hub ===
sticky {
  + {asked_question: [Remind me about that question]}
      -> question_reminder
  + {not asked_question: [Ask a question]}
      -> question
}
+ [Leave] #exit_conversation -> hub

=== question ===
~ asked_question = true
NPC: Here's the answer...
-> hub

=== question_reminder ===
NPC: As I said before...
-> hub
```

**Result:**
- 1st visit: "Ask a question"
- 2nd+ visits: "Remind me about that question"

### Pattern 3: Show Different Content Based on Progress

Use variable conditionals anywhere:

```ink
VAR favour = 0
VAR has_learned_x = false

=== hub ===
+ {favour < 5: [Ask politely]}
    ~ favour += 1
    -> polite_ask
+ {favour >= 5: [Ask as a friend]}
    ~ favour += 2
    -> friend_ask
+ [Leave] #exit_conversation -> hub
```

### Combining Patterns

```ink
VAR asked_quest = false
VAR quest_complete = false

=== hub ===
// This option appears only once
once {
  * [You mentioned a quest?]
      ~ asked_quest = true
      -> quest_explanation
}

// These options change based on state
sticky {
  + {asked_quest and not quest_complete: [Any progress on that quest?]}
      -> quest_progress
  + {quest_complete: [Quest complete! Any rewards?]}
      -> quest_rewards
}

+ [Leave] #exit_conversation -> hub
```

### How Variables Persist

Variables are automatically saved and restored:

```ink
VAR conversation_count = 0

=== start ===
~ conversation_count += 1
NPC: This is conversation #{conversation_count}
-> hub
```

**Session 1:** conversation_count = 1  
**Session 2:** conversation_count = 2 (starts at 1, increments to 2)  
**Session 3:** conversation_count = 3  

The variable keeps incrementing across all conversations!

## State Saving Strategy

### Automatic Saving

- State saves **immediately after each choice** is made
- Variables persist across multiple conversations
- No manual save required

### What Gets Saved

```javascript
{
  storyState: "...",          // Full Ink state (for resuming mid-conversation)
  variables: { favour: 5 },   // Extracted variables (used when restarting)
  timestamp: 1699207400000    // When it was saved
}
```

### Resumption Behavior

1. **Mid-Conversation Resume** (has `storyState`)
   - Story picks up exactly where it left off
   - Full narrative context preserved
   
2. **After Hard END** (only `variables`)
   - Story restarts from `=== start ===`
   - Variables are pre-loaded
   - Conditionals can show different options based on prior interactions

## Advanced Patterns

### Favour/Reputation System

```ink
VAR favour = 0

=== hub ===
{favour >= 5:
  + [You seem to like me...]
    ~ favour += 1
    -> compliment_response
}
+ [What's up?]
    ~ favour += 1
    -> greeting
+ [Leave] #exit_conversation
    -> hub
```

### Unlocking Questlines

```ink
VAR has_quest = false
VAR quest_complete = false

=== hub ===
{not has_quest:
  + [Do you need help?]
    ~ has_quest = true
    -> offer_quest
}
{has_quest and not quest_complete:
  + [Is the quest done?]
    -> check_quest
}
* [Leave] #exit_conversation
    -> hub
```

### Dialogue That Changes Based on Progress

```ink
=== greet ===
{conversation_count == 1:
  {npc_name}: Oh, a new face! I'm {npc_name}.
}
{conversation_count == 2:
  {npc_name}: Oh, you're back! Nice to see you again.
}
{conversation_count > 2:
  {npc_name}: Welcome back, my friend! How are you doing?
}
-> hub
```

## Anti-Patterns (Avoid These)

❌ **Hard Endings Without Hub**
```ink
=== conversation ===
{npc_name}: That's all I have to say.
-> END
```
*Problem: Player can't interact again, variables become stuck*

❌ **Showing Same Option Repeatedly**
```ink
=== hub ===
+ [Learn about X] -> learn_x
+ [Learn about X] -> learn_x  // This appears EVERY time!
```
*Better: Use `once { }` or `sticky { }` with conditionals*

❌ **Forgetting to Mark Topics as Visited**
```ink
=== hub ===
+ [Ask about passwords]
    -> ask_passwords

=== ask_passwords ===
NPC: Passwords should be strong...
-> hub
```
*Problem: Player sees "Ask about passwords" every time*

*Better: Track it with a variable*
```ink
VAR asked_passwords = false

=== ask_passwords ===
~ asked_passwords = true
NPC: Passwords should be strong...
-> hub
```

❌ **Mixing Exit and END**
```ink
=== hub ===
+ [Leave] #exit_conversation
  -> END
```
*Problem: Confused state logic. Use `#exit_conversation` OR `-> END`, not both*

❌ **Conditional Without Variable**
```ink
=== hub ===
+ {talked_before: [Remind me]}  // 'talked_before' undefined!
    -> reminder
```
*Better: Define the variable first*
```ink
VAR talked_before = false

=== ask_something ===
~ talked_before = true
-> hub
```

## Debugging

### Check Saved State

```javascript
// In browser console
window.npcConversationStateManager.getNPCState('npc_id')
```

### Clear State (Testing)

```javascript
window.npcConversationStateManager.clearNPCState('npc_id')
```

### View All NPCs with Saved State

```javascript
window.npcConversationStateManager.getSavedNPCs()
```

## Testing Your Ink Story

1. **First Interaction**: Variables should start at defaults
2. **Make a Choice**: Favour/flags should increment
3. **Exit**: Should save all variables
4. **Return**: Should have same favour, new options may appear
5. **Hard END (if used)**: Should only save variables, restart fresh

## Real-World Example: Security Expert NPC

Here's a complete example showing all techniques combined:

```ink
VAR expert_name = "Security Expert"
VAR favour = 0

VAR learned_passwords = false
VAR learned_phishing = false
VAR learned_mfa = false

VAR task_given = false
VAR task_complete = false

=== start ===
~ favour += 1
{expert_name}: Welcome back! Good to see you again.
-> hub

=== hub ===
// Introduction - appears only once
once {
  * [I'd like to learn about cybersecurity]
      -> introduction
}

// Password topic - changes on repeat
sticky {
  + {learned_passwords: [Tell me more about password security]}
      -> passwords_advanced
  + {not learned_passwords: [How do I create strong passwords?]}
      -> learn_passwords
}

// Phishing topic - only shows after passwords are learned
{learned_passwords:
  sticky {
    + {learned_phishing: [Any new phishing threats?]}
        -> phishing_update
    + {not learned_phishing: [What about phishing attacks?]}
        -> learn_phishing
  }
}

// MFA topic - conditional unlock
{learned_passwords and learned_phishing:
  sticky {
    + {learned_mfa: [More about multi-factor authentication?]}
        -> mfa_advanced
    + {not learned_mfa: [I've heard about multi-factor authentication...]}
        -> learn_mfa
  }
}

// Tasks appear based on what they've learned
{learned_passwords and learned_phishing and not task_given:
  + [Do you have any tasks for me?]
      ~ task_given = true
      -> task_offer
}

{task_given and not task_complete:
  + [I completed that task]
      ~ task_complete = true
      ~ favour += 5
      -> task_complete_response
}

{favour >= 20:
  + [You seem to trust me now...]
      ~ favour += 2
      -> friendship_response
}

+ [Leave] #exit_conversation
  {expert_name}: Great work! Keep learning.
  -> hub

=== introduction ===
{expert_name}: Cybersecurity is all about protecting data and systems.
{expert_name}: I can teach you the fundamentals, starting with passwords.
-> hub

=== learn_passwords ===
~ learned_passwords = true
~ favour += 1
{expert_name}: Strong passwords are your first line of defense.
{expert_name}: Use at least 12 characters, mixed case, numbers, and symbols.
-> hub

=== passwords_advanced ===
{expert_name}: Consider using a password manager like Bitwarden or 1Password.
{expert_name}: This way you don't have to remember complex passwords.
-> hub

=== learn_phishing ===
~ learned_phishing = true
~ favour += 1
{expert_name}: Phishing emails trick people into revealing sensitive data.
{expert_name}: Always verify sender email addresses and never click suspicious links.
-> hub

=== phishing_update ===
{expert_name}: New phishing techniques are emerging every day.
{expert_name}: Stay vigilant and report suspicious emails to your IT team.
-> hub

=== learn_mfa ===
~ learned_mfa = true
~ favour += 1
{expert_name}: Multi-factor authentication adds an extra security layer.
{expert_name}: Even if someone has your password, they can't log in without the second factor.
-> hub

=== mfa_advanced ===
{expert_name}: The most secure setup uses a hardware security key like YubiKey.
{expert_name}: SMS codes work too, but authenticator apps are better.
-> hub

=== task_offer ===
{expert_name}: I need you to audit our password policies.
{expert_name}: Can you check if our employees are following best practices?
-> hub

=== task_complete_response ===
{expert_name}: Excellent work! Your audit found several issues we need to fix.
{expert_name}: You're becoming quite the security expert yourself!
-> hub

=== friendship_response ===
{expert_name}: You've learned so much, and I can see your dedication.
{expert_name}: I'd like to bring you into our security team permanently.
-> hub
```

**Key Features Demonstrated:**
- ✅ `once { }` for one-time intro
- ✅ `sticky { }` for "tell me more" options
- ✅ Conditionals for unlocking content
- ✅ Variable tracking (learned_X, favour)
- ✅ Task progression system
- ✅ Friendship levels based on favour
- ✅ Proper hub structure

---

## NPC Influence System

### Overview

Every NPC can track an **influence** variable representing your relationship with them. When influence changes, Break Escape displays visual feedback to the player.

### Implementation

#### 1. Declare the Influence Variable

```ink
VAR npc_name = "Agent Carter"
VAR influence = 0
VAR relationship = "stranger"
```

#### 2. Increase Influence (Positive Actions)

When the player does something helpful or builds rapport:

```ink
=== help_npc ===
Thanks for your help! I really appreciate it.
~ influence += 1
# influence_increased
-> hub
```

**Result**: Displays green popup: **"+ Influence: Agent Carter"**

#### 3. Decrease Influence (Negative Actions)

When the player is rude or makes poor choices:

```ink
=== be_rude ===
That was uncalled for. I expected better.
~ influence -= 1
# influence_decreased
-> hub
```

**Result**: Displays red popup: **"- Influence: Agent Carter"**

#### 4. Use Influence for Conditional Content

```ink
VAR influence = 0

=== hub ===
{influence >= 5:
  + [Ask for classified intel]
      -> classified_intel
}

{influence >= 10:
  + [Request backup]
      -> backup_available
}

{influence < -5:
  NPC refuses to cooperate further.
}
```

### Complete Influence Example

```ink
VAR npc_name = "Field Agent"
VAR influence = 0

=== start ===
Hello. What do you need?
-> hub

=== hub ===
+ [Offer to help]
    That would be great, thanks!
    ~ influence += 2
    # influence_increased
    -> hub

+ [Demand cooperation]
    I don't respond well to demands.
    ~ influence -= 2
    # influence_decreased
    -> hub

+ {influence >= 5} [Share sensitive information]
    Since I trust you... here's what I know.
    -> trusted_info

+ [Leave] #exit_conversation
    -> hub

=== trusted_info ===
This option only appears when influence >= 5.
The breach came from inside the facility.
~ influence += 1
# influence_increased
-> hub
```

### Best Practices

- **Use meaningful increments**: ±1 for small actions, ±2-3 for significant choices
- **Track thresholds**: Unlock new options at key influence levels (5, 10, 15)
- **Show consequences**: Have NPCs react differently based on current influence
- **Balance carefully**: Make influence meaningful but not too easy to game
- **Update relationship labels**: Use influence to change how NPCs address the player

### Technical Tags

| Tag | Effect | Popup Color |
|-----|--------|-------------|
| `# influence_increased` | Shows positive relationship change | Green |
| `# influence_decreased` | Shows negative relationship change | Red |

See `docs/NPC_INFLUENCE.md` for complete documentation.

---

## Common Questions

**Q: Should I use `-> END` or hub loop?**  
A: Use hub loop for NPCs that should be repeatable. Use `-> END` only for one-time narrative moments.

**Q: How do I show different dialogue on repeat conversations?**  
A: Use Ink conditionals with variables like `{conversation_count > 1:` or `{favour >= 5:`

**Q: Can I have both choices and auto-advance?**  
A: Yes! After showing choices, the hub is reached. Use `-> hub` to loop.

**Q: What if I need to end a conversation for story reasons?**  
A: Use a choice with dialogue that feels like an ending, then loop back to hub. Or use `#exit_conversation` to close the minigame while keeping state.

**Q: What's the difference between `once` and `sticky`?**  
A: `once` shows content only once then hides it. `sticky` shows different content based on conditions. Use `once` for introductions, use `sticky` to change menu text.

**Q: Can I have unlimited options in a hub?**  
A: Yes! But for good UX, keep it to 3-5 main options plus "Leave". Use conditionals to show/hide options based on player progress.
