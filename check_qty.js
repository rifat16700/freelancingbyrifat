const fs = require('fs');
const txt = fs.readFileSync('checkout_good.html', 'utf8').split('\n');
txt.forEach((l, i) => {
    if(l.includes('quantity')) console.log((i+1)+': ' + l.trim());
});
