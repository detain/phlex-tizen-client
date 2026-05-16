/**
 * Player Manager
 * High-level playback control coordination
 */

import sessionManager from './SessionManager.js';
import videoPlayer from '../player/VideoPlayer.js';
import Logger from '../utils/Logger.js';

class PlayerManager {
    constructor() {
        this.currentItem = null;
        this.listeners = new Map();
    }

    /**
     * Initialize player manager
     */
    init() {
        // Setup player event forwarding
        videoPlayer.on('error', (error) => this.emit('error', error));
        videoPlayer.on('ended', () => this.emit('ended'));
        videoPlayer.on('qualityChanged', (quality) => this.emit('qualityChanged', quality));
    }

    /**
     * Play an item
     */
    async play(itemId, options = {}) {
        try {
            // Get playback info
            const state = await sessionManager.startPlayback(itemId, options);
            this.currentItem = itemId;

            // Load and start video
            await videoPlayer.load(state.playbackInfo);
            await videoPlayer.play();

            this.emit('playbackStarted', state);
            return state;
        } catch (error) {
            Logger.error('Play failed', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Pause playback
     */
    async pause() {
        try {
            await sessionManager.pausePlayback();
            videoPlayer.pause();
        } catch (error) {
            Logger.error('Pause failed', error);
            throw error;
        }
    }

    /**
     * Resume playback
     */
    async resume() {
        try {
            await sessionManager.resumePlayback();
            await videoPlayer.play();
        } catch (error) {
            Logger.error('Resume failed', error);
            throw error;
        }
    }

    /**
     * Stop playback
     */
    async stop() {
        try {
            await sessionManager.stopPlayback();
            videoPlayer.stop();
            this.currentItem = null;
        } catch (error) {
            Logger.error('Stop failed', error);
            throw error;
        }
    }

    /**
     * Seek to position (in seconds)
     */
    async seek(positionSeconds) {
        try {
            const positionTicks = Math.floor(positionSeconds * 10000000);
            await sessionManager.seekTo(positionTicks);
            await videoPlayer.seek(positionSeconds);
        } catch (error) {
            Logger.error('Seek failed', error);
            throw error;
        }
    }

    /**
     * Seek forward/backward
     */
    async seekRelative(seconds) {
        const current = videoPlayer.getCurrentTime();
        const duration = videoPlayer.getDuration();
        const newPosition = Math.max(0, Math.min(current + seconds, duration));
        await this.seek(newPosition);
    }

    /**
     * Set volume (0-1)
     */
    setVolume(volume) {
        videoPlayer.setVolume(volume);
    }

    /**
     * Set playback rate
     */
    setPlaybackRate(rate) {
        videoPlayer.setPlaybackRate(rate);
    }

    /**
     * Set subtitle track
     */
    setSubtitleTrack(trackIndex) {
        videoPlayer.setSubtitleTrack(trackIndex);
    }

    /**
     * Set quality level
     */
    setQuality(qualityIndex) {
        videoPlayer.setQuality(qualityIndex);
    }

    /**
     * Get current position
     */
    getCurrentTime() {
        return videoPlayer.getCurrentTime();
    }

    /**
     * Get duration
     */
    getDuration() {
        return videoPlayer.getDuration();
    }

    /**
     * Get buffered percentage
     */
    getBufferedPercentage() {
        return videoPlayer.getBufferedPercentage();
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
}

export default new PlayerManager();
export { PlayerManager };
