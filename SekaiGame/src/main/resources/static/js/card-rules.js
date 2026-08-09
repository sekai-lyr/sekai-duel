// The compact rule layer used by every card source in the published client.
import { designRarityRules } from "./rarity-rules.js?v=1.3.2";
const effect = (type, value, description, target) => ({ trigger: "manual", type, value, ...(target ? { target } : {}), description });
const ENEMY_BEST = { owner: "opponent", zone: "monster", selector: "highestAttack", count: 1 };
const ENEMY_WEAKEST = { owner: "opponent", zone: "monster", selector: "lowestAttack", count: 1 };
const ALL_ENEMY_MONSTERS = { owner: "opponent", zone: "monster", selector: "all" };

export function minimumMonsterStatTotal(card) {
    const level = Math.max(1, Math.min(10, Number(card?.level) || 1));
    const curves = {
        R: [1700, 320],
        SR: [2050, 390],
        SSR: [2450, 430],
        UR: [3000, 480],
    };
    const [base, perLevel] = curves[card?.rarity] || [1400, 280];
    return base + level * perLevel;
}

function balanceMonsterStats(card) {
    if (card?.type !== "monster" || card?.rarity === "N") return card;
    const currentAttack = Math.max(0, Number(card.attack) || 0);
    const currentDefense = Math.max(0, Number(card.defense) || 0);
    const currentTotal = currentAttack + currentDefense;
    const targetTotal = Math.max(currentTotal, minimumMonsterStatTotal(card));
    if (targetTotal === currentTotal) return card;
    const attackRatio = currentTotal > 0 ? Math.min(.68, Math.max(.38, currentAttack / currentTotal)) : .52;
    const attack = Math.round(targetTotal * attackRatio / 10) * 10;
    return { ...card, attack, defense: targetTotal - attack };
}

const CARD_RULES = {
    water_007: { trigger: "onSummon", type: "buffSelfDefense", value: 300, description: "召唤成功时：自身守备力+300。" },
    water_008: { trigger: "onSummon", type: "debuffEnemyAttack", value: 400, description: "召唤成功时：对方攻击力最低的1只怪兽攻击力-400。" },
    water_009: { trigger: "onSummon", type: "healPlayer", value: 700, description: "召唤成功时：回复700LP。" },
    water_010: { trigger: "onSummon", type: "buffSelfAttack", value: 600, description: "召唤成功时：自身攻击力+600。" },
    water_011: { trigger: "onSummon", type: "drawCards", value: 1, description: "召唤成功时：抽1张卡。" },
    dark_006: { trigger: "onSummon", type: "returnToHand", value: 0, target: ENEMY_BEST, description: "召唤成功时：将对方攻击力最高的1只怪兽返回手牌。" },

    nc_sp_ur_001: effect("drawCards", 2, "抽2张卡。"),
    nc_sp_ur_002: effect("buffAllAlliesAttack", 800, "己方场上全部怪兽攻击力+800。"),
    nc_sp_ur_003: effect("temporaryBanish", 0, "选择对方攻击力最高的1只怪兽：将其暂时除外，回合结束时返回场上。"),
    nc_sp_ur_004: effect("healPlayer", 1800, "回复1800LP。"),
    nc_sp_ur_005: effect("destroyTarget", 0, "破坏对方场上1只怪兽。", ENEMY_BEST),
    nc_sp_ur_006: effect("directDamage", 1200, "给予对方1200点伤害。"),
    nc_sp_ur_007: effect("damageAllEnemyMonsters", 700, "对方场上全部怪兽守备力-700；守备力变为0的怪兽破坏。"),
    nc_sp_ur_008: effect("damageAndHeal", 900, "选择对方1只怪兽：其守备力-900；自己回复实际减少的数值。"),
    nc_sp_ur_009: effect("reviveToHand", 0, "选择己方墓地1只怪兽加入手牌。"),
    nc_sp_ur_010: effect("gameThroneDraw", 2, "抽2张卡；若其中同时有怪兽与魔法，再抽1张卡。本回合不能进行战斗。"),
    nc_sp_ur_011: [{ trigger: "field", type: "fieldOceanScene", value: 450, description: "场地魔法：己方水属性怪兽攻击力与守备力+450；对方守备表示时需弃1张手牌。" }],
    nc_sp_ur_012: effect("debuffAllEnemyAttack", 800, "对方场上全部怪兽攻击力-800。"),

    nc_sp_ss_001: effect("damageBothPlayers", 500, "双方各受到500点伤害。"),
    nc_sp_ss_002: effect("healPlayer", 1400, "回复1400LP。"),
    nc_sp_ss_003: effect("recycleSpellDraw", 1, "将己方墓地1张魔法卡放回卡组顶端，然后抽1张卡。"),
    nc_sp_ss_004: effect("temporaryBanish", 0, "选择对方攻击力最高的1只怪兽：将其暂时除外，回合结束时返回场上。"),
    nc_sp_ss_005: { trigger: "manual", type: "recycleAndDraw", owner: "self", description: "将己方所有手牌送入墓地，然后抽取相同数量的卡。" },
    nc_sp_ss_006: effect("searchWaterMonster", 4, "从卡组将1只4级以下水属性怪兽加入手牌。"),

    nc_tr_001: { trigger: "onAttacked", type: "cannotAttack", value: 0, description: "对方攻击宣言时发动：那次攻击无效，对方怪兽本回合不能攻击。" },
    nc_tr_002: { trigger: "onAttacked", type: "reduceDamage", value: 1800, description: "对方攻击宣言时发动：本次战斗伤害减少1800。" },
    nc_tr_003: { trigger: "onAttacked", type: "returnToHand", value: 0, description: "对方攻击宣言时发动：攻击怪兽返回手牌，那次攻击无效。" },
    nc_tr_004: { trigger: "onAttacked", type: "reflectDamage", value: 0, description: "对方攻击宣言时发动：那次攻击无效，并给予攻击方等同攻击力的伤害。" },
    nc_tr_005: { trigger: "onAttacked", type: "destroyAttacker", value: 0, description: "对方攻击宣言时发动：破坏攻击怪兽，那次攻击无效。" },
};

function galleryEffect(card) {
    if (!card.id?.startsWith("gallery_")) return null;

    const serial = Number(card.id.match(/(\d+)$/)?.[1] || 0);
    const name = card.name || "";
    const draw = serial % 3 === 0 ? 2 : 1;
    const boost = 250 + (serial % 4) * 100;
    const damage = 450 + (serial % 4) * 150;

    if (/盟约|誓约|羁绊|契/.test(name)) {
        return [
            effect("searchDeck", 0, "从卡组检索1只怪兽加入手牌。", { filters: { type: "monster" } }),
            effect("tokenSummon", 600 + (serial % 3) * 100, "特殊召唤1只誓约衍生物。"),
            effect("buffAllAlliesAttack", boost, `己方场上怪兽攻击力上升${boost}。`),
        ];
    }
    if (/夜|月|星|黄昏|晖|彼岸|梦/.test(name)) {
        return [
            effect("drawCards", draw, `抽${draw}张卡。`),
            effect("lockAttack", 1, "封锁对方攻击力最高的1只怪兽本回合的攻击。", ENEMY_BEST),
            effect("temporaryBanish", 0, "将对方攻击力最低的1只怪兽暂时除外，回合结束时返回。", ENEMY_WEAKEST),
        ];
    }
    if (/海|雨|雪|风|蓝|涟|浮汐|湖/.test(name)) {
        return [
            effect("returnToHand", 0, "将对方攻击力最高的1只怪兽返回手牌。", ENEMY_BEST),
            effect("debuffAllEnemyAttack", boost, `对方场上全部怪兽攻击力下降${boost}。`),
            effect("drawCards", 1, "抽1张卡。"),
        ];
    }
    if (/刃|焰|血|邪|弑|逃|墟|碎/.test(name)) {
        return [
            effect("directDamage", damage, `给予对方${damage}点LP伤害。`),
            effect("destroyTarget", 0, "选择并破坏对方1只怪兽。", ENEMY_BEST),
            effect("discardCards", 1, "对方随机丢弃1张手牌。"),
        ];
    }
    if (/青春|校|乐|奏|舞|日常|邀约|相识|花/.test(name)) {
        return [
            effect("healPlayer", 700 + boost, `回复${700 + boost}LP。`),
            effect("tokenSummon", 500 + (serial % 3) * 100, "特殊召唤1只伙伴衍生物。"),
            effect("buffAllAlliesAttack", 300 + (serial % 3) * 100, "伙伴合奏：己方场上全部怪兽攻击力上升。"),
        ];
    }
    if (/恋|爱|情|婚|女友|相守|心/.test(name)) {
        return [
            effect("healPlayer", 1000 + boost, `回复${1000 + boost}LP。`),
            effect("buffAllAlliesAttack", boost, `己方场上全部怪兽攻击力上升${boost}。`),
            effect("cannotBeAttacked", 0, "己方全部怪兽本回合不会被战斗破坏。", { owner: "self", zone: "monster", selector: "all" }),
        ];
    }
    const patterns = [
        [effect("drawCards", 1, "抽1张卡。"), effect("searchDeck", 0, "从卡组检索1张魔法卡加入手牌。", { filters: { type: "spell" } })],
        [effect("damageAllEnemyMonsters", damage, `对方全部怪兽守备力下降${damage}，守备力变为0则破坏。`), effect("healPlayer", boost, `回复${boost}LP。`)],
        [effect("temporaryBanish", 0, "暂时除外对方攻击力最高的1只怪兽。", ENEMY_BEST), effect("drawCards", draw, `抽${draw}张卡。`)],
        [effect("tokenSummon", 700, "特殊召唤1只衍生物。"), effect("buffAllAlliesAttack", boost, `己方场上怪兽攻击力上升${boost}。`)],
        [effect("discardCards", 1, "对方随机丢弃1张手牌。"), effect("lockAttack", 1, "封锁对方攻击力最高的1只怪兽本回合攻击。", ENEMY_BEST)],
        [effect("returnToHand", 0, "将对方攻击力最低的1只怪兽返回手牌。", ENEMY_WEAKEST), effect("buffAllAlliesAttack", boost, `己方场上怪兽攻击力上升${boost}。`)],
    ];
    return patterns[serial % patterns.length];
}

function fallbackEffect(card) {
    const stat = ({ N: 200, R: 300, SR: 450, SSR: 600, UR: 800 }[card.rarity] || 200);
    const number = Number(card.id?.match(/(\d+)$/)?.[1] || 0);
    const name = card.name || "";
    if (card.type === "monster") {
        if (/雨|雪|寒|蓝/.test(name)) return { trigger: "onSummon", type: "buffSelfDefense", value: stat, description: `召唤成功时：自身守备力+${stat}。` };
        if (/奏|歌|舞|音/.test(name)) return { trigger: "onSummon", type: "drawCards", value: 1, description: "召唤成功时：抽1张卡。" };
        if (/真冬|妆|凯伊/.test(name)) return { trigger: "onSummon", type: "debuffEnemyAttack", value: stat, description: `召唤成功时：对方攻击力最高的怪兽攻击力-${stat}。` };
        return { trigger: "onSummon", type: "buffSelfAttack", value: stat + (number % 3) * 100, description: `召唤成功时：自身攻击力+${stat + (number % 3) * 100}。` };
    }
    if (card.type === "trap") {
        const trapTypes = ["reduceDamage", "returnToHand", "reflectDamage", "destroyAttacker", "cannotAttack"];
        const type = trapTypes[Number(card.id?.match(/(\d+)$/)?.[1] || 0) % trapTypes.length];
        const heal = ({ N: 500, R: 700, SR: 1000, SSR: 1400, UR: 1800 }[card.rarity] || 500);
        return { trigger: "onAttacked", type, value: type === "reduceDamage" ? heal : 0, description: "对方攻击宣言时发动：化解这次攻击。" };
    }
    const heal = ({ N: 500, R: 700, SR: 1000, SSR: 1400, UR: 1800 }[card.rarity] || 500);
    const damage = ({ N: 300, R: 500, SR: 700, SSR: 900, UR: 1200 }[card.rarity] || 300);
    const draw = ({ N: 1, R: 1, SR: 1, SSR: 2, UR: 2 }[card.rarity] || 1);
    if (/月|夜|星|梦|信|忆/.test(name)) return [effect("drawCards", draw, `抽${draw}张卡。`), effect("lockAttack", 1, "对方攻击力最高的怪兽直到回合结束不能攻击。")];
    if (/雨|雪|寒|暮|蓝海|浅海/.test(name)) return effect("debuffAllEnemyAttack", stat, `对方场上全部怪兽攻击力-${stat}。`);
    if (/茶|花|暖|友|伴|爱|恋/.test(name)) return [effect("healPlayer", heal + (number % 3) * 100, `恢复${heal + (number % 3) * 100}LP。`), effect("buffAllAlliesAttack", stat, `己方怪兽攻击力+${stat}。`)];
    if (/刃|火|弑|碎|邪眼/.test(name)) return [effect("directDamage", damage + (number % 3) * 100, `给予对方${damage + (number % 3) * 100}点伤害。`), effect("debuffAllEnemyAttack", stat, `对方全体攻击力-${stat}。`)];
    return effect("buffAllAlliesAttack", stat + (number % 3) * 100, `己方场上全部怪兽攻击力+${stat + (number % 3) * 100}。`);
}

export function applyPlayableRules(card) {
    if (!card) return card;
    const normalized = balanceMonsterStats({ ...card, enabled: card.enabled !== false });
    if (normalized.series === "starter_ygo") {
        normalized.effects = Array.isArray(card.effects) ? card.effects : [];
        normalized.description = normalized.effects
            .map(item => item?.description)
            .filter(Boolean)
            .join("\n");
        if (!normalized.description && normalized.type === "monster") {
            normalized.description = "通常怪兽：没有额外卡牌效果。";
        }
        return normalized;
    }
    const designed = designRarityRules(normalized);
    if (designed) {
        Object.assign(normalized, designed);
        return normalized;
    }
    // 有CARD_RULES定义的优先用CARD_RULES，否则保留原始效果
    if (CARD_RULES[normalized.id]) {
        const chosen = CARD_RULES[normalized.id];
        normalized.effects = Array.isArray(chosen) ? chosen : [chosen];
        normalized.description = normalized.effects.map(item => item.description).filter(Boolean).join("\n");
    } else if (!Array.isArray(card.effects) || card.effects.length === 0) {
        const chosen = galleryEffect(normalized) || fallbackEffect(normalized);
        normalized.effects = Array.isArray(chosen) ? chosen : [chosen];
        normalized.description = normalized.effects.map(item => item.description).filter(Boolean).join("\n");
    }
    return normalized;
}

export function normalizeCardPool(cards) {
    return cards.map(applyPlayableRules);
}
