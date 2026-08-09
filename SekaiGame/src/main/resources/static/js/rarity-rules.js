import { getMonsterCinematicProfile } from "./monster-cinematics.js?v=1.2.0";

const ENEMY_HIGH = { owner: "opponent", zone: "monster", selector: "highestAttack", count: 1 };
const ENEMY_LOW = { owner: "opponent", zone: "monster", selector: "lowestAttack", count: 1 };
const SELF_HIGH = { owner: "self", zone: "monster", selector: "highestAttack", count: 1 };

const BUDGETS = {
    N: { stat: 200, damage: 300, heal: 400, count: 1 },
    R: { stat: 350, damage: 500, heal: 650, count: 1 },
    SR: { stat: 550, damage: 750, heal: 950, count: 2 },
    SSR: { stat: 800, damage: 1050, heal: 1400, count: 2 },
    UR: { stat: 1100, damage: 1500, heal: 2000, count: 2 },
};
const USED_MONSTER_PROTOCOLS = new Set();
const USED_ANIME_SKILL_SETS = new Set();
const USED_CHARACTER_EFFECT_SETS = new Set();

function seedCard(card) {
    let seed = 2166136261;
    for (const char of `${card.id}|${card.name}`) {
        seed ^= char.charCodeAt(0);
        seed = Math.imul(seed, 16777619);
    }
    return seed >>> 0;
}

function rule(trigger, type, value, description, target) {
    return { trigger, type, value, ...(target ? { target } : {}), description };
}

function monsterPowerTier(card) {
    const rarityRank = { N: 0, R: 1, SR: 2, SSR: 3, UR: 4 }[card.rarity] ?? 1;
    const level = Math.max(1, Number(card.level) || 1);
    return Math.min(7, rarityRank + Math.floor((level - 1) / 3));
}

function balancedMonsterBudget(card) {
    const base = BUDGETS[card.rarity] || BUDGETS.R;
    const level = Math.max(1, Math.min(10, Number(card.level) || 1));
    const levelFactor = .72 + level * .07;
    return {
        stat: Math.round(base.stat * levelFactor),
        damage: Math.round(base.damage * levelFactor),
        heal: Math.round(base.heal * levelFactor),
        count: base.count,
    };
}

function balanceCharacterEffect(effect, card, budget) {
    const tier = monsterPowerTier(card);
    const level = Math.max(1, Number(card.level) || 1);
    let balanced = { ...effect };
    if (balanced.type === "destroyAllEnemySpellTraps" && tier < 5) balanced = { ...balanced, type: "destroySpellTrap", value: 1 };
    if (balanced.type === "returnMultiple" && tier < 4) balanced = { ...balanced, type: "returnToHand", value: 1, target: ENEMY_LOW };
    if (balanced.type === "freezeAll" && tier < 4) balanced = { ...balanced, type: "debuffAllEnemyAttack", value: Math.round(budget.stat * .5) };
    if (balanced.type === "temporaryBanish" && tier < 3) balanced = { ...balanced, type: "lockAttack", value: 1, target: ENEMY_HIGH };
    if (balanced.type === "doubleAttack" && tier < 3) balanced = { ...balanced, trigger: "onSummon", type: "buffSelfAttack", value: budget.stat };
    if (balanced.type === "destroyWeakest" && tier < 3) balanced = { ...balanced, type: "debuffEnemyAttack", value: budget.stat, target: ENEMY_LOW };
    if (balanced.type === "reviveRecentGraveyard" && tier < 3) balanced = { ...balanced, type: "drawCards", value: 1 };
    if (balanced.type === "protectAllies" && tier < 3) balanced = { ...balanced, type: "targetProtect", value: 1, target: SELF_HIGH };
    if (tier >= 7 && balanced.type === "destroySpellTrap") balanced = { ...balanced, type: "destroyAllEnemySpellTraps", value: 0 };
    if (tier >= 6 && balanced.type === "returnToHand") balanced = { ...balanced, type: "returnMultiple", value: 2 };
    if (balanced.type === "destroySpellTrap") balanced.value = tier >= 5 ? 2 : 1;
    if (balanced.type === "returnMultiple") balanced.value = tier >= 7 ? 3 : 2;
    if (balanced.type === "banishEnemyGraveyard") balanced.value = tier >= 6 ? 3 : tier >= 4 ? 2 : 1;
    if (balanced.type === "groupDraw" || balanced.type === "drawCards") balanced.value = tier >= 7 ? 2 : Math.max(1, balanced.value || 1);
    if (balanced.type === "tokenSummon") balanced.value = Math.max(balanced.value || 0, 350 + tier * 140 + level * 25);
    if (balanced.type === "doubleAttack") {
        const lifeCost = { 3: 1000, 4: 700, 5: 500, 6: 300 }[tier];
        if (lifeCost) balanced.cost = { type: "payLife", value: lifeCost };
        balanced.oncePerTurn = true;
    }
    if (balanced.type === "recycleSpellDraw") {
        if (tier <= 4) balanced.cost = { type: "discard", value: 1 };
        balanced.oncePerTurn = true;
    }
    if (balanced.type === "destroyWeakest" && tier === 3) {
        balanced.condition = { opponentMinMonsterCount: 2 };
        balanced.conditionText = "对方场上至少有2只怪兽";
    }
    if (balanced.type === "destroyAllEnemySpellTraps" && tier === 5) {
        balanced.condition = { opponentMinSpellTrapCount: 2 };
        balanced.conditionText = "对方场上至少有2张魔法或陷阱卡";
    }
    balanced.skillPower = tier;
    return balanced;
}

function plainRuleDescription(effect) {
    const trigger = effect.trigger === "onSummon"
        ? "召唤成功时"
        : effect.trigger === "onDestroyed"
            ? "被破坏时"
            : effect.trigger === "onAttacked"
                ? "对方怪兽攻击时"
                : "发动时";
    const value = Number(effect.value || 0);
    const texts = {
        buffSelfAttack: `这张卡攻击力增加${value}。`,
        buffSelfDefense: `这张卡守备力增加${value}。`,
        debuffEnemyAttack: `对方攻击力最高的怪兽攻击力减少${value}。`,
        debuffEnemyDefense: `对方攻击力最高的怪兽守备力减少${value}；守备力变为0则破坏。`,
        debuffAllEnemyAttack: `对方全部怪兽攻击力减少${value}。`,
        damageAllEnemyMonsters: `对方全部怪兽守备力减少${value}；守备力变为0的怪兽破坏。`,
        healPlayer: `自己恢复${value}LP。`,
        directDamage: `对方受到${value}点效果伤害。`,
        drawCards: `自己抽${Math.max(1, value)}张卡。`,
        buffAllAlliesAttack: `己方全部怪兽攻击力增加${value}。`,
        tokenSummon: `在己方场上特殊召唤1只攻击力和守备力均为${value}的衍生物。`,
        targetProtect: "己方攻击力最高的怪兽本回合不会成为对方效果的目标。",
        temporaryBanish: "暂时除外对方攻击力最高的怪兽；回合结束时返回原场地。",
        returnToHand: "将对方攻击力最低的怪兽返回其手牌。",
        lockAttack: "对方攻击力最高的怪兽本回合不能攻击。",
        destroySpellTrap: `破坏对方场上最多${Math.max(1, value)}张魔法或陷阱卡。`,
        destroyAllEnemySpellTraps: "破坏对方场上全部魔法和陷阱卡。",
        destroyTarget: "破坏对方场上攻击力最高的怪兽。",
        discardCards: `对方随机丢弃${Math.max(1, value)}张手牌。`,
        searchDeck: "从己方卡组选择1张符合条件的卡加入手牌。",
        reviveRecentGraveyard: "将己方墓地中最近进入墓地的怪兽以攻击表示特殊召唤。",
        cannotAttack: "那次攻击无效，攻击怪兽本回合不能再次攻击。",
        reduceDamage: `那次战斗造成的伤害减少${value}。`,
        destroyAttacker: "那次攻击无效，并破坏攻击怪兽。",
        counterDestroy: "那次攻击无效，并破坏攻击怪兽。",
        reflectDamage: "那次攻击无效，并给予对方等同攻击怪兽攻击力的伤害。",
        groupDraw: `自己抽${Math.max(1, value)}张卡；若己方场上有其他怪兽，再抽1张。`,
        groupBuff: `己方全部怪兽攻击力增加${value}。`,
        gainAttackByCount: `己方场上每有1只怪兽，这张卡攻击力增加${value}。`,
        freezeAll: `对方全部怪兽攻击力减少${value}，且本回合不能攻击。`,
        protectAllies: "己方全部怪兽本回合不会被战斗破坏。",
        banishEnemyGraveyard: `从对方墓地除外最多${Math.max(1, value)}张卡。`,
        destroyWeakest: "破坏对方攻击力最低的怪兽。",
        returnMultiple: `将对方最多${Math.max(1, value)}只怪兽返回手牌。`,
        discardAndDraw: "丢弃1张手牌，然后抽2张卡。",
        fullRecovery: "恢复LP，并将己方怪兽的守备力恢复至原本数值。",
        swapAttackDefense: "交换对方攻击力最高怪兽的攻击力与守备力。",
        doubleAttack: "这张卡本回合可以进行2次攻击。",
        recycleSpellDraw: "将己方墓地1张魔法卡回收到手牌，然后抽1张卡。",
        copyLastSpell: "复制最近的魔法残响并抽1张卡。",
        sacrificeDestroy: "支付当前LP的20%，破坏对方最多2只怪兽。",
    };
    const label = effect.skillLabel ? `【${effect.skillLabel}·${effect.skillName}】` : "";
    const condition = effect.conditionText ? `发动条件：${effect.conditionText}。` : "";
    const cost = effect.cost?.type === "payLife"
        ? `代价：支付${effect.cost.value}LP。`
        : effect.cost?.type === "discard"
            ? `代价：丢弃${effect.cost.value}张手牌。`
            : "";
    return `${label}${trigger}：${condition}${cost}${texts[effect.type] || effect.description || "执行卡牌效果。"}`;
}

function simplifyRules(rules, rarity, forcedLimit = null) {
    const limit = forcedLimit ?? (rarity === "N" || rarity === "R" ? 1 : 2);
    return rules.slice(0, limit).map(effect => ({
        ...effect,
        description: plainRuleDescription(effect),
    }));
}

const SIGNATURE_ACTION_DETAILS = [
    strength => `蓄势：此卡攻击力上升${strength}点`,
    strength => `固守：此卡守备力上升${strength}点`,
    () => "冲击：给予对方‘该强度×70%（向下取整）’的效果伤害",
    strength => `治愈：己方恢复${strength}LP`,
    strength => `压制：对方攻击力最高的怪兽攻击力下降${strength}点`,
    () => "封锁：对方全部怪兽本回合不能攻击",
    (_, seed) => `墓地净化：从对方墓地除外最多${1 + seed % 2}张卡`,
    () => "具现化：特殊召唤1只攻击力/守备力均为‘400＋该强度’的衍生物（最高1400）",
    () => "手牌重构：丢弃1张手牌，然后抽2张卡",
    () => "攻守逆转：交换对方攻击力最高怪兽的攻击力与守备力",
    () => "击退：将对方攻击力最低的怪兽返回其持有者手牌",
    () => "全体庇护：己方全部怪兽本回合不会被战斗破坏",
];

function signatureDescription(card, source, primary, secondary, base, step, seed) {
    const strength = `强度＝${base}＋（${source}数量×${step}），最低按1计算，最高为1800`;
    const first = SIGNATURE_ACTION_DETAILS[primary]("该强度", seed);
    const second = SIGNATURE_ACTION_DETAILS[secondary]("该强度", seed);
    return `【召唤成功时·每次登场仅1次】${strength}。结算①${first}；然后结算②${second}。两个效果按顺序处理。`;
}

function signatureMonsterRules(card, seed, budget) {
    const sources = ["场上同伴", "己方墓地", "当前手牌", "决斗回合", "双方LP差"];
    const primaryNames = ["蓄势", "固守", "冲击", "治愈", "压制", "封锁", "墓地净化", "具现化", "手牌重构", "攻守逆转", "击退", "全体庇护"];
    let scale = seed % sources.length;
    const primary = (seed >>> 3) % primaryNames.length;
    let secondary = (seed >>> 9) % primaryNames.length;
    if (secondary === primary) secondary = (secondary + 1) % primaryNames.length;
    let aftermathIndex = (seed >>> 21) % 6;
    let semanticKey = `${scale}|${primary}|${secondary}|${aftermathIndex}`;
    while (USED_MONSTER_PROTOCOLS.has(semanticKey)) {
        aftermathIndex = (aftermathIndex + 1) % 6;
        if (aftermathIndex === 0) {
            secondary = (secondary + 1) % primaryNames.length;
            if (secondary === primary) secondary = (secondary + 1) % primaryNames.length;
        }
        semanticKey = `${scale}|${primary}|${secondary}|${aftermathIndex}`;
    }
    USED_MONSTER_PROTOCOLS.add(semanticKey);
    const base = Math.floor(budget.stat * .35) + seed % 181;
    const step = 70 + (seed >>> 15) % 111;
    const protocol = {
        id: card.id,
        seed,
        scale,
        primary,
        secondary,
        base,
        step,
    };
    const summon = {
        trigger: "onSummon",
        type: "signatureTechnique",
        value: 0,
        protocol,
        description: signatureDescription(card, sources[scale], primary, secondary, base, step, seed),
    };
    const aftermaths = [
        rule("onDestroyed", "drawCards", 1, "退场余响：被破坏时抽1张卡。"),
        rule("onDestroyed", "directDamage", 400 + seed % 501, `退场余响：给予对方${400 + seed % 501}点伤害。`),
        rule("onDestroyed", "tokenSummon", 500 + seed % 501, "退场余响：留下1只继承其意志的衍生物。"),
        rule("onDestroyed", "banishEnemyGraveyard", 1 + seed % 2, "退场余响：净化对方墓地中的卡。"),
        rule("onDestroyed", "returnToHand", 1, "退场余响：将对方攻击力最低的怪兽弹回手牌。", ENEMY_LOW),
        rule("onDestroyed", "reviveRecentGraveyard", 1, "退场余响：复苏己方最近进入墓地的另一只怪兽。"),
    ];
    return [summon, aftermaths[aftermathIndex]];
}

function characterArchetype(card) {
    const name = `${card.name || ""}`;
    if (/五条悟|无下限|无量空处|苍瞳|虚式茈|天上天下/.test(name)) return "infinity";
    if (/宿傩|伏魔御厨子|炎矢|暗影|原子裁决|终焉权能|咒灵武者/.test(name)) return "annihilation";
    if (/空条承太郎|白金之星|THE WORLD|迪亚哥/.test(name)) return "time";
    if (/初音未来|宵崎奏|宫崎奏|东云绘名|晓山瑞希|花里实乃理|日野森雫|草薙宁宁|喜多郁代|后藤一里|山田凉|奥泽美咲/.test(name)) return "music";
    if (/喜多川海梦|椎名真昼|有马加奈/.test(name)) return "heart";
    if (/绯线誓约|蕾塞·雨夜引魂|白绫神姬/.test(name)) return "oath";
    return "tactician";
}

function ssrMonsterRules(card, seed) {
    const level = Math.max(1, Number(card.level) || 4);
    const archetype = characterArchetype(card);
    const name = `${card.name || ""}`;
    const low = level <= 4;
    const high = level >= 7;
    const self = { owner: "self", zone: "monster", selector: "highestAttack", count: 1 };
    const finish = effects => effects.map(effect => (
        effect.trigger === "manual" ? { ...effect, oncePerTurn: true } : effect
    ));

    if (/吉良吉影|杀手皇后/.test(name)) {
        return finish([
            rule("onSummon", "tokenSummon", 800, "第一炸弹：特殊召唤1只炸弹衍生物。"),
            rule("manual", "sacrificeDestroy", 20, "败者食尘：支付当前20%LP，破坏对方最多2只怪兽。"),
            rule("onDestroyed", "directDamage", 800, "爆炸余波：被破坏时给予对方800点伤害。"),
        ]);
    }
    if (/米斯达|性感手枪/.test(name)) {
        return finish([
            rule("onSummon", "destroyWeakest", 1, "精准弹道：破坏对方攻击力最低的怪兽。"),
            rule("manual", "doubleAttack", 1, "六人连携：1回合1次，使这张卡本回合可以攻击2次。", self),
            rule("onDestroyed", "directDamage", 600, "最后一发：被破坏时给予对方600点伤害。"),
        ]);
    }
    if (/迪亚哥·骇人恶兽/.test(name)) {
        return finish([
            rule("onSummon", "tokenSummon", 1200, "恐龙化：特殊召唤1只1200攻守恐龙衍生物。"),
            rule("onSummon", "gainAttackByCount", 350, "群猎本能：己方每有1只怪兽，此卡攻击力上升350。"),
            rule("onSummon", "destroyAllEnemySpellTraps", 0, "兽群践踏：破坏对方场上全部魔法与陷阱卡。"),
        ]);
    }
    if (/法尼·瓦伦泰|爱之列车/.test(name)) {
        return finish([
            rule("onSummon", "protectAllies", 1, "D4C·爱之列车：己方怪兽本回合不会被战斗破坏。"),
            rule("onSummon", "temporaryBanish", 1, "平行世界置换：暂时除外对方最强怪兽。", ENEMY_HIGH),
            rule("onDestroyed", "returnMultiple", 2, "灾厄转移：被破坏时将对方最多2只怪兽返回手牌。"),
        ]);
    }
    if (/露西·钢铁蔷薇/.test(name)) {
        return finish([
            rule("onSummon", "protectAllies", 1, "圣人遗体：己方怪兽本回合不会被战斗破坏。"),
            rule("onSummon", "banishEnemyGraveyard", 2, "遗体感应：从对方墓地除外最多2张卡。"),
            rule("onDestroyed", "reviveRecentGraveyard", 1, "黄金回旋：被破坏时复苏最近进入己方墓地的怪兽。"),
        ]);
    }
    if (/赫特·潘兹|奶油启动器/.test(name)) {
        return finish([
            rule("onSummon", "fullRecovery", 1, "奶油启动器：恢复LP并修复己方全部怪兽。"),
            rule("onSummon", "protectAllies", 1, "肉体喷雾：己方怪兽本回合不会被战斗破坏。"),
            rule("onSummon", "destroySpellTrap", 1, "侵蚀喷射：破坏对方1张魔法或陷阱卡。"),
        ]);
    }
    if (/朝比奈真冬/.test(name)) {
        return finish([
            rule("onSummon", "freezeAll", 500, "无声世界：对方全部怪兽攻击力下降且本回合不能攻击。"),
            rule("onDestroyed", "destroyWeakest", 1, "空壳崩解：被破坏时破坏对方最弱怪兽。"),
        ]);
    }
    if (/宵崎奏/.test(name)) {
        return finish([
            rule("onSummon", "protectAllies", 1, "拯救之歌：己方怪兽本回合不会被战斗破坏。"),
            rule("manual", "recycleSpellDraw", 1, "未完成乐章：1回合1次，回收墓地魔法并抽1张卡。"),
        ]);
    }
    if (/晓山瑞希/.test(name)) {
        return finish(low ? [
            rule("onSummon", "swapAttackDefense", 1, "缤纷改造：交换对方最强怪兽的攻守。", ENEMY_HIGH),
            rule("onDestroyed", "copyLastSpell", 1, "秘密复刻：被破坏时抽1张卡。"),
        ] : [
            rule("onSummon", "returnMultiple", 2, "舞台换装：将对方最多2只怪兽返回手牌。"),
            rule("manual", "swapAttackDefense", 1, "缤纷改造：1回合1次，交换对方最强怪兽的攻守。", ENEMY_HIGH),
            rule("onDestroyed", "copyLastSpell", 1, "秘密复刻：被破坏时抽1张卡。"),
        ]);
    }
    if (/东云绘名/.test(name)) {
        return finish([
            rule("onSummon", "discardAndDraw", 1, "重绘：丢弃1张手牌，再抽2张卡。"),
            rule("onDestroyed", "directDamage", 700, "情绪爆发：被破坏时给予对方700点伤害。"),
        ]);
    }
    if (/草薙宁宁/.test(name)) {
        return finish([
            rule("onSummon", "tokenSummon", 700, "机器人宁宁号：特殊召唤1只700攻守衍生物。"),
            rule("manual", "swapAttackDefense", 1, "舞台程序改写：交换对方最强怪兽的攻守。", ENEMY_HIGH),
        ]);
    }
    if (/花里实乃理/.test(name)) {
        return finish([
            rule("onSummon", "groupBuff", 300, "希望舞台：己方全体怪兽攻击力上升。"),
            rule("onDestroyed", "groupDraw", 1, "永不放弃：被破坏时抽1张卡。"),
        ]);
    }
    if (/日野森雫/.test(name)) {
        return finish([
            rule("onSummon", "protectAllies", 1, "清澈气场：己方怪兽本回合不会被战斗破坏。"),
            rule("onDestroyed", "groupDraw", 1, "偶像余韵：被破坏时抽1张卡。"),
        ]);
    }
    if (/后藤一里/.test(name)) {
        return finish([
            rule("onSummon", "tokenSummon", 600, "承认欲求怪兽：特殊召唤1只600攻守衍生物。"),
            rule("onSummon", "gainAttackByCount", 300, "孤独摇滚：己方每有1只怪兽，此卡攻击力上升300。"),
        ]);
    }

    const packages = {
        infinity: low
            ? [
                rule("onSummon", "targetProtect", 1, "无下限：本回合这张卡不会成为对方效果的对象。", self),
                rule("onDestroyed", "temporaryBanish", 1, "苍之残响：此卡被破坏时，暂时除外对方最强怪兽。", ENEMY_HIGH),
            ]
            : high
                ? [
                    rule("onSummon", "temporaryBanish", 1, "术式顺转·苍：暂时除外对方最强怪兽。", ENEMY_HIGH),
                    rule("onSummon", "freezeAll", 700 + seed % 301, "无量空处：对方全部怪兽攻击力下降并无法攻击。"),
                    rule("onSummon", "banishEnemyGraveyard", 3, "虚式终结：从对方墓地除外最多3张卡。"),
                ]
                : [
                    rule("onSummon", "temporaryBanish", 1, "术式顺转·苍：暂时除外对方最强怪兽。", ENEMY_HIGH),
                    rule("onSummon", "protectAllies", 1, "无下限：己方怪兽本回合不会被战斗破坏。"),
                    rule("manual", "swapAttackDefense", 1, "赫：1回合1次，交换对方最强怪兽的攻守。", ENEMY_HIGH),
                ],
        annihilation: low
            ? [
                rule("onSummon", "destroyWeakest", 1, "解：登场时破坏对方攻击力最低的怪兽。"),
                rule("onDestroyed", "directDamage", 500 + seed % 301, "咒火余烬：被破坏时给予对方伤害。"),
            ]
            : high
                ? [
                    rule("onSummon", "destroyAllEnemySpellTraps", 0, "领域展开：破坏对方场上全部魔法与陷阱卡。"),
                    rule("onSummon", "damageAllEnemyMonsters", 900 + seed % 401, "伏魔御厨子：削减对方全部怪兽守备，降至0则破坏。"),
                    rule("onSummon", "banishEnemyGraveyard", 2, "炎矢焚痕：从对方墓地除外最多2张卡。"),
                ]
                : [
                    rule("onSummon", "destroySpellTrap", 1, "斩击：选择并破坏对方1张魔法或陷阱卡。"),
                    rule("onSummon", "destroyWeakest", 1, "解：破坏对方攻击力最低的怪兽。"),
                    rule("onDestroyed", "tokenSummon", 900, "咒胎残秽：被破坏时特殊召唤1只900攻守衍生物。"),
                ],
        time: low
            ? [
                rule("onSummon", "lockAttack", 1, "时间停滞：封锁对方最强怪兽本回合的攻击。", ENEMY_HIGH),
                rule("manual", "doubleAttack", 1, "精密连打：1回合1次，使这张卡本回合可以攻击2次。", self),
            ]
            : high
                ? [
                    rule("onSummon", "freezeAll", 650, "世界·时间停止：对方全部怪兽攻击力下降且无法攻击。"),
                    rule("onSummon", "destroyAllEnemySpellTraps", 0, "欧拉风暴：粉碎对方场上全部魔法与陷阱卡。"),
                    rule("manual", "doubleAttack", 1, "白金连打：1回合1次，使这张卡本回合可以攻击2次。", self),
                ]
                : [
                    rule("onSummon", "lockAttack", 1, "时间停止：封锁对方最强怪兽的攻击。", ENEMY_HIGH),
                    rule("manual", "doubleAttack", 1, "欧拉连打：1回合1次，使这张卡本回合可以攻击2次。", self),
                    rule("onDestroyed", "returnMultiple", 1, "时间逆流：被破坏时将对方最多2只怪兽返回手牌。"),
                ],
        music: low
            ? [
                rule("onSummon", "groupDraw", 1, "合奏开幕：抽1张卡；满足共鸣时再抽1张。"),
                rule("onDestroyed", "tokenSummon", 600 + seed % 301, "安可：被破坏时特殊召唤1只舞台衍生物。"),
            ]
            : high
                ? [
                    rule("onSummon", "groupDraw", 2, "世界级安可：抽2张卡；满足共鸣时再抽1张。"),
                    rule("onSummon", "groupBuff", 500 + seed % 301, "全员合奏：己方全体怪兽获得攻击力提升。"),
                    rule("onSummon", "protectAllies", 1, "终演守护：己方怪兽本回合不会被战斗破坏。"),
                ]
                : [
                    rule("onSummon", "groupDraw", 1, "合奏开幕：抽1张卡；满足共鸣时再抽1张。"),
                    rule("onSummon", "groupBuff", 350 + seed % 251, "节拍同步：己方全体怪兽获得攻击力提升。"),
                    rule("manual", "recycleSpellDraw", 1, "返场编曲：1回合1次，回收墓地魔法并抽卡。"),
                ],
        heart: low
            ? [
                rule("onSummon", "swapAttackDefense", 1, "形象改造：交换对方最强怪兽的攻击力与守备力。", ENEMY_HIGH),
                rule("onDestroyed", "copyLastSpell", 1, "灵感复刻：被破坏时复制灵感并抽1张卡。"),
            ]
            : high
                ? [
                    rule("onSummon", "returnMultiple", 2, "舞台换装：将对方最多2只怪兽返回手牌。"),
                    rule("onSummon", "destroyAllEnemySpellTraps", 0, "谢幕清场：破坏对方场上全部魔法与陷阱卡。"),
                    rule("onDestroyed", "reviveRecentGraveyard", 1, "心意不灭：被破坏时复苏最近进入墓地的怪兽。"),
                ]
                : [
                    rule("onSummon", "swapAttackDefense", 1, "形象改造：交换对方最强怪兽的攻守。", ENEMY_HIGH),
                    rule("onSummon", "returnToHand", 1, "聚光换位：将对方最弱怪兽返回手牌。", ENEMY_LOW),
                    rule("onDestroyed", "groupDraw", 1, "真心返场：被破坏时抽1张卡。"),
                ],
        oath: low
            ? [
                rule("onSummon", "protectAllies", 1, "誓约结界：己方怪兽本回合不会被战斗破坏。"),
                rule("onDestroyed", "reviveRecentGraveyard", 1, "红线牵引：被破坏时复苏最近进入墓地的怪兽。"),
            ]
            : high
                ? [
                    rule("onSummon", "protectAllies", 1, "神域誓约：己方怪兽本回合不会被战斗破坏。"),
                    rule("onSummon", "destroyAllEnemySpellTraps", 0, "净界：破坏对方场上全部魔法与陷阱卡。"),
                    rule("onDestroyed", "reviveRecentGraveyard", 1, "魂归红线：被破坏时复苏最近进入墓地的怪兽。"),
                ]
                : [
                    rule("onSummon", "targetProtect", 1, "红线庇护：本回合这张卡不会成为效果对象。", self),
                    rule("onSummon", "tokenSummon", 800, "誓约化身：特殊召唤1只800攻守衍生物。"),
                    rule("onDestroyed", "reviveRecentGraveyard", 1, "引魂：被破坏时复苏最近进入墓地的怪兽。"),
                ],
        tactician: low
            ? [
                rule("onSummon", "discardAndDraw", 1, "战术重整：丢弃1张手牌，再抽2张卡。"),
                rule("onDestroyed", "destroySpellTrap", 1, "临别破阵：被破坏时摧毁对方1张魔法或陷阱卡。"),
            ]
            : high
                ? [
                    rule("onSummon", "destroyAllEnemySpellTraps", 0, "制压展开：破坏对方场上全部魔法与陷阱卡。"),
                    rule("onSummon", "returnMultiple", 2, "阵线崩解：将对方最多2只怪兽返回手牌。"),
                    rule("onSummon", "groupDraw", 1, "胜机推演：抽1张卡。"),
                ]
                : [
                    rule("onSummon", "destroySpellTrap", 1, "破阵：选择并破坏对方1张魔法或陷阱卡。"),
                    rule("onSummon", "discardAndDraw", 1, "战术重整：丢弃1张手牌，再抽2张卡。"),
                    rule("onDestroyed", "returnToHand", 1, "撤退诱导：被破坏时将对方最弱怪兽返回手牌。", ENEMY_LOW),
                ],
    };
    return finish(packages[archetype]);
}

const CHARACTER_RULE_CATEGORIES = {
    blaze: /fire|flame|sunfire|blood-flame|bomb|flame-arrow|hollow-purple|domain-slash|cursed-slash|revenge-chain/,
    tide: /water|ice|mist|rain/,
    storm: /wind|thunder|bullet|sound-bomb|serpent/,
    earth: /earth|stone|chain|sand/,
    beast: /beast|cat-paw|cream/,
    poison: /poison|butterfly/,
    sacred: /light|angel|shrine|judgement/,
    shadow: /dark|blood-moon|spirit|sniper/,
    dimension: /dimension|time-stop|domain|infinity/,
    music: /song|bass|piano|dj|idol/,
    heart: /rose|love|feather|ribbon|cosplay|red-thread|angel/,
};

const CHARACTER_EFFECT_TITLES = {
    buffSelfAttack: "锋刃蓄势", buffSelfDefense: "铁壁架势", directDamage: "灵压爆发",
    damageAllEnemyMonsters: "全域震荡", destroySpellTrap: "破阵", destroyAllEnemySpellTraps: "领域清扫",
    destroyWeakest: "猎杀弱点", debuffEnemyAttack: "威压", debuffEnemyDefense: "蚀骨侵袭", debuffAllEnemyAttack: "群体压制",
    freezeAll: "绝对封锁", lockAttack: "行动拘束", returnToHand: "击退", returnMultiple: "阵线驱逐",
    temporaryBanish: "次元放逐", banishEnemyGraveyard: "痕迹抹除", discardCards: "心神扰乱",
    discardAndDraw: "战术重构", tokenSummon: "化身降临", gainAttackByCount: "群体共鸣",
    doubleAttack: "二段追击", protectAllies: "全员庇护", targetProtect: "不可触及",
    groupDraw: "命运补给", groupBuff: "同调强化", recycleSpellDraw: "记忆返场",
    reviveRecentGraveyard: "羁绊复苏", healPlayer: "生命回响", swapAttackDefense: "攻守逆转",
};

function characterRuleCategory(style) {
    return Object.entries(CHARACTER_RULE_CATEGORIES).find(([, pattern]) => pattern.test(style))?.[0] || "shadow";
}

function characterRulePools(category, stat, damage, heal, seed) {
    const common = {
        blaze: [
            [rule("onSummon", "directDamage", damage, ""), rule("onSummon", "buffSelfAttack", stat, ""), rule("onSummon", "destroySpellTrap", 1, ""), rule("onSummon", "damageAllEnemyMonsters", Math.floor(damage * .7), "")],
            [rule("onSummon", "damageAllEnemyMonsters", Math.floor(damage * .65), ""), rule("onSummon", "gainAttackByCount", 220 + seed % 181, ""), rule("manual", "doubleAttack", 1, ""), rule("onSummon", "destroyWeakest", 1, "")],
            [rule("onSummon", "destroyAllEnemySpellTraps", 0, ""), rule("onDestroyed", "directDamage", Math.floor(damage * .8), ""), rule("onSummon", "destroyWeakest", 1, ""), rule("onDestroyed", "tokenSummon", 700 + seed % 501, "")],
        ],
        tide: [
            [rule("onSummon", "debuffEnemyAttack", stat, "", ENEMY_HIGH), rule("onSummon", "returnToHand", 1, "", ENEMY_LOW), rule("onSummon", "buffSelfDefense", stat, ""), rule("onSummon", "lockAttack", 1, "", ENEMY_HIGH)],
            [rule("onSummon", "freezeAll", Math.floor(stat * .65), ""), rule("onSummon", "protectAllies", 1, ""), rule("onSummon", "debuffAllEnemyAttack", Math.floor(stat * .6), ""), rule("manual", "swapAttackDefense", 1, "", ENEMY_HIGH)],
            [rule("onSummon", "returnMultiple", 2, ""), rule("onDestroyed", "reviveRecentGraveyard", 1, ""), rule("onSummon", "temporaryBanish", 1, "", ENEMY_HIGH), rule("onDestroyed", "healPlayer", Math.floor(heal * .7), "")],
        ],
        storm: [
            [rule("onSummon", "lockAttack", 1, "", ENEMY_HIGH), rule("onSummon", "buffSelfAttack", stat, ""), rule("onSummon", "destroyWeakest", 1, ""), rule("onSummon", "returnToHand", 1, "", ENEMY_LOW)],
            [rule("manual", "doubleAttack", 1, ""), rule("onSummon", "debuffAllEnemyAttack", Math.floor(stat * .55), ""), rule("onSummon", "damageAllEnemyMonsters", Math.floor(damage * .55), ""), rule("onSummon", "gainAttackByCount", 180 + seed % 201, "")],
            [rule("onDestroyed", "directDamage", Math.floor(damage * .75), ""), rule("onSummon", "returnMultiple", 2, ""), rule("onSummon", "destroyAllEnemySpellTraps", 0, ""), rule("onDestroyed", "tokenSummon", 650 + seed % 451, "")],
        ],
        earth: [
            [rule("onSummon", "buffSelfDefense", stat, ""), rule("onSummon", "targetProtect", 1, "", SELF_HIGH), rule("onSummon", "tokenSummon", 700 + seed % 401, ""), rule("onSummon", "debuffEnemyAttack", stat, "", ENEMY_HIGH)],
            [rule("onSummon", "protectAllies", 1, ""), rule("onSummon", "groupBuff", Math.floor(stat * .55), ""), rule("onSummon", "damageAllEnemyMonsters", Math.floor(damage * .65), ""), rule("onSummon", "destroySpellTrap", 1, "")],
            [rule("onDestroyed", "reviveRecentGraveyard", 1, ""), rule("onSummon", "destroyWeakest", 1, ""), rule("onDestroyed", "tokenSummon", 900 + seed % 401, ""), rule("onSummon", "returnMultiple", 2, "")],
        ],
        beast: [
            [rule("onSummon", "tokenSummon", 800 + seed % 401, ""), rule("onSummon", "gainAttackByCount", 240 + seed % 181, ""), rule("onSummon", "buffSelfAttack", stat, ""), rule("onSummon", "destroyWeakest", 1, "")],
            [rule("manual", "doubleAttack", 1, ""), rule("onSummon", "gainAttackByCount", 300 + seed % 151, ""), rule("onSummon", "destroySpellTrap", 1, ""), rule("onSummon", "damageAllEnemyMonsters", Math.floor(damage * .6), "")],
            [rule("onSummon", "destroyAllEnemySpellTraps", 0, ""), rule("onDestroyed", "tokenSummon", 1000 + seed % 301, ""), rule("onDestroyed", "directDamage", Math.floor(damage * .7), ""), rule("onSummon", "returnMultiple", 2, "")],
        ],
        poison: [
            [rule("onSummon", "debuffEnemyDefense", stat, "", ENEMY_HIGH), rule("onSummon", "debuffEnemyAttack", stat, "", ENEMY_HIGH), rule("onSummon", "lockAttack", 1, "", ENEMY_HIGH), rule("onSummon", "directDamage", Math.floor(damage * .7), "")],
            [rule("onSummon", "debuffAllEnemyAttack", Math.floor(stat * .55), ""), rule("onSummon", "banishEnemyGraveyard", 2, ""), rule("onSummon", "damageAllEnemyMonsters", Math.floor(damage * .5), ""), rule("onSummon", "destroyWeakest", 1, "")],
            [rule("onDestroyed", "directDamage", Math.floor(damage * .85), ""), rule("onSummon", "temporaryBanish", 1, "", ENEMY_HIGH), rule("onDestroyed", "destroyWeakest", 1, ""), rule("onSummon", "destroyAllEnemySpellTraps", 0, "")],
        ],
        sacred: [
            [rule("onSummon", "healPlayer", heal, ""), rule("onSummon", "targetProtect", 1, "", SELF_HIGH), rule("onSummon", "groupDraw", 1, ""), rule("onSummon", "buffSelfDefense", stat, "")],
            [rule("onSummon", "protectAllies", 1, ""), rule("onSummon", "groupBuff", Math.floor(stat * .55), ""), rule("onSummon", "destroySpellTrap", 1, ""), rule("onSummon", "tokenSummon", 700 + seed % 401, "")],
            [rule("onDestroyed", "reviveRecentGraveyard", 1, ""), rule("onDestroyed", "healPlayer", Math.floor(heal * .7), ""), rule("onSummon", "destroyAllEnemySpellTraps", 0, ""), rule("onDestroyed", "groupDraw", 1, "")],
        ],
        shadow: [
            [rule("onSummon", "discardCards", 1, ""), rule("onSummon", "temporaryBanish", 1, "", ENEMY_HIGH), rule("onSummon", "directDamage", damage, ""), rule("onSummon", "debuffEnemyAttack", stat, "", ENEMY_HIGH)],
            [rule("onSummon", "banishEnemyGraveyard", 2, ""), rule("onSummon", "discardAndDraw", 1, ""), rule("onSummon", "lockAttack", 1, "", ENEMY_HIGH), rule("onSummon", "destroySpellTrap", 1, "")],
            [rule("onDestroyed", "directDamage", Math.floor(damage * .8), ""), rule("onSummon", "temporaryBanish", 1, "", ENEMY_HIGH), rule("onDestroyed", "reviveRecentGraveyard", 1, ""), rule("onSummon", "destroyWeakest", 1, "")],
        ],
        dimension: [
            [rule("onSummon", "temporaryBanish", 1, "", ENEMY_HIGH), rule("onSummon", "lockAttack", 1, "", ENEMY_HIGH), rule("onSummon", "swapAttackDefense", 1, "", ENEMY_HIGH), rule("onSummon", "targetProtect", 1, "", SELF_HIGH)],
            [rule("onSummon", "returnMultiple", 2, ""), rule("manual", "doubleAttack", 1, ""), rule("onSummon", "freezeAll", Math.floor(stat * .65), ""), rule("onSummon", "banishEnemyGraveyard", 2, "")],
            [rule("onSummon", "destroyAllEnemySpellTraps", 0, ""), rule("onDestroyed", "returnMultiple", 2, ""), rule("onSummon", "temporaryBanish", 1, "", ENEMY_HIGH), rule("onDestroyed", "reviveRecentGraveyard", 1, "")],
        ],
        music: [
            [rule("onSummon", "groupDraw", 1, ""), rule("onSummon", "groupBuff", Math.floor(stat * .5), ""), rule("onSummon", "tokenSummon", 600 + seed % 401, ""), rule("onSummon", "discardAndDraw", 1, "")],
            [rule("onSummon", "groupBuff", Math.floor(stat * .65), ""), rule("manual", "recycleSpellDraw", 1, ""), rule("onSummon", "protectAllies", 1, ""), rule("onSummon", "debuffAllEnemyAttack", Math.floor(stat * .45), "")],
            [rule("onDestroyed", "groupDraw", 1, ""), rule("onDestroyed", "reviveRecentGraveyard", 1, ""), rule("onSummon", "destroyAllEnemySpellTraps", 0, ""), rule("onDestroyed", "tokenSummon", 700 + seed % 401, "")],
        ],
        heart: [
            [rule("onSummon", "protectAllies", 1, ""), rule("onSummon", "healPlayer", heal, ""), rule("onSummon", "swapAttackDefense", 1, "", ENEMY_HIGH), rule("onSummon", "targetProtect", 1, "", SELF_HIGH)],
            [rule("onSummon", "groupBuff", Math.floor(stat * .55), ""), rule("onSummon", "returnToHand", 1, "", ENEMY_LOW), rule("onSummon", "groupDraw", 1, ""), rule("onSummon", "tokenSummon", 650 + seed % 351, "")],
            [rule("onDestroyed", "reviveRecentGraveyard", 1, ""), rule("onSummon", "destroyAllEnemySpellTraps", 0, ""), rule("onDestroyed", "healPlayer", Math.floor(heal * .75), ""), rule("onSummon", "returnMultiple", 2, "")],
        ],
    };
    return common[category] || common.shadow;
}

function uniqueCharacterMonsterRules(card, seed, budget) {
    if (/迪亚哥·骇人恶兽/.test(card.name || "")) {
        return ssrMonsterRules(card, seed).map(effect => balanceCharacterEffect(effect, card, budget));
    }
    const profile = getMonsterCinematicProfile(card) || {};
    const category = characterRuleCategory(profile.style || card.attribute || "dark");
    const variance = seed % 61;
    const pools = characterRulePools(category, budget.stat + variance, budget.damage + variance, budget.heal + variance, seed)
        .map(pool => pool.map(effect => balanceCharacterEffect(effect, card, budget)));
    let a = seed % pools[0].length;
    let b = (seed >>> 5) % pools[1].length;
    let c = (seed >>> 11) % pools[2].length;
    let signature = `${pools[0][a].type}|${pools[1][b].type}|${pools[2][c].type}`;
    const invalidSignature = () => USED_CHARACTER_EFFECT_SETS.has(signature) || new Set(signature.split("|")).size < 3;
    for (let attempts = 0; invalidSignature() && attempts < 64; attempts++) {
        c = (c + 1) % pools[2].length;
        if (c === 0) {
            b = (b + 1) % pools[1].length;
            if (b === 0) a = (a + 1) % pools[0].length;
        }
        signature = `${pools[0][a].type}|${pools[1][b].type}|${pools[2][c].type}`;
    }
    USED_CHARACTER_EFFECT_SETS.add(signature);
    const variant = String(card.name || "角色").split(/[·・]/u).at(-1);
    const move = profile.signatureMove || variant;
    const skillStem = move.includes(variant) ? move : `${move}·${variant}`;
    return [pools[0][a], pools[1][b], pools[2][c]].map(effect => ({
        ...effect,
        skillName: `${skillStem}·${CHARACTER_EFFECT_TITLES[effect.type] || "异能解放"}`,
        description: `${skillStem}·${CHARACTER_EFFECT_TITLES[effect.type] || "异能解放"}：${effect.description || "结算角色专属能力。"}`,
        ...(effect.trigger === "manual" ? { oncePerTurn: true } : {}),
    }));
}

function completeCharacterMonsterRules(card, rules, seed) {
    if (rules.length >= 3) return rules;
    const finishers = [
        rule("onDestroyed", "directDamage", 600 + seed % 401, `${card.name}·残响追击：被破坏时给予对方效果伤害。`),
        rule("onDestroyed", "drawCards", 1, `${card.name}·命运续页：被破坏时抽1张卡。`),
        rule("onDestroyed", "tokenSummon", 700 + seed % 401, `${card.name}·意志化身：被破坏时特殊召唤1只衍生物。`),
        rule("onDestroyed", "destroySpellTrap", 1, `${card.name}·临别破阵：被破坏时摧毁对方1张魔法或陷阱卡。`),
        rule("onDestroyed", "banishEnemyGraveyard", 2, `${card.name}·痕迹抹除：被破坏时从对方墓地除外最多2张卡。`),
        rule("onDestroyed", "reviveRecentGraveyard", 1, `${card.name}·羁绊再临：被破坏时复苏己方最近进入墓地的怪兽。`),
        rule("onDestroyed", "returnToHand", 1, `${card.name}·终幕击退：被破坏时将对方最弱怪兽返回手牌。`, ENEMY_LOW),
        rule("onDestroyed", "destroyWeakest", 1, `${card.name}·弱点终结：被破坏时破坏对方攻击力最低的怪兽。`),
    ];
    let index = seed % finishers.length;
    while (rules.some(effect => effect.type === finishers[index].type)) {
        index = (index + 1) % finishers.length;
    }
    return [...rules, finishers[index]];
}

function decorateCharacterMonsterRules(rules) {
    const labels = ["登场技", "连携技", "终结技"];
    const triggerNames = {
        onSummon: "召唤成功时",
        onDestroyed: "被破坏时",
        onAttacked: "对方怪兽攻击时",
        manual: "发动时",
    };
    return rules.map((effect, index) => {
        const parts = `${effect.description || "异能解放"}`.split(/[：:]/u);
        const skillName = parts.shift() || "异能解放";
        const detail = parts.join("：") || "执行这张卡的角色专属效果。";
        const skillLabel = labels[index] || "终结技";
        return {
            ...effect,
            skillStage: skillLabel === "登场技" ? "entrance" : skillLabel === "连携技" ? "combo" : "finisher",
            skillLabel,
            skillName,
            description: `【${skillLabel}·${skillName}】${triggerNames[effect.trigger] || "发动时"}：${detail}`,
        };
    });
}

function monsterRules(card, budget, seed, stat, damage, heal) {
    const entrance = [
        rule("onSummon", "buffSelfAttack", stat, "", null),
        rule("onSummon", "buffSelfDefense", stat, "", null),
        rule("onSummon", "debuffEnemyAttack", stat, "", ENEMY_HIGH),
        rule("onSummon", "healPlayer", heal, "", null),
        rule("onSummon", "directDamage", damage, "", null),
        rule("onSummon", "drawCards", 1, "", null),
        rule("onSummon", "temporaryBanish", 1, "", ENEMY_HIGH),
        rule("onSummon", "destroySpellTrap", 1, "", { owner: "opponent", zone: "spellTrap", selector: "first", count: 1 }),
    ];
    const combo = [
        rule("onSummon", "buffAllAlliesAttack", Math.floor(stat * .55), ""),
        rule("onSummon", "debuffAllEnemyAttack", Math.floor(stat * .5), ""),
        rule("onDestroyed", "tokenSummon", 500 + seed % 400, ""),
        rule("onSummon", "damageAllEnemyMonsters", Math.floor(damage * .6), ""),
        rule("onSummon", "targetProtect", 1, "", SELF_HIGH),
        rule("onDestroyed", "groupDraw", 1, ""),
        rule("onSummon", "gainAttackByCount", 180 + seed % 221, ""),
        rule("onDestroyed", "freezeAll", Math.floor(stat * .45), ""),
    ];
    const finisher = [
        rule("onSummon", "drawCards", 1, ""),
        rule("onSummon", "directDamage", Math.floor(damage * .7), ""),
        rule("onDestroyed", "tokenSummon", 600 + seed % 401, ""),
        rule("onDestroyed", "banishEnemyGraveyard", 1 + seed % 2, ""),
        rule("onSummon", "returnToHand", 1, "", ENEMY_LOW),
        rule("onDestroyed", "reviveRecentGraveyard", 1, ""),
        rule("onSummon", "healPlayer", Math.floor(heal * .7), ""),
        rule("onDestroyed", "destroyWeakest", 1, ""),
    ];
    let entranceIndex = seed % entrance.length;
    let comboIndex = (seed >>> 4) % combo.length;
    let finisherIndex = (seed >>> 8) % finisher.length;
    while (USED_ANIME_SKILL_SETS.has(`${entranceIndex}|${comboIndex}|${finisherIndex}`)) {
        finisherIndex = (finisherIndex + 1) % finisher.length;
        if (finisherIndex === 0) {
            comboIndex = (comboIndex + 1) % combo.length;
            if (comboIndex === 0) entranceIndex = (entranceIndex + 1) % entrance.length;
        }
    }
    USED_ANIME_SKILL_SETS.add(`${entranceIndex}|${comboIndex}|${finisherIndex}`);
    return [entrance[entranceIndex], combo[comboIndex], finisher[finisherIndex]].map((effect, index) => ({
        ...effect,
        skillStage: ["entrance", "combo", "finisher"][index],
        skillLabel: ["登场技", "连携技", "终结技"][index],
        skillName: `${card.name}·${({
            buffSelfAttack: "锋芒觉醒",
            buffSelfDefense: "不落心壁",
            debuffEnemyAttack: "威光压境",
            healPlayer: "生命回响",
            directDamage: "灵魂震爆",
            drawCards: "命运预读",
            temporaryBanish: "次元放逐",
            destroySpellTrap: "术式破阵",
            buffAllAlliesAttack: "全员共振",
            debuffAllEnemyAttack: "领域威压",
            tokenSummon: "幻影具现",
            damageAllEnemyMonsters: "大地震荡",
            targetProtect: "守护誓约",
            groupDraw: "羁绊补给",
            gainAttackByCount: "同伴之力",
            freezeAll: "时间冻结",
            banishEnemyGraveyard: "记忆净界",
            returnToHand: "风暴击退",
            reviveRecentGraveyard: "奇迹返场",
            destroyWeakest: "弱点处刑",
        })[effect.type] || "异能解放"}`,
    }));
}

function spellRules(budget, seed, stat, damage, heal, rarity = "R") {
    const packages = [
        [rule("manual", "drawCards", 1, "抽1张卡。"), rule("manual", "healPlayer", heal, `随后恢复${heal}LP。`), rule("manual", "searchDeck", 1, "终式：检索1只怪兽。", { owner: "self", zone: "deck", filters: { type: "monster" } })],
        [rule("manual", "debuffEnemyAttack", stat, `目标攻击力下降${stat}。`, ENEMY_HIGH), rule("manual", "lockAttack", 1, "随后封锁其攻击。", ENEMY_HIGH), rule("manual", "drawCards", 1, "终式：抽1张卡。")],
        [rule("manual", "buffAllAlliesAttack", stat, `己方全体攻击力上升${stat}。`), rule("manual", "tokenSummon", 600 + seed % 500, "随后特殊召唤衍生物。"), rule("manual", "targetProtect", 1, "终式：保护己方最强怪兽。", SELF_HIGH)],
        [rule("manual", "damageAllEnemyMonsters", damage, `对方全体守备力下降${damage}，降至0则破坏。`), rule("manual", "directDamage", Math.floor(damage * .5), `随后造成${Math.floor(damage * .5)}点伤害。`), rule("manual", "healPlayer", Math.floor(heal * .5), `终式：恢复${Math.floor(heal * .5)}LP。`)],
        [rule("manual", "returnToHand", 1, "将对方最强怪兽返回手牌。", ENEMY_HIGH), rule("manual", "discardCards", 1, "随后对方随机丢弃1张手牌。"), rule("manual", "drawCards", 1, "终式：抽1张卡。")],
        [rule("manual", "temporaryBanish", 1, "暂时除外对方最强怪兽。", ENEMY_HIGH), rule("manual", "debuffAllEnemyAttack", Math.floor(stat * .65), `对方全体攻击力下降${Math.floor(stat * .65)}。`), rule("manual", "searchDeck", 1, "终式：检索1张魔法卡。", { owner: "self", zone: "deck", filters: { type: "spell" } })],
        [rule("manual", "directDamage", damage, `给予对方${damage}点伤害。`), rule("manual", "healPlayer", Math.floor(heal * .75), `恢复${Math.floor(heal * .75)}LP。`), rule("manual", "buffAllAlliesAttack", Math.floor(stat * .5), `终式：己方全体攻击力上升${Math.floor(stat * .5)}。`)],
    ];
    const base = packages[seed % packages.length];
    if (rarity === "SR") return base.slice(0, 2);
    if (rarity === "SSR") return [base[0], base[1], rule("manual", "searchDeck", 1, "余韵：从卡组检索1张与本卡不同类型的卡。", { owner: "self", zone: "deck" })];
    if (rarity === "UR") {
        const ultimates = [
            rule("manual", "destroyAllEnemySpellTraps", 0, "领域崩解：破坏对方场上全部魔法与陷阱卡。"),
            rule("manual", "temporaryBanish", 1, "次元放逐：暂时除外对方最强怪兽。", ENEMY_HIGH),
            rule("manual", "damageAllEnemyMonsters", damage, `终焉冲击：对方全体守备力下降${damage}，降至0则破坏。`),
            rule("manual", "reviveRecentGraveyard", 1, "奇迹再临：复苏己方墓地最近的怪兽。"),
        ];
        return [ultimates[seed % ultimates.length], base[0], base[1]];
    }
    return base.slice(0, budget.count);
}

function trapRules(card, budget, seed, heal) {
    const basic = [
        rule("onAttacked", "cannotAttack", 0, "阻断：使这次攻击无效。"),
        rule("onAttacked", "reduceDamage", heal, `防壁：本次战斗伤害减少${heal}。`),
        rule("onAttacked", "returnToHand", 0, "回卷：攻击怪兽返回手牌，攻击无效。"),
    ];
    const elite = [
        rule("onAttacked", "destroyAttacker", 0, "强制反击：攻击无效并破坏攻击怪兽。"),
        rule("onAttacked", "reflectDamage", 0, "镜返：攻击无效并反射等同攻击力的伤害。"),
        rule("onAttacked", "returnToHand", 0, "次元驱逐：攻击无效，攻击怪兽返回手牌。"),
    ];
    const sr = [...basic, rule("onAttacked", "counterDestroy", 0, "伏击：攻击无效并破坏攻击怪兽。")];
    const ssr = [
        ...elite,
        rule("onAttacked", "cannotAttack", 0, "绝对静止：这次攻击无效，并封锁对方全体怪兽本回合的攻击。"),
        rule("onAttacked", "reduceDamage", heal + 500, `圣域屏障：本次战斗伤害减少${heal + 500}。`),
    ];
    const ur = [
        rule("onAttacked", "reflectDamage", 0, "因果逆转：攻击无效，并将攻击力等量伤害反射给对方。"),
        rule("onAttacked", "destroyAttacker", 0, "终焉裁决：攻击无效，破坏攻击怪兽；共鸣时追加伤害。"),
        rule("onAttacked", "returnToHand", 0, "次元断层：攻击无效，将攻击怪兽送回手牌。"),
        rule("onAttacked", "cannotAttack", 0, "时间冻结：攻击无效，对方全体怪兽本回合不能攻击。"),
    ];
    const pool = card.rarity === "UR" ? ur : card.rarity === "SSR" ? ssr : card.rarity === "SR" ? sr : basic;
    const selected = pool[seed % pool.length];
    return [{ ...selected, description: `${card.name}·${selected.description}` }];
}

export function designRarityRules(card) {
    if (["奏响点亮天空", "八千年的思念", "八千代的思念"].includes(card?.name)) return null;
    const isSsrMonster = card?.type === "monster" && card?.rarity !== "N";
    const isEliteSpellTrap = ["spell", "trap"].includes(card?.type) && ["SR", "SSR", "UR"].includes(card?.rarity);
    if (!isSsrMonster && !isEliteSpellTrap && !["picture", "source_archive"].includes(card?.series)) return null;
    const budget = card.type === "monster" ? balancedMonsterBudget(card) : (BUDGETS[card.rarity] || BUDGETS.R);
    const seed = seedCard(card);
    const variance = seed % 250;
    const generatedRules = card.type === "monster"
        ? decorateCharacterMonsterRules(completeCharacterMonsterRules(card, uniqueCharacterMonsterRules(card, seed, budget), seed))
        : card.type === "trap"
            ? trapRules(card, budget, seed, budget.heal + variance)
            : spellRules(budget, seed, budget.stat + variance, budget.damage + variance, budget.heal + variance, card.rarity);
    const rules = simplifyRules(generatedRules, card.rarity, card.type === "monster" && card.rarity !== "N" ? 3 : null);
    return {
        effects: rules,
        description: rules.map(item => item.description).join("\n"),
        ruleTier: card.rarity,
        duelPowerTier: card.type === "monster" ? monsterPowerTier(card) : null,
        ruleSignature: seed.toString(36),
    };
}
