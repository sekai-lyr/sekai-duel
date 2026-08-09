import assert from "node:assert/strict";
import test from "node:test";

import { ALL_CARDS } from "../../main/resources/static/js/catalog.js";

test("自动生成卡牌使用直白描述且不再出现强度公式", () => {
    for (const card of ALL_CARDS.filter(item => item.ruleTier)) {
        assert.doesNotMatch(card.description || "", /强度＝|结算①|结算②|该强度/u, `${card.name}仍使用复杂公式`);
        for (const effect of card.effects || []) {
            assert.ok(effect.description?.includes("："), `${card.name}缺少明确触发时机`);
        }
    }
});

test("角色卡固定三项技能，其他自动生成卡最多两个效果", () => {
    for (const card of ALL_CARDS.filter(item => item.series !== "starter_ygo")) {
        const expectedMaximum = card.type === "monster" && card.rarity !== "N" ? 3 : 2;
        assert.ok((card.effects || []).length <= expectedMaximum, `${card.name}效果数量超限`);
    }
});
