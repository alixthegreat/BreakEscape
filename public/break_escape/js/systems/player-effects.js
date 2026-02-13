/**
 * PLAYER EFFECTS SYSTEM
 * =====================
 * 
 * Handles visual effects and animations triggered by player interactions.
 * Separated from rooms.js for better modularity and maintainability.
 */

import { TILE_SIZE } from '../utils/constants.js';

let gameRef = null;
let rooms = null;

// Player bump effect variables
let playerBumpTween = null;
let isPlayerBumping = false;
let lastPlayerPosition = { x: 0, y: 0 };
let steppedOverItems = new Set(); // Track items we've already stepped over
let playerVisualOverlay = null; // Visual overlay for hop effect
let lastHopTime = 0; // Track when last hop occurred
let lastJumpTime = 0; // Track when last jump occurred
const HOP_COOLDOWN = 300; // 300ms cooldown between hops
const JUMP_COOLDOWN = 600; // 600ms cooldown between jumps

// Initialize player effects system
export function initializePlayerEffects(gameInstance, roomsRef) {
    gameRef = gameInstance;
    rooms = roomsRef;
}

// Function to create player bump effect when walking over items
export function createPlayerBumpEffect() {
    if (!window.player || isPlayerBumping) return;
    
    // Check cooldown to prevent double hopping
    const currentTime = Date.now();
    if (currentTime - lastHopTime < HOP_COOLDOWN) {
        return; // Still in cooldown, skip this frame
    }
    
    const player = window.player;
    const currentX = player.x;
    const currentY = player.y;
    
    // Check if player has moved significantly (to detect stepping over items)
    const hasMoved = Math.abs(currentX - lastPlayerPosition.x) > 5 || 
                     Math.abs(currentY - lastPlayerPosition.y) > 5;
    
    if (!hasMoved) return;
    
    // Update last position
    lastPlayerPosition = { x: currentX, y: currentY };
    
    // Check all rooms for floor items
    Object.entries(rooms).forEach(([roomId, room]) => {
        if (!room.objects) return;
        
        Object.values(room.objects).forEach(obj => {
            if (!obj.visible || !obj.scenarioData) return;
            
            // Create unique identifier for this item
            const itemId = `${roomId}_${obj.objectId || obj.name}_${obj.x}_${obj.y}`;
            
            // Skip if we've already stepped over this item recently
            if (steppedOverItems.has(itemId)) return;
            
            // Check if this is a floor item (not furniture)
            const isFloorItem = obj.scenarioData.type && 
                !obj.scenarioData.type.includes('table') && 
                !obj.scenarioData.type.includes('chair') &&
                !obj.scenarioData.type.includes('desk') &&
                !obj.scenarioData.type.includes('safe') &&
                !obj.scenarioData.type.includes('workstation');
            
            if (!isFloorItem) return;
            
            // Check if player collision box intersects with bottom portion of item
            const playerCollisionLeft = currentX - (player.body.width / 2);
            const playerCollisionRight = currentX + (player.body.width / 2);
            const playerCollisionTop = currentY - (player.body.height / 2);
            const playerCollisionBottom = currentY + (player.body.height / 2);
            
            // Focus on bottom 1/3 of the item sprite
            const itemBottomStart = obj.y + (obj.height * 2/3); // Start of bottom third
            const itemBottomEnd = obj.y + obj.height; // Bottom of item
            
            const itemLeft = obj.x;
            const itemRight = obj.x + obj.width;
            
            // Check if player collision box intersects with bottom third of item
            if (playerCollisionRight >= itemLeft && 
                playerCollisionLeft <= itemRight &&
                playerCollisionBottom >= itemBottomStart && 
                playerCollisionTop <= itemBottomEnd) {
                
                // Player stepped over a floor item - trigger punch effect
                steppedOverItems.add(itemId);
                lastHopTime = currentTime; // Update hop time
                
                // Remove from set after 2 seconds to allow re-triggering
                setTimeout(() => {
                    steppedOverItems.delete(itemId);
                }, 2000);
                
                // Replace red tint effect with punch animation (cross-punch or lead-jab)
                isPlayerBumping = true;
                
                // Map player direction to atlas compass direction
                const directionMap = {
                    'right': 'east',
                    'left': 'west',
                    'up': 'north',
                    'down': 'south',
                    'up-right': 'north-east',
                    'up-left': 'north-west',
                    'down-right': 'south-east',
                    'down-left': 'south-west'
                };
                const compassDir = directionMap[player.direction] || 'south';
                
                // Try to play punch/jab animation if available
                const crossPunchKey = `cross-punch_${compassDir}`;
                const leadJabKey = `lead-jab_${compassDir}`;
                
                let animPlayed = false;
                
                // Try cross-punch animation first
                if (gameRef.anims.exists(crossPunchKey)) {
                    player.anims.play(crossPunchKey, true);
                    animPlayed = true;
                    console.log(`🥊 Bump: Playing cross-punch animation: ${crossPunchKey}`);
                }
                // Fall back to lead-jab animation
                else if (gameRef.anims.exists(leadJabKey)) {
                    player.anims.play(leadJabKey, true);
                    animPlayed = true;
                    console.log(`🥊 Bump: Playing lead-jab animation: ${leadJabKey}`);
                }
                
                if (animPlayed) {
                    // Restore to idle after animation completes
                    player.once('animationcomplete', () => {
                        const animDir = typeof getAnimationKey === 'function' ? getAnimationKey(player.direction) : player.direction;
                        player.anims.play(`idle-${animDir}`, true);
                        isPlayerBumping = false;
                    });
                } else {
                    // Fallback: flash red tint for 120ms if no animation available
                    console.log(`⚠️ No punch animations found (tried ${crossPunchKey}, ${leadJabKey}), using red tint fallback`);
                    player.setTint(0xff4444);
                    setTimeout(() => {
                        player.clearTint();
                        isPlayerBumping = false;
                    }, 120);
                }
            }
        });
    });
}

// Create player jump effect when spacebar is pressed
export function createPlayerJump() {
    if (!window.player || isPlayerBumping) return;
    
    // Check cooldown to prevent rapid jumping
    const currentTime = Date.now();
    if (currentTime - lastJumpTime < JUMP_COOLDOWN) {
        return; // Still in cooldown, skip this jump
    }
    
    const player = window.player;
    
    // Update jump time
    lastJumpTime = currentTime;
    isPlayerBumping = true;
    
    // Create hop effect using visual overlay (same as bump effect)
    if (playerBumpTween) {
        playerBumpTween.destroy();
    }
    
    // Create a visual overlay sprite that follows the player
    if (playerVisualOverlay) {
        playerVisualOverlay.destroy();
    }
    
    playerVisualOverlay = gameRef.add.sprite(player.x, player.y, player.texture.key);
    playerVisualOverlay.setFrame(player.frame.name);
    playerVisualOverlay.setScale(player.scaleX, player.scaleY);
    playerVisualOverlay.setFlipX(player.flipX); // Copy horizontal flip state
    playerVisualOverlay.setFlipY(player.flipY); // Copy vertical flip state
    playerVisualOverlay.setDepth(player.depth + 1);
    playerVisualOverlay.setAlpha(0.8);
    
    // Hide the original player temporarily
    player.setAlpha(0);
    
    // Jump upward - negative Y values move sprite up on screen
    const jumpHeight = -20; // Consistent upward jump
    
    // Debug: Log the jump details
    console.log(`Jump triggered - Player Y: ${player.y}, Overlay Y: ${playerVisualOverlay.y}, Jump Height: ${jumpHeight}, Target Y: ${playerVisualOverlay.y + jumpHeight}`);
    
    // Start the jump animation with a simple up-down motion
    playerBumpTween = gameRef.tweens.add({
        targets: { jumpOffset: 0 },
        jumpOffset: jumpHeight,
        duration: 150,
        ease: 'Power2',
        yoyo: true,
        onUpdate: (tween) => {
            if (playerVisualOverlay && playerVisualOverlay.active) {
                // Apply the jump offset to the current player position
                playerVisualOverlay.setY(player.y + tween.getValue());
            }
        },
        onComplete: () => {
            // Clean up overlay and restore player
            if (playerVisualOverlay) {
                playerVisualOverlay.destroy();
                playerVisualOverlay = null;
            }
            player.setAlpha(1); // Restore player visibility
            isPlayerBumping = false;
            playerBumpTween = null;
        }
    });
    
    // Make overlay follow player movement during jump
    const followPlayer = () => {
        if (playerVisualOverlay && playerVisualOverlay.active) {
            // Update X position and flip states, Y is handled by the tween
            playerVisualOverlay.setX(player.x);
            playerVisualOverlay.setFlipX(player.flipX); // Update flip state
            playerVisualOverlay.setFlipY(player.flipY); // Update flip state
        }
    };
    
    // Update overlay position every frame during jump
    const followInterval = setInterval(() => {
        if (!playerVisualOverlay || !playerVisualOverlay.active) {
            clearInterval(followInterval);
            return;
        }
        followPlayer();
    }, 16); // ~60fps
    
    // Clean up interval when jump completes
    setTimeout(() => {
        clearInterval(followInterval);
    }, 280); // Slightly longer than animation duration
}

// Create plant animation effect when player bumps into animated plants
export function createPlantBumpEffect() {
    if (!window.player) return;
    
    const player = window.player;
    const currentX = player.x;
    const currentY = player.y;
    
    // Check if player is moving (has velocity)
    const isMoving = Math.abs(player.body.velocity.x) > 10 || Math.abs(player.body.velocity.y) > 10;
    if (!isMoving) return;
    
    // Check all rooms for animated plants
    Object.entries(rooms).forEach(([roomId, room]) => {
        if (!room.objects) return;
        
        Object.values(room.objects).forEach(obj => {
            if (!obj.visible || !obj.isAnimatedPlant) return;
            
            // Check if player is near the plant (within 40 pixels) with pixel-perfect coordinates
            const plantCenterX = Math.round(obj.x + obj.width/2);
            const plantCenterY = Math.round(obj.y + obj.height/2);
            const distance = Phaser.Math.Distance.Between(Math.round(currentX), Math.round(currentY), plantCenterX, plantCenterY);
            
            if (distance < 40 && !obj.isAnimating) {
                obj.isAnimating = true;
                
                // Play the plant animation using the stored animation key
                obj.play(obj.animationKey);
                
                // Reset animation flag when animation completes
                obj.once('animationcomplete', () => {
                    obj.isAnimating = false;
                });
                
                console.log(`Animated plant ${obj.name} bumped by player, playing ${obj.animationKey}`);
            }
        });
    });
}

// Export for global access
window.createPlayerBumpEffect = createPlayerBumpEffect;
window.createPlayerJump = createPlayerJump;
window.createPlantBumpEffect = createPlantBumpEffect;
