import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GameState, Player, createCardInstance } from "../js/model.js";
import { GameEngine } from "../js/engine.js";
import { MONSTER_POSITION, PHASE } from "../js/constants.js";

function createMonster() {
    return createCardInstance({
        id: "position_test",
        name: "表示形式测试怪兽",
        type: "monster",
        attribute: "earth",
        race: "warrior",
        level: 4,
        attack: 1600,
        defense: 1200,
        rarity: "N",
        effects: [],
        description: "测试",
    });
}

function setup() {
    const state = new GameState();
    state.players = [new Player("P1", []), new Player("P2", [])];
    state.currentPlayerIndex = 0;
    state.turn = 3;
    state.firstTurn = false;
    state.phase = PHASE.MAIN_1;
    const engine = new GameEngine(state);
    const monster = createMonster();
    monster.setTurn = state.turn;
    monster.position = MONSTER_POSITION.ATTACK;
    monster.canAttack = true;
    state.players[0].monsterZone.push(monster);
    return { state, engine, monster };
}

describe("攻击与表示形式选择规则", () => {
    it("召唤后未攻击可以选择转为守备", () => {
        const { state, engine, monster } = setup();
        const result = engine.changePosition(state.players[0], monster);
        assert.equal(result.success, true);
        assert.equal(monster.position, MONSTER_POSITION.DEFENSE);
        assert.equal(monster.canAttack, false);
    });

    it("攻击过后不能再转为守备", () => {
        const { state, engine, monster } = setup();
        monster.hasAttackedThisTurn = true;
        monster.canAttack = false;
        const result = engine.changePosition(state.players[0], monster);
        assert.equal(result.success, false);
        assert.equal(monster.position, MONSTER_POSITION.ATTACK);
        assert.match(result.message, /攻击过/);
    });

    it("里侧守备不公开卡面，被攻击时翻开并按DEF计算", () => {
        const { state, engine, monster: defender } = setup();
        defender.faceUp = false;
        defender.faceDown = true;
        defender.position = MONSTER_POSITION.DEFENSE;
        defender.currentDefense = 1800;

        const attacker = createMonster();
        attacker.currentAttack = 1500;
        attacker.canAttack = true;
        state.players[1].monsterZone.push(attacker);
        state.currentPlayerIndex = 1;
        state.phase = PHASE.BATTLE;

        const result = engine.attack(attacker, defender);
        assert.equal(result.success, true);
        assert.equal(defender.faceUp, true);
        assert.equal(defender.faceDown, false);
        assert.ok(state.players[0].monsterZone.includes(defender));
        assert.equal(state.players[1].lp, 7700);
    });
});
