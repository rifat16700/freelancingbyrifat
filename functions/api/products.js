export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    
    // Parse pagination cursor (last_id) and limit
    const lastId = url.searchParams.get('last_id');
    const limit = parseInt(url.searchParams.get('limit')) || 20;

    const CORS_HEADERS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        // Cache for 24 hours on CDN and browser
        'Cache-Control': 'public, max-age=86400'
    };

    try {
        let stmt;
        let queryArgs = [];

        if (lastId) {
            stmt = env.DB.prepare('SELECT * FROM products WHERE is_active = 1 AND id > ? ORDER BY id ASC LIMIT ?');
            queryArgs = [lastId, limit];
        } else {
            stmt = env.DB.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY id ASC LIMIT ?');
            queryArgs = [limit];
        }

        const { results } = await stmt.bind(...queryArgs.map(v => v === undefined ? null : v)).all();

        return new Response(JSON.stringify({ success: true, data: results }), {
            status: 200,
            headers: {
                ...CORS_HEADERS,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: {
                ...CORS_HEADERS,
                'Content-Type': 'application/json'
            }
        });
    }
}
