import { purgeAndWarmup } from './cache-helper.js';

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

        
        
        // Auto-purge selective Cloudflare Cache
        if (env.CLOUDFLARE_ZONE_ID && env.CLOUDFLARE_API_TOKEN) {
            const origin = new URL(request.url).origin;
            const filesToPurge = [
                origin + "/api/get-products-list"
            ];
            
            const pid = typeof p !== 'undefined' && p && p.id ? p.id : (typeof id !== 'undefined' ? id : null);
            if (pid) {
                filesToPurge.push(origin + "/api/get-single-product?id=" + pid);
            }
            
            // Note: Since we are deleting, we might not know if it was an is_add_once product unless we query it first.
            // But to be safe, we will just purge checkout-data as well when deleting a product.
            filesToPurge.push(origin + "/api/checkout-data");

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
