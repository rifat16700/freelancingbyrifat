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
        const p = await request.json();
        const sql = `
            UPDATE products SET
                name=?, description=?, category_id=?, base_price=?, flash_sale_price=?,
                stock_status=?, gallery_images=?, video_url=?, variants=?,
                is_active=?, is_featured=?, is_add_once=?, updated_at=CURRENT_TIMESTAMP
            WHERE id=?
        `;
        const params = [
            p.name, p.description || '', p.category_id || '',
            p.base_price || 0, p.flash_sale_price || 0, p.stock_status || 'In Stock',
            typeof p.gallery_images === 'string' ? p.gallery_images : JSON.stringify(p.gallery_images || []),
            p.video_url || '',
            typeof p.variants === 'string' ? p.variants : JSON.stringify(p.variants || []),
            p.is_active ? 1 : 0, p.is_featured ? 1 : 0, p.is_add_once ? 1 : 0,
            p.id
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
