import { describe, it } from "node:test";
import assert from "node:assert/strict";
global.document = { createElement: () => ({ textContent: "" }) };

const { createDefaultCollection, createDemoCollection, addCard, removeCard, getCardCount, hasCard, enableDemoMode, addDuelPoints, spendDuelPoints, addShards, spendShards, getShardCount, canCraft, craftCard, dismantleCard, addArt, hasArt, setSelectedArt, getSelectedArt, claimReward, hasClaimedReward, getPityCount, incrementPity, resetPity, SHARD_VALUES, CRAFT_COSTS } = await import("../js/collection.js");
const { cardDatabase } = await import("../js/cards.js");

describe("收藏系统", () => {
    it("新存档生成基础收藏", () => {
        const col = createDefaultCollection();
        assert.ok(col.cards);
        assert.ok(col.currency);
        assert.ok(col.statistics);
        assert.equal(col.version, 2);
    });
    it("添加卡牌会累加数量", () => {
        const col = createDefaultCollection();
        addCard(col, "fire_001", 2);
        addCard(col, "fire_001", 1);
        assert.equal(getCardCount(col, "fire_001"), 3);
    });
    it("超过3张自动转碎片", () => {
        const col = createDefaultCollection();
        addCard(col, "fire_001", 2);
        const result = addCard(col, "fire_001", 2, cardDatabase);
        assert.equal(getCardCount(col, "fire_001"), 3);
        assert.ok(result.shardsEarned > 0);
    });
    it("数量不能为负", () => {
        const col = createDefaultCollection();
        addCard(col, "fire_001", 1);
        const result = removeCard(col, "fire_001", 5);
        assert.equal(result, false);
        assert.equal(getCardCount(col, "fire_001"), 1);
    });
    it("不存在的卡牌ID被拒绝", () => {
        const col = createDefaultCollection();
        addCard(col, "nonexistent", 1, cardDatabase);
        assert.equal(getCardCount(col, "nonexistent"), 0);
    });
    it("演示模式正确解锁", () => {
        const col = createDefaultCollection();
        enableDemoMode(col, cardDatabase);
        assert.equal(col.settings.demoMode, true);
        assert.ok(col.currency.duelCoins > 90000);
        cardDatabase.forEach(c => {
            if (c.enabled !== false) assert.ok(getCardCount(col, c.id) >= 3);
        });
    });
    it("新卡加入后旧存档不会损坏", () => {
        const col = createDefaultCollection();
        addCard(col, "fire_001", 2);
        const raw = JSON.stringify(col);
        const parsed = JSON.parse(raw);
        assert.equal(parsed.cards["fire_001"], 2);
    });
    it("导入损坏存档时使用安全默认值", async () => {
        const { importSave } = await import("../js/storage.js");
        const result = importSave('{"invalid": true}');
        assert.equal(result.success, false);
    });
    it("删除卡组不影响收藏", () => {
        const col = createDefaultCollection();
        addCard(col, "fire_001", 3);
        const before = getCardCount(col, "fire_001");
        assert.equal(before, 3);
        assert.equal(getCardCount(col, "fire_001"), 3);
    });
    it("货币操作正确", () => {
        const col = createDefaultCollection();
        const start = col.currency.duelCoins;
        addDuelPoints(col, 100);
        assert.equal(col.currency.duelCoins, start + 100);
        assert.ok(spendDuelPoints(col, 50));
        assert.equal(col.currency.duelCoins, start + 50);
        assert.equal(spendDuelPoints(col, 999999), false);
    });
});

describe("碎片系统", () => {
    it("分解卡牌获得碎片", () => {
        const col = createDefaultCollection();
        addCard(col, "fire_001", 3);
        const result = dismantleCard(col, "fire_001", cardDatabase);
        assert.equal(result.success, true);
        assert.equal(result.shards, SHARD_VALUES[cardDatabase.find(c => c.id === "fire_001").rarity]);
    });
    it("碎片不足不能制作", () => {
        const col = createDefaultCollection();
        const check = canCraft(col, "fire_001", cardDatabase);
        assert.equal(check.canCraft, false);
    });
    it("碎片足够可以制作", () => {
        const col = createDefaultCollection();
        const card = cardDatabase.find(c => c.id === "fire_001");
        addShards(col, card.rarity, 999);
        const check = canCraft(col, "fire_001", cardDatabase);
        assert.equal(check.canCraft, true);
        const result = craftCard(col, "fire_001", cardDatabase);
        assert.equal(result.success, true);
        assert.equal(getCardCount(col, "fire_001"), 1);
    });
});

describe("插画系统", () => {
    it("添加新插画返回true", () => {
        const col = createDefaultCollection();
        assert.equal(addArt(col, "test_art_001"), true);
    });
    it("重复添加返回false", () => {
        const col = createDefaultCollection();
        addArt(col, "test_art_001");
        assert.equal(addArt(col, "test_art_001"), false);
    });
    it("设置和获取默认插画", () => {
        const col = createDefaultCollection();
        setSelectedArt(col, "fire_001", "fire_001_art_001");
        assert.equal(getSelectedArt(col, "fire_001"), "fire_001_art_001");
    });
});

describe("一次性奖励", () => {
    it("首次领取成功", () => {
        const col = createDefaultCollection();
        assert.equal(claimReward(col, "test_reward"), true);
    });
    it("重复领取失败", () => {
        const col = createDefaultCollection();
        claimReward(col, "test_reward");
        assert.equal(claimReward(col, "test_reward"), false);
    });
});

describe("保底系统", () => {
    it("初始保底计数为0", () => {
        const col = createDefaultCollection();
        assert.equal(getPityCount(col, "test_pack"), 0);
    });
    it("增加保底计数", () => {
        const col = createDefaultCollection();
        incrementPity(col, "test_pack");
        assert.equal(getPityCount(col, "test_pack"), 1);
        incrementPity(col, "test_pack");
        assert.equal(getPityCount(col, "test_pack"), 2);
    });
    it("重置保底计数", () => {
        const col = createDefaultCollection();
        incrementPity(col, "test_pack");
        incrementPity(col, "test_pack");
        resetPity(col, "test_pack");
        assert.equal(getPityCount(col, "test_pack"), 0);
    });
});
