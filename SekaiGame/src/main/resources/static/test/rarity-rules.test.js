import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ALL_CARDS } from "../js/catalog.js";

const customCards = ALL_CARDS.filter(card => ["picture", "source_archive"].includes(card.series));

describe("自制卡稀有度规则分层", () => {
    it("每张自制卡都有唯一规则签名", () => {
        assert.equal(new Set(customCards.map(card => card.ruleSignature)).size, customCards.length);
    });

    it("SR以上非陷阱卡拥有多段效果", () => {
        customCards
            .filter(card => ["SR", "SSR", "UR"].includes(card.rarity) && card.type !== "trap")
            .forEach(card => assert.ok(card.effects.length >= 2, `${card.id} 缺少连携效果`));
    });

    it("UR非陷阱卡固定拥有三段终结效果", () => {
        customCards
            .filter(card => card.rarity === "UR" && card.type !== "trap")
            .forEach(card => assert.equal(card.effects.length, 3, `${card.id} 不是三段效果`));
    });

    it("所有自制卡效果都有描述和执行类型", () => {
        customCards.forEach(card => card.effects.forEach(cardEffect => {
            assert.ok(cardEffect.type);
            assert.ok(cardEffect.description);
        }));
    });
});
