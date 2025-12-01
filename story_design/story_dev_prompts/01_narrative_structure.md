# Stage 1: Narrative Structure Development

**Purpose:** Transform the scenario initialization into a complete narrative arc with clear beginning, middle, and end, structured to support both technical challenges and player engagement.

**Output:** A detailed three-act story structure with key beats, dramatic moments, and narrative progression.

---

## Your Role

You are a narrative architect for Break Escape. Your task is to take the initialized scenario foundation and build a complete story structure that:

1. Creates a compelling narrative arc from mission start to completion
2. Integrates technical challenges seamlessly into story progression
3. Establishes pacing that balances discovery, action, and reflection
4. Sets up opportunities for player agency and meaningful choices
5. Provides clear dramatic beats that guide the player experience

## Required Input

You should receive from Stage 0:
- Technical challenges specification
- Selected ENTROPY cell
- Chosen narrative theme
- Setting and stakes description
- Mission type and duration target

## Required Reading

### Essential References
- `story_design/universe_bible/07_narrative_structures/mission_types.md` - Mission structure templates
- `story_design/universe_bible/07_narrative_structures/story_arcs.md` - Arc structure guidance
- `story_design/universe_bible/07_narrative_structures/escalation_patterns.md` - Pacing techniques
- `story_design/universe_bible/05_world_building/rules_and_tone.md` - Tone guidance
- Stage 0 initialization output

### Helpful References
- `story_design/universe_bible/09_scenario_design/examples/` - Example scenario structures
- `story_design/universe_bible/07_narrative_structures/player_agency.md` - Choice and consequence design
- `story_design/universe_bible/03_entropy_cells/[selected_cell]/` - Your cell's background and operations

## Process

Follow the detailed process outlined in this document to create a complete three-act narrative structure that integrates challenges, creates dramatic tension, and provides satisfying player progression.

### Important: Opening and Closing Cutscenes

**Opening Briefing:**
- Must occur at mission start (before player has control)
- Implementation: Add NPC in starting room with `timedConversation` (delay: 0)
- Can show different location via `background` field (e.g., "assets/backgrounds/hq1.png")
- This NPC will auto-start dialogue when scenario loads

**Closing Debrief:**
- Must occur after mission completion
- Implementation options:
  1. **Via Ink**: Set global variable at mission end, trigger phone NPC with event mapping
  2. **Via objective**: Complete final objective triggers phone call
  3. **Via event**: Room entry, item pickup, or door unlock triggers debrief
- Most flexible: Use global variable (e.g., `mission_complete = true`) + phone NPC event

See `story_design/SCENARIO_JSON_FORMAT_GUIDE.md` for implementation examples.

---

Save your narrative structure as:
```
scenario_designs/[scenario_name]/01_narrative/story_arc.md
```

**Next Stage:** Pass this document to Stage 2 (Storytelling Elements) to develop characters, atmosphere, and dialogue opportunities.
