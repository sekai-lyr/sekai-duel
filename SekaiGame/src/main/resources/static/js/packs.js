/**
 * packs.js - 卡包配置与抽取逻辑
 * 支持：Nightcord主题卡包、8张/十连80张、保底、UR保底
 */

import { rng } from "./rng.js";
import { ANIME_CARDS } from "./nightcord-cards.js";

export const PACK_RATES = {
    N: 0.62, R: 0.25, SR: 0.09, SSR: 0.035, UR: 0.005,
};

export const PACK_GUARANTEE = {
    perPack: { minRarity: "R", position: 7 },
    tenPack: { minRarity: "SR" },
};

export const NIGHTCORD_PACK = {
    id: "nightcord_pack_001",
    name: "25时，Nightcord",
    description: "包含当前全部可用卡牌。单包1000决斗币8张，十连9000决斗币80张。",
    cost: { duelCoins: 1000 },
    tenCost: { duelCoins: 9000 },
    cardsPerPack: 8,
    image: "",
};

export const PACK_DEFINITIONS = [
    NIGHTCORD_PACK,
    { id: "standard_pack_001", name: "元素觉醒", description: "包含六种属性的基础卡牌。", image: "./assets/packs/standard_pack_001.webp", cardsPerPack: 5, cost: { duelPoints: 100 }, pool: { types: ["monster", "spell", "trap"] } },
];

export function getPackPool(packDef, cardDatabase) {
    let pool = cardDatabase.filter(c => c.enabled !== false
        && c.series !== "starter_n"
        && c.series !== "starter_ygo");
    if (packDef.series) {
        pool = pool.filter(c => c.series === packDef.series);
    }
    if (packDef.pool?.attribute) pool = pool.filter(c => c.attribute === packDef.pool.attribute);
    if (packDef.pool?.types?.length) pool = pool.filter(c => packDef.pool.types.includes(c.type));
    return pool;
}

export function getEffectiveRates(pityCount) {
    if (pityCount >= 100) return { N: 0, R: 0, SR: 0, SSR: 0, UR: 1.0 };
    if (pityCount >= 70) {
        const bonus = (pityCount - 69) * 0.0332;
        return {
            N: Math.max(0, PACK_RATES.N - bonus * 0.62),
            R: Math.max(0, PACK_RATES.R - bonus * 0.25),
            SR: Math.max(0, PACK_RATES.SR - bonus * 0.09),
            SSR: Math.max(0, PACK_RATES.SSR - bonus * 0.035),
            UR: Math.min(1, PACK_RATES.UR + bonus),
        };
    }
    return { ...PACK_RATES };
}

export function openPack(packDef, cardDatabase, randomSource = rng, pityCount = 0) {
    const pool = getPackPool(packDef, cardDatabase);
    if (pool.length === 0) return { success: false, reason: "卡池为空" };

    const results = [];
    const cardsPerPack = packDef.cardsPerPack || 8;
    const rates = getEffectiveRates(pityCount);

    for (let i = 0; i < cardsPerPack; i++) {
        let rarity = randomSource.weightedPick([
            { value: "N", weight: rates.N },
            { value: "R", weight: rates.R },
            { value: "SR", weight: rates.SR },
            { value: "SSR", weight: rates.SSR },
            { value: "UR", weight: rates.UR },
        ]);
        // 保底：第8张至少SR
        if (i === cardsPerPack - 1 && rarity === "N") rarity = "R";

        const rarityPool = pool.filter(c => c.rarity === rarity);
        if (rarityPool.length > 0) {
            results.push({ ...randomSource.pick(rarityPool) });
        } else {
            results.push({ ...randomSource.pick(pool) });
        }
    }
    return { success: true, cards: results };
}

export function openTenPacks(packDef, cardDatabase, randomSource = rng, pityCount = 0) {
    const allCards = [];
    let hasSSR = false;
    let packsSinceUR = pityCount;

    for (let i = 0; i < 10; i++) {
        const pCount = packsSinceUR;
        const result = openPack(packDef, cardDatabase, randomSource, pCount);
        if (!result.success) return result;
        allCards.push(...result.cards);

        // Track UR
        const hasUR = result.cards.some(c => c.rarity === "UR");
        if (hasUR) {
            packsSinceUR = 0;
        } else {
            packsSinceUR++;
        }

        if (result.cards.some(c => c.rarity === "SSR" || c.rarity === "UR")) hasSSR = true;
    }

    // 十连保底：至少一张SSR或UR
    if (!allCards.some(c => ["SR", "SSR", "UR"].includes(c.rarity)) && allCards.length > 0) {
        const srPool = getPackPool(packDef, cardDatabase).filter(c => ["SR", "SSR", "UR"].includes(c.rarity));
        if (srPool.length > 0) {
            const guaranteed = { ...randomSource.pick(srPool) };
            const idx = allCards.findIndex(c => c.rarity === "N" || c.rarity === "R" || c.rarity === "SR");
            if (idx >= 0) allCards[idx] = guaranteed;
            else allCards[allCards.length - 1] = guaranteed;
        }
    }

    return { success: true, cards: allCards, packsSinceUR };
}

// ---- 保底计算 ----
export function calculatePity(packsSinceUR, gotUR) {
    if (gotUR) return 0;
    return packsSinceUR + 1;
}

export function shouldGuaranteeUR(packsSinceUR) {
    return packsSinceUR >= 100;
}
