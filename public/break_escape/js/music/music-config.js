/**
 * Music Controller Configuration
 *
 * baseURL is resolved in this order:
 *   1. window.breakEscapeConfig.musicBasePath  (set by Rails engine host)
 *   2. window.breakEscapeConfig.assetsPath + '/music' (derived from existing asset config)
 *   3. Hard-coded fallback below
 *
 * To host MP3s somewhere else entirely, set:
 *   window.breakEscapeConfig = { musicBasePath: 'https://cdn.example.com/music' }
 *
 * Playlist shuffle options:
 *   'shuffle'     - random order, no repeats until all tracks played
 *   'sequential'  - always play in defined order
 */

function resolveMusicBaseURL() {
    if (window.breakEscapeConfig?.musicBasePath) {
        return window.breakEscapeConfig.musicBasePath.replace(/\/$/, '');
    }
    if (window.breakEscapeConfig?.assetsPath) {
        return window.breakEscapeConfig.assetsPath.replace(/\/$/, '') + '/music';
    }
    return '/break_escape/assets/music';
}

export const MUSIC_CONFIG = {
    // Resolved at init time so runtime config changes are picked up
    get baseURL() { return resolveMusicBaseURL(); },

    // Global fade duration in milliseconds when switching playlists
    fadeDuration: 2500,

    // Default playlist to start with (null = silent until explicitly switched)
    defaultPlaylist: 'noir',

    // Default volume levels (0.0 – 1.0)
    defaultMusicVolume: 0.5,
    defaultSFXVolume:   0.8,
    defaultMasterVolume: 1.0,

    /**
     * Playlists
     * Each track: { title, file }
     *   - title: display name shown in the widget
     *   - file:  path relative to baseURL (no leading slash)
     */
    playlists: {
        noir: {
            displayName: 'Noir',
            shuffle: 'shuffle',
            tracks: [
                { title: 'Shadow In E Minor',        file: 'idle/Shadow In E Minor.mp3' },
                { title: 'Shadow In E Minor 2',      file: 'idle/Shadow In E Minor 2.mp3' },
                { title: 'Encrypted Shadows',        file: 'idle/Encrypted Shadows.mp3' },
                { title: 'Shadow of the Bond Chord', file: 'idle/Shadow of the Bond Chord.mp3' },
                { title: 'Shadowline Protocol',      file: 'idle/Shadowline Protocol.mp3' },
                { title: 'Shadow Code 2',            file: 'idle/Shadow Code 2.mp3' },
                { title: 'Midnight Cipher Chase',    file: 'idle/Midnight Cipher Chase.mp3' },
                { title: 'Midnight Cipher Chase 2',  file: 'idle/Midnight Cipher Chase 2.mp3' },
            ]
        },

        threat: {
            displayName: 'Threat',
            shuffle: 'shuffle',
            tracks: [
                { title: 'Action Dub',                   file: 'threat/Action Dub.mp3' },
                { title: 'Midnight Trigger',             file: 'threat/Midnight Trigger.mp3' },
                { title: 'Emerald Trigger',              file: 'threat/Emerald Trigger.mp3' },
                { title: 'Midnight Double Agent',        file: 'threat/Midnight Double Agent.mp3' },
                { title: 'Cold Bond Circuit',            file: 'threat/Cold Bond Circuit.mp3' },
                { title: 'Shadow Protocol (Remastered)', file: 'threat/Shadow Protocol (Remastered).mp3' },
            ]
        },

        'spy-action': {
            displayName: 'Spy Action',
            shuffle: 'shuffle',
            tracks: [
                { title: 'Action Dub',                   file: 'threat/Action Dub.mp3' },
                { title: 'Emerald Trigger',              file: 'threat/Emerald Trigger.mp3' },
                { title: 'Midnight Double Agent',        file: 'threat/Midnight Double Agent.mp3' },
                { title: 'Shadowline Protocol',          file: 'idle/Shadowline Protocol.mp3' },
                { title: 'Shadow Code 2',                file: 'idle/Shadow Code 2.mp3' },
                { title: 'Cold Bond Circuit',            file: 'threat/Cold Bond Circuit.mp3' },
            ]
        },

        cutscene: {
            displayName: 'Cutscene',
            shuffle: 'sequential',
            tracks: [
                { title: 'Shadow Code',              file: 'intro/Shadow Code.mp3' },
                { title: 'Shadow Code (Remastered)', file: 'intro/Shadow Code (Remastered).mp3' },
            ]
        },

        end: {
            displayName: 'Ending',
            shuffle: 'sequential',
            tracks: [
                { title: 'Ending',                              file: 'end/Ending.mp3' },
                { title: 'Steel Shadows in E Minor (Remastered)', file: 'end/Steel Shadows in E Minor (Remastered).mp3' },
            ]
        },

        // 'victory' — plays when the player completes a mission.
        // Switching to this playlist auto-opens the fullscreen Bond Visualiser.
        // Swap these tracks for your dedicated mission-complete theme.
        victory: {
            displayName: 'Victory',
            shuffle: 'sequential',
            tracks: [
                { title: 'Steel Shadows in E Minor (Remastered)', file: 'end/Steel Shadows in E Minor (Remastered).mp3' },
                { title: 'Ending',                               file: 'end/Ending.mp3' },
            ]
        },
    }
};
