const fs = require('fs');
let html = fs.readFileSync('checkout.html', 'utf8');

html = html.replace(
    /Continue to Delivery →/,
    "Continue to Delivery <i data-lucide=\"arrow-right\" class=\"lucide-icon\"></i>"
);

html = html.replace(
    /← Back/g,
    "<i data-lucide=\"arrow-left\" class=\"lucide-icon\"></i> Back"
);

html = html.replace(
    /Continue to Payment →/,
    "Continue to Payment <i data-lucide=\"arrow-right\" class=\"lucide-icon\"></i>"
);

fs.writeFileSync('checkout.html', html, 'utf8');
console.log("Applied button icon fixes!");
