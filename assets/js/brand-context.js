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
            var footer = document.getElementById('mainFooter') || document.querySelector('footer');
            if (!footer) return;

            // 1. On a Brand Storefront: show "Official Ranonex Brand" badge + link back to Main Store in footer
            if (this.slug) {
                if (!document.getElementById('brandParentPromoBar')) {
                    var bar = document.createElement('div');
                    bar.id = 'brandParentPromoBar';
                    bar.style.cssText = 'margin-top:14px;padding-top:12px;border-top:1px dashed rgba(255,255,255,0.15);font-size:12.5px;color:#bbb;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;';
                    bar.innerHTML = '<span>🏷️ <strong>' + escapeHtml(this.name || this.slug) + '</strong> is an official brand of <strong>' + escapeHtml(this.main_store_name || 'Ranonex') + '</strong></span>' +
                        '<a href="/" data-brand-explicit="1" style="color:#fff;background:rgba(255,255,255,0.12);padding:5px 12px;border-radius:20px;text-decoration:none;font-weight:600;font-size:12px;">🏠 Visit ' + escapeHtml(this.main_store_name || 'Ranonex') + ' Main Store ↗</a>';
                    var bottom = footer.querySelector('.footer-bottom');
                    if (bottom) bottom.parentNode.insertBefore(bar, bottom);
                    else footer.appendChild(bar);
                }
                return;
            }

            // 2. On Main Site: show "Our Official Brands" strip if active brands exist
            if (!this.allBrands || !this.allBrands.length) return;
            if (document.getElementById('ourOfficialBrandsSection')) return;

            var cardsHtml = this.allBrands.map(function (b) {
                var logo = b.logo_url
                    ? '<img src="' + escapeHtml(b.logo_url) + '" alt="' + escapeHtml(b.name) + '" style="width:42px;height:42px;border-radius:50%;object-fit:cover;background:#fff;border:1px solid #eee;">'
                    : '<div style="width:42px;height:42px;border-radius:50%;background:var(--primary,#8B1A1A);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;">' + escapeHtml((b.name || 'B').charAt(0).toUpperCase()) + '</div>';
                return '<a href="/' + encodeURIComponent(b.slug) + '/" data-brand-explicit="1" style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fff;border:1px solid var(--border-light,#eee);border-radius:14px;text-decoration:none;color:var(--text-dark,#111);box-shadow:0 2px 8px rgba(0,0,0,0.04);transition:transform 0.2s,box-shadow 0.2s;min-width:200px;flex:1 1 220px;max-width:320px;" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'\'">' +
                    logo +
                    '<div style="overflow:hidden;">' +
                        '<div style="font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(b.name) + '</div>' +
                        '<div style="font-size:11.5px;color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(b.tagline || ('Official ' + b.name + ' Store')) + ' →</div>' +
                    '</div>' +
                '</a>';
            }).join('');

            var allProdSec = document.getElementById('allProductsSection');
            if (allProdSec && allProdSec.parentNode) {
                var sec = document.createElement('section');
                sec.id = 'ourOfficialBrandsSection';
                sec.className = 'section';
                sec.style.cssText = 'margin-top:24px;margin-bottom:16px;';
                sec.innerHTML = '<h2 class="section-title" style="margin-bottom:14px;">🏷️ Our Official Brands</h2>' +
                    '<div style="display:flex;flex-wrap:wrap;gap:12px;">' + cardsHtml + '</div>';
                allProdSec.parentNode.insertBefore(sec, allProdSec);
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
                }, 80);
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    });
})();

