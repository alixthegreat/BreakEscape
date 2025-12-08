# Mission 1: First Contact - Complete Solution Guide

## Mission Map Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MISSION 1: FIRST CONTACT                          │
│                           VIRAL DYNAMICS MEDIA                              │
└─────────────────────────────────────────────────────────────────────────────┘

                                    NORTH
                                      │
    ┌─────────────┐ ┌─────────────┐   │               ┌─────────────┐
    │  MANAGER'S  │ │   MAYA'S    │   │               │   DEREK'S   │
    │   OFFICE    │ │   OFFICE    │   │               │   OFFICE    │
    │ (unlocked)  │ │ (unlocked)  │   │               │   [KEY]     │
    └──────┬──────┘ └──────┬──────┘   │               └──────┬──────┘
           │               │          │                      │
           └───────┬───────┘          │                      │
                   │                  │                      │
    ┌──────┐ ┌─────┴─────┐      ┌─────┴─────┐      ┌────────┴────────┐ ┌──────────┐
    │STOR. │─│ HALLWAY   │◄────►│           │◄────►│   HALLWAY EAST  │─│ SERVER   │
    │CLOSET│ │   WEST    │      │           │      │                 │ │  ROOM    │
    │(1gu) │ │           │      │           │      │                 │ │ [RFID]   │
    └──────┘ └─────┬─────┘      │           │      └────────┬────────┘ └──────────┘
                   │            │           │               │
    ═══════════════╧════════════╧═══════════╧═══════════════╧════════════════════
    │                                                                           │
    │                         MAIN OFFICE AREA [KEY]                           │
    │                                                                           │
    ═══════╤═══════════════════════════════════════════════════════════════╤════
           │                                                               │
    ┌──────┴──────┐                                         ┌──────────────┴────┐
    │ BREAK ROOM  │                                         │      IT ROOM      │
    │             │                                         │    [PIN 2468]     │
    └──────┬──────┘                                         └───────────────────┘
           │
    ┌──────┴──────┐
    │ CONFERENCE  │
    │    ROOM     │
    └─────────────┘
           │
    ┌──────┴──────────────────────────────────────────────────────────────────┐
    │                            RECEPTION                                    │
    └─────────────────────────────────────────────────────────────────────────┘
```

---

## Room Connections Summary

| Room | North | South | East | West |
|------|-------|-------|------|------|
| Reception | main_office_area | - | - | - |
| Main Office | [hallway_west, hallway_east] | reception | it_room | break_room |
| Break Room | - | - | main_office_area | conference_room |
| Conference Room | - | - | break_room | - |
| IT Room | - | - | - | main_office_area |
| Hallway West | [manager_office, maya_office] | main_office_area | hallway_east | storage_closet |
| Hallway East | derek_office | main_office_area | server_room | hallway_west |
| Storage Closet | - | - | hallway_west | - |
| Manager's Office | - | hallway_west | - | - |
| Maya's Office | - | hallway_west | - | - |
| Derek's Office | - | hallway_east | - | - |
| Server Room | - | - | - | hallway_east |

---

## Step-by-Step Solution

### Phase 1: Entry and Initial Access

| Step | Action | Result |
|------|--------|--------|
| 1 | Mission briefing auto-plays | Learn about Operation Shatter, Derek Lawson |
| 2 | Talk to Sarah Martinez | Receive **Visitor Badge** + **Main Office Key** |
| 3 | Use Main Office Key on north door | Unlock Main Office Area |
| 4 | Find **Maintenance Checklist** | Learn IT Room PIN: **2468** |

### Phase 2: Exploration (Multiple Paths)

| Step | Action | Result |
|------|--------|--------|
| 5a | Go west to Break Room | Find Coffee Receipt, Anniversary Card → **0419** |
| 5b | Go west from Break Room to Conference | Find ZDS Notes, Campaign Timeline |
| 5c | Go east to IT Room (PIN 2468) | Meet Kevin, get tools |
| 5d | Go north to Hallway West | Access Manager's Office and Maya's Office |
| 5e | Go north to Hallway East | Access Derek's Office (locked) and Server Room |

### Phase 3: IT Room Access

| Step | Action | Result |
|------|--------|--------|
| 6 | Enter IT Room (PIN **2468**) | Access Kevin's workspace |
| 7 | Talk to Kevin | Get **Lockpicks** + **Server Keycard** + Password Hints |

### Phase 4: Derek's Office Access (TWO PATHS)

**Path A: Find the Key**
| Step | Action | Result |
|------|--------|--------|
| 8a | Go to Hallway West → Manager's Office | Find Patricia's Safe |
| 9a | Open Safe (PIN **0419**) | Get **Derek's Office Key** |
| 10a | Go to Hallway East → Use key on Derek's Office | Enter Derek's Office |

**Path B: Lockpick the Door**
| Step | Action | Result |
|------|--------|--------|
| 8b | Get lockpicks from Kevin | Have lockpick kit |
| 9b | Go to Hallway East → Pick Derek's Office door | Enter Derek's Office (medium difficulty) |

### Phase 5: Evidence Collection

| Step | Action | Result |
|------|--------|--------|
| 11 | Access Derek's Computer | Find **CONTINGENCY file** → Moral Choice triggers |
| 12 | Decode Whiteboard (Base64) | Learn Derek's cabinet PIN: **0419** |
| 13 | Open Derek's Filing Cabinet | Get Casualty Projections, Manifesto, Campaign Materials |

### Phase 6: Lockpick-Only Content (Optional)

| Step | Action | Result |
|------|--------|--------|
| 14 | Go to Hallway West → Manager's Office | Find Patricia's Briefcase |
| 15 | Pick briefcase lock | Get **ENTROPY Infiltration Timeline** (LORE) |

### Phase 7: Server Room & VM Challenges (REQUIRED)

| Step | Action | Result |
|------|--------|--------|
| 16 | Go to Hallway East → Use Kevin's Keycard | Enter Server Room |
| 17 | Access VM Terminal | Connect to Social Fabric infrastructure |
| 18 | Complete SSH Brute Force | Obtain `flag{ssh_brute_force_success}` |
| 19 | Complete Linux Navigation | Obtain `flag{linux_navigation_complete}` |
| 20 | Complete Privilege Escalation | Obtain `flag{privilege_escalation_success}` |
| 21 | Submit ALL 3 flags | Unlock Derek confrontation |

### Phase 8: Confrontation

| Step | Action | Result |
|------|--------|--------|
| 22 | Return to Derek's Office | Derek appears |
| 23 | Confront Derek (requires all flags) | Evil monologue, choose resolution |
| 24 | Choose: Arrest / Recruit / Expose | Mission complete, debrief triggers |

---

## Puzzle Solutions Reference

### PIN Codes

| Lock | PIN | Clue Location | Clue Text |
|------|-----|---------------|-----------|
| IT Room | **2468** | Maintenance Checklist (Main Office) | "IT ROOM PIN: 2468" |
| Practice Safe | **1337** | Maintenance Checklist | "Practice safe code: 1337" |
| Main Filing Cabinet | **2024** | Sticky Note (Main Office) | "Election year = access code" |
| Patricia's Safe | **0419** | Anniversary Card (Break Room) | "April 19th" |
| Derek's Cabinet | **0419** | Whiteboard (Base64 decoded) | "FILING_CABINET_PIN: 0419" |

### Keys and Keycards

| Item | Location | Unlocks |
|------|----------|---------|
| Main Office Key | Sarah Martinez (Reception) | Main Office Area door |
| Derek's Office Key | Patricia's Safe (Manager's Office) | Derek's Office door |
| Server Room Keycard | Kevin (IT Room) | Server Room RFID lock |
| Lockpicks | Kevin (IT Room) | Derek's door (alt), Patricia's briefcase |

---

## Puzzle Chain Diagram

```
PHASE 1: ENTRY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Reception ─► Sarah gives KEY #1 ─► Main Office Area [KEY #1]


PHASE 2: EXPLORATION (any order)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Main Office ─┬─► West: Break Room ─► West: Conference Room
               │                              └─► ZDS Notes, Timeline
               │
               ├─► East: IT Room [PIN 2468] ─► Kevin (lockpicks, keycard)
               │
               ├─► North: Hallway West ─┬─► Manager's Office (safe, briefcase)
               │                        └─► Maya's Office (informant)
               │
               └─► North: Hallway East ─┬─► Derek's Office [KEY/PICK]
                                        └─► Server Room [RFID]


PHASE 3: IT ACCESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  IT Room [PIN 2468] ─► Kevin gives:
                           ├─► Lockpicks
                           ├─► Server Room Keycard (RFID)
                           └─► Password Hints


PHASE 4: DEREK'S OFFICE (Two parallel paths)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PATH A (Key):                         PATH B (Lockpick):
  ─────────────                         ──────────────────
  Hallway West → Manager's Office       IT Room
      │                                     │
      ▼                                     ▼
  Patricia's Safe [0419]                Get Lockpicks
      │                                     │
      ▼                                     ▼
  KEY #2 (Derek's Key)                  [PICK Derek's door]
      │                                     │
      └──────────────┬──────────────────────┘
                     ▼
        Hallway East → Derek's Office [UNLOCKED]


PHASE 5: EVIDENCE COLLECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Derek's Office ─┬─► Computer ─► CONTINGENCY file ─► MORAL CHOICE
                  │
                  ├─► Whiteboard [Base64] ─► Cabinet PIN: 0419
                  │
                  └─► Filing Cabinet [0419] ─► Critical Evidence


PHASE 6: LOCKPICK-ONLY BONUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Hallway West → Manager's Office ─► Patricia's Briefcase [LOCKPICK ONLY]
                                           │
                                           ▼
                                  ENTROPY Infiltration Timeline (LORE)


PHASE 7: VM CHALLENGES (REQUIRED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Hallway East → Server Room [RFID - Kevin's Keycard]
      │
      ├─► VM Terminal ─┬─► SSH Brute Force
      │                ├─► Linux Navigation
      │                └─► Privilege Escalation
      │
      └─► Drop-Site ─► Submit ALL 3 flags (REQUIRED)


PHASE 8: CONFRONTATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Derek's Office ─► Derek returns ─► Confrontation (requires all flags)
                         │
                         ├─► Arrest
                         ├─► Attempt Recruit (fails)
                         └─► Public Expose
                         │
                         ▼
                  MISSION COMPLETE
```

---

## Alternative Paths & Shortcuts

### Path Options for Derek's Office

| Method | Requirements | Difficulty |
|--------|--------------|------------|
| Use Key | Find PIN 0419 (Break Room), open Patricia's safe | Easy (find clue, enter PIN) |
| Lockpick | Get lockpicks from Kevin | Medium (lockpick minigame) |

### Locked-Out Shortcuts (By Design)

| Attempted Shortcut | Why It's Blocked |
|--------------------|------------------|
| Lockpick Main Office | No lockpicks until after entering Main Office |
| Skip to confrontation | Derek requires ALL 3 VM flags submitted |
| Skip IT Room | Need PIN 2468 (found in Main Office) |
| Skip Server Room | Need Kevin's RFID keycard |

---

## Moral Choices

### 1. Kevin's Frame-Up (Mid-Mission)
**Trigger:** Pick up CONTINGENCY file from Derek's Computer

| Choice | Effect | Consequence |
|--------|--------|-------------|
| Warn Kevin | kevin_protected = true | Kevin lawyers up, protected |
| Plant evidence | kevin_protected = true | Kevin protected anonymously |
| Ignore | kevin_protected = false | Kevin arrested, family traumatized |

### 2. Derek Confrontation (End)
**Trigger:** Talk to Derek after all VM flags submitted

| Choice | Effect | Outcome |
|--------|--------|---------|
| Arrest | final_choice = arrest | Surgical strike, Derek in custody |
| Recruit | final_choice = recruit | Derek refuses, arrested anyway |
| Expose | final_choice = expose | Documents released to press |

---

## LORE Fragments

| Fragment | Location | How to Access |
|----------|----------|---------------|
| The Architect's Letter | Main Filing Cabinet | PIN 2024 |
| Social Fabric Manifesto | Derek's Filing Cabinet | PIN 0419 |
| Network Backdoor Analysis | Server Room | Enter room |
| Patricia's Investigation Notes | Patricia's Safe | PIN 0419 |
| ENTROPY Infiltration Timeline | Patricia's Briefcase | **LOCKPICK ONLY** |
| Old Orientation Guide | Practice Safe | PIN 1337 |

---

## Room Summary

| Room | Lock Type | Access | Key NPCs/Items |
|------|-----------|--------|----------------|
| Reception | None | Start | Sarah (badge, key) |
| Main Office | KEY | Key from Sarah | CyberChef, clues |
| Break Room | None | West from Main Office | Anniversary clue (0419) |
| Conference Room | None | West from Break Room | ZDS notes, timeline |
| IT Room | PIN 2468 | East from Main Office | Kevin (lockpicks, keycard) |
| Hallway West | None | North from Main Office | Directory sign |
| Hallway East | None | North from Main Office | Directory sign |
| Storage Closet | None | West from Hallway West | Practice safe, backup codes |
| Manager's Office | None | North from Hallway West | Safe (key), briefcase (LORE) |
| Maya's Office | None | North from Hallway West | Maya (informant) |
| Derek's Office | KEY/PICK | North from Hallway East | Derek, computer, evidence |
| Server Room | RFID | East from Hallway East | VM terminal, flags |

---

## Completion Requirements

| Requirement | Mandatory? | Notes |
|-------------|------------|-------|
| Get Main Office Key from Sarah | ✅ Yes | Only way to access main office |
| Access IT Room (PIN 2468) | ✅ Yes | Need lockpicks and keycard |
| Get Derek's Office access | ✅ Yes | Key OR lockpick |
| Access Server Room | ✅ Yes | Need Kevin's RFID keycard |
| Submit SSH flag | ✅ Yes | Required for confrontation |
| Submit Linux flag | ✅ Yes | Required for confrontation |
| Submit Sudo flag | ✅ Yes | Required for confrontation |
| Confront Derek | ✅ Yes | Triggers mission end |
| Find evidence documents | ❌ Optional | Affects debrief quality |
| Complete Kevin moral choice | ❌ Optional | Affects Kevin's fate |
| Talk to Maya | ❌ Optional | Provides intel |
| Pick Patricia's briefcase | ❌ Optional | Extra LORE |
