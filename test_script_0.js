
// ── State ────────────────────────────────────────────────────
var cart = [], settings = {}, zones = [], addons = [];
var addOnceProducts = []; // Add-Once products list
var currentStep  = 1;
var deliveryCharge = 0, addonTotal = 0, promoDiscount = 0;
var promoCode = '', selectedAddons = [];
var advancePayable = 0;
var selectedPayMethod = '';
var allPromos = [];
var draftSent = false;
var promoPaymentRestrictions = []; // payment methods required by applied coupon
var promoFreeDelivery = false;     // if coupon gives free delivery
var isPickup = new URLSearchParams(window.location.search).get('pickup') === '1';
// Direct Order (Buy Now) — main cart থেকে আলাদা
var isDirectOrder = new URLSearchParams(window.location.search).get('direct') === '1';
var DIRECT_KEY = (typeof CONFIG !== 'undefined' && CONFIG.DIRECT_ORDER_KEY) ? CONFIG.DIRECT_ORDER_KEY : 'fbr_direct_order';

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    // Direct Order হলে আলাদা key থেকে load করো, main cart untouched
    if (isDirectOrder) {
        try { cart = JSON.parse(localStorage.getItem(DIRECT_KEY) || '[]'); } catch(e) { cart = []; }
        if (!cart.length) { window.location.href = 'shop.html'; return; }
    } else {
        cart = getCart();
        if (!cart.length) { window.location.href = 'cart.html'; return; }
    }

    if (isPickup) {
        deliveryCharge = 0;
        document.getElementById('step2dot').style.display = 'none';
        document.getElementById('line12').style.width = '100%';
        document.getElementById('line23').style.display = 'none';
        document.getElementById('backBtn').setAttribute('onclick', 'goStep(1)');
    }

    var urlParams = new URLSearchParams(window.location.search);
    var getParam = function(key1, key2) {
        return urlParams.get(key1) || (key2 ? urlParams.get(key2) : null);
    };
    
    var status = urlParams.get('status');
    var orderId = urlParams.get('order_id') || urlParams.get('orderId');
    var trxId = urlParams.get('trx_id') || urlParams.get('transaction_id') || urlParams.get('tran_id') || urlParams.get('transactionId');

    var p1, p2, p3, p4, p5;
    try {
        if (CONFIG.DB_PROVIDER === 'supabase') {
            p1 = supabaseClient.from('settings').select('*').eq('id',1).single();
            p2 = supabaseClient.from('delivery_zones').select('*');
            p3 = supabaseClient.from('addons').select('*').eq('is_active',true).order('created_at');
            p4 = supabaseClient.from('promos').select('*').eq('is_active',true);
            p5 = supabaseClient.from('products').select('id,name,base_price,flash_sale_price,gallery_images,variants').eq('is_add_once',true).eq('is_active',true);
        } else if (CONFIG.DB_PROVIDER === 'appwrite') {
            p1 = appwriteDatabases.getDocument(APP_DB, 'settings', 'main_settings')
                .then(function(doc) {
                    if (typeof doc.messaging_apps === 'string') { try { doc.messaging_apps = JSON.parse(doc.messaging_apps); } catch(e) { doc.messaging_apps = []; } }
                    if (typeof doc.crypto_coins  === 'string') { try { doc.crypto_coins  = JSON.parse(doc.crypto_coins);  } catch(e) { doc.crypto_coins = []; } }
                    return { data: doc };
                }).catch(function() { return { data: {} }; });
            p2 = appwriteDatabases.listDocuments(APP_DB, 'delivery_zones', [])
                .then(function(res) { return { data: res.documents.map(function(d) { d.id = d.$id; d.created_at = d.$createdAt; if (typeof d.gallery_images === 'string') { try { d.gallery_images = JSON.parse(d.gallery_images); } catch(e) { d.gallery_images = []; } } return d; }) }; })
                .catch(function() { return { data: [] }; });
            p3 = appwriteDatabases.listDocuments(APP_DB, 'addons', [
                    AppwriteQuery.equal('is_active', true),
                    AppwriteQuery.orderAsc('$createdAt')
                ]).then(function(res) { return { data: res.documents.map(function(d) { d.id = d.$id; d.created_at = d.$createdAt; if (typeof d.gallery_images === 'string') { try { d.gallery_images = JSON.parse(d.gallery_images); } catch(e) { d.gallery_images = []; } } return d; }) }; })
                .catch(function() { return { data: [] }; });
            p4 = appwriteDatabases.listDocuments(APP_DB, 'promos', [
                    AppwriteQuery.equal('is_active', true),
                    AppwriteQuery.limit(500)
                ]).then(function(res) { return { data: res.documents.map(function(d) { d.id = d.$id; d.created_at = d.$createdAt; if (typeof d.gallery_images === 'string') { try { d.gallery_images = JSON.parse(d.gallery_images); } catch(e) { d.gallery_images = []; } } return d; }) }; })
                .catch(function() { return { data: [] }; });
            p5 = fetch('/api/appwrite-get-products?t=' + Date.now()).then(function(r) { return r.json(); }).then(function(data) {
                return { data: (Array.isArray(data) ? data : []).filter(function(d) { return d.is_add_once === true && d.is_active === true; }) };
            }).catch(function() { return { data: [] }; });
        } else {
            p1 = Promise.resolve({data:{}}); p2 = Promise.resolve({data:[]}); p3 = Promise.resolve({data:[]}); p4 = Promise.resolve({data:[]}); p5 = Promise.resolve({data:[]});
        }

        Promise.all([p1, p2, p3, p4, p5]).then(function(results) {
        settings = results[0].data || {};
        zones    = results[1].data || [];
        addons   = results[2].data || [];
        allPromos = results[3].data || [];
        addOnceProducts = results[4].data || [];

        document.getElementById('navBrand').textContent = settings.store_name || CONFIG.STORE_NAME;
        document.getElementById('pageLoader').style.display = 'none';

        renderSummaryItems();
        renderAddons();
        renderAddOnce();
        loadBdDivisions();

        var checkStatus = (status || '').toLowerCase();
        if ((checkStatus === 'completed' || checkStatus === 'success') && orderId) {
            verifyGatewayPayment(orderId, trxId);
        } else if (checkStatus === 'cancel' || checkStatus === 'failed') {
            alert('Payment was cancelled or failed.');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }).catch(function(err) {
        console.error('Data load error:', err);
        document.getElementById('pageLoader').style.display = 'none';
    });
    } catch (e) {
        console.error('Init error:', e);
        document.getElementById('pageLoader').style.display = 'none';
    }

    document.addEventListener('visibilitychange', function() {
        if (document.hidden && !draftSent && cart.length) {
            sendDraftNotification();
            draftSent = true;
        }
    });
});

// ── Render Order Summary Items ────────────────────────────────
function renderSummaryItems() {
    var subtotal = 0;
    var html = cart.map(function(item) {
        var lineTotal = item.price * (item.quantity || 1);
        subtotal += lineTotal;
        return '<div class="order-item-row2">' +
            (item.image ? '<img src="' + item.image + '" style="width:48px;height:48px;border-radius:8px;object-fit:cover;background:#f5f5f5;flex-shrink:0;">' : '') +
            '<div style="flex:1;font-size:13px;">' +
                '<div style="font-weight:700;">' + item.productName + '</div>' +
                '<div style="color:#888;">' + (item.color||'') + ' / ' + (item.size||'') + ' × ' + (item.quantity||1) + '</div>' +
            '</div>' +
            '<div style="font-weight:800;font-size:14px;color:var(--primary);">৳' + lineTotal + '</div>' +
        '</div>';
    }).join('');

    document.getElementById('summaryItems').innerHTML = html;
    document.getElementById('smSubtotal').textContent = '৳' + subtotal;
    updateSummaryTotals();
}

var activePromoObj = null;

function updateSummaryTotals() {
    var subtotal = cart.reduce(function(s,i){return s+i.price*(i.quantity||1);},0);
    
    var prodDisc = 0;
    var delDisc = 0;
    
    if (activePromoObj) {
        var minSpend  = activePromoObj.min_spend || 0;
        if (subtotal >= minSpend) {
            var discType  = activePromoObj.disc_type || 'flat';
            var discVal   = activePromoObj.disc_val || activePromoObj.discount || 0;
            var maxCap    = activePromoObj.max_cap || null;
            
            if (discType === 'percent') {
                prodDisc = (discVal / 100) * subtotal;
                if (maxCap && prodDisc > maxCap) prodDisc = maxCap;
            } else {
                prodDisc = discVal;
            }
            
            var delReward = activePromoObj.del_reward || 'none';
            var delAmt    = activePromoObj.del_disc_amount || null;
            var delCap    = activePromoObj.del_disc_cap || null;
            
            if (delReward === 'free') {
                delDisc = deliveryCharge;
            } else if (delReward === 'amount' && delAmt) {
                delDisc = parseFloat(delAmt);
                if (delDisc > deliveryCharge) delDisc = deliveryCharge;
            } else if (delReward === 'percent' && delAmt) {
                delDisc = (parseFloat(delAmt)/100) * deliveryCharge;
                if (delCap && delDisc > delCap) delDisc = delCap;
            }
        } else {
            activePromoObj = null;
            promoCode = '';
            document.getElementById('promoInput').value = '';
            document.getElementById('promoMsg').innerHTML = '';
            alert('Minimum spend for coupon not met anymore.');
        }
    }
    
    promoDiscount = prodDisc; // keep legacy variable for product disc
    var effectiveDelivery = deliveryCharge - delDisc;
    if (effectiveDelivery < 0) effectiveDelivery = 0;
    
    var total = subtotal + addonTotal + effectiveDelivery - prodDisc;
    
    document.getElementById('smAddon').textContent   = '৳' + addonTotal;
    
    if (delDisc > 0) {
        document.getElementById('smDelivery').innerHTML = '<del style="color:#aaa;font-size:11px;">৳' + deliveryCharge + '</del> ' + (effectiveDelivery > 0 ? '৳' + effectiveDelivery : '<span style="color:var(--success);">Free</span>');
    } else {
        document.getElementById('smDelivery').textContent = deliveryCharge > 0 ? '৳' + deliveryCharge : '—';
    }
    
    document.getElementById('smPromo').textContent    = '-৳' + prodDisc.toFixed(0);
    document.getElementById('smTotal').textContent    = '৳' + total.toFixed(0);
    
    document.getElementById('addonLine').style.display  = addonTotal > 0 ? 'flex' : 'none';
    document.getElementById('promoLine').style.display  = prodDisc > 0 ? 'flex' : 'none';
    
    return total;
}

// ── Add-Once Products ─────────────────────────────────────────
var selectedAddOnce = []; // {id, name, price}

function getAddOncePrice(p) {
    if (p.flash_sale_price > 0) return p.base_price - p.flash_sale_price;
    return p.base_price || 0;
}

function getAddOnceImg(p) {
    if (p.variants && p.variants.length && p.variants[0].imageUrl) return p.variants[0].imageUrl;
    if (p.gallery_images && p.gallery_images.length) return p.gallery_images[0];
    return '';
}

function renderAddOnce() {
    if (!addOnceProducts.length) { document.getElementById('addOnceSection').style.display = 'none'; return; }
    document.getElementById('addOnceSection').style.display = 'block';

    var preview = addOnceProducts.slice(0, 2);
    var rest    = addOnceProducts.slice(2);

    document.getElementById('addOncePreviewList').innerHTML = preview.map(function(p) {
        return buildAddOnceCardHtml(p);
    }).join('');

    var btn = document.getElementById('addOnceViewMoreBtn');
    if (rest.length > 0) {
        btn.style.display = 'block';
        btn.textContent   = '\uD83D\uDECD\uFE0F View More (' + rest.length + ' more Add-Once products)';
    } else {
        btn.style.display = 'none';
    }
}

function buildAddOnceCardHtml(p) {
    var price = getAddOncePrice(p);
    var img   = getAddOnceImg(p);
    var isSel = selectedAddOnce.some(function(x){ return x.id === p.id; });
    return '<div class="add-once-card' + (isSel ? ' selected' : '') + '" onclick="toggleAddOnceProduct(\'' + p.id + '\', ' + price + ', \'' + (p.name||'').replace(/'/g,'') + '\', \'' + img + '\')" id="aoc_' + p.id + '">' +
        (img ? '<img src="' + img + '" class="add-once-img" onerror="this.style.display=\'none\'">' : '') +
        '<div style="flex:1;">' +
            '<div style="font-weight:700;font-size:14px;color:var(--text-dark);">' + (p.name||'') + '</div>' +
            (p.flash_sale_price > 0 ? '<div style="font-size:12px;color:#888;"><del>৳' + p.base_price + '</del></div>' : '') +
            '<div style="font-size:15px;font-weight:800;color:#627EEA;">+৳' + price + '</div>' +
        '</div>' +
        '<div style="width:22px;height:22px;border-radius:50%;border:2px solid ' + (isSel ? '#627EEA' : '#ddd') + ';background:' + (isSel ? '#627EEA' : 'transparent') + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s;">' +
            (isSel ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '') +
        '</div>' +
    '</div>';
}

function toggleAddOnceProduct(id, price, name, img) {
    var idx = selectedAddOnce.findIndex(function(x){ return x.id === id; });
    if (idx > -1) {
        selectedAddOnce.splice(idx, 1);
    } else {
        selectedAddOnce.push({ id: id, price: price, name: name, image: img });
    }
    // Update addonTotal
    addonTotal = selectedAddons.reduce(function(s,a){return s+a.price;},0) +
                 selectedAddOnce.reduce(function(s,a){return s+a.price;},0);
    updateSummaryTotals();
    // Refresh all cards showing this product (preview + sheet)
    var cards = document.querySelectorAll('#aoc_' + id);
    var p = addOnceProducts.find(function(x){ return x.id === id; });
    if (p) cards.forEach(function(c){ c.outerHTML = buildAddOnceCardHtml(p); });
}

function openAddOnceSheet() {
    var overlay = document.getElementById('addOnceSheetOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'addOnceSheetOverlay';
        overlay.className = 'add-once-sheet-overlay';
        overlay.innerHTML =
            '<div class="add-once-sheet" id="addOnceSheetInner">' +
                '<div style="width:40px;height:4px;background:#ddd;border-radius:4px;margin:12px auto 4px;"></div>' +
                '<div style="padding:14px 20px 10px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f0f0f0;">' +
                    '<div style="font-size:16px;font-weight:800;color:var(--text-dark);">\uD83D\uDECD\uFE0F All Add-Once Products</div>' +
                    '<button onclick="closeAddOnceSheet()" style="border:none;background:rgba(0,0,0,0.06);border-radius:50%;width:30px;height:30px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">\u2715</button>' +
                '</div>' +
                '<div style="padding:14px 16px;display:flex;flex-direction:column;gap:8px;" id="addOnceSheetList"></div>' +
            '</div>';
        overlay.addEventListener('click', function(e){ if(e.target===overlay) closeAddOnceSheet(); });
        document.body.appendChild(overlay);
    }
    // Populate sheet with all add-once products
    document.getElementById('addOnceSheetList').innerHTML = addOnceProducts.map(function(p){
        return buildAddOnceCardHtml(p);
    }).join('');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeAddOnceSheet() {
    var overlay = document.getElementById('addOnceSheetOverlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
    // Refresh preview list too
    renderAddOnce();
}

// ── Addons ────────────────────────────────────────────────────
function renderAddons() {
    if (!addons.length) { document.getElementById('addonsSection').style.display = 'none'; return; }
    var html = addons.map(function(a) {
        var cleanIcon = a.icon ? a.icon.replace(/(?:\*|body|html)\s*\{[^}]+\}/gi, '') : '<i data-lucide="gift" class="lucide-icon icon-bounce"></i>';
        return '<div class="addon-item" onclick="toggleAddon(\'' + a.id + '\',this)" data-id="' + a.id + '" data-price="' + a.price + '">' +
            '<span style="font-size:22px;">' + (a.icon ? a.icon.replace(/<style\\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') : '<i data-lucide="gift" class="lucide-icon icon-bounce"></i>') + '</span>' +
            '<div style="flex:1;"><div style="font-weight:700;font-size:14px;">' + a.name + '</div></div>' +
            '<div style="font-weight:800;color:var(--primary);">+৳' + a.price + '</div>' +
            '<input type="checkbox" style="width:18px;height:18px;accent-color:var(--primary);" data-chk="' + a.id + '">' +
        '</div>';
    }).join('');
    document.getElementById('addonsList').innerHTML = html;
}

function toggleAddon(id, el) {
    var chk = el.querySelector('[data-chk]');
    chk.checked = !chk.checked;
    el.classList.toggle('selected', chk.checked);

    var price = parseInt(el.dataset.price) || 0;
    if (chk.checked) {
        if (!selectedAddons.find(function(a){return a.id===id;})) selectedAddons.push({id:id, price:price, name:el.querySelector('div > div').textContent});
    } else {
        selectedAddons = selectedAddons.filter(function(a){return a.id!==id;});
    }

    addonTotal = selectedAddons.reduce(function(s,a){return s+a.price;},0);
    updateSummaryTotals();
}

// ── BD APIs ─────────────────────────────────────────────────
function loadBdDivisions() {
    fetch('https://bdapis.com/api/v1.1/divisions').then(function(r){return r.json();}).then(function(d) {
        var sel = document.getElementById('divSelect');
        (d.data || []).forEach(function(div) {
            sel.innerHTML += '<option value="' + div.division + '">' + div.division + '</option>';
        });
    }).catch(function(){});
}

var bdDivisionData = [];

function loadDistricts() {
    var div = document.getElementById('divSelect').value;
    if (!div) return;
    var sel = document.getElementById('distSelect');
    sel.innerHTML = '<option value="">Loading...</option>';
    fetch('https://bdapis.com/api/v1.1/division/' + div.toLowerCase()).then(function(r){return r.json();}).then(function(d) {
        bdDivisionData = d.data || [];
        sel.innerHTML = '<option value="">Select District</option>';
        bdDivisionData.forEach(function(dist) {
            sel.innerHTML += '<option value="' + dist.district + '">' + dist.district + '</option>';
        });
    }).catch(function(){});
}

function loadUpazilas() {
    var dist = document.getElementById('distSelect').value;
    if (!dist) return;
    var sel = document.getElementById('upaSelect');
    sel.innerHTML = '<option value="">Select Upazila</option>';
    
    var distData = bdDivisionData.find(function(d){ return d.district === dist; });
    if (distData) {
        var upaList = distData.upazilla || distData.upazillas || distData.upazila || [];
        if (Array.isArray(upaList)) {
            upaList.forEach(function(u) {
                sel.innerHTML += '<option value="' + u + '">' + u + '</option>';
            });
        }
    }
    calcDelivery();
}

function calcDelivery() {
    if (isPickup) {
        deliveryCharge = 0;
        updateSummaryTotals();
        return;
    }
    var district = document.getElementById('distSelect').value;
    if (!district) return;

    deliveryCharge = 120; // default
    for (var i = 0; i < zones.length; i++) {
        var z = zones[i];
        if (z.districts && z.districts.includes(district)) {
            deliveryCharge = z.charge;
            break;
        }
        if (!z.districts || z.districts.length === 0) {
            deliveryCharge = z.charge; // fallback zone
        }
    }

    document.getElementById('deliveryInfo').style.display = 'block';
    document.getElementById('deliveryChargeLabel').textContent = '৳' + deliveryCharge;
    updateSummaryTotals();
}

// ── Stepper ──────────────────────────────────────────────────
function goStep(n) {
    currentStep = n;
    ['step1','step2','step3'].forEach(function(id, i) {
        document.getElementById(id).style.display = (i+1 === n) ? 'block' : 'none';
    });

    var dots = ['step1dot','step2dot','step3dot'];
    dots.forEach(function(id, i) {
        var el = document.getElementById(id);
        el.classList.remove('active','done');
        if (i+1 < n)  el.classList.add('done');
        if (i+1 === n) el.classList.add('active');
    });

    ['line12','line23'].forEach(function(id, i) {
        var el = document.getElementById(id);
        el.classList.toggle('done', n > i+2);
    });

    window.scrollTo({top: 0, behavior: 'smooth'});
}

function goStep2() {
    var name  = document.getElementById('custName').value.trim();
    var phone = document.getElementById('custPhone').value.trim();
    if (!name)  { alert('Please enter your name'); return; }
    if (!phone || phone.length < 11) { alert('Please enter a valid phone number'); return; }
    
    if (isPickup) {
        buildPaymentOptions();
        goStep(3);
    } else {
        goStep(2);
    }
}

function goStep3() {
    var div  = document.getElementById('divSelect').value;
    var dist = document.getElementById('distSelect').value;
    var upa  = document.getElementById('upaSelect').value;
    var addr = document.getElementById('custAddress').value.trim();
    if (!div || !dist) { alert('Please select Division and District'); return; }
    if (!addr) { alert('Please enter your address'); return; }

    buildPaymentOptions();
    goStep(3);
}

// ── Payment Options ───────────────────────────────────────────
function buildPaymentOptions() {
    var subtotal = cart.reduce(function(s,i){return s+i.price*(i.quantity||1);},0);

    // Calculate effective delivery after coupon discount
    var delDisc = 0;
    if (activePromoObj && activePromoObj.del_reward === 'free') {
        delDisc = deliveryCharge;
    } else if (activePromoObj && activePromoObj.del_reward === 'amount' && activePromoObj.del_disc_amount) {
        delDisc = Math.min(parseFloat(activePromoObj.del_disc_amount), deliveryCharge);
    } else if (activePromoObj && activePromoObj.del_reward === 'percent' && activePromoObj.del_disc_amount) {
        delDisc = (parseFloat(activePromoObj.del_disc_amount)/100) * deliveryCharge;
        if (activePromoObj.del_disc_cap && delDisc > activePromoObj.del_disc_cap) delDisc = activePromoObj.del_disc_cap;
    }
    var effectiveDelivery = Math.max(0, deliveryCharge - delDisc);
    var isFreeDelivery = (effectiveDelivery === 0 && !isPickup);

    var total = subtotal + addonTotal + effectiveDelivery - promoDiscount;

    // Advance: only for COD, and only if delivery is not free
    var advAmt = parseInt(settings.advance_amount);
    if (isNaN(advAmt)) advAmt = 0;
    if (isFreeDelivery || isPickup) {
        advancePayable = 0; // free delivery = no advance needed
    } else if (advAmt === -1) {
        advancePayable = effectiveDelivery; // advance = delivery charge only
    } else if (advAmt > 0) {
        advancePayable = advAmt;
    } else {
        advancePayable = 0;
    }

    // Advance section: শুধু COD select হলে দেখাবে — selectPayment() এ control হয়
    // Initially hide করে রাখো, payment type বেছে নিলে সঠিকভাবে show/hide হবে
    document.getElementById('advanceSection').style.display = 'none';
    document.getElementById('advPayLine').style.display = 'none';
    document.getElementById('codPayLine').style.display = 'none';
    // If rebuilding (coupon applied) and COD was already selected — re-show
    if (selectedPayMethod === 'cod' && advancePayable > 0 && !isPickup) {
        var advSec2 = document.getElementById('advanceSection');
        advSec2.style.display = 'block';
        document.getElementById('advanceInfoText').textContent   = 'Remaining \u09f3' + Math.round(total - advancePayable) + ' will be paid on delivery.';
        document.getElementById('advanceAmountLabel').textContent = '\u09f3' + advancePayable;
        document.getElementById('advPayLine').style.display = 'flex';
        document.getElementById('smAdvPay').textContent     = '\u09f3' + advancePayable;
        document.getElementById('codPayLine').style.display = 'flex';
        document.getElementById('smCod').textContent        = '\u09f3' + Math.round(total - advancePayable);
    }

    if (isPickup && settings.store_address) {
        document.getElementById('pickupInfo').style.display = 'block';
        document.getElementById('storeAddrText').textContent = settings.store_address;
    } else {
        document.getElementById('pickupInfo').style.display = 'none';
    }

    // Payment method filtering by coupon restriction
    var allowed = promoPaymentRestrictions;
    function isAllowed(key) {
        if (!allowed.length) return true;
        return allowed.some(function(pm){ return key.toLowerCase().includes(pm.toLowerCase()); });
    }

    var proxyUrl = settings.gateway_proxy_url || CONFIG.GATEWAY_PROXY_URL;
    var hasGateway   = !!(proxyUrl && isAllowed('online'));
    var hasBkash     = !!(settings.bkash_number && isAllowed('bkash'));
    var hasNagad     = !!(settings.nagad_number && isAllowed('nagad'));
    var hasBinanceM  = !!(settings.binance_pay_uid && isAllowed('binance'));
    var hasManual    = hasBkash || hasNagad || hasBinanceM;
    var hasCod       = settings.allow_cod && !isPickup && isAllowed('cod');

    var total = updateSummaryTotals();
    var html = '';

    // ── 1. Auto Payment Gateway ───────────────────────────────
    if (hasGateway) {
        html += buildPayCard(
            'auto_gateway',
            '<i data-lucide="globe" class="lucide-icon icon-spin" style="font-size:20px;"></i>',
            'Auto Payment',
            'bKash / Nagad / Card — via payment gateway',
            // body: redirect button rendered by gateway flow
            '<div style="padding:4px 0 2px;">' +
                '<div style="font-size:12px;color:#666;margin-bottom:10px;">Click "Place Order" below to be redirected to the secure payment gateway.</div>' +
                '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#888;"><span>🔒</span> Secured by payment gateway</div>' +
            '</div>'
        );
    }

    // ── 2. Manual Payment (accordion with sub-options) ────────
    if (hasManual) {
        var subCards = '';

        if (hasBkash) {
            subCards += buildSubCard(
                'manual_bkash', '💜', 'bKash',
                'Send to ' + settings.bkash_number,
                buildManualDetail(settings.bkash_number, 'bKash', '৳' + Math.round(total), 'bkash')
            );
        }
        if (hasNagad) {
            subCards += buildSubCard(
                'manual_nagad', '🧡', 'Nagad',
                'Send to ' + settings.nagad_number,
                buildManualDetail(settings.nagad_number, 'Nagad', '৳' + Math.round(total), 'nagad')
            );
        }
        if (hasBinanceM) {
            subCards += buildSubCard(
                'manual_binance', '🟡', 'Binance Manual',
                'Send USDT to UID: ' + settings.binance_pay_uid,
                buildBinanceManualDetail(settings.binance_pay_uid, total)
            );
        }

        html += buildPayCard(
            'manual_group',
            '💳',
            'Manual Payment',
            'bKash / Nagad / Binance — send & enter TrxID',
            subCards
        );
    }

    // ── 3. COD ────────────────────────────────────────────────
    if (hasCod) {
        var codLabel = advancePayable > 0 ? 'Hybrid COD (Advance + Delivery)' : 'Cash on Delivery';
        var codDesc  = advancePayable > 0 ? 'Pay ৳' + advancePayable + ' advance, rest on delivery' : 'Pay when product is received';
        html += buildPayCard('cod', '💵', codLabel, codDesc,
            '<div style="font-size:12px;color:#666;padding:2px 0;">✅ No advance payment needed online. Pay the delivery agent when your order arrives.</div>'
        );
    }
    if (isPickup) {
        html += buildPayCard('cod', '🏪', 'Pay at Pickup', 'Pay when you collect your order',
            '<div style="font-size:12px;color:#666;padding:2px 0;">✅ Pay at the store when you arrive to pick up your order.</div>'
        );
    }

    if (!html) html = '<div style="padding:20px;text-align:center;color:#999;font-size:13px;">⚠️ No payment method available for this coupon. Please remove the coupon or contact support.</div>';

    document.getElementById('paymentOptions').innerHTML = html;
    document.getElementById('manualPayBox').style.display = 'none'; // legacy hidden
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── Accordion card builders ───────────────────────────────────
function buildPayCard(value, icon, label, desc, bodyHtml) {
    return '<div class="pay-card" id="pc-' + value + '" data-paycard="' + value + '">' +
        '<div class="pay-card-header" onclick="selectPayCard(\'' + value + '\')">' +
            '<input class="pay-card-radio" type="radio" name="payMethod" value="' + value + '">' +
            '<span class="pay-card-icon">' + icon + '</span>' +
            '<div class="pay-card-info">' +
                '<div class="pay-card-label">' + label + '</div>' +
                '<div class="pay-card-desc">' + desc + '</div>' +
            '</div>' +
            '<span class="pay-card-chevron">›</span>' +
        '</div>' +
        '<div class="pay-card-body">' + bodyHtml + '</div>' +
    '</div>';
}

function buildSubCard(value, icon, label, desc, bodyHtml) {
    return '<div class="pay-sub-card" id="psc-' + value + '" data-subcardval="' + value + '">' +
        '<div class="pay-sub-header" onclick="selectSubCard(\'' + value + '\')">' +
            '<input class="pay-sub-radio" type="radio" name="paySubMethod" value="' + value + '">' +
            '<span class="pay-sub-icon">' + icon + '</span>' +
            '<div class="pay-sub-info">' +
                '<div class="pay-sub-label">' + label + '</div>' +
                '<div class="pay-sub-desc">' + desc + '</div>' +
            '</div>' +
            '<span class="pay-sub-chevron">›</span>' +
        '</div>' +
        '<div class="pay-sub-body">' + bodyHtml + '</div>' +
    '</div>';
}

function buildManualDetail(number, methodName, amtLabel, methodKey) {
    var sId = 'senderNumber_' + methodKey;
    var tId = 'trxId_' + methodKey;
    return '<div style="font-size:13px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px;">' +
            'Send <span style="color:var(--primary);font-size:16px;">' + amtLabel + '</span>' +
            ' <button type="button" onclick="copyDirect(this,\'' + amtLabel + '\')" style="background:none;border:none;cursor:pointer;color:#aaa;font-size:14px;padding:2px 4px;border-radius:4px;" title="Copy amount">📋</button> to:' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">' +
            '<div style="font-size:20px;font-weight:900;color:var(--text-dark);">' + number + '</div>' +
            '<button type="button" onclick="copyDirect(this,\'' + number + '\')" style="background:rgba(0,0,0,0.06);border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:12px;font-weight:700;color:#555;">Copy</button>' +
        '</div>' +
        '<div style="font-size:12px;color:#888;margin-bottom:14px;">' + methodName + ' Personal</div>' +
        '<div class="form-group" style="margin-bottom:10px;">' +
            '<label class="form-label">Sender Number *</label>' +
            '<input class="form-input" id="' + sId + '" data-role="senderInput" placeholder="Number you sent from" type="tel">' +
        '</div>' +
        '<div class="form-group" style="margin-bottom:0;">' +
            '<label class="form-label">Transaction ID *</label>' +
            '<input class="form-input" id="' + tId + '" data-role="trxInput" placeholder="TrxID / Reference Number">' +
        '</div>';
}

function buildBinanceManualDetail(uid, total) {
    var rate = parseFloat(settings.usd_to_bdt_rate || 110);
    var usdtAmt = (total / rate).toFixed(2);
    var tId = 'trxId_binance';
    return '<div style="background:rgba(240,185,11,0.07);border:1.5px solid rgba(240,185,11,0.3);border-radius:10px;padding:12px;margin-bottom:12px;">' +
        '<div style="font-size:12px;color:#92710B;font-weight:700;margin-bottom:6px;">🟡 Send USDT (Binance Pay)</div>' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
            '<div style="font-size:18px;font-weight:900;color:#B8860B;">' + uid + '</div>' +
            '<button type="button" onclick="copyDirect(this,\'' + uid + '\')" style="background:rgba(240,185,11,0.15);border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:11px;font-weight:700;color:#92710B;">Copy UID</button>' +
        '</div>' +
        '<div style="font-size:12px;color:#888;">Amount: ~' + usdtAmt + ' USDT <span style="color:#aaa;">(৳' + Math.round(total) + ' ÷ ' + rate + ')</span></div>' +
        '<div style="margin-top:6px;">' +
            '<button type="button" onclick="copyDirect(this,\'' + usdtAmt + '\')" style="background:rgba(240,185,11,0.15);border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;font-weight:700;color:#92710B;">Copy Amount</button>' +
        '</div>' +
    '</div>' +
    '<div class="form-group" style="margin-bottom:0;">' +
        '<label class="form-label">Binance Transaction ID / TxID *</label>' +
        '<input class="form-input" id="' + tId + '" data-role="trxInput" placeholder="Binance Pay Transaction ID">' +
        '<div style="font-size:11px;color:#aaa;margin-top:4px;">Binance App → Pay History → সেই transaction এর ID দাও</div>' +
    '</div>';
}

// legacy payOpt kept for backward compat (not used in main flow)
function payOpt(value, icon, name, desc, badge) {
    return '<div class="payment-option" onclick="selectPayment(\'' + value + '\')" data-payval="' + value + '">' +
        '<input type="radio" name="payMethod" value="' + value + '">' +
        '<span style="font-size:22px;">' + icon + '</span>' +
        '<div><div class="payment-label">' + name + '</div><div class="payment-desc">' + desc + '</div></div>' +
    '</div>';
}

// ── Accordion: select a top-level pay card ───────────────────
function selectPayCard(value) {
    // Toggle: click same card again to collapse
    var isSame = (selectedPayMethod === value || (value === 'manual_group' && selectedPayMethod && selectedPayMethod.startsWith('manual_')));
    if (isSame && document.getElementById('pc-' + value) && document.getElementById('pc-' + value).classList.contains('selected')) {
        // collapse
        document.querySelectorAll('.pay-card').forEach(function(c){ c.classList.remove('selected'); c.querySelector('.pay-card-radio').checked = false; });
        selectedPayMethod = '';
        _updateAdvanceFunUI(false, 0, updateSummaryTotals());
        return;
    }

    // Deselect all cards
    document.querySelectorAll('.pay-card').forEach(function(c){ c.classList.remove('selected'); c.querySelector('.pay-card-radio').checked = false; });
    // Deselect all sub-cards
    document.querySelectorAll('.pay-sub-card').forEach(function(c){ c.classList.remove('selected'); });

    var card = document.getElementById('pc-' + value);
    if (!card) return;
    card.classList.add('selected');
    card.querySelector('.pay-card-radio').checked = true;

    var total = updateSummaryTotals();

    if (value === 'manual_group') {
        // Don't set selectedPayMethod yet — wait for sub-card selection
        // Clear any previous manual selection
        if (!selectedPayMethod || !selectedPayMethod.startsWith('manual_')) {
            selectedPayMethod = '';
        }
        _updateAdvanceFunUI(false, 0, total);
    } else {
        selectedPayMethod = value;
        var isCod = (value === 'cod');
        _updateAdvanceFunUI(isCod, advancePayable, total);

        // COD + advance + manual bKash
        var manualBox = document.getElementById('manualPayBox');
        var autoAdvCheck = settings.advance_method && settings.advance_method.toString().includes('auto');
        if (isCod && advancePayable > 0 && !autoAdvCheck) {
            document.getElementById('manualPayNumber').textContent     = settings.bkash_number || '';
            document.getElementById('manualPayMethodName').textContent = 'bKash (Advance — ৳' + advancePayable + ')';
            document.getElementById('manualPayAmt').textContent        = '৳' + advancePayable;
            manualBox.style.display = 'block';
        } else {
            manualBox.style.display = 'none';
        }
    }
}

// ── Accordion: select a sub-card inside Manual group ─────────
function selectSubCard(value) {
    // Deselect all sub-cards
    document.querySelectorAll('.pay-sub-card').forEach(function(c){ c.classList.remove('selected'); c.querySelector('.pay-sub-radio').checked = false; });

    var sub = document.getElementById('psc-' + value);
    if (!sub) return;
    sub.classList.add('selected');
    sub.querySelector('.pay-sub-radio').checked = true;

    selectedPayMethod = value; // e.g. 'manual_bkash', 'manual_nagad', 'manual_binance'

    _updateAdvanceFunUI(false, 0, updateSummaryTotals());
    document.getElementById('manualPayBox').style.display = 'none';
}

// ── Shared advance + fun-checkbox UI updater ─────────────────
function _updateAdvanceFunUI(isCod, advAmt, total) {
    var advSection = document.getElementById('advanceSection');
    var advPayLine = document.getElementById('advPayLine');
    var codPayLine = document.getElementById('codPayLine');

    if (isCod && advAmt > 0 && !isPickup) {
        advSection.style.display = 'block';
        advPayLine.style.display = 'flex';
        codPayLine.style.display = 'flex';
        document.getElementById('advanceInfoText').textContent    = 'Remaining ৳' + Math.round(total - advAmt) + ' will be paid on delivery.';
        document.getElementById('advanceAmountLabel').textContent = '৳' + advAmt;
        document.getElementById('smAdvPay').textContent           = '৳' + advAmt;
        document.getElementById('smCod').textContent              = '৳' + Math.round(total - advAmt);
    } else {
        advSection.style.display = 'none';
        advPayLine.style.display = 'none';
        codPayLine.style.display = 'none';
    }

    var funWrap = document.getElementById('funPromiseWrapper');
    if (funWrap) {
        if (settings.enable_fun_checkbox && isCod) {
            funWrap.style.display = 'flex';
        } else {
            funWrap.style.display = 'none';
            ['funPromiseCheck1','funPromiseCheck2'].forEach(function(id){
                var el = document.getElementById(id); if(el) el.checked = false;
            });
            ['funTooltip1','funTooltip2'].forEach(function(id){
                var el = document.getElementById(id); if(el){ el.style.opacity='0'; el.style.visibility='hidden'; }
            });
        }
    }
}

// ── copyDirect: pass text directly — no ID needed, most reliable ──────
function copyDirect(btn, text) {
    var fallback = function() {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        try { document.execCommand('copy'); } catch(e) {}
        document.body.removeChild(ta);
    };
    var done = function() {
        var orig = btn.textContent;
        var origColor = btn.style.color;
        btn.textContent = '✅ Copied!';
        btn.style.color = '#15803d';
        setTimeout(function() {
            btn.textContent = orig;
            btn.style.color = origColor;
        }, 1600);
    };
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done).catch(function() { fallback(); done(); });
    } else {
        fallback(); done();
    }
}

// ── copyText helper — delegates to copyElementText with button feedback
function copyText(elId) {
    var el = document.getElementById(elId);
    if (!el) return;
    var text = (el.textContent || el.innerText || el.value || '').trim();
    var btn = el.nextElementSibling;
    if (!btn || btn.tagName !== 'BUTTON') {
        btn = el.parentElement ? el.parentElement.querySelector('button') : null;
    }
    if (btn) {
        copyDirect(btn, text);
    } else {
        // no button found — just copy silently
        copyDirect({ textContent: '', style: {} }, text);
    }
}

// ── Legacy selectPayment — kept for any external callers ──────
function selectPayment(value) {
    // Delegate to new accordion system
    if (value === 'manual_bkash' || value === 'manual_nagad' || value === 'manual_binance') {
        selectPayCard('manual_group');
        selectSubCard(value);
    } else {
        selectPayCard(value);
    }
}

// ── Promo ─────────────────────────────────────────────────────
function removePromo() {
    document.getElementById('promoInput').value = '';
    document.getElementById('removePromoBtn').style.display = 'none';
    applyPromo('');
}

function applyPromo(providedCode) {
    var code = (providedCode || document.getElementById('promoInput').value || '').trim().toUpperCase();
    var msg = document.getElementById('promoMsg');
    
    if (!code) {
        if (activePromoObj) {
            activePromoObj = null;
            promoCode = '';
            promoDiscount = 0;
            promoPaymentRestrictions = [];
            buildPaymentOptions(); // restore all
            updateSummaryTotals();
            msg.innerHTML = 'ℹ️ Coupon removed.';
            msg.style.color = '#888';
        }
        return;
    }

    // Match by clean code (strip |v1| if old format)
    var promo = allPromos.find(function(p) {
        if (!p.is_active) return false;
        var clean = p.code ? p.code.split('|v1|')[0].toUpperCase() : '';
        return clean === code;
    });

    if (!promo) {
        msg.innerHTML = '⛔ Invalid or inactive promo code';
        msg.style.color = 'var(--danger)'; return;
    }
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
        msg.innerHTML = '⛔ This promo code has expired';
        msg.style.color = 'var(--danger)'; return;
    }

    var subtotal = cart.reduce(function(s,i){ return s + i.price*(i.quantity||1); }, 0);
    var minSpend  = promo.min_spend   || 0;
    var discType  = promo.disc_type   || 'flat';
    var discVal   = promo.disc_val    || promo.discount || 0;
    var maxCap    = promo.max_cap     || null;
    var delReward = promo.del_reward  || 'none';
    var delAmt    = promo.del_disc_amount || null;
    var delCap    = promo.del_disc_cap    || null;
    var appProds  = Array.isArray(promo.applicable_products)   ? promo.applicable_products   : [];
    var appDists  = Array.isArray(promo.applicable_districts)  ? promo.applicable_districts  : [];
    var appPays   = Array.isArray(promo.applicable_payments)   ? promo.applicable_payments   : [];

    // 1. Min spend check
    if (minSpend && subtotal < minSpend) {
        msg.innerHTML = '⛔ Minimum cart value of ৳' + minSpend + ' required';
        msg.style.color = 'var(--danger)'; return;
    }

    // 2. Product restriction
    if (appProds.length) {
        var matched = cart.some(function(i){ return appProds.indexOf(i.id) > -1; });
        if (!matched) { msg.innerHTML = '⛔ Coupon not valid for products in your cart'; msg.style.color='var(--danger)'; return; }
    }

    // 3. District restriction
    if (appDists.length) {
        var dist = document.getElementById('distSelect').value;
        var distOk = dist && appDists.some(function(d){ return d.toLowerCase() === dist.toLowerCase(); });
        if (!distOk) { msg.innerHTML = '⛔ Coupon only valid for: ' + appDists.join(', '); msg.style.color='var(--danger)'; return; }
    }

    activePromoObj = promo;
    promoCode = promo.code ? promo.code.split('|v1|')[0] : code;
    document.getElementById('promoInput').value = promoCode;
    document.getElementById('removePromoBtn').style.display = 'block';
    
    // Call updateSummaryTotals to calculate prodDisc and delDisc
    updateSummaryTotals();

    // 6. Payment restriction enforcement
    promoPaymentRestrictions = appPays;
    
    var succMsg = '✅ Coupon "' + promoCode + '" applied! ';
    if (promoDiscount > 0) succMsg += '৳' + promoDiscount.toFixed(0) + ' discount. ';
    if (promo.del_reward === 'free') succMsg += '🚚 Free Delivery! ';
    else if (promo.del_reward === 'amount' && promo.del_disc_amount) succMsg += '🚚 ৳' + promo.del_disc_amount + ' delivery discount! ';
    else if (promo.del_reward === 'percent' && promo.del_disc_amount) succMsg += '🚚 ' + promo.del_disc_amount + '% delivery discount! ';
    
    // Always rebuild payment options when coupon has delivery discount OR payment restriction
    // This ensures advance amount reflects delivery discount correctly
    var hasDeliveryDiscount = (promo.del_reward && promo.del_reward !== 'none');
    if (appPays.length || hasDeliveryDiscount) {
        buildPaymentOptions(); // recalculates advance with effective delivery
        if (selectedPayMethod) {
            // If payment method was restricted and now invalid, clear it
            if (appPays.length) {
                var ok = appPays.some(function(pm){ return selectedPayMethod.toLowerCase().includes(pm.toLowerCase()); });
                if (!ok) selectPayment('');
            } else {
                // Re-select same method to refresh amounts (e.g. bKash total after discount)
                selectPayment(selectedPayMethod);
            }
        }
        if (appPays.length) {
            msg.innerHTML = succMsg + '<br><small style="color:#FF9500;">⚠️ Only specific payment methods available.</small>';
        } else {
            msg.innerHTML = succMsg;
        }
    } else {
        msg.innerHTML = succMsg;
    }
    msg.style.color = 'var(--success)';
}

// ── View All Coupons — Bottom Sheet ───────────────────────────
function openAllCouponsModal() {
    // Ensure bottom sheet exists
    if (!document.getElementById('allCouponsSheet')) {
        var overlay = document.createElement('div');
        overlay.id = 'allCouponsSheet';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9998;display:none;align-items:flex-end;';
        overlay.onclick = function(e){ if(e.target===this) closeAllCouponsModal(); };
        overlay.innerHTML =
            '<div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-height:78vh;overflow-y:auto;padding:0 0 20px;animation:slideUpSheet 0.35s cubic-bezier(0.22,0.61,0.36,1);">' +
                '<div style="width:40px;height:4px;background:#ddd;border-radius:4px;margin:12px auto 4px;"></div>' +
                '<div style="padding:14px 20px 10px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f0f0f0;">' +
                    '<div style="font-size:16px;font-weight:800;color:var(--text-dark);">🎟️ Available Coupons</div>' +
                    '<button onclick="closeAllCouponsModal()" style="border:none;background:rgba(0,0,0,0.06);border-radius:50%;width:30px;height:30px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>' +
                '</div>' +
                '<div id="allCouponsList" style="padding:14px 16px;display:flex;flex-direction:column;gap:10px;"></div>' +
            '</div>';
        var style = document.createElement('style');
        style.textContent = '@keyframes slideUpSheet{from{transform:translateY(100%)}to{transform:translateY(0)}}';
        document.head.appendChild(style);
        document.body.appendChild(overlay);
    }

    var subtotal = cart.reduce(function(s,i){ return s+i.price*(i.quantity||1); },0);
    var listDiv  = document.getElementById('allCouponsList');
    listDiv.innerHTML = '';

    var publicCoupons = allPromos.filter(function(p) {
        return p.is_active && (p.type === 'public') && !p.is_repeated_config &&
               !(p.code && p.code.startsWith('REPEATED_CUSTOMER_CONFIG'));
    });

    if (!publicCoupons.length) {
        listDiv.innerHTML = '<p style="text-align:center;color:#888;font-size:13px;padding:20px;">No public coupons available right now.</p>';
    } else {
        var eligible = [], closeToEl = [], others = [];
        publicCoupons.forEach(function(p) {
            var reqSpend = p.min_spend || 0;
            var discType = p.disc_type || 'flat';
            var dVal = discType === 'percent' ? (p.disc_val || 0)+'%' : '৳'+(p.disc_val || 0);
            var obj = { promo:p, reqSpend:reqSpend, dVal:dVal };
            if (reqSpend <= subtotal) eligible.push(obj);
            else if (reqSpend - subtotal <= 300) closeToEl.push(obj);
            else others.push(obj);
        });

        eligible.concat(closeToEl).concat(others).forEach(function(item) {
            var p = item.promo;
            var cleanCode = p.code ? p.code.split('|v1|')[0] : '';
            var diff = item.reqSpend - subtotal;
            var isEligible = diff <= 0;

            var extras = '';
            if (p.del_reward === 'free') extras += '<span style="font-size:11px;color:#22C55E;font-weight:700;">🚚 + Free Delivery</span> ';
            if (p.del_reward === 'amount' && p.del_disc_amount) extras += '<span style="font-size:11px;color:#22C55E;font-weight:700;">🚚 -৳'+p.del_disc_amount+' Delivery</span> ';
            if (p.del_reward === 'percent' && p.del_disc_amount) extras += '<span style="font-size:11px;color:#22C55E;font-weight:700;">🚚 -'+p.del_disc_amount+'% Delivery</span> ';
            if (!isEligible) extras += '<div style="font-size:11px;color:#FF9500;font-weight:700;margin-top:3px;">Add ৳'+diff.toFixed(0)+' more to unlock</div>';

            var card = document.createElement('div');
            card.style.cssText = 'border:1.5px solid '+(isEligible?'#22C55E':'var(--border)')+';border-radius:12px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:10px;background:'+(isEligible?'rgba(34,197,94,0.03)':'#fafafa')+';';
            card.innerHTML =
                '<div style="flex:1;">' +
                    '<code style="font-size:13px;font-weight:800;color:var(--primary);background:rgba(139,26,26,0.07);padding:3px 8px;border-radius:6px;display:inline-block;margin-bottom:4px;">' + cleanCode + '</code>' +
                    '<div style="font-size:13px;font-weight:700;color:var(--text-dark);">' + item.dVal + ' Discount' + (p.max_cap?' (Max ৳'+p.max_cap+')':'') + '</div>' +
                    '<div style="font-size:12px;color:#777;margin-top:1px;">' + (item.reqSpend?'Min ৳'+item.reqSpend:'No minimum') + '</div>' +
                    (extras ? '<div style="margin-top:4px;">'+extras+'</div>' : '') +
                '</div>' +
                (isEligible
                    ? '<button class="btn btn-primary" style="padding:8px 14px;font-size:12px;border-radius:10px;white-space:nowrap;" onclick="applyPublicPromo(\''+cleanCode+'\')">Apply</button>'
                    : '<button class="btn btn-ghost" disabled style="opacity:0.4;font-size:12px;white-space:nowrap;">Locked</button>');
            listDiv.appendChild(card);
        });
    }

    var sheet = document.getElementById('allCouponsSheet');
    sheet.style.display = 'flex';
}

function closeAllCouponsModal() {
    var s = document.getElementById('allCouponsSheet');
    if (s) s.style.display = 'none';
}

function applyPublicPromo(cleanCode) {
    applyPromo(cleanCode);
    closeAllCouponsModal();
}




// ── Place Order ───────────────────────────────────────────────
function placeOrder() {
    if (!selectedPayMethod) { alert('Please select a payment method'); return; }

    var name  = document.getElementById('custName').value.trim();
    var phone = document.getElementById('custPhone').value.trim();
    var email = document.getElementById('custEmail').value.trim();
    var div   = isPickup ? 'Pickup' : document.getElementById('divSelect').value;
    var dist  = isPickup ? 'Pickup' : document.getElementById('distSelect').value;
    var upa   = isPickup ? 'Pickup' : document.getElementById('upaSelect').value;
    var addr  = isPickup ? (settings.store_address || 'Store Pickup') : document.getElementById('custAddress').value.trim();

    var subtotal = cart.reduce(function(s,i){return s+i.price*(i.quantity||1);},0);
    // Re-calculate effective delivery (after coupon discount)
    var delDiscPO = 0;
    if (activePromoObj && activePromoObj.del_reward === "free") delDiscPO = deliveryCharge;
    else if (activePromoObj && activePromoObj.del_reward === "amount" && activePromoObj.del_disc_amount) delDiscPO = Math.min(parseFloat(activePromoObj.del_disc_amount), deliveryCharge);
    else if (activePromoObj && activePromoObj.del_reward === "percent" && activePromoObj.del_disc_amount) { delDiscPO = (parseFloat(activePromoObj.del_disc_amount)/100)*deliveryCharge; if (activePromoObj.del_disc_cap && delDiscPO > activePromoObj.del_disc_cap) delDiscPO = activePromoObj.del_disc_cap; }
    var effectiveDeliveryPO = Math.max(0, deliveryCharge - delDiscPO);
    var total    = subtotal + addonTotal + effectiveDeliveryPO - promoDiscount;

    // ── Manual payment inputs: read from active sub-card ────────────
    var senderNum = '', trxId = '';
    var isManualPay = (selectedPayMethod === 'manual_bkash' || selectedPayMethod === 'manual_nagad' || selectedPayMethod === 'manual_binance');
    var autoAdvCheck = settings.advance_method && settings.advance_method.toString().includes('auto');
    var isCodManualAdvance = (selectedPayMethod === 'cod' && advancePayable > 0 && !autoAdvCheck);

    if (isManualPay) {
        // Find the visible (selected) sub-card's inputs
        var activeSub = document.querySelector('.pay-sub-card.selected');
        if (activeSub) {
            var sEl = activeSub.querySelector('[data-role="senderInput"]');
            var tEl = activeSub.querySelector('[data-role="trxInput"]');
            if (sEl) senderNum = sEl.value.trim();
            if (tEl) trxId = tEl.value.trim();
        }
        // Binance manual: no sender number needed
        if (selectedPayMethod === 'manual_binance') {
            if (!trxId) { alert('Please enter the Binance Transaction ID'); return; }
        } else {
            if (!senderNum || !trxId) { alert('Please enter Sender Number and Transaction ID'); return; }
        }
    } else if (isCodManualAdvance) {
        senderNum = document.getElementById('senderNumber') ? document.getElementById('senderNumber').value.trim() : '';
        trxId     = document.getElementById('trxId') ? document.getElementById('trxId').value.trim() : '';
        if (!senderNum || !trxId) { alert('Please enter Sender Number and Transaction ID for Advance Payment'); return; }
    }

    var orderId = genOrderId();
    var payMethod = selectedPayMethod === 'cod' ? (advancePayable > 0 ? 'Hybrid COD' : 'COD') :
                    selectedPayMethod === 'manual_bkash' ? 'bKash' :
                    selectedPayMethod === 'manual_nagad' ? 'Nagad' : 'Online';

    var orderData = {
        id:             orderId,
        customer_name:  name,
        customer_phone: phone,
        customer_email: email,
        division:       div,
        district:       dist,
        upazila:        upa,
        address:        addr,
        items:          cart,
        addons:         [].concat(
                            selectedAddons.map(function(a){return a.name;}),
                            selectedAddOnce.map(function(a){return a.name + ' (Add-Once)';})
                        ).join(', ') || 'None',
        subtotal:       subtotal,
        addon_total:    addonTotal,
        delivery_charge:deliveryCharge,
        promo_code:     promoCode || null,
        promo_discount: promoDiscount,
        grand_total:    total,
        advance_payable:(selectedPayMethod === 'cod') ? advancePayable : 0,
        payment_method: payMethod,
        payment_status: senderNum ? 'Advance Paid' : 'Unpaid',
        payment_trx_id: trxId || null,
        payment_sender: senderNum || null,
        status:         'Pending',
        order_type:     isPickup ? 'pickup' : 'delivery'
    };

    var autoAdv = settings.advance_method && settings.advance_method.toString().includes('auto');
    if (selectedPayMethod === 'auto_gateway' || (selectedPayMethod === 'cod' && advancePayable > 0 && autoAdv)) {
        var gatewayAmount = (selectedPayMethod === 'cod') ? advancePayable : total;
        initiateGatewayPayment(orderId, gatewayAmount, orderData);
        return;
    }

    var btn = document.getElementById('placeOrderBtn');
    btn.disabled = true;
    btn.textContent = 'Placing Order...';

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
    }
    insertPromise.then(function(r) {
        if (r.error) { btn.disabled = false; btn.innerHTML = '<i data-lucide="rocket" class="lucide-icon icon-bounce"></i> Place Order'; if (typeof lucide !== 'undefined') lucide.createIcons(); alert('Error: ' + r.error.message); return; }
        
        try {
            var localOrders = JSON.parse(localStorage.getItem('my_orders') || '[]');
            orderData.created_at = new Date().toISOString();
            localOrders.unshift(orderData);
            if (localOrders.length > 10) localOrders = localOrders.slice(0, 10);
            localStorage.setItem('my_orders', JSON.stringify(localOrders));
        } catch(e){}

        sendOrderNotification(orderData);
        // Direct Order হলে শুধু direct key clear করো — main cart অক্ষত থাকবে
        if (isDirectOrder) {
            localStorage.removeItem(DIRECT_KEY);
        } else {
            localStorage.removeItem(CONFIG.CART_KEY);
        }
        window.location.href = 'success.html?id=' + orderId;
    });
}

// ── Auto Gateway Payment ──────────────────────────────────────
function initiateGatewayPayment(orderId, total, orderData) {
    var gatewayVersion = (settings.gateway_version || 'v1');
    var proxyUrl = (gatewayVersion === 'v2') 
        ? 'https://payment.freelancingbyrifat.top/proxyv2.php'
        : 'https://mypay.freelancingbyrifat.top/api_proxy.php';
    var apiKey = (gatewayVersion === 'v2') 
        ? (settings.gateway_api_key_v2 || CONFIG.GATEWAY_API_KEY || '')
        : (settings.gateway_api_key || CONFIG.GATEWAY_API_KEY || '');
    var name     = document.getElementById('custName').value.trim();
    var phone    = document.getElementById('custPhone').value.trim();
    var email    = document.getElementById('custEmail').value.trim() || (phone + '@linko.com');

    var baseUrl  = window.location.href.split('?')[0];
    var sUrl = baseUrl + '?status=completed&order_id=' + orderId;
    var cUrl = baseUrl + '?status=cancel&order_id=' + orderId;

    // ── DB-তে আগে order save করো ──────────────────────────────
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
    }

    insertPromise.then(function(r) {
        if (r.error) { alert('Order save failed: ' + r.error.message); return; }

        // ── 🔄 Gateway Execution (v1 and v2 now use same JSON logic) ────────
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
    });
}


function verifyGatewayPayment(orderId, trxId) {
    var gatewayVersion = (settings.gateway_version || 'v1');
    var proxyUrl = (gatewayVersion === 'v2') 
        ? 'https://payment.freelancingbyrifat.top/proxyv2.php'
        : 'https://mypay.freelancingbyrifat.top/api_proxy.php';
    
    var rawKey   = settings.gateway_api_key || CONFIG.GATEWAY_API_KEY;
    var apiKey   = (rawKey || '').trim();

    document.getElementById('pageLoader').style.display = 'flex';
    document.getElementById('pageLoader').innerHTML = '<div class="spinner"></div><div style="margin-top:15px;color:var(--primary);font-weight:700;">Verifying your payment securely...</div><div style="font-size:12px;color:#888;margin-top:10px;">Please wait, do not close this window.</div>';

    var selectPromise;
    if (CONFIG.DB_PROVIDER === 'supabase') {
        selectPromise = supabaseClient.from('orders').select('*').eq('id', orderId).single();
    } else if (CONFIG.DB_PROVIDER === 'appwrite') {
        selectPromise = appwriteDatabases.getDocument(APP_DB, 'orders', orderId)
            .then(function(doc) {
                doc.id = doc.$id; doc.created_at = doc.$createdAt; if (typeof doc.gallery_images === 'string') { try { doc.gallery_images = JSON.parse(doc.gallery_images); } catch(e) { doc.gallery_images = []; } }
                if (typeof doc.items  === 'string') { try { doc.items  = JSON.parse(doc.items);  } catch(e) { doc.items = []; } }
                if (typeof doc.addons === 'string') { try { doc.addons = JSON.parse(doc.addons); } catch(e) { doc.addons = []; } }
                return { data: doc, error: null };
            }).catch(function(err) { return { data: null, error: err }; });
    }
    selectPromise.then(function(oRes) {
        if (oRes.error || !oRes.data) {
            document.getElementById('pageLoader').style.display = 'none';
            alert('Order not found!');
            return;
        }
        
        var oData = oRes.data;
        var cleanUrl = window.location.protocol + '//' + window.location.host + window.location.pathname;

        if (oData.payment_status === 'Paid' || oData.payment_status === 'Advance Paid') {
            window.history.replaceState({}, document.title, cleanUrl);
            document.getElementById('pageLoader').style.display = 'none';
            window.location.href = 'success.html?id=' + orderId;
            return;
        }

        if (trxId || orderId) {
            var dupCheck;
            if (trxId && CONFIG.DB_PROVIDER === 'supabase') {
                dupCheck = supabaseClient.from('orders').select('id,payment_trx_id').eq('payment_trx_id', trxId).neq('id', orderId).single();
            } else if (trxId && CONFIG.DB_PROVIDER === 'appwrite') {
                dupCheck = appwriteDatabases.listDocuments(APP_DB, 'orders', [
                        AppwriteQuery.equal('payment_trx_id', trxId),
                        AppwriteQuery.limit(1)
                    ]).then(function(res) {
                        var docs = res.documents.filter(function(d) { return d.$id !== orderId; });
                        return docs.length ? { data: { id: docs[0].$id }, error: null } : { data: null, error: null };
                    }).catch(function(err) { return { data: null, error: err }; });
            } else {
                dupCheck = Promise.resolve({ data: null });
            }
            dupCheck.then(function(dupRes) {
                if (!dupRes.error && dupRes.data) {
                    document.getElementById('pageLoader').style.display = 'none';
                    alert('Warning: Transaction ID already exists in another order.');
                    return;
                }

                fetch(proxyUrl + '?action=verify', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json', 'API-KEY': apiKey },
                    body: JSON.stringify({ transaction_id: trxId, order_id: orderId, api_key: apiKey })
                }).then(function(r) { 
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.json(); 
                }).then(function(res) {
                    var vStatus = (res.status || '').toUpperCase();
                    var isSuccess = vStatus === 'COMPLETED' || vStatus === 'SUCCESS' || vStatus === 'VALID';

                    if (isSuccess) {
                        var newPayStatus = (oData.payment_method === 'Hybrid COD') ? 'Advance Paid' : 'Paid';

                        var updatePromise;
                        var upData = {
                            payment_status:  newPayStatus,
                            payment_trx_id:  trxId || 'AUTO',
                            status:          'Confirmed'
                        };
                        if (CONFIG.DB_PROVIDER === 'supabase') {
                            updatePromise = supabaseClient.from('orders').update(upData).eq('id', orderId);
                        } else if (CONFIG.DB_PROVIDER === 'appwrite') {
                            updatePromise = appwriteDatabases.updateDocument(APP_DB, 'orders', orderId, upData)
                                .then(function() { return { error: null }; })
                                .catch(function(err) { return { error: err }; });
                        } else {
                            updatePromise = Promise.resolve({ data: null });
                        }
                        updatePromise.then(function(upRes) {
                            sendOrderNotification(oData);
                            if (isDirectOrder) { localStorage.removeItem(DIRECT_KEY); } else { localStorage.removeItem(CONFIG.CART_KEY); }
                            window.history.replaceState({}, document.title, window.location.pathname);
                            window.location.href = 'success.html?id=' + orderId;
                        });
                    } else {
                        document.getElementById('pageLoader').style.display = 'none';
                        alert('Payment Verification Failed!\nStatus: ' + (res.status || 'Unknown') + '\nMessage: ' + (res.message || 'Invalid Transaction'));
                    }
                }).catch(function(err) {
                    document.getElementById('pageLoader').style.display = 'none';
                    alert('Verification Request Failed!\nError: ' + err.message);
                });
            });
        } else {
            document.getElementById('pageLoader').style.display = 'none';
            alert('No Transaction ID found for verification.');
        }
    }).catch(function(err) {
        document.getElementById('pageLoader').style.display = 'none';
        alert('Error loading order: ' + err.message);
    });
}

// ── Telegram Notifications ────────────────────────────────────
function sendOrderNotification(order) {
    var msg = '🛍️ *NEW ORDER* — #' + order.id + '\n\n' +
              '👤 ' + (order.customer_name || '—') + ' | 📞 ' + (order.customer_phone || '—') + '\n' +
              '📍 ' + (order.district || '—') + ', ' + (order.division || '—') + '\n' +
              '📝 Type: ' + (order.order_type === 'pickup' ? '🚶 Pickup' : '🚚 Delivery') + '\n' +
              '💳 Method: ' + (order.payment_method || '—') + '\n' +
              '💰 Total: ৳' + (order.grand_total || 0) + '\n' +
              (order.payment_trx_id ? '🔑 TrxID: `' + order.payment_trx_id + '`\n' : '') +
              '📦 Items: ' + (Array.isArray(order.items) ? order.items.map(function(i){return i.productName;}).join(', ') : '—');

    if (order.order_type === 'pickup' && settings.pickup_bot_token && settings.pickup_chat_id) {
        sendTelegram(settings.pickup_bot_token, settings.pickup_chat_id, msg);
    } else if (settings.telegram_main_bot && settings.telegram_main_chats) {
        var chats = settings.telegram_main_chats;
        if (typeof chats === 'string') chats = JSON.parse(chats || '[]');
        chats.forEach(function(cid) {
            sendTelegram(settings.telegram_main_bot, cid, msg);
        });
    }
}

function sendTelegram(token, chatId, text) {
    if (!token || !chatId) return;
    fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'Markdown' })
    }).catch(function(e){ console.error('Telegram error:', e); });
}

function sendDraftNotification() {
    if (!settings.telegram_draft_bot || !settings.telegram_draft_chat) return;
    var name   = document.getElementById('custName')  ? document.getElementById('custName').value.trim()  : '';
    var phone  = document.getElementById('custPhone') ? document.getElementById('custPhone').value.trim() : '';
    var subtotal = cart.reduce(function(s,i){return s+i.price*(i.quantity||1);},0);

    var msg = '⚠️ *DRAFT ORDER* — Tab switched!\n\n' +
              (name  ? '👤 ' + name  + '\n' : '') +
              (phone ? '📞 ' + phone + '\n' : '') +
              '🛒 Items: ' + cart.length + '\n' +
              '💰 Cart Value: ৳' + subtotal;

    fetch('https://api.telegram.org/bot' + settings.telegram_draft_bot + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: settings.telegram_draft_chat, text: msg, parse_mode: 'Markdown' })
    }).catch(function(){});
}

// ── Helpers ───────────────────────────────────────────────────
function genOrderId() {
    var mustHave = ['A', 'F', 'R', 'S', 'H', 'N'];
    var numbers = '0123456789';
    var allChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    
    var remainingList = [].concat(mustHave);
    
    // Add one random digit
    var randNumIdx = Math.floor(Math.random() * numbers.length);
    remainingList.push(numbers.charAt(randNumIdx));
    
    // Add 6 more random characters (only uppercase and numbers)
    for (var i = 0; i < 6; i++) {
        var randIdx = Math.floor(Math.random() * allChars.length);
        remainingList.push(allChars.charAt(randIdx));
    }
    
    // Shuffle the 13 characters randomly
    for (var i = remainingList.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = remainingList[i];
        remainingList[i] = remainingList[j];
        remainingList[j] = temp;
    }
    
    var finalId = 'RNF' + remainingList.join('');
    return finalId;
}

function getCart() { try { return JSON.parse(localStorage.getItem(CONFIG.CART_KEY)||'[]'); } catch(e){ return []; } }

// ── International Transfer System ─────────────────────────────
var currentTransferTab = 'national';
var intlPayMode       = ''; // 'binance_pay' | 'crypto'
var intlCoinSymbol    = '';
var intlNetworkName   = '';
var intlNetworkAddr   = '';
var intlVerified      = false; // true after successful verification

function switchTransferTab(tab) {
    currentTransferTab = tab;
    selectedPayMethod  = '';
    intlVerified       = false;

    var isIntl = (tab === 'international');
    document.getElementById('tabNational').classList.toggle('active', !isIntl);
    document.getElementById('tabInternational').classList.toggle('active', isIntl);
    document.getElementById('nationalPayPanel').style.display   = isIntl ? 'none' : 'block';
    document.getElementById('internationalPayPanel').style.display = isIntl ? 'block' : 'none';
    document.getElementById('nationalPlaceOrderRow').style.display = isIntl ? 'none' : 'flex';

    // Hide manual pay box when switching to national after crypto
    document.getElementById('manualPayBox').style.display = 'none';

    if (isIntl) { buildInternationalOptions(); }
}

function buildInternationalOptions() {
    var total   = updateSummaryTotals();
    var usdRate = parseFloat(settings.usd_to_bdt_rate || 110);
    var usdtAmt = (total / usdRate).toFixed(2);

    document.getElementById('intlUsdtAmt').textContent  = usdtAmt + ' USDT';
    document.getElementById('intlBdtAmt').textContent   = '= ৳' + Math.round(total);
    document.getElementById('intlRateLabel').textContent = 'Rate: 1 USD = ৳' + usdRate;

    var html = '';
    var hasProxy = !!(settings.binance_proxy_url || CONFIG.BINANCE_PROXY_URL);

    // Binance Pay option
    if (settings.binance_pay_uid) {
        var badge = hasProxy ? '' : '<span class="backup-badge">Manual Review</span>';
        html += '<div class="crypto-opt" id="copt_binance_pay" onclick="selectIntlMethod(\'binance_pay\')">' +
            '<span style="font-size:26px;">🟡</span>' +
            '<div style="flex:1;">' +
                '<div style="font-weight:800;font-size:14px;">Binance Pay ' + badge + '</div>' +
                '<div style="font-size:12px;color:#888;">Send via Binance Pay to UID: <strong>' + settings.binance_pay_uid + '</strong></div>' +
            '</div>' +
            '<input type="radio" name="intlMethod" value="binance_pay" style="width:18px;height:18px;accent-color:#F0B90B;">' +
            '</div>';
    }

    // Crypto coins
    var coins = settings.crypto_coins || [];
    var hasCoins = coins.some(function(c) { return c.symbol && c.networks && c.networks.length; });
    
    if (hasCoins) {
        html += '<div class="crypto-opt" id="copt_crypto_main" onclick="selectIntlMethod(\'crypto_main\')">' +
            '<span style="font-size:26px;">🪙</span>' +
            '<div style="flex:1;">' +
                '<div style="font-weight:800;font-size:14px;">Crypto Payment</div>' +
                '<div style="font-size:12px;color:#888;">Pay via USDT, BTC, ETH, etc.</div>' +
            '</div>' +
            '<input type="radio" name="intlMethod" value="crypto_main" style="width:18px;height:18px;accent-color:#627EEA;">' +
            '</div>';
    }

    if (!html) {
        html = '<div style="text-align:center;padding:24px;color:#999;font-size:13px;border:1.5px dashed var(--border);border-radius:12px;">' +
               '⚠️ No international payment method configured.<br>Admin → Settings → Crypto & Binance Pay থেকে যোগ করো।</div>';
    }

    document.getElementById('cryptoPaymentOptions').innerHTML = html;
    document.getElementById('cryptoCoinSelectBox').style.display = 'none';
    document.getElementById('cryptoNetworkDetails').style.display = 'none';
    document.getElementById('cryptoWalletBox').style.display = 'none';
    document.getElementById('cryptoTxidWrap').style.display = 'none';
    document.getElementById('verifyCryptoBtn').style.display = 'none';
    setVerifyStatus('', '');
    intlVerified = false;
}

function selectIntlMethod(method) {
    intlPayMode     = method;
    intlCoinSymbol  = '';
    intlNetworkName = '';
    intlNetworkAddr = '';

    // Highlight
    document.querySelectorAll('#cryptoPaymentOptions .crypto-opt').forEach(function(el) {
        el.classList.remove('selected', 'binance-selected');
    });
    var el = document.getElementById('copt_' + method);
    if (el) {
        el.classList.add('binance-selected');
        var radio = el.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
    }

    if (method === 'binance_pay') {
        selectedPayMethod = 'crypto_binance_pay';
        document.getElementById('cryptoCoinSelectBox').style.display = 'none';
        document.getElementById('cryptoNetworkDetails').style.display = 'none';

        var uid   = settings.binance_pay_uid;
        var total = updateSummaryTotals();
        var rate  = parseFloat(settings.usd_to_bdt_rate || 110);
        var usdt  = (total / rate).toFixed(2);

        document.getElementById('cryptoWalletBox').style.display = 'block';
        document.getElementById('cryptoWalletBox').innerHTML =
            '<div class="wallet-addr-box" style="border-color:#F0B90B;background:rgba(240,185,11,0.05);">' +
                '<div style="font-size:12px;font-weight:700;color:#B8860B;margin-bottom:6px;">🟡 Binance Pay Instructions</div>' +
                '<div style="font-size:13px;color:#555;margin-bottom:6px;display:flex;align-items:center;gap:6px;">Send exactly <strong style="color:#1a1a2e;">' + usdt + ' USDT</strong> <button class="copy-btn" style="background:none;border:none;color:#888;padding:2px;min-width:auto;" onclick="copyText(\'' + usdt + '\',this)" title="Copy Amount"><i data-lucide="copy" class="lucide-icon" style="width:14px;height:14px;"></i></button> to:</div>' +
                '<div class="wallet-addr-text" style="border-color:rgba(240,185,11,0.4);">' +
                    '<span id="binanceUidDisplay" style="font-size:18px;letter-spacing:2px;font-weight:900;">UID: ' + uid + '</span>' +
                    '<button class="copy-btn" style="background:#F0B90B;color:#1a1a2e;" onclick="copyText(\'' + uid + '\',this)">📋 Copy</button>' +
                '</div>' +
                '<div style="font-size:11px;color:#888;">After sending, open Binance app → Pay → History → copy the <strong>Transaction ID</strong>.</div>' +
            '</div>';

        document.getElementById('cryptoTxidWrap').style.display = 'block';
        document.getElementById('verifyCryptoBtn').style.display = 'flex';
        setVerifyStatus('', '');
        intlVerified = false;
        if(typeof lucide !== 'undefined') lucide.createIcons();
    } else if (method === 'crypto_main') {
        selectedPayMethod = 'crypto_main';
        document.getElementById('cryptoNetworkDetails').style.display = 'none';
        document.getElementById('cryptoWalletBox').style.display = 'none';
        document.getElementById('cryptoTxidWrap').style.display = 'none';
        document.getElementById('verifyCryptoBtn').style.display = 'none';
        setVerifyStatus('', '');

        var coins = settings.crypto_coins || [];
        var coinHtml = '<div style="margin-top:10px;"><div style="font-size:12px;font-weight:700;color:#627EEA;margin-bottom:8px;text-transform:uppercase;">🪙 Select Crypto</div>';
        coins.forEach(function(coin) {
            if (!coin.symbol || !coin.networks || !coin.networks.length) return;
            var nets = coin.networks.map(function(n) { return n.name; }).join(' / ');
            coinHtml += '<div class="crypto-opt" id="copt_' + coin.symbol + '" onclick="selectIntlCoin(\'' + coin.symbol + '\')" style="margin-bottom:6px;border-color:rgba(98,126,234,0.3);">' +
                '<span style="font-size:20px;">💠</span>' +
                '<div style="flex:1;">' +
                    '<div style="font-weight:800;font-size:13px;">' + coin.symbol +
                        '<span style="font-size:11px;font-weight:400;color:#888;margin-left:6px;">' + (coin.name || '') + '</span></div>' +
                    '<div style="font-size:11px;color:#888;">Networks: ' + nets + '</div>' +
                '</div>' +
                '<input type="radio" name="coinMethod" value="' + coin.symbol + '" style="width:16px;height:16px;accent-color:#627EEA;">' +
                '</div>';
        });
        coinHtml += '</div>';

        document.getElementById('cryptoCoinSelectBox').innerHTML = coinHtml;
        document.getElementById('cryptoCoinSelectBox').style.display = 'block';
    }
}

function selectIntlCoin(symbol) {
    intlPayMode    = 'crypto';
    intlCoinSymbol = symbol;
    intlNetworkName = '';
    intlNetworkAddr = '';
    selectedPayMethod = 'crypto_' + symbol;

    // Highlight coin
    document.querySelectorAll('#cryptoCoinSelectBox .crypto-opt').forEach(function(el) {
        el.classList.remove('selected', 'binance-selected');
    });
    var el = document.getElementById('copt_' + symbol);
    if (el) {
        el.classList.add('selected');
        var radio = el.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
    }

    // Build network list
    var coins = settings.crypto_coins || [];
    var coin  = coins.find(function(c) { return c.symbol === symbol; });
    if (!coin) return;

    var netsHtml = '<div style="margin-top:4px;">' +
        '<div style="font-size:12px;font-weight:700;color:#627EEA;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">⛓️ Select Network</div>';

    coin.networks.forEach(function(net) {
        var safeNet = (net.name || '').replace(/'/g, "\\'");
        var safeAddr = (net.address || '').replace(/'/g, "\\'");
        var safeQr   = (net.qr_url || '').replace(/'/g, "\\'");
        netsHtml += '<div class="net-opt" id="netopt_' + safeNet + '" onclick="selectIntlNetwork(\'' + safeNet + '\',\'' + safeAddr + '\',\'' + safeQr + '\')">' +
            '<span style="font-size:18px;">⛓️</span>' +
            '<div style="flex:1;">' +
                '<div style="font-weight:700;font-size:13px;">' + (net.name || '—') + '</div>' +
                '<div style="font-size:11px;color:#888;">' + (net.address ? net.address.substring(0,16) + '...' : 'No address') + '</div>' +
            '</div>' +
            '<input type="radio" name="netMethod" style="width:16px;height:16px;accent-color:#627EEA;">' +
            '</div>';
    });
    netsHtml += '</div>';

    document.getElementById('cryptoNetworkDetails').style.display = 'block';
    document.getElementById('cryptoNetworkDetails').innerHTML =
        '<div class="intl-step"><div class="intl-step-num">2</div><span class="intl-step-label">Select Network</span></div>' + netsHtml;
    document.getElementById('cryptoWalletBox').style.display = 'none';
    document.getElementById('cryptoTxidWrap').style.display = 'none';
    document.getElementById('verifyCryptoBtn').style.display = 'none';
    setVerifyStatus('', '');
    intlVerified = false;
}

window.expectedCryptoAmt = 0;

function fetchLiveCryptoAmount(symbol, usdAmount, callback) {
    if (symbol === 'USDT') {
        callback(usdAmount);
        return;
    }
    fetch('https://api.binance.com/api/v3/ticker/price?symbol=' + symbol + 'USDT')
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data && data.price) {
                var price = parseFloat(data.price);
                var coinAmt = usdAmount / price;
                // Add a small 0.5% buffer for market volatility to ensure they send enough?
                // The user's Edge Function has 2% tolerance, so we can just show 6 decimals.
                callback(parseFloat(coinAmt.toFixed(6)));
            } else {
                callback(usdAmount); // fallback
            }
        })
        .catch(function(err) {
            console.error('Failed to fetch price:', err);
            callback(usdAmount); // fallback
        });
}

function selectIntlNetwork(netName, addr, qrUrl) {
    intlNetworkName = netName;
    intlNetworkAddr = addr;

    document.querySelectorAll('#cryptoNetworkDetails .net-opt').forEach(function(el) {
        el.classList.toggle('selected', el.id === 'netopt_' + netName);
        var r = el.querySelector('input[type="radio"]');
        if (r) r.checked = (el.id === 'netopt_' + netName);
    });

    var total = updateSummaryTotals();
    var rate  = parseFloat(settings.usd_to_bdt_rate || 110);
    var usdAmount  = parseFloat((total / rate).toFixed(2));
    var sym   = intlCoinSymbol;

    document.getElementById('cryptoWalletBox').style.display = 'block';
    document.getElementById('cryptoWalletBox').innerHTML = '<div style="padding:16px;text-align:center;color:#666;"><div class="spinner" style="width:20px;height:20px;margin:0 auto 10px;"></div>Calculating live ' + sym + ' price...</div>';
    
    document.getElementById('cryptoTxidWrap').style.display = 'none';
    document.getElementById('verifyCryptoBtn').style.display = 'none';

    fetchLiveCryptoAmount(sym, usdAmount, function(cryptoAmt) {
        window.expectedCryptoAmt = cryptoAmt;
        
        var addrBoxHtml = 
            '<div style="background:rgba(98,126,234,0.06);border:1.5px dashed rgba(98,126,234,0.3);border-radius:12px;padding:16px;">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">' +
                    '<div style="font-size:12px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;">💳 Send to ' + sym + ' (' + netName + ')</div>' +
                    (qrUrl ? '<button type="button" onclick="document.getElementById(\'netQrWrap\').style.display=document.getElementById(\'netQrWrap\').style.display===\'none\'?\'block\':\'none\'" style="background:none;border:none;color:#627EEA;font-size:12px;font-weight:700;cursor:pointer;"><i data-lucide="qr-code" class="lucide-icon"></i> Show QR</button>' : '') +
                '</div>' +
                (qrUrl ? '<div id="netQrWrap" style="display:none;text-align:center;margin-bottom:16px;"><img src="' + qrUrl + '" style="max-width:150px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.1);"></div>' : '') +
                '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;">Amount to send:</div>' +
                '<div style="font-size:24px;font-weight:900;color:var(--text-dark);margin-bottom:12px;display:flex;align-items:center;gap:8px;">' +
                    '<span id="finalSendAmt">' + window.expectedCryptoAmt + '</span> <span style="font-size:14px;color:#666;">' + sym + '</span>' +
                    '<button type="button" onclick="copyElementText(\'finalSendAmt\')" style="background:rgba(98,126,234,0.1);color:#627EEA;border:none;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">Copy</button>' +
                '</div>' +
                '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;">Wallet Address:</div>' +
                '<div style="display:flex; gap:8px;">' +
                    '<input type="text" class="form-input" id="finalWalletAddr" value="' + addr + '" readonly style="flex:1;background:rgba(255,255,255,0.5);font-family:monospace;font-size:12px;">' +
                    '<button type="button" onclick="copyElementText(\'finalWalletAddr\')" style="background:rgba(98,126,234,0.1);color:#627EEA;border:none;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">Copy</button>' +
                '</div>' +
                '<div style="font-size:11px;color:#ff3b30;margin-top:12px;font-weight:600;">⚠️ Please make sure to select the correct network (' + netName + '). Otherwise funds will be lost.</div>' +
            '</div>';
        
        document.getElementById('cryptoWalletBox').innerHTML = addrBoxHtml;
        if(typeof lucide !== 'undefined') lucide.createIcons();

        document.getElementById('cryptoTxidWrap').style.display = 'block';
        document.getElementById('verifyCryptoBtn').style.display = 'block';
    });
}

function verifyCryptoCheck(event) {
    if (event) event.preventDefault();
    var policyCheck = document.getElementById('policyAgreeCheck');
    if (policyCheck && !policyCheck.checked) {
        alert("Please agree to our Policies to continue.");
        return;
    }
    verifyCryptoPayment();
}

function placeOrderCheck(event) {
    if (event) event.preventDefault();
    var policyCheck = document.getElementById('policyAgreeCheck');
    if (policyCheck && !policyCheck.checked) {
        alert("Please agree to our Policies to continue.");
        return;
    }
    
    if (settings.enable_fun_checkbox && selectedPayMethod === 'cod') {
        var funCheck1 = document.getElementById('funPromiseCheck1');
        var funCheck2 = document.getElementById('funPromiseCheck2');
        if (funCheck1 && !funCheck1.checked) {
            alert('অর্ডার কনফার্ম করতে দয়া করে "আমি নিশ্চিত..." বক্সে টিক দিন!');
            return;
        }
        if (funCheck2 && !funCheck2.checked) {
            alert('অর্ডার কনফার্ম করতে দয়া করে "পণ্য হাতে পেয়ে..." বক্সে টিক দিন!');
            return;
        }
    }
    placeOrder();
}

// Ensure fun check tooltips logic runs on DOM load
document.addEventListener('DOMContentLoaded', function() {
    var checkBox1 = document.getElementById('funPromiseCheck1');
    var tooltip1 = document.getElementById('funTooltip1');
    if (checkBox1 && tooltip1) {
        checkBox1.addEventListener('change', function () {
            if (this.checked) {
                tooltip1.style.opacity = '1'; tooltip1.style.visibility = 'visible'; tooltip1.style.transform = 'translateX(-50%) translateY(-10px)';
            } else {
                tooltip1.style.opacity = '0'; tooltip1.style.visibility = 'hidden'; tooltip1.style.transform = 'translateX(-50%) translateY(10px)';
            }
        });
    }

    var checkBox2 = document.getElementById('funPromiseCheck2');
    var tooltip2 = document.getElementById('funTooltip2');
    if (checkBox2 && tooltip2) {
        checkBox2.addEventListener('change', function () {
            if (this.checked) {
                tooltip2.style.opacity = '1'; tooltip2.style.visibility = 'visible'; tooltip2.style.transform = 'translateX(-50%) translateY(10px)';
            } else {
                tooltip2.style.opacity = '0'; tooltip2.style.visibility = 'hidden'; tooltip2.style.transform = 'translateX(-50%) translateY(-10px)';
            }
        });
    }
});

function copyText(text, btn) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(function() {
        var orig = btn.textContent;
        btn.textContent = '✅ Copied!';
        btn.classList.add('copied');
        setTimeout(function() { btn.textContent = orig; btn.classList.remove('copied'); }, 1800);
    }).catch(function() {
        // fallback
        var el = document.createElement('textarea');
        el.value = text; document.body.appendChild(el); el.select();
        document.execCommand('copy'); document.body.removeChild(el);
        btn.textContent = '✅ Copied!';
        setTimeout(function() { btn.textContent = '📋 Copy'; }, 1800);
    });
}

function setVerifyStatus(msg, type) {
    var el = document.getElementById('cryptoVerifyStatus');
    el.className = 'verify-status' + (type ? ' ' + type : '');
    el.textContent = msg;
}

// ── Crypto Payment Verification ─────────────────────────────────────────────
// PRIMARY:  PHP Proxy → Binance API (no Supabase needed for verify)
// BACKUP:   Supabase Edge Function (no cPanel/PHP needed)
// CONTROL:  settings.verify_mode = 'auto' | 'php_only' | 'supabase_only'
function verifyCryptoPayment() {
    if (intlVerified) { placeCryptoOrder(); return; }

    var txid = (document.getElementById('cryptoTxidInput').value || '').trim();
    if (!txid) { setVerifyStatus('❌ Please enter your Transaction ID / TxHash.', 'error'); return; }
    if (!intlPayMode) { setVerifyStatus('❌ Please select a payment method first.', 'error'); return; }
    if (intlPayMode === 'crypto' && !intlNetworkName) { setVerifyStatus('❌ Please select a network first.', 'error'); return; }

    var btn = document.getElementById('verifyCryptoBtn');
    var verifyMode = (settings.verify_mode || 'auto');
    btn.disabled = true;
    btn.textContent = '🔍 Verifying...';
    setVerifyStatus('🔍 Checking transaction...', 'loading');

    var total = updateSummaryTotals();
    var rate  = parseFloat(settings.usd_to_bdt_rate || 110);
    var targetAmt = intlPayMode === 'binance_pay' ? parseFloat((total / rate).toFixed(2)) : window.expectedCryptoAmt;

    // ── Layer 1: Quick frontend double-spend pre-check ────────
    var checkPromise;
    if (CONFIG.DB_PROVIDER === 'supabase') {
        checkPromise = supabaseClient.from('verified_payments').select('id').eq('transaction_id', txid).maybeSingle();
    } else if (CONFIG.DB_PROVIDER === 'appwrite') {
        checkPromise = appwriteDatabases.listDocuments(APP_DB, 'verified_payments', [
                AppwriteQuery.equal('transaction_id', txid),
                AppwriteQuery.limit(1)
            ]).then(function(res) {
                return res.documents.length
                    ? { data: { id: res.documents[0].$id }, error: null }
                    : { data: null, error: null };
            }).catch(function(err) { return { data: null, error: err }; });
    } else {
        checkPromise = Promise.resolve({ data: null });
    }
    checkPromise
    .then(function(dupRes) {
        if (!dupRes.error && dupRes.data) {
            setVerifyStatus('❌ This Transaction ID has already been used! Double-spend rejected.', 'error');
            btn.disabled = false; btn.textContent = '✅ Verify & Pay';
            return;
        }

        // ── Layer 2: Route based on verify_mode ──────────────────────
        //
        // ☁️ cloudflare  → /api/binance-cf-proxy  (NEW default — Cloudflare Edge)
        // 🔄 auto        → PHP proxy, fail হলে Supabase backup (legacy)
        // 🔵 php_only    → PHP proxy only, no fallback (legacy)
        // 🟠 supabase_only → Supabase Edge Function only (legacy)
        //
        // সব legacy path অক্ষত আছে — কোনো কিছু delete করা হয়নি

        var body = intlPayMode === 'binance_pay'
            ? { action: 'verify-pay',     order_ref: txid, expected_amount: targetAmt }
            : { action: 'verify-deposit', tx_hash: txid, coin: intlCoinSymbol, expected_amount: targetAmt };

        // ── 🤗 NEW: Hugging Face API (External) ──────────────
        if (verifyMode === 'hugging_face') {
            var hfUrl = (settings.hf_api_url || '').trim();
            if (!hfUrl) {
                setVerifyStatus('❌ Hugging Face API URL is not configured.', 'error');
                btn.disabled = false; btn.textContent = '✅ Verify & Pay';
                return;
            }

            // Step 3: Hugging Face Call
            fetch(hfUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: intlPayMode === 'binance_pay' ? 'verify-pay' : 'verify-deposit',
                    tx_id: txid,
                    amount: targetAmt,
                    expected_amount: targetAmt,
                    coin: intlPayMode === 'binance_pay' ? 'USDT' : intlCoinSymbol,
                    network: intlPayMode === 'binance_pay' ? 'Binance Pay' : intlNetworkName,
                    order_id: 'PENDING'
                })
            })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.success || data.status === 'Verified' || data.status === 'verified') {
                    intlVerified = true;
                    setVerifyStatus('✅ Verified via Hugging Face! Locking payment & placing order...', 'success');
                    btn.textContent = '✅ Verified — Placing Order...';
                    setTimeout(function() { placeCryptoOrder(txid, targetAmt, false); }, 700);
                } else {
                    setVerifyStatus('❌ Verification failed: ' + (data.error || 'Transaction rejected by Hugging Face API.'), 'error');
                    btn.disabled = false; btn.textContent = '✅ Verify & Pay';
                }
            })
            .catch(function(err) {
                setVerifyStatus('❌ Hugging Face API unavailable: ' + err.message, 'error');
                btn.disabled = false; btn.textContent = '✅ Verify & Pay';
            });
            return;
        }

        // ── ☁️ NEW: Cloudflare Edge Proxy (Recommended) ──────────────
        if (verifyMode === 'cloudflare') {
            var cfTimeout = new Promise(function(_, reject) {
                setTimeout(function() { reject(new Error('timeout')); }, 15000);
            });
            Promise.race([
                fetch('/api/binance-cf-proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                }).then(function(r) { return r.json(); }),
                cfTimeout
            ])
            .then(function(data) {
                if (data.success) {
                    saveTxidAndPlace(txid, targetAmt, btn, false);
                } else {
                    setVerifyStatus('❌ Verification failed: ' + (data.error || 'Transaction not confirmed on Binance.'), 'error');
                    btn.disabled = false; btn.textContent = '✅ Verify & Pay';
                }
            })
            .catch(function() {
                // Cloudflare proxy fail হলে Supabase backup
                setVerifyStatus('⚠️ Cloudflare proxy unavailable. Switching to Supabase backup...', 'loading');
                runSupabaseEdgeBackup(txid, targetAmt, btn);
            });
            return;
        }

        // ── 🟠 Supabase Edge Only (legacy) ────────────────────────────
        var proxyUrl = (settings.binance_proxy_url || '').trim();
        if (verifyMode === 'supabase_only' || !proxyUrl) {
            runSupabaseEdgeBackup(txid, targetAmt, btn);
            return;
        }

        // ── 🔄 Auto / 🔵 PHP Only (legacy) ───────────────────────────
        var phpTimeout = new Promise(function(_, reject) {
            setTimeout(function() { reject(new Error('timeout')); }, 12000);
        });

        Promise.race([
            fetch(proxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            }).then(function(r) { return r.json(); }),
            phpTimeout
        ])
        .then(function(data) {
            if (data.success) {
                // ✅ PHP verified via Binance API
                // Now lock in Supabase from frontend (PHP doesn't touch Supabase)
                saveTxidAndPlace(txid, targetAmt, btn, false);
            } else {
                setVerifyStatus('❌ Verification failed: ' + (data.error || 'Transaction not confirmed on Binance.'), 'error');
                btn.disabled = false; btn.textContent = '✅ Verify & Pay';
            }
        })
        .catch(function() {
            if (verifyMode === 'php_only') {
                // php_only mode — do not fallback
                setVerifyStatus('❌ PHP proxy unavailable. Please check cPanel or switch to Auto mode.', 'error');
                btn.disabled = false; btn.textContent = '✅ Verify & Pay';
            } else {
                setVerifyStatus('⚠️ Primary unavailable. Switching to Supabase backup...', 'loading');
                runSupabaseEdgeBackup(txid, targetAmt, btn);
            }
        });
    });
}

// ── PRIMARY path: PHP verified → save TxID lock to Supabase → place order ────
function saveTxidAndPlace(txid, usdt, btn, isBackup) {
    var coinVal = intlPayMode === 'binance_pay' ? 'USDT' : intlCoinSymbol;
    var netVal  = intlPayMode === 'binance_pay' ? 'Binance Pay' : intlNetworkName;
    var method  = intlPayMode === 'binance_pay' ? 'binance_pay' : 'crypto';

    var insPromise;
    var insData = {
        transaction_id: txid,
        order_id:       'PENDING',
        amount:         usdt,
        currency:       'USDT',
        method:         method,
        coin:           coinVal,
        network:        netVal
    };
    if (CONFIG.DB_PROVIDER === 'supabase') {
        insPromise = supabaseClient.from('verified_payments').insert([insData]);
    } else if (CONFIG.DB_PROVIDER === 'appwrite') {
        var awInsData = Object.assign({}, insData);
        if (typeof awInsData.raw_response !== 'string') awInsData.raw_response = JSON.stringify(awInsData.raw_response || {});
        awInsData.created_at = awInsData.created_at || new Date().toISOString();
        delete awInsData.id;
        insPromise = appwriteDatabases.createDocument(APP_DB, 'verified_payments', AppwriteID.unique(), awInsData)
            .then(function() { return { error: null }; })
            .catch(function(err) { return { error: err }; });
    } else {
        insPromise = Promise.resolve({ data: null, error: { code: 'not_implemented' } });
    }
    insPromise.then(function(insRes) {
        if (insRes.error && insRes.error.code === '23505') {
            setVerifyStatus('❌ Transaction ID already recorded. Double-spend blocked.', 'error');
            btn.disabled = false; btn.textContent = '✅ Verify & Pay';
            return;
        }
        intlVerified = true;
        setVerifyStatus('✅ Verified on Binance! Locking payment & placing order...', 'success');
        btn.textContent = '✅ Verified — Placing Order...';
        setTimeout(function() { placeCryptoOrder(txid, usdt, false); }, 700);
    });
}

// ── BACKUP path: Supabase Edge Function (no cPanel/PHP needed) ───────────────
function runSupabaseEdgeBackup(txid, usdt, btn) {
    var edgeUrl  = (settings.supabase_edge_url || '').trim();
    if (!edgeUrl) {
        setVerifyStatus('❌ Supabase Edge Function URL is not configured.', 'error');
        btn.disabled = false; btn.textContent = '✅ Verify & Pay';
        return;
    }
    setVerifyStatus('🔄 Connecting to backup system (Supabase)...', 'loading');

    var anonKey  = CONFIG.SUPABASE_ANON_KEY;
    var coinVal  = intlPayMode === 'binance_pay' ? 'USDT' : intlCoinSymbol;
    var netVal   = intlPayMode === 'binance_pay' ? 'Binance Pay' : intlNetworkName;
    var method   = intlPayMode === 'binance_pay' ? 'binance_pay' : 'crypto';

    fetch(edgeUrl, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'Authorization': 'Bearer ' + anonKey,
            'apikey':         anonKey
        },
        body: JSON.stringify({
            transaction_id: txid,
            method:   method,
            amount:   usdt,
            currency: 'USDT',
            coin:     coinVal,
            network:  netVal
        })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            intlVerified = true;
            setVerifyStatus('✅ Recorded via Supabase backup. Admin will verify manually. Placing order...', 'success');
            btn.textContent = '✅ Recorded — Placing Order...';
            setTimeout(function() { placeCryptoOrder(txid, usdt, true); }, 700);
        } else {
            var errMsg = data.message || 'Backup verification failed.';
            setVerifyStatus('❌ ' + errMsg, 'error');
            btn.disabled = false; btn.textContent = '✅ Verify & Pay';
        }
    })
    .catch(function(err) {
        setVerifyStatus('⚠️ Both systems unavailable. Please check your internet and try again.', 'error');
        btn.disabled = false; btn.textContent = '✅ Verify & Pay';
    });
}

function placeCryptoOrder(txid, usdt, isBackup) {
    var name  = document.getElementById('custName').value.trim();
    var phone = document.getElementById('custPhone').value.trim();
    var email = document.getElementById('custEmail').value.trim();
    var div   = isPickup ? 'Pickup' : document.getElementById('divSelect').value;
    var dist  = isPickup ? 'Pickup' : document.getElementById('distSelect').value;
    var upa   = isPickup ? 'Pickup' : document.getElementById('upaSelect').value;
    var addr  = isPickup ? (settings.store_address || 'Store Pickup') : document.getElementById('custAddress').value.trim();
    var total = updateSummaryTotals();

    var methodLabel = intlPayMode === 'binance_pay'
        ? 'Binance Pay (USDT)'
        : 'Crypto ' + intlCoinSymbol + ' [' + intlNetworkName + ']';

    var payStatus = isBackup ? 'Manual Review' : 'Paid';
    var ordStatus = isBackup ? 'Pending' : 'Confirmed';

    var subtotal = cart.reduce(function(s,i){return s+i.price*(i.quantity||1);},0);
    var orderId  = genOrderId();

    var orderData = {
        id:              orderId,
        customer_name:   name,
        customer_phone:  phone,
        customer_email:  email,
        division:        div,
        district:        dist,
        upazila:         upa,
        address:         addr,
        items:           cart,
        addons:          selectedAddons.map(function(a){return a.name;}).join(', ') || 'None',
        subtotal:        subtotal,
        addon_total:     addonTotal,
        delivery_charge: deliveryCharge,
        promo_code:      promoCode || null,
        promo_discount:  promoDiscount,
        grand_total:     total,
        advance_payable: 0,
        payment_method:  methodLabel,
        payment_status:  payStatus,
        payment_trx_id:  txid,
        payment_sender:  usdt + ' USDT',
        status:          ordStatus,
        order_type:      isPickup ? 'pickup' : 'delivery'
    };

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
    } else {
        insertOrderPromise = Promise.resolve({ data: null, error: { message: 'Appwrite not implemented' } });
    }
    insertOrderPromise.then(function(r) {
        if (r.error) {
            setVerifyStatus('❌ Order save error: ' + r.error.message, 'error');
            var btn = document.getElementById('verifyCryptoBtn');
            btn.disabled = false; btn.textContent = '✅ Verify & Pay';
            return;
        }
        // Update verified_payments with real order_id
        if (CONFIG.DB_PROVIDER === 'supabase') {
            supabaseClient.from('verified_payments').update({ order_id: orderId }).eq('transaction_id', txid);
        } else if (CONFIG.DB_PROVIDER === 'appwrite') {
            appwriteDatabases.listDocuments(APP_DB, 'verified_payments', [
                AppwriteQuery.equal('transaction_id', txid)
            ]).then(function(res) {
                if (res.documents.length) {
                    return appwriteDatabases.updateDocument(APP_DB, 'verified_payments', res.documents[0].$id, { order_id: orderId });
                }
            }).catch(function(err) { console.error('VP update error:', err.message); });
        }

        sendOrderNotification(orderData);
        if (isDirectOrder) { localStorage.removeItem(DIRECT_KEY); }
        else               { localStorage.removeItem(CONFIG.CART_KEY); }
        window.location.href = 'success.html?id=' + orderId;
    });
}

// ── Utils ─────────────────────────────────────────────────────
function copyElementText(elId) {
    var el = document.getElementById(elId);
    if (!el) return;
    var text = (el.textContent || el.innerText || '').replace(/[৳]/g, '').trim();

    var fallback = function() {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); } catch(e) {}
        document.body.removeChild(ta);
    };

    var done = function() {
        var og = el.style.color;
        el.style.color = '#34C759';
        setTimeout(function() { el.style.color = og; }, 600);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function() { fallback(); done(); });
    } else {
        fallback(); done();
    }
}
