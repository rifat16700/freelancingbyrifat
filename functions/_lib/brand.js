// ============================================================
// Multi-Brand Core Helper for Cloudflare Pages Functions
// Handles:
// - Reserved slug validation
// - Safe auto-migration (ensures brands, brand_slug_history & brand_id columns exist)
// - Resolving active brands & slug history (301 redirect support)
// - Merging brand settings with global store settings
// - Rewriting internal anchor links & injecting window.__BRAND__ + theme CSS
// ============================================================

export const RESERVED_SLUGS = new Set([
    'api', 'admin', 'assets', 'functions', 'migrations', 'scripts', 'supabase', 'worker', 'wp',
    'shop', 'product', 'cart', 'checkout', 'track', 'policies', 'team', 'profile',
    'login', 'register', 'forgot-password', 'success', 'invoice', 'offline', '404',
    'fraud-chack', 'full-page-demo', 'hero-v2-demo', 'pricing-section', 'premium_e_commerce_pricing',
    'appwrite-schema-builder', 'sitemap', 'sitemap.xml', 'robots', 'robots.txt',
    'favicon', 'favicon.ico', 'sw', 'sw.js', 'index', 'index.html', 'public_data.json'
]);

let _migrationDone = false;

/**
 * Ensures multi-brand tables and columns exist in D1 automatically on first request.
 * Safe to run repeatedly; ignores "duplicate column" errors.
 */
export async function ensureBrandSchema(env) {
    if (_migrationDone || !env || !env.DB) return;
    _migrationDone = true;
    try {
        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS brands (
                id TEXT PRIMARY KEY,
                slug TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                tagline TEXT DEFAULT '',
                logo_url TEXT DEFAULT '',
                favicon_url TEXT DEFAULT '',
                theme_colors TEXT DEFAULT '{}',
                seo_title TEXT DEFAULT '',
                seo_description TEXT DEFAULT '',
                seo_keywords TEXT DEFAULT '',
                seo_og_image TEXT DEFAULT '',
                footer_text TEXT DEFAULT '',
                settings_override TEXT DEFAULT '{}',
                is_active INTEGER DEFAULT 1,
                sort_order INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `).run().catch(() => {});

        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS brand_slug_history (
                old_slug TEXT PRIMARY KEY,
                brand_id TEXT NOT NULL,
                changed_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `).run().catch(() => {});

        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS home_sections (
                id            TEXT PRIMARY KEY,
                title         TEXT DEFAULT '',
                subtitle      TEXT DEFAULT '',
                type          TEXT DEFAULT 'category',
                section_type  TEXT DEFAULT 'grid',
                category_id   TEXT DEFAULT NULL,
                product_ids   TEXT DEFAULT '[]',
                max_products  INTEGER DEFAULT 10,
                sort_order    INTEGER DEFAULT 0,
                display_order INTEGER DEFAULT 0,
                is_active     INTEGER DEFAULT 1,
                data          TEXT DEFAULT '{}',
                brand_id      TEXT DEFAULT NULL,
                created_at    TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `).run().catch(() => {});

        const alterStmts = [
            "ALTER TABLE products ADD COLUMN brand_id TEXT DEFAULT NULL",
            "ALTER TABLE products ADD COLUMN show_on_main INTEGER DEFAULT 0",
            "ALTER TABLE categories ADD COLUMN brand_id TEXT DEFAULT NULL",
            "ALTER TABLE banners ADD COLUMN brand_id TEXT DEFAULT NULL",
            "ALTER TABLE home_sections ADD COLUMN brand_id TEXT DEFAULT NULL",
            "ALTER TABLE home_sections ADD COLUMN type TEXT DEFAULT 'category'",
            "ALTER TABLE home_sections ADD COLUMN section_type TEXT DEFAULT 'grid'",
            "ALTER TABLE home_sections ADD COLUMN category_id TEXT DEFAULT NULL",
            "ALTER TABLE home_sections ADD COLUMN product_ids TEXT DEFAULT '[]'",
            "ALTER TABLE home_sections ADD COLUMN max_products INTEGER DEFAULT 10",
            "ALTER TABLE home_sections ADD COLUMN sort_order INTEGER DEFAULT 0",
            "ALTER TABLE home_sections ADD COLUMN display_order INTEGER DEFAULT 0",
            "ALTER TABLE home_sections ADD COLUMN is_active INTEGER DEFAULT 1",
            "ALTER TABLE home_sections ADD COLUMN data TEXT DEFAULT '{}'",
            "ALTER TABLE orders ADD COLUMN brand_id TEXT DEFAULT NULL",
            "ALTER TABLE orders ADD COLUMN order_group_id TEXT DEFAULT NULL",
            "ALTER TABLE promos ADD COLUMN brand_id TEXT DEFAULT NULL"
        ];
        for (const sql of alterStmts) {
            await env.DB.prepare(sql).run().catch(() => {});
        }
    } catch (e) {
        // Non-fatal
    }
}

export function cleanSlug(raw) {
    if (!raw || typeof raw !== 'string') return '';
    return raw.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
}

export function isReservedSlug(slug) {
    const s = cleanSlug(slug);
    if (!s) return true;
    if (s.includes('.')) return true; // static files (.html, .js, .css, .png, etc.)
    if (RESERVED_SLUGS.has(s)) return true;
    return false;
}

export function isValidBrandSlug(slug) {
    const s = cleanSlug(slug);
    if (!s || isReservedSlug(s)) return false;
    return /^[a-z0-9][a-z0-9-]{1,39}$/.test(s);
}

/**
 * Resolves a brand by slug or id.
 * Returns:
 *   { brand: {...}, redirectSlug: null }          -> active brand matched
 *   { brand: {...}, redirectSlug: 'new-slug' }    -> matched via brand_slug_history (caller should 301)
 *   { brand: null, redirectSlug: null }           -> not found or inactive
 */
export async function resolveBrand(env, slugOrId, allowById = false) {
    if (!env || !env.DB || !slugOrId) return { brand: null, redirectSlug: null };
    const s = cleanSlug(slugOrId);
    if (!s) return { brand: null, redirectSlug: null };

    if (!allowById && isReservedSlug(s)) {
        return { brand: null, redirectSlug: null };
    }

    await ensureBrandSchema(env);

    try {
        let brand = await env.DB.prepare(
            "SELECT * FROM brands WHERE lower(slug) = ? AND is_active = 1 LIMIT 1"
        ).bind(s).first();

        if (!brand && allowById) {
            brand = await env.DB.prepare(
                "SELECT * FROM brands WHERE id = ? AND is_active = 1 LIMIT 1"
            ).bind(slugOrId.trim()).first();
        }

        if (brand) {
            return { brand: normalizeBrandRow(brand), redirectSlug: null };
        }

        // Check slug history for 301 redirect if admin renamed the brand path
        const hist = await env.DB.prepare(
            "SELECT brand_id FROM brand_slug_history WHERE lower(old_slug) = ? LIMIT 1"
        ).bind(s).first().catch(() => null);

        if (hist && hist.brand_id) {
            const targetBrand = await env.DB.prepare(
                "SELECT * FROM brands WHERE id = ? AND is_active = 1 LIMIT 1"
            ).bind(hist.brand_id).first().catch(() => null);
            if (targetBrand && targetBrand.slug && targetBrand.slug.toLowerCase() !== s) {
                return { brand: normalizeBrandRow(targetBrand), redirectSlug: targetBrand.slug };
            }
        }
    } catch (e) {}

    return { brand: null, redirectSlug: null };
}

export async function getAllActiveBrands(env) {
    if (!env || !env.DB) return [];
    await ensureBrandSchema(env);
    try {
        const res = await env.DB.prepare(
            "SELECT * FROM brands WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC"
        ).all();
        return (res?.results || []).map(normalizeBrandRow);
    } catch (e) {
        return [];
    }
}

export function normalizeBrandRow(b) {
    if (!b) return null;
    let themeColors = {};
    let settingsOverride = {};
    try {
        themeColors = typeof b.theme_colors === 'string' ? JSON.parse(b.theme_colors || '{}') : (b.theme_colors || {});
    } catch (e) { themeColors = {}; }
    try {
        settingsOverride = typeof b.settings_override === 'string' ? JSON.parse(b.settings_override || '{}') : (b.settings_override || {});
    } catch (e) { settingsOverride = {}; }

    return {
        ...b,
        slug: cleanSlug(b.slug),
        prefix: '/' + cleanSlug(b.slug),
        meta_title: b.seo_title || '',
        meta_description: b.seo_description || '',
        meta_keywords: b.seo_keywords || '',
        og_image: b.seo_og_image || '',
        theme_primary_color: themeColors.primary || '',
        theme_accent_color: themeColors.accent || '',
        whatsapp_number: settingsOverride.whatsapp_number || '',
        facebook_url: settingsOverride.facebook_url || '',
        instagram_url: settingsOverride.instagram_url || '',
        youtube_url: settingsOverride.youtube_url || '',
        social_links: {
            whatsapp: settingsOverride.whatsapp_number || '',
            phone: settingsOverride.whatsapp_number || '',
            facebook: settingsOverride.facebook_url || '',
            instagram: settingsOverride.instagram_url || '',
            youtube: settingsOverride.youtube_url || ''
        },
        theme_colors_obj: themeColors,
        settings_override_obj: settingsOverride
    };
}

/**
 * Merges global store settings with brand overrides (R3 & R4).
 * Payment, delivery, Telegram remain shared; name, logo, favicon, SEO, and optional social links override.
 */
export function mergeSettingsWithBrand(globalSettings, brand) {
    const base = { ...(globalSettings || {}) };
    if (!brand) return base;

    const mainStoreName = base.store_name || 'Ranonex';
    const ov = brand.settings_override_obj || {};

    base.main_store_name = mainStoreName;
    base.main_logo_url = base.logo_url || '';
    base.store_name = brand.name || mainStoreName;

    if (brand.logo_url && brand.logo_url.trim()) base.logo_url = brand.logo_url.trim();
    if (brand.favicon_url && brand.favicon_url.trim()) base.favicon_url = brand.favicon_url.trim();
    if (brand.footer_text && brand.footer_text.trim()) base.footer_text = brand.footer_text.trim();

    // SEO co-promotion (R4): merge brand + main keywords, format title/description
    base.seo_title = buildBrandSeoTitle(globalSettings, brand);
    base.seo_description = buildBrandSeoDescription(globalSettings, brand);
    base.seo_keywords = mergeBrandKeywords(globalSettings?.seo_keywords, brand.seo_keywords, brand.name, mainStoreName);
    if (brand.seo_og_image && brand.seo_og_image.trim()) {
        base.seo_og_image = brand.seo_og_image.trim();
    } else if (brand.logo_url && brand.logo_url.trim()) {
        base.seo_og_image = brand.logo_url.trim();
    }

    // Optional social overrides from Advanced section
    const allowedOverrides = ['whatsapp_number', 'facebook_url', 'instagram_url', 'youtube_url', 'messaging_apps', 'footer_text'];
    for (const key of allowedOverrides) {
        if (ov[key] !== undefined && ov[key] !== null && String(ov[key]).trim() !== '') {
            base[key] = ov[key];
        }
    }

    base.brand_id = brand.id;
    base.brand_slug = brand.slug;
    base.brand_name = brand.name;
    base.brand_tagline = brand.tagline || '';

    return base;
}

export function buildBrandSeoTitle(globalSettings, brand) {
    const mainName = globalSettings?.store_name || 'Ranonex';
    if (!brand) {
        return globalSettings?.seo_title || `${mainName} — Online Shopping in Bangladesh`;
    }
    if (brand.seo_title && brand.seo_title.trim()) {
        const t = brand.seo_title.trim();
        return t.toLowerCase().includes(mainName.toLowerCase()) ? t : `${t} | ${mainName}`;
    }
    const tagline = (brand.tagline && brand.tagline.trim()) ? brand.tagline.trim() : `Official ${brand.name} Store`;
    return `${brand.name} — ${tagline} | ${mainName}`;
}

export function buildBrandSeoDescription(globalSettings, brand) {
    const mainName = globalSettings?.store_name || 'Ranonex';
    const mainDesc = globalSettings?.seo_description || globalSettings?.footer_text || `Best quality products, fastest delivery, and cash on delivery all over Bangladesh.`;
    if (!brand) return mainDesc;
    if (brand.seo_description && brand.seo_description.trim()) {
        return brand.seo_description.trim();
    }
    return `${brand.name}${brand.tagline ? ' — ' + brand.tagline : ''}. An official ${mainName} brand store. ${mainDesc}`;
}

export function mergeBrandKeywords(mainKeywords, brandKeywords, brandName, mainName) {
    const parts = [];
    if (brandName) parts.push(brandName);
    if (brandKeywords) parts.push(...String(brandKeywords).split(','));
    if (mainName) parts.push(mainName);
    if (mainKeywords) parts.push(...String(mainKeywords).split(','));
    parts.push('online shopping bangladesh', 'ecommerce');

    const seen = new Set();
    const out = [];
    for (const raw of parts) {
        const k = String(raw || '').trim();
        if (!k) continue;
        const lower = k.toLowerCase();
        if (!seen.has(lower)) {
            seen.add(lower);
            out.push(k);
        }
    }
    return out.join(', ');
}

/**
 * Generates <script>window.__BRAND__=...</script> and optional theme CSS overrides to prepend into <head>.
 */
export function buildBrandHeadInjection(brand, globalSettings) {
    const mainName = globalSettings?.store_name || 'Ranonex';
    const payload = brand ? {
        id: brand.id,
        slug: brand.slug,
        name: brand.name,
        tagline: brand.tagline || '',
        logo_url: brand.logo_url || '',
        favicon_url: brand.favicon_url || '',
        prefix: '/' + brand.slug,
        theme_colors: brand.theme_colors_obj || {},
        main_store_name: mainName
    } : {
        id: null,
        slug: '',
        name: mainName,
        tagline: '',
        logo_url: globalSettings?.logo_url || '',
        favicon_url: globalSettings?.favicon_url || '',
        prefix: '',
        theme_colors: {},
        main_store_name: mainName
    };

    const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c');
    let html = `\n    <script>window.__BRAND__ = ${safeJson};</script>`;

    if (brand && brand.theme_colors_obj) {
        const tc = brand.theme_colors_obj;
        const rules = [];
        if (tc.primary && /^[#a-zA-Z0-9(),.\s%-]+$/.test(tc.primary)) {
            rules.push(`--primary: ${tc.primary};`);
        }
        if (tc.primary_dark && /^[#a-zA-Z0-9(),.\s%-]+$/.test(tc.primary_dark)) {
            rules.push(`--primary-dark: ${tc.primary_dark};`);
        }
        if (tc.accent && /^[#a-zA-Z0-9(),.\s%-]+$/.test(tc.accent)) {
            rules.push(`--accent: ${tc.accent};`);
        }
        if (rules.length > 0) {
            html += `\n    <style id="brandThemeOverride">:root { ${rules.join(' ')} }</style>`;
        }
    }
    return html;
}

/**
 * Rewrites static <a href="..."> inside HTMLRewriter so links stay within the current brand prefix.
 * Account/Auth pages (/login, /register, /profile, /forgot-password) remain shared at root.
 */
export function rewriteAnchorHref(href, brand) {
    if (!href || typeof href !== 'string') return null;
    const prefix = brand ? ('/' + brand.slug) : '';

    let clean = href.trim();
    if (clean === 'index.html' || clean === '/index.html' || clean === '/') {
        return prefix ? (prefix + '/') : '/';
    }
    if (clean.startsWith('shop.html')) clean = '/shop' + clean.slice('shop.html'.length);
    else if (clean.startsWith('/shop.html')) clean = '/shop' + clean.slice('/shop.html'.length);
    else if (clean.startsWith('product.html')) clean = '/product' + clean.slice('product.html'.length);
    else if (clean.startsWith('/product.html')) clean = '/product' + clean.slice('/product.html'.length);
    else if (clean === 'cart.html' || clean === '/cart.html') clean = '/cart';
    else if (clean === 'checkout.html' || clean === '/checkout.html') clean = '/checkout';
    else if (clean === 'policies.html' || clean === '/policies.html') clean = '/policies';
    else if (clean === 'team.html' || clean === '/team.html') clean = '/team';
    else if (clean === 'track.html' || clean === '/track.html') clean = '/track';
    else if (clean === 'success.html' || clean === '/success.html') clean = '/success';

    if (!prefix) return clean !== href ? clean : null;

    // Prefix brand-scoped routes
    const brandScopedPrefixes = ['/shop', '/product', '/cart', '/checkout', '/policies', '/team', '/track', '/success'];
    for (const p of brandScopedPrefixes) {
        if (clean === p || clean.startsWith(p + '?') || clean.startsWith(p + '#')) {
            return prefix + clean;
        }
    }
    return clean !== href ? clean : null;
}

export function escapeAttr(str) {
    return (str || '').toString()
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Serves the custom in-site 404.html page with HTTP 404 status.
 * - If `validBrand` is provided (user typed a wrong path under an active brand, e.g. /gadgets/wrong),
 *   the "Continue Shopping" button directs to `/<brand>/shop`.
 * - If `validBrand` is null (brand does not exist or is inactive),
 *   the "Continue Shopping" button directs to `/shop` (default main site shop).
 */
export async function serveNotFoundPage(context, validBrand = null) {
    const { request, env } = context;
    const targetShopUrl = (validBrand && validBrand.slug) ? `/${validBrand.slug}/shop` : '/shop';
    const targetLabel = (validBrand && validBrand.name) ? `Continue Shopping (${validBrand.name})` : 'Continue Shopping';
    try {
        let nfRes = await env.ASSETS.fetch(new Request(new URL('/404', request.url), { method: 'GET' }));
        if (!nfRes || nfRes.status === 301 || nfRes.status === 302 || nfRes.status === 307 || nfRes.status === 308 || !nfRes.body) {
            const loc = nfRes?.headers?.get('Location');
            if (loc) {
                nfRes = await env.ASSETS.fetch(new Request(new URL(loc, request.url), { method: 'GET' }));
            } else {
                nfRes = await env.ASSETS.fetch(new Request(new URL('/404.html', request.url), { method: 'GET' }));
            }
        }
        if (nfRes && nfRes.body) {
            const rewriter = new HTMLRewriter()
                .on('head', {
                    element(e) {
                        const script = `<script>window.__404_SHOP_URL__=${JSON.stringify(targetShopUrl)};window.__404_BRAND_NAME__=${JSON.stringify(validBrand?.name || '')};</script>`;
                        e.prepend(script, { html: true });
                    }
                })
                .on('a.btn-continue', {
                    element(e) {
                        e.setAttribute('href', targetShopUrl);
                    }
                });
            const transformed = rewriter.transform(nfRes);
            return new Response(transformed.body, {
                status: 404,
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
        }
    } catch (e) {}
    return Response.redirect(new URL(targetShopUrl, request.url).toString(), 302);
}


