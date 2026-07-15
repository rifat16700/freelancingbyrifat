const fs = require('fs');
let html = fs.readFileSync('checkout.html', 'utf8');

// Replace corrupted manual payment icons with Lucide icons using Regex
html = html.replace(
    /('manual_bkash',\s*')[^']+('\s*,\s*'bKash',)/,
    "$1<i data-lucide=\"smartphone\" class=\"lucide-icon\" style=\"color:#e2136e; width:20px; height:20px;\"></i>$2"
);

html = html.replace(
    /('manual_nagad',\s*')[^']+('\s*,\s*'Nagad',)/,
    "$1<i data-lucide=\"smartphone\" class=\"lucide-icon\" style=\"color:#f7931e; width:20px; height:20px;\"></i>$2"
);

html = html.replace(
    /('manual_binance',\s*')[^']+('\s*,\s*'Binance Manual',)/,
    "$1<i data-lucide=\"bitcoin\" class=\"lucide-icon\" style=\"color:#f3ba2f; width:20px; height:20px;\"></i>$2"
);

// For the manual group card, find the call to buildPayCard('manual_group', '...', 'Manual Payment'
html = html.replace(
    /('manual_group',\s*')[^']+('\s*,\s*'Manual Payment',)/,
    "$1<i data-lucide=\"wallet\" class=\"lucide-icon\"></i>$2"
);

fs.writeFileSync('checkout.html', html, 'utf8');
console.log("Fix applied to checkout.html!");
