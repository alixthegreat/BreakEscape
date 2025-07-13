// Base class for minigame scenes
export class MinigameScene {
    constructor(container, params) {
        this.container = container;
        this.params = params;
        this.gameState = {
            isActive: false,
            mouseDown: false,
            currentTool: null
        };
        this.gameResult = null;
        this._eventListeners = [];
    }
    
    init() {
        this.container.innerHTML = `
            <button class="minigame-close-button" id="minigame-close">&times;</button>
            <div class="minigame-header">
                <h3>${this.params.title || 'Minigame'}</h3>
            </div>
            <div class="minigame-game-container"></div>
            <div class="minigame-message-container"></div>
            <div class="minigame-controls">
                <button class="minigame-button" id="minigame-cancel">Cancel</button>
            </div>
        `;
        
        this.headerElement = this.container.querySelector('.minigame-header');
        this.gameContainer = this.container.querySelector('.minigame-game-container');
        this.messageContainer = this.container.querySelector('.minigame-message-container');
        this.controlsElement = this.container.querySelector('.minigame-controls');
        
        // Set up close button
        const closeBtn = document.getElementById('minigame-close');
        this.addEventListener(closeBtn, 'click', () => {
            this.complete(false);
        });
        
        // Set up cancel button
        const cancelBtn = document.getElementById('minigame-cancel');
        this.addEventListener(cancelBtn, 'click', () => {
            this.complete(false);
        });
    }
    
    start() {
        this.gameState.isActive = true;
        console.log("Minigame started");
    }
    
    complete(success) {
        this.gameState.isActive = false;
        if (window.MinigameFramework) {
            window.MinigameFramework.endMinigame(success, this.gameResult);
        }
    }
    
    addEventListener(element, eventType, handler) {
        element.addEventListener(eventType, handler);
        this._eventListeners.push({ element, eventType, handler });
    }
    
    showSuccess(message, autoClose = true, duration = 2000) {
        const messageElement = document.createElement('div');
        messageElement.className = 'minigame-success-message';
        messageElement.innerHTML = message;
        
        this.messageContainer.appendChild(messageElement);
        
        if (autoClose) {
            setTimeout(() => {
                this.complete(true);
            }, duration);
        }
    }
    
    showFailure(message, autoClose = true, duration = 2000) {
        const messageElement = document.createElement('div');
        messageElement.className = 'minigame-failure-message';
        messageElement.innerHTML = message;
        
        this.messageContainer.appendChild(messageElement);
        
        if (autoClose) {
            setTimeout(() => {
                this.complete(false);
            }, duration);
        }
    }
    
    updateProgress(current, total) {
        const progressBar = this.container.querySelector('.minigame-progress-bar');
        if (progressBar) {
            const percentage = (current / total) * 100;
            progressBar.style.width = `${percentage}%`;
        }
    }
    
    cleanup() {
        this._eventListeners.forEach(({ element, eventType, handler }) => {
            element.removeEventListener(eventType, handler);
        });
        this._eventListeners = [];
    }
} 