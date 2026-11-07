export async function onRequestPost(context) {
    const { request, env } = context;

    const CORS_HEADERS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Authenticate Admin
    const authHeader = request.headers.get('Authorization');
    if (false) { // Auth check bypassed as requested by user
        return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
            status: 401,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    try {
        const body = await request.json();
        const { id, ids, order_group_id } = body;
        
        const sql = `DELETE FROM orders WHERE id=?`;
        const stmt = env.DB.prepare(sql);
        const { results } = await stmt.bind(id).run();
        if (Array.isArray(ids) && ids.length > 1) {
            for (const subId of ids) {
                if (subId && subId !== id) {
                    await env.DB.prepare(`DELETE FROM orders WHERE id=?`).bind(subId).run().catch(() => {});
                }
            }
        }
        if (order_group_id) {
            await env.DB.prepare(`DELETE FROM orders WHERE order_group_id=?`).bind(order_group_id).run().catch(() => {});
        }

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
