// Bluetooth System
// Handles Bluetooth device scanning and management

// Bluetooth state management
let bluetoothDevices = [];
let lastBluetoothPanelUpdate = 0;

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
}

// Check for Bluetooth devices
export function checkBluetoothDevices() {
    // Find scanner in inventory
    const scanner = window.inventory.items.find(item => 
        item.scenarioData?.type === "bluetooth_scanner"
    );
    
    if (!scanner) return;
    
    // Show the Bluetooth toggle button if it's not already visible
    const bluetoothToggle = document.getElementById('bluetooth-toggle');
    if (bluetoothToggle && bluetoothToggle.style.display === 'none') {
        bluetoothToggle.style.display = 'flex';
    }
    
    // Find all Bluetooth devices in the current room
    if (!window.currentPlayerRoom || !window.rooms[window.currentPlayerRoom] || !window.rooms[window.currentPlayerRoom].objects) return;
    
    const room = window.rooms[window.currentPlayerRoom];
    const player = window.player;
    if (!player) return;
    
    // Keep track of devices detected in this scan
    const detectedDevices = new Set();
    let needsUpdate = false;
    
    Object.values(room.objects).forEach(obj => {
        if (obj.scenarioData?.lockType === "bluetooth") {
            const distance = Math.sqrt(
                Math.pow(player.x - obj.x, 2) + Math.pow(player.y - obj.y, 2)
            );
            
            const deviceMac = obj.scenarioData?.mac || "Unknown";
            const BLUETOOTH_SCAN_RANGE = 150; // pixels
            
            if (distance <= BLUETOOTH_SCAN_RANGE) {
                detectedDevices.add(deviceMac);
                
                console.log('BLUETOOTH DEVICE DETECTED', {
                    deviceName: obj.scenarioData?.name,
                    deviceMac: deviceMac,
                    distance: Math.round(distance),
                    range: BLUETOOTH_SCAN_RANGE
                });
                
                // Add to Bluetooth scanner panel
                const deviceName = obj.scenarioData?.name || "Unknown Device";
                const signalStrength = Math.max(0, Math.round(100 - (distance / BLUETOOTH_SCAN_RANGE * 100)));
                const details = `Type: ${obj.scenarioData?.type || "Unknown"}\nDistance: ${Math.round(distance)} units\nSignal Strength: ${signalStrength}%`;
                
                // Check if device already exists in our list
                const existingDevice = bluetoothDevices.find(device => device.mac === deviceMac);
                
                if (existingDevice) {
                    // Update existing device details with real-time data
                    const oldSignalStrength = existingDevice.signalStrength;
                    existingDevice.details = details;
                    existingDevice.lastSeen = new Date();
                    existingDevice.nearby = true;
                    existingDevice.signalStrength = signalStrength;
                    
                    // Only mark for update if signal strength changed significantly
                    if (Math.abs(oldSignalStrength - signalStrength) > 5) {
                        needsUpdate = true;
                    }
                } else {
                    // Add as new device if not already in our list
                    const newDevice = addBluetoothDevice(deviceName, deviceMac, details, true);
                    if (newDevice) {
                        newDevice.signalStrength = signalStrength;
                        window.gameAlert(`Bluetooth device detected: ${deviceName} (MAC: ${deviceMac})`, 'info', 'Bluetooth Scanner', 4000);
                        needsUpdate = true;
                    }
                }
            }
        }
    });
    
    // Mark devices that weren't detected in this scan as not nearby
    bluetoothDevices.forEach(device => {
        if (device.nearby && !detectedDevices.has(device.mac)) {
            device.nearby = false;
            device.lastSeen = new Date();
            needsUpdate = true;
        }
    });
    
    // Only update the panel if needed and not too frequently
    const now = Date.now();
    if (needsUpdate && now - lastBluetoothPanelUpdate > 1000) { // 1 second throttle
        updateBluetoothPanel();
        updateBluetoothCount();
        lastBluetoothPanelUpdate = now;
    }
}

export function addBluetoothDevice(name, mac, details = "", nearby = true) {
    // Check if device already exists
    const existingDevice = bluetoothDevices.find(device => device.mac === mac);
    if (existingDevice) {
        // Update existing device
        existingDevice.details = details;
        existingDevice.lastSeen = new Date();
        existingDevice.nearby = nearby;
        return existingDevice;
    }
    
    // Create new device
    const newDevice = {
        name: name,
        mac: mac,
        details: details,
        nearby: nearby,
        lastSeen: new Date(),
        signalStrength: 0
    };
    
    bluetoothDevices.push(newDevice);
    return newDevice;
}

export function updateBluetoothPanel() {
    const bluetoothContent = document.getElementById('bluetooth-content');
    if (!bluetoothContent) return;
    
    const searchTerm = document.getElementById('bluetooth-search')?.value?.toLowerCase() || '';
    const activeCategory = document.querySelector('.bluetooth-category.active')?.dataset.category || 'all';
    
    // Filter devices based on search and category
    let filteredDevices = [...bluetoothDevices];
    
    // Apply category filter
    if (activeCategory === 'nearby') {
        filteredDevices = filteredDevices.filter(device => device.nearby);
    } else if (activeCategory === 'saved') {
        filteredDevices = filteredDevices.filter(device => !device.nearby);
    }
    
    // Apply search filter
    if (searchTerm) {
        filteredDevices = filteredDevices.filter(device => 
            device.name.toLowerCase().includes(searchTerm) || 
            device.mac.toLowerCase().includes(searchTerm)
        );
    }
    
    // Sort devices by signal strength (nearby first, then by signal strength)
    filteredDevices.sort((a, b) => {
        if (a.nearby !== b.nearby) {
            return a.nearby ? -1 : 1;
        }
        return (b.signalStrength || 0) - (a.signalStrength || 0);
    });
    
    // Clear current content
    bluetoothContent.innerHTML = '';
    
    // Add devices
    if (filteredDevices.length === 0) {
        if (searchTerm) {
            bluetoothContent.innerHTML = '<div class="device-item">No devices match your search.</div>';
        } else if (activeCategory === 'nearby') {
            bluetoothContent.innerHTML = '<div class="device-item">No nearby devices found.</div>';
        } else if (activeCategory === 'saved') {
            bluetoothContent.innerHTML = '<div class="device-item">No saved devices found.</div>';
        } else {
            bluetoothContent.innerHTML = '<div class="device-item">No devices detected yet.</div>';
        }
    } else {
        filteredDevices.forEach(device => {
            const deviceElement = document.createElement('div');
            deviceElement.className = 'device-item';
            deviceElement.dataset.mac = device.mac;
            
            const formattedTime = device.lastSeen ? device.lastSeen.toLocaleString() : 'Unknown';
            const signalStrength = device.signalStrength || 0;
            
            deviceElement.innerHTML = `
                <div class="device-info">
                    <div class="device-name">${device.name}</div>
                    <div class="device-address">${device.mac}</div>
                </div>
                <div class="device-signal">${signalStrength}%</div>
                <div class="device-status ${device.nearby ? 'nearby' : 'saved'}">
                    ${device.nearby ? 'Nearby' : 'Not in range'}
                </div>
            `;
            
            bluetoothContent.appendChild(deviceElement);
        });
    }
    
    updateBluetoothCount();
}

export function updateBluetoothCount() {
    const bluetoothCount = document.getElementById('bluetooth-count');
    if (bluetoothCount) {
        const nearbyCount = bluetoothDevices.filter(device => device.nearby).length;
        bluetoothCount.textContent = nearbyCount;
    }
}

export function toggleBluetoothPanel() {
    const bluetoothPanel = document.getElementById('bluetooth-panel');
    if (!bluetoothPanel) return;
    
    const isVisible = bluetoothPanel.style.display === 'block';
    bluetoothPanel.style.display = isVisible ? 'none' : 'block';
    
    // Update panel content when opening
    if (!isVisible) {
        updateBluetoothPanel();
    }
}

// Export for global access
window.initializeBluetoothPanel = initializeBluetoothPanel;
window.checkBluetoothDevices = checkBluetoothDevices;
window.addBluetoothDevice = addBluetoothDevice;
window.toggleBluetoothPanel = toggleBluetoothPanel;
window.updateBluetoothPanel = updateBluetoothPanel;
window.updateBluetoothCount = updateBluetoothCount; 