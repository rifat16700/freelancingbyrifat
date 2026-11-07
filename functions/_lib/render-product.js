import {
    ensureBrandSchema,
    resolveBrand,
    getAllActiveBrands,
    mergeSettingsWithBrand,
    mergeBrandKeywords,
    buildBrandHeadInjection,
    rewriteAnchorHref,
    escapeAttr,
    resolveProductCanonicalBrand
} from './brand.js';

export async function renderProductPage(context, brand = null) {
    const { request, env } = context;
    let response;
    try {
        const prodRequest = new Request(new URL('/product', request.url), request);
        response = await env.ASSETS.fetch(prodRequest);

        if (!env.DB) return response;

        await ensureBrandSchema(env);

        const url = new URL(request.url);
        const pid = (url.searchParams.get('id') || url.searchParams.get('sku') || url.searchParams.get('slug') || '').trim();
        if (!pid) return response;

        const pProduct = env.DB.prepare(
            "SELECT * FROM products WHERE id = ? OR sku = ? OR lower(sku) = lower(?) OR slug = ? OR lower(slug) = lower(?) LIMIT 1"
        ).bind(pid, pid, pid, pid, pid).first();
        const pSettings = env.DB.prepare(
            "SELECT store_name, logo_url, favicon_url, seo_og_image, seo_description, seo_keywords, site_url FROM settings WHERE id = 1"
        ).first();

        const [product, rawSettings] = await Promise.all([pProduct, pSettings]);

        if (!product) {
            const notFoundTransformed = new HTMLRewriter()
                .on('title', { element(e) { e.setInnerContent('Product Not Found'); } })
                .on('head', {
                    element(e) {
                        e.prepend('\n    <meta name="robots" content="noindex, nofollow">\n', { html: true });
                    }
                })
                .transform(response);
            const nfHeaders = new Headers(notFoundTransformed.headers);
            nfHeaders.set('Content-Type', 'text/html; charset=utf-8');
            return new Response(notFoundTransformed.body, {
                status: 404,
                headers: nfHeaders
            });
        }

        // R1 & Category URL Mode: Determine canonical brand for this product and redirect if accessed via wrong URL
        const [allBrands, prodCatsRes] = await Promise.all([
            getAllActiveBrands(env),
            env.DB.prepare(`
                SELECT c.*
                FROM categories c
                INNER JOIN product_categories pc ON c.id = pc.category_id
                WHERE pc.product_id = ? AND c.is_active = 1
            `).bind(product.id).all().catch(() => ({ results: [] }))
        ]);

        const brandMap = new Map(allBrands.map(b => [b.id, b]));
        const prodCategories = prodCatsRes?.results || [];
        const { canonicalBrand: productBrand } = resolveProductCanonicalBrand(product, prodCategories, brandMap, brand);

        if (productBrand && (!brand || brand.id !== productBrand.id)) {
            const targetUrl = new URL(request.url);
            targetUrl.pathname = `/${productBrand.slug}/product`;
            return Response.redirect(targetUrl.toString(), 301);
        }
        if (!productBrand && brand) {
            // Canonical URL is Main Site (/product) -> redirect to main /product
            const targetUrl = new URL(request.url);
            targetUrl.pathname = `/product`;
            return Response.redirect(targetUrl.toString(), 301);
        }

        const activeBrand = productBrand || brand || null;
        const settings = mergeSettingsWithBrand(rawSettings, activeBrand);
        const mainStoreName = rawSettings?.store_name || 'Ranonex';
        const storeName = settings?.store_name || 'Online Store';
        const prefix = activeBrand ? `/${activeBrand.slug}` : '';

        const pReviews = env.DB.prepare(
            "SELECT rating, customer_name, comment, created_at FROM reviews WHERE product_id = ? AND is_approved = 1 ORDER BY created_at DESC LIMIT 20"
        ).bind(product.id).all().catch(() => ({ results: [] }));

        let pRelated;
        if (activeBrand) {
            pRelated = env.DB.prepare(
                "SELECT id, name, base_price, flash_sale_price, gallery_images, variants FROM products WHERE is_active = 1 AND brand_id = ? AND id != ? ORDER BY is_featured DESC, created_at DESC LIMIT 8"
            ).bind(activeBrand.id, product.id).all().catch(() => ({ results: [] }));
        } else {
            pRelated = env.DB.prepare(
                "SELECT id, name, base_price, flash_sale_price, gallery_images, variants FROM products WHERE is_active = 1 AND (brand_id IS NULL OR brand_id = '') AND id != ? ORDER BY is_featured DESC, created_at DESC LIMIT 8"
            ).bind(product.id).all().catch(() => ({ results: [] }));
        }

        const [reviewsRes, relatedRes] = await Promise.all([pReviews, pRelated]);

        let rawOrigin = (rawSettings?.site_url || env.SITE_URL || url.origin).trim().replace(/\/+$/, '');
        if (rawOrigin && !rawOrigin.startsWith('http://') && !rawOrigin.startsWith('https://')) {
            rawOrigin = 'https://' + rawOrigin;
        }
        const origin = rawOrigin;

        const titleSuffix = activeBrand && storeName.toLowerCase() !== mainStoreName.toLowerCase()
            ? `${storeName} | ${mainStoreName}`
            : storeName;
        const title = (product.seo_title && product.seo_title.trim())
            ? `${product.seo_title.trim()} — ${titleSuffix}`
            : `${product.name} — ${titleSuffix}`;

        const plainProductDesc = (product.description || '').replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
        let rawDesc = (product.seo_description || plainProductDesc || settings?.seo_description || '').replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
        if (rawDesc.length > 160) rawDesc = rawDesc.substring(0, 157) + '...';
        const description = rawDesc || `Buy ${product.name} at best price from ${storeName}. Order online with Cash on Delivery!`;
        const keywords = mergeBrandKeywords(
            [product.name, product.sku, product.tags, product.seo_keywords, rawSettings?.seo_keywords].filter(Boolean).join(', '),
            activeBrand?.seo_keywords,
            activeBrand?.name,
            mainStoreName
        );

        function normalizeImgUrl(u) {
            if (!u || typeof u !== 'string') return null;
            let s = u.trim();
            if (!s || s.startsWith('data:')) return null;
            if (s.startsWith('//')) return 'https:' + s;
            if (s.startsWith('http://') || s.startsWith('https://')) return s;
            return origin + (s.startsWith('/') ? '' : '/') + s;
        }

        let allImages = [];
        try {
            const gallery = typeof product.gallery_images === 'string' ? JSON.parse(product.gallery_images) : (product.gallery_images || []);
            if (Array.isArray(gallery)) {
                gallery.forEach(u => {
                    const clean = normalizeImgUrl(u);
                    if (clean && !allImages.includes(clean)) allImages.push(clean);
                });
            }
        } catch (e) {}

        try {
            const variants = typeof product.variants === 'string' ? JSON.parse(product.variants) : (product.variants || []);
            if (Array.isArray(variants)) {
                variants.forEach(v => {
                    const clean = normalizeImgUrl(v?.imageUrl || v?.image);
                    if (clean && !allImages.includes(clean)) allImages.push(clean);
                });
            }
        } catch (e) {}

        ['image', 'image_url', 'featured_image', 'thumbnail'].forEach(col => {
            if (product[col]) {
                const clean = normalizeImgUrl(product[col]);
                if (clean && !allImages.includes(clean)) allImages.push(clean);
            }
        });

        let imgUrl = allImages.length > 0 ? allImages[0] : (normalizeImgUrl(settings?.seo_og_image) || normalizeImgUrl(settings?.logo_url) || '');

        let imgMimeType = 'image/jpeg';
        const imgLower = (imgUrl || '').toLowerCase();
        if (imgLower.includes('.png')) imgMimeType = 'image/png';
        else if (imgLower.includes('.webp')) imgMimeType = 'image/webp';
        else if (imgLower.includes('.gif')) imgMimeType = 'image/gif';

        const logoUrl = normalizeImgUrl(settings?.logo_url);
        const faviconUrl = normalizeImgUrl(settings?.favicon_url) || logoUrl || (origin + '/favicon.ico');

        const canonicalUrl = `${origin}${prefix}/product?id=${encodeURIComponent(product.id)}`;
        const finalPrice = product.flash_sale_price > 0 ? (product.base_price - product.flash_sale_price) : product.base_price;
        const reviews = reviewsRes?.results || [];
        const relatedProducts = relatedRes?.results || [];

        let additionalOgImages = '';
        if (allImages.length > 1) {
            additionalOgImages = allImages.slice(1, 4).map(extraUrl => {
                let extraMime = 'image/jpeg';
                const el = extraUrl.toLowerCase();
                if (el.includes('.png')) extraMime = 'image/png';
                else if (el.includes('.webp')) extraMime = 'image/webp';
                return `\n    <meta property="og:image" content="${escapeAttr(extraUrl)}">\n    <meta property="og:image:secure_url" content="${escapeAttr(extraUrl)}">\n    <meta property="og:image:type" content="${escapeAttr(extraMime)}">\n    <meta property="og:image:width" content="1200">\n    <meta property="og:image:height" content="1200">\n    <meta property="og:image:alt" content="${escapeAttr(product.name)}">`;
            }).join('');
        }

        const productNode = {
            "@type": "Product",
            "@id": canonicalUrl + "#product",
            "name": product.name,
            "image": allImages.length > 0 ? allImages : (imgUrl ? [imgUrl] : undefined),
            "description": plainProductDesc || description,
            "sku": product.sku || ('SKU-' + product.id),
            "brand": {
                "@type": "Brand",
                "name": storeName
            },
            "offers": {
                "@type": "Offer",
                "url": canonicalUrl,
                "priceCurrency": "BDT",
                "price": finalPrice,
                "priceValidUntil": "2027-12-31",
                "itemCondition": "https://schema.org/NewCondition",
                "availability": product.is_active ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                "seller": {
                    "@type": "Organization",
                    "name": storeName,
                    ...(activeBrand ? {
                        "parentOrganization": {
                            "@type": "Organization",
                            "name": mainStoreName,
                            "url": origin + "/"
                        }
                    } : {})
                }
            }
        };

        if (reviews.length > 0) {
            let sum = 0;
            reviews.forEach(r => { sum += (parseInt(r.rating) || 5); });
            productNode.aggregateRating = {
                "@type": "AggregateRating",
                "ratingValue": (sum / reviews.length).toFixed(1),
                "reviewCount": reviews.length
            };
        }

        const breadcrumbItems = activeBrand ? [
            { "@type": "ListItem", "position": 1, "name": mainStoreName, "item": origin + "/" },
            { "@type": "ListItem", "position": 2, "name": activeBrand.name, "item": `${origin}/${activeBrand.slug}/` },
            { "@type": "ListItem", "position": 3, "name": "Shop", "item": `${origin}/${activeBrand.slug}/shop` },
            { "@type": "ListItem", "position": 4, "name": product.name, "item": canonicalUrl }
        ] : [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": origin + "/" },
            { "@type": "ListItem", "position": 2, "name": "Shop", "item": origin + "/shop" },
            { "@type": "ListItem", "position": 3, "name": product.name, "item": canonicalUrl }
        ];

        const prodSchema = {
            "@context": "https://schema.org",
            "@graph": [
                productNode,
                {
                    "@type": "BreadcrumbList",
                    "@id": canonicalUrl + "#breadcrumb",
                    "itemListElement": breadcrumbItems
                }
            ]
        };

        let relatedCardsHtml = '';
        if (relatedProducts.length > 0) {
            relatedCardsHtml = relatedProducts.map(rp => {
                let rVariants = [];
                try { rVariants = typeof rp.variants === 'string' ? JSON.parse(rp.variants) : (rp.variants || []); } catch (e) {}
                let rGallery = [];
                try { rGallery = typeof rp.gallery_images === 'string' ? JSON.parse(rp.gallery_images) : (rp.gallery_images || []); } catch (e) {}
                let rImg = (rVariants.length && rVariants[0]?.imageUrl) ? rVariants[0].imageUrl : (rGallery[0] || '');
                let rPrice = rp.flash_sale_price > 0 ? (rp.base_price - rp.flash_sale_price) : rp.base_price;
                return `<a href="${prefix}/product?id=${encodeURIComponent(rp.id)}" class="product-card">
                    <div class="product-img-wrap">
                        ${rImg ? `<img src="${escapeAttr(rImg)}" alt="${escapeAttr(rp.name)}" loading="lazy">` : ''}
                    </div>
                    <div class="product-info">
                        <div class="product-name">${escapeAttr(rp.name)}</div>
                        <div class="product-price-row"><span class="product-price">৳${rPrice}</span></div>
                    </div>
                </a>`;
            }).join('');
        }

        const ssrDescHtml = (product.description && product.description.trim())
            ? product.description
            : `<p>${escapeAttr(description)}</p>`;

        const breadcrumbHtml = activeBrand
            ? `<a href="/">${escapeAttr(mainStoreName)}</a> / <a href="${prefix}/">${escapeAttr(activeBrand.name)}</a> / <a href="${prefix}/shop">Shop</a> / <span>${escapeAttr(product.name)}</span>`
            : `<a href="/">Home</a> / <a href="/shop">Shop</a> / <span>${escapeAttr(product.name)}</span>`;

        const brandHeadHtml = buildBrandHeadInjection(activeBrand, rawSettings);

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
                    e.prepend(`${brandHeadHtml}\n    <meta name="robots" content="index, follow, max-image-preview:large">
    <link rel="canonical" href="${escapeAttr(canonicalUrl)}">
    <link rel="icon" type="image/png" href="${escapeAttr(faviconUrl)}">
    <link rel="apple-touch-icon" href="${escapeAttr(faviconUrl)}">
    <link rel="image_src" href="${escapeAttr(imgUrl)}">
    <meta name="description" content="${escapeAttr(description)}">
    <meta name="keywords" content="${escapeAttr(keywords)}">
    <meta property="og:type" content="product">
    <meta property="og:site_name" content="${escapeAttr(storeName)}">
    <meta property="og:title" content="${escapeAttr(title)}">
    <meta property="og:description" content="${escapeAttr(description)}">
    <meta property="og:url" content="${escapeAttr(canonicalUrl)}">
    <meta property="og:image" content="${escapeAttr(imgUrl)}">
    <meta property="og:image:secure_url" content="${escapeAttr(imgUrl)}">
    <meta property="og:image:type" content="${escapeAttr(imgMimeType)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="1200">
    <meta property="og:image:alt" content="${escapeAttr(product.name)}">${additionalOgImages}
    <meta property="product:price:amount" content="${finalPrice}">
    <meta property="product:price:currency" content="BDT">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeAttr(title)}">
    <meta name="twitter:description" content="${escapeAttr(description)}">
    <meta name="twitter:image" content="${escapeAttr(imgUrl)}">
    <meta name="twitter:image:alt" content="${escapeAttr(product.name)}">
    <script type="application/ld+json">${JSON.stringify(prodSchema)}</script>\n`, { html: true });
                }
            })
            .on('#navBrand', { element(e) { e.setInnerContent(storeName); } })
            .on('#footerBrand', { element(e) { e.setInnerContent(storeName); } })
            .on('#productPage', { element(e) { e.setAttribute('style', 'display:grid;'); } })
            .on('#breadcrumb', { element(e) { e.setInnerContent(breadcrumbHtml, { html: true }); } })
            .on('#pName', { element(e) { e.setInnerContent(product.name); } })
            .on('#currentPrice', { element(e) { e.setInnerContent(`৳${finalPrice}`); } })
            .on('#stickyPrice', { element(e) { e.setInnerContent(`৳${finalPrice}`); } })
            .on('#priceOld', {
                element(e) {
                    if (product.flash_sale_price > 0) e.setInnerContent(`৳${product.base_price}`);
                }
            })
            .on('#pSkuWrap', {
                element(e) {
                    if (product.sku) {
                        e.setAttribute('style', 'font-size:11px;color:#888;margin-bottom:12px;display:block;background:var(--bg-subtle);padding:3px 8px;border-radius:6px;width:fit-content;border:1px solid var(--border-light);');
                    }
                }
            })
            .on('#pSkuVal', { element(e) { if (product.sku) e.setInnerContent(product.sku); } })
            .on('#mainImg', {
                element(e) {
                    if (imgUrl) e.setAttribute('src', imgUrl);
                    e.setAttribute('alt', product.name);
                    e.setAttribute('loading', 'eager');
                }
            })
            .on('#pDesc', { element(e) { e.setInnerContent(ssrDescHtml, { html: true }); } })
            .on('a[href]', {
                element(e) {
                    const updated = rewriteAnchorHref(e.getAttribute('href'), activeBrand);
                    if (updated) e.setAttribute('href', updated);
                }
            });

        if (relatedCardsHtml) {
            rewriter = rewriter
                .on('#relatedSection', { element(e) { e.setAttribute('style', 'margin-bottom:20px;display:block;'); } })
                .on('#relatedGrid', { element(e) { e.setInnerContent(relatedCardsHtml, { html: true }); } });
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

