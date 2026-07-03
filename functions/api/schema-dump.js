export async function onRequest(context) {
    const { env } = context;
    try {
        const res = await env.DB.prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
        return new Response(res.results.map(r => r.sql).join("\n\n"));
    } catch(e) {
        return new Response(e.message);
    }
}
