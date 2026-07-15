const fs = require('fs');
let html = fs.readFileSync('checkout.html', 'utf8');

// Fix placeOrder() for cf_db
const placeOrderCfDb = `    } else if (CONFIG.DB_PROVIDER === 'cf_db') {
        insertPromise = fetch((CONFIG.HF_API_BASE || '') + '/api/save-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderData: orderData })
        }).then(function(res) {
            return res.json().then(function(data) {
                if (!data.success) throw new Error(data.error || 'Failed to save order');
                return { data: [{ id: orderId }], error: null };
            });
        }).catch(function(err) {
            return { data: null, error: err };
        });
    }`;

html = html.replace(
    /\} else if \(CONFIG.DB_PROVIDER === 'appwrite'\) \{[\s\S]*?\}\n/,
    "} else if (CONFIG.DB_PROVIDER === 'appwrite') {\n        var awOrderData = Object.assign({}, orderData);\n        awOrderData.items  = JSON.stringify(awOrderData.items  || []);\n        awOrderData.addons = JSON.stringify(awOrderData.addons || []);\n        delete awOrderData.id;\n        insertPromise = appwriteDatabases.createDocument(APP_DB, 'orders', orderId, awOrderData)\n            .then(function(doc) { return { data: [{ id: doc.$id }], error: null }; })\n            .catch(function(err) { return { data: null, error: err }; });\n    }\n" + placeOrderCfDb + "\n"
);

// Fix initiateGatewayPayment() for cf_db
const gatewayCfDb = `    } else if (CONFIG.DB_PROVIDER === 'cf_db') {
        insertPromise = fetch((CONFIG.HF_API_BASE || '') + '/api/save-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderData: Object.assign({}, orderData, { payment_status: 'Unpaid', status: 'Pending' }) })
        }).then(function(res) {
            return res.json().then(function(data) {
                if (!data.success) throw new Error(data.error || 'Failed to save order');
                return { data: [{ id: orderId }], error: null };
            });
        }).catch(function(err) {
            return { data: null, error: err };
        });
    }`;

html = html.replace(
    /\} else if \(CONFIG.DB_PROVIDER === 'appwrite'\) \{[\s\S]*?\}\n/,
    "} else if (CONFIG.DB_PROVIDER === 'appwrite') {\n        var awOrderData2 = Object.assign({}, orderData, { payment_status: 'Unpaid', status: 'Pending' });\n        awOrderData2.items  = JSON.stringify(awOrderData2.items  || []);\n        awOrderData2.addons = JSON.stringify(awOrderData2.addons || []);\n        delete awOrderData2.id;\n        insertPromise = appwriteDatabases.createDocument(APP_DB, 'orders', orderId, awOrderData2)\n            .then(function(doc) { return { data: [{ id: doc.$id }], error: null }; })\n            .catch(function(err) { return { data: null, error: err }; });\n    }\n" + gatewayCfDb + "\n"
);

// Fallback logic if insertPromise is undefined
html = html.replace(
    /insertPromise\.then\(function\(r\)/g,
    "if (!insertPromise) { alert('Configuration Error: Unknown DB_PROVIDER'); var btn = document.getElementById('placeOrderBtn'); if(btn){btn.disabled=false; btn.innerHTML='<i data-lucide=\"rocket\" class=\"lucide-icon icon-bounce\"></i> Place Order';} return; }\n    insertPromise.then(function(r)"
);

fs.writeFileSync('checkout.html', html, 'utf8');
console.log("Fixed cf_db in checkout.html!");
