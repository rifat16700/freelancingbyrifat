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
            INSERT INTO products (
                id, name, description, category_id, base_price, flash_sale_price,
                stock_status, gallery_images, video_url, variants,
                is_active, is_featured, is_add_once, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
        const params = [
            p.id, p.name, p.description || '', p.category_id || '',
            p.base_price || 0, p.flash_sale_price || 0, p.stock_status || 'In Stock',
            typeof p.gallery_images === 'string' ? p.gallery_images : JSON.stringify(p.gallery_images || []),
            p.video_url || '',
            typeof p.variants === 'string' ? p.variants : JSON.stringify(p.variants || []),
            p.is_active ? 1 : 0, p.is_featured ? 1 : 0, p.is_add_once ? 1 : 0
        ];

        const stmt = env.DB.prepare(sql);
        const { results } = await stmt.bind(...params.map(v => v === undefined ? null : v)).run();

        
        
        // Auto-purge selective Cloudflare Cache
        if (env.CLOUDFLARE_ZONE_ID && env.CLOUDFLARE_API_TOKEN) {
            const origin = new URL(request.url).origin;
            const filesToPurge = [
                origin + "/",
                origin + "/index.html",
                origin + "/shop",
                origin + "/shop.html",
                origin + "/api/public-data",
                origin + "/api/get-products-list"
            ];
            
            const pid = typeof p !== 'undefined' && p && p.id ? p.id : (typeof id !== 'undefined' ? id : null);
            if (pid) {
                filesToPurge.push(origin + "/product?id=" + pid);
                filesToPurge.push(origin + "/product.html?id=" + pid);
                filesToPurge.push(origin + "/api/get-single-product?id=" + pid);
                filesToPurge.push(origin + "/api/public-reviews?product_id=" + pid);
            }

            context.waitUntil(
                fetch(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/purge_cache`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ files: filesToPurge })
                }).catch(() => {})
            );
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
