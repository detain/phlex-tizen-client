/**
 * HLS.js wrapper for Samsung Tizen
 * Handles HLS stream playback with adaptive bitrate
 */

import Hls from 'hls.js';
import Logger from '../utils/Logger.js';

class HlsPlayer extends Hls {
    constructor(config = {}) {
        // Tizen-optimized default config
        const tizenConfig = {
            // Enable WebWorker for better performance
            enableWorker: true,

            // Fragment loading
            fragLoadingMaxRetry: 4,
            fragLoadingRetryDelay: 500,
            fragLoadingTimeOut: 20000,

            // Level loading
            levelLoadingMaxRetry: 4,
            levelLoadingRetryDelay: 500,
            levelLoadingTimeOut: 10000,

            // Buffer configuration
            backBufferLength: 90,
            maxBufferLength: 60,
            maxMaxBufferLength: 180,
            maxBufferSize: 100 * 1000 * 1000, // 100MB
            maxBufferHole: 0.5,

            // Streaming
            highBufferWatchdogPeriod: 1,
            startLevel: -1, // Auto
            capLevelToPlayerSize: true,

            // Error recovery
            recoverAttempts: 6,
            restartDecoder: true,

            // Tizen-specific
            enableSoftwareAES: true,

            ...config
        };

        super(tizenConfig);

        this.qualityLevels = [];
        this.activeLevel = -1;
        this.isAutoLevel = true;

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        // Manifest parsed
        this.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
            this.qualityLevels = data.levels.map((level, index) => ({
                index,
                height: level.height,
                width: level.width,
                bitrate: level.bitrate,
                name: `${level.height}p`,
                url: level.url
            }));

            this.emit('qualityLevels', this.qualityLevels);
        });

        // Level switch
        this.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
            this.activeLevel = data.level;
            this.isAutoLevel = data.level === -1;

            const level = this.qualityLevels[data.level];
            this.emit('qualityChanged', {
                level: data.level,
                quality: level,
                isAuto: this.isAutoLevel
            });
        });

        // Fragment loaded
        this.on(Hls.Events.FRAG_LOADED, (event, data) => {
            this.emit('fragmentLoaded', {
                sn: data.frag.sn,
                duration: data.frag.duration,
                size: data.frag.length
            });
        });

        // Error handling
        this.on(Hls.Events.ERROR, (event, data) => {
            this.handleError(data);
        });

        // Buffer events
        this.on(Hls.Events.BUFFER_APPENDED, () => {
            this.emit('bufferAppended');
        });

        this.on(Hls.Events.BUFFER_FLUSHED, () => {
            this.emit('bufferFlushed');
        });
    }

    handleError(data) {
        const { type, details, fatal } = data;

        switch (details) {
            case Hls.ErrorDetails.FRAG_LOAD_ERROR:
                Logger.warn('Fragment load error, retrying...', { fatal, url: data.frag?.url });
                if (!fatal) {
                    // Non-fatal, let HLS handle recovery
                    return;
                }
                break;

            case Hls.ErrorDetails.LEVEL_LOAD_ERROR:
                Logger.warn('Level load error, retrying...', { fatal });
                if (!fatal) {
                    return;
                }
                break;

            case Hls.ErrorDetails.MANIFEST_LOAD_ERROR:
                Logger.error('Manifest load error', { fatal });
                this.emit('manifestError', data);
                break;

            case Hls.ErrorDetails.BUFFER_APPEND_ERROR:
                Logger.error('Buffer append error', { fatal });
                this.emit('bufferError', data);
                break;

            case Hls.ErrorDetails.BUFFER_FULL_ERROR:
                Logger.warn('Buffer full, reducing buffer size');
                // Try to reduce buffer
                break;

            default:
                Logger.error('HLS error', { type, details, fatal });
        }

        if (fatal) {
            this.emit('fatalError', data);
        }
    }

    /**
     * Get available quality levels
     */
    getQualityLevels() {
        return this.qualityLevels;
    }

    /**
     * Set quality level manually
     */
    setQualityLevel(levelIndex) {
        this.currentLevel = levelIndex;
        this.isAutoLevel = levelIndex === -1;
    }

    /**
     * Get current quality level
     */
    getCurrentQualityLevel() {
        return this.activeLevel;
    }

    /**
     * Check if quality is auto
     */
    isAutoQuality() {
        return this.isAutoLevel;
    }

    /**
     * Get bandwidth estimate
     */
    getBandwidthEstimate() {
        return this.abrController?.bwEstimator?.getEstimate() || 0;
    }

    /**
     * Start quality selection based on bandwidth
     */
    autoSelectQuality(targetHeight = 1080) {
        const bandwidth = this.getBandwidthEstimate();

        // Find highest quality that bandwidth can support
        for (let i = this.qualityLevels.length - 1; i >= 0; i--) {
            const level = this.qualityLevels[i];
            if (level.height <= targetHeight && level.bitrate < bandwidth * 0.8) {
                this.setQualityLevel(i);
                return level;
            }
        }

        // Default to auto
        this.setQualityLevel(-1);
        return null;
    }
}

export default HlsPlayer;
