import { verifyAdminRequest } from './_auth-helper.js';

export async function onRequestPost(context) {
    const { request, env } = context;

    const CORS_HEADERS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
    };

    try {
        const body = await request.json();
        const adminUser = await verifyAdminRequest(request, env, body);

        const product_id     = String(body.product_id || '').trim();
        const customer_name  = String(body.customer_name || '').trim().slice(0, 120);
        const customer_phone = body.customer_phone ? String(body.customer_phone).trim().slice(0, 40) : null;
        const rating         = Math.max(1, Math.min(5, parseInt(body.rating, 10) || 5));
        const review_text    = body.review_text ? String(body.review_text).trim().slice(0, 2000) : null;
        let review_image     = body.review_image ? String(body.review_image).trim() : null;
        if (review_image && !/^(https?:\/\/|data:image\/)/i.test(review_image)) {
            review_image = null;
        }

        if (!product_id || !customer_name) {
            return new Response(JSON.stringify({ success: false, error: 'Product ID and customer name are required.' }), {
                status: 400,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        // Security lock: public callers can NEVER self-approve reviews (always 0 unless valid Admin token)
        const approvedFlag = (adminUser && body.is_approved) ? 1 : 0;
        const reviewId = crypto.randomUUID();

        const sql = `
            INSERT INTO reviews (
                id, product_id, customer_name, customer_phone, rating, review_text, review_image, is_approved
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            reviewId, product_id, customer_name, customer_phone, rating, review_text, review_image, approvedFlag
        ];

        const stmt = env.DB.prepare(sql);
        const { results } = await stmt.bind(...params.map(v => v === undefined ? null : v)).run();

        return new Response(JSON.stringify({ success: true, result: [{ results }] }), {
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
