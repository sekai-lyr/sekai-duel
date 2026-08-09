import fs from 'fs';

const file = 'D:/Sekai_two/memory-11/Nightcord-Duel-Network-IDEA-v1.4.0-yugioh-rules/Nightcord-Duel-Network-v1.4.0/js/cards.js';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/enabled: true \}/g, 'lore: "", enabled: true }');
fs.writeFileSync(file, content, 'utf8');
console.log('Added lore field to cards.js');
