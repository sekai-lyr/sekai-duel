/**
 * decks.js - 预设主题卡组、AI卡组和Nightcord新玩家卡组
 */

import { createDeck } from "./deck.js";

export const AI_FALLBACK_DECK = {
    id: "ai_fallback",
    name: "AI基础卡组",
    coverCardId: "water_010",
    difficulty: "normal",
    strategy: "balanced",
    main: [
        "water_007", "water_007", "water_007", "water_008", "water_008", "water_008",
        "water_009", "water_009", "water_009", "water_010", "water_010", "water_010",
        "water_011", "water_011", "water_011", "dark_006", "dark_006", "dark_006",
        "water_007", "water_008", "water_009", "water_010", "water_011", "dark_006",
        "nc_sp_ur_001", "nc_sp_ur_002", "nc_sp_ur_003", "nc_sp_ur_004",
        "nc_sp_ur_005", "nc_sp_ur_006", "nc_sp_ur_007", "nc_sp_ur_008",
        "nc_tr_001", "nc_tr_002", "nc_tr_003", "nc_tr_004",
        "nc_tr_005", "nc_tr_001", "nc_tr_002", "nc_tr_003",
    ],
    extra: [],
};

export const NIGHTCORD_STARTER_DECK = AI_FALLBACK_DECK;
export const PRESET_DECKS = [];

export function getDefaultDecks() {
    return PRESET_DECKS.map(d => ({
        id: d.id, name: d.name, coverCardId: d.coverCardId,
        main: [...d.main], extra: [...(d.extra || [])], side: [],
        createdAt: Date.now(), updatedAt: Date.now(),
    }));
}

export function getAIDeck(difficulty = "normal") {
    const filtered = PRESET_DECKS.filter(d => d.difficulty === difficulty);
    if (filtered.length === 0) return AI_FALLBACK_DECK;
    return filtered[Math.floor(Math.random() * filtered.length)];
}
