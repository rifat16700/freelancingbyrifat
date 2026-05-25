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

    // ── Web3 session check (MetaMask login) ──
    var web3Verified = sessionStorage.getItem('web3_admin_verified') === 'true';
    var web3Wallet   = sessionStorage.getItem('web3_admin_wallet') || '';

    if (web3Verified && web3Wallet) {
        // Web3 admin is logged in — set sidebar info
        var shortAddr = web3Wallet.substring(0, 6) + '...' + web3Wallet.substring(web3Wallet.length - 4);
        var emailEl = document.getElementById('adminUserEmail');
        var avatarEl = document.getElementById('userAvatar');
        if (emailEl) emailEl.textContent = '🦊 ' + shortAddr;
        if (avatarEl) avatarEl.textContent = '⬡';

        // Set active nav item
        if (activePage) {
            var items = document.querySelectorAll('.nav-item[data-page="' + activePage + '"]');
            for (var i = 0; i < items.length; i++) {
                items[i].classList.add('active');
            }
        }

        // Load store name for sidebar
        MasterDB.from('settings').select('store_name').eq('id', 1).single().then(function(r) {
            if (r.data && r.data.store_name) {
                var el = document.getElementById('sidebarStoreName');
                if (el) el.textContent = r.data.store_name;
            }
        });

        adminLoadBadges();

        if (typeof onReady === 'function') {
            onReady();
        }
        return; // skip Supabase session check
    }

    // ── MasterDB session check (works with Supabase + Appwrite) ──
    MasterDB.auth.getSession().then(function(res) {
        var session = res.data && res.data.session;

        if (!session) {
            window.location.href = 'index.html';
            return;
        }

        // Get email from localStorage (stored at login time)
        var email   = localStorage.getItem('fbr_admin_email') || '';
        var initial = email.charAt(0).toUpperCase() || 'A';

        var emailEl  = document.getElementById('adminUserEmail');
        var avatarEl = document.getElementById('userAvatar');
        if (emailEl)  emailEl.textContent  = email || 'Admin';
        if (avatarEl) avatarEl.textContent = initial;

        // Set active nav item
        if (activePage) {
            var items = document.querySelectorAll('.nav-item[data-page="' + activePage + '"]');
            for (var i = 0; i < items.length; i++) {
                items[i].classList.add('active');
            }
        }

        // Load store name for sidebar
        MasterDB.from('settings').select('store_name').eq('id', 1).single().then(function(r) {
            if (r.data && r.data.store_name) {
                var el = document.getElementById('sidebarStoreName');
                if (el) el.textContent = r.data.store_name;
            }
        });

        // Load pending counts for badges
        adminLoadBadges();

        // ── Page-specific callback after auth success ──
        if (typeof onReady === 'function') {
            onReady();
        }
    });
}


// ── Load sidebar badge counts ────────────────────────────────
function adminLoadBadges() {
    // Pending orders
    MasterDB.from('orders').select('id', { count: 'exact', head: true })
      .eq('status', 'Pending')
      .then(function(r) {
          var count = r.count || 0;
          var el = document.getElementById('pendingBadge');
          if (el && count > 0) {
              el.textContent = count;
              el.style.display = 'inline-flex';
          }
      });

    // Pending reviews (not approved)
    MasterDB.from('reviews').select('id', { count: 'exact', head: true })
      .eq('is_approved', false)
      .then(function(r) {
          var count = r.count || 0;
          var el = document.getElementById('reviewBadge');
          if (el && count > 0) {
              el.textContent = count;
              el.style.display = 'inline-flex';
          }
      });
}

// ── Logout ───────────────────────────────────────────────────
function adminLogout() {
    if (!confirm('লগআউট করবেন?')) return;

    // Clear Web3 session (MetaMask login)
    sessionStorage.removeItem('web3_admin_verified');
    sessionStorage.removeItem('web3_admin_wallet');

    // Clear Supabase session (Google login)
    MasterDB.auth.signOut().then(function() {
        window.location.href = 'index.html';
    }).catch(function(){
        window.location.href = 'index.html';
    });
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
