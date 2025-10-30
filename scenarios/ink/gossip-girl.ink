// Gossip Girl - Office Gossip
// Provides intel about staff including manager names

VAR talked_about_it = false
VAR talked_about_ceo = false
VAR talked_about_security = false

=== start ===
Gossip Girl: OMG hiiii! You're new here, right? I know EVERYONE in this office!
Gossip Girl: Want to hear the latest tea? ☕
-> hub

=== hub ===
+ {not talked_about_it} [Ask about the IT department]
    -> topic_it
+ {not talked_about_ceo} [Ask about the CEO]
    -> topic_ceo
+ {not talked_about_security} [Ask about security concerns]
    -> topic_security
+ [That's enough gossip for now]
    -> ending

=== topic_it ===
~ talked_about_it = true
Gossip Girl: Oh the IT team? They're actually pretty cool!
Gossip Girl: Neye Eve is super smart but a bit gullible, you know? Always trying to be helpful.
Gossip Girl: Their manager is Alex Chen - really nice but SUPER busy. Barely see them around these days.
Gossip Girl: Fun fact: Neye is SO worried about impressing Alex that they practically jump when Alex's name comes up! 😂
+ [Tell me more about the team dynamics]
    -> it_details
+ [Interesting! What else?]
    -> hub

=== it_details ===
Gossip Girl: Well, Neye handles a lot of the day-to-day stuff - passwords, access codes, that kind of thing.
Gossip Girl: Alex trusts them completely. Maybe TOO much if you ask me... 👀
Gossip Girl: Like, Neye would probably do ANYTHING if they thought Alex was asking for it!
-> hub

=== topic_ceo ===
~ talked_about_ceo = true
Gossip Girl: The CEO? *lowers voice* Girl, I have THEORIES...
Gossip Girl: Like, why are they here so late at night? And those "business trips" that nobody knows about?
Gossip Girl: I saw them coming out of the server room at 3 AM once. Like... what?!
Gossip Girl: Something shady is definitely going on. Mark my words! 🕵️
-> hub

=== topic_security ===
~ talked_about_security = true
Gossip Girl: Security? Oh honey, let me tell you about the "security" around here...
Gossip Girl: Half the people write their passwords on sticky notes! Including the CEO!
Gossip Girl: And that reception safe? Pretty sure the code hasn't been changed in forever.
Gossip Girl: Actually wait - Neye mentioned they just updated it last week. Something about "security protocols."
Gossip Girl: They were SO proud of themselves for remembering to update it! 😊
-> hub

=== ending ===
Gossip Girl: Okay okay, I'll let you go! But if you hear anything juicy, come find me!
Gossip Girl: And remember - you didn't hear any of this from me! 😉🤫
-> END
