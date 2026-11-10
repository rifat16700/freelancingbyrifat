/**
 * ============================================================================
 * RANONEX UNIVERSAL STATELESS PROXY ENGINE (Node.js Edition)
 * Works on: AlwaysData (Node.js), cPanel Node.js Selector, VPS, Railway, Render
 * ============================================================================
 * প্রক্সির কাজ শুধুমাত্র Cache Miss হলে D1 থেকে ডাটা ফেচ করে JSON আকারে ইউজার ও Cloudflare-কে দেওয়া।
 * ক্যাশ করে রাখার সম্পূর্ণ কাজ Cloudflare Edge Cache (5 মিনিট) এবং ব্রাউজারের।
 *
 * শুধু নিচের ৪টি লাইন পরিবর্তন করুন (অথবা আপনার সাইটের /stup-site পেজ থেকে জেনারেট করুন):
 */
const ALLOWED_SITE_URL  = process.env.ALLOWED_SITE_URL  || 'https://ranonex.shop';          // 1. আপনার মেইন সাইটের URL (Whitelist)
const CF_ACCOUNT_ID     = process.env.CF_ACCOUNT_ID     || 'YOUR_CLOUDFLARE_ACCOUNT_ID';    // 2. Cloudflare Account ID
const CF_D1_DATABASE_ID = process.env.CF_D1_DATABASE_ID || 'YOUR_D1_DATABASE_ID';           // 3. Cloudflare D1 Database ID
const CF_API_TOKEN      = process.env.CF_API_TOKEN      || 'YOUR_CF_API_TOKEN_D1_READ';     // 4. Cloudflare API Token (D1:Read Permission)

const CACHE_TTL_SECONDS     = 300; // Cloudflare 5 মিনিট (300s) Edge Cache TTL
const INITIAL_PRODUCT_COUNT = 20;  // ১ম রিকোয়েস্টে ২০টি প্রোডাক্ট (ব্লাজিং ফাস্ট ১ম ইম্প্রেশন)
const CHUNK_SIZE            = 50;  // ব্যাকগ্রাউন্ডের প্রতি চ্যাঙ্কে ৫০টি করে প্রোডাক্ট
const PORT              = process.env.PORT || process.env.ALWAYSDATA_HTTPD_PORT || 8100;
const HOST              = process.env.IP   || process.env.ALWAYSDATA_HTTPD_IP   || '0.0.0.0';

const http = require('http');
const { URL } = require('url');

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
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=600`
    };

    const reqUrl    = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname  = reqUrl.pathname;
    const brandSlug = (reqUrl.searchParams.get('brand') || reqUrl.searchParams.get('brand_id') || '').trim();
    const productId = (reqUrl.searchParams.get('product_id') || '').trim();
    const chunkNum  = parseInt(reqUrl.searchParams.get('chunk') || '0', 10) || 0;

    // 1. Reviews Endpoint (/api/public-reviews?product_id=<id>)
    if (pathname.includes('public-reviews')) {
        if (!productId) {
            res.writeHead(200, commonHeaders);
            return res.end(JSON.stringify({ success: true, data: [] }));
        }
        const rows = await d1Query("SELECT * FROM reviews WHERE product_id = ? AND is_approved = 1 ORDER BY created_at DESC LIMIT 50", [productId]);
        res.writeHead(200, commonHeaders);
        return res.end(JSON.stringify({ success: true, data: rows }));
    }

    // 2. Checkout Endpoint (/api/checkout-data) — ONLY Checkout Data, NEVER Full Products DB!
    if (pathname.includes('checkout-data')) {
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
        res.writeHead(200, commonHeaders);
        return res.end(JSON.stringify({
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
        }));
    }

    // 3. Single Product Endpoint (/api/public-data?product_id=<id>) — Cache Miss on Product Page -> Single Product Only!
    if (productId) {
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

        res.writeHead(200, commonHeaders);
        return res.end(JSON.stringify({
            success: true,
            product: found,
            related_products: related,
            brand: prodBrand,
            brands: allBrands,
            settings: mergeBrandSettings(rawSettings, prodBrand),
            categories: categories.filter(c => isCatVisibleOnBrand(c, prodBrand ? prodBrand.id : null)),
            product_categories: prodCats
        }));
    }

    // 4. Master JSON + 100-Product Chunks (/api/public-data)
    const allBrands = await d1Query("SELECT * FROM brands WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC");
    const activeBrand = brandSlug
        ? (allBrands.find(b => String(b.slug || '').toLowerCase() === brandSlug.toLowerCase() || b.id === brandSlug) || null)
        : null;

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

    // A. Subsequent 50-Product Chunk Request (?chunk=1, ?chunk=2, etc.)
    if (chunkNum > 0) {
        const offset = INITIAL_PRODUCT_COUNT + (chunkNum - 1) * CHUNK_SIZE;
        const slice  = (offset < products.length) ? products.slice(offset, offset + CHUNK_SIZE) : [];
        const hasMore = (offset + CHUNK_SIZE) < products.length;

        res.writeHead(200, commonHeaders);
        return res.end(JSON.stringify({
            success: true,
            chunk: chunkNum,
            count: slice.length,
            total_products: products.length,
            has_more: hasMore,
            next_chunk: hasMore ? (chunkNum + 1) : null,
            products: slice
        }));
    }

    // B. Initial Public Data Request (/public-data) -> First 20 products ONLY for instant 1st impression!
    const loadAll        = (reqUrl.searchParams.get('all') === '1');
    const initialSlice   = loadAll ? products : products.slice(0, INITIAL_PRODUCT_COUNT);
    const remainingCount = Math.max(0, products.length - initialSlice.length);
    const hasMore        = !loadAll && (remainingCount > 0);
    const totalChunks    = Math.ceil(remainingCount / CHUNK_SIZE);

    res.writeHead(200, commonHeaders);
    return res.end(JSON.stringify({
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
            products: initialSlice,
            initial_count: initialSlice.length,
            chunk_size: CHUNK_SIZE,
            total_products: products.length,
            has_more: hasMore,
            next_chunk: hasMore ? 1 : null,
            total_chunks: totalChunks,
            home_sections: sections,
            product_categories: prodCats
        }
    }));
});

server.listen(PORT, HOST, () => {
    console.log(`Ranonex Universal Stateless Proxy Server running on http://${HOST}:${PORT}`);
});
