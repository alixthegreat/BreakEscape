// helper-npc.ink
// An NPC that helps the player by unlocking doors and giving hints

VAR trust_level = 0
VAR has_unlocked_ceo = false
VAR has_given_lockpick = false

=== start ===
Hey there! I'm here to help you out if you need it. 👋
What can I do for you?
+ [Who are you?] -> who_are_you
+ [Can you help me get into the CEO's office?] -> help_ceo_office
+ [Do you have any items for me?] -> give_items
+ [Thanks, I'm good for now.] -> goodbye

=== who_are_you ===
I'm a friendly NPC who can help you progress through the mission.
I can unlock doors, give you items, and provide hints.
~ trust_level = trust_level + 1
-> start

=== help_ceo_office ===
{ has_unlocked_ceo:
    I already unlocked the CEO's office for you! Just head on in.
    -> start
- else:
    The CEO's office? That's a tough one...
    { trust_level >= 1:
        Alright, I trust you. Let me unlock that door for you.
        ~ has_unlocked_ceo = true
        There you go! The door to the CEO's office is now unlocked. # unlock_door:ceo
        ~ trust_level = trust_level + 2
        -> start
    - else:
        I don't know you well enough yet. Ask me something else first.
        -> start
    }
}

=== give_items ===
{ has_given_lockpick:
    I already gave you a lockpick set! Check your inventory.
    -> start
- else:
    Let me see what I have...
    { trust_level >= 2:
        ~ has_given_lockpick = true
        Ah, here's a professional lockpick set that might be useful!
        # give_item:lockpick
        I've added it to your inventory. You can use it to pick locks without keys.
        -> start
    - else:
        I can't just hand out items to strangers. Get to know me better first.
        -> start
    }
}

=== goodbye ===
No problem! Let me know if you need anything.
-> END
