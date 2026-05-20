/**
 * Detail View
 * Shows item details with play option
 */

import libraryManager from '../api/LibraryManager.js';
import Logger from '../utils/Logger.js';
import Helpers from '../utils/Helpers.js';

class DetailView {
    constructor(container) {
        this.container = container;
        this.item = null;
    }

    /**
     * Load item details
     */
    async load(itemId) {
        try {
            this.item = await libraryManager.getItem(itemId);
            this.render();
            this.setupNavigation();
        } catch (error) {
            Logger.error('Failed to load item', error);
            this.renderError(error.message);
        }
    }

    /**
     * Render detail view
     */
    render() {
        const item = this.item;

        const html = `
            <div class="detail-view">
                <div class="detail-backdrop">
                    ${this.renderBackdrop(item)}
                </div>

                <div class="detail-content">
                    <button class="back-btn focusable" id="backBtn">
                        <span class="icon-back"></span>
                        <span>Back</span>
                    </button>

                    <div class="detail-info">
                        <h1 class="detail-title">${Helpers.escapeHtml(item.Name)}</h1>

                        <div class="detail-meta">
                            ${item.ProductionYear ? `<span>${item.ProductionYear}</span>` : ''}
                            ${item.RunTimeTicks ? `<span>${Helpers.formatDuration(item.RunTimeTicks)}</span>` : ''}
                            ${item.OfficialRating ? `<span>${item.OfficialRating}</span>` : ''}
                        </div>

                        ${item.Overview ? `<p class="detail-overview">${Helpers.escapeHtml(item.Overview)}</p>` : ''}

                        <div class="detail-actions">
                            <button class="play-btn focusable" id="playBtn">
                                <span class="icon-play"></span>
                                <span>Play</span>
                            </button>
                            ${item.Type === 'Series' ? `
                                <button class="episodes-btn focusable" id="episodesBtn">
                                    <span>Episodes</span>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
    }

    /**
     * Render backdrop image
     */
    renderBackdrop(item) {
        const serverUrl = window.PHLIX_SERVER_URL || 'http://localhost:8096';

        if (item.BackdropImageTags?.length > 0) {
            return `<img src="${serverUrl}/Items/${item.Id}/Images/Backdrop/0"
                         alt="${Helpers.escapeHtml(item.Name)}"
                         class="backdrop-image">`;
        }

        return '<div class="backdrop-placeholder"></div>';
    }

    /**
     * Setup navigation
     */
    setupNavigation() {
        const backBtn = this.container.querySelector('#backBtn');
        const playBtn = this.container.querySelector('#playBtn');
        const episodesBtn = this.container.querySelector('#episodesBtn');

        backBtn?.addEventListener('click', () => {
            window.app?.navigateBack();
        });

        playBtn?.addEventListener('click', () => {
            this.playItem();
        });

        episodesBtn?.addEventListener('click', () => {
            this.showEpisodes();
        });

        // Focus play button
        playBtn?.focus();
    }

    /**
     * Play item
     */
    playItem() {
        if (this.item) {
            window.app?.playItem(this.item.Id);
        }
    }

    /**
     * Show episodes (for series)
     */
    showEpisodes() {
        // For now, just play the series
        this.playItem();
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

export default DetailView;
