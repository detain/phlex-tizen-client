/**
 * Library Manager
 * Handles library browsing and item retrieval
 */

import api from './ApiClient.js';
import Logger from '../utils/Logger.js';

class LibraryManager {
    constructor() {
        this.libraries = [];
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get all libraries
     */
    async getLibraries(forceRefresh = false) {
        if (!forceRefresh && this.libraries.length > 0) {
            return this.libraries;
        }

        try {
            this.libraries = await api.getLibraries();
            return this.libraries;
        } catch (error) {
            Logger.error('Failed to get libraries', error);
            throw error;
        }
    }

    /**
     * Get items in a library
     */
    async getLibraryItems(libraryId, options = {}) {
        const cacheKey = `${libraryId}-${JSON.stringify(options)}`;
        const cached = this.cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        try {
            const data = await api.getLibraryItems(libraryId, options);
            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now(),
            });
            return data;
        } catch (error) {
            Logger.error('Failed to get library items', error);
            throw error;
        }
    }

    /**
     * Get single item by ID
     */
    async getItem(itemId, forceRefresh = false) {
        const cacheKey = `item-${itemId}`;
        const cached = this.cache.get(cacheKey);

        if (!forceRefresh && cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        try {
            const data = await api.getItem(itemId);
            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now(),
            });
            return data;
        } catch (error) {
            Logger.error('Failed to get item', error);
            throw error;
        }
    }

    /**
     * Get playback info for item
     */
    async getPlaybackInfo(itemId, options = {}) {
        try {
            return await api.getItemPlaybackInfo(itemId, options);
        } catch (error) {
            Logger.error('Failed to get playback info', error);
            throw error;
        }
    }

    /**
     * Search for items
     */
    async search(query, options = {}) {
        try {
            return await api.search(query, options);
        } catch (error) {
            Logger.error('Search failed', error);
            throw error;
        }
    }

    /**
     * Update user data (watched, favorite, etc.)
     */
    async updateUserData(itemId, userData) {
        try {
            return await api.updateUserData(itemId, userData);
        } catch (error) {
            Logger.error('Failed to update user data', error);
            throw error;
        }
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
}

export default new LibraryManager();
export { LibraryManager };
