// ─────────────────────────────────────────────
// functions/api/user/update.js
// POST /api/user/update
// KV read/write: 1/1
// ─────────────────────────────────────────────
import { ok, err, cors, verifyToken, getBearerToken } from '../_auth-helper.js';

export const onRequestOptions = () => cors();

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const token = getBearerToken(request);
        if (!token) return err('Token দিন', 401);

        const payload = await verifyToken(token, env.JWT_SECRET || 'fallback-secret-change-this');
        if (!payload) return err('Token invalid বা মেয়াদ শেষ', 401);

        const body = await request.json();
        
        // ── Get existing user ──
        const key = `user:${payload.email}`;
        const raw = await env.USERS_KV.get(key);
        if (!raw) return err('Account পাওয়া যায়নি', 404);

        let user = JSON.parse(raw);

        // Update fields (only allowed fields)
        if (body.address) user.address = body.address;
        
        // Manage order history in KV (last 10)
        if (body.recent_orders && Array.isArray(body.recent_orders)) {
            user.recent_orders = body.recent_orders.slice(0, 10);
        }

        // ── 1 KV write ──
        await env.USERS_KV.put(key, JSON.stringify(user));

        // Remove sensitive data before returning
        const { password_hash, ...profile } = user;
        return ok({ message: 'Profile updated', user: profile });
    } catch (e) {
        return err(e.message, 500);
    }
}
