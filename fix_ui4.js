const fs = require('fs');
let html = fs.readFileSync('checkout.html', 'utf8');

// Fix buildPayCard calls
html = html.replace(/buildPayCard\(\s*'auto_gateway',\s*'[^']+',/g, "buildPayCard('auto_gateway', '<i data-lucide=\"credit-card\" class=\"lucide-icon\"></i>',");
html = html.replace(/buildPayCard\(\s*'bkash',\s*'[^']+',/g, "buildPayCard('bkash', '<i data-lucide=\"smartphone\" class=\"lucide-icon\"></i>',");
html = html.replace(/buildPayCard\(\s*'nagad',\s*'[^']+',/g, "buildPayCard('nagad', '<i data-lucide=\"smartphone\" class=\"lucide-icon\"></i>',");
html = html.replace(/buildPayCard\(\s*'cod',\s*'[^']+',/g, "buildPayCard('cod', '<i data-lucide=\"banknote\" class=\"lucide-icon\"></i>',");

// Also replace the remaining \ufffd in line 1007
html = html.replace('S&<i data-lucide="shield-check" class="lucide-icon"></i> No advance payment needed online.', '<i data-lucide="shield-check" class="lucide-icon"></i> No advance payment needed online.');

fs.writeFileSync('checkout.html', html, 'utf8');
