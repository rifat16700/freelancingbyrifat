// ============================================================
// assets/js/master-db.js
// Frontend Master DB + Auth Proxy
// All DB calls  → /api/master-db
// All Auth calls → /api/admin-auth
// Works with Supabase AND Appwrite transparently.
// ============================================================

// ── Session storage keys ──────────────────────────────────────
var _SESSION_TOKEN     = 'fbr_admin_token';
var _SESSION_ID        = 'fbr_admin_session_id';
var _SESSION_PROVIDER  = 'fbr_admin_provider';   // 'supabase' | 'appwrite'

// ─────────────────────────────────────────────────────────────
// DB QUERY BUILDER
// ─────────────────────────────────────────────────────────────
class MasterDBQueryBuilder {
    constructor(table) {
        this.table       = table;
        this.action      = 'select';
        this.selectCols  = '*';
        this.filters     = [];
        this.orderObj    = null;
        this.limitNum    = null;
        this.isSingle    = false;
        this.payloadData = null;
        this.headFlag    = false;
        this.countType   = null;
        this.rangeArr    = null;
    }

    select(cols = '*', opts = {}) {
        this.action     = 'select';
        this.selectCols = cols;
        if (opts && opts.head)  this.headFlag  = true;
        if (opts && opts.count) this.countType = opts.count;
        return this;
    }

    insert(data) { this.action = 'insert'; this.payloadData = data; return this; }
    update(data) { this.action = 'update'; this.payloadData = data; return this; }
    upsert(data) { this.action = 'upsert'; this.payloadData = data; return this; }
    delete()     { this.action = 'delete'; return this; }

    eq(col, val)   { this.filters.push({ method: 'eq',   args: [col, val] }); return this; }
    neq(col, val)  { this.filters.push({ method: 'neq',  args: [col, val] }); return this; }
    lt(col, val)   { this.filters.push({ method: 'lt',   args: [col, val] }); return this; }
    gt(col, val)   { this.filters.push({ method: 'gt',   args: [col, val] }); return this; }
    gte(col, val)  { this.filters.push({ method: 'gte',  args: [col, val] }); return this; }
    lte(col, val)  { this.filters.push({ method: 'lte',  args: [col, val] }); return this; }
    in(col, vals)  { this.filters.push({ method: 'in',   args: [col, vals] }); return this; }
    like(col, val) { this.filters.push({ method: 'like', args: [col, val] }); return this; }

    order(col, opts = {}) { this.orderObj = { col, ascending: opts.ascending !== false }; return this; }
    limit(n)              { this.limitNum = n; return this; }
    range(from, to)       { this.rangeArr = [from, to]; return this; }
    single()              { this.isSingle = true; return this; }
    maybeSingle()         { this.isSingle = true; return this; }

    then(onFulfilled, onRejected) {
        return this.execute().then(onFulfilled, onRejected);
    }

    async execute() {
        const body = {
            table:       this.table,
            action:      this.action,
            selectCols:  this.selectCols,
            filters:     this.filters,
            orderObj:    this.orderObj,
            limitNum:    this.limitNum,
            isSingle:    this.isSingle,
            payloadData: this.payloadData,
            headFlag:    this.headFlag,
            countType:   this.countType,
            rangeArr:    this.rangeArr,
            // ── Official platform tokens ─────────────────────
            // Supabase: JWT token | Appwrite: session secret
            adminToken:  localStorage.getItem('fbr_admin_token')      || '',
            // Appwrite only: session $id (needed for session verify)
            sessionId:   localStorage.getItem('fbr_admin_session_id') || '',
        };

        try {
            const res  = await fetch('/api/master-db', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(body),
            });
            return await res.json();
        } catch (err) {
            return { data: null, error: { message: err.message }, count: null };
        }
    }
}

// ─────────────────────────────────────────────────────────────
// AUTH HELPER — calls /api/admin-auth (DB_PROVIDER aware)
// ─────────────────────────────────────────────────────────────
async function _authCall(payload) {
    try {
        const res  = await fetch('/api/admin-auth', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
        });
        return await res.json();
    } catch (err) {
        return { error: { message: err.message } };
    }
}

// ─────────────────────────────────────────────────────────────
// MasterDB.auth  — mimics Supabase auth API shape
// so existing admin code works without any change.
// ─────────────────────────────────────────────────────────────
var MasterDBAuth = {

    // ── Sign in with email + password ─────────────────────────
    signInWithPassword: async function({ email, password }) {
        const res = await _authCall({ action: 'login', email, password });
        if (res.error || !res.ok) {
            return { data: null, error: { message: res.error || 'Login failed' } };
        }
        // Persist token + session info locally
        localStorage.setItem(_SESSION_TOKEN,         res.token);
        localStorage.setItem(_SESSION_ID,            res.sessionId || '');
        localStorage.setItem('fbr_admin_login_time', Date.now().toString());
        // Return Supabase-shaped response
        return { data: { session: { access_token: res.token }, user: res.user }, error: null };
    },

    // ── Get current session ────────────────────────────────────
    // Uses local timestamp — avoids unnecessary API calls on every page load
    // which caused the redirect loop.
    getSession: async function() {
        var token     = localStorage.getItem(_SESSION_TOKEN);
        var sessionId = localStorage.getItem(_SESSION_ID);
        var loginTime = parseInt(localStorage.getItem('fbr_admin_login_time') || '0', 10);

        if (!token) return { data: { session: null }, error: null };

        // Session expires after 24 hours locally
        var SESSION_TTL = 24 * 60 * 60 * 1000;
        if (Date.now() - loginTime > SESSION_TTL) {
            // Expired locally — clear and return null
            localStorage.removeItem(_SESSION_TOKEN);
            localStorage.removeItem(_SESSION_ID);
            localStorage.removeItem('fbr_admin_login_time');
            return { data: { session: null }, error: null };
        }

        // Token exists and not expired locally — session is valid
        return { data: { session: { access_token: token }, user: {} }, error: null };
    },

    // ── Sign out ───────────────────────────────────────────────
    signOut: async function() {
        var token     = localStorage.getItem(_SESSION_TOKEN);
        var sessionId = localStorage.getItem(_SESSION_ID);
        await _authCall({ action: 'logout', token, sessionId });
        localStorage.removeItem(_SESSION_TOKEN);
        localStorage.removeItem(_SESSION_ID);
        localStorage.removeItem('fbr_admin_login_time');
        return { error: null };
    },

    // ── Sign up (only for Supabase; Appwrite uses pre-created accounts) ──
    signUp: async function({ email, password }) {
        // For Appwrite we try login directly (admin accounts are pre-created)
        // For Supabase we delegate to the proxy as well
        return { data: null, error: { message: 'Please use Email + Password login. Admin accounts are pre-configured.' } };
    },

    // ── OAuth (Google etc.) — not supported in Appwrite mode ──
    signInWithOAuth: async function({ provider }) {
        return { data: null, error: { message: `OAuth (${provider}) is only available with Supabase. Use Email + Password login.` } };
    },

    // ── Web3 — not cross-provider ─────────────────────────────
    signInWithWeb3: async function() {
        return { data: null, error: { message: 'Web3 login is only available with Supabase. Use Email + Password login.' } };
    },
};

// ─────────────────────────────────────────────────────────────
// GLOBAL MasterDB OBJECT
// ─────────────────────────────────────────────────────────────
window.MasterDB = {
    from: function(table) {
        return new MasterDBQueryBuilder(table);
    },
    auth: MasterDBAuth,
};
