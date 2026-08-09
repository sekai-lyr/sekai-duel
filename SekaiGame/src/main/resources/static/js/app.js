/**
 * app.js - 游戏大厅、商店、收藏与卡组编辑器
 */
import {
    addArt,
    addCard,
    canCraft,
    craftCard,
    dismantleCard,
    getCardCount,
    getPityCount,
    incrementPity,
    resetPity,
    setSelectedArt,
    spendDuelPoints,
} from "./collection.js?v=1.7.0";
import { ALL_CARDS, getCardArts, getCardById, hydrateCardArt } from "./catalog.js?v=1.8.4";
import { NIGHTCORD_PACK, openPack, openTenPacks } from "./packs.js?v=1.7.2";
import { buildSuggestedDeck, getCardCopyLimit, validateDeck } from "./deck.js?v=1.7.4";
import { saveData } from "./storage.js?v=1.7.4";
import { loadAuth } from "./auth.js";
import { createDeck as createServerDeck, deleteDeck as deleteServerDeck, saveUserCollection, updateDeck as updateServerDeck } from "./api.js?v=1.7.4";
import { cardArtHtml, cardEffectFieldsHtml, catalogCardHtml, escapeHtml, MEMBER_NAMES, TYPE_NAMES, rarityRank } from "./card-view.js?v=1.1.0";
import { AI_STAGES, buildStageDeck, isStageUnlocked } from "./stages.js?v=1.8.2";

const ROUTES = new Set(["home", "shop", "collection", "decks", "rules", "settings"]);
const NIGHTCORD_ONLY = ALL_CARDS;
const PACK_POOL = ALL_CARDS.filter(card => card.series !== "starter_ygo");

export function matchesDeckSearch(card, keyword) {
    const query = String(keyword || "").trim().toLocaleLowerCase("zh-CN");
    if (!query) return true;
    const effectText = Array.isArray(card.effects)
        ? card.effects.map(effect => `${effect?.type || ""} ${effect?.description || ""}`).join(" ")
        : "";
    const searchable = [
        card.name,
        card.description,
        card.type,
        TYPE_NAMES[card.type],
        card.attribute,
        card.rarity,
        card.race,
        effectText,
    ].filter(Boolean).join(" ").toLocaleLowerCase("zh-CN");
    return searchable.includes(query);
}

export function deckBattleValue(card) {
    const designedValue = Number(card?.aiHints?.priority);
    if (Number.isFinite(designedValue)) return designedValue;
    const rarityValue = { N: 10, R: 25, SR: 45, SSR: 65, UR: 85 }[card?.rarity] || 0;
    const statValue = card?.type === "monster"
        ? ((Number(card.attack) || 0) + (Number(card.defense) || 0)) / 200
        : 0;
    const effectValue = Array.isArray(card?.effects) ? Math.min(card.effects.length * 3, 15) : 0;
    return rarityValue + statValue + effectValue;
}

export class CardGameApp {
    constructor(collection, { onStartDuel }) {
        this.collection = collection;
        this.onStartDuel = onStartDuel;
        this.shell = document.getElementById("app-shell");
        this.screenRoot = document.getElementById("screen-root");
        this.modalRoot = document.getElementById("modal-root");
        this.toastRoot = document.getElementById("toast-root");
        this.route = "home";
        this.collectionFilters = { search: "", member: "all", rarity: "all", type: "all", owned: "all" };
        this.selectedCollectionCardId = NIGHTCORD_ONLY[0]?.id || null;
        this.deckDraft = null;
        this.deckSourceFilter = { search: "", type: "all", attribute: "all", rarity: "all", level: "all", owned: "owned" };
        this.deckViewFilter = "all";
        this.bindGlobalEvents();
        this.navigate("home");
    }

    bindGlobalEvents() {
        document.querySelectorAll("[data-route]").forEach(button => {
            button.addEventListener("click", () => this.navigate(button.dataset.route));
        });
        document.getElementById("brand-home")?.addEventListener("click", () => this.navigate("home"));
        this.modalRoot.addEventListener("click", event => {
            if (event.target === this.modalRoot || event.target.closest("[data-close-modal]")) this.closeModal();
        });
        document.getElementById("detail-overlay")?.addEventListener("click", event => {
            if (event.target === document.getElementById("detail-overlay") || event.target.closest("[data-detail-close]")) {
                document.getElementById("detail-overlay").classList.remove("active");
                document.body.classList.remove("battle-modal-open");
            }
        });
        document.addEventListener("error", event => {
            const img = event.target;
            if (!(img instanceof HTMLImageElement) || !img.closest(".art-media")) return;
            img.hidden = true;
            img.nextElementSibling?.classList.add("visible");
        }, true);
    }

    showCardDetail(card) {
        if (!card) return;
        const attr = card.attribute || card.element || "none";
        const typeName = card.type === "monster" ? "怪兽卡" : card.type === "spell" ? "魔法卡" : "陷阱卡";
        const raceName = { dragon: "龙族", warrior: "战士族", spellcaster: "魔法师族", beast: "兽族", machine: "机械族", fiend: "恶魔族", fairy: "天使族", rock: "岩石族", aqua: "水族", winged_beast: "鸟兽族", insect: "昆虫族" }[card.race] || "";
        const rarityName = { N: "普通", R: "稀有", SR: "超稀有", SSR: "传说", UR: "究极" }[card.rarity] || "";
        const monsterStats = card.type === "monster"
            ? ` · ATK ${Number(card.attack) || 0} · DEF ${Number(card.defense) || 0}`
            : "";
        document.getElementById("detail-name").textContent = card.name;
        document.getElementById("detail-type").textContent = `${typeName} · ${({ fire: "火", water: "水", wind: "风", earth: "地", light: "光", dark: "暗" })[attr] || ""}属性 · ${raceName} · Lv.${card.level || "?"} · ${rarityName}${monsterStats}`;
        document.getElementById("detail-desc").innerHTML = cardEffectFieldsHtml(card);
        document.getElementById("detail-card-display").innerHTML = `<div class="card detail-card">${cardArtHtml(card, "detail-art")}</div>`;
        document.getElementById("detail-overlay").classList.add("active");
        document.body.classList.add("battle-modal-open");
    }

    showShell() {
        this.shell.classList.remove("is-hidden");
        document.getElementById("battle-screen")?.classList.remove("active");
        this.renderTopbar();
    }

    hideShell() {
        this.shell.classList.add("is-hidden");
    }

    navigate(route) {
        if (!ROUTES.has(route)) route = "home";
        this.route = route;
        this.showShell();
        document.querySelectorAll("[data-route]").forEach(button => {
            button.classList.toggle("active", button.dataset.route === route);
        });
        if (route === "home") this.renderHome();
        if (route === "shop") this.renderShop();
        if (route === "collection") this.renderCollection();
        if (route === "decks") this.renderDeckEditor(true);
        if (route === "rules") this.renderRules();
        if (route === "settings") this.renderSettings();
    }

    renderTopbar() {
        const profile = this.collection.profile || { name: "决斗者", level: 1 };
        document.getElementById("profile-name").textContent = profile.name;
        document.getElementById("profile-level").textContent = `LV.${profile.level || 1}`;
        document.getElementById("coin-count").textContent = formatNumber(this.collection.currency.duelCoins || 0);
        document.getElementById("shard-count").textContent = formatNumber(Object.values(this.collection.currency.shards || {}).reduce((a, b) => a + b, 0));
    }

    renderHome() {
        const deck = this.getSelectedDeck();
        const validation = deck ? validateDeck(deck, ALL_CARDS, this.collection) : { valid: false, errors: ["没有选择卡组"], stats: {} };
        const cover = hydrateCardArt(getCardById(deck?.coverCardId || deck?.main?.[0]), this.collection.selectedArtByCard);
        const recentCards = Object.entries(this.collection.cards)
            .filter(([, count]) => count > 0)
            .slice(-4)
            .map(([id, count]) => ({ card: hydrateCardArt(getCardById(id), this.collection.selectedArtByCard), count }))
            .filter(item => item.card);
        const pity = getPityCount(this.collection, NIGHTCORD_PACK.id);

        this.screenRoot.innerHTML = `
            <section class="home-hero">
                <div class="hero-copy">
                    <span class="eyebrow">NIGHTCORD DUEL NETWORK</span>
                    <h1>让你的收藏，真正进入决斗。</h1>
                    <p>抽取主题卡牌、编辑主卡组，并在完整的回合制战场中挑战AI。</p>
                    <div class="hero-actions">
                        <button class="primary-action" id="home-stage-duel" ${validation.valid ? "" : "disabled"}>挑战关卡</button>
                        <button class="secondary-action" id="home-start-duel" ${validation.valid ? "" : "disabled"}>练习决斗</button>
                        <button class="secondary-action" id="home-pvp-create" ${validation.valid ? "" : "disabled"}>创建房间</button>
                        <button class="secondary-action" id="home-pvp-join">加入房间</button>
                        <button class="secondary-action" data-jump="decks">编辑卡组</button>
                    </div>
                    ${validation.valid ? "" : `<p class="validation-line">当前卡组不可用：${escapeHtml(validation.errors[0])}</p>`}
                </div>
                <div class="hero-art">${cover ? cardArtHtml(cover, "hero-cover", true) : ""}<div class="hero-vignette"></div></div>
            </section>

            <section class="dashboard-grid">
                <article class="dashboard-panel deck-panel">
                    <div class="panel-heading"><div><span class="eyebrow">MAIN DECK</span><h2>${escapeHtml(deck?.name || "未选择卡组")}</h2></div><span class="status-pill ${validation.valid ? "ok" : "bad"}">${validation.valid ? "可出战" : "需调整"}</span></div>
                    <div class="deck-summary">
                        <div><strong>${validation.stats?.total || deck?.main?.length || 0}</strong><span>卡牌</span></div>
                        <div><strong>${validation.stats?.monsters || 0}</strong><span>角色</span></div>
                        <div><strong>${validation.stats?.spells || 0}</strong><span>魔法</span></div>
                        <div><strong>${validation.stats?.traps || 0}</strong><span>陷阱</span></div>
                    </div>
                    <button class="text-action" data-jump="decks">查看卡组构成 →</button>
                </article>

                <article class="dashboard-panel mission-panel">
                    <div class="panel-heading"><div><span class="eyebrow">DAILY OBJECTIVE</span><h2>今日首次胜利</h2></div><span class="reward-number">+300</span></div>
                    <p>${this.collection.statistics.firstWinToday === new Date().toDateString() ? "今日奖励已领取。" : "在AI决斗中取得一次胜利即可获得额外决斗币。"}</p>
                    <div class="progress-track"><span style="width:${this.collection.statistics.firstWinToday === new Date().toDateString() ? 100 : 0}%"></span></div>
                </article>
            </section>

            <section class="recent-section">
                <div class="section-heading"><div><span class="eyebrow">COLLECTION</span><h2>最近拥有的卡牌</h2></div><button class="text-action" data-jump="collection">打开收藏 →</button></div>
                <div class="recent-grid">${recentCards.length ? recentCards.map(({ card, count }) => catalogCardHtml(card, count, { compact: true })).join("") : "<p class='empty-copy'>收藏还没有卡牌。</p>"}</div>
            </section>`;

        this.screenRoot.querySelector("#home-start-duel")?.addEventListener("click", () => this.startDuel());
        this.screenRoot.querySelector("#home-stage-duel")?.addEventListener("click", () => this.showStageModal());
        this.screenRoot.querySelector("#home-pvp-create")?.addEventListener("click", () => this.createPvpRoom());
        this.screenRoot.querySelector("#home-pvp-join")?.addEventListener("click", () => this.showJoinPvpModal());
        this.bindJumpButtons();
        this.bindCardDetailClicks();
    }

    renderShop() {
        const pity = getPityCount(this.collection, NIGHTCORD_PACK.id);
        const cover = hydrateCardArt(getCardById("nc_sp_ur_001"), this.collection.selectedArtByCard);
        this.screenRoot.innerHTML = `
            <section class="screen-heading"><div><span class="eyebrow">CARD PACK SHOP</span><h1>卡包商店</h1><p>仅消耗游戏内决斗币，不涉及真实支付。</p></div></section>
            <section class="shop-layout">
                <article class="featured-pack rarity-UR">
                    <div class="featured-pack-image">${cardArtHtml(cover, "pack-cover-art", true)}<div class="pack-logo"><span>LIMITED SELECTION</span><strong>25时，Nightcord</strong></div></div>
                    <div class="featured-pack-content">
                        <div class="pack-tags"><span>${NIGHTCORD_ONLY.length}张基础卡</span><span>全卡池</span><span>UR 0.5%</span></div>
                        <h2>次元全明星卡池</h2>
                        <p>每包8张，第8张至少R。十包抽取至少包含一张SR；最晚第100包获得UR。</p>
                        <div class="pity-block"><div><span>UR保底</span><strong>${pity} / 100</strong></div><div class="progress-track"><span style="width:${Math.min(100, pity / 100 * 100)}%"></span></div></div>
                        <div class="purchase-row">
                            <button class="pack-buy" data-open-count="1"><span>抽取1包</span><strong>1000 决斗币</strong></button>
                            <button class="pack-buy featured" data-open-count="10"><span>抽取10包</span><strong>9000 决斗币</strong></button>
                        </div>
                    </div>
                </article>
                <aside class="shop-side">
                    <article class="dashboard-panel"><span class="eyebrow">BALANCE</span><div class="big-currency">${formatNumber(this.collection.currency.duelCoins)}</div><p>当前决斗币</p></article>
                    <article class="dashboard-panel probability-list"><span class="eyebrow">PROBABILITY</span><div><span>N</span><strong>62%</strong></div><div><span>R</span><strong>25%</strong></div><div><span>SR</span><strong>9%</strong></div><div><span>SSR</span><strong>3.5%</strong></div><div><span>UR</span><strong>0.5%</strong></div></article>
                </aside>
            </section>`;
        this.screenRoot.querySelectorAll("[data-open-count]").forEach(button => {
            button.addEventListener("click", () => this.confirmPackOpen(Number(button.dataset.openCount)));
        });
    }

    confirmPackOpen(count) {
        const cost = count === 10 ? NIGHTCORD_PACK.tenCost.duelCoins : NIGHTCORD_PACK.cost.duelCoins;
        const balance = this.collection.currency.duelCoins;
        this.openModal(`
            <section class="modal-panel purchase-confirm">
                <button class="modal-close" data-close-modal aria-label="关闭">×</button>
                <span class="eyebrow">PURCHASE CONFIRMATION</span>
                <h2>抽取${count === 10 ? "10包" : "1包"}</h2>
                <div class="purchase-math"><div><span>消耗</span><strong>${formatNumber(cost)}</strong></div><div><span>当前</span><strong>${formatNumber(balance)}</strong></div><div><span>抽取后</span><strong>${formatNumber(Math.max(0, balance - cost))}</strong></div></div>
                ${balance < cost ? `<p class="validation-line">决斗币不足，还差 ${formatNumber(cost - balance)}。</p>` : ""}
                <div class="modal-actions"><button class="secondary-action" data-close-modal>取消</button><button class="primary-action" id="confirm-pack-open" ${balance < cost ? "disabled" : ""}>确认抽取</button></div>
            </section>`);
        this.modalRoot.querySelector("#confirm-pack-open")?.addEventListener("click", () => this.openPacks(count));
    }

    openPacks(count) {
        const cost = count === 10 ? NIGHTCORD_PACK.tenCost.duelCoins : NIGHTCORD_PACK.cost.duelCoins;
        if (!spendDuelPoints(this.collection, cost)) {
            this.toast("决斗币不足", "error");
            return;
        }
        const pity = getPityCount(this.collection, NIGHTCORD_PACK.id);
        const opened = count === 10
            ? openTenPacks(NIGHTCORD_PACK, PACK_POOL, undefined, pity)
            : openPack(NIGHTCORD_PACK, PACK_POOL, undefined, pity);
        if (!opened.success) {
            this.collection.currency.duelCoins += cost;
            this.toast(opened.reason || "卡包开启失败", "error");
            return;
        }

        const reveals = opened.cards.map(card => this.collectPulledCard(card));
        const gotUR = opened.cards.some(card => card.rarity === "UR");
        if (count === 10) {
            this.collection.pityCounters[NIGHTCORD_PACK.id] = { packsSinceUR: gotUR ? 0 : opened.packsSinceUR };
        } else if (gotUR) {
            resetPity(this.collection, NIGHTCORD_PACK.id);
        } else {
            incrementPity(this.collection, NIGHTCORD_PACK.id);
        }
        this.collection.statistics.packsOpened += count;
        saveData(this.collection);
        this.syncCollectionToServer();
        this.renderTopbar();
        this.showPackAnimation(reveals, count);
    }

    collectPulledCard(card) {
        const previousCount = getCardCount(this.collection, card.id);
        const addResult = addCard(this.collection, card.id, 1, ALL_CARDS);
        const variants = getCardArts(card.id);
        const art = variants.length ? variants[Math.floor(Math.random() * variants.length)] : null;
        const newArt = art ? addArt(this.collection, art.artId) : false;
        if (art && !this.collection.selectedArtByCard[card.id]) setSelectedArt(this.collection, card.id, art.artId);
        return {
            card: hydrateCardArt(card, art ? { [card.id]: art.artId } : this.collection.selectedArtByCard),
            newCard: previousCount === 0,
            newArt,
            shards: addResult.shardsEarned,
        };
    }

    showPackAnimation(reveals, count) {
        const highest = [...reveals].sort((a, b) => rarityRank(b.card.rarity) - rarityRank(a.card.rarity))[0]?.card.rarity || "N";
        this.openModal(`
            <section class="pack-opening-stage rarity-${escapeHtml(highest)}" id="pack-opening-stage">
                <div class="pack-orbit"></div>
                <div class="digital-pack"><span>25:00</span><strong>NIGHTCORD</strong><small>${count === 10 ? "TEN PACKS" : "SELECTION PACK"}</small></div>
                <p>抽取结果已确定</p>
                <button class="primary-action" id="reveal-pack-results">揭晓结果</button>
            </section>`);
        this.modalRoot.querySelector("#reveal-pack-results")?.addEventListener("click", () => this.showPackResults(reveals, count));
    }

    showPackResults(reveals, count) {
        const summary = reveals.reduce((acc, item) => {
            acc[item.card.rarity] = (acc[item.card.rarity] || 0) + 1;
            acc.newCards += item.newCard ? 1 : 0;
            acc.newArts += item.newArt ? 1 : 0;
            acc.shards += item.shards || 0;
            return acc;
        }, { N: 0, R: 0, SR: 0, SSR: 0, UR: 0, newCards: 0, newArts: 0, shards: 0 });
        const sorted = [...reveals].sort((a, b) => rarityRank(b.card.rarity) - rarityRank(a.card.rarity));
        this.modalRoot.innerHTML = `
            <section class="modal-panel pack-results-panel">
                <button class="modal-close" data-close-modal aria-label="关闭">×</button>
                <div class="section-heading"><div><span class="eyebrow">PACK RESULTS</span><h2>${count === 10 ? "十包抽取结果" : "卡包抽取结果"}</h2></div><div class="result-summary"><span>R ${summary.R}</span><span>SR ${summary.SR}</span><span>SSR ${summary.SSR}</span><span>UR ${summary.UR}</span></div></div>
                <div class="pack-result-grid">${sorted.map(item => `
                    <article class="result-card rarity-${escapeHtml(item.card.rarity)}">
                        ${cardArtHtml(item.card, "result-art")}
                        <div class="result-card-copy"><span>${escapeHtml(item.card.rarity)} · ${escapeHtml(TYPE_NAMES[item.card.type])}</span><strong>${escapeHtml(item.card.name)}</strong><small>${item.newCard ? "NEW CARD" : item.newArt ? "NEW ART" : item.shards ? `重复 · +${item.shards}碎片` : "已拥有"}</small></div>
                    </article>`).join("")}</div>
                <div class="pack-result-footer"><div><strong>${summary.newCards}</strong><span>新卡</span></div><div><strong>${summary.newArts}</strong><span>新插画</span></div><div><strong>${summary.shards}</strong><span>碎片</span></div><button class="primary-action" data-close-modal>完成</button></div>
            </section>`;
        this.renderShop();
    }

    renderCollection() {
        const filtered = ALL_CARDS
            .filter(card => this.filterCollectionCard(card))
            .sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || a.name.localeCompare(b.name, "zh-CN"));
        const selectedBase = getCardById(this.selectedCollectionCardId) || filtered[0] || ALL_CARDS[0];
        const selected = hydrateCardArt(selectedBase, this.collection.selectedArtByCard);
        const owned = getCardCount(this.collection, selected?.id);
        const arts = selected ? getCardArts(selected.id) : [];

        this.screenRoot.innerHTML = `
            <section class="screen-heading"><div><span class="eyebrow">CARD LIBRARY</span><h1>卡牌收藏</h1><p>已拥有 ${Object.keys(this.collection.cards).filter(cardId => (this.collection.cards[cardId] || 0) > 0 && getCardById(cardId)).length} / ${ALL_CARDS.length} 种卡牌。</p></div></section>
            <section class="collection-layout">
                <div class="collection-browser">
                    <div class="filter-bar">
                        <label class="search-control"><span>搜索</span><input id="collection-search" value="${escapeHtml(this.collectionFilters.search)}" placeholder="输入卡名"></label>
                        ${selectHtml("collection-member", "成员", this.collectionFilters.member, [["all", "全部"], ["ena", "东云绘名"], ["kanade", "宵崎奏"], ["mafuyu", "朝比奈真冬"], ["mizuki", "晓山瑞希"], ["group", "四人共同"]])}
                        ${selectHtml("collection-rarity", "稀有度", this.collectionFilters.rarity, [["all", "全部"], ["N", "N"], ["R", "R"], ["SR", "SR"], ["SSR", "SSR"], ["UR", "UR"]])}
                        ${selectHtml("collection-type", "类型", this.collectionFilters.type, [["all", "全部"], ["monster", "角色"], ["spell", "魔法"], ["trap", "陷阱"]])}
                        ${selectHtml("collection-owned", "状态", this.collectionFilters.owned, [["all", "全部"], ["yes", "已拥有"], ["no", "未拥有"]])}
                    </div>
                    <div class="collection-grid">${filtered.map(card => catalogCardHtml(hydrateCardArt(card, this.collection.selectedArtByCard), getCardCount(this.collection, card.id))).join("") || "<p class='empty-copy'>没有符合条件的卡牌。</p>"}</div>
                </div>
                <aside class="collection-detail">
                    ${selected ? `
                        ${cardArtHtml(selected, "detail-art-wide", true)}
                        <div class="detail-copy"><span class="eyebrow">${escapeHtml(selected.rarity)} · ${escapeHtml(MEMBER_NAMES[selected.member] || "Nightcord")}</span><h2>${escapeHtml(selected.name)}</h2><p>${escapeHtml(selected.description)}</p>
                        <div class="detail-stats"><div><span>拥有</span><strong>${owned}</strong></div>${selected.type === "monster" ? `<div><span>ATK</span><strong>${selected.attack}</strong></div><div><span>DEF</span><strong>${selected.defense}</strong></div>` : `<div><span>类型</span><strong>${escapeHtml(TYPE_NAMES[selected.type])}</strong></div>`}</div>
                        <div class="detail-actions"><button class="secondary-action" id="craft-card" ${canCraft(this.collection, selected.id, ALL_CARDS).canCraft ? "" : "disabled"}>制作1张 · ${canCraft(this.collection, selected.id, ALL_CARDS).cost || "—"}碎片</button><button class="secondary-action" id="dismantle-card" ${owned > 0 ? "" : "disabled"}>分解1张 · +${({ N: 5, R: 15, SR: 50, SSR: 100, UR: 200 })[selected.rarity] || 5}碎片</button></div>
                        <p class="empty-copy">当前 ${selected.rarity} 碎片：${this.collection.currency.shards?.[selected.rarity] || 0} · 同名卡最多拥有3张</p>
                        <div class="art-selector"><div class="section-heading"><h3>已解锁插画</h3><span>${arts.filter(art => this.collection.artCollection[art.artId]).length}/${arts.length}</span></div><div class="art-strip">${arts.map(art => `<button class="art-choice ${this.collection.selectedArtByCard[selected.id] === art.artId ? "selected" : ""} ${this.collection.artCollection[art.artId] ? "" : "locked"}" data-art-id="${escapeHtml(art.artId)}" ${this.collection.artCollection[art.artId] ? "" : "disabled"}><img src="${escapeHtml(art.thumbnail || art.image)}" alt="${escapeHtml(selected.name)}插画" loading="lazy"></button>`).join("") || "<p class='empty-copy'>暂无插画。</p>"}</div></div></div>` : ""}
                </aside>
            </section>`;

        this.bindCollectionControls();
        this.screenRoot.querySelectorAll(".catalog-card").forEach(card => {
            card.addEventListener("click", () => {
                this.selectedCollectionCardId = card.dataset.cardId;
                this.renderCollection();
            });
            card.addEventListener("contextmenu", e => { e.preventDefault(); this.showCardDetail(getCardById(card.dataset.cardId)); });
        });
        this.screenRoot.querySelectorAll("[data-art-id]").forEach(button => button.addEventListener("click", () => {
            setSelectedArt(this.collection, selected.id, button.dataset.artId);
            saveData(this.collection);
            this.renderCollection();
        }));
        this.screenRoot.querySelector("#craft-card")?.addEventListener("click", () => {
            const result = craftCard(this.collection, selected.id, ALL_CARDS);
            this.toast(result.success ? `制作成功：${selected.name}` : result.reason, result.success ? "success" : "error");
            if (result.success) {
                saveData(this.collection);
                this.syncCollectionToServer();
            }
            this.renderCollection();
        });
        this.screenRoot.querySelector("#dismantle-card")?.addEventListener("click", () => {
            const result = dismantleCard(this.collection, selected.id, ALL_CARDS);
            this.toast(result.success ? `分解成功：+${result.shards} ${selected.rarity}碎片` : result.reason, result.success ? "success" : "error");
            if (result.success) {
                saveData(this.collection);
                this.syncCollectionToServer();
            }
            this.renderCollection();
        });
    }

    async syncCollectionToServer() {
        const auth = loadAuth();
        if (!auth?.userId) return;
        const result = await saveUserCollection(auth.userId, {
            cards: this.collection.cards,
            duelCoins: this.collection.currency.duelCoins,
            shards: this.collection.currency.shards,
            pityCounters: this.collection.pityCounters,
            packsOpened: this.collection.statistics.packsOpened,
        });
        if (!result.success) this.toast("云端收藏同步失败，数据已保存在本机", "error");
    }

    filterCollectionCard(card) {
        const f = this.collectionFilters;
        if (f.search && !card.name.toLowerCase().includes(f.search.toLowerCase())) return false;
        if (f.member !== "all" && card.member !== f.member) return false;
        if (f.rarity !== "all" && card.rarity !== f.rarity) return false;
        if (f.type !== "all" && card.type !== f.type) return false;
        const owned = getCardCount(this.collection, card.id) > 0;
        if (f.owned === "yes" && !owned) return false;
        if (f.owned === "no" && owned) return false;
        return true;
    }

    bindCollectionControls() {
        const mapping = {
            "collection-search": "search",
            "collection-member": "member",
            "collection-rarity": "rarity",
            "collection-type": "type",
            "collection-owned": "owned",
        };
        for (const [id, key] of Object.entries(mapping)) {
            const element = this.screenRoot.querySelector(`#${id}`);
            element?.addEventListener(id === "collection-search" ? "input" : "change", () => {
                this.collectionFilters[key] = element.value;
                if (id === "collection-search") clearTimeout(this.searchTimer);
                this.searchTimer = setTimeout(() => {
                    this.renderCollection();
                    if (id === "collection-search") {
                        const next = this.screenRoot.querySelector("#collection-search");
                        next?.focus();
                        next?.setSelectionRange(next.value.length, next.value.length);
                    }
                }, id === "collection-search" ? 140 : 0);
            });
        }
    }

    renderDeckEditor(resetDraft = false) {
        const deck = this.getSelectedDeck();
        if (resetDraft) this.deckDraft = deck ? clone(deck) : null;
        else if (!this.deckDraft) this.deckDraft = deck ? clone(deck) : null;
        else if (!this.deckDraft.isNew && this.deckDraft.id !== deck?.id) this.deckDraft = deck ? clone(deck) : null;
        const validation = this.deckDraft ? validateDeck(this.deckDraft, ALL_CARDS, this.collection) : { valid: false, errors: ["没有卡组"], stats: {} };
        const counts = countIds(this.deckDraft?.main || []);
        const sf = this.deckSourceFilter;
        const vf = this.deckViewFilter;

        // 左侧：按筛选条件过滤可用卡牌
        let available = NIGHTCORD_ONLY.filter(card => {
            const owned = getCardCount(this.collection, card.id) > 0;
            if (sf.owned === "owned") return owned;
            if (sf.owned === "unowned") return !owned;
            return true;
        });
        available = available.filter(card => matchesDeckSearch(card, sf.search));
        if (sf.type !== "all") available = available.filter(c => c.type === sf.type);
        if (sf.attribute !== "all") available = available.filter(c => c.attribute === sf.attribute);
        if (sf.rarity !== "all") available = available.filter(c => c.rarity === sf.rarity);
        if (sf.level !== "all") available = available.filter(c => c.type === "monster" && Number(c.level) === Number(sf.level));
        available.sort((a, b) => deckBattleValue(b) - deckBattleValue(a)
            || rarityRank(b.rarity) - rarityRank(a.rarity)
            || a.name.localeCompare(b.name, "zh-CN"));

        // 右侧：按类型分类显示卡组内卡牌
        let deckCards = Object.entries(counts).map(([id, count]) => ({ card: hydrateCardArt(getCardById(id), this.collection.selectedArtByCard), count })).filter(item => item.card);
        if (vf !== "all") deckCards = deckCards.filter(item => item.card.type === vf);

        // 统计
        const allDeckCards = Object.entries(counts).map(([id, count]) => ({ card: getCardById(id), count })).filter(item => item.card);
        const monsterCount = allDeckCards.filter(i => i.card.type === "monster").reduce((s, i) => s + i.count, 0);
        const spellCount = allDeckCards.filter(i => i.card.type === "spell").reduce((s, i) => s + i.count, 0);
        const trapCount = allDeckCards.filter(i => i.card.type === "trap").reduce((s, i) => s + i.count, 0);
        const totalCards = this.deckDraft?.main.length || 0;

        // 左侧筛选按钮
        const typeFilters = [
            { key: "all", label: "全部" },
            { key: "monster", label: "角色" },
            { key: "spell", label: "魔法" },
            { key: "trap", label: "陷阱" },
        ];
        const attrFilters = [
            { key: "all", label: "全属性" },
            { key: "fire", label: "炎", color: "#ff6b35" },
            { key: "water", label: "水", color: "#4da6ff" },
            { key: "wind", label: "风", color: "#7ddf64" },
            { key: "earth", label: "地", color: "#c8a951" },
            { key: "light", label: "光", color: "#ffe066" },
            { key: "dark", label: "暗", color: "#b388ff" },
        ];
        const rarityFilters = [
            { key: "all", label: "全稀有" },
            { key: "UR", label: "UR", color: "#ff8c00" },
            { key: "SSR", label: "SSR", color: "#cc44ff" },
            { key: "SR", label: "SR", color: "#4488ff" },
            { key: "R", label: "R", color: "#44bb44" },
            { key: "N", label: "N", color: "#888" },
        ];
        const levelFilters = [
            { key: "all", label: "全部星级" },
            ...Array.from({ length: 10 }, (_, index) => ({ key: String(index + 1), label: `${index + 1}星` })),
        ];
        const ownershipFilters = [
            { key: "owned", label: "已拥有" },
            { key: "unowned", label: "未拥有" },
            { key: "all", label: "全部卡牌" },
        ];
        // 右侧分类
        const viewFilters = [
            { key: "all", label: `全部 (${totalCards})` },
            { key: "monster", label: `角色 (${monsterCount})` },
            { key: "spell", label: `魔法 (${spellCount})` },
            { key: "trap", label: `陷阱 (${trapCount})` },
        ];

        const makeFilterButtons = (items, activeKey, dataAttr) =>
            items.map(f => `<button class="deck-filter-btn ${f.key === activeKey ? "active" : ""}" data-${dataAttr}="${f.key}" ${f.color ? `style="--accent:${f.color}"` : ""}>${f.label}</button>`).join("");

        this.screenRoot.innerHTML = `
            <section class="screen-heading deck-heading">
                <div><span class="eyebrow">DECK CONSTRUCTION</span><h1>卡组编辑器</h1><p>从已拥有的卡牌中构筑40至60张主卡组。</p></div>
                <div class="deck-status"><strong>${totalCards}/60</strong><span class="status-pill ${validation.valid ? "ok" : "bad"}">${validation.valid ? "卡组合法" : "卡组不合法"}</span></div>
            </section>
            <section class="deck-editor-layout">
                <div class="deck-source">
                    <div class="section-heading"><div><span class="eyebrow">OWNED CARDS</span><h2>可用卡牌</h2></div><span>${available.length}种</span></div>
                    <label class="search-control deck-search-control"><span>关键词</span><input id="deck-card-search" value="${escapeHtml(sf.search || "")}" placeholder="搜索卡名、效果、属性或类型" autocomplete="off"></label>
                    <div class="deck-filter-row">${makeFilterButtons(ownershipFilters, sf.owned, "source-owned")}</div>
                    <div class="deck-filter-row">${makeFilterButtons(typeFilters, sf.type, "source-type")}</div>
                    <div class="deck-filter-row deck-level-filter">${makeFilterButtons(levelFilters, sf.level, "source-level")}</div>
                    <div class="deck-filter-row">${makeFilterButtons(attrFilters, sf.attribute, "source-attr")}</div>
                    <div class="deck-filter-row">${makeFilterButtons(rarityFilters, sf.rarity, "source-rarity")}</div>
                    <div class="deck-source-grid">${available.map(card => catalogCardHtml(hydrateCardArt(card, this.collection.selectedArtByCard), getCardCount(this.collection, card.id), { compact: true })).join("") || "<p class='empty-copy'>没有匹配的卡牌。</p>"}</div>
                </div>
                <div class="deck-workspace">
                    <div class="deck-name-row"><select id="deck-select" aria-label="选择卡组">${this.deckDraft?.isNew ? `<option value="" selected>新卡组草稿</option>` : ""}${this.collection.decks.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === this.deckDraft?.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select><input id="deck-name-input" value="${escapeHtml(this.deckDraft?.name || "")}" aria-label="卡组名称" placeholder="输入卡组名称"><button class="secondary-action" id="new-deck" ${this.collection.decks.length >= 3 ? "disabled" : ""}>新建卡组</button><button class="secondary-action" id="delete-deck" ${this.collection.decks.length <= 1 || this.deckDraft?.isNew ? "disabled" : ""}>删除卡组</button><button class="secondary-action" id="reset-starter">恢复入门卡组</button></div>
                    ${validation.errors.length ? `<div class="deck-errors">${validation.errors.slice(0, 3).map(error => `<p>${escapeHtml(error)}</p>`).join("")}</div>` : ""}
                    <div class="deck-filter-row">${makeFilterButtons(viewFilters, vf, "view-type")}</div>
                    <div class="deck-card-list">${deckCards.map(({ card, count }) => `<article class="deck-list-item" data-card-id="${escapeHtml(card.id)}">${cardArtHtml(card, "deck-list-art")}<div><span>${escapeHtml(card.rarity)} · ${escapeHtml(TYPE_NAMES[card.type])}</span><strong>${escapeHtml(card.name)}</strong></div><div class="deck-count-control"><button data-deck-remove="${escapeHtml(card.id)}">−</button><strong>${count}</strong><button data-deck-add="${escapeHtml(card.id)}">＋</button></div></article>`).join("") || "<p class='empty-copy'>该分类下没有卡牌。</p>"}</div>
                    <footer class="deck-editor-footer"><div class="deck-breakdown"><span>角色 ${monsterCount}</span><span>魔法 ${spellCount}</span><span>陷阱 ${trapCount}</span></div><button class="primary-action" id="save-deck">保存卡组</button></footer>
                </div>
            </section>`;

        // 绑定左侧卡牌点击
        this.screenRoot.querySelectorAll(".deck-source .catalog-card").forEach(card => {
            card.title = "点击加入卡组，右键查看详情";
            card.addEventListener("click", () => this.addCardToDraft(card.dataset.cardId));
            card.addEventListener("contextmenu", e => { e.preventDefault(); this.showCardDetail(getCardById(card.dataset.cardId)); });
        });
        // 绑定右侧卡组内卡牌右键
        this.screenRoot.querySelectorAll(".deck-list-item").forEach(item => {
            item.addEventListener("contextmenu", e => { e.preventDefault(); this.showCardDetail(getCardById(item.dataset.cardId)); });
        });
        // 绑定加减按钮
        this.screenRoot.querySelectorAll("[data-deck-add]").forEach(button => button.addEventListener("click", () => this.addCardToDraft(button.dataset.deckAdd)));
        this.screenRoot.querySelectorAll("[data-deck-remove]").forEach(button => button.addEventListener("click", () => this.removeCardFromDraft(button.dataset.deckRemove)));
        // 绑定功能按钮
        this.screenRoot.querySelector("#save-deck")?.addEventListener("click", () => this.saveDeckDraft());
        this.screenRoot.querySelector("#new-deck")?.addEventListener("click", () => this.createNewDeck());
        this.screenRoot.querySelector("#delete-deck")?.addEventListener("click", () => this.deleteCurrentDeck());
        this.screenRoot.querySelector("#deck-name-input")?.addEventListener("input", event => {
            if (this.deckDraft) this.deckDraft.name = event.target.value;
        });
        this.screenRoot.querySelector("#deck-select")?.addEventListener("change", event => {
            const selected = this.collection.decks.find(item => item.id === event.target.value);
            if (!selected) return;
            this.collection.selectedDeckId = selected.id;
            this.deckDraft = clone(selected);
            saveData(this.collection);
            this.renderDeckEditor(false);
        });
        this.screenRoot.querySelector("#reset-starter")?.addEventListener("click", () => {
            if (!this.deckDraft) return;
            const main = buildSuggestedDeck({ collection: this.collection, cardDatabase: ALL_CARDS, size: 40 });
            this.deckDraft.main = main;
            this.deckDraft.extra = [];
            this.deckDraft.side = [];
            this.deckDraft.coverCardId = main[0] || null;
            this.renderDeckEditor(false);
        });
        // 绑定左侧筛选
        this.screenRoot.querySelectorAll("[data-source-type]").forEach(btn => btn.addEventListener("click", () => { this.deckSourceFilter.type = btn.dataset.sourceType; this._resetDeckScroll(); this.renderDeckEditor(false); }));
        this.screenRoot.querySelectorAll("[data-source-level]").forEach(btn => btn.addEventListener("click", () => { this.deckSourceFilter.level = btn.dataset.sourceLevel; this._resetDeckScroll(); this.renderDeckEditor(false); }));
        this.screenRoot.querySelectorAll("[data-source-attr]").forEach(btn => btn.addEventListener("click", () => { this.deckSourceFilter.attribute = btn.dataset.sourceAttr; this._resetDeckScroll(); this.renderDeckEditor(false); }));
        this.screenRoot.querySelectorAll("[data-source-rarity]").forEach(btn => btn.addEventListener("click", () => { this.deckSourceFilter.rarity = btn.dataset.sourceRarity; this._resetDeckScroll(); this.renderDeckEditor(false); }));
        this.screenRoot.querySelectorAll("[data-source-owned]").forEach(btn => btn.addEventListener("click", () => { this.deckSourceFilter.owned = btn.dataset.sourceOwned; this._resetDeckScroll(); this.renderDeckEditor(false); }));
        this.screenRoot.querySelector("#deck-card-search")?.addEventListener("input", event => {
            this.deckSourceFilter.search = event.target.value;
            this.renderDeckEditor(false);
            const nextInput = this.screenRoot.querySelector("#deck-card-search");
            nextInput?.focus();
            nextInput?.setSelectionRange(nextInput.value.length, nextInput.value.length);
        });
        // 绑定右侧分类
        this.screenRoot.querySelectorAll("[data-view-type]").forEach(btn => btn.addEventListener("click", () => { this.deckViewFilter = btn.dataset.viewType; this._resetDeckScroll(); this.renderDeckEditor(false); }));


    }

    _resetDeckScroll() {
        if (!this.screenRoot) return;
        requestAnimationFrame(() => {
            const el = this.screenRoot.querySelector(".deck-source-grid");
            if (el) el.scrollTop = 0;
            const cl = this.screenRoot.querySelector(".deck-card-list");
            if (cl) cl.scrollTop = 0;
        });
    }

    addCardToDraft(cardId) {
        if (!this.deckDraft) return;
        const scroll = this._captureDeckScroll();
        const card = getCardById(cardId);
        if (!card || card.enabled === false) return this.toast("该卡牌不可用", "error");
        const count = this.deckDraft.main.filter(id => id === cardId).length;
        const owned = getCardCount(this.collection, cardId);
        if (owned <= 0) return this.toast("你尚未拥有该卡牌", "error");
        const copyLimit = getCardCopyLimit(card);
        if (this.deckDraft.main.length >= 60) return this.toast("主卡组最多60张", "error");
        if (count >= copyLimit) return this.toast(`${card?.name || "该卡"}最多只能携带${copyLimit}张`, "error");
        if (count >= owned) return this.toast("拥有数量不足", "error");
        this.deckDraft.main.push(cardId);
        this.renderDeckEditor(false);
        this._restoreDeckScroll(scroll);
    }

    removeCardFromDraft(cardId) {
        if (!this.deckDraft) return;
        const scroll = this._captureDeckScroll();
        const index = this.deckDraft.main.lastIndexOf(cardId);
        if (index >= 0) this.deckDraft.main.splice(index, 1);
        this.renderDeckEditor(false);
        this._restoreDeckScroll(scroll);
    }

    async saveDeckDraft() {
        if (!this.deckDraft) return;
        const auth = loadAuth();
        if (auth?.userId && !this.collection.inventorySynced) {
            return this.toast("服务器库存尚未同步，请刷新页面后重试", "error");
        }
        this.deckDraft.name = this.screenRoot.querySelector("#deck-name-input")?.value.trim() || "未命名卡组";
        const validation = validateDeck(this.deckDraft, ALL_CARDS, this.collection);
        if (!validation.valid) return this.toast(validation.errors[0], "error");
        this.deckDraft.coverCardId = this.deckDraft.coverCardId && this.deckDraft.main.includes(this.deckDraft.coverCardId)
            ? this.deckDraft.coverCardId
            : this.deckDraft.main[0];
        if (auth?.userId) {
            const existing = this.collection.decks.find(deck => deck.id === this.deckDraft.id);
            const result = existing
                ? await updateServerDeck(this.deckDraft.id, {
                    name: this.deckDraft.name,
                    coverCardId: this.deckDraft.coverCardId,
                    main: this.deckDraft.main,
                    extra: this.deckDraft.extra || [],
                    side: this.deckDraft.side || [],
                })
                : await createServerDeck(auth.userId, this.deckDraft.name, this.deckDraft.coverCardId, this.deckDraft.main);
            if (!result.success) return this.toast(result.reason || "服务器保存失败", "error");
            if (!existing && result.id) this.deckDraft.id = result.id;
        }
        delete this.deckDraft.isNew;
        this.deckDraft.updatedAt = Date.now();
        const index = this.collection.decks.findIndex(deck => deck.id === this.deckDraft.id);
        if (index >= 0) this.collection.decks[index] = clone(this.deckDraft);
        else this.collection.decks.push(clone(this.deckDraft));
        this.collection.selectedDeckId = this.deckDraft.id;
        saveData(this.collection);
        this.toast("卡组已保存并设为主卡组", "success");
        this.renderTopbar();
        this.renderDeckEditor(true);
    }

    createNewDeck() {
        if (this.collection.decks.length >= 3) return this.toast("每个用户最多保存3副卡组", "error");
        const id = "deck_" + Date.now();
        const newDeck = { id, name: "新卡组", coverCardId: null, main: [], extra: [], side: [], isNew: true, createdAt: Date.now(), updatedAt: Date.now() };
        this.deckDraft = clone(newDeck);
        this.toast("已创建新卡组", "success");
        this.renderDeckEditor(false);
    }

    _captureDeckScroll() {
        const nameInput = this.screenRoot?.querySelector("#deck-name-input");
        if (nameInput && this.deckDraft) this.deckDraft.name = nameInput.value;
        return {
            source: this.screenRoot?.querySelector(".deck-source-grid")?.scrollTop || 0,
            deck: this.screenRoot?.querySelector(".deck-card-list")?.scrollTop || 0,
        };
    }

    _restoreDeckScroll(scroll) {
        requestAnimationFrame(() => {
            const source = this.screenRoot?.querySelector(".deck-source-grid");
            const deck = this.screenRoot?.querySelector(".deck-card-list");
            if (source) source.scrollTop = scroll.source;
            if (deck) deck.scrollTop = scroll.deck;
        });
    }

    async deleteCurrentDeck() {
        if (!this.deckDraft || this.collection.decks.length <= 1) return;
        const index = this.collection.decks.findIndex(d => d.id === this.deckDraft.id);
        if (index < 0) return;
        const auth = loadAuth();
        if (auth?.userId) {
            const result = await deleteServerDeck(this.deckDraft.id);
            if (!result.success) return this.toast(result.reason || "服务器删除失败", "error");
        }
        this.collection.decks.splice(index, 1);
        this.collection.selectedDeckId = this.collection.decks[0]?.id || null;
        this.deckDraft = null;
        saveData(this.collection);
        this.toast("卡组已删除", "success");
        this.renderDeckEditor(true);
    }

    renderRules() {
        const detailedRules = [
            ["01", "胜利与失败", "双方初始8000LP。将对方LP降至0，或令对方抽卡时无牌可抽即可获胜；同时归零为平局。"],
            ["02", "回合流程", "抽卡 → 准备 → 主要阶段1 → 战斗 → 主要阶段2 → 结束。先攻首回合不能攻击，临时效果在注明的阶段清理。"],
            ["03", "召唤与祭品", "每回合通常召唤或盖放合计1次。1～4星无需祭品；5～6星解放1只；7～12星解放2只。怪兽区最多5只。"],
            ["04", "特殊与翻转", "特殊召唤不占通常召唤次数，但必须满足效果。里侧守备怪兽可主动翻开；被攻击时先翻开并结算翻转效果。"],
            ["05", "魔法卡", "通常魔法发动后进入墓地，场地魔法持续生效。带目标的魔法必须选择合法目标；目标提前离场时该部分不结算。"],
            ["06", "陷阱卡", "陷阱须先盖放并经过一次回合交换。响应攻击时先处理无效、破坏、回手、反伤或减伤，再进行伤害计算。"],
            ["07", "怪兽效果", "登场、连携与终式按卡面文字顺序结算。手动效果需点击发动；标有“1回合1次”的效果每回合只能使用一次。"],
            ["08", "战斗伤害", "攻击对攻击表示时，较弱者破坏并承受差值；攻击守备表示时比较攻击与守备，通常不造成LP伤害。无怪兽时可直接攻击。"],
            ["09", "保护与除外", "不会被战斗破坏仍会计算伤害，也不防效果破坏、回手或除外。暂时除外的卡在文字注明的时点返回。"],
            ["10", "共鸣", "场上存在至少2名不同Nightcord成员时进入共鸣。不同卡会追加抽牌、保护、伤害或反击，具体以卡面文字为准。"],
            ["11", "卡组构筑", "主卡组40～60张，同名卡最多3张；额外与副卡组各最多15张。高星怪需要足够低星怪作为祭品。"],
            ["12", "稀有度", "N偏基础，R强化单一战术，SR形成两段组合，SSR拥有完整连锁，UR可改变场面；稀有度越高不代表无条件取胜。"],
            ["13", "AI关卡", "越高关卡拥有越强牌池、更多Boss与更多行动次数。第三关起使用祭品召唤，高关卡会保留陷阱并优先处理威胁。"],
            ["14", "收藏与联机", "未拥有卡可预览但不能组入卡组。联机以服务器状态为准，合法操作成功后同步，刷新会恢复最近服务器快照。"],
            ["15", "角色卡的“强度”", "强度不是攻击力，也不是稀有度。它是部分角色卡在召唤成功时临时计算出的效果数值：卡面会明确写出“基础值＋统计数量×成长值”，最低按1计算且最高1800。随后“蓄势、固守、冲击”等效果会使用这个数值结算。"],
            ["16", "蓄势、固守、冲击、治愈", "蓄势＝此卡攻击力上升强度；固守＝此卡守备力上升强度；冲击＝给予对方相当于强度70%的效果伤害；治愈＝己方恢复等同强度的LP。"],
            ["17", "压制、封锁、墓地净化", "压制＝降低对方攻击力最高怪兽的攻击力；封锁＝对方全部怪兽本回合不能攻击；墓地净化＝从对方墓地除外卡牌，被除外的卡不再位于墓地。"],
            ["18", "具现化、手牌重构、攻守逆转", "具现化＝特殊召唤1只衍生物；手牌重构＝丢弃1张手牌后抽2张；攻守逆转＝交换对方攻击力最高怪兽的攻击力与守备力。"],
            ["19", "击退与全体庇护", "击退＝将对方攻击力最低的怪兽返回持有者手牌，不视为破坏；全体庇护＝己方怪兽本回合不会被战斗破坏，但仍可能受到战斗伤害，也仍可被效果破坏、回手或除外。"],
        ];
        this.screenRoot.innerHTML = `<section class="screen-heading"><div><span class="eyebrow">DUEL MANUAL</span><h1>决斗规则</h1><p>回合、召唤、卡效、构筑与联机的完整说明。</p></div></section><section class="rules-grid">${detailedRules.map(([number, title, body]) => `<article class="rule-panel"><span>${number}</span><h2>${title}</h2><p>${body}</p></article>`).join("")}</section>`;
        return;
        this.screenRoot.innerHTML = `
            <section class="screen-heading"><div><span class="eyebrow">DUEL MANUAL</span><h1>决斗规则</h1><p>本项目采用游戏王式自动阶段规则：抽卡与准备阶段自动结算，玩家只需出牌、攻击和结束回合。</p></div></section>
            <section class="rules-grid">
                <article class="rule-panel"><span>01</span><h2>胜利条件</h2><p>将对方LP从8000降至0，或让对方在抽卡时无牌可抽。双方同时归零时判定平局。</p></article>
                <article class="rule-panel"><span>02</span><h2>通常召唤</h2><p>一回合仅限一次。1~4星无需祭品，5~6星解放1只怪兽，7~12星解放2只。可选攻击表示召唤或里侧守备盖放。</p></article>
                <article class="rule-panel"><span>03</span><h2>特殊召唤</h2><p>不限次数，出场可自由选择表侧状态。不占用通常召唤次数。</p></article>
                <article class="rule-panel"><span>04</span><h2>翻转召唤</h2><p>主要阶段将里侧守备怪兽翻开为表侧守备，不占通召次数，触发翻转效果，一回合不限次数。</p></article>
                <article class="rule-panel"><span>05</span><h2>攻守转换</h2><p>每只怪兽每回合只能手动变1次形态，仅限主要阶段。刚召唤/特召出场的怪兽本回合无法转换。</p></article>
                <article class="rule-panel"><span>06</span><h2>战斗阶段</h2><p>点击攻击表示怪兽会自动进入战斗阶段；选择合法目标。对方攻击里侧怪兽时自动翻开，先触发翻转效果再结算攻防。</p></article>
                <article class="rule-panel"><span>07</span><h2>共鸣机制</h2><p>己方场上存在至少两名不同Nightcord成员时，满足“共鸣”，部分卡牌获得追加效果。</p></article>
                <article class="rule-panel"><span>08</span><h2>卡组规则</h2><p>主卡组40至60张，同名卡最多3张；攻守任一达到4000的顶级怪兽限1张。额外卡组最多15张，副卡组最多15张。</p></article>
            </section>`;
    }

    renderSettings() {
        const settings = this.collection.settings;
        this.screenRoot.innerHTML = `
            <section class="screen-heading"><div><span class="eyebrow">SYSTEM</span><h1>设置</h1><p>视觉与操作选项保存在本地浏览器中。</p></div></section>
            <section class="settings-panel">
                <label class="setting-row"><div><strong>减少动态效果</strong><span>降低卡包和战斗中的动画强度。</span></div><input type="checkbox" id="setting-reduce" ${settings.reduceAnimations ? "checked" : ""}></label>
                <label class="setting-row"><div><strong>动画速度</strong><span>控制AI行动和界面演出的速度。</span></div><select id="setting-speed"><option value="0.7">慢速</option><option value="1">正常</option><option value="1.5">快速</option></select></label>
                <label class="setting-row"><div><strong>决斗日志</strong><span>控制战场右侧日志面板的显示。</span></div><input type="checkbox" id="setting-log" ${settings.logLevel !== 0 ? "checked" : ""}></label>
                <button class="primary-action" id="save-settings">保存设置</button>
            </section>`;
        const speed = this.screenRoot.querySelector("#setting-speed");
        speed.value = String(settings.animationSpeed || 1);
        this.screenRoot.querySelector("#save-settings")?.addEventListener("click", () => {
            settings.reduceAnimations = this.screenRoot.querySelector("#setting-reduce").checked;
            settings.animationSpeed = Number(speed.value);
            settings.logLevel = this.screenRoot.querySelector("#setting-log").checked ? 1 : 0;
            saveData(this.collection);
            document.body.classList.toggle("reduce-motion", settings.reduceAnimations);
            document.body.classList.toggle("hide-duel-log", settings.logLevel === 0);
            this.toast("设置已保存", "success");
        });
    }

    startDuel(stage = null) {
        const deck = this.getSelectedDeck();
        if (!deck) return this.toast("请先选择卡组", "error");
        const validation = validateDeck(deck, ALL_CARDS, this.collection);
        if (!validation.valid) return this.toast(validation.errors[0], "error");
        this.hideShell();
        this.onStartDuel(stage
            ? { mode: "ai", deck, stage, opponentDeck: buildStageDeck(stage) }
            : { mode: "training", deck });
    }

    showStageModal() {
        const cards = AI_STAGES.map(stage => {
            const unlocked = isStageUnlocked(this.collection, stage);
            const cleared = Boolean(this.collection.stageProgress?.[stage.id]?.cleared);
            return `<button class="stage-choice ${cleared ? "cleared" : ""}" data-stage-id="${stage.id}" ${unlocked ? "" : "disabled"}>
                <span class="stage-order">${unlocked ? stage.order : "🔒"}</span>
                <span><strong>${escapeHtml(stage.name)}</strong><small>${escapeHtml(stage.opponent)} · ${stage.difficulty.toUpperCase()}</small></span>
                <span class="stage-reward">${cleared ? "已通关" : `胜利 +${stage.reward}币`}</span>
            </button>`;
        }).join("");
        this.openModal(`<section class="modal-panel stage-modal">
            <button class="modal-close" data-close-modal aria-label="关闭">×</button>
            <span class="eyebrow">AI CHALLENGE</span><h2>决斗关卡</h2>
            <p>通关当前关卡后解锁下一关。难度、卡组强度与奖励逐关提升。</p>
            <div class="stage-list">${cards}</div>
        </section>`);
        this.modalRoot.querySelectorAll("[data-stage-id]").forEach(button => button.addEventListener("click", () => {
            const stage = AI_STAGES.find(item => item.id === button.dataset.stageId);
            if (!stage) return;
            this.closeModal();
            this.startDuel(stage);
        }));
    }

    async createPvpRoom() {
        const decks = this.collection.decks || [];
        const selectedId = this.collection.selectedDeckId || decks[0]?.id;
        const deck = decks.find(d => d.id === selectedId) || decks[0];
        if (!deck) return this.toast("请先选择卡组", "error");
        this.openModal(`
            <section class="modal-panel purchase-confirm">
                <button class="modal-close" data-close-modal aria-label="关闭">×</button>
                <span class="eyebrow">PVP ROOM</span>
                <h2>创建对战房间</h2>
                <label class="auth-field"><span>选择卡组</span>
                    <select id="pvp-create-deck-select">
                        ${decks.map(d => `<option value="${escapeHtml(d.id)}" ${d.id === selectedId ? "selected" : ""}>${escapeHtml(d.name)} (${d.main.length}张)</option>`).join("")}
                    </select>
                </label>
                <p class="validation-line" id="pvp-status"></p>
                <div class="modal-actions"><button class="secondary-action" data-close-modal>取消</button><button class="primary-action" id="pvp-create-confirm">创建房间</button></div>
            </section>`);
        document.getElementById("pvp-create-confirm")?.addEventListener("click", async () => {
            const deckId = document.getElementById("pvp-create-deck-select")?.value;
            const selectedDeck = this.collection.decks.find(d => d.id === deckId);
            if (!selectedDeck) return;
            const validation = validateDeck(selectedDeck, ALL_CARDS, this.collection);
            if (!validation.valid) { document.getElementById("pvp-status").textContent = validation.errors[0]; return; }
            document.getElementById("pvp-status").textContent = "正在连接服务器...";
            document.getElementById("pvp-create-confirm").disabled = true;
            try {
                const { PvPClient } = await import("./pvp.js?v=1.1.0");
                const pvp = new PvPClient();
                await pvp.connect();
                this._pvpClient = pvp;
                pvp.onError = (msg) => {
                    const status = document.getElementById("pvp-status");
                    if (status) status.textContent = `错误: ${msg}`;
                    else this.toast(msg || "PvP连接失败", "error");
                };
                pvp.onRoomCreated = (roomId) => {
                    document.getElementById("pvp-status").innerHTML = `房间号: <strong style="color:var(--accent);font-size:20px">${roomId}</strong><br>将此号码分享给朋友，等待加入...`;
                };
                pvp.onRoomJoined = (roomId, opponentName) => {
                    document.getElementById("pvp-status").textContent = `${opponentName} 加入了房间！正在准备决斗...`;
                    pvp.setDeck(selectedDeck.main);
                };
                pvp.onGameStart = (info) => {
                    pvp.onError = msg => this.toast(msg || "PvP同步失败", "error");
                    this.closeModal();
                    this.hideShell();
                    this.toast(`${info.opponentName} 已加入！你是${info.yourIndex === info.firstPlayer ? "先攻" : "后攻"}`, "success");
                    this.onStartDuel({ mode: "pvp", deck: selectedDeck, pvpClient: pvp, gameInfo: info });
                };
                const name = this.collection.profile?.name || "Player";
                pvp.createRoom(name);
            } catch (e) {
                document.getElementById("pvp-status").textContent = "PvP服务器未启动，请先运行 pvp-server.mjs";
                document.getElementById("pvp-create-confirm").disabled = false;
            }
        });
    }

    showJoinPvpModal() {
        const decks = this.collection.decks || [];
        const selectedId = this.collection.selectedDeckId || decks[0]?.id;
        this.openModal(`
            <section class="modal-panel purchase-confirm">
                <button class="modal-close" data-close-modal aria-label="关闭">×</button>
                <span class="eyebrow">JOIN PVP</span>
                <h2>加入对战房间</h2>
                <label class="auth-field"><span>房间号</span><input id="pvp-room-input" placeholder="输入朋友给的房间号"></label>
                <label class="auth-field"><span>选择卡组</span>
                    <select id="pvp-deck-select">
                        ${decks.map(d => `<option value="${escapeHtml(d.id)}" ${d.id === selectedId ? "selected" : ""}>${escapeHtml(d.name)} (${d.main.length}张)</option>`).join("")}
                    </select>
                </label>
                <p class="validation-line" id="pvp-join-status"></p>
                <div class="modal-actions"><button class="secondary-action" data-close-modal>取消</button><button class="primary-action" id="pvp-join-confirm">加入</button></div>
            </section>`);
        document.getElementById("pvp-join-confirm")?.addEventListener("click", async () => {
            const roomId = document.getElementById("pvp-room-input")?.value.trim();
            if (!roomId) { document.getElementById("pvp-join-status").textContent = "请输入房间号"; return; }
            const deckId = document.getElementById("pvp-deck-select")?.value;
            const deck = this.collection.decks.find(d => d.id === deckId);
            if (!deck) { document.getElementById("pvp-join-status").textContent = "请选择卡组"; return; }
            const validation = validateDeck(deck, ALL_CARDS, this.collection);
            if (!validation.valid) { document.getElementById("pvp-join-status").textContent = validation.errors[0]; return; }
            document.getElementById("pvp-join-status").textContent = "正在连接...";
            try {
                const { PvPClient } = await import("./pvp.js?v=1.1.0");
                const pvp = new PvPClient();
                await pvp.connect();
                this._pvpClient = pvp;
                pvp.onError = (msg) => {
                    const status = document.getElementById("pvp-join-status");
                    if (status) status.textContent = `错误: ${msg}`;
                    else this.toast(msg || "PvP连接失败", "error");
                };
                pvp.onRoomJoined = (rid, opponentName) => {
                    document.getElementById("pvp-join-status").textContent = `已加入房间！等待房主开始...`;
                    pvp.setDeck(deck.main);
                };
                pvp.onGameStart = (info) => {
                    pvp.onError = msg => this.toast(msg || "PvP同步失败", "error");
                    this.closeModal();
                    this.hideShell();
                    this.toast(`${info.opponentName} 的房间！你是${info.yourIndex === info.firstPlayer ? "先攻" : "后攻"}`, "success");
                    this.onStartDuel({ mode: "pvp", deck, pvpClient: pvp, gameInfo: info });
                };
                const name = this.collection.profile?.name || "Player";
                pvp.joinRoom(roomId, name);
            } catch (e) {
                document.getElementById("pvp-join-status").textContent = "PvP服务器未启动";
            }
        });
    }

    onStartPvp(pvpClient, deck, gameInfo) {
        this.hideShell();
        this.onStartDuel({ mode: "pvp", deck, pvpClient, gameInfo });
    }

    getSelectedDeck() {
        return this.collection.decks.find(deck => deck.id === this.collection.selectedDeckId) || this.collection.decks[0] || null;
    }

    bindJumpButtons() {
        this.screenRoot.querySelectorAll("[data-jump]").forEach(button => button.addEventListener("click", () => this.navigate(button.dataset.jump)));
    }

    bindCardDetailClicks() {
        this.screenRoot.querySelectorAll(".catalog-card").forEach(element => element.addEventListener("click", () => {
            this.selectedCollectionCardId = element.dataset.cardId;
            this.navigate("collection");
        }));
    }

    openModal(html) {
        this.modalRoot.innerHTML = html;
        this.modalRoot.classList.add("active");
    }

    closeModal() {
        this.modalRoot.classList.remove("active");
        this.modalRoot.innerHTML = "";
    }

    toast(message, type = "info") {
        const element = document.createElement("div");
        element.className = `toast ${type}`;
        element.textContent = message;
        this.toastRoot.appendChild(element);
        requestAnimationFrame(() => element.classList.add("visible"));
        setTimeout(() => {
            element.classList.remove("visible");
            setTimeout(() => element.remove(), 220);
        }, 2400);
    }
}

function selectHtml(id, label, selected, options) {
    return `<label class="select-control"><span>${escapeHtml(label)}</span><select id="${escapeHtml(id)}">${options.map(([value, text]) => `<option value="${escapeHtml(value)}" ${selected === value ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}</select></label>`;
}

function countIds(ids) {
    return ids.reduce((map, id) => {
        map[id] = (map[id] || 0) + 1;
        return map;
    }, {});
}

function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString("zh-CN");
}
