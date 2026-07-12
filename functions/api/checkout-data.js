export async function onRequestGet(context) {
    const { env } = context;

    if (!env.DB) {
        return Response.json({ success: false, error: "Database not configured" });
    }

    try {
        const p1 = env.DB.prepare("SELECT * FROM settings WHERE id=1");
        const p2 = env.DB.prepare("SELECT * FROM delivery_zones");
        const p3 = env.DB.prepare("SELECT * FROM addons WHERE is_active=1 ORDER BY created_at");
        const p4 = env.DB.prepare("SELECT * FROM promos WHERE is_active=1 LIMIT 500");
        const p5 = env.DB.prepare("SELECT id,name,base_price,flash_sale_price,gallery_images,variants FROM products WHERE is_add_once=1 AND is_active=1");

        const [settings, zones, addons, promos, add_once] = await env.DB.batch([p1, p2, p3, p4, p5]);

        const data = {
            settings: (settings.results && settings.results.length) ? settings.results[0] : {},
            zones: zones.results || [],
            addons: addons.results || [],
            promos: promos.results || [],
            add_once: add_once.results || []
        };

        // Note: No Cache-Control headers here as requested by user.
        // User will set up Cloudflare Cache Rules from the dashboard.
        return new Response(JSON.stringify({ success: true, data }), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });
    } catch(e) {
        return Response.json({ success: false, error: e.message }, { status: 500 });
    }
}
