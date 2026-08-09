import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { GameState, Player, createCardInstance } from "../js/model.js";
import { GameEngine } from "../js/engine.js";
import { GameController } from "../js/controller.js";
import { GAME_CONFIG, MONSTER_POSITION, PHASE } from "../js/constants.js";

function monster(id, level = 4, attack = 1600, defense = 1200, extra = {}) {
    return {
        id,
        name: `怪兽${id}`,
        type: "monster",
        attribute: "dark",
        race: "warrior",
        level,
        attack,
        defense,
        rarity: "N",
        effects: [],
        description: "测试",
        ...extra,
    };
}

function trap(id = "trap") {
    return {
        id,
        name: "测试陷阱",
        type: "trap",
        attribute: "dark",
        level: 0,
        attack: 0,
        defense: 0,
        rarity: "N",
        effects: [{ type: "reduceDamage", value: 500 }],
        description: "测试",
    };
}

function makeGame(deckSize = 40) {
    const state = new GameState();
    state.players = [
        new Player("P1", Array.from({ length: deckSize }, (_, index) => monster(`a${index}`))),
        new Player("P2", Array.from({ length: deckSize }, (_, index) => monster(`b${index}`))),
    ];
    return { state, engine: new GameEngine(state) };
}

function uiStub() {
    return {
        logs: [],
        render() {},
        addLog(message) { this.logs.push(message); },
        showDrawAnimation() {},
        showGameOver() {},
        showHandoff(_name, callback) { callback(); },
    };
}

describe("游戏王式核心回合", () => {
    test("双方8000LP、起手5张，先攻首回合不额外抽卡", () => {
        const { state, engine } = makeGame();
        const controller = new GameController(state, engine, uiStub());
        controller.start();
        assert.equal(state.players[0].lp, 8000);
        assert.equal(state.players[1].lp, 8000);
        assert.equal(state.players[0].hand.length, 5);
        assert.equal(state.players[1].hand.length, 5);
        assert.equal(state.players[0].deck.length, 35);
        assert.equal(state.phase, PHASE.MAIN_1);
    });

    test("非首回合通常召唤的攻击表示怪兽可在当回合攻击", () => {
        const { state, engine } = makeGame();
        state.currentPlayerIndex = 0;
        state.turn = 3;
        state.firstTurn = false;
        state.phase = PHASE.MAIN_1;
        state.players[0].hand = [createCardInstance(monster("summon"))];
        const result = engine.normalSummon(state.players[0], 0, MONSTER_POSITION.ATTACK, false);
        assert.equal(result.success, true);
        assert.equal(result.card.canAttack, true);
    });

    test("先攻首回合召唤的怪兽不能攻击", () => {
        const { state, engine } = makeGame();
        state.currentPlayerIndex = 0;
        state.turn = 1;
        state.firstTurn = true;
        state.phase = PHASE.MAIN_1;
        state.players[0].hand = [createCardInstance(monster("first"))];
        const result = engine.normalSummon(state.players[0], 0, MONSTER_POSITION.ATTACK, false);
        assert.equal(result.card.canAttack, false);
    });

    test("点击可攻击怪兽会从主要阶段1自动进入战斗阶段", () => {
        const { state, engine } = makeGame();
        const controller = new GameController(state, engine, uiStub());
        controller.mode = "local";
        state.currentPlayerIndex = 0;
        state.turn = 3;
        state.firstTurn = false;
        state.phase = PHASE.MAIN_1;
        const attacker = createCardInstance(monster("attacker"));
        attacker.canAttack = true;
        state.players[0].monsterZone = [attacker];
        controller.selectAttacker(attacker);
        assert.equal(state.phase, PHASE.BATTLE);
        assert.equal(state.selectedAttacker, attacker);
    });

    test("战斗后再从手牌操作会自动进入主要阶段2", () => {
        const { state, engine } = makeGame();
        const controller = new GameController(state, engine, uiStub());
        controller.mode = "local";
        state.currentPlayerIndex = 0;
        state.firstTurn = false;
        state.phase = PHASE.BATTLE;
        state.players[0].hand = [createCardInstance(trap())];
        controller.setCard(0);
        assert.equal(state.phase, PHASE.MAIN_2);
        assert.equal(state.players[0].spellTrapZone.length, 1);
    });

    test("结束阶段将手牌丢弃至6张", () => {
        const { state } = makeGame();
        state.players[0].hand = Array.from({ length: 9 }, (_, index) => createCardInstance(monster(`h${index}`)));
        const discarded = state.players[0].discardToLimit(GAME_CONFIG.END_HAND_LIMIT);
        assert.equal(discarded.length, 3);
        assert.equal(state.players[0].hand.length, 6);
        assert.equal(state.players[0].graveyard.length, 3);
    });

    test("卡组无牌时抽卡直接败北", () => {
        const { state, engine } = makeGame(0);
        const result = engine.drawCard(state.players[0]);
        assert.equal(result.deckOut, true);
        assert.equal(engine.checkGameOver(), true);
        assert.equal(state.winner, 1);
        assert.equal(state.winReason, "无牌可抽");
    });

    test("集齐声明为同一套装的5个不同部件可特殊胜利", () => {
        const { state, engine } = makeGame();
        state.players[0].hand = Array.from({ length: 5 }, (_, index) => createCardInstance(monster(`piece${index}`, 1, 0, 0, {
            specialWinSet: "five-pieces",
            specialWinPiece: `piece-${index + 1}`,
            specialWinRequired: 5,
        })));
        assert.equal(engine.checkGameOver(), true);
        assert.equal(state.winner, 0);
        assert.match(state.winReason, /特殊胜利/);
    });
});

test("决斗页面不再提供手动阶段按钮，右下操作只保留结束回合", async () => {
    const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
    assert.equal(html.includes('id="btn-next-phase"'), false);
    assert.equal((html.match(/id="end-turn-button"/g) || []).length, 1);
    assert.match(html, />结束回合</);
});
