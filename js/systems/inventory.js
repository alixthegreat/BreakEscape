// Inventory System
// Handles inventory management and display

import { rooms } from '../core/rooms.js';

// Helper function to create a unique identifier for an item
export function createItemIdentifier(scenarioData) {
    if (!scenarioData) return 'unknown';
    return `${scenarioData.type}_${scenarioData.name || 'unnamed'}`;
}

// Initialize the inventory system
export function initializeInventory() {
    console.log('Inventory system initialized');
    
    // Initialize inventory state
    window.inventory = {
        items: [],
        container: null
    };
    
    // Get the HTML inventory container
    const inventoryContainer = document.getElementById('inventory-container');
    if (!inventoryContainer) {
        console.error('Inventory container not found');
        return;
    }
    
    inventoryContainer.innerHTML = '';
    
    // Store reference to container
    window.inventory.container = inventoryContainer;
    
    // Add notepad to inventory
    addNotepadToInventory();
    
    console.log('INVENTORY INITIALIZED', window.inventory);
}

// Process initial inventory items
export function processInitialInventoryItems() {
    console.log('Processing initial inventory items');
    
    if (!window.gameScenario || !window.gameScenario.rooms) {
        console.error('Game scenario not loaded');
        return;
    }
    
    // Loop through all rooms in the scenario
    Object.entries(window.gameScenario.rooms).forEach(([roomId, roomData]) => {
        if (roomData.objects && Array.isArray(roomData.objects)) {
            roomData.objects.forEach(obj => {
                // Check if this object should start in inventory
                if (obj.inInventory === true) {
                    console.log(`Adding ${obj.name} to inventory from scenario data`);
                    
                    // Create inventory sprite for this object
                    const inventoryItem = createInventorySprite(obj);
                    if (inventoryItem) {
                        addToInventory(inventoryItem);
                    }
                }
            });
        }
    });
}

function createInventorySprite(itemData) {
    try {
        // Create a pseudo-sprite object that can be used in inventory
        const sprite = {
            name: itemData.type,
            objectId: `inventory_${itemData.type}_${Date.now()}`,
            scenarioData: itemData,
            setVisible: function(visible) {
                // For inventory items, visibility is handled by DOM
                return this;
            }
        };
        
        console.log('Created inventory sprite:', sprite);
        return sprite;
    } catch (error) {
        console.error('Error creating inventory sprite:', error);
        return null;
    }
}

export function addToInventory(sprite) {
    if (!sprite || !sprite.scenarioData) {
        console.warn('Invalid sprite for inventory');
        return false;
    }
    
    try {
        console.log("Adding to inventory:", {
            objectId: sprite.objectId,
            name: sprite.name,
            type: sprite.scenarioData?.type,
            currentRoom: window.currentPlayerRoom
        });
        
        // Check if the item is already in the inventory
        const itemIdentifier = createItemIdentifier(sprite.scenarioData);
        const isAlreadyInInventory = window.inventory.items.some(item => 
            item && createItemIdentifier(item.scenarioData) === itemIdentifier
        );
        
        if (isAlreadyInInventory) {
            console.log(`Item ${itemIdentifier} is already in inventory`);
            return false;
        }
        
        // Remove from room if it exists
        if (window.currentPlayerRoom && rooms[window.currentPlayerRoom] && rooms[window.currentPlayerRoom].objects) {
            if (rooms[window.currentPlayerRoom].objects[sprite.objectId]) {
                const roomObj = rooms[window.currentPlayerRoom].objects[sprite.objectId];
                if (roomObj.setVisible) {
                    roomObj.setVisible(false);
                }
                roomObj.active = false;
                console.log(`Removed object ${sprite.objectId} from room`);
            }
        }
        
        // Only call setVisible if it's a Phaser sprite with that method
        if (sprite.setVisible && typeof sprite.setVisible === 'function') {
            sprite.setVisible(false);
        }
        
        // Special handling for keys - group them together
        if (sprite.scenarioData.type === 'key') {
            return addKeyToInventory(sprite);
        }
        
        // Create a new slot for this item
        const inventoryContainer = document.getElementById('inventory-container');
        if (!inventoryContainer) {
            console.error('Inventory container not found');
            return false;
        }
        
        // Create a new slot
        const slot = document.createElement('div');
        slot.className = 'inventory-slot';
        inventoryContainer.appendChild(slot);
        
        // Create inventory item
        const itemImg = document.createElement('img');
        itemImg.className = 'inventory-item';
        itemImg.src = `assets/objects/${sprite.texture?.key || sprite.name || sprite.scenarioData?.type}.png`;
        itemImg.alt = sprite.scenarioData.name;
        
        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'inventory-tooltip';
        tooltip.textContent = sprite.scenarioData.name;
        
        // Add item data
        itemImg.scenarioData = sprite.scenarioData;
        itemImg.name = sprite.name;
        itemImg.objectId = 'inventory_' + sprite.objectId;
        
        // Mark as non-takeable once in inventory (so it won't try to be picked up again)
        itemImg.scenarioData.takeable = false;
        
        // Add click handler
        itemImg.addEventListener('click', function() {
            if (window.handleObjectInteraction) {
                window.handleObjectInteraction(this);
            }
        });
        
        // Add to slot
        slot.appendChild(itemImg);
        slot.appendChild(tooltip);
        
        // Add to inventory array
        window.inventory.items.push(itemImg);
        
        // Apply pulse animation to the slot instead of showing notification
        slot.classList.add('pulse');
        // Remove the pulse class after the animation completes
        setTimeout(() => {
            slot.classList.remove('pulse');
        }, 600);
        
        // If this is the Bluetooth scanner, automatically open the minigame after adding to inventory
        if (sprite.scenarioData.type === "bluetooth_scanner" && window.startBluetoothScannerMinigame) {
            // Small delay to ensure the item is fully added to inventory
            setTimeout(() => {
                console.log('Auto-opening bluetooth scanner minigame after adding to inventory');
                window.startBluetoothScannerMinigame(itemImg);
            }, 500);
        }
        
        
        // Fingerprint kit is now handled as a minigame when clicked from inventory
        
        // Handle crypto workstation - use the proper modal implementation from helpers.js
        if (sprite.scenarioData.type === "workstation") {
            // Don't override the openCryptoWorkstation function - it's already properly defined in helpers.js
            console.log('Crypto workstation added to inventory - modal function available');
        }
        
        return true;
    } catch (error) {
        console.error('Error adding to inventory:', error);
        return false;
    }
}

// Key management functions
function addKeyToInventory(sprite) {
    // Initialize key ring if it doesn't exist
    if (!window.inventory.keyRing) {
        window.inventory.keyRing = {
            keys: [],
            slot: null,
            itemImg: null
        };
    }
    
    // Add the key to the key ring
    window.inventory.keyRing.keys.push(sprite);
    
    // Update or create the key ring display
    updateKeyRingDisplay();
    
    // Apply pulse animation to the key ring slot instead of showing notification
    const keyRingSlot = window.inventory.keyRing.slot;
    if (keyRingSlot) {
        keyRingSlot.classList.add('pulse');
        setTimeout(() => {
            keyRingSlot.classList.remove('pulse');
        }, 600);
    }
    
    return true;
}

function updateKeyRingDisplay() {
    const keyRing = window.inventory.keyRing;
    if (!keyRing || keyRing.keys.length === 0) {
        // Remove key ring display if no keys
        if (keyRing && keyRing.slot) {
            keyRing.slot.remove();
            keyRing.slot = null;
            keyRing.itemImg = null;
        }
        return;
    }
    
    const inventoryContainer = document.getElementById('inventory-container');
    if (!inventoryContainer) {
        console.error('Inventory container not found');
        return;
    }
    
    // Remove existing key ring slot if it exists
    if (keyRing.slot) {
        keyRing.slot.remove();
    }
    
    // Create new slot for key ring
    const slot = document.createElement('div');
    slot.className = 'inventory-slot';
    inventoryContainer.appendChild(slot);
    
    // Create key ring item
    const itemImg = document.createElement('img');
    itemImg.className = 'inventory-item';
    itemImg.src = keyRing.keys.length === 1 ? `assets/objects/key.png` : `assets/objects/key-ring.png`;
    itemImg.alt = keyRing.keys.length === 1 ? keyRing.keys[0].scenarioData.name : 'Key Ring';
    
    // Add data attributes for styling
    itemImg.setAttribute('data-type', 'key_ring');
    itemImg.setAttribute('data-key-count', keyRing.keys.length);
    
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'inventory-tooltip';
    tooltip.textContent = keyRing.keys.length === 1 ? keyRing.keys[0].scenarioData.name : 'Key Ring';
    
    // Add item data - use the first key's data as the primary data
    itemImg.scenarioData = {
        ...keyRing.keys[0].scenarioData,
        name: keyRing.keys.length === 1 ? keyRing.keys[0].scenarioData.name : 'Key Ring',
        type: 'key_ring',
        keyCount: keyRing.keys.length,
        allKeys: keyRing.keys.map(k => k.scenarioData)
    };
    itemImg.name = 'key';
    itemImg.objectId = 'inventory_key_ring';
    
    // Add click handler for key ring
    itemImg.addEventListener('click', function() {
        if (window.handleKeyRingInteraction) {
            window.handleKeyRingInteraction(this);
        }
    });
    
    // Add to slot
    slot.appendChild(itemImg);
    slot.appendChild(tooltip);
    
    // Store references
    keyRing.slot = slot;
    keyRing.itemImg = itemImg;
    
    // Add to inventory array (replace any existing key ring item)
    const existingKeyRingIndex = window.inventory.items.findIndex(item => 
        item && item.scenarioData && item.scenarioData.type === 'key_ring'
    );
    
    if (existingKeyRingIndex !== -1) {
        window.inventory.items[existingKeyRingIndex] = itemImg;
    } else {
        window.inventory.items.push(itemImg);
    }
}

function handleKeyRingInteraction(keyRingItem) {
    const keyRing = window.inventory.keyRing;
    if (!keyRing || keyRing.keys.length === 0) {
        return;
    }
    
    if (keyRing.keys.length === 1) {
        // Single key - handle normally
        if (window.handleObjectInteraction) {
            window.handleObjectInteraction(keyRingItem);
        }
    } else {
        // Multiple keys - show list
        const keyNames = keyRing.keys.map(key => key.scenarioData.name).join('\n• ');
        const message = `Key Ring contains ${keyRing.keys.length} keys:\n• ${keyNames}`;
        
        if (window.gameAlert) {
            window.gameAlert(message, 'info', 'Key Ring', 0);
        }
    }
}

// Add notepad to inventory
function addNotepadToInventory() {
    // Check if notepad is already in inventory
    const notepadExists = window.inventory.items.some(item => 
        item && item.scenarioData && item.scenarioData.type === 'notepad'
    );
    
    if (notepadExists) {
        console.log('Notepad already in inventory');
        return;
    }
    
    // Create notepad item data
    const notepadData = {
        type: 'notepad',
        name: 'Notepad',
        takeable: true,
        readable: true,
        text: 'Use this notepad to review your collected notes and observations.',
        observations: 'A handy notepad for keeping track of important information.'
    };
    
    // Create a mock sprite object for the notepad
    const notepadSprite = {
        name: 'notes5',
        objectId: 'notepad_inventory',
        scenarioData: notepadData,
        setVisible: function(visible) {
            // For inventory items, visibility is handled by DOM
            return this;
        }
    };
    
    // Add to inventory
    addToInventory(notepadSprite);
    
    // Also add the notepad as a note at the beginning of the notes collection
    if (window.addNote) {
        const notepadText = 'Use this notepad to review your collected notes and observations.\n\nObservation: A handy notepad for keeping track of important information.';
        const notepadNote = window.addNote('Notepad', notepadText, false);
        if (notepadNote) {
            // Move the notepad note to the beginning of the notes array
            const notes = window.gameState.notes;
            const notepadIndex = notes.findIndex(note => note.id === notepadNote.id);
            if (notepadIndex !== -1) {
                const notepadNoteItem = notes.splice(notepadIndex, 1)[0];
                notes.unshift(notepadNoteItem); // Add to beginning
                console.log('Notepad note with observations added to beginning of notes collection during inventory setup');
            }
        }
    }
}

// Remove item from inventory
export function removeFromInventory(item) {
    try {
        // Find the item in the inventory array
        const itemIndex = window.inventory.items.indexOf(item);
        if (itemIndex === -1) return false;
        
        // Remove from array
        window.inventory.items.splice(itemIndex, 1);
        
        // Remove the entire slot from DOM
        const slot = item.parentElement;
        if (slot && slot.classList.contains('inventory-slot')) {
            slot.remove();
        }
        
        // Hide bluetooth toggle if we dropped the bluetooth scanner
        if (item.scenarioData.type === "bluetooth_scanner") {
            const bluetoothToggle = document.getElementById('bluetooth-toggle');
            if (bluetoothToggle) {
                bluetoothToggle.style.display = 'none';
            }
        }
        
        // Hide biometrics toggle if we dropped the fingerprint kit
        if (item.scenarioData.type === "fingerprint_kit") {
            const biometricsToggle = document.getElementById('biometrics-toggle');
            if (biometricsToggle) {
                biometricsToggle.style.display = 'none';
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error removing from inventory:', error);
        return false;
    }
}

// Export for global access
window.initializeInventory = initializeInventory;
window.processInitialInventoryItems = processInitialInventoryItems;
window.addToInventory = addToInventory;
window.removeFromInventory = removeFromInventory;
window.addNotepadToInventory = addNotepadToInventory;
window.createItemIdentifier = createItemIdentifier;
window.handleKeyRingInteraction = handleKeyRingInteraction; 