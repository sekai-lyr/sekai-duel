import assert from "node:assert/strict";
import { ALL_CARDS } from "../src/main/resources/static/js/catalog.js";
import { AI_STAGES, buildStageDeck, evaluateStageDeck, scoreCardForStage } from "../src/main/resources/static/js/stages.js";

function seeded(seed) {
    let value = seed >>> 0;
    return () => ((value = (value * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function simulateMatch(stage, deck, trials = 240) {
    const random = seeded(0x5e1a1 + stage.order * 97);
    const map = new Map(ALL_CARDS.map(card => [card.id, card]));
    const cards = deck.main.map(id => map.get(id)).filter(Boolean);
    const baseline = 4300 + stage.order * 145;
    let wins = 0;
    for (let trial = 0; trial < trials; trial++) {
        const shuffled = [...cards].sort(() => random() - 0.5);
        const seen = shuffled.slice(0, 5 + Math.min(8, Math.floor(stage.order / 6)));
        const lowLevels = seen.filter(card => card.type === "monster" && Number(card.level || 0) <= 4).length;
        const playable = lowLevels ? 1 : 0.62;
        const handPower = seen.reduce((sum, card) => sum + scoreCardForStage(card, stage), 0) / Math.max(1, seen.length);
        const decisionPower = Number(stage.ai?.skill || 1) * 520 + Number(stage.ai?.lookahead || 0) * 180;
        const variance = (random() - 0.5) * 1900;
        if (handPower * playable + decisionPower + variance >= baseline) wins++;
    }
    return wins / trials;
}

assert.equal(AI_STAGES.length, 50, "AI stage count must be exactly 50");
const chapterStrength = [0, 0, 0, 0, 0];
const report = [];

for (const stage of AI_STAGES) {
    const deck = buildStageDeck(stage);
    const metrics = evaluateStageDeck(stage, deck);
    const counts = new Map();
    deck.main.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
    assert.equal(deck.main.length, 40, `${stage.id}: deck size`);
    assert.ok([...counts.values()].every(count => count <= 3), `${stage.id}: copy limit`);
    assert.ok(metrics.monsters >= 18 && metrics.monsters <= 22, `${stage.id}: monster ratio`);
    assert.ok(metrics.lowLevel >= 9, `${stage.id}: needs a playable summon curve`);
    assert.equal(metrics.spells, 12, `${stage.id}: spell ratio`);
    assert.equal(metrics.traps, 8, `${stage.id}: trap ratio`);
    assert.ok(metrics.synergy >= 0.12, `${stage.id}: theme synergy too low (${metrics.synergy})`);
    const winRate = simulateMatch(stage, deck);
    const strength = metrics.averageScore + Number(stage.ai.skill) * 900;
    chapterStrength[Math.floor((stage.order - 1) / 10)] += strength;
    report.push(`${String(stage.order).padStart(2, "0")} ${stage.name} | 强度 ${strength} | 主题 ${(metrics.synergy * 100).toFixed(0)}% | 模拟胜率 ${(winRate * 100).toFixed(1)}%`);
}

for (let index = 1; index < chapterStrength.length; index++) {
    assert.ok(chapterStrength[index] > chapterStrength[index - 1], `chapter ${index + 1} must be stronger than chapter ${index}`);
}

console.log(report.join("\n"));
console.log("章节总强度:", chapterStrength.join(" < "));
console.log("AI_STAGE_TEST_OK");
