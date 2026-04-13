// ===========================================
// NPC: Sarah Mitchell (Charge Nurse)
// Scenario: Northgate Hospital
// Role: Initial briefer; escalation gatekeeper for Bed 4 patient
// ===========================================

// Global variables managed by scenario - declared locally here and updated by game engine
VAR bed4_escalated = false
VAR network_isolated = false
VAR drug_library_compromised = false
VAR drug_library_restored = false

// Local tracking vars for this NPC
VAR influence = 0
VAR sarah_briefed = false
VAR bed4_raised = false
VAR topic_ransomware = false
VAR topic_network = false
VAR topic_pumps = false

// ===========================================
// TIMED OPENING CUTSCENE (called by timedConversation)
// ===========================================

=== arrival_briefing ===

Sarah Mitchell: You're the incident response team? Good. I'm Sarah Mitchell, charge nurse, Ward 7.

Sarah Mitchell: You've been called in by the Trust's IT security manager — Ravi Anand. He's down the hall. Your job is to manage the response: contain the attack, restore what you can, and keep this ward safe while you do it.

Sarah Mitchell: I need you to understand what we're dealing with before you go anywhere near that IT office.

Sarah Mitchell: Last night at 22:15, ransomware hit the hospital network. By 22:30, our central monitoring station was down. That screen behind me — the one showing patient vitals for all six beds — has been a black screen ever since.

Sarah Mitchell: We're running on paper. Manual obs every fifteen minutes. Two nurses, six patients, no automated alarms.

Sarah Mitchell: One of those patients is Mr Ahmed in Bed 4. Cardiac post-op, day two. He needs continuous monitoring. He doesn't have it.

Sarah Mitchell: You have three things to do. Get into the IT office and work with Ravi on containment. Come back to me about Bed 4 — that's a clinical decision, not an IT one. And whatever you do out there, don't lose sight of what's happening in here.

Sarah Mitchell: The patients are your constraint. Everything else is secondary.

Sarah Mitchell: Ravi left his access card for you — the IT office is locked. Here.

#give_item:keycard

Sarah Mitchell: But before you go up there — please check the monitoring station and look in on Bed 4. It will take five minutes, and I need you to understand what's at stake before you disappear into that IT office.

~ sarah_briefed = true

#exit_conversation
-> hub


// ===========================================
// DEFAULT ENTRY POINT (player walks up to Sarah)
// ===========================================

=== start ===

{not sarah_briefed:
    Sarah Mitchell: You're the response team? Ravi said you were coming. I'm Sarah Mitchell — charge nurse.
    Sarah Mitchell: The monitoring station is down, we have a high-risk patient in Bed 4, and I need you briefed before you disappear into that IT office.
    Sarah Mitchell: Ravi left his access card for you — take it, but please check the ward first.
    #give_item:keycard
    ~ sarah_briefed = true
    -> briefing_hub
}

{sarah_briefed and not bed4_raised:
    Sarah Mitchell: I need you to look at the situation with Bed 4.
    Sarah Mitchell: Mrs Fletcher has been restless for the last hour. Without the monitor I can't verify her sats.
    -> bed4_concern
}

{bed4_raised:
    -> hub
}


// ===========================================
// BED 4 CONCERN
// ===========================================

=== bed4_concern ===
~ bed4_raised = true

Sarah Mitchell: Mrs Fletcher in Bed 4 — post-op cardiac, day two.

Sarah Mitchell: Under normal conditions she'd be on continuous monitoring.

Sarah Mitchell: With the station down I have no O2 sat, no BP trace. Just spot checks.

* [What are her current observations?]
    Sarah Mitchell: Last manual set fifteen minutes ago — sats 94%, slightly low but not critical yet.
    Sarah Mitchell: Trend concerns me though. She's had two periods of agitation. Could be pain, could be hypoxia.
    -> bed4_options

* [How long has this been going on?]
    Sarah Mitchell: Since the attack hit. Just under an hour without continuous monitoring.
    Sarah Mitchell: Every minute counts with post-op cardiac. This needs escalating.
    -> bed4_options

* [I'll get to her after IT is sorted]
    Sarah Mitchell: There may not be time for "after." This patient is at risk right now.
    ~ influence -= 1
    #influence_decreased
    -> bed4_options


=== bed4_options ===

Sarah Mitchell: I need you to flag this to the duty registrar and get a manual check done immediately.

* [I'll escalate it now]
    #complete_task:escalate_bed4
    #set_global:bed4_escalated:true
    Sarah Mitchell: Thank you. I'll get the registrar to do a bedside review.
    -> hub

* [Can't your nursing staff handle it?]
    Sarah Mitchell: We're at minimum safe staffing. I'm the only registered nurse on this bay right now.
    Sarah Mitchell: If you don't escalate, I have to, and that means leaving the ward station unattended.
    -> bed4_options

* [I'll look into it later]
    Sarah Mitchell: I hope "later" isn't too late.
    ~ influence -= 1
    #influence_decreased
    -> hub


=== escalate_bed4 ===

Sarah Mitchell: You escalated. Good call.

{bed4_escalated:
    Sarah Mitchell: Dr Hassan is with Mrs Fletcher now. We caught it early.
    Sarah Mitchell: This is exactly why monitoring continuity matters — cyber incident or not.
    -> hub
}

-> hub


// ===========================================
// POST-ISOLATION REACTION
// ===========================================

=== post_isolation ===

Sarah Mitchell: Network's isolated? Does that mean the monitoring station might come back?

Sarah Mitchell: Even a partial recovery would help. My team are exhausted running manual checks.

* [We're working on restoration]
    Sarah Mitchell: Thank you. Please hurry — we can't sustain this workload indefinitely.
    -> hub

* [It may take a while yet]
    Sarah Mitchell: Understood. I'll keep the manual rounds going. Just keep us in the loop.
    -> hub


// ===========================================
// POST DRUG TAMPER DISCOVERY
// ===========================================

=== post_drug_tamper ===

Sarah Mitchell: The drug library was tampered with?

Sarah Mitchell: I need to suspend all pump-administered medication until that library is verified.

Sarah Mitchell: This is a clinical safety incident. I'm alerting the on-call pharmacist right now.

* [What medications are at risk?]
    Sarah Mitchell: Any drug administered via the Alaris pumps — morphine, heparin, insulin.
    Sarah Mitchell: If the dose limits were changed, a nurse could administer a fatal overdose without a warning.
    -> hub

* [The correct library is being restored]
    Sarah Mitchell: That's a relief. But I want written confirmation before any pump is restarted.
    Sarah Mitchell: Patient safety has to come first, even if that means delays.
    -> hub


// ===========================================
// REPEATABLE HUB
// ===========================================

=== briefing_hub ===

Sarah Mitchell: We've had no monitoring for nearly an hour. IT security are in the office down the hall.

Sarah Mitchell: Ravi Anand — he's the one who called in the cyber incident. Talk to him first.

-> hub

=== hub ===

+ {not topic_ransomware} [What exactly happened to the monitoring station?]
    ~ topic_ransomware = true
    Sarah Mitchell: Someone's locked our workstation with ransomware. Demanding over a million pounds.
    Sarah Mitchell: The screen says seventy-two hours. But we can't run a cardiac ward blind for seventy-two minutes.
    -> hub

+ {not topic_network} [Is this affecting anything else?]
    ~ topic_network = true
    Sarah Mitchell: The ward printer is also down. Some of the bedside tablets can't reach the EPR.
    Sarah Mitchell: It's spreading, or maybe it was always bigger than just this room.
    -> hub

+ {not topic_pumps} [What about the infusion pumps?]
    ~ topic_pumps = true
    Sarah Mitchell: The smart pumps are standalone — they run on their own network segment.
    Sarah Mitchell: But their drug library is pulled from the central server. If that's compromised...
    Sarah Mitchell: I don't want to think about it.
    -> hub

+ [What should I do first?]
    Sarah Mitchell: Check the central monitoring station — it's the black screen behind me. Then look in on Bed 4, Mr Ahmed. Escalate him to the registrar if you're concerned.
    Sarah Mitchell: After that, Ravi is up in the IT office. Use his access card to get through the door.
    -> hub

+ [Leave conversation]
    Sarah Mitchell: Please be quick. Every minute without monitoring is a minute I'm flying blind.
    #exit_conversation
    -> hub


// ===========================================
// BED 4 ESCALATION RESPONSE
// ===========================================

=== post_escalation ===

Sarah Mitchell: Good. The second nurse is with him now. I need to keep doing these rounds — if you find out what's happening with the systems, please come back to me.

#exit_conversation
-> hub


// ===========================================
// MAJOR INCIDENT RESPONSE
// ===========================================

=== major_incident_line ===

Sarah Mitchell: This is now a patient safety emergency. I'm declaring a major incident. The ICO notification team needs to be briefed immediately.

#exit_conversation
-> hub
