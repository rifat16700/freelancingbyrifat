export async function onRequestPost(context) {
    const { request, env } = context;

    const CORS_HEADERS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const body = await request.json();
        
        // Handle Batch Queries
        if (body.queries && Array.isArray(body.queries)) {
            for (let q of body.queries) {
                if (!q.sql || !q.sql.toUpperCase().trim().startsWith("SELECT")) {
                    return new Response(JSON.stringify({ success: false, error: "Only SELECT queries are allowed on this endpoint." }), {
                        status: 403,
                        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
                    });
                }
            }
            
            const statements = body.queries.map(q => 
                env.DB.prepare(q.sql).bind(...(q.params || []).map(v => v === undefined ? null : v))
            );
            const results = await env.DB.batch(statements);
            
            return new Response(JSON.stringify({ success: true, result: results }), {
                status: 200,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        // Handle Legacy Single Query
        const { sql, params = [] } = body;

        if (!sql || !sql.toUpperCase().trim().startsWith("SELECT")) {
            return new Response(JSON.stringify({ success: false, error: "Only SELECT queries are allowed on this endpoint." }), {
                status: 403,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        const stmt = env.DB.prepare(sql);
        const { results } = await stmt.bind(...params.map(v => v === undefined ? null : v)).all();

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
