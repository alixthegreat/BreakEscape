// ===========================================
// NPC: Dr Priya S. (NCSC Investigator)
// Scenario: Northgate Hospital
// Role: Post-incident debrief; safety case review; closing learning synthesis
// Triggered: when debrief_started = true
// CyBOK links: All three claims; incident learning; SIS framework; organisational resilience
// ===========================================

// Global variables managed by scenario - declared locally here and updated by game engine
VAR bed4_escalated = false
VAR drug_tamper_found = false
VAR drug_library_restored = false
VAR patient_bed2_deceased = false
VAR network_isolated = false
VAR network_isolation_authorised = false
VAR ico_notified = false
VAR hc001_claim_assessed = false
VAR hc003_claim_assessed = false
VAR hc007_claim_assessed = false
VAR ico_deadline_missed = false
VAR vpn_anomaly_identified = false

VAR influence = 0
VAR debrief_stage = 0
VAR topic_outcomes = false
VAR topic_claims = false
VAR topic_regulatory = false
VAR topic_root_cause = false
VAR closing_reached = false

// Global reads: bed4_escalated, drug_tamper_found, drug_library_restored,
//               patient_bed2_deceased, network_isolated, restore_operations, ico_notified,
//               hc001_claim_assessed, hc003_claim_assessed, hc007_claim_assessed,
//               major_incident_declared, ico_deadline_missed

// ===========================================
// ENTRY POINT — Debrief opens
// ===========================================

=== start ===

Priya S.: I'm Priya S. — NCSC Healthcare Resilience team. Is there anything you still need to wrap up before we begin?

* [No — I'm ready]
    #complete_task:attend_debrief
    Priya S.: Good. Let's sit down.
    Priya S.: I've been briefed on the incident timeline. I'm here for the post-incident review, not to assign blame.
    Priya S.: But I do need honest answers. What we learn here shapes guidance for every NHS Trust in England.
    -> hub

* [Give me a few minutes]
    Priya S.: Of course. Come back when you're ready.
    #exit_conversation
    -> start


// ===========================================
// PATIENT OUTCOMES
// ===========================================

=== patient_outcomes ===

~ topic_outcomes = true

Priya S.: First question: patient outcomes. Were any patients harmed?

{bed4_escalated:
    Priya S.: Bed 4 was escalated early. That's the right call — monitoring the unmonitored.
    Priya S.: Mr Ahmed was reviewed promptly. No adverse outcome.
}
{not bed4_escalated:
    Priya S.: Bed 4 wasn't escalated during the incident window.
    Priya S.: Mr Ahmed experienced an extended period without monitoring. He was fortunate.
    Priya S.: That near-miss needs to be in the SIRI report.
    ~ influence -= 1
    #influence_decreased
}

{drug_library_restored:
    Priya S.: Drug library was identified as tampered and restored before any compromised doses were administered.
    Priya S.: That's CLAIM-HC-003 working — eventually.
}
{drug_tamper_found and not drug_library_restored:
    Priya S.: The drug library tamper was found but not restored during the incident.
    Priya S.: Were pumps suspended? If medication continued from a tampered library, we have a serious patient safety event.
    ~ influence -= 1
    #influence_decreased
}
{not drug_tamper_found:
    Priya S.: The drug library anomaly wasn't detected during the incident.
    Priya S.: That's a significant gap. A morphine DOSE_MAX of 40mg instead of 4mg is potentially lethal.
    ~ influence -= 1
    #influence_decreased
}

{patient_bed2_deceased:
    Priya S.: I need to address something directly. Ms Okafor — Bed 2 — did not survive.
    Priya S.: A compromised drug library removed the pump's dosing guardrail. An incorrect entry was then accepted without any warning.
    Priya S.: That is a double failure: a clinical error compounded by a safety system that had already been neutralised by the attackers.
    Priya S.: This will go to NHS England as a serious incident. It will also be in the SIRI report under a separate heading.
    Priya S.: CLAIM-HC-003 did not hold. The safety case said the library protected patients. It didn't — because nobody verified it under attack conditions before the pump was used.
    ~ influence -= 2
    #influence_decreased
}

-> hub


// ===========================================
// SAFETY CLAIMS REVIEW
// ===========================================

=== safety_claims ===

~ topic_claims = true

Priya S.: Let's go through the safety case claims. Three were active during this incident.

Priya S.: CLAIM-HC-001: Network segmentation. Was it assessed before the isolation decision?

{hc001_claim_assessed:
    Priya S.: Good. David Osei reviewed it. The VPN perimeter gap was noted.
    Priya S.: That's honest safety case management — acknowledging where the claim didn't hold.
}
{not hc001_claim_assessed:
    Priya S.: It wasn't formally assessed. You isolated without reviewing the claim.
    Priya S.: The outcome was correct, but the process wasn't. Safety cases exist precisely for this.
    ~ influence -= 1
    #influence_decreased
}

{network_isolated and not network_isolation_authorised:
    Priya S.: I need to raise something before we go further.
    Priya S.: The network was isolated without confirmed sign-off from both Ravi Anand and David Osei. There's no joint authorisation record for that decision.
    Priya S.: CLAIM-HC-007 requires integrated IT and clinical decision-making for interventions that affect patient safety. That process was not followed.
    * [It achieved the same outcome.]
        Priya S.: Did it? The outcome was correct. The process was not.
        Priya S.: The dual sign-off requirement exists because network isolation is a clinical safety decision as much as a technical one. It can take systems offline that patients depend on.
        Priya S.: One person making that call unilaterally — even the right call — is a governance failure.
        ~ influence -= 1
        #influence_decreased
        -> dual_auth_bypass_end
    * [I didn't know the proper process.]
        Priya S.: That's an honest answer, and it's a training gap.
        Priya S.: The network terminal should prompt for both authorisation forms before executing isolation. If responders aren't familiar with that step, the Trust has a procedural readiness problem.
        ~ influence -= 1
        #influence_decreased
        -> dual_auth_bypass_end
    * [There wasn't time for the full process.]
        Priya S.: I understand the pressure. Getting both sign-offs takes minutes, not hours.
        Priya S.: If the situation felt too urgent for a two-person authorisation, that's worth examining in the SIRI report — because that pressure is exactly when governance shortcuts become habitual.
        ~ influence -= 1
        #influence_decreased
        -> dual_auth_bypass_end
}

= dual_auth_bypass_end
Priya S.: CLAIM-HC-003: Drug library integrity. Assessed?

{hc003_claim_assessed:
    Priya S.: Reviewed with David. The correct response — check the claim, verify the library.
}
{not hc003_claim_assessed:
    Priya S.: Not reviewed. A safety claim directly affecting patient lives went unchecked.
    Priya S.: If a nurse had administered morphine from that tampered library, we'd be having a very different conversation.
    ~ influence -= 1
    #influence_decreased
}

Priya S.: CLAIM-HC-007: Incident response RTO. Met?

{hc007_claim_assessed:
    Priya S.: Assessed with Helen. The RTO was tight but the decision to escalate was documented.
}
{not hc007_claim_assessed:
    Priya S.: Not reviewed. You managed to recover, but without a framework.
    Priya S.: Lucky this time. Not a robust position.
    ~ influence -= 1
    #influence_decreased
}

-> hub


// ===========================================
// REGULATORY
// ===========================================

=== regulatory ===

~ topic_regulatory = true

Priya S.: Regulatory compliance. ICO notification — made within 72 hours?

{ico_notified:
    Priya S.: Notification sent. Helen Carver managed this well.
    Priya S.: Any breach of this scale affecting special category health data requires prompt disclosure.
    Priya S.: You met the obligation.
}
{ico_deadline_missed:
    Priya S.: The 72-hour window passed without notification.
    Priya S.: The ICO will look at this. Not just the breach, but the failure to report.
    Priya S.: Expect a follow-up assessment from the ICO's healthcare team.
    ~ influence -= 1
    #influence_decreased
}
{not ico_notified and not ico_deadline_missed:
    Priya S.: Notification hasn't been sent yet, but you're still within the window.
    Priya S.: That needs to happen before this debrief ends.
}

Priya S.: DSPT — Data Security and Protection Toolkit — you'll need to update your submission.

Priya S.: This incident is a mandatory disclosure item. It affects your assurance rating.

* [Understood]
    -> hub
* [What does that mean practically?]
    Priya S.: Your Trust's data security assurance is publicly reported. A serious incident affects that rating.
    Priya S.: It also feeds into your cyber insurance renewal and any NHS England performance review.
    -> hub


// ===========================================
// ROOT CAUSE
// ===========================================

=== root_cause ===

~ topic_root_cause = true

Priya S.: Root cause analysis. What was the initial access vector?

{vpn_anomaly_identified:
    Priya S.: VPN credential compromise — contractor account m.blake, no MFA.
    Priya S.: That's a textbook initial access finding. Stale account plus absent MFA equals open door.
}
{not vpn_anomaly_identified:
    Priya S.: Initial access vector wasn't confirmed during the incident.
    Priya S.: Without that, we can't close the gap. The attacker may still have a valid path back in.
    ~ influence -= 1
    #influence_decreased
}

Priya S.: Contributing factors: unpatched VPN endpoint, no MFA enforcement, leavers not deprovisioned.

Priya S.: These aren't exotic vulnerabilities. They're standard hygiene failures.

* [What should we have had in place?]
    Priya S.: MFA on all remote access. Account deprovisioning SLA — 24 hours maximum.
    Priya S.: Privileged access review every 90 days. These are Cyber Essentials baseline requirements.
    -> hub

* [Is this common across NHS Trusts?]
    Priya S.: More common than I'd like. Resource constraints, legacy systems, competing priorities.
    Priya S.: That's why the NCSC publishes sector-specific guidance. It doesn't require a large budget.
    -> hub


// ===========================================
// CLOSING — Learning synthesis
// ===========================================

=== closing ===

~ closing_reached = true

Priya S.: One final question. And I want you to think about it seriously.

Priya S.: The safety case claims existed before this attack. The VPN gap was a known risk.

Priya S.: Someone — maybe many people — knew the system wasn't fully safe, and operations continued anyway.

Priya S.: That's not unusual. It's called "normalisation of deviance." Risk becomes normal because nothing has gone wrong yet.

* [What do you do about that?]
    Priya S.: You make the risk visible. Regularly. To people with authority to act on it.
    Priya S.: Not in a risk register that nobody reads — in front of the board, in front of the clinicians.
    Priya S.: Safety cases only work if they're living documents, not compliance artefacts.
    -> debrief_complete

* [Was this preventable?]
    Priya S.: Almost entirely. The technical controls were understood. The process controls were documented.
    Priya S.: The gap was organisational — the will to act before an incident, not after.
    -> debrief_complete

* [What changes after today?]
    Priya S.: That depends on you. The recommendations will come. Whether they're implemented is a leadership question.
    Priya S.: Every Trust that's been through this says "never again." Some mean it.
    -> debrief_complete

=== debrief_complete ===

Priya S.: Thank you for your candour today. The review report will be with your board within four weeks.

Priya S.: The patients were fortunate. Let's make sure the next Trust doesn't have to rely on fortune.

#set_global:debrief_complete:true
#exit_conversation
-> hub


// ===========================================
// REPEATABLE HUB
// ===========================================

=== hub ===

+ {not topic_outcomes} [Let's start with patient outcomes]
    -> patient_outcomes

+ {not topic_claims} [Review the safety case claims]
    -> safety_claims

+ {not topic_regulatory} [Regulatory compliance]
    -> regulatory

+ {not topic_root_cause} [Root cause analysis]
    -> root_cause

+ {topic_outcomes and topic_claims and topic_regulatory and topic_root_cause and not closing_reached} [Are we done?]
    -> closing

+ {closing_reached} [Closing remarks]
    -> closing
