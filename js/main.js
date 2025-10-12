import { GAME_CONFIG } from './utils/constants.js?v=7';
import { preload, create, update } from './core/game.js?v=32';
import { initializeNotifications } from './systems/notifications.js?v=7';
// Bluetooth scanner is now handled as a minigame
// Biometrics is now handled as a minigame
import { startLockpickingMinigame } from './systems/minigame-starters.js?v=1';
import { initializeDebugSystem } from './systems/debug.js?v=7';
import { initializeUI } from './ui/panels.js?v=9';
import { initializeModals } from './ui/modals.js?v=7';

// Import minigame framework
import './minigames/index.js';

// Global game variables
window.game = null;
window.gameScenario = null;
window.player = null;
window.cursors = null;
window.rooms = {};
window.currentRoom = null;
window.inventory = {
    items: [],
    container: null
};
window.objectsGroup = null;
window.wallsLayer = null;
window.discoveredRooms = new Set();
window.pathfinder = null;
window.currentPath = [];
window.isMoving = false;
window.targetPoint = null;
window.lastPathUpdateTime = 0;
window.stuckTimer = 0;
window.lastPosition = null;
window.stuckTime = 0;
window.currentPlayerRoom = null;
window.lastPlayerPosition = { x: 0, y: 0 };
window.gameState = {
    biometricSamples: [],
    biometricUnlocks: [],
    bluetoothDevices: [],
    notes: [],
    startTime: null
};
window.lastBluetoothScan = 0;

// Initialize the game
function initializeGame() {
    // Set up game configuration with scene functions
    const config = {
        ...GAME_CONFIG,
        scene: {
            preload: preload,
            create: create,
            update: update
        },
        inventory: {
            items: [],
            display: null
        }
    };

    // Create the Phaser game instance
    window.game = new Phaser.Game(config);

    // Initialize all systems
    initializeNotifications();
    // Bluetooth scanner and biometrics are now handled as minigames
    
    // Make lockpicking function available globally
    window.startLockpickingMinigame = startLockpickingMinigame;
    
    initializeDebugSystem();
    initializeUI();
    initializeModals();

    // Add window resize handler
    window.addEventListener('resize', () => {
        const width = window.innerWidth * 0.80;
        const height = window.innerHeight * 0.80;
        game.scale.resize(width, height);
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeGame);

// Export for global access
window.initializeGame = initializeGame; 