/**
 * Player Remote Handler
 * Handles remote control actions during playback
 */

import remoteManager from './RemoteManager.js';
import videoPlayer from '../player/VideoPlayer.js';
import sessionManager from '../api/SessionManager.js';
import Logger from '../utils/Logger.js';

class PlayerRemoteHandler {
    constructor() {
        this.isActive = false;
        this.seekStep = 10; // seconds
        this.volumeStep = 5; // percent
    }

    /**
     * Activate player remote handling
     */
    activate() {
        if (this.isActive) return;

        this.isActive = true;
        remoteManager.setEnabled(false); // Disable global handling

        remoteManager.onAction((data) => this.handleAction(data));

        Logger.info('PlayerRemoteHandler activated');
    }

    /**
     * Deactivate player remote handling
     */
    deactivate() {
        if (!this.isActive) return;

        this.isActive = false;
        remoteManager.setEnabled(true); // Re-enable global handling

        Logger.info('PlayerRemoteHandler deactivated');
    }

    /**
     * Handle remote action
     */
    handleAction({ key, repeat }) {
        switch (key) {
            case 'PLAY':
                this.handlePlay();
                break;
            case 'PAUSE':
                this.handlePause();
                break;
            case 'STOP':
                this.handleStop();
                break;
            case 'PLAY_PAUSE':
                this.handlePlayPause();
                break;
            case 'FAST_FORWARD':
                this.handleSeekForward(repeat);
                break;
            case 'REWIND':
                this.handleSeekBackward(repeat);
                break;
            case 'LEFT':
                this.handleSeekBackward(repeat ? 30 : this.seekStep);
                break;
            case 'RIGHT':
                this.handleSeekForward(repeat ? 30 : this.seekStep);
                break;
            case 'UP':
                this.handleVolumeUp(repeat);
                break;
            case 'DOWN':
                this.handleVolumeDown(repeat);
                break;
            case 'BACK':
                this.handleBack();
                break;
            case 'INFO':
                this.handleToggleInfo();
                break;
            case 'RED':
                this.handleToggleSubtitles();
                break;
            case 'GREEN':
                this.handleToggleAudioTracks();
                break;
            case 'YELLOW':
                this.handleToggleQuality();
                break;
            default:
                Logger.debug('Unhandled player action', { key });
        }
    }

    /**
     * Handle play
     */
    async handlePlay() {
        const state = sessionManager.playbackState;
        if (state?.isPlaying) return;

        try {
            await sessionManager.resumePlayback();
            await videoPlayer.play();
        } catch (error) {
            Logger.error('Play failed', error);
        }
    }

    /**
     * Handle pause
     */
    async handlePause() {
        const state = sessionManager.playbackState;
        if (!state?.isPlaying) return;

        try {
            await sessionManager.pausePlayback();
            videoPlayer.pause();
        } catch (error) {
            Logger.error('Pause failed', error);
        }
    }

    /**
     * Handle play/pause toggle
     */
    handlePlayPause() {
        const state = sessionManager.playbackState;
        if (state?.isPlaying) {
            this.handlePause();
        } else {
            this.handlePlay();
        }
    }

    /**
     * Handle stop
     */
    async handleStop() {
        try {
            await sessionManager.stopPlayback();
            videoPlayer.stop();
            this.deactivate();
        } catch (error) {
            Logger.error('Stop failed', error);
        }
    }

    /**
     * Handle seek forward
     */
    async handleSeekForward(seconds = null) {
        const step = seconds || this.seekStep;
        const current = videoPlayer.getCurrentTime();
        const duration = videoPlayer.getDuration();
        const newPosition = Math.min(current + step, duration);

        try {
            await sessionManager.seekTo(newPosition * 10000000); // Convert to ticks
            await videoPlayer.seek(newPosition);
        } catch (error) {
            Logger.error('Seek forward failed', error);
        }
    }

    /**
     * Handle seek backward
     */
    async handleSeekBackward(seconds = null) {
        const step = seconds || this.seekStep;
        const current = videoPlayer.getCurrentTime();
        const newPosition = Math.max(current - step, 0);

        try {
            await sessionManager.seekTo(newPosition * 10000000); // Convert to ticks
            await videoPlayer.seek(newPosition);
        } catch (error) {
            Logger.error('Seek backward failed', error);
        }
    }

    /**
     * Handle volume up
     */
    handleVolumeUp(repeat) {
        const step = repeat ? 3 : this.volumeStep;
        const current = videoPlayer.video?.volume || 0;
        const newVolume = Math.min(current + step / 100, 1);
        videoPlayer.setVolume(newVolume);
    }

    /**
     * Handle volume down
     */
    handleVolumeDown(repeat) {
        const step = repeat ? 3 : this.volumeStep;
        const current = videoPlayer.video?.volume || 0;
        const newVolume = Math.max(current - step / 100, 0);
        videoPlayer.setVolume(newVolume);
    }

    /**
     * Handle back button
     */
    handleBack() {
        this.deactivate();
        // Navigate back
        window.app?.navigateBack();
    }

    /**
     * Handle info button (show/hide OSD)
     */
    handleToggleInfo() {
        // Toggle on-screen display
        window.app?.toggleInfoPanel();
    }

    /**
     * Handle red button (subtitles)
     */
    handleToggleSubtitles() {
        // Cycle through subtitle tracks
        window.app?.cycleSubtitles();
    }

    /**
     * Handle green button (audio tracks)
     */
    handleToggleAudioTracks() {
        // Cycle through audio tracks
        window.app?.cycleAudioTracks();
    }

    /**
     * Handle yellow button (quality)
     */
    handleToggleQuality() {
        // Cycle through quality levels
        window.app?.cycleQuality();
    }
}

export default new PlayerRemoteHandler();
export { PlayerRemoteHandler };
