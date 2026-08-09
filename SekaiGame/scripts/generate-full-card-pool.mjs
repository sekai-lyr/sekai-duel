import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.resolve(projectRoot, "..", "pricture");
const staticRoot = path.resolve(projectRoot, "src/main/resources/static");
const assetRoot = path.resolve(staticRoot, "assets/cards/complete");
const generatedModule = path.resolve(staticRoot, "js/generated-cards.js");
const fullPoolPath = path.resolve(projectRoot, "src/main/resources/full-card-pool.json");
const backendJsonPath = path.resolve(projectRoot, "src/main/resources/cards.json");
const backendBase64Path = path.resolve(projectRoot, "src/main/resources/cards-base64.txt");

const HASH_NAMES = {
    "2EC2D8F78A52459FBF5E2F886DA80EE8": "白羽静梦",
    "2FBAB8BA00B513659F6A751E4C9973D1": "蕾塞·雨夜引魂",
    "30B07C9EC5AF838E9C56F7B7DD9CE32F": "绯线誓约·青叶",
    "55B36C8B2F51158925660FA041276B90": "绯线誓约·棕羽",
    "F932DED255F60A233A5727BB55A77714": "绯线誓约·金瞳",
    "4FA8E2A5E8F3BBD68EF7187AA4F0F927": "两面宿傩·狱纹",
    "B25E3F6A81B98412D0E005D7FDF5F06D": "五条悟·苍瞳",
    "DBBEB50C7B2AF71DD38F76D7E80EFDD5": "五条悟·无下限",
    "196BCD56CD1047F3D16087352C385661": "五条悟·苍天觉醒",
    "38EC61DEF1338450BE6EEE6E8C1C1A7D": "两面宿傩·伏魔御厨子",
    "4B58C805A0A7834F845D60C4D0CF2D52": "五条悟·虚式茈",
    "80CF40F691B5D3CC02F8839A1F9C4323": "宿傩·炎矢",
    "83AEAFD50D1D2EAE388DB2AAB4E2BE07": "五条悟·无量空处",
    "A57D6D2AE4AD06B8EEF629CEC8461AD5": "五条悟·天上天下",
    "C4FC3980048C599F5A3F3DF6C5BDA58E": "咒灵武者·赤影",
    "BE95BE37198D56064087E1C81D4DA33A": "白绫神姬·天仪",
    "CAE305E96597AF4D96A131CA3BD37667": "黄昏孤影·终焉",
    "ED1A2666F3F2900BDB316584BA7DCCAD": "虚拟歌姬·初音未来",
};

const SKIP_NAMES = new Set(["8千年的思念", "temp_swap"]);
const ATTRIBUTES = ["water", "wind", "light", "dark", "fire", "earth"];
const RACES = ["spellcaster", "warrior", "fairy", "fiend", "dragon", "psychic"];
const MONSTER_STATS = {
    R: { attack: 1250, defense: 1350 },
    SR: { attack: 1650, defense: 1550 },
    SSR: { attack: 2050, defense: 1900 },
    UR: { attack: 2850, defense: 2500 },
};

function walk(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const fullPath = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(fullPath) : /\.jpg$/i.test(entry.name) ? [fullPath] : [];
    });
}

function normalizeName(value) {
    return value.replace(/\s+/g, "").toLowerCase();
}

function slug(index, type) {
    return `source_${type}_${String(index + 1).padStart(3, "0")}`;
}

function effect(trigger, type, value, description, target) {
    return { trigger, type, value, ...(target ? { target } : {}), description };
}

function monsterEffects(index, rarity, level, name) {
    const scale = { R: 250, SR: 400, SSR: 600, UR: 900 }[rarity] || 250;
    const enemy = { owner: "opponent", zone: "monster", selector: index % 2 ? "highestAttack" : "lowestAttack", count: 1 };
    const patterns = [
        [effect("onSummon", "buffSelfAttack", scale + index * 15, `召唤成功时：自身攻击力上升${scale + index * 15}。`)],
        [effect("onSummon", "buffSelfDefense", scale + index * 20, `召唤成功时：自身守备力上升${scale + index * 20}。`)],
        [effect("onSummon", "debuffEnemyAttack", scale, `召唤成功时：对方攻击力最高的怪兽攻击力下降${scale}。`, enemy)],
        [effect("onSummon", "healPlayer", 500 + scale, `召唤成功时：恢复${500 + scale}LP。`)],
        [effect("onSummon", "drawCards", rarity === "UR" ? 2 : 1, `召唤成功时：抽${rarity === "UR" ? 2 : 1}张卡。`)],
        [effect("manual", "conditionalBuff", scale, `1回合1次：根据己方后场状态提升自身攻击力或守备力${scale}。`)],
        [effect("manual", "discardToDisableAttack", 1, "1回合1次：舍弃1张手牌，使对方1只怪兽本回合不能攻击。", enemy)],
        [effect("onSummon", "directDamage", 350 + scale, `召唤成功时：给予对方${350 + scale}点伤害。`)],
    ];
    const result = [...patterns[index % patterns.length]];
    if (rarity === "SSR" || rarity === "UR") {
        const secondary = [
            effect("manual", "buffSelfAttack", Math.round(scale * 0.65), `1回合1次：自身攻击力再上升${Math.round(scale * 0.65)}。`),
            effect("onDestroyed", "drawCards", 1, "被破坏时：抽1张卡。"),
            effect("onDestroyed", "healPlayer", 700 + index * 30, `被破坏时：恢复${700 + index * 30}LP。`),
            effect("manual", "targetProtect", 0, "1回合1次：本回合不成为对方效果对象。"),
        ][index % 4];
        result.push(secondary);
    }
    if (level >= 8) {
        result.push(effect("onSummon", "debuffAllEnemyAttack", 300 + index * 20, `高级召唤成功时：对方全部怪兽攻击力下降${300 + index * 20}。`));
    }
    return result;
}

function trapEffects(index, rarity, name) {
    const power = (rarity === "SSR" ? 1100 : 650) + index * 35;
    const primaryTypes = ["reduceDamage", "returnToHand", "cannotAttack", "reflectDamage", "destroyAttacker"];
    const type = primaryTypes[index % primaryTypes.length];
    const descriptions = {
        reduceDamage: `对方攻击宣言时发动：本次战斗伤害减少${power}。`,
        returnToHand: "对方攻击宣言时发动：攻击怪兽返回持有者手牌，那次攻击无效。",
        cannotAttack: "对方攻击宣言时发动：那次攻击无效，对方怪兽本回合不能继续攻击。",
        reflectDamage: "对方攻击宣言时发动：那次攻击无效，并将攻击力数值作为伤害反弹。",
        destroyAttacker: "对方攻击宣言时发动：破坏攻击怪兽，那次攻击无效。",
    };
    return [effect("onAttacked", type, type === "reduceDamage" ? power : index + 1, descriptions[type])];
}

function spellEffects(index, name) {
    if (name === "冰原双天鹅的星咏") {
        return [
            effect("manual", "temporaryBanish", 0, "选择对方1只怪兽暂时除外；结束阶段返回。", { owner: "opponent", zone: "monster", selector: "highestAttack", count: 1 }),
            effect("manual", "drawCards", 1, "若除外成功，抽1张卡。"),
        ];
    }
    return [
        effect("manual", "buffAllAlliesAttack", 900, "己方全部怪兽攻击力上升900。"),
        effect("manual", "drawCards", 1, "若己方同时存在战士族与魔法师族怪兽，再抽1张卡。"),
    ];
}

const existingModules = await Promise.all([
    import(pathToFileURL(path.resolve(staticRoot, "js/cards.js"))),
    import(pathToFileURL(path.resolve(staticRoot, "js/nightcord-cards.js"))),
    import(pathToFileURL(path.resolve(staticRoot, "js/image-cards.js"))),
]);
const { applyPlayableRules } = await import(pathToFileURL(path.resolve(staticRoot, "js/card-rules.js")));
const existingCards = [
    ...existingModules[0].cardDatabase,
    ...existingModules[1].ANIME_CARDS,
    ...existingModules[2].IMAGE_CARDS,
].map(applyPlayableRules);
const existingNames = new Set(existingCards.map(card => normalizeName(card.name)));

const additions = [];
for (const sourcePath of walk(sourceRoot).sort((left, right) => left.localeCompare(right, "zh-CN"))) {
    const relative = path.relative(sourceRoot, sourcePath);
    const parts = relative.split(path.sep);
    const originalBaseName = path.basename(sourcePath, path.extname(sourcePath));
    const name = HASH_NAMES[originalBaseName] || originalBaseName;
    if (SKIP_NAMES.has(originalBaseName) || existingNames.has(normalizeName(name))) continue;

    const category = parts[0];
    const type = category === "怪兽卡" ? "monster" : category === "魔法卡" ? "spell" : "trap";
    const rarity = parts[1].toUpperCase();
    const level = type === "monster" ? Number(parts[2]?.match(/\d+/)?.[0] || 4) : 0;
    const id = slug(additions.length, type);
    const destinationName = `${id}.jpg`;
    fs.mkdirSync(assetRoot, { recursive: true });
    fs.copyFileSync(sourcePath, path.join(assetRoot, destinationName));

    const attribute = ATTRIBUTES[additions.length % ATTRIBUTES.length];
    const base = MONSTER_STATS[rarity] || MONSTER_STATS.R;
    const levelBonus = Math.max(0, level - 4) * (rarity === "UR" ? 180 : 125);
    const effects = type === "monster"
        ? monsterEffects(additions.length, rarity, level, name)
        : type === "trap"
            ? trapEffects(additions.length, rarity, name)
            : spellEffects(additions.length, name);
    additions.push({
        id,
        name,
        series: "source_archive",
        type,
        attribute: type === "monster" ? attribute : "none",
        level,
        attack: type === "monster" ? base.attack + levelBonus + (additions.length % 4) * 90 : 0,
        defense: type === "monster" ? base.defense + levelBonus + (additions.length % 3) * 100 : 0,
        rarity,
        cost: type === "spell" ? (rarity === "UR" ? 4 : rarity === "SSR" ? 3 : 2) : 0,
        race: type === "monster" ? RACES[additions.length % RACES.length] : undefined,
        image: `./assets/cards/complete/${destinationName}`,
        effects,
        description: effects.map(item => item.description).join("\n"),
        tags: ["source-archive", type, rarity, `unique-${additions.length + 1}`],
        aiHints: { role: type === "monster" ? (additions.length % 2 ? "attacker" : "control") : type === "trap" ? "control" : "support", priority: 45 + Math.min(50, additions.length) },
        lore: `源自原始卡图《${path.basename(relative)}》的正式可玩卡牌。`,
        enabled: true,
    });
}

fs.writeFileSync(generatedModule, `// Generated by scripts/generate-full-card-pool.mjs\nexport const GENERATED_CARDS = ${JSON.stringify(additions, null, 4)};\n`, "utf8");

const fullPool = [...existingCards, ...additions].map(card => ({
    ...card,
    effects: Array.isArray(card.effects) ? card.effects : card.effect ? [card.effect] : [],
    effectsJson: JSON.stringify(Array.isArray(card.effects) ? card.effects : card.effect ? [card.effect] : []),
    enabled: card.enabled !== false,
}));
fs.writeFileSync(fullPoolPath, JSON.stringify(fullPool, null, 2), "utf8");
fs.writeFileSync(backendJsonPath, JSON.stringify(fullPool, null, 2), "utf8");
fs.writeFileSync(backendBase64Path, Buffer.from(JSON.stringify(fullPool), "utf8").toString("base64"), "utf8");

console.log(`Generated ${additions.length} new cards; complete pool: ${fullPool.length}.`);
