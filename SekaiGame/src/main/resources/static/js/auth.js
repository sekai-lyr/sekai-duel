/**
 * auth.js - Authentication state management
 */

const AUTH_KEY = "nightcord_auth";

export function saveAuth({ userId, username, nickname }) {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ userId, username, nickname }));
}

export function loadAuth() {
    try {
        return JSON.parse(localStorage.getItem(AUTH_KEY));
    } catch {
        return null;
    }
}

export function clearAuth() {
    localStorage.removeItem(AUTH_KEY);
}

export function isAuthenticated() {
    return loadAuth() !== null;
}

export function getUserId() {
    const auth = loadAuth();
    return auth ? auth.userId : null;
}
