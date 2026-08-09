import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { Player, GameState } from "../js/model.js";
import { GameEngine } from "../js/engine.js";
import { GameController } from "../js/controller.js";
import { PHASE } from "../js/constants.js";
import { NIGHTCORD_STARTER_DECK } from "../js/decks.js";
import { getCardById } from "../js/catalog.js";

function makeUI() {
    return {
        renders: 0,
        logs: [],
        aiActions: [],
        render() { this.renders++; },
        addLog(message) { this.logs.push(message); },
        showDrawAnimation() {},
        showAiAction(card, label) { this.aiActions.push({ card: card?.name, label }); },
        showGameOver() {},
        showHandoff(_name, callback) { callback(); },
    };
}

function starterCards() {
    return NIGHTCORD_STARTER_DECK.main.map(getCardById).filter(Boolean);
}

async function waitFor(predicate, timeout = 1500) {
    const started = Date.now();
    while (!predicate()) {
        if (Date.now() - started > timeout) throw new Error("等待自动回合超时");
        await new Promise(resolve => setTimeout(resolve, 5));
    }
}

function orderDeck(player) {
    const source = [...player.deck];
    player.deck = NIGHTCORD_STARTER_DECK.main.map(id => {
        const index = source.findIndex(card => card.id === id);
        if (index < 0) throw new Error(`牌库缺少 ${id}`);
        return source.splice(index, 1)[0];
    });
}

test("完整回合：玩家出牌后AI会抽牌、召唤/盖牌并结束回合", async () => {
        const state = new GameState();
        state.players = [new Player("玩家", starterCards()), new Player("Nightcord AI", starterCards())];
        state.players.forEach(orderDeck);
        const ui = makeUI();
        const controller = new GameController(state, new GameEngine(state), ui);
        controller.mode = "ai";
        controller.aiActionDelay = 1;
        controller.start();

        assert.equal(state.currentPlayerIndex, 0);
        assert.equal(state.phase, PHASE.MAIN_1);
        assert.equal(state.players[0].hand.length, 5);

        const summonableIndex = state.players[0].hand.findIndex(card => card.type === "monster" && card.level <= 4);
        assert.ok(summonableIndex >= 0, "玩家开局应至少有一张可通常召唤怪兽");
        // 该集成测试关注回合闭环，不应因AI在召唤当回合可攻击而随机破坏测试怪兽。
        state.players[0].hand[summonableIndex].attack = 0;
        state.players[0].hand[summonableIndex].defense = 9999;
        state.players[0].hand[summonableIndex].currentAttack = 0;
        state.players[0].hand[summonableIndex].currentDefense = 9999;
        state.players[0].hand[summonableIndex].cannotBeDestroyedByBattle = true;
        state.players[0].hand[summonableIndex].cannotBeDestroyedByEffect = true;
        controller.summonMonster(summonableIndex);
        assert.equal(state.players[0].monsterZone.length, 1, "玩家出牌后怪兽应进入场上");
        assert.equal(state.players[0].hand.length, 4, "召唤后手牌应减少");

        controller.endTurn();
        await waitFor(() => state.currentPlayerIndex === 0 && state.turn >= 3);

        assert.ok(state.players[1].monsterZone.length + state.players[1].spellTrapZone.length > 0, "AI回合必须实际出牌");
        assert.ok(ui.aiActions.length > 0, "AI行动应产生可见演出事件");
        assert.ok(ui.logs.some(message => message.includes("AI ")), "日志应记录AI行动");
        assert.equal(state.phase, PHASE.MAIN_1, "AI结束后应回到玩家主要阶段");

        // 玩家第二回合进入战斗并完成一次攻击。
        const attacker = state.players[0].monsterZone.find(card => card.canAttack && !card.hasAttackedThisTurn);
        assert.ok(attacker, "玩家上回合召唤的怪兽在新回合应可以攻击");
        controller.selectAttacker(attacker);
        assert.equal(state.phase, PHASE.BATTLE);
        if (state.players[1].monsterZone.length) controller.attackTarget(state.players[1].monsterZone[0]);
        else controller.attackPlayer();
        assert.equal(attacker.hasAttackedThisTurn, true, "攻击完成后应标记本回合已攻击");
        controller.clearAiTimer();
});

test("启动和详情关闭事件不依赖错过的DOMContentLoaded", async () => {
    const main = await readFile(new URL("../js/main.js", import.meta.url), "utf8");
    const ui = await readFile(new URL("../js/ui.js", import.meta.url), "utf8");
    assert.match(main, /document\.readyState === "loading"/);
    assert.match(main, /initializeDomBindings\(\)/);
    assert.match(ui, /_bindDetailOverlay\(\)/);
    assert.match(ui, /closeTopOverlay\(\)/);
    assert.match(ui, /data-card-action-close/);
});
