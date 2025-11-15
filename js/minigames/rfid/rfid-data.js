/**
 * RFID Data Manager
 *
 * Handles RFID card data management:
 * - Card generation with EM4100 protocol
 * - Hex ID validation
 * - Card save/load to cloner device
 * - Format conversions (hex, DEZ8, facility codes)
 *
 * @module rfid-data
 */

// Maximum number of cards that can be saved to cloner
const MAX_SAVED_CARDS = 50;

// Template names for generated cards
const CARD_NAME_TEMPLATES = [
    'Security Badge',
    'Employee ID',
    'Access Card',
    'Visitor Pass',
    'Executive Key',
    'Maintenance Card',
    'Lab Access',
    'Server Room'
];

export class RFIDDataManager {
    constructor() {
        console.log('🔐 RFIDDataManager initialized');
    }

    /**
     * Generate a random RFID card with EM4100 format
     * @returns {Object} Card data with hex, facility code, card number
     */
    generateRandomCard() {
        // Generate 10-character hex ID (5 bytes)
        const hex = Array.from({ length: 10 }, () =>
            Math.floor(Math.random() * 16).toString(16).toUpperCase()
        ).join('');

        // Calculate facility code from first byte
        const facility = parseInt(hex.substring(0, 2), 16);

        // Calculate card number from next 2 bytes
        const cardNumber = parseInt(hex.substring(2, 6), 16);

        // Generate card name
        const nameTemplate = CARD_NAME_TEMPLATES[Math.floor(Math.random() * CARD_NAME_TEMPLATES.length)];
        const name = `${nameTemplate} #${Math.floor(Math.random() * 9000) + 1000}`;

        return {
            name: name,
            rfid_hex: hex,
            rfid_facility: facility,
            rfid_card_number: cardNumber,
            rfid_protocol: 'EM4100',
            type: 'keycard',
            key_id: `card_${hex.toLowerCase()}`
        };
    }

    /**
     * Validate hex ID format
     * @param {string} hex - Hex ID to validate
     * @returns {Object} {valid: boolean, error?: string}
     */
    validateHex(hex) {
        if (!hex || typeof hex !== 'string') {
            return { valid: false, error: 'Hex ID must be a string' };
        }

        if (hex.length !== 10) {
            return { valid: false, error: 'Hex ID must be exactly 10 characters' };
        }

        if (!/^[0-9A-Fa-f]{10}$/.test(hex)) {
            return { valid: false, error: 'Hex ID must contain only hex characters (0-9, A-F)' };
        }

        return { valid: true };
    }

    /**
     * Save card to RFID cloner device
     * @param {Object} cardData - Card data to save
     * @returns {Object} {success: boolean, message: string}
     */
    saveCardToCloner(cardData) {
        // Find rfid_cloner in inventory
        const cloner = window.inventory?.items?.find(item =>
            item?.scenarioData?.type === 'rfid_cloner'
        );

        if (!cloner) {
            return { success: false, message: 'RFID cloner not found in inventory' };
        }

        // Validate hex ID
        const validation = this.validateHex(cardData.rfid_hex);
        if (!validation.valid) {
            return { success: false, message: validation.error };
        }

        // Initialize saved_cards array if missing
        if (!cloner.scenarioData.saved_cards) {
            cloner.scenarioData.saved_cards = [];
        }

        // Check if at max capacity
        if (cloner.scenarioData.saved_cards.length >= MAX_SAVED_CARDS) {
            return { success: false, message: `Cloner full (max ${MAX_SAVED_CARDS} cards)` };
        }

        // Check for duplicate hex ID
        const existingIndex = cloner.scenarioData.saved_cards.findIndex(card =>
            card.rfid_hex === cardData.rfid_hex
        );

        if (existingIndex !== -1) {
            // Overwrite existing card with updated timestamp
            cloner.scenarioData.saved_cards[existingIndex] = {
                ...cardData,
                timestamp: Date.now()
            };
            console.log(`📡 Overwritten duplicate card: ${cardData.name}`);
            return { success: true, message: `Updated: ${cardData.name}` };
        } else {
            // Add new card
            cloner.scenarioData.saved_cards.push({
                ...cardData,
                timestamp: Date.now()
            });
            console.log(`📡 Saved new card: ${cardData.name}`);
            return { success: true, message: `Saved: ${cardData.name}` };
        }
    }

    /**
     * Get all saved cards from cloner
     * @returns {Array} Array of saved cards
     */
    getSavedCards() {
        const cloner = window.inventory?.items?.find(item =>
            item?.scenarioData?.type === 'rfid_cloner'
        );

        if (!cloner || !cloner.scenarioData.saved_cards) {
            return [];
        }

        return cloner.scenarioData.saved_cards;
    }

    /**
     * Convert hex ID to facility code and card number
     * EM4100 format: First byte = facility, next 2 bytes = card number
     * @param {string} hex - 10-character hex ID
     * @returns {Object} {facility: number, cardNumber: number}
     */
    hexToFacilityCard(hex) {
        const facility = parseInt(hex.substring(0, 2), 16);
        const cardNumber = parseInt(hex.substring(2, 6), 16);
        return { facility, cardNumber };
    }

    /**
     * Convert facility code and card number to hex ID
     * @param {number} facility - Facility code (0-255)
     * @param {number} cardNumber - Card number (0-65535)
     * @returns {string} 10-character hex ID
     */
    facilityCardToHex(facility, cardNumber) {
        // Convert to hex and pad
        const facilityHex = facility.toString(16).toUpperCase().padStart(2, '0');
        const cardHex = cardNumber.toString(16).toUpperCase().padStart(4, '0');

        // Generate 4 random chars for remaining data
        const randomHex = Array.from({ length: 4 }, () =>
            Math.floor(Math.random() * 16).toString(16).toUpperCase()
        ).join('');

        return facilityHex + cardHex + randomHex;
    }

    /**
     * Convert hex ID to DEZ 8 format
     * EM4100 DEZ 8: Last 3 bytes (6 hex chars) converted to decimal
     * @param {string} hex - 10-character hex ID
     * @returns {string} 8-digit decimal string with leading zeros
     */
    toDEZ8(hex) {
        const lastThreeBytes = hex.slice(-6);
        const decimal = parseInt(lastThreeBytes, 16);
        return decimal.toString().padStart(8, '0');
    }

    /**
     * Calculate EM4100 checksum
     * XOR of all bytes
     * @param {string} hex - 10-character hex ID
     * @returns {number} Checksum byte (0x00-0xFF)
     */
    calculateChecksum(hex) {
        const bytes = hex.match(/.{1,2}/g).map(b => parseInt(b, 16));
        let checksum = 0;
        bytes.forEach(byte => {
            checksum ^= byte;
        });
        return checksum & 0xFF;
    }

    /**
     * Format hex for display (add spaces every 2 chars)
     * @param {string} hex - Hex string
     * @returns {string} Formatted hex string
     */
    formatHex(hex) {
        return hex.match(/.{1,2}/g).join(' ').toUpperCase();
    }
}
