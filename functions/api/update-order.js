// ─────────────────────────────────────────────
// functions/api/update-order.js
// POST /api/update-order
//
// Order status update + instant email notification
// Email via Cloudflare Email Workers (no 3rd party)
// ─────────────────────────────────────────────
import { sendEmail, buildStatusUpdateEmail, buildOrderConfirmEmail } from './_email-helper.js';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const { id, status, payment_status, payment_trx_id } = body;

        if (!id) {
            return new Response(JSON.stringify({ success: false, error: 'order id দিন' }), {
                status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        // ── Build update query (only provided fields) ──
        const updates = [];
        const params  = [];

        if (status         !== undefined) { updates.push('status=?');          params.push(status); }
        if (payment_status !== undefined) { updates.push('payment_status=?');  params.push(payment_status); }
        if (payment_trx_id !== undefined) { updates.push('payment_trx_id=?'); params.push(payment_trx_id); }

        // removed updated_at=CURRENT_TIMESTAMP since column doesn't exist
        params.push(id);

        await env.DB.prepare(
            `UPDATE orders SET ${updates.join(', ')} WHERE id=?`
        ).bind(...params).run();

        // ── Send status email (non-blocking, fire-and-forget) ──
        if (status && env.EMAIL) {
            context.waitUntil(
                sendStatusEmail(env, id, status, request.url)
            );
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }
}

// ── Fetch order + send email (non-blocking via waitUntil) ──
async function sendStatusEmail(env, orderId, status, reqUrl) {
    try {
        // Only send emails for meaningful status changes
        const EMAIL_STATUSES = ['Confirmed', 'Shipped', 'Delivered', 'Cancelled'];
        if (!EMAIL_STATUSES.includes(status)) return;

        // Fetch order details
        const { results } = await env.DB.prepare(
            `SELECT customer_name, customer_email, id FROM orders WHERE id=? LIMIT 1`
        ).bind(orderId).all();

        const order = results?.[0];
        if (!order?.customer_email) return; // কোনো email নেই — skip

        // ── Fetch store_name from DB and origin from URL ──
        const dbSettings = await env.DB.prepare("SELECT store_name FROM settings WHERE id = 1").first();
        const storeName  = dbSettings?.store_name || 'Smiee Shop';
        
        let storeUrl = '';
        try { storeUrl = new URL(reqUrl).origin; } catch(e) {}

        await sendEmail(env, {
            to:      order.customer_email,
            toName:  order.customer_name || '',
            subject: `📦 অর্ডার আপডেট — #${orderId}`,
            html:    buildStatusUpdateEmail({
                name:      order.customer_name,
                orderId,
                status,
                storeUrl,
                storeName,
            }),
            storeName: storeName
        });
    } catch (e) {
        // Email fail হলেও order update succeed করেছে — log only
        console.error('Status email failed:', e.message);
    }
}
