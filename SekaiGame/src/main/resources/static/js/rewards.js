/**
 * rewards.js - 对战奖励系统
 * 使用决斗币作为唯一货币，支持一次性领取保护
 */

export const REWARD_TABLE = {
    win: 120,
    loss: 50,
    draw: 60,
};

export const PVP_REWARD_TABLE = {
    win: 1000,
    loss: -333,
    draw: 0,
};

export const BONUS_REWARDS = [
    { id: "first_win_of_day", condition: (stats, match) => {
        const today = new Date().toDateString();
        return stats.firstWinToday !== today;
    }, amount: 300, label: "每日首次胜利" },
];

export const ONE_TIME_REWARDS = [
    { id: "tutorial_complete", amount: 2000, label: "教程完成奖励" },
    { id: "beat_ai_easy", amount: 500, label: "首次击败简单AI" },
    { id: "beat_ai_normal", amount: 500, label: "首次击败普通AI" },
    { id: "beat_ai_hard", amount: 500, label: "首次击败困难AI" },
];

export function calculateMatchReward(result, matchData, collection = null) {
    if (matchData?.mode === "training") return { duelCoins: 0, bonuses: [], label: "练习模式无奖励", result };
    if (matchData?.mode === "pvp") {
        return { duelCoins: PVP_REWARD_TABLE[result] || 0, bonuses: [], label: "联机决斗奖励", result };
    }
    if (matchData?.stage) {
        const amount = result === "win" ? Number(matchData.stage.reward || 0) : 0;
        return { duelCoins: amount, bonuses: [], label: result === "win" ? `${matchData.stage.name}通关奖励` : "挑战失败无奖励", result };
    }

    let base = REWARD_TABLE[result] || 0;
    const bonuses = [];
    const stats = matchData?.statistics || {};

    // 每日首次胜利只在真正获胜时发放
    for (const bonus of BONUS_REWARDS) {
        if (result === "win" && bonus.condition(stats, matchData)) {
            base += bonus.amount;
            bonuses.push({ id: bonus.id, label: bonus.label, amount: bonus.amount });
        }
    }

    return { duelCoins: base, bonuses, result };
}

export function applyReward(collection, reward) {
    if (!reward || reward.duelCoins === undefined) return false;

    // 一次性奖励检查
    if (reward.claimId) {
        if (!collection.claimedRewards) collection.claimedRewards = {};
        if (collection.claimedRewards[reward.claimId]) return false;
        collection.claimedRewards[reward.claimId] = Date.now();
    }

    collection.currency.duelCoins = Math.max(0, (collection.currency.duelCoins || 0) + reward.duelCoins);
    collection.statistics.duelsPlayed++;

    if (reward.result === "win") collection.statistics.wins++;
    else if (reward.result === "loss") collection.statistics.losses++;
    else collection.statistics.draws++;

    // 更新每日首次胜利标记
    if (reward.bonuses?.some(b => b.id === "first_win_of_day")) {
        collection.statistics.firstWinToday = new Date().toDateString();
    }

    return true;
}
