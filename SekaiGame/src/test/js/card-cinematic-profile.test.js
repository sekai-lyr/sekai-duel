import assert from "node:assert/strict";
import test from "node:test";

import { ALL_CARDS } from "../../main/resources/static/js/catalog.js";
import { getCardVisualTheme } from "../../main/resources/static/js/effects.js";
import { getMonsterCinematicProfile } from "../../main/resources/static/js/monster-cinematics.js";

test("每张非N怪兽都有登场与攻击演出配置", () => {
    const monsters = ALL_CARDS.filter(card => card.type === "monster" && card.rarity !== "N");
    for (const card of monsters) {
        const profile = getMonsterCinematicProfile(card);
        assert.ok(profile, `${card.name}缺少演出配置`);
        assert.ok(profile.summonStyle && profile.attackStyle, `${card.name}缺少登场或攻击样式`);
        assert.ok(profile.summonTitle && profile.attackTitle, `${card.name}缺少招式标题`);
    }
});

test("空条承太郎的攻击使用欧拉连打而非复用时停登场", () => {
    const profile = getMonsterCinematicProfile({ name: "空条承太郎·白金之星", rarity: "UR", attribute: "dark" });
    assert.equal(profile.summonStyle, "time-stop");
    assert.equal(profile.attackStyle, "ora-rush");
    assert.equal(profile.attackTitle, "白金之星");
});

test("每张魔法与陷阱由图片名称规则生成稳定且独立的演出", () => {
    const cards = ALL_CARDS.filter(card => card.type === "spell" || card.type === "trap");
    const seeds = new Set();
    for (const card of cards) {
        const theme = getCardVisualTheme(card);
        assert.ok(theme.image, `${card.name}的演出没有使用卡图`);
        assert.ok(theme.label && theme.effectKey && theme.effectMotion, `${card.name}演出信息不完整`);
        assert.ok(!seeds.has(theme.seed), `${card.name}与其他卡共用了演出签名`);
        seeds.add(theme.seed);
    }
});
