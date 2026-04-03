// ===========================================
// NPC: Priya Chandra (SCADA Engineer)
// Scenario: Albion Battery Hall Crisis
// Role: Primary guide; walkdown companion; ESD knowledge; SIS expertise
// ===========================================
//
// GLOBALS READ:
//   anomaly_detected, historian_flatline_found, jump_server_confirmed,
//   sis_tamper_confirmed, esd_activated, facility_safe_state
//
// GLOBALS WRITTEN:
//   priya_briefed (set in arrival_briefing and start)
//
// TASKS COMPLETED VIA EVENTMAPPING (not directly):
//   check_hmi_readings, check_thermometer, read_sis_config,
//   find_certification_doc, pull_ethernet_cable, read_incident_folder,
//   complete_nis_form
//
// ===========================================

// Global variables managed by scenario - declared locally and updated by game engine
VAR anomaly_detected = false
VAR historian_flatline_found = false
VAR sis_tamper_confirmed = false
VAR esd_activated = false
VAR facility_safe_state = false

// Local NPC state tracking
VAR priya_briefed = false
VAR topic_walkdown_offered = false
VAR topic_esd_explained = false
VAR topic_sis_explained = false
VAR topic_patch_discussed = false


// ===========================================
// TIMED OPENING CUTSCENE (called by timedConversation)
// ===========================================

=== arrival_briefing ===
#speaker:priya_chandra

Priya: You made good time. I appreciate it.

Priya: I'm Priya Chandra — I run the PLC and SCADA systems here. I came in early for a maintenance window.

Priya: The overnight shift left no incident reports. Readings look entirely normal. But something feels off.

Priya: The night shift technician — Jay Patel — he usually flags anything unusual in the handover notes. Today's notes are just 'uneventful.'

Priya: Jay's been here three years. He never writes 'uneventful' when it actually was.

~ priya_briefed = true
#set_global:priya_briefed:true

-> DONE


// ===========================================
// DEFAULT ENTRY (player walks up to Priya)
// ===========================================

=== start ===
#speaker:priya_chandra

{ not priya_briefed:
    Priya: Oh good — you're here. Let me brief you quickly.
    Priya: I'm Priya Chandra. Something about this morning handover isn't sitting right with me.
    ~ priya_briefed = true
    #set_global:priya_briefed:true
    -> briefing_hub
}

{ priya_briefed and not topic_walkdown_offered:
    Priya: I'd like to do a walkdown of Battery Hall 1 before the maintenance window opens.
    Priya: I have the plant room badge. Shall we go?
    ~ topic_walkdown_offered = true
    -> walkdown_offer
}

{ priya_briefed:
    -> hub
}


// ===========================================
// INITIAL BRIEFING HUB
// ===========================================

=== briefing_hub ===
#speaker:priya_chandra

Priya: Where do you want to start?

* [Tell me about the facility]
    -> facility_overview

* [What does the HMI show?]
    -> hmi_overview

* [How do we get into the battery halls?]
    -> access_explained

* [Let's do the Battery Hall walkdown now]
    -> walkdown_offer

* [I need to read through the Incident Response folder first]
    Priya: Of course — it's on the wall behind you. Take a minute.
    -> hub


=== facility_overview ===
#speaker:priya_chandra

Priya: We have two battery halls — Hall 1 and Hall 2. 220 MWh total. Four racks in each hall.

Priya: The SCADA system monitors and controls everything — temperature, state of charge, charge rate. The SIS sits underneath that and should trip the system if any safety parameter is breached.

Priya: Should. That's the word I keep getting stuck on this morning.

-> briefing_hub


=== hmi_overview ===
#speaker:priya_chandra

Priya: HMI-OPS-01 shows everything you'd expect — Battery Hall 1 sitting at a steady 28 degrees, state of charge at 72 percent, all alarms green.

Priya: That's actually part of what concerns me. These readings show almost no variance overnight. Normally we'd see at least a degree of fluctuation as the cells cycle.

Priya: The historian trend would show that more clearly. Have a look if you want.

-> hub


=== access_explained ===
#speaker:priya_chandra

Priya: Battery Hall 1 requires the plant room RFID badge — I have it here.

Priya: The Engineering Workshop is east of us. Key's in the duty officer desk drawer. That room has the engineering workstation and the jump server rack.

-> hub


// ===========================================
// WALKDOWN OFFER
// ===========================================

=== walkdown_offer ===
#speaker:priya_chandra

Priya: I've got the plant room badge here. Battery Hall 1 is through the north door.

* [Yes — let's go now]
    Priya: Right. Follow me.
    Priya: I'll tell you what to look for on the way.
    -> hub

* [I want to review the historian trend first]
    Priya: That's sensible. I'll be here when you're ready.
    -> hub

* [What should I look for in the battery hall?]
    -> what_to_look_for


=== what_to_look_for ===
#speaker:priya_chandra

Priya: The main thing I want to check is the temperature at Rack A2. The SCADA reading is fine — but that rack ran warmer than the others last month.

Priya: There's an old analog thermometer on the wall near A2. Not networked. I want to compare it against the digital reading.

Priya: If they disagree, that tells us something important.

-> hub


// ===========================================
// MAIN REPEATABLE HUB
// ===========================================

=== hub ===
#speaker:priya_chandra

+ [Ask about the analog thermometer discrepancy] { anomaly_detected }
    -> thermometer_discrepancy

+ [Ask about the historian flat-line reading] { historian_flatline_found }
    -> historian_anomaly

+ [Ask about the SIS configuration] { sis_tamper_confirmed }
    -> sis_compromise_discussion

+ [Ask about the hardwired ESD] { not topic_esd_explained }
    -> esd_explanation

+ [Ask about the SIS patch situation] { sis_tamper_confirmed and not topic_patch_discussed }
    -> patch_situation

+ [Ask about next steps]
    -> next_steps

+ [Nothing right now]
    Priya: I'll be here. Don't take too long — if my instincts are right, time matters.
    #exit_conversation
    -> DONE


// ===========================================
// ANOMALY DETECTION BRANCH
// ===========================================

=== thermometer_discrepancy ===
#speaker:priya_chandra

Priya: Fifty-one degrees. The HMI says twenty-eight.

Priya: I've been in this industry long enough to know what that means. One of those readings is a lie.

Priya: The analog thermometer was calibrated six months ago. It has no network connection. It cannot be falsified remotely.

* [So the SCADA reading is wrong?]
    Priya: If the physical thermometer is correct, then yes. Something is feeding the SCADA system false data.
    Priya: That thermometer is the most important object in this building right now, because it is the only reading that cannot be compromised.
    -> hub

* [Could the thermometer itself be faulty?]
    Priya: It's possible. But if I had to choose between trusting a networked digital system and a certified analog gauge, and those readings disagree by twenty-three degrees — I trust the gauge.
    Priya: The digital system has more failure modes. Including deliberate manipulation.
    -> hub

* [What do we do with this information?]
    Priya: We need to verify it — check the historian trend data, look at the access logs. And we need to seriously consider pressing the ESD before this escalates further.
    -> hub


// ===========================================
// HISTORIAN ANOMALY BRANCH
// ===========================================

=== historian_anomaly ===
#speaker:priya_chandra

Priya: Three hours of exactly twenty-eight point zero. Not twenty-seven point nine, not twenty-eight point one. Exactly twenty-eight.

Priya: Real sensor data has noise. Electrical interference, measurement jitter, thermal fluctuation. A perfectly flat line for three hours means the data is synthetic.

Priya: Someone wrote a value to the sensor feed and held it there. This is not a sensor failure. This is deliberate falsification.

* [How long has this been going on?]
    Priya: The flat-line starts at 23:12 last night. That's when the real reading was replaced.
    Priya: Which means Battery Hall 1 has been operating without meaningful temperature monitoring for over seven hours.
    -> hub

* [Is Marcus Webb the right person to call?]
    Priya: Yes. Marcus is OT Security. He's been trying to get the IT/OT boundary sorted for eighteen months. He'll know what to do.
    -> hub


// ===========================================
// ESD EXPLANATION
// ===========================================

=== esd_explanation ===
#speaker:priya_chandra
~ topic_esd_explained = true

Priya: The hardwired ESD is a red mushroom-head button on the wall in Battery Hall 1, near Rack A2.

Priya: It is a physical electrical interlock. When you press it, it breaks the charging circuit for Racks A1 through A4. Immediately. No SCADA involved, no SIS firmware, no network command.

Priya: It cannot be disabled remotely. It cannot be falsified. A cyber attack cannot prevent a hardwired circuit from opening.

* [How does it work exactly?]
    Priya: It's a direct relay. Power flows through a normally-closed switch. Press the button — circuit opens — racks disconnect. The software doesn't get a vote.
    Priya: That's the point. The hardwired ESD exists precisely because we cannot trust that the programmable safety layers will always work.
    -> hub

* [Should we press it now?]
    Priya: That's what Marcus needs to confirm. The ESD is irreversible without a manual reset — pressing it without proper authority creates its own complications.
    Priya: But if the cells are at fifty-one degrees and rising with a compromised SIS, the answer may well be yes.
    -> hub


// ===========================================
// SIS COMPROMISE DISCUSSION
// ===========================================

=== sis_compromise_discussion ===
#speaker:priya_chandra
~ topic_sis_explained = true

Priya: Eighty-five degrees. The SIS thermal runaway threshold has been raised from fifty-five to eighty-five.

Priya: That means the automated safety function won't trip until the cells are already in irreversible failure. The protection we thought was there — isn't.

* [How did they get into the SIS?]
    Priya: The SIS has an engineering port for configuration and maintenance. That port should be isolated — but it's reachable from the SCADA network.
    Priya: If someone can get onto the SCADA network, they can reach the SIS engineering interface. Which means the SIS isn't independent. It's connected.
    Priya: IEC 61511 requires SIS logical isolation from the control system for exactly this reason.
    #set_global:en002_claim_assessed:true
    -> hub

* [What are the consequences?]
    Priya: The SIS was our last automated safety backstop. Without it, the only safety function remaining is the hardwired ESD — which is independent, but requires someone to physically go and press it.
    Priya: Everything else — the BMS overcharge protection, the cell temperature alarm, the thermal runaway trip — all of those are compromised.
    -> hub


// ===========================================
// PATCH SITUATION
// ===========================================

=== patch_situation ===
#speaker:priya_chandra
~ topic_patch_discussed = true

Priya: The patch was available eighteen months ago. It fixes the authentication bypass on the SIS engineering port — the exact vulnerability that was used to change those setpoints.

Priya: We deferred it because applying it requires recertification under IEC 61511. Eight weeks offline. £180,000. The board said no.

* [Was the deferral the right call?]
    Priya: I think about that. The risk was real — documented in Marcus's risk assessment. But it felt manageable at the time.
    Priya: Now? With a battery hall approaching thermal runaway? It clearly wasn't.
    Priya: The question for the debrief is: what's the right approach going forward? Apply the patch and accept the recertification cost? Or maintain deferral with genuinely effective compensating controls?
    -> hub

* [What would applying the patch change?]
    Priya: It would close the authentication bypass on the SIS engineering port. An attacker on the SCADA network could no longer modify SIS setpoints without proper credentials.
    Priya: But we'd need to re-run the full SIL 2 safety case — verify that the patched firmware meets the functional safety requirements. That's the eight weeks and £180,000.
    -> hub


// ===========================================
// NEXT STEPS
// ===========================================

=== next_steps ===
#speaker:priya_chandra

{ not esd_activated:
    Priya: Priority one is the ESD. If those cells are at fifty-one degrees with a compromised SIS, we need to disconnect them from the charging circuit now.
    Priya: Marcus has the authority to direct that. Have you called him yet?
    -> hub
}

{ esd_activated and not facility_safe_state:
    Priya: Good — ESD is done. The racks are cooling.
    Priya: Now we need to isolate the attacker, understand the full scope of what they changed, and get the notification to NCSC.
    -> hub
}

{ facility_safe_state:
    Priya: We're in a safe state now. The immediate hazard is contained.
    Priya: Dr Bashir from NCSC and HSE has arrived for the post-incident review. I'd suggest talking to her.
    -> hub
}
