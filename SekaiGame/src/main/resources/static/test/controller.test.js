import test from "node:test";
import assert from "node:assert/strict";

import { GameState, Player } from "../js/model.js";
import { GameEngine } from "../js/engine.js";
import { GameController } from "../js/controller.js";
import { PHASE } from "../js/constants.js";

function monster(id, level = 3) {
    return {
        id,
        name: `测试怪兽${id}`,
        type: "monster",
        attribute: "dark",
        race: "warrior",
        level,
        attack: 1000,
        defense: 1000,
        rarity: "N",
        effects: [],
        description: "测试卡牌",
    };
}

function makeUI() {
    return {
        renders: 0,
        logs: [],
        draws: [],
        render() { this.renders++; },
        addLog(message) { this.logs.push(message); },
        showDrawAnimation(card, playerIndex, label) { this.draws.push({ card, playerIndex, label }); },
        showGameOver() {},
        showHandoff(_name, callback) { callback(); },
    };
}

function createController() {
    const state = new GameState();
    const deck1 = Array.from({ length: 40 }, (_, i) => monster(`p1_${i}`));
    const deck2 = Array.from({ length: 40 }, (_, i) => monster(`p2_${i}`));
    state.players = [new Player("P1", deck1), new Player("P2", deck2)];
    const ui = makeUI();
    const controller = new GameController(state, new GameEngine(state), ui);
    return { state, ui, controller };
}

test("控制器开局显示5张手牌并进入主要阶段1", () => {
    const { state, ui, controller } = createController();
    controller.start();

    assert.equal(state.turn, 1);
    assert.equal(state.phase, PHASE.MAIN_1);
    assert.equal(state.players[0].hand.length, 5);
    assert.equal(state.players[1].hand.length, 5);
    assert.equal(state.players[0].deck.length, 35);
    assert.equal(state.players[1].deck.length, 35);
    assert.ok(ui.renders > 0);
    assert.equal(ui.draws.at(-1)?.label, "FIRST TURN · NO DRAW");
});

test("先攻第1回合从主要阶段1跳过战斗阶段", () => {
    const { state, controller } = createController();
    controller.start();
    controller.nextPhase();
    assert.equal(state.phase, PHASE.MAIN_2);
});

test("AI手里有多张怪兽时只通常召唤一次且不会死循环", () => {
    const { state, controller } = createController();
    state.currentPlayerIndex = 1;
    state.firstTurn = false;
    state.turn = 2;
    state.phase = PHASE.MAIN_1;
    state.players[1].hand = [
        { ...state.players[1].deck.shift(), level: 3 },
        { ...state.players[1].deck.shift(), level: 3 },
        { ...state.players[1].deck.shift(), level: 3 },
    ];

    controller._aiPlayCards();

    assert.equal(state.players[1].monsterZone.length, 1);
    assert.equal(state.players[1].hand.length, 2);
    assert.equal(state.players[1].normalSummonUsed, true);
});
