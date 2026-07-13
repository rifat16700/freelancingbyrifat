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
        <a href="settings.html" class="nav-item" data-page="settings">
            <span class="nav-icon">⚙️</span>
            <span>Settings</span>
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
        throw new Error(d.error || 'Batch query failed');
    });

    return Promise.race([fetchPromise, timeoutPromise]);
}
// ── D1 Admin Query Helper (For cf_db write operations) ──────────
function d1AdminQuery(sql, params) {
    return fetch((CONFIG.HF_API_BASE ? CONFIG.HF_API_BASE.replace(/\/+$/, '') : '') + '/api/admin-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('admin_token') || '') },
        body: JSON.stringify({ sql: sql, params: params || [] })
    }).then(function(r) { return r.json(); }).then(function(d) {
        if (!d.success) throw new Error(d.error || 'D1 Admin Query Failed');
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

// ── Toast Notifications ──────────────────────────────────────
var TOAST_ICONS = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };

function showToast(message, type) {
    if (!type) type = 'info';
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
