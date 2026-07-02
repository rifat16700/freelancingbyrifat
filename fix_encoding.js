const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/PC NET/Downloads/e-commarce/admin';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    // If it contains mojibake like 'ðŸ›' or 'à§§' or 'à¦'
    if (content.includes('ðŸ›') || content.includes('à§§') || content.includes('à¦')) {
        console.log('Fixing encoding for', file);
        // It was saved as utf8, but it was actually interpreted as latin1 somewhere
        const fixed = Buffer.from(content, 'latin1').toString('utf8');
        fs.writeFileSync(filePath, fixed, 'utf8');
    }
});
