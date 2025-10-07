// Game constants
export const TILE_SIZE = 32;
export const DOOR_ALIGN_OVERLAP = 32 * 3;
export const GRID_SIZE = 32;
export const MOVEMENT_SPEED = 150;
export const ARRIVAL_THRESHOLD = 8;
export const PATH_UPDATE_INTERVAL = 500;
export const STUCK_THRESHOLD = 1;
export const STUCK_TIME = 500;
export const INVENTORY_X_OFFSET = 50;
export const INVENTORY_Y_OFFSET = 50;
export const CLICK_INDICATOR_DURATION = 800; // milliseconds
export const CLICK_INDICATOR_SIZE = 20; // pixels
export const PLAYER_FEET_OFFSET_Y = 30; // Adjust based on your sprite's feet position (64px sprite)

// Room visibility settings
export const HIDE_ROOMS_INITIALLY = true;
export const HIDE_ROOMS_ON_EXIT = false;
export const HIDE_NON_ADJACENT_ROOMS = false;

// Interaction constants
export const INTERACTION_CHECK_INTERVAL = 100; // Only check interactions every 100ms
export const INTERACTION_RANGE = 2 * TILE_SIZE;
export const INTERACTION_RANGE_SQ = INTERACTION_RANGE * INTERACTION_RANGE;
export const ROOM_CHECK_THRESHOLD = 32; // Only check for room changes when player moves this many pixels

// Bluetooth constants
export const BLUETOOTH_SCAN_RANGE = TILE_SIZE * 2; // 2 tiles range for Bluetooth scanning
export const BLUETOOTH_SCAN_INTERVAL = 200; // Scan every 200ms for more responsive updates

// Game configuration
export const GAME_CONFIG = {
    type: Phaser.AUTO,
    width: (window.innerWidth * 0.80) / 2,  // Divide by 4 for 4x scale
    height: (window.innerHeight * 0.80) / 2,  // Divide by 4 for 4x scale
    parent: 'game-container',
    pixelArt: true,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    render: {
        pixelArt: true,
        antialias: false,
        roundPixels: true
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: true
        }
    }
}; 