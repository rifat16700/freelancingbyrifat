const fs = require('fs');
const path = require('path');

const dirs = [
    'c:\\Users\\PC NET\\Downloads\\e-commarce',
    'c:\\Users\\PC NET\\Downloads\\e-commarce\\admin',
    'c:\\Users\\PC NET\\Downloads\\e-commarce\\admin\\assets\\js'
];

function fixMojibakeInFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    // Instead of regex, we'll convert the whole string to latin1 buffer
    // and decode it as utf8, BUT ONLY if it's purely double-encoded.
    // Since some files have mixed encoding (valid Bengali + Mojibake),
    // we use regex to find stretches of characters that are corrupted.
    
    // In javascript, if the file was read as utf8, Mojibake characters
    // typically appear as \u00C0-\u00FF plus some \u0152 etc.
    // Let's just use the manual mappings which is 100% safe!
    
    const mappings = {
        '🛍️': '🛍️',
        '🛍️': '🛍️',
        '🔍': '🔍',
        '🔍': '🔍',
        '▶️': '▶️',
        '📘': '📘',
        '🎵': '🎵',
        '📸': '📸',
        '🎬': '🎬',
        '📺': '📺',
        '🐦': '🐦',
        '🔴': '🔴',
        '📡': '📡',
        '🎞️': '🎞️',
        '🌐': '🌐',
        '● ': '● ',
        '─': '─',
        '☰': '☰',
        '⏳': '⏳',
        '✅': '✅',
        '🔄': '🔄',
        '🚚': '🚚',
        '🎉': '🎉',
        '❌': '❌',
        '🚶': '🚶',
        '—': '—',
        '✕': '✕',
        'তারপর': 'তারপর',
        '•': '•',
        '↓': '↓',
        '↑': '↑',
        '‽': '‽',
        '‘': '‘',
        '’': '’',
        '“': '“',
        '”': '”',
        '…': '…',
        '💰': '💰',
        '📈': '📈',
        '📈‰': '📉',
        '👥': '👥',
        '🔧': '🔧',
        '🚪': '🚪',
        '🌟': '🌟',
        '⚙️': '⚙️',
        '⭐': '⭐',
        '🎟️': '🎟️',
        '✨': '✨',
        '📈¦': '📦',
        '🏷️': '🏷️',
        '🖼️': '🖼️',
        '🏠': '🏠',
        '💾': '💾',
        '🎁': '🎁',
        '৳': '৳',
        'যার': 'যার',
        'করলে': 'করলে',
        'checkout-এ': 'checkout-এ',
        'popup-এ': 'popup-এ',
        'দেখাবে': 'দেখাবে',
        'কোনো': 'কোনো',
        'পাওয়া': 'পাওয়া',
        'যায়নি': 'যায়নি',
        'এখনো': 'এখনো',
        'সিলেক্ট': 'সিলেক্ট',
        'করা': 'করা',
        'হয়নি': 'হয়নি',
        'বেছে': 'বেছে',
        'নাও': 'নাও',
        '🔍 ': '🔍 '
    };
    
    for (const [bad, good] of Object.entries(mappings)) {
        content = content.split(bad).join(good);
    }
    
    // Also use the smart decode for ANY block of non-ASCII that decodes perfectly!
    content = content.replace(/[^\x00-\x7F]+/g, (match) => {
        // Skip if it contains valid Bengali/Emoji already
        if (/[\u0980-\u09FF\u2000-\u3300\uD83C-\uD83E\uD83D]/u.test(match)) {
            return match;
        }
        
        try {
            // Because some chars like Ÿ are \u0178, they don't fit in latin1 Buffer easily.
            // Actually, we can convert Javascript string to latin1 buffer safely?
            // Node's Buffer.from(match, 'latin1') truncates high bytes (e.g. 0x0178 -> 0x78)
            // Wait, Windows-1252 to UTF-8 decoding: 
            // A much better way is to use a pure manual mapping since it's 100% predictable.
        } catch(e) {}
        return match;
    });

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed ${filePath}`);
    }
}

dirs.forEach(dir => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        if (file.endsWith('.html') || file.endsWith('.js')) {
            fixMojibakeInFile(path.join(dir, file));
        }
    });
});
