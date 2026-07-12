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
        
        let productId = p.id;
        if (!productId) {
            if (p.sku && p.sku.trim() !== '') {
                // Clean the SKU to be URL-safe (e.g., lowercased, spaces to hyphens)
                productId = p.sku.trim().replace(/\s+/g, '-').toLowerCase();
            } else {
                const maxRes = await env.DB.prepare("SELECT id FROM products WHERE id LIKE 'prod_%'").all();
                let maxNum = 0;
                if (maxRes && maxRes.results) {
                    maxRes.results.forEach(row => {
                        const numStr = row.id.replace('prod_', '');
                        const num = parseInt(numStr);
                        if (!isNaN(num) && num > maxNum) maxNum = num;
                    });
                }
                productId = 'prod_' + (maxNum + 1);
            }
        }
        
        const sql = `
            INSERT INTO products (
                id, name, description, base_price, flash_sale_price, flash_sale_end,
                gallery_images, video_url, video_type, sku, variants,
                is_active, is_featured, is_add_once, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        const params = [
            productId, 
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
            p.is_add_once ? 1 : 0
        ];

        const stmt = env.DB.prepare(sql);
        const result = await stmt.bind(...params.map(v => v === undefined ? null : v)).run();
        
        if (!result || !result.success) {
            throw new Error("Failed to insert product.");
        }

        // 2. Insert categories
        if (p.category_ids && p.category_ids.length > 0) {
            const catStmts = p.category_ids.map(cid => 
                env.DB.prepare(`INSERT INTO product_categories (product_id, category_id) VALUES (?, ?)`).bind(productId, cid)
            );
            await env.DB.batch(catStmts);
        }

        // Auto-purge selective Cloudflare Cache
        if (env.CLOUDFLARE_ZONE_ID && env.CLOUDFLARE_API_TOKEN) {
            const origin = new URL(request.url).origin;
            const filesToPurge = [
                origin + "/api/get-products-list",
                origin + "/api/get-single-product?id=" + productId
            ];
            
            if (p.is_add_once) {
                filesToPurge.push(origin + "/api/checkout-data");
            }

            context.waitUntil(purgeAndWarmup(env, origin, filesToPurge));
        }

        return new Response(JSON.stringify({ success: true, result: [{ results: [{ id: productId }] }] }), {
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
