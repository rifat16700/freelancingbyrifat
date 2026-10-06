// ============================================================
// admin-common.js — Shared Admin Panel Logic
// Include on every admin page (after config.js + supabase-init.js)
// ============================================================

// ── Sidebar HTML Template ────────────────────────────────────
var SIDEBAR_HTML = `
<div class="sidebar-overlay" id="sidebarOverlay" onclick="closeSidebar()"></div>
<aside class="admin-sidebar" id="adminSidebar">
    <div class="sidebar-header">
        <div class="sidebar-logo">
            <div class="logo-icon-box">🛍️</div>
            <div>
                <div class="logo-title" id="sidebarStoreName">Admin Panel</div>
                <div class="logo-sub">Control Center</div>
            </div>
        </div>
        <button class="sidebar-close-btn" onclick="closeSidebar()">✕</button>
    </div>

    <nav class="sidebar-nav">
        <div class="nav-section-label">Main</div>
        <a href="dashboard.html" class="nav-item" data-page="dashboard">
            <span class="nav-icon">📊</span>
            <span>Dashboard</span>
        </a>
        <a href="orders.html" class="nav-item" data-page="orders">
            <span class="nav-icon">📦</span>
            <span>Orders</span>
            <span class="nav-badge" id="pendingBadge" style="display:none;">0</span>
        </a>

        <div class="nav-section-label">Catalog</div>
        <a href="products.html" class="nav-item" data-page="products">
            <span class="nav-icon">🛍️</span>
            <span>Products</span>
        </a>
        <a href="categories.html" class="nav-item" data-page="categories">
            <span class="nav-icon">🏷️</span>
            <span>Categories</span>
        </a>
        <a href="banners.html" class="nav-item" data-page="banners">
            <span class="nav-icon">🖼️</span>
            <span>Banners</span>
        </a>
        <a href="sections.html" class="nav-item" data-page="sections">
            <span class="nav-icon">🏠</span>
            <span>Homepage Sections</span>
        </a>

        <div class="nav-section-label">Manage</div>
        <a href="delivery.html" class="nav-item" data-page="delivery">
            <span class="nav-icon">🚚</span>
            <span>Delivery Zones</span>
        </a>
        <a href="promos.html" class="nav-item" data-page="promos">
            <span class="nav-icon">🎟️</span>
            <span>Promo Codes</span>
        </a>
        <a href="addons.html" class="nav-item" data-page="addons">
            <span class="nav-icon">✨</span>
            <span>Add-ons</span>
        </a>
        <a href="reviews.html" class="nav-item" data-page="reviews">
            <span class="nav-icon">⭐</span>
            <span>Reviews</span>
            <span class="nav-badge green" id="reviewBadge" style="display:none;">0</span>
        </a>

        <div class="nav-section-label">Config</div>
        <a href="env-setup.html" class="nav-item" data-page="env-setup">
            <span class="nav-icon">🔐</span>
            <span>ENV Setup</span>
        </a>
        <a href="settings.html" class="nav-item" data-page="settings">
            <span class="nav-icon">⚙️</span>
            <span>Settings</span>
        </a>
        <a href="theme.html" class="nav-item" data-page="theme">
            <span class="nav-icon">🎨</span>
            <span>Theme Customizer</span>
        </a>
        <a href="tracking.html" class="nav-item" data-page="tracking">
            <span class="nav-icon">📈</span>
            <span>Tracking</span>
        </a>
    </nav>

    <div class="sidebar-footer">
        <div class="admin-user-box">
            <div class="user-avatar" id="userAvatar">A</div>
            <div>
                <div class="user-email" id="adminUserEmail">Loading...</div>
                <div class="user-role">Administrator</div>
            </div>
        </div>
        <button class="logout-btn" onclick="adminLogout()">🚪 Logout</button>
    </div>
</aside>`;

// ── Toast Container ──────────────────────────────────────────
var TOAST_HTML = '<div class="toast-container" id="toastContainer"></div>';

// ── Init: Inject sidebar + check auth ────────────────────────
function adminInit(activePage, onReady) {
    // Inject sidebar + overlay + toast container into page
    document.body.insertAdjacentHTML('afterbegin', SIDEBAR_HTML);
    document.body.insertAdjacentHTML('beforeend', TOAST_HTML);

    // ── Web3 / Appwrite localStorage session check ──
    var awWallet = localStorage.getItem('aw_admin_wallet');
    var awTs     = parseInt(localStorage.getItem('aw_admin_ts') || '0');
    var awValid  = awWallet && (Date.now() - awTs) < 86400000; // 24 hour

    // Legacy Web3 via sessionStorage (Supabase mode)
    var web3Verified = sessionStorage.getItem('web3_admin_verified') === 'true';
    var web3Wallet   = sessionStorage.getItem('web3_admin_wallet') || '';

    if (web3Verified && web3Wallet) {
        var shortAddr = web3Wallet.substring(0, 6) + '...' + web3Wallet.substring(web3Wallet.length - 4);
        var emailEl = document.getElementById('adminUserEmail');
        var avatarEl = document.getElementById('userAvatar');
        if (emailEl) emailEl.textContent = '🦊 ' + shortAddr;
        if (avatarEl) avatarEl.textContent = '⬡';

        if (activePage) {
            var items = document.querySelectorAll('.nav-item[data-page="' + activePage + '"]');
            for (var i = 0; i < items.length; i++) { items[i].classList.add('active'); }
        }
        loadSidebarStoreName();
        adminLoadBadges();
        if (typeof onReady === 'function') onReady();
        return;
    }

    if (CONFIG.DB_PROVIDER === 'appwrite' && awValid) {
        // Appwrite wallet-auth: localStorage token valid
        var shortAddr2 = awWallet.substring(0, 6) + '...' + awWallet.substring(awWallet.length - 4);
        var emailEl2 = document.getElementById('adminUserEmail');
        var avatarEl2 = document.getElementById('userAvatar');
        if (emailEl2) emailEl2.textContent = '🦊 ' + shortAddr2;
        if (avatarEl2) avatarEl2.textContent = '⬡';

        if (activePage) {
            var items2 = document.querySelectorAll('.nav-item[data-page="' + activePage + '"]');
            for (var j = 0; j < items2.length; j++) { items2[j].classList.add('active'); }
        }
        loadSidebarStoreName();
        adminLoadBadges();
        if (typeof onReady === 'function') onReady();
        return;
    }

    // ── Email/Google session check ────────────────────────────
    var sessionPromise;
    if (CONFIG.DB_PROVIDER === 'supabase') {
        sessionPromise = supabaseClient.auth.getSession().then(function(res) {
            return res.data && res.data.session ? res.data.session : null;
        });
    } else if (CONFIG.DB_PROVIDER === 'appwrite') {
        sessionPromise = appwriteAccount.getSession('current')
        .then(function(s) { return s; })
        .catch(function() { return null; });
    } else if (CONFIG.DB_PROVIDER === 'cf_db') {
        sessionPromise = Promise.resolve(localStorage.getItem('admin_token') ? { user: 'admin' } : null);
    } else {
        sessionPromise = Promise.resolve(null);
    }

    sessionPromise.then(function(session) {
        if (!session) {
            window.location.href = 'index.html';
            return;
        }

        var email   = localStorage.getItem('fbr_admin_email') || '';
        var initial = email.charAt(0).toUpperCase() || 'A';
        var emailEl  = document.getElementById('adminUserEmail');
        var avatarEl = document.getElementById('userAvatar');
        if (emailEl)  emailEl.textContent  = email || 'Admin';
        if (avatarEl) avatarEl.textContent = initial;

        if (activePage) {
            var items = document.querySelectorAll('.nav-item[data-page="' + activePage + '"]');
            for (var i = 0; i < items.length; i++) { items[i].classList.add('active'); }
        }

        loadSidebarStoreName();
        adminLoadBadges();
        if (typeof onReady === 'function') onReady();
    });
}


// ── Load sidebar store name ───────────────────────────────────
function loadSidebarStoreName() {
    if (CONFIG.DB_PROVIDER === 'supabase') {
        supabaseClient.from('settings').select('store_name').eq('id', 1).single()
        .then(function(r) {
            if (r.data && r.data.store_name) {
                var el = document.getElementById('sidebarStoreName');
                if (el) el.textContent = r.data.store_name;
            }
        });
    } else if (CONFIG.DB_PROVIDER === 'appwrite') {
        appwriteDatabases.getDocument(APP_DB, 'settings', 'main_settings')
        .then(function(doc) {
            if (doc.store_name) {
                var el = document.getElementById('sidebarStoreName');
                if (el) el.textContent = doc.store_name;
            }
        }).catch(function() {});
    } else if (CONFIG.DB_PROVIDER === 'cf_db') {
        // Store name is now fetched implicitly via cfDbBatchQuery on each page.
    }
}

// ── CF DB Batch Query Helper (Optimized for 1 Function Call) ──
window.cfDbBatchQuery = function(queries, isMultiple) {
    queries.push({ sql: "SELECT store_name FROM settings WHERE id = 1" });

    // 10s timeout — network hang হলে reject হবে, admin infinite loading এ আটকাবে না
    var timeoutPromise = new Promise(function(_, reject) {
        setTimeout(function() { reject(new Error('Request timeout (10s). Check Cloudflare Functions.')); }, 10000);
    });

    var fetchPromise = fetch((CONFIG.HF_API_BASE||"")+"/api/d1-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queries: queries })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d.success && d.result) {
            var storeRes = d.result.pop();
            if (storeRes && storeRes.results && storeRes.results.length) {
                var el = document.getElementById('sidebarStoreName');
                if (el) el.textContent = storeRes.results[0].store_name;
            }
            if (isMultiple) {
                return d.result.map(function(item) { return { success: true, result: [item] }; });
            } else {
                return { success: true, result: [d.result[0]] };
            }
        }
        var errStr = d.error || 'Batch query failed';
        if (errStr.includes('no such table') || errStr.includes('has no column')) {
            showSchemaModal();
        }
        throw new Error(errStr);
    });

    return Promise.race([fetchPromise, timeoutPromise]);
}

function showSchemaModal() {
    if (document.getElementById('schemaModal')) return;
    var sql = `DROP TABLE IF EXISTS product_categories;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS addons;
DROP TABLE IF EXISTS promos;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS admins;
DROP TABLE IF EXISTS delivery_zones;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS home_sections;
DROP TABLE IF EXISTS devtools;
DROP TABLE IF EXISTS verified_payments;
DROP TABLE IF EXISTS banners;

CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, base_price REAL DEFAULT 0, flash_sale_price REAL DEFAULT 0, flash_sale_end TEXT, variants TEXT DEFAULT '[]', gallery_images TEXT DEFAULT '[]', video_url TEXT, video_type TEXT DEFAULT 'auto', sku TEXT, is_active INTEGER DEFAULT 1, is_featured INTEGER DEFAULT 0, is_add_once INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, icon_url TEXT, sort_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE product_categories (product_id TEXT, category_id TEXT, PRIMARY KEY (product_id, category_id));
CREATE TABLE orders (id TEXT PRIMARY KEY, customer_name TEXT, customer_phone TEXT, customer_address TEXT, cart_total REAL, delivery_charge REAL, discount REAL, final_total REAL, status TEXT DEFAULT 'pending', items TEXT DEFAULT '[]', promo_code TEXT, transaction_id TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE addons (id TEXT PRIMARY KEY, name TEXT NOT NULL, price REAL DEFAULT 0, image TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE promos (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, type TEXT DEFAULT 'public', disc_type TEXT DEFAULT 'flat', disc_val REAL DEFAULT 0, max_cap REAL, min_spend REAL, del_reward TEXT DEFAULT 'none', del_disc_amount REAL, del_disc_cap REAL, applicable_products TEXT DEFAULT '[]', applicable_categories TEXT DEFAULT '[]', is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE reviews (id TEXT PRIMARY KEY, product_id TEXT NOT NULL, customer_name TEXT, customer_phone TEXT, rating INTEGER DEFAULT 5, review_text TEXT, review_image TEXT, is_approved INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE admins (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE delivery_zones (id TEXT PRIMARY KEY, zone_name TEXT NOT NULL, charge REAL DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE settings (id INTEGER PRIMARY KEY DEFAULT 1, store_name TEXT DEFAULT '', logo_url TEXT DEFAULT '', favicon_url TEXT DEFAULT '', footer_text TEXT DEFAULT '', whatsapp_number TEXT DEFAULT '', facebook_url TEXT DEFAULT '', instagram_url TEXT DEFAULT '', youtube_url TEXT DEFAULT '', bkash_number TEXT DEFAULT '', nagad_number TEXT DEFAULT '', binance_manual_uid TEXT DEFAULT '', gateway_api_key TEXT DEFAULT '', gateway_api_key_v2 TEXT DEFAULT '', gateway_version TEXT DEFAULT '', allow_cod INTEGER DEFAULT 1, enable_fun_checkbox INTEGER DEFAULT 1, allow_whatsapp_order INTEGER DEFAULT 1, allow_msg_order INTEGER DEFAULT 1, advance_amount REAL DEFAULT 0, advance_method TEXT DEFAULT '', telegram_main_bot TEXT DEFAULT '', telegram_main_chats TEXT DEFAULT '', telegram_draft_bot TEXT DEFAULT '', telegram_draft_chat TEXT DEFAULT '', messaging_apps TEXT DEFAULT '[]', allow_pickup INTEGER DEFAULT 0, store_address TEXT DEFAULT '', store_map_link TEXT DEFAULT '', pickup_bot_token TEXT DEFAULT '', pickup_chat_id TEXT DEFAULT '', binance_pay_uid TEXT DEFAULT '', binance_proxy_url TEXT DEFAULT '', binance_api_key TEXT DEFAULT '', binance_api_secret TEXT DEFAULT '', usd_to_bdt_rate REAL DEFAULT 120, verify_mode TEXT DEFAULT '', supabase_edge_url TEXT DEFAULT '', hf_api_url TEXT DEFAULT '', crypto_coins TEXT DEFAULT '[]', review_imgbb_key TEXT DEFAULT '', maintenance_mode INTEGER DEFAULT 0, maintenance_message TEXT DEFAULT '', currency TEXT DEFAULT '৳');
CREATE TABLE home_sections (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL, data TEXT, display_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE devtools (id TEXT PRIMARY KEY, key_name TEXT UNIQUE NOT NULL, value TEXT);
CREATE TABLE verified_payments (id TEXT PRIMARY KEY, transaction_id TEXT UNIQUE NOT NULL, amount REAL, sender_number TEXT, status TEXT DEFAULT 'verified', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE banners (id TEXT PRIMARY KEY, image_url TEXT NOT NULL, link_url TEXT, is_active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

INSERT INTO admins (id, email, password_hash) VALUES ('admin_1', 'admin@example.com', 'admin123');
INSERT INTO settings (id, store_name, currency) VALUES (1, 'Freelancing By Rifat', '৳');`;
    
    var div = document.createElement('div');
    div.id = 'schemaModal';
    div.style = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
    div.innerHTML = '<div style="background:#fff;border-radius:12px;width:100%;max-width:700px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 10px 30px rgba(0,0,0,0.5);">' +
        '<div style="padding:20px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">' +
            '<h2 style="margin:0;color:#e74c3c;font-size:20px;"><i data-lucide="alert-circle" style="vertical-align:middle;margin-right:8px;"></i>Database Tables Missing!</h2>' +
            '<button onclick="this.closest(\'#schemaModal\').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999;">&times;</button>' +
        '</div>' +
        '<div style="padding:20px;overflow-y:auto;flex:1;">' +
            '<p style="margin-top:0;color:#333;font-size:15px;">It looks like your D1 Database is empty. Please copy the SQL code below, go to your Cloudflare Dashboard -> D1 -> Console, paste it, and run it to create your tables.</p>' +
            '<textarea id="schemaText" style="width:100%;height:250px;font-family:monospace;font-size:13px;padding:15px;border:1px solid #ddd;border-radius:8px;background:#f8f9fa;resize:none;" readonly>' + sql + '</textarea>' +
        '</div>' +
        '<div style="padding:20px;border-top:1px solid #eee;text-align:right;">' +
            '<button onclick="navigator.clipboard.writeText(document.getElementById(\'schemaText\').value);this.textContent=\'Copied!\';setTimeout(()=>this.textContent=\'Copy SQL Schema\',2000);" style="background:#2ecc71;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-weight:bold;cursor:pointer;margin-right:10px;"><i data-lucide="copy" style="width:16px;height:16px;vertical-align:middle;margin-right:5px;"></i>Copy SQL Schema</button>' +
            '<button onclick="this.closest(\'#schemaModal\').remove()" style="background:#eee;color:#333;border:none;padding:10px 20px;border-radius:8px;font-weight:bold;cursor:pointer;">Close</button>' +
        '</div>' +
    '</div>';
    document.body.appendChild(div);
    if(typeof lucide !== 'undefined') lucide.createIcons();
}
// ── D1 Admin Query Helper (For cf_db write operations) ──────────
function d1AdminQuery(sql, params) {
    return fetch((CONFIG.HF_API_BASE ? CONFIG.HF_API_BASE.replace(/\/+$/, '') : '') + '/api/admin-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('admin_token') || '') },
        body: JSON.stringify({ sql: sql, params: params || [] })
    }).then(function(r) { return r.json(); }).then(function(d) {
        if (!d.success) {
            var errStr = d.error || 'D1 Admin Query Failed';
            if (errStr.includes('no such table') || errStr.includes('has no column')) {
                showSchemaModal();
            }
            throw new Error(errStr);
        }
        return d;
    });
}

// ── Load sidebar badge counts ─────────────────────────────────
function adminLoadBadges() {
    // Pending orders
    if (CONFIG.DB_PROVIDER === 'supabase') {
        supabaseClient.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'Pending')
        .then(function(r) {
            var count = r.count || 0;
            var el = document.getElementById('pendingBadge');
            if (el && count > 0) { el.textContent = count; el.style.display = 'inline-flex'; }
        });
        supabaseClient.from('reviews').select('id', { count: 'exact', head: true }).eq('is_approved', false)
        .then(function(r) {
            var count = r.count || 0;
            var el = document.getElementById('reviewBadge');
            if (el && count > 0) { el.textContent = count; el.style.display = 'inline-flex'; }
        });
    } else if (CONFIG.DB_PROVIDER === 'appwrite') {
        appwriteDatabases.listDocuments(APP_DB, 'orders', [
            AppwriteQuery.equal('status', 'Pending'),
            AppwriteQuery.limit(1)
        ]).then(function(res) {
            var count = res.total || 0;
            var el = document.getElementById('pendingBadge');
            if (el && count > 0) { el.textContent = count; el.style.display = 'inline-flex'; }
        }).catch(function() {});
        appwriteDatabases.listDocuments(APP_DB, 'reviews', [
            AppwriteQuery.equal('is_approved', false),
            AppwriteQuery.limit(1)
        ]).then(function(res) {
            var count = res.total || 0;
            var el = document.getElementById('reviewBadge');
            if (el && count > 0) { el.textContent = count; el.style.display = 'inline-flex'; }
        }).catch(function() {});
    }
}

// ── Logout ───────────────────────────────────────────────────
function adminLogout() {
    if (!confirm('লগআউট করবেন?')) return;

    sessionStorage.removeItem('web3_admin_verified');
    sessionStorage.removeItem('web3_admin_wallet');
    localStorage.removeItem('aw_admin_wallet');
    localStorage.removeItem('aw_admin_sig');
    localStorage.removeItem('aw_admin_ts');

    if (CONFIG.DB_PROVIDER === 'supabase') {
        supabaseClient.auth.signOut().then(function() {
            window.location.href = 'index.html';
        }).catch(function() {
            window.location.href = 'index.html';
        });
    } else if (CONFIG.DB_PROVIDER === 'appwrite') {
        appwriteAccount.deleteSession('current')
        .then(function() {
            window.location.href = 'index.html';
        }).catch(function() {
            window.location.href = 'index.html';
        });
    } else if (CONFIG.DB_PROVIDER === 'cf_db') {
        localStorage.removeItem('admin_token');
        window.location.href = 'index.html';
    } else {
        window.location.href = 'index.html';
    }
}

// ── Sidebar Toggle (mobile) ──────────────────────────────────
function openSidebar() {
    var sidebar = document.getElementById('adminSidebar');
    var overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    var sidebar = document.getElementById('adminSidebar');
    var overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
    document.body.style.overflow = '';
}

// ── DB Error Helper HTML & Logic ─────────────────────────────
var DB_ERROR_HTML = `
<style>
.db-err-tabs { display: flex; gap: 8px; margin: 15px 0 10px; flex-wrap: wrap; }
.db-err-tab { padding: 6px 12px; font-size: 13px; background: #e0e0e0; border-radius: 6px; cursor: pointer; color: #333; font-weight: 600; transition: 0.2s; }
.db-err-tab.active { background: var(--primary, #8B1A1A); color: #fff; }
.db-err-content { display: none; padding: 12px; background: #f8f9fa; border-radius: 8px; border: 1px solid #ddd; text-align: left; }
.db-err-content.active { display: block; }
.db-err-sql { display: block; padding: 10px; background: #1e1e1e; color: #4af626; border-radius: 6px; font-family: monospace; font-size: 13px; margin: 10px 0; overflow-x: auto; }
</style>
<div class="modal-overlay" id="dbErrorModal" style="z-index:99999;">
    <div class="modal-box" style="max-width: 500px;">
        <div class="modal-header">
            <div class="modal-title" style="color:#d93025; font-size: 18px;">⚠️ Database Column Missing</div>
            <button class="modal-close" onclick="document.getElementById('dbErrorModal').classList.remove('show')">✕</button>
        </div>
        <p style="font-size:14px; color:#555; margin-bottom:10px; line-height:1.5;" id="dbErrorMsgText"></p>
        
        <div class="db-err-tabs">
            <div class="db-err-tab active" onclick="switchDbErrTab('d1', event)">Cloudflare D1</div>
            <div class="db-err-tab" onclick="switchDbErrTab('supabase', event)">Supabase</div>
            <div class="db-err-tab" onclick="switchDbErrTab('appwrite', event)">Appwrite</div>
        </div>
        
        <div id="dberr-d1" class="db-err-content active">
            <p style="font-size:13px; margin:0;">Run this SQL in your Cloudflare D1 console to add the column:</p>
            <code class="db-err-sql" id="sqlCodeD1"></code>
            <button class="btn btn-primary btn-sm" onclick="copyDbErrSql('sqlCodeD1')">📋 Copy SQL</button>
        </div>
        
        <div id="dberr-supabase" class="db-err-content">
            <p style="font-size:13px; margin:0;">Run this SQL in your Supabase SQL Editor:</p>
            <code class="db-err-sql" id="sqlCodeSupa"></code>
            <button class="btn btn-primary btn-sm" onclick="copyDbErrSql('sqlCodeSupa')">📋 Copy SQL</button>
        </div>
        
        <div id="dberr-appwrite" class="db-err-content">
            <p style="font-size:13px; font-weight:600; margin-bottom:8px;">Manual Steps for Appwrite:</p>
            <ol style="font-size:13px; padding-left:20px; line-height:1.6; margin:0;">
                <li>Go to Appwrite Console → <b>Databases</b></li>
                <li>Select your Database, then click on the relevant Collection.</li>
                <li>Go to the <b>Attributes</b> tab.</li>
                <li>Click <b>Create Attribute</b>.</li>
                <li>Add an attribute named <code style="background:#eee;padding:2px 4px;border-radius:4px;color:#d93025;font-weight:bold;" id="awColName"></code> (Type: String or depending on usage).</li>
            </ol>
        </div>
    </div>
</div>
`;

window.switchDbErrTab = function(tab, e) {
    document.querySelectorAll('.db-err-tab').forEach(function(el) { el.classList.remove('active'); });
    document.querySelectorAll('.db-err-content').forEach(function(el) { el.classList.remove('active'); });
    if(e && e.currentTarget) e.currentTarget.classList.add('active');
    var target = document.getElementById('dberr-' + tab);
    if(target) target.classList.add('active');
};

window.copyDbErrSql = function(id) {
    var txt = document.getElementById(id).innerText;
    navigator.clipboard.writeText(txt).then(function() {
        showToast('SQL Copied to clipboard!', 'success');
    });
};

function handleDbMissingColumnError(message) {
    if (typeof message !== 'string') return false;
    var colMatch = message.match(/no such column:\s*([a-zA-Z0-9_\.]+)/i) || 
                   message.match(/column "([a-zA-Z0-9_\.]+)"/i) || 
                   message.match(/find the '([a-zA-Z0-9_\.]+)' column/i);
                   
    if (!colMatch) return false;
    var colName = colMatch[1];
    if (colName.includes('.')) colName = colName.split('.')[1]; // e.g. "products.is_featured" -> "is_featured"
    
    var tableName = 'your_table_name';
    var tableMatch = message.match(/table ([a-zA-Z0-9_]+)/i) || message.match(/relation "([a-zA-Z0-9_]+)"/i);
    if (tableMatch) tableName = tableMatch[1];

    var sql = "ALTER TABLE " + tableName + " ADD COLUMN " + colName + " TEXT;";
    
    if (!document.getElementById('dbErrorModal')) {
        document.body.insertAdjacentHTML('beforeend', DB_ERROR_HTML);
    }
    
    var msgText = document.getElementById('dbErrorMsgText');
    if(msgText) msgText.innerText = "Error: " + message;
    
    var codeD1 = document.getElementById('sqlCodeD1');
    if(codeD1) codeD1.innerText = sql;
    
    var codeSupa = document.getElementById('sqlCodeSupa');
    if(codeSupa) codeSupa.innerText = sql;
    
    var awCol = document.getElementById('awColName');
    if(awCol) awCol.innerText = colName;
    
    var modal = document.getElementById('dbErrorModal');
    if(modal) modal.classList.add('show');
    
    return true;
}

// ── Toast Notifications ──────────────────────────────────────
var TOAST_ICONS = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };

function showToast(message, type) {
    if (!type) type = 'info';
    
    // Intercept database missing column errors
    if (type === 'error' && handleDbMissingColumnError(message)) {
        // We still show the toast as a brief notification
    }

    var container = document.getElementById('toastContainer');
    if (!container) return;

    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML = '<span class="toast-icon">' + TOAST_ICONS[type] + '</span><span>' + message + '</span>';
    container.appendChild(toast);

    setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(30px)';
        toast.style.transition = '0.3s ease';
        setTimeout(function() { toast.remove(); }, 300);
    }, 3500);
}

// ── Button Loading State ─────────────────────────────────────
function setBtnLoading(btn, isLoading, originalText) {
    if (isLoading) {
        btn.disabled = true;
        btn.dataset.ogText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner spinner-sm" style="display:inline-block;margin-right:6px;"></span>Processing...';
    } else {
        btn.disabled = false;
        btn.innerHTML = originalText || btn.dataset.ogText || 'Save';
    }
}

// ── Format Helpers ───────────────────────────────────────────
function formatMoney(n) {
    return '৳' + (parseInt(n) || 0).toLocaleString('en-IN');
}

function formatDate(d) {
    if (!d) return '—';
    var date = new Date(d);
    return date.toLocaleString('en-BD', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function formatDateShort(d) {
    if (!d) return '—';
    var date = new Date(d);
    return date.toLocaleDateString('en-BD', { day: '2-digit', month: 'short', year: 'numeric' });
}

function genId() {
    return Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function statusBadge(status) {
    var map = {
        'Pending':    'badge-pending',
        'Confirmed':  'badge-confirmed',
        'Processing': 'badge-confirmed',
        'Shipped':    'badge-shipped',
        'Delivered':  'badge-delivered',
        'Cancelled':  'badge-cancelled',
    };
    var cls = map[status] || 'badge-pending';
    return '<span class="badge ' + cls + '">' + (status || '∙') + '</span>';
}

function payBadge(status) {
    var map = { 'Paid': 'badge-paid', 'Unpaid': 'badge-unpaid', 'Advance Paid': 'badge-adv' };
    var cls = map[status] || 'badge-unpaid';
    return '<span class="badge ' + cls + '">' + (status || '—') + '</span>';
}

// ── Confirm Dialog ───────────────────────────────────────────
function adminConfirm(msg) {
    return confirm(msg || 'আপনি কি নিশ্চিত?');
}

// ── Safe JSON Parse ──────────────────────────────────────────
function safeJson(str, fallback) {
    if (fallback === undefined) fallback = [];
    try { return JSON.parse(str); } catch(e) { return fallback; }
}

// ── Lucide Icon Render (একবার load এ, MutationObserver নেই) ──────
// MutationObserver সরানো হয়েছে কারণ এটা infinite loop করছিল।
// পেজ load হলে একবার render করবে, তারপর modals/popups এর জন্য
// প্রতিটি পেজ নিজে lucide.createIcons() call করবে।
document.addEventListener('DOMContentLoaded', function() {
    // ── Global Safety Net: 12s পর লোডার আটকে থাকলে force-show করবে ──
    setTimeout(function() {
        var loader = document.getElementById('pageLoader');
        var main   = document.getElementById('adminMain');
        if (loader && loader.style.display !== 'none') {
            loader.style.display = 'none';
            if (main) main.style.display = 'flex';
            if (typeof showToast === 'function') {
                showToast('⚠️ Loading timeout! DB বা Network সমস্যা।', 'warning');
            }
        }
    }, 12000);
});

// Global helper: যেকোনো জায়গা থেকে lucide icons refresh করতে পারবে
window.refreshIcons = function() {
    if (typeof lucide !== 'undefined') {
        try { lucide.createIcons(); } catch(e) {}
    }
};
