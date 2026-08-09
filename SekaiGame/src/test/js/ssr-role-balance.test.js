import assert from "node:assert/strict";
import test from "node:test";

import { ALL_CARDS } from "../../main/resources/static/js/catalog.js";
import { hasEffectHandler } from "../../main/resources/static/js/engine.js";

test("SSR怪兽统一为三项清晰技能", () => {
    const cards = ALL_CARDS.filter(card => card.type === "monster" && card.rarity === "SSR");
    assert.ok(cards.length >= 40);
    for (const card of cards) {
        assert.equal(card.effects.length, 3, `${card.name}应有登场技、连携技和终结技`);
        assert.ok(card.effects.every(effect => hasEffectHandler(effect.type)), `${card.name}存在无法执行的效果`);
        assert.ok(card.effects.every(effect => /^【(登场技|连携技|终结技)·.+】(召唤成功时|被破坏时|对方怪兽攻击时|发动时)：/u.test(effect.description)), `${card.name}触发说明不清晰`);
    }
});

test("不同SSR仍保留多种战术方向", () => {
    const cards = ALL_CARDS.filter(card => card.type === "monster" && card.rarity === "SSR");
    const effectTypes = new Set(cards.flatMap(card => card.effects.map(effect => effect.type)));
    assert.ok(effectTypes.size >= 8, `SSR机制种类不足：${effectTypes.size}`);
});
