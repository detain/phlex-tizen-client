/**
 * Remote Manager
 * Handles Samsung Tizen remote control input
 */

import KeyMapping from './KeyMapping.js';
import Logger from '../utils/Logger.js';

class RemoteManager {
    constructor() {
        this.enabled = true;
        this.keyRepeatDelay = 500;
        this.keyRepeatInterval = 100;
        this.activeKeyRepeat = null;
        this.listeners = new Map();

        this.init();
    }

    /**
     * Initialize remote control handling
     */
    init() {
        // Register key event listener
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));

        Logger.info('RemoteManager initialized');
    }

    /**
     * Handle key down event
     */
    onKeyDown(event) {
        if (!this.enabled) return;

        const keyCode = event.keyCode;
        const mappedKey = KeyMapping.mapKeyCode(keyCode);

        Logger.debug('Key down', { keyCode, mappedKey });

        // Emit key event
        this.emit('keydown', { keyCode, mappedKey });

        // Handle key repeat for navigation keys
        if (KeyMapping.isRepeatable(mappedKey)) {
            event.preventDefault();

            // Start repeat after initial delay
            this.activeKeyRepeat = setTimeout(() => {
                this.startKeyRepeat(mappedKey);
            }, this.keyRepeatDelay);
        }

        // Handle immediate action keys
        if (KeyMapping.isImmediate(mappedKey)) {
            event.preventDefault();
            this.emit('action', { key: mappedKey });
        }

        // Prevent default for handled keys
        if (KeyMapping.isHandled(mappedKey)) {
            event.preventDefault();
        }
    }

    /**
     * Handle key up event
     */
    onKeyUp(event) {
        if (!this.enabled) return;

        const keyCode = event.keyCode;
        const mappedKey = KeyMapping.mapKeyCode(keyCode);

        // Stop key repeat
        this.stopKeyRepeat();

        // Emit key event
        this.emit('keyup', { keyCode, mappedKey });
    }

    /**
     * Start key repeat for navigation
     */
    startKeyRepeat(key) {
        this.stopKeyRepeat();

        this.activeKeyRepeat = setInterval(() => {
            this.emit('action', { key, repeat: true });
        }, this.keyRepeatInterval);
    }

    /**
     * Stop key repeat
     */
    stopKeyRepeat() {
        if (this.activeKeyRepeat) {
            clearTimeout(this.activeKeyRepeat);
            clearInterval(this.activeKeyRepeat);
            this.activeKeyRepeat = null;
        }
    }

    /**
     * Enable/disable remote handling
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.stopKeyRepeat();
        }
    }

    /**
     * Register action handler
     */
    onAction(callback) {
        this.on('action', callback);
    }

    /**
     * Event system
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
        if (index > -1) callbacks.splice(index, 1);
    }

    emit(event, data) {
        if (!this.listeners.has(event)) return;
        this.listeners.get(event).forEach(callback => callback(data));
    }

    /**
     * Cleanup
     */
    destroy() {
        this.stopKeyRepeat();
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
        this.listeners.clear();
    }
}

export default new RemoteManager();
export { RemoteManager };
