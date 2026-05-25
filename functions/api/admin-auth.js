// ============================================================
// functions/api/admin-auth.js
// Cloudflare Pages Function — Admin Authentication
// Credentials stored in Cloudflare ENV (works with any DB)
//
// Required ENV variables:
//   ADMIN_EMAIL    = admin email address
//   ADMIN_PASSWORD = admin password (plain text — Cloudflare encrypts env)
//   ADMIN_SECRET   = any random long string for token signing
// ============================================================

const CORS = {
    'Content-Type':                 'application/json',
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export async function onRequest(context) {
    const { request } = context;

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== 'POST') {
        return respond({ error: 'Method not allowed' }, 405);
    }

    const env = context.env;

    // ── Read ENV ─────────────────────────────────────────────
    const ADMIN_EMAIL    = (env.ADMIN_EMAIL    || '').trim().toLowerCase();
    const ADMIN_PASSWORD = (env.ADMIN_PASSWORD || '').trim();
    const ADMIN_SECRET   = (env.ADMIN_SECRET   || 'fbr-default-secret-change-me').trim();

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
        return respond({ error: 'Admin credentials not configured in Cloudflare ENV.' }, 500);
    }

    let body;
    try { body = await request.json(); }
    catch { return respond({ error: 'Invalid JSON body' }, 400); }

    const action = body.action;

    // ── LOGIN ─────────────────────────────────────────────────
    if (action === 'login') {
        const email    = (body.email    || '').trim().toLowerCase();
        const password = (body.password || '').trim();

        if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
            return respond({ error: 'Invalid email or password.' }, 401);
        }

        // Generate a signed token: base64(payload).base64(hmac)
        const token = await makeToken(ADMIN_EMAIL, ADMIN_SECRET);
        return respond({ ok: true, token, user: { email: ADMIN_EMAIL } });
    }

    // ── CHECK SESSION ─────────────────────────────────────────
    if (action === 'check') {
        const token = body.token || '';
        if (!token) return respond({ ok: false });

        const valid = await verifyToken(token, ADMIN_SECRET);
        if (!valid) return respond({ ok: false });

        return respond({ ok: true, user: { email: ADMIN_EMAIL } });
    }

    // ── LOGOUT ────────────────────────────────────────────────
    if (action === 'logout') {
        // Stateless tokens — just tell client to clear storage
        return respond({ ok: true });
    }

    return respond({ error: `Unknown action: ${action}` }, 400);
}

// ─────────────────────────────────────────────────────────────
// Token helpers — HMAC-SHA256 signed, expires in 24 hours
// ─────────────────────────────────────────────────────────────
async function makeToken(email, secret) {
    const payload = JSON.stringify({ email, exp: Date.now() + 86400000 }); // 24h
    const sig     = await hmac(payload, secret);
    return btoa(payload) + '.' + sig;
}

async function verifyToken(token, secret) {
    try {
        const [b64, sig] = token.split('.');
        if (!b64 || !sig) return false;

        const payload = atob(b64);
        const data    = JSON.parse(payload);

        if (Date.now() > data.exp) return false;   // expired

        const expected = await hmac(payload, secret);
        return sig === expected;
    } catch {
        return false;
    }
}

async function hmac(message, secret) {
    const enc    = new TextEncoder();
    const key    = await crypto.subtle.importKey(
        'raw', enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false, ['sign']
    );
    const sig    = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function respond(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: CORS });
}
