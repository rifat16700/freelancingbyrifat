// ============================================================
// assets/js/master-db.js  —  Database & Auth Layer
// Project: Freelancing By Rifat E-Commerce
// ============================================================
//
// ✅ বর্তমান DB: Supabase (PostgREST API + Supabase Auth)
//    সরাসরি Supabase এ connect করে — কোনো proxy নেই।
//
// ── ভবিষ্যতে Multi-DB যোগ করতে চাইলে ─────────────────────
//   👉 নিচে [MULTI-DB PLACEHOLDER] মার্ক করা জায়গাগুলোতে
//      অন্য DB এর connection logic বসাতে হবে।
//   👉 CONFIG তে DB_PROVIDER variable যোগ করে সেখান থেকে
//      কোন DB use করবে সেটা decide করা যাবে।
// ============================================================


// ─────────────────────────────────────────────────────────────
// [MULTI-DB PLACEHOLDER]
// ভবিষ্যতে এখানে DB_PROVIDER check বসবে:
//   if (CONFIG.DB_PROVIDER === 'appwrite') { ... }
//   else { ... supabase ... }
// ─────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────
// SUPABASE HELPERS
// ─────────────────────────────────────────────────────────────

function _getSupabaseHeaders(isAdmin) {
    var token = localStorage.getItem('fbr_admin_token');
    var headers = {
        'apikey':        CONFIG.SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + (token || CONFIG.SUPABASE_ANON_KEY),
        'Content-Type':  'application/json',
        'Accept':        'application/json',
    };
    if (isAdmin) {
        // ── [MULTI-DB PLACEHOLDER] ──────────────────────────
        // Appwrite এর জন্য X-Appwrite-Key header যোগ হবে এখানে
        // ────────────────────────────────────────────────────
        headers['Authorization'] = 'Bearer ' + (token || CONFIG.SUPABASE_ANON_KEY);
    }
    return headers;
}

function _supabaseUrl(table) {
    // ── [MULTI-DB PLACEHOLDER] ──────────────────────────────
    // Appwrite এর জন্য:
    //   return `${CONFIG.APPWRITE_ENDPOINT}/databases/${DB_ID}/collections/${table}/documents`;
    // ────────────────────────────────────────────────────────
    return CONFIG.SUPABASE_URL + '/rest/v1/' + table;
}


// ─────────────────────────────────────────────────────────────
// QUERY BUILDER
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

    select(cols, opts) {
        cols = cols || '*';
        opts = opts || {};
        this.action     = 'select';
        this.selectCols = cols;
        if (opts.head)  this.headFlag  = true;
        if (opts.count) this.countType = opts.count;
        return this;
    }

    insert(data) { this.action = 'insert'; this.payloadData = data; return this; }
    update(data) { this.action = 'update'; this.payloadData = data; return this; }
    upsert(data, opts) { this.action = 'upsert'; this.payloadData = data; this.upsertOpts = opts || {}; return this; }
    delete()     { this.action = 'delete'; return this; }

    eq(col, val)   { this.filters.push({ method: 'eq',   col: col, val: val }); return this; }
    neq(col, val)  { this.filters.push({ method: 'neq',  col: col, val: val }); return this; }
    lt(col, val)   { this.filters.push({ method: 'lt',   col: col, val: val }); return this; }
    lte(col, val)  { this.filters.push({ method: 'lte',  col: col, val: val }); return this; }
    gt(col, val)   { this.filters.push({ method: 'gt',   col: col, val: val }); return this; }
    gte(col, val)  { this.filters.push({ method: 'gte',  col: col, val: val }); return this; }
    like(col, val) { this.filters.push({ method: 'like', col: col, val: val }); return this; }
    in(col, vals)  { this.filters.push({ method: 'in',   col: col, val: vals }); return this; }

    order(col, opts) {
        opts = opts || {};
        this.orderObj = { col: col, ascending: opts.ascending !== false };
        return this;
    }
    limit(n)        { this.limitNum = n; return this; }
    range(from, to) { this.rangeArr = [from, to]; return this; }
    single()        { this.isSingle = true; return this; }
    maybeSingle()   { this.isSingle = true; return this; }

    then(onFulfilled, onRejected) {
        return this.execute().then(onFulfilled, onRejected);
    }

    async execute() {
        // ── [MULTI-DB PLACEHOLDER] ──────────────────────────
        // এখানে DB_PROVIDER check করে আলাদা execute function
        // call করা যাবে:
        //   if (CONFIG.DB_PROVIDER === 'appwrite') return this._executeAppwrite();
        // ────────────────────────────────────────────────────
        return this._executeSupabase();
    }

    async _executeSupabase() {
        var baseUrl = _supabaseUrl(this.table);
        var headers = _getSupabaseHeaders(true);
        var prefer  = [];

        // ── SELECT ──────────────────────────────────────────
        if (this.action === 'select' || this.headFlag) {
            var params = new URLSearchParams();
            params.append('select', this.selectCols);

            this.filters.forEach(function(f) {
                if (f.method === 'in') {
                    var list = Array.isArray(f.val) ? f.val.join(',') : f.val;
                    params.append(f.col, 'in.(' + list + ')');
                } else {
                    params.append(f.col, f.method + '.' + f.val);
                }
            });

            if (this.orderObj) {
                params.append('order', this.orderObj.col + '.' + (this.orderObj.ascending ? 'asc' : 'desc'));
            }
            if (this.rangeArr) {
                params.append('offset', this.rangeArr[0]);
                params.append('limit',  this.rangeArr[1] - this.rangeArr[0] + 1);
            } else if (this.limitNum) {
                params.append('limit', this.limitNum);
            }
            if (this.isSingle) {
                headers['Accept'] = 'application/vnd.pgrst.object+json';
            }
            if (this.countType) prefer.push('count=' + this.countType);
            if (this.headFlag)  prefer.push('count=' + (this.countType || 'exact'));
            if (prefer.length)  headers['Prefer'] = prefer.join(',');

            var method = this.headFlag ? 'HEAD' : 'GET';
            var url    = baseUrl + '?' + params.toString();

            try {
                var res = await fetch(url, { method: method, headers: headers });
                var count = null;
                var cr = res.headers.get('Content-Range');
                if (cr) {
                    var parts = cr.split('/');
                    if (parts[1] && parts[1] !== '*') count = parseInt(parts[1]);
                }
                if (this.headFlag) return { data: null, error: null, count: count };
                if (!res.ok) {
                    var e = await res.json();
                    return { data: null, error: { message: e.message || e.hint || 'Fetch failed' }, count: null };
                }
                var data = await res.json();
                return { data: data, error: null, count: count };
            } catch (err) {
                return { data: null, error: { message: err.message }, count: null };
            }
        }

        // ── INSERT ──────────────────────────────────────────
        if (this.action === 'insert') {
            prefer.push('return=representation');
            headers['Prefer'] = prefer.join(',');
            try {
                var body = Array.isArray(this.payloadData) ? this.payloadData : [this.payloadData];
                var res  = await fetch(baseUrl, { method: 'POST', headers: headers, body: JSON.stringify(body) });
                if (!res.ok) {
                    var e = await res.json();
                    return { data: null, error: { message: e.message || e.hint || 'Insert failed' } };
                }
                var data = await res.json();
                return { data: data, error: null };
            } catch (err) {
                return { data: null, error: { message: err.message } };
            }
        }

        // ── UPDATE ──────────────────────────────────────────
        if (this.action === 'update') {
            prefer.push('return=representation');
            headers['Prefer'] = prefer.join(',');
            var params = new URLSearchParams();
            this.filters.forEach(function(f) {
                params.append(f.col, f.method + '.' + f.val);
            });
            var url = baseUrl + (params.toString() ? '?' + params.toString() : '');
            try {
                var res = await fetch(url, { method: 'PATCH', headers: headers, body: JSON.stringify(this.payloadData) });
                if (!res.ok) {
                    var e = await res.json();
                    return { data: null, error: { message: e.message || e.hint || 'Update failed' } };
                }
                var data = await res.json();
                return { data: data, error: null };
            } catch (err) {
                return { data: null, error: { message: err.message } };
            }
        }

        // ── UPSERT ──────────────────────────────────────────
        if (this.action === 'upsert') {
            prefer.push('return=representation');
            prefer.push('resolution=merge-duplicates');
            headers['Prefer'] = prefer.join(',');
            try {
                var body = Array.isArray(this.payloadData) ? this.payloadData : [this.payloadData];
                var res  = await fetch(baseUrl, { method: 'POST', headers: headers, body: JSON.stringify(body) });
                if (!res.ok) {
                    var e = await res.json();
                    return { data: null, error: { message: e.message || e.hint || 'Upsert failed' } };
                }
                var data = await res.json();
                return { data: data, error: null };
            } catch (err) {
                return { data: null, error: { message: err.message } };
            }
        }

        // ── DELETE ──────────────────────────────────────────
        if (this.action === 'delete') {
            var params = new URLSearchParams();
            this.filters.forEach(function(f) {
                params.append(f.col, f.method + '.' + f.val);
            });
            var url = baseUrl + (params.toString() ? '?' + params.toString() : '');
            try {
                var res = await fetch(url, { method: 'DELETE', headers: headers });
                if (!res.ok && res.status !== 404) {
                    var e = await res.json();
                    return { data: null, error: { message: e.message || 'Delete failed' } };
                }
                return { data: [], error: null };
            } catch (err) {
                return { data: null, error: { message: err.message } };
            }
        }

        return { data: null, error: { message: 'Unknown action: ' + this.action } };
    }
}


// ─────────────────────────────────────────────────────────────
// AUTH — Supabase Auth API (Direct)
// ─────────────────────────────────────────────────────────────

var MasterDBAuth = {

    signInWithPassword: async function(opts) {
        // ── [MULTI-DB PLACEHOLDER] ──────────────────────────
        // Appwrite এর জন্য:
        //   POST /v1/account/sessions/email
        //   { email, password }
        // ────────────────────────────────────────────────────
        try {
            var res = await fetch(CONFIG.SUPABASE_URL + '/auth/v1/token?grant_type=password', {
                method:  'POST',
                headers: {
                    'apikey':       CONFIG.SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: opts.email, password: opts.password }),
            });
            var json = await res.json();
            if (!res.ok || json.error) {
                return { data: null, error: { message: json.error_description || json.message || 'Login failed' } };
            }
            localStorage.setItem('fbr_admin_token',      json.access_token);
            localStorage.setItem('fbr_admin_login_time', Date.now().toString());
            localStorage.setItem('fbr_admin_email',      opts.email);
            return { data: { session: json, user: json.user }, error: null };
        } catch (err) {
            return { data: null, error: { message: err.message } };
        }
    },

    getSession: async function() {
        var token     = localStorage.getItem('fbr_admin_token');
        var loginTime = parseInt(localStorage.getItem('fbr_admin_login_time') || '0', 10);
        if (!token) return { data: { session: null }, error: null };

        var SESSION_TTL = 24 * 60 * 60 * 1000; // 24 ঘন্টা
        if (Date.now() - loginTime > SESSION_TTL) {
            localStorage.removeItem('fbr_admin_token');
            localStorage.removeItem('fbr_admin_login_time');
            return { data: { session: null }, error: null };
        }
        return { data: { session: { access_token: token }, user: {} }, error: null };
    },

    signOut: async function() {
        var token = localStorage.getItem('fbr_admin_token');
        if (token) {
            try {
                await fetch(CONFIG.SUPABASE_URL + '/auth/v1/logout', {
                    method:  'POST',
                    headers: {
                        'apikey':        CONFIG.SUPABASE_ANON_KEY,
                        'Authorization': 'Bearer ' + token,
                        'Content-Type':  'application/json',
                    },
                });
            } catch (_) {}
        }
        localStorage.removeItem('fbr_admin_token');
        localStorage.removeItem('fbr_admin_session_id');
        localStorage.removeItem('fbr_admin_login_time');
        localStorage.removeItem('fbr_admin_email');
        return { error: null };
    },

    signUp: async function() {
        return { data: null, error: { message: 'Admin accounts are pre-configured. Use Email + Password login.' } };
    },

    signInWithOAuth: async function(opts) {
        return { data: null, error: { message: 'OAuth login is not configured.' } };
    },
};


// ─────────────────────────────────────────────────────────────
// GLOBAL MasterDB OBJECT
// ─────────────────────────────────────────────────────────────

window.MasterDB = {
    from: function(table) { return new MasterDBQueryBuilder(table); },
    auth: MasterDBAuth,
};
