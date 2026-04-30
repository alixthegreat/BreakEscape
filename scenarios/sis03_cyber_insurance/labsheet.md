# Lab Sheet: SIS03 Cyber Insurance - Meridian Insurance Breach Investigation

## Learning Objectives

By completing this scenario, you will:

1. **Understand Insurance Industry Security Requirements**: Explore the unique security and privacy requirements for cyber insurance providers
2. **Apply Incident Response in Financial Services**: Practice incident investigation in a highly regulated financial sector environment
3. **Analyze Trust and Assurance Chains**: Understand how a breach at an insurance company can cascade to policyholders
4. **Evaluate Third-Party Risk**: Assess the security implications of interconnected business relationships
5. **Apply Regulatory Frameworks**: Understand compliance requirements from GDPR, PCI DSS, SOC 2, and financial services regulations

## Scenario Context

You are investigating a cyberattack against Meridian Cyber Insurance, a company that provides cyber insurance policies to businesses including critical infrastructure operators. The breach has exposed sensitive policyholder information and raised concerns about whether attackers could exploit this information to target insured organizations - including Albion Energy (from SIS02).

**Your Mission**: Investigate the breach, determine what policyholder data was accessed, assess the potential for downstream attacks against insured parties, and evaluate whether regulatory notification requirements have been triggered.

### Key Concepts

**Cyber Insurance as Critical Infrastructure**: Insurance enables risk management across the economy:
- Cyber insurance policies cover incident response, business interruption, and liability
- Insurers hold sensitive data about policyholders' security controls and vulnerabilities
- A breach can expose information useful for targeting insured organizations
- Insurance industry stability affects broader economic resilience

**The Assurance Chain**: Security dependencies across organizations:
- Policyholders trust insurers to protect their sensitive security assessments
- Risk assessment data reveals security weaknesses and coverage limits
- Claims data shows what incidents have occurred and how they were handled
- Third-party service providers (TPSPs) access policyholder information

**Data Protection in Financial Services**:
- GDPR requirements for personal data of EU policyholders
- PCI DSS compliance for payment card processing
- Financial services regulations (varies by jurisdiction)
- SOC 2 Type II requirements for service providers
- Breach notification timelines and requirements

**Cascading Risk**: How breaches propagate:
- Direct impact: Stolen data, system disruption, regulatory fines
- Indirect impact: Information used to attack policyholders
- Reputational damage: Loss of trust from insured parties
- Systemic risk: Multiple claims from related incidents

## Gameplay Instructions

### Getting Started

1. **Read the Information Pack**: Before starting the scenario, review the `information_pack.md` file in this directory. Pay attention to:
   - Meridian's system architecture and data flows
   - Types of policyholder data stored
   - Third-party integrations and service providers
   - Connection to Albion Energy (SIS02 scenario)

2. **Launch the Scenario**: Load SIS03 Cyber Insurance from the scenario selection screen

3. **Initial Orientation**: You'll start at Meridian Insurance offices. Explore the corporate environment and IT infrastructure

### Investigation Strategy

**Phase 1: Breach Scope Determination**
- Interview IT security and claims management staff
- Identify compromised systems and timeframe of unauthorized access
- Determine what types of data were stored on affected systems
- Check if payment systems or personally identifiable information (PII) were exposed

**Phase 2: Data Exposure Analysis**
- Examine database logs to identify what records were accessed
- Determine if policyholder security assessment data was stolen
- Check for access to claims history and incident response playbooks
- Identify if specific high-value policyholders (like critical infrastructure) were targeted

**Phase 3: Attack Attribution and Methods**
- Investigate how the attackers gained initial access
- Trace lateral movement within the corporate network
- Identify persistence mechanisms and data exfiltration methods
- Look for indicators suggesting the attack was targeted vs. opportunistic

**Phase 4: Downstream Risk Assessment**
- Analyze which policyholders' information was exposed
- Evaluate what information could be used to attack those organizations
- Assess the risk to specific sectors (energy, healthcare, manufacturing)
- Determine if there's evidence of coordination with other attacks

### Hints and Tips

💡 **Follow the Data**: Focus on systems that store risk assessments, policy terms, and coverage limits - this is the most valuable intelligence for attackers.

💡 **Third-Party Access**: Check logs for third-party service provider access. TPSPs often have privileged access to sensitive data.

💡 **Timeline Correlation**: If you've played SIS02 (Albion Energy), compare timelines. Was Meridian breached before the Albion attack?

💡 **Regulatory Clocks**: Breach notification deadlines start when you confirm data exposure, not when you discover the incident. Document carefully.

💡 **Claims Database**: The claims management system contains valuable information about past incidents at policyholder organizations.

💡 **Network Segmentation**: Payment processing systems should be isolated (PCI DSS requirement). Check if segmentation was maintained.

### Common Challenges

- **Understanding Insurance Data Flows**: The information pack describes what data flows between departments and external parties
- **Distinguishing Authorized Access**: Insurance staff legitimately access policyholder data daily - look for unusual patterns
- **Regulatory Complexity**: Multiple regulations apply (GDPR, PCI, financial services) - the information pack summarizes key requirements
- **Assessing Downstream Impact**: Think like an attacker - what information would help you target a specific company?

## Assessment Exercise

> **Note**: The following assessment component will be developed in a future update. This is a placeholder for post-scenario synthesis activities.

### Reflection Questions

After completing the scenario, you should be able to answer:

1. **Breach Timeline**: When did the initial compromise occur, and how long did attackers have access before detection?
2. **Data Exposure**: What categories of policyholder data were accessed or exfiltrated?
3. **Regulatory Obligations**: What breach notification requirements apply, and what are the deadlines?
4. **Cascading Risk**: Could information stolen from Meridian be used to attack policyholders? What evidence supports your assessment?

### Technical Analysis

[PLACEHOLDER: Detailed technical questions about access controls, data protection mechanisms, and attack techniques]

### Cross-Scenario Analysis

[PLACEHOLDER: Questions connecting SIS03 findings with SIS02 (Albion Energy) - was there coordination between attacks?]

### Regulatory Response Exercise

[PLACEHOLDER: Practice developing breach notifications for different regulatory frameworks (GDPR, state breach laws, financial services)]

### Risk Assessment

[PLACEHOLDER: Exercise evaluating how this breach affects the cyber insurance industry's role in critical infrastructure resilience]

### Business Continuity

[PLACEHOLDER: Questions about how Meridian can continue operations while addressing policyholder concerns and regulatory requirements]

---

## Additional Resources

- Review the **Information Pack** (`information_pack.md`) for detailed system architecture and regulatory requirements
- Consult the **Dungeon Graph** for scenario structure (if available)
- Refer to GDPR Articles 33-34 for breach notification requirements
- Review PCI DSS requirements for payment card data protection
- Study SOC 2 Trust Services Criteria for service organization controls
- If you've completed SIS02, review your notes about the Albion Energy attack for potential connections

## Getting Help

If you're stuck:
1. Review the information pack sections on system architecture and data flows
2. Talk to different departments (IT, Claims, Risk Assessment) - they have different perspectives on data and systems
3. Check access logs for both internal users and third-party service providers
4. Consider the business context - what data would be most valuable to attackers?

---

**Remember**: Insurance companies are trusted custodians of sensitive risk information. A breach at an insurer doesn't just affect the company - it can have cascading effects across all policyholders. This scenario explores the interconnected nature of cyber risk and the importance of third-party security in critical infrastructure protection.

## Cross-Scenario Connection

If you've completed **SIS02 Energy (Albion Energy)**, consider:
- Albion Energy is a Meridian policyholder
- Could information from this breach have been used in the Albion attack?
- What risk assessment data about Albion's security controls might have been exposed?
- Does the timeline suggest coordination between the incidents?

This connection demonstrates how breaches in one sector can create vulnerabilities in seemingly unrelated critical infrastructure.
