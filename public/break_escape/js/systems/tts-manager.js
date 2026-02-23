/**
 * TTS Manager - Text-to-Speech audio playback for person-chat conversations
 *
 * Fetches server-generated MP3 audio for NPC dialog lines and plays via HTML5 Audio.
 * Supports preloading next line while current plays. Gracefully degrades if TTS
 * is unavailable (no API key, network error, etc.).
 */

import { ApiClient } from '../api-client.js';

class TTSManager {
    constructor() {
        this.audio = new Audio();
        this.enabled = true;
        this.volume = 0.8;
        this.preloadCache = new Map(); // "npcId|text" -> objectURL
        this.onEndedCallback = null;
        this.playing = false;

        this.audio.volume = this.volume;
        this.audio.addEventListener('ended', () => {
            this.playing = false;
            if (this.onEndedCallback) {
                this.onEndedCallback();
            }
        });

        this.audio.addEventListener('error', () => {
            this.playing = false;
        });
    }

    /**
     * Play TTS audio for a dialogue line
     * @param {string} npcId - NPC identifier
     * @param {string} text - Clean dialogue text (no "Speaker: " prefix)
     * @returns {Promise<number|null>} Audio duration in ms, or null if unavailable
     */
    async play(npcId, text) {
        if (!this.enabled || !text || !text.trim()) return null;

        // Stop any current playback
        this.stop();

        try {
            const key = this._cacheKey(npcId, text);

            // Check preload cache first
            let audioUrl = this.preloadCache.get(key);

            if (audioUrl) {
                // Consume from preload cache
                this.preloadCache.delete(key);
            } else {
                // Fetch from server
                const blob = await ApiClient.getTTS(npcId, text);
                if (!blob) return null;
                audioUrl = URL.createObjectURL(blob);
            }

            this.audio.src = audioUrl;

            // Wait for metadata to get duration
            const duration = await new Promise((resolve, reject) => {
                const onLoaded = () => {
                    cleanup();
                    resolve(Math.ceil(this.audio.duration * 1000));
                };
                const onError = () => {
                    cleanup();
                    reject(new Error('Audio load failed'));
                };
                const timeout = setTimeout(() => {
                    cleanup();
                    reject(new Error('Audio load timeout'));
                }, 10000);

                const cleanup = () => {
                    this.audio.removeEventListener('loadedmetadata', onLoaded);
                    this.audio.removeEventListener('error', onError);
                    clearTimeout(timeout);
                };

                this.audio.addEventListener('loadedmetadata', onLoaded);
                this.audio.addEventListener('error', onError);
            });

            this.playing = true;
            await this.audio.play();

            console.log(`[TTS] Playing for ${npcId}: "${text.substring(0, 40)}..." (${duration}ms)`);
            return duration;
        } catch (error) {
            this.playing = false;
            console.warn('[TTS] Play failed:', error.message);
            return null;
        }
    }

    /**
     * Preload audio for an upcoming line (fetch but don't play)
     * @param {string} npcId - NPC identifier
     * @param {string} text - Dialogue text
     */
    async preload(npcId, text) {
        if (!this.enabled || !text || !text.trim()) return;

        const key = this._cacheKey(npcId, text);
        if (this.preloadCache.has(key)) return;

        try {
            const blob = await ApiClient.getTTS(npcId, text);
            if (blob) {
                this.preloadCache.set(key, URL.createObjectURL(blob));
                console.log(`[TTS] Preloaded: "${text.substring(0, 40)}..."`);
            }
        } catch (error) {
            // Silently fail — preloading is best-effort
        }
    }

    /**
     * Stop current playback
     */
    stop() {
        if (this.playing) {
            this.audio.pause();
            this.audio.currentTime = 0;
            this.playing = false;
        }
        this.audio.src = '';
    }

    /**
     * Check if audio is currently playing
     * @returns {boolean}
     */
    isPlaying() {
        return this.playing;
    }

    /**
     * Set callback for when audio finishes playing
     * @param {Function} callback
     */
    onEnded(callback) {
        this.onEndedCallback = callback;
    }

    /**
     * Set volume (0.0 - 1.0)
     * @param {number} vol
     */
    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
        this.audio.volume = this.volume;
    }

    /**
     * Enable/disable TTS
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) this.stop();
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.stop();
        for (const url of this.preloadCache.values()) {
            URL.revokeObjectURL(url);
        }
        this.preloadCache.clear();
        this.onEndedCallback = null;
    }

    /** @private */
    _cacheKey(npcId, text) {
        return `${npcId}|${text}`;
    }
}

export default TTSManager;
