// bob.ink
// Demonstrates objective Ink tags for the second NPC
// Works in conjunction with alice.ink to show task chaining
//
// IMPORTANT: Uses mission hub pattern - never uses -> END
// Instead uses #exit_conversation tag to leave the chat

VAR bob_talked = false
VAR helped_with_secret = false
VAR secret_revealed = false // from alice.ink

=== start ===
*cough* Oh, hey. I'm Bob. Didn't see you there.
-> hub

=== hub ===
+ {not bob_talked} [Alice sent me to talk to you]
    -> first_meeting

+ {bob_talked and secret_revealed and not helped_with_secret} [Can you help with the secret task?]
    -> secret_task_help

+ {helped_with_secret} [Thanks for the help!]
    -> thanks_response

+ [What do you do here?]
    -> about_bob

+ [Goodbye]
    Later.
    #exit_conversation
    -> hub

=== first_meeting ===
Ah, Alice sent you? Good, good.
#complete_task:talk_to_bob
~ bob_talked = true
I've just marked that task complete. 
If Alice told you about anything... special... come back and ask me.
-> hub

=== about_bob ===
I handle the technical side of things. 
Mostly just unlocking things that need to be unlocked.
Speaking of which... if there are any locked tasks you need help with, just ask.
-> hub

=== secret_task_help ===
The secret task, eh? Let me help you with that.
#unlock_task:secret_task_2
#complete_task:secret_task_2
~ helped_with_secret = true
Done! Both secret tasks are now complete.
That means the secret aim should be finished too.
#unlock_aim:finale
#unlock_task:final_debrief
I've also unlocked the finale for you. Go talk to Alice for the final debrief!
-> hub

=== thanks_response ===
No problem! Go see Alice for the final debrief. She's waiting for you.
-> hub
