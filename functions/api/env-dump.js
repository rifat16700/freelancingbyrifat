export async function onRequest(context) {
    const { env } = context;
    const keys = Object.keys(env || {});
    return new Response(JSON.stringify({
        success: true,
        envKeys: keys,
        hasDB: !!env.DB,
        typeofDB: typeof env.DB,
        hasUsersKV: !!env.USERS_KV,
        hasStorage: !!env.storage
    }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
    });
}
