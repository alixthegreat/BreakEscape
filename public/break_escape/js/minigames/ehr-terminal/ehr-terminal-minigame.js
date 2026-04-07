import { MinigameScene } from '../framework/base-minigame.js';

const DEFAULT_OFFLINE_MESSAGE = [
    'SYSTEM UNAVAILABLE',
    '',
    'Electronic Health Record service is unreachable.',
    'Network connectivity to EHR server: FAILED',
    '',
    'Do not attempt to prescribe from memory.',
    'Use paper MAR charts from the desk drawer.',
    '',
    'Contact IT Security if this persists.'
].join('\n');

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function setGlobalAndNotify(varName, value) {
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
            value,
            oldValue
        });
    }
}

export class EhrTerminalMinigame extends MinigameScene {
    constructor(container, params = {}) {
        super(container, {
            ...params,
            title: params.title || 'EHR Prescribing Terminal',
            showCancel: true,
            cancelText: params.cancelText || 'Close Terminal'
        });

        this.lockable = params.lockable || null;
        this.ehrStatus = (params.ehrStatus || window.gameState?.globalVariables?.ehr_status || 'offline').toLowerCase();
        this.offlineMessage = params.customMessage || this.lockable?.scenarioData?.customMessage || DEFAULT_OFFLINE_MESSAGE;
    }

    init() {
        super.init();

        this.container.className += ' ehr-terminal-minigame-container';
        this.gameContainer.className += ' ehr-terminal-minigame-game-container';
        this.headerElement.style.display = 'none';

        this.render();
    }

    start() {
        super.start();

        // Draft behavior: mark offline terminal viewed when opened.
        setGlobalAndNotify('ehr_terminal_viewed_offline', true);

        const acknowledgeButton = this.gameContainer.querySelector('#ehr-terminal-acknowledge');
        if (acknowledgeButton) {
            this.addEventListener(acknowledgeButton, 'click', () => {
                this.complete(false);
            });
        }
    }

    render() {
        const isOnline = this.ehrStatus === 'online';
        const badgeText = isOnline ? '[ONLINE]' : '[OFFLINE]';
        const badgeClass = isOnline ? 'online' : 'offline';
        const safeMessage = escapeHtml(this.offlineMessage);
        const bodyMarkup = isOnline
            ? `
                <div class="ehr-terminal-online-icon" aria-hidden="true">i</div>
                <div class="ehr-terminal-online-title">EHR CONNECTION ACTIVE</div>
                <pre class="ehr-terminal-online-message">Patient record browsing is not available in the draft build.

This preview confirms ehr_status is currently set to online.</pre>
                <button id="ehr-terminal-acknowledge" class="ehr-terminal-button" type="button">[CLOSE TERMINAL]</button>
            `
            : `
                <div class="ehr-terminal-offline-icon" aria-hidden="true">!</div>
                <pre class="ehr-terminal-message">${safeMessage}</pre>
                <button id="ehr-terminal-acknowledge" class="ehr-terminal-button" type="button">[UNDERSTOOD]</button>
            `;

        this.gameContainer.innerHTML = `
            <div class="ehr-terminal-panel">
                <div class="ehr-terminal-header">
                    <span class="ehr-terminal-title">NORTHGATE TRUST EHR - PRESCRIBING MODULE</span>
                    <span class="ehr-terminal-status ${badgeClass}">${badgeText}</span>
                </div>

                <div class="ehr-terminal-content">
                    ${bodyMarkup}
                </div>
            </div>
        `;
    }
}
