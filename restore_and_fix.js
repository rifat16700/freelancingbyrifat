const fs = require('fs');
let html = fs.readFileSync('checkout_good.html', 'utf8');

// Fix proxyUrl for auto payment gateway
html = html.replace(
    "var proxyUrl = settings.gateway_proxy_url || CONFIG.GATEWAY_PROXY_URL;",
    "var proxyUrl = settings.gateway_proxy_url || (typeof CONFIG !== 'undefined' && CONFIG.GATEWAY_PROXY_URL) || '/proxyv2.php';"
);

// Replace emojis with Lucide icons for consistency
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

html = html.replace(
    /('manual_group',\s*')[^']+('\s*,\s*'Manual Payment',)/,
    "$1<i data-lucide=\"wallet\" class=\"lucide-icon\"></i>$2"
);

html = html.replace(
    /('auto_gateway',\s*')[^']+('\s*,\s*'Auto Payment',)/,
    "$1<i data-lucide=\"credit-card\" class=\"lucide-icon\"></i>$2"
);

html = html.replace(
    /('cod',\s*')[^']+('\s*,\s*codLabel)/,
    "$1<i data-lucide=\"banknote\" class=\"lucide-icon\"></i>$2"
);

html = html.replace(
    /('cod',\s*')[^']+('\s*,\s*'Pay at Pickup',)/,
    "$1<i data-lucide=\"banknote\" class=\"lucide-icon\"></i>$2"
);

fs.writeFileSync('checkout.html', html, 'utf8');
console.log("Restored from checkout_good.html and applied fixes!");
