const fs = require('fs');
let html = fs.readFileSync('original_checkout_utf8.html', 'utf8');

// Replace corrupted emojis with Lucide icons
html = html.replace(/('cod',\s*')[^']+('\s*,\s*codLabel)/, "$1<i data-lucide=\"banknote\" class=\"lucide-icon\"></i>$2");
html = html.replace(/('cod',\s*')[^']+('\s*,\s*'Pay at Pickup',)/, "$1<i data-lucide=\"banknote\" class=\"lucide-icon\"></i>$2");
html = html.replace(/('manual_group',\s*')[^']+('\s*,\s*'Manual Payment',)/, "$1<i data-lucide=\"wallet\" class=\"lucide-icon\"></i>$2");
html = html.replace(/('auto_gateway',\s*')[^']+('\s*,\s*'Auto Payment',)/, "$1<i data-lucide=\"credit-card\" class=\"lucide-icon\"></i>$2");
html = html.replace(/('manual_bkash',\s*')[^']+('\s*,\s*'bKash',)/, "$1<i data-lucide=\"smartphone\" class=\"lucide-icon\" style=\"color:#e2136e; width:20px; height:20px;\"></i>$2");
html = html.replace(/('manual_nagad',\s*')[^']+('\s*,\s*'Nagad',)/, "$1<i data-lucide=\"smartphone\" class=\"lucide-icon\" style=\"color:#f37021; width:20px; height:20px;\"></i>$2");

// Replace random mojibake left over like ∩┐╜, etc.
html = html.replace(/∩┐╜[S&xR!a∩╕Å▄ü]+/g, '');
html = html.replace(/∩┐╜/g, ''); // just in case

fs.writeFileSync('checkout.html', html);
console.log('checkout.html has been fully restored and fixed!');
