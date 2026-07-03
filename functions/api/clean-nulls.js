export async function onRequest(context) {
    const { env } = context;
    try {
        await env.DB.prepare('DELETE FROM product_categories WHERE product_id IS NULL OR product_id = "null"').run();
        await env.DB.prepare('DELETE FROM products WHERE id IS NULL OR id = "null"').run();
        return new Response('Cleaned up null products successfully!', { status: 200 });
    } catch (e) {
        return new Response('Error: ' + e.message, { status: 500 });
    }
}
