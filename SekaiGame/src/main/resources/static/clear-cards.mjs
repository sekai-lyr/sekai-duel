import fs from 'fs';

const files = [
    'D:/Sekai_two/memory-11/Nightcord-Duel-Network-IDEA-v1.4.0-yugioh-rules/Nightcord-Duel-Network-v1.4.0/js/cards.js',
    'D:/Sekai_two/memory-11/Nightcord-Duel-Network-IDEA-v1.4.0-yugioh-rules/Nightcord-Duel-Network-v1.4.0/js/nightcord-cards.js'
];

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/name: "[^"]*"/g, 'name: ""');
    content = content.replace(/image: "[^"]*"/g, 'image: ""');
    content = content.replace(/description: "[^"]*"/g, 'description: ""');
    content = content.replace(/lore: "[^"]*"/g, 'lore: ""');
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Cleaned: ${file.split('/').pop()}`);
}
