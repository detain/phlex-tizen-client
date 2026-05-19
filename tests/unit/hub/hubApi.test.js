/**
 * HubApi Unit Tests
 */

import HubApi from '../../../app/js/hub/hubApi.js';
import HubConfig from '../../../app/js/hub/hubConfig.js';

// Mock global fetch
global.fetch = jest.fn();

describe('HubApi', () => {
    beforeEach(() => {
        // Reset HubConfig
        HubConfig.hubUrl = null;
        HubConfig.session = null;

        // Clear mocks
        global.fetch.mockReset();
    });

    describe('signIn', () => {
        it('should return session on successful sign in', async () => {
            const mockResponse = {
                access_token: 'test-access-token',
                refresh_token: 'test-refresh-token',
                expires_in: 3600,
                user_id: 'user-123'
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            });

            const result = await HubApi.signIn('https://hub.example.com', 'testuser', 'password');

            expect(result.accessToken).toBe('test-access-token');
            expect(result.refreshToken).toBe('test-refresh-token');
            expect(result.userId).toBe('user-123');
            expect(result.expiresAt).toBeGreaterThan(Date.now());
        });

        it('should throw error on failed sign in', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 401
            });

            await expect(
                HubApi.signIn('https://hub.example.com', 'baduser', 'badpass')
            ).rejects.toThrow('Hub auth failed: 401');
        });
    });

    describe('listServers', () => {
        it('should return servers array', async () => {
            HubConfig.hubUrl = 'https://hub.example.com';

            const mockServers = [
                { serverId: 'server-1', serverName: 'Server One', version: '1.0.0' },
                { serverId: 'server-2', serverName: 'Server Two', version: '1.1.0' }
            ];

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ servers: mockServers })
            });

            const result = await HubApi.listServers({ accessToken: 'test-token' });

            expect(result).toEqual(mockServers);
            expect(global.fetch).toHaveBeenCalledWith(
                'https://hub.example.com/api/v1/me/servers',
                expect.objectContaining({
                    headers: { 'Authorization': 'Bearer test-token' }
                })
            );
        });

        it('should throw error when hub URL not configured', async () => {
            HubConfig.hubUrl = null;

            await expect(
                HubApi.listServers({ accessToken: 'test-token' })
            ).rejects.toThrow('Hub URL not configured');
        });

        it('should return empty array when no servers returned', async () => {
            HubConfig.hubUrl = 'https://hub.example.com';

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({})
            });

            const result = await HubApi.listServers({ accessToken: 'test-token' });
            expect(result).toEqual([]);
        });
    });

    describe('refresh', () => {
        it('should return new session on successful refresh', async () => {
            HubConfig.hubUrl = 'https://hub.example.com';
            HubConfig.session = { userId: 'user-123' };

            const mockResponse = {
                access_token: 'new-access-token',
                refresh_token: 'new-refresh-token',
                expires_in: 7200
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            });

            const result = await HubApi.refresh('old-refresh-token');

            expect(result.accessToken).toBe('new-access-token');
            expect(result.refreshToken).toBe('new-refresh-token');
            expect(result.userId).toBe('user-123');
        });

        it('should throw error when hub URL not configured', async () => {
            HubConfig.hubUrl = null;

            await expect(
                HubApi.refresh('some-token')
            ).rejects.toThrow('Hub URL not configured');
        });

        it('should throw error on failed refresh', async () => {
            HubConfig.hubUrl = 'https://hub.example.com';

            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 401
            });

            await expect(
                HubApi.refresh('invalid-token')
            ).rejects.toThrow('Refresh failed: 401');
        });
    });

    describe('isTokenExpired', () => {
        it('should return true when no session', () => {
            HubConfig.session = null;
            expect(HubApi.isTokenExpired()).toBe(true);
        });

        it('should return true when token is expired', () => {
            HubConfig.session = {
                accessToken: 'test',
                expiresAt: Date.now() - 1000
            };
            expect(HubApi.isTokenExpired()).toBe(true);
        });

        it('should return false when token is not expired', () => {
            HubConfig.session = {
                accessToken: 'test',
                expiresAt: Date.now() + 100000
            };
            expect(HubApi.isTokenExpired()).toBe(false);
        });
    });

    describe('getHubInfo', () => {
        it('should return hub info', async () => {
            const mockInfo = { version: '1.0.0', name: 'Test Hub' };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockInfo)
            });

            const result = await HubApi.getHubInfo('https://hub.example.com');
            expect(result).toEqual(mockInfo);
        });

        it('should throw error on failed request', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 500
            });

            await expect(
                HubApi.getHubInfo('https://hub.example.com')
            ).rejects.toThrow('Hub info failed: 500');
        });
    });
});
