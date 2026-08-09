/**
 * api.js - Backend API client for Nightcord Duel Network
 * Spring Boot 整合版：使用同源 API 端点
 */

const BASE_URL = ""; // 同源，使用相对路径
const FETCH_TIMEOUT = 10000; // 云服务器首次请求可能较慢

async function request(path, options = {}) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
        const response = await fetch(`${BASE_URL}${path}`, {
            headers: { "Content-Type": "application/json", ...options.headers },
            signal: controller.signal,
            ...options,
        });
        clearTimeout(timer);
        const data = await response.json();
        if (!response.ok) return { success: false, reason: data.reason || `HTTP ${response.status}` };
        return { success: true, ...data };
    } catch (error) {
        return { success: false, reason: "网络连接失败" };
    }
}

// Auth
export function register(username, password, nickname) {
    return request("/api/auth/register", { method: "POST", body: JSON.stringify({ username, password, nickname }) });
}

export function login(username, password) {
    return request("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
}

// User
export function getUser(userId) {
    return request(`/api/users/${userId}`);
}

export function updateUser(userId, data) {
    return request(`/api/users/${userId}`, { method: "PUT", body: JSON.stringify(data) });
}

export function getUserCards(userId) {
    return request(`/api/users/${userId}/cards`);
}

// Cards
export function getAllCards() {
    return request("/api/cards");
}

// Decks
export async function getUserDecks(userId) {
    const result = await request(`/api/decks/user/${userId}`);
    if (!result.success) return result;
    const decks = Object.entries(result)
        .filter(([key, value]) => /^\d+$/.test(key) && value && typeof value === "object")
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([, value]) => value);
    return { success: true, decks };
}

export function createDeck(userId, name, coverCardId, main) {
    return request(`/api/decks/user/${userId}`, {
        method: "POST",
        body: JSON.stringify({ name, coverCardId, main }),
    });
}

export function updateDeck(deckId, data) {
    return request(`/api/decks/${deckId}`, { method: "PUT", body: JSON.stringify(data) });
}

export function deleteDeck(deckId) {
    return request(`/api/decks/${deckId}`, { method: "DELETE" });
}

// Collection
export function getUserCollection(userId) {
    return request(`/api/collection/${userId}`);
}

export function saveUserCollection(userId, data) {
    return request(`/api/collection/${userId}`, {
        method: "PUT",
        body: JSON.stringify(data),
    });
}

export function openPackServer(userId, packType = "nightcord", count = 8) {
    return request(`/api/collection/${userId}/pack`, {
        method: "POST",
        body: JSON.stringify({ packType, count }),
    });
}

// Duels
export function recordDuel(userId, data) {
    return request(`/api/duels/user/${userId}`, { method: "POST", body: JSON.stringify(data) });
}

export function getUserDuelStats(userId) {
    return request(`/api/duels/user/${userId}/stats`);
}

// Health check
export function healthCheck() {
    return request("/api/health");
}
