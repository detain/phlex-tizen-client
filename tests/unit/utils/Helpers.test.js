/**
 * Helpers Unit Tests
 */

import Helpers from '../../../app/js/utils/Helpers.js';

describe('Helpers', () => {
    describe('formatDuration', () => {
        it('should format hours correctly', () => {
            const ticks = 2 * 60 * 60 * 10000000; // 2 hours
            expect(Helpers.formatDuration(ticks)).toBe('2h 0m');
        });

        it('should format minutes correctly', () => {
            const ticks = 90 * 60 * 10000000; // 90 minutes
            expect(Helpers.formatDuration(ticks)).toBe('1h 30m');
        });

        it('should return empty string for null', () => {
            expect(Helpers.formatDuration(null)).toBe('');
        });

        it('should return empty string for undefined', () => {
            expect(Helpers.formatDuration(undefined)).toBe('');
        });
    });

    describe('formatTime', () => {
        it('should format seconds as MM:SS', () => {
            expect(Helpers.formatTime(65)).toBe('1:05');
        });

        it('should format seconds as HH:MM:SS for hours', () => {
            expect(Helpers.formatTime(3665)).toBe('1:01:05');
        });

        it('should handle zero', () => {
            expect(Helpers.formatTime(0)).toBe('0:00');
        });

        it('should handle NaN', () => {
            expect(Helpers.formatTime(NaN)).toBe('00:00');
        });
    });

    describe('escapeHtml', () => {
        it('should escape HTML entities', () => {
            expect(Helpers.escapeHtml('<script>')).toBe('&lt;script&gt;');
            expect(Helpers.escapeHtml('&amp;')).toBe('&amp;amp;');
        });

        it('should return empty string for null', () => {
            expect(Helpers.escapeHtml(null)).toBe('');
        });

        it('should return empty string for undefined', () => {
            expect(Helpers.escapeHtml(undefined)).toBe('');
        });
    });

    describe('generateId', () => {
        it('should generate random ID', () => {
            const id = Helpers.generateId();
            expect(id).toBeDefined();
            expect(id.length).toBeGreaterThan(0);
        });

        it('should include prefix if provided', () => {
            const id = Helpers.generateId('pre-');
            expect(id.startsWith('pre-')).toBe(true);
        });

        it('should generate unique IDs', () => {
            const id1 = Helpers.generateId();
            const id2 = Helpers.generateId();
            expect(id1).not.toBe(id2);
        });
    });

    describe('debounce', () => {
        it('should delay function execution', (done) => {
            let count = 0;
            const debouncedFn = Helpers.debounce(() => { count++; }, 100);

            debouncedFn();
            debouncedFn();
            debouncedFn();

            expect(count).toBe(0);

            setTimeout(() => {
                expect(count).toBe(1);
                done();
            }, 150);
        });
    });

    describe('throttle', () => {
        it('should limit function execution rate', (done) => {
            let count = 0;
            const throttledFn = Helpers.throttle(() => { count++; }, 100);

            throttledFn();
            throttledFn();
            throttledFn();

            expect(count).toBe(1);

            setTimeout(() => {
                expect(count).toBe(2);
                done();
            }, 150);
        });
    });
});
