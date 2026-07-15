const fs = require('fs');
let html = fs.readFileSync('checkout.html', 'utf8');

// 1. Gateway call inside placeOrder()
// Replace: if (selectedPayMethod === 'auto_gateway' || (selectedPayMethod === 'cod' && advancePayable > 0 && autoAdv)) { ... return; }
const rxGatewayCall = /if\s*\(selectedPayMethod\s*===\s*'auto_gateway'[\s\S]*?initiateGatewayPayment\(orderId,\s*gatewayAmount,\s*orderData\);\s*return;\s*\}/;

const newGatewayCall = `    if (selectedPayMethod === 'auto_gateway' || (selectedPayMethod === 'cod' && advancePayable > 0 && autoAdv)) {
        var btn = document.getElementById('placeOrderBtn');
        btn.disabled = true;
        btn.textContent = 'Saving order & redirecting...';
        
        orderData.payment_status = 'Unpaid';
        orderData.status = 'Pending';
        
        saveOrder(orderData).then(function(r) {
            if (r.error) { 
                btn.disabled = false; 
                btn.innerHTML = '<i data-lucide="rocket" class="lucide-icon icon-bounce"></i> Place Order'; 
                alert('Error: ' + (r.error.message || r.error)); 
                return; 
            }
            var gatewayAmount = (selectedPayMethod === 'cod') ? advancePayable : total;
            initiateGatewayPayment(orderId, gatewayAmount, orderData);
        });
        return;
    }`;

if (rxGatewayCall.test(html)) {
    html = html.replace(rxGatewayCall, newGatewayCall);
    console.log("Fixed gateway call inside placeOrder");
} else {
    console.log("Could not find gateway call inside placeOrder");
}

// 2. Crypto call inside placeOrder()
const rxCryptoCall = /if\s*\(selectedPayMethod\s*===\s*'crypto'\)\s*\{\s*placeCryptoOrder\(orderId,\s*orderData\);\s*return;\s*\}/;
const newCryptoCall = `    if (selectedPayMethod === 'crypto') {
        var btn = document.getElementById('placeOrderBtn');
        btn.disabled = true;
        btn.textContent = 'Saving crypto order...';
        
        orderData.payment_status = 'Unpaid';
        orderData.status = 'Pending';
        
        saveOrder(orderData).then(function(r) {
            if (r.error) { 
                btn.disabled = false; 
                btn.innerHTML = '<i data-lucide="rocket" class="lucide-icon icon-bounce"></i> Place Order'; 
                alert('Error: ' + (r.error.message || r.error)); 
                return; 
            }
            placeCryptoOrder(orderId, orderData);
        });
        return;
    }`;

if (rxCryptoCall.test(html)) {
    html = html.replace(rxCryptoCall, newCryptoCall);
    console.log("Fixed crypto call inside placeOrder");
} else {
    console.log("Could not find crypto call inside placeOrder");
}


// 3. Manual / COD insert inside placeOrder()
// Replace from `var insertPromise;` up to `insertPromise.then(function(r) {` inside placeOrder
const rxManualInsert = /var\s+insertPromise;\s*if\s*\(CONFIG\.DB_PROVIDER\s*===\s*'supabase'\)[\s\S]*?\}\s*catch\s*\(function\s*\(\s*err\s*\)\s*\{\s*return\s*\{\s*data:\s*null,\s*error:\s*err\s*\};\s*\}\);\s*\}/;
const newManualInsert = `var insertPromise = saveOrder(orderData);`;

if (rxManualInsert.test(html)) {
    // Only replace the FIRST occurrence (which is inside placeOrder)
    html = html.replace(rxManualInsert, newManualInsert);
    console.log("Fixed manual insert inside placeOrder");
} else {
    console.log("Could not find manual insert inside placeOrder");
}

// 4. Gateway insert inside initiateGatewayPayment
// Find `var insertPromise;` inside `initiateGatewayPayment` (which is now the first match after the previous replace)
const rxGatewayInsert = /var\s+insertPromise;\s*if\s*\(CONFIG\.DB_PROVIDER\s*===\s*'supabase'\)[\s\S]*?\}\s*catch\s*\(function\s*\(\s*err\s*\)\s*\{\s*return\s*\{\s*data:\s*null,\s*error:\s*err\s*\};\s*\}\);\s*\}/;
const newGatewayInsert = `var insertPromise = Promise.resolve({});`;
if (rxGatewayInsert.test(html)) {
    html = html.replace(rxGatewayInsert, newGatewayInsert);
    console.log("Fixed gateway insert inside initiateGatewayPayment");
} else {
    console.log("Could not find gateway insert inside initiateGatewayPayment");
}

// 5. Crypto insert inside placeCryptoOrder
// Find `var insertPromise;` inside `placeCryptoOrder`
const rxCryptoInsert = /var\s+insertPromise;\s*if\s*\(CONFIG\.DB_PROVIDER\s*===\s*'supabase'\)[\s\S]*?\}\s*catch\s*\(function\s*\(\s*err\s*\)\s*\{\s*return\s*\{\s*data:\s*null,\s*error:\s*err\s*\};\s*\}\);\s*\}/;
const newCryptoInsert = `var insertPromise = Promise.resolve({});`;
if (rxCryptoInsert.test(html)) {
    html = html.replace(rxCryptoInsert, newCryptoInsert);
    console.log("Fixed crypto insert inside placeCryptoOrder");
} else {
    console.log("Could not find crypto insert inside placeCryptoOrder (might be none left)");
}

fs.writeFileSync('checkout.html', html, 'utf8');
console.log("Done rewriting checkout.html");
