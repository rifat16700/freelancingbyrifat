import {
    ensureBrandSchema,
    getAllActiveBrands,
    mergeSettingsWithBrand,
    buildBrandHeadInjection,
    rewriteAnchorHref,
    escapeAttr
} from './brand.js';

export async function renderShopPage(context, brand = null) {
    const { request, env } = context;
    let response;
    try {
        const shopRequest = new Request(new URL('/shop', request.url), request);
        response = await env.ASSETS.fetch(shopRequest);

        if (!env.DB) return response;

        await ensureBrandSchema(env);

        const url = new URL(request.url);
        const catId = url.searchParams.get('cat');
        const pSettings = env.DB.prepare(
            "SELECT store_name, logo_url, favicon_url, seo_title, seo_description, seo_keywords, seo_og_image, site_url, footer_text FROM settings WHERE id = 1"
        ).first();

        let pCategory = null;
        if (catId) {
            pCategory = env.DB.prepare("SELECT name, brand_id FROM categories WHERE id = ?").bind(catId).first();
        }

        let pProducts;
        if (brand) {
            if (catId) {
                pProducts = env.DB.prepare(`
                    SELECT p.id, p.name, p.base_price, p.flash_sale_price, p.gallery_images, p.variants, p.sku, p.brand_id, p.show_on_main
                    FROM products p
                    INNER JOIN product_categories pc ON p.id = pc.product_id
                    WHERE p.is_active = 1 AND p.brand_id = ? AND pc.category_id = ?
                    ORDER BY p.is_featured DESC, p.created_at DESC
                    LIMIT 100
                `).bind(brand.id, catId).all().catch(() => ({ results: [] }));
            } else {
                pProducts = env.DB.prepare(`
                    SELECT id, name, base_price, flash_sale_price, gallery_images, variants, sku, brand_id, show_on_main
                    FROM products
                    WHERE is_active = 1 AND brand_id = ?
                    ORDER BY is_featured DESC, created_at DESC
                    LIMIT 100
                `).bind(brand.id).all().catch(() => ({ results: [] }));
            }
        } else {
            if (catId) {
                pProducts = env.DB.prepare(`
                    SELECT p.id, p.name, p.base_price, p.flash_sale_price, p.gallery_images, p.variants, p.sku, p.brand_id, p.show_on_main
                    FROM products p
                    INNER JOIN product_categories pc ON p.id = pc.product_id
                    WHERE p.is_active = 1 AND (p.brand_id IS NULL OR p.brand_id = '' OR p.show_on_main = 1) AND pc.category_id = ?
                    ORDER BY p.is_featured DESC, p.created_at DESC
                    LIMIT 100
                `).bind(catId).all().catch(() => ({ results: [] }));
            } else {
                pProducts = env.DB.prepare(`
                    SELECT id, name, base_price, flash_sale_price, gallery_images, variants, sku, brand_id, show_on_main
                    FROM products
                    WHERE is_active = 1 AND (brand_id IS NULL OR brand_id = '' OR show_on_main = 1)
                    ORDER BY is_featured DESC, created_at DESC
                    LIMIT 100
                `).all().catch(() => ({ results: [] }));
            }
        }

        const [rawSettings, catObj, prodsRes, allBrands] = await Promise.all([
            pSettings,
            pCategory,
            pProducts,
            getAllActiveBrands(env)
        ]);

        const brandMap = new Map(allBrands.map(b => [b.id, b]));
        const settings = mergeSettingsWithBrand(rawSettings, brand);
        const mainStoreName = rawSettings?.store_name || 'Ranonex';
        const storeName = settings?.store_name || 'Store';

        let rawOrigin = (rawSettings?.site_url || env.SITE_URL || url.origin).trim().replace(/\/+$/, '');
        if (rawOrigin && !rawOrigin.startsWith('http://') && !rawOrigin.startsWith('https://')) {
            rawOrigin = 'https://' + rawOrigin;
        }
        const origin = rawOrigin;
        const prefix = brand ? `/${brand.slug}` : '';

        const catName = catObj?.name || null;
        const titleSuffix = brand && storeName.toLowerCase() !== mainStoreName.toLowerCase()
            ? `${storeName} | ${mainStoreName}`
            : storeName;

        const title = catName
            ? `${catName} Collection — ${titleSuffix}`
            : `Shop All Products — ${titleSuffix}`;
        const desc = catName
            ? `Shop ${catName} online at ${storeName}. Best quality ${catName} products at the best price with fast delivery across Bangladesh.`
            : `Browse our complete collection of quality items on ${storeName}. Best prices, cash on delivery all over Bangladesh.`;
        const keywords = settings?.seo_keywords || `${storeName}, shop, ecommerce, online shopping bangladesh`;

        const products = (prodsRes?.results || []).filter(p => {
            if (!p.brand_id) return true;
            return brandMap.has(p.brand_id);
        });

        let logoUrl = settings?.logo_url || '';
        if (logoUrl && !logoUrl.startsWith('http')) {
            logoUrl = origin + (logoUrl.startsWith('/') ? '' : '/') + logoUrl;
        }
        let faviconUrl = settings?.favicon_url || settings?.logo_url || '/favicon.ico';
        if (faviconUrl && !faviconUrl.startsWith('http') && !faviconUrl.startsWith('/')) {
            faviconUrl = origin + '/' + faviconUrl;
        }
        let imgUrl = settings?.seo_og_image || settings?.logo_url || '';
        if (imgUrl && !imgUrl.startsWith('http')) {
            imgUrl = origin + (imgUrl.startsWith('/') ? '' : '/') + imgUrl;
        }

        let cardsHtml = '';
        if (products.length > 0) {
            cardsHtml = products.map(p => {
                let variants = [];
                try { variants = typeof p.variants === 'string' ? JSON.parse(p.variants) : (p.variants || []); } catch (e) {}
                let gallery = [];
                try { gallery = typeof p.gallery_images === 'string' ? JSON.parse(p.gallery_images) : (p.gallery_images || []); } catch (e) {}

                let img = (variants.length && variants[0]?.imageUrl) ? variants[0].imageUrl : (gallery[0] || '');
                let finalPrice = p.base_price;
                let saleHtml = '';
                if (p.flash_sale_price > 0) {
                    finalPrice = p.base_price - p.flash_sale_price;
                    saleHtml = `<span class="product-old-price">৳${p.base_price}</span>`;
                }

                const prodBrand = p.brand_id ? brandMap.get(p.brand_id) : null;
                const prodHref = prodBrand
                    ? `/${prodBrand.slug}/product?id=${encodeURIComponent(p.id)}`
                    : `${prefix}/product?id=${encodeURIComponent(p.id)}`;
                const brandBadgeHtml = (!brand && prodBrand)
                    ? `<span class="product-badge" style="background:rgba(17,24,39,0.82);color:#fff;">🏷️ ${escapeAttr(prodBrand.name)}</span>`
                    : '';

                return `<a href="${prodHref}" class="product-card">
                    <div class="product-img-wrap">
                        ${img ? `<img src="${escapeAttr(img)}" alt="${escapeAttr(p.name)}" loading="lazy">` : '<div style="height:200px;background:#f0f0f5;"></div>'}
                        <div class="product-badges">
                            ${p.flash_sale_price > 0 ? `<span class="product-badge badge-sale">৳${p.flash_sale_price} ছাড় (-${p.base_price > 0 ? Math.round((p.flash_sale_price / p.base_price) * 100) : 0}%)</span>` : ''}
                            ${brandBadgeHtml}
                        </div>
                    </div>
                    <div class="product-info">
                        <div class="product-name">${escapeAttr(p.name)}</div>
                        <div class="product-price-row">
                            <span class="product-price">৳${finalPrice}</span>${saleHtml}
                        </div>
                        <button class="product-add-btn">+ Add to Cart</button>
                    </div>
                </a>`;
            }).join('');
        }

        const canonicalUrl = `${origin}${prefix}/shop${catId ? `?cat=${encodeURIComponent(catId)}` : ''}`;

        const shopJsonLd = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "CollectionPage",
                    "@id": canonicalUrl + "#collection",
                    "name": title,
                    "description": desc,
                    "url": canonicalUrl
                },
                ...(products.length > 0 ? [{
                    "@type": "ItemList",
                    "@id": canonicalUrl + "#items",
                    "itemListElement": products.map((p, idx) => {
                        const pb = p.brand_id ? brandMap.get(p.brand_id) : null;
                        const itemPrefix = pb ? `/${pb.slug}` : prefix;
                        return {
                            "@type": "ListItem",
                            "position": idx + 1,
                            "name": p.name,
                            "url": `${origin}${itemPrefix}/product?id=${encodeURIComponent(p.id)}`
                        };
                    })
                }] : [])
            ]
        };

        const brandHeadHtml = buildBrandHeadInjection(brand, rawSettings);

        let rewriter = new HTMLRewriter()
            .on('title', { element(e) { e.setInnerContent(title); } })
            .on('meta[name="description"]', { element(e) { e.remove(); } })
            .on('meta[name="keywords"]', { element(e) { e.remove(); } })
            .on('meta[property^="og:"]', { element(e) { e.remove(); } })
            .on('meta[name^="twitter:"]', { element(e) { e.remove(); } })
            .on('link[rel="canonical"]', { element(e) { e.remove(); } })
            .on('link[rel~="icon"]', { element(e) { e.remove(); } })
            .on('link[rel="apple-touch-icon"]', { element(e) { e.remove(); } })
            .on('link[rel="image_src"]', { element(e) { e.remove(); } })
            .on('head', {
                element(e) {
                    let headTags = `${brandHeadHtml}\n    <meta name="robots" content="index, follow, max-image-preview:large">
    <link rel="canonical" href="${escapeAttr(canonicalUrl)}">
    <link rel="icon" type="image/png" href="${escapeAttr(faviconUrl)}">
    <link rel="apple-touch-icon" href="${escapeAttr(faviconUrl)}">
    <link rel="image_src" href="${escapeAttr(imgUrl || logoUrl)}">
    <meta name="description" content="${escapeAttr(desc)}">
    <meta name="keywords" content="${escapeAttr(keywords)}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${escapeAttr(storeName)}">
    <meta property="og:title" content="${escapeAttr(title)}">
    <meta property="og:description" content="${escapeAttr(desc)}">
    <meta property="og:url" content="${escapeAttr(canonicalUrl)}">`;
                    if (imgUrl) {
                        headTags += `\n    <meta property="og:image" content="${escapeAttr(imgUrl)}">
    <meta property="og:image:secure_url" content="${escapeAttr(imgUrl)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:image" content="${escapeAttr(imgUrl)}">`;
                    }
                    headTags += `\n    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeAttr(title)}">
    <meta name="twitter:description" content="${escapeAttr(desc)}">
    <script type="application/ld+json">${JSON.stringify(shopJsonLd)}</script>\n`;
                    e.prepend(headTags, { html: true });
                }
            })
            .on('#navBrand', { element(e) { e.setInnerContent(storeName); } })
            .on('#footerBrand', { element(e) { e.setInnerContent(storeName); } })
            .on('a[href]', {
                element(e) {
                    const updated = rewriteAnchorHref(e.getAttribute('href'), brand);
                    if (updated) e.setAttribute('href', updated);
                }
            });

        if (cardsHtml) {
            rewriter = rewriter.on('#productsGrid', {
                element(e) { e.setInnerContent(cardsHtml, { html: true }); }
            }).on('#resultCount', {
                element(e) { e.setInnerContent(`${products.length} products found`); }
            });
        }

        const transformed = rewriter.transform(response);
        const headers = new Headers(transformed.headers);
        headers.set('Content-Type', 'text/html; charset=utf-8');
        return new Response(transformed.body, {
            status: transformed.status,
            statusText: transformed.statusText,
            headers
        });
    } catch (err) {
        return response || new Response('Internal Server Error', { status: 500 });
    }
}

