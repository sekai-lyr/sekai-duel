import { describe, it } from "node:test";
import assert from "node:assert/strict";
global.document = { createElement: () => ({ textContent: "" }) };

const { calculateMatchReward, applyReward, REWARD_TABLE, BONUS_REWARDS } = await import("../js/rewards.js");
const { createDefaultCollection } = await import("../js/collection.js");

describe("奖励系统", () => {
    it("胜利基础奖励正确", () => {
        const r = calculateMatchReward("win", { statistics: { firstWinToday: new Date().toDateString() } });
        assert.equal(r.duelCoins, REWARD_TABLE.win);
    });
    it("失败基础奖励正确", () => {
        const r = calculateMatchReward("loss", { statistics: { firstWinToday: new Date().toDateString() } });
        assert.equal(r.duelCoins, REWARD_TABLE.loss);
    });
    it("平局基础奖励正确", () => {
        const r = calculateMatchReward("draw", { statistics: { firstWinToday: new Date().toDateString() } });
        assert.equal(r.duelCoins, REWARD_TABLE.draw);
    });
    it("训练模式没有奖励", () => {
        const r = calculateMatchReward("training", {});
        assert.equal(r.duelCoins, 0);
    });
    it("每日首次胜利有额外奖励", () => {
        const r = calculateMatchReward("win", { statistics: { firstWinToday: "yesterday" } });
        assert.ok(r.duelCoins > REWARD_TABLE.win);
        assert.ok(r.bonuses.some(b => b.id === "first_win_of_day"));
    });
    it("applyReward正确更新统计", () => {
        const col = createDefaultCollection();
        const start = col.currency.duelCoins;
        applyReward(col, { duelCoins: 120, bonuses: [] });
        assert.equal(col.currency.duelCoins, start + 120);
        assert.equal(col.statistics.duelsPlayed, 1);
        assert.equal(col.statistics.wins, 1);
    });
    it("一次性奖励不能重复领取", () => {
        const col = createDefaultCollection();
        const r1 = applyReward(col, { duelCoins: 2000, claimId: "tutorial_complete", bonuses: [] });
        assert.equal(r1, true);
        const r2 = applyReward(col, { duelCoins: 2000, claimId: "tutorial_complete", bonuses: [] });
        assert.equal(r2, false);
    });
    it("奖励表数值正确", () => {
        assert.equal(REWARD_TABLE.win, 120);
        assert.equal(REWARD_TABLE.loss, 50);
        assert.equal(REWARD_TABLE.draw, 60);
    });
});
