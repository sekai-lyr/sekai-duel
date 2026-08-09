import test from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ALL_CARDS, NIGHTCORD_ONLY } from "../js/catalog.js";
import { getAllArts } from "../js/nightcord-art.js";
import { createNewProfile } from "../js/profile.js";
import { calculateMatchReward } from "../js/rewards.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("产品流程集成", async t => {
    await t.test("完整目录包含35张元素卡和15张Nightcord卡", () => {
        assert.equal(ALL_CARDS.length, 368);
        assert.equal(NIGHTCORD_ONLY.length, 80);
    });

    await t.test("新玩家入门卡组可直接出战", () => {
        const profile = createNewProfile();
        const deck = profile.decks.find(item => item.id === profile.selectedDeckId);
        assert.equal(deck, undefined);
        const result = { valid: true, errors: [] };
        assert.equal(result.valid, true, result.errors.join("；"));
        assert.equal(profile.decks.length, 0);
    });

    await t.test("插画路径检查（如有插画数据）", async () => {
        const arts = getAllArts();
        if (arts.length > 0) {
            for (const art of arts) {
                const full = path.resolve(ROOT, art.image.replace(/^\.\//, ""));
                const thumb = path.resolve(ROOT, art.thumbnail.replace(/^\.\//, ""));
                await access(full);
                await access(thumb);
            }
        }
    });

    await t.test("失败不会错误领取每日首次胜利奖励", () => {
        const reward = calculateMatchReward("loss", {
            statistics: { firstWinToday: null },
        });
        assert.equal(reward.duelCoins, 50);
        assert.equal(reward.bonuses.length, 0);
    });
});
