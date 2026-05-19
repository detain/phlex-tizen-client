/**
 * Settings View
 * Handles app settings including hub mode configuration
 */

import HubConfig from '../hub/hubConfig.js';
import HubApi from '../hub/hubApi.js';
import Logger from '../utils/Logger.js';

class SettingsView {
    constructor(container) {
        this.container = container;
        this.element = null;
    }

    /**
     * Show settings view
     */
    show() {
        this.render();
    }

    /**
     * Hide settings view
     */
    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }

    /**
     * Load settings view
     */
    load() {
        this.show();
    }

    /**
     * Render settings HTML
     */
    render() {
        const isHubEnabled = HubConfig.isEnabled();
        const hubUrl = HubConfig.hubUrl || '';
        const connectionMode = HubConfig.connectionMode;
        const session = HubConfig.session;
        const servers = HubConfig.servers;
        const activeServerId = HubConfig.activeServerId;

        const html = `
            <div class="settings-view">
                <div class="settings-header">
                    <h1 class="settings-title">Settings</h1>
                    <button class="settings-back-btn" id="settingsBackBtn">Back</button>
                </div>

                <div class="settings-content">
                    <!-- Hub Mode Section -->
                    <div class="settings-section">
                        <h2 class="section-title">Hub Mode</h2>

                        <div class="setting-item">
                            <label class="setting-label">Enable Hub Mode</label>
                            <input type="checkbox" id="hubModeToggle" ${isHubEnabled ? 'checked' : ''}>
                        </div>

                        ${!isHubEnabled ? `
                            <div class="hub-setup-form" id="hubSetupForm">
                                <div class="setting-item">
                                    <label class="setting-label">Hub URL</label>
                                    <input type="text" id="hubUrlInput" class="setting-input"
                                           placeholder="https://hub.example.com" value="${hubUrl}">
                                </div>

                                <div class="setting-item">
                                    <label class="setting-label">Username</label>
                                    <input type="text" id="hubUsernameInput" class="setting-input"
                                           placeholder="Username" autocomplete="username">
                                </div>

                                <div class="setting-item">
                                    <label class="setting-label">Password</label>
                                    <input type="password" id="hubPasswordInput" class="setting-input"
                                           placeholder="Password" autocomplete="current-password">
                                </div>

                                <button class="settings-button primary" id="hubSignInBtn">Sign In to Hub</button>
                                <p class="hub-error" id="hubSignInError" style="display: none;"></p>
                            </div>
                        ` : `
                            <div class="hub-status" id="hubStatus">
                                <p class="hub-status-text">Signed in as ${session?.userId || 'user'} — ${HubConfig.hubUrl}</p>

                                <div class="setting-item">
                                    <label class="setting-label">Claimed Servers</label>
                                    <div class="server-list" id="serverList">
                                        ${servers.length === 0 ? '<p class="no-servers">No servers claimed</p>' :
                                            servers.map(server => `
                                                <div class="server-item ${server.serverId === activeServerId ? 'active' : ''}">
                                                    <input type="radio" name="serverSelection"
                                                           value="${server.serverId}"
                                                           id="server-${server.serverId}"
                                                           ${server.serverId === activeServerId ? 'checked' : ''}>
                                                    <label for="server-${server.serverId}">
                                                        ${server.serverName || server.serverId}
                                                        <span class="server-version">${server.version || ''}</span>
                                                    </label>
                                                </div>
                                            `).join('')
                                        }
                                    </div>
                                </div>

                                <div class="setting-item">
                                    <label class="setting-label">Connection Mode</label>
                                    <div class="connection-mode-options">
                                        <label class="radio-label">
                                            <input type="radio" name="connectionMode" value="direct"
                                                   id="modeDirect" ${connectionMode === 'direct' ? 'checked' : ''}>
                                            Direct (LAN)
                                        </label>
                                        <label class="radio-label">
                                            <input type="radio" name="connectionMode" value="relay"
                                                   id="modeRelay" ${connectionMode === 'relay' ? 'checked' : ''}>
                                            Via Hub Relay
                                        </label>
                                    </div>
                                </div>

                                <button class="settings-button danger" id="hubSignOutBtn">Sign Out</button>
                            </div>
                        `}
                    </div>

                    <!-- App Settings Section -->
                    <div class="settings-section">
                        <h2 class="section-title">App Settings</h2>

                        <div class="setting-item">
                            <label class="setting-label">Server URL</label>
                            <input type="text" id="serverUrlInput" class="setting-input"
                                   value="${window.PHLEX_SERVER_URL || 'http://localhost:8096'}">
                        </div>

                        <div class="setting-item">
                            <label class="setting-label">Device Name</label>
                            <input type="text" id="deviceNameInput" class="setting-input"
                                   value="${window.PHLEX_DEVICE_NAME || 'Samsung Tizen TV'}">
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.element = this.container.querySelector('.settings-view');
        this.attachEventListeners();
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Back button
        const backBtn = document.getElementById('settingsBackBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.goBack());
        }

        // Hub mode toggle
        const hubToggle = document.getElementById('hubModeToggle');
        if (hubToggle) {
            hubToggle.addEventListener('change', (e) => this.handleHubToggle(e));
        }

        // Hub sign in
        const signInBtn = document.getElementById('hubSignInBtn');
        if (signInBtn) {
            signInBtn.addEventListener('click', () => this.handleHubSignIn());
        }

        // Hub sign out
        const signOutBtn = document.getElementById('hubSignOutBtn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => this.handleHubSignOut());
        }

        // Server selection
        const serverRadios = document.querySelectorAll('input[name="serverSelection"]');
        serverRadios.forEach(radio => {
            radio.addEventListener('change', (e) => this.handleServerSelect(e));
        });

        // Connection mode selection
        const modeRadios = document.querySelectorAll('input[name="connectionMode"]');
        modeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => this.handleConnectionModeChange(e));
        });
    }

    /**
     * Handle hub mode toggle
     */
    handleHubToggle(event) {
        if (!event.target.checked) {
            // Disabling hub mode
            HubConfig.clearAll();
            this.render();
        }
    }

    /**
     * Handle hub sign in
     */
    async handleHubSignIn() {
        const hubUrl = document.getElementById('hubUrlInput')?.value.trim();
        const username = document.getElementById('hubUsernameInput')?.value.trim();
        const password = document.getElementById('hubPasswordInput')?.value;
        const errorEl = document.getElementById('hubSignInError');

        if (!hubUrl || !username || !password) {
            this.showHubError('Please fill in all fields');
            return;
        }

        try {
            // Set hub URL first (needed for API calls)
            HubConfig.setHubUrl(hubUrl);

            // Sign in
            const session = await HubApi.signIn(hubUrl, username, password);
            HubConfig.setSession(session);

            // List servers
            const servers = await HubApi.listServers(session);
            HubConfig.setServers(servers);

            // Auto-select first server if none selected
            if (!HubConfig.activeServerId && servers.length > 0) {
                HubConfig.setActiveServerId(servers[0].serverId);
            }

            // Re-render
            this.render();
            Logger.info('Hub sign in successful');
        } catch (error) {
            Logger.error('Hub sign in failed', error);
            this.showHubError(error.message || 'Sign in failed');
        }
    }

    /**
     * Handle hub sign out
     */
    handleHubSignOut() {
        HubConfig.clearAll();
        this.render();
        Logger.info('Hub signed out');
    }

    /**
     * Handle server selection
     */
    handleServerSelect(event) {
        const serverId = event.target.value;
        HubConfig.setActiveServerId(serverId);
        this.render();
    }

    /**
     * Handle connection mode change
     */
    handleConnectionModeChange(event) {
        const mode = event.target.value;
        HubConfig.setConnectionMode(mode);
    }

    /**
     * Show hub error message
     */
    showHubError(message) {
        const errorEl = document.getElementById('hubSignInError');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }

    /**
     * Navigate back
     */
    goBack() {
        window.app?.navigateBack();
    }
}

export default SettingsView;
