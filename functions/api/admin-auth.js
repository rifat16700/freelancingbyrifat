// ============================================================
// functions/api/admin-auth.js
// Cloudflare Pages Function — Official Admin Authentication
//
// DB_PROVIDER=supabase → Supabase Auth (email/password)
// DB_PROVIDER=appwrite → Appwrite Auth (email/password)
// ============================================================

import { getConfig } from '../utils/config.js';

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

    const config = getConfig(context.env);

    let body;
    try { body = await request.json(); }
    catch { return respond({ error: 'Invalid JSON body' }, 400); }

    if (config.DB_PROVIDER === 'appwrite') {
        return await appwriteAuth(config, body);
    } else {
        return await supabaseAuth(config, body);
    }
}

// ─────────────────────────────────────────────────────────────
// SUPABASE OFFICIAL AUTH
// Docs: https://supabase.com/docs/reference/api/auth-token
// ─────────────────────────────────────────────────────────────
async function supabaseAuth(config, body) {
    const { action } = body;
    const base = `${config.SUPABASE_URL}/auth/v1`;
    const headers = {
        'apikey':       config.SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
    };

    // ── LOGIN ─────────────────────────────────────────────────
    if (action === 'login') {
        const res = await fetch(`${base}/token?grant_type=password`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                email:    body.email,
                password: body.password,
            }),
        });
        const data = await res.json();

        if (!res.ok) {
            return respond({ error: data.error_description || data.msg || 'Login failed' }, 401);
        }

        // Supabase returns: access_token, refresh_token, user
        return respond({
            ok:           true,
            provider:     'supabase',
            token:        data.access_token,    // JWT — used for DB calls too
            refreshToken: data.refresh_token,
            user:         { email: data.user?.email, id: data.user?.id },
        });
    }

    // ── CHECK SESSION ─────────────────────────────────────────
    if (action === 'check') {
        const token = body.token || '';
        if (!token) return respond({ ok: false });

        const res = await fetch(`${base}/user`, {
            headers: {
                ...headers,
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!res.ok) return respond({ ok: false });

        const user = await res.json();
        return respond({ ok: true, user: { email: user.email, id: user.id } });
    }

    // ── LOGOUT ────────────────────────────────────────────────
    if (action === 'logout') {
        const token = body.token || '';
        if (token) {
            await fetch(`${base}/logout`, {
                method:  'POST',
                headers: { ...headers, 'Authorization': `Bearer ${token}` },
            });
        }
        return respond({ ok: true });
    }

    return respond({ error: `Unknown action: ${action}` }, 400);
}

// ─────────────────────────────────────────────────────────────
// APPWRITE OFFICIAL AUTH
// Docs: https://appwrite.io/docs/references/cloud/client-rest/account
// Note: /account endpoint uses Project ID only (no API key)
//       API key is server-side only (for DB operations)
// ─────────────────────────────────────────────────────────────
async function appwriteAuth(config, body) {
    const { action } = body;
    const base = `${config.APPWRITE_ENDPOINT}/account`;

    // Only X-Appwrite-Project — no API key for user auth
    const headers = {
        'X-Appwrite-Project': config.APPWRITE_PROJECT,
        'Content-Type':       'application/json',
    };

    // ── LOGIN ─────────────────────────────────────────────────
    if (action === 'login') {
        const res = await fetch(`${base}/sessions/email`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                email:    body.email,
                password: body.password,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            return respond({
                error: data.message || 'Login failed',
                hint:  'Make sure user exists in Appwrite Auth → Users',
            }, 401);
        }

        // Appwrite session: $id (session ID) + secret (session token)
        return respond({
            ok:        true,
            provider:  'appwrite',
            token:     data.secret,   // session secret — used to verify
            sessionId: data.$id,      // needed for logout
            user:      { email: body.email },
        });
    }

    // ── CHECK SESSION ─────────────────────────────────────────
    if (action === 'check') {
        const token     = body.token || '';
        const sessionId = body.sessionId || '';
        if (!token) return respond({ ok: false });

        // Verify by fetching the session
        const url = sessionId
            ? `${base}/sessions/${sessionId}`
            : `${base}/sessions/current`;

        const res = await fetch(url, {
            headers: {
                ...headers,
                'X-Appwrite-Session': token,
            },
        });

        if (!res.ok) return respond({ ok: false });

        const session = await res.json();
        return respond({
            ok:   true,
            user: { email: session.providerUid || body.email || '' },
        });
    }

    // ── LOGOUT ────────────────────────────────────────────────
    if (action === 'logout') {
        const token     = body.token || '';
        const sessionId = body.sessionId || 'current';
        if (token) {
            await fetch(`${base}/sessions/${sessionId}`, {
                method:  'DELETE',
                headers: {
                    ...headers,
                    'X-Appwrite-Session': token,
                },
            });
        }
        return respond({ ok: true });
    }

    return respond({ error: `Unknown action: ${action}` }, 400);
}

function respond(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: CORS });
}
