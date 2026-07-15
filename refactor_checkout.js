// Script to refactor checkout.html data loading and order placement
const fs = require('fs');

let html = fs.readFileSync('checkout.html', 'utf8');

// 1. Refactor Data Loading
const oldLoading = `        } else if (CONFIG.DB_PROVIDER === 'cf_db') {
            var h = { "Content-Type": "application/json" };
            p1 = fetch((CONFIG.HF_API_BASE||"")+"/api/d1-query", { method: "POST", headers: h, body: JSON.stringify({ sql: "SELECT * FROM settings WHERE id=1" }) }).then(r=>r.json()).then(r => ({ data: (r.success && r.result[0].results.length) ? r.result[0].results[0] : {} })).then(function(res) {
                var doc = res.data;
                if (typeof doc.messaging_apps === 'string') try { doc.messaging_apps = JSON.parse(doc.messaging_apps); } catch(e){}
                if (typeof doc.crypto_coins === 'string') try { doc.crypto_coins = JSON.parse(doc.crypto_coins); } catch(e){}
                return { data: doc };
            });
            p2 = fetch((CONFIG.HF_API_BASE||"")+"/api/d1-query", { method: "POST", headers: h, body: JSON.stringify({ sql: "SELECT * FROM delivery_zones" }) }).then(r=>r.json()).then(r => ({ data: (r.success && r.result[0].results) ? r.result[0].results : [] })).then(function(res) {
                return { data: res.data.map(function(d) { if(typeof d.gallery_images==='string') try{ d.gallery_images=JSON.parse(d.gallery_images); }catch(e){} return d; }) };
            });
            p3 = fetch((CONFIG.HF_API_BASE||"")+"/api/d1-query", { method: "POST", headers: h, body: JSON.stringify({ sql: "SELECT * FROM addons WHERE is_active=1 ORDER BY created_at" }) }).then(r=>r.json()).then(r => ({ data: (r.success && r.result[0].results) ? r.result[0].results : [] })).then(function(res) {
                return { data: res.data.map(function(d) { d.is_active = d.is_active === 1; if(typeof d.gallery_images==='string') try{ d.gallery_images=JSON.parse(d.gallery_images); }catch(e){} return d; }) };
            });
            p4 = fetch((CONFIG.HF_API_BASE||"")+"/api/d1-query", { method: "POST", headers: h, body: JSON.stringify({ sql: "SELECT * FROM promos WHERE is_active=1 LIMIT 500" }) }).then(r=>r.json()).then(r => ({ data: (r.success && r.result[0].results) ? r.result[0].results : [] })).then(function(res) {
                return { data: res.data.map(function(d) {
                    d.is_active = d.is_active === 1;
                    d.is_repeated_config = d.is_repeated_config === 1;
                    ['applicable_products','applicable_categories','applicable_districts','applicable_payments'].forEach(function(k){
                        if(typeof d[k]==='string') try{ d[k]=JSON.parse(d[k]); }catch(e){}
                    });
                    return d;
                })};
            });
            p5 = fetch((CONFIG.HF_API_BASE||"")+"/api/d1-query", { method: "POST", headers: h, body: JSON.stringify({ sql: "SELECT id,name,base_price,flash_sale_price,gallery_images,variants FROM products WHERE is_add_once=1 AND is_active=1" }) }).then(r=>r.json()).then(r => ({ data: (r.success && r.result[0].results) ? r.result[0].results : [] })).then(function(res) {
                return { data: res.data.map(function(d) { if(typeof d.gallery_images==='string') try{ d.gallery_images=JSON.parse(d.gallery_images); }catch(e){} if(typeof d.variants==='string') try{ d.variants=JSON.parse(d.variants); }catch(e){} return d; }) };
            });
        }`;

const newLoading = `        } else if (CONFIG.DB_PROVIDER === 'cf_db') {
            var masterPromise = fetch((CONFIG.HF_API_BASE||"")+"/api/checkout-data").then(r => r.json()).catch(e => ({success:false, data:{}}));
            p1 = masterPromise.then(r => {
                var doc = (r.success && r.data && r.data.settings) ? r.data.settings : {};
                if (typeof doc.messaging_apps === 'string') try { doc.messaging_apps = JSON.parse(doc.messaging_apps); } catch(e){}
                if (typeof doc.crypto_coins === 'string') try { doc.crypto_coins = JSON.parse(doc.crypto_coins); } catch(e){}
                return { data: doc };
            });
            p2 = masterPromise.then(r => {
                var zones = (r.success && r.data && r.data.zones) ? r.data.zones : [];
                return { data: zones.map(function(d) { if(typeof d.gallery_images==='string') try{ d.gallery_images=JSON.parse(d.gallery_images); }catch(e){} return d; }) };
            });
            p3 = masterPromise.then(r => {
                var addonsList = (r.success && r.data && r.data.addons) ? r.data.addons : [];
                return { data: addonsList.map(function(d) { d.is_active = d.is_active === 1; if(typeof d.gallery_images==='string') try{ d.gallery_images=JSON.parse(d.gallery_images); }catch(e){} return d; }) };
            });
            p4 = masterPromise.then(r => {
                var promoList = (r.success && r.data && r.data.promos) ? r.data.promos : [];
                return { data: promoList.map(function(d) {
                    d.is_active = d.is_active === 1;
                    d.is_repeated_config = d.is_repeated_config === 1;
                    ['applicable_products','applicable_categories','applicable_districts','applicable_payments'].forEach(function(k){
                        if(typeof d[k]==='string') try{ d[k]=JSON.parse(d[k]); }catch(e){}
                    });
                    return d;
                })};
            });
            p5 = masterPromise.then(r => {
                var addOnceList = (r.success && r.data && r.data.add_once) ? r.data.add_once : [];
                return { data: addOnceList.map(function(d) { if(typeof d.gallery_images==='string') try{ d.gallery_images=JSON.parse(d.gallery_images); }catch(e){} if(typeof d.variants==='string') try{ d.variants=JSON.parse(d.variants); }catch(e){} return d; }) };
            });
        }`;

html = html.replace(oldLoading, newLoading);

// 2. Add saveOrderHelper at the top of placeOrder function (or outside it)
// We'll just replace the inner insert block in placeOrder and inject saveOrder.

const oldInsertBlock = `    var insertPromise;
    if (CONFIG.DB_PROVIDER === 'supabase') {
        insertPromise = supabaseClient.from('orders').insert([orderData]);
    } else if (CONFIG.DB_PROVIDER === 'appwrite') {
        var awOrderData = Object.assign({}, orderData);
        awOrderData.items  = JSON.stringify(awOrderData.items  || []);
        awOrderData.addons = JSON.stringify(awOrderData.addons || []);
        delete awOrderData.id;
        insertPromise = appwriteDatabases.createDocument(APP_DB, 'orders', orderId, awOrderData)
            .then(function(doc) { return { data: [{ id: doc.$id }], error: null }; })
            .catch(function(err) { return { data: null, error: err }; });
    } else if (CONFIG.DB_PROVIDER === 'cf_db') {
        insertPromise = fetch((CONFIG.HF_API_BASE||'')+'/api/save-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderData: orderData })
        }).then(function(res) { return res.json(); }).then(function(res) {
            if (!res.success) throw new Error(res.error);
            return { data: [{ id: orderId }], error: null };
        }).catch(function(err) { return { data: null, error: err }; });
    }`;

const saveOrderHelper = `    // Consolidated helper to insert order once
    function saveOrder(data) {
        if (CONFIG.DB_PROVIDER === 'supabase') {
            return supabaseClient.from('orders').insert([data]);
        } else if (CONFIG.DB_PROVIDER === 'appwrite') {
            var aw = Object.assign({}, data);
            aw.items  = JSON.stringify(aw.items  || []);
            aw.addons = JSON.stringify(aw.addons || []);
            var id = aw.id; delete aw.id;
            return appwriteDatabases.createDocument(APP_DB, 'orders', id, aw)
                .then(function(doc) { return { data: [{ id: doc.$id }], error: null }; })
                .catch(function(err) { return { data: null, error: err }; });
        } else if (CONFIG.DB_PROVIDER === 'cf_db') {
            return fetch((CONFIG.HF_API_BASE||'')+'/api/save-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderData: data })
            }).then(function(r){ return r.json(); }).then(function(r){
                if (!r.success) throw new Error(r.error);
                return { data: [{ id: data.id }], error: null };
            }).catch(function(err){ return { data: null, error: err }; });
        }
        return Promise.resolve({ data: null, error: { message: "Invalid DB provider" }});
    }

    var insertPromise = saveOrder(orderData);`;

html = html.replace(oldInsertBlock, saveOrderHelper);

// 3. Remove DB insert from initiateGatewayPayment
const gatewayInsertBlock = `    //  ┐╜  DB-αªñ    order save করে  ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ 
    var insertPromise;
    if (CONFIG.DB_PROVIDER === 'supabase') {
        insertPromise = supabaseClient.from('orders').insert([Object.assign({}, orderData, { payment_status: 'Unpaid', status: 'Pending' })]);
    } else if (CONFIG.DB_PROVIDER === 'appwrite') {
        var awOrderData2 = Object.assign({}, orderData, { payment_status: 'Unpaid', status: 'Pending' });
        awOrderData2.items  = JSON.stringify(awOrderData2.items  || []);
        awOrderData2.addons = JSON.stringify(awOrderData2.addons || []);
        delete awOrderData2.id;
        insertPromise = appwriteDatabases.createDocument(APP_DB, 'orders', orderId, awOrderData2)
            .then(function(doc) { return { data: [{ id: doc.$id }], error: null }; })
            .catch(function(err) { return { data: null, error: err }; });
    } else if (CONFIG.DB_PROVIDER === 'cf_db') {
        insertPromise = fetch((CONFIG.HF_API_BASE||'')+'/api/save-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderData: Object.assign({}, orderData, { payment_status: 'Unpaid', status: 'Pending' }) })
        }).then(function(res) { return res.json(); }).then(function(res) {
            if (!res.success) throw new Error(res.error);
            return { data: [{ id: orderId }], error: null };
        }).catch(function(err) { return { data: null, error: err }; });
    }

    insertPromise.then(function(r) {
        if (r.error) { alert('Order save failed: ' + r.error.message); return; }

        //  ┐╜     Gateway Execution (v1 and v2 now use same JSON logic)  ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ ┐╜ 
        var reqBody = {
            cus_name:    name,
            cus_email:   email,
            amount:      total,
            success_url: sUrl,
            cancel_url:  cUrl,
            tran_id:     orderId,
            api_key:     apiKey
        };

        fetch(proxyUrl + '?action=create', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'API-KEY': apiKey },
            body: JSON.stringify(reqBody)
        }).then(function(res) { return res.json(); }).then(function(pD) {
            if (pD.payment_url) {
                window.location.href = pD.payment_url;
            } else {
                alert('Gateway Error: ' + (pD.message || 'Cannot get payment URL'));
            }
        }).catch(function(err) {
            alert('Gateway connection failed. Try manual payment.');
        });
    });`;

const newGatewayBlock = `    // Order is already saved by placeOrder before calling initiateGatewayPayment.
    // Just execute Gateway.
    var reqBody = {
        cus_name:    name,
        cus_email:   email,
        amount:      total,
        success_url: sUrl,
        cancel_url:  cUrl,
        tran_id:     orderId,
        api_key:     apiKey
    };

    fetch(proxyUrl + '?action=create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'API-KEY': apiKey },
        body: JSON.stringify(reqBody)
    }).then(function(res) { return res.json(); }).then(function(pD) {
        if (pD.payment_url) {
            window.location.href = pD.payment_url;
        } else {
            alert('Gateway Error: ' + (pD.message || 'Cannot get payment URL'));
        }
    }).catch(function(err) {
        alert('Gateway connection failed. Try manual payment.');
    });`;

html = html.replace(gatewayInsertBlock, newGatewayBlock);

// 4. Update the initiateGatewayPayment call in placeOrder
const oldGatewayCall = `    if (selectedPayMethod === 'auto_gateway' || (selectedPayMethod === 'cod' && advancePayable > 0 && autoAdv)) {
        var gatewayAmount = (selectedPayMethod === 'cod') ? advancePayable : total;
        initiateGatewayPayment(orderId, gatewayAmount, orderData);
        return;
    }`;

const newGatewayCall = `    if (selectedPayMethod === 'auto_gateway' || (selectedPayMethod === 'cod' && advancePayable > 0 && autoAdv)) {
        var btn = document.getElementById('placeOrderBtn');
        btn.disabled = true;
        btn.textContent = 'Redirecting to Gateway...';
        
        orderData.payment_status = 'Unpaid';
        orderData.status = 'Pending';
        
        saveOrder(orderData).then(function(r) {
            if (r.error) { btn.disabled = false; btn.innerHTML = '<i data-lucide="rocket" class="lucide-icon icon-bounce"></i> Place Order'; alert('Error: ' + r.error.message); return; }
            var gatewayAmount = (selectedPayMethod === 'cod') ? advancePayable : total;
            initiateGatewayPayment(orderId, gatewayAmount, orderData);
        });
        return;
    }`;

html = html.replace(oldGatewayCall, newGatewayCall);

// Remove the global saveOrder if I injected it earlier inside placeOrder and it causes scope issues?
// No, I injected saveOrderHelper right before insertPromise in placeOrder. BUT newGatewayCall is called BEFORE that.
// So I should move saveOrder helper to global scope or at the top of placeOrder().
// Actually, newGatewayCall doesn't have access to saveOrder if saveOrder is defined AFTER it.
// Let's rewrite the replacement for saveOrder to put it at the very top of placeOrder().

// I'll revert and do it properly:
fs.writeFileSync('checkout_update.js', html);
console.log('Script written to checkout_update.js');
