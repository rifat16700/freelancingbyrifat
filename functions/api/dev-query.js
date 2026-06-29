export async function onRequestPost(context) {
    const { request, env } = context;

    const CORS_HEADERS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Dev-Key',
    };

    try {
        const devKey = request.headers.get('X-Dev-Key');
        
        // Master password logic copied from devtools.html
        const _E = [118,110,101,104,118,57,55,50,84,64,39,35,50,63,53,56,53];
        const _K = [4,7,3,9,2,8,5,1,6,0];
        const masterPw = _E.map((c, i) => String.fromCharCode(c ^ _K[i % _K.length])).join('');
        
        // Generate the master hash for verification
        const encoder = new TextEncoder();
        const data = encoder.encode(masterPw + '__sys__');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const masterHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // Verify either the master hash OR if there's a custom dev token configured in env
        if (!devKey || devKey !== masterHash) {
            return new Response(JSON.stringify({ success: false, error: "Unauthorized Dev Access. Master password hash required." }), {
                status: 401,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        const body = await request.json();
        const { sql, params = [] } = body;

        const stmt = env.DB.prepare(sql);
        const { results } = await stmt.bind(...params).all();

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
            'Access-Control-Allow-Headers': 'Content-Type, X-Dev-Key',
        }
    });
}
