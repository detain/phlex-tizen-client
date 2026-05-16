/**
 * Phlex Tizen TV App - Main Entry Point
 */

import app from './ui/App.js';
import Logger from './utils/Logger.js';
import remoteManager from './remote/RemoteManager.js';

Logger.info('Phlex Tizen App starting...');

// Export app instance for global access
window.app = app;

// Initialize application
app.init().catch(error => {
    Logger.error('Failed to initialize app', error);
});

export default app;
