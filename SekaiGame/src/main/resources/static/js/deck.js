/**
 * deck.js - 卡组数据、校验和生成
 */

import { GAME_CONFIG } from "./constants.js";
import { rng } from "./rng.js";
import { createCardInstance } from "./model.js";

export const DECK_RULES = {
    MIN_MAIN: 40,
    MAX_MAIN: 60,
    MAX_COPIES: 3,
    MAX_EXTRA: 15,
    MAX_SIDE: 15,
};

export function getCardCopyLimit(card) {
    if (!card) return DECK_RULES.MAX_COPIES;
    if (Number.isInteger(card.deckLimit)) return Math.max(0, Math.min(DECK_RULES.MAX_COPIES, card.deckLimit));
    if (card.type === "monster" && Math.max(Number(card.attack) || 0, Number(card.defense) || 0) >= 4000) return 1;
    return DECK_RULES.MAX_COPIES;
}

function buildMap(cardDatabase) {
    return new Map(cardDatabase.map(c => [c.id, c]));
}

export function createDeck(id, name, main = [], extra = [], coverCardId = null) {
    return {
        id, name,
        coverCardId: coverCardId || (main.length > 0 ? main[0] : null),
        main: [...main], extra: [...extra], side: [],
        createdAt: Date.now(), updatedAt: Date.now(),
    };
}

export function validateDeck(deck, cardDatabase, collection) {
    const result = { valid: true, errors: [], warnings: [], stats: {} };
    const dbMap = buildMap(cardDatabase);

    if (deck.main.length < DECK_RULES.MIN_MAIN) result.errors.push(`主卡组最少${DECK_RULES.MIN_MAIN}张，当前${deck.main.length}张`);
    if (deck.main.length > DECK_RULES.MAX_MAIN) result.errors.push(`主卡组最多${DECK_RULES.MAX_MAIN}张，当前${deck.main.length}张`);
    if ((deck.extra || []).length > DECK_RULES.MAX_EXTRA) result.errors.push(`额外卡组最多${DECK_RULES.MAX_EXTRA}张`);
    if ((deck.side || []).length > DECK_RULES.MAX_SIDE) result.errors.push(`副卡组最多${DECK_RULES.MAX_SIDE}张`);

    const counts = {};
    for (const id of deck.main) { counts[id] = (counts[id] || 0) + 1; }
    for (const [id, count] of Object.entries(counts)) {
        const card = dbMap.get(id);
        if (!card) { result.errors.push(`${id} 不存在于卡牌数据库`); continue; }
        const copyLimit = getCardCopyLimit(card);
        if (count > copyLimit) result.errors.push(`${card.name}最多只能携带${copyLimit}张`);
        if (card.enabled === false) result.errors.push(`${card.name} 未启用`);
        if (collection && (collection.cards[id] || 0) < count) {
            result.errors.push(`${card.name} 拥有${collection.cards[id] || 0}张，卡组需要${count}张`);
        }
    }

    let monsters = 0, spells = 0, traps = 0;
    let totalAtk = 0, totalDef = 0, monsterCount = 0;
    const attrDist = {}, levelDist = {}, rarityDist = {};
    for (const id of deck.main) {
        const c = dbMap.get(id);
        if (!c) continue;
        if (c.type === "monster") { monsters++; totalAtk += c.attack || 0; totalDef += c.defense || 0; monsterCount++; }
        else if (c.type === "spell") spells++;
        else if (c.type === "trap") traps++;
        attrDist[c.attribute] = (attrDist[c.attribute] || 0) + 1;
        if (c.level) levelDist[c.level] = (levelDist[c.level] || 0) + 1;
        rarityDist[c.rarity] = (rarityDist[c.rarity] || 0) + 1;
    }
    result.stats = {
        total: deck.main.length, monsters, spells, traps,
        attributeDistribution: attrDist, levelDistribution: levelDist, rarityDistribution: rarityDist,
        averageMonsterAttack: monsterCount > 0 ? Math.round(totalAtk / monsterCount) : 0,
        averageMonsterDefense: monsterCount > 0 ? Math.round(totalDef / monsterCount) : 0,
    };

    if (monsters < 10) result.warnings.push("怪兽数量较少");
    if (spells < 3) result.warnings.push("魔法卡较少");
    if (traps < 2) result.warnings.push("陷阱卡较少");

    result.valid = result.errors.length === 0;
    return result;
}

export function createRuntimeDeck(deckDefinition, cardDatabase) {
    const dbMap = buildMap(cardDatabase);
    const runtime = [];
    for (const id of deckDefinition.main) {
        const card = dbMap.get(id);
        if (card && card.enabled !== false) {
            runtime.push(createCardInstance(card));
        }
    }
    return runtime;
}

export function buildSuggestedDeck({ collection, cardDatabase, attribute = null, strategy = "balanced", size = 40 }) {
    const dbMap = buildMap(cardDatabase);
    const available = cardDatabase.filter(c => {
        if (c.enabled === false) return false;
        if (attribute && c.attribute !== attribute && c.type === "monster") return false;
        return (collection.cards[c.id] || 0) > 0;
    });

    const monsters = available.filter(c => c.type === "monster");
    const spells = available.filter(c => c.type === "spell");
    const traps = available.filter(c => c.type === "trap");

    const deck = [];
    const deckCounts = {};
    const maxCopies = Math.min(DECK_RULES.MAX_COPIES, 3);

    function addToDeck(card) {
        deckCounts[card.id] = (deckCounts[card.id] || 0) + 1;
        if (deckCounts[card.id] <= maxCopies) { deck.push(card.id); return true; }
        return false;
    }

    let monsterTarget, spellTarget, trapTarget;
    switch (strategy) {
        case "aggressive": monsterTarget = 26; spellTarget = 9; trapTarget = 5; break;
        case "defensive": monsterTarget = 22; spellTarget = 8; trapTarget = 10; break;
        case "control": monsterTarget = 23; spellTarget = 10; trapTarget = 7; break;
        default: monsterTarget = 24; spellTarget = 9; trapTarget = 7;
    }

    const sortedMonsters = [...monsters].sort((a, b) => (b.attack || 0) - (a.attack || 0));
    for (const m of sortedMonsters) { if (deck.length >= monsterTarget) break; addToDeck(m); }

    // 如果有魔法卡才添加
    if (spells.length > 0) {
        let currentSpellCount = deck.filter(id => dbMap.get(id)?.type === "spell").length;
        const sortedSpells = [...spells].sort((a, b) => (b.rarity === "SSR" ? 2 : b.rarity === "SR" ? 1 : 0) - (a.rarity === "SSR" ? 2 : a.rarity === "SR" ? 1 : 0));
        for (const s of sortedSpells) { if (currentSpellCount >= spellTarget) break; if (addToDeck(s)) currentSpellCount++; }
    }

    // 如果有陷阱卡才添加
    if (traps.length > 0) {
        let currentTrapCount = deck.filter(id => dbMap.get(id)?.type === "trap").length;
        const sortedTraps = [...traps].sort((a, b) => (b.rarity === "SSR" ? 2 : b.rarity === "SR" ? 1 : 0) - (a.rarity === "SSR" ? 2 : a.rarity === "SR" ? 1 : 0));
        for (const t of sortedTraps) { if (currentTrapCount >= trapTarget) break; if (addToDeck(t)) currentTrapCount++; }
    }

    while (deck.length < size && available.length > 0) {
        const before = deck.length;
        const card = rng.pick(available);
        addToDeck(card);
        if (deck.length === before) break; // 无法添加更多卡牌
    }

    return rng.shuffle(deck).slice(0, size);
}
