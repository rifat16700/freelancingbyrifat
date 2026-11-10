import {
    resolveBrand,
    isReservedSlug,
    mergeSettingsWithBrand,
    buildBrandHeadInjection,
    rewriteAnchorHref,
    escapeAttr,
    serveNotFoundPage
} from '../_lib/brand.js';
import { renderHomePage } from '../_lib/render-home.js';
import { renderShopPage } from '../_lib/render-shop.js';
import { renderProductPage } from '../_lib/render-product.js';

const ALLOWED_BRAND_SUBPAGES = new Map([
    ['cart', { assetPath: '/cart', titlePrefix: 'Shopping Cart' }],
    ['checkout', { assetPath: '/checkout', titlePrefix: 'Checkout' }],
    ['success', { assetPath: '/success', titlePrefix: 'Order Confirmed' }],
    ['track', { assetPath: '/track', titlePrefix: 'Track Your Order' }],
    ['policies', { assetPath: '/policies', titlePrefix: 'Policies & Terms' }],
    ['team', { assetPath: '/team', titlePrefix: 'Our Team' }],
    ['invoice', { assetPath: '/invoice', titlePrefix: 'Invoice' }]
]);

export async function onRequest(context) {
    const { request, env, params } = context;
    const rawSlug = params?.brand || '';
    const rawPath = Array.isArray(params?.path) ? params.path : (params?.path ? [params.path] : []);
    // Filter out empty segments caused by trailing slashes (e.g. /gadgets/ -> [''])
    const pathParts = rawPath.filter(p => p !== undefined && p !== null && String(p).trim() !== '');

    // If it matches proxy data endpoints, transparently proxy to AlwaysData / Custom Proxy
    if (rawSlug === 'public-data' || rawSlug === 'checkout-data' || rawSlug === 'public-reviews') {
        try {
            const proxyBase = (env?.PROXY_API_URL || 'https://ranonex1.alwaysdata.net').replace(/\/+$/, '');
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

    if (isReservedSlug(rawSlug)) {
        return context.next();
    }

    const { brand, redirectSlug } = await resolveBrand(env, rawSlug);

    if (redirectSlug) {
        const u = new URL(request.url);
        u.pathname = pathParts.length > 0
            ? `/${redirectSlug}/${pathParts.join('/')}`
            : `/${redirectSlug}/`;
        return Response.redirect(u.toString(), 301);
    }

    // If the brand does not exist or is inactive -> show 404 with Continue Shopping -> /shop (Main Site)
    if (!brand) {
        return serveNotFoundPage(context, null);
    }

    // 1. Brand Homepage: /<brand> or /<brand>/ (when pathParts is empty)
    if (pathParts.length === 0) {
        const url = new URL(request.url);
        if (!url.pathname.endsWith('/')) {
            url.pathname = `/${brand.slug}/`;
            return Response.redirect(url.toString(), 301);
        }
        return renderHomePage(context, brand);
    }

    const firstRaw = String(pathParts[0] || '').toLowerCase();
    const subPageRaw = firstRaw.replace(/\.html$/, '');

    // If someone requested /<brand>/index.html -> redirect to /<brand>/
    if (subPageRaw === 'index' && pathParts.length === 1) {
        const u = new URL(request.url);
        u.pathname = `/${brand.slug}/`;
        return Response.redirect(u.toString(), 301);
    }

    // 2. Brand Shop Page: /<brand>/shop
    if (subPageRaw === 'shop' && pathParts.length === 1) {
        if (firstRaw.endsWith('.html')) {
            const u = new URL(request.url);
            u.pathname = `/${brand.slug}/shop`;
            return Response.redirect(u.toString(), 301);
        }
        return renderShopPage(context, brand);
    }

    // 3. Brand Product Page: /<brand>/product?id=...
    if (subPageRaw === 'product' && pathParts.length === 1) {
        if (firstRaw.endsWith('.html')) {
            const u = new URL(request.url);
            u.pathname = `/${brand.slug}/product`;
            return Response.redirect(u.toString(), 301);
        }
        return renderProductPage(context, brand);
    }

    // 4. Other Allowed Brand Subpages (/cart, /checkout, /track, /policies, /team, /success, /invoice)
    const subPageConfig = ALLOWED_BRAND_SUBPAGES.get(subPageRaw);
    if (!subPageConfig || pathParts.length > 1) {
        // Brand is valid & active, but the path after /<brand>/ is wrong ->
        // Show 404 where "Continue Shopping" leads to this brand's shop (/gadgets/shop)!
        return serveNotFoundPage(context, brand);
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
