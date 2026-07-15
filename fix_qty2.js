const fs = require('fs');
let html = fs.readFileSync('checkout.html', 'utf8');

// Fix the quantity line 548
html = html.replace(/<div style="color:#888;">' \+ \(item\.color\|\|''\) \+ ' \/ ' \+ \(item\.size\|\|''\) \+ ' [\s\ufffd]+ ' \+ \(item\.quantity\|\|1\) \+ '<\/div>'/g, 
'<div style="color:#888;">\' + (item.color||\'\') + \' / \' + (item.size||\'\') + \' x \' + (item.quantity||1) + \'</div>\'');

fs.writeFileSync('checkout.html', html, 'utf8');
