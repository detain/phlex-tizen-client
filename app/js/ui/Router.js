/**
 * Router
 * Simple hash-based routing for TV app navigation
 */

class Router {
    constructor() {
        this.routes = new Map();
        this.notFoundHandler = null;
        this.currentPath = '';

        // Listen for hash changes
        window.addEventListener('hashchange', () => this.handleRoute());

        // Initial route
        this.currentPath = this.getPath();
    }

    /**
     * Get current path from hash
     */
    getPath() {
        const hash = window.location.hash.slice(1);
        return hash || '/';
    }

    /**
     * Add route
     */
    addRoute(path, handler) {
        this.routes.set(path, handler);
    }

    /**
     * Set not found handler
     */
    setNotFoundHandler(handler) {
        this.notFoundHandler = handler;
    }

    /**
     * Navigate to path
     */
    navigate(path) {
        window.location.hash = path;
    }

    /**
     * Navigate back
     */
    navigateBack() {
        history.back();
    }

    /**
     * Handle route change
     */
    handleRoute() {
        const path = this.getPath();

        // Find matching route
        for (const [routePath, handler] of this.routes) {
            const params = this.matchRoute(routePath, path);
            if (params !== null) {
                this.currentPath = path;
                handler(params);
                return;
            }
        }

        // No match found
        if (this.notFoundHandler) {
            this.notFoundHandler();
        }
    }

    /**
     * Match route pattern against path
     */
    matchRoute(routePath, path) {
        // Exact match
        if (routePath === path) {
            return {};
        }

        // Pattern match with params
        const routeParts = routePath.split('/');
        const pathParts = path.split('/');

        if (routeParts.length !== pathParts.length) {
            return null;
        }

        const params = {};

        for (let i = 0; i < routeParts.length; i++) {
            const routePart = routeParts[i];
            const pathPart = pathParts[i];

            if (routePart.startsWith(':')) {
                // Param
                params[routePart.slice(1)] = pathPart;
            } else if (routePart !== pathPart) {
                // No match
                return null;
            }
        }

        return params;
    }

    /**
     * Start listening for route changes
     */
    start() {
        this.handleRoute();
    }
}

export default Router;
