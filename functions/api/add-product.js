import { purgeAndWarmup } from './cache-helper.js';
import { ensureBrandSchema, resolveBrand } from '../_lib/brand.js';

export async function onRequestPost(context) {
    const { request, env } = context;

    const CORS_HEADERS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        await ensureBrandSchema(env);

        const p = await request.json();

        let productId = p.id;
        if (!productId) {
            if (p.sku && p.sku.trim() !== '') {
                productId = p.sku.trim().replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
                const existing = await env.DB.prepare("SELECT id FROM products WHERE id = ?").bind(productId).first().catch(() => null);
                if (existing) productId = `${productId}-${Math.floor(100 + Math.random() * 900)}`;
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

        // Safe auto-migration for columns in D1
        const prodCols = [
            'flash_sale_end TEXT DEFAULT NULL',
            'video_type TEXT DEFAULT "auto"',
            'sku TEXT DEFAULT NULL',
            'tags TEXT DEFAULT ""',
            'seo_keywords TEXT DEFAULT ""',
            'seo_title TEXT DEFAULT ""',
            'seo_description TEXT DEFAULT ""',
            'slug TEXT DEFAULT ""',
            'brand_id TEXT DEFAULT NULL',
            'show_on_main INTEGER DEFAULT 0'
        ];
        for (const col of prodCols) {
            try { await env.DB.prepare(`ALTER TABLE products ADD COLUMN ${col}`).run(); } catch (e) {}
        }

        const brandId = (p.brand_id && String(p.brand_id).trim() !== '') ? String(p.brand_id).trim() : null;
        const showOnMain = (brandId && p.show_on_main) ? 1 : 0;

        const sql = `
            INSERT INTO products (
                id, name, description, base_price, flash_sale_price, flash_sale_end,
                gallery_images, video_url, video_type, sku, variants,
                is_active, is_featured, is_add_once,
                tags, seo_keywords, seo_title, seo_description, slug,
                brand_id, show_on_main,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
            p.is_add_once ? 1 : 0,
            p.tags || '',
            p.seo_keywords || p.tags || '',
            p.seo_title || null,
            p.seo_description || null,
            p.slug || null,
            brandId,
            showOnMain
        ];

        const stmt = env.DB.prepare(sql);
        const result = await stmt.bind(...params.map(v => v === undefined ? null : v)).run();

        if (!result || !result.success) {
            throw new Error("Failed to insert product.");
        }

        // Insert categories
        if (p.category_ids && p.category_ids.length > 0) {
            const catStmts = p.category_ids.map(cid =>
                env.DB.prepare(`INSERT INTO product_categories (product_id, category_id) VALUES (?, ?)`).bind(productId, cid)
            );
            await env.DB.batch(catStmts);
        }

        // Auto-purge selective Cloudflare Cache (including brand URLs)
        if (env.CLOUDFLARE_ZONE_ID && env.CLOUDFLARE_API_TOKEN) {
            const origin = new URL(request.url).origin;
            const filesToPurge = [
                origin + "/",
                origin + "/shop",
                origin + "/product?id=" + encodeURIComponent(productId),
                origin + "/sitemap.xml",
                origin + "/api/public-data",
                origin + "/api/get-products-list",
                origin + "/api/get-single-product?id=" + productId
            ];

            if (brandId) {
                const { brand } = await resolveBrand(env, brandId, true);
                if (brand && brand.slug) {
                    filesToPurge.push(
                        `${origin}/${brand.slug}/`,
                        `${origin}/${brand.slug}/shop`,
                        `${origin}/${brand.slug}/product?id=${encodeURIComponent(productId)}`,
                        `${origin}/api/public-data?brand=${encodeURIComponent(brand.slug)}`
                    );
                }
            }

            if (p.is_add_once) {
                filesToPurge.push(origin + "/api/checkout-data");
            }

            context.waitUntil(purgeAndWarmup(env, origin, filesToPurge));
        }

        return new Response(JSON.stringify({ success: true, id: productId, result: [{ results: [] }] }), {
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
