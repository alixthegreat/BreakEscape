import { MinigameScene } from './base-minigame.js';

// Minigame Framework Manager
export const MinigameFramework = {
    mainGameScene: null,
    currentMinigame: null,
    registeredScenes: {},
    MinigameScene: MinigameScene, // Export the base class
    
    init(gameScene) {
        this.mainGameScene = gameScene;
        console.log("MinigameFramework initialized");
    },
    
    startMinigame(sceneType, params) {
        if (!this.registeredScenes[sceneType]) {
            console.error(`Minigame scene '${sceneType}' not registered`);
            return;
        }
        
        // Disable main game input
        if (this.mainGameScene) {
            this.mainGameScene.input.mouse.enabled = false;
            this.mainGameScene.input.keyboard.enabled = false;
        }
        
        // Create minigame container
        const container = document.createElement('div');
        container.className = 'minigame-container';
        document.body.appendChild(container);
        
        // Create and start the minigame
        const MinigameClass = this.registeredScenes[sceneType];
        this.currentMinigame = new MinigameClass(container, params);
        this.currentMinigame.init();
        this.currentMinigame.start();
        
        console.log(`Started minigame: ${sceneType}`);
    },
    
    endMinigame(success, result) {
        if (this.currentMinigame) {
            this.currentMinigame.cleanup();
            
            // Remove minigame container
            const container = document.querySelector('.minigame-container');
            if (container) {
                container.remove();
            }
            
            // Re-enable main game input
            if (this.mainGameScene) {
                this.mainGameScene.input.mouse.enabled = true;
                this.mainGameScene.input.keyboard.enabled = true;
            }
            
            // Call completion callback
            if (this.currentMinigame.params.onComplete) {
                this.currentMinigame.params.onComplete(success, result);
            }
            
            this.currentMinigame = null;
            console.log(`Ended minigame with success: ${success}`);
        }
    },
    
    registerScene(sceneType, SceneClass) {
        this.registeredScenes[sceneType] = SceneClass;
        console.log(`Registered minigame scene: ${sceneType}`);
    }
}; 