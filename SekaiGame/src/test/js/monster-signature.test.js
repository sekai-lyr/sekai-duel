import assert from "node:assert/strict";
import { getMonsterVisualSignature } from "../../main/resources/static/js/effects.js";

const normal = getMonsterVisualSignature("新手士兵", "N", "earth");
assert.equal(normal.enabled, false, "N rarity monsters must not use signature cinematics");

const rare = getMonsterVisualSignature("我妻善逸", "R", "light");
const ultra = getMonsterVisualSignature("我妻善逸", "UR", "light");
assert.equal(rare.enabled, true);
assert.equal(rare.zenitsu, true);
assert.ok(ultra.intensity > rare.intensity, "rarity must increase visual intensity");

const first = getMonsterVisualSignature("炭治郎", "SR", "fire");
const second = getMonsterVisualSignature("富冈义勇", "SR", "water");
assert.notEqual(first.seed, second.seed, "different monsters need stable distinct signatures");

console.log("monster signature tests passed");
