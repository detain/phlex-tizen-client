/**
 * KeyMapping Unit Tests
 */

import KeyMapping from '../../app/js/remote/KeyMapping.js';

describe('KeyMapping', () => {
    describe('mapKeyCode', () => {
        it('should map navigation keys correctly', () => {
            expect(KeyMapping.mapKeyCode(37)).toBe('LEFT');
            expect(KeyMapping.mapKeyCode(38)).toBe('UP');
            expect(KeyMapping.mapKeyCode(39)).toBe('RIGHT');
            expect(KeyMapping.mapKeyCode(40)).toBe('DOWN');
        });

        it('should map enter key', () => {
            expect(KeyMapping.mapKeyCode(13)).toBe('ENTER');
        });

        it('should map Samsung back button', () => {
            expect(KeyMapping.mapKeyCode(10009)).toBe('BACK');
        });

        it('should map home button', () => {
            expect(KeyMapping.mapKeyCode(36)).toBe('HOME');
        });

        it('should map playback control keys', () => {
            expect(KeyMapping.mapKeyCode(415)).toBe('PLAY');
            expect(KeyMapping.mapKeyCode(413)).toBe('STOP');
            expect(KeyMapping.mapKeyCode(19)).toBe('PAUSE');
            expect(KeyMapping.mapKeyCode(417)).toBe('FAST_FORWARD');
            expect(KeyMapping.mapKeyCode(412)).toBe('REWIND');
        });

        it('should map color buttons', () => {
            expect(KeyMapping.mapKeyCode(403)).toBe('RED');
            expect(KeyMapping.mapKeyCode(404)).toBe('GREEN');
            expect(KeyMapping.mapKeyCode(405)).toBe('YELLOW');
            expect(KeyMapping.mapKeyCode(406)).toBe('BLUE');
        });

        it('should map volume keys', () => {
            expect(KeyMapping.mapKeyCode(1028)).toBe('VOLUME_UP');
            expect(KeyMapping.mapKeyCode(1029)).toBe('VOLUME_DOWN');
            expect(KeyMapping.mapKeyCode(1025)).toBe('MUTE');
        });

        it('should map number keys', () => {
            expect(KeyMapping.mapKeyCode(48)).toBe('0');
            expect(KeyMapping.mapKeyCode(49)).toBe('1');
            expect(KeyMapping.mapKeyCode(57)).toBe('9');
        });

        it('should return UNKNOWN_ prefix for unmapped keys', () => {
            expect(KeyMapping.mapKeyCode(999)).toBe('UNKNOWN_999');
        });
    });

    describe('isRepeatable', () => {
        it('should return true for navigation keys', () => {
            expect(KeyMapping.isRepeatable('LEFT')).toBe(true);
            expect(KeyMapping.isRepeatable('UP')).toBe(true);
            expect(KeyMapping.isRepeatable('RIGHT')).toBe(true);
            expect(KeyMapping.isRepeatable('DOWN')).toBe(true);
        });

        it('should return true for seek keys', () => {
            expect(KeyMapping.isRepeatable('FAST_FORWARD')).toBe(true);
            expect(KeyMapping.isRepeatable('REWIND')).toBe(true);
        });

        it('should return true for volume keys', () => {
            expect(KeyMapping.isRepeatable('VOLUME_UP')).toBe(true);
            expect(KeyMapping.isRepeatable('VOLUME_DOWN')).toBe(true);
        });

        it('should return false for action keys', () => {
            expect(KeyMapping.isRepeatable('ENTER')).toBe(false);
            expect(KeyMapping.isRepeatable('BACK')).toBe(false);
            expect(KeyMapping.isRepeatable('PLAY')).toBe(false);
        });
    });

    describe('isImmediate', () => {
        it('should return true for immediate action keys', () => {
            expect(KeyMapping.isImmediate('ENTER')).toBe(true);
            expect(KeyMapping.isImmediate('BACK')).toBe(true);
            expect(KeyMapping.isImmediate('HOME')).toBe(true);
            expect(KeyMapping.isImmediate('PLAY')).toBe(true);
            expect(KeyMapping.isImmediate('STOP')).toBe(true);
            expect(KeyMapping.isImmediate('PAUSE')).toBe(true);
        });

        it('should return false for navigation keys', () => {
            expect(KeyMapping.isImmediate('LEFT')).toBe(false);
            expect(KeyMapping.isImmediate('UP')).toBe(false);
            expect(KeyMapping.isImmediate('RIGHT')).toBe(false);
            expect(KeyMapping.isImmediate('DOWN')).toBe(false);
        });
    });

    describe('isHandled', () => {
        it('should return true for mapped keys', () => {
            expect(KeyMapping.isHandled('LEFT')).toBe(true);
            expect(KeyMapping.isHandled('PLAY')).toBe(true);
        });

        it('should return false for unknown keys', () => {
            expect(KeyMapping.isHandled('UNKNOWN_999')).toBe(false);
        });
    });

    describe('getDisplayName', () => {
        it('should return display name for actions', () => {
            expect(KeyMapping.getDisplayName('LEFT')).toBe('Left Arrow');
            expect(KeyMapping.getDisplayName('ENTER')).toBe('OK');
            expect(KeyMapping.getDisplayName('PLAY')).toBe('Play');
        });

        it('should return action name for unknown actions', () => {
            expect(KeyMapping.getDisplayName('CUSTOM')).toBe('CUSTOM');
        });
    });
});
