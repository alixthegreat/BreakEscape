/**
 * NPCSpriteManager - NPC Sprite Creation and Management
 * 
 * Manages creation, positioning, animation, and lifecycle of NPC sprites
 * in the game world.
 * 
 * @module npc-sprites
 */

import { TILE_SIZE } from '../utils/constants.js?v=8';

/**
 * Create an NPC sprite in the game world
 * @param {Phaser.Scene} scene - Phaser scene instance
 * @param {Object} npc - NPC data from scenario
 * @param {Object} roomData - Room information (position, ID, etc.)
 * @returns {Phaser.Sprite|null} Created sprite instance or null if invalid
 */
export function createNPCSprite(scene, npc, roomData) {
    if (!npc || !npc.id) {
        console.warn('❌ Cannot create NPC sprite: invalid NPC data');
        return null;
    }
    
    try {
        // Extract sprite configuration
        const spriteSheet = npc.spriteSheet || 'hacker';
        const config = npc.spriteConfig || {};
        const idleFrame = config.idleFrame || 20;
        
        // Verify texture exists
        if (!scene.textures.exists(spriteSheet)) {
            console.warn(`❌ NPC ${npc.id}: sprite sheet "${spriteSheet}" not found`);
            return null;
        }
        
        // Calculate world position
        const worldPos = calculateNPCWorldPosition(npc, roomData);
        if (!worldPos) {
            console.warn(`❌ NPC ${npc.id}: invalid position configuration`);
            return null;
        }
        
        // Create sprite
        const sprite = scene.add.sprite(worldPos.x, worldPos.y, spriteSheet, idleFrame);
        sprite.npcId = npc.id; // Tag for identification
        sprite._isNPC = true; // Mark as NPC sprite
        
        // Enable physics
        scene.physics.add.existing(sprite);
        // Set smaller collision box at the feet (matching player collision: 18x10 with similar offset)
        sprite.body.setSize(18, 10); // Collision body size (wider for better hit detection)
        sprite.body.setOffset(23, 50); // Offset for feet position (64px sprite, adjusted for wider box)
        
        // Set up animations
        setupNPCAnimations(scene, sprite, spriteSheet, config, npc.id);
        
        // Start idle animation (default facing down)
        const idleAnimKey = `npc-${npc.id}-idle`;
        if (sprite.anims.exists(idleAnimKey)) {
            sprite.play(idleAnimKey, true);
            console.log(`▶️ [${npc.id}] Playing initial idle animation: ${idleAnimKey}`);
        } else {
            console.warn(`⚠️ [${npc.id}] Idle animation not found: ${idleAnimKey}`);
        }
        
        // Set depth (same system as player: bottomY + 0.5)
        updateNPCDepth(sprite);
        
        // Store reference in NPC data for later access
        npc._sprite = sprite;
        
        console.log(`✅ NPC sprite created: ${npc.id} at (${worldPos.x}, ${worldPos.y})`);
        
        return sprite;
    } catch (error) {
        console.error(`❌ Error creating NPC sprite for ${npc.id}:`, error);
        return null;
    }
}

/**
 * Calculate NPC's world position from scenario data
 * 
 * Supports two position formats:
 * - Grid coordinates: { x: 5, y: 3 } (tiles from room origin)
 * - Pixel coordinates: { px: 640, py: 480 } (absolute world space)
 * 
 * @param {Object} npc - NPC data with position property
 * @param {Object} roomData - Room data for offset calculation
 * @returns {Object|null} {x, y} world coordinates or null if invalid
 */
export function calculateNPCWorldPosition(npc, roomData) {
    const position = npc.position;
    
    if (!position) {
        return null;
    }
    
    // Support pixel coordinates (absolute positioning)
    if (position.px !== undefined && position.py !== undefined) {
        return {
            x: position.px,
            y: position.py
        };
    }
    
    // Support grid coordinates (tile-based positioning)
    if (position.x !== undefined && position.y !== undefined) {
        const roomWorldX = roomData.worldX || 0;
        const roomWorldY = roomData.worldY || 0;
        
        return {
            x: roomWorldX + (position.x * TILE_SIZE),
            y: roomWorldY + (position.y * TILE_SIZE)
        };
    }
    
    return null;
}

/**
 * Set up animations for an NPC sprite
 *
 * Creates animation sequences based on sprite configuration.
 * Supports: idle (8 directions), walk (8 directions), greeting, and talking animations.
 *
 * @param {Phaser.Scene} scene - Phaser scene instance
 * @param {Phaser.Sprite} sprite - NPC sprite
 * @param {string} spriteSheet - Texture key
 * @param {Object} config - Animation configuration
 * @param {string} npcId - NPC identifier for animation key naming
 */
export function setupNPCAnimations(scene, sprite, spriteSheet, config, npcId) {
    console.log(`\n🎨 Setting up animations for NPC: ${npcId} (spriteSheet: ${spriteSheet})`);
    const animPrefix = config.animPrefix || 'idle';

    // ===== IDLE ANIMATIONS (8 directions) =====
    // Idle animations for 5 base directions (left uses right with flipX)
    const idleAnimations = [
        { dir: 'right', frame: 0 },
        { dir: 'down', frame: 5 },
        { dir: 'up', frame: 10 },
        { dir: 'up-right', frame: 15 },
        { dir: 'down-right', frame: 20 }
    ];

    idleAnimations.forEach(anim => {
        const animKey = `npc-${npcId}-idle-${anim.dir}`;
        if (!scene.anims.exists(animKey)) {
            scene.anims.create({
                key: animKey,
                frames: [{ key: spriteSheet, frame: anim.frame }],
                frameRate: config.idleFrameRate || 4,
                repeat: -1
            });
        }
    });

    // Create mirrored idle animations for left directions
    // These use the same animation keys but will be flipped with sprite.setFlipX(true)
    const leftIdleAnimations = [
        { dir: 'left', mirrorDir: 'right' },
        { dir: 'up-left', mirrorDir: 'up-right' },
        { dir: 'down-left', mirrorDir: 'down-right' }
    ];

    leftIdleAnimations.forEach(anim => {
        const animKey = `npc-${npcId}-idle-${anim.dir}`;
        const mirrorKey = `npc-${npcId}-idle-${anim.mirrorDir}`;
        if (!scene.anims.exists(animKey) && scene.anims.exists(mirrorKey)) {
            // Create alias - left directions will use right animations with flipX
            const mirrorAnim = scene.anims.get(mirrorKey);
            scene.anims.create({
                key: animKey,
                frames: mirrorAnim.frames,
                frameRate: mirrorAnim.frameRate,
                repeat: mirrorAnim.repeat
            });
        }
    });

    // Legacy idle animation (default facing down) for backward compatibility
    const idleStart = config.idleFrameStart || 20;
    const idleEnd = config.idleFrameEnd || 23;

    if (!scene.anims.exists(`npc-${npcId}-idle`)) {
        scene.anims.create({
            key: `npc-${npcId}-idle`,
            frames: scene.anims.generateFrameNumbers(spriteSheet, {
                start: idleStart,
                end: idleEnd
            }),
            frameRate: config.idleFrameRate || 4,
            repeat: -1
        });
    }

    // ===== WALK ANIMATIONS (8 directions) =====
    // Walk animations for 5 base directions (left uses right with flipX)
    // Frame layout (standard hacker spritesheet 64x64):
    //   Row 0 (right): frames 0-4
    //   Row 1 (down): frames 5-9
    //   Row 2 (up): frames 10-14
    //   Row 3 (up-right): frames 15-19
    //   Row 4 (down-right): frames 20-24
    const walkAnimations = [
        { dir: 'right', start: 1, end: 4 },
        { dir: 'down', start: 6, end: 9 },
        { dir: 'up', start: 11, end: 14 },
        { dir: 'up-right', start: 16, end: 19 },
        { dir: 'down-right', start: 21, end: 24 }
    ];

    walkAnimations.forEach(anim => {
        const animKey = `npc-${npcId}-walk-${anim.dir}`;
        if (!scene.anims.exists(animKey)) {
            const frames = scene.anims.generateFrameNumbers(spriteSheet, {
                start: anim.start,
                end: anim.end
            });
            console.log(`  📋 Walk ${anim.dir}: frames ${anim.start}-${anim.end}, generated ${frames.length} frames`);
            scene.anims.create({
                key: animKey,
                frames: frames,
                frameRate: 8,
                repeat: -1
            });
            console.log(`✅ Created walk animation: ${animKey}`);
        } else {
            console.log(`⚠️ Walk animation already exists: ${animKey}`);
        }
    });

    // Create mirrored walk animations for left directions
    const leftWalkAnimations = [
        { dir: 'left', mirrorDir: 'right' },
        { dir: 'up-left', mirrorDir: 'up-right' },
        { dir: 'down-left', mirrorDir: 'down-right' }
    ];

    leftWalkAnimations.forEach(anim => {
        const animKey = `npc-${npcId}-walk-${anim.dir}`;
        const mirrorKey = `npc-${npcId}-walk-${anim.mirrorDir}`;
        if (!scene.anims.exists(animKey) && scene.anims.exists(mirrorKey)) {
            // Create alias - left directions will use right animations with flipX
            const mirrorAnim = scene.anims.get(mirrorKey);
            scene.anims.create({
                key: animKey,
                frames: mirrorAnim.frames,
                frameRate: mirrorAnim.frameRate,
                repeat: mirrorAnim.repeat
            });
        }
    });

    console.log(`📊 Walk animations summary for ${npcId}:`);
    ['right', 'down', 'up', 'up-right', 'down-right', 'left', 'up-left', 'down-left'].forEach(dir => {
        const key = `npc-${npcId}-walk-${dir}`;
        console.log(`   ${dir}: ${scene.anims.exists(key) ? '✅' : '❌'} ${key}`);
    });

    // ===== OPTIONAL ANIMATIONS =====
    // Optional: Greeting animation (wave or nod)
    if (config.greetFrameStart !== undefined && config.greetFrameEnd !== undefined) {
        if (!scene.anims.exists(`npc-${npcId}-greet`)) {
            scene.anims.create({
                key: `npc-${npcId}-greet`,
                frames: scene.anims.generateFrameNumbers(spriteSheet, {
                    start: config.greetFrameStart,
                    end: config.greetFrameEnd
                }),
                frameRate: 8,
                repeat: 0
            });
        }
    }

    // Optional: Talking animation (subtle movement)
    if (config.talkFrameStart !== undefined && config.talkFrameEnd !== undefined) {
        if (!scene.anims.exists(`npc-${npcId}-talk`)) {
            scene.anims.create({
                key: `npc-${npcId}-talk`,
                frames: scene.anims.generateFrameNumbers(spriteSheet, {
                    start: config.talkFrameStart,
                    end: config.talkFrameEnd
                }),
                frameRate: 6,
                repeat: -1
            });
        }
    }

    console.log(`✅ Animation setup complete for ${npcId}\n`);
}

/**
 * Update NPC sprite depth based on Y position
 * 
 * Uses same system as player (bottomY + 0.5) to ensure correct
 * perspective in top-down view.
 * 
 * @param {Phaser.Sprite} sprite - NPC sprite to update
 */
export function updateNPCDepth(sprite) {
    if (!sprite || !sprite.body) return;
    
    // Get the bottom of the sprite (feet position)
    const spriteBottomY = sprite.y + (sprite.displayHeight / 2);
    
    // Set depth using standard formula
    const depth = spriteBottomY + 0.5; // World Y + sprite layer offset
    sprite.setDepth(depth);
}

/**
 * Create collision between NPC sprite and player
 * 
 * Includes collision callback for patrolling NPCs to route around the player.
 * 
 * @param {Phaser.Scene} scene - Phaser scene instance
 * @param {Phaser.Sprite} npcSprite - NPC sprite
 * @param {Phaser.Sprite} player - Player sprite
 */
export function createNPCCollision(scene, npcSprite, player) {
    if (!npcSprite || !player) {
        console.warn('❌ Cannot create NPC collision: missing sprites');
        return;
    }
    
    try {
        // Add collider with callback for NPC-player collision handling
        // Patrolling NPCs will route around the player using path recalculation
        scene.physics.add.collider(
            npcSprite, 
            player,
            () => {
                handleNPCPlayerCollision(npcSprite, player);
            }
        );
        console.log(`✅ NPC collision created for ${npcSprite.npcId} (with avoidance callback)`);
    } catch (error) {
        console.error('❌ Error creating NPC collision:', error);
    }
}

/**
 * Play animation on NPC sprite
 * 
 * @param {Phaser.Sprite} sprite - NPC sprite
 * @param {string} animKey - Animation key to play
 * @returns {boolean} True if animation played, false if not found
 */
export function playNPCAnimation(sprite, animKey) {
    if (!sprite || !sprite.anims) {
        return false;
    }
    
    if (sprite.anims.exists(animKey)) {
        sprite.play(animKey);
        return true;
    }
    
    return false;
}

/**
 * Return NPC to idle animation
 * 
 * @param {Phaser.Sprite} sprite - NPC sprite
 * @param {string} npcId - NPC identifier
 */
export function returnNPCToIdle(sprite, npcId) {
    if (!sprite) return;
    
    const idleKey = `npc-${npcId}-idle`;
    if (sprite.anims.exists(idleKey)) {
        sprite.play(idleKey, true);
    }
}

/**
 * Destroy NPC sprite
 * 
 * @param {Phaser.Sprite} sprite - NPC sprite to destroy
 */
export function destroyNPCSprite(sprite) {
    if (sprite && !sprite.destroyed) {
        sprite.destroy();
    }
}

/**
 * Update all NPC depths in a collection
 * 
 * Call this if NPCs move, or after player sorts.
 * 
 * @param {Array} sprites - Array of NPC sprites
 */
export function updateNPCDepths(sprites) {
    if (!sprites || !Array.isArray(sprites)) return;
    
    sprites.forEach(sprite => {
        if (sprite && !sprite.destroyed) {
            updateNPCDepth(sprite);
        }
    });
}

/**
 * Set up wall collisions for an NPC sprite
 * 
 * Applies all wall collision boxes in the room to the NPC, similar to player.
 * 
 * @param {Phaser.Scene} scene - Phaser scene instance
 * @param {Phaser.Sprite} npcSprite - NPC sprite
 * @param {string} roomId - Room ID where NPC is located
 */
export function setupNPCWallCollisions(scene, npcSprite, roomId) {
    if (!npcSprite || !npcSprite.body) {
        return;
    }
    
    const game = scene || window.game;
    if (!game) {
        console.warn('❌ Cannot set up NPC wall collisions: no game reference');
        return;
    }
    
    const room = window.rooms ? window.rooms[roomId] : null;
    if (!room || !room.wallCollisionBoxes) {
        return;
    }
    
    // Add collision with all wall collision boxes in the room
    room.wallCollisionBoxes.forEach(wallBox => {
        if (wallBox.body) {
            game.physics.add.collider(npcSprite, wallBox);
        }
    });
    
    console.log(`✅ NPC wall collisions set up for ${npcSprite.npcId} in room ${roomId}`);
}

/**
 * Set up chair collisions for an NPC sprite
 * 
 * Applies all chair objects in the room to the NPC, similar to player.
 * Also includes chairs from all other rooms via window.chairs.
 * 
 * @param {Phaser.Scene} scene - Phaser scene instance
 * @param {Phaser.Sprite} npcSprite - NPC sprite
 * @param {string} roomId - Room ID where NPC is located
 */
export function setupNPCChairCollisions(scene, npcSprite, roomId) {
    if (!npcSprite || !npcSprite.body) {
        return;
    }
    
    const game = scene || window.game;
    if (!game) {
        console.warn('❌ Cannot set up NPC chair collisions: no game reference');
        return;
    }
    
    let chairsAdded = 0;
    
    // Collision with chairs from the current room (stored in room.objects)
    const room = window.rooms ? window.rooms[roomId] : null;
    if (room && room.objects) {
        Object.values(room.objects).forEach(obj => {
            if (obj && obj.body && obj.hasWheels) {
                game.physics.add.collider(npcSprite, obj);
                chairsAdded++;
            }
        });
    }
    
    // Collision with all chairs from other rooms (global array includes chairs being initialized)
    if (window.chairs && Array.isArray(window.chairs)) {
        window.chairs.forEach(chair => {
            if (chair && chair.body && !chair._npcCollisionSetup) {
                // Avoid duplicate collisions - only collide if not already in current room
                if (!room || !room.objects || !room.objects[chair.objectId]) {
                    game.physics.add.collider(npcSprite, chair);
                    chairsAdded++;
                }
            }
        });
    }
    
    console.log(`✅ NPC chair collisions set up for ${npcSprite.npcId}: added collisions with ${chairsAdded} chairs`);
}

/**
 * Set up table collisions for an NPC sprite
 * 
 * Applies all table objects in the room to the NPC so they can't walk through tables.
 * 
 * @param {Phaser.Scene} scene - Phaser scene instance
 * @param {Phaser.Sprite} npcSprite - NPC sprite
 * @param {string} roomId - Room ID where NPC is located
 */
export function setupNPCTableCollisions(scene, npcSprite, roomId) {
    if (!npcSprite || !npcSprite.body) {
        return;
    }
    
    const game = scene || window.game;
    if (!game) {
        console.warn('❌ Cannot set up NPC table collisions: no game reference');
        return;
    }
    
    const room = window.rooms ? window.rooms[roomId] : null;
    if (!room || !room.objects) {
        return;
    }
    
    let tablesAdded = 0;
    
    // Collision with all table objects in the room
    Object.values(room.objects).forEach(obj => {
        // Tables are identified by their object name or by checking if they're static bodies
        // Look for objects that came from the 'table' type in processObject
        if (obj && obj.body && obj.body.static) {
            // Check if this looks like a table (has scenarioData.type === 'table' or name includes 'desk')
            const isTable = (obj.scenarioData && obj.scenarioData.type === 'table') || 
                           (obj.name && obj.name.toLowerCase().includes('desk'));
            
            if (isTable) {
                game.physics.add.collider(npcSprite, obj);
                tablesAdded++;
            }
        }
    });
    
    if (tablesAdded > 0) {
        console.log(`✅ NPC table collisions set up for ${npcSprite.npcId}: added collisions with ${tablesAdded} tables`);
    }
}

/**
 * Set up all collisions for an NPC sprite (walls, tables, chairs, and other static objects)
 * 
 * Called when an NPC sprite is created to apply full collision setup.
 * 
 * @param {Phaser.Scene} scene - Phaser scene instance
 * @param {Phaser.Sprite} npcSprite - NPC sprite
 * @param {string} roomId - Room ID where NPC is located
 */
export function setupNPCEnvironmentCollisions(scene, npcSprite, roomId) {
    setupNPCWallCollisions(scene, npcSprite, roomId);
    setupNPCTableCollisions(scene, npcSprite, roomId);
    setupNPCChairCollisions(scene, npcSprite, roomId);
}

/**
 * Set up collisions between an NPC sprite and all other NPCs in the room
 * 
 * Called after creating each NPC sprite to enable NPC-to-NPC collision detection.
 * 
 * @param {Phaser.Scene} scene - Phaser scene instance
 * @param {Phaser.Sprite} npcSprite - NPC sprite to collide with others
 * @param {string} roomId - Room ID where NPC is located
 * @param {Array} allNPCSprites - Array of all NPC sprites in the room
 */
export function setupNPCToNPCCollisions(scene, npcSprite, roomId, allNPCSprites) {
    if (!npcSprite || !npcSprite.body) {
        return;
    }
    
    if (!allNPCSprites || !Array.isArray(allNPCSprites)) {
        return;
    }
    
    const game = scene || window.game;
    if (!game) {
        console.warn('❌ Cannot set up NPC-to-NPC collisions: no game reference');
        return;
    }
    
    // Add collision with all other NPCs
    let collisionsAdded = 0;
    allNPCSprites.forEach(otherNPC => {
        if (otherNPC && otherNPC !== npcSprite && otherNPC.body) {
            // Add collider with collision callback for avoidance
            game.physics.add.collider(
                npcSprite, 
                otherNPC,
                () => {
                    // Collision detected - handle NPC-to-NPC avoidance
                    handleNPCCollision(npcSprite, otherNPC);
                }
            );
            collisionsAdded++;
        }
    });
    
    if (collisionsAdded > 0) {
        console.log(`👥 NPC ${npcSprite.npcId}: ${collisionsAdded} NPC-to-NPC collision(s) set up with avoidance`);
    }
}

/**
 * Handle NPC-to-NPC collision by moving NPC 5px northeast and resuming waypoint movement
 * 
 * When two NPCs collide during wayfinding:
 * 1. Move 5px to the northeast (NE quadrant: -5x, -5y in screen space)
 * 2. Trigger behavior to continue toward waypoint
 * 
 * @param {Phaser.Sprite} npcSprite - NPC sprite that collided
 * @param {Phaser.Sprite} otherNPC - Other NPC sprite it collided with
 */
function handleNPCCollision(npcSprite, otherNPC) {
    if (!npcSprite || !otherNPC || npcSprite.destroyed || otherNPC.destroyed) {
        return;
    }

    // Get behavior instances for both NPCs
    const npcBehavior = window.npcBehaviorManager?.getBehavior(npcSprite.npcId);
    const otherBehavior = window.npcBehaviorManager?.getBehavior(otherNPC.npcId);

    if (!npcBehavior) {
        return;
    }

    // Only handle if NPC is in patrol mode
    if (npcBehavior.currentState !== 'patrol') {
        return;
    }

    // Move 5px to the northeast
    // In Phaser screen space: -7x (left/west), -7y (up/north) = northeast
    const moveDistance = 7; // Total distance to move
    const moveX = -moveDistance / Math.sqrt(2);  // ~-3.5 (northwest component)
    const moveY = -moveDistance / Math.sqrt(2);  // ~-3.5 (northeast component)
    
    const oldX = npcSprite.x;
    const oldY = npcSprite.y;
    npcSprite.setPosition(npcSprite.x + moveX, npcSprite.y + moveY);

    // Update depth after movement
    npcBehavior.updateDepth();

    console.log(`⬆️ [${npcSprite.npcId}] Bumped into ${otherNPC.npcId}, moved NE by ~5px from (${oldX.toFixed(0)}, ${oldY.toFixed(0)}) to (${npcSprite.x.toFixed(0)}, ${npcSprite.y.toFixed(0)})`);

    // Continue patrol - the next frame's updatePatrol() will recalculate path to waypoint
    // Set a flag to force path recalculation on next update
    if (!npcBehavior._needsPathRecalc) {
        npcBehavior._needsPathRecalc = true;
    }
}

/**
 * Handle NPC-to-player collision by moving NPC 5px northeast and resuming waypoint movement
 * 
 * When a patrolling NPC collides with the player:
 * 1. Move 5px to the northeast (NE quadrant: -5x, -5y in screen space)
 * 2. Trigger behavior to continue toward waypoint
 * 
 * Similar to NPC-to-NPC collision avoidance, allowing NPCs to navigate around the player.
 * 
 * @param {Phaser.Sprite} npcSprite - NPC sprite that collided with player
 * @param {Phaser.Sprite} player - Player sprite
 */
function handleNPCPlayerCollision(npcSprite, player) {
    if (!npcSprite || !player || npcSprite.destroyed || player.destroyed) {
        return;
    }

    // Get behavior instance for NPC
    const npcBehavior = window.npcBehaviorManager?.getBehavior(npcSprite.npcId);

    if (!npcBehavior) {
        return;
    }

    // Only handle if NPC is in patrol mode
    if (npcBehavior.currentState !== 'patrol') {
        return;
    }

    // Move 5px to the northeast
    // In Phaser screen space: -7x (left/west), -7y (up/north) = northeast
    const moveDistance = 7; // Total distance to move
    const moveX = -moveDistance / Math.sqrt(2);  // ~-3.5 (northwest component)
    const moveY = -moveDistance / Math.sqrt(2);  // ~-3.5 (northeast component)
    
    const oldX = npcSprite.x;
    const oldY = npcSprite.y;
    npcSprite.setPosition(npcSprite.x + moveX, npcSprite.y + moveY);

    // Update depth after movement
    npcBehavior.updateDepth();

    console.log(`⬆️ [${npcSprite.npcId}] Bumped into player, moved NE by ~5px from (${oldX.toFixed(0)}, ${oldY.toFixed(0)}) to (${npcSprite.x.toFixed(0)}, ${npcSprite.y.toFixed(0)})`);

    // Continue patrol - the next frame's updatePatrol() will recalculate path to waypoint
    // Set a flag to force path recalculation on next update
    if (!npcBehavior._needsPathRecalc) {
        npcBehavior._needsPathRecalc = true;
    }
}
export default {
    createNPCSprite,
    calculateNPCWorldPosition,
    setupNPCAnimations,
    updateNPCDepth,
    createNPCCollision,
    setupNPCWallCollisions,
    setupNPCChairCollisions,
    setupNPCEnvironmentCollisions,
    setupNPCToNPCCollisions,
    playNPCAnimation,
    returnNPCToIdle,
    destroyNPCSprite,
    updateNPCDepths
};
