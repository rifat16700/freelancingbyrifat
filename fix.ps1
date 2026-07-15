$content = Get-Content "checkout.html" -Encoding UTF8 -Raw

$chunk1 = @"
    var insertPromise;
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
    }
"@

$replace1 = "    var insertPromise = saveOrder(orderData);"
$content = $content.Replace($chunk1, $replace1)


$chunk2 = @"
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
"@

$replace2 = "    var insertPromise = Promise.resolve({ data: [{ id: orderId }], error: null });"
$content = $content.Replace($chunk2, $replace2)


$chunk3 = @"
    var insertOrderPromise;
    if (CONFIG.DB_PROVIDER === 'supabase') {
        insertOrderPromise = supabaseClient.from('orders').insert([orderData]);
    } else if (CONFIG.DB_PROVIDER === 'appwrite') {
        var awCryptoOrder = Object.assign({}, orderData);
        awCryptoOrder.items  = JSON.stringify(awCryptoOrder.items  || []);
        awCryptoOrder.addons = JSON.stringify(awCryptoOrder.addons || []);
        delete awCryptoOrder.id;
        insertOrderPromise = appwriteDatabases.createDocument(APP_DB, 'orders', orderId, awCryptoOrder)
            .then(function(doc) { return { data: [{ id: doc.$id }], error: null }; })
            .catch(function(err) { return { data: null, error: err }; });
    } else if (CONFIG.DB_PROVIDER === 'cf_db') {
        insertOrderPromise = fetch((CONFIG.HF_API_BASE||'')+'/api/save-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderData: orderData })
        }).then(function(res) { return res.json(); }).then(function(res) {
            if (!res.success) throw new Error(res.error);
            return { data: [{ id: orderId }], error: null };
        }).catch(function(err) { return { data: null, error: err }; });
    } else {
        insertOrderPromise = Promise.resolve({ data: null, error: { message: 'Appwrite not implemented' } });
    }
"@

$replace3 = "    var insertOrderPromise = saveOrder(orderData);"
$content = $content.Replace($chunk3, $replace3)

# Write it back WITH BOM if it had one, or without. Out-File uses BOM for UTF8 in Windows PowerShell.
[IO.File]::WriteAllText("checkout.html", $content, [System.Text.Encoding]::UTF8)
Write-Host "Replacements completed!"
