import { resolveBrand, isReservedSlug, serveNotFoundPage } from '../_lib/brand.js';
import { renderHomePage } from '../_lib/render-home.js';

export async function onRequest(context) {
    const { request, env, params } = context;
    const rawSlug = params?.brand || '';

    // If it matches proxy data endpoints, transparently proxy to AlwaysData / Custom Proxy
    if (rawSlug === 'public-data' || rawSlug === 'checkout-data' || rawSlug === 'public-reviews') {
        try {
            let proxyBase = (env?.PROXY_API_URL || 'https://ranonex1.alwaysdata.net').trim().replace(/\/+$/, '');
            if (!proxyBase.startsWith('http://') && !proxyBase.startsWith('https://')) {
                proxyBase = 'https://' + proxyBase;
            }
            const u = new URL(request.url);
            const target = `${proxyBase}/${rawSlug}${u.search}`;
            const res = await fetch(target);
            const body = await res.text();
            return new Response(body, {
                status: res.status,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'public, max-age=300, s-maxage=300'
                }
            });
        } catch (err) {
            return new Response(JSON.stringify({ success: false, error: err.message, stack: err.stack }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

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
        return serveNotFoundPage(context);
    }

    // Enforce trailing slash on brand home (/ranonexwatch -> /ranonexwatch/)
    const url = new URL(request.url);
    if (!url.pathname.endsWith('/')) {
        url.pathname = `/${brand.slug}/`;
        return Response.redirect(url.toString(), 301);
    }

    return renderHomePage(context, brand);
}

