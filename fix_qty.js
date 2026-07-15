const fs = require('fs');
let html = fs.readFileSync('checkout.html', 'utf8');

html = html.replace(/' \/ ' \+ \(item.size\|\|''\) \+ ' [\s\ufffd]+ ' \+ \(item.quantity\|\|1\)/g, "' / ' + (item.size||'') + ' x ' + (item.quantity||1)");

fs.writeFileSync('checkout.html', html, 'utf8');
