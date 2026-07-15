const fs = require('fs');
const sql = fs.readFileSync('d1_full_schema.sql', 'utf8');
const js = `export async function onRequest(context) {
    const { env } = context;
    try {
        const sql = ${JSON.stringify(sql)};
        const queries = sql.split(';').map(q => q.trim()).filter(q => q.length > 0);
        for (const q of queries) {
            await env.DB.prepare(q).run();
        }
        return new Response('Database completely reset and recreated successfully!', { status: 200 });
    } catch (e) {
        return new Response('Error: ' + e.message, { status: 500 });
    }
}`;
fs.writeFileSync('functions/api/reset-db.js', js);
