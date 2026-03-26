import { MinigameScene } from '../framework/base-minigame.js';

const STATE_KEY = 'mg01_siem_state';

const SEVERITY_ORDER = {
    CRIT: 4,
    HIGH: 3,
    MED: 2,
    LOW: 1
};

function normalizeSeverity(severity) {
    const value = String(severity || '').toUpperCase();
    if (value === 'CRITICAL' || value === 'CRIT') return 'CRIT';
    if (value === 'HIGH') return 'HIGH';
    if (value === 'MEDIUM' || value === 'MED') return 'MED';
    return 'LOW';
}

function formatClock(date) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}

function formatTimer(totalSeconds) {
    const safeSeconds = Math.max(0, totalSeconds);
    const mm = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
    const ss = String(safeSeconds % 60).padStart(2, '0');
    return `${mm}:${ss}`;
}

function createSeededAlerts() {
    return [
        {
            id: 'ALRT-001',
            severity: 'CRIT',
            timestamp: '07:12:21',
            source: 'FINWKS-047',
            description: 'Encoded PowerShell execution chain detected',
            critical: true,
            status: 'pending'
        },
        {
            id: 'ALRT-002',
            severity: 'LOW',
            timestamp: '07:12:42',
            source: 'NETOPS-MIG',
            description: 'Expected VLAN migration route update applied',
            critical: false,
            status: 'pending'
        },
        {
            id: 'ALRT-003',
            severity: 'MED',
            timestamp: '07:13:15',
            source: 'BKP-SCH-02',
            description: 'Scheduled backup verification window started',
            critical: false,
            status: 'pending'
        },
        {
            id: 'ALRT-004',
            severity: 'LOW',
            timestamp: '07:13:38',
            source: 'SWITCH-W7',
            description: 'Legacy switch spanning-tree recalculation',
            critical: false,
            status: 'pending'
        },
        {
            id: 'ALRT-005',
            severity: 'CRIT',
            timestamp: '07:14:03',
            source: 'DC01',
            description: 'LSASS process memory access behavior flagged',
            critical: true,
            status: 'pending'
        },
        {
            id: 'ALRT-006',
            severity: 'MED',
            timestamp: '07:14:25',
            source: 'FW-CORE',
            description: 'Temporary migration allowlist entry consumed',
            critical: false,
            status: 'pending'
        },
        {
            id: 'ALRT-007',
            severity: 'LOW',
            timestamp: '07:14:54',
            source: 'VPN-GW',
            description: 'Known contractor access window opened',
            critical: false,
            status: 'pending'
        },
        {
            id: 'ALRT-008',
            severity: 'HIGH',
            timestamp: '07:15:16',
            source: 'FILE-SRV-03',
            description: 'Elevated SMB write activity during patch staging',
            critical: false,
            status: 'pending'
        },
        {
            id: 'ALRT-009',
            severity: 'LOW',
            timestamp: '07:15:44',
            source: 'NMS-POOL',
            description: 'Monitoring probe restart completed',
            critical: false,
            status: 'pending'
        },
        {
            id: 'ALRT-010',
            severity: 'MED',
            timestamp: '07:16:11',
            source: 'DNS-INFRA',
            description: 'Expected resolver policy sync from migration',
            critical: false,
            status: 'pending'
        },
        {
            id: 'ALRT-011',
            severity: 'LOW',
            timestamp: '07:16:39',
            source: 'NETOPS-MIG',
            description: 'Clinical subnet route verification succeeded',
            critical: false,
            status: 'pending'
        },
        {
            id: 'ALRT-012',
            severity: 'CRIT',
            timestamp: '07:17:02',
            source: 'SMB-AUDIT',
            description: 'Anomalous SMB write volume spike across DC shares',
            critical: true,
            status: 'pending'
        },
        {
            id: 'ALRT-013',
            severity: 'LOW',
            timestamp: '07:17:31',
            source: 'PATCH-ORCH',
            description: 'Planned update batch completed in enterprise zone',
            critical: false,
            status: 'pending'
        },
        {
            id: 'ALRT-014',
            severity: 'MED',
            timestamp: '07:17:57',
            source: 'ROUTER-EDGE',
            description: 'Perimeter route flap self-corrected',
            critical: false,
            status: 'pending'
        },
        {
            id: 'ALRT-015',
            severity: 'LOW',
            timestamp: '07:18:21',
            source: 'BKP-SCH-02',
            description: 'Backup retention policy check complete',
            critical: false,
            status: 'pending'
        },
        {
            id: 'ALRT-018',
            severity: 'CRIT',
            timestamp: '07:18:48',
            source: 'RDP-MON',
            description: 'Cross-zone RDP session from enterprise into clinical host',
            critical: true,
            status: 'pending'
        }
    ];
}

export class SiemDashboardMinigame extends MinigameScene {
    constructor(container, params = {}) {
        super(container, {
            ...params,
            title: 'SIEM Dashboard',
            showCancel: true,
            cancelText: 'Close Console'
        });

        this.timeLimitSec = Number(params.timeLimitSec) > 0 ? Number(params.timeLimitSec) : 180;
        this.remainingSec = this.timeLimitSec;
        this.alerts = createSeededAlerts();
        this.finished = false;
        this.isFinalized = false;
        this.ransomwareFlooded = false;
        this._tickerId = null;
        this._eventSubs = [];

        this.alertsListEl = null;
        this.queueListEl = null;
        this.queueCountEl = null;
        this.pendingCountEl = null;
        this.timerEl = null;
        this.systemClockEl = null;
        this.resultBannerEl = null;
        this.panelEl = null;
    }

    init() {
        super.init();

        if (this.headerElement) {
            this.headerElement.style.display = 'none';
        }

        this.container.classList.add('siem-minigame-container');
        this.gameContainer.classList.add('siem-minigame-game-container');

        this.restoreState();
        this.renderLayout();
        this.renderAll();
    }

    start() {
        super.start();

        this.startTickers();
        this.subscribeScenarioEvents();
    }

    complete(success) {
        if (!this.isFinalized) {
            this.persistState();
            if (window.MinigameFramework) {
                window.MinigameFramework.endMinigame(false, {
                    aborted: true,
                    minigameName: 'siem-dashboard'
                });
            }
            return;
        }

        super.complete(success);
    }

    cleanup() {
        if (this._tickerId) {
            clearInterval(this._tickerId);
            this._tickerId = null;
        }

        this.unsubscribeScenarioEvents();
        super.cleanup();
    }

    startTickers() {
        this.updateHeaderClock();
        this.updateStatusBar();

        this._tickerId = setInterval(() => {
            if (!this.finished) {
                this.remainingSec = Math.max(0, this.remainingSec - 1);
                this.updateStatusBar();

                if (this.remainingSec === 0) {
                    this.finalizeOutcome();
                }
            }

            this.updateHeaderClock();
        }, 1000);
    }

    subscribeScenarioEvents() {
        if (!window.eventDispatcher) return;

        const newAlertHandler = (payload) => {
            this.handleInjectedAlert(payload);
        };

        const ransomwareHandler = (payload) => {
            if (payload?.value === true) {
                this.injectRansomwareCriticalFlood();
            }
        };

        window.eventDispatcher.on('siem_new_alert', newAlertHandler);
        window.eventDispatcher.on('global_variable_changed:ransomware_deployed', ransomwareHandler);

        this._eventSubs.push({ event: 'siem_new_alert', handler: newAlertHandler });
        this._eventSubs.push({ event: 'global_variable_changed:ransomware_deployed', handler: ransomwareHandler });
    }

    unsubscribeScenarioEvents() {
        if (!window.eventDispatcher || !this._eventSubs.length) return;

        this._eventSubs.forEach((sub) => {
            window.eventDispatcher.off(sub.event, sub.handler);
        });

        this._eventSubs = [];
    }

    renderLayout() {
        this.gameContainer.innerHTML = `
            <div class="siem-panel" id="siem-panel">
                <div class="siem-result-banner" id="siem-result-banner"></div>
                <div class="siem-header">
                    <div class="siem-title">NORTHGATE TRUST // SIEM CONSOLE</div>
                    <div class="siem-clock" id="siem-system-clock">00:00:00</div>
                </div>
                <div class="siem-body">
                    <div class="siem-alert-pane">
                        <div class="siem-pane-title">ALERT STREAM</div>
                        <div class="siem-alert-list" id="siem-alert-list"></div>
                    </div>
                    <div class="siem-queue-pane">
                        <div class="siem-pane-title">ESCALATED FOR REVIEW</div>
                        <div class="siem-queue-count" id="siem-queue-count">0 alerts queued</div>
                        <div class="siem-queue-list" id="siem-queue-list"></div>
                    </div>
                </div>
                <div class="siem-status-bar">
                    <span id="siem-pending-count">ALERTS PENDING: 0</span>
                    <span id="siem-time-remaining">TIME REMAINING: 00:00</span>
                </div>
            </div>
        `;

        this.panelEl = this.gameContainer.querySelector('#siem-panel');
        this.alertsListEl = this.gameContainer.querySelector('#siem-alert-list');
        this.queueListEl = this.gameContainer.querySelector('#siem-queue-list');
        this.queueCountEl = this.gameContainer.querySelector('#siem-queue-count');
        this.pendingCountEl = this.gameContainer.querySelector('#siem-pending-count');
        this.timerEl = this.gameContainer.querySelector('#siem-time-remaining');
        this.systemClockEl = this.gameContainer.querySelector('#siem-system-clock');
        this.resultBannerEl = this.gameContainer.querySelector('#siem-result-banner');
    }

    renderAll() {
        this.renderAlerts();
        this.renderQueue();
        this.updateStatusBar();
    }

    renderAlerts() {
        if (!this.alertsListEl) return;

        this.alertsListEl.innerHTML = '';

        this.alerts.forEach((alert) => {
            const row = document.createElement('div');
            row.className = `siem-alert-row status-${alert.status}`;
            row.dataset.alertId = alert.id;

            const severity = document.createElement('span');
            severity.className = `siem-severity sev-${alert.severity}`;
            severity.textContent = alert.severity;

            const time = document.createElement('span');
            time.className = 'siem-time';
            time.textContent = alert.timestamp;

            const source = document.createElement('span');
            source.className = 'siem-source';
            source.textContent = alert.source;

            const description = document.createElement('span');
            description.className = 'siem-description';
            description.textContent = alert.description;

            const actions = document.createElement('span');
            actions.className = 'siem-actions';

            const dismissBtn = document.createElement('button');
            dismissBtn.className = 'siem-btn dismiss';
            dismissBtn.textContent = 'DISMISS';
            dismissBtn.disabled = alert.status !== 'pending' || this.finished;
            dismissBtn.addEventListener('click', () => this.handleAction(alert.id, 'dismissed'));

            const escalateBtn = document.createElement('button');
            escalateBtn.className = 'siem-btn escalate';
            escalateBtn.textContent = 'ESCALATE';
            escalateBtn.disabled = alert.status !== 'pending' || this.finished;
            escalateBtn.addEventListener('click', () => this.handleAction(alert.id, 'escalated'));

            actions.appendChild(dismissBtn);
            actions.appendChild(escalateBtn);

            row.appendChild(severity);
            row.appendChild(time);
            row.appendChild(source);
            row.appendChild(description);
            row.appendChild(actions);

            this.alertsListEl.appendChild(row);
        });
    }

    renderQueue() {
        if (!this.queueListEl || !this.queueCountEl) return;

        const escalated = this.alerts
            .filter((alert) => alert.status === 'escalated')
            .sort((a, b) => {
                const sevDelta = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
                if (sevDelta !== 0) return sevDelta;
                return a.timestamp.localeCompare(b.timestamp);
            });

        this.queueListEl.innerHTML = '';

        escalated.forEach((alert) => {
            const item = document.createElement('div');
            item.className = 'siem-queue-item';
            item.innerHTML = `
                <span class="siem-queue-sev sev-${alert.severity}">${alert.severity}</span>
                <span class="siem-queue-text">${alert.source} - ${alert.description}</span>
            `;
            this.queueListEl.appendChild(item);
        });

        this.queueCountEl.textContent = `${escalated.length} alerts queued`;
    }

    updateStatusBar() {
        if (this.pendingCountEl) {
            const pending = this.alerts.filter((alert) => alert.status === 'pending').length;
            this.pendingCountEl.textContent = `ALERTS PENDING: ${pending}`;
        }

        if (this.timerEl) {
            this.timerEl.textContent = `TIME REMAINING: ${formatTimer(this.remainingSec)}`;
        }
    }

    updateHeaderClock() {
        if (this.systemClockEl) {
            this.systemClockEl.textContent = formatClock(new Date());
        }
    }

    handleAction(alertId, newStatus) {
        if (this.finished) return;

        const alert = this.alerts.find((entry) => entry.id === alertId);
        if (!alert || alert.status !== 'pending') return;

        alert.status = newStatus;

        this.renderAll();
        this.persistState();

        const allCriticalHandled = this.alerts
            .filter((entry) => entry.critical)
            .every((entry) => entry.status !== 'pending');

        if (allCriticalHandled) {
            this.finalizeOutcome();
        }
    }

    handleInjectedAlert(payload = {}) {
        if (this.finished) return;

        const severity = normalizeSeverity(payload.severity);
        const now = new Date();
        const alert = {
            id: payload.id || `ALRT-EXT-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
            severity,
            timestamp: formatClock(now),
            source: payload.source || 'SIEM-CORE',
            description: payload.description || 'External alert injected into SIEM stream',
            critical: severity === 'CRIT',
            status: 'pending'
        };

        this.alerts.unshift(alert);
        this.renderAll();
        this.persistState();
    }

    injectRansomwareCriticalFlood() {
        if (this.ransomwareFlooded || this.finished) return;

        this.ransomwareFlooded = true;
        if (this.panelEl) {
            this.panelEl.classList.add('ransomware-pulse');
        }

        const criticalAlerts = [
            {
                severity: 'CRIT',
                source: 'EHR-CORE',
                description: 'Ransomware encryption behavior detected in clinical data plane'
            },
            {
                severity: 'CRIT',
                source: 'AD-MONITOR',
                description: 'Mass credential abuse and privilege escalation chain observed'
            },
            {
                severity: 'CRIT',
                source: 'FW-CORE',
                description: 'Lateral movement burst crossing enterprise and clinical segments'
            }
        ];

        criticalAlerts.forEach((entry) => this.handleInjectedAlert(entry));
    }

    finalizeOutcome() {
        if (this.finished) return;

        this.finished = true;

        const criticalAlerts = this.alerts.filter((entry) => entry.critical);
        const criticalEscalated = criticalAlerts.filter((entry) => entry.status === 'escalated').length;
        const success = criticalEscalated === criticalAlerts.length && criticalAlerts.length > 0;

        this.isFinalized = true;

        if (success) {
            this.setScenarioGlobal('siem_escalated', true);
            this.setScenarioGlobal('siem_missed_alerts', false);
            this.showResultBanner('INCIDENT TEAM NOTIFIED', true);
        } else {
            this.setScenarioGlobal('siem_escalated', false);
            this.setScenarioGlobal('siem_missed_alerts', true);
            this.showResultBanner('CRITICAL ALERTS MISSED - INCIDENT ESCALATED', false);
        }

        this.gameResult = {
            success,
            escalated: this.alerts.filter((entry) => entry.status === 'escalated').map((entry) => entry.id),
            dismissed: this.alerts.filter((entry) => entry.status === 'dismissed').map((entry) => entry.id),
            missedCritical: criticalAlerts.filter((entry) => entry.status !== 'escalated').map((entry) => entry.id)
        };

        if (window.eventDispatcher) {
            window.eventDispatcher.emit('siem_triage_completed', this.gameResult);
        }

        this.clearState();
        this.renderAll();

        setTimeout(() => {
            super.complete(success);
        }, 1300);
    }

    showResultBanner(message, success) {
        if (!this.resultBannerEl) return;

        this.resultBannerEl.textContent = message;
        this.resultBannerEl.classList.remove('success', 'failure', 'show');
        this.resultBannerEl.classList.add(success ? 'success' : 'failure');

        requestAnimationFrame(() => {
            this.resultBannerEl.classList.add('show');
        });
    }

    setScenarioGlobal(name, value) {
        if (window.npcManager?.setGlobalVariable) {
            window.npcManager.setGlobalVariable(name, value);
            return;
        }

        if (!window.gameState) {
            window.gameState = {};
        }
        if (!window.gameState.globalVariables) {
            window.gameState.globalVariables = {};
        }

        const oldValue = window.gameState.globalVariables[name];
        window.gameState.globalVariables[name] = value;

        if (window.eventDispatcher) {
            window.eventDispatcher.emit(`global_variable_changed:${name}`, {
                name,
                value,
                oldValue
            });
        }
    }

    persistState() {
        if (!window.gameState) window.gameState = {};
        if (!window.gameState.globalVariables) window.gameState.globalVariables = {};

        window.gameState.globalVariables[STATE_KEY] = {
            remainingSec: this.remainingSec,
            alerts: this.alerts.map((entry) => ({
                id: entry.id,
                severity: entry.severity,
                timestamp: entry.timestamp,
                source: entry.source,
                description: entry.description,
                critical: entry.critical,
                status: entry.status
            })),
            ransomwareFlooded: this.ransomwareFlooded
        };
    }

    restoreState() {
        const persisted = window.gameState?.globalVariables?.[STATE_KEY];
        if (!persisted) return;

        if (Array.isArray(persisted.alerts) && persisted.alerts.length > 0) {
            this.alerts = persisted.alerts.map((entry) => ({
                ...entry,
                severity: normalizeSeverity(entry.severity),
                status: entry.status || 'pending',
                critical: entry.critical === true
            }));
        }

        if (typeof persisted.remainingSec === 'number') {
            this.remainingSec = Math.max(0, Math.floor(persisted.remainingSec));
        }

        this.ransomwareFlooded = persisted.ransomwareFlooded === true;
    }

    clearState() {
        if (window.gameState?.globalVariables) {
            delete window.gameState.globalVariables[STATE_KEY];
        }
    }
}
