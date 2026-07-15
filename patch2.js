const fs = require('fs');
let bad = fs.readFileSync('checkout.html', 'utf8').split('\n');
let good = fs.readFileSync('checkout_good.html', 'utf8').split('\n');

for(let i=0; i<bad.length; i++) {
    if(bad[i].includes('\ufffd')) {
        let badStr = bad[i].trim();
        let parts = badStr.split('\ufffd');
        let prefix = parts[0];
        let suffix = parts[parts.length-1];
        
        let bestMatch = '';
        
        for(let j=Math.max(0, i-50); j<Math.min(good.length, i+50); j++) {
            let goodStr = good[j].trim();
            if(prefix.length > 5 && goodStr.startsWith(prefix) && goodStr.includes(suffix)) {
                bestMatch = good[j];
                break;
            }
            if(suffix.length > 5 && goodStr.endsWith(suffix) && goodStr.includes(prefix)) {
                bestMatch = good[j];
                break;
            }
        }
        
        if(bestMatch !== '') {
            bad[i] = bestMatch;
        }
    }
}
fs.writeFileSync('checkout.html', bad.join('\n'), 'utf8');
