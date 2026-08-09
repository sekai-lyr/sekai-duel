/**
 * profile.js - 新存档初始化与默认收藏
 */
import { createDefaultCollection } from "./collection.js";
import { getDefaultDecks } from "./decks.js?v=1.7.1";

export function createNewProfile() {
    const collection = createDefaultCollection();
    collection.version = 2;
    collection.profile = { name: "决斗者", level: 1, xp: 0 };
    collection.decks = getDefaultDecks();
    collection.selectedDeckId = collection.decks[0]?.id || null;

    return collection;
}

export function ensureProfile(collection) {
    const data = collection || createNewProfile();
    data.profile ||= { name: "决斗者", level: 1, xp: 0 };
    // 仅在没有卡组时才创建默认卡组，不覆盖用户已有的
    if (!Array.isArray(data.decks) || data.decks.length === 0) {
        data.decks = getDefaultDecks();
    }
    data.selectedDeckId ||= data.decks[0]?.id || null;
    data.cards ||= {};
    data.artCollection ||= {};
    data.selectedArtByCard ||= {};

    data.decks = data.decks.filter(deck => deck.id !== "nightcord_starter");
    if (!data.decks.some(deck => deck.id === data.selectedDeckId)) data.selectedDeckId = data.decks[0]?.id || null;
    Object.keys(data.cards).filter(id => id.startsWith("starter_n_")).forEach(id => delete data.cards[id]);
    data.currency ||= { duelCoins: 2000, shards: { N: 0, R: 0, SR: 0, SSR: 0, UR: 0 } };
    data.currency.shards ||= { N: 0, R: 0, SR: 0, SSR: 0, UR: 0 };
    data.currency.shards.SSR = Number(data.currency.shards.SSR || 0);
    data.statistics ||= { packsOpened: 0, duelsPlayed: 0, wins: 0, losses: 0, draws: 0, firstWinToday: null };
    data.pityCounters ||= {};
    data.claimedRewards ||= {};
    data.stageProgress ||= {};
    return data;
}
