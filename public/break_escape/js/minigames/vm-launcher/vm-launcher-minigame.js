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
        this.vm = params.vm || null;
        this.hacktivityMode = params.hacktivityMode || false;
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
        
        if (!this.vm) {
            launcher.innerHTML = this.buildNoVmMessage();
        } else {
            launcher.innerHTML = this.buildVmDisplay();
        }
        
        this.gameContainer.appendChild(launcher);
        this.attachEventHandlers();
    }
    
    buildNoVmMessage() {
        if (this.hacktivityMode) {
            return `
                <div class="no-vms-message">
                    <h4>No VM Available</h4>
                    <p>No virtual machine is configured for this terminal.</p>
                    <p>Please provision VMs through Hacktivity first.</p>
                </div>
            `;
        } else {
            return `
                <div class="no-vms-message standalone-mode">
                    <h2>VM Terminal</h2>
                    <p>You've discovered a computer terminal in the game. To interact with it, you need to launch the virtual machine on your local system.</p>

                </div>
            `;
        }
    }
    
    buildVmDisplay() {
        const hasConsole = this.vm.enable_console !== false;
        const statusClass = hasConsole ? 'console' : 'online';
        const statusText = hasConsole ? 'Console' : 'Active';
        let html = `<p>You've discovered a computer terminal in the game. To interact with it, `

        if (this.hacktivityMode) {
            html += `
                click the console button, and follow the instructions.</p>
            `;
        } else {
            html += `
                you need to launch the virtual machine on your local system.</p>
            `;
        }
        
        html += `

            <div class="vm-card">
                <div class="vm-header">
                    <span class="vm-title">${this.escapeHtml(this.vm.title)}</span>
                    <span class="vm-status ${statusClass}">${statusText}</span>
                </div>
                <div class="vm-details">
                    ${this.vm.ip ? `<span><span class="vm-detail-label">IP:</span> <span class="vm-ip">${this.escapeHtml(this.vm.ip)}</span></span>` : ''}
                </div>
            </div>
        `;
        
        if (this.hacktivityMode) {
            html += `
                <div class="vm-actions">
                    <button class="vm-action-btn" id="launch-console-btn">
                        Open Console: ${this.escapeHtml(this.vm.title)}
                    </button>
                </div>
                <div class="launch-status" id="launch-status"></div>
            `;
        }
        
        return html;
    }
    

    
    attachEventHandlers() {
        // Launch button (Hacktivity mode only)
        const launchBtn = this.gameContainer.querySelector('#launch-console-btn');
        if (launchBtn) {
            this.addEventListener(launchBtn, 'click', () => this.launchConsole());
        }
    }
    
    async launchConsole() {
        if (!this.vm || this.isLaunching) return;
        
        this.isLaunching = true;
        const launchBtn = this.gameContainer.querySelector('#launch-console-btn');
        const statusEl = this.gameContainer.querySelector('#launch-status');
        const vmCard = this.gameContainer.querySelector('.vm-card');
        
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
                    this.vm.id,
                    this.vm.event_id
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
            launchBtn.textContent = `Open Console: ${this.vm.title}`;
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
        console.log('[VmLauncher] Started with VM:', this.vm?.title || 'None');
    }
}

// Register with MinigameFramework
if (window.MinigameFramework) {
    window.MinigameFramework.registerMinigame('vm-launcher', VmLauncherMinigame);
}

export default VmLauncherMinigame;

