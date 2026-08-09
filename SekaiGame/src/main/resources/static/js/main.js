/**
 * main.js - 浜у搧鍏ュ彛锛氳璇併€佸瓨妗ｃ€佹父鎴忓ぇ鍘呬笌鍐虫枟娴佺▼
 */
import { Player, GameState } from "./model.js";
import { GameEngine } from "./engine.js?v=1.7.19";
import { GameUI } from "./ui.js?v=1.7.21";
import { GameController } from "./controller.js?v=1.6.27";
import { CardGameApp } from "./app.js?v=1.8.3";
import { ALL_CARDS, getCardById, hydrateCardArt } from "./catalog.js?v=1.8.4";
import { getAIDeck } from "./decks.js?v=1.7.1";
import { SeededRandom } from "./rng.js";
import { GAME_CONFIG } from "./constants.js";
import { loadSave, saveData } from "./storage.js?v=1.7.4";
import { createNewProfile, ensureProfile } from "./profile.js?v=1.7.1";
import { enableDemoMode } from "./collection.js?v=1.7.0";
import { createDeck } from "./deck.js?v=1.7.4";
import { calculateMatchReward, applyReward } from "./rewards.js?v=1.7.4";
import * as api from "./api.js?v=1.7.4";
import { saveAuth, loadAuth, clearAuth, isAuthenticated } from "./auth.js";

function showFatalGameError(error) {
    const message = error instanceof Error
        ? `${error.message}\n\n${error.stack || ""}`
        : String(error || "Unknown error");
    let panel = document.getElementById("fatal-game-error");
    if (!panel) {
        panel = document.createElement("section");
        panel.id = "fatal-game-error";
        panel.style.cssText = "position:fixed;z-index:10000;left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,calc(100vw - 32px));padding:24px;border:1px solid #ff7b99;background:#15101b;color:#fff;box-shadow:0 20px 70px rgba(0,0,0,.5);font:16px/1.6 system-ui,sans-serif";
        document.body.appendChild(panel);
    }
    panel.innerHTML = `<strong style="display:block;margin-bottom:8px;color:#ff9bb1">PvP 鍒濆鍖栧け璐?/strong><code style="white-space:pre-wrap;word-break:break-word">${message.replace(/[&<>]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char])}</code><p style="margin:14px 0 0;color:#d9c9d0">璇锋埅鍥炬鎻愮ず鍙戦€佺粰寮€鍙戣€呫€?/p>`;
}

window.addEventListener("error", event => showFatalGameError(event.error || event.message));
window.addEventListener("unhandledrejection", event => showFatalGameError(event.reason));

let collection = null;
let currentController = null;
let currentUI = null;
let currentMatch = null;
let matchSettled = false;
let app = null;

// ---- Auth Screen Logic ----
const authScreen = document.getElementById("auth-screen");
const authForm = document.getElementById("auth-form");
const authError = document.getElementById("auth-error");
const authTabs = document.querySelectorAll("[data-auth-mode]");
const nickField = document.querySelector(".auth-nick-field");
let authMode = "login";

// 绂荤嚎鐢ㄦ埛瀛樺偍
const OFFLINE_USERS_KEY = "nightcord_offline_users";
function getOfflineUsers() {
    try { return JSON.parse(localStorage.getItem(OFFLINE_USERS_KEY)) || {}; } catch { return {}; }
}
function saveOfflineUser(username, password, nickname) {
    const users = getOfflineUsers();
    users[username] = { password, nickname: nickname || username };
    localStorage.setItem(OFFLINE_USERS_KEY, JSON.stringify(users));
}
function verifyOfflineUser(username, password) {
    const users = getOfflineUsers();
    const user = users[username];
    if (!user) return null;
    if (user.password === password) return { username, nickname: user.nickname };
    return null;
}

// 棰勭疆鐢ㄦ埛锛歴ekai / sekai-demo-pass
(function seedOfflineUsers() {
    const users = getOfflineUsers();
    if (!users["sekai"]) {
        users["sekai"] = { password: "sekai-demo-pass", nickname: "sekai" };
        localStorage.setItem(OFFLINE_USERS_KEY, JSON.stringify(users));
    }
})();

authTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        authMode = tab.dataset.authMode;
        authTabs.forEach(t => t.classList.toggle("active", t === tab));
        nickField.classList.toggle("hidden", authMode === "login");
        authError.textContent = "";
    });
});

// 璺敱锛氭牴鎹?URL 璺緞鍐冲畾鏄剧ず鐧诲綍銆佹敞鍐屻€佽繕鏄父鎴?
function getPathRoute() {
    const path = window.location.pathname.replace(/\/+$/, "");
    if (path === "/register") return "register";
    if (path === "/login") return "login";
    if (path === "/game" || path === "") return "game";
    return "game";
}

function showAuthScreen(mode) {
    authMode = mode;
    authTabs.forEach(t => t.classList.toggle("active", t.dataset.authMode === mode));
    nickField.classList.toggle("hidden", mode === "login");
    authScreen.classList.remove("hidden");
    document.getElementById("app-shell").classList.add("is-hidden");
}

function attachAuthHandler() {
    const form = document.getElementById("auth-form");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("auth-username").value.trim();
    const password = document.getElementById("auth-password").value;
    const nickname = document.getElementById("auth-nickname").value.trim();
    if (!username || !password) { authError.textContent = "璇峰～鍐欑敤鎴峰悕鍜屽瘑鐮?; return; }

    authError.textContent = "";
    const submitBtn = form.querySelector(".auth-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "澶勭悊涓?..";

    let result;
    if (authMode === "register") {
        if (!nickname) { authError.textContent = "璇峰～鍐欐樀绉?; submitBtn.disabled = false; submitBtn.textContent = "纭"; return; }
        result = await api.register(username, password, nickname);
        if (!result.success) {
            const allowOffline = ["localhost", "127.0.0.1"].includes(location.hostname);
            if (allowOffline) {
                const users = getOfflineUsers();
                if (users[username]) { authError.textContent = "鐢ㄦ埛鍚嶅凡瀛樺湪"; submitBtn.disabled = false; submitBtn.textContent = "纭"; return; }
                saveOfflineUser(username, password, nickname);
                result = { success: true, userId: null, username, nickname };
            } else {
                authError.textContent = result.reason || "娉ㄥ唽澶辫触";
                submitBtn.disabled = false;
                submitBtn.textContent = "纭";
                return;
            }
        }
    } else {
        result = await api.login(username, password);
        if (!result.success) {
            const allowOffline = ["localhost", "127.0.0.1"].includes(location.hostname);
            const offlineUser = allowOffline ? verifyOfflineUser(username, password) : null;
            if (offlineUser) {
                result = { success: true, userId: null, username: offlineUser.username, nickname: offlineUser.nickname };
            } else {
                authError.textContent = "鐢ㄦ埛鍚嶆垨瀵嗙爜閿欒锛屾垨鏈嶅姟鍣ㄦ殏鏃朵笉鍙敤";
                submitBtn.disabled = false;
                submitBtn.textContent = "纭";
                return;
            }
        }
    }

    if (result.success) {
        saveAuth({ userId: result.userId, username: result.username, nickname: result.nickname });
        // 鐧诲綍/娉ㄥ唽鎴愬姛鍚庤烦杞埌娓告垙棣栭〉
        if (getPathRoute() !== "game") {
            window.location.href = "/";
            return;
        }
        startApp();
    } else {
        authError.textContent = result.reason || "鎿嶄綔澶辫触";
    }
    submitBtn.disabled = false;
    submitBtn.textContent = "纭";
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachAuthHandler, { once: true });
} else {
    attachAuthHandler();
}

// ---- Server Sync ----
async function syncFromServer(userId) {
    const [userResult, decksResult, collectionResult] = await Promise.all([
        api.getUser(userId),
        api.getUserDecks(userId),
        api.getUserCollection(userId),
    ]);

    if (userResult.success) {
        collection.profile.name = userResult.username || collection.profile.name;
        collection.currency.duelCoins = userResult.duelCoins ?? collection.currency.duelCoins;
        try {
            collection.currency.shards = JSON.parse(userResult.shardsJson || "{}");
            collection.pityCounters = JSON.parse(userResult.pityCountersJson || "{}");
        } catch { /* 淇濈暀鏈湴缁忔祹鏁版嵁 */ }
        collection.statistics.packsOpened = userResult.packsOpened ?? collection.statistics.packsOpened;
        collection.statistics.duelsPlayed = userResult.duelsPlayed ?? collection.statistics.duelsPlayed;
        collection.statistics.wins = userResult.wins ?? collection.statistics.wins;
        collection.statistics.losses = userResult.losses ?? collection.statistics.losses;
        collection.statistics.draws = userResult.draws ?? collection.statistics.draws;
    }

    // 鐧诲綍鐢ㄦ埛瀹屽叏浠ユ湇鍔＄鍗＄粍涓哄噯锛岄伩鍏嶆棫娴忚鍣ㄥ瓨妗ｉ噸鏂颁笂浼犳湭鎷ユ湁鍗°€?
    if (decksResult.success && Array.isArray(decksResult.decks)) {
        const serverDecks = decksResult.decks.map(d => ({
            id: d.id,
            name: d.name,
            coverCardId: d.coverCardId,
            main: (d.deckCards || []).filter(c => c.slotType === "main").sort((a, b) => a.position - b.position).map(c => c.cardId || c.card?.id),
            extra: (d.deckCards || []).filter(c => c.slotType === "extra").sort((a, b) => a.position - b.position).map(c => c.cardId || c.card?.id),
            side: (d.deckCards || []).filter(c => c.slotType === "side").sort((a, b) => a.position - b.position).map(c => c.cardId || c.card?.id),
            createdAt: d.createdAt ? new Date(d.createdAt).getTime() : Date.now(),
            updatedAt: d.updatedAt ? new Date(d.updatedAt).getTime() : Date.now(),
        }));
        collection.decks = serverDecks;
        if (!collection.selectedDeckId || !collection.decks.find(d => d.id === collection.selectedDeckId)) {
            collection.selectedDeckId = collection.decks[0]?.id || null;
        }
    }

    const serverCollection = Array.isArray(collectionResult)
        ? collectionResult
        : Object.values(collectionResult).filter(item => item && typeof item === "object" && item.cardId);
    collection.inventorySynced = Boolean(collectionResult.success && serverCollection.length > 0);
    if (collectionResult.success && serverCollection.length > 0) {
        collection.cards = {};
        for (const item of serverCollection) {
            collection.cards[item.cardId] = item.count || 0;
        }
    }

    collection.decks = (collection.decks || []).map(deck => {
        const used = {};
        const main = (deck.main || []).filter(cardId => {
            const owned = Number(collection.cards[cardId] || 0);
            used[cardId] = (used[cardId] || 0) + 1;
            return owned > 0 && used[cardId] <= owned && getCardById(cardId)?.enabled !== false;
        });
        return { ...deck, main };
    });
    return collection.inventorySynced;
}

async function syncDuelToServer(userId, matchResult, reward, mode = "ai", stage = null) {
    await api.recordDuel(userId, {
        result: matchResult,
        opponentType: mode,
        opponentName: stage?.opponent || (mode === "pvp" ? "PvP鐜╁" : "Nightcord AI"),
        coinsEarned: reward?.duelCoins || 0,
    });
    await api.updateUser(userId, { duelCoins: collection.currency.duelCoins });
}

// ---- App Start ----
async function startApp() {
    authScreen.classList.add("hidden");
    document.getElementById("app-shell").classList.remove("is-hidden");

    collection = ensureProfile(loadSave() || createNewProfile());

    // 娴嬭瘯妯″紡锛氬叏鍗3 + 999999鍐虫枟甯侊紙浠呭湪璁剧疆涓墜鍔ㄥ紑鍚椂鐢熸晥锛?
    if (collection.settings.demoMode) {
        enableDemoMode(collection, ALL_CARDS);
        collection.currency.duelCoins = 999999;
    }

    saveData(collection);

    const auth = loadAuth();
    if (auth?.userId) {
        let synced = false;
        try { synced = await syncFromServer(auth.userId); } catch (e) { synced = false; }
        if (!synced) {
            clearAuth();
            document.getElementById("app-shell").classList.add("is-hidden");
            authScreen.classList.remove("hidden");
            authError.textContent = "鐧诲綍鐘舵€佸凡澶辨晥锛岃閲嶆柊鐧诲綍浠ュ悓姝ユ湇鍔″櫒鍗＄墝";
            return;
        }
        if (String(auth.username || "").toLowerCase() === "sekai") {
            collection.cards = Object.fromEntries(
                ALL_CARDS.filter(card => card.enabled !== false).map(card => [card.id, 3]),
            );
            collection.inventorySynced = true;
        }
        saveData(collection);
    }

    app = new CardGameApp(collection, {
        onStartDuel: config => createNewGame(config.mode, config.deck, config.pvpClient, config.gameInfo, config),
    });

    // Logout button in settings
    const originalRenderSettings = app.renderSettings.bind(app);
    app.renderSettings = function() {
        originalRenderSettings();
        const settingsPanel = this.screenRoot.querySelector(".settings-panel");
        if (settingsPanel) {
            const logoutBtn = document.createElement("button");
            logoutBtn.className = "secondary-action";
            logoutBtn.style.marginTop = "12px";
            logoutBtn.style.borderColor = "rgba(255,111,141,.4)";
            logoutBtn.style.color = "#ffc4d0";
            logoutBtn.textContent = "閫€鍑虹櫥褰?;
            logoutBtn.addEventListener("click", () => {
                clearAuth();
                location.reload();
            });
            settingsPanel.appendChild(logoutBtn);
        }
    };
}

// ---- Game Logic ----
function buildDeckCards(deckDefinition) {
    return deckDefinition.main
        .map(cardId => getCardById(cardId))
        .filter(Boolean)
        .map(card => hydrateCardArt(card, collection.selectedArtByCard));
}

function createNewGame(mode = "ai", playerDeck = app.getSelectedDeck(), pvpClient = null, gameInfo = null, matchConfig = {}) {
    if (!playerDeck) {
        app.showShell();
        app.toast("娌℃湁鍙敤鍗＄粍", "error");
        return;
    }
    currentController?.clearAiTimer();
    matchSettled = false;
    currentMatch = { mode, playerDeck, pvpClient, stage: matchConfig.stage || null, opponentDeck: matchConfig.opponentDeck || null };

    // PvP妯″紡锛氫娇鐢ㄥ叡浜殢鏈虹瀛愶紝纭繚鍙屾柟闅忔満缁撴灉涓€鑷?
    let rng = null;
    if (mode === "pvp" && gameInfo?.seed) {
        rng = new SeededRandom(gameInfo.seed);
    }

    // 鏋勫缓瀵规墜鍗＄粍
    let opponentCards;
    if (mode === "pvp" && gameInfo?.opponentDeck) {
        // PvP锛氫粠鍚屾鐨勫崱鐗孖D鍒楄〃鏋勫缓瀵规墜鍗＄粍
        opponentCards = gameInfo.opponentDeck
            .map(cardId => getCardById(cardId))
            .filter(Boolean)
            .map(card => hydrateCardArt(card, collection.selectedArtByCard));
    } else {
        // AI锛氫娇鐢ㄥ拰鐜╁涓€鏍风殑鍗＄粍
        opponentCards = buildDeckCards(matchConfig.opponentDeck || playerDeck);
    }

    const playerCards = mode === "pvp" && Array.isArray(gameInfo?.deck)
        ? gameInfo.deck.map(cardId => getCardById(cardId)).filter(Boolean).map(card => hydrateCardArt(card, collection.selectedArtByCard))
        : buildDeckCards(playerDeck);
    const preserveDeckOrder = mode === "pvp";
    const state = new GameState();
    state.players = [
        new Player(collection.profile?.name || "鍐虫枟鑰?, playerCards, rng, preserveDeckOrder),
        new Player(gameInfo?.opponentName || matchConfig.stage?.opponent || (mode === "training" ? "缁冧範 AI" : "Nightcord AI"), opponentCards, rng, preserveDeckOrder),
    ];

    const engine = new GameEngine(state, rng);
    currentUI = currentUI || new GameUI();
    currentController = new GameController(state, engine, currentUI);
    currentController.mode = mode === "training" ? "ai" : mode;
    if (matchConfig.stage) {
        currentController.aiDifficulty = matchConfig.stage.difficulty;
        currentController.aiProfile = { ...(matchConfig.stage.ai || {}) };
        currentController.aiMaxMainActions = matchConfig.stage.ai?.maxMainActions
            || ({ easy: 3, normal: 5, hard: 7, expert: 9, nightmare: 11 })[matchConfig.stage.difficulty]
            || 5;
        currentController.aiActionDelay = ({ easy: 800, normal: 600, hard: 420, expert: 300, nightmare: 220 })[matchConfig.stage.difficulty] || 600;
    }
    currentController.pvpClient = pvpClient;
    currentUI.mode = mode;
    currentUI.onReturnHome = () => {
        if (pvpClient) pvpClient.disconnect();
        app.navigate("home");
    };
    currentController.onGameOver = result => settleMatch(result);
    currentUI.clearLog();
    currentUI.showBattle();

    if (mode === "pvp" && pvpClient) {
        // PvP妯″紡锛氭牴鎹厛鎵?鍚庢墜鍐冲畾鏄惁绔嬪嵆琛屽姩
        const isMyTurn = gameInfo.yourIndex === gameInfo.firstPlayer;
        if (!isMyTurn) {
            currentUI.addLog("绛夊緟瀵规墜琛屽姩...", "turn");
        }
        // 鐩戝惉瀵规墜鎿嶄綔
        pvpClient.onAction = (action, playerIndex) => {
            if (playerIndex === 1 - gameInfo.yourIndex) {
                currentController.applyRemoteAction(action);
            }
        };
        pvpClient.onTurnChange = currentPlayer => {
            currentController.clearTurnAckTimer?.();
            currentController.turnEnding = false;
            if (currentPlayer === gameInfo.yourIndex) {
                currentController.onPvpTurnStart?.();
            } else {
                currentController.state.currentPlayerIndex = 1;
                currentController.checkAndRefresh();
            }
        };
        pvpClient.onOpponentDisconnect = () => { currentController.onGameOver({ winner: 0, isDraw: false }); };
        pvpClient.onGameOver = (winner, reason) => {
            const myWin = winner === gameInfo.yourIndex;
            currentController.onGameOver({ winner: myWin ? 0 : 1, isDraw: false });
        };
        for (let i = 0; i < GAME_CONFIG.START_HAND_SIZE; i++) {
            engine.drawCard(state.players[0]);
            engine.drawCard(state.players[1]);
        }
        state.turn = 0;
        state.firstTurn = true;
        state.currentPlayerIndex = isMyTurn ? 0 : 1;
        currentController.checkAndRefresh();
        if (isMyTurn) {
            currentController._pvpSend({ type: "turnStart" });
            currentController._beginTurn({ openingTurn: true });
        }
    } else {
        currentController.start();
    }
}

function settleMatch({ winner, isDraw }) {
    if (matchSettled || !currentMatch) return;
    matchSettled = true;
    let result = "draw";
    if (!isDraw) result = winner === 0 ? "win" : "loss";
    const reward = calculateMatchReward(result, {
        statistics: collection.statistics,
        mode: currentMatch.mode,
        stage: currentMatch.stage,
    }, collection);
    applyReward(collection, reward);
    if (result === "win" && currentMatch.stage) {
        collection.stageProgress ||= {};
        collection.stageProgress[currentMatch.stage.id] = { cleared: true, clearedAt: Date.now() };
    }
    saveData(collection);
    currentUI?.setGameOverReward(reward);
    app.renderTopbar();

    // Sync duel to backend
    const auth = loadAuth();
    if (auth) syncDuelToServer(auth.userId, result, reward, currentMatch.mode, currentMatch.stage).catch(() => {});
}

function returnHome() {
    currentController?.clearAiTimer();
    currentUI?.hideGameOver();
    currentUI?.showMenu();
}

function rematch() {
    currentUI?.hideGameOver();
    if (currentMatch) {
        if (currentMatch.mode === "pvp" && currentMatch.pvpClient) {
            currentMatch.pvpClient.disconnect();
            app.navigate("home");
            app.toast("PvP瀵规垬宸茬粨鏉燂紝璇烽噸鏂板垱寤烘埧闂?, "info");
            return;
        }
        createNewGame(currentMatch.mode, currentMatch.playerDeck, null, null, currentMatch);
    }
}

let domBindingsInitialized = false;

function initializeDomBindings() {
    if (domBindingsInitialized) return;
    domBindingsInitialized = true;

    currentUI ||= new GameUI();
    currentUI.onReturnHome = () => app?.navigate("home");

    document.querySelector("#end-turn-button")?.addEventListener("click", () => currentController?.endTurn());
    document.querySelector("#btn-next-phase")?.addEventListener("click", () => currentController?.nextPhase());
    document.querySelector("#btn-cancel-target")?.addEventListener("click", () => {
        if (!currentController) return;
        if (currentController.state.phase === "tribute_select") currentController.cancelTribute();
        else currentController.cancelTargetSelect();
    });
    document.querySelector("#btn-battle-exit")?.addEventListener("click", returnHome);
    document.querySelector("#btn-back-menu")?.addEventListener("click", returnHome);
    document.querySelector("#btn-rematch")?.addEventListener("click", rematch);
    document.querySelector("#log-toggle")?.addEventListener("click", () => document.body.classList.toggle("duel-log-collapsed"));
    document.querySelector("#log-collapse-inline")?.addEventListener("click", () => document.body.classList.add("duel-log-collapsed"));

    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        if (currentUI?.closeTopOverlay?.()) return;
        if (currentController?.state.phase === "tribute_select") currentController.cancelTribute();
        else if (currentController?.state.phase === "target_select" || currentController?.state.phase === "graveyard_select") currentController.cancelTargetSelect();
    });

    app?.renderTopbar();
    console.log("Nightcord Duel Network 宸插姞杞?, { cards: ALL_CARDS.length });
}

// ---- Entry Point ----
// URL 鍔??reset 鍙己鍒舵竻妗ｉ噸鏉?
if (new URLSearchParams(location.search).has("reset")) {
    localStorage.removeItem("dimensional_duel_save");
    localStorage.removeItem("nightcord_auth");
    localStorage.setItem("nightcord_offline_users", JSON.stringify({
        "sekai": { password: "sekai-demo-pass", nickname: "sekai" }
    }));
    history.replaceState(null, "", location.pathname);
}

// ---- 璺敱鍒濆鍖?----
const route = getPathRoute();
if (route === "login") {
    // /login 鈫?寮哄埗鏄剧ず鐧诲綍椤?
    showAuthScreen("login");
} else if (route === "register") {
    // /register 鈫?寮哄埗鏄剧ず娉ㄥ唽椤?
    showAuthScreen("register");
} else {
    // / 鎴?/game 鈫?宸茬櫥褰曡繘娓告垙锛屾湭鐧诲綍璺?/login
    if (isAuthenticated()) {
        startApp();
    } else {
        window.location.href = "/login";
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeDomBindings, { once: true });
} else {
    initializeDomBindings();
}

