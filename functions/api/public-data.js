export async function onRequestGet(context) {
    const { env } = context;
    if (!env.DB) return Response.json({ success: false, error: "Database not configured" });

    try {
        const p1 = env.DB.prepare("SELECT * FROM settings WHERE id = 1");
        const p2 = env.DB.prepare("SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order");
        const p3 = env.DB.prepare("SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order");
        const p4 = env.DB.prepare("SELECT * FROM products WHERE is_active = 1");
        const p5 = env.DB.prepare("SELECT * FROM home_sections WHERE is_active = 1 ORDER BY sort_order");
        const p6 = env.DB.prepare("SELECT * FROM product_categories");

        const [settings, banners, categories, products, home_sections, product_categories] = await env.DB.batch([p1, p2, p3, p4, p5, p6]);

        const data = {
            settings: (settings.results && settings.results.length) ? settings.results[0] : {},
            banners: banners.results || [],
            categories: categories.results || [],
            products: products.results || [],
            home_sections: home_sections.results || [],
            product_categories: product_categories.results || [],
        };

        return new Response(JSON.stringify({ success: true, data }), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
                // Cache-Control intentionally removed — TTL is set via Cloudflare Cache Rules
            }
        });
    } catch(e) {
        return Response.json({ success: false, error: e.message });
    }
}

