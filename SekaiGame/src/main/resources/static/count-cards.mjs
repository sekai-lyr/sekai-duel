import fs from 'fs';

const file = 'D:/Sekai_two/memory-11/Nightcord-Duel-Network-IDEA-v1.4.0-yugioh-rules/Nightcord-Duel-Network-v1.4.0/js/nightcord-cards.js';
const content = fs.readFileSync(file, 'utf8');
const matches = content.match(/id: "/g);
console.log('Nightcord card count:', matches ? matches.length : 0);
