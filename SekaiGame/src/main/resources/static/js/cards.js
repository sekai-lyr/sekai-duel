/**
 * cards.js
 * 卡牌数据 —— 次元决斗：元素召唤
 * 50张现有卡牌 + 新字段支持 + 自动校验
 */

export const cardDatabase = [
    // ===== 水属性 · 角色怪兽 =====
    { id: "water_007", name: "蓝絮猫女仆 凯伊", type: "monster", attribute: "water", race: "beast", level: 4, attack: 1300, defense: 1500, rarity: "R",
      effects: [
          { trigger: "onSummon", type: "priorityTarget", value: 0 },
          { trigger: "manual", type: "conditionalBuff", value: 300, oncePerTurn: true },
          { trigger: "onDestroyed", type: "searchWaterMonster", value: 4 },
      ],
      description: "①特殊召唤成功的回合，对方必须先攻击其他怪兽。②1回合1次：无后场盖卡时攻击力+300，有后场盖卡时守备力+300。③被战斗破坏时，从卡组将1只等级4以下水属性怪兽加入手牌。",
      image: "./assets/cards/monsters/R/4星/蓝絮猫女仆 凯伊.jpg", series: "nightcord", tags: ["priority", "conditional", "search"], aiHints: { role: "defender", priority: 55 }, lore: "", enabled: true },
    { id: "water_008", name: "里间雨", type: "monster", attribute: "water", race: "warrior", level: 4, attack: 1700, defense: 1400, rarity: "R",
      effects: [
          { trigger: "onSummon", type: "targetProtect", value: 0 },
          { trigger: "onFlip", type: "targetProtect", value: 0 },
          { trigger: "onSummon", type: "switchDefenseRedirect", value: 400 },
          { trigger: "onFlip", type: "switchDefenseRedirect", value: 400 },
          { trigger: "onDestroyed", type: "bounceBackrow", value: 0 },
      ],
      description: "①通常召唤/反转召唤成功时，对方不能将这张卡作为效果对象。②对方攻击时自动切换守备表示并强制攻击其他怪兽；无其他怪兽时守备+400。③被战斗破坏时，后场1张盖卡回手。",
      image: "./assets/cards/monsters/R/4星/里间雨.jpg", series: "nightcord", tags: ["protect", "redirect", "bounce"], aiHints: { role: "defender", priority: 60 }, lore: "", enabled: true },
    { id: "water_009", name: "宫崎奏", type: "monster", attribute: "water", race: "spellcaster", level: 4, attack: 1700, defense: 1400, rarity: "R",
      effects: [
          { trigger: "onSummon", type: "recycleWaterAndProtect", value: 0 },
          { trigger: "onFlip", type: "recycleWaterAndProtect", value: 0 },
          { trigger: "onSummon", type: "effectDisruptor", value: 0 },
          { trigger: "onFlip", type: "effectDisruptor", value: 0 },
          { trigger: "onDestroyed", type: "buffAllyOnDestroy", value: 250 },
      ],
      description: "①召唤/反转召唤时，墓地1张水属性回卡组底+本回合效果对象保护。②对方回合对方发动效果时，数值增减减半；非数值效果则对方舍弃1张手牌。③被战斗破坏时，场上1只Lv4以下怪兽攻守+250。",
      image: "./assets/cards/monsters/R/4星/宫崎奏.jpg", series: "nightcord", tags: ["recycle", "disrupt", "buff"], aiHints: { role: "defender", priority: 58 }, lore: "", enabled: true },
    { id: "water_010", name: "山田凉", type: "monster", attribute: "water", race: "warrior", level: 4, attack: 1700, defense: 1200, rarity: "SSR",
      effects: [
          { trigger: "manual", type: "recycleSpellDraw", value: 1, oncePerTurn: true },
          { trigger: "fusion", type: "fusionSubstituteSpell", value: 0 },
      ],
      description: "①1回合1次，把墓地1张魔法卡放回卡组顶端，自身抽1张卡。②这张卡作为融合素材时，可以用手牌1张魔法卡代替1只怪兽素材。",
      image: "./assets/cards/monsters/SSR/4星/山田凉.jpg", series: "nightcord", tags: ["recycle", "fusion"], aiHints: { role: "attacker", priority: 72 }, lore: "", enabled: true },
    { id: "water_011", name: "青蓝妆者", type: "monster", attribute: "water", race: "spellcaster", level: 4, attack: 1600, defense: 1400, rarity: "SSR",
      effects: [
          { trigger: "manual", type: "searchSpellByDiscard", value: 1, oncePerTurn: true },
      ],
      description: "①1回合1次，将手牌1张魔法送入墓地，从卡组拿1张魔法加入手牌，这张魔法本回合不能发动。",
      image: "./assets/cards/monsters/SSR/4星/青蓝妆者.jpg", series: "nightcord", tags: ["search", "spell"], aiHints: { role: "support", priority: 68 }, lore: "", enabled: true },
    // ===== 暗属性 · 角色怪兽 =====
    { id: "dark_006", name: "朝比奈真冬", type: "monster", attribute: "dark", race: "spellcaster", level: 4, attack: 1550, defense: 1450, rarity: "UR",
      effects: [
          { trigger: "manual", type: "discardToDisableAttack", value: 1, oncePerTurn: true,
              target: { owner: "opponent", zone: "monster", selector: "highestAttack", count: 1 } },
      ],
      description: "①1回合1次，丢弃1张手牌可以发动，选取对方场上1只怪兽，该怪兽直至对方下个结束阶段无法攻击。",
      image: "./assets/cards/monsters/UR/4星/朝比奈真冬.jpg", series: "nightcord", tags: ["control", "disable"], aiHints: { role: "control", priority: 75 }, lore: "", enabled: true },
];

// ======================== 常量导出 ========================
export const ELEMENT_ICONS = { fire: "🔥", water: "💧", wind: "🌬️", earth: "🌍", light: "✨", dark: "🌑", none: "-" };
export const ELEMENT_NAMES = { fire: "火", water: "水", wind: "风", earth: "地", light: "光", dark: "暗", none: "无" };
export const ELEMENT_STRONG = { fire: "wind", wind: "earth", earth: "water", water: "fire", light: "dark", dark: "light" };
export const RACE_NAMES = { dragon: "龙族", warrior: "战士族", spellcaster: "魔法师族", beast: "兽族", machine: "机械族", fiend: "恶魔族", fairy: "天使族", rock: "岩石族", aqua: "水族", winged_beast: "鸟兽族", insect: "昆虫族", zombie: "不死族", dragon_knight: "龙骑士族", plant: "植物族", psychic: "超能力族", sea_serpent: "海龙族", thunder: "雷族", reptile: "爬虫族", beast_warrior: "兽战士族", cyberse: "电子界族", divine_beast: "幻神兽族" };

// ======================== 自动校验 ========================
export function validateCardData(card, index) {
    const issues = [];
    if (!card.id) issues.push(`卡牌#${index}: 缺少id`);
    if (!card.name) issues.push(`卡牌#${card.id}: 缺少名称`);
    if (!["monster", "spell", "trap"].includes(card.type)) issues.push(`卡牌#${card.id}: 类型无效 ${card.type}`);
    if (!card.attribute) issues.push(`卡牌#${card.id}: 缺少属性`);
    if (!card.rarity || !["N", "R", "SR", "SSR", "UR"].includes(card.rarity)) issues.push(`卡牌#${card.id}: 稀有度无效`);
    if (card.type === "monster") {
        if (typeof card.attack !== "number") issues.push(`卡牌#${card.id}: 缺少攻击力`);
        if (typeof card.defense !== "number") issues.push(`卡牌#${card.id}: 缺少守备力`);
        if (typeof card.level !== "number") issues.push(`卡牌#${card.id}: 缺少等级`);
    }
    if (!card.description) issues.push(`卡牌#${card.id}: 缺少描述`);
    if (issues.length > 0) console.warn("[卡牌校验]", issues.join("; "));
    return issues;
}

export function validateCardDatabase() {
    const issues = [];
    const ids = cardDatabase.map(c => c.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length > 0) issues.push(`重复ID: ${dupes.join(", ")}`);

    cardDatabase.forEach((card, i) => {
        issues.push(...validateCardData(card, i));
    });

    if (issues.length > 0) {
        console.warn(`[数据库校验] 发现${issues.length}个问题`);
    } else {
        console.log(`[数据库校验] ${cardDatabase.length}张卡牌全部通过`);
    }
    return issues;
}

// 启动时自动校验
if (typeof window === "undefined") {
    // Node.js 环境（测试时）不自动校验
} else {
    validateCardDatabase();
}
