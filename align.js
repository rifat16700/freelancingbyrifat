const fs = require('fs');
const bad = fs.readFileSync('checkout.html', 'utf8').split('\n');
const good = fs.readFileSync('checkout_good.html', 'utf8').split('\n');

for(let i=0; i<bad.length; i++) {
    if(bad[i].includes('\ufffd')) {
        let bestMatch = '';
        let minDiff = 9999;
        // find closest line in good
        for(let j=Math.max(0, i-20); j<Math.min(good.length, i+20); j++) {
            if(Math.abs(good[j].length - bad[i].length) < minDiff) {
                minDiff = Math.abs(good[j].length - bad[i].length);
                bestMatch = good[j];
            }
        }
        console.log('BAD:  ' + bad[i].trim());
        console.log('GOOD: ' + bestMatch.trim());
        console.log('---');
    }
}
