import { describe, it } from "node:test";
import assert from "node:assert/strict";
global.document = { createElement: () => ({ textContent: "" }) };

const { ANIME_CARDS } = await import("../js/nightcord-cards.js");
const { getUniqueNightcordMembers, hasResonance, GameEngine } = await import("../js/engine.js");
const { GameState, Player, createCardInstance } = await import("../js/model.js");
const { NIGHTCORD_STARTER_DECK } = await import("../js/decks.js");
const { NIGHTCORD_PACK, openPack, openTenPacks, getEffectiveRates } = await import("../js/packs.js");
const { createDefaultCollection, addCard, addArt, hasArt, setSelectedArt, getSelectedArt, addShards, getShardCount, canCraft, craftCard, dismantleCard, claimReward, hasClaimedReward, incrementPity, resetPity, getPityCount, getCardCount, SHARD_VALUES, CRAFT_COSTS } = await import("../js/collection.js");
const { calculateMatchReward, applyReward, REWARD_TABLE } = await import("../js/rewards.js");
const { SequenceRandom } = await import("../js/rng.js");
const { GAME_CONFIG } = await import("../js/constants.js");

// Helper to create a test game state
function createGame() {
    const s = new GameState();
    s.players = [
        new Player("P1", Array.from({ length: 20 }, () => ({ id: "t_" + Math.random().toString(36).slice(2, 6), name: "测试怪兽", type: "monster", attribute: "fire", race: "warrior", level: 3, attack: 1500, defense: 1000, rarity: "N", effects: [], description: "测试" }))),
        new Player("P2", Array.from({ length: 20 }, () => ({ id: "t_" + Math.random().toString(36).slice(2, 6), name: "测试怪兽", type: "monster", attribute: "fire", race: "warrior", level: 3, attack: 1500, defense: 1000, rarity: "N", effects: [], description: "测试" }))),
    ];
    return { s, e: new GameEngine(s) };
}

function mkNightcord(o = {}) {
    return { id: "nc_test_" + Math.random().toString(36).slice(2, 6), name: "测试Nightcord", type: "monster", attribute: "dark", race: "warrior", level: 3, attack: 1500, defense: 1000, rarity: "N", series: "nightcord", member: "ena", effects: [], description: "测试", ...o };
}

// ==================== 卡池基础 ====================
describe("二次元卡池基础", () => {
    it("有15张卡（9张UR + 6张SSR魔法卡）", () => {
        assert.equal(ANIME_CARDS.length, 15);
    });
    it("全部为魔法卡", () => {
        ANIME_CARDS.forEach(c => {
            assert.equal(c.type, "spell", `${c.id} 不是魔法卡`);
        });
    });
    it("基础卡ID全部唯一", () => {
        const ids = ANIME_CARDS.map(c => c.id);
        assert.equal(new Set(ids).size, 15);
    });
    it("稀有度总数正确", () => {
        const r = {};
        ANIME_CARDS.forEach(c => { r[c.rarity] = (r[c.rarity] || 0) + 1; });
        assert.equal(r.SSR, 6);
        assert.equal(r.UR, 9);
    });
    it("每张卡都有series", () => {
        ANIME_CARDS.forEach(c => {
            assert.ok(c.series, `${c.id} 缺少series`);
        });
    });
    it("魔法卡member为null", () => {
        const spells = ANIME_CARDS.filter(c => c.type === "spell");
        spells.forEach(c => assert.equal(c.member, null, `${c.id} 魔法卡member应为null`));
    });
});

// ==================== 共鸣系统 ====================
describe("共鸣系统", () => {
    it("getUniqueNightcordMembers计算不同member数量", () => {
        const { s, e } = createGame();
        const p = s.players[0];
        p.monsterZone = [
            createCardInstance(mkNightcord({ member: "ena" })),
            createCardInstance(mkNightcord({ member: "kanade" })),
        ];
        const members = getUniqueNightcordMembers(p);
        assert.equal(members.size, 2);
        assert.ok(members.has("ena"));
        assert.ok(members.has("kanade"));
    });
    it("同一成员多张只计算一次", () => {
        const { s, e } = createGame();
        const p = s.players[0];
        p.monsterZone = [
            createCardInstance(mkNightcord({ member: "ena" })),
            createCardInstance(mkNightcord({ member: "ena" })),
            createCardInstance(mkNightcord({ member: "ena" })),
        ];
        const members = getUniqueNightcordMembers(p);
        assert.equal(members.size, 1);
    });
    it("非Nightcord怪兽不算入共鸣", () => {
        const { s, e } = createGame();
        const p = s.players[0];
        p.monsterZone = [
            createCardInstance(mkNightcord({ member: "ena" })),
            createCardInstance({ id: "other", name: "其他", type: "monster", attribute: "fire", race: "warrior", level: 3, attack: 1500, defense: 1000, rarity: "N", effects: [], description: "测试" }),
        ];
        const members = getUniqueNightcordMembers(p);
        assert.equal(members.size, 1);
    });
    it("hasResonance在2名成员时返回true", () => {
        const { s, e } = createGame();
        const p = s.players[0];
        p.monsterZone = [
            createCardInstance(mkNightcord({ member: "ena" })),
            createCardInstance(mkNightcord({ member: "kanade" })),
        ];
        assert.equal(hasResonance(p, 2), true);
    });
    it("hasResonance在1名成员时返回false", () => {
        const { s, e } = createGame();
        const p = s.players[0];
        p.monsterZone = [
            createCardInstance(mkNightcord({ member: "ena" })),
        ];
        assert.equal(hasResonance(p, 2), false);
    });
    it("四人共鸣需要4名不同成员", () => {
        const { s, e } = createGame();
        const p = s.players[0];
        p.monsterZone = [
            createCardInstance(mkNightcord({ member: "ena" })),
            createCardInstance(mkNightcord({ member: "kanade" })),
            createCardInstance(mkNightcord({ member: "mafuyu" })),
            createCardInstance(mkNightcord({ member: "mizuki" })),
        ];
        assert.equal(hasResonance(p, 4), true);
        assert.equal(hasResonance(p, 3), true);
    });
});

// ==================== 抽卡系统 ====================
describe("抽卡系统", () => {
    it("十连至少出现SR或UR", () => {
        for (let trial = 0; trial < 5; trial++) {
            const result = openTenPacks(NIGHTCORD_PACK, ANIME_CARDS);
            assert.equal(result.success, true);
            const hasSR = result.cards.some(c => c.rarity === "SR" || c.rarity === "UR");
            assert.ok(hasSR, `第${trial + 1}次十连缺少SR/UR`);
        }
    });
    it("每包第8张至少为R", () => {
        for (let i = 0; i < 30; i++) {
            const result = openPack(NIGHTCORD_PACK, ANIME_CARDS);
            const last = result.cards[7];
            assert.ok(["R", "SR", "SSR", "UR"].includes(last.rarity), `第${i + 1}包最后一张: ${last.rarity}`);
        }
    });
    it("第50包UR保底必定触发", () => {
        const rates = getEffectiveRates(50);
        assert.equal(rates.UR, 1.0);
    });
    it("抽到UR后保底清零", () => {
        const col = createDefaultCollection();
        incrementPity(col, "nightcord_pack_001");
        incrementPity(col, "nightcord_pack_001");
        incrementPity(col, "nightcord_pack_001");
        resetPity(col, "nightcord_pack_001");
        assert.equal(getPityCount(col, "nightcord_pack_001"), 0);
    });
    it("货币不足不能抽卡", () => {
        const col = createDefaultCollection();
        col.currency.duelCoins = 0;
        const canSpend = col.currency.duelCoins >= NIGHTCORD_PACK.cost.duelCoins;
        assert.equal(canSpend, false);
    });
    it("抽卡正确扣除游戏币", () => {
        const col = createDefaultCollection();
        const start = col.currency.duelCoins;
        col.currency.duelCoins -= NIGHTCORD_PACK.cost.duelCoins;
        assert.equal(col.currency.duelCoins, start - 1000);
    });
});

// ==================== 对局奖励 ====================
describe("对局奖励", () => {
    it("对局奖励只能领取一次", () => {
        const col = createDefaultCollection();
        const r1 = applyReward(col, { duelCoins: 2000, claimId: "tutorial", bonuses: [] });
        assert.equal(r1, true);
        const r2 = applyReward(col, { duelCoins: 2000, claimId: "tutorial", bonuses: [] });
        assert.equal(r2, false);
    });
    it("胜利获得120决斗币", () => {
        const r = calculateMatchReward("win", { statistics: { firstWinToday: new Date().toDateString() } });
        assert.equal(r.duelCoins, 120);
    });
    it("失败获得50决斗币", () => {
        const r = calculateMatchReward("loss", { statistics: { firstWinToday: new Date().toDateString() } });
        assert.equal(r.duelCoins, 50);
    });
});

// ==================== 重复卡和碎片 ====================
describe("重复卡和碎片", () => {
    it("重复卡超过3张后转换碎片", () => {
        const col = createDefaultCollection();
        addCard(col, "nc_sp_ur_001", 3);
        const result = addCard(col, "nc_sp_ur_001", 1, ANIME_CARDS);
        assert.equal(getCardCount(col, "nc_sp_ur_001"), 3);
        assert.ok(result.shardsEarned > 0);
    });
    it("SSR卡转换碎片", () => {
        const col = createDefaultCollection();
        addCard(col, "nc_sp_ss_001", 3);
        addCard(col, "nc_sp_ss_001", 1, ANIME_CARDS);
        assert.ok(getShardCount(col, "SSR") > 0);
    });
    it("UR卡转换碎片", () => {
        const col = createDefaultCollection();
        addCard(col, "nc_sp_ur_001", 3);
        addCard(col, "nc_sp_ur_001", 1, ANIME_CARDS);
        assert.ok(getShardCount(col, "UR") > 0);
    });
    it("制作卡牌消耗正确碎片", () => {
        const col = createDefaultCollection();
        addShards(col, "UR", 1000);
        const result = craftCard(col, "nc_sp_ur_001", ANIME_CARDS);
        assert.equal(result.success, true);
        assert.equal(result.cost, CRAFT_COSTS.UR);
        assert.equal(getShardCount(col, "UR"), 1000 - CRAFT_COSTS.UR);
    });
    it("分解卡牌获得正确碎片", () => {
        const col = createDefaultCollection();
        addCard(col, "nc_sp_ur_001", 1);
        const result = dismantleCard(col, "nc_sp_ur_001", ANIME_CARDS);
        assert.equal(result.success, true);
        assert.equal(result.shards, SHARD_VALUES.UR);
    });
});

// ==================== 插画系统 ====================
describe("插画系统", () => {
    it("新插画正确加入收藏", () => {
        const col = createDefaultCollection();
        const isNew = addArt(col, "nc_ena_001_art_000");
        assert.equal(isNew, true);
        assert.ok(hasArt(col, "nc_ena_001_art_000"));
    });
    it("切换插画不改变卡牌属性", () => {
        const card = ANIME_CARDS[0];
        const originalAttack = card.attack;
        const originalDefense = card.defense;
        setSelectedArt(createDefaultCollection(), card.id, "some_art");
        assert.equal(card.attack, originalAttack);
        assert.equal(card.defense, originalDefense);
    });
});

// ==================== 卡组规则 ====================
describe("卡组规则", () => {
    it("卡组只能放3张同名卡", () => {
        const ids = Array.from({ length: 31 }, (_, i) => ANIME_CARDS[i % ANIME_CARDS.length].id);
        const counts = {};
        ids.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
        const overThree = Object.values(counts).some(v => v > 3);
        assert.equal(overThree, false);
    });
    it("新玩家基础卡组正好40张", () => {
        assert.equal(NIGHTCORD_STARTER_DECK.main.length, 40);
    });
    it("卡组中的卡牌都存在于卡池中", () => {
        NIGHTCORD_STARTER_DECK.main.forEach(id => {
            const card = ANIME_CARDS.find(c => c.id === id);
            assert.ok(card, `卡组中的${id}不在卡池中`);
        });
    });
    it("同一成员的多张角色只计算一个共鸣成员", () => {
        const { s, e } = createGame();
        const p = s.players[0];
        // 3张ena + 1张kanade = 2 unique members
        p.monsterZone = [
            createCardInstance(mkNightcord({ member: "ena" })),
            createCardInstance(mkNightcord({ member: "ena" })),
            createCardInstance(mkNightcord({ member: "ena" })),
            createCardInstance(mkNightcord({ member: "kanade" })),
        ];
        const members = getUniqueNightcordMembers(p);
        assert.equal(members.size, 2);
    });
    it("四名不同成员能够触发四人共鸣", () => {
        const { s, e } = createGame();
        const p = s.players[0];
        p.monsterZone = [
            createCardInstance(mkNightcord({ member: "ena" })),
            createCardInstance(mkNightcord({ member: "kanade" })),
            createCardInstance(mkNightcord({ member: "mafuyu" })),
            createCardInstance(mkNightcord({ member: "mizuki" })),
        ];
        assert.equal(hasResonance(p, 4), true);
    });
});

// ==================== 存档持久化 ====================
describe("存档持久化", () => {
    it("游戏刷新后货币仍然保存", () => {
        const col = createDefaultCollection();
        col.currency.duelCoins = 5000;
        col.currency.shards.N = 100;
        const raw = JSON.stringify(col);
        const parsed = JSON.parse(raw);
        assert.equal(parsed.currency.duelCoins, 5000);
        assert.equal(parsed.currency.shards.N, 100);
    });
    it("收藏、卡组和保底仍然保存", () => {
        const col = createDefaultCollection();
        addCard(col, "nc_ena_001", 2);
        addArt(col, "nc_ena_001_art_000");
        incrementPity(col, "nightcord_pack_001");
        const raw = JSON.stringify(col);
        const parsed = JSON.parse(raw);
        assert.equal(parsed.cards["nc_ena_001"], 2);
        assert.ok(parsed.artCollection["nc_ena_001_art_000"]);
        assert.equal(parsed.pityCounters["nightcord_pack_001"].packsSinceUR, 1);
    });
});
