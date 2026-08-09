import test from "node:test";
import assert from "node:assert/strict";

import { GameUI } from "../js/ui.js";

test("effect target lookup includes cards in the spell/trap zone", () => {
    const ui = Object.create(GameUI.prototype);
    const trap = { instanceId: "trap_1", type: "trap" };
    const state = {
        players: [
            { monsterZone: [], spellTrapZone: [], hand: [], graveyard: [] },
            { monsterZone: [], spellTrapZone: [trap], hand: [], graveyard: [] },
        ],
    };

    assert.equal(ui._findTarget(state, trap.instanceId), trap);
});
