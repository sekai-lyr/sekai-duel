import { Player, GameState } from "../js/model.js";
import { GameEngine } from "../js/engine.js";
import { GAME_CONFIG, MONSTER_POSITION, PHASE } from "../js/constants.js";
import { NIGHTCORD_STARTER_DECK } from "../js/decks.js";
import { getCardById } from "../js/catalog.js";

function cards() {
    return NIGHTCORD_STARTER_DECK.main.map(getCardById).filter(Boolean);
}

function chooseEffectTarget(engine, player, card) {
    const effect = card.effect || card.effects?.[0];
    const targets = engine.getValidTargets(player, effect);
    if (!targets.length) return null;
    const type = engine.getEffectTargetType(effect);
    if (type === "graveyard") return [...targets].sort((a, b) => (b.attack || 0) - (a.attack || 0))[0];
    const monsters = targets.filter(target => !target.isPlayer);
    if (monsters.length) return [...monsters].sort((a, b) => (a.currentDefense || a.defense || 0) - (b.currentDefense || b.defense || 0))[0];
    return targets[0];
}

function playMainPhase(engine, state) {
    const player = state.currentPlayer;

    if (!player.normalSummonUsed && player.monsterZone.length < GAME_CONFIG.MAX_MONSTER_ZONE) {
        const candidates = player.hand
            .map((card, index) => ({ card, index, tribute: card?.type === "monster" ? engine.getTributeNeeded(card.level) : 99 }))
            .filter(item => item.card?.type === "monster" && player.monsterZone.length >= item.tribute)
            .sort((a, b) => (b.card.attack || 0) - (a.card.attack || 0));
        const choice = candidates[0];
        if (choice) {
            const result = engine.normalSummon(player, choice.index, MONSTER_POSITION.ATTACK, false);
            if (result.needsTribute) {
                [...player.monsterZone]
                    .sort((a, b) => (a.currentAttack || 0) - (b.currentAttack || 0))
                    .slice(0, result.tributeNeeded)
                    .forEach(card => engine.selectTribute(card));
                engine.confirmTribute(MONSTER_POSITION.ATTACK, false);
            }
        }
    }

    let spellActions = 0;
    while (spellActions < 2) {
        const index = player.hand.findIndex(card => card?.type === "spell" && engine.canPlayEffect(player, card).canPlay);
        if (index < 0) break;
        const card = player.hand[index];
        const type = engine.getEffectTargetType(card.effect || card.effects?.[0]);
        const target = ["none", "enemy_player", "self_player", "both_players"].includes(type) ? null : chooseEffectTarget(engine, player, card);
        const result = engine.activateSpell(player, index, target);
        if (!result.success) break;
        spellActions++;
        if (engine.checkGameOver()) return;
    }

    if (player.spellTrapZone.length < GAME_CONFIG.MAX_SPELL_TRAP_ZONE) {
        const trapIndex = player.hand.findIndex(card => card?.type === "trap");
        if (trapIndex >= 0) engine.setCard(player, trapIndex);
    }
}

function playBattle(engine, state) {
    if (state.firstTurn) return;
    state.phase = PHASE.BATTLE;
    const player = state.currentPlayer;
    const opponent = state.opponentPlayer;
    const attackers = player.monsterZone.filter(card => card.canAttack && !card.hasAttackedThisTurn && card.position === MONSTER_POSITION.ATTACK);
    for (const attacker of attackers) {
        if (state.gameOver) break;
        const target = opponent.monsterZone.length
            ? [...opponent.monsterZone].sort((a, b) => (a.position === MONSTER_POSITION.DEFENSE ? a.currentDefense : a.currentAttack) - (b.position === MONSTER_POSITION.DEFENSE ? b.currentDefense : b.currentAttack))[0]
            : "player";
        engine.attack(attacker, target);
        engine.checkGameOver();
    }
}

function simulateOne(index) {
    const state = new GameState();
    state.players = [new Player(`BOT-A-${index}`, cards()), new Player(`BOT-B-${index}`, cards())];
    const engine = new GameEngine(state);
    for (let i = 0; i < GAME_CONFIG.START_HAND_SIZE; i++) {
        engine.drawCard(state.players[0]);
        engine.drawCard(state.players[1]);
    }
    state.turn = 1;
    state.firstTurn = true;
    state.phase = PHASE.MAIN_1;
    state.currentPlayer.resetTurnState();

    let completedTurns = 0;
    while (!state.gameOver && completedTurns < 80) {
        state.phase = PHASE.MAIN_1;
        playMainPhase(engine, state);
        engine.checkGameOver();
        playBattle(engine, state);
        engine.checkGameOver();
        const integrity = engine.checkStateIntegrity();
        if (integrity.length) throw new Error(`第${index}局状态损坏: ${integrity.join("; ")}`);
        if (state.gameOver) break;
        engine.endTurn();
        const draw = engine.startTurn();
        state.phase = PHASE.MAIN_1;
        engine.checkGameOver();
        if (draw.fatigue) engine.checkGameOver();
        completedTurns++;
    }
    if (!state.gameOver) throw new Error(`第${index}局超过80回合仍未结束`);
    return { turns: state.turn, winner: state.isDraw ? "draw" : state.winner, lp: state.players.map(player => player.lp) };
}

const results = Array.from({ length: 20 }, (_, index) => simulateOne(index + 1));
const averageTurns = results.reduce((sum, result) => sum + result.turns, 0) / results.length;
console.log(`自动试玩完成：${results.length}局全部正常结束`);
console.log(`平均回合数：${averageTurns.toFixed(1)}`);
console.log(`胜负分布：玩家A ${results.filter(r => r.winner === 0).length} / 玩家B ${results.filter(r => r.winner === 1).length} / 平局 ${results.filter(r => r.winner === "draw").length}`);
