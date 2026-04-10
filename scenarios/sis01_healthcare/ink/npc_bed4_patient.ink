// ==================================================
// NPC: Bed 4 Patient (Mr T. Ahmed, cardiac post-op)
// Scenario: Northgate Hospital Ward 7
// Role: Patient state display (alarm context, deterioration sequence)
// ==================================================

=== state_resting_unmonitored ===
// Default state: Patient stable but unmonitored
The monitor above Bed 4 is alarming. Mr Ahmed is lying still, eyes closed, breathing irregularly. He doesn't respond when you approach. The bedside alarm has been active for some time — there's no-one at the nursing station to hear it.
-> hub

=== state_distressed ===
// Early deterioration: Patient restless, alarm intensifies
Mr Ahmed shifts restlessly in the bed, pressing the call bell repeatedly. His vital signs on the bedside screen are deteriorating. The alarm tone has changed — higher, more urgent.
-> hub

=== state_critical ===
// Severe deterioration: Patient flat, alarm critical
Mr Ahmed is motionless. The bedside monitor shows a flat-line alarm pattern. Nobody at the nursing station can see this — the central station is offline. The alarm is steady and insistent.
-> hub

=== state_attended ===
// Escalation response: Nurse is now at bedside
The Staff Nurse is standing at Mr Ahmed's bedside, attending to him. She gives you a brief, worried glance but stays focused on the patient.
-> hub

=== hub ===
+ [Step back]
    #exit_conversation
    -> hub
