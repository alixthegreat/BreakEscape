// ==================================================
// NPC: Bed 2 Patient (Ms A. Okafor, post-surgical)
// Scenario: Northgate Hospital Ward 7
// Role: Patient state display (infusion pump consequence)
// ==================================================

=== state_stable ===
// Default state: Patient recovering normally
Ms Okafor is resting quietly. A morphine infusion runs via the pump on the pole beside her bed. The pump display shows a steady flow rate and stable vitals on the bedside screen.
-> END

=== state_sedated ===
// Early consequence: Patient over-sedated from pump misconfiguration
Ms Okafor is slumped to one side, unresponsive to ambient ward sounds. Her breathing is shallow and slow. The pump indicator is glowing amber — the rate is higher than prescribed.
-> END

=== state_critical ===
// Severe consequence: Patient respiratory depression
Ms Okafor is critically unresponsive. Her breathing has become irregular and dangerously slow. The pump accepted the erroneous rate without flagging the dangerous increase.
-> END
