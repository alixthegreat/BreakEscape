import { MinigameScene } from '../framework/base-minigame.js';
import { applyActions } from '../../systems/apply-actions.js';

const DEFAULT_TITLE = 'NORTHGATE TRUST // VPN AUTHENTICATION LOG';
const DEFAULT_SUBTITLE = 'vpn-gw-01.northgate.nhs.uk  |  Period: 2025-11-03 07:00-14:22';
const DEFAULT_LOG_PATH = '/var/log/vpn/auth.log';

const COUNTRY_OPTIONS = ['UK', 'RO', 'IE', 'DE', 'FR'];
const MFA_OPTIONS = ['YES', 'NO'];
const RESULT_OPTIONS = ['ACCEPT', 'REJECT'];
const TIME_OPTIONS = ['06-08', '08-10', '10-12', '12-14'];
const FILTER_ORDER = ['COUNTRY', 'MFA', 'RESULT', 'USER', 'TIME'];

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function normalizeActionMap(raw) {
    if (!raw || typeof raw !== 'object') return {};
    return raw;
}

function normalizeEntry(entry, index) {
    return {
        id: String(entry.id || `vpn_entry_${index + 1}`),
        timestamp: String(entry.timestamp || ''),
        user: String(entry.user || ''),
        ip: String(entry.ip || ''),
        country: String(entry.country || '').toUpperCase(),
        mfa: String(entry.mfa || '').toUpperCase(),
        result: String(entry.result || '').toUpperCase()
    };
}

function parseRange(rangeText) {
    const parts = String(rangeText || '').split('-').map((v) => Number(v));
    if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
        return null;
    }
    return { start: parts[0], end: parts[1] };
}

function getHourFromTimestamp(timestamp) {
    const timePart = String(timestamp || '').split(' ')[1] || '';
    const hour = Number(timePart.split(':')[0]);
    return Number.isNaN(hour) ? null : hour;
}

function pad2(value) {
    return String(value).padStart(2, '0');
}

function formatTimestamp(totalMinutes) {
    const clamped = Math.max(0, Number(totalMinutes) || 0);
    const hour = Math.floor(clamped / 60);
    const minute = clamped % 60;
    return `2025-11-03 ${pad2(hour)}:${pad2(minute)}`;
}

function buildSyntheticLog(data) {
    const entryCount = Math.max(10, Number(data.entryCount) || 50);
    const anomaly = data.anomaly || {};
    const anomalyPosition = Math.min(entryCount, Math.max(1, Number(anomaly.position) || 21));

    const users = [
        'f.rahman', 'd.chen', 'k.wilson', 'a.patel', 'e.nguyen',
        'j.okafor', 'r.james', 't.bergstrom', 's.murphy', 'p.whitmore',
        'b.marshall', 'g.robinson', 'l.foster', 'm.hassan', 'v.osei',
        'n.taylor', 'j.anderson', 'a.thompson', 'h.walker', 'c.morris'
    ];

    const ips = [
        '81.182.23.9', '90.193.44.72', '82.24.117.8', '91.108.4.12', '193.56.147.23',
        '79.77.215.4', '80.6.88.191', '194.44.12.88', '212.159.9.40', '88.97.183.4',
        '92.78.14.102', '81.99.44.23', '90.147.88.12', '86.155.249.78', '77.68.4.192',
        '178.62.44.12', '81.137.22.9', '90.215.143.7', '82.36.17.8', '86.44.122.3'
    ];

    const entries = [];
    for (let i = 0; i < entryCount; i += 1) {
        const minuteOffset = 4 + Math.floor((i * 442) / Math.max(1, entryCount - 1));
        entries.push({
            id: `vpn_entry_${i + 1}`,
            timestamp: formatTimestamp((7 * 60) + minuteOffset),
            user: users[i % users.length],
            ip: ips[i % ips.length],
            country: 'UK',
            mfa: 'YES',
            result: 'ACCEPT'
        });
    }

    const history = data.impossibleTravel?.priorEntry || {};
    const historyTimestamp = String(history.timestamp || '2025-11-03 08:22');
    const historyIp = String(history.ip || '82.15.4.29');
    const anomalyTimestamp = String(anomaly.timestamp || '2025-11-03 08:52');

    const anomalyUser = String(anomaly.user || data.anomalousUser || 'm.blake');
    const anomalyIp = String(anomaly.ip || data.anomalousIp || '185.220.101.47');
    const anomalyCountry = String(anomaly.country || data.anomalousCountry || 'RO').toUpperCase();
    const anomalyMfa = String(anomaly.mfa || 'NO').toUpperCase();
    const anomalyResult = String(anomaly.result || 'ACCEPT').toUpperCase();

    const historyIndex = Math.max(0, anomalyPosition - 2);
    entries[historyIndex] = {
        id: `vpn_history_${historyIndex + 1}`,
        timestamp: historyTimestamp,
        user: anomalyUser,
        ip: historyIp,
        country: 'UK',
        mfa: anomalyMfa,
        result: 'ACCEPT'
    };

    entries[anomalyPosition - 1] = {
        id: `vpn_anomaly_${anomalyPosition}`,
        timestamp: anomalyTimestamp,
        user: anomalyUser,
        ip: anomalyIp,
        country: anomalyCountry,
        mfa: anomalyMfa,
        result: anomalyResult
    };

    const noise = Array.isArray(data.noise) ? data.noise : [];
    if (noise.length > 0) {
        noise.forEach((noiseEntry, idx) => {
            const targetIndex = Math.min(entryCount - 1, Math.max(0, 15 + idx));
            entries[targetIndex] = {
                id: `vpn_noise_${targetIndex + 1}`,
                timestamp: String(noiseEntry.timestamp || formatTimestamp((8 * 60) + 44 + idx)),
                user: String(noiseEntry.user || 'w.price'),
                ip: String(noiseEntry.ip || '91.108.14.4'),
                country: String(noiseEntry.country || 'UK').toUpperCase(),
                mfa: String(noiseEntry.mfa || 'NO').toUpperCase(),
                result: String(noiseEntry.result || 'ACCEPT').toUpperCase()
            };
        });
    } else {
        entries[16] = {
            id: 'vpn_noise_default',
            timestamp: '2025-11-03 08:44',
            user: 'w.price',
            ip: '91.108.14.4',
            country: 'UK',
            mfa: 'NO',
            result: 'ACCEPT'
        };
    }

    return entries;
}

function buildCommand(filters, logPath) {
    const parts = [];

    FILTER_ORDER.forEach((field) => {
        const value = filters[field];
        if (!value) return;

        if (field === 'USER') {
            parts.push(`grep -i \"USER=${value}\"`);
            return;
        }

        if (field === 'TIME') {
            const range = parseRange(value);
            if (!range) return;
            const start = `${pad2(range.start)}:`;
            const end = `${pad2(range.end)}:`;
            parts.push(`grep -E \"${start}|${end}\"`);
            return;
        }

        parts.push(`grep \"${field}=${value}\"`);
    });

    if (parts.length === 0) {
        return `$ cat ${logPath}`;
    }

    return `$ ${parts[0]} ${logPath}${parts.slice(1).map((part) => ` \\\n  | ${part}`).join('')}`;
}

export class VpnLogViewerMinigame extends MinigameScene {
    constructor(container, params = {}) {
        super(container, {
            ...params,
            title: params.title || DEFAULT_TITLE,
            showCancel: false
        });

        const scenarioData = params.lockable?.scenarioData || {};
        this.config = {
            consoleTitle: String(scenarioData.consoleTitle || params.title || DEFAULT_TITLE),
            consoleSubtitle: String(scenarioData.consoleSubtitle || DEFAULT_SUBTITLE),
            logFilePath: String(scenarioData.logFilePath || DEFAULT_LOG_PATH),
            anomaly: scenarioData.anomaly || {
                user: String(scenarioData.anomalousUser || 'm.blake'),
                ip: String(scenarioData.anomalousIp || '185.220.101.47'),
                country: String(scenarioData.anomalousCountry || 'RO'),
                mfa: 'NO',
                result: 'ACCEPT',
                timestamp: '2025-11-03 08:52',
                position: Number(scenarioData.anomalyPosition || 21)
            },
            impossibleTravel: scenarioData.impossibleTravel || {},
            threatIntel: scenarioData.threatIntel || {},
            completionActions: Array.isArray(scenarioData.completionActions) ? scenarioData.completionActions : [
                { type: 'set_global', key: 'vpn_anomaly_identified', value: true },
                { type: 'complete_task', taskId: 'vpn_anomaly' }
            ],
            progressActions: normalizeActionMap(scenarioData.progressActions),
            contractorAccounts: new Set(
                Array.isArray(scenarioData.contractorAccounts)
                    ? scenarioData.contractorAccounts.map((s) => String(s).toLowerCase())
                    : []
            )
        };

        this.entries = Array.isArray(scenarioData.authLog) && scenarioData.authLog.length > 0
            ? scenarioData.authLog.map(normalizeEntry)
            : buildSyntheticLog(scenarioData).map(normalizeEntry);

        this.filters = {};
        this.visibleEntryIds = new Set(this.entries.map((entry) => entry.id));
        this.selectedEntryId = null;
        this.historyFocusUser = null;
        this.threatIntelDone = false;
        this.impossibleTravelDone = false;
    }

    init() {
        super.init();

        this.container.classList.add('vpn-log-viewer-container');
        this.gameContainer.classList.add('vpn-log-viewer-game-container');

        if (this.headerElement) {
            this.headerElement.style.display = 'none';
        }

        this.render();
    }

    start() {
        super.start();
        this.render();
    }

    setFilter(field, value) {
        const normalizedField = String(field || '').toUpperCase();
        if (!normalizedField || !value) return;

        this.historyFocusUser = null;
        this.filters[normalizedField] = String(value).trim();
        this.selectedEntryId = null;
        this.render();
    }

    clearFilter(field) {
        const normalizedField = String(field || '').toUpperCase();
        if (!this.filters[normalizedField]) return;

        delete this.filters[normalizedField];
        this.historyFocusUser = null;
        this.selectedEntryId = null;
        this.render();
    }

    clearAllFilters() {
        this.filters = {};
        this.historyFocusUser = null;
        this.selectedEntryId = null;
        this.render();
    }

    matchesFilters(entry) {
        if (this.historyFocusUser) {
            return entry.user.toLowerCase() === this.historyFocusUser.toLowerCase();
        }

        if (this.filters.COUNTRY && entry.country !== this.filters.COUNTRY) return false;
        if (this.filters.MFA && entry.mfa !== this.filters.MFA) return false;
        if (this.filters.RESULT && entry.result !== this.filters.RESULT) return false;

        if (this.filters.USER) {
            const userNeedle = this.filters.USER.toLowerCase();
            if (!entry.user.toLowerCase().includes(userNeedle)) return false;
        }

        if (this.filters.TIME) {
            const range = parseRange(this.filters.TIME);
            const hour = getHourFromTimestamp(entry.timestamp);
            if (!range || hour === null) return false;
            if (hour < range.start || hour >= range.end) return false;
        }

        return true;
    }

    runProgressActions(key) {
        const actions = this.config.progressActions?.[key];
        if (!Array.isArray(actions) || actions.length === 0) return;
        applyActions(actions, { source: 'vpn_log_viewer_progress' });
    }

    runCompletionActions() {
        applyActions(this.config.completionActions, { source: 'vpn_log_viewer_complete' });
    }

    getSelectedEntry() {
        return this.entries.find((entry) => entry.id === this.selectedEntryId) || null;
    }

    handleAddUserFilter() {
        const input = this.gameContainer.querySelector('#vpn-user-filter-input');
        if (!input) return;

        const value = String(input.value || '').trim();
        if (!value) return;

        this.setFilter('USER', value);
    }

    handleSelectEntry(entryId) {
        if (!this.visibleEntryIds.has(entryId)) return;
        if (this.visibleEntryIds.size > 5) return;

        this.selectedEntryId = entryId;
        this.render();
    }

    handleLookupIp() {
        if (this.threatIntelDone) return;

        this.threatIntelDone = true;
        this.runProgressActions('onThreatIntelChecked');
        this.render();
    }

    handleCheckUserHistory() {
        const selected = this.getSelectedEntry();
        if (!selected) return;

        this.historyFocusUser = selected.user;
        if (!this.impossibleTravelDone) {
            this.impossibleTravelDone = true;
            this.runProgressActions('onImpossibleTravelFound');
        }
        this.render();
    }

    handleFlagAnomaly() {
        const selected = this.getSelectedEntry();
        if (!selected) return;

        const expectedUser = String(this.config.anomaly.user || '').toLowerCase();
        const expectedIp = String(this.config.anomaly.ip || '').toLowerCase();

        if (selected.user.toLowerCase() !== expectedUser || selected.ip.toLowerCase() !== expectedIp) {
            if (window.gameAlert) {
                window.gameAlert('Selected entry does not match the confirmed anomaly criteria.', 'warning', 'Review Required', 2500);
            }
            return;
        }

        const confirmModal = this.gameContainer.querySelector('#vpn-confirm-overlay');
        if (confirmModal) {
            confirmModal.classList.add('is-visible');
        }
    }

    confirmFlagAnomaly() {
        this.runCompletionActions();
        this.gameResult = {
            anomalyUser: this.config.anomaly.user,
            anomalyIp: this.config.anomaly.ip,
            anomalyCountry: this.config.anomaly.country
        };
        this.complete(true);
    }

    closeConfirmModal() {
        const confirmModal = this.gameContainer.querySelector('#vpn-confirm-overlay');
        if (confirmModal) {
            confirmModal.classList.remove('is-visible');
        }
    }

    bindEvents() {
        const closeBtn = this.gameContainer.querySelector('#vpn-close-button');
        if (closeBtn) {
            this.addEventListener(closeBtn, 'click', () => this.complete(false));
        }

        this.gameContainer.querySelectorAll('[data-vpn-add-filter]').forEach((button) => {
            this.addEventListener(button, 'click', () => {
                const field = button.getAttribute('data-vpn-add-filter');
                const sourceId = button.getAttribute('data-vpn-source-id');
                const selectEl = sourceId ? this.gameContainer.querySelector(`#${sourceId}`) : null;
                if (!field || !selectEl) return;
                this.setFilter(field, selectEl.value);
            });
        });

        const userAddBtn = this.gameContainer.querySelector('#vpn-add-user-filter');
        if (userAddBtn) {
            this.addEventListener(userAddBtn, 'click', () => this.handleAddUserFilter());
        }

        const userInput = this.gameContainer.querySelector('#vpn-user-filter-input');
        if (userInput) {
            this.addEventListener(userInput, 'keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    this.handleAddUserFilter();
                }
            });
        }

        const clearAllBtn = this.gameContainer.querySelector('#vpn-clear-all');
        if (clearAllBtn) {
            this.addEventListener(clearAllBtn, 'click', () => this.clearAllFilters());
        }

        this.gameContainer.querySelectorAll('[data-vpn-remove-filter]').forEach((button) => {
            this.addEventListener(button, 'click', () => {
                const field = button.getAttribute('data-vpn-remove-filter');
                if (field) this.clearFilter(field);
            });
        });

        this.gameContainer.querySelectorAll('[data-vpn-entry-id]').forEach((row) => {
            this.addEventListener(row, 'click', () => {
                const entryId = row.getAttribute('data-vpn-entry-id');
                if (entryId) this.handleSelectEntry(entryId);
            });
        });

        const lookupBtn = this.gameContainer.querySelector('#vpn-lookup-ip');
        if (lookupBtn) {
            this.addEventListener(lookupBtn, 'click', () => this.handleLookupIp());
        }

        const historyBtn = this.gameContainer.querySelector('#vpn-check-history');
        if (historyBtn) {
            this.addEventListener(historyBtn, 'click', () => this.handleCheckUserHistory());
        }

        const flagBtn = this.gameContainer.querySelector('#vpn-flag-anomaly');
        if (flagBtn) {
            this.addEventListener(flagBtn, 'click', () => this.handleFlagAnomaly());
        }

        const confirmBtn = this.gameContainer.querySelector('#vpn-confirm-submit');
        if (confirmBtn) {
            this.addEventListener(confirmBtn, 'click', () => this.confirmFlagAnomaly());
        }

        const cancelConfirmBtn = this.gameContainer.querySelector('#vpn-confirm-cancel');
        if (cancelConfirmBtn) {
            this.addEventListener(cancelConfirmBtn, 'click', () => this.closeConfirmModal());
        }
    }

    renderFilterTokens() {
        return FILTER_ORDER
            .filter((field) => !!this.filters[field])
            .map((field) => `
                <button class="vpn-filter-token vpn-token-${field.toLowerCase()}" type="button" data-vpn-remove-filter="${field}">
                    ${escapeHtml(field)} = ${escapeHtml(this.filters[field])}  X
                </button>
            `)
            .join('');
    }

    renderRows() {
        const selectedEntry = this.getSelectedEntry();

        this.visibleEntryIds = new Set(
            this.entries
                .filter((entry) => this.matchesFilters(entry))
                .map((entry) => entry.id)
        );

        return this.entries.map((entry) => {
            const isVisible = this.visibleEntryIds.has(entry.id);
            const isSelected = selectedEntry && selectedEntry.id === entry.id;
            const rowClasses = [
                'vpn-log-row',
                isVisible ? 'is-visible' : 'is-filtered',
                isSelected ? 'is-selected' : '',
                (isVisible && this.visibleEntryIds.size <= 5) ? 'is-selectable' : ''
            ].filter(Boolean).join(' ');

            const isContractor = this.config.contractorAccounts.has(entry.user.toLowerCase());
            return `
                <div class="${rowClasses}" data-vpn-entry-id="${escapeHtml(entry.id)}">
                    <span>${escapeHtml(entry.timestamp)}</span>
                    <span>${escapeHtml(entry.user)}</span>
                    <span>${escapeHtml(entry.ip)}</span>
                    <span class="vpn-badge vpn-country-${escapeHtml(entry.country.toLowerCase())}">${escapeHtml(entry.country)}</span>
                    <span class="vpn-badge vpn-mfa-${escapeHtml(entry.mfa.toLowerCase())}">${escapeHtml(entry.mfa)}</span>
                    <span class="vpn-badge vpn-result-${escapeHtml(entry.result.toLowerCase())}">${escapeHtml(entry.result)}</span>
                    <span>${isContractor ? '<span class="vpn-badge vpn-contractor">CONTRACTOR</span>' : ''}</span>
                </div>
            `;
        }).join('');
    }

    renderThreatIntel(selectedEntry) {
        if (!selectedEntry) return '';
        if (!this.threatIntelDone) return '';

        const intel = this.config.threatIntel;

        return `
            <div class="vpn-side-panel">
                <h4>Threat Intelligence</h4>
                <div>IP: ${escapeHtml(intel.ip || selectedEntry.ip)}</div>
                <div>ASN: ${escapeHtml(intel.asn || 'Unknown')}</div>
                <div>Type: ${escapeHtml(intel.type || 'Unclassified')}</div>
                <div>Location: ${escapeHtml(intel.location || selectedEntry.country)}</div>
                <div>Last flagged: ${escapeHtml(intel.flagged || intel.lastFlagged || 'Unknown')}</div>
                <div class="vpn-known-bad">KNOWN BAD: ${intel.knownBad === false ? 'NO' : 'YES'}</div>
            </div>
        `;
    }

    renderHistoryBanner() {
        if (!this.historyFocusUser) return '';

        const analysis = this.config.impossibleTravel || {};
        const delta = analysis.deltaMinutes || 30;
        const distance = analysis.distanceKm || 2100;
        const from = analysis.from || 'London';
        const to = analysis.to || 'Bucharest';

        return `
            <div class="vpn-history-banner">
                IMPOSSIBLE TRAVEL DETECTED | Same user authenticated ${escapeHtml(String(delta))} minutes apart. Distance: ${escapeHtml(String(from))} -> ${escapeHtml(String(to))} ~= ${escapeHtml(String(distance))} km.
            </div>
        `;
    }

    renderSelectedPanel() {
        const selected = this.getSelectedEntry();
        if (!selected) {
            return '<div class="vpn-detail-empty">Select any visible row to inspect details.</div>';
        }

        return `
            <div class="vpn-detail-card">
                <h4>Entry Detail</h4>
                <div>Timestamp: ${escapeHtml(selected.timestamp)}</div>
                <div>User: ${escapeHtml(selected.user)}</div>
                <div>Source IP: ${escapeHtml(selected.ip)}</div>
                <div>Country: ${escapeHtml(selected.country)}</div>
                <div>MFA: ${escapeHtml(selected.mfa)}</div>
                <div>Result: ${escapeHtml(selected.result)}</div>
                <div class="vpn-detail-actions">
                    <button id="vpn-lookup-ip" type="button" class="vpn-action-btn">LOOK UP IP</button>
                    <button id="vpn-check-history" type="button" class="vpn-action-btn">CHECK USER HISTORY</button>
                    <button id="vpn-flag-anomaly" type="button" class="vpn-action-btn vpn-flag-btn">FLAG ANOMALY</button>
                </div>
            </div>
            ${this.renderThreatIntel(selected)}
        `;
    }

    renderConfirmModal() {
        const selected = this.getSelectedEntry();
        if (!selected) return '';

        return `
            <div class="vpn-confirm-overlay" id="vpn-confirm-overlay">
                <div class="vpn-confirm-modal">
                    <h4>CONFIRM ANOMALY REPORT</h4>
                    <p>User: ${escapeHtml(selected.user)}</p>
                    <p>Source IP: ${escapeHtml(selected.ip)} (${escapeHtml(selected.country)})</p>
                    <p>MFA: ${selected.mfa === 'NO' && this.config.contractorAccounts.has(selected.user.toLowerCase()) ? 'Not enforced for contractor accounts' : escapeHtml(selected.mfa)}</p>
                    <p>Finding: Unauthorised credential use - likely initial access vector.</p>
                    <div class="vpn-confirm-actions">
                        <button id="vpn-confirm-submit" type="button" class="vpn-action-btn vpn-confirm-submit">CONFIRM - SUBMIT FINDING</button>
                        <button id="vpn-confirm-cancel" type="button" class="vpn-action-btn">CANCEL</button>
                    </div>
                </div>
            </div>
        `;
    }

    render() {
        const activeFilterCount = Object.keys(this.filters).length;
        const commandText = buildCommand(this.filters, this.config.logFilePath);
        const rowsMarkup = this.renderRows();
        const visibleCount = this.visibleEntryIds.size;

        this.gameContainer.innerHTML = `
            <div class="vpn-panel">
                <div class="vpn-header">
                    <div>
                        <h2>${escapeHtml(this.config.consoleTitle)}</h2>
                        <div class="vpn-subtitle">${escapeHtml(this.config.consoleSubtitle)}</div>
                    </div>
                </div>

                <div class="vpn-body">
                    <aside class="vpn-filters">
                        <div class="vpn-filter-title">FILTER BUILDER</div>

                        <div class="vpn-filter-row">
                            <label>COUNTRY</label>
                            <select id="vpn-country-select">${COUNTRY_OPTIONS.map((value) => `<option value="${value}">${value}</option>`).join('')}</select>
                            <button type="button" data-vpn-add-filter="COUNTRY" data-vpn-source-id="vpn-country-select">ADD</button>
                        </div>

                        <div class="vpn-filter-row">
                            <label>MFA</label>
                            <select id="vpn-mfa-select">${MFA_OPTIONS.map((value) => `<option value="${value}">${value}</option>`).join('')}</select>
                            <button type="button" data-vpn-add-filter="MFA" data-vpn-source-id="vpn-mfa-select">ADD</button>
                        </div>

                        <div class="vpn-filter-row">
                            <label>RESULT</label>
                            <select id="vpn-result-select">${RESULT_OPTIONS.map((value) => `<option value="${value}">${value}</option>`).join('')}</select>
                            <button type="button" data-vpn-add-filter="RESULT" data-vpn-source-id="vpn-result-select">ADD</button>
                        </div>

                        <div class="vpn-filter-row">
                            <label>TIME</label>
                            <select id="vpn-time-select">${TIME_OPTIONS.map((value) => `<option value="${value}">${value}</option>`).join('')}</select>
                            <button type="button" data-vpn-add-filter="TIME" data-vpn-source-id="vpn-time-select">ADD</button>
                        </div>

                        <div class="vpn-filter-row vpn-filter-user">
                            <label>USER</label>
                            <input id="vpn-user-filter-input" type="text" placeholder="e.g. j.doe" />
                            <button id="vpn-add-user-filter" type="button">ADD</button>
                        </div>

                        <div class="vpn-token-list">
                            ${this.renderFilterTokens() || '<span class="vpn-token-empty">No active filters</span>'}
                        </div>

                        <button id="vpn-clear-all" type="button" class="vpn-clear-btn">CLEAR ALL FILTERS</button>

                        <div class="vpn-command-preview" title="This is the equivalent grep command for your filters.">
                            <div class="vpn-command-label">EQUIVALENT GREP COMMAND:</div>
                            <pre>${escapeHtml(commandText)}</pre>
                        </div>
                    </aside>

                    <section class="vpn-log-pane">
                        <div class="vpn-log-header">
                            <span>TIMESTAMP</span><span>USER</span><span>IP</span><span>COUNTRY</span><span>MFA</span><span>RESULT</span><span>ROLE</span>
                        </div>
                        <div class="vpn-log-scroll">${rowsMarkup}</div>
                        ${this.renderHistoryBanner()}
                        ${this.renderSelectedPanel()}
                    </section>
                </div>

                <div class="vpn-status-bar">${visibleCount} entries visible of ${this.entries.length} | ${activeFilterCount} filters active${visibleCount > 5 ? ' | Filter to 5 or fewer to select an entry' : ''}</div>
            </div>

            ${this.renderConfirmModal()}
        `;

        this.bindEvents();
    }
}
