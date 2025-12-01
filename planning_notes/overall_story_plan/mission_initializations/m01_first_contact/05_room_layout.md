# Room Layout: Mission 1 - First Contact

**Scenario:** First Contact
**Location:** Viral Dynamics Media Office
**Target Difficulty:** Tier 1 (Beginner)
**Design Philosophy:** Hub-and-spoke with progressive unlocking and required backtracking

---

## Overview

**Location:** Viral Dynamics Media - Marketing Agency Office
**Total Rooms:** 7
**Playable Area:** Small (tutorial scenario)
**Security Level:** Low-to-Medium (startup office environment)
**Time of Day:** Evening (6:00 PM - after business hours, skeleton crew)
**Occupancy:** Minimal (3-4 NPCs remaining)

**Design Philosophy:**

This layout supports **progressive unlocking with required backtracking**, teaching players non-linear investigation. The office uses a **hub-and-spoke design** with the Main Office Area as the central hub, allowing easy navigation while creating natural chokepoints for progressive unlocking.

**Spatial Strategy:**
- **Act 1 (Tutorial):** Access to Reception, Main Office, Break Room (public areas)
- **Act 2 (Investigation):** Unlock Derek's Office → Server Room → Storage Closet via found keys/credentials
- **Act 3 (Confrontation):** All areas accessible, backtracking to correlate evidence

The layout creates a natural tutorial → investigation → confrontation flow while teaching backtracking patterns essential for future missions.

---

## Location Description

**Viral Dynamics Media** occupies a renovated industrial loft space in a trendy urban district. The office exudes the aesthetic of a successful startup - exposed brick, modern furniture, motivational quotes on walls, and branded merchandise throughout. During business hours, the space bustles with creative energy, but after 6 PM, most employees have left, leaving only dedicated (or suspicious) employees working late.

**Atmosphere:** The after-hours atmosphere creates tension between the professional facade and the clandestine ENTROPY operations. Dim evening lighting, quiet corridors, and the hum of servers create an investigative mood. The player feels like an intruder (despite their legitimate IT contractor cover), heightening the sense of discovery as they uncover evidence of Social Fabric's disinformation campaign.

**Entry Cover:** Player arrives as "contracted IT consultant" to audit network security - a plausible cover that explains access to technical areas while allowing social engineering opportunities with remaining staff.

---

## Individual Room Designs

### Room 1: Reception Area

**ID:** `reception_area`
**Type:** Reception/Entry
**Narrative Purpose:** Entry point, establishes cover, introduces Sarah (receptionist)
**Security Level:** Public (low)

**Description:**
Modern reception area with clean lines and company branding. The Viral Dynamics logo ("Making Ideas Viral") dominates the wall behind an unmanned reception desk. Visitor seating with industry magazines creates a professional but casual atmosphere. After-hours lighting gives the space an empty, investigative feel.

**Connections:**
- **North:** Main Office Area (open connection, no door)
- **East:** Break Room (open connection)

**Containers:**

1. **Reception Desk Drawer**
   - **Lock:** None (public area)
   - **Contents:**
     - Building directory (note) - shows Derek Lawson in Office 3
     - Visitor log (note) - shows Derek's frequent late-night visits
     - Office supplies (flavor items)
   - **Narrative Purpose:** First investigative clue - Derek works late often
   - **Objectives:** Supports `explore_office` tutorial task

**Interactive Objects:**

1. **Company Directory Board (Wall Mount)**
   - **Interaction:** Read/examine
   - **Content:** Employee directory showing names and office assignments
   - **Purpose:** Helps player identify Derek Lawson's office location
   - **Note Content:** "Derek Lawson - Senior Marketing Manager - Office 3"

2. **Reception Computer (PC)**
   - **Lock:** None (Sarah is logged in, left workstation)
   - **Interaction:** Access computer
   - **Contents:**
     - Email from Derek requesting "enhanced privacy" for late-night work
     - Meeting calendar showing Derek's suspicious schedule
   - **Purpose:** Early evidence of suspicious behavior
   - **Objectives:** Optional intelligence gathering

**NPCs:**

- **Sarah Martinez (In-Person)** - Receptionist working late
  - **Position:** Behind reception desk or nearby
  - **Dialogue Trigger:** Player-initiated (walk up and interact)
  - **Provides:** Visitor badge, basic office access, Derek's whereabouts
  - **Objectives:** Completes `meet_reception` task
  - **Trust Level:** Neutral → Friendly (if professional)
  - **Role:** Tutorial NPC, teaches dialogue system, provides cover legitimacy

**Objectives Completed Here:**
- `enter_office` (automatic upon spawn)
- `meet_reception` (talk to Sarah)
- `explore_office` (after visiting multiple rooms)

**LORE Fragments:** None (public area)

**Technical Notes:**
- Starting room (`startRoom: "reception_area"`)
- Sarah provides visitor badge (item given via Ink `#give_item` tag)
- Reception computer unlocked to teach computer interaction without password complexity

---

### Room 2: Main Office Area

**ID:** `main_office_area`
**Type:** Open Office (cubicles and desks)
**Narrative Purpose:** Central hub, Kevin's location, lockpicking tutorial
**Security Level:** Low (visitor badge access)

**Description:**
Open floor plan with rows of modern workstations (hot-desking style). Marketing posters and client campaign materials adorn the walls. Most desks are empty in the evening, but Kevin's workstation (IT corner) has active monitors. A locked storage closet in the northwest corner and Derek's locked office door (northeast) create visible but inaccessible objectives.

**Connections:**
- **South:** Reception Area (open)
- **North:** Derek's Office (locked - requires lockpicking OR finding key)
- **East:** Server Room (locked - requires Kevin's keycard OR lockpick + password)
- **West:** Conference Room (open)

**Containers:**

1. **Kevin's Desk Drawer**
   - **Lock:** None (Kevin is cooperative)
   - **Contents:**
     - Password hints note: "Derek's passwords: Marketing123, Campaign2024, Viral_Dynamics_Admin"
     - Network diagram (shows server room layout)
   - **Narrative Purpose:** Social engineering yields VM brute-force hints
   - **Objectives:** `gather_password_hints` task

2. **Storage Closet (Northwest Corner)**
   - **Lock:** Physical lock (lockpicking minigame)
   - **Contents:**
     - Lockpick Practice Safe (tutorial item)
     - Derek's Office Key (hidden in toolbox)
     - IT tools (flavor items)
   - **Narrative Purpose:** **Lockpicking tutorial** + first backtracking opportunity
   - **Objectives:** `lockpick_tutorial` task
   - **Backtracking:** Player must return here after learning about key location

3. **Filing Cabinet (West Wall)**
   - **Lock:** Physical lock (requires lockpick, medium difficulty)
   - **Contents:**
     - LORE Fragment 1: "Social Fabric Manifesto"
     - Employee records (shows Derek hired 6 months ago)
   - **Narrative Purpose:** Optional LORE, character background
   - **Objectives:** Optional LORE collection

**Interactive Objects:**

1. **Whiteboard (South Wall)**
   - **Interaction:** Examine
   - **Content:** "Q2 Campaign Targets: Local News, Social Media Influencers, Grassroots Organizations"
   - **Purpose:** First hint of suspicious "targeting" language
   - **Encoding:** None (plaintext)

2. **CyberChef Workstation (Near Kevin's Desk)**
   - **Interaction:** Use for decoding challenges
   - **Purpose:** Decode Base64 messages, analyze hex strings
   - **Objectives:** Required for `decode_whiteboard` task
   - **Tutorial Value:** Introduces encoding/decoding concepts

**NPCs:**

- **Kevin Park (In-Person)** - IT Manager / System Administrator
  - **Position:** At his desk in IT corner (southeast area)
  - **Dialogue Trigger:** Player-initiated
  - **Provides:**
    - Lockpick set (after building trust)
    - Password hints (via dialogue, not direct item)
    - Server room RFID keycard (after significant trust)
  - **Objectives:** `meet_kevin`, `receive_lockpick`, `clone_kevin_card`
  - **Trust System:** Low → Medium → High via conversation choices
  - **Role:** Key ally, teaches social engineering, provides critical access items

**Objectives Completed Here:**
- `meet_kevin` - Talk to Kevin
- `receive_lockpick` - Kevin gives lockpick set
- `lockpick_tutorial` - Pick storage closet lock
- `gather_password_hints` - Get password list from Kevin
- `clone_kevin_card` - Clone his RFID card for server room

**LORE Fragments:**
- **Fragment 1:** "Social Fabric Manifesto" (in filing cabinet)

**Technical Notes:**
- Central hub room - all other rooms accessible from here
- Lockpicking tutorial happens at storage closet door
- Kevin provides items via Ink `#give_item` tags after trust building
- Storage closet key found later enables backtracking

---

### Room 3: Derek's Office

**ID:** `derek_office`
**Type:** Senior Employee Office
**Narrative Purpose:** Primary evidence location, Base64 encoding challenge
**Security Level:** Medium (locked door, password-protected computer)

**Description:**
Derek Lawson's private office reflects his senior position. Modern desk with dual monitors, marketing awards on walls, and a large whiteboard covered in encoded messages. The office is tidy but sterile - lacking personal effects that might reveal his true allegiances. The locked filing cabinet and password-protected computer suggest secrets to hide.

**Connections:**
- **South:** Main Office Area (locked initially)

**Unlock Conditions:**
- **Option A:** Lockpick the door (after tutorial)
- **Option B:** Use Derek's Office Key (found in storage closet toolbox)

**Containers:**

1. **Derek's Computer (PC)**
   - **Lock:** Password (requires one of Kevin's hints: "Marketing123" or "Campaign2024")
   - **Contents:**
     - Email thread with "ZDS" (Zephyr Digital Strategies - ENTROPY front)
     - Campaign targeting spreadsheet
     - SSH credentials file (username/IP for VM challenge)
   - **Narrative Purpose:** Connect Derek to ENTROPY, provide VM access
   - **Objectives:** `access_derek_computer`, unlocks `submit_ssh_flag`

2. **Filing Cabinet (East Wall)**
   - **Lock:** Physical lock (lockpicking, medium difficulty)
   - **Contents:**
     - Client contracts (legitimate business)
     - Hidden folder: "Project Narrative" with disinformation plans
     - Media contacts list (targets for manipulation)
     - LORE Fragment 2: "The Architect's Letter to Social Fabric"
   - **Narrative Purpose:** Hard evidence of disinformation campaign
   - **Objectives:** `search_filing_cabinet`
   - **Backtracking:** Locked initially, player returns after getting lockpick

3. **Desk Drawer**
   - **Lock:** None
   - **Contents:**
     - Burner phone (flavor item, can't be accessed)
     - Travel documents (suspicious frequency)
     - Personal calendar with coded meetings
   - **Narrative Purpose:** Environmental storytelling - Derek is secretive

**Interactive Objects:**

1. **Whiteboard (North Wall)**
   - **Interaction:** Examine/photograph
   - **Content:** `"Q2xpZW50IGxpc3QgdXBkYXRlOiBDb29yZGluYXRpbmcgd2l0aCBaRFM="` (Base64)
   - **Decoded:** "Client list update: Coordinating with ZDS"
   - **Purpose:** **Base64 encoding tutorial** - first encoding challenge
   - **Objectives:** `decode_whiteboard` (use CyberChef in main office)
   - **Educational Value:** Teaches encoding vs. encryption

2. **Awards Display (West Wall)**
   - **Interaction:** Examine
   - **Content:** Industry marketing awards, all recent (6 months)
   - **Purpose:** Suggests Derek's cover is well-established
   - **Environmental Storytelling:** Professional success as infiltration tactic

**NPCs:** None (Derek is not in office yet - arrives in Act 3)

**Objectives Completed Here:**
- `access_derek_office` - Enter Derek's office
- `decode_whiteboard` - Decode Base64 message
- `access_derek_computer` - Log into his PC
- `search_filing_cabinet` - Find hard evidence

**LORE Fragments:**
- **Fragment 2:** "The Architect's Letter to Social Fabric" (filing cabinet)

**Technical Notes:**
- Door can be unlocked via lockpicking OR key (player choice)
- Base64 message requires CyberChef workstation in Main Office (backtracking)
- Computer password from Kevin's hints (social engineering reward)
- Filing cabinet requires lockpick (cannot bypass)

---

### Room 4: Server Room

**ID:** `server_room`
**Type:** Server Room / IT Infrastructure
**Narrative Purpose:** VM access point, flag submission, technical challenges
**Security Level:** High (RFID keycard + password OR lockpick + password)

**Description:**
Small but well-maintained server room with two equipment racks, network switches, and cooling units. The hum of servers and blinking status lights create a technical atmosphere. A system administration workstation provides access to Viral Dynamics' network - the gateway to VM challenges. The room is professionally organized with proper cable management, reflecting Kevin's competence.

**Connections:**
- **West:** Main Office Area (locked initially)

**Unlock Conditions:**
- **RFID Access:** Clone Kevin's keycard (requires RFID cloner + proximity to Kevin)
- **Lockpick Access:** Pick door lock (advanced difficulty)
- **Both require:** Password obtained from Derek's computer OR social engineering

**Containers:**

1. **Server Rack Cabinet**
   - **Lock:** None (physical access already restricted by room)
   - **Contents:**
     - Network cables (flavor items)
     - Backup drives (flavor items)
     - Server documentation
   - **Narrative Purpose:** Environmental realism

2. **IT Supply Shelf**
   - **Lock:** None
   - **Contents:**
     - Spare keyboards/mice (flavor)
     - Cable management supplies
     - LORE Fragment 3: "Network Infrastructure Diagram" (shows ENTROPY backdoor)
   - **Narrative Purpose:** LORE fragment placement

**Interactive Objects:**

1. **VM Access Terminal (System Admin Workstation)**
   - **Position:** Center of room
   - **Interaction:** Access to VM challenges
   - **Function:** SSH into target server (IP from Derek's computer)
   - **VM Challenges:**
     - SSH brute force (using password hints from Kevin)
     - Linux basic navigation
     - Privilege escalation (sudo)
   - **Objectives:** `access_vm`, VM flag tasks
   - **Educational Value:** SSH, Linux basics, password security

2. **Drop-Site Terminal (Secondary Workstation)**
   - **Position:** Northeast corner
   - **Interaction:** Submit VM flags
   - **Function:** Flags unlock intelligence resources and narrative progression
   - **Objectives:** `submit_ssh_flag`, `submit_navigation_flag`, `submit_sudo_flag`
   - **Unlocks:** Intelligence reports, next aims/tasks

3. **Network Diagram (Wall Poster)**
   - **Interaction:** Examine
   - **Content:** Office network topology
   - **Purpose:** Shows Derek's workstation has unusual outbound connections
   - **Environmental Storytelling:** Visual evidence of suspicious activity

**NPCs:** None (server room unmanned)

**Objectives Completed Here:**
- `access_server_room` - Enter server room
- `access_vm` - Log into VM terminal
- `submit_ssh_flag` - Submit SSH flag
- `submit_navigation_flag` - Submit Linux navigation flag
- `submit_sudo_flag` - Submit privilege escalation flag

**LORE Fragments:**
- **Fragment 3:** "Network Infrastructure Diagram" (IT supply shelf)

**Technical Notes:**
- **Critical security checkpoint** - multiple unlock methods teach player choice
- VM access requires password from Derek's computer (social engineering → digital)
- Drop-site terminal separate from VM access (allows flag submission while in VM)
- Flags unlock progressive narrative beats via Ink tags

---

### Room 5: Conference Room

**ID:** `conference_room`
**Type:** Meeting Room
**Narrative Purpose:** Evidence correlation, presentation materials
**Security Level:** Low (unlocked)

**Description:**
Modern conference room with a large table seating 10, presentation screen, and whiteboards. Leftover materials from recent "campaign planning" meetings provide environmental storytelling. The room feels recently used - coffee cups not yet cleared, whiteboard partially erased, suggesting hasty departure.

**Connections:**
- **East:** Main Office Area (open)
- **North:** Break Room (open)

**Containers:**

1. **Conference Table (Surface)**
   - **Lock:** None
   - **Contents:**
     - Meeting agenda (note): "Q2 Narrative Strategies"
     - Client presentation (note): Suspicious targeting language
     - Leftover notebooks (flavor items)
   - **Narrative Purpose:** Evidence of coordinated campaign
   - **Objectives:** `search_conference_materials`

2. **A/V Equipment Cabinet**
   - **Lock:** None
   - **Contents:**
     - Presentation remote
     - HDMI cables
     - USB drive with presentation files
   - **Narrative Purpose:** Additional evidence source

**Interactive Objects:**

1. **Whiteboard (East Wall)**
   - **Interaction:** Examine
   - **Content:** Partially erased strategic notes
     - "Target demographics: 18-35, politically active"
     - "Amplification strategy: Leverage influencers"
     - "Timeline: Pre-election push"
   - **Purpose:** Confirms election manipulation timing
   - **Objectives:** `analyze_whiteboard_notes`

2. **Presentation Screen (Computer Connection)**
   - **Interaction:** Access if laptop left connected
   - **Content:** Campaign presentation slides
   - **Purpose:** Visual evidence of manipulation tactics
   - **Environmental Storytelling:** Professional facade hiding propaganda

**NPCs:**

- **Maya Chen (In-Person, Optional Encounter)**
  - **Position:** May be in conference room reviewing materials
  - **Dialogue Trigger:** Player-initiated
  - **Provides:** Additional context about Derek's behavior, office gossip
  - **Objectives:** Optional - `interview_maya`
  - **Trust Level:** Neutral → Helpful (if approached professionally)
  - **Role:** Witness NPC, provides subjective perspective on Derek

**Objectives Completed Here:**
- `search_conference_materials` - Gather meeting evidence
- `analyze_whiteboard_notes` - Document strategic plans
- `interview_maya` (optional) - Get insider perspective

**LORE Fragments:** None

**Technical Notes:**
- Public room (no locks) to provide early accessible evidence
- Maya's presence is optional (may not be in room during player visit)
- Whiteboard content correlates with Derek's computer files

---

### Room 6: Break Room

**ID:** `break_room`
**Type:** Kitchen / Common Area
**Narrative Purpose:** Casual NPC encounters, environmental storytelling
**Security Level:** None (public)

**Description:**
Casual employee break room with kitchen appliances, tables, and vending machines. Company-branded mugs and motivational posters create a friendly atmosphere contrasting with the ENTROPY operations. The notice board and communal spaces offer glimpses into office culture and employee relationships.

**Connections:**
- **West:** Reception Area (open)
- **South:** Conference Room (open)
- **North:** Main Office Area (open)

**Containers:**

1. **Refrigerator**
   - **Lock:** None
   - **Contents:**
     - Personal food items with names
     - Company-provided snacks
     - Energy drinks (suggests late-night work culture)
   - **Narrative Purpose:** Environmental storytelling - overwork culture
   - **Objectives:** None (flavor only)

2. **Notice Board**
   - **Lock:** None
   - **Contents:**
     - Employee announcements
     - Social events calendar
     - Emergency contact list (shows employee names/extensions)
   - **Narrative Purpose:** Social engineering resource, employee directory
   - **Objectives:** Optional - `check_notice_board` (provides employee context)

**Interactive Objects:**

1. **Coffee Station**
   - **Interaction:** Examine
   - **Content:** Premium coffee setup, suggests successful company
   - **Purpose:** Atmosphere building
   - **Environmental Storytelling:** Startup culture amenities

2. **Trash Bin**
   - **Interaction:** Search
   - **Content:**
     - Discarded meeting notes with "urgent deadline" mentions
     - Food delivery receipts (late-night work)
   - **Purpose:** Shows overwork culture, potential evidence recovery
   - **Objectives:** Optional investigation

**NPCs:**

- **Maya Chen (In-Person, Potential Location)**
  - **Position:** Getting coffee / taking break
  - **Dialogue Trigger:** Player-initiated casual conversation
  - **Provides:** Office gossip, Derek's late hours, suspicious meetings
  - **Objectives:** `talk_to_maya` (can occur here OR conference room)
  - **Trust Level:** Friendly (casual setting encourages openness)
  - **Role:** Informant NPC, provides human perspective

**Objectives Completed Here:**
- `talk_to_maya` (if she's here instead of conference room)
- `check_notice_board` (optional environmental investigation)

**LORE Fragments:** None

**Technical Notes:**
- Unlocked from start to encourage exploration
- Maya may be in break room OR conference room (NPC positioning flexibility)
- Notice board provides employee names for social engineering
- Trash bin search teaches investigation thoroughness

---

### Room 7: Storage Closet (Inside Main Office)

**ID:** `storage_closet`
**Type:** Utility/Storage
**Narrative Purpose:** Lockpicking tutorial, hidden key discovery
**Security Level:** Low (practice lock)

**Description:**
Small storage closet in Main Office Area (accessible as interactable door, not separate room). Contains IT supplies, cleaning materials, and maintenance tools. The lock is simple, making it ideal for lockpicking tutorial. A toolbox on the upper shelf hides Derek's office key.

**Note:** This is technically part of Main Office Area but functions as a locked container/door for lockpicking tutorial purposes.

**Containers:**

1. **Toolbox (Upper Shelf)**
   - **Lock:** None (but closet door is locked)
   - **Contents:**
     - Derek's Office Key (hidden)
     - IT tools (cable testers, crimpers)
     - Flashlight (flavor item)
   - **Narrative Purpose:** Key discovery requires successful lockpicking
   - **Objectives:** `find_derek_key` (enables backtracking to office)
   - **Backtracking:** Player returns here after learning key exists

2. **Supply Shelf**
   - **Lock:** None
   - **Contents:**
     - Paper supplies
     - Cleaning supplies
     - Old equipment
   - **Narrative Purpose:** Flavor, environmental realism

**Interactive Objects:**

1. **Practice Safe (Floor)**
   - **Interaction:** Lockpicking practice
   - **Content:** Tutorial messages, increasing difficulty pins
   - **Purpose:** **Lockpicking tutorial progression**
   - **Objectives:** Part of `lockpick_tutorial` task
   - **Educational Value:** Teaches lockpicking minigame mechanics

**NPCs:** None

**Objectives Completed Here:**
- `lockpick_tutorial` - Pick closet door lock
- `find_derek_key` - Discover hidden office key

**LORE Fragments:** None

**Technical Notes:**
- First lockpicking challenge (easy difficulty)
- Door lock teaches basic pin tumbler mechanics
- Practice safe inside provides progressive difficulty
- Key discovery creates backtracking opportunity to Derek's office

---

## Overall Map Layout

```
                    ┌─────────────────┐
                    │   Derek's       │
                    │    Office       │
                    │    (LOCKED)     │
                    └────────┬────────┘
                             │
                             │ [Lockpick OR Key]
                             │
    ┌──────────┐    ┌────────┴─────────┐    ┌──────────────┐
    │Conference│◄───┤  Main Office     ├───►│ Server Room  │
    │   Room   │    │      Area        │    │   (LOCKED)   │
    └────┬─────┘    │   [HUB]          │    │ [RFID Card]  │
         │          │                  │    └──────────────┘
         │          │ [Storage Closet] │
         │          │   (in-room)      │
         │          └────────┬─────────┘
    ┌────┴─────┐             │
    │  Break   │             │
    │   Room   │             │
    └────┬─────┘             │
         │                   │
         │          ┌────────┴────────┐
         └─────────►│   Reception     │
                    │      Area       │
                    │   [START]       │
                    └─────────────────┘

LEGEND:
├──┤  = Open connection (no door)
(LOCKED) = Requires unlock action
[HUB] = Central navigation point
[START] = Player spawn location
```

**Room Connections Summary:**

- **Reception** connects to: Main Office (north), Break Room (east)
- **Main Office** connects to: Reception (south), Derek's Office (north-locked), Server Room (east-locked), Conference Room (west), Break Room (south)
- **Derek's Office** connects to: Main Office (south-locked)
- **Server Room** connects to: Main Office (west-locked)
- **Conference Room** connects to: Main Office (east), Break Room (north)
- **Break Room** connects to: Reception (west), Conference Room (south), Main Office (north)
- **Storage Closet** is inside Main Office (interactable locked door)

**Design Rationale:**

- **Hub-and-Spoke:** Main Office is central hub, reducing navigation complexity for beginners
- **Progressive Barriers:** Two major locked rooms (Derek's Office, Server Room) gate Act 2 content
- **Open Exploration:** Reception, Break Room, Conference Room accessible early for tutorial exploration
- **Backtracking Paths:** Storage Closet → Derek's Office (key) → Server Room (password) creates interconnected progression

---

## Objectives-to-Room Mapping

### Primary Objective: Investigate Social Fabric Operations

#### Aim 1.1: Establish Presence

**Task: Enter Office** (`enter_office`)
- **Room:** Reception Area
- **Interaction:** Automatic (spawn point)
- **Completion:** Automatic

**Task: Meet Reception** (`meet_reception`)
- **Room:** Reception Area
- **Interaction:** Talk to Sarah (NPC)
- **Completion:** Ink tag `#complete_task:meet_reception`

**Task: Explore Office** (`explore_office`)
- **Rooms:** Reception, Main Office, Break Room, Conference Room
- **Interaction:** Visit multiple public rooms
- **Completion:** Ink tag `#complete_task:explore_office` after 2+ rooms visited

---

#### Aim 1.2: Meet IT Manager Kevin

**Task: Talk to Kevin** (`meet_kevin`)
- **Room:** Main Office Area
- **Interaction:** Talk to Kevin Park (NPC at his desk)
- **Completion:** Ink tag `#complete_task:meet_kevin`

**Task: Receive Lockpick** (`receive_lockpick`)
- **Room:** Main Office Area
- **Interaction:** Kevin gives lockpick set via dialogue
- **Completion:** Ink tag `#give_item:lockpick` + `#complete_task:receive_lockpick`

---

#### Aim 1.3: Tutorial Skills

**Task: Lockpicking Tutorial** (`lockpick_tutorial`)
- **Room:** Main Office Area (storage closet door)
- **Interaction:** Pick storage closet lock
- **Completion:** Minigame success → Ink tag `#complete_task:lockpick_tutorial`

**Task: Find Derek's Key** (`find_derek_key`)
- **Room:** Storage Closet (inside Main Office)
- **Interaction:** Search toolbox on upper shelf
- **Completion:** Ink tag `#complete_task:find_derek_key`

---

#### Aim 2.1: Identify Targets

**Task: Access Derek's Office** (`access_derek_office`)
- **Room:** Derek's Office
- **Interaction:** Unlock door (lockpick OR use key)
- **Completion:** Room entry → Ink tag `#complete_task:access_derek_office`

**Task: Decode Whiteboard** (`decode_whiteboard`)
- **Room:** Derek's Office (message location), Main Office (CyberChef workstation)
- **Interaction:** Examine whiteboard, use CyberChef to decode Base64
- **Completion:** Ink tag `#complete_task:decode_whiteboard`
- **Backtracking:** Office → Main Office → Office

**Task: Gather Password Hints** (`gather_password_hints`)
- **Room:** Main Office Area
- **Interaction:** Talk to Kevin, search his desk drawer
- **Completion:** Ink tag `#complete_task:gather_password_hints`

**Task: Access Derek's Computer** (`access_derek_computer`)
- **Room:** Derek's Office
- **Interaction:** Log into PC using password hint
- **Completion:** Computer unlock → Ink tag `#complete_task:access_derek_computer`

---

#### Aim 2.2: Intercept Communications

**Task: Access Server Room** (`access_server_room`)
- **Room:** Server Room
- **Interaction:** Clone Kevin's card OR lockpick door
- **Completion:** Room entry → Ink tag `#complete_task:access_server_room`

**Task: Access VM Terminal** (`access_vm`)
- **Room:** Server Room
- **Interaction:** Use VM access terminal
- **Completion:** Ink tag `#complete_task:access_vm`

**Task: Submit SSH Flag** (`submit_ssh_flag`)
- **Room:** Server Room
- **Interaction:** Drop-site terminal - submit flag from VM
- **Completion:** Ink tag `#complete_task:submit_ssh_flag`

**Task: Submit Navigation Flag** (`submit_navigation_flag`)
- **Room:** Server Room
- **Interaction:** Drop-site terminal - submit flag from VM
- **Completion:** Ink tag `#complete_task:submit_navigation_flag`

**Task: Submit Sudo Flag** (`submit_sudo_flag`)
- **Room:** Server Room
- **Interaction:** Drop-site terminal - submit flag from VM
- **Completion:** Ink tag `#complete_task:submit_sudo_flag`

---

#### Aim 2.3: Gather Physical Evidence

**Task: Search Filing Cabinet** (`search_filing_cabinet`)
- **Room:** Derek's Office
- **Interaction:** Lockpick filing cabinet, examine contents
- **Completion:** Ink tag `#complete_task:search_filing_cabinet`

**Task: Search Conference Materials** (`search_conference_materials`)
- **Room:** Conference Room
- **Interaction:** Examine documents on table, whiteboards
- **Completion:** Ink tag `#complete_task:search_conference_materials`

**Task: Interview Maya** (`interview_maya`) - Optional
- **Room:** Conference Room OR Break Room
- **Interaction:** Talk to Maya Chen (NPC)
- **Completion:** Ink tag `#complete_task:interview_maya`

---

#### Aim 2.4: Correlate Evidence

**Task: Match Timeline** (`match_timeline`)
- **Rooms:** Multiple (requires revisiting evidence locations)
- **Interaction:** Correlate Derek's emails, VM logs, physical documents
- **Completion:** Ink tag `#complete_task:match_timeline` after accessing all sources

**Task: Identify Operatives** (`identify_operatives`)
- **Rooms:** Multiple (Derek's computer, filing cabinet, VM flags)
- **Interaction:** Synthesize evidence to identify Derek + accomplices
- **Completion:** Ink tag `#complete_task:identify_operatives`
- **Unlocks:** Act 3 confrontation

---

#### Aim 3.1: Confront Derek (Act 3)

**Task: Confront Derek Lawson** (`confront_derek`)
- **Room:** Derek's Office (Derek appears as NPC)
- **Interaction:** Dialogue with Derek (major choice point)
- **Completion:** Ink tag `#complete_task:confront_derek`

**Task: Final Resolution** (`final_resolution`)
- **Room:** Derek's Office
- **Interaction:** Choice-dependent outcome (arrest, recruit, expose)
- **Completion:** Ink tag `#complete_task:final_resolution`
- **Mission Complete:** Triggers debrief

---

### Optional Objective: Collect LORE Fragments

**Fragment 1: Social Fabric Manifesto**
- **Room:** Main Office Area
- **Location:** Filing cabinet (west wall)
- **Requires:** Lockpicking

**Fragment 2: The Architect's Letter to Social Fabric**
- **Room:** Derek's Office
- **Location:** Filing cabinet (hidden folder)
- **Requires:** Lockpicking

**Fragment 3: Network Infrastructure Diagram**
- **Room:** Server Room
- **Location:** IT supply shelf
- **Requires:** Server room access

---

## Progressive Unlocking Flow

### Initial State (Mission Start)

**✅ Accessible:**
- Reception Area (spawn point)
- Main Office Area
- Break Room
- Conference Room

**🔒 Locked:**
- Derek's Office (lockpick OR key required)
- Server Room (RFID card OR lockpick + password)
- Storage Closet (lockpick required - tutorial)

**Available NPCs:**
- Sarah (Reception)
- Kevin (Main Office)
- Maya (Conference Room OR Break Room - optional)

**Available Objectives:**
- `enter_office` (automatic)
- `meet_reception`
- `explore_office`
- `meet_kevin`

---

### After Task: Receive Lockpick (`receive_lockpick` completed)

**🔓 Unlocks:**
- Storage Closet (can now pick lock)

**New Objectives:**
- `lockpick_tutorial` (pick storage closet)

**Narrative State:** Kevin trusts player enough to provide tools

---

### After Task: Lockpick Tutorial (`lockpick_tutorial` completed)

**🔓 Unlocks:**
- Derek's Office (can now pick door lock OR find key)
- Storage Closet interior (find Derek's key)

**New Objectives:**
- `access_derek_office`
- `find_derek_key`

**Player Choice:** Pick Derek's door immediately OR find key in storage closet (both valid)

---

### After Task: Access Derek's Office (`access_derek_office` completed)

**🔓 Unlocks:**
- Derek's Office contents (computer, filing cabinet, whiteboard)

**New Objectives:**
- `decode_whiteboard`
- `access_derek_computer`
- `search_filing_cabinet`

**Backtracking Required:**
- Whiteboard → Main Office (CyberChef) → Derek's Office (complete task)

---

### After Task: Gather Password Hints (`gather_password_hints` completed)

**🔓 Unlocks:**
- Derek's Computer (can log in using password hint)

**New Objectives:**
- `access_derek_computer`

**Intelligence Gained:** SSH credentials for VM access

---

### After Task: Access Derek's Computer (`access_derek_computer` completed)

**🔓 Unlocks:**
- VM access credentials (username, IP address)
- Server room password

**New Objectives:**
- `access_server_room`
- `access_vm`

**Narrative Progression:** Physical investigation yields digital access

---

### After Task: Clone Kevin's Card (`clone_kevin_card` completed) - OR - After Lockpicking Server Room Door

**🔓 Unlocks:**
- Server Room (RFID access OR lockpick bypass)

**New Objectives:**
- `access_server_room`
- `access_vm`

**Player Choice:** Social engineering (card clone) OR stealth (lockpick)

---

### After Task: Access Server Room (`access_server_room` completed)

**🔓 Unlocks:**
- VM Access Terminal
- Drop-Site Terminal
- Server room containers

**New Objectives:**
- `access_vm`
- `submit_ssh_flag`
- `submit_navigation_flag`
- `submit_sudo_flag`

**Narrative State:** Digital exploitation phase begins

---

### After All VM Flags Submitted (`submit_sudo_flag` completed)

**🔓 Unlocks:**
- Final correlation tasks
- Act 3 progression

**New Objectives:**
- `match_timeline`
- `identify_operatives`

**Intelligence Gained:** VM flags reveal ENTROPY communications, operative identities

---

### After Task: Identify Operatives (`identify_operatives` completed)

**🔓 Unlocks:**
- Derek Lawson confrontation (Derek appears as NPC in his office)
- Act 3 content

**New Objectives:**
- `confront_derek`

**Narrative State:** All evidence gathered, ready for confrontation

---

### After Task: Confront Derek (`confront_derek` completed)

**🔓 Unlocks:**
- Final resolution choices (arrest, recruit, expose, eliminate)

**New Objectives:**
- `final_resolution`

**Player Agency:** Major moral choice point (see Stage 3 moral choices)

---

### Final State (Mission Complete)

**✅ All Rooms Accessible:**
- All locks opened or bypassed
- All evidence collected
- All NPCs encountered

**Mission Outcome:**
- Derek Lawson's fate determined by player choice
- Social Fabric operation exposed (degree varies by choice)
- Campaign progression unlocked
- Debrief with Agent 0x99

---

## Required Backtracking

### Backtracking Moment 1: Lockpick Tutorial → Key Discovery → Office Access

**Trigger:** Complete lockpicking tutorial, gain access to storage closet
**From:** Storage Closet
**To:** Derek's Office
**Purpose:** Demonstrate backtracking pattern - initial unlock enables future access
**Educational Value:** Non-linear progression, thorough exploration rewards

**Flow:**
1. Receive lockpick from Kevin (Main Office)
2. Pick storage closet lock (tutorial)
3. Find Derek's office key in toolbox
4. Return to Derek's office door (previously visible but locked)
5. Unlock office with key OR lockpick (player choice)

**Alternative Path:** Player can skip key discovery and lockpick office directly (agency)

---

### Backtracking Moment 2: Whiteboard Decoding → CyberChef → Evidence Correlation

**Trigger:** Find encoded whiteboard message in Derek's office
**From:** Derek's Office
**To:** Main Office (CyberChef workstation) → back to Derek's Office
**Purpose:** Teach encoding/decoding workflow, physical-to-digital evidence correlation
**Educational Value:** Base64 encoding, tool usage, evidence synthesis

**Flow:**
1. Enter Derek's office
2. Examine whiteboard (find Base64 string)
3. Recognize encoding (tutorial hints)
4. Return to Main Office Area
5. Use CyberChef workstation to decode
6. Decode reveals: "Client list update: Coordinating with ZDS"
7. Return to Derek's office with new context
8. Search for "ZDS" references in computer/files

**Educational Moments:**
- Encoding ≠ encryption (teaches concept)
- Tool-based analysis (CyberChef practical usage)
- Evidence correlation (decoded message → computer files)

---

### Backtracking Moment 3: Social Engineering → Password Discovery → VM Access

**Trigger:** Complete social engineering with Kevin, gather password hints
**From:** Main Office Area (Kevin's desk)
**To:** Derek's Office (computer) → Server Room (VM)
**Purpose:** Demonstrate social engineering → digital exploitation workflow
**Educational Value:** Password guessing, SSH access, hybrid methodology

**Flow:**
1. Build trust with Kevin through dialogue
2. Kevin provides password hints (willingly or carelessly)
3. Travel to Derek's office
4. Use password hint to log into Derek's computer
5. Find SSH credentials on computer
6. Travel to Server Room
7. Use credentials to access VM
8. Complete VM challenges
9. Submit flags at drop-site terminal (same room)

**Educational Moments:**
- Social engineering yields digital access
- Password reuse patterns
- SSH brute force (guided by hints)
- Physical → digital evidence chain

---

### Backtracking Moment 4: VM Flags → Physical Evidence Correlation → Operative Identification

**Trigger:** Submit all VM flags, unlock ENTROPY communications intel
**From:** Server Room
**To:** Derek's Office, Conference Room, Main Office (revisiting evidence)
**Purpose:** Correlation task - synthesize digital and physical evidence
**Educational Value:** Evidence analysis, timeline construction, identifying patterns

**Flow:**
1. Complete all VM challenges (SSH, navigation, sudo)
2. Submit flags at drop-site terminal
3. Flags unlock intelligence reports (Ink dialogue/notes)
4. Intelligence references dates, times, and locations
5. Return to Derek's office (computer emails)
6. Match email timestamps to VM log entries
7. Visit Conference Room (whiteboard notes)
8. Correlate meeting dates with suspicious activity
9. Visit Main Office (filing cabinet)
10. LORE fragment connections to The Architect
11. Complete correlation → identify Derek + accomplices

**Educational Moments:**
- Digital forensics (log analysis)
- Timeline correlation
- Pattern recognition
- Evidence synthesis

**Completion:** Unlocks Act 3 confrontation

---

### Backtracking Moment 5: Evidence Gathering → Confrontation Preparation → Derek Encounter

**Trigger:** Identify operatives, all evidence collected
**From:** Various rooms
**To:** Derek's Office (Derek appears as NPC)
**Purpose:** Final preparation before climax
**Educational Value:** Thorough investigation enables informed choices

**Flow:**
1. Complete all evidence gathering tasks
2. Review collected evidence (inventory notes)
3. Optional: Return to rooms for missed LORE fragments
4. Receive Agent 0x99 phone call (Ink dialogue)
5. 0x99 provides confrontation guidance
6. Enter Derek's office
7. Derek appears as NPC (scripted encounter)
8. Confrontation dialogue begins (Act 3)

**Player Agency:** Better evidence = more dialogue options in confrontation

---

## Container and Lock Summary

### All Containers

| Room | Container Type | Lock Type | Key Contents | Unlock Condition | Objectives |
|------|----------------|-----------|--------------|------------------|------------|
| Reception | Desk Drawer | None | Building directory, visitor log | Always accessible | `explore_office` |
| Reception | Company Directory | None | Employee names/offices | Always accessible | Intel gathering |
| Reception | PC (Sarah's) | None | Derek's emails, meeting calendar | Always accessible | Intel gathering |
| Main Office | Kevin's Desk Drawer | None | Password hints, network diagram | Always accessible | `gather_password_hints` |
| Main Office | Storage Closet Door | Physical Lock | (contains toolbox) | Lockpicking tutorial | `lockpick_tutorial` |
| Main Office | Toolbox (in closet) | None | Derek's office key | After opening closet | `find_derek_key` |
| Main Office | Filing Cabinet | Physical Lock | LORE Fragment 1, employee records | Lockpicking (medium) | LORE collection |
| Derek's Office | PC | Password | SSH credentials, emails | Password from Kevin | `access_derek_computer` |
| Derek's Office | Filing Cabinet | Physical Lock | Disinformation plans, LORE Fragment 2 | Lockpicking (medium) | `search_filing_cabinet`, LORE |
| Derek's Office | Desk Drawer | None | Burner phone, travel docs | Always (after office access) | Flavor |
| Server Room | Server Rack Cabinet | None | Network cables, documentation | After room access | Flavor |
| Server Room | IT Supply Shelf | None | LORE Fragment 3 | After room access | LORE collection |
| Conference | Conference Table | None | Meeting agenda, client presentation | Always accessible | `search_conference_materials` |
| Conference | A/V Cabinet | None | Presentation files | Always accessible | Intel gathering |
| Break Room | Refrigerator | None | Food, energy drinks | Always accessible | Flavor |
| Break Room | Notice Board | None | Employee directory, events | Always accessible | Social engineering intel |
| Break Room | Trash Bin | None | Discarded notes | Always accessible | Optional investigation |

---

### All Locks and Keys

| Lock Location | Lock Type | Unlock Method | Key/Code Source | Difficulty | Tutorial Value |
|---------------|-----------|---------------|-----------------|------------|----------------|
| Storage Closet Door | Physical (Pin Tumbler) | Lockpicking | Kevin provides lockpick | Easy | **Lockpicking Tutorial** |
| Derek's Office Door | Physical (Pin Tumbler) | Lockpicking OR Key | Key in storage closet toolbox | Medium | Player choice (two paths) |
| Derek's PC | Password | Password entry | Kevin's password hints | Easy | Password guessing |
| Derek's Filing Cabinet | Physical (Pin Tumbler) | Lockpicking | Requires lockpick from Kevin | Medium | Evidence retrieval |
| Main Office Filing Cabinet | Physical (Pin Tumbler) | Lockpicking | Requires lockpick from Kevin | Medium | Optional LORE |
| Server Room Door | RFID OR Physical | Clone Kevin's card OR Lockpick | Clone card OR pick lock | Medium/Hard | **Two-method unlock** |

**Lock Progression Design:**
- **Easy (Storage Closet):** Tutorial lock, forgiving mechanics
- **Medium (Derek's Office):** Standard difficulty, reinforces tutorial
- **Medium-Hard (Filing Cabinets):** Optional challenges, rewards thoroughness
- **Hard (Server Room):** Advanced challenge OR social engineering bypass

**Player Agency in Locks:**
- Most locks have **two unlock methods** (lockpick vs. find key, lockpick vs. RFID clone)
- Rewards multiple playstyles (stealth vs. social engineering)
- No "correct" path - all methods valid

---

## NPC Placement Summary

| NPC Name | Room | In-Person/Phone | Dialogue Purpose | Items Given | Objectives | Trust System |
|----------|------|-----------------|------------------|-------------|------------|--------------|
| Agent 0x99 (Haxolottle) | N/A | Phone (player phone) | Mission briefing, guidance, debrief | None | Tutorial hints, Act transitions | N/A (handler) |
| Sarah Martinez | Reception | In-Person | Check-in, cover establishment, office intel | Visitor badge | `meet_reception` | Neutral → Friendly |
| Kevin Park | Main Office | In-Person | IT assistance, social engineering, tool provider | Lockpick set, RFID card (clone), password hints | `meet_kevin`, `receive_lockpick`, `gather_password_hints`, `clone_kevin_card` | Low → Medium → High |
| Maya Chen | Conference Room OR Break Room | In-Person (optional) | Office gossip, witness testimony, Derek's behavior | None | `interview_maya` (optional) | Neutral → Helpful |
| Derek Lawson | Derek's Office | In-Person (Act 3 only) | Confrontation, moral choice, resolution | None | `confront_derek`, `final_resolution` | N/A (antagonist) |

**NPC Positioning Strategy:**

- **Sarah (Reception):** Stationary at desk - first NPC encounter, establishes cover
- **Kevin (Main Office):** Stationary at IT desk - central hub placement for easy access
- **Maya (Conference/Break):** Mobile - may be in either room, encourages exploration
- **Derek (Office - Act 3 only):** Scripted appearance after `identify_operatives` complete

**Phone vs. In-Person:**
- **In-Person:** Sarah, Kevin, Maya, Derek (physical presence supports social engineering)
- **Phone:** Agent 0x99 (remote handler, accessible anywhere)

**Trust Progression Example (Kevin):**

1. **Low Trust (Initial):** Polite but professional, minimal information
2. **Medium Trust (After building rapport):** Provides password hints, lockpick set
3. **High Trust (After demonstrating competence):** Allows RFID card cloning, shares suspicions about Derek

**NPC Dialogue Integration:**
- All dialogue via Ink scripts (Stage 7)
- Trust levels tracked via Ink variables (`trust_kevin`, `trust_sarah`, etc.)
- Items given via `#give_item` tags
- Objectives completed via `#complete_task` tags

---

## Hybrid Architecture Integration

### VM Access Points

| Room | Terminal Name | Access Requirements | VM Challenge | Unlocks | Objectives |
|------|---------------|---------------------|--------------|---------|------------|
| Server Room | System Admin Workstation | Server room entry + SSH credentials from Derek's PC | SSH brute force | Navigation challenge | `access_vm` |
| Server Room | System Admin Workstation | Successful SSH access | Linux basic navigation (find flags in filesystem) | Privilege escalation challenge | `submit_navigation_flag` |
| Server Room | System Admin Workstation | Linux navigation complete | Privilege escalation (sudo exploit) | Final intelligence | `submit_sudo_flag` |

**VM Challenge Sequence:**

1. **SSH Brute Force:**
   - Username: `derek_lawson` (from Derek's PC)
   - IP: `192.168.1.100` (from Derek's PC)
   - Password: From Kevin's hints ("Marketing123", "Campaign2024", "Viral_Dynamics_Admin")
   - Success: Log into target server

2. **Linux Navigation:**
   - Find hidden files in `/home/derek_lawson/`
   - Cat files to reveal encrypted messages
   - Locate flag in `/var/log/entropy_comms.txt`
   - Submit flag: `FLAG{social_fabric_comms_intercepted}`

3. **Privilege Escalation:**
   - Check `sudo -l` permissions
   - Exploit misconfigured sudo rules
   - Access `/root/` directory
   - Find final flag: `FLAG{architect_commands_discovered}`
   - Submit flag: Campaign-level intelligence unlocked

**Educational Integration:**
- SSH concepts and authentication
- Basic Linux command line (ls, cd, cat, grep)
- File permissions and sudo
- Simulated network intrusion

---

### Drop-Site Terminals

| Room | Terminal Name | Flags Submitted Here | Unlocks | Narrative Effect |
|------|---------------|---------------------|---------|------------------|
| Server Room | Drop-Site Terminal (Secondary Workstation) | `FLAG{social_fabric_comms_intercepted}` (SSH) | Intelligence report on ZDS (ENTROPY front), unlocks `match_timeline` | Confirms Derek's ENTROPY connection |
| Server Room | Drop-Site Terminal | `FLAG{navigation_complete}` (Linux navigation) | Chat logs between Derek and "The Architect", unlocks `identify_operatives` | Reveals Social Fabric cell structure |
| Server Room | Drop-Site Terminal | `FLAG{architect_commands_discovered}` (privilege escalation) | Direct orders from The Architect, campaign intelligence, unlocks Act 3 | Mission-critical intel, confrontation enabled |

**Flag Submission Flow:**

1. Player completes VM challenge
2. Receives flag in VM terminal
3. Minimizes or exits VM window
4. Walks to drop-site terminal (same room, different position)
5. Interacts with terminal
6. Flag auto-detected or manually entered
7. Ink tag `#complete_task:submit_[flag_type]_flag`
8. Unlocks narrative content (notes, dialogue, objectives)

**Design Rationale:**
- Separate terminals prevent UI conflict (can't interact with game while in VM)
- Drop-site terminal in same room reduces navigation friction
- Flag submission triggers narrative progression (hybrid integration)

---

### CyberChef Workstation

| Room | Workstation Name | Used For | Challenges | Educational Value | Objectives |
|------|------------------|----------|------------|-------------------|------------|
| Main Office | CyberChef Analysis Station | Base64 decoding | Decode Derek's whiteboard message | Encoding vs. encryption, Base64 mechanics | `decode_whiteboard` |
| Main Office | CyberChef Analysis Station | Hex analysis (future challenges) | Decode hex-encoded messages in emails | Hex representation, ASCII conversion | Future missions |

**CyberChef Usage Flow:**

1. Player finds encoded message (whiteboard, email, note)
2. Recognizes encoding pattern (tutorial hints)
3. Walks to CyberChef workstation (Main Office)
4. Interacts with workstation
5. CyberChef minigame interface opens
6. Select operation (Base64 decode)
7. Paste encoded string
8. View decoded output
9. Decode reveals: "Client list update: Coordinating with ZDS"
10. Ink tag `#complete_task:decode_whiteboard`

**Educational Integration:**
- Base64 encoding concepts
- Encoding vs. encryption (not secure, just obfuscated)
- CyberChef as industry-standard tool
- Practical decoding workflow

---

## Progressive Unlocking Flow Diagram

```
START: Spawn in Reception Area
│
├─ [Act 1: Tutorial - 0-20 min]
│  ├─ Talk to Sarah (reception) → Visitor badge
│  ├─ Explore public areas (reception, break room, conference, main office)
│  ├─ Meet Kevin (main office) → Build initial trust
│  ├─ Kevin gives lockpick set → Tutorial enabled
│  └─ Pick storage closet lock → Lockpicking tutorial complete
│     └─ Find Derek's office key (in closet)
│
├─ [Act 2: Investigation - 20-50 min]
│  │
│  ├─ [Path A: Derek's Office - Physical Evidence]
│  │  ├─ Unlock Derek's office (lockpick OR use key)
│  │  ├─ Examine whiteboard (Base64 encoded message)
│  │  │  └─ **BACKTRACK to Main Office → Use CyberChef → Decode message**
│  │  ├─ Access Derek's computer (password from Kevin's hints)
│  │  │  └─ Find SSH credentials, email evidence
│  │  └─ Lockpick filing cabinet
│  │     └─ Find disinformation plans, LORE Fragment 2
│  │
│  ├─ [Path B: Server Room - Digital Exploitation]
│  │  ├─ Clone Kevin's RFID card OR lockpick server room door
│  │  ├─ Enter server room
│  │  ├─ Access VM terminal (using SSH credentials from Derek's PC)
│  │  ├─ VM Challenge 1: SSH brute force
│  │  │  └─ Submit flag at drop-site terminal → Intel unlocked
│  │  ├─ VM Challenge 2: Linux navigation
│  │  │  └─ Submit flag at drop-site terminal → Chat logs unlocked
│  │  └─ VM Challenge 3: Privilege escalation
│  │     └─ Submit flag at drop-site terminal → Architect orders unlocked
│  │
│  ├─ [Path C: Correlation - Evidence Synthesis]
│  │  ├─ **BACKTRACK to Derek's office** → Match timestamps
│  │  ├─ **BACKTRACK to Conference Room** → Analyze meeting notes
│  │  ├─ Correlate VM logs + emails + physical documents
│  │  └─ Identify Derek Lawson + accomplices
│  │
│  └─ Act 2 Complete → All evidence gathered
│
└─ [Act 3: Confrontation - 50-60 min]
   ├─ Agent 0x99 phone call → Guidance for confrontation
   ├─ Derek appears in his office (NPC spawns)
   ├─ Confrontation dialogue → Present evidence
   ├─ Major Moral Choice (see Stage 3):
   │  ├─ Option 1: Surgical Strike (report to authorities, protect business)
   │  ├─ Option 2: Full Exposure (leak publicly, destroy company)
   │  ├─ Option 3: Recruit Derek (turn him into double agent)
   │  └─ Option 4: Eliminate (lethal action - ruthless)
   ├─ Resolution outcome (varies by choice)
   ├─ SAFETYNET intervention (agents arrive)
   └─ Mission Complete → Debrief with 0x99

LEGEND:
→ = Direct progression
└─ = Unlocks/enables
**BACKTRACK** = Required return to previous location
[Path] = Parallel objectives (can be done in any order)
```

**Design Notes:**

- **Act 1 is linear** (tutorial flow) but allows free exploration within public areas
- **Act 2 has three parallel paths** (Derek's office, server room, correlation) completable in any order
- **Required backtracking** teaches non-linear investigation (whiteboard → CyberChef → office)
- **Act 3 is linear** (confrontation sequence) but player choices create branching outcomes

---

## Technical Validation

### Room: Reception Area (`reception_area`)

- ✅ Room type defined (`room_reception`)
- ✅ Connections specified (north to main_office, east to break_room)
- ✅ All containers have contents specified
- ✅ NPCs positioned (Sarah at reception desk)
- ✅ Objectives mapped (`enter_office`, `meet_reception`, `explore_office`)
- ✅ No circular dependencies (always accessible)

### Room: Main Office Area (`main_office_area`)

- ✅ Room type defined (`room_office` - open plan)
- ✅ Connections specified (4 connections: south, north-locked, east-locked, west)
- ✅ All containers have contents and lock types specified
- ✅ NPCs positioned (Kevin at IT desk)
- ✅ Storage closet lockpicking tutorial designed
- ✅ CyberChef workstation placed
- ✅ Objectives mapped (multiple tutorial and investigation tasks)
- ✅ Hub room - central navigation point

### Room: Derek's Office (`derek_office`)

- ✅ Room type defined (`room_office`)
- ✅ Locked door with two unlock methods (lockpick OR key)
- ✅ Key source specified (storage closet toolbox)
- ✅ All containers have locks and contents specified
- ✅ PC password source specified (Kevin's hints)
- ✅ Whiteboard encoding challenge designed (Base64)
- ✅ Objectives mapped (`access_derek_office`, `decode_whiteboard`, etc.)
- ✅ Backtracking designed (whiteboard → CyberChef)

### Room: Server Room (`server_room`)

- ✅ Room type defined (`room_servers`)
- ✅ Locked door with two unlock methods (RFID clone OR lockpick)
- ✅ RFID card source specified (clone from Kevin)
- ✅ Password source specified (Derek's computer)
- ✅ VM access terminal placed and specified
- ✅ Drop-site terminal placed (separate from VM terminal)
- ✅ All containers have contents specified
- ✅ Objectives mapped (all VM flag tasks)
- ✅ No circular dependencies (Derek's PC provides credentials)

### Room: Conference Room (`conference_room`)

- ✅ Room type defined (`room_conference`)
- ✅ Connections specified (east to main_office, north to break_room)
- ✅ Unlocked from start (public area)
- ✅ All containers have contents specified
- ✅ NPCs positioned (Maya - optional encounter)
- ✅ Objectives mapped (`search_conference_materials`, `interview_maya`)
- ✅ Environmental storytelling elements specified

### Room: Break Room (`break_room`)

- ✅ Room type defined (`room_breakroom`)
- ✅ Connections specified (3 connections: west, south, north)
- ✅ Unlocked from start (public area)
- ✅ All containers have contents specified
- ✅ NPCs positioned (Maya - alternate location)
- ✅ Objectives mapped (optional tasks)
- ✅ No critical path dependencies (flavor room)

### Room: Storage Closet (`storage_closet`)

- ✅ Lockpicking tutorial lock specified (easy difficulty)
- ✅ Contents specified (toolbox with Derek's key)
- ✅ Practice safe inside for tutorial progression
- ✅ Objectives mapped (`lockpick_tutorial`, `find_derek_key`)
- ✅ Enables backtracking to Derek's office

---

## Overall Design Validation

### Technical Compliance
- ✅ All rooms have type specified
- ✅ All connections defined bidirectionally
- ✅ All locked rooms have unlock methods specified
- ✅ All locks have key/code sources specified
- ✅ No circular dependencies (can't need key from locked room to unlock that room)
- ✅ All containers have contents specified
- ✅ All NPCs have positions and dialogue purposes specified

### Container Integration
- ✅ Container types appropriate for locations (filing cabinets in offices, fridges in break room)
- ✅ Locked containers have unlock methods specified
- ✅ Critical evidence in narratively justified containers
- ✅ Container positions within rooms make logical sense
- ✅ 2-4 containers per room (not overwhelming)

### Lock and Key System
- ✅ All locks have unlock methods (lockpick, key, password, RFID)
- ✅ Progressive unlocking creates good pacing (storage → Derek's office → server room)
- ✅ No circular dependencies (lockpick → key → credentials progression)
- ✅ Backtracking opportunities designed intentionally (3+ moments)
- ✅ Multiple unlock paths support player agency (lockpick vs. key, lockpick vs. RFID)

### NPC Integration
- ✅ All NPCs have positions specified
- ✅ In-person vs. phone mode chosen appropriately (all in-person except 0x99)
- ✅ NPC positions valid within room logic (Sarah at desk, Kevin at IT corner)
- ✅ No patrol routes (beginner mission - static NPCs)
- ✅ NPC dialogue purposes clear (tutorial, intel, items)

### Objectives Integration
- ✅ Every task from Stage 4 mapped to room location
- ✅ Every task has interaction method specified
- ✅ VM access points and drop-site terminals placed
- ✅ Objectives create logical progression through rooms (tutorial → investigation → confrontation)
- ✅ Optional objectives accessible but not blocking main path (LORE fragments, Maya interview)

### Hybrid Architecture
- ✅ VM access terminal placed in narratively justified location (server room)
- ✅ Drop-site terminal accessible for flag submission (server room, separate from VM terminal)
- ✅ CyberChef workstation placed for decoding challenges (main office)
- ✅ Physical evidence correlates with VM findings (emails → VM logs)

### Gameplay Flow
- ✅ Clear starting area (reception)
- ✅ Progressive unlocking creates good pacing (Act 1: public, Act 2: locked, Act 3: all)
- ✅ Required backtracking designed (3+ moments specified)
- ✅ Multiple solution paths where appropriate (lockpick vs. key, lockpick vs. RFID)
- ✅ No dead ends or soft locks (all progression paths tested)

### Narrative Support
- ✅ Room layout supports three-act structure (public → locked → confrontation)
- ✅ Atmosphere appropriate for narrative theme (startup office, after-hours)
- ✅ Environmental storytelling opportunities (awards, posters, whiteboards)
- ✅ Choice moments have appropriate settings (Derek's office for confrontation)

---

## Design Notes

### Pacing

**Act 1 (0-20 min): Tutorial Pace**
- Open exploration encourages player comfort
- NPCs provide guidance without hand-holding
- Lockpicking tutorial at 10-15 min mark (after exploration)
- Low stakes, forgiving mechanics

**Act 2 (20-50 min): Investigation Pace**
- Progressive unlocking creates rhythm: unlock → explore → gather intel → next unlock
- Backtracking moments prevent monotony (whiteboard → CyberChef → office)
- Parallel paths allow player-controlled pacing (Derek's office vs. server room order)
- VM challenges provide variety (physical → digital → physical)

**Act 3 (50-60 min): Confrontation Pace**
- Linear sequence accelerates tension
- All evidence gathered = player feels prepared
- Dialogue-heavy (less exploration)
- Moral choice creates pause for reflection
- Resolution depends on player choice (agency)

**Overall Pacing Design:**
- **20 min tutorial** (gentle introduction)
- **30 min investigation** (peak complexity)
- **10 min confrontation** (climax and resolution)
- Total: **60 minutes** for thorough playthrough

---

### Difficulty Curve

**Early Game (Reception → Main Office):**
- No locks (public access)
- Friendly NPCs (Sarah, Kevin)
- Clear objectives
- Difficulty: **Tier 0 (Introduction)**

**Mid Game (Storage Closet → Derek's Office):**
- Lockpicking tutorial (easy lock)
- Password guessing (hints provided)
- Base64 decoding (guided tutorial)
- Difficulty: **Tier 1 (Beginner)**

**Late Game (Server Room → VM Challenges):**
- RFID cloning OR advanced lockpicking
- SSH brute force (with hints)
- Linux command line
- Difficulty: **Tier 1-2 (Beginner → Intermediate)**

**End Game (Confrontation):**
- No technical difficulty
- Moral/narrative complexity
- Player agency in resolution
- Difficulty: **Tier 1 (Beginner narrative choice)**

**Difficulty Curve Design:**
- Gradual increase (tutorial → investigation → VM)
- Multiple difficulty paths (lockpick vs. social engineering)
- No sudden spikes (all challenges tutorialized)
- Accessible for beginners, satisfying for advanced players

---

### Atmosphere

**Viral Dynamics Office Aesthetic:**
- **Visual:** Modern startup - exposed brick, motivational posters, branded merch, open floor plan
- **Lighting:** Dim evening lighting (after-hours), desk lamps, monitor glow
- **Sound:** Quiet office - keyboard clicks, distant server hum, occasional phone ring
- **Mood:** Professional facade hiding sinister operations

**Atmospheric Progression:**

**Act 1 (Public Areas):**
- Bright, welcoming (reception, break room)
- Normal office sounds
- Friendly NPCs
- Mood: Comfortable, safe

**Act 2 (Restricted Areas):**
- Darker (offices, server room)
- Empty, abandoned feel
- Locked doors increase tension
- Mood: Investigative, tense

**Act 3 (Confrontation):**
- Derek's office - professional but cold
- Silence before confrontation
- Direct lighting (no hiding)
- Mood: Climactic, high-stakes

**Environmental Storytelling Elements:**
- Motivational posters with ironic subtext ("Making Ideas Viral" - literally spreading disinformation)
- Award displays (Derek's cover is thorough)
- Late-night work culture (energy drinks, overtime signs)
- Professional surface hiding ENTROPY operations

---

### Player Guidance

**Signposting Without Hand-Holding:**

**Visual Guidance:**
- Locked doors visually distinct (red lock icon, "LOCKED" indicator)
- NPCs positioned in clear sight lines (Sarah at desk, Kevin in IT corner)
- Interactive objects highlighted (whiteboards, computers)
- Objective markers (optional HUD element)

**Narrative Guidance:**
- NPC dialogue hints next steps ("Check Derek's office", "Server room needs card")
- Ink objectives panel shows active tasks
- Agent 0x99 phone calls provide gentle nudges
- Environmental clues (building directory shows Derek's office number)

**Tutorial Guidance:**
- Lockpicking tutorial at storage closet (Kevin explains mechanics)
- CyberChef tutorial when first encountering encoded message
- VM access tutorial (0x99 explains SSH process)
- Choice tutorials (consequences explained before major decisions)

**Avoiding Over-Guidance:**
- No constant waypoints (player navigates using room names)
- NPCs provide hints, not solutions (Kevin suggests passwords, doesn't give exact one)
- Objectives describe goals, not step-by-step instructions ("Access Derek's office" not "Pick lock at coordinates X,Y")
- Player discovers backtracking opportunities organically

**Guidance Balance:**
- Beginners: Objectives, NPC hints, tutorials sufficient
- Advanced players: Can ignore hints, speedrun using skill
- All players: Never lost, never hand-held

---

## Summary for Stage 9 (Scenario Assembly)

**Room Layout Complete:** 7 rooms designed with full spatial and narrative specifications

**Key Information for JSON Implementation:**

1. **Room Types:**
   - reception_area: `room_reception`
   - main_office_area: `room_office`
   - derek_office: `room_office`
   - server_room: `room_servers`
   - conference_room: `room_conference`
   - break_room: `room_breakroom`
   - storage_closet: `room_storage` (OR interactable door in main_office)

2. **Critical Lock Chains:**
   - Storage Closet (easy lock) → Derek's Office Key → Derek's Office (OR lockpick office directly)
   - Kevin's Trust → RFID Card Clone → Server Room (OR lockpick server room)
   - Derek's Computer → SSH Credentials → VM Access

3. **VM Integration:**
   - VM Access Terminal: Server Room (center position)
   - Drop-Site Terminal: Server Room (northeast corner, separate from VM terminal)
   - CyberChef Workstation: Main Office Area (near Kevin's desk)

4. **NPC Placement:**
   - Sarah Martinez: Reception Area (in-person, stationary)
   - Kevin Park: Main Office Area (in-person, stationary at IT desk)
   - Maya Chen: Conference Room OR Break Room (in-person, mobile - random spawn)
   - Derek Lawson: Derek's Office (in-person, Act 3 only - scripted spawn)
   - Agent 0x99: Phone (accessible anywhere)

5. **Progressive Unlocking Sequence:**
   - START: Reception, Main Office, Break Room, Conference Room accessible
   - After lockpick received: Storage Closet pickable
   - After lockpicking tutorial: Derek's Office pickable (OR use key)
   - After Derek's computer: Server Room credentials available
   - After RFID clone OR lockpicking: Server Room accessible
   - After evidence gathered: Act 3 Derek encounter

6. **Required Backtracking:**
   - Whiteboard (Derek's Office) → CyberChef (Main Office) → Return to Derek's Office
   - Password Hints (Kevin) → Derek's Computer → SSH Credentials → Server Room
   - VM Flags (Server Room) → Evidence Correlation → Multiple Rooms → Act 3

7. **Container Contents Summary:**
   - 18 total containers across 7 rooms
   - 7 locked containers (6 lockpicking, 1 password)
   - 11 unlocked containers (public access or conditional)
   - 3 LORE Fragments (optional collection)

8. **Lock Types:**
   - Physical (Pin Tumbler): Storage closet, Derek's office door, filing cabinets
   - Password: Derek's computer
   - RFID: Server room door
   - Multiple paths: Derek's office (lockpick OR key), Server room (RFID OR lockpick)

**Technical Compliance:** All validation checklists passed. Design ready for JSON implementation in Stage 9.

**Next Stage (Stage 6 - LORE Fragments):** 3 fragment positions specified, content to be created.
**Next Stage (Stage 7 - Ink Scripting):** NPC positions, container interactions, and terminal locations documented for dialogue implementation.
**Next Stage (Stage 9 - Scenario Assembly):** Complete design specifications provided for scenario.json.erb creation and logical flow validation.

---

**Document Complete:** Mission 1 First Contact - Room Layout Design
**Stage 5 Status:** ✅ Complete
**Ready for:** Stage 6 (LORE Fragments), Stage 7 (Ink Scripting), Stage 9 (Scenario Assembly)
