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
            product_id, customer_name, customer_phone, rating, review_text, review_image, is_approved
        } = body;
        
        const sql = `
            INSERT INTO reviews (
                product_id, customer_name, customer_phone, rating, review_text, review_image, is_approved
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            product_id, customer_name, customer_phone || null, rating, review_text || null, review_image || null, is_approved ? 1 : 0
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
