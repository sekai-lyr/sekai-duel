import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GameState, Player, createCardInstance } from "../js/model.js";
import { GameEngine } from "../js/engine.js";
import { PHASE } from "../js/constants.js";

function setup() {
    const state = new GameState();
    state.players = [new Player("P1", []), new Player("P2", [])];
    state.currentPlayerIndex = 0;
    state.turn = 4;
    state.firstTurn = false;
    state.phase = PHASE.MAIN_1;
    const engine = new GameEngine(state);
    const removal = createCardInstance({
        id: "remove_trap_test",
        name: "除魔",
        type: "spell",
        rarity: "N",
        effects: [{ trigger: "manual", type: "destroySpellTrap", value: 0 }],
    });
    const trap = createCardInstance({
        id: "trap_target_test",
        name: "测试陷阱",
        type: "trap",
        rarity: "N",
        effects: [],
    });
    trap.faceDown = true;
    trap.canActivate = true;
    state.players[1].spellTrapZone.push(trap);
    return { state, engine, removal, trap };
}

describe("盖放魔法与后场破坏", () => {
    it("除魔能够选择并破坏对方盖放陷阱", () => {
        const { state, engine, removal, trap } = setup();
        state.players[0].hand.push(removal);
        const result = engine.activateSpell(state.players[0], 0, trap);
        assert.equal(result.success, true);
        assert.equal(state.players[1].spellTrapZone.includes(trap), false);
        assert.equal(state.players[1].graveyard.includes(trap), true);
    });

    it("盖放魔法不能在盖放当回合发动", () => {
        const { state, engine, removal } = setup();
        state.players[0].spellTrapZone.push(removal);
        removal.faceDown = true;
        removal.setTurn = state.turn;
        const result = engine.canActivateSetSpell(state.players[0], removal);
        assert.equal(result.canActivate, false);
    });

    it("盖放魔法可在之后自己的主要阶段发动", () => {
        const { state, engine, removal, trap } = setup();
        state.players[0].spellTrapZone.push(removal);
        removal.faceDown = true;
        removal.setTurn = state.turn - 2;
        const result = engine.activateSetSpell(state.players[0], removal, trap);
        assert.equal(result.success, true);
        assert.equal(state.players[0].graveyard.includes(removal), true);
        assert.equal(state.players[1].graveyard.includes(trap), true);
    });

    it("盖放的场地魔法翻开发动后进入场地区", () => {
        const { state, engine } = setup();
        const field = createCardInstance({
            id: "field_spell_test",
            name: "测试场地",
            type: "spell",
            rarity: "N",
            isFieldSpell: true,
            effects: [{ trigger: "field", type: "fieldWaterBuff", value: 200 }],
        });
        field.faceDown = true;
        field.setTurn = state.turn - 2;
        state.players[0].spellTrapZone.push(field);
        const result = engine.activateSetSpell(state.players[0], field);
        assert.equal(result.success, true);
        assert.equal(result.isFieldSpell, true);
        assert.equal(state.players[0].fieldZone, field);
        assert.equal(state.players[0].graveyard.includes(field), false);
    });
});

describe("墓地复活", () => {
    it("复活墓地中最后进入的怪兽，不受送墓回合限制", () => {
        const state = new GameState();
        state.players = [new Player("P1", []), new Player("P2", [])];
        state.currentPlayerIndex = 0;
        state.turn = 12;
        state.phase = PHASE.MAIN_1;
        const engine = new GameEngine(state);
        const older = createCardInstance({ id: "old", name: "较早怪兽", type: "monster", level: 4, attack: 1000, defense: 1000, effects: [] });
        const latest = createCardInstance({ id: "latest", name: "最近怪兽", type: "monster", level: 4, attack: 1200, defense: 900, effects: [] });
        older.setTurn = 1;
        latest.setTurn = 2;
        state.players[0].graveyard.push(older, latest);
        const spell = createCardInstance({
            id: "revive",
            name: "复活测试",
            type: "spell",
            effects: [{ trigger: "manual", type: "reviveRecentGraveyardV2", value: 2 }],
        });
        state.players[0].hand.push(spell);
        const result = engine.activateSpell(state.players[0], 0);
        assert.equal(result.success, true);
        assert.equal(state.players[0].monsterZone.at(-1), latest);
        assert.equal(engine._lastRevivedCard, latest);
    });
});
