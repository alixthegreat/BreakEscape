// Generic NPC Story - Can be used for any NPC
// The game should set the npc_name variable before starting

VAR npc_name = "NPC"
VAR conversation_count = 0

=== start ===
~ conversation_count += 1
{npc_name}: Hey there! This is conversation #{conversation_count}.
{npc_name}: What can I help you with?
-> hub

=== hub ===
+ [Ask a question]
    -> question
+ [Say hello]
    -> greeting
+ [Say goodbye]
    -> goodbye

=== question ===
{npc_name}: That's a good question. Let me think about it...
{npc_name}: I'm not sure I have all the answers right now.
-> hub

=== greeting ===
{npc_name}: Hello to you too! Nice to chat with you.
-> hub

=== goodbye ===
{npc_name}: Alright, see you later! Let me know if you need anything else.
-> END
