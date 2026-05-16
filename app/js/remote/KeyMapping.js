/**
 * Samsung Tizen Remote Key Mapping
 * Maps Tizen key codes to unified action names
 */

const KeyMapping = {
    // Key code to action name mapping
    KEY_MAP: {
        // Navigation
        37: 'LEFT',
        38: 'UP',
        39: 'RIGHT',
        40: 'DOWN',
        13: 'ENTER',
        10009: 'BACK',        // Samsung back button
        36: 'HOME',           // Home button

        // Playback control
        415: 'PLAY',
        413: 'STOP',
        19: 'PAUSE',
        417: 'FAST_FORWARD',
        412: 'REWIND',
        424: 'PREVIOUS',
        425: 'NEXT',

        // Color buttons
        403: 'RED',
        404: 'GREEN',
        405: 'YELLOW',
        406: 'BLUE',

        // Volume
        1028: 'VOLUME_UP',
        1029: 'VOLUME_DOWN',
        1025: 'MUTE',

        // Menu
        10282: 'MENU',
        18: 'INFO',
        113: 'TOOLS',

        // Misc
        48: '0',
        49: '1',
        50: '2',
        51: '3',
        52: '4',
        53: '5',
        54: '6',
        55: '7',
        56: '8',
        57: '9',

        // Tizen specific
        66: 'PLAY_PAUSE',
        79: 'OPTIONS',
    },

    /**
     * Map Tizen key code to action name
     */
    mapKeyCode(keyCode) {
        return this.KEY_MAP[keyCode] || `UNKNOWN_${keyCode}`;
    },

    /**
     * Check if key is a navigation key (for repeat)
     */
    isRepeatable(action) {
        const repeatableActions = [
            'LEFT', 'UP', 'RIGHT', 'DOWN',
            'FAST_FORWARD', 'REWIND',
            'NEXT', 'PREVIOUS',
            'VOLUME_UP', 'VOLUME_DOWN'
        ];
        return repeatableActions.includes(action);
    },

    /**
     * Check if key should trigger immediate action
     */
    isImmediate(action) {
        const immediateActions = [
            'ENTER', 'BACK', 'HOME',
            'PLAY', 'STOP', 'PAUSE',
            'RED', 'GREEN', 'YELLOW', 'BLUE',
            'MUTE', 'MENU', 'INFO', 'TOOLS'
        ];
        return immediateActions.includes(action);
    },

    /**
     * Check if key should prevent default
     */
    isHandled(action) {
        // All mapped keys should prevent default
        return action.startsWith('UNKNOWN_') === false;
    },

    /**
     * Get display name for action
     */
    getDisplayName(action) {
        const displayNames = {
            'LEFT': 'Left Arrow',
            'RIGHT': 'Right Arrow',
            'UP': 'Up Arrow',
            'DOWN': 'Down Arrow',
            'ENTER': 'OK',
            'BACK': 'Back',
            'HOME': 'Home',
            'PLAY': 'Play',
            'STOP': 'Stop',
            'PAUSE': 'Pause',
            'FAST_FORWARD': 'Fast Forward',
            'REWIND': 'Rewind',
            'NEXT': 'Next',
            'PREVIOUS': 'Previous',
            'RED': 'Red',
            'GREEN': 'Green',
            'YELLOW': 'Yellow',
            'BLUE': 'Blue',
            'VOLUME_UP': 'Volume Up',
            'VOLUME_DOWN': 'Volume Down',
            'MUTE': 'Mute',
            'MENU': 'Menu',
            'INFO': 'Info',
            'TOOLS': 'Tools',
            'PLAY_PAUSE': 'Play/Pause'
        };
        return displayNames[action] || action;
    }
};

export default KeyMapping;
