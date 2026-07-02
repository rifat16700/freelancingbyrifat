export async function onRequestPost(context) {
    const { request, env } = context;

    const CORS_HEADERS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const rawBody = await request.json();
        const body = rawBody.orderData || rawBody;
        
        const { 
            id, customer_name, customer_phone, customer_email, division, district, upazila, address,
            items, addons, subtotal, addon_total, delivery_charge, promo_code, promo_discount,
            grand_total, advance_payable, payment_method, payment_status, payment_trx_id, payment_sender,
            status, order_type
        } = body;
        
        const sql = `
            INSERT INTO orders (
                id, customer_name, customer_phone, customer_email, division, district, upazila, address,
                items, addons, subtotal, addon_total, delivery_charge, promo_code, promo_discount,
                grand_total, advance_payable, payment_method, payment_status, payment_trx_id, payment_sender,
                status, order_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            id, customer_name, customer_phone, customer_email || null, division || null, district, upazila, address,
            typeof items === 'string' ? items : JSON.stringify(items || []),
            typeof addons === 'string' ? addons : JSON.stringify(addons || []),
            subtotal, addon_total || 0, delivery_charge, promo_code || null, promo_discount || 0,
            grand_total, advance_payable || 0, payment_method, payment_status || 'Unpaid', payment_trx_id || null, payment_sender || null,
            status || 'Pending', order_type || 'delivery'
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
