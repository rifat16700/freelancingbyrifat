import {
    ensureBrandSchema,
    getAllActiveBrands,
    mergeSettingsWithBrand,
    buildBrandHeadInjection,
    rewriteAnchorHref,
    escapeAttr,
    filterCatalogForBrandContext
} from './brand.js';

export async function renderHomePage(context, brand = null) {
    const { request, env } = context;
    let response;
    try {
        const rootRequest = new Request(new URL('/', request.url), request);
        response = await env.ASSETS.fetch(rootRequest);

        if (!env.DB) return response;

        await ensureBrandSchema(env);

        const pSettings = env.DB.prepare(
            "SELECT store_name, logo_url, favicon_url, seo_title, seo_description, seo_keywords, seo_og_image, site_url, footer_text FROM settings WHERE id = 1"
        ).first();

        const pProducts = env.DB.prepare(
            "SELECT id, name, base_price, flash_sale_price, gallery_images, variants, sku, brand_id, show_on_main FROM products WHERE is_active = 1 ORDER BY is_featured DESC, created_at DESC LIMIT 300"
        ).all().catch(() => ({ results: [] }));
        const pCategories = env.DB.prepare(
            "SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order"
        ).all().catch(() => ({ results: [] }));
        const pProdCats = env.DB.prepare(
            "SELECT * FROM product_categories"
        ).all().catch(() => ({ results: [] }));

        const [rawSettings, prodsRes, catsRes, prodCatsRes, allBrands] = await Promise.all([
            pSettings,
            pProducts,
            pCategories,
            pProdCats,
            getAllActiveBrands(env)
        ]);

        const brandMap = new Map(allBrands.map(b => [b.id, b]));
        const settings = mergeSettingsWithBrand(rawSettings, brand);
        const mainStoreName = rawSettings?.store_name || 'Ranonex';
        const storeName = settings?.store_name || 'Store';

        let rawOrigin = (rawSettings?.site_url || env.SITE_URL || new URL(request.url).origin).trim().replace(/\/+$/, '');
        if (rawOrigin && !rawOrigin.startsWith('http://') && !rawOrigin.startsWith('https://')) {
            rawOrigin = 'https://' + rawOrigin;
        }
        const origin = rawOrigin;
        const prefix = brand ? `/${brand.slug}` : '';
        const canonicalPageUrl = brand ? `${origin}/${brand.slug}/` : `${origin}/`;

        const title = settings?.seo_title || `${storeName} — Online Shopping in Bangladesh`;
        const desc = settings?.seo_description || settings?.footer_text || `Welcome to ${storeName}. Best quality products, fastest delivery, and cash on delivery all over Bangladesh.`;
        const keywords = settings?.seo_keywords || `${storeName}, ecommerce, online shopping bangladesh`;

        const catalog = filterCatalogForBrandContext({
            allCategories: catsRes?.results || [],
            allProducts: prodsRes?.results || [],
            productCategories: prodCatsRes?.results || [],
            activeBrand: brand,
            brandMap,
            mainStoreName
        });

        const products = catalog.products.slice(0, 100);
        const categories = catalog.categories;

        function normalizeUrl(u) {
            if (!u || typeof u !== 'string') return '';
            let s = u.trim();
            if (!s || s.startsWith('data:')) return '';
            if (s.startsWith('//')) return 'https:' + s;
            if (s.startsWith('http://') || s.startsWith('https://')) return s;
            return origin + (s.startsWith('/') ? '' : '/') + s;
        }

        const logoUrl = normalizeUrl(settings?.logo_url);
        const faviconUrl = normalizeUrl(settings?.favicon_url) || logoUrl || (origin + '/favicon.ico');
        const primarySiteImage = normalizeUrl(settings?.seo_og_image) || logoUrl;

        let catsHtml = '';
        if (categories.length > 0) {
            catsHtml = categories.map(c =>
                `<a href="${prefix}/shop?cat=${encodeURIComponent(c.id)}" class="cat-pill">${escapeAttr(c.name)}</a>`
            ).join('');
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

                // R1 & Category URL Mode: Link to canonical product URL (no duplicate URL)
                const prodHref = p.brand_slug
                    ? `/${p.brand_slug}/product?id=${encodeURIComponent(p.id)}`
                    : `/product?id=${encodeURIComponent(p.id)}`;
                const brandBadgeHtml = (!brand && p.brand_slug && p.brand_name)
                    ? `<span class="product-badge" style="background:rgba(17,24,39,0.82);color:#fff;">🏷️ ${escapeAttr(p.brand_name)}</span>`
                    : '';

                return `<a href="${prodHref}" class="product-card" data-brand-explicit="1" data-nosnippet>
                    <div class="product-img-wrap">
                        ${img ? `<img src="${escapeAttr(img)}" alt="${escapeAttr(p.name)}" loading="lazy" data-nosnippet>` : '<div style="height:200px;background:#f0f0f5;"></div>'}
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

        // R4: Co-promotional JSON-LD (parentOrganization on brand, subOrganization on main)
        const storeNode = {
            "@type": "OnlineStore",
            "@id": canonicalPageUrl + "#store",
            "name": storeName,
            "url": canonicalPageUrl,
            "description": desc,
            ...(logoUrl ? {
                "logo": {
                    "@type": "ImageObject",
                    "url": logoUrl,
                    "caption": storeName
                }
            } : {}),
            ...(primarySiteImage ? { "image": primarySiteImage } : {}),
            "priceRange": "৳৳",
            "currenciesAccepted": "BDT",
            "paymentAccepted": "Cash on Delivery, bKash, Nagad",
            "areaServed": "BD"
        };

        if (brand) {
            storeNode.parentOrganization = {
                "@type": "OnlineStore",
                "name": mainStoreName,
                "url": origin + "/"
            };
            storeNode.brand = {
                "@type": "Brand",
                "name": brand.name,
                "url": canonicalPageUrl
            };
        } else if (allBrands.length > 0) {
            storeNode.subOrganization = allBrands.map(b => ({
                "@type": "OnlineStore",
                "name": b.name,
                "url": `${origin}/${b.slug}/`
            }));
        }

        const jsonLd = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "WebSite",
                    "@id": canonicalPageUrl + "#website",
                    "url": canonicalPageUrl,
                    "name": storeName,
                    "description": desc,
                    "potentialAction": {
                        "@type": "SearchAction",
                        "target": `${origin}${prefix}/shop?q={search_term_string}`,
                        "query-input": "required name=search_term_string"
                    }
                },
                {
                    "@type": "WebPage",
                    "@id": canonicalPageUrl + "#webpage",
                    "url": canonicalPageUrl,
                    "name": title,
                    "description": desc,
                    ...(primarySiteImage ? {
                        "primaryImageOfPage": {
                            "@type": "ImageObject",
                            "url": primarySiteImage,
                            "caption": storeName
                        }
                    } : {})
                },
                storeNode
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
            .on('#navBrand', { element(e) { e.setInnerContent(storeName); } })
            .on('#footerBrand', { element(e) { e.setInnerContent(storeName); } })
            .on('a[href]', {
                element(e) {
                    if (e.hasAttribute('data-brand-explicit')) return;
                    const updated = rewriteAnchorHref(e.getAttribute('href'), brand);
                    if (updated) e.setAttribute('href', updated);
                }
            })
            .on('head', {
                element(e) {
                    let headTags = `${brandHeadHtml}\n    <meta name="robots" content="index, follow, max-image-preview:large">
    <link rel="canonical" href="${escapeAttr(canonicalPageUrl)}">
    <link rel="icon" type="image/png" href="${escapeAttr(faviconUrl)}">
    <link rel="apple-touch-icon" href="${escapeAttr(faviconUrl)}">
    <link rel="image_src" href="${escapeAttr(primarySiteImage)}">
    <meta name="description" content="${escapeAttr(desc)}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${escapeAttr(storeName)}">
    <meta property="og:title" content="${escapeAttr(title)}">
    <meta property="og:description" content="${escapeAttr(desc)}">
    <meta property="og:url" content="${escapeAttr(canonicalPageUrl)}">`;
                    if (keywords) headTags += `\n    <meta name="keywords" content="${escapeAttr(keywords)}">`;
                    if (primarySiteImage) {
                        headTags += `\n    <meta property="og:image" content="${escapeAttr(primarySiteImage)}">
    <meta property="og:image:secure_url" content="${escapeAttr(primarySiteImage)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:image" content="${escapeAttr(primarySiteImage)}">`;
                    }
                    headTags += `\n    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeAttr(title)}">
    <meta name="twitter:description" content="${escapeAttr(desc)}">
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n`;
                    e.prepend(headTags, { html: true });
                }
            });

        if (catsHtml) {
            rewriter = rewriter.on('#catRow', {
                element(e) { e.setInnerContent(catsHtml, { html: true }); }
            });
        }

        if (cardsHtml) {
            rewriter = rewriter.on('#productsGrid', {
                element(e) { e.setInnerContent(cardsHtml, { html: true }); }
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

