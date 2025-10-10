// Inventory System
// Handles inventory management and display

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
    
    // Create 10 slot outlines
    for (let i = 0; i < 10; i++) {
        const slot = document.createElement('div');
        slot.className = 'inventory-slot';
        inventoryContainer.appendChild(slot);
    }
    
    // Store reference to container
    window.inventory.container = inventoryContainer;
    
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
            objectId: `initial_${itemData.type}_${Date.now()}`,
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

function addToInventory(sprite) {
    if (!sprite || !sprite.scenarioData) {
        console.warn('Invalid sprite for inventory');
        return false;
    }
    
    try {
        console.log("Adding to inventory:", {
            objectId: sprite.objectId,
            name: sprite.name,
            type: sprite.scenarioData?.type
        });
        
        // Check if the item is already in the inventory
        const itemIdentifier = `${sprite.scenarioData.type}_${sprite.scenarioData.name || 'unnamed'}`;
        const isAlreadyInInventory = window.inventory.items.some(item => 
            item && `${item.scenarioData.type}_${item.scenarioData.name || 'unnamed'}` === itemIdentifier
        );
        
        if (isAlreadyInInventory) {
            console.log(`Item ${itemIdentifier} is already in inventory`);
            return false;
        }
        
        // Find first empty slot
        const inventoryContainer = document.getElementById('inventory-container');
        if (!inventoryContainer) {
            console.error('Inventory container not found');
            return false;
        }
        
        const slots = inventoryContainer.getElementsByClassName('inventory-slot');
        let emptySlot = null;
        for (const slot of slots) {
            if (!slot.hasChildNodes()) {
                emptySlot = slot;
                break;
            }
        }
        
        if (!emptySlot) {
            console.warn('No empty inventory slots available');
            return false;
        }
        
        // Create inventory item
        const itemImg = document.createElement('img');
        itemImg.className = 'inventory-item';
        itemImg.src = `assets/objects/${sprite.name}.png`;
        itemImg.alt = sprite.scenarioData.name;
        
        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'inventory-tooltip';
        tooltip.textContent = sprite.scenarioData.name;
        
        // Add item data
        itemImg.scenarioData = sprite.scenarioData;
        itemImg.name = sprite.name;
        itemImg.objectId = sprite.objectId;
        
        // Add click handler
        itemImg.addEventListener('click', function() {
            if (window.handleObjectInteraction) {
                window.handleObjectInteraction(this);
            }
        });
        
        // Add to slot
        emptySlot.appendChild(itemImg);
        emptySlot.appendChild(tooltip);
        
        // Add to inventory array
        window.inventory.items.push(itemImg);
        
        // Show notification
        if (window.gameAlert) {
            window.gameAlert(`Added ${sprite.scenarioData.name} to inventory`, 'success', 'Item Collected', 3000);
        }
        
        // If this is the Bluetooth scanner, show the toggle button
        if (sprite.scenarioData.type === "bluetooth_scanner") {
            const bluetoothToggle = document.getElementById('bluetooth-toggle');
            if (bluetoothToggle) {
                bluetoothToggle.style.display = 'flex';
            }
        }
        
        // If this is the fingerprint kit, show the biometrics toggle button
        if (sprite.scenarioData.type === "fingerprint_kit") {
            const biometricsToggle = document.getElementById('biometrics-toggle');
            if (biometricsToggle) {
                biometricsToggle.style.display = 'flex';
            }
        }
        
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

// Export for global access
window.initializeInventory = initializeInventory;
window.processInitialInventoryItems = processInitialInventoryItems;
window.addToInventory = addToInventory; 