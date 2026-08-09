import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { ALL_CARDS } from "../../main/resources/static/js/catalog.js";
import { cardEffectFieldsHtml } from "../../main/resources/static/js/card-view.js";

test("全部非N怪兽右键详情包含独立的登场技、连携技和终结技字段", () => {
    const monsters = ALL_CARDS.filter(card => card.type === "monster" && card.rarity !== "N");
    assert.ok(monsters.length >= 180);
    for (const card of monsters) {
        const html = cardEffectFieldsHtml(card);
        assert.match(html, />登场技</u, `${card.name}缺少登场技字段`);
        assert.match(html, />连携技</u, `${card.name}缺少连携技字段`);
        assert.match(html, />终结技</u, `${card.name}缺少终结技字段`);
        assert.equal((html.match(/detail-effect-field/g) || []).length, 4, `${card.name}详情字段数量异常`);
    }
});

test("详情机械说明不会重复嵌套技能标签和触发时机", () => {
    const card = ALL_CARDS.find(item => item.id === "picture_ex_017");
    const html = cardEffectFieldsHtml(card);
    assert.equal((html.match(/恐龙化/g) || []).length, 1);
    assert.equal((html.match(/召唤成功时/g) || []).length, 3);
});

test("选择操作弹窗复用完整详情的分块效果组件", async () => {
    const source = await readFile(new URL("../../main/resources/static/js/ui.js", import.meta.url), "utf8");
    assert.match(source, /class="card-action-effects" id="card-action-description"/u);
    assert.match(source, /description\.innerHTML = cardEffectFieldsHtml\(card\)/u);
    assert.doesNotMatch(source, /description\.textContent = card\.description/u);
});
