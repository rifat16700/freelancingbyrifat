import { resolveBrand, isReservedSlug, serveNotFoundPage } from '../_lib/brand.js';
import { renderHomePage } from '../_lib/render-home.js';

export async function onRequest(context) {
    const { request, env, params } = context;
    const rawSlug = params?.brand || '';

    // If it matches proxy data endpoints, transparently proxy to AlwaysData / Custom Proxy
    if (rawSlug === 'public-data' || rawSlug === 'checkout-data' || rawSlug === 'public-reviews') {
        const proxyBase = (env?.PROXY_API_URL || 'https://ranonex1.alwaysdata.net').replace(/\/+$/, '');
        const u = new URL(request.url);
        return fetch(`${proxyBase}/${rawSlug}${u.search}`);
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

