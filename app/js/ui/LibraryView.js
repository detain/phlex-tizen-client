/**
 * Library View
 * Displays items within a library
 */

import libraryManager from '../api/LibraryManager.js';
import Logger from '../utils/Logger.js';
import Helpers from '../utils/Helpers.js';

class LibraryView {
    constructor(container) {
        this.container = container;
        this.libraryId = null;
        this.items = [];
        this.selectedIndex = 0;
        this.currentFocusIndex = 0;
    }

    /**
     * Load library items
     */
    async load(libraryId) {
        this.libraryId = libraryId;

        try {
            const response = await libraryManager.getLibraryItems(libraryId);
            this.items = response.Items || [];

            // Render UI
            this.render();
            this.setupNavigation();
        } catch (error) {
            Logger.error('Failed to load library', error);
            this.renderError(error.message);
        }
    }

    /**
     * Render library view
     */
    render() {
        const libraryName = this.getLibraryName();

        const html = `
            <div class="library-view">
                <div class="library-header">
                    <button class="back-btn focusable" id="backBtn">
                        <span class="icon-back"></span>
                        <span>Back</span>
                    </button>
                    <h1 class="library-title">${Helpers.escapeHtml(libraryName)}</h1>
                </div>

                <div class="items-grid">
                    ${this.items.map((item, index) => `
                        <div class="item-card focusable"
                             data-index="${index}"
                             data-id="${item.Id}"
                             tabindex="0">
                            <div class="item-poster">
                                ${this.renderPoster(item)}
                            </div>
                            <h3 class="item-name">${Helpers.escapeHtml(item.Name)}</h3>
                            ${item.ProductionYear ? `<p class="item-year">${item.ProductionYear}</p>` : ''}
                        </div>
                    `).join('')}
                </div>

                ${this.items.length === 0 ? '<p class="empty-message">No items found</p>' : ''}
            </div>
        `;

        this.container.innerHTML = html;
    }

    /**
     * Get library name from first item or ID
     */
    getLibraryName() {
        // Note: library name resolution if needed in future
        return 'Library';
    }

    /**
     * Render item poster or placeholder
     */
    renderPoster(item) {
        if (item.ImageTags?.Primary) {
            const serverUrl = window.PHLIX_SERVER_URL || 'http://localhost:8096';
            return `<img src="${serverUrl}/Items/${item.Id}/Images/Primary"
                         alt="${Helpers.escapeHtml(item.Name)}"
                         loading="lazy">`;
        }
        return `<div class="poster-placeholder">${this.getItemIcon(item.Type)}</div>`;
    }

    /**
     * Get icon for item type
     */
    getItemIcon(type) {
        const icons = {
            Movie: '🎬',
            Series: '📺',
            Episode: '📺',
            MusicAlbum: '🎵',
            Audio: '🎵',
            Book: '📚',
            Photo: '🖼️',
        };
        return icons[type] || '📁';
    }

    /**
     * Setup keyboard navigation
     */
    setupNavigation() {
        const backBtn = this.container.querySelector('#backBtn');
        const items = this.container.querySelectorAll('.item-card');

        // Back button
        backBtn?.addEventListener('click', () => {
            window.app?.navigateBack();
        });

        // Item selection
        items.forEach((item, _index) => {
            item.addEventListener('click', () => {
                this.selectItem(item.dataset.id);
            });

            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.selectItem(item.dataset.id);
                }
            });
        });

        // Focus first item
        if (items.length > 0) {
            items[0].classList.add('selected');
            items[0].focus();
        }
    }

    /**
     * Handle item selection
     */
    selectItem(itemId) {
        window.app?.showItem(itemId);
    }

    /**
     * Render error state
     */
    renderError(message) {
        this.container.innerHTML = `
            <div class="error-view">
                <button class="back-btn focusable" id="backBtn">Back</button>
                <h2>Error</h2>
                <p>${Helpers.escapeHtml(message)}</p>
            </div>
        `;

        this.container.querySelector('#backBtn')?.addEventListener('click', () => {
            window.app?.navigateBack();
        });
    }

    /**
     * Show view
     */
    show() {
        this.container.style.display = 'block';
    }

    /**
     * Hide view
     */
    hide() {
        this.container.style.display = 'none';
    }
}

export default LibraryView;
