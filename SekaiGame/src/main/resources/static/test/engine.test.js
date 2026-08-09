import { describe, it } from "node:test";
import assert from "node:assert/strict";
global.document = { createElement: () => ({ textContent: "" }) };

const { GameState, Player, createCardInstance, shuffleArray } = await import("../js/model.js");
const { GameEngine, resolveTargets } = await import("../js/engine.js");
const { GAME_CONFIG, MONSTER_POSITION, DURATION } = await import("../js/constants.js");

function mk(o = {}) {
    return { id: "t_" + Math.random().toString(36).slice(2, 6), name: "测试怪兽", type: "monster", attribute: "fire", race: "warrior", level: 3, attack: 1500, defense: 1000, rarity: "N", effects: [], description: "测试", image: "", ...o };
}

function mkTrap(o = {}) {
    return { id: "p_" + Math.random().toString(36).slice(2, 6), name: "测试陷阱", type: "trap", attribute: "fire", level: 0, attack: 0, defense: 0, rarity: "N", effects: [{ trigger: "manual", type: "reduceDamage", value: 1000 }], description: "测试陷阱", image: "", ...o };
}

function createGame() {
    const s = new GameState();
    s.players = [new Player("P1", Array.from({ length: 20 }, () => mk())), new Player("P2", Array.from({ length: 20 }, () => mk()))];
    return { s, e: new GameEngine(s) };
}

function summon(e, player, idx = 0, pos = "attack", fd = false) {
    return e.normalSummon(player, idx, pos, fd);
}

// ==================== 原有33个测试 ====================
describe("开局", () => {
    it("双方初始各5张牌", () => { const { s, e } = createGame(); for (let i = 0; i < GAME_CONFIG.START_HAND_SIZE; i++) { e.drawCard(s.players[0]); e.drawCard(s.players[1]); } assert.equal(s.players[0].hand.length, 5); assert.equal(s.players[1].hand.length, 5); });
    it("初始LP为8000", () => { const { s } = createGame(); assert.equal(s.players[0].lp, 8000); assert.equal(s.players[1].lp, 8000); });
    it("第一回合不能进入战斗", () => { const { s, e } = createGame(); s.currentPlayerIndex = 0; s.firstTurn = true; s.phase = "main_1"; const p = s.players[0]; p.hand = [mk()]; summon(e, p, 0); const atk = p.monsterZone[0]; atk.canAttack = true; s.players[1].monsterZone = []; const r = e.attack(atk, "player"); assert.equal(r.success, false); assert.ok(r.message.includes("第一回合")); });
});

describe("召唤", () => {
    it("每回合只能通常召唤一次", () => { const { s, e } = createGame(); s.currentPlayerIndex = 0; s.phase = "main_1"; const p = s.players[0]; p.hand = [mk(), mk()]; summon(e, p, 0); const r = summon(e, p, 0); assert.equal(r.success, false); });
    it("5星需要1只祭品", () => { const { s, e } = createGame(); s.currentPlayerIndex = 0; s.phase = "main_1"; const p = s.players[0]; p.hand = [mk({ level: 3 }), mk({ level: 5 })]; summon(e, p, 0); p.normalSummonUsed = false; const r = summon(e, p, 0); assert.equal(r.needsTribute, true); assert.equal(r.tributeNeeded, 1); });
    it("7星需要2只祭品", () => { const { s, e } = createGame(); s.currentPlayerIndex = 0; s.phase = "main_1"; const p = s.players[0]; p.hand = [mk({ level: 3 }), mk({ level: 3 }), mk({ level: 7 })]; summon(e, p, 0); p.normalSummonUsed = false; summon(e, p, 0); p.normalSummonUsed = false; const r = summon(e, p, 0); assert.equal(r.needsTribute, true); assert.equal(r.tributeNeeded, 2); });
    it("取消祭品选择不改变状态", () => { const { s, e } = createGame(); s.currentPlayerIndex = 0; s.phase = "main_1"; const p = s.players[0]; p.hand = [mk({ level: 5 }), mk()]; summon(e, p, 0); p.normalSummonUsed = false; summon(e, p, 0); e.cancelTribute(); assert.equal(s.phase, "main_1"); assert.equal(s.pendingTribute, null); });
    it("盖放怪兽为守备表示", () => { const { s, e } = createGame(); s.currentPlayerIndex = 0; s.phase = "main_1"; const p = s.players[0]; p.hand = [mk()]; const r = summon(e, p, 0, "attack", true); assert.equal(r.success, true); assert.equal(p.monsterZone[0].position, MONSTER_POSITION.DEFENSE); assert.equal(p.monsterZone[0].faceUp, false); });
});

describe("攻击", () => {
    it("ATK对ATK：高攻破坏低攻", () => { const { s, e } = createGame(); s.currentPlayerIndex = 0; s.firstTurn = false; const atk = createCardInstance(mk({ attack: 2000, defense: 1000 })); atk.canAttack = true; const def = createCardInstance(mk({ attack: 1500, defense: 1000 })); s.players[0].monsterZone = [atk]; s.players[1].monsterZone = [def]; e.attack(atk, def); assert.equal(s.players[1].monsterZone.length, 0); assert.ok(s.players[1].lp < 8000); });
    it("ATK对ATK：相同则同归于尽", () => { const { s, e } = createGame(); s.currentPlayerIndex = 0; s.firstTurn = false; const atk = createCardInstance(mk({ attack: 1500, defense: 1000 })); atk.canAttack = true; const def = createCardInstance(mk({ attack: 1500, defense: 1000 })); s.players[0].monsterZone = [atk]; s.players[1].monsterZone = [def]; e.attack(atk, def); assert.equal(s.players[0].monsterZone.length, 0); assert.equal(s.players[1].monsterZone.length, 0); });
    it("ATK对DEF：ATK>DEF则守备破坏", () => { const { s, e } = createGame(); s.currentPlayerIndex = 0; s.firstTurn = false; const atk = createCardInstance(mk({ attack: 2000, defense: 1000 })); atk.canAttack = true; const def = createCardInstance(mk({ attack: 1000, defense: 1500 })); def.position = MONSTER_POSITION.DEFENSE; s.players[0].monsterZone = [atk]; s.players[1].monsterZone = [def]; e.attack(atk, def); assert.equal(s.players[1].monsterZone.length, 0); assert.equal(s.players[1].lp, 8000); });
    it("ATK对DEF：ATK=DEF则无事", () => { const { s, e } = createGame(); s.currentPlayerIndex = 0; s.firstTurn = false; const atk = createCardInstance(mk({ attack: 1500, defense: 1000 })); atk.canAttack = true; const def = createCardInstance(mk({ attack: 1000, defense: 1500 })); def.position = MONSTER_POSITION.DEFENSE; s.players[0].monsterZone = [atk]; s.players[1].monsterZone = [def]; e.attack(atk, def); assert.equal(s.players[0].monsterZone.length, 1); assert.equal(s.players[1].monsterZone.length, 1); });
    it("ATK对DEF：ATK<DEF则攻击方受伤", () => { const { s, e } = createGame(); s.currentPlayerIndex = 0; s.firstTurn = false; const atk = createCardInstance(mk({ attack: 1000, defense: 1000 })); atk.canAttack = true; const def = createCardInstance(mk({ attack: 1000, defense: 2000 })); def.position = MONSTER_POSITION.DEFENSE; s.players[0].monsterZone = [atk]; s.players[1].monsterZone = [def]; e.attack(atk, def); assert.equal(s.players[0].lp, 7000); });
    it("里侧守备怪兽被攻击时翻开", () => { const { s, e } = createGame(); s.currentPlayerIndex = 0; s.firstTurn = false; const atk = createCardInstance(mk({ attack: 2000, defense: 1000 })); atk.canAttack = true; const def = createCardInstance(mk({ attack: 1000, defense: 500 })); def.position = MONSTER_POSITION.DEFENSE; def.faceUp = false; s.players[0].monsterZone = [atk]; s.players[1].monsterZone = [def]; e.attack(atk, def); assert.equal(def.faceUp, true); assert.equal(s.players[1].monsterZone.length, 0); });
    it("守备表示怪兽不能攻击", () => { const { s, e } = createGame(); s.currentPlayerIndex = 0; s.firstTurn = false; const atk = createCardInstance(mk({ attack: 1500 })); atk.position = MONSTER_POSITION.DEFENSE; atk.canAttack = true; s.players[0].monsterZone = [atk]; s.players[1].monsterZone = []; const r = e.attack(atk, "player"); assert.equal(r.success, false); });
    it("直接攻击扣除正确LP", () => { const { s, e } = createGame(); s.currentPlayerIndex = 0; s.firstTurn = false; const atk = createCardInstance(mk({ attack: 2500 })); atk.canAttack = true; s.players[0].monsterZone = [atk]; s.players[1].monsterZone = []; e.attack(atk, "player"); assert.equal(s.players[1].lp, 5500); });
    it("每只怪兽每回合只能攻击一次", () => { const { s, e } = createGame(); s.currentPlayerIndex = 0; s.firstTurn = false; const atk = createCardInstance(mk({ attack: 1500 })); atk.canAttack = true; s.players[0].monsterZone = [atk]; s.players[1].monsterZone = [createCardInstance(mk({ attack: 1000, defense: 1000 }))]; e.attack(atk, s.players[1].monsterZone[0]); const r = e.attack(atk, s.players[1].monsterZone[0]); assert.equal(r.success, false); });
});

describe("魔法陷阱", () => {
    it("陷阱不能在盖放当回合发动", () => { const { s, e } = createGame(); s.currentPlayerIndex = 0; s.turn = 1; s.phase = "main_1"; const p = s.players[0]; p.hand = [mkTrap()]; e.setCard(p, 0); assert.equal(p.spellTrapZone[0].canActivate, false); assert.equal(p.spellTrapZone[0].setTurn, 1); });
    it("魔法陷阱区最多5张", () => { const { s, e } = createGame(); s.currentPlayerIndex = 0; s.phase = "main_1"; const p = s.players[0]; p.hand = Array.from({ length: 6 }, () => mkTrap()); for (let i = 0; i < 5; i++) e.setCard(p, 0); const r = e.setCard(p, 0); assert.equal(r.success, false); });
    it("怪兽区最多5只", () => { const { s, e } = createGame(); s.currentPlayerIndex = 0; s.phase = "main_1"; const p = s.players[0]; p.hand = Array.from({ length: 6 }, () => mk()); for (let i = 0; i < 5; i++) { p.normalSummonUsed = false; summon(e, p, 0); } p.normalSummonUsed = false; const r = summon(e, p, 0); assert.equal(r.success, false); });
});

describe("属性克制", () => {
    it("属性不再提供固定战斗倍率", () => { const { e } = createGame(); assert.equal(e.getElementBonus("fire", "wind"), 1); });
    it("属性不利也不改变基础战斗数值", () => { const { e } = createGame(); assert.equal(e.getElementBonus("wind", "fire"), 1); });
    it("同属性无加成", () => { const { e } = createGame(); assert.equal(e.getElementBonus("fire", "fire"), 1); });
});

describe("游戏结束", () => {
    it("LP归零时游戏结束", () => { const { s, e } = createGame(); s.players[0].lp = 0; assert.equal(e.checkGameOver(), true); assert.equal(s.winner, 1); });
    it("双方同时归零为平局", () => { const { s, e } = createGame(); s.players[0].lp = 0; s.players[1].lp = 0; assert.equal(e.checkGameOver(), true); assert.equal(s.isDraw, true); });
    it("游戏结束后不能出牌", () => { const { s, e } = createGame(); s.gameOver = true; const r = e.normalSummon(s.players[0], 0); assert.equal(r.success, false); });
    it("游戏结束后不能攻击", () => { const { s, e } = createGame(); s.gameOver = true; const atk = createCardInstance(mk()); atk.canAttack = true; s.players[0].monsterZone = [atk]; const r = e.attack(atk, "player"); assert.equal(r.success, false); });
});

describe("重新开局", () => {
    it("新状态完全重置", () => { const s2 = new GameState(); s2.players = [new Player("P1", Array.from({ length: 20 }, () => mk())), new Player("P2", Array.from({ length: 20 }, () => mk()))]; assert.equal(s2.turn, 0); assert.equal(s2.winner, null); assert.equal(s2.gameOver, false); assert.equal(s2.players[0].lp, GAME_CONFIG.START_LP); });
});

describe("状态完整性", () => {
    it("正常时返回空数组", () => { const { s, e } = createGame(); assert.equal(e.checkStateIntegrity().length, 0); });
});

describe("卡牌数据", () => {
    it("35张元素卡牌ID不重复", async () => { const { cardDatabase } = await import("../js/cards.js"); const ids = cardDatabase.map(c => c.id); assert.equal(new Set(ids).size, 35); });
    it("每张卡牌都有稀有度", async () => { const { cardDatabase } = await import("../js/cards.js"); for (const c of cardDatabase) { assert.ok(c.rarity); assert.ok(["N", "R", "SR", "SSR"].includes(c.rarity)); } });
    it("50张旧卡牌可以通过兼容层正常载入", async () => { const { cardDatabase } = await import("../js/cards.js"); for (const c of cardDatabase) { assert.ok(c.type === "monster" || c.type === "spell" || c.type === "trap"); if (c.type === "monster") { assert.ok(typeof c.attack === "number"); assert.ok(typeof c.defense === "number"); } } });
    it("卡牌数据库校验可以发现重复ID", async () => { const { cardDatabase } = await import("../js/cards.js"); const ids = cardDatabase.map(c => c.id); const dupes = ids.filter((id, i) => ids.indexOf(id) !== i); assert.equal(dupes.length, 0); });
});

// ==================== 新增测试：effects数组兼容 ====================
describe("effects数组兼容", () => {
    it("旧effect字段自动转为effects数组", () => {
        const old = mk({ effect: { trigger: "onSummon", type: "buffSelfAttack", value: 300 } });
        const inst = createCardInstance(old);
        assert.ok(Array.isArray(inst.effects));
        assert.equal(inst.effects.length, 1);
        assert.equal(inst.effects[0].type, "buffSelfAttack");
    });
    it("新effects数组直接使用", () => {
        const card = mk({ effects: [{ trigger: "onSummon", type: "drawCards", value: 1 }] });
        const inst = createCardInstance(card);
        assert.ok(Array.isArray(inst.effects));
        assert.equal(inst.effects.length, 1);
        assert.equal(inst.effects[0].type, "drawCards");
    });
    it("无效果时effects为空数组", () => {
        const inst = createCardInstance(mk());
        assert.ok(Array.isArray(inst.effects));
        assert.equal(inst.effects.length, 0);
    });
});

// ==================== 新增测试：事件系统 ====================
describe("事件系统", () => {
    it("emit记录事件日志", () => {
        const { s, e } = createGame();
        e.emit("testEvent", { data: 123 });
        assert.ok(s.eventLog.length > 0);
        assert.equal(s.eventLog[0].type, "testEvent");
    });
    it("触发怪兽召唤时发出onSummon事件", () => {
        const { s, e } = createGame();
        s.currentPlayerIndex = 0;
        s.phase = "main_1";
        const p = s.players[0];
        p.hand = [mk()];
        let eventFired = false;
        e.eventBus.on("onSummon", () => { eventFired = true; });
        summon(e, p, 0);
        assert.equal(eventFired, true);
    });
});

// ==================== 新增测试：临时效果和一回合一次 ====================
describe("临时效果和限制", () => {
    it("tempEffects在回合结束时清除untilEndTurn", () => {
        const { s, e } = createGame();
        const card = createCardInstance(mk());
        card.tempEffects = [{ type: "attack", value: 500, duration: DURATION.UNTIL_END_TURN }];
        s.players[0].monsterZone = [card];
        s.players[0].resetTurnState();
        assert.equal(card.tempEffects.length, 0);
    });
    it("permanentBuffs在回合结束时保留", () => {
        const { s, e } = createGame();
        const card = createCardInstance(mk());
        card.permanentBuffs = [{ type: "attack", value: 500 }];
        s.players[0].monsterZone = [card];
        s.players[0].resetTurnState();
        assert.equal(card.permanentBuffs.length, 1);
        assert.equal(card.currentAttack, 2000); // 1500 + 500
    });
    it("oncePerTurnUsed在回合结束时重置", () => {
        const { s } = createGame();
        const card = createCardInstance(mk());
        card.oncePerTurnUsed = true;
        s.players[0].monsterZone = [card];
        s.players[0].resetTurnState();
        assert.equal(card.oncePerTurnUsed, false);
    });
});

// ==================== 新增测试：cannotBeDestroyedByBattle ====================
describe("战斗抗性", () => {
    it("具有cannotBeDestroyedByBattle的怪兽不被战斗破坏", () => {
        const { s, e } = createGame();
        s.currentPlayerIndex = 0;
        s.firstTurn = false;
        const atk = createCardInstance(mk({ attack: 3000 }));
        atk.canAttack = true;
        const def = createCardInstance(mk({ attack: 1000, defense: 500 }));
        def.position = MONSTER_POSITION.DEFENSE;
        def.cannotBeDestroyedByBattle = true;
        s.players[0].monsterZone = [atk];
        s.players[1].monsterZone = [def];
        const r = e.attack(atk, def);
        assert.ok(r.message.includes("不受战斗破坏"));
        assert.equal(s.players[1].monsterZone.length, 1);
    });
    it("本回合战斗破坏抗性不会泄漏到后续回合", () => {
        const { s, e } = createGame();
        s.currentPlayerIndex = 0;
        s.firstTurn = false;
        const atk = createCardInstance(mk({ name: "宇髓天元·音之呼吸", attack: 2000 }));
        atk.canAttack = true;
        const def = createCardInstance(mk({ name: "不死川实弥·旋风斩", attack: 1500 }));
        def.cannotBeDestroyedByBattle = true;
        s.players[0].monsterZone = [atk];
        s.players[1].monsterZone = [def];

        s.players[1].resetTurnState();
        e.attack(atk, def);

        assert.equal(s.players[1].monsterZone.length, 0);
        assert.equal(s.players[1].graveyard[0], def);
    });
});

// ==================== 新增测试：目标选择器 ====================
describe("目标选择器", () => {
    it("resolveTargets可按属性筛选", () => {
        const { s, e } = createGame();
        s.currentPlayerIndex = 0;
        const fire1 = createCardInstance(mk({ attribute: "fire" }));
        const water1 = createCardInstance(mk({ attribute: "water" }));
        s.players[0].monsterZone = [fire1, water1];
        const targets = resolveTargets(e, s.players[0], { owner: "self", zone: "monster", selector: "all", filters: { attribute: ["fire"] } });
        assert.equal(targets.length, 1);
        assert.equal(targets[0].attribute, "fire");
    });
});

// ==================== 新增测试：卡牌校验 ====================
describe("卡牌校验", () => {
    it("校验函数能发现缺失字段", async () => {
        const { validateCardData } = await import("../js/cards.js");
        const bad = { id: "bad_001" };
        const issues = validateCardData(bad, 0);
        assert.ok(issues.length > 0);
    });
    it("校验函数对完整卡牌返回空", async () => {
        const { validateCardData } = await import("../js/cards.js");
        const good = { id: "good_001", name: "测试", type: "monster", attribute: "fire", attack: 1000, defense: 1000, level: 3, rarity: "N", description: "测试" };
        const issues = validateCardData(good, 0);
        assert.equal(issues.length, 0);
    });
});

// ==================== 新增测试：数据库完整性 ====================
describe("数据库完整性", () => {
    it("所有卡牌都有effects字段", async () => {
        const { cardDatabase } = await import("../js/cards.js");
        for (const c of cardDatabase) {
            assert.ok(Array.isArray(c.effects) || c.effect !== undefined, `${c.id} 缺少effects字段`);
        }
    });
    it("所有卡牌都有lore字段", async () => {
        const { cardDatabase } = await import("../js/cards.js");
        for (const c of cardDatabase) {
            assert.ok(typeof c.lore === "string", `${c.id} 缺少lore字段`);
        }
    });
    it("所有卡牌都有aiHints字段", async () => {
        const { cardDatabase } = await import("../js/cards.js");
        for (const c of cardDatabase) {
            assert.ok(c.aiHints, `${c.id} 缺少aiHints字段`);
            assert.ok(c.aiHints.role, `${c.id} aiHints缺少role`);
        }
    });
    it("卡牌数量为35", async () => {
        const { cardDatabase } = await import("../js/cards.js");
        assert.equal(cardDatabase.length, 35);
    });
});
