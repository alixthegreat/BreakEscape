// Biometrics System
// Handles biometric sample collection and fingerprint scanning

// Initialize the biometrics system
export function initializeBiometricsPanel() {
    console.log('Biometrics system initialized');
    
    // Set up biometric scanner state
    if (!window.gameState.biometricSamples) {
        window.gameState.biometricSamples = [];
    }
    
    // Scanner state management
    window.scannerState = {
        failedAttempts: {},
        lockoutTimers: {}
    };
    
    // Scanner constants
    window.MAX_FAILED_ATTEMPTS = 3;
    window.SCANNER_LOCKOUT_TIME = 30000; // 30 seconds
    window.BIOMETRIC_QUALITY_THRESHOLD = 0.7;
    
    // Initialize biometric panel UI
    setupBiometricPanel();
    
    // Set up biometrics toggle button
    const biometricsToggle = document.getElementById('biometrics-toggle');
    if (biometricsToggle) {
        biometricsToggle.addEventListener('click', toggleBiometricsPanel);
    }
    
    // Set up biometrics close button
    const biometricsClose = document.getElementById('biometrics-close');
    if (biometricsClose) {
        biometricsClose.addEventListener('click', toggleBiometricsPanel);
    }
    
    // Set up search functionality
    const biometricsSearch = document.getElementById('biometrics-search');
    if (biometricsSearch) {
        biometricsSearch.addEventListener('input', updateBiometricsPanel);
    }
    
    // Set up category filters
    const categories = document.querySelectorAll('.biometrics-category');
    categories.forEach(category => {
        category.addEventListener('click', () => {
            // Remove active class from all categories
            categories.forEach(c => c.classList.remove('active'));
            // Add active class to clicked category
            category.classList.add('active');
            // Update biometrics panel
            updateBiometricsPanel();
        });
    });
    
    // Initialize biometrics count
    updateBiometricsCount();
}

function setupBiometricPanel() {
    const biometricPanel = document.getElementById('biometrics-panel');
    if (!biometricPanel) {
        console.error('Biometric panel not found');
        return;
    }
    
    // Use existing biometrics content container
    const biometricsContent = document.getElementById('biometrics-content');
    if (biometricsContent) {
        biometricsContent.innerHTML = `
            <div class="panel-section">
                <h4>Collected Samples</h4>
                <div id="samples-list">
                    <p>No samples collected yet</p>
                </div>
            </div>
            <div class="panel-section">
                <h4>Scanner Status</h4>
                <div id="scanner-status">
                    <p>Ready</p>
                </div>
            </div>
        `;
    }
    
    updateBiometricDisplay();
}

// Add a biometric sample to the collection
export function addBiometricSample(sample) {
    if (!window.gameState.biometricSamples) {
        window.gameState.biometricSamples = [];
    }
    
    // Ensure sample has all required properties with proper defaults
    const normalizedSample = {
        owner: sample.owner || 'Unknown',
        type: sample.type || 'fingerprint',
        quality: sample.quality || 0,
        rating: sample.rating || getRatingFromQuality(sample.quality || 0),
        data: sample.data || null,
        id: sample.id || generateSampleId(),
        collectedAt: new Date().toISOString()
    };
    
    // Check if sample already exists
    const existingSample = window.gameState.biometricSamples.find(s => 
        s.owner === normalizedSample.owner && s.type === normalizedSample.type
    );
    
    if (existingSample) {
        // Update existing sample with better quality if applicable
        if (normalizedSample.quality > existingSample.quality) {
            existingSample.quality = normalizedSample.quality;
            existingSample.rating = normalizedSample.rating;
            existingSample.collectedAt = normalizedSample.collectedAt;
        }
    } else {
        // Add new sample
        window.gameState.biometricSamples.push(normalizedSample);
    }
    
    updateBiometricsPanel();
    updateBiometricsCount();
    console.log('Biometric sample added:', normalizedSample);
}

function updateBiometricDisplay() {
    const samplesList = document.getElementById('samples-list');
    const scannerStatus = document.getElementById('scanner-status');
    
    if (!samplesList || !scannerStatus) return;
    
    if (window.gameState.biometricSamples.length === 0) {
        samplesList.innerHTML = '<p>No samples collected yet</p>';
    } else {
        samplesList.innerHTML = window.gameState.biometricSamples.map(sample => {
            // Ensure all properties exist with safe defaults
            const owner = sample.owner || 'Unknown';
            const type = sample.type || 'fingerprint';
            const quality = sample.quality || 0;
            const rating = sample.rating || getRatingFromQuality(quality);
            const collectedAt = sample.collectedAt || new Date().toISOString();
            
            return `
                <div class="sample-item">
                    <strong>${owner}</strong>
                    <div class="sample-details">
                        <span class="sample-type">${type}</span>
                        <span class="sample-quality quality-${rating.toLowerCase()}">${rating} (${Math.round(quality * 100)}%)</span>
                    </div>
                    <div class="sample-date">${new Date(collectedAt).toLocaleString()}</div>
                </div>
            `;
        }).join('');
    }
    
    // Update scanner status
    scannerStatus.innerHTML = '<p>Ready</p>';
}

// Helper function to generate rating from quality
function getRatingFromQuality(quality) {
    const qualityPercentage = Math.round(quality * 100);
    if (qualityPercentage >= 95) return 'Perfect';
    if (qualityPercentage >= 85) return 'Excellent';
    if (qualityPercentage >= 75) return 'Good';
    if (qualityPercentage >= 60) return 'Fair';
    if (qualityPercentage >= 40) return 'Acceptable';
    return 'Poor';
}

// Helper function to generate unique sample ID
function generateSampleId() {
    return 'sample_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Handle biometric scanner interaction
export function handleBiometricScan(scannerId, requiredOwner) {
    console.log('Biometric scan requested:', { scannerId, requiredOwner });
    
    // Check if scanner is locked out
    if (window.scannerState.lockoutTimers[scannerId]) {
        const lockoutEnd = window.scannerState.lockoutTimers[scannerId];
        const now = Date.now();
        
        if (now < lockoutEnd) {
            const remainingTime = Math.ceil((lockoutEnd - now) / 1000);
            window.gameAlert(`Scanner locked out. Try again in ${remainingTime} seconds.`, 'error', 'Scanner Locked', 3000);
            return false;
        } else {
            // Lockout expired, clear it
            delete window.scannerState.lockoutTimers[scannerId];
            delete window.scannerState.failedAttempts[scannerId];
        }
    }
    
    // Check if we have a matching biometric sample
    const matchingSample = window.gameState.biometricSamples.find(sample => 
        sample.owner === requiredOwner && sample.quality >= window.BIOMETRIC_QUALITY_THRESHOLD
    );
    
    if (matchingSample) {
        console.log('Biometric scan successful:', matchingSample);
        
        // Visual success feedback
        const scannerElement = document.querySelector(`[data-scanner-id="${scannerId}"]`);
        if (scannerElement) {
            scannerElement.style.border = '2px solid #00ff00';
            setTimeout(() => {
                scannerElement.style.border = '';
            }, 2000);
        }
        
        window.gameAlert(`Biometric scan successful! Authenticated as ${requiredOwner}.`, 'success', 'Scan Successful', 4000);
        
        // Reset failed attempts on success
        delete window.scannerState.failedAttempts[scannerId];
        
        return true;
    } else {
        console.log('Biometric scan failed');
        handleScannerFailure(scannerId);
        return false;
    }
}

function handleScannerFailure(scannerId) {
    // Initialize failed attempts if not exists
    if (!window.scannerState.failedAttempts[scannerId]) {
        window.scannerState.failedAttempts[scannerId] = 0;
    }
    
    // Increment failed attempts
    window.scannerState.failedAttempts[scannerId]++;
    
    // Check if we should lockout
    if (window.scannerState.failedAttempts[scannerId] >= window.MAX_FAILED_ATTEMPTS) {
        window.scannerState.lockoutTimers[scannerId] = Date.now() + window.SCANNER_LOCKOUT_TIME;
        window.gameAlert(`Too many failed attempts. Scanner locked for ${window.SCANNER_LOCKOUT_TIME/1000} seconds.`, 'error', 'Scanner Locked', 5000);
    } else {
        const remainingAttempts = window.MAX_FAILED_ATTEMPTS - window.scannerState.failedAttempts[scannerId];
        window.gameAlert(`Scan failed. ${remainingAttempts} attempts remaining before lockout.`, 'warning', 'Scan Failed', 4000);
    }
}

// Generate a fingerprint sample with quality assessment
export function generateFingerprintSample(owner, quality = null) {
    // If no quality provided, generate based on random factors
    if (quality === null) {
        quality = 0.6 + (Math.random() * 0.4); // 60-100% quality range
    }
    
    const rating = getRatingFromQuality(quality);
    
    return {
        owner: owner || 'Unknown',
        type: 'fingerprint',
        quality: quality,
        rating: rating,
        id: generateSampleId(),
        collectedFrom: 'evidence'
    };
}

// Toggle the biometrics panel
export function toggleBiometricsPanel() {
    const biometricsPanel = document.getElementById('biometrics-panel');
    if (!biometricsPanel) return;
    
    const isVisible = biometricsPanel.style.display === 'block';
    biometricsPanel.style.display = isVisible ? 'none' : 'block';
    
    // Update panel content when opening
    if (!isVisible) {
        updateBiometricsPanel();
    }
}

// Update biometrics panel with current samples
export function updateBiometricsPanel() {
    const biometricsContent = document.getElementById('biometrics-content');
    if (!biometricsContent) return;
    
    const searchTerm = document.getElementById('biometrics-search')?.value?.toLowerCase() || '';
    const activeCategory = document.querySelector('.biometrics-category.active')?.dataset.category || 'all';
    
    // Filter samples based on search and category
    let filteredSamples = [...(window.gameState.biometricSamples || [])];
    
    // Apply category filter
    if (activeCategory === 'fingerprint') {
        filteredSamples = filteredSamples.filter(sample => sample.type === 'fingerprint');
    }
    
    // Apply search filter
    if (searchTerm) {
        filteredSamples = filteredSamples.filter(sample => 
            sample.owner.toLowerCase().includes(searchTerm) || 
            sample.type.toLowerCase().includes(searchTerm)
        );
    }
    
    // Sort samples by quality (highest first)
    filteredSamples.sort((a, b) => b.quality - a.quality);
    
    // Clear current content
    biometricsContent.innerHTML = '';
    
    // Add samples
    if (filteredSamples.length === 0) {
        if (searchTerm) {
            biometricsContent.innerHTML = '<div class="sample-item">No samples match your search.</div>';
        } else if (activeCategory !== 'all') {
            biometricsContent.innerHTML = `<div class="sample-item">No ${activeCategory} samples found.</div>`;
        } else {
            biometricsContent.innerHTML = '<div class="sample-item">No samples collected yet.</div>';
        }
    } else {
        filteredSamples.forEach(sample => {
            const sampleElement = document.createElement('div');
            sampleElement.className = 'sample-item';
            sampleElement.dataset.id = sample.id || 'unknown';
            
            // Ensure all properties exist with safe defaults
            const owner = sample.owner || 'Unknown';
            const type = sample.type || 'fingerprint';
            const quality = sample.quality || 0;
            const rating = sample.rating || getRatingFromQuality(quality);
            const collectedAt = sample.collectedAt || new Date().toISOString();
            
            const qualityPercentage = Math.round(quality * 100);
            const timestamp = new Date(collectedAt);
            const formattedTime = timestamp.toLocaleDateString() + ' ' + timestamp.toLocaleTimeString();
            
            sampleElement.innerHTML = `
                <strong>${owner}</strong>
                <div class="sample-details">
                    <span class="sample-type">${type}</span>
                    <span class="sample-quality quality-${rating.toLowerCase()}">${rating} (${qualityPercentage}%)</span>
                </div>
                <div class="sample-date">${formattedTime}</div>
            `;
            
            biometricsContent.appendChild(sampleElement);
        });
    }
}

// Update biometrics count in the toggle button
export function updateBiometricsCount() {
    const countElement = document.getElementById('biometrics-count');
    if (countElement && window.gameState?.biometricSamples) {
        const count = window.gameState.biometricSamples.length;
        countElement.textContent = count;
        countElement.style.display = count > 0 ? 'flex' : 'none';
        
        // Show the biometrics toggle if we have samples
        const biometricsToggle = document.getElementById('biometrics-toggle');
        if (biometricsToggle && count > 0) {
            biometricsToggle.style.display = 'block';
        }
    }
}

// Export for global access
window.initializeBiometricsPanel = initializeBiometricsPanel;
window.addBiometricSample = addBiometricSample;
window.handleBiometricScan = handleBiometricScan;
window.generateFingerprintSample = generateFingerprintSample;
window.toggleBiometricsPanel = toggleBiometricsPanel;
window.updateBiometricsPanel = updateBiometricsPanel;
window.updateBiometricsCount = updateBiometricsCount; 