// ============================================================
// functions/api/admin-settings.js
// Admin-only settings update — bypasses RLS using service role key
// POST /api/admin-settings  { token, field, value }
// ============================================================

import { getConfig } from '../utils/config.js';

const CORS = {
    'Content-Type':                 'application/json',
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── HMAC verify (same as admin-auth.js) ──────────────────────
async function verifyHmacToken(token, signingKey) {
    try {
        const [b64, sig] = token.split('.');
        if (!b64 || !sig) return false;
        const payload = atob(b64);
        const data    = JSON.parse(payload);
        if (Date.now() > data.exp) return false;
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw', enc.encode(signingKey),
            { name: 'HMAC', hash: 'SHA-256' },
            false, ['sign']
        );
        const raw      = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
        const expected = btoa(String.fromCharCode(...new Uint8Array(raw)));
        return sig === expected;
    } catch { return false; }
}

// ─────────────────────────────────────────────────────────────
export async function onRequest(context) {
    const { request } = context;
    const config = getConfig(context.env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST')    return respond({ error: 'Method not allowed' }, 405);

    let body;
    try { body = await request.json(); }
    catch { return respond({ error: 'Invalid JSON' }, 400); }

    const { token, field, value } = body;
    if (!token || field === undefined || value === undefined) {
        return respond({ error: 'Missing token, field or value' }, 400);
    }

    // ── Verify admin token ────────────────────────────────────
    const SIGNING_KEY = config.DB_PROVIDER === 'appwrite'
        ? config.APPWRITE_API_KEY
        : config.SUPABASE_ANON_KEY;

    const valid = await verifyHmacToken(token, SIGNING_KEY);
    if (!valid) return respond({ error: 'Unauthorized' }, 401);

    // ── Allowed fields (whitelist for security) ───────────────
    const ALLOWED_FIELDS = [
        'is_maintenance', 'maintenance_message',
        'store_name', 'store_phone', 'store_email',
        'currency', 'advance_amount', 'usd_to_bdt_rate',
        'payment_method', 'bkash_number', 'nagad_number',
        'rocket_number', 'bank_info', 'crypto_address',
    ];
    if (!ALLOWED_FIELDS.includes(field)) {
        return respond({ error: `Field '${field}' not allowed` }, 400);
    }

    try {
        if (config.DB_PROVIDER === 'appwrite') {
            // ── Appwrite: update settings document ───────────
            const url = `${config.APPWRITE_ENDPOINT}/databases/${config.APPWRITE_DATABASE_ID}/collections/settings/documents/main_settings`;
            const res = await fetch(url, {
                method: 'PATCH',
                headers: {
                    'X-Appwrite-Project': config.APPWRITE_PROJECT,
                    'X-Appwrite-Key':     config.APPWRITE_API_KEY,
                    'Content-Type':       'application/json',
                },
                body: JSON.stringify({ data: { [field]: value } }),
            });
            if (!res.ok) {
                const err = await res.text();
                return respond({ error: 'Appwrite update failed', details: err }, 500);
            }
            return respond({ ok: true });

        } else {
            // ── Supabase: use service_role to bypass RLS ──────
            const serviceKey = config.SUPABASE_SERVICE_ROLE_KEY;
            if (!serviceKey) return respond({ error: 'Service role key not set' }, 500);

            const res = await fetch(
                `${config.SUPABASE_URL}/rest/v1/settings?id=eq.1`,
                {
                    method: 'PATCH',
                    headers: {
                        'apikey':        serviceKey,
                        'Authorization': `Bearer ${serviceKey}`,
                        'Content-Type':  'application/json',
                        'Prefer':        'return=minimal',
                    },
                    body: JSON.stringify({ [field]: value }),
                }
            );
            if (!res.ok) {
                const err = await res.text();
                return respond({ error: 'Supabase update failed', details: err }, 500);
            }
            return respond({ ok: true });
        }

    } catch (err) {
        return respond({ error: 'Server error', details: String(err) }, 500);
    }
}

function respond(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: CORS });
}
