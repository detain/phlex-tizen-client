/**
 * Integration Smoke Tests
 *
 * Verifies core modules can be imported and basic functionality works.
 * Note: Full App initialization requires a real DOM environment.
 */

import { ApiClient, ApiError } from '../../app/js/api/ApiClient.js';
import Router from '../../app/js/ui/Router.js';
import Helpers from '../../app/js/utils/Helpers.js';

describe('Module Imports', () => {
    it('should export ApiClient class', () => {
        expect(ApiClient).toBeDefined();
        expect(typeof ApiClient).toBe('function');
    });

    it('should export Router class', () => {
        expect(Router).toBeDefined();
        expect(typeof Router).toBe('function');
    });

    it('should export Helpers utility object', () => {
        expect(Helpers).toBeDefined();
        expect(typeof Helpers).toBe('object');
    });
});

describe('ApiClient Integration', () => {
    let apiClient;

    beforeEach(() => {
        apiClient = new ApiClient('http://localhost:8096', 'test-device', 'Test TV');
    });

    it('should create an instance ready for API calls', () => {
        expect(apiClient).toBeInstanceOf(ApiClient);
        expect(apiClient.baseUrl).toBe('http://localhost:8096');
    });

    it('should have device profile configured', () => {
        expect(apiClient.deviceProfile).toBeDefined();
        expect(apiClient.deviceProfile.Name).toBe('Samsung Tizen TV');
    });

    it('should support video playback in device profile', () => {
        const supportsVideo = apiClient.deviceProfile.SupportedMediaTypes.includes('Video');
        expect(supportsVideo).toBe(true);
    });

    it('should have direct play profiles', () => {
        expect(apiClient.deviceProfile.DirectPlayProfiles.length).toBeGreaterThan(0);
    });

    it('should export ApiError class', () => {
        expect(ApiError).toBeDefined();
        expect(typeof ApiError).toBe('function');
    });
});

describe('Helpers Utility', () => {
    describe('formatDuration', () => {
        it('should format ticks into hours and minutes', () => {
            // 36600000000 ticks = 1h 1m (1*36000000000 + 1*600000000)
            const result = Helpers.formatDuration(36600000000);
            expect(result).toBe('1h 1m');
        });

        it('should format ticks under an hour', () => {
            // 6000000000 ticks = 10m (10*600000000)
            const result = Helpers.formatDuration(6000000000);
            expect(result).toBe('10m');
        });

        it('should return empty string for zero ticks', () => {
            expect(Helpers.formatDuration(0)).toBe('');
            expect(Helpers.formatDuration(null)).toBe('');
        });
    });

    describe('formatTime', () => {
        it('should format seconds into HH:MM:SS', () => {
            const result = Helpers.formatTime(3661);
            expect(result).toBe('1:01:01');
        });

        it('should format seconds into MM:SS when under an hour', () => {
            const result = Helpers.formatTime(125);
            expect(result).toBe('2:05');
        });

        it('should return 00:00 for invalid input', () => {
            expect(Helpers.formatTime(null)).toBe('00:00');
            expect(Helpers.formatTime(NaN)).toBe('00:00');
        });
    });
});

describe('Router', () => {
    let router;

    beforeEach(() => {
        router = new Router();
    });

    it('should create router instance', () => {
        expect(router).toBeInstanceOf(Router);
    });

    it('should have routes map', () => {
        expect(router.routes).toBeDefined();
        expect(router.routes instanceof Map).toBe(true);
    });
});
