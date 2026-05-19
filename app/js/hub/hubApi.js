/**
 * Hub API Client
 * Handles authentication and server listing via Hub
 */

import HubConfig from './hubConfig.js';

const HubApi = {
    /**
     * Sign in to hub
     */
    async signIn(hubUrl, username, password) {
        const res = await fetch(`${hubUrl}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!res.ok) {
            throw new Error(`Hub auth failed: ${res.status}`);
        }

        const data = await res.json();
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + data.expires_in * 1000,
            userId: data.user_id
        };
    },

    /**
     * List claimed servers for current user
     */
    async listServers(session) {
        if (!HubConfig.hubUrl) {
            throw new Error('Hub URL not configured');
        }

        const res = await fetch(`${HubConfig.hubUrl}/api/v1/me/servers`, {
            headers: { 'Authorization': `Bearer ${session.accessToken}` }
        });

        if (!res.ok) {
            throw new Error(`List servers failed: ${res.status}`);
        }

        const data = await res.json();
        return data.servers || [];
    },

    /**
     * Refresh access token
     */
    async refresh(refreshToken) {
        if (!HubConfig.hubUrl) {
            throw new Error('Hub URL not configured');
        }

        const res = await fetch(`${HubConfig.hubUrl}/api/v1/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken })
        });

        if (!res.ok) {
            throw new Error(`Refresh failed: ${res.status}`);
        }

        const data = await res.json();
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + data.expires_in * 1000,
            userId: HubConfig.session?.userId
        };
    },

    /**
     * Check if session token is expired
     */
    isTokenExpired() {
        if (!HubConfig.session) {
            return true;
        }
        return Date.now() >= HubConfig.session.expiresAt;
    },

    /**
     * Get hub info (public endpoint)
     */
    async getHubInfo(hubUrl) {
        const res = await fetch(`${hubUrl}/api/v1/system/info`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
            throw new Error(`Hub info failed: ${res.status}`);
        }

        return res.json();
    }
};

export default HubApi;
