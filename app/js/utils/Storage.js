/**
 * Storage utility for Samsung Tizen
 * Handles local storage with fallback to Tizen-specific storage
 */

const Storage = {
    /**
     * Get item from storage
     */
    get(key) {
        try {
            const value = localStorage.getItem(key);
            if (value === null) return null;

            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        } catch (error) {
            Logger.warn('Storage.get failed', { key, error });
            return null;
        }
    },

    /**
     * Set item in storage
     */
    set(key, value) {
        try {
            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            localStorage.setItem(key, stringValue);
            return true;
        } catch (error) {
            Logger.warn('Storage.set failed', { key, error });
            return false;
        }
    },

    /**
     * Remove item from storage
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            Logger.warn('Storage.remove failed', { key, error });
            return false;
        }
    },

    /**
     * Clear all storage
     */
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            Logger.warn('Storage.clear failed', { error });
            return false;
        }
    }
};

export default Storage;
