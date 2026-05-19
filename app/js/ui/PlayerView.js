/**
 * Player View
 * Full-screen video player with controls
 */

import api from '../api/ApiClient.js';
import sessionManager from '../api/SessionManager.js';
import videoPlayer from '../player/VideoPlayer.js';
import subtitleRenderer from '../player/SubtitleRenderer.js';
import SkipButton from '../player/SkipButton.js';
import Logger from '../utils/Logger.js';
import Helpers from '../utils/Helpers.js';

class PlayerView {
    constructor(container) {
        this.container = container;
        this.item = null;
        this.playbackInfo = null;
        this.isInfoVisible = true;
        this.infoHideTimeout = null;
        this.skipButton = null;
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

        // Initialize skip button
        this.initSkipButton();

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
     * Initialize skip button with markers from playback info
     */
    initSkipButton() {
        // Extract markers from playback info
        // Structure: playback_info.markers or playbackInfo.markers depending on API
        let markers = null;
        if (this.playbackInfo) {
            // Try nested structure: playback_info.markers
            if (this.playbackInfo.playback_info?.markers) {
                markers = this.playbackInfo.playback_info.markers;
            } else if (this.playbackInfo.markers) {
                // Direct markers on playbackInfo
                markers = this.playbackInfo.markers;
            }
        }

        // Create skip button in the overlay container
        const overlay = this.container.querySelector('.player-overlay');
        this.skipButton = new SkipButton({
            container: overlay,
            onSkip: (skipTo) => this.handleSkip(skipTo),
        });

        if (markers) {
            this.skipButton.setMarkers(markers);
        }
    }

    /**
     * Handle skip button click
     * @param {number} skipTo - Position to seek to in seconds
     */
    handleSkip(skipTo) {
        if (typeof skipTo === 'number' && skipTo >= 0) {
            videoPlayer.seek(skipTo);
        }
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

                <div class="player-overlay" id="playerOverlay">
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

                        <div class="player-controls-right">
                            <button class="syncplay-btn" id="syncplayBtn" title="SyncPlay">
                                <span class="icon-syncplay"></span>
                                <span class="syncplay-text">SyncPlay</span>
                            </button>
                            <button class="quality-btn" id="qualityBtn">Auto</button>
                        </div>
                    </div>

                    <div class="syncplay-panel hidden" id="syncplayPanel">
                        <div class="syncplay-header">
                            <h4>SyncPlay</h4>
                            <button class="syncplay-close" id="syncplayClose">×</button>
                        </div>
                        <div class="syncplay-content">
                            <div class="syncplay-group-info" id="syncplayGroupInfo">
                                <p class="syncplay-status" id="syncplayStatus">Not in a group</p>
                                <div class="syncplay-actions">
                                    <button class="syncplay-action-btn" id="syncplayCreateBtn">Create Group</button>
                                    <button class="syncplay-action-btn" id="syncplayJoinBtn">Join Group</button>
                                    <button class="syncplay-action-btn hidden" id="syncplayLeaveBtn">Leave Group</button>
                                </div>
                            </div>
                            <div class="syncplay-members hidden" id="syncplayMembers">
                                <h5>Members</h5>
                                <ul class="member-list" id="memberList"></ul>
                            </div>
                            <div class="syncplay-sync-status" id="syncplaySyncStatus"></div>
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
            this.handleBack();
        });

        // Control buttons
        document.getElementById('playBtn')?.addEventListener('click', () => {
            this.handlePlayPause();
        });

        document.getElementById('rewindBtn')?.addEventListener('click', () => {
            this.handleRewind();
        });

        document.getElementById('forwardBtn')?.addEventListener('click', () => {
            this.handleForward();
        });

        // Progress bar interaction
        const progressBar = document.getElementById('progressBar');
        progressBar?.addEventListener('click', (e) => {
            this.handleProgressBarClick(e);
        });

        // SyncPlay handlers
        this.setupSyncPlayHandlers();
    }

    /**
     * Setup SyncPlay event handlers
     */
    setupSyncPlayHandlers() {
        // SyncPlay button toggles panel
        document.getElementById('syncplayBtn')?.addEventListener('click', () => {
            this.toggleSyncPlayPanel();
        });

        // Close panel
        document.getElementById('syncplayClose')?.addEventListener('click', () => {
            this.hideSyncPlayPanel();
        });

        // Create group
        document.getElementById('syncplayCreateBtn')?.addEventListener('click', () => {
            this.showSyncPlayCreateDialog();
        });

        // Join group
        document.getElementById('syncplayJoinBtn')?.addEventListener('click', () => {
            this.showSyncPlayJoinDialog();
        });

        // Leave group
        document.getElementById('syncplayLeaveBtn')?.addEventListener('click', () => {
            this.leaveSyncPlayGroup();
        });

        // SyncPlay events from service
        syncPlayService.on('groupJoined', (data) => this.onSyncPlayGroupJoined(data));
        syncPlayService.on('groupLeft', () => this.onSyncPlayGroupLeft());
        syncPlayService.on('memberJoined', (member) => this.onSyncPlayMemberJoined(member));
        syncPlayService.on('memberLeft', (member) => this.onSyncPlayMemberLeft(member));
        syncPlayService.on('playbackCommand', (data) => this.onSyncPlayPlaybackCommand(data));
        syncPlayService.on('playbackSeek', (data) => this.onSyncPlayPlaybackSeek(data));
        syncPlayService.on('playbackSync', (data) => this.onSyncPlayPlaybackSync(data));
        syncPlayService.on('timeSync', (data) => this.onSyncPlayTimeSync(data));
        syncPlayService.on('error', (data) => this.onSyncPlayError(data));
        syncPlayService.on('connected', () => this.updateSyncPlayStatus());
        syncPlayService.on('disconnected', () => this.updateSyncPlayStatus());
    }

    /**
     * Handle back button
     */
    handleBack() {
        if (this.isSyncPlayActive) {
            syncPlayService.leaveGroup();
        }
        window.app?.navigateBack();
    }

    /**
     * Handle play/pause button
     */
    handlePlayPause() {
        // If SyncPlay is active and we're the host, broadcast the command
        if (this.isSyncPlayActive && this.isSyncPlayHost()) {
            const isPaused = videoPlayer.video?.paused;
            const position = videoPlayer.getCurrentTime() * 1000; // Convert to ms
            syncPlayService.sendPlaybackCommand(isPaused ? 'pause' : 'play', position);
        }

        // Toggle local playback
        videoPlayer.video?.paused ? videoPlayer.play() : videoPlayer.pause();
    }

    /**
     * Handle rewind button
     */
    handleRewind() {
        const currentTime = videoPlayer.getCurrentTime();
        const newTime = currentTime - 10;
        videoPlayer.seek(newTime);

        // If SyncPlay is active and we're the host, broadcast the seek
        if (this.isSyncPlayActive && this.isSyncPlayHost()) {
            syncPlayService.sendPlaybackCommand('seek', currentTime * 1000, newTime * 1000);
        }
    }

    /**
     * Handle forward button
     */
    handleForward() {
        const currentTime = videoPlayer.getCurrentTime();
        const newTime = currentTime + 10;
        videoPlayer.seek(newTime);

        // If SyncPlay is active and we're the host, broadcast the seek
        if (this.isSyncPlayActive && this.isSyncPlayHost()) {
            syncPlayService.sendPlaybackCommand('seek', currentTime * 1000, newTime * 1000);
        }
    }

    /**
     * Handle progress bar click
     */
    handleProgressBarClick(e) {
        const progressBar = document.getElementById('progressBar');
        const rect = progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const duration = videoPlayer.getDuration();
        const newTime = percent * duration;

        videoPlayer.seek(newTime);

        // If SyncPlay is active and we're the host, broadcast the seek
        if (this.isSyncPlayActive && this.isSyncPlayHost()) {
            const currentPosition = videoPlayer.getCurrentTime() * 1000;
            syncPlayService.sendPlaybackCommand('seek', currentPosition, newTime * 1000);
        }
    }

    /**
     * Check if current user is the SyncPlay host
     * @returns {boolean}
     */
    isSyncPlayHost() {
        return syncPlayService.hostId === syncPlayService.memberId;
    }

    /**
     * Toggle SyncPlay panel visibility
     */
    toggleSyncPlayPanel() {
        const panel = document.getElementById('syncplayPanel');
        if (panel) {
            panel.classList.toggle('hidden');
        }
    }

    /**
     * Hide SyncPlay panel
     */
    hideSyncPlayPanel() {
        const panel = document.getElementById('syncplayPanel');
        if (panel) {
            panel.classList.add('hidden');
        }
    }

    /**
     * Show SyncPlay create group dialog
     */
    showSyncPlayCreateDialog() {
        const groupName = prompt('Enter group name:');
        if (groupName) {
            syncPlayService.createGroup(groupName).catch((error) => {
                Logger.error('Failed to create SyncPlay group', error);
            });
        }
    }

    /**
     * Show SyncPlay join group dialog
     */
    showSyncPlayJoinDialog() {
        const groupId = prompt('Enter group ID:');
        if (groupId) {
            syncPlayService.joinGroup(groupId).catch((error) => {
                Logger.error('Failed to join SyncPlay group', error);
            });
        }
    }

    /**
     * Leave SyncPlay group
     */
    leaveSyncPlayGroup() {
        syncPlayService.leaveGroup();
    }

    /**
     * Handle group joined event
     */
    onSyncPlayGroupJoined(data) {
        this.isSyncPlayActive = true;
        this.syncPlayGroupName = data.group_name || data.group_id;
        this.updateSyncPlayStatus();
        this.updateMemberList();

        // Show the members panel
        const membersPanel = document.getElementById('syncplayMembers');
        const leaveBtn = document.getElementById('syncplayLeaveBtn');
        const joinBtn = document.getElementById('syncplayJoinBtn');
        const createBtn = document.getElementById('syncplayCreateBtn');

        if (membersPanel) membersPanel.classList.remove('hidden');
        if (leaveBtn) leaveBtn.classList.remove('hidden');
        if (joinBtn) joinBtn.classList.add('hidden');
        if (createBtn) createBtn.classList.add('hidden');
    }

    /**
     * Handle group left event
     */
    onSyncPlayGroupLeft() {
        this.isSyncPlayActive = false;
        this.syncPlayGroupName = '';
        this.updateSyncPlayStatus();
        this.clearMemberList();

        const membersPanel = document.getElementById('syncplayMembers');
        const leaveBtn = document.getElementById('syncplayLeaveBtn');
        const joinBtn = document.getElementById('syncplayJoinBtn');
        const createBtn = document.getElementById('syncplayCreateBtn');

        if (membersPanel) membersPanel.classList.add('hidden');
        if (leaveBtn) leaveBtn.classList.add('hidden');
        if (joinBtn) joinBtn.classList.remove('hidden');
        if (createBtn) createBtn.classList.remove('hidden');
    }

    /**
     * Handle member joined event
     */
    onSyncPlayMemberJoined(member) {
        this.updateMemberList();
    }

    /**
     * Handle member left event
     */
    onSyncPlayMemberLeft(member) {
        this.updateMemberList();
    }

    /**
     * Handle playback command from host
     */
    onSyncPlayPlaybackCommand(data) {
        const positionSeconds = data.position / 1000;

        switch (data.command) {
            case 'play':
                videoPlayer.seek(positionSeconds);
                videoPlayer.play();
                break;
            case 'pause':
                videoPlayer.seek(positionSeconds);
                videoPlayer.pause();
                break;
        }
    }

    /**
     * Handle seek command from host
     */
    onSyncPlayPlaybackSeek(data) {
        const toPositionSeconds = data.toPosition / 1000;
        videoPlayer.seek(toPositionSeconds);
    }

    /**
     * Handle playback sync from host
     */
    onSyncPlayPlaybackSync(data) {
        // Only act if not host and playback state differs
        if (this.isSyncPlayHost()) {
            return;
        }

        const positionSeconds = data.position / 1000;
        const isPlaying = data.isPlaying;

        // If position differs significantly (more than 2 seconds), seek
        const currentPosition = videoPlayer.getCurrentTime();
        if (Math.abs(currentPosition - positionSeconds) > 2) {
            videoPlayer.seek(positionSeconds);
        }

        // Sync play state
        if (isPlaying && videoPlayer.video?.paused) {
            videoPlayer.play();
        } else if (!isPlaying && !videoPlayer.video?.paused) {
            videoPlayer.pause();
        }
    }

    /**
     * Handle time sync update
     */
    onSyncPlayTimeSync(data) {
        const statusEl = document.getElementById('syncplaySyncStatus');
        if (statusEl) {
            const stabilityIndicator = data.isStable ? '✓' : '○';
            statusEl.textContent = `Time sync: ${stabilityIndicator} ${Math.round(data.offset)}ms`;
        }
    }

    /**
     * Handle SyncPlay error
     */
    onSyncPlayError(data) {
        Logger.error('SyncPlay error', data);
        alert(`SyncPlay error: ${data.message}`);
    }

    /**
     * Update SyncPlay status display
     */
    updateSyncPlayStatus() {
        const statusEl = document.getElementById('syncplayStatus');
        const syncplayBtn = document.getElementById('syncplayBtn');

        if (this.isSyncPlayActive) {
            const status = syncPlayService.isInGroup ? 'In group' : 'Connecting...';
            const memberCount = syncPlayService.members.length;
            statusEl.textContent = `${status} (${memberCount} member${memberCount !== 1 ? 's' : ''})`;
            syncplayBtn?.classList.add('active');
        } else {
            statusEl.textContent = 'Not in a group';
            syncplayBtn?.classList.remove('active');
        }
    }

    /**
     * Update member list display
     */
    updateMemberList() {
        const listEl = document.getElementById('memberList');
        if (!listEl) {
            return;
        }

        listEl.innerHTML = '';

        for (const member of syncPlayService.members) {
            const li = document.createElement('li');
            li.className = 'member-item';

            const isHost = member.id === syncPlayService.hostId;
            const isCurrentUser = member.id === syncPlayService.memberId;

            li.innerHTML = `
                <span class="member-name">${Helpers.escapeHtml(member.name || 'Unknown')}</span>
                ${isHost ? '<span class="member-badge host">Host</span>' : ''}
                ${isCurrentUser ? '<span class="member-badge you">(You)</span>' : ''}
            `;

            listEl.appendChild(li);
        }
    }

    /**
     * Clear member list display
     */
    clearMemberList() {
        const listEl = document.getElementById('memberList');
        if (listEl) {
            listEl.innerHTML = '';
        }
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

        // Update skip button visibility based on position
        if (this.skipButton) {
            this.skipButton.updatePosition(data.currentTime);
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
        if (levels.length === 0) {
            return;
        }

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
        this.hideSyncPlayPanel();
    }

    /**
     * Cleanup when leaving player
     */
    destroy() {
        this.hideSyncPlayPanel();
        this.isSyncPlayActive = false;
        this.syncPlayGroupName = '';
        clearTimeout(this.infoHideTimeout);
    }
}

export default PlayerView;
