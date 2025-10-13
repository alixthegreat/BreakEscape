// Container Minigame
import { MinigameScene } from '../framework/base-minigame.js';
import { addToInventory, removeFromInventory } from '../../systems/inventory.js';

export class ContainerMinigame extends MinigameScene {
    constructor(container, params) {
        super(container, params);
        this.containerItem = params.containerItem;
        this.contents = params.contents || [];
        this.isTakeable = params.isTakeable || false;
    }
    
    init() {
        // Call parent init first
        super.init();
        
        // Update header with container name
        if (this.headerElement) {
            this.headerElement.innerHTML = `
                <h3>${this.containerItem.scenarioData.name}</h3>
                <p>${this.containerItem.scenarioData.observations || ''}</p>
            `;
        }
        
        // Create the container minigame UI
        this.createContainerUI();
    }
    
    createContainerUI() {
        this.gameContainer.innerHTML = `
            <div class="container-minigame">
                <div class="container-image-section">
                    <img src="assets/objects/${this.containerItem.name}.png" 
                         alt="${this.containerItem.scenarioData.name}" 
                         class="container-image">
                    <div class="container-info">
                        <h4>${this.containerItem.scenarioData.name}</h4>
                        <p>${this.containerItem.scenarioData.observations || ''}</p>
                    </div>
                </div>
                
                <div class="container-contents-section">
                    <h4>Contents</h4>
                    <div class="container-contents-grid" id="container-contents-grid">
                        <!-- Contents will be populated here -->
                    </div>
                </div>
                
                <div class="container-actions">
                    ${this.isTakeable ? '<button class="minigame-button" id="take-container-btn">Take Container</button>' : ''}
                    <button class="minigame-button" id="close-container-btn">Close</button>
                </div>
            </div>
        `;
        
        // Populate contents
        this.populateContents();
        
        // Set up event listeners
        this.setupEventListeners();
    }
    
    populateContents() {
        const contentsGrid = document.getElementById('container-contents-grid');
        if (!contentsGrid) return;
        
        if (this.contents.length === 0) {
            contentsGrid.innerHTML = '<p class="empty-contents">This container is empty.</p>';
            return;
        }
        
        this.contents.forEach((item, index) => {
            const slot = document.createElement('div');
            slot.className = 'container-content-slot';
            
            const itemImg = document.createElement('img');
            itemImg.className = 'container-content-item';
            itemImg.src = `assets/objects/${item.type}.png`;
            itemImg.alt = item.name;
            itemImg.title = item.name;
            
            // Add item data
            itemImg.scenarioData = item;
            itemImg.name = item.type;
            itemImg.objectId = `container_${index}`;
            
            // Add click handler for taking items
            if (item.takeable) {
                itemImg.style.cursor = 'pointer';
                
                // Special handling for notes - trigger notes minigame instead of taking
                if (item.type === 'notes' && item.readable && item.text) {
                    itemImg.addEventListener('click', () => this.handleNotesItem(item, itemImg));
                } else {
                    itemImg.addEventListener('click', () => this.takeItem(item, itemImg));
                }
            }
            
            // Create tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'container-content-tooltip';
            tooltip.textContent = item.name;
            
            slot.appendChild(itemImg);
            slot.appendChild(tooltip);
            contentsGrid.appendChild(slot);
        });
    }
    
    setupEventListeners() {
        // Take container button
        const takeContainerBtn = document.getElementById('take-container-btn');
        if (takeContainerBtn) {
            this.addEventListener(takeContainerBtn, 'click', () => this.takeContainer());
        }
        
        // Close button
        const closeBtn = document.getElementById('close-container-btn');
        if (closeBtn) {
            this.addEventListener(closeBtn, 'click', () => this.complete(false));
        }
    }
    
    handleNotesItem(item, itemElement) {
        console.log('Handling notes item from container:', item);
        
        // Remove the note from container display
        itemElement.parentElement.remove();
        
        // Remove from contents array
        const itemIndex = this.contents.findIndex(content => content === item);
        if (itemIndex !== -1) {
            this.contents.splice(itemIndex, 1);
        }
        
        // Show success message
        this.showMessage(`Read ${item.name}`, 'success');
        
        // If container is now empty, update display
        if (this.contents.length === 0) {
            const contentsGrid = document.getElementById('container-contents-grid');
            if (contentsGrid) {
                contentsGrid.innerHTML = '<p class="empty-contents">This container is empty.</p>';
            }
        }
        
        // Store container state for return after notes minigame
        const containerState = {
            containerItem: this.containerItem,
            contents: this.contents,
            isTakeable: this.isTakeable
        };
        
        // Store the container state globally so we can return to it
        window.pendingContainerReturn = containerState;
        
        // Close the container minigame first
        this.complete(false);
        
        // Start the notes minigame
        if (window.startNotesMinigame) {
            // Create a temporary sprite-like object for the notes minigame
            const tempSprite = {
                scenarioData: item,
                name: item.type,
                objectId: `temp_${Date.now()}`
            };
            
            // Start notes minigame with the item's text
            window.startNotesMinigame(tempSprite, item.text, item.observations);
        } else {
            console.error('Notes minigame not available');
            window.gameAlert('Notes minigame not available', 'error', 'Error', 3000);
        }
    }
    
    takeItem(item, itemElement) {
        console.log('Taking item from container:', item);
        
        // Create a temporary sprite-like object for the inventory system
        const tempSprite = {
            scenarioData: item,
            name: item.type,
            objectId: `temp_${Date.now()}`,
            setVisible: function(visible) {
                // Mock setVisible method for inventory compatibility
                console.log(`Mock setVisible(${visible}) called on temp sprite`);
            }
        };
        
        // Add to inventory
        if (addToInventory(tempSprite)) {
            // Remove from container display
            itemElement.parentElement.remove();
            
            // Remove from contents array
            const itemIndex = this.contents.findIndex(content => content === item);
            if (itemIndex !== -1) {
                this.contents.splice(itemIndex, 1);
            }
            
            // Show success message
            this.showMessage(`Added ${item.name} to inventory`, 'success');
            
            // If container is now empty, update display
            if (this.contents.length === 0) {
                const contentsGrid = document.getElementById('container-contents-grid');
                if (contentsGrid) {
                    contentsGrid.innerHTML = '<p class="empty-contents">This container is empty.</p>';
                }
            }
        } else {
            this.showMessage(`Failed to add ${item.name} to inventory`, 'error');
        }
    }
    
    takeContainer() {
        console.log('Taking container:', this.containerItem);
        
        // Ensure container item has setVisible method if it doesn't already
        if (!this.containerItem.setVisible) {
            this.containerItem.setVisible = function(visible) {
                console.log(`Mock setVisible(${visible}) called on container item`);
            };
        }
        
        // Add container to inventory
        if (addToInventory(this.containerItem)) {
            this.showMessage(`Added ${this.containerItem.scenarioData.name} to inventory`, 'success');
            
            // Close the minigame after a short delay
            setTimeout(() => {
                this.complete(true);
            }, 1500);
        } else {
            this.showMessage(`Failed to add ${this.containerItem.scenarioData.name} to inventory`, 'error');
        }
    }
    
    showMessage(message, type) {
        const messageElement = document.createElement('div');
        messageElement.className = `container-message container-message-${type}`;
        messageElement.textContent = message;
        
        this.messageContainer.appendChild(messageElement);
        
        // Remove message after 3 seconds
        setTimeout(() => {
            if (messageElement.parentElement) {
                messageElement.parentElement.removeChild(messageElement);
            }
        }, 3000);
    }
}

// Function to start the container minigame
export function startContainerMinigame(containerItem, contents, isTakeable = false) {
    console.log('Starting container minigame', { containerItem, contents, isTakeable });
    
    // Initialize the minigame framework if not already done
    if (!window.MinigameFramework) {
        console.error('MinigameFramework not available');
        return;
    }
    
    if (!window.MinigameFramework.mainGameScene) {
        window.MinigameFramework.init(window.game);
    }
    
    // Start the container minigame
    window.MinigameFramework.startMinigame('container', null, {
        title: containerItem.scenarioData.name,
        containerItem: containerItem,
        contents: contents,
        isTakeable: isTakeable,
        cancelText: 'Close',
        showCancel: true,
        onComplete: (success, result) => {
            console.log('Container minigame completed', { success, result });
        }
    });
}

// Function to return to container after notes minigame
export function returnToContainerAfterNotes() {
    console.log('Returning to container after notes minigame');
    
    // Check if there's a pending container return
    if (window.pendingContainerReturn) {
        const containerState = window.pendingContainerReturn;
        
        // Clear the pending return state
        window.pendingContainerReturn = null;
        
        // Start the container minigame with the stored state
        startContainerMinigame(
            containerState.containerItem,
            containerState.contents,
            containerState.isTakeable
        );
    } else {
        console.log('No pending container return found');
    }
}
