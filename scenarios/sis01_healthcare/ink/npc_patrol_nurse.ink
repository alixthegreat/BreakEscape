// ===========================================
// NPC: Patrol Nurse (Staff Nurse, unnamed)
// Scenario: Northgate Hospital
// Role: Background colour; Bed 4 escalation reinforcement; drug safety reaction
// Note: Patrol behaviour drives this NPC. Dialogue is brief — she is always busy.
// ===========================================

// Global variables managed by scenario - declared locally here and updated by game engine
VAR bed4_escalated = false
VAR drug_library_compromised = false

VAR patrol_acknowledged = false
VAR bed4_mentioned = false
VAR drug_warning_given = false

// ===========================================
// DEFAULT (patrol loop, player interrupts)
// ===========================================

=== patrol_idle ===

{not patrol_acknowledged:
    Staff Nurse: Sorry — mid-round. Everything okay?
    * [Just checking in]
        Staff Nurse: We're managing. Barely.
        ~ patrol_acknowledged = true
        #exit_conversation
        -> hub
    * [How is the ward coping?]
        Staff Nurse: Running spot checks every fifteen minutes by hand. It's not enough for these patients.
        ~ patrol_acknowledged = true
        -> hub
}

{patrol_acknowledged:
    Staff Nurse: Still here. Need something?
    -> hub
}

=== hub ===

+ {not bed4_mentioned} [How is the patient in Bed 4?]
    ~ bed4_mentioned = true
    Staff Nurse: Mrs Fletcher? She's been unsettled. Charge nurse is keeping a close eye.
    {not bed4_escalated:
        Staff Nurse: Someone should really escalate that to the registrar.
    }
    {bed4_escalated:
        Staff Nurse: Dr Hassan's been down. Good thing someone flagged it.
    }
    -> hub

+ [Anything I should know?]
    Staff Nurse: Just... get the monitors back online. Please.
    -> hub

+ [Leave her to her rounds]
    Staff Nurse: Back to it then.
    #exit_conversation
    -> hub


// ===========================================
// AFTER DRUG TAMPER DISCOVERED
// ===========================================

=== post_drug ===

{not drug_warning_given:
    ~ drug_warning_given = true
    Staff Nurse: Charge nurse has suspended pump medication pending library verification.
    Staff Nurse: We're going to manual dosing. More paperwork, but it's safe.
    * [Is that manageable?]
        Staff Nurse: It has to be. Patient safety first.
        -> hub
    * [Good call by Sarah]
        Staff Nurse: She always puts patients first. That's why she's charge nurse.
        -> hub
}

{drug_warning_given:
    Staff Nurse: Pumps are still suspended. Waiting on library confirmation.
    -> hub
}


// ===========================================
// BED 4 ESCALATION RESPONSE
// ===========================================

=== rushing_bed4 ===

Staff Nurse: I'm going to him now — stay out of the way.

#exit_conversation
-> hub


=== at_bed4 ===

Staff Nurse: I'm here with him. Something's very wrong. What's happening with your investigation?

-> hub


// ===========================================
// MAJOR INCIDENT RESPONSE
// ===========================================

=== major_incident_line ===

Staff Nurse: I can't stop right now — speak to the ward sister.

#exit_conversation
-> hub
