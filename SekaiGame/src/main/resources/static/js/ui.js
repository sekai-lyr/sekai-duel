/**
 * ui.js
 * 界面层 —— 次元决斗：元素召唤
 */

import { ELEMENT_ICONS, ELEMENT_NAMES, RACE_NAMES } from "./cards.js";
import { ALL_CARDS } from "./catalog.js";
import { PHASE, GAME_CONFIG, MONSTER_POSITION } from "./constants.js";
import { addFoilShimmer } from "./effects.js";
import { cardEffectFieldsHtml } from "./card-view.js?v=1.1.0";

function cardImageHTML(card, size) {
    const attr = card.attribute || card.element || "none";
    const icon = ELEMENT_ICONS[attr] || "?";
    const letter = card.name ? card.name[0] : "?";
    const colors = { fire: ["#1a0505", "#8b1a1a"], water: ["#050a1a", "#1a3d8b"], wind: ["#051a0a", "#1a8b3d"], earth: ["#1a1005", "#8b5a1a"], light: ["#1a1a05", "#8b8b1a"], dark: ["#0a051a", "#3d1a8b"], none: ["#111", "#333"] };
    const [c1, c2] = colors[attr] || colors.none;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 120 120"><defs><linearGradient id="bg_${card.instanceId || card.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="120" height="120" fill="url(#bg_${card.instanceId || card.id})" rx="8"/><text x="60" y="45" text-anchor="middle" font-size="32">${icon}</text><text x="60" y="85" text-anchor="middle" font-size="18" fill="rgba(255,255,255,0.9)" font-weight="bold">${letter}</text></svg>`;
}

function escapeAttr(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function getCardImageHTML(card, size = 120) {
    const img = card.thumbnail || card.image;
    const position = escapeAttr(card.objectPosition || "center");
    if (img) return `<img src="${escapeAttr(img)}" alt="${escapeAttr(card.name)}" class="card-img" loading="eager" decoding="async" style="width:100%;height:100%;object-fit:cover;object-position:${position}"><div class="card-img-fallback" style="display:none;width:100%;height:100%">${cardImageHTML(card, size)}</div>`;
    return `<div class="card-img-fallback" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">${cardImageHTML(card, size)}</div>`;
}

const PHASE_NAMES = { waiting: "等待", draw: "抽卡阶段", standby: "准备阶段", main_1: "主要阶段1", battle: "战斗阶段", main_2: "主要阶段2", end: "结束阶段", target_select: "选择目标", graveyard_select: "选择墓地", tribute_select: "选择祭品" };
const PHASE_ORDER = ["draw", "standby", "main_1", "battle", "main_2", "end"];

export class GameUI {
    constructor() {
        this.menuScreen = document.querySelector("#app-shell");
        this.battleScreen = document.querySelector("#battle-screen");
        this.handElement = document.querySelector("#hand");
        this.opponentHandElement = document.querySelector("#opponent-hand");
        this.battlefield = document.querySelector("#battlefield");
        this.turnBadge = document.querySelector("#turn-badge");
        this.logBody = document.querySelector("#log-body");
        this.playerDeckCount = document.querySelector("#player-deck-count");
        this.opponentDeckCount = document.querySelector("#opponent-deck-count");
        this.playerGraveyardCount = document.querySelector("#player-graveyard-count");
        this.opponentGraveyardCount = document.querySelector("#opponent-graveyard-count");
        this.visibleHandCount = document.querySelector("#visible-hand-count");
        this.drawBanner = document.querySelector("#draw-banner");
        this.drawBannerLabel = document.querySelector("#draw-banner-label");
        this.drawBannerName = document.querySelector("#draw-banner-name");
        this.drawTimer = null;
        this.floatContainer = document.createElement("div");
        this.floatContainer.className = "float-container";
        document.body.appendChild(this.floatContainer);
        this._createHandoffOverlay();
        this._createGraveyardOverlay();
        this._createTributeOverlay();
        this._createCardActionOverlay();
        this._createFirstPlayerOverlay();
        this._createDiscardOverlay();
        this._bindDetailOverlay();
        this._bindImageFallbacks();
        this._initArenaEffects();
        this._logEntries = [];
        this._createLogFullscreen();
    }

    _createLogFullscreen() {
        this.logFullscreen = document.createElement("div");
        this.logFullscreen.className = "log-fullscreen";
        this.logFullscreen.innerHTML = `
            <div class="log-fullscreen-header">
                <h2>DUEL LOG</h2>
                <button class="log-fullscreen-close" id="log-fullscreen-close" type="button" aria-label="关闭">×</button>
            </div>
            <div class="log-fullscreen-body" id="log-fullscreen-body"></div>`;
        document.body.appendChild(this.logFullscreen);
        this.logFullscreen.querySelector("#log-fullscreen-close").addEventListener("click", () => this.closeLogFullscreen());
        this.logFullscreen.addEventListener("click", e => { if (e.target === this.logFullscreen) this.closeLogFullscreen(); });
        // 点击迷你日志面板 → 打开全屏
        const logPanel = document.querySelector(".log-panel");
        if (logPanel) logPanel.addEventListener("click", () => this.openLogFullscreen());
    }

    openLogFullscreen() {
        const body = this.logFullscreen.querySelector("#log-fullscreen-body");
        body.innerHTML = "";
        for (const entry of this._logEntries) {
            const el = document.createElement("div");
            el.className = `log-entry-v2${entry.card ? " has-card" : ""}`;
            let thumbHtml = `<div class="log-thumb-placeholder">◆</div>`;
            const cardMatch = entry.msg.match(/【(.+?)】/) || entry.msg.match(/「(.+?)」/);
            const card = entry.card || (cardMatch ? ALL_CARDS?.find(item => item.name === cardMatch[1]) : null);
            if (card?.image) {
                thumbHtml = `<img src="${this._esc(card.image)}" alt="${this._esc(card.name)}" loading="lazy">`;
            }
            const stats = card?.type === "monster"
                ? `<span>★${Number(card.level || 0)}</span><span>ATK ${Number(card.attack || 0)}</span><span>DEF ${Number(card.defense || 0)}</span>`
                : "";
            const effectTexts = card
                ? [...new Set([card.description, ...(card.effects || []).map(effect => effect?.description)].filter(Boolean))]
                : [];
            const detailsHtml = card ? `
                <div class="log-card-details">
                    <div class="log-card-heading">
                        <strong>${this._esc(card.name)}</strong>
                        <span>${this._esc((card.rarity || "N").toUpperCase())} · ${this._esc(card.type || "card")}</span>
                        ${entry.private ? `<em>仅自己可见</em>` : ""}
                    </div>
                    ${stats ? `<div class="log-card-stats">${stats}</div>` : ""}
                    <div class="log-card-effects">${effectTexts.length
                        ? effectTexts.map(text => `<p>${this._esc(text)}</p>`).join("")
                        : "<p>无额外效果说明</p>"}</div>
                    <div class="log-expand-hint">点击收起卡牌详情</div>
                </div>` : "";
            el.innerHTML = `
                <div class="log-card-thumb">${thumbHtml}</div>
                <div class="log-content">
                    <div class="log-turn">TURN ${entry.turn}</div>
                    <div class="log-msg ${entry.type || ""}">${this._esc(entry.msg)}</div>
                    ${detailsHtml}
                </div>`;
            if (card) {
                el.classList.add("expanded");
                el.addEventListener("click", () => el.classList.toggle("expanded"));
            }
            body.appendChild(el);
        }
        body.scrollTop = body.scrollHeight;
        this.logFullscreen.classList.add("active");
    }

    closeLogFullscreen() {
        this.logFullscreen.classList.remove("active");
    }

    _initArenaEffects() {
        if (typeof document === "undefined") return;
        const bs = this.battleScreen;
        if (!bs) return;

        // 中央能量核心
        const core = document.createElement("div");
        core.className = "battlefield-center-glow";
        bs.appendChild(core);

        // 浮动粒子层
        const particleLayer = document.createElement("div");
        particleLayer.className = "duel-particles";
        bs.appendChild(particleLayer);
        this._spawnAmbientParticles(particleLayer);
    }

    _spawnAmbientParticles(layer) {
        if (!layer || typeof document === "undefined") return;
        const colors = [
            "rgba(85,216,229,.35)", "rgba(123,114,255,.3)",
            "rgba(92,224,178,.25)", "rgba(199,125,255,.2)",
            "rgba(255,211,107,.15)",
        ];
        for (let i = 0; i < 18; i++) {
            const p = document.createElement("div");
            p.className = "duel-particle";
            const size = 2 + Math.random() * 4;
            const dur = 6 + Math.random() * 10;
            const delay = Math.random() * dur;
            const left = Math.random() * 100;
            const drift = (Math.random() - 0.5) * 80;
            const maxOp = 0.15 + Math.random() * 0.3;
            const color = colors[Math.floor(Math.random() * colors.length)];
            p.style.cssText = `
                width:${size}px; height:${size}px;
                left:${left}%; bottom:-10px;
                background:${color};
                --dur:${dur}s; --drift:${drift}px; --max-op:${maxOp};
                animation-delay:${delay}s;
            `;
            layer.appendChild(p);
        }
    }

    _createFirstPlayerOverlay() {
        this.firstPlayerOverlay = document.createElement("div");
        this.firstPlayerOverlay.className = "overlay first-player-overlay";
        this.firstPlayerOverlay.innerHTML = `
            <section class="first-player-panel" role="dialog" aria-modal="true">
                <span class="eyebrow">ROCK PAPER SCISSORS</span>
                <h2>猜拳决定先后手</h2>
                <p id="rps-result">请选择石头、剪刀或布</p>
                <div class="rps-actions">
                    <button type="button" data-rps="rock">石头</button>
                    <button type="button" data-rps="scissors">剪刀</button>
                    <button type="button" data-rps="paper">布</button>
                </div>
                <div class="turn-choice-actions" id="turn-choice-actions" hidden>
                    <button type="button" class="primary-action" data-turn-choice="0">选择先攻</button>
                    <button type="button" class="secondary-action" data-turn-choice="1">选择后攻</button>
                </div>
            </section>`;
        document.body.appendChild(this.firstPlayerOverlay);
    }

    showFirstPlayerChoice(callback) {
        const choices = ["rock", "scissors", "paper"];
        const labels = { rock: "石头", scissors: "剪刀", paper: "布" };
        const beats = { rock: "scissors", scissors: "paper", paper: "rock" };
        const result = this.firstPlayerOverlay.querySelector("#rps-result");
        const turnChoices = this.firstPlayerOverlay.querySelector("#turn-choice-actions");
        this.firstPlayerOverlay.classList.add("active");
        turnChoices.hidden = true;
        result.textContent = "请选择石头、剪刀或布";
        this.firstPlayerOverlay.querySelectorAll("[data-rps]").forEach(button => {
            button.disabled = false;
            button.onclick = () => {
                const human = button.dataset.rps;
                const ai = choices[Math.floor(Math.random() * choices.length)];
                if (human === ai) {
                    result.textContent = `双方都是${labels[human]}，平局，请再来一次`;
                    return;
                }
                const humanWins = beats[human] === ai;
                result.textContent = `你出${labels[human]}，AI出${labels[ai]}：${humanWins ? "你获胜" : "AI获胜"}`;
                this.firstPlayerOverlay.querySelectorAll("[data-rps]").forEach(item => item.disabled = true);
                if (humanWins) {
                    turnChoices.hidden = false;
                } else {
                    setTimeout(() => {
                        this.firstPlayerOverlay.classList.remove("active");
                        callback(1);
                    }, 700);
                }
            };
        });
        turnChoices.querySelectorAll("[data-turn-choice]").forEach(button => {
            button.onclick = () => {
                const choice = Number(button.dataset.turnChoice);
                this.firstPlayerOverlay.classList.remove("active");
                callback(choice === 0 ? 0 : 1);
            };
        });
    }

    _createDiscardOverlay() {
        this.discardOverlay = document.createElement("div");
        this.discardOverlay.className = "overlay discard-overlay";
        this.discardOverlay.innerHTML = `
            <section class="discard-panel" role="dialog" aria-modal="true">
                <span class="eyebrow">END PHASE</span>
                <h2 id="discard-title">请选择要丢弃的手牌</h2>
                <p id="discard-hint"></p>
                <div class="discard-grid" id="discard-grid"></div>
                <button type="button" class="primary-action" id="discard-confirm" disabled>确认丢弃</button>
            </section>`;
        document.body.appendChild(this.discardOverlay);
    }

    showDiscardSelection(hand, count, callback) {
        const selected = new Set();
        const title = this.discardOverlay.querySelector("#discard-title");
        const hint = this.discardOverlay.querySelector("#discard-hint");
        const grid = this.discardOverlay.querySelector("#discard-grid");
        const confirm = this.discardOverlay.querySelector("#discard-confirm");
        title.textContent = `结束阶段：请选择${count}张手牌丢弃`;
        const update = () => {
            hint.textContent = `已选择 ${selected.size}/${count} 张；结束阶段手牌必须保留至${GAME_CONFIG.END_HAND_LIMIT}张`;
            confirm.disabled = selected.size !== count;
        };
        grid.replaceChildren();
        hand.forEach(card => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "discard-card";
            button.innerHTML = `<div class="card discard-card-view">${this.cardHTML(card)}</div>`;
            button.addEventListener("click", () => {
                if (selected.has(card.instanceId)) {
                    selected.delete(card.instanceId);
                    button.classList.remove("selected");
                } else if (selected.size < count) {
                    selected.add(card.instanceId);
                    button.classList.add("selected");
                }
                update();
            });
            grid.appendChild(button);
        });
        confirm.onclick = () => {
            if (selected.size !== count) return;
            this.discardOverlay.classList.remove("active");
            callback([...selected]);
        };
        update();
        this.discardOverlay.classList.add("active");
    }

    _bindDetailOverlay() {
        this.detailOverlay = document.getElementById("detail-overlay");
        this.detailOverlay?.querySelectorAll("#detail-close, [data-detail-close]").forEach(close => {
            close.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();
                this.hideDetail();
            });
        });
        this.detailOverlay?.addEventListener("click", event => {
            if (event.target === this.detailOverlay || event.target.closest("[data-detail-close]")) this.hideDetail();
        });
        this.detailOverlay?.querySelector(".detail-panel")?.addEventListener("click", event => event.stopPropagation());
    }

    _createCardActionOverlay() {
        this.cardActionOverlay = document.createElement("div");
        this.cardActionOverlay.className = "overlay card-action-overlay";
        this.cardActionOverlay.id = "card-action-overlay";
        this.cardActionOverlay.innerHTML = `
            <section class="card-action-panel" role="dialog" aria-modal="true" aria-labelledby="card-action-name">
                <button type="button" class="modal-close" data-card-action-close aria-label="关闭">×</button>
                <div class="card-action-preview" id="card-action-preview"></div>
                <div class="card-action-copy">
                    <span class="eyebrow">SELECT ACTION</span>
                    <h2 id="card-action-name"></h2>
                    <div class="card-action-effects" id="card-action-description"></div>
                    <div class="card-action-buttons" id="card-action-buttons"></div>
                    <button type="button" class="secondary-action card-action-cancel" data-card-action-close>取消</button>
                </div>
            </section>`;
        document.body.appendChild(this.cardActionOverlay);
        this.cardActionOverlay.addEventListener("click", event => {
            if (event.target === this.cardActionOverlay || event.target.closest("[data-card-action-close]")) this.hideCardActions();
        });
    }

    closeTopOverlay() {
        if (this.cardActionOverlay?.classList.contains("active")) { this.hideCardActions(); return true; }
        if (this.detailOverlay?.classList.contains("active")) { this.hideDetail(); return true; }
        if (this.tributeOverlay?.classList.contains("active")) { return false; }
        if (this.graveyardOverlay?.classList.contains("active")) { return false; }
        return false;
    }

    hideCardActions() {
        this.cardActionOverlay?.classList.remove("active");
        document.body.classList.remove("battle-modal-open");
    }

    _showCardActions(card, index, handlers, canPlay) {
        if (!this.cardActionOverlay) return;
        const preview = this.cardActionOverlay.querySelector("#card-action-preview");
        const name = this.cardActionOverlay.querySelector("#card-action-name");
        const description = this.cardActionOverlay.querySelector("#card-action-description");
        const buttons = this.cardActionOverlay.querySelector("#card-action-buttons");
        preview.innerHTML = `<div class="card action-card">${this.cardHTML(card)}</div>`;
        name.textContent = card.name || "未知卡牌";
        description.innerHTML = cardEffectFieldsHtml(card);
        buttons.replaceChildren();

        const addAction = (label, className, callback) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = className;
            button.textContent = label;
            button.addEventListener("click", () => {
                this.hideCardActions();
                callback();
            });
            buttons.appendChild(button);
        };

        if (canPlay && card.type === "monster") {
            addAction("攻击表示召唤", "primary-action", () => handlers.onSummon(index, MONSTER_POSITION.ATTACK, false));
            addAction("里侧守备盖放", "secondary-action", () => handlers.onSetCard(index));
        } else if (canPlay && card.type === "spell") {
            addAction("发动魔法", "primary-action", () => handlers.onPlayCard(index));
            addAction("盖放魔法", "secondary-action", () => handlers.onSetCard(index));
        } else if (canPlay && card.type === "trap") {
            addAction("盖放陷阱", "primary-action", () => handlers.onSetCard(index));
        }

        // 场上怪兽操作（翻转召唤 / 手动变更形态 / 发动效果）
        if (card._onField && card.type === "monster") {
            if (!card.faceUp && card.position === MONSTER_POSITION.DEFENSE) {
                addAction("翻转召唤", "primary-action", () => handlers.onFlipSummon(card));
            }
            if (card.faceUp && !card.hasAttackedThisTurn && !card.positionChangedThisTurn) {
                const newPos = card.position === MONSTER_POSITION.ATTACK ? "守备表示" : "攻击表示";
                addAction(`变为${newPos}`, "secondary-action", () => handlers.onChangePosition(card));
            }
            // 可发动的手动效果（一回合一次）
            if (card.faceUp && card.effects?.some(e => e.trigger === "manual") && !card.oncePerTurnUsed) {
                addAction("发动效果", "primary-action", () => handlers.onActivateMonsterEffect(card));
            }
        }
        if (card._onField && card.type === "spell" && card.faceDown) {
            const activation = handlers.canActivateSetSpell?.(card);
            if (activation?.canActivate) {
                addAction("翻开发动", "primary-action", () => handlers.onActivateSetSpell(card));
            } else if (activation?.reason) {
                const hint = document.createElement("p");
                hint.className = "set-spell-hint";
                hint.textContent = activation.reason;
                buttons.appendChild(hint);
            }
        }
        addAction("查看完整详情", "secondary-action", () => this.showDetail(card));
        this.cardActionOverlay.classList.add("active");
        document.body.classList.add("battle-modal-open");
    }

    showAiAction(card, message = "AI ACTION") {
        // 中心文字横幅已移除，运镜动画接管视觉表现
    }

    _bindImageFallbacks() {
        document.addEventListener("error", (e) => {
            if (e.target.tagName === "IMG" && e.target.classList.contains("card-img")) {
                if (e.target.dataset.retryAttempted !== "true") {
                    e.target.dataset.retryAttempted = "true";
                    const original = e.target.currentSrc || e.target.src;
                    const separator = original.includes("?") ? "&" : "?";
                    setTimeout(() => { e.target.src = `${original}${separator}retry=${Date.now()}`; }, 500);
                    return;
                }
                e.target.style.display = "none";
                const fb = e.target.nextElementSibling;
                if (fb && fb.classList.contains("card-img-fallback")) fb.style.display = "flex";
            }
        }, true);
    }

    _createHandoffOverlay() {
        this.handoffOverlay = document.createElement("div");
        this.handoffOverlay.className = "overlay handoff-overlay";
        this.handoffOverlay.innerHTML = `<div class="handoff-panel"><div class="handoff-text" id="handoff-text"></div><button class="menu-btn" id="handoff-confirm" style="width:200px;margin-top:20px">确认开始</button></div>`;
        document.body.appendChild(this.handoffOverlay);
    }

    _createGraveyardOverlay() {
        this.graveyardOverlay = document.createElement("div");
        this.graveyardOverlay.className = "overlay";
        this.graveyardOverlay.id = "graveyard-overlay";
        this.graveyardOverlay.innerHTML = `<div class="detail-panel" style="width:500px;max-height:80vh;overflow-y:auto"><h2 style="text-align:center;margin-bottom:12px;color:#fbbf24">选择怪兽</h2><div class="graveyard-grid" id="graveyard-grid"></div><button class="btn-close" id="graveyard-close">✕</button></div>`;
        document.body.appendChild(this.graveyardOverlay);
    }

    _createTributeOverlay() {
        this.tributeOverlay = document.createElement("div");
        this.tributeOverlay.className = "overlay";
        this.tributeOverlay.id = "tribute-overlay";
        this.tributeOverlay.innerHTML = `<div class="detail-panel" style="width:500px;max-height:80vh;overflow-y:auto"><h2 style="text-align:center;margin-bottom:12px;color:#fbbf24" id="tribute-title">选择祭品</h2><div class="tribute-grid" id="tribute-grid"></div><div style="text-align:center;margin-top:12px"><button class="menu-btn" id="tribute-confirm" style="width:150px;margin:5px">确认</button><button class="menu-btn" id="tribute-cancel" style="width:150px;margin:5px;background:rgba(255,80,80,0.1);border-color:rgba(255,80,80,0.3)">取消</button></div></div>`;
        document.body.appendChild(this.tributeOverlay);
    }

    showBattle() {
        this.menuScreen?.classList.add("is-hidden");
        const scenes = [
            "moon-shrine", "neon-rooftop", "celestial-ruins", "sakura-academy",
            "abyssal-temple", "volcanic-forge", "aurora-palace", "desert-relic",
            "spirit-forest", "gothic-castle",
        ];
        const previousScene = this.battleScreen.dataset.duelScene;
        const choices = scenes.filter(scene => scene !== previousScene);
        const selectedScene = choices[Math.floor(Math.random() * choices.length)] || scenes[0];
        this.battleScreen.dataset.duelScene = selectedScene;
        this.battleScreen.classList.add("active");
        document.body.classList.add("battle-active");
        const pl = this.battleScreen.querySelector(".duel-particles");
        if (pl) { pl.innerHTML = ""; this._spawnAmbientParticles(pl); }
    }
    showMenu() {
        this.battleScreen.classList.remove("active");
        document.body.classList.remove("battle-active");
        this.menuScreen?.classList.remove("is-hidden");
        this.onReturnHome?.();
    }

    render(gs, h) {
        if (!gs || !Array.isArray(gs.players) || gs.players.length < 2) {
            console.error("[GameUI] 无效游戏状态", gs);
            return;
        }
        this.battleScreen.dataset.activeOwner = String(gs.currentPlayerIndex);

        // 控制和阶段必须最先更新。即便某张卡的数据异常，也不能让整场决斗停在“等待开始”。
        this._safeRender("phase", () => this._renderPhaseBar(gs));
        this._safeRender("controls", () => this._renderControls(gs, h));
        this._safeRender("topHud", () => this._renderTop(gs));
        this._safeRender("opponentHand", () => this._renderOpponentHand(gs));
        this._safeRender("bottomHud", () => this._renderBottom(gs));
        this._safeRender("deckPiles", () => this._renderDeckPiles(gs));
        this._safeRender("field", () => this._renderField(gs, h));
        this._safeRender("hand", () => this._renderHand(gs, h), () => this._renderHandFailure());

        // 场地魔法场景变换
        this._updateFieldScene(gs);

        if (gs.phase === PHASE.GRAVEYARD_SELECT) this._safeRender("graveyard", () => this._showGraveyardSelect(gs, h));
        else this.graveyardOverlay.classList.remove("active");
        if (gs.phase === PHASE.TRIBUTE_SELECT) this._safeRender("tribute", () => this._showTributeSelect(gs, h));
        else this.tributeOverlay.classList.remove("active");
    }

    _safeRender(section, callback, fallback = null) {
        try {
            callback();
        } catch (error) {
            console.error(`[GameUI] ${section} 渲染失败`, error);
            fallback?.(error);
        }
    }

    _updateFieldScene(gs) {
        const bs = this.battleScreen;
        if (!bs) return;
        // 检查是否有场地魔法
        const p0Field = gs.players[0]?.fieldZone;
        const p1Field = gs.players[1]?.fieldZone;
        const activeField = p0Field || p1Field;
        const fieldSpellType = activeField?.fieldSpellType || null;

        bs.classList.remove("scene-ocean", "scene-shallow-tide");
        if (fieldSpellType === "ocean_scene") {
            bs.classList.add("scene-ocean");
        } else if (fieldSpellType === "shallow_tide") {
            bs.classList.add("scene-shallow-tide");
        }
    }

    _renderDeckPiles(gs) {
        if (this.playerDeckCount) this.playerDeckCount.textContent = String(gs.players[0]?.deck?.length ?? 0);
        if (this.opponentDeckCount) this.opponentDeckCount.textContent = String(gs.players[1]?.deck?.length ?? 0);
        if (this.playerGraveyardCount) this.playerGraveyardCount.textContent = String(gs.players[0]?.graveyard?.length ?? 0);
        if (this.opponentGraveyardCount) this.opponentGraveyardCount.textContent = String(gs.players[1]?.graveyard?.length ?? 0);
        if (this.visibleHandCount) {
            const visiblePlayer = this.mode === "local" ? gs.currentPlayer : gs.players[0];
            this.visibleHandCount.textContent = String(visiblePlayer?.hand?.length ?? 0);
        }
    }

    _renderHandFailure() {
        if (!this.handElement) return;
        this.handElement.innerHTML = `<div class="hand-render-error">手牌显示发生异常。请按 Ctrl+F5 刷新；错误已输出到浏览器控制台。</div>`;
    }

    showDrawAnimation(card, playerIndex = 0, message = "DRAW") {
        // 抽卡运镜已由 animateDrawCard 接管，这里只播放辅助氛围特效

        // 玩家抽卡播放氛围特效
        if (playerIndex !== 0 || !card) return;

        const battleScreen = document.querySelector(".battle-screen");
        if (!battleScreen) return;

        // 屏幕震动
        setTimeout(() => {
            battleScreen.classList.remove("draw-shake");
            void battleScreen.offsetWidth;
            battleScreen.classList.add("draw-shake");
            setTimeout(() => battleScreen.classList.remove("draw-shake"), 400);
        }, 600);

        // 径向冲击波
        const burst = document.createElement("div");
        burst.className = "draw-radial-burst";
        document.body.appendChild(burst);
        setTimeout(() => burst.remove(), 900);

        // 光粒子从中心四散
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight * 0.42;
        for (let i = 0; i < 12; i++) {
            const p = document.createElement("div");
            p.className = "draw-particle";
            const angle = (i / 12) * Math.PI * 2;
            const dist = 80 + Math.random() * 120;
            p.style.cssText = `left:${cx}px; top:${cy}px; --px:${Math.cos(angle) * dist}px; --py:${Math.sin(angle) * dist}px; animation-delay:${0.6 + i * 0.02}s;`;
            document.body.appendChild(p);
            setTimeout(() => p.remove(), 1300);
        }
    }

    _renderTop(gs) {
        const opp = gs.players[1];
        const el = document.getElementById("opponent-area");
        const pct = Math.max(0, Math.min(100, (opp.lp / opp.maxLp) * 100));
        el.innerHTML = `<div class="player-hud opponent-hud ${gs.currentPlayerIndex === 1 ? "active-player" : ""}">
            <div class="player-avatar opp-avatar">NC</div>
            <div class="player-stats"><div class="player-name">${this._esc(opp.name)}</div><div class="hp-bar-wrap"><div class="hp-bar"><div class="hp-fill enemy" style="width:${pct}%"></div></div><span class="hp-text">${opp.lp.toLocaleString()} LP</span></div></div>
            <div class="hud-counters"><div><span>DECK</span><strong>${opp.deck.length}</strong></div><div><span>HAND</span><strong>${opp.hand.length}</strong></div><div><span>GY</span><strong>${opp.graveyard.length}</strong></div></div>
        </div>`;
    }

    _renderOpponentHand(gs) {
        if (!this.opponentHandElement) return;
        const opponent = gs.players[1];
        const count = Array.isArray(opponent?.hand) ? opponent.hand.length : 0;
        this.opponentHandElement.replaceChildren();
        for (let index = 0; index < count; index++) {
            const back = document.createElement("div");
            back.className = "opponent-hand-card";
            back.style.transform = `translateX(${(index - (count - 1) / 2) * 24}px) rotate(${(index - (count - 1) / 2) * 2}deg)`;
            back.innerHTML = "<span>NC</span>";
            this.opponentHandElement.appendChild(back);
        }
    }

    _renderBottom(gs) {
        const p = gs.players[0];
        const el = document.getElementById("player-area");
        const pct = Math.max(0, Math.min(100, (p.lp / p.maxLp) * 100));
        el.innerHTML = `<div class="player-hud player-hud-bottom ${gs.currentPlayerIndex === 0 ? "active-player" : ""}">
            <div class="player-avatar my-avatar">${this._esc((p.name || "P").slice(0, 1))}</div>
            <div class="player-stats"><div class="player-name">${this._esc(p.name)}</div><div class="hp-bar-wrap"><div class="hp-bar"><div class="hp-fill ally" style="width:${pct}%"></div></div><span class="hp-text">${p.lp.toLocaleString()} LP</span></div></div>
            <div class="hud-counters"><div><span>DECK</span><strong>${p.deck.length}</strong></div><div><span>HAND</span><strong>${p.hand.length}</strong></div><div><span>GY</span><strong>${p.graveyard.length}</strong></div></div>
        </div>`;
    }

    _renderPhaseBar(gs) {
        const bar = document.getElementById("phase-bar");
        if (this.turnBadge) this.turnBadge.textContent = `TURN ${gs.turn} · ${PHASE_NAMES[gs.phase] || gs.phase}`;
        if (!bar) return;
        const currentIdx = PHASE_ORDER.indexOf(gs.phase);
        bar.innerHTML = PHASE_ORDER.map((p, i) => `<span class="phase-step ${i === currentIdx ? "phase-active" : ""} ${i < currentIdx ? "phase-done" : ""}">${PHASE_NAMES[p]}</span>`).join('<span class="phase-arrow">→</span>');
    }

    _renderField(gs, h) {
        const p0 = gs.players[0], p1 = gs.players[1];
        const isBattle = gs.phase === PHASE.BATTLE || (gs.phase === PHASE.MAIN_1 && !gs.firstTurn);
        const hasAttacker = !!gs.selectedAttacker;
        const isTargetSelect = gs.phase === PHASE.TARGET_SELECT;
        const isTributeSelect = gs.phase === PHASE.TRIBUTE_SELECT;
        this._currentTurn = gs.turn;

        // 记录上一帧的场上卡牌 instanceId，用于检测新放置
        const prevFieldIds = this._prevFieldIds || new Set();
        const curFieldIds = new Set();
        [...p0.monsterZone, ...p0.spellTrapZone, ...p1.monsterZone, ...p1.spellTrapZone]
            .forEach(c => { if (c?.instanceId) curFieldIds.add(c.instanceId); });
        this._prevFieldIds = curFieldIds;

        this.battlefield.innerHTML = `
            <div class="field-half opp-half">
                <div class="spell-trap-row" data-drop-zone="spell-trap" data-owner="1">${this._renderSpellTrapSlots(p1.spellTrapZone, 1, isTargetSelect, gs.validTargets)}</div>
                <div class="monster-row" data-drop-zone="monster" data-owner="1">${this._renderMonsterSlots(p1.monsterZone, 1, gs.currentPlayerIndex, isBattle, isTargetSelect, gs.validTargets, hasAttacker, isTributeSelect, gs)}</div>
            </div>
            <div class="field-zone-center">
                <div class="field-zone-slot ${p0.fieldZone ? "has-card" : ""}" data-owner="0" data-zone="field">
                    ${p0.fieldZone ? `<div class="card mini-card type-spell rarity-${p0.fieldZone.rarity || "N"} field-spell-card"><div class="card-frame elem-${p0.fieldZone.attribute || "none"}"><div class="card-header"><span class="card-name">${this._esc(p0.fieldZone.name)}</span></div><div class="card-art"><div class="card-art-inner">${getCardImageHTML(p0.fieldZone, 60)}</div></div><div class="card-footer"><span class="stat-type">场地</span></div></div></div>` : `<div class="field-zone-empty"><span>场地</span></div>`}
                </div>
                <div class="field-zone-slot ${p1.fieldZone ? "has-card" : ""}" data-owner="1" data-zone="field">
                    ${p1.fieldZone ? `<div class="card mini-card type-spell rarity-${p1.fieldZone.rarity || "N"} field-spell-card"><div class="card-frame elem-${p1.fieldZone.attribute || "none"}"><div class="card-header"><span class="card-name">${this._esc(p1.fieldZone.name)}</span></div><div class="card-art"><div class="card-art-inner">${getCardImageHTML(p1.fieldZone, 60)}</div></div><div class="card-footer"><span class="stat-type">场地</span></div></div></div>` : `<div class="field-zone-empty"><span>场地</span></div>`}
                </div>
            </div>
            <div class="field-half my-half">
                <div class="monster-row" data-drop-zone="monster" data-owner="0">${this._renderMonsterSlots(p0.monsterZone, 0, gs.currentPlayerIndex, isBattle, isTargetSelect, gs.validTargets, hasAttacker, isTributeSelect, gs)}</div>
                <div class="spell-trap-row" data-drop-zone="spell-trap" data-owner="0">${this._renderSpellTrapSlots(p0.spellTrapZone, 0, isTargetSelect, gs.validTargets)}</div>
            </div>`;

        // 新放置的卡牌添加涟漪效果
        if (prevFieldIds.size > 0) {
            this.battlefield.querySelectorAll(".field-slot.has-card").forEach(slot => {
                const id = slot.dataset.instanceId;
                if (id && !prevFieldIds.has(id)) {
                    slot.classList.add("ripple");
                    setTimeout(() => slot.classList.remove("ripple"), 550);
                }
            });
        }

        this._bindFieldEvents(gs, h);
    }

    _renderMonsterSlots(zone, ownerIdx, currentPlayerIndex, isBattle, isTargetSelect, validTargets, hasAttacker, isTributeSelect, gs) {
        let html = "";
        for (let i = 0; i < GAME_CONFIG.MAX_MONSTER_ZONE; i++) {
            if (i < zone.length) {
                const c = zone[i];
                const attr = c.attribute || c.element || "none";
                const isDef = c.position === MONSTER_POSITION.DEFENSE;
                const isFaceDown = !c.faceUp;
                const isLocalOwner = ownerIdx === 0;
                const canControl = isLocalOwner && currentPlayerIndex === 0;
                const canAtk = canControl && isBattle && c.canAttack && !c.hasAttackedThisTurn && !isDef && c.faceUp;
                const isEnemy = ownerIdx === 1;
                const isTargetable = isEnemy && currentPlayerIndex === 0 && isBattle && hasAttacker;
                const isEffectTarget = isTargetSelect && validTargets.some(t => t.instanceId === c.instanceId);
                const isTributeTarget = isTributeSelect && canControl;
                const slotAttr = c.attribute || c.element || "";
                const cls = ["field-slot", "has-card", slotAttr, canAtk ? "can-attack" : "", isTargetable ? "targetable" : "", isEffectTarget ? "effect-target" : "", isTributeTarget ? "tribute-target" : "", isDef && !isFaceDown ? "defense-pos" : "", isFaceDown ? "face-down-set" : ""].filter(Boolean).join(" ");
                const attrs = [
                    `data-owner="${ownerIdx}"`,
                    `data-zone="monster"`,
                    `data-instance-id="${escapeAttr(c.instanceId)}"`,
                    canAtk ? `data-attacker="${i}" data-drag-attacker="${escapeAttr(c.instanceId)}" draggable="true"` : "",
                    isTargetable ? `data-target="${i}"` : "",
                    isEnemy && isBattle ? `data-attack-drop-target="${escapeAttr(c.instanceId)}"` : "",
                    isEffectTarget ? `data-effect-target="${escapeAttr(c.instanceId)}"` : "",
                    isTributeTarget ? `data-tribute="${i}"` : "",
                ].filter(Boolean).join(" ");

                // 里侧守备显示卡背
                if (isFaceDown) {
                    html += `<div class="${cls}" ${attrs}>
                        <div class="card in-field rarity-${c.rarity || "N"}">
                            <div class="card-frame face-down-frame">
                                <div class="card-back-icon">?</div>
                                <div class="card-back-label">SET</div>
                            </div>
                        </div>
                    </div>`;
                } else {
                    // 主要阶段：己方表侧怪兽显示「守备/攻击」切换按钮
                    const showPosBtn = canControl && !gs.gameOver
                        && (gs.phase === PHASE.MAIN_1 || gs.phase === PHASE.MAIN_2)
                        && c.faceUp && !c.hasAttackedThisTurn && !c.positionChangedThisTurn;
                    const posLabel = isDef ? "攻击" : "守备";
                    const posBtnHtml = showPosBtn
                        ? `<button class="pos-switch-btn" data-pos-switch="${escapeAttr(c.instanceId)}" onclick="event.stopPropagation()">${posLabel}</button>`
                        : "";
                    html += `<div class="${cls}" ${attrs}>
                        <div class="card in-field rarity-${c.rarity || "N"}">
                            <div class="card-frame elem-${attr} type-monster member-${c.member || "none"}">
                                <div class="card-header"><span class="card-name">${this._esc(c.name)}</span><span class="card-level">Lv.${c.level || "?"}</span></div>
                                <div class="card-art"><div class="card-art-inner">${getCardImageHTML(c, 80)}</div></div>
                                <div class="card-footer"><span class="stat-atk"><span>ATK</span>${c.currentAttack}</span><span class="stat-def"><span>DEF</span>${c.currentDefense}</span></div>
                            </div>
                            ${posBtnHtml}
                        </div>
                    </div>`;
                }
            } else {
                html += `<div class="field-slot empty" data-owner="${ownerIdx}" data-zone="monster"></div>`;
            }
        }
        return html;
    }

    _renderSpellTrapSlots(zone, ownerIdx, isTargetSelect = false, validTargets = []) {
        let html = "";
        for (let i = 0; i < GAME_CONFIG.MAX_SPELL_TRAP_ZONE; i++) {
            if (i < zone.length) {
                const c = zone[i];
                const isFaceDown = c.faceDown;
                const typeIcon = c.type === "trap" ? "TRAP" : "SPELL";
                const isEffectTarget = isTargetSelect && validTargets.some(target => target.instanceId === c.instanceId);
                const targetAttr = isEffectTarget ? ` data-effect-target="${this._esc(c.instanceId)}"` : "";
                html += `<div class="field-slot spell-trap-slot ${isFaceDown ? "face-down" : "has-card"} ${isEffectTarget ? "effect-target" : ""}" data-owner="${ownerIdx}" data-zone="spell-trap" data-stidx="${i}" data-instance-id="${escapeAttr(c.instanceId)}"${targetAttr}>
                    ${isFaceDown ? `<div class="card-back-icon">${typeIcon}</div>` : `<div class="card mini-card type-${c.type} rarity-${c.rarity || "N"}"><div class="card-frame elem-${c.attribute || "none"}"><div class="card-header"><span class="card-name">${this._esc(c.name)}</span></div><div class="card-footer"><span class="stat-type">${c.type === "trap" ? "陷阱" : "魔法"}</span></div></div></div>`}
                </div>`;
            } else {
                html += `<div class="field-slot empty spell-trap-slot" data-owner="${ownerIdx}" data-zone="spell-trap"></div>`;
            }
        }
        return html;
    }

    _bindFieldEvents(gs, h) {
        const bf = this.battlefield;
        const isBattle = gs.phase === PHASE.BATTLE || (gs.phase === PHASE.MAIN_1 && !gs.firstTurn);
        const hasAttacker = !!gs.selectedAttacker;

        bf.querySelectorAll("[data-target]").forEach(el => {
            el.addEventListener("click", () => {
                const i = Number.parseInt(el.dataset.target, 10);
                const card = gs.opponentPlayer.monsterZone[i];
                if (card) h.onAttack(card);
            });
        });
        bf.querySelectorAll("[data-effect-target]").forEach(el => {
            el.addEventListener("click", event => {
                event.preventDefault();
                event.stopImmediatePropagation();
                const target = this._findTarget(gs, el.dataset.effectTarget);
                if (target) h.onConfirmTarget(target);
            });
        });
        bf.querySelectorAll("[data-tribute]").forEach(el => {
            el.addEventListener("click", () => {
                const i = Number.parseInt(el.dataset.tribute, 10);
                const card = gs.currentPlayer.monsterZone[i];
                if (card) h.onSelectTribute(card);
            });
        });

        // 拖动场上可攻击角色到敌方角色或敌方头像即可攻击。
        bf.querySelectorAll("[data-drag-attacker]").forEach(el => {
            el.addEventListener("dragstart", event => {
                const attacker = this._findTarget(gs, el.dataset.dragAttacker);
                if (!attacker) return event.preventDefault();
                this.dragContext = { kind: "attacker", instanceId: attacker.instanceId };
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", JSON.stringify(this.dragContext));
                el.classList.add("dragging-card");
                this.battleScreen.classList.add("dragging-attacker");
            });
            el.addEventListener("dragend", () => this._finishDrag());
        });

        bf.querySelectorAll("[data-attack-drop-target]").forEach(el => {
            el.addEventListener("dragover", event => {
                if (this.dragContext?.kind !== "attacker") return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                el.classList.add("drop-hover");
            });
            el.addEventListener("dragleave", () => el.classList.remove("drop-hover"));
            el.addEventListener("drop", event => {
                if (this.dragContext?.kind !== "attacker") return;
                event.preventDefault();
                const attacker = this._findTarget(gs, this.dragContext.instanceId);
                const target = this._findTarget(gs, el.dataset.attackDropTarget);
                this._finishDrag();
                if (!attacker || !target) return;
                h.onSelectAttacker(attacker);
                h.onAttack(target);
            });
        });

        // 拖动手牌到己方对应区域：角色召唤，魔法发动，陷阱盖放。
        bf.querySelectorAll("[data-drop-zone]").forEach(zone => {
            zone.addEventListener("dragover", event => {
                const drag = this.dragContext;
                if (!drag || drag.kind !== "hand" || Number(zone.dataset.owner) !== gs.currentPlayerIndex) return;
                const valid = drag.cardType === "monster" ? zone.dataset.dropZone === "monster" : zone.dataset.dropZone === "spell-trap";
                if (!valid) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                zone.classList.add("drop-hover");
            });
            zone.addEventListener("dragleave", event => {
                if (!zone.contains(event.relatedTarget)) zone.classList.remove("drop-hover");
            });
            zone.addEventListener("drop", event => {
                const drag = this.dragContext;
                if (!drag || drag.kind !== "hand" || Number(zone.dataset.owner) !== gs.currentPlayerIndex) return;
                const valid = drag.cardType === "monster" ? zone.dataset.dropZone === "monster" : zone.dataset.dropZone === "spell-trap";
                if (!valid) return;
                event.preventDefault();
                const currentIndex = gs.currentPlayer.hand.findIndex(card => card.instanceId === drag.instanceId);
                const cardType = drag.cardType;
                const defense = !!event.shiftKey;
                this._finishDrag();
                if (currentIndex < 0) return;
                if (cardType === "monster") h.onSummon(currentIndex, defense ? MONSTER_POSITION.DEFENSE : MONSTER_POSITION.ATTACK, defense);
                else if (cardType === "spell") h.onPlayCard(currentIndex);
                else if (cardType === "trap") h.onSetCard(currentIndex);
            });
        });

        bf.querySelectorAll("[data-instance-id]").forEach(el => {
            // 右键：己方怪兽显示操作面板（含形态切换），对方怪兽只看详情
            el.addEventListener("contextmenu", event => {
                event.preventDefault();
                event.stopPropagation();
                const card = this._findTarget(gs, el.dataset.instanceId);
                if (!card || card.isPlayer) return;
                const isOwn = Number(el.dataset.owner) === 0;
                const isFaceDown = card.type === "monster" ? !card.faceUp : !!card.faceDown;
                if (isFaceDown) {
                    if (isOwn) this.showDetail(card);
                    return;
                }
                const isMainPhase = gs.phase === PHASE.MAIN_1 || gs.phase === PHASE.MAIN_2;
                if (isOwn && gs.currentPlayerIndex === 0 && card.type === "monster" && isMainPhase && !gs.gameOver) {
                    card._onField = true;
                    this._showCardActions(card, -1, h, false);
                } else {
                    this.showDetail(card);
                }
            });

            // 左键点击：主要阶段→操作面板，战斗阶段→选攻击手
            el.addEventListener("click", event => {
                const card = this._findTarget(gs, el.dataset.instanceId);
                if (!card || card.isPlayer) return;
                const isOwn = Number(el.dataset.owner) === gs.currentPlayerIndex;
                const isMainPhase = gs.phase === PHASE.MAIN_1 || gs.phase === PHASE.MAIN_2;

                // 战斗阶段优先：己方可攻击怪兽 → 选为攻击手
                if (isOwn && gs.phase === PHASE.BATTLE && el.dataset.attacker !== undefined) {
                    const i = Number.parseInt(el.dataset.attacker, 10);
                    const attackerCard = gs.currentPlayer.monsterZone[i];
                    if (attackerCard) h.onSelectAttacker(attackerCard);
                    return;
                }

                // 主要阶段：己方怪兽 → 打开操作面板（含守备表示切换）
                if (isOwn && isMainPhase && !gs.gameOver) {
                    card._onField = true;
                    this._showCardActions(card, -1, h, false);
                    return;
                }
            });

            // 守备/攻击切换按钮
            bf.querySelectorAll("[data-pos-switch]").forEach(el => {
                el.addEventListener("click", event => {
                    event.stopPropagation();
                    const card = this._findTarget(gs, el.dataset.posSwitch);
                    if (!card) return;
                    h.onChangePosition(card);
                });
            });
        });

        const oppHud = document.querySelector("#opponent-area .player-hud");
        if (oppHud) {
            oppHud.onclick = null;
            oppHud.classList.remove("direct-attack-target", "drop-hover");
            if (isBattle && gs.opponentPlayer.monsterZone.length === 0) {
                if (hasAttacker) {
                    oppHud.classList.add("direct-attack-target");
                    oppHud.onclick = () => h.onAttackPlayer();
                }
                oppHud.addEventListener("dragover", event => {
                    if (this.dragContext?.kind !== "attacker") return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    oppHud.classList.add("drop-hover");
                });
                oppHud.addEventListener("dragleave", () => oppHud.classList.remove("drop-hover"));
                oppHud.addEventListener("drop", event => {
                    if (this.dragContext?.kind !== "attacker") return;
                    event.preventDefault();
                    const attacker = this._findTarget(gs, this.dragContext.instanceId);
                    this._finishDrag();
                    if (!attacker) return;
                    h.onSelectAttacker(attacker);
                    h.onAttackPlayer();
                });
            }
        }
    }

    _finishDrag() {
        this.dragContext = null;
        this.battleScreen.classList.remove("dragging-hand-monster", "dragging-hand-spell", "dragging-hand-trap", "dragging-attacker");
        this.battleScreen.removeAttribute("data-active-owner");
        document.querySelectorAll(".dragging-card, .drop-hover").forEach(element => element.classList.remove("dragging-card", "drop-hover"));
    }

    _findTarget(gs, instanceId) {
        if (!instanceId) return null;
        if (instanceId.startsWith("player_")) { const idx = instanceId === "player_" + gs.players[0].name ? 0 : 1; return { isPlayer: true, name: gs.players[idx].name, currentDefense: gs.players[idx].lp }; }
        for (const p of gs.players) for (const c of [...p.monsterZone, ...p.spellTrapZone, ...p.hand, ...p.graveyard]) if (c.instanceId === instanceId) return c;
        return null;
    }

    _renderHand(gs, h) {
        if (!this.handElement) throw new Error("缺少 #hand 元素");
        if (gs.phase === PHASE.TARGET_SELECT || gs.phase === PHASE.GRAVEYARD_SELECT || gs.phase === PHASE.TRIBUTE_SELECT) {
            this.handElement.innerHTML = `<div class="target-select-hint">${gs.phase === PHASE.TRIBUTE_SELECT ? "选择祭品" : "选择目标"} · ESC 取消</div>`;
            return;
        }

        const player = this.mode === "local" ? gs.currentPlayer : gs.players[0];
        const hand = Array.isArray(player?.hand) ? player.hand : [];
        const prevIds = new Set(this._prevHandIds || []);
        const newIds = new Set(hand.map(c => c?.instanceId).filter(Boolean));
        this._prevHandIds = [...newIds];

        this.handElement.replaceChildren();
        if (this.visibleHandCount) this.visibleHandCount.textContent = String(hand.length);

        if (hand.length === 0) {
            const empty = document.createElement("div");
            empty.className = "target-select-hint";
            empty.textContent = "当前没有手牌";
            this.handElement.appendChild(empty);
            return;
        }

        const count = hand.length;
        const angle = Math.min(4, 22 / Math.max(count, 1));
        const canPlay = (gs.currentPlayerIndex === 0 || this.mode === "local") &&
            (gs.phase === PHASE.MAIN_1 || gs.phase === PHASE.MAIN_2 || gs.phase === PHASE.BATTLE) && !gs.gameOver;

        hand.forEach((card, index) => {
            if (!card || typeof card !== "object") return;
            let element;
            try {
                element = document.createElement("article");
                element.className = `card in-hand rarity-${card.rarity || "N"}`;
                element.innerHTML = this.cardHTML(card);
            } catch (error) {
                console.error("[GameUI] 单张手牌渲染失败", card, error);
                element = document.createElement("article");
                element.className = "card in-hand render-fallback";
                const frame = document.createElement("div");
                frame.className = "card-frame";
                const name = document.createElement("strong");
                name.textContent = String(card.name || "异常卡牌");
                const info = document.createElement("small");
                info.textContent = "卡面数据异常，但不会中断决斗";
                frame.append(name, info);
                element.appendChild(frame);
            }

            element.dataset.handIndex = String(index);
            element.dataset.instanceId = String(card.instanceId || card.id || index);
            const rotation = (index - (count - 1) / 2) * angle;
            const offsetY = Math.abs(index - (count - 1) / 2) * 2;
            const transform = `rotate(${rotation}deg) translateY(${offsetY}px)`;
            element.style.transform = transform;
            element.style.setProperty("--hand-transform", transform);
            element.style.setProperty("--target-rot", `${rotation}deg`);
            element.style.setProperty("--target-y", `${offsetY}px`);

            // 扇形展开动画：首次渲染或有新卡时
            const isNew = card.instanceId && !prevIds.has(card.instanceId);
            if (prevIds.size === 0 || isNew) {
                element.classList.add("fan-enter");
                element.style.animationDelay = `${60 + index * 70}ms`;
                setTimeout(() => element.classList.remove("fan-enter"), 650 + index * 70);
            }

            if (canPlay) {
                element.draggable = true;
                element.setAttribute("aria-grabbed", "false");
                if (card.type === "monster") {
                    element.classList.add("playable");
                    element.title = "拖到己方怪兽区通常召唤；按住 Shift 拖放为里侧守备盖放";
                } else if (card.type === "spell") {
                    element.classList.add("playable");
                    element.title = "拖到己方魔法陷阱区发动";
                } else if (card.type === "trap") {
                    element.classList.add("playable-set");
                    element.title = "拖到己方魔法陷阱区盖放";
                }

                element.addEventListener("dragstart", event => {
                    this.dragContext = {
                        kind: "hand",
                        instanceId: String(card.instanceId || card.id || index),
                        cardType: card.type,
                    };
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", JSON.stringify(this.dragContext));
                    element.classList.add("dragging-card");
                    element.setAttribute("aria-grabbed", "true");
                    this.battleScreen.classList.add(`dragging-hand-${card.type}`);
                    this.battleScreen.setAttribute("data-active-owner", "0");
                });
                element.addEventListener("dragend", () => {
                    element.setAttribute("aria-grabbed", "false");
                    this._finishDrag();
                });
            } else {
                element.draggable = false;
            }

            // 单击提供稳定的操作面板；右键只查看详情。不要再依赖双击，因为第一次点击打开详情后第二次点击会丢失。
            element.addEventListener("click", event => {
                event.preventDefault();
                this._showCardActions(card, index, h, canPlay);
            });
            element.addEventListener("contextmenu", event => {
                event.preventDefault();
                event.stopPropagation();
                this.showDetail(card);
            });
            this.handElement.appendChild(element);

            // SR/UR卡牌添加碎闪效果
            if (card.rarity === "SR" || card.rarity === "UR" || card.rarity === "SSR") {
                addFoilShimmer(element);
            }
        });
    }

    _renderControls(gs, h) {
        const canAct = gs.currentPlayerIndex === 0 || this.mode === "local";
        const selecting = gs.phase === PHASE.TARGET_SELECT || gs.phase === PHASE.GRAVEYARD_SELECT || gs.phase === PHASE.TRIBUTE_SELECT;
        const btnNext = document.getElementById("btn-next-phase");
        const btnEnd = document.getElementById("end-turn-button");
        const btnCancel = document.getElementById("btn-cancel-target");
        if (btnNext) {
            btnNext.hidden = true;
            btnNext.disabled = true;
        }
        if (btnEnd) {
            btnEnd.disabled = !canAct || gs.gameOver || selecting;
        btnEnd.textContent = "结束回合";
        }
        if (btnCancel) btnCancel.style.display = selecting ? "inline-block" : "none";
    }

    _showGraveyardSelect(gs, h) {
        const grid = document.getElementById("graveyard-grid");
        if (!grid) return;
        const chars = gs.currentPlayer.graveyard.filter(c => c.type === "monster");
        grid.innerHTML = chars.length === 0 ? '<p style="text-align:center;color:#888">墓地没有怪兽</p>' : "";
        chars.forEach(c => { const el = document.createElement("div"); el.className = `card in-hand rarity-${c.rarity || "N"}`; el.innerHTML = this.cardHTML(c); el.style.cursor = "pointer"; el.addEventListener("click", () => h.onConfirmTarget(c)); el.addEventListener("contextmenu", (e) => { e.preventDefault(); this.showDetail(c); }); grid.appendChild(el); });
        this.graveyardOverlay.classList.add("active");
        document.getElementById("graveyard-close").onclick = () => h.onCancelTarget();
        this.graveyardOverlay.onclick = (e) => { if (e.target === this.graveyardOverlay) h.onCancelTarget(); };
    }

    _showTributeSelect(gs, h) {
        const pt = gs.pendingTribute;
        if (!pt) return;
        document.getElementById("tribute-title").textContent = `选择${pt.needed}只祭品 (已选${pt.selected.length})`;
        const grid = document.getElementById("tribute-grid");
        grid.innerHTML = "";
        pt.player.monsterZone.forEach(c => {
            const el = document.createElement("div");
            el.className = `card in-hand rarity-${c.rarity || "N"} ${pt.selected.includes(c) ? "tribute-selected" : ""}`;
            el.innerHTML = this.cardHTML(c);
            el.style.cursor = "pointer";
            el.addEventListener("click", () => h.onSelectTribute(c));
            el.addEventListener("contextmenu", (e) => { e.preventDefault(); this.showDetail(c); });
            grid.appendChild(el);
        });
        this.tributeOverlay.classList.add("active");
        document.getElementById("tribute-confirm").onclick = () => h.onConfirmTribute();
        document.getElementById("tribute-cancel").onclick = () => h.onCancelTribute();
        this.tributeOverlay.onclick = (e) => { if (e.target === this.tributeOverlay) h.onCancelTribute(); };
    }

    showHandoff(name, cb) { document.getElementById("handoff-text").textContent = `请将设备交给 ${name}`; this.handoffOverlay.classList.add("active"); const btn = document.getElementById("handoff-confirm"); const nb = btn.cloneNode(true); btn.parentNode.replaceChild(nb, btn); nb.addEventListener("click", () => { this.handoffOverlay.classList.remove("active"); cb(); }); }

    cardHTML(card) {
        const attr = card.attribute || card.element || "none";
        const isMonster = card.type === "monster";
        const starterClass = card.series === "starter_ygo" ? " starter-ygo-frame" : "";
        const description = card.series === "starter_ygo"
            ? ""
            : `<div class="card-body"><div class="card-desc">${this._esc(card.description)}</div></div>`;
        const typeLabel = isMonster ? `<span class="type-label">怪兽</span>` : "";
        let stats = "";
        if (isMonster) { stats = `<div class="stat-atk"><span>ATK</span>${card.currentAttack ?? card.attack}</div><div class="stat-def"><span>DEF</span>${card.currentDefense ?? card.defense}</div>`; }
        else { stats = `<div class="stat-type">${card.type === "trap" ? "TRAP" : "SPELL"}</div>`; }
        return `<div class="card-frame elem-${attr} type-${card.type} member-${card.member || "none"} rarity-${card.rarity || "N"}${starterClass}"><div class="card-header"><span class="card-name">${this._esc(card.name)}</span><span class="card-element-badge">${ELEMENT_ICONS[attr] || ""}</span><span class="card-cost">${card.level || ""}</span></div><div class="card-art"><div class="card-art-inner">${getCardImageHTML(card)}</div></div>${description}<div class="card-footer">${stats}${typeLabel}</div></div>`;
    }

    showDetail(card) {
        const attr = card.attribute || card.element || "none";
        const typeName = card.type === "monster" ? "怪兽卡" : card.type === "spell" ? "魔法卡" : "陷阱卡";
        const raceName = RACE_NAMES[card.race] || "";
        const rarityName = { N: "普通", R: "稀有", SR: "超稀有", SSR: "传说" }[card.rarity] || "";
        document.getElementById("detail-name").textContent = card.name;
        document.getElementById("detail-type").textContent = `${typeName} · ${ELEMENT_NAMES[attr] || ""}属性 · ${raceName} · Lv.${card.level || "?"} · ${rarityName}`;
        document.getElementById("detail-desc").innerHTML = cardEffectFieldsHtml(card);
        document.getElementById("detail-card-display").innerHTML = `<div class="card detail-card">${this.cardHTML(card)}</div>`;
        this.hideCardActions();
        this.detailOverlay?.classList.add("active");
        document.body.classList.add("battle-modal-open");
    }

    hideDetail() {
        this.detailOverlay?.classList.remove("active");
        document.body.classList.remove("battle-modal-open");
    }

    showGameOver(winner, names, isDraw, reason = "") {
        const icon = document.getElementById("gameover-icon"), title = document.getElementById("gameover-title"), text = document.getElementById("gameover-text");
        const reward = document.getElementById("gameover-reward");
        if (reward) reward.innerHTML = "正在结算奖励…";
        if (isDraw) {
            icon.textContent = "DRAW";
            title.textContent = "平局";
            title.dataset.result = "draw";
            text.textContent = "双方LP同时归零";
        } else {
            icon.textContent = winner === 0 ? "VICTORY" : "DEFEAT";
            title.textContent = winner === 0 ? "决斗胜利" : "决斗败北";
            title.dataset.result = winner === 0 ? "win" : "loss";
            text.textContent = reason ? `${names[winner]} 获胜 · ${reason}` : `${names[winner]} 获胜`;
        }
        document.getElementById("gameover-overlay").classList.add("active");
    }

    setGameOverReward(reward) {
        const el = document.getElementById("gameover-reward");
        if (!el || !reward) return;
        el.innerHTML = `<span>获得决斗币</span><strong>+${Number(reward.duelCoins || 0).toLocaleString()}</strong>${(reward.bonuses || []).map(item => `<small>${this._esc(item.label)} +${item.amount}</small>`).join("")}`;
    }

    hideGameOver() { document.getElementById("gameover-overlay").classList.remove("active"); }

    addLog(msg, type, details = null) {
        const d = document.createElement("div");
        d.className = `log-entry ${type || ""}`;
        d.textContent = msg;
        this.logBody.appendChild(d);
        this.logBody.scrollTop = this.logBody.scrollHeight;
        const sourceCard = details?.card || null;
        const card = sourceCard ? {
            id: sourceCard.id,
            name: sourceCard.name,
            type: sourceCard.type,
            rarity: sourceCard.rarity,
            level: sourceCard.level,
            attack: sourceCard.attack,
            defense: sourceCard.defense,
            image: sourceCard.image || sourceCard.thumbnail,
            description: sourceCard.description,
            effects: (sourceCard.effects || []).map(effect => ({ description: effect?.description })),
        } : null;
        this._logEntries.push({
            msg,
            type,
            turn: this._currentTurn || 0,
            card,
            private: details?.private === true,
        });
    }
    clearLog() { this.logBody.innerHTML = ""; this._logEntries = []; }
    _esc(s) { if (!s) return ""; const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
}
