// Export minigame framework
export { MinigameFramework } from './framework/minigame-manager.js';
export { MinigameScene } from './framework/base-minigame.js';

// Export minigame implementations
export { LockpickingMinigame } from './lockpicking/lockpicking-game.js';
export { DustingMinigame } from './dusting/dusting-game.js';

// Initialize the global minigame framework for backward compatibility
import { MinigameFramework } from './framework/minigame-manager.js';
import { LockpickingMinigame } from './lockpicking/lockpicking-game.js';

// Make the framework available globally 
window.MinigameFramework = MinigameFramework;

// Import the dusting minigame
import { DustingMinigame } from './dusting/dusting-game.js';

// Register minigames
MinigameFramework.registerScene('lockpicking', LockpickingMinigame);
MinigameFramework.registerScene('dusting', DustingMinigame); 