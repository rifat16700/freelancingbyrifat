const fs = require('fs');

const replacement = `export async function onRequestGet(context) {
    const { request, env } = context;
    const cacheUrl = new URL(request.url);
    const cacheKey = new Request(cacheUrl.toString(), request);
    const cache = caches.default;

    try {
        let response = await cache.match(cacheKey);
        if (response) {
            return response;
        }
    } catch(e) {}

    if (!env.DB) return Response.json({ success: false, error: "Database not configured" });

    try {
        const p1 = env.DB.prepare("SELECT * FROM settings WHERE id = 1");
        const p2 = env.DB.prepare("SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order");
        const p3 = env.DB.prepare("SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order");
        const p4 = env.DB.prepare("SELECT * FROM products WHERE is_active = 1");
        const p5 = env.DB.prepare("SELECT * FROM home_sections WHERE is_active = 1 ORDER BY sort_order");
        const p6 = env.DB.prepare("SELECT * FROM product_categories");
        const p7 = env.DB.prepare("SELECT * FROM devtools WHERE id = '1'");

        const [settings, banners, categories, products, home_sections, product_categories, devtools] = await env.DB.batch([p1, p2, p3, p4, p5, p6, p7]);

        const data = {
            settings: (settings.results && settings.results.length) ? settings.results[0] : {},
            banners: banners.results || [],
            categories: categories.results || [],
            products: products.results || [],
            home_sections: home_sections.results || [],
            product_categories: product_categories.results || [],
            devtools: (devtools.results && devtools.results.length) ? devtools.results[0] : {}
        };

        const response = new Response(JSON.stringify({ success: true, data }), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=86400, s-maxage=86400",
                "Access-Control-Allow-Origin": "*"
            }
        });

        try {
            context.waitUntil(cache.put(cacheKey, response.clone()));
        } catch(e) {}

        return response;
    } catch(e) {
        return Response.json({ success: false, error: e.message });
    }
}`;
fs.writeFileSync('functions/api/public-data.js', replacement, 'utf8');

const revReplacement = `export async function onRequestGet(context) {
    const { request, env } = context;
    const cacheUrl = new URL(request.url);
    const cacheKey = new Request(cacheUrl.toString(), request);
    const cache = caches.default;

    try {
        let response = await cache.match(cacheKey);
        if (response) {
            return response;
        }
    } catch(e) {}

    if (!env.DB) return Response.json({ success: false, error: "Database not configured" });

    const url = new URL(request.url);
    const productId = url.searchParams.get("product_id");
    const limit = url.searchParams.get("limit") || "100";

    if (!productId) return Response.json({ success: false, error: "Missing product_id" });

    try {
        const stmt = env.DB.prepare("SELECT * FROM reviews WHERE product_id = ? AND is_approved = 1 ORDER BY created_at DESC LIMIT ?").bind(productId, parseInt(limit));
        const results = await stmt.all();

        const response = new Response(JSON.stringify({ success: true, data: results.results || [] }), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=86400, s-maxage=86400",
                "Access-Control-Allow-Origin": "*"
            }
        });

        try {
            context.waitUntil(cache.put(cacheKey, response.clone()));
        } catch(e) {}

        return response;
    } catch(e) {
        return Response.json({ success: false, error: e.message });
    }
}`;
fs.writeFileSync('functions/api/public-reviews.js', revReplacement, 'utf8');
