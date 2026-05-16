/**
 * Logger utility for Samsung Tizen TV App
 */

const Logger = {
    levels: {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3
    },

    currentLevel: 0, // DEBUG

    /**
     * Set log level
     */
    setLevel(level) {
        if (typeof level === 'string') {
            this.currentLevel = this.levels[level.toUpperCase()] || 0;
        } else {
            this.currentLevel = level;
        }
    },

    /**
     * Format log message
     */
    format(level, message, data) {
        const timestamp = new Date().toISOString();
        const dataStr = data ? ` ${JSON.stringify(data)}` : '';
        return `[${timestamp}] [${level}] ${message}${dataStr}`;
    },

    /**
     * Log debug message
     */
    debug(message, data) {
        if (this.currentLevel > this.levels.DEBUG) return;
        console.debug(this.format('DEBUG', message, data));
    },

    /**
     * Log info message
     */
    info(message, data) {
        if (this.currentLevel > this.levels.INFO) return;
        console.info(this.format('INFO', message, data));
    },

    /**
     * Log warning message
     */
    warn(message, data) {
        if (this.currentLevel > this.levels.WARN) return;
        console.warn(this.format('WARN', message, data));
    },

    /**
     * Log error message
     */
    error(message, data) {
        console.error(this.format('ERROR', message, data));
    }
};

export default Logger;
