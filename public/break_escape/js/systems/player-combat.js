/**
 * Player Combat System
 * Handles player punch attacks on hostile NPCs
 */

import { COMBAT_CONFIG } from '../config/combat-config.js';

export class PlayerCombat {
  constructor(scene) {
    this.scene = scene;
    this.lastPunchTime = 0;
    this.isPunching = false;
    this.currentMode = 'interact'; // Default to interact mode

    console.log('✅ Player combat system initialized');
  }

  /**
   * Set interaction mode (interact, jab, cross)
   * @param {string} mode - The mode to set ('interact', 'jab', or 'cross')
   */
  setInteractionMode(mode) {
    if (!COMBAT_CONFIG.interactionModes[mode]) {
      console.error(`Invalid interaction mode: ${mode}`);
      return;
    }
    this.currentMode = mode;
    console.log(`🥊 Interaction mode set to: ${mode}`);
  }

  /**
   * Get current interaction mode
   * @returns {string}
   */
  getInteractionMode() {
    return this.currentMode;
  }

  /**
   * Get current mode configuration
   * @returns {object}
   */
  getCurrentModeConfig() {
    return COMBAT_CONFIG.interactionModes[this.currentMode];
  }

  /**
   * Check if player can punch (cooldown check)
   * @returns {boolean}
   */
  canPunch() {
    const modeConfig = this.getCurrentModeConfig();
    
    // Can't punch in interact mode
    if (!modeConfig.canPunch) {
      return false;
    }

    const now = Date.now();
    const timeSinceLast = now - this.lastPunchTime;
    const cooldown = modeConfig.cooldown || COMBAT_CONFIG.player.punchCooldown;
    return timeSinceLast >= cooldown;
  }

  /**
   * Perform punch attack
   * This is called when player interacts with a hostile NPC
   * Damage applies to ALL NPCs in punch range and facing direction
   */
  punch() {
    if (this.isPunching || !this.canPunch()) {
      console.log('Punch on cooldown');
      return false;
    }

    if (!window.player) {
      console.error('Player not found');
      return false;
    }

    this.isPunching = true;
    this.lastPunchTime = Date.now();

    // Play punch animation (placeholder: walk animation with red tint)
    this.playPunchAnimation();

    // After animation duration, check for hits
    this.scene.time.delayedCall(COMBAT_CONFIG.player.punchAnimationDuration, () => {
      this.checkForHits();
      this.isPunching = false;
    });

    return true;
  }

  /**
   * Map player directions to atlas compass directions
   */
  mapDirectionToCompass(direction) {
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
    return directionMap[direction] || 'south';
  }

  /**
   * Play punch animation - uses current mode's animation (lead-jab or cross-punch)
   */
  playPunchAnimation() {
    if (!window.player) return;

    const player = window.player;
    const direction = player.lastDirection || 'down';
    const compassDir = this.mapDirectionToCompass(direction);
    
    // Get current mode's animation key
    const modeConfig = this.getCurrentModeConfig();
    const animationBase = modeConfig.animationKey; // 'lead-jab' or 'cross-punch'
    
    if (!animationBase) {
      console.log('⚠️ Current mode has no punch animation');
      return;
    }
    
    const animKey = `${animationBase}_${compassDir}`;
    
    console.log(`🥊 Punch attempt: mode=${this.currentMode}, direction=${direction}, compass=${compassDir}`);
    console.log(`  - Trying: ${animKey} (exists: ${this.scene.anims.exists(animKey)})`);
    
    let animPlayed = false;
    
    // Try to play the mode's animation
    if (this.scene.anims.exists(animKey)) {
      console.log(`  ✓ Found ${animKey}, playing...`);
      player.anims.play(animKey, true);
      animPlayed = true;
      console.log(`  - After play: currentAnim=${player.anims.currentAnim?.key}, visible=${player.visible}, alpha=${player.alpha}`);
    }
    
    if (animPlayed) {
      console.log(`🥊 Playing punch animation: ${animKey}`);
      // Animation will complete naturally
      // Listen for animation complete event to return to idle
      player.once('animationcomplete', () => {
        const idleKey = `idle-${direction}`;
        if (player.anims && player.anims.exists && this.scene.anims.exists(idleKey)) {
          player.anims.play(idleKey, true);
        }
      });
    } else {
      // Fallback: red tint + walk animation
      console.log(`⚠️ No punch animation found (tried ${animKey}), using fallback (red tint)`);
      
      // Apply red tint
      if (window.spriteEffects) {
        window.spriteEffects.applyAttackTint(player);
      }

      // Play walk animation if not already playing
      if (!player.anims.isPlaying) {
        const walkKey = `walk-${direction}`;
        if (this.scene.anims.exists(walkKey)) {
          player.play(walkKey, true);
        }
      }

      // Remove tint after animation
      this.scene.time.delayedCall(COMBAT_CONFIG.player.punchAnimationDuration, () => {
        if (window.spriteEffects) {
          window.spriteEffects.clearAttackTint(player);
        }
        // Stop animation
        player.anims.stop();
      });
    }
  }

  /**
   * Check for hits on NPCs in range and direction
   * Applies AOE damage to all NPCs in punch range AND facing direction
   */
  checkForHits() {
    if (!window.player) {
      return;
    }

    const playerX = window.player.x;
    const playerY = window.player.y;
    const punchRange = COMBAT_CONFIG.player.punchRange;
    
    // Get damage from current mode
    const modeConfig = this.getCurrentModeConfig();
    const punchDamage = modeConfig.damage || COMBAT_CONFIG.player.punchDamage;

    // Get player facing direction
    const direction = window.player.lastDirection || 'down';

    // Get all NPCs from rooms
    let hitCount = 0;
    
    if (window.rooms) {
      for (const roomId in window.rooms) {
        const room = window.rooms[roomId];
        if (!room.npcSprites) continue;

        room.npcSprites.forEach(npcSprite => {
          if (!npcSprite || !npcSprite.npcId) return;

          const npcId = npcSprite.npcId;
          const isHostile = window.npcHostileSystem.isNPCHostile(npcId);

          // Don't damage NPCs that are already KO
          if (window.npcHostileSystem.isNPCKO(npcId)) {
            return;
          }

          const npcX = npcSprite.x;
          const npcY = npcSprite.y;
          const distance = Phaser.Math.Distance.Between(playerX, playerY, npcX, npcY);

          if (distance > punchRange) {
            return; // Too far
          }

          // Check if NPC is in the facing direction
          if (!this.isInDirection(playerX, playerY, npcX, npcY, direction)) {
            return; // Not in facing direction
          }

          // Hit detected!
          // If NPC is not hostile, convert them to hostile
          if (!isHostile) {
            console.log(`💢 Player attacked non-hostile NPC ${npcId} - converting to hostile!`);
            window.npcHostileSystem.setNPCHostile(npcId, true);
            // NPC behavior system automatically detects hostile state changes
          }

          // Damage the NPC (now hostile or was already hostile)
          this.applyDamage(npcId, punchDamage);
          hitCount++;
        });
      }
    }

    // Check for chairs in range and direction
    let chairsHit = 0;
    if (window.chairs && window.chairs.length > 0) {
      window.chairs.forEach(chair => {
        // Only kick swivel chairs with physics bodies
        if (!chair.isSwivelChair || !chair.body) {
          return;
        }

        const chairX = chair.x;
        const chairY = chair.y;
        const distance = Phaser.Math.Distance.Between(playerX, playerY, chairX, chairY);

        if (distance > punchRange) {
          return; // Too far
        }

        // Check if chair is in the facing direction
        if (!this.isInDirection(playerX, playerY, chairX, chairY, direction)) {
          return; // Not in facing direction
        }

        // Hit landed! Kick the chair
        this.kickChair(chair);
        chairsHit++;
      });
    }

    if (hitCount > 0) {
      console.log(`Player punch hit ${hitCount} NPC(s)`);
    }
    if (chairsHit > 0) {
      console.log(`Player punch hit ${chairsHit} chair(s)`);
    }
    if (hitCount === 0 && chairsHit === 0) {
      console.log('Player punch missed');
    }
  }

  /**
   * Check if target is in the player's facing direction
   * @param {number} playerX
   * @param {number} playerY
   * @param {number} targetX
   * @param {number} targetY
   * @param {string} direction - 'up', 'down', 'left', 'right'
   * @returns {boolean}
   */
  isInDirection(playerX, playerY, targetX, targetY, direction) {
    const dx = targetX - playerX;
    const dy = targetY - playerY;

    switch (direction) {
      case 'up':
        return dy < 0 && Math.abs(dy) > Math.abs(dx);
      case 'down':
        return dy > 0 && Math.abs(dy) > Math.abs(dx);
      case 'left':
        return dx < 0 && Math.abs(dx) > Math.abs(dy);
      case 'right':
        return dx > 0 && Math.abs(dx) > Math.abs(dy);
      default:
        return false;
    }
  }

  /**
   * Apply damage to NPC
   * @param {string|Object} npcIdOrNPC - NPC ID string or NPC object
   * @param {number} damage - Damage amount
   */
  applyDamage(npcIdOrNPC, damage) {
    if (!window.npcHostileSystem) return;

    // Get npcId
    let npcId;
    let npcSprite = null;
    
    if (typeof npcIdOrNPC === 'string') {
      npcId = npcIdOrNPC;
      // Find the sprite for this NPC
      if (window.rooms) {
        for (const roomId in window.rooms) {
          const room = window.rooms[roomId];
          if (!room.npcSprites) continue;
          for (const sprite of room.npcSprites) {
            if (sprite.npcId === npcId) {
              npcSprite = sprite;
              break;
            }
          }
          if (npcSprite) break;
        }
      }
    } else {
      npcId = npcIdOrNPC.id;
      npcSprite = npcIdOrNPC.sprite;
    }

    // Apply damage
    window.npcHostileSystem.damageNPC(npcId, damage);

    // Visual feedback
    if (npcSprite && window.spriteEffects) {
      window.spriteEffects.flashDamage(npcSprite);
    }

    // Damage numbers
    if (npcSprite && window.damageNumbers) {
      window.damageNumbers.show(npcSprite.x, npcSprite.y - 30, damage, 'damage');
    }

    // Screen shake (light)
    if (window.screenEffects) {
      window.screenEffects.shakeNPCHit();
    }

    console.log(`Dealt ${damage} damage to ${npcId}`);
  }

  /**
   * Apply kick velocity to chair
   * @param {Phaser.GameObjects.Sprite} chair - Chair sprite
   */
  kickChair(chair) {
    if (!chair || !chair.body || !window.player) {
      return;
    }

    // Calculate direction from player to chair
    const dx = chair.x - window.player.x;
    const dy = chair.y - window.player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      // Normalize the direction vector
      const dirX = dx / distance;
      const dirY = dy / distance;

      // Apply a strong kick velocity
      const kickForce = 1200; // Pixels per second
      chair.body.setVelocity(dirX * kickForce, dirY * kickForce);

      // Trigger spin direction calculation for visual rotation
      if (window.calculateChairSpinDirection) {
        window.calculateChairSpinDirection(window.player, chair);
      }

      // Visual feedback - flash the chair
      if (window.spriteEffects) {
        window.spriteEffects.flashHit(chair);
      }

      // Light screen shake
      if (window.screenEffects) {
        window.screenEffects.shake(2, 150);
      }

      console.log('CHAIR KICKED', {
        chairName: chair.name,
        velocity: { x: dirX * kickForce, y: dirY * kickForce }
      });
    }
  }
}
