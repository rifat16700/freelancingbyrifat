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

        const body = await request.json();
        const { id } = body;

        const oldRow = await env.DB.prepare("SELECT brand_id FROM products WHERE id = ?").bind(id).first().catch(() => null);

        const sql = `DELETE FROM products WHERE id=?`;
        const stmt = env.DB.prepare(sql);
        const { results } = await stmt.bind(id).run();

        await env.DB.prepare("DELETE FROM product_categories WHERE product_id = ?").bind(id).run().catch(() => {});

        if (env.CLOUDFLARE_ZONE_ID && env.CLOUDFLARE_API_TOKEN) {
            const origin = new URL(request.url).origin;
            const filesToPurge = [
                origin + "/",
                origin + "/shop",
                origin + "/api/public-data",
                origin + "/api/get-products-list",
                origin + "/api/checkout-data"
            ];

            if (id) {
                filesToPurge.push(
                    origin + "/product?id=" + encodeURIComponent(id),
                    origin + "/api/get-single-product?id=" + id
                );
            }

            if (oldRow?.brand_id) {
                const { brand } = await resolveBrand(env, oldRow.brand_id, true);
                if (brand && brand.slug) {
                    filesToPurge.push(
                        `${origin}/${brand.slug}/`,
                        `${origin}/${brand.slug}/shop`,
                        `${origin}/${brand.slug}/product?id=${encodeURIComponent(id)}`,
                        `${origin}/api/public-data?brand=${encodeURIComponent(brand.slug)}`
                    );
                }
            }

            context.waitUntil(purgeAndWarmup(env, origin, filesToPurge));
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
