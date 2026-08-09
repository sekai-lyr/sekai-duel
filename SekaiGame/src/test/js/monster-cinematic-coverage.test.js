import assert from "node:assert/strict";
import { ALL_CARDS } from "../../main/resources/static/js/catalog.js";
import { getMonsterCinematicProfile } from "../../main/resources/static/js/monster-cinematics.js";

const nonNormalMonsters = ALL_CARDS.filter(card => card.type === "monster" && card.rarity !== "N");
assert.ok(nonNormalMonsters.length > 0);

for (const card of nonNormalMonsters) {
    const profile = getMonsterCinematicProfile(card);
    assert.ok(profile, `${card.name} lacks a cinematic profile`);
    assert.ok(profile.style, `${card.name} lacks a visual style`);
    assert.ok(profile.attackTitle, `${card.name} lacks an attack title`);
}

assert.equal(getMonsterCinematicProfile({ name: "N怪兽", rarity: "N", attribute: "fire" }), null);
console.log(`monster cinematic coverage passed: ${nonNormalMonsters.length} cards`);
