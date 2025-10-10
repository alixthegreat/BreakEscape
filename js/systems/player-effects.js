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
const HOP_COOLDOWN = 300; // 300ms cooldown between hops

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
                
                // Player stepped over a floor item - create one-time hop effect
                steppedOverItems.add(itemId);
                lastHopTime = currentTime; // Update hop time
                
                // Remove from set after 2 seconds to allow re-triggering
                setTimeout(() => {
                    steppedOverItems.delete(itemId);
                }, 2000);
                
                // Create one-time hop effect
                if (playerBumpTween) {
                    playerBumpTween.destroy();
                }
                
                isPlayerBumping = true;
                
                // Create hop effect using visual overlay
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
                
                // Always hop upward - negative Y values move sprite up on screen
                const hopHeight = -15; // Consistent upward hop
                
                // Debug: Log the hop details
                console.log(`Hop triggered - Player Y: ${player.y}, Overlay Y: ${playerVisualOverlay.y}, Hop Height: ${hopHeight}, Target Y: ${playerVisualOverlay.y + hopHeight}`);
                console.log(`Player movement - DeltaX: ${currentX - lastPlayerPosition.x}, DeltaY: ${currentY - lastPlayerPosition.y}`);
                
                // Start the hop animation with a simple up-down motion
                playerBumpTween = gameRef.tweens.add({
                    targets: { hopOffset: 0 },
                    hopOffset: hopHeight,
                    duration: 120,
                    ease: 'Power2',
                    yoyo: true,
                    onUpdate: (tween) => {
                        if (playerVisualOverlay && playerVisualOverlay.active) {
                            // Apply the hop offset to the current player position
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
                
                // Make overlay follow player movement during hop
                const followPlayer = () => {
                    if (playerVisualOverlay && playerVisualOverlay.active) {
                        // Update X position and flip states, Y is handled by the tween
                        playerVisualOverlay.setX(player.x);
                        playerVisualOverlay.setFlipX(player.flipX); // Update flip state
                        playerVisualOverlay.setFlipY(player.flipY); // Update flip state
                    }
                };
                
                // Update overlay position every frame during hop
                const followInterval = setInterval(() => {
                    if (!playerVisualOverlay || !playerVisualOverlay.active) {
                        clearInterval(followInterval);
                        return;
                    }
                    followPlayer();
                }, 16); // ~60fps
                
                // Clean up interval when hop completes
                setTimeout(() => {
                    clearInterval(followInterval);
                }, 240); // Slightly longer than animation duration
            }
        });
    });
}

// Create plant sway effect when player walks through
export function createPlantSwayEffect() {
    if (!window.player) return;
    
    const player = window.player;
    const currentX = player.x;
    const currentY = player.y;
    
    // Check if player is moving (has velocity)
    const isMoving = Math.abs(player.body.velocity.x) > 10 || Math.abs(player.body.velocity.y) > 10;
    if (!isMoving) return;
    
    // Check all rooms for plants
    Object.entries(rooms).forEach(([roomId, room]) => {
        if (!room.objects) return;
        
        Object.values(room.objects).forEach(obj => {
            if (!obj.visible || !obj.canSway) return;
            
            // Check if player is near the plant (within 40 pixels)
            const distance = Phaser.Math.Distance.Between(currentX, currentY, obj.x + obj.width/2, obj.y + obj.height/2);
            
            if (distance < 40 && !obj.isSwaying) {
                obj.isSwaying = true;
                
                // Create sway effect using displacement FX
                // This creates a realistic distortion effect while keeping the base stationary
                const swayIntensity = 0.05; // Increased intensity for more dramatic motion
                const swayDuration = Phaser.Math.Between(400, 600); // Half the time - much faster animation
                
                // Calculate sway direction based on player position relative to plant
                const playerDirection = currentX > obj.x + obj.width/2 ? 1 : -1;
                const displacementX = playerDirection * swayIntensity;
                const displacementY = (Math.random() - 0.5) * swayIntensity * 0.8; // More vertical movement
                
                // Create a complex sway animation using displacement
                const swayTween = gameRef.tweens.add({
                    targets: obj.displacementFX,
                    x: displacementX,
                    y: displacementY,
                    duration: swayDuration / 3,
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    onComplete: () => {
                        // Second sway phase with opposite direction
                        gameRef.tweens.add({
                            targets: obj.displacementFX,
                            x: -displacementX * 0.8, // More dramatic opposite movement
                            y: -displacementY * 0.8,
                            duration: swayDuration / 3,
                            ease: 'Sine.easeInOut',
                            yoyo: true,
                            onComplete: () => {
                                // Final settle phase - return to original state
                                gameRef.tweens.add({
                                    targets: obj.displacementFX,
                                    x: 0.01, // Slightly higher default displacement
                                    y: 0.01, // Slightly higher default displacement
                                    duration: swayDuration / 3,
                                    ease: 'Sine.easeOut',
                                    onComplete: () => {
                                        obj.isSwaying = false;
                                    }
                                });
                            }
                        });
                    }
                });
                
                console.log(`Plant ${obj.name} swaying with intensity ${swayIntensity}, direction ${playerDirection}`);
            }
        });
    });
}

// Export for global access
window.createPlayerBumpEffect = createPlayerBumpEffect;
window.createPlantSwayEffect = createPlantSwayEffect;
