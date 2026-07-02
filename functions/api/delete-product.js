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
        const { id } = body;
        
        const sql = `DELETE FROM products WHERE id=?`;
        const stmt = env.DB.prepare(sql);
        const { results } = await stmt.bind(id).run();

        
        // Auto-purge Cloudflare Cache in background if credentials exist
        if (env.CLOUDFLARE_ZONE_ID && env.CLOUDFLARE_API_TOKEN) {
            context.waitUntil(
                fetch(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/purge_cache`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ purge_everything: true })
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
