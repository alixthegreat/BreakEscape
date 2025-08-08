// Bluetooth System
// Handles Bluetooth device scanning and management

// Bluetooth state management
let bluetoothDevices = [];
let lastBluetoothPanelUpdate = 0;
let newBluetoothDevices = 0;

// Sync with global game state
function syncBluetoothDevices() {
    if (!window.gameState) {
        window.gameState = {};
    }
    window.gameState.bluetoothDevices = bluetoothDevices;
}

// Constants
const BLUETOOTH_SCAN_RANGE = 150; // pixels - 2 tiles range for Bluetooth scanning
const BLUETOOTH_SCAN_INTERVAL = 200; // Scan every 200ms for more responsive updates
const BLUETOOTH_UPDATE_THROTTLE = 100; // Update UI every 100ms max

// Initialize the Bluetooth system
export function initializeBluetoothPanel() {
    console.log('Bluetooth system initialized');
    
    // Create bluetooth device list
    bluetoothDevices = [];
    
    // Set up bluetooth toggle button handler
    const bluetoothToggle = document.getElementById('bluetooth-toggle');
    if (bluetoothToggle) {
        bluetoothToggle.addEventListener('click', toggleBluetoothPanel);
    }
    
    // Set up bluetooth close button
    const bluetoothClose = document.getElementById('bluetooth-close');
    if (bluetoothClose) {
        bluetoothClose.addEventListener('click', toggleBluetoothPanel);
    }
    
    // Set up search functionality
    const bluetoothSearch = document.getElementById('bluetooth-search');
    if (bluetoothSearch) {
        bluetoothSearch.addEventListener('input', updateBluetoothPanel);
    }
    
    // Set up category filters
    const categories = document.querySelectorAll('.bluetooth-category');
    categories.forEach(category => {
        category.addEventListener('click', () => {
            // Remove active class from all categories
            categories.forEach(c => c.classList.remove('active'));
            // Add active class to clicked category
            category.classList.add('active');
            // Update bluetooth panel
            updateBluetoothPanel();
        });
    });
    
    // Initialize bluetooth panel
    updateBluetoothPanel();
    updateBluetoothCount();
    syncBluetoothDevices();
}

// Check for Bluetooth devices
export function checkBluetoothDevices() {
    // Find scanner in inventory
    const scanner = window.inventory.items.find(item => 
        item.scenarioData?.type === "bluetooth_scanner"
    );
    
    if (!scanner) {
        return;
    }
    
    // Show the Bluetooth toggle button if it's not already visible
    const bluetoothToggle = document.getElementById('bluetooth-toggle');
    if (bluetoothToggle && bluetoothToggle.style.display === 'none') {
        bluetoothToggle.style.display = 'flex';
    }
    
    // Find all Bluetooth devices in the current room
    if (!window.currentPlayerRoom || !window.rooms[window.currentPlayerRoom] || !window.rooms[window.currentPlayerRoom].objects) {
        return;
    }
    
    const room = window.rooms[window.currentPlayerRoom];
    const player = window.player;
    if (!player) {
        return;
    }
    
    // Keep track of devices detected in this scan
    const detectedDevices = new Set();
    let needsUpdate = false;
    
    Object.values(room.objects).forEach(obj => {
        if (obj.scenarioData?.lockType === "bluetooth") {
            const distance = Math.sqrt(
                Math.pow(player.x - obj.x, 2) + Math.pow(player.y - obj.y, 2)
            );
            
            const deviceMac = obj.scenarioData?.mac || "Unknown";
            const deviceName = obj.scenarioData?.name || "Unknown Device";
            
            if (distance <= BLUETOOTH_SCAN_RANGE) {
                detectedDevices.add(`${deviceMac}|${deviceName}`); // Use combination for uniqueness
                
                // Add to Bluetooth scanner panel
                const signalStrengthPercentage = Math.max(0, Math.round(100 - (distance / BLUETOOTH_SCAN_RANGE * 100)));
                // Convert percentage to dBm format (-100 to -30 dBm range)
                const signalStrength = Math.round(-100 + (signalStrengthPercentage * 0.7)); // -100 to -30 dBm
                const details = `Type: ${obj.scenarioData?.type || "Unknown"}\nDistance: ${Math.round(distance)} units\nSignal Strength: ${signalStrength}dBm (${signalStrengthPercentage}%)`;
                
                // Check if device already exists in our list (by MAC + name combination for uniqueness)
                const existingDevice = bluetoothDevices.find(device => 
                    device.mac === deviceMac && device.name === deviceName
                );
                
                if (existingDevice) {
                    // Update existing device details with real-time data
                    const wasNearby = existingDevice.nearby;
                    const oldSignalStrengthPercentage = existingDevice.signalStrengthPercentage || 0;
                    
                    existingDevice.details = details;
                    existingDevice.lastSeen = new Date();
                    existingDevice.nearby = true;
                    existingDevice.signalStrength = signalStrength;
                    existingDevice.signalStrengthPercentage = signalStrengthPercentage;
                    
                    // Always update if device came back into range or signal strength changed significantly
                    if (!wasNearby || Math.abs(oldSignalStrengthPercentage - signalStrengthPercentage) > 5) {
                        needsUpdate = true;
                    }
                } else {
                    // Add as new device if not already in our list
                    const newDevice = addBluetoothDevice(deviceName, deviceMac, details, true);
                    if (newDevice) {
                        newDevice.signalStrength = signalStrength;
                        newDevice.signalStrengthPercentage = signalStrengthPercentage;
                        if (window.gameAlert) {
                            window.gameAlert(`Bluetooth device detected: ${deviceName} (MAC: ${deviceMac})`, 'info', 'Bluetooth Scanner', 4000);
                        }
                        needsUpdate = true;
                    }
                }
            }
        }
    });
    
    // Mark devices that weren't detected in this scan as not nearby
    bluetoothDevices.forEach(device => {
        const deviceKey = `${device.mac}|${device.name}`;
        if (device.nearby && !detectedDevices.has(deviceKey)) {
            device.nearby = false;
            device.lastSeen = new Date();
            needsUpdate = true;
        }
    });
    
    // Force immediate UI update if panel is open and devices changed nearby status
    if (needsUpdate) {
        const bluetoothPanel = document.getElementById('bluetooth-panel');
        if (bluetoothPanel && bluetoothPanel.style.display === 'block') {
            // Force update by resetting throttle timer
            lastBluetoothPanelUpdate = 0;
        }
    }
    
    // Always update the count and sync devices when there are changes
    if (needsUpdate) {
        updateBluetoothCount();
        syncBluetoothDevices();
        
        // Update the panel UI if it's visible
        const bluetoothPanel = document.getElementById('bluetooth-panel');
        if (bluetoothPanel && bluetoothPanel.style.display === 'block') {
            const now = Date.now();
            if (now - lastBluetoothPanelUpdate > BLUETOOTH_UPDATE_THROTTLE) {
                updateBluetoothPanel();
                lastBluetoothPanelUpdate = now;
            }
        }
    }
}

// Add a Bluetooth device to the scanner panel
export function addBluetoothDevice(name, mac, details = "", nearby = true) {
    // Check if a device with the same MAC + name combination already exists
    const deviceExists = bluetoothDevices.some(device => device.mac === mac && device.name === name);
    
    // If the device already exists, update its nearby status
    if (deviceExists) {
        const existingDevice = bluetoothDevices.find(device => device.mac === mac && device.name === name);
        existingDevice.nearby = nearby;
        existingDevice.lastSeen = new Date();
        updateBluetoothPanel();
        syncBluetoothDevices();
        return null;
    }
    
    const device = {
        id: Date.now(),
        name: name,
        mac: mac,
        details: details,
        nearby: nearby,
        saved: false,
        firstSeen: new Date(),
        lastSeen: new Date(),
        signalStrength: -100, // Default to weak signal (-100 dBm)
        signalStrengthPercentage: 0 // Default to 0% for visual display
    };
    
    bluetoothDevices.push(device);
    updateBluetoothPanel();
    updateBluetoothCount();
    syncBluetoothDevices();
    
    // Show notification for new device
    if (window.showNotification) {
        window.showNotification(`New Bluetooth device detected: ${name}`, 'info', 'Bluetooth Scanner', 3000);
    }
    
    return device;
}

// Update the Bluetooth scanner panel with current devices
export function updateBluetoothPanel() {
    const bluetoothContent = document.getElementById('bluetooth-content');
    if (!bluetoothContent) return;
    
    const searchTerm = document.getElementById('bluetooth-search')?.value?.toLowerCase() || '';
    
    // Get active category
    const activeCategory = document.querySelector('.bluetooth-category.active')?.dataset.category || 'all';
    
    // Store the currently hovered device, if any
    const hoveredDevice = document.querySelector('.bluetooth-device:hover');
    const hoveredDeviceId = hoveredDevice ? hoveredDevice.dataset.id : null;
    
    // Add Bluetooth-locked items from inventory to the main bluetoothDevices array
    if (window.inventory && window.inventory.items) {
        window.inventory.items.forEach(item => {
            if (item.scenarioData?.lockType === "bluetooth" && item.scenarioData?.locked) {
                // Check if this device is already in our list
                const deviceMac = item.scenarioData?.mac || "Unknown";
                
                // Normalize MAC address format (ensure lowercase for comparison)
                const normalizedMac = deviceMac.toLowerCase();
                
                                    // Check if device already exists in our list (by MAC + name combination)
                    const deviceName = item.scenarioData?.name || item.name || "Unknown Device";
                    const existingDeviceIndex = bluetoothDevices.findIndex(device => 
                        device.mac.toLowerCase() === normalizedMac && device.name === deviceName
                    );
                
                                    if (existingDeviceIndex === -1) {
                        // Add as a new device
                        const details = `Type: ${item.scenarioData?.type || "Unknown"}\nLocation: Inventory\nStatus: Locked`;
                    
                    const newDevice = {
                        id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        name: deviceName,
                        mac: deviceMac,
                        details: details,
                        lastSeen: new Date(),
                        nearby: true, // Always nearby since it's in inventory
                        saved: true,  // Auto-save inventory items
                        signalStrength: -30, // Max strength for inventory items (-30 dBm)
                        signalStrengthPercentage: 100, // 100% for visual display
                        inInventory: true // Mark as inventory item
                    };
                    
                    // Add to the main bluetoothDevices array
                    bluetoothDevices.push(newDevice);
                    console.log('Added inventory device to bluetoothDevices:', newDevice);
                    syncBluetoothDevices();
                } else {
                    // Update existing device
                    const existingDevice = bluetoothDevices[existingDeviceIndex];
                    existingDevice.inInventory = true;
                    existingDevice.nearby = true;
                    existingDevice.signalStrength = -30; // -30 dBm for inventory items
                    existingDevice.signalStrengthPercentage = 100; // 100% for visual display
                    existingDevice.lastSeen = new Date();
                    existingDevice.details = `Type: ${item.scenarioData?.type || "Unknown"}\nLocation: Inventory\nStatus: Locked`;
                    console.log('Updated existing device with inventory info:', existingDevice);
                    syncBluetoothDevices();
                }
            }
        });
    }
    
    // Filter devices based on search and category
    let filteredDevices = [...bluetoothDevices];
    
    // Apply category filter
    if (activeCategory === 'nearby') {
        filteredDevices = filteredDevices.filter(device => device.nearby);
    } else if (activeCategory === 'saved') {
        filteredDevices = filteredDevices.filter(device => device.saved);
    }
    
    // Apply search filter
    if (searchTerm) {
        filteredDevices = filteredDevices.filter(device => 
            device.name.toLowerCase().includes(searchTerm) || 
            device.mac.toLowerCase().includes(searchTerm) ||
            device.details.toLowerCase().includes(searchTerm)
        );
    }
    
    // Sort devices with inventory items first, then nearby ones, then by signal strength
    filteredDevices.sort((a, b) => {
        // Inventory items first
        if (a.inInventory !== b.inInventory) {
            return a.inInventory ? -1 : 1;
        }
        
        // Then nearby items
        if (a.nearby !== b.nearby) {
            return a.nearby ? -1 : 1;
        }
        
        // For nearby devices, sort by signal strength
        if (a.nearby && b.nearby && a.signalStrength !== b.signalStrength) {
            return b.signalStrength - a.signalStrength;
        }
        
        return new Date(b.lastSeen) - new Date(a.lastSeen);
    });
    
    // Clear current content
    bluetoothContent.innerHTML = '';
    
    // Add devices
    if (filteredDevices.length === 0) {
        if (searchTerm) {
            bluetoothContent.innerHTML = '<div class="bluetooth-device">No devices match your search.</div>';
        } else if (activeCategory !== 'all') {
            bluetoothContent.innerHTML = `<div class="bluetooth-device">No ${activeCategory} devices found.</div>`;
        } else {
            bluetoothContent.innerHTML = '<div class="bluetooth-device">No devices detected yet.</div>';
        }
    } else {
        filteredDevices.forEach(device => {
            const deviceElement = document.createElement('div');
            deviceElement.className = 'bluetooth-device';
            deviceElement.dataset.id = device.id;
            
            // If this was the hovered device, add the hover class
            if (hoveredDeviceId && device.id === hoveredDeviceId) {
                deviceElement.classList.add('hover-preserved');
            }
            
            // Format the timestamp
            const timestamp = new Date(device.lastSeen);
            const formattedDate = timestamp.toLocaleDateString();
            const formattedTime = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // Get signal color based on strength
            const getSignalColor = (strength) => {
                if (strength >= 80) return '#00cc00'; // Strong - green
                if (strength >= 50) return '#cccc00'; // Medium - yellow
                return '#cc5500'; // Weak - orange
            };
            
            let deviceContent = `<div class="bluetooth-device-name">
                <span>${device.name}</span>
                <div class="bluetooth-device-icons">`;
            
            if (device.nearby && typeof device.signalStrength === 'number') {
                // Use percentage for visual display
                const signalPercentage = device.signalStrengthPercentage || Math.max(0, Math.round(((device.signalStrength + 100) / 70) * 100));
                const signalColor = getSignalColor(signalPercentage);
                
                // Calculate how many bars should be active based on signal strength percentage
                const activeBars = Math.ceil(signalPercentage / 20); // 0-20% = 1 bar, 21-40% = 2 bars, etc.
                
                deviceContent += `<div class="bluetooth-signal-bar-container">
                    <div class="bluetooth-signal-bars">`;
                
                for (let i = 1; i <= 5; i++) {
                    const isActive = i <= activeBars;
                    deviceContent += `<div class="bluetooth-signal-bar ${isActive ? 'active' : ''}" style="color: ${signalColor};"></div>`;
                }
                
                deviceContent += `</div></div>`;
            } else if (device.nearby) {
                // Fallback if signal strength not available
                deviceContent += `<span class="bluetooth-device-icon">📶</span>`;
            }

            if (device.saved) {
                deviceContent += `<span class="bluetooth-device-icon">💾</span>`;
            }
            
            if (device.inInventory) {
                deviceContent += `<span class="bluetooth-device-icon">🎒</span>`;
            }

            deviceContent += `</div></div>`;
            deviceContent += `<div class="bluetooth-device-details">MAC: ${device.mac}\n${device.details}</div>`;
            deviceContent += `<div class="bluetooth-device-timestamp">Last seen: ${formattedDate} ${formattedTime}</div>`;

            deviceElement.innerHTML = deviceContent;
            
            // Toggle expanded state when clicked
            deviceElement.addEventListener('click', (event) => {
                deviceElement.classList.toggle('expanded');
                
                // Mark as saved when expanded
                if (!device.saved && deviceElement.classList.contains('expanded')) {
                    device.saved = true;
                    updateBluetoothCount();
                    updateBluetoothPanel();
                    syncBluetoothDevices();
                }
            });
            
            bluetoothContent.appendChild(deviceElement);
        });
    }
}

// Update the new Bluetooth devices count
export function updateBluetoothCount() {
    const bluetoothCount = document.getElementById('bluetooth-count');
    if (bluetoothCount) {
        newBluetoothDevices = bluetoothDevices.filter(device => !device.saved && device.nearby).length;
        
        bluetoothCount.textContent = newBluetoothDevices;
        bluetoothCount.style.display = newBluetoothDevices > 0 ? 'flex' : 'none';
    }
}

export function toggleBluetoothPanel() {
    const bluetoothPanel = document.getElementById('bluetooth-panel');
    if (!bluetoothPanel) return;
    
    const isVisible = bluetoothPanel.style.display === 'block';
    bluetoothPanel.style.display = isVisible ? 'none' : 'block';
    
    // Always update panel content when opening to show current state
    if (!isVisible) {
        updateBluetoothPanel();
        // Reset the throttle timer so updates happen immediately when panel is open
        lastBluetoothPanelUpdate = 0;
    }
}

// Function to unlock a Bluetooth-locked inventory item by MAC address
export function unlockInventoryDeviceByMac(mac) {
    console.log('Attempting to unlock inventory device with MAC:', mac);
    
    // Normalize MAC address for comparison
    const normalizedMac = mac.toLowerCase();
    
    // Find the inventory item with this MAC address
    const item = window.inventory.items.find(item => 
        item.scenarioData?.mac?.toLowerCase() === normalizedMac && 
        item.scenarioData?.lockType === "bluetooth" && 
        item.scenarioData?.locked
    );
    
    if (!item) {
        console.error('Inventory item not found with MAC:', mac);
        if (window.gameAlert) {
            window.gameAlert("Device not found in inventory.", 'error', 'Unlock Failed', 3000);
        }
        return;
    }
    
    console.log('Found inventory item to unlock:', item);
}

// Export for global access
window.initializeBluetoothPanel = initializeBluetoothPanel;
window.checkBluetoothDevices = checkBluetoothDevices;
window.addBluetoothDevice = addBluetoothDevice;
window.toggleBluetoothPanel = toggleBluetoothPanel;
window.updateBluetoothPanel = updateBluetoothPanel;
window.updateBluetoothCount = updateBluetoothCount;
window.unlockInventoryDeviceByMac = unlockInventoryDeviceByMac; 