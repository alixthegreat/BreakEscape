import { MinigameScene } from '../framework/base-minigame.js';

// ── Tab definitions ───────────────────────────────────────────────────────────
// id: key used in _tabsSeen and _renderTabContent dispatch
// label: button text
// The SIS Engineering Log tab ('sis_log') must be visited before Confirm is enabled.

const TABS = [
    { id: 'timeline',    label: 'ATTACK TIMELINE' },
    { id: 'jump_log',    label: 'JUMP SERVER LOG' },
    { id: 'historian',   label: 'HISTORIAN DATA' },
    { id: 'sis_log',     label: 'SIS ENGINEERING LOG' },
    { id: 'dc_implant',  label: 'DOMAIN IMPLANT' },
    { id: 'soc_coverage',label: 'SOC COVERAGE REPORT' },
];

export class ForensicDataPlatformMinigame extends MinigameScene {
    constructor(container, params = {}) {
        super(container, {
            ...params,
            title:      'Forensic Data Platform',
            showCancel: true,
            cancelText: 'Close Terminal'
        });
        this._tabsSeen  = new Set();
        this._confirmed = false;
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────

    init() {
        super.init();
        if (this.headerElement) this.headerElement.style.display = 'none';
        this.container.classList.add('fdp-minigame-container');
        this.gameContainer.classList.add('fdp-game-container');
        this._renderLayout();
    }

    start() {
        super.start();
        if (!window.gameState?.globalVariables?.fdp_reviewed) {
            this._setGlobalAndNotify('fdp_reviewed', true);
        }
        // Open first tab
        this._onTabClick('timeline');
    }

    // ── Layout ───────────────────────────────────────────────────────────────

    _renderLayout() {
        const tabButtons = TABS.map(t =>
            `<button class="fdp-tab" data-tab="${t.id}">${t.label}</button>`
        ).join('');

        this.gameContainer.innerHTML = `
<div class="fdp-wrap">
  <div class="fdp-header">
    <span class="fdp-title">Meridian Cyber Insurance &mdash; Forensic Data Platform</span>
    <span class="fdp-case">MC-2023-ALBE-007 &mdash; Albion Energy Storage Ltd</span>
  </div>
  <div class="fdp-tab-bar" id="fdp-tab-bar">
    ${tabButtons}
  </div>
  <div class="fdp-panel" id="fdp-panel"></div>
  <div class="fdp-footer">
    <button class="fdp-confirm-btn" id="fdp-confirm-btn" disabled>
      CONFIRM CAUSAL CHAIN &mdash; Cyber Event &rarr; Physical Damage
    </button>
    <div id="fdp-confirm-hint" class="fdp-confirm-hint">
      Review the SIS Engineering Log before confirming.
    </div>
  </div>
</div>`;

        // Attach tab listeners
        this.gameContainer.querySelectorAll('.fdp-tab').forEach(btn => {
            this.addEventListener(btn, 'click', () => this._onTabClick(btn.dataset.tab));
        });

        // Attach confirm listener
        const confirmBtn = this.gameContainer.querySelector('#fdp-confirm-btn');
        this.addEventListener(confirmBtn, 'click', () => this._onConfirm());
    }

    // ── Tab interaction ───────────────────────────────────────────────────────

    _onTabClick(tabId) {
        // Update active/seen tab classes
        this.gameContainer.querySelectorAll('.fdp-tab').forEach(btn => {
            const isActive = btn.dataset.tab === tabId;
            btn.classList.toggle('fdp-tab-active', isActive);
            if (this._tabsSeen.has(btn.dataset.tab) && !isActive) {
                btn.classList.add('fdp-tab-seen');
            }
        });

        this._tabsSeen.add(tabId);

        // Mark the newly active tab as seen too
        const activeBtn = this.gameContainer.querySelector(`[data-tab="${tabId}"]`);
        if (activeBtn) activeBtn.classList.add('fdp-tab-seen');

        this._renderTabContent(tabId);
        this._updateConfirmButton();
    }

    _updateConfirmButton() {
        if (this._confirmed) return;
        const btn  = this.gameContainer.querySelector('#fdp-confirm-btn');
        const hint = this.gameContainer.querySelector('#fdp-confirm-hint');
        if (!btn || !hint) return;

        if (this._tabsSeen.has('sis_log')) {
            btn.disabled  = false;
            hint.textContent = 'All critical evidence reviewed. Confirm the causal chain.';
        } else {
            btn.disabled  = true;
            hint.textContent = 'Review the SIS Engineering Log before confirming.';
        }
    }

    _onConfirm() {
        if (this._confirmed) return;
        this._confirmed = true;

        const btn  = this.gameContainer.querySelector('#fdp-confirm-btn');
        const hint = this.gameContainer.querySelector('#fdp-confirm-hint');
        if (btn)  { btn.disabled = true; btn.textContent = 'CAUSAL CHAIN CONFIRMED'; }
        if (hint) {
            hint.className   = 'fdp-confirm-success';
            hint.textContent = '\u2713 Causal chain confirmed and logged. Eleanor Vance has been notified.';
        }

        this._setGlobalAndNotify('forensic_chain_verified', true);
    }

    // ── Tab content ───────────────────────────────────────────────────────────

    _renderTabContent(tabId) {
        const panel = this.gameContainer.querySelector('#fdp-panel');
        if (!panel) return;

        switch (tabId) {
            case 'timeline':    panel.innerHTML = this._contentTimeline();    break;
            case 'jump_log':    panel.innerHTML = this._contentJumpLog();     break;
            case 'historian':   panel.innerHTML = this._contentHistorian();   break;
            case 'sis_log':     panel.innerHTML = this._contentSisLog();      break;
            case 'dc_implant':  panel.innerHTML = this._contentDcImplant();   break;
            case 'soc_coverage':panel.innerHTML = this._contentSocCoverage(); break;
            default:            panel.innerHTML = '';
        }
    }

    _contentTimeline() {
        const steps = [
            {
                label: 'Weeks 1\u20134 &mdash; Initial Access (Ferryman IAB)',
                desc:  'Multi-function printer firmware supply-chain compromise. Periodic HTTPS beaconing to C2 infrastructure confirmed via firewall logs. Ferryman Collective assessed as financially motivated initial access broker.'
            },
            {
                label: 'Weeks 5\u20136 &mdash; Handoff to GREYMANTLE APT',
                desc:  'Dormant contractor account <strong>c.ellison</strong> activated via RDP from 185.220.101.47 (Romania). Account not deprovisioned 14 months post-departure. Session terminates at HMI-ENG-02 engineering workstation.'
            },
            {
                label: 'T\u22127 days &mdash; Domain Persistence',
                desc:  'Service DLL implant on Domain Controller. DNS-over-HTTPS C2 communications. Active Directory lateral movement credentials created for SCADA zone access.'
            },
            {
                label: 'T\u22122 days, 23:12 &mdash; Sensor Data Falsification',
                desc:  'Historian records show Rack A1\u2013A4 temperature readings replaced with flat 28.0\u00b0C values (actual: elevated). Flat-line begins simultaneously across all four racks \u2014 impossible in natural operation.'
            },
            {
                label: 'T\u22121 day, 03:22 &mdash; SIS Setpoint Manipulation',
                desc:  'SIS engineering port accessed via HMI-ENG-02. Thermal runaway threshold raised: 55\u00b0C \u2192 85\u00b0C. H\u2082 alarm threshold raised: 1.0% \u2192 3.8% LEL. Voltage trip setpoint modified. Automated safety barriers silently disabled.'
            },
            {
                label: 'T+0, 06:28 &mdash; Anomaly Detected',
                desc:  'On-site engineer identifies thermometer discrepancy: analog reads 51\u00b0C; SCADA reports 28\u00b0C. Emergency Shutdown (ESD) activated. Racks A1\u2013A4 isolated. Facility evacuated.'
            },
            {
                label: '\u26a0 Evidence Gap',
                desc:  'PLC-BMS holding registers containing falsified sensor values were overwritten by the ESD shutdown sequence. SIS engineering protocol did not log modification commands. Causal link established by reconstruction, not direct log evidence.'
            },
        ];

        const rows = steps.map((s, i) => `
<li class="fdp-timeline-step">
  <div class="fdp-timeline-num${i < 6 ? '' : ' fdp-timeline-num-warn'}">${i < 6 ? i + 1 : '!'}</div>
  <div class="fdp-timeline-body">
    <div class="fdp-timeline-label">${s.label}</div>
    <div class="fdp-timeline-desc">${s.desc}</div>
  </div>
</li>`).join('');

        return `
<h3>Attack Timeline &mdash; Albion Energy Storage Incident</h3>
<ul class="fdp-timeline">${rows}</ul>
<div class="fdp-evidence-gap">
  <div class="fdp-evidence-gap-title">\u26a0 Critical Evidence Gap &mdash; See SIS Engineering Log Tab</div>
  <p>The safety action that prevented thermal runaway (pressing ESD) is also the action that destroyed key forensic evidence. Safety restoration and evidence preservation were in direct conflict. See Policy Section 7.1 (Cooperation Clause) and CLAIM-INS-006.</p>
</div>`;
    }

    _contentJumpLog() {
        return `
<h3>Jump Server Access Log &mdash; JS-ALBION-01</h3>
<p>Session log recovered intact from jump server. Marcus Webb reviewed this remotely during the incident response.</p>
<table class="fdp-log-table">
  <thead>
    <tr>
      <th>Timestamp</th>
      <th>User</th>
      <th>Source IP</th>
      <th>Duration</th>
      <th>Activity</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Mar 14, 08:22</td>
      <td>m.harris</td>
      <td>10.1.0.45 (internal)</td>
      <td>1h 12m</td>
      <td>Routine engineering access</td>
    </tr>
    <tr>
      <td>Mar 15, 14:05</td>
      <td>j.patel</td>
      <td>10.1.0.23 (internal)</td>
      <td>0h 47m</td>
      <td>Historian configuration review</td>
    </tr>
    <tr>
      <td>Mar 16, 22:31</td>
      <td>m.harris</td>
      <td>10.1.0.45 (internal)</td>
      <td>0h 28m</td>
      <td>Out-of-hours check \u2014 normal</td>
    </tr>
    <tr class="fdp-row-highlight">
      <td>Mar 17, 01:47</td>
      <td><strong>c.ellison</strong></td>
      <td><strong>185.220.101.47</strong> (Tor exit node \u2014 Romania)</td>
      <td><strong>4h 41m+ (active)</strong></td>
      <td>RDP to HMI-ENG-02; lateral movement commands; SIS engineering port access at 03:22</td>
    </tr>
  </tbody>
</table>
<div class="fdp-compliance-note">
  <strong>WARRANTY W-09 STATUS: BREACHED</strong><br>
  Account c.ellison: contract terminated 14 months prior to this session. Account was not deprovisioned. Default credentials retained. This dormant account was the primary attack pivot point into the OT environment.
</div>`;
    }

    _contentHistorian() {
        const globals   = window.gameState?.globalVariables || {};
        const case2seen = !!globals.historian_flatline_found;

        const crossCase = case2seen ? `
<div class="fdp-session-record">
  <div class="fdp-session-record-title">\u26a1 SIS02 Session Record \u2014 Case 2 Continuity</div>
  <p>Historian flat-line anomaly confirmed by Case 2 investigation team. On-site review of Rack A1\u2013A4 historian trend data at 23:12 timestamp independently verified by player team in the Albion Energy scenario.</p>
</div>` : '';

        return `
<h3>Historian Data Integrity Report</h3>
<p>The SCADA process historian faithfully recorded the falsified sensor values that were injected into the BMS PLC. The falsification is detectable via statistical analysis of variance.</p>
<table class="fdp-log-table">
  <thead>
    <tr>
      <th>Rack</th>
      <th>Reading at 23:11</th>
      <th>Reading at 23:13</th>
      <th>Pre-23:12 Variance</th>
      <th>Post-23:12 Variance</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>A1</td>
      <td>31.4\u00b0C</td>
      <td>28.0\u00b0C (flat)</td>
      <td class="fdp-row-highlight" style="">&#177;2.1\u00b0C</td>
      <td><strong style="color:#f85149">0.00\u00b0C</strong></td>
    </tr>
    <tr>
      <td>A2</td>
      <td>30.8\u00b0C</td>
      <td>28.0\u00b0C (flat)</td>
      <td>&#177;1.9\u00b0C</td>
      <td><strong style="color:#f85149">0.00\u00b0C</strong></td>
    </tr>
    <tr>
      <td>A3</td>
      <td>31.1\u00b0C</td>
      <td>28.0\u00b0C (flat)</td>
      <td>&#177;2.3\u00b0C</td>
      <td><strong style="color:#f85149">0.00\u00b0C</strong></td>
    </tr>
    <tr>
      <td>A4</td>
      <td>30.9\u00b0C</td>
      <td>28.0\u00b0C (flat)</td>
      <td>&#177;2.0\u00b0C</td>
      <td><strong style="color:#f85149">0.00\u00b0C</strong></td>
    </tr>
  </tbody>
</table>
<div class="fdp-evidence-gap">
  <div class="fdp-evidence-gap-title">\u26a0 Forensic Finding</div>
  <p>Flat-line at exactly 28.0\u00b0C across all four racks simultaneously from 23:12. Zero variance across four independent thermal sensors is physically impossible under any normal operating condition. Confirms sensor data injection. The historian recorded the falsified values \u2014 it cannot distinguish falsified from real data.</p>
</div>
${crossCase}`;
    }

    _contentSisLog() {
        const globals   = window.gameState?.globalVariables || {};
        const case2seen = !!globals.sis_tamper_confirmed;

        const crossCase = case2seen ? `
<div class="fdp-session-record">
  <div class="fdp-session-record-title">\u26a1 SIS02 Session Record \u2014 Case 2 Continuity</div>
  <p>SIS setpoint tampering confirmed by Case 2 investigation team. THERMAL_RUNAWAY_THRESHOLD modification verified via SIS configuration panel in the Albion Energy scenario. Players independently identified the tampered values against the IEC 61511 certified baseline.</p>
</div>` : '';

        return `
<h3>SIS Engineering Log &mdash; Post-Incident Physical Inspection</h3>
<p>The SIS safety PLC was physically inspected after the incident. No engineering log exists \u2014 the SIS protocol does not record modification commands.</p>
<table class="fdp-setpoint-table">
  <tbody>
    <tr>
      <td>THERMAL_RUNAWAY_THRESHOLD</td>
      <td>55\u00b0C \u2192 <strong>85\u00b0C</strong> [MODIFIED]</td>
    </tr>
    <tr>
      <td>H\u2082_ALARM_THRESHOLD</td>
      <td>1.0% LEL \u2192 <strong>3.8% LEL</strong> [MODIFIED]</td>
    </tr>
    <tr>
      <td>VOLTAGE_TRIP_SETPOINT</td>
      <td><strong>Modified</strong> [value reset by ESD]</td>
    </tr>
    <tr>
      <td>Firmware version</td>
      <td><strong>2.4.1</strong> (patch available 18 months \u2014 not applied)</td>
    </tr>
  </tbody>
</table>
<div class="fdp-evidence-gap">
  <div class="fdp-evidence-gap-title">\u26a0 Critical Evidence Gap \u2014 No Modification Log</div>
  <p>The SIS engineering protocol does not log modification commands. There is no forensic record of when the setpoints were changed, from which network address the commands originated, or which user authenticated to the engineering port. The causal link to the c.ellison RDP session is established by circumstantial reconstruction: session active 01:47\u201306:09; setpoint modification discovered during post-incident inspection at 03:22 timestamp \u2014 inferred, not logged.</p>
  <p style="margin-top:6px">This gap also complicates the cooperation clause assessment (Policy Section 7.1): Albion could not have preserved what the SIS never recorded.</p>
</div>
${crossCase}`;
    }

    _contentDcImplant() {
        const steps = [
            {
                label: 'Step 1 \u2014 Printer Firmware Compromise',
                desc:  'Ferryman Collective supply-chain technique. Malicious firmware pushed to shared multi-function printer. Provides persistent foothold on corporate VLAN without triggering EDR.'
            },
            {
                label: 'Step 2 \u2014 C2 Beacon Establishment',
                desc:  'HTTPS beaconing to attacker C2 infrastructure. Confirmed via firewall egress logs \u2014 periodic small HTTPS requests to domains registered within prior 30 days. Technique: DNS-over-HTTPS for C2 channel (bypasses DNS-layer monitoring).'
            },
            {
                label: 'Step 3 \u2014 Domain Admin Credential Harvest',
                desc:  'Lateral movement from printer VLAN to corporate VLAN. DCSync technique used against Domain Controller to extract NTLM hashes for privileged accounts. Enterprise IT credentials fully compromised.'
            },
            {
                label: 'Step 4 \u2014 Domain Controller Service DLL Implant',
                desc:  'Persistence implant: malicious service DLL loaded on Domain Controller. Survives reboots. Provides reliable re-entry even if C2 beacon is disrupted. Specific DLL matches known GREYMANTLE tooling (NCSC attribution basis).'
            },
            {
                label: 'Step 5 \u2014 Jump Server Pivot via Dormant Account',
                desc:  'Dormant contractor RDP credentials (c.ellison) used to authenticate to jump server from Tor exit node. Bidirectional RDP configuration enables forward pivot to HMI-ENG-02 on the SCADA network. CastleTech SOC contract explicitly excluded jump server session log monitoring \u2014 blind spot.'
            },
        ];

        const rows = steps.map((s, i) => `
<li class="fdp-timeline-step">
  <div class="fdp-timeline-num">${i + 1}</div>
  <div class="fdp-timeline-body">
    <div class="fdp-timeline-label">${s.label}</div>
    <div class="fdp-timeline-desc">${s.desc}</div>
  </div>
</li>`).join('');

        return `
<h3>Domain Controller Implant Chain</h3>
<p>Progressive privilege escalation from initial printer access to full SCADA network reach. Five distinct stages across the Albion enterprise IT environment.</p>
<ul class="fdp-timeline">${rows}</ul>
<div class="fdp-compliance-note">
  <strong>CLAIM-INS-001 (IT/OT Boundary):</strong> The jump server bidirectional RDP configuration and dual-homed historian provided two independent IT-to-OT pivot paths. Both were known deficiencies at policy inception. Both remained unremediated at incident date.
</div>`;
    }

    _contentSocCoverage() {
        return `
<h3>CastleTech SOC Coverage Report</h3>
<p>Excerpt from CastleTech Solutions engagement scope documentation, as held in Albion's vendor management records and confirmed by CastleTech account manager during forensic interview.</p>
<div class="fdp-doc-excerpt">
  &ldquo;CastleTech Solutions SOC Engagement &mdash; Scope Clarification (January 2024): Monitoring scope is limited to enterprise IT systems on the corporate VLAN, including email, ERP, endpoint devices, and corporate firewall. <strong>Operational technology systems, including the SCADA network, ICS field devices, the jump server session logs, engineering workstations, and historian server OT interface, fall outside the scope of this engagement.</strong> Any monitoring of OT environments would require a separate SOC-OT service agreement and additional on-site sensor deployment. CastleTech does not currently offer this service to Albion.&rdquo;
  <div class="fdp-doc-source">Source: CastleTech Scope Clarification Letter, January 2024 &mdash; ref CCL-ALBE-2024-01</div>
</div>
<p>This exclusion means CastleTech had no visibility of:</p>
<ul style="margin:6px 0 10px 18px; font-size:11px; color:#c9d1d9; line-height:1.7">
  <li>The c.ellison RDP session on the jump server</li>
  <li>Lateral movement commands on HMI-ENG-02</li>
  <li>The historian sensor data falsification at 23:12</li>
  <li>SIS engineering port access at 03:22</li>
</ul>
<div class="fdp-compliance-note">
  <strong>WARRANTY W-12 STATUS: BREACHED</strong><br>
  Albion's MSP (CastleTech) explicitly excluded OT systems from monitoring scope. Warranty W-12 required managed service providers to maintain equivalent security coverage across the insured environment. The OT exclusion created the monitoring blind spot that allowed the attack to progress undetected for weeks.
</div>
<div class="fdp-compliance-note" style="margin-top:10px">
  <strong>WARRANTY W-09 (Access Control) \u2014 supporting evidence:</strong><br>
  The CastleTech SOC monitored Active Directory but did not flag the c.ellison account as anomalous because it was outside OT scope. The IT-side AD logs show the account was enabled \u2014 deprovisioning failure is an Albion IT governance failure, not a CastleTech failure, but the SOC monitoring gap meant no compensating detection existed.
</div>`;
    }

    // ── Global state ──────────────────────────────────────────────────────────

    _setGlobalAndNotify(name, value) {
        if (window.npcManager?.setGlobalVariable) {
            window.npcManager.setGlobalVariable(name, value);
            return;
        }
        const oldValue = window.gameState?.globalVariables?.[name];
        if (window.gameState?.globalVariables) {
            window.gameState.globalVariables[name] = value;
        }
        window.npcConversationStateManager?.broadcastGlobalVariableChange(name, value, null);
        window.eventDispatcher?.emit(`global_variable_changed:${name}`, { name, value, oldValue });
    }

    cleanup() {
        super.cleanup();
    }
}
