// ============================================================
// Bulk Product Copy & Edit Studio + Permanent Auto-SKU Engine
// Format: [2 Letters from Product Name]-[3 to 4 Digit Number]
// SKU is ONLY generated when clicking the "Auto Generate" button
// so that product URLs/SKUs stay 100% permanent for sharing!
// ============================================================

(function() {
    'use strict';

    var bulkStagedItems = [];
    var domainCatalogCache = {};
    var isBulkSaving = false;

    // Common English filler words to ignore when picking 2-letter SKU prefix
    var STOP_WORDS = new Set([
        'the', 'and', 'for', 'with', 'from', 'in', 'on', 'at', 'to', 'of', 'by',
        'bd', 'bangladesh', 'price', 'online', 'shop', 'store', 'new', 'best', 'buy', 'original'
    ]);

    // Common Bangla keyword to 2-letter SKU prefix mapping
    var BANGLA_PREFIX_MAP = [
        { kw: ['পাঞ্জাবি', 'পাঞ্জাবী'], prefix: 'PJ' },
        { kw: ['ঘড়ি', 'ঘড়ি', 'ওয়াচ', 'ওয়াচ'], prefix: 'WC' },
        { kw: ['টি-শার্ট', 'টিশার্ট', 'গেঞ্জি'], prefix: 'TS' },
        { kw: ['শার্ট'], prefix: 'SH' },
        { kw: ['প্যান্ট', 'জিন্স', 'ট্রাউজার'], prefix: 'PT' },
        { kw: ['জুতা', 'স্নিকার', 'লোফার', 'স্যান্ডেল'], prefix: 'SH' },
        { kw: ['ব্যাগ', 'মানিব্যাগ', 'ওয়ালেট', 'ওয়ালেট'], prefix: 'BG' },
        { kw: ['চশমা', 'সানগ্লাস'], prefix: 'GL' },
        { kw: ['ইয়ারবাড', 'ইয়ারবাড', 'হেডফোন', 'এয়ারপড'], prefix: 'EB' },
        { kw: ['শাড়ি', 'শাড়ি'], prefix: 'SR' },
        { kw: ['থ্রি-পিস', 'থ্রি পিস', 'কুর্তি', 'কামিজ'], prefix: 'KP' },
        { kw: ['বোরকা', 'হিজাব', 'আবায়া'], prefix: 'BK' },
        { kw: ['পারফিউম', 'আতর', 'বডি স্প্রে'], prefix: 'PF' },
        { kw: ['কনসোল', 'গেম', 'গেমিং', 'খেলনা'], prefix: 'GM' },
        { kw: ['হুডি', 'জ্যাকেট', 'সোয়েটার'], prefix: 'HD' }
    ];

    var BANGLA_CHAR_MAP = {
        'ক':'K','খ':'K','গ':'G','ঘ':'G','চ':'C','ছ':'C','জ':'J','ঝ':'J',
        'ট':'T','ঠ':'T','ড':'D','ঢ':'D','ত':'T','থ':'T','দ':'D','ধ':'D',
        'ন':'N','ণ':'N','প':'P','ফ':'F','ব':'B','ভ':'V','ম':'M','য':'J',
        'র':'R','ল':'L','শ':'S','ষ':'S','স':'S','হ':'H','অ':'A','আ':'A',
        'ই':'I','ঈ':'I','উ':'U','ঊ':'U','এ':'E','ও':'O'
    };

    /**
     * Extract 2 uppercase letters from product name
     */
    function extractSkuPrefix(name) {
        var raw = (name || '').trim();
        if (!raw) return 'PR';

        // 1. Try Latin words first
        var latinWords = (raw.match(/[A-Za-z]+/g) || []).filter(function(w) {
            return w.length >= 1;
        });

        var meaningful = latinWords.filter(function(w) {
            return w.length >= 2 && !STOP_WORDS.has(w.toLowerCase());
        });
        var pool = meaningful.length > 0 ? meaningful : latinWords;

        if (pool.length >= 2) {
            return (pool[0].charAt(0) + pool[1].charAt(0)).toUpperCase();
        }
        if (pool.length === 1 && pool[0].length >= 2) {
            return pool[0].substring(0, 2).toUpperCase();
        }

        // 2. Check Bangla keyword dictionary
        for (var i = 0; i < BANGLA_PREFIX_MAP.length; i++) {
            var entry = BANGLA_PREFIX_MAP[i];
            for (var j = 0; j < entry.kw.length; j++) {
                if (raw.indexOf(entry.kw[j]) !== -1) {
                    return entry.prefix;
                }
            }
        }

        // 3. Phonetic transliteration from Bangla letters
        var letters = '';
        for (var c = 0; c < raw.length && letters.length < 2; c++) {
            var ch = raw.charAt(c);
            if (/[A-Za-z]/.test(ch)) {
                letters += ch.toUpperCase();
            } else if (BANGLA_CHAR_MAP[ch]) {
                letters += BANGLA_CHAR_MAP[ch];
            }
        }
        if (letters.length === 2) return letters;
        if (letters.length === 1) return letters + 'X';
        return 'PR';
    }

    /**
     * Central Canonical Tag Merger for Bulk Studio
     * Perfectly replicates the store's normal SEO rule:
     * Combines:
     * 1. Product AI / Manual Custom Tags
     * 2. Product Name automatic keywords (words > 2 letters)
     * 3. Selected Category Names
     * 4. Store SEO Keywords (from site_settings.seo_keywords)
     * 5. Store Name (from site_settings.store_name)
     */
    function computeFullMergedTags(item, extraTags) {
        if (!item) return '';
        var name = (item.name || '').trim();
        var catIds = Array.isArray(item.category_ids) ? item.category_ids.map(String) : [];
        var cats = (typeof allCategories !== 'undefined' && Array.isArray(allCategories)) ? allCategories : [];
        var catNames = catIds.map(function(cid) {
            var found = cats.find(function(c) { return String(c.id) === String(cid); });
            return found ? found.name : '';
        }).filter(Boolean);

        var existingTags = (item.tags || '').trim();
        var toMerge = extraTags ? (existingTags ? existingTags + ', ' + extraTags : extraTags) : existingTags;

        if (typeof ImageSeoInjector !== 'undefined' && typeof ImageSeoInjector.buildMergedTags === 'function') {
            var merged = ImageSeoInjector.buildMergedTags({
                productName: name,
                categoryNames: catNames,
                productTags: toMerge
            });
            if (merged && merged.length > 0) {
                return merged.join(', ');
            }
        }

        // Native fallback merging
        var tagSet = new Set();
        if (toMerge) {
            toMerge.split(',').forEach(function(t) {
                var s = t.trim();
                if (s && s.length > 1) tagSet.add(s);
            });
        }
        if (name) {
            tagSet.add(name);
            name.split(/[\s,-]+/).forEach(function(w) {
                var s = w.trim();
                if (s && s.length > 2) tagSet.add(s);
            });
        }
        catNames.forEach(function(c) {
            var s = c.trim();
            if (s) tagSet.add(s);
        });

        try {
            var cached = localStorage.getItem('site_settings_cache');
            if (cached) {
                var st = JSON.parse(cached);
                if (st.seo_keywords) {
                    st.seo_keywords.split(',').forEach(function(k) {
                        var s = k.trim();
                        if (s && s.length > 1) tagSet.add(s);
                    });
                }
                if (st.store_name) {
                    var sn = st.store_name.trim();
                    if (sn) tagSet.add(sn);
                }
            }
        } catch(e) {}

        return Array.from(tagSet).join(', ');
    }

    /**
     * Generate a unique SKU in format XX-1234 (2 letters from product name + '-' + 3 to 4 digits)
     */
    window.generateAutoSku = function(productName, extraUsedSkus) {
        var prefix = extractSkuPrefix(productName);
        var used = new Set();

        if (typeof allProducts !== 'undefined' && Array.isArray(allProducts)) {
            allProducts.forEach(function(p) {
                if (p && p.sku) used.add(String(p.sku).trim().toUpperCase());
                if (p && p.id)  used.add(String(p.id).trim().toUpperCase());
            });
        }

        bulkStagedItems.forEach(function(item) {
            if (item && item.sku) used.add(String(item.sku).trim().toUpperCase());
        });

        if (extraUsedSkus) {
            if (Array.isArray(extraUsedSkus)) {
                extraUsedSkus.forEach(function(s) { if (s) used.add(String(s).trim().toUpperCase()); });
            } else if (extraUsedSkus instanceof Set) {
                extraUsedSkus.forEach(function(s) { if (s) used.add(String(s).trim().toUpperCase()); });
            }
        }

        // Generate 3 to 4 digit number (e.g. 101 to 9999)
        for (var attempt = 0; attempt < 200; attempt++) {
            var useFourDigits = (attempt % 3 !== 0);
            var num = useFourDigits
                ? Math.floor(1000 + Math.random() * 9000)
                : Math.floor(101 + Math.random() * 899);
            var candidate = prefix + '-' + num;
            if (!used.has(candidate)) {
                return candidate;
            }
        }
        return prefix + '-' + Math.floor(1000 + Math.random() * 9000);
    };

    /**
     * Explicit button click handler for Single Product Modal "⚡ Auto Generate" SKU button.
     * Generates the SKU once and keeps it 100% permanent (does not change on typing name).
     */
    window.fillSingleProductAutoSku = function() {
        var nameInput = document.getElementById('pName');
        var skuInput  = document.getElementById('pSku');
        if (!skuInput) return;
        var prodName = nameInput ? nameInput.value.trim() : '';
        if (!prodName) {
            if (typeof showToast === 'function') showToast('SKU তৈরি করতে আগে প্রোডাক্টের নাম লিখুন!', 'warning');
            if (nameInput) nameInput.focus();
            return;
        }
        var newSku = window.generateAutoSku(prodName);
        skuInput.value = newSku;
        if (typeof showToast === 'function') showToast('✅ Permanent SKU Generated: ' + newSku, 'success');
    };

    // ── Network & API Helpers for Full Store (`/api/public-data`) & URLs ─────
    async function fetchWithTimeout(url, timeoutMs) {
        var controller = new AbortController();
        var timer = setTimeout(function() { controller.abort(); }, timeoutMs || 9000);
        try {
            var res = await fetch(url, { signal: controller.signal });
            clearTimeout(timer);
            return res;
        } catch (err) {
            clearTimeout(timer);
            throw err;
        }
    }

    async function tryFetchJsonWithProxy(url) {
        var attempts = [
            url,
            'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
            'https://corsproxy.io/?' + encodeURIComponent(url)
        ];
        for (var i = 0; i < attempts.length; i++) {
            try {
                var res = await fetchWithTimeout(attempts[i], 8500);
                if (res.ok) {
                    var json = await res.json();
                    if (json) return json;
                }
            } catch (e) {}
        }
        return null;
    }

    /**
     * Fetch ALL products from a site's `/api/public-data` endpoint (including `?all=1` AND any `?chunk=1,2...` pages!)
     */
    async function getDomainCatalog(origin, onProgress) {
        if (domainCatalogCache[origin]) return domainCatalogCache[origin];

        if (onProgress) onProgress('📡 ' + origin + '/api/public-data থেকে ডাটা আনা হচ্ছে...');

        // 1. Try `/api/public-data?all=1` first (returns all products in 1 call on updated sites)
        var initialRes = await tryFetchJsonWithProxy(origin + '/api/public-data?all=1');
        if (!initialRes) {
            initialRes = await tryFetchJsonWithProxy(origin + '/api/public-data');
        }

        if (initialRes) {
            var payload = initialRes.data || initialRes;
            var allProds = Array.isArray(payload.products) ? payload.products.slice() : [];
            var cats = Array.isArray(payload.categories) ? payload.categories : [];
            var pc   = Array.isArray(payload.product_categories) ? payload.product_categories : [];

            // 2. If the target site did not return all products at once and has chunks (`has_more: true`), fetch all remaining chunks!
            var hasMore = Boolean(payload.has_more);
            var nextChunk = payload.next_chunk || 1;
            var safetyCounter = 0;

            while (hasMore && nextChunk && safetyCounter < 30) {
                safetyCounter++;
                if (onProgress) onProgress('📦 ' + origin + ' থেকে প্রোডাক্ট চাঙ্ক #' + nextChunk + ' লোড হচ্ছে (' + allProds.length + 'টি পাওয়া গেছে)...');
                var chunkRes = await tryFetchJsonWithProxy(origin + '/api/public-data?chunk=' + nextChunk);
                if (chunkRes && Array.isArray(chunkRes.products) && chunkRes.products.length > 0) {
                    var existingIds = new Set(allProds.map(function(p) { return String(p.id); }));
                    chunkRes.products.forEach(function(cp) {
                        if (!existingIds.has(String(cp.id))) {
                            allProds.push(cp);
                            existingIds.add(String(cp.id));
                        }
                    });
                    hasMore = Boolean(chunkRes.has_more);
                    nextChunk = chunkRes.next_chunk;
                } else {
                    break;
                }
            }

            if (allProds.length > 0) {
                domainCatalogCache[origin] = {
                    products: allProds,
                    categories: cats,
                    product_categories: pc
                };
                return domainCatalogCache[origin];
            }
        }

        // 3. Fallback: Try `/api/d1-query` if `/api/public-data` wasn't available
        try {
            var d1Url = origin + '/api/d1-query';
            var d1Res = await fetchWithTimeout(d1Url, 7000);
            if (d1Res.ok) {
                // Not GET, try POST
            }
        } catch (e) {}

        // 4. Fallback: Try `/products.json` (Shopify / standard stores)
        var shopifyRes = await tryFetchJsonWithProxy(origin + '/products.json?limit=250');
        if (shopifyRes && Array.isArray(shopifyRes.products) && shopifyRes.products.length > 0) {
            var mappedShopify = shopifyRes.products.map(function(sp) {
                var imgs = (sp.images || []).map(function(im) { return im.src; }).filter(Boolean);
                var firstVar = (sp.variants && sp.variants[0]) || {};
                return {
                    id: sp.handle || String(sp.id),
                    name: sp.title,
                    description: sp.body_html || '',
                    base_price: parseInt(firstVar.price, 10) || 0,
                    flash_sale_price: 0,
                    sku: firstVar.sku || '',
                    gallery_images: imgs,
                    variants: [],
                    tags: Array.isArray(sp.tags) ? sp.tags.join(', ') : (sp.tags || '')
                };
            });
            domainCatalogCache[origin] = {
                products: mappedShopify,
                categories: [],
                product_categories: []
            };
            return domainCatalogCache[origin];
        }

        return null;
    }

    async function fetchSingleProductByUrl(rawUrl) {
        var cleanUrl = (rawUrl || '').trim();
        if (!cleanUrl) return null;
        if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = 'https://' + cleanUrl;

        var parsedUrl;
        try {
            parsedUrl = new URL(cleanUrl);
        } catch (e) {
            return null;
        }

        var origin = parsedUrl.origin;
        var productId = parsedUrl.searchParams.get('id') ||
                        parsedUrl.searchParams.get('product_id') ||
                        parsedUrl.searchParams.get('pid') ||
                        parsedUrl.searchParams.get('p');

        if (!productId) {
            var pathMatch = parsedUrl.pathname.match(/\/product(?:s)?\/([a-zA-Z0-9_\-]+)/i) ||
                            parsedUrl.pathname.match(/\/p\/([a-zA-Z0-9_\-]+)/i);
            if (pathMatch && pathMatch[1]) {
                productId = pathMatch[1].replace(/\.html$/i, '');
            }
        }

        var productData = null;

        // 1. Check cached domain catalog first
        var catalog = await getDomainCatalog(origin);
        if (catalog && Array.isArray(catalog.products)) {
            if (productId) {
                productData = catalog.products.find(function(p) {
                    return String(p.id) === String(productId) || p.slug === productId;
                });
            }
            if (!productData) {
                var slugCand = parsedUrl.searchParams.get('slug') || parsedUrl.pathname.split('/').pop().replace(/\.html$/i, '');
                if (slugCand && slugCand !== 'product' && slugCand !== 'shop' && slugCand !== 'index') {
                    productData = catalog.products.find(function(p) {
                        return (p.slug && p.slug === slugCand) || (String(p.id) === String(slugCand));
                    });
                }
            }
        }

        // 2. Direct single-product API lookup if productId is present
        if (!productData && productId) {
            var apiDirect = origin + '/api/public-data?product_id=' + encodeURIComponent(productId);
            var resJson = await tryFetchJsonWithProxy(apiDirect);
            if (resJson && resJson.product) {
                productData = resJson.product;
            }
        }

        // 3. Fallback: Scrape HTML page via DOM & JSON-LD
        if (!productData) {
            var htmlText = null;
            try {
                var r1 = await fetchWithTimeout('https://api.allorigins.win/raw?url=' + encodeURIComponent(cleanUrl), 8500);
                if (r1.ok) htmlText = await r1.text();
            } catch (e) {}
            if (!htmlText) {
                try {
                    var r2 = await fetchWithTimeout('https://corsproxy.io/?' + encodeURIComponent(cleanUrl), 8500);
                    if (r2.ok) htmlText = await r2.text();
                } catch (e) {}
            }

            if (htmlText) {
                var doc = new DOMParser().parseFromString(htmlText, 'text/html');
                var scripts = doc.querySelectorAll('script[type="application/ld+json"]');
                for (var s = 0; s < scripts.length; s++) {
                    try {
                        var ld = JSON.parse(scripts[s].textContent || '');
                        var item = ld['@type'] === 'Product' ? ld : (Array.isArray(ld['@graph']) ? ld['@graph'].find(function(x){ return x['@type'] === 'Product'; }) : null);
                        if (item && item.name) {
                            productData = {
                                name: item.name,
                                description: item.description || '',
                                base_price: item.offers ? (parseInt(item.offers.price || item.offers.highPrice || item.offers.lowPrice, 10) || 0) : 0,
                                gallery_images: Array.isArray(item.image) ? item.image : (item.image ? [item.image] : []),
                                sku: item.sku || ''
                            };
                            break;
                        }
                    } catch (le) {}
                }

                if (!productData) {
                    var ogTitle = (doc.querySelector('meta[property="og:title"]') || {}).content || doc.title || '';
                    var ogDesc  = (doc.querySelector('meta[property="og:description"]') || doc.querySelector('meta[name="description"]') || {}).content || '';
                    var ogImage = (doc.querySelector('meta[property="og:image"]') || {}).content || '';
                    var priceEl = doc.querySelector('#currentPrice, .price-tag, .product-price, .current-price, [data-price]');
                    var parsedPrice = priceEl ? (parseInt(priceEl.textContent.replace(/[^0-9]/g, ''), 10) || 0) : 0;
                    var descEl = doc.querySelector('#pDesc, .product-description');

                    var imgs = [];
                    if (ogImage) imgs.push(ogImage);
                    doc.querySelectorAll('.gallery-thumb, .gallery-main img, .product-gallery img').forEach(function(img) {
                        var src = img.getAttribute('src') || img.getAttribute('data-src');
                        if (src && !imgs.includes(src) && !src.includes('avatar') && !src.includes('logo')) {
                            if (!src.startsWith('http')) {
                                try { src = new URL(src, origin).href; } catch(e){}
                            }
                            imgs.push(src);
                        }
                    });

                    var titleClean = ogTitle.split('—')[0].split('|')[0].trim();
                    if (titleClean) {
                        productData = {
                            name: titleClean,
                            description: (descEl && descEl.innerHTML.trim()) ? descEl.innerHTML.trim() : ogDesc,
                            base_price: parsedPrice,
                            gallery_images: imgs
                        };
                    }
                }
            }
        }

        if (!productData || (!productData.name && !productData.title)) return null;
        return normalizeRawProductToStagedItem(productData, cleanUrl);
    }

    function normalizeRawProductToStagedItem(raw, sourceUrl, matchedCatIds) {
        var prodName = (raw.name || raw.title || 'Untitled Product').trim();
        var gImages = raw.gallery_images;
        if (typeof gImages === 'string') {
            try { gImages = JSON.parse(gImages); } catch (e) { gImages = gImages ? [gImages] : []; }
        }
        if (!Array.isArray(gImages)) gImages = raw.image ? [raw.image] : [];
        gImages = gImages.filter(Boolean);

        var vData = raw.variants;
        if (typeof vData === 'string') {
            try { vData = JSON.parse(vData); } catch (e) { vData = []; }
        }
        if (!Array.isArray(vData)) vData = [];

        // Keep original SKU if valid, otherwise leave empty until user clicks "⚡ Auto Generate"
        var rawSku = (raw.sku || '').trim();
        if (/^sku[-_]/i.test(rawSku) || /^prod[-_]/i.test(rawSku)) {
            rawSku = '';
        }

        // Automatically generate complete tags: Product Tokens + Categories + Store SEO Keywords + Store Name
        var initialRawTags = (raw.tags || raw.seo_keywords || '').trim();
        var tempItem = {
            name: prodName,
            category_ids: Array.isArray(matchedCatIds) ? matchedCatIds : [],
            tags: initialRawTags
        };
        var initTags = computeFullMergedTags(tempItem, initialRawTags);

        var initSlug = (raw.slug || '').trim();
        if (!initSlug) {
            initSlug = (typeof ImageSeoInjector !== 'undefined' && typeof ImageSeoInjector.slugify === 'function')
                ? ImageSeoInjector.slugify(prodName)
                : prodName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'product';
        }

        var initTitle = (raw.seo_title || '').trim() || (prodName + ' — সেরা দামে কিনুন BD');
        var initDesc  = (raw.seo_description || '').trim() || (prodName + ' কিনুন সবচেয়ে সাশ্রয়ী মূল্যে। ১০০% প্রিমিয়াম কোয়ালিটি ও আকর্ষণীয় ডিজাইন। সারা বাংলাদেশে দ্রুত ক্যাশ অন ডেলিভারি সুবিধা!');

        return {
            _uid: 'bulk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            selected: true,
            expanded: false,
            sourceUrl: sourceUrl || '',
            name: prodName,
            sku: rawSku,
            base_price: parseInt(raw.base_price, 10) || 0,
            flash_sale_price: parseInt(raw.flash_sale_price, 10) || 0,
            description: raw.description || '',
            gallery_images: gImages,
            variants: JSON.parse(JSON.stringify(vData)),
            video_url: raw.video_url || '',
            video_type: raw.video_type || 'auto',
            tags: initTags,
            seo_title: initTitle,
            seo_description: initDesc,
            slug: initSlug,
            is_active: raw.is_active !== undefined ? Boolean(raw.is_active) : true,
            is_featured: Boolean(raw.is_featured),
            is_add_once: Boolean(raw.is_add_once),
            category_ids: Array.isArray(matchedCatIds) ? matchedCatIds.slice() : []
        };
    }

    // ── Inject Bulk Studio UI & Buttons on DOM Ready ─────────────────────────
    function initBulkStudioUI() {
        // 1. Add "📦 Bulk Copy & Import" button to header next to "+ Add Product"
        var headerRight = document.querySelector('.admin-header .header-right');
        if (headerRight && !document.getElementById('openBulkStudioBtn')) {
            var bulkBtn = document.createElement('button');
            bulkBtn.id = 'openBulkStudioBtn';
            bulkBtn.className = 'btn';
            bulkBtn.type = 'button';
            bulkBtn.onclick = function() { window.openBulkImportModal(); };
            bulkBtn.style.cssText = 'background: linear-gradient(135deg, #059669, #10b981); color: #fff; border: none; font-weight: 700; box-shadow: 0 2px 8px rgba(16,185,129,0.3); display: inline-flex; align-items: center; gap: 6px; cursor: pointer;';
            bulkBtn.innerHTML = '<span>📦 Bulk Copy &amp; Import</span>';
            headerRight.appendChild(bulkBtn);
        }

        // 2. Add shortcut inside #quickImportCard to open Bulk Import Studio
        var quickCard = document.getElementById('quickImportCard');
        if (quickCard && !document.getElementById('switchToBulkBtn')) {
            var topRow = quickCard.firstElementChild;
            if (topRow) {
                var switchBtn = document.createElement('button');
                switchBtn.id = 'switchToBulkBtn';
                switchBtn.type = 'button';
                switchBtn.onclick = function() {
                    if (typeof closeModal === 'function') closeModal('productModal');
                    window.openBulkImportModal();
                };
                switchBtn.style.cssText = 'font-size: 11.5px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #059669, #10b981); border: none; padding: 4px 11px; border-radius: 20px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 2px 6px rgba(16,185,129,0.25);';
                switchBtn.innerHTML = '📦 Bulk Import / Full Site Copy →';
                topRow.appendChild(switchBtn);
            }
        }

        // 3. Inject Bulk Studio Modal HTML & Styles
        if (!document.getElementById('bulkStudioModal')) {
            var styleEl = document.createElement('style');
            styleEl.textContent = `
                .bulk-studio-box { max-width: 1140px !important; width: 96vw !important; padding: 20px 22px !important; }
                .bulk-source-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
                .bulk-fetch-panel { background: linear-gradient(135deg, rgba(79,70,229,0.06), rgba(16,185,129,0.06)); border: 1.5px solid rgba(79,70,229,0.28); border-radius: 12px; padding: 14px 16px; }
                .bulk-fetch-panel.site-panel { background: linear-gradient(135deg, rgba(16,185,129,0.08), rgba(2,132,199,0.07)); border-color: rgba(16,185,129,0.4); }
                .bulk-toolbar { background: #f8fafc; border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; display: flex; flex-direction: column; gap: 10px; }
                .bulk-toolbar-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
                .bulk-cat-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; font-size: 11.5px; font-weight: 600; border: 1.5px solid #d1d5db; background: #fff; color: #374151; cursor: pointer; user-select: none; transition: all 0.15s; }
                .bulk-cat-pill:hover { border-color: #6366f1; }
                .bulk-cat-pill.active { background: rgba(79,70,229,0.12); border-color: #4f46e5; color: #4338ca; font-weight: 700; }
                .bulk-item-card { background: #fff; border: 1.5px solid var(--border); border-radius: 12px; padding: 12px 14px; margin-bottom: 10px; transition: all 0.15s; }
                .bulk-item-card.unselected { opacity: 0.55; background: #f9fafb; }
                .bulk-item-card:hover { border-color: rgba(79,70,229,0.4); box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
                .bulk-item-grid { display: grid; grid-template-columns: 28px 64px minmax(180px, 1.5fr) minmax(175px, 1.1fr) minmax(95px, 0.65fr) minmax(95px, 0.65fr) auto; gap: 10px; align-items: center; }
                .bulk-item-thumb { width: 64px; height: 64px; border-radius: 10px; object-fit: cover; border: 1px solid #e5e7eb; background: #f3f4f6; }
                .bulk-item-cats { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; padding-top: 9px; border-top: 1px dashed #e5e7eb; align-items: center; }
                .bulk-drawer { margin-top: 12px; padding: 12px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; display: none; }
                .bulk-drawer.open { display: block; }
                .bulk-mini-label { font-size: 10.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 3px; display: block; }
                .bulk-inp { width: 100%; padding: 7px 9px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12.5px; font-family: inherit; color: #1e293b; background: #fff; outline: none; }
                .bulk-inp:focus { border-color: #4f46e5; box-shadow: 0 0 0 2px rgba(79,70,229,0.15); }
                @media (max-width: 900px) {
                    .bulk-source-grid { grid-template-columns: 1fr; }
                    .bulk-item-grid { grid-template-columns: 24px 54px 1fr; }
                }
            `;
            document.head.appendChild(styleEl);

            var modalEl = document.createElement('div');
            modalEl.className = 'modal-overlay';
            modalEl.id = 'bulkStudioModal';
            modalEl.innerHTML = `
                <div class="modal-box bulk-studio-box">
                    <div class="modal-header" style="margin-bottom: 12px;">
                        <div>
                            <div class="modal-title" style="display:flex;align-items:center;gap:8px;font-size:18px;">
                                <span>📦 Bulk Product Copy &amp; Edit Studio</span>
                                <span style="font-size:11px;font-weight:700;background:rgba(16,185,129,0.14);color:#059669;padding:3px 10px;border-radius:20px;">Full Site (/api/public-data) + Multi-URL</span>
                            </div>
                            <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">
                                যেকোনো সাইটের লিংক দিয়ে ১ ক্লিকে সব প্রোডাক্ট আনুন অথবা একাধিক প্রোডাক্ট লিংক পেস্ট করুন। এরপর ক্যাটাগরি, দাম ও SKU সেট করে সেভ করুন।
                            </div>
                        </div>
                        <button class="modal-close" onclick="closeModal('bulkStudioModal')">✖</button>
                    </div>

                    <div style="max-height: 76vh; overflow-y: auto; padding-right: 4px;">
                        <!-- Step 1: Dual Fetch Panels (Option A: Full Site URL via /api/public-data | Option B: Multiple Product URLs) -->
                        <div class="bulk-source-grid">
                            <!-- Option A: Site URL -> Fetch All Products (/api/public-data) -->
                            <div class="bulk-fetch-panel site-panel">
                                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:6px;">
                                    <div style="font-size:13px;font-weight:800;color:#065f46;">
                                        🌐 Option 1: পুরো সাইটের সব প্রোডাক্ট আনুন (সহজ উপায়)
                                    </div>
                                    <span style="font-size:10.5px;font-weight:700;background:rgba(5,150,105,0.15);color:#047857;padding:2px 8px;border-radius:12px;">/api/public-data</span>
                                </div>
                                <div style="font-size:11.5px;color:#334155;margin-bottom:10px;line-height:1.45;">
                                    শুধু যেকোনো শপের মেইন লিংক দিন (যেমন: <code>https://royalpanjabi.shop</code>)—স্বয়ংক্রিয়ভাবে ওই সাইটের <code>/api/public-data</code> থেকে সব প্রোডাক্ট চলে আসবে!
                                </div>
                                <div style="display:flex;gap:8px;align-items:stretch;">
                                    <input type="text" id="bulkStoreUrlInput" class="bulk-inp" placeholder="https://example.shop" style="flex:1;font-size:13px;" onkeydown="if(event.key==='Enter'){event.preventDefault();bulkFetchStoreCatalog();}">
                                    <button type="button" id="bulkStoreFetchBtn" class="btn" onclick="bulkFetchStoreCatalog()" style="background:linear-gradient(135deg,#059669,#10b981);color:#fff;border:none;font-weight:800;font-size:12.5px;padding:0 16px;border-radius:8px;cursor:pointer;white-space:nowrap;box-shadow:0 2px 8px rgba(16,185,129,0.3);">
                                        🌐 Fetch All Products
                                    </button>
                                </div>
                            </div>

                            <!-- Option B: Multiple Product URLs -->
                            <div class="bulk-fetch-panel">
                                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:6px;">
                                    <div style="font-size:13px;font-weight:800;color:#312e81;">
                                        🔗 Option 2: নির্দিষ্ট কয়েকটি প্রোডাক্টের লিংক পেস্ট করুন
                                    </div>
                                    <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('bulkUrlsInput').value='';" style="font-size:11px;padding:2px 8px;">Clear</button>
                                </div>
                                <textarea id="bulkUrlsInput" class="bulk-inp" rows="2" placeholder="প্রতি লাইনে ১টি করে প্রোডাক্ট লিংক পেস্ট করুন...&#10;https://example.shop/product?id=prod_1" style="font-size:12px;line-height:1.45;margin-bottom:8px;resize:vertical;"></textarea>
                                <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;">
                                    <button type="button" id="bulkFetchBtn" class="btn" onclick="bulkFetchFromUrls()" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border:none;font-weight:700;font-size:12.5px;padding:7px 14px;border-radius:8px;cursor:pointer;box-shadow:0 2px 8px rgba(79,70,229,0.25);">
                                        ⚡ Fetch Pasted URLs
                                    </button>
                                    <button type="button" class="btn btn-ghost btn-sm" onclick="bulkAddBlankRow()" style="font-weight:600;font-size:11.5px;">
                                        ➕ Blank Row
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Live Fetch Status Banner -->
                        <div id="bulkFetchStatus" style="display:none;margin-bottom:12px;padding:8px 12px;border-radius:8px;background:rgba(79,70,229,0.08);border:1px solid rgba(79,70,229,0.25);font-size:12.5px;font-weight:700;color:#4338ca;"></div>

                        <!-- Step 2: Batch Actions Toolbar -->
                        <div class="bulk-toolbar" id="bulkToolbar" style="display:none;">
                            <div class="bulk-toolbar-row">
                                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                                    <label style="display:inline-flex;align-items:center;gap:6px;font-weight:800;font-size:13px;cursor:pointer;color:#1e293b;">
                                        <input type="checkbox" id="bulkSelectAllCb" checked onchange="bulkToggleSelectAll(this.checked)" style="width:16px;height:16px;cursor:pointer;">
                                        <span>Select All (<span id="bulkSelectedCount">0</span>/<span id="bulkTotalCount">0</span>)</span>
                                    </label>
                                    <button type="button" class="btn btn-sm" onclick="bulkRegenerateSkus(true)" style="background:linear-gradient(135deg,#059669,#10b981);color:#fff;border:none;font-weight:800;font-size:12px;padding:6px 13px;border-radius:7px;cursor:pointer;box-shadow:0 2px 6px rgba(16,185,129,0.25);display:inline-flex;align-items:center;gap:5px;" title="সব প্রোডাক্টের জন্য স্বয়ংক্রিয় স্থায়ী SKU (XX-1234) তৈরি করুন">
                                        <span>⚡ Auto Generate All SKUs (XX-1234)</span>
                                    </button>
                                    <button type="button" class="btn btn-sm" onclick="bulkBatchAutoGenerateTags()" style="background:rgba(0,122,255,0.12);color:#007AFF;border:1px solid rgba(0,122,255,0.3);font-weight:800;font-size:11.5px;padding:5px 11px;border-radius:7px;cursor:pointer;" title="সব প্রোডাক্টের নাম ও ক্যাটাগরি থেকে SEO Tags তৈরি করুন">
                                        🏷️ Auto Generate All Tags
                                    </button>
                                </div>

                                <!-- Bulk Price Adjuster -->
                                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;background:#fff;padding:5px 10px;border-radius:8px;border:1px solid #e2e8f0;">
                                    <span style="font-size:11.5px;font-weight:700;color:#475569;">💰 Bulk Price:</span>
                                    <select id="bulkPriceMode" class="bulk-inp" style="width:auto;padding:4px 8px;font-size:12px;">
                                        <option value="add">Base Price +৳ (যোগ)</option>
                                        <option value="sub">Base Price -৳ (বিয়োগ)</option>
                                        <option value="set">Set Base Price (= ৳)</option>
                                        <option value="pct">Base Price +% (শতকরা বৃদ্ধি)</option>
                                        <option value="discount">Set Sale Discount (= ৳)</option>
                                    </select>
                                    <input type="number" id="bulkPriceVal" class="bulk-inp" placeholder="Amount" style="width:85px;padding:4px 8px;font-size:12px;">
                                    <button type="button" class="btn btn-primary btn-sm" onclick="bulkApplyPriceChange()" style="padding:4px 10px;font-size:11.5px;">Apply</button>
                                </div>

                                <!-- Bulk AI SEO Generator -->
                                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;background:#fff;padding:5px 10px;border-radius:8px;border:1px solid #e2e8f0;">
                                    <span style="font-size:11.5px;font-weight:700;color:#475569;">✨ AI SEO:</span>
                                    <select id="bulkAiSeoLang" class="bulk-inp" style="width:auto;padding:4px 8px;font-size:12px;font-weight:700;">
                                        <option value="hybrid" selected>🌐 মিশ্র (Eng Name + বাংলা বিবরণী) [ডিফল্ট]</option>
                                        <option value="bn">🇧🇩 সম্পূর্ণ বাংলা</option>
                                        <option value="en">🇬🇧 English</option>
                                    </select>
                                    <button type="button" class="btn btn-sm" id="bulkBatchAiSeoBtn" onclick="bulkBatchGenerateAISeo()" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;font-weight:700;font-size:11.5px;padding:5px 11px;border-radius:7px;cursor:pointer;box-shadow:0 2px 6px rgba(99,102,241,0.25);" title="সব সিলেক্টেড প্রোডাক্টের জন্য AI দিয়ে Tags, SEO Title, Slug ও Meta Description তৈরি করুন">
                                        ✨ Batch AI SEO Generate
                                    </button>
                                </div>
                            </div>

                            <!-- Bulk Brand & Category Assigner -->
                            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding-top:8px;border-top:1px solid #e2e8f0;">
                                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;background:#fff;padding:4px 8px;border-radius:8px;border:1px solid #cbd5e1;">
                                    <span style="font-size:11.5px;font-weight:800;color:#312e81;">🏪 Brand:</span>
                                    <select id="bulkTargetBrand" data-brand-select="1" class="bulk-inp" style="width:auto;padding:4px 8px;font-size:12px;font-weight:700;" onchange="document.getElementById('bulkShowOnMainWrap').style.display=this.value?'inline-flex':'none';"></select>
                                    <span id="bulkShowOnMainWrap" style="display:none;align-items:center;gap:4px;">
                                        <select id="bulkShowOnMain" class="bulk-inp" style="width:auto;padding:4px 8px;font-size:11.5px;">
                                            <option value="0">🔒 Only Brand Site</option>
                                            <option value="1">🌐 + Show on Main Site</option>
                                        </select>
                                    </span>
                                </div>
                                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex:1;">
                                    <span style="font-size:11.5px;font-weight:800;color:#334155;">🏷️ Batch Category:</span>
                                    <div id="bulkBatchCatPills" style="display:flex;flex-wrap:wrap;gap:5px;"></div>
                                </div>
                                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                                    <button type="button" class="btn btn-sm" onclick="bulkApplyBatchCategories('add')" style="background:#4f46e5;color:#fff;border:none;font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px;cursor:pointer;" title="ওপরে টিক দেওয়া ক্যাটাগরিগুলো সব সিলেক্টেড প্রোডাক্টে যুক্ত করুন">
                                        ➕ Add to Selected
                                    </button>
                                    <button type="button" class="btn btn-sm" onclick="bulkApplyBatchCategories('replace')" style="background:#0f172a;color:#fff;border:none;font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px;cursor:pointer;" title="সব সিলেক্টেড প্রোডাক্টের ক্যাটাগরি ওপরে টিক দেওয়া ক্যাটাগরি দিয়ে পরিবর্তন করুন">
                                        🎯 Set Exact on Selected
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Step 3: Per-Product Interactive Staging List -->
                        <div id="bulkStagingList">
                            <div style="text-align:center;padding:36px 20px;color:#94a3b8;border:1.5px dashed #e2e8f0;border-radius:12px;">
                                <div style="font-size:32px;margin-bottom:8px;">📦</div>
                                <div style="font-size:14px;font-weight:700;color:#475569;">এখনো কোনো প্রোডাক্ট লোড করা হয়নি</div>
                                <div style="font-size:12px;margin-top:4px;">ওপরে <b>Option 1</b>-এ যেকোনো সাইটের লিংক দিয়ে <b>Fetch All Products</b> চাপুন অথবা <b>Option 2</b>-তে লিংক পেস্ট করুন।</div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer Actions & Progress -->
                    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-top:14px;padding-top:14px;border-top:1px solid var(--border);">
                        <div id="bulkSaveProgressText" style="font-size:12.5px;font-weight:700;color:#059669;"></div>
                        <div style="display:flex;gap:10px;align-items:center;margin-left:auto;">
                            <button type="button" class="btn btn-ghost" onclick="bulkClearAllStaged()" style="font-size:12.5px;">🗑️ Clear List</button>
                            <button type="button" class="btn btn-ghost" onclick="closeModal('bulkStudioModal')">Cancel</button>
                            <button type="button" class="btn btn-primary" id="bulkSaveAllBtn" onclick="bulkSaveSelectedProducts()" style="background:linear-gradient(135deg,#059669,#10b981);border:none;font-weight:800;padding:10px 22px;font-size:13.5px;box-shadow:0 4px 12px rgba(16,185,129,0.3);">
                                🚀 Import &amp; Save Selected (<span id="bulkSaveBtnCount">0</span>)
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modalEl);
        }
    }

    function setBulkFetchStatus(msg, isError) {
        var el = document.getElementById('bulkFetchStatus');
        if (!el) return;
        if (!msg) {
            el.style.display = 'none';
            el.textContent = '';
            return;
        }
        el.style.display = 'block';
        el.style.background = isError ? 'rgba(239,68,68,0.1)' : 'rgba(79,70,229,0.08)';
        el.style.borderColor = isError ? 'rgba(239,68,68,0.3)' : 'rgba(79,70,229,0.25)';
        el.style.color = isError ? '#dc2626' : '#4338ca';
        el.textContent = msg;
    }

    // ── Open Bulk Studio Modal ───────────────────────────────────────────────
    window.openBulkImportModal = function() {
        initBulkStudioUI();
        renderBulkBatchCategoryPills();
        renderBulkStagingList();
        var modal = document.getElementById('bulkStudioModal');
        if (modal) modal.classList.add('show');
    };

    var selectedBatchCatIds = new Set();

    function renderBulkBatchCategoryPills() {
        var wrap = document.getElementById('bulkBatchCatPills');
        if (!wrap) return;
        var cats = (typeof allCategories !== 'undefined' && Array.isArray(allCategories)) ? allCategories : [];
        if (!cats.length) {
            wrap.innerHTML = '<span style="font-size:11px;color:#94a3b8;">No categories created yet</span>';
            return;
        }
        wrap.innerHTML = cats.map(function(c) {
            var cid = String(c.id);
            var isAct = selectedBatchCatIds.has(cid);
            return '<span class="bulk-cat-pill ' + (isAct ? 'active' : '') + '" onclick="bulkToggleBatchCatPill(\'' + escAttr(cid) + '\')">' +
                (isAct ? '✓ ' : '+ ') + escHtml(c.name) +
            '</span>';
        }).join('');
    }

    window.bulkToggleBatchCatPill = function(cid) {
        cid = String(cid);
        if (selectedBatchCatIds.has(cid)) selectedBatchCatIds.delete(cid);
        else selectedBatchCatIds.add(cid);
        renderBulkBatchCategoryPills();
    };

    window.bulkApplyBatchCategories = function(mode) {
        var batchArr = Array.from(selectedBatchCatIds);
        if (mode === 'add' && !batchArr.length) {
            if (typeof showToast === 'function') showToast('প্রথমে Batch Category থেকে অন্তত ১টি ক্যাটাগরিতে ক্লিক করুন', 'warning');
            return;
        }
        var count = 0;
        bulkStagedItems.forEach(function(item) {
            if (!item.selected) return;
            count++;
            if (mode === 'replace') {
                item.category_ids = batchArr.slice();
            } else {
                var set = new Set((item.category_ids || []).map(String));
                batchArr.forEach(function(id) { set.add(String(id)); });
                item.category_ids = Array.from(set);
            }
            item.tags = computeFullMergedTags(item, item.tags);
        });
        renderBulkStagingList();
        if (typeof showToast === 'function') showToast('✅ ' + count + 'টি প্রোডাক্টে ক্যাটাগরি আপডেট হয়েছে!', 'success');
    };

    // ── Option 1: Fetch Entire Store Catalog from Site URL (`/api/public-data`) ──
    window.bulkFetchStoreCatalog = async function() {
        var siteInp = document.getElementById('bulkStoreUrlInput');
        var multiInp = document.getElementById('bulkUrlsInput');
        var btn = document.getElementById('bulkStoreFetchBtn');

        var raw = (siteInp && siteInp.value.trim()) || (multiInp ? multiInp.value.trim().split(/[\r\n,\s]+/)[0] : '');
        if (!raw) {
            if (typeof showToast === 'function') showToast('Option 1 বক্সে যেকোনো সাইটের লিংক দিন (যেমন: https://royalpanjabi.shop)', 'warning');
            if (siteInp) siteInp.focus();
            return;
        }
        if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;

        var parsed;
        try {
            parsed = new URL(raw);
        } catch (e) {
            if (typeof showToast === 'function') showToast('সঠিক ওয়েবসাইট লিংক দিন!', 'error');
            return;
        }

        var origin = parsed.origin;
        var origBtnHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '⏳ Loading All...';
        }

        // Clear cached catalog for this origin so user always gets fresh data
        delete domainCatalogCache[origin];

        var catalog = await getDomainCatalog(origin, function(progressMsg) {
            setBulkFetchStatus(progressMsg, false);
        });

        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origBtnHtml;
        }

        if (!catalog || !Array.isArray(catalog.products) || !catalog.products.length) {
            setBulkFetchStatus('❌ ' + origin + '/api/public-data থেকে সরাসরি ক্যাটালগ পাওয়া যায়নি। Option 2-তে প্রোডাক্টের লিংকগুলো পেস্ট করে চেষ্টা করুন।', true);
            if (typeof showToast === 'function') showToast('সরাসরি ক্যাটালগ পাওয়া যায়নি', 'error');
            return;
        }

        // Map source category names to local category IDs if names match
        var localCats = (typeof allCategories !== 'undefined' && Array.isArray(allCategories)) ? allCategories : [];
        var remoteCats = Array.isArray(catalog.categories) ? catalog.categories : [];
        var remotePc   = Array.isArray(catalog.product_categories) ? catalog.product_categories : [];
        var remoteCatIdToLocalId = {};

        remoteCats.forEach(function(rc) {
            if (!rc || !rc.name) return;
            var match = localCats.find(function(lc) {
                return lc.name && lc.name.trim().toLowerCase() === rc.name.trim().toLowerCase();
            });
            if (match) {
                remoteCatIdToLocalId[String(rc.id)] = String(match.id);
            }
        });

        var added = 0;
        catalog.products.forEach(function(p) {
            var pUrl = origin + '/product?id=' + encodeURIComponent(p.id);
            var matchedLocalCats = [];
            remotePc.forEach(function(rel) {
                if (String(rel.product_id) === String(p.id) && remoteCatIdToLocalId[String(rel.category_id)]) {
                    var lid = remoteCatIdToLocalId[String(rel.category_id)];
                    if (!matchedLocalCats.includes(lid)) matchedLocalCats.push(lid);
                }
            });
            var staged = normalizeRawProductToStagedItem(p, pUrl, matchedLocalCats);
            bulkStagedItems.push(staged);
            added++;
        });

        renderBulkStagingList();
        setBulkFetchStatus('✅ ' + origin + '/api/public-data থেকে মোট ' + added + 'টি প্রোডাক্ট লোড হয়েছে! এখন প্রয়োজনমতো ক্যাটাগরি, দাম বা "Auto Generate SKU" বাটনে ক্লিক করে সেভ করুন।', false);
        if (typeof showToast === 'function') showToast('🎉 ' + origin + ' থেকে ' + added + 'টি প্রোডাক্ট লোড হয়েছে!', 'success');
    };

    // ── Option 2: Fetch Products from Pasted URLs ────────────────────────────
    window.bulkFetchFromUrls = async function() {
        var inp = document.getElementById('bulkUrlsInput');
        var btn = document.getElementById('bulkFetchBtn');
        if (!inp || !btn) return;

        var rawText = inp.value.trim();
        if (!rawText) {
            if (typeof showToast === 'function') showToast('দয়া করে অন্তত ১টি প্রোডাক্টের লিংক পেস্ট করুন', 'error');
            inp.focus();
            return;
        }

        var urls = rawText
            .split(/[\r\n,]+/)
            .map(function(s) { return s.trim(); })
            .filter(Boolean);

        if (!urls.length) return;

        // If user pasted a single root domain URL without /product in Option 2, automatically run full store catalog fetch!
        if (urls.length === 1) {
            try {
                var uObj = new URL(/^https?:\/\//i.test(urls[0]) ? urls[0] : 'https://' + urls[0]);
                var isRootOrShop = (uObj.pathname === '/' || uObj.pathname === '/index.html' || uObj.pathname === '/shop' || uObj.pathname === '/shop.html') && !uObj.searchParams.get('id');
                if (isRootOrShop) {
                    var siteInp = document.getElementById('bulkStoreUrlInput');
                    if (siteInp) siteInp.value = uObj.origin;
                    inp.value = '';
                    await window.bulkFetchStoreCatalog();
                    return;
                }
            } catch (e) {}
        }

        var origBtnHtml = btn.innerHTML;
        btn.disabled = true;
        var addedCount = 0;
        var failedCount = 0;

        for (var i = 0; i < urls.length; i++) {
            var u = urls[i];
            btn.innerHTML = '⏳ Fetching (' + (i + 1) + '/' + urls.length + ')...';
            setBulkFetchStatus('🔍 লোড হচ্ছে (' + (i + 1) + '/' + urls.length + '): ' + u.substring(0, 50) + '...', false);

            try {
                var item = await fetchSingleProductByUrl(u);
                if (item) {
                    bulkStagedItems.push(item);
                    addedCount++;
                } else {
                    failedCount++;
                }
            } catch (e) {
                failedCount++;
            }
            renderBulkStagingList();
        }

        btn.innerHTML = origBtnHtml;
        btn.disabled = false;

        if (addedCount > 0) {
            inp.value = '';
            setBulkFetchStatus('✅ ' + addedCount + 'টি প্রোডাক্ট লোড হয়েছে!' + (failedCount ? ' (' + failedCount + 'টি ব্যর্থ)' : ''), false);
            if (typeof showToast === 'function') showToast('✅ ' + addedCount + 'টি প্রোডাক্ট এডিটর লিস্টে যুক্ত হয়েছে!', 'success');
        } else {
            setBulkFetchStatus('❌ কোনো প্রোডাক্ট পাওয়া যায়নি। পুরো সাইটের সব প্রোডাক্ট আনতে Option 1-এ সাইটের মেইন লিংক দিন।', true);
            if (typeof showToast === 'function') showToast('প্রোডাক্ট ডাটা পাওয়া যায়নি', 'error');
        }
    };

    window.bulkAddBlankRow = function() {
        var item = normalizeRawProductToStagedItem({
            name: 'New Product ' + (bulkStagedItems.length + 1),
            base_price: 500,
            flash_sale_price: 0,
            gallery_images: []
        }, '');
        bulkStagedItems.unshift(item);
        renderBulkStagingList();
    };

    // ── Render Interactive Staging List ──────────────────────────────────────
    function renderBulkStagingList() {
        var listEl = document.getElementById('bulkStagingList');
        var toolbar = document.getElementById('bulkToolbar');
        var selCountEl = document.getElementById('bulkSelectedCount');
        var totCountEl = document.getElementById('bulkTotalCount');
        var saveBtnCountEl = document.getElementById('bulkSaveBtnCount');
        var selectAllCb = document.getElementById('bulkSelectAllCb');

        if (!listEl) return;

        var total = bulkStagedItems.length;
        var selectedCount = bulkStagedItems.filter(function(x) { return x.selected; }).length;

        if (toolbar) toolbar.style.display = total > 0 ? 'flex' : 'none';
        if (selCountEl) selCountEl.textContent = selectedCount;
        if (totCountEl) totCountEl.textContent = total;
        if (saveBtnCountEl) saveBtnCountEl.textContent = selectedCount;
        if (selectAllCb) selectAllCb.checked = (total > 0 && selectedCount === total);

        if (total === 0) {
            listEl.innerHTML = `
                <div style="text-align:center;padding:36px 20px;color:#94a3b8;border:1.5px dashed #e2e8f0;border-radius:12px;">
                    <div style="font-size:32px;margin-bottom:8px;">📦</div>
                    <div style="font-size:14px;font-weight:700;color:#475569;">এখনো কোনো প্রোডাক্ট লোড করা হয়নি</div>
                    <div style="font-size:12px;margin-top:4px;">ওপরে <b>Option 1</b>-এ যেকোনো সাইটের লিংক দিয়ে <b>Fetch All Products</b> চাপুন অথবা <b>Option 2</b>-তে লিংক পেস্ট করুন।</div>
                </div>
            `;
            return;
        }

        var cats = (typeof allCategories !== 'undefined' && Array.isArray(allCategories)) ? allCategories : [];

        listEl.innerHTML = bulkStagedItems.map(function(item, idx) {
            var thumb = (item.gallery_images && item.gallery_images[0]) ||
                        (item.variants && item.variants[0] && item.variants[0].imageUrl) || '';
            var finalPrice = Math.max(0, (parseInt(item.base_price, 10) || 0) - (parseInt(item.flash_sale_price, 10) || 0));
            var itemCatSet = new Set((item.category_ids || []).map(String));

            var catPillsHtml = cats.length ? cats.map(function(c) {
                var cid = String(c.id);
                var isChecked = itemCatSet.has(cid);
                return '<span class="bulk-cat-pill ' + (isChecked ? 'active' : '') + '" onclick="bulkToggleItemCategory(' + idx + ', \'' + escAttr(cid) + '\')">' +
                    (isChecked ? '✓ ' : '+ ') + escHtml(c.name) +
                '</span>';
            }).join('') : '<span style="font-size:11px;color:#94a3b8;">No categories available</span>';

            var galleryText = (item.gallery_images || []).join('\n');

            var itemTagsArr = (item.tags || '')
                .split(',')
                .map(function(s) { return s.trim(); })
                .filter(Boolean);

            var tagsBadgesHtml = itemTagsArr.length > 0
                ? itemTagsArr.slice(0, 7).map(function(t) {
                    return '<span style="font-size:10px;font-weight:700;background:rgba(79,70,229,0.08);color:#4338ca;padding:2px 7px;border-radius:12px;border:1px solid rgba(79,70,229,0.2);">' + escHtml(t) + '</span>';
                }).join('') + (itemTagsArr.length > 7 ? '<span style="font-size:10px;color:#64748b;font-weight:700;padding:2px 5px;">+' + (itemTagsArr.length - 7) + ' more</span>' : '')
                : '<span style="font-size:11px;color:#94a3b8;font-style:italic;">কোনো ট্যাগ নেই ("➕ Auto Tags" চাপুন)</span>';

            return `
                <div class="bulk-item-card ${item.selected ? '' : 'unselected'}" id="bulk-card-${idx}">
                    <div class="bulk-item-grid">
                        <!-- 1. Select Checkbox -->
                        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                            <input type="checkbox" ${item.selected ? 'checked' : ''} onchange="bulkToggleItemSelect(${idx}, this.checked)" style="width:17px;height:17px;cursor:pointer;">
                            <span style="font-size:10px;font-weight:800;color:#94a3b8;">#${idx + 1}</span>
                        </div>

                        <!-- 2. Thumbnail + Photo/Variant Badges -->
                        <div style="position:relative;">
                            ${thumb
                                ? `<img src="${escAttr(thumb)}" class="bulk-item-thumb" onerror="this.style.opacity='0.2'">`
                                : `<div class="bulk-item-thumb" style="display:flex;align-items:center;justify-content:center;font-size:20px;color:#94a3b8;">🖼️</div>`
                            }
                            <div style="font-size:9.5px;font-weight:700;color:#475569;text-align:center;margin-top:2px;">
                                📸 ${(item.gallery_images || []).length} | 🎨 ${(item.variants || []).length}
                            </div>
                        </div>

                        <!-- 3. Product Name (Does NOT alter SKU when edited) -->
                        <div>
                            <label class="bulk-mini-label">Product Name *</label>
                            <input type="text" class="bulk-inp" value="${escAttr(item.name)}" oninput="bulkUpdateField(${idx}, 'name', this.value)" placeholder="Product Name">
                        </div>

                        <!-- 4. Permanent SKU + Explicit "⚡ Auto Generate" Button -->
                        <div>
                            <label class="bulk-mini-label">Product SKU (Permanent)</label>
                            <div style="display:flex;gap:5px;align-items:stretch;">
                                <input type="text" class="bulk-inp" id="bulk-sku-${idx}" value="${escAttr(item.sku)}" oninput="bulkUpdateField(${idx}, 'sku', this.value)" placeholder="e.g. MB-1042" style="font-weight:700;color:#4338ca;letter-spacing:0.3px;flex:1;">
                                <button type="button" onclick="bulkRegenSingleSku(${idx})" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border:none;border-radius:7px;padding:0 9px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;" title="প্রোডাক্টের নাম থেকে স্থায়ী SKU (XX-1234) তৈরি করুন">⚡ Auto</button>
                            </div>
                        </div>

                        <!-- 5. Base Price -->
                        <div>
                            <label class="bulk-mini-label">Base Price (৳) *</label>
                            <input type="number" class="bulk-inp" value="${item.base_price}" oninput="bulkUpdatePrice(${idx}, 'base_price', this.value)" style="font-weight:700;">
                        </div>

                        <!-- 6. Flash Sale Discount -->
                        <div>
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                                <span class="bulk-mini-label" style="margin:0;">Discount (৳)</span>
                                <span id="bulk-final-${idx}" style="font-size:10px;font-weight:800;color:#059669;">= ৳${finalPrice}</span>
                            </div>
                            <input type="number" class="bulk-inp" value="${item.flash_sale_price}" oninput="bulkUpdatePrice(${idx}, 'flash_sale_price', this.value)">
                        </div>

                        <!-- 7. Row Actions -->
                        <div style="display:flex;gap:5px;align-items:center;">
                            <button type="button" class="btn btn-ghost btn-sm" onclick="bulkToggleDrawer(${idx})" style="padding:6px 9px;font-size:11.5px;font-weight:700;" title="ডেসক্রিপশন, ছবি ও ভ্যারিয়েন্ট এডিট করুন">
                                📝 Details
                            </button>
                            <button type="button" class="btn btn-danger btn-sm" onclick="bulkRemoveItem(${idx})" style="padding:6px 9px;font-size:11.5px;" title="এই প্রোডাক্টটি লিস্ট থেকে বাদ দিন">
                                🗑️
                            </button>
                        </div>
                    </div>

                    <!-- Per-Product Isolated Category Selector -->
                    <div class="bulk-item-cats">
                        <span style="font-size:11px;font-weight:800;color:#475569;margin-right:4px;">📂 Categories (${itemCatSet.size}):</span>
                        ${catPillsHtml}
                    </div>

                    <!-- Per-Product Live SEO Tags Preview & Quick Action Directly on Card -->
                    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:8px;padding-top:8px;border-top:1px dashed #e2e8f0;background:#fbfcfe;padding:8px 10px;border-radius:8px;">
                        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex:1;">
                            <span style="font-size:11px;font-weight:800;color:#4f46e5;display:inline-flex;align-items:center;gap:4px;">
                                🏷️ SEO Focus Tags (${itemTagsArr.length}):
                            </span>
                            <div id="bulk-tag-badges-${idx}" style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">
                                ${tagsBadgesHtml}
                            </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:5px;">
                            <button type="button" onclick="bulkAutoGenerateTags(${idx})" style="background:rgba(0,122,255,0.12);color:#007AFF;border:1px solid rgba(0,122,255,0.3);border-radius:6px;padding:3px 8px;font-size:11px;font-weight:700;cursor:pointer;" title="নাম ও ক্যাটাগরি থেকে ট্যাগ তৈরি করুন">
                                ➕ Auto Tags
                            </button>
                            <button type="button" id="bulk-card-ai-btn-${idx}" onclick="bulkGenerateItemAISeo(${idx})" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:6px;padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer;box-shadow:0 2px 6px rgba(99,102,241,0.25);" title="এই প্রোডাক্টের সম্পূর্ণ এসইও AI দিয়ে তৈরি করুন">
                                ✨ AI SEO
                            </button>
                        </div>
                    </div>

                    <!-- Expandable Details Drawer (Description, Gallery Images, Tags, SEO) -->
                    <div class="bulk-drawer ${item.expanded ? 'open' : ''}" id="bulk-drawer-${idx}">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                            <div>
                                <label class="bulk-mini-label">Description (HTML / Text)</label>
                                <textarea class="bulk-inp" id="bulk-desc-${idx}" rows="4" oninput="bulkUpdateField(${idx}, 'description', this.value)" style="resize:vertical;">${escHtml(item.description || '')}</textarea>
                            </div>
                            <div>
                                <label class="bulk-mini-label">Gallery Image URLs (প্রতি লাইনে ১টি ছবির লিংক)</label>
                                <textarea class="bulk-inp" rows="4" oninput="bulkUpdateGalleryText(${idx}, this.value)" style="resize:vertical;">${escHtml(galleryText)}</textarea>
                            </div>
                        </div>

                        <!-- Complete Product SEO & Meta Section -->
                        <div style="margin-top:12px;padding:10px 12px;background:#fff;border-radius:8px;border:1px solid #e2e8f0;">
                            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
                                <div style="font-size:12px;font-weight:800;color:#4f46e5;display:flex;align-items:center;gap:5px;">
                                    <span>✨ Product SEO &amp; Meta Metadata</span>
                                </div>
                                <div style="display:flex;gap:6px;align-items:center;">
                                    <select id="bulk-item-lang-${idx}" class="bulk-inp" style="width:auto;padding:3px 7px;font-size:11px;font-weight:700;">
                                        <option value="hybrid" selected>🌐 মিশ্র (ডিফল্ট)</option>
                                        <option value="bn">🇧🇩 বাংলা</option>
                                        <option value="en">🇬🇧 English</option>
                                    </select>
                                    <button type="button" id="bulk-ai-btn-${idx}" onclick="bulkGenerateItemAISeo(${idx})" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;box-shadow:0 2px 6px rgba(99,102,241,0.2);" title="এই প্রোডাক্টের বিবরণ অনুযায়ী AI দিয়ে SEO Title, Slug, Tags ও Meta Description পূরণ করুন">
                                        ✨ AI Generate SEO
                                    </button>
                                </div>
                            </div>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px;">
                                <div>
                                    <label class="bulk-mini-label">Custom SEO Title</label>
                                    <input type="text" class="bulk-inp" id="bulk-seo-title-${idx}" value="${escAttr(item.seo_title || '')}" oninput="bulkUpdateField(${idx}, 'seo_title', this.value)" placeholder="e.g. Premium Popcorn Panjabi for Men">
                                </div>
                                <div>
                                    <label class="bulk-mini-label">Custom SEO Slug (Latin URL)</label>
                                    <input type="text" class="bulk-inp" id="bulk-seo-slug-${idx}" value="${escAttr(item.slug || '')}" oninput="bulkUpdateField(${idx}, 'slug', this.value)" placeholder="e.g. premium-popcorn-panjabi-men">
                                </div>
                            </div>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                                <div>
                                    <label class="bulk-mini-label">SEO Focus Tags / Keywords (কমা দিয়ে)</label>
                                    <input type="text" class="bulk-inp" id="bulk-tags-${idx}" value="${escAttr(item.tags || '')}" oninput="bulkUpdateField(${idx}, 'tags', this.value)" placeholder="e.g. panjabi, popcorn panjabi, gents wear">
                                </div>
                                <div>
                                    <label class="bulk-mini-label">SEO Meta Description</label>
                                    <textarea class="bulk-inp" rows="2" id="bulk-seo-desc-${idx}" oninput="bulkUpdateField(${idx}, 'seo_description', this.value)" placeholder="140-160 characters summary for Google..." style="resize:vertical;">${escHtml(item.seo_description || '')}</textarea>
                                </div>
                            </div>
                        </div>

                        <div style="display:flex;gap:14px;align-items:center;justify-content:flex-end;margin-top:10px;padding-top:8px;border-top:1px dashed #e2e8f0;">
                            <label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;cursor:pointer;">
                                <input type="checkbox" ${item.is_active ? 'checked' : ''} onchange="bulkUpdateField(${idx}, 'is_active', this.checked)"> Active
                            </label>
                            <label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;cursor:pointer;">
                                <input type="checkbox" ${item.is_featured ? 'checked' : ''} onchange="bulkUpdateField(${idx}, 'is_featured', this.checked)"> Featured
                            </label>
                            <label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;cursor:pointer;">
                                <input type="checkbox" ${item.is_add_once ? 'checked' : ''} onchange="bulkUpdateField(${idx}, 'is_add_once', this.checked)"> Add-Once
                            </label>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ── Per-Item & Batch Event Handlers ──────────────────────────────────────
    window.bulkToggleSelectAll = function(checked) {
        bulkStagedItems.forEach(function(item) { item.selected = Boolean(checked); });
        renderBulkStagingList();
    };

    window.bulkToggleItemSelect = function(idx, checked) {
        if (!bulkStagedItems[idx]) return;
        bulkStagedItems[idx].selected = Boolean(checked);
        renderBulkStagingList();
    };

    window.bulkUpdateField = function(idx, field, val) {
        var item = bulkStagedItems[idx];
        if (!item) return;
        // Updating name or any other field never auto-mutates SKU — SKU stays permanent!
        item[field] = val;
    };

    window.bulkUpdatePrice = function(idx, field, val) {
        var item = bulkStagedItems[idx];
        if (!item) return;
        item[field] = parseInt(val, 10) || 0;
        var finalPrice = Math.max(0, (parseInt(item.base_price, 10) || 0) - (parseInt(item.flash_sale_price, 10) || 0));
        var badge = document.getElementById('bulk-final-' + idx);
        if (badge) badge.textContent = '= ৳' + finalPrice;
    };

    window.bulkUpdateGalleryText = function(idx, text) {
        var item = bulkStagedItems[idx];
        if (!item) return;
        item.gallery_images = (text || '')
            .split(/[\r\n,]+/)
            .map(function(s) { return s.trim(); })
            .filter(Boolean);
    };

    window.bulkToggleItemCategory = function(idx, cid) {
        var item = bulkStagedItems[idx];
        if (!item) return;
        cid = String(cid);
        var arr = Array.isArray(item.category_ids) ? item.category_ids.map(String) : [];
        var pos = arr.indexOf(cid);
        if (pos > -1) arr.splice(pos, 1);
        else arr.push(cid);
        item.category_ids = arr;
        item.tags = computeFullMergedTags(item, item.tags);
        renderBulkStagingList();
    };

    window.bulkToggleDrawer = function(idx) {
        var item = bulkStagedItems[idx];
        if (!item) return;
        item.expanded = !item.expanded;
        var drawer = document.getElementById('bulk-drawer-' + idx);
        if (drawer) drawer.classList.toggle('open', item.expanded);
    };

    window.bulkRemoveItem = function(idx) {
        bulkStagedItems.splice(idx, 1);
        renderBulkStagingList();
    };

    window.bulkClearAllStaged = function() {
        if (!bulkStagedItems.length) return;
        bulkStagedItems = [];
        setBulkFetchStatus('', false);
        renderBulkStagingList();
    };

    /**
     * Per-row "⚡ Auto" SKU button click handler (permanent once generated)
     */
    window.bulkRegenSingleSku = function(idx) {
        var item = bulkStagedItems[idx];
        if (!item) return;
        item.sku = '';
        item.sku = window.generateAutoSku(item.name);
        var skuInp = document.getElementById('bulk-sku-' + idx);
        if (skuInp) skuInp.value = item.sku;
        if (typeof showToast === 'function') showToast('✅ SKU Generated: ' + item.sku, 'success');
    };

    // ── Auto Generate Tags for Single Item (Store SEO + Product Auto Tags) ──
    window.bulkAutoGenerateTags = function(idx) {
        var item = bulkStagedItems[idx];
        if (!item) return;

        item.tags = computeFullMergedTags(item, item.tags);
        var tagsInp = document.getElementById('bulk-tags-' + idx);
        if (tagsInp) tagsInp.value = item.tags;

        renderBulkStagingList();
        if (typeof showToast === 'function') showToast('✅ #' + (idx + 1) + ' এর জন্য Store ও Auto SEO Tags যুক্ত হয়েছে!', 'success');
    };

    // ── Batch Auto Generate Tags for All Items ──
    window.bulkBatchAutoGenerateTags = function() {
        var count = 0;
        bulkStagedItems.forEach(function(item) {
            item.tags = computeFullMergedTags(item, item.tags);
            count++;
        });

        renderBulkStagingList();
        if (typeof showToast === 'function') showToast('✅ ' + count + 'টি প্রোডাক্টেই Store ও Auto SEO Tags যুক্ত হয়েছে!', 'success');
    };

    /**
     * Top toolbar "Auto Generate All SKUs (XX-1234)" handler.
     * Guarantees fresh, permanent XX-1234 format SKUs for EVERY product!
     */
    window.bulkRegenerateSkus = function(forceAll) {
        var used = new Set();

        // 1. Existing SKUs from current shop products
        if (typeof allProducts !== 'undefined' && Array.isArray(allProducts)) {
            allProducts.forEach(function(p) {
                if (p && p.sku) used.add(String(p.sku).trim().toUpperCase());
            });
        }

        // Determine target items: if any are selected, generate for selected; if none selected, generate for ALL!
        var hasSelection = bulkStagedItems.some(function(x) { return x.selected; });
        var count = 0;

        bulkStagedItems.forEach(function(item, idx) {
            var isTarget = hasSelection ? item.selected : true;
            if (isTarget) {
                item.sku = '';
                var fresh = window.generateAutoSku(item.name, used);
                item.sku = fresh;
                used.add(fresh.toUpperCase());
                count++;

                // Direct DOM update for instant reaction
                var el = document.getElementById('bulk-sku-' + idx);
                if (el) el.value = fresh;
            } else {
                if (item.sku) used.add(String(item.sku).trim().toUpperCase());
            }
        });

        renderBulkStagingList();

        if (typeof showToast === 'function') {
            showToast('✅ সফলভাবে ' + count + 'টি প্রোডাক্টে নতুন স্থায়ী SKU (XX-1234) জেনারেট হয়েছে!', 'success');
        }
    };

    window.bulkApplyPriceChange = function() {
        var modeEl = document.getElementById('bulkPriceMode');
        var valEl  = document.getElementById('bulkPriceVal');
        if (!modeEl || !valEl) return;
        var mode = modeEl.value;
        var amount = parseFloat(valEl.value);
        if (isNaN(amount)) {
            if (typeof showToast === 'function') showToast('টাকার পরিমাণ বা সংখ্যা লিখুন', 'warning');
            valEl.focus();
            return;
        }

        var count = 0;
        bulkStagedItems.forEach(function(item) {
            if (!item.selected) return;
            count++;
            var cur = parseInt(item.base_price, 10) || 0;
            if (mode === 'add') item.base_price = Math.max(0, Math.round(cur + amount));
            else if (mode === 'sub') item.base_price = Math.max(0, Math.round(cur - amount));
            else if (mode === 'set') item.base_price = Math.max(0, Math.round(amount));
            else if (mode === 'pct') item.base_price = Math.max(0, Math.round(cur + (cur * amount / 100)));
            else if (mode === 'discount') item.flash_sale_price = Math.max(0, Math.round(amount));
        });
        renderBulkStagingList();
        if (typeof showToast === 'function') showToast('💰 ' + count + 'টি প্রোডাক্টের দাম আপডেট করা হয়েছে!', 'success');
    };

    // ── AI SEO Generators for Bulk Studio ───────────────────────────────────
    window.bulkGenerateItemAISeo = async function(idx) {
        var item = bulkStagedItems[idx];
        if (!item) return;

        var name = (item.name || '').trim();
        if (!name) {
            if (typeof showToast === 'function') showToast('প্রথমে প্রোডাক্টের নাম লিখুন', 'warning');
            return;
        }

        var langSel = document.getElementById('bulk-item-lang-' + idx);
        var lang = langSel ? langSel.value : 'hybrid';

        var btn = document.getElementById('bulk-ai-btn-' + idx);
        var origBtnHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '⏳ AI...';
        }

        var cats = [];
        if (Array.isArray(item.category_ids) && typeof allCategories !== 'undefined') {
            var catSet = new Set(item.category_ids.map(String));
            allCategories.forEach(function(c) {
                if (catSet.has(String(c.id))) cats.push(c.name);
            });
        }

        try {
            if (typeof window.generateProductSeoMetadata !== 'function') {
                throw new Error('AI SEO Generator helper not found');
            }

            var seo = await window.generateProductSeoMetadata({
                name: name,
                description: item.description || '',
                categories: cats,
                lang: lang
            });

            // Merge AI tags with Product Name keywords + Category Names + Store SEO Settings
            var fullMergedTags = computeFullMergedTags(item, seo.tags);
            item.tags = fullMergedTags;
            item.seo_title = seo.seo_title;
            item.slug = seo.slug;
            item.seo_description = seo.seo_description;

            // Direct update inputs in DOM
            var tagsInp = document.getElementById('bulk-tags-' + idx);
            if (tagsInp) tagsInp.value = fullMergedTags;

            var titleInp = document.getElementById('bulk-seo-title-' + idx);
            if (titleInp) titleInp.value = seo.seo_title;

            var slugInp = document.getElementById('bulk-seo-slug-' + idx);
            if (slugInp) slugInp.value = seo.slug;

            var descInp = document.getElementById('bulk-seo-desc-' + idx);
            if (descInp) descInp.value = seo.seo_description;

            renderBulkStagingList();
            if (typeof showToast === 'function') {
                showToast('✅ #' + (idx + 1) + ' SEO জেনারেট সম্পন্ন (AI + Store Tags যুক্ত হয়েছে)!', 'success');
            }
        } catch (err) {
            console.error('AI SEO error:', err);
            if (typeof showToast === 'function') showToast('❌ SEO Error: ' + err.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origBtnHtml;
            }
        }
    };

    window.bulkBatchGenerateAISeo = async function() {
        var selectedEntries = [];
        bulkStagedItems.forEach(function(item, idx) {
            if (item.selected) selectedEntries.push({ item: item, idx: idx });
        });

        if (!selectedEntries.length) {
            if (typeof showToast === 'function') showToast('SEO তৈরি করতে অন্তত ১টি প্রোডাক্ট সিলেক্ট করুন', 'warning');
            return;
        }

        var langSel = document.getElementById('bulkAiSeoLang');
        var lang = langSel ? langSel.value : 'hybrid';

        var btn = document.getElementById('bulkBatchAiSeoBtn');
        var origBtnHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '⏳ Generating (' + selectedEntries.length + ')...';
        }

        var successCount = 0;
        var failCount = 0;

        for (var i = 0; i < selectedEntries.length; i++) {
            var entry = selectedEntries[i];
            var it = entry.item;
            var idx = entry.idx;

            if (btn) {
                btn.innerHTML = '⏳ SEO (' + (i + 1) + '/' + selectedEntries.length + ')...';
            }

            var cats = [];
            if (Array.isArray(it.category_ids) && typeof allCategories !== 'undefined') {
                var catSet = new Set(it.category_ids.map(String));
                allCategories.forEach(function(c) {
                    if (catSet.has(String(c.id))) cats.push(c.name);
                });
            }

            try {
                if (typeof window.generateProductSeoMetadata !== 'function') {
                    throw new Error('AI SEO Generator helper not found');
                }

                var seo = await window.generateProductSeoMetadata({
                    name: it.name,
                    description: it.description || '',
                    categories: cats,
                    lang: lang
                });

                // Merge AI tags with Product Tokens + Category Names + Store SEO Keywords
                var fullMergedTags = computeFullMergedTags(it, seo.tags);
                it.tags = fullMergedTags;
                it.seo_title = seo.seo_title;
                it.slug = seo.slug;
                it.seo_description = seo.seo_description;

                // Sync DOM if open
                var tagsInp = document.getElementById('bulk-tags-' + idx);
                if (tagsInp) tagsInp.value = fullMergedTags;
                var titleInp = document.getElementById('bulk-seo-title-' + idx);
                if (titleInp) titleInp.value = seo.seo_title;
                var slugInp = document.getElementById('bulk-seo-slug-' + idx);
                if (slugInp) slugInp.value = seo.slug;
                var descInp = document.getElementById('bulk-seo-desc-' + idx);
                if (descInp) descInp.value = seo.seo_description;

                successCount++;
            } catch (e) {
                console.error('Batch SEO failed for', it.name, e);
                failCount++;
            }

            // Respect API rate limits with 300ms pause
            if (i < selectedEntries.length - 1) {
                await new Promise(function(resolve) { setTimeout(resolve, 300); });
            }
        }

        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origBtnHtml;
        }

        if (successCount > 0) {
            if (typeof showToast === 'function') {
                showToast('✅ ' + successCount + 'টি প্রোডাক্টে সম্পূর্ণ AI SEO তৈরি হয়েছে!' + (failCount ? ' (' + failCount + 'টি ব্যর্থ)' : ''), 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast('❌ SEO জেনারেট ব্যর্থ হয়েছে। AI Key চেক করুন।', 'error');
            }
        }
    };

    // ── Save Single Staged Item to Active DB Provider ────────────────────────
    async function saveOneStagedProduct(item) {
        var name = (item.name || '').trim();
        if (!name) throw new Error('Product name is empty');

        var sku = (item.sku || '').trim() || null;

        var catIds = Array.isArray(item.category_ids) ? item.category_ids.map(String) : [];
        var cats = (typeof allCategories !== 'undefined' && Array.isArray(allCategories)) ? allCategories : [];
        var selectedCatNames = catIds.map(function(cid) {
            var found = cats.find(function(c) { return String(c.id) === String(cid); });
            return found ? found.name : '';
        }).filter(Boolean);

        var mergedTagArray = [];
        if (typeof ImageSeoInjector !== 'undefined') {
            mergedTagArray = ImageSeoInjector.buildMergedTags({
                productName: name,
                categoryNames: selectedCatNames,
                productTags: item.tags || ''
            });
        } else if (item.tags) {
            mergedTagArray = item.tags.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
        }
        var combinedTagsVal = mergedTagArray.length ? mergedTagArray.join(', ') : (item.tags || '');
        var seoSlug = (item.slug || '').trim() || ((typeof ImageSeoInjector !== 'undefined') ? ImageSeoInjector.slugify(name) : name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));

        var targetBrandId = (document.getElementById('bulkTargetBrand') && document.getElementById('bulkTargetBrand').value) ? document.getElementById('bulkTargetBrand').value : (item.brand_id || null);
        var showOnMainVal = (targetBrandId && document.getElementById('bulkShowOnMain') && document.getElementById('bulkShowOnMain').value === '1') ? 1 : 0;

        var payload = {
            name:             name,
            sku:              sku,
            description:      item.description || '',
            base_price:       parseInt(item.base_price, 10) || 0,
            flash_sale_price: parseInt(item.flash_sale_price, 10) || 0,
            flash_sale_end:   null,
            video_url:        item.video_url || null,
            video_type:       item.video_type || 'auto',
            is_active:        Boolean(item.is_active),
            is_featured:      Boolean(item.is_featured),
            is_add_once:      Boolean(item.is_add_once),
            brand_id:         targetBrandId,
            show_on_main:     showOnMainVal,
            tags:             combinedTagsVal || null,
            seo_keywords:     combinedTagsVal || null,
            seo_title:        item.seo_title || name,
            seo_description:  item.seo_description || null,
            slug:             seoSlug || null,
            gallery_images:   Array.isArray(item.gallery_images) ? item.gallery_images.filter(Boolean) : [],
            variants:         Array.isArray(item.variants) ? item.variants : [],
            category_ids:     catIds
        };

        if (CONFIG.DB_PROVIDER === 'cf_db') {
            var reqUrl = (CONFIG.HF_API_BASE ? CONFIG.HF_API_BASE.replace(/\/+$/, '') : '') + '/api/add-product';
            var r = await fetch(reqUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (localStorage.getItem('admin_token') || '')
                },
                body: JSON.stringify(payload)
            });
            var res = await r.json();
            if (!res.success) throw new Error(res.error || 'Failed to save product');
            return res;
        } else if (CONFIG.DB_PROVIDER === 'supabase') {
            var supaPayload = Object.assign({}, payload);
            delete supaPayload.category_ids;
            var ins = await supabaseClient.from('products').insert([supaPayload]).select();
            if (ins.error) throw new Error(ins.error.message);
            var newId = ins.data && ins.data[0] && ins.data[0].id;
            if (newId && catIds.length) {
                var rows = catIds.map(function(cid) { return { product_id: newId, category_id: cid }; });
                await supabaseClient.from('product_categories').insert(rows);
            }
            return ins;
        } else if (CONFIG.DB_PROVIDER === 'appwrite') {
            var awPayload = Object.assign({}, payload, {
                variants: JSON.stringify(payload.variants || [])
            });
            delete awPayload.category_ids;
            var doc = await appwriteDatabases.createDocument(APP_DB, 'products', AppwriteID.unique(), awPayload);
            if (doc && doc.$id && catIds.length) {
                for (var c = 0; c < catIds.length; c++) {
                    await appwriteDatabases.createDocument(APP_DB, 'product_categories', AppwriteID.unique(), {
                        product_id: doc.$id,
                        category_id: catIds[c]
                    });
                }
            }
            return doc;
        }
    }

    // ── Bulk Save Selected Products ──────────────────────────────────────────
    window.bulkSaveSelectedProducts = async function() {
        if (isBulkSaving) return;
        var toSave = bulkStagedItems.filter(function(x) { return x.selected; });
        if (!toSave.length) {
            if (typeof showToast === 'function') showToast('সেভ করার জন্য অন্তত ১টি প্রোডাক্ট সিলেক্ট করুন', 'warning');
            return;
        }

        isBulkSaving = true;
        var btn = document.getElementById('bulkSaveAllBtn');
        var progEl = document.getElementById('bulkSaveProgressText');
        var origBtnHtml = btn ? btn.innerHTML : '';
        if (btn) btn.disabled = true;

        var savedCount = 0;
        var failedCount = 0;
        var savedUids = new Set();

        for (var i = 0; i < toSave.length; i++) {
            var item = toSave[i];
            if (btn) btn.innerHTML = '⏳ Saving (' + (i + 1) + '/' + toSave.length + ')...';
            if (progEl) progEl.textContent = '⏳ সেভ হচ্ছে (' + (i + 1) + '/' + toSave.length + '): ' + item.name + (item.sku ? ' [' + item.sku + ']' : '');

            try {
                await saveOneStagedProduct(item);
                savedCount++;
                savedUids.add(item._uid);
            } catch (err) {
                console.error('Bulk save error for', item.name, err);
                failedCount++;
            }
        }

        // Remove successfully saved items from staging list
        bulkStagedItems = bulkStagedItems.filter(function(x) { return !savedUids.has(x._uid); });

        isBulkSaving = false;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origBtnHtml;
        }

        renderBulkStagingList();

        if (typeof loadProducts === 'function') {
            loadProducts();
        }

        if (savedCount > 0 && failedCount === 0) {
            if (progEl) progEl.textContent = '✅ সফলভাবে ' + savedCount + 'টি প্রোডাক্ট সেভ হয়েছে!';
            if (typeof showToast === 'function') showToast('🎉 সফলভাবে ' + savedCount + 'টি প্রোডাক্ট স্টোরে যুক্ত হয়েছে!', 'success');
            setTimeout(function() {
                if (bulkStagedItems.length === 0 && typeof closeModal === 'function') {
                    closeModal('bulkStudioModal');
                }
            }, 900);
        } else if (savedCount > 0) {
            if (progEl) progEl.textContent = '⚠️ ' + savedCount + 'টি সেভ হয়েছে, ' + failedCount + 'টি ব্যর্থ হয়েছে।';
            if (typeof showToast === 'function') showToast(savedCount + 'টি সেভ হয়েছে, ' + failedCount + 'টি ব্যর্থ', 'warning');
        } else {
            if (progEl) progEl.textContent = '❌ প্রোডাক্ট সেভ করা যায়নি।';
            if (typeof showToast === 'function') showToast('প্রোডাক্ট সেভ ব্যর্থ হয়েছে', 'error');
        }
    };

    function escHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function escAttr(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBulkStudioUI);
    } else {
        initBulkStudioUI();
    }
})();
