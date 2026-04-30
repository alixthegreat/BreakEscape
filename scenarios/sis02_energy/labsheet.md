# Lab Sheet: SIS02 Energy - Albion Energy Grid Attack Investigation

## Learning Objectives

By completing this scenario, you will:

1. **Understand Industrial Control Systems (ICS)**: Explore the unique security challenges of operational technology (OT) environments in critical infrastructure
2. **Apply Incident Response in OT Environments**: Practice incident investigation techniques specific to industrial control systems
3. **Analyze Safety Instrumented Systems (SIS)**: Identify safety mechanisms in energy grid control systems and understand their criticality
4. **Evaluate IT/OT Convergence Risks**: Understand how attacks pivot from IT networks to operational technology systems
5. **Apply Regulatory Frameworks**: Understand compliance requirements from IEC 62443, NERC CIP, and national grid security standards

## Scenario Context

You are investigating a sophisticated cyber attack against Albion Energy, a regional electricity distribution operator. The attack has progressed from the corporate IT network into the operational technology (OT) environment, raising concerns about grid stability and the Safety Instrumented System (SIS) that prevents dangerous electrical conditions.

**Your Mission**: Investigate how attackers penetrated the OT network, determine if safety systems have been compromised, and assess the risk to grid operations and public safety.

### Key Concepts

**Safety Instrumented Systems (SIS) in Energy**: Protection systems that prevent catastrophic failures:
- Emergency shutdown systems (ESD) for substations
- Overcurrent and overvoltage protection
- Load shedding mechanisms to prevent cascade failures
- SIL-rated (Safety Integrity Level) components ensure reliability
- Independent from normal control systems (DCS/SCADA)

**IT/OT Convergence**: The integration and risks of connecting business and industrial networks:
- Corporate IT systems connected to engineering workstations
- Remote access for maintenance and monitoring
- Shared authentication systems and network infrastructure
- Attack pivoting from IT to OT environments

**ICS Protocols**: Specialized industrial communication protocols:
- Modbus TCP/IP for PLC communication
- DNP3 for grid telemetry and control
- IEC 61850 for substation automation
- These protocols often lack built-in security features

**Defense in Depth for Critical Infrastructure**:
- Air-gapped or heavily segmented OT networks
- Industrial DMZ (IDMZ) for controlled IT/OT communication
- Secure remote access solutions
- Physical security and access controls
- Continuous monitoring and anomaly detection

## Gameplay Instructions

### Getting Started

1. **Read the Information Pack**: Before starting the scenario, review the `information_pack.md` file in this directory. Focus on:
   - Network architecture and segmentation model
   - SCADA system and SIS components
   - ICS protocols in use
   - The incident timeline and initial alerts

2. **Launch the Scenario**: Load SIS02 Energy from the scenario selection screen

3. **Initial Orientation**: You'll start at an Albion Energy facility. Familiarize yourself with the industrial environment and control room layout

### Investigation Strategy

**Phase 1: Incident Scope Assessment**
- Interview operational staff and IT personnel
- Determine which networks and systems are affected
- Identify any unusual behavior in grid operations
- Check the status of safety and monitoring systems

**Phase 2: Attack Path Reconstruction**
- Trace how attackers moved from corporate IT to OT networks
- Identify compromised credentials or vulnerable services
- Examine jump hosts and engineering workstations
- Look for indicators of lateral movement

**Phase 3: OT System Integrity Verification**
- Examine SCADA system logs and configurations
- Verify PLC (Programmable Logic Controller) ladder logic integrity
- Check the Safety Instrumented System (SIS) status
- Review substation controller configurations
- Assess communication patterns on ICS protocols

**Phase 4: Safety System Analysis**
- Determine if safety trip points have been modified
- Verify the operational status of emergency shutdown systems
- Check for unauthorized changes to SIL-rated components
- Assess whether safety functions could be suppressed

### Hints and Tips

💡 **Network Segmentation**: Look for the Industrial DMZ (IDMZ) - it's the bridge between IT and OT. This is a critical chokepoint for attacks.

💡 **Engineering Workstations**: These often have access to both IT and OT networks and are prime targets for pivoting.

💡 **Protocol Analysis**: ICS protocols like Modbus lack authentication. Look for unexpected commands or connections.

💡 **Safety Independence**: The SIS should be separate from the DCS/SCADA. Check if this independence has been maintained.

💡 **Timing is Critical**: In energy systems, even small changes to timing parameters can cause instability or prevent protective functions.

💡 **Physical Access**: Don't overlook physical security. Attackers might have used physical access to bypass network controls.

### Common Challenges

- **Understanding ICS Architecture**: The information pack contains network diagrams showing IT, OT, and SIS zones
- **Interpreting SCADA Data**: Focus on configuration changes rather than trying to understand all operational data
- **Finding Evidence of Pivoting**: Look for unusual remote access sessions or file transfers between IT and OT systems
- **Distinguishing Normal from Malicious**: Industrial systems have scheduled updates and maintenance - check timing and authorization

## Assessment Exercise

> **Note**: The following assessment component will be developed in a future update. This is a placeholder for post-scenario synthesis activities.

### Reflection Questions

After completing the scenario, you should be able to answer:

1. **Attack Vector**: How did the attackers initially compromise the corporate network, and what path did they use to reach OT systems?
2. **Segmentation Failures**: What network segmentation controls failed or were bypassed?
3. **Safety Impact Assessment**: Was the Safety Instrumented System compromised? What specific evidence did you find?
4. **Grid Stability Risk**: Based on your findings, what risk does this attack pose to grid operations and public safety?

### Technical Analysis

[PLACEHOLDER: Detailed technical questions about ICS protocols, PLC configurations, and specific attack techniques discovered]

### Design Critique

[PLACEHOLDER: Questions about improvements to network architecture, monitoring, and incident response capabilities]

### Incident Response Plan

[PLACEHOLDER: Exercise developing an OT-specific incident response plan based on lessons learned from the scenario]

### Regulatory Reporting

[PLACEHOLDER: Questions about NERC CIP compliance and regulatory notification requirements]

---

## Additional Resources

- Review the **Information Pack** (`information_pack.md`) for detailed system architecture and ICS protocol information
- Consult the **Dungeon Graph** for scenario structure (if available)
- Refer to IEC 62443 series for industrial automation security standards
- Review NERC CIP standards for grid cybersecurity requirements
- Study the Purdue Model for ICS network segmentation

## Getting Help

If you're stuck:
1. Review the information pack sections on network architecture - understanding the zones is critical
2. Talk to all NPCs - control room operators and IT staff have different perspectives
3. Check system logs chronologically - follow the attack timeline
4. Remember the learning objectives - focus on IT/OT pivoting and safety system integrity

---

**Remember**: Energy grid operations are 24/7 critical infrastructure. Real incidents must be investigated carefully without disrupting operations or compromising safety. Take your time to understand how an attacker could threaten both the confidentiality of business systems and the safety of physical infrastructure.
