import { verifyAdminRequest } from './_auth-helper.js';

export async function onRequest(context) {
    const { request, env } = context;
    const adminUser = await verifyAdminRequest(request, env);
    if (!adminUser) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized: Valid Admin session token required.' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    try {
        const res = await env.DB.prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
        return new Response(res.results.map(r => r.sql).join("\n\n"));
    } catch(e) {
        return new Response(e.message);
    }
}
