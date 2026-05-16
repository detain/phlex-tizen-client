/**
 * Session Manager
 * Handles playback sessions and progress reporting
 */

import api from './ApiClient.js';
import Storage from '../utils/Storage.js';
import Logger from '../utils/Logger.js';

class SessionManager {
    constructor() {
        this.currentSession = null;
        this.playbackState = null;
        this.listeners = new Map();
        this.heartbeatInterval = null;
        this.progressReportingInterval = null;
        this.lastReportedPosition = 0;
    }

    /**
     * Initialize session
     */
    async init() {
        // Try to restore existing session
        const restored = await api.restoreSession();

        if (restored) {
            Logger.info('Session restored from storage');
            this.startHeartbeat();
            return this.currentSession;
        }

        return null;
    }

    /**
     * Create new session
     */
    async createSession() {
        try {
            this.currentSession = await api.createSession();
            this.startHeartbeat();
            this.emit('sessionCreated', this.currentSession);
            return this.currentSession;
        } catch (error) {
            Logger.error('Failed to create session', error);
            throw error;
        }
    }

    /**
     * Start playback session
     */
    async startPlayback(itemId, options = {}) {
        const playbackInfo = await api.playItem(itemId, {
            startPosition: options.startPosition || 0,
            mediaSourceId: options.mediaSourceId
        });

        this.playbackState = {
            itemId,
            playbackInfo,
            isPlaying: true,
            position: options.startPosition || 0,
            duration: playbackInfo.media_item?.run_time_ticks || 0,
            streamUrl: playbackInfo.playback_info?.url,
            method: playbackInfo.playback_info?.method,
            startTime: Date.now()
        };

        this.startProgressReporting();
        this.emit('playbackStarted', this.playbackState);

        return this.playbackState;
    }

    /**
     * Stop playback
     */
    async stopPlayback() {
        if (!this.playbackState) return;

        // Report final progress
        await this.reportProgress(true);

        try {
            await api.stopPlayback();
        } catch (error) {
            Logger.error('Failed to stop playback', error);
        }

        this.playbackState = null;
        this.stopProgressReporting();
        this.emit('playbackStopped');
    }

    /**
     * Pause playback
     */
    async pausePlayback() {
        if (!this.playbackState || !this.playbackState.isPlaying) return;

        try {
            await api.pausePlayback();
            this.playbackState.isPlaying = false;
            this.emit('playbackPaused', this.playbackState);
        } catch (error) {
            Logger.error('Failed to pause playback', error);
            throw error;
        }
    }

    /**
     * Resume playback
     */
    async resumePlayback() {
        if (!this.playbackState || this.playbackState.isPlaying) return;

        try {
            await api.resumePlayback();
            this.playbackState.isPlaying = true;
            this.emit('playbackResumed', this.playbackState);
        } catch (error) {
            Logger.error('Failed to resume playback', error);
            throw error;
        }
    }

    /**
     * Seek to position
     */
    async seekTo(positionTicks) {
        if (!this.playbackState) return;

        try {
            await api.seekPlayback(positionTicks);
            this.playbackState.position = positionTicks;
            this.lastReportedPosition = positionTicks;
            this.emit('playbackSeeked', { position: positionTicks });
        } catch (error) {
            Logger.error('Failed to seek', error);
            throw error;
        }
    }

    /**
     * Report playback progress
     */
    async reportProgress(force = false) {
        if (!this.playbackState) return;

        const currentPosition = this.calculateCurrentPosition();

        // Only report if position changed significantly (1 second)
        if (!force && Math.abs(currentPosition - this.lastReportedPosition) < 10000000) {
            return;
        }

        this.lastReportedPosition = currentPosition;

        try {
            await api.reportPlaybackProgress(
                currentPosition,
                !this.playbackState.isPlaying
            );
        } catch (error) {
            Logger.debug('Progress report failed', error);
        }
    }

    /**
     * Calculate current position based on elapsed time
     */
    calculateCurrentPosition() {
        if (!this.playbackState) return 0;

        if (this.playbackState.isPlaying) {
            const elapsed = Date.now() - this.playbackState.startTime;
            const elapsedTicks = elapsed * 10000; // Convert ms to ticks
            return Math.min(
                this.playbackState.position + elapsedTicks,
                this.playbackState.duration
            );
        }

        return this.playbackState.position;
    }

    /**
     * Start heartbeat to keep session alive
     */
    startHeartbeat() {
        if (this.heartbeatInterval) return;

        // Heartbeat every 30 seconds
        this.heartbeatInterval = setInterval(async () => {
            try {
                await api.request('GET', `/Sessions/${api.sessionId}/Heartbeat`);
            } catch (error) {
                Logger.debug('Heartbeat failed', error);
            }
        }, 30000);
    }

    /**
     * Stop heartbeat
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Start progress reporting
     */
    startProgressReporting() {
        if (this.progressReportingInterval) return;

        // Report progress every 10 seconds
        this.progressReportingInterval = setInterval(() => {
            this.reportProgress();
        }, 10000);
    }

    /**
     * Stop progress reporting
     */
    stopProgressReporting() {
        if (this.progressReportingInterval) {
            clearInterval(this.progressReportingInterval);
            this.progressReportingInterval = null;
        }
    }

    /**
     * Event handling
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (!this.listeners.has(event)) return;
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }

    emit(event, data) {
        if (!this.listeners.has(event)) return;
        this.listeners.get(event).forEach(callback => callback(data));
    }

    /**
     * Clean up
     */
    destroy() {
        this.stopHeartbeat();
        this.stopProgressReporting();
        this.playbackState = null;
        this.currentSession = null;
        this.listeners.clear();
    }
}

export default new SessionManager();
export { SessionManager };
