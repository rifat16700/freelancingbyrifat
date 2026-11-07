import { resolveBrand, isReservedSlug, serveNotFoundPage } from '../_lib/brand.js';
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
        return serveNotFoundPage(context);
    }

    return renderProductPage(context, brand);
}

