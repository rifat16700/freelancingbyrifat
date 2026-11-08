/**
 * ============================================================================
 * RANONEX UNIVERSAL PROXY HOSTING ENGINE (Node.js Edition)
 * Works on: AlwaysData (Node.js), cPanel Node.js Selector, VPS, Railway, Render
 * ============================================================================
 * শুধু নিচের ৪টি লাইন পরিবর্তন করুন (অথবা আপনার সাইটের /stup-site পেজ থেকে জেনারেট করুন):
 */
const ALLOWED_SITE_URL  = process.env.ALLOWED_SITE_URL  || 'https://ranonex.shop';          // 1. আপনার মেইন সাইটের URL (Whitelist)
const CF_ACCOUNT_ID     = process.env.CF_ACCOUNT_ID     || 'YOUR_CLOUDFLARE_ACCOUNT_ID';    // 2. Cloudflare Account ID
const CF_D1_DATABASE_ID = process.env.CF_D1_DATABASE_ID || 'YOUR_D1_DATABASE_ID';           // 3. Cloudflare D1 Database ID
const CF_API_TOKEN      = process.env.CF_API_TOKEN      || 'YOUR_CF_API_TOKEN_D1_READ';     // 4. Cloudflare API Token (D1:Read Permission)

const CACHE_TTL_SECONDS = 300; // 5 মিনিট (300s) JSON Database Cache
const CHUNK_SIZE        = 100; // প্রতি চ্যাঙ্কে ১০০টি করে প্রোডাক্ট
const PORT              = process.env.PORT || process.env.ALWAYSDATA_HTTPD_PORT || 8100;
const HOST              = process.env.IP   || process.env.ALWAYSDATA_HTTPD_IP   || '0.0.0.0';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { URL } = require('url');

const JSON_DB_DIR = path.join(__dirname, 'json_db');
if (!fs.existsSync(JSON_DB_DIR)) {
    fs.mkdirSync(JSON_DB_DIR, { recursive: true });
}

function safeCacheName(str) {
    return String(str || 'main').toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'main';
}

function readJsonCache(key, noCache) {
    if (noCache) return null;
    try {
        const file = path.join(JSON_DB_DIR, key + '.json');
        const stat = fs.statSync(file);
        if ((Date.now() - stat.mtimeMs) < CACHE_TTL_SECONDS * 1000) {
            return fs.readFileSync(file, 'utf8');
        }
    } catch (e) {}
    return null;
}

function writeJsonCache(key, jsonStr) {
    try {
        const file = path.join(JSON_DB_DIR, key + '.json');
        const tmp  = file + '.tmp.' + process.pid;
        fs.writeFileSync(tmp, jsonStr, 'utf8');
        fs.renameSync(tmp, file);
    } catch (e) {}
}

async function d1Query(sql, params = []) {
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DATABASE_ID}/query`;
    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CF_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql, params })
        });
        if (!res.ok) return [];
        const json = await res.json();
        return (json && json.success && json.result && json.result[0] && json.result[0].results)
            ? json.result[0].results
            : [];
    } catch (e) {
        return [];
    }
}

function parseSharedBrands(cat) {
    if (!cat || !cat.shared_brand_ids) return [];
    try {
        const arr = typeof cat.shared_brand_ids === 'string' ? JSON.parse(cat.shared_brand_ids) : cat.shared_brand_ids;
        return Array.isArray(arr) ? arr.map(String) : [];
    } catch (e) { return []; }
}

function isCatVisibleOnBrand(cat, brandId) {
    const cBrand = cat && cat.brand_id ? String(cat.brand_id).trim() : '';
    if (!brandId) return cBrand === '';
    if (cBrand === String(brandId)) return true;
    return parseSharedBrands(cat).includes(String(brandId));
}

function mergeBrandSettings(rawSettings, brand) {
    if (!brand) return rawSettings;
    const merged = Object.assign({}, rawSettings);
    if (brand.name)        merged.store_name   = brand.name;
    if (brand.tagline)     merged.tagline      = brand.tagline;
    if (brand.logo_url)    merged.logo_url     = brand.logo_url;
    if (brand.favicon_url) merged.favicon_url  = brand.favicon_url;
    if (brand.footer_text) merged.footer_about = brand.footer_text;
    return merged;
}

function checkOriginAllowed(req) {
    let allowedHost = '';
    try { allowedHost = new URL(ALLOWED_SITE_URL).hostname.replace(/^www\./i, '').toLowerCase(); } catch (e) {}
    const origin  = req.headers['origin']  || '';
    const referer = req.headers['referer'] || '';
    let reqHost   = '';
    try {
        if (origin) reqHost = new URL(origin).hostname.replace(/^www\./i, '').toLowerCase();
        else if (referer) reqHost = new URL(referer).hostname.replace(/^www\./i, '').toLowerCase();
    } catch (e) {}

    if (!allowedHost || allowedHost === 'your-domain.com') return { allowed: true, headerOrigin: origin || '*' };
    if (!origin && !referer) return { allowed: true, headerOrigin: ALLOWED_SITE_URL };
    const isMatch = reqHost === allowedHost || reqHost.endsWith('.' + allowedHost);
    return { allowed: isMatch, headerOrigin: isMatch && origin ? origin : ALLOWED_SITE_URL };
}

const server = http.createServer(async (req, res) => {
    const cors = checkOriginAllowed(req);

    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': cors.headerOrigin,
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
        });
        return res.end();
    }

    if (!cors.allowed) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: false, error: 'Forbidden: Domain not whitelisted on this Proxy Server.' }));
    }

    const commonHeaders = {
        'Access-Control-Allow-Origin': cors.headerOrigin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': `public, max-age=60, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=600`
    };

    const reqUrl    = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname  = reqUrl.pathname;
    const brandSlug = (reqUrl.searchParams.get('brand') || reqUrl.searchParams.get('brand_id') || '').trim();
    const productId = (reqUrl.searchParams.get('product_id') || '').trim();
    const chunkNum  = parseInt(reqUrl.searchParams.get('chunk') || '0', 10) || 0;
    const noCache   = reqUrl.searchParams.get('nocache') === '1';

    // 1. Reviews Endpoint (/api/public-reviews?product_id=<id>)
    if (pathname.includes('public-reviews')) {
        if (!productId) {
            res.writeHead(200, commonHeaders);
            return res.end(JSON.stringify({ success: true, data: [] }));
        }
        const cacheKey = 'reviews_' + safeCacheName(productId);
        const cached   = readJsonCache(cacheKey, noCache);
        if (cached) {
            res.writeHead(200, commonHeaders);
            return res.end(cached);
        }
        const rows = await d1Query("SELECT * FROM reviews WHERE product_id = ? AND is_approved = 1 ORDER BY created_at DESC LIMIT 50", [productId]);
        const out  = JSON.stringify({ success: true, data: rows });
        writeJsonCache(cacheKey, out);
        res.writeHead(200, commonHeaders);
        return res.end(out);
    }

    // 2. Checkout Endpoint (/api/checkout-data) — ONLY Checkout Data, NEVER Full Products DB!
    if (pathname.includes('checkout-data')) {
        const cacheKey = 'checkout_' + safeCacheName(brandSlug || 'main');
        const cached   = readJsonCache(cacheKey, noCache);
        if (cached) {
            res.writeHead(200, commonHeaders);
            return res.end(cached);
        }

        const allBrands = await d1Query("SELECT * FROM brands WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC");
        const activeBrand = brandSlug
            ? (allBrands.find(b => String(b.slug || '').toLowerCase() === brandSlug.toLowerCase() || b.id === brandSlug) || null)
            : null;

        const [settingsRows, zones, addons, promos, addOnce] = await Promise.all([
            d1Query("SELECT * FROM settings WHERE id = 1"),
            d1Query("SELECT * FROM delivery_zones"),
            d1Query("SELECT * FROM addons WHERE is_active = 1 ORDER BY created_at"),
            d1Query("SELECT * FROM promos WHERE is_active = 1 LIMIT 500"),
            activeBrand
                ? d1Query("SELECT id,name,base_price,flash_sale_price,gallery_images,variants,brand_id FROM products WHERE is_add_once = 1 AND is_active = 1 AND brand_id = ?", [activeBrand.id])
                : d1Query("SELECT id,name,base_price,flash_sale_price,gallery_images,variants,brand_id FROM products WHERE is_add_once = 1 AND is_active = 1 AND (brand_id IS NULL OR brand_id = '' OR show_on_main = 1)")
        ]);

        const rawSettings = settingsRows[0] || {};
        const out = JSON.stringify({
            success: true,
            data: {
                settings: mergeBrandSettings(rawSettings, activeBrand),
                brand: activeBrand,
                brands: allBrands,
                zones,
                addons,
                promos,
                add_once: addOnce
            }
        });
        writeJsonCache(cacheKey, out);
        res.writeHead(200, commonHeaders);
        return res.end(out);
    }

    // 3. Single Product Endpoint (/api/public-data?product_id=<id>) — ONLY Single Product + Related, NEVER Full DB!
    if (productId) {
        const cacheKey = 'product_' + safeCacheName(productId) + '_' + safeCacheName(brandSlug || 'main');
        const cached   = readJsonCache(cacheKey, noCache);
        if (cached) {
            res.writeHead(200, commonHeaders);
            return res.end(cached);
        }

        const pidLower = productId.toLowerCase();
        const [foundRows, allBrands, settingsRows, categories, prodCats] = await Promise.all([
            d1Query("SELECT * FROM products WHERE is_active = 1 AND (id = ? OR lower(sku) = ? OR lower(slug) = ?) LIMIT 1", [productId, pidLower, pidLower]),
            d1Query("SELECT * FROM brands WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC"),
            d1Query("SELECT * FROM settings WHERE id = 1"),
            d1Query("SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order"),
            d1Query("SELECT * FROM product_categories")
        ]);

        const found       = foundRows[0] || null;
        const rawSettings = settingsRows[0] || {};
        const activeBrand = brandSlug
            ? (allBrands.find(b => String(b.slug || '').toLowerCase() === brandSlug.toLowerCase() || b.id === brandSlug) || null)
            : null;

        let related = [];
        if (found) {
            related = found.brand_id
                ? await d1Query("SELECT * FROM products WHERE is_active = 1 AND id != ? AND brand_id = ? ORDER BY is_featured DESC, created_at DESC LIMIT 12", [found.id, found.brand_id])
                : await d1Query("SELECT * FROM products WHERE is_active = 1 AND id != ? ORDER BY is_featured DESC, created_at DESC LIMIT 12", [found.id]);
        }

        let prodBrand = activeBrand;
        if (found && found.brand_id) {
            const owner = allBrands.find(b => b.id === found.brand_id);
            if (owner) {
                found.brand_slug = owner.slug;
                found.brand_name = owner.name;
                if (!prodBrand) prodBrand = owner;
            }
        }

        const out = JSON.stringify({
            success: true,
            product: found,
            related_products: related,
            brand: prodBrand,
            brands: allBrands,
            settings: mergeBrandSettings(rawSettings, prodBrand),
            categories: categories.filter(c => isCatVisibleOnBrand(c, prodBrand ? prodBrand.id : null)),
            product_categories: prodCats
        });
        writeJsonCache(cacheKey, out);
        res.writeHead(200, commonHeaders);
        return res.end(out);
    }

    // 4. Master JSON + 100-Product Chunks (/api/public-data)
    const brandKey = safeCacheName(brandSlug || 'main');
    if (chunkNum > 0) {
        const cachedChunk = readJsonCache(`chunk_${brandKey}_${chunkNum}`, noCache);
        if (cachedChunk) {
            res.writeHead(200, commonHeaders);
            return res.end(cachedChunk);
        }
    }

    const masterCacheKey = `master_${brandKey}`;
    const cachedMaster   = readJsonCache(masterCacheKey, noCache);
    if (cachedMaster && chunkNum === 0) {
        res.writeHead(200, commonHeaders);
        return res.end(cachedMaster);
    }

    const allBrands = await d1Query("SELECT * FROM brands WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC");
    const activeBrand = brandSlug
        ? (allBrands.find(b => String(b.slug || '').toLowerCase() === brandSlug.toLowerCase() || b.id === brandSlug) || null)
        : null;
    const brandMap = new Map(allBrands.map(b => [b.id, b]));

    const [settingsRows, categories, products, prodCats, banners, sections] = await Promise.all([
        d1Query("SELECT * FROM settings WHERE id = 1"),
        d1Query("SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order"),
        d1Query("SELECT * FROM products WHERE is_active = 1 ORDER BY is_featured DESC, created_at DESC"),
        d1Query("SELECT * FROM product_categories"),
        activeBrand
            ? d1Query("SELECT * FROM banners WHERE is_active = 1 AND brand_id = ? ORDER BY sort_order", [activeBrand.id])
            : d1Query("SELECT * FROM banners WHERE is_active = 1 AND (brand_id IS NULL OR brand_id = '') ORDER BY sort_order"),
        activeBrand
            ? d1Query("SELECT * FROM home_sections WHERE is_active = 1 AND brand_id = ? ORDER BY sort_order", [activeBrand.id])
            : d1Query("SELECT * FROM home_sections WHERE is_active = 1 AND (brand_id IS NULL OR brand_id = '') ORDER BY sort_order")
    ]);

    const rawSettings   = settingsRows[0] || {};
    const mainStoreName = rawSettings.store_name || 'Ranonex';
    const activeBrandId = activeBrand ? activeBrand.id : null;
    const filteredCategories = categories.filter(c => isCatVisibleOnBrand(c, activeBrandId));

    const prodChunks = [];
    for (let i = 0; i < products.length; i += CHUNK_SIZE) {
        const slice = products.slice(i, i + CHUNK_SIZE);
        const cNum  = Math.floor(i / CHUNK_SIZE) + 1;
        prodChunks.push({ chunk: cNum, count: slice.length, products: slice });
        writeJsonCache(`chunk_${brandKey}_${cNum}`, JSON.stringify({
            success: true,
            chunk: cNum,
            count: slice.length,
            total_products: products.length,
            has_more: (i + CHUNK_SIZE) < products.length,
            next_chunk: (i + CHUNK_SIZE) < products.length ? (cNum + 1) : null,
            products: slice
        }));
    }

    const masterOut = JSON.stringify({
        success: true,
        data: {
            settings: mergeBrandSettings(rawSettings, activeBrand),
            main_settings: {
                store_name: mainStoreName,
                logo_url: rawSettings.logo_url || '',
                favicon_url: rawSettings.favicon_url || ''
            },
            brand: activeBrand,
            brands: allBrands,
            banners,
            categories: filteredCategories,
            product_chunks: prodChunks,
            total_products: products.length,
            chunk_size: CHUNK_SIZE,
            total_chunks: prodChunks.length,
            home_sections: sections,
            product_categories: prodCats
        }
    });

    writeJsonCache(masterCacheKey, masterOut);
    res.writeHead(200, commonHeaders);
    return res.end(masterOut);
});

server.listen(PORT, HOST, () => {
    console.log(`Ranonex Universal Proxy Server running on http://${HOST}:${PORT}`);
});
