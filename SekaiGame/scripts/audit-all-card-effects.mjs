import { ALL_CARDS } from "../src/main/resources/static/js/catalog.js";
import { GameEngine, hasEffectHandler } from "../src/main/resources/static/js/engine.js";
import { GameController } from "../src/main/resources/static/js/controller.js";
import { GameState, Player, createCardInstance } from "../src/main/resources/static/js/model.js";
import { PHASE } from "../src/main/resources/static/js/constants.js";

function createMonster(id, attack = 1500, defense = 1500) {
    return createCardInstance({
        id,
        name: id,
        type: "monster",
        attribute: "water",
        race: "warrior",
        level: 4,
        attack,
        defense,
        rarity: "N",
        effects: [],
        image: "",
    });
}

function createScenario(cardDefinition, effect) {
    const state = new GameState();
    const player = new Player("AUDIT_PLAYER", []);
    const opponent = new Player("AUDIT_OPPONENT", []);
    state.players = [player, opponent];
    state.currentPlayerIndex = 0;
    state.turn = 8;
    state.firstTurn = false;
    state.phase = PHASE.MAIN_1;

    player.deck = Array.from({ length: 12 }, (_, index) => createMonster(`ally_deck_${index}`));
    opponent.deck = Array.from({ length: 12 }, (_, index) => createMonster(`enemy_deck_${index}`));
    player.hand = [createMonster("cost_1"), createMonster("cost_2"), createMonster("cost_3")];
    opponent.hand = [createMonster("enemy_hand_1"), createMonster("enemy_hand_2"), createMonster("enemy_hand_3")];
    player.monsterZone = [createMonster("ally_field_1", 1800, 1600), createMonster("ally_field_2", 1200, 2100)];
    opponent.monsterZone = [createMonster("enemy_field_1", 1700, 1400), createMonster("enemy_field_2", 2400, 2000)];
    player.graveyard = [createMonster("ally_grave_1"), createMonster("ally_grave_2")];
    opponent.graveyard = [createMonster("enemy_grave_1")];
    player.lp = 8000;
    opponent.lp = 8000;

    const card = createCardInstance({ ...cardDefinition, effects: [effect], effect: undefined });
    const engine = new GameEngine(state, () => 0.25);
    return { state, player, opponent, card, engine };
}

function executeEffect(cardDefinition, effect) {
    const { state, player, card, engine } = createScenario(cardDefinition, effect);
    if (card.type === "spell") {
        player.hand.unshift(card);
        const targets = engine.getValidTargets(player, effect);
        const target = targets[0] || null;
        if (target) state.phase = engine.getEffectTargetType(effect) === "graveyard"
            ? PHASE.GRAVEYARD_SELECT
            : PHASE.TARGET_SELECT;
        const result = engine.activateSpell(player, 0, target);
        if (!result.success && !result.needsTarget) {
            throw new Error(result.message || "spell activation failed");
        }
    } else {
        player.monsterZone.unshift(card);
        engine.triggerAllEffects(player, card, effect.trigger || "manual");
    }

    const integrityErrors = engine.checkStateIntegrity();
    if (integrityErrors.length) throw new Error(integrityErrors.join("; "));
    const controller = new GameController(state, engine, {});
    JSON.stringify(controller._serializePvpState());
}

const failures = [];
let effectCount = 0;
for (const card of ALL_CARDS) {
    const effects = card.effects || (card.effect ? [card.effect] : []);
    if (!effects.length) {
        try {
            const { state, engine } = createScenario(card, { type: "none", trigger: "manual" });
            const controller = new GameController(state, engine, {});
            JSON.stringify(controller._serializePvpState());
        } catch (error) {
            failures.push({ card: card.name, id: card.id, effect: "none", error: error.message });
        }
        continue;
    }
    for (const effect of effects) {
        effectCount++;
        try {
            if (!hasEffectHandler(effect.type)) throw new Error("missing effect handler");
            executeEffect(card, effect);
        } catch (error) {
            failures.push({ card: card.name, id: card.id, effect: effect.type, error: error.message });
        }
    }
}

const summary = {
    cards: ALL_CARDS.length,
    effects: effectCount,
    passed: effectCount - failures.length,
    failed: failures.length,
    failures,
};
console.log(JSON.stringify(summary, null, 2));
if (failures.length) process.exitCode = 1;
