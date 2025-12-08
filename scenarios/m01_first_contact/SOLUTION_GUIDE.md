# Mission 1: First Contact - Complete Solution Guide

## Mission Map Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MISSION 1: FIRST CONTACT                          │
│                           VIRAL DYNAMICS MEDIA                              │
└─────────────────────────────────────────────────────────────────────────────┘

                                    NORTH
    ┌───────────────┬───────────────┬───────────────┬───────────────┐
    │               │               │               │               │
    │  SERVER ROOM  │   MANAGER'S   │   DEREK'S     │   MAYA'S      │
    │               │    OFFICE     │   OFFICE      │   OFFICE      │
    │  [RFID lock]  │  (unlocked)   │  [KEY lock]   │  (unlocked)   │
    │               │               │               │               │
    │  • VM Term    │  • Safe 0419  │  • Computer   │  • Maya NPC   │
    │  • Flags      │    → Key #2   │  • Cabinet    │  • Intel      │
    │  • Evidence   │  • Briefcase  │    PIN 0419   │               │
    │               │    [PICK]     │  • Evidence   │               │
    │               │    → LORE     │               │               │
    └───────┬───────┴───────────────┴───────┬───────┴───────────────┘
            │                               │
            │                               │
    ════════╧═══════════════════════════════╧════════════════════════
    │                                                               │
    │                    MAIN OFFICE AREA                          │
    │                    [KEY LOCK - Key #1]                       │
    │                                                               │
    │     • CyberChef Workstation     • Filing Cabinet (PIN 2024) │
    │     • Maintenance Checklist (IT PIN: 2468)                   │
    │     • Sticky Note (Cabinet PIN: 2024)                        │
    │                                                               │
    ════════╤═══════════════════════════════╤════════════════════════
            │                               │
    ┌───────┴───────┬───────────────┬───────┴───────┬───────────────┐
    │               │               │               │               │
    │   IT ROOM     │  CONFERENCE   │  BREAK ROOM   │   STORAGE     │
    │               │    ROOM       │               │   CLOSET      │
    │  [PIN 2468]   │  (unlocked)   │  (unlocked)   │  (unlocked)   │
    │               │               │               │               │
    │  • Kevin NPC  │  • ZDS Notes  │  • Coffee     │  • Practice   │
    │  • Lockpicks  │  • Campaign   │    Receipt    │    Safe 1337  │
    │  • Keycard    │    Timeline   │  • Anniv.     │  • Maint Log  │
    │  • Passwd     │               │    Card 0419  │               │
    └───────────────┴───────────────┴───────────────┴───────────────┘
            │
    ┌───────┴───────────────────────────────────────────────────────┐
    │                                                               │
    │                      RECEPTION                                │
    │                                                               │
    │     • Sarah NPC → Badge + Key #1 (Main Office)               │
    │     • Building Directory                                      │
    │     • Visitor Sign-In Log (Derek's late hours)               │
    │                                                               │
    └───────────────────────────────────────────────────────────────┘
                            │
                        ENTRANCE
```

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
| 5a | Enter Storage Closet | Find Practice Safe (PIN 1337), backup IT code |
| 5b | Enter Break Room | Find Coffee Receipt, Anniversary Card → **0419** |
| 5c | Enter Conference Room | Find ZDS Notes, Campaign Timeline |
| 5d | Enter Maya's Office | Talk to Maya → Informant reveals all |

### Phase 3: IT Room Access

| Step | Action | Result |
|------|--------|--------|
| 6 | Enter IT Room (PIN **2468**) | Access Kevin's workspace |
| 7 | Talk to Kevin | Get **Lockpicks** + **Server Keycard** + Password Hints |

### Phase 4: Derek's Office Access (TWO PATHS)

**Path A: Find the Key**
| Step | Action | Result |
|------|--------|--------|
| 8a | Enter Manager's Office | Find Patricia's Safe |
| 9a | Open Safe (PIN **0419**) | Get **Derek's Office Key** |
| 10a | Use key on Derek's Office | Enter Derek's Office |

**Path B: Lockpick the Door**
| Step | Action | Result |
|------|--------|--------|
| 8b | Get lockpicks from Kevin | Have lockpick kit |
| 9b | Pick Derek's Office door | Enter Derek's Office (medium difficulty) |

### Phase 5: Evidence Collection

| Step | Action | Result |
|------|--------|--------|
| 11 | Access Derek's Computer | Find **CONTINGENCY file** → Moral Choice triggers |
| 12 | Decode Whiteboard (Base64) | Learn Derek's cabinet PIN: **0419** |
| 13 | Open Derek's Filing Cabinet | Get Casualty Projections, Manifesto, Campaign Materials |

### Phase 6: Lockpick-Only Content (Optional)

| Step | Action | Result |
|------|--------|--------|
| 14 | Go to Manager's Office | Find Patricia's Briefcase |
| 15 | Pick briefcase lock | Get **ENTROPY Infiltration Timeline** (LORE) |

### Phase 7: Server Room & VM Challenges (REQUIRED)

| Step | Action | Result |
|------|--------|--------|
| 16 | Use Kevin's Keycard on Server Room | Enter Server Room |
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

### Encoded Message (Derek's Whiteboard)

**Base64 Encoded:**
```
Q2xpZW50IGxpc3QgdXBkYXRlOiBDb29yZGluYXRpbmcgd2l0aCBaRFMgZm9yIHRlY2huaWNhbCBp
bmZyYXN0cnVjdHVyZSBkZXBsb3ltZW50LiBQaGFzZSAzIHRpbWVsaW5lOiAyIHdlZWtzLiBGSUxJ
TkdfQ0FCSU5FVF9QSU46IDA0MTkgKERlcmVrJ3MgYmRheSAtIGRvbid0IGZvcmdldCBhZ2FpbiEp
```

**Decoded:**
```
Client list update: Coordinating with ZDS for technical infrastructure deployment. 
Phase 3 timeline: 2 weeks. FILING_CABINET_PIN: 0419 (Derek's bday - don't forget again!)
```

---

## Puzzle Chain Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COMPLETE PUZZLE CHAIN                             │
└─────────────────────────────────────────────────────────────────────────────┘

PHASE 1: ENTRY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Reception ─► Sarah gives KEY #1 ─► Main Office Area [KEY #1]


PHASE 2: EXPLORATION (any order)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Main Office ─┬─► Storage Closet ──► Practice Safe [1337] (optional)
               │
               ├─► Break Room ─────► Anniversary Card (reveals 0419)
               │
               ├─► Conference Room ─► ZDS Notes, Campaign Timeline
               │
               ├─► Maya's Office ──► Talk to informant (reveals everything)
               │
               └─► Find Maintenance Checklist ─► IT Room PIN: 2468


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
  Manager's Office                      IT Room
      │                                     │
      ▼                                     ▼
  Patricia's Safe [0419]                Get Lockpicks
      │                                     │
      ▼                                     ▼
  KEY #2 (Derek's Key)                  [PICK Derek's door]
      │                                     │
      └──────────────┬──────────────────────┘
                     ▼
              Derek's Office [UNLOCKED]


PHASE 5: EVIDENCE COLLECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Derek's Office ─┬─► Computer ─► CONTINGENCY file ─► MORAL CHOICE
                  │
                  ├─► Whiteboard [Base64] ─► Cabinet PIN: 0419
                  │
                  └─► Filing Cabinet [0419] ─► Critical Evidence


PHASE 6: LOCKPICK-ONLY BONUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Manager's Office ─► Patricia's Briefcase [LOCKPICK ONLY]
                         │
                         ▼
                  ENTROPY Infiltration Timeline (LORE)


PHASE 7: VM CHALLENGES (REQUIRED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Server Room [RFID - Kevin's Keycard]
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

### Optional Content

| Content | How to Access | Reward |
|---------|---------------|--------|
| Patricia's Briefcase | Lockpick (no key exists) | LORE: ENTROPY Infiltration Timeline |
| Practice Safe | PIN 1337 | Minor LORE, practice PIN mechanic |
| Main Filing Cabinet | PIN 2024 | The Architect's Letter (LORE) |

---

## Objectives Tracking

### Aim 1: Establish Access
- [x] Check in at reception (Sarah)
- [x] Access main office area (Key #1)
- [x] Find IT room access code (Maintenance Checklist)
- [x] Access IT room (PIN 2468)
- [x] Meet Kevin Park

### Aim 2: Investigate Derek
- [ ] Find access to Derek's office (Key #2 OR lockpick)
- [ ] Enter Derek's office
- [ ] Search Derek's computer (CONTINGENCY file)
- [ ] Decode whiteboard message (CyberChef)
- [ ] Open Derek's filing cabinet (PIN 0419)

### Aim 3: Gather Evidence
- [ ] Find Operation Shatter casualty projections
- [ ] Discover ENTROPY manifesto
- [ ] Find campaign materials
- [ ] Talk to the informant (Maya)

### Aim 4: Intercept Communications (REQUIRED)
- [ ] Access server room (RFID keycard)
- [ ] Access compromised systems (VM)
- [ ] Submit SSH access evidence ⚠️ REQUIRED
- [ ] Submit Linux navigation evidence ⚠️ REQUIRED
- [ ] Submit privilege escalation evidence ⚠️ REQUIRED

### Aim 5: Confront the Operative
- [ ] Confront Derek Lawson (requires all flags)
- [ ] Choose resolution (arrest/recruit/expose)

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

---

## Room Summary

| Room | Lock Type | Access | Key NPCs/Items |
|------|-----------|--------|----------------|
| Reception | None | Start | Sarah (badge, key) |
| Main Office | KEY | Key from Sarah | CyberChef, clues |
| Storage Closet | None | Via Main Office | Practice safe, backup codes |
| Break Room | None | Via Main Office | Anniversary clue (0419) |
| Conference Room | None | Via Main Office | ZDS notes, timeline |
| IT Room | PIN 2468 | Via Main Office | Kevin (lockpicks, keycard) |
| Manager's Office | None | Via Main Office | Safe (key), briefcase (LORE) |
| Maya's Office | None | Via Main Office | Maya (informant) |
| Derek's Office | KEY/PICK | Key from safe OR pick | Derek, computer, evidence |
| Server Room | RFID | Keycard from Kevin | VM terminal, flags |
