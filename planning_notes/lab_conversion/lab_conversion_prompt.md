# Lab Conversion Prompt

## Overview

Convert one of the existing lab Ink files from `story_design/ink/lab_sheets/` into a new Break Escape scenario following the same pattern as `scenarios/lab_intro_linux`. This involves creating a new scenario directory, copying and editing the Ink file, configuring the scenario JSON, and setting up objectives with flag tracking.

## Available Lab Files

Choose one of these lab Ink files to convert:

- `encoding_encryption.ink`
- `exploitation.ink`
- `feeling_blu_ctf.ink`
- `intro_linux.ink` (already converted - use as reference)
- `malware_metasploit.ink`
- `phishing_social_engineering.ink`
- `post_exploitation.ink`
- `scanning.ink`
- `vulnerabilities_exploits.ink`
- `vulnerability_analysis.ink`

## Step 1: Determine the Lab Configuration

First, identify which SecGen scenario corresponds to your chosen lab by examining the SecGen XML files:

```bash
cat /home/cliffe/Files/Projects/Code/SecGen/scenarios/labs/introducing_attacks/1_intro_linux.xml
cat /home/cliffe/Files/Projects/Code/SecGen/scenarios/labs/introducing_attacks/2_malware_msf_payloads.xml
cat /home/cliffe/Files/Projects/Code/SecGen/scenarios/labs/introducing_attacks/3_vulnerabilities.xml
# ... etc for other lab numbers
```

From the XML file, identify:
- **System names** (e.g., "desktop", "kali", "server")
- **IP addresses** for each system
- **Number of flags** and which systems they're on
- **Lab sheet URL** (if present in XML)
- **Difficulty level** and **CyBOK topics**

## Step 2: Create New Scenario Directory

1. Copy the entire `scenarios/lab_intro_linux` directory to a new directory named after your lab (e.g., `scenarios/lab_malware_metasploit`)

2. Update `mission.json`:
   - Change `display_name` to match your lab topic
   - Update `description` to describe the lab content
   - Set `difficulty_level` appropriately (1-5)
   - Update `secgen_scenario` to match the XML path (e.g., `"labs/introducing_attacks/2_malware_msf_payloads.xml"`)
   - Update `cybok` array with relevant topics and keywords from the XML

## Step 3: Copy and Edit the Ink File

1. Copy the relevant Ink file from `story_design/ink/lab_sheets/` to `scenarios/{your_lab_name}/ink/instructor.ink`

2. Apply the following transformations to the Ink file:

### 3.1 Remove Speaker Tags
- Remove all "Tech Instructor:" prefixes from dialogue lines (using sed or find and replace)
- Dialogue should flow naturally without explicit speaker attribution (the game engine handles this)

### 3.2 Add Influence Tags
- Find all instances where influence/rapport/favour variables are incremented (e.g., `~ instructor_rapport += 5`)
- Add `#influence_increased` tag immediately after each increment
- Example:
  ```ink
  ~ instructor_rapport += 5
  #influence_increased
  ```
- If there are any decrements, add `#influence_decreased` after them

### 3.3 Convert Lists to Flowing Sentences
- Find all bullet-point lists and numbered lists in dialogue
- Convert them to comma-separated sentences with "and" for the final item
- Example:
  ```ink
  ❌ WRONG:
  You've shown you can:
  - Navigate Linux systems effectively
  - Use SSH for remote access
  
  ✅ RIGHT:
  You've shown you can navigate Linux systems effectively, use SSH for remote access, and perform security testing with tools like Hydra.
  ```

### 3.4 Ensure Hub-Based Structure
- Verify the conversation follows the hub pattern (see `@docs/INK_BEST_PRACTICES.md`)
- Ensure `=== start ===` goes to `=== hub ===`
- Ensure all topic knots return to hub with `-> hub`
- Ensure hub has at least one `+ [Exit/Leave] #exit_conversation` choice
- Remove any `-> END` statements (replace with `-> hub`)

### 3.5 Add Timed Intro Conversation
- Create a new `=== intro_timed ===` knot that:
  - Introduces the technical instructor
  - Explains the three key resources:
    - Lab Sheet Workstation (for written instructions)
    - VM terminals (for hands-on practice)
    - Flag Submission Terminal (for submitting captured flags)
  - Mentions players can talk to NPC for concepts and tips
  - Flows to `linux_training_hub` (or your hub name)
- Update `=== start ===` to be a simple entry point that goes directly to hub

### 3.6 Remove Markdown Formatting
- Remove any `**bold**` markdown syntax (Ink doesn't support it)
- Remove any lines starting with `*` that aren't choices
- Use plain text for emphasis instead

### 3.7 Update Variable Names
- If the Ink file uses different variable names (e.g., `instructor_rapport`), keep them consistent
- Ensure global variables match what's declared in `scenario.json.erb`

## Step 4: Update scenario.json.erb

### 4.1 Update Global Variables
- Add any new variables needed for the lab
- Remove variables specific to intro_linux if not needed

### 4.2 Update Objectives
- Create a `submit_flags` task with `targetFlags` array
- Generate flag identifiers based on VM names and flag positions:
  - Format: `{vmId}-flag{index}` (1-indexed)
  - Example: If desktop VM has 2 flags, they're `"desktop-flag1"` and `"desktop-flag2"`
  - Example: If kali VM has 1 flag, it's `"kali-flag1"`
- Set `targetCount` to match the number of flags
- Set `showProgress: true` to display progress like "(1/2 flags)"

### 4.3 Update Rooms
- Update room names to match your lab theme
- Configure VM launchers:
  - Use `vm_object()` ERB helper for each VM
  - Set correct `title` (system name from XML), `ip` (from XML), and `id` (sequential)
- Configure flag station:
  - Set `acceptsVms` array to list which VMs' flags are accepted
  - Use `flags_for_vm()` ERB helper to configure flags
  - Remove individual flag task rewards (the `submit_flags` task handles tracking)

### 4.4 Update NPC Configuration
- Update NPC `displayName` if needed
- Set `timedConversation`:
  ```json
  "timedConversation": {
    "delay": 3000,
    "knot": "intro_timed"
  }
  ```
- Add `eventMappings` if you want to trigger conversations on aim completion:
  ```json
  "eventMappings": [
    {
      "eventPattern": "objective_aim_completed:complete_vm_lab",
      "targetKnot": "flags_completed_congrats",
      "conversationMode": "person-chat",
      "autoTrigger": true,
      "cooldown": 0
    }
  ]
  ```

### 4.5 Update Lab Workstation
- Update `labUrl` to match the lab sheet URL from the SecGen XML (if present)
- Or use the pattern: `https://cliffe.github.io/HacktivityLabSheets/labs/introducing_attacks/{lab_number}-{lab_name}/`

## Step 5: Compile and Validate

1. **Compile the Ink file:**
   ```bash
   ./bin/inklecate -jo scenarios/{your_lab_name}/ink/instructor.json scenarios/{your_lab_name}/ink/instructor.ink
   ```
   - Fix any compilation errors (check for "apparent loose end" warnings)
   - Ensure compilation succeeds with no errors

2. **Validate the scenario:**
   ```bash
   ruby scripts/validate_scenario.rb scenarios/{your_lab_name}/scenario.json.erb
   ```
   - Fix any schema validation errors
   - Address any warnings (especially missing required fields)
   - Suggestions are optional but recommended

## Step 6: Reference Materials

- **Best Practices**: Follow `@docs/INK_BEST_PRACTICES.md` for:
  - Hub-based conversation structure
  - Speaker tags (optional for single-NPC conversations)
  - Choice formatting (dialogue in brackets)
  - Exit conversation patterns
  - Influence system requirements

- **Reference Implementation**: Use `scenarios/lab_intro_linux` as a reference for:
  - Scenario structure
  - Objectives configuration
  - Flag tracking setup
  - NPC configuration
  - VM and flag station setup

## Step 7: Testing Checklist

Before considering the conversion complete:

- [ ] Ink file compiles without errors
- [ ] Scenario validates without errors
- [ ] All `influence +=` statements have `#influence_increased` tags
- [ ] All lists converted to flowing sentences
- [ ] Hub structure is correct (all knots return to hub)
- [ ] Timed intro conversation exists and flows to hub
- [ ] Flag identifiers match VM names and positions
- [ ] `submit_flags` task has correct `targetFlags` array
- [ ] VM launchers configured with correct IPs and titles
- [ ] Flag station configured with correct `acceptsVms` and flags
- [ ] Lab workstation URL is correct
- [ ] Mission.json has correct SecGen scenario path

## Example Conversion Pattern

Here's the pattern used for `lab_intro_linux`:

1. **Ink Changes:**
   - Removed "Tech Instructor:" prefixes (58+ instances)
   - Added `#influence_increased` after every `instructor_rapport +=` (58 instances)
   - Converted lists to sentences
   - Added `intro_timed` knot for game start
   - Updated `start` knot to go directly to hub

2. **Scenario Changes:**
   - Created `submit_flags` task with `targetFlags: ["desktop-flag1", "desktop-flag2"]`
   - Configured VM launchers for "kali" and "desktop" systems
   - Configured flag station to accept flags from "desktop" VM
   - Added timed conversation with 3 second delay
   - Added event mapping for aim completion

3. **Result:**
   - Clean, hub-based conversation
   - Proper flag tracking with progress display
   - Timed intro explains lab format
   - All best practices followed

## Notes

- The `submit_flags` task type automatically tracks flag submissions via the `flag_submitted` event
- Flag identifiers are generated server-side in the format `{vmId}-flag{index}`
- The system handles progress tracking, state persistence, and aim completion automatically
- Optional features (like lockpicking challenge) can be added after the core conversion is complete

