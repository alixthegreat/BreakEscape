// ===========================================
// NPC: Dr Priya Sharma (NCSC Investigator)
// Scenario: Northgate Hospital
// Role: Post-incident debrief; safety case review; closing learning synthesis
// Triggered: when debrief_started = true
// CyBOK links: All three claims; incident learning; SIS framework; organisational resilience
// ===========================================

// Global variables managed by scenario - declared locally here and updated by game engine
VAR bed4_escalated = false
VAR drug_tamper_found = false
VAR drug_library_restored = false
VAR network_isolated = false
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
//               network_isolated, restore_operations, ico_notified,
//               hc001_claim_assessed, hc003_claim_assessed, hc007_claim_assessed,
//               major_incident_declared, ico_deadline_missed

// ===========================================
// ENTRY POINT — Debrief opens
// ===========================================

=== start ===

Dr Priya Sharma: Good. Let's sit down. I'm Dr Priya Sharma — NCSC Healthcare Resilience team.

Dr Priya Sharma: I've been briefed on the incident timeline. I'm here for the post-incident review, not to assign blame.

Dr Priya Sharma: But I do need honest answers. What we learn here shapes guidance for every NHS Trust in England.

* [Where do we start?]
    -> patient_outcomes

* [Is this being recorded?]
    Dr Priya Sharma: Everything goes into the NCSC incident database — anonymised. No names, no Trust identifiers.
    Dr Priya Sharma: The learning matters. The blame doesn't — that's for the internal SIRI process.
    -> hub

* [What happens after this review?]
    Dr Priya Sharma: We produce a structured finding. It goes to NHS England, DSPT team, and back to you.
    Dr Priya Sharma: Recommendations are non-binding — but Trusts that ignore them tend to appear in our reports again.
    -> hub


// ===========================================
// PATIENT OUTCOMES
// ===========================================

=== patient_outcomes ===

~ topic_outcomes = true

Dr Priya Sharma: First question: patient outcomes. Were any patients harmed?

{bed4_escalated:
    Dr Priya Sharma: Bed 4 was escalated early. That's the right call — monitoring the unmonitored.
    Dr Priya Sharma: Mrs Fletcher was reviewed by the registrar. No adverse outcome.
}
{not bed4_escalated:
    Dr Priya Sharma: Bed 4 wasn't escalated during the incident window.
    Dr Priya Sharma: Mrs Fletcher experienced an extended period without monitoring. She was fortunate.
    Dr Priya Sharma: That near-miss needs to be in the SIRI report.
    ~ influence -= 1
    #influence_decreased
}

{drug_library_restored:
    Dr Priya Sharma: Drug library was identified as tampered and restored before any compromised doses were administered.
    Dr Priya Sharma: That's CLAIM-HC-003 working — eventually.
}
{drug_tamper_found and not drug_library_restored:
    Dr Priya Sharma: The drug library tamper was found but not restored during the incident.
    Dr Priya Sharma: Were pumps suspended? If medication continued from a tampered library, we have a serious patient safety event.
    ~ influence -= 1
    #influence_decreased
}
{not drug_tamper_found:
    Dr Priya Sharma: The drug library anomaly wasn't detected during the incident.
    Dr Priya Sharma: That's a significant gap. A morphine DOSE_MAX of 40mg instead of 4mg is potentially lethal.
    ~ influence -= 1
    #influence_decreased
}

-> hub


// ===========================================
// SAFETY CLAIMS REVIEW
// ===========================================

=== safety_claims ===

~ topic_claims = true

Dr Priya Sharma: Let's go through the safety case claims. Three were active during this incident.

Dr Priya Sharma: CLAIM-HC-001: Network segmentation. Was it assessed before the isolation decision?

{hc001_claim_assessed:
    Dr Priya Sharma: Good. David Osei reviewed it. The VPN perimeter gap was noted.
    Dr Priya Sharma: That's honest safety case management — acknowledging where the claim didn't hold.
}
{not hc001_claim_assessed:
    Dr Priya Sharma: It wasn't formally assessed. You isolated without reviewing the claim.
    Dr Priya Sharma: The outcome was correct, but the process wasn't. Safety cases exist precisely for this.
    ~ influence -= 1
    #influence_decreased
}

Dr Priya Sharma: CLAIM-HC-003: Drug library integrity. Assessed?

{hc003_claim_assessed:
    Dr Priya Sharma: Reviewed with David. The correct response — check the claim, verify the library.
}
{not hc003_claim_assessed:
    Dr Priya Sharma: Not reviewed. A safety claim directly affecting patient lives went unchecked.
    Dr Priya Sharma: If a nurse had administered morphine from that tampered library, we'd be having a very different conversation.
    ~ influence -= 1
    #influence_decreased
}

Dr Priya Sharma: CLAIM-HC-007: Incident response RTO. Met?

{hc007_claim_assessed:
    Dr Priya Sharma: Assessed with Helen. The RTO was tight but the decision to escalate was documented.
}
{not hc007_claim_assessed:
    Dr Priya Sharma: Not reviewed. You managed to recover, but without a framework.
    Dr Priya Sharma: Lucky this time. Not a robust position.
    ~ influence -= 1
    #influence_decreased
}

-> hub


// ===========================================
// REGULATORY
// ===========================================

=== regulatory ===

~ topic_regulatory = true

Dr Priya Sharma: Regulatory compliance. ICO notification — made within 72 hours?

{ico_notified:
    Dr Priya Sharma: Notification sent. Helen Carver managed this well.
    Dr Priya Sharma: Any breach of this scale affecting special category health data requires prompt disclosure.
    Dr Priya Sharma: You met the obligation.
}
{ico_deadline_missed:
    Dr Priya Sharma: The 72-hour window passed without notification.
    Dr Priya Sharma: The ICO will look at this. Not just the breach, but the failure to report.
    Dr Priya Sharma: Expect a follow-up assessment from the ICO's healthcare team.
    ~ influence -= 1
    #influence_decreased
}
{not ico_notified and not ico_deadline_missed:
    Dr Priya Sharma: Notification hasn't been sent yet, but you're still within the window.
    Dr Priya Sharma: That needs to happen before this debrief ends.
}

Dr Priya Sharma: DSPT — Data Security and Protection Toolkit — you'll need to update your submission.

Dr Priya Sharma: This incident is a mandatory disclosure item. It affects your assurance rating.

* [Understood]
    -> hub
* [What does that mean practically?]
    Dr Priya Sharma: Your Trust's data security assurance is publicly reported. A serious incident affects that rating.
    Dr Priya Sharma: It also feeds into your cyber insurance renewal and any NHS England performance review.
    -> hub


// ===========================================
// ROOT CAUSE
// ===========================================

=== root_cause ===

~ topic_root_cause = true

Dr Priya Sharma: Root cause analysis. What was the initial access vector?

{vpn_anomaly_identified:
    Dr Priya Sharma: VPN credential compromise — contractor account c.ellison, no MFA.
    Dr Priya Sharma: That's a textbook initial access finding. Stale account plus absent MFA equals open door.
}
{not vpn_anomaly_identified:
    Dr Priya Sharma: Initial access vector wasn't confirmed during the incident.
    Dr Priya Sharma: Without that, we can't close the gap. The attacker may still have a valid path back in.
    ~ influence -= 1
    #influence_decreased
}

Dr Priya Sharma: Contributing factors: unpatched VPN endpoint, no MFA enforcement, leavers not deprovisioned.

Dr Priya Sharma: These aren't exotic vulnerabilities. They're standard hygiene failures.

* [What should we have had in place?]
    Dr Priya Sharma: MFA on all remote access. Account deprovisioning SLA — 24 hours maximum.
    Dr Priya Sharma: Privileged access review every 90 days. These are Cyber Essentials baseline requirements.
    -> hub

* [Is this common across NHS Trusts?]
    Dr Priya Sharma: More common than I'd like. Resource constraints, legacy systems, competing priorities.
    Dr Priya Sharma: That's why the NCSC publishes sector-specific guidance. It doesn't require a large budget.
    -> hub


// ===========================================
// CLOSING — Learning synthesis
// ===========================================

=== closing ===

~ closing_reached = true

Dr Priya Sharma: One final question. And I want you to think about it seriously.

Dr Priya Sharma: The safety case claims existed before this attack. The VPN gap was a known risk.

Dr Priya Sharma: Someone — maybe many people — knew the system wasn't fully safe, and operations continued anyway.

Dr Priya Sharma: That's not unusual. It's called "normalisation of deviance." Risk becomes normal because nothing has gone wrong yet.

* [What do you do about that?]
    Dr Priya Sharma: You make the risk visible. Regularly. To people with authority to act on it.
    Dr Priya Sharma: Not in a risk register that nobody reads — in front of the board, in front of the clinicians.
    Dr Priya Sharma: Safety cases only work if they're living documents, not compliance artefacts.
    -> debrief_complete

* [Was this preventable?]
    Dr Priya Sharma: Almost entirely. The technical controls were understood. The process controls were documented.
    Dr Priya Sharma: The gap was organisational — the will to act before an incident, not after.
    -> debrief_complete

* [What changes after today?]
    Dr Priya Sharma: That depends on you. The recommendations will come. Whether they're implemented is a leadership question.
    Dr Priya Sharma: Every Trust that's been through this says "never again." Some mean it.
    -> debrief_complete

=== debrief_complete ===

Dr Priya Sharma: Thank you for your candour today. The review report will be with your board within four weeks.

Dr Priya Sharma: The patients were fortunate. Let's make sure the next Trust doesn't have to rely on fortune.

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

+ [Leave debrief for now]
    Dr Priya Sharma: We can continue. But try to cover all four areas — the findings need to be complete.
    #exit_conversation
    -> hub
