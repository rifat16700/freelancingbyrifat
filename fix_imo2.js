const fs = require('fs');

let prod = fs.readFileSync('product.html', 'utf8');
prod = prod.replace('data:image/svg+xml;utf8,', 'data:image/svg+xml;charset=utf-8,');
fs.writeFileSync('product.html', prod, 'utf8');

let ts = fs.readFileSync('temp_settings.html', 'utf8');
ts = ts.replace('data:image/svg+xml;utf8,', 'data:image/svg+xml;charset=utf-8,');
fs.writeFileSync('temp_settings.html', ts, 'utf8');
