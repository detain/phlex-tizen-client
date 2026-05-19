/**
 * HubAwareApi Unit Tests
 */

import HubAwareApi from '../../../app/js/hub/hubAwareApi.js';
import HubConfig from '../../../app/js/hub/hubConfig.js';
import api from '../../../app/js/api/ApiClient.js';

// Mock global fetch
global.fetch = jest.fn();

describe('HubAwareApi', () => {
    beforeEach(() => {
        // Reset HubConfig state
        HubConfig.hubUrl = null;
        HubConfig.session = null;
        HubConfig.servers = [];
        HubConfig.activeServerId = null;
        HubConfig.connectionMode = 'direct';

        // Reset mocks
        global.fetch.mockReset();

        // Mock api properties
        api.baseUrl = 'http://localhost:8096';
        api.deviceId = 'test-device';
        api.deviceName = 'Test TV';
        api.deviceType = 'samsung-tizen';
        api.token = null;
        api.sessionId = null;
    });

    describe('get', () => {
        it('should make GET request to api client base URL when hub disabled', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve(JSON.stringify({ data: 'test' })),
                json: () => Promise.resolve({ data: 'test' })
            });

            await HubAwareApi.get('/test');

            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:8096/api/v1/test',
                expect.objectContaining({ method: 'GET' })
            );
        });

        it('should route via HubConfig.getEffectiveUrl when hub mode enabled', async () => {
            HubConfig.hubUrl = 'https://hub.example.com';
            HubConfig.session = { accessToken: 'hub-token' };
            HubConfig.servers = [{
                serverId: 'server-1',
                hostname: 'http://192.168.1.100:8096'
            }];
            HubConfig.activeServerId = 'server-1';
            HubConfig.connectionMode = 'direct';

            global.fetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve(JSON.stringify({ data: 'test' })),
                json: () => Promise.resolve({ data: 'test' })
            });

            // Path includes /api/v1 prefix since getEffectiveUrl just concatenates
            await HubAwareApi.get('/api/v1/test');

            expect(global.fetch).toHaveBeenCalledWith(
                'http://192.168.1.100:8096/api/v1/test',
                expect.any(Object)
            );
        });

        it('should inject auth header via HubConfig when hub mode enabled', async () => {
            HubConfig.hubUrl = 'https://hub.example.com';
            HubConfig.session = { accessToken: 'hub-token-123' };
            HubConfig.servers = [];
            HubConfig.activeServerId = null;

            global.fetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve(JSON.stringify({ data: 'test' })),
                json: () => Promise.resolve({ data: 'test' })
            });

            await HubAwareApi.get('/test');

            const call = global.fetch.mock.calls[0];
            const headers = call[1].headers;
            expect(headers['Authorization']).toBe('Bearer hub-token-123');
        });
    });

    describe('post', () => {
        it('should make POST request with body', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve(JSON.stringify({ success: true })),
                json: () => Promise.resolve({ success: true })
            });

            await HubAwareApi.post('/test', { key: 'value' });

            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:8096/api/v1/test',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ key: 'value' })
                })
            );
        });
    });

    describe('isHubMode', () => {
        it('should return false when hub not enabled', () => {
            HubConfig.hubUrl = null;
            HubConfig.session = null;
            expect(HubAwareApi.isHubMode()).toBe(false);
        });

        it('should return true when hub is enabled', () => {
            HubConfig.hubUrl = 'https://hub.example.com';
            HubConfig.session = { accessToken: 'token' };
            expect(HubAwareApi.isHubMode()).toBe(true);
        });
    });

    describe('getConnectionMode', () => {
        it('should return current connection mode', () => {
            HubConfig.connectionMode = 'relay';
            expect(HubAwareApi.getConnectionMode()).toBe('relay');
        });
    });

    describe('getActiveServer', () => {
        it('should return null when no active server', () => {
            HubConfig.activeServerId = null;
            HubConfig.servers = [];
            expect(HubAwareApi.getActiveServer()).toBeNull();
        });

        it('should return server when active server exists', () => {
            const server = { serverId: 'server-1', serverName: 'Test' };
            HubConfig.activeServerId = 'server-1';
            HubConfig.servers = [server];
            expect(HubAwareApi.getActiveServer()).toEqual(server);
        });

        it('should return null when active server not in servers list', () => {
            HubConfig.activeServerId = 'non-existent';
            HubConfig.servers = [{ serverId: 'other' }];
            expect(HubAwareApi.getActiveServer()).toBeNull();
        });
    });

    describe('relay mode routing', () => {
        it('should route through hub relay when in relay mode', async () => {
            HubConfig.hubUrl = 'https://hub.example.com';
            HubConfig.session = { accessToken: 'hub-token' };
            HubConfig.servers = [{
                serverId: 'server-1',
                hostname: 'http://192.168.1.100:8096',
                relayHostname: 'relay.example.com'
            }];
            HubConfig.activeServerId = 'server-1';
            HubConfig.connectionMode = 'relay';

            global.fetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve(JSON.stringify({ data: 'test' })),
                json: () => Promise.resolve({ data: 'test' })
            });

            await HubAwareApi.get('/api/v1/test');

            expect(global.fetch).toHaveBeenCalledWith(
                'https://hub.example.com/api/v1/relay/server-1/api/v1/test',
                expect.any(Object)
            );
        });

        it('should inject X-Server-Id header for relay calls', async () => {
            HubConfig.hubUrl = 'https://hub.example.com';
            HubConfig.session = { accessToken: 'hub-token' };
            HubConfig.servers = [{
                serverId: 'server-1',
                hostname: 'http://192.168.1.100:8096'
            }];
            HubConfig.activeServerId = 'server-1';
            HubConfig.connectionMode = 'relay';

            global.fetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve(JSON.stringify({ data: 'test' })),
                json: () => Promise.resolve({ data: 'test' })
            });

            await HubAwareApi.get('/test');

            const call = global.fetch.mock.calls[0];
            const headers = call[1].headers;
            expect(headers['X-Server-Id']).toBe('server-1');
        });
    });
});
