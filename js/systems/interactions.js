// Object interaction system
import { INTERACTION_RANGE, INTERACTION_RANGE_SQ, INTERACTION_CHECK_INTERVAL } from '../utils/constants.js?v=7';
import { rooms } from '../core/rooms.js?v=16';
import { handleUnlock } from './unlock-system.js';
import { collectFingerprint, handleBiometricScan } from './biometrics.js';
import { addToInventory, removeFromInventory, createItemIdentifier } from './inventory.js';

let gameRef = null;

export function setGameInstance(gameInstance) {
    gameRef = gameInstance;
}

export function checkObjectInteractions() {
    // Skip if not enough time has passed since last check
    const currentTime = performance.now();
    if (this.lastInteractionCheck && 
        currentTime - this.lastInteractionCheck < INTERACTION_CHECK_INTERVAL) {
        return;
    }
    this.lastInteractionCheck = currentTime;

    const player = window.player;
    if (!player) {
        return; // Player not created yet
    }

    // Cache player position
    const px = player.x;
    const py = player.y;
    
    // Get viewport bounds for performance optimization
    const camera = gameRef ? gameRef.cameras.main : null;
    const margin = INTERACTION_RANGE * 2; // Larger margin to catch more objects
    const viewBounds = camera ? {
        left: camera.scrollX - margin,
        right: camera.scrollX + camera.width + margin,
        top: camera.scrollY - margin,
        bottom: camera.scrollY + camera.height + margin
    } : null;

    // Check ALL objects in ALL rooms, not just current room
    Object.entries(rooms).forEach(([roomId, room]) => {
        if (!room.objects) return;
        
        Object.values(room.objects).forEach(obj => {
            // Skip inactive objects
            if (!obj.active) {
                return;
            }
            
            // Skip non-interactable objects (only highlight scenario items)
            if (!obj.interactable) {
                // Clear highlight if object was previously highlighted
                if (obj.isHighlighted) {
                    obj.isHighlighted = false;
                    obj.clearTint();
                }
                return;
            }
            
            // Skip objects outside viewport for performance (if viewport bounds available)
            if (viewBounds && (
                obj.x < viewBounds.left || 
                obj.x > viewBounds.right || 
                obj.y < viewBounds.top || 
                obj.y > viewBounds.bottom)) {
                // Clear highlight if object is outside viewport
                if (obj.isHighlighted) {
                    obj.isHighlighted = false;
                    obj.clearTint();
                }
                return;
            }

            // Use squared distance for performance
            const dx = px - obj.x;
            const dy = py - obj.y;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq <= INTERACTION_RANGE_SQ) {
                if (!obj.isHighlighted) {
                    obj.isHighlighted = true;
                    obj.setTint(0x4da6ff);  // Blue tint for interactable objects
                }
            } else if (obj.isHighlighted) {
                obj.isHighlighted = false;
                obj.clearTint();
            }
        });
    });
}

export function handleObjectInteraction(sprite) {
    console.log('OBJECT INTERACTION', { 
        name: sprite.name, 
        id: sprite.objectId,
        scenarioData: sprite.scenarioData
    });
    
    if (!sprite || !sprite.scenarioData) {
        console.warn('Invalid sprite or missing scenario data');
        return;
    }
    
    // Handle the Crypto Workstation
    if (sprite.scenarioData.type === "workstation") {
        window.openCryptoWorkstation();
        return;
    }
    
    // Handle the Notepad - open notes minigame
    if (sprite.scenarioData.type === "notepad") {
        if (window.startNotesMinigame) {
            // Check if notes minigame is specifically already running
            if (window.MinigameFramework && window.MinigameFramework.currentMinigame && 
                window.MinigameFramework.currentMinigame.navigateToNoteIndex) {
                console.log('Notes minigame already running, navigating to notepad note instead');
                // If notes minigame is already running, just navigate to the notepad note
                if (window.MinigameFramework.currentMinigame.navigateToNoteIndex) {
                    window.MinigameFramework.currentMinigame.navigateToNoteIndex(0);
                }
                return;
            }
            
            // Navigate to the notepad note (index 0) when clicking the notepad
            // Create a minimal item just for navigation - no auto-add needed
            const notepadItem = {
                scenarioData: {
                    type: 'notepad',
                    name: 'Notepad'
                }
            };
            window.startNotesMinigame(notepadItem, '', '', 0, false, false);
            return;
        }
    }
    
    // Handle the Bluetooth Scanner - only open minigame if it's already in inventory
    if (sprite.scenarioData.type === "bluetooth_scanner") {
        // Check if this is an inventory item (clicked from inventory)
        const isInventoryItem = sprite.objectId && sprite.objectId.startsWith('inventory_');
        
        if (isInventoryItem && window.startBluetoothScannerMinigame) {
            console.log('Starting bluetooth scanner minigame from inventory');
            window.startBluetoothScannerMinigame(sprite);
            return;
        }
        // If it's not in inventory, let it fall through to the takeable logic below
    }
    
    // Handle the Fingerprint Kit - only open minigame if it's already in inventory
    if (sprite.scenarioData.type === "fingerprint_kit") {
        // Check if this is an inventory item (clicked from inventory)
        const isInventoryItem = sprite.objectId && sprite.objectId.startsWith('inventory_');
        
        if (isInventoryItem && window.startBiometricsMinigame) {
            console.log('Starting biometrics minigame from inventory');
            window.startBiometricsMinigame(sprite);
            return;
        }
        // If it's not in inventory, let it fall through to the takeable logic below
    }
    
    // Handle the Lockpick Set - only open minigame if it's already in inventory
    if (sprite.scenarioData.type === "lockpick" || sprite.scenarioData.type === "lockpickset") {
        // Check if this is an inventory item (clicked from inventory)
        const isInventoryItem = sprite.objectId && sprite.objectId.startsWith('inventory_');
        
        if (isInventoryItem && window.startLockpickSetMinigame) {
            console.log('Starting lockpick set minigame from inventory');
            window.startLockpickSetMinigame(sprite);
            return;
        }
        // If it's not in inventory, let it fall through to the takeable logic below
    }
    
    // Handle biometric scanner interaction
    if (sprite.scenarioData.biometricType === 'fingerprint') {
        handleBiometricScan(sprite);
        return;
    }
    
    // Check for fingerprint collection possibility
    if (sprite.scenarioData.hasFingerprint) {
        // Check if player has fingerprint kit
        const hasKit = window.inventory.items.some(item => 
            item && item.scenarioData && 
            item.scenarioData.type === 'fingerprint_kit'
        );
        
        if (hasKit) {
            const sample = collectFingerprint(sprite);
            if (sample) {
                return; // Exit after collecting fingerprint
            }
        } else {
            window.gameAlert("You need a fingerprint kit to collect samples from this surface!", 'warning', 'Missing Equipment', 4000);
            return;
        }
    }
    
    // Skip range check for inventory items
    const isInventoryItem = window.inventory && window.inventory.items.includes(sprite);
    if (!isInventoryItem) {
        // Check if player is in range
        const player = window.player;
        if (!player) return;
        
        const dx = player.x - sprite.x;
        const dy = player.y - sprite.y;
        const distanceSq = dx * dx + dy * dy;
        
        if (distanceSq > INTERACTION_RANGE_SQ) {
            console.log('INTERACTION_OUT_OF_RANGE', { 
                objectName: sprite.name,
                objectId: sprite.objectId,
                distance: Math.sqrt(distanceSq),
                maxRange: Math.sqrt(INTERACTION_RANGE_SQ)
            });
            return;
        }
    }
    
    const data = sprite.scenarioData;
    
    // Check if item is locked
    if (data.locked === true) {
        console.log('ITEM LOCKED', data);
        handleUnlock(sprite, 'item');
        return;
    }
    
    // Handle container items (suitcase, briefcase, etc.)
    if (data.type === 'suitcase' || data.type === 'briefcase' || data.contents) {
        console.log('CONTAINER ITEM INTERACTION', data);
        
        // Check if container was unlocked but not yet collected
        if (data.isUnlockedButNotCollected) {
            console.log('CONTAINER UNLOCKED - LAUNCHING MINIGAME', data);
            handleContainerInteraction(sprite);
            return;
        }
        
        // If container is still locked, the unlock system will handle it
        // and set isUnlockedButNotCollected flag
        console.log('CONTAINER LOCKED - UNLOCK SYSTEM WILL HANDLE', data);
        return;
    }
    
    let message = `${data.name} `;
    if (data.observations) {
        message += `Observations: ${data.observations}\n`;
    }
    
    // For phone type objects, use the phone messages minigame
    if (data.type === 'phone' && (data.text || data.voice)) {
        console.log('Phone object detected:', { type: data.type, text: data.text, voice: data.voice });
        // Start the phone messages minigame
        if (window.MinigameFramework) {
            // Initialize the framework if not already done
            if (!window.MinigameFramework.mainGameScene && window.game) {
                window.MinigameFramework.init(window.game);
            }
            
            const messages = [];
            
            // Add text message if available
            if (data.text) {
                messages.push({
                    type: 'text',
                    sender: data.sender || 'Unknown',
                    text: data.text,
                    timestamp: data.timestamp || 'Unknown time',
                    read: false
                });
            }
            
            // Add voice message if available
            if (data.voice) {
                messages.push({
                    type: 'voice',
                    sender: data.sender || 'Unknown',
                    text: data.text || null, // text is optional for voice messages
                    voice: data.voice,
                    timestamp: data.timestamp || 'Unknown time',
                    read: false
                });
            }
            
            const minigameParams = {
                title: data.name || 'Phone Messages',
                messages: messages,
                observations: data.observations,
                lockable: sprite,
                onComplete: (success, result) => {
                    console.log('Phone messages minigame completed:', success, result);
                }
            };
            
            window.MinigameFramework.startMinigame('phone-messages', null, minigameParams);
            return; // Exit early since minigame handles the interaction
        }
    }
    
    // For text_file type objects, use the text file minigame
    if (data.type === 'text_file' && data.text) {
        console.log('Text file object detected:', { type: data.type, name: data.name, text: data.text });
        // Start the text file minigame
        if (window.MinigameFramework) {
            // Initialize the framework if not already done
            if (!window.MinigameFramework.mainGameScene && window.game) {
                window.MinigameFramework.init(window.game);
            }
            
            const minigameParams = {
                title: `Text File - ${data.name || 'Unknown File'}`,
                fileName: data.name || 'Unknown File',
                fileContent: data.text,
                fileType: data.fileType || 'text',
                observations: data.observations,
                lockable: sprite,
                source: data.source || 'Unknown Source',
                onComplete: (success, result) => {
                    console.log('Text file minigame completed:', success, result);
                }
            };
            
            window.MinigameFramework.startMinigame('text-file', null, minigameParams);
            return; // Exit early since minigame handles the interaction
        }
    }
    
    if (data.readable && data.text) {
        message += `Text: ${data.text}\n`;
        
        // For notes type objects, use the notes minigame
        if (data.type === 'notes' && data.text) {
            // Start the notes minigame
            if (window.startNotesMinigame) {
                window.startNotesMinigame(sprite, data.text, data.observations);
                return; // Exit early since minigame handles the interaction
            }
        }
        
        // Add readable text as a note (fallback for other readable objects)
        // Skip notepad items since they're handled specially
        if (data.text.trim().length > 0 && data.type !== 'notepad') {
            const addedNote = window.addNote(data.name, data.text, data.important || false);
            
            if (addedNote) {
                window.gameAlert(`Added "${data.name}" to your notes.`, 'info', 'Note Added', 3000);
                
                // If this is a note in the inventory, remove it after adding to notes list
                if (isInventoryItem && data.type === 'notes') {
                    setTimeout(() => {
                        if (removeFromInventory(sprite)) {
                            window.gameAlert(`Removed "${data.name}" from inventory after recording in notes.`, 'success', 'Inventory Updated', 3000);
                        }
                    }, 1000);
                }
            }
        }
    }
    
    if (data.takeable) {
        // Check if it's already in inventory
        const itemIdentifier = createItemIdentifier(sprite.scenarioData);
        const isInInventory = window.inventory.items.some(item => 
            item && createItemIdentifier(item.scenarioData) === itemIdentifier
        );
        
        if (!isInInventory) {
            console.log('INVENTORY ITEM ADDED', { item: itemIdentifier });
            addToInventory(sprite);
        }
    }
    
    // Show notification
    window.gameAlert(message, 'info', data.name, 5000);
}

// Handle container item interactions
function handleContainerInteraction(sprite) {
    const data = sprite.scenarioData;
    console.log('Handling container interaction:', data);
    
    // Check if container has contents
    if (!data.contents || data.contents.length === 0) {
        window.gameAlert(`${data.name} is empty.`, 'info', 'Empty Container', 3000);
        return;
    }
    
    // Start the container minigame
    if (window.startContainerMinigame) {
        window.startContainerMinigame(sprite, data.contents, data.takeable);
    } else {
        console.error('Container minigame not available');
        window.gameAlert('Container minigame not available', 'error', 'Error', 3000);
    }
}

// Export for global access
window.checkObjectInteractions = checkObjectInteractions;
window.handleObjectInteraction = handleObjectInteraction;
window.handleContainerInteraction = handleContainerInteraction;
