/**
 * VM Launcher Minigame
 * 
 * Displays available VMs and allows launching console connections.
 * Works in two modes:
 * - Hacktivity mode: Downloads SPICE console files via ActionCable
 * - Standalone mode: Shows VirtualBox instructions
 */

import { MinigameScene } from '../framework/base-minigame.js';

export class VmLauncherMinigame extends MinigameScene {
    constructor(container, params) {
        super(container, params);
        this.vms = params.vms || [];
        this.hacktivityMode = params.hacktivityMode || false;
        this.selectedVm = null;
        this.isLaunching = false;
    }
    
    init() {
        this.params.title = this.params.title || 'VM Console Access';
        this.params.cancelText = 'Close';
        super.init();
        this.buildUI();
    }
    
    buildUI() {
        // Add custom styles
        const style = document.createElement('style');
        style.textContent = `
            .vm-launcher {
                padding: 15px;
                font-family: 'VT323', 'Courier New', monospace;
                max-height: 400px;
                overflow-y: auto;
            }
            
            .vm-launcher-description {
                color: #888;
                margin-bottom: 15px;
                font-size: 14px;
                line-height: 1.4;
            }
            
            .vm-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            
            .vm-card {
                background: #1a1a1a;
                border: 2px solid #333;
                padding: 15px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .vm-card:hover {
                border-color: #00ff00;
                background: #1f1f1f;
            }
            
            .vm-card.selected {
                border-color: #00ff00;
                background: rgba(0, 255, 0, 0.1);
            }
            
            .vm-card.launching {
                opacity: 0.7;
                cursor: wait;
            }
            
            .vm-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            
            .vm-title {
                color: #00ff00;
                font-size: 16px;
                font-weight: bold;
            }
            
            .vm-status {
                font-size: 12px;
                padding: 3px 8px;
                border-radius: 0;
            }
            
            .vm-status.online {
                background: #00aa00;
                color: #000;
            }
            
            .vm-status.offline {
                background: #aa0000;
                color: #fff;
            }
            
            .vm-status.console {
                background: #0088ff;
                color: #fff;
            }
            
            .vm-details {
                display: flex;
                gap: 20px;
                font-size: 14px;
                color: #aaa;
            }
            
            .vm-detail-label {
                color: #666;
            }
            
            .vm-ip {
                font-family: 'Courier New', monospace;
                color: #ffaa00;
            }
            
            .vm-actions {
                margin-top: 15px;
                display: flex;
                gap: 10px;
                justify-content: center;
            }
            
            .vm-action-btn {
                background: #00aa00;
                color: #fff;
                border: 2px solid #000;
                padding: 10px 20px;
                font-family: 'Press Start 2P', monospace;
                font-size: 12px;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .vm-action-btn:hover:not(:disabled) {
                background: #00cc00;
            }
            
            .vm-action-btn:disabled {
                background: #333;
                color: #666;
                cursor: not-allowed;
            }
            
            .vm-action-btn.launching {
                background: #666;
            }
            
            .launch-status {
                text-align: center;
                padding: 10px;
                margin-top: 10px;
                font-size: 14px;
            }
            
            .launch-status.success {
                color: #00ff00;
            }
            
            .launch-status.error {
                color: #ff4444;
            }
            
            .launch-status.loading {
                color: #ffaa00;
            }
            
            .no-vms-message {
                text-align: center;
                padding: 40px;
                color: #888;
            }
            
            .no-vms-message h4 {
                color: #ffaa00;
                margin-bottom: 15px;
            }
            
            .standalone-instructions {
                background: #1a1a1a;
                border: 1px solid #333;
                padding: 15px;
                margin-top: 15px;
                font-size: 13px;
                line-height: 1.6;
            }
            
            .standalone-instructions h4 {
                color: #00ff00;
                margin-top: 0;
                margin-bottom: 10px;
            }
            
            .standalone-instructions code {
                background: #000;
                padding: 2px 6px;
                color: #ffaa00;
            }
            
            .vm-names {
                display: flex;
                gap: 15px;
                justify-content: center;
                margin: 20px 0;
            }

            .vm-name-badge {
                background: #00aa00;
                color: #000;
                padding: 12px 24px;
                font-weight: bold;
                font-size: 16px;
                border: 2px solid #000;
                font-family: 'Courier New', monospace;
            }

            .standalone-instructions h3 {
                color: #00ff00;
                margin-top: 0;
            }

            .standalone-instructions ol {
                margin: 0;
                padding-left: 20px;
            }
            
            .standalone-instructions li {
                margin: 8px 0;
                color: #ccc;
            }
        `;
        this.gameContainer.appendChild(style);
        
        // Build main container
        const launcher = document.createElement('div');
        launcher.className = 'vm-launcher';
        
        if (this.vms.length === 0) {
            launcher.innerHTML = this.buildNoVmsMessage();
        } else {
            launcher.innerHTML = this.buildVmList();
        }
        
        this.gameContainer.appendChild(launcher);
        this.attachEventHandlers();
    }
    
    buildNoVmsMessage() {
        if (this.hacktivityMode) {
            return `
                <div class="no-vms-message">
                    <h4>No VMs Available</h4>
                    <p>No virtual machines are configured for this mission.</p>
                    <p>Please provision VMs through Hacktivity first.</p>
                </div>
            `;
        } else {
            return `
                <div class="no-vms-message standalone-mode">
                    <h2>VM Terminal</h2>
                    <p>You've discovered a computer terminal in the game. To interact with it, you need to launch the virtual machines on your local system.</p>
                    ${this.buildStandaloneInstructions()}
                </div>
            `;
        }
    }
    
    buildVmList() {
        const description = this.hacktivityMode 
            ? 'Select a VM to open its console. A SPICE viewer file will be downloaded.'
            : 'These VMs are available for this mission.';
        
        let html = `
            <p class="vm-launcher-description">${description}</p>
            <div class="vm-list">
        `;
        
        for (const vm of this.vms) {
            const hasConsole = vm.enable_console !== false;
            const statusClass = hasConsole ? 'console' : 'online';
            const statusText = hasConsole ? 'Console' : 'Active';
            
            html += `
                <div class="vm-card" data-vm-id="${vm.id}">
                    <div class="vm-header">
                        <span class="vm-title">${this.escapeHtml(vm.title)}</span>
                        <span class="vm-status ${statusClass}">${statusText}</span>
                    </div>
                    <div class="vm-details">
                        ${vm.ip ? `<span><span class="vm-detail-label">IP:</span> <span class="vm-ip">${this.escapeHtml(vm.ip)}</span></span>` : ''}
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        
        if (this.hacktivityMode) {
            html += `
                <div class="vm-actions">
                    <button class="vm-action-btn" id="launch-console-btn" disabled>
                        Select a VM
                    </button>
                </div>
                <div class="launch-status" id="launch-status"></div>
            `;
        } else {
            html += this.buildStandaloneInstructions();
        }
        
        return html;
    }
    
    buildStandaloneInstructions() {
        return `
            <div class="standalone-instructions">
                <h3>Load These VMs in VirtualBox:</h3>
                <div class="vm-names">
                    <div class="vm-name-badge">kali</div>
                    <div class="vm-name-badge">desktop</div>
                </div>
                <ol>
                    <li>Open VirtualBox on your local machine</li>
                    <li>Import the <strong>kali</strong> and <strong>desktop</strong> VMs (.ova files)</li>
                    <li>Start both VMs and wait for them to boot</li>
                    <li>Note their IP addresses</li>
                    <li>Return to this game to complete the mission</li>
                </ol>
            </div>
        `;
    }
    
    attachEventHandlers() {
        // VM card selection
        const vmCards = this.gameContainer.querySelectorAll('.vm-card');
        vmCards.forEach(card => {
            this.addEventListener(card, 'click', () => this.selectVm(card));
        });
        
        // Launch button (Hacktivity mode only)
        const launchBtn = this.gameContainer.querySelector('#launch-console-btn');
        if (launchBtn) {
            this.addEventListener(launchBtn, 'click', () => this.launchConsole());
        }
    }
    
    selectVm(card) {
        if (this.isLaunching) return;
        
        // Clear previous selection
        this.gameContainer.querySelectorAll('.vm-card').forEach(c => {
            c.classList.remove('selected');
        });
        
        // Select new card
        card.classList.add('selected');
        this.selectedVm = this.vms.find(vm => vm.id == card.dataset.vmId);
        
        // Update launch button
        const launchBtn = this.gameContainer.querySelector('#launch-console-btn');
        if (launchBtn && this.selectedVm) {
            launchBtn.disabled = false;
            launchBtn.textContent = `Open Console: ${this.selectedVm.title}`;
        }
    }
    
    async launchConsole() {
        if (!this.selectedVm || this.isLaunching) return;
        
        this.isLaunching = true;
        const launchBtn = this.gameContainer.querySelector('#launch-console-btn');
        const statusEl = this.gameContainer.querySelector('#launch-status');
        const vmCard = this.gameContainer.querySelector(`[data-vm-id="${this.selectedVm.id}"]`);
        
        launchBtn.disabled = true;
        launchBtn.classList.add('launching');
        launchBtn.textContent = 'Connecting...';
        vmCard.classList.add('launching');
        statusEl.className = 'launch-status loading';
        statusEl.textContent = 'Requesting console file...';
        
        try {
            if (window.hacktivityCable) {
                // Use ActionCable integration
                const result = await window.hacktivityCable.requestConsoleFile(
                    this.selectedVm.id,
                    this.selectedVm.event_id
                );
                
                if (result.success) {
                    window.hacktivityCable.downloadConsoleFile({
                        filename: result.filename,
                        content: result.content,
                        contentType: result.contentType
                    });
                    
                    statusEl.className = 'launch-status success';
                    statusEl.textContent = '✓ Console file downloaded! Open it with a SPICE viewer.';
                }
            } else {
                throw new Error('ActionCable not available');
            }
        } catch (error) {
            console.error('[VmLauncher] Launch failed:', error);
            statusEl.className = 'launch-status error';
            statusEl.textContent = `✗ Failed: ${error.message}`;
        } finally {
            this.isLaunching = false;
            launchBtn.disabled = false;
            launchBtn.classList.remove('launching');
            launchBtn.textContent = `Open Console: ${this.selectedVm.title}`;
            vmCard.classList.remove('launching');
        }
    }
    
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    
    start() {
        super.start();
        console.log('[VmLauncher] Started with', this.vms.length, 'VMs');
    }
}

// Register with MinigameFramework
if (window.MinigameFramework) {
    window.MinigameFramework.registerMinigame('vm-launcher', VmLauncherMinigame);
}

export default VmLauncherMinigame;

