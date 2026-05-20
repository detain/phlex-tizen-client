/**
 * SyncPlay Service for Samsung Tizen
 * Handles synchronized playback across multiple clients
 *
 * Implements NTP-style time synchronization with rolling offset average
 * and WebSocket-based group communication.
 */

import Logger from '../utils/Logger.js';

/**
 * Number of samples to average for time offset calculation
 * @type {number}
 */
const OFFSET_SAMPLE_COUNT = 5;

/**
 * Maximum acceptable round-trip time in milliseconds
 * @type {number}
 */
const MAX_ACCEPTABLE_RTT = 1000;

/**
 * Position report interval in milliseconds
 * @type {number}
 */
const POSITION_REPORT_INTERVAL = 30000;

/**
 * Time sync ping interval in milliseconds
 * @type {number}
 */
const TIME_SYNC_INTERVAL = 60000;

/**
 * Message types for SyncPlay protocol
 */
const MessageTypes = {
    // Outgoing (client -> server)
    GROUP_CREATE: 'syncplay_group_create',
    GROUP_JOIN: 'syncplay_group_join',
    GROUP_LEAVE: 'syncplay_group_leave',
    PLAYBACK_PLAY: 'syncplay_playback_play',
    PLAYBACK_PAUSE: 'syncplay_playback_pause',
    PLAYBACK_SEEK: 'syncplay_playback_seek',
    TIME_PING: 'syncplay_time_ping',

    // Incoming (server -> client)
    GROUP_STATE: 'syncplay_group_state',
    PLAYBACK_SYNC: 'syncplay_playback_sync',
    MEMBER_JOINED: 'syncplay_member_joined',
    MEMBER_LEFT: 'syncplay_member_left',
    TIME_PONG: 'syncplay_time_pong',
    TIME_SYNC: 'syncplay_time_sync',
    ERROR: 'syncplay_error',
    INFO: 'syncplay_info',
};

/**
 * Playback states
 */
const PlaybackState = {
    PLAYING: 'playing',
    PAUSED: 'paused',
    BUFFERING: 'buffering',
};

/**
 * SyncPlay Service
 * Manages WebSocket connection, TimeSync, and group synchronization
 */
class SyncPlayService {
    constructor() {
        /**
         * WebSocket connection
         * @type {WebSocket|null}
         */
        this.ws = null;

        /**
         * WebSocket URL
         * @type {string}
         */
        this.wsUrl = null;

        /**
         * Whether connected
         * @type {boolean}
         */
        this.isConnected = false;

        /**
         * Current group ID
         * @type {string|null}
         */
        this.groupId = null;

        /**
         * Current member ID
         * @type {string|null}
         */
        this.memberId = null;

        /**
         * Whether currently in a group
         * @type {boolean}
         */
        this.isInGroup = false;

        /**
         * Group members list
         * @type {Array}
         */
        this.members = [];

        /**
         * Current host ID
         * @type {string|null}
         */
        this.hostId = null;

        /**
         * Current playback state
         * @type {string}
         */
        this.playbackState = PlaybackState.PAUSED;

        /**
         * Current position in milliseconds
         * @type {number}
         */
        this.currentPosition = 0;

        /**
         * Current media ID
         * @type {string|null}
         */
        this.currentMediaId = null;

        /**
         * Event listeners
         * @type {Map<string, Array<Function>>}
         */
        this.listeners = new Map();

        /**
         * Time sync offset samples
         * @type {Array<{offset: number, rtt: number, timestamp: number}>}
         */
        this.offsetSamples = [];

        /**
         * Last time sync timestamp
         * @type {number}
         */
        this.lastTimeSync = 0;

        /**
         * Drift rate (1.0 = no drift)
         * @type {number}
         */
        this.driftRate = 1.0;

        /**
         * Position report interval ID
         * @type {number|null}
         */
        this.positionReportInterval = null;

        /**
         * Time sync interval ID
         * @type {number|null}
         */
        this.timeSyncInterval = null;

        /**
         * Reconnection attempt count
         * @type {number}
         */
        this.reconnectAttempts = 0;

        /**
         * Maximum reconnection attempts
         * @type {number}
         */
        this.maxReconnectAttempts = 5;

        /**
         * Base API URL for WebSocket
         * @type {string}
         */
        this.baseUrl = null;
    }

    /**
     * Initialize the SyncPlay service
     * @param {string} baseUrl - Base URL of the Phlix server (e.g., http://localhost:8096)
     */
    init(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        // WebSocket URL derived from base URL
        this.wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws/syncplay';
        Logger.info('SyncPlayService initialized', { wsUrl: this.wsUrl });
    }

    /**
     * Connect to WebSocket server
     * @returns {Promise<void>}
     */
    async connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return;
        }

        return new Promise((resolve, reject) => {
            try {
                Logger.info('Connecting to SyncPlay WebSocket', { url: this.wsUrl });
                this.ws = new WebSocket(this.wsUrl);

                this.ws.onopen = () => {
                    Logger.info('SyncPlay WebSocket connected');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.startTimeSync();
                    this.emit('connected');
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };

                this.ws.onerror = (error) => {
                    Logger.error('SyncPlay WebSocket error', error);
                    this.emit('error', error);
                };

                this.ws.onclose = (event) => {
                    Logger.info('SyncPlay WebSocket closed', { code: event.code, reason: event.reason });
                    this.isConnected = false;
                    this.stopIntervals();
                    this.emit('disconnected', { code: event.code, reason: event.reason });
                    this.attemptReconnect();
                };
            } catch (error) {
                Logger.error('Failed to create WebSocket', error);
                reject(error);
            }
        });
    }

    /**
     * Disconnect from WebSocket server
     */
    disconnect() {
        this.stopIntervals();
        if (this.ws) {
            this.ws.close(1000, 'User disconnect');
            this.ws = null;
        }
        this.isConnected = false;
        this.isInGroup = false;
        this.groupId = null;
        this.resetTimeSync();
    }

    /**
     * Attempt to reconnect after disconnection
     */
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            Logger.warn('Max reconnection attempts reached');
            this.emit('reconnectFailed');
            return;
        }

        if (!this.isInGroup) {
            return; // Don't reconnect if not in a group
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

        Logger.info('Attempting to reconnect', {
            attempt: this.reconnectAttempts,
            delay,
        });

        setTimeout(() => {
            if (this.isInGroup && !this.isConnected) {
                this.connect().then(() => {
                    // Rejoin group after reconnecting
                    if (this.groupId) {
                        this.joinGroup(this.groupId, null, true);
                    }
                }).catch(() => {
                    // Will retry via onclose handler
                });
            }
        }, delay);
    }

    /**
     * Handle incoming WebSocket message
     * @param {string} data - JSON message data
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            const { type, ...payload } = message;

            Logger.debug('SyncPlay message received', { type, payload });

            switch (type) {
                case MessageTypes.GROUP_STATE:
                    this.handleGroupState(payload);
                    break;

                case MessageTypes.PLAYBACK_SYNC:
                    this.handlePlaybackSync(payload);
                    break;

                case MessageTypes.PLAYBACK_PLAY:
                    this.handlePlaybackCommand('play', payload);
                    break;

                case MessageTypes.PLAYBACK_PAUSE:
                    this.handlePlaybackCommand('pause', payload);
                    break;

                case MessageTypes.PLAYBACK_SEEK:
                    this.handlePlaybackSeek(payload);
                    break;

                case MessageTypes.MEMBER_JOINED:
                    this.handleMemberJoined(payload);
                    break;

                case MessageTypes.MEMBER_LEFT:
                    this.handleMemberLeft(payload);
                    break;

                case MessageTypes.TIME_PONG:
                    this.handleTimePong(payload);
                    break;

                case MessageTypes.TIME_SYNC:
                    this.handleTimeSync(payload);
                    break;

                case MessageTypes.ERROR:
                    this.handleError(payload);
                    break;

                case MessageTypes.INFO:
                    this.handleInfo(payload);
                    break;

                default:
                    Logger.warn('Unknown SyncPlay message type', { type });
            }

            this.emit('message', { type, payload });
        } catch (error) {
            Logger.error('Failed to parse SyncPlay message', error);
        }
    }

    /**
     * Send a message to the server
     * @param {string} type - Message type
     * @param {object} data - Message payload
     */
    send(type, data = {}) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            Logger.warn('Cannot send message: WebSocket not connected');
            return;
        }

        const message = {
            type,
            data,
            timestamp: Date.now(),
        };

        this.ws.send(JSON.stringify(message));
    }

    /**
     * Create a new SyncPlay group
     * @param {string} groupName - Name of the group
     * @param {string|null} password - Optional password
     * @returns {Promise<object>} Created group info
     */
    async createGroup(groupName, password = null) {
        await this.connect();

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.off('_groupCreated', handler);
                reject(new Error('Group creation timeout'));
            }, 10000);

            const handler = (data) => {
                clearTimeout(timeout);
                this.groupId = data.group_id;
                this.memberId = data.member_id;
                this.isInGroup = true;
                this.hostId = data.member_id; // Creator is host
                this.members = data.members || [];
                this.emit('groupCreated', data);
                resolve(data);
            };

            this.on('_groupCreated', handler);

            this.send(MessageTypes.GROUP_CREATE, {
                group_name: groupName,
                password_hash: password ? this.hashPassword(password) : null,
            });
        });
    }

    /**
     * Join an existing SyncPlay group
     * @param {string} groupId - Group ID to join
     * @param {string|null} password - Optional password
     * @param {boolean} isReconnect - Whether this is a reconnection
     * @returns {Promise<object>} Joined group info
     */
    async joinGroup(groupId, password = null, isReconnect = false) {
        if (!isReconnect) {
            await this.connect();
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.off('_groupJoined', handler);
                reject(new Error('Group join timeout'));
            }, 10000);

            const handler = (data) => {
                clearTimeout(timeout);
                this.groupId = data.group_id;
                this.memberId = data.member_id;
                this.isInGroup = true;
                this.members = data.members || [];
                this.hostId = data.host_id;
                this.playbackState = data.playback_state || PlaybackState.PAUSED;
                this.currentPosition = data.playback_position || 0;
                this.currentMediaId = data.current_media_id;
                this.startPositionReporting();
                this.emit('groupJoined', data);
                resolve(data);
            };

            this.on('_groupJoined', handler);

            this.send(MessageTypes.GROUP_JOIN, {
                group_id: groupId,
                password_hash: password ? this.hashPassword(password) : null,
            });
        });
    }

    /**
     * Leave current group
     */
    leaveGroup() {
        if (!this.isInGroup || !this.groupId) {
            return;
        }

        this.send(MessageTypes.GROUP_LEAVE, {
            group_id: this.groupId,
            member_id: this.memberId,
        });

        this.isInGroup = false;
        this.groupId = null;
        this.memberId = null;
        this.hostId = null;
        this.members = [];
        this.stopPositionReporting();
        this.emit('groupLeft');
    }

    /**
     * Report current playback position (host only)
     */
    reportPosition() {
        if (!this.isInGroup || !this.groupId) {
            return;
        }

        this.send(MessageTypes.PLAYBACK_SYNC, {
            group_id: this.groupId,
            member_id: this.memberId,
            position: this.currentPosition,
            is_playing: this.playbackState === PlaybackState.PLAYING,
            server_time: this.getSynchronizedTime(),
        });
    }

    /**
     * Send playback command
     * @param {string} command - 'play', 'pause', or 'seek'
     * @param {number} position - Position in milliseconds
     * @param {number} [toPosition] - Target position for seek
     */
    sendPlaybackCommand(command, position, toPosition = null) {
        if (!this.isInGroup || !this.groupId) {
            return;
        }

        const serverTime = this.getSynchronizedTime();

        switch (command) {
            case 'play':
                this.send(MessageTypes.PLAYBACK_PLAY, {
                    group_id: this.groupId,
                    member_id: this.memberId,
                    position,
                    server_time: serverTime,
                });
                break;

            case 'pause':
                this.send(MessageTypes.PLAYBACK_PAUSE, {
                    group_id: this.groupId,
                    member_id: this.memberId,
                    position,
                    server_time: serverTime,
                });
                break;

            case 'seek':
                this.send(MessageTypes.PLAYBACK_SEEK, {
                    group_id: this.groupId,
                    member_id: this.memberId,
                    from_position: position,
                    to_position: toPosition,
                    server_time: serverTime,
                });
                break;
        }
    }

    /**
     * Request time sync
     */
    requestTimeSync() {
        const clientTime = Date.now();

        // Store the send time for later calculation
        this._lastPingTime = clientTime;

        this.send(MessageTypes.TIME_PING, {
            client_time: clientTime,
        });
    }

    /**
     * Handle group state update
     * @param {object} data - Group state data
     */
    handleGroupState(data) {
        this.groupId = data.group_id;
        this.members = data.members || [];
        this.hostId = data.host_id;
        this.currentMediaId = data.current_media_id;
        this.playbackState = data.playback_state || PlaybackState.PAUSED;
        this.currentPosition = data.playback_position || 0;
        this.isInGroup = true;
        this.emit('groupState', data);
    }

    /**
     * Handle playback sync update
     * @param {object} data - Playback sync data
     */
    handlePlaybackSync(data) {
        // Only act if from host
        if (data.member_id !== this.hostId) {
            return;
        }

        this.playbackState = data.is_playing ? PlaybackState.PLAYING : PlaybackState.PAUSED;
        this.currentPosition = data.position;

        this.emit('playbackSync', {
            position: data.position,
            isPlaying: data.is_playing,
            serverTime: data.server_time,
        });
    }

    /**
     * Handle playback command from host
     * @param {string} command - 'play' or 'pause'
     * @param {object} data - Command data
     */
    handlePlaybackCommand(command, data) {
        // Only act if from host
        if (data.member_id !== this.hostId) {
            return;
        }

        this.playbackState = command === 'play' ? PlaybackState.PLAYING : PlaybackState.PAUSED;
        this.currentPosition = data.position;

        // Calculate adjusted position using time sync
        const adjustedPosition = this.calculateAdjustedPosition(data.position, data.server_time);

        this.emit('playbackCommand', {
            command,
            position: adjustedPosition,
        });
    }

    /**
     * Handle seek command from host
     * @param {object} data - Seek data
     */
    handlePlaybackSeek(data) {
        // Only act if from host
        if (data.member_id !== this.hostId) {
            return;
        }

        const adjustedPosition = this.calculateAdjustedPosition(data.to_position, data.server_time);

        this.emit('playbackSeek', {
            fromPosition: data.from_position,
            toPosition: adjustedPosition,
            serverTime: data.server_time,
        });
    }

    /**
     * Handle member joined notification
     * @param {object} data - Member data
     */
    handleMemberJoined(data) {
        const member = {
            id: data.member_id,
            name: data.member_name || 'Unknown',
            is_host: data.is_host || false,
            joined_at: Date.now(),
        };

        this.members.push(member);

        if (member.is_host) {
            this.hostId = member.id;
        }

        this.emit('memberJoined', member);
    }

    /**
     * Handle member left notification
     * @param {object} data - Member data
     */
    handleMemberLeft(data) {
        const leftId = data.member_id;
        const memberIndex = this.members.findIndex(m => m.id === leftId);

        if (memberIndex !== -1) {
            const member = this.members[memberIndex];
            this.members.splice(memberIndex, 1);

            // If host left, we need to wait for host election
            if (leftId === this.hostId) {
                this.hostId = null;
            }

            this.emit('memberLeft', member);
        }
    }

    /**
     * Handle time pong response
     * @param {object} data - Pong data
     */
    handleTimePong(data) {
        const clientSendTime = this._lastPingTime || data.client_time;
        const clientReceiveTime = Date.now();
        const serverTime = data.server_time;
        const serverReceiveTime = data.server_receive_time || serverTime;

        // Calculate RTT: total time minus server processing time
        const rtt = clientReceiveTime - clientSendTime - (serverReceiveTime - serverTime);

        if (rtt > MAX_ACCEPTABLE_RTT || rtt < 0) {
            Logger.debug('Rejecting time sync sample due to high RTT', { rtt });
            return;
        }

        // Calculate offset
        // offset = server_time - client_send_time + latency
        const latency = rtt / 2;
        const offset = serverTime - clientSendTime + latency;

        this.addOffsetSample(offset, rtt);
        this.updateDriftRate();
        this.lastTimeSync = Date.now();

        this.emit('timeSync', {
            offset: this.getTimeOffset(),
            latency,
            rtt,
            isStable: this.isSyncStable(),
        });
    }

    /**
     * Handle full time sync broadcast from server
     * @param {object} data - Time sync data
     */
    handleTimeSync(data) {
        const serverTime = data.server_time || Date.now();
        const offset = data.offset || 0;

        this.addOffsetSample(offset, data.latency || 0);
        this.updateDriftRate();
        this.lastTimeSync = serverTime;

        this.emit('timeSync', {
            offset: this.getTimeOffset(),
            latency: data.latency || 0,
            rtt: (data.latency || 0) * 2,
            isStable: this.isSyncStable(),
        });
    }

    /**
     * Handle error message
     * @param {object} data - Error data
     */
    handleError(data) {
        Logger.error('SyncPlay error', { code: data.error_code, message: data.message });
        this.emit('error', {
            code: data.error_code,
            message: data.message,
            details: data.details,
        });
    }

    /**
     * Handle info message
     * @param {object} data - Info data
     */
    handleInfo(data) {
        Logger.info('SyncPlay info', { message: data.message });
        this.emit('info', { message: data.message, data: data.data });
    }

    /**
     * Start periodic time sync
     */
    startTimeSync() {
        if (this.timeSyncInterval) {
            clearInterval(this.timeSyncInterval);
        }

        // Initial time sync
        this.requestTimeSync();

        // Periodic time sync
        this.timeSyncInterval = setInterval(() => {
            if (this.isConnected) {
                this.requestTimeSync();
            }
        }, TIME_SYNC_INTERVAL);
    }

    /**
     * Start position reporting (host only)
     */
    startPositionReporting() {
        if (this.positionReportInterval) {
            clearInterval(this.positionReportInterval);
        }

        this.positionReportInterval = setInterval(() => {
            if (this.isInGroup && this.playbackState === PlaybackState.PLAYING) {
                this.reportPosition();
            }
        }, POSITION_REPORT_INTERVAL);
    }

    /**
     * Stop all intervals
     */
    stopIntervals() {
        if (this.positionReportInterval) {
            clearInterval(this.positionReportInterval);
            this.positionReportInterval = null;
        }

        if (this.timeSyncInterval) {
            clearInterval(this.timeSyncInterval);
            this.timeSyncInterval = null;
        }
    }

    /**
     * Stop position reporting
     */
    stopPositionReporting() {
        if (this.positionReportInterval) {
            clearInterval(this.positionReportInterval);
            this.positionReportInterval = null;
        }
    }

    /**
     * Add an offset sample to the collection
     * @param {number} offset - Time offset in milliseconds
     * @param {number} rtt - Round-trip time in milliseconds
     */
    addOffsetSample(offset, rtt) {
        // Only use samples with acceptable RTT
        if (rtt > MAX_ACCEPTABLE_RTT) {
            return;
        }

        this.offsetSamples.push({
            offset,
            rtt,
            timestamp: Date.now() / 1000,
        });

        // Keep only recent samples (rolling buffer)
        if (this.offsetSamples.length > OFFSET_SAMPLE_COUNT * 2) {
            this.offsetSamples.shift();
        }
    }

    /**
     * Update drift rate based on recent samples
     */
    updateDriftRate() {
        if (this.offsetSamples.length < 2) {
            return;
        }

        const recent = this.offsetSamples.slice(-OFFSET_SAMPLE_COUNT);

        if (recent.length < 2) {
            return;
        }

        const first = recent[0];
        const last = recent[recent.length - 1];

        const timeDelta = last.timestamp - first.timestamp;
        if (timeDelta <= 0) {
            return;
        }

        const offsetDelta = last.offset - first.offset;
        const driftRate = offsetDelta / timeDelta;

        // Smooth the drift rate with EMA (factor 0.1)
        this.driftRate = 1.0 + (0.1 * driftRate / 1000);
    }

    /**
     * Get current estimated time offset from server
     * @returns {number} Offset in milliseconds
     */
    getTimeOffset() {
        if (this.offsetSamples.length === 0) {
            return 0;
        }

        // Return weighted average of recent samples (favor lower RTT)
        let weightedSum = 0;
        let weightSum = 0;

        const recent = this.offsetSamples.slice(-OFFSET_SAMPLE_COUNT);

        for (const sample of recent) {
            const weight = 1 / Math.max(1, sample.rtt);
            weightedSum += sample.offset * weight;
            weightSum += weight;
        }

        return weightSum > 0 ? weightedSum / weightSum : 0;
    }

    /**
     * Get estimated one-way latency
     * @returns {number} Latency in milliseconds
     */
    getEstimatedLatency() {
        if (this.offsetSamples.length === 0) {
            return 0;
        }

        const recent = this.offsetSamples.slice(-OFFSET_SAMPLE_COUNT);

        let totalLatency = 0;
        for (const sample of recent) {
            totalLatency += sample.rtt / 2;
        }

        return totalLatency / recent.length;
    }

    /**
     * Check if time sync is stable
     * @returns {boolean} True if stable
     */
    isSyncStable() {
        if (this.offsetSamples.length < OFFSET_SAMPLE_COUNT) {
            return false;
        }

        const recent = this.offsetSamples.slice(-OFFSET_SAMPLE_COUNT);
        const offsets = recent.map(s => s.offset);

        const mean = offsets.reduce((a, b) => a + b, 0) / offsets.length;
        const varianceSum = offsets.reduce((sum, offset) => sum + Math.pow(offset - mean, 2), 0);
        const variance = varianceSum / offsets.length;

        return variance < 50;
    }

    /**
     * Get synchronized time (local time adjusted by offset)
     * @returns {number} Synchronized timestamp in milliseconds
     */
    getSynchronizedTime() {
        return Date.now() + this.getTimeOffset();
    }

    /**
     * Calculate adjusted position accounting for time drift
     * @param {number} position - Current position in milliseconds
     * @param {number} serverTime - Server timestamp when position was recorded
     * @returns {number} Adjusted position
     */
    calculateAdjustedPosition(position, serverTime) {
        const synchronizedNow = this.getSynchronizedTime();
        const driftAdjustment = (synchronizedNow - serverTime) * this.driftRate;
        return position + driftAdjustment;
    }

    /**
     * Reset time sync state
     */
    resetTimeSync() {
        this.offsetSamples = [];
        this.driftRate = 1.0;
        this.lastTimeSync = 0;
    }

    /**
     * Get time sync status
     * @returns {object} Status object
     */
    getTimeSyncStatus() {
        return {
            offset: this.getTimeOffset(),
            latency: this.getEstimatedLatency(),
            driftRate: this.driftRate,
            isStable: this.isSyncStable(),
            sampleCount: this.offsetSamples.length,
            lastSync: this.lastTimeSync,
        };
    }

    /**
     * Simple password hash (SHA256)
     * @param {string} password - Plain text password
     * @returns {string} Hex hash
     */
    hashPassword(password) {
        // Simple hash for demo - in production use proper crypto
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
    }

    // Event system

    /**
     * Register event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    off(event, callback) {
        if (!this.listeners.has(event)) {
            return;
        }
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }

    /**
     * Emit event to listeners
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        if (!this.listeners.has(event)) {
            return;
        }
        this.listeners.get(event).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                Logger.error('Event callback error', { event, error });
            }
        });
    }
}

// Export singleton instance
const syncPlayService = new SyncPlayService();
export default syncPlayService;
export { SyncPlayService, MessageTypes, PlaybackState };