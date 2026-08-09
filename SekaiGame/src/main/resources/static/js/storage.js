/**
 * storage.js - 本地存档管理 + 后端同步
 */

import { getUserId } from "./auth.js";
import * as api from "./api.js?v=1.7.4";

const SAVE_KEY = "dimensional_duel_save";
const SAVE_VERSION = 2;

export function loadSave() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return migrateSave(parsed);
    } catch (error) {
        console.error("存档读取失败:", error);
        return null;
    }
}

export function saveData(data) {
    try {
        const payload = { ...data, version: SAVE_VERSION, lastSaved: Date.now() };
        if (typeof localStorage !== "undefined") localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
        Object.assign(data, payload);
        syncToBackend(payload);
        return true;
    } catch (error) {
        console.error("存档保存失败:", error);
        return false;
    }
}

let syncTimer = null;
function syncToBackend(data) {
    const userId = getUserId();
    if (!userId) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
        try {
            await api.updateUser(userId, {
                nickname: data.profile?.name,
                duelCoins: data.currency?.duelCoins,
            });
            // 先获取服务端已有卡组
            const serverResult = await api.getUserDecks(userId);
            const serverDeckIds = new Set();
            if (serverResult.success && Array.isArray(serverResult.decks)) {
                for (const d of serverResult.decks) serverDeckIds.add(d.id);
            }
            // 逐个同步本地卡组到服务端
            for (const deck of (data.decks || [])) {
                try {
                    if (serverDeckIds.has(deck.id)) {
                        await api.updateDeck(deck.id, {
                            name: deck.name,
                            coverCardId: deck.coverCardId,
                            main: deck.main || [],
                            extra: deck.extra || [],
                            side: deck.side || [],
                        });
                    } else {
                        const created = await api.createDeck(userId, deck.name, deck.coverCardId, deck.main || []);
                        if (created?.id) deck.id = created.id;
                    }
                } catch (deckErr) {
                    console.warn("卡组同步失败:", deck.name, deckErr);
                }
            }
        } catch (e) {
            console.warn("后端同步失败，数据已保存在本地:", e);
        }
    }, 500);
}

export function deleteSave() {
    try {
        localStorage.removeItem(SAVE_KEY);
        return true;
    } catch (error) {
        console.error("存档删除失败:", error);
        return false;
    }
}

export function exportSave() {
    const data = loadSave();
    return data ? JSON.stringify(data, null, 2) : null;
}

export function importSave(jsonString) {
    try {
        const raw = JSON.parse(jsonString);
        const rawValidation = validateSaveStructure(raw);
        if (!rawValidation.valid) return { success: false, reason: rawValidation.errors.join("；") };
        const parsed = migrateSave(raw);
        saveData(parsed);
        return { success: true, data: parsed };
    } catch (error) {
        return { success: false, reason: "JSON解析失败" };
    }
}

export function migrateSave(input) {
    if (!input || typeof input !== "object") return null;
    const data = structuredCloneSafe(input);
    data.version = Number(data.version || 0);
    data.cards ||= {};
    data.artCollection ||= {};
    data.selectedArtByCard ||= {};
    data.currency ||= { duelCoins: 0, shards: {} };
    data.currency.duelCoins = Number(data.currency.duelCoins || 0);
    data.currency.shards ||= {};
    for (const rarity of ["N", "R", "SR", "SSR", "UR"]) data.currency.shards[rarity] = Number(data.currency.shards[rarity] || 0);
    data.statistics ||= {};
    data.statistics.packsOpened ||= 0;
    data.statistics.duelsPlayed ||= 0;
    data.statistics.wins ||= 0;
    data.statistics.losses ||= 0;
    data.statistics.draws ||= 0;
    data.settings ||= {};
    data.settings.animationSpeed ??= 1;
    data.settings.reduceAnimations ??= false;
    data.settings.logLevel ??= 1;
    data.decks = Array.isArray(data.decks) ? data.decks : [];
    data.selectedDeckId ||= data.decks[0]?.id || null;
    data.pityCounters ||= {};
    data.claimedRewards ||= {};
    data.stageProgress ||= {};
    data.profile ||= { name: "决斗者", level: 1, xp: 0 };
    data.version = SAVE_VERSION;
    return data;
}

function validateSaveStructure(data) {
    const errors = [];
    if (!data || typeof data !== "object") errors.push("存档不是对象");
    if (!data.cards || typeof data.cards !== "object") errors.push("收藏数据损坏");
    if (!Array.isArray(data.decks)) errors.push("卡组数据损坏");
    if (!data.currency || typeof data.currency.duelCoins !== "number") errors.push("货币数据损坏");
    return { valid: errors.length === 0, errors };
}

function structuredCloneSafe(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
}
