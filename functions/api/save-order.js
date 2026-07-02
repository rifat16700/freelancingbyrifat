export async function onRequestPost(context) {
    const { request, env } = context;

    const CORS_HEADERS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const body = await request.json();
        const { 
            id, customer_name, customer_phone, address, upazila, district, 
            delivery_method, delivery_charge, payment_method, payment_trx_id, payment_number, 
            subtotal, total, items, addons, promo_code, promo_discount, order_notes 
        } = body;
        
        const sql = `
            INSERT INTO orders (
                id, customer_name, customer_phone, address, upazila, district,
                delivery_method, delivery_charge, payment_method, payment_trx_id, payment_number,
                subtotal, total, items, addons, promo_code, promo_discount, order_notes, status, payment_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Unpaid')
        `;
        
        const params = [
            id, customer_name, customer_phone, address, upazila, district,
            delivery_method, delivery_charge, payment_method, payment_trx_id, payment_number,
            subtotal, total,
            typeof items === 'string' ? items : JSON.stringify(items || []),
            typeof addons === 'string' ? addons : JSON.stringify(addons || []),
            promo_code || null, promo_discount || 0, order_notes || ''
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
