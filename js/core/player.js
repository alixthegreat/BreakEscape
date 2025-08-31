// Player System
// Handles player creation, movement, and animation

// Player management system
import { 
    MOVEMENT_SPEED, 
    ARRIVAL_THRESHOLD, 
    PLAYER_FEET_OFFSET_Y, 
    ROOM_CHECK_THRESHOLD, 
    CLICK_INDICATOR_SIZE,
    CLICK_INDICATOR_DURATION
} from '../utils/constants.js?v=7';

export let player = null;
export let targetPoint = null;
export let isMoving = false;
export let lastPlayerPosition = { x: 0, y: 0 };
let gameRef = null;

// Create player sprite
export function createPlayer(gameInstance) {
    gameRef = gameInstance;
    console.log('Creating player');
    
    // Get starting room position and calculate center
    const scenario = window.gameScenario;
    const startRoomId = scenario ? scenario.startRoom : 'reception';
    const startRoomPosition = getStartingRoomCenter(startRoomId);
    
    // Create player sprite (using frame 20 like original)
    player = gameInstance.add.sprite(startRoomPosition.x, startRoomPosition.y, 'hacker', 20);
    gameInstance.physics.add.existing(player);
    
    // Scale the character up by 25% like original
    player.setScale(1.25);
    
    // Set smaller collision box at the feet like original
    player.body.setSize(15, 10);
    player.body.setOffset(25, 50); // Adjusted offset to account for scaling
    
    player.body.setCollideWorldBounds(true);
    player.body.setBounce(0);
    player.body.setDrag(0);
    player.body.setFriction(0);
    
    // Set initial player depth (will be updated dynamically during movement)
    updatePlayerDepth(startRoomPosition.x, startRoomPosition.y);
    
    // Track player direction and movement state
    player.direction = 'down'; // Initial direction
    player.isMoving = false;
    player.lastDirection = 'down';
    
    // Create animations
    createPlayerAnimations();
    
    // Set initial animation
    player.anims.play('idle-down', true);
    
    // Initialize last position
    lastPlayerPosition = { x: player.x, y: player.y };
    
    // Store player globally immediately for safety
    window.player = player;
    
    return player;
}

function createPlayerAnimations() {
    // Create walking animations with correct frame numbers from original
    gameRef.anims.create({
        key: 'walk-right',
        frames: gameRef.anims.generateFrameNumbers('hacker', { start: 1, end: 4 }),
        frameRate: 8,
        repeat: -1
    });
    
    gameRef.anims.create({
        key: 'walk-down',
        frames: gameRef.anims.generateFrameNumbers('hacker', { start: 6, end: 9 }),
        frameRate: 8,
        repeat: -1
    });
    
    gameRef.anims.create({
        key: 'walk-up',
        frames: gameRef.anims.generateFrameNumbers('hacker', { start: 11, end: 14 }),
        frameRate: 8,
        repeat: -1
    });
    
    gameRef.anims.create({
        key: 'walk-up-right',
        frames: gameRef.anims.generateFrameNumbers('hacker', { start: 16, end: 19 }),
        frameRate: 8,
        repeat: -1
    });
    
    gameRef.anims.create({
        key: 'walk-down-right',
        frames: gameRef.anims.generateFrameNumbers('hacker', { start: 21, end: 24 }),
        frameRate: 8,
        repeat: -1
    });
    
    // Create idle frames (first frame of each row) with correct frame numbers
    gameRef.anims.create({
        key: 'idle-right',
        frames: [{ key: 'hacker', frame: 0 }],
        frameRate: 1
    });
    
    gameRef.anims.create({
        key: 'idle-down',
        frames: [{ key: 'hacker', frame: 5 }],
        frameRate: 1
    });
    
    gameRef.anims.create({
        key: 'idle-up',
        frames: [{ key: 'hacker', frame: 10 }],
        frameRate: 1
    });
    
    gameRef.anims.create({
        key: 'idle-up-right',
        frames: [{ key: 'hacker', frame: 15 }],
        frameRate: 1
    });
    
    gameRef.anims.create({
        key: 'idle-down-right',
        frames: [{ key: 'hacker', frame: 20 }],
        frameRate: 1
    });
}

export function movePlayerToPoint(x, y) {
    const worldBounds = gameRef.physics.world.bounds;
    
    // Ensure coordinates are within bounds
    x = Phaser.Math.Clamp(x, worldBounds.x, worldBounds.x + worldBounds.width);
    y = Phaser.Math.Clamp(y, worldBounds.y, worldBounds.y + worldBounds.height);
    
    // Create click indicator
    createClickIndicator(x, y);
    
    targetPoint = { x, y };
    isMoving = true;
}

function updatePlayerDepth(x, y) {
    // Calculate dynamic depth based on Y position
    // This creates the effect where player appears behind objects when north of them
    // and in front when south of them
    
    // Get the bottom of the player sprite (feet position)
    // Since player origin is at center, bottom is y + half the scaled height
    const playerBottomY = y + (player.height * player.scaleY) / 2;
    
    // Calculate room depth based on player position with finer granularity
    // Use 50-pixel boundaries instead of 100 for smoother depth transitions
    const roomDepth = Math.floor(playerBottomY / 50) * 50;
    
    // Player should use the same depth calculation as objects for proper layering
    // This allows player and objects to layer relative to each other based on Y position
    const playerDepth = roomDepth + 500; // Same as objects - above all room layers
    
    // Set the player depth (always update, no threshold)
    if (player) {
        player.setDepth(playerDepth);
        
        // Debug logging - only show when depth actually changes significantly
        const lastDepth = player.lastDepth || 0;
        if (Math.abs(playerDepth - lastDepth) > 25) { // Reduced threshold for finer granularity
            console.log(`Player depth: ${playerDepth} (Y: ${y}, BottomY: ${playerBottomY}, RoomDepth: ${roomDepth})`);
            console.log(`  Player uses same depth calculation as objects: roomDepth + 500`);
            console.log(`  Room layer depths: floor=${roomDepth + 100}, collision=${roomDepth + 150}, walls=${roomDepth + 200}, props=${roomDepth + 300}, other=${roomDepth + 400}`);
            player.lastDepth = playerDepth;
        }
    }
}

function createClickIndicator(x, y) {
    // Create a circle at the click position
    const indicator = gameRef.add.circle(x, y, CLICK_INDICATOR_SIZE, 0xffffff, 0.7);
    indicator.setDepth(1000); // Above ground but below player
    
    // Add a pulsing animation
    gameRef.tweens.add({
        targets: indicator,
        scale: { from: 0.5, to: 1.5 },
        alpha: { from: 0.7, to: 0 },
        duration: CLICK_INDICATOR_DURATION,
        ease: 'Sine.easeOut',
        onComplete: () => {
            indicator.destroy();
        }
    });
}

export function updatePlayerMovement() {
    // Safety check: ensure player exists
    if (!player || !player.body) {
        return;
    }
    
    if (!isMoving || !targetPoint) {
        if (player.body.velocity.x !== 0 || player.body.velocity.y !== 0) {
            player.body.setVelocity(0, 0);
            player.isMoving = false;
            
            // Play idle animation based on last direction
            player.anims.play(`idle-${player.direction}`, true);
        }
        return;
    }

    // Cache player position - adjust for feet position
    const px = player.x;
    const py = player.y + PLAYER_FEET_OFFSET_Y; // Add offset to target the feet
    
    // Update player depth based on actual player position (not feet-adjusted)
    updatePlayerDepth(px, player.y);
    
    // Use squared distance for performance
    const dx = targetPoint.x - px;
    const dy = targetPoint.y - py; // Compare with feet position
    const distanceSq = dx * dx + dy * dy;

    // Reached target point
    if (distanceSq < ARRIVAL_THRESHOLD * ARRIVAL_THRESHOLD) {
        isMoving = false;
        player.body.setVelocity(0, 0);
        player.isMoving = false;
        
        // Play idle animation based on last direction
        player.anims.play(`idle-${player.direction}`, true);
        return;
    }

    // Update last player position for depth calculations
    lastPlayerPosition.x = px;
    lastPlayerPosition.y = py - PLAYER_FEET_OFFSET_Y; // Store actual player position

    // Normalize movement vector for consistent speed
    const distance = Math.sqrt(distanceSq);
    const velocityX = (dx / distance) * MOVEMENT_SPEED;
    const velocityY = (dy / distance) * MOVEMENT_SPEED;

    // Set velocity directly without checking for changes
    player.body.setVelocity(velocityX, velocityY);
    
    // Determine direction based on velocity
    const absVX = Math.abs(velocityX);
    const absVY = Math.abs(velocityY);
    
    // Set player direction and animation
    if (absVX > absVY * 2) {
        // Mostly horizontal movement
        player.direction = velocityX > 0 ? 'right' : 'right'; // Use right animation but flip
        player.setFlipX(velocityX < 0); // Flip sprite horizontally if moving left
    } else if (absVY > absVX * 2) {
        // Mostly vertical movement
        player.direction = velocityY > 0 ? 'down' : 'up';
        player.setFlipX(false);
    } else {
        // Diagonal movement
        if (velocityY > 0) {
            player.direction = 'down-right';
        } else {
            player.direction = 'up-right';
        }
        player.setFlipX(velocityX < 0); // Flip sprite horizontally if moving left
    }
    
    // Play appropriate animation if not already playing
    if (!player.isMoving || player.lastDirection !== player.direction) {
        player.anims.play(`walk-${player.direction}`, true);
        player.isMoving = true;
        player.lastDirection = player.direction;
    }

    // Stop if collision detected
    if (player.body.blocked.none === false) {
        isMoving = false;
        player.body.setVelocity(0, 0);
        player.isMoving = false;
        player.anims.play(`idle-${player.direction}`, true);
    }
}

function getStartingRoomCenter(startRoomId) {
    // Default position if rooms not initialized yet
    const defaultPos = { x: 400, y: 300 };
    
    // If rooms are available, get the actual room position
    if (window.rooms && window.rooms[startRoomId]) {
        const roomPos = window.rooms[startRoomId].position;
        // Center of 800x600 room
        return {
            x: roomPos.x + 400,
            y: roomPos.y + 300
        };
    }
    
    // Fallback to reasonable center position for reception room
    // Reception is typically at (0,0) so center would be (400, 300)
    return defaultPos;
}

// Export for global access
window.createPlayer = createPlayer; 