/**
 * Quality Selector
 * Handles adaptive bitrate quality selection UI and logic
 */

import Logger from '../utils/Logger.js';

class QualitySelector {
    constructor() {
        this.qualities = [];
        this.currentIndex = -1; // -1 = auto
        this.autoMode = true;
        this.listeners = new Map();
    }

    /**
     * Initialize with quality levels from player
     */
    init(qualities) {
        this.qualities = qualities;
        this.currentIndex = -1;
        this.autoMode = true;

        Logger.info('QualitySelector initialized', { count: qualities.length });
    }

    /**
     * Set quality level
     */
    setQuality(index) {
        if (index < -1 || index >= this.qualities.length) {
            Logger.warn('Invalid quality index', { index });
            return;
        }

        this.currentIndex = index;
        this.autoMode = index === -1;

        this.emit('qualityChanged', this.getCurrentQuality());
    }

    /**
     * Cycle to next quality level
     */
    cycleNext() {
        const nextIndex = (this.currentIndex + 1) % (this.qualities.length + 1);

        if (nextIndex === this.qualities.length) {
            // Switch to auto
            this.setQuality(-1);
        } else {
            this.setQuality(nextIndex);
        }
    }

    /**
     * Get current quality info
     */
    getCurrentQuality() {
        if (this.autoMode) {
            return {
                index: -1,
                name: 'Auto',
                isAuto: true,
            };
        }

        return this.qualities[this.currentIndex] || null;
    }

    /**
     * Get quality display name
     */
    getDisplayName() {
        const quality = this.getCurrentQuality();
        return quality ? quality.name : 'Unknown';
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

    emit(event, data) {
        if (!this.listeners.has(event)) {
            return;
        }
        this.listeners.get(event).forEach(callback => callback(data));
    }
}

export default new QualitySelector();
export { QualitySelector };
