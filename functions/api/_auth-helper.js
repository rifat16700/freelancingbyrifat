// ─────────────────────────────────────────────
// _auth-helper.js  —  Shared Auth Utilities
// HMAC-based tokens (no KV write on login)
// ─────────────────────────────────────────────

export const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function ok(data, status = 200) {
    return new Response(JSON.stringify({ success: true, ...data }), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}

export function err(message, status = 400) {
    return new Response(JSON.stringify({ success: false, error: message }), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}

export function cors() {
    return new Response(null, { status: 204, headers: CORS });
}

// ── HMAC Token (no KV write needed for sessions) ──
// Format: base64(payload).base64(hmac_signature)
// Verified purely by signature — stateless!

export async function signToken(payload, secret) {
    const data = btoa(JSON.stringify(payload));
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
    return `${data}.${sigB64}`;
}

export async function verifyToken(token, secret) {
    try {
        if (!token || typeof token !== 'string') return null;
        const parts = token.trim().split('.');
        let data, bodyB64, sigB64;
        if (parts.length === 2) {
            [data, sigB64] = parts;
            bodyB64 = data;
        } else if (parts.length === 3) {
            data = `${parts[0]}.${parts[1]}`;
            bodyB64 = parts[1];
            sigB64 = parts[2];
        } else {
            return null;
        }
        if (!data || !sigB64) return null;

        const key = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );
        let stdB64 = sigB64.replace(/-/g, '+').replace(/_/g, '/');
        while (stdB64.length % 4) stdB64 += '=';
        const sig = Uint8Array.from(atob(stdB64), c => c.charCodeAt(0));
        const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(data));
        if (!valid) return null;

        let bodyStd = bodyB64.replace(/-/g, '+').replace(/_/g, '/');
        while (bodyStd.length % 4) bodyStd += '=';
        const payload = JSON.parse(atob(bodyStd));
        // Check expiry
        if (payload.exp && Date.now() > payload.exp) return null;
        return payload;
    } catch {
        return null;
    }
}

export async function verifyAdminRequest(request, env, body = null) {
    const authHeader = request.headers.get('Authorization') || request.headers.get('X-Admin-Token') || '';
    let token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
    if (!token && body && typeof body === 'object' && body._token) {
        token = String(body._token).trim();
    }
    if (!token) return null;
    const secret = (env && (env.ADMIN_SECRET_TOKEN || env.JWT_SECRET)) || 'fbr-secure-ecommerce-secret-key-2026';
    return await verifyToken(token, secret);
}

// ── Password Hash (PBKDF2 — no bcrypt needed, Web Crypto built-in) ──
export async function hashPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    const key = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(password),
        { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        key, 256
    );
    const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password, stored) {
    const [saltHex, storedHash] = stored.split(':');
    if (!saltHex || !storedHash) return false;
    const salt = Uint8Array.from(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
    const key = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(password),
        { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        key, 256
    );
    const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === storedHash;
}

// ── OTP Generator ──
export function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Extract Bearer Token ──
export function getBearerToken(request) {
    const auth = request.headers.get('Authorization') || '';
    return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

// ── Token TTL constants ──
export const TTL = {
    USER_TOKEN:  7 * 24 * 60 * 60 * 1000,  // 7 days
    MOD_TOKEN:   24 * 60 * 60 * 1000,       // 1 day
    OTP:         10 * 60,                    // 10 min (KV TTL in seconds)
};
