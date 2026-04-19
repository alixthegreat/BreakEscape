// ===========================================
// NPC: Helen Carver (Information Governance Lead / DPO)
// Scenario: Northgate Hospital
// Role: ICO 72-hour notification clock; backup recovery advisory; CLAIM-HC-007
// CyBOK links: CLAIM-HC-007 (incident response plan), GDPR/DPA obligations
// ===========================================

// Global variables managed by scenario - declared locally here and updated by game engine
VAR network_isolated = false
VAR backup_restore_initiated = false

VAR helen_trust = 0
VAR topic_ico = false
VAR topic_backup = false
VAR topic_ir_plan = false
VAR ico_notified = false
VAR hc007_assessed = false
VAR backup_initiated = false

// Global reads: network_isolated, restore_operations, backup_initiated
// Global writes: ico_notified, safety_claim_hc007_assessed

// ===========================================
// FIRST ENCOUNTER
// ===========================================

=== start ===
#complete_task:helen_ico_advisory

Helen Carver: You need to know something important before anything else.

Helen Carver: Under UK GDPR, we have 72 hours from the point of awareness to notify the ICO of a personal data breach.

Helen Carver: That clock started when Ravi logged the incident. We have less than 71 hours left.

* [That's plenty of time]
    Helen Carver: It sounds like it. But notification requires an assessment. We need to know what data was accessed.
    Helen Carver: If we can't determine the scope, we notify anyway — and that looks worse.
    -> hub

* [When exactly did the clock start?]
    Helen Carver: Ravi logged the SIEM alert at 09:47. That's our moment of awareness.
    Helen Carver: Any delay in notification after that needs a documented reason.
    -> hub

* [What do we need to do?]
    -> backup_advisory


// ===========================================
// BACKUP ADVISORY
// ===========================================

=== backup_advisory ===
~ topic_backup = true

Helen Carver: Two priorities running in parallel. First: recovery.

Helen Carver: The backup console in the major incident room holds our last clean state — eighteen hours ago.

* [What's the recovery process?]
    Helen Carver: The console has three restore options. Choose carefully — a cloud restore triggers an 18-hour timer.
    Helen Carver: An on-site restore from tape is faster but requires physical media from the secure cabinet.
    Helen Carver: Either way, document what you choose and why. The ICO will ask.
    -> hub

* [What's the second priority?]
    Helen Carver: Notification. Once we have enough information to assess scope, we send the ICO notification.
    Helen Carver: I can draft it — I just need to know: was patient data accessed or just encrypted in place?
    -> hub


// ===========================================
// CLAIM-HC-007
// ===========================================

=== safety_case_hc007 ===
~ topic_ir_plan = true
~ hc007_assessed = true

Helen Carver: CLAIM-HC-007: "Incident response decisions that impact clinical safety are made through integrated IT and clinical decision-making."

Narrator: Helen points to the Trust Safety Case document.
Helen Carver: This claim is about governance. It says that critical decisions like network isolation require both IT security and clinical sign-off.

Helen Carver: When David's clinical sign-off and Ravi's IT authorisation are both confirmed at the network terminal, you're honouring this claim. Both perspectives, both accountabilities.

Helen Carver: That's one of the few promises in the safety case we can actually keep right now.

* [So dual sign-off is a safety control?]
    Helen Carver: Exactly. It prevents one function — IT or clinical — from making a decision that affects patient safety unilaterally.
    Helen Carver: Both must agree. Both must take responsibility. The network terminal enforces that before executing isolation.
    #set_global:safety_claim_hc007_assessed:true
    -> hub

* [What if one of them is unavailable?]
    Helen Carver: Then isolation cannot proceed through normal channels. In an extreme emergency, there's an executive override — but it must be documented as a formal deviation.
    Helen Carver: Bypassing governance without documentation is how safety incidents become inquests.
    #set_global:safety_claim_hc007_assessed:true
    -> hub

* [What happens after isolation?]
    Helen Carver: We document that the isolation decision was made through integrated governance. That goes in the post-incident report.
    Helen Carver: And we recover systems within the defined window. That's the RTO commitment in the same claim.
    #set_global:safety_claim_hc007_assessed:true
    -> hub


// ===========================================
// ICO ADVISORY
// ===========================================

=== ico_advisory ===
~ topic_ico = true

Helen Carver: The ICO notification template is on my terminal. I need two things from you.

Helen Carver: One: confirmation of what data was potentially accessed. Patient records? Staff records? Both?

Helen Carver: Two: your sign-off as the incident lead that we've taken reasonable steps to contain the breach.

* {network_isolated} [Network is isolated — breach is contained]
    Helen Carver: Good. That's "reasonable steps." I'll document the isolation time and method.
    Helen Carver: I'll send the notification with a provisional scope. We can supplement it once forensics are done.
    ~ ico_notified = true
    #set_global:ico_notified:true
    #complete_task:notify_ico
    -> hub

* {not network_isolated} [Network isn't isolated yet]
    Helen Carver: Then we can't say the breach is contained. The notification will need to reflect ongoing risk.
    Helen Carver: Isolate the network, then come back to me.
    ~ helen_trust -= 1
    #influence_decreased
    -> hub

* [What if we get the scope wrong?]
    Helen Carver: Better to over-report than under-report. The ICO treats good-faith notification favourably.
    Helen Carver: Concealment or delay — that's where the serious fines come from.
    -> hub


// ===========================================
// POST-ISOLATION
// ===========================================

=== post_isolation ===

{not ico_notified:
    Helen Carver: Network isolated — that's the containment step I needed.
    Helen Carver: Come and see me about the ICO notification. We're within the window but we shouldn't delay.
}
{ico_notified:
    Helen Carver: ICO has been notified. We're on record as having acted promptly.
    Helen Carver: Now it's about restoration and the post-incident report.
}

* [What do we do now?]
    Helen Carver: Backup restoration, then scope assessment.
    Helen Carver: I'll start drafting the incident report in parallel.
    -> hub


// ===========================================
// POST-BACKUP RESTORATION
// ===========================================

=== post_backup ===
~ backup_initiated = true

{not network_isolated:
    Helen Carver: Stop. If the attacker is still in the network while this restore runs, we will be reinfected.
    Helen Carver: If that happens, we start from scratch and extend manual operations for days.
}
{network_isolated:
    Helen Carver: Systems are coming back. That's the RTO met — just.
}

Helen Carver: I need you to sign off the restoration record. Type, method, timestamp, authorising individual.

Helen Carver: This goes into the SIRI — Serious Incident Requiring Investigation — report.

* [Consider it done]
    Helen Carver: Thank you. Dr Sharma from the NCSC will want this documentation for her debrief.
    #complete_task:restore_operations
    -> hub

* [What's a SIRI?]
    Helen Carver: It's the NHS framework for investigating serious incidents. This qualifies on multiple grounds.
    Helen Carver: Ransomware on a cardiac ward with patient safety implications — that's a SIRI.
    -> hub


// ===========================================
// REPEATABLE HUB
// ===========================================

=== hub ===

+ {not topic_backup} [Tell me about the backup process]
    -> backup_advisory

+ {not hc007_assessed} [Tell me about CLAIM-HC-007]
    -> safety_case_hc007

+ {not topic_ico or not ico_notified} [ICO notification]
    -> ico_advisory

+ {network_isolated and not backup_initiated} [Systems are isolated — what's next?]
    Helen Carver: Restore from backup. The console is in the major incident room — the PC next to the command board.
    Helen Carver: Choose a restore method carefully and document what you choose. The ICO will ask.
    -> hub

+ [Leave conversation]
    {not ico_notified:
        Helen Carver: Don't forget the ICO clock. Come back to me when network is isolated.
    }
    {ico_notified:
        Helen Carver: Good work. Keep the documentation tight.
    }
    #exit_conversation
    -> hub


// ===========================================
// DRUG LIBRARY TAMPER DETECTED
// ===========================================

=== post_drug_tamper ===

Helen Carver: I've dispatched the on-call pharmacist to the ward. Tell them to verify every pump's configuration against the clinical baseline.
Helen Carver: If that library was modified, we catch it now or we could have a serious incident on our hands.

#exit_conversation
-> hub
