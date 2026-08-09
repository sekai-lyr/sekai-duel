/**
 * anime-cards.js
 * 二次元角色卡牌数据 —— 各种动漫 / 游戏角色魔法卡
 */

import { normalizeCardPool } from "./card-rules.js";

const RAW_ANIME_CARDS = [
    // ================================================================
    //  UR魔法卡
    // ================================================================

    // 1. 八千年的思念 — 从墓地特殊召唤最近2回合内送去墓地的怪兽，当回合不能攻击/作为素材
    {
        id: "nc_sp_ur_001", name: "八千年的思念", series: "nightcord", member: null,
        type: "spell", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 5,
        effects: [{ trigger: "manual", type: "reviveRecentGraveyardV2", value: 2,
            description: "从墓地特殊召唤1只最近2回合以内送入墓地的怪兽；这只怪兽登场后当回合不能攻击、不能用作各类召唤素材。" }],
        description: "从墓地特殊召唤1只最近2回合以内送入墓地的怪兽；这只怪兽登场后当回合不能攻击、不能用作各类召唤素材。",
        image: "./assets/cards/spells/ur/8千年的思念.jpg",
    },

    // 2. 薄采序奏 — 指定一个怪兽在发动回合内发动两次攻击
    {
        id: "nc_sp_ur_002", name: "薄采序奏", series: "nightcord", member: null,
        type: "spell", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 4,
        effects: [{ trigger: "manual", type: "doubleAttack", value: 0,
            target: { owner: "self", zone: "monster", selector: "highestAttack", count: 1 },
            description: "指定己方1只怪兽，本回合内可以发动两次攻击。" }],
        description: "指定己方1只怪兽，本回合内可以发动两次攻击。",
        image: "./assets/cards/spells/ur/薄采序奏.jpg",
    },

    // 3. 不登校的未来 — 指定对方2只怪兽返回手卡
    {
        id: "nc_sp_ur_003", name: "不登校的未来", series: "nightcord", member: null,
        type: "spell", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 3,
        effects: [{ trigger: "manual", type: "returnToHand", value: 0,
            target: { owner: "opponent", zone: "monster", selector: "highestAttack", count: 2 },
            description: "指定对方2只怪兽返回手牌。" }],
        description: "指定对方2只怪兽返回手牌。",
        image: "./assets/cards/spells/ur/不登校的未来.jpg",
    },

    // 4. 放学后的茶会 — 回复过去3回合累计失去的LP + 抽1卡；当回合我方怪兽不能直接攻击
    {
        id: "nc_sp_ur_004", name: "放学后的茶会", series: "nightcord", member: null,
        type: "spell", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 3,
        effects: [{ trigger: "manual", type: "recoverAndDrawV2", value: 3,
            description: "回复自己过去3个回合内累计失去的全部生命值，之后自己抽1张卡。发动的回合，我方所有怪兽无法直接攻击玩家。" }],
        description: "①回复自己过去3个回合内累计失去的全部生命值，之后自己抽1张卡。②发动的回合，我方所有怪兽无法直接攻击玩家。",
        image: "./assets/cards/spells/ur/放学后的茶会.jpg",
    },

    // 5. 碎穹 — 损失90%的生命破坏对方任意两只怪兽卡
    {
        id: "nc_sp_ur_005", name: "碎穹", series: "nightcord", member: null,
        type: "spell", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 6,
        effects: [{ trigger: "manual", type: "sacrificeDestroy", value: 90,
            description: "支付90%当前生命值，破坏对方场上任意2只怪兽卡。" }],
        description: "支付90%当前生命值，破坏对方场上任意2只怪兽卡。",
        image: "./assets/cards/spells/ur/碎穹.jpg",
    },

    // 6. 有刺无刺 — 宣言有刺/无刺，对方选，猜对抽1卡，猜错全场破坏；当回合不能特殊召唤
    {
        id: "nc_sp_ur_006", name: "有刺无刺", series: "nightcord", member: null,
        type: "spell", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 4,
        effects: [{ trigger: "manual", type: "guessGameV2", value: 0,
            description: "宣言「有刺」或者「无刺」，让对方选择其中一个选项。对方选择的选项和你宣言一致（猜对）的场合，你从卡组抽1张卡；不一致（猜错）的场合，双方怪兽区域所有怪兽全部破坏。这张卡发动的回合，自己不能特殊召唤怪兽。" }],
        description: "①宣言「有刺」或者「无刺」，让对方选择其中一个选项。对方选择的选项和你宣言一致（猜对）的场合，你从卡组抽1张卡；不一致（猜错）的场合，双方怪兽区域所有怪兽全部破坏。②这张卡发动的回合，自己不能特殊召唤怪兽。",
        image: "./assets/cards/spells/ur/有刺无刺.jpg",
    },

    // 7. 社恐的焦虑 — 交换双方的手牌
    {
        id: "nc_sp_ur_007", name: "社恐的焦虑", series: "nightcord", member: null,
        type: "spell", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 4,
        effects: [{ trigger: "manual", type: "swapHands", value: 0,
            description: "交换双方的手牌。" }],
        description: "交换双方的手牌。",
        image: "./assets/cards/spells/ur/社恐的焦虑.jpg",
    },

    // 8. 月下传讯 — 丢弃2张手牌抽3张；当回合不能进入战斗阶段
    {
        id: "nc_sp_ur_008", name: "月下传讯", series: "nightcord", member: null,
        type: "spell", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 4,
        effects: [{ trigger: "manual", type: "discardAndDraw", value: 2, drawValue: 3,
            description: "丢弃2张手牌才能发动，自己从卡组抽3张卡。这张卡发动的回合，自己不能进行战斗阶段。" }],
        description: "①丢弃2张手牌才能发动，自己从卡组抽3张卡。②这张卡发动的回合，自己不能进行战斗阶段。",
        image: "./assets/cards/spells/ur/月下传讯.jpg",
    },

    // 9. 最好的伙伴 — 融合两只特定怪兽
    {
        id: "nc_sp_ur_009", name: "最好的伙伴", series: "nightcord", member: null,
        type: "spell", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 5,
        effects: [{ trigger: "manual", type: "fusionSummon", value: 0,
            description: "将手牌或场上两只特定怪兽融合，从牌组或手牌特殊召唤融合怪兽。" }],
        description: "将手牌或场上两只特定怪兽融合，从牌组或手牌特殊召唤融合怪兽。",
        image: "./assets/cards/spells/ur/最好的伙伴.jpg",
    },

    // 10. 游戏王座 — 抽2张，1魔1怪额外抽1张；当回合不能战斗
    {
        id: "nc_sp_ur_010", name: "游戏王座", series: "nightcord", member: null,
        type: "spell", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 4,
        effects: [{ trigger: "manual", type: "gameThroneDraw", value: 2,
            description: "抽2张卡，若其中1张是魔法卡且1张是怪兽卡则额外再抽1张。发动这张卡的回合，你无法进行战斗阶段。" }],
        description: "①抽2张卡，若其中1张是魔法卡且1张是怪兽卡则额外再抽1张。②发动这张卡的回合，你无法进行战斗阶段。",
        image: "./assets/cards/spells/ur/游戏王座.jpg",
    },

    // 10. 寄往遥远彼岸的信 — 封锁对方最多两只怪兽进攻能力，永久封锁
    {
        id: "nc_sp_ur_012", name: "寄往遥远彼岸的信", series: "nightcord", member: null,
        type: "spell", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 5,
        isFieldSpell: false,
        effects: [{ trigger: "manual", type: "lockAttack", value: 2,
            target: { owner: "opponent", zone: "monster", selector: "highestAttack", count: 2 },
            description: "封锁对方最多2只怪兽的攻击能力，永久封锁。被封锁的怪兽可通过作为祭品解放或被效果破坏来解除封锁。" }],
        description: "封锁对方最多2只怪兽的攻击能力，永久封锁。被封锁的怪兽可通过作为祭品解放或被效果破坏来解除封锁。",
        image: "./assets/cards/spells/ur/寄往遥远彼岸的信.jpg",
    },

    // 11. 浅海浮汐 — 场地魔法：变换大海场景 + 水属性怪兽ATK/DEF+450，对方变守备需丢1手牌
    {
        id: "nc_sp_ur_011", name: "浅海浮汐", series: "nightcord", member: null,
        type: "spell", attribute: "water", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 4,
        isFieldSpell: true,
        fieldSpellType: "ocean_scene",
        effects: [
            { trigger: "field", type: "fieldOceanScene", value: 450,
                description: "场地魔法生效：决斗场变换为大海场景。场上所有水属性怪兽攻击力、守备力提升450。" },
            { trigger: "field", type: "fieldWaterBuff", value: 450,
                description: "对方若要把怪兽改为守备表示，必须丢弃1张手牌才可以执行该操作。" }
        ],
        description: "①场地魔法生效：决斗场变换为大海场景。场上所有水属性怪兽攻击力、守备力提升450。②对方若要把怪兽改为守备表示，必须丢弃1张手牌才可以执行该操作。除非被破坏卡破坏，否则永久留在场上。",
        image: "./assets/cards/spells/ur/浅海浮汐.jpg",
    },

    // ================================================================
    //  SSR魔法卡
    // ================================================================

    // 10. 畸变 DNA — 本回合增加怪兽400攻击力，回合结束永久削弱怪兽攻击力700
    {
        id: "nc_sp_ss_001", name: "畸变DNA", series: "nightcord", member: null,
        type: "spell", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "SSR", cost: 4,
        effects: [{ trigger: "manual", type: "buffThenDebuff", value: 400, penalty: 700,
            target: { owner: "self", zone: "monster", selector: "all" },
            description: "本回合己方所有怪兽攻击力+400，回合结束时永久-700。" }],
        description: "本回合己方所有怪兽攻击力+400，回合结束时永久-700。",
        image: "./assets/cards/spells/ssr/畸变DNA.jpg",
    },

    // 11. 夏风石阶的挚友茶会 — 抽两张牌
    {
        id: "nc_sp_ss_002", name: "夏风石阶的挚友茶会", series: "nightcord", member: null,
        type: "spell", attribute: "light", level: 0, attack: 0, defense: 0,
        rarity: "SSR", cost: 3,
        effects: [{ trigger: "manual", type: "drawCards", value: 2,
            description: "抽2张卡。" }],
        description: "抽2张卡。",
        image: "./assets/cards/spells/ssr/夏风石阶的挚友茶会.jpg",
    },

    // 12. 夜刻萦音的永续热忱 — 回复2000LP + 抽1卡；当回合不能特殊召唤
    {
        id: "nc_sp_ss_003", name: "夜刻萦音的永续热忱", series: "nightcord", member: null,
        type: "spell", attribute: "light", level: 0, attack: 0, defense: 0,
        rarity: "SSR", cost: 4,
        effects: [{ trigger: "manual", type: "healDrawNoSpecial", value: 2000, draw: 1,
            description: "以自己为对象发动，回复2000生命值，之后自己抽1张卡。发动的回合，我方不能特殊召唤怪兽。" }],
        description: "①以自己为对象发动，回复2000生命值，之后自己抽1张卡。②发动的回合，我方不能特殊召唤怪兽。",
        image: "./assets/cards/spells/ssr/夜刻萦音的永续热忱.jpg",
    },

    // 13. 幽蝶旧画的沉郁祈愿 — 抽对面两张卡，同类型还回去魔法失败，不同类型归自己魔法成功
    {
        id: "nc_sp_ss_004", name: "幽蝶旧画的沉郁祈愿", series: "nightcord", member: null,
        type: "spell", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "SSR", cost: 5,
        effects: [{ trigger: "manual", type: "snatchCards", value: 2,
            description: "随机抽取对方手牌2张。若两张卡类型相同（都是怪兽/魔法/陷阱），则归还对方，魔法失败；若类型不同，则归你所有，魔法成功。" }],
        description: "随机抽取对方手牌2张。若两张卡类型相同，归还对方（魔法失败）；若类型不同，归你所有（魔法成功）。",
        image: "./assets/cards/spells/ssr/幽蝶旧画的沉郁祈愿.jpg",
    },

    // 14. 奏响点亮天空 — 将手牌都回收墓区，再抽和回收手牌相同数量的牌
    {
        id: "nc_sp_ss_005", name: "奏响点亮天空", series: "nightcord", member: null,
        type: "spell", attribute: "light", level: 0, attack: 0, defense: 0,
        rarity: "SSR", cost: 4,
        effects: [{ trigger: "manual", type: "recycleAndDraw", owner: "self",
            description: "将己方所有手牌送入墓地，然后抽取相同数量的卡。" }],
        description: "将己方所有手牌送入墓地，然后抽取相同数量的卡。",
        image: "./assets/cards/spells/ssr/奏响点亮天空.jpg",
    },

    // 15. 沉睡的蓝调 — ①自己全部手牌送墓发动，对方全部手牌送墓，双方抽各自送墓数量的卡；②当回合双方不能从手牌发动怪兽效果
    {
        id: "nc_sp_ss_006", name: "沉睡的蓝调", series: "nightcord", member: null,
        type: "spell", attribute: "water", level: 0, attack: 0, defense: 0,
        rarity: "SSR", cost: 4,
        effects: [{ trigger: "manual", type: "mutualHandRefresh", value: 0,
            description: "将自己全部手牌送入墓地才能发动。将对方所有手牌送入墓地，双方各自从卡组抽出和自身送去墓地手牌数量相同的卡。这张卡发动的回合，双方都不能从手牌发动怪兽效果。" }],
        description: "①将自己全部手牌送入墓地才能发动。将对方所有手牌送入墓地，双方各自从卡组抽出和自身送去墓地手牌数量相同的卡。②这张卡发动的回合，双方都不能从手牌发动怪兽效果。",
        image: "./assets/cards/spells/ssr/沉睡的蓝调.jpg",
    },

    // ================================================================
    //  UR 陷阱卡
    // ================================================================

    // 1. 暮雨长街的独行 — 通常陷阱：攻击宣言时无效攻击，2次以上攻击可额外回手
    {
        id: "nc_tr_001", name: "暮雨长街的独行", series: "nightcord", member: null,
        type: "trap", attribute: "dark", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 0,
        effects: [{ trigger: "battle", type: "cancelAttackAndReturn", value: 2,
            description: "对方攻击宣言时发动。本次攻击无效。若对方本回合已攻击2次及以上，额外将1只攻击怪兽返回手牌。" }],
        description: "①本次对方这一次攻击无效。若对方本回合已经进行2次及以上攻击，可额外将场上1只进行攻击的怪兽返回持有者手牌。限制：一回合仅能发动一张同名卡。",
        image: "./assets/cards/traps/ur/暮雨长街的独行.jpg",
    },

    // 2. 寒岭汤泉的憩息 — 永续陷阱：我方怪兽被战斗破坏时，移除墓地1张卡使破坏无效
    {
        id: "nc_tr_002", name: "寒岭汤泉的憩息", series: "nightcord", member: null,
        type: "trap", attribute: "light", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 0,
        effects: [{ trigger: "battle", type: "preventDestructionByBanish", value: 1,
            description: "我方怪兽即将被战斗破坏时，移除我方墓地1张卡，使该怪兽本次战斗破坏无效。" }],
        description: "①移除我方墓地1张卡为代价，使我方1只怪兽本次战斗破坏无效。限制：每回合仅能使用1次，无法保护多只怪兽，离场后效果消失。",
        image: "./assets/cards/traps/ur/寒岭汤泉的憩息.jpg",
    },

    // 3. 澄湖栈桥的余晖 — 永续陷阱：任意卡送墓时叠放寄存，主要阶段可回收
    {
        id: "nc_tr_003", name: "澄湖栈桥的余晖", series: "nightcord", member: null,
        type: "trap", attribute: "water", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 0,
        effects: [{ trigger: "any", type: "trapStackAndRecover", value: 2,
            description: "任意卡被送入墓地时，将该卡叠放寄存（最多2张）。我方主要阶段可移除1张寄存卡返回手牌。" }],
        description: "①将刚送入墓地的那1张卡叠放在此卡下寄存，最多寄存2张。我方主要阶段移除1张寄存卡返回手牌。限制：寄存上限2张，离场寄存卡回归墓地。",
        image: "./assets/cards/traps/ur/澄湖栈桥的余晖.jpg",
    },

    // 4. 夏空校舍的流云 — 通常陷阱：对方准备阶段除外对方1只怪兽
    {
        id: "nc_tr_004", name: "夏空校舍的流云", series: "nightcord", member: null,
        type: "trap", attribute: "wind", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 0,
        effects: [{ trigger: "standby", type: "temporaryBanish", value: 1,
            description: "对方准备阶段发动，将对方1只怪兽暂时除外，回合结束时返还。" }],
        description: "①将对方场上1只怪兽暂时除外，对方回合结束时返还场上；这只被除外的怪兽仅本回合无法进行攻击，效果正常生效。",
        image: "./assets/cards/traps/ur/夏空校舍的流云.jpg",
    },

    // 5. 星降神篱的祈愿 — 反击陷阱：无效对方怪兽效果/魔法卡生效
    {
        id: "nc_tr_005", name: "星降神篱的祈愿", series: "nightcord", member: null,
        type: "trap", attribute: "light", level: 0, attack: 0, defense: 0,
        rarity: "UR", cost: 0,
        isCounterTrap: true,
        effects: [{ trigger: "counter", type: "negateCounterEffect", value: 1,
            description: "对方怪兽效果/魔法卡即将生效时，无效本次生效。不破坏那张卡。" }],
        description: "①仅抵消本次单张卡牌的生效，不破坏那张卡，卡牌保留在原区域。限制：整局游戏仅能从墓地回收此卡1次。",
        image: "./assets/cards/traps/ur/星降神篱的祈愿.jpg",
    },
];

export const ANIME_CARDS = normalizeCardPool(RAW_ANIME_CARDS);

// 稀有度统计
export const ANIME_RARITY_COUNTS = { N: 0, R: 0, SR: 0, SSR: 6, UR: 17 };
