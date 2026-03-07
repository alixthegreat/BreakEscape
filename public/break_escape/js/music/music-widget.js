/**
 * MusicWidget — HUD button + popup panel for the music controller.
 *
 * Attaches a speaker button to #player-hud-buttons (the inventory bar).
 * Clicking it toggles a panel with:
 *   - Current track title & playlist
 *   - Skip / Pause-Resume buttons
 *   - Playlist selector dropdown
 *   - Music, SFX, and Master volume sliders
 *
 * Works on all tabs: non-leader tabs show controls but send commands to the
 * leader tab via BroadcastChannel (handled inside MusicController).
 */

import { MUSIC_CONFIG } from './music-config.js';
import MusicController from './music-controller.js';

export class MusicWidget {
    constructor() {
        this._panelOpen  = false;
        this._currentState = MusicController.getState();
    }

    // ── Mount ────────────────────────────────────────────────────────────────

    mount() {
        // Inject CSS if not already present (fallback for standalone HTML; ERB templates link it statically)
        if (!document.getElementById('music-widget-css')) {
            const link = document.createElement('link');
            link.id   = 'music-widget-css';
            link.rel  = 'stylesheet';
            // Allow host app to override; default mirrors the Rails engine public path
            link.href = window.breakEscapeConfig?.musicWidgetCSSPath || '/break_escape/css/music-widget.css';
            document.head.appendChild(link);
        }

        this._createButton();
        this._createPanel();
        this._bindEvents();
        this._updateUI(MusicController.getState());
    }

    // ── Build DOM ────────────────────────────────────────────────────────────

    _createButton() {
        const btn = document.createElement('div');
        btn.id        = 'music-widget-btn';
        btn.title     = 'Music Controls';
        btn.innerHTML = `
            <span class="music-btn-icon">🔊</span>
            <span class="music-btn-label">Music</span>
        `;
        btn.addEventListener('click', e => { e.stopPropagation(); this._togglePanel(); });
        this._btn = btn;

        // Mount into the fixed anchor in the top-right corner
        const anchor = document.getElementById('music-widget-btn-anchor');
        if (anchor) {
            anchor.appendChild(btn);
        } else {
            // Fallback: retry until anchor is ready (e.g. standalone HTML)
            const retry = () => {
                const a = document.getElementById('music-widget-btn-anchor');
                if (a) { a.appendChild(btn); }
                else   { setTimeout(retry, 150); }
            };
            retry();
        }
    }

    _createPanel() {
        const playlists = MUSIC_CONFIG.playlists;

        // Build playlist options
        const playlistOptions = Object.entries(playlists)
            .map(([key, pl]) => `<option value="${key}">${pl.displayName}</option>`)
            .join('');

        const panel = document.createElement('div');
        panel.id = 'music-widget-panel';
        panel.innerHTML = `
            <div class="mw-header">
                <span class="mw-header-title">&#9834; Music</span>
                <button class="mw-close-btn" id="mw-close-btn">✕</button>
            </div>

            <div class="mw-passive-notice" id="mw-passive-notice" style="display:none">
                <span class="mw-passiv-text">Controlled from another tab</span>
                <button class="mw-takeover-btn" id="mw-takeover-btn">Take control</button>
            </div>

            <div class="mw-now-playing">
                <div class="mw-np-label">Now playing</div>
                <div class="mw-track-title" id="mw-track-title">–</div>
                <div class="mw-track-count" id="mw-track-count"></div>
                <div class="mw-status-pill" id="mw-status-pill">Playing</div>
            </div>

            <div class="mw-controls">
                <button class="mw-btn" id="mw-skip-btn">&#9654;&#9654; Skip</button>
                <button class="mw-btn" id="mw-pause-btn">&#9646;&#9646; Pause</button>
            </div>

            <div class="mw-section">
                <div class="mw-section-label">Playlist</div>
                <select class="mw-select" id="mw-playlist-select">
                    ${playlistOptions}
                </select>
            </div>

            <div class="mw-volumes">
                <div class="mw-vol-row">
                    <span class="mw-vol-label">Music</span>
                    <input type="range" class="mw-vol-slider" id="mw-vol-music"
                           min="0" max="1" step="0.01">
                    <span class="mw-vol-value" id="mw-vol-music-val">50%</span>
                </div>
                <div class="mw-vol-row">
                    <span class="mw-vol-label">SFX</span>
                    <input type="range" class="mw-vol-slider" id="mw-vol-sfx"
                           min="0" max="1" step="0.01">
                    <span class="mw-vol-value" id="mw-vol-sfx-val">80%</span>
                </div>
                <div class="mw-vol-row">
                    <span class="mw-vol-label">Master</span>
                    <input type="range" class="mw-vol-slider" id="mw-vol-master"
                           min="0" max="1" step="0.01">
                    <span class="mw-vol-value" id="mw-vol-master-val">100%</span>
                </div>
            </div>
        `;

        document.body.appendChild(panel);
        this._panel = panel;
    }

    // ── Events ───────────────────────────────────────────────────────────────

    _bindEvents() {
        // Panel controls
        document.getElementById('mw-close-btn').addEventListener('click',
            () => this._hidePanel());

        document.getElementById('mw-skip-btn').addEventListener('click',
            () => MusicController.skip());

        document.getElementById('mw-pause-btn').addEventListener('click', () => {
            if (this._currentState?.paused) MusicController.resume();
            else                            MusicController.pause();
        });

        document.getElementById('mw-takeover-btn').addEventListener('click', () => {
            MusicController.stepDown(); // tell current leader to release
            // After a brief moment, current tab will win the lock election
        });

        // Playlist selector
        document.getElementById('mw-playlist-select').addEventListener('change', e => {
            MusicController.switchPlaylist(e.target.value, true);
        });

        // Volume sliders — update in real time, notify controller on input
        const volMusic  = document.getElementById('mw-vol-music');
        const volSFX    = document.getElementById('mw-vol-sfx');
        const volMaster = document.getElementById('mw-vol-master');

        volMusic.addEventListener('input', e => {
            const v = parseFloat(e.target.value);
            document.getElementById('mw-vol-music-val').textContent = Math.round(v * 100) + '%';
            MusicController.setMusicVolume(v);
        });

        volSFX.addEventListener('input', e => {
            const v = parseFloat(e.target.value);
            document.getElementById('mw-vol-sfx-val').textContent = Math.round(v * 100) + '%';
            MusicController.setSFXVolume(v);
        });

        volMaster.addEventListener('input', e => {
            const v = parseFloat(e.target.value);
            document.getElementById('mw-vol-master-val').textContent = Math.round(v * 100) + '%';
            MusicController.setMasterVolume(v);
        });

        // Close panel on outside click
        document.addEventListener('click', e => {
            if (this._panelOpen && !this._panel.contains(e.target) && e.target !== this._btn) {
                this._hidePanel();
            }
        });

        // Controller events
        window.addEventListener('musiccontroller:statechange',
            e => this._updateUI(e.detail));
        window.addEventListener('musiccontroller:trackchange',
            e => this._updateUI(MusicController.getState()));
        window.addEventListener('musiccontroller:leaderchange',
            e => this._updateUI(MusicController.getState()));
    }

    // ── Panel toggle ─────────────────────────────────────────────────────────

    _togglePanel() {
        if (this._panelOpen) this._hidePanel();
        else                 this._showPanel();
    }

    _showPanel() {
        this._panelOpen = true;
        this._panel.classList.add('visible');
        this._btn.classList.add('panel-open');
        this._updateUI(MusicController.getState());
    }

    _hidePanel() {
        this._panelOpen = false;
        this._panel.classList.remove('visible');
        this._btn.classList.remove('panel-open');
    }

    // ── UI update ─────────────────────────────────────────────────────────────

    _updateUI(state) {
        if (!state) return;
        this._currentState = state;

        // Track info
        const titleEl = document.getElementById('mw-track-title');
        const countEl = document.getElementById('mw-track-count');
        const pillEl  = document.getElementById('mw-status-pill');

        if (titleEl) {
            titleEl.textContent = state.trackTitle || '–';
            titleEl.title       = state.trackTitle || '';
        }
        if (countEl && state.totalTracks > 0) {
            const pos = (state.trackIndex ?? -1) + 1;
            countEl.textContent = `${state.playlistName || ''} · ${pos}/${state.totalTracks}`;
        }

        // Pause / Resume button label
        const pauseBtn = document.getElementById('mw-pause-btn');
        if (pauseBtn) {
            pauseBtn.innerHTML = state.paused
                ? '&#9654; Resume'
                : '&#9646;&#9646; Pause';
        }

        // Status pill
        if (pillEl) {
            if (!state.isLeader) {
                pillEl.textContent = state.paused ? 'Paused (remote)' : 'Playing (remote)';
                pillEl.classList.add('passive');
            } else {
                pillEl.textContent = state.paused ? 'Paused' : 'Playing';
                pillEl.classList.remove('passive');
            }
        }

        // Non-leader notice
        const notice = document.getElementById('mw-passive-notice');
        if (notice) {
            notice.style.display = state.isLeader ? 'none' : 'flex';
        }

        // Playlist selector
        const sel = document.getElementById('mw-playlist-select');
        if (sel && state.playlist) {
            sel.value = state.playlist;
        }

        // Volume sliders (only update if user isn't actively dragging)
        this._setSlider('mw-vol-music',   'mw-vol-music-val',   state.musicVolume);
        this._setSlider('mw-vol-sfx',     'mw-vol-sfx-val',     state.sfxVolume);
        this._setSlider('mw-vol-master',  'mw-vol-master-val',  state.masterVolume);

        // Speaker icon reflects muted state
        const icon = this._btn?.querySelector('.music-btn-icon');
        if (icon) {
            const muted = (state.masterVolume ?? 1) < 0.01 || (state.musicVolume ?? 1) < 0.01;
            icon.textContent = muted ? '🔇' : state.paused ? '🔈' : '🔊';
        }
    }

    _setSlider(sliderId, valId, value) {
        if (value === undefined || value === null) return;
        const slider = document.getElementById(sliderId);
        const label  = document.getElementById(valId);
        // Don't override if the user has  their finger on it
        if (slider && document.activeElement !== slider) {
            slider.value = value;
        }
        if (label) {
            label.textContent = Math.round(value * 100) + '%';
        }
    }
}

// ── Convenience factory ────────────────────────────────────────────────────────
export function createMusicWidget() {
    const widget = new MusicWidget();
    widget.mount();
    return widget;
}
