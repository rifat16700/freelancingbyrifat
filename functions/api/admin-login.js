export async function onRequestPost(context) {
    const { request, env } = context;

    const CORS_HEADERS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    try {
        const body = await request.json();
        const { username, password } = body;

        // Default to 'admin' and '1234' if env variables are not set for easier setup, 
        // but strongly recommend setting them in Cloudflare.
        const validUser = env.ADMIN_USERNAME || 'admin@rifat.com';
        const validPass = env.ADMIN_PASSWORD || 'rifat123R@';

        if (username === validUser && password === validPass) {
            return new Response(JSON.stringify({ success: true, token: (env.ADMIN_SECRET_TOKEN || 'default_admin_token') }), {
                status: 200,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        } else {
            return new Response(JSON.stringify({ success: false, error: "Invalid credentials" }), {
                status: 401,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }
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
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
}
