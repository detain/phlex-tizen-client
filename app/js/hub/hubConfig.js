/**
 * Hub Mode Configuration and State
 * Manages hub connection state, server list, and routing decisions
 */

import Storage from '../utils/Storage.js';

const HubConfig = {
    hubUrl: null,
    session: null,
    servers: [],
    activeServerId: null,
    connectionMode: 'direct', // 'direct' | 'relay'

    /**
     * Initialize from persisted storage
     */
    init() {
        const savedHubUrl = Storage.get('hub_url');
        const savedSession = Storage.get('hub_session');
        const savedActiveServerId = Storage.get('hub_active_server_id');
        const savedConnectionMode = Storage.get('hub_connection_mode');

        if (savedHubUrl) {
            this.hubUrl = savedHubUrl;
        }
        if (savedSession) {
            this.session = savedSession;
        }
        if (savedActiveServerId) {
            this.activeServerId = savedActiveServerId;
        }
        if (savedConnectionMode) {
            this.connectionMode = savedConnectionMode;
        }
    },

    /**
     * Check if hub mode is enabled
     */
    isEnabled() {
        return this.hubUrl !== null && this.session !== null;
    },

    /**
     * Get effective server URL for a given path
     */
    getEffectiveUrl(path) {
        if (!this.activeServerId || !this.servers.length) {
            return (window.PHLIX_SERVER_URL || 'http://localhost:8096') + path;
        }

        const server = this.servers.find(s => s.serverId === this.activeServerId);
        if (this.connectionMode === 'relay' && server?.relayHostname) {
            return `${this.hubUrl}/api/v1/relay/${server.serverId}${path}`;
        }
        return (server?.hostname || window.PHLIX_SERVER_URL || 'http://localhost:8096') + path;
    },

    /**
     * Get auth header for current mode
     */
    getAuthHeader() {
        if (!this.session) {
            return null;
        }
        return `Bearer ${this.session.accessToken}`;
    },

    /**
     * Get server ID header for relay calls
     */
    getServerIdHeader() {
        if (!this.activeServerId) {
            return null;
        }
        return this.activeServerId;
    },

    /**
     * Set hub URL and persist
     */
    setHubUrl(url) {
        this.hubUrl = url;
        Storage.set('hub_url', url);
    },

    /**
     * Set session and persist
     */
    setSession(session) {
        this.session = session;
        Storage.set('hub_session', session);
    },

    /**
     * Set active server and persist
     */
    setActiveServerId(serverId) {
        this.activeServerId = serverId;
        Storage.set('hub_active_server_id', serverId);
    },

    /**
     * Set connection mode and persist
     */
    setConnectionMode(mode) {
        this.connectionMode = mode;
        Storage.set('hub_connection_mode', mode);
    },

    /**
     * Set servers list
     */
    setServers(servers) {
        this.servers = servers || [];
    },

    /**
     * Clear session (sign out)
     */
    clearSession() {
        this.session = null;
        Storage.remove('hub_session');
    },

    /**
     * Clear all hub state
     */
    clearAll() {
        this.hubUrl = null;
        this.session = null;
        this.servers = [];
        this.activeServerId = null;
        this.connectionMode = 'direct';
        Storage.remove('hub_url');
        Storage.remove('hub_session');
        Storage.remove('hub_active_server_id');
        Storage.remove('hub_connection_mode');
    }
};

// Initialize from storage on load
HubConfig.init();

export default HubConfig;
