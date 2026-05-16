/**
 * Authentication Manager
 */

import api from './ApiClient.js';
import Logger from '../utils/Logger.js';

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.listeners = new Map();
    }

    /**
     * Initialize auth manager
     */
    async init() {
        try {
            const restored = await api.restoreSession();
            if (restored) {
                this.currentUser = api.user;
                this.emit('userLoggedIn', this.currentUser);
                return true;
            }
            return false;
        } catch (error) {
            Logger.error('Auth init failed', error);
            return false;
        }
    }

    /**
     * Login user
     */
    async login(username, password) {
        try {
            const result = await api.login(username, password);
            await api.createSession();
            this.currentUser = result.user;
            this.emit('userLoggedIn', this.currentUser);
            return result;
        } catch (error) {
            Logger.error('Login failed', error);
            throw error;
        }
    }

    /**
     * Register new user
     */
    async register(email, username, password) {
        try {
            return await api.register(email, username, password);
        } catch (error) {
            Logger.error('Registration failed', error);
            throw error;
        }
    }

    /**
     * Logout user
     */
    logout() {
        api.logout();
        this.currentUser = null;
        this.emit('userLoggedOut');
    }

    /**
     * Get current user
     */
    getUser() {
        return this.currentUser;
    }

    /**
     * Check if user is logged in
     */
    isLoggedIn() {
        return this.currentUser !== null;
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

    off(event, callback) {
        if (!this.listeners.has(event)) return;
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }

    emit(event, data) {
        if (!this.listeners.has(event)) return;
        this.listeners.get(event).forEach(callback => callback(data));
    }
}

export default new AuthManager();
export { AuthManager };
