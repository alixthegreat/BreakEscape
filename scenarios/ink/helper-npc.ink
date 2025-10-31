// helper-npc.ink
// An NPC that helps the player by unlocking doors and giving hints
// Includes event-triggered reactions using auto-mapping

VAR trust_level = 0
VAR has_unlocked_ceo = false
VAR has_given_lockpick = false
VAR saw_lockpick_used = false
VAR saw_door_unlock = false
VAR has_greeted = false

=== start ===
{ has_greeted:
    -> main_menu
- else:
    Hey there! I'm here to help you out if you need it. 👋
    What can I do for you?
    ~ has_greeted = true
    -> main_menu
}

=== main_menu ===
+ [Who are you?] -> who_are_you
+ [Can you help me get into the CEO's office?] -> help_ceo_office
+ [Do you have any items for me?] -> give_items
+ {saw_lockpick_used} [Thanks for the lockpick! It worked great.] -> lockpick_feedback
+ [Thanks, I'm good for now.] -> goodbye

=== who_are_you ===
I'm a friendly NPC who can help you progress through the mission.
I can unlock doors, give you items, and provide hints.
~ trust_level = trust_level + 1
-> main_menu

=== help_ceo_office ===
{ has_unlocked_ceo:
    I already unlocked the CEO's office for you! Just head on in.
    -> main_menu
- else:
    The CEO's office? That's a tough one...
    { trust_level >= 1:
        Alright, I trust you. Let me unlock that door for you.
        ~ has_unlocked_ceo = true
        There you go! The door to the CEO's office is now unlocked. # unlock_door:ceo
        ~ trust_level = trust_level + 2
        -> main_menu
    - else:
        I don't know you well enough yet. Ask me something else first.
        -> main_menu
    }
}

=== give_items ===
{ has_given_lockpick:
    I already gave you a lockpick set! Check your inventory.
    -> main_menu
- else:
    Let me see what I have...
    { trust_level >= 2:
        Here's a lockpick set. Use it wisely! 🔓
        ~ has_given_lockpick = true
        # give_item:lockpick_set
        -> main_menu
    - else:
        I need to trust you more before I give you something like that.
        -> main_menu
    }
}

=== lockpick_feedback ===
Great! I'm glad it helped you out. That's what I'm here for.
~ trust_level = trust_level + 1
-> main_menu

=== goodbye ===
No problem! Let me know if you need anything.
-> END

// ==========================================
// EVENT-TRIGGERED BARKS (Auto-mapped to game events)
// These knots are triggered automatically by the NPC system
// when specific game events occur.
// Note: These redirect to 'main_menu' so clicking the bark opens full conversation without repeating intro
// ==========================================

// Triggered when player picks up the lockpick
=== on_lockpick_pickup ===
{ has_given_lockpick:
    Great! You found the lockpick I gave you. Try it on a locked door or container!
- else:
    Nice find! That lockpick set looks professional. Could be very useful. 🔓
}
-> main_menu

// Triggered when player completes any lockpicking minigame
=== on_lockpick_success ===
~ saw_lockpick_used = true
{ has_given_lockpick:
    Excellent! Glad I could help you get through that. 🎯
- else:
    Nice work getting through that lock! 🔓
}
-> main_menu

// Triggered when player fails a lockpicking attempt
=== on_lockpick_failed ===
{ has_given_lockpick:
    Don't give up! Lockpicking takes practice. Try adjusting the tension. 🔧
- else:
    Tough break. Lockpicking isn't easy without the right tools...
}
-> main_menu

// Triggered when any door is unlocked
=== on_door_unlocked ===
~ saw_door_unlock = true
{ has_unlocked_ceo:
    Another door open! You're making great progress. 🚪✓
- else:
    Nice! You found a way through that door. Keep going!
}
-> main_menu

// Triggered when player tries a locked door
=== on_door_attempt ===
That door's locked tight. You'll need to find a way to unlock it. 🔒
{ trust_level >= 2:
    Want me to help you out? Just ask!
}
-> main_menu

// Triggered when player interacts with the CEO desk
=== on_ceo_desk_interact ===
{ has_unlocked_ceo:
    The CEO's desk - you made it! Nice work. 📋
- else:
    Trying to get into the CEO's office? I might be able to help with that...
}
-> main_menu

// Triggered when player picks up any item
=== on_item_found ===
{ trust_level >= 1:
    Good find! Every item could be important for your mission. 📦
}
-> main_menu

// Triggered when player enters any room (general progress check)
=== on_room_entered ===
{ has_unlocked_ceo:
    Keep searching for that evidence! 🔍
- else:
    { trust_level >= 1:
        You're making progress through the building. 🚶
    - else:
        Exploring new areas... 🚶
    }
}
-> main_menu

// Triggered when player discovers a new room for the first time
=== on_room_discovered ===
{ trust_level >= 2:
    Great find! This new area might have what we need. 🗺️✨
- else:
    { trust_level >= 1:
        Interesting! You've found a new area. Be careful exploring. 🗺️
    - else:
        A new room... wonder what's inside. 🚪
    }
}
-> main_menu

// Triggered when player enters the CEO office
=== on_ceo_office_entered ===
{ has_unlocked_ceo:
    You're in! Remember, you're looking for evidence of the data breach. 🕵️
- else:
    Whoa, you got into the CEO's office! That's impressive! 🎉
    ~ trust_level = trust_level + 1
}
-> main_menu

