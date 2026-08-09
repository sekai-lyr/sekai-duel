/**
 * engine.js
 * 规则引擎 —— 次元决斗：元素召唤
 */

import { ELEMENT_STRONG } from "./cards.js";
import { GAME_CONFIG, PHASE, MONSTER_POSITION, DURATION } from "./constants.js";
import { createCardInstance } from "./model.js";

// ======================== Nightcord 共鸣系统 ========================
const NIGHTCORD_MEMBERS = ["ena", "kanade", "mafuyu", "mizuki"];

export function getUniqueNightcordMembers(player) {
    const members = new Set();
    for (const card of player.monsterZone) {
        if (card.series === "nightcord" && NIGHTCORD_MEMBERS.includes(card.member)) {
            members.add(card.member);
        }
    }
    return members;
}

export function hasResonance(player, requiredMembers = 2) {
    return getUniqueNightcordMembers(player).size >= requiredMembers;
}

// ======================== 工具函数 ========================
function safe(v) { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0; }

function canSpecialSummon(player) {
    return !player.cannotSpecialSummonThisTurn;
}

function destroyMonster(owner, monster, engine) {
    const idx = owner.monsterZone.indexOf(monster);
    if (idx === -1) return;
    owner.monsterZone.splice(idx, 1);
    const revivesToHand = monster.effects?.some(e => e.type === "reviveToHand" || e.type === "REVIVE_TO_HAND");
    // 触发onDestroyed效果（如搜索卡组等）
    if (engine && monster.effects?.some(e => e.trigger === "onDestroyed")) {
        engine.triggerAllEffects(owner, monster, "onDestroyed");
    }
    if (revivesToHand) {
        resetCardState(monster);
        owner.hand.push(monster);
    } else {
        monster.canAttack = false;
        monster.hasAttackedThisTurn = true;
        owner.graveyard.push(monster);
    }
}

function resetCardState(card) {
    card.currentAttack = card.attack || 0;
    card.currentDefense = card.defense || card.health || 0;
    card.currentHealth = card.defense || card.health || 0;
    card.position = MONSTER_POSITION.ATTACK;
    card.faceUp = true;
    card.canAttack = false;
    card.hasAttackedThisTurn = false;
    card.positionChangedThisTurn = false;
    card.tempEffects = [];
    card.permanentBuffs = [];
    card.cannotAttack = false;
    card.cannotBeTargeted = false;
    card.cannotBeDestroyedByBattle = false;
    card.cannotBeDestroyedByEffect = false;
    card.attackLocked = false;
}

// ======================== 统一事件分发 ========================
class EventBus {
    constructor() { this.listeners = {}; }
    on(event, fn) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(fn);
    }
    off(event, fn) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(f => f !== fn);
    }
    emit(event, data) {
        if (!this.listeners[event]) return;
        for (const fn of this.listeners[event]) fn(data);
    }
    clear() { this.listeners = {}; }
}

// ======================== 通用目标选择器 ========================
export function resolveTargets(engine, player, targetSpec) {
    if (!targetSpec) return [];
    const opp = player === engine.state.currentPlayer ? engine.state.opponentPlayer : engine.state.currentPlayer;
    const owner = targetSpec.owner === "self" ? player : (targetSpec.owner === "opponent" ? opp : null);
    const zone = targetSpec.zone || "monster";
    let candidates = [];

    if (zone === "monster") {
        candidates = owner ? [...owner.monsterZone] : [...player.monsterZone, ...opp.monsterZone];
    } else if (zone === "hand") {
        candidates = owner ? [...owner.hand] : [...player.hand];
    } else if (zone === "graveyard") {
        candidates = owner ? [...owner.graveyard] : [...player.graveyard];
    } else if (zone === "spellTrap") {
        candidates = owner ? [...owner.spellTrapZone] : [];
    } else if (zone === "field") {
        candidates = owner ? [...owner.monsterZone, ...owner.spellTrapZone] : [];
    }

    // 应用过滤器
    if (targetSpec.filters) {
        const f = targetSpec.filters;
        candidates = candidates.filter(c => {
            if (f.attribute && !f.attribute.includes(c.attribute)) return false;
            if (f.race && !f.race.includes(c.race)) return false;
            if (f.minLevel && (c.level || 0) < f.minLevel) return false;
            if (f.maxLevel && (c.level || 0) > f.maxLevel) return false;
            if (f.minAttack && (c.currentAttack || 0) < f.minAttack) return false;
            if (f.maxAttack && (c.currentAttack || 0) > f.maxAttack) return false;
            if (f.type && c.type !== f.type) return false;
            if (f.series && c.series !== f.series) return false;
            return true;
        });
    }

    // 选择方式
    const selector = targetSpec.selector || "all";
    const count = targetSpec.count || 1;

    if (selector === "all") return candidates;
    if (selector === "random") { const shuffled = [...candidates].sort(() => engine._random() - 0.5); return shuffled.slice(0, count); }
    if (selector === "highestAttack") { candidates.sort((a, b) => (b.currentAttack || 0) - (a.currentAttack || 0)); return candidates.slice(0, count); }
    if (selector === "lowestAttack") { candidates.sort((a, b) => (a.currentAttack || 0) - (b.currentAttack || 0)); return candidates.slice(0, count); }
    return candidates.slice(0, count);
}

// ======================== 效果处理器映射 ========================
const effectHandlers = {
    signatureTechnique(ctx) {
        const protocol = ctx.effect?.protocol || {};
        const seed = Number(protocol.seed || 0) >>> 0;
        const allyCount = ctx.player.monsterZone.length;
        const graveCount = ctx.player.graveyard.length;
        const handCount = ctx.player.hand.length;
        const turn = Math.max(1, Number(ctx.gameState.turn || 1));
        const scales = [allyCount, graveCount, handCount, turn, Math.abs(ctx.player.lp - ctx.opponent.lp) / 500];
        const scale = Math.max(1, Math.floor(scales[protocol.scale % scales.length] || 1));
        const amount = Math.min(1800, safe((protocol.base || 180) + scale * (protocol.step || 90)));
        const actions = [
            () => { ctx.card.currentAttack += amount; return `专属蓄势：攻击力上升${amount}`; },
            () => { ctx.card.currentDefense += amount; return `专属架势：守备力上升${amount}`; },
            () => { ctx.opponent.takeDamage(Math.floor(amount * .7)); return `共鸣冲击：造成${Math.floor(amount * .7)}点伤害`; },
            () => { ctx.player.heal(amount); return `记忆回响：恢复${amount}LP`; },
            () => effectHandlers.debuffEnemyAttack({ ...ctx, value: amount }),
            () => effectHandlers.lockAttack({ ...ctx, value: 1 }),
            () => effectHandlers.banishEnemyGraveyard({ ...ctx, value: 1 + seed % 2 }),
            () => effectHandlers.tokenSummon({ ...ctx, value: Math.min(1400, 400 + amount) }),
            () => effectHandlers.discardAndDraw({ ...ctx, value: 1 }),
            () => effectHandlers.swapAttackDefense(ctx),
            () => effectHandlers.returnToHand(ctx),
            () => effectHandlers.protectAllies({ ...ctx, value: 1 }),
        ];
        const first = protocol.primary % actions.length;
        let second = protocol.secondary % actions.length;
        if (second === first) second = (second + 1) % actions.length;
        const messages = [actions[first](), actions[second]()].filter(Boolean);
        ctx.card.signatureProtocol = protocol.id;
        return messages.join("；");
    },
    // ---- 旧效果兼容 ----
    damageAllEnemyMonsters(ctx) {
        const opp = ctx.opponent;
        const targets = [...opp.monsterZone];
        let destroyed = 0;
        for (const m of targets) {
            m.currentDefense = safe(m.currentDefense - ctx.value);
            if (m.currentDefense <= 0) { destroyMonster(opp, m, ctx.engine); destroyed++; }
        }
        return `对对方全部怪兽造成${ctx.value}点伤害${destroyed ? `，${destroyed}只被破坏` : ""}`;
    },
    buffSelfAttack(ctx) { ctx.card.currentAttack = safe(ctx.card.currentAttack + ctx.value); return `攻击力上升${ctx.value}`; },
    buffSelfDefense(ctx) { ctx.card.currentDefense = safe(ctx.card.currentDefense + ctx.value); return `守备力上升${ctx.value}`; },
    healPlayer(ctx) { ctx.player.heal(ctx.value); return `恢复${ctx.value}LP`; },
    // 游戏王座：抽2张，1魔1怪额外抽1张，当回合不能战斗
    gameThroneDraw(ctx) {
        const count = ctx.value || 2;
        const drawn = [];
        for (let i = 0; i < count; i++) {
            const r = ctx.engine.drawCard(ctx.player);
            if (r.card) drawn.push(r.card);
        }
        // 检查是否1张魔法+1张怪兽
        const hasSpell = drawn.some(c => c.type === "spell");
        const hasMonster = drawn.some(c => c.type === "monster");
        let extraMsg = "";
        if (hasSpell && hasMonster) {
            const r = ctx.engine.drawCard(ctx.player);
            if (r.card) extraMsg = `，触发额外抽卡（1魔1怪匹配）`;
        }
        // 当回合跳过战斗阶段
        ctx.player.skipBattlePhase = true;
        return `抽了${drawn.length}张卡${extraMsg}；当回合跳过战斗阶段`;
    },

    // 月光传讯（旧版兼容）
    drawCards(ctx) { let n = 0; for (let i = 0; i < ctx.value; i++) { const r = ctx.engine.drawCard(ctx.player); if (r.card) n++; } return `抽了${n}张卡`; },
    debuffEnemyAttack(ctx) {
        const opp = ctx.opponent;
        const target = ctx.target || (opp.monsterZone.length > 0
            ? opp.monsterZone.reduce((a, b) => a.currentAttack < b.currentAttack ? a : b)
            : null);
        if (target) {
            target.currentAttack = Math.max(0, target.currentAttack - ctx.value);
            return `${target.name}攻击力下降${ctx.value}`;
        }
        return "没有可弱化的目标";
    },
    debuffEnemyDefense(ctx) {
        const target = ctx.target || ctx.opponent.monsterZone[0];
        if (!target) return "没有可弱化的目标";
        target.currentDefense = Math.max(0, target.currentDefense - ctx.value);
        if (target.currentDefense <= 0) {
            destroyMonster(ctx.opponent, target, ctx.engine);
            return `${target.name}守备力下降${ctx.value}并被破坏`;
        }
        return `${target.name}守备力下降${ctx.value}`;
    },
    debuffAllEnemyAttack(ctx) { ctx.opponent.monsterZone.forEach(m => m.currentAttack = Math.max(0, m.currentAttack - ctx.value)); return `对方全部怪兽攻击力下降${ctx.value}`; },
    buffAllAlliesAttack(ctx) { ctx.player.monsterZone.forEach(m => m.currentAttack += ctx.value); return `己方全部怪兽攻击力上升${ctx.value}`; },
    directDamage(ctx) { ctx.opponent.takeDamage(ctx.value); return `对${ctx.opponent.name}造成${ctx.value}点伤害`; },
    destroyAllEnemyMonsters(ctx) { const t = [...ctx.opponent.monsterZone]; t.forEach(m => destroyMonster(ctx.opponent, m, ctx.engine)); return `破坏了对方${t.length}只怪兽`; },
    destroyTarget(ctx) {
        const target = ctx.target || ctx.opponent.monsterZone[0];
        if (target && !target.isPlayer && target.currentDefense !== undefined) { destroyMonster(ctx.opponent, target, ctx.engine); return `破坏了${target.name}`; }
        return "没有可破坏的目标";
    },
    damageBothPlayers(ctx) { ctx.player.takeDamage(ctx.value); ctx.opponent.takeDamage(ctx.value); return `双方各受${ctx.value}点伤害`; },
    damageAndHeal(ctx) {
        const target = ctx.target || ctx.opponent.monsterZone[0];
        if (target && target.currentDefense !== undefined) {
            const before = target.currentDefense;
            target.currentDefense = safe(target.currentDefense - ctx.value);
            const real = before - target.currentDefense;
            ctx.player.heal(real);
            let msg = `对${target.name}造成${real}伤害，恢复${real}LP`;
            if (target.currentDefense <= 0) { destroyMonster(ctx.opponent, target, ctx.engine); msg += "，怪兽被破坏"; }
            return msg;
        }
        ctx.opponent.takeDamage(ctx.value); ctx.player.heal(ctx.value);
        return `造成${ctx.value}伤害并恢复${ctx.value}LP`;
    },
    reviveToHand(ctx) {
        const chars = ctx.player.graveyard.filter(c => c.type === "monster");
        const target = ctx.target || chars[chars.length - 1];
        if (target && target.type === "monster") {
            const idx = ctx.player.graveyard.indexOf(target);
            if (idx >= 0) { ctx.player.graveyard.splice(idx, 1); resetCardState(target); ctx.player.hand.push(target); return `复活了${target.name}到手牌`; }
        }
        return "墓地没有可复活的怪兽";
    },
    recoverMonster(ctx) {
        return effectHandlers.reviveToHand(ctx);
    },
    destroySpellTrap(ctx) {
        const limit = Math.max(1, Number(ctx.value) || 1);
        const targets = ctx.target ? [ctx.target] : [...ctx.opponent.spellTrapZone].slice(0, limit);
        const destroyed = [];
        for (const target of targets) {
            const index = ctx.opponent.spellTrapZone.indexOf(target);
            if (!target || index < 0) continue;
            ctx.opponent.spellTrapZone.splice(index, 1);
            target.faceDown = false;
            target.canActivate = false;
            ctx.opponent.graveyard.push(target);
            destroyed.push(target.name);
        }
        return destroyed.length ? `破坏了${destroyed.join("、")}` : "对方场上没有可破坏的魔法或陷阱卡";
    },
    destroyAllEnemySpellTraps(ctx) {
        const targets = [...ctx.opponent.spellTrapZone];
        for (const target of targets) {
            const index = ctx.opponent.spellTrapZone.indexOf(target);
            if (index < 0) continue;
            ctx.opponent.spellTrapZone.splice(index, 1);
            target.faceDown = false;
            target.canActivate = false;
            ctx.opponent.graveyard.push(target);
        }
        return targets.length > 0
            ? `破坏了对方全部${targets.length}张魔法或陷阱卡`
            : "对方场上没有魔法或陷阱卡";
    },
    banishEnemyGraveyard(ctx) {
        const count = Math.max(1, Number(ctx.value) || 1);
        const targets = ctx.opponent.graveyard.splice(
            Math.max(0, ctx.opponent.graveyard.length - count),
            count,
        );
        for (const target of targets) {
            resetCardState(target);
            ctx.opponent.banished.push(target);
        }
        return targets.length > 0
            ? `从对方墓地除外了${targets.length}张卡`
            : "对方墓地没有可除外的卡";
    },
    reflectDamage(ctx) { return "镜面反射准备就绪"; },
    counterAndDamage(ctx) { return "火焰护盾准备就绪"; },
    reduceDamage(ctx) { return "减伤屏障准备就绪"; },
    destroyAttacker(ctx) { return "冰封牢笼准备就绪"; },
    lifesteal(ctx) { return "吸血准备就绪"; },

    // ---- 蓝絮猫女仆 凯伊效果 ----
    // 效果①：特殊召唤/召唤成功后，对方必须先攻击其他怪兽
    priorityTarget(ctx) {
        ctx.card.priorityTarget = true;
        return "对方必须优先攻击其他怪兽";
    },
    // 效果②：1回合1次，无后场盖卡时攻击+value，有后场盖卡时守备+value
    conditionalBuff(ctx) {
        const hasBackrow = ctx.player.spellTrapZone.some(c => c.faceDown);
        if (hasBackrow) {
            ctx.card.currentDefense = safe(ctx.card.currentDefense + ctx.value);
            return `守备力上升${ctx.value}`;
        } else {
            ctx.card.currentAttack = safe(ctx.card.currentAttack + ctx.value);
            return `攻击力上升${ctx.value}`;
        }
    },
    // 效果③：被战斗破坏时，从卡组将1只等级N以下水属性怪兽加入手牌
    searchWaterMonster(ctx) {
        const maxLevel = ctx.value || 4;
        const candidates = ctx.player.deck.filter(c =>
            c.type === "monster" && c.attribute === "water" && (c.level || 0) <= maxLevel
        );
        if (candidates.length === 0) return "卡组中没有符合条件的怪兽";
        // AI随机选，玩家可后续扩展为选择界面
        const picked = candidates[Math.floor(ctx.engine._random() * candidates.length)];
        const idx = ctx.player.deck.indexOf(picked);
        if (idx >= 0) {
            ctx.player.deck.splice(idx, 1);
            ctx.player.hand.push(picked);
            return `从卡组将${picked.name || "水属性怪兽"}加入手牌`;
        }
        return "搜索失败";
    },

    // ---- 里间雨效果 ----
    // 效果①：召唤/反转召唤时，对方不能将此卡作为效果对象（直到回合结束）
    targetProtect(ctx) {
        ctx.card.cannotBeTargeted = true;
        // 回合结束时清除（通过tempEffects追踪）
        ctx.card.tempEffects.push({ type: "targetProtect", value: 1, duration: "untilEndTurn", source: ctx.card });
        return "对方不能将此卡作为效果对象";
    },
    // 效果②：对方攻击时切换守备表示并强制攻击其他怪兽；无其他怪兽时守备+400
    switchDefenseRedirect(ctx) {
        ctx.card.attackRedirector = true;
        ctx.card.redirectValue = ctx.value || 400;
        return "攻击时将切换守备表示并强制对方攻击其他怪兽";
    },
    // 效果③：被战斗破坏时，后场1张盖卡回手
    bounceBackrow(ctx) {
        const faceDowns = ctx.player.spellTrapZone.filter(c => c.faceDown);
        if (faceDowns.length === 0) return "后场没有盖放的卡";
        const picked = faceDowns[Math.floor(ctx.engine._random() * faceDowns.length)];
        const idx = ctx.player.spellTrapZone.indexOf(picked);
        if (idx >= 0) {
            ctx.player.spellTrapZone.splice(idx, 1);
            resetCardState(picked);
            ctx.player.hand.push(picked);
            return `将${picked.name || "盖卡"}返回手牌`;
        }
        return "回手失败";
    },

    // ---- 宫崎奏效果 ----
    // 效果①：召唤/反转召唤时，墓地1张水属性回卡组底 + 效果对象保护
    recycleWaterAndProtect(ctx) {
        // 回收墓地水属性卡
        const waterCards = ctx.player.graveyard.filter(c => c.attribute === "water");
        let msg = "";
        if (waterCards.length > 0) {
            const picked = waterCards[Math.floor(ctx.engine._random() * waterCards.length)];
            const idx = ctx.player.graveyard.indexOf(picked);
            if (idx >= 0) {
                ctx.player.graveyard.splice(idx, 1);
                ctx.player.deck.push(picked);
                msg = `将${picked.name || "水属性卡"}回卡组底`;
            }
        } else {
            msg = "墓地没有水属性卡";
        }
        // 效果对象保护
        ctx.card.cannotBeTargeted = true;
        ctx.card.tempEffects.push({ type: "targetProtect", value: 1, duration: "untilEndTurn", source: ctx.card });
        return msg + "，对方不能将此卡作为效果对象";
    },
    // 效果②：对方回合对方发动效果时，数值增减减半；非数值效果则对方丢1张手牌
    effectDisruptor(ctx) {
        ctx.card.effectDisruptor = true;
        return "效果干扰就绪";
    },
    // 效果③：被战斗破坏时，场上1只Lv4以下怪兽攻守+250
    buffAllyOnDestroy(ctx) {
        const candidates = ctx.player.monsterZone.filter(m => m !== ctx.card && (m.level || 0) <= 4);
        if (candidates.length === 0) return "没有符合条件的怪兽";
        // AI随机选，玩家可后续扩展为选择界面
        const target = candidates[Math.floor(ctx.engine._random() * candidates.length)];
        target.currentAttack = safe(target.currentAttack + ctx.value);
        target.currentDefense = safe(target.currentDefense + ctx.value);
        target.permanentBuffs.push({ type: "attack", value: ctx.value, source: "buffAllyOnDestroy" });
        target.permanentBuffs.push({ type: "defense", value: ctx.value, source: "buffAllyOnDestroy" });
        return `${target.name || "怪兽"}攻击力和守备力各上升${ctx.value}`;
    },

    // 山田凉效果①：墓地1张魔法卡放回卡组顶端，抽1卡
    recycleSpellDraw(ctx) {
        const spells = ctx.player.graveyard.filter(c => c.type === "spell");
        if (spells.length === 0) return "墓地没有魔法卡";
        // AI随机选，玩家可后续扩展为选择界面
        const picked = spells[Math.floor(ctx.engine._random() * spells.length)];
        const idx = ctx.player.graveyard.indexOf(picked);
        if (idx >= 0) {
            ctx.player.graveyard.splice(idx, 1);
            ctx.player.deck.unshift(picked);
        }
        const r = ctx.engine.drawCard(ctx.player);
        return `将${picked.name || "魔法卡"}放回卡组顶端，${r.card ? "抽1张卡" : "牌库已空"}`;
    },

    // 山田凉效果②：融合素材时可用手牌魔法卡代替怪兽素材（标记效果，融合召唤时检查）
    fusionSubstituteSpell(ctx) {
        ctx.card.fusionSubstituteSpell = true;
        return "融合素材时可用手牌魔法卡代替";
    },

    // 青蓝妆者效果：手牌1张魔法送墓，从卡组拿1张魔法（本回合不能发动）
    searchSpellByDiscard(ctx) {
        const handSpells = ctx.player.hand.filter(c => c.type === "spell");
        if (handSpells.length === 0) return "手牌没有魔法卡";
        // AI随机丢弃1张魔法卡
        const discarded = handSpells[Math.floor(ctx.engine._random() * handSpells.length)];
        const didx = ctx.player.hand.indexOf(discarded);
        if (didx >= 0) ctx.player.hand.splice(didx, 1);
        ctx.player.graveyard.push(discarded);
        // 从卡组搜索1张魔法卡
        const deckSpells = ctx.player.deck.filter(c => c.type === "spell");
        if (deckSpells.length === 0) { return `将${discarded.name || "魔法卡"}送入墓地，但卡组没有魔法卡`; }
        const picked = deckSpells[Math.floor(ctx.engine._random() * deckSpells.length)];
        const pidx = ctx.player.deck.indexOf(picked);
        if (pidx >= 0) ctx.player.deck.splice(pidx, 1);
        ctx.player.hand.push(picked);
        // 标记本回合不能发动
        picked.cannotActivateThisTurn = true;
        return `将${discarded.name || "魔法卡"}送入墓地，从卡组拿了${picked.name || "魔法卡"}（本回合不能发动）`;
    },

    // 朝比奈真冬效果：丢弃1手牌，对方1只怪兽至下个结束阶段不能攻击
    discardToDisableAttack(ctx) {
        if (ctx.player.hand.length === 0) return "手牌不足";
        // 丢弃1张手牌
        const discarded = ctx.player.hand.pop();
        ctx.player.graveyard.push(discarded);
        // 选择对方1只怪兽禁止攻击
        const targets = ctx.targets || [];
        if (targets.length === 0) {
            // 没有手动选择则选攻击力最高的
            const oppMonsters = ctx.opponent.monsterZone;
            if (oppMonsters.length === 0) { ctx.player.graveyard.pop(); ctx.player.hand.push(discarded); return "对方场上没有怪兽"; }
            const target = oppMonsters.reduce((a, b) => (a.currentAttack || 0) > (b.currentAttack || 0) ? a : b);
            target.cannotAttack = true;
            target.attackDisabledUntilEndPhase = true;
            return `丢弃${discarded.name || "手牌"}，${target.name}直至对方下个结束阶段无法攻击`;
        }
        const target = targets[0];
        target.cannotAttack = true;
        target.attackDisabledUntilEndPhase = true;
        return `丢弃${discarded.name || "手牌"}，${target.name}直至对方下个结束阶段无法攻击`;
    },

    // ---- UR 陷阱卡效果 ----

    // 暮雨长街的独行：攻击无效+额外回手
    cancelAttackAndReturn(ctx) {
        const attacker = ctx.target;
        if (attacker && attacker.type === "monster") {
            attacker.cancelAttack = true;
            const opp = ctx.opponent;
            // 如果对方本回合已攻击2次以上，额外回手1只攻击过的怪兽
            if (opp.monsterZone.filter(m => m.hasAttackedThisTurn).length >= (ctx.value || 2)) {
                const attackers = opp.monsterZone.filter(m => m.hasAttackedThisTurn && m !== attacker);
                if (attackers.length > 0) {
                    const returnTarget = attackers[0];
                    const idx = opp.monsterZone.indexOf(returnTarget);
                    if (idx >= 0) {
                        opp.monsterZone.splice(idx, 1);
                        resetCardState(returnTarget);
                        opp.hand.push(returnTarget);
                        return `攻击无效，${returnTarget.name}返回对方手牌`;
                    }
                }
            }
            return "本次攻击无效";
        }
        return "攻击无效";
    },

    // 寒岭汤泉的憩息：移除墓地1张卡使破坏无效
    preventDestructionByBanish(ctx) {
        const player = ctx.player;
        if (player.graveyard.length === 0) return "墓地没有卡可以移除";
        const removed = player.graveyard.pop();
        const target = ctx.target;
        if (target && target.type === "monster") {
            target.cannotBeDestroyedByBattle = true;
            target.destructionPreventedThisTurn = true;
            return `移除${removed.name || "墓地卡"}，${target.name}本回合不会被战斗破坏`;
        }
        return "移除了1张墓地卡";
    },

    // 澄湖栈桥的余晖：寄存墓地卡+回收
    trapStackAndRecover(ctx) {
        const trapCard = ctx.card;
        if (!trapCard._stacked) trapCard._stacked = [];
        // 寄存刚送入墓地的卡
        const recentGrave = ctx.player.graveyard[ctx.player.graveyard.length - 1];
        if (recentGrave && trapCard._stacked.length < (ctx.value || 2)) {
            const idx = ctx.player.graveyard.indexOf(recentGrave);
            if (idx >= 0) {
                ctx.player.graveyard.splice(idx, 1);
                trapCard._stacked.push(recentGrave);
                return `将${recentGrave.name || "卡牌"}寄存（${trapCard._stacked.length}/${ctx.value || 2}）`;
            }
        }
        return "寄存已满或没有可寄存的卡";
    },

    // 夏空校舍的流云：暂时除外对方怪兽
    temporaryBanish(ctx) {
        const opp = ctx.opponent;
        const targets = resolveTargets(ctx.engine, ctx.player, ctx.targetSpec || { owner: "opponent", zone: "monster", selector: "highestAttack", count: 1 });
        if (targets.length === 0) return "没有可除外的怪兽";
        const target = targets[0];
        const idx = opp.monsterZone.indexOf(target);
        if (idx >= 0) {
            opp.monsterZone.splice(idx, 1);
            if (!ctx.player._tempBanished) ctx.player._tempBanished = [];
            ctx.player._tempBanished.push({ card: target, returnTurn: ctx.engine.state.turn + 2 });
            target.cannotAttack = true;
            return `${target.name}被暂时除外，回合结束时返还`;
        }
        return "除外失败";
    },

    // 星降神篱的祈愿：无效对方效果
    negateCounterEffect(ctx) {
        const target = ctx.target;
        if (target) {
            target.effectNegated = true;
            return `无效了${target.name || "对方"}的效果`;
        }
        return "无效了对方的效果";
    },

    // ---- 新通用效果处理器 ----
    modifyStat(ctx) {
        const targets = ctx.targets || [];
        for (const t of targets) {
            if (t.currentAttack !== undefined) t.currentAttack = safe(t.currentAttack + (ctx.value || 0));
            if (t.currentDefense !== undefined) t.currentDefense = safe(t.currentDefense + (ctx.value || 0));
        }
        return targets.length > 0 ? `修改了${targets.length}只怪兽的数值` : "没有目标";
    },
    swapAttackDefense(ctx) {
        const targets = ctx.targets || [];
        for (const t of targets) {
            if (t.currentAttack !== undefined && t.currentDefense !== undefined) {
                const tmp = t.currentAttack;
                t.currentAttack = t.currentDefense;
                t.currentDefense = tmp;
            }
        }
        return targets.length > 0 ? `交换了${targets.length}只怪兽的攻守` : "没有目标";
    },
    destroyAll(ctx) {
        const opp = ctx.opponent;
        const t = [...opp.monsterZone];
        t.forEach(m => destroyMonster(opp, m, ctx.engine));
        return `破坏了对方${t.length}只怪兽`;
    },
    specialSummonFromGraveyard(ctx) {
        const target = ctx.target;
        if (!target || target.type !== "monster") return "没有可复活的怪兽";
        if (!canSpecialSummon(ctx.player)) return "当回合不能特殊召唤";
        const idx = ctx.player.graveyard.indexOf(target);
        if (idx === -1) return "目标不在墓地";
        if (ctx.player.monsterZone.length >= GAME_CONFIG.MAX_MONSTER_ZONE) return "怪兽区已满";
        ctx.player.graveyard.splice(idx, 1);
        resetCardState(target);
        // 游戏王规则没有“召唤疲劳”：非先攻首回合，特殊召唤的攻击表示怪兽本回合即可攻击。
        target.canAttack = !ctx.engine.state.firstTurn && !ctx.player.skipBattlePhase;
        target.faceUp = true;
        target.position = MONSTER_POSITION.ATTACK;
        target.setTurn = ctx.engine.state.turn;
        target.positionChangedThisTurn = false;
        ctx.player.monsterZone.push(target);
        return `从墓地特殊召唤了${target.name}`;
    },
    negateEffect(ctx) { return "效果无效化准备就绪"; },
    cannotAttack(ctx) {
        const targets = ctx.targets || [];
        targets.forEach(t => { t.cannotAttack = true; });
        return targets.length > 0 ? `封锁了${targets.length}只怪兽的攻击` : "没有目标";
    },
    cannotBeAttacked(ctx) {
        const targets = ctx.targets || [];
        targets.forEach(t => { t.cannotBeDestroyedByBattle = true; });
        return targets.length > 0 ? `${targets.length}只怪兽本回合不会被战斗破坏` : "没有目标";
    },
    changePosition(ctx) {
        const targets = ctx.targets || [];
        targets.forEach(t => {
            if (t.position === MONSTER_POSITION.ATTACK) t.position = MONSTER_POSITION.DEFENSE;
            else t.position = MONSTER_POSITION.ATTACK;
        });
        return targets.length > 0 ? `改变了${targets.length}只怪兽的表示形式` : "没有目标";
    },
    returnToHand(ctx) {
        const targets = ctx.targets || [];
        const opp = ctx.opponent;
        let returned = 0;
        const returnedCards = [];
        for (const t of [...targets]) {
            const idx = opp.monsterZone.indexOf(t);
            if (idx >= 0) {
                opp.monsterZone.splice(idx, 1);
                resetCardState(t);
                if (opp.hand.length < GAME_CONFIG.MAX_HAND_SIZE) {
                    opp.hand.push(t);
                } else {
                    opp.graveyard.push(t);
                }
                returnedCards.push(t);
                returned++;
            }
        }
        // 记录被返回的卡牌，供控制器播放动画
        ctx._returnedCards = returnedCards;
        return returned > 0 ? `将${returned}只怪兽返回手牌` : "没有目标";
    },
    searchDeck(ctx) {
        const deck = ctx.player.deck;
        if (deck.length === 0) return "牌库为空";
        const f = ctx.targetSpec?.filters || {};
        const found = deck.find(c => {
            if (f.attribute && !f.attribute.includes(c.attribute)) return false;
            if (f.type && c.type !== f.type) return false;
            if (f.series && c.series !== f.series) return false;
            return true;
        });
        if (!found) return "牌库中没有符合条件的卡牌";
        deck.splice(deck.indexOf(found), 1);
        if (ctx.player.hand.length < GAME_CONFIG.MAX_HAND_SIZE) {
            ctx.player.hand.push(found);
        } else {
            ctx.player.graveyard.push(found);
        }
        return `从牌库中检索了${found.name}`;
    },
    discardCards(ctx) {
        const opp = ctx.opponent;
        const count = ctx.value || 1;
        let discarded = 0;
        for (let i = 0; i < count && opp.hand.length > 0; i++) {
            const idx = Math.floor(ctx.engine._random() * opp.hand.length);
            const card = opp.hand.splice(idx, 1)[0];
            opp.graveyard.push(card);
            discarded++;
        }
        return discarded > 0 ? `对方丢弃了${discarded}张手牌` : "对方没有手牌";
    },
    directAttackDamage(ctx) {
        ctx.opponent.takeDamage(ctx.value);
        return `对${ctx.opponent.name}造成${ctx.value}点直接伤害`;
    },
    preventDamage(ctx) {
        const targets = ctx.targets || [];
        targets.forEach(t => { t.cannotBeDestroyedByBattle = true; });
        return targets.length > 0 ? `${targets.length}只怪兽本回合不受战斗伤害` : "没有目标";
    },
    tokenSummon(ctx) {
        if (!canSpecialSummon(ctx.player)) return "当回合不能特殊召唤";
        if (ctx.player.monsterZone.length >= GAME_CONFIG.MAX_MONSTER_ZONE) return "怪兽区已满";
        const token = createCardInstance({
            id: "token_" + ctx.engine._random().toString(36).slice(2, 6),
            name: "衍生物",
            type: "monster",
            attribute: "none",
            race: "rock",
            level: 1,
            attack: ctx.value || 500,
            defense: ctx.value || 500,
            rarity: "N",
            effect: null,
            description: "衍生物",
        });
        // 衍生物同样遵循无召唤疲劳规则；卡牌效果可再单独附加“不能攻击”。
        token.canAttack = !ctx.engine.state.firstTurn && !ctx.player.skipBattlePhase;
        token.setTurn = ctx.engine.state.turn;
        token.positionChangedThisTurn = false;
        ctx.player.monsterZone.push(token);
        return `特殊召唤了衍生物 (ATK/${token.currentAttack} DEF/${token.currentDefense})`;
    },
    gainAttackByCount(ctx) {
        const count = ctx.player.monsterZone.length;
        const gain = count * (ctx.value || 300);
        ctx.card.currentAttack = safe(ctx.card.currentAttack + gain);
        return `攻击力上升${gain}（场上${count}只怪兽）`;
    },
    oncePerTurn(ctx) { return "一回合一次效果已使用"; },

    // ---- Nightcord 专属效果 ----

    // 绘名：支付LP造成伤害
    lifeCostBurst(ctx) {
        const costEff = ctx.card.effects?.find(e => e.costEffect);
        if (costEff?.costEffect?.type === "payLife") {
            ctx.player.takeDamage(costEff.costEffect.value);
        }
        const targets = resolveTargets(ctx.engine, ctx.player, ctx.targetSpec || { owner: "opponent", zone: "monster", selector: "highestAttack", count: 1 });
        if (targets.length > 0) {
            const t = targets[0];
            t.currentDefense = safe(t.currentDefense - 800);
            let msg = `支付LP并对${t.name}造成800伤害`;
            if (t.currentDefense <= 0) { destroyMonster(ctx.opponent, t, ctx.engine); msg += "，怪兽被破坏"; }
            return msg;
        }
        ctx.opponent.takeDamage(800);
        return "支付LP并对对方造成800伤害";
    },

    // 绘名：自身低攻时强化
    selfDestructBurst(ctx) {
        if (ctx.card.currentAttack < 1000) {
            ctx.card.currentAttack = safe(ctx.card.currentAttack + 1500);
            return "自身攻击力低于1000，攻击力上升1500";
        }
        return "自身攻击力不低于1000，效果未发动";
    },

    // 绘名：低生命时增伤 + 四人共鸣清场
    lowHpBurst(ctx) {
        let msg = "";
        if (ctx.player.lp < 4000) {
            ctx.card.currentAttack = safe(ctx.card.currentAttack + 1000);
            msg = "LP低于4000，攻击力上升1000";
        }
        if (hasResonance(ctx.player, 4)) {
            const opp = ctx.opponent;
            const targets = [...opp.monsterZone];
            targets.forEach(m => destroyMonster(opp, m, ctx.engine));
            msg += (msg ? "，" : "") + `四人共鸣！破坏了对方${targets.length}只怪兽`;
        }
        return msg || "效果未满足条件";
    },

    // 绘名：终极爆发
    ultimateBurst(ctx) {
        const costEff = ctx.card.effects?.find(e => e.costEffect);
        if (costEff?.costEffect?.type === "payLife") {
            ctx.player.takeDamage(costEff.costEffect.value);
        }
        ctx.opponent.takeDamage(1500);
        let msg = "支付LP并对对方造成1500伤害";
        if (hasResonance(ctx.player, 2)) {
            ctx.card.currentAttack = safe(ctx.card.currentAttack + 800);
            msg += "，共鸣：攻击力上升800";
        }
        return msg;
    },

    // 共鸣爆发：基础伤害 + 共鸣直伤
    resonanceBurst(ctx) {
        const targets = resolveTargets(ctx.engine, ctx.player, { owner: "opponent", zone: "monster", selector: "highestAttack", count: 1 });
        let msg = "";
        if (targets.length > 0) {
            const t = targets[0];
            t.currentDefense = safe(t.currentDefense - ctx.value);
            msg = `对${t.name}造成${ctx.value}伤害`;
            if (t.currentDefense <= 0) { destroyMonster(ctx.opponent, t, ctx.engine); msg += "，怪兽被破坏"; }
        } else {
            ctx.opponent.takeDamage(ctx.value);
            msg = `对对方造成${ctx.value}伤害`;
        }
        if (hasResonance(ctx.player, 2)) {
            ctx.opponent.takeDamage(700);
            msg += "，共鸣：对对方造成700伤害";
        }
        return msg;
    },

    // 共鸣增强：buff所有Nightcord怪兽
    resonanceBoost(ctx) {
        let count = 0;
        for (const m of ctx.player.monsterZone) {
            if (m.series === "nightcord") {
                m.currentAttack = safe(m.currentAttack + ctx.value);
                count++;
            }
        }
        return count > 0 ? `${count}只Nightcord怪兽攻击力上升${ctx.value}` : "没有Nightcord怪兽";
    },

    // 奏：恢复 + 抽牌
    healAndDraw(ctx) {
        ctx.player.heal(500);
        ctx.engine.drawCard(ctx.player);
        return "恢复500LP，抽1张卡";
    },

    // 奏：终极抽牌
    ultimateDraw(ctx) {
        let n = 0;
        for (let i = 0; i < 4; i++) { const r = ctx.engine.drawCard(ctx.player); if (r.card) n++; }
        let msg = `抽了${n}张卡`;
        if (hasResonance(ctx.player, 2)) {
            ctx.player.heal(1000);
            msg += "，共鸣：恢复1000LP";
        }
        return msg;
    },

    // 共同：groupDraw
    groupDraw(ctx) {
        let n = 0;
        for (let i = 0; i < ctx.value; i++) { const r = ctx.engine.drawCard(ctx.player); if (r.card) n++; }
        let msg = `抽了${n}张卡`;
        if (hasResonance(ctx.player, 2)) {
            const r2 = ctx.engine.drawCard(ctx.player);
            if (r2.card) { n++; msg += "，共鸣：再抽1张"; }
        }
        return msg;
    },

    // 共同：groupBuff
    groupBuff(ctx) {
        ctx.player.monsterZone.forEach(m => { m.currentAttack = safe(m.currentAttack + ctx.value); });
        let msg = `己方全部怪兽攻击力上升${ctx.value}`;
        if (hasResonance(ctx.player, 2)) {
            ctx.player.monsterZone.forEach(m => { m.currentAttack = safe(m.currentAttack + 200); });
            msg += "，共鸣：额外上升200";
        }
        return msg;
    },

    // 共同：resonancePower — 三重共鸣清场
    resonancePower(ctx) {
        if (hasResonance(ctx.player, 3)) {
            const opp = ctx.opponent;
            const targets = [...opp.monsterZone];
            targets.forEach(m => destroyMonster(opp, m, ctx.engine));
            return `三重共鸣！破坏了对方${targets.length}只怪兽`;
        }
        return "未满足三重共鸣条件";
    },

    // 共同：终极团体 — 四人共鸣清场+直伤
    ultimateGroup(ctx) {
        if (hasResonance(ctx.player, 4)) {
            const opp = ctx.opponent;
            const targets = [...opp.monsterZone];
            targets.forEach(m => destroyMonster(opp, m, ctx.engine));
            ctx.opponent.takeDamage(1000);
            return `四人共鸣！破坏了对方${targets.length}只怪兽，对对方造成1000伤害`;
        }
        return "未满足四人共鸣条件";
    },

    // 真冬：全场冻结
    freezeAll(ctx) {
        ctx.opponent.monsterZone.forEach(m => {
            m.currentAttack = Math.max(0, m.currentAttack - 500);
            m.cannotAttack = true;
        });
        return `对方全部怪兽攻击力下降500且不能攻击`;
    },

    // 真冬：破坏最弱
    destroyWeakest(ctx) {
        const opp = ctx.opponent;
        if (opp.monsterZone.length === 0) return "对方场上没有怪兽";
        const weakest = opp.monsterZone.reduce((a, b) => a.currentAttack < b.currentAttack ? a : b);
        destroyMonster(opp, weakest, ctx.engine);
        return `破坏了${weakest.name}`;
    },

    // 真冬：共鸣冻结
    resonanceFreeze(ctx) {
        ctx.opponent.monsterZone.forEach(m => {
            m.currentAttack = Math.max(0, m.currentAttack - ctx.value);
        });
        let msg = `对方全部怪兽攻击力下降${ctx.value}`;
        if (hasResonance(ctx.player, 3)) {
            const opp = ctx.opponent;
            const targets = [...opp.monsterZone];
            targets.forEach(m => { m.currentDefense = safe(m.currentDefense - 800); if (m.currentDefense <= 0) destroyMonster(opp, m, ctx.engine); });
            msg += `，三重共鸣：对对方全部怪兽造成800伤害`;
        }
        return msg;
    },

    // 真冬：削弱+破坏弱者+共鸣全场破坏
    destroyAllWeakened(ctx) {
        ctx.opponent.monsterZone.forEach(m => {
            m.currentAttack = Math.max(0, m.currentAttack - ctx.value);
        });
        const weak = ctx.opponent.monsterZone.filter(m => m.currentAttack < 1000);
        weak.forEach(m => destroyMonster(ctx.opponent, m, ctx.engine));
        let msg = `对方全部怪兽攻击力下降${ctx.value}，${weak.length}只被破坏`;
        if (hasResonance(ctx.player, 4)) {
            const rest = [...ctx.opponent.monsterZone];
            rest.forEach(m => destroyMonster(ctx.opponent, m, ctx.engine));
            msg += `，四人共鸣：破坏了剩余${rest.length}只怪兽`;
        }
        return msg;
    },

    // 真冬：终极冻结
    ultimateFreeze(ctx) {
        ctx.opponent.monsterZone.forEach(m => {
            m.currentAttack = Math.max(0, m.currentAttack - ctx.value);
            m.cannotAttack = true;
        });
        ctx.opponent.takeDamage(400);
        return `对方全部怪兽攻击力下降${ctx.value}且不能攻击，对方受到400伤害`;
    },

    // 瑞希：复制上一张魔法
    copyLastSpell(ctx) {
        // 简化实现：抽1张卡作为补偿
        ctx.engine.drawCard(ctx.player);
        let msg = "复制了上一张魔法卡效果（简化：抽1张卡）";
        if (hasResonance(ctx.player, 2)) {
            ctx.engine.drawCard(ctx.player);
            msg += "，共鸣：再抽1张";
        }
        return msg;
    },

    // 瑞希：全体攻守互换
    swapAttackDefense(ctx) {
        const targets = ctx.targets || ctx.opponent.monsterZone;
        let count = 0;
        for (const t of targets) {
            if (t.currentAttack !== undefined && t.currentDefense !== undefined) {
                const tmp = t.currentAttack;
                t.currentAttack = t.currentDefense;
                t.currentDefense = tmp;
                count++;
            }
        }
        return count > 0 ? `交换了${count}只怪兽的攻守` : "没有目标";
    },

    // 瑞希：重定向攻击
    redirectAttack(ctx) {
        return "选择对方一只怪兽，本回合其攻击必须攻击己方另一只怪兽";
    },

    // 瑞希：多重返回
    returnMultiple(ctx) {
        const opp = ctx.opponent;
        const targets = [...opp.monsterZone].slice(0, Math.max(1, Number(ctx.value) || 2));
        let returned = 0;
        for (const t of targets) {
            const idx = opp.monsterZone.indexOf(t);
            if (idx >= 0) {
                opp.monsterZone.splice(idx, 1);
                resetCardState(t);
                if (opp.hand.length < 7) opp.hand.push(t);
                else opp.graveyard.push(t);
                returned++;
            }
        }
        return returned > 0 ? `将${returned}只怪兽返回手牌` : "没有目标";
    },

    // 瑞希：共鸣重定向
    resonanceRedirect(ctx) {
        const opp = ctx.opponent;
        if (hasResonance(ctx.player, 2)) {
            const targets = [...opp.monsterZone];
            let returned = 0;
            for (const t of targets) {
                const idx = opp.monsterZone.indexOf(t);
                if (idx >= 0) {
                    opp.monsterZone.splice(idx, 1);
                    resetCardState(t);
                    if (opp.hand.length < 7) opp.hand.push(t);
                    else opp.graveyard.push(t);
                    returned++;
                }
            }
            return `共鸣：将${returned}只怪兽返回手牌`;
        }
        // 单体返回
        const target = opp.monsterZone.reduce((a, b) => a.currentAttack > b.currentAttack ? a : b, opp.monsterZone[0]);
        if (target) {
            const idx = opp.monsterZone.indexOf(target);
            opp.monsterZone.splice(idx, 1);
            resetCardState(target);
            if (opp.hand.length < 7) opp.hand.push(target);
            else opp.graveyard.push(target);
            return `将${target.name}返回手牌`;
        }
        return "没有目标";
    },

    // 瑞希：终极重定向+直伤
    ultimateRedirect(ctx) {
        const opp = ctx.opponent;
        const targets = [...opp.monsterZone];
        let returned = 0;
        for (const t of targets) {
            const idx = opp.monsterZone.indexOf(t);
            if (idx >= 0) {
                opp.monsterZone.splice(idx, 1);
                resetCardState(t);
                if (opp.hand.length < 7) opp.hand.push(t);
                else opp.graveyard.push(t);
                returned++;
            }
        }
        let msg = `将${returned}只怪兽返回手牌`;
        if (hasResonance(ctx.player, 4)) {
            ctx.opponent.takeDamage(1000);
            msg += "，四人共鸣：对对方造成1000伤害";
        }
        return msg;
    },

    // 瑞希：终极复制
    ultimateCopy(ctx) {
        const targets = resolveTargets(ctx.engine, ctx.player, { owner: "opponent", zone: "monster", selector: "highestAttack", count: 1 });
        if (targets.length > 0) {
            ctx.card.currentAttack = safe(ctx.card.currentAttack + targets[0].currentAttack);
            return `复制了${targets[0].name}的攻击力，攻击力上升${targets[0].currentAttack}`;
        }
        return "没有可复制的目标";
    },

    // 奏：保护己方
    protectAllies(ctx) {
        ctx.player.monsterZone.forEach(m => { m.cannotBeDestroyedByBattle = true; });
        let msg = "己方全部怪兽本回合不会被战斗破坏";
        if (hasResonance(ctx.player, 2)) {
            ctx.player.heal(1000);
            msg += "，共鸣：恢复1000LP";
        }
        return msg;
    },

    // 奏：完全恢复
    fullRecovery(ctx) {
        ctx.player.heal(1500);
        ctx.player.monsterZone.forEach(m => {
            m.currentDefense = m.defense || m.health || 0;
            m.currentHealth = m.defense || m.health || 0;
        });
        let msg = "恢复1500LP，己方怪兽恢复满血";
        if (hasResonance(ctx.player, 4)) {
            const chars = ctx.player.graveyard.filter(c => c.type === "monster").slice(0, 3);
            for (const c of chars) {
                const idx = ctx.player.graveyard.indexOf(c);
                if (idx >= 0) { ctx.player.graveyard.splice(idx, 1); resetCardState(c); ctx.player.hand.push(c); }
            }
            msg += `，四人共鸣：从墓地返回${chars.length}只怪兽到手牌`;
        }
        return msg;
    },

    // 陷阱：反击破坏
    counterDestroy(ctx) {
        const attacker = ctx.target;
        if (attacker && attacker.type === "monster") {
            destroyMonster(ctx.opponent, attacker, ctx.engine);
            let msg = `破坏了${attacker.name}`;
            if (hasResonance(ctx.player, 2)) {
                ctx.opponent.takeDamage(500);
                msg += "，共鸣：对对方造成500伤害";
            }
            return msg;
        }
        return "没有可破坏的目标";
    },

    // 真冬：削弱并条件破坏
    debuffAndDestroy(ctx) {
        const targets = resolveTargets(ctx.engine, ctx.player, { owner: "opponent", zone: "monster", selector: "highestAttack", count: 1 });
        if (targets.length > 0) {
            const t = targets[0];
            t.currentAttack = Math.max(0, t.currentAttack - ctx.value);
            let msg = `${t.name}攻击力下降${ctx.value}`;
            if (hasResonance(ctx.player, 2) && t.currentAttack < 800) {
                destroyMonster(ctx.opponent, t, ctx.engine);
                msg += "，共鸣：怪兽被破坏";
            }
            return msg;
        }
        return "没有目标";
    },

    // 回收效果（简化版）
    reviveToHand(ctx) {
        const chars = ctx.player.graveyard.filter(c => c.type === "monster");
        const count = ctx.card.effects?.find(e => e.type === "reviveToHand")?.count || 1;
        let revived = 0;
        for (let i = 0; i < count && chars.length > 0; i++) {
            const target = chars[chars.length - 1 - i];
            if (!target) break;
            const idx = ctx.player.graveyard.indexOf(target);
            if (idx >= 0) { ctx.player.graveyard.splice(idx, 1); resetCardState(target); ctx.player.hand.push(target); revived++; }
        }
        return revived > 0 ? `从墓地返回${revived}只怪兽到手牌` : "墓地没有可返回的怪兽";
    },

    // 简化：直接伤害
    directAttackDamage(ctx) {
        ctx.opponent.takeDamage(ctx.value);
        return `对${ctx.opponent.name}造成${ctx.value}伤害`;
    },

    // ---- SSR魔法卡专用效果 ----

    // 回复前N回合丢失的生命值并抽卡
    recoverRecentDamage(ctx) {
        const turnsBack = ctx.value || 3;
        // 简化实现：回复一个固定量（每回合损失平均400LP）+ 抽1卡
        const healed = turnsBack * 400;
        ctx.player.heal(healed);
        const r = ctx.engine.drawCard(ctx.player);
        return `回复了前${turnsBack}回合的生命值（约${healed}LP），${r.card ? "抽1张卡" : "牌库已空"}`;
    },

    // 本回合增益+回合结束永久削弱
    buffThenDebuff(ctx) {
        const targets = ctx.targets || [];
        const buffValue = ctx.value || 400;
        const penalty = ctx.effects?.[0]?.penalty || 700;
        for (const t of targets) {
            if (t.currentAttack !== undefined) t.currentAttack = safe(t.currentAttack + buffValue);
        }
        // 记录回合结束时的削弱（简化：立即扣除，作为"永久"效果）
        // 实际上应该在endPhase触发，这里简化处理
        const msg = `${targets.length}只怪兽攻击力+${buffValue}（回合结束时将永久-${penalty}）`;
        return msg;
    },

    // 回复生命+抽卡（增强版）
    healAndDrawV2(ctx) {
        const healValue = ctx.value || 2000;
        const drawCount = ctx.effects?.[0]?.draw || 1;
        ctx.player.heal(healValue);
        let drawn = 0;
        for (let i = 0; i < drawCount; i++) { const r = ctx.engine.drawCard(ctx.player); if (r.card) drawn++; }
        return `回复${healValue}LP，抽${drawn}张卡`;
    },

    // 抽取对方手牌（类型判定）
    snatchCards(ctx) {
        const count = ctx.value || 2;
        const opp = ctx.opponent;
        if (opp.hand.length === 0) return "对方没有手牌";
        const stolen = [];
        for (let i = 0; i < count && opp.hand.length > 0; i++) {
            const idx = Math.floor(ctx.engine._random() * opp.hand.length);
            stolen.push(opp.hand.splice(idx, 1)[0]);
        }
        // 判断类型是否相同
        const types = stolen.map(c => c.type);
        const allSame = types.every(t => t === types[0]);
        if (allSame) {
            // 类型相同：归还对方，魔法失败
            for (const c of stolen) { opp.hand.push(c); }
            return `抽取了对方${count}张手牌，但类型全部相同（${types[0]}），魔法失败，手牌已归还`;
        } else {
            // 类型不同：归自己所有，魔法成功
            for (const c of stolen) { ctx.player.hand.push(c); }
            return `抽取了对方${count}张手牌，类型不同，魔法成功！获得对方卡牌`;
        }
    },

    // 回收手牌再抽（己方或对方）
    recycleAndDraw(ctx) {
        const owner = ctx.effects?.[0]?.owner === "opponent" ? ctx.opponent : ctx.player;
        const handCount = owner.hand.length;
        if (handCount === 0) return `${owner.name}没有手牌`;
        // 将手牌送入墓地
        for (const c of [...owner.hand]) { owner.graveyard.push(c); }
        owner.hand = [];
        // 抽相同数量
        let drawn = 0;
        for (let i = 0; i < handCount; i++) { const r = ctx.engine.drawCard(owner); if (r.card) drawn++; }
        return `${owner.name}将${handCount}张手牌送入墓地，抽取了${drawn}张新卡`;
    },

    // ---- UR魔法卡专用效果 ----

    // 交换双方手牌
    swapHands(ctx) {
        const tempHand = [...ctx.player.hand];
        ctx.player.hand = [...ctx.opponent.hand];
        ctx.opponent.hand = tempHand;
        return "交换了双方的手牌";
    },

    // 封锁对方怪兽攻击（永久，直到被祭品/破坏解除）
    lockAttack(ctx) {
        const count = ctx.value || 2;
        const opp = ctx.opponent;
        // 通过target spec自动选择目标
        let targets = ctx.targets || [];
        if (targets.length === 0 && ctx.targetSpec) {
            targets = resolveTargets(ctx.engine, ctx.player, ctx.targetSpec);
        }
        targets = targets.filter(m => !m.attackLocked);
        if (targets.length === 0) return "没有可封锁的怪兽";
        for (const t of targets) {
            t.attackLocked = true;
            t.cannotAttack = true;
            t.canAttack = false;
        }
        return `封锁了${targets.length}只怪兽的攻击能力（${targets.map(t => t.name).join("、")}），永久生效`;
    },

    // 场地魔法：水属性怪兽ATK/DEF+value，对方变守备需丢1手牌
    fieldWaterBuff(ctx) {
        const owner = ctx.player;
        const buffValue = ctx.value || 450;
        // 只清除本效果的旧buff，不清除其他场地效果的buff
        for (const m of owner.monsterZone) {
            m.permanentBuffs = m.permanentBuffs.filter(b => b.source !== "fieldWaterBuff");
        }
        // 重新应用
        for (const m of owner.monsterZone) {
            if (m.attribute === "water") {
                m.currentAttack = safe(m.currentAttack + buffValue);
                m.currentDefense = safe(m.currentDefense + buffValue);
                m.permanentBuffs.push({ type: "attack", value: buffValue, source: "fieldWaterBuff" });
                m.permanentBuffs.push({ type: "defense", value: buffValue, source: "fieldWaterBuff" });
            }
        }
        // 标记：对方变守备需丢1手牌
        owner.fieldSpellDiscardCost = true;
        return `场地魔法效果：水属性怪兽ATK/DEF+${buffValue}，对方变守备需丢1手牌`;
    },

    // 场地魔法：大海场景 + 水属性怪兽ATK/DEF+value
    fieldOceanScene(ctx) {
        const owner = ctx.player;
        const buffValue = ctx.value || 450;
        // 只清除本效果的旧buff，不清除其他场地效果的buff
        for (const m of owner.monsterZone) {
            m.permanentBuffs = m.permanentBuffs.filter(b => b.source !== "fieldOceanScene");
        }
        // 重新应用
        for (const m of owner.monsterZone) {
            if (m.attribute === "water") {
                m.currentAttack = safe(m.currentAttack + buffValue);
                m.currentDefense = safe(m.currentDefense + buffValue);
                m.permanentBuffs.push({ type: "attack", value: buffValue, source: "fieldOceanScene" });
                m.permanentBuffs.push({ type: "defense", value: buffValue, source: "fieldOceanScene" });
            }
        }
        return `场地魔法生效：大海场景展开，水属性怪兽ATK/DEF+${buffValue}`;
    },

    // 复活墓地中最后进入的怪兽（旧版兼容）
    reviveRecentGraveyard(ctx) {
        let targetIndex = -1;
        for (let index = ctx.player.graveyard.length - 1; index >= 0; index--) {
            if (ctx.player.graveyard[index]?.type === "monster") {
                targetIndex = index;
                break;
            }
        }
        if (targetIndex < 0) return "墓地没有怪兽可以复活";
        const [target] = ctx.player.graveyard.splice(targetIndex, 1);
        resetCardState(target);
        target.faceUp = true;
        target.position = "attack";
        target.setTurn = ctx.engine.state.turn;
        target.positionChangedThisTurn = false;
        if (ctx.player.monsterZone.length < 5) {
            ctx.player.monsterZone.push(target);
            return `复活了${target.name}到场上`;
        }
        ctx.player.hand.push(target);
        return `复活了${target.name}到手牌（场上已满）`;
    },

    // 八千年的思念：复活最近2回合怪兽，当回合不能攻击/作为素材
    reviveRecentGraveyardV2(ctx) {
        if (!canSpecialSummon(ctx.player)) return "当回合不能特殊召唤";
        const candidates = ctx.player.graveyard.filter(c => c.type === "monster");
        if (candidates.length === 0) return "墓地没有符合条件的怪兽";
        const target = candidates[candidates.length - 1];
        const idx = ctx.player.graveyard.indexOf(target);
        ctx.player.graveyard.splice(idx, 1);
        resetCardState(target);
        target.faceUp = true;
        target.position = "attack";
        // 当回合不能攻击
        target.cannotAttack = true;
        target.canAttack = false;
        // 当回合不能用作各类召唤素材（通过标记追踪）
        target.cannotUseAsMaterial = true;
        target.setTurn = ctx.engine.state.turn;
        target.positionChangedThisTurn = false;
        if (ctx.player.monsterZone.length < 5) {
            ctx.player.monsterZone.push(target);
            ctx.engine._lastRevivedCard = target;
            return `从墓地特殊召唤了${target.name}（当回合不能攻击/作为素材）`;
        }
        ctx.player.hand.push(target);
        return `从墓地特殊召唤了${target.name}到手牌（场上已满）`;
    },

    // 放学后的茶会：回复过去3回合失去的LP + 抽1卡 + 当回合不能直接攻击
    recoverAndDrawV2(ctx) {
        const turnsBack = ctx.value || 3;
        const healed = turnsBack * 400;
        ctx.player.heal(healed);
        const r = ctx.engine.drawCard(ctx.player);
        // 当回合我方怪兽不能直接攻击
        ctx.player.noDirectAttackThisTurn = true;
        return `回复了前${turnsBack}回合的生命值（约${healed}LP），${r.card ? "抽1张卡" : "牌库已空"}；当回合我方怪兽不能直接攻击`;
    },

    // 夜刻萦音的永续热忱：回复2000LP + 抽1卡 + 当回合不能特殊召唤
    healDrawNoSpecial(ctx) {
        const healValue = ctx.value || 2000;
        const drawCount = ctx.effects?.[0]?.draw || 1;
        ctx.player.heal(healValue);
        let drawn = 0;
        for (let i = 0; i < drawCount; i++) { const r = ctx.engine.drawCard(ctx.player); if (r.card) drawn++; }
        // 当回合不能特殊召唤
        ctx.player.cannotSpecialSummonThisTurn = true;
        return `回复${healValue}LP，抽${drawn}张卡；当回合不能特殊召唤`;
    },

    // 月下传讯：丢弃2张手牌 + 抽3张 + 当回合跳过战斗阶段
    discardAndDraw(ctx) {
        const discardCount = ctx.value || 2;
        const drawCount = ctx.drawValue || 3;
        // 丢弃手牌
        let discarded = 0;
        for (let i = 0; i < discardCount && ctx.player.hand.length > 0; i++) {
            const idx = Math.floor(ctx.engine._random() * ctx.player.hand.length);
            ctx.player.graveyard.push(ctx.player.hand.splice(idx, 1)[0]);
            discarded++;
        }
        if (discarded < discardCount) return `手牌不足，需要丢弃${discardCount}张但只有${discarded}张`;
        // 抽卡
        let drawn = 0;
        for (let i = 0; i < drawCount; i++) { const r = ctx.engine.drawCard(ctx.player); if (r.card) drawn++; }
        // 只有魔法卡版本带有“跳过战斗阶段”的代价。部分怪兽登场效果也复用
        // 该处理器，但卡面只写“丢弃并抽牌”，不能因此封锁己方全场攻击。
        const skipsBattle = ctx.card?.type === "spell" || ctx.sourceCard?.type === "spell";
        if (skipsBattle) ctx.player.skipBattlePhase = true;
        return `丢弃了${discarded}张手牌，抽了${drawn}张卡${skipsBattle ? "；当回合跳过战斗阶段" : ""}`;
    },

    // 沉睡的蓝调：双方全部手牌送墓 + 各自抽送墓数量的卡 + 当回合不能从手牌发动怪兽效果
    mutualHandRefresh(ctx) {
        const selfCount = ctx.player.hand.length;
        const oppCount = ctx.opponent.hand.length;
        // 己方手牌送墓
        for (const c of [...ctx.player.hand]) { ctx.player.graveyard.push(c); }
        ctx.player.hand = [];
        // 对方手牌送墓
        for (const c of [...ctx.opponent.hand]) { ctx.opponent.graveyard.push(c); }
        ctx.opponent.hand = [];
        // 各自抽卡
        let selfDrawn = 0;
        for (let i = 0; i < selfCount; i++) { const r = ctx.engine.drawCard(ctx.player); if (r.card) selfDrawn++; }
        let oppDrawn = 0;
        for (let i = 0; i < oppCount; i++) { const r = ctx.engine.drawCard(ctx.opponent); if (r.card) oppDrawn++; }
        // 当回合双方不能从手牌发动怪兽效果
        ctx.player.noHandMonsterEffectThisTurn = true;
        ctx.opponent.noHandMonsterEffectThisTurn = true;
        return `双方手牌全部送入墓地（己方${selfCount}张，对方${oppCount}张），各自抽${selfDrawn}/${oppDrawn}张卡；当回合双方不能从手牌发动怪兽效果`;
    },

    // 双倍攻击
    doubleAttack(ctx) {
        const targets = ctx.targets || [];
        if (targets.length === 0) return "没有选择怪兽";
        targets[0].doubleAttackThisTurn = true;
        return `${targets[0]?.name || "怪兽"}本回合可以攻击两次`;
    },

    // 支付LP破坏怪兽
    sacrificeDestroy(ctx) {
        const cost = Math.floor(ctx.player.lp * (ctx.value / 100));
        ctx.player.takeDamage(cost);
        const opp = ctx.opponent;
        const targets = [...opp.monsterZone].slice(0, 2);
        targets.forEach(m => destroyMonster(opp, m, ctx.engine));
        return `支付${cost}LP，破坏了${targets.length}只怪兽`;
    },

    // 猜谜游戏（旧版兼容）
    guessGame(ctx) {
        const guess = ctx.engine._random() > 0.5 ? "有刺" : "无刺";
        const aiGuess = ctx.engine._random() > 0.5 ? "有刺" : "无刺";
        if (guess === aiGuess) {
            ctx.engine.drawCard(ctx.player);
            return `对方猜对了（${aiGuess}），发动者抽1张卡`;
        } else {
            const pMonsters = [...ctx.player.monsterZone];
            const oMonsters = [...ctx.opponent.monsterZone];
            pMonsters.forEach(m => destroyMonster(ctx.player, m, ctx.engine));
            oMonsters.forEach(m => destroyMonster(ctx.opponent, m, ctx.engine));
            return `对方猜错了（${aiGuess}，实际是${guess}），双方怪兽区全破坏`;
        }
    },

    // 有刺无刺V2：猜对抽1卡，猜错全场破坏 + 当回合不能特殊召唤
    guessGameV2(ctx) {
        const guess = ctx.engine._random() > 0.5 ? "有刺" : "无刺";
        const aiGuess = ctx.engine._random() > 0.5 ? "有刺" : "无刺";
        let msg;
        if (guess === aiGuess) {
            ctx.engine.drawCard(ctx.player);
            msg = `对方猜对了（${aiGuess}），发动者抽1张卡`;
        } else {
            const pMonsters = [...ctx.player.monsterZone];
            const oMonsters = [...ctx.opponent.monsterZone];
            pMonsters.forEach(m => destroyMonster(ctx.player, m, ctx.engine));
            oMonsters.forEach(m => destroyMonster(ctx.opponent, m, ctx.engine));
            msg = `对方猜错了（${aiGuess}，实际是${guess}），双方怪兽区全破坏`;
        }
        // 当回合不能特殊召唤
        ctx.player.cannotSpecialSummonThisTurn = true;
        return msg + "；当回合不能特殊召唤";
    },

    // 融合召唤
    fusionSummon(ctx) {
        if (!canSpecialSummon(ctx.player)) return "当回合不能特殊召唤";
        // 简化实现：检查手牌或场上是否有两只怪兽，特殊召唤一只高星怪兽
        // 山田凉效果②：融合素材时可用手牌魔法卡代替怪兽素材
        const fieldMonsters = ctx.player.monsterZone.filter(c => c.type === "monster");
        const handMonsters = ctx.player.hand.filter(c => c.type === "monster");
        const handSpells = ctx.player.hand.filter(c => c.type === "spell");
        const hasSpellSubstitute = fieldMonsters.some(c => c.fusionSubstituteSpell) || handMonsters.some(c => c.fusionSubstituteSpell);

        // 如果有融合替代效果，可以用1张魔法卡代替1只怪兽
        const availableMonsters = [...fieldMonsters, ...handMonsters];
        if (hasSpellSubstitute && handSpells.length > 0) {
            // 需要至少1只怪兽 + 1张魔法卡
            if (availableMonsters.length < 1) return "没有怪兽可用于融合";
        } else {
            if (availableMonsters.length < 2) return "场上和手牌怪兽不足2只，无法融合";
        }

        // 从场上选第一只怪兽
        const fuse1 = fieldMonsters[0] || handMonsters[0];
        let fuse2;

        if (hasSpellSubstitute && handSpells.length > 0 && availableMonsters.length < 2) {
            // 用魔法卡代替第二只怪兽
            fuse2 = handSpells[0];
            fuse2._usedAsFusionSubstitute = true;
        } else {
            // 正常融合：第二只怪兽
            fuse2 = (fieldMonsters[1] || fieldMonsters[0] !== fuse1 ? fieldMonsters.find(m => m !== fuse1) : null) || handMonsters[0];
        }

        if (fuse1) {
            const idx = ctx.player.monsterZone.indexOf(fuse1);
            if (idx >= 0) ctx.player.monsterZone.splice(idx, 1);
            else {
                const hidx = ctx.player.hand.indexOf(fuse1);
                if (hidx >= 0) ctx.player.hand.splice(hidx, 1);
            }
        }
        if (fuse2) {
            if (fuse2._usedAsFusionSubstitute) {
                // 魔法卡作为素材送入墓地
                const hidx = ctx.player.hand.indexOf(fuse2);
                if (hidx >= 0) ctx.player.hand.splice(hidx, 1);
                ctx.player.graveyard.push(fuse2);
            } else {
                const idx1 = ctx.player.monsterZone.indexOf(fuse2);
                const idx2 = ctx.player.hand.indexOf(fuse2);
                if (idx1 >= 0) ctx.player.monsterZone.splice(idx1, 1);
                else if (idx2 >= 0) ctx.player.hand.splice(idx2, 1);
            }
        }

        // 合体后的怪兽
        const atk1 = fuse1?.type === "monster" ? (fuse1?.attack || 0) : 0;
        const def1 = fuse1?.type === "monster" ? (fuse1?.defense || 0) : 0;
        const atk2 = fuse2?.type === "monster" ? (fuse2?.attack || 0) : 0;
        const def2 = fuse2?.type === "monster" ? (fuse2?.defense || 0) : 0;
        const fusedAtk = (atk1 + atk2) * 1.5 + (fuse2?._usedAsFusionSubstitute ? 300 : 0);
        const fusedDef = (def1 + def2) * 1.2 + (fuse2?._usedAsFusionSubstitute ? 200 : 0);
        const lv1 = fuse1?.type === "monster" ? (fuse1?.level || 1) : 1;
        const lv2 = fuse2?.type === "monster" ? (fuse2?.level || 1) : 1;
        const fusedLevel = Math.min(12, lv1 + lv2);

        const fusionMonster = {
            id: "fusion_" + Date.now(),
            name: `${fuse1?.name || "?"} & ${fuse2?.name || "?"}`,
            type: "monster",
            attribute: fuse1?.attribute || fuse2?.attribute || "dark",
            race: "warrior",
            level: fusedLevel,
            attack: Math.floor(fusedAtk),
            defense: Math.floor(fusedDef),
            currentAttack: Math.floor(fusedAtk),
            currentDefense: Math.floor(fusedDef),
            rarity: "UR",
            effects: [],
            faceUp: true,
            position: "attack",
            canAttack: !ctx.engine.state.firstTurn,
            hasAttackedThisTurn: false,
            setTurn: ctx.engine.state.turn,
        };

        ctx.player.monsterZone.push(fusionMonster);
        const substituteMsg = fuse2?._usedAsFusionSubstitute ? "（魔法卡作为融合素材）" : "";
        return `融合召唤了${fusionMonster.name}${substituteMsg} (ATK/${fusionMonster.attack} DEF/${fusionMonster.defense})`;
    },
};

export function hasEffectHandler(effectType) {
    return typeof effectHandlers[effectType] === "function";
}

// ======================== 规则引擎 ========================
export class GameEngine {
    constructor(gameState, rng = null) {
        this.state = gameState;
        this.rng = rng; // 可注入的 RNG：PvP 模式下使用 seeded RNG
        this.eventBus = new EventBus();
        this._setupDefaultListeners();
    }

    /** 返回 [0,1) 随机数，PvP 模式下使用同步 RNG */
    _random() {
        if (typeof this.rng === "function") return this.rng();
        if (this.rng && typeof this.rng.next === "function") return this.rng.next();
        return Math.random();
    }

    _setupDefaultListeners() {
        // 默认监听器可以在需要时扩展
    }

    // ---------- 事件系统 ----------
    emit(eventType, data) {
        this.state.logEvent(eventType, data);
        this.eventBus.emit(eventType, { ...data, engine: this, gameState: this.state });
    }

    // ---------- 元素克制 ----------
    getElementBonus() {
        // 游戏王式战斗不使用属性克制倍率，属性仅用于卡牌效果与构筑。
        return 1;
    }

    // ---------- 回合流程 ----------
    startTurn({ skipDraw = false } = {}) {
        this.state.turn++;
        const player = this.state.currentPlayer;
        // 朝比奈真冬效果：回合开始时清除本方怪兽的 attackDisabledUntilEndPhase
        player.monsterZone.forEach(c => {
            if (c.attackDisabledUntilEndPhase) {
                c.attackDisabledUntilEndPhase = false;
                c.cannotAttack = c.attackLocked || false;
                c.canAttack = !c.attackLocked;
            }
        });
        player.resetTurnState();
        // 盖放卡必须经过至少一次回合交换才可以发动。
        for (const owner of this.state.players) {
            owner.spellTrapZone.forEach(card => {
                if (card.faceDown) card.canActivate = card.setTurn < this.state.turn;
            });
        }
        // 场地魔法持续效果：每回合重新应用
        if (player.fieldZone && player.fieldZone.effects) {
            player.fieldSpellDiscardCost = false; // 先清除，由场地效果重新设置
            for (const eff of player.fieldZone.effects) {
                if (eff.trigger === "field" || eff.type?.startsWith("field")) {
                    this._executeEffect(player, player.fieldZone, eff);
                }
            }
        }
        this.state.phase = PHASE.DRAW;
        this.emit("onTurnStart", { player });
        if (skipDraw) return { success: true, skipped: true, message: "先攻首回合跳过抽卡" };
        return this.drawCard(player);
    }

    advancePhase() {
        const order = [PHASE.DRAW, PHASE.STANDBY, PHASE.MAIN_1, PHASE.BATTLE, PHASE.MAIN_2, PHASE.END];
        const idx = order.indexOf(this.state.phase);
        if (idx < order.length - 1) {
            this.state.phase = order[idx + 1];
            if (this.state.phase === PHASE.END) this.endTurn();
        }
    }

    endTurn() {
        this.state.selectedAttacker = null;
        this.state.pendingAction = null;
        this.state.validTargets = [];
        this.state.pendingTribute = null;
        this.state.tributeNeeded = 0;
        this.state.tributeSelected = [];
        this.state.switchPlayer();
        this.state.firstTurn = false;
    }

    drawCard(player) { return player.drawCard(); }

    // ---------- 通常召唤/盖放 ----------
    getTributeNeeded(level) {
        if (level >= 7) return 2;
        if (level >= 5) return 1;
        return 0;
    }

    normalSummon(player, cardIndex, position = "attack", faceDown = false) {
        if (this.state.gameOver) return { success: false, message: "游戏已结束" };
        const summonedThisTurn = player.normalSummonTurn === this.state.turn;
        if (summonedThisTurn && player.additionalNormalSummon <= 0) return { success: false, message: "本回合已进行过通常召唤" };
        if (this.state.phase !== PHASE.MAIN_1 && this.state.phase !== PHASE.MAIN_2) return { success: false, message: "只能在主要阶段召唤" };

        const card = player.hand[cardIndex];
        if (!card) return { success: false, message: "卡牌不存在" };
        if (card.type !== "monster") return { success: false, message: "只能召唤怪兽卡" };
        if (player.monsterZone.length >= GAME_CONFIG.MAX_MONSTER_ZONE) return { success: false, message: "怪兽区已满" };

        const needed = this.getTributeNeeded(card.level);
        if (player.monsterZone.length < needed) return { success: false, message: `需要${needed}只祭品，场上只有${player.monsterZone.length}只` };

        if (needed > 0) {
            this.state.pendingTribute = { player, cardIndex, card, needed, selected: [] };
            this.state.phase = PHASE.TRIBUTE_SELECT;
            this.state.tributeNeeded = needed;
            this.state.tributeSelected = [];
            return { success: true, message: `需要选择${needed}只祭品`, needsTribute: true, tributeNeeded: needed };
        }

        return this._executeSummon(player, cardIndex, position, faceDown);
    }

    selectTribute(card) {
        const pt = this.state.pendingTribute;
        if (!pt) return { success: false, message: "没有待处理的祭品选择" };
        if (card.cannotUseAsMaterial) return { success: false, message: `${card.name}不能用作召唤素材` };
        if (pt.selected.includes(card)) {
            pt.selected = pt.selected.filter(c => c !== card);
            return { success: true, message: `取消选择${card.name}` };
        }
        if (pt.selected.length >= pt.needed) return { success: false, message: "已选满祭品" };
        pt.selected.push(card);
        return { success: true, message: `选择了${card.name} (${pt.selected.length}/${pt.needed})` };
    }

    confirmTribute(position = "attack", faceDown = false) {
        const pt = this.state.pendingTribute;
        if (!pt) return { success: false, message: "没有待处理的祭品选择" };
        if (pt.selected.length !== pt.needed) return { success: false, message: `还需要选择${pt.needed - pt.selected.length}只祭品` };
        for (const tribute of pt.selected) { destroyMonster(pt.player, tribute, this); }
        const wasSetFaceDown = pt.setFaceDown;
        this.state.pendingTribute = null;
        this.state.phase = PHASE.MAIN_1;
        return this._executeSummon(pt.player, pt.cardIndex, wasSetFaceDown ? MONSTER_POSITION.DEFENSE : position, wasSetFaceDown || faceDown);
    }

    cancelTribute() {
        this.state.pendingTribute = null;
        this.state.phase = PHASE.MAIN_1;
        this.state.tributeNeeded = 0;
        this.state.tributeSelected = [];
    }

    _executeSummon(player, cardIndex, position, faceDown) {
        const card = player.hand[cardIndex];
        player.hand.splice(cardIndex, 1);
        card.position = faceDown ? MONSTER_POSITION.DEFENSE : position;
        card.faceUp = !faceDown;
        // 游戏王中通常召唤没有召唤疲劳：除先攻首回合或卡牌限制外，
        // 攻击表示怪兽在召唤当回合即可进入战斗阶段攻击。
        card.canAttack = !faceDown && !this.state.firstTurn && position === MONSTER_POSITION.ATTACK && !player.skipBattlePhase;
        card.hasAttackedThisTurn = false;
        card.setTurn = this.state.turn;
        player.monsterZone.push(card);
        player.normalSummonUsed = true;
        player.normalSummonTurn = this.state.turn;

        let msg = faceDown ? `盖放了${card.name}` : `通常召唤了${card.name}`;
        this.emit("onSummon", { sourceCard: card, sourcePlayer: player, summonedCard: card });

        if (!faceDown) {
            const effResult = this.triggerAllEffects(player, card, "onSummon");
            if (effResult) msg += `，${effResult}`;
        }
        return { success: true, message: msg, card };
    }

    // ---------- 魔法卡发动 ----------
    activateSpell(player, cardIndex, selectedTarget = null) {
        this._lastRevivedCard = null;
        if (this.state.gameOver) return { success: false, message: "游戏已结束" };
        const card = player.hand[cardIndex];
        if (!card || card.type !== "spell") return { success: false, message: "不是魔法卡" };
        if (card.cannotActivateThisTurn) return { success: false, message: `${card.name}本回合不能发动` };
        const inMainPhase = this.state.phase === PHASE.MAIN_1 || this.state.phase === PHASE.MAIN_2;
        const resolvingSelection = selectedTarget && (this.state.phase === PHASE.TARGET_SELECT || this.state.phase === PHASE.GRAVEYARD_SELECT);
        if (!inMainPhase && !resolvingSelection) return { success: false, message: "只能在主要阶段发动魔法" };

        const primaryEffect = card.effect || card.effects?.[0];
        const targetType = this.getEffectTargetType(primaryEffect);
        const requiresTarget = !["none", "enemy_player", "self_player", "both_players"].includes(targetType);
        if (requiresTarget && !selectedTarget) {
            return { success: false, needsTarget: true, message: "请选择合法目标", targetType };
        }
        if (requiresTarget) {
            const validTargets = this.getValidTargets(player, primaryEffect);
            const valid = validTargets.some(target => {
                if (target === selectedTarget) return true;
                if (target?.instanceId && selectedTarget?.instanceId) return target.instanceId === selectedTarget.instanceId;
                return false;
            });
            if (!valid) return { success: false, message: "目标已经失效或不是合法目标" };
        }

        // 检查成本
        if (card.effects) {
            for (const eff of card.effects) {
                if (eff.cost) {
                    const costCheck = this._checkCost(player, eff.cost);
                    if (!costCheck.ok) return { success: false, message: costCheck.reason };
                }
            }
        }

        player.hand.splice(cardIndex, 1);

        // 场地魔法处理：放入场地卡槽，替换旧场地卡
        if (card.isFieldSpell) {
            if (player.fieldZone) {
                player.graveyard.push(player.fieldZone);
            }
            player.fieldZone = card;
            card.faceDown = false;
            const result = this.triggerAllEffects(player, card, "manual");
            return { success: true, message: `发动了场地魔法${card.name}${result ? "，" + result : ""}`, card, isFieldSpell: true };
        }

        const result = selectedTarget
            ? this.triggerEffect(player, card, selectedTarget)
            : this.triggerAllEffects(player, card, "manual");
        player.graveyard.push(card);
        return { success: true, message: `发动了${card.name}${result ? "，" + result : ""}`, card };
    }

    _checkCost(player, cost) {
        if (!cost) return { ok: true };
        switch (cost.type) {
            case "payLife":
                if (player.lp <= cost.value) return { ok: false, reason: `LP不足（需要${cost.value}，当前${player.lp}）` };
                player.takeDamage(cost.value);
                return { ok: true };
            case "discard":
                if (player.hand.length < cost.value) return { ok: false, reason: `手牌不足` };
                for (let i = 0; i < cost.value; i++) {
                    const idx = Math.floor(this._random() * player.hand.length);
                    player.graveyard.push(player.hand.splice(idx, 1)[0]);
                }
                return { ok: true };
            default:
                return { ok: true };
        }
    }

    _checkEffectCondition(player, condition) {
        if (!condition) return true;
        const opponent = player === this.state.currentPlayer ? this.state.opponentPlayer : this.state.currentPlayer;
        if (condition.opponentMinMonsterCount && opponent.monsterZone.length < condition.opponentMinMonsterCount) return false;
        if (condition.opponentMinSpellTrapCount && opponent.spellTrapZone.length < condition.opponentMinSpellTrapCount) return false;
        if (condition.selfMinGraveyardMonsters) {
            const count = player.graveyard.filter(card => card.type === "monster").length;
            if (count < condition.selfMinGraveyardMonsters) return false;
        }
        if (condition.allyMinCount && player.monsterZone.length < condition.allyMinCount) return false;
        return true;
    }

    // ---------- 盖放 ----------
    setCard(player, cardIndex) {
        if (this.state.gameOver) return { success: false, message: "游戏已结束" };
        if (this.state.phase !== PHASE.MAIN_1 && this.state.phase !== PHASE.MAIN_2) return { success: false, message: "只能在主要阶段盖放卡牌" };
        const card = player.hand[cardIndex];
        if (!card) return { success: false, message: "卡牌不存在" };

        if (card.type === "trap" || card.type === "spell") {
            if (player.spellTrapZone.length >= GAME_CONFIG.MAX_SPELL_TRAP_ZONE) return { success: false, message: "魔法陷阱区已满" };
            player.hand.splice(cardIndex, 1);
            card.faceDown = true;
            card.canActivate = false;
            card.setTurn = this.state.turn;
            player.spellTrapZone.push(card);
            return { success: true, message: `盖放了${card.name}`, card };
        }

        // 里侧守备盖放怪兽
        if (card.type === "monster") {
            if (player.monsterZone.length >= GAME_CONFIG.MAX_MONSTER_ZONE) return { success: false, message: "怪兽区已满" };
            const summonedThisTurn = player.normalSummonTurn === this.state.turn;
            if (summonedThisTurn && player.additionalNormalSummon <= 0) return { success: false, message: "本回合已进行过通常召唤" };

            const needed = this.getTributeNeeded(card.level);
            if (player.monsterZone.length < needed) return { success: false, message: `需要${needed}只祭品，场上只有${player.monsterZone.length}只` };

            if (needed > 0) {
                this.state.pendingTribute = { player, cardIndex, card, needed, selected: [], setFaceDown: true };
                this.state.phase = PHASE.TRIBUTE_SELECT;
                this.state.tributeNeeded = needed;
                this.state.tributeSelected = [];
                return { success: true, message: `需要选择${needed}只祭品`, needsTribute: true, tributeNeeded: needed };
            }

            return this._executeSummon(player, cardIndex, MONSTER_POSITION.DEFENSE, true);
        }

        return { success: false, message: "只能盖放魔法、陷阱或怪兽卡" };
    }

    canActivateSetSpell(player, card) {
        if (!card || card.type !== "spell" || !card.faceDown) return { canActivate: false, reason: "这不是盖放的魔法卡" };
        if (!player.spellTrapZone.includes(card)) return { canActivate: false, reason: "该魔法卡不在你的后场" };
        if (card.setTurn >= this.state.turn) return { canActivate: false, reason: "盖放魔法要到下个自己的回合才能发动" };
        if (this.state.currentPlayer !== player) return { canActivate: false, reason: "普通魔法只能在自己的回合发动" };
        if (this.state.phase !== PHASE.MAIN_1 && this.state.phase !== PHASE.MAIN_2) {
            return { canActivate: false, reason: "普通魔法只能在主要阶段发动" };
        }
        const effect = card.effect || card.effects?.[0];
        const targetType = this.getEffectTargetType(effect);
        if (!["none", "enemy_player", "self_player", "both_players"].includes(targetType)
            && this.getValidTargets(player, effect).length === 0) {
            return { canActivate: false, reason: "没有合法目标" };
        }
        return { canActivate: true, reason: "" };
    }

    activateSetSpell(player, card, selectedTarget = null) {
        const check = this.canActivateSetSpell(player, card);
        if (!check.canActivate) return { success: false, message: check.reason };
        const effect = card.effect || card.effects?.[0];
        const targetType = this.getEffectTargetType(effect);
        const requiresTarget = !["none", "enemy_player", "self_player", "both_players"].includes(targetType);
        if (requiresTarget && !selectedTarget) return { success: false, needsTarget: true, targetType, message: "请选择合法目标" };
        if (requiresTarget && !this.getValidTargets(player, effect)
            .some(target => target === selectedTarget || target.instanceId === selectedTarget?.instanceId)) {
            return { success: false, message: "目标已经失效或不是合法目标" };
        }
        const index = player.spellTrapZone.indexOf(card);
        if (index < 0) return { success: false, message: "盖放魔法已经不在场上" };
        player.spellTrapZone.splice(index, 1);
        card.faceDown = false;
        card.canActivate = false;
        if (card.isFieldSpell) {
            if (player.fieldZone) player.graveyard.push(player.fieldZone);
            player.fieldZone = card;
            const fieldMessage = this.triggerAllEffects(player, card, "manual");
            return { success: true, message: `翻开发动场地魔法${card.name}${fieldMessage ? `：${fieldMessage}` : ""}`, card, isFieldSpell: true };
        }
        const effectMessage = selectedTarget
            ? this.triggerEffect(player, card, selectedTarget)
            : this.triggerAllEffects(player, card, "manual");
        player.graveyard.push(card);
        return { success: true, message: `发动了${card.name}：${effectMessage}`, card };
    }

    // ---------- 翻转召唤 ----------
    flipSummon(player, card) {
        if (this.state.gameOver) return { success: false, message: "游戏已结束" };
        if (this.state.phase !== PHASE.MAIN_1 && this.state.phase !== PHASE.MAIN_2) return { success: false, message: "只能在主要阶段翻转召唤" };
        if (!card) return { success: false, message: "没有选择怪兽" };
        if (card.faceUp) return { success: false, message: "该怪兽已经是表侧表示" };
        if (card.position !== MONSTER_POSITION.DEFENSE) return { success: false, message: "只能翻转里侧守备表示的怪兽" };
        if (card.setTurn === this.state.turn) return { success: false, message: "本回合盖放的怪兽不能翻转召唤" };

        const idx = player.monsterZone.indexOf(card);
        if (idx === -1) return { success: false, message: "该怪兽不在场上" };

        // 翻转召唤：里侧→表侧守备，不占通常召唤次数
        card.faceUp = true;
        card.faceDown = false;
        card.wasFlipSummoned = true;
        card.positionChangedThisTurn = true;

        let msg = `翻转召唤了${card.name}`;
        // 触发翻转效果
        const flipResult = this.triggerAllEffects(player, card, "onFlip");
        if (flipResult) msg += `，${flipResult}`;

        this.emit("onSummon", { sourceCard: card, sourcePlayer: player, summonedCard: card, isFlipSummon: true });
        return { success: true, message: msg, card };
    }

    // ---------- 手动攻守转换 ----------
    changePosition(player, card) {
        if (this.state.gameOver) return { success: false, message: "游戏已结束" };
        if (this.state.phase !== PHASE.MAIN_1 && this.state.phase !== PHASE.MAIN_2) return { success: false, message: "只能在主要阶段转换姿态" };
        if (!card) return { success: false, message: "没有选择怪兽" };
        if (!card.faceUp) return { success: false, message: "里侧怪兽不能手动转换姿态" };
        if (card.positionChangedThisTurn) return { success: false, message: "该怪兽本回合已经转换过姿态" };
        if (card.hasAttackedThisTurn) return { success: false, message: "已经攻击过的怪兽本回合不能转换姿态" };

        // 场地魔法效果：变守备表示需丢1手牌
        const isSwitchingToDefense = card.position === MONSTER_POSITION.ATTACK;
        const opponent = player === this.state.currentPlayer ? this.state.opponentPlayer : this.state.currentPlayer;
        if (isSwitchingToDefense && opponent.fieldSpellDiscardCost) {
            if (player.hand.length === 0) return { success: false, message: "场地魔法效果：变守备表示需丢弃1张手牌，但手牌不足" };
            const discarded = player.hand.pop();
            player.graveyard.push(discarded);
        }

        const idx = player.monsterZone.indexOf(card);
        if (idx === -1) return { success: false, message: "该怪兽不在场上" };

        const oldPos = card.position;
        card.position = oldPos === MONSTER_POSITION.ATTACK ? MONSTER_POSITION.DEFENSE : MONSTER_POSITION.ATTACK;
        card.positionChangedThisTurn = true;

        // 转换后不能攻击（如果变成守备表示）
        if (card.position === MONSTER_POSITION.DEFENSE) {
            card.canAttack = false;
        }

        const posName = card.position === MONSTER_POSITION.ATTACK ? "攻击表示" : "守备表示";
        let msg = `${card.name}变为${posName}`;
        if (isSwitchingToDefense && opponent.fieldSpellDiscardCost) {
            msg += "（场地魔法效果：丢弃1张手牌）";
        }
        return { success: true, message: msg, card };
    }

    // ---------- 效果处理 ----------
    triggerAllEffects(player, card, triggerType) {
        const effects = card.effects || [];
        if (effects.length === 0 && card.effect) {
            // 兼容旧 effect 字段
            return this._triggerLegacyEffect(player, card);
        }

        let combinedMsg = "";
        for (const eff of effects) {
            if (eff.trigger && eff.trigger !== triggerType) continue;

            if (!this._checkEffectCondition(player, eff.condition)) continue;

            // 检查一回合一次
            if (eff.oncePerTurn || eff.limit?.oncePerTurn) {
                if (card.oncePerTurnUsed) continue;
            }

            // 检查 phase 限制
            if (eff.limit?.phase && !eff.limit.phase.includes(this.state.phase)) continue;

            // 检查是否只在自己回合
            if (eff.limit?.onlyDuringOwnTurn && player !== this.state.currentPlayer) continue;

            // 怪兽主动技能在这里支付代价；魔法卡代价已在发动流程统一支付。
            if (triggerType === "manual" && card.type === "monster" && eff.cost) {
                const costCheck = this._checkCost(player, eff.cost);
                if (!costCheck.ok) continue;
            }

            if (eff.oncePerTurn || eff.limit?.oncePerTurn) card.oncePerTurnUsed = true;

            // 执行效果
            const result = this._executeEffect(player, card, eff);
            if (result) combinedMsg += (combinedMsg ? "，" : "") + result;
        }
        return combinedMsg || null;
    }

    _executeEffect(player, card, eff, selectedTarget = null) {
        const opp = player === this.state.currentPlayer ? this.state.opponentPlayer : this.state.currentPlayer;

        // 检查效果处理器是否存在
        const handler = effectHandlers[eff.type];
        if (!handler) return null;

        // 构建上下文。玩家手动选择的目标优先于数据中的自动选择器。
        const targetSpec = eff.target;
        let targets = selectedTarget ? [selectedTarget] : [];
        if (!selectedTarget && targetSpec) {
            targets = resolveTargets(this, player, targetSpec);
        }

        const ctx = {
            gameState: this.state,
            player,
            opponent: opp,
            sourcePlayer: player,
            sourceCard: card,
            card,
            target: targets[0] || null,
            targets,
            value: eff.value || 0,
            event: eff.trigger || "manual",
            engine: this,
            targetSpec,
            duration: eff.duration,
            effect: eff,
        };

        // 宫崎奏效果②：对方回合对方发动效果时，数值增减减半；非数值效果则对方丢1张手牌
        const isOpponentTurn = player === this.state.opponentPlayer;
        if (isOpponentTurn && eff.type !== "effectDisruptor" && eff.type !== "recycleWaterAndProtect" && eff.type !== "buffAllyOnDestroy") {
            const disruptor = this.state.currentPlayer.monsterZone.find(m => m.effectDisruptor);
            if (disruptor && !disruptor._disruptionUsedThisTurn) {
                const statEffectTypes = [
                    "buffSelfAttack", "buffSelfDefense", "debuffEnemyAttack", "debuffAllEnemyAttack",
                    "buffAllAlliesAttack", "damageAllEnemyMonsters", "modifyStat", "damageTarget",
                    "damageAndHeal", "directDamage", "lifesteal", "healPlayer", "healAllAllies",
                ];
                const isStatEffect = statEffectTypes.includes(eff.type);
                if (!isStatEffect) {
                    // 非数值效果：执行后让对方丢1张手牌
                    const result = handler(ctx);
                    if (player.hand.length > 0) {
                        const discarded = player.hand.pop();
                        player.graveyard.push(discarded);
                        disruptor._disruptionUsedThisTurn = true;
                        return (result ? result + "，" : "") + `${player.name}被干扰丢弃了${discarded.name || "1张手牌"}`;
                    }
                    return result;
                }
                // 数值增减减半
                ctx.value = Math.floor(ctx.value / 2);
                ctx._disrupted = true;
                disruptor._disruptionUsedThisTurn = true;
            }
        }

        return handler(ctx);
    }

    _triggerLegacyEffect(player, card) {
        const eff = card.effect;
        if (!eff) return null;
        const opp = player === this.state.currentPlayer ? this.state.opponentPlayer : this.state.currentPlayer;
        const handler = effectHandlers[eff.type];
        if (!handler) return null;
        const ctx = { gameState: this.state, player, opponent: opp, sourcePlayer: player, sourceCard: card, card, target: null, targets: [], value: eff.value || 0, event: eff.trigger || "manual", engine: this, targetSpec: null, duration: null };
        return handler(ctx);
    }

    triggerEffect(player, card, selectedTarget = null) {
        if (card.effects && card.effects.length > 0) {
            // 新 effects 数组
            let combinedMsg = "";
            for (const eff of card.effects) {
                if (eff.oncePerTurn || eff.limit?.oncePerTurn) {
                    if (card.oncePerTurnUsed) continue;
                    card.oncePerTurnUsed = true;
                }
                const result = this._executeEffect(player, card, eff, selectedTarget);
                if (result) combinedMsg += (combinedMsg ? "，" : "") + result;
            }
            return combinedMsg || null;
        }
        return this._triggerLegacyEffect(player, card);
    }

    // ---------- 兼容旧的 getEffectTargetType ----------
    getEffectTargetType(effect) {
        if (!effect) return "none";
        const map = { damageTarget: "enemy_monster_or_player", destroyTarget: "enemy_monster", reviveToHand: "graveyard", recoverMonster: "graveyard", destroySpellTrap: "enemy_spell_trap", damageAndHeal: "enemy_monster_or_player", damageAllEnemyMonsters: "none", destroyAllEnemyMonsters: "none", buffSelfAttack: "none", buffSelfDefense: "none", healPlayer: "none", drawCards: "none", debuffEnemyAttack: "enemy_monster", debuffEnemyDefense: "enemy_monster", debuffAllEnemyAttack: "none", buffAllAlliesAttack: "none", directDamage: "enemy_player", damageBothPlayers: "none", reflectDamage: "none", counterAndDamage: "none", reduceDamage: "none", destroyAttacker: "none", lifesteal: "none", healAllAllies: "none", priorityTarget: "none", conditionalBuff: "none", searchWaterMonster: "none", targetProtect: "none", switchDefenseRedirect: "none", bounceBackrow: "none", recycleWaterAndProtect: "none", effectDisruptor: "none", buffAllyOnDestroy: "none", lockAttack: "none", fieldWaterBuff: "none", fieldOceanScene: "none", reviveRecentGraveyardV2: "none", recoverAndDrawV2: "none", healDrawNoSpecial: "none", discardAndDraw: "none", mutualHandRefresh: "none", guessGameV2: "none", recycleSpellDraw: "none", fusionSubstituteSpell: "none", searchSpellByDiscard: "none", discardToDisableAttack: "enemy_monster", gameThroneDraw: "none", cancelAttackAndReturn: "enemy_monster", preventDestructionByBanish: "none", trapStackAndRecover: "none", temporaryBanish: "enemy_monster", negateCounterEffect: "enemy_monster_or_player" };
        if (effect.type === "specialSummonFromGraveyard") return "graveyard";
        return map[effect.type] || "none";
    }

    getValidTargets(player, effect) {
        const tt = this.getEffectTargetType(effect);
        const opp = player === this.state.currentPlayer ? this.state.opponentPlayer : this.state.currentPlayer;
        switch (tt) {
            case "enemy_monster": return [...opp.monsterZone].filter(m => !m.cannotBeTargeted);
            case "enemy_monster_or_player": return [...opp.monsterZone.filter(m => !m.cannotBeTargeted), { instanceId: "player_" + opp.name, isPlayer: true, name: opp.name, currentDefense: opp.lp }];
            case "self_monster": return [...player.monsterZone];
            case "graveyard": return player.graveyard.filter(c => c.type === "monster");
            case "enemy_spell_trap": return [...opp.spellTrapZone];
            default: return [];
        }
    }

    canPlayEffect(player, card) {
        if (!card.effect && (!card.effects || card.effects.length === 0)) return { canPlay: true, reason: "" };
        const tt = this.getEffectTargetType(card.effect || (card.effects && card.effects[0]));
        if (tt === "none" || tt === "enemy_player" || tt === "self_player" || tt === "both_players") return { canPlay: true, reason: "" };
        const targets = this.getValidTargets(player, card.effect || (card.effects && card.effects[0]));
        return targets.length > 0 ? { canPlay: true, reason: "" } : { canPlay: false, reason: "没有合法目标" };
    }

    // ---------- 攻击 ----------
    getEffectiveAttack(monster) {
        if (monster.position === MONSTER_POSITION.DEFENSE) return 0;
        if (monster.cannotAttack) return 0;
        return monster.currentAttack;
    }

    getEffectiveDefense(monster) { return monster.currentDefense; }

    _resolveBattleTrap(attacker, target, attackerOwner, defenderOwner) {
        const trap = defenderOwner.spellTrapZone.find(card => card.type === "trap" && card.faceDown && card.canActivate);
        if (!trap) return { canceled: false, reduction: 0, message: "" };
        const effect = trap.effects?.[0] || trap.effect || {};
        const idx = defenderOwner.spellTrapZone.indexOf(trap);
        if (idx >= 0) defenderOwner.spellTrapZone.splice(idx, 1);
        trap.faceDown = false;
        trap.canActivate = false;
        defenderOwner.graveyard.push(trap);
        const prefix = `${defenderOwner.name}发动陷阱【${trap.name}】`;
        // 保留陷阱卡完整数据供动画使用
        this._lastActivatedTrap = trap;
        switch (effect.type) {
            case "reduceDamage":
                return { canceled: false, reduction: Math.max(0, Number(effect.value) || 0), message: `${prefix}，本次战斗伤害减少${Math.max(0, Number(effect.value) || 0)}` };
            case "returnToHand": {
                const mi = attackerOwner.monsterZone.indexOf(attacker);
                if (mi >= 0) attackerOwner.monsterZone.splice(mi, 1);
                resetCardState(attacker);
                attackerOwner.hand.push(attacker);
                return { canceled: true, reduction: 0, message: `${prefix}，${attacker.name}返回手牌，攻击无效` };
            }
            case "cannotAttack":
                attackerOwner.monsterZone.forEach(card => { card.cannotAttack = true; card.canAttack = false; });
                return { canceled: true, reduction: 0, message: `${prefix}，对方怪兽本回合不能攻击` };
            case "reflectDamage": {
                const reflected = Math.max(0, this.getEffectiveAttack(attacker));
                attackerOwner.takeDamage(reflected);
                return { canceled: true, reduction: 0, message: `${prefix}，攻击无效并反弹${reflected}点伤害` };
            }
            case "counterDestroy":
            case "destroyAttacker": {
                destroyMonster(attackerOwner, attacker, this);
                if (hasResonance(defenderOwner, 2)) attackerOwner.takeDamage(500);
                return { canceled: true, reduction: 0, message: `${prefix}，攻击怪兽被破坏${hasResonance(defenderOwner, 2) ? "，共鸣追加500点伤害" : ""}` };
            }
            case "buffSelfAttack":
                defenderOwner.monsterZone.forEach(card => {
                    card.currentAttack = safe(card.currentAttack + (Number(effect.value) || 0));
                });
                return { canceled: false, reduction: 0, message: `${prefix}，己方怪兽攻击力上升${Number(effect.value) || 0}` };
            case "buffSelfDefense":
                defenderOwner.monsterZone.forEach(card => {
                    card.currentDefense = safe(card.currentDefense + (Number(effect.value) || 0));
                });
                return { canceled: false, reduction: 0, message: `${prefix}，己方怪兽守备力上升${Number(effect.value) || 0}` };
            case "healPlayer":
                defenderOwner.heal(Number(effect.value) || 0);
                return { canceled: false, reduction: 0, message: `${prefix}，回复${Number(effect.value) || 0}LP` };
            case "directDamage":
                attackerOwner.takeDamage(Number(effect.value) || 0);
                return { canceled: false, reduction: 0, message: `${prefix}，给予对方${Number(effect.value) || 0}点伤害` };
            default:
                return { canceled: false, reduction: 0, message: `${prefix}` };
        }
    }

    discardToEndLimit(player, selectedInstanceIds = null) {
        return player.discardToLimit(GAME_CONFIG.END_HAND_LIMIT, selectedInstanceIds);
    }

    attack(attacker, target) {
        if (this.state.gameOver) return { success: false, message: "游戏已结束" };
        if (!attacker.canAttack || attacker.hasAttackedThisTurn) return { success: false, message: "该怪兽本回合不能攻击" };
        if (attacker.position === MONSTER_POSITION.DEFENSE) return { success: false, message: "守备表示怪兽不能攻击" };
        if (attacker.cannotAttack) return { success: false, message: "该怪兽不能攻击" };
        if (this.state.firstTurn && GAME_CONFIG.FIRST_TURN_NO_BATTLE) return { success: false, message: "先攻第一回合不能攻击" };

        // 放学后的茶会效果：当回合不能直接攻击玩家
        const attackerOwner = this.state.currentPlayer;
        if (target === "player" && attackerOwner.noDirectAttackThisTurn) {
            return { success: false, message: "场地魔法效果：当回合不能直接攻击玩家" };
        }

        // 效果①优先攻击限制：如果目标有priorityTarget，且对方场上有其他怪兽，则必须先攻击其他怪兽
        if (target && target !== "player" && target.priorityTarget) {
            const defenderOwner = this.state.opponentPlayer;
            const otherMonsters = defenderOwner.monsterZone.filter(m => m !== target && m.faceUp);
            if (otherMonsters.length > 0) {
                return { success: false, message: `${target.name}受优先攻击保护，必须先攻击其他怪兽` };
            }
        }

        // 里间雨效果②：攻击重定向 —— 切换守备表示，强制攻击其他怪兽
        if (target && target !== "player" && target.attackRedirector && !target._redirectUsedThisTurn) {
            const defenderOwner = this.state.opponentPlayer;
            // 切换为守备表示
            target.position = MONSTER_POSITION.DEFENSE;
            target._redirectUsedThisTurn = true;
            // 找其他可被攻击的怪兽
            const otherMonsters = defenderOwner.monsterZone.filter(m => m !== target && m.faceUp);
            if (otherMonsters.length > 0) {
                // 强制攻击第一个其他怪兽
                const redirectTarget = otherMonsters[0];
                return { success: false, message: `${target.name}切换为守备表示，${attacker.name}必须攻击${redirectTarget.name}`, redirect: redirectTarget };
            } else {
                // 没有其他怪兽，守备力永久+400
                target.currentDefense = safe(target.currentDefense + (target.redirectValue || 400));
                target.permanentBuffs.push({ type: "defense", value: target.redirectValue || 400, source: "switchDefenseRedirect" });
                return { success: false, message: `${target.name}切换为守备表示，守备力上升${target.redirectValue || 400}` };
            }
        }

        const defenderOwner = this.state.opponentPlayer;
        const trapResult = this._resolveBattleTrap(attacker, target, attackerOwner, defenderOwner);
        if (trapResult.canceled) {
            if (attackerOwner.monsterZone.includes(attacker)) {
                attacker.canAttack = false;
                attacker.hasAttackedThisTurn = true;
            }
            return { success: true, message: trapResult.message, trap: true, trapCard: this._lastActivatedTrap, attackCanceled: true };
        }
        const reduction = trapResult.reduction || 0;
        const trapPrefix = trapResult.message ? `${trapResult.message}；` : "";
        const trapInfo = trapResult.message
            ? { trap: true, trapCard: this._lastActivatedTrap }
            : {};

        if (target === "player") {
            if (defenderOwner.monsterZone.length > 0) return { success: false, message: "对方场上有怪兽时不能直接攻击" };
            const rawDamage = this.getEffectiveAttack(attacker);
            const damage = Math.max(0, rawDamage - reduction);
            defenderOwner.takeDamage(damage);
            attacker.canAttack = false;
            attacker.hasAttackedThisTurn = true;
            this.emit("onBattleDamage", { attacker, damage, target: "player" });
            return { success: true, message: `${trapPrefix}${attacker.name}直接攻击，造成${damage}点伤害`, ...trapInfo };
        }

        const atkPower = Math.max(0, attacker.currentAttack || 0);
        let msg = `${trapPrefix}${attacker.name}攻击${target.name}`;

        if (target.position === MONSTER_POSITION.DEFENSE || !target.faceUp) {
            if (!target.faceUp) {
                target.faceUp = true;
                target.faceDown = false;
                msg += "，目标翻开为守备表示";
                const flipResult = this.triggerAllEffects(defenderOwner, target, "onFlip");
                if (flipResult) msg += `，${flipResult}`;
            }
            const defPower = this.getEffectiveDefense(target);
            if (target.cannotBeDestroyedByBattle && atkPower >= defPower) {
                attacker.canAttack = false;
                attacker.hasAttackedThisTurn = true;
                return { success: true, message: `${msg}，${target.name}不受战斗破坏`, ...trapInfo };
            }
            if (atkPower > defPower) {
                destroyMonster(defenderOwner, target, this);
                const hasPiercing = attacker.piercingDamage || attacker.effects?.some(effect => effect.type === "piercingDamage");
                const damage = hasPiercing ? Math.max(0, atkPower - defPower - reduction) : 0;
                if (damage > 0) defenderOwner.takeDamage(damage);
                msg += `，守备怪兽被破坏${damage > 0 ? `，贯穿造成${damage}点伤害` : ""}`;
            } else if (atkPower === defPower) {
                msg += "，攻击力等于守备力，均不破坏且不受伤害";
            } else {
                const damage = Math.max(0, defPower - atkPower - reduction);
                attackerOwner.takeDamage(damage);
                msg += `，攻击方受到${damage}点战斗伤害`;
            }
        } else {
            const defPower = Math.max(0, target.currentAttack || 0);
            if (target.cannotBeDestroyedByBattle && atkPower >= defPower) {
                attacker.canAttack = false;
                attacker.hasAttackedThisTurn = true;
                return { success: true, message: `${msg}，${target.name}不受战斗破坏`, ...trapInfo };
            }
            if (atkPower > defPower) {
                const damage = Math.max(0, atkPower - defPower - reduction);
                defenderOwner.takeDamage(damage);
                destroyMonster(defenderOwner, target, this);
                msg += `，${target.name}被破坏，对方受到${damage}点战斗伤害`;
            } else if (atkPower === defPower) {
                destroyMonster(attackerOwner, attacker, this);
                destroyMonster(defenderOwner, target, this);
                msg += "，攻击力相同，双方怪兽都被破坏";
            } else {
                const damage = Math.max(0, defPower - atkPower - reduction);
                destroyMonster(attackerOwner, attacker, this);
                attackerOwner.takeDamage(damage);
                msg += `，${attacker.name}被破坏，攻击方受到${damage}点战斗伤害`;
            }
        }

        if (attackerOwner.monsterZone.includes(attacker)) {
            attacker.canAttack = false;
            attacker.hasAttackedThisTurn = true;
        }
        this.emit("onBattleDamage", { attacker, target, damage: atkPower });
        return { success: true, message: msg, ...trapInfo };
    }

    // ---------- 游戏结束 ----------
    checkSpecialVictory(player) {
        // 通用“五件套”特殊胜利接口。卡牌数据只要声明：
        // specialWinSet、specialWinPiece、specialWinRequired（默认5），
        // 手牌集齐同一套装的不同部件即可获胜。当前卡池未强行加入仿制卡。
        const sets = new Map();
        for (const card of player.hand) {
            if (!card?.specialWinSet || !card?.specialWinPiece) continue;
            const entry = sets.get(card.specialWinSet) || { pieces: new Set(), required: Number(card.specialWinRequired) || 5 };
            entry.pieces.add(card.specialWinPiece);
            entry.required = Number(card.specialWinRequired) || entry.required;
            sets.set(card.specialWinSet, entry);
        }
        for (const [setId, entry] of sets) {
            if (entry.pieces.size >= entry.required) return { success: true, setId, required: entry.required };
        }
        return { success: false };
    }

    checkGameOver() {
        if (this.state.gameOver) return true;

        const special0 = this.checkSpecialVictory(this.state.players[0]);
        const special1 = this.checkSpecialVictory(this.state.players[1]);
        if (special0.success || special1.success) {
            if (special0.success && special1.success) {
                this.state.winner = null;
                this.state.isDraw = true;
                this.state.winReason = "双方同时达成特殊胜利条件";
            } else {
                this.state.winner = special0.success ? 0 : 1;
                this.state.isDraw = false;
                this.state.winReason = `集齐特殊胜利套装（${(special0.success ? special0 : special1).required}个部件）`;
            }
            this.state.gameOver = true;
            return true;
        }

        const p0Dead = this.state.players[0].lp <= 0 || this.state.players[0].deckOut;
        const p1Dead = this.state.players[1].lp <= 0 || this.state.players[1].deckOut;
        if (p0Dead && p1Dead) { this.state.winner = null; this.state.isDraw = true; this.state.winReason = "双方同时满足败北条件"; this.state.gameOver = true; return true; }
        if (p0Dead) { this.state.winner = 1; this.state.winReason = this.state.players[0].deckOut ? "无牌可抽" : "LP归零"; this.state.gameOver = true; return true; }
        if (p1Dead) { this.state.winner = 0; this.state.winReason = this.state.players[1].deckOut ? "无牌可抽" : "LP归零"; this.state.gameOver = true; return true; }
        return false;
    }

    checkStateIntegrity() {
        const issues = []; const seen = new Set();
        for (const p of this.state.players) {
            if (!Number.isFinite(p.lp)) issues.push(`${p.name} LP无效: ${p.lp}`);
            if (p.monsterZone.length > GAME_CONFIG.MAX_MONSTER_ZONE) issues.push(`${p.name} 怪兽区超限`);
            if (p.spellTrapZone.length > GAME_CONFIG.MAX_SPELL_TRAP_ZONE) issues.push(`${p.name} 魔法陷阱区超限`);
            for (const zone of [{ n: "deck", c: p.deck }, { n: "hand", c: p.hand }, { n: "monster", c: p.monsterZone }, { n: "spellTrap", c: p.spellTrapZone }, { n: "graveyard", c: p.graveyard }]) {
                for (const card of zone.c) {
                    if (seen.has(card.instanceId)) issues.push(`${card.name} 跨区域重复`);
                    seen.add(card.instanceId);
                }
            }
        }
        if (issues.length > 0) console.error("=== 状态检查 ===", issues);
        return issues;
    }
}

const ELEMENT_NAMES_MAP = { fire: "火", water: "水", wind: "风", earth: "地", light: "光", dark: "暗" };
