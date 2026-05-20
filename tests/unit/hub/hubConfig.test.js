/**
 * HubConfig Unit Tests
 */

import HubConfig from '../../../app/js/hub/hubConfig.js';

describe('HubConfig', () => {
    beforeEach(() => {
        // Reset HubConfig state
        HubConfig.hubUrl = null;
        HubConfig.session = null;
        HubConfig.servers = [];
        HubConfig.activeServerId = null;
        HubConfig.connectionMode = 'direct';

        // Clear any stored values
        localStorage.removeItem('hub_url');
        localStorage.removeItem('hub_session');
        localStorage.removeItem('hub_active_server_id');
        localStorage.removeItem('hub_connection_mode');
    });

    describe('init', () => {
        it('should initialize with null values when no storage', () => {
            HubConfig.init();
            expect(HubConfig.hubUrl).toBeNull();
            expect(HubConfig.session).toBeNull();
            expect(HubConfig.activeServerId).toBeNull();
            expect(HubConfig.connectionMode).toBe('direct');
        });
    });

    describe('isEnabled', () => {
        it('should return false when no session', () => {
            expect(HubConfig.isEnabled()).toBe(false);
        });

        it('should return false when no hubUrl', () => {
            HubConfig.session = { accessToken: 'test' };
            expect(HubConfig.isEnabled()).toBe(false);
        });

        it('should return true when both hubUrl and session exist', () => {
            HubConfig.hubUrl = 'https://hub.example.com';
            HubConfig.session = { accessToken: 'test' };
            expect(HubConfig.isEnabled()).toBe(true);
        });
    });

    describe('getEffectiveUrl', () => {
        beforeEach(() => {
            // Setup default window global
            window.PHLIX_SERVER_URL = 'http://localhost:8096';
        });

        it('should return window.PHLIX_SERVER_URL when no active server', () => {
            HubConfig.servers = [];
            HubConfig.activeServerId = null;

            const url = HubConfig.getEffectiveUrl('/api/v1/test');
            expect(url).toBe('http://localhost:8096/api/v1/test');
        });

        it('should return direct server hostname in direct mode', () => {
            HubConfig.servers = [{
                serverId: 'server-1',
                serverName: 'Test Server',
                hostname: 'http://192.168.1.100:8096',
                relayHostname: 'relay.example.com'
            }];
            HubConfig.activeServerId = 'server-1';
            HubConfig.connectionMode = 'direct';

            const url = HubConfig.getEffectiveUrl('/api/v1/test');
            expect(url).toBe('http://192.168.1.100:8096/api/v1/test');
        });

        it('should return relay URL in relay mode', () => {
            HubConfig.hubUrl = 'https://hub.example.com';
            HubConfig.servers = [{
                serverId: 'server-1',
                serverName: 'Test Server',
                hostname: 'http://192.168.1.100:8096',
                relayHostname: 'relay.example.com'
            }];
            HubConfig.activeServerId = 'server-1';
            HubConfig.connectionMode = 'relay';

            const url = HubConfig.getEffectiveUrl('/api/v1/test');
            expect(url).toBe('https://hub.example.com/api/v1/relay/server-1/api/v1/test');
        });

        it('should fall back to window.PHLIX_SERVER_URL if server not found', () => {
            HubConfig.servers = [{ serverId: 'other-server' }];
            HubConfig.activeServerId = 'non-existent';

            const url = HubConfig.getEffectiveUrl('/api/v1/test');
            expect(url).toBe('http://localhost:8096/api/v1/test');
        });
    });

    describe('getAuthHeader', () => {
        it('should return null when no session', () => {
            HubConfig.session = null;
            expect(HubConfig.getAuthHeader()).toBeNull();
        });

        it('should return bearer token when session exists', () => {
            HubConfig.session = { accessToken: 'test-token-123' };
            expect(HubConfig.getAuthHeader()).toBe('Bearer test-token-123');
        });
    });

    describe('getServerIdHeader', () => {
        it('should return null when no active server', () => {
            HubConfig.activeServerId = null;
            expect(HubConfig.getServerIdHeader()).toBeNull();
        });

        it('should return server ID when active server exists', () => {
            HubConfig.activeServerId = 'server-abc';
            expect(HubConfig.getServerIdHeader()).toBe('server-abc');
        });
    });

    describe('setHubUrl', () => {
        it('should set hubUrl and persist to storage', () => {
            HubConfig.setHubUrl('https://hub.example.com');
            expect(HubConfig.hubUrl).toBe('https://hub.example.com');
            expect(localStorage.getItem('hub_url')).toBe('https://hub.example.com');
        });
    });

    describe('setSession', () => {
        it('should set session and persist to storage', () => {
            const session = { accessToken: 'token', refreshToken: 'refresh' };
            HubConfig.setSession(session);
            expect(HubConfig.session).toEqual(session);
            expect(localStorage.getItem('hub_session')).toEqual(JSON.stringify(session));
        });
    });

    describe('setActiveServerId', () => {
        it('should set activeServerId and persist to storage', () => {
            HubConfig.setActiveServerId('server-123');
            expect(HubConfig.activeServerId).toBe('server-123');
            expect(localStorage.getItem('hub_active_server_id')).toBe('server-123');
        });
    });

    describe('setConnectionMode', () => {
        it('should set connectionMode and persist to storage', () => {
            HubConfig.setConnectionMode('relay');
            expect(HubConfig.connectionMode).toBe('relay');
            expect(localStorage.getItem('hub_connection_mode')).toBe('relay');
        });
    });

    describe('setServers', () => {
        it('should set servers list', () => {
            const servers = [{ serverId: 's1' }, { serverId: 's2' }];
            HubConfig.setServers(servers);
            expect(HubConfig.servers).toEqual(servers);
        });

        it('should handle null/undefined servers', () => {
            HubConfig.setServers(null);
            expect(HubConfig.servers).toEqual([]);
        });
    });

    describe('clearSession', () => {
        it('should clear session and remove from storage', () => {
            HubConfig.session = { accessToken: 'token' };
            localStorage.setItem('hub_session', JSON.stringify(HubConfig.session));

            HubConfig.clearSession();
            expect(HubConfig.session).toBeNull();
            expect(localStorage.getItem('hub_session')).toBeNull();
        });
    });

    describe('clearAll', () => {
        it('should clear all hub state', () => {
            HubConfig.hubUrl = 'https://hub.example.com';
            HubConfig.session = { accessToken: 'token' };
            HubConfig.servers = [{ serverId: 's1' }];
            HubConfig.activeServerId = 's1';
            HubConfig.connectionMode = 'relay';

            HubConfig.clearAll();

            expect(HubConfig.hubUrl).toBeNull();
            expect(HubConfig.session).toBeNull();
            expect(HubConfig.servers).toEqual([]);
            expect(HubConfig.activeServerId).toBeNull();
            expect(HubConfig.connectionMode).toBe('direct');
        });
    });
});
