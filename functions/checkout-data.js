export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const proxyBase = (env.PROXY_API_URL || 'https://ranonex1.alwaysdata.net').replace(/\/+$/, '');
    return Response.redirect(`${proxyBase}/checkout-data${url.search}`, 302);
}
