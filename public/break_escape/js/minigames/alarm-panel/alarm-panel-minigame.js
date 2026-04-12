import { MinigameScene } from '../framework/base-minigame.js';

// ── Lamp configuration ────────────────────────────────────────────────────────
// Each entry drives one lamp row on the SVG panel.
// offClass / onClass: CSS class on the <circle> element.
// flash: add ap-flash class when lamp is 'on'.

const LAMPS = [
    {
        label:     'BATTERY HALL 1',
        variable:  'anomaly_detected',
        offClass:  'ap-green',
        offStatus: 'NORMAL',
        onClass:   'ap-amber',
        onStatus:  'ANOMALY DETECTED',
        flash:     false
    },
    {
        label:     'RACKS ISOLATED',
        variable:  'esd_activated',
        offClass:  'ap-off',
        offStatus: '\u2014',
        onClass:   'ap-green',
        onStatus:  'ESD ACTIVATED',
        flash:     false
    },
    {
        label:     'SIS STATUS',
        variable:  'sis_tamper_confirmed',
        offClass:  'ap-green',
        offStatus: 'WITHIN SETPOINTS',
        onClass:   'ap-red',
        onStatus:  'SETPOINT DEVIATION',
        flash:     true
    },
    {
        label:     'JUMP SERVER',
        variable:  'jump_server_isolated',
        offClass:  'ap-green',
        offStatus: 'CONNECTED',
        onClass:   'ap-amber',
        onStatus:  'ISOLATED',
        flash:     false
    },
    {
        label:     'NETWORK STATUS',
        variable:  'network_isolated',
        offClass:  'ap-green',
        offStatus: 'NORMAL',
        onClass:   'ap-red',
        onStatus:  'SCADA MANUAL MODE',
        flash:     false
    },
    {
        // [MG-04] Three-state lamp: NORMAL → ADVISORY (hydrogen_alarm) → EVACUATE (facility_evacuated)
        // States evaluated in order; first matching variable wins.
        label:      'H\u2082 GAS',
        multiState: true,
        variables:  ['facility_evacuated', 'hydrogen_alarm'],
        states: [
            { variable: 'facility_evacuated', cssClass: 'ap-red',   statusText: 'EVACUATE', flash: true  },
            { variable: 'hydrogen_alarm',     cssClass: 'ap-amber', statusText: 'ADVISORY', flash: false },
            {                                 cssClass: 'ap-green',  statusText: 'NORMAL',   flash: false }
        ]
    },
    {
        label:     'SAFE STATE',
        variable:  'facility_safe_state',
        offClass:  'ap-off',
        offStatus: '\u2014',
        onClass:   'ap-green',
        onStatus:  'SAFE STATE ACHIEVED',
        flash:     false
    },
];

export class AlarmPanelMinigame extends MinigameScene {
    constructor(container, params = {}) {
        super(container, {
            ...params,
            title:      'Facility Alarm Panel',
            showCancel: true,
            cancelText: 'Close Panel'
        });
        this._eventSubs = [];
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    init() {
        super.init();
        if (this.headerElement) this.headerElement.style.display = 'none';
        this.container.classList.add('ap-minigame-container');
        this.gameContainer.classList.add('ap-game-container');
        this._renderLayout();
    }

    start() {
        super.start();
        this._updateAllLamps();
        this._subscribeEvents();
    }

    // ── Layout ────────────────────────────────────────────────────────────────

    _renderLayout() {
        const CX    = 40;
        const R     = 14;
        const ROW_H = 68;
        const SVG_W = 420;
        const SVG_H = 30 + LAMPS.length * ROW_H + 20;

        const rows = LAMPS.map((lamp, i) => {
            const cy    = 30 + i * ROW_H + ROW_H / 2;
            const sepY  = cy + ROW_H / 2;
            return `
  <g class="ap-lamp-row" data-index="${i}">
    <circle id="ap-lamp-${i}" cx="${CX}" cy="${cy}" r="${R}" class="ap-off"/>
    <text class="ap-label"  x="${CX + R + 14}" y="${cy - 7}">${lamp.label}</text>
    <text class="ap-status" id="ap-status-${i}" x="${CX + R + 14}" y="${cy + 11}">${lamp.offStatus}</text>
    <line class="ap-row-sep" x1="0" y1="${sepY}" x2="${SVG_W}" y2="${sepY}"/>
  </g>`;
        }).join('');

        this.gameContainer.innerHTML = `
<div class="ap-panel-wrap">
  <div class="ap-panel-header">
    <span class="ap-panel-title">ALBION ENERGY STORAGE<br>FACILITY ALARM PANEL</span>
    <span class="ap-live-dot" title="Live — updates on global variable changes"></span>
  </div>
  <svg class="ap-svg" viewBox="0 0 ${SVG_W} ${SVG_H}" xmlns="http://www.w3.org/2000/svg">
    ${rows}
  </svg>
  <div class="ap-footer">ENG-01 &mdash; STATE-REACTIVE LAMP DISPLAY &mdash; READ ONLY</div>
</div>`;
    }

    // ── Lamp update ───────────────────────────────────────────────────────────

    _updateAllLamps() {
        LAMPS.forEach((_, i) => this._updateLamp(i));
    }

    _updateLamp(index) {
        const lamp     = LAMPS[index];
        const circle   = this.gameContainer.querySelector(`#ap-lamp-${index}`);
        const statusEl = this.gameContainer.querySelector(`#ap-status-${index}`);
        if (!circle || !statusEl) return;

        if (lamp.multiState) {
            const globals = window.gameState?.globalVariables || {};
            // First state whose variable is truthy wins; last state (no variable) is the default.
            const active  = lamp.states.find(s => !s.variable || !!globals[s.variable]);
            circle.className.baseVal = active.flash ? `${active.cssClass} ap-flash` : active.cssClass;
            statusEl.textContent = active.statusText;
            statusEl.style.fill  = this._colourFor(active.cssClass);
            return;
        }

        const isOn = !!window.gameState?.globalVariables?.[lamp.variable];
        circle.className.baseVal = isOn
            ? (lamp.flash ? `${lamp.onClass} ap-flash` : lamp.onClass)
            : lamp.offClass;
        statusEl.textContent  = isOn ? lamp.onStatus : lamp.offStatus;
        statusEl.style.fill   = this._colourFor(isOn ? lamp.onClass : lamp.offClass);
    }

    _colourFor(cls) {
        if (cls === 'ap-green') return '#00c853';
        if (cls === 'ap-amber') return '#f59e0b';
        if (cls === 'ap-red')   return '#ef4444';
        return '#3a4a60';   // ap-off — dim
    }

    // ── Event subscription ────────────────────────────────────────────────────

    _onGlobalChanged(varName, value) {
        const i = LAMPS.findIndex(l => l.variable === varName);
        if (i !== -1) this._updateLamp(i);
    }

    _subscribeEvents() {
        LAMPS.forEach((lamp, i) => {
            const varNames = lamp.multiState ? lamp.variables : [lamp.variable];
            varNames.forEach(varName => {
                const eventName = `global_variable_changed:${varName}`;
                const handler   = () => this._updateLamp(i);
                window.eventDispatcher?.on(eventName, handler);
                this._eventSubs.push({ event: eventName, handler });
            });
        });
    }

    cleanup() {
        this._eventSubs.forEach(sub => window.eventDispatcher?.off(sub.event, sub.handler));
        this._eventSubs = [];
        super.cleanup();
    }
}
