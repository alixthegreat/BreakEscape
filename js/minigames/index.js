// Export minigame framework
export { MinigameFramework } from './framework/minigame-manager.js';
export { MinigameScene } from './framework/base-minigame.js';

// Export minigame implementations
export { LockpickingMinigamePhaser } from './lockpicking/lockpicking-game-phaser.js';
export { DustingMinigame } from './dusting/dusting-game.js';

// Initialize the global minigame framework for backward compatibility
import { MinigameFramework } from './framework/minigame-manager.js';
import { LockpickingMinigamePhaser } from './lockpicking/lockpicking-game-phaser.js';

// Make the framework available globally 
window.MinigameFramework = MinigameFramework;

// Import the dusting minigame
import { DustingMinigame } from './dusting/dusting-game.js';

// Register minigames
MinigameFramework.registerScene('lockpicking', LockpickingMinigamePhaser); // Use Phaser version as default
MinigameFramework.registerScene('lockpicking-phaser', LockpickingMinigamePhaser); // Keep explicit phaser name
MinigameFramework.registerScene('dusting', DustingMinigame); 