/**
 * Subtitle Renderer
 * Handles subtitle display and track selection
 */

class SubtitleRenderer {
    constructor() {
        this.container = null;
        this.currentSubtitles = [];
        this.activeCue = null;
        this.visible = true;
        this.style = {
            fontFamily: 'Tizen',
            fontSize: 24,
            color: '#FFFFFF',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            textAlign: 'center',
            padding: '8px 16px',
            borderRadius: 4,
        };
    }

    /**
     * Initialize renderer with container element
     */
    init(containerElement) {
        this.container = containerElement;
        this.container.style.position = 'relative';
        this.container.style.overflow = 'hidden';
        this.createCueElement();
    }

    /**
     * Create cue display element
     */
    createCueElement() {
        this.cueElement = document.createElement('div');
        this.cueElement.className = 'subtitle-cue';
        this.cueElement.style.cssText = `
            position: absolute;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            max-width: 80%;
            font-family: ${this.style.fontFamily};
            font-size: ${this.style.fontSize}px;
            color: ${this.style.color};
            background-color: ${this.style.backgroundColor};
            text-align: ${this.style.textAlign};
            padding: ${this.style.padding};
            border-radius: ${this.style.borderRadius};
            z-index: 1000;
            display: none;
            white-space: pre-wrap;
        `;
        this.container.appendChild(this.cueElement);
    }

    /**
     * Set subtitle tracks from video element
     */
    setTracks(videoElement) {
        // Clear existing tracks
        this.currentSubtitles = [];

        // Get text tracks from video
        const textTracks = videoElement.textTracks;
        for (let i = 0; i < textTracks.length; i++) {
            const track = textTracks[i];
            this.currentSubtitles.push({
                index: i,
                language: track.language,
                label: track.label || track.language,
                mode: track.mode,
            });
        }

        return this.currentSubtitles;
    }

    /**
     * Enable subtitle track
     */
    enableTrack(trackIndex) {
        const video = document.querySelector('video');
        if (!video) {
            return;
        }

        for (let i = 0; i < video.textTracks.length; i++) {
            video.textTracks[i].mode = (i === trackIndex) ? 'showing' : 'hidden';
        }

        // Handle VTT side-loaded subtitles
        this.setupNativeSubtitles(video);
    }

    /**
     * Setup native subtitle rendering
     */
    setupNativeSubtitles(video) {
        // Use native WebVTT rendering
        video.textTracks[0].mode = 'showing';
    }

    /**
     * Load external VTT subtitle file
     */
    async loadExternalSubtitles(url) {
        const video = document.querySelector('video');
        if (!video) {
            return;
        }

        // Create track element
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = 'External';
        track.src = url;
        track.default = true;

        // Remove existing external tracks
        const existingTracks = video.querySelectorAll('track[label="External"]');
        existingTracks.forEach(t => t.remove());

        video.appendChild(track);

        // Wait for track to load
        return new Promise((resolve, reject) => {
            track.addEventListener('load', () => {
                track.mode = 'showing';
                resolve();
            });
            track.addEventListener('error', reject);
        });
    }

    /**
     * Show subtitle cue
     */
    showCue(text, startTime, endTime) {
        if (!this.cueElement) {
            return;
        }

        this.cueElement.textContent = text;
        this.cueElement.style.display = 'block';
        this.activeCue = { text, startTime, endTime };
    }

    /**
     * Hide current cue
     */
    hideCue() {
        if (!this.cueElement) {
            return;
        }
        this.cueElement.style.display = 'none';
        this.activeCue = null;
    }

    /**
     * Update subtitle display based on time
     */
    update(_currentTime) {
        // Subtitle handling is done by native video element
        // This is for custom subtitle rendering if needed
    }

    /**
     * Set subtitle appearance
     */
    setStyle(styles) {
        this.style = { ...this.style, ...styles };

        if (this.cueElement) {
            this.cueElement.style.fontFamily = this.style.fontFamily;
            this.cueElement.style.fontSize = `${this.style.fontSize}px`;
            this.cueElement.style.color = this.style.color;
            this.cueElement.style.backgroundColor = this.style.backgroundColor;
        }
    }

    /**
     * Toggle subtitle visibility
     */
    toggle() {
        this.visible = !this.visible;
        if (this.cueElement) {
            this.cueElement.style.display = this.visible ? 'block' : 'none';
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.cueElement && this.cueElement.parentNode) {
            this.cueElement.parentNode.removeChild(this.cueElement);
        }
        this.cueElement = null;
        this.currentSubtitles = [];
    }
}

export default new SubtitleRenderer();
export { SubtitleRenderer };
