import { ALL_CARDS } from "./catalog.js?v=1.8.4";

const RARITY_VALUE = { N: 1, R: 2, SR: 3, SSR: 4, UR: 5 };
const THEMES = [
    { key: "starter", name: "基础攻防", opponent: "见习决斗者", attributes: [], effects: ["buffSelfAttack", "drawCards", "destroyTarget"] },
    { key: "flame", name: "烈焰强袭", opponent: "炎狱斗士", attributes: ["fire"], effects: ["directDamage", "doubleAttack", "damageAllEnemyMonsters"] },
    { key: "ocean", name: "潮汐控制", opponent: "深海司祭", attributes: ["water"], effects: ["debuffEnemyAttack", "returnToHand", "freezeAll"] },
    { key: "storm", name: "疾风连击", opponent: "岚之剑士", attributes: ["wind"], effects: ["doubleAttack", "groupDraw", "returnMultiple"] },
    { key: "earth", name: "大地壁垒", opponent: "岩铠守门人", attributes: ["earth"], effects: ["buffSelfDefense", "protectAllies", "reduceDamage"] },
    { key: "radiance", name: "辉光共鸣", opponent: "星辉奏者", attributes: ["light"], effects: ["healPlayer", "reviveRecentGraveyard", "groupBuff"] },
    { key: "abyss", name: "暗渊处刑", opponent: "深渊执刑官", attributes: ["dark"], effects: ["temporaryBanish", "banishEnemyGraveyard", "destroyWeakest"] },
    { key: "backrow", name: "秘术封锁", opponent: "机关策士", attributes: [], effects: ["destroySpellTrap", "destroyAllEnemySpellTraps", "counterDestroy"] },
    { key: "resonance", name: "次元共鸣", opponent: "共鸣指挥家", attributes: ["light", "dark"], effects: ["tokenSummon", "reviveRecentGraveyard", "groupDraw"] },
    { key: "finale", name: "终焉王座", opponent: "终焉决斗王", attributes: [], effects: ["freezeAll", "destroyAllEnemySpellTraps", "damageAllEnemyMonsters", "lockAttack"] },
];

const CHAPTERS = [
    { name: "启程篇", difficulty: "easy", rarities: ["N", "R"], skill: 1 },
    { name: "进阶篇", difficulty: "normal", rarities: ["N", "R", "SR"], skill: 2 },
    { name: "精英篇", difficulty: "hard", rarities: ["R", "SR", "SSR"], skill: 3 },
    { name: "大师篇", difficulty: "expert", rarities: ["SR", "SSR", "UR"], skill: 4 },
    { name: "极限篇", difficulty: "nightmare", rarities: ["N", "R", "SR", "SSR", "UR"], skill: 5 },
];

export const AI_STAGES = Array.from({ length: 50 }, (_, index) => {
    const order = index + 1;
    const chapterIndex = Math.floor(index / 10);
    const theme = THEMES[index % THEMES.length];
    const chapter = CHAPTERS[chapterIndex];
    const withinChapter = index % 10;
    const power = Math.min(1, 0.18 + index * 0.0165);
    return {
        id: `stage_${order}`,
        order,
        chapter: chapter.name,
        name: `${chapter.name}·${theme.name}`,
        opponent: chapterIndex === 4 ? `${theme.opponent}·极` : theme.opponent,
        theme: theme.key,
        themeAttributes: theme.attributes,
        themeEffects: theme.effects,
        difficulty: chapter.difficulty,
        reward: 250 + order * 55 + (withinChapter === 9 ? 500 : 0),
        rarities: chapter.rarities,
        power,
        maxLevel: Math.min(12, 4 + chapterIndex * 2 + Math.floor(withinChapter / 3)),
        bossCount: Math.min(7, chapterIndex + Math.floor(withinChapter / 4)),
        ai: {
            skill: Number((1 + index * 4 / 49).toFixed(2)),
            maxMainActions: 3 + chapter.skill * 2,
            lookahead: Math.max(1, chapter.skill - 1),
            bluff: chapter.skill >= 3,
            conserveRemoval: chapter.skill >= 3,
            lethalSearch: chapter.skill >= 4,
        },
    };
});

function effectTypes(card) {
    return (card.effects || []).map(effect => effect.type).filter(Boolean);
}

export function scoreCardForStage(card, stage) {
    const rarity = RARITY_VALUE[card.rarity] || 1;
    const effects = effectTypes(card);
    const themeMatches = effects.filter(type => stage.themeEffects?.includes(type)).length;
    const attributeMatch = stage.themeAttributes?.includes(card.attribute) ? 1 : 0;
    const priority = Number(card.aiHints?.priority || 0);
    if (card.type === "monster") {
        const level = Number(card.level || 1);
        const stats = Number(card.attack || 0) + Number(card.defense || 0) * 0.38;
        const summonCurve = level <= 4 ? 360 : level <= 6 ? 180 : -level * 42;
        return stats + effects.length * 290 + themeMatches * 520 + attributeMatch * 300
            + rarity * 120 + priority * 90 + summonCurve;
    }
    return 900 + effects.length * 390 + themeMatches * 600 + attributeMatch * 180
        + rarity * 150 + priority * 120;
}

function rankedPool(pool, stage) {
    return [...pool].sort((a, b) => {
        const delta = scoreCardForStage(b, stage) - scoreCardForStage(a, stage);
        return delta || String(a.id).localeCompare(String(b.id));
    });
}

function selectCopies(pool, count, stage, copies, maxCopies = 3) {
    const ranked = rankedPool(pool, stage);
    if (!ranked.length || count <= 0) return [];
    const windowSize = Math.min(ranked.length, Math.max(7, Math.ceil(count * (0.75 - stage.power * 0.35))));
    const isThemed = card => stage.themeAttributes?.includes(card.attribute)
        || effectTypes(card).some(type => stage.themeEffects?.includes(type));
    const themed = ranked.filter(isThemed);
    const other = ranked.filter(card => !isThemed(card));
    const themeSlots = Math.min(themed.length, Math.max(3, Math.ceil(windowSize * 0.55)));
    const takeBand = (cards, amount) => {
        const start = Math.floor(Math.max(0, cards.length - amount) * (1 - stage.power) * 0.72);
        return cards.slice(start, start + amount);
    };
    const candidates = [...takeBand(themed, themeSlots), ...takeBand(other, windowSize - themeSlots)];
    const selected = [];
    let cursor = 0;
    let guard = 0;
    while (selected.length < count && guard++ < candidates.length * maxCopies * 3) {
        const card = candidates[cursor++ % candidates.length];
        const used = copies.get(card.id) || 0;
        if (used >= maxCopies) continue;
        selected.push(card);
        copies.set(card.id, used + 1);
    }
    return selected;
}

export function buildStageDeck(stage) {
    const enabled = ALL_CARDS.filter(card => card.enabled !== false && stage.rarities.includes(card.rarity));
    const monsterPool = enabled.filter(card => card.type === "monster" && Number(card.level || 0) <= stage.maxLevel);
    const lowLevel = monsterPool.filter(card => Number(card.level || 0) <= 4);
    const midLevel = monsterPool.filter(card => Number(card.level || 0) >= 5 && Number(card.level || 0) <= 6);
    const highLevel = monsterPool.filter(card => Number(card.level || 0) >= 7);
    const copies = new Map();
    const bossCount = Math.min(stage.bossCount || 0, highLevel.length ? 7 : 0);
    const midCount = Math.min(5, Math.max(2, Math.floor(stage.order / 12) + 2));
    const monsters = [
        ...selectCopies(lowLevel, 20 - bossCount - midCount, stage, copies),
        ...selectCopies(midLevel.length ? midLevel : lowLevel, midCount, stage, copies),
        ...selectCopies(highLevel, bossCount, stage, copies),
    ];
    const spells = selectCopies(enabled.filter(card => card.type === "spell"), 12, stage, copies);
    const traps = selectCopies(enabled.filter(card => card.type === "trap"), 8, stage, copies);
    const main = [...monsters, ...spells, ...traps].map(card => card.id);

    if (main.length < 40) {
        selectCopies(enabled, 40 - main.length, stage, copies).forEach(card => main.push(card.id));
    }
    return {
        id: `${stage.id}_deck`,
        name: `${stage.opponent}卡组`,
        coverCardId: rankedPool(monsters, stage)[0]?.id || main[0],
        main: main.slice(0, 40),
        extra: [],
        theme: stage.theme,
    };
}

export function evaluateStageDeck(stage, deck = buildStageDeck(stage)) {
    const cards = deck.main.map(id => ALL_CARDS.find(card => card.id === id)).filter(Boolean);
    const monsters = cards.filter(card => card.type === "monster");
    const lowLevel = monsters.filter(card => Number(card.level || 0) <= 4).length;
    const themed = cards.filter(card => effectTypes(card).some(type => stage.themeEffects?.includes(type))
        || stage.themeAttributes?.includes(card.attribute)).length;
    const averageScore = cards.reduce((sum, card) => sum + scoreCardForStage(card, stage), 0) / Math.max(1, cards.length);
    return {
        size: cards.length,
        monsters: monsters.length,
        spells: cards.filter(card => card.type === "spell").length,
        traps: cards.filter(card => card.type === "trap").length,
        lowLevel,
        themed,
        synergy: themed / Math.max(1, cards.length),
        averageScore: Math.round(averageScore),
    };
}

export function isStageUnlocked(collection, stage) {
    if (stage.order === 1) return true;
    return Boolean(collection.stageProgress?.[AI_STAGES[stage.order - 2].id]?.cleared);
}
