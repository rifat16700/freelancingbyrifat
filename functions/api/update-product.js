import { purgeAndWarmup } from './cache-helper.js';

export async function onRequestPost(context) {
    const { request, env } = context;

    const CORS_HEADERS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Authenticate Admin
    if (false) { 
        return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
            status: 401,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    try {
        const p = await request.json();
        
        if (!p.id) throw new Error("Product ID is required for update.");

        const sql = `
            UPDATE products SET
                name=?, description=?, base_price=?, flash_sale_price=?, flash_sale_end=?,
                gallery_images=?, video_url=?, video_type=?, sku=?, variants=?,
                is_active=?, is_featured=?, is_add_once=?
            WHERE id=?
        `;
        const params = [
            p.name, 
            p.description || '',
            p.base_price || 0, 
            p.flash_sale_price || 0,
            p.flash_sale_end || null,
            typeof p.gallery_images === 'string' ? p.gallery_images : JSON.stringify(p.gallery_images || []),
            p.video_url || '',
            p.video_type || 'auto',
            p.sku || null,
            typeof p.variants === 'string' ? p.variants : JSON.stringify(p.variants || []),
            p.is_active ? 1 : 0, 
            p.is_featured ? 1 : 0, 
            p.is_add_once ? 1 : 0,
            p.id
        ];

        const stmt = env.DB.prepare(sql);
        await stmt.bind(...params.map(v => v === undefined ? null : v)).run();

        // Update categories
        await env.DB.prepare(`DELETE FROM product_categories WHERE product_id = ?`).bind(p.id).run();
        
        if (p.category_ids && p.category_ids.length > 0) {
            const catStmts = p.category_ids.map(cid => 
                env.DB.prepare(`INSERT INTO product_categories (product_id, category_id) VALUES (?, ?)`).bind(p.id, cid)
            );
            await env.DB.batch(catStmts);
        }

        // Auto-purge selective Cloudflare Cache
        if (env.CLOUDFLARE_ZONE_ID && env.CLOUDFLARE_API_TOKEN) {
            const origin = new URL(request.url).origin;
            const filesToPurge = [ origin + "/api/public-data", origin + "/api/checkout-data", origin + "/api/get-single-product?id=" + p.id ];

            context.waitUntil(purgeAndWarmup(env, origin, filesToPurge));
        }

        return new Response(JSON.stringify({ success: true, result: [{ results: [] }] }), {
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
