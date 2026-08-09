/**
 * extract-cards.mjs
 * 从前端 nightcord-cards.js 和 cards.js 提取卡牌数据为 cards.json
 * 用法: node scripts/extract-cards.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(__dirname, "../Nightcord-Duel-Network-v1.4.0/js");
const outputPath = resolve(__dirname, "../nightcord-server/src/main/resources/cards.json");

// 读取 nightcord-cards.js
const nightcordContent = readFileSync(resolve(frontendDir, "nightcord-cards.js"), "utf-8");
const nightcordMatch = nightcordContent.match(/export const ANIME_CARDS = \[([\s\S]*?)\];/);
if (!nightcordMatch) {
    console.error("无法解析 nightcord-cards.js");
    process.exit(1);
}

// 读取 cards.js
const cardsContent = readFileSync(resolve(frontendDir, "cards.js"), "utf-8");
const cardsMatch = cardsContent.match(/export const cardDatabase = \[([\s\S]*?)\];/);
if (!cardsMatch) {
    console.error("无法解析 cards.js");
    process.exit(1);
}

// 用 Function 构造器解析
function parseArray(code) {
    const fn = new Function(`return [${code}]`);
    return fn();
}

const nightcordCards = parseArray(nightcordMatch[1]);
const elementCards = parseArray(cardsMatch[1]);

const allCards = [...elementCards, ...nightcordCards];

console.log(`提取到 ${allCards.length} 张卡牌:`);
console.log(`  元素怪兽: ${elementCards.length} 张`);
console.log(`  Nightcord魔法: ${nightcordCards.length} 张`);

// 统计稀有度
const rarityCount = {};
allCards.forEach(c => {
    rarityCount[c.rarity] = (rarityCount[c.rarity] || 0) + 1;
});
console.log("稀有度分布:", rarityCount);

writeFileSync(outputPath, JSON.stringify(allCards, null, 2), "utf-8");
console.log(`已写入: ${outputPath}`);
