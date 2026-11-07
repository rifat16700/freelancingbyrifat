import { resolveBrand, isReservedSlug } from '../_lib/brand.js';
import { renderHomePage } from '../_lib/render-home.js';

export async function onRequestGet(context) {
    const { request, env, params } = context;
    const rawSlug = params?.brand || '';

    // If it matches a reserved route or static asset (e.g., /cart, /checkout, /login), fall through to static assets
    if (isReservedSlug(rawSlug)) {
        return context.next();
    }

    const { brand, redirectSlug } = await resolveBrand(env, rawSlug);

    if (redirectSlug) {
        const u = new URL(request.url);
        u.pathname = `/${redirectSlug}/`;
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

    // Enforce trailing slash on brand home (/ranonexwatch -> /ranonexwatch/)
    const url = new URL(request.url);
    if (!url.pathname.endsWith('/')) {
        url.pathname = `/${brand.slug}/`;
        return Response.redirect(url.toString(), 301);
    }

    return renderHomePage(context, brand);
}

