# Lab Sheet: SIS01 Healthcare - Northgate General Hospital Incident Response

## Learning Objectives

By completing this scenario, you will:

1. **Understand Safety-Critical Systems**: Explore how cybersecurity incidents can have real-world safety consequences in healthcare environments
2. **Apply Incident Response Principles**: Practice systematic incident investigation and evidence collection in a critical infrastructure setting
3. **Analyze Safety Instrumented Systems (SIS)**: Identify the safety mechanisms in medical device systems and understand their security requirements
4. **Evaluate Security Controls**: Assess the effectiveness of network segmentation, access controls, and monitoring in healthcare IT/OT environments
5. **Apply Regulatory Frameworks**: Understand compliance requirements from IEC 62443, HIPAA, and medical device regulations

## Scenario Context

You are responding to a cybersecurity incident at Northgate General Hospital. A ransomware attack has impacted the hospital's IT network, and there are concerns about potential safety implications for connected medical devices, specifically the InfusionGuard smart infusion pump system.

**Your Mission**: Investigate the incident, determine if medical device safety has been compromised, and gather evidence about how the attack occurred and what systems were affected.

### Key Concepts

**Safety Instrumented Systems (SIS)**: These are control systems designed to bring a process to a safe state when unacceptable or dangerous conditions are detected. In healthcare:
- Medical devices often include safety interlocks and alarm systems
- The InfusionGuard system has multiple layers of safety protection (SIL-rated components)
- Security failures can compromise safety functions, leading to patient harm

**Defense in Depth**: Multiple layers of security controls work together:
- Network segmentation (IT vs. OT/medical networks)
- Access controls and authentication
- Monitoring and alerting systems
- Physical security measures
- Secure device configurations

**Incident Response in Healthcare**: Critical considerations include:
- Patient safety is the top priority
- Regulatory reporting requirements (HIPAA, FDA)
- Evidence preservation for both security and safety investigations
- Coordinating with clinical staff and safety teams

## Gameplay Instructions

### Getting Started

1. **Read the Information Pack**: Before starting the scenario, review the `information_pack.md` file in this directory. Pay special attention to:
   - System architecture and network segmentation
   - InfusionGuard safety requirements and SIL ratings
   - The incident timeline and initial observations

2. **Launch the Scenario**: Load SIS01 Healthcare from the scenario selection screen

3. **Initial Orientation**: You'll start in a hospital corridor. Take time to explore and familiarize yourself with the environment

### Investigation Strategy

**Phase 1: Initial Assessment**
- Locate and talk to hospital staff to understand the current situation
- Identify what systems are affected and what alerts have been triggered
- Determine if any medical devices are showing unusual behavior

**Phase 2: Evidence Collection**
- Examine computer systems and network devices
- Collect logs and system states
- Document the security configuration of critical systems
- Look for indicators of compromise (IoCs)

**Phase 3: Medical Device Investigation**
- Access the InfusionGuard management system
- Check device configurations and safety parameters
- Verify the integrity of safety-critical components
- Assess whether the Safety Instrumented Functions (SIFs) are still operational

**Phase 4: Root Cause Analysis**
- Trace the attack path from initial compromise to medical network
- Identify security control failures
- Determine if safety systems were intentionally targeted

### Hints and Tips

💡 **Network Architecture**: Pay attention to how different networks are segmented. Medical devices should be isolated from general IT systems.

💡 **Safety First**: Look for evidence of safety parameter changes. Even if devices appear to be working, configuration tampering could create future risks.

💡 **Access Logs**: Check who accessed critical systems and when. Unusual administrative access during the incident window is suspicious.

💡 **Alarm Systems**: The InfusionGuard system has multiple alarm mechanisms. Verify each layer is functioning correctly.

💡 **Regulatory Context**: Consider what evidence would be needed for HIPAA breach notification and FDA medical device reporting.

### Common Challenges

- **Finding the Medical Device Network**: Look for network documentation or system diagrams
- **Understanding Safety Parameters**: The information pack contains details about SIL ratings and safety requirements
- **Authentication**: You may need to find credentials or access cards scattered throughout the environment
- **Interpreting Logs**: Focus on timestamps around the incident window and unusual patterns

## Assessment Exercise

> **Note**: The following assessment component will be developed in a future update. This is a placeholder for post-scenario synthesis activities.

### Reflection Questions

After completing the scenario, you should be able to answer:

1. **Incident Timeline**: Reconstruct the attack sequence from initial compromise to potential medical device impact
2. **Safety Impact**: Did the attack compromise any safety-critical functions? What evidence supports your conclusion?
3. **Security Controls**: Which security controls failed, and which controls successfully limited the attack's impact?
4. **Regulatory Response**: What regulatory notifications would be required based on your findings?

### Technical Analysis

[PLACEHOLDER: Detailed technical questions about specific findings in the scenario]

### Design Critique

[PLACEHOLDER: Questions about how the hospital's system architecture and security controls could be improved]

### Incident Response Report

[PLACEHOLDER: Structured template for writing a formal incident response report based on scenario findings]

---

## Additional Resources

- Review the **Information Pack** (`information_pack.md`) for detailed system documentation
- Consult the **Dungeon Graph** for the scenario structure (if available)
- Refer to IEC 62443-4-2 for industrial control system security requirements
- Review FDA guidance on medical device cybersecurity

## Getting Help

If you're stuck:
1. Re-read the information pack sections on system architecture
2. Talk to all NPCs - they may provide crucial hints
3. Check your inventory - items you collect often contain important information
4. Review the learning objectives - are you focusing on the right aspects of the investigation?

---

**Remember**: This is a learning environment. Take your time to explore, make mistakes, and understand the interconnections between cybersecurity and patient safety. Real incident responders in healthcare face these exact challenges every day.
