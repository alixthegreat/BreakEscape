import { MinigameScene } from '../framework/base-minigame.js';
import { applyActions } from '../../systems/apply-actions.js';

export class EsdPushbuttonMinigame extends MinigameScene {
    constructor(container, params) {
        params = params || {};
        params.title = params.title || 'Emergency Shutdown Control';
        params.showCancel = true;
        params.cancelText = params.cancelText || 'Cancel';

        super(container, params);

        this.state = 'ARMED_GUARD_DOWN';
        this.guardElement = null;
        this.buttonElement = null;
        this.confirmModal = null;
        this.confirmButton = null;
        this.cancelButton = null;
        this.statusElement = null;
        this.ledElement = null;
        this.lockable = params.lockable || null;
        this.authorizationGranted = false;
        this.alreadyActivated = false;
    }

    init() {
        super.init();

        this.container.className += ' esd-pushbutton-minigame-container';
        this.gameContainer.className += ' esd-pushbutton-game-container';
        this.headerElement.style.display = 'none';

        const globals = window.gameState?.globalVariables || {};
        this.authorizationGranted = globals.marcus_webb_contacted === true;
        this.alreadyActivated = globals.esd_activated === true;

        this.render();
        this.applyInitialState();
    }

    start() {
        super.start();

        if (this.guardElement) {
            this.addEventListener(this.guardElement, 'click', () => {
                this.handleGuardFlip();
            });
        }

        if (this.buttonElement) {
            this.addEventListener(this.buttonElement, 'click', () => {
                this.handleButtonPress();
            });
        }

        if (this.confirmButton) {
            this.addEventListener(this.confirmButton, 'click', () => {
                this.handleConfirm();
            });
        }

        if (this.cancelButton) {
            this.addEventListener(this.cancelButton, 'click', () => {
                this.hideConfirmModal();
            });
        }
    }

    render() {
        this.gameContainer.innerHTML = `
            <div class="esd-panel">
                <div class="esd-label">EMERGENCY SHUTDOWN - RACKS A1-A4</div>
                <div class="esd-housing">
                    <div class="esd-guard" id="esd-guard" aria-label="Safety Guard"></div>
                    <button class="esd-button" id="esd-button" aria-label="ESD Button" disabled></button>
                    <div class="esd-led" id="esd-led" aria-label="Status LED"></div>
                </div>
                <div class="esd-status" id="esd-status">Flip guard to arm ESD control.</div>
            </div>
            <div class="esd-confirm-modal" id="esd-confirm-modal" aria-hidden="true">
                <div class="esd-confirm-card">
                    <h3>CONFIRM EMERGENCY SHUTDOWN?</h3>
                    <p>Initiate hardwired shutdown for Battery Racks A1-A4.</p>
                    <p>This action is irreversible without manual reset.</p>
                    <div class="esd-confirm-actions">
                        <button class="esd-confirm" id="esd-confirm">CONFIRM - INITIATE SHUTDOWN</button>
                        <button class="esd-cancel" id="esd-cancel">CANCEL</button>
                    </div>
                </div>
            </div>
        `;

        this.guardElement = this.gameContainer.querySelector('#esd-guard');
        this.buttonElement = this.gameContainer.querySelector('#esd-button');
        this.confirmModal = this.gameContainer.querySelector('#esd-confirm-modal');
        this.confirmButton = this.gameContainer.querySelector('#esd-confirm');
        this.cancelButton = this.gameContainer.querySelector('#esd-cancel');
        this.statusElement = this.gameContainer.querySelector('#esd-status');
        this.ledElement = this.gameContainer.querySelector('#esd-led');
    }

    applyInitialState() {
        if (this.alreadyActivated) {
            this.state = 'ACTIVATED';
            this.guardElement.classList.add('open');
            this.buttonElement.classList.add('pressed');
            this.buttonElement.setAttribute('disabled', 'true');
            this.ledElement.classList.add('active');
            this.statusElement.textContent = 'Emergency shutdown already active. Racks A1-A4 are isolated.';
            return;
        }

        if (!this.authorizationGranted) {
            this.statusElement.textContent = 'Authorisation required. Contact Marcus Webb before pressing ESD.';
            this.guardElement.classList.add('disabled');
            this.buttonElement.setAttribute('disabled', 'true');
        }
    }

    handleGuardFlip() {
        if (!this.authorizationGranted || this.alreadyActivated) {
            return;
        }

        if (this.state === 'CONFIRM_MODAL' || this.state === 'ACTIVATED') {
            return;
        }

        if (this.state === 'ARMED_GUARD_DOWN') {
            this.state = 'GUARD_OPEN';
            this.guardElement.classList.add('open');
            this.buttonElement.removeAttribute('disabled');
            this.statusElement.textContent = 'Guard open. Press button to continue.';
        } else if (this.state === 'GUARD_OPEN') {
            this.state = 'ARMED_GUARD_DOWN';
            this.guardElement.classList.remove('open');
            this.buttonElement.setAttribute('disabled', 'true');
            this.statusElement.textContent = 'Guard closed. Flip guard to arm ESD control.';
        }

        if (window.playUISound) {
            window.playUISound('lock');
        }
    }

    handleButtonPress() {
        if (!this.authorizationGranted || this.alreadyActivated) {
            return;
        }

        if (this.state !== 'GUARD_OPEN') {
            return;
        }

        this.state = 'CONFIRM_MODAL';
        this.confirmModal.classList.add('active');
        this.confirmModal.setAttribute('aria-hidden', 'false');
    }

    hideConfirmModal() {
        this.state = 'GUARD_OPEN';
        this.confirmModal.classList.remove('active');
        this.confirmModal.setAttribute('aria-hidden', 'true');
    }

    handleConfirm() {
        if (!this.authorizationGranted || this.alreadyActivated) {
            return;
        }

        if (this.state !== 'CONFIRM_MODAL') {
            return;
        }

        this.state = 'ACTIVATED';
        this.confirmModal.classList.remove('active');
        this.confirmModal.setAttribute('aria-hidden', 'true');

        this.buttonElement.classList.add('pressed');
        this.buttonElement.setAttribute('disabled', 'true');
        this.guardElement.classList.add('open');
        this.ledElement.classList.add('active');
        this.statusElement.textContent = 'ISOLATED - COOLING ACTIVE';

        this.applyEsdOutcome();

        this.gameResult = {
            esdActivated: true,
            action: 'esd_confirmed'
        };

        setTimeout(() => {
            this.complete(true);
        }, 300);
    }

    applyEsdOutcome() {
        applyActions([
            { type: 'set_global', key: 'esd_activated', value: true },
            { type: 'complete_task', taskId: 'press_esd_button' }
        ], { source: 'esd_minigame' });

        if (this.lockable?.scenarioData) {
            this.lockable.scenarioData.locked = false;
            this.lockable.scenarioData.esdState = 'activated';
        }

        const objectId = this.lockable?.scenarioData?.id || this.lockable?.objectId || 'esd_pushbutton';

        applyActions([
            { type: 'unlock_object', objectId }
        ], {
            source: 'esd_minigame',
            gameId: window.breakEscapeConfig?.gameId || window.gameConfig?.gameId
        });

        if (window.gameState) {
            window.gameState.unlockedObjects = window.gameState.unlockedObjects || [];
            if (objectId && !window.gameState.unlockedObjects.includes(objectId)) {
                window.gameState.unlockedObjects.push(objectId);
            }
        }

        if (window.eventDispatcher) {
            window.eventDispatcher.emit('item_unlocked', {
                itemId: objectId,
                itemType: this.lockable?.scenarioData?.type,
                itemName: this.lockable?.scenarioData?.name,
                lockType: this.lockable?.scenarioData?.lockType || 'esd_button'
            });
        }

        if (window.playUISound) {
            window.playUISound('confirm');
            window.playUISound('success');
        }
    }
}
