import { resolveBrand, isReservedSlug } from '../_lib/brand.js';
import { renderProductPage } from '../_lib/render-product.js';

export async function onRequestGet(context) {
    const { request, env, params } = context;
    const rawSlug = params?.brand || '';

    if (isReservedSlug(rawSlug)) {
        return context.next();
    }

    const { brand, redirectSlug } = await resolveBrand(env, rawSlug);

    if (redirectSlug) {
        const u = new URL(request.url);
        u.pathname = `/${redirectSlug}/product`;
        return Response.redirect(u.toString(), 301);
    }

    if (!brand) {
        const notFoundReq = new Request(new URL('/404.html', request.url), request);
        const nfRes = await env.ASSETS.fetch(notFoundReq);
        return new Response(nfRes.body, {
            status: 404,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }

    return renderProductPage(context, brand);
}

