// ============================================================
// Ranonex Multi-Brand Frontend Context & Interceptor (brand-context.js)
// Automatically handles:
// 1. Detecting current brand from window.__BRAND__ or URL pathname
// 2. Appending ?brand=<slug> to /api/public-data & /api/checkout-data fetches
// 3. Rewriting internal links (/shop, /product, /cart, /checkout, /track, /) to stay inside the brand
// 4. Switching main-site clicks on brand products (show_on_main=1) directly to /<brand>/product?id=...
// 5. Enriching shared cart (fbr_cart) & direct order items with brand_id, brand_slug, brand_name, selected
// 6. Rendering "Our Official Brands" co-promotion section on main site & "Official Ranonex Brand" badge on brand sites
// ============================================================

(function () {
    var RESERVED = {
        'api': 1, 'admin': 1, 'assets': 1, 'functions': 1, 'migrations': 1, 'scripts': 1,
        'supabase': 1, 'worker': 1, 'wp': 1, 'shop': 1, 'product': 1, 'cart': 1,
        'checkout': 1, 'track': 1, 'policies': 1, 'team': 1, 'profile': 1, 'login': 1,
        'register': 1, 'forgot-password': 1, 'success': 1, 'invoice': 1, 'offline': 1,
        '404': 1, 'fraud-chack': 1, 'full-page-demo': 1, 'hero-v2-demo': 1,
        'pricing-section': 1, 'premium_e_commerce_pricing': 1, 'appwrite-schema-builder': 1,
        'sitemap.xml': 1, 'robots.txt': 1, 'favicon.ico': 1, 'sw.js': 1, 'index.html': 1
    };

    function detectBrandFromUrl() {
        var path = (window.location.pathname || '/').replace(/^\/+|\/+$/g, '');
        if (!path) return null;
        var first = path.split('/')[0].toLowerCase().replace(/\.html$/, '');
        if (!first || first.indexOf('.') !== -1 || RESERVED[first]) return null;
        return first;
    }

    var ssrBrand = window.__BRAND__ || null;
    var detectedSlug = (ssrBrand && ssrBrand.slug) ? ssrBrand.slug : detectBrandFromUrl();

    var BRAND = {
        id: (ssrBrand && ssrBrand.id) ? ssrBrand.id : null,
        slug: detectedSlug || '',
        name: (ssrBrand && ssrBrand.name) ? ssrBrand.name : '',
        tagline: (ssrBrand && ssrBrand.tagline) ? ssrBrand.tagline : '',
        logo_url: (ssrBrand && ssrBrand.logo_url) ? ssrBrand.logo_url : '',
        favicon_url: (ssrBrand && ssrBrand.favicon_url) ? ssrBrand.favicon_url : '',
        prefix: detectedSlug ? ('/' + detectedSlug) : '',
        main_store_name: (ssrBrand && ssrBrand.main_store_name) ? ssrBrand.main_store_name : 'Ranonex',
        allBrands: [],
        productBrandMap: {}, // productId -> { brand_id, brand_slug, brand_name }

        isBrandSite: function () {
            return !!this.slug;
        },

        url: function (path) {
            if (!path) return this.prefix ? (this.prefix + '/') : '/';
            var clean = String(path).trim();
            if (clean === '/' || clean === 'index.html' || clean === '/index.html') {
                return this.prefix ? (this.prefix + '/') : '/';
            }
            if (clean.indexOf('http://') === 0 || clean.indexOf('https://') === 0 || clean.indexOf('mailto:') === 0 || clean.indexOf('tel:') === 0 || clean.indexOf('#') === 0) {
                return clean;
            }
            clean = clean.replace(/^\.\//, '/');
            if (clean.charAt(0) !== '/') clean = '/' + clean;
            clean = clean
                .replace(/^\/shop\.html\b/, '/shop')
                .replace(/^\/product\.html\b/, '/product')
                .replace(/^\/cart\.html\b/, '/cart')
                .replace(/^\/checkout\.html\b/, '/checkout')
                .replace(/^\/success\.html\b/, '/success')
                .replace(/^\/track\.html\b/, '/track')
                .replace(/^\/policies\.html\b/, '/policies')
                .replace(/^\/team\.html\b/, '/team')
                .replace(/^\/invoice\.html\b/, '/invoice')
                .replace(/^\/profile\.html\b/, '/profile')
                .replace(/^\/login\.html\b/, '/login')
                .replace(/^\/register\.html\b/, '/register');

            if (!this.prefix) return clean;
            if (clean.indexOf(this.prefix + '/') === 0 || clean === this.prefix) return clean;

            var scoped = ['/shop', '/product', '/cart', '/checkout', '/success', '/track', '/policies', '/team', '/invoice'];
            for (var i = 0; i < scoped.length; i++) {
                var p = scoped[i];
                if (clean === p || clean.indexOf(p + '?') === 0 || clean.indexOf(p + '#') === 0) {
                    return this.prefix + clean;
                }
            }
            return clean;
        },

        productUrl: function (productOrId) {
            var pid = (typeof productOrId === 'object' && productOrId) ? productOrId.id : productOrId;
            var bSlug = '';
            if (typeof productOrId === 'object' && productOrId && productOrId.brand_slug) {
                bSlug = productOrId.brand_slug;
            } else if (pid && this.productBrandMap[pid] && this.productBrandMap[pid].brand_slug) {
                bSlug = this.productBrandMap[pid].brand_slug;
            } else if (this.slug) {
                bSlug = this.slug;
            }
            var pref = bSlug ? ('/' + bSlug) : '';
            return pref + '/product?id=' + encodeURIComponent(pid || '');
        },

        api: function (urlStr) {
            if (!this.slug || !urlStr) return urlStr;
            if (urlStr.indexOf('brand=') !== -1) return urlStr;
            var sep = urlStr.indexOf('?') === -1 ? '?' : '&';
            return urlStr + sep + 'brand=' + encodeURIComponent(this.slug);
        },

        registerPublicData: function (data) {
            if (!data) return;
            if (data.main_settings && data.main_settings.store_name) {
                this.main_store_name = data.main_settings.store_name;
            }
            if (data.brand) {
                this.id = data.brand.id || this.id;
                this.slug = data.brand.slug || this.slug;
                this.name = data.brand.name || this.name;
                this.tagline = data.brand.tagline || this.tagline;
                this.logo_url = data.brand.logo_url || this.logo_url;
                this.favicon_url = data.brand.favicon_url || this.favicon_url;
                this.prefix = this.slug ? ('/' + this.slug) : '';
                if (data.brand.theme_colors_obj) {
                    this.applyThemeColors(data.brand.theme_colors_obj);
                }
            }
            if (Array.isArray(data.brands)) {
                this.allBrands = data.brands;
                try { sessionStorage.setItem('__fbr_brands_list', JSON.stringify(data.brands)); } catch (e) {}
            }
            if (Array.isArray(data.products)) {
                this.indexProducts(data.products);
            }
            setTimeout(function () {
                BRAND.rewriteDomLinks(document.body);
                BRAND.renderBrandCoPromotion();
            }, 60);
        },

        indexProducts: function (prods) {
            if (!Array.isArray(prods)) return;
            for (var i = 0; i < prods.length; i++) {
                var p = prods[i];
                if (!p || !p.id) continue;
                this.productBrandMap[p.id] = {
                    brand_id: p.brand_id || null,
                    brand_slug: p.brand_slug || '',
                    brand_name: p.brand_name || (p.brand_id ? this.getBrandNameById(p.brand_id) : this.main_store_name)
                };
            }
            try {
                sessionStorage.setItem('__fbr_prod_brand_map', JSON.stringify(this.productBrandMap));
            } catch (e) {}
        },

        getBrandNameById: function (brandId) {
            if (!brandId) return this.main_store_name || 'Ranonex';
            for (var i = 0; i < this.allBrands.length; i++) {
                if (this.allBrands[i].id === brandId) return this.allBrands[i].name;
            }
            return this.name || this.main_store_name || 'Ranonex';
        },

        getBrandById: function (brandId) {
            if (!brandId) return null;
            for (var i = 0; i < this.allBrands.length; i++) {
                if (this.allBrands[i].id === brandId) return this.allBrands[i];
            }
            return null;
        },

        applyThemeColors: function (tc) {
            if (!tc || typeof tc !== 'object') return;
            var root = document.documentElement;
            if (tc.primary) root.style.setProperty('--primary', tc.primary);
            if (tc.primary_dark) root.style.setProperty('--primary-dark', tc.primary_dark);
            if (tc.accent) root.style.setProperty('--accent', tc.accent);
        },

        enrichCartArray: function (items) {
            if (!Array.isArray(items)) return items;
            var self = this;
            return items.map(function (item) {
                if (!item || typeof item !== 'object') return item;
                var pid = item.productId || item.id;
                var mapped = pid ? self.productBrandMap[pid] : null;

                if (item.brand_id === undefined) {
                    if (mapped && mapped.brand_id !== undefined) {
                        item.brand_id = mapped.brand_id;
                        item.brand_slug = mapped.brand_slug || '';
                        item.brand_name = mapped.brand_name || self.main_store_name;
                    } else if (self.id) {
                        item.brand_id = self.id;
                        item.brand_slug = self.slug;
                        item.brand_name = self.name;
                    } else {
                        item.brand_id = null;
                        item.brand_slug = '';
                        item.brand_name = self.main_store_name || 'Ranonex';
                    }
                } else if (!item.brand_name) {
                    item.brand_name = item.brand_id ? self.getBrandNameById(item.brand_id) : (self.main_store_name || 'Ranonex');
                }

                if (item.selected === undefined) {
                    item.selected = true;
                }
                if (!item.product_url && pid) {
                    item.product_url = (item.brand_slug ? ('/' + item.brand_slug) : '') + '/product?id=' + encodeURIComponent(pid);
                }
                return item;
            });
        },

        rewriteDomLinks: function (root) {
            if (!root || !root.querySelectorAll) return;
            var self = this;
            var links = root.querySelectorAll('a[href]');
            for (var i = 0; i < links.length; i++) {
                var a = links[i];
                if (a.hasAttribute('data-brand-explicit')) continue;
                var rawHref = a.getAttribute('href');
                if (!rawHref) continue;

                // Check if this is a product card link that should point to a specific brand URL (R1)
                var prodMatch = rawHref.match(/^(?:\/[a-z0-9-]+)?\/product(?:\.html)?\?id=([^&#]+)/i) ||
                                rawHref.match(/^product\.html\?id=([^&#]+)/i);
                if (prodMatch && prodMatch[1]) {
                    var pid = decodeURIComponent(prodMatch[1]);
                    var pInfo = self.productBrandMap[pid];
                    if (pInfo && pInfo.brand_slug) {
                        var targetHref = '/' + pInfo.brand_slug + '/product?id=' + encodeURIComponent(pid);
                        if (rawHref !== targetHref) a.setAttribute('href', targetHref);
                        // Add subtle brand badge on main site product cards when show_on_main = 1
                        if (!self.slug && pInfo.brand_name && a.classList.contains('product-card')) {
                            var badgesWrap = a.querySelector('.product-badges');
                            if (badgesWrap && !badgesWrap.querySelector('.badge-brand-tag')) {
                                var bSpan = document.createElement('span');
                                bSpan.className = 'product-badge badge-brand-tag';
                                bSpan.style.cssText = 'background:rgba(17,24,39,0.85);color:#fff;font-size:10px;padding:3px 8px;border-radius:6px;font-weight:700;';
                                bSpan.textContent = '🏷️ ' + pInfo.brand_name;
                                badgesWrap.appendChild(bSpan);
                            }
                        }
                        continue;
                    }
                }

                if (self.slug) {
                    var updated = self.url(rawHref);
                    if (updated && updated !== rawHref) {
                        a.setAttribute('href', updated);
                    }
                }
            }
        },

        renderBrandCoPromotion: function () {
            var self = this;
            var footer = document.getElementById('mainFooter') || document.querySelector('footer');

            // 1. Footer Co-Promotion Bar on Brand Storefronts
            if (this.slug && footer && !document.getElementById('brandParentPromoBar')) {
                var bar = document.createElement('div');
                bar.id = 'brandParentPromoBar';
                bar.style.cssText = 'margin-top:14px;padding-top:12px;border-top:1px dashed rgba(255,255,255,0.15);font-size:12.5px;color:#bbb;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;';
                bar.innerHTML = '<span>🏷️ <strong>' + escapeHtml(this.name || this.slug) + '</strong> is an official brand of <strong>' + escapeHtml(this.main_store_name || 'Ranonex') + '</strong></span>' +
                    '<a href="/" data-brand-explicit="1" style="color:#fff;background:rgba(255,255,255,0.12);padding:5px 12px;border-radius:20px;text-decoration:none;font-weight:600;font-size:12px;">🏠 Visit ' + escapeHtml(this.main_store_name || 'Ranonex') + ' Main Store ↗</a>';
                var bottom = footer.querySelector('.footer-bottom');
                if (bottom) bottom.parentNode.insertBefore(bar, bottom);
                else footer.appendChild(bar);
            }

            // Build list of shortcut items:
            // - On Main Site: all active brands
            // - On a Brand Site: Main Store + other active sibling brands
            var shortcutItems = [];
            if (this.slug) {
                shortcutItems.push({
                    name: (this.main_store_name || 'Ranonex') + ' (Main Store)',
                    tagline: 'All Categories & Official Store',
                    href: '/',
                    logo_url: '',
                    isMainStore: true
                });
            }
            if (Array.isArray(this.allBrands)) {
                this.allBrands.forEach(function (b) {
                    if (!b || !b.slug) return;
                    if (self.slug && b.slug.toLowerCase() === self.slug.toLowerCase()) return;
                    shortcutItems.push({
                        name: b.name,
                        tagline: b.tagline || ('Official ' + b.name + ' Store'),
                        href: '/' + encodeURIComponent(b.slug) + '/',
                        logo_url: b.logo_url || '',
                        primary_color: b.theme_primary_color || '',
                        isMainStore: false
                    });
                });
            }

            if (!shortcutItems.length) return;

            var sectionTitle = this.slug ? 'Explore Our Other Brands' : 'Explore Our Brands';

            // Build Category-style horizontal shortcut items HTML
            var pillsHtml = shortcutItems.map(function (item) {
                var badgeColor = item.primary_color || 'var(--primary, #8B1A1A)';
                var avatarHtml = item.logo_url
                    ? '<img src="' + escapeHtml(item.logo_url) + '" alt="' + escapeHtml(item.name) + '" style="width:48px;height:48px;border-radius:50%;object-fit:cover;background:#fff;border:2px solid #f1f5f9;box-shadow:0 2px 6px rgba(0,0,0,0.06);flex-shrink:0;">'
                    : '<div style="width:48px;height:48px;border-radius:50%;background:' + (item.isMainStore ? '#0f172a' : badgeColor) + ';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;box-shadow:0 3px 8px rgba(0,0,0,0.12);flex-shrink:0;">' +
                        (item.isMainStore ? '🏠' : escapeHtml((item.name || 'B').charAt(0).toUpperCase())) +
                      '</div>';

                return '<a href="' + item.href + '" data-brand-explicit="1" style="display:flex;align-items:center;gap:11px;padding:8px 14px 8px 9px;background:#fff;border:1.5px solid #e2e8f0;border-radius:40px;text-decoration:none;color:var(--text-dark,#0f172a);box-shadow:0 2px 8px rgba(0,0,0,0.04);transition:all 0.2s ease;flex-shrink:0;" onmouseover="this.style.transform=\'translateY(-2px)\';this.style.borderColor=\'var(--primary,#8B1A1A)\';this.style.boxShadow=\'0 6px 16px rgba(0,0,0,0.08)\'" onmouseout="this.style.transform=\'\';this.style.borderColor=\'#e2e8f0\';this.style.boxShadow=\'0 2px 8px rgba(0,0,0,0.04)\'">' +
                    avatarHtml +
                    '<div style="text-align:left;padding-right:4px;">' +
                        '<div style="font-weight:800;font-size:13.5px;line-height:1.2;color:#0f172a;white-space:nowrap;">' + escapeHtml(item.name) + '</div>' +
                        '<div style="font-size:11px;font-weight:600;color:var(--primary,#8B1A1A);margin-top:2px;white-space:nowrap;">Visit Brand Store →</div>' +
                    '</div>' +
                '</a>';
            }).join('');

            var barInnerHtml =
                '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;flex-wrap:wrap;">' +
                    '<div style="display:flex;align-items:center;gap:7px;">' +
                        '<span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:rgba(139,26,26,0.1);color:var(--primary,#8B1A1A);font-size:14px;">🏷️</span>' +
                        '<span style="font-size:15px;font-weight:800;color:var(--text-dark,#0f172a);letter-spacing:-0.2px;">' + sectionTitle + '</span>' +
                    '</div>' +
                    '<span style="font-size:11px;font-weight:700;color:#64748b;background:#f1f5f9;padding:3px 9px;border-radius:20px;">' + shortcutItems.length + (shortcutItems.length === 1 ? ' Storefront' : ' Storefronts') + '</span>' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:10px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;-ms-overflow-style:none;">' +
                    pillsHtml +
                '</div>';

            // 2A. Inject into Template V1 (right after #catStickyBar or #heroSection)
            var v1Anchor = document.getElementById('catStickyBar') || document.getElementById('heroSection');
            if (v1Anchor && v1Anchor.parentNode && !document.getElementById('exploreBrandsBarV1')) {
                var v1Sec = document.createElement('div');
                v1Sec.id = 'exploreBrandsBarV1';
                v1Sec.style.cssText = 'margin:14px 0 6px;padding:12px 16px;background:linear-gradient(135deg,#ffffff,#f8fafc);border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 2px 10px rgba(0,0,0,0.03);';
                v1Sec.innerHTML = barInnerHtml;
                if (v1Anchor.nextSibling) v1Anchor.parentNode.insertBefore(v1Sec, v1Anchor.nextSibling);
                else v1Anchor.parentNode.appendChild(v1Sec);
            }

            // 2B. Inject into Template V2 (#v2-theme-wrapper main)
            var v2Main = document.querySelector('#v2-theme-wrapper main');
            if (v2Main && !document.getElementById('exploreBrandsBarV2')) {
                var v2Sec = document.createElement('section');
                v2Sec.id = 'exploreBrandsBarV2';
                v2Sec.className = 'py-4 md:py-6 bg-white border-b border-gray-100';
                v2Sec.innerHTML = '<div class="container mx-auto px-4 lg:px-24">' + barInnerHtml + '</div>';
                // Insert right after the Hero slider or Categories section in V2
                var v2Sections = v2Main.querySelectorAll(':scope > section');
                var insertAfter = v2Sections.length > 1 ? v2Sections[1] : v2Sections[0];
                if (insertAfter && insertAfter.nextSibling) {
                    v2Main.insertBefore(v2Sec, insertAfter.nextSibling);
                } else {
                    v2Main.insertBefore(v2Sec, v2Main.firstChild);
                }
            }

            // 2C. Inject into Mobile Drawer Menu (#mMenuCats)
            var mmCats = document.getElementById('mMenuCats');
            if (mmCats && !document.getElementById('mMenuBrandsBlock')) {
                var mmBlock = document.createElement('div');
                mmBlock.id = 'mMenuBrandsBlock';
                mmBlock.style.cssText = 'margin-top:12px;padding-top:12px;border-top:1px solid #eee;';
                mmBlock.innerHTML = '<div style="font-size:11px;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:0.6px;padding:0 10px 6px;">🏷️ ' + sectionTitle + '</div>' +
                    shortcutItems.map(function (item) {
                        return '<a href="' + item.href + '" data-brand-explicit="1" style="display:flex;align-items:center;gap:8px;padding:9px 10px;font-weight:700;color:var(--text-dark,#111);border-radius:10px;text-decoration:none;">' +
                            '<span class="mmenu-cat-icon">' + (item.isMainStore ? '🏠' : '🏷️') + '</span>' +
                            '<span>' + escapeHtml(item.name) + '</span>' +
                        '</a>';
                    }).join('');
                mmCats.appendChild(mmBlock);
            }
        }
    };

    function escapeHtml(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Restore cached maps from sessionStorage for instant cart/link enrichment across page navigations
    try {
        var cachedBrands = sessionStorage.getItem('__fbr_brands_list');
        if (cachedBrands) BRAND.allBrands = JSON.parse(cachedBrands) || [];
        var cachedMap = sessionStorage.getItem('__fbr_prod_brand_map');
        if (cachedMap) BRAND.productBrandMap = JSON.parse(cachedMap) || {};
    } catch (e) {}

    window.BRAND = BRAND;

    // ── Intercept window.fetch to auto-append ?brand=<slug> & capture brand metadata ──
    if (typeof window.fetch === 'function') {
        var origFetch = window.fetch;
        window.fetch = function (input, init) {
            var urlStr = (typeof input === 'string') ? input : (input && input.url ? input.url : '');
            if (urlStr && (urlStr.indexOf('/api/public-data') !== -1 || urlStr.indexOf('/api/checkout-data') !== -1)) {
                if (BRAND.slug && urlStr.indexOf('brand=') === -1) {
                    var newUrl = BRAND.api(urlStr);
                    input = (typeof input === 'string') ? newUrl : new Request(newUrl, input);
                }
                return origFetch.call(this, input, init).then(function (response) {
                    try {
                        var clone = response.clone();
                        clone.json().then(function (json) {
                            if (json && json.success) {
                                if (json.data) BRAND.registerPublicData(json.data);
                                else if (Array.isArray(json.products)) BRAND.indexProducts(json.products);
                                else if (json.product) {
                                    BRAND.indexProducts([json.product]);
                                    if (Array.isArray(json.brands)) BRAND.allBrands = json.brands;
                                }
                            }
                        }).catch(function () {});
                    } catch (e) {}
                    return response;
                });
            }
            return origFetch.call(this, input, init);
        };
    }

    // ── Intercept localStorage.setItem to auto-tag cart & direct order items with brand info ──
    try {
        var origSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
            var cartKey = (typeof CONFIG !== 'undefined' && CONFIG.CART_KEY) ? CONFIG.CART_KEY : 'fbr_cart';
            var directKey = (typeof CONFIG !== 'undefined' && CONFIG.DIRECT_ORDER_KEY) ? CONFIG.DIRECT_ORDER_KEY : 'fbr_direct_order';
            if (key === cartKey || key === directKey || key === 'fbr_checkout_items') {
                try {
                    var parsed = JSON.parse(value);
                    if (Array.isArray(parsed)) {
                        value = JSON.stringify(BRAND.enrichCartArray(parsed));
                    }
                } catch (e) {}
            }
            return origSetItem.call(this, key, value);
        };
    } catch (e) {}

    // ── DOM Ready & MutationObserver to keep dynamic links inside brand context ──
    document.addEventListener('DOMContentLoaded', function () {
        BRAND.rewriteDomLinks(document.body);

        // Observe dynamic product grids and menus
        if (typeof MutationObserver !== 'undefined' && document.body) {
            var timer = null;
            var observer = new MutationObserver(function () {
                if (timer) clearTimeout(timer);
                timer = setTimeout(function () {
                    BRAND.rewriteDomLinks(document.body);
                    BRAND.renderBrandCoPromotion();
                }, 80);
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    });
})();

