/**
 * Home View
 * Main screen showing library shortcuts and recent items
 */

import api from '../api/ApiClient.js';
import libraryManager from '../api/LibraryManager.js';
import Logger from '../utils/Logger.js';
import Helpers from '../utils/Helpers.js';

class HomeView {
    constructor(container) {
        this.container = container;
        this.libraries = [];
        this.selectedIndex = 0;
    }

    /**
     * Load and render home view
     */
    async load() {
        try {
            // Get libraries
            this.libraries = await libraryManager.getLibraries();

            // Render UI
            this.render();

            // Setup navigation
            this.setupNavigation();
        } catch (error) {
            Logger.error('Failed to load home view', error);
            this.renderError(error.message);
        }
    }

    /**
     * Render home view
     */
    render() {
        const html = `
            <div class="home-view">
                <div class="home-header">
                    <h1 class="home-title">Phlex</h1>
                    <p class="home-subtitle">Your Media Library</p>
                </div>

                <div class="libraries-grid">
                    ${this.libraries.map((lib, index) => `
                        <div class="library-card focusable" data-index="${index}" data-id="${lib.Id}">
                            <div class="library-icon">${this.getLibraryIcon(lib.CollectionType)}</div>
                            <h3 class="library-name">${Helpers.escapeHtml(lib.Name)}</h3>
                            <p class="library-count">${lib.ItemCount || 0} items</p>
                        </div>
                    `).join('')}
                </div>

                <div class="home-footer">
                    <button class="logout-btn focusable" id="logoutBtn">Sign Out</button>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
    }

    /**
     * Get library icon based on type
     */
    getLibraryIcon(type) {
        const icons = {
            movies: '🎬',
            tvshows: '📺',
            music: '🎵',
            books: '📚',
            photos: '🖼️',
            homevideos: '📹',
            games: '🎮',
            series: '📺'
        };
        return icons[type] || '📁';
    }

    /**
     * Setup keyboard navigation
     */
    setupNavigation() {
        const cards = this.container.querySelectorAll('.library-card');
        const logoutBtn = this.container.querySelector('#logoutBtn');

        // Focus first card
        if (cards.length > 0) {
            cards[0].classList.add('selected');
            cards[0].focus();
        }

        // Card click handlers
        cards.forEach((card, index) => {
            card.addEventListener('click', () => {
                this.selectLibrary(card.dataset.id);
            });
        });

        // Logout handler
        logoutBtn?.addEventListener('click', () => {
            this.handleLogout();
        });
    }

    /**
     * Handle library selection
     */
    selectLibrary(libraryId) {
        window.app?.showLibrary(libraryId);
    }

    /**
     * Handle logout
     */
    handleLogout() {
        api.logout();
        window.app?.showLoginScreen();
    }

    /**
     * Render error state
     */
    renderError(message) {
        this.container.innerHTML = `
            <div class="error-view">
                <h2>Error</h2>
                <p>${Helpers.escapeHtml(message)}</p>
                <button class="retry-btn focusable" id="retryBtn">Retry</button>
            </div>
        `;

        this.container.querySelector('#retryBtn')?.addEventListener('click', () => {
            this.load();
        });
    }

    /**
     * Show view
     */
    show() {
        this.container.style.display = 'block';
        this.load();
    }

    /**
     * Hide view
     */
    hide() {
        this.container.style.display = 'none';
    }
}

export default HomeView;
