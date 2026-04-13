// ===========================================
// NPC: Ravi Anand (IT Security Lead)
// Scenario: Northgate Hospital
// Role: SIEM context; VPN anomaly briefing; issues IT security PIN for dual-auth
// ===========================================

// Global variables managed by scenario - declared locally here and updated by game engine
VAR siem_escalated = false
VAR vpn_anomaly_identified = false
VAR network_isolated = false

VAR itsec_pin = ""

VAR ravi_trust = 0
VAR topic_siem = false
VAR topic_vpn = false
VAR topic_isolation = false
VAR topic_contractor = false
VAR gave_itsec_code = false

// Global reads: siem_escalated, vpn_anomaly_identified, network_isolated, itsec_pin
// Global writes: itsec_authorised

// ===========================================
// FIRST ENCOUNTER
// ===========================================

=== start ===

{siem_escalated and vpn_anomaly_identified:
    Ravi Anand: You've done both — SIEM and VPN. We have everything we need.
    -> give_itsec_code
}

{siem_escalated:
    Ravi Anand: You've escalated the right alerts. Good — that confirms the lateral movement path.
    Ravi Anand: Now I need the initial access vector confirmed. Check the VPN log terminal — there's a contractor login from Romania I flagged.
    -> hub
}

Ravi Anand: Finally. I've been waiting for someone with authority to act on this.

Ravi Anand: We're thirty minutes into a live ransomware incident and I still don't have sign-off to isolate.

Ravi Anand: The SIEM console is through there — I need you to review the alert stream first.

* [Tell me what you know]
    -> siem_briefing

* [What's blocking the isolation?]
    Ravi Anand: Hospital protocol. Major interventions need dual sign-off — IT security and clinical lead.
    Ravi Anand: David Osei is the clinical safety engineer. You'll need him too.
    -> siem_briefing

* [Let's just isolate now]
    Ravi Anand: I can't authorise that alone. And if I isolate the wrong segment, I take down patient systems.
    Ravi Anand: Please — look at the SIEM data first. Then we decide together.
    -> siem_briefing


// ===========================================
// SIEM BRIEFING
// ===========================================

=== siem_briefing ===

~ topic_siem = true

Ravi Anand: The SIEM is picking up lateral movement — same source IP hitting multiple internal hosts.

Ravi Anand: There's also an authentication anomaly in the VPN logs I flagged thirty minutes ago.

Ravi Anand: Review the console, escalate the criticals, then come back to me.

#complete_task:review_siem_alerts
#unlock_task:investigate_vpn_logs

* [What am I looking for?]
    Ravi Anand: Look for the lateral movement alerts — anything tagged RANSOMWARE-PREP or EXFIL.
    Ravi Anand: And check the auth anomaly — a contractor account logged in from Romania. No MFA.
    -> hub

* [I'll look at it now]
    -> hub


// ===========================================
// VPN ANOMALY BRIEFING
// ===========================================

=== vpn_briefing ===

~ topic_vpn = true

Ravi Anand: The log entry at line 31 — user c.ellison, source IP 185.220.101.47, Romania.

Ravi Anand: C. Ellison is on our contractor list but has no active engagement right now.

Ravi Anand: No MFA challenge was triggered. That's a policy violation and a likely initial access vector.

* [How do we confirm it?]
    Ravi Anand: Run check_anomaly.sh on the VM terminal — pass it the IP and it'll verify against our threat intel.
    ~ topic_contractor = true
    -> hub

* {vpn_anomaly_identified} [We've confirmed the anomaly]
    Ravi Anand: Good. That log entry is your initial access evidence. Keep it — it feeds into the safety case.
    #complete_task:investigate_vpn_logs
    -> hub


// ===========================================
// GIVE IT SECURITY PIN
// ===========================================

=== give_itsec_code ===

{not gave_itsec_code:
    {siem_escalated and vpn_anomaly_identified:
        Ravi Anand: You've done the analysis. You've seen what we're dealing with.
        Ravi Anand: I've written up the authorisation slip — my PIN is on it, along with my signature.
        Ravi Anand: Take it to the dual-auth panel in the Major Incident Room. You'll need David Osei's slip too — both codes are required.
        #give_item:notes
        ~ gave_itsec_code = true
        -> hub
    }
    {not siem_escalated:
        Ravi Anand: I'm not handing over authorisation codes until we've properly triaged the SIEM.
        Ravi Anand: Review the console and escalate the criticals first.
        -> hub
    }
    {not vpn_anomaly_identified:
        Ravi Anand: We still haven't confirmed the initial access vector.
        Ravi Anand: Check the VPN logs on the terminal. Run the anomaly check script.
        -> hub
    }
}

{gave_itsec_code:
    Ravi Anand: You have my code. Get David's and use the dual-auth panel.
    -> hub
}


// ===========================================
// POST-ISOLATION
// ===========================================

=== post_isolation ===

Ravi Anand: We're isolated. Lateral movement should stop now.

Ravi Anand: Monitoring segment is on its own VLAN — Sarah's ward should start recovering.

{network_isolated:
    Ravi Anand: This is what CLAIM-HC-001 was designed to prevent. Network segmentation working as intended.
    Ravi Anand: Pity it took a live incident to prove the value.
}

* [What's next?]
    Ravi Anand: Backup restoration. Talk to Helen Carver — she holds the ICO obligations and the backup procedures.
    -> hub

* [How did they get past segmentation?]
    Ravi Anand: The VPN contractor account bypassed it. That's the gap we need to close after recovery.
    -> hub


// ===========================================
// REPEATABLE HUB
// ===========================================

=== hub ===

+ {not topic_siem and not siem_escalated} [Tell me about the SIEM alerts]
    -> siem_briefing

+ {siem_escalated and not vpn_anomaly_identified} [I've escalated the SIEM alerts — what's next?]
    ~ topic_siem = true
    Ravi Anand: Those four alerts confirm the kill chain — the cross-zone RDP is how they reached the clinical VLAN.
    Ravi Anand: Next I need the initial access vector confirmed. Check the VPN log terminal — contractor account, login from Romania, no MFA.
    Ravi Anand: Find the entry, run the anomaly check, then come back.
    ~ topic_vpn = true
    -> hub

+ {not topic_vpn and not siem_escalated} [The VPN anomaly]
    -> vpn_briefing

+ {topic_vpn and not vpn_anomaly_identified} [The VPN anomaly — remind me what I'm doing]
    -> vpn_briefing

+ {vpn_anomaly_identified and not gave_itsec_code} [VPN anomaly confirmed — what now?]
    Ravi Anand: Good. That entry is your initial access evidence.
    Ravi Anand: You've done the analysis. Get my authorisation code and David Osei's, then use the dual-auth panel.
    -> give_itsec_code

+ {not topic_isolation} [What does network isolation actually do?]
    ~ topic_isolation = true
    Ravi Anand: We disconnect the ransomware-affected segment from clinical systems and internet.
    Narrator: Ravi points toward the network diagram on the wall.
    Ravi Anand: Look at the network architecture. Enterprise segment is compromised. We sever the connections to Clinical and Legacy.
    Ravi Anand: Stops the spread. Stops the attacker sending a new payload. Buys us time for recovery.
    Ravi Anand: But it also takes down anything running on that segment — which is why we need dual sign-off from David on the clinical side.
    -> hub

+ {not topic_contractor} [Who is C. Ellison?]
    ~ topic_contractor = true
    Ravi Anand: Connor Ellison — an IT contractor who worked here eighteen months ago.
    Ravi Anand: Account was never deprovisioned. Classic offboarding failure.
    Ravi Anand: The attacker either compromised Ellison, or is using stolen credentials.
    -> hub

+ {siem_escalated and vpn_anomaly_identified and not gave_itsec_code} [I need your authorisation code]
    -> give_itsec_code

+ [Leave conversation]
    Ravi Anand: Keep moving. Clock is ticking.
    #exit_conversation
    -> hub
