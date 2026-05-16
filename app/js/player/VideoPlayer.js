/**
 * Video Player for Samsung Tizen
 * Handles video playback with HLS support
 */

import Logger from '../utils/Logger.js';
import sessionManager from '../api/SessionManager.js';

class VideoPlayer {
    constructor() {
        this.video = null;
        this.hlsPlayer = null;
        this.currentSource = null;
        this.currentQuality = null;
        this.isReady = false;
        this.listeners = new Map();

        // Quality levels available
        this.qualityLevels = [];
        this.currentQualityIndex = -1;

        // Buffer settings for Tizen
        this.bufferSettings = {
            maxBufferLength: 30,
            maxVideoBufferLength: 60,
            maxAudioBufferLength: 30,
        };
    }

    /**
     * Initialize player with video element
     */
    init(videoElement) {
        this.video = videoElement;
        this.setupEventListeners();
        this.configureForTizen();

        Logger.info('VideoPlayer initialized');
    }

    /**
     * Configure player specifically for Tizen
     */
    configureForTizen() {
        if (!this.video) {
            return;
        }

        // Enable buffering
        this.video.setAttribute('buffered-smooth', 'true');
        this.video.setAttribute('buffered-monitor-interval', '500');

        // Performance settings
        this.video.preload = 'auto';

        // Apply buffer settings
        try {
            if (typeof this.video.setBufferSettings === 'function') {
                this.video.setBufferSettings(this.bufferSettings);
            }
        } catch (error) {
            Logger.debug('Buffer settings not supported', error);
        }

        // Disable default controls (we use custom ones)
        this.video.controls = false;

        // Enable smooth seeking
        this.video.setAttribute('seeking-smooth', 'true');
    }

    /**
     * Setup native video element events
     */
    setupEventListeners() {
        if (!this.video) {
            return;
        }

        // Playback events
        this.video.addEventListener('play', () => this.onPlay());
        this.video.addEventListener('pause', () => this.onPause());
        this.video.addEventListener('ended', () => this.onEnded());
        this.video.addEventListener('error', (e) => this.onError(e));

        // Buffer events
        this.video.addEventListener('waiting', () => this.onWaiting());
        this.video.addEventListener('canplay', () => this.onCanPlay());
        this.video.addEventListener('loadedmetadata', () => this.onLoadedMetadata());

        // Progress events
        this.video.addEventListener('timeupdate', () => this.onTimeUpdate());
        this.video.addEventListener('progress', () => this.onProgress());

        // Quality change (for HLS)
        this.video.addEventListener('qualitychange', () => this.onQualityChange());
    }

    /**
     * Load video source
     */
    async load(playbackInfo) {
        if (!this.video) {
            throw new Error('Video element not initialized');
        }

        Logger.info('Loading video', {
            method: playbackInfo.method,
            url: playbackInfo.url?.substring(0, 50) + '...',
        });

        this.currentSource = playbackInfo;

        if (playbackInfo.method === 'transcode' && playbackInfo.protocol === 'HLS') {
            // Use HLS player for transcoded content
            await this.loadHLS(playbackInfo.url, playbackInfo);
        } else {
            // Direct play
            await this.loadDirect(playbackInfo.url, playbackInfo);
        }

        this.isReady = true;
        this.emit('ready', playbackInfo);
    }

    /**
     * Load HLS stream
     */
    async loadHLS(playlistUrl, playbackInfo) {
        // Dynamically import Hls.js
        const Hls = (await import('./HlsPlayer.js')).default;

        if (this.hlsPlayer) {
            this.hlsPlayer.destroy();
        }

        this.hlsPlayer = new Hls({
            // Tizen-specific configuration
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 60,
            maxBufferLength: 30,
            maxMaxBufferLength: 120,
            maxBufferSize: 60 * 1000 * 1000, // 60MB
            maxBufferHole: 0.5,
            enableSoftwareAES: true,

            // Fragment loading
            fragLoadingMaxRetry: 3,
            fragLoadingRetryDelay: 1000,
            fragLoadingTimeOut: 20000,

            // Level selection
            autoStartLoad: true,
            startLevel: -1, // Auto
            capLevelToPlayerSize: true,

            // Error handling
            recoverAttempts: 5,
            onErrorRecover: true,
        });

        // Load HLS playlist
        this.hlsPlayer.loadSource(playlistUrl);
        this.hlsPlayer.attachMedia(this.video);

        // Wait for HLS to be ready
        await new Promise((resolve, reject) => {
            this.hlsPlayer.once(Hls.Events.MANIFEST_PARSED, (event, data) => {
                this.qualityLevels = data.levels.map((level, index) => ({
                    index,
                    height: level.height,
                    width: level.width,
                    bitrate: level.bitrate,
                    name: `${level.height}p`,
                }));

                Logger.info('HLS loaded', {
                    levels: this.qualityLevels.length,
                    startLevel: this.hlsPlayer.startLevel,
                });

                resolve();
            });

            this.hlsPlayer.once(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    Logger.error('HLS fatal error', data);
                    reject(data);
                }
            });
        });

        // Set quality level
        if (playbackInfo.preferredQuality) {
            this.setQuality(playbackInfo.preferredQuality);
        }
    }

    /**
     * Load direct file
     */
    async loadDirect(url, _playbackInfo) {
        return new Promise((resolve, reject) => {
            this.video.addEventListener('loadedmetadata', () => {
                resolve();
            }, { once: true });

            this.video.addEventListener('error', (e) => {
                reject(e);
            }, { once: true });

            this.video.src = url;
            this.video.load();
        });
    }

    /**
     * Start playback
     */
    async play() {
        if (!this.video) {
            return;
        }

        try {
            await this.video.play();
            this.emit('play');
        } catch (error) {
            Logger.error('Play failed', error);
            throw error;
        }
    }

    /**
     * Pause playback
     */
    pause() {
        if (!this.video) {
            return;
        }
        this.video.pause();
    }

    /**
     * Stop playback
     */
    stop() {
        if (!this.video) {
            return;
        }

        this.video.pause();
        this.video.currentTime = 0;
        this.video.src = '';

        if (this.hlsPlayer) {
            this.hlsPlayer.destroy();
            this.hlsPlayer = null;
        }

        this.currentSource = null;
        this.isReady = false;
    }

    /**
     * Seek to position
     */
    async seek(positionSeconds) {
        if (!this.video) {
            return;
        }

        // Clamp to valid range
        const clampedPosition = Math.max(0, Math.min(positionSeconds, this.video.duration));
        this.video.currentTime = clampedPosition;
    }

    /**
     * Seek by ticks (100-nanosecond units used by Phlex)
     */
    async seekToTicks(positionTicks) {
        const positionSeconds = positionTicks / 10000000;
        await this.seek(positionSeconds);
    }

    /**
     * Set playback rate
     */
    setPlaybackRate(rate) {
        if (!this.video) {
            return;
        }
        this.video.playbackRate = rate;
    }

    /**
     * Set volume
     */
    setVolume(volume) {
        if (!this.video) {
            return;
        }
        this.video.volume = Math.max(0, Math.min(1, volume));
    }

    /**
     * Set quality level
     */
    setQuality(qualityIndex) {
        if (!this.hlsPlayer) {
            return;
        }

        if (qualityIndex === -1) {
            // Auto quality
            this.hlsPlayer.currentLevel = -1;
            this.currentQualityIndex = -1;
        } else {
            this.hlsPlayer.currentLevel = qualityIndex;
            this.currentQualityIndex = qualityIndex;
            this.currentQuality = this.qualityLevels[qualityIndex];
        }

        Logger.info('Quality changed', {
            index: qualityIndex,
            quality: this.currentQuality,
        });

        this.emit('qualityChanged', this.currentQuality);
    }

    /**
     * Set subtitle track
     */
    setSubtitleTrack(trackIndex) {
        if (!this.video) {
            return;
        }

        if (trackIndex === -1) {
            // Disable subtitles
            for (let i = 0; i < this.video.textTracks.length; i++) {
                this.video.textTracks[i].mode = 'disabled';
            }
        } else {
            // Enable specific track
            for (let i = 0; i < this.video.textTracks.length; i++) {
                this.video.textTracks[i].mode = (i === trackIndex) ? 'showing' : 'disabled';
            }
        }
    }

    /**
     * Get current position in seconds
     */
    getCurrentTime() {
        return this.video?.currentTime || 0;
    }

    /**
     * Get current position in ticks
     */
    getCurrentTimeTicks() {
        return Math.floor(this.getCurrentTime() * 10000000);
    }

    /**
     * Get duration in seconds
     */
    getDuration() {
        return this.video?.duration || 0;
    }

    /**
     * Get buffered percentage
     */
    getBufferedPercentage() {
        if (!this.video || !this.video.buffered.length) {
            return 0;
        }
        return (this.video.buffered.end(this.video.buffered.length - 1) / this.video.duration) * 100;
    }

    /**
     * Event handlers
     */
    onPlay() {
        this.emit('play');
    }

    onPause() {
        this.emit('pause');
    }

    onEnded() {
        sessionManager.stopPlayback();
        this.emit('ended');
    }

    onError(error) {
        Logger.error('Video error', { error: error.type, code: error.code });
        this.emit('error', error);
    }

    onWaiting() {
        this.emit('waiting');
    }

    onCanPlay() {
        this.emit('canplay');
    }

    onLoadedMetadata() {
        this.emit('loadedmetadata', {
            duration: this.video.duration,
            width: this.video.videoWidth,
            height: this.video.videoHeight,
        });
    }

    onTimeUpdate() {
        this.emit('timeupdate', {
            currentTime: this.video.currentTime,
            duration: this.video.duration,
            position: this.getCurrentTimeTicks(),
        });
    }

    onProgress() {
        this.emit('progress', {
            buffered: this.getBufferedPercentage(),
        });
    }

    onQualityChange() {
        if (this.hlsPlayer) {
            this.currentQualityIndex = this.hlsPlayer.currentLevel;
            this.currentQuality = this.qualityLevels[this.currentQualityIndex];
            this.emit('qualityChanged', this.currentQuality);
        }
    }

    /**
     * Event system
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

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

    emit(event, data) {
        if (!this.listeners.has(event)) {
            return;
        }
        this.listeners.get(event).forEach(callback => callback(data));
    }

    /**
     * Cleanup
     */
    destroy() {
        this.stop();
        this.listeners.clear();
        this.video = null;
    }
}

export default new VideoPlayer();
export { VideoPlayer };
