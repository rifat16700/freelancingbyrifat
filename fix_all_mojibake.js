const fs = require('fs');
const path = require('path');

const dirs = [
    'c:\\Users\\PC NET\\Downloads\\e-commarce',
    'c:\\Users\\PC NET\\Downloads\\e-commarce\\admin',
    'c:\\Users\\PC NET\\Downloads\\e-commarce\\admin\\assets\\js'
];

const regex = /[\x80-\xFF]{2,}/g;

function fixMojibakeInFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    let fixCount = 0;
    let newContent = content.replace(regex, (match) => {
        try {
            const decoded = Buffer.from(match, 'latin1').toString('utf8');
            // Check if decode was successful and yields Bengali or Emoji
            if (!decoded.includes('\uFFFD') && /[\u0980-\u09FF\u2000-\u3300\uD83C-\uD83E\uD83D]/u.test(decoded)) {
                fixCount++;
                return decoded;
            }
        } catch(e) {}
        return match;
    });

    if (newContent !== originalContent) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Fixed ${fixCount} sequences in ${filePath}`);
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
