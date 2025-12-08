// ================================================
// Mission 1: First Contact - Kevin Park (IT Manager)
// Located in IT Room (PIN locked)
// Provides lockpicks, server keycard, and password hints
// ================================================

VAR influence = 0
VAR met_kevin = false
VAR discussed_audit = false
VAR asked_about_derek = false
VAR asked_about_passwords = false
VAR given_lockpick = false
VAR given_keycard = false
VAR given_password_hints = false
VAR warned_about_derek = false

// ================================================
// START: FIRST MEETING
// ================================================

=== start ===
#set_variable:talked_to_kevin=true
{not met_kevin:
    ~ met_kevin = true
    ~ influence += 2
    Kevin: Oh hey! You found the IT room. I'm Kevin—IT manager, sole IT department, and professional worrier.
    Kevin: You're the security auditor, right? Thank god you're here.
    Kevin: I've been telling them we need a review for months.
    -> first_meeting
}
{met_kevin:
    Kevin: Hey, what's up? Found anything interesting yet?
    -> hub
}

// ================================================
// FIRST MEETING
// ================================================

=== first_meeting ===
#complete_task:meet_kevin
+ [Happy to help. What's the security situation?]
    ~ influence += 2
    ~ discussed_audit = true
    -> security_situation
+ [I'll need access to secure areas for testing]
    ~ discussed_audit = true
    -> access_discussion
+ [You seem stressed]
    ~ influence += 1
    ~ discussed_audit = true
    -> kevin_stress

// ================================================
// SECURITY SITUATION
// ================================================

=== security_situation ===
Kevin: Honestly? I'm worried.

Kevin: Someone's been accessing the server room without authorization. Late at night. Multiple times.

Kevin: I flagged it to management three times. Nothing happened.

+ [Who do you think it is?]
    ~ warned_about_derek = true
    ~ influence += 1
    -> derek_suspicion
+ [That's what I'm here to investigate]
    Kevin: Good. Because I'm starting to feel like I'm the only one who cares about security around here.
    -> offer_tools

// ================================================
// DEREK SUSPICION
// ================================================

=== derek_suspicion ===
Kevin: *lowers voice* I think it's Derek Lawson. Senior Marketing Manager.

Kevin: The access logs show his credentials being used at 2 AM. But he says it's for "campaign servers."

Kevin: We don't have campaign servers in that room. It's all internal infrastructure.

Kevin: The last person who raised concerns about Derek was Patricia—our manager. She got fired.

+ [I'll look into it]
    ~ influence += 2
    Kevin: Please do. But be careful. Derek has friends in high places.
    Kevin: Here, let me give you some tools that might help.
    -> offer_tools
+ [Could be someone spoofing his credentials]
    Kevin: Maybe. But I don't think so. I've seen him leaving the office at weird hours.
    -> offer_tools

// ================================================
// ACCESS DISCUSSION
// ================================================

=== access_discussion ===
Kevin: Right, you'll need access to secure areas.

Kevin: I've got a keycard for the server room. It's behind Derek's office, actually.

Kevin: And for physical security testing, I've got something special.

-> offer_tools

// ================================================
// KEVIN STRESS
// ================================================

=== kevin_stress ===
Kevin: Yeah, it's been a rough few months.

Kevin: Ever since Patricia got fired, things have felt... off.

Kevin: She was investigating something. Asking questions about Derek's projects.

Kevin: Now she's gone and nobody will tell me why.

+ [What was she investigating?]
    ~ warned_about_derek = true
    Kevin: I don't know exactly. Something about Derek's "external partners."
    Kevin: She kept her notes in her office safe. I think her briefcase is still in there too.
    -> offer_tools
+ [Let's focus on the audit]
    Kevin: Right. Sorry. Let me get you set up.
    -> offer_tools

// ================================================
// OFFER TOOLS
// ================================================

=== offer_tools ===
Kevin: Okay, so for the audit I can give you:

Kevin: First, a lockpick set. I bought it for when people lock themselves out, but it's useful for testing physical security.

Kevin: Second, my server room keycard. You'll need it to access the main servers.

Kevin: And some notes on password patterns people use around here. Should help with the technical testing.

+ [I'll take all of it]
    ~ given_lockpick = true
    ~ given_keycard = true
    ~ given_password_hints = true
    ~ influence += 3
    #give_item:lockpick
    #give_item:keycard
    #give_item:notes
    Kevin: Here you go. The lockpicks work on most of the older locks around here.
    Kevin: The server room is through Derek's office—there's a door on the east side.
    Kevin: Just... be careful, okay? Something's not right here.
    -> hub
+ [Just the keycard for now]
    ~ given_keycard = true
    #give_item:keycard
    Kevin: Sure. Server room is through Derek's office. Let me know if you need anything else.
    -> hub

// ================================================
// CONVERSATION HUB
// ================================================

=== hub ===
+ {not given_lockpick} [About those lockpicks...]
    -> get_lockpicks
+ {not given_keycard} [I need the server room keycard]
    -> get_keycard
+ {not asked_about_passwords and influence >= 2} [Tell me about password security here]
    -> ask_passwords
+ {not asked_about_derek and influence >= 3} [What else can you tell me about Derek?]
    -> ask_about_derek
+ [I'll keep investigating. Thanks for the help.]
    #exit_conversation
    Kevin: No problem. And seriously—if you find anything, let me know. I need to know I'm not going crazy.
    -> hub

// ================================================
// GET LOCKPICKS
// ================================================

=== get_lockpicks ===
~ given_lockpick = true
#give_item:lockpick

Kevin: Here's the lockpick set. It's professional grade.

Kevin: Most of the older locks in the building are vulnerable. Good for testing security.

Kevin: Patricia's office has an old briefcase she left behind. You might be able to pick that open if you're curious what she was working on.

-> hub

// ================================================
// GET KEYCARD
// ================================================

=== get_keycard ===
~ given_keycard = true
#give_item:keycard

Kevin: Here's my server room keycard.

Kevin: The server room is through Derek's office—there's a connecting door on the east wall.

Kevin: The servers hold everything. If there's evidence of unauthorized activity, that's where you'll find it.

-> hub

// ================================================
// ASK ABOUT PASSWORDS
// ================================================

=== ask_passwords ===
~ asked_about_passwords = true
~ given_password_hints = true
~ influence += 1
#give_item:notes

Kevin: Password security here is... not great.

Kevin: I enforce complexity requirements on domain accounts, but people find patterns.

Kevin: Company name plus numbers. Birthdays. Anniversary dates.

Kevin: Derek uses his birthday or anniversary in everything. April 19th. Makes his passwords easy to guess.

+ [0419?]
    ~ influence += 2
    Kevin: Yeah. I've told him it's a security risk but he doesn't listen.
    Kevin: Here, I wrote down the common patterns people use. Might help with the audit.
    -> hub
+ [That's useful, thanks]
    -> hub

// ================================================
// ASK ABOUT DEREK
// ================================================

=== ask_about_derek ===
~ asked_about_derek = true
~ influence += 1

Kevin: Derek's been here about 18 months. Senior Marketing Manager.

Kevin: At first he seemed normal. Then he started requesting "enhanced privacy" for his systems.

Kevin: Wanted separate network segments, encrypted communications, locked office at all times.

Kevin: Said it was for "client confidentiality" but... marketing doesn't need that level of security.

+ [What do you think he's really doing?]
    Kevin: I don't know. But whatever it is, it's not marketing.
    Kevin: He's been meeting with external people—calls them "partners." 
    Kevin: I saw notes once that mentioned something called "Operation Shatter."
    ~ influence += 2
    -> hub
+ [Maybe he's just paranoid]
    Kevin: Maybe. But Patricia didn't think so. And now she's gone.
    -> hub
