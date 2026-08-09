import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controller = readFileSync(new URL("../../main/resources/static/js/controller.js", import.meta.url), "utf8");
const effects = readFileSync(new URL("../../main/resources/static/js/effects.js", import.meta.url), "utf8");

test("直接攻击从存活卡槽飞向对方血条", () => {
    assert.match(controller, /const liveAttackerSlot =/);
    assert.match(controller, /oppHud\?\.querySelector\("\.hp-bar-wrap"\)/);
    assert.match(controller, /playAttackAnimation\(liveAttackerSlot, null/);
});

test("PvP对方直接攻击同样命中本方血条", () => {
    assert.match(controller, /playerHud\?\.querySelector\("\.hp-bar-wrap"\)/);
    assert.match(controller, /attackerRect:/);
});

test("攻击卡飞出时隐藏槽内原卡并在返程后恢复", () => {
    assert.match(effects, /sourceCard\.style\.visibility = "hidden"/);
    assert.match(effects, /restoreSource\(\); fly\.remove\(\); resolve\(\)/);
});
