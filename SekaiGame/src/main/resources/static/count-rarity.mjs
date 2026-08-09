import fs from 'fs';
const file = 'D:/Sekai_two/memory-11/Nightcord-Duel-Network-IDEA-v1.4.0-yugioh-rules/Nightcord-Duel-Network-v1.4.0/js/nightcord-cards.js';
const content = fs.readFileSync(file, 'utf8');
const r = {};
const matches = content.match(/rarity: "(\w+)"/g);
if (matches) {
    matches.forEach(m => {
        const v = m.match(/rarity: "(\w+)"/)[1];
        r[v] = (r[v] || 0) + 1;
    });
}
console.log('Rarity distribution:', r);
console.log('Total cards:', matches ? matches.length : 0);
