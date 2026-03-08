/**
 * scenario-music-events.js
 *
 * Data-driven music event wiring for Break Escape.
 * Reads the `music.events` array from the loaded scenario JSON and registers
 * the appropriate listeners on window.eventDispatcher so that gameplay events
 * automatically switch the active music playlist via MusicController.
 *
 * Supported trigger formats:
 *   "game_loaded"                          — fires once when the game is ready
 *   "conversation_closed:<npcId>"          — NPC conversation window closes
 *   "npc_hostile_state_changed"            — any NPC's hostile flag changes
 *   "global_variable_changed:<varName>"    — a global game variable changes
 *   "all_hostiles_ko"                      — special: all currently hostile NPCs are KO'd
 *
 * Optional per-event fields:
 *   condition  — JS expression string evaluated against event data (e.g. "isHostile === true")
 *   fade       — boolean, defaults to true
 */

import MusicController from './music-controller.js';

const TAG = '[ScenarioMusic]';

/**
 * Safely evaluate a condition string against an event data object.
 * Returns true if no condition is specified.
 * Isolates eval so unknown properties don't throw.
 *
 * @param {string|undefined} condition - JS expression string
 * @param {object} data               - event data object
 * @returns {boolean}
 */
function evaluateCondition(condition, data) {
    if (!condition) return true;
    try {
        // Build a local scope from the event data keys so the expression can
        // reference them directly (e.g. "isHostile === true" or "value === true").
        const keys = Object.keys(data || {});
        const values = keys.map(k => data[k]);
        // eslint-disable-next-line no-new-func
        const fn = new Function(...keys, `return (${condition});`);
        return !!fn(...values);
    } catch (err) {
        console.warn(`${TAG} Failed to evaluate condition "${condition}":`, err);
        return false;
    }
}

/**
 * Check whether any still-alive hostile NPC exists.
 * Returns true if at least one NPC is hostile AND not KO'd.
 *
 * @returns {boolean}
 */
function anyHostilesAlive() {
    if (!window.npcManager || !window.npcHostileSystem) return false;

    const npcs = window.npcManager.getAllNPCs(); // Array of NPC objects
    for (const npc of npcs) {
        const npcId = npc.id;
        if (
            window.npcHostileSystem.isNPCHostile(npcId) &&
            !window.npcHostileSystem.isNPCKO(npcId)
        ) {
            return true;
        }
    }
    return false;
}

/**
 * Switch to a playlist via MusicController, guarded by a condition check.
 *
 * @param {object} entry - music event config entry
 * @param {object} data  - event payload
 */
function switchIfConditionMet(entry, data) {
    if (!evaluateCondition(entry.condition, data)) return;

    const fade = entry.fade !== false; // default true
    console.log(`${TAG} Trigger '${entry.trigger}' → playlist '${entry.playlist}' (fade=${fade})`);
    MusicController.switchPlaylist(entry.playlist, fade);
}

/**
 * Wire up all music event listeners declared in the scenario.
 * Safe to call multiple times — cleans up previous listeners first.
 *
 * @param {object} scenario - window.gameScenario
 */
let _cleanupFns = [];

export function initScenarioMusicEvents(scenario) {
    // Remove any previously registered listeners from a prior call
    _cleanupFns.forEach(fn => fn());
    _cleanupFns = [];

    const musicConfig = scenario?.music;
    if (!musicConfig?.events?.length) {
        console.log(`${TAG} No music events configured in scenario — skipping.`);
        return;
    }

    if (!window.eventDispatcher) {
        console.warn(`${TAG} window.eventDispatcher not available — music events will not fire.`);
        return;
    }

    console.log(`${TAG} Initialising ${musicConfig.events.length} music event(s) from scenario.`);

    for (const entry of musicConfig.events) {
        const { trigger } = entry;

        if (trigger === 'all_hostiles_ko') {
            // Special virtual trigger: listen to every npc_ko and check remaining hostiles
            const handler = (data) => {
                if (anyHostilesAlive()) return; // still fighting
                switchIfConditionMet(entry, data);
            };
            window.eventDispatcher.on('npc_ko', handler);
            _cleanupFns.push(() => window.eventDispatcher.off('npc_ko', handler));
            console.log(`${TAG} Registered 'all_hostiles_ko' (via npc_ko) → '${entry.playlist}'`);

        } else {
            const handler = (data) => switchIfConditionMet(entry, data);
            window.eventDispatcher.on(trigger, handler);
            _cleanupFns.push(() => window.eventDispatcher.off(trigger, handler));
            console.log(`${TAG} Registered '${trigger}' → '${entry.playlist}'`);
        }
    }
}
