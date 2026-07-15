const fs = require('fs');
let bad = fs.readFileSync('checkout.html', 'utf8').split('\n');
let good = fs.readFileSync('checkout_good.html', 'utf8').split('\n');

for(let i=0; i<bad.length; i++) {
    if(bad[i].includes('\ufffd')) {
        let bestMatch = '';
        let minDiff = 9999;
        for(let j=Math.max(0, i-20); j<Math.min(good.length, i+20); j++) {
            if(Math.abs(good[j].length - bad[i].length) < minDiff) {
                minDiff = Math.abs(good[j].length - bad[i].length);
                bestMatch = good[j];
            }
        }
        // If the good line has emojis or Bengali text, replace the bad line with it!
        // But wait! If the bad line has Lucide icons added, we want to KEEP the Lucide icons if possible, or just replace the `\ufffd` parts.
        // Actually, just replacing the whole line with the good line is better, EXCEPT for Lucide additions.
        bad[i] = bestMatch;
    }
}
fs.writeFileSync('checkout.html', bad.join('\n'), 'utf8');
