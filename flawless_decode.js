const fs = require('fs');
const path = require('path');

const mapToByte = {};
// standard 128-255 (latin1 block)
for (let i=128; i<=255; i++) mapToByte[i] = i;

// Windows-1252 overrides: Map Unicode char codes back to their Win1252 byte
const overrides = {
    0x80: 8364, // €
    0x82: 8218, // ‚
    0x83: 402,  // ƒ
    0x84: 8222, // „
    0x85: 8230, // …
    0x86: 8224, // †
    0x87: 8225, // ‡
    0x88: 710,  // ˆ
    0x89: 8240, // ‰
    0x8A: 352,  // Š
    0x8B: 8249, // ‹
    0x8C: 338,  // Œ
    0x8E: 381,  // Ž
    0x91: 8216, // ‘
    0x92: 8217, // ’
    0x93: 8220, // “ (Fixed 8218 -> 8220)
    0x94: 8221, // ”
    0x95: 8226, // •
    0x96: 8211, // –
    0x97: 8212, // —
    0x98: 732,  // ˜
    0x99: 8482, // ™
    0x9A: 353,  // š
    0x9B: 8250, // ›
    0x9C: 339,  // œ
    0x9E: 382,  // ž
    0x9F: 376   // Ÿ
};
for(const [byte, code] of Object.entries(overrides)) {
    delete mapToByte[byte];
    mapToByte[code] = parseInt(byte);
}

// Add the undefined control chars that Javascript preserves as is
for (const byte of [0x81, 0x8D, 0x8F, 0x90, 0x9D]) {
    mapToByte[byte] = byte;
}

const dirs = [
    'c:\\Users\\PC NET\\Downloads\\e-commarce',
    'c:\\Users\\PC NET\\Downloads\\e-commarce\\admin',
    'c:\\Users\\PC NET\\Downloads\\e-commarce\\admin\\assets\\js'
];

function fixFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    // We scan the string character by character
    let newContent = '';
    let i = 0;
    let fixedCount = 0;
    
    while(i < content.length) {
        let code = content.charCodeAt(i);
        if (mapToByte[code] !== undefined) {
            // Start of a potential mojibake block
            let block = [];
            let j = i;
            while(j < content.length && mapToByte[content.charCodeAt(j)] !== undefined) {
                block.push(mapToByte[content.charCodeAt(j)]);
                j++;
            }
            
            // We have a byte block. Try to decode it.
            if (block.length >= 2) {
                let buf = Buffer.from(block);
                let decoded = buf.toString('utf8');
                // Check if decoded cleanly
                if (!decoded.includes('\uFFFD') && decoded.length > 0) {
                    // Accept if it contains ANY non-ASCII character
                    if (/[^\x00-\x7F]/.test(decoded)) {
                        newContent += decoded;
                        i = j;
                        fixedCount++;
                        console.log(`Fixing [${block.join(',')}] -> ${decoded}`);
                        continue;
                    }
                }
            }
            // If decode failed or length < 2, just append the character and move on
            // Actually, if it failed, maybe a smaller prefix decodes successfully?
            // E.g. block of 5 bytes where first 3 are emoji, and last 2 are something else.
            // For now, let's keep it simple. If the whole block fails, we just append the first char.
            newContent += content[i];
            i++;
        } else {
            newContent += content[i];
            i++;
        }
    }
    
    if (newContent !== originalContent) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Fixed ${fixedCount} blocks in ${filePath}`);
    }
}

function walkDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') {
                walkDir(fullPath);
            }
        } else if (fullPath.endsWith('.html') || fullPath.endsWith('.js')) {
            fixFile(fullPath);
        }
    });
}
walkDir('c:\\Users\\PC NET\\Downloads\\e-commarce');
