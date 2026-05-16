/**
 * Helper utilities
 */

const Helpers = {
    /**
     * Format duration from ticks to readable string
     */
    formatDuration(ticks) {
        if (!ticks) {
            return '';
        }
        const hours = Math.floor(ticks / 36000000000);
        const minutes = Math.floor((ticks % 36000000000) / 600000000);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    },

    /**
     * Format seconds to time string (HH:MM:SS or MM:SS)
     */
    formatTime(seconds) {
        if (seconds === null || seconds === undefined || isNaN(seconds)) {
            return '00:00';
        }
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m}:${s.toString().padStart(2, '0')}`;
    },

    /**
     * Escape HTML entities
     */
    escapeHtml(text) {
        if (!text) {
            return '';
        }
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Generate random ID
     */
    generateId(prefix = '') {
        return `${prefix}${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle function - leading edge, one trailing call
     */
    throttle(func, limit) {
        let lastTime = 0;
        let scheduledId = null;
        return function executedFunction(...args) {
            const now = Date.now();
            if (now - lastTime >= limit) {
                func(...args);
                lastTime = now;
            } else if (!scheduledId) {
                scheduledId = setTimeout(() => {
                    func(...args);
                    lastTime = Date.now();
                    scheduledId = null;
                }, limit);
            }
        };
    },
};

export default Helpers;
