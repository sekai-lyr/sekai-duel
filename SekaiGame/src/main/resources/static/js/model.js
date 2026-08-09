/**
 * model.js
 * 运行状态层 —— 次元决斗：元素召唤
 */

import { GAME_CONFIG, MONSTER_POSITION, DURATION } from "./constants.js";

export function shuffleArray(arr, rng = null) {
    const a = [...arr];
    const rand = rng || Math.random;
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * 创建卡牌运行时实例
 * 兼容旧字段(character/element/health)并添加新字段
 */
export function createCardInstance(cardData) {
    const isMonster = (cardData.type === "monster" || cardData.type === "character");
    return {
        ...cardData,
        // 兼容旧字段
        type: isMonster ? "monster" : cardData.type,
        legacyType: cardData.type,
        element: cardData.attribute || cardData.element || "none",
        attribute: cardData.attribute || cardData.element || "none",
        defense: cardData.defense ?? cardData.health ?? 0,
        health: cardData.defense ?? cardData.health ?? 0,

        // effects 数组兼容：如果只有旧 effect，转为 effects 数组
        effects: (cardData.effects && cardData.effects.length > 0) ? cardData.effects : (cardData.effect ? [cardData.effect] : []),

        // 运行时唯一标识
        instanceId: Math.random().toString(36).slice(2, 10),

        // 怪兽运行时状态
        currentAttack: cardData.attack ?? 0,
        currentDefense: cardData.defense ?? cardData.health ?? 0,
        currentHealth: cardData.defense ?? cardData.health ?? 0,
        position: MONSTER_POSITION.ATTACK,
        faceUp: true,
        canAttack: false,
        hasAttackedThisTurn: false,
        positionChangedThisTurn: false,
        wasFlipSummoned: false,

        // 魔法陷阱运行时状态
        setTurn: 0,
        canActivate: false,
        faceDown: false,

        // ---- 新增：临时效果追踪 ----
        tempEffects: [],           // [{type, value, duration, source}]
        permanentBuffs: [],        // [{type, value, source}]
        oncePerTurnUsed: false,    // 本回合是否已发动过一回合一次效果
        protectionEffects: [],     // [{type: "cannotBeDestroyedByBattle", duration}]

        // ---- 新增：限制追踪 ----
        limits: {
            oncePerTurn: false,
            oncePerDuel: false,
        },

        // ---- 新增：状态标记 ----
        cannotAttack: false,
        cannotBeTargeted: false,
        cannotBeDestroyedByBattle: false,
        cannotBeDestroyedByEffect: false,
        attackLocked: false,        // 被"寄往遥远彼岸的信"永久封锁攻击
    };
}

export class Player {
    constructor(name, deckCards, rng = null, preserveDeckOrder = false) {
        this.name = name;
        this.lp = GAME_CONFIG.START_LP;
        this.maxLp = GAME_CONFIG.MAX_LP;
        this.deckOut = false;

        const instances = deckCards.map(c => createCardInstance(c));
        this.deck = preserveDeckOrder ? instances : shuffleArray(instances, rng);
        this.hand = [];
        this.monsterZone = [];
        this.spellTrapZone = [];
        this.fieldZone = null; // 场地卡槽（每个玩家最多1张）
        this.graveyard = [];
        this.banished = [];
        this.extraDeck = [];

        // 回合状态
        this.normalSummonUsed = false;
        this.normalSummonTurn = null;
        this.additionalNormalSummon = 0;
        this.skipBattlePhase = false;

        // ---- 新增：回合级限制追踪 ----
        this.oncePerTurnEffectsUsed = new Set(); // instanceId 集合
    }

    drawCard() {
        if (this.deck.length === 0) {
            this.deckOut = true;
            return { success: false, message: `${this.name} 无牌可抽，决斗失败`, deckOut: true };
        }
        const card = this.deck.shift();
        this.hand.push(card);
        return { success: true, message: `${this.name} 抽到了 ${card.name}`, card };
    }

    discardToLimit(limit = GAME_CONFIG.END_HAND_LIMIT, selectedInstanceIds = null) {
        const need = Math.max(0, this.hand.length - limit);
        if (need === 0) return [];
        const selected = Array.isArray(selectedInstanceIds) ? new Set(selectedInstanceIds) : null;
        const discarded = [];
        if (selected) {
            for (let i = this.hand.length - 1; i >= 0 && discarded.length < need; i--) {
                const card = this.hand[i];
                if (selected.has(card.instanceId)) {
                    discarded.push(this.hand.splice(i, 1)[0]);
                }
            }
        }
        while (discarded.length < need && this.hand.length > 0) {
            discarded.push(this.hand.pop());
        }
        this.graveyard.push(...discarded);
        return discarded;
    }

    takeDamage(amount) {
        const dmg = Math.max(0, Math.floor(Number(amount) || 0));
        this.lp = Math.max(0, this.lp - dmg);
        return this.lp <= 0;
    }

    heal(amount) {
        const heal = Math.max(0, Math.floor(Number(amount) || 0));
        this.lp = Math.min(this.maxLp, this.lp + heal);
    }

    resetTurnState() {
        this.normalSummonUsed = false;
        this.additionalNormalSummon = 0;
        this.skipBattlePhase = false;
        this.noDirectAttackThisTurn = false;
        this.cannotSpecialSummonThisTurn = false;
        this.noHandMonsterEffectThisTurn = false;
        this.fieldSpellDiscardCost = false;
        this.oncePerTurnEffectsUsed.clear();
        this.monsterZone.forEach(c => {
            // 朝比奈真冬效果：attackDisabledUntilEndPhase 持续到对方下个结束阶段
            if (c.attackDisabledUntilEndPhase) {
                c.canAttack = false;
                c.cannotAttack = true;
            } else {
                c.canAttack = !c.attackLocked;
                c.cannotAttack = c.attackLocked;
            }
            c.hasAttackedThisTurn = false;
            c.positionChangedThisTurn = false;
            c.oncePerTurnUsed = false;
            // 清除回合级效果标记
            c.cannotBeTargeted = false;
            c.cannotBeDestroyedByBattle = false;
            c.destructionPreventedThisTurn = false;
            c.cannotActivateThisTurn = false;
            c.cancelAttack = false;
            c.effectNegated = false;
            c.doubleAttackThisTurn = false;
            c.cannotUseAsMaterial = false;
            c.attackRedirector = false;
            c.redirectValue = 0;
            c._redirectUsedThisTurn = false;
            c.priorityTarget = false;
            c._disruptionUsedThisTurn = false;
            // effectDisruptor 不清除 —— 持续效果，每次对方回合自动生效
            // 清除 untilEndTurn 临时效果
            c.tempEffects = (c.tempEffects || []).filter(t => t.duration !== DURATION.UNTIL_END_TURN);
            // 重新计算属性
            this._recalcCardStats(c);
        });
        this.spellTrapZone.forEach(c => {
            if (c.setTurn > 0 && c.faceDown) {
                c.canActivate = true;
            }
        });
    }

    _recalcCardStats(card) {
        let atkBonus = 0;
        let defBonus = 0;
        for (const buff of (card.permanentBuffs || [])) {
            if (buff.type === "attack") atkBonus += buff.value;
            if (buff.type === "defense") defBonus += buff.value;
        }
        for (const temp of (card.tempEffects || [])) {
            if (temp.type === "attack") atkBonus += temp.value;
            if (temp.type === "defense") defBonus += temp.value;
        }
        card.currentAttack = Math.max(0, (card.attack || 0) + atkBonus);
        card.currentDefense = Math.max(0, (card.defense || 0) + defBonus);
    }
}

export class GameState {
    constructor() {
        this.players = [];
        this.currentPlayerIndex = 0;
        this.turn = 0;
        this.phase = "waiting";
        this.winner = null;
        this.isDraw = false;
        this.gameOver = false;
        this.winReason = "";
        this.firstTurn = true;

        // 选择状态
        this.selectedAttacker = null;
        this.validTargets = [];
        this.pendingAction = null;

        // 祭品选择
        this.pendingTribute = null;
        this.tributeNeeded = 0;
        this.tributeSelected = [];

        // 陷阱响应窗口
        this.pendingResponse = null;

        // AI 难度
        this.aiDifficulty = "normal";

        // ---- 新增：事件日志 ----
        this.eventLog = [];
    }

    get currentPlayer() { return this.players[this.currentPlayerIndex]; }
    get opponentPlayer() { return this.players[this.currentPlayerIndex === 0 ? 1 : 0]; }

    switchPlayer() {
        this.currentPlayerIndex = this.currentPlayerIndex === 0 ? 1 : 0;
    }

    logEvent(type, data) {
        this.eventLog.push({ type, data, turn: this.turn, phase: this.phase, timestamp: Date.now() });
    }

    reset() {
        Object.assign(this, new GameState());
    }
}
