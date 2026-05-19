/**
 * Skip Button Component for Samsung Tizen
 * Handles Skip Intro and Skip Outro button display and behavior
 */

class SkipButton {
    /**
     * Create a SkipButton instance
     * @param {Object} options
     * @param {HTMLElement} options.container - Parent container for the button
     * @param {Function} options.onSkip - Callback when skip button is clicked
     */
    constructor(options) {
        this.container = options.container;
        this.onSkip = options.onSkip || (() => {});

        this.markers = null;
        this.currentButton = null;
        this.buttonElement = null;
        this.isVisible = false;

        this.createButton();
    }

    /**
     * Create the skip button element
     */
    createButton() {
        this.buttonElement = document.createElement('button');
        this.buttonElement.className = 'skip-btn';
        this.buttonElement.id = 'skipBtn';
        this.buttonElement.addEventListener('click', () => this.handleClick());

        // Initially hidden
        this.buttonElement.style.display = 'none';

        if (this.container) {
            this.container.appendChild(this.buttonElement);
        }
    }

    /**
     * Set skip markers from playback info
     * @param {Object|null} markers - Skip marker data
     * @param {number|null} markers.skip_intro_start - Intro start in seconds
     * @param {number|null} markers.skip_intro_end - Intro end in seconds
     * @param {number|null} markers.skip_outro_start - Outro start in seconds
     * @param {number|null} markers.skip_outro_end - Outro end in seconds
     */
    setMarkers(markers) {
        this.markers = markers;
    }

    /**
     * Update button visibility based on current playback position
     * @param {number} currentTime - Current playback position in seconds
     */
    updatePosition(currentTime) {
        if (!this.markers) {
            this.hideButton();
            return;
        }

        const { skip_intro_start, skip_intro_end, skip_outro_start, skip_outro_end } = this.markers;

        // Check if within intro marker range
        if (skip_intro_start !== null && skip_intro_end !== null &&
            currentTime >= skip_intro_start && currentTime <= skip_intro_end) {
            this.showButton('intro', skip_intro_end);
            return;
        }

        // Check if within outro marker range
        if (skip_outro_start !== null && skip_outro_end !== null &&
            currentTime >= skip_outro_start && currentTime <= skip_outro_end) {
            this.showButton('outro', skip_outro_end);
            return;
        }

        // Outside any marker range
        this.hideButton();
    }

    /**
     * Show the skip button
     * @param {string} type - 'intro' or 'outro'
     * @param {number} skipTo - Position to seek to when clicked
     */
    showButton(type, skipTo) {
        if (!this.buttonElement) {
            return;
        }

        // Update button text and data if type changed
        if (this.currentButton !== type) {
            this.currentButton = type;
            this.buttonElement.textContent = type === 'intro' ? 'Skip Intro' : 'Skip Outro';
            this.buttonElement.dataset.skipTo = skipTo;
        } else {
            // Just update skip position
            this.buttonElement.dataset.skipTo = skipTo;
        }

        this.buttonElement.style.display = 'block';
        this.isVisible = true;
    }

    /**
     * Hide the skip button
     */
    hideButton() {
        if (!this.buttonElement) {
            return;
        }

        this.buttonElement.style.display = 'none';
        this.isVisible = false;
        this.currentButton = null;
    }

    /**
     * Handle button click - seek to skip position
     */
    handleClick() {
        if (!this.buttonElement || !this.currentButton) {
            return;
        }

        const skipTo = parseFloat(this.buttonElement.dataset.skipTo);
        if (!isNaN(skipTo)) {
            this.onSkip(skipTo);
        }

        // Hide button after clicking
        this.hideButton();
    }

    /**
     * Check if skip intro should be shown
     * @param {number} currentTime - Current position in seconds
     * @returns {boolean}
     */
    shouldShowIntro(currentTime) {
        if (!this.markers) {
            return false;
        }
        const { skip_intro_start, skip_intro_end } = this.markers;
        return skip_intro_start !== null && skip_intro_end !== null &&
               currentTime >= skip_intro_start && currentTime <= skip_intro_end;
    }

    /**
     * Check if skip outro should be shown
     * @param {number} currentTime - Current position in seconds
     * @returns {boolean}
     */
    shouldShowOutro(currentTime) {
        if (!this.markers) {
            return false;
        }
        const { skip_outro_start, skip_outro_end } = this.markers;
        return skip_outro_start !== null && skip_outro_end !== null &&
               currentTime >= skip_outro_start && currentTime <= skip_outro_end;
    }

    /**
     * Check if button is currently visible
     * @returns {boolean}
     */
    isButtonVisible() {
        return this.isVisible;
    }

    /**
     * Get the current button type
     * @returns {string|null} 'intro', 'outro', or null
     */
    getCurrentButtonType() {
        return this.currentButton;
    }

    /**
     * Cleanup and remove button from DOM
     */
    destroy() {
        if (this.buttonElement && this.buttonElement.parentNode) {
            this.buttonElement.parentNode.removeChild(this.buttonElement);
        }
        this.buttonElement = null;
        this.markers = null;
        this.currentButton = null;
        this.isVisible = false;
    }
}

export default SkipButton;
export { SkipButton };
