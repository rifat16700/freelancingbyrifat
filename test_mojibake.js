const fs = require('fs');
const content = fs.readFileSync('admin/products.html', 'utf8');

const regex = /[\x80-\xFF]{2,}/g; // At least 2 characters

let newContent = content.replace(regex, (match) => {
    try {
        const decoded = Buffer.from(match, 'latin1').toString('utf8');
        // If it doesn't have replacement chars and looks like something useful
        if (!decoded.includes('\uFFFD') && /[\u0980-\u09FF\u2000-\u3300\uD83C-\uD83E\uD83D]/u.test(decoded)) {
            console.log('Fixed:', match, '=>', decoded);
            return decoded;
        }
    } catch(e) {}
    return match;
});
