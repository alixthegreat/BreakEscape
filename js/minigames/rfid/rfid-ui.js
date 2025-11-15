/**
 * RFID UI Renderer
 *
 * Renders Flipper Zero-style RFID interface:
 * - Main menu (Read / Saved)
 * - Tap interface (unlock mode)
 * - Saved cards list
 * - Emulation screen
 * - Card reading screen (clone mode)
 * - Card data display
 *
 * @module rfid-ui
 */

export class RFIDUIRenderer {
    constructor(minigame) {
        this.minigame = minigame;
        this.container = minigame.gameContainer;
        this.dataManager = minigame.dataManager;
        console.log('🎨 RFIDUIRenderer initialized');
    }

    /**
     * Create unlock mode interface
     */
    createUnlockInterface() {
        this.clear();

        // Create Flipper Zero frame
        const flipper = this.createFlipperFrame();

        // Show main menu
        this.showMainMenu('unlock');

        this.container.appendChild(flipper);
    }

    /**
     * Create clone mode interface
     */
    createCloneInterface() {
        this.clear();

        // Create Flipper Zero frame
        const flipper = this.createFlipperFrame();

        // Auto-start reading if card provided
        if (this.minigame.params.cardToClone) {
            this.showReadingScreen();
        } else {
            this.showMainMenu('clone');
        }

        this.container.appendChild(flipper);
    }

    /**
     * Create Flipper Zero device frame
     * @returns {HTMLElement} Flipper frame element
     */
    createFlipperFrame() {
        const frame = document.createElement('div');
        frame.className = 'flipper-zero-frame';

        // Header with logo and battery
        const header = document.createElement('div');
        header.className = 'flipper-header';

        const logo = document.createElement('div');
        logo.className = 'flipper-logo';
        logo.textContent = 'FLIPPER ZERO';

        const battery = document.createElement('div');
        battery.className = 'flipper-battery';
        battery.textContent = '⚡ 100%';

        header.appendChild(logo);
        header.appendChild(battery);

        // Screen container
        const screen = document.createElement('div');
        screen.className = 'flipper-screen';
        screen.id = 'rfid-screen';

        frame.appendChild(header);
        frame.appendChild(screen);

        return frame;
    }

    /**
     * Get screen element
     * @returns {HTMLElement} Screen element
     */
    getScreen() {
        return document.getElementById('rfid-screen');
    }

    /**
     * Show main menu
     * @param {string} mode - 'unlock' or 'clone'
     */
    showMainMenu(mode) {
        const screen = this.getScreen();
        screen.innerHTML = '';

        // Breadcrumb
        const breadcrumb = document.createElement('div');
        breadcrumb.className = 'flipper-breadcrumb';
        breadcrumb.textContent = 'RFID';
        screen.appendChild(breadcrumb);

        // Menu items
        const menu = document.createElement('div');
        menu.className = 'flipper-menu';

        if (mode === 'unlock') {
            // Read option (tap cards)
            const readOption = document.createElement('div');
            readOption.className = 'flipper-menu-item';
            readOption.textContent = '> Read';
            readOption.addEventListener('click', () => this.showTapInterface());
            menu.appendChild(readOption);

            // Saved option (emulate)
            const savedOption = document.createElement('div');
            savedOption.className = 'flipper-menu-item';
            savedOption.textContent = '  Saved';
            savedOption.addEventListener('click', () => this.showSavedCards());
            menu.appendChild(savedOption);
        } else {
            // Clone mode - just show "Reading..." message
            const info = document.createElement('div');
            info.className = 'flipper-info';
            info.textContent = 'Place card...';
            menu.appendChild(info);
        }

        screen.appendChild(menu);
    }

    /**
     * Show tap interface for unlock mode
     */
    showTapInterface() {
        const screen = this.getScreen();
        screen.innerHTML = '';

        // Breadcrumb
        const breadcrumb = document.createElement('div');
        breadcrumb.className = 'flipper-breadcrumb';
        breadcrumb.textContent = 'RFID > Read';
        screen.appendChild(breadcrumb);

        // NFC waves animation
        const waves = document.createElement('div');
        waves.className = 'rfid-nfc-waves-container';
        waves.innerHTML = '<div class="rfid-nfc-icon">📡</div>';
        screen.appendChild(waves);

        // Instruction
        const instruction = document.createElement('div');
        instruction.className = 'flipper-info';
        instruction.textContent = 'Place card near reader...';
        screen.appendChild(instruction);

        // List available keycards
        const cardList = document.createElement('div');
        cardList.className = 'flipper-card-list';

        const availableCards = this.minigame.params.availableCards || [];

        if (availableCards.length === 0) {
            const noCards = document.createElement('div');
            noCards.className = 'flipper-info-dim';
            noCards.textContent = 'No keycards in inventory';
            cardList.appendChild(noCards);
        } else {
            availableCards.forEach(card => {
                const cardItem = document.createElement('div');
                cardItem.className = 'flipper-menu-item';
                cardItem.textContent = `> ${card.scenarioData?.name || 'Keycard'}`;
                cardItem.addEventListener('click', () => {
                    this.minigame.handleCardTap(card);
                });
                cardList.appendChild(cardItem);
            });
        }

        screen.appendChild(cardList);

        // Back button
        const back = document.createElement('div');
        back.className = 'flipper-button-back';
        back.textContent = '← Back';
        back.addEventListener('click', () => this.showMainMenu('unlock'));
        screen.appendChild(back);
    }

    /**
     * Show saved cards list
     */
    showSavedCards() {
        const screen = this.getScreen();
        screen.innerHTML = '';

        // Breadcrumb
        const breadcrumb = document.createElement('div');
        breadcrumb.className = 'flipper-breadcrumb';
        breadcrumb.textContent = 'RFID > Saved';
        screen.appendChild(breadcrumb);

        // Get saved cards
        const savedCards = this.dataManager.getSavedCards();

        if (savedCards.length === 0) {
            const noCards = document.createElement('div');
            noCards.className = 'flipper-info';
            noCards.textContent = 'No saved cards';
            screen.appendChild(noCards);
        } else {
            // Card list
            const cardList = document.createElement('div');
            cardList.className = 'flipper-card-list';

            savedCards.forEach(card => {
                const cardItem = document.createElement('div');
                cardItem.className = 'flipper-menu-item';
                cardItem.textContent = `> ${card.name}`;
                cardItem.addEventListener('click', () => this.showEmulationScreen(card));
                cardList.appendChild(cardItem);
            });

            screen.appendChild(cardList);
        }

        // Back button
        const back = document.createElement('div');
        back.className = 'flipper-button-back';
        back.textContent = '← Back';
        back.addEventListener('click', () => this.showMainMenu('unlock'));
        screen.appendChild(back);
    }

    /**
     * Show emulation screen
     * @param {Object} card - Card to emulate
     */
    showEmulationScreen(card) {
        const screen = this.getScreen();
        screen.innerHTML = '';

        // Breadcrumb
        const breadcrumb = document.createElement('div');
        breadcrumb.className = 'flipper-breadcrumb';
        breadcrumb.textContent = 'RFID > Saved > Emulate';
        screen.appendChild(breadcrumb);

        // Emulation icon
        const icon = document.createElement('div');
        icon.className = 'rfid-emulate-icon';
        icon.textContent = '📡';
        screen.appendChild(icon);

        // Protocol
        const protocol = document.createElement('div');
        protocol.className = 'flipper-info';
        protocol.textContent = 'EM-Micro EM4100';
        screen.appendChild(protocol);

        // Card name
        const name = document.createElement('div');
        name.className = 'flipper-card-name';
        name.textContent = card.name;
        screen.appendChild(name);

        // Card data
        const { facility, cardNumber } = this.dataManager.hexToFacilityCard(card.rfid_hex);

        const data = document.createElement('div');
        data.className = 'flipper-card-data';
        data.innerHTML = `
            <div>HEX: ${this.dataManager.formatHex(card.rfid_hex)}</div>
            <div>Facility: ${facility}</div>
            <div>Card: ${cardNumber}</div>
        `;
        screen.appendChild(data);

        // Emulating message
        const emulating = document.createElement('div');
        emulating.className = 'flipper-emulating';
        emulating.textContent = 'Emulating...';
        screen.appendChild(emulating);

        // Trigger emulation after showing screen
        setTimeout(() => {
            this.minigame.handleEmulate(card);
        }, 500);
    }

    /**
     * Show card reading screen (clone mode)
     */
    showReadingScreen() {
        const screen = this.getScreen();
        screen.innerHTML = '';

        // Breadcrumb
        const breadcrumb = document.createElement('div');
        breadcrumb.className = 'flipper-breadcrumb';
        breadcrumb.textContent = 'RFID > Read';
        screen.appendChild(breadcrumb);

        // Status
        const status = document.createElement('div');
        status.className = 'flipper-info';
        status.textContent = 'Reading 1/2';
        screen.appendChild(status);

        // Modulation
        const modulation = document.createElement('div');
        modulation.className = 'flipper-info-dim';
        modulation.textContent = '> ASK   PSK';
        screen.appendChild(modulation);

        // Instruction
        const instruction = document.createElement('div');
        instruction.className = 'flipper-info';
        instruction.textContent = "Don't move card...";
        screen.appendChild(instruction);

        // Progress bar
        const progressContainer = document.createElement('div');
        progressContainer.className = 'rfid-progress-container';

        const progressBar = document.createElement('div');
        progressBar.className = 'rfid-progress-bar';
        progressBar.id = 'rfid-progress-bar';

        progressContainer.appendChild(progressBar);
        screen.appendChild(progressContainer);

        // Start reading animation
        this.minigame.startCardReading();
    }

    /**
     * Update reading progress
     * @param {number} progress - Progress percentage (0-100)
     */
    updateReadingProgress(progress) {
        const progressBar = document.getElementById('rfid-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;

            // Change color based on progress
            if (progress < 50) {
                progressBar.style.backgroundColor = '#FF8200';
            } else if (progress < 100) {
                progressBar.style.backgroundColor = '#FFA500';
            } else {
                progressBar.style.backgroundColor = '#00FF00';
            }
        }
    }

    /**
     * Show card data screen after reading
     * @param {Object} cardData - Read card data
     */
    showCardDataScreen(cardData) {
        const screen = this.getScreen();
        screen.innerHTML = '';

        // Breadcrumb
        const breadcrumb = document.createElement('div');
        breadcrumb.className = 'flipper-breadcrumb';
        breadcrumb.textContent = 'RFID > Read';
        screen.appendChild(breadcrumb);

        // Protocol
        const protocol = document.createElement('div');
        protocol.className = 'flipper-info';
        protocol.textContent = 'EM-Micro EM4100';
        screen.appendChild(protocol);

        // Card data
        const { facility, cardNumber } = this.dataManager.hexToFacilityCard(cardData.rfid_hex);
        const checksum = this.dataManager.calculateChecksum(cardData.rfid_hex);
        const dez8 = this.dataManager.toDEZ8(cardData.rfid_hex);

        const data = document.createElement('div');
        data.className = 'flipper-card-data';
        data.innerHTML = `
            <div>HEX: ${this.dataManager.formatHex(cardData.rfid_hex)}</div>
            <div>Facility: ${facility}</div>
            <div>Card: ${cardNumber}</div>
            <div>Checksum: 0x${checksum.toString(16).toUpperCase().padStart(2, '0')}</div>
            <div>DEZ 8: ${dez8}</div>
        `;
        screen.appendChild(data);

        // Buttons
        const buttons = document.createElement('div');
        buttons.className = 'flipper-buttons';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'flipper-button';
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', () => this.minigame.handleSaveCard(cardData));

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'flipper-button flipper-button-secondary';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => this.minigame.complete(false));

        buttons.appendChild(saveBtn);
        buttons.appendChild(cancelBtn);
        screen.appendChild(buttons);
    }

    /**
     * Show success message
     * @param {string} message - Success message
     */
    showSuccess(message) {
        const screen = this.getScreen();
        screen.innerHTML = '';

        const success = document.createElement('div');
        success.className = 'flipper-success';
        success.innerHTML = `
            <div class="flipper-success-icon">✓</div>
            <div class="flipper-success-message">${message}</div>
        `;
        screen.appendChild(success);
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        const screen = this.getScreen();
        screen.innerHTML = '';

        const error = document.createElement('div');
        error.className = 'flipper-error';
        error.innerHTML = `
            <div class="flipper-error-icon">✗</div>
            <div class="flipper-error-message">${message}</div>
        `;
        screen.appendChild(error);
    }

    /**
     * Clear screen
     */
    clear() {
        this.container.innerHTML = '';
    }
}
