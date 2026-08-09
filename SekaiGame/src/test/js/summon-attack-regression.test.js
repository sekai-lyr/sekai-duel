import assert from "node:assert/strict";
import test from "node:test";

import { GameEngine } from "../../main/resources/static/js/engine.js";
import { createCardInstance, GameState, Player } from "../../main/resources/static/js/model.js";

const monster = (id, effects = []) => ({
    id,
    name: id,
    type: "monster",
    attribute: "none",
    rarity: "N",
    level: 1,
    attack: 1000,
    defense: 1000,
    effects,
    description: "测试",
});

function createGame() {
    const state = new GameState();
    state.players = [new Player("玩家", [], null, true), new Player("对手", [], null, true)];
    state.currentPlayerIndex = 0;
    state.phase = "main_1";
    state.firstTurn = false;
    state.turn = 12;
    return { state, engine: new GameEngine(state) };
}

test("第4只怪兽的丢弃抽牌登场效果不会封锁己方攻击", () => {
    const { state, engine } = createGame();
    const player = state.players[0];
    player.monsterZone = [1, 2, 3].map(index => {
        const card = createCardInstance(monster(`existing_${index}`));
        card.position = "attack";
        card.canAttack = true;
        return card;
    });
    player.hand = [
        createCardInstance(monster("summoned_fourth", [{
            trigger: "onSummon",
            type: "discardAndDraw",
            value: 1,
            drawValue: 2,
            description: "丢弃1张手牌，再抽2张卡。",
        }])),
        createCardInstance(monster("discard_cost")),
    ];
    player.deck = [createCardInstance(monster("draw_1")), createCardInstance(monster("draw_2"))];

    const result = engine.normalSummon(player, 0, "attack", false);

    assert.equal(result.success, true);
    assert.equal(player.skipBattlePhase, false);
    assert.ok(player.monsterZone.slice(0, 3).every(card => card.canAttack && !card.cannotAttack));
});

test("明确带代价的丢弃抽牌魔法仍会跳过战斗阶段", () => {
    const { state, engine } = createGame();
    const player = state.players[0];
    const spell = createCardInstance({
        id: "skip_battle_spell",
        name: "跳过战斗测试魔法",
        type: "spell",
        attribute: "none",
        rarity: "N",
        effects: [{ trigger: "manual", type: "discardAndDraw", value: 1, drawValue: 2 }],
        description: "丢弃1张手牌并抽2张卡；本回合不能进行战斗。",
    });
    player.hand = [spell, createCardInstance(monster("discard_cost"))];
    player.deck = [createCardInstance(monster("draw_1")), createCardInstance(monster("draw_2"))];

    const result = engine.activateSpell(player, 0);

    assert.equal(result.success, true);
    assert.equal(player.skipBattlePhase, true);
});

test("复活最近怪兽不受入墓回合限制并跳过更晚的魔法", () => {
    const { state, engine } = createGame();
    const player = state.players[0];
    const olderMonster = createCardInstance(monster("older_monster"));
    const latestMonster = createCardInstance(monster("latest_monster"));
    const laterSpell = createCardInstance({
        id: "later_spell",
        name: "later_spell",
        type: "spell",
        attribute: "none",
        rarity: "N",
        effects: [],
        description: "测试",
    });
    olderMonster.setTurn = 1;
    latestMonster.setTurn = 2;
    laterSpell.setTurn = 11;
    player.graveyard = [olderMonster, latestMonster, laterSpell];
    player.hand = [createCardInstance({
        id: "revive_spell",
        name: "异世残绪",
        type: "spell",
        attribute: "none",
        rarity: "UR",
        effects: [{ trigger: "manual", type: "reviveRecentGraveyard", value: 1 }],
        description: "复苏己方墓地最近的怪兽。",
    })];

    const result = engine.activateSpell(player, 0);

    assert.equal(result.success, true);
    assert.equal(player.monsterZone.length, 1);
    assert.equal(player.monsterZone[0].name, "latest_monster");
    assert.deepEqual(player.graveyard.map(card => card.name), ["older_monster", "later_spell", "异世残绪"]);
});

test("技能强度中的目标数量、条件和主动代价由引擎真实结算", () => {
    const { state, engine } = createGame();
    const player = state.players[0];
    const opponent = state.players[1];
    const backrow = index => createCardInstance({
        id: `trap_${index}`, name: `陷阱${index}`, type: "trap", rarity: "N", effects: [], description: "测试",
    });
    opponent.spellTrapZone = [backrow(1), backrow(2), backrow(3)];
    const breaker = createCardInstance(monster("breaker", [{ trigger: "onSummon", type: "destroySpellTrap", value: 2 }]));
    engine.triggerAllEffects(player, breaker, "onSummon");
    assert.equal(opponent.spellTrapZone.length, 1, "破坏2张后场没有按value结算");

    opponent.spellTrapZone = [backrow(4)];
    const conditionalWipe = createCardInstance(monster("conditional_wipe", [{
        trigger: "onSummon",
        type: "destroyAllEnemySpellTraps",
        value: 0,
        condition: { opponentMinSpellTrapCount: 2 },
    }]));
    engine.triggerAllEffects(player, conditionalWipe, "onSummon");
    assert.equal(opponent.spellTrapZone.length, 1, "未满足发动条件时仍错误清场");

    const doubleAttacker = createCardInstance(monster("double_attacker", [{
        trigger: "manual",
        type: "doubleAttack",
        value: 1,
        oncePerTurn: true,
        cost: { type: "payLife", value: 1000 },
    }]));
    player.monsterZone = [doubleAttacker];
    const before = player.lp;
    engine.triggerAllEffects(player, doubleAttacker, "manual");
    assert.equal(player.lp, before - 1000, "主动技能没有支付LP代价");
    engine.triggerAllEffects(player, doubleAttacker, "manual");
    assert.equal(player.lp, before - 1000, "每回合一次技能重复扣除了代价");
});
