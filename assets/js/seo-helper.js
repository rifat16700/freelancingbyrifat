// ============================================================
// SEO & Meta Tag Management Engine
// Fully dynamic, multi-tenant & client-agnostic
// ============================================================

// Immediately clean up any .html from address bar across the site
(function() {
    if (typeof window !== 'undefined' && window.location && window.location.pathname) {
        var p = window.location.pathname;
        if (p.endsWith('.html')) {
            var clean = p.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
            if (!clean) clean = '/';
            var newUrl = clean + (window.location.search || '') + (window.location.hash || '');
            if (window.history && window.history.replaceState) {
                window.history.replaceState(null, '', newUrl);
            }
        }
    }
})();

window.SEO = (function() {
    // Determine the base site URL (dynamic fallback to current origin)
    function getSiteUrl(settings) {
        var raw = '';
        if (settings && settings.site_url && settings.site_url.trim()) {
            raw = settings.site_url.trim().replace(/\/+$/, '');
        } else if (typeof CONFIG !== 'undefined' && CONFIG.SITE_URL && CONFIG.SITE_URL.trim()) {
            raw = CONFIG.SITE_URL.trim().replace(/\/+$/, '');
        } else {
            raw = window.location.origin.replace(/\/+$/, '');
        }
        if (raw && !raw.startsWith('http://') && !raw.startsWith('https://')) {
            raw = 'https://' + raw;
        }
        return raw;
    }

    // Set or create a <meta> tag
    function setMeta(key, value, isProperty) {
        if (value === undefined || value === null) return;
        var attr = isProperty ? 'property' : 'name';
        var el = document.querySelector('meta[' + attr + '="' + key + '"]');
        if (!el) {
            el = document.createElement('meta');
            el.setAttribute(attr, key);
            document.head.appendChild(el);
        }
        el.setAttribute('content', value);
    }

    // Set or create a canonical <link>
    function setCanonical(url) {
        if (!url) return;
        var link = document.querySelector('link[rel="canonical"]');
        if (!link) {
            link = document.createElement('link');
            link.setAttribute('rel', 'canonical');
            document.head.appendChild(link);
        }
        link.setAttribute('href', url);
    }

    // Set or update Favicon & Touch Icons
    function setFavicon(url) {
        if (!url) return;
        var icons = document.querySelectorAll('link[rel~="icon"]');
        if (icons && icons.length > 0) {
            icons.forEach(function(el) { el.href = url; });
        } else {
            var el = document.createElement('link');
            el.rel = 'icon';
            el.href = url;
            document.head.appendChild(el);
        }
        var apple = document.querySelector('link[rel="apple-touch-icon"]');
        if (apple) {
            apple.href = url;
        } else {
            var a = document.createElement('link');
            a.rel = 'apple-touch-icon';
            a.href = url;
            document.head.appendChild(a);
        }
    }

    // Set or create a JSON-LD structured data script
    function setJsonLd(id, data) {
        if (!data) return;
        var scriptId = 'jsonld-' + id;
        var el = document.getElementById(scriptId);
        if (!el) {
            el = document.createElement('script');
            el.id = scriptId;
            el.type = 'application/ld+json';
            document.head.appendChild(el);
        }
        el.textContent = JSON.stringify(data);
    }

    // Strip HTML tags for clean plain-text description
    function stripHtml(html) {
        if (!html) return '';
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        var txt = tmp.textContent || tmp.innerText || '';
        return txt.replace(/\s+/g, ' ').trim();
    }

    // Apply General SEO for any page
    function applyPageSEO(opts) {
        opts = opts || {};
        var settings = opts.settings || {};
        var siteUrl = getSiteUrl(settings);
        var storeName = settings.store_name || (typeof CONFIG !== 'undefined' ? CONFIG.STORE_NAME : '') || 'Store';

        // 1. Robots
        if (opts.noindex) {
            setMeta('robots', 'noindex, nofollow');
        } else {
            setMeta('robots', 'index, follow, max-image-preview:large');
        }

        // 2. Title & Descriptions
        var title = opts.title || settings.seo_title || (storeName + ' — Online Shopping');
        document.title = title;

        var desc = opts.description || settings.seo_description || settings.footer_text || ('Shop online at ' + storeName + ' for best quality products at unbeatable prices.');
        setMeta('description', desc);

        var keywords = opts.keywords || settings.seo_keywords || '';
        if (keywords) setMeta('keywords', keywords);

        // Google Site Verification
        if (settings.google_site_verification) {
            setMeta('google-site-verification', settings.google_site_verification);
        }

        // 3. Canonical URL
        var cleanPath = window.location.pathname
            .replace(/\/index\.html$/, '/')
            .replace(/\.html$/, '');
        var pageUrl = opts.url || (siteUrl + cleanPath + (window.location.search || ''));
        pageUrl = pageUrl.replace(/\/index\.html(\?|$)/, '/$1').replace(/\.html(\?|$)/, '$1');
        setCanonical(pageUrl);

        // 4. Open Graph (Facebook, WhatsApp, LinkedIn, etc.)
        setMeta('og:type', opts.type || 'website', true);
        setMeta('og:site_name', storeName, true);
        setMeta('og:title', title, true);
        setMeta('og:description', desc, true);
        setMeta('og:url', pageUrl, true);
        
        var imgUrl = opts.image || settings.seo_og_image || settings.logo_url || '';
        if (imgUrl && !imgUrl.startsWith('http')) {
            imgUrl = siteUrl + (imgUrl.startsWith('/') ? '' : '/') + imgUrl;
        }
        if (imgUrl) {
            setMeta('og:image', imgUrl, true);
            setMeta('og:image:secure_url', imgUrl, true);
            var mime = imgUrl.toLowerCase().includes('.png') ? 'image/png' : (imgUrl.toLowerCase().includes('.webp') ? 'image/webp' : 'image/jpeg');
            setMeta('og:image:type', mime, true);
            setMeta('og:image:width', '1200', true);
            setMeta('og:image:height', (opts.type === 'product' ? '1200' : '630'), true);
            setMeta('og:image:alt', title, true);
            setMeta('twitter:image', imgUrl);
            setMeta('twitter:image:alt', title);
        }

        // 5. Twitter Cards
        setMeta('twitter:card', 'summary_large_image');
        setMeta('twitter:title', title);
        setMeta('twitter:description', desc);

        // 6. Favicon & Touch Icon
        var favUrl = (settings.favicon_url && settings.favicon_url.trim()) || (settings.logo_url && settings.logo_url.trim());
        if (favUrl) {
            setFavicon(favUrl);
        }

        // 7. JSON-LD Structured Data
        if (opts.jsonLd) {
            setJsonLd(opts.jsonLdId || 'page', opts.jsonLd);
        }
    }

    // Homepage SEO with WebSite & Store/Organization schema
    function applyHomeSEO(settings) {
        settings = settings || {};
        var siteUrl = getSiteUrl(settings);
        var storeName = settings.store_name || (typeof CONFIG !== 'undefined' ? CONFIG.STORE_NAME : '') || 'Store';

        var title = settings.seo_title || (storeName + ' — Online Shopping in Bangladesh');
        var desc = settings.seo_description || settings.footer_text || ('Welcome to ' + storeName + '. Best quality products, fastest delivery, and cash on delivery all over Bangladesh.');
        var img = settings.seo_og_image || settings.logo_url || '';
        var logoImg = (settings.logo_url && settings.logo_url.trim()) || (settings.favicon_url && settings.favicon_url.trim()) || '';
        if (logoImg && !logoImg.startsWith('http')) {
            logoImg = siteUrl + (logoImg.startsWith('/') ? '' : '/') + logoImg;
        }

        var jsonLd = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "WebSite",
                    "@id": siteUrl + "/#website",
                    "url": siteUrl,
                    "name": storeName,
                    "alternateName": [storeName, siteUrl.replace(/^https?:\/\//, '')],
                    "description": desc,
                    "potentialAction": [
                        {
                            "@type": "SearchAction",
                            "target": {
                                "@type": "EntryPoint",
                                "urlTemplate": siteUrl + "/shop?search={search_term_string}"
                            },
                            "query-input": "required name=search_term_string"
                        }
                    ]
                },
                {
                    "@type": "OnlineStore",
                    "@id": siteUrl + "/#organization",
                    "name": storeName,
                    "url": siteUrl,
                    "logo": logoImg ? {
                        "@type": "ImageObject",
                        "url": logoImg
                    } : undefined,
                    "image": logoImg || undefined,
                    "description": desc,
                    "telephone": settings.whatsapp_number ? ('+88' + settings.whatsapp_number.replace(/^88/, '')) : undefined,
                    "sameAs": [
                        settings.facebook_url,
                        settings.instagram_url,
                        settings.youtube_url
                    ].filter(Boolean)
                }
            ]
        };

        var brandPrefix = (typeof window !== 'undefined' && window.BRAND && typeof window.BRAND.isBrand === 'function' && window.BRAND.isBrand())
            ? ('/' + window.BRAND.slug())
            : '';
        var mainStoreSuffix = (settings._main_store_name && settings._main_store_name !== storeName && !title.toLowerCase().includes(settings._main_store_name.toLowerCase()))
            ? (' | ' + settings._main_store_name)
            : '';

        applyPageSEO({
            settings: settings,
            title: title + mainStoreSuffix,
            description: desc,
            keywords: settings.seo_keywords,
            image: img,
            url: siteUrl + (brandPrefix ? brandPrefix + '/' : '/'),
            type: 'website',
            jsonLd: jsonLd,
            jsonLdId: 'website'
        });
    }

    // Product Detail Page SEO with Product Schema
    function applyProductSEO(product, settings, reviews) {
        if (!product) return;
        settings = settings || {};
        var siteUrl = getSiteUrl(settings);
        var storeName = settings.store_name || (typeof CONFIG !== 'undefined' ? CONFIG.STORE_NAME : '') || 'Store';

        var title = (product.seo_title && product.seo_title.trim()) ? product.seo_title.trim() : (product.name + ' — ' + storeName);
        var rawDesc = stripHtml(product.description);
        var customDesc = (product.seo_description && product.seo_description.trim()) ? product.seo_description.trim() : '';
        var desc = customDesc || (rawDesc ? (rawDesc.length > 160 ? rawDesc.substring(0, 157) + '...' : rawDesc) : ('Buy ' + product.name + ' at best price online from ' + storeName + '. Cash on delivery available.'));

        // Collect all product images for Google Image Indexing
        var allImgs = [];
        function addImg(u) {
            if (!u || typeof u !== 'string') return;
            var s = u.trim();
            if (!s || s.startsWith('data:')) return;
            var full = s.startsWith('//') ? ('https:' + s) : (s.startsWith('http://') || s.startsWith('https://') ? s : (siteUrl + (s.startsWith('/') ? '' : '/') + s));
            if (!allImgs.includes(full)) allImgs.push(full);
        }

        var gallery = Array.isArray(product.gallery_images) ? product.gallery_images : [];
        gallery.forEach(addImg);
        if (Array.isArray(product.variants)) {
            product.variants.forEach(function(v) {
                if (v && (v.imageUrl || v.image)) addImg(v.imageUrl || v.image);
            });
        }
        ['image', 'image_url', 'featured_image', 'thumbnail'].forEach(function(k) {
            if (product[k]) addImg(product[k]);
        });

        // The product preview image MUST be the product's own photo
        var img = allImgs.length > 0 ? allImgs[0] : (settings.seo_og_image || settings.logo_url || '');
        if (img && !img.startsWith('http')) {
            img = siteUrl + (img.startsWith('/') ? '' : '/') + img;
        }

        var brandPrefix = (typeof window !== 'undefined' && window.BRAND && typeof window.BRAND.isBrand === 'function' && window.BRAND.isBrand())
            ? ('/' + window.BRAND.slug())
            : '';
        if (settings._main_store_name && settings._main_store_name !== storeName && !title.toLowerCase().includes(settings._main_store_name.toLowerCase())) {
            title += ' | ' + settings._main_store_name;
        }
        var prodUrl = siteUrl + brandPrefix + '/product?id=' + encodeURIComponent(product.id);
        var finalPrice = (product.flash_sale_price > 0) ? (product.base_price - product.flash_sale_price) : (product.base_price || 0);

        // Product Schema with Multiple Images and Offer
        var prodSchema = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "Product",
                    "@id": prodUrl + "#product",
                    "name": product.name,
                    "image": allImgs.length > 0 ? allImgs : (img ? [img] : undefined),
                    "description": desc,
                    "sku": product.sku || ('SKU-' + product.id),
                    "offers": {
                        "@type": "Offer",
                        "url": prodUrl,
                        "priceCurrency": "BDT",
                        "price": finalPrice,
                        "itemCondition": "https://schema.org/NewCondition",
                        "availability": product.is_active ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                        "seller": {
                            "@type": "Organization",
                            "name": storeName
                        }
                    }
                },
                {
                    "@type": "BreadcrumbList",
                    "@id": prodUrl + "#breadcrumb",
                    "itemListElement": [
                        {
                            "@type": "ListItem",
                            "position": 1,
                            "name": "Home",
                            "item": siteUrl + "/"
                        },
                        {
                            "@type": "ListItem",
                            "position": 2,
                            "name": "Shop",
                            "item": siteUrl + "/shop"
                        },
                        {
                            "@type": "ListItem",
                            "position": 3,
                            "name": product.name,
                            "item": prodUrl
                        }
                    ]
                }
            ]
        };

        // Aggregate Rating if reviews exist
        if (Array.isArray(reviews) && reviews.length > 0) {
            var sum = 0;
            reviews.forEach(function(r) { sum += (parseInt(r.rating) || 5); });
            var avg = (sum / reviews.length).toFixed(1);
            prodSchema["@graph"][0].aggregateRating = {
                "@type": "AggregateRating",
                "ratingValue": avg,
                "reviewCount": reviews.length
            };
        }

        // Merge site keywords + product custom keywords/tags
        var kwList = [];
        if (settings.seo_keywords) kwList.push(settings.seo_keywords);
        if (product.seo_keywords) kwList.push(product.seo_keywords);
        if (product.tags) kwList.push(product.tags);
        kwList.push(product.name);

        applyPageSEO({
            settings: settings,
            title: title,
            description: desc,
            keywords: kwList.join(', '),
            image: img,
            url: prodUrl,
            type: 'product',
            jsonLd: prodSchema,
            jsonLdId: 'product'
        });

        // Add product price OG meta
        setMeta('product:price:amount', finalPrice, true);
        setMeta('product:price:currency', 'BDT', true);
    }

    // Shop Catalog Page SEO
    function applyShopSEO(settings, catName, searchTerm) {
        settings = settings || {};
        var siteUrl = getSiteUrl(settings);
        var storeName = settings.store_name || (typeof CONFIG !== 'undefined' ? CONFIG.STORE_NAME : '') || 'Store';

        var title = 'Shop All Products — ' + storeName;
        if (catName) title = catName + ' Collection — ' + storeName;
        else if (searchTerm) title = 'Search: ' + searchTerm + ' — ' + storeName;

        var brandPrefix = (typeof window !== 'undefined' && window.BRAND && typeof window.BRAND.isBrand === 'function' && window.BRAND.isBrand())
            ? ('/' + window.BRAND.slug())
            : '';
        if (settings._main_store_name && settings._main_store_name !== storeName && !title.toLowerCase().includes(settings._main_store_name.toLowerCase())) {
            title += ' | ' + settings._main_store_name;
        }
        var desc = 'Browse our complete catalog of quality items on ' + storeName + '. Enjoy fast shipping and secure cash on delivery.';
        var pageUrl = siteUrl + brandPrefix + '/shop' + (window.location.search || '');

        var jsonLd = {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": title,
            "description": desc,
            "url": pageUrl
        };

        applyPageSEO({
            settings: settings,
            title: title,
            description: desc,
            keywords: settings.seo_keywords,
            image: settings.seo_og_image || settings.logo_url,
            url: pageUrl,
            type: 'website',
            jsonLd: jsonLd,
            jsonLdId: 'shop'
        });
    }

    return {
        getSiteUrl: getSiteUrl,
        setMeta: setMeta,
        setCanonical: setCanonical,
        setJsonLd: setJsonLd,
        applyPageSEO: applyPageSEO,
        applyHomeSEO: applyHomeSEO,
        applyProductSEO: applyProductSEO,
        applyShopSEO: applyShopSEO
    };
})();
