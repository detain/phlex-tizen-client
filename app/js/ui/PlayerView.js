/**
 * Player View
 * Full-screen video player with controls
 */

import api from '../api/ApiClient.js';
import sessionManager from '../api/SessionManager.js';
import videoPlayer from '../player/VideoPlayer.js';
import subtitleRenderer from '../player/SubtitleRenderer.js';
import Logger from '../utils/Logger.js';
import Helpers from '../utils/Helpers.js';

class PlayerView {
    constructor(container) {
        this.container = container;
        this.item = null;
        this.playbackInfo = null;
        this.isInfoVisible = true;
        this.infoHideTimeout = null;
    }

    /**
     * Load and prepare item for playback
     */
    async load(itemId) {
        // Get item details
        this.item = await api.getItem(itemId);

        // Get playback info
        this.playbackInfo = await api.getItemPlaybackInfo(itemId);

        // Render player UI
        this.render();

        // Initialize player
        videoPlayer.init(this.getVideoElement());

        // Initialize subtitle renderer
        subtitleRenderer.init(this.container);

        // Setup player events
        this.setupPlayerEvents();

        // Start playback
        await this.startPlayback();
    }

    /**
     * Render player UI
     */
    render() {
        const html = `
            <div class="player-view">
                <video id="player-video"
                       class="player-video"
                       autoplay
                       crossorigin="anonymous">
                </video>

                <div class="player-overlay">
                    <div class="player-top-bar">
                        <button class="player-back-btn" id="playerBack">
                            <span class="icon-back"></span>
                            <span class="back-text">Back</span>
                        </button>
                        <h2 class="player-title">${Helpers.escapeHtml(this.item?.Name || '')}</h2>
                    </div>

                    <div class="player-center-controls" id="centerControls">
                        <button class="control-btn rewind-btn" id="rewindBtn">
                            <span class="icon-rewind"></span>
                        </button>
                        <button class="control-btn play-btn" id="playBtn">
                            <span class="icon-play"></span>
                        </button>
                        <button class="control-btn forward-btn" id="forwardBtn">
                            <span class="icon-forward"></span>
                        </button>
                    </div>

                    <div class="player-bottom-bar">
                        <div class="progress-container">
                            <div class="progress-bar" id="progressBar">
                                <div class="progress-buffered" id="progressBuffered"></div>
                                <div class="progress-current" id="progressCurrent"></div>
                            </div>
                            <div class="time-display">
                                <span id="currentTime">00:00</span>
                                <span class="time-separator">/</span>
                                <span id="totalTime">00:00</span>
                            </div>
                        </div>

                        <div class="quality-selector">
                            <button class="quality-btn" id="qualityBtn">Auto</button>
                        </div>
                    </div>
                </div>

                <div class="player-info-panel" id="infoPanel">
                    <h3 class="info-title">${Helpers.escapeHtml(this.item?.Name || '')}</h3>
                    <p class="info-meta">
                        ${this.item?.ProductionYear || ''} •
                        ${Helpers.formatDuration(this.item?.RunTimeTicks)}
                    </p>
                    <p class="info-description">${Helpers.escapeHtml(this.item?.Overview || '')}</p>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.setupUIHandlers();
    }

    /**
     * Setup UI event handlers
     */
    setupUIHandlers() {
        // Back button
        document.getElementById('playerBack')?.addEventListener('click', () => {
            window.app?.navigateBack();
        });

        // Control buttons
        document.getElementById('playBtn')?.addEventListener('click', () => {
            videoPlayer.video?.paused ? videoPlayer.play() : videoPlayer.pause();
        });

        document.getElementById('rewindBtn')?.addEventListener('click', () => {
            videoPlayer.seek(videoPlayer.getCurrentTime() - 10);
        });

        document.getElementById('forwardBtn')?.addEventListener('click', () => {
            videoPlayer.seek(videoPlayer.getCurrentTime() + 10);
        });

        // Progress bar interaction
        const progressBar = document.getElementById('progressBar');
        progressBar?.addEventListener('click', (e) => {
            const rect = progressBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            const duration = videoPlayer.getDuration();
            videoPlayer.seek(percent * duration);
        });
    }

    /**
     * Setup player events
     */
    setupPlayerEvents() {
        videoPlayer.on('timeupdate', (data) => {
            this.updateProgress(data);
        });

        videoPlayer.on('progress', (data) => {
            this.updateBuffered(data.buffered);
        });

        videoPlayer.on('qualityChanged', (quality) => {
            this.updateQualityIndicator(quality);
        });

        videoPlayer.on('ended', () => {
            window.app?.navigateBack();
        });

        videoPlayer.on('error', (error) => {
            Logger.error('Player error', error);
        });
    }

    /**
     * Start playback
     */
    async startPlayback() {
        try {
            const state = await sessionManager.startPlayback(this.item.Id);
            await videoPlayer.load(state.playbackInfo);
            await videoPlayer.play();
        } catch (error) {
            Logger.error('Failed to start playback', error);
        }
    }

    /**
     * Update progress display
     */
    updateProgress(data) {
        const current = document.getElementById('currentTime');
        const progress = document.getElementById('progressCurrent');

        if (current) {
            current.textContent = Helpers.formatTime(data.currentTime);
        }

        if (progress) {
            const percent = (data.currentTime / data.duration) * 100;
            progress.style.width = `${percent}%`;
        }

        // Auto-hide info after 3 seconds
        if (this.isInfoVisible) {
            clearTimeout(this.infoHideTimeout);
            this.infoHideTimeout = setTimeout(() => {
                this.hideInfoPanel();
            }, 3000);
        }
    }

    /**
     * Update buffered display
     */
    updateBuffered(percent) {
        const buffered = document.getElementById('progressBuffered');
        if (buffered) {
            buffered.style.width = `${percent}%`;
        }
    }

    /**
     * Update quality indicator
     */
    updateQualityIndicator(quality) {
        const qualityBtn = document.getElementById('qualityBtn');
        if (qualityBtn && quality) {
            qualityBtn.textContent = quality.name || 'Auto';
        }
    }

    /**
     * Toggle info panel
     */
    toggleInfoPanel() {
        this.isInfoVisible = !this.isInfoVisible;
        const panel = document.getElementById('infoPanel');

        if (panel) {
            panel.classList.toggle('hidden', !this.isInfoVisible);
        }
    }

    /**
     * Show info panel
     */
    showInfoPanel() {
        this.isInfoVisible = true;
        const panel = document.getElementById('infoPanel');
        if (panel) {
            panel.classList.remove('hidden');
        }
    }

    /**
     * Hide info panel
     */
    hideInfoPanel() {
        this.isInfoVisible = false;
        const panel = document.getElementById('infoPanel');
        if (panel) {
            panel.classList.add('hidden');
        }
    }

    /**
     * Cycle through subtitles
     */
    cycleSubtitles() {
        const tracks = videoPlayer.video?.textTracks || [];
        let currentIndex = -1;

        for (let i = 0; i < tracks.length; i++) {
            if (tracks[i].mode === 'showing') {
                currentIndex = i;
                tracks[i].mode = 'disabled';
                break;
            }
        }

        // Enable next track (or first if at end)
        const nextIndex = (currentIndex + 1) % tracks.length;
        if (tracks[nextIndex]) {
            tracks[nextIndex].mode = 'showing';
        }
    }

    /**
     * Cycle through audio tracks
     */
    cycleAudioTracks() {
        const tracks = videoPlayer.video?.audioTracks || [];
        let currentIndex = -1;

        for (let i = 0; i < tracks.length; i++) {
            if (tracks[i].enabled) {
                currentIndex = i;
                tracks[i].enabled = false;
                break;
            }
        }

        // Enable next track (or first if at end)
        const nextIndex = (currentIndex + 1) % tracks.length;
        if (tracks[nextIndex]) {
            tracks[nextIndex].enabled = true;
        }
    }

    /**
     * Cycle through quality levels
     */
    cycleQuality() {
        const levels = videoPlayer.qualityLevels || [];
        if (levels.length === 0) return;

        let currentIndex = videoPlayer.currentQualityIndex;
        const nextIndex = (currentIndex + 1) % (levels.length + 1); // +1 for auto

        if (nextIndex === levels.length) {
            // Auto
            videoPlayer.setQuality(-1);
        } else {
            videoPlayer.setQuality(nextIndex);
        }
    }

    /**
     * Get video element
     */
    getVideoElement() {
        return document.getElementById('player-video');
    }

    /**
     * Show view
     */
    show() {
        this.container.style.display = 'block';
    }

    /**
     * Hide view
     */
    hide() {
        this.container.style.display = 'none';
    }
}

export default PlayerView;
