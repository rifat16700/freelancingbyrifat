const fs = require('fs');

const win1252Map = new Map();
// Basic latin1 part
for (let i = 0; i < 256; i++) {
    win1252Map.set(String.fromCharCode(i), i);
}
// Overrides for 0x80 - 0x9F in Windows-1252
const overrides = {
    0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡',
    0x88: 'ˆ', 0x89: '‰', 0x8A: 'Š', 0x8B: '‹', 0x8C: 'Œ', 0x8E: 'Ž',
    0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—',
    0x98: '˜', 0x99: '™', 0x9A: 'š', 0x9B: '›', 0x9C: 'œ', 0x9E: 'ž', 0x9F: 'Ÿ'
};
for (const [byte, char] of Object.entries(overrides)) {
    win1252Map.delete(String.fromCharCode(byte));
    win1252Map.set(char, parseInt(byte));
}

let content = fs.readFileSync('admin/products.html', 'utf8');

const allWin1252Chars = Array.from(win1252Map.keys()).join('').replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
const regex = new RegExp(`[${allWin1252Chars}]+`, 'g');

let fixedCount = 0;
content = content.replace(regex, (match) => {
    let hasHighByte = false;
    let bytes = [];
    for (let i = 0; i < match.length; i++) {
        let b = win1252Map.get(match[i]);
        if (b >= 128) hasHighByte = true;
        bytes.push(b);
    }
    
    if (!hasHighByte || bytes.length < 2) return match;
    
    let buf = Buffer.from(bytes);
    let decoded = buf.toString('utf8');
    
    // Only accept if decoded doesn't have replacement chars
    if (decoded.includes('\uFFFD') || decoded.length === 0) return match;
    
    // Check if decoded has Bengali or Emojis
    if (/[\u0980-\u09FF\u2000-\u3300\uD83C-\uD83E\uD83D]/u.test(decoded)) {
        console.log(`Fixing block of length ${match.length} -> Decoded length ${decoded.length}`);
        fixedCount++;
        return decoded;
    }
    return match;
});

console.log('Fixed count:', fixedCount);
if(fixedCount > 0) fs.writeFileSync('admin/products.html', content, 'utf8');
