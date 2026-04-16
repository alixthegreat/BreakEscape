import { MinigameScene } from '../framework/base-minigame.js';

export class NcscBriefMinigame extends MinigameScene {
    constructor(container, params = {}) {
        super(container, {
            ...params,
            title:      'NCSC Attribution Brief',
            showCancel: true,
            cancelText: 'Close'
        });
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────

    init() {
        super.init();
        if (this.headerElement) this.headerElement.style.display = 'none';
        this.container.classList.add('ncsc-minigame-container');
        this.gameContainer.classList.add('ncsc-game-container');
        this._renderLayout();
    }

    start() {
        super.start();
        const globals = window.gameState?.globalVariables || {};

        if (globals.ncsc_brief_reviewed) {
            this._renderContent();
        } else if (globals.warranty_checklist_complete) {
            this._renderOpenable();
        } else {
            this._renderSealed();
        }
    }

    // ── Outer shell ──────────────────────────────────────────────────────────

    _renderLayout() {
        this.gameContainer.innerHTML = `
<div class="ncsc-wrap">
  <div class="ncsc-tlp-bar">TLP:AMBER &mdash; PRIVILEGED AND CONFIDENTIAL &mdash; ADDRESSEE ONLY</div>
  <div class="ncsc-body" id="ncsc-body"></div>
</div>`;
    }

    _body() {
        return this.gameContainer.querySelector('#ncsc-body');
    }

    // ── Sealed state ─────────────────────────────────────────────────────────

    _renderSealed() {
        const el = this._body();
        if (!el) return;
        el.innerHTML = `
<div class="ncsc-envelope-panel">
  <div class="ncsc-envelope-icon">&#9993;</div>
  <div class="ncsc-envelope-name">NCSC Attribution Brief</div>
  <div class="ncsc-envelope-ref">MC-2023-ALBE-007 &mdash; Albion Energy Storage Ltd</div>
  <div class="ncsc-status-badge ncsc-status-locked">&#128274; SEALED &mdash; AUTHORISATION REQUIRED</div>
  <div class="ncsc-sealed-message">
    Warranty compliance assessment must be completed before this brief can be opened.
    Complete the warranty checklist and return to Eleanor Vance before accessing this document.
  </div>
</div>`;
    }

    // ── Openable state ───────────────────────────────────────────────────────

    _renderOpenable() {
        const el = this._body();
        if (!el) return;
        el.innerHTML = `
<div class="ncsc-envelope-panel">
  <div class="ncsc-envelope-icon">&#9993;</div>
  <div class="ncsc-envelope-name">NCSC Attribution Brief</div>
  <div class="ncsc-envelope-ref">MC-2023-ALBE-007 &mdash; Albion Energy Storage Ltd</div>
  <div class="ncsc-status-badge ncsc-status-ready">&#10003; AUTHORISED &mdash; WARRANTY ASSESSMENT COMPLETE</div>
  <div class="ncsc-sealed-message ncsc-ready-message">
    Warranty compliance assessment recorded. You are authorised to open this brief.
  </div>
  <button class="ncsc-open-btn" id="ncsc-open-btn">BREAK SEAL &mdash; OPEN BRIEF</button>
</div>`;

        const btn = this.gameContainer.querySelector('#ncsc-open-btn');
        if (btn) this.addEventListener(btn, 'click', () => this._onOpen());
    }

    // ── Open action ──────────────────────────────────────────────────────────

    _onOpen() {
        this._setGlobalAndNotify('ncsc_brief_reviewed', true);
        this._renderContent();
    }

    // ── Full brief content ───────────────────────────────────────────────────

    _renderContent() {
        const el = this._body();
        if (!el) return;
        el.innerHTML = `
<div class="ncsc-brief-content">

  <div class="ncsc-brief-header">
    <div class="ncsc-brief-title">NCSC Technical Attribution Assessment</div>
    <div class="ncsc-brief-meta">
      Ref: NCSC-TAA-2025-ALBE-001 &mdash; Addressee: Eleanor Vance, Meridian Cyber Insurance<br>
      Date: March 2025 &mdash; Classification: TLP:AMBER
    </div>
  </div>

  <div class="ncsc-section">
    <div class="ncsc-section-title">Section 1 &mdash; GREYMANTLE APT (Post-Exploitation Phase)</div>
    <p>Attribution confidence: <span class="ncsc-badge ncsc-badge-amber">MODERATE TO HIGH &mdash; 70&ndash;80%</span></p>
    <p>GREYMANTLE is assessed as a Russian-speaking threat actor group with documented capability and intent to target critical infrastructure in NATO member states, with particular focus on the energy sector.</p>
    <p><strong>Basis for attribution:</strong></p>
    <ul class="ncsc-list">
      <li>Custom implant tooling matches indicators from 3 prior GREYMANTLE-attributed campaigns (2022&ndash;2024)</li>
      <li>DNS-over-HTTPS C2 infrastructure overlaps with confirmed GREYMANTLE campaigns active 2023&ndash;2025</li>
      <li>ICS-specific targeting capability (SIS engineering interface access, setpoint manipulation) is consistent with GREYMANTLE operational profile and exceeds typical criminal threat actor capability</li>
      <li>Targeting pattern consistent with state-aligned objectives: energy storage, grid-connected facility, NATO country</li>
    </ul>
  </div>

  <div class="ncsc-section">
    <div class="ncsc-section-title">Section 2 &mdash; FERRYMAN COLLECTIVE (Initial Access Broker)</div>
    <p>Attribution confidence: <span class="ncsc-badge ncsc-badge-green">HIGH &mdash; 85%+</span></p>
    <p>Ferryman Collective is a financially motivated initial access broker (IAB) with no assessed state affiliation. They specialise in supply-chain compromise techniques targeting enterprise environments for resale of access.</p>
    <p><strong>Basis for attribution:</strong></p>
    <ul class="ncsc-list">
      <li>Printer firmware exploitation technique matches Ferryman&rsquo;s established modus operandi across 11 confirmed incidents</li>
      <li>Social engineering tradecraft consistent with Ferryman campaign documentation held by Five Eyes partners</li>
      <li>Ferryman has documented history of selling enterprise IT access to state-sponsored buyers, including prior sales attributed to GREYMANTLE-linked buyers</li>
    </ul>
  </div>

  <div class="ncsc-section">
    <div class="ncsc-section-title">Section 3 &mdash; Two-Actor Model (IAB-to-APT Handoff)</div>
    <p>Initial access (Ferryman, Weeks 1&ndash;4) and post-exploitation ICS attack (GREYMANTLE, Weeks 5&ndash;8) are assessed as distinct actors operating sequentially. This is the IAB-to-APT handoff model: a financially motivated broker obtains and sells access; a state-sponsored actor conducts the mission.</p>
    <div class="ncsc-note">
      <div class="ncsc-note-title">Coverage Assessment Note</div>
      <p>For your act-of-war determination, the two-actor model creates a legal question: does commercially motivated initial access followed by state-sponsored exploitation constitute a single &ldquo;act of war,&rdquo; or two legally distinct events with different characterisation? NCSC assesses this question is unresolved in English law and does not form a basis for a confident act-of-war determination.</p>
    </div>
  </div>

  <div class="ncsc-legal-gap">
    <div class="ncsc-legal-gap-title">&#9888; Section 4 &mdash; Legal Threshold Assessment</div>
    <p>Attribution at intelligence confidence does <strong>not</strong> equate to proof of &ldquo;act of war&rdquo; under English law.</p>
    <p>The legal threshold for invoking an act-of-war exclusion requires a formal government declaration or judicial finding of state responsibility &mdash; a substantially higher standard than the intelligence community&rsquo;s attribution assessment. Current GREYMANTLE attribution at 70&ndash;80% confidence does <strong>not</strong> reach this threshold.</p>
    <p>NCSC <strong>recommends against invoking the act-of-war exclusion</strong> on the basis of this brief alone. Doing so would expose Meridian to legal challenge and would set an industry precedent that undermines policyholder confidence in cyber insurance coverage for sophisticated attacks.</p>
  </div>

  <div class="ncsc-coverage-note">
    <div class="ncsc-coverage-note-title">&#9889; Section 5 &mdash; Coverage Implication</div>
    <p>Meridian underwriting position: <strong>Accept residual risk. Do not invoke the act-of-war exclusion. Treat as covered.</strong></p>
    <p>Rationale: Invoking the exclusion on attribution confidence below the legal standard would undermine the financial incentive structure that encourages policyholders to invest in cybersecurity controls &mdash; particularly in critical infrastructure, where those controls have direct safety relevance. A consistent policy of not invoking exclusions for sub-threshold state-sponsored attacks is commercially and reputationally preferable to ad-hoc exclusion invocations.</p>
    <p>The residual attribution ambiguity is accepted as an underwriting risk for the Albion policy renewal determination.</p>
  </div>

</div>`;
    }

    // ── Global state ─────────────────────────────────────────────────────────

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
