/**
 * ApiClient Unit Tests
 */

import { ApiClient, ApiError } from '../../app/js/api/ApiClient.js';

describe('ApiClient', () => {
    let apiClient;

    beforeEach(() => {
        apiClient = new ApiClient('http://localhost:8096', 'test-device', 'Test TV');
    });

    describe('Constructor', () => {
        it('should create instance with correct base URL', () => {
            expect(apiClient.baseUrl).toBe('http://localhost:8096');
        });

        it('should set device ID and name', () => {
            expect(apiClient.deviceId).toBe('test-device');
            expect(apiClient.deviceName).toBe('Test TV');
        });

        it('should set device type to samsung-tizen', () => {
            expect(apiClient.deviceType).toBe('samsung-tizen');
        });

        it('should initialize without token', () => {
            expect(apiClient.token).toBeNull();
        });

        it('should have device profile for playback', () => {
            expect(apiClient.deviceProfile).toBeDefined();
            expect(apiClient.deviceProfile.MaxStreamingBitrate).toBe(80000000);
        });
    });

    describe('Authentication', () => {
        it('should store token when setToken is called', () => {
            apiClient.setToken('test-token');
            expect(apiClient.token).toBe('test-token');
        });

        it('should clear token when setToken is called with null', () => {
            apiClient.setToken('test-token');
            apiClient.setToken(null);
            expect(apiClient.token).toBeNull();
        });

        it('should store session ID when setSession is called', () => {
            apiClient.setSession('session-123');
            expect(apiClient.sessionId).toBe('session-123');
        });
    });

    describe('Device Profile', () => {
        it('should have correct profile for Samsung Tizen', () => {
            expect(apiClient.deviceProfile.Name).toBe('Samsung Tizen TV');
            expect(apiClient.deviceProfile.MaxStreamingBitrate).toBe(80000000);
        });

        it('should support video playback', () => {
            const supportsVideo = apiClient.deviceProfile.SupportedMediaTypes.includes('Video');
            expect(supportsVideo).toBe(true);
        });

        it('should have direct play profiles', () => {
            expect(apiClient.deviceProfile.DirectPlayProfiles.length).toBeGreaterThan(0);
        });

        it('should have transcoding profiles', () => {
            expect(apiClient.deviceProfile.TranscodingProfiles.length).toBeGreaterThan(0);
        });
    });
});

describe('ApiError', () => {
    it('should create error with status and message', () => {
        const error = new ApiError(404, 'Not found');
        expect(error.status).toBe(404);
        expect(error.message).toBe('Not found');
        expect(error.name).toBe('ApiError');
    });

    it('should include data if provided', () => {
        const data = { details: 'some details' };
        const error = new ApiError(400, 'Bad request', data);
        expect(error.data).toEqual(data);
    });
});
