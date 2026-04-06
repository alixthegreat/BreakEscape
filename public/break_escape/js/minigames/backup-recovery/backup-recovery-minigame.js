import { MinigameScene } from '../framework/base-minigame.js';

const DEFAULT_SOURCES = [
    {
        id: 'nas_encrypted',
        name: 'NAS Appliance',
        status: 'ENCRYPTED',
        etaLabel: 'Not recoverable',
        marker: 'X',
        statusTone: 'danger',
        bannerTone: 'danger',
        bannerText: 'WARNING: THIS SOURCE IS COMPROMISED',
        icon: '[NAS]',
        bullets: [
            'Data integrity risk: ENCRYPTED - not recoverable without decryption key.',
            'Estimated restore time: no reliable NAS recovery path.',
            'Malware reintroduction risk: source is compromised.',
            'Operational impact during the wait: EHR recovery delayed; manual clinical operations continue.'
        ]
    },
    {
        id: 'tape_wiped',
        name: 'Tape Library',
        status: 'CATALOGUE WIPED',
        etaLabel: '3-5 days estimate',
        marker: 'X',
        statusTone: 'danger',
        bannerTone: 'danger',
        bannerText: 'WARNING: THIS SOURCE IS COMPROMISED',
        icon: '[TAPE]',
        bullets: [
            'Data integrity risk: CATALOGUE WIPED - tapes intact but unindexed.',
            'Estimated restore time: 3-5 days minimum.',
            'Malware reintroduction risk: source integrity cannot be guaranteed.',
            'Operational impact during the wait: prolonged manual clinical operations.'
        ]
    },
    {
        id: 'cloud_vendor',
        name: 'Vendor Cloud Backup',
        status: 'AVAILABLE',
        etaLabel: 'ETA: 18 HOURS',
        marker: '!',
        statusTone: 'success',
        bannerTone: 'warning',
        bannerText: 'CAUTION: 18-HOUR RESTORATION WINDOW - MANUAL CLINICAL OPERATIONS REQUIRED',
        icon: '[CLOUD]',
        bullets: [
            'Data integrity risk: AVAILABLE vendor cloud backup (EHR only).',
            'Estimated restore time: ETA 18 HOURS.',
            'Malware reintroduction risk: restoring to an un-isolated network may reintroduce the attacker.',
            'Operational impact during the wait: manual clinical operations required.'
        ]
    }
];

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

export class BackupRecoveryMinigame extends MinigameScene {
    constructor(container, params) {
        params = params || {};
        params.title = params.title || 'Backup Recovery Console';
        params.showCancel = true;
        params.cancelText = params.cancelText || 'Close Console';

        super(container, params);

        this.sources = [];
        this.selectedSourceId = null;
        this.lockedSourceId = null;
        this.choiceLocked = false;
        this.isSubmitting = false;
    }

    init() {
        super.init();

        this.container.className += ' backup-recovery-minigame-container';
        this.gameContainer.className += ' backup-recovery-game-container';
        this.headerElement.style.display = 'none';

        this.sources = this.resolveSources();
        this.lockedSourceId = window.gameState?.globalVariables?.backup_recovery_source || null;
        this.choiceLocked = !!this.lockedSourceId || window.gameState?.globalVariables?.backup_restore_initiated === true;

        if (this.lockedSourceId && this.sources.some((source) => source.id === this.lockedSourceId)) {
            this.selectedSourceId = this.lockedSourceId;
        }

        this.render();
    }

    start() {
        super.start();

        const tileButtons = this.gameContainer.querySelectorAll('.backup-recovery-tile');
        tileButtons.forEach((btn) => {
            this.addEventListener(btn, 'click', () => {
                const sourceId = btn.getAttribute('data-source-id');
                this.handleSelect(sourceId);
            });
        });

        const confirmBtn = this.gameContainer.querySelector('#backup-recovery-confirm');
        if (confirmBtn) {
            this.addEventListener(confirmBtn, 'click', () => {
                this.handleConfirm();
            });
        }

        this.updateUI();
    }

    resolveSources() {
        const objectData = this.params?.lockable?.scenarioData || {};
        const configuredSources = this.params?.sources
            || objectData.backupRecoverySources
            || objectData.backup_recovery_sources
            || objectData.recoverySources;

        if (!Array.isArray(configuredSources) || configuredSources.length === 0) {
            return DEFAULT_SOURCES;
        }

        const byId = new Map(DEFAULT_SOURCES.map((source) => [source.id, source]));
        const normalized = configuredSources
            .filter((entry) => entry && typeof entry.id === 'string')
            .map((entry) => {
                const base = byId.get(entry.id) || {};
                return {
                    ...base,
                    ...entry,
                    bullets: Array.isArray(entry.bullets) && entry.bullets.length > 0
                        ? entry.bullets
                        : (Array.isArray(base.bullets) ? base.bullets : [])
                };
            });

        return normalized.length > 0 ? normalized : DEFAULT_SOURCES;
    }

    getSelectedSource() {
        return this.sources.find((source) => source.id === this.selectedSourceId) || null;
    }

    handleSelect(sourceId) {
        if (this.isSubmitting) {
            return;
        }

        if (!this.sources.some((source) => source.id === sourceId)) {
            return;
        }

        this.selectedSourceId = sourceId;
        this.updateUI();
    }

    handleConfirm() {
        if (this.isSubmitting) {
            return;
        }

        if (this.choiceLocked) {
            const lockedSource = this.sources.find((source) => source.id === this.lockedSourceId) || null;
            const lockedLabel = lockedSource?.name || this.lockedSourceId || 'previously selected source';
            if (window.gameAlert) {
                window.gameAlert(
                    `Restore decision already locked to ${lockedLabel}.`,
                    'info',
                    'Decision Locked In',
                    3000
                );
            }
            return;
        }

        const source = this.getSelectedSource();
        if (!source) {
            return;
        }

        this.isSubmitting = true;
        this.updateUI();

        const result = this.commitSelection(source);
        this.gameResult = result;

        if (window.playUISound) {
            window.playUISound('confirm');
        }

        setTimeout(() => {
            this.complete(true);
        }, 250);
    }

    commitSelection(source) {
        // Write in strict order so listeners triggered by backup_restore_initiated
        // can safely read source and ETA values.
        this.setGlobalAndNotify('backup_recovery_source', source.id);

        if (source.id === 'cloud_vendor') {
            this.setGlobalAndNotify('recovery_eta_hours', 18);
        }

        this.setGlobalAndNotify('backup_restore_initiated', true);

        return {
            selectedSource: source.id,
            backupRestoreInitiated: true,
            recoveryEtaHours: source.id === 'cloud_vendor' ? 18 : null
        };
    }

    setGlobalAndNotify(varName, value) {
        if (!window.gameState) {
            window.gameState = {};
        }

        if (!window.gameState.globalVariables) {
            window.gameState.globalVariables = {};
        }

        if (window.npcManager && typeof window.npcManager.setGlobalVariable === 'function') {
            window.npcManager.setGlobalVariable(varName, value);
            return;
        }

        const oldValue = window.gameState.globalVariables[varName];
        window.gameState.globalVariables[varName] = value;

        if (window.npcConversationStateManager) {
            window.npcConversationStateManager.broadcastGlobalVariableChange(varName, value, null);
        }

        if (window.eventDispatcher) {
            window.eventDispatcher.emit(`global_variable_changed:${varName}`, {
                name: varName,
                value: value,
                oldValue: oldValue
            });
        }
    }

    getPanelMarkup(source) {
        if (!source) {
            return {
                header: 'CONSEQUENCE ASSESSMENT - SELECT SOURCE',
                banner: 'Select a recovery source to assess risk and operational impact.',
                bannerTone: 'neutral',
                bullets: [
                    'Data integrity risk varies by backup source.',
                    'Estimated restore time determines the duration of paper operations.',
                    'Malware reintroduction risk depends on source integrity and network isolation.',
                    'Operational impact during the wait must be managed across clinical workflows.'
                ]
            };
        }

        return {
            header: `CONSEQUENCE ASSESSMENT - ${source.name.toUpperCase()}`,
            banner: source.bannerText,
            bannerTone: source.bannerTone || 'neutral',
            bullets: source.bullets || []
        };
    }

    updateUI() {
        const selected = this.getSelectedSource();

        const tileButtons = this.gameContainer.querySelectorAll('.backup-recovery-tile');
        tileButtons.forEach((btn) => {
            const sourceId = btn.getAttribute('data-source-id');
            const isSelected = selected && selected.id === sourceId;
            btn.classList.toggle('is-selected', !!isSelected);
            btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        });

        const panel = this.getPanelMarkup(selected);
        const headerEl = this.gameContainer.querySelector('#backup-recovery-panel-header');
        const bannerEl = this.gameContainer.querySelector('#backup-recovery-panel-banner');
        const bulletsEl = this.gameContainer.querySelector('#backup-recovery-panel-bullets');

        if (headerEl) {
            headerEl.textContent = panel.header;
        }

        if (bannerEl) {
            bannerEl.textContent = panel.banner;
            bannerEl.classList.remove('is-danger', 'is-warning', 'is-neutral');
            const toneClass = panel.bannerTone === 'danger'
                ? 'is-danger'
                : panel.bannerTone === 'warning'
                    ? 'is-warning'
                    : 'is-neutral';
            bannerEl.classList.add(toneClass);
        }

        if (bulletsEl) {
            bulletsEl.innerHTML = panel.bullets
                .map((line) => `<li>${escapeHtml(line)}</li>`)
                .join('');
        }

        const confirmBtn = this.gameContainer.querySelector('#backup-recovery-confirm');
        if (confirmBtn) {
            const baseLabel = selected
                ? `CONFIRM RESTORE FROM ${selected.name.toUpperCase()}`
                : 'CONFIRM RESTORE FROM THIS SOURCE';
            if (this.choiceLocked) {
                const lockedSource = this.sources.find((source) => source.id === this.lockedSourceId) || null;
                const lockedLabel = (lockedSource?.name || this.lockedSourceId || 'EXISTING SOURCE').toUpperCase();
                confirmBtn.textContent = `DECISION LOCKED: ${lockedLabel}`;
                confirmBtn.disabled = true;
            } else {
                confirmBtn.textContent = this.isSubmitting ? 'CONFIRMING...' : baseLabel;
                confirmBtn.disabled = this.isSubmitting || !selected;
            }
        }
    }

    render() {
        const tiles = this.sources.map((source) => {
            const markerClass = source.marker === 'X'
                ? 'is-danger'
                : 'is-warning';
            const statusClass = source.statusTone === 'success'
                ? 'is-success'
                : source.statusTone === 'warning'
                    ? 'is-warning'
                    : 'is-danger';

            return `
                <button type="button" class="backup-recovery-tile" data-source-id="${escapeHtml(source.id)}" aria-pressed="false">
                    <div class="backup-recovery-tile-top">
                        <span class="backup-recovery-icon">${escapeHtml(source.icon || '[SRC]')}</span>
                        <span class="backup-recovery-marker ${markerClass}">${escapeHtml(source.marker || '!')}</span>
                    </div>
                    <div class="backup-recovery-source-name">${escapeHtml(source.name)}</div>
                    <div class="backup-recovery-status-badge ${statusClass}">${escapeHtml(source.status || 'UNKNOWN')}</div>
                    <div class="backup-recovery-eta">${escapeHtml(source.etaLabel || '')}</div>
                </button>
            `;
        }).join('');

        this.gameContainer.innerHTML = `
            <div class="backup-recovery-shell">
                <div class="backup-recovery-header">NORTHGATE TRUST // BACKUP RECOVERY CONSOLE</div>

                <div class="backup-recovery-tiles" role="list">
                    ${tiles}
                </div>

                <div class="backup-recovery-panel">
                    <div id="backup-recovery-panel-header" class="backup-recovery-panel-header"></div>
                    <div id="backup-recovery-panel-banner" class="backup-recovery-panel-banner"></div>
                    <ul id="backup-recovery-panel-bullets" class="backup-recovery-panel-bullets"></ul>
                </div>

                <div class="backup-recovery-actions">
                    <button type="button" id="backup-recovery-confirm" class="backup-recovery-confirm-btn" disabled>
                        CONFIRM RESTORE FROM THIS SOURCE
                    </button>
                </div>
            </div>
        `;
    }
}