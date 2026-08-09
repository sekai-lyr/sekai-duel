/**
 * collection.js - 玩家收藏管理
 * 支持：卡牌拥有、碎片系统、插画收藏、制作系统
 */

export const SHARD_VALUES = { N: 5, R: 15, SR: 50, SSR: 100, UR: 200 };
export const CRAFT_COSTS = { N: 20, R: 60, SR: 200, SSR: 400, UR: 800 };
export const MAX_COPIES = 3;

export const DEFAULT_COLLECTION = {
    version: 2,
    cards: {},
    artCollection: {},
    selectedArtByCard: {},
    currency: { duelCoins: 2000, shards: { N: 0, R: 0, SR: 0, SSR: 0, UR: 0 } },
    statistics: { packsOpened: 0, duelsPlayed: 0, wins: 0, losses: 0, draws: 0, firstWinToday: null },
    settings: { demoMode: false, animationSpeed: 1, reduceAnimations: false, logLevel: 1, defaultDifficulty: "normal", musicVolume: 0.5, sfxVolume: 0.7 },
    decks: [],
    selectedDeckId: null,
    pityCounters: {},
    claimedRewards: {},
};

export function createDefaultCollection() {
    return JSON.parse(JSON.stringify(DEFAULT_COLLECTION));
}

export function createDemoCollection(cardIds) {
    const col = createDefaultCollection();
    col.settings.demoMode = true;
    col.currency.duelCoins = 999999;
    for (const id of cardIds) { col.cards[id] = (col.cards[id] || 0) + 3; }
    return col;
}

export function addCard(collection, cardId, count = 1, cardDatabase = null) {
    if (!cardId || count < 0) return { added: 0, shardsEarned: 0 };
    if (cardDatabase) {
        const card = cardDatabase.find(c => c.id === cardId);
        if (!card) return { added: 0, shardsEarned: 0 };
        if (card.enabled === false) return { added: 0, shardsEarned: 0 };
    }
    const currentCount = collection.cards[cardId] || 0;
    let added = 0;
    let shardsEarned = 0;

    if (currentCount < MAX_COPIES) {
        const canAdd = Math.min(count, MAX_COPIES - currentCount);
        collection.cards[cardId] = currentCount + canAdd;
        added = canAdd;
        const leftover = count - canAdd;
        if (leftover > 0) {
            const card = cardDatabase?.find(c => c.id === cardId);
            const rarity = card?.rarity || "N";
            shardsEarned = leftover * (SHARD_VALUES[rarity] || 5);
            collection.currency.shards[rarity] = (collection.currency.shards[rarity] || 0) + shardsEarned;
        }
    } else {
        const card = cardDatabase?.find(c => c.id === cardId);
        const rarity = card?.rarity || "N";
        shardsEarned = count * (SHARD_VALUES[rarity] || 5);
        collection.currency.shards[rarity] = (collection.currency.shards[rarity] || 0) + shardsEarned;
    }
    return { added, shardsEarned };
}

export function removeCard(collection, cardId, count = 1) {
    if (!collection.cards[cardId] || collection.cards[cardId] < count) return false;
    collection.cards[cardId] -= count;
    if (collection.cards[cardId] <= 0) delete collection.cards[cardId];
    return true;
}

export function getCardCount(collection, cardId) {
    return collection.cards[cardId] || 0;
}

export function hasCard(collection, cardId) {
    return (collection.cards[cardId] || 0) > 0;
}

export function getTotalCardCount(collection) {
    return Object.values(collection.cards).reduce((s, n) => s + n, 0);
}

export function enableDemoMode(collection, cardDatabase) {
    collection.settings.demoMode = true;
    collection.currency.duelCoins = 999999;
    for (const card of cardDatabase) {
        if (card.enabled !== false) {
            collection.cards[card.id] = (collection.cards[card.id] || 0) + 3;
        }
    }
}

export function addDuelPoints(collection, amount) {
    if (amount < 0) return;
    collection.currency.duelCoins += amount;
}

export function spendDuelPoints(collection, amount) {
    if (amount < 0 || collection.currency.duelCoins < amount) return false;
    collection.currency.duelCoins -= amount;
    return true;
}

// ---- 碎片系统 ----
export function addShards(collection, rarity, amount) {
    if (amount < 0 || !collection.currency.shards) return;
    collection.currency.shards[rarity] = (collection.currency.shards[rarity] || 0) + amount;
}

export function spendShards(collection, rarity, amount) {
    if (amount < 0 || (collection.currency.shards[rarity] || 0) < amount) return false;
    collection.currency.shards[rarity] -= amount;
    return true;
}

export function getShardCount(collection, rarity) {
    return collection.currency.shards?.[rarity] || 0;
}

// ---- 制作系统 ----
export function canCraft(collection, cardId, cardDatabase) {
    const card = cardDatabase?.find(c => c.id === cardId);
    if (!card) return { canCraft: false, reason: "卡牌不存在" };
    if (getCardCount(collection, cardId) >= MAX_COPIES) {
        return { canCraft: false, reason: `同名卡最多拥有${MAX_COPIES}张` };
    }
    const cost = CRAFT_COSTS[card.rarity] || 20;
    if (getShardCount(collection, card.rarity) < cost) {
        return { canCraft: false, reason: `碎片不足（需要${cost}，当前${getShardCount(collection, card.rarity)}）` };
    }
    return { canCraft: true, cost, rarity: card.rarity };
}

export function craftCard(collection, cardId, cardDatabase) {
    const check = canCraft(collection, cardId, cardDatabase);
    if (!check.canCraft) return { success: false, reason: check.reason };
    spendShards(collection, check.rarity, check.cost);
    addCard(collection, cardId, 1, cardDatabase);
    return { success: true, cost: check.cost };
}

// ---- 分解系统 ----
export function dismantleCard(collection, cardId, cardDatabase) {
    const count = getCardCount(collection, cardId);
    if (count <= 0) return { success: false, reason: "没有该卡牌" };
    const card = cardDatabase?.find(c => c.id === cardId);
    if (!card) return { success: false, reason: "卡牌不存在" };
    const requiredByDeck = Math.max(0, ...(collection.decks || []).map(deck =>
        (deck.main || []).filter(id => id === cardId).length
    ));
    if (count - 1 < requiredByDeck) {
        return { success: false, reason: `卡组最多使用了${requiredByDeck}张，请先从卡组移除` };
    }
    removeCard(collection, cardId, 1);
    const shards = SHARD_VALUES[card.rarity] || 5;
    addShards(collection, card.rarity, shards);
    return { success: true, shards };
}

// ---- 插画系统 ----
export function addArt(collection, artId) {
    if (!artId) return false;
    if (!collection.artCollection) collection.artCollection = {};
    const isNew = !collection.artCollection[artId];
    collection.artCollection[artId] = (collection.artCollection[artId] || 0) + 1;
    return isNew;
}

export function hasArt(collection, artId) {
    return (collection.artCollection?.[artId] || 0) > 0;
}

export function getArtCount(collection, artId) {
    return collection.artCollection?.[artId] || 0;
}

export function setSelectedArt(collection, baseCardId, artId) {
    if (!collection.selectedArtByCard) collection.selectedArtByCard = {};
    collection.selectedArtByCard[baseCardId] = artId;
}

export function getSelectedArt(collection, baseCardId) {
    return collection.selectedArtByCard?.[baseCardId] || null;
}

// ---- 对局奖励一次性领取 ----
export function claimReward(collection, rewardId) {
    if (!collection.claimedRewards) collection.claimedRewards = {};
    if (collection.claimedRewards[rewardId]) return false;
    collection.claimedRewards[rewardId] = Date.now();
    return true;
}

export function hasClaimedReward(collection, rewardId) {
    return !!collection.claimedRewards?.[rewardId];
}

// ---- 保底系统 ----
export function getPityCount(collection, packId) {
    return collection.pityCounters?.[packId]?.packsSinceUR || 0;
}

export function incrementPity(collection, packId) {
    if (!collection.pityCounters) collection.pityCounters = {};
    if (!collection.pityCounters[packId]) collection.pityCounters[packId] = { packsSinceUR: 0 };
    collection.pityCounters[packId].packsSinceUR++;
}

export function resetPity(collection, packId) {
    if (collection.pityCounters?.[packId]) {
        collection.pityCounters[packId].packsSinceUR = 0;
    }
}

export function addPackTicket(collection, amount = 1) {
    // Legacy support - duelCoins only now
}

export function spendPackTicket(collection) {
    return false;
}
