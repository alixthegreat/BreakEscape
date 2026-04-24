import { MinigameScene } from '../framework/base-minigame.js';

// Eleanor outcome quotes keyed by coverage position selection
const ELEANOR_OUTCOMES = {
    A1: "Your analysis supports full coverage — Meridian will cover the £8.2M claim. However, we're retaining counsel for the post-incident arbitration with Albion over warranty compliance in the pre-incident period.",
    A2: "By finding three breaches you're reducing coverage to approximately £6.1M. That's defensible — Albion will dispute it, but the Osei report backs the deduction. Litigation budget is already factored in.",
    A3: "Denying coverage entirely is the highest-risk position. Albion will take us to court, and the judge will likely find we're being unreasonable given the SIS functioned correctly despite the attack. I would recommend reconsidering.",
};

export class CoverageDecisionFormMinigame extends MinigameScene {
    constructor(container, params = {}) {
        super(container, {
            ...params,
            title:      'Coverage Recommendation Form',
            showCancel: true,
            cancelText: 'Close',
        });
        this._submitted = false;
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────

    init() {
        super.init();
        if (this.headerElement) this.headerElement.style.display = 'none';
        this.container.classList.add('cdf-minigame-container');
        this.gameContainer.classList.add('cdf-game-container');
        this._renderLayout();
    }

    start() {
        super.start();
        if (!window.gameState?.globalVariables?.coverage_form_reviewed) {
            this._setGlobalAndNotify('coverage_form_reviewed', true);
        }
    }

    cleanup() {
        super.cleanup();
    }

    // ── Layout ───────────────────────────────────────────────────────────────

    _renderLayout() {
        this.gameContainer.innerHTML = `
<div class="cdf-wrap">
  <div class="cdf-header">
    <div class="cdf-header-top">
      <span class="cdf-header-title">Coverage Recommendation Form</span>
      <button class="cdf-close-btn" id="cdf-close-btn">✕ Close</button>
    </div>
    <div class="cdf-header-sub">Meridian Cyber Insurance &mdash; Policy Ref: MC-2023-ALBE-007 &mdash; Claims Manager: Eleanor Vance</div>
  </div>

  <div class="cdf-body">

    <!-- Section 1: Coverage Position -->
    <div class="cdf-section">
      <div class="cdf-section-title">Section 1 &mdash; Coverage Position</div>
      <div class="cdf-section-desc">Select the coverage position based on your warranty compliance assessment and the Osei loss adjustment report.</div>
      <label class="cdf-radio-row" id="cdf-s1-A1">
        <input type="radio" name="cdf-s1" value="A1">
        <span>
          <span>Position A1 &mdash; Accept full claim (£8.2M)</span>
          <span class="cdf-radio-sublabel">All warranties compliant or no material breaches found. Coverage stands in full.</span>
        </span>
      </label>
      <label class="cdf-radio-row" id="cdf-s1-A2">
        <input type="radio" name="cdf-s1" value="A2">
        <span>
          <span>Position A2 &mdash; Proportional coverage (approx. £6.1M)</span>
          <span class="cdf-radio-sublabel">Warranty breaches proven and causally connected. ~25% deduction on BI and physical damage per Insurance Act 2015.</span>
        </span>
      </label>
      <label class="cdf-radio-row" id="cdf-s1-A3">
        <input type="radio" name="cdf-s1" value="A3">
        <span>
          <span>Position A3 &mdash; Decline coverage</span>
          <span class="cdf-radio-sublabel">Multiple safety-critical warranty breaches; coverage declined. High litigation risk.</span>
        </span>
      </label>
    </div>

    <!-- Section 2: Act-of-War Exclusion -->
    <div class="cdf-section">
      <div class="cdf-section-title">Section 2 &mdash; Act-of-War Exclusion Decision</div>
      <div class="cdf-section-desc">GREYMANTLE attribution: moderate-to-high confidence (70–80%) state-aligned, but below English law threshold for formal &ldquo;act of war&rdquo; determination. Meridian underwriting position: residual risk accepted.</div>
      <label class="cdf-radio-row" id="cdf-s2-invoke">
        <input type="radio" name="cdf-s2" value="invoke">
        <span>
          <span>Invoke the exclusion</span>
          <span class="cdf-radio-sublabel">Treat attack as state-sponsored act of war; decline coverage on this basis. Requires formal state actor assertion.</span>
        </span>
      </label>
      <label class="cdf-radio-row" id="cdf-s2-preserve">
        <input type="radio" name="cdf-s2" value="preserve">
        <span>
          <span>Preserve right without formal invocation</span>
          <span class="cdf-radio-sublabel">Reserve Meridian&rsquo;s position pending any future formal state attribution; maintain coverage for now.</span>
        </span>
      </label>
      <label class="cdf-radio-row" id="cdf-s2-waive">
        <input type="radio" name="cdf-s2" value="waive">
        <span>
          <span>Expressly waive the exclusion</span>
          <span class="cdf-radio-sublabel">Attribution confidence insufficient; treat as covered cyber event regardless of state-aligned indicators.</span>
        </span>
      </label>
    </div>

    <!-- Section 3: Regulatory Disclosure -->
    <div class="cdf-section">
      <div class="cdf-section-title">Section 3 &mdash; Regulatory Disclosure</div>
      <div class="cdf-section-desc">Determine the disclosure posture for NCSC attribution indicators. Standard FCA / PRA reporting applies regardless of this selection.</div>
      <label class="cdf-radio-row" id="cdf-s3-full">
        <input type="radio" name="cdf-s3" value="full">
        <span>
          <span>Support full NCSC disclosure of all technical indicators</span>
          <span class="cdf-radio-sublabel">Disclose GREYMANTLE attribution evidence, C2 infrastructure details, and tooling signatures to NCSC without restriction.</span>
        </span>
      </label>
      <label class="cdf-radio-row" id="cdf-s3-restricted">
        <input type="radio" name="cdf-s3" value="restricted">
        <span>
          <span>Advise restricted legally-reviewed disclosure only</span>
          <span class="cdf-radio-sublabel">Disclose only what is required under NIS Regulations; withhold attribution intelligence pending legal review.</span>
        </span>
      </label>
    </div>

    <!-- Section 4: Trent Water Third-Party Scope -->
    <div class="cdf-section">
      <div class="cdf-section-title">Section 4 &mdash; Trent Water Third-Party Scope</div>
      <div class="cdf-section-desc">Cross-sector exposure from shared CastleTech MSP infrastructure. Provisional Trent Water quantum: £400K. Forensic findings pending.</div>
      <label class="cdf-radio-row" id="cdf-s4-include">
        <input type="radio" name="cdf-s4" value="include">
        <span>
          <span>Include in initial scope (est. £400K)</span>
          <span class="cdf-radio-sublabel">Accept provisional quantum; adjust on final Trent Water forensic report.</span>
        </span>
      </label>
      <label class="cdf-radio-row" id="cdf-s4-refer">
        <input type="radio" name="cdf-s4" value="refer">
        <span>
          <span>Refer out pending Trent Water forensic findings</span>
          <span class="cdf-radio-sublabel">Exclude from this determination; open separate claim reference once scope confirmed.</span>
        </span>
      </label>
    </div>

  </div><!-- /.cdf-body -->

  <div class="cdf-footer">
    <div class="cdf-outcome-note" id="cdf-outcome-note">
      <div class="cdf-outcome-speaker">Eleanor Vance &mdash; Claims Manager</div>
      <div id="cdf-outcome-text"></div>
    </div>
    <div class="cdf-submitted-badge" id="cdf-submitted-badge">&#10003; RECOMMENDATION LOGGED — MC-2023-ALBE-007</div>
    <button class="cdf-submit-btn" id="cdf-submit-btn" disabled>[SUBMIT RECOMMENDATION &#9654;]</button>
    <div class="cdf-hint" id="cdf-hint">Complete all four sections to submit your recommendation.</div>
  </div>
</div>`;

        // Close button
        const closeBtn = this.gameContainer.querySelector('#cdf-close-btn');
        this.addEventListener(closeBtn, 'click', () => this.complete(false));

        // Radio change listeners — update row highlight + submit guard
        this.gameContainer.querySelectorAll('input[type="radio"]').forEach(radio => {
            this.addEventListener(radio, 'change', () => this._onRadioChange(radio));
        });

        // Submit button
        const submitBtn = this.gameContainer.querySelector('#cdf-submit-btn');
        this.addEventListener(submitBtn, 'click', () => this._onSubmit());
    }

    // ── Radio interaction ─────────────────────────────────────────────────────

    _onRadioChange(radio) {
        // Update selected highlight for this section's rows
        const name = radio.name;
        this.gameContainer.querySelectorAll(`input[name="${name}"]`).forEach(r => {
            r.closest('.cdf-radio-row').classList.toggle('cdf-selected', r.checked);
        });
        this._updateSubmitButton();
    }

    _updateSubmitButton() {
        if (this._submitted) return;
        const allSelected = ['cdf-s1', 'cdf-s2', 'cdf-s3', 'cdf-s4'].every(name =>
            !!this.gameContainer.querySelector(`input[name="${name}"]:checked`)
        );
        const btn  = this.gameContainer.querySelector('#cdf-submit-btn');
        const hint = this.gameContainer.querySelector('#cdf-hint');
        if (!btn) return;
        btn.disabled = !allSelected;
        btn.classList.toggle('cdf-ready', allSelected);
        if (hint) hint.classList.toggle('hidden', allSelected);
    }

    // ── Submit ────────────────────────────────────────────────────────────────

    _onSubmit() {
        if (this._submitted) return;
        this._submitted = true;

        const s1 = this.gameContainer.querySelector('input[name="cdf-s1"]:checked')?.value || 'A2';
        const s2 = this.gameContainer.querySelector('input[name="cdf-s2"]:checked')?.value || 'preserve';
        const s3 = this.gameContainer.querySelector('input[name="cdf-s3"]:checked')?.value || 'restricted';
        const s4 = this.gameContainer.querySelector('input[name="cdf-s4"]:checked')?.value || 'refer';

        // Disable all radios
        this.gameContainer.querySelectorAll('input[type="radio"]').forEach(r => { r.disabled = true; });
        this.gameContainer.querySelectorAll('.cdf-radio-row').forEach(row => {
            row.style.cursor = 'default';
        });

        // Update submit button
        const btn = this.gameContainer.querySelector('#cdf-submit-btn');
        if (btn) {
            btn.disabled = true;
            btn.classList.remove('cdf-ready');
            btn.classList.add('cdf-done');
            btn.textContent = 'RECOMMENDATION SUBMITTED';
        }

        // Show outcome note
        const outcomeNote = this.gameContainer.querySelector('#cdf-outcome-note');
        const outcomeText = this.gameContainer.querySelector('#cdf-outcome-text');
        const badge       = this.gameContainer.querySelector('#cdf-submitted-badge');
        const hint        = this.gameContainer.querySelector('#cdf-hint');
        if (hint) hint.classList.add('hidden');
        if (badge) badge.classList.add('visible');
        if (outcomeNote && outcomeText) {
            outcomeText.textContent = ELEANOR_OUTCOMES[s1] || ELEANOR_OUTCOMES.A2;
            outcomeNote.classList.add('visible');
        }

        // Write globals — coverage_decision_made last (triggers Eleanor eventMapping)
        this._setGlobalAndNotify('coverage_form_reviewed',  true);
        this._setGlobalAndNotify('coverage_decision',       s1);
        this._setGlobalAndNotify('war_exclusion_invoked',   s2 === 'invoke');
        this._setGlobalAndNotify('disclosure_position',     s3);
        this._setGlobalAndNotify('trent_water_assessed',    s4 === 'include');
        this._setGlobalAndNotify('coverage_decision_made',  true);
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
}
