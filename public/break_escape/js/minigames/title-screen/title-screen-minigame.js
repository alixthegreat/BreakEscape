import { MinigameScene } from '../framework/base-minigame.js';

// Load title screen CSS
const titleScreenCSS = document.createElement('link');
titleScreenCSS.rel = 'stylesheet';
titleScreenCSS.href = '/break_escape/css/title-screen.css';
titleScreenCSS.id = 'title-screen-css';
if (!document.getElementById('title-screen-css')) {
    document.head.appendChild(titleScreenCSS);
}

/**
 * Title Screen Minigame
 * Displays a simple "BreakEscape" title screen before the main game loads.
 * Auto-closes when the next minigame (e.g., mission brief, dialog) loads.
 */
export class TitleScreenMinigame extends MinigameScene {
    constructor(container, params) {
        super(container, params);
        this.autoCloseTimeout = params?.autoCloseTimeout ?? 3000; // 0 = wait for game_loaded; positive = fixed timer
    }
    
    init() {
        // Override parent init to customize the title screen
        // We don't want the default minigame container structure
        
        this.container.innerHTML = `
            <div class="title-screen-container">
                <img src="/break_escape/assets/logos/hacktivity-logo.svg" alt="Hacktivity Logo" class="title-screen-logo">
                <div class="title-screen-title">BreakEscape</div>
            </div>
        `;
        
        this.container.style.cssText = `
            width: 100%;
            height: 100%;
            position: fixed;
            top: 0;
            left: 0;
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
            background: #1a1a1a;
            margin: 0;
            padding: 0;
        `;
        
        // Store reference to elements
        this.titleScreenContainer = this.container.querySelector('.title-screen-container');
    }
    
    start() {
        // Call parent start
        super.start();

        console.log('🎬 Title Screen started');

        if (this.autoCloseTimeout) {
            // Positive timeout: auto-close after that many ms regardless of loading state.
            this.autoCloseTimer = setTimeout(() => {
                console.log('⏱️ Title screen auto-closing after timeout');
                this.complete(true);
            }, this.autoCloseTimeout);
        } else {
            // autoCloseTimeout === 0: loading-cover mode.
            // Wait for the game_loaded event (fired at the end of create() once the
            // game world is fully initialised), then close if nothing else has taken over.
            this._onGameLoaded = () => {
                window.eventDispatcher?.off('game_loaded', this._onGameLoaded);
                this._onGameLoaded = null;
                console.log('🎬 Title screen: game_loaded received, closing');
                if (window.MinigameFramework?.currentMinigame === this) {
                    this.complete(true);
                }
            };
            if (window.eventDispatcher) {
                window.eventDispatcher.on('game_loaded', this._onGameLoaded);
            } else {
                // Fallback if eventDispatcher isn't ready yet (shouldn't happen — title screen
                // is started after eventDispatcher is created in main.js).
                console.warn('🎬 Title screen: eventDispatcher not ready, closing will be handled by game.js');
            }
        }
    }
    
    /**
     * Override complete to ensure proper cleanup
     */
    complete(success) {
        console.log('🎬 Title screen closing');
        
        // Clear the auto-close timer
        if (this.autoCloseTimer) {
            clearTimeout(this.autoCloseTimer);
        }
        
        // Call parent complete which handles cleanup
        super.complete(success);
    }
    
    /**
     * Override cleanup to ensure container is removed properly
     */
    cleanup() {
        if (this.autoCloseTimer) {
            clearTimeout(this.autoCloseTimer);
        }
        if (this._onGameLoaded) {
            window.eventDispatcher?.off('game_loaded', this._onGameLoaded);
            this._onGameLoaded = null;
        }
        super.cleanup();
    }
}

/**
 * Helper function to start the title screen minigame
 */
export function startTitleScreenMinigame(params = {}) {
    if (!window.MinigameFramework) {
        console.error('MinigameFramework not initialized');
        return;
    }
    
    // Create a container for the title screen as a centered overlay
    const container = document.createElement('div');
    container.className = 'minigame-container';
    container.style.cssText = `
        width: 100%;
        height: 100%;
        position: fixed;
        top: 0;
        left: 0;
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        background: rgba(26, 26, 26, 0.95);
    `;
    document.body.appendChild(container);
    
    // Start the title screen minigame
    return window.MinigameFramework.startMinigame('title-screen', container, {
        title: 'BreakEscape',
        hideGameDuringMinigame: false,
        showCancel: false,
        headerElement: null,
        disableGameInput: true,
        ...params
    });
}
