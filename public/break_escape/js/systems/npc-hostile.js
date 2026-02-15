import { COMBAT_CONFIG } from '../config/combat-config.js';
import { CombatEvents } from '../events/combat-events.js';
import { getNPCDirection } from './npc-sprites.js';

const npcHostileStates = new Map();

function createHostileState(npcId, config = {}) {
  return {
    isHostile: false,
    currentHP: config.maxHP || COMBAT_CONFIG.npc.defaultMaxHP,
    maxHP: config.maxHP || COMBAT_CONFIG.npc.defaultMaxHP,
    isKO: false,
    attackDamage: config.attackDamage || COMBAT_CONFIG.npc.defaultPunchDamage,
    attackRange: config.attackRange || COMBAT_CONFIG.npc.defaultPunchRange,
    attackCooldown: config.attackCooldown || COMBAT_CONFIG.npc.defaultAttackCooldown,
    lastAttackTime: 0
  };
}

export function initNPCHostileSystem() {
  console.log('✅ NPC hostile system initialized');

  return {
    setNPCHostile: (npcId, isHostile) => setNPCHostile(npcId, isHostile),
    isNPCHostile: (npcId) => isNPCHostile(npcId),
    getState: (npcId) => getNPCHostileState(npcId),
    damageNPC: (npcId, amount) => damageNPC(npcId, amount),
    isNPCKO: (npcId) => isNPCKO(npcId)
  };
}

function setNPCHostile(npcId, isHostile) {
  if (!npcId) {
    console.error('setNPCHostile: Invalid NPC ID');
    return false;
  }

  // Get or create state
  let state = npcHostileStates.get(npcId);
  if (!state) {
    state = createHostileState(npcId);
    npcHostileStates.set(npcId, state);
  }

  const wasHostile = state.isHostile;
  state.isHostile = isHostile;

  console.log(`⚔️ NPC ${npcId} hostile: ${wasHostile} → ${isHostile}`);

  // Emit event if state changed
  if (wasHostile !== isHostile && window.eventDispatcher) {
    console.log(`⚔️ Emitting NPC_HOSTILE_CHANGED for ${npcId} (isHostile=${isHostile})`);
    window.eventDispatcher.emit(CombatEvents.NPC_HOSTILE_CHANGED, {
      npcId,
      isHostile
    });
  } else if (wasHostile === isHostile) {
    console.log(`⚔️ State unchanged for ${npcId} (already ${wasHostile}), skipping event`);
  } else {
    console.warn(`⚔️ Event dispatcher not found, cannot emit NPC_HOSTILE_CHANGED`);
  }

  return true;
}

function isNPCHostile(npcId) {
  const state = npcHostileStates.get(npcId);
  return state ? state.isHostile : false;
}

function getNPCHostileState(npcId) {
  let state = npcHostileStates.get(npcId);
  if (!state) {
    state = createHostileState(npcId);
    npcHostileStates.set(npcId, state);
  }
  return state;
}

function damageNPC(npcId, amount) {
  const state = getNPCHostileState(npcId);
  if (!state) return false;

  if (state.isKO) {
    console.log(`NPC ${npcId} already KO`);
    return false;
  }

  const oldHP = state.currentHP;
  state.currentHP = Math.max(0, state.currentHP - amount);

  console.log(`NPC ${npcId} HP: ${oldHP} → ${state.currentHP}`);

  // Check for KO
  if (state.currentHP <= 0) {
    state.isKO = true;

    // Play death animation and disable physics after it completes
    const npc = window.npcManager?.getNPC(npcId);
    const sprite = npc?._sprite || npc?.sprite;
    if (sprite) {
      // Disable collisions immediately so player can walk through
      if (sprite.body) {
        sprite.body.setVelocity(0, 0);
        // Disable all collision checks but keep body enabled for animation
        sprite.body.checkCollision.none = true;
        console.log(`💀 Disabled collisions for ${npcId}, starting death animation`);
      }
      
      playNPCDeathAnimation(npcId, sprite);
      
      // Disable physics body completely after death animation completes
      // Use animationcomplete event to ensure all frames play
      sprite.once('animationcomplete', (anim) => {
        console.log(`💀 Animation complete event fired for ${npcId}, anim key: ${anim.key}`);
        if (anim.key.includes('death') && sprite && sprite.body && !sprite.destroyed) {
          sprite.body.enable = false; // Disable physics body entirely
          console.log(`💀 Disabled physics body for ${npcId} after animation complete`);
        }
      });
    }

    // Drop any items the NPC was holding
    dropNPCItems(npcId);

    if (window.eventDispatcher) {
      window.eventDispatcher.emit(CombatEvents.NPC_KO, { npcId });
    }
  }

  return true;
}

/**
 * Play death animation for NPC
 * @param {string} npcId - The NPC ID
 * @param {Phaser.GameObjects.Sprite} sprite - The NPC sprite
 */
function playNPCDeathAnimation(npcId, sprite) {
  if (!sprite || !sprite.scene) {
    console.warn(`⚠️ Cannot play death animation - invalid sprite for ${npcId}`);
    return;
  }

  // Get NPC's current facing direction
  const direction = getNPCDirection(npcId, sprite);
  
  // Build death animation key: npc-{npcId}-death-{direction}
  const deathAnimKey = `npc-${npcId}-death-${direction}`;
  
  if (sprite.scene.anims.exists(deathAnimKey)) {
    // Stop any current animation first
    if (sprite.anims.isPlaying) {
      sprite.anims.stop();
    }
    
    // Store original origin for restoration
    const originalOriginY = sprite.originY;
    
    // Add animation update listener to progressively shift visual display downward
    sprite.on('animationupdate', (anim, frame) => {
      if (anim.key === deathAnimKey) {
        // Calculate progress through animation (0 to 1)
        const totalFrames = anim.getTotalFrames();
        const currentFrame = frame.index;
        const progress = currentFrame / totalFrames;
        
        // Shift sprite's visual display downward by adjusting origin
        // This moves the texture down without changing sprite.y (keeps depth constant)
        // Decrease originY by ~0.5 to shift texture down by half sprite height (~40px for 80px sprite)
        const originOffset = progress * 0.5;
        sprite.setOrigin(sprite.originX, originalOriginY - originOffset);
      }
    });
    
    // Clean up listener when animation completes
    sprite.once('animationcomplete', (anim) => {
      if (anim.key === deathAnimKey) {
        sprite.off('animationupdate');
        // Origin stays shifted - defeated body appears lower visually but sprite.y unchanged
        // Depth remains constant, naturally rendering behind standing characters at same Y
      }
    });
    
    sprite.play(deathAnimKey);
    console.log(`💀 Playing NPC death animation: ${deathAnimKey}`);
  } else {
    console.warn(`⚠️ Death animation not found: ${deathAnimKey}`);
  }
}

/**
 * Drop items around a defeated NPC
 * Items spawn at NPC location and are launched outward with physics
 * They collide with walls, doors, and chairs so they stay in reach
 * @param {string} npcId - The NPC that was defeated
 */
function dropNPCItems(npcId) {
  const npc = window.npcManager?.getNPC(npcId);
  const sprite = npc?._sprite || npc?.sprite;
  if (!npc || !npc.itemsHeld || npc.itemsHeld.length === 0) {
    return;
  }

  // Use the sprite we already have and find its room
  if (!sprite) {
    console.warn(`⚠️ Cannot drop items - no sprite found for NPC: ${npcId}`);
    return;
  }

  // Find the NPC's room
  let npcRoomId = npc.roomId;

  if (!npcRoomId) {
    console.warn(`Could not find room for NPC ${npcId}`);
    return;
  }

  const room = window.rooms[npcRoomId];
  const gameRef = window.game;
  const itemCount = npc.itemsHeld.length;
  const launchSpeed = 200; // pixels per second
  
  npc.itemsHeld.forEach((item, index) => {
    // Calculate angle around the NPC for each item
    const angle = (index / itemCount) * Math.PI * 2;
    
    // All items spawn at NPC center location
    const spawnX = Math.round(sprite.x);
    const spawnY = Math.round(sprite.y);

    // Create actual Phaser sprite for the dropped item
    const texture = item.texture || item.type || 'key';
    const spriteObj = gameRef.add.sprite(spawnX, spawnY, texture);
    
    // Set origin to match standard object creation
    spriteObj.setOrigin(0, 0);
    
    // Create scenario data from the dropped item
    const droppedItemData = {
      ...item,
      type: item.type || 'dropped_item',
      name: item.name || 'Item',
      takeable: true,
      active: true,
      visible: true,
      interactable: true
    };
    
    // DEBUG: Log key properties if this is a key
    if (item.type === 'key') {
      console.log(`🔑 Dropped key "${item.name}":`, {
        source: 'npc-hostile.js dropNPCItems',
        item_key_id: item.key_id,
        item_keyPins: item.keyPins,
        droppedItemData_key_id: droppedItemData.key_id,
        droppedItemData_keyPins: droppedItemData.keyPins
      });
    }
    
    // Apply scenario properties to sprite
    spriteObj.scenarioData = droppedItemData;
    spriteObj.interactable = true;
    spriteObj.name = droppedItemData.name;
    spriteObj.objectId = `dropped_${npcId}_${index}_${Date.now()}`;
    spriteObj.takeable = true;
    spriteObj.type = droppedItemData.type;
    
    // Copy over all properties from the item
    Object.keys(droppedItemData).forEach(key => {
      spriteObj[key] = droppedItemData[key];
    });
    
    // Make the sprite interactive
    spriteObj.setInteractive({ useHandCursor: true });
    
    // Set up physics body for collision
    gameRef.physics.add.existing(spriteObj);
    spriteObj.body.setSize(24, 24);
    spriteObj.body.setOffset(4, 4);
    spriteObj.body.setBounce(0.3); // Reduced bounce
    spriteObj.body.setFriction(0.99, 0.99); // High friction to stop movement
    spriteObj.body.setDrag(0.99); // Drag coefficient to slow velocity
    
    // Launch item outward in the calculated angle
    const velocityX = Math.cos(angle) * launchSpeed;
    const velocityY = Math.sin(angle) * launchSpeed;
    spriteObj.body.setVelocity(velocityX, velocityY);
    
    // Set a timer to completely stop the item after a short time
    const stopDelay = 800; // Stop after 0.8 seconds
    gameRef.time.delayedCall(stopDelay, () => {
      if (spriteObj && spriteObj.body) {
        spriteObj.body.setVelocity(0, 0);
        spriteObj.body.setAcceleration(0, 0);
      }
    });
    
    // Set up collisions with walls
    if (room.wallCollisionBoxes) {
      room.wallCollisionBoxes.forEach(wallBox => {
        if (wallBox.body) {
          gameRef.physics.add.collider(spriteObj, wallBox);
        }
      });
    }
    
    // Set up collisions with closed doors
    if (room.doorSprites) {
      room.doorSprites.forEach(doorSprite => {
        if (doorSprite.body && doorSprite.body.immovable) {
          gameRef.physics.add.collider(spriteObj, doorSprite);
        }
      });
    }
    
    // Set up collisions with chairs and other immovable objects
    if (room.objects) {
      Object.values(room.objects).forEach(obj => {
        if (obj !== spriteObj && obj.body && obj.body.immovable) {
          gameRef.physics.add.collider(spriteObj, obj);
        }
      });
    }
    
    // Set depth using the existing depth calculation method
    // depth = objectBottomY + 0.5
    const objectBottomY = spriteObj.y + (spriteObj.height || 0);
    const objectDepth = objectBottomY + 0.5;
    spriteObj.setDepth(objectDepth);
    
    // Update depth each frame to follow Y position
    const originalUpdate = spriteObj.update?.bind(spriteObj);
    spriteObj.update = function() {
      if (originalUpdate) originalUpdate();
      const newDepth = this.y + (this.height || 0) + 0.5;
      this.setDepth(newDepth);
    };
    
    // Store in room.objects
    room.objects[spriteObj.objectId] = spriteObj;
    
    console.log(`💧 Dropped item ${droppedItemData.type} from ${npcId} at (${spawnX}, ${spawnY}), launching at angle ${(angle * 180 / Math.PI).toFixed(1)}°`);
  });

  // Clear the NPC's inventory
  npc.itemsHeld = [];
}

function isNPCKO(npcId) {
  const state = npcHostileStates.get(npcId);
  return state ? state.isKO : false;
}
