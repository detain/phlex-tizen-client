/**
 * Phlex API Client for Samsung Tizen TVs
 * Handles all communication with Phlex Media Server
 */

import Storage from '../utils/Storage.js';
import Logger from '../utils/Logger.js';

class ApiClient {
    constructor(baseUrl, deviceId, deviceName) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.deviceId = deviceId;
        this.deviceName = deviceName || 'Samsung Tizen TV';
        this.deviceType = 'samsung-tizen';
        this.token = null;
        this.sessionId = null;
        this.user = null;

        // Device profile for playback decisions
        this.deviceProfile = {
            Name: 'Samsung Tizen TV',
            MaxStreamingBitrate: 80000000, // 80 Mbps
            MaxStaticBitrate: 80000000,
            SupportedMediaTypes: ['Video', 'Audio'],
            DirectPlayProfiles: [{
                Container: 'mkv,mp4,webm',
                Type: 'Video',
                VideoCodec: 'h264,hevc,vp9',
                AudioCodec: 'aac,ac3,eac3,dts,flac'
            }],
            TranscodingProfiles: [{
                Container: 'ts',
                Type: 'Video',
                VideoCodec: 'h264',
                AudioCodec: 'aac,ac3'
            }]
        };

        // Request queue for rate limiting
        this.requestQueue = [];
        this.isProcessingQueue = false;
        this.maxConcurrentRequests = 3;
    }

    /**
     * Set authentication token
     */
    setToken(token) {
        this.token = token;
        if (token) {
            Storage.set('auth_token', token);
        } else {
            Storage.remove('auth_token');
        }
    }

    /**
     * Set session ID
     */
    setSession(sessionId) {
        this.sessionId = sessionId;
        Storage.set('session_id', sessionId);
    }

    /**
     * Restore session from storage
     */
    async restoreSession() {
        const token = Storage.get('auth_token');
        const sessionId = Storage.get('session_id');

        if (token) {
            this.token = token;

            // Validate token with server
            try {
                const result = await this.request('GET', '/Users/Me');
                this.user = result;

                if (sessionId) {
                    this.sessionId = sessionId;
                }

                return true;
            } catch (error) {
                // Token expired, clear it
                this.setToken(null);
                this.setSession(null);
                return false;
            }
        }
        return false;
    }

    /**
     * Make API request
     */
    async request(method, path, body = null, options = {}) {
        const url = `${this.baseUrl}/api/v1${path}`;
        const headers = {
            'Content-Type': 'application/json',
            'X-Phlex-Device-ID': this.deviceId,
            'X-Phlex-Device-Name': this.deviceName,
            'X-Phlex-Device-Type': this.deviceType
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        if (this.sessionId) {
            headers['X-Phlex-Session-ID'] = this.sessionId;
        }

        const config = {
            method,
            headers,
            mode: 'cors'
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
                throw new ApiError(response.status, error.message || 'Request failed', error);
            }

            // Handle empty responses
            const text = await response.text();
            return text ? JSON.parse(text) : null;
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new ApiError(408, 'Request timeout');
            }

            throw error;
        }
    }

    /**
     * Authentication methods
     */
    async login(username, password) {
        const deviceInfo = {
            device_id: this.deviceId,
            device_name: this.deviceName,
            device_type: this.deviceType
        };

        const result = await this.request('POST', '/Auth/Login', {
            username,
            password,
            ...deviceInfo
        });

        this.setToken(result.token);
        this.setSession(result.session_id);
        this.user = result.user;

        return result;
    }

    async register(email, username, password) {
        const result = await this.request('POST', '/Auth/Register', {
            email,
            username,
            password
        });

        return result;
    }

    logout() {
        try {
            if (this.sessionId) {
                this.request('DELETE', `/Sessions/${this.sessionId}`).catch(() => {});
            }
        } finally {
            this.setToken(null);
            this.setSession(null);
            this.user = null;
        }
    }

    /**
     * Session management
     */
    async createSession() {
        if (!this.user) {
            throw new Error('Not logged in');
        }

        const deviceInfo = {
            device_id: this.deviceId,
            device_name: this.deviceName,
            device_type: this.deviceType,
            capabilities: this.deviceProfile
        };

        const result = await this.request('POST', '/Sessions', deviceInfo);
        this.setSession(result.id);

        return result;
    }

    async getSessions() {
        return this.request('GET', '/Sessions');
    }

    /**
     * Library browsing
     */
    async getLibraries() {
        return this.request('GET', '/Library/VirtualFolders');
    }

    async getLibraryItems(libraryId, options = {}) {
        const params = new URLSearchParams({
            parentId: libraryId,
            includeItemTypes: options.type || 'Movie,Series',
            limit: options.limit || 50,
            startIndex: options.startIndex || 0,
            sortBy: options.sortBy || 'SortName',
            sortOrder: options.sortOrder || 'Ascending'
        });

        return this.request('GET', `/Items?${params}`);
    }

    async getItem(itemId) {
        return this.request('GET', `/Items/${itemId}`);
    }

    async getItemPlaybackInfo(itemId, options = {}) {
        const params = new URLSearchParams({
            deviceProfile: this.deviceType,
            maxStreamingBitrate: this.deviceProfile.MaxStreamingBitrate
        });

        return this.request('GET', `/Items/${itemId}/PlaybackInfo?${params}`);
    }

    /**
     * Search
     */
    async search(query, options = {}) {
        const params = new URLSearchParams({
            searchTerm: query,
            limit: options.limit || 20,
            includeItemTypes: options.types || 'Movie,Series,Music'
        });

        return this.request('GET', `/Search/Hints?${params}`);
    }

    /**
     * User data (watched, favorite, etc.)
     */
    async updateUserData(itemId, userData) {
        return this.request('POST', `/Items/${itemId}/UserData`, userData);
    }

    async markWatched(itemId) {
        return this.updateUserData(itemId, { is_watched: true });
    }

    async markUnwatched(itemId) {
        return this.updateUserData(itemId, { is_watched: false });
    }

    async toggleFavorite(itemId) {
        return this.request('POST', `/Items/${itemId}/UserData`, { is_favorite: true });
    }

    /**
     * Playback control
     */
    async playItem(itemId, options = {}) {
        const startPosition = options.startPosition || 0;

        const result = await this.request('POST', '/Sessions/Play', {
            item_id: itemId,
            start_position_ticks: startPosition,
            device_profile: this.deviceType,
            media_source_id: options.mediaSourceId
        });

        return result;
    }

    async stopPlayback() {
        return this.request('POST', '/Playstate', {
            session_id: this.sessionId,
            command: 'stop'
        });
    }

    async pausePlayback() {
        return this.request('POST', '/Playstate', {
            session_id: this.sessionId,
            command: 'pause'
        });
    }

    async resumePlayback() {
        return this.request('POST', '/Playstate', {
            session_id: this.sessionId,
            command: 'play'
        });
    }

    async seekPlayback(positionTicks) {
        return this.request('POST', '/Playstate', {
            session_id: this.sessionId,
            command: 'seek',
            data: { position_ticks: positionTicks }
        });
    }

    async reportPlaybackProgress(positionTicks, isPaused = false) {
        return this.request('POST', '/Playstate/Progress', {
            session_id: this.sessionId,
            position_ticks: positionTicks,
            is_paused: isPaused
        });
    }

    /**
     * Server info
     */
    async getServerInfo() {
        return this.request('GET', '/System/Info');
    }

    async getPublicServerInfo() {
        return this.request('GET', '/System/Info/Public');
    }
}

/**
 * Custom API Error class
 */
class ApiError extends Error {
    constructor(status, message, data = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

/**
 * Generate device ID
 */
function generateDeviceId() {
    const stored = Storage.get('device_id');
    if (stored) return stored;

    const id = 'tizen-' + Math.random().toString(36).substr(2, 9) +
               '-' + Math.random().toString(36).substr(2, 9);
    Storage.set('device_id', id);
    return id;
}

// Export singleton instance
const api = new ApiClient(
    window.PHLEX_SERVER_URL || 'http://localhost:8096',
    window.PHLEX_DEVICE_ID || generateDeviceId(),
    'Samsung Tizen TV'
);

export default api;
export { ApiClient, ApiError };
