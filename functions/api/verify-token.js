import { verifyAdminRequest } from './_auth-helper.js';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
};

export async function onRequestPost(context) {
    const { request, env } = context;
    try {
        let body = null;
        try { body = await request.json(); } catch {}
        const verified = await verifyAdminRequest(request, env, body);
        if (!verified) {
            return new Response(JSON.stringify({ success: false, valid: false, error: 'Token invalid or expired' }), {
                status: 401,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
            });
        }
        return new Response(JSON.stringify({ success: true, valid: true, user: verified }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, valid: false, error: error.message }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }
}

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}
