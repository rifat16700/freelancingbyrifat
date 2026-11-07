import {
    resolveBrand,
    isReservedSlug,
    mergeSettingsWithBrand,
    buildBrandHeadInjection,
    rewriteAnchorHref,
    escapeAttr
} from '../_lib/brand.js';

const ALLOWED_BRAND_SUBPAGES = new Map([
    ['cart', { assetPath: '/cart', titlePrefix: 'Shopping Cart' }],
    ['checkout', { assetPath: '/checkout', titlePrefix: 'Checkout' }],
    ['success', { assetPath: '/success', titlePrefix: 'Order Confirmed' }],
    ['track', { assetPath: '/track', titlePrefix: 'Track Your Order' }],
    ['policies', { assetPath: '/policies', titlePrefix: 'Policies & Terms' }],
    ['team', { assetPath: '/team', titlePrefix: 'Our Team' }],
    ['invoice', { assetPath: '/invoice', titlePrefix: 'Invoice' }]
]);

export async function onRequestGet(context) {
    const { request, env, params } = context;
    const rawSlug = params?.brand || '';
    const pathParts = Array.isArray(params?.path) ? params.path : (params?.path ? [params.path] : []);

    if (isReservedSlug(rawSlug)) {
        return context.next();
    }

    const subPageRaw = (pathParts[0] || '').toLowerCase().replace(/\.html$/, '');

    // If someone requested /<brand>/index.html or /<brand>/shop.html or /<brand>/product.html, redirect to clean URL
    if (subPageRaw === 'index') {
        const u = new URL(request.url);
        u.pathname = `/${rawSlug}/`;
        return Response.redirect(u.toString(), 301);
    }
    if (subPageRaw === 'shop' || subPageRaw === 'product') {
        const u = new URL(request.url);
        u.pathname = `/${rawSlug}/${subPageRaw}`;
        return Response.redirect(u.toString(), 301);
    }

    const { brand, redirectSlug } = await resolveBrand(env, rawSlug);

    if (redirectSlug) {
        const u = new URL(request.url);
        u.pathname = `/${redirectSlug}/${pathParts.join('/')}`;
        return Response.redirect(u.toString(), 301);
    }

    const subPageConfig = ALLOWED_BRAND_SUBPAGES.get(subPageRaw);
    if (!brand || !subPageConfig || pathParts.length > 1) {
        const notFoundReq = new Request(new URL('/404.html', request.url), request);
        const nfRes = await env.ASSETS.fetch(notFoundReq);
        return new Response(nfRes.body, {
            status: 404,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }

    const assetReq = new Request(new URL(subPageConfig.assetPath, request.url), request);
    const response = await env.ASSETS.fetch(assetReq);
    if (!env.DB) return response;

    const rawSettings = await env.DB.prepare(
        "SELECT store_name, logo_url, favicon_url, site_url FROM settings WHERE id = 1"
    ).first().catch(() => ({}));
    const settings = mergeSettingsWithBrand(rawSettings, brand);
    const storeName = settings?.store_name || brand.name;

    let rawOrigin = (rawSettings?.site_url || env.SITE_URL || new URL(request.url).origin).trim().replace(/\/+$/, '');
    if (rawOrigin && !rawOrigin.startsWith('http://') && !rawOrigin.startsWith('https://')) {
        rawOrigin = 'https://' + rawOrigin;
    }
    const canonicalUrl = `${rawOrigin}/${brand.slug}/${subPageRaw}`;
    const brandHeadHtml = buildBrandHeadInjection(brand, rawSettings);

    let faviconUrl = settings?.favicon_url || settings?.logo_url || '/favicon.ico';
    if (faviconUrl && !faviconUrl.startsWith('http') && !faviconUrl.startsWith('/')) {
        faviconUrl = rawOrigin + '/' + faviconUrl;
    }

    const transformed = new HTMLRewriter()
        .on('title', { element(e) { e.setInnerContent(`${subPageConfig.titlePrefix} — ${storeName}`); } })
        .on('link[rel="canonical"]', { element(e) { e.remove(); } })
        .on('link[rel~="icon"]', { element(e) { e.remove(); } })
        .on('#navBrand', { element(e) { e.setInnerContent(storeName); } })
        .on('#footerBrand', { element(e) { e.setInnerContent(storeName); } })
        .on('a[href]', {
            element(e) {
                const updated = rewriteAnchorHref(e.getAttribute('href'), brand);
                if (updated) e.setAttribute('href', updated);
            }
        })
        .on('head', {
            element(e) {
                e.prepend(`${brandHeadHtml}\n    <link rel="canonical" href="${escapeAttr(canonicalUrl)}">\n    <link rel="icon" type="image/png" href="${escapeAttr(faviconUrl)}">\n`, { html: true });
            }
        })
        .transform(response);

    const headers = new Headers(transformed.headers);
    headers.set('Content-Type', 'text/html; charset=utf-8');
    return new Response(transformed.body, { status: transformed.status, headers });
}

