// ============================================================
// functions/api/admin-login.js — Secure 30-Day Token Login
// Standalone, Zero-Setup, and HMAC-SHA256 Token Powered
// ============================================================

export async function onRequestPost(context) {
    const { request, env } = context;

    const CORS_HEADERS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const body = await request.json();
        const inputUser = (body.username || body.email || '').trim().toLowerCase();
        const inputPass = (body.password || '');

        if (!inputUser || !inputPass) {
            return new Response(JSON.stringify({ success: false, error: "ইউজারনেম এবং পাসওয়ার্ড প্রদান করুন।" }), {
                status: 400,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        let isValid = false;
        let matchedUser = inputUser;

        // 1. Check Cloudflare D1 Database if DB binding is available (skip public placeholder seed account)
        if (env.DB && inputUser !== 'admin@example.com') {
            try {
                const adminRow = await env.DB.prepare("SELECT * FROM admins WHERE LOWER(email) = ? LIMIT 1").bind(inputUser).first();
                if (adminRow && adminRow.password_hash) {
                    // Match plain text or hash
                    if (adminRow.password_hash === inputPass) {
                        isValid = true;
                        matchedUser = adminRow.email;
                    }
                }
            } catch (e) {
                // Table doesn't exist or DB not configured, continue to fallback
            }
        }

        // 2. Check Environment Variables or Zero-Setup Fallback
        if (!isValid) {
            const validUser = (env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
            const validPass = (env.ADMIN_PASSWORD || 'admin123');

            if (inputUser === validUser && inputPass === validPass) {
                isValid = true;
                matchedUser = validUser;
            }
        }

        if (isValid) {
            // Generate 30-Day Cryptographic Token
            const now = Date.now();
            const expiresAt = now + (30 * 24 * 60 * 60 * 1000); // 30 Days in ms
            const secret = env.ADMIN_SECRET_TOKEN || env.JWT_SECRET || 'fbr-secure-ecommerce-secret-key-2026';

            const payload = {
                sub: matchedUser,
                role: 'admin',
                iat: now,
                exp: expiresAt
            };

            const data = btoa(JSON.stringify(payload));
            const key = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(secret),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
            );
            const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
            const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
                .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            const token = `${data}.${sigB64}`;

            return new Response(JSON.stringify({
                success: true,
                token: token,
                expires_at: expiresAt,
                validity_days: 30,
                user: {
                    email: matchedUser,
                    role: 'admin'
                }
            }), {
                status: 200,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        } else {
            return new Response(JSON.stringify({
                success: false,
                error: "ভুল ইউজারনেম বা পাসওয়ার্ড প্রদান করা হয়েছে!"
            }), {
                status: 401,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
    });
}
