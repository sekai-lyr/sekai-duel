class MockClassList {
    add() {}
    remove() {}
}

class MockElement {
    constructor(name) {
        this.name = name;
        this.children = [];
        this.classList = new MockClassList();
        this.style = { cssText: "", setProperty() {} };
        this.dataset = {};
        this.offsetWidth = 120;
    }
    appendChild(child) { this.children.push(child); return child; }
    remove() {}
    getBoundingClientRect() { return { left: 100, top: 100, width: 120, height: 80 }; }
}

const elements = new Map();
const queried = [];
const getElement = name => {
    if (!elements.has(name)) elements.set(name, new MockElement(name));
    return elements.get(name);
};

global.window = { innerWidth: 1440, innerHeight: 900 };
global.document = {
    body: getElement("body"),
    createElement: tag => new MockElement(tag),
    getElementById: id => getElement(`#${id}`),
    querySelector: selector => {
        queried.push(selector);
        return getElement(selector);
    },
};

const { ALL_CARDS } = await import("../src/main/resources/static/js/catalog.js");
const { playRuleDrivenEffect } = await import("../src/main/resources/static/js/effects.js");

const failures = [];
let checks = 0;
for (const card of ALL_CARDS) {
    for (const effect of card.effects || (card.effect ? [card.effect] : [])) {
        for (const ownerIndex of [0, 1]) {
            checks++;
            queried.length = 0;
            const origin = card.type === "monster" ? getElement(`origin-${ownerIndex}`) : null;
            try {
                const displayed = playRuleDrivenEffect({ ...card, effects: [effect] }, origin, ownerIndex);
                if (!displayed) throw new Error("no visual target");
                const ownArea = ownerIndex === 0 ? "#player-area" : "#opponent-area";
                const enemyArea = ownerIndex === 0 ? "#opponent-area" : "#player-area";
                const type = String(effect.type || "").toLowerCase();
                if (type === "healplayer" && !queried.some(selector => selector.startsWith(ownArea))) {
                    throw new Error("heal visual is not on owner HP");
                }
                if (type === "directdamage" && !queried.some(selector => selector.startsWith(enemyArea))) {
                    throw new Error("damage visual is not on enemy HP");
                }
                if (type === "damagebothplayers"
                    && (!queried.some(selector => selector.startsWith(ownArea))
                        || !queried.some(selector => selector.startsWith(enemyArea)))) {
                    throw new Error("both-player damage does not cover both HP bars");
                }
            } catch (error) {
                failures.push({ card: card.name, effect: effect.type, ownerIndex, error: error.message });
            }
        }
    }
}

console.log(JSON.stringify({ cards: ALL_CARDS.length, bilateralChecks: checks, passed: checks - failures.length, failed: failures.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
