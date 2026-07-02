const fs = require('fs');
let html = fs.readFileSync('checkout.html', 'utf8');
if (html.includes("document.getElementById('paymentOptions').innerHTML = html;")) {
    html = html.replace("document.getElementById('paymentOptions').innerHTML = html;", 
        "document.getElementById('paymentOptions').innerHTML = html;\n    if (typeof lucide !== 'undefined') lucide.createIcons();");
}
fs.writeFileSync('checkout.html', html);
