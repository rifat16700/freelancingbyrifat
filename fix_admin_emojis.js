const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\PC NET\\Downloads\\e-commarce\\admin';

const mappings = {
    '🛍️': '🛍️',
    '🛍️': '🛍️',
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
    'ðŸ ': '🏠'
};

function fixFile(filePath) {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        let originalContent = content;
        for (const [bad, good] of Object.entries(mappings)) {
            content = content.split(bad).join(good);
        }
        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log('Fixed', filePath);
        }
    }
}

const htmlFiles = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
for (const file of htmlFiles) {
    fixFile(path.join(dir, file));
}

const jsFiles = [
    'assets/js/admin-common.js',
    'assets/js/dashboard.js',
    'assets/js/orders.js',
    'assets/js/products.js',
    'assets/js/settings.js'
];
for (const file of jsFiles) {
    fixFile(path.join(dir, file));
}
