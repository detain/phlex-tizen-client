/**
 * Main App Class
 * Coordinates all views and handles navigation
 */

import Router from './Router.js';
import HomeView from './HomeView.js';
import LibraryView from './LibraryView.js';
import DetailView from './DetailView.js';
import PlayerView from './PlayerView.js';
import PlayerRemoteHandler from '../remote/PlayerRemoteHandler.js';
import api from '../api/ApiClient.js';
import sessionManager from '../api/SessionManager.js';
import Logger from '../utils/Logger.js';

class App {
    constructor() {
        this.views = new Map();
        this.currentView = null;
        this.router = new Router();
        this.isLoggedIn = false;
        this.user = null;
    }

    /**
     * Initialize the application
     */
    async init() {
        Logger.info('Initializing Phlex TV App');

        // Create views
        this.createViews();

        // Setup router
        this.setupRoutes();

        // Setup session manager events
        this.setupSessionEvents();

        // Try to restore session
        await this.tryRestoreSession();

        // Setup keyboard navigation
        this.setupNavigation();

        Logger.info('App initialized');
    }

    /**
     * Create all views
     */
    createViews() {
        const container = document.getElementById('app');

        this.views.set('home', new HomeView(container));
        this.views.set('library', new LibraryView(container));
        this.views.set('detail', new DetailView(container));
        this.views.set('player', new PlayerView(container));
    }

    /**
     * Setup routes
     */
    setupRoutes() {
        this.router.addRoute('/', () => this.showView('home'));
        this.router.addRoute('/libraries', () => this.showView('home'));
        this.router.addRoute('/libraries/:id', (params) => this.showLibrary(params.id));
        this.router.addRoute('/item/:id', (params) => this.showItem(params.id));
        this.router.addRoute('/player/:id', (params) => this.playItem(params.id));

        this.router.setNotFoundHandler(() => this.showView('home'));
    }

    /**
     * Setup session manager events
     */
    setupSessionEvents() {
        sessionManager.on('playbackStarted', (_data) => {
            PlayerRemoteHandler.activate();
        });

        sessionManager.on('playbackStopped', () => {
            PlayerRemoteHandler.deactivate();
        });
    }

    /**
     * Try to restore existing session
     */
    async tryRestoreSession() {
        try {
            const hasSession = await sessionManager.init();
            if (hasSession) {
                this.isLoggedIn = true;
                this.user = api.user;
                this.showView('home');
            } else {
                this.showLoginScreen();
            }
        } catch (error) {
            Logger.error('Failed to restore session', error);
            this.showLoginScreen();
        }
    }

    /**
     * Show login screen
     */
    showLoginScreen() {
        const loginHtml = `
            <div class="login-screen">
                <div class="login-container">
                    <h1 class="login-title">Phlex</h1>
                    <form class="login-form" id="loginForm">
                        <input type="text" class="login-input"
                               id="username" placeholder="Username"
                               autocomplete="username" required>
                        <input type="password" class="login-input"
                               id="password" placeholder="Password"
                               autocomplete="current-password" required>
                        <button type="submit" class="login-button">Sign In</button>
                        <p class="login-error" id="loginError" style="display: none;"></p>
                    </form>
                </div>
            </div>
        `;

        document.getElementById('app').innerHTML = loginHtml;
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
    }

    /**
     * Handle login form submission
     */
    async handleLogin(event) {
        event.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorEl = document.getElementById('loginError');

        try {
            await api.login(username, password);
            await sessionManager.createSession();

            this.isLoggedIn = true;
            this.user = api.user;
            this.showView('home');
        } catch (error) {
            errorEl.textContent = error.message || 'Login failed';
            errorEl.style.display = 'block';
        }
    }

    /**
     * Show a view
     */
    showView(viewName) {
        const view = this.views.get(viewName);
        if (!view) {
            return;
        }

        // Hide current view
        if (this.currentView) {
            this.currentView.hide();
        }

        // Show new view
        view.show();
        this.currentView = view;
    }

    /**
     * Navigate to library
     */
    async showLibrary(libraryId) {
        const view = this.views.get('library');
        await view.load(libraryId);
        this.showView('library');
    }

    /**
     * Navigate to item detail
     */
    async showItem(itemId) {
        const view = this.views.get('detail');
        await view.load(itemId);
        this.showView('detail');
    }

    /**
     * Start playing item
     */
    async playItem(itemId) {
        const view = this.views.get('player');
        await view.load(itemId);
        this.showView('player');
    }

    /**
     * Navigate back
     */
    navigateBack() {
        this.router.navigateBack();
    }

    /**
     * Setup keyboard navigation
     */
    setupNavigation() {
        // Initial focus
        setTimeout(() => {
            const firstFocusable = document.querySelector('.focusable');
            if (firstFocusable) {
                firstFocusable.focus();
            }
        }, 100);
    }

    /**
     * Toggle info panel
     */
    toggleInfoPanel() {
        const playerView = this.views.get('player');
        if (playerView) {
            playerView.toggleInfoPanel();
        }
    }

    /**
     * Cycle subtitles
     */
    cycleSubtitles() {
        const playerView = this.views.get('player');
        if (playerView) {
            playerView.cycleSubtitles();
        }
    }

    /**
     * Cycle audio tracks
     */
    cycleAudioTracks() {
        const playerView = this.views.get('player');
        if (playerView) {
            playerView.cycleAudioTracks();
        }
    }

    /**
     * Cycle quality
     */
    cycleQuality() {
        const playerView = this.views.get('player');
        if (playerView) {
            playerView.cycleQuality();
        }
    }
}

// Create and export app instance
const app = new App();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

export default app;
