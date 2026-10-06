/**
 * cf-db.js — Cloudflare D1 API Helper
 *
 * DB_PROVIDER === 'cf_db' হলে এই helper ব্যবহার করো।
 * Vercel Serverless API (/api/cf/[table]) এর wrapper।
 *
 * Usage:
 *   cfDb.list('orders')                          → GET /api/cf/orders
 *   cfDb.list('orders', { filter: { status: 'Pending' } })
 *   cfDb.get('orders', id)                       → GET /api/cf/orders?id=xxx
 *   cfDb.insert('orders', payload)               → POST /api/cf/orders
 *   cfDb.update('orders', id, payload)           → PATCH /api/cf/orders?id=xxx
 *   cfDb.remove('orders', id)                    → DELETE /api/cf/orders?id=xxx
 */

(function() {
    'use strict';

    function getBaseUrl() {
        var base = (typeof CONFIG !== 'undefined' && CONFIG.CF_WORKER_URL) ? CONFIG.CF_WORKER_URL : '';
        return base.replace(/\/$/, ''); // trailing slash remove
    }

    /**
     * Internal fetch wrapper
     * @param {string} table
     * @param {string} method
     * @param {object|null} body
     * @param {URLSearchParams} qs
     */
    function cfFetch(table, method, body, qs) {
        var base = getBaseUrl();
        var url  = base + '/api/cf/' + table;
        if (qs && qs.toString()) url += '?' + qs.toString();

        var opts = {
            method: method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (body) opts.body = JSON.stringify(body);

        return fetch(url, opts)
            .then(function(r) { return r.json(); })
            .then(function(json) {
                if (!json.success) throw new Error(json.error || 'CF DB error');
                return json;
            });
    }

    /**
     * List rows from a table.
     * @param {string} table
     * @param {object} [opts]
     * @param {object} [opts.filter]   - { column: value } pairs → WHERE column = value
     * @param {string} [opts.order]    - column to ORDER BY DESC (default: created_at)
     * @param {number} [opts.limit]    - LIMIT (default: 5000)
     * @param {string} [opts.select]   - columns to select (default: *)
     * @returns {Promise<Array>}
     */
    function list(table, opts) {
        opts = opts || {};
        var qs = new URLSearchParams();
        if (opts.order)  qs.set('order', opts.order);
        if (opts.limit)  qs.set('limit', opts.limit);
        if (opts.select) qs.set('select', opts.select);
        if (opts.filter) {
            Object.keys(opts.filter).forEach(function(col) {
                qs.set('filter[' + col + ']', opts.filter[col]);
            });
        }
        return cfFetch(table, 'GET', null, qs)
            .then(function(json) { return json.data || []; });
    }

    /**
     * Get a single row by ID.
     * @param {string} table
     * @param {string} id
     * @returns {Promise<object>}
     */
    function get(table, id) {
        var qs = new URLSearchParams({ id: id });
        return cfFetch(table, 'GET', null, qs)
            .then(function(json) { return json.data; });
    }

    /**
     * Insert a new row.
     * @param {string} table
     * @param {object} payload
     * @returns {Promise<{success: boolean, id: string}>}
     */
    function insert(table, payload) {
        return cfFetch(table, 'POST', payload, null);
    }

    /**
     * Update an existing row.
     * @param {string} table
     * @param {string} id
     * @param {object} payload
     * @returns {Promise<{success: boolean}>}
     */
    function update(table, id, payload) {
        var qs = new URLSearchParams({ id: id });
        return cfFetch(table, 'PATCH', payload, qs);
    }

    /**
     * Delete a row by ID.
     * @param {string} table
     * @param {string} id
     * @returns {Promise<{success: boolean}>}
     */
    function remove(table, id) {
        var qs = new URLSearchParams({ id: id });
        return cfFetch(table, 'DELETE', null, qs);
    }

    // Expose globally
    window.cfDb = {
        list:   list,
        get:    get,
        insert: insert,
        update: update,
        remove: remove,
    };

    window.showSchemaModal = function(errStr) {
        if (document.getElementById('schemaModal')) return;
        errStr = errStr || '';
        var tableName = null;
        var m1 = errStr.match(/no such table:\s*(\w+)/i);
        if (m1) tableName = m1[1];
        else {
            var m2 = errStr.match(/table\s+(\w+)\s+has no column/i);
            if (m2) tableName = m2[1];
        }

        var schemas = {
            products: "CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, base_price REAL DEFAULT 0, flash_sale_price REAL DEFAULT 0, flash_sale_end TEXT, variants TEXT DEFAULT '[]', gallery_images TEXT DEFAULT '[]', video_url TEXT, video_type TEXT DEFAULT 'auto', sku TEXT, is_active INTEGER DEFAULT 1, is_featured INTEGER DEFAULT 0, is_add_once INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);",
            categories: "CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, icon_url TEXT, sort_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);",
            product_categories: "CREATE TABLE product_categories (product_id TEXT, category_id TEXT, PRIMARY KEY (product_id, category_id));",
            orders: "CREATE TABLE orders (id TEXT PRIMARY KEY, customer_name TEXT, customer_phone TEXT, customer_address TEXT, cart_total REAL, delivery_charge REAL, discount REAL, final_total REAL, status TEXT DEFAULT 'pending', items TEXT DEFAULT '[]', promo_code TEXT, transaction_id TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);",
            addons: "CREATE TABLE addons (id TEXT PRIMARY KEY, name TEXT NOT NULL, price REAL DEFAULT 0, image TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);",
            promos: "CREATE TABLE promos (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, type TEXT DEFAULT 'public', discount REAL DEFAULT 0, disc_type TEXT DEFAULT 'flat', disc_val REAL DEFAULT 0, max_cap REAL, min_spend REAL, del_reward TEXT DEFAULT 'none', del_disc_amount REAL, del_disc_cap REAL, applicable_products TEXT DEFAULT '[]', applicable_categories TEXT DEFAULT '[]', applicable_districts TEXT DEFAULT '[]', applicable_payments TEXT DEFAULT '[]', is_active INTEGER DEFAULT 1, usage_limit INTEGER, expires_at TEXT, is_repeated_config INTEGER DEFAULT 0, rep_type TEXT DEFAULT 'flat', rep_value REAL, rep_cap REAL, rep_expiry_days INTEGER, rep_min_spend REAL, rep_del_reward TEXT DEFAULT 'none', created_at TEXT DEFAULT CURRENT_TIMESTAMP);",
            reviews: "CREATE TABLE reviews (id TEXT PRIMARY KEY, product_id TEXT NOT NULL, customer_name TEXT, customer_phone TEXT, rating INTEGER DEFAULT 5, review_text TEXT, review_image TEXT, is_approved INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);",
            admins: "CREATE TABLE admins (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);\nINSERT INTO admins (id, email, password_hash) VALUES ('admin_1', 'admin@example.com', 'admin123');",
            delivery_zones: "CREATE TABLE delivery_zones (id TEXT PRIMARY KEY, zone_name TEXT NOT NULL, charge REAL DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);",
            settings: "CREATE TABLE settings (id INTEGER PRIMARY KEY DEFAULT 1, store_name TEXT DEFAULT '', logo_url TEXT DEFAULT '', favicon_url TEXT DEFAULT '', footer_text TEXT DEFAULT '', whatsapp_number TEXT DEFAULT '', facebook_url TEXT DEFAULT '', instagram_url TEXT DEFAULT '', youtube_url TEXT DEFAULT '', bkash_number TEXT DEFAULT '', nagad_number TEXT DEFAULT '', binance_manual_uid TEXT DEFAULT '', gateway_api_key TEXT DEFAULT '', gateway_api_key_v2 TEXT DEFAULT '', gateway_version TEXT DEFAULT '', allow_cod INTEGER DEFAULT 1, enable_fun_checkbox INTEGER DEFAULT 1, allow_whatsapp_order INTEGER DEFAULT 1, allow_msg_order INTEGER DEFAULT 1, advance_amount REAL DEFAULT 0, advance_method TEXT DEFAULT '', telegram_main_bot TEXT DEFAULT '', telegram_main_chats TEXT DEFAULT '', telegram_draft_bot TEXT DEFAULT '', telegram_draft_chat TEXT DEFAULT '', messaging_apps TEXT DEFAULT '[]', allow_pickup INTEGER DEFAULT 0, store_address TEXT DEFAULT '', store_map_link TEXT DEFAULT '', pickup_bot_token TEXT DEFAULT '', pickup_chat_id TEXT DEFAULT '', binance_pay_uid TEXT DEFAULT '', binance_proxy_url TEXT DEFAULT '', binance_api_key TEXT DEFAULT '', binance_api_secret TEXT DEFAULT '', usd_to_bdt_rate REAL DEFAULT 120, verify_mode TEXT DEFAULT '', supabase_edge_url TEXT DEFAULT '', hf_api_url TEXT DEFAULT '', crypto_coins TEXT DEFAULT '[]', review_imgbb_key TEXT DEFAULT '', maintenance_mode INTEGER DEFAULT 0, maintenance_message TEXT DEFAULT '', currency TEXT DEFAULT '৳');\nINSERT INTO settings (id, store_name, currency) VALUES (1, 'Freelancing By Rifat', '৳');",
            home_sections: "CREATE TABLE home_sections (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL, data TEXT, display_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);",
            devtools: "CREATE TABLE devtools (id TEXT PRIMARY KEY, key_name TEXT UNIQUE NOT NULL, value TEXT);",
            verified_payments: "CREATE TABLE verified_payments (id TEXT PRIMARY KEY, transaction_id TEXT UNIQUE NOT NULL, amount REAL, sender_number TEXT, status TEXT DEFAULT 'verified', created_at TEXT DEFAULT CURRENT_TIMESTAMP);",
            banners: "CREATE TABLE banners (id TEXT PRIMARY KEY, image_url TEXT NOT NULL, link_url TEXT, is_active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);"
        };

        var sql = '';
        var msg = '';
        if (tableName && schemas[tableName]) {
            sql = "DROP TABLE IF EXISTS " + tableName + ";\n" + schemas[tableName];
            msg = 'It looks like your D1 Database table "<b>' + tableName + '</b>" is empty or missing columns. Please copy the SQL code below, go to your Cloudflare Dashboard -> D1 -> Console, paste it, and run it to fix this table.';
        } else {
            // Fallback to all
            for (var k in schemas) { sql += "DROP TABLE IF EXISTS " + k + ";\n"; }
            sql += "\n";
            for (var k in schemas) { sql += schemas[k] + "\n"; }
            msg = 'It looks like your D1 Database is empty or missing columns. Please copy the SQL code below, go to your Cloudflare Dashboard -> D1 -> Console, paste it, and run it to create your tables.';
        }

        var div = document.createElement('div');
        div.id = 'schemaModal';
        div.style = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;';
        div.innerHTML = '<div style="background:#fff;border-radius:12px;width:100%;max-width:700px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 10px 30px rgba(0,0,0,0.5);">' +
            '<div style="padding:20px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">' +
                '<h2 style="margin:0;color:#e74c3c;font-size:20px;"><i data-lucide="alert-circle" style="vertical-align:middle;margin-right:8px;"></i>Database Tables Missing!</h2>' +
                '<button onclick="this.closest(\'#schemaModal\').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999;">&times;</button>' +
            '</div>' +
            '<div style="padding:20px;overflow-y:auto;flex:1;">' +
                '<p style="margin-top:0;color:#333;font-size:15px;">' + msg + '</p>' +
                '<textarea id="schemaText" style="width:100%;height:250px;font-family:monospace;font-size:13px;padding:15px;border:1px solid #ddd;border-radius:8px;background:#f8f9fa;resize:none;" readonly>' + sql + '</textarea>' +
            '</div>' +
            '<div style="padding:20px;border-top:1px solid #eee;text-align:right;">' +
                '<button onclick="navigator.clipboard.writeText(document.getElementById(\'schemaText\').value);this.textContent=\'Copied!\';setTimeout(()=>this.textContent=\'Copy SQL Schema\',2000);" style="background:#2ecc71;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-weight:bold;cursor:pointer;margin-right:10px;"><i data-lucide="copy" style="width:16px;height:16px;vertical-align:middle;margin-right:5px;"></i>Copy SQL Schema</button>' +
                '<button onclick="this.closest(\'#schemaModal\').remove()" style="background:#eee;color:#333;border:none;padding:10px 20px;border-radius:8px;font-weight:bold;cursor:pointer;">Close</button>' +
            '</div>' +
        '</div>';
        document.body.appendChild(div);
        if(typeof lucide !== 'undefined') lucide.createIcons();
    };

})();
