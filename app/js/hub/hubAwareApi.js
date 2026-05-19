/**
 * Hub-Aware API Client
 * Wraps the base ApiClient to route via HubConfig when hub mode is enabled
 */

import api from '../api/ApiClient.js';
import HubConfig from './hubConfig.js';

/**
 * Make a hub-aware API request
 * Routes through hub relay if enabled
 */
async function hubAwareRequest(method, path, body = null, options = {}) {
    const isHubMode = HubConfig.isEnabled();
    const authHeader = HubConfig.getAuthHeader();
    const serverId = HubConfig.getServerIdHeader();

    // Build headers - start with base headers from api client
    const headers = {
        'Content-Type': 'application/json',
        'X-Phlex-Device-ID': api.deviceId,
        'X-Phlex-Device-Name': api.deviceName,
        'X-Phlex-Device-Type': api.deviceType,
    };

    // Add session-based auth if available
    if (api.token) {
        headers['Authorization'] = `Bearer ${api.token}`;
    }

    if (api.sessionId) {
        headers['X-Phlex-Session-ID'] = api.sessionId;
    }

    // In hub mode, use hub auth and server routing
    if (isHubMode) {
        // Override with hub auth if available
        if (authHeader) {
            headers['Authorization'] = authHeader;
        }

        // Add server ID header for relay routing
        if (serverId) {
            headers['X-Server-Id'] = serverId;
        }
    }

    // Determine URL based on hub mode
    const url = isHubMode
        ? HubConfig.getEffectiveUrl(path)
        : `${api.baseUrl}/api/v1${path}`;

    const config = {
        method,
        headers,
        mode: 'cors',
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        config.body = JSON.stringify(body);
    }

    // Add timeout
    const timeout = options.timeout || 30000;
    const controller = new AbortController();
    config.signal = controller.signal;

    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, config);
        clearTimeout(timeoutId);

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(response.status + ': ' + (error.message || 'Request failed'));
        }

        // Handle empty responses
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            throw new Error('408: Request timeout');
        }

        throw error;
    }
}

/**
 * HubAwareApi - wrapper with hub-aware routing
 */
const HubAwareApi = {
    /**
     * Make GET request
     */
    async get(path, options = {}) {
        return hubAwareRequest('GET', path, null, options);
    },

    /**
     * Make POST request
     */
    async post(path, body, options = {}) {
        return hubAwareRequest('POST', path, body, options);
    },

    /**
     * Make PUT request
     */
    async put(path, body, options = {}) {
        return hubAwareRequest('PUT', path, body, options);
    },

    /**
     * Make PATCH request
     */
    async patch(path, body, options = {}) {
        return hubAwareRequest('PATCH', path, body, options);
    },

    /**
     * Make DELETE request
     */
    async delete(path, options = {}) {
        return hubAwareRequest('DELETE', path, null, options);
    },

    /**
     * Check if hub mode is active
     */
    isHubMode() {
        return HubConfig.isEnabled();
    },

    /**
     * Get current connection mode
     */
    getConnectionMode() {
        return HubConfig.connectionMode;
    },

    /**
     * Get active server info
     */
    getActiveServer() {
        if (!HubConfig.activeServerId) {
            return null;
        }
        return HubConfig.servers.find(s => s.serverId === HubConfig.activeServerId) || null;
    }
};

export default HubAwareApi;
