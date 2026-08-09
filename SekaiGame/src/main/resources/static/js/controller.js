/**
 * controller.js
 * 自动阶段回合控制器：玩家只需要出牌、攻击和点击“结束回合”。
 */

import { PHASE, GAME_CONFIG, MONSTER_POSITION } from "./constants.js";
import { createCardInstance } from "./model.js";
import { getCardById } from "./catalog.js";
import {
    playSummonEffect, playSpellEffect, playTrapEffect,
    playAttackEffect, playAttackAnimation, showDamageNumber, playDestroyEffect,
    playHealEffect, playPlayerHealEffect, playDrawEffect, playPhaseFlash,
    animateDrawCard, animatePlayToZone, animatePlayToGraveyard, createCardBackHtml,
    playFlipSummonEffect, playTrapChainEffect,
    playMonsterEffect, playSpellEffectV2, playTrapEffectV2,
    playDestroyEffectV2, playHealEffectV2, showAnnounceBanner,
    playTrapActivationV3, playTrapActivationV5, playCounterTrapV3, playSpellCinematic,
    animateCinematicDestroy, animateCinematicReturnToDeck, animateCinematicReturnToHand,
    animateTrapToGraveyard, playNegatedAttackBarrier,
} from "./effects.js?v=1.7.1";

const raf = typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : typeof document !== "undefined" ? fn => setTimeout(fn, 0) : () => {};

// 特效锁定时间（毫秒）—— 必须 >= 横幅停留时间
const EFFECT_LOCK_MS = 2600;
const ANIMATED_DRAW_EFFECTS = new Set(["drawCards", "gameThroneDraw", "discardAndDraw", "healDrawNoSpecial", "recoverAndDrawV2"]);

export class GameController {
    constructor(gameState, engine, ui) {
        this.state = gameState;
        this.engine = engine;
        this.ui = ui;
        this.mode = "ai";
        this.pvpClient = null;
        this.aiDifficulty = "normal";
        this.aiProfile = { skill: 2, lookahead: 1 };
        this.aiTimer = null;
        this.selectedCardIndex = -1;
        this.pendingEffectCard = null;
        this.phaseBeforeSelection = PHASE.MAIN_1;
        this.aiActionDelay = 600;
        this.aiMaxMainActions = 6;
        this.onGameOver = null;
        this.turnEnding = false;
        this.turnAckTimer = null;
        this._effectQueue = Promise.resolve();
        this._pvpTurnGeneration = 0;
        this.effectBusy = false; // 特效播放期间锁定操作
        this._lockTimers = []; // 多个特效锁定计时器
    }

    // 特效锁定：播放特效期间禁止玩家操作（支持叠加，取最大时长）
    _lockForEffect(duration = EFFECT_LOCK_MS) {
        this.effectBusy = true;
        const timer = setTimeout(() => {
            this._lockTimers = this._lockTimers.filter(t => t !== timer);
            if (this._lockTimers.length === 0) this.effectBusy = false;
        }, duration);
        this._lockTimers.push(timer);
    }

    _releaseEffectLocks() {
        this._lockTimers.forEach(timer => clearTimeout(timer));
        this._lockTimers = [];
        this.effectBusy = false;
    }

    // ---- PvP 卡牌序列化 ----
    /** 提取可 JSON 序列化的卡牌字段（排除循环引用和函数） */
    _serializeCard(card) {
        if (!card) return null;
        return {
            id: card.id,
            instanceId: card.instanceId,
            name: card.name,
            type: card.type,
            rarity: card.rarity,
            level: card.level,
            attack: card.attack,
            defense: card.defense,
            attribute: card.attribute || card.element,
            race: card.race,
            series: card.series,
            member: card.member,
            description: card.description,
            effects: card.effects,
            aiHints: card.aiHints,
            image: card.image,
            art: card.art,
        };
    }

    clearAiTimer() {
        if (this.aiTimer) {
            clearTimeout(this.aiTimer);
            this.aiTimer = null;
        }
    }

    clearTurnAckTimer() {
        if (this.turnAckTimer) {
            clearTimeout(this.turnAckTimer);
            this.turnAckTimer = null;
        }
    }

    start() {
        this.clearAiTimer();
        for (let i = 0; i < GAME_CONFIG.START_HAND_SIZE; i++) {
            this.engine.drawCard(this.state.players[0]);
            this.engine.drawCard(this.state.players[1]);
        }
        this.state.turn = 0;
        this.state.firstTurn = true;
        this.state.selectedAttacker = null;

        const begin = (startingPlayerIndex = 0) => {
            this.state.currentPlayerIndex = startingPlayerIndex === 1 ? 1 : 0;
            this._beginTurn({ openingTurn: true });
        };

        if (this.mode === "ai" && typeof this.ui.showFirstPlayerChoice === "function") {
            this.ui.showFirstPlayerChoice(begin);
        } else {
            begin(0);
        }
    }

    async _beginTurn({ openingTurn = false } = {}) {
        if (this.state.gameOver) return;
        this.effectBusy = false; // 新回合开始时解锁
        const drawResult = this.engine.startTurn({ skipDraw: openingTurn });
        const player = this.state.currentPlayer;
        this.ui.addLog(`=== 第${this.state.turn}回合 · ${player.name}的回合 ===`, "turn");

        if (openingTurn) {
            this.ui.addLog("先攻首回合跳过抽卡阶段，并且不能攻击", "play");
        } else if (drawResult.deckOut) {
            this.ui.addLog(drawResult.message, "damage");
            this.checkAndRefresh();
            return;
        } else if (drawResult.card) {
            const isOpponentDraw = this.state.currentPlayerIndex === 1;
            if (isOpponentDraw) {
                this.ui.addLog(`${player.name}抽了1张卡`, "play");
            } else {
                this.ui.addLog(`${player.name}抽到了${drawResult.card.name}`, "play");
            }

            // 临时从手牌移除，避免动画期间手牌托盘提前显示该卡
            const pendingCard = drawResult.card;

            // 玩家和对手都播放抽卡动画，但对手用卡背
            if (!isOpponentDraw) {
                this.ui.showDrawAnimation?.(pendingCard, 0, "DRAW PHASE");
            }
            if (this.mode === "pvp" && this.state.currentPlayerIndex === 0) {
                this._pvpSend({ type: "draw", count: 1 });
            }
            this._lockForEffect(3800);
            await new Promise(resolve => {
                raf(() => {
                    playDrawEffect();
                    const htmlFn = isOpponentDraw
                        ? (c => createCardBackHtml(c))
                        : (c => this.ui.cardHTML(c));
                    animateDrawCard(pendingCard, htmlFn, isOpponentDraw).then(resolve);
                });
            });

        }

        raf(() => playPhaseFlash());

        // 抽卡阶段和准备阶段自动结算，玩家直接进入主要阶段1。
        this.state.phase = PHASE.STANDBY;
        this.engine.emit("onPhaseStart", { player, phase: PHASE.STANDBY });
        this.state.phase = PHASE.MAIN_1;
        this.state.selectedAttacker = null;
        this.turnEnding = false;
        if (this.engine.checkGameOver()) {
            this.gameOver();
            return;
        }
        this.refresh();

        if (this.mode === "ai" && this.state.currentPlayerIndex === 1) {
            this._scheduleAi(() => this.aiTurn(), this.aiActionDelay);
        }
    }

    // 兼容旧测试和快捷键：阶段由操作自动推进，不再需要玩家点击。
    nextPhase() {
        if (this.state.gameOver) return;
        if (this.state.phase === PHASE.MAIN_1) {
            if (this.state.firstTurn || this.state.currentPlayer.skipBattlePhase) this.state.phase = PHASE.MAIN_2;
            else this.state.phase = PHASE.BATTLE;
        } else if (this.state.phase === PHASE.BATTLE) {
            this.state.phase = PHASE.MAIN_2;
            this.state.selectedAttacker = null;
        } else if (this.state.phase === PHASE.MAIN_2) {
            this.endTurn();
            return;
        }
        this.refresh();
    }

    _isHumanAllowed() {
        if (this.mode === "local") return true;
        return this.state.currentPlayerIndex === 0;
    }

    _ensureMainPhaseForHandAction() {
        if (!this._isHumanAllowed() || this.state.gameOver) return false;
        if (this.state.phase === PHASE.BATTLE) {
            this.state.phase = PHASE.MAIN_2;
            this.state.selectedAttacker = null;
            this.ui.addLog("已自动进入主要阶段2", "turn");
        }
        return this.state.phase === PHASE.MAIN_1 || this.state.phase === PHASE.MAIN_2;
    }

    summonMonster(cardIndex, position = MONSTER_POSITION.ATTACK, faceDown = false) {
        if (this.effectBusy) { this.ui.addLog("请等待特效播完", "damage"); return; }
        if (!this._ensureMainPhaseForHandAction()) {
            this.ui.addLog("当前不能召唤怪兽", "damage");
            return;
        }
        const card = this.state.currentPlayer.hand[cardIndex];
        // 先获取手牌元素位置（引擎处理后卡牌会从手牌移除）
        const handEl = typeof document === "undefined"
            ? null
            : document.querySelector(`[data-instance-id="${card?.instanceId}"]`);
        const handRect = handEl ? handEl.getBoundingClientRect() : null;
        const result = this.engine.normalSummon(this.state.currentPlayer, cardIndex, position, faceDown);
        this.ui.addLog(result.message, result.success ? "play" : "damage",
            result.success ? { card, private: faceDown } : null);
        if (result.success && !result.needsTribute) {
            this._pvpSendWithCard("summon", cardIndex, card, { position, faceDown });
        }
        if (result.needsTribute) {
            this.refresh();
            return;
        }
        if (result.success && card) {
            const attr = card.attribute || card.element || "none";
            const hasOnSummon = card.effects?.some(e => e.trigger === "onSummon");
            const lockTime = hasOnSummon ? 3200 : 2600;
            this._lockForEffect(lockTime);
            this.checkAndRefresh();
            raf(() => {
                const slots = document.querySelectorAll(`[data-owner="${this.state.currentPlayerIndex}"][data-zone="monster"]`);
                const lastSlot = [...slots].reverse().find(s => s.querySelector(".card"));
                if (lastSlot) {
                    // 出牌到怪兽区运镜动画
                    if (handRect) {
                        const tempEl = document.createElement("div");
                        tempEl.style.cssText = `position:fixed;left:${handRect.left}px;top:${handRect.top}px;width:${handRect.width}px;height:${handRect.height}px;pointer-events:none;z-index:-1;`;
                        document.body.appendChild(tempEl);
                        animatePlayToZone(card, tempEl, lastSlot, c => this.ui.cardHTML(c), { endScale: 0.75 }).then(() => tempEl.remove());
                    }
                    setTimeout(() => {
                        playSummonEffect(lastSlot, attr, card.name, card.level, card.rarity);
                        if (hasOnSummon) {
                            setTimeout(() => {
                                const effectType = card.effects.find(e => e.trigger === "onSummon")?.type || "none";
                                playMonsterEffect(lastSlot, attr, effectType, card);
                            }, 800);
                        }
                    }, 600);
                }
            });
        } else {
            this.checkAndRefresh();
        }
    }

    setCard(cardIndex) {
        if (this.effectBusy) { this.ui.addLog("请等待特效播完", "damage"); return; }
        if (!this._ensureMainPhaseForHandAction()) {
            this.ui.addLog("当前不能盖放卡牌", "damage");
            return;
        }
        const card = this.state.currentPlayer.hand[cardIndex];
        if (card?.type === "monster") {
            return this.summonMonster(cardIndex, MONSTER_POSITION.DEFENSE, true);
        }
        // 先获取手牌元素位置
        const handEl = document.querySelector(`[data-instance-id="${card?.instanceId}"]`);
        const handRect = handEl ? handEl.getBoundingClientRect() : null;
        const result = this.engine.setCard(this.state.currentPlayer, cardIndex);
        // 陷阱卡盖放时，只显示"盖放了一张陷阱卡"，不暴露具体名称
        const logMsg = (result.success && card?.type === "trap")
            ? "盖放了一张陷阱卡"
            : result.message;
        this.ui.addLog(logMsg, result.success ? "play" : "damage",
            result.success ? { card, private: true } : null);
        if (result.success && !result.needsTribute) this._pvpSendWithCard("set", cardIndex, card);
        if (result.needsTribute) {
            this.refresh();
            return;
        }
        this.checkAndRefresh();
        if (result.success && card) {
            const isTrap = card.type === "trap";
            this._lockForEffect(800);
            raf(() => {
                // 找到刚放置的卡牌槽位
                const zone = isTrap ? "spell-trap" : "monster";
                const slots = document.querySelectorAll(`[data-owner="${this.state.currentPlayerIndex}"][data-zone="${zone}"]`);
                const lastSlot = [...slots].reverse().find(s => s.querySelector(".card-back-icon") || s.querySelector(".card"));
                if (lastSlot && handRect) {
                    // 出牌到区域运镜动画（盖牌显示卡背）
                    const tempEl = document.createElement("div");
                    tempEl.style.cssText = `position:fixed;left:${handRect.left}px;top:${handRect.top}px;width:${handRect.width}px;height:${handRect.height}px;pointer-events:none;z-index:-1;`;
                    document.body.appendChild(tempEl);
                    animatePlayToZone(card, tempEl, lastSlot, c => this.ui.cardHTML(c), { isCardBack: true, endScale: isTrap ? 0.7 : 0.75 }).then(() => tempEl.remove());
                } else if (lastSlot) {
                    lastSlot.style.animation = "summonRise .3s cubic-bezier(.23,1,.32,1) forwards";
                    setTimeout(() => { lastSlot.style.animation = ""; }, 350);
                }
            });
        }
    }

    canActivateSetSpell(card) {
        return this.engine.canActivateSetSpell(this.state.currentPlayer, card);
    }

    async _playRevivedMonsterArrival(effectType, ownerIndex) {
        if (effectType !== "reviveRecentGraveyard" && effectType !== "reviveRecentGraveyardV2"
            && effectType !== "specialSummonFromGraveyard") return;
        const revived = this.engine._lastRevivedCard;
        if (!revived) return;
        this.checkAndRefresh();
        await new Promise(resolve => setTimeout(resolve, 80));
        const slot = [...document.querySelectorAll(`[data-owner="${ownerIndex}"][data-zone="monster"]`)]
            .find(item => item.dataset.instanceId === revived.instanceId);
        if (!slot) return;
        playSummonEffect(slot, revived.attribute || "none", revived.name, revived.level, revived.rarity, {
            specialSummon: true,
            fromGraveyard: true,
        });
        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    activateSetSpell(card) {
        if (this.effectBusy || !card) return;
        const player = this.state.currentPlayer;
        const effect = card.effect || card.effects?.[0];
        const targetType = this.engine.getEffectTargetType(effect);
        if (!["none", "enemy_player", "self_player", "both_players"].includes(targetType)) {
            this.pendingEffectCard = card;
            this.pendingSetSpell = true;
            this.selectedCardIndex = -1;
            this.phaseBeforeSelection = this.state.phase;
            this.state.phase = PHASE.TARGET_SELECT;
            this.state.validTargets = this.engine.getValidTargets(player, effect);
            this.ui.addLog(`请选择${card.name}的目标`, "play");
            this.refresh();
            return;
        }
        const result = this.engine.activateSetSpell(player, card);
        this.ui.addLog(result.message, result.success ? "play" : "damage", result.success ? { card } : null);
        if (result.success) {
            this._pvpSendWithCard("activateSpell", -1, card, { fromSet: true });
            this._lockForEffect(3200);
            raf(async () => {
                const spellAttr = card.attribute || card.element || "none";
                await playSpellCinematic(spellAttr, card.name, card.rarity);
                playSpellEffectV2(null, spellAttr, card.name, card.effects?.[0]?.type || "none", card, 0);
                this._releaseEffectLocks();
                this.checkAndRefresh();
            });
        }
        this.checkAndRefresh();
    }

    flipSummon(card) {
        if (this.effectBusy) { this.ui.addLog("请等待特效播完", "damage"); return; }
        if (!this._isHumanAllowed() || this.state.gameOver) return;
        if (this.state.phase !== PHASE.MAIN_1 && this.state.phase !== PHASE.MAIN_2) {
            this.ui.addLog("只能在主要阶段翻转召唤", "damage");
            return;
        }
        const result = this.engine.flipSummon(this.state.currentPlayer, card);
        this.ui.addLog(result.message, result.success ? "play" : "damage",
            result.success ? { card } : null);
        if (result.success) {
            const monsterIndex = this.state.currentPlayer.monsterZone.indexOf(card);
            this._pvpSend({ type: "flipSummon", monsterIndex });
        }
        this.checkAndRefresh();
        if (result.success && result.card) {
            this._lockForEffect(1600);
            raf(() => {
                const slots = document.querySelectorAll(`[data-owner="${this.state.currentPlayerIndex}"][data-zone="monster"]`);
                const slot = [...slots].find(s => s.dataset.instanceId === card.instanceId);
                if (slot) {
                    slot.classList.add("flip-summoning");
                    setTimeout(() => slot.classList.remove("flip-summoning"), 600);
                    const flipAttr = card.attribute || card.element || "none";
                    playFlipSummonEffect(slot, false, flipAttr);
                    const hasOnFlip = card.effects?.some(e => e.trigger === "onFlip");
                    if (hasOnFlip) {
                        setTimeout(() => {
                            const attr = card.attribute || card.element || "none";
                            const effectType = card.effects?.find(e => e.trigger === "onFlip")?.type || "none";
                            playMonsterEffect(slot, attr, effectType, card);
                        }, 700);
                    }
                }
            });
        }
    }

    changePosition(card) {
        if (this.effectBusy) { this.ui.addLog("请等待特效播完", "damage"); return; }
        if (!this._isHumanAllowed() || this.state.gameOver) return;
        // 先找到卡槽DOM，添加旋转动画
        const slots = document.querySelectorAll(`[data-owner="${this.state.currentPlayerIndex}"][data-zone="monster"]`);
        const slot = [...slots].find(s => s.dataset.instanceId === card.instanceId);
        const isToDefense = card.position === MONSTER_POSITION.ATTACK;
        if (slot) {
            slot.classList.add(isToDefense ? "position-changing" : "position-changing-to-attack");
        }
        const result = this.engine.changePosition(this.state.currentPlayer, card);
        this.ui.addLog(result.message, result.success ? "play" : "damage");
        if (result.success) {
            const monsterIndex = this.state.currentPlayer.monsterZone.indexOf(card);
            this._pvpSend({ type: "changePosition", monsterIndex });
        }
        this._lockForEffect(500);
        this.checkAndRefresh();
    }

    activateMonsterEffect(card) {
        if (this.effectBusy) { this.ui.addLog("请等待特效播完", "damage"); return; }
        if (!this._isHumanAllowed() || this.state.gameOver) return;
        if (this.state.phase !== PHASE.MAIN_1 && this.state.phase !== PHASE.MAIN_2) {
            this.ui.addLog("只能在主要阶段发动效果", "damage");
            return;
        }
        if (!card.faceUp || card.oncePerTurnUsed) {
            this.ui.addLog("该效果本回合已使用过", "damage");
            return;
        }
        const result = this.engine.triggerAllEffects(this.state.currentPlayer, card, "manual");
        if (result) {
            card.oncePerTurnUsed = true;
            this.ui.addLog(`${card.name}发动效果：${result}`, "play", { card });
            const monsterIndex = this.state.currentPlayer.monsterZone.indexOf(card);
            this._pvpSend({ type: "activateMonsterEffect", monsterIndex });
            // 播放怪兽效果特效
            const slots = document.querySelectorAll(`[data-owner="${this.state.currentPlayerIndex}"][data-zone="monster"]`);
            const slot = [...slots].find(s => s.dataset.instanceId === card.instanceId);
            if (slot) {
                const attr = card.attribute || card.element || "none";
                const effectType = card.effects?.find(e => e.trigger === "manual")?.type || "none";
                this._lockForEffect(1000);
                raf(() => playMonsterEffect(slot, attr, effectType, card));
            }
        } else {
            this.ui.addLog("没有可发动的效果", "damage");
        }
        this.checkAndRefresh();
    }

    activateSpell(cardIndex) {
        if (this.effectBusy) { this.ui.addLog("请等待特效播完", "damage"); return; }
        if (!this._ensureMainPhaseForHandAction()) {
            this.ui.addLog("当前不能发动魔法", "damage");
            return;
        }
        const card = this.state.currentPlayer.hand[cardIndex];
        if (!card) return;
        const check = this.engine.canPlayEffect(this.state.currentPlayer, card);
        if (!check.canPlay) {
            this.ui.addLog(check.reason, "damage");
            return;
        }
        const primaryEffect = card.effect || card.effects?.[0];
        const targetType = this.engine.getEffectTargetType(primaryEffect);
        if (!["none", "enemy_player", "self_player", "both_players"].includes(targetType)) {
            this.selectedCardIndex = cardIndex;
            this.pendingEffectCard = card;
            this.phaseBeforeSelection = this.state.phase;
            this.state.phase = targetType === "graveyard" ? PHASE.GRAVEYARD_SELECT : PHASE.TARGET_SELECT;
            this.state.validTargets = this.engine.getValidTargets(this.state.currentPlayer, primaryEffect);
            this.ui.addLog(`请选择${card.name}的目标`, "play");
            this.refresh();
            return;
        }
        const handBefore = new Set(this.state.currentPlayer.hand.map(handCard => handCard.instanceId));
        // 记录对方场上怪兽，用于检测"返回手牌"效果
        const opp = this.state.opponentPlayer;
        const oppFieldBefore = new Map(opp.monsterZone.map(c => [c.instanceId, c]));
        const oppSlotRects = new Map();
        if (typeof document !== "undefined") {
            document.querySelectorAll('[data-owner="1"][data-zone="monster"]').forEach(slot => {
                if (slot.dataset.instanceId) oppSlotRects.set(slot.dataset.instanceId, slot.getBoundingClientRect());
            });
        }
        const oppHandBefore = new Set(opp.hand.map(c => c.instanceId));
        const result = this.engine.activateSpell(this.state.currentPlayer, cardIndex);
        this.ui.addLog(result.message, result.success ? "play" : "damage",
            result.success ? { card } : null);
        if (result.success) this._pvpSendWithCard("activateSpell", cardIndex, card);
        if (result.success && card) {
            const attr = card.attribute || card.element || "none";
            const effectType = card.effects?.[0]?.type || "none";

            // 先获取手牌元素位置（checkAndRefresh 会重新渲染，之后就找不到了）
            const handEl = document.querySelector(`[data-instance-id="${card.instanceId}"]`);
            const handRect = handEl ? handEl.getBoundingClientRect() : null;
            const player = this.state.currentPlayer;
            const drawnCards = ANIMATED_DRAW_EFFECTS.has(effectType)
                ? player.hand.filter(handCard => !handBefore.has(handCard.instanceId))
                : [];
            for (const drawn of drawnCards) {
                const index = player.hand.indexOf(drawn);
                if (index >= 0) player.hand.splice(index, 1);
            }

            // 先播魔法卡飞向墓地运镜，等完成后再抽卡

            if (result.isFieldSpell) {
                this.checkAndRefresh();
                // 场地魔法：飞向场地卡槽
                this._lockForEffect(3800);
                raf(() => {
                    const fieldSlot = document.querySelector(`.field-zone-slot[data-owner="${this.state.currentPlayerIndex}"][data-zone="field"]`);
                    if (fieldSlot) fieldSlot.classList.add("field-spell-activate");
                    if (handRect) {
                        const tempEl = document.createElement("div");
                        tempEl.style.cssText = `position:fixed;left:${handRect.left}px;top:${handRect.top}px;width:${handRect.width}px;height:${handRect.height}px;pointer-events:none;z-index:-1;`;
                        document.body.appendChild(tempEl);
                        animatePlayToZone(card, tempEl, fieldSlot, c => this.ui.cardHTML(c), { endScale: 0.85 }).then(() => tempEl.remove());
                    }
                    setTimeout(async () => {
                        await playSpellCinematic(attr, card.name, card.rarity);
                        playSpellEffectV2(null, attr, card.name, effectType, card, this.state.currentPlayerIndex);
                    }, 600);
                });
            } else {
                const destroyedMonsters = [...oppFieldBefore.values()].filter(
                    monster => !opp.monsterZone.some(current => current.instanceId === monster.instanceId)
                        && opp.graveyard.some(current => current.instanceId === monster.instanceId),
                );
                if (handEl) {
                    handEl.style.pointerEvents = "none";
                    handEl.style.opacity = "0";
                }
                // 普通魔法：先飞墓地，完成后再抽卡
                this._lockForEffect(9000);
                raf(async () => {
                    // 阶段1：魔法卡飞向墓地
                    if (handRect) {
                        const tempEl = document.createElement("div");
                        tempEl.style.cssText = `position:fixed;left:${handRect.left}px;top:${handRect.top}px;width:${handRect.width}px;height:${handRect.height}px;pointer-events:none;z-index:-1;`;
                        document.body.appendChild(tempEl);
                        await animatePlayToGraveyard(card, tempEl, c => this.ui.cardHTML(c), "player-graveyard-pile");
                        tempEl.remove();
                    }
                    // 阶段2：魔法卡运镜 → 播放魔法特效
                    await playSpellCinematic(attr, card.name, card.rarity);
                    playSpellEffectV2(null, attr, card.name, effectType, card, this.state.currentPlayerIndex);
                    await this._playRevivedMonsterArrival(effectType, this.state.currentPlayerIndex);
                    await new Promise(resolve => setTimeout(resolve, 1300));
                    for (const destroyed of destroyedMonsters) {
                        const savedRect = oppSlotRects.get(destroyed.instanceId);
                        if (!savedRect) continue;
                        await animateCinematicDestroy(
                            { getBoundingClientRect: () => savedRect },
                            destroyed,
                            c => this.ui.cardHTML(c),
                            "opponent-graveyard-pile",
                        );
                    }
                    this.checkAndRefresh();

                    // 阶段2.5：检测是否有怪兽被返回手牌，播放电影级动画
                    const returnedCards = [];
                    for (const [instanceId, cardData] of oppFieldBefore) {
                        if (!opp.monsterZone.some(c => c.instanceId === instanceId)) {
                            // 这只怪兽被移除了，检查是否在对方手牌中
                            const returnedCard = opp.hand.find(c => c.instanceId === instanceId);
                            if (returnedCard) {
                                returnedCards.push(returnedCard);
                            }
                        }
                    }
                    if (returnedCards.length > 0) {
                        this._lockForEffect(2000);
                        for (const returnedCard of returnedCards) {
                            // 找到怪兽被移除前的DOM槽位（用对方场上现有的怪兽位置估算）
                            const savedRect = oppSlotRects.get(returnedCard.instanceId);
                            const fromSlot = savedRect ? { getBoundingClientRect: () => savedRect } : null;
                            await animateCinematicReturnToHand(returnedCard, c => this.ui.cardHTML(c), fromSlot, "opponent-hand");
                            await new Promise(r => setTimeout(r, 300));
                        }
                    }

                    // 阶段3：如果有抽卡效果，逐张播放抽卡运镜
                    if (drawnCards.length > 0) {
                        await new Promise(resolve => setTimeout(resolve, 800)); // 等魔法特效播完
                        // 逐张播放运镜，播完放回手牌
                        for (const drawn of drawnCards) {
                            if (drawn && drawn.type) {
                                this.ui.showDrawAnimation?.(drawn, 0, "DRAW");
                                await animateDrawCard(drawn, c => this.ui.cardHTML(c));
                                player.hand.push(drawn); // 放回手牌
                                this.refresh();
                                await new Promise(r => setTimeout(r, 200)); // 间隔
                            }
                        }
                    }
                    this._releaseEffectLocks();
                });
            }
        } else {
            this.checkAndRefresh();
        }
    }

    confirmTarget(target) {
        if (this.state.phase !== PHASE.TARGET_SELECT && this.state.phase !== PHASE.GRAVEYARD_SELECT) return;
        const player = this.state.currentPlayer;
        const cardIndex = this.selectedCardIndex;
        const card = this.pendingSetSpell ? this.pendingEffectCard : player.hand[cardIndex];
        if (!card) {
            this.cancelTargetSelect();
            return;
        }
        const returnPhase = this.phaseBeforeSelection || PHASE.MAIN_1;
        const handBefore = new Set(player.hand.map(handCard => handCard.instanceId));
        // 记录对方场上怪兽，用于检测"返回手牌"效果
        const opp = this.state.opponentPlayer;
        const oppFieldBefore = new Map(opp.monsterZone.map(c => [c.instanceId, c]));
        const oppSlotRects = new Map();
        if (typeof document !== "undefined") {
            document.querySelectorAll('[data-owner="1"][data-zone="monster"]').forEach(slot => {
                if (slot.dataset.instanceId) oppSlotRects.set(slot.dataset.instanceId, slot.getBoundingClientRect());
            });
        }
        const result = this.pendingSetSpell
            ? this.engine.activateSetSpell(player, card, target)
            : this.engine.activateSpell(player, cardIndex, target);
        this.ui.addLog(result.message, result.success ? "play" : "damage",
            result.success ? { card } : null);
        if (!result.success) {
            this.state.validTargets = this.engine.getValidTargets(player, card.effect || card.effects?.[0]);
            this.refresh();
            return;
        }
        const activatedFromSet = !!this.pendingSetSpell;
        this.pendingEffectCard = null;
        this.pendingSetSpell = false;
        this.selectedCardIndex = -1;
        this.state.validTargets = [];
        this.state.phase = returnPhase;
        this._pvpSendWithCard("activateSpell", cardIndex, card, {
            targetId: target?.instanceId || null,
            targetIsPlayer: !!target?.isPlayer,
            fromSet: activatedFromSet,
        });
        const handEl = document.querySelector(`[data-instance-id="${card.instanceId}"]`);
        const handRect = handEl ? handEl.getBoundingClientRect() : null;
        const attr = card.attribute || card.element || "none";
        const effectType = card.effects?.[0]?.type || "none";
        const drawnCards = ANIMATED_DRAW_EFFECTS.has(effectType)
            ? player.hand.filter(handCard => !handBefore.has(handCard.instanceId))
            : [];
        for (const drawn of drawnCards) {
            const index = player.hand.indexOf(drawn);
            if (index >= 0) player.hand.splice(index, 1);
        }
        if (result.isFieldSpell) {
            this.checkAndRefresh();
            this._lockForEffect(3800);
            raf(() => {
                const fieldSlot = document.querySelector(`.field-zone-slot[data-owner="${this.state.currentPlayerIndex}"][data-zone="field"]`);
                if (fieldSlot) fieldSlot.classList.add("field-spell-activate");
                if (handRect) {
                    const tempEl = document.createElement("div");
                    tempEl.style.cssText = `position:fixed;left:${handRect.left}px;top:${handRect.top}px;width:${handRect.width}px;height:${handRect.height}px;pointer-events:none;z-index:-1;`;
                    document.body.appendChild(tempEl);
                    animatePlayToZone(card, tempEl, fieldSlot, c => this.ui.cardHTML(c), { endScale: 0.85 }).then(() => tempEl.remove());
                }
                setTimeout(async () => {
                    await playSpellCinematic(attr, card.name, card.rarity);
                    playSpellEffectV2(null, attr, card.name, effectType, card, this.state.currentPlayerIndex);
                }, 600);
            });
        } else {
            const destroyedMonsters = [...oppFieldBefore.values()].filter(
                monster => !opp.monsterZone.some(current => current.instanceId === monster.instanceId)
                    && opp.graveyard.some(current => current.instanceId === monster.instanceId),
            );
            if (handEl) {
                handEl.style.pointerEvents = "none";
                handEl.style.opacity = "0";
            }
            this._lockForEffect(9000);
            raf(async () => {
                if (handRect) {
                    const tempEl = document.createElement("div");
                    tempEl.style.cssText = `position:fixed;left:${handRect.left}px;top:${handRect.top}px;width:${handRect.width}px;height:${handRect.height}px;pointer-events:none;z-index:-1;`;
                    document.body.appendChild(tempEl);
                    await animatePlayToGraveyard(card, tempEl, c => this.ui.cardHTML(c), "player-graveyard-pile");
                    tempEl.remove();
                }
                await playSpellCinematic(attr, card.name, card.rarity);
                playSpellEffectV2(null, attr, card.name, effectType, card, this.state.currentPlayerIndex);
                await this._playRevivedMonsterArrival(effectType, this.state.currentPlayerIndex);
                await new Promise(resolve => setTimeout(resolve, 1300));
                for (const destroyed of destroyedMonsters) {
                    const savedRect = oppSlotRects.get(destroyed.instanceId);
                    if (!savedRect) continue;
                    await animateCinematicDestroy(
                        { getBoundingClientRect: () => savedRect },
                        destroyed,
                        c => this.ui.cardHTML(c),
                        "opponent-graveyard-pile",
                    );
                }
                this.checkAndRefresh();

                // 检测是否有怪兽被返回手牌，播放电影级动画
                const returnedCards = [];
                for (const [instanceId, cardData] of oppFieldBefore) {
                    if (!opp.monsterZone.some(c => c.instanceId === instanceId)) {
                        const returnedCard = opp.hand.find(c => c.instanceId === instanceId);
                        if (returnedCard) returnedCards.push(returnedCard);
                    }
                }
                if (returnedCards.length > 0) {
                    this._lockForEffect(2000);
                    for (const returnedCard of returnedCards) {
                        const savedRect = oppSlotRects.get(returnedCard.instanceId);
                        const fromSlot = savedRect ? { getBoundingClientRect: () => savedRect } : null;
                        await animateCinematicReturnToHand(returnedCard, c => this.ui.cardHTML(c), fromSlot, "opponent-hand");
                        await new Promise(r => setTimeout(r, 300));
                    }
                }

                if (drawnCards.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, 800));
                    for (const drawn of drawnCards) {
                        if (drawn && drawn.type) {
                            this.ui.showDrawAnimation?.(drawn, 0, "DRAW");
                            await animateDrawCard(drawn, c => this.ui.cardHTML(c));
                            player.hand.push(drawn);
                            this.refresh();
                            await new Promise(r => setTimeout(r, 200));
                        }
                    }
                }
                this._releaseEffectLocks();
            });
        }
    }

    cancelTargetSelect() {
        this.state.phase = this.phaseBeforeSelection || PHASE.MAIN_1;
        this.selectedCardIndex = -1;
        this.pendingEffectCard = null;
        this.pendingSetSpell = false;
        this.state.validTargets = [];
        this.refresh();
    }

    selectTribute(card) {
        const result = this.engine.selectTribute(card);
        this.ui.addLog(result.message, result.success ? "play" : "damage",
            result.success ? { card } : null);
        this.refresh();
    }

    confirmTribute() {
        const pending = this.state.pendingTribute;
        const card = pending?.card;
        const cardIndex = pending?.cardIndex ?? -1;
        const tributeCount = pending?.needed || (Number(card?.level) >= 7 ? 2 : 1);
        const result = this.engine.confirmTribute();
        this.ui.addLog(result.message, result.success ? "play" : "damage");
        if (result.success && card) {
            this._pvpSendWithCard("summon", cardIndex, card, {
                position: result.card?.position || MONSTER_POSITION.ATTACK,
                faceDown: !result.card?.faceUp,
                tributeSummon: true,
                tributeCount,
            });
        }
        this.checkAndRefresh();
        if (result.success && card && result.card?.faceUp !== false) {
            raf(() => {
                const slots = document.querySelectorAll('[data-owner="0"][data-zone="monster"]');
                const slot = result.card?.instanceId
                    ? [...slots].find(item => item.dataset.instanceId === result.card.instanceId)
                    : [...slots].reverse().find(item => item.querySelector(".card"));
                if (slot) playSummonEffect(slot, card.attribute || "none", card.name, card.level, card.rarity, {
                    tributeSummon: true,
                    tributeCount,
                });
            });
        }
    }

    cancelTribute() {
        this.engine.cancelTribute();
        this.refresh();
    }

    selectAttacker(card) {
        if (!this._isHumanAllowed() || this.state.gameOver) return;
        if (this.effectBusy) {
            this.ui.addLog("请等待特效播完", "damage");
            return;
        }
        if (this.state.firstTurn && GAME_CONFIG.FIRST_TURN_NO_BATTLE) {
            this.ui.addLog("先攻首回合不能攻击", "damage");
            return;
        }
        if (this.state.currentPlayer.skipBattlePhase) {
            this.ui.addLog("本回合不能进入战斗阶段", "damage");
            return;
        }
        if (this.state.phase === PHASE.MAIN_1) {
            this.state.phase = PHASE.BATTLE;
            this.ui.addLog("已自动进入战斗阶段", "turn");
        }
        if (this.state.phase !== PHASE.BATTLE) {
            this.ui.addLog("主要阶段2之后不能重新进入战斗阶段", "damage");
            return;
        }
        if (!card.canAttack || card.hasAttackedThisTurn || card.position === MONSTER_POSITION.DEFENSE) return;
        if (this.state.selectedAttacker?.instanceId === card.instanceId) {
            if (this.state.opponentPlayer.monsterZone.length === 0) this.attackPlayer();
            return;
        }
        this.state.selectedAttacker = card;
        this.ui.addLog(`选择${card.name}攻击`, "play");
        if (this.state.opponentPlayer.monsterZone.length === 0) {
            this.attackPlayer();
            return;
        }
        this.refresh();
    }

    attackTarget(target, _redirectDepth = 0) {
        if (this.effectBusy) { this.ui.addLog("请等待特效播完", "damage"); return; }
        if (this.state.gameOver || !this.state.selectedAttacker) return;
        // 重定向安全限制：最多重定向3次，防止无限循环
        if (_redirectDepth > 3) {
            this.ui.addLog("攻击重定向次数过多，攻击终止", "damage");
            this.state.selectedAttacker = null;
            return;
        }
        const attacker = this.state.selectedAttacker;
        const attackerIndexBeforeBattle = this.state.currentPlayer.monsterZone.indexOf(attacker);
        const targetIndexBeforeBattle = target === "player"
            ? -1
            : this.state.opponentPlayer.monsterZone.indexOf(target);
        const attackerLpBeforeBattle = this.state.currentPlayer.lp;
        const defenderLpBeforeBattle = this.state.opponentPlayer.lp;

        // 先找到对方场上可能触发的陷阱卡DOM位置（在引擎处理前）
        const isBrowser = typeof document !== "undefined";
        const defenderSpellTrapSlots = isBrowser ? document.querySelectorAll(`[data-owner="1"][data-zone="spell-trap"]`) : [];
        const possibleTrapSlot = isBrowser ? [...defenderSpellTrapSlots].reverse().find(s => s.querySelector(".card-back-icon")) : null;

        const result = this.engine.attack(attacker, target);
        if (result.success) {
            // 使用区域索引而非 instanceId（两端 instanceId 不同）
            let targetInfo;
            if (target === "player") {
                targetInfo = { targetType: "player" };
            } else {
                targetInfo = { targetType: "monster", targetIndex: targetIndexBeforeBattle };
            }
            this._pvpSend({
                type: "attack",
                attackerIndex: attackerIndexBeforeBattle,
                ...targetInfo,
                damageToAttacker: Math.max(0, attackerLpBeforeBattle - this.state.currentPlayer.lp),
                damageToDefender: Math.max(0, defenderLpBeforeBattle - this.state.opponentPlayer.lp),
                trapCardData: result.trap ? this._serializeCard(result.trapCard) : null,
                attackCanceled: result.attackCanceled === true,
            });
        }
        // 攻击重定向（里间雨效果②）
        if (result.redirect) {
            this.ui.addLog(result.message, "play");
            this.state.selectedAttacker = attacker;
            this.attackTarget(result.redirect, _redirectDepth + 1);
            return;
        }
        this.ui.addLog(result.message, result.success ? "damage" : "damage",
            result.trap ? { card: result.trapCard } : null);
        this.state.selectedAttacker = null;

        // 陷阱发动特效 —— 简化版：翻牌→效果→飞墓区
        if (result.trap) {
            const trapName = result.message.match(/【(.+?)】/)?.[1] || "陷阱";
            const trapCardData = result.trapCard || { name: trapName, type: "trap", rarity: "R" };
            if (possibleTrapSlot) {
                // 阶段1：翻牌动画（0-600ms）
                this._lockForEffect(5600);
                (async () => {
                    await playTrapActivationV5(possibleTrapSlot, trapCardData);
                    await animateTrapToGraveyard(possibleTrapSlot, trapCardData);
                    // 阶段2：播放效果特效（攻击无效、怪兽破坏等）
                    const attr = trapCardData.attribute || "none";
                    const effectType = trapCardData.effects?.[0]?.type || "none";
                    playTrapEffectV2(possibleTrapSlot, "counter", trapName, effectType, trapCardData, Number(possibleTrapSlot.dataset.owner || 0));
                    // 阶段3：效果播完后再飞墓区
                    if (result.attackCanceled) {
                        const attackerSlot = [...document.querySelectorAll(`[data-owner="0"][data-zone="monster"]`)]
                            .find(slot => slot.dataset.instanceId === attacker.instanceId);
                        const targetSlot = target === "player"
                            ? document.querySelector("#opponent-area .player-hud")
                            : [...document.querySelectorAll(`[data-owner="1"][data-zone="monster"]`)]
                                .find(slot => slot.dataset.instanceId === target?.instanceId);
                        await playNegatedAttackBarrier(attackerSlot, targetSlot, attacker);
                    } else {
                        await new Promise(resolve => setTimeout(resolve, 1300));
                    }
                    this.checkAndRefresh();
                })();
            } else {
                this._lockForEffect(2600);
                showAnnounceBanner("trap", "counter", trapName);
                setTimeout(() => this.checkAndRefresh(), 1500);
            }
            return;
        }

        this._lockForEffect(1500);

        // 检查被破坏怪兽的onDestroyed效果并播放特效
        const destroyedTargets = [];
        if (target !== "player" && target?.instanceId) {
            const targetOwner = this.state.players[0].monsterZone.some(c => c.instanceId === target.instanceId) ? 0 : 1;
            const targetDestroyed = !this.state.players[targetOwner].monsterZone.some(c => c.instanceId === target.instanceId);
            if (targetDestroyed && target.effects?.some(e => e.trigger === "onDestroyed")) {
                destroyedTargets.push({ card: target, owner: targetOwner });
            }
        }
        const attackerOwnerIdx = this.state.players[0].monsterZone.some(c => c.instanceId === attacker.instanceId) ? 0 : 1;
        const attackerDestroyed = !this.state.players[attackerOwnerIdx].monsterZone.some(c => c.instanceId === attacker.instanceId);
        if (attackerDestroyed && attacker.effects?.some(e => e.trigger === "onDestroyed")) {
            destroyedTargets.push({ card: attacker, owner: attackerOwnerIdx });
        }

        // --- 电影级破坏动画 ---
        // 在 checkAndRefresh 之前，找到被破坏怪兽的 DOM 槽位
        const attackerOwner = this.state.players[0].monsterZone.some(c => c.instanceId === attacker.instanceId) ? 0 : 1;
        const attackerElSlots = document.querySelectorAll(`[data-owner="${attackerOwner}"][data-zone="monster"]`);
        const attackerSlotEl = [...attackerElSlots].find(s => s.dataset.instanceId === attacker.instanceId);
        const attackerSlotRect = attackerSlotEl?.getBoundingClientRect() || null;
        const attackerSurvived = this.state.players[attackerOwner].monsterZone.some(c => c.instanceId === attacker.instanceId);

        // 如果目标被破坏，播放电影级粉碎动画
        if (target !== "player" && target?.instanceId) {
            const targetOwner = attackerOwner === 0 ? 1 : 0;
            const targetElSlots = document.querySelectorAll(`[data-owner="${targetOwner}"][data-zone="monster"]`);
            const targetSlotEl = [...targetElSlots].find(s => s.dataset.instanceId === target.instanceId);
            const targetSurvived = this.state.players[targetOwner].monsterZone.some(c => c.instanceId === target.instanceId);

            if (targetSlotEl && !targetSurvived) {
                this._lockForEffect(2600);
                // 先播放攻击碰撞
                playAttackAnimation(attackerSlotEl, targetSlotEl, attacker, attackerSurvived);
                // 延迟播放破坏动画
                setTimeout(() => {
                    const graveId = targetOwner === 0 ? "player-graveyard-pile" : "opponent-graveyard-pile";
                    animateCinematicDestroy(targetSlotEl, target, c => this.ui.cardHTML(c), graveId).then(() => {
                        this.checkAndRefresh();
                        // 播放onDestroyed特效
                        for (const { card, owner } of destroyedTargets) {
                            const ownerIdx = owner === 0 ? 0 : this.state.currentPlayerIndex;
                            const effectType = card.effects?.find(e => e.trigger === "onDestroyed")?.type || "none";
                            const attr = card.attribute || card.element || "none";
                            const tSlots = document.querySelectorAll(`[data-owner="${ownerIdx}"][data-zone="monster"]`);
                            setTimeout(() => {
                                if (tSlots.length > 0) playMonsterEffect(tSlots[tSlots.length - 1], attr, effectType);
                            }, 300);
                        }
                    });
                }, 500);
                return;
            }
        }

        this.checkAndRefresh();

        raf(() => {
            const liveAttackerSlot = [...document.querySelectorAll(`[data-owner="${attackerOwner}"][data-zone="monster"]`)]
                .find(slot => slot.dataset.instanceId === attacker.instanceId) || attackerSlotRect;
            // 播放onDestroyed特效
            for (const { card, owner } of destroyedTargets) {
                const ownerIdx = owner === 0 ? 0 : this.state.currentPlayerIndex;
                const effectType = card.effects?.find(e => e.trigger === "onDestroyed")?.type || "none";
                const attr = card.attribute || card.element || "none";
                const tSlots = document.querySelectorAll(`[data-owner="${ownerIdx}"][data-zone="monster"]`);
                setTimeout(() => {
                    if (tSlots.length > 0) {
                        playMonsterEffect(tSlots[tSlots.length - 1], attr, effectType);
                    } else {
                        const oppSlots = document.querySelectorAll(`[data-owner="${ownerIdx === 0 ? 1 : 0}"][data-zone="monster"]`);
                        if (oppSlots.length > 0) playMonsterEffect(oppSlots[0], attr, effectType);
                    }
                }, 500);
            }

            if (target === "player") {
                // 直接攻击
                const oppHud = document.querySelector("#opponent-area .player-hud");
                const oppLifeBar = oppHud?.querySelector(".hp-bar-wrap") || oppHud;
                playAttackAnimation(liveAttackerSlot, null, attacker, attackerSurvived, oppLifeBar);
                if (oppHud) {
                    setTimeout(() => showDamageNumber(oppLifeBar, attacker.currentAttack || 0, "damage"), 450);
                }
            } else if (target?.instanceId && attackerSurvived) {
                // 攻击方存活但目标未被破坏（守备表示等情况）
                const targetOwner = attackerOwner === 0 ? 1 : 0;
                const targetSlots = document.querySelectorAll(`[data-owner="${targetOwner}"][data-zone="monster"]`);
                const targetSlot = [...targetSlots].find(s => s.dataset.instanceId === target.instanceId);
                playAttackAnimation(liveAttackerSlot, targetSlot, attacker, attackerSurvived);
                if (targetSlot) {
                    const dmg = Math.max(0, (attacker.currentAttack || 0) - (target.currentDefense || 0));
                    if (dmg > 0) setTimeout(() => showDamageNumber(targetSlot, dmg, "damage"), 400);
                }
            }
        });
    }

    attackPlayer() {
        if (this.state.gameOver || !this.state.selectedAttacker) return;
        if (this.state.opponentPlayer.monsterZone.length > 0) {
            this.ui.addLog("对方场上有怪兽时不能直接攻击", "damage");
            return;
        }
        this.attackTarget("player");
    }

    endTurn() {
        if (this.state.gameOver || this.turnEnding || !this._isHumanAllowed()) return;
        if (this.state.phase === PHASE.TRIBUTE_SELECT) this.cancelTribute();
        else if (this.state.phase === PHASE.TARGET_SELECT || this.state.phase === PHASE.GRAVEYARD_SELECT) this.cancelTargetSelect();

        const player = this.state.currentPlayer;
        const excess = Math.max(0, player.hand.length - GAME_CONFIG.END_HAND_LIMIT);
        if (excess > 0 && this.state.currentPlayerIndex === 0 && typeof this.ui.showDiscardSelection === "function") {
            this.turnEnding = true;
            this.state.phase = PHASE.END;
            this.refresh();
            this.ui.showDiscardSelection(player.hand, excess, selectedIds => {
                const discarded = this.engine.discardToEndLimit(player, selectedIds);
                this.ui.addLog(`${player.name}在结束阶段丢弃了${discarded.map(card => card.name).join("、")}`, "play");
                this._finalizeEndTurn();
            });
            return;
        }
        if (excess > 0) {
            const discarded = this.engine.discardToEndLimit(player);
            this.ui.addLog(`${player.name}在结束阶段丢弃了${discarded.length}张牌`, "play");
        }
        this._finalizeEndTurn();
    }

    _finalizeEndTurn() {
        if (this.state.gameOver) return;
        this.turnEnding = this.mode === "pvp";
        this.state.phase = PHASE.END;
        this.engine.emit("onTurnEnd", { player: this.state.currentPlayer });
        this.engine.endTurn();
        if (this.mode === "local") {
            this.ui.showHandoff(this.state.currentPlayer.name, () => this._beginTurn());
            return;
        }
        if (this.mode === "pvp") {
            this.state.currentPlayerIndex = 1;
            this.checkAndRefresh();
            const finalState = this._serializePvpState();
            const requestId = `turn_${this.state.turn}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const sendEndTurn = () => this.pvpClient?.endTurn(finalState, requestId) === true;
            if (!sendEndTurn()) {
                this.turnEnding = false;
                this.ui.addLog("联机连接已断开，本次回合未提交", "damage");
                this.checkAndRefresh();
                return;
            }
            this.clearTurnAckTimer();
            this.turnAckTimer = setTimeout(() => {
                this.ui.addLog("正在重新确认回合状态…", "turn");
                sendEndTurn();
                this.turnAckTimer = setTimeout(() => {
                    this.turnAckTimer = null;
                    this.turnEnding = false;
                    this.ui.addLog("回合同步失败，请检查网络连接", "damage");
                    this.checkAndRefresh();
                }, 6000);
            }, 6000);
            return;
        }
        this.turnEnding = false;
        this._beginTurn();
    }

    // ---- PvP 远程操作同步 ----

    /** 发送动作到对手（附带卡牌数据用于隐藏信息揭示） */
    _pvpSend(action) {
        if (this.mode !== "pvp" || !this.pvpClient) return;
        this.pvpClient.sendAction({ ...action, state: this._serializePvpState() });
    }

    _serializePvpState() {
        const serializeTempEffect = effect => {
            if (!effect) return null;
            const { source, ...data } = effect;
            return {
                ...data,
                source: typeof source === "object"
                    ? source?.instanceId || source?.id || null
                    : source ?? null,
            };
        };
        const serializeCard = card => card ? {
            id: card.id,
            instanceId: card.instanceId,
            currentAttack: card.currentAttack,
            currentDefense: card.currentDefense,
            position: card.position,
            faceUp: card.faceUp,
            faceDown: card.faceDown,
            canAttack: card.canAttack,
            cannotAttack: card.cannotAttack,
            hasAttackedThisTurn: card.hasAttackedThisTurn,
            positionChangedThisTurn: card.positionChangedThisTurn,
            oncePerTurnUsed: card.oncePerTurnUsed,
            setTurn: card.setTurn,
            canActivate: card.canActivate,
            attackLocked: card.attackLocked,
            attackDisabledUntilEndPhase: card.attackDisabledUntilEndPhase,
            cannotBeTargeted: card.cannotBeTargeted,
            permanentBuffs: card.permanentBuffs || [],
            tempEffects: (card.tempEffects || []).map(serializeTempEffect).filter(Boolean),
        } : null;
        const serializePlayer = player => {
            const {
                deck, hand, monsterZone, spellTrapZone, fieldZone,
                graveyard, banished, extraDeck, oncePerTurnEffectsUsed,
                ...playerState
            } = player;
            return {
                ...playerState,
                deck: deck.map(serializeCard),
                hand: hand.map(serializeCard),
                monsterZone: monsterZone.map(serializeCard),
                spellTrapZone: spellTrapZone.map(serializeCard),
                fieldZone: serializeCard(fieldZone),
                graveyard: graveyard.map(serializeCard),
                banished: banished.map(serializeCard),
                extraDeck: extraDeck.map(serializeCard),
                oncePerTurnEffectsUsed: [...(oncePerTurnEffectsUsed || [])],
            };
        };
        return {
            currentPlayerIndex: this.state.currentPlayerIndex,
            turn: this.state.turn,
            phase: this.state.phase,
            winner: this.state.winner,
            isDraw: this.state.isDraw,
            gameOver: this.state.gameOver,
            winReason: this.state.winReason,
            firstTurn: this.state.firstTurn,
            players: this.state.players.map(serializePlayer),
        };
    }

    _applyPvpSnapshot(snapshot) {
        if (!snapshot || !Array.isArray(snapshot.players) || snapshot.players.length !== 2) return;
        const assignPlayer = (target, source) => {
            const hydrateCard = data => {
                if (!data) return null;
                const base = getCardById(data.id);
                return { ...createCardInstance(base || { id: data.id, name: data.id, type: "monster" }), ...data };
            };
            for (const [key, value] of Object.entries(source)) {
                if (key === "oncePerTurnEffectsUsed") {
                    target.oncePerTurnEffectsUsed = new Set(value || []);
                } else if (["deck", "hand", "monsterZone", "spellTrapZone", "graveyard", "banished", "extraDeck"].includes(key)) {
                    target[key] = (value || []).map(hydrateCard);
                } else if (key === "fieldZone") {
                    target.fieldZone = hydrateCard(value);
                } else {
                    target[key] = value;
                }
            }
        };
        assignPlayer(this.state.players[0], snapshot.players[1]);
        assignPlayer(this.state.players[1], snapshot.players[0]);
        this.state.currentPlayerIndex = snapshot.currentPlayerIndex === 0 ? 1 : 0;
        this.state.turn = snapshot.turn;
        this.state.phase = snapshot.phase;
        this.state.winner = snapshot.winner;
        this.state.isDraw = snapshot.isDraw;
        this.state.gameOver = snapshot.gameOver;
        this.state.winReason = snapshot.winReason;
        this.state.firstTurn = snapshot.firstTurn;
    }

    /** 从手牌出牌时，附带完整卡牌数据（对手不知道你手牌内容） */
    _pvpSendWithCard(type, cardIndex, card, extra = {}) {
        if (this.mode !== "pvp") return;
        this._pvpSend({ type, cardIndex, cardData: this._serializeCard(card), ...extra });
    }

    /** 接收并执行对手的动作 */
    applyRemoteAction(action) {
        if (this.mode !== "pvp" || !action) return Promise.resolve();
        const queuedAction = {
            ...action,
            _remoteVisual: this._captureRemoteVisual(action),
        };
        this._applyPvpSnapshot(action.state);
        this.checkAndRefresh();
        const generation = this._pvpTurnGeneration;
        this._effectQueue = this._effectQueue
            .then(() => this._applyRemoteActionQueued(queuedAction, generation))
            .catch(error => {
                console.error("PvP effect queue failed:", error);
                this.effectBusy = false;
            });
        return this._effectQueue;
    }

    async _applyRemoteActionQueued(action, generation = this._pvpTurnGeneration) {
        if (this.mode !== "pvp" || !action) return;
        if (generation !== this._pvpTurnGeneration) return;
        this.effectBusy = true;

        // 对手 = players[1]（从本地视角看）
        const opponent = this.state.players[1];
        const remoteVisual = action._remoteVisual || {};
        const remoteFieldSpell = action.type === "activateSpell"
            && action.cardData
            && (action.state?.players?.[0]?.fieldZone?.instanceId === action.cardData.instanceId
                || action.state?.players?.[0]?.fieldZone?.id === action.cardData.id);
        if (action.type === "activateSpell" && action.cardData && !remoteFieldSpell) {
            await this._playRemoteSpellSequence(action, remoteVisual);
            if (generation !== this._pvpTurnGeneration) {
                this.effectBusy = false;
                return;
            }
            this._logRemoteAction(action);
            this.checkAndRefresh();
            this.effectBusy = false;
            return;
        }
        if (action.type === "attack" && action.trapCardData) {
            await this._playRemoteTrapSequence(action, remoteVisual);
        }
        if (generation !== this._pvpTurnGeneration) {
            this.effectBusy = false;
            return;
        }
        await this._playRemoteActionEffect(action, remoteVisual);
        this._logRemoteAction(action);
        this.checkAndRefresh();
        await new Promise(resolve => raf(resolve));
        await this._playRemotePostRefreshEffect(action);
        const settleDelay = action.type === "attack" ? 900
            : action.type === "summon" || action.type === "flipSummon" ? 500
                : action.type === "activateMonsterEffect" ? 600
                    : 50;
        await new Promise(resolve => setTimeout(resolve, settleDelay));
        this.effectBusy = false;
        return;

        switch (action.type) {
            case "turnStart": {
                this.state.currentPlayerIndex = 1;
                this.engine.startTurn({ skipDraw: true });
                this.state.phase = PHASE.STANDBY;
                this.engine.emit("onPhaseStart", { player: opponent, phase: PHASE.STANDBY });
                this.state.phase = PHASE.MAIN_1;
                this.state.selectedAttacker = null;
                this.turnEnding = false;
                break;
            }
            case "draw": {
                // 对手抽卡：不揭示卡牌内容，只更新计数
                this.engine.drawCard(opponent);
                this.ui.addLog(`${opponent.name}抽了${action.count || 1}张卡`, "play");
                break;
            }
            case "summon": {
                // 对手从手牌召唤：需要卡牌数据来创建本地实例
                const cardData = action.cardData;
                if (cardData) {
                    // 从对手手牌中移除对应位置的卡（可能是占位符）
                    // 并在怪兽区创建正确的卡牌实例
                    const card = createCardInstance(cardData);
                    // 从对手手牌移除一张（位置对应）
                    if (action.cardIndex >= 0 && action.cardIndex < opponent.hand.length) {
                        opponent.hand.splice(action.cardIndex, 1);
                    }
                    // 设置卡牌状态
                    card.position = action.position || "attack";
                    card.faceUp = !action.faceDown;
                    card.faceDown = !!action.faceDown;
                    card.canAttack = !action.faceDown
                        && card.position === MONSTER_POSITION.ATTACK
                        && !this.state.firstTurn;
                    card.hasAttackedThisTurn = false;
                    card.positionChangedThisTurn = false;
                    card.setTurn = this.state.turn;
                    if (opponent.monsterZone.length < 5) {
                        opponent.monsterZone.push(card);
                    }
                }
                this.ui.addLog(`${opponent.name}召唤了怪兽`, "play");
                break;
            }
            case "set": {
                const cardData = action.cardData;
                if (cardData) {
                    const card = createCardInstance(cardData);
                    if (action.cardIndex >= 0 && action.cardIndex < opponent.hand.length) {
                        opponent.hand.splice(action.cardIndex, 1);
                    }
                    card.faceDown = true;
                    card.faceUp = false;
                    card.setTurn = this.state.turn;
                    if (cardData.type === "trap" || cardData.type === "spell") {
                        if (opponent.spellTrapZone.length < 5) {
                            opponent.spellTrapZone.push(card);
                        }
                    } else {
                        if (opponent.monsterZone.length < 5) {
                            opponent.monsterZone.push(card);
                        }
                    }
                }
                this.ui.addLog(`${opponent.name}盖放了一张卡`, "play");
                break;
            }
            case "flipSummon": {
                const monster = opponent.monsterZone[action.monsterIndex];
                if (monster) {
                    this.engine.flipSummon(opponent, monster);
                }
                this.ui.addLog(`${opponent.name}翻转召唤了怪兽`, "play");
                break;
            }
            case "changePosition": {
                const monster = opponent.monsterZone[action.monsterIndex];
                if (monster) {
                    this.engine.changePosition(opponent, monster);
                }
                this.ui.addLog(`${opponent.name}改变了怪兽表示形式`, "play");
                break;
            }
            case "activateSpell": {
                const cardData = action.cardData;
                if (cardData) {
                    const card = createCardInstance(cardData);
                    if (action.cardIndex >= 0 && action.cardIndex < opponent.hand.length) {
                        opponent.hand.splice(action.cardIndex, 1);
                    }
                    // 添加到魔法陷阱区或直接处理效果
                    this.engine.activateSpell(opponent, 0, action.targetSpec);
                }
                this.ui.addLog(`${opponent.name}发动了魔法卡`, "play");
                break;
            }
            case "activateMonsterEffect": {
                const monster = opponent.monsterZone[action.monsterIndex];
                if (monster) {
                    this.engine.triggerAllEffects(opponent, monster, "manual");
                }
                this.ui.addLog(`${opponent.name}发动了怪兽效果`, "play");
                break;
            }
            case "attack": {
                const attacker = opponent.monsterZone[action.attackerIndex];
                if (!attacker) break;
                if (action.targetType === "player") {
                    this.engine.attack(attacker, "player");
                } else {
                    const target = this.state.players[0].monsterZone[action.targetIndex];
                    if (target) this.engine.attack(attacker, target);
                }
                this.ui.addLog(`${attacker.name}发动了攻击`, "damage");
                break;
            }
            case "selectTribute": {
                const monster = opponent.monsterZone[action.monsterIndex];
                if (monster) this.engine.selectTribute(monster);
                break;
            }
            case "confirmTribute": {
                this.engine.confirmTribute(action.position || "attack", action.faceDown || false);
                break;
            }
            case "cancelTribute": {
                this.engine.cancelTribute();
                break;
            }
            case "discard": {
                // 对手丢弃手牌
                if (action.cardIndices && action.cardIndices.length > 0) {
                    const discarded = this.engine.discardToEndLimit(opponent, action.cardIndices);
                    this.ui.addLog(`${opponent.name}丢弃了${discarded.length}张牌`, "play");
                }
                break;
            }
            case "syncState":
                break;
            default:
                console.warn("Unknown PvP action:", action.type);
                break;
        }
        this._playRemoteActionEffect(action, remoteVisual);
        this._applyPvpSnapshot(action.state);
        this.checkAndRefresh();
        raf(() => this._playRemotePostRefreshEffect(action));
    }

    _logRemoteAction(action) {
        const opponentName = this.state.players[1]?.name || "对手";
        const messages = {
            turnStart: `${opponentName}的回合开始`,
            draw: `${opponentName}抽了${action.count || 1}张卡`,
            summon: action.faceDown
                ? `${opponentName}里侧守备盖放了怪兽`
                : `${opponentName}${action.tributeSummon ? "祭品召唤" : "召唤"}了${action.cardData?.name || "怪兽"}`,
            set: `${opponentName}盖放了一张卡`,
            flipSummon: `${opponentName}进行了翻转召唤`,
            changePosition: `${opponentName}改变了怪兽表示形式`,
            activateSpell: `${opponentName}发动了${action.cardData?.name || "魔法卡"}`,
            activateMonsterEffect: `${opponentName}发动了怪兽效果`,
            attack: `${opponentName}发动攻击`,
            discard: `${opponentName}在结束阶段丢弃手牌`,
        };
        const message = messages[action.type];
        if (!message) return;
        let card = null;
        if (action.type === "summon" && !action.faceDown) card = action.cardData;
        if (action.type === "flipSummon") {
            card = this.state.players[1]?.monsterZone?.[action.monsterIndex] || action.cardData;
        }
        if (action.type === "activateSpell") card = action.cardData;
        if (action.type === "activateMonsterEffect") {
            card = this.state.players[1]?.monsterZone?.[action.monsterIndex] || action.cardData;
        }
        if (action.type === "attack" && action.trapCardData) card = action.trapCardData;
        this.ui.addLog(message, action.type === "attack" ? "damage" : "play", card ? { card } : null);
    }

    _captureRemoteVisual(action) {
        if (typeof document === "undefined") return {};
        if (action.type === "activateSpell" || action.type === "activateMonsterEffect") {
            return {
                localMonsters: this.state.players[0].monsterZone.map(card => {
                    const slot = [...document.querySelectorAll('[data-owner="0"][data-zone="monster"]')]
                        .find(item => item.dataset.instanceId === card.instanceId) || null;
                    return { card, slot, rect: slot?.getBoundingClientRect() || null };
                }),
            };
        }
        if (action.type !== "attack") return {};
        const attacker = this.state.players[1].monsterZone[action.attackerIndex];
        const target = action.targetType === "monster"
            ? this.state.players[0].monsterZone[action.targetIndex]
            : null;
        const findSlot = (owner, card) => {
            if (!card?.instanceId) return null;
            return [...document.querySelectorAll(`[data-owner="${owner}"][data-zone="monster"]`)]
                .find(slot => slot.dataset.instanceId === card.instanceId) || null;
        };
        const attackerSlot = findSlot(1, attacker);
        const targetSlot = findSlot(0, target);
        return {
            attacker,
            target,
            attackerSlot,
            targetSlot,
            attackerRect: attackerSlot?.getBoundingClientRect() || null,
            targetRect: targetSlot?.getBoundingClientRect() || null,
            trapSlot: action.trapCardData?.instanceId
                ? [...document.querySelectorAll('[data-owner="0"][data-zone="spell-trap"]')]
                    .find(slot => slot.dataset.instanceId === action.trapCardData.instanceId)
                    || [...document.querySelectorAll('[data-owner="0"][data-zone="spell-trap"]')]
                        .reverse().find(slot => slot.querySelector(".card-back-icon"))
                    || null
                : null,
        };
    }

    async _playRemoteTrapSequence(action, visual) {
        const trapCard = action.trapCardData;
        if (!trapCard) return;
        if (!visual.trapSlot) {
            showAnnounceBanner("trap", "counter", trapCard.name || "陷阱");
            await new Promise(resolve => setTimeout(resolve, 1200));
            return;
        }
        await playTrapActivationV5(visual.trapSlot, trapCard);
        await animateTrapToGraveyard(visual.trapSlot, trapCard);
        playTrapEffectV2(
            visual.trapSlot,
            "counter",
            trapCard.name || "陷阱",
            trapCard.effects?.[0]?.type || "none",
            trapCard,
            0,
        );
        await new Promise(resolve => setTimeout(resolve, 1300));
    }

    async _playRemoteActionEffect(action, visual) {
        if (typeof document === "undefined") return;
        if (action.type === "attack" && action.attackCanceled) {
            await playNegatedAttackBarrier(visual.attackerSlot, visual.targetSlot, visual.attacker);
            return;
        }
        if (action.type === "activateMonsterEffect" && visual.localMonsters) {
            const nextLocal = action.state?.players?.[1];
            for (const item of visual.localMonsters) {
                if (!item.slot || nextLocal?.monsterZone?.some(card => card.instanceId === item.card.instanceId)) continue;
                if (nextLocal?.hand?.some(card => card.instanceId === item.card.instanceId)) {
                    animateCinematicReturnToHand(item.card, card => this.ui.cardHTML(card), item.slot, "hand");
                } else if (nextLocal?.deck?.some(card => card.instanceId === item.card.instanceId)) {
                    animateCinematicReturnToDeck(item.card, card => this.ui.cardHTML(card), item.slot, "player-deck-pile");
                } else if (nextLocal?.graveyard?.some(card => card.instanceId === item.card.instanceId)) {
                    animateCinematicDestroy(
                        item.slot,
                        item.card,
                        card => this.ui.cardHTML(card),
                        "player-graveyard-pile",
                    );
                }
            }
            return;
        }
        if (action.type !== "attack" || (!visual.attackerSlot && !visual.attackerRect)) return;
        const targetSurvived = !visual.target || action.state?.players?.[1]?.monsterZone
            ?.some(card => card.instanceId === visual.target.instanceId);
        const attackerSurvived = action.state?.players?.[0]?.monsterZone
            ?.some(card => card.instanceId === visual.attacker?.instanceId);
        const liveAttackerSlot = [...document.querySelectorAll('[data-owner="1"][data-zone="monster"]')]
            .find(slot => slot.dataset.instanceId === visual.attacker?.instanceId)
            || visual.attackerRect
            || visual.attackerSlot;
        const liveTargetSlot = visual.target
            ? [...document.querySelectorAll('[data-owner="0"][data-zone="monster"]')]
                .find(slot => slot.dataset.instanceId === visual.target.instanceId)
                || visual.targetRect
                || visual.targetSlot
            : null;
        const playerHud = action.targetType === "player"
            ? document.querySelector("#player-area .player-hud")
            : null;
        const playerLifeBar = playerHud?.querySelector(".hp-bar-wrap") || playerHud;
        playAttackAnimation(
            liveAttackerSlot,
            liveTargetSlot,
            visual.attacker,
            attackerSurvived !== false,
            playerLifeBar,
        );
        if (action.damageToDefender > 0) {
            const localHud = document.querySelector("#player-area .player-hud");
            const localLifeBar = localHud?.querySelector(".hp-bar-wrap") || localHud;
            if (localHud) setTimeout(() => showDamageNumber(localLifeBar, action.damageToDefender, "damage"), 450);
        }
        if (action.damageToAttacker > 0) {
            const remoteHud = document.querySelector("#opponent-area .player-hud");
            if (remoteHud) setTimeout(() => showDamageNumber(remoteHud, action.damageToAttacker, "damage"), 400);
        }
        if (visual.targetSlot && targetSurvived === false) {
            animateCinematicDestroy(
                visual.targetSlot,
                visual.target,
                card => this.ui.cardHTML(card),
                "player-graveyard-pile",
            );
        }
    }

    async _playRemoteSpellSequence(action, visual) {
        if (typeof document === "undefined") return;
        const card = action.cardData;
        const effectType = card.effects?.[0]?.type || "none";
        const opponentHand = document.getElementById("opponent-hand");
        const handRect = opponentHand?.getBoundingClientRect();
        if (handRect) {
            const anchor = document.createElement("div");
            anchor.style.cssText = `position:fixed;left:${handRect.left + handRect.width / 2 - 71}px;top:${handRect.top}px;width:142px;height:202px;pointer-events:none;z-index:-1;`;
            document.body.appendChild(anchor);
            await animatePlayToGraveyard(card, anchor, item => this.ui.cardHTML(item), "opponent-graveyard-pile");
            anchor.remove();
        }
        await playSpellCinematic(
            card.attribute || card.element || "none",
            card.name || "",
            card.rarity,
        );
        playSpellEffectV2(
            null,
            card.attribute || card.element || "none",
            card.name || "",
            effectType,
            card,
            1,
        );
        await new Promise(resolve => setTimeout(resolve, 1300));

        const nextLocal = action.state?.players?.[1];
        for (const item of visual.localMonsters || []) {
            if (nextLocal?.monsterZone?.some(current => current.instanceId === item.card.instanceId)) continue;
            if (nextLocal?.graveyard?.some(current => current.instanceId === item.card.instanceId) && item.rect) {
                await animateCinematicDestroy(
                    { getBoundingClientRect: () => item.rect },
                    item.card,
                    current => this.ui.cardHTML(current),
                    "player-graveyard-pile",
                );
            } else if (nextLocal?.hand?.some(current => current.instanceId === item.card.instanceId)) {
                await animateCinematicReturnToHand(item.card, current => this.ui.cardHTML(current), item.slot, "hand");
            } else if (nextLocal?.deck?.some(current => current.instanceId === item.card.instanceId)) {
                await animateCinematicReturnToDeck(item.card, current => this.ui.cardHTML(current), item.slot, "player-deck-pile");
            }
        }
    }

    async _playRemotePostRefreshEffect(action) {
        if (typeof document === "undefined") return;
        const remoteSlots = [...document.querySelectorAll('[data-owner="1"][data-zone="monster"]')];
        const remoteCardSlot = action.cardData?.instanceId
            ? remoteSlots.find(slot => slot.dataset.instanceId === action.cardData.instanceId)
            : null;
        const opponentHand = document.getElementById("opponent-hand");
        const handRect = opponentHand?.getBoundingClientRect();
        const createHandAnchor = () => {
            if (!handRect) return null;
            const anchor = document.createElement("div");
            anchor.style.cssText = `position:fixed;left:${handRect.left + handRect.width / 2 - 71}px;top:${handRect.top}px;width:142px;height:202px;pointer-events:none;z-index:-1;`;
            document.body.appendChild(anchor);
            return anchor;
        };
        if (action.type === "summon") {
            const slot = remoteCardSlot || [...remoteSlots].reverse().find(item => item.querySelector(".card"));
            if (slot) {
                const anchor = createHandAnchor();
                if (anchor) {
                    await animatePlayToZone(
                        action.cardData,
                        anchor,
                        slot,
                        card => this.ui.cardHTML(card),
                        { endScale: 0.75, isCardBack: !!action.faceDown },
                    );
                    anchor.remove();
                }
                playSummonEffect(
                    slot,
                    action.cardData?.attribute || action.cardData?.element || "none",
                    action.cardData?.name || "",
                    action.cardData?.level || 0,
                    action.cardData?.rarity,
                    {
                        tributeSummon: !!action.tributeSummon,
                        tributeCount: action.tributeCount,
                    },
                );
            }
        } else if (action.type === "set" && action.cardData?.type === "monster") {
            const slot = remoteCardSlot || [...remoteSlots].reverse().find(item => item.querySelector(".card"));
            const anchor = createHandAnchor();
            if (slot && anchor) {
                await animatePlayToZone(
                    action.cardData,
                    anchor,
                    slot,
                    card => this.ui.cardHTML(card),
                    { endScale: 0.75, isCardBack: true },
                );
                anchor.remove();
            }
        } else if (action.type === "flipSummon") {
            const slot = remoteSlots[action.monsterIndex];
            if (slot) playFlipSummonEffect(slot, false, this.state.players[1].monsterZone[action.monsterIndex]?.attribute || "none");
        } else if (action.type === "changePosition") {
            remoteSlots[action.monsterIndex]?.classList.add("position-changing");
        } else if (action.type === "activateSpell" && action.cardData) {
            const effectType = action.cardData.effects?.[0]?.type || "none";
            const fieldSlot = document.querySelector('.field-zone-slot[data-owner="1"][data-zone="field"]');
            const isFieldSpell = this.state.players[1].fieldZone?.instanceId === action.cardData.instanceId
                || this.state.players[1].fieldZone?.id === action.cardData.id;
            const anchor = createHandAnchor();
            if (anchor) {
                if (isFieldSpell && fieldSlot) {
                    fieldSlot.classList.add("field-spell-activate");
                    await animatePlayToZone(
                        action.cardData,
                        anchor,
                        fieldSlot,
                        card => this.ui.cardHTML(card),
                        { endScale: 0.85 },
                    );
                } else {
                    await animatePlayToGraveyard(
                        action.cardData,
                        anchor,
                        card => this.ui.cardHTML(card),
                        "opponent-graveyard-pile",
                    );
                }
                anchor.remove();
            }
            await playSpellCinematic(
                action.cardData.attribute || action.cardData.element || "none",
                action.cardData.name || "",
                action.cardData.rarity,
            );
            playSpellEffectV2(
                null,
                action.cardData.attribute || action.cardData.element || "none",
                action.cardData.name || "",
                effectType,
                action.cardData,
                1,
            );
        } else if (action.type === "activateMonsterEffect") {
            const slot = remoteSlots[action.monsterIndex];
            const card = this.state.players[1].monsterZone[action.monsterIndex];
            if (slot && card) {
                playMonsterEffect(
                    slot,
                    card.attribute || card.element || "none",
                    card.effects?.find(effect => effect.trigger === "manual")?.type || "none",
                    card,
                );
            }
        }
    }

    onPvpTurnStart() {
        if (this.mode !== "pvp") return;
        this._pvpTurnGeneration++;
        this.clearTurnAckTimer();
        this.turnEnding = false;
        this.effectBusy = false;
        this._lockTimers.forEach(timer => clearTimeout(timer));
        this._lockTimers = [];
        this.state.currentPlayerIndex = 0;
        this.state.players[0].resetTurnState();
        this._pvpSend({ type: "turnStart" });
        this.ui.addLog("你的回合！", "turn");
        this._beginTurn();
    }

    aiTurn() {
        this.clearAiTimer();
        if (this.state.gameOver || this.mode !== "ai" || this.state.currentPlayerIndex !== 1) return;
        this.ui.addLog("AI正在思考……", "turn");
        this._runAiMainStep(0);
    }

    _scheduleAi(callback, delay = this.aiActionDelay) {
        this.clearAiTimer();
        this.aiTimer = setTimeout(() => {
            this.aiTimer = null;
            try {
                callback();
            } catch (error) {
                console.error("AI action failed:", error);
                this._releaseEffectLocks();
                this.state.selectedAttacker = null;
                this.ui.addLog("AI行动异常，已自动结束本回合", "damage");
                if (!this.state.gameOver && this.state.currentPlayerIndex === 1) {
                    this._scheduleAi(() => this._finishAiTurn(), 300);
                }
            }
        }, Math.max(0, delay));
    }

    _runAiMainStep(actionCount) {
        if (this.state.gameOver || this.state.currentPlayerIndex !== 1) return;
        this.state.phase = actionCount === 0 ? PHASE.MAIN_1 : this.state.phase;
        // 如果上一个动画还在播放，等它播完再继续
        if (this.effectBusy) {
            this._scheduleAi(() => this._runAiMainStep(actionCount), 300);
            return;
        }
        const action = actionCount < this.aiMaxMainActions ? this._chooseAiPlayAction() : null;
        if (!action) {
            const monsterEffect = this._activateAiMonsterEffect();
            if (monsterEffect) {
                this.ui.addLog(`AI ${monsterEffect.message}`, "play", { card: monsterEffect.card });
                this.checkAndRefresh();
                this._scheduleAi(() => this._runAiMainStep(actionCount + 1), this.aiActionDelay);
                return;
            }
            if (this.state.firstTurn || this.state.currentPlayer.skipBattlePhase) {
                this.state.phase = PHASE.MAIN_2;
                this.refresh();
                this._scheduleAi(() => this._finishAiTurn(), this.aiActionDelay);
            } else {
                this.state.phase = PHASE.BATTLE;
                this.state.selectedAttacker = null;
                this.refresh();
                this._scheduleAi(() => this._runAiBattleStep(), this.aiActionDelay);
            }
            return;
        }
        const result = this._executeAiPlayAction(action);
        if (result?.message) {
            // 陷阱卡盖放时，只显示"盖放了一张陷阱卡"，不暴露具体名称
            const logMsg = (result.success && result.card?.type === "trap")
                ? "AI 盖放了一张陷阱卡"
                : `AI ${result.message}`;
            const publicCard = result.success && result.card?.type !== "trap" && !result.faceDown
                ? result.card
                : null;
            this.ui.addLog(logMsg, result.success ? "play" : "damage",
                publicCard ? { card: publicCard } : null);
        }
        if (result?.card) this.ui.showAiAction?.(result.card, result.actionLabel || "AI ACTION");
        this.checkAndRefresh();
        if (this.state.gameOver) return;
        // 等动画播完再执行下一个动作
        this._scheduleAi(() => this._runAiMainStep(actionCount + 1), this.effectBusy ? 500 : this.aiActionDelay);
    }

    _runAiBattleStep() {
        if (this.state.gameOver || this.state.currentPlayerIndex !== 1) return;
        this.state.phase = PHASE.BATTLE;
        const ai = this.state.currentPlayer;
        const human = this.state.opponentPlayer;
        // 智能排序：先用弱怪试探（骗陷阱），再用强怪收割
        const attackers = ai.monsterZone
            .filter(card => card.canAttack && !card.hasAttackedThisTurn && !card.cannotAttack && card.position === MONSTER_POSITION.ATTACK);
        // 如果对方有盖牌（可能有陷阱），先上弱怪；否则先上强怪
        const hasBackrow = human.spellTrapZone.some(c => c.faceDown);
        const attacker = hasBackrow
            ? attackers.sort((a, b) => (a.currentAttack || 0) - (b.currentAttack || 0))[0]
            : attackers.sort((a, b) => (b.currentAttack || 0) - (a.currentAttack || 0))[0];
        if (!attacker) {
            this.state.phase = PHASE.MAIN_2;
            this.refresh();
            this._scheduleAi(() => this._finishAiTurn(), this.aiActionDelay);
            return;
        }
        this.state.selectedAttacker = attacker;
        this.ui.showAiAction?.(attacker, "AI ATTACK");
        const target = human.monsterZone.length ? this._chooseAiAttackTarget(attacker, human.monsterZone) : "player";

        // 如果AI判断不该攻击（会亏怪），跳过这只怪兽
        if (target === null) {
            attacker.hasAttackedThisTurn = true;
            this.state.selectedAttacker = null;
            this._scheduleAi(() => this._runAiBattleStep(), this.aiActionDelay);
            return;
        }

        // 先找到玩家场上可能触发的陷阱卡DOM位置
        const isBrowser = typeof document !== "undefined";
        const playerSpellTrapSlots = isBrowser ? document.querySelectorAll(`[data-owner="0"][data-zone="spell-trap"]`) : [];
        const possibleTrapSlot = isBrowser ? [...playerSpellTrapSlots].reverse().find(s => s.querySelector(".card-back-icon")) : null;

        let attackTarget = target;
        let result = null;
        let redirectDepth = 0;
        // 处理攻击重定向循环（最多3次）
        while (redirectDepth <= 3) {
            result = this.engine.attack(attacker, attackTarget);
            this.ui.addLog(result.message, "damage", result.trap ? { card: result.trapCard } : null);
            if (result.redirect) {
                redirectDepth++;
                attackTarget = result.redirect;
                continue;
            }
            break;
        }
        if (redirectDepth > 3) {
            this.ui.addLog("攻击重定向次数过多，攻击终止", "damage");
            this.state.selectedAttacker = null;
            this.checkAndRefresh();
            this._scheduleAi(() => this._runAiBattleStep(), this.aiActionDelay);
            return;
        }

        // 陷阱发动特效 —— 简化版：翻牌→效果→飞墓区
        if (result.trap) {
            const trapName = result.message.match(/【(.+?)】/)?.[1] || "陷阱";
            const trapCardData = result.trapCard || { name: trapName, type: "trap", rarity: "R" };
            if (possibleTrapSlot) {
                // 阶段1：翻牌动画（0-600ms）
                this._lockForEffect(5600);
                (async () => {
                    await playTrapActivationV5(possibleTrapSlot, trapCardData);
                    await animateTrapToGraveyard(possibleTrapSlot, trapCardData);
                    // 阶段2：播放效果特效
                    const attr = trapCardData.attribute || "none";
                    const effectType = trapCardData.effects?.[0]?.type || "none";
                    playTrapEffectV2(possibleTrapSlot, "counter", trapName, effectType, trapCardData, Number(possibleTrapSlot.dataset.owner || 0));
                    // 阶段3：效果播完后再飞墓区
                    if (result.attackCanceled) {
                        const attackerSlot = [...document.querySelectorAll(`[data-owner="1"][data-zone="monster"]`)]
                            .find(slot => slot.dataset.instanceId === attacker.instanceId);
                        const targetSlot = attackTarget === "player"
                            ? document.querySelector("#player-area .player-hud")
                            : [...document.querySelectorAll(`[data-owner="0"][data-zone="monster"]`)]
                                .find(slot => slot.dataset.instanceId === attackTarget?.instanceId);
                        await playNegatedAttackBarrier(attackerSlot, targetSlot, attacker);
                    } else {
                        await new Promise(resolve => setTimeout(resolve, 1300));
                    }
                    this.checkAndRefresh();
                })();
            } else {
                this._lockForEffect(2600);
                showAnnounceBanner("trap", "counter", trapName);
                setTimeout(() => this.checkAndRefresh(), 1500);
            }
        } else {
            // 检查onDestroyed和onFlip特效
            const aiDestroyedTargets = [];
            if (attackTarget !== "player" && attackTarget?.instanceId) {
                const targetDestroyed = !this.state.players[0].monsterZone.some(c => c.instanceId === attackTarget.instanceId);
                if (targetDestroyed && attackTarget.effects?.some(e => e.trigger === "onDestroyed")) {
                    aiDestroyedTargets.push({ card: attackTarget, owner: 0 });
                }
            }
            const aiAttackerDestroyed = !this.state.players[1].monsterZone.some(c => c.instanceId === attacker.instanceId);
            if (aiAttackerDestroyed && attacker.effects?.some(e => e.trigger === "onDestroyed")) {
                aiDestroyedTargets.push({ card: attacker, owner: 1 });
            }

            this.checkAndRefresh();
            raf(() => {

                // checkAndRefresh已重新渲染DOM，需要重新查询attackerSlot
                const aiSlots = document.querySelectorAll(`[data-owner="1"][data-zone="monster"]`);
                const attackerSlot = [...aiSlots].find(s => s.dataset.instanceId === attacker.instanceId);

                // 检查攻击方是否存活
                const attackerSurvived = this.state.players[1].monsterZone.some(c => c.instanceId === attacker.instanceId);

                if (attackTarget === "player") {
                    const playerHud = document.querySelector("#player-area .player-hud");
                    playAttackAnimation(attackerSlot, null, attacker, attackerSurvived, playerHud);
                    if (playerHud) {
                        setTimeout(() => showDamageNumber(playerHud, attacker.currentAttack || 0, "damage"), 400);
                    }
                } else if (attackTarget?.instanceId) {
                    const targetSlots = document.querySelectorAll(`[data-owner="0"][data-zone="monster"]`);
                    const targetSlot = [...targetSlots].find(s => s.dataset.instanceId === attackTarget.instanceId);
                    playAttackAnimation(attackerSlot, targetSlot, attacker, attackerSurvived);
                }

                // 播放onDestroyed特效
                for (const { card, owner } of aiDestroyedTargets) {
                    const effectType = card.effects?.find(e => e.trigger === "onDestroyed")?.type || "none";
                    const attr = card.attribute || card.element || "none";
                    const tSlots = document.querySelectorAll(`[data-owner="${owner}"][data-zone="monster"]`);
                    setTimeout(() => {
                        if (tSlots.length > 0) {
                            playMonsterEffect(tSlots[tSlots.length - 1], attr, effectType);
                        }
                    }, 500);
                }
            });
        }

        this.state.selectedAttacker = null;
        this.checkAndRefresh();
        if (this.state.gameOver) return;
        // 等攻击动画播完再执行下一个攻击
        this._scheduleAi(() => this._runAiBattleStep(), this.effectBusy ? 500 : this.aiActionDelay);
    }

    _finishAiTurn() {
        if (this.state.gameOver || this.state.currentPlayerIndex !== 1) return;
        const ai = this.state.currentPlayer;
        if (ai.hand.length > GAME_CONFIG.END_HAND_LIMIT) {
            const discarded = this.engine.discardToEndLimit(ai);
            this.ui.addLog(`AI在结束阶段丢弃了${discarded.length}张牌`, "play");
        }
        this.ui.addLog("AI结束回合", "turn");
        this._finalizeEndTurn();
    }

    _chooseAiPlayAction() {
        const ai = this.state.currentPlayer;
        if (ai !== this.state.players[1]) return null;
        const human = this.state.opponentPlayer;
        const skill = Number(this.aiProfile?.skill || 2);
        const cardValue = card => {
            const effects = card.effects || [];
            const priority = Number(card.aiHints?.priority || 0) * 120;
            const tactical = effects.reduce((sum, effect) => {
                if (["destroyTarget", "destroyWeakest", "damageAllEnemyMonsters", "temporaryBanish", "freezeAll"].includes(effect.type)) {
                    return sum + (human.monsterZone.length ? 650 : -500);
                }
                if (["destroySpellTrap", "destroyAllEnemySpellTraps"].includes(effect.type)) return sum + (human.spellTrapZone.length ? 700 : -550);
                if (["drawCards", "groupDraw", "recoverMonster", "reviveRecentGraveyard", "tokenSummon"].includes(effect.type)) return sum + 430;
                if (["buffSelfAttack", "buffAllAlliesAttack", "groupBuff"].includes(effect.type)) return sum + (ai.monsterZone.length ? 360 : -150);
                if (["healPlayer", "healDrawNoSpecial"].includes(effect.type)) return sum + (ai.lp < 5000 ? 360 : 60);
                return sum + 120;
            }, 0);
            return priority + tactical + (card.attack || 0) + (card.effects?.length || 0) * 160;
        };
        const playableSpells = ai.hand
            .filter(card => card?.type === "spell" && this.engine.canPlayEffect(ai, card).canPlay)
            .sort((a, b) => cardValue(b) - cardValue(a));
        if (skill >= 3) {
            const urgentSpell = playableSpells.find(candidate => candidate.effects?.some(effect =>
                (["destroyTarget", "destroyWeakest", "damageAllEnemyMonsters", "temporaryBanish", "freezeAll"].includes(effect.type)
                    && human.monsterZone.length >= 2)
                || (["destroySpellTrap", "destroyAllEnemySpellTraps"].includes(effect.type)
                    && human.spellTrapZone.length >= 2)
            ));
            if (urgentSpell) return { kind: "spell", instanceId: urgentSpell.instanceId };
        }
        if (!ai.normalSummonUsed && ai.monsterZone.length < GAME_CONFIG.MAX_MONSTER_ZONE) {
            const candidates = ai.hand
                .map(card => ({ card, needed: card?.type === "monster" ? this.engine.getTributeNeeded(card.level) : 99 }))
                .filter(item => item.card?.type === "monster" && ai.monsterZone.length >= item.needed)
                .sort((a, b) => {
                    const aScore = cardValue(a.card) - a.needed * (skill >= 3 ? 650 : 500);
                    const bScore = cardValue(b.card) - b.needed * (skill >= 3 ? 650 : 500);
                    return bScore - aScore;
                });
            if (candidates.length) return { kind: "monster", instanceId: candidates[0].card.instanceId };
        }
        if (playableSpells.length) return { kind: "spell", instanceId: playableSpells[0].instanceId };
        if (ai.spellTrapZone.length < GAME_CONFIG.MAX_SPELL_TRAP_ZONE) {
            const trap = ai.hand.filter(card => card?.type === "trap").sort((a, b) => cardValue(b) - cardValue(a))[0];
            if (trap) return { kind: "trap", instanceId: trap.instanceId };
        }
        return null;
    }

    _executeAiPlayAction(action) {
        const ai = this.state.currentPlayer;
        const index = ai.hand.findIndex(card => card.instanceId === action.instanceId);
        if (index < 0) return { success: false, message: "要使用的卡牌已不在手牌" };
        const card = ai.hand[index];
        if (action.kind === "monster") {
            const result = this.engine.normalSummon(ai, index, MONSTER_POSITION.ATTACK, false);
            if (result.needsTribute) {
                const pending = this.state.pendingTribute;
                [...ai.monsterZone]
                    .sort((a, b) => (a.currentAttack || 0) - (b.currentAttack || 0))
                    .slice(0, pending?.needed || 0)
                    .forEach(tribute => this.engine.selectTribute(tribute));
                const confirmed = this.engine.confirmTribute(MONSTER_POSITION.ATTACK, false);
                this._lockForEffect(3000);
                this.checkAndRefresh();
                raf(() => {
                    const oppHandEl = document.getElementById("opponent-hand");
                    const oppHandRect = oppHandEl ? oppHandEl.getBoundingClientRect() : null;
                    const slots = document.querySelectorAll(`[data-owner="1"][data-zone="monster"]`);
                    const lastSlot = [...slots].reverse().find(s => s.querySelector(".card"));
                    if (lastSlot && oppHandRect) {
                        const tempEl = document.createElement("div");
                        tempEl.style.cssText = `position:fixed;left:${oppHandRect.left + oppHandRect.width / 2 - 71}px;top:${oppHandRect.top}px;width:142px;height:202px;pointer-events:none;z-index:-1;`;
                        document.body.appendChild(tempEl);
                        animatePlayToZone(card, tempEl, lastSlot, c => this.ui.cardHTML(c), { endScale: 0.75 }).then(() => tempEl.remove());
                    }
                    setTimeout(() => {
                        if (lastSlot) playSummonEffect(lastSlot, card.attribute || "none", card.name, card.level, card.rarity, {
                            tributeSummon: true,
                            tributeCount: pending?.needed || (Number(card.level) >= 7 ? 2 : 1),
                        });
                    }, 600);
                });
                return { ...confirmed, card: confirmed.card || card, actionLabel: "AI SUMMON" };
            }
            this._lockForEffect(3000);
            this.checkAndRefresh();
            raf(() => {
                const oppHandEl = document.getElementById("opponent-hand");
                const oppHandRect = oppHandEl ? oppHandEl.getBoundingClientRect() : null;
                const slots = document.querySelectorAll(`[data-owner="1"][data-zone="monster"]`);
                const lastSlot = [...slots].reverse().find(s => s.querySelector(".card"));
                if (lastSlot && oppHandRect) {
                    const tempEl = document.createElement("div");
                    tempEl.style.cssText = `position:fixed;left:${oppHandRect.left + oppHandRect.width / 2 - 71}px;top:${oppHandRect.top}px;width:142px;height:202px;pointer-events:none;z-index:-1;`;
                    document.body.appendChild(tempEl);
                    animatePlayToZone(card, tempEl, lastSlot, c => this.ui.cardHTML(c), { endScale: 0.75 }).then(() => tempEl.remove());
                }
                setTimeout(() => {
                    if (lastSlot) playSummonEffect(lastSlot, card.attribute || "none", card.name, card.level, card.rarity);
                }, 600);
            });
            return { ...result, card: result.card || card, actionLabel: "AI SUMMON" };
        }
        if (action.kind === "spell") {
            const target = this._chooseAiEffectTarget(ai, card);
            const oppHandEl = document.getElementById("opponent-hand");
            const oppHandRect = oppHandEl ? oppHandEl.getBoundingClientRect() : null;
            const handIdsBeforeSpell = new Set(ai.hand.map(item => item.instanceId));
            const result = this.engine.activateSpell(ai, index, target);
            const effectType = card.effects?.[0]?.type || "none";
            this.checkAndRefresh();

            if (result.isFieldSpell) {
                this._lockForEffect(3800);
                raf(() => {
                    const fieldSlot = document.querySelector(`.field-zone-slot[data-owner="1"][data-zone="field"]`);
                    if (fieldSlot) fieldSlot.classList.add("field-spell-activate");
                    if (oppHandRect) {
                        const tempEl = document.createElement("div");
                        tempEl.style.cssText = `position:fixed;left:${oppHandRect.left + oppHandRect.width / 2 - 71}px;top:${oppHandRect.top}px;width:142px;height:202px;pointer-events:none;z-index:-1;`;
                        document.body.appendChild(tempEl);
                        animatePlayToZone(card, tempEl, fieldSlot, c => this.ui.cardHTML(c), { endScale: 0.85 }).then(() => tempEl.remove());
                    }
                    setTimeout(async () => {
                        await playSpellCinematic(card.attribute || "none", card.name, card.rarity);
                        playSpellEffectV2(null, card.attribute || "none", card.name, effectType, card, this.state.currentPlayerIndex);
                    }, 600);
                });
            } else {
                // 普通魔法：先飞墓地，完成后再抽卡
                this._lockForEffect(6000);
                raf(async () => {
                    if (oppHandRect) {
                        const tempEl = document.createElement("div");
                        tempEl.style.cssText = `position:fixed;left:${oppHandRect.left + oppHandRect.width / 2 - 71}px;top:${oppHandRect.top}px;width:142px;height:202px;pointer-events:none;z-index:-1;`;
                        document.body.appendChild(tempEl);
                        await animatePlayToGraveyard(card, tempEl, c => this.ui.cardHTML(c), "opponent-graveyard-pile");
                        tempEl.remove();
                    }
                    await playSpellCinematic(card.attribute || "none", card.name, card.rarity);
                    playSpellEffectV2(null, card.attribute || "none", card.name, effectType, card, this.state.currentPlayerIndex);
                    if (effectType === "drawCards" || effectType === "gameThroneDraw" || effectType === "discardAndDraw") {
                        await new Promise(resolve => setTimeout(resolve, 800));
                        const drawnCards = ai.hand.filter(item => !handIdsBeforeSpell.has(item.instanceId)).slice(0, 3);
                        const drawnIds = new Set(drawnCards.map(item => item.instanceId));
                        ai.hand = ai.hand.filter(item => !drawnIds.has(item.instanceId));
                        for (const drawn of drawnCards) {
                            if (drawn && drawn.type) {
                                await animateDrawCard(drawn, c => createCardBackHtml(c), true);
                                ai.hand.push(drawn);
                                await new Promise(r => setTimeout(r, 200));
                            }
                        }
                    }
                });
            }
            return { ...result, card, actionLabel: "AI SPELL" };
        }
        if (action.kind === "trap") {
            // 获取对手手牌区域位置用于出牌动画
            const oppHandEl = document.getElementById("opponent-hand");
            const oppHandRect = oppHandEl ? oppHandEl.getBoundingClientRect() : null;
            const result = this.engine.setCard(ai, index);
            this.checkAndRefresh();
            // 陷阱卡运镜：从对手手牌飞到陷阱区（显示卡背）
            if (oppHandRect && result.success) {
                this._lockForEffect(800);
                raf(() => {
                    const tempEl = document.createElement("div");
                    tempEl.style.cssText = `position:fixed;left:${oppHandRect.left + oppHandRect.width / 2 - 71}px;top:${oppHandRect.top}px;width:142px;height:202px;pointer-events:none;z-index:-1;`;
                    document.body.appendChild(tempEl);
                    const stSlots = document.querySelectorAll(`[data-owner="1"][data-zone="spell-trap"]`);
                    const targetSlot = [...stSlots].reverse().find(s => s.querySelector(".card-back-icon")) || [...stSlots].pop();
                    animatePlayToZone(card, tempEl, targetSlot, c => this.ui.cardHTML(c), { isCardBack: true, endScale: 0.7 }).then(() => tempEl.remove());
                });
            }
            return { ...result, card, actionLabel: "AI SET" };
        }
        return { success: false, message: "未知AI行动" };
    }

    _chooseAiEffectTarget(ai, card) {
        const effect = card.effect || card.effects?.[0];
        const targets = this.engine.getValidTargets(ai, effect);
        if (!targets.length) return null;
        const type = this.engine.getEffectTargetType(effect);
        const targetValue = target => (target.currentAttack || target.attack || 0)
            + (target.currentDefense || target.defense || 0) * 0.25
            + (target.effects?.length || 0) * 350;
        if (type === "graveyard") return [...targets].sort((a, b) => targetValue(b) - targetValue(a))[0];
        if (type === "enemy_monster_or_player") {
            const monsters = targets.filter(target => !target.isPlayer);
            if (monsters.length) return [...monsters].sort((a, b) => targetValue(b) - targetValue(a))[0];
            return targets.find(target => target.isPlayer) || targets[0];
        }
        return [...targets].sort((a, b) => targetValue(b) - targetValue(a))[0];
    }

    _activateAiMonsterEffect() {
        const ai = this.state.currentPlayer;
        const card = ai.monsterZone
            .filter(monster => monster.faceUp
                && !monster.oncePerTurnUsed
                && monster.effects?.some(effect => effect.trigger === "manual"))
            .sort((a, b) => ((b.effects?.length || 0) * 300 + (b.currentAttack || 0))
                - ((a.effects?.length || 0) * 300 + (a.currentAttack || 0)))[0];
        if (!card) return null;
        const message = this.engine.triggerAllEffects(ai, card, "manual");
        if (message) card.oncePerTurnUsed = true;
        return message ? { card, message: `${card.name}发动效果：${message}` } : null;
    }

    _chooseAiAttackTarget(attacker, targets) {
        const atk = attacker.currentAttack || 0;
        // 分类：能击杀的 vs 不能击杀的
        const killable = [];
        const suicide = [];
        for (const t of targets) {
            const tPower = t.position === MONSTER_POSITION.DEFENSE ? (t.currentDefense || 0) : (t.currentAttack || 0);
            if (atk >= tPower) {
                killable.push({ card: t, power: tPower, loss: 0 });
            } else {
                // 攻击会导致自己被破坏（对方表侧攻击表示时反弹伤害也算损失）
                const selfLoss = t.position === MONSTER_POSITION.ATTACK ? atk : 0;
                suicide.push({ card: t, power: tPower, loss: selfLoss + (atk < tPower ? 1 : 0) });
            }
        }
        // 优先选能击杀的，按守备力从低到高（优先清弱怪）
        if (killable.length > 0) {
            const skilled = Number(this.aiProfile?.skill || 2) >= 3;
            killable.sort((a, b) => skilled
                ? ((b.card.effects?.length || 0) * 500 + b.power) - ((a.card.effects?.length || 0) * 500 + a.power)
                : a.power - b.power);
            return killable[0].card;
        }
        // 没有能击杀的 → 如果对方场面空了就直接攻击玩家
        // 否则跳过攻击（不送怪）
        return null;
    }

    // 同步AI供自动测试使用。
    _aiPlayCards() {
        let actions = 0;
        while (actions < this.aiMaxMainActions) {
            const action = this._chooseAiPlayAction();
            if (!action) break;
            const result = this._executeAiPlayAction(action);
            if (!result?.success) break;
            this.ui.addLog(`AI ${result.message}`, "play");
            actions++;
        }
        this.refresh();
    }

    _aiAttack() {
        if (this.state.firstTurn) return;
        const ai = this.state.currentPlayer;
        const human = this.state.opponentPlayer;
        this.state.phase = PHASE.BATTLE;
        for (const attacker of ai.monsterZone.filter(card => card.canAttack && !card.hasAttackedThisTurn && card.position === MONSTER_POSITION.ATTACK)) {
            if (this.state.gameOver) return;
            const target = human.monsterZone.length ? this._chooseAiAttackTarget(attacker, human.monsterZone) : "player";
            const result = this.engine.attack(attacker, target);
            this.ui.addLog(result.message, "damage");
            if (this.engine.checkGameOver()) return;
        }
        this.refresh();
    }

    gameOver() {
        this.clearAiTimer();
        const names = [this.state.players[0].name, this.state.players[1].name];
        if (this.state.isDraw) {
            this.ui.addLog("=== 平局 ===", "gameover");
            this.ui.showGameOver(null, names, true);
        } else {
            const winner = this.state.winner;
            const loser = this.state.players[winner === 0 ? 1 : 0];
            const reason = this.state.winReason
                ? this.state.winReason
                : (loser.deckOut ? `${loser.name}无牌可抽` : `${loser.name}的LP归零`);
            this.ui.addLog(`=== ${names[winner]}获胜：${reason} ===`, "gameover");
            this.ui.showGameOver(winner, names, false, reason);
        }
        this.onGameOver?.({ winner: this.state.winner, isDraw: this.state.isDraw });
    }

    backToMenu() {
        this.clearAiTimer();
        this.ui.hideGameOver();
        this.ui.showMenu();
    }

    checkAndRefresh() {
        if (this.engine.checkGameOver()) {
            this.gameOver();
            return;
        }
        this.engine.checkStateIntegrity();
        this.refresh();
    }

    refresh() {
        const handlers = {
            onPlayCard: index => this.activateSpell(index),
            onSetCard: index => this.setCard(index),
            onActivateSetSpell: card => this.activateSetSpell(card),
            canActivateSetSpell: card => this.canActivateSetSpell(card),
            onSummon: (index, position, faceDown) => this.summonMonster(index, position, faceDown),
            onFlipSummon: card => this.flipSummon(card),
            onChangePosition: card => this.changePosition(card),
            onActivateMonsterEffect: card => this.activateMonsterEffect(card),
            onNextPhase: () => this.nextPhase(),
            onEndTurn: () => this.endTurn(),
            onSelectAttacker: card => this.selectAttacker(card),
            onAttack: target => this.attackTarget(target),
            onAttackPlayer: () => this.attackPlayer(),
            onConfirmTarget: target => this.confirmTarget(target),
            onCancelTarget: () => this.cancelTargetSelect(),
            onSelectTribute: card => this.selectTribute(card),
            onConfirmTribute: () => this.confirmTribute(),
            onCancelTribute: () => this.cancelTribute(),
        };
        this.ui.render(this.state, handlers);
    }
}
