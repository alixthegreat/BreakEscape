// equipment-officer.ink
// NPC that demonstrates container-based item giving
// Shows all held items through the container minigame UI

VAR trust_level = 0
VAR has_lockpick = false
VAR has_workstation = false
VAR has_keycard = false

=== start ===
# speaker:npc
Welcome to equipment supply. I have various tools available.
What can I help you with?
~ trust_level = trust_level + 1
-> hub

=== hub ===
{trust_level >= 1:
  * [Show me what you have available]
    -> show_inventory
}

* [Tell me about your equipment]
  -> about_equipment

* [I'll come back later]
  -> goodbye

=== show_inventory ===
# speaker:npc
Here's everything we have in stock. Take what you need!
#give_npc_inventory_items
What else can I help with?
-> hub

=== show_inventory_filtered ===
# speaker:npc
Here are the specialist tools:
#give_npc_inventory_items:lockpick,workstation
Let me know if you need access devices too!
-> hub

=== about_equipment ===
We supply equipment for fieldwork - lockpicking kits for access, workstations for analysis, and keycards for security. All essential tools for the job.
~ trust_level = trust_level + 1
+ [Show me what you have]
  -> show_inventory
+ [Never mind]
  -> hub

=== goodbye ===
# speaker:npc
Come back when you need something!
-> END

