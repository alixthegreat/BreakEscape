// Test Ink script - Multi-character conversation with camera focus
// Demonstrates player, Front NPC (test_npc_front), and Back NPC (test_npc_back) in dialogue
VAR conversation_started = false
VAR player_joined_organization = false

=== hub ===
# speaker:npc:test_npc_back
Woop! Welcome! This is a group conversation test. Let me introduce you to my colleague.
+ [Listen in on the introduction] -> group_meeting

=== group_meeting ===
# speaker:npc:test_npc_back
Agent, meet my colleague from the back office. BACK
-> colleague_introduction

=== colleague_introduction ===
# speaker:npc:test_npc_front
Nice to meet you! I'm the lead technician here. FRONT.
-> player_question

=== player_question ===
# speaker:player
What kind of work do you both do here?
-> front_npc_explains

=== front_npc_explains ===
# speaker:npc:test_npc_back
Well, I handle the front desk operations and guest interactions. But my colleague here...
-> colleague_responds

=== colleague_responds ===
# speaker:npc:test_npc_front
I manage all the backend systems and security infrastructure. Together, we keep everything running smoothly.
-> player_follow_up

=== player_follow_up ===
# speaker:player
That sounds like a well-coordinated operation!
-> front_npc_agrees

=== front_npc_agrees ===
# speaker:npc:test_npc_back
It really is! We've been working together for several years now. Communication is key.
-> colleague_adds

=== colleague_adds ===
# speaker:npc:test_npc_front
Exactly. And we're always looking for talented people like you to join our team.
-> player_closing

=== player_closing ===
# speaker:player
* [I'd love to join your organization!]
    ~ player_joined_organization = true
    # speaker:npc:test_npc_back
    Excellent! Welcome aboard. We'll get you set up with everything you need.
    #exit_conversation
    -> hub
* [I need to think about it.]
    # speaker:npc:test_npc_back
    That's understandable. Take your time deciding.
    #exit_conversation
    -> hub



