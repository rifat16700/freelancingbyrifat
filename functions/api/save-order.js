import { ensureBrandSchema } from '../_lib/brand.js';

export async function onRequestPost(context) {
    const { request, env } = context;

    const CORS_HEADERS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        await ensureBrandSchema(env);

        const rawBody = await request.json();

        // Support saving a single order OR an array of orders (for Master Checkout split by brand)
        const ordersList = Array.isArray(rawBody.orders)
            ? rawBody.orders
            : [rawBody.orderData || rawBody];

        const sql = `
            INSERT INTO orders (
                id, customer_name, customer_phone, customer_email, division, district, upazila, address,
                items, addons, subtotal, addon_total, delivery_charge, promo_code, promo_discount,
                grand_total, advance_payable, payment_method, payment_status, payment_trx_id, payment_sender,
                status, order_type, brand_id, order_group_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const savedIds = [];
        for (const body of ordersList) {
            const {
                id, customer_name, customer_phone, customer_email, division, district, upazila, address,
                items, addons, subtotal, addon_total, delivery_charge, promo_code, promo_discount,
                grand_total, advance_payable, payment_method, payment_status, payment_trx_id, payment_sender,
                status, order_type, brand_id, order_group_id
            } = body;

            const params = [
                id, customer_name, customer_phone, customer_email || null, division || null, district, upazila, address,
                typeof items === 'string' ? items : JSON.stringify(items || []),
                typeof addons === 'string' ? addons : JSON.stringify(addons || []),
                subtotal, addon_total || 0, delivery_charge, promo_code || null, promo_discount || 0,
                grand_total, advance_payable || 0, payment_method, payment_status || 'Unpaid', payment_trx_id || null, payment_sender || null,
                status || 'Pending', order_type || 'delivery',
                brand_id || null, order_group_id || null
            ];

            const stmt = env.DB.prepare(sql);
            await stmt.bind(...params.map(v => v === undefined ? null : v)).run();
            savedIds.push(id);
        }

        return new Response(JSON.stringify({
            success: true,
            order_ids: savedIds,
            result: [{ results: savedIds }]
        }), {
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
