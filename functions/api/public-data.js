import {
    ensureBrandSchema,
    resolveBrand,
    getAllActiveBrands,
    mergeSettingsWithBrand,
    filterCatalogForBrandContext,
    isCategoryVisibleOnBrand
} from '../_lib/brand.js';

export async function onRequestGet(context) {
    const { env } = context;
    if (!env.DB) return Response.json({ success: false, error: "Database not configured" });

    try {
        await ensureBrandSchema(env);

        const url = new URL(context.request.url);
        const brandParam = (url.searchParams.get("brand") || url.searchParams.get("brand_id") || "").trim();
        const chunkParam = url.searchParams.get("chunk");
        const singlePid = url.searchParams.get("product_id");
        const loadAll = url.searchParams.get("all") === "1";

        let activeBrand = null;
        if (brandParam) {
            const resolved = await resolveBrand(env, brandParam, true);
            activeBrand = resolved.brand;
        }

        const pSettings = env.DB.prepare("SELECT * FROM settings WHERE id = 1");
        const pProductCategories = env.DB.prepare("SELECT * FROM product_categories");
        const pCategories = env.DB.prepare("SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order");
        const pProducts = env.DB.prepare("SELECT * FROM products WHERE is_active = 1 ORDER BY is_featured DESC, created_at DESC");

        let pBanners, pSections;
        if (activeBrand) {
            pBanners = env.DB.prepare("SELECT * FROM banners WHERE is_active = 1 AND brand_id = ? ORDER BY sort_order").bind(activeBrand.id);
            pSections = env.DB.prepare("SELECT * FROM home_sections WHERE is_active = 1 AND brand_id = ? ORDER BY sort_order").bind(activeBrand.id);
        } else {
            pBanners = env.DB.prepare("SELECT * FROM banners WHERE is_active = 1 AND (brand_id IS NULL OR brand_id = '') ORDER BY sort_order");
            pSections = env.DB.prepare("SELECT * FROM home_sections WHERE is_active = 1 AND (brand_id IS NULL OR brand_id = '') ORDER BY sort_order");
        }

        const [rawSettingsRes, banners, categories, products, home_sections, product_categories, allBrands] = await Promise.all([
            pSettings.all(),
            pBanners.all().catch(() => ({ results: [] })),
            pCategories.all().catch(() => ({ results: [] })),
            pProducts.all().catch(() => ({ results: [] })),
            pSections.all().catch(() => ({ results: [] })),
            pProductCategories.all().catch(() => ({ results: [] })),
            getAllActiveBrands(env)
        ]);

        const brandMap = new Map(allBrands.map(b => [b.id, b]));
        const rawSettings = (rawSettingsRes.results && rawSettingsRes.results.length) ? rawSettingsRes.results[0] : {};
        const mergedSettings = mergeSettingsWithBrand(rawSettings, activeBrand);
        const mainStoreName = rawSettings.store_name || 'Ranonex';

        const rawVersion = (env.TEMPLATE_VERSION || env.VERSION || env.SITE_VERSION || env.THEME_VERSION || '').toString().trim().toLowerCase();
        const templateVersion = (rawVersion === 'v2' || rawVersion === '2') ? 'v2' : (rawVersion === 'v1' || rawVersion === '1' ? 'v1' : null);

        let brandColors = env.BRAND_COLORS || env.THEME_COLORS || env.THEME_CSS || null;
        if (activeBrand && activeBrand.theme_colors_obj && Object.keys(activeBrand.theme_colors_obj).length > 0) {
            brandColors = activeBrand.theme_colors;
        }

        const catalog = filterCatalogForBrandContext({
            allCategories: categories.results || [],
            allProducts: products.results || [],
            productCategories: product_categories.results || [],
            activeBrand,
            brandMap,
            mainStoreName
        });

        const enrichProduct = catalog.enrichProduct;

        // 1. Single product lookup (for product page direct access — looks across all active products)
        if (singlePid) {
            const sPidLower = String(singlePid).trim().toLowerCase();
            let found = (products.results || []).find(p =>
                String(p.id) === String(singlePid) ||
                (p.sku && String(p.sku).trim().toLowerCase() === sPidLower) ||
                (p.slug && String(p.slug).trim().toLowerCase() === sPidLower)
            );
            if (!found) {
                found = await env.DB.prepare(
                    "SELECT * FROM products WHERE is_active = 1 AND (id = ? OR lower(sku) = ? OR lower(slug) = ?) LIMIT 1"
                ).bind(String(singlePid).trim(), sPidLower, sPidLower).first().catch(() => null);
            }
            const enrichedFound = found ? enrichProduct(found) : null;
            const prodBrand = (enrichedFound && enrichedFound.brand_slug)
                ? (allBrands.find(b => b.slug === enrichedFound.brand_slug) || activeBrand)
                : activeBrand;
            const prodSettings = mergeSettingsWithBrand(rawSettings, prodBrand || null);

            const prodCategories = (categories.results || []).filter(c =>
                isCategoryVisibleOnBrand(c, prodBrand ? prodBrand.id : null)
            );

            return new Response(JSON.stringify({
                success: true,
                product: enrichedFound,
                brand: prodBrand || null,
                brands: allBrands,
                settings: prodSettings,
                categories: prodCategories,
                product_categories: product_categories.results || []
            }), {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                }
            });
        }

        const allProducts = catalog.products;
        const filteredCategories = catalog.categories;

        const INITIAL_LIMIT = 200;
        const CHUNK_SIZE = 200;

        // 2. Subsequent 200-product chunks (?chunk=1, ?chunk=2, etc.)
        if (chunkParam) {
            const chunkNum = Math.max(1, parseInt(chunkParam, 10) || 1);
            const offset = INITIAL_LIMIT + (chunkNum - 1) * CHUNK_SIZE;
            const chunkProducts = allProducts.slice(offset, offset + CHUNK_SIZE);
            const hasMore = (offset + CHUNK_SIZE) < allProducts.length;

            return new Response(JSON.stringify({
                success: true,
                chunk: chunkNum,
                count: chunkProducts.length,
                total_products: allProducts.length,
                has_more: hasMore,
                next_chunk: hasMore ? (chunkNum + 1) : null,
                products: chunkProducts
            }), {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                }
            });
        }

        // 3. Initial load
        const initialProducts = loadAll ? allProducts : allProducts.slice(0, INITIAL_LIMIT);
        const remainingCount = Math.max(0, allProducts.length - INITIAL_LIMIT);
        const totalChunks = Math.ceil(remainingCount / CHUNK_SIZE);
        const hasMore = allProducts.length > INITIAL_LIMIT && !loadAll;

        const data = {
            settings: mergedSettings,
            main_settings: {
                store_name: rawSettings.store_name || 'Ranonex',
                logo_url: rawSettings.logo_url || '',
                favicon_url: rawSettings.favicon_url || ''
            },
            brand: activeBrand || null,
            brands: allBrands,
            banners: banners.results || [],
            categories: filteredCategories,
            products: initialProducts,
            has_more: hasMore,
            next_chunk: hasMore ? 1 : null,
            total_products: allProducts.length,
            initial_count: initialProducts.length,
            chunk_size: CHUNK_SIZE,
            total_chunks: totalChunks,
            home_sections: home_sections.results || [],
            product_categories: product_categories.results || [],
            tawk_widget_url: env.TAWK_WIDGET_URL || null,
            template_version: templateVersion,
            brand_colors: brandColors
        };

        return new Response(JSON.stringify({ success: true, data }), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });
    } catch (e) {
        return Response.json({ success: false, error: e.message });
    }
}
