import { MinigameScene } from '../framework/base-minigame.js';

/**
 * MG-04 — Network Segmentation Map
 *
 * Draft (MVP) behaviour:
 *  - Renders three-zone network topology with connection lines via inline SVG.
 *  - Legacy exception rule lines are view-only (no toggles in draft).
 *  - SEVER button is immediately enabled.
 *  - Confirming SEVER writes `network_isolated = true` via npcManager and calls complete(true).
 *
 * Post-draft enhancements (not implemented here):
 *  - Per-rule toggle switches at line midpoints.
 *  - `network_rules_reviewed` global variable set on first toggle.
 *  - Real-time consequence panel updates per rule.
 *  - SEVER gated behind at least one toggle interaction.
 */
export class NetworkSegmentationMapMinigame extends MinigameScene {
    constructor(container, params) {
        params = params || {};
        super(container, params);
        this.severed = false;
        this._resizeHandler = null;
    }

    init() {
        // Full custom layout — does not call super.init() so we own the entire container.
        this.container.innerHTML = `
            <button class="minigame-close-button" id="nsm-close">&times;</button>
            <div class="nsm-wrapper">
                <div class="nsm-header-bar">
                    <span class="nsm-title-text">NORTHGATE TRUST // NETWORK SEGMENTATION MAP</span>
                    <span class="nsm-status-badge">ACTIVE INCIDENT</span>
                </div>
                <div class="nsm-body">
                    <div class="nsm-topology-area" id="nsm-topology-area">
                        <div class="nsm-zones">
                            <div class="nsm-zone nsm-zone-external" id="nsm-zone-external">
                                <div class="nsm-zone-label">EXTERNAL ZONE</div>
                                <div class="nsm-zone-devices">
                                    <div class="nsm-device">VPN-GW</div>
                                    <div class="nsm-device nsm-device-dim">INTERNET</div>
                                </div>
                            </div>
                            <div class="nsm-zone nsm-zone-enterprise" id="nsm-zone-enterprise">
                                <div class="nsm-zone-label">ENTERPRISE IT ZONE</div>
                                <div class="nsm-zone-devices">
                                    <div class="nsm-device">DC01</div>
                                    <div class="nsm-device">DC02</div>
                                    <div class="nsm-device">FILE-SRV</div>
                                    <div class="nsm-device">MGMT-SRV</div>
                                </div>
                            </div>
                            <div class="nsm-zone nsm-zone-clinical" id="nsm-zone-clinical">
                                <div class="nsm-zone-label">CLINICAL / DEVICE ZONE</div>
                                <div class="nsm-zone-devices">
                                    <div class="nsm-device">EHR-SRV</div>
                                    <div class="nsm-device">PUMP-CONSOLE</div>
                                    <div class="nsm-device">PATIENT-MON</div>
                                    <div class="nsm-device">PACS</div>
                                </div>
                            </div>
                        </div>
                        <svg class="nsm-svg" id="nsm-svg" xmlns="http://www.w3.org/2000/svg"></svg>
                    </div>
                    <div class="nsm-consequence-panel">
                        <div class="nsm-panel-title">CONSEQUENCE ASSESSMENT</div>
                        <div class="nsm-consequence-body" id="nsm-consequence-body"></div>
                    </div>
                </div>
                <div class="nsm-action-bar">
                    <div class="nsm-legend">
                        <span class="nsm-legend-item">
                            <span class="nsm-legend-line nsm-legend-white"></span>PERIMETER FIREWALL
                        </span>
                        <span class="nsm-legend-item">
                            <span class="nsm-legend-line nsm-legend-amber"></span>INTERNAL FIREWALL
                        </span>
                        <span class="nsm-legend-item">
                            <span class="nsm-legend-line nsm-legend-orange nsm-legend-dashed"></span>LEGACY EXCEPTION RULES
                        </span>
                    </div>
                    <button class="nsm-sever-btn" id="nsm-sever-btn">
                        SEVER ENTERPRISE &#x2192; CLINICAL LINK
                    </button>
                </div>
            </div>
            <div class="nsm-modal-overlay" id="nsm-modal-overlay">
                <div class="nsm-modal">
                    <div class="nsm-modal-icon">&#9888;</div>
                    <div class="nsm-modal-title">CONFIRM NETWORK ISOLATION</div>
                    <div class="nsm-modal-body">
                        This will disconnect all clinical zone systems from the enterprise network.
                        Clinical staff will lose EHR access.
                        Confirm?
                    </div>
                    <div class="nsm-modal-actions">
                        <button class="nsm-modal-btn nsm-modal-no" id="nsm-modal-no">NO — CANCEL</button>
                        <button class="nsm-modal-btn nsm-modal-yes" id="nsm-modal-yes">YES — SEVER LINK</button>
                    </div>
                </div>
            </div>
        `;

        this._renderConsequencePanel();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    start() {
        super.start(); // sets up ESC-to-close handler

        this.addEventListener(this.container.querySelector('#nsm-close'), 'click',
            () => this.complete(false));
        this.addEventListener(this.container.querySelector('#nsm-sever-btn'), 'click',
            () => this._openModal());
        this.addEventListener(this.container.querySelector('#nsm-modal-yes'), 'click',
            () => this._confirmSever());
        this.addEventListener(this.container.querySelector('#nsm-modal-no'), 'click',
            () => this._closeModal());

        this._resizeHandler = () => this._drawConnections();
        window.addEventListener('resize', this._resizeHandler);

        // Draw after the browser has laid out the zones
        requestAnimationFrame(() => this._drawConnections());
    }

    cleanup() {
        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
            this._resizeHandler = null;
        }
        super.cleanup();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Modal
    // ─────────────────────────────────────────────────────────────────────────

    _openModal() {
        this.container.querySelector('#nsm-modal-overlay').classList.add('nsm-modal-visible');
        if (window.playUISound) window.playUISound('alert');
    }

    _closeModal() {
        this.container.querySelector('#nsm-modal-overlay').classList.remove('nsm-modal-visible');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SEVER action
    // ─────────────────────────────────────────────────────────────────────────

    _confirmSever() {
        this.severed = true;
        this._closeModal();

        // Write global state — downstream logic drives EHR/fleet-console transitions
        if (window.npcManager && window.npcManager.setGlobalVariable) {
            window.npcManager.setGlobalVariable('network_isolated', true);
        } else if (window.gameState?.globalVariables) {
            // Fallback: write directly and emit the change event
            window.gameState.globalVariables['network_isolated'] = true;
            if (window.eventDispatcher) {
                window.eventDispatcher.emit('global_variable_changed:network_isolated', {
                    name: 'network_isolated', value: true, oldValue: false
                });
            }
        }

        this._drawConnections(true);
        this._renderSeveredConsequencePanel();

        const btn = this.container.querySelector('#nsm-sever-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'LINK SEVERED';
            btn.classList.add('nsm-sever-btn-done');
        }

        if (window.playUISound) window.playUISound('confirm');

        setTimeout(() => this.complete(true), 2000);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Consequence panel content
    // ─────────────────────────────────────────────────────────────────────────

    _renderConsequencePanel() {
        const body = this.container.querySelector('#nsm-consequence-body');
        if (!body) return;
        body.innerHTML = `
            <div class="nsm-cons-intro">
                <span class="nsm-warn-text">3 legacy exception rules</span>
                currently bridge enterprise and clinical zones.
            </div>
            <div class="nsm-cons-section">IF SEVER IS CONFIRMED:</div>
            <ul class="nsm-cons-list">
                <li class="nsm-cons-item nsm-impact-high">EHR access lost on affected wards — prescribing reverts to paper</li>
                <li class="nsm-cons-item nsm-impact-high">Fleet management console offline — manual bedside dose entry required</li>
                <li class="nsm-cons-item nsm-impact-med">Clinical workstation remote management unavailable</li>
                <li class="nsm-cons-item nsm-impact-low">Enterprise email inaccessible from clinical devices</li>
            </ul>
            <div class="nsm-cons-section">SECURITY BENEFIT:</div>
            <ul class="nsm-cons-list">
                <li class="nsm-cons-item nsm-impact-positive">Attacker lateral movement from enterprise blocked</li>
                <li class="nsm-cons-item nsm-impact-positive">Safety-critical devices isolated from ransomware propagation</li>
            </ul>
        `;
    }

    _renderSeveredConsequencePanel() {
        const body = this.container.querySelector('#nsm-consequence-body');
        if (!body) return;
        body.innerHTML = `
            <div class="nsm-cons-severed">NETWORK ISOLATED</div>
            <ul class="nsm-cons-list">
                <li class="nsm-cons-item nsm-impact-high">EHR OFFLINE — wards on paper records</li>
                <li class="nsm-cons-item nsm-impact-high">FLEET CONSOLE OFFLINE — manual operation required</li>
                <li class="nsm-cons-item nsm-impact-positive">Enterprise-to-clinical link SEVERED</li>
                <li class="nsm-cons-item nsm-impact-positive">Attacker propagation route blocked</li>
            </ul>
        `;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SVG connection drawing
    // ─────────────────────────────────────────────────────────────────────────

    _drawConnections(severed = false) {
        const svg    = this.container.querySelector('#nsm-svg');
        const area   = this.container.querySelector('#nsm-topology-area');
        const extEl  = this.container.querySelector('#nsm-zone-external');
        const entEl  = this.container.querySelector('#nsm-zone-enterprise');
        const clinEl = this.container.querySelector('#nsm-zone-clinical');

        if (!svg || !area || !extEl || !entEl || !clinEl) return;

        const aRect = area.getBoundingClientRect();
        if (aRect.width === 0 || aRect.height === 0) return;

        // Convert a DOMRect to topology-area-local coordinates
        const local = (el) => {
            const b = el.getBoundingClientRect();
            return {
                left:  b.left   - aRect.left,
                right: b.right  - aRect.left,
                top:   b.top    - aRect.top,
                bot:   b.bottom - aRect.top,
                midX: (b.left  + b.right)  / 2 - aRect.left,
                midY: (b.top   + b.bottom) / 2 - aRect.top,
            };
        };

        const ext  = local(extEl);
        const ent  = local(entEl);
        const clin = local(clinEl);
        const W    = aRect.width;
        const H    = aRect.height;

        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.setAttribute('width',   W);
        svg.setAttribute('height',  H);
        svg.innerHTML = '';

        const ns = 'http://www.w3.org/2000/svg';

        // Midpoint x-coordinates for icon placement
        const pfMidX = (ext.right  + ent.left)  / 2;  // perimeter FW midpoint
        const ecMidX = (ent.right  + clin.left) / 2;  // enterprise↔clinical midpoint

        // Y levels used for the enterprise↔clinical connections
        const ifY  = ent.midY - 40;   // internal firewall
        const r1Y  = ent.midY - 10;   // legacy rule 1
        const r2Y  = ent.midY + 15;   // legacy rule 2
        const r3Y  = ent.midY + 40;   // legacy rule 3

        // ── Perimeter firewall: External → Enterprise (white, solid) ──────────
        this._svgLine(svg, ns, ext.right, ent.midY, ent.left, ent.midY, '#ffffff', 3, null);
        this._svgPadlock(svg, ns, pfMidX, ent.midY, '#ffffff');

        if (!severed) {
            // ── Internal firewall: Enterprise → Clinical (amber, solid) ─────────
            this._svgLine(svg, ns, ent.right, ifY, clin.left, ifY, '#ffb300', 3, null);
            this._svgPadlock(svg, ns, ecMidX, ifY, '#ffb300');

            // ── Legacy exception rules (orange, dashed) ──────────────────────────
            [r1Y, r2Y, r3Y].forEach((y) => {
                this._svgLine(svg, ns, ent.right, y, clin.left, y, '#ff7700', 2, '8 5');
                this._svgWarning(svg, ns, ecMidX, y);
            });
        } else {
            // ── Severed state: red X between enterprise and clinical ──────────────
            const sX = ecMidX;
            const sY = ent.midY;

            // Stub lines leading into the X
            this._svgLine(svg, ns, ent.right,  sY, sX - 22, sY, '#cc2200', 2, '5 4');
            this._svgLine(svg, ns, sX + 22,    sY, clin.left, sY, '#cc2200', 2, '5 4');

            // Red X
            this._svgLine(svg, ns, sX - 14, sY - 14, sX + 14, sY + 14, '#ff2200', 4, null);
            this._svgLine(svg, ns, sX + 14, sY - 14, sX - 14, sY + 14, '#ff2200', 4, null);

            // Label
            const t = document.createElementNS(ns, 'text');
            t.setAttribute('x',           sX);
            t.setAttribute('y',           sY + 32);
            t.setAttribute('text-anchor', 'middle');
            t.setAttribute('fill',        '#ff2200');
            t.setAttribute('font-size',   '14');
            t.setAttribute('font-family', "'VT323', monospace");
            t.textContent = 'LINK SEVERED';
            svg.appendChild(t);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SVG primitive helpers
    // ─────────────────────────────────────────────────────────────────────────

    _svgLine(svg, ns, x1, y1, x2, y2, stroke, width, dash) {
        const el = document.createElementNS(ns, 'line');
        el.setAttribute('x1', x1);
        el.setAttribute('y1', y1);
        el.setAttribute('x2', x2);
        el.setAttribute('y2', y2);
        el.setAttribute('stroke', stroke);
        el.setAttribute('stroke-width', width);
        if (dash) el.setAttribute('stroke-dasharray', dash);
        svg.appendChild(el);
    }

    _svgPadlock(svg, ns, x, y, color) {
        const g = document.createElementNS(ns, 'g');

        const arc = document.createElementNS(ns, 'path');
        arc.setAttribute('d', `M ${x-6} ${y-2} Q ${x-6} ${y-14} ${x} ${y-14} Q ${x+6} ${y-14} ${x+6} ${y-2}`);
        arc.setAttribute('stroke', color);
        arc.setAttribute('stroke-width', '2.5');
        arc.setAttribute('fill', 'none');
        g.appendChild(arc);

        const body = document.createElementNS(ns, 'rect');
        body.setAttribute('x', x - 8);
        body.setAttribute('y', y - 2);
        body.setAttribute('width',  '16');
        body.setAttribute('height', '12');
        body.setAttribute('fill',   '#0d0d1a');
        body.setAttribute('stroke', color);
        body.setAttribute('stroke-width', '2');
        g.appendChild(body);

        const dot = document.createElementNS(ns, 'circle');
        dot.setAttribute('cx', x);
        dot.setAttribute('cy', y + 4);
        dot.setAttribute('r',  '2.5');
        dot.setAttribute('fill', color);
        g.appendChild(dot);

        svg.appendChild(g);
    }

    _svgWarning(svg, ns, x, y) {
        const g = document.createElementNS(ns, 'g');

        const tri = document.createElementNS(ns, 'polygon');
        tri.setAttribute('points', `${x},${y-9} ${x-8},${y+5} ${x+8},${y+5}`);
        tri.setAttribute('fill',   '#1a0a00');
        tri.setAttribute('stroke', '#ff7700');
        tri.setAttribute('stroke-width', '1.5');
        g.appendChild(tri);

        const t = document.createElementNS(ns, 'text');
        t.setAttribute('x',           x);
        t.setAttribute('y',           y + 4);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('fill',        '#ff7700');
        t.setAttribute('font-size',   '9');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-weight', 'bold');
        t.textContent = '!';
        g.appendChild(t);

        svg.appendChild(g);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Starter helper
// ─────────────────────────────────────────────────────────────────────────────

export function startNetworkSegmentationMapMinigame(params = {}) {
    if (!window.MinigameFramework) {
        console.error('[NSM] MinigameFramework not available');
        return;
    }
    window.MinigameFramework.startMinigame('network-segmentation-map', null, {
        showCancel: false,
        ...params,
        onComplete: (success, result) => {
            console.log('[NSM] Network segmentation map completed, network_isolated:', success);
            if (params.onComplete) params.onComplete(success, result);
        }
    });
}
