/**
 * NPC Behavior System - Core Behavior Management
 *
 * Manages all NPC behaviors including:
 * - Face Player: Turn to face player when nearby
 * - Patrol: Random movement within area (using EasyStar.js pathfinding)
 * - Personal Space: Back away if player too close
 * - Hostile: Red tint, future chase/flee behaviors
 *
 * Architecture:
 * - NPCBehaviorManager: Singleton manager for all NPC behaviors
 * - NPCBehavior: Individual behavior instance per NPC
 * - NPCPathfindingManager: Manages EasyStar pathfinding per room
 *
 * Lifecycle:
 * - Manager initialized once in game.js create()
 * - Behaviors registered per-room when sprites created
 * - Updated every frame (throttled to 50ms)
 * - Rooms never unload, so no cleanup needed
 *
 * @module npc-behavior
 */

import { TILE_SIZE } from '../utils/constants.js?v=8';
import { NPCPathfindingManager } from './npc-pathfinding.js?v=2';

/**
 * NPCBehaviorManager - Manages all NPC behaviors
 *
 * Initialized once in game.js create() phase
 * Updated every frame in game.js update() phase
 *
 * IMPORTANT: Rooms never unload, so no lifecycle management needed.
 * Behaviors persist for entire game session once registered.
 */
export class NPCBehaviorManager {
    constructor(scene, npcManager) {
        this.scene = scene;              // Phaser scene reference
        this.npcManager = npcManager;    // NPC Manager reference
        this.behaviors = new Map();      // Map<npcId, NPCBehavior>
        this.updateInterval = 50;        // Update behaviors every 50ms
        this.lastUpdate = 0;
        
        // Use the pathfinding manager created by initializeRooms()
        // It's already been initialized in rooms.js and should be available on window
        this.pathfindingManager = window.pathfindingManager;
        
        if (!this.pathfindingManager) {
            console.warn(`⚠️ Pathfinding manager not yet available, will use window.pathfindingManager when needed`);
        }

        console.log('✅ NPCBehaviorManager initialized');
    }
    
    /**
     * Get pathfinding manager (used by NPCBehavior instances)
     * Retrieves from window.pathfindingManager to ensure latest reference
     */
    getPathfindingManager() {
        return window.pathfindingManager || this.pathfindingManager;
    }

    /**
     * Register a behavior instance for an NPC sprite
     * Called when NPC sprite is created in createNPCSpritesForRoom()
     *
     * No unregister needed - rooms never unload, sprites persist
     */
    registerBehavior(npcId, sprite, config) {
        try {
            // Get latest pathfinding manager reference
            const pathfindingManager = window.pathfindingManager || this.pathfindingManager;
            const behavior = new NPCBehavior(npcId, sprite, config, this.scene, pathfindingManager);
            this.behaviors.set(npcId, behavior);
            console.log(`🤖 Behavior registered for ${npcId}`);
        } catch (error) {
            console.error(`❌ Failed to register behavior for ${npcId}:`, error);
        }
    }

    /**
     * Main update loop (called from game.js update())
     */
    update(time, delta) {
        // Throttle updates to every 50ms for performance
        if (time - this.lastUpdate < this.updateInterval) {
            return;
        }
        this.lastUpdate = time;

        // Get player position once for all behaviors
        const player = window.player;
        if (!player) {
            return; // No player yet
        }
        const playerPos = { x: player.x, y: player.y };

        for (const [npcId, behavior] of this.behaviors) {
            behavior.update(time, delta, playerPos);
        }
    }

    /**
     * Update behavior config (called from Ink tag handlers)
     */
    setBehaviorState(npcId, property, value) {
        const behavior = this.behaviors.get(npcId);
        if (behavior) {
            behavior.setState(property, value);
        }
    }

    /**
     * Get behavior instance for an NPC
     */
    getBehavior(npcId) {
        return this.behaviors.get(npcId) || null;
    }
}

/**
 * NPCBehavior - Individual NPC behavior instance
 */
class NPCBehavior {
    constructor(npcId, sprite, config, scene, pathfindingManager) {
        this.npcId = npcId;
        this.sprite = sprite;
        this.scene = scene;
        // Store pathfinding manager, but prefer window.pathfindingManager if available
        this.pathfindingManager = pathfindingManager || window.pathfindingManager;

        // Validate sprite reference
        if (!this.sprite || !this.sprite.body) {
            throw new Error(`❌ Invalid sprite provided for NPC ${npcId}`);
        }

        // Get NPC data and validate room ID
        const npcData = window.npcManager?.npcs?.get(npcId);
        if (!npcData || !npcData.roomId) {
            console.warn(`⚠️ NPC ${npcId} has no room assignment, using default`);
            this.roomId = 'unknown';
        } else {
            this.roomId = npcData.roomId;
        }

        // Verify sprite reference matches stored sprite
        if (npcData && npcData._sprite && npcData._sprite !== this.sprite) {
            console.warn(`⚠️ Sprite reference mismatch for ${npcId}`);
        }

        this.config = this.parseConfig(config || {});

        // State
        this.currentState = 'idle';
        this.direction = 'down';          // Current facing direction
        this.hostile = this.config.hostile.defaultState;
        this.influence = 0;

        // Patrol state
        this.patrolTarget = null;
        this.currentPath = [];           // Current path from EasyStar pathfinding
        this.pathIndex = 0;              // Current position in path
        this.lastPatrolChange = 0;
        this.lastPosition = { x: this.sprite.x, y: this.sprite.y };
        this.collisionRotationAngle = 0;  // Clockwise rotation angle when blocked (0-360)
        this.wasBlockedLastFrame = false; // Track block state for smooth transitions

        // Personal space state
        this.backingAway = false;

        // Animation tracking
        this.lastAnimationKey = null;
        this.isMoving = false;

        // Apply initial hostile visual if needed
        if (this.hostile) {
            this.setHostile(true);
        }

        console.log(`✅ Behavior initialized for ${npcId} in room ${this.roomId}`);
    }

    parseConfig(config) {
        // Parse and apply defaults to config
        const merged = {
            facePlayer: config.facePlayer !== undefined ? config.facePlayer : true,
            facePlayerDistance: config.facePlayerDistance || 96,
            patrol: {
                enabled: config.patrol?.enabled || false,
                speed: config.patrol?.speed || 100,
                changeDirectionInterval: config.patrol?.changeDirectionInterval || 3000,
                bounds: config.patrol?.bounds || null,
                waypoints: config.patrol?.waypoints || null,        // ← NEW: List of waypoints
                waypointMode: config.patrol?.waypointMode || 'sequential',  // ← NEW: sequential or random
                waypointIndex: 0  // ← NEW: Current waypoint index for sequential mode
            },
            personalSpace: {
                enabled: config.personalSpace?.enabled || false,
                distance: config.personalSpace?.distance || 48,
                backAwaySpeed: config.personalSpace?.backAwaySpeed || 30,
                backAwayDistance: config.personalSpace?.backAwayDistance || 5
            },
            hostile: {
                defaultState: config.hostile?.defaultState || false,
                influenceThreshold: config.hostile?.influenceThreshold || -50,
                chaseSpeed: config.hostile?.chaseSpeed || 200,
                fleeSpeed: config.hostile?.fleeSpeed || 180,
                aggroDistance: config.hostile?.aggroDistance || 160
            }
        };

        // Pre-calculate squared distances for performance
        merged.facePlayerDistanceSq = merged.facePlayerDistance ** 2;
        merged.personalSpace.distanceSq = merged.personalSpace.distance ** 2;
        merged.hostile.aggroDistanceSq = merged.hostile.aggroDistance ** 2;

        // Validate and process waypoints if provided
        if (merged.patrol.enabled && merged.patrol.waypoints && merged.patrol.waypoints.length > 0) {
            this.validateWaypoints(merged);
        }

        // Validate patrol bounds include starting position (only if no waypoints)
        if (merged.patrol.enabled && merged.patrol.bounds && (!merged.patrol.waypoints || merged.patrol.waypoints.length === 0)) {
            const bounds = merged.patrol.bounds;
            const spriteX = this.sprite.x;
            const spriteY = this.sprite.y;

            // Get room offset for bounds calculation
            const roomData = window.rooms ? window.rooms[this.roomId] : null;
            const roomWorldX = roomData?.worldX || 0;
            const roomWorldY = roomData?.worldY || 0;

            // Convert bounds to world coordinates
            const worldBounds = {
                x: roomWorldX + bounds.x,
                y: roomWorldY + bounds.y,
                width: bounds.width,
                height: bounds.height
            };

            const inBoundsX = spriteX >= worldBounds.x && spriteX <= (worldBounds.x + worldBounds.width);
            const inBoundsY = spriteY >= worldBounds.y && spriteY <= (worldBounds.y + worldBounds.height);

            if (!inBoundsX || !inBoundsY) {
                console.warn(`⚠️ NPC ${this.npcId} starting position (${spriteX}, ${spriteY}) is outside patrol bounds. Expanding bounds...`);

                // Auto-expand bounds to include starting position
                const newX = Math.min(worldBounds.x, spriteX);
                const newY = Math.min(worldBounds.y, spriteY);
                const newMaxX = Math.max(worldBounds.x + worldBounds.width, spriteX);
                const newMaxY = Math.max(worldBounds.y + worldBounds.height, spriteY);

                // Store bounds in world coordinates for easier calculation
                merged.patrol.worldBounds = {
                    x: newX,
                    y: newY,
                    width: newMaxX - newX,
                    height: newMaxY - newY
                };

                console.log(`✅ Patrol bounds expanded to include starting position`);
            } else {
                // Store bounds in world coordinates
                merged.patrol.worldBounds = worldBounds;
            }
        }

        return merged;
    }

    /**
     * Validate and process waypoints from scenario config
     * Converts tile coordinates to world coordinates
     * Validates waypoints are walkable
     */
    validateWaypoints(merged) {
        try {
            const roomData = window.rooms ? window.rooms[this.roomId] : null;
            if (!roomData) {
                console.warn(`⚠️ Cannot validate waypoints: room ${this.roomId} not found`);
                merged.patrol.waypoints = null;
                return;
            }

            const roomWorldX = roomData.worldX || 0;
            const roomWorldY = roomData.worldY || 0;

            const validWaypoints = [];

            for (const wp of merged.patrol.waypoints) {
                // Validate waypoint has x, y
                if (wp.x === undefined || wp.y === undefined) {
                    console.warn(`⚠️ Waypoint missing x or y coordinate`);
                    continue;
                }

                // Convert tile coordinates to world coordinates
                const worldX = roomWorldX + (wp.x * TILE_SIZE);
                const worldY = roomWorldY + (wp.y * TILE_SIZE);

                // Basic bounds check
                const roomBounds = window.pathfindingManager?.getBounds(this.roomId);
                if (roomBounds) {
                    // Convert tile bounds to world coordinates for comparison
                    const minWorldX = roomWorldX + (roomBounds.x * TILE_SIZE);
                    const minWorldY = roomWorldY + (roomBounds.y * TILE_SIZE);
                    const maxWorldX = minWorldX + (roomBounds.width * TILE_SIZE);
                    const maxWorldY = minWorldY + (roomBounds.height * TILE_SIZE);

                    if (worldX < minWorldX || worldX > maxWorldX || worldY < minWorldY || worldY > maxWorldY) {
                        console.warn(`⚠️ Waypoint (${wp.x}, ${wp.y}) at world (${worldX}, ${worldY}) outside patrol bounds`);
                        continue;
                    }
                }

                // Store validated waypoint with world coordinates
                validWaypoints.push({
                    tileX: wp.x,
                    tileY: wp.y,
                    worldX: worldX,
                    worldY: worldY,
                    dwellTime: wp.dwellTime || 0
                });
            }

            if (validWaypoints.length > 0) {
                merged.patrol.waypoints = validWaypoints;
                merged.patrol.waypointIndex = 0;
                console.log(`✅ Validated ${validWaypoints.length} waypoints for ${this.npcId}`);
            } else {
                console.warn(`⚠️ No valid waypoints for ${this.npcId}, using random patrol`);
                merged.patrol.waypoints = null;
            }
        } catch (error) {
            console.error(`❌ Error validating waypoints for ${this.npcId}:`, error);
            merged.patrol.waypoints = null;
        }
    }

    update(time, delta, playerPos) {
        try {
            // Validate sprite
            if (!this.sprite || !this.sprite.body || this.sprite.destroyed) {
                console.warn(`⚠️ Invalid sprite for ${this.npcId}, skipping update`);
                return;
            }

            // Main behavior update logic
            // 1. Determine highest priority state
            const state = this.determineState(playerPos);

            // 2. Execute state behavior
            this.executeState(state, time, delta, playerPos);

            // 3. CRITICAL: Update depth after any movement
            // This ensures correct Y-sorting with player and other NPCs
            this.updateDepth();

        } catch (error) {
            console.error(`❌ Behavior update error for ${this.npcId}:`, error);
        }
    }

    determineState(playerPos) {
        if (!playerPos) {
            return 'idle';
        }

        // Calculate distance to player
        const dx = playerPos.x - this.sprite.x;
        const dy = playerPos.y - this.sprite.y;
        const distanceSq = dx * dx + dy * dy;

        // Priority 5: Chase (hostile + close) - stub for now
        if (this.hostile && distanceSq < this.config.hostile.aggroDistanceSq) {
            // TODO: Implement chase behavior in future
            // return 'chase';
        }

        // Priority 4: Flee (hostile + far) - stub for now
        if (this.hostile) {
            // TODO: Implement flee behavior in future
            // return 'flee';
        }

        // Priority 3: Maintain Personal Space
        if (this.config.personalSpace.enabled && distanceSq < this.config.personalSpace.distanceSq) {
            return 'maintain_space';
        }

        // Priority 2: Patrol
        if (this.config.patrol.enabled) {
            // Check if player is in interaction range - if so, face player instead
            if (distanceSq < this.config.facePlayerDistanceSq && this.config.facePlayer) {
                return 'face_player';
            }
            return 'patrol';
        }

        // Priority 1: Face Player
        if (this.config.facePlayer && distanceSq < this.config.facePlayerDistanceSq) {
            return 'face_player';
        }

        // Priority 0: Idle
        return 'idle';
    }

    executeState(state, time, delta, playerPos) {
        this.currentState = state;

        switch (state) {
            case 'idle':
                this.sprite.body.setVelocity(0, 0);
                this.playAnimation('idle', this.direction);
                this.isMoving = false;
                break;

            case 'face_player':
                this.facePlayer(playerPos);
                this.sprite.body.setVelocity(0, 0);
                this.isMoving = false;
                break;

            case 'patrol':
                this.updatePatrol(time, delta);
                break;

            case 'maintain_space':
                this.maintainPersonalSpace(playerPos, delta);
                break;

            case 'chase':
                // Stub for future implementation
                this.updateHostileBehavior(playerPos, delta);
                break;

            case 'flee':
                // Stub for future implementation
                this.updateHostileBehavior(playerPos, delta);
                break;
        }
    }

    facePlayer(playerPos) {
        if (!this.config.facePlayer || !playerPos) return;

        const dx = playerPos.x - this.sprite.x;
        const dy = playerPos.y - this.sprite.y;

        // Calculate direction (8-way)
        this.direction = this.calculateDirection(dx, dy);

        // Play idle animation facing player
        this.playAnimation('idle', this.direction);
    }
    updatePatrol(time, delta) {
        if (!this.config.patrol.enabled) return;

        // Check if path needs recalculation (e.g., after NPC-to-NPC collision avoidance)
        if (this._needsPathRecalc && this.patrolTarget) {
            this._needsPathRecalc = false;
            console.log(`🔄 [${this.npcId}] Recalculating path to waypoint after collision avoidance`);
            
            // Clear current path and recalculate
            this.currentPath = [];
            this.pathIndex = 0;
            
            const pathfindingManager = this.pathfindingManager || window.pathfindingManager;
            if (pathfindingManager) {
                pathfindingManager.findPath(
                    this.roomId,
                    this.sprite.x,
                    this.sprite.y,
                    this.patrolTarget.x,
                    this.patrolTarget.y,
                    (path) => {
                        if (path && path.length > 0) {
                            this.currentPath = path;
                            this.pathIndex = 0;
                            console.log(`✅ [${this.npcId}] Recalculated path with ${path.length} waypoints after collision`);
                        } else {
                            console.warn(`⚠️ [${this.npcId}] Path recalculation failed after collision`);
                        }
                    }
                );
            }
            return;
        }

        // Handle dwell time at waypoint
        if (this.patrolTarget && this.patrolTarget.dwellTime && this.patrolTarget.dwellTime > 0) {
            if (this.patrolReachedTime === 0) {
                // Just reached waypoint, start dwell timer
                this.patrolReachedTime = time;
                this.sprite.body.setVelocity(0, 0);
                this.playAnimation('idle', this.direction);
                this.isMoving = false;
                console.log(`⏸️ [${this.npcId}] Dwelling at waypoint for ${this.patrolTarget.dwellTime}ms`);
                return;
            }

            // Check if dwell time expired
            const dwellElapsed = time - this.patrolReachedTime;
            if (dwellElapsed < this.patrolTarget.dwellTime) {
                // Still dwelling
                return;
            }

            // Dwell time expired, reset and choose next target
            this.patrolReachedTime = 0;
            this.chooseNewPatrolTarget(time);
            return;
        }

        // Time to choose a new patrol target?
        if (!this.patrolTarget ||
            this.currentPath.length === 0 ||
            time - this.lastPatrolChange > this.config.patrol.changeDirectionInterval) {
            this.chooseNewPatrolTarget(time);
            return;
        }

        // Follow current path
        if (this.currentPath.length > 0 && this.pathIndex < this.currentPath.length) {
            const nextWaypoint = this.currentPath[this.pathIndex];
            const dx = nextWaypoint.x - this.sprite.x;
            const dy = nextWaypoint.y - this.sprite.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Reached waypoint? Move to next
            if (distance < 8) {
                this.pathIndex++;

                // Reached end of path? Choose new target
                if (this.pathIndex >= this.currentPath.length) {
                    this.patrolReachedTime = time; // Mark when we reached the final waypoint
                    this.chooseNewPatrolTarget(time);
                    return;
                }
                return; // Let next frame handle the new waypoint
            }

            // Move toward current waypoint
            const velocityX = (dx / distance) * this.config.patrol.speed;
            const velocityY = (dy / distance) * this.config.patrol.speed;
            this.sprite.body.setVelocity(velocityX, velocityY);

            // Update direction and animation
            this.direction = this.calculateDirection(dx, dy);
            this.playAnimation('walk', this.direction);
            this.isMoving = true;

            // console.log(`🚶 [${this.npcId}] Patrol waypoint ${this.pathIndex + 1}/${this.currentPath.length} - velocity: (${velocityX.toFixed(0)}, ${velocityY.toFixed(0)})`);
        } else {
            // No path found, choose new target
            this.chooseNewPatrolTarget(time);
        }
    }

    chooseNewPatrolTarget(time) {
        // Check if using waypoint patrol
        if (this.config.patrol.waypoints && this.config.patrol.waypoints.length > 0) {
            this.chooseWaypointTarget(time);
        } else {
            // Fall back to random patrol
            this.chooseRandomPatrolTarget(time);
        }
    }

    /**
     * Choose target from waypoint list
     */
    chooseWaypointTarget(time) {
        let nextWaypoint;

        if (this.config.patrol.waypointMode === 'sequential') {
            // Sequential: follow waypoints in order
            nextWaypoint = this.config.patrol.waypoints[this.config.patrol.waypointIndex];
            this.config.patrol.waypointIndex = (this.config.patrol.waypointIndex + 1) % this.config.patrol.waypoints.length;
        } else {
            // Random: pick random waypoint
            const randomIndex = Math.floor(Math.random() * this.config.patrol.waypoints.length);
            nextWaypoint = this.config.patrol.waypoints[randomIndex];
        }

        if (!nextWaypoint) {
            console.warn(`⚠️ [${this.npcId}] No valid waypoint, falling back to random patrol`);
            this.chooseRandomPatrolTarget(time);
            return;
        }

        this.patrolTarget = {
            x: nextWaypoint.worldX,
            y: nextWaypoint.worldY,
            dwellTime: nextWaypoint.dwellTime || 0
        };

        this.lastPatrolChange = time;
        this.pathIndex = 0;
        this.currentPath = [];
        this.patrolReachedTime = 0;

        // Request pathfinding to waypoint
        const pathfindingManager = this.pathfindingManager || window.pathfindingManager;
        if (!pathfindingManager) {
            console.warn(`⚠️ No pathfinding manager for ${this.npcId}`);
            return;
        }

        pathfindingManager.findPath(
            this.roomId,
            this.sprite.x,
            this.sprite.y,
            nextWaypoint.worldX,
            nextWaypoint.worldY,
            (path) => {
                if (path && path.length > 0) {
                    this.currentPath = path;
                    this.pathIndex = 0;
                    // console.log(`✅ [${this.npcId}] New waypoint path with ${path.length} waypoints to (${nextWaypoint.tileX}, ${nextWaypoint.tileY})`);
                } else {
                    console.warn(`⚠️ [${this.npcId}] Pathfinding to waypoint failed, unreachable`);
                    this.currentPath = [];
                    this.patrolTarget = null;
                }
            }
        );
    }

    /**
     * Choose random patrol target (original behavior)
     */
    chooseRandomPatrolTarget(time) {
        // Ensure we have the latest pathfinding manager reference
        const pathfindingManager = this.pathfindingManager || window.pathfindingManager;
        
        if (!pathfindingManager) {
            console.warn(`⚠️ No pathfinding manager for ${this.npcId}`);
            return;
        }

        // Get random target position using pathfinding manager
        const targetPos = pathfindingManager.getRandomPatrolTarget(this.roomId);
        if (!targetPos) {
            console.warn(`⚠️ Could not find random patrol target for ${this.npcId}`);
            // Fall back to idle if can't find a target
            this.sprite.body.setVelocity(0, 0);
            this.playAnimation('idle', this.direction);
            this.isMoving = false;
            return;
        }

        this.patrolTarget = targetPos;
        this.lastPatrolChange = time;
        this.pathIndex = 0;
        this.currentPath = [];

        // Request pathfinding from current position to target
        pathfindingManager.findPath(
            this.roomId,
            this.sprite.x,
            this.sprite.y,
            targetPos.x,
            targetPos.y,
            (path) => {
                if (path && path.length > 0) {
                    this.currentPath = path;
                    this.pathIndex = 0;
                    console.log(`✅ [${this.npcId}] New patrol path with ${path.length} waypoints`);
                } else {
                    console.warn(`⚠️ [${this.npcId}] Pathfinding failed, target unreachable`);
                    this.currentPath = [];
                    this.patrolTarget = null;
                }
            }
        );
    }

    maintainPersonalSpace(playerPos, delta) {
        if (!this.config.personalSpace.enabled || !playerPos) {
            return false;
        }

        const dx = this.sprite.x - playerPos.x;  // Away from player
        const dy = this.sprite.y - playerPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) return false; // Avoid division by zero

        // Back away slowly in small increments (5px at a time)
        const backAwayDist = this.config.personalSpace.backAwayDistance;
        const targetX = this.sprite.x + (dx / distance) * backAwayDist;
        const targetY = this.sprite.y + (dy / distance) * backAwayDist;

        // Try to move to target position
        const oldX = this.sprite.x;
        const oldY = this.sprite.y;
        this.sprite.setPosition(targetX, targetY);

        // If position didn't change, we're blocked by a wall
        if (this.sprite.x === oldX && this.sprite.y === oldY) {
            // Can't back away - just face player
            this.facePlayer(playerPos);
            return true; // Still in personal space violation
        }

        // Successfully backed away - face player while backing
        this.direction = this.calculateDirection(-dx, -dy);  // Negative = face player
        this.playAnimation('idle', this.direction);  // Use idle, not walk

        this.isMoving = false;  // Not "walking", just adjusting position
        this.backingAway = true;

        return true; // Personal space behavior active
    }

    updateHostileBehavior(playerPos, delta) {
        if (!this.hostile || !playerPos) return false;

        // Stub for future chase/flee implementation
        console.log(`[${this.npcId}] Hostile mode active (influence: ${this.influence})`);

        return false; // Not actively chasing/fleeing yet
    }

    calculateDirection(dx, dy) {
        const absVX = Math.abs(dx);
        const absVY = Math.abs(dy);

        // Threshold: if one axis is > 2x the other, consider it pure cardinal
        if (absVX > absVY * 2) {
            return dx > 0 ? 'right' : 'left';
        }

        if (absVY > absVX * 2) {
            return dy > 0 ? 'down' : 'up';
        }

        // Diagonal
        if (dy > 0) {
            return dx > 0 ? 'down-right' : 'down-left';
        } else {
            return dx > 0 ? 'up-right' : 'up-left';
        }
    }

    playAnimation(state, direction) {
        // Map left directions to right with flipX
        let animDirection = direction;
        let flipX = false;

        if (direction.includes('left')) {
            animDirection = direction.replace('left', 'right');
            flipX = true;
        }

        const animKey = `npc-${this.npcId}-${state}-${animDirection}`;

        // Only change animation if different
        if (this.lastAnimationKey !== animKey) {
            // Use scene.anims to check if animation exists in the global animation manager
            if (this.scene?.anims?.exists(animKey)) {
                this.sprite.play(animKey, true);
                this.lastAnimationKey = animKey;
            } else {
                // Fallback: use idle animation if walk doesn't exist
                if (state === 'walk') {
                    const idleKey = `npc-${this.npcId}-idle-${animDirection}`;
                    if (this.scene?.anims?.exists(idleKey)) {
                        this.sprite.play(idleKey, true);
                        this.lastAnimationKey = idleKey;
                        console.warn(`⚠️ [${this.npcId}] Walk animation missing, using idle: ${idleKey}`);
                    } else {
                        console.error(`❌ [${this.npcId}] BOTH animations missing! Walk: ${animKey}, Idle: ${idleKey}`);
                    }
                }
            }
        }

        // Set flipX for left-facing directions
        this.sprite.setFlipX(flipX);
    }

    updateDepth() {
        if (!this.sprite || !this.sprite.body) return;

        // Calculate depth based on bottom Y position (same as player)
        const spriteBottomY = this.sprite.y + (this.sprite.displayHeight / 2);
        const depth = spriteBottomY + 0.5; // World Y + sprite layer offset

        // Always update depth - no caching
        // Depth determines Y-sorting, must update every frame for moving NPCs
        this.sprite.setDepth(depth);
    }

    setState(property, value) {
        switch (property) {
            case 'hostile':
                this.setHostile(value);
                break;

            case 'influence':
                this.setInfluence(value);
                break;

            case 'patrol':
                this.config.patrol.enabled = value;
                console.log(`🚶 ${this.npcId} patrol ${value ? 'enabled' : 'disabled'}`);
                break;

            case 'personalSpaceDistance':
                this.config.personalSpace.distance = value;
                this.config.personalSpace.distanceSq = value ** 2;
                console.log(`↔️ ${this.npcId} personal space: ${value}px`);
                break;

            default:
                console.warn(`⚠️ Unknown behavior property: ${property}`);
        }
    }

    setHostile(hostile) {
        if (this.hostile === hostile) return; // No change

        this.hostile = hostile;

        // Emit event for other systems to react
        if (window.eventDispatcher) {
            window.eventDispatcher.emit('npc_hostile_changed', {
                npcId: this.npcId,
                hostile: hostile
            });
        }

        if (hostile) {
            // Red tint (0xff0000 with 50% strength)
            this.sprite.setTint(0xff6666);
            console.log(`🔴 ${this.npcId} is now hostile`);
        } else {
            // Clear tint
            this.sprite.clearTint();
            console.log(`✅ ${this.npcId} is no longer hostile`);
        }
    }

    setInfluence(influence) {
        this.influence = influence;

        // Check if influence change should trigger hostile state
        const threshold = this.config.hostile.influenceThreshold;

        // Auto-trigger hostile if influence drops below threshold
        if (influence < threshold && !this.hostile) {
            this.setHostile(true);
            console.log(`⚠️ ${this.npcId} became hostile due to low influence (${influence} < ${threshold})`);
        }
        // Auto-disable hostile if influence recovers
        else if (influence >= threshold && this.hostile) {
            this.setHostile(false);
            console.log(`✅ ${this.npcId} no longer hostile (influence: ${influence})`);
        }

        console.log(`💯 ${this.npcId} influence: ${influence}`);
    }
}

// Export for module imports
export default {
    NPCBehaviorManager,
    NPCBehavior
};
